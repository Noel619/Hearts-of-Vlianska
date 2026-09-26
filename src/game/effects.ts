// Ejecución de efectos del lenguaje de contenido (enfoques, eventos, decisiones).
import { MAP } from '../data';
import type { Effect, GameState } from './types';
import { EQUIPMENT_IDS } from './types';
import { check, resolveStation, resolveTarget, type Ctx } from './conditions';
import { addLog, changeRelation, clamp, factionName, stationName } from './helpers';
import { invalidateMods, mod as modValue } from './modifiers';
import { chance, rand, randInt } from './rng';
import { addSpirit, removeSpirit, changePopularity, setIdeology, setLeader } from './politics';
import { grantTech } from './research';
import { scheduleEvent, fireEvent } from './events';
import {
  addEmbargo,
  addGuarantee,
  addNap,
  addToPact,
  annexCountry,
  createPact,
  declareWar,
  grantAccess,
  joinWar,
  leavePact,
  liftEmbargo,
  makeSubject,
  releaseSubject,
  removeGuarantee,
  revokeAccess,
  transferStation,
  whitePeace,
} from './diplomacy';
import { addTemplate, spawnUnit } from './military';
import { crushRevolt, liberateStation } from './resistance';

export function applyEffects(state: GameState, effects: Effect[] | undefined, ctx: Ctx) {
  if (!effects) return;
  for (const e of effects) applyEffect(state, e, ctx);
  invalidateMods(state);
}

function stationOr(state: GameState, ctx: Ctx, ref: string): string | null {
  const s = resolveStation(state, ctx, ref);
  if (!s || !state.stations[s]) return null;
  return s;
}

export function applyEffect(state: GameState, e: Effect, ctx: Ctx) {
  const c = state.countries[ctx.root];
  switch (e.t) {
    case 'pp':
      c.pp = Math.max(0, c.pp + e.v);
      break;
    case 'stability':
      c.stabilityBase = clamp(c.stabilityBase + e.v, -0.5, 1.5);
      break;
    case 'warSupport':
      c.warSupportBase = clamp(c.warSupportBase + e.v, -0.5, 1.5);
      break;
    case 'population': {
      const s = stationOr(state, ctx, e.station);
      if (s) state.stations[s].population = Math.max(0, state.stations[s].population + e.v);
      break;
    }
    case 'addSpirit':
      addSpirit(state, ctx.root, e.id, e.days);
      break;
    case 'removeSpirit':
      removeSpirit(state, ctx.root, e.id);
      break;
    case 'building': {
      const s = stationOr(state, ctx, e.station);
      if (!s) break;
      if (e.b === 'fortificacion') {
        state.provinces[s].fort = clamp(state.provinces[s].fort + e.v, 0, 5);
      } else {
        const st = state.stations[s];
        st.buildings[e.b] = Math.max(0, st.buildings[e.b] + e.v);
        const used = st.buildings.civil + st.buildings.militar + st.buildings.granja;
        if (used > st.slots) st.slots = used;
      }
      break;
    }
    case 'slots': {
      const s = stationOr(state, ctx, e.station);
      if (s) state.stations[s].slots = Math.max(0, state.stations[s].slots + e.v);
      break;
    }
    case 'resource': {
      const s = stationOr(state, ctx, e.station);
      if (s) state.stations[s].resources[e.res] = Math.max(0, state.stations[s].resources[e.res] + e.v);
      break;
    }
    case 'stock':
      c.stockpile[e.eq] = Math.max(0, c.stockpile[e.eq] + e.v);
      break;
    case 'food':
      c.food = Math.max(0, c.food + e.v);
      break;
    case 'researchSlot':
      c.research.slots = Math.max(1, Math.min(6, c.research.slots + e.v));
      while (c.research.active.length < c.research.slots) c.research.active.push(null);
      break;
    case 'researchBonus':
      state.nextId++;
      c.research.bonuses.push({ id: `b${state.nextId}`, cat: e.cat, v: e.v, uses: e.uses ?? 1, label: e.label ?? 'Enfoque nacional' });
      break;
    case 'tech':
      grantTech(state, ctx.root, e.id);
      break;
    case 'claim': {
      const s = stationOr(state, ctx, e.station);
      if (s && !state.stations[s].claims.includes(ctx.root)) state.stations[s].claims.push(ctx.root);
      break;
    }
    case 'core': {
      const s = stationOr(state, ctx, e.station);
      if (s && !state.stations[s].cores.includes(ctx.root)) state.stations[s].cores.push(ctx.root);
      break;
    }
    case 'wargoal': {
      const t = resolveTarget(state, ctx, e.target);
      if (!t || t === ctx.root) break;
      c.wargoals = c.wargoals.filter((w) => w.target !== t);
      c.wargoals.push({ target: t, progress: 1, ready: true, expires: state.hour + 24 * 540 });
      break;
    }
    case 'declareWar': {
      const t = resolveTarget(state, ctx, e.target);
      if (t && state.countries[t].alive) declareWar(state, ctx.root, t, { force: true });
      break;
    }
    case 'relation': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) changeRelation(state, ctx.root, t, e.v, e.mutual !== false);
      break;
    }
    case 'popularity':
      changePopularity(state, ctx.root, e.id, e.v);
      break;
    case 'setIdeology':
      setIdeology(state, ctx.root, e.id, e.leader);
      break;
    case 'setLeader':
      setLeader(state, ctx.root, e.leader);
      break;
    case 'flag':
      c.flags[e.id] = e.v ?? state.hour;
      break;
    case 'clearFlag':
      delete c.flags[e.id];
      break;
    case 'globalFlag':
      state.globalFlags[e.id] = state.hour;
      break;
    case 'event': {
      const t = e.target ? resolveTarget(state, ctx, e.target) : ctx.root;
      if (!t || !state.countries[t].alive) break;
      if (e.days) scheduleEvent(state, t, e.id, e.days * 24, ctx.root, ctx.target);
      else fireEvent(state, t, e.id, { from: ctx.root, target: ctx.target });
      break;
    }
    case 'unit': {
      const s = stationOr(state, ctx, e.station) ?? c.capital;
      const where = state.provinces[s]?.controller === ctx.root ? s : c.capital;
      for (let i = 0; i < (e.count ?? 1); i++) spawnUnit(state, ctx.root, e.template, where, { name: e.name });
      break;
    }
    case 'template':
      addTemplate(state, ctx.root, e.id);
      break;
    case 'tension':
      state.tension = clamp(state.tension + e.v, 0, 1);
      break;
    case 'unlockDecision':
      if (!c.unlockedDecisions.includes(e.id)) c.unlockedDecisions.push(e.id);
      break;
    case 'annex': {
      const t = resolveTarget(state, ctx, e.target);
      if (t && t !== ctx.root && state.countries[t].alive) annexCountry(state, ctx.root, t);
      break;
    }
    case 'makeSubject': {
      const t = resolveTarget(state, ctx, e.target);
      if (t && t !== ctx.root) makeSubject(state, ctx.root, t);
      break;
    }
    case 'releaseSubject': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) releaseSubject(state, ctx.root, t);
      break;
    }
    case 'createPact':
      createPact(state, ctx.root, e.name);
      break;
    case 'joinPact': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) addToPact(state, t, ctx.root);
      break;
    }
    case 'addToPact': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) addToPact(state, ctx.root, t);
      break;
    }
    case 'leavePact':
      leavePact(state, ctx.root);
      break;
    case 'nap': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) addNap(state, ctx.root, t, e.days ?? 730);
      break;
    }
    case 'access': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) grantAccess(state, ctx.root, t);
      break;
    }
    case 'revokeAccess': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) revokeAccess(state, ctx.root, t);
      break;
    }
    case 'guarantee': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) addGuarantee(state, ctx.root, t);
      break;
    }
    case 'removeGuarantee': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) removeGuarantee(state, ctx.root, t);
      break;
    }
    case 'embargo': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) addEmbargo(state, ctx.root, t);
      break;
    }
    case 'liftEmbargo': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) liftEmbargo(state, ctx.root, t);
      break;
    }
    case 'whitePeace': {
      const t = resolveTarget(state, ctx, e.target);
      if (t) whitePeace(state, ctx.root, t);
      break;
    }
    case 'danger': {
      const pid = e.province === 'TARGET' ? ctx.target : e.province;
      if (pid && state.provinces[pid]) state.provinces[pid].danger = clamp(state.provinces[pid].danger + e.v, 0, 100);
      break;
    }
    case 'dangerAll': {
      for (const p of Object.values(state.provinces)) {
        if (p.controller === ctx.root) p.danger = clamp(p.danger + e.v, 0, 100);
      }
      break;
    }
    case 'clearCollapse': {
      const pid = e.province === 'TARGET' ? ctx.target : e.province;
      if (pid && state.provinces[pid]) {
        state.provinces[pid].collapsed = false;
        addLog(state, { text: `${MAP.provinces[pid].name} vuelve a ser transitable.`, kind: 'info', province: pid });
      }
      break;
    }
    case 'openEdge': {
      const ids = MAP.edges.filter((x) => x.id === e.edge || x.tunnel === e.edge).map((x) => x.id);
      for (const id of ids) if (!state.openEdges.includes(id)) state.openEdges.push(id);
      break;
    }
    case 'transferStation': {
      const s = stationOr(state, ctx, e.station);
      const t = resolveTarget(state, ctx, e.to);
      if (s && t) transferStation(state, s, t);
      break;
    }
    case 'fortAround': {
      const s = stationOr(state, ctx, e.station);
      if (!s) break;
      state.provinces[s].fort = clamp(state.provinces[s].fort + e.v, 0, 5);
      for (const { to } of MAP.adjacency[s]) {
        if (state.provinces[to].controller === ctx.root) state.provinces[to].fort = clamp(state.provinces[to].fort + e.v, 0, 5);
      }
      break;
    }
    case 'manpowerBonus':
      c.manpowerBonus += e.v;
      break;
    case 'unitsHeal':
      for (const u of Object.values(state.units)) {
        if (u.owner === ctx.root) u.strength = Math.min(1, u.strength + e.v);
      }
      break;
    case 'withdrawUnits': {
      const s = stationOr(state, ctx, e.from);
      if (!s) break;
      for (const u of Object.values(state.units)) {
        if (u.owner === ctx.root && u.province === s && !u.battle) {
          u.province = c.capital;
          u.path = [];
          u.moveProgress = 0;
        }
      }
      break;
    }
    case 'log':
      addLog(state, { text: e.text, kind: 'evento', faction: ctx.root });
      break;
    case 'if':
      if (check(state, e.cond, ctx)) applyEffects(state, e.then, ctx);
      else applyEffects(state, e.else, ctx);
      break;
    case 'random':
      if (chance(state, e.chance)) applyEffects(state, e.then, ctx);
      else applyEffects(state, e.else, ctx);
      break;
    case 'scoped': {
      const t = resolveTarget(state, ctx, e.target);
      if (t && state.countries[t].alive) applyEffects(state, e.effects, { root: t, from: ctx.root, target: ctx.target });
      break;
    }
    case 'custom':
      runCustom(state, e.id, ctx, e.arg);
      break;
  }
}

// ---------------------------------------------------------------------------
// Efectos especiales
// ---------------------------------------------------------------------------

function runCustom(state: GameState, id: string, ctx: Ctx, arg?: string | number) {
  const c = state.countries[ctx.root];
  switch (id) {
    case 'expedicion': {
      // Expedición a la superficie: resultado aleatorio según la bonificación.
      const bonus = modValue(state, ctx.root, 'expediciones');
      const roll = rand(state) + bonus * 0.35;
      if (roll < 0.2) {
        const lost = randInt(state, 3, 8);
        c.manpowerBonus -= lost;
        addLog(state, { text: `La expedición a la superficie no regresó. Se perdieron ${lost} stalkers.`, kind: 'malo', faction: ctx.root });
        c.stabilityBase = clamp(c.stabilityBase - 0.01, -0.5, 1.5);
      } else if (roll < 0.55) {
        const armas = randInt(state, 10, 25);
        c.stockpile.armas += armas;
        addLog(state, { text: `La expedición regresó con ${armas} armas ligeras de un cuartel abandonado.`, kind: 'bueno', faction: ctx.root });
      } else if (roll < 0.85) {
        const st = c.capital;
        const res = (['chatarra', 'polvora', 'combustible'] as const)[randInt(state, 0, 2)];
        state.stations[st].resources[res] += 1;
        addLog(state, { text: `La expedición encontró un depósito en la superficie: +1 de ${res} diario en ${stationName(st)}.`, kind: 'bueno', faction: ctx.root });
      } else {
        c.research.bonuses.push({ id: `b${++state.nextId}`, cat: 'industria', v: 0.5, uses: 1, label: 'Planos de la superficie' });
        c.stockpile.apoyo += randInt(state, 5, 12);
        addLog(state, { text: 'La expedición recuperó planos y equipo técnico de una fábrica en ruinas.', kind: 'bueno', faction: ctx.root });
      }
      break;
    }
    case 'saqueo': {
      // Asalto a caravanas de TARGET (una facción vecina).
      const t = resolveTarget(state, ctx, 'TARGET');
      if (!t) break;
      const bonus = modValue(state, ctx.root, 'saqueo');
      const success = chance(state, 0.65 + bonus * 0.2);
      if (success) {
        const armas = Math.round(randInt(state, 8, 18) * (1 + bonus));
        const food = Math.round(randInt(state, 15, 35) * (1 + bonus));
        c.stockpile.armas += armas;
        c.food += food;
        const tc = state.countries[t];
        tc.food = Math.max(0, tc.food - food);
        tc.stockpile.armas = Math.max(0, tc.stockpile.armas - Math.round(armas / 2));
        changeRelation(state, ctx.root, t, -15);
        addLog(state, {
          text: `Los saqueadores asaltan una caravana de ${factionName(t)}: +${armas} armas, +${food} raciones.`,
          kind: ctx.root === state.player ? 'bueno' : 'malo',
          faction: ctx.root,
        });
        if (state.player === t) fireEvent(state, t, 'gen_caravana_asaltada', { from: ctx.root });
      } else {
        const lost = randInt(state, 3, 8);
        c.manpowerBonus -= lost;
        changeRelation(state, ctx.root, t, -10);
        addLog(state, { text: `El asalto a la caravana de ${factionName(t)} fracasa: ${lost} saqueadores muertos.`, kind: 'malo', faction: ctx.root });
      }
      break;
    }
    case 'colonizar': {
      const s = ctx.target ?? 'TEN';
      const st = state.stations[s];
      if (!st || st.owner) break;
      transferStation(state, s, ctx.root);
      st.population = Math.max(st.population, Number(arg ?? 80));
      if (!st.cores.includes(ctx.root)) st.cores.push(ctx.root);
      state.provinces[s].danger = 20;
      for (const { to } of MAP.adjacency[s]) {
        state.provinces[to].danger = clamp(state.provinces[to].danger - 20, 0, 100);
        if (!state.provinces[to].controller) state.provinces[to].controller = ctx.root;
      }
      addLog(state, { text: `${factionName(ctx.root)} recoloniza ${stationName(s)}.`, kind: 'diplo', faction: ctx.root, province: s });
      break;
    }
    case 'integrar': {
      const s = ctx.target;
      if (s && state.stations[s] && !state.stations[s].cores.includes(ctx.root)) state.stations[s].cores.push(ctx.root);
      break;
    }
    case 'excavar': {
      const pid = ctx.target;
      if (pid && state.provinces[pid]) {
        state.provinces[pid].collapsed = false;
        addLog(state, { text: `Los zapadores de ${factionName(ctx.root)} despejan ${MAP.provinces[pid].name}.`, kind: 'info', province: pid });
      }
      break;
    }
    case 'batida': {
      const pid = ctx.target;
      if (!pid) break;
      state.provinces[pid].danger = clamp(state.provinces[pid].danger - 45, 0, 100);
      state.provinces[pid].suppressedUntil = state.hour + 24 * 240;
      for (const { to } of MAP.adjacency[pid]) state.provinces[to].danger = clamp(state.provinces[to].danger - 15, 0, 100);
      break;
    }
    case 'mercenarios': {
      spawnUnit(state, ctx.root, String(arg ?? 'mercenarios'), c.capital);
      break;
    }
    case 'repartirEquipo': {
      // Entrega equipo a TARGET (ayuda militar).
      const t = resolveTarget(state, ctx, 'TARGET') ?? ctx.from;
      if (!t) break;
      const n = Number(arg ?? 40);
      const give = Math.min(n, c.stockpile.armas);
      c.stockpile.armas -= give;
      state.countries[t].stockpile.armas += give;
      break;
    }
    case 'unirseGuerra': {
      // ROOT se une a la guerra de FROM contra TARGET (llamada a las armas).
      const ally = ctx.from;
      const enemy = resolveTarget(state, ctx, 'TARGET');
      if (!ally || !enemy) break;
      const war = state.wars.find((w) => (w.attackers.includes(ally) && w.defenders.includes(enemy)) || (w.defenders.includes(ally) && w.attackers.includes(enemy)));
      if (war) joinWar(state, ctx.root, war.id, war.attackers.includes(ally) ? 'att' : 'def');
      break;
    }
    case 'limpiarPermanente': {
      const pid = String(arg ?? ctx.target ?? '');
      const ids = pid.split(',');
      for (const id of ids) {
        const p = state.provinces[id];
        if (!p) continue;
        p.danger = 8;
        p.suppressedUntil = state.hour + 24 * 365 * 20;
      }
      break;
    }
    case 'inundacion': {
      const days = Number(arg ?? 30);
      const options = MAP.provinceList.filter((p) => p.underRiver && state.provinces[p.id].controller === ctx.root);
      if (options.length === 0) break;
      const p = options[randInt(state, 0, options.length - 1)];
      state.provinces[p.id].floodedUntil = state.hour + days * 24;
      addLog(state, { text: `${p.name} queda inundado durante ${days} días.`, kind: 'malo', faction: ctx.root, province: p.id });
      break;
    }
    case 'aplastarRevuelta':
      if (ctx.target) crushRevolt(state, ctx.root, ctx.target);
      break;
    case 'liberarEstacion':
      if (ctx.target && ctx.from) liberateStation(state, ctx.root, ctx.target, ctx.from);
      break;
    case 'robarEquipo': {
      for (const eq of EQUIPMENT_IDS) c.stockpile[eq] += Math.round(c.stockpile[eq] * 0.1);
      break;
    }
    default:
      break;
  }
}
