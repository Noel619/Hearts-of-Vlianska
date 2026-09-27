// Influencia extranjera: cuánto controla una facción las decisiones de otra.
//
// Negociar desde la debilidad, pagar tributos, aceptar comisarios o depender del comercio de un
// vecino da a este influencia sobre nosotros. La influencia:
// - resta poder político (las decisiones importantes se consultan fuera) y se lo da a quien la ejerce;
// - hace crecer poco a poco su ideología entre nuestra gente;
// - a partir de 50, le abre nuestros túneles a sus tropas y nos impide justificar una guerra contra ella;
// - al llegar a 100 provoca una crisis de soberanía: aceptar ser su protectorado o romper con ella.
// Sin presión activa (cambio mensual), la influencia se desvanece poco a poco.
import { IDEOLOGIES } from '../data';
import type { FactionId, GameState, Modifiers } from './types';
import { FACTION_IDS } from './types';
import { addLog, clamp, factionName } from './helpers';
import { changePopularity } from './politics';
import { fireEvent } from './events';
import { invalidateMods } from './modifiers';

export const INFLUENCE = {
  /** Umbral a partir del cual la facción influyente tiene paso militar y no se le puede declarar la guerra. */
  TUTELAGE: 50,
  /** Crisis de soberanía. */
  CRISIS: 100,
  /** Poder político diario perdido con influencia 100 (se reparte proporcionalmente). */
  PP_DRAIN: 0.6,
  /** Poder político diario que gana quien ejerce influencia 100. */
  PP_GAIN: 0.3,
  /** Puntos de apoyo mensuales que gana la ideología de quien influye, con influencia 100. */
  IDEOLOGY_DRIFT: 1.5,
  /** Pérdida mensual cuando nadie la mantiene. */
  DECAY: 1,
};

/** Influencia de `by` sobre `over` (0..100). */
export function influenceOf(state: GameState, over: FactionId, by: FactionId): number {
  return state.countries[over].influence?.[by] ?? 0;
}

export function influenceDrift(state: GameState, over: FactionId, by: FactionId): number {
  return state.countries[over].influenceDrift?.[by] ?? 0;
}

/** Suma (o resta) influencia de `by` sobre `over` y dispara los avisos al cruzar los umbrales. */
export function addInfluence(state: GameState, over: FactionId, by: FactionId, v: number) {
  if (over === by || !v) return;
  const c = state.countries[over];
  c.influence ??= {};
  const before = c.influence[by] ?? 0;
  const after = clamp(before + v, 0, 100);
  if (after <= 0) delete c.influence[by];
  else c.influence[by] = after;
  invalidateMods(state);
  if (!state.countries[by].alive || !c.alive) return;
  if (before < INFLUENCE.TUTELAGE && after >= INFLUENCE.TUTELAGE) {
    addLog(state, { text: `${factionName(by)} controla ya buena parte de las decisiones de ${factionName(over)}.`, kind: 'diplo', faction: over });
    fireEvent(state, over, 'inf_tutela', { from: by });
  }
  if (before < INFLUENCE.CRISIS && after >= INFLUENCE.CRISIS && c.overlord !== by) {
    fireEvent(state, over, 'inf_crisis', { from: by });
  }
}

export function setInfluenceDrift(state: GameState, over: FactionId, by: FactionId, v: number) {
  if (over === by) return;
  const c = state.countries[over];
  c.influenceDrift ??= {};
  if (Math.abs(v) < 1e-9) delete c.influenceDrift[by];
  else c.influenceDrift[by] = v;
}

export function monthlyInfluence(state: GameState) {
  for (const f of FACTION_IDS) {
    const c = state.countries[f];
    c.influence ??= {};
    c.influenceDrift ??= {};
    if (!c.alive) {
      c.influence = {};
      c.influenceDrift = {};
      continue;
    }
    const sources = new Set([...Object.keys(c.influence), ...Object.keys(c.influenceDrift)] as FactionId[]);
    for (const by of sources) {
      if (!state.countries[by].alive || by === f) {
        delete c.influence[by];
        delete c.influenceDrift[by];
        continue;
      }
      const drift = c.influenceDrift[by] ?? 0;
      // Un protector mantiene su influencia; sin presión activa, se desvanece.
      const decay = drift === 0 && c.overlord !== by ? -INFLUENCE.DECAY : 0;
      addInfluence(state, f, by, drift + decay);
      const level = c.influence[by] ?? 0;
      const ideo = state.countries[by].ideology;
      if (level > 0 && ideo !== c.ideology) changePopularity(state, f, ideo, (INFLUENCE.IDEOLOGY_DRIFT * level) / 100);
    }
  }
}

/** Modificadores que produce la influencia (para el desglose de modificadores). */
export function influenceModSources(state: GameState, f: FactionId): { label: string; mods: Modifiers }[] {
  const out: { label: string; mods: Modifiers }[] = [];
  const c = state.countries[f];
  for (const [by, level] of Object.entries(c.influence ?? {}) as [FactionId, number][]) {
    if (!level) continue;
    out.push({ label: `Influencia de ${factionName(by)} (${Math.round(level)})`, mods: { ppDiario: (-INFLUENCE.PP_DRAIN * level) / 100 } });
  }
  for (const other of FACTION_IDS) {
    if (other === f) continue;
    const level = state.countries[other].influence?.[f] ?? 0;
    if (level > 0 && state.countries[other].alive) {
      out.push({ label: `Influencia sobre ${factionName(other)} (${Math.round(level)})`, mods: { ppDiario: (INFLUENCE.PP_GAIN * level) / 100 } });
    }
  }
  return out;
}

/** Texto breve con las consecuencias de un nivel de influencia. */
export function influenceStage(level: number): string {
  if (level >= INFLUENCE.CRISIS) return 'Crisis de soberanía';
  if (level >= INFLUENCE.TUTELAGE) return 'Tutela: paso militar libre y sin guerra posible';
  if (level >= 25) return 'Dependencia: sus ideas calan y consulta nuestras decisiones';
  if (level > 0) return 'Presencia: algo de poder político perdido';
  return 'Sin influencia';
}

export function ideologyName(f: FactionId, state: GameState) {
  return IDEOLOGIES[state.countries[f].ideology].name;
}
