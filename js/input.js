'use strict';
// ---------------------------------------------------------------------------
// Settings persistence + remappable keyboard, gamepad and touch input.
// ---------------------------------------------------------------------------

const ACTIONS = ['left', 'right', 'jump', 'dig', 'pause'];
const ACTION_NAMES = {
  left: 'Move left', right: 'Move right', jump: 'Jump / swim', dig: 'Bury / dig up', pause: 'Pause',
};
const DEFAULT_BINDS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], jump: ['ArrowUp', 'KeyW', 'Space'],
  dig: ['ArrowDown', 'KeyS', 'KeyE'], pause: ['Escape', 'KeyP'],
};
const cloneBinds = () => JSON.parse(JSON.stringify(DEFAULT_BINDS));

const Settings = {
  KEY: 'forgottenAcorns.settings',
  data: null,
  defaults() {
    return { difficulty: 'normal', colorblind: false, reduceMotion: false, hints: true, music: 0.6, sfx: 0.8, binds: cloneBinds() };
  },
  load() {
    const d = this.defaults();
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY) || 'null');
      if (s && typeof s === 'object') {
        for (const k of Object.keys(d)) if (k !== 'binds' && typeof s[k] === typeof d[k]) d[k] = s[k];
        if (s.binds && typeof s.binds === 'object') {
          for (const a of ACTIONS) if (Array.isArray(s.binds[a]) && s.binds[a].length) d.binds[a] = s.binds[a].filter(x => typeof x === 'string');
        }
      }
    } catch (e) { /* storage unavailable: defaults */ }
    if (!['easy', 'normal', 'hard'].includes(d.difficulty)) d.difficulty = 'normal';
    this.data = d;
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ } },
};
Settings.load();

const KEY_LABELS = {
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'SPACE', Escape: 'ESC', Enter: 'ENTER',
  ShiftLeft: 'SHIFT', ShiftRight: 'SHIFT', ControlLeft: 'CTRL', ControlRight: 'CTRL', AltLeft: 'ALT', AltRight: 'ALT',
  Tab: 'TAB', Backspace: 'BKSP', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\',
};
function keyLabel(code) {
  if (!code) return '?';
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'N' + code.slice(6);
  return code.toUpperCase().slice(0, 6);
}
const TOUCH_GLYPH = { left: '◀', right: '▶', jump: '▲', dig: '▼', eat: '#acorn', sniff: '#sniff', pause: 'II' };

const Input = (() => {
  const down = new Set(), pressed = new Set();
  const vDown = {}, vPressed = new Set(), pad = {}, padPrev = {};
  let capture = null;
  const api = { gameActive: false, touchMode: false };

  const boundAction = code => ACTIONS.find(a => Settings.data.binds[a].includes(code));

  addEventListener('keydown', e => {
    if (capture) { e.preventDefault(); e.stopPropagation(); const cb = capture; capture = null; cb(e.code); return; }
    if (api.gameActive && boundAction(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    down.add(e.code);
    api.touchMode = false;
  }, true);
  addEventListener('keyup', e => { down.delete(e.code); });
  addEventListener('blur', () => { down.clear(); for (const k in vDown) vDown[k] = false; });

  api.held = a => Settings.data.binds[a].some(c => down.has(c)) || !!vDown[a] || !!pad[a];
  api.hit = a => Settings.data.binds[a].some(c => pressed.has(c)) || vPressed.has(a) || (!!pad[a] && !padPrev[a]);
  api.vPress = a => { if (!vDown[a]) vPressed.add(a); vDown[a] = true; };
  api.vRelease = a => { vDown[a] = false; };
  api.endFrame = () => { pressed.clear(); vPressed.clear(); };
  api.captureNext = cb => { capture = cb; };
  api.cancelCapture = () => { capture = null; };
  api.label = a => (api.touchMode ? TOUCH_GLYPH[a] : keyLabel(Settings.data.binds[a][0]));

  api.poll = () => {
    for (const a of ACTIONS) { padPrev[a] = pad[a]; pad[a] = false; }
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gps) {
      if (!gp) continue;
      const ax = gp.axes[0] || 0;
      const b = i => gp.buttons[i] && gp.buttons[i].pressed;
      if (ax < -0.4 || b(14)) pad.left = true;
      if (ax > 0.4 || b(15)) pad.right = true;
      if (b(0) || b(12)) pad.jump = true;
      if (b(1) || b(2) || b(13)) pad.dig = true;
      if (b(9)) pad.pause = true;
    }
  };

  // rebinding: the chosen key is removed from any other action
  api.rebind = (action, code) => {
    for (const a of ACTIONS) Settings.data.binds[a] = Settings.data.binds[a].filter(c => c !== code);
    Settings.data.binds[action] = [code];
    for (const a of ACTIONS) if (!Settings.data.binds[a].length) Settings.data.binds[a] = DEFAULT_BINDS[a].filter(c => !ACTIONS.some(b => Settings.data.binds[b].includes(c))).slice(0, 1);
    Settings.save();
  };
  return api;
})();
