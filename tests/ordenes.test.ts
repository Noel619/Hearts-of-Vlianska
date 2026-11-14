// Órdenes de la escuadra: una orden nueva sustituye a la anterior en el acto
// y las encadenadas (Mayús) se cumplen en orden.
import { beforeAll, describe, expect, it } from 'vitest';
import { giveOrder } from '../src/sim/actions';
import { newGame } from '../src/sim/newGame';
import type { Sim } from '../src/sim/sim';
import type { Char } from '../src/sim/types';
import { buildWorld, type World } from '../src/sim/world';

let world: World;
beforeAll(() => {
  world = buildWorld();
});

const step = (sim: Sim, seconds: number, until?: () => boolean) => {
  for (let i = 0; i < seconds * 30; i++) {
    sim.step(1 / 30);
    if (until?.()) return true;
  }
  return until ? until() : true;
};

const dist = (c: Char, p: { x: number; z: number }) => Math.hypot(c.x - p.x, c.z - p.z);

/** Dos puntos alcanzables a lados opuestos del personaje. */
function opposite(sim: Sim, c: Char, r = 12): { a: { x: number; z: number }; b: { x: number; z: number } } {
  const nav = sim.world.nav;
  for (let rr = r; rr >= 6; rr -= 1) {
    for (let ang = 0; ang < Math.PI * 2; ang += 0.2) {
      const a = { x: c.x + Math.cos(ang) * rr, z: c.z + Math.sin(ang) * rr };
      const b = { x: c.x - Math.cos(ang) * rr, z: c.z - Math.sin(ang) * rr };
      if (!nav.walkLine(c.x, c.z, a.x, a.z, true) || !nav.walkLine(c.x, c.z, b.x, b.z, true)) continue;
      return { a, b };
    }
  }
  throw new Error('sin sitio para la prueba');
}

/** Una escuadra de uno, con los demás quietos y sin nadie que moleste. */
function solo(seed: number) {
  const sim = newGame(world, { scenario: 'nadie', seed });
  step(sim, 1);
  const c = sim.players[0];
  for (const q of sim.players) if (q !== c) q.hold = true;
  return { sim, c };
}

describe('órdenes de movimiento', () => {
  it('un segundo clic cambia el rumbo en el acto, sin terminar el camino viejo', () => {
    const { sim, c } = solo(3);
    const { a, b } = opposite(sim, c);
    giveOrder(c, { t: 'mover', x: a.x, z: a.z });
    step(sim, 1.2);
    const a0 = Math.hypot(a.x - b.x, a.z - b.z) / 2;
    expect(dist(c, a)).toBeLessThan(a0 - 1);
    // Cambia de idea a medio camino
    giveOrder(c, { t: 'mover', x: b.x, z: b.z });
    const d0 = dist(c, b);
    step(sim, 1);
    expect(dist(c, b)).toBeLessThan(d0 - 1.5);
    let nearA = false;
    const arrived = step(sim, 30, () => {
      if (dist(c, a) < 1) nearA = true;
      return dist(c, b) < 0.8 && !c.order;
    });
    expect(arrived).toBe(true);
    expect(nearA).toBe(false);
  });

  it('corrige el rumbo aunque la orden cambie sin pasar por la interfaz', () => {
    const { sim, c } = solo(4);
    const { a, b } = opposite(sim, c);
    c.order = { t: 'mover', x: a.x, z: a.z };
    step(sim, 1.2);
    // Orden sustituida directamente (como hacen los sucesos): el destino viejo sigue puesto
    c.order = { t: 'mover', x: b.x, z: b.z };
    const d0 = dist(c, b);
    step(sim, 1);
    expect(dist(c, b)).toBeLessThan(d0 - 1.5);
    expect(step(sim, 30, () => dist(c, b) < 0.8 && !c.order)).toBe(true);
  });

  it('con Mayús encadena: primero un sitio y luego el otro', () => {
    const { sim, c } = solo(5);
    const { a, b } = opposite(sim, c, 9);
    giveOrder(c, { t: 'mover', x: a.x, z: a.z });
    giveOrder(c, { t: 'mover', x: b.x, z: b.z }, true);
    expect(c.queue.length).toBe(1);
    expect(step(sim, 20, () => dist(c, a) < 0.8)).toBe(true);
    expect(step(sim, 30, () => dist(c, b) < 0.8 && !c.order && !c.queue.length)).toBe(true);
  });

  it('una orden sin Mayús borra las encadenadas', () => {
    const { sim, c } = solo(6);
    const { a, b } = opposite(sim, c, 9);
    giveOrder(c, { t: 'mover', x: a.x, z: a.z });
    giveOrder(c, { t: 'mover', x: a.x + 0.5, z: a.z }, true);
    giveOrder(c, { t: 'mover', x: b.x, z: b.z });
    expect(c.queue.length).toBe(0);
    expect(step(sim, 30, () => dist(c, b) < 0.8 && !c.order)).toBe(true);
  });
});
