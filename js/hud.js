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
  if (G.jay && G.jay.ph === 'dig') { const s = scr(G.jay.x, GROUND - 52); drawAlert(s.x, s.y); }
  drawSniffIcons();
  drawFloaters();
  if (!G.attract && state === 'playing' && !G.tutorial) drawHint();
  if (!G.attract) { drawHUD(); drawDenArrow(); drawBanner(); }
  if (G.dying > 0) { ctx.fillStyle = `rgba(20,14,10,${0.5 * (1 - G.dying / 1.8)})`; ctx.fillRect(0, 0, W, H); }
}

function drawAlert(x, y) {
  ctx.fillStyle = '#fffaf0'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  circ(ctx, x, y, 12);
  ctx.fillStyle = cb() ? '#e07a00' : '#d23a2a';
  ctx.fillRect(x - 2, y - 7, 4, 9); circ(ctx, x, y + 5.5, 2.2, false);
}

function drawSniffIcons() {
  if (G.sniffT <= 0) return;
  const a = Math.min(1, G.sniffT / 0.8);
  ctx.save(); ctx.globalAlpha = a;
  for (const c of G.caches) {
    if (Math.abs(c.x - G.player.x) > 340) continue;
    const s = scr(c.x, GROUND - 46);
    const n = Math.min(c.n, 6);
    for (let i = 0; i < n; i++) drawAcorn(ctx, s.x - (n - 1) * 6 + i * 12, s.y + Math.sin(G.t * 4 + i) * 2, 0.9);
  }
  ctx.restore();
}

function drawFloaters() {
  ctx.font = 'bold 17px "Trebuchet MS", "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of G.floaters) {
    const s = scr(f.x, f.y);
    const y = s.y - f.t * 26, a = clamp(1.3 - f.t, 0, 1);
    ctx.globalAlpha = a;
    let x = s.x;
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

// ---------- in-game picture hints (after the tutorial) ----------
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
    else if (it.pic === 'eat') { drawAcorn(ctx, mx - 6, cy, 0.8); ctx.fillStyle = OUT; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('→', mx + 6, cy); }
    else if (it.pic === 'stomach') { ctx.fillStyle = '#e5483b'; circ(ctx, mx, cy, 7, false); ctx.fillStyle = '#fff'; ctx.fillRect(mx - 1, cy - 4, 2, 6); }
    else if (it.pic === 'shadow') { ctx.fillStyle = 'rgba(20,10,10,.55)'; ell(ctx, mx, cy + 4, 13, 4, false); ctx.save(); ctx.translate(mx, cy - 7); ctx.scale(0.45, 0.45); drawHawk(ctx, 0, 0, G.t, false, 1); ctx.restore(); }
    else if (it.pic === 'sniff') drawNoseIcon(ctx, mx - 5, cy + 2, 0.75);
    else if (it.pic === 'tree') drawTreeIcon(ctx, mx, cy + 13, 0.65);
    else if (it.pic === 'den') drawHouseIcon(ctx, mx, cy + 6, 1);
    else if (it.pic === 'flame') drawFlame(ctx, mx, cy, 0.9);
    else if (it.pic === 'acorns') { drawAcorn(ctx, mx - 6, cy + 2, 0.75); drawAcorn(ctx, mx + 6, cy - 2, 0.75); }
    else if (it.arrow) { ctx.fillStyle = OUT; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.arrow < 0 ? '◀' : '▶', mx, cy); }
    cx += wd + 6;
  });
}

function drawHint() {
  if (!Settings.data.hints || G.dying > 0) return;
  const p = G.player, tut = G.tut, s = G.season;
  const sp = scr(p.x, p.y - 64);
  const x = sp.x, y = sp.y;
  if (s === 3 && p.warmth < 45 && !p.inDen) { bubble(x, y, [{ arrow: DEN_X < p.x ? -1 : 1 }, { pic: 'den' }, { pic: 'flame' }]); return; }
  if (G.hawk && G.hawk.ph !== 'leave' && !p.shaded) { bubble(x, y, [{ pic: 'shadow' }, { arrow: 1 }, { pic: 'tree' }]); return; }
  if (s === 3 && !tut.sniffed && G.seasonT > 2) { bubble(x, y, [{ key: Input.label('sniff') }, { pic: 'sniff' }]); return; }
  if (p.carry === MAX_CARRY && s !== 3 && G.stats.buried < 3) { bubble(x, y, [{ key: Input.label('dig') }, { pic: 'bury' }]); return; }
  if (p.carry > 0 && p.hunger < 35) { bubble(x, y, [{ key: Input.label('eat') }, { pic: 'eat' }, { pic: 'stomach' }]); return; }
  if (s === 3 && p.carry < MAX_CARRY && G.sniffT > 0 && nearestCache(p.x, 26)) bubble(x, y, [{ key: Input.label('dig') }, { pic: 'acorns' }]);
}

function drawDenArrow() {
  if (G.season !== 3) return;
  const s = scr(DEN_X, GROUND - 30);
  if (s.x > -20 && s.x < W + 20) return;
  const left = s.x < 0, x = left ? 30 : W - 30, y = 360;
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
// faceted panel to echo the low-poly world
function facetPanel(x, y, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,248,232,.9)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
  const c = 10;
  ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawHUD() {
  const p = G.player, s = G.season;
  ctx.textBaseline = 'middle';
  facetPanel(12, 12, 262, 104);
  const low = p.hunger < 25;
  const wob = low && !calm() ? Math.sin(G.t * 20) * 2 : 0;
  drawAcorn(ctx, 32 + wob, 34, 1.2);
  const bar = (x, y, w, h, f, col, pulse) => {
    ctx.fillStyle = 'rgba(43,29,20,.18)'; rr(ctx, x, y, w, h, 3); ctx.fill();
    ctx.fillStyle = col; ctx.globalAlpha = pulse ? 0.65 + 0.35 * Math.sin(G.t * 10) : 1;
    if (f > 0.01) { rr(ctx, x, y, Math.max(h, w * f), h, 3); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 3); ctx.stroke();
  };
  bar(50, 26, 170, 16, p.hunger / 100, barColor(p.hunger / 100), low);
  let mx = 236;
  if (s === 1 && !p.shaded) { drawSunIcon(ctx, mx, 34, 9, '#ffb81f'); mx += 22; }
  if (s === 3) { drawSnowflake(ctx, mx, 34, 8, '#3d6fa8', 2); mx += 22; }
  const winter = s === 3;
  ctx.globalAlpha = winter ? 1 : 0.35;
  drawFlame(ctx, 32, 62, 1);
  bar(50, 55, 170, 13, p.warmth / 100, winter ? (p.warmth < 30 ? (cb() ? '#f06d1f' : '#e5483b') : '#ff9a3d') : '#c9b8a0', winter && p.warmth < 30);
  ctx.globalAlpha = 1;
  if (winter && p.inDen) drawHouseIcon(ctx, 238, 64, 0.8);
  for (let i = 0; i < MAX_CARRY; i++) {
    const x = 34 + i * 30, y = 94;
    ctx.fillStyle = i < p.carry ? '#fff1d6' : 'rgba(43,29,20,.12)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    circ(ctx, x, y, 12);
    if (i < p.carry) drawAcorn(ctx, x, y + 1, 1.05);
  }
  const nx = 150, ny = 94;
  ctx.globalAlpha = G.sniffCd > 0 ? 0.45 : 1;
  drawNoseIcon(ctx, nx, ny, 0.8);
  ctx.globalAlpha = 1;
  if (G.sniffCd > 0) { ctx.strokeStyle = '#b07ad8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(nx + 4, ny, 15, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - G.sniffCd / 4)); ctx.stroke(); }
  ctx.fillStyle = OUT; ctx.textAlign = 'center';
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  if (!Input.touchMode) { ctx.fillText(Input.label('sniff'), nx + 26, ny + 1); ctx.fillText(Input.label('eat'), 120, ny + 1); }

  // season wheel
  const cx = W / 2, cy = 50, r = 34;
  ctx.fillStyle = 'rgba(255,248,232,.9)'; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5;
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
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
  const label = G.tutorial ? 'Tutorial' : `Year ${G.year}`;
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,248,232,.95)';
  ctx.strokeText(label, cx, cy + r + 22); ctx.fillStyle = OUT; ctx.fillText(label, cx, cy + r + 22);

  // goal tracker
  const gx = W - 200;
  facetPanel(gx, 12, 188, 74);
  const goal = G.endless ? Math.max(GOAL_WINTERS, G.winters + 1) : GOAL_WINTERS;
  const shown = Math.min(goal, 5);
  for (let i = 0; i < shown; i++) {
    const x = gx + 24 + i * 34, y = 34;
    ctx.fillStyle = i < G.winters ? '#dbe9fa' : 'rgba(43,29,20,.08)'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; circ(ctx, x, y, 13);
    drawSnowflake(ctx, x, y, 9, i < G.winters ? '#2f5f9e' : 'rgba(43,29,20,.3)', 2);
  }
  ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
  if (G.endless) { ctx.fillStyle = OUT; ctx.textAlign = 'left'; ctx.fillText('×' + G.winters, gx + 24 + shown * 34 - 8, 34); }
  drawTreeIcon(ctx, gx + 24, 80, 0.6, '#3fa34a');
  ctx.textAlign = 'left'; ctx.fillStyle = OUT;
  ctx.fillText('×' + G.trees.length, gx + 40, 66);
  drawMound(ctx, gx + 112, 72, 2, [110, 74, 44]);
  ctx.fillText('×' + G.caches.length, gx + 128, 66);
}

function drawBanner() {
  const b = G.banner; const t = b.t;
  if (t > 3) return;
  const a = t < 0.4 ? t / 0.4 : t > 2.4 ? (3 - t) / 0.6 : 1;
  ctx.save(); ctx.globalAlpha = clamp(a, 0, 1);
  const y = 160 + (calm() ? 0 : (1 - clamp(t / 0.4, 0, 1)) * -20);
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
