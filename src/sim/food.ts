// La comida se estropea: los hongos frescos, la carne y los guisos pierden
// frescura día a día y acaban podridos. Lo seco, lo ahumado, las latas y el
// samogón aguantan. En la despensa (y con el invierno crudo) dura más.

import { BUILDS } from '../data/edificios';
import { ITEMS, type Stack } from '../data/items';
import { addItem } from './chars';
import type { Sim } from './sim';

/** Cada cuánto (s de juego) envejece la comida. */
const STEP = 10;
/** Segundos de juego por día. */
const DAY = 1440;

const ACC = new WeakMap<Sim, number>();

/** Envejece una lista de pilas `t` segundos (multiplicados por `k`). Devuelve cuántas raciones se han podrido. */
export function ageFood(list: Stack[], t: number, k = 1): number {
  let rotten = 0;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    const life = ITEMS[s.id]?.spoil;
    if (!life) continue;
    const f = (s.fresh ?? 1) - (t * k) / (life * DAY);
    if (f > 0) {
      s.fresh = f;
      continue;
    }
    list.splice(i, 1);
    rotten += s.n;
    addItem({ inv: list }, 'podrido', s.n);
  }
  return rotten;
}

/** Factor de conservación general: el frío del invierno crudo baja por los pozos y la comida aguanta más. */
function climate(sim: Sim): number {
  return sim.state.flags.inviernoCrudo ? 0.6 : 1;
}

export function stepSpoil(sim: Sim, dt: number): void {
  const acc = (ACC.get(sim) ?? 0) + dt;
  if (acc < STEP) {
    ACC.set(sim, acc);
    return;
  }
  ACC.set(sim, 0);
  const st = sim.state;
  const k = climate(sim);
  let mine = 0;
  for (const c of st.chars) if (c.player && c.st !== 'muerto') mine += ageFood(c.inv, acc, k);
  for (const b of st.buildings) {
    if (b.prog < 1 || !b.store.length) continue;
    mine += ageFood(b.store, acc, k * (BUILDS[b.def].cold ?? 1));
  }
  for (const d of st.drops) ageFood(d.items, acc, k);
  for (const c of st.containers) if (c.opened) ageFood(c.items, acc, k);
  if (mine > 0) {
    const last = st.timers.avisoPodrido ?? -1e9;
    if (st.time - last > 600) {
      st.timers.avisoPodrido = st.time;
      sim.log(`Se ${mine === 1 ? 'ha echado' : 'han echado'} a perder ${mine} ${mine === 1 ? 'ración' : 'raciones'} de comida. Sécala, ahúmala o guárdala en una despensa.`, 'malo');
    }
  }
}
