// El gas de los túneles: quien lo respira sin máscara se ahoga poco a poco
// (el daño va al pecho), tose y se delata. Las máscaras con filtro lo dejan
// fuera mientras el filtro aguante; el respirador solo con el gas ligero.

import { FILTER_LIFE, GAS_DENSE } from '../data/gases';
import { ITEMS, type Stack } from '../data/items';
import { countItem, takeItem } from './chars';
import { kill, knockOut } from './combat';
import type { Sim } from './sim';
import type { Char } from './types';

/** Puntos de pecho por segundo respirando gas denso a pelo. */
export const GAS_DAMAGE = 1.2;
/** Por debajo de esta densidad el aire se considera limpio. */
const CLEAN = 0.02;
/** Distancia a la que un compañero puede pasarte un filtro (m). */
const SHARE = 6;

/** Máscara con filtro que lleva puesta (o null). */
export function filterMask(c: Char): Stack | null {
  const s = c.eq.cara;
  return s && ITEMS[s.id]?.armor?.filter ? s : null;
}

/** Densidad de gas que su máscara deja fuera ahora mismo (0 sin máscara o sin filtro útil). */
export function protection(c: Char): number {
  const m = filterMask(c);
  if (!m) return 0;
  const lvl = ITEMS[m.id].armor!.filter!;
  return (m.fil ?? 0) > 0 || countItem(c, 'filtros') > 0 ? lvl : 0;
}

/** Filtros de repuesto a mano: los suyos y, si es de la escuadra, los de quien tenga cerca. */
export function spareFilters(sim: Sim, c: Char): number {
  let n = countItem(c, 'filtros');
  if (c.player) {
    sim.forNear(c.x, c.z, SHARE, (o) => {
      if (o !== c && o.player && o.st !== 'muerto') n += countItem(o, 'filtros');
    });
  }
  return n;
}

/** Pone un filtro nuevo en la máscara: uno suyo o, si no tiene, uno de un compañero cercano. */
export function fitFilter(sim: Sim, c: Char, mask: Stack, announce = true): boolean {
  let from: Char | null = countItem(c, 'filtros') > 0 ? c : null;
  if (!from && c.player) {
    let most = 0;
    sim.forNear(c.x, c.z, SHARE, (o) => {
      const n = o !== c && o.player && o.st !== 'muerto' ? countItem(o, 'filtros') : 0;
      if (n > most) {
        most = n;
        from = o;
      }
    });
  }
  if (!from) return false;
  takeItem(from, 'filtros', 1);
  mask.fil = FILTER_LIFE;
  if (announce) {
    sim.emit({ t: 'sonido', k: 'filtro', x: c.x, z: c.z });
    sim.emit({ t: 'flota', x: c.x, z: c.z, text: 'Filtro nuevo', color: '#b9d77a' });
    if (c.player && spareFilters(sim, c) === 0) sim.log(`${c.name} ha puesto el último filtro que os quedaba.`, 'malo');
  }
  return true;
}

/** ¿Puede alguien respirar en un punto sin ahogarse (con lo que lleva puesto)? */
export function breathable(sim: Sim, c: Char, x: number, z: number): boolean {
  if (c.kind !== 'humano') return true;
  const d = sim.world.gas.at(x, z);
  return d < CLEAN || d <= protection(c);
}

/** Último aviso de gas a cada personaje (no se guarda: solo evita repetir avisos). */
const warned = new WeakMap<Sim, Map<number, number>>();

function warn(sim: Sim, c: Char, msg: string) {
  let m = warned.get(sim);
  if (!m) warned.set(sim, (m = new Map()));
  const last = m.get(c.id) ?? -1e9;
  if (sim.state.time - last < 90) return;
  m.set(c.id, sim.state.time);
  sim.log(msg, 'malo');
}

/**
 * Un paso del gas para un personaje (a 2 Hz, con el resto de necesidades).
 * Deja en `c.gas` la dosis que respira de verdad, ya descontada la máscara.
 */
export function stepGas(sim: Sim, c: Char, dt: number): void {
  if (c.kind !== 'humano' || c.st === 'muerto') {
    c.gas = 0;
    return;
  }
  const d = sim.world.gas.at(c.x, c.z);
  if (d < CLEAN) {
    c.gas = 0;
    return;
  }
  let dose = d;
  const mask = filterMask(c);
  if (mask) {
    if (!((mask.fil ?? 0) > 0)) fitFilter(sim, c, mask);
    if ((mask.fil ?? 0) > 0) {
      dose = Math.max(0, d - ITEMS[mask.id].armor!.filter!);
      // La gente del metro que hace guardia arriba trae filtros de sobra; los tuyos se gastan
      if (c.player || !c.ai.place.startsWith('SUP')) mask.fil = Math.max(0, mask.fil! - dt * d);
      if ((mask.fil ?? 0) <= 0 && !fitFilter(sim, c, mask) && c.player) warn(sim, c, `A ${c.name} se le ha agotado el filtro y no quedan más: el gas ya le pasa.`);
    } else if (c.player) warn(sim, c, `${c.name} no tiene filtros: la máscara no le protege del gas.`);
  }
  c.gas = dose;
  if (dose <= 0) return;
  if (c.player && c.st === 'ok') {
    const where = sim.world.gas.pocketAt(c.x, c.z)?.def.name ?? 'el túnel';
    if (mask && d > GAS_DENSE && (mask.fil ?? 0) > 0) warn(sim, c, `${c.name} respira gas en ${where}: aquí es denso y el respirador no basta.`);
    else if (!mask) warn(sim, c, `${c.name} respira gas en ${where}: sin una máscara con filtro le quema el pecho.`);
  }
  // El gas quema el pecho; quien cae dentro no despierta hasta que lo saquen
  c.hp[1] -= dt * GAS_DAMAGE * dose;
  if (c.hp[1] <= -c.hpMax[1]) {
    kill(sim, c, undefined, 'asfixiado por el gas');
    return;
  }
  if (c.hp[1] <= 0 && c.st === 'ok') {
    knockOut(sim, c, 30, 'en el gas: sacadlo de ahí o se asfixiará');
    return;
  }
  // Tos: hace ruido y delata a quien va en sigilo
  if (c.st === 'ok' && sim.rng.chance(Math.min(0.8, dose * dt * 0.9))) {
    sim.emit({ t: 'sonido', k: 'tos', x: c.x, z: c.z, v: 0.6 + dose * 0.4 });
    sim.noise(c, 12);
  }
}

/** Punto cercano con aire respirable al que apartarse, o null. */
export function cleanAirNear(sim: Sim, c: Char): { x: number; z: number } | null {
  const nav = sim.world.nav;
  // Primero, aire limpio en línea recta a pocos pasos
  for (let r = 3; r <= 24; r += 3) {
    const n = Math.max(8, Math.round(r * 1.2));
    let best: { x: number; z: number } | null = null;
    let bd = Infinity;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (!breathable(sim, c, x, z) || !nav.passableAt(x, z, true)) continue;
      if (!nav.walkLine(c.x, c.z, x, z, true)) continue;
      const g = sim.world.gas.at(x, z);
      if (g < bd) {
        bd = g;
        best = { x, z };
      }
    }
    if (best) return best;
  }
  // Si no, la salida más cercana de la bolsa siguiendo el túnel
  const pocket = sim.world.gas.pocketAt(c.x, c.z, 0);
  let exit: { x: number; z: number } | null = null;
  let ed = Infinity;
  for (const e of pocket?.exits ?? []) {
    const d = Math.hypot(e.x - c.x, e.z - c.z);
    if (d < ed && breathable(sim, c, e.x, e.z)) {
      ed = d;
      exit = e;
    }
  }
  return exit ? nav.nearestPassable(exit.x, exit.z, 6, true) : null;
}
