// Árbol de enfoques nacionales.
import { FOCUS_BY_ID, FOCUS_TREES } from '../data';
import type { FactionId, FocusDef, GameState } from './types';
import { check } from './conditions';
import { addLog, factionName } from './helpers';
import { mod } from './modifiers';
import { applyEffects } from './effects';

export const DEFAULT_FOCUS_DAYS = 35;

export type FocusStatus = 'done' | 'current' | 'available' | 'locked' | 'excluded' | 'blocked';

export function focusDays(f: FocusDef): number {
  return f.cost ?? DEFAULT_FOCUS_DAYS;
}

export function focusStatus(state: GameState, fac: FactionId, id: string): FocusStatus {
  const c = state.countries[fac];
  const f = FOCUS_BY_ID[id];
  if (!f) return 'locked';
  if (c.focus.done.includes(id)) return 'done';
  if (c.focus.current === id) return 'current';
  if (f.exclusive?.some((x) => c.focus.done.includes(x) || c.focus.current === x)) return 'excluded';
  if (f.prereq && !f.prereq.every((group) => group.some((p) => c.focus.done.includes(p)))) return 'locked';
  if (canBypass(state, fac, f)) return 'available';
  if (!check(state, f.available, { root: fac })) return 'blocked';
  return 'available';
}

/** ¿Ha perdido sentido el enfoque (por ejemplo, su objetivo ya no existe)? Entonces se omite. */
export function canBypass(state: GameState, fac: FactionId, f: FocusDef): boolean {
  return !!f.bypass && check(state, f.bypass, { root: fac });
}

export function startFocus(state: GameState, fac: FactionId, id: string): boolean {
  const c = state.countries[fac];
  if (c.focus.current) return false;
  if (FOCUS_BY_ID[id]?.faction !== fac) return false;
  if (focusStatus(state, fac, id) !== 'available') return false;
  if (canBypass(state, fac, FOCUS_BY_ID[id])) {
    completeFocus(state, fac, id, true);
    return true;
  }
  c.focus.current = id;
  c.focus.progress = 0;
  return true;
}

/** Peso con el que la IA elige un enfoque, ajustado a la situación. */
export function aiFocusWeight(state: GameState, fac: FactionId, f: FocusDef): number {
  let w = f.ai ?? 10;
  for (const r of f.aiIf ?? []) if (check(state, r.cond, { root: fac })) w *= r.factor;
  // Omitir un enfoque sin sentido no cuesta nada: la IA lo hace en cuanto puede.
  if (canBypass(state, fac, f)) w += 100;
  return w;
}

export function cancelFocus(state: GameState, fac: FactionId) {
  const c = state.countries[fac];
  c.focus.current = null;
  c.focus.progress = 0;
}

export function focusSpeed(state: GameState, fac: FactionId): number {
  return Math.max(0.2, 1 + mod(state, fac, 'enfoque'));
}

export function focusDaysLeft(state: GameState, fac: FactionId): number {
  const c = state.countries[fac];
  if (!c.focus.current) return 0;
  const f = FOCUS_BY_ID[c.focus.current];
  return Math.max(0, (focusDays(f) - c.focus.progress) / focusSpeed(state, fac));
}

export function completeFocus(state: GameState, fac: FactionId, id: string, bypassed = false) {
  const c = state.countries[fac];
  const f = FOCUS_BY_ID[id];
  if (!f || c.focus.done.includes(id)) return;
  c.focus.done.push(id);
  if (c.focus.current === id) {
    c.focus.current = null;
    c.focus.progress = 0;
  }
  if (bypassed) {
    if (state.player === fac) addLog(state, { text: `Se omite el enfoque «${f.name}»: ya no tiene sentido.`, kind: 'info', faction: fac, quiet: true });
    return;
  }
  applyEffects(state, f.effects, { root: fac });
  addLog(state, { text: `${factionName(fac)} completa el enfoque nacional «${f.name}».`, kind: state.player === fac ? 'bueno' : 'diplo', faction: fac, quiet: true });
}

export function dailyFocus(state: GameState, fac: FactionId) {
  const c = state.countries[fac];
  if (!c.focus.current) return;
  const f = FOCUS_BY_ID[c.focus.current];
  if (!f) {
    c.focus.current = null;
    return;
  }
  if (canBypass(state, fac, f)) {
    completeFocus(state, fac, f.id, true);
    return;
  }
  if (!check(state, f.available, { root: fac })) {
    // El enfoque ha dejado de estar disponible: se pausa sin avanzar.
    return;
  }
  c.focus.progress += focusSpeed(state, fac);
  if (c.focus.progress >= focusDays(f)) completeFocus(state, fac, f.id);
}

export function availableFocuses(state: GameState, fac: FactionId): FocusDef[] {
  const tree = FOCUS_TREES[fac];
  if (!tree) return [];
  return tree.focuses.filter((f) => focusStatus(state, fac, f.id) === 'available');
}
