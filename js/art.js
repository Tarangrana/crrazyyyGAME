'use strict';
// ---------------------------------------------------------------------------
// Shared constants, math helpers, palettes and procedural drawing primitives.
// Every sprite in the game is drawn here with flat fills + a dark outline so
// the whole game shares one consistent hand-made style (no external assets).
// ---------------------------------------------------------------------------

const W = 960, H = 540, GROUND = 440, WORLD_W = 3200;
const STREAM_X0 = 2150, STREAM_X1 = 2330, STREAM_BED = GROUND + 55;
const DEN_X = 600;
const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'];
const OUT = '#2b1d14';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const TAU = Math.PI * 2;

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb(c, a) { return a === undefined ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function shade(c, f) { return [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)]; }

const PAL_SRC = [
  { // spring
    sky0: '#7ec8ef', sky1: '#e4f6ff', far: '#a9d9b0', mid: '#7fc47f', ground: '#6e4a2c', grass: '#71c552',
    leaf: '#8fdc68', leaf2: '#b5ea7f', leaf3: '#f6a9c9', water: '#4f9fdc', bush: '#5fb04e', sun: '#fff3b0', cloud: '#ffffff'
  },
  { // summer
    sky0: '#3f9fe6', sky1: '#fff1c2', far: '#93c38a', mid: '#55a052', ground: '#7a5631', grass: '#45a03c',
    leaf: '#2f8c3a', leaf2: '#3fa34a', leaf3: '#267a31', water: '#4a92cc', bush: '#2f8a3a', sun: '#ffe066', cloud: '#ffffff'
  },
  { // fall
    sky0: '#e8975e', sky1: '#fde2b6', far: '#cf9563', mid: '#b4643c', ground: '#5f3c22', grass: '#b98e40',
    leaf: '#e47a2c', leaf2: '#d24a2a', leaf3: '#f2b83a', water: '#5f8aa6', bush: '#a8552c', sun: '#ffc27a', cloud: '#fff4e4'
  },
  { // winter
    sky0: '#566b8e', sky1: '#cfdaea', far: '#b7c4d8', mid: '#93a4bd', ground: '#7d6a5a', grass: '#f4f8fc',
    leaf: '#ffffff', leaf2: '#ffffff', leaf3: '#ffffff', water: '#bfe2f1', bush: '#e9f0f7', sun: '#f4f6fb', cloud: '#e3e9f2'
  },
];
const PALS = PAL_SRC.map(p => { const o = {}; for (const k in p) o[k] = hex(p[k]); return o; });
function blendPal(a, b, t) { const o = {}; for (const k in a) o[k] = mixc(a[k], b[k], t); return o; }

const WHEEL_COL = ['#8fdc68', '#ffd34d', '#e47a2c', '#bcd4ea'];

// ---------- primitive helpers ----------
function ell(c, x, y, rx, ry, stroke = true) {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); c.fill(); if (stroke) c.stroke();
}
function circ(c, x, y, r, stroke = true) {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU); c.fill(); if (stroke) c.stroke();
}
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
}

// ---------- items & icons ----------
function drawAcorn(c, x, y, s = 1, rot = 0) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s);
  c.lineWidth = 1.6; c.strokeStyle = OUT; c.lineJoin = 'round';
  c.fillStyle = '#c98a3f'; ell(c, 0, 2, 5.5, 7);
  c.fillStyle = 'rgba(255,255,255,.35)'; ell(c, -2, 3, 1.3, 2.5, false);
  c.fillStyle = '#7a4b22';
  c.beginPath(); c.ellipse(0, -2.5, 7.2, 4.6, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(0, -7); c.lineTo(1.8, -10.5); c.stroke();
  c.restore();
}

function drawBerry(c, x, y, r, cb) {
  c.lineWidth = 1.4; c.strokeStyle = OUT;
  c.fillStyle = cb ? '#2f6fe0' : '#d8344a';
  circ(c, x, y, r);
  c.fillStyle = 'rgba(255,255,255,.75)';
  if (cb) { // shape cue for colour-blind mode: a little white star/cross
    c.fillRect(x - r * 0.15, y - r * 0.6, r * 0.3, r * 1.2);
    c.fillRect(x - r * 0.6, y - r * 0.15, r * 1.2, r * 0.3);
  } else circ(c, x - r * 0.35, y - r * 0.35, r * 0.28, false);
}

function drawMushroom(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.lineWidth = 1.6; c.strokeStyle = OUT;
  c.fillStyle = '#f3e6cf'; rr(c, -3, -9, 6, 9, 2); c.fill(); c.stroke();
  c.fillStyle = '#c8553d';
  c.beginPath(); c.ellipse(0, -9, 9, 7, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fff'; circ(c, -3.5, -12, 1.6, false); circ(c, 3, -13, 1.3, false); circ(c, 0.5, -10, 1, false);
  c.restore();
}

function drawMound(c, x, y, n, col, alpha = 1) {
  c.save(); c.globalAlpha = alpha;
  const w = 11 + Math.min(n, 6) * 1.6;
  c.lineWidth = 1.6; c.strokeStyle = OUT;
  c.fillStyle = rgb(shade(col, 0.72));
  c.beginPath(); c.ellipse(x, y, w, 7, 0, Math.PI, TAU); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = rgb(shade(col, 0.95));
  circ(c, x - w * 0.35, y - 3, 1.6, false); circ(c, x + w * 0.25, y - 4, 1.3, false);
  // a little twig marker
  c.strokeStyle = '#4a3020'; c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(x + 2, y - 5); c.lineTo(x + 5, y - 13); c.moveTo(x + 4, y - 10); c.lineTo(x + 8, y - 11); c.stroke();
  c.restore();
}

function drawSnowflake(c, x, y, r, col = '#ffffff', lw = 2) {
  c.save(); c.translate(x, y); c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    c.rotate(Math.PI / 3);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -r);
    c.moveTo(0, -r * 0.55); c.lineTo(-r * 0.25, -r * 0.8); c.moveTo(0, -r * 0.55); c.lineTo(r * 0.25, -r * 0.8);
    c.stroke();
  }
  c.restore();
}

function drawSunIcon(c, x, y, r, col = '#ffd34d') {
  c.save(); c.translate(x, y);
  c.strokeStyle = col; c.lineWidth = Math.max(1.5, r * 0.18); c.lineCap = 'round';
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.beginPath(); c.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke(); }
  c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 1.5; circ(c, 0, 0, r * 0.5);
  c.restore();
}

function drawLeafIcon(c, x, y, r, col = '#e47a2c') {
  c.save(); c.translate(x, y); c.rotate(-0.6);
  c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r * 0.9, -r * 0.2, 0, r); c.quadraticCurveTo(-r * 0.9, -r * 0.2, 0, -r); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(0, -r * 0.7); c.lineTo(0, r * 1.25); c.stroke();
  c.restore();
}

function drawFlowerIcon(c, x, y, r, col = '#f6a9c9') {
  c.save(); c.translate(x, y);
  c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU - Math.PI / 2; circ(c, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42); }
  c.fillStyle = '#ffe066'; circ(c, 0, 0, r * 0.35);
  c.restore();
}

function seasonIcon(c, s, x, y, r) {
  if (s === 0) drawFlowerIcon(c, x, y, r);
  else if (s === 1) drawSunIcon(c, x, y, r, '#ffb81f');
  else if (s === 2) drawLeafIcon(c, x, y, r);
  else drawSnowflake(c, x, y, r, '#3d6fa8', Math.max(1.5, r * 0.16));
}

function drawSaplingIcon(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = OUT; c.lineWidth = 1.6;
  c.strokeStyle = '#5a3b22'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -16); c.stroke();
  c.lineWidth = 1.5; c.strokeStyle = OUT; c.fillStyle = '#7fd35a';
  c.beginPath(); c.ellipse(-6, -16, 7, 4, -0.5, 0, TAU); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(6, -19, 7, 4, 0.5, 0, TAU); c.fill(); c.stroke();
  c.restore();
}

function drawTreeIcon(c, x, y, s = 1, col = '#3fa34a') {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.strokeStyle = OUT; c.lineWidth = 1.6;
  c.fillStyle = '#6b4528'; c.beginPath(); c.moveTo(-4, 0); c.lineTo(4, 0); c.lineTo(2.5, -16); c.lineTo(-2.5, -16); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = col;
  c.beginPath(); c.moveTo(1, -20); c.arc(-7, -20, 8, 0, TAU); c.moveTo(15, -20); c.arc(7, -20, 8, 0, TAU); c.moveTo(10, -28); c.arc(0, -28, 10, 0, TAU);
  c.lineWidth = 3; c.stroke(); c.fill();
  c.restore();
}

function drawFlame(c, x, y, s = 1, col = '#ff8a3d') {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(0, -10); c.quadraticCurveTo(8, -2, 6, 4); c.quadraticCurveTo(0, 10, -6, 4); c.quadraticCurveTo(-8, -3, 0, -10); c.fill(); c.stroke();
  c.fillStyle = '#ffe066'; c.beginPath(); c.moveTo(0, -3); c.quadraticCurveTo(4, 2, 3, 4); c.quadraticCurveTo(0, 7, -3, 4); c.quadraticCurveTo(-3, 1, 0, -3); c.fill();
  c.restore();
}

function drawNoseIcon(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#c9692b'; c.strokeStyle = OUT; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(-4, 2, 8, 6, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#3a2416'; circ(c, 4, 1, 2.2, false);
  c.strokeStyle = '#b07ad8'; c.lineWidth = 2; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(8 + i * 5, -6 + i * 2); c.quadraticCurveTo(10 + i * 5, -10 + i * 2, 12 + i * 5, -6 + i * 2); c.stroke(); }
  c.restore();
}

function drawHouseIcon(c, x, y, s = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  c.fillStyle = '#7a5232'; c.strokeStyle = OUT; c.lineWidth = 1.6;
  rr(c, -10, -12, 20, 14, 4); c.fill(); c.stroke();
  c.fillStyle = '#2a1a10'; c.beginPath(); c.ellipse(0, -3, 4.5, 5.5, 0, Math.PI, TAU); c.lineTo(4.5, 2); c.lineTo(-4.5, 2); c.closePath(); c.fill();
  c.restore();
}

function drawKeyCap(c, x, y, label) {
  // label may be a key name, or '#acorn' / '#sniff' for touch glyphs
  c.save(); c.font = 'bold 13px "Trebuchet MS", "Segoe UI", sans-serif';
  const wide = label.length > 2 ? Math.max(30, c.measureText(label).width + 14) : 26;
  c.fillStyle = 'rgba(0,0,0,.25)'; rr(c, x - wide / 2 + 1, y - 11, wide, 24, 5); c.fill();
  c.fillStyle = '#fffaf0'; c.strokeStyle = OUT; c.lineWidth = 1.6; rr(c, x - wide / 2, y - 13, wide, 24, 5); c.fill(); c.stroke();
  if (label === '#acorn') drawAcorn(c, x, y, 0.95);
  else if (label === '#sniff') drawNoseIcon(c, x - 4, y + 1, 0.6);
  else { c.fillStyle = OUT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, x, y); }
  c.restore();
  return wide;
}

// ---------- creatures ----------
function drawSquirrel(c, x, y, face, t, o) {
  o = o || {};
  c.save(); c.translate(x, y); c.scale(face, 1);
  if (o.sleep) { c.scale(1.05, 0.8); }
  const run = o.run;
  const bob = run ? -Math.abs(Math.sin(t * 16)) * 3 : Math.sin(t * 3) * 0.6;
  const fur = o.cold ? '#b97a52' : '#c9692b', furD = o.cold ? '#8f5a3c' : '#99481c', belly = '#f4cf9c';
  c.lineWidth = 2; c.strokeStyle = OUT; c.lineJoin = 'round'; c.lineCap = 'round';
  if (o.dig) c.rotate(0.32);
  // tail
  c.save(); c.translate(-11, -12 + bob);
  let tr = Math.sin(t * (run ? 14 : 2.5)) * 0.12 + (o.air ? -0.35 : 0) + (o.dig ? -0.3 : 0);
  if (o.sleep) tr = 0.9;
  c.rotate(tr);
  c.fillStyle = furD; c.beginPath();
  c.moveTo(2, 2); c.bezierCurveTo(-16, 4, -26, -10, -20, -26); c.bezierCurveTo(-15, -38, 0, -40, 4, -31);
  c.bezierCurveTo(7, -24, -3, -22, -6, -17); c.bezierCurveTo(-9, -10, -3, -5, 4, -5); c.closePath(); c.fill(); c.stroke();
  c.strokeStyle = 'rgba(255,210,160,.55)'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(-3, -1); c.bezierCurveTo(-17, -3, -21, -14, -16, -25); c.stroke();
  if (o.cold) { c.fillStyle = '#fff'; circ(c, -18, -27, 3, false); circ(c, -12, -33, 2.5, false); }
  c.restore();
  c.lineWidth = 2; c.strokeStyle = OUT;
  // legs
  const la = run ? Math.sin(t * 16) * 5 : 0;
  c.fillStyle = furD; ell(c, -6 + la, -3, 6, 3.5); ell(c, 8 - la, -2.5, 3.5, 2.5);
  // body
  c.fillStyle = fur; ell(c, 0, -12 + bob, 14, 10);
  c.fillStyle = belly; ell(c, 5, -9 + bob, 7, 5, false);
  // ear + head
  const hy = -20 + bob;
  c.fillStyle = fur; c.beginPath(); c.moveTo(8.5, hy - 5); c.lineTo(10, hy - 15); c.lineTo(15, hy - 5); c.closePath(); c.fill(); c.stroke();
  ell(c, 13, hy, 8.5, 7.5);
  if (o.cheeks) {
    const ch = o.cheeks + (o.eat ? Math.sin(t * 30) * 0.5 : 0);
    c.fillStyle = belly; ell(c, 15, hy + 4, 2.6 + ch * 1.7, 2.2 + ch * 1.3);
  }
  if (o.sleep) { c.beginPath(); c.moveTo(14, hy - 1); c.lineTo(18, hy - 1); c.stroke(); }
  else {
    c.fillStyle = '#1a120c'; circ(c, 16, hy - 1.5, 1.9, false);
    c.fillStyle = '#fff'; circ(c, 16.6, hy - 2.2, 0.6, false);
  }
  c.fillStyle = '#3a2416'; circ(c, 21.2, hy + 1, 1.5, false);
  if (o.cold) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(13, hy - 6.5, 6, 2.2, 0, Math.PI, TAU); c.fill(); }
  c.restore();
}

function drawHawk(c, x, y, t, dive, face) {
  c.save(); c.translate(x, y); c.scale(face, 1);
  c.lineWidth = 2; c.strokeStyle = OUT; c.lineJoin = 'round';
  if (dive) c.rotate(0.9);
  const up = dive ? 0.25 : 0.55 + Math.sin(t * 7) * 0.55;
  const wing = (shadeF) => {
    c.fillStyle = shadeF;
    c.beginPath(); c.moveTo(-4, -2);
    c.quadraticCurveTo(-8, -32 * up - 2, -34, -26 * up - 6);
    c.quadraticCurveTo(-16, -6, 6, -1); c.closePath(); c.fill(); c.stroke();
  };
  c.save(); c.translate(6, 0); wing('#4a301f'); c.restore();
  c.fillStyle = '#6a452b';
  c.beginPath(); c.moveTo(-14, 0); c.lineTo(-28, -6); c.lineTo(-28, 6); c.closePath(); c.fill(); c.stroke();
  ell(c, 0, 0, 17, 6.5);
  c.fillStyle = '#efe4cf'; ell(c, 14, -2, 6, 5);
  c.fillStyle = '#f2c12e'; c.beginPath(); c.moveTo(19, -3); c.lineTo(25, 0); c.lineTo(19, 1); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#111'; circ(c, 15.5, -3, 1.3, false);
  wing('#6a452b');
  c.restore();
}

function drawJay(c, x, y, t, flying, face) {
  c.save(); c.translate(x, y); c.scale(face, 1);
  c.lineWidth = 1.8; c.strokeStyle = OUT; c.lineJoin = 'round';
  c.fillStyle = '#2f6fbf';
  c.beginPath(); c.moveTo(-8, -6); c.lineTo(-20, -10); c.lineTo(-19, -3); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#3b86de'; ell(c, 0, -7, 10, 7);
  c.fillStyle = '#f2f5fa'; ell(c, 3, -4, 6, 3.5, false);
  c.fillStyle = '#3b86de';
  c.beginPath(); c.moveTo(4, -15); c.lineTo(1, -24); c.lineTo(10, -16); c.closePath(); c.fill(); c.stroke();
  ell(c, 8, -13, 6, 5.5);
  c.strokeStyle = '#111'; c.lineWidth = 1.5; c.beginPath(); c.arc(8, -11, 5.5, 0.3, 2.6); c.stroke();
  c.fillStyle = '#111'; circ(c, 10, -14, 1.3, false);
  c.fillStyle = '#333'; c.beginPath(); c.moveTo(13, -13); c.lineTo(18, -12); c.lineTo(13, -10.5); c.closePath(); c.fill();
  c.strokeStyle = OUT; c.lineWidth = 1.8;
  c.fillStyle = '#1f5aa8';
  const up = flying ? Math.sin(t * 22) : -0.3;
  c.beginPath(); c.moveTo(-4, -9); c.quadraticCurveTo(-8, -9 - 14 * up, -14, -8 - 12 * up); c.quadraticCurveTo(-6, -4, 4, -6); c.closePath(); c.fill(); c.stroke();
  if (!flying) { c.strokeStyle = '#222'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-1, 0); c.lineTo(-2, 3); c.moveTo(3, 0); c.lineTo(3, 3); c.stroke(); }
  c.restore();
}

function drawGoose(c, x, y, t) {
  c.save(); c.translate(x, y); c.strokeStyle = 'rgba(40,30,30,.75)'; c.lineWidth = 2; c.lineCap = 'round';
  const f = Math.sin(t * 6) * 4;
  c.beginPath(); c.moveTo(-8, -f); c.lineTo(0, 0); c.lineTo(8, -f); c.stroke();
  c.restore();
}
