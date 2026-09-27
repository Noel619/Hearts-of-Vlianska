import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/state';
import { hourlyCombat, hourlyMovement } from '../src/game/combat';
import { DIG_DAYS, hourlyOrg, orderMove, spawnUnit } from '../src/game/military';
import { declareWar } from '../src/game/diplomacy';
import type { GameState } from '../src/game/types';

interface Placement {
  tpl: string;
  at: string;
  str?: number;
}

/** Prepara una guerra SDR (atacante) contra UNI (defensor) sin IA y con las unidades indicadas. */
function setup(att: Placement[], def: Placement[], target: string, fort: number, dug = 0) {
  const state = newGame({ player: null, seed: 7 });
  state.units = {};
  // Un jugador ficticio desactiva la IA de SDR; UNI no actúa porque solo avanzamos el combate.
  state.player = 'SDR';
  state.countries.SDR.templates.push(...state.countries.UNI.templates);
  state.countries.UNI.templates.push(...state.countries.SDR.templates.filter((t) => t.id.startsWith('sdr')));
  state.provinces[target].fort = fort;
  state.provinces[target].controller = 'UNI';
  for (const a of att) state.provinces[a.at].controller = 'SDR';
  const atts = att.map((a) => spawnUnit(state, 'SDR', a.tpl, a.at, { strength: a.str })!);
  const defs = def.map((d) => spawnUnit(state, 'UNI', d.tpl, d.at, { strength: d.str })!);
  for (const d of defs) d.dug = dug;
  declareWar(state, 'SDR', 'UNI', { force: true });
  for (const a of atts) a.path = [target];
  return { state, atts, defs };
}

function tick(state: GameState) {
  state.hour += 1;
  hourlyMovement(state);
  hourlyCombat(state);
  hourlyOrg(state);
}

function fight(att: Placement[], def: Placement[], target: string, fort: number, dug = 0) {
  const { state } = setup(att, def, target, fort, dug);
  let h = 0;
  while (h < 24 * 40) {
    tick(state);
    h++;
    if (Object.keys(state.battles).length === 0 && h > 2) break;
  }
  return { attackerWins: (state.provinces[target].controller as string) === 'SDR', days: h / 24 };
}

const D = 'uni_destacamento';
const W6 = { tpl: D, at: 'W6' };
const W8 = { tpl: D, at: 'W8' };
const E4 = { tpl: D, at: 'E4' };
const TSE = { tpl: D, at: 'TSE' };

describe('combate: calibración', () => {
  it('en igualdad, el defensor gana', () => {
    expect(fight([W6], [W8], 'W8', 0).attackerWins).toBe(false);
    expect(fight([W8], [TSE], 'TSE', 2).attackerWins).toBe(false);
  });
  it('la superioridad numérica rompe una defensa sin preparar', () => {
    expect(fight([W6, W6], [W8], 'W8', 0).attackerWins).toBe(true);
    expect(fight([W8, W8], [TSE], 'TSE', 0).attackerWins).toBe(true);
  });
  it('atrincherarse y fortificar obliga a atacar con más tropas', () => {
    expect(fight([W6, W6], [W8], 'W8', 0, 1).attackerWins).toBe(false);
    expect(fight([W6, W6, W6], [W8], 'W8', 0, 1).attackerWins).toBe(true);
    expect(fight([W8, W8], [TSE], 'TSE', 2, 1).attackerWins).toBe(false);
    expect(fight([W8, W8, W8], [TSE], 'TSE', 5, 1).attackerWins).toBe(false);
  });
  it('atacar desde varios túneles (flanqueo) es decisivo', () => {
    expect(fight([W8, E4], [TSE], 'TSE', 2, 1).attackerWins).toBe(true);
    expect(fight([W8, W8, E4, E4], [TSE, TSE], 'TSE', 2, 1).attackerWins).toBe(false);
    expect(fight([W8, W8, E4, { tpl: D, at: 'W7' }], [TSE, TSE], 'TSE', 2, 1).attackerWins).toBe(true);
  });
  it('las barricadas alargan el asedio', () => {
    const low = fight([W8, E4], [TSE], 'TSE', 0, 1);
    const high = fight([W8, E4], [TSE], 'TSE', 5, 1);
    expect(high.days).toBeGreaterThan(low.days);
  });
  it('la calidad cuenta: élite contra milicia', () => {
    expect(fight([{ tpl: 'sdr_hierro', at: 'W6' }], [W8], 'W8', 0).attackerWins).toBe(true);
    expect(fight([{ tpl: 'sdr_fusileros', at: 'W6' }], [{ tpl: 'uni_guardia', at: 'W8' }], 'W8', 0).attackerWins).toBe(true);
  });
  it('una unidad diezmada no aguanta', () => {
    expect(fight([W6], [{ tpl: D, at: 'W8', str: 0.4 }], 'W8', 0).attackerWins).toBe(true);
    expect(fight([{ tpl: D, at: 'W6', str: 0.4 }], [W8], 'W8', 0).attackerWins).toBe(false);
  });
  it('las batallas duran días, no horas', () => {
    const r = fight([W8, W8, W8], [TSE], 'TSE', 2, 1);
    expect(r.days).toBeGreaterThan(2);
    expect(r.days).toBeLessThan(12);
  });
});

describe('combate: mecánicas', () => {
  it('una unidad atacada deja de atacar y se defiende (nunca está en dos batallas)', () => {
    const { state, atts } = setup([W6], [W8], 'W8', 0);
    // Otra unidad de UNI ataca W6 por la galería auxiliar, justo donde está el atacante.
    state.provinces.W5.controller = 'UNI';
    const flanker = spawnUnit(state, 'UNI', D, 'W5')!;
    flanker.path = ['W6'];
    let sawDefense = false;
    for (let h = 0; h < 30; h++) {
      tick(state);
      const a = state.units[atts[0].id];
      if (!a) break;
      const involved = Object.values(state.battles).filter((b) => b.attackers.includes(a.id) || b.defenders.includes(a.id));
      expect(involved.length).toBeLessThanOrEqual(1);
      if (involved[0]?.province === 'W6') sawDefense = true;
    }
    expect(sawDefense).toBe(true);
  });

  it('un defensor puede replegarse y el atacante ocupa la provincia', () => {
    const { state, defs } = setup([W6, W6], [W8], 'W8', 0);
    for (let h = 0; h < 6; h++) tick(state);
    const d = defs[0];
    expect(d.battle).not.toBeNull();
    expect(orderMove(state, [d.id], 'TSE')).toBe(1);
    expect(d.retreating).toBe(true);
    expect(d.battle).toBeNull();
    for (let h = 0; h < 48; h++) tick(state);
    expect(state.units[d.id]).toBeDefined();
    expect(state.units[d.id].province).toBe('TSE');
    expect(state.provinces.W8.controller).toBe('SDR');
  });

  it('las unidades se atrincheran quietas y lo pierden al moverse', () => {
    const { state, defs } = setup([], [TSE], 'TSE', 0);
    const d = defs[0];
    for (let h = 0; h < DIG_DAYS * 24; h++) tick(state);
    expect(d.dug).toBeCloseTo(1, 5);
    orderMove(state, [d.id], 'W8');
    tick(state);
    expect(d.dug).toBe(0);
  });

  it('una unidad rodeada y sin organización se rinde', () => {
    // Un destacamento aislado en W8 atacado desde W6 y desde TSE no tiene adónde huir (W9 es enemigo).
    const { state, defs } = setup([W6, { tpl: D, at: 'TSE' }, { tpl: D, at: 'W9' }], [{ tpl: D, at: 'W8', str: 0.5 }], 'W8', 0);
    for (let h = 0; h < 24 * 10; h++) tick(state);
    expect(state.units[defs[0].id]).toBeUndefined();
    expect(state.log.some((l) => l.text.includes('se rinde'))).toBe(true);
  });

  it('los morteros disparan desde la reserva', () => {
    const run = (line: string[]) => {
      const { state, defs } = setup([W6], [W8], 'W8', 0);
      state.countries.SDR.templates.push({ id: 'test_reserva', name: 'Reserva', line, support: [] });
      const r = spawnUnit(state, 'SDR', 'test_reserva', 'W6')!;
      r.path = ['W8'];
      // Menos organización que el destacamento: se queda en la reserva.
      r.org *= 0.5;
      for (let h = 0; h < 10; h++) tick(state);
      return defs[0].org;
    };
    expect(run(['morteros', 'morteros', 'fusileros', 'fusileros'])).toBeLessThan(run(['fusileros', 'fusileros', 'fusileros', 'fusileros']));
  });
});
