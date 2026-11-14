// Lo que pasa al caer: saqueo, cárcel, esclavitud, fugas, fieras y cazarrecompensas.
import { beforeAll, describe, expect, it } from 'vitest';
import { makeCreature, makeHuman } from '../src/sim/chars';
import { knockOut } from '../src/sim/combat';
import { bailCost, imprison, payBail, payBounty, prisonCells, PRISONS, release, setEscape, stepBountyHunters } from '../src/sim/derrota';
import { newGame } from '../src/sim/newGame';
import type { Sim } from '../src/sim/sim';
import type { Char } from '../src/sim/types';
import { buildWorld, type World } from '../src/sim/world';
import { linkPointAt } from '../src/world/layout';

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

/** Deja a solas a un miembro de la escuadra en mitad de un túnel largo y oscuro. */
function aloneInTunnel(sim: Sim): Char {
  const v = sim.players[0];
  for (const c of [...sim.state.chars]) if (c !== v) sim.removeChar(c);
  for (const s of [...sim.state.squads]) sim.removeSquad(s);
  const l = world.layout.links.filter((q) => q.length > 160 && !q.def.latent).sort((a, b) => b.length - a.length)[0];
  const m = linkPointAt(l, l.length / 2);
  const p = world.nav.nearestPassable(m.x, m.z, 4)!;
  v.x = p.x;
  v.z = p.z;
  sim.reindex();
  return v;
}

/** Quita de en medio a todos los que no son de la escuadra (tras dejar que aparezcan). */
function clearOthers(sim: Sim) {
  run(sim, 1);
  for (const c of [...sim.state.chars]) if (!c.player) sim.removeChar(c);
  for (const s of [...sim.state.squads]) sim.removeSquad(s);
  sim.reindex();
}

/** Lleva a toda la escuadra a un punto y la deja inconsciente. */
function downAll(sim: Sim, x: number, z: number, secs = 900) {
  sim.players.forEach((c, i) => {
    const p = world.nav.nearestPassable(x + i * 0.8, z, 4)!;
    c.x = p.x;
    c.z = p.z;
    knockOut(sim, c, secs);
  });
}

describe('prisiones', () => {
  it('cada facción con calabozos tiene sitio para presos', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 1 });
    for (const p of Object.values(PRISONS)) {
      const cells = prisonCells(sim, p!.place);
      expect(cells.length, p!.place).toBeGreaterThanOrEqual(6);
      for (const c of cells) expect(Number.isFinite(c.x) && Number.isFinite(c.z)).toBe(true);
    }
    // Las de Vhlainska y Rubezh tienen jaulas de verdad
    expect(prisonCells(sim, 'VHL').some((c) => c.cage)).toBe(true);
    expect(prisonCells(sim, 'RUB').filter((c) => c.cage).length).toBeGreaterThanOrEqual(2);
  });

  it('encerrar quita el equipo al depósito; la condena cumplida lo devuelve', () => {
    const sim = newGame(world, { scenario: 'veteranos', seed: 4 });
    const c = sim.players[0];
    const gun = c.eq.arma?.id;
    expect(gun).toBeTruthy();
    sim.state.bounty.UNI = 160;
    expect(imprison(sim, c, 'UNI')).toBe(true);
    expect(c.captive?.place).toBe('TSE');
    expect(c.eq.arma).toBeUndefined();
    expect(sim.state.bounty.UNI).toBe(0);
    const box = sim.state.containers.find((b) => b.seize && b.place === 'TSE')!;
    expect(box.items.some((s) => s.id === gun)).toBe(true);
    // Días de condena según lo que se debía
    const days = (c.captive!.until - sim.state.time) / 1440;
    expect(days).toBeGreaterThanOrEqual(2);
    sim.state.time = c.captive!.until + 1;
    run(sim, 1);
    expect(c.captive).toBeUndefined();
    expect(c.eq.arma?.id).toBe(gun);
  });

  it('la fianza saca a un preso y un esclavo se compra', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 6 });
    const [a, b] = sim.players;
    imprison(sim, a, 'SDR');
    imprison(sim, b, 'VHL');
    expect(a.captive?.kind).toBe('carcel');
    expect(b.captive?.kind).toBe('esclavo');
    expect(b.captive?.until).toBe(0);
    sim.state.money = 5000;
    const cost = bailCost(sim, a);
    expect(cost).toBeGreaterThan(0);
    expect(payBail(sim, a)).toBeNull();
    expect(sim.state.money).toBe(5000 - cost);
    expect(a.captive).toBeUndefined();
    expect(payBail(sim, b)).toBeNull();
    expect(b.captive).toBeUndefined();
  });

  it('un preso que fuerza los grilletes sin que le vean escapa, y le persiguen', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 8 });
    const c = sim.players[0];
    imprison(sim, c, 'CHE');
    // Nadie vigila: los de la junta están lejos
    clearOthers(sim);
    c.sk.cerraduras = 40;
    setEscape(c, true);
    expect(run(sim, 600, () => !c.captive)).toBe(true);
    expect(c.fled?.by).toBe('CHE');
    expect(sim.state.bounty.CHE).toBeGreaterThan(0);
  });

  it('los esclavos trabajan de día en el tajo', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 12 });
    const c = sim.players[0];
    imprison(sim, c, 'VHL');
    // Mediodía
    sim.state.time = Math.ceil(sim.state.time / 1440) * 1440 + 4 * 60;
    run(sim, 120);
    const cap = c.captive!;
    expect(cap.wx).toBeDefined();
    expect(Math.hypot(c.x - cap.wx!, c.z - cap.wz!)).toBeLessThan(1.5);
    expect(c.work).toBe('pico');
  });
});

describe('caer ante el enemigo', () => {
  it('los guardias se llevan a la cárcel a quien tiene la cabeza a precio', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 21 });
    run(sim, 2);
    sim.state.bounty.UNI = 140;
    const guard = sim.state.chars.find((o) => o.side === 'UNI' && o.ai.mode === 'guardia')!;
    expect(guard).toBeTruthy();
    downAll(sim, guard.x + 2, guard.z + 1);
    expect(run(sim, 900, () => sim.players.some((c) => c.captive))).toBe(true);
    const caught = sim.players.find((c) => c.captive)!;
    expect(caught.captive!.by).toBe('UNI');
    expect(caught.captive!.place).toBe('TSE');
  });

  it('los saqueadores despojan a los caídos', () => {
    const sim = newGame(world, { scenario: 'veteranos', seed: 22 });
    const v = sim.players[0];
    for (const c of sim.players) if (c !== v) sim.removeChar(c);
    sim.reindex();
    const gun = v.eq.arma!.id;
    const p = world.nav.nearestPassable(v.x + 3, v.z, 4)!;
    const bandit = makeHuman(sim, 'LIB', 'bandido', p.x, p.z);
    bandit.ai.mode = 'escuadra';
    bandit.ai.sub = 'enfadado';
    sim.addChar(bandit);
    knockOut(sim, v, 600);
    expect(run(sim, 60, () => !v.eq.arma)).toBe(true);
    expect(bandit.inv.some((s) => s.id === gun && s.hot === 'saqueo')).toBe(true);
  });

  it('las fieras devoran a los inconscientes', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 23 });
    const v = aloneInTunnel(sim);
    const p = world.nav.nearestPassable(v.x + 2, v.z, 4)!;
    const rat = makeCreature(sim, 'rata', p.x, p.z);
    rat.ai.homeX = rat.x;
    rat.ai.homeZ = rat.z;
    sim.addChar(rat);
    knockOut(sim, v, 9999);
    const hp0 = v.hp.reduce((a, b) => a + b, 0);
    run(sim, 40);
    expect(v.hp.reduce((a, b) => a + b, 0)).toBeLessThan(hp0 - 10);
    expect(v.wound.some((w) => w > 0)).toBe(true);
  });

  it('los skrebuns arrastran a su presa hasta el nido', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 24 });
    const v = aloneInTunnel(sim);
    const p = world.nav.nearestPassable(v.x + 2, v.z, 4)!;
    const nest = sim.world.graph.nodes.map((n) => world.nav.nearestPassable(n.x, n.z, 6)).filter((q): q is { x: number; z: number } => !!q).sort((a, b) => Math.abs(Math.hypot(a.x - v.x, a.z - v.z) - 30) - Math.abs(Math.hypot(b.x - v.x, b.z - v.z) - 30))[0];
    const sk = makeCreature(sim, 'skrebun', p.x, p.z);
    sk.ai.homeX = nest.x;
    sk.ai.homeZ = nest.z;
    sim.addChar(sk);
    knockOut(sim, v, 9999);
    expect(run(sim, 30, () => v.carriedBy === sk.id)).toBe(true);
    const d0 = Math.hypot(v.x - nest.x, v.z - nest.z);
    run(sim, 40);
    expect(Math.hypot(v.x - nest.x, v.z - nest.z)).toBeLessThan(d0 - 3);
  });
});

describe('recompensas', () => {
  it('pagar la recompensa calma a la facción', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 30 });
    sim.state.bounty.SDR = 120;
    sim.state.money = 1000;
    expect(payBounty(sim, 'SDR')).toBeNull();
    expect(sim.state.bounty.SDR).toBe(0);
    expect(sim.state.money).toBe(1000 - Math.round(120 * 1.5 + 20));
  });

  it('con la cabeza a buen precio salen cazarrecompensas', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 31 });
    sim.state.bounty.LEV = 200;
    stepBountyHunters(sim);
    sim.state.time = (sim.state.timers.cazadores ?? 0) + 1;
    stepBountyHunters(sim);
    const sq = sim.state.squads.find((s) => s.kind === 'cazadores');
    expect(sq?.hunt).toBe('LEV');
    expect(sq?.angry).toBe(true);
  });

  it('liberar por las malas deja huella', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 32 });
    const c: Char = sim.players[0];
    imprison(sim, c, 'CHE');
    release(sim, c, 'rescate');
    expect(c.captive).toBeUndefined();
    expect(c.fled?.by).toBe('CHE');
  });
});
