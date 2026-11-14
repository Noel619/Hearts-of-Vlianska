// Los comienzos cuentan la verdad: lo que dice cada texto es lo que hay en la
// partida al empezar (sitio, gente, equipo, quién os quiere y quién no), y en
// los primeros minutos no pasa nada que lo contradiga.
import { beforeAll, describe, expect, it } from 'vitest';
import { SCENARIOS, SCENARIO_BY_ID } from '../src/data/escenarios';
import { ITEMS } from '../src/data/items';
import { keyFor } from '../src/game/keys';
import { countItem, totalHpFrac } from '../src/sim/chars';
import { hostile } from '../src/sim/combat';
import { HUNT_MIN } from '../src/sim/derrota';
import { sellPrice } from '../src/sim/events';
import { firstSteps, STEPS } from '../src/sim/hilos';
import { newGame } from '../src/sim/newGame';
import { newSquad } from '../src/sim/population';
import { resolveBattle, SIEGE_NEWS_DAY, siegeState, stepSiege } from '../src/sim/asedio';
import { deserialize, serialize } from '../src/sim/save';
import type { Sim } from '../src/sim/sim';
import { standingLines } from '../src/sim/situacion';
import type { Char, SimEvent } from '../src/sim/types';
import { placeId, type World, buildWorld } from '../src/sim/world';
import { insideAnnex } from '../src/world/arch';
import { linkPointAt, stationToLocal } from '../src/world/layout';

let world: World;
beforeAll(() => {
  world = buildWorld();
});

/** Avanza y devuelve los sucesos que han pasado. */
function run(sim: Sim, seconds: number): SimEvent[] {
  const seen: SimEvent[] = [];
  for (let i = 0; i < seconds * 30; i++) {
    sim.step(1 / 30);
    seen.push(...sim.events);
    sim.events.length = 0;
  }
  return seen;
}

const total = (sim: Sim, id: string) => sim.players.reduce((a, c) => a + countItem(c, id) + (c.eq.arma?.id === id ? 1 : 0) + Object.values(c.eq).filter((s) => s?.id === id && s !== c.eq.arma).length, 0);
const food = (c: Char) => c.inv.some((s) => (ITEMS[s.id]?.food ?? 0) > 0 && s.id !== 'samogon');

describe('todos los comienzos', () => {
  it('empiezan donde dicen: en su lugar y en su sala o su rincón', () => {
    for (const sc of SCENARIOS) {
      const sim = newGame(world, { scenario: sc.id, seed: 21 });
      const f = world.layout.stationById[sc.place];
      for (const c of sim.players) {
        expect(world.nav.passableAt(c.x, c.z, true), `${sc.id}: ${c.name} en un sitio transitable`).toBe(true);
        expect(placeId(world, c.x, c.z), `${sc.id}: ${c.name} en ${sc.place}`).toBe(sc.place);
        if (sc.at && 'spot' in sc.at) {
          const { spot, data } = sc.at;
          const sp = world.decor.spots.filter((q) => q.place === sc.place && q.kind === spot && (data === undefined || q.data === data));
          expect(sp.length, `${sc.id}: hay ${spot}${data ? ':' + data : ''} en ${sc.place}`).toBeGreaterThan(0);
          expect(Math.min(...sp.map((q) => Math.hypot(q.x - c.x, q.z - c.z))), `${sc.id}: ${c.name} junto a su rincón`).toBeLessThan(4);
        }
        if (f && sc.at && 'annex' in sc.at) {
          const id = sc.at.annex;
          const a = f.annexes.find((q) => q.id === id);
          expect(a, `${sc.id}: la sala ${id} existe`).toBeTruthy();
          const [u, v] = stationToLocal(f, c.x, c.z);
          expect(insideAnnex(a!, u, v, 1.5), `${sc.id}: ${c.name} dentro de «${a!.name}»`).toBe(true);
        }
      }
    }
  });

  it('cada cual lleva lo que dice su comienzo y la partida guarda sus marcas', () => {
    for (const sc of SCENARIOS) {
      const sim = newGame(world, { scenario: sc.id, seed: 22 });
      expect(sim.players.length, sc.id).toBe(sc.members.length);
      expect(sim.state.money, sc.id).toBe(sc.money);
      for (const [f, v] of Object.entries(sc.rep ?? {})) expect(sim.state.rep[f as keyof typeof sim.state.rep], `${sc.id}: ${f}`).toBe(v);
      for (const [f, v] of Object.entries(sc.bounty ?? {})) expect(sim.state.bounty[f as keyof typeof sim.state.bounty], `${sc.id}: ${f}`).toBe(v);
      for (const [k, v] of Object.entries(sc.flags ?? {})) expect(sim.state.flags[k], `${sc.id}: ${k}`).toBe(v);
      sc.members.forEach((m, i) => {
        const c = sim.players[i];
        expect(c.eq.arma?.id ?? null, `${sc.id}: arma`).toBe(m.weapon ?? null);
        for (const a of m.armor ?? []) expect(Object.values(c.eq).some((s) => s?.id === a), `${sc.id}: ${a}`).toBe(true);
        for (const [id, n] of m.items ?? []) expect(countItem(c, id), `${sc.id}: ${id}`).toBe(n);
      });
    }
  });

  it('la estación de partida no se anuncia como si acabarais de llegar', () => {
    for (const sc of SCENARIOS) {
      const sim = newGame(world, { scenario: sc.id, seed: 23 });
      run(sim, 8);
      const name = world.layout.stationById[sc.place]?.def.name;
      if (name) expect(sim.state.log.some((l) => l.msg === `Has llegado a ${name}.`), sc.id).toBe(false);
    }
  });

  it('los primeros pasos existen, tienen teclas de verdad y no empiezan hechos', () => {
    for (const sc of SCENARIOS) {
      expect(sc.steps.length, sc.id).toBeGreaterThanOrEqual(4);
      for (const id of sc.steps) expect(STEPS[id], `${sc.id}: paso ${id}`).toBeTruthy();
      const sim = newGame(world, { scenario: sc.id, seed: 24 });
      const steps = firstSteps(sim);
      for (const s of steps) for (const m of s.hint.matchAll(/\{tecla:(\w+)\}/g)) expect(keyFor(m[1]), `${sc.id}: tecla ${m[1]}`).toBeTruthy();
      expect(steps.map((s) => s.id)).toEqual(sc.steps);
      for (const s of steps) expect(s.done, `${sc.id}: ${s.id} ya hecho al empezar`).toBe(false);
    }
  });

  it('el informe dice lo mismo que la partida', () => {
    for (const sc of SCENARIOS) {
      const sim = newGame(world, { scenario: sc.id, seed: 25 });
      const lines = standingLines({ rep: sim.state.rep, bounty: sim.state.bounty, flags: sim.state.flags }).map((l) => l.text);
      // Quien os dispara al veros es hostil de verdad para la escuadra
      for (const f of Object.keys(sim.state.rep) as (keyof typeof sim.state.rep)[]) {
        const shoots = lines.some((t) => t.includes('nada más veros') && t.toLowerCase().includes(fName(f)));
        if (sim.state.rep[f] <= -50) expect(shoots, `${sc.id}: ${f} dispara`).toBe(true);
        else expect(shoots, `${sc.id}: ${f} no dispara`).toBe(false);
      }
    }
  });
});

const FN: Record<string, string> = { UNI: 'la unión', SDR: 'los seguidores', LEV: 'el levantamiento', STA: 'staraya', VHL: 'los saqueadores', CHE: 'chernovodskaya', CAL: 'el califato', NOR: 'la república' };
const fName = (f: string) => FN[f];

describe('cada comienzo', () => {
  it('Nadie: tres refugiados con un cuchillo, un tubo, diez puñados de hongos y sesenta cartuchos', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 31 });
    expect(sim.players.length).toBe(3);
    expect(total(sim, 'cuchillo')).toBe(1);
    expect(total(sim, 'tubo')).toBe(1);
    expect(total(sim, 'hongosSecos')).toBe(10);
    expect(total(sim, 'vendas')).toBe(2);
    expect(sim.state.money).toBe(60);
  });

  it('La saca de correo: en Staraya no se paga peaje y la carta está en Correos de Tsentral’naya', () => {
    const sim = newGame(world, { scenario: 'cartero', seed: 32 });
    const ev = run(sim, 90);
    expect(ev.some((e) => e.t === 'mundo' && e.k === 'peaje')).toBe(false);
    const letter = sim.state.containers.find((c) => c.items.some((s) => s.id === 'cartaBessmertny'));
    expect(letter?.place).toBe('TSE');
    expect(letter!.lock).toBeGreaterThan(0);
    // La paga de la entrega
    expect(sim.state.money).toBe(180);
  });

  it('Colonos: en el Cruce Oriental, con skrebuns en el Nudo de Tenevskaya y camino a la estación fantasma', () => {
    const sim = newGame(world, { scenario: 'colonos', seed: 33 });
    expect(world.decor.spots.some((s) => s.kind === 'nido' && s.place === 'E5' && s.data === 'skrebun')).toBe(true);
    const c = sim.players[0];
    const ten = world.layout.stationById.TEN;
    expect(world.graph.route(c.x, c.z, ten.x, ten.z)).toBeTruthy();
    // Material de sobra para empezar un campamento
    expect(total(sim, 'tablones')).toBeGreaterThanOrEqual(20);
    expect(total(sim, 'tela')).toBeGreaterThanOrEqual(10);
  });

  it('Stalkers: dos máscaras antigás, un respirador, cinco filtros, y el hospital paga mejor las glándulas', () => {
    const sim = newGame(world, { scenario: 'stalkers', seed: 34 });
    expect(total(sim, 'mascaraGas')).toBe(2);
    expect(total(sim, 'respirador')).toBe(1);
    expect(total(sim, 'filtros')).toBe(5);
    expect(total(sim, 'neumatico')).toBe(1);
    const ube = sellPrice(sim, 'UBE', 'glandula', 'NOR');
    for (const p of ['SEV', 'TSE', 'STA', 'IND']) expect(ube, p).toBeGreaterThan(sellPrice(sim, p, 'glandula', 'NOR') * 1.5);
    // Las escaleras de Severnyy suben a la superficie, donde hay skrebuns
    expect(world.layout.stationById.SEV.annexes.some((a) => a.exit === 'SEV')).toBe(true);
    expect(world.decor.spots.some((s) => s.kind === 'nido' && s.place.startsWith('SUP') && s.data === 'skrebun')).toBe(true);
  });

  it('Hijos de Vhlainska: hermanos en Vhlainska, sin peaje de sus bandas, y la llave en el botín', () => {
    const sim = newGame(world, { scenario: 'hermandad', seed: 35 });
    expect(sim.brothers()).toBe(true);
    // Los de la Hermandad no son enemigos; Staraya y los Seguidores, sí
    const ev = run(sim, 120);
    expect(ev.some((e) => e.t === 'mundo' && e.k === 'peaje'), 'peaje de la Hermandad a sus hermanos').toBe(false);
    const p = sim.players[0];
    const vhl = sim.state.chars.filter((c) => c.side === 'VHL' && c.kind === 'humano' && c.st === 'ok');
    expect(vhl.length).toBeGreaterThan(3);
    for (const c of vhl) expect(hostile(sim, c, p), c.name).toBe(false);
    expect(sim.state.rep.STA).toBeLessThanOrEqual(-50);
    expect(sim.state.rep.SDR).toBeLessThanOrEqual(-50);
    expect(sim.state.bounty.STA).toBeGreaterThanOrEqual(HUNT_MIN);
    // La llave de la defensa civil, en el botín de la Hermandad, junto a la guarida
    const loot = sim.state.containers.find((c) => c.place === 'VHL' && c.items.some((s) => s.id === 'llaveAlmacen'));
    expect(loot?.owner).toBe('VHL');
    const f = world.layout.stationById.VHL;
    const [u, v] = stationToLocal(f, loot!.x, loot!.z);
    const near = f.annexes.filter((a) => a.id === 'botin' || a.id === 'guarida').some((a) => insideAnnex(a, u, v, 3));
    expect(near).toBe(true);
    // Tenevskaya, al otro lado del túnel de mantenimiento
    const ten = world.layout.stationById.TEN;
    expect(world.graph.route(p.x, p.z, ten.x, ten.z)).toBeTruthy();
  });

  it('Hijos de Vhlainska: una banda de la Hermandad no cobra peaje a sus hermanos (y a los demás, sí)', () => {
    for (const brothers of [true, false]) {
      const sim = newGame(world, { scenario: 'hermandad', seed: 39 });
      if (!brothers) delete sim.state.flags.hermano;
      const p = sim.players[0];
      // Una banda que sale de Vhlainska y pasa junto a la escuadra, como al empezar
      const at = world.nav.nearestPassable(p.x + 3, p.z, 4, true)!;
      const sq = newSquad(sim, 'VHL', 'banda', 'Banda de saqueadores', ['jefe', 'bandido', 'bandido'], at, ['H2', 'VHL'], 'VHL');
      sq.mode = 'acecho';
      sq.wait = 600;
      const ev = run(sim, 20);
      expect(sq.mat, 'la banda se ha materializado').toBe(true);
      expect(ev.some((e) => e.t === 'mundo' && e.k === 'peaje'), brothers ? 'hermanos' : 'sin ser hermanos').toBe(!brothers);
    }
  });

  it('Hijos de Vhlainska: si os ven robar a la Hermandad, dejáis de ser hermanos', () => {
    const sim = newGame(world, { scenario: 'hermandad', seed: 36 });
    sim.betrayHermandad('Prueba.');
    expect(sim.brothers()).toBe(false);
    expect(sim.state.rep.VHL).toBeLessThanOrEqual(-50);
    // Y una partida guardada de traidores no vuelve a ser de hermanos al cargarla
    expect(deserialize(serialize(sim.state))!.flags.hermano).toBeUndefined();
  });

  it('Hijos de Vhlainska: las partidas guardadas antes de la 0.5 recuperan la hermandad', () => {
    const sim = newGame(world, { scenario: 'hermandad', seed: 37 });
    delete sim.state.flags.hermano;
    expect(deserialize(serialize(sim.state))!.flags.hermano).toBe(1);
  });

  it('Veteranos: al pie de la escalera del pozo, con una treintena de balas, sin comida y medio congelados', () => {
    const sim = newGame(world, { scenario: 'veteranos', seed: 37 });
    const f = world.layout.stationById.KHO;
    const stairs = f.annexes.find((a) => a.id === 'escaleraPozo')!;
    expect(stairs.exit).toBe('KHO');
    let bullets = 0;
    for (const c of sim.players) {
      bullets += countItem(c, 'balas') + (c.eq.arma?.mag ?? 0);
      expect(food(c)).toBe(false);
      expect(c.hunger).toBeLessThan(40);
      expect(totalHpFrac(c)).toBeLessThan(0.9);
      // Las máscaras de la defensa civil, con los filtros casi agotados
      expect(c.eq.cara?.id).toBe('mascaraGas');
      expect(c.eq.cara!.fil!).toBeLessThan(0.15 * 300);
    }
    expect(bullets).toBeGreaterThanOrEqual(25);
    expect(bullets).toBeLessThanOrEqual(35);
    expect(sim.state.rep.UNI).toBeLessThanOrEqual(-20);
    expect(sim.state.rep.CHE).toBeLessThanOrEqual(-20);
    expect(sim.state.rep.NOR).toBeGreaterThanOrEqual(10);
  });

  it('La Esmeralda: el Levantamiento dispara, y la galería tapiada sale de la propia estación', () => {
    const sim = newGame(world, { scenario: 'esmeralda', seed: 38 });
    const p = sim.players[0];
    const lev = { ...p, side: 'LEV' } as Char;
    expect(hostile(sim, lev, p)).toBe(true);
    expect(total(sim, 'pico')).toBe(1);
    expect(sim.state.money).toBe(5);
    for (const c of sim.players) expect(food(c)).toBe(false);
    // La galería sale de la propia Izumrudnaya y el primer tabique se alcanza a pie
    const l = world.layout.links.find((q) => q.def.latent)!;
    expect(l.def.a).toBe('MER');
    const before = linkPointAt(l, 11);
    const q = world.nav.nearestPassable(before.x, before.z, 2, true)!;
    expect(world.nav.findPath(p.x, p.z, q.x, q.z, { gates: true, margin: 60, maxNodes: 80000 })).toBeTruthy();
    // Y quien llega hasta ahí lo ve: cuenta como «galería encontrada»
    p.x = q.x;
    p.z = q.z;
    sim.reindex();
    run(sim, 2);
    expect(firstSteps(sim).find((s) => s.id === 'muro')?.done).toBe(true);
  });
});

describe('el Asedio de Mertvaya y los vecinos de la Esmeralda', () => {
  it('si cae Mertvaya y no habéis luchado contra la brigada, el Levantamiento deja de dispararos', () => {
    const sim = newGame(world, { scenario: 'esmeralda', seed: 51 });
    const p = sim.players[0];
    const lev = { ...p, side: 'LEV' } as Char;
    expect(hostile(sim, lev, p)).toBe(true);
    sim.state.time = (SIEGE_NEWS_DAY - 1) * 1440;
    stepSiege(sim);
    resolveBattle(sim, siegeState(sim), 'conquista');
    expect(sim.state.stations.MER.owner).toBe('LEV');
    expect(hostile(sim, lev, p)).toBe(false);
    // Los pasos del cerco ya no quedan pendientes
    const steps = firstSteps(sim);
    for (const id of ['muro', 'tabique', 'galeria', 'contrabando']) expect(steps.find((s) => s.id === id)?.done, id).toBe(true);
    expect(steps.find((s) => s.id === 'hambreCerco')?.hint).toContain('Sin el Califato no hay embargo');
  });

  it('quien luchó contra la brigada sigue siendo su enemigo', () => {
    const sim = newGame(world, { scenario: 'esmeralda', seed: 52 });
    sim.state.time = (SIEGE_NEWS_DAY - 1) * 1440;
    stepSiege(sim);
    const s = siegeState(sim);
    sim.state.flags.matados_LEV = (s.killsLEV0 ?? 0) + 3;
    resolveBattle(sim, s, 'conquista');
    expect(sim.state.rep.LEV).toBeLessThanOrEqual(-50);
  });
});

describe('las marcas de los primeros pasos', () => {
  it('se cumplen al hacer lo que piden', () => {
    const sim = newGame(world, { scenario: 'stalkers', seed: 41 });
    const done = (id: string) => firstSteps(sim).find((s) => s.id === id)?.done;
    expect(done('superficie')).toBe(false);
    // Arriba
    const exit = world.layout.surface.exits.find((e) => e.station === 'SEV')!;
    const top = world.nav.nearestPassable(exit.x + exit.dx * 8, exit.z + exit.dz * 8, 6, true)!;
    sim.players[0].x = top.x;
    sim.players[0].z = top.z;
    sim.reindex();
    run(sim, 2);
    expect(done('superficie')).toBe(true);
    expect(SCENARIO_BY_ID.stalkers.steps).toContain('glandula');
  });
});
