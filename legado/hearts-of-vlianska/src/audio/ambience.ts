// Ambiente del metro: aire que corre por los túneles, goteos, crujidos de
// metal, retumbos lejanos, aullidos y, en la partida, tiroteos a lo lejos
// cuando hay batallas a la vista.
import type { AudioEngine } from './engine';
import { bell, drum, metal, noiseHit } from './instruments';

export type AmbienceKind = 'off' | 'menu' | 'game';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Ambience {
  private e: AudioEngine;
  private bed: { stop: (at: number) => void } | null = null;
  kind: AmbienceKind = 'off';
  private timers = { drip: 0, creak: 0, rumble: 0, howl: 0, crackle: 0, shot: 0 };
  /** Intensidad de combate visible (0..1). */
  battle = 0;

  constructor(e: AudioEngine) {
    this.e = e;
  }

  setKind(k: AmbienceKind) {
    if (k === this.kind) return;
    this.kind = k;
    const now = this.e.now;
    this.bed?.stop(now);
    this.bed = k === 'off' ? null : this.startBed(k);
    this.timers = { drip: now + 1, creak: now + rnd(4, 10), rumble: now + rnd(10, 25), howl: now + rnd(30, 70), crackle: now, shot: now };
  }

  /** Lecho continuo: aire del túnel (y el fuego de la hoguera en el menú). */
  private startBed(k: AmbienceKind) {
    const ctx = this.e.ctx;
    const t = this.e.now;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + 3);
    out.connect(this.e.ambience.in);
    const nodes: AudioScheduledSourceNode[] = [];
    // Aire: ruido marrón con un filtro que "respira"
    const air = ctx.createBufferSource();
    air.buffer = this.e.noise('brown', 6);
    air.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 280;
    const airG = ctx.createGain();
    airG.gain.value = 0.16;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 120;
    lfo.connect(lfoG);
    lfoG.connect(lp.frequency);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.045;
    const lfo2G = ctx.createGain();
    lfo2G.gain.value = 0.07;
    lfo2.connect(lfo2G);
    lfo2G.connect(airG.gain);
    air.connect(lp);
    lp.connect(airG);
    airG.connect(out);
    nodes.push(air, lfo, lfo2);
    // Siseo alto muy tenue
    const hiss = ctx.createBufferSource();
    hiss.buffer = this.e.noise('pink', 4);
    hiss.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100;
    bp.Q.value = 0.4;
    const hissG = ctx.createGain();
    hissG.gain.value = 0.012;
    hiss.connect(bp);
    bp.connect(hissG);
    hissG.connect(out);
    nodes.push(hiss);
    if (k === 'menu') {
      // Rumor de la hoguera
      const fire = ctx.createBufferSource();
      fire.buffer = this.e.noise('pink', 5);
      fire.loop = true;
      const flp = ctx.createBiquadFilter();
      flp.type = 'lowpass';
      flp.frequency.value = 420;
      const fg = ctx.createGain();
      fg.gain.value = 0.05;
      fire.connect(flp);
      flp.connect(fg);
      fg.connect(out);
      nodes.push(fire);
    }
    for (const n of nodes) {
      if (n instanceof AudioBufferSourceNode) n.start(t, Math.random());
      else n.start(t);
    }
    return {
      stop: (at: number) => {
        out.gain.cancelScheduledValues(at);
        out.gain.setTargetAtTime(0.0001, at, 0.8);
        for (const n of nodes) n.stop(at + 5);
      },
    };
  }

  /** Programa los sonidos sueltos; llamar varias veces por segundo. */
  update() {
    if (this.kind === 'off') return;
    const e = this.e;
    const now = e.now;
    const T = this.timers;
    const dest = e.ambience.in;
    if (now >= T.drip) {
      const f = rnd(1600, 3400);
      const at = now + 0.05;
      const ctx = e.ctx;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f, at);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, at + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(rnd(0.02, 0.05), at + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
      const pan = (ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode }).createStereoPanner?.();
      o.connect(g);
      if (pan) {
        pan.pan.value = rnd(-0.8, 0.8);
        g.connect(pan);
        pan.connect(dest);
      } else g.connect(dest);
      o.start(at);
      o.stop(at + 0.15);
      T.drip = now + (Math.random() < 0.25 ? rnd(0.25, 0.6) : rnd(1.5, 6));
    }
    if (now >= T.creak) {
      metal(e, dest, now + 0.05, { freq: rnd(70, 140), gain: 0.022, decay: rnd(2, 3.5), pan: rnd(-0.9, 0.9) });
      noiseHit(e, dest, now + 0.05, { type: 'bandpass', freq: rnd(300, 700), sweepTo: rnd(150, 300), q: 6, dur: rnd(0.6, 1.2), gain: 0.02, pan: rnd(-0.8, 0.8) });
      T.creak = now + rnd(12, 32);
    }
    if (now >= T.rumble) {
      const ctx = e.ctx;
      const at = now + 0.05;
      const src = ctx.createBufferSource();
      src.buffer = e.noise('brown', 6);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 110;
      const g = ctx.createGain();
      const dur = rnd(2.5, 5);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(rnd(0.18, 0.32), at + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      src.connect(lp);
      lp.connect(g);
      g.connect(dest);
      src.start(at);
      src.stop(at + dur + 0.1);
      T.rumble = now + rnd(25, 70);
    }
    if (this.kind === 'game' && now >= T.howl) {
      this.howl(now + 0.05);
      T.howl = now + rnd(70, 160);
    }
    if (this.kind === 'menu' && now >= T.crackle) {
      noiseHit(e, dest, now + 0.02, { type: 'highpass', freq: rnd(1800, 4000), dur: rnd(0.01, 0.03), gain: rnd(0.015, 0.05), pan: rnd(0.05, 0.35) });
      T.crackle = now + (Math.random() < 0.3 ? rnd(0.03, 0.08) : rnd(0.15, 0.9));
    }
    if (this.kind === 'game' && this.battle > 0.01 && now >= T.shot) {
      this.gunfire(now + 0.02);
      T.shot = now + rnd(0.15, 0.9) / (0.4 + this.battle * 2);
    }
  }

  private howl(at: number) {
    const ctx = this.e.ctx;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    const base = rnd(170, 240);
    src.frequency.setValueAtTime(base, at);
    src.frequency.linearRampToValueAtTime(base * 1.5, at + 0.8);
    src.frequency.linearRampToValueAtTime(base * 0.8, at + 2.2);
    const vib = ctx.createOscillator();
    vib.frequency.value = 6;
    const vibG = ctx.createGain();
    vibG.gain.value = base * 0.03;
    vib.connect(vibG);
    vibG.connect(src.frequency);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(500, at);
    f1.frequency.linearRampToValueAtTime(850, at + 1);
    f1.Q.value = 5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.03, at + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 2.4);
    src.connect(f1);
    f1.connect(g);
    g.connect(this.e.ambience.verb);
    g.connect(this.e.ambience.in);
    src.start(at);
    vib.start(at);
    src.stop(at + 2.5);
    vib.stop(at + 2.5);
  }

  /** Disparos lejanos: tiros sueltos, ráfagas de ametralladora y explosiones. */
  private gunfire(at: number) {
    const e = this.e;
    const dest = e.ambience.in;
    const pan = rnd(-0.8, 0.8);
    const r = Math.random();
    if (r < 0.08) {
      drum(e, dest, at, { from: 70, to: 28, dur: 1.4, gain: 0.25 * (0.5 + this.battle), noise: 0.6, pan });
      noiseHit(e, dest, at, { type: 'lowpass', freq: 400, dur: 1.2, gain: 0.12, kind: 'brown', pan });
    } else if (r < 0.35) {
      const n = 3 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) noiseHit(e, dest, at + i * 0.075, { type: 'bandpass', freq: rnd(900, 1800), q: 1.2, dur: 0.06, gain: rnd(0.03, 0.06), pan });
    } else {
      noiseHit(e, dest, at, { type: 'bandpass', freq: rnd(1000, 2400), q: 1, dur: 0.07, gain: rnd(0.03, 0.07), pan });
    }
  }
}

/** Pequeña campana de radio usada por varios efectos. */
export function beep(e: AudioEngine, dest: AudioNode, at: number, midi: number, gain = 0.04) {
  bell(e, dest, midi, at, gain, { ratio: 1, index: 0.2, decay: 0.12 });
}
