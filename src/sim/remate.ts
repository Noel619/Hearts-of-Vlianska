// El golpe de gracia. Rematar a un caído no es pelear: quien remata se pone
// junto a él y acaba en un momento, según lo que lleve en las manos (un tiro a
// quemarropa, una puñalada de rodillas, un golpe hacia el suelo o, sin arma,
// estrangularlo). Lo da tu gente cuando se lo mandas y la gente del metro que
// ha perdido a alguien a vuestras manos: sangre por sangre.

import { CREATURES } from '../data/criaturas';
import { countItem, gainXp, partWork, takeItem, weaponDef, wear } from './chars';
import { hostile, kill } from './combat';
import { clearDest, faceTo, setDest } from './move';
import type { Sim } from './sim';
import type { Char, Order } from './types';

/** Cómo remata cada cual, según lo que empuña. */
export type RemateHow = 'tiro' | 'clavar' | 'machacar' | 'ahogar';

export interface RemateSpec {
  how: RemateHow;
  /** Distancia a la que se pone del caído (m). */
  range: number;
  /** Segundos hasta el golpe que mata y hasta que se recompone. */
  strike: number;
  end: number;
  /** Parte del cuerpo donde da (0 cabeza, 1 pecho). */
  part: number;
}

/** ¿Puede disparar ahora mismo? (cargado, o con munición a mano para meter una bala). */
function canShoot(c: Char): boolean {
  const s = c.eq.arma;
  const w = weaponDef(c);
  if (!s || !w?.ranged || partWork(c, 4) <= 0) return false;
  if ((s.dur ?? 1) <= 0) return false;
  if (w.ranged.ammo === 'aire' || (s.mag ?? 0) > 0) return true;
  return countItem(c, w.ranged.ammo) > 0;
}

/** Cómo remataría `c` ahora mismo, con lo que lleva. */
export function remateHow(c: Char): RemateHow {
  const w = weaponDef(c);
  if (canShoot(c)) return 'tiro';
  if (!w || partWork(c, 4) <= 0) return 'ahogar';
  if (w.hold === 'una' && (w.cls === 'filo' || w.cls === 'asta')) return 'clavar';
  // Hacia el suelo con lo que sea: hacha, maza, tubo o la culata
  return 'machacar';
}

/** Ritmo de cada forma de rematar. */
export function specOf(c: Char, how: RemateHow): RemateSpec {
  const w = weaponDef(c);
  switch (how) {
    case 'tiro':
      return { how, range: 1.5, strike: 0.55, end: 0.95, part: 0 };
    case 'ahogar': {
      // De rodillas, las dos manos al cuello. Cuanta más fuerza, antes
      const strike = Math.max(2.2, 3.8 - c.sk.fuerza * 0.02);
      return { how, range: 0.95, strike, end: strike + 0.6, part: 0 };
    }
    case 'clavar':
      return { how, range: 0.95, strike: 0.75, end: 1.45, part: 1 };
    default: {
      const strike = 0.45 + 0.22 * (w?.speed ?? 1);
      return { how: 'machacar', range: Math.min(1.35, (w?.reach ?? 1.2) * 0.75), strike, end: strike + 0.6, part: 0 };
    }
  }
}

/** Forma y ritmo del remate de `c`. */
export function remateSpec(c: Char): RemateSpec {
  return specOf(c, remateHow(c));
}

const HOWS = new Set<string>(['tiro', 'clavar', 'machacar', 'ahogar']);

/** Animación del remate: el tipo de ataque que se ve y si se hace de rodillas. */
export function remateAnim(how: RemateHow): { attack: string | null; kneel: boolean } {
  switch (how) {
    case 'clavar':
      return { attack: 'clavar', kneel: true };
    case 'ahogar':
      return { attack: 'ahogar', kneel: true };
    case 'machacar':
      return { attack: 'machacar', kneel: false };
    default:
      return { attack: null, kneel: false };
  }
}

/** ¿Es un asesinato? (rematar a alguien que no es enemigo). */
export function isMurder(sim: Sim, c: Char, v: Char): boolean {
  return v.kind === 'humano' && !v.captive && !hostile(sim, c, v);
}

/** Nombre con artículo de una fiera, para los avisos («un skrebun»). */
export function beastName(c: Char): string {
  const def = CREATURES[c.kind];
  if (!def) return c.name;
  const n = def.name.toLowerCase();
  return (/^rata/.test(n) ? 'una ' : 'un ') + n;
}

/** Remata a `v` en el acto: muerte segura, con su golpe, su sangre y sus consecuencias. */
export function finishOff(sim: Sim, c: Char, v: Char, spec: RemateSpec): void {
  if (v.st === 'muerto') return;
  const murder = c.player && isMurder(sim, c, v);
  const part = spec.part;
  const w = weaponDef(c);
  const st = c.eq.arma;
  if (spec.how === 'tiro' && st && w?.ranged) {
    // Una bala a quemarropa: la del cargador o una que mete a mano
    if (w.ranged.ammo !== 'aire') {
      if ((st.mag ?? 0) > 0) st.mag = (st.mag ?? 1) - 1;
      else takeItem(c, w.ranged.ammo, 1);
    }
    c.sinceFire = 0;
    c.cd = w.ranged.rof;
    if (c.player) wear(sim, c, st, 0.0012);
    sim.emit({ t: 'tiro', id: c.id, x: c.x, z: c.z, tx: v.x, tz: v.z, hit: true, w: st.id, low: true });
    sim.emit({ t: 'golpe', id: c.id, target: v.id, part, dmg: 90, kind: 'bala', block: false, low: true });
    sim.noise(c, w.ranged.noise);
  } else if (spec.how === 'ahogar') {
    sim.emit({ t: 'sonido', k: 'caida', x: v.x, z: v.z, v: 0.4 });
  } else {
    const cut = spec.how === 'clavar' || (w?.cut ?? 0) > (w?.blunt ?? 0);
    sim.emit({ t: 'golpe', id: c.id, target: v.id, part, dmg: 80, kind: cut ? 'corte' : 'contusion', block: false, low: true });
    if (c.player && st && w) wear(sim, c, st, 0.003);
    sim.noise(c, 6);
  }
  v.hp[part] = -v.hpMax[part];
  const female = v.look?.female ?? false;
  const by = c.kind === 'humano' ? c.name : beastName(c);
  kill(sim, v, c, `${female ? 'rematada' : 'rematado'} por ${by}`);
  gainXp(sim, c, 'ataque', 0.6);
  if (c.player) {
    sim.log(`${c.name} remata a ${v.kind === 'humano' ? v.name : beastName(v)}${spec.how === 'ahogar' ? ' con sus propias manos' : ''}.`, 'combate');
    if (murder) sim.crime(v, 70);
  }
}

/** Pose y animación del remate en curso. */
function animate(c: Char, spec: RemateSpec): void {
  const anim = remateAnim(spec.how);
  if (anim.kneel) c.pose = 'arrodillado';
  if (spec.how === 'tiro') c.aim = 1;
  if (anim.attack) {
    c.atkKind = anim.attack;
    c.atkT = Math.min(0.999, c.workT / spec.end);
    c.atkDone = c.workT >= spec.strike;
  }
}

/**
 * Orden de rematar. Se acerca, se coloca junto al caído y acaba con él. Si el
 * caído se levanta, vuelve a ser una pelea; si se lo llevan o muere, termina.
 * La forma de rematar se decide al llegar y se guarda en la orden. Devuelve
 * false cuando ya no hay nada que hacer.
 */
export function runRemate(sim: Sim, c: Char, o: Order, dt: number): boolean {
  const v = o.id ? sim.char(o.id) : null;
  const stop = () => {
    c.workT = 0;
    c.atkT = -1;
    c.aim = 0;
    return false;
  };
  if (!v || v === c) return stop();
  const committed = !!o.data && HOWS.has(o.data);
  if (v.st === 'muerto' || v.captive || v.carriedBy) {
    // Tras el golpe se recompone antes de pasar a otra cosa
    if (committed && v.st === 'muerto' && c.workT > 0) {
      const spec = specOf(c, o.data as RemateHow);
      if (c.workT < spec.end) {
        c.workT += dt;
        c.speed = 0;
        animate(c, spec);
        return true;
      }
    }
    return stop();
  }
  if (v.st === 'ok') {
    // Se ha levantado: si es enemigo, a pelear
    stop();
    if (hostile(sim, c, v)) c.target = v.id;
    return false;
  }
  const spec = committed ? specOf(c, o.data as RemateHow) : remateSpec(c);
  const d = Math.hypot(v.x - c.x, v.z - c.z);
  if (d > spec.range + (c.workT > 0 ? 0.6 : 0.15)) {
    // De camino (o el caído se ha movido): al llegar se vuelve a decidir
    c.workT = 0;
    c.atkT = -1;
    o.data = undefined;
    if (!c.hasDest) {
      o.fail = (o.fail ?? 0) + 1;
      if (o.fail > 4) {
        if (c.player) sim.emit({ t: 'flota', x: c.x, z: c.z, text: 'No puedo llegar', color: '#d8a060' });
        return stop();
      }
    }
    setDest(c, v.x, v.z, spec.range * 0.8, true);
    return true;
  }
  if (c.hasDest) clearDest(c);
  if (!committed) {
    o.data = spec.how;
    c.workT = 0;
  }
  c.speed = 0;
  c.target = 0;
  faceTo(c, v.x, v.z, dt, 10);
  c.workT += dt;
  animate(c, spec);
  if (c.workT >= spec.strike) finishOff(sim, c, v, spec);
  return true;
}

/** Quien remata a un caído ahora mismo (o null). */
export function executioner(sim: Sim, v: Char): Char | null {
  for (const q of sim.state.chars) if (q.st === 'ok' && q.order?.t === 'rematar' && q.order.id === v.id) return q;
  return null;
}

/** ¿Está alguien de tu escuadra en peligro de que lo rematen o se lo coman? */
export function inMortalDanger(sim: Sim, v: Char): boolean {
  if (v.st !== 'ko') return false;
  return sim.state.chars.some((q) => q.st === 'ok' && q.order && (q.order.t === 'rematar' || q.order.t === 'devorar' || q.order.t === 'arrastrar') && q.order.id === v.id);
}

