// Consultas de uso general sobre el estado de la partida.
import { MAP, STATIONS, FACTIONS } from '../data';
import type { CountryState, FactionId, GameState, LogEntry, War } from './types';
import { FACTION_IDS } from './types';

export function country(state: GameState, id: FactionId): CountryState {
  return state.countries[id];
}

export function aliveFactions(state: GameState): FactionId[] {
  return FACTION_IDS.filter((f) => state.countries[f].alive);
}

export function factionName(id: FactionId | null | undefined): string {
  if (!id) return 'Nadie';
  return FACTIONS[id].name;
}

export function stationName(id: string): string {
  return STATIONS[id]?.shortName ?? MAP.provinces[id]?.name ?? id;
}

export function provinceName(id: string): string {
  const s = STATIONS[id];
  if (s) return s.name;
  return MAP.provinces[id]?.name ?? id;
}

export function ownedStations(state: GameState, f: FactionId): string[] {
  return Object.keys(state.stations).filter((s) => state.stations[s].owner === f);
}

export function controlledStations(state: GameState, f: FactionId): string[] {
  return Object.keys(state.stations).filter((s) => state.provinces[s].controller === f);
}

export function newId(state: GameState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}

export function addLog(state: GameState, entry: Omit<LogEntry, 'hour'>) {
  state.log.push({ ...entry, hour: state.hour });
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
}

export function warsOf(state: GameState, f: FactionId): War[] {
  return state.wars.filter((w) => w.attackers.includes(f) || w.defenders.includes(f));
}

export function sideIn(w: War, f: FactionId): 'att' | 'def' | null {
  if (w.attackers.includes(f)) return 'att';
  if (w.defenders.includes(f)) return 'def';
  return null;
}

export function isAtWarWith(state: GameState, a: FactionId, b: FactionId): boolean {
  if (a === b) return false;
  for (const w of state.wars) {
    const sa = sideIn(w, a);
    const sb = sideIn(w, b);
    if (sa && sb && sa !== sb) return true;
  }
  return false;
}

export function isAtWar(state: GameState, f: FactionId): boolean {
  return warsOf(state, f).length > 0;
}

export function enemiesOf(state: GameState, f: FactionId): FactionId[] {
  const out = new Set<FactionId>();
  for (const w of warsOf(state, f)) {
    const side = sideIn(w, f);
    for (const e of side === 'att' ? w.defenders : w.attackers) out.add(e);
  }
  return [...out];
}

export function pactOf(state: GameState, f: FactionId) {
  return state.pacts.find((p) => p.members.includes(f)) ?? null;
}

export function samePact(state: GameState, a: FactionId, b: FactionId): boolean {
  const p = pactOf(state, a);
  return !!p && p.members.includes(b);
}

export function coBelligerents(state: GameState, a: FactionId, b: FactionId): boolean {
  for (const w of state.wars) {
    const sa = sideIn(w, a);
    if (sa && sa === sideIn(w, b)) return true;
  }
  return false;
}

export function isSubjectRelation(state: GameState, a: FactionId, b: FactionId): boolean {
  return state.countries[a].overlord === b || state.countries[b].overlord === a;
}

/** ¿Son a y b "amigos" a efectos militares (pueden compartir suministro y paso)? */
export function friendly(state: GameState, a: FactionId, b: FactionId): boolean {
  if (a === b) return true;
  return samePact(state, a, b) || coBelligerents(state, a, b) || isSubjectRelation(state, a, b);
}

export function hasAccess(state: GameState, mover: FactionId, owner: FactionId): boolean {
  if (mover === owner) return true;
  if (friendly(state, mover, owner)) return true;
  // Bajo tutela (influencia 50 o más), las tropas de quien la ejerce pasan libremente.
  if ((state.countries[owner].influence?.[mover] ?? 0) >= 50 && !isAtWarWith(state, mover, owner)) return true;
  return state.access.some((a) => a.from === owner && a.to === mover);
}

export function hasNap(state: GameState, a: FactionId, b: FactionId): boolean {
  return state.naps.some((n) => (n.a === a && n.b === b) || (n.a === b && n.b === a));
}

export function embargoed(state: GameState, a: FactionId, b: FactionId): boolean {
  return state.embargoes.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
}

export function relation(state: GameState, a: FactionId, b: FactionId): number {
  return state.countries[a].relations[b] ?? 0;
}

export function changeRelation(state: GameState, a: FactionId, b: FactionId, v: number, mutual = true) {
  if (a === b) return;
  const ca = state.countries[a];
  ca.relations[b] = Math.max(-100, Math.min(100, (ca.relations[b] ?? 0) + v));
  if (mutual) {
    const cb = state.countries[b];
    cb.relations[a] = Math.max(-100, Math.min(100, (cb.relations[a] ?? 0) + v));
  }
}

export function isPlayer(state: GameState, f: FactionId): boolean {
  return state.player === f;
}

export function capitalOf(state: GameState, f: FactionId): string {
  return state.countries[f].capital;
}

export function populationOf(state: GameState, f: FactionId): number {
  let p = 0;
  for (const sid of ownedStations(state, f)) p += state.stations[sid].population;
  return p;
}

export function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

export function edgeOpen(state: GameState, edgeId: string): boolean {
  const e = MAP.edgeById[edgeId];
  if (!e) return false;
  if (e.latent && !state.openEdges.includes(edgeId)) return false;
  return true;
}

export function provincePassable(state: GameState, pid: string): boolean {
  const p = state.provinces[pid];
  if (!p) return false;
  if (p.collapsed) return false;
  if (p.floodedUntil && p.floodedUntil > state.hour) return false;
  return true;
}

/** Vecinos transitables de una provincia (ignorando la política). */
export function neighbors(state: GameState, pid: string): { to: string; edgeId: string; length: number; terrain: string }[] {
  const out: { to: string; edgeId: string; length: number; terrain: string }[] = [];
  for (const { to, edge } of MAP.adjacency[pid] ?? []) {
    if (!edgeOpen(state, edge.id)) continue;
    out.push({ to, edgeId: edge.id, length: edge.length, terrain: edge.terrain });
  }
  return out;
}

/** Facciones con alguna frontera terrestre (a través de tramos) con f. */
export function neighborFactions(state: GameState, f: FactionId, maxHops = 6): FactionId[] {
  const start = Object.keys(state.provinces).filter((p) => state.provinces[p].controller === f);
  const seen = new Set<string>(start);
  const found = new Set<FactionId>();
  let frontier = start;
  for (let hop = 0; hop < maxHops && frontier.length; hop++) {
    const next: string[] = [];
    for (const pid of frontier) {
      for (const n of neighbors(state, pid)) {
        if (seen.has(n.to) || !provincePassable(state, n.to)) continue;
        seen.add(n.to);
        const c = state.provinces[n.to].controller;
        if (c && c !== f) {
          found.add(c);
          continue;
        }
        next.push(n.to);
      }
    }
    frontier = next;
  }
  return [...found];
}

/** ¿Existe una ruta terrestre entre dos facciones sin cruzar territorio hostil? (para el comercio) */
export function tradeRouteExists(state: GameState, a: FactionId, b: FactionId): boolean {
  const blocked = (ctrl: FactionId | null) => {
    if (!ctrl || ctrl === a || ctrl === b) return false;
    return isAtWarWith(state, ctrl, a) || isAtWarWith(state, ctrl, b) || embargoed(state, ctrl, a) || embargoed(state, ctrl, b);
  };
  const start = state.countries[a].capital;
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    const ctrl = state.provinces[cur].controller;
    if (ctrl === b && MAP.provinces[cur].kind === 'estacion') return true;
    for (const n of neighbors(state, cur)) {
      if (seen.has(n.to) || !provincePassable(state, n.to)) continue;
      const c = state.provinces[n.to].controller;
      if (blocked(c)) continue;
      seen.add(n.to);
      queue.push(n.to);
    }
  }
  return false;
}
