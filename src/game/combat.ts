// Movimiento horario, batallas y ocupación.
import { MAP, STATIONS, TERRAIN_INFO } from '../data';
import type { Battle, FactionId, GameState, Unit } from './types';
import { addLog, factionName, friendly, hasAccess, isAtWarWith, neighbors, newId, provinceName, stationName } from './helpers';
import { getMods } from './modifiers';
import { applyLoss, canEnter, edgeHours, relocateCapital, removeUnit, unitStats, type UnitStats } from './military';
import { rand } from './rng';

const K_ORG = 0.13;
const K_STR = 0.04;
const RESERVE_FIRE = 0.3;

function hostileUnitsIn(state: GameState, pid: string, f: FactionId): Unit[] {
  return Object.values(state.units).filter((u) => u.province === pid && isAtWarWith(state, u.owner, f));
}

// ---------------------------------------------------------------------------
// Movimiento
// ---------------------------------------------------------------------------

export function hourlyMovement(state: GameState) {
  for (const u of Object.values(state.units)) {
    if (!state.units[u.id]) continue;
    if (u.battle || u.path.length === 0) continue;
    const next = u.path[0];
    const stats = unitStats(state, u);
    if (!canEnter(state, u.owner, next, stats.noAux)) {
      u.path = [];
      u.moveProgress = 0;
      continue;
    }
    const enemies = hostileUnitsIn(state, next, u.owner);
    if (enemies.length > 0) {
      if (u.retreating) {
        u.path = [];
        continue;
      }
      startOrJoinBattle(state, u, next);
      continue;
    }
    const edge = MAP.adjacency[u.province].find((a) => a.to === next)?.edge;
    if (!edge) {
      u.path = [];
      continue;
    }
    u.moveProgress += 1;
    const need = edgeHours(state, u.owner, stats.speed, edge.length, edge.terrain, u.outOfSupply);
    if (u.moveProgress >= need) {
      u.province = next;
      u.path.shift();
      u.moveProgress = 0;
      if (u.path.length === 0) u.retreating = false;
      enterProvince(state, u, next);
    }
  }
}

export function enterProvince(state: GameState, u: Unit, pid: string) {
  const p = state.provinces[pid];
  const ctrl = p.controller;
  if (!ctrl || ctrl === u.owner) return;
  if (!isAtWarWith(state, u.owner, ctrl)) return;
  const isStation = MAP.provinces[pid].kind === 'estacion';
  const owner = isStation ? state.stations[pid].owner : null;
  const newCtrl = owner && owner !== u.owner && friendly(state, owner, u.owner) ? owner : u.owner;
  p.controller = newCtrl;
  if (isStation) {
    state.stats.captures += 1;
    addLog(state, {
      text: `¡${factionName(u.owner)} toma ${STATIONS[pid].name}${owner && owner !== newCtrl ? ` a ${factionName(ctrl)}` : ''}!`,
      kind: 'guerra',
      faction: u.owner,
      province: pid,
    });
    if (state.countries[ctrl].capital === pid) relocateCapital(state, ctrl);
    if (owner && owner !== ctrl && state.countries[owner].capital === pid) relocateCapital(state, owner);
    // Las barricadas sufren en el asalto.
    p.fort = Math.max(0, p.fort - 1);
  }
}

// ---------------------------------------------------------------------------
// Batallas
// ---------------------------------------------------------------------------

export function startOrJoinBattle(state: GameState, attacker: Unit, pid: string) {
  let battle = Object.values(state.battles).find((b) => b.province === pid);
  if (battle && !isAtWarWith(state, attacker.owner, battle.defenderSide)) return;
  if (!battle) {
    const defenders = hostileUnitsIn(state, pid, attacker.owner);
    if (defenders.length === 0) return;
    battle = {
      id: newId(state, 'b'),
      province: pid,
      attackers: [],
      defenders: defenders.map((d) => d.id),
      attackerSide: attacker.owner,
      defenderSide: state.provinces[pid].controller ?? defenders[0].owner,
      start: state.hour,
      attackerLosses: 0,
      defenderLosses: 0,
      lastAdvantage: 0.5,
    };
    state.battles[battle.id] = battle;
    state.stats.battles += 1;
    for (const d of defenders) {
      d.battle = battle.id;
    }
    if (state.player && (state.player === attacker.owner || defenders.some((d) => d.owner === state.player))) {
      addLog(state, {
        text: `Combate en ${provinceName(pid)}: ${factionName(attacker.owner)} ataca a ${factionName(battle.defenderSide)}.`,
        kind: 'guerra',
        faction: attacker.owner,
        province: pid,
      });
    }
  }
  if (!battle.attackers.includes(attacker.id)) battle.attackers.push(attacker.id);
  attacker.battle = battle.id;
}

interface Fighter {
  u: Unit;
  s: UnitStats;
  from: string;
}

function isAdjacent(a: string, b: string) {
  return MAP.adjacency[a]?.some((x) => x.to === b) ?? false;
}

function pickFront(list: Fighter[], width: number): Fighter[] {
  const sorted = [...list].sort((a, b) => b.u.org / Math.max(1, b.s.org) - a.u.org / Math.max(1, a.s.org));
  const out: Fighter[] = [];
  let used = 0;
  for (const f of sorted) {
    if (f.u.org <= f.s.org * 0.05) continue;
    const w = Math.max(1, f.s.width);
    if (out.length > 0 && used + w > width) continue;
    out.push(f);
    used += w;
  }
  return out;
}

function retreatTarget(state: GameState, u: Unit, battleProvince: string, attackerProvinces: Set<string>): string | null {
  const stats = unitStats(state, u);
  const options = neighbors(state, u.province)
    .map((n) => n.to)
    .filter((to) => {
      if (to === battleProvince || attackerProvinces.has(to)) return false;
      if (!canEnter(state, u.owner, to, stats.noAux)) return false;
      const ctrl = state.provinces[to].controller;
      if (ctrl && !hasAccess(state, u.owner, ctrl)) return false;
      if (ctrl && isAtWarWith(state, u.owner, ctrl)) return false;
      return !Object.values(state.units).some((x) => x.province === to && isAtWarWith(state, x.owner, u.owner));
    });
  if (options.length === 0) return null;
  options.sort((a, b) => {
    const sa = MAP.provinces[a].kind === 'estacion' ? 1 : 0;
    const sb = MAP.provinces[b].kind === 'estacion' ? 1 : 0;
    const ca = state.provinces[a].controller === u.owner ? 1 : 0;
    const cb = state.provinces[b].controller === u.owner ? 1 : 0;
    return sb + cb - (sa + ca);
  });
  return options[0];
}

export function endBattle(state: GameState, b: Battle) {
  for (const id of [...b.attackers, ...b.defenders]) {
    const u = state.units[id];
    if (u && u.battle === b.id) u.battle = null;
  }
  delete state.battles[b.id];
}

function terrainBonus(state: GameState, f: FactionId, terrain: string, s: UnitStats): number {
  const m = getMods(state, f);
  let bonus = 0;
  if (terrain === 'peligroso' || terrain === 'auxiliarPeligroso') bonus += (m.ataquePeligroso ?? 0) + s.dangerAttack;
  if (terrain === 'auxiliar' || terrain === 'auxiliarPeligroso' || terrain === 'estrecho') bonus += m.ataqueAuxiliar ?? 0;
  return bonus;
}

export function hourlyCombat(state: GameState) {
  for (const b of Object.values(state.battles)) {
    if (!state.battles[b.id]) continue;
    const pid = b.province;
    const terrain = MAP.provinces[pid].terrain;
    const tInfo = TERRAIN_INFO[terrain];

    // Actualiza participantes
    const attackers: Fighter[] = [];
    for (const id of b.attackers) {
      const u = state.units[id];
      if (!u || u.path[0] !== pid || u.retreating || !isAdjacent(u.province, pid)) {
        if (u && u.battle === b.id) u.battle = null;
        continue;
      }
      if (!isAtWarWith(state, u.owner, b.defenderSide)) {
        u.battle = null;
        continue;
      }
      attackers.push({ u, s: unitStats(state, u), from: u.province });
    }
    b.attackers = attackers.map((a) => a.u.id);
    const defenders: Fighter[] = Object.values(state.units)
      .filter((u) => u.province === pid && !u.retreating && isAtWarWith(state, u.owner, b.attackerSide))
      .map((u) => {
        u.battle = b.id;
        return { u, s: unitStats(state, u), from: pid };
      });
    b.defenders = defenders.map((d) => d.u.id);

    if (defenders.length === 0) {
      // Victoria del atacante: entran en la provincia.
      for (const a of attackers) {
        a.u.battle = null;
        if (a.u.org <= a.s.org * 0.05) continue;
        a.u.province = pid;
        a.u.path.shift();
        a.u.moveProgress = 0;
        enterProvinceAfterBattle(state, a.u, pid);
      }
      endBattle(state, b);
      continue;
    }
    const activeAttackers = attackers.filter((a) => a.u.org > a.s.org * 0.05);
    if (activeAttackers.length === 0) {
      if (state.player && (b.attackerSide === state.player || b.defenderSide === state.player)) {
        addLog(state, {
          text: `${factionName(b.defenderSide)} rechaza el ataque en ${provinceName(pid)}.`,
          kind: b.defenderSide === state.player ? 'bueno' : 'malo',
          province: pid,
        });
      }
      for (const a of attackers) {
        a.u.battle = null;
        a.u.path = [];
      }
      endBattle(state, b);
      continue;
    }

    const dirs = new Set(activeAttackers.map((a) => a.from)).size;
    const width = Math.min(tInfo.width * 2, tInfo.width * (1 + 0.5 * (dirs - 1)));
    const frontA = pickFront(activeAttackers, width);
    const frontD = pickFront(defenders, width);
    if (frontD.length === 0) {
      // Todos los defensores sin organización: se retiran.
      retreatAll(state, b, defenders, attackers);
      continue;
    }

    const fort = state.provinces[pid].fort;
    const defMods = getMods(state, b.defenderSide);
    const fortEff = fort * 0.08 * (1 + (defMods.fortificacion ?? 0)) * (1 + Math.max(...frontD.map((d) => d.s.fortBonus)));
    const antiFort = Math.min(1, frontA.reduce((s, a) => s + a.s.antiFort, 0) / frontA.length);
    const stationBonus = terrain === 'estacion' ? defMods.defensaEstacion ?? 0 : 0;
    const flank = dirs >= 2 ? 1.15 : 1;

    const incomingA = new Map<string, number>();
    const incomingD = new Map<string, number>();
    const pierceA = Math.max(...frontA.map((a) => a.s.pierce));
    const pierceD = Math.max(...frontD.map((d) => d.s.pierce));

    // Las unidades en reserva apoyan con fuego de cobertura (30 % de su ataque).
    const reserveA = activeAttackers.filter((a) => !frontA.includes(a));
    const reserveD = defenders.filter((d) => !frontD.includes(d) && d.u.org > d.s.org * 0.05);
    const attackersFiring = [...frontA.map((a) => ({ f: a, k: 1 })), ...reserveA.map((a) => ({ f: a, k: RESERVE_FIRE }))];
    const defendersFiring = [...frontD.map((d) => ({ f: d, k: 1 })), ...reserveD.map((d) => ({ f: d, k: RESERVE_FIRE }))];
    for (const { f: a, k } of attackersFiring) {
      const d = frontD[Math.floor(rand(state) * frontD.length)];
      const base = a.s.soft * (1 - d.s.hardness) + a.s.hard * d.s.hardness;
      let atk = base * (0.4 + 0.6 * a.u.strength) * k;
      atk *= 1 + tInfo.attack + terrainBonus(state, a.u.owner, terrain, a.s);
      atk *= 1 - fortEff * (1 - antiFort);
      atk *= flank;
      if (a.u.outOfSupply) atk *= 0.7;
      incomingD.set(d.u.id, (incomingD.get(d.u.id) ?? 0) + Math.max(0, atk));
    }
    for (const { f: d, k } of defendersFiring) {
      const a = frontA[Math.floor(rand(state) * frontA.length)];
      const base = d.s.soft * (1 - a.s.hardness) + d.s.hard * a.s.hardness;
      let atk = base * (0.4 + 0.6 * d.u.strength) * k;
      atk *= 1 + terrainBonus(state, d.u.owner, terrain, d.s);
      if (d.u.outOfSupply) atk *= 0.7;
      incomingA.set(a.u.id, (incomingA.get(a.u.id) ?? 0) + Math.max(0, atk));
    }

    let dmgToD = 0;
    let dmgToA = 0;
    for (const d of frontD) {
      const inc = incomingD.get(d.u.id) ?? 0;
      if (inc <= 0) continue;
      let defense = d.s.def * (0.4 + 0.6 * d.u.strength) * (1 + fortEff) * (1 + stationBonus);
      if (d.u.outOfSupply) defense *= 0.7;
      const blocked = Math.min(inc, defense);
      let hits = blocked * 0.2 + (inc - blocked) * 0.4;
      if (d.s.armor > pierceA) hits *= 0.5;
      dmgToD += hits;
      d.u.org = Math.max(0, d.u.org - hits * K_ORG);
      const loss = ((hits * K_STR) / Math.max(1, d.s.hp)) * (1 - d.s.casualtyReduction);
      const before = d.u.strength;
      applyLoss(state, d.u, loss, d.s);
      b.defenderLosses += (before - d.u.strength) * d.s.men;
    }
    for (const a of frontA) {
      const inc = incomingA.get(a.u.id) ?? 0;
      if (inc <= 0) continue;
      let brk = a.s.brk * (0.4 + 0.6 * a.u.strength);
      if (a.u.outOfSupply) brk *= 0.7;
      const blocked = Math.min(inc, brk);
      let hits = blocked * 0.2 + (inc - blocked) * 0.4;
      if (a.s.armor > pierceD) hits *= 0.5;
      dmgToA += hits;
      a.u.org = Math.max(0, a.u.org - hits * K_ORG);
      const loss = ((hits * K_STR) / Math.max(1, a.s.hp)) * (1 - a.s.casualtyReduction);
      const before = a.u.strength;
      applyLoss(state, a.u, loss, a.s);
      b.attackerLosses += (before - a.u.strength) * a.s.men;
    }
    const total = dmgToA + dmgToD;
    if (total > 0) b.lastAdvantage = b.lastAdvantage * 0.8 + (dmgToD / total) * 0.2;

    // Unidades destruidas
    for (const f of [...frontA, ...frontD]) {
      if (state.units[f.u.id] && f.u.strength <= 0.05) {
        addLog(state, { text: `${f.u.name} (${factionName(f.u.owner)}) ha sido destruida en combate.`, kind: 'guerra', faction: f.u.owner, province: pid });
        removeUnit(state, f.u.id);
      }
    }
    // Atacantes sin organización abandonan el ataque
    for (const a of frontA) {
      if (state.units[a.u.id] && a.u.org <= a.s.org * 0.05) {
        a.u.battle = null;
        a.u.path = [];
      }
    }
    // Defensores sin organización se retiran
    const attackerProvinces = new Set(attackers.map((a) => a.from));
    for (const d of frontD) {
      if (state.units[d.u.id] && d.u.org <= d.s.org * 0.05) retreatUnit(state, d.u, pid, attackerProvinces);
    }
  }
}

function retreatAll(state: GameState, b: Battle, defenders: Fighter[], attackers: Fighter[]) {
  const attackerProvinces = new Set(attackers.map((a) => a.from));
  for (const d of defenders) if (state.units[d.u.id]) retreatUnit(state, d.u, b.province, attackerProvinces);
}

function retreatUnit(state: GameState, u: Unit, pid: string, attackerProvinces: Set<string>) {
  const target = retreatTarget(state, u, pid, attackerProvinces);
  u.battle = null;
  if (!target) {
    addLog(state, {
      text: `${u.name} (${factionName(u.owner)}) queda rodeada en ${provinceName(pid)} y se rinde.`,
      kind: 'guerra',
      faction: u.owner,
      province: pid,
    });
    applyLoss(state, u, u.strength * 0.5);
    removeUnit(state, u.id);
    return;
  }
  u.province = target;
  u.path = [];
  u.moveProgress = 0;
  u.retreating = false;
  if (state.player === u.owner) {
    addLog(state, { text: `${u.name} se retira de ${provinceName(pid)} a ${provinceName(target)}.`, kind: 'malo', faction: u.owner, province: target });
  }
}

function enterProvinceAfterBattle(state: GameState, u: Unit, pid: string) {
  enterProvince(state, u, pid);
  if (state.player === u.owner && MAP.provinces[pid].kind !== 'estacion') {
    addLog(state, { text: `${u.name} avanza hasta ${provinceName(pid)}.`, kind: 'bueno', faction: u.owner, province: pid });
  }
}

/** Resuelve choques entre enemigos que acaban en la misma provincia sin batalla. */
export function resolveOverlaps(state: GameState) {
  const byProvince = new Map<string, Unit[]>();
  for (const u of Object.values(state.units)) {
    if (!byProvince.has(u.province)) byProvince.set(u.province, []);
    byProvince.get(u.province)!.push(u);
  }
  for (const [pid, units] of byProvince) {
    if (units.length < 2) continue;
    const ctrl = state.provinces[pid].controller;
    for (const u of units) {
      if (!state.units[u.id]) continue;
      if (ctrl && isAtWarWith(state, u.owner, ctrl) && units.some((x) => x.owner === ctrl || (x.owner !== u.owner && friendly(state, x.owner, ctrl)))) {
        // Intrusa en provincia enemiga defendida: retrocede a su provincia anterior.
        const back = neighbors(state, pid).find((n) => {
          const c = state.provinces[n.to].controller;
          return c === u.owner || (c && friendly(state, c, u.owner));
        });
        if (back) {
          u.province = back.to;
          u.path = [pid];
          u.moveProgress = 0;
        }
      }
    }
  }
}

export function battleSummary(state: GameState, b: Battle) {
  return {
    province: provinceName(b.province),
    attacker: factionName(b.attackerSide),
    defender: factionName(b.defenderSide),
    days: Math.floor((state.hour - b.start) / 24),
    advantage: b.lastAdvantage,
    station: MAP.provinces[b.province].kind === 'estacion' ? stationName(b.province) : null,
  };
}
