// Descripción en texto de efectos y condiciones (para los tooltips de la interfaz).
import {
  BUILDINGS,
  DECISIONS,
  EQUIPMENT,
  EVENTS,
  FACTIONS,
  FOCUS_BY_ID,
  IDEOLOGIES,
  LEADERS,
  MAP,
  SPECIAL_TEMPLATES,
  SPIRITS,
  STATIONS,
  TECH_BY_ID,
  TECH_CATEGORIES,
} from '../data';
import type { Condition, Effect, FactionId, GameState, Target } from './types';
import { FACTION_IDS } from './types';
import { check, type Ctx } from './conditions';
import { describeMods } from './modifiers';
import { formatDate, hourOfDate } from './time';

export type Tone = 'good' | 'bad' | 'neutral' | 'title';

export interface Line {
  text: string;
  tone?: Tone;
  indent?: number;
  met?: boolean;
}

const pct = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.round(Math.abs(v) * 100)} %`;
const num = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v * 10) / 10)}`;
const toneOf = (v: number, positiveGood = true): Tone => (v === 0 ? 'neutral' : (v > 0) === positiveGood ? 'good' : 'bad');

function targetName(t: Target, ctx?: Partial<Ctx>): string {
  if (t === 'ROOT') return ctx?.root ? FACTIONS[ctx.root].name : 'nosotros';
  if (t === 'FROM') return ctx?.from ? FACTIONS[ctx.from].name : 'el emisor';
  if (t === 'TARGET') {
    if (ctx?.target && (FACTION_IDS as string[]).includes(ctx.target)) return FACTIONS[ctx.target as FactionId].name;
    if (ctx?.target && STATIONS[ctx.target]) return STATIONS[ctx.target].name;
    return 'el objetivo';
  }
  return FACTIONS[t]?.name ?? t;
}

/** Facción sobre la que actúa un bloque `scoped`, si se conoce. */
function scopedRoot(t: Target, ctx?: Partial<Ctx>): FactionId | undefined {
  if (t === 'ROOT') return ctx?.root;
  if (t === 'FROM') return ctx?.from;
  if (t === 'TARGET') return ctx?.target && (FACTION_IDS as string[]).includes(ctx.target) ? (ctx.target as FactionId) : undefined;
  return t;
}

/** "nosotros" si los efectos son del jugador; si no, el nombre de la facción. */
function whoName(state?: GameState, ctx?: Partial<Ctx>): string {
  return ctx?.root && state?.player && state.player !== ctx.root ? FACTIONS[ctx.root].name : 'nosotros';
}

function stationName(ref: string, state?: GameState, ctx?: Partial<Ctx>): string {
  if (ref === 'CAPITAL') {
    if (state && ctx?.root) return `${STATIONS[state.countries[ctx.root].capital].shortName} (capital)`;
    return 'la capital';
  }
  if (ref === 'TARGET') return ctx?.target && STATIONS[ctx.target] ? STATIONS[ctx.target].name : 'la estación elegida';
  return STATIONS[ref]?.name ?? ref;
}

function provName(id: string, ctx?: Partial<Ctx>) {
  if (id === 'TARGET') return ctx?.target ? MAP.provinces[ctx.target]?.name ?? 'el objetivo' : 'el objetivo';
  return MAP.provinces[id]?.name ?? id;
}

export function describeEffects(effects: Effect[] | undefined, state?: GameState, ctx?: Partial<Ctx>, indent = 0): Line[] {
  const out: Line[] = [];
  for (const e of effects ?? []) out.push(...describeEffect(e, state, ctx, indent));
  return out;
}

export function describeEffect(e: Effect, state?: GameState, ctx?: Partial<Ctx>, indent = 0): Line[] {
  const L = (text: string, tone: Tone = 'neutral'): Line[] => [{ text, tone, indent }];
  switch (e.t) {
    case 'pp':
      return L(`Poder político: ${num(e.v)}`, toneOf(e.v));
    case 'stability':
      return L(`Estabilidad: ${pct(e.v)}`, toneOf(e.v));
    case 'warSupport':
      return L(`Apoyo a la guerra: ${pct(e.v)}`, toneOf(e.v));
    case 'population':
      return L(`Población de ${stationName(e.station, state, ctx)}: ${num(e.v)} habitantes`, toneOf(e.v));
    case 'addSpirit': {
      const sp = SPIRITS[e.id];
      const lines: Line[] = [{ text: `Nuevo espíritu nacional: ${sp?.name ?? e.id}${e.days ? ` (${e.days} días)` : ''}`, tone: sp?.negative ? 'bad' : 'good', indent }];
      if (sp) for (const m of describeMods(sp.modifiers)) lines.push({ text: m.text, tone: m.tone, indent: indent + 1 });
      return lines;
    }
    case 'removeSpirit':
      return L(`Se elimina el espíritu nacional: ${SPIRITS[e.id]?.name ?? e.id}`, SPIRITS[e.id]?.negative ? 'good' : 'neutral');
    case 'building':
      return L(
        `${e.v > 0 ? 'Construye' : 'Destruye'} ${Math.abs(e.v)} × ${BUILDINGS[e.b].name} en ${stationName(e.station, state, ctx)}`,
        toneOf(e.v),
      );
    case 'slots':
      return L(`Espacios de construcción en ${stationName(e.station, state, ctx)}: ${num(e.v)}`, toneOf(e.v));
    case 'resource':
      return L(`${stationName(e.station, state, ctx)}: ${num(e.v)} de ${e.res} al día`, toneOf(e.v));
    case 'stock':
      return L(`${EQUIPMENT[e.eq].name}: ${num(e.v)}`, toneOf(e.v));
    case 'food':
      return L(`Raciones: ${num(e.v)}`, toneOf(e.v));
    case 'researchSlot':
      return L(`Espacios de investigación: ${num(e.v)}`, toneOf(e.v));
    case 'researchBonus': {
      const cat = TECH_CATEGORIES.find((c) => c.id === e.cat)?.name ?? e.cat;
      return L(`Bonificación de investigación: +${Math.round(e.v * 100)} % en ${cat}${(e.uses ?? 1) > 1 ? ` (${e.uses} usos)` : ''}`, 'good');
    }
    case 'tech':
      return L(`Obtienes la tecnología: ${TECH_BY_ID[e.id]?.name ?? e.id}`, 'good');
    case 'claim':
      return L(`Reclamación sobre ${stationName(e.station, state, ctx)}`, 'neutral');
    case 'core':
      return L(`${stationName(e.station, state, ctx)} pasa a ser núcleo`, 'good');
    case 'wargoal':
      return L(`Objetivo de guerra contra ${targetName(e.target, ctx)}`, 'neutral');
    case 'declareWar':
      return L(`Declara la guerra a ${targetName(e.target, ctx)}`, 'bad');
    case 'relation':
      return L(`Relaciones con ${targetName(e.target, ctx)}: ${num(e.v)}`, toneOf(e.v));
    case 'popularity':
      return L(`Apoyo a ${IDEOLOGIES[e.id].name}: ${num(e.v)} %`, 'neutral');
    case 'setIdeology':
      return L(`Nuevo gobierno ${IDEOLOGIES[e.id].adjective}${e.leader ? ` encabezado por ${LEADERS[e.leader]?.name}` : ''}`, 'neutral');
    case 'setLeader':
      return L(`Nuevo líder: ${LEADERS[e.leader]?.name ?? e.leader}`, 'neutral');
    case 'flag':
    case 'clearFlag':
    case 'globalFlag':
      return [];
    case 'event': {
      const ev = EVENTS[e.id];
      const who = e.target && e.target !== 'ROOT' ? ` a ${targetName(e.target, ctx)}` : '';
      return L(`${e.days ? `Dentro de ${e.days} días: ` : ''}evento «${ev?.title.replace(/\[.*?\]/g, '…') ?? e.id}»${who}`, 'neutral');
    }
    case 'unit': {
      const tpl = SPECIAL_TEMPLATES[e.template];
      const name = tpl?.name ?? (ctx?.root ? state?.countries[ctx.root].templates.find((t) => t.id === e.template)?.name : undefined) ?? e.template;
      return L(`Nueva unidad: ${e.count && e.count > 1 ? `${e.count} × ` : ''}${e.name ?? name} en ${stationName(e.station, state, ctx)}`, 'good');
    }
    case 'template':
      return L(`Nueva plantilla de unidad: ${SPECIAL_TEMPLATES[e.id]?.name ?? e.id}`, 'good');
    case 'tension':
      return L(`Tensión del metro: ${pct(e.v)}`, toneOf(e.v, false));
    case 'unlockDecision':
      return L(`Desbloquea la decisión «${DECISIONS[e.id]?.name ?? e.id}»`, 'good');
    case 'annex':
      return L(`Anexión pacífica de ${targetName(e.target, ctx)}`, 'neutral');
    case 'makeSubject': {
      const owner = ctx?.root && state?.player !== ctx.root ? `protectorado de ${FACTIONS[ctx.root].name}` : 'tu protectorado';
      return L(`${targetName(e.target, ctx)} pasa a ser ${owner}`, 'good');
    }
    case 'releaseSubject':
      return L(`${targetName(e.target, ctx)} deja de ser tu protectorado`, 'neutral');
    case 'createPact':
      return L(`Funda la alianza «${e.name}»`, 'good');
    case 'joinPact':
      return L(`Se une a la alianza de ${targetName(e.target, ctx)}`, 'neutral');
    case 'addToPact':
      return L(`${targetName(e.target, ctx)} entra en tu alianza`, 'good');
    case 'leavePact':
      return L('Abandona su alianza', 'neutral');
    case 'nap':
      return L(`Pacto de no agresión con ${targetName(e.target, ctx)} (${Math.round((e.days ?? 730) / 365)} años)`, 'neutral');
    case 'access':
      return L(`Concede acceso militar a ${targetName(e.target, ctx)}`, 'neutral');
    case 'revokeAccess':
      return L(`Retira el acceso militar a ${targetName(e.target, ctx)}`, 'neutral');
    case 'guarantee':
      return L(`Garantiza la independencia de ${targetName(e.target, ctx)}`, 'neutral');
    case 'removeGuarantee':
      return L(`Retira la garantía de independencia a ${targetName(e.target, ctx)}`, 'neutral');
    case 'embargo':
      return L(`Embargo a ${targetName(e.target, ctx)}`, 'neutral');
    case 'liftEmbargo':
      return L(`Levanta el embargo a ${targetName(e.target, ctx)}`, 'neutral');
    case 'whitePeace':
      return L(`Paz blanca con ${targetName(e.target, ctx)}`, 'neutral');
    case 'danger':
      return L(`Peligro mutante en ${provName(e.province, ctx)}: ${num(e.v)}`, toneOf(e.v, false));
    case 'dangerAll':
      return L(`Peligro mutante en todo tu territorio: ${num(e.v)}`, toneOf(e.v, false));
    case 'clearCollapse':
      return L(`Se despeja el derrumbe: ${provName(e.province, ctx)}`, 'good');
    case 'openEdge':
      return L(`Se abre un túnel nuevo: ${e.edge}`, 'good');
    case 'transferStation':
      return L(`${stationName(e.station, state, ctx)} pasa a ${targetName(e.to, ctx)}`, 'neutral');
    case 'fortAround':
      return L(`Barricadas en ${stationName(e.station, state, ctx)} y sus accesos: ${num(e.v)}`, 'good');
    case 'manpowerBonus':
      return L(`Mano de obra: ${num(e.v)} hombres`, toneOf(e.v));
    case 'unitsHeal':
      return L(`Todas las unidades recuperan fuerza: ${pct(e.v)}`, 'good');
    case 'withdrawUnits':
      return L(`Las tropas en ${stationName(e.from, state, ctx)} vuelven a casa`, 'neutral');
    case 'log':
      return [];
    case 'if': {
      const lines: Line[] = [{ text: 'Si se cumple:', tone: 'neutral', indent }];
      lines.push(...describeCondition(e.cond, state, ctx as Ctx, indent + 1));
      lines.push(...describeEffects(e.then, state, ctx, indent + 1));
      if (e.else?.length) {
        lines.push({ text: 'Si no:', tone: 'neutral', indent });
        lines.push(...describeEffects(e.else, state, ctx, indent + 1));
      }
      return lines;
    }
    case 'random': {
      const lines: Line[] = [{ text: `Con un ${Math.round(e.chance * 100)} % de probabilidad:`, tone: 'neutral', indent }];
      lines.push(...describeEffects(e.then, state, ctx, indent + 1));
      if (e.else?.length) {
        lines.push({ text: 'En caso contrario:', tone: 'neutral', indent });
        lines.push(...describeEffects(e.else, state, ctx, indent + 1));
      }
      return lines;
    }
    case 'scoped': {
      const lines: Line[] = [{ text: `${targetName(e.target, ctx)}:`, tone: 'neutral', indent }];
      lines.push(...describeEffects(e.effects, state, { root: scopedRoot(e.target, ctx), from: ctx?.root, target: ctx?.target }, indent + 1));
      return lines;
    }
    case 'custom':
      return L(e.desc, 'neutral');
    case 'influence': {
      const who = targetName(e.target, ctx);
      const over = whoName(state, ctx);
      // Que otros ganen influencia sobre nosotros es malo; que la ganemos nosotros sobre otros, bueno.
      const tone = over === 'nosotros' ? toneOf(e.v, false) : state?.player && scopedRoot(e.target, ctx) === state.player ? toneOf(e.v) : 'neutral';
      return L(`Influencia de ${who} sobre ${over}: ${e.v > 0 ? '+' : '−'}${Math.abs(e.v)}`, tone);
    }
    case 'influenceDrift': {
      const who = targetName(e.target, ctx);
      const over = whoName(state, ctx);
      const tone = over === 'nosotros' ? toneOf(e.v, false) : 'neutral';
      if (e.set && e.v === 0) return L(`La influencia de ${who} sobre ${over} deja de crecer`, 'neutral');
      if (e.set) return L(`Influencia de ${who} sobre ${over}: ${e.v > 0 ? '+' : '−'}${Math.abs(e.v)} al mes`, tone);
      return L(`Influencia de ${who} sobre ${over}: ${e.v > 0 ? '+' : '−'}${Math.abs(e.v)} más al mes`, tone);
    }
  }
  return [];
}

function range(label: string, min?: number, max?: number, fmt: (v: number) => string = (v) => `${Math.round(v * 100)} %`) {
  if (min !== undefined && max !== undefined) return `${label} entre ${fmt(min)} y ${fmt(max)}`;
  if (min !== undefined) return `${label} de al menos ${fmt(min)}`;
  if (max !== undefined) return `${label} de como mucho ${fmt(max)}`;
  return label;
}

export function conditionText(cond: Condition, ctx?: Partial<Ctx>): string {
  switch (cond.c) {
    case 'hasFocus':
      return `Haber completado «${FOCUS_BY_ID[cond.id]?.name ?? cond.id}»`;
    case 'hasTech':
      return `Tener la tecnología «${TECH_BY_ID[cond.id]?.name ?? cond.id}»`;
    case 'hasFlag':
      return cond.label ?? 'Haber tomado la decisión adecuada antes';
    case 'hasGlobalFlag':
      return 'Que haya ocurrido cierto suceso';
    case 'hasSpirit':
      return `Tener el espíritu «${SPIRITS[cond.id]?.name ?? cond.id}»`;
    case 'atWar':
      return 'Estar en guerra';
    case 'atWarWith':
      return `Estar en guerra con ${targetName(cond.target, ctx)}`;
    case 'controls':
      return `Controlar ${stationName(cond.station, undefined, ctx)}`;
    case 'owns':
      return `Poseer ${stationName(cond.station, undefined, ctx)}`;
    case 'stationFree':
      return `${STATIONS[cond.station]?.name ?? cond.station} sigue abandonada`;
    case 'exists':
      return `${targetName(cond.target, ctx)} existe`;
    case 'isFaction':
      return `Ser ${FACTIONS[cond.id].name}`;
    case 'isPlayer':
      return 'Ser la facción del jugador';
    case 'stability':
      return range('Estabilidad', cond.min, cond.max);
    case 'warSupport':
      return range('Apoyo a la guerra', cond.min, cond.max);
    case 'pp':
      return `Tener al menos ${cond.min} de poder político`;
    case 'manpower':
      return `Tener al menos ${cond.min} hombres disponibles`;
    case 'ideology':
      return `Gobierno ${IDEOLOGIES[cond.id].adjective}`;
    case 'targetIdeology':
      return `${targetName(cond.target, ctx)} tiene un gobierno ${IDEOLOGIES[cond.id].adjective}`;
    case 'popularity':
      return range(`Apoyo a ${IDEOLOGIES[cond.id].name}`, cond.min, cond.max, (v) => `${v} %`);
    case 'targetPopularity':
      return `${targetName(cond.target, ctx)}: apoyo a ${IDEOLOGIES[cond.id].name} de al menos ${cond.min ?? 0} %`;
    case 'date':
      if (cond.after && cond.before) return `Entre el ${formatDate(hourOfDate(cond.after))} y el ${formatDate(hourOfDate(cond.before))}`;
      if (cond.after) return `A partir del ${formatDate(hourOfDate(cond.after))}`;
      return `Antes del ${formatDate(hourOfDate(cond.before!))}`;
    case 'month':
      return 'En la época adecuada del año';
    case 'tension':
      return range('Tensión del metro', cond.min, cond.max);
    case 'inPactWith':
      return `Ser aliado de ${targetName(cond.target, ctx)}`;
    case 'inPact':
      return 'Pertenecer a una alianza';
    case 'isPactLeader':
      return 'Liderar una alianza';
    case 'relation':
      return range(`Relaciones con ${targetName(cond.target, ctx)}`, cond.min, cond.max, (v) => String(v));
    case 'stations':
      return range('Estaciones', cond.min, cond.max, (v) => String(v));
    case 'units':
      return range('Unidades', cond.min, cond.max, (v) => String(v));
    case 'food':
      return range('Raciones almacenadas', cond.min, cond.max, (v) => String(v));
    case 'foodBalance':
      return range('Balance de comida', cond.min, cond.max, (v) => String(v));
    case 'edgeOpen':
      return `${MAP.provinces[cond.province]?.name ?? cond.province} está abierto`;
    case 'hasNap':
      return `Pacto de no agresión con ${targetName(cond.target, ctx)}`;
    case 'hasAccess':
      return `Acceso militar a ${targetName(cond.target, ctx)}`;
    case 'embargoes':
      return `Embargo con ${targetName(cond.target, ctx)}`;
    case 'isSubject':
      return 'Ser un protectorado';
    case 'subjectOf':
      return `Ser protectorado de ${targetName(cond.target, ctx)}`;
    case 'provinceDanger':
      return range(`Peligro en ${MAP.provinces[cond.province]?.name ?? cond.province}`, cond.min, cond.max, (v) => String(v));
    case 'strongerThan':
      return `Ejército más fuerte que el de ${targetName(cond.target, ctx)}`;
    case 'hasWargoal':
      return `Objetivo de guerra contra ${targetName(cond.target, ctx)}`;
    case 'surrender':
      return `Capitulación de al menos ${Math.round((cond.min ?? 0) * 100)} %`;
    case 'influence':
      return range(`Influencia de ${targetName(cond.target, ctx)} sobre nosotros`, cond.min, cond.max, (v) => String(v));
    case 'leader':
      return `Gobierna ${LEADERS[cond.id]?.name ?? cond.id}${LEADERS[cond.id] ? ` (${LEADERS[cond.id].title})` : ''}`;
    case 'and':
      return 'Todo lo siguiente';
    case 'or':
      return 'Uno de los siguientes';
    case 'not':
      if (cond.cond.c === 'exists') return `${targetName(cond.cond.target, ctx)} ha desaparecido`;
      return `NO: ${conditionText(cond.cond, ctx)}`;
    case 'scoped':
      return `${targetName(cond.target, ctx)}: ${conditionText(cond.cond, { root: undefined, from: ctx?.root })}`;
  }
  return '';
}

export function describeCondition(cond: Condition | undefined, state?: GameState, ctx?: Ctx, indent = 0): Line[] {
  if (!cond) return [];
  const met = state && ctx?.root ? check(state, cond, ctx) : undefined;
  if (cond.c === 'and' || cond.c === 'or') {
    const lines: Line[] = [{ text: cond.c === 'and' ? 'Todo lo siguiente:' : 'Al menos uno de los siguientes:', met, indent }];
    for (const x of cond.list) lines.push(...describeCondition(x, state, ctx, indent + 1));
    return lines;
  }
  return [{ text: conditionText(cond, ctx), met, indent }];
}
