import { beforeAll, describe, expect, it } from 'vitest';
import { BUILDS, TECHS } from '../src/data/edificios';
import { FIGURE_BY_ID } from '../src/data/historia/figuras';
import { ITEMS } from '../src/data/items';
import { setRecipe, startResearch } from '../src/sim/actions';
import { canPlace, placeBuilding, restoreBuildings } from '../src/sim/build';
import { addItem, countItem } from '../src/sim/chars';
import { applyNodes, buyItem, hire, payStaToll, sellItem, shopOf, staTollFee, staTollState } from '../src/sim/events';
import { newGame } from '../src/sim/newGame';
import { deserialize, serialize } from '../src/sim/save';
import { Sim } from '../src/sim/sim';
import type { Building } from '../src/sim/types';
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

/** Busca un sitio libre para una obra cerca de la escuadra. */
function siteFor(sim: Sim, def: string): { x: number; z: number } {
  const p = sim.players[0];
  for (let r = 2.5; r < 20; r += 1) {
    for (let a = 0; a < 6.28; a += 0.4) {
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      if (canPlace(sim, def, x, z, 0) === null) return { x, z };
    }
  }
  throw new Error('sin sitio para ' + def);
}

describe('decoración', () => {
  it('da vida a todas las estaciones habitadas', () => {
    const spots = world.decor.spots;
    for (const f of world.layout.stations) {
      const mine = spots.filter((s) => s.place === f.id);
      if (!f.def.owner) {
        expect(mine.some((s) => s.kind === 'nido'), f.id).toBe(true);
        continue;
      }
      expect(mine.filter((s) => s.kind === 'guardia').length, `${f.id}: guardias`).toBeGreaterThanOrEqual(4);
      expect(mine.filter((s) => s.kind === 'vendedor' || s.kind === 'bar').length, `${f.id}: comercio`).toBeGreaterThanOrEqual(2);
      expect(mine.filter((s) => s.kind === 'asiento' || s.kind === 'ocio' || s.kind === 'trabajo').length, `${f.id}: vida`).toBeGreaterThanOrEqual(12);
      // En Izumrudnaya, bajo el embargo, no hay cantina ni gente de alquiler
      if (f.id !== 'MER') expect(mine.some((s) => s.kind === 'recluta'), `${f.id}: reclutas`).toBe(true);
    }
  });

  it('coloca a las figuras de la historia y los hilos de la trama', () => {
    const spots = world.decor.spots;
    const figs = spots.filter((s) => s.kind === 'lider' || s.kind === 'figura');
    for (const s of figs) expect(FIGURE_BY_ID[s.data ?? ''], `figura ${s.data}`).toBeTruthy();
    const at = (id: string) => figs.find((s) => s.data === id)?.place;
    expect(at('volkov')).toBe('TSE');
    expect(at('bessmertny')).toBe('KHO');
    expect(at('orlova')).toBe('STA');
    expect(at('morozov')).toBe('STL');
    expect(at('rybak')).toBe('VHL');
    expect(at('baghdadi')).toBe('MER');
    expect(at('voronov')).toBe('CHE');
    expect(at('lebedeva')).toBe('UBE');
    // La carta perdida, los almacenes de Tenevskaya, el botín de la Hermandad y el arsenal de la junta
    const loot = (data: string) => spots.filter((s) => s.kind === 'botin' && s.data === data);
    expect(loot('correos').map((s) => s.place)).toEqual(['TSE']);
    expect(loot('almacen').length).toBe(3);
    expect(loot('guarida').map((s) => s.place)).toEqual(['VHL']);
    expect(loot('arsenal').every((s) => s.place === 'CHE')).toBe(true);
  });

  it('deja libres los puntos donde se coloca gente', () => {
    for (const s of world.decor.spots) {
      if (s.kind === 'botin' || s.kind === 'chatarra' || s.kind === 'nido' || s.kind === 'campamento') continue;
      expect(world.baseFlags[world.nav.cz(s.z) * world.nav.w + world.nav.cx(s.x)] & 3, `${s.kind}@${s.place}`).toBe(1);
    }
  });
});

describe('partida', () => {
  it('guarda y carga sin perder el estado', () => {
    const a = newGame(world, { scenario: 'colonos', seed: 4 });
    const site = siteFor(a, 'hogueraJ');
    placeBuilding(a, 'hogueraJ', site.x, site.z, 0, true);
    run(a, 5);
    const text = serialize(a.state);
    const state = deserialize(text)!;
    expect(state).not.toBeNull();
    resetWorld(world);
    const b = new Sim(world, state);
    applyNodes(b);
    restoreBuildings(b);
    expect(b.players.length).toBe(a.players.length);
    expect(b.state.buildings.length).toBe(1);
    expect(b.state.money).toBe(a.state.money);
    const t = b.state.time;
    run(b, 5);
    expect(b.state.time).toBeGreaterThan(t + 4);
    // La obra sigue ocupando su sitio tras cargar
    expect(world.nav.passableAt(site.x, site.z, true)).toBe(false);
  });

  it('levanta una obra con los materiales de la escuadra', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 6 });
    const site = siteFor(sim, 'hogueraJ');
    const b = placeBuilding(sim, 'hogueraJ', site.x, site.z, 0);
    const before = sim.players.reduce((n, c) => n + countItem(c, 'tablones'), 0);
    for (const c of sim.players) c.order = { t: 'construir', id: b.id };
    const done = run(sim, 180, () => b.prog >= 1);
    expect(done).toBe(true);
    const after = sim.players.reduce((n, c) => n + countItem(c, 'tablones'), 0);
    expect(before - after).toBe(BUILDS.hogueraJ.cost.find(([id]) => id === 'tablones')![1]);
  });

  it('cocina una receta en la hoguera', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 8 });
    const site = siteFor(sim, 'hogueraJ');
    const b: Building = placeBuilding(sim, 'hogueraJ', site.x, site.z, 0, true);
    const cook = sim.players[0];
    addItem(cook, 'carne', 2);
    setRecipe(sim, b, 'asar', 2, false);
    cook.order = { t: 'operar', id: b.id };
    const have = () => countItem(cook, 'carneAsada') + countItem({ inv: b.store }, 'carneAsada');
    expect(run(sim, 240, () => have() >= 1)).toBe(true);
  });

  it('investiga con una mesa de estudio', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 10 });
    const site = siteFor(sim, 'investJ');
    const b = placeBuilding(sim, 'investJ', site.x, site.z, 0, true);
    expect(startResearch(sim, 'construccion')).toBeNull();
    const scholar = sim.players[0];
    scholar.sk.ciencia = 60;
    scholar.order = { t: 'operar', id: b.id };
    const done = run(sim, Math.ceil(TECHS.construccion.cost * 3), () => sim.state.tech.done.includes('construccion'));
    expect(done).toBe(true);
    // Con la técnica ya se pueden levantar muros
    const wall = siteFor(sim, 'muroJ');
    expect(canPlace(sim, 'muroJ', wall.x, wall.z, 0)).toBeNull();
  });

  it('compra, vende y contrata en el mercado', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 12 });
    run(sim, 3);
    sim.state.money = 2000;
    const buyer = sim.players[0];
    const vendor = sim.state.chars.find((c) => c.vendor === 'comida' && !c.squad)!;
    expect(vendor, 'un puesto de comida en Tsentral’naya').toBeTruthy();
    const shop = shopOf(sim, vendor);
    expect(shop.stock.length).toBeGreaterThan(0);
    const id = shop.stock[0].id;
    const had = countItem(buyer, id);
    expect(buyItem(sim, buyer, vendor, 0, 1)).toBeNull();
    expect(countItem(buyer, id)).toBe(had + 1);
    expect(sim.state.money).toBeLessThan(2000);
    const money = sim.state.money;
    const idx = buyer.inv.findIndex((s) => s.id === id);
    expect(sellItem(sim, buyer, vendor, idx, 1)).toBeNull();
    expect(sim.state.money).toBeGreaterThan(money);
    expect(ITEMS[id]).toBeTruthy();
    // Un recluta de la cantina
    const recruit = sim.state.chars.find((c) => (c.hire ?? 0) > 0)!;
    expect(recruit, 'alguien que se alquila').toBeTruthy();
    const n = sim.players.length;
    expect(hire(sim, recruit)).toBeNull();
    sim.reindex();
    expect(sim.players.length).toBe(n + 1);
  });

  it('cobra el peaje de Staraya a quien entra en la Encrucijada', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 14 });
    const f = world.layout.stationById.STA;
    // La escuadra aparece en mitad del andén de Staraya
    sim.players.forEach((c, i) => {
      const p = world.nav.nearestPassable(f.x + i * 0.8, f.z, 8)!;
      c.x = p.x;
      c.z = p.z;
    });
    expect(staTollState(sim)).toBe('libre');
    let asked = false;
    for (let i = 0; i < 30 * 20 && !asked; i++) {
      sim.step(1 / 30);
      asked = sim.events.some((e) => e.t === 'mundo' && e.k === 'peaje');
      sim.events.length = 0;
    }
    expect(asked).toBe(true);
    expect(staTollState(sim)).toBe('moroso');
    const money = sim.state.money;
    const fee = staTollFee(sim);
    expect(payStaToll(sim)).toBeNull();
    expect(sim.state.money).toBe(money - fee);
    expect(staTollState(sim)).toBe('pagado');
  });

  it('aguanta diez minutos de metro en cada comienzo', () => {
    for (const scenario of ['nadie', 'cartero', 'colonos', 'stalkers', 'hermandad', 'veteranos', 'esmeralda']) {
      const sim = newGame(world, { scenario, seed: 31 });
      run(sim, 600);
      expect(sim.state.time, scenario).toBeGreaterThan(599);
      for (const c of sim.state.chars) {
        expect(Number.isFinite(c.x) && Number.isFinite(c.z), `${scenario}: ${c.name}`).toBe(true);
      }
    }
  });
});
