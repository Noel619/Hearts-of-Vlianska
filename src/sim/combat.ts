// Salud y combate: daño por partes del cuerpo, hemorragias, inconsciencia,
// curas, hambre, cuerpo a cuerpo con paradas y armas de fuego con puntería.

import { CREATURES } from '../data/criaturas';
import { ITEMS } from '../data/items';
import { PART_HIT, type SkillId } from '../data/skills';
import type { FactionId, SideId } from '../data/tipos';
import { clamp, clamp01 } from '../core/math';
import { armorAt, countItem, crawling, gainXp, takeItem, weaponDef } from './chars';
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
  if (a.kind !== 'humano' && !CREATURES[a.kind].hostile) return false;
  if (b.kind !== 'humano' && !CREATURES[b.kind].hostile) return false;
  if (a.side === 'MUT' || b.side === 'MUT') return true;
  // Escuadras enfadadas con el jugador y estaciones en alarma
  if (a.side === 'JUG' || b.side === 'JUG') {
    const npc = a.side === 'JUG' ? b : a;
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

export function knockOut(sim: Sim, c: Char, seconds: number): void {
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
  if (c.player) sim.log(`${c.name} ha caído inconsciente.`, 'malo');
}

export function kill(sim: Sim, c: Char, by?: Char): void {
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
  if (c.player) sim.log(`${c.name} ha muerto.`, 'malo');
  else if (by?.player) {
    sim.state.stats.kills++;
    if (c.unique) sim.onUniqueDeath(c, by);
  }
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

export function damage(sim: Sim, t: Char, part: number, amount: number, kind: 'corte' | 'contusion' | 'bala', by: Char | null): number {
  if (t.st === 'muerto') return 0;
  const res = armorAt(t, part, kind === 'corte' ? 'cut' : kind === 'contusion' ? 'blunt' : 'pierce');
  const dmg = Math.max(amount * 0.1, amount * (1 - res));
  t.hp[part] -= dmg;
  if (kind === 'corte') t.wound[part] += dmg * 0.55;
  else if (kind === 'bala') t.wound[part] += dmg * 0.45;
  else t.wound[part] += dmg * 0.06;
  t.sinceHit = 0;
  t.hitSide = by ? Math.sign(Math.sin(Math.atan2(by.z - t.z, by.x - t.x) - t.face)) || 1 : 1;
  if (t.player || t.sk.aguante < 60) gainXp(sim, t, 'aguante', dmg * 0.05 + 0.2);
  // Muerte o inconsciencia
  const lim = t.hpMax[part];
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
  c.bleed = open * 0.012;
  if (c.bleed > 0) {
    c.blood -= c.bleed * dt;
    if (c.blood <= 0) {
      kill(sim, c);
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
    if (c.hp[i] < c.hpMax[i] && c.wound[i] < 1.5) c.hp[i] = Math.min(c.hpMax[i], c.hp[i] + dt * 0.035 * rest * fed);
  }
  // Inconsciencia
  if (c.st === 'ko') {
    c.koT -= dt;
    if (c.koT <= 0 && c.hp[0] > 2 && c.hp[1] > 2 && c.hp[2] > 2 && c.blood > 45 && !c.carriedBy) {
      c.st = 'ok';
      c.pose = 'normal';
      c.sinceHit = 9;
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
      if (c.hp[2] <= -c.hpMax[2]) kill(sim, c);
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
  const useKit = part < 0;
  if (part < 0) {
    let low = 0.92;
    for (let i = 0; i < 7; i++) {
      const f = p.hp[i] / p.hpMax[i];
      if (f < low) {
        low = f;
        part = i;
      }
    }
  }
  if (part < 0) return false;
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
  if (med.bleed) p.wound[part] = Math.max(0, p.wound[part] * (1 - q) - 2);
  p.hp[part] = Math.min(p.hpMax[part], p.hp[part] + med.heal * q);
  gainXp(sim, medic, 'medicina', 1.4);
  sim.emit({ t: 'sonido', k: 'venda', x: p.x, z: p.z });
  return true;
}

export function needsCare(p: Char): boolean {
  if (p.st === 'muerto') return false;
  for (let i = 0; i < 7; i++) if (p.wound[i] > 0.8) return true;
  return false;
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
  if (t.sneak) f *= 0.72 - t.sk.sigilo * 0.004;
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
  if (!t || t.st === 'muerto' || (t.st === 'ko' && c.order?.data !== 'rematar') || t.carriedBy) {
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
  const ranged = !!w?.ranged && hasAmmo(c) && c.hp[4] > 0;
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
  if (ranged) {
    const r = w!.ranged!;
    const sight = dist < 2 ? 1 : sim.world.nav.sightLine(c.x, c.z, t.x, t.z);
    const inRange = dist <= r.range && sight > 0.97;
    if (inRange && dist > 2.2) {
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
        c.cd = r.rof * (1 + sim.rng.next() * 0.25) + (c.player ? 0 : 0.25);
        c.sinceFire = 0;
        fire(sim, c, t, dist, r, w!.pierce);
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
  const atk = c.sk.ataque * 0.6 + c.sk[wsk] * 0.4 + c.sk.destreza * 0.1;
  const tw = weaponDef(t);
  let def = 0;
  if (t.st === 'ok') {
    def = tw ? t.sk.defensa * 0.75 + tw.parry * 2 + t.sk[weaponSkill(t)] * 0.15 : t.sk.esquiva * 0.6 + t.sk.defensa * 0.25;
    if (t.atkT >= 0 && t.atkT < 0.6) def *= 0.55;
    if (t.target !== c.id) def *= 0.5;
    if (t.hp[3] <= 0 || t.hp[4] <= 0) def *= 0.6;
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
    sim.emit({ t: 'golpe', id: c.id, target: t.id, part, dmg: 0, kind: 'contusion', block: true });
    if (t.st === 'ok') provoke(sim, t, c);
    return;
  }
  let cut = creature ? creature.cut : (w?.cut ?? 0);
  let blunt = creature ? creature.blunt : (w?.blunt ?? 5 + c.sk.pelea * 0.22);
  let pierce = creature ? 0 : (w?.pierce ?? 0);
  // Las armas de fuego usadas como maza solo golpean
  if (w?.ranged) pierce = 0;
  const skill = 1 + c.sk[wsk] * 0.009;
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

function fire(sim: Sim, c: Char, t: Char, dist: number, r: NonNullable<ReturnType<typeof weaponDef>>['ranged'] & object, pierce: number): void {
  const pellets = r.pellets ?? 1;
  let spread = r.spread * (1.7 - c.sk.punteria * 0.012);
  if (t.speed > 1.5) spread *= 1.3;
  if (c.sinceHit < 1) spread *= 1.5;
  spread *= 1.5 - 0.5 * Math.min(1, t.lit * 1.6 + (t.lamp ? 0.6 : 0));
  if (c.hp[3] <= 0) spread *= 1.5;
  const ang = Math.atan(0.34 / Math.max(1, dist));
  let any = false;
  for (let i = 0; i < pellets; i++) {
    const p = clamp(ang / (spread * 1.25), 0.04, 0.97);
    if (t.st !== 'muerto' && sim.rng.chance(p)) {
      any = true;
      const part = pickPart(sim);
      const dmg = damage(sim, t, part, pierce * sim.rng.range(0.8, 1.25), 'bala', c);
      sim.emit({ t: 'golpe', id: c.id, target: t.id, part, dmg, kind: 'bala', block: false });
    }
  }
  gainXp(sim, c, 'punteria', any ? 1.2 : 0.5);
  gainXp(sim, c, 'percepcion', 0.2);
  const miss = any ? 0 : (sim.rng.next() - 0.5) * 2.2;
  sim.emit({ t: 'tiro', id: c.id, x: c.x, z: c.z, tx: t.x + miss, tz: t.z + miss, hit: any, w: c.eq.arma?.id ?? '' });
  sim.noise(c, r.noise);
  if (!any && t.st === 'ok') provoke(sim, t, c);
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
