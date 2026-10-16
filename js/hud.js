'use strict';
// ---------------------------------------------------------------------------
// 2D overlay drawn on a transparent canvas above the 3D scene: needs bars,
// cheek pouch, season wheel, goal tracker, season banner, picture hints and
// floating numbers. World positions are projected through the 3D camera.
// ---------------------------------------------------------------------------

const hudCanvas = document.getElementById('hud');
const ctx = hudCanvas.getContext('2d');
let K = 1;
const scr = (x, y, z) => World3D.toScreen(x, y, z);

function renderHUD() {
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawFloaters();
  if (!G.attract && state === 'playing' && !G.tutorial) { drawFoodPointer(); drawHint(); }
  if (!G.attract) { drawHUD(); drawGoalLine(); drawBanner(); }
  if (G.dying > 0) { ctx.fillStyle = `rgba(20,14,10,${0.5 * (1 - G.dying / 1.8)})`; ctx.fillRect(0, 0, W, H); }
}

function drawFloaters() {
  ctx.font = 'bold 18px "Trebuchet MS", "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of G.floaters) {
    const s = scr(f.x, f.y);
    const y = s.y - f.t * 26, a = clamp(1.3 - f.t, 0, 1);
    ctx.globalAlpha = a;
    let x = s.x;
    if (f.icon) {
      const ix = f.text ? x + 16 : x;
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

// a bouncing arrow over the nearest buried acorn in winter (or at the screen edge if it's off screen)
function drawFoodPointer() {
  if (G.season !== 3 || !G.caches.length) return;
  const p = G.player;
  const c = G.caches.slice().sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  if (Math.abs(c.x - p.x) < 24) return;
  const s = scr(c.x, GROUND - 70);
  const bob = calm() ? 0 : Math.abs(Math.sin(G.t * 4)) * 8;
  ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
  if (s.x > 20 && s.x < W - 20) {
    const y = s.y - bob;
    ctx.beginPath(); ctx.moveTo(s.x - 12, y - 14); ctx.lineTo(s.x + 12, y - 14); ctx.lineTo(s.x, y + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    const left = s.x <= 20, x = left ? 34 : W - 34, y = 380;
    rr(ctx, x - 22, y - 22, 44, 44, 10); ctx.fillStyle = 'rgba(255,248,232,.95)'; ctx.fill(); ctx.stroke();
    drawAcorn(ctx, x + (left ? 5 : -5), y + 2, 1.3);
    ctx.fillStyle = '#ffd84a'; ctx.beginPath();
    if (left) { ctx.moveTo(x - 34 - bob * 0.5, y); ctx.lineTo(x - 24, y - 9); ctx.lineTo(x - 24, y + 9); }
    else { ctx.moveTo(x + 34 + bob * 0.5, y); ctx.lineTo(x + 24, y - 9); ctx.lineTo(x + 24, y + 9); }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}

// ---------- small picture bubbles over the squirrel ----------
function bubble(x, y, items) {
  const widths = items.map(it => (it.key ? (it.key.length > 2 ? Math.max(30, it.key.length * 9 + 14) : 26) : 30));
  const w = widths.reduce((a, b) => a + b + 6, 0) + 12, h = 40;
  const bob = calm() ? 0 : Math.sin(G.t * 4) * 2;
  const bx = clamp(x - w / 2, 6, W - w - 6), by = y - h + bob;
  ctx.fillStyle = 'rgba(0,0,0,.2)'; rr(ctx, bx + 2, by + 3, w, h, 10); ctx.fill();
  ctx.fillStyle = '#fff8e8'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, bx, by, w, h, 10); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 7, by + h - 1); ctx.lineTo(x, by + h + 9); ctx.lineTo(x + 7, by + h - 1); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 7, by + h); ctx.lineTo(x, by + h + 9); ctx.lineTo(x + 7, by + h); ctx.stroke();
  let cx = bx + 12; const cy = by + h / 2 + 1;
  items.forEach((it, i) => {
    const wd = widths[i], mx = cx + wd / 2;
    if (it.key) drawKeyCap(ctx, mx, cy, it.key);
    else if (it.pic === 'bury') { drawMound(ctx, mx, cy + 10, 1, [110, 74, 44]); drawAcorn(ctx, mx, cy - 6 + Math.sin(G.t * 5) * 3, 0.8); }
    else if (it.pic === 'eat') { drawAcorn(ctx, mx, cy, 1); }
    else if (it.pic === 'tree') drawTreeIcon(ctx, mx, cy + 13, 0.65);
    cx += wd + 6;
  });
}

function drawHint() {
  if (!Settings.data.hints || G.dying > 0) return;
  const p = G.player, s = G.season;
  const sp = scr(p.x, p.y - 64);
  const x = sp.x, y = sp.y;
  if (G.hawk && G.hawk.ph !== 'leave' && !p.shaded) { bubble(x, y, [{ pic: 'tree' }]); return; }
  if (s === 3 && nearestCache(p.x, 26)) { bubble(x, y, [{ key: Input.label('dig') }, { pic: 'eat' }]); return; }
  if (s !== 3 && p.carry > 0 && G.stats.buried < 6 && !inStream(p.x)) bubble(x, y, [{ key: Input.label('dig') }, { pic: 'bury' }]);
}

// ---------- "what do I do now?" line under the season wheel ----------
const GOALS = [
  { text: 'Your forgotten acorns grew into trees! Eat berries and mushrooms.' },
  { text: 'Eat berries from bushes. Red ring = hawk: stand under a tree!' },
  { text: 'Grab falling acorns, then press', key: 'dig', after: 'to bury them for winter.' },
  { text: 'Find your buried acorns and press', key: 'dig', after: 'to dig and eat.' },
];
function drawGoalLine() {
  if (G.tutorial) return;
  const g = GOALS[G.season];
  ctx.font = 'bold 17px "Trebuchet MS", "Segoe UI", sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const keyLbl = g.key ? Input.label(g.key) : '';
  const keyW = g.key ? (keyLbl.length > 2 ? Math.max(30, keyLbl.length * 9 + 14) : 26) : 0;
  const t1 = ctx.measureText(g.text).width, t2 = g.after ? ctx.measureText(g.after).width : 0;
  const total = t1 + (g.key ? keyW + 16 + t2 : 0);
  const w = total + 56, x0 = W / 2 - w / 2, y = 128;
  facetPanel(x0, y - 18, w, 36);
  seasonIcon(ctx, G.season, x0 + 22, y, 9);
  let x = x0 + 40;
  ctx.fillStyle = OUT; ctx.fillText(g.text, x, y); x += t1 + 8;
  if (g.key) { drawKeyCap(ctx, x + keyW / 2, y, keyLbl); x += keyW + 8; ctx.fillStyle = OUT; ctx.font = 'bold 17px "Trebuchet MS", "Segoe UI", sans-serif'; ctx.textAlign = 'left'; ctx.fillText(g.after, x, y); }
}

// ---------- HUD ----------
function barColor(f) {
  if (cb()) return f > 0.5 ? '#3b78d8' : f > 0.25 ? '#f0b429' : '#f06d1f';
  return f > 0.5 ? '#58b947' : f > 0.25 ? '#f0b429' : '#e5483b';
}
// faceted panel to echo the low-poly world
function facetPanel(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,248,232,.92)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
  const c = Math.min(10, h / 3);
  ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawHUD() {
  const p = G.player, s = G.season;
  ctx.textBaseline = 'middle';
  facetPanel(12, 12, 262, 82);
  const low = p.hunger < 25;
  const wob = low && !calm() ? Math.sin(G.t * 20) * 2 : 0;
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = OUT;
  ctx.fillText('FOOD', 24, 32);
  ctx.fillStyle = 'rgba(43,29,20,.18)'; rr(ctx, 70, 23, 190, 18, 3); ctx.fill();
  ctx.fillStyle = barColor(p.hunger / 100); ctx.globalAlpha = low ? 0.65 + 0.35 * Math.sin(G.t * 10) : 1;
  if (p.hunger > 1) { rr(ctx, 70 + wob, 23, Math.max(18, 190 * p.hunger / 100), 18, 3); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, 70, 23, 190, 18, 3); ctx.stroke();
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.fillStyle = OUT; ctx.fillText('CHEEKS', 24, 68);
  for (let i = 0; i < MAX_CARRY; i++) {
    const x = 98 + i * 30, y = 68;
    ctx.fillStyle = i < p.carry ? '#fff1d6' : 'rgba(43,29,20,.1)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    circ(ctx, x, y, 12);
    if (i < p.carry) drawAcorn(ctx, x, y + 1, 1.05);
  }

  // season wheel
  const cx = W / 2, cy = 52, r = 34;
  ctx.fillStyle = 'rgba(255,248,232,.92)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
  ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; ctx.lineTo(cx + Math.cos(a) * (r + 10), cy + Math.sin(a) * (r + 10)); } ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a0 = -Math.PI / 2 + i * Math.PI / 2, a1 = a0 + Math.PI / 2;
    ctx.fillStyle = WHEEL_COL[i]; ctx.globalAlpha = i === s ? 1 : 0.5;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke();
    const am = (a0 + a1) / 2;
    seasonIcon(ctx, i, cx + Math.cos(am) * r * 0.58, cy + Math.sin(am) * r * 0.58, i === s ? 9 : 7);
  }
  const prog = G.tutorial ? (s + 0.5) / 4 : (s + clamp(G.seasonT / seasonLen(), 0, 1)) / 4;
  const an = -Math.PI / 2 + prog * TAU;
  ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an) * (r + 4), cy + Math.sin(an) * (r + 4)); ctx.stroke();
  ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(an) * (r + 2), cy + Math.sin(an) * (r + 2)); ctx.stroke();
  ctx.fillStyle = OUT; circ(ctx, cx, cy, 4, false);

  // goal tracker: winters survived + trees
  const gx = W - 200;
  facetPanel(gx, 12, 188, 82);
  ctx.font = 'bold 13px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = OUT;
  ctx.fillText(G.tutorial ? 'TUTORIAL' : (G.endless ? 'WINTERS SURVIVED' : 'SURVIVE 3 WINTERS'), gx + 12, 28);
  const goal = G.endless ? Math.max(GOAL_WINTERS, G.winters + 1) : GOAL_WINTERS;
  const shown = Math.min(goal, 5);
  for (let i = 0; i < shown; i++) {
    const x = gx + 24 + i * 30, y = 54;
    ctx.fillStyle = i < G.winters ? '#dbe9fa' : 'rgba(43,29,20,.08)'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; circ(ctx, x, y, 12);
    drawSnowflake(ctx, x, y, 8, i < G.winters ? '#2f5f9e' : 'rgba(43,29,20,.3)', 2);
  }
  drawTreeIcon(ctx, gx + 132, 70, 0.55, '#3fa34a');
  ctx.font = 'bold 16px "Trebuchet MS", sans-serif'; ctx.fillStyle = OUT;
  ctx.fillText('×' + G.trees.length, gx + 146, 58);
}

function drawBanner() {
  const b = G.banner; const t = b.t;
  if (t > 3) return;
  const a = t < 0.4 ? t / 0.4 : t > 2.4 ? (3 - t) / 0.6 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  const y = 200 + (calm() ? 0 : (1 - clamp(t / 0.4, 0, 1)) * -20);
  ctx.font = 'bold 50px "Trebuchet MS", "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const name = SEASON_NAMES[b.season].toUpperCase();
  const w = ctx.measureText(name).width;
  seasonIcon(ctx, b.season, W / 2 - w / 2 - 36, y, 24);
  seasonIcon(ctx, b.season, W / 2 + w / 2 + 36, y, 24);
  ctx.lineWidth = 8; ctx.strokeStyle = OUT; ctx.strokeText(name, W / 2, y);
  ctx.fillStyle = WHEEL_COL[b.season]; ctx.fillText(name, W / 2, y);
  ctx.restore();
}

// ---------- story strip & how-to icons (menus) ----------
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
    c.globalAlpha = 0.45;
    c.beginPath(); for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; c.lineTo(x + Math.cos(a) * 44, y + Math.sin(a) * 44); } c.closePath(); c.fill();
    c.globalAlpha = 1; c.stroke();
    st.draw(x, y);
    c.fillStyle = '#fffaf0'; circ(c, x + 30, y - 30, 12); seasonIcon(c, st.s, x + 30, y - 30, 8);
    if (i < steps.length - 1) { c.fillStyle = OUT; c.beginPath(); c.moveTo(x + 52, y - 7); c.lineTo(x + 70, y); c.lineTo(x + 52, y + 7); c.closePath(); c.fill(); }
  });
}
function drawSeasonCardIcon(cv, s) {
  const c = cv.getContext('2d'); const k = cv.width / 48;
  c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, 48, 48);
  c.fillStyle = WHEEL_COL[s]; c.strokeStyle = OUT; c.lineWidth = 2;
  c.beginPath(); for (let j = 0; j < 6; j++) { const a = j / 6 * TAU; c.lineTo(24 + Math.cos(a) * 22, 24 + Math.sin(a) * 22); } c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fffaf0'; circ(c, 24, 24, 14, false);
  seasonIcon(c, s, 24, 24, 11);
}
