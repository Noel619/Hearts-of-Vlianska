// Teoría musical mínima para la música generativa: notas MIDI, escalas,
// acordes y progresiones. Es lógica pura (sin Web Audio) y se prueba en tests.

export const midiToFreq = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const NAMES: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** "A3" → 57 */
export function noteToMidi(n: string): number {
  const m = n.match(/^([A-G][#b]?)(-?\d)$/);
  if (!m) throw new Error(`Nota no válida: ${n}`);
  return NAMES[m[1]] + (Number(m[2]) + 1) * 12;
}

export type ChordQuality = 'min' | 'maj' | '7' | 'min7' | 'sus4' | 'dim';

const INTERVALS: Record<ChordQuality, number[]> = {
  min: [0, 3, 7],
  maj: [0, 4, 7],
  '7': [0, 4, 7, 10],
  min7: [0, 3, 7, 10],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
};

export interface Chord {
  root: number; // clase de altura 0-11
  quality: ChordQuality;
}

/** Notas del acorde en una octava concreta (raíz en `octave`). */
export function chordNotes(c: Chord, octave: number): number[] {
  const base = c.root + (octave + 1) * 12;
  return INTERVALS[c.quality].map((i) => base + i);
}

/** Símbolo de acorde: "Am", "E7", "Dm", "G", "C", "Bbm"... */
export function parseChord(sym: string): Chord {
  const m = sym.match(/^([A-G][#b]?)(m7|m|7|sus4|dim)?$/);
  if (!m) throw new Error(`Acorde no válido: ${sym}`);
  const q = m[2];
  return { root: NAMES[m[1]], quality: q === 'm' ? 'min' : q === 'm7' ? 'min7' : q === '7' ? '7' : q === 'sus4' ? 'sus4' : q === 'dim' ? 'dim' : 'maj' };
}

/** Menor armónica (la del romance ruso): 0 2 3 5 7 8 11. */
export const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];
export const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10];

export function scaleNotes(root: number, scale: number[], low: number, high: number): number[] {
  const out: number[] = [];
  for (let m = low; m <= high; m++) if (scale.includes((((m - root) % 12) + 12) % 12)) out.push(m);
  return out;
}

/** Nota de la escala más cercana a `m`. */
export function nearestInScale(m: number, root: number, scale: number[]): number {
  for (let d = 0; d < 12; d++) {
    if (scale.includes((((m + d - root) % 12) + 12) % 12)) return m + d;
    if (scale.includes((((m - d - root) % 12) + 12) % 12)) return m - d;
  }
  return m;
}

/** Progresiones al estilo de la canción de andén (todas en La menor). */
export const MENU_PROGRESSIONS: string[][] = [
  ['Am', 'Am', 'Dm', 'Dm', 'G', 'G', 'C', 'E7'],
  ['Am', 'E7', 'Am', 'A7', 'Dm', 'Am', 'E7', 'Am'],
  ['Dm', 'Am', 'E7', 'Am', 'F', 'C', 'E7', 'Am'],
  ['Am', 'G', 'F', 'E7', 'Am', 'G', 'F', 'E7'],
];

/** Progresiones lentas para la paz, en varias tonalidades. */
export const PEACE_PROGRESSIONS: string[][] = [
  ['Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'E7'],
  ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'A7', 'Dm'],
  ['Em', 'C', 'G', 'D', 'Em', 'Am', 'B7', 'Em'],
];

/** Progresiones de guerra: pesadas y en menor. */
export const WAR_PROGRESSIONS: string[][] = [
  ['Dm', 'Dm', 'Bb', 'A7'],
  ['Dm', 'Gm', 'Bb', 'A7'],
  ['Cm', 'Ab', 'Fm', 'G7'],
];

export const TENSION_PROGRESSIONS: string[][] = [
  ['Am', 'Bb', 'Am', 'E7'],
  ['Em', 'F', 'Em', 'B7'],
];
