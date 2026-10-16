'use strict';
// ---------------------------------------------------------------------------
// FORGOTTEN ACORNS - simulation.
// Core idea: every acorn you bury and never dig back up becomes a tree.
// Bury in Fall, find them again under the Winter snow (you'll be hungry and
// cold), and whatever you forget sprouts in Spring into the forest that will
// feed - and shelter - you next year.
// Coordinates are in "pixels" of a 960x540 side view: x grows right, y grows
// down, the ground is at y = GROUND. world3d.js turns this into a 3D diorama.
// ---------------------------------------------------------------------------
const DIFFS = {
  easy: { hunger: 0.7, season: 48, hawk: 1.5, jay: 1.5, drop: 0.8, cold: 0.7, startHunger: 90 },
  normal: { hunger: 1.2, season: 40, hawk: 1.0, jay: 0.9, drop: 1.0, cold: 1.15, startHunger: 80 },
  hard: { hunger: 1.6, season: 34, hawk: 0.7, jay: 0.6, drop: 1.25, cold: 1.6, startHunger: 70 },
};
const GOAL_WINTERS = 3;
const MAX_CARRY = 3;
const ACORN_FOOD = 24, BERRY_FOOD = 8, MUSHROOM_FOOD = 12;

let state = 'title'; // title | playing | paused | over
let G = null;
const cb = () => Settings.data.colorblind;
const calm = () => Settings.data.reduceMotion;

// ======================= world setup =======================
function makeTree(x, growth, mature) {
  const blobs = []; const n = 6 + (Math.random() * 3 | 0);
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + rand(-0.2, 0.2);
    blobs.push({ dx: Math.cos(a) * rand(24, 42), dy: Math.sin(a) * rand(12, 24) - 4, r: rand(24, 32), k: i % 3 });
  }
  blobs.push({ dx: 0, dy: -8, r: 36, k: 0 });
  const branches = [];
  for (let i = 0; i < 5; i++) branches.push({ a: -Math.PI / 2 + (i - 2) * 0.5 + rand(-0.2, 0.2), l: rand(40, 62) });
  return { x, growth, mature, blobs, branches, dropT: rand(0.5, 3), sway: rand(0, 6.28), born: 0 };
}

function newGame(attract, tutorial) {
  const d = DIFFS[Settings.data.difficulty] || DIFFS.normal;
  const trees = [350, 900, 1450, 1880, 2560, 2980].map(x => makeTree(x, 1, true));
  const bushes = [170, 760, 1180, 1650, 2040, 2460, 2780, 3090].map((x, i) => ({ x, berries: 0, t: rand(1, 5), seed: i }));
  const clouds = []; for (let i = 0; i < 10; i++) clouds.push({ x: i * 380 + rand(0, 200), y: rand(40, 150), s: rand(0.7, 1.4) });
  G = {
    attract: !!attract, d, t: 0, season: 2, seasonT: 0, year: 1, winters: 0, endless: false,
    player: {
      x: 470, y: GROUND, vx: 0, vy: 0, face: 1, onGround: true, coyote: 0, carry: 0,
      hunger: d.startHunger, warmth: 100, inv: 0, digT: 0, eatT: 0, paddleT: 0, berryCd: 0,
      inDen: false, inWater: false, deep: false, startX: 470, shaded: false,
    },
    trees, bushes, clouds, caches: [], items: [], parts: [], floaters: [],
    hawk: null, hawkT: rand(5, 8), jay: null, jayT: 12, gust: { t: 4, dur: 0, dir: 1, str: 0 }, bliz: { t: 9, dur: 0, dir: -1 },
    sniffT: 0, sniffCd: 0, shake: 0, camX: 0, visR: 230, banner: { t: 0, season: 2 }, geese: null, warned: false,
    tutorial: null, mushT: 4, dying: 0, deathReason: '', winPending: 0, firstAcorn: false,
    stats: { dug: 0, buried: 0, eaten: 0, sprouted: 0, stolen: 0, scared: 0, dodged: 0, hits: 0, berries: 0 },
    tut: { jumped: false, moved: false, buried: false, ate: false, sniffed: false, hawk: false },
  };
  G.camX = clamp(G.player.x - W / 2, 0, WORLD_W - W);
  if (attract) { G.player.x = 600 + 140; G.camX = 330; G.seasonT = 2.5; }
  if (tutorial) { G.tutorial = { step: -1, t: 0, done: false }; G.firstAcorn = true; G.player.x = 420; G.player.startX = 420; G.camX = clamp(420 - W / 2, 0, WORLD_W - W); }
}

const seasonLen = () => G.attract ? 5 : (G.season === 3 ? G.d.season * (1 + 0.12 * (G.year - 1)) : G.d.season);
const inStream = x => x > STREAM_X0 && x < STREAM_X1;
const groundAt = x => (inStream(x) && G.season !== 3 ? STREAM_BED : GROUND);
const waterSurface = () => (G.season === 0 ? GROUND + 6 : G.season === 2 ? GROUND + 34 : null);

function isSheltered(x) {
  if (Math.abs(x - DEN_X) < 34) return true;
  if (G.season === 3) return false;
  for (const t of G.trees) if (t.growth > 0.55 && Math.abs(x - t.x) < 60 * t.growth) return true;
  return false;
}
function canPlant(x) {
  if (x < 70 || x > WORLD_W - 70) return false;
  if (x > STREAM_X0 - 40 && x < STREAM_X1 + 40) return false;
  if (Math.abs(x - DEN_X) < 75) return false;
  if (G.trees.length >= 30) return false;
  return G.trees.every(t => Math.abs(t.x - x) >= 100);
}
function nearestCache(x, r) {
  let best = null, bd = r;
  for (const c of G.caches) { const d = Math.abs(c.x - x); if (d <= bd) { bd = d; best = c; } }
  return best;
}

// ======================= particles & floaters =======================
function part(o) { if (G.parts.length < 520) G.parts.push(o); }
function puff(x, y, n, kind, col, spd = 120, up = 1) {
  if (calm()) n = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    part({ x, y, vx: Math.cos(a) * rand(0.3, 1) * spd, vy: -Math.abs(Math.sin(a)) * rand(0.4, 1) * spd * up, life: rand(0.5, 1.1), max: 1.1, kind, col, size: rand(2, 4.5), rot: rand(0, 6), vr: rand(-6, 6) });
  }
}
function floater(x, y, text, col, icon) { G.floaters.push({ x, y, text, col: col || '#fff', icon, t: 0 }); }

// ======================= season flow =======================
function advanceSeason() {
  const p = G.player;
  G.season = (G.season + 1) % 4; G.seasonT = 0;
  G.banner = { t: 0, season: G.season };
  const s = G.season;
  if (G.attract) { Sound.setSeason(s); return; }
  if (s === 0) { // ---- Winter -> Spring: forgotten caches sprout ----
    G.winters++;
    let sprouted = 0;
    for (const c of G.caches.slice().sort((a, b) => b.n - a.n)) {
      if (canPlant(c.x)) {
        G.trees.push(makeTree(c.x, 0.2, false));
        sprouted++; G.stats.sprouted++;
        puff(c.x, GROUND - 10, 16, 'spark', '#c9ff7a', 140);
        floater(c.x, GROUND - 40, '+1', '#e9ffd0', 'sapling');
      } else puff(c.x, GROUND - 6, 6, 'dirt', '#6e4a2c', 80);
    }
    G.caches = [];
    G.trees.sort((a, b) => a.x - b.x);
    if (sprouted) Sound.play('sprout');
    for (const b of G.bushes) b.berries = 1;
    if (G.winters >= GOAL_WINTERS && !G.endless) G.winPending = 4.5;
  }
  if (s === 1) G.items = G.items.filter(i => i.type !== 'mush');
  if (s === 2) {
    G.year++; G.warned = false;
    for (const t of G.trees) if (!t.mature) { t.mature = true; t.growth = 1; }
    if (G.hawk) G.hawk.ph = 'leave';
  }
  if (s === 3) { // ---- Fall -> Winter: first snow buries everything on the ground ----
    for (const it of G.items) puff(it.x, it.y, 3, 'snow', '#ffffff', 60);
    G.items = [];
    if (G.jay) G.jay.ph = 'leave';
    for (const b of G.bushes) b.berries = 0;
    G.hawk = null;
    p.warmth = Math.max(p.warmth, 100);
  }
  Sound.setSeason(s); Sound.play('season', s);
}

// ======================= update =======================
function update(dt) {
  G.t += dt;
  if (G.attract) { attractUpdate(dt); return; }
  G.shake = Math.max(0, G.shake - dt * 30);
  if (G.dying > 0) {
    G.dying -= dt; updateParticles(dt);
    if (G.dying <= 0) endGame(false);
    return;
  }
  if (G.tutorial) {
    G.seasonT = Math.min(G.seasonT + dt, seasonLen() - 3.5);
    Tutorial.update(dt);
  } else {
    G.seasonT += dt;
    if (G.seasonT >= seasonLen()) advanceSeason();
  }
  G.banner.t += dt;
  updatePlayer(dt);
  updateWorld(dt);
  updateHawk(dt);
  updateJay(dt);
  updateWeather(dt);
  updateParticles(dt);
  updateCamera(dt);
  const p = G.player;
  if (G.tutorial) p.hunger = Math.max(p.hunger, 15);
  if (G.winPending > 0) { G.winPending -= dt; if (G.winPending <= 0) endGame(true); }
  else if (p.hunger <= 0) {
    p.hunger = 0; G.dying = 1.8;
    G.deathReason = G.season === 3 && p.warmth <= 0 ? 'froze' : 'starved';
    Sound.play('lose');
  }
}

function attractUpdate(dt) {
  G.seasonT += dt; G.banner.t += dt;
  if (G.seasonT >= seasonLen()) advanceSeason();
  const tr = G.trees;
  if (G.season === 0) for (const t of tr) t.growth = Math.min(1, t.growth);
  updateWeather(dt); updateParticles(dt);
}

function updatePlayer(dt) {
  const p = G.player, s = G.season, winter = s === 3;
  const streamHere = inStream(p.x);
  const ice = winter && streamHere;
  const wy = waterSurface();
  p.inWater = streamHere && wy !== null && p.y > wy + 4;
  p.deep = p.inWater && s === 0;
  p.inDen = Math.abs(p.x - DEN_X) < 30 && p.onGround;
  p.shaded = isSheltered(p.x);

  let dir = (Input.held('right') ? 1 : 0) - (Input.held('left') ? 1 : 0);
  if (p.digT > 0) dir = 0;
  if (dir) p.face = dir;
  if (dir && !G.tut.moved && Math.abs(p.x - p.startX) > 50) G.tut.moved = true;

  let speed = 250;
  if (winter && !ice) speed *= 0.72;           // wading through snow
  if (winter && G.bliz.dur > 0) speed *= 0.85;
  if (p.inWater) speed *= p.deep ? 0.45 : 0.6; // spring flood / fall shallows
  let target = dir * speed;
  if (!p.inDen) {
    if (s === 2 && G.gust.dur > 0) target += G.gust.dir * G.gust.str;
    if (winter && G.bliz.dur > 0) target += G.bliz.dir * 85;
  }
  let accel = p.onGround ? (ice ? 330 : 2000) : 1100;
  if (p.deep) accel = 650;
  p.vx = approach(p.vx, target, accel * dt);

  // jumping / paddling
  p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
  p.paddleT -= dt;
  if (Input.hit('jump') && p.digT <= 0) {
    if (p.deep) {
      if (p.paddleT <= 0) { p.vy = -430; p.paddleT = 0.32; Sound.play('splash'); puff(p.x, wy, 6, 'drop', '#bfe6ff', 120); }
    } else if (p.coyote > 0) {
      p.vy = winter && !ice ? -570 : -640; p.onGround = false; p.coyote = 0; G.tut.jumped = true; Sound.play('jump');
    }
  }
  if (!Input.held('jump') && p.vy < -150 && !p.deep) p.vy += 2600 * dt;

  let g = 1900;
  if (p.deep) {
    g = 500;
    if (p.y > wy + 10) p.vy -= 1500 * dt;
    p.vy *= 1 - 2.5 * dt;
  }
  p.vy += g * dt;
  const oldX = p.x, oldY = p.y;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, 16, WORLD_W - 16);

  // stream banks act as walls while you are down in the stream bed
  if (G.season !== 3 && inStream(oldX) && oldY > GROUND + 1) {
    if (p.x < STREAM_X0 + 8) { p.x = STREAM_X0 + 8; p.vx = 0; }
    if (p.x > STREAM_X1 - 8) { p.x = STREAM_X1 - 8; p.vx = 0; }
  }
  const gy = groundAt(p.x);
  const wasAir = !p.onGround;
  if (p.y >= gy) {
    p.y = gy;
    if (p.vy > 0) { if (wasAir && p.vy > 400) Sound.play('land'); p.vy = 0; }
    p.onGround = true;
  } else p.onGround = false;
  if (p.inWater && oldY <= wy && p.y > wy && p.vy > 200) { Sound.play('splash'); puff(p.x, wy, 8, 'drop', '#bfe6ff', 150); }

  // ---- actions ----
  p.digT = Math.max(0, p.digT - dt);
  p.eatT = Math.max(0, p.eatT - dt);
  p.inv = Math.max(0, p.inv - dt);
  p.berryCd = Math.max(0, p.berryCd - dt);
  G.sniffCd = Math.max(0, G.sniffCd - dt);
  G.sniffT = Math.max(0, G.sniffT - dt);

  if (Input.hit('dig') && p.onGround && p.digT <= 0) {
    const c = nearestCache(p.x, 26);
    const soil = winter ? '#ffffff' : '#6e4a2c';
    if (winter) {               // frozen ground: you can only dig up, not bury
      if (c && p.carry < MAX_CARRY) digUp(c);
      else { Sound.play('scrabble'); puff(p.x + p.face * 10, GROUND - 2, 6, 'snow', '#ffffff', 90); p.digT = 0.2; }
    } else if (streamHere) {
      Sound.play('nope');
    } else if (p.carry > 0) {
      bury();
    } else if (c) {
      digUp(c);
    } else { Sound.play('scrabble'); puff(p.x + p.face * 10, GROUND - 2, 5, 'dirt', soil, 80); p.digT = 0.15; }
  }
  if (Input.hit('eat')) {
    if (p.carry > 0 && p.hunger < 99) {
      p.carry--; p.hunger = Math.min(100, p.hunger + ACORN_FOOD); p.eatT = 0.45;
      G.stats.eaten++; G.tut.ate = true; Sound.play('eat');
      puff(p.x + p.face * 18, p.y - 18, 5, 'crumb', '#c98a3f', 60);
      floater(p.x, p.y - 50, '+' + ACORN_FOOD, '#ffe7b0');
    } else Sound.play('nope');
  }
  if (Input.hit('sniff')) {
    if (G.sniffCd <= 0) {
      G.sniffT = 3.5; G.sniffCd = 4; p.hunger -= 1; G.tut.sniffed = true; Sound.play('sniff');
      for (const c of G.caches) if (Math.abs(c.x - p.x) < 340) for (let i = 0; i < 4; i++) part({ x: c.x + rand(-8, 8), y: GROUND - rand(0, 10), vx: rand(-10, 10), vy: rand(-50, -30), life: rand(1.5, 3), max: 3, kind: 'scent', col: '#c79bff', size: rand(3, 5), rot: rand(0, 6), vr: 0 });
    } else Sound.play('nope');
  }

  // ---- needs ----
  let m = G.d.hunger;
  if (s === 1 && !p.shaded) m *= 1.5;              // summer sun
  if (winter) m *= 1.35 + 0.15 * (G.year - 1);      // winters get harsher
  if (p.warmth <= 0) m *= 2.4;                      // freezing
  if (p.inWater) m *= 1.4;
  p.hunger -= m * dt;
  if (winter) {
    if (p.inDen) p.warmth = Math.min(100, p.warmth + 24 * dt);
    else p.warmth = Math.max(0, p.warmth - 2.7 * G.d.cold * (G.bliz.dur > 0 ? 1.5 : 1) * dt);
  } else p.warmth = Math.min(100, p.warmth + 30 * dt);
  p.hunger = Math.min(100, p.hunger);
}

function bury() {
  const p = G.player;
  let c = nearestCache(p.x, 24);
  if (c) c.n++; else { c = { x: p.x, n: 1, t: 0 }; G.caches.push(c); }
  c.t = 0;
  p.carry--; p.digT = 0.28;
  G.stats.buried++; G.tut.buried = true;
  Sound.play('bury');
  puff(p.x + p.face * 6, GROUND - 2, 8, 'dirt', '#6e4a2c', 90);
}
function digUp(c) {
  const p = G.player;
  c.n--; p.carry++; p.digT = 0.3; G.stats.dug++;
  if (c.n <= 0) G.caches.splice(G.caches.indexOf(c), 1);
  Sound.play('dig');
  puff(c.x, GROUND - 2, 10, G.season === 3 ? 'snow' : 'dirt', G.season === 3 ? '#ffffff' : '#6e4a2c', 110);
  floater(c.x, GROUND - 45, '', '#fff', 'acorn');
}

function spawnAcorn(x, y) {
  if (G.items.filter(i => i.type === 'acorn').length >= 45) return;
  G.items.push({ type: 'acorn', x, y, vx: rand(-20, 20), vy: 0, landed: false, rot: rand(-0.5, 0.5) });
}

function updateWorld(dt) {
  const p = G.player, s = G.season, L = seasonLen();
  // the very first acorn falls right in front of you (wordless tutorial)
  if (!G.firstAcorn && G.t > 0.8) { G.firstAcorn = true; spawnAcorn(p.x + 90, GROUND - 170); }

  // ---- trees: saplings grow through spring & summer, oaks drop acorns in fall ----
  for (const t of G.trees) {
    if (!t.mature && (s === 0 || s === 1)) t.growth = Math.min(1, t.growth + dt * 0.8 / (2 * L));
    if (s === 2 && t.mature && !G.tutorial) {
      t.dropT -= dt;
      if (t.dropT <= 0) { t.dropT = rand(3.2, 5.6) / G.d.drop; spawnAcorn(t.x + rand(-45, 45), GROUND - 140 + rand(-20, 15)); }
    }
  }
  // ---- bushes ----
  for (const b of G.bushes) {
    const every = s === 0 ? 15 : s === 1 ? 8 : s === 2 ? 24 : 0;
    if (!every) continue;
    b.t -= dt;
    if (b.t <= 0) { b.t = every * rand(0.8, 1.2); if (b.berries < 3) b.berries++; }
    if (Math.abs(p.x - b.x) < 34 && b.berries > 0 && p.hunger < 97 && p.berryCd <= 0 && p.y > GROUND - 50) {
      b.berries--; p.hunger = Math.min(100, p.hunger + BERRY_FOOD); p.berryCd = 0.35; G.stats.berries++;
      Sound.play('berry'); puff(b.x, GROUND - 26, 5, 'crumb', cb() ? '#2f6fe0' : '#d8344a', 70);
      floater(b.x, GROUND - 60, '+' + BERRY_FOOD, '#ffd0d6');
    }
  }
  // ---- spring mushrooms after the rain ----
  if (s === 0) {
    G.mushT -= dt;
    if (G.mushT <= 0) {
      G.mushT = rand(4, 7);
      if (G.items.filter(i => i.type === 'mush').length < 4) {
        const t = G.trees[Math.random() * G.trees.length | 0];
        const x = clamp(t.x + rand(-60, 60), 30, WORLD_W - 30);
        if (!inStream(x)) G.items.push({ type: 'mush', x, y: GROUND, life: 16, landed: true, grow: 0 });
      }
    }
  }
  // ---- items ----
  for (let i = G.items.length - 1; i >= 0; i--) {
    const it = G.items[i];
    if (it.type === 'acorn') {
      if (!it.landed) {
        it.vy += 1200 * dt;
        if (s === 2 && G.gust.dur > 0) it.vx = approach(it.vx, G.gust.dir * 120, 300 * dt);
        it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vx * 0.01 * dt;
        it.x = clamp(it.x, 10, WORLD_W - 10);
        const wy = waterSurface();
        if (inStream(it.x) && wy !== null && it.y > wy) { puff(it.x, wy, 5, 'drop', '#bfe6ff', 90); G.items.splice(i, 1); continue; }
        const gy = groundAt(it.x) - 5;
        if (it.y >= gy) {
          it.y = gy;
          if (it.vy > 250) { it.vy *= -0.3; it.vx *= 0.5; } else { it.landed = true; it.vy = 0; it.vx = 0; }
        }
      }
      if (p.carry < MAX_CARRY && Math.abs(it.x - p.x) < 22 && Math.abs(it.y - (p.y - 12)) < 30) {
        p.carry++; G.items.splice(i, 1); Sound.play('pickup');
        puff(it.x, it.y, 5, 'spark', '#ffe9a8', 70);
        continue;
      }
    } else if (it.type === 'mush') {
      it.life -= dt; it.grow = Math.min(1, it.grow + dt * 2);
      if (it.life <= 0) { G.items.splice(i, 1); continue; }
      if (Math.abs(it.x - p.x) < 20 && p.y > GROUND - 40 && p.hunger < 97) {
        p.hunger = Math.min(100, p.hunger + MUSHROOM_FOOD); Sound.play('berry');
        puff(it.x, it.y - 6, 6, 'crumb', '#c8553d', 70); floater(it.x, it.y - 40, '+' + MUSHROOM_FOOD, '#ffd8c8');
        G.items.splice(i, 1);
      }
    }
  }
  for (const c of G.caches) c.t += dt;
  // ---- floaters ----
  for (let i = G.floaters.length - 1; i >= 0; i--) { const f = G.floaters[i]; f.t += dt; if (f.t > 1.3) G.floaters.splice(i, 1); }
  // ---- geese warn that winter is coming ----
  if (s === 2 && !G.warned && !G.tutorial && L - G.seasonT < 7) {
    G.warned = true; G.geese = { x: W + 40, t: 0 }; Sound.play('geese');
  }
  if (G.geese) { G.geese.t += dt; G.geese.x -= 140 * dt; if (G.geese.x < -300) G.geese = null; }
}

// ---- Spring/Summer: hawks hunt from above. Hide under leaves or in the den. ----
function updateHawk(dt) {
  const p = G.player, s = G.season;
  if (!G.hawk && (s === 0 || s === 1) && !G.tutorial) {
    G.hawkT -= dt;
    if (G.hawkT <= 0 && G.seasonT > 3) spawnHawk();
  }
  const h = G.hawk; if (!h) return;
  h.t += dt;
  if (h.ph === 'circle') {
    h.sx = lerp(h.sx, p.x, 1 - Math.exp(-2.1 * dt));
    const tx = h.sx + Math.cos(h.t * 2.6) * 70, ty = 70 + Math.sin(h.t * 2.6) * 18;
    h.face = Math.sin(h.t * 2.6) < 0 ? 1 : -1;
    h.x = lerp(h.x, tx, 1 - Math.exp(-4 * dt)); h.y = lerp(h.y, ty, 1 - Math.exp(-4 * dt));
    if (h.t > 2.7) { h.ph = 'dive'; h.t = 0; h.tx = h.sx; h.x0 = h.x; h.y0 = h.y; h.face = h.tx > h.x ? 1 : -1; Sound.play('screech'); }
  } else if (h.ph === 'dive') {
    const k = Math.min(1, h.t / 0.5), e = k * k;
    h.x = lerp(h.x0, h.tx, e); h.y = lerp(h.y0, GROUND - 18, e);
    if (k >= 1) {
      const hit = Math.abs(p.x - h.tx) < 44 && p.y > GROUND - 70 && !p.shaded && p.inv <= 0;
      if (hit) hurtPlayer(h.tx);
      else { if (Math.abs(p.x - h.tx) < 160) G.stats.dodged++; G.tut.hawk = true; }
      puff(h.tx, GROUND - 6, 8, p.shaded && !hit ? 'leaf' : 'dirt', '#7a5631', 120);
      h.ph = 'leave'; h.t = 0;
    }
  } else if (h.ph === 'leave') {
    h.x += h.face * 340 * dt; h.y -= 260 * dt;
    if (h.t > 1.6) { G.hawk = null; G.hawkT = (s === 1 ? rand(7, 11) : rand(12, 18)) * G.d.hawk; }
  }
}

function spawnHawk() {
  const p = G.player;
  G.hawk = { ph: 'circle', t: 0, sx: p.x + rand(-160, 160), x: p.x - 300, y: 60, face: 1 };
  Sound.play('hawkCall');
}
function spawnJay(target) {
  const side = Math.random() < 0.5 ? -1 : 1;
  G.jay = { ph: 'fly', t: 0, x: target.x + side * 560, y: 60, target, face: -side };
  Sound.play('jay');
}

function hurtPlayer(fromX) {
  const p = G.player;
  for (let i = 0; i < p.carry; i++) G.items.push({ type: 'acorn', x: p.x, y: p.y - 20, vx: rand(-160, 160), vy: rand(-380, -220), landed: false, rot: 0 });
  p.carry = 0; p.hunger -= 12; p.inv = 1.6;
  p.vx = (p.x >= fromX ? 1 : -1) * 320; p.vy = -320; p.onGround = false;
  G.shake = 10; G.stats.hits++;
  Sound.play('hit'); puff(p.x, p.y - 15, 12, 'feather', '#efe4cf', 160);
  floater(p.x, p.y - 55, '-12', '#ffb0a0');
}

// ---- Fall: blue jays raid any cache they can see. Chase them off! ----
function updateJay(dt) {
  const p = G.player;
  if (!G.jay && G.season === 2 && G.caches.length && !G.tutorial) {
    G.jayT -= dt;
    if (G.jayT <= 0) {
      const far = G.caches.filter(c => Math.abs(c.x - p.x) > 200);
      const pool = far.length ? far : G.caches;
      spawnJay(pool[Math.random() * pool.length | 0]);
    }
  }
  const j = G.jay; if (!j) return;
  j.t += dt;
  if ((j.ph === 'fly' || j.ph === 'dig') && !G.caches.includes(j.target)) { j.ph = 'leave'; j.t = 0; }
  if (j.ph === 'fly') {
    const dx = j.target.x - j.x, dy = GROUND - 2 - j.y, d = Math.hypot(dx, dy);
    const sp = 270 * dt;
    if (d <= sp) { j.x = j.target.x; j.y = GROUND - 2; j.ph = 'dig'; j.t = 0; }
    else { j.x += dx / d * sp; j.y += dy / d * sp; j.face = dx > 0 ? 1 : -1; }
  } else if (j.ph === 'dig') {
    if (Math.random() < dt * 12) puff(j.x, GROUND - 2, 1, 'dirt', '#6e4a2c', 70);
    if (j.t > 2.6) {
      const c = j.target; c.n--; if (c.n <= 0) G.caches.splice(G.caches.indexOf(c), 1);
      G.stats.stolen++; j.loot = true; j.ph = 'leave'; j.t = 0; Sound.play('steal');
      floater(j.x, GROUND - 50, '-1', '#a8c8ff', 'acorn');
    }
  } else if (j.ph === 'leave') {
    j.x += j.face * 300 * dt; j.y -= 200 * dt;
    if (j.t > 2.5) { G.jay = null; G.jayT = rand(9, 15) * G.d.jay; }
  }
  if ((j.ph === 'fly' || j.ph === 'dig') && Math.abs(j.x - p.x) < 75 && j.y > GROUND - 130) {
    j.ph = 'leave'; j.t = 0; j.face = j.x > p.x ? 1 : -1;
    G.stats.scared++; Sound.play('scare'); puff(j.x, j.y - 8, 7, 'feather', '#3b86de', 130);
  }
}

function updateWeather(dt) {
  const s = G.season, cx = G.camX;
  const k = calm() ? 0.4 : 1;
  const spawn = (rate, fn) => { let n = rate * dt * k; while (n > 0) { if (Math.random() < n) fn(); n -= 1; } };
  if (s === 2) {
    const gu = G.gust;
    if (gu.dur > 0) gu.dur -= dt;
    gu.t -= dt;
    if (gu.t <= 0 && !G.attract) { gu.dur = rand(1.4, 2.4); gu.dir = Math.random() < 0.5 ? -1 : 1; gu.str = rand(110, 170); gu.t = gu.dur + rand(3, 6); Sound.gust(0.8); }
    spawn(gu.dur > 0 ? 45 : 10, () => part({ x: rand(cx - 60, cx + W + 60), y: rand(-10, 200), vx: (gu.dur > 0 ? gu.dir * 320 : rand(-40, 40)), vy: rand(40, 90), life: 4, max: 4, kind: 'leaf', col: ['#e47a2c', '#d24a2a', '#f2b83a'][Math.random() * 3 | 0], size: rand(4, 6), rot: rand(0, 6), vr: rand(-4, 4) }));
  } else G.gust.dur = 0;
  if (s === 3) {
    const b = G.bliz;
    if (b.dur > 0) b.dur -= dt;
    b.t -= dt;
    if (b.t <= 0 && !G.attract) { b.dur = 3.5; b.dir = Math.random() < 0.5 ? -1 : 1; b.t = b.dur + rand(8, 13); Sound.gust(1.2); }
    spawn(b.dur > 0 ? 170 : 55, () => part({ x: rand(cx - 120, cx + W + 120), y: -8, vx: b.dur > 0 ? b.dir * rand(180, 280) : rand(-30, 30), vy: rand(50, 110), life: 8, max: 8, kind: 'snow', col: '#ffffff', size: rand(1.5, 3.5), rot: rand(0, 6), vr: 0 }));
  } else G.bliz.dur = 0;
  if (s === 0) {
    spawn(110, () => part({ x: rand(cx - 40, cx + W + 80), y: -10, vx: -70, vy: rand(650, 800), life: 2, max: 2, kind: 'rain', col: '#cfe8ff', size: 1, rot: 0, vr: 0 }));
    spawn(3, () => { const t = G.trees[Math.random() * G.trees.length | 0]; if (t.mature) part({ x: t.x + rand(-40, 40), y: GROUND - 140 * t.growth, vx: rand(-30, 30), vy: rand(20, 40), life: 5, max: 5, kind: 'petal', col: '#f6a9c9', size: 3, rot: rand(0, 6), vr: rand(-3, 3) }); });
  }
  if (s === 1) spawn(6, () => part({ x: rand(cx, cx + W), y: rand(200, GROUND), vx: rand(-15, 15), vy: rand(-15, 5), life: 4, max: 4, kind: 'pollen', col: '#fff6b0', size: rand(1.5, 2.5), rot: rand(0, 6), vr: 0 }));
}

function updateParticles(dt) {
  const ps = G.parts;
  for (let i = ps.length - 1; i >= 0; i--) {
    const q = ps[i];
    q.life -= dt;
    q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt;
    switch (q.kind) {
      case 'dirt': case 'crumb': case 'drop': case 'feather': q.vy += (q.kind === 'feather' ? 200 : 700) * dt; if (q.kind === 'feather') q.vx *= 1 - dt * 2; break;
      case 'leaf': case 'petal': q.vx += Math.sin(q.life * 3 + q.rot) * 30 * dt; break;
      case 'spark': q.vy += 60 * dt; q.vx *= 1 - dt * 2; break;
      case 'snow': q.vx += Math.sin(q.life * 2 + q.rot) * 12 * dt; break;
    }
    const gy = groundAt(q.x);
    if (q.life <= 0 || ((q.kind === 'rain' || q.kind === 'snow' || q.kind === 'leaf' || q.kind === 'petal') && q.y > gy - 2) || ((q.kind === 'dirt' || q.kind === 'crumb') && q.y > gy + 2)) {
      if (q.kind === 'rain' && q.life > 0 && Math.random() < 0.15) part({ x: q.x, y: gy - 2, vx: rand(-40, 40), vy: rand(-80, -40), life: 0.25, max: 0.25, kind: 'drop', col: '#cfe8ff', size: 1.5, rot: 0, vr: 0 });
      ps.splice(i, 1);
    }
  }
}

function updateCamera(dt) {
  const p = G.player;
  const tx = clamp(p.x - W / 2 + p.face * 60, 0, WORLD_W - W);
  G.camX = lerp(G.camX, tx, 1 - Math.exp(-4 * dt));
}

// ======================= rendering =======================
function currentPal() {
  const s = G.season, prev = (s + 3) % 4;
  const k = clamp(G.seasonT / (G.attract ? 1.5 : 3), 0, 1);
  return blendPal(PALS[prev], PALS[s], k * k * (3 - 2 * k));
}
