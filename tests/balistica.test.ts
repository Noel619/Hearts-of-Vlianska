// Balística real: energía, frenado en el aire, blindaje, órganos y hemorragias.
import { beforeAll, describe, expect, it } from 'vitest';
import { CARTRIDGES, dragLength, energy, velocityAt } from '../src/data/balistica';
import { ITEMS } from '../src/data/items';
import { addItem, makeHuman } from '../src/sim/chars';
import { bulletHit, fire, treat } from '../src/sim/combat';
import { newGame } from '../src/sim/newGame';
import type { Sim } from '../src/sim/sim';
import type { Char } from '../src/sim/types';
import { buildWorld, type World } from '../src/sim/world';

let world: World;
beforeAll(() => {
  world = buildWorld();
});

const gun = (id: string) => ITEMS[id].weapon!.ranged!;
const muzzle = (id: string) => energy(CARTRIDGES[gun(id).cart], gun(id).v0);

/** Una partida vacía con un tramo de túnel recto. */
function empty(seed: number): { sim: Sim; at: (d: number) => { x: number; z: number } } {
  const sim = newGame(world, { scenario: 'nadie', seed });
  sim.state.squads = [];
  for (const c of [...sim.state.chars]) sim.removeChar(c);
  const l = world.layout.links.find((q) => q.a === 'RUB' && q.b === 'KHO')!;
  const mid = Math.floor(l.pts.length / 2);
  const p0 = l.pts[mid];
  let k = mid + 1;
  while (Math.hypot(l.pts[k].x - p0.x, l.pts[k].z - p0.z) < 6) k++;
  const len = Math.hypot(l.pts[k].x - p0.x, l.pts[k].z - p0.z);
  const ux = (l.pts[k].x - p0.x) / len;
  const uz = (l.pts[k].z - p0.z) / len;
  return { sim, at: (d) => world.nav.nearestPassable(p0.x + ux * d, p0.z + uz * d, 3)! };
}

/** Alguien sin armadura (o con la que se le dé) en pie. */
function person(sim: Sim, x: number, z: number, side: 'LEV' | 'CAL' = 'CAL', eq: Char['eq'] = {}): Char {
  const c = makeHuman(sim, side, 'civil', x, z, sim.rng.int(1, 1e9));
  c.eq = { ...eq };
  c.inv = [];
  c.lit = 1;
  sim.addChar(c);
  return c;
}

describe('balística', () => {
  it('cada arma dispara su cartucho real: un Kaláshnikov lleva siete veces la energía de una Makárov', () => {
    expect(muzzle('pistola')).toBeGreaterThan(280);
    expect(muzzle('pistola')).toBeLessThan(330);
    expect(muzzle('ak')).toBeGreaterThan(1900);
    expect(muzzle('ak')).toBeLessThan(2100);
    expect(muzzle('cerrojo')).toBeGreaterThan(3000);
    expect(muzzle('ak') / muzzle('pistola')).toBeGreaterThan(6);
    // El fusil del túnel tiene el cañón corto: la misma bala, menos velocidad
    expect(muzzle('fusilTunel')).toBeLessThan(muzzle('ak'));
  });

  it('en un túnel el aire apenas frena una bala; a la posta, más', () => {
    const ak = CARTRIDGES['762x39'];
    expect(velocityAt(ak, 715, 50) / 715).toBeGreaterThan(0.93);
    expect(dragLength(CARTRIDGES['12g'])).toBeLessThan(dragLength(ak) / 2);
  });

  it('una chapa de vagón para una bala de pistola y la posta, pero un fusil la atraviesa', () => {
    const { sim, at } = empty(1);
    const p = at(0);
    const plates = (): Char['eq'] => ({ torso: { id: 'chalecoPlacas', n: 1 } });
    const k9 = CARTRIDGES['9x18'];
    const a = person(sim, p.x, p.z, 'CAL', plates());
    const pistol = bulletHit(sim, a, 1, k9, velocityAt(k9, 315, 10), null);
    expect(pistol.stopped).toBe(true);
    expect(pistol.dmg).toBeLessThan(20);
    expect(a.st).toBe('ok');
    const k12 = CARTRIDGES['12g'];
    expect(bulletHit(sim, a, 2, k12, velocityAt(k12, 350, 8), null).stopped).toBe(true);
    // El Kaláshnikov la atraviesa, aunque pierde fuerza por el camino
    const k = CARTRIDGES['762x39'];
    const armored: number[] = [];
    const bare: number[] = [];
    for (let i = 0; i < 30; i++) {
      const b = person(sim, p.x, p.z, 'CAL', plates());
      const hit = bulletHit(sim, b, 1, k, velocityAt(k, 715, 20), null);
      expect(hit.stopped).toBe(false);
      armored.push(hit.dmg);
      bare.push(bulletHit(sim, person(sim, p.x, p.z), 1, k, velocityAt(k, 715, 20), null).dmg);
    }
    const avg = (v: number[]) => v.reduce((x, y) => x + y, 0) / v.length;
    expect(avg(armored)).toBeLessThan(avg(bare));
    // Y el casco para una Makárov, no una 7,62
    const h = person(sim, p.x, p.z, 'CAL', { cabeza: { id: 'casco', n: 1 } });
    expect(bulletHit(sim, h, 0, k9, velocityAt(k9, 315, 10), null).stopped).toBe(true);
    expect(bulletHit(sim, person(sim, p.x, p.z, 'CAL', { cabeza: { id: 'casco', n: 1 } }), 0, k, velocityAt(k, 715, 10), null).stopped).toBe(false);
  });

  it('un balazo de fusil en el cuerpo tumba en el acto; uno de pistola, casi nunca', () => {
    const { sim, at } = empty(2);
    const p = at(0);
    const k = CARTRIDGES['762x39'];
    const k9 = CARTRIDGES['9x18'];
    let rifleDown = 0;
    let pistolDown = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const a = person(sim, p.x, p.z);
      bulletHit(sim, a, 1 + (i % 2), k, velocityAt(k, 715, 20), null);
      if (a.st !== 'ok') rifleDown++;
      const b = person(sim, p.x, p.z);
      bulletHit(sim, b, 1 + (i % 2), k9, velocityAt(k9, 315, 10), null);
      if (b.st !== 'ok') pistolDown++;
    }
    expect(rifleDown).toBe(N);
    expect(pistolDown / N).toBeLessThan(0.3);
  });

  it('un tiro en la cabeza suele matar; una bola de aire comprimido a duras penas atraviesa el cráneo', () => {
    const { sim, at } = empty(3);
    const p = at(0);
    const k9 = CARTRIDGES['9x18'];
    const air = CARTRIDGES.bola13;
    let pistolDead = 0;
    let airDead = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const a = person(sim, p.x, p.z);
      bulletHit(sim, a, 0, k9, velocityAt(k9, 315, 10), null);
      if (a.st === 'muerto') pistolDead++;
      const b = person(sim, p.x, p.z);
      bulletHit(sim, b, 0, air, velocityAt(air, 200, 10), null);
      if (b.st === 'muerto') airDead++;
    }
    expect(pistolDead / N).toBeGreaterThan(0.6);
    expect(pistolDead / N).toBeLessThan(0.85);
    expect(airDead).toBeLessThan(pistolDead / 3);
  });

  it('un balazo en el corazón desangra en segundos y no hay venda que valga', () => {
    const { sim, at } = empty(4);
    const p = at(0);
    const v = person(sim, p.x, p.z);
    const medic = person(sim, p.x + 0.6, p.z, 'CAL');
    addItem(medic, 'vendas', 10);
    v.inner = 420;
    // Con vendas no hay nada que vendar por fuera
    expect(treat(sim, medic, v, 2)).toBe(false);
    for (let i = 0; i < 30 * 30 && v.st !== 'muerto'; i++) sim.step(1 / 30);
    expect(v.st).toBe('muerto');
  });

  it('una arteria abierta en la pierna se corta con una venda bien apretada; una hemorragia interna, solo la frena un botiquín', () => {
    const { sim, at } = empty(5);
    const p = at(0);
    const v = person(sim, p.x, p.z);
    const medic = person(sim, p.x + 0.6, p.z, 'CAL');
    addItem(medic, 'vendas', 10);
    v.wound[5] = 130;
    for (let i = 0; i < 30 * 12; i++) treat(sim, medic, v, 1 / 30);
    expect(v.wound[5]).toBeLessThan(5);
    // Por dentro: la venda no sirve, el botiquín sí (poco a poco)
    v.inner = 30;
    expect(treat(sim, medic, v, 2)).toBe(false);
    addItem(medic, 'botiquin', 2);
    for (let i = 0; i < 30 * 4; i++) treat(sim, medic, v, 1 / 30);
    expect(v.inner).toBeLessThan(20);
  });

  it('la bala va adonde la manda la puntería: de cerca casi siempre al cuerpo, de lejos falla más', () => {
    const { sim, at } = empty(6);
    const shooter = person(sim, at(0).x, at(0).z, 'LEV');
    shooter.sk.punteria = 40;
    const rate = (d: number) => {
      let hits = 0;
      const torso = { n: 0 };
      const N = 300;
      for (let i = 0; i < N; i++) {
        const q = at(d);
        const t = person(sim, q.x, q.z);
        sim.events.length = 0;
        fire(sim, shooter, t, d, gun('ak'));
        const h = sim.events.find((e) => e.t === 'golpe');
        if (h && h.t === 'golpe') {
          hits++;
          if (h.part === 1 || h.part === 2) torso.n++;
        }
        sim.removeChar(t);
      }
      return { hit: hits / N, torso: torso.n / Math.max(1, hits) };
    };
    const near = rate(5);
    const far = rate(35);
    expect(near.hit).toBeGreaterThan(0.85);
    expect(near.torso).toBeGreaterThan(0.6);
    expect(far.hit).toBeLessThan(near.hit * 0.6);
  });

  it('un tiroteo entre dos con fusil dura segundos, no minutos', () => {
    const times: number[] = [];
    for (let seed = 1; seed <= 6; seed++) {
      const { sim, at } = empty(100 + seed);
      const p = at(0);
      const q = at(20);
      const a = person(sim, p.x, p.z, 'LEV', { arma: { id: 'ak', n: 1, mag: 30 } });
      const b = person(sim, q.x, q.z, 'CAL', { arma: { id: 'ak', n: 1, mag: 30 } });
      for (const c of [a, b]) {
        addItem(c, 'balas', 120);
        c.role = 'soldado';
        c.sk.punteria = 30;
        c.ai.mode = 'guardia';
        c.ai.homeX = c.x;
        c.ai.homeZ = c.z;
        c.hold = true;
      }
      sim.reindex();
      a.target = b.id;
      b.target = a.id;
      let t = 0;
      while (t < 120 && a.st === 'ok' && b.st === 'ok') {
        sim.step(1 / 30);
        t += 1 / 30;
      }
      times.push(t);
    }
    times.sort((x, y) => x - y);
    expect(times[Math.floor(times.length / 2)]).toBeLessThan(8);
    expect(times[times.length - 1]).toBeLessThan(40);
  });
});
