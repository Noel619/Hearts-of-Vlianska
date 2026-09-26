// Resistencia: las estaciones conquistadas pueden alzarse y devolver la vida a su antigua facción.
import { FACTIONS, STATIONS } from '../data';
import type { FactionId, GameState } from './types';
import { addLog, changeRelation, clamp, factionName } from './helpers';
import { chance } from './rng';
import { fireEvent } from './events';
import { transferStation } from './diplomacy';
import { killMen, spawnUnit, unitsAt } from './military';
import { invalidateMods } from './modifiers';

/** Probabilidad mensual de revuelta en una estación. */
export function revoltChance(state: GameState, sid: string): { chance: number; claimant: FactionId | null } {
  const st = state.stations[sid];
  const owner = st.owner;
  if (!owner || st.cores.includes(owner)) return { chance: 0, claimant: null };
  const claimant = st.cores.find((c) => c !== owner && !state.countries[c].alive) ?? null;
  if (!claimant) return { chance: 0, claimant: null };
  if (state.provinces[sid].controller !== owner) return { chance: 0, claimant };
  const c = state.countries[owner];
  const garrison = unitsAt(state, sid).filter((u) => u.owner === owner).length;
  const monthsOwned = (state.hour - st.ownedSince) / (24 * 30);
  const base = 0.05 * (1.3 - c.derived.stability) * Math.max(0.15, 1 - 0.45 * garrison) * (monthsOwned < 2 ? 0.3 : 1);
  return { chance: clamp(base, 0, 0.25), claimant };
}

export function monthlyResistance(state: GameState) {
  for (const sid of Object.keys(state.stations)) {
    const st = state.stations[sid];
    if (!st.owner || !state.countries[st.owner].alive) continue;
    const owner = st.owner;
    const key = `revuelta:${sid}`;
    if ((state.countries[owner].cooldowns[key] ?? 0) > state.hour) continue;
    const { chance: p, claimant } = revoltChance(state, sid);
    if (!claimant || p <= 0) continue;
    if (!chance(state, p)) continue;
    state.countries[owner].cooldowns[key] = state.hour + 24 * 240;
    fireEvent(state, owner, 'gen_revuelta', { from: claimant, target: sid });
  }
}

/** Aplastar la revuelta: cuesta vidas y estabilidad. */
export function crushRevolt(state: GameState, owner: FactionId, sid: string) {
  const st = state.stations[sid];
  const dead = Math.round(st.population * 0.08);
  st.population = Math.max(0, st.population - dead);
  killMen(state, owner, 4);
  addLog(state, { text: `${factionName(owner)} aplasta una revuelta en ${STATIONS[sid].name}. Mueren ${dead} habitantes.`, kind: 'guerra', faction: owner, province: sid });
}

/** La estación se libera y la facción que la tenía como núcleo renace. */
export function liberateStation(state: GameState, owner: FactionId, sid: string, claimant: FactionId) {
  const c = state.countries[claimant];
  const wasDead = !c.alive;
  // Las tropas del ocupante en la estación vuelven a su capital.
  for (const u of unitsAt(state, sid)) {
    if (u.owner === owner) {
      u.province = state.countries[owner].capital;
      u.path = [];
      u.battle = null;
    }
  }
  transferStation(state, sid, claimant, true);
  c.alive = true;
  c.capital = sid;
  if (wasDead) {
    c.pp = 40;
    c.stabilityBase = 0.5;
    c.warSupportBase = 0.6;
    c.focus.current = null;
    c.focus.progress = 0;
    c.wargoals = [];
    c.trades = [];
    c.production = c.production.length ? c.production : [{ id: `l${claimant}r`, equipment: 'armas', factories: 1, efficiency: 0.2 }];
    c.stockpile.armas = Math.max(c.stockpile.armas, 60);
    c.food = Math.max(c.food, 60);
    c.surrender = 0;
    c.recentLosses = 0;
    c.relations[owner] = -70;
    state.countries[owner].relations[claimant] = -70;
  }
  spawnUnit(state, claimant, 'milicia_voluntaria', sid, { name: 'Voluntarios de la liberación' });
  if (!state.stations[sid].claims.includes(owner)) state.stations[sid].claims.push(owner);
  changeRelation(state, owner, claimant, -30);
  addLog(state, { text: `¡${STATIONS[sid].name} se subleva! ${factionName(claimant)} ${wasDead ? 'renace' : 'recupera la estación'}.`, kind: 'guerra', faction: claimant, province: sid });
  state.news.push({
    hour: state.hour,
    title: `¡${FACTIONS[claimant].name} renace!`,
    text: `Los habitantes de ${STATIONS[sid].name} expulsan a ${factionName(owner)} y vuelven a izar su antigua bandera.`,
    picture: 'Flag',
  });
  invalidateMods(state);
}

export function resistanceSummary(state: GameState, f: FactionId) {
  return Object.keys(state.stations)
    .filter((s) => state.stations[s].owner === f)
    .map((s) => ({ station: s, ...revoltChance(state, s) }))
    .filter((r) => r.claimant);
}
