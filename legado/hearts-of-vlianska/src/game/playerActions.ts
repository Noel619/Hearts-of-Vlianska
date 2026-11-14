// Acciones diplomáticas del jugador: propuestas que la IA acepta o rechaza con un motivo.
import { STATIONS } from '../data';
import type { FactionId, GameState } from './types';
import { changeRelation, factionName, hasAccess, hasNap, isAtWarWith, pactOf, samePact } from './helpers';
import {
  EMBARGO_COST,
  GUARANTEE_COST,
  NAP_COST,
  addEmbargo,
  addGuarantee,
  addNap,
  addToPact,
  aiAcceptsAccess,
  aiAcceptsNap,
  aiAcceptsPact,
  aiAcceptsPeace,
  createPact,
  grantAccess,
  liftEmbargo,
  releaseSubject,
  removeGuarantee,
  revokeAccess,
  whitePeace,
} from './diplomacy';
import { removeUnit, unitStats, unitsOf } from './military';

export interface ActionResult {
  ok: boolean;
  text: string;
}

export function proposeNap(state: GameState, f: FactionId, t: FactionId): ActionResult {
  const c = state.countries[f];
  if (hasNap(state, f, t)) return { ok: false, text: 'Ya tenéis un pacto de no agresión.' };
  if (isAtWarWith(state, f, t)) return { ok: false, text: 'Estáis en guerra.' };
  if (c.pp < NAP_COST) return { ok: false, text: `Necesitas ${NAP_COST} de poder político.` };
  const r = aiAcceptsNap(state, t, f);
  if (!r.ok) {
    changeRelation(state, f, t, -3);
    return { ok: false, text: `${factionName(t)} rechaza el pacto: «${r.reason}»` };
  }
  c.pp -= NAP_COST;
  addNap(state, f, t, 730);
  return { ok: true, text: `${factionName(t)} firma el pacto de no agresión: «${r.reason}»` };
}

export function requestAccess(state: GameState, f: FactionId, t: FactionId): ActionResult {
  if (hasAccess(state, f, t)) return { ok: false, text: 'Ya tienes acceso militar.' };
  const r = aiAcceptsAccess(state, t, f);
  if (!r.ok) return { ok: false, text: `${factionName(t)} rechaza la petición: «${r.reason}»` };
  grantAccess(state, t, f);
  return { ok: true, text: `${factionName(t)} te concede acceso militar: «${r.reason}»` };
}

export function toggleGrantAccess(state: GameState, f: FactionId, t: FactionId): ActionResult {
  const has = state.access.some((a) => a.from === f && a.to === t);
  if (has) {
    revokeAccess(state, f, t);
    return { ok: true, text: `Retiras el acceso militar a ${factionName(t)}.` };
  }
  grantAccess(state, f, t);
  return { ok: true, text: `Concedes acceso militar a ${factionName(t)}.` };
}

export function invitePact(state: GameState, f: FactionId, t: FactionId): ActionResult {
  if (samePact(state, f, t)) return { ok: false, text: 'Ya sois aliados.' };
  const r = aiAcceptsPact(state, t, f);
  if (!r.ok) return { ok: false, text: `${factionName(t)} rechaza la alianza: «${r.reason}»` };
  if (!pactOf(state, f)) createPact(state, f, `Alianza de ${STATIONS[state.countries[f].capital].shortName}`);
  addToPact(state, f, t);
  return { ok: true, text: `${factionName(t)} se une a tu alianza: «${r.reason}»` };
}

export function proposePeace(state: GameState, f: FactionId, t: FactionId): ActionResult {
  if (!isAtWarWith(state, f, t)) return { ok: false, text: 'No estáis en guerra.' };
  const key = `paz_${t}`;
  const c = state.countries[f];
  if ((c.cooldowns[key] ?? 0) > state.hour) return { ok: false, text: 'Han rechazado una propuesta hace poco. Espera unas semanas.' };
  const r = aiAcceptsPeace(state, t, f);
  if (!r.ok) {
    c.cooldowns[key] = state.hour + 24 * 30;
    return { ok: false, text: `${factionName(t)} rechaza la paz: «${r.reason}»` };
  }
  whitePeace(state, f, t);
  return { ok: true, text: `${factionName(t)} acepta la paz blanca: «${r.reason}»` };
}

export function toggleGuarantee(state: GameState, f: FactionId, t: FactionId): ActionResult {
  const has = state.guarantees.some((g) => g.guarantor === f && g.target === t);
  if (has) {
    removeGuarantee(state, f, t);
    return { ok: true, text: `Retiras la garantía de independencia a ${factionName(t)}.` };
  }
  const c = state.countries[f];
  if (c.pp < GUARANTEE_COST) return { ok: false, text: `Necesitas ${GUARANTEE_COST} de poder político.` };
  c.pp -= GUARANTEE_COST;
  addGuarantee(state, f, t);
  return { ok: true, text: `Garantizas la independencia de ${factionName(t)}. Si alguien la ataca, entrarás en guerra.` };
}

export function toggleEmbargo(state: GameState, f: FactionId, t: FactionId): ActionResult {
  const has = state.embargoes.some((e) => e.from === f && e.to === t);
  if (has) {
    liftEmbargo(state, f, t);
    return { ok: true, text: `Levantas el embargo a ${factionName(t)}.` };
  }
  const c = state.countries[f];
  if (c.pp < EMBARGO_COST) return { ok: false, text: `Necesitas ${EMBARGO_COST} de poder político.` };
  c.pp -= EMBARGO_COST;
  addEmbargo(state, f, t);
  return { ok: true, text: `Impones un embargo a ${factionName(t)}.` };
}

export function freeSubject(state: GameState, f: FactionId, t: FactionId): ActionResult {
  releaseSubject(state, f, t);
  return { ok: true, text: `${factionName(t)} vuelve a ser independiente.` };
}

/** Disolver una unidad: devuelve parte del equipo y los hombres. */
export function disbandUnit(state: GameState, f: FactionId, id: string): ActionResult {
  const u = state.units[id];
  if (!u || u.owner !== f) return { ok: false, text: 'Unidad no válida.' };
  if (u.battle) return { ok: false, text: 'No se puede disolver una unidad en combate.' };
  const stats = unitStats(state, u);
  const c = state.countries[f];
  for (const [eq, n] of Object.entries(stats.equipment) as [keyof typeof c.stockpile, number][]) c.stockpile[eq] += n * u.strength * 0.7;
  removeUnit(state, id);
  return { ok: true, text: `${u.name} se disuelve. Sus hombres y parte de su equipo vuelven a la reserva.` };
}

export function isEmbargoing(state: GameState, f: FactionId, t: FactionId) {
  return state.embargoes.some((e) => e.from === f && e.to === t);
}

export function armySummary(state: GameState, f: FactionId) {
  const units = unitsOf(state, f);
  let men = 0;
  for (const u of units) men += unitStats(state, u).men * u.strength;
  return { units: units.length, men };
}

