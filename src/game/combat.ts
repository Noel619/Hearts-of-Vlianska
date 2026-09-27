// Movimiento horario, batallas y ocupación.
//
// Modelo de combate (una ronda por hora):
// - El defensor ocupa la provincia; los atacantes empujan desde las provincias vecinas.
//   Una unidad solo combate en una batalla a la vez: si la atacan, deja de atacar y se defiende.
// - Cada terreno tiene un ancho de combate. Cada ataque desde otra dirección lo amplía.
//   Solo las unidades del frente disparan; la reserva entra por turnos cuando el frente se agota,
//   y sus morteros (fuego indirecto) siguen disparando desde atrás.
// - Los disparos de cada unidad se reparten entre las unidades enemigas del frente.
//   Cada objetivo compara los disparos recibidos con su defensa (si defiende) o su ruptura
//   (si ataca): lo que bloquea le hace poco daño y lo que no bloquea, mucho.
// - Barricadas, terreno, estaciones, flanqueo, atrincheramiento y suministro modifican esos valores.
// - La organización decide quién aguanta; la fuerza, cuántos hombres quedan.
import { MAP, STATIONS, TERRAIN_INFO } from '../data';
import type { Battle, BattleFactors, FactionId, GameState, Unit } from './types';
import { addLog, factionName, friendly, hasAccess, isAtWarWith, neighbors, newId, provinceName, stationName } from './helpers';
import { getMods } from './modifiers';
import { applyLoss, canEnter, edgeHours, relocateCapital, removeUnit, unitStats, type UnitStats } from './military';

export const COMBAT = {
  /** Organización perdida por cada impacto. */
  K_ORG: 0.1,
  /** Fuerza perdida por cada impacto, relativa a los puntos de vida de la unidad. */
  K_STR: 0.035,
  /** Probabilidad de impacto de un disparo bloqueado y de uno no bloqueado. */
  BLOCKED: 0.15,
  UNBLOCKED: 0.4,
  /** Cada nivel de barricada da cobertura (reduce el fuego enemigo) y algo de defensa. */
  FORT_COVER: 0.07,
  FORT_DEFENSE: 0.05,
  /** Atrincheramiento completo: el fuego enemigo recibido baja un 25 %. */
  DIG_COVER: 0.25,
  /** Flanqueo según el número de direcciones del ataque. */
  FLANK: [1, 1, 1.2, 1.3, 1.35],
  /** Sin suministro, ataque y defensa caen al 70 %. */
  OUT_OF_SUPPLY: 0.7,
  /** Blindaje que el enemigo no puede perforar: mitad de impactos. */
  ARMOR: 0.5,
  /** Por debajo de este porcentaje de organización una unidad no puede seguir combatiendo. */
  BROKEN: 0.05,
};

/** Unidades enemigas que ocupan (y defienden) una provincia. Las que se repliegan no cuentan. */
export function blockingUnitsIn(state: GameState, pid: string, f: FactionId): Unit[] {
  return Object.values(state.units).filter((u) => u.province === pid && !u.retreating && isAtWarWith(state, u.owner, f));
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
      u.retreating = false;
      continue;
    }
    const enemies = blockingUnitsIn(state, next, u.owner);
    if (enemies.length > 0) {
      if (u.retreating) {
        // El repliegue queda cortado: la unidad se detiene y vuelve a poder defenderse.
        u.path = [];
        u.moveProgress = 0;
        u.retreating = false;
        continue;
      }
      startOrJoinBattle(state, u, next);
      continue;
    }
    const edge = MAP.adjacency[u.province].find((a) => a.to === next)?.edge;
    if (!edge) {
      u.path = [];
      u.retreating = false;
      continue;
    }
    u.moveProgress += 1;
    const need = edgeHours(state, u.owner, stats.speed, edge.length, edge.terrain, u.outOfSupply);
    if (u.moveProgress >= need) {
      u.province = next;
      u.path.shift();
      u.moveProgress = 0;
      u.dug = 0;
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
    const defenders = blockingUnitsIn(state, pid, attacker.owner);
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
    if (!isAtWarWith(state, attacker.owner, battle.defenderSide)) battle.defenderSide = defenders[0].owner;
    state.battles[battle.id] = battle;
    state.stats.battles += 1;
    for (const d of defenders) d.battle = battle.id;
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

function canFight(f: Fighter) {
  return f.u.org > f.s.org * COMBAT.BROKEN;
}

/** Ancho que ocupa una unidad en el frente (las compañías de apoyo no ocupan). */
function unitWidth(f: Fighter) {
  return Math.max(1, f.s.width);
}

/** Elige el frente: primero las unidades más descansadas, hasta llenar el ancho. */
export function pickFront<T extends Fighter>(list: T[], width: number): T[] {
  const sorted = list.filter(canFight).sort((a, b) => b.u.org / Math.max(1, b.s.org) - a.u.org / Math.max(1, a.s.org));
  const out: T[] = [];
  let used = 0;
  for (const f of sorted) {
    const w = unitWidth(f);
    if (out.length > 0 && used + w > width) continue;
    out.push(f);
    used += w;
  }
  return out;
}

export function combatWidth(terrain: string, dirs: number): number {
  const base = TERRAIN_INFO[terrain as keyof typeof TERRAIN_INFO]?.width ?? 10;
  return Math.min(base * 2, base * (1 + 0.5 * Math.max(0, dirs - 1)));
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
      return blockingUnitsIn(state, to, u.owner).length === 0;
    });
  if (options.length === 0) return null;
  const score = (id: string) => {
    let s = 0;
    if (MAP.provinces[id].kind === 'estacion') s += 1;
    if (state.provinces[id].controller === u.owner) s += 1;
    // Mejor junto a unidades propias o aliadas.
    if (Object.values(state.units).some((x) => x.province === id && friendly(state, x.owner, u.owner))) s += 1.5;
    return s;
  };
  options.sort((a, b) => score(b) - score(a));
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

/** Multiplicador por fuerza: una unidad diezmada dispara y aguanta menos. */
function strengthFactor(u: Unit) {
  return 0.3 + 0.7 * u.strength;
}

/** Reparte el fuego de los tiradores entre los objetivos, en proporción al ancho que ocupa cada uno. */
function distributeFire(
  shooters: { f: Fighter; soft: number; hard: number; mod: number }[],
  targets: Fighter[],
  cover: (t: Fighter) => number = () => 1,
): Map<string, number> {
  const incoming = new Map<string, number>();
  const totalW = targets.reduce((s, t) => s + unitWidth(t), 0);
  if (totalW <= 0) return incoming;
  for (const sh of shooters) {
    const k = strengthFactor(sh.f.u) * sh.mod;
    if (k <= 0 || sh.soft + sh.hard <= 0) continue;
    for (const t of targets) {
      const share = unitWidth(t) / totalW;
      const base = sh.soft * (1 - t.s.hardness) + sh.hard * t.s.hardness;
      incoming.set(t.u.id, (incoming.get(t.u.id) ?? 0) + base * k * share * cover(t));
    }
  }
  return incoming;
}

/** Impactos que recibe un objetivo: los disparos que su defensa (o ruptura) no bloquea hacen cuatro veces más daño. */
export function hitsFrom(incoming: number, protection: number): number {
  const blocked = Math.min(incoming, Math.max(0, protection));
  return blocked * COMBAT.BLOCKED + (incoming - blocked) * COMBAT.UNBLOCKED;
}

export function hourlyCombat(state: GameState) {
  const battles = Object.values(state.battles);
  if (battles.length === 0) return;
  // La defensa tiene prioridad: una unidad atacada deja de atacar hasta rechazar el asalto.
  const defending = new Map<string, string>();
  for (const b of battles) {
    for (const u of blockingUnitsIn(state, b.province, b.attackerSide)) {
      if (!defending.has(u.id)) defending.set(u.id, b.id);
    }
  }
  for (const b of battles) {
    if (!state.battles[b.id]) continue;
    battleHour(state, b, defending);
  }
}

function battleHour(state: GameState, b: Battle, defending: Map<string, string>) {
  const pid = b.province;
  const terrain = MAP.provinces[pid].terrain;
  const tInfo = TERRAIN_INFO[terrain];

  // Participantes
  const attackers: Fighter[] = [];
  for (const id of b.attackers) {
    const u = state.units[id];
    if (!u) continue;
    const valid = u.path[0] === pid && !u.retreating && isAdjacent(u.province, pid) && isAtWarWith(state, u.owner, b.defenderSide) && !defending.has(u.id);
    if (!valid) {
      if (u.battle === b.id) u.battle = null;
      continue;
    }
    u.battle = b.id;
    attackers.push({ u, s: unitStats(state, u), from: u.province });
  }
  b.attackers = attackers.map((a) => a.u.id);
  const defenders: Fighter[] = blockingUnitsIn(state, pid, b.attackerSide)
    .filter((u) => defending.get(u.id) === b.id || !defending.has(u.id))
    .map((u) => {
      u.battle = b.id;
      return { u, s: unitStats(state, u), from: pid };
    });
  b.defenders = defenders.map((d) => d.u.id);

  if (defenders.length === 0) {
    attackersWin(state, b, attackers);
    return;
  }
  const activeAttackers = attackers.filter(canFight);
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
    return;
  }

  const dirs = new Set(activeAttackers.map((a) => a.from)).size;
  const width = combatWidth(terrain, dirs);
  const frontA = pickFront(activeAttackers, width);
  const frontD = pickFront(defenders, width);
  const attackerProvinces = new Set(attackers.map((a) => a.from));
  if (frontD.length === 0) {
    // Todos los defensores están agotados: se retiran.
    for (const d of defenders) if (state.units[d.u.id]) retreatUnit(state, d.u, pid, attackerProvinces);
    return;
  }

  // Modificadores del terreno y de las barricadas
  const defMods = getMods(state, b.defenderSide);
  const fortBonus = Math.max(0, ...frontD.map((d) => d.s.fortBonus));
  const fortLevel = state.provinces[pid].fort * (1 + (defMods.fortificacion ?? 0)) * (1 + fortBonus);
  const antiFort = Math.min(0.8, frontA.reduce((s, a) => s + a.s.antiFort, 0) / frontA.length);
  const fortAttack = Math.max(0.3, 1 - COMBAT.FORT_COVER * fortLevel * (1 - antiFort));
  const flank = COMBAT.FLANK[Math.min(COMBAT.FLANK.length - 1, dirs)];
  const stationBonus = terrain === 'estacion' ? defMods.defensaEstacion ?? 0 : 0;
  const attackMod = (a: Fighter) =>
    Math.max(0.1, 1 + tInfo.attack + terrainBonus(state, a.u.owner, terrain, a.s)) * fortAttack * flank * (a.u.outOfSupply ? COMBAT.OUT_OF_SUPPLY : 1);
  const defendMod = (d: Fighter) => Math.max(0.1, 1 + terrainBonus(state, d.u.owner, terrain, d.s)) * (d.u.outOfSupply ? COMBAT.OUT_OF_SUPPLY : 1);
  const dig = frontD.reduce((s, d) => s + (d.u.dug ?? 0), 0) / frontD.length;
  const defenseMod = (d: Fighter) => (1 + COMBAT.FORT_DEFENSE * fortLevel) * (1 + stationBonus) * (d.u.outOfSupply ? COMBAT.OUT_OF_SUPPLY : 1);
  // Cobertura de cada defensor: una unidad atrincherada recibe menos fuego.
  const cover = (d: Fighter) => 1 - COMBAT.DIG_COVER * (d.u.dug ?? 0);

  // Fuego: el frente dispara con todo; la reserva, solo con sus morteros.
  const reserveA = activeAttackers.filter((a) => !frontA.includes(a));
  const reserveD = defenders.filter((d) => !frontD.includes(d) && canFight(d));
  const incomingD = distributeFire(
    [
      ...frontA.map((a) => ({ f: a, soft: a.s.soft, hard: a.s.hard, mod: attackMod(a) })),
      ...reserveA.map((a) => ({ f: a, soft: a.s.indirectSoft, hard: a.s.indirectHard, mod: attackMod(a) })),
    ],
    frontD,
    cover,
  );
  const incomingA = distributeFire(
    [
      ...frontD.map((d) => ({ f: d, soft: d.s.soft, hard: d.s.hard, mod: defendMod(d) })),
      ...reserveD.map((d) => ({ f: d, soft: d.s.indirectSoft, hard: d.s.indirectHard, mod: defendMod(d) })),
    ],
    frontA,
  );
  const pierceA = Math.max(...frontA.map((a) => a.s.pierce));
  const pierceD = Math.max(...frontD.map((d) => d.s.pierce));

  let dmgToD = 0;
  let dmgToA = 0;
  for (const d of frontD) {
    const inc = incomingD.get(d.u.id) ?? 0;
    if (inc <= 0) continue;
    let hits = hitsFrom(inc, d.s.def * strengthFactor(d.u) * defenseMod(d));
    if (d.s.armor > pierceA) hits *= COMBAT.ARMOR;
    dmgToD += hits;
    b.defenderLosses += damage(state, d, hits);
  }
  for (const a of frontA) {
    const inc = incomingA.get(a.u.id) ?? 0;
    if (inc <= 0) continue;
    let hits = hitsFrom(inc, a.s.brk * strengthFactor(a.u) * (a.u.outOfSupply ? COMBAT.OUT_OF_SUPPLY : 1));
    if (a.s.armor > pierceD) hits *= COMBAT.ARMOR;
    dmgToA += hits;
    b.attackerLosses += damage(state, a, hits);
  }
  // Ventaja: qué parte del daño (relativo a la organización de cada bando) recibe el defensor.
  const orgA = frontA.reduce((s, a) => s + a.s.org, 0);
  const orgD = frontD.reduce((s, d) => s + d.s.org, 0);
  const relD = dmgToD / Math.max(1, orgD);
  const relA = dmgToA / Math.max(1, orgA);
  if (relA + relD > 0) b.lastAdvantage = b.lastAdvantage * 0.8 + (relD / (relA + relD)) * 0.2;
  b.factors = {
    width,
    widthA: frontA.reduce((s, a) => s + unitWidth(a), 0),
    widthD: frontD.reduce((s, d) => s + unitWidth(d), 0),
    dirs,
    attackMod: (frontA.reduce((s, a) => s + attackMod(a), 0) / frontA.length) * (1 - COMBAT.DIG_COVER * dig),
    defenseMod: frontD.reduce((s, d) => s + defenseMod(d), 0) / frontD.length,
    fort: state.provinces[pid].fort,
    dig,
  } satisfies BattleFactors;

  // Unidades destruidas
  for (const f of [...frontA, ...frontD]) {
    if (state.units[f.u.id] && f.u.strength <= 0.05) {
      addLog(state, { text: `${f.u.name} (${factionName(f.u.owner)}) ha sido destruida en combate.`, kind: 'guerra', faction: f.u.owner, province: pid });
      removeUnit(state, f.u.id);
    }
  }
  // Atacantes sin organización abandonan el ataque
  for (const a of frontA) {
    if (state.units[a.u.id] && !canFight(a)) {
      a.u.battle = null;
      a.u.path = [];
    }
  }
  // Defensores sin organización se retiran
  for (const d of frontD) {
    if (state.units[d.u.id] && !canFight(d)) retreatUnit(state, d.u, pid, attackerProvinces);
  }
}

/** Aplica los impactos: pérdida de organización y de fuerza. Devuelve los hombres perdidos. */
function damage(state: GameState, f: Fighter, hits: number): number {
  f.u.org = Math.max(0, f.u.org - hits * COMBAT.K_ORG);
  const loss = ((hits * COMBAT.K_STR) / Math.max(1, f.s.hp)) * (1 - f.s.casualtyReduction);
  const before = f.u.strength;
  applyLoss(state, f.u, loss, f.s);
  return (before - f.u.strength) * f.s.men;
}

function attackersWin(state: GameState, b: Battle, attackers: Fighter[]) {
  const pid = b.province;
  // Las unidades que se replegaban y no han salido a tiempo huyen a la carrera o se rinden.
  const attackerProvinces = new Set(attackers.map((a) => a.from));
  for (const u of Object.values(state.units)) {
    if (u.province !== pid || !u.retreating || !isAtWarWith(state, u.owner, b.attackerSide)) continue;
    const next = u.path[0];
    const s = unitStats(state, u);
    if (next && !attackerProvinces.has(next) && canEnter(state, u.owner, next, s.noAux) && blockingUnitsIn(state, next, u.owner).length === 0) {
      u.province = next;
      u.path.shift();
      u.moveProgress = 0;
      u.org *= 0.5;
      if (u.path.length === 0) u.retreating = false;
    } else {
      u.retreating = false;
      retreatUnit(state, u, pid, attackerProvinces);
    }
  }
  let entered = false;
  for (const a of attackers) {
    a.u.battle = null;
    if (!canFight(a)) continue;
    a.u.province = pid;
    a.u.path.shift();
    a.u.moveProgress = 0;
    a.u.dug = 0;
    enterProvince(state, a.u, pid);
    if (!entered && state.player === a.u.owner && MAP.provinces[pid].kind !== 'estacion') {
      addLog(state, { text: `${a.u.name} avanza hasta ${provinceName(pid)}.`, kind: 'bueno', faction: a.u.owner, province: pid });
    }
    entered = true;
  }
  endBattle(state, b);
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
  u.dug = 0;
  if (state.player === u.owner) {
    addLog(state, { text: `${u.name} se retira de ${provinceName(pid)} a ${provinceName(target)}.`, kind: 'malo', faction: u.owner, province: target });
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
      if (!state.units[u.id] || u.retreating) continue;
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
          u.battle = null;
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

/** Horas que tardaría una unidad en recorrer el tramo hasta una provincia vecina. */
export function hoursTo(state: GameState, u: Unit, to: string): number {
  const edge = MAP.adjacency[u.province].find((a) => a.to === to)?.edge;
  if (!edge) return Infinity;
  return edgeHours(state, u.owner, unitStats(state, u).speed, edge.length, edge.terrain, u.outOfSupply);
}
