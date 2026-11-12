// Guardado y carga en el almacenamiento local del navegador.

import { SAVE_VERSION, type SimState } from './types';

const PREFIX = 'sombras-vlianska:';

export interface SaveMeta {
  slot: string;
  name: string;
  day: number;
  when: number;
  squad: number;
  scenario: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function serialize(state: SimState): string {
  return JSON.stringify(state);
}

export function deserialize(text: string): SimState | null {
  try {
    const s = JSON.parse(text) as SimState;
    if (!s || s.version !== SAVE_VERSION || !Array.isArray(s.chars)) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveGame(slot: string, state: SimState): boolean {
  const st = storage();
  if (!st) return false;
  try {
    st.setItem(PREFIX + slot, serialize(state));
    const meta: SaveMeta = {
      slot,
      name: state.playerName,
      day: Math.floor(state.time / 1440) + 1,
      when: Date.now(),
      squad: state.chars.filter((c) => c.player && c.st !== 'muerto').length,
      scenario: state.scenario,
    };
    st.setItem(PREFIX + 'meta:' + slot, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(slot: string): SimState | null {
  const st = storage();
  const text = st?.getItem(PREFIX + slot);
  return text ? deserialize(text) : null;
}

export function listSaves(): SaveMeta[] {
  const st = storage();
  if (!st) return [];
  const out: SaveMeta[] = [];
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i);
    if (!k || !k.startsWith(PREFIX + 'meta:')) continue;
    try {
      out.push(JSON.parse(st.getItem(k)!) as SaveMeta);
    } catch {
      // se ignora
    }
  }
  return out.sort((a, b) => b.when - a.when);
}

export function deleteSave(slot: string) {
  const st = storage();
  st?.removeItem(PREFIX + slot);
  st?.removeItem(PREFIX + 'meta:' + slot);
}
