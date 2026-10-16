'use strict';
// ---------------------------------------------------------------------------
// Guided tutorial: a scripted first year. Each step shows one short line,
// the keys to press and a glowing marker in the world, and only moves on
// once the player has actually done the thing. Hazards appear only when a
// step calls for them, and you cannot starve while learning.
// ---------------------------------------------------------------------------

const Tutorial = (() => {
  const DONE_KEY = 'forgottenAcorns.tutorialDone';
  const el = id => document.getElementById(id);
  let nextPressed = false, base = 0;

  const TOUCH_NAMES = { left: '◀', right: '▶', jump: '▲', dig: '▼', eat: 'acorn button', sniff: 'nose button', pause: 'II' };
  const keyName = a => (Input.touchMode ? TOUCH_NAMES[a] : keyLabel(Settings.data.binds[a][0]));
  const kbd = a => `<kbd>${keyName(a).replace(/</g, '&lt;')}</kbd>`;

  const P = () => G.player;
  const near = (x, r = 34) => Math.abs(P().x - x) < r;
  const mark = x => { G.tutorial.markX = x; };
  const nearestTree = () => G.trees.filter(t => t.growth > 0.6).sort((a, b) => Math.abs(a.x - P().x) - Math.abs(b.x - P().x))[0];
  function ensureCache(x) {
    if (!G.caches.length) G.caches.push({ x, n: 1, t: 0 });
    return G.caches;
  }

  const STEPS = [
    {
      title: 'Meet your squirrel',
      text: () => `Your goal is to <b>survive three winters</b>. Walk to the glowing marker with ${kbd('left')} ${kbd('right')}.`,
      enter() { mark(800); },
      done: () => near(800, 40),
    },
    {
      title: 'Jump',
      text: () => `Press ${kbd('jump')} to jump. You'll need it to climb out of the stream.`,
      enter() { G.tut.jumped = false; G.tutorial.markX = null; },
      done: () => G.tut.jumped,
    },
    {
      title: 'Gather acorns',
      text: () => `It's <b>Fall</b>, and the oaks are dropping acorns. Run over them to stuff them in your cheeks. You can carry <b>3</b> (bottom of the top-left panel).`,
      enter() { for (let i = 0; i < 4; i++) spawnAcorn(960 + i * 55, GROUND - 160 - i * 30); },
      update() {
        const a = G.items.filter(i => i.type === 'acorn').sort((x, y) => Math.abs(x.x - P().x) - Math.abs(y.x - P().x))[0];
        if (a) mark(a.x); else if (P().carry < 3) spawnAcorn(P().x + 120, GROUND - 160);
      },
      done: () => P().carry >= 3,
    },
    {
      title: 'Bury an acorn',
      text: () => `Your cheeks are full. Press ${kbd('dig')} to <b>bury</b> an acorn. That makes a <b>cache</b>, a little mound of stored food for winter.`,
      enter() { base = G.stats.buried; G.tutorial.markX = null; },
      done: () => G.stats.buried > base,
    },
    {
      title: 'Spread your caches',
      text: () => `Walk to the marker and bury another one. Caches in different places are harder to lose all at once.`,
      enter() { base = G.stats.buried; const c = G.caches[0]; mark(clamp((c ? c.x : P().x) + 260, 100, STREAM_X0 - 100)); },
      update() { if (P().carry === 0 && G.stats.buried === base) { P().carry = 1; } },
      done: () => G.stats.buried > base && G.caches.length >= 2,
    },
    {
      title: 'Eat',
      text: () => `Your <b>belly bar</b> (top left) is getting low. Press ${kbd('eat')} to eat an acorn from your cheeks. If it ever empties, the run is over.`,
      enter() { P().hunger = 38; if (P().carry < 1) P().carry = 1; base = G.stats.eaten; G.tutorial.markX = null; },
      done: () => G.stats.eaten > base,
    },
    {
      title: 'Thief!',
      text: () => `A <b>blue jay</b>! Jays dig up any cache they can see. <b>Run at it</b> to scare it off before it steals your acorn.`,
      enter() { base = G.stats.scared; const cs = ensureCache(P().x + 300); spawnJay(cs.slice().sort((a, b) => Math.abs(b.x - P().x) - Math.abs(a.x - P().x))[0]); },
      update() {
        if (!G.jay && G.stats.scared === base) { const cs = ensureCache(P().x + 300); spawnJay(cs[cs.length - 1]); }
        if (G.jay) mark(G.jay.ph === 'dig' ? G.jay.x : G.jay.target.x);
      },
      done: () => G.stats.scared > base,
    },
    {
      title: 'Winter is coming',
      text: () => `Hear the honking? <b>Geese flying south</b> mean winter is a few seconds away. In the real game that's your last call to bury food.`,
      enter() { G.tutorial.markX = null; G.geese = { x: W + 40, t: 0 }; Sound.play('geese'); for (const it of G.items) it.landed = true; },
      auto: 5,
      exit() { advanceSeason(); },
    },
    {
      title: 'Snow hides everything',
      text: () => `It's <b>Winter</b>. Nothing grows, it's dark, and snow has hidden your caches. Press ${kbd('sniff')} to <b>sniff</b>: buried acorns nearby glow for a few seconds.`,
      enter() { G.tut.sniffed = false; ensureCache(P().x + 180); },
      done: () => G.tut.sniffed,
    },
    {
      title: 'Dig it up',
      text: () => `Stand on a glowing cache and press ${kbd('dig')} to dig an acorn back up. The ground is frozen, so in winter you can only dig, not bury. Sniff again if the glow fades.`,
      enter() { base = G.stats.dug; ensureCache(P().x + 180); if (P().carry >= MAX_CARRY) P().carry = MAX_CARRY - 1; },
      update() {
        const c = G.caches.slice().sort((a, b) => Math.abs(a.x - P().x) - Math.abs(b.x - P().x))[0];
        if (c) mark(c.x); else { ensureCache(P().x + 150); }
      },
      done: () => G.stats.dug > base,
    },
    {
      title: 'Stay warm',
      text: () => `Brr! The cold drains your <b>warmth</b> (orange bar). When it's empty you starve much faster. Run home to your <b>den</b> and stand in the doorway until you're warm.`,
      enter() { P().warmth = Math.min(P().warmth, 32); mark(DEN_X); },
      done: () => P().inDen && P().warmth >= 95,
    },
    {
      title: 'The forgotten ones',
      text: () => `Here's the heart of the game. Any cache you <b>never dig up</b> doesn't go to waste. Watch what happens when winter ends...`,
      enter() {
        G.tutorial.markX = null;
        const ok = G.caches.some(c => canPlant(c.x));
        if (!ok) { const x = [1150, 1250, 1650].find(canPlant) || 1150; G.caches.push({ x, n: 1, t: 0 }); }
      },
      auto: 4.5,
      exit() { advanceSeason(); },
    },
    {
      title: 'Spring',
      text: () => `Every forgotten cache just <b>sprouted into a sapling</b>. By next Fall it's an oak dropping acorns for you. So <b>forget wisely</b>: eat enough to survive, leave enough to grow a forest.`,
      enter() { const t = G.trees.find(t => !t.mature); mark(t ? t.x : null); nextPressed = false; },
      next: true,
      done: () => nextPressed,
    },
    {
      title: 'Hawk!',
      text: () => `A <b>hawk</b> is circling. Its shadow (the red ring) follows you, then it dives. Get <b>under a tree's leaves</b>, or into your den, before it strikes.`,
      enter() { G.tut.hawk = false; G.hawk = null; spawnHawk(); },
      update() {
        const t = nearestTree(); if (t) mark(t.x);
        if (!G.hawk && !G.tut.hawk) spawnHawk();
      },
      done: () => G.tut.hawk && !G.hawk,
    },
    {
      title: 'Summer',
      text: () => `<b>Summer</b> brings berries everywhere, but the hot sun makes you hungry 1.5× faster. Stay in the shade when you can. Eat two berries from a bush.`,
      enter() { advanceSeason(); P().hunger = 50; for (const b of G.bushes) b.berries = 3; base = G.stats.berries; },
      update() {
        const b = G.bushes.filter(b => b.berries > 0 && b.x < STREAM_X0).sort((a, c) => Math.abs(a.x - P().x) - Math.abs(c.x - P().x))[0];
        if (b) mark(b.x);
        if (P().hunger > 90) P().hunger = 70;
      },
      done: () => G.stats.berries >= base + 2,
    },
    {
      title: "You're ready",
      text: () => `That's one whole year. In the real game the seasons change on their own (watch the wheel at the top). Survive <b>3 winters</b> and grow the biggest forest you can. Good luck!`,
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
