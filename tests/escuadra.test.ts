// La escuadra: contratar sin clones, despedir y cambiar nombres.
import { beforeAll, describe, expect, it } from 'vitest';
import { countItem, NAME_MAX } from '../src/sim/chars';
import { canDismiss, dismiss, hire, renameChar } from '../src/sim/events';
import { newGame } from '../src/sim/newGame';
import { deserialize, serialize } from '../src/sim/save';
import type { Sim } from '../src/sim/sim';
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

describe('contratar', () => {
  it('quien se une deja su sitio en la cantina, sin dejar un clon', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 12 });
    run(sim, 3);
    sim.state.money = 5000;
    const r = sim.state.chars.find((c) => (c.hire ?? 0) > 0)!;
    expect(hire(sim, r)).toBeNull();
    sim.reindex();
    // La escuadra se va lejos y vuelve: la estación se vacía y se repuebla
    const home = { x: sim.players[0].x, z: sim.players[0].z };
    for (const c of sim.players) c.x += 900;
    sim.reindex();
    run(sim, 3);
    for (const c of sim.players) {
      c.x = home.x;
      c.z = home.z;
    }
    sim.reindex();
    run(sim, 3);
    expect(sim.state.chars.filter((c) => c.name === r.name && c.look?.seed === r.look?.seed).length).toBe(1);
  });
});

describe('despedir', () => {
  it('se va con lo puesto, deja la mochila en el suelo y se le puede volver a contratar', () => {
    const sim = newGame(world, { scenario: 'stalkers', seed: 41 });
    const c = sim.players.find((q) => q.eq.cara && q.inv.length)!;
    const n = sim.players.length;
    const carried = c.inv.map((s) => [s.id, s.n] as const);
    const worn = c.eq.arma!.id;
    const drops = sim.state.drops.length;
    expect(canDismiss(sim, c)).toBeNull();
    expect(dismiss(sim, c)).toBeNull();
    sim.reindex();
    expect(sim.players.length).toBe(n - 1);
    expect(c.player).toBe(false);
    expect(c.side).toBe('LIB');
    expect(c.inv.length).toBe(0);
    expect(c.eq.arma?.id).toBe(worn);
    expect(c.hire).toBeGreaterThan(0);
    expect(c.jobs.length).toBe(0);
    // Lo que llevaba queda en un bulto a sus pies
    expect(sim.state.drops.length).toBe(drops + 1);
    const d = sim.state.drops[sim.state.drops.length - 1];
    for (const [id, k] of carried) expect(countItem({ inv: d.items }, id)).toBe(k);
    // Se marcha hacia una estación habitada
    expect(sim.state.stations[c.ai.place]?.owner).toBeTruthy();
    const x0 = c.x;
    const z0 = c.z;
    run(sim, 10);
    expect(Math.hypot(c.x - x0, c.z - z0)).toBeGreaterThan(3);
    // Y vuelve si se le paga
    sim.state.money = 5000;
    expect(hire(sim, c)).toBeNull();
    sim.reindex();
    expect(sim.players.length).toBe(n);
  });

  it('no se puede despedir a quien está inconsciente ni al último que queda', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 43 });
    const [a, ...rest] = sim.players;
    a.st = 'ko';
    expect(canDismiss(sim, a)).toMatch(/inconsciente/);
    expect(dismiss(sim, a)).not.toBeNull();
    expect(a.player).toBe(true);
    a.st = 'ok';
    for (const c of rest) expect(dismiss(sim, c)).toBeNull();
    sim.reindex();
    expect(canDismiss(sim, a)).toMatch(/lo único/);
    expect(a.player).toBe(true);
  });

  it('suelta a quien llevaba a hombros', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 45 });
    const [a, b] = sim.players;
    a.carry = b.id;
    b.carriedBy = a.id;
    b.st = 'ko';
    expect(dismiss(sim, a)).toBeNull();
    expect(a.carry).toBe(0);
    expect(b.carriedBy).toBe(0);
  });
});

describe('nombres', () => {
  it('se cambian limpios y sin pasarse de largo', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 47 });
    const c = sim.players[0];
    const old = c.name;
    expect(renameChar(c, '   ')).not.toBeNull();
    expect(c.name).toBe(old);
    expect(renameChar(c, 'x'.repeat(NAME_MAX + 1))).not.toBeNull();
    expect(c.name).toBe(old);
    expect(renameChar(c, '  Lyosha   el   Tuerto ')).toBeNull();
    expect(c.name).toBe('Lyosha el Tuerto');
    // Y el nombre se guarda con la partida
    const back = deserialize(serialize(sim.state))!;
    expect(back.chars.find((q) => q.id === c.id)!.name).toBe('Lyosha el Tuerto');
  });
});
