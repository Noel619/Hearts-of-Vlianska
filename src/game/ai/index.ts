// Punto de entrada de la IA: se ejecuta cada día para cada facción no controlada por el jugador.
import type { FactionId, GameState } from '../types';
import { FACTION_IDS } from '../types';
import {
  aiAdvisors,
  aiConstruction,
  aiDecisions,
  aiFocus,
  aiLaws,
  aiProduction,
  aiRecruit,
  aiResearch,
  aiTemplates,
  aiTrade,
} from './economy';
import { aiMilitary } from './military';
import { aiDiplomacy } from './diplomacy';

export function runAI(state: GameState, f: FactionId) {
  const c = state.countries[f];
  if (!c.alive) return;
  const day = Math.floor(state.hour / 24);
  const idx = FACTION_IDS.indexOf(f);
  aiFocus(state, f);
  aiResearch(state, f);
  if ((day + idx) % 30 === 0 || day === 1) aiTemplates(state, f);
  if ((day + idx) % 3 === 0) aiRecruit(state, f);
  if ((day + idx) % 7 === 0) {
    aiLaws(state, f);
    aiAdvisors(state, f);
    aiConstruction(state, f);
    aiProduction(state, f);
    aiTrade(state, f);
    aiDecisions(state, f);
    aiDiplomacy(state, f);
  }
  aiMilitary(state, f);
}
