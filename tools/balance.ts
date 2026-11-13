// Banco de equilibrio: mide el juego sin pantalla para ajustar con datos.
//   npx tsx tools/balance.ts [economia|combate|asaltos|etapas|larga] [días] [comienzo]
// - economia: rutas de comercio, recetas rentables y lo que no se puede vender.
// - combate: peleas típicas repetidas con semillas distintas.
// - asaltos: fuerza de los asaltos según el día y la base, y cómo acaban.
// - larga: una partida de muchos días con base y asaltos; vigila que nada se desboque.

import { RECIPES } from '../src/data/edificios';
import { ITEMS } from '../src/data/items';
import type { Role } from '../src/data/gente';
import type { SideId } from '../src/data/tipos';
import { placeBuilding, canPlace } from '../src/sim/build';
import { addItem, makeCreature, makeHuman, totalHpFrac } from '../src/sim/chars';
import { buyPrice, fighterWeight, RAID_LEADER, raidGrade, raidStrength, sellPrice } from '../src/sim/events';
import { toughen } from '../src/sim/population';
import { newGame } from '../src/sim/newGame';
import type { Sim } from '../src/sim/sim';
import type { Char } from '../src/sim/types';
import { buildWorld, type World } from '../src/sim/world';

const world: World = buildWorld();
const pct = (v: number) => `${Math.round(v * 100)} %`;

// ---------------------------------------------------------------------------
// Economía
// ---------------------------------------------------------------------------

function economia() {
  const sim = newGame(world, { scenario: 'nadie', seed: 1 });
  const stations = world.layout.stations.map((f) => f.id).filter((id) => sim.state.stations[id]?.owner);
  const minBuy = (id: string, skip?: string) => Math.min(...stations.filter((s) => s !== skip).map((s) => buyPrice(sim, s, id, null)));
  const maxSell = (id: string, skip?: string) => Math.max(...stations.filter((s) => s !== skip).map((s) => sellPrice(sim, s, id, null)));
  console.log('Rutas de comercio (comprar donde es más barato y vender donde más pagan; reputación neutra):');
  const rows = Object.keys(ITEMS)
    .filter((id) => ITEMS[id].kind !== 'clave' && ITEMS[id].price > 0)
    .map((id) => ({ id, buy: minBuy(id), sell: maxSell(id) }))
    .sort((a, b) => (b.sell - b.buy) / b.buy - (a.sell - a.buy) / a.buy);
  for (const r of rows.slice(0, 8)) console.log(`  ${r.id.padEnd(16)} compra ${String(r.buy).padStart(4)} · vende ${String(r.sell).padStart(4)} · margen ${pct((r.sell - r.buy) / r.buy)}`);
  console.log('  Sin Mertvaya (estación sitiada):');
  for (const r of rows.map((r) => ({ ...r, sell: maxSell(r.id, 'MER') })).sort((a, b) => (b.sell - b.buy) / b.buy - (a.sell - a.buy) / a.buy).slice(0, 4))
    console.log(`  ${r.id.padEnd(16)} compra ${String(r.buy).padStart(4)} · vende ${String(r.sell).padStart(4)} · margen ${pct((r.sell - r.buy) / r.buy)}`);
  const zero = rows.filter((r) => stations.every((s) => sellPrice(sim, s, r.id, null) <= 0)).map((r) => r.id);
  console.log(`No se pueden vender en ningún sitio: ${zero.join(', ') || 'nada'}`);
  console.log('\nRecetas (entradas compradas, producto vendido fuera de Mertvaya), por minuto con oficio 30:');
  const rec = Object.values(RECIPES)
    .map((r) => {
      const cost = r.in.reduce((a, [id, n]) => a + minBuy(id) * n, 0);
      const val = maxSell(r.out[0], 'MER') * r.out[1];
      const secs = r.time / (0.6 + 30 * 0.025);
      return { id: r.id, cost, val, perMin: ((val - cost) / secs) * 60 };
    })
    .sort((a, b) => b.perMin - a.perMin);
  for (const r of rec.slice(0, 8)) console.log(`  ${r.id.padEnd(18)} ${String(r.cost).padStart(4)} → ${String(r.val).padStart(4)}  (${r.perMin.toFixed(0)}/min)`);
}

// ---------------------------------------------------------------------------
// Combate
// ---------------------------------------------------------------------------

/** Un tramo de túnel vacío, lejos de todo, para pelear sin interferencias. */
function arena(seed: number, scenario = 'nadie'): { sim: Sim; x: number; z: number; dx: number; dz: number } {
  const sim = newGame(world, { scenario, seed });
  const l = world.layout.links.find((q) => q.a === 'RUB' && q.b === 'KHO')!;
  const i = Math.floor(l.pts.length / 2);
  const a = l.pts[i];
  const b = l.pts[i + 1];
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  sim.state.squads = [];
  sim.state.chars = sim.state.chars.filter((c) => c.player);
  sim.reindex();
  return { sim, x: a.x, z: a.z, dx: (b.x - a.x) / len, dz: (b.z - a.z) / len };
}

function place(sim: Sim, c: Char, x: number, z: number) {
  const p = world.nav.nearestPassable(x, z, 6, true)!;
  c.x = p.x;
  c.z = p.z;
}

interface Team {
  /** Personas o criaturas del bando. */
  make: (sim: Sim) => Char[];
}

/** Equipa a un luchador con lo que se le pida (sustituye su equipo). */
function kit(c: Char, weapon: string | null, armor: string[] = []) {
  c.eq = {};
  if (weapon) {
    const r = ITEMS[weapon].weapon?.ranged;
    c.eq.arma = { id: weapon, n: 1, ...(r ? { mag: r.mag } : {}) };
    if (r && r.ammo !== 'aire') addItem(c, r.ammo, r.mag * 4);
  }
  for (const a of armor) c.eq[ITEMS[a].armor!.slot] = { id: a, n: 1 };
}

function human(sim: Sim, side: SideId, role: Role, skill: number | null, weapon?: string | null, armor?: string[]): Char {
  const c = makeHuman(sim, side, role, 0, 0);
  if (skill !== null) for (const k of Object.keys(c.sk) as (keyof typeof c.sk)[]) c.sk[k] = Math.max(1, Math.min(95, skill * (0.85 + Math.random() * 0.3)));
  if (weapon !== undefined) kit(c, weapon, armor);
  c.stance = 'agresivo';
  return c;
}

interface FightResult {
  win: boolean;
  secs: number;
  /** Del bando A: caídos (inconscientes o muertos) y muertos al final. */
  aDown: number;
  aDead: number;
  bDead: number;
}

function fight(seed: number, a: (sim: Sim) => Char[], b: (sim: Sim) => Char[], gap = 14, limit = 240): FightResult {
  const { sim, x, z, dx, dz } = arena(seed);
  for (const c of sim.players) sim.removeChar(c);
  sim.reindex();
  const A = a(sim);
  const B = b(sim);
  A.forEach((c, i) => {
    c.side = 'JUG';
    c.player = true;
    c.ai.mode = 'jugador';
    place(sim, c, x - dx * gap * 0.5 - dz * (i % 3) * 1.2, z - dz * gap * 0.5 + dx * (i % 3) * 1.2);
    sim.addChar(c);
  });
  B.forEach((c, i) => {
    place(sim, c, x + dx * gap * 0.5 + dz * (i % 3) * 1.2, z + dz * gap * 0.5 - dx * (i % 3) * 1.2);
    if (c.kind === 'humano') {
      c.ai.mode = 'quieto';
      sim.state.rep[c.side as 'VHL'] = -100;
    }
    sim.addChar(c);
  });
  sim.reindex();
  for (const c of A) c.target = B[0].id;
  for (const c of B) c.target = A[0].id;
  const up = (t: Char[]) => t.filter((c) => c.st === 'ok').length;
  let t = 0;
  for (; t < limit * 30; t++) {
    sim.step(1 / 30);
    if (!up(A) || !up(B)) break;
  }
  // Un minuto más para ver quién se desangra
  for (let k = 0; k < 60 * 30; k++) sim.step(1 / 30);
  return { win: up(B) === 0 && up(A) > 0, secs: t / 30, aDown: A.filter((c) => c.st !== 'ok').length, aDead: A.filter((c) => c.st === 'muerto').length, bDead: B.filter((c) => c.st === 'muerto').length };
}

function report(name: string, n: number, a: (sim: Sim) => Char[], b: (sim: Sim) => Char[]) {
  const rs: FightResult[] = [];
  for (let s = 0; s < n; s++) rs.push(fight(1000 + s * 17, a, b));
  const wins = rs.filter((r) => r.win).length;
  const avg = (f: (r: FightResult) => number) => rs.reduce((q, r) => q + f(r), 0) / rs.length;
  console.log(`  ${name.padEnd(54)} gana ${pct(wins / n).padStart(5)} · ${avg((r) => r.secs).toFixed(0).padStart(3)} s · caen ${avg((r) => r.aDown).toFixed(1)} · mueren ${avg((r) => r.aDead).toFixed(1)} de los tuyos, ${avg((r) => r.bDead).toFixed(1)} de ellos`);
}

const squadOf = (n: number, skill: number, weapon: string | null, armor: string[] = []) => (sim: Sim) => Array.from({ length: n }, () => human(sim, 'JUG', 'mercenario', skill, weapon, armor));
/** Escuadra mixta: alterna las armas de la lista. */
const mixedSquad = (n: number, skill: number, weapons: string[], armor: string[] = []) => (sim: Sim) => Array.from({ length: n }, (_, i) => human(sim, 'JUG', 'mercenario', skill, weapons[i % weapons.length], armor));
const raidOf = (strength: number) => (sim: Sim) => [human(sim, 'VHL', 'jefe', null), ...Array.from({ length: strength }, () => human(sim, 'VHL', 'bandido', null))];
/** Un asalto como los de la partida: con cabecilla solo si son bastantes. */
const realRaid = (strength: number, grade: number) => (sim: Sim) => {
  const raiders = [...(strength >= RAID_LEADER ? [human(sim, 'VHL', 'jefe', null)] : []), ...Array.from({ length: strength }, () => human(sim, 'VHL', 'bandido', null))];
  if (grade > 0) for (const c of raiders) toughen(sim, c, grade);
  return raiders;
};
const beasts = (kind: string, n: number) => (sim: Sim) => Array.from({ length: n }, () => makeCreature(sim, kind, 0, 0));

/** Asaltos de la partida contra escuadras razonables de cada etapa. */
function etapas(n = 16) {
  console.log(`Asaltos por etapas de la partida (${n} repeticiones; fuerza según la curva de asaltos):`);
  // Nombre, día, obras, gente, nivel y equipo
  const stages: [string, number, number, number, number, string[], string[]][] = [
    ['Comienzo: 3 novatos (12), cuchillo/machete/tubo', 4, 4, 3, 12, ['cuchillo', 'machete', 'tubo'], []],
    ['Colonos: 5 (10), palanca/pala/fusil/cuchillo', 6, 6, 5, 10, ['palanca', 'pala', 'fusilTunel', 'cuchillo', 'cuchillo'], []],
    ['Arranque: 4 (18), machete/fusil del túnel', 8, 6, 4, 18, ['machete', 'fusilTunel'], ['chaleco']],
    ['Media: 6 (30), fusil del túnel/machete, chaleco', 15, 12, 6, 30, ['fusilTunel', 'machete'], ['chaleco']],
    ['Avanzada modesta: 7 (34), fusil/escopeta/machete, peto', 30, 15, 7, 34, ['fusilTunel', 'escopeta', 'machete'], ['petoCuero']],
    ['Avanzada: 9 (42), AK/hacha, peto y casco', 30, 20, 9, 42, ['ak', 'hacha'], ['petoCuero', 'casco']],
    ['Tardía modesta: 10 (45), fusil/cerrojo/hacha, peto y casco', 60, 25, 10, 45, ['fusilTunel', 'cerrojo', 'hacha'], ['petoCuero', 'casco']],
    ['Tardía: 12 (55), AK/carabina, placas y casco', 60, 30, 12, 55, ['ak', 'carabina'], ['chalecoPlacas', 'casco']],
    ['Muy tardía: 14 (60), AK/carabina, placas y casco', 90, 35, 14, 60, ['ak', 'carabina'], ['chalecoPlacas', 'casco']],
  ];
  for (const [name, day, builds, size, skill, weapons, armor] of stages) {
    const team = mixedSquad(size, skill, weapons, armor);
    const k = raidStrength(day, builds, size * fighterWeight(skill));
    const grade = raidGrade(day);
    report(`${name} vs ${k}${k >= RAID_LEADER ? ' + cabecilla' : ''} (día ${day}, veteranía ${grade.toFixed(1)})`, n, team, realRaid(k, grade));
  }
}

function combate(n = 16) {
  console.log(`Peleas (${n} repeticiones cada una):`);
  report('3 novatos (10) con cuchillo vs 5 ratas', n, squadOf(3, 10, 'cuchillo'), beasts('rata', 5));
  report('3 novatos (10) con cuchillo vs 2 skrebuns', n, squadOf(3, 10, 'cuchillo'), beasts('skrebun', 2));
  report('3 novatos (10) con cuchillo vs cabecilla + 3 saqueadores', n, squadOf(3, 10, 'cuchillo'), raidOf(3));
  report('5 curtidos (30) con fusil del túnel vs cabecilla + 6', n, squadOf(5, 30, 'fusilTunel', ['chaleco']), raidOf(6));
  report('6 veteranos (50) con Kaláshnikov y placas vs cabecilla + 8', n, squadOf(6, 50, 'ak', ['chalecoPlacas', 'casco']), raidOf(8));
  report('1 soldado (35) con AK vs 1 soldado (35) con AK', n, squadOf(1, 35, 'ak'), (sim) => [human(sim, 'VHL', 'soldado', 35, 'ak')]);
  report('1 soldado (35) con AK y placas vs 1 soldado (35) con AK', n, squadOf(1, 35, 'ak', ['chalecoPlacas', 'casco']), (sim) => [human(sim, 'VHL', 'soldado', 35, 'ak')]);
  report('1 hachero (35) vs 1 tirador (35) con fusil de cerrojo', n, squadOf(1, 35, 'hacha'), (sim) => [human(sim, 'VHL', 'soldado', 35, 'cerrojo')]);
}

// ---------------------------------------------------------------------------
// Asaltos
// ---------------------------------------------------------------------------

function asaltos() {
  console.log('Fuerza de los asaltos (gente que viene, sin contar al cabecilla):');
  const header = ['obras \\ día', ...[1, 5, 10, 20, 40, 80].map((d) => `día ${d}`)];
  console.log('  ' + header.map((h) => h.padStart(9)).join(''));
  for (const builds of [3, 8, 15, 30]) {
    const row = [1, 5, 10, 20, 40, 80].map((day) => String(raidStrength(day, builds, 3)));
    console.log('  ' + [`${builds} obras`, ...row].map((h) => h.padStart(9)).join(''));
  }
  console.log('  (con una escuadra de 3; la fuerza también crece con la escuadra:)');
  for (const squad of [3, 6, 12, 20]) console.log(`  escuadra de ${String(squad).padStart(2)}, 15 obras, día 40: ${raidStrength(40, 15, squad)}`);
}

// ---------------------------------------------------------------------------
// Partida larga
// ---------------------------------------------------------------------------

function larga(days = 30, scenario = 'colonos') {
  const sim = newGame(world, { scenario, seed: 77 });
  // Una base pequeña junto al punto de partida para que lleguen asaltos
  const p = sim.players[0];
  let built = 0;
  for (const def of ['hogueraJ', 'saco', 'saco', 'cajonJ', 'bancalJ', 'colectorJ']) {
    for (let r = 3; r < 26 && built < 99; r += 1.5) {
      let ok = false;
      for (let a = 0; a < 6.28; a += 0.5) {
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        if (canPlace(sim, def, x, z, 0) === null) {
          placeBuilding(sim, def, x, z, 0, true);
          built++;
          ok = true;
          break;
        }
      }
      if (ok) break;
    }
  }
  // Como lo dejaría alguien que juega: postura defensiva, comida y vendas
  for (const c of sim.players) {
    addItem(c, 'hongosSecos', 60);
    addItem(c, 'vendas', 10);
  }
  console.log(`Partida larga («${scenario}»): ${days} días, ${sim.players.length} en la escuadra y ${built} obras.`);
  let raids = 0;
  const kinds: string[] = [];
  const t0 = performance.now();
  for (let d = 1; d <= days; d++) {
    for (let k = 0; k < 1440 * 30; k++) {
      sim.step(1 / 30);
      for (const e of sim.events) if (e.t === 'sonido' && e.k === 'alarma') raids++;
      for (const e of sim.events) if (e.t === 'aviso' && /vigías|jauría/.test(e.msg)) kinds.push(`día ${d}: ${/jauría/.test(e.msg) ? 'jauría' : 'saqueadores'}`);
      sim.events.length = 0;
    }
    const st = sim.state;
    if (d % 5 === 0 || d === 1)
      console.log(
        `  día ${String(d).padStart(3)} · escuadra ${sim.players.filter((c) => c.st !== 'muerto').length} (salud ${pct(sim.players.reduce((a, c) => a + totalHpFrac(c), 0) / Math.max(1, sim.players.length))}) · personajes ${st.chars.length} · escuadras ${st.squads.length} · bultos ${st.drops.length} · registro ${st.log.length} · asaltos ${raids} · ${((performance.now() - t0) / d / 1000).toFixed(1)} s/día`,
      );
    if (!sim.players.length) {
      console.log(`  La colonia cae el día ${d}. Asaltos: ${kinds.join(', ')}. Lo último del registro:`);
      for (const l of st.log.slice(-12)) console.log(`    [día ${Math.floor(l.t / 1440) + 1}] ${l.msg}`);
      break;
    }
  }
}

const what = process.argv[2] ?? 'todo';
// Uso: larga [días] [comienzo]
if (what === 'economia' || what === 'todo') economia();
if (what === 'combate' || what === 'todo') combate();
if (what === 'asaltos' || what === 'todo') asaltos();
if (what === 'etapas' || what === 'todo') etapas();
if (what === 'larga') larga(Number(process.argv[3] ?? 30), process.argv[4] ?? 'colonos');
