// Guardado y carga de partidas (JSON).
import type { GameState } from './types';
import { FACTION_IDS } from './types';
import { SAVE_VERSION } from './state';
import { emptyDerived, updateDerived } from './economy';
import { invalidateMods } from './modifiers';
import { FOCUS_BY_ID } from '../data';

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const state = JSON.parse(json) as GameState;
  if (!state || typeof state !== 'object' || !state.countries || !state.provinces) {
    throw new Error('El archivo no es una partida de Hearts of Vlianska.');
  }
  if ((state.version ?? 0) > SAVE_VERSION) {
    throw new Error('La partida se guardó con una versión más reciente del juego.');
  }
  // Campos añadidos en versiones posteriores.
  state.scheduled ??= [];
  state.peaceOffers ??= [];
  state.playerEvents ??= [];
  state.news ??= [];
  state.stats ??= { battles: 0, captures: 0 };
  for (const f of FACTION_IDS) {
    const c = state.countries[f];
    c.derived = { ...emptyDerived(), ...(c.derived ?? {}) };
    c.recentLosses ??= 0;
    c.manpowerBonus ??= 0;
    c.influence ??= {};
    c.influenceDrift ??= {};
    // Los árboles de enfoques cambiaron en la versión 2: se descartan los enfoques que ya no existen.
    c.focus.done = c.focus.done.filter((id) => FOCUS_BY_ID[id]);
    if (c.focus.current && !FOCUS_BY_ID[c.focus.current]) {
      c.focus.current = null;
      c.focus.progress = 0;
    }
  }
  invalidateMods(state);
  for (const f of FACTION_IDS) if (state.countries[f].alive) updateDerived(state, f);
  return state;
}
