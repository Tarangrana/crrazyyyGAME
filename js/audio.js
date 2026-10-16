'use strict';
// ---------------------------------------------------------------------------
// All audio is synthesised live with the Web Audio API: a generative score
// per season, a seasonal ambience bed (rain / cicadas / breeze / blizzard)
// and procedural sound effects. No audio files are loaded.
// ---------------------------------------------------------------------------

const Sound = (() => {
  let ctx = null, musicBus, sfxBus, ambBus, noiseBuf;
  let amb = null, curSeason = 2, nextT = 0, step = 0, mel = 5, musicOn = false;
  let musicVol = 0.6, sfxVol = 0.8, ducked = false;

  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  // one musical personality per season
  const MUSIC = [
    { bpm: 104, root: 62, scale: [0, 2, 4, 7, 9], wave: 'triangle', dens: 0.55, prog: [0, 7, 9, 5], third: 4, pad: false, bell: false, vol: 0.09 },
    { bpm: 80, root: 60, scale: [0, 2, 4, 6, 7, 9, 11], wave: 'sine', dens: 0.42, prog: [0, 2, 9, 7], third: 4, pad: true, bell: false, vol: 0.11 },
    { bpm: 92, root: 57, scale: [0, 2, 3, 5, 7, 9, 10], wave: 'triangle', dens: 0.5, prog: [0, 10, 5, 3], third: 3, pad: false, bell: false, vol: 0.09 },
    { bpm: 62, root: 57, scale: [0, 3, 5, 7, 10], wave: 'sine', dens: 0.34, prog: [0, 8, 3, 10], third: 3, pad: true, bell: true, vol: 0.1 },
  ];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC(); } catch (e) { ctx = null; return; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    musicBus = ctx.createGain(); sfxBus = ctx.createGain(); ambBus = ctx.createGain();
    musicBus.connect(comp); sfxBus.connect(comp); ambBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setVolumes(musicVol, sfxVol);
    buildAmbience();
  }

  function setVolumes(m, s) {
    musicVol = m; sfxVol = s;
    if (!ctx) return;
    const now = ctx.currentTime;
    musicBus.gain.setTargetAtTime(m * (ducked ? 0.3 : 1), now, 0.05);
    ambBus.gain.setTargetAtTime(Math.max(m, s) * 0.9 * (ducked ? 0.3 : 1), now, 0.05);
    sfxBus.gain.setTargetAtTime(s, now, 0.05);
  }
  function duck(on) { ducked = on; setVolumes(musicVol, sfxVol); }

  function buildAmbience() {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const filt = ctx.createBiquadFilter();
    const am = ctx.createGain(); am.gain.value = 1;
    const vol = ctx.createGain(); vol.gain.value = 0;
    src.connect(filt); filt.connect(am); am.connect(vol); vol.connect(ambBus);
    const lfo = ctx.createOscillator(); const lfoG = ctx.createGain(); lfoG.gain.value = 0;
    lfo.connect(lfoG); lfoG.connect(filt.frequency);
    const amo = ctx.createOscillator(); const amG = ctx.createGain(); amG.gain.value = 0;
    amo.connect(amG); amG.connect(am.gain);
    src.start(); lfo.start(); amo.start();
    amb = { filt, vol, lfo, lfoG, amo, amG, am, base: 0 };
    applyAmbience(curSeason);
  }

  function applyAmbience(s) {
    if (!amb) return;
    const now = ctx.currentTime, a = amb;
    const set = (p, v) => p.setTargetAtTime(v, now, 0.8);
    if (s === 0) { a.filt.type = 'highpass'; set(a.filt.frequency, 2600); a.filt.Q.value = 0.4; set(a.lfoG.gain, 0); set(a.amG.gain, 0); a.base = 0.09; }
    if (s === 1) { a.filt.type = 'bandpass'; set(a.filt.frequency, 6200); a.filt.Q.value = 7; set(a.lfoG.gain, 0); a.amo.frequency.value = 23; set(a.amG.gain, 0.55); a.am.gain.value = 0.45; a.base = 0.07; }
    if (s === 2) { a.filt.type = 'lowpass'; set(a.filt.frequency, 650); a.filt.Q.value = 1; a.lfo.frequency.value = 0.21; set(a.lfoG.gain, 280); set(a.amG.gain, 0); a.am.gain.value = 1; a.base = 0.12; }
    if (s === 3) { a.filt.type = 'bandpass'; set(a.filt.frequency, 520); a.filt.Q.value = 1.6; a.lfo.frequency.value = 0.13; set(a.lfoG.gain, 330); set(a.amG.gain, 0); a.am.gain.value = 1; a.base = 0.17; }
    set(a.vol.gain, a.base);
  }

  function gust(strength) {
    if (!amb) return;
    const now = ctx.currentTime;
    amb.vol.gain.setTargetAtTime(amb.base * (1 + strength * 1.8), now, 0.3);
    amb.vol.gain.setTargetAtTime(amb.base, now + 1.6, 0.6);
  }

  function setSeason(s) { curSeason = s; applyAmbience(s); }
  function startMusic(s) { init(); if (!ctx) return; curSeason = s; musicOn = true; nextT = ctx.currentTime + 0.1; applyAmbience(s); }
  function stopMusic() { musicOn = false; }

  // ---------- low level voices ----------
  function tone(freq, t, dur, type, vol, dest, attack = 0.01) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.02, dur));
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function sweep(f0, f1, dur, type, vol, delay = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, ftype, freq, vol, q = 1, delay = 0, f1 = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function notes(list, type, vol, gap, dur) {
    if (!ctx) return;
    const t = ctx.currentTime;
    list.forEach((m, i) => tone(midi(m), t + i * gap, dur, type, vol));
  }

  // ---------- generative music ----------
  function tick() {
    if (!ctx || !musicOn) return;
    const cfg = MUSIC[curSeason];
    const spb = 60 / cfg.bpm / 2;
    if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.2) { scheduleStep(cfg, nextT, spb); nextT += spb; step++; }
  }
  function scheduleStep(cfg, t, spb) {
    const bar = Math.floor(step / 8), pos = step % 8;
    const chord = cfg.prog[bar % 4];
    if (pos === 0) {
      tone(midi(cfg.root - 24 + chord), t, spb * 7, 'sine', 0.16, musicBus, 0.02);
      if (cfg.pad) {
        [0, cfg.third, 7].forEach(iv => tone(midi(cfg.root - 12 + chord + iv), t, spb * 8.5, 'sine', 0.035, musicBus, spb * 2));
      }
    }
    if (pos === 4 && !cfg.pad) tone(midi(cfg.root - 24 + chord + 7), t, spb * 3, 'sine', 0.09, musicBus, 0.02);
    if (Math.random() < cfg.dens || (pos === 0 && Math.random() < 0.8)) {
      const n = cfg.scale.length;
      mel += [-2, -1, -1, 1, 1, 2, 0][Math.random() * 7 | 0];
      mel = clamp(mel, 0, n * 2 - 1);
      const m = cfg.root + 12 * Math.floor(mel / n) + cfg.scale[mel % n];
      if (cfg.bell) {
        tone(midi(m), t, spb * 5, 'sine', cfg.vol, musicBus, 0.005);
        tone(midi(m) * 2.76, t, spb * 2, 'sine', cfg.vol * 0.25, musicBus, 0.005);
      } else tone(midi(m), t, spb * 1.7, cfg.wave, cfg.vol, musicBus, 0.01);
    }
    if (curSeason === 0 && Math.random() < 0.05) { // birdsong
      const f = rand(2200, 3200);
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        const tt = t + i * 0.09;
        o.type = 'sine'; o.frequency.setValueAtTime(f, tt); o.frequency.exponentialRampToValueAtTime(f * 1.3, tt + 0.06);
        g.gain.setValueAtTime(0.03, tt); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.07);
        o.connect(g); g.connect(ambBus); o.start(tt); o.stop(tt + 0.1);
      }
    }
  }

  // ---------- sound effects ----------
  const fx = {
    jump: () => sweep(300, 640, 0.12, 'square', 0.05),
    pickup: () => notes([81, 88], 'triangle', 0.12, 0.06, 0.12),
    bury: () => { noise(0.2, 'lowpass', 600, 0.4); sweep(160, 70, 0.15, 'sine', 0.2); },
    dig: () => { noise(0.1, 'bandpass', 1400, 0.3, 1.5); noise(0.1, 'bandpass', 1100, 0.25, 1.5, 0.09); },
    scrabble: () => noise(0.12, 'bandpass', 2600, 0.12, 2),
    eat: () => { for (let i = 0; i < 3; i++) noise(0.05, 'bandpass', 2400 + i * 300, 0.3, 2, i * 0.08); },
    berry: () => sweep(520, 980, 0.09, 'sine', 0.12),
    sniff: () => { noise(0.18, 'bandpass', 700, 0.22, 4, 0, 2200); noise(0.18, 'bandpass', 800, 0.22, 4, 0.2, 2600); },
    hawkCall: () => { sweep(1900, 1500, 0.35, 'sawtooth', 0.025); sweep(1700, 1300, 0.4, 'sawtooth', 0.02, 0.4); },
    screech: () => { sweep(2600, 900, 0.6, 'sawtooth', 0.06); noise(0.5, 'highpass', 3000, 0.08); },
    hit: () => { sweep(220, 60, 0.3, 'square', 0.14); noise(0.25, 'lowpass', 900, 0.3); },
    jay: () => { sweep(1500, 900, 0.1, 'square', 0.05); sweep(1500, 900, 0.1, 'square', 0.05, 0.14); },
    steal: () => sweep(900, 420, 0.25, 'triangle', 0.1),
    scare: () => { sweep(1800, 2600, 0.08, 'square', 0.05); sweep(1800, 2600, 0.08, 'square', 0.05, 0.1); sweep(1800, 2600, 0.08, 'square', 0.05, 0.2); },
    sprout: () => notes([72, 76, 79, 84, 88], 'triangle', 0.1, 0.09, 0.4),
    splash: () => noise(0.3, 'lowpass', 1600, 0.25),
    geese: () => { for (let i = 0; i < 4; i++) sweep(i % 2 ? 300 : 340, i % 2 ? 260 : 290, 0.16, 'square', 0.035, i * 0.22); },
    nope: () => sweep(180, 140, 0.12, 'square', 0.06),
    land: () => noise(0.06, 'lowpass', 400, 0.15),
    win: () => notes([67, 72, 76, 79, 84, 88, 91], 'triangle', 0.12, 0.12, 0.6),
    lose: () => notes([72, 69, 65, 62, 57], 'sine', 0.13, 0.22, 0.6),
    click: () => sweep(800, 1000, 0.04, 'triangle', 0.06),
    season: (s) => {
      const cfg = MUSIC[s];
      notes([cfg.root, cfg.root + cfg.third, cfg.root + 7, cfg.root + 12], cfg.bell ? 'sine' : 'triangle', 0.09, 0.07, 1.1);
    },
    warn: () => notes([76, 72], 'square', 0.04, 0.12, 0.12),
  };

  function play(name, arg) {
    if (!ctx) return;
    const f = fx[name]; if (f) f(arg);
  }

  return { init, setVolumes, duck, setSeason, startMusic, stopMusic, tick, play, gust };
})();
