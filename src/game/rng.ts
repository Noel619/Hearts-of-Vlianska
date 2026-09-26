import type { GameState } from './types';

// Generador pseudoaleatorio determinista (mulberry32) guardado en el estado,
// para que las partidas guardadas se reproduzcan igual.
export function rand(state: GameState): number {
  let t = (state.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state: GameState, min: number, max: number): number {
  return min + Math.floor(rand(state) * (max - min + 1));
}

export function chance(state: GameState, p: number): boolean {
  return rand(state) < p;
}

export function pick<T>(state: GameState, list: T[]): T {
  return list[Math.floor(rand(state) * list.length)];
}

export function weightedPick<T>(state: GameState, items: { item: T; weight: number }[]): T | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return null;
  let r = rand(state) * total;
  for (const i of items) {
    r -= Math.max(0, i.weight);
    if (r <= 0) return i.item;
  }
  return items[items.length - 1].item;
}
