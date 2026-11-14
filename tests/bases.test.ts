// Bases más profundas: asentamientos y puestos avanzados, nidos de ametralladora,
// asaltos que rompen y saquean, visitas de las facciones y escuadras propias.
import { beforeAll, describe, expect, it } from 'vitest';
import { BUILDS } from '../src/data/edificios';
import { answerVisit, contrabandFor, launchRaid, playerBases, runRaidOrder, stepVisits, tributeFor } from '../src/sim/asaltos';
import { canPlace, damageBuilding, placeBuilding } from '../src/sim/build';
import { addItem, countItem, makeCreature, makeHuman } from '../src/sim/chars';
import { assignTeam, createTeam, teamMembers, teams } from '../src/sim/escuadras';
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

function siteFor(sim: Sim, def: string, c: Char, rot = 0, min = 2.5): { x: number; z: number } {
  for (let r = min; r < 30; r += 1) {
    for (let a = 0; a < 6.28; a += 0.3) {
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (canPlace(sim, def, x, z, rot) === null) return { x, z };
    }
  }
  throw new Error('sin sitio para ' + def);
}

describe('asentamientos', () => {
  it('las obras alejadas forman puestos avanzados aparte', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 1 });
    const c = sim.players[0];
    for (let i = 0; i < 4; i++) {
      const p = siteFor(sim, 'saco', c);
      placeBuilding(sim, 'saco', p.x, p.z, 0, true);
    }
    // Un puesto lejos, en el túnel
    const node = sim.world.graph.nodes.map((n) => world.nav.nearestPassable(n.x, n.z, 6)).filter((q): q is { x: number; z: number } => !!q).find((q) => Math.hypot(q.x - c.x, q.z - c.z) > 100 && Math.hypot(q.x - c.x, q.z - c.z) < 250)!;
    const o = { ...c, x: node.x, z: node.z } as Char;
    c.x = node.x;
    c.z = node.z;
    const p = siteFor(sim, 'saco', o);
    placeBuilding(sim, 'saco', p.x, p.z, 0, true);
    const bases = playerBases(sim);
    expect(bases.length).toBe(2);
    expect(bases[0].n).toBe(4);
    expect(bases[1].n).toBe(1);
  });

  it('las obras se dañan, se vienen abajo y se reparan', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 2 });
    const c = sim.players[0];
    const p = siteFor(sim, 'sacosJ', c);
    const b = placeBuilding(sim, 'sacosJ', p.x, p.z, 0, true);
    damageBuilding(sim, b, 100);
    expect(b.hp).toBe(BUILDS.sacosJ.hp - 100);
    addItem(c, 'tela', 4);
    c.order = { t: 'reparar', id: b.id };
    run(sim, 120, () => b.hp >= BUILDS.sacosJ.hp);
    expect(b.hp).toBe(BUILDS.sacosJ.hp);
    damageBuilding(sim, b, 1000);
    expect(sim.state.buildings.includes(b)).toBe(false);
  });
});

describe('nido de ametralladora', () => {
  it('quien lo sirve dispara a lo que entra en su arco, con las balas del nido', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 3 });
    sim.state.tech.done.push('torretas');
    const c = sim.players[0];
    for (const o of sim.players.slice(1)) sim.removeChar(o);
    sim.reindex();
    const p = siteFor(sim, 'nidoMGJ', c, 0, 4);
    const b = placeBuilding(sim, 'nidoMGJ', p.x, p.z, 0, true);
    addItem({ inv: b.store }, 'balas', 200);
    c.inv = c.inv.filter((s) => s.id !== 'balas');
    c.order = { t: 'operar', id: b.id };
    run(sim, 10);
    // Una rata delante del nido (hacia +Z local)
    const q = world.nav.nearestPassable(b.x + Math.sin(b.rot) * 12, b.z + Math.cos(b.rot) * 12, 6)!;
    const rat = makeCreature(sim, 'skrebun', q.x, q.z);
    sim.addChar(rat);
    run(sim, 20, () => rat.st !== 'ok');
    expect(countItem({ inv: b.store }, 'balas')).toBeLessThan(200);
    expect(rat.st).not.toBe('ok');
  });
});

describe('asaltos', () => {
  it('los asaltantes rompen obras y saquean almacenes', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 4 });
    const c = sim.players[0];
    const p = siteFor(sim, 'cajonJ', c);
    const box = placeBuilding(sim, 'cajonJ', p.x, p.z, 0, true);
    addItem({ inv: box.store }, 'piezas', 20);
    addItem({ inv: box.store }, 'componentes', 6);
    const q = world.nav.nearestPassable(p.x + 3, p.z, 3)!;
    const bandit = makeHuman(sim, 'VHL', 'bandido', q.x, q.z);
    sim.addChar(bandit);
    const o = { t: 'robar' as const, id: box.id };
    for (let i = 0; i < 30 * 15 && runRaidOrder(sim, bandit, o, 1 / 30); i++) sim.step(1 / 30);
    expect(bandit.inv.some((s) => s.id === 'componentes' && s.hot === 'saqueo')).toBe(true);
    const s2 = siteFor(sim, 'sacosJ', c);
    const wall = placeBuilding(sim, 'sacosJ', s2.x, s2.z, 0, true);
    const hp0 = wall.hp;
    bandit.order = { t: 'romper', id: wall.id };
    run(sim, 15, () => wall.hp < hp0);
    expect(wall.hp).toBeLessThan(hp0);
  });

  it('una facción ofendida manda su castigo', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 5 });
    const c = sim.players[0];
    for (let i = 0; i < 4; i++) {
      const p = siteFor(sim, 'saco', c);
      placeBuilding(sim, 'saco', p.x, p.z, 0, true);
    }
    sim.state.rep.UNI = -80;
    const base = playerBases(sim)[0];
    let sq = null;
    for (let i = 0; i < 20 && !sq; i++) sq = launchRaid(sim, base, 5, 0.5, true, 'UNI');
    expect(sq?.side).toBe('UNI');
    expect(sq?.raid).toBe('castigo');
  });
});

describe('visitas', () => {
  it('los recaudadores vienen a cobrar tributo y se puede pagar o negar', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 6 });
    const c = sim.players[0];
    for (let i = 0; i < 5; i++) {
      const p = siteFor(sim, 'saco', c);
      placeBuilding(sim, 'saco', p.x, p.z, 0, true);
    }
    stepVisits(sim);
    sim.state.time = sim.state.timers.visitaFaccion + 1;
    stepVisits(sim);
    const sq = sim.state.squads.find((s) => s.kind === 'visita');
    expect(sq).toBeTruthy();
    expect(sq!.demand ?? 0).toBeGreaterThanOrEqual(0);
    expect(tributeFor(sim, playerBases(sim)[0])).toBeGreaterThanOrEqual(30);
  });

  it('el registro encuentra lo robado a esa facción', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 7 });
    const c = sim.players[0];
    addItem(c, 'ak', 1, { hot: 'TSE' });
    expect(contrabandFor(sim, 'UNI').length).toBe(1);
    expect(contrabandFor(sim, 'SDR').length).toBe(0);
    // Una inspección de la Unión que se lleva lo robado
    const lead = makeHuman(sim, 'UNI', 'oficial', c.x + 2, c.z);
    sim.addChar(lead);
    const sq = { id: sim.state.nextId++, side: 'UNI', kind: 'visita', name: 'Inspección', roster: [{ k: 'oficial', id: lead.id }], x: lead.x, z: lead.z, plan: [], pi: 0, gx: lead.x, gz: lead.z, route: null, ri: 0, wait: 0, mat: true, home: 'TSE', mode: 'espera', life: 1000, visit: 'registro' } as never;
    sim.addSquad(sq);
    lead.squad = (sq as { id: number }).id;
    sim.state.money = 500;
    const txt = answerVisit(sim, lead, 'registro');
    expect(txt).toMatch(/requisan/);
    expect(c.inv.some((s) => s.id === 'ak')).toBe(false);
    expect(sim.state.money).toBeLessThan(500);
  });
});

describe('escuadras propias', () => {
  it('se reparte la gente en escuadras que van por su cuenta', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 8 });
    const [a, b, c2] = sim.players;
    const id = createTeam(sim, [a, b], 'Exploradores');
    expect(teams(sim).map((t) => t.name)).toEqual(['Escuadra principal', 'Exploradores']);
    expect(teamMembers(sim, id)).toEqual([a, b]);
    expect(teamMembers(sim, 0)).toContain(c2);
    assignTeam(sim, a, 0);
    assignTeam(sim, b, 0);
    // Sin nadie, la escuadra desaparece
    expect(teams(sim).length).toBe(1);
  });
});
