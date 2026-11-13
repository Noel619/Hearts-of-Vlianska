// Personajes: creación, estadísticas derivadas, inventario, equipo y experiencia.

import { CREATURES } from '../data/criaturas';
import { FILTER_LIFE } from '../data/gases';
import { makeLoadout, makeLook, type Role } from '../data/gente';
import { ITEMS, stackState, type ArmorSlot, type EquipSlot, type ItemDef, type Stack, type WeaponDef } from '../data/items';
import type { Look } from '../data/looks';
import { randomName } from '../data/nombres';
import { PART_MAX, SKILL_IDS, xpForLevel, type SkillId } from '../data/skills';
import type { SideId } from '../data/tipos';
import { Rng } from '../core/rng';
import type { Sim } from './sim';
import type { Char } from './types';

export function blankSkills(v = 1): Record<SkillId, number> {
  const o = {} as Record<SkillId, number>;
  for (const k of SKILL_IDS) o[k] = v;
  return o;
}

export function newChar(sim: Sim, x: number, z: number, side: SideId, kind = 'humano'): Char {
  const c: Char = {
    id: sim.state.nextId++,
    name: '',
    side,
    kind,
    role: '',
    squad: 0,
    x,
    z,
    face: 0,
    look: null,
    sk: blankSkills(),
    hp: PART_MAX.slice(),
    hpMax: PART_MAX.slice(),
    blood: 100,
    bleed: 0,
    wound: [0, 0, 0, 0, 0, 0, 0],
    hunger: 70 + sim.rng.next() * 30,
    st: 'ok',
    koT: 0,
    inv: [],
    eq: {},
    money: 0,
    path: null,
    pi: 0,
    route: null,
    ri: 0,
    destX: x,
    destZ: z,
    hasDest: false,
    arrive: 0.4,
    speed: 0,
    run: true,
    stuck: 0,
    repath: 0,
    order: null,
    queue: [],
    target: 0,
    atkT: -1,
    atkDur: 1,
    atkKind: 'tajo',
    atkDone: false,
    cd: 0,
    sinceFire: 9,
    sinceHit: 9,
    hitSide: 0,
    sinceBlock: 9,
    reload: 0,
    aim: 0,
    workT: 0,
    player: false,
    sneak: false,
    lamp: false,
    stance: 'defensivo',
    hold: false,
    autoHeal: true,
    carry: 0,
    carriedBy: 0,
    ai: { mode: 'quieto', t: sim.rng.next() * 2, homeX: x, homeZ: z, homeFace: 0, place: '', spot: -1, sub: '', n: 0 },
    jobs: [],
    pose: 'normal',
    work: 'nada',
    persist: false,
    lit: 0.5,
    gas: 0,
    seenT: 0,
    rot: 0,
  };
  return c;
}

/** Crea una persona de un arquetipo, con aspecto, equipo y pericia coherentes. */
export function makeHuman(sim: Sim, side: SideId, role: Role, x: number, z: number, seed?: number): Char {
  const rng = seed !== undefined ? new Rng(seed) : sim.rng;
  const c = newChar(sim, x, z, side);
  c.role = role;
  c.look = makeLook(rng, side, role);
  c.name = randomName(rng, c.look.female, side === 'CAL' ? 'califato' : side === 'VHL' ? 'bandido' : 'ruso');
  const lo = makeLoadout(rng, side, role);
  const cv = lo.combat;
  const set = (k: SkillId, v: number) => (c.sk[k] = Math.max(1, Math.min(95, v * rng.range(0.75, 1.25))));
  set('fuerza', cv * 0.9 + 6);
  set('destreza', cv * 0.9 + 5);
  set('aguante', cv * 0.9 + 6);
  set('percepcion', cv * 0.7 + 8);
  set('ataque', cv);
  set('defensa', cv * 0.9);
  set('filo', cv * 0.8);
  set('contundente', cv * 0.8);
  set('asta', cv * 0.6);
  set('pelea', cv * 0.6);
  set('punteria', cv * 0.95);
  set('esquiva', cv * 0.6);
  set('atletismo', cv * 0.6 + 10);
  set('sigilo', role === 'stalker' || role === 'bandido' || role === 'cazador' ? cv * 0.9 : cv * 0.3);
  for (const k of ['medicina', 'ingenieria', 'chatarreria', 'cultivo', 'cocina', 'armeria', 'ciencia', 'cerraduras'] as SkillId[]) set(k, lo.craft * rng.range(0.3, 1));
  if (role === 'medico') c.sk.medicina = rng.range(45, 70);
  if (role === 'obrero') c.sk.ingenieria = rng.range(25, 50);
  c.money = lo.money;
  for (const [id, n] of lo.items) if (n > 0) addItem(c, id, n);
  if (lo.sidearm) addItem(c, lo.sidearm, 1);
  for (const a of lo.armor) {
    const def = ITEMS[a];
    // Las máscaras de quien vive en los túneles llevan su filtro puesto
    if (def?.armor) c.eq[def.armor.slot] = def.armor.filter ? { id: a, n: 1, fil: FILTER_LIFE } : { id: a, n: 1 };
  }
  if (lo.weapon) {
    const st: Stack = { id: lo.weapon, n: 1 };
    const r = ITEMS[lo.weapon].weapon?.ranged;
    if (r) st.mag = r.mag;
    c.eq.arma = st;
  }
  c.lamp = role === 'stalker' || role === 'cazador';
  return c;
}

export function makeCreature(sim: Sim, kind: string, x: number, z: number): Char {
  const def = CREATURES[kind];
  const c = newChar(sim, x, z, kind === 'cerdo' ? 'LIB' : 'MUT', kind);
  c.name = def.name;
  c.hpMax = PART_MAX.map((v) => Math.round(v * def.hp));
  c.hp = c.hpMax.slice();
  const lv = def.level * sim.rng.range(0.85, 1.15);
  for (const k of SKILL_IDS) c.sk[k] = lv;
  c.sk.atletismo = 30;
  c.sk.percepcion = 40;
  c.sk.sigilo = 30;
  c.stance = 'agresivo';
  c.ai.mode = 'fiera';
  return c;
}

// --- Inventario -----------------------------------------------------------------

export function addItem(c: { inv: Stack[] }, id: string, n: number, extra?: Partial<Stack>): void {
  const def = ITEMS[id];
  if (!def || n <= 0) return;
  if (def.stack > 1 && !extra?.hot) {
    for (const s of c.inv) {
      if (s.id === id && !s.hot && s.n < def.stack) {
        const k = Math.min(n, def.stack - s.n);
        s.n += k;
        n -= k;
        if (n <= 0) return;
      }
    }
  }
  while (n > 0) {
    const k = Math.min(n, def.stack);
    c.inv.push({ id, n: k, ...extra });
    n -= k;
  }
}

export function countItem(c: { inv: Stack[] }, id: string): number {
  let n = 0;
  for (const s of c.inv) if (s.id === id) n += s.n;
  return n;
}

export function takeItem(c: { inv: Stack[] }, id: string, n: number): number {
  let taken = 0;
  for (let i = c.inv.length - 1; i >= 0 && taken < n; i--) {
    const s = c.inv[i];
    if (s.id !== id) continue;
    const k = Math.min(s.n, n - taken);
    s.n -= k;
    taken += k;
    if (s.n <= 0) c.inv.splice(i, 1);
  }
  return taken;
}

export function invWeight(c: Char): number {
  let w = 0;
  for (const s of c.inv) w += (ITEMS[s.id]?.w ?? 0) * s.n;
  for (const k of Object.keys(c.eq) as EquipSlot[]) {
    const s = c.eq[k];
    if (s) w += ITEMS[s.id]?.w ?? 0;
  }
  return w;
}

export function maxCarry(c: Char): number {
  let cap = 22 + c.sk.fuerza * 0.55;
  const bag = c.eq.mochila;
  if (bag) cap += ITEMS[bag.id]?.armor?.carry ?? 0;
  return cap;
}

/** Sobrecarga: 0 sin problema, 1 = al doble del límite. */
export function encumbrance(c: Char): number {
  const cap = maxCarry(c);
  return Math.max(0, invWeight(c) / cap - 1);
}

export function weaponDef(c: Char): WeaponDef | null {
  const s = c.eq.arma;
  return s ? (ITEMS[s.id]?.weapon ?? null) : null;
}

export function weaponItem(c: Char): ItemDef | null {
  const s = c.eq.arma;
  return s ? (ITEMS[s.id] ?? null) : null;
}

/** Equipa un objeto del inventario (devuelve el anterior al inventario). */
export function equip(c: Char, index: number, slot?: EquipSlot): boolean {
  const s = c.inv[index];
  if (!s) return false;
  const def = ITEMS[s.id];
  if (!def) return false;
  let target: EquipSlot | null = slot ?? null;
  if (!target) {
    if (def.armor) target = def.armor.slot;
    else if (def.weapon) target = 'arma';
    else if (def.light) target = 'luz';
  }
  if (!target) return false;
  if ((target === 'arma' || target === 'arma2') && !def.weapon) return false;
  if (target === 'luz' && !def.light) return false;
  if (def.armor && target !== def.armor.slot) return false;
  const one: Stack = { ...s, n: 1 };
  s.n -= 1;
  if (s.n <= 0) c.inv.splice(index, 1);
  const old = c.eq[target];
  c.eq[target] = one;
  if (old) addItem(c, old.id, 1, stackState(old));
  return true;
}

export function unequip(c: Char, slot: EquipSlot): void {
  const old = c.eq[slot];
  if (!old) return;
  delete c.eq[slot];
  addItem(c, old.id, 1, stackState(old));
}

/** Resistencia de la armadura en una parte del cuerpo frente a un tipo de daño. */
export function armorAt(c: Char, part: number, kind: 'cut' | 'blunt' | 'pierce'): number {
  let pass = 1;
  for (const slot of ['cabeza', 'cara', 'torso', 'mochila'] as ArmorSlot[]) {
    const s = c.eq[slot];
    if (!s) continue;
    const a = ITEMS[s.id]?.armor;
    if (a && a.cover.includes(part)) pass *= 1 - a[kind];
  }
  if (c.kind !== 'humano') pass *= 0.85;
  return 1 - pass;
}

export function hasFilter(c: Char): boolean {
  const s = c.eq.cara;
  return !!(s && ITEMS[s.id]?.armor?.filter);
}

/** Estorbo del equipo puesto (0 = nada, tope 0,5): resta sigilo y esquiva. */
export function armorBulk(c: Char): number {
  let b = 0;
  for (const slot of ['cabeza', 'cara', 'torso', 'mochila'] as ArmorSlot[]) {
    const s = c.eq[slot];
    if (s) b += ITEMS[s.id]?.armor?.bulk ?? 0;
  }
  return Math.min(0.5, b);
}

/** Cuánto pesa el estorbo: el sigilo y la esquiva pierden el doble del estorbo. */
export const BULK_WEIGHT = 2;

/**
 * Factor por el que se multiplica la distancia a la que ven a alguien que
 * avanza en sigilo: `base` es el de una persona sin pericia ni estorbo.
 */
export function sneakMult(c: Char, base: number): number {
  return Math.max(0.15, (base - c.sk.sigilo * 0.004) * (1 + armorBulk(c) * BULK_WEIGHT));
}

/** Aspecto efectivo: el de base más lo que cambia el equipo puesto. */
export function effectiveLook(c: Char): Look | null {
  if (!c.look) return null;
  let look = c.look;
  for (const slot of ['cabeza', 'cara', 'torso', 'mochila'] as ArmorSlot[]) {
    const s = c.eq[slot];
    const patch = s ? ITEMS[s.id]?.armor?.look : undefined;
    if (patch) look = { ...look, ...patch };
  }
  return look;
}

// --- Experiencia -------------------------------------------------------------------

/** Suma experiencia a una habilidad. `amount` ~1 equivale a una acción normal. */
export function gainXp(sim: Sim, c: Char, skill: SkillId, amount: number): void {
  const v = c.sk[skill];
  if (v >= 100 || amount <= 0) return;
  const lvl = Math.floor(v);
  const nv = Math.min(100, v + amount / xpForLevel(lvl));
  c.sk[skill] = nv;
  if (c.player && Math.floor(nv) > lvl) sim.emit({ t: 'nivel', id: c.id, skill, lvl: Math.floor(nv) });
}

/**
 * Lo que se aprende andando: correr entrena el atletismo, y correr o andar
 * con mucho peso encima (o con alguien a hombros) entrena la fuerza.
 * Solo la escuadra del jugador: la gente del metro ya es como es.
 */
export function trainMove(sim: Sim, c: Char, meters: number): void {
  if (!c.player || c.kind !== 'humano' || meters <= 0) return;
  const load = invWeight(c) / maxCarry(c) + (c.carry ? 0.8 : 0);
  if (c.run && !c.sneak && c.speed > 2.2) gainXp(sim, c, 'atletismo', meters * 0.05 * (0.7 + Math.min(1.6, load)));
  if (load > 0.55) gainXp(sim, c, 'fuerza', meters * 0.02 * Math.min(1.5, load - 0.55));
}

// --- Estado físico -----------------------------------------------------------------

export function isDown(c: Char): boolean {
  return c.st !== 'ok';
}

/** Capacidad de las piernas (1 sano, 0 inútil). */
export function legPower(c: Char): number {
  const l = Math.max(0, c.hp[5] / c.hpMax[5]);
  const r = Math.max(0, c.hp[6] / c.hpMax[6]);
  return Math.min(1, (l + r) / 2 + Math.min(l, r) * 0.5);
}

export function limpSide(c: Char): number {
  const l = c.hp[5] / c.hpMax[5];
  const r = c.hp[6] / c.hpMax[6];
  if (l > 0.55 && r > 0.55) return 0;
  return l < r ? -1 : 1;
}

export function crawling(c: Char): boolean {
  return c.kind === 'humano' && c.hp[5] <= 0 && c.hp[6] <= 0;
}

/** Velocidad máxima actual (m/s). */
export function moveSpeed(c: Char, run: boolean): number {
  if (c.kind !== 'humano') {
    const d = CREATURES[c.kind];
    return d.speed * (run ? 1 : 0.35) * (0.4 + 0.6 * legPower(c));
  }
  if (crawling(c)) return 0.55;
  let v = run ? 3.5 + c.sk.atletismo * 0.032 : 1.45;
  if (c.sneak) v = Math.min(v, (1.5 + c.sk.sigilo * 0.012) * (1 - armorBulk(c)));
  v *= 0.35 + 0.65 * legPower(c);
  v /= 1 + encumbrance(c) * 1.6;
  if (c.carry) v *= 0.72;
  if (c.hunger < 15) v *= 0.8;
  return v;
}

/** Salud global 0..1 (la peor parte vital y la sangre mandan). */
export function healthFrac(c: Char): number {
  const vital = Math.min(c.hp[0] / c.hpMax[0], c.hp[1] / c.hpMax[1], c.hp[2] / c.hpMax[2]);
  return Math.max(0, Math.min(vital, c.blood / 100));
}

export function totalHpFrac(c: Char): number {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 7; i++) {
    a += Math.max(0, c.hp[i]);
    b += c.hpMax[i];
  }
  return a / b;
}
