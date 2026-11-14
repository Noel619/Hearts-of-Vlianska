// Partidas guardadas en el navegador (localStorage).
import type { GameState } from '../game/types';
import { deserialize, serialize } from '../game/save';
import { FACTIONS } from '../data';
import { formatDate } from '../game/time';

const INDEX_KEY = 'hov-saves';
const SLOT_PREFIX = 'hov-save:';
export const AUTOSAVE_SLOT = 'auto';

export interface SaveMeta {
  slot: string;
  name: string;
  faction: string;
  date: string;
  savedAt: number;
}

function readIndex(): SaveMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as SaveMeta[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(list: SaveMeta[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* sin almacenamiento */
  }
}

export function listSaves(): SaveMeta[] {
  return readIndex().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveGame(state: GameState, slot: string, name?: string): { ok: boolean; error?: string } {
  try {
    const json = serialize(state);
    localStorage.setItem(SLOT_PREFIX + slot, json);
    const meta: SaveMeta = {
      slot,
      name: name ?? (slot === AUTOSAVE_SLOT ? 'Autoguardado' : 'Partida guardada'),
      faction: state.player ? FACTIONS[state.player].name : 'Observador',
      date: formatDate(state.hour),
      savedAt: Date.now(),
    };
    writeIndex([...readIndex().filter((m) => m.slot !== slot), meta]);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === 'QuotaExceededError' ? 'No queda espacio en el navegador.' : 'No se pudo guardar en este navegador.' };
  }
}

export function loadGame(slot: string): GameState | null {
  try {
    const raw = localStorage.getItem(SLOT_PREFIX + slot);
    if (!raw) return null;
    return deserialize(raw);
  } catch {
    return null;
  }
}

export function deleteSave(slot: string) {
  try {
    localStorage.removeItem(SLOT_PREFIX + slot);
  } catch {
    /* ignorado */
  }
  writeIndex(readIndex().filter((m) => m.slot !== slot));
}

export function autosave(state: GameState) {
  if (!state.player) return;
  saveGame(state, AUTOSAVE_SLOT, 'Autoguardado');
}

export function hasAutosave(): boolean {
  return readIndex().some((m) => m.slot === AUTOSAVE_SLOT);
}

export function newSlotId(): string {
  return `s${Date.now().toString(36)}`;
}
