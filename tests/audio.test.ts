import { describe, expect, it } from 'vitest';
import { chordNotes, HARMONIC_MINOR, MENU_PROGRESSIONS, midiToFreq, nearestInScale, noteToMidi, parseChord, PEACE_PROGRESSIONS, scaleNotes, TENSION_PROGRESSIONS, WAR_PROGRESSIONS } from '../src/audio/theory';

describe('teoría musical', () => {
  it('convierte notas y frecuencias', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('Bb2')).toBe(46);
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
  });

  it('interpreta los acordes de las progresiones', () => {
    expect(parseChord('Am')).toEqual({ root: 9, quality: 'min' });
    expect(parseChord('E7')).toEqual({ root: 4, quality: '7' });
    expect(parseChord('Bb')).toEqual({ root: 10, quality: 'maj' });
    expect(chordNotes(parseChord('Am'), 3)).toEqual([57, 60, 64]);
    expect(chordNotes(parseChord('E7'), 3)).toEqual([52, 56, 59, 62]);
    for (const set of [MENU_PROGRESSIONS, PEACE_PROGRESSIONS, WAR_PROGRESSIONS, TENSION_PROGRESSIONS]) {
      for (const prog of set) for (const sym of prog) expect(() => parseChord(sym)).not.toThrow();
    }
  });

  it('ajusta las melodías a la escala menor armónica', () => {
    const inScale = scaleNotes(9, HARMONIC_MINOR, 57, 69);
    expect(inScale).toEqual([57, 59, 60, 62, 64, 65, 68, 69]);
    for (let m = 50; m < 90; m++) {
      const n = nearestInScale(m, 9, HARMONIC_MINOR);
      expect(HARMONIC_MINOR).toContain((((n - 9) % 12) + 12) % 12);
      expect(Math.abs(n - m)).toBeLessThanOrEqual(2);
    }
  });
});
