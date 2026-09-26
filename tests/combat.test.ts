import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/state';
import { hourlyCombat, hourlyMovement } from '../src/game/combat';
import { spawnUnit, unitStats } from '../src/game/military';
import { declareWar } from '../src/game/diplomacy';
import type { GameState } from '../src/game/types';

function clearUnits(state: GameState) {
  state.units = {};
}

function duel(label: string, attTpl: string[], defTpl: string[], defProvince: string, attProvince: string, fort: number): { attackerWins: boolean; days: number } {
  const state = newGame({ player: null, seed: 7 });
  clearUnits(state);
  // Desactiva la IA: el jugador ficticio SDR y UNI no actúan.
  state.player = 'SDR';
  state.provinces[defProvince].fort = fort;
  state.provinces[defProvince].controller = 'UNI';
  state.provinces[attProvince].controller = 'SDR';
  const atts = attTpl.map((t) => spawnUnit(state, 'SDR', t, attProvince)!);
  const defs = defTpl.map((t) => spawnUnit(state, 'UNI', t, defProvince)!);
  declareWar(state, 'SDR', 'UNI', { force: true });
  for (const a of atts) a.path = [defProvince];
  let h = 0;
  while (h < 24 * 30) {
    state.hour += 1;
    h++;
    hourlyMovement(state);
    hourlyCombat(state);
    const activeAtt = atts.filter((a) => state.units[a.id] && state.units[a.id].path.length > 0);
    if (activeAtt.length === 0) break;
  }
  const winner = (state.provinces[defProvince].controller as string) === 'SDR' ? 'ATACANTE' : 'DEFENSOR';
  const s1 = unitStats(state, atts[0]);
  const s2 = unitStats(state, defs[0]);
  if (process.env.VERBOSE) {
    console.log(`${label}: gana ${winner} en ${(h / 24).toFixed(1)} días | att str ${atts.map((a) => (state.units[a.id]?.strength ?? 0).toFixed(2)).join(',')} def str ${defs.map((d) => (state.units[d.id]?.strength ?? 0).toFixed(2)).join(',')} | att soft ${s1.soft.toFixed(1)} brk ${s1.brk.toFixed(1)} org ${s1.org.toFixed(1)} | def def ${s2.def.toFixed(1)} soft ${s2.soft.toFixed(1)} org ${s2.org.toFixed(1)}`);
  }
  return { attackerWins: winner === 'ATACANTE', days: h / 24 };
}

describe('calibración de combate', () => {
  it('un batallón no toma solo una estación fortificada', () => {
    const r = duel('1v1 estación fort2', ['sdr_fusileros'], ['uni_destacamento'], 'TSE', 'W8', 2);
    expect(r.attackerWins).toBe(false);
  });
  it('la superioridad numérica rompe la defensa', () => {
    expect(duel('2v1 estación fort2', ['sdr_fusileros', 'sdr_fusileros'], ['uni_destacamento'], 'TSE', 'W8', 2).attackerWins).toBe(true);
    expect(duel('2v1 túnel', ['sdr_fusileros', 'sdr_fusileros'], ['uni_destacamento'], 'W8', 'W6', 0).attackerWins).toBe(true);
  });
  it('las unidades de élite ganan en igualdad numérica en túnel abierto', () => {
    expect(duel('hierro vs destacamento túnel', ['sdr_hierro'], ['uni_destacamento'], 'W8', 'W6', 0).attackerWins).toBe(true);
  });
  it('las batallas duran días, no horas', () => {
    const r = duel('3v1 estación fort2', ['sdr_fusileros', 'sdr_fusileros', 'sdr_fusileros'], ['uni_destacamento'], 'TSE', 'W8', 2);
    expect(r.days).toBeGreaterThan(1);
    expect(r.days).toBeLessThan(10);
  });
});
