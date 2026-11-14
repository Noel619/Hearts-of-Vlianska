// Contenido propio de cada facción: árbol de enfoques, espíritus, eventos y decisiones.
import type { DecisionDef, EventDef, FocusTreeDef, SpiritDef } from '../../game/types';
import * as uni from './uni';
import * as sdr from './sdr';
import * as lev from './lev';
import * as sta from './sta';
import * as vhl from './vhl';
import * as che from './che';
import * as cal from './cal';
import * as nor from './nor';

const ALL = [uni, sdr, lev, sta, vhl, che, cal, nor];

export const FOCUS_TREE_LIST: FocusTreeDef[] = ALL.map((m) => m.tree);
export const FOCUS_SPIRITS: SpiritDef[] = ALL.flatMap((m) => m.spirits);
export const FACTION_EVENTS: EventDef[] = ALL.flatMap((m) => m.events);
export const FACTION_DECISIONS: DecisionDef[] = ALL.flatMap((m) => m.decisions);
