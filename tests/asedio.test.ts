// El primer suceso de la historia: el Asedio de Mertvaya.
import { beforeAll, describe, expect, it } from 'vitest';
import { BRIGADE, brigade, persuadeCouncil, resolveBattle, siegeState, siegeThread, stepSiege, SIEGE_DAY, SIEGE_NEWS_DAY, supplyFactor, warnCaliphate } from '../src/sim/asedio';
import { relKey } from '../src/sim/combat';
import { imprison, prisonOf } from '../src/sim/derrota';
import { priceMult } from '../src/sim/events';
import { storyThreads } from '../src/sim/hilos';
import { newGame } from '../src/sim/newGame';
import { placePos, spawnFigure } from '../src/sim/population';
import type { Sim } from '../src/sim/sim';
import { buildWorld, type World } from '../src/sim/world';
import { ITEMS } from '../src/data/items';

let world: World;
beforeAll(() => {
  world = buildWorld();
});

const DAY = 1440;

const run = (sim: Sim, seconds: number, until?: () => boolean) => {
  for (let i = 0; i < seconds * 30; i++) {
    sim.step(1 / 30);
    if (until?.()) return true;
  }
  return until ? until() : true;
};

/** Partida nueva con el suceso en la fase de reunión (día 6). */
function gathering(seed: number, scenario = 'nadie'): Sim {
  const sim = newGame(world, { scenario, seed });
  sim.state.time = (SIEGE_NEWS_DAY - 1) * DAY;
  stepSiege(sim);
  return sim;
}

/** Lleva la brigada (sin nadie cerca) hasta las barricadas de Mertvaya. */
function atTheGates(sim: Sim) {
  const s = siegeState(sim);
  sim.state.time = s.deadline;
  stepSiege(sim);
  const sq = brigade(sim)!;
  const p = placePos(sim, 'MER')!;
  sq.x = p.x;
  sq.z = p.z;
  sq.route = null;
  stepSiege(sim);
  return s;
}

/** Pone a tu gente en el andén de una estación. */
function standAt(sim: Sim, place: string) {
  const f = world.layout.stationById[place];
  for (const c of sim.players) {
    const p = world.nav.nearestPassable(f.x, f.z, 10)!;
    c.x = p.x;
    c.z = p.z;
  }
}

describe('el Asedio de Mertvaya', () => {
  it('el día 6 se sabe, y el Levantamiento reúne la brigada en Vysotnaya', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 1 });
    sim.state.time = (SIEGE_NEWS_DAY - 1) * DAY - 10;
    stepSiege(sim);
    expect(siegeState(sim).phase).toBe('espera');
    expect(siegeThread(sim)).toBeNull();
    sim.state.time += 20;
    sim.events.length = 0;
    stepSiege(sim);
    const s = siegeState(sim);
    expect(s.phase).toBe('reunion');
    expect(s.deadline).toBe((SIEGE_DAY - 1) * DAY);
    const sq = brigade(sim)!;
    expect(sq.side).toBe('LEV');
    expect(sq.roster.length).toBe(BRIGADE.length);
    const vys = placePos(sim, 'VYS')!;
    expect(Math.hypot(sq.x - vys.x, sq.z - vys.z)).toBeLessThan(15);
    expect(sim.events.some((e) => e.t === 'mundo' && e.k === 'suceso' && e.id === 1)).toBe(true);
    expect(siegeThread(sim)?.state).toBe('en curso');
    expect(storyThreads(sim).some((t) => t.id === 'asedio' && t.title === 'El Asedio de Mertvaya')).toBe(true);
  });

  it('si muere Belov, o acaba preso en tu base, el asedio no llega', () => {
    const a = gathering(2);
    a.state.flags.muerto_lev_belov = 1;
    stepSiege(a);
    expect(siegeState(a).result).toBe('frustrado');
    expect(siegeState(a).why).toBe('belov');
    const b = gathering(3);
    const stl = placePos(b, 'STL')!;
    const belov = spawnFigure(b, 'lev_belov', stl.x, stl.z, 0, 'STL')!;
    stepSiege(b);
    expect(siegeState(b).phase).toBe('reunion');
    belov.captive = { by: 'JUG', place: 'TSE', kind: 'carcel', x: belov.x, z: belov.z, face: 0, cage: true, until: 0, lock: 30, pick: 0, escaping: false };
    stepSiege(b);
    expect(siegeState(b).why).toBe('belov');
  });

  it('sin Baghdadi, el imán Karimov pide negociar y el Consejo aplaza el asalto', () => {
    for (const flag of ['baghdadiPreso', 'muerto_baghdadi']) {
      const sim = gathering(4);
      sim.state.flags[flag] = 1;
      stepSiege(sim);
      const s = siegeState(sim);
      expect(s.result).toBe('frustrado');
      expect(s.why).toBe('karimov');
      // Tregua: el Califato y el Levantamiento dejan de matarse a la vista
      expect(sim.state.rel[relKey('CAL', 'LEV')]).toBe(-40);
    }
  });

  it('con la confianza del Levantamiento se convence al Consejo de que el cerco basta', () => {
    const sim = gathering(5);
    expect(persuadeCouncil(sim)).toMatch(/reputación/);
    expect(siegeState(sim).phase).toBe('reunion');
    sim.state.rep.LEV = 40;
    expect(persuadeCouncil(sim)).toBeNull();
    expect(siegeState(sim).why).toBe('consejo');
  });

  it('una brigada deshecha en su campamento no sale', () => {
    const sim = gathering(6);
    const sq = brigade(sim)!;
    for (const m of sq.roster.slice(0, 12)) m.dead = true;
    stepSiege(sim);
    expect(siegeState(sim).why).toBe('brigada');
  });

  it('si no pasa nada, el día 16 la brigada cruza el Túnel de Mertvaya', () => {
    const sim = gathering(7);
    const s = siegeState(sim);
    sim.state.time = s.deadline - 1;
    stepSiege(sim);
    expect(s.phase).toBe('reunion');
    sim.state.time = s.deadline;
    stepSiege(sim);
    expect(s.phase).toBe('marcha');
    expect(Math.floor(sim.state.time / DAY) + 1).toBe(SIEGE_DAY);
    expect(sim.state.rel[relKey('CAL', 'LEV')]).toBe(-100);
    expect(s.leaders).toEqual(['baghdadi', 'cal_harbi']);
    const sq = brigade(sim)!;
    const mer = placePos(sim, 'MER')!;
    expect(Math.hypot(sq.gx - mer.x, sq.gz - mer.z)).toBeLessThan(12);
    expect(sim.world.graph.route(sq.x, sq.z, sq.gx, sq.gz)).toBeTruthy();
  });

  it('la brigada llega sola a Mertvaya y la batalla se decide aunque nadie la vea', () => {
    const sim = gathering(8);
    const s = siegeState(sim);
    sim.state.time = s.deadline - 1;
    const seen = new Set<string>();
    run(sim, DAY, () => {
      seen.add(s.phase);
      return s.phase === 'hecho';
    });
    expect([...seen]).toEqual(expect.arrayContaining(['marcha', 'asalto', 'hecho']));
    expect(s.result === 'conquista' || s.result === 'rechazo').toBe(true);
    // Muertos en ambos bandos
    expect(brigade(sim)!.roster.some((m) => m.dead)).toBe(true);
    expect(Object.keys(sim.state.stations.MER.dead).length).toBeGreaterThan(0);
    expect(s.report![0]).toMatch(/Caen \d+ defensor/);
  });

  it('si cae Mertvaya: cambia de manos, Baghdadi y al-Harbi caen, Karimov pacta y los esclavos salen libres', () => {
    const sim = gathering(9);
    const s = atTheGates(sim);
    expect(s.phase).toBe('asalto');
    // Uno de los tuyos, esclavo en el manantial
    const slave = sim.players[0];
    expect(imprison(sim, slave, 'CAL')).toBe(true);
    resolveBattle(sim, s, 'conquista');
    expect(s.phase).toBe('hecho');
    expect(s.result).toBe('conquista');
    const mer = sim.state.stations.MER;
    expect(mer.owner).toBe('LEV');
    expect(mer.from).toBe('CAL');
    expect(brigade(sim)!.roster.some((m) => m.dead)).toBe(true);
    expect(Object.keys(mer.dead).length).toBeGreaterThan(0);
    expect(sim.state.flags.muerto_baghdadi).toBe(1);
    expect(sim.state.flags.muerto_cal_harbi).toBe(1);
    expect(sim.state.figureSide?.karimov).toBe('LEV');
    expect(sim.state.flags.huido_cal_aliyev).toBe(1);
    expect(slave.captive).toBeUndefined();
    expect(s.report!.length).toBeGreaterThan(2);
    // Se acabó el embargo (y el Califato ya no tiene dónde encerrar a nadie)
    const food = Object.keys(ITEMS).find((id) => ITEMS[id].kind === 'comida')!;
    expect(priceMult(sim, 'MER', food)).toBeLessThanOrEqual(1.15);
    expect(prisonOf(sim, 'CAL')).toBeNull();
    expect(storyThreads(sim).some((t) => t.id === 'galeria')).toBe(false);
  });

  it('si resiste, la brigada se retira y Mertvaya sigue siendo del Califato', () => {
    const sim = gathering(10);
    const s = atTheGates(sim);
    expect(warnCaliphate(sim)).toBe('Ya no hay tiempo');
    resolveBattle(sim, s, 'rechazo');
    expect(s.result).toBe('rechazo');
    expect(sim.state.stations.MER.owner).toBe('CAL');
    const sq = brigade(sim)!;
    expect(sq.done).toBe(true);
    expect(sq.mode).toBe('vuelta');
    expect(sq.roster.filter((m) => m.dead).length).toBeGreaterThan(sq.roster.length / 2);
    const food = Object.keys(ITEMS).find((id) => ITEMS[id].kind === 'comida')!;
    expect(priceMult(sim, 'MER', food)).toBeGreaterThan(2);
  });

  it('avisar a al-Harbi y meter comida en la estación endurecen la defensa', () => {
    const sim = gathering(11);
    expect(supplyFactor(sim)).toBeCloseTo(0.85);
    sim.state.flags.contrabando = 60;
    expect(supplyFactor(sim)).toBeCloseTo(1);
    sim.state.flags.galeriaOlvidada = 1;
    expect(supplyFactor(sim)).toBeCloseTo(1.15);
    const rep = sim.state.rep.CAL;
    expect(warnCaliphate(sim)).toBeNull();
    expect(siegeState(sim).warned).toBe(true);
    expect(sim.state.rep.CAL).toBeGreaterThan(rep);
    expect(warnCaliphate(sim)).toBe('Ya lo saben');
  });

  it('una Mertvaya conquistada se puebla de gente del Levantamiento… que sigue siendo de Izumrudnaya', () => {
    const sim = gathering(12);
    const s = atTheGates(sim);
    resolveBattle(sim, s, 'conquista');
    standAt(sim, 'MER');
    sim.state.time += 0.3 * DAY;
    run(sim, 2);
    const locals = sim.state.chars.filter((q) => q.slot?.startsWith('MER:'));
    expect(locals.length).toBeGreaterThan(5);
    expect(locals.some((q) => q.side === 'CAL')).toBe(false);
    expect(locals.filter((q) => q.side === 'LEV').length).toBeGreaterThan(locals.length / 2);
    // Los vecinos llevan su túnica de siempre bajo la bandera roja
    const neighbours = locals.filter((q) => q.slot!.includes(':v'));
    expect(neighbours.length).toBeGreaterThan(0);
    expect(neighbours.every((q) => q.side === 'LEV' && q.look?.top === 'tunica')).toBe(true);
  });

  it('con tu gente en Mertvaya, la batalla se libra de verdad y muere gente', () => {
    // «La Esmeralda»: tu gente empieza dentro de la estación sitiada
    const sim = gathering(13, 'esmeralda');
    const s = siegeState(sim);
    for (const c of sim.players) c.stance = 'pasivo';
    sim.state.time = s.deadline - 1;
    const deadBefore = sim.state.chars.filter((q) => q.st === 'muerto').length;
    run(sim, 900, () => s.phase === 'hecho');
    expect(s.phase).toBe('hecho');
    expect(s.result === 'conquista' || s.result === 'rechazo').toBe(true);
    const sq = brigade(sim)!;
    const dead = sim.state.chars.filter((q) => q.st === 'muerto' && !q.player).length - deadBefore + sq.roster.filter((m) => m.dead && !m.id).length;
    expect(dead).toBeGreaterThan(0);
  });
});
