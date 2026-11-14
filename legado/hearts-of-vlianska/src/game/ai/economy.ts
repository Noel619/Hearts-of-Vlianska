// IA: enfoques, investigación, leyes, asesores, construcción, producción, comercio, plantillas y reclutamiento.
import { ADVISOR_BY_ID, FACTIONS, LAWS, MAP, MILITARY_SLOTS, POLITICAL_SLOTS, lawsOfGroup } from '../../data';
import type { EquipmentId, FactionId, GameState, ModifierKey, ResourceId, TechCategory } from '../types';
import { EQUIPMENT_IDS, RESOURCE_IDS } from '../types';
import { aliveFactions, isAtWar, neighbors, ownedStations, relation } from '../helpers';
import { aiFocusWeight, availableFocuses, startFocus } from '../focus';
import { availableTechs, researchCost, startResearch, templateSlots, unlockedBattalions } from '../research';
import { advisorCost, availableAdvisors, canEnactLaw, enactLaw, hireAdvisor, lawCost } from '../politics';
import { addProductionLine, addTrade, canBuild, canTrade, exportable, queueBuilding, removeProductionLine, slotsUsed } from '../economy';
import { canRecruit, recruit, saveTemplate, templateById, templateStats, unitsOf } from '../military';
import { canTakeDecision, decisionTargets, visibleDecisions, takeDecision } from '../decisions';
import { rand, weightedPick } from '../rng';
import { yearOf } from '../time';

const DOCTRINE: Record<FactionId, 'def' | 'asa' | 'gue'> = {
  UNI: 'def',
  SDR: 'asa',
  LEV: 'def',
  STA: 'def',
  VHL: 'gue',
  CHE: 'asa',
  CAL: 'def',
  NOR: 'gue',
};

const CAT_WEIGHT: Record<FactionId, Partial<Record<TechCategory, number>>> = {
  UNI: { industria: 1.3, armamento: 1.2, apoyo: 1.1 },
  SDR: { vehiculos: 1.4, armamento: 1.3, industria: 1.2 },
  LEV: { industria: 1.2, supervivencia: 1.1, armamento: 1.2 },
  STA: { industria: 1.4, supervivencia: 1.1 },
  VHL: { armamento: 1.2, apoyo: 1.3, supervivencia: 1.1 },
  CHE: { industria: 1.5, armamento: 1.1 },
  CAL: { supervivencia: 1.6, armamento: 1.1 },
  NOR: { supervivencia: 1.3, apoyo: 1.2, industria: 1.1 },
};

export function aiFocus(state: GameState, f: FactionId) {
  const c = state.countries[f];
  if (c.focus.current) return;
  const options = availableFocuses(state, f);
  if (options.length === 0) return;
  if (state.historicalAI) {
    let best = options[0];
    let bestW = -1;
    for (const o of options) {
      const w = aiFocusWeight(state, f, o) + rand(state) * 0.5;
      if (w > bestW) {
        bestW = w;
        best = o;
      }
    }
    startFocus(state, f, best.id);
    return;
  }
  const pick = weightedPick(
    state,
    options.map((o) => ({ item: o.id, weight: Math.max(0.5, aiFocusWeight(state, f, o)) })),
  );
  if (pick) startFocus(state, f, pick);
}

export function aiResearch(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const free = c.research.active.findIndex((a, i) => !a && i < c.research.slots);
  if (free < 0) return;
  const year = yearOf(state.hour);
  const famine = c.derived.famine > 0 || c.derived.foodProd < c.derived.foodCons;
  const pref = DOCTRINE[f];
  const cands = availableTechs(state, f).filter((t) => !c.research.active.some((a) => a?.tech === t.id));
  if (cands.length === 0) return;
  let best = cands[0];
  let bestScore = -Infinity;
  for (const t of cands) {
    let w = CAT_WEIGHT[f][t.cat] ?? 1;
    if (t.cat === 'doctrina') {
      if (t.id.startsWith(pref)) w *= 1.6;
      else if (/^(def|asa|gue)_/.test(t.id)) w *= 0.2;
    }
    if (famine && (t.id.startsWith('hongos') || t.id === 'cerdos' || t.id === 'hidroponia')) w *= 3;
    if (t.id === 'excavacion' && (f === 'CHE' || f === 'CAL')) w *= 2.5;
    if (t.unlocks?.battalions?.includes('draisina') && f !== 'SDR') w *= 0.7;
    if (t.year > year + 1) w *= 0.2;
    else if (t.year > year) w *= 0.6;
    const score = (w * 100) / researchCost(state, t) + rand(state) * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = t;
    }
  }
  startResearch(state, f, free, best.id);
}

export function aiLaws(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const threatened =
    isAtWar(state, f) ||
    c.wargoals.some((w) => w.ready) ||
    state.tension > 0.5 ||
    aliveFactions(state).some((o) => o !== f && state.countries[o].wargoals.some((w) => w.target === f));
  const tryLaw = (id: string) => {
    if (c.laws[LAWS[id].group] === id) return false;
    if (!canEnactLaw(state, f, id).ok) return false;
    if (c.pp < lawCost(state, f, id) + 20) return false;
    return enactLaw(state, f, id);
  };
  // Comida
  const balance = c.derived.foodProd - c.derived.foodCons + c.derived.foodTrade;
  if (c.derived.famine > 0 || (balance < 0 && c.food < 60)) {
    const order = lawsOfGroup('raciones');
    const cur = LAWS[c.laws.raciones].order;
    const next = order.find((l) => l.order === cur + 1);
    if (next && tryLaw(next.id)) return;
  } else if (balance > c.derived.foodCons * 0.25 && c.food > 150 && LAWS[c.laws.raciones].order > 1) {
    const cur = LAWS[c.laws.raciones].order;
    const prev = lawsOfGroup('raciones').find((l) => l.order === cur - 1);
    if (prev && tryLaw(prev.id)) return;
  }
  // Reclutamiento
  const tpl = bestTemplateMen(state, f);
  if (threatened && c.derived.manpowerAvailable < tpl * 1.5) {
    const cur = LAWS[c.laws.reclutamiento].order;
    const next = lawsOfGroup('reclutamiento').find((l) => l.order === cur + 1);
    if (next && next.id !== 'rec_total' && tryLaw(next.id)) return;
  }
  // Economía
  if (threatened) {
    const cur = LAWS[c.laws.economia].order;
    const next = lawsOfGroup('economia').find((l) => l.order === cur + 1);
    if (next && next.id !== 'eco_total' && tryLaw(next.id)) return;
  } else if (c.laws.economia === 'eco_civil' && yearOf(state.hour) >= 2034) {
    tryLaw('eco_parcial');
  }
}

function bestTemplateMen(state: GameState, f: FactionId) {
  const tpl = pickTemplate(state, f);
  if (!tpl) return 30;
  return templateStats(state, f, tpl).men;
}

const ADVISOR_PREF: Partial<Record<ModifierKey, number>> = {
  produccionMilitar: 3,
  produccionCivil: 3,
  construccion: 3,
  investigacion: 2.5,
  estabilidad: 2,
  alimentos: 2,
  ataque: 2,
  defensa: 2,
  ppDiario: 2,
  entrenamiento: 1,
  apoyoGuerra: 1,
};

export function aiAdvisors(state: GameState, f: FactionId) {
  const c = state.countries[f];
  if (c.pp < 170) return;
  const politicalUsed = c.advisors.filter((a) => ADVISOR_BY_ID[a]?.slot === 'politico').length;
  const militaryUsed = c.advisors.filter((a) => ADVISOR_BY_ID[a]?.slot === 'militar').length;
  const war = isAtWar(state, f) || state.tension > 0.45;
  const cands = availableAdvisors(state, f).filter((a) => {
    if (c.advisors.includes(a.id)) return false;
    if (a.slot === 'politico' && politicalUsed >= POLITICAL_SLOTS) return false;
    if (a.slot === 'militar' && militaryUsed >= MILITARY_SLOTS) return false;
    if (a.slot === 'militar' && !war && militaryUsed >= 1) return false;
    return advisorCost(state, f, a.id) <= c.pp - 40;
  });
  if (cands.length === 0) return;
  const famine = c.derived.famine > 0;
  const score = (id: string) => {
    const a = ADVISOR_BY_ID[id];
    let s = a.faction ? 1.5 : 1;
    for (const [k, v] of Object.entries(a.modifiers) as [ModifierKey, number][]) {
      let w = ADVISOR_PREF[k] ?? 0.5;
      if (k === 'alimentos' && famine) w *= 3;
      if ((k === 'ataque' || k === 'defensa') && war) w *= 1.5;
      s += Math.abs(v) * w * 10 * Math.sign(v === 0 ? 1 : v);
    }
    return s;
  };
  cands.sort((a, b) => score(b.id) - score(a.id));
  hireAdvisor(state, f, cands[0].id);
}

export function aiConstruction(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const maxQueue = Math.max(2, Math.ceil(c.derived.civAvailable / 5) + 1);
  const war = isAtWar(state, f) || aliveFactions(state).some((o) => o !== f && state.countries[o].wargoals.some((w) => w.target === f));
  const year = yearOf(state.hour);
  let guard = 0;
  while (c.construction.length < maxQueue && guard++ < 5) {
    const balance = c.derived.foodProd - c.derived.foodCons + c.derived.foodTrade;
    let building: 'civil' | 'militar' | 'granja' | 'infraestructura' | 'fortificacion';
    const queuedFarms = c.construction.filter((x) => x.building === 'granja').length;
    if ((c.derived.famine > 0 || balance < 2) && queuedFarms < 2) building = 'granja';
    else if (war && rand(state) < 0.35) building = 'fortificacion';
    else {
      const milShare = war ? 0.75 : year >= 2035 ? 0.55 : year >= 2034 ? 0.4 : 0.3;
      const aggressive = FACTIONS[f].aiTargets.some((t) => t.weight >= 3);
      building = rand(state) < milShare + (aggressive ? 0.1 : 0) ? 'militar' : 'civil';
    }
    if (building === 'fortificacion') {
      const loc = frontierProvince(state, f);
      if (loc && canBuild(state, f, 'fortificacion', loc).ok && queueBuilding(state, f, 'fortificacion', loc)) continue;
      building = 'militar';
    }
    const stations = ownedStations(state, f)
      .filter((s) => state.provinces[s].controller === f)
      .sort((a, b) => (a === c.capital ? -1 : b === c.capital ? 1 : state.stations[b].slots - slotsUsed(state, b, f) - (state.stations[a].slots - slotsUsed(state, a, f))));
    let placed = false;
    for (const s of stations) {
      if (canBuild(state, f, building, s).ok) {
        placed = queueBuilding(state, f, building, s);
        if (placed) break;
      }
    }
    if (!placed) {
      for (const s of stations) {
        if (canBuild(state, f, 'infraestructura', s).ok) {
          placed = queueBuilding(state, f, 'infraestructura', s);
          if (placed) break;
        }
      }
    }
    if (!placed) break;
  }
}

function frontierProvince(state: GameState, f: FactionId): string | null {
  const enemies = new Set(state.wars.flatMap((w) => (w.attackers.includes(f) ? w.defenders : w.defenders.includes(f) ? w.attackers : [])));
  for (const o of aliveFactions(state)) if (state.countries[o].wargoals.some((w) => w.target === f)) enemies.add(o);
  let best: string | null = null;
  let bestScore = -1;
  for (const pid of Object.keys(state.provinces)) {
    const p = state.provinces[pid];
    if (p.controller !== f || p.fort >= 3) continue;
    let score = 0;
    for (const n of neighbors(state, pid)) {
      const ctrl = state.provinces[n.to].controller;
      if (ctrl && enemies.has(ctrl)) score += 2;
    }
    if (score === 0) continue;
    if (MAP.provinces[pid].kind === 'estacion') score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = pid;
    }
  }
  return best;
}

export function aiProduction(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const total = Math.max(0, Math.floor(c.derived.milTotal + 0.3));
  if (total <= 0) return;
  const need = c.derived.equipmentNeed;
  const unlocked = unlockedBattalions(state, f);
  const tpl = pickTemplate(state, f);
  const tplEq = tpl ? templateStats(state, f, tpl).equipment : null;
  const weights: Record<EquipmentId, number> = { armas: 3, apoyo: unlocked.has('ametralladoras') ? 1 : 0.3, morteros: 0, lanzallamas: 0, draisinas: 0 };
  if (tplEq) {
    for (const eq of EQUIPMENT_IDS) {
      if (tplEq[eq] > 0) weights[eq] += (tplEq[eq] * (eq === 'armas' ? 0.5 : eq === 'apoyo' ? 1.5 : eq === 'draisinas' ? 12 : 3)) / 10;
    }
  }
  for (const eq of EQUIPMENT_IDS) {
    const stock = c.stockpile[eq];
    if (need[eq] > stock) weights[eq] += Math.min(4, (need[eq] - stock) / 20);
    if (stock > 400 && eq === 'armas') weights[eq] *= 0.5;
  }
  const sum = EQUIPMENT_IDS.reduce((s, eq) => s + weights[eq], 0);
  const target: Record<EquipmentId, number> = { armas: 0, apoyo: 0, morteros: 0, lanzallamas: 0, draisinas: 0 };
  let assigned = 0;
  for (const eq of EQUIPMENT_IDS) {
    target[eq] = Math.floor((weights[eq] / sum) * total);
    assigned += target[eq];
  }
  // Reparte el resto al más necesitado.
  const order = [...EQUIPMENT_IDS].sort((a, b) => weights[b] - weights[a]);
  let i = 0;
  while (assigned < total) {
    target[order[i % order.length]]++;
    assigned++;
    i++;
  }
  if (target.armas === 0) {
    const donor = order.find((eq) => eq !== 'armas' && target[eq] > 0);
    if (donor) {
      target[donor]--;
      target.armas++;
    }
  }
  for (const eq of EQUIPMENT_IDS) {
    const lines = c.production.filter((l) => l.equipment === eq);
    if (target[eq] <= 0) {
      for (const l of lines) removeProductionLine(state, f, l.id);
      continue;
    }
    if (lines.length === 0) addProductionLine(state, f, eq, target[eq]);
    else {
      lines[0].factories = target[eq];
      for (const l of lines.slice(1)) removeProductionLine(state, f, l.id);
    }
  }
}

export function aiTrade(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const d = c.derived;
  const partners = aliveFactions(state)
    .filter((p) => p !== f)
    .sort((a, b) => relation(state, f, b) - relation(state, f, a));
  const buy = (res: ResourceId | 'alimentos', amount: number) => {
    for (const p of partners) {
      const avail = exportable(state, p, res);
      const amt = Math.min(amount, Math.floor(avail * 2) / 2);
      if (amt < 0.5) continue;
      if (canTrade(state, f, p, res, amt).ok && addTrade(state, f, p, res, amt)) return true;
    }
    return false;
  };
  const balance = d.foodProd - d.foodCons + d.foodTrade;
  if ((balance < 0 && c.food < 120) || d.famine > 0) buy('alimentos', Math.ceil(-balance + 1));
  for (const res of RESOURCE_IDS) {
    const r = d.resources[res];
    if (r.used > r.available + 0.25 && d.civAvailable > 2) buy(res, Math.ceil(r.used - r.available));
  }
  // Cancela importaciones innecesarias.
  for (const t of [...c.trades]) {
    if (t.resource === 'alimentos') {
      if (balance - t.amount > 2 && c.food > 150) c.trades = c.trades.filter((x) => x.id !== t.id);
    } else {
      const r = d.resources[t.resource];
      if (r.available - t.amount >= r.used + 0.5) c.trades = c.trades.filter((x) => x.id !== t.id);
    }
  }
}

/** Diseña (o actualiza) la plantilla preferida de la IA según lo investigado. */
export function aiTemplates(state: GameState, f: FactionId) {
  const unlocked = unlockedBattalions(state, f);
  const slots = templateSlots(state, f);
  const aggressive = FACTIONS[f].aiTargets.some((t) => t.weight >= 3) || f === 'SDR';
  const line: string[] = [];
  const add = (b: string) => {
    if (line.length < slots.line && unlocked.has(b)) line.push(b);
  };
  if (unlocked.has('asalto') && aggressive) add('asalto');
  if (unlocked.has('draisina') && f === 'SDR') add('draisina');
  if (unlocked.has('ametralladoras')) add('ametralladoras');
  if (unlocked.has('morteros')) add('morteros');
  while (line.length < slots.line) line.push('fusileros');
  const support: string[] = [];
  for (const b of ['zapadores', 'medicos', 'stalkers']) {
    if (support.length < slots.support && unlocked.has(b)) support.push(b);
  }
  // Pone primero la infantería por estética
  line.sort((a, b) => (a === 'fusileros' ? -1 : b === 'fusileros' ? 1 : 0));
  const name = f === 'SDR' ? 'Guardia de Hierro reforzada' : f === 'LEV' ? 'Brigada Roja reforzada' : f === 'UNI' ? 'Destacamento reforzado' : 'Destacamento de línea';
  saveTemplate(state, f, { id: 'ai_best', name, line, support, custom: true });
}

export function pickTemplate(state: GameState, f: FactionId) {
  return templateById(state, f, 'ai_best') ?? state.countries[f].templates[0];
}

export function aiRecruit(state: GameState, f: FactionId) {
  const c = state.countries[f];
  if (c.recruitment.length >= 2) return;
  const tpl = pickTemplate(state, f);
  if (!tpl) return;
  const stats = templateStats(state, f, tpl);
  const units = unitsOf(state, f);
  const war =
    isAtWar(state, f) ||
    c.wargoals.length > 0 ||
    state.tension > 0.4 ||
    aliveFactions(state).some((o) => o !== f && state.countries[o].wargoals.some((w) => w.target === f));
  // Reserva de mano de obra para refuerzos (menor si faltan tropas para cubrir el frente).
  const short = (c.ai.shortage ?? 0) > 0;
  const reserve = units.length * (short ? 3 : 6) + (war ? 0 : 10);
  if (c.derived.manpowerAvailable < stats.men + reserve) return;
  let eqRatio = 1;
  for (const eq of EQUIPMENT_IDS) {
    if (stats.equipment[eq] > 0) eqRatio = Math.min(eqRatio, c.stockpile[eq] / stats.equipment[eq]);
  }
  if (eqRatio < (war ? 0.5 : 0.8)) return;
  const cap = Math.max(3, Math.round(c.derived.population / 180));
  if (!war && !short && units.length >= cap) return;
  if (canRecruit(state, f, tpl.id).ok) recruit(state, f, tpl.id);
}

export function aiDecisions(state: GameState, f: FactionId) {
  const c = state.countries[f];
  for (const d of visibleDecisions(state, f)) {
    const weight = d.ai ?? 0;
    if (weight <= 0) continue;
    if (rand(state) * 100 > weight) continue;
    let target: string | undefined;
    if (d.targets) {
      const targets = decisionTargets(state, f, d) ?? [];
      if (targets.length === 0) continue;
      if (d.targets === 'raidTarget') {
        targets.sort((a, b) => relation(state, f, a.id as FactionId) - relation(state, f, b.id as FactionId));
      }
      if (d.targets === 'dangerProvince') {
        const withUnits = targets.find((t) => Object.values(state.units).some((u) => u.owner === f && u.province === t.id));
        if (withUnits) targets.unshift(withUnits);
      }
      target = targets[0].id;
    }
    if (!canTakeDecision(state, f, d.id, target).ok) continue;
    // Mantiene algo de poder político para leyes y asesores.
    const pp = d.cost?.pp ?? 0;
    if (pp > 0 && c.pp - pp < 25) continue;
    takeDecision(state, f, d.id, target);
  }
}
