// Evaluación de condiciones del lenguaje de contenido.
import type { Condition, FactionId, GameState, Target } from './types';
import { FACTION_IDS } from './types';
import {
  embargoed,
  hasAccess,
  hasNap,
  isAtWar,
  isAtWarWith,
  ownedStations,
  pactOf,
  relation,
  samePact,
} from './helpers';
import { dateOf, hourOfDate } from './time';
import { MAP } from '../data';

export interface Ctx {
  root: FactionId;
  from?: FactionId;
  target?: string;
}

export function resolveTarget(state: GameState, ctx: Ctx, t: Target): FactionId | null {
  if (t === 'ROOT') return ctx.root;
  if (t === 'FROM') return ctx.from ?? null;
  if (t === 'TARGET') {
    if (!ctx.target) return null;
    if ((FACTION_IDS as string[]).includes(ctx.target)) return ctx.target as FactionId;
    return state.stations[ctx.target]?.owner ?? state.provinces[ctx.target]?.controller ?? null;
  }
  return t;
}

export function resolveStation(state: GameState, ctx: Ctx, ref: string): string | null {
  if (ref === 'CAPITAL') return state.countries[ctx.root].capital;
  if (ref === 'TARGET') return ctx.target ?? null;
  return ref;
}

function inRange(v: number, min?: number, max?: number) {
  if (min !== undefined && v < min) return false;
  if (max !== undefined && v > max) return false;
  return true;
}

export function militaryStrength(state: GameState, f: FactionId): number {
  let s = 0;
  for (const u of Object.values(state.units)) {
    if (u.owner === f) s += u.strength;
  }
  return s + state.countries[f].derived.milTotal * 0.15;
}

export function check(state: GameState, cond: Condition | undefined, ctx: Ctx): boolean {
  if (!cond) return true;
  const c = state.countries[ctx.root];
  switch (cond.c) {
    case 'hasFocus':
      return c.focus.done.includes(cond.id);
    case 'hasTech':
      return c.research.done.includes(cond.id);
    case 'hasFlag':
      return c.flags[cond.id] !== undefined;
    case 'hasGlobalFlag':
      return state.globalFlags[cond.id] !== undefined;
    case 'hasSpirit':
      return c.spirits.some((s) => s.id === cond.id);
    case 'atWar':
      return isAtWar(state, ctx.root);
    case 'atWarWith': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && isAtWarWith(state, ctx.root, t);
    }
    case 'controls': {
      const s = resolveStation(state, ctx, cond.station);
      return !!s && state.provinces[s]?.controller === ctx.root;
    }
    case 'owns': {
      const s = resolveStation(state, ctx, cond.station);
      return !!s && state.stations[s]?.owner === ctx.root;
    }
    case 'stationFree':
      return !!state.stations[cond.station] && !state.stations[cond.station].owner;
    case 'exists': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && state.countries[t].alive;
    }
    case 'isFaction':
      return ctx.root === cond.id;
    case 'isPlayer':
      return state.player === ctx.root;
    case 'stability':
      return inRange(c.derived.stability, cond.min, cond.max);
    case 'warSupport':
      return inRange(c.derived.warSupport, cond.min, cond.max);
    case 'pp':
      return c.pp >= cond.min;
    case 'manpower':
      return c.derived.manpowerAvailable >= cond.min;
    case 'ideology':
      return c.ideology === cond.id;
    case 'targetIdeology': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && state.countries[t].ideology === cond.id;
    }
    case 'popularity':
      return inRange(c.popularity[cond.id], cond.min, cond.max);
    case 'targetPopularity': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && state.countries[t].popularity[cond.id] >= (cond.min ?? 0);
    }
    case 'date': {
      if (cond.after && state.hour < hourOfDate(cond.after)) return false;
      if (cond.before && state.hour >= hourOfDate(cond.before)) return false;
      return true;
    }
    case 'month':
      return cond.in.includes(dateOf(state.hour).getUTCMonth() + 1);
    case 'tension':
      return inRange(state.tension, cond.min, cond.max);
    case 'inPactWith': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && samePact(state, ctx.root, t);
    }
    case 'inPact':
      return !!pactOf(state, ctx.root);
    case 'isPactLeader':
      return pactOf(state, ctx.root)?.leader === ctx.root;
    case 'relation': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && inRange(relation(state, ctx.root, t), cond.min, cond.max);
    }
    case 'stations':
      return inRange(ownedStations(state, ctx.root).length, cond.min, cond.max);
    case 'units':
      return inRange(Object.values(state.units).filter((u) => u.owner === ctx.root).length, cond.min, cond.max);
    case 'food':
      return inRange(c.food, cond.min, cond.max);
    case 'foodBalance':
      return inRange(c.derived.foodProd - c.derived.foodCons + c.derived.foodTrade, cond.min, cond.max);
    case 'edgeOpen': {
      const p = state.provinces[cond.province];
      if (p) return !p.collapsed;
      return state.openEdges.some((e) => MAP.edgeById[e]?.tunnel === cond.province);
    }
    case 'hasNap': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && hasNap(state, ctx.root, t);
    }
    case 'hasAccess': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && hasAccess(state, ctx.root, t);
    }
    case 'embargoes': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && embargoed(state, ctx.root, t);
    }
    case 'isSubject':
      return !!c.overlord;
    case 'subjectOf': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && c.overlord === t;
    }
    case 'provinceDanger':
      return inRange(state.provinces[cond.province]?.danger ?? 0, cond.min, cond.max);
    case 'strongerThan': {
      const t = resolveTarget(state, ctx, cond.target);
      if (!t) return false;
      return militaryStrength(state, ctx.root) >= militaryStrength(state, t) * (cond.ratio ?? 1);
    }
    case 'hasWargoal': {
      const t = resolveTarget(state, ctx, cond.target);
      return !!t && c.wargoals.some((w) => w.target === t && w.ready);
    }
    case 'surrender':
      return c.surrender >= (cond.min ?? 0);
    case 'leader':
      return c.leader === cond.id;
    case 'and':
      return cond.list.every((x) => check(state, x, ctx));
    case 'or':
      return cond.list.some((x) => check(state, x, ctx));
    case 'not':
      return !check(state, cond.cond, ctx);
    case 'scoped': {
      const t = resolveTarget(state, ctx, cond.target);
      if (!t) return false;
      return check(state, cond.cond, { root: t, from: ctx.root });
    }
  }
  return false;
}
