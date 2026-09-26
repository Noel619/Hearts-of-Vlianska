// IA militar: despliegue en paz, defensa del frente y ofensivas.
import { FACTIONS, MAP, STATIONS } from '../../data';
import type { FactionId, GameState, Unit } from '../types';
import { enemiesOf, friendly, isAtWarWith, neighbors, ownedStations } from '../helpers';
import { findPath, orderMove, unitStats, unitsOf } from '../military';

interface Power {
  atk: number;
  def: number;
}

function unitPower(state: GameState, u: Unit): Power {
  const s = unitStats(state, u);
  const orgK = s.org > 0 ? u.org / s.org : 0;
  const k = u.strength * (0.3 + 0.7 * orgK);
  return { atk: (s.soft + s.hard + s.brk) * k, def: (s.def + s.soft * 0.5) * k };
}

function enemyPowerAt(state: GameState, f: FactionId, pid: string): Power {
  const p = { atk: 0, def: 0 };
  for (const u of Object.values(state.units)) {
    if (u.province !== pid || !isAtWarWith(state, u.owner, f)) continue;
    const up = unitPower(state, u);
    p.atk += up.atk;
    p.def += up.def;
  }
  return p;
}

function hopsBetween(state: GameState, from: string, to: string, max = 8): number {
  if (from === to) return 0;
  const seen = new Set([from]);
  let frontier = [from];
  for (let d = 1; d <= max; d++) {
    const next: string[] = [];
    for (const p of frontier) {
      for (const n of neighbors(state, p)) {
        if (seen.has(n.to)) continue;
        if (n.to === to) return d;
        seen.add(n.to);
        next.push(n.to);
      }
    }
    frontier = next;
  }
  return Infinity;
}

function sendTo(state: GameState, u: Unit, target: string) {
  if (u.province === target && u.path.length === 0) {
    u.aiTarget = target;
    return;
  }
  if (u.aiTarget === target && u.path.length > 0) return;
  const s = unitStats(state, u);
  const path = findPath(state, u.owner, u.province, target, { noAux: s.noAux, speed: s.speed, avoidEnemies: true });
  if (!path) return;
  if (orderMove(state, [u.id], target) > 0) u.aiTarget = target;
}

// ---------------------------------------------------------------------------
// Tiempos de paz
// ---------------------------------------------------------------------------

function threatSources(state: GameState, f: FactionId): Set<FactionId> {
  const out = new Set<FactionId>();
  for (const other of Object.keys(state.countries) as FactionId[]) {
    if (other === f || !state.countries[other].alive) continue;
    const oc = state.countries[other];
    if (oc.wargoals.some((w) => w.target === f)) out.add(other);
    if ((state.countries[f].relations[other] ?? 0) < -30) out.add(other);
    if (FACTIONS[f].aiTargets.some((t) => t.target === other)) out.add(other);
  }
  return out;
}

function peacetimeDeploy(state: GameState, f: FactionId, units: Unit[]) {
  const c = state.countries[f];
  // Preparación de una guerra planificada: concentrar tropas.
  const planned = c.wargoals.find((w) => w.ready) ?? c.wargoals[0];
  if (planned) {
    const staging = stagingStation(state, f, planned.target);
    if (staging) {
      const keepHome = units.length >= 3 ? 1 : 0;
      units.forEach((u, i) => {
        if (i < keepHome) sendTo(state, u, c.capital);
        else sendTo(state, u, staging);
      });
      return;
    }
  }
  const threats = threatSources(state, f);
  const stations = ownedStations(state, f).filter((s) => state.provinces[s].controller === f);
  // Estaciones aliadas que custodiamos (p. ej. la Unión en Staraya).
  const guarded = state.guarantees
    .filter((g) => g.guarantor === f && state.access.some((a) => a.from === g.target && a.to === f))
    .map((g) => state.countries[g.target].capital)
    .filter((s) => state.countries[state.stations[s]?.owner ?? f]?.alive);
  const weights: { s: string; w: number }[] = stations.map((s) => {
    let w = s === c.capital ? 2 : 1;
    for (const other of MAP.provinceList) {
      if (other.kind !== 'estacion') continue;
      const ctrl = state.provinces[other.id].controller;
      if (!ctrl || ctrl === f || !threats.has(ctrl)) continue;
      const h = hopsBetween(state, s, other.id, 6);
      if (h < Infinity) w += 3 / h;
    }
    return { s, w };
  });
  for (const g of guarded) weights.push({ s: g, w: 1.2 });
  const totalW = weights.reduce((a, b) => a + b.w, 0);
  const alloc: Record<string, number> = {};
  let left = units.length;
  for (const { s, w } of weights) {
    alloc[s] = Math.floor((units.length * w) / totalW);
    left -= alloc[s];
  }
  weights.sort((a, b) => b.w - a.w);
  for (let i = 0; left > 0; i++, left--) alloc[weights[i % weights.length].s]++;
  // Primero, las unidades ya colocadas se quedan donde están.
  const free: Unit[] = [];
  const placed: Record<string, number> = {};
  for (const u of units) {
    const at = u.province;
    if (alloc[at] && (placed[at] ?? 0) < alloc[at] && u.path.length === 0) placed[at] = (placed[at] ?? 0) + 1;
    else free.push(u);
  }
  for (const u of free) {
    const need = weights.map((w) => w.s).find((s) => (placed[s] ?? 0) < alloc[s]);
    if (!need) break;
    placed[need] = (placed[need] ?? 0) + 1;
    sendTo(state, u, need);
  }
}

function stagingStation(state: GameState, f: FactionId, target: FactionId): string | null {
  const tStations = ownedStations(state, target);
  let best: string | null = null;
  let bestD = Infinity;
  for (const s of ownedStations(state, f)) {
    if (state.provinces[s].controller !== f) continue;
    for (const t of tStations) {
      const h = hopsBetween(state, s, t, 8);
      if (h < bestD) {
        bestD = h;
        best = s;
      }
    }
  }
  return bestD === Infinity ? null : best;
}

// ---------------------------------------------------------------------------
// Guerra
// ---------------------------------------------------------------------------

function chooseObjective(state: GameState, f: FactionId, enemies: FactionId[]): { station: string; path: string[] } | null {
  const c = state.countries[f];
  const candidates = Object.keys(state.stations).filter((s) => {
    const ctrl = state.provinces[s].controller;
    return ctrl && enemies.includes(ctrl);
  });
  let best: { station: string; path: string[] } | null = null;
  let bestScore = -Infinity;
  for (const s of candidates) {
    const path = findPath(state, f, c.capital, s, { speed: 4 });
    if (!path) continue;
    const ownedByUs = state.stations[s].owner === f || (state.stations[s].owner && friendly(state, state.stations[s].owner!, f));
    const vp = STATIONS[s].victoryPoints;
    const score = (vp * (ownedByUs ? 2.5 : 1) * 10) / (path.length + 2) - enemyPowerAt(state, f, s).def * 0.02;
    if (score > bestScore) {
      bestScore = score;
      best = { station: s, path };
    }
  }
  return best;
}

function frontProvinces(state: GameState, f: FactionId, enemies: Set<FactionId>): string[] {
  const out: string[] = [];
  for (const pid of Object.keys(state.provinces)) {
    const ctrl = state.provinces[pid].controller;
    if (ctrl !== f && !(ctrl && friendly(state, ctrl, f))) continue;
    if (neighbors(state, pid).some((n) => {
      const c2 = state.provinces[n.to].controller;
      return (c2 && enemies.has(c2)) || Object.values(state.units).some((u) => u.province === n.to && enemies.has(u.owner));
    })) out.push(pid);
  }
  return out;
}

function warDeploy(state: GameState, f: FactionId, units: Unit[], enemyList: FactionId[]) {
  const c = state.countries[f];
  const enemies = new Set(enemyList);
  const available: Unit[] = [];
  // 1. Recuperación
  for (const u of units) {
    const s = unitStats(state, u);
    if (u.battle) continue;
    if ((u.strength < 0.35 || u.org < s.org * 0.25) && MAP.provinces[u.province].kind !== 'estacion') {
      const home = nearestOwnStation(state, f, u.province);
      if (home) sendTo(state, u, home);
      continue;
    }
    if (u.org < s.org * 0.4) continue; // descansando
    available.push(u);
  }
  // 2. Defensa: estaciones amenazadas
  const front = frontProvinces(state, f, enemies);
  const threatened = front
    .map((pid) => {
      let threat = 0;
      for (const n of neighbors(state, pid)) threat += enemyPowerAt(state, f, n.to).atk;
      const isStation = MAP.provinces[pid].kind === 'estacion';
      const value = isStation ? STATIONS[pid].victoryPoints * (pid === c.capital ? 2 : 1) : 0.5;
      return { pid, threat, value };
    })
    .filter((t) => t.threat > 0)
    .sort((a, b) => b.value * b.threat - a.value * a.threat);
  for (const t of threatened) {
    if (MAP.provinces[t.pid].kind !== 'estacion' && t.value < 1) continue;
    let have = 0;
    for (const u of Object.values(state.units)) if (u.owner === f && u.province === t.pid) have += unitPower(state, u).def;
    let needed = t.threat * 0.9 - have;
    while (needed > 0 && available.length) {
      // la unidad disponible más cercana
      available.sort((a, b) => hopsBetween(state, a.province, t.pid) - hopsBetween(state, b.province, t.pid));
      const u = available.shift()!;
      if (hopsBetween(state, u.province, t.pid) > 6) {
        available.push(u);
        break;
      }
      sendTo(state, u, t.pid);
      needed -= unitPower(state, u).def;
    }
  }
  if (available.length === 0) return;
  // 3. Ofensiva
  const obj = chooseObjective(state, f, enemyList);
  if (!obj) {
    for (const u of available) sendTo(state, u, c.capital);
    return;
  }
  // Primera provincia enemiga del camino y provincia de reunión previa.
  let staging = c.capital;
  let target: string | null = null;
  for (const pid of obj.path) {
    const ctrl = state.provinces[pid].controller;
    const hostile = (ctrl && enemies.has(ctrl)) || Object.values(state.units).some((u) => u.province === pid && enemies.has(u.owner));
    if (hostile) {
      target = pid;
      break;
    }
    staging = pid;
  }
  if (!target) {
    for (const u of available) sendTo(state, u, obj.station);
    return;
  }
  const atStaging = available.filter((u) => u.province === staging && u.path.length === 0);
  const ourAtk = atStaging.reduce((s, u) => s + unitPower(state, u).atk, 0);
  const their = enemyPowerAt(state, f, target);
  const fort = state.provinces[target].fort;
  const theirDef = their.def * (1 + fort * 0.1) * (MAP.provinces[target].kind === 'estacion' ? 1.2 : 1);
  if (atStaging.length > 0 && (theirDef === 0 || ourAtk >= theirDef * 0.9 || atStaging.length >= available.length)) {
    orderMove(state, atStaging.map((u) => u.id), target);
    for (const u of atStaging) u.aiTarget = target;
  }
  for (const u of available) {
    if (atStaging.includes(u)) continue;
    sendTo(state, u, staging);
  }
}

function nearestOwnStation(state: GameState, f: FactionId, from: string): string | null {
  let best: string | null = null;
  let bestH = Infinity;
  for (const s of ownedStations(state, f)) {
    if (state.provinces[s].controller !== f) continue;
    const h = hopsBetween(state, from, s, 10);
    if (h < bestH) {
      bestH = h;
      best = s;
    }
  }
  return best;
}

export function aiMilitary(state: GameState, f: FactionId) {
  const units = unitsOf(state, f).filter((u) => !(u.battle && state.battles[u.battle]?.defenders.includes(u.id)));
  if (units.length === 0) return;
  const enemies = enemiesOf(state, f).filter((e) => state.countries[e].alive);
  if (enemies.length === 0) peacetimeDeploy(state, f, units.filter((u) => !u.battle));
  else warDeploy(state, f, units, enemies);
}
