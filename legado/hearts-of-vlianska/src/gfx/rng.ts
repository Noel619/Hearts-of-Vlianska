// Aleatoriedad determinista para los gráficos procedurales.
// Cada sprite se genera a partir de una semilla, así que siempre sale igual.

export type Rand = () => number;

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generador mulberry32: rápido y suficiente para gráficos. */
export function rng(seed: number | string): Rand {
  let a = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const range = (r: Rand, min: number, max: number) => min + r() * (max - min);
export const irange = (r: Rand, min: number, max: number) => Math.floor(min + r() * (max - min + 1));
export const pick = <T>(r: Rand, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length];
export const chance = (r: Rand, p: number) => r() < p;

/** Número pseudoaleatorio estable a partir de enteros (para ruido y parpadeos). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
