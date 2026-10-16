'use strict';
// ---------------------------------------------------------------------------
// FORGOTTEN ACORNS — a squirrel's year in four seasons.
// Core idea: every acorn you bury and never dig back up becomes a tree.
// Bury in Fall, find them again under the Winter snow (you'll be hungry and
// cold), and whatever you forget sprouts in Spring into the forest that will
// feed — and shelter — you next year.
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const dark = document.createElement('canvas'); dark.width = W / 2; dark.height = H / 2;
const dctx = dark.getContext('2d');
let K = 1;

function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
  K = clamp(s * (window.devicePixelRatio || 1), 1, 2.5);
  canvas.width = Math.round(W * K); canvas.height = Math.round(H * K);
}
addEventListener('resize', resize); resize();

const DIFFS = {
  easy: { hunger: 0.7, season: 48, hawk: 1.5, jay: 1.5, drop: 0.8, cold: 0.7, startHunger: 90 },
  normal: { hunger: 1.0, season: 40, hawk: 1.0, jay: 1.0, drop: 1.0, cold: 1.0, startHunger: 80 },
  hard: { hunger: 1.25, season: 34, hawk: 0.75, jay: 0.7, drop: 1.2, cold: 1.3, startHunger: 70 },
};
const GOAL_WINTERS = 3;
const MAX_CARRY = 3;
const ACORN_FOOD = 24, BERRY_FOOD = 10, MUSHROOM_FOOD = 14;

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

function newGame(attract) {
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
    mushT: 4, dying: 0, deathReason: '', winPending: 0, firstAcorn: false,
    stats: { buried: 0, eaten: 0, sprouted: 0, stolen: 0, scared: 0, dodged: 0, hits: 0, berries: 0 },
    tut: { moved: false, buried: false, ate: false, sniffed: false, hawk: false },
  };
  G.camX = clamp(G.player.x - W / 2, 0, WORLD_W - W);
  if (attract) { G.player.x = 600 + 140; G.camX = 330; G.seasonT = 2.5; }
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
  G.seasonT += dt;
  if (G.seasonT >= seasonLen()) advanceSeason();
  G.banner.t += dt;
  updatePlayer(dt);
  updateWorld(dt);
  updateHawk(dt);
  updateJay(dt);
  updateWeather(dt);
  updateParticles(dt);
  updateCamera(dt);
  const p = G.player;
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
      p.vy = winter && !ice ? -570 : -640; p.onGround = false; p.coyote = 0; Sound.play('jump');
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
  if (winter) m *= 1.25 + 0.12 * (G.year - 1);      // winters get harsher
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
  c.n--; p.carry++; p.digT = 0.3;
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
    if (s === 2 && t.mature) {
      t.dropT -= dt;
      if (t.dropT <= 0) { t.dropT = rand(3.2, 5.6) / G.d.drop; spawnAcorn(t.x + rand(-45, 45), GROUND - 140 + rand(-20, 15)); }
    }
  }
  // ---- bushes ----
  for (const b of G.bushes) {
    const every = s === 0 ? 13 : s === 1 ? 5.5 : s === 2 ? 20 : 0;
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
  if (s === 2 && !G.warned && L - G.seasonT < 7) {
    G.warned = true; G.geese = { x: W + 40, t: 0 }; Sound.play('geese');
  }
  if (G.geese) { G.geese.t += dt; G.geese.x -= 140 * dt; if (G.geese.x < -300) G.geese = null; }
}

// ---- Spring/Summer: hawks hunt from above. Hide under leaves or in the den. ----
function updateHawk(dt) {
  const p = G.player, s = G.season;
  if (!G.hawk && (s === 0 || s === 1)) {
    G.hawkT -= dt;
    if (G.hawkT <= 0 && G.seasonT > 3) {
      G.hawk = { ph: 'circle', t: 0, sx: p.x + rand(-160, 160), x: p.x - 300, y: 60, face: 1 };
      Sound.play('hawkCall');
    }
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
  if (!G.jay && G.season === 2 && G.caches.length) {
    G.jayT -= dt;
    if (G.jayT <= 0) {
      const far = G.caches.filter(c => Math.abs(c.x - p.x) > 200);
      const pool = far.length ? far : G.caches;
      const target = pool[Math.random() * pool.length | 0];
      const side = Math.random() < 0.5 ? -1 : 1;
      G.jay = { ph: 'fly', t: 0, x: target.x + side * 560, y: 60, target, face: -side };
      Sound.play('jay');
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

function render() {
  ctx.setTransform(K, 0, 0, K, 0, 0);
  const pal = currentPal();
  ctx.save();
  if (G.shake > 0 && !calm()) ctx.translate(rand(-G.shake, G.shake) * 0.5, rand(-G.shake, G.shake) * 0.5);
  drawSky(pal);
  drawHills(pal);
  if (G.geese) for (let i = 0; i < 7; i++) drawGoose(ctx, G.geese.x + Math.abs(i - 3) * 22, 70 + Math.abs(i - 3) * -9 + (i - 3) * 0 + 30, G.geese.t + i * 0.3);
  ctx.save(); ctx.translate(-G.camX, 0);
  drawStreamBack(pal);
  drawGround(pal);
  drawDen(pal);
  for (const b of G.bushes) if (b.x > G.camX - 60 && b.x < G.camX + W + 60) drawBush(b, pal);
  for (const t of G.trees) if (t.x > G.camX - 120 && t.x < G.camX + W + 120) drawTree(t, pal);
  drawCaches(pal);
  for (const it of G.items) {
    if (it.type === 'acorn') drawAcorn(ctx, it.x, it.y, 1, it.rot);
    else drawMushroom(ctx, it.x, it.y, 0.4 + 0.6 * it.grow);
  }
  if (G.hawk && G.hawk.ph !== 'leave') drawHawkShadow();
  if (G.jay) drawJay(ctx, G.jay.x, G.jay.y, G.t, G.jay.ph !== 'dig', G.jay.face);
  if (G.jay && G.jay.ph === 'dig') drawAlert(G.jay.x, G.jay.y - 34);
  drawPlayer();
  drawStreamFront(pal);
  drawParticles(false);
  if (G.hawk) drawHawk(ctx, G.hawk.x, G.hawk.y, G.t, G.hawk.ph === 'dive', G.hawk.face);
  drawFloaters();
  ctx.restore();
  drawDarkness();
  ctx.save(); ctx.translate(-G.camX, 0);
  drawParticles(true);
  drawSniffedCaches();
  if (!G.attract && state === 'playing') drawHint();
  ctx.restore();
  ctx.restore();
  if (!G.attract) { drawHUD(pal); drawDenArrow(); drawBanner(); }
  if (G.dying > 0) { ctx.fillStyle = `rgba(20,14,10,${0.5 * (1 - G.dying / 1.8)})`; ctx.fillRect(0, 0, W, H); }
}

function drawSky(pal) {
  const g = ctx.createLinearGradient(0, 0, 0, GROUND);
  g.addColorStop(0, rgb(pal.sky0)); g.addColorStop(1, rgb(pal.sky1));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // sun travels across the sky as the season passes
  const prog = clamp(G.seasonT / seasonLen(), 0, 1);
  const sx = lerp(120, W - 120, prog), sy = 120 - Math.sin(prog * Math.PI) * 50 + (G.season === 3 ? 30 : 0);
  ctx.fillStyle = rgb(pal.sun, 0.35); circ(ctx, sx, sy, 52, false);
  ctx.fillStyle = rgb(pal.sun); circ(ctx, sx, sy, 34, false);
  for (const c of G.clouds) {
    const x = ((c.x - G.camX * 0.12 + G.t * 6) % (WORLD_W * 0.6) + WORLD_W * 0.6) % (WORLD_W * 0.6) - 150;
    if (x < -200 || x > W + 200) continue;
    ctx.fillStyle = rgb(pal.cloud, G.season === 0 ? 0.95 : 0.8);
    const s = c.s;
    ctx.beginPath(); ctx.arc(x, c.y, 22 * s, 0, TAU); ctx.arc(x + 26 * s, c.y - 10 * s, 28 * s, 0, TAU); ctx.arc(x + 56 * s, c.y, 20 * s, 0, TAU); ctx.fill();
    rr(ctx, x - 14 * s, c.y - 4 * s, 84 * s, 26 * s, 13 * s); ctx.fill();
  }
}

function drawHills(pal) {
  const layer = (par, base, a1, f1, a2, f2, col) => {
    ctx.fillStyle = rgb(col);
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 16; x += 16) {
      const wx = x + G.camX * par;
      ctx.lineTo(x, base - Math.sin(wx * f1) * a1 - Math.sin(wx * f2 + 1.7) * a2);
    }
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgb(shade(col, 0.8)); ctx.lineWidth = 2; ctx.stroke();
  };
  layer(0.2, 300, 40, 0.004, 16, 0.011, pal.far);
  if (G.season === 3) { // snowy caps
    ctx.save(); ctx.globalAlpha = clamp(G.seasonT / 3, 0, 1) * 0.6;
    layer(0.2, 302, 40, 0.004, 16, 0.011, [255, 255, 255]); ctx.restore();
    layer(0.2, 318, 40, 0.004, 16, 0.011, pal.far);
  }
  layer(0.45, 360, 26, 0.006, 12, 0.017, pal.mid);
}

function drawGround(pal) {
  const x0 = G.camX - 20, x1 = G.camX + W + 20;
  ctx.fillStyle = rgb(pal.ground);
  ctx.fillRect(x0, GROUND, STREAM_X0 - x0, H - GROUND);
  ctx.fillRect(STREAM_X1, GROUND, x1 - STREAM_X1, H - GROUND);
  // soil texture dots
  ctx.fillStyle = rgb(shade(pal.ground, 0.8));
  for (let x = Math.floor(x0 / 40) * 40; x < x1; x += 40) {
    if (inStream(x)) continue;
    const r = Math.sin(x * 12.9898) * 43758.5453; const f = r - Math.floor(r);
    ctx.fillRect(x + f * 30, GROUND + 30 + f * 50, 6, 3);
  }
  const winter = G.season === 3;
  const th = winter ? 8 + 10 * clamp(G.seasonT / 3, 0, 1) : 9;
  ctx.fillStyle = rgb(pal.grass);
  ctx.strokeStyle = rgb(shade(pal.grass, 0.75)); ctx.lineWidth = 2;
  const strip = (a, b) => {
    if (b <= a) return;
    ctx.beginPath(); ctx.moveTo(a, GROUND + th);
    for (let x = a; x <= b; x += 12) ctx.lineTo(x, GROUND - 2 - (winter ? Math.sin(x * 0.05) * 2 + 2 : ((x / 12) % 2 ? 4 : 0)));
    ctx.lineTo(b, GROUND + th); ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  strip(x0, Math.min(x1, STREAM_X0));
  strip(Math.max(x0, STREAM_X1), x1);
}

function drawStreamBack(pal) {
  if (STREAM_X1 < G.camX - 20 || STREAM_X0 > G.camX + W + 20) return;
  ctx.fillStyle = rgb(shade(pal.ground, 0.62));
  ctx.fillRect(STREAM_X0, GROUND, STREAM_X1 - STREAM_X0, H - GROUND);
  ctx.fillStyle = rgb(shade(pal.ground, 0.85));
  ctx.fillRect(STREAM_X0, STREAM_BED, STREAM_X1 - STREAM_X0, H - STREAM_BED);
  if (G.season === 1) { // summer: dry, cracked bed
    ctx.strokeStyle = rgb(shade(pal.ground, 0.6)); ctx.lineWidth = 1.5;
    for (let x = STREAM_X0 + 15; x < STREAM_X1; x += 30) { ctx.beginPath(); ctx.moveTo(x, STREAM_BED + 6); ctx.lineTo(x + 8, STREAM_BED + 14); ctx.lineTo(x + 3, STREAM_BED + 22); ctx.stroke(); }
  }
}
function drawStreamFront(pal) {
  if (STREAM_X1 < G.camX - 20 || STREAM_X0 > G.camX + W + 20) return;
  const wy = waterSurface();
  if (G.season === 3) { // ice sheet
    const a = clamp(G.seasonT / 2, 0, 1);
    ctx.fillStyle = rgb(shade(pal.water, 0.6), 0.9); ctx.fillRect(STREAM_X0, GROUND + 10, STREAM_X1 - STREAM_X0, STREAM_BED - GROUND);
    ctx.fillStyle = rgb(pal.water, a); ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.fillRect(STREAM_X0, GROUND - 2, STREAM_X1 - STREAM_X0, 12); ctx.strokeRect(STREAM_X0, GROUND - 2, STREAM_X1 - STREAM_X0, 12);
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`; ctx.lineWidth = 2;
    for (let x = STREAM_X0 + 20; x < STREAM_X1 - 20; x += 46) { ctx.beginPath(); ctx.moveTo(x, GROUND + 6); ctx.lineTo(x + 18, GROUND + 1); ctx.stroke(); }
    return;
  }
  if (wy === null) return;
  ctx.fillStyle = rgb(pal.water, 0.72);
  ctx.beginPath(); ctx.moveTo(STREAM_X0, H);
  for (let x = STREAM_X0; x <= STREAM_X1; x += 10) ctx.lineTo(x, wy + Math.sin(x * 0.08 + G.t * 3) * 2);
  ctx.lineTo(STREAM_X1, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = STREAM_X0; x <= STREAM_X1; x += 10) { const y = wy + Math.sin(x * 0.08 + G.t * 3) * 2; x === STREAM_X0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  ctx.stroke();
}

function drawDen(pal) {
  const x = DEN_X, y = GROUND;
  if (x < G.camX - 80 || x > G.camX + W + 80) return;
  ctx.lineWidth = 2; ctx.strokeStyle = OUT;
  ctx.fillStyle = '#7a5232';
  ctx.beginPath(); ctx.moveTo(x - 40, y + 4); ctx.lineTo(x - 36, y - 56); ctx.lineTo(x + 36, y - 56); ctx.lineTo(x + 40, y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(43,29,20,.4)';
  for (let i = -24; i <= 24; i += 12) { ctx.beginPath(); ctx.moveTo(x + i, y - 50); ctx.lineTo(x + i * 1.05, y - 4); ctx.stroke(); }
  ctx.strokeStyle = OUT; ctx.fillStyle = '#c9a070'; ell(ctx, x, y - 56, 36, 9);
  ctx.strokeStyle = 'rgba(122,82,50,.8)'; ctx.lineWidth = 1.5; ell(ctx, x, y - 56, 22, 5, true); ell(ctx, x, y - 56, 10, 2.5, true);
  ctx.lineWidth = 2; ctx.strokeStyle = OUT;
  const winter = G.season === 3;
  ctx.fillStyle = '#21140c';
  ctx.beginPath(); ctx.moveTo(x - 15, y + 1); ctx.lineTo(x - 15, y - 22); ctx.arc(x, y - 22, 15, Math.PI, 0); ctx.lineTo(x + 15, y + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (winter) {
    const g = ctx.createRadialGradient(x, y - 14, 2, x, y - 14, 70);
    g.addColorStop(0, 'rgba(255,170,80,.75)'); g.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 70, y - 84, 140, 90);
    drawFlame(ctx, x, y - 12 + Math.sin(G.t * 9) * 1, 0.9 + Math.sin(G.t * 13) * 0.05);
    ctx.fillStyle = rgb(pal.grass); ctx.strokeStyle = OUT;
    ctx.beginPath(); ctx.ellipse(x, y - 58, 40, 9 * clamp(G.seasonT / 3, 0.2, 1) + 2, 0, Math.PI, TAU); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

function drawBush(b, pal) {
  const x = b.x, y = GROUND;
  ctx.lineWidth = 2; ctx.strokeStyle = OUT; ctx.fillStyle = rgb(pal.bush);
  ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.arc(x - 16, y - 12, 16, 0, TAU); ctx.moveTo(x + 31, y - 13); ctx.arc(x + 14, y - 13, 17, 0, TAU); ctx.moveTo(x + 19, y - 24); ctx.arc(x, y - 24, 19, 0, TAU);
  ctx.lineWidth = 4; ctx.stroke(); ctx.fill();
  ctx.fillStyle = rgb(shade(pal.bush, 1.15)); circ(ctx, x - 5, y - 30, 6, false);
  if (G.season === 3) {
    ctx.strokeStyle = '#5b4030'; ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 10, y - 30); ctx.lineTo(x + i * 16, y - 44); ctx.stroke(); }
  }
  const spots = [[-12, -18], [10, -22], [0, -32]];
  for (let i = 0; i < b.berries; i++) drawBerry(ctx, x + spots[i][0], y + spots[i][1], 4.5, cb());
}

function drawTree(t, pal) {
  const g = t.growth, x = t.x, s = G.season;
  const gusting = s === 2 && G.gust.dur > 0;
  const sway = Math.sin(G.t * (gusting ? 4 : 1.2) + t.sway) * (gusting ? 5 : 1.5) * g + (gusting ? G.gust.dir * 4 * g : 0);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (!t.mature && g < 0.5) { // sapling
    const top = GROUND - 30 - 70 * g;
    ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + sway, top); ctx.stroke();
    ctx.strokeStyle = '#6b4528'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + sway, top); ctx.stroke();
    if (s !== 3) {
      ctx.fillStyle = rgb(pal.leaf); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
      const lv = 6 + 12 * g;
      ctx.beginPath(); ctx.ellipse(x + sway - lv * 0.7, top + 2, lv, lv * 0.5, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x + sway + lv * 0.7, top - 2, lv, lv * 0.5, 0.5, 0, TAU); ctx.fill(); ctx.stroke();
    }
    return;
  }
  const topY = GROUND - 115 * g;
  ctx.fillStyle = '#6b4528'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 12 * g, GROUND + 2); ctx.lineTo(x + 12 * g, GROUND + 2); ctx.lineTo(x + 6 * g + sway * 0.5, topY); ctx.lineTo(x - 6 * g + sway * 0.5, topY); ctx.closePath(); ctx.fill(); ctx.stroke();
  const cx = x + sway, cy = GROUND - 140 * g;
  if (s === 3) {
    for (const br of t.branches) {
      const ex = cx + Math.cos(br.a) * br.l * g, ey = cy + 20 * g + Math.sin(br.a) * br.l * g;
      ctx.strokeStyle = OUT; ctx.lineWidth = 6 * g + 1; ctx.beginPath(); ctx.moveTo(x + sway * 0.5, topY + 8); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#6b4528'; ctx.lineWidth = 4 * g; ctx.beginPath(); ctx.moveTo(x + sway * 0.5, topY + 8); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3 * g;
      ctx.beginPath(); ctx.moveTo(lerp(x, ex, 0.45), lerp(topY, ey, 0.45) - 3 * g); ctx.lineTo(ex, ey - 3 * g); ctx.stroke();
    }
    return;
  }
  // canopy: thin out as fall goes on (leaves dropping)
  let thin = 1;
  if (s === 2) thin = 1 - 0.35 * clamp(G.seasonT / seasonLen(), 0, 1);
  const cols = [pal.leaf, pal.leaf2, s === 0 ? pal.leaf : pal.leaf3];
  ctx.strokeStyle = OUT; ctx.lineWidth = 4;
  ctx.beginPath();
  for (const b of t.blobs) { ctx.moveTo(cx + b.dx * g + b.r * g * thin, cy + b.dy * g); ctx.arc(cx + b.dx * g, cy + b.dy * g, b.r * g * thin, 0, TAU); }
  ctx.stroke();
  for (const b of t.blobs) { ctx.fillStyle = rgb(cols[b.k]); circ(ctx, cx + b.dx * g, cy + b.dy * g, b.r * g * thin, false); }
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  for (const b of t.blobs) circ(ctx, cx + b.dx * g - b.r * g * 0.3, cy + b.dy * g - b.r * g * 0.35, b.r * g * thin * 0.35, false);
  if (s === 0 && t.mature) { // blossoms
    for (const b of t.blobs) { ctx.fillStyle = rgb(pal.leaf3); circ(ctx, cx + b.dx * g * 1.1 + 6, cy + b.dy * g - 4, 3.2, false); ctx.fillStyle = '#fff'; circ(ctx, cx + b.dx * g * 1.1 + 6, cy + b.dy * g - 4, 1.2, false); }
  }
  if (s === 2 && t.mature) { for (const b of t.blobs) drawAcorn(ctx, cx + b.dx * g * 0.8, cy + b.dy * g + 6, 0.6); }
}

function drawCaches(pal) {
  if (G.season === 3) return; // snow hides them — use your memory (or your nose)
  for (const c of G.caches) {
    if (c.x < G.camX - 30 || c.x > G.camX + W + 30) continue;
    drawMound(ctx, c.x, GROUND + 1, c.n, pal.ground);
    if (Math.abs(c.x - G.player.x) < 60) {
      for (let i = 0; i < Math.min(c.n, 8); i++) { ctx.fillStyle = '#c98a3f'; ctx.strokeStyle = OUT; ctx.lineWidth = 1; circ(ctx, c.x - (Math.min(c.n, 8) - 1) * 3.5 + i * 7, GROUND - 22, 2.6); }
    }
  }
}
function drawSniffedCaches() {
  if (G.sniffT <= 0) return;
  const a = Math.min(1, G.sniffT / 0.8);
  for (const c of G.caches) {
    if (Math.abs(c.x - G.player.x) > 340) continue;
    const pulse = 1 + Math.sin(G.t * 8) * 0.1;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = '#c79bff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(c.x, GROUND - 2, 20 * pulse, 8 * pulse, 0, 0, TAU); ctx.stroke();
    if (G.season === 3) drawMound(ctx, c.x, GROUND + 1, c.n, [230, 236, 245], 0.9);
    for (let i = 0; i < Math.min(c.n, 8); i++) drawAcorn(ctx, c.x - (Math.min(c.n, 8) - 1) * 5 + i * 10, GROUND - 26 + Math.sin(G.t * 4 + i) * 2, 0.7);
    ctx.restore();
  }
}

function drawHawkShadow() {
  const h = G.hawk;
  const x = h.ph === 'dive' ? h.tx : h.sx;
  const k = h.ph === 'dive' ? Math.min(1, h.t / 0.5) : 0.3 + 0.1 * Math.sin(G.t * 8);
  ctx.fillStyle = `rgba(20,10,10,${0.18 + 0.35 * k})`;
  ell(ctx, x, GROUND + 2, 28 + 22 * k, 6 + 3 * k, false);
  ctx.strokeStyle = cb() ? 'rgba(255,140,0,.9)' : 'rgba(200,30,30,.75)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.ellipse(x, GROUND + 2, 44, 10, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
}

function drawAlert(x, y) {
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  circ(ctx, x, y, 10);
  ctx.fillStyle = cb() ? '#e07a00' : '#d23a2a';
  ctx.fillRect(x - 1.8, y - 6, 3.6, 7.5); circ(ctx, x, y + 4.5, 1.9, false);
}

function drawPlayer() {
  const p = G.player;
  if (p.inv > 0 && Math.floor(p.inv * 12) % 2 === 0) return;
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  if (p.y > GROUND - 120) ell(ctx, p.x, groundAt(p.x) + 1, 16 * (1 - (groundAt(p.x) - p.y) / 200), 4, false);
  const running = Math.abs(p.vx) > 30 && p.onGround;
  drawSquirrel(ctx, p.x, p.y + (p.deep ? 8 : 0), p.face, G.attract ? G.t : G.t, {
    run: running, air: !p.onGround && !p.deep, cheeks: p.carry, dig: p.digT > 0, eat: p.eatT > 0,
    sleep: G.dying > 0, cold: G.season === 3 && p.warmth < 35,
  });
}

function drawParticles(top) {
  for (const q of G.parts) {
    const isTop = q.kind === 'scent' || q.kind === 'spark';
    if (isTop !== top) continue;
    if (q.x < G.camX - 20 || q.x > G.camX + W + 20) continue;
    const a = clamp(q.life / q.max * 2, 0, 1);
    switch (q.kind) {
      case 'rain': ctx.strokeStyle = 'rgba(210,232,255,.6)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - 4, q.y + 12); ctx.stroke(); break;
      case 'snow': ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`; circ(ctx, q.x, q.y, q.size, false); break;
      case 'leaf': case 'petal':
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.ellipse(0, 0, q.size, q.size * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore(); break;
      case 'pollen': ctx.fillStyle = `rgba(255,246,176,${0.7 * a})`; circ(ctx, q.x, q.y, q.size, false); break;
      case 'scent':
        ctx.strokeStyle = `rgba(199,155,255,${a})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(q.x + Math.sin(q.life * 5) * 4, q.y, q.size, 0, Math.PI * 1.4); ctx.stroke(); break;
      case 'spark':
        ctx.fillStyle = q.col; ctx.globalAlpha = a; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillRect(-q.size, -0.8, q.size * 2, 1.6); ctx.fillRect(-0.8, -q.size, 1.6, q.size * 2); ctx.restore(); ctx.globalAlpha = 1; break;
      case 'feather':
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.globalAlpha = a;
        ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, TAU); ctx.fill(); ctx.restore(); break;
      default: ctx.fillStyle = q.col; ctx.globalAlpha = a; ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size); ctx.globalAlpha = 1;
    }
  }
  ctx.globalAlpha = 1;
}

function drawFloaters() {
  ctx.font = 'bold 16px "Trebuchet MS", "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of G.floaters) {
    const y = f.y - f.t * 26, a = clamp(1.3 - f.t, 0, 1);
    ctx.globalAlpha = a;
    let x = f.x;
    if (f.icon) {
      const ix = f.text ? x + 14 : x;
      if (f.icon === 'sapling') drawSaplingIcon(ctx, ix, y + 8, 0.9);
      else if (f.icon === 'acorn') drawAcorn(ctx, ix, y, 1.1);
      x -= 8;
    }
    if (f.text) {
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.col; ctx.fillText(f.text, x, y);
    }
  }
  ctx.globalAlpha = 1;
}

function drawDarkness() {
  if (G.season !== 3) return;
  const L = seasonLen();
  const a = 0.8 * Math.min(clamp(G.seasonT / 4, 0, 1), clamp((L - G.seasonT) / 3, 0, 1));
  if (a < 0.01) return;
  const p = G.player;
  G.visR = lerp(G.visR, G.bliz.dur > 0 ? 150 : 235, 0.05);
  dctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  dctx.globalCompositeOperation = 'source-over';
  dctx.clearRect(0, 0, W, H);
  dctx.fillStyle = `rgba(14,22,46,${a})`; dctx.fillRect(0, 0, W, H);
  dctx.globalCompositeOperation = 'destination-out';
  const punch = (x, y, r) => {
    const g = dctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g; dctx.beginPath(); dctx.arc(x, y, r, 0, TAU); dctx.fill();
  };
  punch(p.x - G.camX, p.y - 20, G.attract ? 400 : G.visR);
  punch(DEN_X - G.camX, GROUND - 20, 150);
  dctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(dark, 0, 0, W, H);
}

// ---------- wordless hints ----------
function bubble(x, y, items) {
  // items: array of {key:'label'} | {pic:'name'} | {arrow:dir}
  const widths = items.map(it => (it.key ? (it.key.length > 2 ? Math.max(30, it.key.length * 9 + 14) : 26) : 30));
  const w = widths.reduce((a, b) => a + b + 6, 0) + 12, h = 40;
  const bob = calm() ? 0 : Math.sin(G.t * 4) * 2;
  const bx = clamp(x - w / 2, G.camX + 6, G.camX + W - w - 6), by = y - h + bob;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(ctx, bx + 2, by + 3, w, h, 10); ctx.fill();
  ctx.fillStyle = '#fff8e8'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, bx, by, w, h, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 7, by + h - 1); ctx.lineTo(x, by + h + 9); ctx.lineTo(x + 7, by + h - 1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 7, by + h); ctx.lineTo(x, by + h + 9); ctx.lineTo(x + 7, by + h); ctx.stroke();
  let cx = bx + 12, cy = by + h / 2 + 1;
  items.forEach((it, i) => {
    const wd = widths[i], mx = cx + wd / 2;
    if (it.key) drawKeyCap(ctx, mx, cy, it.key);
    else if (it.pic === 'plus') { ctx.fillStyle = OUT; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', mx, cy); }
    else if (it.pic === 'bury') { drawMound(ctx, mx, cy + 10, 1, [110, 74, 44]); drawAcorn(ctx, mx, cy - 6 + Math.sin(G.t * 5) * 3, 0.8); }
    else if (it.pic === 'eat') { drawAcorn(ctx, mx - 6, cy, 0.8); ctx.fillStyle = OUT; ctx.font = 'bold 14px sans-serif'; ctx.fillText('→', mx + 4, cy); }
    else if (it.pic === 'stomach') { ctx.fillStyle = '#e5483b'; circ(ctx, mx, cy, 7, false); ctx.fillStyle = '#fff'; ctx.fillRect(mx - 1, cy - 4, 2, 6); }
    else if (it.pic === 'shadow') { ctx.fillStyle = 'rgba(20,10,10,.55)'; ell(ctx, mx, cy + 4, 13, 4, false); ctx.save(); ctx.translate(mx, cy - 7); ctx.scale(0.45, 0.45); drawHawk(ctx, 0, 0, G.t, false, 1); ctx.restore(); }
    else if (it.pic === 'sniff') drawNoseIcon(ctx, mx - 5, cy + 2, 0.75);
    else if (it.pic === 'tree') drawTreeIcon(ctx, mx, cy + 13, 0.65);
    else if (it.pic === 'den') { drawHouseIcon(ctx, mx, cy + 6, 1); }
    else if (it.pic === 'flame') drawFlame(ctx, mx, cy, 0.9);
    else if (it.pic === 'acorns') { drawAcorn(ctx, mx - 6, cy + 2, 0.75); drawAcorn(ctx, mx + 6, cy - 2, 0.75); }
    else if (it.arrow) { ctx.fillStyle = OUT; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.arrow < 0 ? '◀' : '▶', mx, cy); }
    cx += wd + 6;
  });
}

function drawHint() {
  if (!Settings.data.hints) return;
  const p = G.player, tut = G.tut, s = G.season, x = p.x, y = p.y - 52;
  if (G.dying > 0) return;
  if (s === 3 && p.warmth < 45 && !p.inDen) { bubble(x, y, [{ arrow: DEN_X < p.x ? -1 : 1 }, { pic: 'den' }, { pic: 'flame' }]); return; }
  if (G.hawk && G.hawk.ph !== 'leave' && !tut.hawk) { bubble(x, y, [{ pic: 'shadow' }, { arrow: 1 }, { pic: 'tree' }]); return; }
  if (!tut.moved) { bubble(x, y, [{ key: Input.label('left') }, { key: Input.label('right') }, { key: Input.label('jump') }]); return; }
  if (s === 3 && !tut.sniffed && G.seasonT > 2) { bubble(x, y, [{ key: Input.label('sniff') }, { pic: 'sniff' }]); return; }
  if (p.carry > 0 && !tut.buried && s !== 3) { bubble(x, y, [{ key: Input.label('dig') }, { pic: 'bury' }]); return; }
  if (p.carry > 0 && p.hunger < 55 && !tut.ate) { bubble(x, y, [{ key: Input.label('eat') }, { pic: 'eat' }, { pic: 'stomach' }]); return; }
  if (s === 3 && p.carry === 0 && tut.sniffed && G.sniffT > 0) {
    const c = nearestCache(p.x, 26);
    if (c) bubble(x, y, [{ key: Input.label('dig') }, { pic: 'acorns' }]);
  }
}

function drawDenArrow() {
  if (G.season !== 3) return;
  const sx = DEN_X - G.camX;
  if (sx > -20 && sx < W + 20) return;
  const left = sx < 0, x = left ? 26 : W - 26, y = GROUND - 40;
  ctx.fillStyle = 'rgba(255,248,232,.92)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  rr(ctx, x - 20, y - 20, 40, 40, 10); ctx.fill(); ctx.stroke();
  drawHouseIcon(ctx, x + (left ? 4 : -4), y + 6, 0.9);
  ctx.fillStyle = OUT; ctx.beginPath();
  if (left) { ctx.moveTo(x - 30, y); ctx.lineTo(x - 22, y - 7); ctx.lineTo(x - 22, y + 7); }
  else { ctx.moveTo(x + 30, y); ctx.lineTo(x + 22, y - 7); ctx.lineTo(x + 22, y + 7); }
  ctx.closePath(); ctx.fill();
}

// ---------- HUD ----------
function barColor(f) {
  if (cb()) return f > 0.5 ? '#3b78d8' : f > 0.25 ? '#f0b429' : '#f06d1f';
  return f > 0.5 ? '#58b947' : f > 0.25 ? '#f0b429' : '#e5483b';
}
function drawHUD(pal) {
  const p = G.player, s = G.season;
  ctx.font = 'bold 15px "Trebuchet MS", "Segoe UI", sans-serif'; ctx.textBaseline = 'middle';
  // needs panel
  ctx.fillStyle = 'rgba(255,248,232,.88)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  rr(ctx, 12, 12, 262, 104, 12); ctx.fill(); ctx.stroke();
  const low = p.hunger < 25;
  const wob = low && !calm() ? Math.sin(G.t * 20) * 2 : 0;
  drawAcorn(ctx, 32 + wob, 34, 1.2);
  const bar = (x, y, w, h, f, col, pulse) => {
    ctx.fillStyle = 'rgba(43,29,20,.18)'; rr(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = col; ctx.globalAlpha = pulse ? 0.65 + 0.35 * Math.sin(G.t * 10) : 1;
    if (f > 0.01) { rr(ctx, x, y, Math.max(h, w * f), h, h / 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, x, y, w, h, h / 2); ctx.stroke();
  };
  bar(50, 26, 170, 16, p.hunger / 100, barColor(p.hunger / 100), low);
  // active hunger modifiers (why am I getting hungry faster?)
  let mx = 236;
  if (s === 1 && !p.shaded) { drawSunIcon(ctx, mx, 34, 9, '#ffb81f'); mx += 22; }
  if (s === 3) { drawSnowflake(ctx, mx, 34, 8, '#3d6fa8', 2); mx += 22; }
  const winter = s === 3;
  ctx.globalAlpha = winter ? 1 : 0.35;
  drawFlame(ctx, 32, 62, 1);
  bar(50, 55, 170, 13, p.warmth / 100, winter ? (p.warmth < 30 ? (cb() ? '#f06d1f' : '#e5483b') : '#ff9a3d') : '#c9b8a0', winter && p.warmth < 30);
  ctx.globalAlpha = 1;
  if (winter && p.inDen) drawHouseIcon(ctx, 238, 64, 0.8);
  // cheek pouch
  for (let i = 0; i < MAX_CARRY; i++) {
    const x = 34 + i * 30, y = 94;
    ctx.fillStyle = i < p.carry ? '#fff1d6' : 'rgba(43,29,20,.12)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    circ(ctx, x, y, 12);
    if (i < p.carry) drawAcorn(ctx, x, y + 1, 1.05);
  }
  // sniff cooldown
  const nx = 150, ny = 94;
  ctx.globalAlpha = G.sniffCd > 0 ? 0.45 : 1;
  drawNoseIcon(ctx, nx, ny, 0.8);
  ctx.globalAlpha = 1;
  if (G.sniffCd > 0) { ctx.strokeStyle = '#b07ad8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(nx + 4, ny, 15, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - G.sniffCd / 4)); ctx.stroke(); }
  ctx.fillStyle = OUT; ctx.textAlign = 'center';
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.fillText(Input.touchMode ? '' : Input.label('sniff'), nx + 26, ny + 1);
  ctx.fillText(Input.touchMode ? '' : Input.label('eat'), 120, ny + 1);

  // season wheel
  const cx = W / 2, cy = 50, r = 34;
  ctx.fillStyle = 'rgba(255,248,232,.88)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; circ(ctx, cx, cy, r + 8);
  for (let i = 0; i < 4; i++) {
    const a0 = -Math.PI / 2 + i * Math.PI / 2, a1 = a0 + Math.PI / 2;
    ctx.fillStyle = WHEEL_COL[i]; ctx.globalAlpha = i === s ? 1 : 0.55;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    const am = (a0 + a1) / 2;
    seasonIcon(ctx, i, cx + Math.cos(am) * r * 0.58, cy + Math.sin(am) * r * 0.58, i === s ? 9 : 7);
  }
  const prog = (s + clamp(G.seasonT / seasonLen(), 0, 1)) / 4;
  const an = -Math.PI / 2 + prog * TAU;
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an) * (r + 4), cy + Math.sin(an) * (r + 4)); ctx.stroke();
  ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an) * (r + 2), cy + Math.sin(an) * (r + 2)); ctx.stroke();
  ctx.fillStyle = OUT; circ(ctx, cx, cy, 4, false);
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,248,232,.9)';
  ctx.strokeText(`Year ${G.year}`, cx, cy + r + 20); ctx.fillStyle = OUT; ctx.fillText(`Year ${G.year}`, cx, cy + r + 20);

  // goal: winters survived + forest size
  const gx = W - 200;
  ctx.fillStyle = 'rgba(255,248,232,.88)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, gx, 12, 188, 74, 12); ctx.fill(); ctx.stroke();
  const goal = G.endless ? Math.max(GOAL_WINTERS, G.winters + 1) : GOAL_WINTERS;
  const shown = Math.min(goal, 5);
  for (let i = 0; i < shown; i++) {
    const x = gx + 24 + i * 34, y = 34;
    ctx.fillStyle = i < G.winters ? '#dbe9fa' : 'rgba(43,29,20,.08)'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; circ(ctx, x, y, 13);
    drawSnowflake(ctx, x, y, 9, i < G.winters ? '#2f5f9e' : 'rgba(43,29,20,.3)', 2);
  }
  if (G.endless) { ctx.fillStyle = OUT; ctx.textAlign = 'left'; ctx.fillText('×' + G.winters, gx + 24 + shown * 34 - 8, 34); }
  const trees = G.trees.length;
  drawTreeIcon(ctx, gx + 24, 80, 0.6, '#3fa34a');
  ctx.textAlign = 'left'; ctx.fillStyle = OUT; ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
  ctx.fillText('×' + trees, gx + 40, 66);
  const pending = G.caches.length;
  drawMound(ctx, gx + 112, 72, 2, [110, 74, 44]);
  ctx.fillText('×' + pending, gx + 128, 66);
}

function drawBanner() {
  const b = G.banner; const t = b.t;
  if (t > 3) return;
  const a = t < 0.4 ? t / 0.4 : t > 2.4 ? (3 - t) / 0.6 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  const y = 150 + (calm() ? 0 : (1 - clamp(t / 0.4, 0, 1)) * -20);
  ctx.font = 'bold 46px "Trebuchet MS", "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const name = SEASON_NAMES[b.season].toUpperCase();
  const w = ctx.measureText(name).width;
  seasonIcon(ctx, b.season, W / 2 - w / 2 - 34, y, 22);
  seasonIcon(ctx, b.season, W / 2 + w / 2 + 34, y, 22);
  ctx.lineWidth = 7; ctx.strokeStyle = OUT; ctx.strokeText(name, W / 2, y);
  ctx.fillStyle = WHEEL_COL[b.season]; ctx.fillText(name, W / 2, y);
  ctx.restore();
}

// ======================= story strip & how-to icons =======================
function drawStory(cv) {
  const c = cv.getContext('2d');
  const k = cv.width / 640;
  c.setTransform(k, 0, 0, k, 0, 0);
  c.clearRect(0, 0, 640, 120);
  const steps = [
    { s: 2, draw: (x, y) => { drawAcorn(c, x - 10, y - 8, 1.6); drawAcorn(c, x + 12, y + 4, 1.4, 0.4); } },
    { s: 2, draw: (x, y) => { drawMound(c, x, y + 14, 3, [110, 74, 44]); drawAcorn(c, x, y - 12, 1.4); c.fillStyle = OUT; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('↓', x + 22, y - 6); } },
    { s: 3, draw: (x, y) => { c.fillStyle = '#eef3f9'; c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.ellipse(x, y + 14, 26, 12, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke(); drawNoseIcon(c, x - 6, y - 12, 0.9); } },
    { s: 0, draw: (x, y) => { drawSaplingIcon(c, x, y + 20, 1.6); } },
    { s: 1, draw: (x, y) => { drawTreeIcon(c, x, y + 26, 1.25); } },
  ];
  steps.forEach((st, i) => {
    const x = 64 + i * 128, y = 56;
    c.fillStyle = WHEEL_COL[st.s]; c.strokeStyle = OUT; c.lineWidth = 2;
    c.globalAlpha = 0.45; circ(c, x, y, 42, false); c.globalAlpha = 1;
    c.beginPath(); c.arc(x, y, 42, 0, TAU); c.stroke();
    st.draw(x, y);
    c.fillStyle = '#fffaf0'; circ(c, x + 30, y - 30, 12); seasonIcon(c, st.s, x + 30, y - 30, 8);
    if (i < steps.length - 1) { c.fillStyle = OUT; c.beginPath(); c.moveTo(x + 52, y - 7); c.lineTo(x + 70, y); c.lineTo(x + 52, y + 7); c.closePath(); c.fill(); }
  });
}
function drawSeasonCardIcon(cv, s) {
  const c = cv.getContext('2d'); const k = cv.width / 48;
  c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, 48, 48);
  c.fillStyle = WHEEL_COL[s]; c.strokeStyle = OUT; c.lineWidth = 2; circ(c, 24, 24, 21);
  c.fillStyle = '#fffaf0'; circ(c, 24, 24, 14, false);
  seasonIcon(c, s, 24, 24, 11);
}
