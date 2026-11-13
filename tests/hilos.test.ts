// Los hilos de la trama se pueden cerrar: la emisora capta la señal, la llave
// abre los almacenes de Tenevskaya y el diario sabe en qué punto está cada cosa.
import { beforeAll, describe, expect, it } from 'vitest';
import { canPlace, placeBuilding } from '../src/sim/build';
import { addItem, countItem } from '../src/sim/chars';
import { burnLetter, deliverLetter, isCivilDefense } from '../src/sim/events';
import { epilogue, firstSteps, storyThreads } from '../src/sim/hilos';
import { newGame } from '../src/sim/newGame';
import { deserialize, serialize } from '../src/sim/save';
import { Sim } from '../src/sim/sim';
import { buildWorld, resetWorld, type World } from '../src/sim/world';

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

function siteFor(sim: Sim, def: string): { x: number; z: number } {
  const p = sim.players[0];
  for (let r = 2.5; r < 24; r += 1) {
    for (let a = 0; a < 6.28; a += 0.4) {
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (canPlace(sim, def, x, z, 0) === null) return { x, z };
    }
  }
  throw new Error('sin sitio para ' + def);
}

const thread = (sim: Sim, id: string) => storyThreads(sim).find((t) => t.id === id)!;

describe('hilos de la trama', () => {
  it('empieza con todo por hacer y los primeros pasos sin dar', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 4 });
    const ids = storyThreads(sim).map((t) => t.id);
    expect(ids).toEqual(['carta', 'tuerto', 'califa', 'galeria', 'sur', 'tenevskaya', 'radio', 'base']);
    for (const t of storyThreads(sim)) expect(t.state, t.id).toBe('pendiente');
    expect(firstSteps(sim).every((s) => !s.done)).toBe(true);
    expect(epilogue(sim).length).toBeGreaterThan(3);
  });

  it('la carta se puede entregar o quemar, y el diario lo recuerda', () => {
    const a = newGame(world, { scenario: 'nadie', seed: 5 });
    expect(burnLetter(a)).toBeNull();
    addItem(a.players[0], 'cartaBessmertny', 1);
    expect(thread(a, 'carta').state).toBe('en curso');
    expect(burnLetter(a)).toContain('lacre');
    expect(countItem(a.players[0], 'cartaBessmertny')).toBe(0);
    expect(thread(a, 'carta').state).toBe('hecho');
    expect(thread(a, 'carta').text).toContain('quemaste');
    resetWorld(world);
    const b = newGame(world, { scenario: 'nadie', seed: 5 });
    addItem(b.players[0], 'cartaBessmertny', 1);
    deliverLetter(b, b.players[0], 'volkov');
    expect(thread(b, 'carta').text).toContain('Volkov');
    expect(epilogue(b)[0]).toContain('Volkov');
    resetWorld(world);
  });

  it('la llave de la Hermandad abre los almacenes de Tenevskaya sin forzarlos', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 6 });
    const st = sim.state;
    const stash = st.containers.filter((c) => c.items.some((i) => i.id === 'llaveAlmacen'));
    expect(stash.length).toBe(1);
    expect(stash[0].label).toContain('Hermandad');
    const vaults = st.containers.filter(isCivilDefense);
    expect(vaults.length).toBe(3);
    expect(vaults.every((c) => c.lock > 0 && !c.opened)).toBe(true);
    const p = sim.players[0];
    const v = vaults[0];
    const q = sim.world.nav.nearestPassable(v.x, v.z, 6) ?? v;
    p.x = q.x;
    p.z = q.z;
    p.sk.cerraduras = 0;
    addItem(p, 'llaveAlmacen', 1);
    expect(thread(sim, 'tenevskaya').state).toBe('en curso');
    p.order = { t: 'abrir', id: v.id };
    expect(run(sim, 20, () => v.opened)).toBe(true);
    expect(thread(sim, 'tenevskaya').progress).toBeCloseTo(1 / 3);
    resetWorld(world);
  });

  it('la emisora capta la señal de Múrmansk y la partida sigue', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 7 });
    const st = sim.state;
    st.tech.done.push('destilacion', 'generadores', 'radio');
    const gs = siteFor(sim, 'generadorJ');
    const gen = placeBuilding(sim, 'generadorJ', gs.x, gs.z, 0, true);
    addItem({ inv: gen.store }, 'combustible', 20);
    gen.fuel = 300;
    const rs = siteFor(sim, 'radioJ');
    const radio = placeBuilding(sim, 'radioJ', rs.x, rs.z, 0, true);
    expect(thread(sim, 'radio').state).toBe('en curso');
    const op = sim.players[0];
    op.sk.ciencia = 50;
    op.order = { t: 'operar', id: radio.id };
    expect(run(sim, 900, () => !!st.flags.senal)).toBe(true);
    expect(radio.craft).toBe(1);
    expect(thread(sim, 'radio').state).toBe('hecho');
    expect(st.log.some((l) => l.msg.includes('Múrmansk'))).toBe(true);
    // El final es abierto: el estado se guarda y la simulación continúa
    const copy = deserialize(serialize(st));
    expect(copy?.flags.senal).toBe(1);
    expect(run(sim, 5)).toBe(true);
    expect(sim.players.length).toBeGreaterThan(0);
    resetWorld(world);
  });
});
