import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/state';
import { advanceDays, advanceHour } from '../src/game/engine';
import { declareWar } from '../src/game/diplomacy';
import { relocateCapital, spawnUnit } from '../src/game/military';
import { aiDiplomacy } from '../src/game/ai/diplomacy';
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

  it('recupera su capital perdida: reduce guarniciones secundarias, cerca la estación y la asalta', () => {
    // Los Seguidores ocupan Tsentral'naya; la Unión tiene tropas repartidas en Zvezdnaya, Tenevskaya y Nadezhdy.
    const s = newGame({ player: null, seed: 1 });
    for (const u of Object.values(s.units)) if (u.owner === 'UNI' || u.owner === 'SDR') delete s.units[u.id];
    for (const sid of ['TEN', 'UBE']) {
      s.stations[sid].owner = 'UNI';
      s.provinces[sid].controller = 'UNI';
    }
    declareWar(s, 'SDR', 'UNI', { force: true });
    for (const p of ['TSE', 'E4', 'E5']) s.provinces[p].controller = 'SDR';
    relocateCapital(s, 'UNI');
    for (let i = 0; i < 4; i++) spawnUnit(s, 'UNI', 'uni_destacamento', 'ZVE');
    for (let i = 0; i < 5; i++) spawnUnit(s, 'UNI', 'uni_destacamento', 'TEN');
    for (let i = 0; i < 2; i++) spawnUnit(s, 'UNI', 'uni_destacamento', 'UBE');
    for (let i = 0; i < 4; i++) spawnUnit(s, 'SDR', 'sdr_fusileros', 'TSE');
    for (let i = 0; i < 3; i++) spawnUnit(s, 'SDR', 'sdr_fusileros', 'KHO');
    advanceDays(s, 2);
    // El Nudo de Tenevskaya, vacío, vuelve a la Unión: sus tropas ya no están "encerradas".
    expect(s.provinces.E5.controller).toBe('UNI');
    // Y los túneles junto a la capital perdida, sin tropas de la Unión, pasan a los Seguidores.
    expect(s.provinces.W7.controller).toBe('SDR');
    let recovered = -1;
    for (let d = 2; d < 60 && recovered < 0; d++) {
      advanceDays(s, 1);
      if (s.provinces.TSE.controller === 'UNI') recovered = d;
    }
    expect(recovered).toBeGreaterThan(0);
    expect(s.countries.UNI.capital).toBe('TSE');
  });

  it('una estación cercada se queda sin suministro', () => {
    const s = newGame({ player: null, seed: 2 });
    declareWar(s, 'UNI', 'SDR', { force: true });
    spawnUnit(s, 'SDR', 'sdr_fusileros', 'RUB');
    // La Unión corta los dos túneles que unen Rubezh con el resto de los Seguidores.
    for (const p of ['RUB_KHO_1', 'IND_RUB_1']) {
      s.provinces[p].controller = 'UNI';
      spawnUnit(s, 'UNI', 'uni_destacamento', p);
    }
    advanceDays(s, 1);
    const garrison = Object.values(s.units).filter((u) => u.owner === 'SDR' && u.province === 'RUB');
    expect(garrison.length).toBeGreaterThan(0);
    expect(garrison.every((u) => u.outOfSupply)).toBe(true);
    // La capital sigue abastecida.
    expect(Object.values(s.units).filter((u) => u.owner === 'SDR' && u.province === 'KHO').every((u) => !u.outOfSupply)).toBe(true);
  });

  it('en modo histórico no fabrica guerras ni propone alianzas o pactos por su cuenta', () => {
    const run = (historicalAI: boolean) => {
      const s = newGame({ player: 'STA', seed: 8, historicalAI });
      s.tension = 0.9;
      for (let i = 0; i < 10; i++) spawnUnit(s, 'SDR', 'sdr_fusileros', 'KHO');
      for (let d = 60; d < 460; d++) {
        s.hour = d * 24;
        for (const f of ['SDR', 'UNI', 'LEV', 'NOR', 'CHE'] as FactionId[]) aiDiplomacy(s, f);
      }
      return s;
    };
    const hist = run(true);
    expect(hist.countries.SDR.wargoals.length).toBe(0);
    expect(hist.playerEvents.filter((e) => e.id === 'diplo_invitacion_pacto' || e.id === 'diplo_propuesta_nap').length).toBe(0);
    // Con la IA libre, Seguidores sí preparan la guerra contra Staraya.
    expect(run(false).countries.SDR.wargoals.some((w) => w.target === 'STA')).toBe(true);
  });
});
