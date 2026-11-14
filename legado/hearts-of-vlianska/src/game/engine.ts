// Bucle principal de simulación: avanza la partida hora a hora.
import { MAP, STATIONS } from '../data';
import type { FactionId, GameState } from './types';
import { FACTION_IDS } from './types';
import { addLog, aliveFactions, clamp, controlledStations, factionName, ownedStations } from './helpers';
import { invalidateMods, mod } from './modifiers';
import { dailyEconomy, monthlyPopulation, updateDerived, validateTrades } from './economy';
import { dailyResearch } from './research';
import { dailyFocus } from './focus';
import { dailyDecisions } from './decisions';
import { dailyDiplomacy, dailyJustify, dailySurrender } from './diplomacy';
import { dailyFrontControl, dailyRecruitment, dailyUnits, hourlyOrg } from './military';
import { hourlyCombat, hourlyMovement, resolveOverlaps } from './combat';
import { dailyEvents, processScheduled } from './events';
import { dailyPopularityDrift } from './politics';
import { runAI } from './ai';
import { monthlyResistance } from './resistance';
import { dateOf, hourOfDate, isNewMonth } from './time';
import { dailyNests, hourlyNests } from './nests';

export const END_HOUR = hourOfDate('2040-01-01');
export const VICTORY_STATIONS = 11;

export function advanceHour(state: GameState) {
  state.hour += 1;
  hourlyMovement(state);
  hourlyCombat(state);
  hourlyNests(state);
  hourlyOrg(state);
  processScheduled(state);
  if (state.hour % 24 === 0) advanceDay(state);
}

export function advanceDays(state: GameState, n: number) {
  for (let i = 0; i < n * 24; i++) advanceHour(state);
}

function expireSpirits(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const before = c.spirits.length;
  c.spirits = c.spirits.filter((s) => !s.until || s.until > state.hour);
  if (c.spirits.length !== before) invalidateMods(state);
}

function dailyDanger(state: GameState) {
  for (const p of MAP.provinceList) {
    const ps = state.provinces[p.id];
    if (p.kind === 'estacion' && state.stations[p.id]?.owner) {
      ps.danger = 0;
      continue;
    }
    if (ps.suppressedUntil && ps.suppressedUntil > state.hour) continue;
    let target = p.baseDanger;
    // Sin el nido de arañas (o con Tenevskaya habitada), los túneles de alrededor se calman.
    if (state.stations.TEN?.owner || !state.nests.TEN?.packs.length) {
      const d = Math.hypot(p.x - MAP.provinces.TEN.x, p.y - MAP.provinces.TEN.y);
      if (d < 160) target = Math.max(0, target - 15);
    }
    if (ps.controller) target *= Math.max(0.2, 1 + mod(state, ps.controller, 'peligroMutante'));
    if (Math.abs(ps.danger - target) < 0.5) ps.danger = target;
    else ps.danger += ps.danger < target ? 0.25 : -0.5;
    ps.danger = clamp(ps.danger, 0, 100);
  }
}

function snapshot(state: GameState) {
  const data: GameState['history'][number]['data'] = {};
  for (const f of FACTION_IDS) {
    const c = state.countries[f];
    if (!c.alive) continue;
    data[f] = {
      stations: ownedStations(state, f).length,
      units: Object.values(state.units).filter((u) => u.owner === f).length,
      mil: Math.round(c.derived.milTotal * 10) / 10,
      civ: Math.round(c.derived.civTotal * 10) / 10,
      pop: Math.round(c.derived.population),
    };
  }
  state.history.push({ hour: state.hour, data });
}

function checkEnd(state: GameState) {
  if (state.gameOver) return;
  const p = state.player;
  if (p) {
    if (!state.countries[p].alive) {
      state.gameOver = { winner: null, reason: `${factionName(p)} ha sido derrotada. Sus estaciones pertenecen ahora a otros.`, hour: state.hour, victory: false };
      return;
    }
    const inhabited = Object.keys(STATIONS).length;
    const mine = controlledStations(state, p).length;
    if (!state.victoryAnnounced && mine >= VICTORY_STATIONS) {
      state.victoryAnnounced = true;
      state.gameOver = {
        winner: p,
        reason: `${factionName(p)} controla ${mine} de las ${inhabited} estaciones del metro. Vlianska tiene un nuevo amo.`,
        hour: state.hour,
        victory: true,
      };
      return;
    }
  }
  if (state.hour >= END_HOUR && !state.globalFlags.fin_2040) {
    state.globalFlags.fin_2040 = state.hour;
    state.gameOver = { winner: null, reason: 'Ha llegado 2040. Es hora de hacer balance de estos siete años bajo tierra.', hour: state.hour, victory: false };
  }
}

export function advanceDay(state: GameState) {
  invalidateMods(state);
  logYearStart(state);
  const alive = aliveFactions(state);
  for (const f of alive) expireSpirits(state, f);
  for (const f of alive) updateDerived(state, f);
  for (const f of alive) {
    if (!state.countries[f].alive) continue;
    dailyEconomy(state, f);
    dailyResearch(state, f);
    dailyFocus(state, f);
    dailyDecisions(state, f);
    dailyJustify(state, f);
    dailyRecruitment(state, f);
    dailyUnits(state, f);
    dailyPopularityDrift(state, f);
    validateTrades(state, f);
  }
  resolveOverlaps(state);
  dailyFrontControl(state);
  dailyDiplomacy(state);
  dailySurrender(state);
  dailyDanger(state);
  dailyNests(state);
  dailyEvents(state);
  for (const f of aliveFactions(state)) {
    if (f !== state.player) runAI(state, f);
  }
  if (isNewMonth(state.hour)) {
    for (const f of aliveFactions(state)) monthlyPopulation(state, f);
    monthlyResistance(state);
    snapshot(state);
  }
  checkEnd(state);
}

function logYearStart(state: GameState) {
  const d = dateOf(state.hour);
  if (d.getUTCMonth() === 0 && d.getUTCDate() === 1) addLog(state, { text: `Comienza el año ${d.getUTCFullYear()}.`, kind: 'info', quiet: true });
}
