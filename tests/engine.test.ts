import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/state';
import { advanceDays } from '../src/game/engine';
import { answerEvent } from '../src/game/events';
import { deserialize, serialize } from '../src/game/save';
import { FACTION_IDS, type GameState } from '../src/game/types';

/** Avanza como lo haría un jugador que siempre elige la primera opción de cada evento. */
function playDays(state: GameState, days: number) {
  for (let d = 0; d < days; d++) {
    while (state.playerEvents.length) answerEvent(state, state.playerEvents[0].uid, 0);
    state.peaceOffers = [];
    advanceDays(state, 1);
  }
}

describe('motor', () => {
  it.each(FACTION_IDS)('se puede jugar con %s', (f) => {
    const state = newGame({ player: f, seed: 99 });
    playDays(state, 120);
    expect(state.countries[f]).toBeDefined();
    expect(Number.isFinite(state.countries[f].pp)).toBe(true);
    expect(Number.isFinite(state.countries[f].food)).toBe(true);
  });

  it('guardar y cargar reproduce exactamente la misma partida', () => {
    const a = newGame({ player: 'UNI', seed: 4242 });
    playDays(a, 60);
    const b = deserialize(serialize(a));
    playDays(a, 90);
    playDays(b, 90);
    expect(serialize(b)).toBe(serialize(a));
  });

  it('la misma semilla produce la misma historia', () => {
    const a = newGame({ player: null, seed: 5 });
    const b = newGame({ player: null, seed: 5 });
    advanceDays(a, 200);
    advanceDays(b, 200);
    expect(serialize(b)).toBe(serialize(a));
  });
});
