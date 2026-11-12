// Ambiente del metro: el aire que corre por los túneles, goteos, crujidos de
// metal y retumbos lejanos; el rumor de la gente en las estaciones; aullidos y
// susurros donde nadie debería estar. Todo sintetizado.
import type { AudioEngine } from './engine';
import { bell, metal, noiseHit } from './instruments';

export type AmbienceKind = 'off' | 'menu' | 'estacion' | 'tunel' | 'peligro';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Ambience {
  private e: AudioEngine;
  private bed: { stop: (at: number) => void } | null = null;
  kind: AmbienceKind = 'off';
  private timers = { drip: 0, creak: 0, rumble: 0, howl: 0, crackle: 0, life: 0, whisper: 0 };
  /** Fuego cercano a la cámara (0..1): crepita. */
  fire = 0;
  /** Agua cercana (0..1): gotea más. */
  wet = 0;

  constructor(e: AudioEngine) {
    this.e = e;
  }

  setKind(k: AmbienceKind) {
    if (k === this.kind) return;
    this.kind = k;
    const now = this.e.now;
    this.bed?.stop(now);
    this.bed = k === 'off' ? null : this.startBed(k);
    this.timers = { drip: now + 1, creak: now + rnd(4, 10), rumble: now + rnd(10, 25), howl: now + rnd(20, 50), crackle: now, life: now + rnd(1, 3), whisper: now + rnd(8, 20) };
  }

  /** Lecho continuo: aire del túnel y, según el lugar, hoguera o gentío. */
  private startBed(k: AmbienceKind) {
    const ctx = this.e.ctx;
    const t = this.e.now;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(1, t + 3);
    out.connect(this.e.ambience.in);
    const nodes: AudioScheduledSourceNode[] = [];
    // Aire: ruido marrón con un filtro que «respira»
    const air = ctx.createBufferSource();
    air.buffer = this.e.noise('brown', 6);
    air.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = k === 'estacion' ? 220 : 280;
    const airG = ctx.createGain();
    airG.gain.value = k === 'estacion' ? 0.1 : k === 'peligro' ? 0.2 : 0.16;
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
    if (k === 'estacion') {
      // Gentío: dos bandas de ruido que suben y bajan como conversaciones lejanas
      for (const [freq, rate, gain] of [
        [420, 0.21, 0.03],
        [760, 0.33, 0.018],
      ]) {
        const src = ctx.createBufferSource();
        src.buffer = this.e.noise('pink', 5);
        src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        f.Q.value = 1.1;
        const g = ctx.createGain();
        g.gain.value = gain;
        const m = ctx.createOscillator();
        m.frequency.value = rate;
        const mg = ctx.createGain();
        mg.gain.value = gain * 0.6;
        m.connect(mg);
        mg.connect(g.gain);
        src.connect(f);
        f.connect(g);
        g.connect(out);
        nodes.push(src, m);
      }
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
    const station = this.kind === 'estacion';
    if (now >= T.drip) {
      if (!station || this.wet > 0.2) this.drip(now + 0.05);
      const k = 1 / (1 + this.wet * 3);
      T.drip = now + (Math.random() < 0.25 ? rnd(0.25, 0.6) : rnd(1.5, 6)) * (station ? 2.5 : 1) * k;
    }
    if (now >= T.creak) {
      metal(e, dest, now + 0.05, { freq: rnd(70, 140), gain: station ? 0.012 : 0.022, decay: rnd(2, 3.5), pan: rnd(-0.9, 0.9) });
      noiseHit(e, dest, now + 0.05, { type: 'bandpass', freq: rnd(300, 700), sweepTo: rnd(150, 300), q: 6, dur: rnd(0.6, 1.2), gain: station ? 0.01 : 0.02, pan: rnd(-0.8, 0.8) });
      T.creak = now + rnd(12, 32);
    }
    if (now >= T.rumble) {
      this.rumble(now + 0.05);
      T.rumble = now + rnd(25, 70);
    }
    if (this.kind === 'peligro' && now >= T.howl) {
      if (Math.random() < 0.5) this.howl(now + 0.05);
      else this.chitter(now + 0.05);
      T.howl = now + rnd(35, 90);
    }
    if (this.kind === 'peligro' && now >= T.whisper) {
      this.whisper(now + 0.05);
      T.whisper = now + rnd(25, 60);
    }
    const fire = this.kind === 'menu' ? 1 : this.fire;
    if (fire > 0.02 && now >= T.crackle) {
      noiseHit(e, dest, now + 0.02, { type: 'highpass', freq: rnd(1800, 4000), dur: rnd(0.01, 0.03), gain: rnd(0.012, 0.045) * fire, pan: rnd(-0.3, 0.35) });
      T.crackle = now + (Math.random() < 0.3 ? rnd(0.03, 0.08) : rnd(0.15, 0.9)) / (0.5 + fire * 0.5);
    }
    if (station && now >= T.life) {
      this.life(now + 0.05);
      T.life = now + rnd(1.2, 5);
    }
  }

  private drip(at: number) {
    const ctx = this.e.ctx;
    const f = rnd(1600, 3400);
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f, at);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, at + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(rnd(0.02, 0.05), at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.8, 0.8);
    o.connect(g);
    g.connect(pan);
    pan.connect(this.e.ambience.in);
    pan.connect(this.e.ambience.verb);
    o.start(at);
    o.stop(at + 0.15);
  }

  private rumble(at: number) {
    const ctx = this.e.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.e.noise('brown', 6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 110;
    const g = ctx.createGain();
    const dur = rnd(2.5, 5);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(rnd(0.16, 0.3), at + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.e.ambience.in);
    src.start(at);
    src.stop(at + dur + 0.1);
  }

  /** La vida del andén: martillazos, cacharros, toses, pasos y el altavoz. */
  private life(at: number) {
    const e = this.e;
    const dest = e.ambience.in;
    const pan = rnd(-0.8, 0.8);
    const r = Math.random();
    if (r < 0.22) {
      // Martillo sobre chapa, dos o tres golpes
      const n = 2 + Math.floor(Math.random() * 3);
      const f = rnd(380, 700);
      for (let i = 0; i < n; i++) metal(e, dest, at + i * rnd(0.28, 0.36), { freq: f, gain: rnd(0.008, 0.016), decay: 0.5, pan });
    } else if (r < 0.4) {
      // Cacharros: una taza contra otra
      bell(e, dest, 88 + Math.floor(rnd(0, 10)), at, 0.008, { ratio: 2.7, index: 2, decay: 0.3, pan });
    } else if (r < 0.62) {
      // Pasos sobre el andén
      const n = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) noiseHit(e, dest, at + i * 0.46, { type: 'lowpass', freq: 320, dur: 0.07, gain: 0.03, kind: 'brown', pan: pan + i * 0.04 });
    } else if (r < 0.74) {
      // Una tos
      for (let i = 0; i < 2; i++) noiseHit(e, dest, at + i * 0.22, { type: 'bandpass', freq: rnd(500, 800), q: 1.5, dur: 0.09, gain: 0.02, kind: 'pink', pan });
    } else if (r < 0.9) {
      // Una voz lejana: vocal filtrada que sube y baja
      this.voice(at, pan);
    } else {
      // El altavoz del andén: dos tonos y estática
      bell(e, dest, 76, at, 0.012, { ratio: 1, index: 0.3, decay: 0.7, pan: 0 });
      bell(e, dest, 72, at + 0.45, 0.012, { ratio: 1, index: 0.3, decay: 0.9, pan: 0 });
      noiseHit(e, dest, at + 1.0, { type: 'bandpass', freq: 1500, q: 2.5, dur: 1.2, gain: 0.006, pan: 0 });
    }
  }

  private voice(at: number, pan: number) {
    const ctx = this.e.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const base = rnd(110, 210);
    const syl = 2 + Math.floor(Math.random() * 4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    let t = at;
    for (let i = 0; i < syl; i++) {
      const d = rnd(0.11, 0.22);
      o.frequency.setValueAtTime(base * rnd(0.9, 1.15), t);
      f.frequency.setValueAtTime(rnd(450, 1100), t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.03);
      g.gain.linearRampToValueAtTime(0.0001, t + d);
      t += d + rnd(0.02, 0.08);
    }
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    o.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(this.e.ambience.in);
    p.connect(this.e.ambience.verb);
    o.start(at);
    o.stop(t + 0.1);
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

  /** Uñas sobre el hormigón: algo corre por el túnel. */
  private chitter(at: number) {
    const pan = rnd(-0.9, 0.9);
    const n = 6 + Math.floor(Math.random() * 10);
    let t = at;
    for (let i = 0; i < n; i++) {
      noiseHit(this.e, this.e.ambience.in, t, { type: 'bandpass', freq: rnd(2200, 4200), q: 5, dur: 0.012, gain: rnd(0.008, 0.02), pan: pan + i * 0.02 });
      t += rnd(0.03, 0.09);
    }
  }

  /** Voces en la oscuridad: ruido que casi forma palabras. */
  private whisper(at: number) {
    const ctx = this.e.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.e.noise('pink', 4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    let t = at;
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const d = rnd(0.12, 0.3);
      f.frequency.setValueAtTime(rnd(900, 2600), t);
      f.frequency.linearRampToValueAtTime(rnd(900, 2600), t + d);
      g.gain.linearRampToValueAtTime(0.03, t + 0.04);
      g.gain.linearRampToValueAtTime(0.0001, t + d);
      t += d + rnd(0.03, 0.12);
    }
    const p = ctx.createStereoPanner();
    p.pan.value = rnd(-0.9, 0.9);
    src.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(this.e.ambience.verb);
    p.connect(this.e.ambience.in);
    src.start(at, Math.random() * 2);
    src.stop(t + 0.2);
  }
}

/** Pequeña campana de radio usada por varios efectos. */
export function beep(e: AudioEngine, dest: AudioNode, at: number, midi: number, gain = 0.04) {
  bell(e, dest, midi, at, gain, { ratio: 1, index: 0.2, decay: 0.12 });
}
