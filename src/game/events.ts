// Eventos: disparo por tiempo medio (MTTH), eventos encadenados y respuestas.
import { EVENTS, FACTIONS, STATIONS } from '../data';
import type { EventDef, FactionId, GameState, PendingEvent } from './types';
import { FACTION_IDS } from './types';
import { check, type Ctx } from './conditions';
import { aliveFactions, factionName, newId } from './helpers';
import { chance, weightedPick } from './rng';
import { applyEffects } from './effects';

export function eventText(text: string, ctx: { root: FactionId; from?: FactionId; target?: string }): string {
  return text
    .replace(/\[ROOT\]/g, factionName(ctx.root))
    .replace(/\[FROM\]/g, ctx.from ? factionName(ctx.from) : '—')
    .replace(/\[TARGET\]/g, () => {
      if (!ctx.target) return '—';
      if ((FACTION_IDS as string[]).includes(ctx.target)) return factionName(ctx.target as FactionId);
      return STATIONS[ctx.target]?.name ?? ctx.target;
    })
    .replace(/\[FROM_LEADER\]/g, ctx.from ? FACTIONS[ctx.from].name : '—');
}

export function fireEvent(state: GameState, f: FactionId, id: string, opts: { from?: FactionId; target?: string } = {}) {
  const ev = EVENTS[id];
  if (!ev || !state.countries[f].alive) return;
  const c = state.countries[f];
  c.firedEvents[id] = (c.firedEvents[id] ?? 0) + 1;
  c.flags[`ev:${id}`] = state.hour;
  if (ev.news) {
    const ctx = { root: f, from: opts.from, target: opts.target };
    state.news.push({ hour: state.hour, title: eventText(ev.title, ctx), text: eventText(ev.desc, ctx), picture: ev.picture });
    if (state.news.length > 60) state.news.splice(0, state.news.length - 60);
  }
  if (state.player === f) {
    const pe: PendingEvent = { uid: newId(state, 'e'), id, from: opts.from, target: opts.target, hour: state.hour };
    state.playerEvents.push(pe);
    return;
  }
  aiAnswer(state, f, ev, opts);
}

function aiAnswer(state: GameState, f: FactionId, ev: EventDef, opts: { from?: FactionId; target?: string }) {
  const ctx: Ctx = { root: f, from: opts.from, target: opts.target };
  const options = ev.options.map((o, i) => ({ item: i, weight: check(state, o.available, ctx) ? (o.ai ?? (i === 0 ? 2 : 1)) : 0 }));
  if (state.historicalAI) {
    // En modo histórico se toma siempre la opción de mayor peso.
    options.sort((a, b) => b.weight - a.weight);
    applyEffects(state, ev.options[options[0].item].effects, ctx);
    return;
  }
  const pick = weightedPick(state, options);
  applyEffects(state, ev.options[pick ?? 0].effects, ctx);
}

export function answerEvent(state: GameState, uid: string, optionIndex: number) {
  const pe = state.playerEvents.find((e) => e.uid === uid);
  if (!pe || !state.player) return;
  const ev = EVENTS[pe.id];
  state.playerEvents = state.playerEvents.filter((e) => e.uid !== uid);
  if (!ev) return;
  const opt = ev.options[optionIndex] ?? ev.options[0];
  const ctx: Ctx = { root: state.player, from: pe.from, target: pe.target };
  if (!check(state, opt.available, ctx)) return;
  applyEffects(state, opt.effects, ctx);
}

export function scheduleEvent(state: GameState, f: FactionId, id: string, hours: number, from?: FactionId, target?: string) {
  state.scheduled.push({ hour: state.hour + hours, country: f, event: id, from, target });
}

export function processScheduled(state: GameState) {
  if (state.scheduled.length === 0) return;
  const due = state.scheduled.filter((s) => s.hour <= state.hour);
  if (due.length === 0) return;
  state.scheduled = state.scheduled.filter((s) => s.hour > state.hour);
  for (const s of due) fireEvent(state, s.country, s.event, { from: s.from, target: s.target });
}

const REPEAT_COOLDOWN_DAYS = 150;
const MTTH_EVENTS = () => Object.values(EVENTS).filter((e) => !e.triggeredOnly && e.mtth);

export function dailyEvents(state: GameState) {
  const list = MTTH_EVENTS();
  for (const f of aliveFactions(state)) {
    const c = state.countries[f];
    for (const ev of list) {
      if (ev.factions && !ev.factions.includes(f)) continue;
      if (ev.once !== false && c.firedEvents[ev.id]) continue;
      if (ev.once === false && state.hour - (c.flags[`ev:${ev.id}`] ?? -1e9) < 24 * REPEAT_COOLDOWN_DAYS) continue;
      if (!check(state, ev.trigger, { root: f })) continue;
      const p = 1 - Math.pow(0.5, 1 / (ev.mtth ?? 100));
      if (chance(state, p)) fireEvent(state, f, ev.id);
    }
  }
}

export function pendingEventDef(pe: PendingEvent): EventDef | undefined {
  return EVENTS[pe.id];
}
