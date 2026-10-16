'use strict';
// ---------------------------------------------------------------------------
// Guided tutorial: a scripted first year. Each step shows one short line,
// the keys to press and a glowing marker in the world, and only moves on
// once the player has actually done the thing. Hazards appear only when a
// step calls for them, and you cannot starve while learning.
// ---------------------------------------------------------------------------

const Tutorial = (() => {
  const DONE_KEY = 'forgottenAcorns.tutorialDone2';
  const el = id => document.getElementById(id);
  let nextPressed = false, base = 0;

  const TOUCH_NAMES = { left: '◀', right: '▶', jump: '▲', dig: '▼', pause: 'II' };
  const keyName = a => (Input.touchMode ? TOUCH_NAMES[a] : keyLabel(Settings.data.binds[a][0]));
  const kbd = a => `<kbd>${keyName(a).replace(/</g, '&lt;')}</kbd>`;

  const P = () => G.player;
  const near = (x, r = 34) => Math.abs(P().x - x) < r;
  const mark = x => { G.tutorial.markX = x; };
  const nearestTree = () => G.trees.filter(t => t.growth > 0.6).sort((a, b) => Math.abs(a.x - P().x) - Math.abs(b.x - P().x))[0];

  const STEPS = [
    {
      title: 'Move',
      text: () => `Hi, squirrel! Walk to the yellow arrow with ${kbd('left')} ${kbd('right')}.`,
      enter() { mark(800); },
      done: () => near(800, 40),
    },
    {
      title: 'Jump',
      text: () => `Press ${kbd('jump')} to jump.`,
      enter() { G.tut.jumped = false; G.tutorial.markX = null; },
      done: () => G.tut.jumped,
    },
    {
      title: 'Grab acorns',
      text: () => `It's <b>Fall</b>. Acorns are falling! Run over them to grab them.`,
      enter() { for (let i = 0; i < 3; i++) spawnAcorn(960 + i * 60, GROUND - 160 - i * 30); },
      update() {
        const a = G.items.filter(i => i.type === 'acorn').sort((x, y) => Math.abs(x.x - P().x) - Math.abs(y.x - P().x))[0];
        if (a) mark(a.x); else if (P().carry < 3) spawnAcorn(P().x + 120, GROUND - 160);
      },
      done: () => P().carry >= 3,
    },
    {
      title: 'Bury them',
      text: () => `Press ${kbd('dig')} to <b>bury</b> an acorn. It's saved for winter. Bury all 3!`,
      enter() { base = G.stats.buried; G.tutorial.markX = null; },
      update() { if (P().carry === 0 && G.stats.buried - base < 3) P().carry = 1; },
      done: () => G.stats.buried >= base + 3,
    },
    {
      title: 'Winter',
      text: () => `Brr, <b>Winter</b>! No food grows now. Walk to a buried acorn (the snowy mound) and press ${kbd('dig')} to dig it up and eat it.`,
      enter() {
        advanceSeason(); P().hunger = 45; base = G.stats.dug;
        if (!G.caches.length) G.caches.push({ x: P().x + 150, n: 2, t: 0 });
      },
      update() {
        const c = G.caches.slice().sort((a, b) => Math.abs(a.x - P().x) - Math.abs(b.x - P().x))[0];
        if (c) mark(c.x); else G.caches.push({ x: P().x + 150, n: 1, t: 0 });
        P().hunger = Math.min(P().hunger, 80);
      },
      done: () => G.stats.dug > base,
    },
    {
      title: 'The magic',
      text: () => `Acorns you <b>don't</b> dig up grow into <b>new trees</b> in Spring. More trees = more acorns next year!`,
      enter() {
        G.tutorial.markX = null;
        if (!G.caches.some(c => canPlant(c.x))) { const x = [1150, 1250, 1650].find(canPlant) || 1150; G.caches.push({ x, n: 1, t: 0 }); }
        advanceSeason();
        const t = G.trees.find(t => !t.mature); if (t) mark(t.x);
        nextPressed = false;
      },
      next: true,
      done: () => nextPressed,
    },
    {
      title: 'Hawk!',
      text: () => `In Summer, hawks hunt. See the <b>red ring</b> under you? <b>Stand under a tree</b> until the hawk flies away.`,
      enter() { advanceSeason(); G.tut.hawk = false; G.hawk = null; spawnHawk(); },
      update() {
        const t = nearestTree(); if (t) mark(t.x);
        if (!G.hawk && !G.tut.hawk) spawnHawk();
      },
      done: () => G.tut.hawk && !G.hawk,
    },
    {
      title: 'Ready!',
      text: () => `That's it! Keep your <b>food bar</b> full and survive <b>3 winters</b>. The line at the top always tells you what to do.`,
      enter() { G.tutorial.markX = null; },
      final: true,
    },
  ];

  function show(on) { el('tut').classList.toggle('hidden', !on); }

  function enterStep(i) {
    const T = G.tutorial;
    T.step = i; T.t = 0; nextPressed = false;
    const st = STEPS[i];
    if (st.enter) st.enter();
    el('tutStep').textContent = `${i + 1} / ${STEPS.length} · ${st.title}`;
    el('tutText').innerHTML = st.text();
    el('tutNext').classList.toggle('hidden', !st.next);
    el('tutStart').classList.toggle('hidden', !st.final);
    el('tutBar').style.width = `${(i / (STEPS.length - 1)) * 100}%`;
    Sound.play(i ? 'pickup' : 'click');
  }

  function update(dt) {
    const T = G.tutorial;
    if (T.step < 0) { enterStep(0); show(true); return; }
    const st = STEPS[T.step];
    T.t += dt;
    if (st.update) st.update(dt);
    if (st.next && Input.hit('jump')) nextPressed = true;
    let finished = false;
    if (st.auto) finished = T.t >= st.auto;
    else if (st.done) finished = T.t > 0.4 && st.done();
    if (finished && T.step < STEPS.length - 1) {
      if (st.exit) st.exit();
      Sound.play('sprout');
      enterStep(T.step + 1);
    }
    if (st.final && T.t > 0.5 && Input.hit('jump')) finish();
  }

  function finish() {
    try { localStorage.setItem(DONE_KEY, '1'); } catch (e) { /* ignore */ }
    show(false);
    startGame();
  }
  function skip() { finish(); }
  function isDone() { try { return localStorage.getItem(DONE_KEY) === '1'; } catch (e) { return false; } }

  el('tutNext').onclick = () => { nextPressed = true; };
  el('tutStart').onclick = () => finish();
  el('tutSkip').onclick = () => skip();

  return { update, show, isDone, finish };
})();
