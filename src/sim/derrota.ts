// Lo que pasa cuando tu gente cae. Los saqueadores despojan a los caídos; las
// facciones se llevan a la cárcel a quien tiene la cabeza a precio; los de
// Vhlainska y el Califato venden o encadenan esclavos; las fieras arrastran a
// los inconscientes a su nido y se los comen; y los cazarrecompensas vienen a
// cobrar lo que se debe. Los presos cumplen condena, trabajan encadenados o
// fuerzan los grilletes cuando nadie mira; los compañeros pueden rescatarlos o
// pagar la fianza.

import { CREATURES } from '../data/criaturas';
import { FACTION_LORE } from '../data/historia/facciones';
import { ITEMS, stackState, unitValue, type EquipSlot, type Stack } from '../data/items';
import type { FactionId, SideId } from '../data/tipos';
import { stationToLocal, stationToWorld } from '../world/layout';
import { addItem, countItem, gainXp, hirePrice, takeItem } from './chars';
import { damage, hostile, kill, knockOut, sightRange } from './combat';
import { clearDest, faceTo, setDest, stepMove } from './move';
import { newSquad, placePos } from './population';
import { beastName } from './remate';
import type { Sim } from './sim';
import type { Captive, Char, Container, Order, Squad } from './types';

const FACTIONS: readonly string[] = ['UNI', 'SDR', 'LEV', 'STA', 'VHL', 'CHE', 'CAL', 'NOR'];
const PEACEFUL = new Set(['civil', 'comerciante', 'refugiado', 'obrero', 'medico', 'caravanero']);
const DAY = 1440;

// ---------------------------------------------------------------------------
// Prisiones
// ---------------------------------------------------------------------------

export interface PrisonDef {
  place: string;
  kind: Captive['kind'];
  /** Dónde, dicho con artículo («la comisaría de…»). */
  label: string;
  /** Dificultad de los grilletes y las cerraduras. */
  lock: number;
}

/** Dónde encierra cada facción. Staraya y la República del Norte no tienen calabozos: multan y sueltan. */
export const PRISONS: Partial<Record<FactionId, PrisonDef>> = {
  UNI: { place: 'TSE', kind: 'carcel', label: "la comisaría central de Tsentral'naya", lock: 34 },
  SDR: { place: 'RUB', kind: 'carcel', label: 'los calabozos de Rubezh', lock: 40 },
  CHE: { place: 'CHE', kind: 'carcel', label: 'los calabozos de la junta de Chernovodskaya', lock: 44 },
  LEV: { place: 'RAS', kind: 'trabajos', label: 'las granjas de reeducación de Rassvetnaya', lock: 30 },
  VHL: { place: 'VHL', kind: 'esclavo', label: 'las jaulas de Vhlainska', lock: 26 },
  CAL: { place: 'MER', kind: 'esclavo', label: 'las cadenas del manantial de Izumrudnaya', lock: 30 },
};

/** Prisión de un bando, si la tiene y aún manda en esa estación. */
export function prisonOf(sim: Sim, side: SideId | string): PrisonDef | null {
  const p = PRISONS[side as FactionId];
  if (!p) return null;
  return sim.state.stations[p.place]?.owner === side ? p : null;
}

export interface Cell {
  x: number;
  z: number;
  face: number;
  cage: boolean;
  /** Puesto de trabajo forzado asociado (si lo hay). */
  wx?: number;
  wz?: number;
}

const CELLS = new WeakMap<Sim, Map<string, Cell[]>>();

/**
 * Plazas de una prisión: las jaulas de la sala de calabozos (o de las jaulas
 * de Vhlainska) y puntos donde encadenar a la pared. En las granjas y en el
 * manantial, los presos trabajan encadenados a su tajo.
 */
export function prisonCells(sim: Sim, place: string): Cell[] {
  let m = CELLS.get(sim);
  if (!m) CELLS.set(sim, (m = new Map()));
  const hit = m.get(place);
  if (hit) return hit;
  const out: Cell[] = [];
  const f = sim.world.layout.stationById[place];
  const nav = sim.world.nav;
  if (!f) {
    m.set(place, out);
    return out;
  }
  const taken = (x: number, z: number, d = 1.3) => out.some((c) => Math.hypot(c.x - x, c.z - z) < d);
  const rooms = f.annexes.filter((a) => a.use === 'calabozo' || a.use === 'jaulas' || a.use === 'comisaria');
  // Jaulas
  for (const p of sim.world.decor.props) {
    if (p.type !== 'jaula') continue;
    const [u, v] = stationToLocal(f, p.x, p.z);
    const inRoom = rooms.some((a) => u >= a.u0 - 0.5 && u <= a.u1 + 0.5 && v >= a.v0 - 0.5 && v <= a.v1 + 0.5);
    if (!inRoom && Math.hypot(p.x - f.x, p.z - f.z) > f.hl + 25) continue;
    out.push({ x: p.x, z: p.z, face: p.rot, cage: true });
  }
  // Argollas en las paredes de la sala de calabozos
  for (const a of rooms) {
    const W = a.u1 - a.u0;
    const D = a.v1 - a.v0;
    for (let i = 0; i < 24 && out.length < 10; i++) {
      const u = a.u0 + 0.9 + ((i * 1.7) % Math.max(1, W - 1.8));
      const v = a.v0 + 0.9 + ((Math.floor(i / 4) * 1.9) % Math.max(1, D - 1.8));
      const w = stationToWorld(f, u, v);
      const p = nav.nearestPassable(w.x, w.z, 0.6, true);
      if (!p || taken(p.x, p.z)) continue;
      out.push({ x: p.x, z: p.z, face: Math.atan2(f.z - p.z, f.x - p.x), cage: false });
    }
  }
  // Trabajos forzados: encadenados al tajo (granjas, manantial, talleres)
  const spots = sim.world.decor.spots.filter((s) => s.place === place && s.kind === 'trabajo');
  const farm = spots.filter((s) => s.data === 'cultivo');
  const work = farm.length ? farm : spots.filter((s) => s.data === 'martillo' || s.data === 'operar');
  const spring = sim.world.decor.props.find((p) => p.type === 'manantial' && Math.hypot(p.x - f.x, p.z - f.z) < f.hl + 25);
  const posts: { x: number; z: number; face: number }[] = work.map((s) => ({ x: s.x, z: s.z, face: s.rot }));
  if (spring) for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = nav.nearestPassable(spring.x + Math.cos(a) * 3.2, spring.z + Math.sin(a) * 3.2, 1.5, true);
    if (p) posts.push({ x: p.x, z: p.z, face: Math.atan2(spring.z - p.z, spring.x - p.x) });
  }
  if (out.length) {
    // Con jaulas: de día se trabaja en el tajo; de noche, a la jaula
    out.forEach((c, i) => {
      const w = posts[i % Math.max(1, posts.length)];
      if (w) {
        c.wx = w.x;
        c.wz = w.z;
      }
    });
  } else {
    for (const w of posts.slice(0, 10)) {
      const p = nav.nearestPassable(w.x + 0.4, w.z + 0.4, 1.2, true) ?? w;
      if (!taken(p.x, p.z)) out.push({ x: p.x, z: p.z, face: w.face, cage: false, wx: w.x, wz: w.z });
    }
  }
  m.set(place, out);
  return out;
}

/** Una plaza libre en la prisión (o null si está llena). */
export function freeCell(sim: Sim, place: string): Cell | null {
  const cells = prisonCells(sim, place);
  for (const c of cells) {
    if (!sim.state.chars.some((o) => o.captive && o.captive.place === place && Math.hypot(o.captive.x - c.x, o.captive.z - c.z) < 0.5)) return c;
  }
  return null;
}

/** Depósito donde acaba lo que se les quita a los presos (en Vhlainska, el botín de la Hermandad). */
export function seizeBox(sim: Sim, place: string, side: SideId): Container {
  const st = sim.state;
  const found = st.containers.find((c) => c.place === place && (c.seize || (place === 'VHL' && c.kind === 'botin' && c.owner === 'VHL')));
  if (found) return found;
  const cells = prisonCells(sim, place);
  const f = sim.world.layout.stationById[place];
  const at = cells[0] ?? (f ? { x: f.x, z: f.z } : { x: 0, z: 0 });
  const p = sim.world.nav.nearestPassable(at.x + 1.6, at.z + 1.2, 4, true) ?? at;
  const fl = FACTION_LORE[side as FactionId];
  const box: Container = { id: st.nextId++, x: p.x, z: p.z, place, items: [], lock: 38, owner: side, kind: 'cajon', opened: false, refill: 0, label: `Decomisos de ${fl ? fl.shortName : 'la estación'}`, seize: true };
  st.containers.push(box);
  return box;
}

/** Días de condena según lo que se debía. */
export function sentenceDays(bounty: number, kind: Captive['kind']): number {
  if (kind === 'esclavo') return 0;
  return Math.max(1, Math.min(5, Math.round(1 + bounty / 80 + (kind === 'trabajos' ? 1 : 0))));
}

/**
 * Encierra a alguien: le quitan el equipo (al depósito), le vendan para que no
 * se muera y lo dejan en su celda, encadenado o en una jaula.
 */
export function imprison(sim: Sim, c: Char, by: SideId, cell?: Cell | null): boolean {
  const pr = prisonOf(sim, by);
  if (!pr) return false;
  const spot = cell ?? freeCell(sim, pr.place);
  if (!spot) return false;
  const st = sim.state;
  // Suelta a quien lo llevaba (o lo que llevaba él)
  if (c.carriedBy) {
    const o = sim.char(c.carriedBy);
    if (o) o.carry = 0;
    c.carriedBy = 0;
  }
  if (c.carry) {
    const o = sim.char(c.carry);
    if (o) o.carriedBy = 0;
    c.carry = 0;
  }
  // Decomiso: armas, armaduras y todo lo que lleva encima
  const box = seizeBox(sim, pr.place, by);
  const seized: Stack[] = [];
  for (const k of Object.keys(c.eq) as EquipSlot[]) {
    const s = c.eq[k];
    if (!s) continue;
    delete c.eq[k];
    seized.push({ ...s, n: 1 });
  }
  for (const s of c.inv) if (ITEMS[s.id]?.kind !== 'clave') seized.push({ ...s });
  c.inv = c.inv.filter((s) => ITEMS[s.id]?.kind === 'clave');
  for (const s of seized) addItem({ inv: box.items }, s.id, s.n, { ...stackState(s), hot: undefined });
  c.lamp = false;
  // Lo vendan: un preso muerto no sirve de nada
  for (let i = 0; i < 7; i++) c.wound[i] = 0;
  c.bleed = 0;
  c.blood = Math.max(c.blood, 55);
  for (let i = 0; i <= 2; i++) c.hp[i] = Math.max(c.hp[i], 4);
  const debt = FACTIONS.includes(by) ? st.bounty[by as FactionId] : 0;
  const days = sentenceDays(debt, pr.kind);
  c.captive = {
    by,
    place: pr.place,
    kind: pr.kind,
    x: spot.x,
    z: spot.z,
    face: spot.face,
    cage: spot.cage,
    wx: spot.wx,
    wz: spot.wz,
    until: days ? st.time + days * DAY : 0,
    lock: pr.lock,
    pick: 0,
    escaping: false,
    seized,
  };
  c.x = spot.x;
  c.z = spot.z;
  c.face = spot.face;
  c.order = null;
  c.queue.length = 0;
  c.target = 0;
  c.sneak = false;
  delete c.fled;
  clearDest(c);
  // La cárcel salda la deuda; la esclavitud no salda nada
  if (pr.kind !== 'esclavo' && FACTIONS.includes(by)) {
    st.bounty[by as FactionId] = 0;
    const ps = st.stations[pr.place];
    if (ps) ps.alert = 0;
  }
  const where = pr.label;
  if (c.player) {
    if (pr.kind === 'esclavo') sim.log(`${c.name} despierta encadenado en ${where}. Ahora es un esclavo: trabajará hasta que escape, lo rescatéis o paguéis por él.`, 'malo');
    else sim.log(`${c.name} está preso en ${where}. Condena: ${days} ${days === 1 ? 'día' : 'días'}${pr.kind === 'trabajos' ? ' de trabajos forzados' : ''}. Su equipo está en el depósito de decomisos.`, 'malo');
  }
  sim.emit({ t: 'mundo', k: 'preso', id: c.id });
  return true;
}

/** Lo que se le quitó a un preso al encerrarlo. */
function seizedOf(c: Char): Stack[] {
  return c.captive?.seized ?? [];
}

/**
 * Libera a un preso. Por las buenas (condena cumplida, fianza o libertad
 * comprada a una facción con cárcel) le devuelven lo decomisado que siga en el
 * depósito; fugado o rescatado, sale con lo puesto y le persiguen un tiempo.
 */
export function release(sim: Sim, c: Char, how: 'condena' | 'fianza' | 'compra' | 'fuga' | 'rescate'): void {
  const cap = c.captive;
  if (!cap) return;
  const nav = sim.world.nav;
  const out = nav.nearestPassable(cap.x + Math.cos(cap.face) * 1.3, cap.z + Math.sin(cap.face) * 1.3, 3, true) ?? nav.nearestPassable(cap.x, cap.z, 4, true) ?? { x: cap.x, z: cap.z };
  if (cap.cage) {
    c.x = out.x;
    c.z = out.z;
  }
  const lawful = how === 'condena' || how === 'fianza' || (how === 'compra' && cap.kind !== 'esclavo');
  if (lawful) {
    const box = seizeBox(sim, cap.place, cap.by);
    let back = 0;
    for (const s of seizedOf(c)) {
      const i = box.items.findIndex((b) => b.id === s.id && (b.q ?? -1) === (s.q ?? -1));
      if (i < 0) continue;
      const b = box.items[i];
      const n = Math.min(b.n, s.n);
      addItem(c, b.id, n, stackState(b));
      b.n -= n;
      if (b.n <= 0) box.items.splice(i, 1);
      back += n;
    }
    if (back) {
      // Se viste otra vez con lo suyo
      for (let i = c.inv.length - 1; i >= 0; i--) {
        const def = ITEMS[c.inv[i].id];
        if (def?.armor && !c.eq[def.armor.slot]) {
          const s = c.inv.splice(i, 1)[0];
          c.eq[def.armor.slot] = { ...s, n: 1 };
          if (s.n > 1) addItem(c, s.id, s.n - 1, stackState(s));
        } else if (def?.weapon && !c.eq.arma && !def.tool) {
          const s = c.inv.splice(i, 1)[0];
          c.eq.arma = { ...s, n: 1 };
        }
      }
    }
  } else {
    c.fled = { by: cap.by, until: sim.state.time + 600 };
    if (FACTIONS.includes(cap.by)) sim.state.bounty[cap.by as FactionId] = Math.min(400, sim.state.bounty[cap.by as FactionId] + 40);
  }
  delete c.captive;
  c.pose = c.st === 'ok' ? 'normal' : 'ko';
  c.work = 'nada';
  c.ai.sub = '';
  const fl = FACTION_LORE[cap.by as FactionId];
  if (c.player) {
    const msg: Record<typeof how, string> = {
      condena: `${c.name} ha cumplido su condena y sale libre. Le devuelven lo que le quitaron.`,
      fianza: `Pagada la fianza, ${c.name} sale libre${fl ? ' de ' + PRISONS[cap.by as FactionId]?.label : ''}.`,
      compra: `${c.name} vuelve a ser libre: habéis pagado su precio.`,
      fuga: `${c.name} ha forzado los grilletes. ¡A escapar sin que le vean!`,
      rescate: `${c.name} está libre. ¡Hay que salir de aquí antes de que den la alarma!`,
    };
    sim.log(msg[how], how === 'fuga' || how === 'rescate' ? 'historia' : 'bueno');
  }
  sim.emit({ t: 'mundo', k: 'libre', id: c.id });
}

/** Lo que cuesta sacar a un preso por las buenas (fianza o precio de un esclavo). */
export function bailCost(sim: Sim, c: Char): number {
  const cap = c.captive;
  if (!cap) return 0;
  if (cap.kind === 'esclavo') return Math.round((hirePrice(c) * 1.4 + 120) / 10) * 10;
  const left = Math.max(0, cap.until - sim.state.time) / DAY;
  return Math.round((70 + left * 70) / 10) * 10;
}

/** ¿Puede este personaje negociar la libertad de un preso de su bando? */
export function canNegotiate(npc: Char, cap: Captive): boolean {
  if (npc.side !== cap.by || npc.st !== 'ok' || npc.kind !== 'humano') return false;
  return npc.role === 'lider' || npc.role === 'oficial' || npc.role === 'jefe' || npc.role === 'elite' || !!npc.unique || npc.ai.mode === 'guardia';
}

/** Paga la fianza o el precio de un preso. */
export function payBail(sim: Sim, c: Char): string | null {
  const cost = bailCost(sim, c);
  if (!c.captive) return 'No está preso';
  if (sim.state.money < cost) return 'No tienes cartuchos suficientes';
  sim.state.money -= cost;
  release(sim, c, c.captive.kind === 'esclavo' ? 'compra' : 'fianza');
  return null;
}

// ---------------------------------------------------------------------------
// Recompensas por tu cabeza
// ---------------------------------------------------------------------------

/** Lo que cuesta saldar la deuda con una facción (con la comisión de Staraya si media ella). */
export function bountyCost(sim: Sim, f: FactionId, broker = false): number {
  const b = sim.state.bounty[f];
  if (b <= 0) return 0;
  return Math.round((b * 1.5 + 20) * (broker ? 1.25 : 1));
}

/** Paga la recompensa por vuestra cabeza: la facción se calma y deja de buscaros. */
export function payBounty(sim: Sim, f: FactionId, broker = false): string | null {
  const cost = bountyCost(sim, f, broker);
  if (cost <= 0) return 'No os buscan';
  if (sim.state.money < cost) return 'No tienes cartuchos suficientes';
  sim.state.money -= cost;
  sim.state.bounty[f] = 0;
  for (const st of Object.values(sim.state.stations)) if (st.owner === f) st.alert = 0;
  for (const o of sim.state.chars) if (o.side === f && o.ai.sub === 'enfadado') o.ai.sub = '';
  for (const s of sim.state.squads) if (s.kind === 'cazadores' && s.hunt === f) s.life = Math.min(s.life, 1);
  sim.rep(f, 3);
  sim.log(`Saldas la deuda con ${FACTION_LORE[f].shortName}: ${cost} cartuchos. Ya no hay precio por vuestras cabezas.`, 'bueno');
  return null;
}

/** Facción que más paga por vuestra cabeza (y cuánto), si alguna llega al mínimo. */
export function topBounty(sim: Sim, min = 1): [FactionId, number] | null {
  let best: [FactionId, number] | null = null;
  for (const f of FACTIONS as FactionId[]) {
    const v = sim.state.bounty[f];
    if (v >= min && (!best || v > best[1])) best = [f, v];
  }
  return best;
}

/** A partir de cuánto contrata alguien cazarrecompensas. */
export const HUNT_MIN = 60;

/**
 * Cazarrecompensas: con una buena recompensa por vuestra cabeza, cada día o dos
 * alguien sale a cobrarla. Gente libre a sueldo, curtida y bien armada, que os
 * sigue el rastro, os tumba y os lleva a la cárcel de quien paga.
 */
export function stepBountyHunters(sim: Sim): void {
  const st = sim.state;
  const top = topBounty(sim, HUNT_MIN);
  const t = st.timers.cazadores;
  if (!top) {
    if (t !== undefined && t < st.time) delete st.timers.cazadores;
    return;
  }
  if (t === undefined) {
    st.timers.cazadores = st.time + (0.6 + sim.rng.next() * 0.8) * DAY;
    return;
  }
  // Los que ya están en marcha siguen el rastro de la escuadra
  const target = sim.players.find((c) => c.st === 'ok' && !c.captive) ?? sim.players[0];
  for (const s of st.squads) {
    if (s.kind !== 'cazadores' || !target || s.done) continue;
    if ((sim.tick + s.id) % 60 === 0) {
      const p = sim.world.nav.nearestPassable(target.x, target.z, 6) ?? target;
      if (Math.hypot(p.x - s.gx, p.z - s.gz) > 12) {
        s.gx = p.x;
        s.gz = p.z;
        s.route = null;
        s.mode = 'viaje';
      }
    }
  }
  if (st.time < t) return;
  st.timers.cazadores = st.time + (1.1 + sim.rng.next() * 0.9) * DAY;
  if (st.squads.some((s) => s.kind === 'cazadores') || !target) return;
  const [f, v] = top;
  // Salen de una estación de quien paga (o de la más cercana) y van a por la escuadra
  const from = Object.values(st.stations).filter((s) => s.owner === f).map((s) => placePos(sim, s.id)).filter(Boolean) as { x: number; z: number }[];
  let start = from.length ? from[Math.floor(sim.rng.next() * from.length)] : null;
  if (!start) {
    const g = sim.world.graph.nodes.filter((n) => {
      const d = Math.hypot(n.x - target.x, n.z - target.z);
      return d > 120 && d < 260;
    });
    if (!g.length) return;
    start = sim.rng.pick(g);
  }
  const n = Math.max(3, Math.min(6, Math.round(2 + v / 70)));
  const roster = ['jefe', ...Array(n - 1).fill(0).map((_, i) => (i % 2 ? 'cazador' : 'mercenario'))];
  const q = sim.world.nav.nearestPassable(start.x, start.z, 10) ?? start;
  const sq = newSquad(sim, 'LIB', 'cazadores', 'Cazarrecompensas', roster, q, [], '');
  sq.hunt = f;
  sq.angry = true;
  sq.grade = Math.min(1, 0.3 + v / 300);
  sq.life = 2.5 * DAY;
  const p = sim.world.nav.nearestPassable(target.x, target.z, 6) ?? target;
  sq.gx = p.x;
  sq.gz = p.z;
  sq.mode = 'viaje';
  sim.log(`Corre la voz por los andenes: ${FACTION_LORE[f].shortName} paga ${v} cartuchos por vuestras cabezas, y una partida de cazarrecompensas ha salido a cobrarlos.`, 'malo');
  sim.emit({ t: 'sonido', k: 'alarma', x: NaN, z: NaN });
}

// ---------------------------------------------------------------------------
// La gente del metro ante un caído de tu escuadra
// ---------------------------------------------------------------------------

/** ¿Lleva algo que valga la pena quitarle? */
function hasLoot(v: Char): boolean {
  if (v.eq.arma) return true;
  for (const s of Object.values(v.eq)) if (s && unitValue(s) >= 25) return true;
  return v.inv.some((s) => ITEMS[s.id]?.kind !== 'clave' && unitValue(s) * s.n >= 20);
}

/**
 * Qué hace un enemigo con un caído de tu escuadra: llevárselo preso (las
 * facciones con cárcel, los esclavistas y los cazarrecompensas), multarle (las
 * que no tienen calabozos) o despojarle (los saqueadores; los hambrientos, solo
 * de la comida).
 */
export function defeatIntent(sim: Sim, c: Char, v: Char): Order | null {
  if (c.kind !== 'humano' || c.player || c.captive || c.st !== 'ok' || c.carry) return null;
  // Los civiles no se meten; las figuras de la historia no dejan su sitio por esto
  if (PEACEFUL.has(c.role) || c.unique) return null;
  if (!v.player || v.st !== 'ko' || v.captive || v.carriedBy) return null;
  if (!hostile(sim, c, v) && c.ai.sub !== 'enfadado') return null;
  const sq = c.squad ? sim.squad(c.squad) : null;
  // Sangre por sangre: quien ha perdido a uno de los suyos a vuestras manos no hace
  // prisioneros (salvo los cazarrecompensas, que cobran por traeros vivos, y los
  // hambrientos, que solo quieren comer)
  if (sq && (sq.blood ?? 0) > 0 && sq.kind !== 'cazadores' && sq.kind !== 'visita' && sq.raid !== 'hambre') return { t: 'rematar', id: v.id };
  if (sq?.kind === 'cazadores' && sq.hunt) {
    return prisonOf(sim, sq.hunt) && freeCell(sim, PRISONS[sq.hunt]!.place) ? { t: 'capturar', id: v.id, data: sq.hunt } : { t: 'despojar', id: v.id, data: 'multa:' + sq.hunt };
  }
  if (sq?.raid === 'hambre') return v.inv.some((s) => ITEMS[s.id]?.food) ? { t: 'despojar', id: v.id, data: 'comida' } : null;
  const side = c.side;
  if (side === 'VHL' || side === 'CAL') {
    // Esclavistas: primero lo despojan; luego, si hay sitio, se lo llevan encadenado
    if (hasLoot(v)) return { t: 'despojar', id: v.id };
    const pr = prisonOf(sim, side);
    if (pr && freeCell(sim, pr.place)) return { t: 'capturar', id: v.id, data: side };
    return null;
  }
  if (FACTIONS.includes(side)) {
    const pr = prisonOf(sim, side);
    if (pr && freeCell(sim, pr.place)) return { t: 'capturar', id: v.id, data: side };
    return sim.state.bounty[side as FactionId] > 0 || c.ai.sub === 'enfadado' ? { t: 'despojar', id: v.id, data: 'multa:' + side } : null;
  }
  return hasLoot(v) ? { t: 'despojar', id: v.id } : null;
}

/** Caído de tu escuadra más cercano a la vista de alguien. */
export function downedNear(sim: Sim, c: Char, r: number): Char | null {
  let best: Char | null = null;
  let bd = r;
  for (const p of sim.players) {
    if (p.st !== 'ko' || p.captive || p.carriedBy) continue;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d >= bd) continue;
    if (d > 2.5 && sim.world.nav.sightLine(c.x, c.z, p.x, p.z) < 0.97) continue;
    best = p;
    bd = d;
  }
  return best;
}

/** Va hacia un punto; true cuando ya está. */
function reach(sim: Sim, c: Char, o: Order, x: number, z: number, range: number, run = true): boolean {
  const d = Math.hypot(x - c.x, z - c.z);
  if (d <= range) {
    if (c.hasDest) clearDest(c);
    return true;
  }
  if (!c.hasDest) {
    o.fail = (o.fail ?? 0) + 1;
    if (o.fail > 3 && d <= range + 2.6 && sim.world.nav.sightLine(c.x, c.z, x, z) >= 0.99) return true;
  }
  setDest(c, x, z, range * 0.8, run);
  return false;
}

/** Quita a un caído lo que vale algo y se lo queda (marcado como botín). */
function strip(sim: Sim, c: Char, v: Char): string[] {
  const took: string[] = [];
  const keep = (s: Stack, n = s.n) => {
    addItem(c, s.id, n, { ...stackState(s), hot: 'saqueo' });
    took.push(ITEMS[s.id].name.toLowerCase());
  };
  if (v.eq.arma) {
    keep(v.eq.arma, 1);
    delete v.eq.arma;
  }
  const worn = (Object.keys(v.eq) as EquipSlot[]).filter((k) => k !== 'luz' && v.eq[k]).sort((a, b) => unitValue(v.eq[b]!) - unitValue(v.eq[a]!));
  for (const k of worn.slice(0, 2)) {
    const s = v.eq[k]!;
    if (unitValue(s) < 20) continue;
    keep(s, 1);
    delete v.eq[k];
  }
  const loot = v.inv.filter((s) => ITEMS[s.id]?.kind !== 'clave').sort((a, b) => unitValue(b) * b.n - unitValue(a) * a.n).slice(0, 4);
  for (const s of loot) {
    const i = v.inv.indexOf(s);
    if (i >= 0) v.inv.splice(i, 1);
    keep(s);
  }
  return took;
}

/**
 * Dónde queda el cuerpo que arrastra una fiera. Los cuadrúpedos lo agarran de
 * un tobillo con los dientes y tiran hacia atrás, así que el cuerpo va delante
 * de su hocico con los pies hacia ella; los bípedos lo llevan de la mano a su
 * espalda mientras andan. El dibujo ajusta el agarre exacto.
 */
export function dragAnchor(beast: Char): { x: number; z: number; face: number } {
  const def = CREATURES[beast.kind];
  const s = def?.scale ?? 1;
  const quad = def?.shape !== 'bipedo';
  const d = quad ? 0.78 * s + 0.78 : -(0.42 * s + 0.6);
  return { x: beast.x + Math.cos(beast.face) * d, z: beast.z + Math.sin(beast.face) * d, face: quad ? beast.face + Math.PI : beast.face };
}

/** ¿Tira hacia atrás? (cuadrúpedo arrastrando a alguien con los dientes) */
export function dragsBackward(c: Char): boolean {
  return c.carry !== 0 && c.kind !== 'humano' && CREATURES[c.kind]?.shape === 'cuadrupedo';
}

/** Segundos que tarda una fiera en acabar con quien se está comiendo (varias, antes). */
export const DEVOUR_TIME: Record<string, number> = { rata: 6, skrebun: 3.5, glubinnik: 2.6, sheptun: 2.4 };

/** Órdenes de la derrota: despojar, capturar, liberar y las de las fieras. Devuelve false cuando acaba. */
export function runDefeatOrder(sim: Sim, c: Char, o: Order, dt: number): boolean {
  switch (o.t) {
    case 'despojar': {
      const v = sim.char(o.id!);
      if (!v || v.st !== 'ko' || v.captive || v.carriedBy) return false;
      if (!reach(sim, c, o, v.x, v.z, 1.3)) return true;
      faceTo(c, v.x, v.z, dt);
      c.pose = 'arrodillado';
      c.work = 'rebuscar';
      c.workT += dt;
      if (c.workT < 2.5) return true;
      c.workT = 0;
      const data = o.data ?? '';
      if (data.startsWith('multa:')) {
        const f = data.slice(6) as FactionId;
        const fine = Math.min(sim.state.money, Math.max(30, Math.round(sim.state.bounty[f] * 1.2 + 20)));
        sim.state.money -= fine;
        sim.state.bounty[f] = 0;
        for (const st of Object.values(sim.state.stations)) if (st.owner === f) st.alert = 0;
        sim.forNear(c.x, c.z, 40, (q) => {
          if (q.side === c.side && q.ai.sub === 'enfadado') q.ai.sub = '';
        });
        const sq = c.squad ? sim.squad(c.squad) : null;
        if (sq?.kind === 'cazadores') sq.done = true;
        sim.log(`${c.name} registra a ${v.name} y se cobra la deuda con ${FACTION_LORE[f]?.shortName ?? 'los suyos'}: ${fine} cartuchos de vuestra bolsa. La cuenta queda saldada.`, 'malo');
        return false;
      }
      let took: string[];
      if (data === 'comida') {
        took = [];
        for (let i = v.inv.length - 1; i >= 0; i--) {
          const s = v.inv[i];
          if (!ITEMS[s.id]?.food) continue;
          v.inv.splice(i, 1);
          addItem(c, s.id, s.n, { ...stackState(s), hot: 'saqueo' });
          took.push(ITEMS[s.id].name.toLowerCase());
        }
      } else took = strip(sim, c, v);
      if (took.length && v.player) sim.log(`${c.name} despoja a ${v.name}: se lleva ${listWords(took)}.`, 'malo');
      sim.emit({ t: 'sonido', k: 'coger', x: c.x, z: c.z });
      return false;
    }
    case 'capturar': {
      const v = sim.char(o.id!);
      const by = (o.data ?? c.side) as SideId;
      const pr = prisonOf(sim, by);
      if (!v || v.st === 'muerto' || v.captive || !pr) {
        if (c.carry === o.id) c.carry = 0;
        if (v && v.carriedBy === c.id) v.carriedBy = 0;
        return false;
      }
      if (c.carry !== v.id) {
        if (v.carriedBy || v.st === 'ok') return false;
        if (!reach(sim, c, o, v.x, v.z, 1.2)) return true;
        c.carry = v.id;
        v.carriedBy = c.id;
        v.order = null;
        v.queue.length = 0;
        clearDest(v);
        o.fail = 0;
        sim.emit({ t: 'sonido', k: 'coger', x: c.x, z: c.z });
        if (v.player) sim.log(`${c.name} carga con ${v.name} y se lo lleva hacia ${pr.label}.`, 'malo');
        return true;
      }
      const cell = freeCell(sim, pr.place);
      if (!cell) {
        // No queda sitio: lo dejan tirado
        c.carry = 0;
        v.carriedBy = 0;
        return false;
      }
      const door = cell.cage ? (sim.world.nav.nearestPassable(cell.x, cell.z, 3, true) ?? cell) : cell;
      const there = reach(sim, c, o, door.x, door.z, 1.6, false);
      // Si no hay camino posible, «se lo llevan a rastras» y aparece en la celda
      if (there || (o.fail ?? 0) > 6) {
        c.carry = 0;
        v.carriedBy = 0;
        imprison(sim, v, by, cell);
        const sq = c.squad ? sim.squad(c.squad) : null;
        if (sq?.kind === 'cazadores') {
          sq.done = true;
          sq.life = Math.min(sq.life, 120);
        }
        return false;
      }
      return true;
    }
    case 'liberar': {
      // Un compañero fuerza los grilletes o la jaula de un preso
      const v = sim.char(o.id!);
      const cap = v?.captive;
      if (!v || !cap) return false;
      const door = cap.cage ? (sim.world.nav.nearestPassable(cap.x, cap.z, 3, true) ?? cap) : cap;
      if (!reach(sim, c, o, door.x, door.z, cap.cage ? 1.4 : 1.2)) return true;
      faceTo(c, cap.x, cap.z, dt);
      c.pose = 'arrodillado';
      c.work = 'rebuscar';
      const tool = c.inv.some((s) => s.id === 'ganzuas') ? 0.4 : 0;
      cap.pick = Math.min(1, cap.pick + (dt * (0.4 + c.sk.cerraduras * 0.03 + tool)) / (cap.lock * 1.1));
      gainXp(sim, c, 'cerraduras', dt * 0.12);
      if (spotted(sim, c, cap.by)) {
        // ¡Le han visto! Los guardias dan la alarma
        sim.crime(c, 30);
        sim.forNear(c.x, c.z, 30, (q) => {
          if (q.side === cap.by && q.st === 'ok' && !q.player) {
            q.ai.sub = 'enfadado';
            if (!q.target) q.target = c.id;
          }
        });
        sim.log(`¡${c.name} intentaba liberar a ${v.name} y le han visto!`, 'malo');
        return false;
      }
      if (cap.pick >= 1) {
        sim.emit({ t: 'sonido', k: 'cerradura', x: cap.x, z: cap.z });
        release(sim, v, 'rescate');
        return false;
      }
      return true;
    }
    case 'arrastrar': {
      // Una fiera se lleva a rastras a un caído hasta su nido
      const v = sim.char(o.id!);
      if (!v || v.st !== 'ko' || v.captive || (v.carriedBy && v.carriedBy !== c.id)) {
        if (c.carry) c.carry = 0;
        return false;
      }
      if (c.carry !== v.id) {
        if (!reach(sim, c, o, v.x, v.z, 1.1)) return true;
        c.carry = v.id;
        v.carriedBy = c.id;
        v.order = null;
        clearDest(v);
        o.fail = 0;
        if (v.player) sim.log(`¡Un ${CREATURES[c.kind]?.name.toLowerCase() ?? 'bicho'} arrastra a ${v.name} hacia la oscuridad!`, 'malo');
        return true;
      }
      const there = reach(sim, c, o, c.ai.homeX, c.ai.homeZ, 2.2, false);
      if (there || (o.fail ?? 0) > 5) {
        // En el nido lo suelta donde está y empieza a comer
        const a = dragAnchor(c);
        const p = sim.world.nav.nearestPassable(a.x, a.z, 2, true) ?? a;
        c.carry = 0;
        v.carriedBy = 0;
        v.x = p.x;
        v.z = p.z;
        v.face = a.face;
        v.pose = 'ko';
        c.order = { t: 'devorar', id: v.id };
        return true;
      }
      return true;
    }
    case 'devorar': {
      // Se lo come: muerde y desgarra sin parar. No hay pelea que valga: si nadie
      // se la quita de encima, en unos segundos lo mata (y varias, antes)
      const v = sim.char(o.id!);
      if (!v || v.st !== 'ko' || v.captive || v.carriedBy) {
        c.atkT = -1;
        return false;
      }
      const def = CREATURES[c.kind];
      if (!reach(sim, c, o, v.x, v.z, (def?.reach ?? 1) + 0.3)) return true;
      faceTo(c, v.x, v.z, dt);
      c.work = 'comer';
      if (c.atkT >= 0) {
        c.atkT += dt / 0.6;
        if (c.atkT >= 1) c.atkT = -1;
      }
      v.eaten = (v.eaten ?? 0) + dt;
      c.workT += dt;
      if (c.workT >= 0.9 + ((c.id * 0.37) % 0.4)) {
        c.workT = 0;
        c.atkT = 0;
        // Va a lo blando: el vientre, el pecho y el cuello; a veces, un brazo o una pierna
        const r = sim.rng.next();
        const part = r < 0.35 ? 2 : r < 0.62 ? 1 : r < 0.78 ? 0 : 3 + Math.floor(sim.rng.next() * 4);
        const dmg = damage(sim, v, part, ((def?.cut ?? 6) + (def?.blunt ?? 4)) * 0.8 * sim.rng.range(0.8, 1.2), 'corte', c);
        sim.emit({ t: 'golpe', id: c.id, target: v.id, part, dmg, kind: 'corte', block: false, low: true });
        if (v.player && (sim.tick + v.id) % 3 === 0) sim.emit({ t: 'flota', x: v.x, z: v.z, text: '¡Se lo están comiendo!', color: '#ff7a6a' });
      }
      if (v.st === 'ko' && v.eaten >= (DEVOUR_TIME[c.kind] ?? 4)) {
        const female = v.look?.female ?? false;
        kill(sim, v, c, `${female ? 'devorada' : 'devorado'} por ${beastName(c)}`);
        c.atkT = -1;
        c.work = 'nada';
      }
      return v.st === 'ko';
    }
    default:
      return false;
  }
}

function listWords(w: string[]): string {
  const u = [...new Set(w)];
  if (u.length <= 1) return u[0] ?? 'nada';
  return u.slice(0, -1).join(', ') + ' y ' + u[u.length - 1];
}

/**
 * ¿Está atento este guardia? Nadie vigila sin parar: cada uno mira un rato y
 * se distrae otro (de noche, más), y el ritmo de cada cual es distinto.
 */
export function attentive(sim: Sim, o: Char): boolean {
  const h = sim.hour;
  const night = h >= 22 || h < 6;
  const phase = (sim.state.time + o.id * 37) % 90;
  return phase < (night ? 30 : 55);
}

/** ¿Hay algún guardia del bando `by` que pueda ver ahora mismo a `c`? */
export function guardsWatching(sim: Sim, c: Char, by: SideId): boolean {
  let seen = false;
  sim.forNear(c.x, c.z, 18, (o) => {
    if (seen || o.side !== by || o.st !== 'ok' || o.player || o.kind !== 'humano' || o.captive) return;
    if (PEACEFUL.has(o.role) || !attentive(sim, o)) return;
    const d = Math.hypot(o.x - c.x, o.z - c.z);
    if (d > sightRange(sim, o, c) * 0.75) return;
    // Solo ve lo que tiene delante
    const a = Math.atan2(c.z - o.z, c.x - o.x) - o.face;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > 1.9 && d > 2.2) return;
    if (d > 2.5 && sim.world.nav.sightLine(o.x, o.z, c.x, c.z) < 0.97) return;
    seen = true;
  });
  return seen;
}

/** ¿Le pillan haciendo algo que no debe? (una vez por segundo, si alguien mira) */
export function spotted(sim: Sim, c: Char, by: SideId): boolean {
  if ((sim.tick + c.id) % 30 !== 0) return false;
  return guardsWatching(sim, c, by) && sim.rng.chance(0.5);
}

// ---------------------------------------------------------------------------
// Los presos
// ---------------------------------------------------------------------------

/** Horas de trabajo forzado. */
function workHours(sim: Sim): boolean {
  const h = sim.hour;
  return h >= 7 && h < 19;
}

/** Empieza (o deja) el intento de fuga de un preso. */
export function setEscape(c: Char, on: boolean): void {
  if (c.captive) c.captive.escaping = on;
}

/**
 * Un paso de la vida de un preso: quieto en su jaula o encadenado; de día, al
 * tajo si es de trabajos forzados o esclavo; forzando los grilletes si lo
 * intenta; libre al cumplir la condena.
 */
export function stepCaptive(sim: Sim, c: Char, dt: number): void {
  const cap = c.captive!;
  const st = sim.state;
  c.target = 0;
  c.atkT = -1;
  c.aim = 0;
  c.order = null;
  c.queue.length = 0;
  // Comida: les dan lo justo para que sigan trabajando
  if (c.hunger < 28) c.hunger = 40;
  if (cap.until > 0 && st.time >= cap.until && c.st === 'ok') {
    release(sim, c, 'condena');
    return;
  }
  if (c.st === 'ko') {
    c.pose = 'ko';
    c.speed = 0;
    return;
  }
  const work = cap.kind !== 'carcel' && cap.wx !== undefined && workHours(sim) && !cap.escaping;
  const tx = work ? cap.wx! : cap.x;
  const tz = work ? cap.wz! : cap.z;
  const d = Math.hypot(tx - c.x, tz - c.z);
  if (d > 0.7) {
    // Sale de la jaula (o entra) por la puerta, y va con los grilletes puestos
    if (cap.cage && Math.hypot(c.x - cap.x, c.z - cap.z) < 0.3 && work) {
      const p = sim.world.nav.nearestPassable(cap.x, cap.z, 3, true);
      if (p) {
        c.x = p.x;
        c.z = p.z;
      }
    }
    const door = cap.cage && !work ? (sim.world.nav.nearestPassable(cap.x, cap.z, 3, true) ?? cap) : null;
    if (door && Math.hypot(door.x - c.x, door.z - c.z) < 1.4) {
      c.x = cap.x;
      c.z = cap.z;
      clearDest(c);
      return;
    }
    c.sneak = false;
    c.run = false;
    if (!c.hasDest) setDest(c, door ? door.x : tx, door ? door.z : tz, 0.5, false);
    c.pose = 'normal';
    c.work = 'nada';
    stepMove(sim, c, dt);
    // Si se atasca, lo colocan en su sitio
    if (c.stuck > 4) {
      c.x = tx;
      c.z = tz;
      clearDest(c);
    }
    return;
  }
  clearDest(c);
  c.speed = 0;
  if (cap.escaping) {
    // Forzar los grilletes y la cerradura con lo que se tenga a mano
    c.pose = 'cuclillas';
    c.work = 'rebuscar';
    cap.pick = Math.min(1, cap.pick + (dt * (0.25 + c.sk.cerraduras * 0.025)) / (cap.lock * 1.2));
    gainXp(sim, c, 'cerraduras', dt * 0.1);
    if (spotted(sim, c, cap.by)) {
      // Le pillan: paliza y vuelta a empezar
      cap.pick = 0;
      cap.escaping = false;
      if (cap.until > 0) cap.until += DAY * 0.5;
      const g = guardNear(sim, c, cap.by);
      for (let i = 0; i < 3 && c.st === 'ok'; i++) damage(sim, c, sim.rng.pick([0, 1, 2, 5, 6]), 9 + sim.rng.next() * 6, 'contusion', g);
      if (c.st === 'ok') knockOut(sim, c, 25);
      if (c.player) sim.log(`¡Han pillado a ${c.name} intentando escapar! Una paliza y ${cap.until > 0 ? 'medio día más de condena' : 'grilletes nuevos'}.`, 'malo');
      return;
    }
    if (cap.pick >= 1) {
      sim.emit({ t: 'sonido', k: 'cerradura', x: c.x, z: c.z });
      release(sim, c, 'fuga');
      c.sneak = true;
    }
    return;
  }
  c.face = work ? Math.atan2((cap.wz ?? c.z) - c.z, (cap.wx ?? c.x) - c.x) || cap.face : cap.face;
  if (work) {
    // Al tajo: cava, rasca o cultiva; el trabajo forzado endurece
    c.pose = cap.place === 'RAS' ? 'cuclillas' : 'normal';
    c.work = cap.place === 'VHL' ? 'pico' : 'rebuscar';
    gainXp(sim, c, 'fuerza', dt * 0.02);
    gainXp(sim, c, 'aguante', dt * 0.015);
  } else {
    c.pose = sim.hour >= 22 || sim.hour < 6 ? 'tumbado' : 'sentadoSuelo';
    c.work = 'nada';
  }
}

function guardNear(sim: Sim, c: Char, by: SideId): Char | null {
  let best: Char | null = null;
  let bd = 30;
  sim.forNear(c.x, c.z, 30, (o) => {
    if (o.side !== by || o.st !== 'ok' || o.player || o.kind !== 'humano') return;
    const d = Math.hypot(o.x - c.x, o.z - c.z);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  return best;
}

/** Texto del estado de un preso para la interfaz. */
export function captiveText(sim: Sim, c: Char): string {
  const cap = c.captive;
  if (!cap) return '';
  const pr = PRISONS[cap.by as FactionId];
  const where = pr?.label ?? 'una celda';
  if (cap.kind === 'esclavo') return `Esclavo en ${where}`;
  const left = Math.max(0, cap.until - sim.state.time) / DAY;
  const h = Math.ceil(left * 24);
  return `Preso en ${where} · ${h > 24 ? Math.ceil(left) + ' días' : h + ' h'} de condena`;
}

// ---------------------------------------------------------------------------
// Botín de las escuadras enemigas
// ---------------------------------------------------------------------------

/** Al desaparecer de la vista, el botín que llevan los de una escuadra pasa a la escuadra. */
export function packLoot(sq: Squad, members: Char[]): void {
  for (const c of members) {
    for (let i = c.inv.length - 1; i >= 0; i--) {
      const s = c.inv[i];
      if (s.hot !== 'saqueo') continue;
      c.inv.splice(i, 1);
      (sq.loot ??= []).push(s);
    }
  }
}

/** Al volver a la vista, el cabecilla vuelve a cargar con el botín. */
export function unpackLoot(sq: Squad, lead: Char | null): void {
  if (!lead || !sq.loot?.length) return;
  for (const s of sq.loot) lead.inv.push(s);
  sq.loot = [];
}

/** Al llegar a casa, el botín acaba en el depósito de su estación (el de Vhlainska, en el botín de la Hermandad). */
export function depositLoot(sim: Sim, sq: Squad): void {
  if (!sq.loot?.length) return;
  const home = sq.home && sim.state.stations[sq.home] ? sq.home : null;
  if (home && FACTIONS.includes(sq.side)) {
    const box = seizeBox(sim, home, sq.side);
    for (const s of sq.loot) addItem({ inv: box.items }, s.id, s.n, { ...stackState(s), hot: undefined });
  }
  sq.loot = [];
}

export { countItem, takeItem };
