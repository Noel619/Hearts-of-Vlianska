// Instrumentos sintetizados con Web Audio. Todo se genera en el navegador:
// guitarra (Karplus-Strong), bayán, cuerdas, bajo, campanas FM, percusión,
// metales y drones.
import type { AudioEngine } from './engine';
import { midiToFreq } from './theory';

type Dest = AudioNode;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function panNode(e: AudioEngine, pan: number, dest: Dest): AudioNode {
  const ctx = e.ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
  if (!pan || typeof ctx.createStereoPanner !== 'function') return dest;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(dest);
  return p;
}

/** Envolvente ADSR sencilla sobre un parámetro de ganancia. */
function env(g: AudioParam, when: number, peak: number, attack: number, hold: number, release: number) {
  g.setValueAtTime(0.0001, when);
  g.linearRampToValueAtTime(peak, when + attack);
  g.setValueAtTime(peak, when + attack + hold);
  g.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
}

// ---------------------------------------------------------------------------
// Guitarra: Karplus-Strong con afinación fina (paso-todo fraccional)
// ---------------------------------------------------------------------------

const ksCache = new Map<string, AudioBuffer>();

export interface PluckOpts {
  bright?: number; // 0..1
  decay?: number; // segundos hasta -60 dB
  dur?: number;
}

export function ksBuffer(e: AudioEngine, midi: number, o: PluckOpts = {}): AudioBuffer {
  const bright = o.bright ?? 0.5;
  const decay = o.decay ?? 3.2;
  const dur = o.dur ?? Math.min(4, decay * 0.9);
  const key = `${midi}|${bright.toFixed(2)}|${decay.toFixed(1)}|${dur.toFixed(1)}`;
  const hit = ksCache.get(key);
  if (hit) return hit;
  const sr = e.ctx.sampleRate;
  const freq = midiToFreq(midi);
  const len = Math.floor(sr * dur);
  const buf = e.ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const P = sr / freq;
  const N = Math.max(2, Math.floor(P - 0.6));
  const d = P - 0.5 - N;
  const C = (1 - d) / (1 + d);
  const dl = new Float32Array(N);
  // Excitación: ráfaga de ruido filtrada según el brillo (púa o dedo)
  let seed = (midi * 7919 + Math.round(bright * 100)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let lp = 0;
  const a = 0.08 + 0.8 * bright;
  let mean = 0;
  for (let i = 0; i < N; i++) {
    lp += (rand() * 2 - 1 - lp) * a;
    dl[i] = lp;
    mean += lp;
  }
  mean /= N;
  // Posición de la púa: filtro peine (quita armónicos como un pellizco real)
  const M = Math.max(1, Math.round(N * 0.13));
  const tmp = Float32Array.from(dl);
  let peak = 0;
  for (let i = 0; i < N; i++) {
    dl[i] = tmp[i] - mean - 0.6 * (tmp[(i + N - M) % N] - mean);
    peak = Math.max(peak, Math.abs(dl[i]));
  }
  for (let i = 0; i < N; i++) dl[i] /= peak || 1;
  const loss = Math.pow(10, -3 / (decay * freq));
  let ptr = 0;
  let prev = 0;
  let apx = 0;
  let apy = 0;
  for (let n = 0; n < len; n++) {
    const x = dl[ptr];
    out[n] = x;
    const l = 0.5 * (x + prev) * loss;
    prev = x;
    const y = C * l + apx - C * apy;
    apx = l;
    apy = y;
    dl[ptr] = y;
    ptr = ptr + 1 === N ? 0 : ptr + 1;
  }
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  ksCache.set(key, buf);
  return buf;
}

export function pluck(e: AudioEngine, dest: Dest, midi: number, when: number, gain = 0.3, o: PluckOpts & { pan?: number } = {}) {
  const src = e.ctx.createBufferSource();
  src.buffer = ksBuffer(e, midi, o);
  const g = e.ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(panNode(e, o.pan ?? 0, dest));
  src.start(when);
  return src;
}

/** Cuerpo de guitarra: resonancias graves y agudos suavizados. */
export function guitarBody(e: AudioEngine, dest: Dest): AudioNode {
  const ctx = e.ctx;
  const low = ctx.createBiquadFilter();
  low.type = 'peaking';
  low.frequency.value = 110;
  low.Q.value = 1.1;
  low.gain.value = 5;
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 230;
  mid.Q.value = 1.4;
  mid.gain.value = 3;
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf';
  air.frequency.value = 3200;
  air.gain.value = -5;
  low.connect(mid);
  mid.connect(air);
  air.connect(dest);
  return low;
}

// ---------------------------------------------------------------------------
// Bayán (acordeón ruso)
// ---------------------------------------------------------------------------

export function reed(e: AudioEngine, dest: Dest, midi: number, when: number, dur: number, gain = 0.08, pan = 0) {
  const ctx = e.ctx;
  const f = midiToFreq(midi);
  const out = ctx.createGain();
  env(out.gain, when, gain, 0.06, Math.max(0.01, dur - 0.1), 0.25);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = Math.min(4200, f * 6);
  filt.Q.value = 0.7;
  filt.connect(out);
  out.connect(panNode(e, pan, dest));
  // Vibrato suave del fuelle
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.2;
  const lfoG = ctx.createGain();
  lfoG.gain.value = f * 0.004;
  lfo.connect(lfoG);
  const voices: [OscillatorType, number, number][] = [
    ['sawtooth', -9, 0.5],
    ['square', 0, 0.35],
    ['sawtooth', 9, 0.5],
  ];
  for (const [type, cents, lvl] of voices) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = cents;
    lfoG.connect(o.frequency);
    const g = ctx.createGain();
    g.gain.value = lvl;
    o.connect(g);
    g.connect(filt);
    o.start(when);
    o.stop(when + dur + 0.4);
  }
  lfo.start(when);
  lfo.stop(when + dur + 0.4);
}

// ---------------------------------------------------------------------------
// Cuerdas / pad
// ---------------------------------------------------------------------------

export interface PadOpts {
  cutoff?: number;
  attack?: number;
  release?: number;
  gain?: number;
  detune?: number;
  type?: OscillatorType;
  pan?: number;
}

export function pad(e: AudioEngine, dest: Dest, notes: number[], when: number, dur: number, o: PadOpts = {}) {
  const ctx = e.ctx;
  const attack = o.attack ?? 1.2;
  const release = o.release ?? 2.2;
  const out = ctx.createGain();
  const peak = (o.gain ?? 0.05) / Math.sqrt(notes.length);
  out.gain.setValueAtTime(0.0001, when);
  out.gain.linearRampToValueAtTime(peak, when + attack);
  out.gain.setValueAtTime(peak, when + Math.max(attack, dur));
  out.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(attack, dur) + release);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = o.cutoff ?? 900;
  filt.Q.value = 0.9;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.18;
  const lfoG = ctx.createGain();
  lfoG.gain.value = (o.cutoff ?? 900) * 0.35;
  lfo.connect(lfoG);
  lfoG.connect(filt.frequency);
  filt.connect(out);
  out.connect(panNode(e, o.pan ?? 0, dest));
  const end = when + Math.max(attack, dur) + release + 0.1;
  for (const m of notes) {
    for (const cents of [-(o.detune ?? 7), o.detune ?? 7]) {
      const osc = ctx.createOscillator();
      osc.type = o.type ?? 'sawtooth';
      osc.frequency.value = midiToFreq(m);
      osc.detune.value = cents;
      osc.connect(filt);
      osc.start(when);
      osc.stop(end);
    }
  }
  lfo.start(when);
  lfo.stop(end);
}

/** Golpe corto de cuerdas (ostinato): una sierra por nota y un filtro que se cierra. */
export function stab(e: AudioEngine, dest: Dest, notes: number[], when: number, dur: number, gain = 0.05) {
  const ctx = e.ctx;
  const out = ctx.createGain();
  env(out.gain, when, gain / Math.sqrt(notes.length), 0.01, dur * 0.3, dur * 0.7);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 0.8;
  filt.frequency.setValueAtTime(2200, when);
  filt.frequency.exponentialRampToValueAtTime(700, when + dur);
  filt.connect(out);
  out.connect(dest);
  for (const m of notes) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midiToFreq(m);
    o.connect(filt);
    o.start(when);
    o.stop(when + dur * 1.1 + 0.05);
  }
}

// ---------------------------------------------------------------------------
// Bajo
// ---------------------------------------------------------------------------

export function bass(e: AudioEngine, dest: Dest, midi: number, when: number, dur: number, gain = 0.2) {
  const ctx = e.ctx;
  const f = midiToFreq(midi);
  const out = ctx.createGain();
  env(out.gain, when, gain, 0.01, dur * 0.3, dur * 0.9);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(f * 6, when);
  filt.frequency.exponentialRampToValueAtTime(f * 2, when + dur);
  filt.connect(out);
  out.connect(dest);
  for (const [type, mul, lvl] of [
    ['sine', 1, 0.9],
    ['triangle', 2, 0.25],
  ] as [OscillatorType, number, number][]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * mul;
    const g = ctx.createGain();
    g.gain.value = lvl;
    o.connect(g);
    g.connect(filt);
    o.start(when);
    o.stop(when + dur * 1.3 + 0.1);
  }
}

// ---------------------------------------------------------------------------
// Campana FM
// ---------------------------------------------------------------------------

export function bell(e: AudioEngine, dest: Dest, midi: number, when: number, gain = 0.07, o: { ratio?: number; index?: number; decay?: number; pan?: number } = {}) {
  const ctx = e.ctx;
  const f = midiToFreq(midi);
  const decay = o.decay ?? 2.6;
  const car = ctx.createOscillator();
  car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.frequency.value = f * (o.ratio ?? 3.5);
  const modG = ctx.createGain();
  const idx = (o.index ?? 2.2) * f;
  modG.gain.setValueAtTime(idx, when);
  modG.gain.exponentialRampToValueAtTime(idx * 0.05 + 0.01, when + decay * 0.7);
  mod.connect(modG);
  modG.connect(car.frequency);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, when);
  out.gain.linearRampToValueAtTime(gain, when + 0.004);
  out.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  car.connect(out);
  out.connect(panNode(e, o.pan ?? 0, dest));
  car.start(when);
  mod.start(when);
  car.stop(when + decay + 0.1);
  mod.stop(when + decay + 0.1);
}

// ---------------------------------------------------------------------------
// Percusión
// ---------------------------------------------------------------------------

export function noiseHit(e: AudioEngine, dest: Dest, when: number, o: { type?: BiquadFilterType; freq?: number; q?: number; dur?: number; gain?: number; kind?: 'white' | 'pink' | 'brown'; pan?: number; sweepTo?: number }) {
  const ctx = e.ctx;
  const src = ctx.createBufferSource();
  src.buffer = e.noise(o.kind ?? 'white', 2);
  const filt = ctx.createBiquadFilter();
  filt.type = o.type ?? 'bandpass';
  filt.frequency.setValueAtTime(o.freq ?? 1000, when);
  if (o.sweepTo) filt.frequency.exponentialRampToValueAtTime(o.sweepTo, when + (o.dur ?? 0.2));
  filt.Q.value = o.q ?? 0.8;
  const g = ctx.createGain();
  const dur = o.dur ?? 0.2;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.2, when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(panNode(e, o.pan ?? 0, dest));
  const offset = Math.random() * 1.5;
  src.start(when, offset);
  src.stop(when + dur + 0.05);
}

/** Tambor grave tipo taiko / bombo con barrido de tono. */
export function drum(e: AudioEngine, dest: Dest, when: number, o: { from?: number; to?: number; dur?: number; gain?: number; noise?: number; pan?: number } = {}) {
  const ctx = e.ctx;
  const dur = o.dur ?? 0.5;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(o.from ?? 140, when);
  osc.frequency.exponentialRampToValueAtTime(o.to ?? 48, when + dur * 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(o.gain ?? 0.5, when + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(panNode(e, o.pan ?? 0, dest));
  osc.start(when);
  osc.stop(when + dur + 0.05);
  if ((o.noise ?? 0.3) > 0) noiseHit(e, dest, when, { type: 'lowpass', freq: 900, dur: 0.08, gain: (o.gain ?? 0.5) * (o.noise ?? 0.3), kind: 'pink', pan: o.pan });
}

export function snare(e: AudioEngine, dest: Dest, when: number, gain = 0.18, pan = 0) {
  noiseHit(e, dest, when, { type: 'bandpass', freq: 1900, q: 0.7, dur: 0.18, gain, pan });
  drum(e, dest, when, { from: 220, to: 160, dur: 0.1, gain: gain * 0.8, noise: 0, pan });
}

export function hat(e: AudioEngine, dest: Dest, when: number, gain = 0.05, open = false, pan = 0.2) {
  noiseHit(e, dest, when, { type: 'highpass', freq: 7500, q: 0.5, dur: open ? 0.25 : 0.045, gain, pan });
}

/** Golpe metálico inharmónico (yunque, tubería, metal del túnel). */
export function metal(e: AudioEngine, dest: Dest, when: number, o: { freq?: number; gain?: number; decay?: number; pan?: number } = {}) {
  const base = o.freq ?? 180;
  for (const [ratio, lvl] of [
    [1, 1],
    [2.76, 0.6],
    [5.4, 0.35],
    [8.93, 0.2],
  ]) {
    bell(e, dest, 69 + 12 * Math.log2((base * ratio) / 440), when, (o.gain ?? 0.08) * lvl, { ratio: 1.41, index: 1.2, decay: (o.decay ?? 1.4) / Math.sqrt(ratio), pan: o.pan });
  }
}

// ---------------------------------------------------------------------------
// Metales y drones
// ---------------------------------------------------------------------------

export function brass(e: AudioEngine, dest: Dest, notes: number[], when: number, dur: number, gain = 0.07) {
  const ctx = e.ctx;
  const out = ctx.createGain();
  const peak = gain / Math.sqrt(notes.length);
  env(out.gain, when, peak, 0.05, dur * 0.4, dur * 0.8);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.Q.value = 1.4;
  filt.frequency.setValueAtTime(300, when);
  filt.frequency.linearRampToValueAtTime(2600, when + 0.08);
  filt.frequency.exponentialRampToValueAtTime(900, when + dur);
  filt.connect(out);
  out.connect(dest);
  for (const m of notes) {
    for (const c of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiToFreq(m);
      o.detune.value = c;
      o.connect(filt);
      o.start(when);
      o.stop(when + dur * 1.3 + 0.1);
    }
  }
}

/** Drone continuo: se devuelve una función para apagarlo. */
export function drone(e: AudioEngine, dest: Dest, midi: number, when: number, gain = 0.05): (at: number) => void {
  const ctx = e.ctx;
  const f = midiToFreq(midi);
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, when);
  out.gain.linearRampToValueAtTime(gain, when + 4);
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 260;
  filt.Q.value = 2;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 140;
  lfo.connect(lfoG);
  lfoG.connect(filt.frequency);
  filt.connect(out);
  out.connect(dest);
  const oscs: OscillatorNode[] = [];
  for (const [type, mul, cents, lvl] of [
    ['sawtooth', 1, -5, 0.5],
    ['sawtooth', 1, 5, 0.5],
    ['sine', 0.5, 0, 0.8],
    ['triangle', 1.5, 3, 0.2],
  ] as [OscillatorType, number, number, number][]) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f * mul;
    o.detune.value = cents;
    const g = ctx.createGain();
    g.gain.value = lvl;
    o.connect(g);
    g.connect(filt);
    o.start(when);
    oscs.push(o);
  }
  lfo.start(when);
  oscs.push(lfo);
  return (at: number) => {
    out.gain.cancelScheduledValues(at);
    out.gain.setTargetAtTime(0.0001, at, 1.2);
    for (const o of oscs) o.stop(at + 6);
  };
}
