// Construcción y producción: colocar obras, aportar materiales, levantar
// edificios, talleres con recetas, cultivos, energía, investigación y los
// trabajos automáticos de la escuadra.

import { BUILDS, RECIPES, REPAIR_RECIPE, TECHS, type BuildDef } from '../data/edificios';
import { ITEMS, QUALITY_NAMES, condOf, hasQuality, repairMaterial, type Stack } from '../data/items';
import { F_DYN, F_GATE, F_SLOW, F_TALL } from '../world/grid';
import { makeLight, type LightDef } from '../world/lights';
import { addItem, countItem, gainXp, handFactor, invWeight, isFlesh, maxCarry, syncPros, takeItem } from './chars';
import { fire, hostile } from './combat';
import { breathable } from './gas';
import { clearDest, faceTo, setDest } from './move';
import type { Sim } from './sim';
import type { Building, Char, Order } from './types';
import { stationAt } from './world';

const LIGHTS = new WeakMap<Sim, Map<number, LightDef>>();

function lightMap(sim: Sim) {
  let m = LIGHTS.get(sim);
  if (!m) LIGHTS.set(sim, (m = new Map()));
  return m;
}

/** Segundos de escucha (con ciencia 0) hasta captar la señal. */
export const RADIO_TIME = 420;
const RADIO_STATIC: [number, string][] = [
  [0.2, 'La emisora solo devuelve estática. Arriba, la antena cruje con el viento de la superficie.'],
  [0.5, 'Entre el ruido, un pitido que se repite: algo emite ahí fuera, muy lejos.'],
  [0.8, 'La onda corta trae fragmentos: números, una palabra en ruso, otra vez números. Hay alguien.'],
];

export function hasTech(sim: Sim, id?: string): boolean {
  return !id || sim.state.tech.done.includes(id);
}

export function building(sim: Sim, id: number): Building | null {
  return sim.state.buildings.find((b) => b.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// Colocación
// ---------------------------------------------------------------------------

/** Devuelve null si se puede construir ahí, o el motivo por el que no. */
export function canPlace(sim: Sim, defId: string, x: number, z: number, rot: number): string | null {
  const def = BUILDS[defId];
  if (!def) return 'Desconocido';
  if (!hasTech(sim, def.tech)) return 'Falta investigar: ' + (TECHS[def.tech!]?.name ?? def.tech);
  const nav = sim.world.nav;
  if (!nav.rectFree(x, z, def.hx + 0.1, def.hz + 0.1, -rot, 3)) return 'El sitio no está despejado';
  const f = stationAt(sim.world, x, z, 4);
  if (f) {
    const owner = sim.state.stations[f.id]?.owner;
    if (owner && owner !== 'JUG') return `Esto es ${f.def.shortName}: aquí manda otra gente`;
  }
  if (sim.playerDist(x, z) > 45) return 'Demasiado lejos de tu gente';
  return null;
}

function stamp(sim: Sim, b: Building, on: boolean) {
  const def = BUILDS[b.def];
  if (def.flat) return;
  const nav = sim.world.nav;
  const flags = def.gate ? F_GATE | F_TALL : def.slow ? F_SLOW : F_DYN | (def.tall ? F_TALL : 0);
  if (on) nav.stampRect(b.x, b.z, def.hx, def.hz, -b.rot, flags);
  else nav.stampRect(b.x, b.z, def.hx, def.hz, -b.rot, 0, flags);
  nav.computeNear();
}

function setLight(sim: Sim, b: Building, on: boolean) {
  const def = BUILDS[b.def];
  if (!def.light) return;
  const m = lightMap(sim);
  const cur = m.get(b.id);
  if (on && !cur) {
    const L = def.light;
    const l = makeLight(b.x, sim.world.nav.heightAt(b.x, b.z) + L.y, b.z, L.color, L.intensity, L.radius, L.kind ?? 'lamp', L.flicker ?? 0);
    l.owner = b.id;
    sim.world.field.add(l);
    m.set(b.id, l);
    sim.emit({ t: 'obra', id: b.id, k: 'cambio' });
  } else if (!on && cur) {
    sim.world.field.remove(cur);
    m.delete(b.id);
    sim.emit({ t: 'obra', id: b.id, k: 'cambio' });
  }
}

export function buildingLight(sim: Sim, id: number): LightDef | null {
  return lightMap(sim).get(id) ?? null;
}

export function placeBuilding(sim: Sim, defId: string, x: number, z: number, rot: number, finished = false): Building {
  const def = BUILDS[defId];
  const b: Building = {
    id: sim.state.nextId++,
    def: defId,
    x,
    z,
    rot,
    hp: def.hp,
    prog: finished ? 1 : 0,
    got: [],
    store: [],
    recipe: null,
    craft: 0,
    on: true,
    grow: 0,
    fuel: 0,
    side: 'JUG',
    user: 0,
    loop: false,
    count: 0,
  };
  sim.state.buildings.push(b);
  stamp(sim, b, true);
  if (finished) setLight(sim, b, powered(sim, b));
  sim.emit({ t: 'obra', id: b.id, k: 'nueva' });
  return b;
}

export function removeBuilding(sim: Sim, b: Building, refund: number) {
  const def = BUILDS[b.def];
  const i = sim.state.buildings.indexOf(b);
  if (i < 0) return;
  sim.state.buildings.splice(i, 1);
  stamp(sim, b, false);
  setLight(sim, b, false);
  // Devuelve parte de los materiales y todo lo almacenado
  const items: Stack[] = b.store.map((s) => ({ ...s }));
  const src = b.prog >= 1 ? def.cost.map(([id, n]) => ({ id, n })) : b.got;
  for (const s of src) {
    const n = Math.floor(s.n * refund);
    if (n > 0) items.push({ id: s.id, n });
  }
  if (items.length) sim.state.drops.push({ id: sim.state.nextId++, x: b.x, z: b.z, items, t: 2400 });
  for (const c of sim.state.chars) {
    c.jobs = c.jobs.filter((j) => j.id !== b.id);
    if (c.order?.id === b.id && (c.order.t === 'construir' || c.order.t === 'operar' || c.order.t === 'descansar' || c.order.t === 'derribar')) c.order = null;
    if (c.ai.sub === 'cama' && c.ai.n === b.id) c.ai.sub = '';
  }
  sim.emit({ t: 'obra', id: b.id, k: 'fuera' });
}

/** Tras cargar una partida: vuelve a marcar huellas y luces. */
export function restoreBuildings(sim: Sim) {
  for (const b of sim.state.buildings) {
    stamp(sim, b, true);
    if (b.prog >= 1) setLight(sim, b, powered(sim, b));
  }
}

// ---------------------------------------------------------------------------
// Almacenes
// ---------------------------------------------------------------------------

export function storeWeight(b: Building): number {
  let w = 0;
  for (const s of b.store) w += (ITEMS[s.id]?.w ?? 0) * s.n;
  return w;
}

function isStorage(b: Building): boolean {
  const def = BUILDS[b.def];
  return b.prog >= 1 && !!def.store && !def.recipes && !def.power && !def.turret;
}

/** Total de un objeto en los almacenes de la base (sin contar la munición de los nidos). */
export function stored(sim: Sim, id: string): number {
  let n = 0;
  for (const b of sim.state.buildings) if (b.prog >= 1 && BUILDS[b.def].store && !BUILDS[b.def].turret) n += countItem({ inv: b.store }, id);
  return n;
}

function nearestStorageWith(sim: Sim, x: number, z: number, ids: string[], maxD = 90): Building | null {
  let best: Building | null = null;
  let bestD = maxD;
  for (const b of sim.state.buildings) {
    if (b.prog < 1 || !BUILDS[b.def].store || BUILDS[b.def].turret) continue;
    if (!b.store.some((s) => ids.includes(s.id))) continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function nearestStorageFree(sim: Sim, x: number, z: number, maxD = 90): Building | null {
  let best: Building | null = null;
  let bestD = maxD;
  for (const b of sim.state.buildings) {
    if (!isStorage(b)) continue;
    if (storeWeight(b) >= BUILDS[b.def].store! - 1) continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

function reach(b: Building): number {
  const def = BUILDS[b.def];
  return Math.max(def.hx, def.hz) + 1.3;
}

/** Punto de uso delante del edificio. */
export function usePoint(sim: Sim, b: Building): { x: number; z: number } {
  const def = BUILDS[b.def];
  const d = def.hz + 0.6;
  const x = b.x + Math.sin(b.rot) * d;
  const z = b.z + Math.cos(b.rot) * d;
  return sim.world.nav.nearestPassable(x, z, 2.5, true) ?? { x, z };
}

function near(c: Char, b: Building, extra = 0): boolean {
  return Math.hypot(b.x - c.x, b.z - c.z) <= reach(b) + extra;
}

function goTo(sim: Sim, c: Char, b: Building) {
  const p = usePoint(sim, b);
  setDest(c, p.x, p.z, 0.6, true);
}

/**
 * Consigue que `needs` estén en `dest` (lista de pilas del edificio). El
 * trabajador aporta lo que lleva y, si falta, va a buscarlo a un almacén.
 * Devuelve 'listo', 'en camino' o 'falta'.
 */
function supply(sim: Sim, c: Char, b: Building, needs: [string, number][], dest: Stack[]): 'listo' | 'camino' | 'falta' {
  const missing: [string, number][] = [];
  for (const [id, n] of needs) {
    const have = countItem({ inv: dest }, id);
    if (have < n) missing.push([id, n - have]);
  }
  if (!missing.length) return 'listo';
  // ¿Lleva algo de lo que falta?
  const carrying = missing.some(([id]) => countItem(c, id) > 0);
  if (carrying) {
    if (!near(c, b)) {
      goTo(sim, c, b);
      return 'camino';
    }
    for (const [id, n] of missing) {
      const k = takeItem(c, id, n);
      if (k > 0) addItem({ inv: dest }, id, k);
    }
    sim.emit({ t: 'sonido', k: 'soltar', x: b.x, z: b.z });
    return 'camino';
  }
  const src = nearestStorageWith(
    sim,
    c.x,
    c.z,
    missing.map((m) => m[0]),
  );
  if (!src || src === b) return 'falta';
  if (!near(c, src)) {
    goTo(sim, c, src);
    return 'camino';
  }
  const cap = maxCarry(c) * 1.25;
  for (const [id, n] of missing) {
    const w = ITEMS[id]?.w ?? 0.1;
    const can = Math.max(0, Math.floor((cap - invWeight(c)) / w));
    const k = takeItem({ inv: src.store }, id, Math.min(n, can));
    if (k > 0) addItem(c, id, k);
  }
  sim.emit({ t: 'sonido', k: 'coger', x: src.x, z: src.z });
  return 'camino';
}

// ---------------------------------------------------------------------------
// Trabajo en edificios
// ---------------------------------------------------------------------------

export function powerState(sim: Sim): { gen: number; use: number; ok: boolean } {
  let gen = 0;
  let use = 0;
  for (const b of sim.state.buildings) {
    if (b.prog < 1 || !b.on) continue;
    const p = BUILDS[b.def].power ?? 0;
    if (p < 0) {
      if (b.fuel > 0) gen += -p;
    } else use += p;
  }
  return { gen, use, ok: gen >= use };
}

export function powered(sim: Sim, b: Building): boolean {
  const p = BUILDS[b.def].power ?? 0;
  if (p <= 0) return true;
  return b.on && powerState(sim).ok;
}

function speedBonus(sim: Sim): number {
  return hasTech(sim, 'herramientas') ? 1.25 : 1;
}

/** Ejecuta una orden sobre un edificio. Devuelve false cuando termina. */
export function workOnBuilding(sim: Sim, c: Char, o: Order, dt: number): boolean {
  const b = building(sim, o.id!);
  if (!b) return false;
  const def = BUILDS[b.def];
  if (o.t === 'derribar') {
    if (!near(c, b)) {
      goTo(sim, c, b);
      return true;
    }
    faceTo(c, b.x, b.z, dt);
    c.work = 'martillo';
    c.workT += dt;
    if (c.workT > 4) {
      c.workT = 0;
      removeBuilding(sim, b, 0.5);
      return false;
    }
    return true;
  }
  if (o.t === 'reparar') return repairBuilding(sim, c, b, o, dt);
  if (o.t === 'construir') {
    if (b.prog >= 1) return false;
    const s = supply(sim, c, b, def.cost, b.got);
    if (s === 'falta') {
      if ((sim.tick + c.id) % 90 === 0) sim.emit({ t: 'flota', x: b.x, z: b.z, text: 'Faltan materiales', color: '#d8a060' });
      // Sigue con lo que haya si ya hay algo aportado
      return o.data !== 'job';
    }
    if (s === 'camino') return true;
    if (!near(c, b)) {
      goTo(sim, c, b);
      return true;
    }
    clearDest(c);
    faceTo(c, b.x, b.z, dt);
    c.work = 'martillo';
    b.prog += (dt * (0.55 + c.sk.ingenieria * 0.03) * speedBonus(sim) * handFactor(c)) / def.work;
    gainXp(sim, c, 'ingenieria', dt * 0.35);
    if ((sim.tick + c.id) % 24 === 0) sim.emit({ t: 'sonido', k: 'martillo', x: b.x, z: b.z });
    if (b.prog >= 1) {
      b.prog = 1;
      b.got = [];
      sim.state.stats.built++;
      setLight(sim, b, powered(sim, b));
      sim.emit({ t: 'obra', id: b.id, k: 'lista' });
      sim.log(`${def.name}: obra terminada.`, 'bueno');
      return false;
    }
    return true;
  }
  if (b.prog < 1) return false;
  if (o.t === 'descansar') {
    if (!def.beds) return false;
    if (Math.hypot(b.x - c.x, b.z - c.z) > 1.0) {
      setDest(c, b.x, b.z, 0.7, true);
      // Las camas con huella no son transitables: se acerca y se tumba
      if (near(c, b, -0.3)) {
        clearDest(c);
        c.x = b.x;
        c.z = b.z;
      }
      return true;
    }
    c.pose = 'tumbado';
    c.face = -b.rot;
    c.speed = 0;
    // Las buenas camas curan más
    const k = (def.heal ?? 1) - 1;
    if (k > 0) for (let i = 0; i < 7; i++) if (c.hp[i] < c.hpMax[i] && c.wound[i] < 1.5 && isFlesh(c, i)) c.hp[i] = Math.min(c.hpMax[i], c.hp[i] + dt * 0.035 * 5 * k);
    if (o.data === 'job') {
      let hurt = false;
      for (let i = 0; i < 7; i++) if (c.hp[i] < c.hpMax[i] * 0.95 && isFlesh(c, i)) hurt = true;
      return hurt;
    }
    return true;
  }
  // --- Operar ---------------------------------------------------------------
  if (def.power && def.power > 0 && !powered(sim, b)) {
    if ((sim.tick + c.id) % 120 === 0) sim.emit({ t: 'flota', x: b.x, z: b.z, text: 'Sin energía', color: '#d8a060' });
    return false;
  }
  if (def.turret) return manTurret(sim, c, b, def, dt);
  if (def.repair && b.recipe === REPAIR_RECIPE) return repairAtBench(sim, c, b, def, dt);
  if (def.research) {
    const tech = sim.state.tech;
    if (!tech.cur) return false;
    if (!near(c, b)) {
      goTo(sim, c, b);
      return true;
    }
    clearDest(c);
    faceTo(c, b.x, b.z, dt);
    c.work = 'escribir';
    tech.prog += dt * (1 + c.sk.ciencia * 0.04) * speedBonus(sim);
    gainXp(sim, c, 'ciencia', dt * 0.3);
    const t = TECHS[tech.cur];
    if (t && tech.prog >= t.cost) {
      tech.done.push(tech.cur);
      sim.log(`Investigación completada: ${t.name}.`, 'bueno');
      sim.emit({ t: 'mundo', k: 'tecnologia' });
      tech.cur = null;
      tech.prog = 0;
      return false;
    }
    return true;
  }
  if (def.radio) {
    // Barrer las frecuencias noche tras noche, hasta que alguien conteste
    if (sim.state.flags.senal) return false;
    if (!near(c, b)) {
      goTo(sim, c, b);
      return true;
    }
    clearDest(c);
    faceTo(c, b.x, b.z, dt);
    c.work = 'operar';
    const before = b.craft;
    b.craft = Math.min(1, b.craft + (dt * (0.6 + c.sk.ciencia * 0.02)) / RADIO_TIME);
    gainXp(sim, c, 'ciencia', dt * 0.25);
    for (const [at, text] of RADIO_STATIC) {
      if (before < at && b.craft >= at) sim.log(text, 'info');
    }
    if ((sim.tick + c.id) % 240 === 0) sim.emit({ t: 'flota', x: b.x, z: b.z, text: '…estática…', color: '#9fb8d8' });
    return true;
  }
  if (def.farm) {
    // Atender el cultivo acelera el ciclo; cosechar lo vacía
    if (!near(c, b)) {
      goTo(sim, c, b);
      return true;
    }
    clearDest(c);
    faceTo(c, b.x, b.z, dt);
    c.pose = 'cuclillas';
    c.work = 'rebuscar';
    if (b.grow >= 1) {
      c.workT += dt;
      if (c.workT > 3) {
        c.workT = 0;
        b.grow = 0;
        const bonus = (hasTech(sim, 'hongos2') ? 1.5 : 1) * (0.8 + c.sk.cultivo * 0.008);
        for (const [id, n] of def.farm.out) addItem({ inv: b.store }, id, Math.max(1, Math.round(n * bonus)));
        gainXp(sim, c, 'cultivo', 4);
        sim.emit({ t: 'flota', x: b.x, z: b.z, text: 'Cosecha', color: '#9fd08a' });
      }
      return true;
    }
    if (b.fuel <= 0) return false; // sin agua: nada que hacer
    b.grow += (dt * (0.5 + c.sk.cultivo * 0.01)) / def.farm.time;
    gainXp(sim, c, 'cultivo', dt * 0.2);
    return b.grow < 1 || true;
  }
  if (def.recipes) {
    const r = b.recipe ? RECIPES[b.recipe] : null;
    if (!r || (!b.loop && b.count <= 0)) return false;
    const s = supply(sim, c, b, r.in, b.store);
    if (s === 'falta') {
      if ((sim.tick + c.id) % 120 === 0) sim.emit({ t: 'flota', x: b.x, z: b.z, text: 'Faltan materiales', color: '#d8a060' });
      return false;
    }
    if (s === 'camino') return true;
    if (!near(c, b)) {
      goTo(sim, c, b);
      return true;
    }
    clearDest(c);
    faceTo(c, b.x, b.z, dt);
    c.work = def.anim ?? 'operar';
    const sk = def.skill ?? 'ingenieria';
    b.craft += (dt * (0.6 + c.sk[sk] * 0.025) * speedBonus(sim) * handFactor(c)) / r.time;
    gainXp(sim, c, sk, dt * 0.3);
    if (b.craft >= 1) {
      b.craft = 0;
      for (const [id, n] of r.in) takeItem({ inv: b.store }, id, n);
      const out = ITEMS[r.out[0]];
      // Armas, armaduras y prótesis salen mejores o peores según la mano de quien las hace
      const q = hasQuality(out) ? craftQuality(sim, c.sk[sk]) : undefined;
      addItem({ inv: b.store }, r.out[0], r.out[1], q !== undefined ? { q } : undefined);
      if (!b.loop) b.count--;
      sim.emit({ t: 'flota', x: b.x, z: b.z, text: `+${r.out[1]} ${out.name}${q !== undefined ? ` (${QUALITY_NAMES[q].toLowerCase()})` : ''}`, color: '#e8d08a' });
      sim.emit({ t: 'sonido', k: 'hecho', x: b.x, z: b.z });
    }
    return true;
  }
  return false;
}

/**
 * Calidad de lo que sale de un taller según la pericia de quien lo hace: un
 * novato saca chatarra o algo casero; un maestro, piezas buenas. Lo militar
 * solo sale con las técnicas de la carabina y mucha mano.
 */
export function craftQuality(sim: Sim, skill: number): number {
  const roll = skill + sim.rng.range(-12, 12);
  let q = roll < 8 ? 0 : roll < 24 ? 1 : roll < 48 ? 2 : 3;
  if (q === 3 && skill >= 65 && hasTech(sim, 'armas2') && sim.rng.chance((skill - 60) / 60)) q = 4;
  return q;
}

// ---------------------------------------------------------------------------
// Daños y reparaciones de las obras
// ---------------------------------------------------------------------------

/** Daña una obra; si se viene abajo, queda en escombros (y algo de material). */
export function damageBuilding(sim: Sim, b: Building, amount: number, by?: Char | null): void {
  if (amount <= 0 || !sim.state.buildings.includes(b)) return;
  b.hp -= amount;
  if ((sim.tick + b.id) % 8 === 0) sim.emit({ t: 'sonido', k: 'golpe', x: b.x, z: b.z });
  if (b.hp > 0) return;
  const def = BUILDS[b.def];
  sim.log(`${by && by.kind === 'humano' ? 'Los asaltantes han echado abajo' : 'Se ha venido abajo'}: ${def.name.toLowerCase()}.`, 'malo');
  removeBuilding(sim, b, 0.2);
}

/** Material que hace falta para reparar una obra (el principal de los que costó). */
export function buildingRepairMaterial(def: BuildDef): string {
  let best = def.cost[0][0];
  let bn = 0;
  for (const [id, n] of def.cost) if (n > bn && id !== 'componentes') {
    best = id;
    bn = n;
  }
  return best;
}

/** Cada unidad de material devuelve una cuarta parte de la estructura. */
const FIX_PER_UNIT = 0.25;

function repairBuilding(sim: Sim, c: Char, b: Building, o: Order, dt: number): boolean {
  const def = BUILDS[b.def];
  if (b.prog < 1 || b.hp >= def.hp) return false;
  const mat = buildingRepairMaterial(def);
  if (countItem({ inv: b.got }, mat) < 1) {
    const s = supply(sim, c, b, [[mat, 1]], b.got);
    if (s === 'falta') {
      if (o.data !== 'job' && (sim.tick + c.id) % 90 === 0) sim.emit({ t: 'flota', x: b.x, z: b.z, text: `Falta ${ITEMS[mat].name.toLowerCase()} para repararlo`, color: '#d8a060' });
      return false;
    }
    return true;
  }
  if (!near(c, b)) {
    goTo(sim, c, b);
    return true;
  }
  clearDest(c);
  faceTo(c, b.x, b.z, dt);
  c.work = 'martillo';
  const before = b.hp;
  b.hp = Math.min(def.hp, b.hp + (dt * (0.6 + c.sk.ingenieria * 0.03) * speedBonus(sim) * handFactor(c) * def.hp * FIX_PER_UNIT) / Math.max(8, def.work * 0.3));
  gainXp(sim, c, 'ingenieria', dt * 0.3);
  if ((sim.tick + c.id) % 24 === 0) sim.emit({ t: 'sonido', k: 'martillo', x: b.x, z: b.z });
  // Se gasta una unidad por cada cuarto de estructura
  const units = Math.floor((b.hp - 0.001) / (def.hp * FIX_PER_UNIT)) - Math.floor((before - 0.001) / (def.hp * FIX_PER_UNIT));
  if (units > 0) takeItem({ inv: b.got }, mat, units);
  if (b.hp >= def.hp) {
    b.got = [];
    sim.emit({ t: 'flota', x: b.x, z: b.z, text: 'Reparado', color: '#9fd08a' });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Reparar armas, armaduras y prótesis en un banco
// ---------------------------------------------------------------------------

export interface RepairJob {
  s: Stack;
  /** Quien lo lleva (puesto, en la mochila o como prótesis), o null si está en un almacén. */
  owner: Char | null;
  /** Parte del cuerpo si es una prótesis puesta. */
  part?: number;
}

/** A qué distancia del banco tiene que estar la gente para que le arreglen lo suyo. */
export const REPAIR_RANGE = 22;

/** Lo que hay que reparar cerca de un banco, lo más estropeado primero. */
export function repairQueue(sim: Sim, b: Building): RepairJob[] {
  const out: RepairJob[] = [];
  const consider = (s: Stack, owner: Char | null, part?: number) => {
    if (hasQuality(ITEMS[s.id]) && condOf(s) < 0.97) out.push({ s, owner, part });
  };
  for (const o of sim.state.buildings) {
    if (o.prog < 1 || !BUILDS[o.def].store || Math.hypot(o.x - b.x, o.z - b.z) > 40) continue;
    for (const s of o.store) consider(s, null);
  }
  sim.forNear(b.x, b.z, REPAIR_RANGE, (p) => {
    if (!p.player || p.st === 'muerto' || p.captive) return;
    for (const s of Object.values(p.eq)) if (s) consider(s, p);
    for (const s of p.inv) consider(s, p);
    for (const [k, s] of Object.entries(p.pros ?? {})) consider(s, p, Number(k));
  });
  return out.sort((a, b2) => condOf(a.s) - condOf(b2.s));
}

/** Hasta dónde deja algo como nuevo quien lo repara: un novato no lo deja como salió del taller. */
export function repairCap(skill: number): number {
  return Math.min(1, 0.72 + skill * 0.006);
}

function repairAtBench(sim: Sim, c: Char, b: Building, def: BuildDef, dt: number): boolean {
  const cap = repairCap(c.sk.armeria);
  const job = repairQueue(sim, b).find((j) => condOf(j.s) < cap - 0.02);
  if (!job) return false;
  const mat = repairMaterial(ITEMS[job.s.id]);
  const s = supply(sim, c, b, [[mat, 1]], b.store);
  if (s === 'falta') {
    if ((sim.tick + c.id) % 120 === 0) sim.emit({ t: 'flota', x: b.x, z: b.z, text: `Falta ${ITEMS[mat].name.toLowerCase()} para reparar`, color: '#d8a060' });
    return false;
  }
  if (s === 'camino') return true;
  if (!near(c, b)) {
    goTo(sim, c, b);
    return true;
  }
  clearDest(c);
  faceTo(c, b.x, b.z, dt);
  c.work = def.anim ?? 'martillo';
  b.craft += (dt * (0.6 + c.sk.armeria * 0.025) * speedBonus(sim) * handFactor(c)) / 22;
  gainXp(sim, c, 'armeria', dt * 0.25);
  if (b.craft >= 1) {
    b.craft = 0;
    takeItem({ inv: b.store }, mat, 1);
    job.s.dur = Math.min(cap, condOf(job.s) + 0.34);
    if (job.owner && job.part !== undefined) syncPros(job.owner, job.part);
    sim.emit({ t: 'flota', x: b.x, z: b.z, text: `Reparado: ${ITEMS[job.s.id].name}`, color: '#9fd08a' });
    sim.emit({ t: 'sonido', k: 'hecho', x: b.x, z: b.z });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Nidos de ametralladora
// ---------------------------------------------------------------------------

/** Dónde se pone quien sirve el arma: detrás del anillo de sacos. */
export function turretSeat(sim: Sim, b: Building): { x: number; z: number } {
  const d = BUILDS[b.def].hz + 0.35;
  const x = b.x - Math.sin(b.rot) * d;
  const z = b.z - Math.cos(b.rot) * d;
  return sim.world.nav.nearestPassable(x, z, 2.5, true) ?? { x, z };
}

/** ¿Está sirviendo un nido de ametralladora? (no se distrae con enemigos lejanos) */
export function manningTurret(sim: Sim, c: Char): Building | null {
  const o = c.order;
  if (!o || o.t !== 'operar' || !o.id) return null;
  const b = building(sim, o.id);
  return b && BUILDS[b.def].turret ? b : null;
}

/** Munición que le queda a un nido (su almacén más lo que lleva quien lo sirve). */
export function turretAmmo(b: Building, op?: Char | null): number {
  return countItem({ inv: b.store }, 'balas') + (op ? countItem(op, 'balas') : 0);
}

function manTurret(sim: Sim, c: Char, b: Building, def: BuildDef, dt: number): boolean {
  const T = def.turret!;
  // Sin balas en el nido, quien lo sirve va a por munición al almacén
  if (countItem({ inv: b.store }, 'balas') < 40 && countItem(c, 'balas') < 40 && stored(sim, 'balas') > 0) {
    const s = supply(sim, c, b, [['balas', 150]], b.store);
    if (s === 'camino') return true;
  }
  const seat = turretSeat(sim, b);
  if (Math.hypot(seat.x - c.x, seat.z - c.z) > 0.8) {
    setDest(c, seat.x, seat.z, 0.5, true);
    return true;
  }
  clearDest(c);
  c.pose = 'cuclillas';
  c.work = 'operar';
  // Busca blanco: el enemigo más cercano a la vista, dentro del arco de tiro
  const dirA = Math.atan2(Math.cos(b.rot), Math.sin(b.rot));
  let best: Char | null = null;
  let bd = T.range;
  sim.forNear(b.x, b.z, T.range, (o) => {
    if (o.st !== 'ok' || o.carriedBy || !hostile(sim, c, o)) return;
    const d = Math.hypot(o.x - b.x, o.z - b.z);
    if (d >= bd) return;
    const a = Math.atan2(o.z - b.z, o.x - b.x) - dirA;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) > T.arc / 2) return;
    if (sim.world.nav.sightLine(b.x, b.z, o.x, o.z) < 0.97) return;
    best = o;
    bd = d;
  });
  b.craft -= dt;
  const t = best as Char | null;
  if (!t) {
    faceTo(c, b.x, b.z, dt);
    return true;
  }
  faceTo(c, t.x, t.z, dt, 6);
  if (b.craft > 0) return true;
  const got = takeItem({ inv: b.store }, 'balas', 1) || takeItem(c, 'balas', 1);
  if (!got) {
    b.craft = 2;
    sim.emit({ t: 'flota', x: b.x, z: b.z, text: 'Sin munición', color: '#d8a060' });
    return true;
  }
  b.craft = T.rof * (1 + sim.rng.next() * 0.2);
  c.sinceFire = 0;
  fire(sim, c, t, bd, { ammo: 'balas', range: T.range, spread: T.spread, rof: T.rof, mag: 100, reload: 0, noise: T.noise }, T.pierce, 1, { x: b.x, z: b.z, w: 'ametralladora' });
  return true;
}


// ---------------------------------------------------------------------------
// Edificios que funcionan solos
// ---------------------------------------------------------------------------

export function stepBuildings(sim: Sim, dt: number) {
  const list = sim.state.buildings;
  if (!list.length) return;
  const pw = powerState(sim);
  for (const b of list) {
    if (b.prog < 1) continue;
    const def = BUILDS[b.def];
    // Generador: quema combustible
    if (def.power && def.power < 0 && b.on) {
      if (b.fuel > 0) b.fuel -= dt;
      if (b.fuel <= 0) {
        let got = takeItem({ inv: b.store }, 'combustible', 1);
        if (!got) {
          const src = nearestStorageWith(sim, b.x, b.z, ['combustible'], 60);
          if (src) got = takeItem({ inv: src.store }, 'combustible', 1);
        }
        if (got) b.fuel = 300;
        else if (b.fuel > -1) {
          b.fuel = -2;
          sim.log('El generador se ha quedado sin combustible.', 'malo');
        }
      }
    }
    if (def.light) setLight(sim, b, def.power && def.power > 0 ? b.on && pw.ok : b.on);
    if (def.passive) {
      b.grow += (dt * (hasTech(sim, 'agua') ? 2 : 1)) / def.passive.time;
      if (b.grow >= 1 && storeWeight(b) < (def.store ?? 20)) {
        b.grow = 0;
        addItem({ inv: b.store }, def.passive.out[0], def.passive.out[1]);
      }
    }
    if (def.farm) {
      if (def.power && def.power > 0 && !pw.ok) continue;
      // Riega (o da de comer) al empezar cada ciclo; si no hay lo de siempre, lo alternativo (los cerdos comen podrido)
      if (b.fuel <= 0 && b.grow < 1) {
        const has = (list: [string, number][]) => list.every(([id, n]) => stored(sim, id) + countItem({ inv: b.store }, id) >= n);
        let needs = def.farm.needs ?? [];
        let ok = has(needs);
        if (!ok && def.farm.alt && has(def.farm.alt)) {
          needs = def.farm.alt;
          ok = true;
        }
        if (ok) {
          for (const [id, n] of needs) {
            let left = n - takeItem({ inv: b.store }, id, n);
            for (const s of list) {
              if (left <= 0) break;
              if (s.prog >= 1 && BUILDS[s.def].store && s !== b) left -= takeItem({ inv: s.store }, id, left);
            }
          }
          b.fuel = 1;
        }
      }
      if (b.fuel > 0 && b.grow < 1) {
        b.grow += (dt * 0.5) / def.farm.time;
        if (b.grow >= 1) {
          b.grow = 1;
          b.fuel = 0;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Trabajos automáticos
// ---------------------------------------------------------------------------

function hasWork(sim: Sim, b: Building): boolean {
  const def = BUILDS[b.def];
  if (b.prog < 1) return false;
  if (def.power && def.power > 0 && !powered(sim, b)) return false;
  if (def.research) return !!sim.state.tech.cur;
  if (def.radio) return !sim.state.flags.senal;
  if (def.farm) return b.grow >= 1 || b.fuel > 0;
  // Un nido de ametralladora siempre tiene trabajo: estar alerta
  if (def.turret) return true;
  if (def.repair && b.recipe === REPAIR_RECIPE) return repairQueue(sim, b).length > 0;
  if (def.recipes) {
    const r = b.recipe ? RECIPES[b.recipe] : null;
    if (!r || (!b.loop && b.count <= 0)) return false;
    // ¿Hay materiales en algún sitio?
    for (const [id, n] of r.in) if (countItem({ inv: b.store }, id) + stored(sim, id) < n) return false;
    return true;
  }
  return false;
}

/** Productos que sobran en un taller o cultivo (lo que no es entrada de su receta). */
function outputsOf(b: Building): Stack[] {
  const def = BUILDS[b.def];
  if (def.store && !def.recipes && !def.farm && !def.passive) return [];
  const r = b.recipe ? RECIPES[b.recipe] : null;
  const keep = new Set((r?.in ?? []).map((i) => i[0]));
  if (def.power && def.power < 0) keep.add('combustible');
  // En un banco de reparación se guardan los materiales para arreglar; en un nido, la munición
  if (b.recipe === REPAIR_RECIPE) for (const id of ['piezas', 'tela', 'cuero', 'tablones', 'acero']) keep.add(id);
  if (def.turret) keep.add('balas');
  return b.store.filter((s) => !keep.has(s.id));
}

/** Busca algo que hacer según la lista de trabajos. Devuelve true si se ocupa. */
export function stepJobs(sim: Sim, c: Char, dt: number): boolean {
  if (!c.jobs.length || c.order) return false;
  if ((sim.tick + c.id * 7) % 15 !== 0) return false;
  void dt;
  // Nadie va a trabajar a una bolsa de gas sin una máscara que le proteja
  let gassed = false;
  const safe = (x: number, z: number) => {
    if (breathable(sim, c, x, z)) return true;
    gassed = true;
    return false;
  };
  const busy = pickJob(sim, c, safe);
  if (!busy && gassed && (sim.tick + c.id) % 900 < 15) sim.emit({ t: 'flota', x: c.x, z: c.z, text: 'Ahí hay gas: me hace falta una máscara', color: '#d8a060' });
  return busy;
}

function pickJob(sim: Sim, c: Char, safe: (x: number, z: number) => boolean): boolean {
  // Si va cargado de materiales de un trabajo anterior, los deja en el almacén
  for (const j of c.jobs) {
    if (j.t === 'construir') {
      let best: Building | null = null;
      let bd = 120;
      for (const b of sim.state.buildings) {
        if (b.prog >= 1 || !safe(b.x, b.z)) continue;
        const d = Math.hypot(b.x - c.x, b.z - c.z);
        if (d < bd) {
          bd = d;
          best = b;
        }
      }
      if (best) {
        c.order = { t: 'construir', id: best.id, data: 'job' };
        return true;
      }
      // Sin obras pendientes, repara lo que esté dañado
      let worst: Building | null = null;
      let wf = 0.8;
      for (const b of sim.state.buildings) {
        if (b.prog < 1 || !safe(b.x, b.z) || Math.hypot(b.x - c.x, b.z - c.z) > 120) continue;
        const f = b.hp / BUILDS[b.def].hp;
        if (f < wf && countItem({ inv: b.got }, buildingRepairMaterial(BUILDS[b.def])) + stored(sim, buildingRepairMaterial(BUILDS[b.def])) > 0) {
          wf = f;
          worst = b;
        }
      }
      if (worst) {
        c.order = { t: 'reparar', id: worst.id, data: 'job' };
        return true;
      }
    } else if (j.t === 'guardia') {
      // Servir un nido de ametralladora
      const b = j.id ? building(sim, j.id) : null;
      if (b && b.prog >= 1 && safe(b.x, b.z)) {
        c.order = { t: 'operar', id: b.id, data: 'job' };
        return true;
      }
    } else if (j.t === 'operar' || j.t === 'cultivar' || j.t === 'cocinar' || j.t === 'investigar') {
      const b = j.id ? building(sim, j.id) : null;
      if (b && !safe(b.x, b.z)) continue;
      if (b && hasWork(sim, b)) {
        c.order = { t: 'operar', id: b.id, data: 'job' };
        return true;
      }
      // Sin faena: lleva lo producido al almacén
      if (b && haul(sim, c, b)) return true;
    } else if (j.t === 'acarrear') {
      for (const b of sim.state.buildings) {
        if (b.prog >= 1 && haul(sim, c, b)) return true;
      }
      if (unload(sim, c)) return true;
    } else if (j.t === 'chatarrear') {
      const n = j.id ? sim.node(j.id) : null;
      if (n && n.amount > 0 && safe(n.x, n.z)) {
        if (invWeight(c) > maxCarry(c) * 0.95) {
          if (unload(sim, c)) return true;
        } else {
          c.order = { t: 'chatarrear', id: n.id, data: 'job' };
          return true;
        }
      }
    } else if (j.t === 'medico') {
      // La cura automática ya la lleva la conducta de fondo
    }
  }
  return false;
}

/** Lleva los productos de un edificio al almacén más cercano. */
function haul(sim: Sim, c: Char, b: Building): boolean {
  const out = outputsOf(b);
  if (!out.length) return false;
  const dst = nearestStorageFree(sim, b.x, b.z);
  if (!dst || dst === b) return false;
  if (!near(c, b)) {
    goTo(sim, c, b);
    c.ai.sub = '';
    return true;
  }
  const cap = maxCarry(c) * 1.2;
  for (const s of out) {
    const w = ITEMS[s.id]?.w ?? 0.1;
    const can = Math.max(0, Math.floor((cap - invWeight(c)) / w));
    const k = takeItem({ inv: b.store }, s.id, Math.min(s.n, can));
    if (k > 0) addItem(c, s.id, k, { hot: 'acarreo' });
  }
  return unload(sim, c);
}

/** Deja en el almacén lo que lleva marcado como acarreo (o los recursos sobrantes). */
function unload(sim: Sim, c: Char): boolean {
  const cargo = c.inv.filter((s) => s.hot === 'acarreo' || (ITEMS[s.id]?.kind === 'recurso' && c.jobs.some((j) => j.t === 'chatarrear' || j.t === 'acarrear')));
  if (!cargo.length) return false;
  const dst = nearestStorageFree(sim, c.x, c.z);
  if (!dst) return false;
  if (!near(c, dst)) {
    goTo(sim, c, dst);
    return true;
  }
  for (const s of cargo) {
    const i = c.inv.indexOf(s);
    if (i >= 0) c.inv.splice(i, 1);
    addItem({ inv: dst.store }, s.id, s.n);
  }
  sim.emit({ t: 'sonido', k: 'soltar', x: dst.x, z: dst.z });
  return false;
}

export type { BuildDef };
