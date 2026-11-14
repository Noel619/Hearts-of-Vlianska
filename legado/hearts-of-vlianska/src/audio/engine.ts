// Motor de audio: contexto Web Audio, buses (música, ambiente, efectos,
// interfaz), compresor final y reverberación de túnel generada por código.

export interface Volumes {
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  muted: boolean;
}

export interface Bus {
  in: GainNode;
  /** Envío a la reverberación del túnel. */
  verb: GainNode;
}

export class AudioEngine {
  readonly ctx: BaseAudioContext;
  readonly master: GainNode;
  readonly music: Bus;
  readonly ambience: Bus;
  readonly sfx: Bus;
  readonly ui: Bus;
  private readonly reverb: ConvolverNode;
  private noiseCache = new Map<string, AudioBuffer>();

  constructor(ctx: BaseAudioContext) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.tunnelImpulse(3.4);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    this.reverb.connect(verbOut);
    verbOut.connect(this.master);
    const bus = (level: number, send: number): Bus => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(this.master);
      const v = ctx.createGain();
      v.gain.value = send;
      g.connect(v);
      v.connect(this.reverb);
      return { in: g, verb: v };
    };
    this.music = bus(0.7, 0.28);
    this.ambience = bus(0.6, 0.45);
    this.sfx = bus(0.8, 0.22);
    this.ui = bus(0.6, 0.05);
  }

  get now() {
    return this.ctx.currentTime;
  }

  /** Respuesta al impulso de un túnel largo: reflexiones tempranas y cola oscura. */
  private tunnelImpulse(seconds: number): AudioBuffer {
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let seed = 1234 + ch * 777;
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };
      // Reflexiones tempranas (paredes del túnel)
      const taps = [0.011, 0.019, 0.027, 0.041, 0.058, 0.073, 0.094];
      for (const t of taps) {
        const i = Math.floor((t + (ch ? 0.003 : 0)) * sr);
        if (i < len) d[i] += (rand() * 2 - 1) * 0.7 * Math.exp(-t * 18);
      }
      // Cola: ruido con caída exponencial y cada vez más oscuro
      let lp = 0;
      for (let i = Math.floor(0.02 * sr); i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t * (6.9 / seconds)) * Math.min(1, t * 40);
        const k = 0.35 + 0.6 * Math.exp(-t * 1.6);
        lp += (rand() * 2 - 1 - lp) * k;
        d[i] += lp * env * 0.55;
      }
    }
    return buf;
  }

  /** Ruido blanco, rosa o marrón en un búfer (en bucle para el ambiente). */
  noise(kind: 'white' | 'pink' | 'brown', seconds = 2): AudioBuffer {
    const key = `${kind}-${seconds}`;
    const hit = this.noiseCache.get(key);
    if (hit) return hit;
    const sr = this.ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      } else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    // Fundido en los extremos para que el bucle no haga clic
    const f = Math.min(len / 2, Math.floor(sr * 0.01));
    for (let i = 0; i < f; i++) {
      d[i] *= i / f;
      d[len - 1 - i] *= i / f;
    }
    this.noiseCache.set(key, buf);
    return buf;
  }

  setVolumes(v: Volumes) {
    const t = this.now;
    const ramp = (g: AudioParam, val: number) => {
      g.cancelScheduledValues(t);
      g.setTargetAtTime(val, t, 0.08);
    };
    ramp(this.master.gain, v.muted ? 0 : v.master);
    ramp(this.music.in.gain, v.music * 1.25);
    ramp(this.ambience.in.gain, v.ambience * 0.9);
    ramp(this.sfx.in.gain, v.sfx);
    ramp(this.ui.in.gain, v.sfx * 0.8);
  }
}
