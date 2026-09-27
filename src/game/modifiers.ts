// Agregación de modificadores de todas las fuentes de una facción.
import { ADVISOR_BY_ID, IDEOLOGIES, LAWS, LEADERS, SPIRITS, STATIONS, TECH_BY_ID, TRAITS } from '../data';
import type { FactionId, GameState, ModifierKey, Modifiers } from './types';
import { influenceModSources } from './influence';

export interface ModInfo {
  name: string;
  fmt: 'pct' | 'num' | 'pp';
  good: 'pos' | 'neg' | 'none';
}

export const MOD_INFO: Record<ModifierKey, ModInfo> = {
  ppDiario: { name: 'Poder político diario', fmt: 'num', good: 'pos' },
  estabilidad: { name: 'Estabilidad', fmt: 'pp', good: 'pos' },
  apoyoGuerra: { name: 'Apoyo a la guerra', fmt: 'pp', good: 'pos' },
  produccionMilitar: { name: 'Producción de talleres militares', fmt: 'pct', good: 'pos' },
  produccionCivil: { name: 'Producción de talleres civiles', fmt: 'pct', good: 'pos' },
  construccion: { name: 'Velocidad de construcción', fmt: 'pct', good: 'pos' },
  eficienciaMax: { name: 'Tope de eficiencia de producción', fmt: 'pp', good: 'pos' },
  eficienciaGanancia: { name: 'Crecimiento de la eficiencia', fmt: 'pct', good: 'pos' },
  bienesConsumo: { name: 'Bienes de consumo', fmt: 'pp', good: 'neg' },
  investigacion: { name: 'Velocidad de investigación', fmt: 'pct', good: 'pos' },
  reclutables: { name: 'Población reclutable', fmt: 'pp', good: 'pos' },
  manoObra: { name: 'Mano de obra', fmt: 'pct', good: 'pos' },
  entrenamiento: { name: 'Velocidad de entrenamiento', fmt: 'pct', good: 'pos' },
  ataque: { name: 'Ataque de las unidades', fmt: 'pct', good: 'pos' },
  defensa: { name: 'Defensa de las unidades', fmt: 'pct', good: 'pos' },
  ruptura: { name: 'Ruptura', fmt: 'pct', good: 'pos' },
  organizacion: { name: 'Organización', fmt: 'pct', good: 'pos' },
  recuperacionOrg: { name: 'Recuperación de organización', fmt: 'pct', good: 'pos' },
  atricion: { name: 'Desgaste', fmt: 'pct', good: 'neg' },
  movimiento: { name: 'Velocidad de movimiento', fmt: 'pct', good: 'pos' },
  alimentos: { name: 'Producción de alimentos', fmt: 'pct', good: 'pos' },
  consumoAlimentos: { name: 'Consumo de alimentos', fmt: 'pct', good: 'neg' },
  recursos: { name: 'Extracción de recursos', fmt: 'pct', good: 'pos' },
  costeLeyes: { name: 'Coste de las leyes', fmt: 'pct', good: 'neg' },
  costeAsesores: { name: 'Coste de los asesores', fmt: 'pct', good: 'neg' },
  costeDecisiones: { name: 'Coste de las decisiones', fmt: 'pct', good: 'neg' },
  justificacion: { name: 'Tiempo de justificación de guerra', fmt: 'pct', good: 'neg' },
  crecimientoPoblacion: { name: 'Crecimiento de la población', fmt: 'pct', good: 'pos' },
  tension: { name: 'Tensión generada', fmt: 'pct', good: 'neg' },
  fortificacion: { name: 'Eficacia de las barricadas', fmt: 'pct', good: 'pos' },
  peligroMutante: { name: 'Peligro mutante en tu territorio', fmt: 'pct', good: 'neg' },
  ataquePeligroso: { name: 'Ataque en túneles peligrosos', fmt: 'pct', good: 'pos' },
  ataqueAuxiliar: { name: 'Ataque en túneles auxiliares', fmt: 'pct', good: 'pos' },
  defensaEstacion: { name: 'Defensa en estaciones', fmt: 'pct', good: 'pos' },
  civExtra: { name: 'Talleres civiles', fmt: 'num', good: 'pos' },
  milExtra: { name: 'Talleres militares', fmt: 'num', good: 'pos' },
  reforzar: { name: 'Velocidad de refuerzo', fmt: 'pct', good: 'pos' },
  rendicion: { name: 'Límite de capitulación', fmt: 'pp', good: 'pos' },
  rangoSuministro: { name: 'Alcance de suministro', fmt: 'num', good: 'pos' },
  enfoque: { name: 'Velocidad de los enfoques', fmt: 'pct', good: 'pos' },
  expediciones: { name: 'Éxito de las expediciones', fmt: 'pct', good: 'pos' },
  saqueo: { name: 'Botín de los saqueos', fmt: 'pct', good: 'pos' },
  popDemocracia: { name: 'Apoyo democrático diario', fmt: 'num', good: 'none' },
  popComunismo: { name: 'Apoyo comunista diario', fmt: 'num', good: 'none' },
  popAutocracia: { name: 'Apoyo autocrático diario', fmt: 'num', good: 'none' },
  popNacionalismo: { name: 'Apoyo ultranacionalista diario', fmt: 'num', good: 'none' },
  popOligarquia: { name: 'Apoyo mercantil diario', fmt: 'num', good: 'none' },
  popTeocracia: { name: 'Apoyo teocrático diario', fmt: 'num', good: 'none' },
  popAnarquia: { name: 'Apoyo anarquista diario', fmt: 'num', good: 'none' },
};

export function addMods(target: Modifiers, src: Modifiers | undefined, factor = 1) {
  if (!src) return target;
  for (const [k, v] of Object.entries(src) as [ModifierKey, number][]) {
    target[k] = (target[k] ?? 0) + v * factor;
  }
  return target;
}

export interface ModSource {
  label: string;
  mods: Modifiers;
}

const DIFFICULTY_AI: Record<string, Modifiers> = {
  facil: { produccionMilitar: -0.1, produccionCivil: -0.1, ataque: -0.05, defensa: -0.05 },
  normal: {},
  dificil: { produccionMilitar: 0.15, produccionCivil: 0.1, ataque: 0.1, defensa: 0.1, investigacion: 0.1 },
};
const DIFFICULTY_PLAYER: Record<string, Modifiers> = {
  facil: { produccionMilitar: 0.1, produccionCivil: 0.1, estabilidad: 0.05, ppDiario: 0.2 },
  normal: {},
  dificil: {},
};

/** Todas las fuentes de modificadores, separadas (para los desgloses de la interfaz). */
export function modSources(state: GameState, f: FactionId): ModSource[] {
  const c = state.countries[f];
  const out: ModSource[] = [];
  const ideo = IDEOLOGIES[c.ideology];
  out.push({ label: `Ideología: ${ideo.name}`, mods: ideo.modifiers });
  const leader = LEADERS[c.leader];
  if (leader) {
    for (const t of leader.traits) {
      const tr = TRAITS[t];
      if (tr) out.push({ label: `Rasgo: ${tr.name}`, mods: tr.modifiers });
    }
  }
  for (const lawId of Object.values(c.laws)) {
    const law = LAWS[lawId];
    if (law) out.push({ label: `Ley: ${law.name}`, mods: law.modifiers });
  }
  for (const a of c.advisors) {
    const adv = ADVISOR_BY_ID[a];
    if (adv) out.push({ label: `Asesor: ${adv.name}`, mods: adv.modifiers });
  }
  for (const s of c.spirits) {
    const sp = SPIRITS[s.id];
    if (sp) out.push({ label: `Espíritu: ${sp.name}`, mods: sp.modifiers });
  }
  for (const t of c.research.done) {
    const tech = TECH_BY_ID[t];
    if (tech?.modifiers) out.push({ label: `Tecnología: ${tech.name}`, mods: tech.modifiers });
  }
  for (const sid of Object.keys(state.stations)) {
    const st = state.stations[sid];
    if (st.owner === f && state.provinces[sid].controller === f) {
      const feat = STATIONS[sid].feature;
      if (feat) out.push({ label: `${STATIONS[sid].shortName}: ${feat.name}`, mods: feat.modifiers });
    }
  }
  out.push(...influenceModSources(state, f));
  const diff = state.player === f ? DIFFICULTY_PLAYER[state.difficulty] : state.player ? DIFFICULTY_AI[state.difficulty] : {};
  if (diff && Object.keys(diff).length) out.push({ label: 'Dificultad', mods: diff });
  return out;
}

const cache = new WeakMap<GameState, { stamp: number; mods: Partial<Record<FactionId, Modifiers>> }>();
const stamps = new WeakMap<GameState, number>();

export function invalidateMods(state: GameState) {
  stamps.set(state, (stamps.get(state) ?? 0) + 1);
}

export function modStamp(state: GameState): number {
  return stamps.get(state) ?? 0;
}

export function getMods(state: GameState, f: FactionId): Modifiers {
  const stamp = stamps.get(state) ?? 0;
  let entry = cache.get(state);
  if (!entry || entry.stamp !== stamp) {
    entry = { stamp, mods: {} };
    cache.set(state, entry);
  }
  let m = entry.mods[f];
  if (!m) {
    m = {};
    for (const src of modSources(state, f)) addMods(m, src.mods);
    entry.mods[f] = m;
  }
  return m;
}

export function mod(state: GameState, f: FactionId, key: ModifierKey): number {
  return getMods(state, f)[key] ?? 0;
}

export function formatModValue(key: ModifierKey, v: number): string {
  const info = MOD_INFO[key];
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (info.fmt === 'pct' || info.fmt === 'pp') {
    const n = a * 100;
    const txt = Number.isInteger(Math.round(n * 10) / 10) ? String(Math.round(n)) : n.toFixed(1);
    return `${sign}${txt} %`;
  }
  const txt = Number.isInteger(a) ? String(a) : a.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${sign}${txt}`;
}

export function modTone(key: ModifierKey, v: number): 'good' | 'bad' | 'neutral' {
  const g = MOD_INFO[key].good;
  if (g === 'none' || v === 0) return 'neutral';
  return (v > 0) === (g === 'pos') ? 'good' : 'bad';
}

export function describeMods(mods: Modifiers): { text: string; tone: 'good' | 'bad' | 'neutral' }[] {
  return (Object.entries(mods) as [ModifierKey, number][])
    .filter(([, v]) => Math.abs(v) > 1e-9)
    .map(([k, v]) => ({ text: `${MOD_INFO[k].name}: ${formatModValue(k, v)}`, tone: modTone(k, v) }));
}
