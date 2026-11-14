// Equipo con calidad y desgaste, huecos nuevos, heridas que no se curan, prótesis y comida que se pudre.
import { beforeAll, describe, expect, it } from 'vitest';
import { BUILDS, REPAIR_RECIPE } from '../src/data/edificios';
import { ITEMS, condOf, hasQuality, itemPower, unitValue, type Stack } from '../src/data/items';
import { setRecipe, useItem } from '../src/sim/actions';
import { canPlace, placeBuilding } from '../src/sim/build';
import { addItem, armorAt, crawling, gearBonus, isLost, loseLimb, moveSpeed, partWork, totalHpFrac, wieldProblem } from '../src/sim/chars';
import { damage } from '../src/sim/combat';
import { ageFood } from '../src/sim/food';
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

function siteFor(sim: Sim, def: string, c: Char): { x: number; z: number } {
  for (let r = 2.5; r < 25; r += 1) {
    for (let a = 0; a < 6.28; a += 0.35) {
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (canPlace(sim, def, x, z, 0) === null) return { x, z };
    }
  }
  throw new Error('sin sitio para ' + def);
}

describe('calidad y desgaste', () => {
  it('una armadura buena protege más que una de chatarra', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 2 });
    const c = sim.players[0];
    c.eq = { torso: { id: 'chalecoPlacas', n: 1, q: 0 } };
    const scrap = armorAt(c, 1, 'pierce');
    c.eq = { torso: { id: 'chalecoPlacas', n: 1, q: 4 } };
    const mil = armorAt(c, 1, 'pierce');
    expect(mil).toBeGreaterThan(scrap * 1.4);
    // Gastada, protege menos
    c.eq = { torso: { id: 'chalecoPlacas', n: 1, q: 4, dur: 0.05 } };
    expect(armorAt(c, 1, 'pierce')).toBeLessThan(mil);
  });

  it('las armaduras se gastan al parar golpes', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 3 });
    const c = sim.players[0];
    c.eq = { torso: { id: 'chalecoPlacas', n: 1 } };
    for (let i = 0; i < 10; i++) damage(sim, c, 1, 25, 'bala', null);
    expect(condOf(c.eq.torso!)).toBeLessThan(0.95);
  });

  it('los huecos nuevos cubren brazos y piernas y dan sus ventajas', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 4 });
    const c = sim.players[0];
    c.eq = {};
    const run0 = moveSpeed(c, true);
    expect(armorAt(c, 5, 'cut')).toBe(0);
    c.eq.piernas = { id: 'grebas', n: 1 };
    c.eq.manos = { id: 'guantesCuero', n: 1 };
    c.eq.pies = { id: 'botasMilitares', n: 1 };
    expect(armorAt(c, 5, 'cut')).toBeGreaterThan(0.5);
    expect(armorAt(c, 3, 'cut')).toBeGreaterThan(0.1);
    expect(gearBonus(c, 'grip')).toBeGreaterThan(0);
    c.eq.piernas = undefined;
    delete c.eq.piernas;
    expect(moveSpeed(c, true)).toBeGreaterThan(run0);
  });

  it('el valor depende de la calidad y del estado', () => {
    const good = unitValue({ id: 'ak', n: 1, q: 4 });
    const bad = unitValue({ id: 'ak', n: 1, q: 0, dur: 0.2 });
    expect(good).toBeGreaterThan(ITEMS.ak.price * 2);
    expect(bad).toBeLessThan(ITEMS.ak.price * 0.3);
    expect(itemPower({ id: 'ak', n: 1, q: 3 })).toBeGreaterThan(1);
  });

  it('la gente del metro va equipada según su oficio', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 5 });
    run(sim, 2);
    const armed = sim.state.chars.filter((c) => !c.player && c.eq.arma);
    expect(armed.length).toBeGreaterThan(5);
    for (const c of armed) expect(c.eq.arma!.q).toBeDefined();
  });

  it('un banco de reparación arregla lo gastado de quien está cerca', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 6 });
    const c = sim.players[0];
    const p = siteFor(sim, 'desguaceJ', c);
    const bench = placeBuilding(sim, 'desguaceJ', p.x, p.z, 0, true);
    expect(BUILDS[bench.def].repair).toBe(true);
    c.eq.arma = { id: 'machete', n: 1, dur: 0.3 };
    c.sk.armeria = 40;
    addItem(c, 'piezas', 6);
    setRecipe(sim, bench, REPAIR_RECIPE, 0, true);
    c.order = { t: 'operar', id: bench.id };
    run(sim, 240, () => condOf(c.eq.arma!) > 0.9);
    expect(condOf(c.eq.arma!)).toBeGreaterThan(0.9);
  });

  it('lo que sale de un taller tiene la calidad de quien lo hace', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 7 });
    const c = sim.players[0];
    sim.state.tech.done.push('armas1');
    const p = siteFor(sim, 'armeroJ', c);
    const b = placeBuilding(sim, 'armeroJ', p.x, p.z, 0, true);
    addItem({ inv: b.store }, 'piezas', 30);
    setRecipe(sim, b, 'cuchillo', 4, false);
    c.sk.armeria = 70;
    c.order = { t: 'operar', id: b.id };
    run(sim, 400, () => b.store.filter((s) => s.id === 'cuchillo').length >= 3);
    const made = b.store.filter((s) => s.id === 'cuchillo');
    expect(made.length).toBeGreaterThanOrEqual(3);
    for (const s of made) expect(s.q!).toBeGreaterThanOrEqual(2);
  });
});

describe('heridas que no se curan', () => {
  it('quien pierde el brazo derecho suelta el arma y necesita una prótesis', () => {
    const sim = newGame(world, { scenario: 'veteranos', seed: 8 });
    const c = sim.players[0];
    expect(c.eq.arma).toBeTruthy();
    const before = totalHpFrac(c);
    loseLimb(sim, c, 4);
    expect(isLost(c, 4)).toBe(true);
    expect(c.eq.arma).toBeUndefined();
    expect(wieldProblem(c, ITEMS.machete)).toBeTruthy();
    expect(c.wound[4]).toBeGreaterThan(10);
    // Vendado el muñón, se le pone el brazo ortopédico
    c.wound[4] = 0;
    addItem(c, 'protesisBrazo', 1);
    expect(useItem(sim, c, c.inv.findIndex((s) => s.id === 'protesisBrazo'))).toBeNull();
    expect(c.pros?.[4]).toBeTruthy();
    expect(partWork(c, 4)).toBeGreaterThan(0.5);
    expect(wieldProblem(c, ITEMS.machete)).toBeNull();
    // Un brazo perdido no cuenta como herida por curar
    expect(totalHpFrac(c)).toBeGreaterThan(before - 0.05);
  });

  it('sin pierna y sin prótesis se va a gatas; con prótesis se anda, cojeando', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 9 });
    const c = sim.players[0];
    const v0 = moveSpeed(c, true);
    loseLimb(sim, c, 5);
    expect(crawling(c)).toBe(true);
    c.wound[5] = 0;
    addItem(c, 'protesisPierna', 1);
    expect(useItem(sim, c, c.inv.findIndex((s) => s.id === 'protesisPierna'))).toBeNull();
    expect(crawling(c)).toBe(false);
    const v1 = moveSpeed(c, true);
    expect(v1).toBeLessThan(v0);
    expect(v1).toBeGreaterThan(v0 * 0.5);
  });

  it('un tajo brutal en un miembro destrozado lo cercena', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 10 });
    const c = sim.players[0];
    c.eq = {};
    let lost = false;
    for (let i = 0; i < 40 && !lost; i++) {
      c.hp[3] = -c.hpMax[3];
      c.hp[0] = c.hpMax[0];
      c.hp[1] = c.hpMax[1];
      c.hp[2] = c.hpMax[2];
      c.blood = 100;
      c.st = 'ok';
      damage(sim, c, 3, 40, 'corte', null);
      lost = isLost(c, 3);
    }
    expect(lost).toBe(true);
  });

  it('la cojera crónica sigue aunque la pierna se cure', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 11 });
    const c = sim.players[0];
    const v0 = moveSpeed(c, true);
    c.limp = 6;
    expect(moveSpeed(c, true)).toBeLessThan(v0);
  });
});

describe('comida que se estropea', () => {
  it('los hongos frescos se pudren en unos días; los secos aguantan', () => {
    const list: Stack[] = [
      { id: 'hongos', n: 10 },
      { id: 'hongosSecos', n: 10 },
      { id: 'conserva', n: 2 },
    ];
    ageFood(list, 5 * 1440);
    expect(list.find((s) => s.id === 'hongos')).toBeUndefined();
    expect(list.find((s) => s.id === 'podrido')?.n).toBe(10);
    expect(list.find((s) => s.id === 'hongosSecos')!.fresh!).toBeGreaterThan(0.8);
    expect(list.find((s) => s.id === 'conserva')!.fresh).toBeUndefined();
  });

  it('en la despensa la comida dura más', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 12 });
    const c = sim.players[0];
    sim.state.tech.done.push('conservacion');
    const p = siteFor(sim, 'despensaJ', c);
    const pantry = placeBuilding(sim, 'despensaJ', p.x, p.z, 0, true);
    addItem({ inv: pantry.store }, 'carne', 5);
    c.inv = [];
    addItem(c, 'carne', 5);
    run(sim, 600);
    const inPantry = pantry.store.find((s) => s.id === 'carne')!;
    const carried = c.inv.find((s) => s.id === 'carne')!;
    expect(inPantry.fresh!).toBeGreaterThan(carried.fresh!);
  });

  it('al juntar comida queda la frescura media', () => {
    const c = { inv: [{ id: 'hongos', n: 10, fresh: 0.2 }] };
    addItem(c, 'hongos', 10, { fresh: 1 });
    expect(c.inv[0].fresh).toBeCloseTo(0.6, 5);
  });

  it('toda arma y armadura tiene calidad', () => {
    expect(hasQuality(ITEMS.ak)).toBe(true);
    expect(hasQuality(ITEMS.grebas)).toBe(true);
    expect(hasQuality(ITEMS.protesisBrazo)).toBe(true);
    expect(hasQuality(ITEMS.hongos)).toBe(false);
  });
});
