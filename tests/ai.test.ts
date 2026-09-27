import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/state';
import { advanceDays, advanceHour } from '../src/game/engine';
import { declareWar } from '../src/game/diplomacy';
import { spawnUnit } from '../src/game/military';
import type { FactionId, GameState } from '../src/game/types';

function unitsAt(state: GameState, f: FactionId, pid: string) {
  return Object.values(state.units).filter((u) => u.owner === f && u.province === pid);
}

describe('IA militar', () => {
  it('guarnece todas las estaciones amenazadas, también las de retaguardia accesibles', () => {
    // La Unión (jugador, sin IA) amenaza Stalingradskaya por el oeste y Rassvetnaya por las galerías del norte.
    const state = newGame({ player: 'UNI', seed: 11 });
    for (const u of Object.values(state.units)) if (u.owner === 'UNI') delete state.units[u.id];
    state.provinces.W6.controller = 'UNI';
    state.provinces.W1_W2_1.controller = 'UNI';
    for (let i = 0; i < 2; i++) spawnUnit(state, 'UNI', 'uni_destacamento', 'W6');
    for (let i = 0; i < 2; i++) spawnUnit(state, 'UNI', 'uni_destacamento', 'W1_W2_1');
    declareWar(state, 'UNI', 'LEV', { force: true });
    advanceDays(state, 8);
    expect(unitsAt(state, 'LEV', 'STL').length).toBeGreaterThan(0);
    expect(unitsAt(state, 'LEV', 'RAS').length).toBeGreaterThan(0);
    // Ninguna unidad del Levantamiento se ha quedado esperando en un túnel sin motivo.
    const idleInTunnels = Object.values(state.units).filter((u) => u.owner === 'LEV' && !state.stations[u.province] && u.path.length === 0 && !u.battle);
    expect(idleInTunnels.length).toBe(0);
  });

  it('no sale a atacar en inferioridad: los débiles se atrincheran en su estación', () => {
    const state = newGame({ player: null, seed: 3 });
    declareWar(state, 'SDR', 'VHL', { force: true });
    for (let d = 0; d < 5; d++) {
      advanceDays(state, 1);
      const out = Object.values(state.units).filter((u) => u.owner === 'VHL' && u.province !== 'VHL' && !u.battle);
      expect(out.length).toBe(0);
    }
  });

  it('repliega una unidad aislada en un túnel frente a fuerzas muy superiores', () => {
    const state = newGame({ player: 'UNI', seed: 5 });
    for (const u of Object.values(state.units)) if (u.owner === 'UNI') delete state.units[u.id];
    state.provinces.W8.controller = 'UNI';
    state.provinces.W6.controller = 'LEV';
    const lonely = spawnUnit(state, 'LEV', 'lev_milicia', 'W6')!;
    const attackers = [0, 1, 2].map(() => spawnUnit(state, 'UNI', 'uni_destacamento', 'W8')!);
    declareWar(state, 'UNI', 'LEV', { force: true });
    for (const a of attackers) a.path = ['W6'];
    for (let h = 0; h < 24 * 4; h++) advanceHour(state);
    const u = state.units[lonely.id];
    expect(u).toBeDefined();
    expect(u.province).not.toBe('W6');
  });

  it('deja guarnición en la capital aunque tenga una ofensiva en marcha', () => {
    const state = newGame({ player: null, seed: 21 });
    declareWar(state, 'LEV', 'CAL', { force: true });
    declareWar(state, 'UNI', 'LEV', { force: true });
    for (let d = 0; d < 40; d++) {
      advanceDays(state, 1);
      if (!state.countries.LEV.alive) break;
      const cap = state.countries.LEV.capital;
      if (state.provinces[cap].controller !== 'LEV') continue;
      const guards = unitsAt(state, 'LEV', cap).length + Object.values(state.units).filter((u) => u.owner === 'LEV' && u.aiTarget === cap && u.path.length > 0).length;
      if (d > 3) expect(guards).toBeGreaterThan(0);
    }
  });
});
