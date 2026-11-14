// Personajes: creación, estadísticas derivadas, inventario, equipo y experiencia.

import { CREATURES } from '../data/criaturas';
import { FILTER_LIFE } from '../data/gases';
import { makeLoadout, makeLook, type Role } from '../data/gente';
import { ARMOR_SLOTS, ITEMS, Q_POWER, Q_WEAR, condFactor, condOf, hasQuality, itemPower, qualityOf, stackState, type EquipSlot, type ItemDef, type Stack, type WeaponDef } from '../data/items';
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

/**
 * Crea una persona de un arquetipo, con aspecto, equipo y pericia coherentes.
 * `people` es la gente de la que viene (su aspecto y su nombre), si no es la de
 * su bando: los vecinos de una estación conquistada siguen siendo quienes eran
 * aunque cambie la bandera.
 */
export function makeHuman(sim: Sim, side: SideId, role: Role, x: number, z: number, seed?: number, people: SideId = side): Char {
  const rng = seed !== undefined ? new Rng(seed) : sim.rng;
  const c = newChar(sim, x, z, side);
  c.role = role;
  c.look = makeLook(rng, people, role);
  c.name = randomName(rng, c.look.female, people === 'CAL' ? 'califato' : people === 'VHL' ? 'bandido' : 'ruso');
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
  // Calidad y uso del equipo: los saqueadores van con lo que han podido rapiñar
  const base = (ROLE_QUALITY[role] ?? 1) - (side === 'VHL' ? 0.4 : 0) + (side === 'NOR' && role === 'elite' ? 1 : 0);
  gradeStacks(rng, Object.values(c.eq), base, 0.5);
  gradeStacks(rng, c.inv, base, 0.5);
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

/** Calidad al azar alrededor de `base` (0 chatarra … 4 militar). */
export function rollQuality(rng: Rng, base: number): number {
  const r = rng.next();
  const q = Math.round(base) + (r < 0.22 ? -1 : r > 0.86 ? 1 : 0);
  return Math.max(0, Math.min(4, q));
}

/**
 * Da calidad (alrededor de `base`) y, con `worn`, algo de desgaste a las
 * armas, armaduras y prótesis de una lista que aún no los tengan.
 */
export function gradeStacks(rng: Rng, list: Iterable<Stack | undefined>, base: number, worn = 0): void {
  for (const s of list) {
    if (!s || !hasQuality(ITEMS[s.id])) continue;
    if (s.q === undefined) s.q = rollQuality(rng, base);
    if (worn > 0 && s.dur === undefined) s.dur = Math.round((1 - rng.next() * worn) * 100) / 100;
  }
}

/** Calidad del equipo de cada oficio: un refugiado lleva chatarra; la tropa de choque, material bueno. */
const ROLE_QUALITY: Partial<Record<Role, number>> = { refugiado: 0, civil: 1, obrero: 1, bandido: 1, caravanero: 1, comerciante: 2, guardia: 2, soldado: 2, cazador: 2, stalker: 2, medico: 2, mercenario: 2, jefe: 2, oficial: 3, elite: 3, lider: 3 };

/** Lo que pide alguien por unirse a la escuadra, según lo que sabe hacer. */
export function hirePrice(c: Char): number {
  const power = c.sk.ataque + c.sk.punteria + c.sk.medicina * 0.5 + c.sk.ingenieria * 0.5;
  return Math.round((40 + power * 3.2) / 10) * 10;
}

/** Largo máximo de un nombre. */
export const NAME_MAX = 24;

// --- Inventario -----------------------------------------------------------------

export function addItem(c: { inv: Stack[] }, id: string, n: number, extra?: Partial<Stack>): void {
  const def = ITEMS[id];
  if (!def || n <= 0) return;
  if (def.stack > 1 && !extra?.hot) {
    for (const s of c.inv) {
      if (s.id === id && !s.hot && s.n < def.stack) {
        const k = Math.min(n, def.stack - s.n);
        // La comida que se junta queda con la frescura media
        if (def.spoil && (s.fresh !== undefined || extra?.fresh !== undefined)) s.fresh = ((s.fresh ?? 1) * s.n + (extra?.fresh ?? 1) * k) / (s.n + k);
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
  if (target === 'arma' && wieldProblem(c, def)) return false;
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

/** Resistencia de la armadura en una parte del cuerpo frente a un tipo de daño (según su calidad y su estado). */
export function armorAt(c: Char, part: number, kind: 'cut' | 'blunt' | 'pierce'): number {
  let pass = 1;
  for (const slot of ARMOR_SLOTS) {
    const s = c.eq[slot];
    if (!s) continue;
    const a = ITEMS[s.id]?.armor;
    if (a && a.cover.includes(part)) pass *= 1 - Math.min(0.85, a[kind] * itemPower(s));
  }
  if (c.kind !== 'humano') pass *= 0.85;
  return 1 - pass;
}

/** Piezas de armadura que cubren una parte del cuerpo (las que se gastan al parar un golpe ahí). */
export function armorOn(c: Char, part: number): Stack[] {
  const out: Stack[] = [];
  for (const slot of ARMOR_SLOTS) {
    const s = c.eq[slot];
    if (s && ITEMS[s.id]?.armor?.cover.includes(part)) out.push(s);
  }
  return out;
}

export function hasFilter(c: Char): boolean {
  const s = c.eq.cara;
  return !!(s && ITEMS[s.id]?.armor?.filter);
}

/** Estorbo del equipo puesto (0 = nada, tope 0,5): resta sigilo y esquiva. */
export function armorBulk(c: Char): number {
  let b = 0;
  for (const slot of ARMOR_SLOTS) {
    const s = c.eq[slot];
    if (s) b += ITEMS[s.id]?.armor?.bulk ?? 0;
  }
  return Math.min(0.5, b);
}

/** Suma de una ventaja del equipo puesto (botas que corren, guantes que agarran…), según su estado. */
export function gearBonus(c: Char, key: 'speed' | 'quiet' | 'work' | 'grip'): number {
  let v = 0;
  for (const slot of ARMOR_SLOTS) {
    const s = c.eq[slot];
    const x = s ? ITEMS[s.id]?.armor?.[key] : undefined;
    if (x) v += x * (x > 0 ? condFactor(condOf(s!)) : 1);
  }
  return v;
}

/** Cuánto pesa el estorbo: el sigilo y la esquiva pierden el doble del estorbo. */
export const BULK_WEIGHT = 2;

/**
 * Factor por el que se multiplica la distancia a la que ven a alguien que
 * avanza en sigilo: `base` es el de una persona sin pericia ni estorbo.
 */
export function sneakMult(c: Char, base: number): number {
  return Math.max(0.15, (base - c.sk.sigilo * 0.004) * (1 + armorBulk(c) * BULK_WEIGHT) * (1 - Math.min(0.5, gearBonus(c, 'quiet')) * 0.5));
}

/** Aspecto efectivo: el de base más lo que cambia el equipo puesto y lo que le falta (o le sobra) del cuerpo. */
export function effectiveLook(c: Char): Look | null {
  if (!c.look) return null;
  let look = c.look;
  for (const slot of ARMOR_SLOTS) {
    const s = c.eq[slot];
    const patch = s ? ITEMS[s.id]?.armor?.look : undefined;
    if (patch) look = { ...look, ...patch };
  }
  const lost = limbMask(c, false);
  const pros = limbMask(c, true);
  if (lost || pros) look = { ...look, lost, pros };
  return look;
}

/**
 * Desgasta un objeto por el uso (`amount` ≈ fracción de vida para uno de taller).
 * Avisa a la escuadra cuando una pieza suya está a punto de romperse o se rompe.
 */
export function wear(sim: Sim, c: Char | null, s: Stack, amount: number): void {
  const def = ITEMS[s.id];
  if (!hasQuality(def) || amount <= 0) return;
  const before = condOf(s);
  if (before <= 0) return;
  const after = Math.max(0, before - amount * Q_WEAR[qualityOf(s)]);
  s.dur = after;
  if (c?.player) {
    if (after <= 0) sim.log(`${def.name} de ${c.name}: se ha roto. Hay que repararlo en un banco de trabajo.`, 'malo');
    else if (before >= 0.25 && after < 0.25) sim.emit({ t: 'flota', x: c.x, z: c.z, text: `${def.name}: a punto de romperse`, color: '#d8a060' });
  }
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

// --- Miembros perdidos, prótesis y secuelas -------------------------------------------

/** Nombre de cada miembro que se puede perder (partes 3 a 6), con su artículo. */
export const LIMB_NAMES: Record<number, string> = { 3: 'el brazo izquierdo', 4: 'el brazo derecho', 5: 'la pierna izquierda', 6: 'la pierna derecha' };
/** Lo que rinde una prótesis «de taller» nueva frente al miembro de carne. */
export const PROS_BASE = { brazo: 0.72, pierna: 0.8 };
/** Bit de cada miembro en las máscaras del aspecto (brazo izq., brazo der., pierna izq., pierna der.). */
const LIMB_BIT: Record<number, number> = { 3: 1, 4: 2, 5: 4, 6: 8 };

export function isLost(c: Char, part: number): boolean {
  return !!c.lost && c.lost.includes(part);
}

/** Prótesis puesta en un miembro perdido. */
export function prosOf(c: Char, part: number): Stack | undefined {
  return c.pros?.[part];
}

/** Partes de carne: las que sangran y se curan solas (no los muñones ni las prótesis). */
export function isFlesh(c: Char, part: number): boolean {
  return !isLost(c, part);
}

/**
 * Lo que funciona una parte del cuerpo (0..1): la de carne según su salud; una
 * prótesis según su calidad (y nada si está rota); un miembro perdido sin
 * prótesis, nada.
 */
export function partWork(c: Char, part: number): number {
  if (isLost(c, part)) {
    const p = prosOf(c, part);
    if (!p || c.hp[part] <= 0) return 0;
    return Math.min(1, (part >= 5 ? PROS_BASE.pierna : PROS_BASE.brazo) * Q_POWER[qualityOf(p)]);
  }
  return Math.max(0, c.hp[part] / c.hpMax[part]);
}

/** Máscara de miembros perdidos (o, con `prosthetic`, de los que llevan prótesis) para el aspecto. */
export function limbMask(c: Char, prosthetic: boolean): number {
  let m = 0;
  for (const p of c.lost ?? []) if (!!prosOf(c, p) === prosthetic) m |= LIMB_BIT[p] ?? 0;
  return m;
}

/** Iguala la integridad de una prótesis puesta (salud de la parte) con su estado de conservación. */
export function syncPros(c: Char, part: number): void {
  const p = prosOf(c, part);
  if (p) c.hp[part] = c.hpMax[part] * condOf(p);
}

/** ¿Puede empuñar esta arma con los brazos que le quedan? Devuelve el motivo si no. */
export function wieldProblem(c: Char, def: ItemDef | undefined): string | null {
  if (!def?.weapon || c.kind !== 'humano') return null;
  if (partWork(c, 4) <= 0 && isLost(c, 4)) return prosOf(c, 4) ? 'La prótesis del brazo derecho está rota' : 'Le falta el brazo derecho: necesita una prótesis para empuñar un arma';
  const two = def.weapon.hold === 'dos' || def.weapon.hold === 'fusil';
  if (two && isLost(c, 3) && partWork(c, 3) <= 0) return 'Con un solo brazo no puede usar armas de dos manos';
  return null;
}

/**
 * Pierde un miembro: el muñón sangra a chorros hasta que se vende, y lo que
 * empuñaba esa mano cae al suelo.
 */
export function loseLimb(sim: Sim, c: Char, part: number, cause = ''): void {
  if (part < 3 || part > 6 || isLost(c, part)) return;
  c.lost = [...(c.lost ?? []), part];
  c.hp[part] = 0;
  c.wound[part] = Math.max(c.wound[part], 26);
  if (c.limp === part) delete c.limp;
  // Lo que ya no puede sujetar
  const w = c.eq.arma;
  if (w && wieldProblem(c, ITEMS[w.id])) {
    delete c.eq.arma;
    const p = sim.world.nav.nearestPassable(c.x + 0.5, c.z + 0.3, 2, true) ?? { x: c.x, z: c.z };
    sim.state.drops.push({ id: sim.state.nextId++, x: p.x, z: p.z, items: [{ ...w }], t: 3600 });
  }
  sim.emit({ t: 'mundo', k: 'miembro', id: c.id, a: part });
  if (c.player) sim.log(`${c.name} ha perdido ${LIMB_NAMES[part]}${cause ? ' ' + cause : ''}. Sin vendarle el muñón, se desangra.`, 'malo');
}

/** Pone una prótesis del inventario en el miembro que le falte. Devuelve el motivo si no se puede. */
export function fitProsthesis(sim: Sim, c: Char, index: number): string | null {
  const s = c.inv[index];
  const def = s ? ITEMS[s.id] : undefined;
  if (!s || !def?.pros) return 'Eso no es una prótesis';
  const parts = def.pros === 'brazo' ? [4, 3] : [5, 6];
  const part = parts.find((p) => isLost(c, p) && !prosOf(c, p));
  if (part === undefined) return def.pros === 'brazo' ? 'No le falta ningún brazo' : 'No le falta ninguna pierna';
  if (c.wound[part] > 0.8) return 'Antes hay que vendarle el muñón';
  c.inv.splice(index, 1);
  c.pros = { ...(c.pros ?? {}), [part]: { ...s, n: 1 } };
  syncPros(c, part);
  sim.emit({ t: 'mundo', k: 'miembro', id: c.id, a: part });
  sim.emit({ t: 'sonido', k: 'equipar', x: c.x, z: c.z });
  sim.log(`${c.name} se ajusta ${def.name.toLowerCase()} en ${LIMB_NAMES[part].replace(/^el |^la /, 'el muñón de ')}.`, 'bueno');
  return null;
}

/**
 * Rapidez de las manos en obras y talleres (1 = normal): los brazos heridos,
 * perdidos o de acero trabajan más despacio; los guantes de trabajo ayudan.
 */
export function handFactor(c: Char): number {
  const arms = (partWork(c, 3) + partWork(c, 4)) / 2;
  return Math.max(0.3, 0.35 + 0.65 * arms) * Math.max(0.5, 1 + gearBonus(c, 'work'));
}

/** Capacidad de las piernas (1 sano, 0 inútil). */
export function legPower(c: Char): number {
  const l = partWork(c, 5);
  const r = partWork(c, 6);
  return Math.min(1, (l + r) / 2 + Math.min(l, r) * 0.5);
}

/** Lado del que cojea (-1 izquierda, 1 derecha, 0 nada): heridas, prótesis y cojera crónica. */
export function limpSide(c: Char): number {
  if (c.kind !== 'humano') {
    const l = c.hp[5] / c.hpMax[5];
    const r = c.hp[6] / c.hpMax[6];
    if (l > 0.55 && r > 0.55) return 0;
    return l < r ? -1 : 1;
  }
  const l = partWork(c, 5) * (c.limp === 5 ? 0.5 : 1);
  const r = partWork(c, 6) * (c.limp === 6 ? 0.5 : 1);
  if (l > 0.55 && r > 0.55 && !isLost(c, 5) && !isLost(c, 6)) return 0;
  if (Math.abs(l - r) < 0.02 && !isLost(c, 5) && !isLost(c, 6)) return 0;
  return l < r || (isLost(c, 5) && !isLost(c, 6)) ? -1 : 1;
}

/** Va a gatas: sin piernas que le sostengan (o con una perdida y sin prótesis). */
export function crawling(c: Char): boolean {
  if (c.kind !== 'humano') return false;
  if ((isLost(c, 5) && partWork(c, 5) <= 0) || (isLost(c, 6) && partWork(c, 6) <= 0)) return true;
  return c.hp[5] <= 0 && c.hp[6] <= 0;
}

/** Velocidad máxima actual (m/s). */
export function moveSpeed(c: Char, run: boolean): number {
  if (c.kind !== 'humano') {
    const d = CREATURES[c.kind];
    // Arrastrando a alguien, despacio
    return d.speed * (run ? 1 : 0.35) * (0.4 + 0.6 * legPower(c)) * (c.carry ? 0.4 : 1);
  }
  if (crawling(c)) return 0.55;
  let v = run ? (3.5 + c.sk.atletismo * 0.032) * (1 + gearBonus(c, 'speed')) : 1.45;
  if (c.sneak) v = Math.min(v, (1.5 + c.sk.sigilo * 0.012) * (1 - armorBulk(c)));
  v *= 0.35 + 0.65 * legPower(c);
  // La pierna ortopédica y la cojera crónica no dejan correr igual
  for (const p of [5, 6]) if (isLost(c, p)) v *= run ? 0.82 : 0.92;
  if (c.limp) v *= run ? 0.88 : 0.95;
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

/** Salud de todo el cuerpo (0..1). Un miembro perdido cuenta como sano: no hay nada que curar. */
export function totalHpFrac(c: Char): number {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 7; i++) {
    if (isLost(c, i)) continue;
    a += Math.max(0, c.hp[i]);
    b += c.hpMax[i];
  }
  return b > 0 ? a / b : 0;
}
