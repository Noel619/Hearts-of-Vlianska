// IA militar: guarniciones en todo el frente, repliegues, contraataques y ofensivas con superioridad local.
//
// Cada día, para cada facción:
// 1. Calcula la amenaza sobre cada estación propia (o aliada en guerra): unidades enemigas que pueden
//    llegar a ella en pocos días y cercanía del territorio enemigo. La amenaza se "apantalla" en las
//    demás estaciones: para llegar a una estación de retaguardia hay que tomar antes las del frente.
// 2. Asigna guarniciones a todas las estaciones amenazadas, de la más valiosa a la menos, con las
//    unidades más cercanas. Ninguna estación fronteriza queda vacía mientras haya tropas.
// 3. Repliega a las unidades atrapadas en túneles frente a fuerzas muy superiores.
// 4. Con las tropas sobrantes, ataca solo cuando tiene superioridad local suficiente, reuniéndolas
//    antes y atacando desde varios túneles a la vez si puede. Aprovecha para contraatacar a los
//    enemigos agotados junto a sus estaciones y para ocupar lo que el enemigo deja desguarnecido.
import { FACTIONS, MAP, STATIONS } from '../../data';
import type { FactionId, GameState, Unit } from '../types';
import { aliveFactions, enemiesOf, friendly, isAtWarWith, neighbors, ownedStations, provincePassable } from '../helpers';
import { edgeHours, findPath, isDefending, leaveBattle, orderMove, unitStats, unitsOf } from '../military';

/** Horas máximas que se tienen en cuenta para amenazas y desplazamientos. */
const HORIZON = 24 * 8;
/** Superioridad que exige la IA para lanzar un ataque. */
const ATTACK_RATIO = 1.35;

// ---------------------------------------------------------------------------
// Valor de combate
// ---------------------------------------------------------------------------

/** Valor de combate de una unidad descansada (la organización se recupera; la fuerza, no tan rápido). */
export function potential(state: GameState, u: Unit): number {
  const s = unitStats(state, u);
  return (s.soft + s.hard * 0.5 + (s.def + s.brk) * 0.5) * (0.3 + 0.7 * u.strength);
}

/** Valor de combate ahora mismo, contando la organización. */
export function readiness(state: GameState, u: Unit): number {
  const s = unitStats(state, u);
  const orgK = s.org > 0 ? u.org / s.org : 0;
  return potential(state, u) * (0.25 + 0.75 * orgK);
}

function orgRatio(state: GameState, u: Unit): number {
  const s = unitStats(state, u);
  return s.org > 0 ? u.org / s.org : 0;
}

/** Cuánto multiplica el terreno (estación, barricadas, atrincheramiento) la dificultad de tomar una provincia. */
function defenseMultiplier(state: GameState, pid: string, dug: number): number {
  const station = MAP.provinces[pid].kind === 'estacion' ? 0.25 : 0;
  return (1 + station + 0.07 * state.provinces[pid].fort) * (1 + 0.25 * dug);
}

// ---------------------------------------------------------------------------
// Geografía
// ---------------------------------------------------------------------------

/**
 * Tiempos de viaje (horas, a velocidad de infantería) desde una provincia.
 * `stopAt` impide seguir expandiendo a través de ciertas provincias (pero sí llegar a ellas).
 */
function travelFrom(
  state: GameState,
  f: FactionId,
  from: string,
  opts: { pass?: (pid: string) => boolean; stopAt?: (pid: string) => boolean; cap?: number } = {},
): Map<string, number> {
  const cap = opts.cap ?? HORIZON;
  const dist = new Map<string, number>([[from, 0]]);
  const done = new Set<string>();
  for (;;) {
    let cur = '';
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!done.has(id) && d < best) {
        best = d;
        cur = id;
      }
    }
    if (!cur || best > cap) break;
    done.add(cur);
    if (cur !== from && opts.stopAt?.(cur)) continue;
    for (const n of neighbors(state, cur)) {
      if (!provincePassable(state, n.to)) continue;
      if (opts.pass && !opts.pass(n.to)) continue;
      const nd = best + edgeHours(state, f, 4, n.length, n.terrain);
      if (nd < (dist.get(n.to) ?? Infinity)) dist.set(n.to, nd);
    }
  }
  return dist;
}

function isStation(pid: string) {
  return MAP.provinces[pid]?.kind === 'estacion';
}

/** Peso de una amenaza según lo lejos que esté: plena a un día, nula a ocho. */
function proximity(hours: number): number {
  if (hours <= 24) return 1;
  return Math.max(0, 1 - (hours - 24) / (HORIZON - 24));
}

// ---------------------------------------------------------------------------
// Órdenes
// ---------------------------------------------------------------------------

function sendTo(state: GameState, u: Unit, target: string): boolean {
  if (u.battle && isDefending(state, u)) return false;
  if (u.province === target) {
    if (u.path.length && !u.battle) {
      u.path = [];
      u.moveProgress = 0;
    }
    u.aiTarget = target;
    return true;
  }
  if (u.aiTarget === target && u.path.length > 0 && u.path[u.path.length - 1] === target && !u.battle) return true;
  const s = unitStats(state, u);
  const path = findPath(state, u.owner, u.province, target, { noAux: s.noAux, speed: s.speed, avoidEnemies: true });
  if (!path || path.length === 0) return false;
  if (u.battle) leaveBattle(state, u);
  if (u.path[0] !== path[0]) u.moveProgress = 0;
  u.path = path;
  u.retreating = false;
  u.aiTarget = target;
  return true;
}

function attack(u: Unit, target: string) {
  if (u.path[0] !== target) u.moveProgress = 0;
  u.path = [target];
  u.retreating = false;
  u.aiTarget = target;
}

// ---------------------------------------------------------------------------
// Planificación
// ---------------------------------------------------------------------------

interface Post {
  sid: string;
  value: number;
  threat: number;
  need: number;
  have: number;
  /** Tiempos de viaje desde la estación (sin apantallar), para buscar refuerzos. */
  reach: Map<string, number>;
}

/** Facciones que podrían atacarnos pronto (en paz) o que ya lo hacen (en guerra). */
function hostileFactions(state: GameState, f: FactionId, atWar: boolean): Map<FactionId, number> {
  const out = new Map<FactionId, number>();
  if (atWar) {
    for (const e of enemiesOf(state, f)) if (state.countries[e].alive) out.set(e, 1);
    return out;
  }
  for (const other of aliveFactions(state)) {
    if (other === f || friendly(state, f, other)) continue;
    const oc = state.countries[other];
    let w = 0;
    // Quien justifica una guerra contra nosotros es tan peligroso como un enemigo declarado.
    if (oc.wargoals.some((g) => g.target === f)) w = Math.max(w, oc.wargoals.some((g) => g.target === f && g.ready) ? 1 : 0.8);
    if ((state.countries[f].relations[other] ?? 0) < -30) w = Math.max(w, 0.3);
    if (FACTIONS[other].aiTargets.some((t) => t.target === f)) w = Math.max(w, 0.35);
    if (FACTIONS[f].aiTargets.some((t) => t.target === other)) w = Math.max(w, 0.25);
    if (w > 0) out.set(other, w);
  }
  return out;
}

/**
 * Agresividad (0..1) de la facción en su guerra: más si la ha declarado ella, si es más fuerte
 * que sus enemigos o si son sus objetivos históricos. Una facción agresiva deja guarniciones más
 * justas y ataca con menos margen.
 */
export function aggression(state: GameState, f: FactionId, hostile: Map<FactionId, number>): number {
  let ours = 0;
  let theirs = 0;
  for (const u of Object.values(state.units)) {
    if (hostile.has(u.owner)) theirs += potential(state, u);
    else if (u.owner === f || (friendly(state, u.owner, f) && [...hostile.keys()].some((e) => isAtWarWith(state, u.owner, e)))) ours += potential(state, u);
  }
  const r = ours / Math.max(1, theirs);
  let a = 0;
  if (state.wars.some((w) => w.attackers.includes(f) && w.defenders.some((d) => hostile.has(d)))) a += 0.25;
  if (r > 1.15) a += 0.25;
  if (r > 1.5) a += 0.25;
  if (r > 2) a += 0.25;
  if (r < 0.8) a -= 0.25;
  if (FACTIONS[f].aiTargets.some((t) => hostile.has(t.target) && t.weight >= 3)) a += 0.1;
  return Math.max(0, Math.min(1, a));
}

function buildPosts(state: GameState, f: FactionId, hostile: Map<FactionId, number>, atWar: boolean, aggr: number): Post[] {
  const c = state.countries[f];
  const friendlyCtrl = (pid: string) => {
    const ctrl = state.provinces[pid].controller;
    return !!ctrl && friendly(state, ctrl, f);
  };
  const candidates = new Map<string, number>();
  for (const sid of Object.keys(state.stations)) {
    const ctrl = state.provinces[sid].controller;
    if (ctrl === f) {
      const owner = state.stations[sid].owner;
      let v = STATIONS[sid].victoryPoints * (sid === c.capital ? 2 : 1);
      if (owner !== f) v *= 0.8;
      candidates.set(sid, v);
    } else if (atWar && ctrl && friendly(state, ctrl, f)) {
      // Estaciones de aliados en guerra: ayudamos a defenderlas, con menos prioridad.
      candidates.set(sid, STATIONS[sid].victoryPoints * 0.45);
    }
  }
  // En paz, custodiamos las estaciones de quienes nos han dado acceso y garantizamos (la Unión en Staraya).
  if (!atWar) {
    for (const g of state.guarantees) {
      if (g.guarantor !== f || !state.access.some((a) => a.from === g.target && a.to === f)) continue;
      const cap = state.countries[g.target].capital;
      if (state.countries[g.target].alive && !candidates.has(cap)) candidates.set(cap, STATIONS[cap].victoryPoints * 0.5);
    }
  }
  const hostileUnits = Object.values(state.units).filter((u) => hostile.has(u.owner));
  const avgHostile = hostileUnits.length ? hostileUnits.reduce((s, u) => s + potential(state, u), 0) / hostileUnits.length : 30;
  // Amenaza apantallada: el enemigo no atraviesa nuestras otras estaciones sin tomarlas antes.
  const screenedBy = new Map<string, Map<string, number>>();
  for (const sid of candidates.keys()) screenedBy.set(sid, travelFrom(state, f, sid, { stopAt: (pid) => isStation(pid) && friendlyCtrl(pid) }));
  // Cada unidad enemiga amenaza sobre todo a la estación más cercana, pero ninguna alcanzable queda a cero.
  const unitThreat = new Map<string, number>();
  for (const u of hostileUnits) {
    const w = new Map<string, number>();
    let total = 0;
    for (const [sid, m] of screenedBy) {
      const h = m.get(u.province);
      if (h === undefined) continue;
      const p = proximity(h);
      if (p <= 0) continue;
      w.set(sid, p);
      total += p * p;
    }
    // Una guarnición quieta en su propia estación amenaza menos que tropas en los túneles.
    const intent = hostile.get(u.owner) ?? 0;
    const posture = intent < 0.8 && isStation(u.province) && state.provinces[u.province].controller === u.owner && u.path.length === 0 ? 0.55 : 1;
    const pot = potential(state, u) * (hostile.get(u.owner) ?? 0) * posture;
    for (const [sid, p] of w) {
      const share = (p * p) / total;
      unitThreat.set(sid, (unitThreat.get(sid) ?? 0) + pot * Math.max(share, 0.35 * p));
    }
  }
  const posts: Post[] = [];
  for (const [sid, value] of candidates) {
    const screened = screenedBy.get(sid)!;
    let threat = unitThreat.get(sid) ?? 0;
    // Frontera: cercanía de territorio enemigo, aunque ahora no haya tropas.
    let border = Infinity;
    let borderW = 0;
    for (const [pid, h] of screened) {
      const ctrl = state.provinces[pid].controller;
      if (ctrl && hostile.has(ctrl) && h < border) {
        border = h;
        borderW = hostile.get(ctrl) ?? 0;
      }
    }
    if (border < Infinity) threat += avgHostile * 0.6 * proximity(border) * borderW;
    const mult = defenseMultiplier(state, sid, 0.6);
    let need = (threat * (atWar ? 0.95 - 0.4 * aggr : 0.8)) / mult;
    // Toda estación fronteriza merece al menos una unidad.
    if (threat > 0) need = Math.max(need, avgHostile * 0.5);
    const reach = travelFrom(state, f, sid, { pass: (pid) => !state.provinces[pid].controller || friendlyCtrl(pid) || pid === sid });
    posts.push({ sid, value, threat, need, have: 0, reach });
  }
  return posts;
}

export function aiMilitary(state: GameState, f: FactionId) {
  const all = unitsOf(state, f);
  if (all.length === 0) return;
  const c = state.countries[f];
  const atWar = enemiesOf(state, f).some((e) => state.countries[e].alive);
  const hostile = hostileFactions(state, f, atWar);
  const aggr = atWar ? aggression(state, f, hostile) : 0;
  const posts = buildPosts(state, f, hostile, atWar, aggr);
  const postById = new Map(posts.map((p) => [p.sid, p]));

  // 0. Repliegues: unidades que defienden un túnel frente a fuerzas muy superiores vuelven a una estación.
  if (atWar) withdrawOutmatched(state, f, all, posts);

  // 1. Guarniciones: cada unidad en una estación que la necesita se queda; el resto queda libre.
  const busy = new Set<string>();
  for (const u of all) {
    if (u.battle) busy.add(u.id); // atacando o defendiendo: sigue con lo suyo
  }
  // Tropas aliadas y propias que ya están en cada puesto.
  for (const u of Object.values(state.units)) {
    if (u.owner === f || !friendly(state, u.owner, f)) continue;
    const p = postById.get(u.province);
    if (p) p.have += potential(state, u);
  }
  const pool: Unit[] = [];
  const byPost = new Map<string, Unit[]>();
  for (const u of all) {
    if (busy.has(u.id)) {
      const p = postById.get(u.province);
      if (p && isDefending(state, u)) p.have += potential(state, u);
      continue;
    }
    const heading = u.path.length > 0 && u.aiTarget && postById.has(u.aiTarget) ? u.aiTarget : null;
    const at = u.path.length === 0 && postById.has(u.province) ? u.province : heading;
    if (!at) {
      pool.push(u);
      continue;
    }
    if (!byPost.has(at)) byPost.set(at, []);
    byPost.get(at)!.push(u);
  }
  for (const [sid, list] of byPost) {
    const p = postById.get(sid)!;
    // Primero las que ya están allí, después las que vienen de camino; las más fuertes antes.
    list.sort((a, b) => (a.path.length ? 1 : 0) - (b.path.length ? 1 : 0) || potential(state, b) - potential(state, a));
    for (const u of list) {
      if (p.have < p.need) {
        p.have += potential(state, u);
        if (u.path.length === 0) u.aiTarget = sid;
      } else pool.push(u);
    }
  }

  // 2. Cubrir los puestos con déficit, de mayor a menor prioridad, con las unidades libres más cercanas.
  const deficit = () => posts.filter((p) => p.have < p.need - 1e-6).sort((a, b) => b.value * (b.need - b.have) - a.value * (a.need - a.have));
  for (const p of deficit()) {
    while (p.have < p.need && pool.length) {
      let best = -1;
      let bestH = Infinity;
      pool.forEach((u, i) => {
        const h = p.reach.get(u.province);
        if (h !== undefined && h < bestH) {
          bestH = h;
          best = i;
        }
      });
      if (best < 0) break;
      const u = pool[best];
      pool.splice(best, 1);
      if (sendTo(state, u, p.sid)) p.have += potential(state, u);
    }
  }
  // Si aún faltan tropas en puestos valiosos, se quitan de los puestos menos valiosos con excedente... o se recluta.
  const shortage = posts.reduce((s, p) => s + Math.max(0, p.need - p.have), 0);
  c.ai.shortage = shortage;

  // 3. Ofensiva y contraataques (solo en guerra).
  if (atWar) {
    sortie(state, f, posts, all, busy);
    offensive(state, f, pool, hostile, ATTACK_RATIO - 0.3 * aggr);
  } else {
    peacetimeReserve(state, f, pool, posts);
  }
  // 4. Lo que sobra: a la estación más necesitada o a la más cercana, nunca esperando en un túnel.
  for (const u of pool) {
    if (u.path.length > 0 || u.battle) continue;
    if (isStation(u.province) && state.provinces[u.province].controller === f) continue;
    const target = posts
      .filter((p) => p.reach.has(u.province))
      .sort((a, b) => (b.threat + 1) / (b.have + 1) - (a.threat + 1) / (a.have + 1) || (a.reach.get(u.province) ?? 0) - (b.reach.get(u.province) ?? 0))[0];
    if (target) sendTo(state, u, target.sid);
  }
}

// ---------------------------------------------------------------------------
// Repliegues y contraataques
// ---------------------------------------------------------------------------

function withdrawOutmatched(state: GameState, f: FactionId, units: Unit[], posts: Post[]) {
  for (const u of units) {
    if (!isDefending(state, u) || isStation(u.province)) continue;
    const b = state.battles[u.battle!];
    if (!b) continue;
    const mine = b.defenders.map((id) => state.units[id]).filter(Boolean).reduce((s, x) => s + readiness(state, x), 0);
    const theirs = b.attackers.map((id) => state.units[id]).filter(Boolean).reduce((s, x) => s + readiness(state, x), 0);
    if (theirs < mine * 1.8) continue;
    // A la estación propia más cercana que no esté en la línea de ataque.
    const attackerFrom = new Set(b.attackers.map((id) => state.units[id]?.province).filter(Boolean) as string[]);
    const target = posts
      .filter((p) => p.reach.has(u.province) && !attackerFrom.has(p.sid) && state.provinces[p.sid].controller === f)
      .sort((a, b2) => (a.reach.get(u.province) ?? 0) - (b2.reach.get(u.province) ?? 0))[0];
    if (target) orderMove(state, [u.id], target.sid);
  }
}

/** Las guarniciones golpean a enemigos agotados que se han quedado junto a sus estaciones. */
function sortie(state: GameState, f: FactionId, posts: Post[], units: Unit[], busy: Set<string>) {
  for (const p of posts) {
    if (state.provinces[p.sid].controller !== f) continue;
    const garrison = units.filter((u) => u.province === p.sid && u.path.length === 0 && !busy.has(u.id) && orgRatio(state, u) > 0.7);
    if (garrison.length === 0) continue;
    for (const n of neighbors(state, p.sid)) {
      const enemies = Object.values(state.units).filter((e) => e.province === n.to && !e.retreating && isAtWarWith(state, e.owner, f));
      if (enemies.length === 0 || enemies.some((e) => e.battle && state.battles[e.battle]?.province === p.sid)) continue;
      const theirs = enemies.reduce((s, e) => s + readiness(state, e), 0) * defenseMultiplier(state, n.to, 0);
      const ours = garrison.reduce((s, u) => s + readiness(state, u), 0);
      // Deja al menos una unidad en la estación si la amenaza lo exige.
      const keep = p.threat > 0 && garrison.length > 1 ? 1 : 0;
      const strike = garrison.slice(keep);
      const strikeCv = strike.reduce((s, u) => s + readiness(state, u), 0);
      if (strike.length && strikeCv >= theirs * 1.6 && ours >= theirs * 1.6) {
        for (const u of strike) {
          attack(u, n.to);
          busy.add(u.id);
        }
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Ofensiva
// ---------------------------------------------------------------------------

interface Target {
  pid: string;
  gain: number;
  required: number;
  approaches: string[];
}

function offensive(state: GameState, f: FactionId, pool: Unit[], hostile: Map<FactionId, number>, ratio: number) {
  const c = state.countries[f];
  let fighters = pool.filter((u) => !u.battle && u.strength >= 0.45);
  if (fighters.length === 0) return;
  const enemyAt = (pid: string) => Object.values(state.units).filter((u) => u.province === pid && !u.retreating && hostile.has(u.owner));
  const ours = (pid: string) => {
    const ctrl = state.provinces[pid].controller;
    return !ctrl || friendly(state, ctrl, f);
  };
  const targets: Target[] = [];
  const seen = new Set<string>();
  const consider = (pid: string, gain: number) => {
    if (seen.has(pid)) return;
    seen.add(pid);
    const defenders = enemyAt(pid);
    const dug = defenders.length ? defenders.reduce((s, u) => s + (u.dug ?? 0), 0) / defenders.length : 0;
    const def = defenders.reduce((s, u) => s + readiness(state, u), 0) * defenseMultiplier(state, pid, dug);
    // Accesos: provincias vecinas sin tropas enemigas desde las que atacar (si son enemigas, se ocupan de paso).
    const approaches = neighbors(state, pid)
      .map((n) => n.to)
      .filter((n) => provincePassable(state, n) && enemyAt(n).length === 0);
    if (approaches.length === 0 && defenders.length > 0) return;
    // Con varios accesos se puede flanquear: hace falta menos superioridad.
    const flank = approaches.length >= 3 ? 1.3 : approaches.length === 2 ? 1.2 : 1;
    targets.push({ pid, gain, required: (def * ratio) / flank, approaches });
  };
  for (const sid of Object.keys(state.stations)) {
    const ctrl = state.provinces[sid].controller;
    if (!ctrl || !hostile.has(ctrl)) continue;
    const st = state.stations[sid];
    let gain = STATIONS[sid].victoryPoints * 10;
    if (st.cores.includes(f)) gain *= 2;
    else if (st.claims.includes(f)) gain *= 1.5;
    if (state.countries[ctrl].capital === sid) gain *= 1.3;
    consider(sid, gain);
  }
  // Tropas enemigas en túneles junto a nuestro territorio: blancos tácticos.
  for (const u of Object.values(state.units)) {
    if (!hostile.has(u.owner) || isStation(u.province) || u.retreating) continue;
    if (!neighbors(state, u.province).some((n) => ours(n.to))) continue;
    consider(u.province, 12 + potential(state, u) * 0.3);
  }
  // Mapas de tiempos de viaje hasta cada acceso (se reutilizan entre objetivos).
  const travelCache = new Map<string, Map<string, number>>();
  const mapFor = (d: string) => {
    let m = travelCache.get(d);
    if (!m) {
      m = travelFrom(state, f, d, { pass: (pid) => ours(pid) || pid === d });
      travelCache.set(d, m);
    }
    return m;
  };
  // Una ofensiva principal (con continuidad) y todas las ocupaciones sin resistencia posibles.
  const sticky = c.ai.plan && c.ai.plan.until > state.hour ? c.ai.plan.target : null;
  let launched = 0;
  for (let round = 0; round < 3 && fighters.length; round++) {
    let best: { t: Target; score: number; eta: Map<string, { dir: string; h: number }> } | null = null;
    for (const t of targets) {
      // Tiempo de cada unidad libre hasta el acceso más cercano (o hasta el blanco si está vacío).
      const eta = new Map<string, { dir: string; h: number }>();
      const dirs = t.approaches.length ? t.approaches : [t.pid];
      const maps = dirs.map((d) => ({ d, m: mapFor(d) }));
      for (const u of fighters) {
        let bestDir = '';
        let bh = Infinity;
        for (const { d, m } of maps) {
          const h = m.get(u.province);
          if (h !== undefined && h < bh) {
            bh = h;
            bestDir = d;
          }
        }
        if (bestDir) eta.set(u.id, { dir: bestDir, h: bh });
      }
      const reachable = fighters.filter((u) => eta.has(u.id));
      const cv = reachable.reduce((s, u) => s + potential(state, u), 0);
      if (reachable.length === 0 || cv < t.required) continue;
      const avgH = reachable.reduce((s, u) => s + eta.get(u.id)!.h, 0) / reachable.length;
      let score = t.gain / (1 + avgH / 48) / (1 + t.required / Math.max(1, cv));
      if (t.pid === sticky) score *= 1.6;
      if (!best || score > best.score) best = { t, score, eta };
    }
    if (!best) break;
    const t = best.t;
    targets.splice(targets.indexOf(t), 1);
    if (t.required <= 0) {
      // Nadie lo defiende: basta con una unidad (la más cercana).
      const u = fighters.filter((x) => best!.eta.has(x.id)).sort((a, b) => best!.eta.get(a.id)!.h - best!.eta.get(b.id)!.h)[0];
      if (u && sendTo(state, u, t.pid)) {
        fighters = fighters.filter((x) => x !== u);
        pool.splice(pool.indexOf(u), 1);
      }
      continue;
    }
    // Asignación: las unidades más cercanas hasta superar lo necesario con margen, repartidas por accesos.
    const cands = fighters.filter((x) => best!.eta.has(x.id)).sort((a, b) => best!.eta.get(a.id)!.h - best!.eta.get(b.id)!.h);
    const group: Unit[] = [];
    let cv = 0;
    for (const u of cands) {
      if (cv >= t.required * 1.25) break;
      group.push(u);
      cv += potential(state, u);
    }
    // Reparte en varios accesos cuando es posible (flanqueo).
    const dirOf = new Map<string, string>();
    if (t.approaches.length > 1) {
      const load = new Map(t.approaches.map((d) => [d, 0]));
      for (const u of group) {
        const own = best.eta.get(u.id)!;
        // Prefiere el acceso menos cargado si no está mucho más lejos.
        let dir = own.dir;
        for (const d of t.approaches) {
          const h = mapFor(d).get(u.province);
          if (h !== undefined && (load.get(d) ?? 0) < (load.get(dir) ?? 0) && h <= own.h * 1.6 + 24) dir = d;
        }
        load.set(dir, (load.get(dir) ?? 0) + 1);
        dirOf.set(u.id, dir);
      }
    } else for (const u of group) dirOf.set(u.id, best.eta.get(u.id)!.dir);
    // ¿Listos? Todas en su acceso y con la organización recuperada.
    const ready = group.filter((u) => u.province === dirOf.get(u.id) && !u.battle && orgRatio(state, u) >= 0.65);
    const readyCv = ready.reduce((s, u) => s + readiness(state, u), 0);
    if (readyCv >= t.required) {
      for (const u of ready) attack(u, t.pid);
    }
    for (const u of group) {
      if (ready.includes(u) && readyCv >= t.required) continue;
      sendTo(state, u, dirOf.get(u.id)!);
    }
    fighters = fighters.filter((x) => !group.includes(x));
    for (const u of group) {
      const i = pool.indexOf(u);
      if (i >= 0) pool.splice(i, 1);
    }
    c.ai.plan = { target: t.pid, until: state.hour + 24 * 20 };
    launched++;
    if (launched >= 2) break;
  }
}

// ---------------------------------------------------------------------------
// Paz
// ---------------------------------------------------------------------------

function peacetimeReserve(state: GameState, f: FactionId, pool: Unit[], posts: Post[]) {
  const c = state.countries[f];
  // Guerra planificada: las tropas sobrantes se concentran junto al objetivo
  // (salvo que alguien prepare a su vez una guerra contra nosotros).
  const planned = c.wargoals.find((w) => w.ready) ?? c.wargoals[0];
  const menaced = aliveFactions(state).some((o) => o !== f && state.countries[o].wargoals.some((g) => g.target === f));
  if (planned && !menaced) {
    const staging = stagingStation(state, f, planned.target, posts);
    if (staging) {
      for (const u of pool.splice(0)) sendTo(state, u, staging);
      return;
    }
  }
  // Reparto por valor y amenaza.
  for (const u of pool.splice(0)) {
    if (u.path.length > 0) continue;
    const scored = posts
      .filter((p) => p.reach.has(u.province))
      .map((p) => ({ p, s: (p.value * (1 + p.threat / 40)) / (1 + p.have / 30) }))
      .sort((a, b) => b.s - a.s);
    const target = scored[0]?.p;
    if (!target) continue;
    if (target.sid !== u.province && sendTo(state, u, target.sid)) target.have += potential(state, u);
    else if (target.sid === u.province) target.have += potential(state, u);
  }
}

function stagingStation(state: GameState, f: FactionId, target: FactionId, posts: Post[]): string | null {
  const tStations = new Set(ownedStations(state, target));
  let best: string | null = null;
  let bestH = Infinity;
  for (const p of posts) {
    if (state.provinces[p.sid].controller !== f) continue;
    const m = travelFrom(state, f, p.sid, { cap: 24 * 10 });
    for (const t of tStations) {
      const h = m.get(t);
      if (h !== undefined && h < bestH) {
        bestH = h;
        best = p.sid;
      }
    }
  }
  return best;
}
