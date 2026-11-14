// Primer suceso de la historia: el Asedio de Mertvaya.
//
// Desde 2029 el Levantamiento Popular asfixia con su embargo a Mertvaya («la
// Muerta» para los soldados del frente; Izumrudnaya, «la Esmeralda», para sus
// habitantes), la estación del Califato de Mohhammed Baghdadi. Es lo único que
// le falta: «Tomar Mertvaya» es su gran objetivo. El día 6 se sabe que el
// Consejo Revolucionario reúne una brigada en Vysotnaya, frente al Túnel de
// Mertvaya. Si en los diez días siguientes no pasa nada que lo impida (Belov,
// el estratega del asedio, muerto o desaparecido; Baghdadi preso o muerto, con
// el imán Karimov dispuesto a negociar; el Consejo convencido de que el cerco
// hará el trabajo sin sangre; o la brigada deshecha en su campamento), el día
// 16 la 2.ª Brigada Roja cruza el túnel y asalta Mertvaya. La batalla se libra
// de verdad si tu gente está cerca y, si no, se resuelve por las fuerzas de
// cada bando; en ambos casos muere gente, y la estación puede cambiar de manos.

import type { Role } from '../data/gente';
import type { SideId } from '../data/tipos';
import { insideStation } from '../world/layout';
import { retreat } from './asaltos';
import { kill, relKey } from './combat';
import { release } from './derrota';
import { newSquad, placePos } from './population';
import type { Sim } from './sim';
import type { Char, Siege, Squad } from './types';

const DAY = 1440;
/** Día en que se sabe lo que prepara el Levantamiento y día en que marcha la brigada. */
export const SIEGE_NEWS_DAY = 6;
export const SIEGE_DAY = 16;
/** Días entre el aviso y la marcha: si en ellos no pasa nada, la brigada sale. */
export const SIEGE_WINDOW = SIEGE_DAY - SIEGE_NEWS_DAY;
/** La estación sitiada, el bando que la defiende y de dónde sale la brigada. */
export const TARGET = 'MER';
export const DEFENDER = 'CAL';
export const MUSTER = 'VYS';
/** Lo más que dura una batalla en directo antes de decidirse por las fuerzas que quedan. */
const BATTLE_MAX = 5 * 60;

/** La 2.ª Brigada Roja de Vysotnaya: un comisario, tropa de choque, fusileros y dos zapadores. */
export const BRIGADE: Role[] = ['oficial', 'elite', 'elite', 'elite', 'elite', ...Array<Role>(11).fill('soldado'), 'obrero', 'obrero'];
export const BRIGADE_NAME = '2.ª Brigada Roja';

/** Quienes mandan la defensa de Mertvaya: el califa y el comandante de su guardia. */
const LEADERS = ['baghdadi', 'cal_harbi'];
const PEACEFUL = new Set(['civil', 'comerciante', 'refugiado', 'obrero', 'medico', 'caravanero']);
/** Peso de cada clase de combatiente en la batalla resuelta por fuerzas. */
const WEIGHT: Partial<Record<string, number>> = { elite: 1.7, oficial: 1.3, lider: 1.5, soldado: 1, guardia: 0.9, mercenario: 1.1, obrero: 0.6 };

/** Estado del suceso (se crea al empezar la partida; en partidas antiguas, al cargarla). */
export function siegeState(sim: Sim): Siege {
  const st = sim.state;
  if (!st.asedio) {
    // En una partida guardada antes de que existiera el suceso, se dan los diez días desde ahora
    const late = st.time > (SIEGE_NEWS_DAY - 1) * DAY;
    st.asedio = { phase: 'espera', deadline: late ? st.time + SIEGE_WINDOW * DAY : (SIEGE_DAY - 1) * DAY, squad: 0 };
  }
  return st.asedio;
}

/** Brigada del Levantamiento (si está en marcha). */
export function brigade(sim: Sim): Squad | null {
  const s = sim.state.asedio;
  return s?.squad ? sim.squad(s.squad) : null;
}

/** ¿Está el suceso en curso (antes del desenlace)? */
export function siegeActive(sim: Sim): boolean {
  const p = sim.state.asedio?.phase;
  return p === 'reunion' || p === 'marcha' || p === 'asalto';
}

/** ¿Ha caído Mertvaya (ya no es del Califato)? */
export function mertvayaFallen(sim: Sim): boolean {
  return sim.state.stations[TARGET]?.owner !== DEFENDER;
}

function pos(sim: Sim, id: string): { x: number; z: number } {
  const p = placePos(sim, id)!;
  return sim.world.nav.nearestPassable(p.x, p.z, 10) ?? p;
}

/** Miembros vivos de la brigada (los que están a la vista, en pie). */
function standing(sim: Sim, sq: Squad): Char[] {
  const out: Char[] = [];
  for (const m of sq.roster) {
    const c = m.id ? sim.char(m.id) : null;
    if (c && c.st === 'ok') out.push(c);
  }
  return out;
}

/** Bajas de la brigada (fracción del total). */
function brigadeLosses(sq: Squad): number {
  return sq.roster.filter((m) => m.dead).length / Math.max(1, sq.roster.length);
}

/** ¿Hay gente de la estación a la vista (la estación está «viva» porque tu gente anda cerca)? */
function stationSpawned(sim: Sim, place: string): boolean {
  return sim.state.chars.some((c) => c.slot?.startsWith(place + ':'));
}

/** Combatientes del Califato en pie en su estación. */
function defenders(sim: Sim): Char[] {
  return sim.state.chars.filter((c) => c.side === DEFENDER && c.st === 'ok' && !c.player && c.kind === 'humano' && !c.captive && c.ai.place === TARGET && !PEACEFUL.has(c.role) && !c.squad);
}

/** Puestos de guardia de Mertvaya (residentes que defienden la estación). */
function guardSlots(sim: Sim): string[] {
  const out: string[] = [];
  sim.world.decor.spots.forEach((sp, i) => {
    if (sp.place === TARGET && (sp.kind === 'guardia' || sp.kind === 'peaje')) out.push(`${TARGET}:${i}`);
  });
  return out;
}

function slotAlive(sim: Sim, slot: string): boolean {
  const t = sim.state.stations[TARGET]?.dead[slot];
  return !(t && t > sim.state.time);
}

/** Vecinos de Mertvaya (los mismos que reparte la población). */
function neighbourSlots(sim: Sim): string[] {
  const f = sim.world.layout.stationById[TARGET];
  const n = f ? Math.max(8, Math.min(60, Math.round(f.def.population / 16))) : 20;
  return Array.from({ length: n }, (_, k) => `${TARGET}:v${k}`);
}

/** ¿Falta Belov? Muerto, preso en tu base o cargado por tu gente lejos de Stalingradskaya. */
function belovGone(sim: Sim): boolean {
  const st = sim.state;
  if (st.flags.muerto_lev_belov) return true;
  const belov = st.chars.find((c) => c.unique === 'lev_belov');
  if (!belov) return false;
  if (belov.captive?.by === 'JUG') return true;
  const stl = placePos(sim, 'STL');
  return !!(belov.carriedBy && sim.char(belov.carriedBy)?.player && stl && Math.hypot(belov.x - stl.x, belov.z - stl.z) > 70);
}

/**
 * Cuánto aguantan los defensores según lo que comen: el embargo los tiene
 * famélicos, salvo que la Galería Olvidada o el contrabando de tu gente metan
 * comida en la estación.
 */
export function supplyFactor(sim: Sim): number {
  const f = sim.state.flags;
  return (f.galeriaOlvidada ? 1 : 0.85) + Math.min(0.15, (f.contrabando ?? 0) / 200);
}

// ---------------------------------------------------------------------------
// Paso del suceso
// ---------------------------------------------------------------------------

/** Avanza el suceso (se llama con los sucesos del mundo, dos veces por segundo). */
export function stepSiege(sim: Sim): void {
  const s = siegeState(sim);
  const st = sim.state;
  switch (s.phase) {
    case 'espera': {
      if (st.time >= s.deadline - SIEGE_WINDOW * DAY) startGathering(sim, s);
      return;
    }
    case 'reunion': {
      // ¿Ha pasado algo que lo impida?
      if (belovGone(sim)) return foil(sim, s, 'belov');
      if (st.flags.muerto_baghdadi || st.flags.baghdadiPreso) return foil(sim, s, 'karimov');
      const sq = brigade(sim);
      if (!sq || brigadeLosses(sq) >= 0.6) return foil(sim, s, 'brigada');
      if (st.time >= s.deadline) march(sim, s, sq);
      return;
    }
    case 'marcha': {
      const sq = brigade(sim);
      if (!sq || brigadeLosses(sq) >= 0.75) return foil(sim, s, 'emboscada');
      const f = sim.world.layout.stationById[TARGET];
      if (insideStation(f, sq.x, sq.z, 40)) return atTheGates(sim, s, sq);
      if (sq.mode !== 'viaje') {
        // Retomar la marcha tras un alto (o una pelea por el camino)
        const to = pos(sim, TARGET);
        sq.gx = to.x;
        sq.gz = to.z;
        sq.mode = 'viaje';
        sq.route = null;
      }
      return;
    }
    case 'asalto': {
      const sq = brigade(sim);
      if (!sq || sq.roster.every((m) => m.dead)) return finish(sim, s, 'rechazo');
      const to = pos(sim, TARGET);
      const f = sim.world.layout.stationById[TARGET];
      const live = sq.mat && stationSpawned(sim, TARGET);
      if (live) {
        // La batalla en directo: decide quién queda en pie
        const mine = standing(sim, sq);
        const theirs = defenders(sim);
        const inside = mine.filter((c) => insideStation(f, c.x, c.z, 6));
        if (!s.battleFrom && (inside.length || theirs.some((d) => d.target && mine.some((m) => m.id === d.target)))) startBattle(sim, s);
        if (!mine.length) return finish(sim, s, 'rechazo');
        if (!theirs.length && inside.length) return finish(sim, s, 'conquista');
        if (s.battleFrom && st.time - s.battleFrom > BATTLE_MAX) return resolveBattle(sim, s);
        return;
      }
      // Sin nadie de tu gente cerca: al llegar, la batalla se decide por las fuerzas de cada bando
      if (Math.hypot(sq.x - to.x, sq.z - to.z) < 20 || (s.battleFrom && st.time - s.battleFrom > 30)) {
        if (!s.battleFrom) startBattle(sim, s);
        return resolveBattle(sim, s);
      }
      if (sq.mode !== 'asalto') {
        sq.gx = to.x;
        sq.gz = to.z;
        sq.mode = 'asalto';
        sq.route = null;
      }
      return;
    }
    default:
      return;
  }
}

/** El día 6: el Levantamiento reúne la brigada en Vysotnaya. */
function startGathering(sim: Sim, s: Siege): void {
  s.phase = 'reunion';
  const at = pos(sim, MUSTER);
  const sq = newSquad(sim, 'LEV', 'brigada', BRIGADE_NAME, BRIGADE, at, [], MUSTER);
  sq.grade = 0.6;
  sq.mode = 'espera';
  sq.wait = 1e9;
  sq.life = 1e9;
  s.squad = sq.id;
  sim.log(`En Vysotnaya, frente al Túnel de Mertvaya, el Consejo Revolucionario reúne la ${BRIGADE_NAME}. Tras cuatro años de embargo, el Levantamiento quiere acabar con el Califato. Si nadie lo impide, la brigada cruzará el túnel el día ${dayOf(s.deadline)}.`, 'historia');
  sim.emit({ t: 'mundo', k: 'suceso', id: 1 });
}

/** El día 16: la brigada cruza el Túnel de Mertvaya. */
function march(sim: Sim, s: Siege, sq: Squad): void {
  const st = sim.state;
  s.phase = 'marcha';
  // Guerra abierta, aunque hubiera tregua
  st.rel[relKey(DEFENDER, 'LEV')] = -100;
  const to = pos(sim, TARGET);
  sq.gx = to.x;
  sq.gz = to.z;
  sq.mode = 'viaje';
  sq.route = null;
  sq.wait = 0;
  s.leaders = LEADERS.filter((id) => !st.flags['muerto_' + id]);
  s.killsLEV0 = st.flags.matados_LEV ?? 0;
  s.killsCAL0 = st.flags.matados_CAL ?? 0;
  sim.log(`La ${BRIGADE_NAME} sale de Vysotnaya por el Túnel de Mertvaya. El Consejo Revolucionario ordena tomar la estación del Califato.`, 'historia');
  sim.emit({ t: 'mundo', k: 'suceso', id: 2 });
  sim.emit({ t: 'sonido', k: 'alarma', x: NaN, z: NaN });
}

/** La brigada llega a las barricadas de Mertvaya: empieza el asalto. */
function atTheGates(sim: Sim, s: Siege, sq: Squad): void {
  s.phase = 'asalto';
  const to = pos(sim, TARGET);
  sq.gx = to.x;
  sq.gz = to.z;
  sq.mode = 'asalto';
  sq.route = null;
  sq.wait = 0;
  const tgt = sim.state.stations[TARGET];
  tgt.alert = Math.max(tgt.alert, 1);
  sim.log(s.warned ? 'La brigada llega a las barricadas de Mertvaya. Al-Harbi, avisado, la espera tras los sacos con toda la guardia.' : 'La brigada llega a las barricadas de Mertvaya. Los centinelas del Califato dan la alarma demasiado tarde.', 'historia');
  sim.emit({ t: 'mundo', k: 'suceso', id: 3 });
}

function startBattle(sim: Sim, s: Siege): void {
  s.battleFrom = sim.state.time;
  s.killsLEV0 ??= sim.state.flags.matados_LEV ?? 0;
  s.killsCAL0 ??= sim.state.flags.matados_CAL ?? 0;
  sim.log('Se combate en Mertvaya: la brigada asalta el andén y la guardia del Califato lo defiende palmo a palmo.', 'historia');
}

/** Algo lo ha impedido. */
function foil(sim: Sim, s: Siege, why: NonNullable<Siege['why']>): void {
  const st = sim.state;
  s.phase = 'hecho';
  s.result = 'frustrado';
  s.why = why;
  const sq = brigade(sim);
  if (sq) {
    // La brigada vuelve a sus cuarteles (y allí se disuelve)
    sq.life = Math.min(sq.life, 2 * DAY);
    if (why === 'emboscada' || sq.mode !== 'espera') retreat(sim, sq);
    else sq.life = Math.min(sq.life, 600);
  }
  const text: Record<typeof why, string> = {
    belov: 'Sin Anatoli Belov, el estratega del asedio, el Consejo aplaza el asalto a Mertvaya. El cerco sigue, pero la brigada no sale de Vysotnaya.',
    karimov: 'Sin Baghdadi, el imán Karimov toma el mando de Izumrudnaya y pide negociar el fin del embargo. El Consejo Revolucionario aplaza el asalto.',
    consejo: 'El Consejo Revolucionario vota dar más tiempo al cerco: Mertvaya caerá sola, sin derramar sangre roja. La brigada vuelve a sus barracones.',
    brigada: 'La brigada que se reunía en Vysotnaya ha quedado deshecha antes de salir. El Levantamiento renuncia, por ahora, a tomar Mertvaya.',
    emboscada: 'La brigada del Levantamiento ha caído en el Túnel de Mertvaya. Los supervivientes vuelven a Vysotnaya y el Califato sigue en pie.',
  };
  sim.log(text[why], 'historia');
  if (why === 'karimov') {
    // Tregua mientras se negocia (la misma que trae entregar al califa)
    const k = relKey(DEFENDER, 'LEV');
    st.rel[k] = Math.max(st.rel[k] ?? 0, -40);
  }
  if (why === 'brigada' || why === 'emboscada') sim.rep(DEFENDER, 10);
  sim.emit({ t: 'mundo', k: 'suceso', id: 5 });
}

// ---------------------------------------------------------------------------
// La batalla
// ---------------------------------------------------------------------------

/** Fuerza de un grupo de combatientes. */
function power(chars: { role: string }[], k = 1): number {
  return chars.reduce((a, c) => a + (WEIGHT[c.role] ?? 1), 0) * k;
}

/** Probabilidad de que la brigada tome la estación con las fuerzas de cada lado. */
function odds(pb: number, pd: number): number {
  if (pb <= 0) return 0;
  if (pd <= 0) return 1;
  return Math.pow(pb, 1.3) / (Math.pow(pb, 1.3) + Math.pow(pd, 1.3));
}

/**
 * Resuelve la batalla por las fuerzas que quedan a cada lado: la brigada (con
 * su veteranía) contra la guardia del Califato (atrincherada, más fuerte si
 * alguien la avisó y más débil cuanto más hambre pasa), con Baghdadi y
 * al-Harbi al frente si siguen vivos. Mueren los que tengan que morir de cada
 * bando, también civiles si cae la estación.
 */
export function resolveBattle(sim: Sim, s: Siege, forced?: 'conquista' | 'rechazo'): void {
  const st = sim.state;
  const sq = brigade(sim);
  const rng = sim.rng;
  // Brigada
  const mat = !!sq?.mat;
  const liveB = sq && mat ? standing(sim, sq) : [];
  const restB = sq ? sq.roster.filter((m) => !m.dead && (!mat || !m.id)) : [];
  const pb = power([...liveB, ...restB.map((m) => ({ role: m.k }))], 1 + (sq?.grade ?? 0) * 0.4);
  // Defensores
  const spawned = stationSpawned(sim, TARGET);
  const liveD = spawned ? defenders(sim) : [];
  const slots = spawned ? [] : guardSlots(sim).filter((k) => slotAlive(sim, k));
  const figures = LEADERS.filter((id) => !st.flags['muerto_' + id]);
  let pd = (spawned ? power(liveD) : slots.length * 0.95) * 1.2 * (s.warned ? 1.3 : 1) * supplyFactor(sim);
  if (!spawned) pd += figures.length * 2.2;
  const outcome = forced ?? (rng.chance(odds(pb, pd)) ? 'conquista' : 'rechazo');
  const ratio = outcome === 'conquista' ? pd / Math.max(1, pb) : pb / Math.max(1, pd);
  const winLoss = Math.max(0.12, Math.min(0.65, 0.12 + 0.45 * ratio));
  const loseLoss = rng.range(0.6, 0.9);
  // Bajas de la brigada
  const totalB = liveB.length + restB.length;
  const bDead = Math.round(totalB * (outcome === 'conquista' ? winLoss : loseLoss));
  let deadB = 0;
  for (const c of rng.shuffle([...liveB])) {
    if (deadB >= bDead) break;
    kill(sim, c, undefined, 'en la batalla de Mertvaya');
    deadB++;
  }
  for (const m of rng.shuffle([...restB])) {
    if (deadB >= bDead) break;
    m.dead = true;
    deadB++;
  }
  // Bajas del Califato (y de quienes lo mandan)
  const dLoss = outcome === 'conquista' ? loseLoss : winLoss;
  let deadD = 0;
  const tgt = st.stations[TARGET];
  if (spawned) {
    for (const c of rng.shuffle([...liveD])) {
      if (deadD >= Math.round(liveD.length * dLoss)) break;
      kill(sim, c, undefined, 'en la batalla de Mertvaya');
      deadD++;
    }
  } else {
    for (const k of rng.shuffle([...slots])) {
      if (deadD >= Math.round(slots.length * dLoss)) break;
      tgt.dead[k] = st.time + 6 * DAY;
      deadD++;
    }
    for (const id of figures) if (rng.chance(outcome === 'conquista' ? 0.3 : 0.12)) st.flags['muerto_' + id] = 1;
  }
  s.report = [`Caen ${deadD} ${deadD === 1 ? 'defensor' : 'defensores'} del Califato y ${deadB} ${deadB === 1 ? 'soldado' : 'soldados'} de la brigada.`];
  if (outcome === 'rechazo') {
    if (st.flags.muerto_baghdadi && figures.includes('baghdadi')) s.report.push('Mohhammed Baghdadi ha muerto en las barricadas: Izumrudnaya ha resistido, pero sin su califa.');
    if (st.flags.muerto_cal_harbi && figures.includes('cal_harbi')) s.report.push('El comandante al-Harbi ha caído defendiendo el túnel, como siempre dijo que haría.');
  }
  finish(sim, s, outcome);
}

/** Desenlace de la batalla: conquista o rechazo, y lo que eso cambia en el metro. */
function finish(sim: Sim, s: Siege, outcome: 'conquista' | 'rechazo'): void {
  const st = sim.state;
  const sq = brigade(sim);
  s.phase = 'hecho';
  s.result = outcome;
  s.report ??= [];
  const killsLEV = (st.flags.matados_LEV ?? 0) - (s.killsLEV0 ?? 0);
  const killsCAL = (st.flags.matados_CAL ?? 0) - (s.killsCAL0 ?? 0);
  // ¿Estaba tu gente en la batalla (en la estación o a la boca del túnel)?
  const f = sim.world.layout.stationById[TARGET];
  const present = !!f && sim.players.some((c) => c.st !== 'muerto' && !c.captive && insideStation(f, c.x, c.z, 40));
  if (outcome === 'conquista') {
    conquer(sim, s);
    if (sq) {
      // Los supervivientes quedan de guarnición un día, hasta que llegue el relevo
      sq.mode = 'espera';
      sq.wait = 1e9;
      sq.done = true;
      sq.life = DAY;
      // Si no habéis luchado contra ella, la brigada no os guarda rencor
      if (killsLEV <= 0) sq.angry = false;
    }
    sim.log(`Mertvaya ha caído. La bandera roja del Levantamiento ondea sobre el manantial esmeralda. ${s.report.join(' ')}`, 'historia');
    if ((s.ally === 'LEV' && present) || killsCAL > 0) {
      sim.rep('LEV', 12, 'luchar junto a la brigada');
      st.money += 150;
      s.report.push('El Consejo Revolucionario os paga 150 cartuchos por vuestra ayuda.');
    }
  } else {
    if (sq) {
      sq.life = Math.min(sq.life, 2 * DAY);
      retreat(sim, sq);
    }
    sim.log(`Mertvaya resiste. La brigada del Levantamiento se retira por el túnel dejando atrás a sus muertos. ${s.report.join(' ')}`, 'historia');
    if ((s.ally === DEFENDER && present) || killsLEV > 0) {
      sim.rep(DEFENDER, 20, 'defender Mertvaya');
      st.money += 120;
      s.report.push('El Califato os entrega 120 cartuchos: en Izumrudnaya no lo olvidarán.');
    }
  }
  sim.emit({ t: 'mundo', k: 'suceso', id: 4 });
}

/**
 * La estación cambia de manos: Baghdadi y al-Harbi mueren o van presos, la
 * guardia que queda se rinde, el imán Karimov pacta con el Consejo para que
 * los civiles vivan, el contrabandista Aliyev se esfuma, se rompen las cadenas
 * del manantial y se acaba el embargo.
 */
function conquer(sim: Sim, s: Siege): void {
  const st = sim.state;
  const tgt = st.stations[TARGET];
  tgt.from = DEFENDER;
  tgt.owner = 'LEV';
  tgt.alert = 0;
  // Los puestos de guardia los ocupa enseguida la gente del Levantamiento
  for (const k of guardSlots(sim)) if (tgt.dead[k]) tgt.dead[k] = Math.min(tgt.dead[k], st.time + 0.2 * DAY);
  // El califa y su comandante: muertos en la batalla, o presos camino de Stalingradskaya
  const fought = s.leaders ?? LEADERS;
  const lines: Record<string, [dead: string, dies: string, taken: string]> = {
    baghdadi: [
      'Mohhammed Baghdadi ha muerto en la defensa de su califato.',
      'Mohhammed Baghdadi muere disparando desde la puerta de la mezquita.',
      'Baghdadi es capturado vivo: lo llevan a Stalingradskaya para que responda ante un tribunal por las matanzas de Izumrudnaya.',
    ],
    cal_harbi: [
      'El comandante al-Harbi ha caído en las barricadas.',
      'Tariq al-Harbi muere a la cabeza de su guardia, como siempre dijo que haría.',
      'Tariq al-Harbi, herido, se rinde con lo que queda de la guardia.',
    ],
  };
  for (const id of LEADERS) {
    if (!fought.includes(id)) continue;
    const c = st.chars.find((q) => q.unique === id);
    if (st.flags['muerto_' + id] || c?.st === 'muerto') {
      st.flags['muerto_' + id] = 1;
      s.report!.push(lines[id][0]);
      continue;
    }
    if (c && sim.rng.chance(0.5)) {
      kill(sim, c, undefined, 'en la batalla de Mertvaya');
      s.report!.push(lines[id][1]);
      continue;
    }
    if (c) sim.removeChar(c);
    st.flags['muerto_' + id] = 1;
    st.flags['preso_' + id] = 1;
    if (id === 'baghdadi') st.flags.baghdadiPreso = 1;
    s.report!.push(lines[id][2]);
  }
  // Karimov pacta con el Consejo; Aliyev desaparece por una de sus grietas
  if (!st.flags.muerto_karimov) {
    st.figureSide = { ...(st.figureSide ?? {}), karimov: 'LEV' };
    s.report!.push('El imán Karimov negocia la rendición de los civiles y se queda para que la estación no muera de hambre.');
  }
  if (!st.flags.muerto_cal_aliyev) {
    const al = st.chars.find((q) => q.unique === 'cal_aliyev');
    if (al && al.st !== 'muerto') sim.removeChar(al);
    st.flags.muerto_cal_aliyev = 1;
    st.flags.huido_cal_aliyev = 1;
    s.report!.push('Aliyev, el contrabandista, se esfuma por una grieta que ni el Levantamiento conocía.');
  }
  // La gente que hay a la vista en la estación
  let civilDead = 0;
  for (const c of [...st.chars]) {
    if (c.player || c.ai.place !== TARGET || c.side !== DEFENDER || c.squad || c.st === 'muerto') continue;
    if (PEACEFUL.has(c.role) || c.unique === 'karimov') {
      // Algunos civiles mueren en el asalto; los demás quedan bajo el Consejo
      if (!c.unique && sim.rng.chance(0.12)) {
        kill(sim, c, undefined, 'en el asalto');
        civilDead++;
        continue;
      }
      c.side = 'LEV';
      c.ai.sub = '';
      c.target = 0;
      continue;
    }
    // Los soldados que quedan en pie se rinden y se los llevan
    sim.removeChar(c);
  }
  // Sin nadie a la vista, también caen civiles
  if (!stationSpawned(sim, TARGET)) {
    for (const k of neighbourSlots(sim)) {
      if (sim.rng.chance(0.12)) {
        tgt.dead[k] = st.time + 3 * DAY;
        civilDead++;
      }
    }
  }
  if (civilDead) s.report!.push(`Mueren ${civilDead} ${civilDead === 1 ? 'civil' : 'civiles'} en el asalto.`);
  // Los esclavos del Califato salen libres
  for (const c of st.chars) {
    if (c.player && c.captive && c.captive.by === DEFENDER) {
      release(sim, c, 'condena');
      s.report!.push(`El Levantamiento rompe las cadenas del manantial: ${c.name} sale libre.`);
    }
  }
}

function dayOf(t: number): number {
  return Math.floor(t / DAY) + 1;
}

// ---------------------------------------------------------------------------
// Lo que puede hacer el jugador
// ---------------------------------------------------------------------------

/** Confianza del Levantamiento necesaria para convencer al Consejo, y de cada bando para luchar a su lado. */
export const PERSUADE_LEV = 30;
export const JOIN_REP = 10;

/** Convencer al Consejo (hablando con Morozov) de que el cerco hará el trabajo sin sangre. */
export function persuadeCouncil(sim: Sim): string | null {
  const s = siegeState(sim);
  if (s.phase !== 'reunion') return 'Ya es tarde para eso';
  if (sim.state.rep.LEV < PERSUADE_LEV) return `El Consejo no os escucha (hace falta reputación ${PERSUADE_LEV} con el Levantamiento)`;
  foil(sim, s, 'consejo');
  return null;
}

/** Avisar al Califato de cuándo y por dónde vendrá la brigada: los defensores se preparan. */
export function warnCaliphate(sim: Sim): string | null {
  const s = siegeState(sim);
  if (!siegeActive(sim) || s.phase === 'asalto') return 'Ya no hay tiempo';
  if (s.warned) return 'Ya lo saben';
  s.warned = true;
  sim.rep(DEFENDER, 10, 'avisar del asedio');
  sim.log('Al-Harbi sabe ya cuándo y por dónde vendrá la brigada: refuerza las barricadas del Túnel de Mertvaya, reparte la munición y dobla la guardia.', 'historia');
  return null;
}

/** Ofrecer las armas de tu escuadra a uno de los bandos. */
export function joinSide(sim: Sim, side: 'LEV' | 'CAL'): string | null {
  const s = siegeState(sim);
  if (!siegeActive(sim)) return 'Ya no hay guerra que hacer';
  if (sim.state.rep[side] < JOIN_REP) return 'No se fían de vosotros';
  s.ally = side;
  sim.rep(side, 4);
  sim.log(
    side === 'LEV'
      ? 'Habéis ofrecido vuestras armas a la brigada del Levantamiento. Si Mertvaya cae y estáis allí, el Consejo sabrá agradecerlo.'
      : 'Habéis ofrecido vuestras armas al Califato. Si Mertvaya resiste y estáis allí, Izumrudnaya sabrá agradecerlo.',
    'info',
  );
  return null;
}

// ---------------------------------------------------------------------------
// Textos para la interfaz
// ---------------------------------------------------------------------------

/** Ventana de suceso: título y párrafos según el momento. */
export function siegeNews(sim: Sim, code: number): { title: string; text: string[]; sides: SideId[] } {
  const s = siegeState(sim);
  const left = Math.max(0, Math.ceil((s.deadline - sim.state.time) / DAY));
  switch (code) {
    case 1:
      return {
        title: 'Primer suceso: el Asedio de Mertvaya',
        sides: ['LEV', 'CAL'],
        text: [
          `En Vysotnaya, frente al Túnel de Mertvaya, el Consejo Revolucionario reúne la ${BRIGADE_NAME}: fusileros, tropa de choque y zapadores. Tras cuatro años de embargo, el Levantamiento quiere acabar con el Califato de Izumrudnaya: Mertvaya, «la Muerta», como la llaman en el frente.`,
          `Si en los próximos ${left} días no pasa nada que lo impida, el día ${dayOf(s.deadline)} la brigada cruzará el túnel y asaltará la estación de Mohhammed Baghdadi.`,
          `Se puede impedir: Anatoli Belov, el estratega del asedio, está en Stalingradskaya; con Baghdadi preso o muerto, el imán Karimov pediría negociar; Morozov escucharía a quien se haya ganado la confianza del Levantamiento (reputación ${PERSUADE_LEV}); y una brigada deshecha en su campamento de Vysotnaya no va a ninguna parte. También podéis avisar al comandante al-Harbi, meter comida en la estación hambrienta u ofrecer vuestras armas a uno de los bandos.`,
        ],
      };
    case 2:
      return {
        title: 'La brigada cruza el Túnel de Mertvaya',
        sides: ['LEV'],
        text: [
          `Nada lo ha impedido. La ${BRIGADE_NAME} sale de Vysotnaya por el Túnel de Mertvaya: el Consejo Revolucionario ordena tomar la estación del Califato.`,
          'El túnel es corto: en unas horas estará ante las barricadas de Mertvaya. Quien quiera tomar parte en la batalla, o avisar al Califato, aún está a tiempo.',
        ],
      };
    case 3:
      return {
        title: 'A las puertas de Mertvaya',
        sides: ['LEV', 'CAL'],
        text: [
          s.warned
            ? 'La brigada llega a las barricadas de Mertvaya. Al-Harbi, avisado, la espera tras los sacos con toda la guardia.'
            : 'La brigada llega a las barricadas de Mertvaya. Los centinelas del Califato dan la alarma demasiado tarde.',
          supplyFactor(sim) > 0.95 ? 'La comida que ha entrado en la estación se nota: los defensores aguantan de pie.' : 'Cuatro años de hambre se notan: muchos defensores apenas pueden sostener el fusil.',
        ],
      };
    case 4: {
      const won = s.result === 'conquista';
      return {
        title: won ? 'Mertvaya ha caído' : 'Mertvaya resiste',
        sides: won ? ['LEV'] : ['CAL'],
        text: [
          won
            ? 'Tras la batalla, la bandera roja del Levantamiento ondea sobre el manantial esmeralda. Mertvaya pasa a ser una estación del Consejo Revolucionario y el embargo termina.'
            : 'Los defensores del Califato han aguantado. La brigada del Levantamiento se retira por el túnel dejando atrás a sus muertos. El cerco sigue, pero Izumrudnaya vive un día más.',
          ...(s.report ?? []),
        ],
      };
    }
    default:
      return {
        title: 'El asedio no llegará',
        sides: ['LEV', 'CAL'],
        text: [
          s.why === 'belov'
            ? 'Sin Anatoli Belov, el estratega del asedio, el Levantamiento aplaza el asalto a Mertvaya.'
            : s.why === 'karimov'
              ? 'Sin Baghdadi, el imán Karimov ha tomado el mando de Izumrudnaya y pide negociar el fin del embargo. El Consejo aplaza el asalto.'
              : s.why === 'consejo'
                ? 'El Consejo Revolucionario ha votado dar más tiempo al cerco: Mertvaya caerá sola, sin derramar sangre roja.'
                : s.why === 'brigada'
                  ? 'La brigada que se reunía en Vysotnaya ha quedado deshecha antes de salir.'
                  : 'La brigada del Levantamiento ha caído en el Túnel de Mertvaya.',
          'Mertvaya sigue en manos del Califato, sitiada y hambrienta, pero viva.',
        ],
      };
  }
}

/** Hilo del suceso para la pantalla de hilos (o null si aún no se sabe nada). */
export function siegeThread(sim: Sim): { state: 'pendiente' | 'en curso' | 'hecho'; text: string; hint: string; progress?: number } | null {
  const s = sim.state.asedio;
  if (!s || s.phase === 'espera') return null;
  const st = sim.state;
  const sq = brigade(sim);
  const lost = sq ? sq.roster.filter((m) => m.dead).length : 0;
  switch (s.phase) {
    case 'reunion': {
      const left = Math.max(0, (s.deadline - st.time) / DAY);
      return {
        state: 'en curso',
        text: `El Levantamiento reúne la ${BRIGADE_NAME} en Vysotnaya para tomar Mertvaya. Si nada lo impide, cruzará el túnel el día ${dayOf(s.deadline)} (${left < 1 ? 'en unas horas' : `faltan ${Math.ceil(left)} días`}).${s.warned ? ' Al-Harbi está avisado.' : ''}${s.ally ? ` Habéis ofrecido vuestras armas a ${s.ally === 'LEV' ? 'la brigada' : 'el Califato'}.` : ''}`,
        hint: `Para impedirlo: Belov (Stalingradskaya) muerto o lejos de allí; Baghdadi preso o muerto; convencer a Morozov (reputación ${PERSUADE_LEV} con el Levantamiento); o deshacer la brigada en Vysotnaya. Para que Mertvaya resista: avisar a al-Harbi, meterle comida o luchar a su lado.`,
        progress: 1 - left / SIEGE_WINDOW,
      };
    }
    case 'marcha':
      return { state: 'en curso', text: `La ${BRIGADE_NAME} cruza el Túnel de Mertvaya${lost ? ` (ha perdido a ${lost} por el camino)` : ''}.`, hint: 'Se la puede emboscar en el túnel, avisar a al-Harbi o esperarla en Mertvaya para tomar parte en la batalla.' };
    case 'asalto':
      return { state: 'en curso', text: s.battleFrom ? 'Se combate en Mertvaya.' : 'La brigada llega a las barricadas de Mertvaya.', hint: 'Quien esté allí puede decidir la batalla.' };
    default:
      return {
        state: 'hecho',
        text:
          s.result === 'conquista'
            ? `Mertvaya cayó ante el Levantamiento. ${(s.report ?? []).join(' ')}`
            : s.result === 'rechazo'
              ? `Mertvaya resistió el asalto de la ${BRIGADE_NAME}. ${(s.report ?? []).join(' ')}`
              : siegeNews(sim, 5).text[0],
        hint: '',
      };
  }
}

/** Línea del epílogo. */
export function siegeEpilogue(sim: Sim): string | null {
  const s = sim.state.asedio;
  if (!s || s.phase !== 'hecho') return null;
  if (s.result === 'conquista') return 'Mertvaya cayó ante el Levantamiento: el Califato de Izumrudnaya ya no existe y el embargo terminó.';
  if (s.result === 'rechazo') return `Mertvaya resistió el asalto de la ${BRIGADE_NAME}.`;
  return 'El asedio de Mertvaya no llegó a empezar.';
}
