// Creación de una partida nueva a partir de un comienzo.

import { SCENARIO_BY_ID } from '../data/escenarios';
import { ITEMS } from '../data/items';
import type { FactionId } from '../data/tipos';
import { SKILL_IDS } from '../data/skills';
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
  const at = placePos(sim, sc.place) ?? { x: 0, z: 0 };
  const f = world.layout.stationById[sc.place];
  // En las estaciones se empieza en un extremo del andén
  const start = f ? { x: f.x + f.ax * (f.hl * 0.35), z: f.z + f.az * (f.hl * 0.35) } : at;
  sc.members.forEach((m, i) => {
    const a = (i / sc.members.length) * Math.PI * 2;
    const p = world.nav.nearestPassable(start.x + Math.cos(a) * 1.4, start.z + Math.sin(a) * 1.4, 8) ?? world.nav.nearestPassable(at.x, at.z, 12) ?? at;
    const c = makeHuman(sim, m.from, m.role, p.x, p.z);
    c.side = 'JUG';
    c.player = true;
    c.persist = true;
    c.ai.mode = 'jugador';
    c.stance = 'defensivo';
    c.money = 0;
    c.face = a;
    // El equipo lo fija el comienzo, no el arquetipo
    c.inv = [];
    c.eq = {};
    if (m.weapon) {
      const r = ITEMS[m.weapon].weapon?.ranged;
      c.eq.arma = { id: m.weapon, n: 1, ...(r ? { mag: r.mag } : {}) };
    }
    for (const a2 of m.armor ?? []) {
      const def = ITEMS[a2];
      if (def?.armor) c.eq[def.armor.slot] = { id: a2, n: 1 };
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
