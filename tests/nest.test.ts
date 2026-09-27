import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/state';
import { advanceDays, advanceHour } from '../src/game/engine';
import { findPath, spawnUnit } from '../src/game/military';
import { check } from '../src/game/conditions';
import { applyEffects } from '../src/game/effects';
import type { GameState } from '../src/game/types';

/** La Unión (jugador, sin IA) ataca el nido desde el Nudo de Tenevskaya con las plantillas indicadas. */
function assault(templates: string[]): { s: GameState; cleared: boolean } {
  const s = newGame({ player: 'UNI', seed: 1 });
  for (const u of Object.values(s.units)) if (u.owner === 'UNI') delete s.units[u.id];
  s.countries.UNI.templates.push({ id: 'fuego', name: 'Lanzallamas', line: ['fusileros', 'fusileros', 'lanzallamas', 'lanzallamas'], support: [] });
  s.provinces.E5.controller = 'UNI';
  const units = templates.map((t) => spawnUnit(s, 'UNI', t, 'E5')!);
  for (const u of units) u.path = ['TEN'];
  for (let h = 0; h < 24 * 20 && s.nests.TEN.packs.length; h++) advanceHour(s);
  return { s, cleared: s.nests.TEN.packs.length === 0 };
}

describe('el nido de arañas de Tenevskaya', () => {
  it('la partida empieza con hembras y machos en Tenevskaya', () => {
    const s = newGame({ player: null, seed: 1 });
    expect(s.nests.TEN.packs.filter((p) => p.kind === 'hembra').length).toBe(2);
    expect(s.nests.TEN.packs.filter((p) => p.kind === 'macho').length).toBe(3);
  });

  it('las balas apenas les hacen daño; el fuego las quema', () => {
    const bullets = assault(Array(8).fill('uni_destacamento'));
    expect(bullets.cleared).toBe(false);
    const fire = assault(['fuego', 'fuego', 'fuego']);
    expect(fire.cleared).toBe(true);
    // Sin el nido, la estación se puede recolonizar.
    expect(check(fire.s, { c: 'stationFree', station: 'TEN' }, { root: 'UNI' })).toBe(true);
  });

  it('mientras vive el nido no se puede recolonizar ni se atraviesa', () => {
    const s = newGame({ player: 'UNI', seed: 2 });
    expect(check(s, { c: 'stationFree', station: 'TEN' }, { root: 'UNI' })).toBe(false);
    applyEffects(s, [{ t: 'custom', id: 'colonizar', desc: '', arg: 80 }], { root: 'UNI', target: 'TEN' });
    expect(s.stations.TEN.owner).toBeNull();
    const path = findPath(s, 'UNI', 'E5', 'H1');
    expect(path === null || !path.includes('TEN')).toBe(true);
  });

  it('un nido que nadie limpia vuelve a criar', () => {
    const s = newGame({ player: null, seed: 3 });
    advanceDays(s, 65);
    expect(s.nests.TEN.packs.length).toBe(6);
  });

  it('quemar el nido lo debilita y, si se insiste, lo destruye', () => {
    const s = newGame({ player: 'VHL', seed: 4 });
    const burn = () => applyEffects(s, [{ t: 'custom', id: 'quemarNido', desc: '', arg: 0.5 }], { root: 'VHL', target: 'TEN' });
    burn();
    expect(s.nests.TEN.packs.every((p) => p.hp <= 0.51)).toBe(true);
    burn();
    expect(s.nests.TEN.packs.length).toBe(0);
  });
});
