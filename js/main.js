'use strict';
// ---------------------------------------------------------------------------
// Menus, settings UI, touch controls and the main loop.
// ---------------------------------------------------------------------------

const $ = id => document.getElementById(id);
const BEST_KEY = 'forgottenAcorns.best';
let settingsBack = 'title';

function show(id) {
  for (const o of document.querySelectorAll('.overlay')) o.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
}
function loadBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || 'null'); } catch (e) { return null; } }
function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch (e) { /* ignore */ } }
function refreshBest() {
  const b = loadBest();
  $('bestLine').textContent = b ? `Best: ${b.score} pts · ${b.winters} winters · ${b.trees} trees planted` : '';
}

function applyAudioSettings() { Sound.setVolumes(Settings.data.music, Settings.data.sfx); }

function startGame(tutorial) {
  Sound.init(); applyAudioSettings();
  newGame(false, !!tutorial);
  Tutorial.show(false);
  state = 'playing'; Input.gameActive = true;
  show(null);
  Sound.startMusic(G.season);
  if (document.activeElement) document.activeElement.blur();
  updateTouch();
}
function toTitle() {
  newGame(true);
  state = 'title'; Input.gameActive = false;
  Sound.duck(false); Tutorial.show(false);
  show('title'); refreshBest(); updateTouch();
}
function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused'; Input.gameActive = false; Sound.duck(true); show('pause'); updateTouch();
  if (G.tutorial) Tutorial.show(false);
}
function resumeGame() {
  state = 'playing'; Input.gameActive = true; Sound.duck(false); show(null); updateTouch();
  if (G.tutorial && G.tutorial.step >= 0) Tutorial.show(true);
  if (document.activeElement) document.activeElement.blur();
}

function scoreOf() {
  const s = G.stats;
  return G.winters * 100 + s.sprouted * 30 + s.eaten * 2 + s.scared * 5 + s.dodged * 5;
}
function endGame(won) {
  state = 'over'; Input.gameActive = false; updateTouch();
  const s = G.stats, score = scoreOf();
  const best = loadBest();
  const isBest = !best || score > best.score;
  if (isBest) saveBest({ score, winters: G.winters, trees: s.sprouted });
  if (won) Sound.play('win');
  Sound.duck(true);
  $('endTitle').textContent = won ? 'You made it through three winters!' : (G.deathReason === 'froze' ? 'Too cold, too hungry…' : 'The squirrel ran out of food…');
  $('endSub').textContent = won
    ? `Every acorn you forgot became part of a forest of ${G.trees.length} trees.`
    : (G.season === 3 ? 'Winter is long. Bury more in Fall, and remember where.' : 'Keep your belly full: berries in Summer, acorns in Fall.');
  const rows = [
    ['Winters survived', G.winters],
    ['Trees grown from forgotten acorns', s.sprouted],
    ['Acorns buried', s.buried],
    ['Acorns eaten', s.eaten],
    ['Berries eaten', s.berries],
    ['Jays chased off', s.scared],
    ['Acorns stolen by jays', s.stolen],
    ['Hawk dives dodged', s.dodged],
  ];
  $('endStats').innerHTML = rows.map(r => `<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') +
    `<div class="score"><span>Score${isBest ? ' · new best!' : ''}</span><b>${score}</b></div>`;
  $('btnContinue').classList.toggle('hidden', !won);
  $('endCard').classList.toggle('won', won);
  show('end');
}

// ---------- buttons ----------
$('btnPlay').onclick = () => { Sound.init(); Sound.play('click'); startGame(!Tutorial.isDone()); };
$('btnTutorial').onclick = () => { Sound.init(); Sound.play('click'); startGame(true); };
$('btnHow').onclick = () => { Sound.init(); Sound.play('click'); show('how'); };
$('btnHowBack').onclick = () => { Sound.play('click'); show('title'); };
$('btnSettings').onclick = () => { Sound.init(); Sound.play('click'); settingsBack = 'title'; buildSettings(); show('settings'); };
$('btnResume').onclick = () => { Sound.play('click'); resumeGame(); };
$('btnPauseSettings').onclick = () => { Sound.play('click'); settingsBack = 'pause'; buildSettings(); show('settings'); };
$('btnQuit').onclick = () => { Sound.play('click'); toTitle(); };
$('btnSettingsBack').onclick = () => { Sound.play('click'); Input.cancelCapture(); show(settingsBack); };
$('btnRetry').onclick = () => { Sound.play('click'); Sound.duck(false); startGame(); };
$('btnMenu').onclick = () => { Sound.play('click'); toTitle(); };
$('btnContinue').onclick = () => {
  Sound.play('click'); G.endless = true; G.winPending = 0;
  state = 'playing'; Input.gameActive = true; Sound.duck(false); show(null); updateTouch();
};

// ---------- settings ----------
function buildSettings() {
  const d = Settings.data;
  const seg = (name, opts, cur, onPick) => {
    const wrap = document.createElement('div'); wrap.className = 'seg';
    for (const [val, label] of opts) {
      const b = document.createElement('button'); b.textContent = label;
      if (val === cur) b.classList.add('on');
      b.onclick = () => { onPick(val); Settings.save(); Sound.play('click'); buildSettings(); };
      wrap.appendChild(b);
    }
    return wrap;
  };
  const row = (label, el, note) => {
    const r = document.createElement('div'); r.className = 'row';
    const l = document.createElement('label'); l.textContent = label;
    if (note) { const n = document.createElement('small'); n.textContent = note; l.appendChild(n); }
    r.appendChild(l); r.appendChild(el); return r;
  };
  const slider = (val, onChange) => {
    const s = document.createElement('input'); s.type = 'range'; s.min = 0; s.max = 1; s.step = 0.05; s.value = val;
    s.oninput = () => { onChange(parseFloat(s.value)); Settings.save(); applyAudioSettings(); };
    return s;
  };
  const box = $('settingsBody'); box.innerHTML = '';
  box.appendChild(row('Difficulty', seg('diff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']], d.difficulty, v => { d.difficulty = v; }),
    state === 'paused' ? 'applies to your next run' : 'hunger, season length, predators'));
  box.appendChild(row('Colour-blind friendly', seg('cb', [[false, 'Off'], [true, 'On']], d.colorblind, v => { d.colorblind = v; }), 'blue/orange cues + shape markers'));
  box.appendChild(row('Reduce motion', seg('rm', [[false, 'Off'], [true, 'On']], d.reduceMotion, v => { d.reduceMotion = v; }), 'no shake, fewer particles'));
  box.appendChild(row('Picture hints', seg('hints', [[true, 'On'], [false, 'Off']], d.hints, v => { d.hints = v; })));
  box.appendChild(row('Music volume', slider(d.music, v => { d.music = v; })));
  box.appendChild(row('Sound volume', slider(d.sfx, v => { d.sfx = v; })));
  const h = document.createElement('h3'); h.textContent = 'Controls (click to remap)'; box.appendChild(h);
  const grid = document.createElement('div'); grid.className = 'binds';
  for (const a of ACTIONS) {
    const l = document.createElement('span'); l.textContent = ACTION_NAMES[a];
    const b = document.createElement('button'); b.className = 'key';
    b.textContent = Settings.data.binds[a].map(keyLabel).join(' / ');
    b.onclick = () => {
      b.textContent = 'press a key…'; b.classList.add('wait');
      Input.captureNext(code => { if (code !== 'Escape' || a === 'pause') Input.rebind(a, code); Sound.play('click'); buildSettings(); });
    };
    grid.appendChild(l); grid.appendChild(b);
  }
  box.appendChild(grid);
  const reset = document.createElement('button'); reset.textContent = 'Reset controls'; reset.className = 'small';
  reset.onclick = () => { Settings.data.binds = cloneBinds(); Settings.save(); Sound.play('click'); buildSettings(); };
  box.appendChild(reset);
  const pad = document.createElement('p'); pad.className = 'note';
  pad.textContent = 'Gamepads work too: stick/d-pad move, A jump, X dig, B eat, Y sniff, Start pause.';
  box.appendChild(pad);
}

// ---------- touch controls ----------
const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches);
function updateTouch() {
  $('touch').classList.toggle('hidden', !(isTouch && state === 'playing'));
}
for (const b of document.querySelectorAll('#touch [data-a]')) {
  const a = b.dataset.a;
  const press = e => { e.preventDefault(); Input.touchMode = true; Sound.init(); if (a === 'pause') { pauseGame(); return; } Input.vPress(a); b.classList.add('on'); };
  const release = e => { e.preventDefault(); Input.vRelease(a); b.classList.remove('on'); };
  b.addEventListener('pointerdown', press);
  b.addEventListener('pointerup', release);
  b.addEventListener('pointercancel', release);
  b.addEventListener('pointerleave', release);
}
if (isTouch) { Input.touchMode = true; document.body.classList.add('touch'); }

document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

// ---------- how-to season icons + title story ----------
for (const cv of document.querySelectorAll('canvas[data-season]')) drawSeasonCardIcon(cv, +cv.dataset.season);
drawStory($('story'));

// ---------- layout: the 3D view, the HUD and the tutorial panel share one 16:9 stage ----------
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const cw = Math.floor(W * s), ch = Math.floor(H * s);
  const stage = $('stage');
  stage.style.width = cw + 'px'; stage.style.height = ch + 'px';
  stage.style.setProperty('--s', s.toFixed(3));
  const dpr = window.devicePixelRatio || 1;
  K = clamp(s * dpr, 1, 2.5);
  hudCanvas.width = Math.round(W * K); hudCanvas.height = Math.round(H * K);
  World3D.resize(cw, ch, Math.min(2, dpr));
}
addEventListener('resize', resize);

// ---------- main loop ----------
let glOk = true;
try { World3D.init($('gl')); } catch (e) { glOk = false; console.error(e); }
if (!glOk) show('nogl');
resize();
newGame(true);
refreshBest();
$('btnTutorial').classList.toggle('glow', !Tutorial.isDone());
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (window.__manual) { requestAnimationFrame(frame); return; } // automated tests step the game themselves
  Input.poll();
  if (state === 'playing') {
    if (Input.hit('pause')) pauseGame();
    else update(dt);
  } else if (state === 'paused') {
    if (Input.hit('pause')) resumeGame();
  } else if (state === 'title') {
    update(dt);
  }
  Sound.tick();
  if (glOk) World3D.sync(dt);
  renderHUD();
  Input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// small hook used by automated smoke tests
window.__fa = { get G() { return G; }, get state() { return state; }, startGame, advanceSeason, endGame, glOk };
