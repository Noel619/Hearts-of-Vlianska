// El golpe de gracia: rematar a un caído es rápido y no tiene vuelta atrás,
// lo dé tu gente, la del metro o una fiera que se come a quien cae.
import { beforeAll, describe, expect, it } from 'vitest';
import { giveOrder } from '../src/sim/actions';
import { addItem, makeCreature, makeHuman } from '../src/sim/chars';
import { knockOut } from '../src/sim/combat';
import { defeatIntent, DEVOUR_TIME, dragAnchor } from '../src/sim/derrota';
import { newGame } from '../src/sim/newGame';
import { newSquad } from '../src/sim/population';
import { remateHow, remateSpec } from '../src/sim/remate';
import type { Sim } from '../src/sim/sim';
import type { Char, SimEvent } from '../src/sim/types';
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

/** Tiempo (s) hasta que se cumple algo, o Infinity. */
const timeUntil = (sim: Sim, max: number, until: () => boolean) => {
  for (let i = 0; i < max * 30; i++) {
    sim.step(1 / 30);
    if (until()) return (i + 1) / 30;
  }
  return Infinity;
};

/** Un miembro de la escuadra solo en mitad de un túnel largo, sin nadie más. */
function alone(seed: number, scenario = 'nadie'): { sim: Sim; c: Char } {
  const sim = newGame(world, { scenario, seed });
  const c = sim.players[0];
  for (const o of [...sim.state.chars]) if (o !== c) sim.removeChar(o);
  for (const s of [...sim.state.squads]) sim.removeSquad(s);
  const l = world.layout.links.filter((q) => q.length > 160 && !q.def.latent).sort((a, b) => b.length - a.length)[0];
  const m = linkPointAt(l, l.length / 2);
  const p = world.nav.nearestPassable(m.x, m.z, 4)!;
  c.x = p.x;
  c.z = p.z;
  sim.reindex();
  return { sim, c };
}

/** Un bandido inconsciente a unos metros. */
function downedBandit(sim: Sim, c: Char, d = 3, side: Char['side'] = 'VHL'): Char {
  const p = world.nav.nearestPassable(c.x + d, c.z, 4)!;
  const b = makeHuman(sim, side, 'bandido', p.x, p.z);
  b.ai.mode = 'escuadra';
  sim.addChar(b);
  knockOut(sim, b, 9999);
  sim.reindex();
  return b;
}

describe('rematar a un caído', () => {
  it('con un cuchillo: de rodillas y en un momento', () => {
    const { sim, c } = alone(1);
    c.eq.arma = { id: 'cuchillo', n: 1 };
    const b = downedBandit(sim, c);
    expect(remateHow(c)).toBe('clavar');
    giveOrder(c, { t: 'rematar', id: b.id });
    let knelt = false;
    const t = timeUntil(sim, 10, () => {
      if (c.pose === 'arrodillado') knelt = true;
      return b.st === 'muerto';
    });
    // Unos dos segundos de caminar y menos de uno de golpe
    expect(t).toBeLessThan(4);
    expect(knelt).toBe(true);
    expect(sim.state.stats.kills).toBe(1);
    expect(b.hp[1]).toBeLessThanOrEqual(-b.hpMax[1]);
    // Se recompone y deja la orden
    expect(run(sim, 3, () => !c.order)).toBe(true);
    expect(c.atkT).toBe(-1);
  });

  it('con una pistola: un tiro a quemarropa que gasta una bala', () => {
    const { sim, c } = alone(2);
    c.eq.arma = { id: 'pistola', n: 1, mag: 8 };
    const b = downedBandit(sim, c, 4);
    expect(remateHow(c)).toBe('tiro');
    sim.events.length = 0;
    giveOrder(c, { t: 'rematar', id: b.id });
    const t = timeUntil(sim, 10, () => b.st === 'muerto');
    const shots: SimEvent[] = sim.events.filter((e) => e.t === 'tiro');
    expect(t).toBeLessThan(4);
    expect(shots.length).toBe(1);
    expect(shots[0].t === 'tiro' && shots[0].low).toBe(true);
    expect(c.eq.arma!.mag).toBe(7);
  });

  it('sin balas en el cargador mete una a mano; sin ninguna, a culatazos', () => {
    const { sim, c } = alone(3);
    c.eq.arma = { id: 'pistola', n: 1, mag: 0 };
    c.inv = c.inv.filter((s) => s.id !== 'balas');
    expect(remateHow(c)).toBe('machacar');
    addItem(c, 'balas', 3);
    expect(remateHow(c)).toBe('tiro');
    const b = downedBandit(sim, c);
    giveOrder(c, { t: 'rematar', id: b.id });
    expect(run(sim, 10, () => b.st === 'muerto')).toBe(true);
    expect(c.inv.find((s) => s.id === 'balas')?.n).toBe(2);
  });

  it('sin arma, con las manos: tarda más, pero tampoco perdona', () => {
    const { sim, c } = alone(4);
    delete c.eq.arma;
    const b = downedBandit(sim, c, 2);
    expect(remateHow(c)).toBe('ahogar');
    expect(remateSpec(c).strike).toBeGreaterThan(2);
    giveOrder(c, { t: 'rematar', id: b.id });
    const t = timeUntil(sim, 15, () => b.st === 'muerto');
    expect(t).toBeGreaterThan(2);
    expect(t).toBeLessThan(7);
  });

  it('si el caído se levanta antes, vuelve a ser una pelea', () => {
    const { sim, c } = alone(5);
    delete c.eq.arma;
    const b = downedBandit(sim, c, 2);
    sim.state.rep.VHL = -80;
    b.koT = 0.5;
    giveOrder(c, { t: 'rematar', id: b.id });
    expect(run(sim, 6, () => b.st === 'ok')).toBe(true);
    run(sim, 0.5);
    expect(c.order?.t).not.toBe('rematar');
    expect(c.target).toBe(b.id);
  });

  it('rematar a quien no es enemigo es un asesinato', () => {
    const { sim, c } = alone(6);
    c.eq.arma = { id: 'cuchillo', n: 1 };
    const civ = downedBandit(sim, c, 3, 'UNI');
    civ.role = 'civil';
    sim.state.rep.UNI = 20;
    const b0 = sim.state.bounty.UNI;
    giveOrder(c, { t: 'rematar', id: civ.id });
    expect(run(sim, 10, () => civ.st === 'muerto')).toBe(true);
    expect(sim.state.bounty.UNI).toBeGreaterThan(b0 + 150);
  });

  it('las partidas viejas con la orden de atacar a un caído siguen sirviendo', () => {
    const { sim, c } = alone(7);
    c.eq.arma = { id: 'machete', n: 1 };
    const b = downedBandit(sim, c);
    c.order = { t: 'atacar', id: b.id, data: 'rematar' };
    expect(run(sim, 10, () => b.st === 'muerto')).toBe(true);
  });
});

describe('que te rematen a ti', () => {
  it('quien ha perdido a uno de los suyos a vuestras manos no hace prisioneros', () => {
    const { sim, c } = alone(10);
    const p = world.nav.nearestPassable(c.x + 3, c.z, 4)!;
    const sq = newSquad(sim, 'VHL', 'banda', 'Banda', ['bandido', 'bandido'], p, [], 'VHL');
    sq.angry = true;
    const a = makeHuman(sim, 'VHL', 'bandido', p.x, p.z);
    a.squad = sq.id;
    a.ai.mode = 'escuadra';
    sim.addChar(a);
    sq.roster[0].id = a.id;
    knockOut(sim, c, 9999);
    // Sin sangre de por medio: despojan o se lo llevan de esclavo
    expect(defeatIntent(sim, a, c)?.t).not.toBe('rematar');
    sq.blood = 1;
    expect(defeatIntent(sim, a, c)?.t).toBe('rematar');
    a.order = defeatIntent(sim, a, c)!;
    expect(run(sim, 10, () => c.st === 'muerto')).toBe(true);
    expect(sim.state.log.some((l) => l.msg.includes('rematad'))).toBe(true);
  });

  it('matar a uno de una banda deja cuentas pendientes con los demás', () => {
    const { sim, c } = alone(11);
    const p = world.nav.nearestPassable(c.x + 3, c.z, 4)!;
    const sq = newSquad(sim, 'VHL', 'banda', 'Banda', ['bandido'], p, [], 'VHL');
    const b = makeHuman(sim, 'VHL', 'bandido', p.x, p.z);
    b.squad = sq.id;
    sim.addChar(b);
    sq.roster[0].id = b.id;
    knockOut(sim, b, 9999);
    c.eq.arma = { id: 'cuchillo', n: 1 };
    giveOrder(c, { t: 'rematar', id: b.id });
    expect(run(sim, 10, () => b.st === 'muerto')).toBe(true);
    expect(sq.blood).toBe(1);
  });

  it('los cazarrecompensas os quieren vivos', () => {
    const { sim, c } = alone(12);
    const p = world.nav.nearestPassable(c.x + 3, c.z, 4)!;
    const sq = newSquad(sim, 'LIB', 'cazadores', 'Cazarrecompensas', ['jefe'], p, [], '');
    sq.hunt = 'UNI';
    sq.angry = true;
    sq.blood = 3;
    const h = makeHuman(sim, 'LIB', 'jefe', p.x, p.z);
    h.squad = sq.id;
    sim.addChar(h);
    knockOut(sim, c, 9999);
    expect(defeatIntent(sim, h, c)?.t).not.toBe('rematar');
  });
});

describe('las fieras', () => {
  it('una fiera que se pone a comer mata en unos segundos', () => {
    const { sim, c } = alone(20);
    const p = world.nav.nearestPassable(c.x + 1.5, c.z, 4)!;
    const sk = makeCreature(sim, 'skrebun', p.x, p.z);
    sk.ai.homeX = sk.x;
    sk.ai.homeZ = sk.z;
    sim.addChar(sk);
    knockOut(sim, c, 9999);
    sk.order = { t: 'devorar', id: c.id };
    const t = timeUntil(sim, 30, () => c.st === 'muerto');
    expect(t).toBeLessThan(DEVOUR_TIME.skrebun + 2);
    expect(sim.state.log.some((l) => l.msg.includes('devorad'))).toBe(true);
  });

  it('dos ratas acaban antes que una', () => {
    const times: number[] = [];
    for (const n of [1, 2]) {
      const { sim, c } = alone(21);
      knockOut(sim, c, 9999);
      for (let i = 0; i < n; i++) {
        const p = world.nav.nearestPassable(c.x + 1, c.z + (i ? 0.8 : -0.8), 4)!;
        const r = makeCreature(sim, 'rata', p.x, p.z);
        r.ai.homeX = r.x;
        r.ai.homeZ = r.z;
        sim.addChar(r);
        r.order = { t: 'devorar', id: c.id };
      }
      times.push(timeUntil(sim, 40, () => c.st === 'muerto'));
    }
    expect(times[0]).toBeLessThan(DEVOUR_TIME.rata + 3);
    expect(times[1]).toBeLessThan(times[0] - 1);
  });

  it('el skrebun tira hacia atrás, cogido de un tobillo, a tirones', () => {
    const { sim, c } = alone(22);
    const p = world.nav.nearestPassable(c.x + 2, c.z, 4)!;
    const nest = sim.world.graph.nodes
      .map((n) => world.nav.nearestPassable(n.x, n.z, 6))
      .filter((q): q is { x: number; z: number } => !!q)
      .sort((a, b) => Math.abs(Math.hypot(a.x - c.x, a.z - c.z) - 30) - Math.abs(Math.hypot(b.x - c.x, b.z - c.z) - 30))[0];
    const sk = makeCreature(sim, 'skrebun', p.x, p.z);
    sk.ai.homeX = nest.x;
    sk.ai.homeZ = nest.z;
    sim.addChar(sk);
    knockOut(sim, c, 9999);
    expect(run(sim, 30, () => c.carriedBy === sk.id)).toBe(true);
    // Mientras tira, va de espaldas: mira al cuerpo y se aleja de él
    let back = 0;
    let fwd = 0;
    const speeds: number[] = [];
    for (let i = 0; i < 30 * 8; i++) {
      const x0 = sk.x;
      const z0 = sk.z;
      sim.step(1 / 30);
      const mx = sk.x - x0;
      const mz = sk.z - z0;
      const m = Math.hypot(mx, mz);
      speeds.push(m * 30);
      if (m < 1e-4) continue;
      const dot = (mx * Math.cos(sk.face) + mz * Math.sin(sk.face)) / m;
      if (dot < -0.5) back++;
      else if (dot > 0.5) fwd++;
      // El cuerpo va delante de su hocico (con un paso de retraso al girar)
      const a = dragAnchor(sk);
      expect(Math.hypot(c.x - a.x, c.z - a.z)).toBeLessThan(0.35);
    }
    expect(back).toBeGreaterThan(fwd * 4);
    // A tirones: hay momentos casi parados y otros más rápidos
    expect(Math.min(...speeds.slice(30))).toBeLessThan(0.45);
    expect(Math.max(...speeds)).toBeGreaterThan(0.9);
  });
});
