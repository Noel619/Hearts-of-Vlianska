// Economía diaria: talleres, construcción, producción, recursos, comercio, comida y mano de obra.
import { BUILDINGS, EQUIPMENT, FOOD_BASE_PER_POP, FOOD_PER_FARM, FOOD_PER_POP, LAWS, MAP, MAX_CIV_PER_PROJECT, STATIONS } from '../data';
import type { BuildingId, CountryDerived, EquipmentId, FactionId, GameState, ResourceId } from './types';
import { RESOURCE_IDS } from './types';
import { addLog, aliveFactions, clamp, embargoed, factionName, isAtWarWith, newId, stationName, tradeRouteExists } from './helpers';
import { getMods, mod } from './modifiers';
import { equipmentLevel } from './research';
import { equipmentNeeds, unitsOf, unitStats } from './military';

export const BASE_PP = 1.5;
export const TRADE_CIV_PER_UNIT = 0.5;
export const BASE_EFFICIENCY_CAP = 0.5;
export const START_EFFICIENCY = 0.1;

/** Qué parte de una estación aprovecha una facción (1 = propia y controlada). */
export function contribution(state: GameState, sid: string, f: FactionId): number {
  const st = state.stations[sid];
  const ctrl = state.provinces[sid].controller;
  if (ctrl !== f) return 0;
  if (st.owner === f) return st.cores.includes(f) ? 1 : 0.5;
  return 0.35; // ocupación militar
}

export function emptyDerived(): CountryDerived {
  const res = () => ({ produced: 0, imported: 0, exported: 0, used: 0, available: 0 });
  return {
    ppGain: 0,
    stability: 0.5,
    warSupport: 0.5,
    civTotal: 0,
    civConsumer: 0,
    civTrade: 0,
    civAvailable: 0,
    milTotal: 0,
    milAssigned: 0,
    manpowerMax: 0,
    manpowerUsed: 0,
    manpowerAvailable: 0,
    foodProd: 0,
    foodCons: 0,
    foodTrade: 0,
    famine: 0,
    resources: { chatarra: res(), polvora: res(), combustible: res() },
    resourceRatio: { chatarra: 1, polvora: 1, combustible: 1 },
    population: 0,
    researchSpeed: 1,
    surrenderLimit: 0.8,
    equipmentNeed: { armas: 0, apoyo: 0, morteros: 0, lanzallamas: 0, draisinas: 0 },
  };
}

export function equipmentCost(state: GameState, f: FactionId, eq: EquipmentId): number {
  return EQUIPMENT[eq].cost * (1 + 0.2 * (equipmentLevel(state, f, eq) - 1));
}

export function exportShare(state: GameState, f: FactionId): number {
  return LAWS[state.countries[f].laws.comercio]?.value ?? 0.5;
}

export function resourceProduced(state: GameState, f: FactionId, res: ResourceId): number {
  const bonus = 1 + mod(state, f, 'recursos');
  let total = 0;
  for (const sid of Object.keys(state.stations)) {
    const k = contribution(state, sid, f);
    if (k <= 0) continue;
    const st = state.stations[sid];
    total += st.resources[res] * k * (1 + 0.05 * st.buildings.infraestructura);
  }
  return total * Math.max(0, bonus);
}

/** Recursos que otros ya nos compran. */
export function resourceExported(state: GameState, f: FactionId, res: ResourceId | 'alimentos'): number {
  let total = 0;
  for (const other of aliveFactions(state)) {
    if (other === f) continue;
    for (const t of state.countries[other].trades) if (t.partner === f && t.resource === res) total += t.amount;
  }
  return total;
}

export function exportable(state: GameState, f: FactionId, res: ResourceId | 'alimentos'): number {
  const c = state.countries[f];
  if (res === 'alimentos') {
    const surplus = c.derived.foodProd - c.derived.foodCons;
    return Math.max(0, surplus * exportShare(state, f) - resourceExported(state, f, 'alimentos'));
  }
  return Math.max(0, resourceProduced(state, f, res) * exportShare(state, f) - resourceExported(state, f, res));
}

export function updateDerived(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const m = getMods(state, f);
  const d = c.derived ?? emptyDerived();
  // Población y comida
  let population = 0;
  let foodProd = 0;
  let foodCons = 0;
  let civ = 0;
  let mil = 0;
  let recruitable = 0;
  const lawRate = LAWS[c.laws.reclutamiento]?.value ?? 0.07;
  for (const sid of Object.keys(state.stations)) {
    const k = contribution(state, sid, f);
    if (k <= 0) continue;
    const st = state.stations[sid];
    if (st.owner === f) population += st.population;
    civ += st.buildings.civil * k;
    mil += st.buildings.militar * k;
    foodProd += (st.buildings.granja * FOOD_PER_FARM + st.population * FOOD_BASE_PER_POP) * k;
    foodCons += st.population * FOOD_PER_POP * k;
    const manK = st.owner === f ? (st.cores.includes(f) ? 1 : 0.25) : 0.08;
    recruitable += st.population * manK;
  }
  foodProd *= Math.max(0, 1 + (m.alimentos ?? 0));
  foodCons *= Math.max(0.3, 1 + (m.consumoAlimentos ?? 0));
  const foodImport = c.trades.filter((t) => t.resource === 'alimentos').reduce((s, t) => s + t.amount, 0);
  const foodExport = resourceExported(state, f, 'alimentos');
  d.population = population;
  d.foodProd = foodProd;
  d.foodCons = foodCons;
  d.foodTrade = foodImport - foodExport;

  // Estabilidad y apoyo a la guerra
  const famine = d.famine ?? 0;
  const popTotal = Math.max(1, population);
  const weariness = Math.min(0.25, (c.recentLosses / popTotal) * 4);
  let occupied = 0;
  let nonCore = 0;
  for (const sid of Object.keys(state.stations)) {
    const st = state.stations[sid];
    if (st.owner !== f && state.provinces[sid].controller === f) occupied++;
    if (st.owner === f && !st.cores.includes(f)) nonCore++;
  }
  d.stability = clamp(c.stabilityBase + (m.estabilidad ?? 0) - famine * 0.3 - occupied * 0.03 - nonCore * 0.02);
  const defensive = state.wars.some((w) => w.defenders.includes(f));
  d.warSupport = clamp(c.warSupportBase + (m.apoyoGuerra ?? 0) - famine * 0.15 - weariness + (defensive ? 0.1 : 0));

  // Talleres
  const stabPenalty = 1 - Math.max(0, 0.5 - d.stability) * 0.6;
  d.civTotal = Math.max(0, civ + (m.civExtra ?? 0));
  d.milTotal = Math.max(0, mil + (m.milExtra ?? 0)) * stabPenalty;
  const consumerRate = clamp((LAWS[c.laws.economia]?.value ?? 0.3) + (m.bienesConsumo ?? 0), 0, 0.9);
  d.civConsumer = d.civTotal * consumerRate;
  d.civTrade = c.trades.reduce((s, t) => s + t.amount * TRADE_CIV_PER_UNIT, 0);
  let exportIncome = 0;
  for (const res of [...RESOURCE_IDS, 'alimentos'] as const) exportIncome += resourceExported(state, f, res) * TRADE_CIV_PER_UNIT;
  // Protectorados: el señor se queda con parte de sus talleres.
  let subjectIncome = 0;
  for (const other of aliveFactions(state)) {
    if (state.countries[other].overlord === f) subjectIncome += (state.countries[other].derived?.civTotal ?? 0) * 0.25;
  }
  const tribute = c.overlord ? d.civTotal * 0.25 : 0;
  d.civAvailable = Math.max(0, (d.civTotal - d.civConsumer - d.civTrade + exportIncome + subjectIncome - tribute) * stabPenalty);

  // Recursos
  let assigned = 0;
  for (const l of c.production) assigned += l.factories;
  d.milAssigned = assigned;
  const scale = assigned > 0 ? Math.min(1, d.milTotal / assigned) : 1;
  for (const res of RESOURCE_IDS) {
    const produced = resourceProduced(state, f, res);
    const imported = c.trades.filter((t) => t.resource === res).reduce((s, t) => s + t.amount, 0);
    const exported = resourceExported(state, f, res);
    let used = 0;
    for (const l of c.production) used += (EQUIPMENT[l.equipment].resources[res] ?? 0) * l.factories * scale;
    const available = produced + imported - exported;
    d.resources[res] = { produced, imported, exported, used, available };
    d.resourceRatio[res] = used > 0 ? clamp(available / used) : 1;
  }

  // Mano de obra
  d.manpowerMax = Math.max(0, recruitable * (lawRate + (m.reclutables ?? 0)) * Math.max(0.1, 1 + (m.manoObra ?? 0)) + c.manpowerBonus);
  let used = 0;
  for (const u of unitsOf(state, f)) used += unitStats(state, u).men * u.strength;
  for (const r of c.recruitment) used += r.men;
  for (const a of c.activeDecisions) used += a.manpower ?? 0;
  d.manpowerUsed = used;
  d.manpowerAvailable = Math.max(0, d.manpowerMax - used);

  // Poder político
  const stabFactor = 1 + (d.stability - 0.5) * 0.6;
  d.ppGain = Math.max(0, (BASE_PP + (m.ppDiario ?? 0)) * stabFactor);
  d.researchSpeed = Math.max(0.1, 1 + (m.investigacion ?? 0));
  d.equipmentNeed = equipmentNeeds(state, f);
  c.derived = d;
}

export function dailyEconomy(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const d = c.derived;
  const m = getMods(state, f);

  c.pp = Math.min(999, c.pp + d.ppGain);

  // Construcción
  let civLeft = d.civAvailable;
  const speed = Math.max(0.1, 1 + (m.construccion ?? 0) + (m.produccionCivil ?? 0));
  const finished: string[] = [];
  for (const item of c.construction) {
    if (civLeft <= 0) break;
    const civ = Math.min(MAX_CIV_PER_PROJECT, civLeft);
    civLeft -= civ;
    const stationId = MAP.provinces[item.location]?.kind === 'estacion' ? item.location : null;
    const infra = stationId ? state.stations[stationId].buildings.infraestructura : 0;
    // Solo se construye en lo que controlamos.
    if (state.provinces[item.location]?.controller !== f) continue;
    item.progress += civ * speed * (1 + 0.1 * infra);
    if (item.progress >= BUILDINGS[item.building].cost) finished.push(item.id);
  }
  for (const id of finished) {
    const item = c.construction.find((x) => x.id === id)!;
    c.construction = c.construction.filter((x) => x.id !== id);
    completeBuilding(state, f, item.building, item.location);
  }

  // Producción
  let assigned = 0;
  for (const l of c.production) assigned += l.factories;
  const scale = assigned > 0 ? Math.min(1, d.milTotal / assigned) : 1;
  const cap = clamp(BASE_EFFICIENCY_CAP + (m.eficienciaMax ?? 0), 0.1, 1);
  const gain = 0.03 * Math.max(0.1, 1 + (m.eficienciaGanancia ?? 0));
  const out = 1 + (m.produccionMilitar ?? 0);
  for (const l of c.production) {
    if (l.factories <= 0) continue;
    let resRatio = 1;
    for (const [res, need] of Object.entries(EQUIPMENT[l.equipment].resources) as [ResourceId, number][]) {
      if (need > 0) resRatio = Math.min(resRatio, d.resourceRatio[res]);
    }
    const produced = (l.factories * scale * l.efficiency * Math.max(0, out) * (0.25 + 0.75 * resRatio)) / equipmentCost(state, f, l.equipment);
    c.stockpile[l.equipment] += produced;
    if (l.efficiency < cap) l.efficiency = Math.min(cap, l.efficiency + (cap - l.efficiency) * gain + 0.002);
    else l.efficiency = cap;
  }

  // Comida
  const balance = d.foodProd - d.foodCons + d.foodTrade;
  const capacity = Math.max(150, d.foodCons * 40);
  c.food = clamp(c.food + balance, 0, capacity);
  if (c.food <= 0 && balance < 0) {
    d.famine = clamp(-balance / Math.max(1, d.foodCons));
    for (const sid of Object.keys(state.stations)) {
      const st = state.stations[sid];
      if (st.owner === f) st.population = Math.max(0, st.population * (1 - d.famine * 0.002));
    }
  } else {
    d.famine = Math.max(0, (d.famine ?? 0) - 0.05);
  }
  c.recentLosses *= 0.985;
}

export function monthlyPopulation(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const d = c.derived;
  if (d.famine > 0) return;
  const growth = 0.004 * (1 + mod(state, f, 'crecimientoPoblacion')) * (d.stability > 0.3 ? 1 : 0.3);
  for (const sid of Object.keys(state.stations)) {
    const st = state.stations[sid];
    if (st.owner !== f || state.provinces[sid].controller !== f) continue;
    const cap = Math.max(STATIONS[sid].population * 1.6, 250);
    st.population = clamp(st.population * (1 + growth), 0, Math.max(cap, st.population));
  }
}

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

export function slotsUsed(state: GameState, sid: string, f?: FactionId): number {
  const st = state.stations[sid];
  let used = st.buildings.civil + st.buildings.militar + st.buildings.granja;
  if (f) {
    for (const item of state.countries[f].construction) {
      if (item.location === sid && BUILDINGS[item.building].usesSlot) used++;
    }
  }
  return used;
}

export function canBuild(state: GameState, f: FactionId, building: BuildingId, location: string): { ok: boolean; reason?: string } {
  const p = state.provinces[location];
  if (!p || p.controller !== f) return { ok: false, reason: 'Solo puedes construir en territorio que controlas.' };
  const isStation = MAP.provinces[location].kind === 'estacion';
  const c = state.countries[f];
  const queued = c.construction.filter((x) => x.location === location && x.building === building).length;
  if (building === 'fortificacion') {
    if (p.collapsed) return { ok: false, reason: 'No se puede fortificar un derrumbe.' };
    if (p.fort + queued >= BUILDINGS.fortificacion.max) return { ok: false, reason: 'Nivel máximo de barricadas.' };
    return { ok: true };
  }
  if (!isStation) return { ok: false, reason: 'Solo se puede construir en estaciones.' };
  const st = state.stations[location];
  if (st.owner !== f) return { ok: false, reason: 'La estación no es tuya.' };
  if (building === 'infraestructura') {
    if (st.buildings.infraestructura + queued >= BUILDINGS.infraestructura.max) return { ok: false, reason: 'Infraestructura al máximo.' };
    return { ok: true };
  }
  if (slotsUsed(state, location, f) >= st.slots) return { ok: false, reason: 'No quedan espacios de construcción en la estación.' };
  return { ok: true };
}

export function queueBuilding(state: GameState, f: FactionId, building: BuildingId, location: string): boolean {
  if (!canBuild(state, f, building, location).ok) return false;
  state.countries[f].construction.push({ id: newId(state, 'c'), building, location, progress: 0 });
  return true;
}

export function cancelBuilding(state: GameState, f: FactionId, id: string) {
  const c = state.countries[f];
  c.construction = c.construction.filter((x) => x.id !== id);
}

export function moveBuilding(state: GameState, f: FactionId, id: string, dir: -1 | 1) {
  const list = state.countries[f].construction;
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

function completeBuilding(state: GameState, f: FactionId, building: BuildingId, location: string) {
  if (building === 'fortificacion') {
    state.provinces[location].fort = Math.min(5, state.provinces[location].fort + 1);
  } else {
    const st = state.stations[location];
    if (!st) return;
    st.buildings[building] += 1;
  }
  if (state.player === f) {
    addLog(state, { text: `Construcción terminada: ${BUILDINGS[building].name} en ${stationName(location)}.`, kind: 'bueno', faction: f, province: location });
  }
}

export function buildDaysLeft(state: GameState, f: FactionId, index: number): number | null {
  const c = state.countries[f];
  const m = getMods(state, f);
  const speed = Math.max(0.1, 1 + (m.construccion ?? 0) + (m.produccionCivil ?? 0));
  let civLeft = c.derived.civAvailable;
  for (let i = 0; i < c.construction.length; i++) {
    const civ = Math.min(MAX_CIV_PER_PROJECT, Math.max(0, civLeft));
    civLeft -= civ;
    if (i === index) {
      const item = c.construction[i];
      const sid = MAP.provinces[item.location]?.kind === 'estacion' ? item.location : null;
      const infra = sid ? state.stations[sid].buildings.infraestructura : 0;
      const perDay = civ * speed * (1 + 0.1 * infra);
      if (perDay <= 0) return null;
      return (BUILDINGS[item.building].cost - item.progress) / perDay;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Producción
// ---------------------------------------------------------------------------

export function addProductionLine(state: GameState, f: FactionId, eq: EquipmentId, factories = 1) {
  const c = state.countries[f];
  c.production.push({ id: newId(state, 'l'), equipment: eq, factories, efficiency: START_EFFICIENCY });
}

export function setLineFactories(state: GameState, f: FactionId, id: string, factories: number) {
  const l = state.countries[f].production.find((x) => x.id === id);
  if (l) l.factories = Math.max(0, Math.min(15, Math.round(factories)));
}

export function removeProductionLine(state: GameState, f: FactionId, id: string) {
  const c = state.countries[f];
  c.production = c.production.filter((x) => x.id !== id);
}

export function lineOutput(state: GameState, f: FactionId, id: string): number {
  const c = state.countries[f];
  const l = c.production.find((x) => x.id === id);
  if (!l) return 0;
  const d = c.derived;
  const scale = d.milAssigned > 0 ? Math.min(1, d.milTotal / d.milAssigned) : 1;
  let resRatio = 1;
  for (const [res, need] of Object.entries(EQUIPMENT[l.equipment].resources) as [ResourceId, number][]) {
    if (need > 0) resRatio = Math.min(resRatio, d.resourceRatio[res]);
  }
  return (l.factories * scale * l.efficiency * Math.max(0, 1 + mod(state, f, 'produccionMilitar')) * (0.25 + 0.75 * resRatio)) / equipmentCost(state, f, l.equipment);
}

// ---------------------------------------------------------------------------
// Comercio
// ---------------------------------------------------------------------------

export function canTrade(state: GameState, f: FactionId, partner: FactionId, res: ResourceId | 'alimentos', amount: number): { ok: boolean; reason?: string } {
  if (f === partner || !state.countries[partner].alive) return { ok: false, reason: 'Socio no válido.' };
  if (isAtWarWith(state, f, partner)) return { ok: false, reason: 'Estáis en guerra.' };
  if (embargoed(state, f, partner)) return { ok: false, reason: 'Hay un embargo entre vosotros.' };
  if (!tradeRouteExists(state, f, partner)) return { ok: false, reason: 'No hay ninguna ruta de caravanas segura.' };
  if (exportable(state, partner, res) + 1e-6 < amount) return { ok: false, reason: 'No tiene tanto excedente para vender.' };
  if ((state.countries[partner].relations[f] ?? 0) < -40) return { ok: false, reason: 'Se niega a comerciar con nosotros.' };
  return { ok: true };
}

export function addTrade(state: GameState, f: FactionId, partner: FactionId, res: ResourceId | 'alimentos', amount: number): boolean {
  if (!canTrade(state, f, partner, res, amount).ok) return false;
  const c = state.countries[f];
  const existing = c.trades.find((t) => t.partner === partner && t.resource === res);
  if (existing) existing.amount += amount;
  else c.trades.push({ id: newId(state, 't'), partner, resource: res, amount });
  return true;
}

export function cancelTrade(state: GameState, f: FactionId, id: string) {
  const c = state.countries[f];
  c.trades = c.trades.filter((t) => t.id !== id);
}

export function validateTrades(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const keep = [];
  for (const t of c.trades) {
    const partner = state.countries[t.partner];
    const broken =
      !partner.alive || isAtWarWith(state, f, t.partner) || embargoed(state, f, t.partner) || !tradeRouteExists(state, f, t.partner);
    if (broken) {
      if (state.player === f) addLog(state, { text: `Se cancela el comercio con ${factionName(t.partner)}: la ruta ya no es segura.`, kind: 'malo', faction: f });
      continue;
    }
    keep.push(t);
  }
  c.trades = keep;
}

export function stationFood(state: GameState, sid: string): { prod: number; cons: number } {
  const st = state.stations[sid];
  return { prod: st.buildings.granja * FOOD_PER_FARM + st.population * FOOD_BASE_PER_POP, cons: st.population * FOOD_PER_POP };
}

