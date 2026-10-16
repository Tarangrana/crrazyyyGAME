'use strict';
// ---------------------------------------------------------------------------
// Low-poly 3D diorama renderer (three.js). The simulation stays a 2D side
// view; every frame this file mirrors the simulation state into a flat-shaded
// 3D scene: jittered icosahedron foliage, faceted hills, real lighting and
// shadows, and seasonal fog. All models are built in code here.
// ---------------------------------------------------------------------------

const World3D = (() => {
  const U = 1 / 20;
  const wx = x => x * U;
  const wy = y => (GROUND - y) * U;
  const SKY_Y = y => Math.min(wy(y), 4 + (wy(y) - 4) * 0.62); // keep flyers on screen
  const PLAY_Z = 0.6;

  let renderer, scene, camera, hemi, sun, playerLight, denLight;
  let skyDome, skyFaceShade = [];
  const M = {};
  const geo = {};
  const treeMap = new Map();
  let bushObjs = [], lastG = null;
  let squirrel, hawkObj, jayObj, hawkMark, tutMark, geeseObj, sunObj, partMesh;
  let stream = {}, den = {}, tufts = [], pines = [], clouds = [], hills = [];
  const pools = {};
  const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  const colorCache = new Map();
  const cssColor = s => { let c = colorCache.get(s); if (!c) { c = new THREE.Color(s); colorCache.set(s, c); } return c; };
  const setCol = (m, arr) => m.color.setRGB(arr[0] / 255, arr[1] / 255, arr[2] / 255);

  // ---------- low-poly helpers ----------
  function mat(hex, o) { return new THREE.MeshPhongMaterial(Object.assign({ color: hex, flatShading: true, shininess: 0, specular: 0x000000 }, o || {})); }
  function basic(hex, o) { return new THREE.MeshBasicMaterial(Object.assign({ color: hex }, o || {})); }
  function jitter(g, amt) {
    if (!amt) { g.computeVertexNormals(); return g; }
    const pos = g.attributes.position, seen = new Map();
    for (let i = 0; i < pos.count; i++) {
      const k = pos.getX(i).toFixed(3) + ',' + pos.getY(i).toFixed(3) + ',' + pos.getZ(i).toFixed(3);
      let o = seen.get(k);
      if (!o) { o = [rand(-amt, amt), rand(-amt, amt), rand(-amt, amt)]; seen.set(k, o); }
      pos.setXYZ(i, pos.getX(i) + o[0], pos.getY(i) + o[1], pos.getZ(i) + o[2]);
    }
    pos.needsUpdate = true; g.computeVertexNormals(); return g;
  }
  const ico = (r, j = 0, d = 0) => jitter(new THREE.IcosahedronGeometry(r, d), j);
  function mesh(g, m, cast = true, recv = false) { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = recv; return o; }
  function group(...kids) { const g = new THREE.Group(); for (const k of kids) g.add(k); return g; }

  // ---------- init ----------
  function init(canvas) {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 80, 230);
    camera = new THREE.PerspectiveCamera(32, W / H, 0.5, 600);

    hemi = new THREE.HemisphereLight(0xffffff, 0x775533, 0.8); scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 22, bottom: -14, near: 1, far: 120 });
    sun.shadow.bias = -0.0008;
    scene.add(sun, sun.target);
    playerLight = new THREE.PointLight(0xd8e6ff, 0, 15, 1.4); scene.add(playerLight);
    denLight = new THREE.PointLight(0xff9a40, 0, 22, 1.3); scene.add(denLight);

    M.grass = mat(0x71c552); M.soil = mat(0x6e4a2c); M.soilDark = mat(0x4a321e);
    M.far = mat(0xa9d9b0, { fog: true }); M.mid = mat(0x7fc47f); M.near = mat(0x6cb86a);
    M.leaf = [mat(0x8fdc68), mat(0xb5ea7f), mat(0xf6a9c9)];
    M.bush = mat(0x5fb04e); M.bark = mat(0x6b4528); M.barkLight = mat(0xc9a070);
    M.snow = mat(0xf4f8fc); M.pine = mat(0x2f6b46); M.rock = mat(0x8a8f96); M.tuft = mat(0x4f9e3c);
    M.water = mat(0x4f9fdc, { transparent: true, opacity: 0.72 }); M.ice = mat(0xbfe2f1, { transparent: true, opacity: 0.92, shininess: 60, specular: 0xffffff });
    M.berry = mat(0xd8344a); M.blossom = mat(0xf6a9c9); M.nut = mat(0xc98a3f); M.cap = mat(0x7a4b22);
    M.mushStem = mat(0xf3e6cf); M.mushCap = mat(0xc8553d); M.white = mat(0xffffff);
    M.fur = mat(0xc9692b); M.furD = mat(0x99481c); M.belly = mat(0xf4cf9c); M.dark = mat(0x1a120c);
    M.hawk = mat(0x6a452b); M.hawkD = mat(0x4a301f); M.hawkHead = mat(0xefe4cf); M.beak = mat(0xf2c12e);
    M.jay = mat(0x3b86de); M.jayD = mat(0x1f5aa8);
    M.mound = mat(0x5a3a22); M.hole = basic(0x120a05); M.flame = basic(0xffa040); M.flameCore = basic(0xffe680);
    M.cloud = mat(0xffffff, { emissive: 0x555555 }); M.sun = basic(0xfff3b0, { fog: false });
    M.ring = basic(0xc79bff, { transparent: true, opacity: 0.9, fog: false });
    M.hawkRing = basic(0xd23a2a, { transparent: true, opacity: 0.8 }); M.hawkShadow = basic(0x140a0a, { transparent: true, opacity: 0.35, depthWrite: false });
    M.marker = basic(0xffd84a, { fog: false }); M.goose = basic(0x3a2e2a);

    geo.nut = ico(0.2, 0.02); geo.nut.scale(0.85, 1.1, 0.85);
    geo.cap = new THREE.IcosahedronGeometry(0.23, 0); geo.cap.scale(1, 0.55, 1); geo.cap.computeVertexNormals();
    geo.stem = new THREE.CylinderGeometry(0.025, 0.035, 0.14, 4);
    geo.leafBit = ico(0.18, 0.03); geo.berry = ico(0.16, 0); geo.blossom = ico(0.17, 0.02);
    geo.mound = new THREE.IcosahedronGeometry(0.55, 0); geo.mound.scale(1, 0.42, 0.8); geo.mound.computeVertexNormals();
    geo.twig = new THREE.CylinderGeometry(0.025, 0.04, 0.55, 4);
    geo.mushStem = new THREE.CylinderGeometry(0.09, 0.12, 0.34, 5);
    geo.mushCap = new THREE.ConeGeometry(0.32, 0.26, 6);
    geo.dot = ico(0.05, 0);

    buildSky(); buildHills(); buildBackdrop(); buildGround(); buildStream(); buildDen();
    squirrel = buildSquirrel(); scene.add(squirrel.root);
    hawkObj = buildHawk(); scene.add(hawkObj.root);
    jayObj = buildJay(); scene.add(jayObj.root);
    buildMarkers(); buildParticles();
  }

  // quality adapts to the device: if frames get slow, render fewer pixels, then drop shadows
  let baseRatio = 1, quality = 0, slowT = 0, size = [W, H];
  function resize(wpx, hpx, ratio) {
    if (!renderer) return;
    baseRatio = Math.min(ratio, 1.5); size = [wpx, hpx];
    applyQuality();
  }
  function applyQuality() {
    renderer.setPixelRatio(baseRatio * [1, 0.75, 0.6, 0.5][quality]);
    renderer.setSize(size[0], size[1], false);
    const sh = quality < 3;
    if (renderer.shadowMap.enabled !== sh) { renderer.shadowMap.enabled = sh; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); }
  }
  function adapt(dt) {
    if (quality >= 3) return;
    slowT = dt > 0.034 ? slowT + dt : Math.max(0, slowT - dt * 0.5);
    if (slowT > 2) { quality++; slowT = 0; applyQuality(); }
  }

  // ---------- sky, sun, clouds ----------
  function buildSky() {
    const g = new THREE.IcosahedronGeometry(320, 2);
    const n = g.attributes.position.count;
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    for (let f = 0; f < n / 3; f++) skyFaceShade.push(rand(-0.035, 0.035));
    skyDome = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    skyDome.renderOrder = -10;
    scene.add(skyDome);
    sunObj = mesh(ico(9, 0.6, 1), M.sun, false); scene.add(sunObj);
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      const parts = 3 + (Math.random() * 3 | 0);
      for (let j = 0; j < parts; j++) {
        const m = mesh(ico(rand(2.4, 4.2), 0.5), M.cloud, false);
        m.position.set(j * 3.4 - parts * 1.6, rand(-0.6, 1.4), rand(-1.5, 1.5)); m.scale.y = 0.7; c.add(m);
      }
      clouds.push({ obj: c, x: i * 34 + rand(0, 20), y: rand(26, 38), z: rand(-110, -80) });
      scene.add(c);
    }
  }
  function paintSky(top, bot, dark) {
    const g = skyDome.geometry, pos = g.attributes.position, col = g.attributes.color;
    for (let f = 0; f < pos.count / 3; f++) {
      const cy = (pos.getY(f * 3) + pos.getY(f * 3 + 1) + pos.getY(f * 3 + 2)) / 3;
      const t = clamp((cy + 20) / 200, 0, 1);
      const sh = 1 + skyFaceShade[f] - dark * 0.75;
      const r = lerp(bot[0], top[0], t) / 255 * sh, gg = lerp(bot[1], top[1], t) / 255 * sh, b = lerp(bot[2], top[2], t) / 255 * (sh + dark * 0.12);
      for (let v = 0; v < 3; v++) col.setXYZ(f * 3 + v, r, gg, b);
    }
    col.needsUpdate = true;
  }

  // ---------- hills: faceted ribbons at three depths ----------
  function ridge(z, base, amp, m, seed) {
    const pts = [];
    const x0 = -160, x1 = 330, step = 7;
    for (let x = x0; x <= x1; x += step) {
      const h = base + amp * (0.6 * Math.sin(x * 0.045 + seed) + 0.4 * Math.sin(x * 0.12 + seed * 2.3)) + rand(-amp * 0.15, amp * 0.15);
      pts.push({ x: x + rand(-1.5, 1.5), h, mz: z + rand(-4, 4), mh: h * rand(0.45, 0.65) });
    }
    const v = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], bot = -8;
      const A = [a.x, a.h, z], B = [b.x, b.h, z], Am = [a.x, a.mh, a.mz], Bm = [b.x, b.mh, b.mz], A0 = [a.x, bot, z], B0 = [b.x, bot, z];
      v.push(...Am, ...Bm, ...A, ...A, ...Bm, ...B, ...A0, ...B0, ...Am, ...Am, ...B0, ...Bm);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    const o = mesh(g, m, false, true);
    scene.add(o); hills.push(o);
  }
  function buildHills() {
    ridge(-150, 30, 14, M.far, 1.1);
    ridge(-80, 13, 7, M.mid, 3.7);
    ridge(-38, 4, 3, M.near, 6.2);
  }

  // ---------- backdrop: pines, rocks, front tufts ----------
  function buildBackdrop() {
    for (let x = -40; x < 200; x += rand(5, 11)) {
      const z = rand(-30, -10), s = rand(0.8, 1.7);
      const g = new THREE.Group();
      const trunk = mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.4, 5), M.bark); trunk.position.y = 0.7; g.add(trunk);
      const caps = [];
      for (let k = 0; k < 3; k++) {
        const r = 1.6 - k * 0.42, y = 1.4 + k * 1.15;
        const c = mesh(jitter(new THREE.ConeGeometry(r, 1.9, 6), 0.08), M.pine); c.position.y = y + 0.8; g.add(c);
        const sc = mesh(new THREE.ConeGeometry(r * 0.72, 0.8, 6), M.snow, false); sc.position.y = y + 1.32; g.add(sc); caps.push(sc);
      }
      g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = rand(0, 3);
      scene.add(g); pines.push({ g, caps });
    }
    for (let i = 0; i < 26; i++) {
      const r = mesh(ico(rand(0.4, 1.2), 0.18), M.rock, true, true);
      r.position.set(rand(-30, 190), 0.1, rand(-22, -4)); r.scale.y = 0.6;
      if (r.position.x > 105 && r.position.x < 119) r.position.x += 16;
      scene.add(r);
    }
    for (let x = -30; x < 190; x += rand(1.2, 3)) {
      if (x > 106 && x < 118) continue;
      const t = mesh(new THREE.ConeGeometry(rand(0.12, 0.22), rand(0.4, 0.8), 4), M.tuft, false);
      t.position.set(x, 0.2, rand(1.6, 5.5)); t.rotation.set(rand(-0.3, 0.3), rand(0, 3), rand(-0.3, 0.3));
      scene.add(t); tufts.push(t);
    }
  }

  // ---------- ground with a cutaway soil front and the stream gap ----------
  function groundPiece(x0, x1) {
    const segX = Math.max(2, Math.ceil((x1 - x0) / 2.5));
    const g = new THREE.PlaneGeometry(x1 - x0, 46, segX, 16);
    g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, -17);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i), x = pos.getX(i);
      if ((z < -3 || z > 3.5) && x > x0 + 0.5 && x < x1 - 0.5) pos.setY(i, rand(0, z < -3 ? 0.55 : 0.18));
    }
    g.computeVertexNormals();
    scene.add(mesh(g, M.grass, false, true));
    const front = mesh(jitter(new THREE.BoxGeometry(x1 - x0, 9, 0.6, segX, 3, 1), 0.12), M.soil, false, true);
    front.position.set((x0 + x1) / 2, -4.5, 6); scene.add(front);
  }
  function buildGround() {
    groundPiece(-80, wx(STREAM_X0));
    groundPiece(wx(STREAM_X1), 260);
  }
  function buildStream() {
    const a = wx(STREAM_X0), b = wx(STREAM_X1), w = b - a, depth = (STREAM_BED - GROUND) * U;
    const bed = mesh(jitter(new THREE.PlaneGeometry(w, 46, 4, 12).rotateX(-Math.PI / 2), 0.08), M.soilDark, false, true);
    bed.position.set((a + b) / 2, -depth, -17); scene.add(bed);
    for (const x of [a, b]) {
      const wall = mesh(new THREE.BoxGeometry(0.3, depth, 46), M.soil, false, true);
      wall.position.set(x, -depth / 2, -17); scene.add(wall);
    }
    const front = mesh(new THREE.BoxGeometry(w, 9 - depth, 0.6), M.soil, false, true);
    front.position.set((a + b) / 2, -depth - (9 - depth) / 2, 6); scene.add(front);
    stream.water = mesh(new THREE.BoxGeometry(w - 0.05, 1, 46), M.water, false, true);
    stream.water.position.set((a + b) / 2, 0, -17); scene.add(stream.water);
    stream.ice = mesh(jitter(new THREE.BoxGeometry(w, 0.4, 46, 3, 1, 8), 0.05), M.ice, false, true);
    stream.ice.position.set((a + b) / 2, -0.15, -17); scene.add(stream.ice);
    stream.depth = depth;
  }

  // ---------- den: a hollow low-poly stump ----------
  function buildDen() {
    const g = new THREE.Group(); g.position.set(wx(DEN_X), 0, -2.6);
    const stump = mesh(jitter(new THREE.CylinderGeometry(1.9, 2.25, 3, 8, 2), 0.09), M.bark, true, true); stump.position.y = 1.5; g.add(stump);
    const top = mesh(new THREE.CylinderGeometry(1.86, 1.9, 0.14, 8), M.barkLight); top.position.y = 3.05; g.add(top);
    const hole = mesh(new THREE.CircleGeometry(0.85, 7), M.hole, false); hole.scale.y = 1.35; hole.position.set(0, 0.95, 2.13); g.add(hole);
    for (let i = 0; i < 4; i++) {
      const r = mesh(new THREE.ConeGeometry(0.45, 1.6, 5), M.bark); const a = i / 4 * TAU + 0.4;
      r.position.set(Math.cos(a) * 2.1, 0.25, Math.sin(a) * 2.1); r.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); g.add(r);
    }
    den.snow = mesh(jitter(new THREE.CylinderGeometry(2.0, 1.95, 0.4, 8), 0.06), M.snow); den.snow.position.y = 3.2; g.add(den.snow);
    den.flame = group(mesh(new THREE.ConeGeometry(0.3, 0.8, 5), M.flame, false), mesh(new THREE.ConeGeometry(0.15, 0.45, 5), M.flameCore, false));
    den.flame.children[1].position.set(0, -0.1, 0.12);
    den.flame.position.set(0, 0.45, 2.0); g.add(den.flame);
    scene.add(g); den.g = g;
  }

  // ---------- creatures ----------
  function buildSquirrel() {
    const root = new THREE.Group(), turn = new THREE.Group(), pose = new THREE.Group();
    root.add(turn); turn.add(pose); turn.scale.setScalar(1.3);
    const body = mesh(ico(0.55, 0.05), M.fur); body.scale.set(1.3, 0.95, 0.85); body.position.set(0, 0.62, 0); pose.add(body);
    const belly = mesh(ico(0.36, 0.03), M.belly); belly.scale.set(1, 0.8, 0.75); belly.position.set(0.28, 0.5, 0.12); pose.add(belly);
    const head = new THREE.Group(); head.position.set(0.62, 1.08, 0); pose.add(head);
    const skull = mesh(ico(0.42, 0.04), M.fur); skull.scale.set(1.12, 1, 0.95); head.add(skull);
    const snout = mesh(ico(0.2, 0.02), M.belly); snout.position.set(0.36, -0.08, 0); head.add(snout);
    const nose = mesh(ico(0.07, 0), M.dark); nose.position.set(0.53, -0.04, 0); head.add(nose);
    const eyes = [];
    for (const s of [-1, 1]) {
      const e = mesh(ico(0.075, 0), M.dark, false); e.position.set(0.22, 0.08, 0.33 * s); head.add(e); eyes.push(e);
      const ear = mesh(new THREE.ConeGeometry(0.13, 0.38, 4), M.fur); ear.position.set(-0.08, 0.42, 0.17 * s); ear.rotation.z = 0.15; head.add(ear);
    }
    const cheeks = [];
    for (const s of [-1, 1]) { const c = mesh(ico(0.17, 0.02), M.belly); c.position.set(0.22, -0.18, 0.28 * s); head.add(c); cheeks.push(c); }
    const tail = new THREE.Group(); tail.position.set(-0.6, 0.55, 0); pose.add(tail);
    const tailPts = [[-0.15, 0.1, 0.36], [-0.45, 0.45, 0.42], [-0.62, 0.92, 0.46], [-0.55, 1.4, 0.44], [-0.28, 1.72, 0.36], [0.02, 1.8, 0.26]];
    for (const [x, y, r] of tailPts) { const t = mesh(ico(r, 0.06), M.furD); t.position.set(x, y, 0); t.scale.z = 0.8; tail.add(t); }
    const tip = mesh(ico(0.2, 0.03), M.belly); tip.position.set(0.12, 1.86, 0.06); tail.add(tip);
    const legs = [];
    for (const [x, y, s, r] of [[0.42, 0.14, 1, 0.15], [0.42, 0.14, -1, 0.15], [-0.32, 0.22, 1, 0.27], [-0.32, 0.22, -1, 0.27]]) {
      const l = mesh(ico(r, 0.02), M.furD); l.position.set(x, y, 0.28 * s); l.scale.set(1.1, 0.8, 0.8); pose.add(l); legs.push({ m: l, x, y });
    }
    const snowHat = mesh(ico(0.3, 0.05), M.snow, false); snowHat.scale.set(1, 0.4, 1); snowHat.position.set(0, 0.38, 0); head.add(snowHat);
    return { root, turn, pose, head, tail, legs, cheeks, eyes, snowHat, yaw: 0 };
  }

  function buildHawk() {
    const root = new THREE.Group(), pose = new THREE.Group(); root.add(pose);
    const body = mesh(ico(0.5, 0.03), M.hawk); body.scale.set(1.8, 0.65, 0.7); pose.add(body);
    const head = mesh(ico(0.34, 0.02), M.hawkHead); head.position.set(0.85, 0.15, 0); pose.add(head);
    const beak = mesh(new THREE.ConeGeometry(0.12, 0.34, 4), M.beak); beak.rotation.z = -Math.PI / 2; beak.position.set(1.22, 0.08, 0); pose.add(beak);
    const tail = mesh(new THREE.BoxGeometry(0.9, 0.08, 0.6), M.hawkD); tail.position.set(-1.1, 0.02, 0); pose.add(tail);
    const wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(0.05, 0.12, 0.25 * s);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0.6, 0, 0, -0.6, 0, 0, -0.2, 0, 2.4 * s, 0.6, 0, 0, -0.2, 0, 2.4 * s, 0.25, 0.05, 1.3 * s], 3));
      g.computeVertexNormals();
      const w = mesh(g, new THREE.MeshPhongMaterial({ color: 0x4a301f, flatShading: true, shininess: 0, side: THREE.DoubleSide }));
      pivot.add(w); pose.add(pivot); wings.push({ pivot, s });
    }
    return { root, pose, wings };
  }

  function buildJay() {
    const root = new THREE.Group(), pose = new THREE.Group(); root.add(pose);
    const body = mesh(ico(0.34, 0.02), M.jay); body.scale.set(1.3, 0.9, 0.85); body.position.y = 0.38; pose.add(body);
    const belly = mesh(ico(0.24, 0.02), M.white); belly.position.set(0.12, 0.28, 0.08); pose.add(belly);
    const head = mesh(ico(0.24, 0.02), M.jay); head.position.set(0.36, 0.7, 0); pose.add(head);
    const crest = mesh(new THREE.ConeGeometry(0.1, 0.38, 4), M.jay); crest.position.set(0.26, 0.98, 0); crest.rotation.z = 0.5; pose.add(crest);
    const beak = mesh(new THREE.ConeGeometry(0.06, 0.2, 4), M.dark); beak.rotation.z = -Math.PI / 2; beak.position.set(0.62, 0.68, 0); pose.add(beak);
    const tail = mesh(new THREE.BoxGeometry(0.55, 0.06, 0.24), M.jayD); tail.position.set(-0.55, 0.45, 0); tail.rotation.z = 0.35; pose.add(tail);
    const wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(0, 0.5, 0.2 * s);
      const w = mesh(new THREE.BoxGeometry(0.5, 0.05, 0.6), M.jayD); w.position.z = 0.3 * s; pivot.add(w); pose.add(pivot); wings.push({ pivot, s });
    }
    return { root, pose, wings };
  }

  function buildTree(t) {
    const g = new THREE.Group(); g.position.set(wx(t.x), 0, -2.3);
    const full = new THREE.Group(); g.add(full);
    const trunk = mesh(jitter(new THREE.CylinderGeometry(0.36, 0.66, 6.2, 6, 2), 0.07), M.bark, true, true); trunk.position.y = 3.1; full.add(trunk);
    const branches = new THREE.Group(); full.add(branches);
    const snowBits = [];
    for (const br of t.branches) {
      const dx = Math.cos(br.a), dy = -Math.sin(br.a), len = br.l * U * 1.25;
      const b = mesh(new THREE.CylinderGeometry(0.07, 0.2, len, 5), M.bark);
      b.position.set(dx * len / 2, 5.6 + dy * len / 2, rand(-0.4, 0.4)); b.rotation.z = Math.atan2(-dx, dy);
      branches.add(b);
      const sn = mesh(ico(0.28, 0.05), M.snow, false); sn.scale.set(1.4, 0.45, 1); sn.position.set(dx * len * 0.9, 5.6 + dy * len * 0.9 + 0.12, b.position.z); branches.add(sn); snowBits.push(sn);
    }
    const canopy = new THREE.Group(); canopy.position.y = 7; full.add(canopy);
    for (const b of t.blobs) {
      const m = mesh(ico(b.r * U * 1.25, 0.12), M.leaf[b.k]);
      m.position.set(b.dx * U * 1.1, -b.dy * U, rand(-0.9, 0.9)); m.rotation.set(rand(0, 3), rand(0, 3), 0); canopy.add(m);
    }
    const blossoms = new THREE.Group(); canopy.add(blossoms);
    const fruit = new THREE.Group(); canopy.add(fruit);
    for (let i = 0; i < 12; i++) {
      const a = rand(0, TAU), r = rand(1.6, 2.4);
      const bl = mesh(geo.blossom, M.blossom, false); bl.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.6, rand(0.9, 1.7)); blossoms.add(bl);
    }
    for (let i = 0; i < 7; i++) {
      const a = acornMesh(); a.position.set(rand(-1.8, 1.8), rand(-1.6, -0.6), rand(0.9, 1.6)); a.scale.setScalar(0.9); fruit.add(a);
    }
    const sap = new THREE.Group(); g.add(sap);
    const stem = mesh(new THREE.CylinderGeometry(0.05, 0.08, 1.2, 4), M.bark); stem.position.y = 0.6; sap.add(stem);
    for (const s of [-1, 1]) { const l = mesh(geo.leafBit, M.leaf[0]); l.scale.set(1.8, 0.5, 1); l.position.set(0.22 * s, 1.15 + (s > 0 ? 0.12 : 0), 0); l.rotation.z = 0.5 * s; sap.add(l); }
    scene.add(g);
    return { g, full, canopy, branches, blossoms, fruit, sap, snowBits };
  }

  function buildBush(b) {
    const g = new THREE.Group(); g.position.set(wx(b.x), 0, -1.7);
    const blobs = [[-0.75, 0.62, 0.8], [0.7, 0.66, 0.85], [0, 1.05, 0.95]];
    for (const [x, y, r] of blobs) { const m = mesh(ico(r, 0.1), M.bush, true, true); m.position.set(x, y, rand(-0.2, 0.2)); g.add(m); }
    const berries = [];
    for (const [x, y] of [[-0.6, 0.8], [0.55, 1.0], [0.05, 1.45]]) { const m = mesh(geo.berry, M.berry, false); m.position.set(x, y, 0.85); g.add(m); berries.push(m); }
    const snow = mesh(ico(1.1, 0.1), M.snow, false); snow.scale.set(1.25, 0.4, 0.9); snow.position.y = 1.6; g.add(snow);
    scene.add(g);
    return { g, berries, snow };
  }

  function acornMesh() {
    const g = new THREE.Group();
    const n = mesh(geo.nut, M.nut); g.add(n);
    const c = mesh(geo.cap, M.cap); c.position.y = 0.16; g.add(c);
    const s = mesh(geo.stem, M.cap, false); s.position.y = 0.3; g.add(s);
    return g;
  }

  function buildMarkers() {
    hawkMark = new THREE.Group();
    const sh = mesh(new THREE.CircleGeometry(1, 12), M.hawkShadow, false); sh.rotation.x = -Math.PI / 2; hawkMark.add(sh);
    const ring = mesh(new THREE.RingGeometry(2.0, 2.25, 16), M.hawkRing, false); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; hawkMark.add(ring);
    hawkMark.userData = { sh, ring }; scene.add(hawkMark);
    tutMark = new THREE.Group();
    const cone = mesh(new THREE.ConeGeometry(0.45, 0.95, 4), M.marker, false); cone.rotation.x = Math.PI; tutMark.add(cone);
    const disc = mesh(new THREE.RingGeometry(0.7, 0.95, 12), M.marker, false); disc.rotation.x = -Math.PI / 2; tutMark.add(disc);
    tutMark.userData = { cone, disc }; scene.add(tutMark);
    geeseObj = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const b = new THREE.Group();
      for (const s of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(0.6, 0.08, 0.1), M.goose, false); w.position.x = 0.28 * s; w.rotation.z = 0.35 * s; b.add(w); }
      b.position.set(Math.abs(i - 3) * 1.4, -Math.abs(i - 3) * 0.7, 0); geeseObj.add(b);
    }
    scene.add(geeseObj);
  }

  function buildParticles() {
    const g = new THREE.TetrahedronGeometry(1, 0);
    partMesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }), 600);
    partMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    partMesh.setColorAt(0, new THREE.Color(1, 1, 1));
    partMesh.frustumCulled = false;
    scene.add(partMesh);
  }

  // ---------- object pools for things that come and go ----------
  function pool(name, make) {
    let p = pools[name];
    if (!p) p = pools[name] = { list: [], used: 0, make };
    return p;
  }
  function take(p) {
    if (p.used >= p.list.length) { const o = p.make(); scene.add(o); p.list.push(o); }
    const o = p.list[p.used++]; o.visible = true; return o;
  }
  function beginPools() { for (const k in pools) pools[k].used = 0; }
  function endPools() { for (const k in pools) { const p = pools[k]; for (let i = p.used; i < p.list.length; i++) p.list[i].visible = false; } }

  function reset() {
    for (const v of treeMap.values()) scene.remove(v.g);
    treeMap.clear();
    for (const b of bushObjs) scene.remove(b.g);
    bushObjs = [];
  }

  // ---------- per-frame sync ----------
  const LIGHT = [
    { hemi: 0.85, sun: 0.85, sky: 0xe4f6ff, gnd: 0x6a8a4a, sunCol: 0xfff4d8 },
    { hemi: 0.78, sun: 1.05, sky: 0xfff6dc, gnd: 0x5a7a3a, sunCol: 0xfff0c0 },
    { hemi: 0.75, sun: 0.92, sky: 0xffe0c0, gnd: 0x7a5a3a, sunCol: 0xffc890 },
    { hemi: 0.7, sun: 0.7, sky: 0xdfe8f5, gnd: 0x8090a8, sunCol: 0xdfe8ff },
  ];

  function winterDark() {
    if (G.season !== 3) return 0;
    const L = seasonLen();
    return 0.5 * Math.min(clamp(G.seasonT / 4, 0, 1), clamp((L - G.seasonT) / 3, 0, 1));
  }

  function sync(dt) {
    if (G !== lastG) { reset(); lastG = G; }
    const s = G.season, prev = (s + 3) % 4;
    const k0 = clamp(G.seasonT / (G.attract ? 1.5 : 3), 0, 1), k = k0 * k0 * (3 - 2 * k0);
    const pal = currentPal();
    const dark = winterDark();
    const cx = wx(G.camX + W / 2);
    const cbm = Settings.data.colorblind;

    // camera
    let shx = 0, shy = 0;
    if (G.shake > 0 && !Settings.data.reduceMotion) { shx = rand(-1, 1) * G.shake * 0.02; shy = rand(-1, 1) * G.shake * 0.02; }
    camera.position.set(cx + shx, 6.4 + shy, 37);
    camera.lookAt(cx, 4.3, 0);
    camera.updateMatrixWorld();

    // lights & atmosphere
    const L0 = LIGHT[prev], L1 = LIGHT[s];
    hemi.intensity = lerp(lerp(L0.hemi, L1.hemi, k), 0.13, dark);
    hemi.color.set(L0.sky).lerp(tmpC.set(L1.sky), k).lerp(tmpC.set(0x5a6f9a), dark);
    hemi.groundColor.set(L0.gnd).lerp(tmpC.set(L1.gnd), k);
    sun.intensity = lerp(lerp(L0.sun, L1.sun, k), 0.06, dark);
    sun.color.set(L0.sunCol).lerp(tmpC.set(L1.sunCol), k);
    sun.position.set(cx - 14, 30, 22); sun.target.position.set(cx, 0, 0); sun.target.updateMatrixWorld();
    const blizzard = s === 3 && G.bliz.dur > 0;
    playerLight.intensity = 1.5 * dark;
    playerLight.distance = blizzard ? 10 : 15;
    const p = G.player;
    playerLight.position.set(wx(p.x), wy(p.y) + 2.2, 3.5);
    denLight.intensity = (s === 3 ? 2.2 : 0) * clamp(G.seasonT / 2, 0, 1) * (0.9 + Math.sin(G.t * 13) * 0.08);
    denLight.position.set(wx(DEN_X), 1.4, 0.4);
    const fogCol = tmpC.setRGB(pal.sky1[0] / 255, pal.sky1[1] / 255, pal.sky1[2] / 255).lerp(tmpC2.set(0x101a33), dark);
    scene.fog.color.copy(fogCol);
    scene.fog.near = blizzard ? 34 : lerp(80, 50, dark);
    scene.fog.far = blizzard ? 70 : lerp(230, 120, dark);
    paintSky(pal.sky0, pal.sky1, dark);
    skyDome.position.set(cx, 0, 0);
    const prog = clamp(G.seasonT / seasonLen(), 0, 1);
    sunObj.position.set(cx + lerp(-70, 70, prog), 52 + Math.sin(prog * Math.PI) * 26 - (s === 3 ? 12 : 0), -230);
    setCol(M.sun, pal.sun);
    for (const c of clouds) {
      const x = (((c.x + G.t * 0.6 - cx * 0.4) % 300) + 300) % 300 + cx - 150;
      c.obj.position.set(x, c.y, c.z);
    }
    M.cloud.color.setRGB(pal.cloud[0] / 255, pal.cloud[1] / 255, pal.cloud[2] / 255);
    M.cloud.emissive.setScalar(0.35 * (1 - dark));

    // palette-driven materials
    setCol(M.grass, pal.grass); setCol(M.soil, pal.ground); setCol(M.soilDark, shade(pal.ground, 0.7));
    setCol(M.far, mixc(pal.far, [255, 255, 255], s === 3 ? 0.35 * k : 0)); setCol(M.mid, pal.mid); setCol(M.near, mixc(pal.mid, pal.grass, 0.35));
    setCol(M.leaf[0], pal.leaf); setCol(M.leaf[1], pal.leaf2); setCol(M.leaf[2], s === 0 ? pal.leaf : pal.leaf3);
    setCol(M.bush, pal.bush); setCol(M.water, pal.water); setCol(M.tuft, shade(pal.grass, 0.78));
    M.berry.color.set(cbm ? 0x2f6fe0 : 0xd8344a);
    M.hawkRing.color.set(cbm ? 0xff8c00 : 0xd23a2a);

    // seasonal props
    for (const pn of pines) for (const c of pn.caps) c.visible = s === 3;
    for (const t of tufts) t.visible = s !== 3;
    den.snow.visible = s === 3; den.flame.visible = s === 3;
    den.flame.scale.setScalar(0.9 + Math.sin(G.t * 17) * 0.1);
    const wsurf = waterSurface();
    stream.water.visible = wsurf !== null || s === 3;
    const top = s === 3 ? -0.2 : wsurf !== null ? wy(wsurf) + Math.sin(G.t * 2) * 0.03 : -stream.depth;
    const h = Math.max(0.01, top + stream.depth);
    stream.water.scale.y = h; stream.water.position.y = -stream.depth + h / 2;
    stream.ice.visible = s === 3;

    // bushes & trees
    if (!bushObjs.length) bushObjs = G.bushes.map(buildBush);
    G.bushes.forEach((b, i) => {
      const o = bushObjs[i];
      o.berries.forEach((m, j) => { m.visible = j < b.berries; });
      o.snow.visible = s === 3;
    });
    const live = new Set(G.trees);
    for (const [t, o] of treeMap) if (!live.has(t)) { scene.remove(o.g); treeMap.delete(t); }
    const gust = s === 2 && G.gust.dur > 0;
    for (const t of G.trees) {
      let o = treeMap.get(t);
      if (!o) { o = buildTree(t); treeMap.set(t, o); }
      const g = t.growth, sap = !t.mature && g < 0.5;
      o.sap.visible = sap; o.full.visible = !sap;
      if (sap) { o.sap.scale.setScalar(0.7 + g * 2.6); o.sap.rotation.z = Math.sin(G.t * 2 + t.sway) * 0.06; continue; }
      o.full.scale.setScalar(g);
      o.full.rotation.z = Math.sin(G.t * (gust ? 4 : 1.2) + t.sway) * (gust ? 0.025 : 0.01) - (gust ? G.gust.dir * 0.03 : 0);
      let thin = 1;
      if (s === 2) thin = 1 - 0.3 * prog;
      if (s === 3) thin = Math.max(0, 1 - G.seasonT * 1.2);
      o.canopy.visible = thin > 0.02;
      o.canopy.scale.setScalar(Math.max(0.02, thin));
      o.branches.visible = s === 3 || thin < 0.9;
      for (const b of o.snowBits) b.visible = s === 3;
      o.blossoms.visible = s === 0 && t.mature;
      o.fruit.visible = s === 2 && t.mature;
    }

    // player
    syncSquirrel(dt);

    beginPools();
    // caches (hidden by snow in winter unless sniffed)
    const sniffA = G.sniffT > 0 ? Math.min(1, G.sniffT / 0.8) : 0;
    for (const c of G.caches) {
      const near = Math.abs(c.x - p.x) < 340;
      {
        const m = take(pool('mound', () => {
          const tw = mesh(geo.twig, M.bark); tw.position.set(0.12, 0.35, 0); tw.rotation.z = -0.4;
          return group(mesh(geo.mound, M.mound, true, true), tw);
        }));
        m.position.set(wx(c.x), s === 3 ? 0.05 : 0, PLAY_Z - 0.2);
        m.scale.set(0.9 + Math.min(c.n, 6) * 0.12, 1, 1);
        m.children[0].material = s === 3 ? M.snow : M.mound;
        if (s === 3) { // an acorn pokes out of the snow so you can always find your food
          const a = take(pool('acorn', acornMesh));
          a.position.set(wx(c.x), 0.45 + Math.abs(Math.sin(G.t * 3 + c.x)) * 0.15, PLAY_Z + 0.3); a.rotation.set(0, 0, 0.3); a.scale.setScalar(1.4);
        }
      }
      if (sniffA > 0 && near) {
        const r = take(pool('ring', () => { const o = mesh(new THREE.TorusGeometry(0.85, 0.07, 4, 12), M.ring, false); o.rotation.x = -Math.PI / 2; return o; }));
        r.position.set(wx(c.x), 0.12, PLAY_Z - 0.2); r.scale.setScalar(1 + Math.sin(G.t * 8) * 0.1);
      }
    }
    M.ring.opacity = 0.9 * sniffA;
    // items
    for (const it of G.items) {
      if (it.type === 'acorn') {
        const a = take(pool('acorn', acornMesh));
        a.position.set(wx(it.x), wy(it.y) - 0.05, PLAY_Z + 0.2); a.rotation.set(0, 0, -it.rot);
        a.scale.setScalar(1.5);
      } else {
        const m = take(pool('mush', () => {
          const g = group(mesh(geo.mushStem, M.mushStem), mesh(geo.mushCap, M.mushCap));
          g.children[0].position.y = 0.17; g.children[1].position.y = 0.42;
          for (let i = 0; i < 3; i++) { const d = mesh(geo.dot, M.white, false); d.position.set(Math.cos(i * 2.1) * 0.18, 0.47, Math.sin(i * 2.1) * 0.18 + 0.05); g.add(d); }
          return g;
        }));
        m.position.set(wx(it.x), 0, PLAY_Z + 0.4); m.scale.setScalar(0.4 + 0.8 * it.grow);
      }
    }
    endPools();

    // hawk
    const hk = G.hawk;
    hawkObj.root.visible = !!hk;
    hawkMark.visible = !!hk && hk.ph !== 'leave';
    if (hk) {
      const dive = hk.ph === 'dive';
      hawkObj.root.position.set(wx(hk.x), SKY_Y(hk.y), dive ? PLAY_Z : -1);
      hawkObj.root.rotation.set(0, hk.face > 0 ? -0.25 : Math.PI + 0.25, dive ? -0.9 : 0.05 * Math.sin(G.t * 3));
      const flap = dive ? 0.5 : Math.sin(G.t * 7) * 0.6;
      for (const w of hawkObj.wings) w.pivot.rotation.x = -w.s * flap;
      const mx = dive ? hk.tx : hk.sx;
      const kk = dive ? Math.min(1, hk.t / 0.5) : 0.3 + 0.1 * Math.sin(G.t * 8);
      hawkMark.position.set(wx(mx), 0.04, PLAY_Z);
      hawkMark.userData.sh.scale.setScalar(1.2 + 1.2 * kk);
      M.hawkShadow.opacity = 0.2 + 0.35 * kk;
      hawkMark.userData.ring.rotation.z = G.t * 2;
    }
    // jay
    const j = G.jay;
    jayObj.root.visible = !!j;
    if (j) {
      const flying = j.ph !== 'dig';
      jayObj.root.position.set(wx(j.x), flying ? SKY_Y(j.y) : 0, PLAY_Z);
      jayObj.root.rotation.y = j.face > 0 ? -0.3 : Math.PI + 0.3;
      jayObj.pose.rotation.z = flying ? 0 : -0.35 + Math.abs(Math.sin(G.t * 14)) * 0.35;
      for (const w of jayObj.wings) w.pivot.rotation.x = flying ? -w.s * Math.sin(G.t * 24) * 0.9 : -w.s * 0.1;
    }
    // geese
    geeseObj.visible = !!G.geese;
    if (G.geese) {
      geeseObj.position.set(cx + (G.geese.x - W / 2) * U * 1.6, 15, -12);
      geeseObj.children.forEach((b, i) => { b.children[0].rotation.z = 0.35 + Math.sin(G.t * 6 + i) * 0.3; b.children[1].rotation.z = -0.35 - Math.sin(G.t * 6 + i) * 0.3; });
    }
    // tutorial marker
    const tm = G.tutorial && G.tutorial.markX != null ? G.tutorial.markX : null;
    tutMark.visible = tm !== null && !G.attract;
    if (tm !== null) {
      tutMark.position.set(wx(tm), 0.05, PLAY_Z);
      tutMark.userData.cone.position.y = 2.8 + Math.abs(Math.sin(G.t * 3)) * 0.6;
      tutMark.userData.cone.rotation.y = G.t * 2;
      tutMark.userData.disc.scale.setScalar(1 + Math.sin(G.t * 4) * 0.1);
    }
    syncParticles();
    adapt(dt);
    renderer.render(scene, camera);
  }

  function syncSquirrel(dt) {
    const p = G.player, sq = squirrel;
    sq.root.visible = !(p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0);
    sq.root.position.set(wx(p.x), wy(p.y) - (p.deep ? 0.55 : 0), PLAY_Z);
    const targetYaw = p.face > 0 ? -0.35 : -(Math.PI - 0.35); // turn through the camera side, never show the back
    sq.yaw = lerp(sq.yaw, targetYaw, 1 - Math.exp(-14 * dt));
    sq.turn.rotation.y = sq.yaw;
    const run = Math.abs(p.vx) > 30 && p.onGround;
    const t = G.t;
    const bob = run ? Math.abs(Math.sin(t * 16)) * 0.12 : Math.sin(t * 3) * 0.02;
    sq.pose.position.y = bob;
    let tilt = 0;
    if (p.digT > 0) tilt = -0.45;
    else if (!p.onGround && !p.deep) tilt = clamp(-p.vy * 0.0006, -0.35, 0.35);
    sq.pose.rotation.z = lerp(sq.pose.rotation.z, tilt, 1 - Math.exp(-18 * dt));
    sq.tail.rotation.z = Math.sin(t * (run ? 14 : 2.5)) * 0.12 + (!p.onGround ? -0.3 : 0);
    const sleep = G.dying > 0;
    sq.pose.scale.set(1, sleep ? 0.75 : 1, 1);
    if (sleep) sq.tail.rotation.z = 0.9;
    sq.legs.forEach((l, i) => {
      const ph = t * 16 + (i % 2) * Math.PI + (i < 2 ? 0 : Math.PI / 2);
      l.m.position.x = l.x + (run ? Math.sin(ph) * 0.14 : 0);
      l.m.position.y = l.y + (run ? Math.max(0, Math.cos(ph)) * 0.08 : 0);
    });
    const ch = p.carry + (p.eatT > 0 ? Math.sin(t * 30) * 0.4 : 0);
    for (const c of sq.cheeks) c.scale.setScalar(0.5 + ch * 0.45);
    for (const e of sq.eyes) e.scale.y = sleep ? 0.2 : 1;
    sq.snowHat.visible = G.season === 3 && p.warmth < 40;
    sq.head.rotation.z = p.digT > 0 ? -0.3 : 0;
  }

  const WEATHER = { rain: 1, snow: 1, leaf: 1, petal: 1, pollen: 1 };
  function syncParticles() {
    const ps = G.parts, n = Math.min(ps.length, 600);
    for (let i = 0; i < n; i++) {
      const q = ps[i];
      if (q.z === undefined) q.z = WEATHER[q.kind] ? rand(-10, 5) : PLAY_Z + 0.4;
      const a = clamp(q.life / q.max * 2, 0, 1);
      let sx = 0.08, sy = 0.08, sz = 0.08;
      switch (q.kind) {
        case 'rain': sx = 0.02; sy = 0.42; sz = 0.02; break;
        case 'snow': sx = sy = sz = 0.035 * q.size; break;
        case 'leaf': case 'petal': sx = q.size * 0.035; sy = q.size * 0.012; sz = q.size * 0.03; break;
        case 'pollen': sx = sy = sz = 0.04 * a; break;
        case 'scent': sx = sy = sz = 0.09 * a; break;
        case 'spark': sx = sy = sz = 0.07 * q.size / 3 * a; break;
        case 'feather': sx = 0.14; sy = 0.03; sz = 0.07; break;
        default: sx = sy = sz = q.size * 0.022 * (0.4 + 0.6 * a);
      }
      tmpE.set(q.kind === 'rain' ? 0 : q.rot, q.kind === 'rain' ? 0 : q.rot * 0.7, q.kind === 'rain' ? 0.1 : q.rot * 0.3);
      tmpQ.setFromEuler(tmpE);
      tmpV.set(wx(q.x), wy(q.y), q.z);
      tmpS.set(sx, sy, sz);
      tmpM.compose(tmpV, tmpQ, tmpS);
      partMesh.setMatrixAt(i, tmpM);
      partMesh.setColorAt(i, cssColor(q.col));
    }
    partMesh.count = n;
    partMesh.instanceMatrix.needsUpdate = true;
    if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  }

  // project a simulation point to HUD (960x540) coordinates
  const projV = new THREE.Vector3();
  function toScreen(x, y, z = PLAY_Z) {
    projV.set(wx(x), wy(y), z).project(camera);
    return { x: (projV.x + 1) / 2 * W, y: (1 - projV.y) / 2 * H, behind: projV.z > 1 };
  }

  return { init, resize, sync, toScreen, get ready() { return !!renderer; } };
})();
