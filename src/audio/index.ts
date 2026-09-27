// Sistema de sonido del juego: música generativa, ambiente y efectos.
// El contexto de audio solo se crea tras la primera interacción del jugador
// (lo exigen los navegadores); hasta entonces todo es silencioso.
import { Ambience, type AmbienceKind } from './ambience';
import { AudioEngine, type Volumes } from './engine';
import { MusicDirector, stinger, type Mood, type Stinger } from './music';
import { playSfx, type Sfx } from './sfx';

export type { Mood, Sfx, Stinger, Volumes };

class AudioSystem {
  engine: AudioEngine | null = null;
  private music: MusicDirector | null = null;
  private ambience: Ambience | null = null;
  private timer = 0;
  private wantMood: Mood = 'silence';
  private wantAmbience: AmbienceKind = 'off';
  private volumes: Volumes = { master: 0.8, music: 0.6, ambience: 0.6, sfx: 0.8, muted: false };
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
        (ctx as AudioContext).addEventListener?.('statechange', () => this.notify());
      } catch {
        this.engine = null;
        return;
      }
    }
    const ctx = this.engine.ctx as AudioContext;
    if (ctx.state === 'suspended') void ctx.resume().then(() => this.notify());
    this.applyWanted();
    this.notify();
  }

  private applyWanted() {
    this.music?.setMood(this.wantMood);
    this.ambience?.setKind(this.wantAmbience);
  }

  private update() {
    if (!this.engine || (this.engine.ctx as AudioContext).state !== 'running') return;
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

  setBattle(level: number) {
    if (this.ambience) this.ambience.battle = level;
  }

  setIntensity(v: number) {
    this.music?.setIntensity(v);
  }

  setVolumes(v: Volumes) {
    this.volumes = v;
    this.engine?.setVolumes(v);
  }

  /** Efecto de sonido (con un mínimo de separación para no saturar). */
  play(name: Sfx, minGap = 0.04) {
    if (!this.engine || this.volumes.muted) return;
    const now = this.engine.now;
    if (now - (this.lastSfx.get(name) ?? -1) < minGap) return;
    this.lastSfx.set(name, now);
    playSfx(this.engine, name);
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
