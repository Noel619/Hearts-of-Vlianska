// Investigación tecnológica.
import { BASE_LINE_SLOTS, BASE_SUPPORT_SLOTS, MAX_LINE, MAX_SUPPORT, TECH_BY_ID, TECHS } from '../data';
import type { EquipmentId, FactionId, GameState, TechDef } from './types';
import { addLog, factionName } from './helpers';
import { invalidateMods, mod } from './modifiers';
import { yearOf } from './time';
import { applyEffects } from './effects';

export const AHEAD_PENALTY = 0.8;

export function techStatus(state: GameState, f: FactionId, id: string): 'done' | 'active' | 'available' | 'locked' | 'excluded' {
  const c = state.countries[f];
  if (c.research.done.includes(id)) return 'done';
  if (c.research.active.some((a) => a?.tech === id)) return 'active';
  const t = TECH_BY_ID[id];
  if (t.exclusive?.some((x) => c.research.done.includes(x) || c.research.active.some((a) => a?.tech === x))) return 'excluded';
  if (t.prereq && !t.prereq.every((p) => c.research.done.includes(p))) return 'locked';
  return 'available';
}

export function researchCost(state: GameState, t: TechDef): number {
  const ahead = Math.max(0, t.year - yearOf(state.hour));
  return t.cost * (1 + AHEAD_PENALTY * ahead);
}

export function researchSpeed(state: GameState, f: FactionId): number {
  return Math.max(0.1, 1 + mod(state, f, 'investigacion'));
}

export function bestBonus(state: GameState, f: FactionId, t: TechDef) {
  const c = state.countries[f];
  return c.research.bonuses.filter((b) => b.cat === t.cat).sort((a, b) => b.v - a.v)[0] ?? null;
}

export interface ActiveResearch {
  tech: string;
  progress: number;
  bonus?: number;
}

export function startResearch(state: GameState, f: FactionId, slot: number, techId: string): boolean {
  const c = state.countries[f];
  if (slot < 0 || slot >= c.research.slots) return false;
  if (techStatus(state, f, techId) !== 'available') return false;
  const current = c.research.active[slot];
  if (current) return false;
  const t = TECH_BY_ID[techId];
  const bonus = bestBonus(state, f, t);
  const entry: ActiveResearch = { tech: techId, progress: 0 };
  if (bonus) {
    entry.bonus = bonus.v;
    bonus.uses -= 1;
    if (bonus.uses <= 0) c.research.bonuses = c.research.bonuses.filter((b) => b !== bonus);
  }
  c.research.active[slot] = entry;
  return true;
}

export function cancelResearch(state: GameState, f: FactionId, slot: number) {
  const c = state.countries[f];
  c.research.active[slot] = null;
}

export function grantTech(state: GameState, f: FactionId, id: string) {
  const c = state.countries[f];
  const t = TECH_BY_ID[id];
  if (!t || c.research.done.includes(id)) return;
  c.research.done.push(id);
  c.research.active = c.research.active.map((a) => (a?.tech === id ? null : a));
  if (t.effects) applyEffects(state, t.effects, { root: f });
  invalidateMods(state);
}

export function dailyResearch(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const speed = researchSpeed(state, f);
  for (let i = 0; i < c.research.active.length; i++) {
    const a = c.research.active[i];
    if (!a) continue;
    const t = TECH_BY_ID[a.tech];
    a.progress += speed * (1 + (a.bonus ?? 0));
    if (a.progress >= researchCost(state, t)) {
      c.research.active[i] = null;
      grantTech(state, f, t.id);
      addLog(state, { text: `${factionName(f)} completa la investigación: ${t.name}.`, kind: 'bueno', faction: f, quiet: true });
    }
  }
}

export function daysLeft(state: GameState, f: FactionId, a: ActiveResearch): number {
  const t = TECH_BY_ID[a.tech];
  const perDay = researchSpeed(state, f) * (1 + (a.bonus ?? 0));
  return Math.max(0, (researchCost(state, t) - a.progress) / perDay);
}

export function equipmentLevel(state: GameState, f: FactionId, eq: EquipmentId): number {
  const c = state.countries[f];
  let level = 1;
  for (const id of c.research.done) {
    const u = TECH_BY_ID[id]?.unlocks?.equipment;
    if (u && u.id === eq) level = Math.max(level, u.level);
  }
  return level;
}

export function unlockedBattalions(state: GameState, f: FactionId): Set<string> {
  const c = state.countries[f];
  const set = new Set<string>(['milicia', 'fusileros']);
  for (const id of c.research.done) for (const b of TECH_BY_ID[id]?.unlocks?.battalions ?? []) set.add(b);
  return set;
}

export function templateSlots(state: GameState, f: FactionId): { line: number; support: number } {
  const c = state.countries[f];
  let line = BASE_LINE_SLOTS;
  let support = BASE_SUPPORT_SLOTS;
  for (const id of c.research.done) {
    line += TECH_BY_ID[id]?.unlocks?.lineSlots ?? 0;
    support += TECH_BY_ID[id]?.unlocks?.supportSlots ?? 0;
  }
  return { line: Math.min(MAX_LINE, line), support: Math.min(MAX_SUPPORT, support) };
}

export function availableTechs(state: GameState, f: FactionId): TechDef[] {
  return TECHS.filter((t) => techStatus(state, f, t.id) === 'available');
}

