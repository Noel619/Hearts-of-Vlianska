// Música generativa. Cada ambiente (menú, paz, tensión, guerra) compone sus
// compases sobre la marcha a partir de progresiones de acordes, con variación
// aleatoria para que nunca suene igual. Los cambios de ambiente se funden.
import type { AudioEngine } from './engine';
import { bass, bell, brass, drone, drum, guitarBody, hat, metal, pad, pluck, reed, snare, stab } from './instruments';
import { chordNotes, HARMONIC_MINOR, MENU_PROGRESSIONS, nearestInScale, parseChord, PEACE_PROGRESSIONS, TENSION_PROGRESSIONS, WAR_PROGRESSIONS, type Chord } from './theory';

export type Mood = 'silence' | 'menu' | 'peace' | 'tension' | 'war';

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const jitter = (s = 0.012) => (Math.random() - 0.5) * s;

abstract class Track {
  readonly out: GainNode;
  nextBar: number;
  bar = 0;
  stopped = false;
  intensity = 0.5;
  abstract readonly barDur: number;
  protected e: AudioEngine;

  constructor(e: AudioEngine, start: number) {
    this.e = e;
    this.out = e.ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(e.music.in);
    this.nextBar = start;
  }

  fadeIn(at: number, secs = 3, level = 1) {
    this.out.gain.cancelScheduledValues(at);
    this.out.gain.setValueAtTime(this.out.gain.value, at);
    this.out.gain.linearRampToValueAtTime(level, at + secs);
  }

  fadeOut(at: number, secs = 3) {
    this.out.gain.cancelScheduledValues(at);
    this.out.gain.setValueAtTime(this.out.gain.value, at);
    this.out.gain.linearRampToValueAtTime(0, at + secs);
    this.stopped = true;
    this.onStop(at + secs);
  }

  protected onStop(_at: number) {}

  /** Programa todos los compases que empiecen antes de `until`. */
  schedule(until: number) {
    while (!this.stopped && this.nextBar < until) {
      this.scheduleBar(this.nextBar, this.bar);
      this.nextBar += this.barDur;
      this.bar++;
    }
  }

  protected abstract scheduleBar(t: number, bar: number): void;
}

// ---------------------------------------------------------------------------
// Menú: canción de andén (guitarra, bajo, bayán y cuerdas)
// ---------------------------------------------------------------------------

class MenuTrack extends Track {
  readonly barDur = (60 / 74) * 4;
  private prog: Chord[] = MENU_PROGRESSIONS[0].map(parseChord);
  private body: AudioNode;
  private melodyOn = false;
  private lastMel = 69;

  constructor(e: AudioEngine, start: number) {
    super(e, start);
    this.body = guitarBody(e, this.out);
  }

  protected scheduleBar(t: number, bar: number) {
    if (bar % 8 === 0) {
      this.prog = (bar === 0 ? MENU_PROGRESSIONS[1] : pick(MENU_PROGRESSIONS)).map(parseChord);
      this.melodyOn = bar >= 8 && Math.random() < 0.6;
    }
    const chord = this.prog[bar % 8];
    const beat = this.barDur / 4;
    const trip = beat / 3;
    const [r, third, fifth] = chordNotes(chord, 3);
    const root = r > 57 ? r - 12 : r;
    const bassNote = root - 12;
    const alt = bassNote + 7 > 52 ? bassNote - 5 : bassNote + 7;
    const up = r + 12;
    // Arpegio en tresillos (punteo de guitarra)
    const pattern: [number, number][] = [
      [bassNote, 0.34],
      [fifth, 0.16],
      [up, 0.18],
      [third + 12, 0.15],
      [up, 0.13],
      [fifth, 0.13],
      [alt, 0.28],
      [fifth, 0.15],
      [up, 0.16],
      [third + 12, 0.15],
      [up, 0.13],
      [third, 0.13],
    ];
    const lastBar = bar % 8 === 7;
    pattern.forEach(([m, g], i) => {
      if (lastBar && i >= 9) return;
      pluck(this.e, this.body, m, t + i * trip + jitter(), g * (0.85 + Math.random() * 0.3), { bright: m < 50 ? 0.35 : 0.55, decay: m < 50 ? 4 : 2.6, pan: m < 50 ? -0.15 : 0.2 });
    });
    if (lastBar) {
      // Rasgueo final de la frase
      [bassNote, r, third, fifth, up].forEach((m, k) => pluck(this.e, this.body, m, t + 9 * trip + k * 0.018, 0.14, { bright: 0.7, decay: 3 }));
    }
    // Bajo suave y cuerdas
    bass(this.e, this.out, bassNote - 12, t, beat * 1.8, 0.07);
    pad(this.e, this.out, [r, third, fifth], t, this.barDur, { gain: 0.022, cutoff: 700, attack: 0.9, release: 1.8 });
    // Melodía de bayán en menor armónica
    if (this.melodyOn && bar % 8 < 7) {
      const tones = chordNotes(chord, 4);
      const steps = [0, 1, 2, 3].filter(() => Math.random() < 0.8);
      for (const s of steps) {
        const target = Math.random() < 0.6 ? pick(tones) : this.lastMel + pick([-2, -1, 1, 2]);
        let m = nearestInScale(target, 9, HARMONIC_MINOR);
        while (m > 79) m -= 12;
        while (m < 64) m += 12;
        this.lastMel = m;
        const dur = s === 3 || Math.random() < 0.3 ? beat * 1.5 : beat * 0.9;
        reed(this.e, this.out, m, t + s * beat + jitter(0.02), dur, 0.032, 0.15);
      }
    }
    if (bar % 4 === 3 && Math.random() < 0.5) bell(this.e, this.out, up + 12, t + beat * 3, 0.02, { decay: 3.5, pan: -0.3 });
  }
}

// ---------------------------------------------------------------------------
// Paz: ambiental, lenta, guitarra escasa y campanas
// ---------------------------------------------------------------------------

class PeaceTrack extends Track {
  readonly barDur = 4.2;
  private prog: Chord[] = PEACE_PROGRESSIONS[0].map(parseChord);
  private body: AudioNode;
  private stopDrone: ((at: number) => void) | null = null;

  constructor(e: AudioEngine, start: number) {
    super(e, start);
    this.body = guitarBody(e, this.out);
  }

  protected onStop(at: number) {
    this.stopDrone?.(at);
  }

  protected scheduleBar(t: number, bar: number) {
    if (bar % 8 === 0) {
      this.prog = pick(PEACE_PROGRESSIONS).map(parseChord);
      this.stopDrone?.(t);
      const root = this.prog[0].root + 24;
      this.stopDrone = drone(this.e, this.out, root < 33 ? root + 12 : root, t, 0.035);
    }
    const chord = this.prog[bar % 8];
    const [r, third, fifth] = chordNotes(chord, 3);
    pad(this.e, this.out, [r - 12, r, third, fifth], t, this.barDur, { gain: 0.035, cutoff: 850, attack: 1.8, release: 3 });
    if (Math.random() < 0.65) {
      const eighth = this.barDur / 8;
      const notes = [r - 12, fifth, r + 12, third + 12, fifth + 12, third + 12, r + 12, fifth];
      notes.forEach((m, i) => {
        if (Math.random() < 0.15 && i > 0) return;
        pluck(this.e, this.body, m, t + i * eighth + jitter(0.02), i === 0 ? 0.22 : 0.11, { bright: 0.4, decay: 3.4, pan: 0.15 });
      });
    }
    if (Math.random() < 0.45) {
      const pent = [0, 3, 5, 7, 10].map((i) => chord.root + 72 + i);
      bell(this.e, this.out, pick(pent), t + this.barDur * pick([0.25, 0.5, 0.75]), 0.025, { decay: 4, pan: pick([-0.4, 0.4]) });
    }
    if (bar % 16 >= 8 && Math.random() < 0.3) reed(this.e, this.out, fifth + 12, t + this.barDur * 0.5, this.barDur * 0.9, 0.022, -0.2);
  }
}

// ---------------------------------------------------------------------------
// Tensión: drone, pulso de bajo, latido y campanas disonantes
// ---------------------------------------------------------------------------

class TensionTrack extends Track {
  readonly barDur = (60 / 84) * 4;
  private prog: Chord[] = TENSION_PROGRESSIONS[0].map(parseChord);
  private stopDrone: ((at: number) => void) | null = null;

  protected onStop(at: number) {
    this.stopDrone?.(at);
  }

  protected scheduleBar(t: number, bar: number) {
    if (bar % 4 === 0) {
      if (bar % 8 === 0) {
        this.prog = pick(TENSION_PROGRESSIONS).map(parseChord);
        this.stopDrone?.(t);
        this.stopDrone = drone(this.e, this.out, this.prog[0].root + 24, t, 0.05);
      }
    }
    const chord = this.prog[bar % 4];
    const beat = this.barDur / 4;
    const [r, third, fifth] = chordNotes(chord, 2);
    for (let i = 0; i < 8; i++) {
      bass(this.e, this.out, i % 4 === 3 ? fifth - 12 : r - 12, t + i * (beat / 2), beat * 0.4, i % 4 === 0 ? 0.11 : 0.06);
      hat(this.e, this.out, t + i * (beat / 2) + beat / 4, 0.012 + (i % 2) * 0.01);
    }
    // Latido
    drum(this.e, this.out, t, { from: 70, to: 40, dur: 0.35, gain: 0.22, noise: 0.05 });
    drum(this.e, this.out, t + beat * 0.45, { from: 60, to: 38, dur: 0.3, gain: 0.14, noise: 0.05 });
    pad(this.e, this.out, [r + 12, third + 12, fifth + 12], t, this.barDur, { gain: 0.03, cutoff: 480, attack: 1.5, release: 2 });
    if (bar % 2 === 1) {
      const base = r + 36;
      bell(this.e, this.out, base, t + beat * 1.5, 0.028, { ratio: 2.4, decay: 3, pan: -0.3 });
      bell(this.e, this.out, base + pick([1, 6, 11]), t + beat * 2.5, 0.022, { ratio: 2.4, decay: 3, pan: 0.3 });
    }
  }
}

// ---------------------------------------------------------------------------
// Guerra: tambores, ostinato de cuerdas, metales y golpes de hierro
// ---------------------------------------------------------------------------

class WarTrack extends Track {
  readonly barDur = (60 / 100) * 4;
  private prog: Chord[] = WAR_PROGRESSIONS[0].map(parseChord);

  protected scheduleBar(t: number, bar: number) {
    if (bar % 4 === 0) this.prog = pick(WAR_PROGRESSIONS).map(parseChord);
    const chord = this.prog[bar % 4];
    const beat = this.barDur / 4;
    const s16 = beat / 4;
    const I = this.intensity;
    // Tambores: patrón de taiko con redoble cada cuatro compases
    const big = [0, 7, 10, 14];
    const small = [3, 6, 12, 15];
    for (const i of big) drum(this.e, this.out, t + i * s16 + jitter(0.006), { from: 130, to: 45, dur: 0.6, gain: i === 0 ? 0.42 : 0.3, noise: 0.35, pan: -0.1 });
    for (const i of small) if (Math.random() < 0.5 + I * 0.4) drum(this.e, this.out, t + i * s16, { from: 200, to: 110, dur: 0.25, gain: 0.14, noise: 0, pan: 0.25 });
    snare(this.e, this.out, t + beat, 0.1);
    snare(this.e, this.out, t + beat * 3, 0.12);
    if (bar % 4 === 3) for (let i = 8; i < 16; i++) snare(this.e, this.out, t + i * s16, 0.04 + (i - 8) * 0.012, 0.15);
    // Ostinato de cuerdas en corcheas
    const [r, , fifth] = chordNotes(chord, 3);
    const figure = [r, r, fifth, r, r + 12, fifth, r, fifth];
    figure.forEach((m, i) => stab(this.e, this.out, [m - 12, m], t + i * (beat / 2), beat * 0.34, 0.05));
    for (let i = 0; i < 4; i++) bass(this.e, this.out, r - 24, t + i * beat, beat * 0.7, 0.1);
    // Metales en los cambios de acorde
    if (I > 0.35 || bar % 2 === 0) brass(this.e, this.out, chordNotes(chord, 3), t + jitter(0.005), beat * 1.6, 0.05 + I * 0.03);
    if (I > 0.6 && bar % 2 === 1) brass(this.e, this.out, chordNotes(chord, 4), t + beat * 2.5, beat * 0.9, 0.035);
    if (Math.random() < 0.15 + I * 0.25) metal(this.e, this.out, t + beat * pick([1.5, 2.5, 3.5]), { freq: pick([140, 170, 210]), gain: 0.05, decay: 1.6, pan: pick([-0.6, 0.6]) });
  }
}

// ---------------------------------------------------------------------------
// Director: decide qué suena y funde los cambios
// ---------------------------------------------------------------------------

export class MusicDirector {
  private tracks: Track[] = [];
  mood: Mood = 'silence';
  private e: AudioEngine;

  constructor(e: AudioEngine) {
    this.e = e;
  }

  setMood(m: Mood, fade = 3) {
    if (m === this.mood) return;
    this.mood = m;
    const now = this.e.now;
    for (const tr of this.tracks) if (!tr.stopped) tr.fadeOut(now, fade);
    if (m === 'silence') return;
    const start = now + 0.12;
    const tr = m === 'menu' ? new MenuTrack(this.e, start) : m === 'peace' ? new PeaceTrack(this.e, start) : m === 'tension' ? new TensionTrack(this.e, start) : new WarTrack(this.e, start);
    tr.fadeIn(now, m === 'war' ? 1.5 : fade, m === 'war' ? 1.5 : 1.9);
    this.tracks.push(tr);
  }

  setIntensity(v: number) {
    for (const tr of this.tracks) tr.intensity = Math.max(0, Math.min(1, v));
  }

  /** Programa las notas de los próximos segundos (llamar con frecuencia). */
  update(lookahead = 0.6) {
    const until = this.e.now + lookahead;
    for (const tr of this.tracks) tr.schedule(until);
    // Se descartan las pistas ya fundidas
    this.tracks = this.tracks.filter((tr) => !(tr.stopped && tr.out.gain.value < 0.001 && this.e.now > tr.nextBar));
  }
}

// ---------------------------------------------------------------------------
// Fanfarrias cortas
// ---------------------------------------------------------------------------

export type Stinger = 'focus' | 'research' | 'war' | 'peace' | 'victory' | 'defeat' | 'capture' | 'loss';

export function stinger(e: AudioEngine, kind: Stinger) {
  const t = e.now + 0.03;
  const out = e.ctx.createGain();
  out.gain.value = kind === 'research' ? 2.6 : 1.6;
  out.connect(e.music.in);
  const body = guitarBody(e, out);
  switch (kind) {
    case 'focus': {
      [57, 64, 69, 72, 76].forEach((m, i) => pluck(e, body, m, t + i * 0.025, 0.2, { bright: 0.7, decay: 3 }));
      bell(e, out, 81, t + 0.15, 0.05, { decay: 3 });
      bell(e, out, 88, t + 0.35, 0.035, { decay: 3 });
      break;
    }
    case 'research':
      [72, 76, 79, 84].forEach((m, i) => bell(e, out, m, t + i * 0.09, 0.045, { ratio: 2, index: 1.4, decay: 2.2 }));
      break;
    case 'war':
      drum(e, out, t, { from: 110, to: 38, dur: 1.2, gain: 0.6, noise: 0.5 });
      brass(e, out, [50, 57, 62, 65], t + 0.05, 1.4, 0.12);
      drum(e, out, t + 0.45, { from: 110, to: 38, dur: 1.2, gain: 0.5, noise: 0.5 });
      metal(e, out, t + 0.9, { freq: 150, gain: 0.08, decay: 2.5 });
      break;
    case 'peace':
      pad(e, out, [57, 61, 64, 69], t, 2.2, { gain: 0.08, cutoff: 1600, attack: 0.4, release: 2.5 });
      bell(e, out, 81, t + 0.4, 0.04, { decay: 4 });
      break;
    case 'capture':
      drum(e, out, t, { from: 150, to: 50, dur: 0.6, gain: 0.35 });
      brass(e, out, [57, 64, 69], t + 0.02, 0.7, 0.08);
      break;
    case 'loss':
      brass(e, out, [53, 56, 60], t, 1.2, 0.07);
      drum(e, out, t, { from: 80, to: 36, dur: 1, gain: 0.3 });
      break;
    case 'victory': {
      const chords = [
        [57, 61, 64, 69],
        [62, 66, 69, 74],
        [64, 68, 71, 76],
        [69, 73, 76, 81],
      ];
      chords.forEach((c, i) => brass(e, out, c, t + i * 0.55, i === 3 ? 2.4 : 0.5, 0.1));
      for (let i = 0; i < 6; i++) drum(e, out, t + i * 0.275, { from: 140, to: 50, dur: 0.5, gain: 0.3 });
      break;
    }
    case 'defeat':
      [57, 55, 53, 52].forEach((m, i) => reed(e, out, m, t + i * 0.9, 1.1, 0.05));
      pad(e, out, [45, 48, 52], t, 4, { gain: 0.06, cutoff: 500, attack: 1, release: 3 });
      break;
  }
}
