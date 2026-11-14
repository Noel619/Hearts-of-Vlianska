// Creación de una partida nueva a partir de un comienzo.

import { SCENARIO_BY_ID, type Scenario } from '../data/escenarios';
import { FILTER_LIFE } from '../data/gases';
import { ITEMS } from '../data/items';
import type { FactionId } from '../data/tipos';
import { SKILL_IDS } from '../data/skills';
import { annexCentre, annexPoint, LANDING } from '../world/arch';
import { stationToWorld } from '../world/layout';
import { addItem, makeHuman } from './chars';
import { seedWorld } from './events';
import { placePos, seedPacks } from './population';
import { Sim, blankState } from './sim';
import { resetWorld, type World } from './world';

export interface NewGameOptions {
  scenario: string;
  seed?: number;
  name?: string;
  color?: number;
}

/**
 * Dónde empieza la escuadra y hacia dónde mira: en la sala o el rincón que
 * dice su comienzo (al pie de las escaleras, si la sala sube a la superficie),
 * o en un extremo del andén.
 */
export function startPoint(sim: Sim, sc: Scenario): { x: number; z: number; face: number } {
  const world = sim.world;
  const f = world.layout.stationById[sc.place];
  const at = placePos(sim, sc.place) ?? { x: 0, z: 0 };
  const toward = (x: number, z: number, tx: number, tz: number) => ({ x, z, face: Math.atan2(tz - z, tx - x) });
  if (f && sc.at && 'annex' in sc.at) {
    const id = sc.at.annex;
    const a = f.annexes.find((q) => q.id === id);
    if (a) {
      // Las salas que suben a la superficie se toman al pie de la escalera, mirando a la estación
      const [u, v] = a.exit || a.rise > 0.5 ? annexPoint(a, LANDING * 0.55, 0) : annexCentre(a);
      const p = stationToWorld(f, u, v);
      return toward(p.x, p.z, f.x, f.z);
    }
  }
  if (sc.at && 'spot' in sc.at) {
    const { spot, data } = sc.at;
    const sp = world.decor.spots.find((s) => s.place === sc.place && s.kind === spot && (data === undefined || s.data === data));
    if (sp) return toward(sp.x, sp.z, f ? f.x : at.x, f ? f.z : at.z);
  }
  // En las estaciones, en un extremo del andén
  if (f) return toward(f.x + f.ax * (f.hl * 0.35), f.z + f.az * (f.hl * 0.35), f.x, f.z);
  return { x: at.x, z: at.z, face: 0 };
}

export function newGame(world: World, opts: NewGameOptions): Sim {
  const sc = SCENARIO_BY_ID[opts.scenario] ?? SCENARIO_BY_ID.nadie;
  const seed = opts.seed ?? ((Date.now() & 0x7fffffff) || 1);
  const state = blankState(seed);
  state.scenario = sc.id;
  state.money = sc.money;
  if (opts.name) state.playerName = opts.name;
  if (opts.color !== undefined) state.playerColor = opts.color;
  resetWorld(world);
  const sim = new Sim(world, state);
  seedWorld(sim);
  seedPacks(sim);
  for (const [f, v] of Object.entries(sc.rep ?? {})) state.rep[f as FactionId] = v as number;
  for (const [f, v] of Object.entries(sc.bounty ?? {})) state.bounty[f as FactionId] = v as number;
  Object.assign(state.flags, sc.flags ?? {});
  const at = placePos(sim, sc.place) ?? { x: 0, z: 0 };
  const start = startPoint(sim, sc);
  // Ya estáis aquí: la llegada no se anuncia como si acabarais de entrar
  if (state.stations[sc.place]) state.stations[sc.place].visited = true;
  sc.members.forEach((m, i) => {
    // En fila, uno al lado del otro, mirando hacia donde mira el sitio
    const off = (i - (sc.members.length - 1) / 2) * 0.95;
    const px = start.x - Math.sin(start.face) * off;
    const pz = start.z + Math.cos(start.face) * off;
    const p = world.nav.nearestPassable(px, pz, 3) ?? world.nav.nearestPassable(start.x, start.z, 8) ?? world.nav.nearestPassable(at.x, at.z, 12) ?? at;
    const c = makeHuman(sim, m.from, m.role, p.x, p.z);
    c.side = 'JUG';
    c.player = true;
    c.persist = true;
    c.ai.mode = 'jugador';
    c.stance = 'defensivo';
    c.money = 0;
    c.face = start.face;
    // El equipo lo fija el comienzo, no el arquetipo
    c.inv = [];
    c.eq = {};
    if (m.weapon) {
      const r = ITEMS[m.weapon].weapon?.ranged;
      c.eq.arma = { id: m.weapon, n: 1, ...(r ? { mag: Math.min(r.mag, m.mag ?? r.mag) } : {}) };
    }
    for (const a2 of m.armor ?? []) {
      const def = ITEMS[a2];
      if (def?.armor) c.eq[def.armor.slot] = def.armor.filter ? { id: a2, n: 1, fil: FILTER_LIFE * (m.filter ?? 1) } : { id: a2, n: 1 };
    }
    for (const [id, n] of m.items ?? []) addItem(c, id, n);
    if (c.inv.some((s) => s.id === 'linterna')) c.lamp = true;
    const k = m.skill ?? 1;
    // Nadie empieza siendo un experto
    for (const s of SKILL_IDS) c.sk[s] = Math.max(1, Math.min(60, c.sk[s] * k * 0.8));
    if (c.look) c.look = { ...c.look, armband: state.playerColor };
    if (sc.hungry) c.hunger = 22 + sim.rng.next() * 10;
    if (sc.hurt) {
      c.hp[5] = c.hpMax[5] * 0.5;
      c.hp[1] = c.hpMax[1] * 0.7;
    }
    sim.addChar(c);
  });
  sim.reindex();
  sim.log('Enero de 2033. Veinte años después de las bombas, el metro de Vlianska sigue vivo.', 'historia');
  for (const line of sc.intro) sim.log(line, 'historia');
  return sim;
}
