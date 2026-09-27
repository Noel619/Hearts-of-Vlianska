// Ejército: plantillas, estadísticas, movimiento, suministro, desgaste y reclutamiento.
import { BATTALIONS, MAP, SPECIAL_TEMPLATES, STATIONS, TERRAIN_INFO, initialControllers } from '../data';
import type { EquipmentId, FactionId, GameState, Template, TemplateDef, Unit } from './types';
import { EQUIPMENT_IDS } from './types';
import {
  addLog,
  clamp,
  factionName,
  friendly,
  hasAccess,
  isAtWarWith,
  neighbors,
  newId,
  ownedStations,
  provinceName,
  provincePassable,
  stationName,
} from './helpers';
import { getMods, mod, modStamp } from './modifiers';
import { equipmentLevel, templateSlots, unlockedBattalions } from './research';
import { chance, rand } from './rng';

export const AUX_TERRAINS = new Set(['auxiliar', 'auxiliarPeligroso', 'estrecho']);
export const RECRUIT_DAYS = 40;

export interface UnitStats {
  men: number;
  width: number;
  org: number;
  hp: number;
  soft: number;
  hard: number;
  def: number;
  brk: number;
  armor: number;
  pierce: number;
  hardness: number;
  speed: number;
  equipment: Record<EquipmentId, number>;
  noAux: boolean;
  attritionReduction: number;
  fortBonus: number;
  casualtyReduction: number;
  dangerAttack: number;
  antiFort: number;
  vision: number;
  reinforce: number;
  excavation: number;
  /** Ataque de los batallones de fuego indirecto (morteros), que disparan desde la reserva. */
  indirectSoft: number;
  indirectHard: number;
}

export function emptyEquipment(): Record<EquipmentId, number> {
  return { armas: 0, apoyo: 0, morteros: 0, lanzallamas: 0, draisinas: 0 };
}

export function templateById(state: GameState, f: FactionId, id: string): TemplateDef | undefined {
  return state.countries[f].templates.find((t) => t.id === id) ?? SPECIAL_TEMPLATES[id];
}

const statCache = new WeakMap<GameState, Map<string, UnitStats>>();

export function templateStats(state: GameState, f: FactionId, tpl: TemplateDef): UnitStats {
  const key = `${f}|${tpl.id}|${tpl.line.join(',')}|${tpl.support.join(',')}|${modStamp(state)}`;
  let map = statCache.get(state);
  if (!map) {
    map = new Map();
    statCache.set(state, map);
  }
  const hit = map.get(key);
  if (hit) return hit;
  const m = getMods(state, f);
  const bats = [...tpl.line, ...tpl.support].map((b) => BATTALIONS[b]).filter(Boolean);
  const line = tpl.line.map((b) => BATTALIONS[b]).filter(Boolean);
  const s: UnitStats = {
    men: 0,
    width: 0,
    org: 0,
    hp: 0,
    soft: 0,
    hard: 0,
    def: 0,
    brk: 0,
    armor: 0,
    pierce: 0,
    hardness: 0,
    speed: 99,
    equipment: emptyEquipment(),
    noAux: false,
    attritionReduction: 0,
    fortBonus: 0,
    casualtyReduction: 0,
    dangerAttack: 0,
    antiFort: 0,
    vision: 0,
    reinforce: 0,
    excavation: 0,
    indirectSoft: 0,
    indirectHard: 0,
  };
  let orgSum = 0;
  let maxArmor = 0;
  let maxPierce = 0;
  let armorSum = 0;
  let pierceSum = 0;
  for (const b of bats) {
    let wSum = 0;
    let lvlSum = 0;
    for (const [eq, n] of Object.entries(b.equipment) as [EquipmentId, number][]) {
      s.equipment[eq] += n;
      wSum += n;
      lvlSum += n * equipmentLevel(state, f, eq);
    }
    const lvl = wSum > 0 ? lvlSum / wSum : 1;
    const q = 1 + 0.15 * (lvl - 1);
    s.men += b.men;
    s.hp += b.hp;
    s.soft += b.soft * q;
    s.hard += b.hard * q;
    s.def += b.def * q;
    s.brk += b.brk * q;
    orgSum += b.org;
    s.speed = Math.min(s.speed, b.speed);
    if (b.noAuxiliary) s.noAux = true;
    const sp = b.special;
    if (sp) {
      s.attritionReduction = Math.max(s.attritionReduction, sp.attritionReduction ?? 0);
      s.fortBonus += sp.fortBonus ?? 0;
      s.casualtyReduction = Math.max(s.casualtyReduction, sp.casualtyReduction ?? 0);
      s.dangerAttack += sp.dangerAttack ?? 0;
      s.antiFort += sp.antiFort ?? 0;
      s.vision = Math.max(s.vision, sp.vision ?? 0);
      s.reinforce += sp.reinforce ?? 0;
      s.excavation += sp.excavation ?? 0;
      if (sp.indirect) {
        s.indirectSoft += b.soft * q;
        s.indirectHard += b.hard * q;
      }
    }
  }
  for (const b of line) {
    s.width += b.width;
    const lvl = b.id === 'draisina' ? equipmentLevel(state, f, 'draisinas') : 1;
    const armor = b.armor * (1 + 0.2 * (lvl - 1));
    maxArmor = Math.max(maxArmor, armor);
    maxPierce = Math.max(maxPierce, b.pierce);
    armorSum += armor;
    pierceSum += b.pierce;
    s.hardness += b.hardness;
  }
  const n = Math.max(1, line.length);
  s.armor = maxArmor > 0 ? maxArmor * 0.4 + (armorSum / n) * 0.6 : 0;
  s.pierce = maxPierce * 0.4 + (pierceSum / n) * 0.6;
  s.hardness = s.hardness / n;
  s.org = (orgSum / Math.max(1, bats.length)) * (1 + (m.organizacion ?? 0));
  s.soft *= 1 + (m.ataque ?? 0);
  s.hard *= 1 + (m.ataque ?? 0);
  s.indirectSoft *= 1 + (m.ataque ?? 0);
  s.indirectHard *= 1 + (m.ataque ?? 0);
  s.def *= 1 + (m.defensa ?? 0);
  s.brk *= 1 + (m.ruptura ?? 0);
  if (s.speed === 99) s.speed = 4;
  map.set(key, s);
  return s;
}

export function unitStats(state: GameState, u: Unit): UnitStats {
  const tpl = templateById(state, u.owner, u.template);
  if (!tpl) return templateStats(state, u.owner, { id: 'x', name: 'x', line: ['milicia'], support: [] });
  return templateStats(state, u.owner, tpl);
}

export function unitMen(state: GameState, u: Unit): number {
  return unitStats(state, u).men * u.strength;
}

// ---------------------------------------------------------------------------
// Plantillas
// ---------------------------------------------------------------------------

export function validateTemplate(state: GameState, f: FactionId, tpl: TemplateDef): string | null {
  if (!tpl.name.trim()) return 'La plantilla necesita un nombre.';
  if (tpl.line.length === 0) return 'Añade al menos un batallón de línea.';
  const slots = templateSlots(state, f);
  if (tpl.line.length > slots.line) return `Solo tienes ${slots.line} casillas de línea.`;
  if (tpl.support.length > slots.support) return `Solo tienes ${slots.support} casillas de apoyo.`;
  const unlocked = unlockedBattalions(state, f);
  for (const b of [...tpl.line, ...tpl.support]) {
    if (!BATTALIONS[b]) return 'Batallón desconocido.';
    if (!unlocked.has(b)) return `${BATTALIONS[b].name} requiere investigar su tecnología.`;
  }
  if (new Set(tpl.support).size !== tpl.support.length) return 'No puedes repetir compañías de apoyo.';
  for (const b of tpl.line) if (BATTALIONS[b].support) return 'Compañía de apoyo en casilla de línea.';
  for (const b of tpl.support) if (!BATTALIONS[b].support) return 'Batallón de línea en casilla de apoyo.';
  return null;
}

export function saveTemplate(state: GameState, f: FactionId, tpl: Template): string | null {
  const err = validateTemplate(state, f, tpl);
  if (err) return err;
  const c = state.countries[f];
  const idx = c.templates.findIndex((t) => t.id === tpl.id);
  if (idx >= 0) {
    // Las unidades existentes conservan sus hombres: si la plantilla crece, quedan incompletas.
    const oldMen = templateStats(state, f, c.templates[idx]).men;
    c.templates[idx] = { ...tpl, line: [...tpl.line], support: [...tpl.support] };
    const newMen = templateStats(state, f, c.templates[idx]).men;
    if (newMen > oldMen) {
      for (const u of Object.values(state.units)) {
        if (u.owner === f && u.template === tpl.id) u.strength = Math.min(1, (u.strength * oldMen) / newMen);
      }
    }
  } else c.templates.push({ ...tpl, line: [...tpl.line], support: [...tpl.support], custom: true });
  return null;
}

export function deleteTemplate(state: GameState, f: FactionId, id: string): boolean {
  const c = state.countries[f];
  const inUse = Object.values(state.units).some((u) => u.owner === f && u.template === id) || c.recruitment.some((r) => r.template === id);
  if (inUse) return false;
  c.templates = c.templates.filter((t) => t.id !== id);
  return true;
}

export function addTemplate(state: GameState, f: FactionId, id: string) {
  const c = state.countries[f];
  const tpl = SPECIAL_TEMPLATES[id];
  if (!tpl || c.templates.some((t) => t.id === id)) return;
  c.templates.push({ ...tpl, line: [...tpl.line], support: [...tpl.support] });
}

// ---------------------------------------------------------------------------
// Unidades
// ---------------------------------------------------------------------------

export function spawnUnit(state: GameState, f: FactionId, templateId: string, province: string, opts: { name?: string; strength?: number } = {}): Unit | null {
  const tpl = templateById(state, f, templateId);
  if (!tpl) return null;
  const c = state.countries[f];
  c.unitCounter += 1;
  const stats = templateStats(state, f, tpl);
  const u: Unit = {
    id: newId(state, 'u'),
    owner: f,
    name: opts.name ?? `${tpl.name} n.º ${c.unitCounter}`,
    template: tpl.id,
    province,
    org: stats.org,
    strength: opts.strength ?? 1,
    path: [],
    moveProgress: 0,
    battle: null,
    retreating: false,
    outOfSupply: false,
    xp: 0,
  };
  state.units[u.id] = u;
  return u;
}

export function removeUnit(state: GameState, id: string) {
  const u = state.units[id];
  if (!u) return;
  if (u.battle) {
    const b = state.battles[u.battle];
    if (b) {
      b.attackers = b.attackers.filter((x) => x !== id);
      b.defenders = b.defenders.filter((x) => x !== id);
    }
  }
  delete state.units[id];
}

export function unitsAt(state: GameState, pid: string): Unit[] {
  return Object.values(state.units).filter((u) => u.province === pid);
}

export function unitsOf(state: GameState, f: FactionId): Unit[] {
  return Object.values(state.units).filter((u) => u.owner === f);
}

/** Reduce la población de las estaciones de f en proporción a sus habitantes (bajas). */
export function killMen(state: GameState, f: FactionId, men: number) {
  if (men <= 0) return;
  const c = state.countries[f];
  c.casualties += men;
  c.recentLosses += men;
  const owned = ownedStations(state, f);
  const total = owned.reduce((s, id) => s + state.stations[id].population, 0);
  if (total <= 0) return;
  for (const id of owned) {
    const st = state.stations[id];
    st.population = Math.max(0, st.population - (men * st.population) / total);
  }
}

// ---------------------------------------------------------------------------
// Movimiento
// ---------------------------------------------------------------------------

export function canEnter(state: GameState, f: FactionId, pid: string, noAux: boolean): boolean {
  if (!provincePassable(state, pid)) return false;
  if (noAux && AUX_TERRAINS.has(MAP.provinces[pid].terrain)) return false;
  const ctrl = state.provinces[pid].controller;
  if (!ctrl) return true;
  if (hasAccess(state, f, ctrl)) return true;
  return isAtWarWith(state, f, ctrl);
}

export function edgeHours(state: GameState, f: FactionId, speed: number, edgeLength: number, terrain: string, outOfSupply = false): number {
  const t = TERRAIN_INFO[terrain as keyof typeof TERRAIN_INFO] ?? TERRAIN_INFO.tunel;
  const speedFactor = Math.max(0.25, speed / 4) * Math.max(0.3, 1 + mod(state, f, 'movimiento'));
  return Math.max(3, ((edgeLength / 8) * t.move) / speedFactor) * (outOfSupply ? 1.3 : 1);
}

/** ¿Hay tropas en guerra con f en la provincia? */
export function enemyUnitsIn(state: GameState, f: FactionId, pid: string): boolean {
  for (const u of Object.values(state.units)) if (u.province === pid && isAtWarWith(state, f, u.owner)) return true;
  return false;
}

/** Camino más rápido (Dijkstra) para una facción, evitando túneles peligrosos cuando hay alternativa. */
export function findPath(
  state: GameState,
  f: FactionId,
  from: string,
  to: string,
  opts: { noAux?: boolean; speed?: number; avoidEnemies?: boolean } = {},
): string[] | null {
  if (from === to) return [];
  const speed = opts.speed ?? 4;
  const noAux = !!opts.noAux;
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set<string>([from]);
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const id of open) {
      if (dist[id] < best) {
        best = dist[id];
        cur = id;
      }
    }
    open.delete(cur);
    if (cur === to) break;
    for (const n of neighbors(state, cur)) {
      if (noAux && AUX_TERRAINS.has(n.terrain)) continue;
      if (!canEnter(state, f, n.to, noAux)) continue;
      // No se atraviesan estaciones enemigas ni túneles con tropas enemigas salvo que sean el destino;
      // un túnel enemigo vacío se cruza (y se ocupa de paso), aunque se prefiere evitarlo.
      const ctrl = state.provinces[n.to].controller;
      const hostile = n.to !== to && !!ctrl && isAtWarWith(state, f, ctrl) && !!opts.avoidEnemies;
      if (hostile && (MAP.provinces[n.to].kind === 'estacion' || enemyUnitsIn(state, f, n.to))) continue;
      const danger = state.provinces[n.to].danger;
      const cost = edgeHours(state, f, speed, n.length, n.terrain) + danger * 0.08 + (hostile ? 12 : 0);
      const nd = dist[cur] + cost;
      if (dist[n.to] === undefined || nd < dist[n.to]) {
        dist[n.to] = nd;
        prev[n.to] = cur;
        open.add(n.to);
      }
    }
  }
  if (dist[to] === undefined) return null;
  const path: string[] = [];
  let cur = to;
  while (cur !== from) {
    path.unshift(cur);
    cur = prev[cur];
  }
  return path;
}

/** ¿Está la unidad defendiendo su provincia de un ataque? */
export function isDefending(state: GameState, u: Unit): boolean {
  return !!u.battle && !!state.battles[u.battle]?.defenders.includes(u.id);
}

/**
 * Ordena mover unidades. Una unidad que defiende puede replegarse: deja de combatir y
 * sale de la provincia; si el atacante gana antes de que salga, huye con media organización.
 */
export function orderMove(state: GameState, unitIds: string[], target: string): number {
  let ok = 0;
  for (const id of unitIds) {
    const u = state.units[id];
    if (!u) continue;
    const stats = unitStats(state, u);
    const path = findPath(state, u.owner, u.province, target, { noAux: stats.noAux, speed: stats.speed });
    if (!path) continue;
    const withdrawing = isDefending(state, u);
    if (path.length === 0) {
      // Orden de quedarse donde está: cancela el movimiento.
      if (!withdrawing && u.battle) leaveBattle(state, u);
      u.path = [];
      u.moveProgress = 0;
      u.retreating = false;
      ok++;
      continue;
    }
    if (u.battle) leaveBattle(state, u);
    if (u.path[0] !== path[0]) u.moveProgress = 0;
    u.path = path;
    u.retreating = withdrawing;
    ok++;
  }
  return ok;
}

export function stopUnits(state: GameState, unitIds: string[]) {
  for (const id of unitIds) {
    const u = state.units[id];
    if (!u) continue;
    if (u.battle && !isDefending(state, u)) leaveBattle(state, u);
    u.path = [];
    u.moveProgress = 0;
    u.retreating = false;
  }
}

export function leaveBattle(state: GameState, u: Unit) {
  if (!u.battle) return;
  const b = state.battles[u.battle];
  if (b) {
    b.attackers = b.attackers.filter((x) => x !== u.id);
    b.defenders = b.defenders.filter((x) => x !== u.id);
  }
  u.battle = null;
}

/** Tiempo restante en horas hasta llegar al destino. */
export function etaHours(state: GameState, u: Unit): number {
  const stats = unitStats(state, u);
  let total = 0;
  let cur = u.province;
  for (let i = 0; i < u.path.length; i++) {
    const next = u.path[i];
    const edge = MAP.adjacency[cur].find((a) => a.to === next)?.edge;
    if (!edge) break;
    const h = edgeHours(state, u.owner, stats.speed, edge.length, edge.terrain, u.outOfSupply);
    total += i === 0 ? Math.max(0, h - u.moveProgress) : h;
    cur = next;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Control del territorio
// ---------------------------------------------------------------------------

export function relocateCapital(state: GameState, f: FactionId) {
  const c = state.countries[f];
  if (state.provinces[c.capital]?.controller === f && state.stations[c.capital]?.owner === f) return;
  const candidates = ownedStations(state, f).filter((s) => state.provinces[s].controller === f);
  if (candidates.length === 0) return;
  candidates.sort((a, b) => STATIONS[b].victoryPoints - STATIONS[a].victoryPoints || state.stations[b].population - state.stations[a].population);
  const old = c.capital;
  c.capital = candidates[0];
  addLog(state, { text: `${factionName(f)} traslada su capital de ${stationName(old)} a ${stationName(c.capital)}.`, kind: 'malo', faction: f });
}

/** Tras un cambio de paz, devuelve el control de túneles y estaciones a sus dueños cuando ya no hay guerra entre ellos. */
export function normalizeControl(state: GameState) {
  const owners: Record<string, FactionId | null> = {};
  for (const sid of Object.keys(state.stations)) owners[sid] = state.stations[sid].owner;
  const natural = initialControllers(owners);
  for (const [pid, p] of Object.entries(state.provinces)) {
    const isStation = MAP.provinces[pid].kind === 'estacion';
    const target = isStation ? state.stations[pid].owner : natural[pid] ?? null;
    if (p.controller === target) continue;
    if (p.controller && !state.countries[p.controller].alive) {
      p.controller = target;
      continue;
    }
    if (p.controller && target && isAtWarWith(state, p.controller, target)) continue;
    if (!isStation && p.controller && !target) {
      // Tierra de nadie: se queda con quien la ocupa solo si está en guerra con alguien cercano.
      p.controller = target;
      continue;
    }
    if (isStation && p.controller && target && friendly(state, p.controller, target)) {
      p.controller = target;
      continue;
    }
    p.controller = target;
  }
  expelUnits(state);
}

// ---------------------------------------------------------------------------
// Frente: control de los túneles
// ---------------------------------------------------------------------------

let nearestCache: { key: string; map: Record<string, string | null> } | null = null;

/** Estación más cercana a cada túnel (sin atravesar otras estaciones ni derrumbes). */
export function nearestStations(state: GameState): Record<string, string | null> {
  const key = state.openEdges.join(',') + '|' + MAP.provinceList.filter((p) => state.provinces[p.id].collapsed).map((p) => p.id).join(',');
  if (nearestCache?.key === key) return nearestCache.map;
  const dist: Record<string, number> = {};
  const from: Record<string, string> = {};
  const open = new Set<string>();
  for (const sid of Object.keys(state.stations)) {
    dist[sid] = 0;
    from[sid] = sid;
    open.add(sid);
  }
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const id of open) {
      if (dist[id] < best) {
        best = dist[id];
        cur = id;
      }
    }
    open.delete(cur);
    for (const n of neighbors(state, cur)) {
      if (MAP.provinces[n.to].kind === 'estacion' || MAP.provinces[n.to].terrain === 'derrumbe' || state.provinces[n.to].collapsed) continue;
      const nd = best + n.length;
      if (dist[n.to] === undefined || nd < dist[n.to]) {
        dist[n.to] = nd;
        from[n.to] = from[cur];
        open.add(n.to);
      }
    }
  }
  const map: Record<string, string | null> = {};
  for (const p of MAP.provinceList) if (p.kind !== 'estacion') map[p.id] = from[p.id] ?? null;
  nearestCache = { key, map };
  return map;
}

/**
 * En guerra, un túnel vacío pertenece a quien controla la estación más cercana. Solo se conserva un
 * túnel "del otro lado" mientras haya tropas propias dentro o justo al lado (una columna que avanza
 * mantiene abierta su retaguardia inmediata). Así el frente sigue a las estaciones y a las tropas,
 * y no quedan túneles ocupados por nadie que encierran o aíslan a nadie.
 */
export function dailyFrontControl(state: GameState) {
  if (state.wars.length === 0) return;
  const nearest = nearestStations(state);
  const present = new Map<string, Set<FactionId>>();
  for (const u of Object.values(state.units)) {
    if (!present.has(u.province)) present.set(u.province, new Set());
    present.get(u.province)!.add(u.owner);
  }
  const holds = (pid: string, f: FactionId, enemy: FactionId) =>
    [...(present.get(pid) ?? [])].some((o) => o === f || (friendly(state, o, f) && isAtWarWith(state, o, enemy)));
  for (const [pid, sid] of Object.entries(nearest)) {
    if (!sid) continue;
    const p = state.provinces[pid];
    const x = p.controller;
    const y = state.provinces[sid].controller;
    if (!x || !y || x === y || !isAtWarWith(state, x, y)) continue;
    if (present.get(pid)?.size) continue;
    if (neighbors(state, pid).some((n) => holds(n.to, x, y))) continue;
    p.controller = y;
  }
}

/** Las unidades que quedan en territorio sin acceso vuelven a su capital. */
export function expelUnits(state: GameState) {
  for (const u of Object.values(state.units)) {
    const ctrl = state.provinces[u.province].controller;
    if (!ctrl || ctrl === u.owner) continue;
    if (hasAccess(state, u.owner, ctrl) || isAtWarWith(state, u.owner, ctrl)) continue;
    const cap = state.countries[u.owner].capital;
    u.province = cap;
    u.path = [];
    u.moveProgress = 0;
    u.battle = null;
  }
}

// ---------------------------------------------------------------------------
// Suministro, desgaste y refuerzos (diario)
// ---------------------------------------------------------------------------

/**
 * Estaciones que abastecen a una facción. El suministro circula por provincias propias, aliadas, de
 * quien nos da acceso o de nadie. Una zona así conectada se abastece si contiene una capital (propia
 * o aliada) o al menos dos estaciones; una estación sola y rodeada queda sin suministro.
 * `blocked` permite simular el corte de ciertos túneles (lo usa la IA para planear cercos).
 */
export function supplySources(state: GameState, f: FactionId, blocked?: Set<string>): Set<string> {
  const open = (pid: string) => {
    if (!provincePassable(state, pid) || blocked?.has(pid)) return false;
    const ctrl = state.provinces[pid].controller;
    return !ctrl || hasAccess(state, f, ctrl);
  };
  const capitals = new Set<string>();
  for (const o of Object.keys(state.countries) as FactionId[]) {
    const oc = state.countries[o];
    if (oc.alive && (o === f || friendly(state, f, o))) capitals.add(oc.capital);
  }
  const friendlyStation = (sid: string) => {
    const ctrl = state.provinces[sid].controller;
    return !!ctrl && friendly(state, f, ctrl) && open(sid);
  };
  const sources = new Set<string>();
  const seen = new Set<string>();
  for (const start of Object.keys(state.stations)) {
    if (seen.has(start) || !friendlyStation(start)) continue;
    // Componente conectada de la estación.
    const comp: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const cur = queue.shift()!;
      comp.push(cur);
      for (const n of neighbors(state, cur)) {
        if (seen.has(n.to) || !open(n.to)) continue;
        seen.add(n.to);
        queue.push(n.to);
      }
    }
    const stations = comp.filter((pid) => state.stations[pid] && friendlyStation(pid));
    if (stations.length >= 2 || stations.some((sid) => capitals.has(sid))) for (const sid of stations) sources.add(sid);
  }
  return sources;
}

export function suppliedProvinces(state: GameState, f: FactionId): Set<string> {
  const range = 3 + Math.round(mod(state, f, 'rangoSuministro'));
  const out = new Set<string>();
  const queue: { id: string; left: number }[] = [];
  // Una estación cercada, sola, no abastece a nadie (ni siquiera a su guarnición).
  for (const sid of supplySources(state, f)) {
    const infra = state.stations[sid].buildings.infraestructura;
    queue.push({ id: sid, left: range + Math.floor(infra / 2) });
    out.add(sid);
  }
  const bestLeft: Record<string, number> = {};
  while (queue.length) {
    const { id, left } = queue.shift()!;
    if (left <= 0) continue;
    for (const n of neighbors(state, id)) {
      if (!provincePassable(state, n.to)) continue;
      const ctrl = state.provinces[n.to].controller;
      if (ctrl && !hasAccess(state, f, ctrl)) continue;
      const l = left - (AUX_TERRAINS.has(n.terrain) || n.terrain === 'peligroso' ? 1.5 : 1);
      if ((bestLeft[n.to] ?? -Infinity) >= l) continue;
      bestLeft[n.to] = l;
      out.add(n.to);
      queue.push({ id: n.to, left: l });
    }
  }
  return out;
}

export function dailyUnits(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const supplied = suppliedProvinces(state, f);
  const atricionMod = Math.max(0, 1 + mod(state, f, 'atricion'));
  const reinforceMod = 1 + mod(state, f, 'reforzar');
  const units = unitsOf(state, f);
  // Refuerzos: se reparten mano de obra y equipo disponibles.
  let manpowerLeft = c.derived.manpowerAvailable;
  for (const u of units) {
    const stats = unitStats(state, u);
    u.outOfSupply = !supplied.has(u.province);
    const prov = state.provinces[u.province];
    const terrain = MAP.provinces[u.province].terrain;
    const tInfo = TERRAIN_INFO[terrain];
    // Desgaste por túneles peligrosos
    if (tInfo.attrition > 0 && prov.danger > 0) {
      const loss = 0.02 * tInfo.attrition * (prov.danger / 100) * atricionMod * (1 - stats.attritionReduction);
      applyLoss(state, u, loss, stats);
      u.org = Math.max(0, u.org - stats.org * loss);
      // Emboscadas mutantes
      if (prov.danger >= 30 && chance(state, (prov.danger / 100) * 0.02 * (1 - stats.attritionReduction))) {
        const hit = 0.04 + rand(state) * 0.05;
        applyLoss(state, u, hit, stats);
        u.org *= 0.55;
        if (state.player === f) {
          addLog(state, { text: `¡Mutantes! ${u.name} sufre una emboscada en ${provinceName(u.province)}.`, kind: 'malo', faction: f, province: u.province });
        }
      }
    }
    if (u.outOfSupply) {
      applyLoss(state, u, 0.012, stats);
      u.org = Math.max(0, u.org - stats.org * 0.08);
    } else if (!u.battle && u.strength < 1 && manpowerLeft > 0) {
      const rate = Math.min(1 - u.strength, 0.05 * reinforceMod * (1 + stats.reinforce));
      let ratio = 1;
      const menNeeded = stats.men * rate;
      if (menNeeded > 0) ratio = Math.min(ratio, manpowerLeft / menNeeded);
      for (const eq of EQUIPMENT_IDS) {
        const need = stats.equipment[eq] * rate;
        if (need > 0) ratio = Math.min(ratio, c.stockpile[eq] / need);
      }
      ratio = clamp(ratio, 0, 1);
      if (ratio > 0) {
        u.strength = Math.min(1, u.strength + rate * ratio);
        manpowerLeft -= menNeeded * ratio;
        for (const eq of EQUIPMENT_IDS) c.stockpile[eq] = Math.max(0, c.stockpile[eq] - stats.equipment[eq] * rate * ratio);
      }
    }
    if (u.strength <= 0.05) {
      addLog(state, { text: `${u.name} (${factionName(f)}) ha sido aniquilado en ${provinceName(u.province)}.`, kind: 'guerra', faction: f, province: u.province });
      removeUnit(state, u.id);
    }
  }
}

/** Pérdida de fuerza (fracción) con bajas reales y equipo perdido. */
export function applyLoss(state: GameState, u: Unit, fraction: number, stats?: UnitStats) {
  if (fraction <= 0) return;
  const s = stats ?? unitStats(state, u);
  const f = Math.min(u.strength, fraction);
  u.strength -= f;
  killMen(state, u.owner, s.men * f);
}

/** Días que tarda una unidad inmóvil en atrincherarse del todo. */
export const DIG_DAYS = 8;

export function hourlyOrg(state: GameState) {
  for (const u of Object.values(state.units)) {
    // Atrincheramiento: crece mientras la unidad no se mueve ni ataca.
    if (u.path.length > 0 || u.retreating) u.dug = 0;
    else if ((u.dug ?? 0) < 1) u.dug = Math.min(1, (u.dug ?? 0) + 1 / (DIG_DAYS * 24));
    if (u.battle) continue;
    const stats = unitStats(state, u);
    if (u.org >= stats.org) {
      u.org = stats.org;
      continue;
    }
    const rec = 0.03 * (1 + mod(state, u.owner, 'recuperacionOrg')) * (u.outOfSupply ? 0.2 : 1) * (u.path.length ? 0.5 : 1);
    u.org = Math.min(stats.org, u.org + stats.org * rec);
  }
}

// ---------------------------------------------------------------------------
// Reclutamiento
// ---------------------------------------------------------------------------

export function recruitDays(state: GameState, f: FactionId): number {
  return RECRUIT_DAYS / Math.max(0.3, 1 + mod(state, f, 'entrenamiento'));
}

export function canRecruit(state: GameState, f: FactionId, templateId: string): { ok: boolean; reason?: string } {
  const tpl = templateById(state, f, templateId);
  if (!tpl) return { ok: false, reason: 'Plantilla desconocida' };
  const stats = templateStats(state, f, tpl);
  if (state.countries[f].derived.manpowerAvailable < stats.men) return { ok: false, reason: `Necesitas ${Math.ceil(stats.men)} hombres disponibles` };
  return { ok: true };
}

export function recruit(state: GameState, f: FactionId, templateId: string, station?: string): boolean {
  if (!canRecruit(state, f, templateId).ok) return false;
  const c = state.countries[f];
  const tpl = templateById(state, f, templateId)!;
  const stats = templateStats(state, f, tpl);
  const where = station && state.provinces[station]?.controller === f ? station : c.capital;
  c.recruitment.push({ id: newId(state, 'r'), template: tpl.id, station: where, progress: 0, men: stats.men });
  c.derived.manpowerAvailable -= stats.men;
  c.derived.manpowerUsed += stats.men;
  return true;
}

export function cancelRecruit(state: GameState, f: FactionId, id: string) {
  const c = state.countries[f];
  c.recruitment = c.recruitment.filter((r) => r.id !== id);
}

export function dailyRecruitment(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const total = recruitDays(state, f);
  const done: string[] = [];
  for (const r of c.recruitment) {
    r.progress += 1;
    if (r.progress >= total) done.push(r.id);
  }
  for (const id of done) {
    const r = c.recruitment.find((x) => x.id === id)!;
    c.recruitment = c.recruitment.filter((x) => x.id !== id);
    const tpl = templateById(state, f, r.template);
    if (!tpl) continue;
    const stats = templateStats(state, f, tpl);
    let ratio = 1;
    for (const eq of EQUIPMENT_IDS) {
      if (stats.equipment[eq] > 0) ratio = Math.min(ratio, c.stockpile[eq] / stats.equipment[eq]);
    }
    ratio = clamp(ratio, 0.25, 1);
    for (const eq of EQUIPMENT_IDS) c.stockpile[eq] = Math.max(0, c.stockpile[eq] - stats.equipment[eq] * ratio);
    const where = state.provinces[r.station]?.controller === f ? r.station : c.capital;
    const u = spawnUnit(state, f, r.template, where, { strength: ratio });
    if (u && state.player === f) {
      addLog(state, {
        text: `${u.name} completa su instrucción en ${stationName(where)}${ratio < 0.99 ? ` (equipada al ${Math.round(ratio * 100)} %)` : ''}.`,
        kind: 'bueno',
        quiet: true,
        faction: f,
        province: where,
      });
    }
  }
}

export function equipmentNeeds(state: GameState, f: FactionId): Record<EquipmentId, number> {
  const need = emptyEquipment();
  for (const u of unitsOf(state, f)) {
    const stats = unitStats(state, u);
    for (const eq of EQUIPMENT_IDS) need[eq] += stats.equipment[eq] * (1 - u.strength);
  }
  for (const r of state.countries[f].recruitment) {
    const tpl = templateById(state, f, r.template);
    if (!tpl) continue;
    const stats = templateStats(state, f, tpl);
    for (const eq of EQUIPMENT_IDS) need[eq] += stats.equipment[eq];
  }
  return need;
}
