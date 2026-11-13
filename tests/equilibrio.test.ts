// Equilibrio: curva de asaltos, armas de fuego a quemarropa y comercio.
import { beforeAll, describe, expect, it } from 'vitest';
import { ITEMS } from '../src/data/items';
import { addItem, makeHuman } from '../src/sim/chars';
import { defenders, fighterWeight, RAID_LEADER, RAID_MAX, raidGrade, raidStrength, sellItem, sellPrice } from '../src/sim/events';
import { newGame } from '../src/sim/newGame';
import { buildWorld, type World } from '../src/sim/world';

let world: World;
beforeAll(() => {
  world = buildWorld();
});

describe('asaltos', () => {
  it('crecen con la base, la escuadra y el tiempo, sin pasarse del tope', () => {
    for (const day of [1, 10, 40, 200]) {
      for (const b of [3, 15, 40]) {
        for (const sq of [1, 6, 20]) {
          const k = raidStrength(day, b, sq);
          expect(k).toBeGreaterThanOrEqual(2);
          expect(k).toBeLessThanOrEqual(RAID_MAX);
          expect(raidStrength(day + 10, b, sq)).toBeGreaterThanOrEqual(k);
          expect(raidStrength(day, b + 10, sq)).toBeGreaterThanOrEqual(k);
          expect(raidStrength(day, b, sq + 3)).toBeGreaterThanOrEqual(k);
        }
      }
    }
  });

  it('cada defensor cuenta según lo que sabe pelear', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 55 });
    for (const c of sim.players) c.sk.ataque = c.sk.punteria = 5;
    const novices = defenders(sim);
    for (const c of sim.players) c.sk.ataque = 40;
    expect(defenders(sim)).toBe(sim.players.length);
    expect(novices).toBeLessThan(sim.players.length * 0.5);
    expect(fighterWeight(25)).toBe(1);
  });

  it('una colonia recién fundada no recibe a un cabecilla con su banda', () => {
    expect(raidStrength(4, 4, 3)).toBeLessThan(RAID_LEADER);
    expect(raidStrength(8, 6, 4)).toBeLessThan(RAID_LEADER);
  });

  it('en una partida larga los asaltos siguen creciendo en número y en veteranía', () => {
    expect(raidStrength(60, 30, 12)).toBeGreaterThan(raidStrength(20, 30, 12));
    expect(raidGrade(10)).toBe(0);
    expect(raidGrade(50)).toBeGreaterThan(0.3);
    expect(raidGrade(120)).toBe(1);
  });
});

describe('armas de fuego', () => {
  it('a quemarropa, quien lleva un fusil pelea con la culata en vez de quedarse quieto', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 51 });
    sim.state.squads = [];
    for (const c of [...sim.state.chars]) sim.removeChar(c);
    const l = world.layout.links.find((q) => q.a === 'RUB' && q.b === 'KHO')!;
    const p = l.pts[Math.floor(l.pts.length / 2)];
    const gunner = makeHuman(sim, 'JUG', 'mercenario', p.x, p.z);
    gunner.player = true;
    gunner.ai.mode = 'jugador';
    gunner.stance = 'agresivo';
    gunner.eq = { arma: { id: 'fusilTunel', n: 1, mag: 8 } };
    addItem(gunner, 'balas', 40);
    const foe = makeHuman(sim, 'VHL', 'bandido', p.x + 0.9, p.z);
    foe.eq = { arma: { id: 'machete', n: 1 } };
    foe.role = 'elite';
    sim.state.rep.VHL = -100;
    sim.addChar(gunner);
    sim.addChar(foe);
    sim.reindex();
    gunner.target = foe.id;
    foe.target = gunner.id;
    let swings = 0;
    for (let i = 0; i < 30 * 12 && gunner.st === 'ok' && foe.st === 'ok'; i++) {
      sim.step(1 / 30);
      swings += sim.events.filter((e) => e.t === 'golpe' && e.id === gunner.id && e.kind !== 'bala').length;
      sim.events.length = 0;
    }
    expect(swings).toBeGreaterThan(0);
  });

  it('las armas más caras rinden más', () => {
    const dps = (id: string) => {
      const w = ITEMS[id].weapon!;
      return (w.pierce * (w.ranged!.pellets ?? 1)) / w.ranged!.rof;
    };
    // Nada barato rinde más que el Kaláshnikov, y la carabina es la más certera
    for (const id of ['pistola', 'fusilTunel', 'cerrojo', 'neumatico']) expect(dps(id)).toBeLessThan(dps('ak'));
    expect(ITEMS.carabina.weapon!.ranged!.spread).toBeLessThan(ITEMS.cerrojo.weapon!.ranged!.spread);
  });
});

describe('comercio', () => {
  it('lo que no vale nada no se regala', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 53 });
    for (let i = 0; i < 90; i++) sim.step(1 / 30);
    const seller = sim.players[0];
    const vendor = sim.state.chars.find((c) => c.vendor === 'bazar' && !c.squad)!;
    expect(sellPrice(sim, vendor.ai.place, 'balas', vendor.side)).toBe(0);
    seller.inv = [];
    addItem(seller, 'balas', 30);
    const money = sim.state.money;
    expect(sellItem(sim, seller, vendor, 0, 30)).not.toBeNull();
    expect(seller.inv[0]?.n).toBe(30);
    expect(sim.state.money).toBe(money);
  });
});
