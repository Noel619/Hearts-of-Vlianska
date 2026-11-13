// El gas de los túneles: quema el pecho a quien lo respira a pelo, las máscaras
// lo dejan fuera mientras aguanta el filtro y la escuadra no se queda dentro sin motivo.
import { beforeAll, describe, expect, it } from 'vitest';
import { FILTER_LIFE, GASES } from '../src/data/gases';
import { addItem, countItem, makeCreature } from '../src/sim/chars';
import { sightRange } from '../src/sim/combat';
import { breathable, stepGas } from '../src/sim/gas';
import { newGame } from '../src/sim/newGame';
import { deserialize, serialize } from '../src/sim/save';
import type { Sim } from '../src/sim/sim';
import type { Char } from '../src/sim/types';
import { buildWorld, placeId, type World } from '../src/sim/world';

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

const pocket = (id: string) => world.gas.pockets.find((p) => p.def.id === id)!;

/** Lleva a alguien al centro de una bolsa, sin bichos ni bandas alrededor que estorben la prueba. */
function into(sim: Sim, c: Char, id: string) {
  const p = pocket(id);
  const at = world.nav.nearestPassable(p.x, p.z, 4, true)!;
  c.x = at.x;
  c.z = at.z;
  c.order = null;
  c.queue.length = 0;
  c.hold = true;
  sim.state.squads = sim.state.squads.filter((s) => s.kind === 'jugador');
  sim.state.chars = sim.state.chars.filter((o) => o.player || Math.hypot(o.x - p.x, o.z - p.z) > 150);
  sim.reindex();
}

function bare(c: Char) {
  c.eq = {};
  c.inv = [];
}

describe('bolsas de gas', () => {
  it('existen todas, dentro de su túnel o su sala', () => {
    expect(world.gas.pockets.map((p) => p.def.id).sort()).toEqual(GASES.map((g) => g.id).sort());
    for (const p of world.gas.pockets) {
      expect(world.gas.at(p.x, p.z), p.def.id).toBeCloseTo(p.def.peak, 1);
      expect(placeId(world, p.x, p.z), p.def.id).toBe(p.place);
      // Fuera de la bolsa, aire limpio
      for (const e of p.exits) expect(world.gas.at(e.x, e.z), `${p.def.id}: salida`).toBeLessThan(0.02);
    }
    // Ninguna estación tiene gas
    for (const f of world.layout.stations) expect(world.gas.at(f.x, f.z), f.id).toBe(0);
  });
});

describe('respirar gas', () => {
  it('a pelo quema el pecho, hace toser y acaba tumbando', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 21 });
    const c = sim.players[0];
    bare(c);
    into(sim, c, 'aliento');
    let coughs = 0;
    const chest = c.hp[1];
    for (let i = 0; i < 30 * 20; i++) {
      sim.step(1 / 30);
      coughs += sim.events.filter((e) => e.t === 'sonido' && e.k === 'tos').length;
      sim.events.length = 0;
    }
    expect(c.gas).toBeGreaterThan(0.8);
    expect(c.hp[1]).toBeLessThan(chest - 15);
    expect(coughs).toBeGreaterThan(0);
    run(sim, 100, () => c.st !== 'ok');
    expect(c.st).toBe('ko');
    expect(sim.state.log.some((l) => l.msg.includes('en el gas'))).toBe(true);
  });

  it('quien cae inconsciente dentro se asfixia; si lo sacan, se recupera', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 23 });
    const [a, b] = sim.players;
    bare(a);
    bare(b);
    into(sim, a, 'aliento');
    into(sim, b, 'aliento');
    a.hp[1] = 1;
    b.hp[1] = 1;
    run(sim, 2);
    expect(a.st).toBe('ko');
    expect(b.st).toBe('ko');
    // A uno lo sacan a un sitio limpio
    const out = world.nav.nearestPassable(pocket('aliento').exits[0].x, pocket('aliento').exits[0].z, 6, true)!;
    b.x = out.x;
    b.z = out.z;
    run(sim, 150);
    expect(a.st).toBe('muerto');
    expect(b.st).not.toBe('muerto');
    expect(sim.state.log.some((l) => l.msg.includes('asfixiado por el gas'))).toBe(true);
  });

  it('la máscara antigás lo deja fuera y gasta el filtro; al agotarse pone otro', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 25 });
    const c = sim.players[0];
    bare(c);
    c.eq.cara = { id: 'mascaraGas', n: 1, fil: 30 };
    addItem(c, 'filtros', 1);
    into(sim, c, 'aliento');
    const chest = c.hp[1];
    run(sim, 20);
    expect(c.gas).toBe(0);
    expect(c.hp[1]).toBeGreaterThanOrEqual(chest - 0.01);
    // El primer filtro duraba 30 s a densidad 1: ya va por el de repuesto
    run(sim, 15);
    expect(countItem(c, 'filtros')).toBe(0);
    expect(c.eq.cara!.fil!).toBeGreaterThan(FILTER_LIFE - 30);
    expect(c.gas).toBe(0);
  });

  it('una máscara sin filtros no sirve; un compañero cercano le pasa uno', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 27 });
    const [c, friend] = sim.players;
    bare(c);
    bare(friend);
    c.eq.cara = { id: 'mascaraGas', n: 1 };
    into(sim, c, 'aliento');
    run(sim, 3);
    expect(c.gas).toBeGreaterThan(0.8);
    addItem(friend, 'filtros', 2);
    friend.x = c.x + 1;
    friend.z = c.z;
    friend.hold = true;
    friend.eq.cara = { id: 'mascaraGas', n: 1, fil: FILTER_LIFE };
    sim.reindex();
    run(sim, 3);
    expect(c.gas).toBe(0);
    expect(countItem(friend, 'filtros')).toBe(1);
  });

  it('el respirador basta con el gas ligero, no con el denso', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 29 });
    const c = sim.players[0];
    bare(c);
    c.eq.cara = { id: 'respirador', n: 1, fil: FILTER_LIFE };
    into(sim, c, 'superficie');
    run(sim, 3);
    expect(c.gas).toBe(0);
    expect(breathable(sim, c, c.x, c.z)).toBe(true);
    into(sim, c, 'aliento');
    run(sim, 3);
    expect(c.gas).toBeGreaterThan(0.4);
    expect(c.gas).toBeLessThan(0.6);
    expect(breathable(sim, c, c.x, c.z)).toBe(false);
  });

  it('las criaturas no lo notan (y hay un nido dentro del Aliento)', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 31 });
    expect(world.decor.spots.some((s) => s.kind === 'nido' && world.gas.at(s.x, s.z) > 0.3)).toBe(true);
    const p = pocket('aliento');
    const beast = makeCreature(sim, 'skrebun', p.x, p.z);
    const chest = beast.hp[1];
    stepGas(sim, beast, 10);
    expect(beast.gas).toBe(0);
    expect(beast.hp[1]).toBe(chest);
  });

  it('quien tose por el gas no pasa desapercibido', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 33 });
    const [c, watcher] = sim.players;
    bare(c);
    c.sneak = true;
    c.lit = 0.3;
    const hidden = sightRange(sim, watcher, c);
    c.gas = 0.6;
    expect(sightRange(sim, watcher, c)).toBeGreaterThan(hidden * 1.2);
  });
});

describe('la escuadra y el gas', () => {
  it('sin órdenes, se aparta del gas; con «mantener posición», se queda', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 35 });
    const [a, b] = sim.players;
    bare(a);
    bare(b);
    into(sim, a, 'hondonada');
    into(sim, b, 'hondonada');
    a.hold = false;
    run(sim, 1);
    expect(a.gas).toBeGreaterThan(0.5);
    run(sim, 60, () => a.gas === 0 && !a.hasDest);
    expect(a.gas).toBe(0);
    expect(world.gas.at(a.x, a.z)).toBeLessThan(0.05);
    expect(b.gas).toBeGreaterThan(0);
  });

  it('no va a un trabajo fijo dentro del gas sin máscara', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 37 });
    const c = sim.players[0];
    bare(c);
    const salt = sim.state.nodes.find((n) => n.kind === 'salitre' && world.gas.at(n.x, n.z) > 0.3)!;
    expect(salt, 'salitre en la Galería de las Tuberías').toBeTruthy();
    const out = pocket('tuberias').exits[0];
    const p = world.nav.nearestPassable(out.x, out.z, 6, true)!;
    c.x = p.x;
    c.z = p.z;
    c.hold = false;
    c.jobs = [{ t: 'chatarrear', id: salt.id }];
    sim.reindex();
    run(sim, 10);
    expect(c.order).toBeNull();
    // Con máscara y filtro, sí
    c.eq.cara = { id: 'mascaraGas', n: 1, fil: FILTER_LIFE };
    run(sim, 10);
    expect(c.order?.t).toBe('chatarrear');
  });

  it('el filtro gastado viaja con la máscara y se guarda con la partida', () => {
    const sim = newGame(world, { scenario: 'stalkers', seed: 39 });
    const st = sim.players.find((c) => c.eq.cara?.id === 'mascaraGas')!;
    expect(st.eq.cara!.fil).toBe(FILTER_LIFE);
    st.eq.cara!.fil = 123;
    const back = deserialize(serialize(sim.state))!;
    const again = back.chars.find((c) => c.id === st.id)!;
    expect(again.eq.cara!.fil).toBe(123);
    expect(again.gas).toBe(0);
  });
});
