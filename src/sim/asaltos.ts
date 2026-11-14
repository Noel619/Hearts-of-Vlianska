// Las bases del jugador: asentamientos y puestos avanzados, los asaltos (de la
// Hermandad, de las fieras, de una facción en pie de guerra o de gente
// hambrienta) que rompen obras y saquean almacenes, y las visitas de las
// facciones vecinas: recaudadores que piden tributo e inspectores que buscan
// contrabando.

import { BUILDS } from '../data/edificios';
import { FACTION_LORE } from '../data/historia/facciones';
import { ITEMS, stackState, unitValue, type Stack } from '../data/items';
import type { Role } from '../data/gente';
import type { FactionId, SideId } from '../data/tipos';
import { damageBuilding } from './build';
import { addItem, invWeight, maxCarry, weaponDef } from './chars';
import { clearDest, faceTo, setDest } from './move';
import { newSquad, placePos, toughen } from './population';
import type { Sim } from './sim';
import type { Building, Char, Order, Squad } from './types';
import { placeName } from './world';

const DAY = 1440;
const FACTIONS: readonly FactionId[] = ['UNI', 'SDR', 'LEV', 'STA', 'VHL', 'CHE', 'CAL', 'NOR'];

// ---------------------------------------------------------------------------
// Asentamientos
// ---------------------------------------------------------------------------

export interface Base {
  x: number;
  z: number;
  /** Obras terminadas. */
  n: number;
  ids: number[];
  name: string;
}

/** Distancia a la que dos obras se consideran del mismo asentamiento. */
const LINK = 40;

/**
 * Asentamientos del jugador: grupos de obras terminadas a menos de 40 m unas
 * de otras. El mayor es la base; los demás, puestos avanzados.
 */
const BASES = new WeakMap<Sim, { key: string; list: Base[] }>();

export function playerBases(sim: Sim): Base[] {
  // Se recalcula solo cuando cambian las obras terminadas
  const done = sim.state.buildings.filter((b) => b.prog >= 1);
  let key = '';
  for (const b of done) key += b.id + ',';
  const hit = BASES.get(sim);
  if (hit && hit.key === key) return hit.list;
  const list = computeBases(sim, done);
  BASES.set(sim, { key, list });
  return list;
}

function computeBases(sim: Sim, done: Building[]): Base[] {
  const group = new Map<number, number>();
  let g = 0;
  for (const b of done) {
    if (group.has(b.id)) continue;
    const stack = [b];
    group.set(b.id, g);
    while (stack.length) {
      const a = stack.pop()!;
      for (const o of done) {
        if (group.has(o.id) || Math.hypot(o.x - a.x, o.z - a.z) > LINK) continue;
        group.set(o.id, g);
        stack.push(o);
      }
    }
    g++;
  }
  const out: Base[] = [];
  for (let k = 0; k < g; k++) {
    const list = done.filter((b) => group.get(b.id) === k);
    const x = list.reduce((a, b) => a + b.x, 0) / list.length;
    const z = list.reduce((a, b) => a + b.z, 0) / list.length;
    out.push({ x, z, n: list.length, ids: list.map((b) => b.id), name: placeName(sim.world, x, z) });
  }
  return out.sort((a, b) => b.n - a.n);
}

/** Asentamiento al que pertenece un punto (o null). */
export function baseAt(sim: Sim, x: number, z: number): Base | null {
  return playerBases(sim).find((b) => b.ids.some((id) => {
    const o = sim.state.buildings.find((q) => q.id === id);
    return !!o && Math.hypot(o.x - x, o.z - z) < LINK;
  })) ?? null;
}

// ---------------------------------------------------------------------------
// Asaltos
// ---------------------------------------------------------------------------

/** Facciones en pie de guerra contigo, y su estación más cercana a un punto. */
function angryFactions(sim: Sim, x: number, z: number): { f: FactionId; from: { x: number; z: number }; home: string; d: number }[] {
  const out: { f: FactionId; from: { x: number; z: number }; home: string; d: number }[] = [];
  for (const f of FACTIONS) {
    if (f === 'VHL') continue;
    const hostileNow = sim.state.rep[f] <= -50 || sim.state.bounty[f] >= 100 || (sim.state.timers['castigo:' + f] ?? Infinity) <= sim.state.time;
    if (!hostileNow) continue;
    let best: { x: number; z: number } | null = null;
    let home = '';
    let bd = 1600;
    for (const st of Object.values(sim.state.stations)) {
      if (st.owner !== f) continue;
      const p = placePos(sim, st.id);
      if (!p) continue;
      const d = sim.world.graph.travelDistance(p.x, p.z, x, z);
      if (d < bd) {
        bd = d;
        best = p;
        home = st.id;
      }
    }
    if (best) out.push({ f, from: best, home, d: bd });
  }
  return out;
}

/** Tropa de cada facción para una expedición de castigo. */
const PUNISH: Partial<Record<FactionId, Role[]>> = {
  UNI: ['oficial', 'soldado', 'soldado', 'soldado', 'soldado', 'elite'],
  SDR: ['oficial', 'soldado', 'soldado', 'soldado', 'elite', 'elite'],
  LEV: ['oficial', 'soldado', 'soldado', 'soldado', 'soldado', 'soldado'],
  STA: ['mercenario', 'mercenario', 'mercenario', 'mercenario', 'guardia'],
  CHE: ['oficial', 'soldado', 'soldado', 'elite', 'soldado'],
  CAL: ['soldado', 'soldado', 'soldado', 'soldado', 'oficial'],
  NOR: ['stalker', 'soldado', 'soldado', 'elite'],
};

/**
 * Lanza un asalto contra un asentamiento. Quién viene depende de cómo están
 * las cosas: la Hermandad de Vhlainska a saquear, una facción a castigar, una
 * jauría hambrienta o gente desesperada a por la comida.
 */
export function launchRaid(sim: Sim, base: Base, strength: number, grade: number, vhlAlive: boolean, force?: FactionId): Squad | null {
  const st = sim.state;
  const g = sim.world.graph;
  const cands = g.nodes.filter((n) => {
    const d = Math.hypot(n.x - base.x, n.z - base.z);
    return d > 110 && d < 230;
  });
  if (!cands.length) return null;
  const from = sim.rng.pick(cands);
  if (g.travelDistance(from.x, from.z, base.x, base.z) > 600) return null;
  // ¿Quién viene?
  const angry = angryFactions(sim, base.x, base.z);
  const forced = force ? angry.find((a) => a.f === force) : undefined;
  if (force && !forced) {
    // Demasiado lejos para mandar a nadie: lo dejan correr
    delete st.timers['castigo:' + force];
    return null;
  }
  const hungry = !force && (st.flags.inviernoCrudo || st.flags.fiebre) && sim.rng.chance(0.45);
  const roll = sim.rng.next();
  let sq: Squad;
  if (forced || (angry.length && roll < 0.45)) {
    const a = forced ?? sim.rng.pick(angry);
    const roster = (PUNISH[a.f] ?? ['soldado', 'soldado', 'soldado']).slice(0, Math.max(3, Math.min(6, Math.round(strength * 0.6) + 1)));
    sq = newSquad(sim, a.f, 'asalto', 'Expedición de castigo', roster, from, [], a.home);
    sq.raid = 'castigo';
    sq.grade = Math.max(grade, 0.3);
    delete st.timers['castigo:' + a.f];
    sim.log(`${FACTION_LORE[a.f].name} manda una expedición de castigo contra tu asentamiento de ${base.name}.`, 'malo');
  } else if (hungry || (!vhlAlive && roll < 0.3)) {
    const n = Math.max(3, Math.min(8, strength));
    sq = newSquad(sim, 'LIB', 'asalto', 'Hambrientos', Array(n).fill(0).map((_, i) => (i % 3 === 2 ? 'civil' : 'refugiado')), from, [], '');
    sq.raid = 'hambre';
    sim.log(`Gente desesperada baja por el túnel hacia ${base.name}: vienen a por vuestra comida.`, 'malo');
  } else if (vhlAlive && st.rep.VHL < 30 && sim.rng.chance(0.6)) {
    const roster = [...(strength >= 5 ? ['jefe'] : []), ...Array(strength).fill('bandido')];
    sq = newSquad(sim, 'VHL', 'asalto', 'Asalto de saqueadores', roster, from, [], 'VHL');
    sq.raid = 'saqueo';
    sq.grade = grade;
    sim.log(`Tus vigías dan la alarma: una banda de saqueadores se acerca a ${base.name}.`, 'malo');
  } else {
    const roster = strength < 4 || sim.rng.chance(0.5) ? Array(strength + 2).fill('rata') : Array(Math.round(strength * 0.55)).fill('skrebun');
    sq = newSquad(sim, 'MUT', 'asalto', 'Jauría hambrienta', roster, from, [], '');
    sim.log(`Algo se mueve en la oscuridad: una jauría viene hacia ${base.name}.`, 'malo');
  }
  const p = sim.world.nav.nearestPassable(base.x, base.z, 12) ?? base;
  sq.gx = p.x;
  sq.gz = p.z;
  sq.mode = 'asalto';
  sq.angry = true;
  sq.life = DAY;
  sim.emit({ t: 'sonido', k: 'alarma', x: base.x, z: base.z });
  return sq;
}

/** Edificio más apetecible para romper: lo que corta el paso, los nidos de ametralladora y lo que tienen cerca. */
function pickToSmash(sim: Sim, c: Char, r = 30): Building | null {
  let best: Building | null = null;
  let bs = -Infinity;
  for (const b of sim.state.buildings) {
    if (b.prog < 1) continue;
    const d = Math.hypot(b.x - c.x, b.z - c.z);
    if (d > r) continue;
    const def = BUILDS[b.def];
    const score = (def.gate ? 30 : 0) + (def.turret ? 40 : 0) + (def.tall && !def.store ? 12 : 0) + (def.beds ? 8 : 0) - d;
    if (score > bs) {
      bs = score;
      best = b;
    }
  }
  return best;
}

/** Almacén más cercano con algo que llevarse (o, si `food`, con comida). */
function pickToRob(sim: Sim, c: Char, food: boolean, r = 40): Building | null {
  let best: Building | null = null;
  let bd = r;
  for (const b of sim.state.buildings) {
    if (b.prog < 1 || !b.store.length || BUILDS[b.def].turret) continue;
    if (!b.store.some((s) => (food ? !!ITEMS[s.id]?.food : unitValue(s) > 0))) continue;
    const d = Math.hypot(b.x - c.x, b.z - c.z);
    if (d < bd) {
      bd = d;
      best = b;
    }
  }
  return best;
}

/** Ya han hecho lo que venían a hacer: de vuelta a casa con lo que llevan. */
export function retreat(sim: Sim, s: Squad): void {
  if (s.done) return;
  s.done = true;
  const home = s.home ? placePos(sim, s.home) : null;
  if (home) {
    const p = sim.world.nav.nearestPassable(home.x, home.z, 10) ?? home;
    s.plan = [s.home];
    s.pi = 0;
    s.gx = p.x;
    s.gz = p.z;
  } else {
    const far = sim.world.graph.nodes.filter((n) => Math.hypot(n.x - s.x, n.z - s.z) > 200);
    if (far.length) {
      const n = sim.rng.pick(far);
      s.gx = n.x;
      s.gz = n.z;
    }
    s.life = Math.min(s.life, 400);
  }
  s.route = null;
  s.mode = 'vuelta';
  s.wait = 0;
  for (const m of s.roster) {
    const c = m.id ? sim.char(m.id) : null;
    if (c && (c.order?.t === 'romper' || c.order?.t === 'robar')) c.order = null;
  }
}

/**
 * Lo que hace un asaltante sin nadie a quien pegar: romper defensas, saquear
 * almacenes o (los hambrientos) llevarse la comida. Cuando la mitad va
 * cargada, se retiran.
 */
export function raidIdle(sim: Sim, c: Char, s: Squad): boolean {
  if (c.order || c.target || c.kind !== 'humano' || s.done || (sim.tick + c.id) % 20 !== 0) return false;
  if (Math.hypot(s.gx - c.x, s.gz - c.z) > 45) return false;
  const members = s.roster.map((m) => (m.id ? sim.char(m.id) : null)).filter((q): q is Char => !!q && q.st === 'ok');
  const loaded = members.filter((q) => q.inv.some((x) => x.hot === 'saqueo')).length;
  if (members.length && loaded >= Math.ceil(members.length / 2)) {
    retreat(sim, s);
    return true;
  }
  if (s.raid === 'hambre') {
    const b = pickToRob(sim, c, true);
    if (b) c.order = { t: 'robar', id: b.id, data: 'comida' };
    else retreat(sim, s);
    return !!b;
  }
  const smash = s.raid === 'castigo' || c.id % 3 === 0 || !pickToRob(sim, c, false);
  const b = smash ? pickToSmash(sim, c) : pickToRob(sim, c, false);
  if (b) {
    c.order = smash ? { t: 'romper', id: b.id } : { t: 'robar', id: b.id };
    return true;
  }
  // No queda nada que romper ni que llevarse
  if ((sim.tick + c.id) % 300 === 0) retreat(sim, s);
  return false;
}

/** Órdenes de los asaltantes: romper una obra o saquear un almacén. Devuelve false cuando acaba. */
export function runRaidOrder(sim: Sim, c: Char, o: Order, dt: number): boolean {
  const b = sim.state.buildings.find((q) => q.id === o.id);
  if (!b || b.prog < 1) {
    c.atkT = -1;
    return false;
  }
  const def = BUILDS[b.def];
  const reach = Math.max(def.hx, def.hz) + 1.0;
  const d = Math.hypot(b.x - c.x, b.z - c.z);
  if (d > reach) {
    if (!c.hasDest) {
      o.fail = (o.fail ?? 0) + 1;
      if (o.fail > 4) return false;
    }
    setDest(c, b.x, b.z, reach * 0.85, true);
    return true;
  }
  clearDest(c);
  faceTo(c, b.x, b.z, dt);
  if (o.t === 'romper') {
    // Golpes contra la chapa: con el arma que lleve (o a patadas)
    const w = weaponDef(c);
    if (c.atkT >= 0) {
      c.atkT += dt / c.atkDur;
      if (!c.atkDone && c.atkT >= 0.42) {
        c.atkDone = true;
        const dmg = ((w?.blunt ?? 6) + (w?.cut ?? 0) * 0.6 + 4) * (0.7 + c.sk.fuerza * 0.01);
        damageBuilding(sim, b, dmg, c);
      }
      if (c.atkT >= 1) c.atkT = -1;
      return true;
    }
    c.atkDur = (w && !w.ranged ? w.speed : 1.1) * (1.3 - c.sk.destreza * 0.005);
    c.atkT = 0;
    c.atkDone = false;
    c.atkKind = w && (w.hold === 'dos' || w.hold === 'fusil') ? 'golpe' : 'tajo';
    sim.emit({ t: 'ataque', id: c.id });
    return true;
  }
  // Saquear el almacén
  c.pose = 'arrodillado';
  c.work = 'rebuscar';
  c.workT += dt;
  if (c.workT < 2.2) return true;
  c.workT = 0;
  const food = o.data === 'comida';
  const cap = maxCarry(c) * 1.1;
  const pool = b.store.filter((s) => (food ? !!ITEMS[s.id]?.food : true)).sort((a, x) => unitValue(x) / Math.max(0.05, ITEMS[x.id].w) - unitValue(a) / Math.max(0.05, ITEMS[a.id].w));
  const took: string[] = [];
  for (const s of pool) {
    const w = ITEMS[s.id]?.w ?? 0.1;
    const can = Math.max(0, Math.floor((cap - invWeight(c)) / Math.max(0.01, w)));
    const n = Math.min(s.n, can);
    if (n <= 0) continue;
    addItem(c, s.id, n, { ...stackState(s), hot: 'saqueo' });
    s.n -= n;
    took.push(ITEMS[s.id].name.toLowerCase());
  }
  b.store = b.store.filter((s) => s.n > 0);
  if (took.length) {
    sim.log(`Los asaltantes saquean ${BUILDS[b.def].name.toLowerCase()}: se llevan ${[...new Set(took)].slice(0, 3).join(', ')}${took.length > 3 ? '…' : ''}.`, 'malo');
    sim.emit({ t: 'sonido', k: 'coger', x: b.x, z: b.z });
  }
  return false;
}

// ---------------------------------------------------------------------------
// Visitas: tributo y registro
// ---------------------------------------------------------------------------

/** Lo robado a una facción (o lo prohibido en ella) que lleva tu gente o guarda tu base. */
export function contrabandFor(sim: Sim, f: FactionId, base?: Base | null): { where: Stack[]; s: Stack }[] {
  const out: { where: Stack[]; s: Stack }[] = [];
  const theirs = new Set(Object.values(sim.state.stations).filter((st) => st.owner === f).map((st) => st.id));
  theirs.add(f);
  const bad = (s: Stack) => (!!s.hot && theirs.has(s.hot)) || (f === 'CAL' && s.id === 'samogon');
  for (const c of sim.players) {
    if (c.captive || (base && Math.hypot(c.x - base.x, c.z - base.z) > 60)) continue;
    for (const s of c.inv) if (bad(s)) out.push({ where: c.inv, s });
  }
  if (base) {
    for (const id of base.ids) {
      const b = sim.state.buildings.find((q) => q.id === id);
      if (b) for (const s of b.store) if (bad(s)) out.push({ where: b.store, s });
    }
  }
  return out;
}

/** Facción que manda en la zona de un asentamiento (la de la estación más cercana por los túneles). */
export function neighbourFaction(sim: Sim, base: Base): FactionId | null {
  let best: FactionId | null = null;
  let bd = 1300;
  for (const st of Object.values(sim.state.stations)) {
    const f = st.owner as FactionId | null;
    if (!f || !FACTIONS.includes(f) || f === 'VHL') continue;
    const p = placePos(sim, st.id);
    if (!p) continue;
    const d = sim.world.graph.travelDistance(p.x, p.z, base.x, base.z);
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}

/** Lo que piden de tributo por un asentamiento. */
export function tributeFor(sim: Sim, base: Base): number {
  return Math.round(Math.max(30, Math.min(320, 15 + base.n * 6 + sim.state.money * 0.06)) / 5) * 5;
}

/**
 * Cada pocos días, la facción que manda en la zona visita tu asentamiento más
 * grande: a cobrar un tributo «por la protección» o a registrar en busca de lo
 * robado y lo prohibido.
 */
export function stepVisits(sim: Sim): void {
  const st = sim.state;
  const bases = playerBases(sim);
  const base = bases[0];
  if (!base || base.n < 4) return;
  const t = st.timers.visitaFaccion;
  if (t === undefined) {
    st.timers.visitaFaccion = st.time + (2 + sim.rng.next() * 1.5) * DAY;
    return;
  }
  if (st.time < t) return;
  st.timers.visitaFaccion = st.time + (2.5 + sim.rng.next() * 2) * DAY;
  if (st.squads.some((s) => s.kind === 'visita')) return;
  const f = neighbourFaction(sim, base);
  if (!f || st.rep[f] <= -50 || st.bounty[f] >= 100) return;
  const from = Object.values(st.stations).filter((s) => s.owner === f).map((s) => placePos(sim, s.id)!).filter(Boolean).sort((a, b) => Math.hypot(a.x - base.x, a.z - base.z) - Math.hypot(b.x - base.x, b.z - base.z))[0];
  if (!from) return;
  const smuggled = contrabandFor(sim, f, base).length > 0;
  const kind: 'tributo' | 'registro' = smuggled && sim.rng.chance(0.65) ? 'registro' : f === 'NOR' ? 'registro' : 'tributo';
  const roster: Role[] = f === 'STA' ? ['comerciante', 'mercenario', 'mercenario'] : ['oficial', 'soldado', 'soldado'];
  const q = sim.world.nav.nearestPassable(from.x, from.z, 10) ?? from;
  const home = Object.values(st.stations).find((s) => s.owner === f && placePos(sim, s.id) === from)?.id ?? '';
  const sq = newSquad(sim, f, 'visita', kind === 'tributo' ? 'Recaudadores' : 'Inspección', roster, q, [], home);
  sq.visit = kind;
  sq.demand = kind === 'tributo' ? tributeFor(sim, base) : 0;
  sq.life = 1.5 * DAY;
  const p = sim.world.nav.nearestPassable(base.x, base.z, 10) ?? base;
  sq.gx = p.x;
  sq.gz = p.z;
  sq.mode = 'viaje';
  sim.log(
    kind === 'tributo'
      ? `${FACTION_LORE[f].name} manda recaudadores a ${base.name}: «por la protección de los túneles».`
      : `${FACTION_LORE[f].name} manda una inspección a ${base.name}. Buscan lo robado y lo prohibido.`,
    'info',
  );
}

/**
 * Llegada de una visita: si hay alguien de tu gente, se habla (la interfaz
 * abre la ventana); si no, al rato se cobran ellos mismos del almacén.
 */
export function stepVisitArrival(sim: Sim, s: Squad): void {
  if (s.kind !== 'visita' || s.done) return;
  if (s.mat) {
    const lead = s.roster.map((m) => (m.id ? sim.char(m.id) : null)).find((c) => c && c.st === 'ok') ?? null;
    if (!lead) return;
    const near = sim.players.some((c) => c.st === 'ok' && !c.captive && Math.hypot(c.x - lead.x, c.z - lead.z) < 20);
    if (near && !s.talked && Math.hypot(s.gx - lead.x, s.gz - lead.z) < 25) {
      s.talked = true;
      sim.emit({ t: 'mundo', k: 'visita', id: lead.id });
      return;
    }
  }
  // Sin nadie con quien hablar, esperan un par de horas y se cobran solos
  if (!s.talked && s.mode === 'espera' && s.wait <= 0) {
    const base = playerBases(sim)[0];
    if (!base) return retreat(sim, s);
    if (s.visit === 'tributo') {
      const took = takeValue(sim, base, s.demand ?? 50);
      sim.log(`Los recaudadores de ${FACTION_LORE[s.side as FactionId].shortName} no encuentran a nadie en ${base.name} y se cobran el tributo del almacén${took ? `: ${took}` : ''}.`, 'malo');
    } else {
      const found = contrabandFor(sim, s.side as FactionId, base).filter((x) => !sim.players.some((c) => c.inv === x.where));
      for (const x of found) {
        const i = x.where.indexOf(x.s);
        if (i >= 0) x.where.splice(i, 1);
      }
      if (found.length) sim.log(`La inspección de ${FACTION_LORE[s.side as FactionId].shortName} registra ${base.name} y requisa lo que encuentra.`, 'malo');
    }
    retreat(sim, s);
  }
}

/** Se cobran del almacén algo que valga `amount` cartuchos. Devuelve lo que se llevan. */
function takeValue(sim: Sim, base: Base, amount: number): string {
  let left = amount;
  const took: string[] = [];
  for (const id of base.ids) {
    const b = sim.state.buildings.find((q) => q.id === id);
    if (!b || BUILDS[b.def].turret) continue;
    for (const s of [...b.store].sort((a, x) => unitValue(x) - unitValue(a))) {
      if (left <= 0) break;
      const v = unitValue(s);
      if (v <= 0) continue;
      const n = Math.min(s.n, Math.ceil(left / v));
      s.n -= n;
      left -= n * v;
      took.push(ITEMS[s.id].name.toLowerCase());
    }
    b.store = b.store.filter((s) => s.n > 0);
  }
  return [...new Set(took)].slice(0, 3).join(', ');
}

/** Respuestas a una visita. Devuelven el texto con que acaba la conversación. */
export function answerVisit(sim: Sim, lead: Char, answer: 'pagar' | 'mitad' | 'negar' | 'registro' | 'soborno'): string {
  const s = lead.squad ? sim.squad(lead.squad) : null;
  const f = lead.side as FactionId;
  const st = sim.state;
  if (!s) return '';
  const base = playerBases(sim)[0] ?? null;
  const fl = FACTION_LORE[f];
  switch (answer) {
    case 'pagar': {
      const n = s.demand ?? 0;
      if (st.money < n) return 'No tienes cartuchos suficientes';
      st.money -= n;
      sim.rep(f, 3, 'pagar el tributo');
      retreat(sim, s);
      return `${lead.name} cuenta los cartuchos y asiente. «${fl.shortName} vela por estos túneles.»`;
    }
    case 'mitad': {
      const n = Math.round((s.demand ?? 0) / 2);
      if (st.money < n) return 'No tienes cartuchos suficientes';
      st.money -= n;
      sim.rep(f, -2);
      retreat(sim, s);
      return `«La mitad ahora y el resto cuando podáis.» ${lead.name} no parece contento, pero se marcha.`;
    }
    case 'negar': {
      sim.rep(f, -10, 'negarte a pagar');
      st.timers['castigo:' + f] = st.time + (0.8 + sim.rng.next() * 0.8) * DAY;
      retreat(sim, s);
      return `${lead.name} escupe al suelo. «Ya os acordaréis de este día.» Se van… por ahora.`;
    }
    case 'registro': {
      const found = contrabandFor(sim, f, base);
      if (!found.length) {
        sim.rep(f, 2);
        retreat(sim, s);
        return `Lo revuelven todo y no encuentran nada. «Todo en orden.» Se marchan.`;
      }
      let value = 0;
      for (const x of found) {
        value += unitValue(x.s) * x.s.n;
        const i = x.where.indexOf(x.s);
        if (i >= 0) x.where.splice(i, 1);
      }
      const fine = Math.min(st.money, Math.round(20 + value * 0.4));
      st.money -= fine;
      sim.rep(f, -4, 'contrabando');
      retreat(sim, s);
      return `Encuentran lo que buscaban: lo requisan todo y os multan con ${fine} cartuchos.`;
    }
    case 'soborno': {
      const n = bribeFor(sim, f, base);
      if (st.money < n) return 'No tienes cartuchos suficientes';
      st.money -= n;
      retreat(sim, s);
      return `${lead.name} se guarda los ${n} cartuchos sin mirar. «Aquí no hay nada que ver.»`;
    }
  }
  return '';
}

/** Lo que cuesta que una inspección mire hacia otro lado. */
export function bribeFor(sim: Sim, f: FactionId, base: Base | null): number {
  const value = contrabandFor(sim, f, base).reduce((a, x) => a + unitValue(x.s) * x.s.n, 0);
  return Math.round((40 + value * 0.3) / 5) * 5;
}

/** Facción enfadada que manda castigo: queda apuntada para el próximo asalto. */
export function punishPending(sim: Sim): FactionId[] {
  return FACTIONS.filter((f) => (sim.state.timers['castigo:' + f] ?? Infinity) <= sim.state.time);
}

export type { SideId };
export { toughen };
