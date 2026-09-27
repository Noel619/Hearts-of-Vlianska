// Registro central de contenido: todo lo que el motor necesita consultar.
import type { DecisionDef, EventDef, FactionId, FocusDef, FocusTreeDef, SpiritDef } from '../game/types';
import { BASE_SPIRITS } from './spirits';
import { FOCUS_TREE_LIST, FOCUS_SPIRITS } from './focus';
import { EVENT_LIST, STORY_SPIRITS } from './events';
import { DECISION_LIST } from './decisions';

export * from './map';
export * from './factions';
export * from './ideologies';
export * from './leaders';
export * from './military';
export * from './economy';
export * from './advisors';
export * from './techs';

export const SPIRITS: Record<string, SpiritDef> = Object.fromEntries([...BASE_SPIRITS, ...STORY_SPIRITS, ...FOCUS_SPIRITS].map((s) => [s.id, s]));

export const FOCUS_TREES: Record<FactionId, FocusTreeDef> = Object.fromEntries(FOCUS_TREE_LIST.map((t) => [t.faction, t])) as Record<
  FactionId,
  FocusTreeDef
>;

export const FOCUS_BY_ID: Record<string, FocusDef & { faction: FactionId }> = Object.fromEntries(
  FOCUS_TREE_LIST.flatMap((t) => t.focuses.map((f) => [f.id, { ...f, faction: t.faction }])),
);

export const EVENTS: Record<string, EventDef> = Object.fromEntries(EVENT_LIST.map((e) => [e.id, e]));
export const DECISIONS: Record<string, DecisionDef> = Object.fromEntries(DECISION_LIST.map((d) => [d.id, d]));
