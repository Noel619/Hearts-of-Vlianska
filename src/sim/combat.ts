// Salud y combate: daño por partes del cuerpo, hemorragias, inconsciencia,
// curas, hambre, cuerpo a cuerpo con paradas y armas de fuego con balística
// real (ver data/balistica.ts).

import { CARTRIDGES, deposited, energy, PATH, section, SKULL, velocityAt, type Cartridge } from '../data/balistica';
import { CREATURES } from '../data/criaturas';
import { ITEMS, Q_POWER, Q_SPREAD, condOf, itemPower, qualityOf, stackState, type Stack } from '../data/items';
import { PART_HIT, type SkillId } from '../data/skills';
import type { FactionId, SideId } from '../data/tipos';
import { clamp, clamp01 } from '../core/math';
import { addItem, armorAt, armorBulk, armorOn, BULK_WEIGHT, countItem, crawling, gainXp, gearBonus, isFlesh, isLost, LIMB_NAMES, loseLimb, partWork, prosOf, sneakMult, takeItem, weaponDef, wear, wieldProblem } from './chars';
import { clearDest, faceTo, setDest } from './move';
import type { Sim } from './sim';
import type { Char } from './types';

const FACTIONS: readonly string[] = ['UNI', 'SDR', 'LEV', 'STA', 'VHL', 'CHE', 'CAL', 'NOR'];

export function relKey(a: string, b: string) {
  return a < b ? a + '|' + b : b + '|' + a;
}

/** Relación entre dos bandos (-100..100). */
export function relation(sim: Sim, a: SideId, b: SideId): number {
  if (a === b) return 100;
  if (a === 'MUT' || b === 'MUT') return -100;
  if (a === 'JUG' || b === 'JUG') {
    const f = (a === 'JUG' ? b : a) as string;
    if (f === 'LIB') return 20;
    return sim.state.rep[f as FactionId] ?? 0;
  }
  if (a === 'LIB' || b === 'LIB') return 15;
  return sim.state.rel[relKey(a, b)] ?? 0;
}

export function hostile(sim: Sim, a: Char, b: Char): boolean {
  if (a === b || a.side === b.side) return false;
  // Los presos ni atacan ni son atacados (si se fugan, ya es otra cosa)
  if (a.captive || b.captive) return false;
  if (a.kind !== 'humano' && !CREATURES[a.kind].hostile) return false;
  if (b.kind !== 'humano' && !CREATURES[b.kind].hostile) return false;
  if (a.side === 'MUT' || b.side === 'MUT') return true;
  // Escuadras enfadadas con el jugador y estaciones en alarma
  if (a.side === 'JUG' || b.side === 'JUG') {
    const npc = a.side === 'JUG' ? b : a;
    const pc = a.side === 'JUG' ? a : b;
    if (pc.fled && pc.fled.by === npc.side && sim.state.time < pc.fled.until) return true;
    if (npc.squad) {
      const sq = sim.squad(npc.squad);
      if (sq?.angry) return true;
    }
    if (npc.ai.sub === 'enfadado') return true;
    if (FACTIONS.includes(npc.side) && sim.state.bounty[npc.side as FactionId] >= 100) return true;
  }
  return relation(sim, a.side, b.side) <= -50;
}

// ---------------------------------------------------------------------------
// Daño
// ---------------------------------------------------------------------------

export function pickPart(sim: Sim): number {
  let r = sim.rng.next();
  for (let i = 0; i < 7; i++) {
    r -= PART_HIT[i];
    if (r <= 0) return i;
  }
  return 1;
}

/** Deja inconsciente a alguien; `where` completa el aviso (p. ej. «en el gas: …»). */
export function knockOut(sim: Sim, c: Char, seconds: number, where?: string): void {
  if (c.st !== 'ok') {
    c.koT = Math.max(c.koT, seconds);
    return;
  }
  c.st = 'ko';
  c.koT = seconds;
  c.pose = 'ko';
  c.atkT = -1;
  c.target = 0;
  c.aim = 0;
  c.order = null;
  c.queue.length = 0;
  clearDest(c);
  dropCarried(sim, c);
  sim.emit({ t: 'ko', id: c.id });
  if (c.player) sim.log(`${c.name} ha caído inconsciente${where ? ' ' + where : ''}.`, 'malo');
}

/** Muerte de un personaje; `cause` completa el aviso (p. ej. «desangrado»). */
export function kill(sim: Sim, c: Char, by?: Char, cause?: string): void {
  if (c.st === 'muerto') return;
  c.st = 'muerto';
  c.pose = 'muerto';
  c.atkT = -1;
  c.target = 0;
  c.aim = 0;
  c.order = null;
  c.queue.length = 0;
  c.bleed = 0;
  c.rot = c.player || c.unique ? 1e9 : 420;
  clearDest(c);
  dropCarried(sim, c);
  sim.emit({ t: 'muerte', id: c.id });
  if (c.player) sim.log(`${c.name} ha muerto${cause ? ' ' + cause : ''}.`, 'malo');
  else if (by?.player) {
    sim.state.stats.kills++;
    if (c.kind === 'skrebun') sim.state.flags.tSkrebun = 1;
    // Cuenta de bajas que tu gente causa en cada bando (los sucesos saben de qué lado luchaste)
    sim.state.flags['matados_' + c.side] = (sim.state.flags['matados_' + c.side] ?? 0) + 1;
    if (c.unique) sim.onUniqueDeath(c, by);
  }
  if (c.unique) sim.state.flags['muerto_' + c.unique] = 1;
  // Los caídos en una estación quedan anotados para no reaparecer enseguida
  if (c.slot) {
    const [place] = c.slot.split(':');
    const st = sim.state.stations[place];
    if (st) st.dead[c.slot] = sim.state.time + 2 * 1440;
  }
  const sq = c.squad ? sim.squad(c.squad) : null;
  if (sq) {
    const m = sq.roster.find((r) => r.id === c.id);
    if (m) m.dead = true;
    // Sangre por sangre: quien pierde a uno de los suyos a vuestras manos no lo olvida
    if (by?.player && c.kind === 'humano') sq.blood = (sq.blood ?? 0) + 1;
  }
  // Las criaturas sueltan carne y trofeos
  if (c.kind !== 'humano') {
    for (const [id, a, b] of CREATURES[c.kind].drops) {
      const n = sim.rng.int(a, b);
      if (n > 0) c.inv.push({ id, n });
    }
  }
}

function dropCarried(sim: Sim, c: Char) {
  if (c.carry) {
    const o = sim.char(c.carry);
    if (o) {
      o.carriedBy = 0;
      o.x = c.x + 0.4;
      o.z = c.z + 0.3;
      if (o.st === 'ok') o.pose = 'normal';
    }
    c.carry = 0;
  }
  if (c.carriedBy) {
    const o = sim.char(c.carriedBy);
    if (o) o.carry = 0;
    c.carriedBy = 0;
  }
}

/**
 * Daño en una parte del cuerpo. `pre`: la armadura ya se ha tenido en cuenta
 * (un balazo, que la atraviesa o no según su energía).
 */
export function damage(sim: Sim, t: Char, part: number, amount: number, kind: 'corte' | 'contusion' | 'bala', by: Char | null, pre = false): number {
  if (t.st === 'muerto') return 0;
  // Donde ya no hay brazo ni pierna el golpe da en el cuerpo
  if (isLost(t, part) && !prosOf(t, part)) part = part <= 4 ? 1 : 2;
  const res = pre ? 0 : armorAt(t, part, kind === 'corte' ? 'cut' : kind === 'contusion' ? 'blunt' : 'pierce');
  const dmg = pre ? amount : Math.max(amount * 0.1, amount * (1 - res));
  // La armadura que para el golpe se gasta
  const absorbed = amount - dmg;
  if (!pre && absorbed > 0.5 && t.kind === 'humano') for (const s of armorOn(t, part)) wear(sim, t, s, absorbed * (kind === 'bala' ? 0.0011 : 0.0007));
  t.sinceHit = 0;
  t.hitSide = by ? Math.sign(Math.sin(Math.atan2(by.z - t.z, by.x - t.x) - t.face)) || 1 : 1;
  if (t.player || t.sk.aguante < 60) gainXp(sim, t, 'aguante', dmg * 0.05 + 0.2);
  const lim = t.hpMax[part];
  if (isLost(t, part)) {
    // Prótesis: ni sangra ni duele, pero se abolla y acaba rompiéndose
    const p = prosOf(t, part)!;
    const before = t.hp[part];
    t.hp[part] = Math.max(0, t.hp[part] - dmg * 0.8);
    p.dur = t.hp[part] / lim;
    if (before > 0 && t.hp[part] <= 0) {
      sim.emit({ t: 'mundo', k: 'miembro', id: t.id, a: part });
      if (t.player) sim.log(`La prótesis de ${t.name} se ha partido. Hay que repararla en un banco de trabajo.`, 'malo');
      const w = t.eq.arma;
      if (w && wieldProblem(t, ITEMS[w.id])) {
        delete t.eq.arma;
        addItem(t, w.id, 1, stackState(w));
      }
    }
    if (by && t.st === 'ok') provoke(sim, t, by);
    return dmg;
  }
  const before = t.hp[part];
  t.hp[part] -= dmg;
  if (kind === 'corte') t.wound[part] += dmg * 0.55;
  else if (kind === 'bala') t.wound[part] += dmg * (pre ? 0.3 : 0.45);
  else t.wound[part] += dmg * 0.06;
  // Muerte o inconsciencia
  if (part <= 2) {
    if (t.hp[part] <= -lim) {
      kill(sim, t, by ?? undefined);
      return dmg;
    }
    if (t.hp[part] <= 0 && t.st === 'ok') {
      knockOut(sim, t, clamp(22 + -t.hp[part] * 0.9 - t.sk.aguante * 0.2, 8, 120));
    } else if (kind === 'contusion' && t.st === 'ok' && part === 0 && dmg > 14 && sim.rng.chance(clamp01(dmg / 70 - t.sk.aguante * 0.004))) {
      // Un buen golpe en la cabeza aturde
      knockOut(sim, t, 6 + sim.rng.next() * 8);
    }
  } else if (t.kind === 'humano') {
    // Un miembro destrozado: si el golpe es brutal se pierde; una pierna rota puede dejar cojera para siempre
    const over = -lim - t.hp[part];
    t.hp[part] = Math.max(t.hp[part], -lim);
    if (over > 0) {
      const beast = !!by && by.kind !== 'humano';
      const p = (kind === 'corte' ? 0.18 : kind === 'bala' ? 0.06 : 0.02) + over / lim + (beast ? 0.12 : 0);
      if (sim.rng.chance(Math.min(0.85, p))) {
        loseLimb(sim, t, part, beast ? 'entre las fauces de una fiera' : kind === 'bala' ? 'de un balazo' : kind === 'corte' ? 'de un tajo' : '');
        if (by && t.st === 'ok') provoke(sim, t, by);
        return dmg;
      }
    }
    if (part >= 5 && before > -lim && t.hp[part] <= -lim && !t.limp && sim.rng.chance(0.35)) {
      t.limp = part;
      if (t.player) sim.log(`A ${t.name} le han destrozado ${LIMB_NAMES[part]}: aunque cure, cojeará para siempre.`, 'malo');
    }
  } else {
    t.hp[part] = Math.max(t.hp[part], -lim);
  }
  // Quien recibe se defiende
  if (by && t.st === 'ok') provoke(sim, t, by);
  return dmg;
}

/** Reacción de un personaje atacado (y de sus aliados cercanos). */
export function provoke(sim: Sim, victim: Char, by: Char): void {
  if (victim.side === by.side) return;
  const wasHostile = hostile(sim, victim, by);
  if (!wasHostile && by.side === 'JUG' && victim.side !== 'MUT') {
    // Agresión del jugador contra alguien pacífico: crimen
    sim.crime(victim, 40);
  }
  if (!victim.target || sim.rng.chance(0.3)) {
    if (victim.player ? victim.stance !== 'pasivo' : true) victim.target = by.id;
  }
  sim.forNear(victim.x, victim.z, 22, (o) => {
    if (o === victim || o.st !== 'ok' || o.side !== victim.side || o.target) return;
    if (o.player && o.stance === 'pasivo') return;
    if (o.role === 'civil' || o.role === 'comerciante' || o.role === 'refugiado' || o.role === 'obrero' || o.role === 'medico') {
      if (!o.player) o.ai.sub = 'susto';
      return;
    }
    o.target = by.id;
  });
}

// ---------------------------------------------------------------------------
// Necesidades: hemorragia, curación, inconsciencia, hambre
// ---------------------------------------------------------------------------

export function stepNeeds(sim: Sim, c: Char, dt: number): void {
  if (c.st === 'muerto') {
    c.rot -= dt;
    return;
  }
  // Hemorragia: cada herida abierta sangra; las pequeñas se cierran solas
  let open = 0;
  for (let i = 0; i < 7; i++) {
    if (c.wound[i] > 0) {
      open += c.wound[i];
      c.wound[i] = Math.max(0, c.wound[i] - dt * (0.035 + c.sk.aguante * 0.0006));
    }
  }
  // La hemorragia interna sangra igual, pero solo se cierra sola si es pequeña
  if (c.inner) {
    open += c.inner;
    c.inner = Math.max(0, c.inner - dt * (0.025 + c.sk.aguante * 0.0003));
  }
  c.bleed = open * 0.012;
  if (c.bleed > 0) {
    c.blood -= c.bleed * dt;
    if (c.blood <= 0) {
      kill(sim, c, undefined, 'desangrado');
      return;
    }
    if (c.blood < 42 && c.st === 'ok') knockOut(sim, c, 40);
  } else if (c.blood < 100) {
    c.blood = Math.min(100, c.blood + dt * 0.05);
  }
  // Curación natural de las partes sin herida abierta (más rápida descansando)
  const rest = c.pose === 'tumbado' ? 5 : c.st === 'ko' ? 1.6 : c.pose === 'sentado' || c.pose === 'sentadoSuelo' ? 1.5 : 1;
  const fed = c.hunger > 25 ? 1 : 0.4;
  for (let i = 0; i < 7; i++) {
    if (c.hp[i] < c.hpMax[i] && c.wound[i] < 1.5 && isFlesh(c, i)) c.hp[i] = Math.min(c.hpMax[i], c.hp[i] + dt * 0.035 * rest * fed);
  }
  // Inconsciencia
  if (c.st === 'ko') {
    c.koT -= dt;
    if (c.koT <= 0 && c.hp[0] > 2 && c.hp[1] > 2 && c.hp[2] > 2 && c.blood > 45 && !c.carriedBy) {
      c.st = 'ok';
      c.pose = 'normal';
      c.sinceHit = 9;
      delete c.eaten;
      if (c.player) sim.log(`${c.name} recupera el conocimiento.`, 'bueno');
    }
  }
  // Hambre (las criaturas no la sufren)
  if (c.kind === 'humano' && (c.player || c.persist)) {
    c.hunger -= dt * 0.042;
    if (c.hunger < 55 && c.st === 'ok') tryEat(sim, c);
    if (c.hunger <= 0) {
      c.hunger = 0;
      c.hp[2] -= dt * 0.05;
      if (c.hp[2] <= 0 && c.st === 'ok') knockOut(sim, c, 60);
      if (c.hp[2] <= -c.hpMax[2]) kill(sim, c, undefined, 'de hambre');
    }
  }
}

function tryEat(sim: Sim, c: Char): void {
  let best = -1;
  let bestN = 0;
  for (let i = 0; i < c.inv.length; i++) {
    const f = ITEMS[c.inv[i].id]?.food ?? 0;
    if (f > 0 && c.inv[i].id !== 'samogon' && (best < 0 || f < bestN) && f <= 100 - c.hunger + 12) {
      best = i;
      bestN = f;
    }
  }
  // Primero lo que está a punto de estropearse
  for (let i = 0; i < c.inv.length; i++) {
    const s = c.inv[i];
    const f = ITEMS[s.id]?.food ?? 0;
    if (f > 0 && s.id !== 'samogon' && (s.fresh ?? 1) < 0.35 && f <= 100 - c.hunger + 20 && (best < 0 || (s.fresh ?? 1) < (c.inv[best].fresh ?? 1))) best = i;
  }
  if (best < 0 && c.hunger < 30) {
    // Con hambre de verdad come lo que haya; si no tiene, pide a un compañero cercano
    for (let i = 0; i < c.inv.length; i++) if ((ITEMS[c.inv[i].id]?.food ?? 0) > 0) best = i;
    if (best < 0 && c.player) {
      let done = false;
      sim.forNear(c.x, c.z, 8, (o) => {
        if (done || !o.player || o === c || o.st === 'muerto') return;
        for (const s of o.inv) {
          const f = ITEMS[s.id]?.food ?? 0;
          if (f > 0 && s.id !== 'samogon') {
            takeItem(o, s.id, 1);
            c.hunger = Math.min(100, c.hunger + f);
            done = true;
            return;
          }
        }
      });
      if (!done && c.player) sim.hungerWarn(c);
      return;
    }
  }
  if (best >= 0) {
    const s = c.inv[best];
    c.hunger = Math.min(100, c.hunger + (ITEMS[s.id].food ?? 0));
    s.n--;
    if (s.n <= 0) c.inv.splice(best, 1);
  }
}

/** Primeros auxilios: `medic` trata a `p`. Devuelve false cuando no queda nada que hacer. */
export function treat(sim: Sim, medic: Char, p: Char, dt: number): boolean {
  // Parte con peor herida abierta, o la más dañada
  let part = -1;
  let worst = 0.8;
  for (let i = 0; i < 7; i++) {
    if (p.wound[i] > worst) {
      worst = p.wound[i];
      part = i;
    }
  }
  // Sin heridas abiertas que vendar, lo urgente es la hemorragia interna: solo la frena un botiquín
  const inside = part < 0 && (p.inner ?? 0) > 1 && countItem(medic, 'botiquin') > 0;
  const useKit = part < 0;
  if (part < 0 && !inside) {
    let low = 0.92;
    for (let i = 0; i < 7; i++) {
      if (!isFlesh(p, i)) continue;
      const f = p.hp[i] / p.hpMax[i];
      if (f < low) {
        low = f;
        part = i;
      }
    }
  }
  if (part < 0 && !inside) return false;
  const kit = countItem(medic, 'botiquin') > 0 ? 'botiquin' : null;
  const band = countItem(medic, 'vendas') > 0 ? 'vendas' : null;
  if (!useKit && !band && !kit) return false;
  if (useKit && !kit) return false;
  medic.workT += dt * (0.7 + medic.sk.medicina * 0.02);
  if (medic.workT < 1.6) return true;
  medic.workT = 0;
  const item = useKit ? kit! : (band ?? kit!);
  const med = ITEMS[item].med!;
  takeItem(medic, item, 1);
  const q = 0.55 + medic.sk.medicina * 0.006;
  if (inside) {
    // Sutura, compresión y morfina: la frena, pero solo un médico la cierra del todo
    p.inner = Math.max(0, (p.inner ?? 0) * (1 - q * 0.45) - 2);
  } else {
    if (med.bleed) p.wound[part] = Math.max(0, p.wound[part] * (1 - q) - 2);
    if (isFlesh(p, part)) p.hp[part] = Math.min(p.hpMax[part], p.hp[part] + med.heal * q);
  }
  gainXp(sim, medic, 'medicina', 1.4);
  sim.emit({ t: 'sonido', k: 'venda', x: p.x, z: p.z });
  return true;
}

/** ¿Necesita que lo curen? `kit`: quien cura lleva botiquín (lo único que frena una hemorragia interna). */
export function needsCare(p: Char, kit = false): boolean {
  if (p.st === 'muerto') return false;
  for (let i = 0; i < 7; i++) if (p.wound[i] > 0.8) return true;
  return kit && (p.inner ?? 0) > 1;
}

// ---------------------------------------------------------------------------
// Detección
// ---------------------------------------------------------------------------

export function sightRange(sim: Sim, c: Char, t: Char): number {
  let base = c.kind === 'humano' ? 24 * (0.65 + c.sk.percepcion * 0.008) : CREATURES[c.kind].sight;
  // La oscuridad esconde; una luz encendida delata
  const dark = c.kind !== 'humano' && !CREATURES[c.kind].lightFear ? 1 : 0;
  let f = dark ? 1 : 0.38 + 0.62 * Math.min(1, t.lit * 1.6);
  if (t.lamp && t.st === 'ok') f = Math.max(f, 1.1);
  // Quien tose por el gas no pasa desapercibido
  if (t.sneak && t.gas < 0.15) f *= sneakMult(t, 0.72);
  if (t.st !== 'ok') f *= 0.6;
  if (c.target === t.id) base *= 1.5;
  return base * f;
}

/** Busca al enemigo visible más cercano. */
export function findEnemy(sim: Sim, c: Char, maxRange = 40): Char | null {
  let best: Char | null = null;
  let bestD = Infinity;
  const nav = sim.world.nav;
  sim.forNear(c.x, c.z, maxRange, (o) => {
    if (o.st !== 'ok' || o.carriedBy || !hostile(sim, c, o)) return;
    const d = Math.hypot(o.x - c.x, o.z - c.z);
    if (d >= bestD) return;
    if (d > sightRange(sim, c, o)) return;
    if (d > 2.5 && nav.sightLine(c.x, c.z, o.x, o.z) < 0.98) return;
    best = o;
    bestD = d;
  });
  if (best && (best as Char).sneak && c.side !== 'JUG') gainXp(sim, best as Char, 'sigilo', 0.02);
  return best;
}

// ---------------------------------------------------------------------------
// Combate
// ---------------------------------------------------------------------------

function weaponSkill(c: Char): SkillId {
  const w = weaponDef(c);
  if (!w) return 'pelea';
  if (w.cls === 'filo') return 'filo';
  if (w.cls === 'contundente') return 'contundente';
  if (w.cls === 'asta') return 'asta';
  return 'contundente';
}

function hasAmmo(c: Char): boolean {
  const s = c.eq.arma;
  const w = weaponDef(c);
  if (!s || !w?.ranged) return false;
  if ((s.mag ?? 0) > 0) return true;
  if (w.ranged.ammo === 'aire') return true;
  return countItem(c, w.ranged.ammo) > 0;
}

/**
 * Lleva el combate de un personaje con objetivo. Devuelve true mientras
 * siga ocupado luchando.
 */
export function stepFight(sim: Sim, c: Char, dt: number): boolean {
  const t = c.target ? sim.char(c.target) : null;
  // A un caído no se le pelea: se le remata (orden aparte)
  if (!t || t.st !== 'ok' || t.carriedBy) {
    c.target = 0;
    c.aim = 0;
    if (c.atkT >= 0) c.atkT = -1;
    return false;
  }
  const dx = t.x - c.x;
  const dz = t.z - c.z;
  const dist = Math.hypot(dx, dz);
  // Pierde de vista a quien se aleja demasiado
  if (dist > 70 || (!c.player && dist > 45 && c.ai.mode !== 'fiera')) {
    c.target = 0;
    c.aim = 0;
    return false;
  }
  const w = weaponDef(c);
  const creature = c.kind !== 'humano' ? CREATURES[c.kind] : null;
  // Un arma de fuego rota no dispara: se usa de maza
  const ranged = !!w?.ranged && hasAmmo(c) && partWork(c, 4) > 0 && condOf(c.eq.arma!) > 0;
  c.cd -= dt;
  // --- Ataque cuerpo a cuerpo en curso -------------------------------------------
  if (c.atkT >= 0) {
    c.atkT += dt / c.atkDur;
    faceTo(c, t.x, t.z, dt, 6);
    if (!c.atkDone && c.atkT >= 0.42) {
      c.atkDone = true;
      resolveMelee(sim, c, t, dist);
    }
    if (c.atkT >= 1) {
      c.atkT = -1;
      c.cd = 0.15 + sim.rng.next() * 0.35;
    }
    c.speed = Math.max(0, c.speed - dt * 10);
    return true;
  }
  // A quemarropa no se dispara: se pelea cuerpo a cuerpo, aunque sea con la culata
  if (ranged && dist > 2.2) {
    const r = w!.ranged!;
    const sight = sim.world.nav.sightLine(c.x, c.z, t.x, t.z);
    const inRange = dist <= r.range && sight > 0.97;
    if (inRange) {
      // Apunta y dispara
      clearDest(c);
      c.speed = Math.max(0, c.speed - dt * 10);
      faceTo(c, t.x, t.z, dt, 8);
      c.aim = 1;
      const st = c.eq.arma!;
      if (c.reload > 0) {
        c.reload -= dt;
        if (c.reload <= 0) {
          const need = r.mag - (st.mag ?? 0);
          st.mag = (st.mag ?? 0) + (r.ammo === 'aire' ? need : takeItem(c, r.ammo, need));
        }
        return true;
      }
      if ((st.mag ?? 0) <= 0) {
        c.reload = r.reload * (1.2 - c.sk.destreza * 0.004);
        sim.emit({ t: 'sonido', k: 'recarga', x: c.x, z: c.z });
        return true;
      }
      const aimed = Math.abs(Math.atan2(dz, dx) - c.face) < 0.2 || Math.abs(Math.abs(Math.atan2(dz, dx) - c.face) - Math.PI * 2) < 0.2;
      if (c.cd <= 0 && aimed) {
        st.mag = (st.mag ?? 1) - 1;
        // La gente del metro apunta con menos prisa que la tuya: un tercio más lenta con cualquier arma
        c.cd = r.rof * (1 + sim.rng.next() * 0.25) * (c.player ? 1 : 1.35);
        c.sinceFire = 0;
        fire(sim, c, t, dist, r, Q_POWER[qualityOf(st)], gunSpread(st));
        if (c.player) wear(sim, c, st, r.ammo === 'aire' ? 0.0009 : 0.0012);
      }
      return true;
    }
    // Sin tiro limpio: se acerca
    c.aim = 0;
    if (!c.hold || c.order?.t === 'atacar') setDest(c, t.x, t.z, Math.min(r.range * 0.7, 10), true);
    return true;
  }
  // --- Cuerpo a cuerpo ---------------------------------------------------------------
  c.aim = 0;
  const reach = creature ? creature.reach : (w?.reach ?? 1.15);
  if (dist > reach) {
    if (!c.hold || c.order?.t === 'atacar' || dist < reach + 2.5) setDest(c, t.x, t.z, reach * 0.8, true);
    return true;
  }
  clearDest(c);
  c.speed = Math.max(0, c.speed - dt * 12);
  faceTo(c, t.x, t.z, dt, 9);
  if (c.cd <= 0 && !crawling(c)) {
    const base = creature ? creature.attackTime : (w?.speed ?? 0.8);
    c.atkDur = base * (1.3 - c.sk.destreza * 0.005);
    c.atkT = 0;
    c.atkDone = false;
    const two = w?.hold === 'dos' || w?.hold === 'fusil';
    c.atkKind = !w ? 'punetazo' : w.cls === 'asta' || (w.cls === 'filo' && w.reach < 1.4 && sim.rng.chance(0.6)) ? 'estocada' : two && sim.rng.chance(0.6) ? 'golpe' : sim.rng.chance(0.25) ? 'estocada' : 'tajo';
    sim.emit({ t: 'ataque', id: c.id });
  }
  return true;
}

function resolveMelee(sim: Sim, c: Char, t: Char, dist: number): void {
  const w = weaponDef(c);
  const creature = c.kind !== 'humano' ? CREATURES[c.kind] : null;
  const reach = (creature ? creature.reach : (w?.reach ?? 1.15)) + 0.5;
  if (dist > reach || t.st === 'muerto') return;
  const wsk = weaponSkill(c);
  const atk = c.sk.ataque * 0.6 + c.sk[wsk] * 0.4 + c.sk.destreza * 0.1 + (creature ? 0 : gearBonus(c, 'grip'));
  const tw = weaponDef(t);
  let def = 0;
  if (t.st === 'ok') {
    // Sin arma con la que parar, se esquiva: el equipo pesado estorba
    def = tw ? t.sk.defensa * 0.75 + tw.parry * 2 * Q_POWER[qualityOf(t.eq.arma!)] + t.sk[weaponSkill(t)] * 0.15 : t.sk.esquiva * 0.6 * Math.max(0, 1 - armorBulk(t) * BULK_WEIGHT) + t.sk.defensa * 0.25;
    if (t.atkT >= 0 && t.atkT < 0.6) def *= 0.55;
    if (t.target !== c.id) def *= 0.5;
    if (partWork(t, 3) <= 0 || partWork(t, 4) <= 0) def *= 0.6;
    // Varios atacantes a la vez saturan la defensa
    let others = 0;
    sim.forNear(t.x, t.z, 3, (o) => {
      if (o !== c && o.target === t.id && o.st === 'ok' && o.atkT >= 0) others++;
    });
    def *= Math.max(0.4, 1 - others * 0.18);
  }
  const pHit = t.st === 'ok' ? clamp(0.62 + (atk - def) * 0.011, 0.12, 0.96) : 1;
  const part = pickPart(sim);
  if (!sim.rng.chance(pHit)) {
    t.sinceBlock = 0;
    gainXp(sim, t, tw ? 'defensa' : 'esquiva', 0.5 + atk * 0.02);
    gainXp(sim, c, 'ataque', 0.25);
    // Parar con el arma la mella
    if (tw && t.player) wear(sim, t, t.eq.arma!, 0.0012);
    sim.emit({ t: 'golpe', id: c.id, target: t.id, part, dmg: 0, kind: 'contusion', block: true });
    if (t.st === 'ok') provoke(sim, t, c);
    return;
  }
  let cut = creature ? creature.cut : (w?.cut ?? 0);
  let blunt = creature ? creature.blunt : (w?.blunt ?? 5 + c.sk.pelea * 0.22);
  let pierce = creature ? 0 : (w?.pierce ?? 0);
  // Las armas de fuego usadas como maza solo golpean
  if (w?.ranged) pierce = 0;
  let skill = 1 + c.sk[wsk] * 0.009;
  if (!creature) {
    // La calidad y el estado del arma, y la mano que la empuña (una prótesis pega menos)
    if (w && c.eq.arma) skill *= itemPower(c.eq.arma);
    if (isLost(c, 4)) skill *= Math.max(0.5, partWork(c, 4));
    if (c.player && w && c.eq.arma) wear(sim, c, c.eq.arma, w.ranged ? 0.004 : 0.0022);
  }
  const rnd = sim.rng.range(0.8, 1.2);
  cut *= (0.7 + c.sk.destreza * 0.007) * skill * rnd;
  blunt *= (0.7 + c.sk.fuerza * 0.009) * skill * rnd;
  pierce *= (0.8 + c.sk.destreza * 0.004) * skill * rnd;
  let total = 0;
  if (cut > 0) total += damage(sim, t, part, cut, 'corte', c);
  if (blunt > 0 && (t.st as string) !== 'muerto') total += damage(sim, t, part, blunt, 'contusion', c);
  if (pierce > 0 && (t.st as string) !== 'muerto') total += damage(sim, t, part, pierce, 'bala', c);
  const xp = 0.6 + Math.min(3, t.sk.defensa / Math.max(8, c.sk.ataque));
  gainXp(sim, c, 'ataque', xp);
  gainXp(sim, c, wsk, xp);
  gainXp(sim, c, blunt > cut ? 'fuerza' : 'destreza', xp * 0.5);
  sim.emit({ t: 'golpe', id: c.id, target: t.id, part, dmg: total, kind: cut >= blunt ? 'corte' : 'contusion', block: false });
}

/** Dispersión que añade un arma de fuego según su calidad y su estado. */
export function gunSpread(s: Stack): number {
  const dur = condOf(s);
  return Q_SPREAD[qualityOf(s)] * (dur < 0.5 ? 1 + (0.5 - dur) * 1.2 : 1);
}

type Ranged = NonNullable<ReturnType<typeof weaponDef>>['ranged'] & object;

// ---------------------------------------------------------------------------
// Balística: dónde entra la bala y lo que hace dentro
// ---------------------------------------------------------------------------

/**
 * Silueta de una persona de pie, de frente, en metros desde el punto al que se
 * apunta (el esternón): [parte, x0, x1, y0, y1].
 */
const BODY: [number, number, number, number, number][] = [
  [0, -0.1, 0.1, 0.2, 0.44],
  [1, -0.18, 0.18, -0.12, 0.2],
  [2, -0.16, 0.16, -0.42, -0.12],
  [3, -0.27, -0.18, -0.5, 0.17],
  [4, 0.18, 0.27, -0.5, 0.17],
  [5, -0.17, -0.02, -1.28, -0.42],
  [6, 0.02, 0.17, -1.28, -0.42],
];
/** Daño por raíz cuadrada de julio cedido al cuerpo. */
const WOUND_K = 4.9;
/** Contusión por raíz cuadrada de julio de una bala que para el blindaje. */
const BLUNT_K = 0.8;

/** Número al azar con distribución normal (media 0, desviación 1). */
function gauss(sim: Sim): number {
  const u = Math.max(1e-9, sim.rng.next());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * sim.rng.next());
}

/** Parte del cuerpo de `t` en el punto (x, y), en metros respecto a donde se apunta; -1 si la bala no le da. */
function partAt(sim: Sim, t: Char, x: number, y: number): number {
  const cr = t.kind !== 'humano' ? CREATURES[t.kind] : null;
  const sc = cr ? cr.scale : 1;
  // Una bestia de cuatro patas es un bulto bajo; dentro, la bala da donde sea
  if (cr && cr.shape === 'cuadrupedo') {
    const w = 0.32 * sc;
    const h = 0.26 * sc;
    return (x / w) ** 2 + (y / h) ** 2 <= 1 ? pickPart(sim) : -1;
  }
  // Quien va agachado o está en el suelo ofrece menos blanco
  const ky = t.st !== 'ok' ? 0.35 : t.sneak ? 0.72 : 1;
  for (const [part, x0, x1, y0, y1] of BODY) {
    if (x >= x0 * sc && x <= x1 * sc && y >= y0 * sc * ky && y <= y1 * sc * ky) return part;
  }
  return -1;
}

/**
 * Un disparo de `c` contra `t`, a `dist` metros. `power`: calidad del arma
 * (cuánto aprovecha la pólvora); `extra` multiplica su dispersión propia
 * (calidad y estado); `from` es la boca del arma si no es la del tirador (un
 * nido de ametralladora).
 *
 * El tirador apunta al pecho. Su error de puntería (pericia, luz, si el blanco
 * corre o si le acaban de dar) y la dispersión del arma deciden dónde llega la
 * bala: si cae en la silueta, en qué parte del cuerpo. La posta se abre
 * alrededor del punto apuntado, perdigón a perdigón.
 */
export function fire(sim: Sim, c: Char, t: Char, dist: number, r: Ranged, power = 1, extra = 1, from?: { x: number; z: number; w: string }): void {
  const k = CARTRIDGES[r.cart];
  let aim = r.aim * Math.max(0.35, 1.6 - c.sk.punteria * 0.012);
  if (t.speed > 1.5) aim *= 1.3;
  if (c.sinceHit < 1) aim *= 1.5;
  aim *= 1.5 - 0.5 * Math.min(1, t.lit * 1.6 + (t.lamp ? 0.6 : 0));
  if (!from && partWork(c, 3) <= 0.05) aim *= 1.5;
  const sigma = Math.hypot(aim, r.spread * extra) * dist;
  const ax = gauss(sim) * sigma;
  const ay = gauss(sim) * sigma;
  // Velocidad en boca: la del cañón según su calidad, con lo que varía una carga hecha a mano
  const v = velocityAt(k, r.v0 * (0.94 + 0.06 * power) * (1 + gauss(sim) * 0.025), dist);
  let any = false;
  for (let i = 0; i < k.pellets && t.st !== 'muerto'; i++) {
    const x = ax + (r.pattern ? gauss(sim) * r.pattern * dist : 0);
    const y = ay + (r.pattern ? gauss(sim) * r.pattern * dist : 0);
    const part = partAt(sim, t, x, y);
    if (part < 0) continue;
    any = true;
    const hit = bulletHit(sim, t, part, k, v, c);
    sim.emit({ t: 'golpe', id: c.id, target: t.id, part: hit.part, dmg: hit.dmg, kind: 'bala', block: hit.stopped });
  }
  gainXp(sim, c, 'punteria', any ? 1.2 : 0.5);
  gainXp(sim, c, 'percepcion', 0.2);
  // El trazo va adonde fue la bala de verdad
  const x0 = from?.x ?? c.x;
  const z0 = from?.z ?? c.z;
  const ux = (t.x - x0) / Math.max(0.1, dist);
  const uz = (t.z - z0) / Math.max(0.1, dist);
  const off = any ? 0 : ax + Math.sign(ax || 1) * 0.3;
  sim.emit({ t: 'tiro', id: c.id, x: x0, z: z0, tx: t.x - uz * off, tz: t.z + ux * off, hit: any, w: from?.w ?? c.eq.arma?.id ?? '' });
  sim.noise(c, r.noise);
  if (!any && t.st === 'ok') provoke(sim, t, c);
}

/**
 * Una bala de `v` m/s que alcanza `part`: atraviesa (o no) el blindaje que la
 * cubre, cede en el cuerpo la energía que le da tiempo a soltar y toca lo que
 * haya dentro. Devuelve el daño, si la paró el blindaje y la parte alcanzada.
 */
export function bulletHit(sim: Sim, t: Char, part: number, k: Cartridge, v: number, by: Char | null): { dmg: number; stopped: boolean; part: number } {
  // Donde ya no hay brazo ni pierna la bala sigue hasta el cuerpo
  if (isLost(t, part) && !prosOf(t, part)) part = part <= 4 ? 1 : 2;
  let e = energy(k, v);
  const area = section(k);
  let tissue = k.tissue;
  for (const s of armorOn(t, part)) {
    const bal = ITEMS[s.id].armor!.bal ?? 0;
    if (bal <= 0) continue;
    // Energía que hace falta para abrirse paso: la resistencia de la pieza por la sección de la bala
    const stop = bal * itemPower(s) * area;
    if (t.kind === 'humano') wear(sim, t, s, Math.min(e, stop) * 0.00003);
    if (e <= stop) {
      // La para, pero el golpe llega: costillas rotas y moratones
      return { dmg: damage(sim, t, part, BLUNT_K * Math.sqrt(e), 'contusion', by, true), stopped: true, part };
    }
    e -= stop;
    // Tras atravesar una chapa, la bala va deformada y vuelca antes
    if (bal >= 4) tissue *= 0.7;
  }
  const cr = t.kind !== 'humano' ? CREATURES[t.kind] : null;
  const dep = deposited(k, e, PATH[part] * (cr ? cr.scale : 1), tissue);
  const dmg = damage(sim, t, part, WOUND_K * Math.sqrt(dep) * sim.rng.range(0.85, 1.15), 'bala', by, true);
  if (t.st !== 'muerto') vitals(sim, t, part, k, e, dep, by);
  return { dmg, stopped: false, part };
}

/**
 * Lo que toca una bala dentro del cuerpo. El cerebro (si atraviesa el
 * cráneo), el corazón o la aorta, los pulmones, el hígado o el bazo, la
 * columna, las arterias de brazos y piernas y los huesos: de eso, y no de la
 * suma de rasguños, depende que un tiro tumbe o mate.
 */
function vitals(sim: Sim, t: Char, part: number, k: Cartridge, e: number, dep: number, by: Char | null): void {
  if (isLost(t, part)) return;
  const r = sim.rng.next();
  switch (part) {
    case 0: {
      // Tres de cada cuatro tiros en la cabeza llegan al cerebro, si la bala atraviesa el cráneo
      if (r >= 0.72) return;
      const brain = deposited(k, Math.max(0, e - SKULL * section(k)), PATH[0]);
      if (brain > 45) kill(sim, t, by ?? undefined, 'de un tiro en la cabeza');
      else knockOut(sim, t, 120 + brain * 4, 'de un balazo en la cabeza');
      return;
    }
    case 1:
      if (r < 0.13) {
        // Corazón o aorta: se desangra por dentro en segundos
        bleedInside(sim, t, 420);
        if (t.player) sim.log(`${t.name} tiene un balazo en el corazón.`, 'malo');
      } else if (r < 0.19) knockOut(sim, t, 300, 'con un balazo en la columna');
      else if (r < 0.75) bleedInside(sim, t, 14 + dep * 0.012); // pulmón
      return;
    case 2:
      if (r < 0.28) bleedInside(sim, t, 20 + dep * 0.015); // hígado, bazo, riñón o un vaso grande
      else if (r < 0.33) knockOut(sim, t, 300, 'con un balazo en la columna');
      else bleedInside(sim, t, 6); // intestino
      return;
    default: {
      const leg = part >= 5;
      // Una arteria (braquial o femoral) sangra a chorro, aunque una venda bien apretada la corta
      if (r < (leg ? 0.08 : 0.07)) {
        t.wound[part] += leg ? 130 : 110;
        if (t.player) sim.log(`A ${t.name} le han abierto una arteria: hay que vendarle ${LIMB_NAMES[part]} ya.`, 'malo');
      }
      // Hueso roto: el brazo o la pierna dejan de servir hasta que se cure
      if (t.kind === 'humano' && t.hp[part] > -0.15 * t.hpMax[part] && sim.rng.chance(Math.min(0.85, dep / (leg ? 450 : 350)))) {
        t.hp[part] = -0.15 * t.hpMax[part];
        if (t.player) sim.log(`A ${t.name} le han roto ${LIMB_NAMES[part]} de un balazo.`, 'malo');
      }
    }
  }
}

/** Hemorragia interna: no la corta una venda. */
function bleedInside(sim: Sim, t: Char, n: number): void {
  const before = t.inner ?? 0;
  t.inner = before + n;
  if (t.player && before < 5 && n >= 10 && n < 400) sim.log(`${t.name} sangra por dentro: hace falta un botiquín, y pronto un médico.`, 'malo');
}

/** Recarga fuera de combate. */
export function topUpMagazine(sim: Sim, c: Char, dt: number): void {
  const st = c.eq.arma;
  const w = weaponDef(c);
  if (!st || !w?.ranged) return;
  if ((st.mag ?? 0) >= w.ranged.mag) return;
  if (w.ranged.ammo !== 'aire' && countItem(c, w.ranged.ammo) <= 0) return;
  c.reload += dt;
  if (c.reload >= w.ranged.reload) {
    c.reload = 0;
    const need = w.ranged.mag - (st.mag ?? 0);
    st.mag = (st.mag ?? 0) + (w.ranged.ammo === 'aire' ? need : takeItem(c, w.ranged.ammo, need));
  }
}
