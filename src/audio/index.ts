// Sistema de sonido del juego: música generativa, ambiente y efectos.
// El contexto de audio solo se crea tras la primera interacción del jugador
// (lo exigen los navegadores); hasta entonces todo es silencioso.
import { Ambience, type AmbienceKind } from './ambience';
import { AudioEngine, type Volumes } from './engine';
import { MusicDirector, stinger, type Mood, type Stinger } from './music';
import { playSfx, type Sfx, type SfxPos } from './sfx';

export type { AmbienceKind, Mood, Sfx, SfxPos, Stinger, Volumes };

const STORE = 'sombras-vlianska:audio';
const DEFAULTS: Volumes = { master: 0.8, music: 0.55, ambience: 0.6, sfx: 0.8, muted: false };

function loadVolumes(): Volumes {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Volumes>) };
  } catch {
    // Sin almacenamiento: valores por defecto
  }
  return { ...DEFAULTS };
}

class AudioSystem {
  engine: AudioEngine | null = null;
  private music: MusicDirector | null = null;
  private ambience: Ambience | null = null;
  private timer = 0;
  private wantMood: Mood = 'silencio';
  private wantAmbience: AmbienceKind = 'off';
  private wantFire = 0;
  private wantWet = 0;
  volumes: Volumes = loadVolumes();
  private lastSfx = new Map<string, number>();
  private listeners = new Set<() => void>();

  get unlocked() {
    return this.engine !== null && (this.engine.ctx as AudioContext).state === 'running';
  }

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  /** Crea o reanuda el contexto. Debe llamarse desde un gesto del usuario. */
  unlock() {
    const W = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? W.webkitAudioContext;
    if (!Ctor) return;
    if (!this.engine) {
      try {
        const ctx = new Ctor({ latencyHint: 'playback' });
        this.engine = new AudioEngine(ctx);
        this.music = new MusicDirector(this.engine);
        this.ambience = new Ambience(this.engine);
        this.engine.setVolumes(this.volumes);
        this.timer = window.setInterval(() => this.update(), 90);
        ctx.addEventListener('statechange', () => this.notify());
      } catch {
        this.engine = null;
        return;
      }
    }
    const ctx = this.engine.ctx as AudioContext;
    if (ctx.state === 'suspended') void ctx.resume().then(() => this.notify());
    this.music?.setMood(this.wantMood);
    this.ambience?.setKind(this.wantAmbience);
    this.notify();
  }

  private update() {
    if (!this.engine || (this.engine.ctx as AudioContext).state !== 'running') return;
    if (this.ambience) {
      this.ambience.fire = this.wantFire;
      this.ambience.wet = this.wantWet;
    }
    this.music?.update();
    this.ambience?.update();
  }

  setMood(m: Mood) {
    this.wantMood = m;
    this.music?.setMood(m);
  }

  get mood() {
    return this.wantMood;
  }

  setAmbience(k: AmbienceKind) {
    this.wantAmbience = k;
    this.ambience?.setKind(k);
  }

  /** Fuego y agua cerca de la cámara (0..1). */
  setSurroundings(fire: number, wet: number) {
    this.wantFire = fire;
    this.wantWet = wet;
  }

  setIntensity(v: number) {
    this.music?.setIntensity(v);
  }

  setVolumes(v: Volumes) {
    this.volumes = v;
    this.engine?.setVolumes(v);
    try {
      localStorage.setItem(STORE, JSON.stringify(v));
    } catch {
      // Sin almacenamiento
    }
    this.notify();
  }

  /** Efecto de sonido (con un mínimo de separación para no saturar). */
  play(name: Sfx, pos?: SfxPos, minGap = 0.045) {
    if (!this.engine || this.volumes.muted || (this.engine.ctx as AudioContext).state !== 'running') return;
    const now = this.engine.now;
    if (now - (this.lastSfx.get(name) ?? -1) < minGap) return;
    this.lastSfx.set(name, now);
    playSfx(this.engine, name, pos);
  }

  stinger(kind: Stinger) {
    if (!this.engine || this.volumes.muted) return;
    stinger(this.engine, kind);
  }

  dispose() {
    window.clearInterval(this.timer);
  }
}

export const audio = new AudioSystem();
