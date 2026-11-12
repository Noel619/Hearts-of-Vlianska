import { beforeAll, describe, expect, it } from 'vitest';
import { SCENARIOS } from '../src/data/escenarios';
import { STATIONS } from '../src/data/historia/mapa';
import { makeHuman } from '../src/sim/chars';
import { newGame } from '../src/sim/newGame';
import { buildWorld, type World } from '../src/sim/world';

let world: World;

beforeAll(() => {
  world = buildWorld();
});

describe('mundo', () => {
  it('tiene las dieciséis estaciones del plano', () => {
    expect(world.layout.stations.length).toBe(16);
    expect(STATIONS.length).toBe(16);
  });

  it('une por túneles todas las estaciones salvo las aisladas por derrumbes', () => {
    const g = world.graph;
    const a = world.layout.stationById.TSE;
    for (const f of world.layout.stations) {
      const r = g.route(a.x, a.z, f.x, f.z);
      expect(r, `ruta a ${f.id}`).not.toBeNull();
    }
  });

  it('corta el paso por los derrumbes al empezar la partida', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 7 });
    const mos = world.layout.stationById.MOS;
    const che = world.layout.stationById.CHE;
    expect(sim.world.graph.route(mos.x, mos.z, che.x, che.z)).toBeNull();
    const sta = world.layout.stationById.STA;
    expect(sim.world.graph.route(mos.x, mos.z, sta.x, sta.z)).not.toBeNull();
  });
});

describe('simulación', () => {
  it('crea todos los comienzos', () => {
    for (const sc of SCENARIOS) {
      const sim = newGame(world, { scenario: sc.id, seed: 11 });
      expect(sim.players.length, sc.id).toBe(sc.members.length);
      for (const p of sim.players) expect(world.nav.passableAt(p.x, p.z, true), `${sc.id}: ${p.name}`).toBe(true);
    }
  });

  it('avanza un minuto sin errores y puebla la estación', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 3 });
    for (let i = 0; i < 60 * 30; i++) sim.step(1 / 30);
    expect(sim.state.chars.length).toBeGreaterThan(3);
    expect(sim.state.time).toBeGreaterThan(59);
  });

  it('lleva a un personaje de una estación a otra', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 5 });
    const c = sim.players[0];
    const zve = world.layout.stationById.ZVE;
    const goal = world.nav.nearestPassable(zve.x, zve.z, 10)!;
    c.order = { t: 'mover', x: goal.x, z: goal.z };
    let arrived = false;
    for (let i = 0; i < 30 * 600 && !arrived; i++) {
      sim.step(1 / 30);
      if (Math.hypot(c.x - goal.x, c.z - goal.z) < 3) arrived = true;
    }
    expect(arrived).toBe(true);
  });

  it('resuelve un combate cuerpo a cuerpo', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 9 });
    const p = sim.players[0];
    const foe = makeHuman(sim, 'MUT', 'bandido', p.x + 2, p.z);
    foe.ai.mode = 'guardia';
    foe.ai.homeX = foe.x;
    foe.ai.homeZ = foe.z;
    sim.addChar(foe);
    for (const q of sim.players) q.stance = 'agresivo';
    let over = false;
    for (let i = 0; i < 30 * 240 && !over; i++) {
      sim.step(1 / 30);
      over = foe.st !== 'ok' || sim.players.every((q) => q.st !== 'ok');
    }
    expect(over).toBe(true);
  });
});
