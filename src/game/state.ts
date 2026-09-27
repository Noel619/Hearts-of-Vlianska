// Creación de una partida nueva a partir de los datos iniciales.
import { FACTIONS, MAP, STATION_SEEDS, initialControllers } from '../data';
import type { CountryState, Difficulty, FactionId, GameState, ProvinceState, StationState } from './types';
import { FACTION_IDS } from './types';
import { emptyDerived, updateDerived, START_EFFICIENCY } from './economy';
import { invalidateMods } from './modifiers';
import { spawnUnit } from './military';

export const SAVE_VERSION = 2;

export interface NewGameOptions {
  player: FactionId | null;
  difficulty?: Difficulty;
  seed?: number;
  historicalAI?: boolean;
}

export function newGame(opts: NewGameOptions): GameState {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const owners: Record<string, FactionId | null> = {};
  for (const s of STATION_SEEDS) owners[s.id] = s.owner;
  const controllers = initialControllers(owners);

  const provinces: Record<string, ProvinceState> = {};
  for (const p of MAP.provinceList) {
    const seedStation = STATION_SEEDS.find((s) => s.id === p.id);
    provinces[p.id] = {
      controller: controllers[p.id] ?? null,
      fort: seedStation ? seedStation.fort : p.terrain === 'peligroso' ? 0 : 0,
      danger: p.baseDanger,
      collapsed: p.terrain === 'derrumbe',
    };
  }
  const stations: Record<string, StationState> = {};
  for (const s of STATION_SEEDS) {
    stations[s.id] = {
      owner: s.owner,
      population: s.population,
      buildings: { ...s.buildings },
      resources: { ...s.resources },
      cores: [...s.cores],
      claims: [...(s.claims ?? [])],
      slots: s.slots,
      ownedSince: -24 * 365 * 3,
    };
  }

  const countries = {} as Record<FactionId, CountryState>;
  for (const id of FACTION_IDS) {
    const f = FACTIONS[id];
    countries[id] = {
      id,
      alive: true,
      capital: f.capital,
      leader: f.leader,
      ideology: f.ideology,
      popularity: { ...f.popularity },
      pp: f.pp,
      stabilityBase: f.stability,
      warSupportBase: f.warSupport,
      laws: { ...f.laws },
      advisors: [],
      spirits: f.spirits.map((s) => ({ id: s })),
      focus: { current: null, progress: 0, done: [] },
      research: { slots: f.researchSlots, active: Array(f.researchSlots).fill(null), done: [...f.techs], bonuses: [] },
      stockpile: { ...f.stockpile },
      food: f.food,
      production: f.production.map((p, i) => ({ id: `l${id}${i}`, equipment: p.equipment, factories: p.factories, efficiency: START_EFFICIENCY + 0.25 })),
      construction: [],
      trades: [],
      templates: f.templates.map((t) => ({ ...t, line: [...t.line], support: [...t.support] })),
      recruitment: [],
      relations: { ...f.relations },
      wargoals: [],
      flags: {},
      cooldowns: {},
      activeDecisions: [],
      unlockedDecisions: [],
      firedEvents: {},
      surrender: 0,
      casualties: 0,
      recentLosses: 0,
      unitCounter: 0,
      manpowerBonus: 0,
      derived: emptyDerived(),
      ai: { strategy: 'normal', lastDiplo: 0, rejected: {} },
    };
  }

  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed,
    hour: 0,
    player: opts.player,
    difficulty: opts.difficulty ?? 'normal',
    historicalAI: opts.historicalAI ?? true,
    provinces,
    stations,
    countries,
    units: {},
    battles: {},
    wars: [],
    pacts: [],
    naps: [{ a: 'UNI', b: 'NOR', until: 24 * 365 * 2 }],
    access: [{ from: 'STA', to: 'UNI' }],
    guarantees: [{ guarantor: 'UNI', target: 'STA' }],
    embargoes: [{ from: 'LEV', to: 'CAL' }],
    tension: 0.2,
    openEdges: [],
    globalFlags: {},
    log: [],
    news: [],
    playerEvents: [],
    peaceOffers: [],
    nextId: 1,
    history: [],
    scheduled: [],
    stats: { battles: 0, captures: 0 },
  };

  for (const id of FACTION_IDS) {
    for (const u of FACTIONS[id].units) {
      for (let i = 0; i < (u.count ?? 1); i++) spawnUnit(state, id, u.template, u.province);
    }
  }
  invalidateMods(state);
  for (const id of FACTION_IDS) updateDerived(state, id);
  // Segunda pasada: la hambruna y el suministro dependen del primer cálculo.
  for (const id of FACTION_IDS) updateDerived(state, id);
  return state;
}
