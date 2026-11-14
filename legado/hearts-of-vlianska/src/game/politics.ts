// Política interna: espíritus, ideologías, líderes, leyes y asesores.
import { ADVISOR_BY_ID, IDEOLOGIES, IDEOLOGY_IDS, LAWS, LEADERS, MILITARY_SLOTS, POLITICAL_SLOTS, POP_KEYS, SPIRITS } from '../data';
import type { FactionId, GameState, IdeologyId } from './types';
import { check } from './conditions';
import { addLog, factionName } from './helpers';
import { invalidateMods, mod } from './modifiers';

export function addSpirit(state: GameState, f: FactionId, id: string, days?: number) {
  if (!SPIRITS[id]) return;
  const c = state.countries[f];
  const until = days ? state.hour + days * 24 : undefined;
  const existing = c.spirits.find((s) => s.id === id);
  if (existing) existing.until = until;
  else c.spirits.push({ id, until });
  invalidateMods(state);
}

export function removeSpirit(state: GameState, f: FactionId, id: string) {
  const c = state.countries[f];
  c.spirits = c.spirits.filter((s) => s.id !== id);
  invalidateMods(state);
}

export function hasSpirit(state: GameState, f: FactionId, id: string) {
  return state.countries[f].spirits.some((s) => s.id === id);
}

function normalizePopularity(pop: Record<IdeologyId, number>) {
  let total = 0;
  for (const k of IDEOLOGY_IDS) {
    pop[k] = Math.max(0, pop[k]);
    total += pop[k];
  }
  if (total <= 0) return;
  for (const k of IDEOLOGY_IDS) pop[k] = (pop[k] / total) * 100;
}

export function changePopularity(state: GameState, f: FactionId, id: IdeologyId, delta: number) {
  const c = state.countries[f];
  // Añade al apoyo de una ideología y reparte la diferencia entre las demás.
  const before = c.popularity[id];
  const after = Math.max(0, Math.min(100, before + delta));
  const diff = after - before;
  const others = IDEOLOGY_IDS.filter((k) => k !== id);
  const otherTotal = others.reduce((s, k) => s + c.popularity[k], 0);
  c.popularity[id] = after;
  if (otherTotal > 0) {
    for (const k of others) c.popularity[k] -= (diff * c.popularity[k]) / otherTotal;
  }
  normalizePopularity(c.popularity);
}

export function setIdeology(state: GameState, f: FactionId, id: IdeologyId, leader?: string) {
  const c = state.countries[f];
  c.ideology = id;
  if (c.popularity[id] < 50) changePopularity(state, f, id, 50 - c.popularity[id]);
  if (leader && LEADERS[leader]) c.leader = leader;
  // Los asesores de otra ideología dimiten.
  c.advisors = c.advisors.filter((a) => {
    const adv = ADVISOR_BY_ID[a];
    return !adv?.ideology || adv.ideology === id;
  });
  addLog(state, {
    text: `${factionName(f)} adopta un gobierno ${IDEOLOGIES[id].adjective}${leader && LEADERS[leader] ? ` bajo ${LEADERS[leader].name}` : ''}.`,
    kind: 'diplo',
    faction: f,
  });
  invalidateMods(state);
}

export function setLeader(state: GameState, f: FactionId, leader: string) {
  if (!LEADERS[leader]) return;
  state.countries[f].leader = leader;
  addLog(state, { text: `${LEADERS[leader].name} es el nuevo líder de ${factionName(f)}.`, kind: 'diplo', faction: f });
  invalidateMods(state);
}

export function dailyPopularityDrift(state: GameState, f: FactionId) {
  const c = state.countries[f];
  let changed = false;
  for (const id of IDEOLOGY_IDS) {
    const v = mod(state, f, POP_KEYS[id]);
    if (v !== 0) {
      c.popularity[id] = Math.max(0, c.popularity[id] + v);
      changed = true;
    }
  }
  // La ideología gobernante gana apoyo lentamente si la estabilidad es alta.
  const stab = c.derived.stability;
  if (stab > 0.5) {
    c.popularity[c.ideology] += (stab - 0.5) * 0.02;
    changed = true;
  }
  if (changed) normalizePopularity(c.popularity);
}

// ---------------------------------------------------------------------------
// Leyes
// ---------------------------------------------------------------------------

export function lawCost(state: GameState, f: FactionId, lawId: string): number {
  const law = LAWS[lawId];
  const current = LAWS[state.countries[f].laws[law.group]];
  const steps = Math.max(1, Math.abs(law.order - (current?.order ?? law.order)));
  return Math.round(law.cost * (0.6 + 0.4 * steps) * Math.max(0.2, 1 + mod(state, f, 'costeLeyes')));
}

export function canEnactLaw(state: GameState, f: FactionId, lawId: string): { ok: boolean; reason?: string } {
  const law = LAWS[lawId];
  const c = state.countries[f];
  if (!law) return { ok: false, reason: 'Ley desconocida' };
  if (c.laws[law.group] === lawId) return { ok: false, reason: 'Ya está en vigor' };
  if (!check(state, law.available, { root: f })) return { ok: false, reason: 'No se cumplen los requisitos' };
  const cost = lawCost(state, f, lawId);
  if (c.pp < cost) return { ok: false, reason: `Necesitas ${cost} de poder político` };
  return { ok: true };
}

export function enactLaw(state: GameState, f: FactionId, lawId: string): boolean {
  const ok = canEnactLaw(state, f, lawId);
  if (!ok.ok) return false;
  const law = LAWS[lawId];
  const c = state.countries[f];
  c.pp -= lawCost(state, f, lawId);
  c.laws[law.group] = lawId;
  invalidateMods(state);
  addLog(state, { text: `${factionName(f)} aprueba la ley: ${law.name}.`, kind: 'info', faction: f, quiet: true });
  return true;
}

// ---------------------------------------------------------------------------
// Asesores
// ---------------------------------------------------------------------------

export function advisorCost(state: GameState, f: FactionId, id: string): number {
  const adv = ADVISOR_BY_ID[id];
  return Math.round(adv.cost * Math.max(0.2, 1 + mod(state, f, 'costeAsesores')));
}

export function availableAdvisors(state: GameState, f: FactionId) {
  const c = state.countries[f];
  return Object.values(ADVISOR_BY_ID).filter((a) => {
    if (a.faction && a.faction !== f) return false;
    if (!check(state, a.available, { root: f })) return false;
    if (a.ideology && a.ideology !== c.ideology) return false;
    return true;
  });
}

export function canHireAdvisor(state: GameState, f: FactionId, id: string): { ok: boolean; reason?: string } {
  const adv = ADVISOR_BY_ID[id];
  const c = state.countries[f];
  if (!adv) return { ok: false, reason: 'Asesor desconocido' };
  if (c.advisors.includes(id)) return { ok: false, reason: 'Ya forma parte del gobierno' };
  if (!availableAdvisors(state, f).some((a) => a.id === id)) return { ok: false, reason: 'No disponible' };
  const inSlot = c.advisors.filter((a) => ADVISOR_BY_ID[a]?.slot === adv.slot).length;
  const max = adv.slot === 'politico' ? POLITICAL_SLOTS : MILITARY_SLOTS;
  if (inSlot >= max) return { ok: false, reason: 'No quedan puestos libres' };
  const cost = advisorCost(state, f, id);
  if (c.pp < cost) return { ok: false, reason: `Necesitas ${cost} de poder político` };
  return { ok: true };
}

export function hireAdvisor(state: GameState, f: FactionId, id: string): boolean {
  if (!canHireAdvisor(state, f, id).ok) return false;
  const c = state.countries[f];
  c.pp -= advisorCost(state, f, id);
  c.advisors.push(id);
  invalidateMods(state);
  return true;
}

export function fireAdvisor(state: GameState, f: FactionId, id: string) {
  const c = state.countries[f];
  c.advisors = c.advisors.filter((a) => a !== id);
  invalidateMods(state);
}
