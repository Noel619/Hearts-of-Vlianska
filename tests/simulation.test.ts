import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/state';
import { advanceDays } from '../src/game/engine';
import { FACTION_IDS } from '../src/game/types';
import { ownedStations } from '../src/game/helpers';
import { formatDate } from '../src/game/time';

function summary(state: ReturnType<typeof newGame>) {
  const rows = FACTION_IDS.map((f) => {
    const c = state.countries[f];
    const units = Object.values(state.units).filter((u) => u.owner === f).length;
    return `${f} ${c.alive ? 'vivo ' : 'MUERTO'} est=${ownedStations(state, f).length} uds=${units} civ=${c.derived.civTotal.toFixed(1)} mil=${c.derived.milTotal.toFixed(1)} mp=${Math.round(c.derived.manpowerAvailable)}/${Math.round(c.derived.manpowerMax)} pp=${Math.round(c.pp)} comida=${Math.round(c.food)} (${(c.derived.foodProd - c.derived.foodCons + c.derived.foodTrade).toFixed(1)}) estab=${Math.round(c.derived.stability * 100)} arm=${Math.round(c.stockpile.armas)} foc=${c.focus.done.length} tec=${c.research.done.length}${Object.entries(c.influence ?? {}).map(([k, v]) => ` inf:${k}=${Math.round(v ?? 0)}`).join('')}${c.overlord ? ` señor=${c.overlord}` : ''} ${c.leader}`;
  });
  return rows.join('\n');
}

describe('simulación de IA', () => {
  it('avanza varios años sin errores', () => {
    const state = newGame({ player: null, seed: Number(process.env.SEED ?? 1234) });
    const years = Number(process.env.YEARS ?? 3);
    for (let m = 0; m < years * 12; m++) {
      advanceDays(state, 30);
      if (m % 6 === 5) {
        console.log(`--- ${formatDate(state.hour)} | tensión ${Math.round(state.tension * 100)} % | guerras: ${state.wars.map((w) => w.name).join('; ') || 'ninguna'}`);
        console.log(summary(state));
      }
    }
    const log = state.log.filter((l) => l.kind === 'guerra' || l.kind === 'diplo').slice(-40);
    console.log(log.map((l) => `${formatDate(l.hour)}: ${l.text}`).join('\n'));
    expect(state.hour).toBeGreaterThan(0);
  });
});
