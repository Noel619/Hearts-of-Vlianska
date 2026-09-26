// Decisiones: acciones con coste que el jugador (y la IA) pueden tomar.
import { DECISIONS, MAP, STATIONS } from '../data';
import type { DecisionDef, FactionId, GameState } from './types';
import { check } from './conditions';
import { addLog, factionName, isAtWarWith, neighborFactions, neighbors, ownedStations, provinceName } from './helpers';
import { killMen } from './military';
import { mod } from './modifiers';
import { applyEffects } from './effects';

export interface DecisionTarget {
  id: string;
  label: string;
}

export function decisionCost(state: GameState, f: FactionId, d: DecisionDef) {
  const k = Math.max(0.2, 1 + mod(state, f, 'costeDecisiones'));
  return {
    pp: d.cost?.pp ? Math.round(d.cost.pp * k) : 0,
    manpower: d.cost?.manpower ?? 0,
    food: d.cost?.food ?? 0,
    armas: d.cost?.armas ?? 0,
  };
}

export function decisionTargets(state: GameState, f: FactionId, d: DecisionDef): DecisionTarget[] | null {
  if (!d.targets) return null;
  const ctrl = (pid: string) => state.provinces[pid].controller;
  const nearOwn = (pid: string, hops: number) => {
    let frontier = [pid];
    const seen = new Set(frontier);
    for (let i = 0; i < hops; i++) {
      const next: string[] = [];
      for (const p of frontier) {
        for (const n of neighbors(state, p)) {
          if (seen.has(n.to)) continue;
          if (ctrl(n.to) === f) return true;
          seen.add(n.to);
          next.push(n.to);
        }
      }
      frontier = next;
    }
    return false;
  };
  switch (d.targets) {
    case 'dangerProvince':
      return Object.keys(state.provinces)
        .filter((pid) => {
          const p = state.provinces[pid];
          if (p.danger < 25 || p.collapsed) return false;
          if (p.controller && p.controller !== f && isAtWarWith(state, f, p.controller)) return false;
          return p.controller === f || nearOwn(pid, 1);
        })
        .sort((a, b) => state.provinces[b].danger - state.provinces[a].danger)
        .map((pid) => ({ id: pid, label: `${provinceName(pid)} (peligro ${Math.round(state.provinces[pid].danger)})` }));
    case 'collapse':
      return Object.keys(state.provinces)
        .filter((pid) => state.provinces[pid].collapsed && neighbors(state, pid).some((n) => ctrl(n.to) === f))
        .map((pid) => ({ id: pid, label: provinceName(pid) }));
    case 'raidTarget':
      return neighborFactions(state, f, 5)
        .filter((t) => !isAtWarWith(state, f, t))
        .map((t) => ({ id: t, label: factionName(t) }));
    case 'neighbor':
      return neighborFactions(state, f, 5).map((t) => ({ id: t, label: factionName(t) }));
    case 'ownedNonCore':
      return ownedStations(state, f)
        .filter((s) => !state.stations[s].cores.includes(f) && state.hour - state.stations[s].ownedSince >= 24 * 120)
        .map((s) => ({ id: s, label: STATIONS[s].name }));
    case 'abandoned':
      return Object.keys(state.stations)
        .filter((s) => !state.stations[s].owner && Object.values(state.units).some((u) => u.owner === f && u.province === s))
        .map((s) => ({ id: s, label: STATIONS[s].name }));
  }
  return [];
}

export function decisionVisible(state: GameState, f: FactionId, d: DecisionDef): boolean {
  if (d.factions && !d.factions.includes(f)) return false;
  if (d.unlockedBy && !state.countries[f].unlockedDecisions.includes(d.id)) return false;
  if (d.once && state.countries[f].flags[`dec_${d.id}`] !== undefined) return false;
  return check(state, d.visible, { root: f });
}

export function canTakeDecision(state: GameState, f: FactionId, id: string, target?: string): { ok: boolean; reason?: string } {
  const d = DECISIONS[id];
  if (!d) return { ok: false, reason: 'Decisión desconocida.' };
  const c = state.countries[f];
  if (!decisionVisible(state, f, d)) return { ok: false, reason: 'No disponible.' };
  const key = target ? `${id}:${target}` : id;
  if ((c.cooldowns[key] ?? 0) > state.hour) return { ok: false, reason: 'Todavía en espera.' };
  if (c.activeDecisions.some((a) => a.id === id && (a.target ?? '') === (target ?? ''))) return { ok: false, reason: 'Ya está en curso.' };
  if (d.targets) {
    const targets = decisionTargets(state, f, d) ?? [];
    if (!target || !targets.some((t) => t.id === target)) return { ok: false, reason: 'Objetivo no válido.' };
  }
  if (!check(state, d.available, { root: f, target })) return { ok: false, reason: 'No se cumplen los requisitos.' };
  const cost = decisionCost(state, f, d);
  if (c.pp < cost.pp) return { ok: false, reason: `Necesitas ${cost.pp} de poder político.` };
  if (c.derived.manpowerAvailable < cost.manpower) return { ok: false, reason: `Necesitas ${cost.manpower} hombres disponibles.` };
  if (c.food < cost.food) return { ok: false, reason: `Necesitas ${cost.food} raciones.` };
  if (c.stockpile.armas < cost.armas) return { ok: false, reason: `Necesitas ${cost.armas} armas ligeras.` };
  return { ok: true };
}

export function takeDecision(state: GameState, f: FactionId, id: string, target?: string): boolean {
  if (!canTakeDecision(state, f, id, target).ok) return false;
  const d = DECISIONS[id];
  const c = state.countries[f];
  const cost = decisionCost(state, f, d);
  c.pp -= cost.pp;
  c.food -= cost.food;
  c.stockpile.armas -= cost.armas;
  if (cost.manpower && !d.days) killMen(state, f, cost.manpower * 0.3);
  const key = target ? `${id}:${target}` : id;
  if (d.cooldown) c.cooldowns[key] = state.hour + d.cooldown * 24;
  if (d.once) c.flags[`dec_${id}`] = state.hour;
  applyEffects(state, d.effects, { root: f, target });
  if (d.days) c.activeDecisions.push({ id, target, until: state.hour + d.days * 24, manpower: cost.manpower || undefined });
  else applyEffects(state, d.completeEffects, { root: f, target });
  if (state.player === f) addLog(state, { text: `Decisión: ${d.name}${target ? ` (${targetLabel(target)})` : ''}.`, kind: 'info', faction: f });
  return true;
}

function targetLabel(target: string) {
  return STATIONS[target]?.shortName ?? MAP.provinces[target]?.name ?? factionName(target as FactionId);
}

export function dailyDecisions(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const done = c.activeDecisions.filter((a) => a.until <= state.hour);
  if (done.length === 0) return;
  c.activeDecisions = c.activeDecisions.filter((a) => a.until > state.hour);
  for (const a of done) {
    const d = DECISIONS[a.id];
    if (!d) continue;
    applyEffects(state, d.completeEffects, { root: f, target: a.target });
    if (state.player === f) addLog(state, { text: `Completada: ${d.name}${a.target ? ` (${targetLabel(a.target)})` : ''}.`, kind: 'bueno', faction: f });
  }
}

export function visibleDecisions(state: GameState, f: FactionId): DecisionDef[] {
  return Object.values(DECISIONS).filter((d) => decisionVisible(state, f, d));
}

