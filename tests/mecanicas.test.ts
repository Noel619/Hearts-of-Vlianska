// Mecánicas de personaje: lo que se aprende al moverse y lo que estorba el equipo.
import { beforeAll, describe, expect, it } from 'vitest';
import { addItem, armorBulk, moveSpeed } from '../src/sim/chars';
import { sightRange } from '../src/sim/combat';
import { newGame } from '../src/sim/newGame';
import type { Sim } from '../src/sim/sim';
import type { Char } from '../src/sim/types';
import { buildWorld, type World } from '../src/sim/world';

let world: World;
beforeAll(() => {
  world = buildWorld();
});

const run = (sim: Sim, seconds: number, until?: () => boolean) => {
  for (let i = 0; i < seconds * 30; i++) {
    sim.step(1 / 30);
    if (until?.()) return true;
  }
  return until ? until() : true;
};

/** Manda a alguien de un extremo a otro del andén varias veces. */
function laps(sim: Sim, c: Char, n: number, walk = false) {
  const f = world.layout.stationById[sim.state.scenario === 'stalkers' ? 'SEV' : 'TSE'];
  const a = world.nav.nearestPassable(f.x + f.ax * f.hl * 0.6, f.z + f.az * f.hl * 0.6, 6)!;
  const b = world.nav.nearestPassable(f.x - f.ax * f.hl * 0.6, f.z - f.az * f.hl * 0.6, 6)!;
  for (let i = 0; i < n; i++) {
    const p = i % 2 ? a : b;
    c.order = { t: 'mover', x: p.x, z: p.z, data: walk ? 'andar' : undefined };
    run(sim, 120, () => !c.order);
  }
}

describe('aprender moviéndose', () => {
  it('el atletismo sube corriendo, y no andando', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 3 });
    const [runner, walker] = sim.players;
    runner.sk.atletismo = 10;
    walker.sk.atletismo = 10;
    laps(sim, runner, 6);
    laps(sim, walker, 6, true);
    expect(runner.sk.atletismo).toBeGreaterThan(10.5);
    expect(walker.sk.atletismo).toBe(10);
  });

  it('cargado se aprende antes, y la fuerza sube con el peso', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 5 });
    const [light, heavy] = sim.players;
    for (const c of [light, heavy]) {
      c.sk.atletismo = 10;
      c.sk.fuerza = 10;
      c.inv = [];
    }
    addItem(heavy, 'chatarra', 20);
    laps(sim, light, 6);
    laps(sim, heavy, 6);
    expect(heavy.sk.atletismo - 10).toBeGreaterThan((light.sk.atletismo - 10) * 1.3);
    expect(heavy.sk.fuerza).toBeGreaterThan(10);
    expect(light.sk.fuerza).toBe(10);
  });
});

describe('estorbo del equipo', () => {
  it('suma el estorbo de lo que se lleva puesto', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 9 });
    const c = sim.players[0];
    c.eq = {};
    expect(armorBulk(c)).toBe(0);
    c.eq.torso = { id: 'chalecoPlacas', n: 1 };
    c.eq.cabeza = { id: 'casco', n: 1 };
    expect(armorBulk(c)).toBeCloseTo(0.15, 5);
    // La mochila no estorba; la de stalker sí
    c.eq.mochila = { id: 'mochila', n: 1 };
    expect(armorBulk(c)).toBeCloseTo(0.15, 5);
    c.eq.mochila = { id: 'mochilaGrande', n: 1 };
    expect(armorBulk(c)).toBeCloseTo(0.21, 5);
  });

  it('con placas en sigilo te ven antes y avanzas más despacio', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 11 });
    const [sneaky, watcher] = sim.players;
    sneaky.eq = {};
    sneaky.sneak = true;
    sneaky.lamp = false;
    sneaky.lit = 0.4;
    const bare = sightRange(sim, watcher, sneaky);
    const slow = moveSpeed(sneaky, true);
    sneaky.eq.torso = { id: 'chalecoPlacas', n: 1 };
    expect(sightRange(sim, watcher, sneaky)).toBeCloseTo(bare * (1 + 0.12 * 2), 5);
    expect(moveSpeed(sneaky, true)).toBeLessThan(slow);
    // Sin sigilo, el chaleco no cambia nada
    sneaky.sneak = false;
    const open = sightRange(sim, watcher, sneaky);
    sneaky.eq = {};
    expect(sightRange(sim, watcher, sneaky)).toBeCloseTo(open, 5);
  });
});
