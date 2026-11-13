// Acciones que la interfaz ejecuta sobre la simulación: mover objetos entre
// inventarios, usar y equipar, recetas, investigación, robos y servicios.

import { BUILDS, RECIPES, TECHS } from '../data/edificios';
import { FILTER_LIFE } from '../data/gases';
import { ITEMS, stackState, type EquipSlot, type Stack } from '../data/items';
import type { FactionId } from '../data/tipos';
import { hasTech, stored, storeWeight } from './build';
import { filterMask, fitFilter } from './gas';
import { addItem, countItem, equip, invWeight, maxCarry, sneakMult, takeItem, unequip } from './chars';
import type { Sim } from './sim';
import type { Building, Char, Container } from './types';

export type Holder = { kind: 'char'; c: Char } | { kind: 'cont'; c: Container } | { kind: 'build'; b: Building };

export function holderItems(h: Holder): Stack[] {
  return h.kind === 'char' ? h.c.inv : h.kind === 'cont' ? h.c.items : h.b.store;
}

/** Mueve `n` unidades de la pila `index` de un poseedor a otro. Devuelve un mensaje de error o null. */
export function transfer(sim: Sim, from: Holder, to: Holder, index: number, n: number, actor: Char): string | null {
  const src = holderItems(from);
  const s = src[index];
  if (!s) return null;
  const def = ITEMS[s.id];
  n = Math.min(n, s.n);
  if (to.kind === 'char') {
    const can = def.w > 0 ? Math.floor((maxCarry(to.c) * 1.8 - invWeight(to.c)) / def.w) : n;
    if (can <= 0) return 'No puede cargar más';
    n = Math.min(n, can);
  } else if (to.kind === 'build') {
    const cap = BUILDS[to.b.def].store ?? 40;
    const can = def.w > 0 ? Math.floor((cap - storeWeight(to.b)) / def.w) : n;
    if (can <= 0) return 'El almacén está lleno';
    n = Math.min(n, can);
  }
  // Robo: coger de un contenedor con dueño o de alguien inconsciente de una facción pacífica
  let hot: string | undefined = s.hot;
  if (to.kind === 'char' && to.c.player) {
    let victimSide: string | null = null;
    let place = '';
    if (from.kind === 'cont' && from.c.owner && from.c.owner !== 'JUG') {
      victimSide = from.c.owner;
      place = from.c.place;
    }
    if (from.kind === 'char' && !from.c.player && from.c.side !== 'MUT' && from.c.kind === 'humano') {
      const rel = sim.state.rep[from.c.side as FactionId];
      if (rel !== undefined && rel > -50 && from.c.st !== 'muerto') {
        victimSide = from.c.side;
        place = from.c.ai.place;
      }
    }
    if (victimSide) {
      hot = place || victimSide;
      // ¿Alguien lo ve?
      let seen = false;
      sim.forNear(actor.x, actor.z, 14, (o) => {
        if (seen || o.player || o.st !== 'ok' || o.side !== victimSide) return;
        const dark = actor.lit < 0.25 ? 0.5 : 1;
        const sneak = actor.sneak ? sneakMult(actor, 0.55) : 1;
        if (Math.hypot(o.x - actor.x, o.z - actor.z) < 14 * dark * sneak && sim.world.nav.sightLine(o.x, o.z, actor.x, actor.z) > 0.97) seen = true;
      });
      if (seen) {
        sim.log('¡Te han visto robar!', 'malo');
        const witness = from.kind === 'char' ? from.c : null;
        if (witness) sim.crime(witness, 25);
        else {
          sim.rep(victimSide as FactionId, -8, 'robo');
          sim.state.bounty[victimSide as FactionId] = Math.min(400, (sim.state.bounty[victimSide as FactionId] ?? 0) + 60);
          const st = sim.state.stations[place];
          if (st) st.alert = 300;
        }
      }
    }
  }
  s.n -= n;
  if (s.n <= 0) src.splice(index, 1);
  addItem({ inv: holderItems(to) }, s.id, n, { ...stackState(s), hot });
  sim.emit({ t: 'sonido', k: 'coger', x: actor.x, z: actor.z });
  return null;
}

/** Usa un objeto del inventario: comer, curarse o equipar. */
export function useItem(sim: Sim, c: Char, index: number): string | null {
  const s = c.inv[index];
  if (!s) return null;
  const def = ITEMS[s.id];
  if (def.food) {
    c.hunger = Math.min(100, c.hunger + def.food);
    s.n--;
    if (s.n <= 0) c.inv.splice(index, 1);
    sim.emit({ t: 'sonido', k: 'comer', x: c.x, z: c.z });
    return null;
  }
  if (def.med) {
    c.order = { t: 'curar', id: c.id };
    return null;
  }
  if (s.id === 'filtros') {
    // Cambia el filtro de la máscara puesta por uno nuevo
    const mask = filterMask(c);
    if (!mask) return 'Hace falta llevar puesta una máscara';
    if ((mask.fil ?? 0) >= FILTER_LIFE * 0.98) return 'El filtro puesto está nuevo';
    fitFilter(sim, c, mask);
    return null;
  }
  if (def.weapon || def.armor || def.light) {
    equip(c, index);
    if (def.light) c.lamp = true;
    sim.emit({ t: 'sonido', k: 'equipar', x: c.x, z: c.z });
    return null;
  }
  return 'No se puede usar';
}

export function unequipSlot(sim: Sim, c: Char, slot: EquipSlot) {
  unequip(c, slot);
  if (slot === 'luz') c.lamp = false;
  sim.emit({ t: 'sonido', k: 'equipar', x: c.x, z: c.z });
}

/** ¿Tiene luz propia? (linterna equipada o en el inventario) */
export function hasLamp(c: Char): boolean {
  return !!c.eq.luz || c.inv.some((s) => ITEMS[s.id]?.light);
}

export function dropItem(sim: Sim, c: Char, index: number, n: number) {
  const s = c.inv[index];
  if (!s) return;
  n = Math.min(n, s.n);
  s.n -= n;
  if (s.n <= 0) c.inv.splice(index, 1);
  // Se apila en un saco cercano si lo hay
  let d = sim.state.drops.find((q) => Math.hypot(q.x - c.x, q.z - c.z) < 1.2);
  if (!d) {
    d = { id: sim.state.nextId++, x: c.x + Math.cos(c.face) * 0.6, z: c.z + Math.sin(c.face) * 0.6, items: [], t: 3600 };
    sim.state.drops.push(d);
  }
  addItem({ inv: d.items }, s.id, n, stackState(s));
  d.t = 3600;
  sim.emit({ t: 'sonido', k: 'soltar', x: c.x, z: c.z });
}

// --- Talleres e investigación ---------------------------------------------------

export function setRecipe(sim: Sim, b: Building, recipe: string | null, count: number, loop: boolean) {
  if (recipe && !RECIPES[recipe]) return;
  if (b.recipe !== recipe) b.craft = 0;
  b.recipe = recipe;
  b.count = count;
  b.loop = loop;
  sim.emit({ t: 'obra', id: b.id, k: 'cambio' });
}

export function recipeAvailable(sim: Sim, id: string): boolean {
  return hasTech(sim, RECIPES[id]?.tech);
}

/** Cantidad total de un objeto en la base y en los inventarios de la escuadra. */
export function owned(sim: Sim, id: string): number {
  let n = stored(sim, id);
  for (const p of sim.players) n += countItem(p, id);
  return n;
}

export function techState(sim: Sim, id: string): 'hecha' | 'en curso' | 'disponible' | 'bloqueada' {
  const t = sim.state.tech;
  if (t.done.includes(id)) return 'hecha';
  if (t.cur === id) return 'en curso';
  const def = TECHS[id];
  if ((def.req ?? []).every((r) => t.done.includes(r))) return 'disponible';
  return 'bloqueada';
}

export function startResearch(sim: Sim, id: string): string | null {
  const def = TECHS[id];
  if (!def) return 'Desconocida';
  if (techState(sim, id) !== 'disponible') return 'No disponible';
  if (!sim.state.buildings.some((b) => b.prog >= 1 && BUILDS[b.def].research)) return 'Necesitas una mesa de estudio';
  for (const [item, n] of def.needs ?? []) if (owned(sim, item) < n) return `Faltan ${n} × ${ITEMS[item].name}`;
  for (const [item, n] of def.needs ?? []) {
    let left = n;
    for (const b of sim.state.buildings) if (left > 0 && b.prog >= 1) left -= takeItem({ inv: b.store }, item, left);
    for (const p of sim.players) if (left > 0) left -= takeItem(p, item, left);
  }
  sim.state.tech.cur = id;
  sim.state.tech.prog = 0;
  sim.log(`Empieza la investigación: ${def.name}.`, 'info');
  return null;
}

// --- Servicios -----------------------------------------------------------------------

/** Un médico cura a toda la escuadra presente a cambio de cartuchos. */
export function healCost(sim: Sim, around: Char): number {
  let cost = 0;
  sim.forNear(around.x, around.z, 25, (o) => {
    if (!o.player || o.st === 'muerto') return;
    for (let i = 0; i < 7; i++) cost += Math.max(0, o.hpMax[i] - o.hp[i]) * 0.35 + o.wound[i] * 0.5;
  });
  return Math.ceil(cost);
}

export function payHeal(sim: Sim, around: Char): string | null {
  const cost = healCost(sim, around);
  if (cost <= 0) return 'Nadie necesita cura';
  if (cost > sim.state.money) return 'No tienes cartuchos suficientes';
  sim.state.money -= cost;
  sim.forNear(around.x, around.z, 25, (o) => {
    if (!o.player || o.st === 'muerto') return;
    for (let i = 0; i < 7; i++) {
      o.hp[i] = o.hpMax[i];
      o.wound[i] = 0;
    }
    o.blood = Math.max(o.blood, 85);
    if (o.st === 'ko') o.koT = 0;
  });
  sim.log(`Los médicos atienden a tu gente (${cost} cartuchos).`, 'bueno');
  return null;
}
