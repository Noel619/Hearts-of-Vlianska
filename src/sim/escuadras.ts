// Escuadras propias: la gente del jugador se reparte en grupos que van por su
// cuenta (una partida de exploración, la guarnición de un puesto avanzado, los
// que se quedan en la base). La escuadra 0 es la principal.

import type { Sim } from './sim';
import type { Char, Team } from './types';

/** Escuadras del jugador, empezando por la principal. */
export function teams(sim: Sim): Team[] {
  return [{ id: 0, name: 'Escuadra principal' }, ...(sim.state.teams ?? [])];
}

export function teamOf(c: Char): number {
  return c.team ?? 0;
}

/** Gente (viva) de una escuadra. */
export function teamMembers(sim: Sim, id: number): Char[] {
  return sim.state.chars.filter((c) => c.player && c.st !== 'muerto' && teamOf(c) === id);
}

/** Nombre de una escuadra. */
export function teamName(sim: Sim, id: number): string {
  return teams(sim).find((t) => t.id === id)?.name ?? 'Escuadra principal';
}

/** Crea una escuadra nueva con esta gente. Devuelve su id. */
export function createTeam(sim: Sim, members: Char[], name?: string): number {
  const list = (sim.state.teams ??= []);
  const id = Math.max(0, ...list.map((t) => t.id)) + 1;
  list.push({ id, name: name?.trim() || `Escuadra ${id + 1}` });
  for (const c of members) if (c.player) c.team = id;
  sim.log(`Nueva escuadra: ${teamName(sim, id)} (${members.length} ${members.length === 1 ? 'persona' : 'personas'}).`, 'info');
  pruneTeams(sim);
  return id;
}

/** Pasa a alguien a otra escuadra. */
export function assignTeam(sim: Sim, c: Char, id: number): void {
  if (!c.player) return;
  if (id === 0) delete c.team;
  else if (teams(sim).some((t) => t.id === id)) c.team = id;
  pruneTeams(sim);
}

export function renameTeam(sim: Sim, id: number, name: string): string | null {
  const n = name.replace(/\s+/g, ' ').trim();
  if (!n) return 'El nombre no puede quedar vacío';
  if (n.length > 24) return 'Como mucho 24 letras';
  const t = sim.state.teams?.find((q) => q.id === id);
  if (!t) return 'La escuadra principal no cambia de nombre';
  t.name = n;
  return null;
}

/** Las escuadras que se quedan sin nadie desaparecen. */
export function pruneTeams(sim: Sim): void {
  if (!sim.state.teams) return;
  sim.state.teams = sim.state.teams.filter((t) => sim.state.chars.some((c) => c.player && c.st !== 'muerto' && c.team === t.id));
}
