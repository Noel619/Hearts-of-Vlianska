// El juego en marcha: une la simulación con el render, la cámara, la entrada
// del jugador (selección, órdenes, construcción) y la interfaz.

import * as THREE from 'three';
import { CREATURES } from '../data/criaturas';
import { BUILDS } from '../data/edificios';
import { ITEMS } from '../data/items';
import { SKILLS } from '../data/skills';
import { CameraRig } from '../render/camera';
import { Gfx, type Quality } from '../render/gfx';
import { initMaterialGlobals, globals } from '../render/materials';
import { buildPropsView } from '../render/propsView';
import { buildTextures, type TextureSet } from '../render/textures';
import { buildGasMesh } from '../render/gasMesh';
import { buildWaterMesh } from '../render/waterMesh';
import { buildWorldMesh } from '../render/worldMesh';
import { buildSurfaceMesh } from '../render/surfaceMesh';
import { Sky } from '../render/sky';
import { building, buildingLight, canPlace, placeBuilding, restoreBuildings } from '../sim/build';
import { applyNodes, isCivilDefense } from '../sim/events';
import { totalHpFrac } from '../sim/chars';
import { hostile, needsCare } from '../sim/combat';
import { newGame, type NewGameOptions } from '../sim/newGame';
import { Sim } from '../sim/sim';
import type { Char, JobType, Order, SimState } from '../sim/types';
import { buildWorld, placeName, resetWorld, type World } from '../sim/world';
import type { GasPocket } from '../world/gas';
import { Fx, type DynLight, type SpotReq } from './fx';
import { actionFor, keyFor } from './keys';
import { CharViews, ThingViews } from './views';

export type Target =
  | { kind: 'char'; id: number; x: number; z: number }
  | { kind: 'build'; id: number; x: number; z: number }
  | { kind: 'cont'; id: number; x: number; z: number }
  | { kind: 'drop'; id: number; x: number; z: number }
  | { kind: 'node'; id: number; x: number; z: number }
  | { kind: 'ground'; x: number; z: number };

export interface MenuAction {
  label: string;
  hint?: string;
  run: () => void;
  danger?: boolean;
}

export interface ContextMenu {
  x: number;
  y: number;
  title: string;
  actions: MenuAction[];
}

export type Panel =
  | { t: 'hablar'; npc: number; actor: number }
  | { t: 'comercio'; npc: number; actor: number }
  | { t: 'saqueo'; actor: number; target: Target }
  | { t: 'peaje'; npc: number }
  | { t: 'taller'; id: number }
  | { t: 'despedir'; id: number }
  | null;

/** Recursos compartidos entre partidas: mundo, texturas y mallas estáticas. */
export interface Shared {
  world: World;
  tex: TextureSet;
  worldGroup: THREE.Group;
  propsGroup: THREE.Group;
  /** La superficie: edificios, suelo nevado y su atrezo. */
  surfaceGroup: THREE.Group;
  propsSurfaceGroup: THREE.Group;
}

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmp = new THREE.Vector3();

export class Game {
  readonly gfx: Gfx;
  readonly rig: CameraRig;
  readonly sky: Sky;
  sim!: Sim;
  views!: CharViews;
  things!: ThingViews;
  fx!: Fx;
  // --- Estado para la interfaz
  selected: number[] = [];
  inspect = 0;
  /** La emisora ha captado la señal: toca mostrar el epílogo. */
  epilogue = false;
  hover: Target | null = null;
  menu: ContextMenu | null = null;
  panel: Panel = null;
  buildDef: string | null = null;
  buildRot = 0;
  buildWhy: string | null = null;
  speed = 1;
  paused = false;
  version = 0;
  placeLabel = '';
  /** Bolsa de gas bajo la cámara (o null). */
  gasHere: GasPocket | null = null;
  fps = 0;
  running = false;
  /** Rectángulo de selección en curso (píxeles de pantalla). */
  box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private listeners = new Set<() => void>();
  private keys = new Set<string>();
  private raf = 0;
  private last = 0;
  private uiAcc = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private drag: { x: number; y: number; button: number; moved: boolean } | null = null;
  private buildPos = { x: 0, z: 0 };
  private groups: Record<string, number[]> = {};
  private lightSig = '';
  private disposers: (() => void)[] = [];
  onSound: ((k: string, x: number, z: number, v?: number) => void) | null = null;

  private constructor(
    readonly canvas: HTMLCanvasElement,
    readonly shared: Shared,
    quality: Quality,
  ) {
    this.gfx = new Gfx(canvas, { quality });
    this.rig = new CameraRig(this.gfx.camera);
    this.gfx.scene.add(shared.worldGroup);
    this.gfx.scene.add(shared.propsGroup);
    this.gfx.scene.add(shared.surfaceGroup);
    this.gfx.scene.add(shared.propsSurfaceGroup);
    this.sky = new Sky(this.gfx, shared.tex, [shared.worldGroup, shared.propsGroup], [shared.surfaceGroup, shared.propsSurfaceGroup]);
    const b = shared.world.layout.bounds;
    this.rig.bounds = { minX: b.minX, minZ: b.minZ, maxX: b.maxX, maxZ: b.maxZ };
    this.bindInput();
  }

  /** Construye el mundo y sus mallas (tarda unos segundos). */
  static async prepare(progress: (label: string, frac: number) => void | Promise<void>): Promise<Shared> {
    const tick = () => new Promise((r) => setTimeout(r, 0));
    await progress('Excavando túneles', 0.02);
    await tick();
    const world = buildWorld();
    await progress('Pintando superficies', 0.2);
    await tick();
    const tex = buildTextures();
    initMaterialGlobals(tex);
    const mesh = await buildWorldMesh(world.layout, world.field, tex, async (label, f) => {
      await progress(label, 0.3 + f * 0.6);
      await tick();
    });
    await progress('Levantando la superficie', 0.92);
    await tick();
    const surface = buildSurfaceMesh(world.layout, world.field, tex);
    await progress('Amueblando estaciones', 0.95);
    await tick();
    const props = buildPropsView(world.decor.props, world.field);
    mesh.group.add(buildWaterMesh(world.nav, world.field, tex));
    mesh.group.add(buildGasMesh(world.gas, world.nav, world.field, tex));
    await progress('Listo', 1);
    return { world, tex, worldGroup: mesh.group, propsGroup: props.group, surfaceGroup: surface.group, propsSurfaceGroup: props.surfaceGroup };
  }

  static create(canvas: HTMLCanvasElement, shared: Shared, quality: Quality): Game {
    return new Game(canvas, shared, quality);
  }

  // --- Partidas ------------------------------------------------------------------

  startNew(opts: NewGameOptions) {
    this.attach(newGame(this.shared.world, opts));
    const p = this.sim.players[0];
    if (p) this.rig.jump(p.x, p.z, 26, 0.6, 0.95);
    this.selected = this.sim.players.map((c) => c.id);
  }

  loadState(state: SimState) {
    resetWorld(this.shared.world);
    const sim = new Sim(this.shared.world, state);
    this.attach(sim, true);
    const p = this.sim.players[0];
    if (p) this.rig.jump(p.x, p.z, 26, 0.6, 0.95);
    this.selected = [];
  }

  private attach(sim: Sim, loaded = false) {
    this.views?.dispose();
    this.things?.dispose();
    this.fx?.dispose();
    this.sim = sim;
    this.epilogue = false;
    if (loaded) {
      // Recoloca derrumbes y obras de la partida guardada
      applyNodes(sim);
      restoreBuildings(sim);
    }
    this.views = new CharViews(sim);
    this.things = new ThingViews(sim);
    this.fx = new Fx(this.gfx.scene, this.shared.tex, this.gfx.quality);
    this.fx.setStaticLights(this.shared.world.decor.lights);
    this.gfx.scene.add(this.views.group);
    this.gfx.scene.add(this.things.group);
    this.panel = null;
    this.menu = null;
    this.buildDef = null;
    this.lightSig = '';
    this.bump();
  }

  // --- Suscripción de la interfaz -------------------------------------------------

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  bump() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  // --- Bucle ---------------------------------------------------------------------------

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.frame();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (!this.sim) return;
    this.cameraKeys(dt);
    if (!this.paused) this.sim.step(dt * this.speed);
    this.drainEvents();
    // La cámara sigue la altura del suelo (las escaleras suben a la superficie)
    {
      const nav = this.shared.world.nav;
      if (!this.rig.follow && nav.isFloor(this.rig.tx, this.rig.tz)) this.rig.ty = nav.heightAt(this.rig.tx, this.rig.tz);
    }
    this.rig.update(dt);
    const f = this.rig.focus;
    this.sky.update(dt, f, this.sim.hour);
    const adt = this.paused ? 0 : dt * Math.min(this.speed, 2);
    this.views.update(adt, f.x, f.z);
    this.things.update(f.x, f.z);
    this.updateFx(dt);
    this.gfx.render(dt);
    this.fpsAcc += dt;
    this.fpsN++;
    this.uiAcc += dt;
    if (this.uiAcc >= 0.16) {
      this.uiAcc = 0;
      this.placeLabel = placeName(this.shared.world, f.x, f.z);
      this.gasHere = this.shared.world.gas.pocketAt(f.x, f.z, 0.08);
      this.selected = this.selected.filter((id) => {
        const c = this.sim.char(id);
        return c && c.player && c.st !== 'muerto';
      });
      this.bump();
    }
    if (this.fpsAcc >= 1) {
      this.fps = this.fpsN / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
  }

  private cameraKeys(dt: number) {
    const k = this.keys;
    // Con Ctrl, Alt o Cmd pulsadas las teclas son atajos (grupos, todos), no cámara
    if (k.has('ControlLeft') || k.has('ControlRight') || k.has('AltLeft') || k.has('AltRight') || k.has('MetaLeft') || k.has('MetaRight')) return;
    const sp = this.rig.dist * 1.1 * dt;
    if (k.has(keyFor('camArriba')) || k.has('ArrowUp')) this.rig.pan(0, sp);
    if (k.has(keyFor('camAbajo')) || k.has('ArrowDown')) this.rig.pan(0, -sp);
    if (k.has(keyFor('camIzq')) || k.has('ArrowLeft')) this.rig.pan(-sp, 0);
    if (k.has(keyFor('camDer')) || k.has('ArrowRight')) this.rig.pan(sp, 0);
    if (!this.buildDef) {
      if (k.has(keyFor('girarIzq'))) this.rig.rotate(dt * 1.6, 0);
      if (k.has(keyFor('girarDer'))) this.rig.rotate(-dt * 1.6, 0);
    }
  }

  private drainEvents() {
    const sim = this.sim;
    const ev = sim.events;
    if (!ev.length) return;
    const nav = sim.world.nav;
    for (const e of ev) {
      switch (e.t) {
        case 'tiro': {
          const y = nav.heightAt(e.x, e.z) + 1.4;
          const c = sim.char(e.id);
          const ox = c ? Math.cos(c.face) * 0.6 : 0;
          const oz = c ? Math.sin(c.face) * 0.6 : 0;
          this.fx.shot(e.x + ox, y, e.z + oz, e.tx, nav.heightAt(e.tx, e.tz) + 1.2, e.tz);
          this.onSound?.(e.w === 'neumatico' ? 'tiroAire' : e.w === 'escopeta' ? 'escopeta' : 'tiro', e.x, e.z);
          break;
        }
        case 'golpe': {
          const t = sim.char(e.target);
          if (!t) break;
          const y = nav.heightAt(t.x, t.z) + (e.part === 0 ? 1.6 : e.part <= 2 ? 1.2 : e.part <= 4 ? 1.1 : 0.5);
          if (e.block) {
            this.fx.sparks(t.x, y, t.z, 6);
            this.onSound?.('parada', t.x, t.z);
          } else {
            this.fx.blood(t.x, y, t.z, e.dmg);
            this.onSound?.(e.kind === 'bala' ? 'impacto' : e.kind === 'corte' ? 'corte' : 'golpe', t.x, t.z);
            const a = sim.char(e.id);
            if ((t.player || a?.player) && e.dmg >= 1) this.fx.text(t.x, y + 0.5, t.z, String(Math.round(e.dmg)), t.player ? '#ff7a6a' : '#f2e2b0');
          }
          break;
        }
        case 'ataque': {
          const c = sim.char(e.id);
          if (!c) break;
          // Las fieras se anuncian; la gente solo corta el aire
          if (c.kind === 'humano') this.onSound?.('silbido', c.x, c.z, 0.5);
          else if (Math.random() < 0.6) this.onSound?.(c.kind === 'rata' ? 'chillido' : c.kind === 'glubinnik' || c.kind === 'sheptun' ? 'rugido' : 'grunido', c.x, c.z);
          break;
        }
        case 'ko':
        case 'muerte': {
          const c = sim.char(e.id);
          if (c) {
            this.fx.dust(c.x, nav.heightAt(c.x, c.z) + 0.2, c.z, 6);
            this.onSound?.('caida', c.x, c.z);
            if (e.t === 'muerte' && c.player) this.onSound?.('muerte', NaN, NaN);
          }
          break;
        }
        case 'flota':
          this.fx.text(e.x, nav.heightAt(e.x, e.z) + 2, e.z, e.text, e.color);
          break;
        case 'sonido':
          this.onSound?.(e.k, e.x, e.z, e.v);
          break;
        case 'nivel': {
          const c = sim.char(e.id);
          if (c) this.fx.text(c.x, nav.heightAt(c.x, c.z) + 2.2, c.z, `${SKILLS[e.skill].name} ${e.lvl}`, '#9fe0a0');
          if (c?.player && e.lvl % 5 === 0) this.onSound?.('nivel', NaN, NaN);
          break;
        }
        case 'obra':
          this.lightSig = '';
          if (e.k === 'lista') this.onSound?.('hecho', NaN, NaN);
          break;
        case 'mundo': {
          if (e.k === 'hablar' && e.id && e.a) {
            this.panel = { t: 'hablar', npc: e.id, actor: e.a };
            this.paused = true;
          } else if (e.k === 'saquear' && e.id && e.a) {
            const t = sim.char(e.id);
            if (t) this.panel = { t: 'saqueo', actor: e.a, target: { kind: 'char', id: e.id, x: t.x, z: t.z } };
          } else if (e.k === 'abrir' && e.id && e.a) {
            const t = sim.container(e.id);
            if (t) this.panel = { t: 'saqueo', actor: e.a, target: { kind: 'cont', id: e.id, x: t.x, z: t.z } };
          } else if (e.k === 'peaje' && e.id) {
            this.panel = { t: 'peaje', npc: e.id };
            this.paused = true;
          } else if (e.k === 'senal') {
            // El final abierto: la partida sigue, pero se cuenta lo que ha pasado
            this.epilogue = true;
            this.paused = true;
          }
          this.bump();
          break;
        }
        case 'aviso':
          this.onSound?.(e.kind === 'malo' ? 'avisoMalo' : e.kind === 'historia' ? 'avisoHistoria' : 'aviso', NaN, NaN);
          break;
        default:
          break;
      }
    }
    ev.length = 0;
  }

  private updateFx(dt: number) {
    const sim = this.sim;
    const nav = sim.world.nav;
    const f = this.rig.focus;
    const lights: DynLight[] = [];
    const spots: SpotReq[] = [];
    const rings: { x: number; y: number; z: number; r: number; color: number }[] = [];
    const dests: { x: number; y: number; z: number; color: number }[] = [];
    const blobs: { x: number; y: number; z: number; r: number }[] = [];
    const bars: { x: number; y: number; z: number; hp: number; kind: number; blood: number }[] = [];
    const sel = new Set(this.selected);
    // Luces de la base
    let sig = '';
    const dyn = [];
    for (const b of sim.state.buildings) {
      const l = buildingLight(sim, b.id);
      if (!l) continue;
      sig += b.id + ',';
      dyn.push(l);
      if (Math.hypot(l.x - f.x, l.z - f.z) < 90) {
        const m = Math.max(l.r, l.g, l.b, 1e-3);
        const col = (Math.round((l.r / m) * 255) << 16) | (Math.round((l.g / m) * 255) << 8) | Math.round((l.b / m) * 255);
        const fl = l.flicker === 1 ? 0.85 + 0.15 * Math.sin(this.gfx.time * 11 + b.id) * Math.sin(this.gfx.time * 5.3) : 1;
        lights.push({ x: l.x, y: l.y, z: l.z, color: col, power: m * 9 * fl, dist: l.radius });
      }
    }
    if (sig !== this.lightSig) {
      this.lightSig = sig;
      this.fx.setDynamicLights(dyn);
      this.things.relight();
    }
    const hoverId = this.hover && this.hover.kind === 'char' ? this.hover.id : 0;
    const targets = new Set<number>();
    for (const c of sim.state.chars) {
      const d = Math.hypot(c.x - f.x, c.z - f.z);
      if (d > 120) continue;
      const y = nav.heightAt(c.x, c.z);
      const scale = c.kind === 'humano' ? 1 : CREATURES[c.kind].scale;
      if (!c.carriedBy) blobs.push({ x: c.x, y, z: c.z, r: (c.st === 'ok' ? 0.42 : 0.7) * scale });
      const isSel = sel.has(c.id);
      if (isSel) {
        rings.push({ x: c.x, y, z: c.z, r: 0.5, color: 0x8dffa0 });
        if (c.hasDest && Math.hypot(c.destX - c.x, c.destZ - c.z) > 1.5) dests.push({ x: c.destX, y: nav.heightAt(c.destX, c.destZ), z: c.destZ, color: 0x8dffa0 });
        if (c.target) targets.add(c.target);
      } else if (c.id === hoverId) {
        const hs = sim.players[0] ? hostile(sim, sim.players[0], c) : false;
        rings.push({ x: c.x, y, z: c.z, r: 0.5 * scale, color: c.player ? 0xcfffd6 : hs ? 0xff6a5a : 0xf0e6c8 });
      }
      // Linternas
      if (c.lamp && c.st === 'ok' && d < 80) {
        if (c.player) spots.push({ x: c.x + Math.cos(c.face) * 0.15, y: y + 1.62, z: c.z + Math.sin(c.face) * 0.15, dx: Math.cos(c.face), dz: Math.sin(c.face), power: isSel ? 95 : 70 });
        else lights.push({ x: c.x + Math.cos(c.face) * 0.8, y: y + 1.5, z: c.z + Math.sin(c.face) * 0.8, color: 0xffe2b8, power: 14, dist: 12 });
      }
      // Barras: seleccionados y heridos cercanos
      if (c.st !== 'muerto' && d < 60) {
        const hp = totalHpFrac(c);
        if (isSel || c.id === hoverId || (hp < 0.97 && c.sinceHit < 12) || (c.st === 'ko' && c.player)) {
          const kind = c.player ? 1 : sim.players[0] && hostile(sim, sim.players[0], c) ? -1 : 0;
          bars.push({ x: c.x, y: y + this.views.heightOf(c) + 0.28, z: c.z, hp, kind, blood: c.blood / 100 });
        }
      }
    }
    for (const id of targets) {
      const t = sim.char(id);
      if (t) rings.push({ x: t.x, y: nav.heightAt(t.x, t.z), z: t.z, r: 0.55, color: 0xff5040 });
    }
    // Las linternas seleccionadas primero
    spots.sort((a, b) => b.power - a.power || Math.hypot(a.x - f.x, a.z - f.z) - Math.hypot(b.x - f.x, b.z - f.z));
    // Fantasma de construcción
    if (this.buildDef) this.things.setGhost(this.buildDef, this.buildPos.x, this.buildPos.z, this.buildRot, !this.buildWhy);
    this.fx.update(dt, this.gfx.time, this.gfx.camera, f, { lights, spots, rings, dests, blobs, bars });
    globals.uCollapse.value = 1;
  }

  // --- Proyección y selección con el ratón ----------------------------------------------

  project(x: number, y: number, z: number): { x: number; y: number; ok: boolean } {
    tmp.set(x, y, z).project(this.gfx.camera);
    const r = this.canvas.getBoundingClientRect();
    return { x: (tmp.x * 0.5 + 0.5) * r.width, y: (-tmp.y * 0.5 + 0.5) * r.height, ok: tmp.z < 1 && tmp.z > -1 };
  }

  pick(cx: number, cy: number): Target {
    const r = this.canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, this.gfx.camera);
    const o = ray.ray.origin;
    const d = ray.ray.direction;
    const sim = this.sim;
    const nav = sim.world.nav;
    // Suelo: plano de vías y, si procede, plano de andén
    let gt = d.y < -1e-4 ? -o.y / d.y : 1e6;
    let gx = o.x + d.x * gt;
    let gz = o.z + d.z * gt;
    if (d.y < -1e-4) {
      const t2 = (1.1 - o.y) / d.y;
      const x2 = o.x + d.x * t2;
      const z2 = o.z + d.z * t2;
      if (nav.heightAt(x2, z2) > 0.6) {
        gt = t2;
        gx = x2;
        gz = z2;
      }
    }
    let best: Target = { kind: 'ground', x: gx, z: gz };
    let bestT = gt + 0.4;
    const f = this.rig.focus;
    const test = (px: number, py: number, pz: number, rad: number): number => {
      // Distancia del rayo a un punto; devuelve t si pasa a menos de rad
      const vx = px - o.x;
      const vy = py - o.y;
      const vz = pz - o.z;
      const t = vx * d.x + vy * d.y + vz * d.z;
      if (t < 0) return -1;
      const dx = vx - d.x * t;
      const dy = vy - d.y * t;
      const dz = vz - d.z * t;
      return dx * dx + dy * dy + dz * dz <= rad * rad ? t : -1;
    };
    for (const c of sim.state.chars) {
      if (c.carriedBy || Math.hypot(c.x - f.x, c.z - f.z) > 130) continue;
      const y = nav.heightAt(c.x, c.z);
      const h = this.views.heightOf(c);
      let t = -1;
      if (c.st === 'ok' && c.pose !== 'tumbado') {
        for (const k of [0.25, 0.5, 0.8]) {
          const tt = test(c.x, y + h * k, c.z, 0.42);
          if (tt >= 0 && (t < 0 || tt < t)) t = tt;
        }
      } else t = test(c.x, y + 0.3, c.z, 0.85);
      if (t >= 0 && t < bestT) {
        bestT = t;
        best = { kind: 'char', id: c.id, x: c.x, z: c.z };
      }
    }
    for (const b of sim.state.buildings) {
      const def = BUILDS[b.def];
      const t = test(b.x, nav.heightAt(b.x, b.z) + (def.tall ? 1.0 : 0.5), b.z, Math.max(def.hx, def.hz) * 0.9 + 0.2);
      if (t >= 0 && t < bestT) {
        bestT = t;
        best = { kind: 'build', id: b.id, x: b.x, z: b.z };
      }
    }
    for (const c of sim.state.containers) {
      const t = test(c.x, nav.heightAt(c.x, c.z) + 0.4, c.z, 0.7);
      if (t >= 0 && t < bestT) {
        bestT = t;
        best = { kind: 'cont', id: c.id, x: c.x, z: c.z };
      }
    }
    for (const dr of sim.state.drops) {
      const t = test(dr.x, nav.heightAt(dr.x, dr.z) + 0.2, dr.z, 0.5);
      if (t >= 0 && t < bestT) {
        bestT = t;
        best = { kind: 'drop', id: dr.id, x: dr.x, z: dr.z };
      }
    }
    for (const n of sim.state.nodes) {
      const rad = n.kind === 'derrumbe' ? 5 : n.kind === 'muro' ? 2.2 : 1.3;
      const t = test(n.x, nav.heightAt(n.x, n.z) + (n.kind === 'derrumbe' ? 1.5 : 0.5), n.z, rad);
      if (t >= 0 && t < bestT) {
        bestT = t;
        best = { kind: 'node', id: n.id, x: n.x, z: n.z };
      }
    }
    return best;
  }

  // --- Órdenes ---------------------------------------------------------------------------

  squad(): Char[] {
    return this.selected.map((id) => this.sim.char(id)).filter((c): c is Char => !!c && c.player && c.st === 'ok');
  }

  private give(c: Char, o: Order, queue: boolean) {
    if (queue && (c.order || c.queue.length)) c.queue.push(o);
    else {
      c.order = o;
      c.queue.length = 0;
      c.workT = 0;
      if (o.t !== 'atacar') c.target = 0;
      if (c.ai.sub === 'cama') c.ai.sub = '';
    }
  }

  orderAll(o: Order, queue = false) {
    for (const c of this.squad()) this.give(c, { ...o }, queue);
    this.bump();
  }

  moveTo(x: number, z: number, queue = false) {
    const sq = this.squad();
    const nav = this.sim.world.nav;
    const n = sq.length;
    sq.forEach((c, i) => {
      let tx = x;
      let tz = z;
      if (n > 1) {
        const ring = Math.floor((Math.sqrt(1 + 8 * i) - 1) / 2);
        const a = i * 2.399963;
        const r = 0.9 * Math.sqrt(i);
        tx = x + Math.cos(a) * r;
        tz = z + Math.sin(a) * r;
        void ring;
      }
      const p = nav.nearestPassable(tx, tz, 3, true) ?? nav.nearestPassable(x, z, 6, true);
      if (p) this.give(c, { t: 'mover', x: p.x, z: p.z }, queue);
    });
    if (n) this.fx.dust(x, nav.heightAt(x, z) + 0.1, z, 2);
    this.onSound?.('orden', NaN, NaN);
    this.bump();
  }

  /** Acciones posibles sobre un objetivo para la escuadra seleccionada. */
  actionsFor(t: Target, queue = false): { title: string; actions: MenuAction[] } {
    const sim = this.sim;
    const sq = this.squad();
    const first = sq[0];
    const actions: MenuAction[] = [];
    let title = '';
    const one = (o: Order) => () => {
      if (first) this.give(first, o, queue);
      this.bump();
    };
    const all = (o: Order) => () => this.orderAll(o, queue);
    if (t.kind === 'char') {
      const c = sim.char(t.id);
      if (!c) return { title, actions };
      title = c.name;
      if (!first) return { title, actions };
      const hs = hostile(sim, first, c);
      if (c.player) {
        if (c.st === 'ok') {
          if (needsCare(c) || totalHpFrac(c) < 0.95) actions.push({ label: 'Curar', run: one({ t: 'curar', id: c.id }) });
          actions.push({ label: 'Seguir', run: all({ t: 'seguir', id: c.id }) });
        } else {
          actions.push({ label: 'Primeros auxilios', run: one({ t: 'curar', id: c.id }) });
          actions.push({ label: 'Cargar a hombros', run: one({ t: 'cargar', id: c.id }) });
          if (c.st === 'muerto') actions.push({ label: 'Recoger sus cosas', run: one({ t: 'saquear', id: c.id }) });
        }
      } else if (c.st === 'ok') {
        if (hs) actions.push({ label: 'Atacar', run: all({ t: 'atacar', id: c.id }), danger: true });
        else {
          if (c.kind === 'humano') actions.push({ label: c.vendor ? 'Hablar y comerciar' : 'Hablar', run: one({ t: 'hablar', id: c.id }) });
          if (needsCare(c)) actions.push({ label: 'Curar', run: one({ t: 'curar', id: c.id }) });
          actions.push({ label: 'Atacar', hint: 'Es un crimen', run: all({ t: 'atacar', id: c.id }), danger: true });
        }
      } else {
        actions.push({ label: 'Registrar', run: one({ t: 'saquear', id: c.id }) });
        if (c.st === 'ko') {
          actions.push({ label: 'Primeros auxilios', run: one({ t: 'curar', id: c.id }) });
          actions.push({ label: 'Cargar a hombros', run: one({ t: 'cargar', id: c.id }) });
          actions.push({ label: 'Rematar', run: all({ t: 'atacar', id: c.id, data: 'rematar' }), danger: true });
        } else if (c.kind === 'humano') actions.push({ label: 'Cargar el cuerpo', run: one({ t: 'cargar', id: c.id }) });
      }
    } else if (t.kind === 'build') {
      const b = building(sim, t.id);
      if (!b) return { title, actions };
      const def = BUILDS[b.def];
      title = def.name;
      if (!first) return { title, actions };
      const job = (jt: JobType) => () => {
        for (const c of sq) {
          if (!c.jobs.some((j) => j.t === jt && j.id === b.id)) c.jobs.push({ t: jt, id: b.id });
        }
        this.bump();
      };
      if (b.prog < 1) {
        actions.push({ label: 'Construir', run: all({ t: 'construir', id: b.id }) });
      } else {
        if (def.beds) {
          actions.push({ label: 'Descansar aquí', run: one({ t: 'descansar', id: b.id }) });
          if (first.carry) actions.push({ label: 'Acostar al herido', run: one({ t: 'soltar', id: b.id }) });
        }
        if (def.recipes) {
          actions.push({
            label: 'Elegir receta…',
            run: () => {
              this.panel = { t: 'taller', id: b.id };
              this.bump();
            },
          });
        }
        if (def.recipes || def.farm || def.research || (def.radio && !sim.state.flags.senal)) {
          actions.push({ label: def.farm ? 'Atender el cultivo' : def.research ? 'Investigar' : def.radio ? 'Escuchar la radio' : 'Trabajar aquí', run: one({ t: 'operar', id: b.id }) });
          actions.push({ label: 'Asignar como trabajo fijo', hint: 'Lo hará siempre que no tenga órdenes', run: job(def.farm ? 'cultivar' : def.research ? 'investigar' : 'operar') });
        }
        if (def.store || def.recipes || def.farm || def.passive) actions.push({ label: def.store && !def.recipes ? 'Abrir almacén' : 'Ver contenido', run: () => this.openBuilding(b.id) });
      }
      actions.push({ label: 'Derribar', run: one({ t: 'derribar', id: b.id }), danger: true });
    } else if (t.kind === 'cont') {
      const c = sim.container(t.id);
      if (!c) return { title, actions };
      title = c.label;
      const key = isCivilDefense(c) && sim.players.some((q) => q.inv.some((i) => i.id === 'llaveAlmacen'));
      if (first) actions.push({ label: c.lock > 0 && !c.opened ? (key ? 'Abrir con la llave' : 'Forzar la cerradura') : 'Abrir', hint: c.owner ? 'Es un robo' : undefined, run: one({ t: 'abrir', id: c.id }), danger: !!c.owner });
    } else if (t.kind === 'drop') {
      title = 'Objetos en el suelo';
      if (first) actions.push({ label: 'Recoger', run: one({ t: 'recoger', id: t.id }) });
    } else if (t.kind === 'node') {
      const n = sim.node(t.id);
      if (!n) return { title, actions };
      if (n.kind === 'chatarra' || n.kind === 'salitre') {
        title = n.kind === 'chatarra' ? 'Montón de chatarra' : 'Costras de salitre';
        if (first) {
          actions.push({ label: n.kind === 'chatarra' ? 'Desguazar' : 'Rascar salitre', run: all({ t: 'chatarrear', id: n.id }) });
          actions.push({
            label: 'Asignar como trabajo fijo',
            hint: 'Irá y volverá del almacén',
            run: () => {
              for (const c of sq) if (!c.jobs.some((j) => j.t === 'chatarrear' && j.id === n.id)) c.jobs.push({ t: 'chatarrear', id: n.id });
              this.bump();
            },
          });
        }
      } else {
        title = n.kind === 'derrumbe' ? 'Derrumbe' : 'Muro soviético';
        if (first) actions.push({ label: n.kind === 'derrumbe' ? 'Excavar el derrumbe' : 'Derribar el muro', run: all({ t: 'excavar', id: n.id }) });
      }
    }
    return { title, actions };
  }

  openBuilding(id: number) {
    const b = building(this.sim, id);
    const actor = this.squad()[0];
    if (!b || !actor) return;
    this.panel = { t: 'saqueo', actor: actor.id, target: { kind: 'build', id, x: b.x, z: b.z } };
    this.bump();
  }

  select(ids: number[], add = false) {
    if (add) {
      const s = new Set(this.selected);
      for (const id of ids) (s.has(id) && ids.length === 1 ? s.delete(id) : s.add(id));
      this.selected = [...s];
    } else this.selected = ids;
    this.inspect = 0;
    this.bump();
  }

  focusOn(id: number) {
    const c = this.sim.char(id);
    if (c) {
      this.rig.tx = c.x;
      this.rig.tz = c.z;
      this.rig.follow = null;
    }
  }

  setSpeed(n: number) {
    this.speed = n;
    this.paused = false;
    this.bump();
  }
  togglePause() {
    this.paused = !this.paused;
    this.bump();
  }

  startBuild(defId: string | null) {
    this.buildDef = defId;
    this.menu = null;
    if (!defId) this.things.setGhost(null);
    this.bump();
  }

  closePanel() {
    if (this.panel && (this.panel.t === 'hablar' || this.panel.t === 'peaje' || this.panel.t === 'comercio' || this.panel.t === 'despedir')) this.paused = false;
    this.panel = null;
    this.bump();
  }

  // --- Entrada ---------------------------------------------------------------------------------

  private bindInput() {
    const cv = this.canvas;
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Window, ev: K | string, fn: (e: never) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(ev, fn as EventListener, opts);
      this.disposers.push(() => el.removeEventListener(ev, fn as EventListener, opts));
    };
    on(cv, 'contextmenu', (e: MouseEvent) => e.preventDefault());
    on(cv, 'wheel', (e: WheelEvent) => {
      e.preventDefault();
      this.rig.zoom(Math.exp(e.deltaY * 0.0011));
    }, { passive: false });
    on(cv, 'pointerdown', (e: PointerEvent) => {
      if (!this.sim) return;
      cv.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, y: e.clientY, button: e.button, moved: false };
      if (this.menu) {
        this.menu = null;
        this.bump();
      }
    });
    on(cv, 'pointermove', (e: PointerEvent) => {
      if (!this.sim) return;
      const dg = this.drag;
      if (dg) {
        const dx = e.clientX - dg.x;
        const dy = e.clientY - dg.y;
        if (!dg.moved && Math.hypot(dx, dy) > 5) dg.moved = true;
        if (dg.moved) {
          if (dg.button === 1 || (dg.button === 2 && !this.buildDef)) {
            this.rig.rotate(-e.movementX * 0.005, e.movementY * 0.004);
          } else if (dg.button === 0 && !this.buildDef) {
            const r = cv.getBoundingClientRect();
            this.box = { x0: dg.x - r.left, y0: dg.y - r.top, x1: e.clientX - r.left, y1: e.clientY - r.top };
            this.bump();
          }
        }
        return;
      }
      const t = this.pick(e.clientX, e.clientY);
      if (this.buildDef) {
        const def = BUILDS[this.buildDef];
        const snap = def.hx > 0.6 ? 0.5 : 0.25;
        this.buildPos.x = Math.round(t.x / snap) * snap;
        this.buildPos.z = Math.round(t.z / snap) * snap;
        this.buildWhy = canPlace(this.sim, this.buildDef, this.buildPos.x, this.buildPos.z, this.buildRot);
      }
      const prev = this.hover;
      this.hover = t.kind === 'ground' ? null : t;
      if ((prev?.kind !== this.hover?.kind) || (prev && this.hover && 'id' in prev && 'id' in this.hover && prev.id !== this.hover.id)) this.bump();
    });
    on(cv, 'pointerup', (e: PointerEvent) => {
      if (!this.sim) return;
      const dg = this.drag;
      this.drag = null;
      if (!dg) return;
      const shift = e.shiftKey;
      if (dg.moved) {
        if (this.box) {
          // Selección por rectángulo
          const b = this.box;
          const x0 = Math.min(b.x0, b.x1);
          const x1 = Math.max(b.x0, b.x1);
          const y0 = Math.min(b.y0, b.y1);
          const y1 = Math.max(b.y0, b.y1);
          const ids: number[] = [];
          const nav = this.sim.world.nav;
          for (const c of this.sim.players) {
            const p = this.project(c.x, nav.heightAt(c.x, c.z) + 1, c.z);
            if (p.ok && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(c.id);
          }
          this.box = null;
          if (ids.length || !shift) this.select(shift ? [...new Set([...this.selected, ...ids])] : ids);
          this.bump();
        }
        return;
      }
      const t = this.pick(e.clientX, e.clientY);
      if (this.buildDef) {
        if (dg.button === 0) {
          if (!this.buildWhy) {
            const b = placeBuilding(this.sim, this.buildDef, this.buildPos.x, this.buildPos.z, this.buildRot);
            // Quien esté seleccionado se pone manos a la obra
            for (const c of this.squad()) this.give(c, { t: 'construir', id: b.id }, true);
            this.onSound?.('colocar', NaN, NaN);
            if (!shift) this.startBuild(null);
          } else this.onSound?.('error', NaN, NaN);
        } else if (dg.button === 2) this.startBuild(null);
        this.bump();
        return;
      }
      if (dg.button === 0) {
        if (t.kind === 'char') {
          const c = this.sim.char(t.id);
          if (c?.player && c.st !== 'muerto') this.select([c.id], shift);
          else {
            this.inspect = t.id;
            this.bump();
          }
        } else if (!shift) {
          this.select([]);
        }
      } else if (dg.button === 2) {
        if (!this.squad().length) return;
        if (t.kind === 'ground') {
          this.moveTo(t.x, t.z, shift);
          return;
        }
        const { title, actions } = this.actionsFor(t, shift);
        if (!actions.length) return;
        // A los enemigos se les ataca sin preguntar
        if (t.kind === 'char') {
          const c = this.sim.char(t.id);
          const first = this.squad()[0];
          if (c && first && c.st === 'ok' && hostile(this.sim, first, c)) {
            actions[0].run();
            this.onSound?.('orden', NaN, NaN);
            return;
          }
        }
        const r = cv.getBoundingClientRect();
        this.menu = { x: e.clientX - r.left, y: e.clientY - r.top, title, actions };
        this.bump();
      }
    });
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (!this.sim || (e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      this.keys.add(e.code);
      this.onKey(e);
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
    on(window, 'blur', () => this.keys.clear());
    on(window, 'resize', () => this.gfx.resize());
  }

  /**
   * Atajos de las pantallas y de la partida: los gestiona la interfaz. Recibe
   * el código de la tecla y la acción que tiene asignada (o null).
   */
  onHotkey: ((code: string, action: string | null) => boolean) | null = null;

  private onKey(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey || e.altKey;
    const action = mod ? null : actionFor(e.code);
    if (this.onHotkey?.(e.code, action)) {
      e.preventDefault();
      return;
    }
    // Combinaciones fijas: grupos (Ctrl o Alt + 1-4) y todos (Ctrl + A)
    const digit = /^Digit([1-4])$/.exec(e.code);
    if (digit && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.groups[Number(digit[1])] = [...this.selected];
      return;
    }
    if (digit && e.altKey) {
      e.preventDefault();
      const grp = this.groups[Number(digit[1])];
      if (grp) this.select(grp);
      return;
    }
    if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.select(this.sim.players.filter((c) => c.st === 'ok').map((c) => c.id));
      return;
    }
    if (e.code === 'Escape') {
      if (this.buildDef) this.startBuild(null);
      else if (this.menu) {
        this.menu = null;
        this.bump();
      } else if (this.panel) this.closePanel();
      return;
    }
    if (!action) return;
    const sq = this.squad();
    switch (action) {
      case 'pausa':
        e.preventDefault();
        this.togglePause();
        break;
      case 'vel1':
      case 'vel2':
      case 'vel3':
      case 'vel4':
        this.setSpeed([1, 2, 4, 8][Number(action.slice(3)) - 1]);
        break;
      case 'siguiente': {
        e.preventDefault();
        const ps = this.sim.players.filter((c) => c.st === 'ok');
        if (!ps.length) break;
        const i = ps.findIndex((c) => c.id === this.selected[0]);
        const nx = ps[(i + 1) % ps.length];
        this.select([nx.id]);
        this.focusOn(nx.id);
        break;
      }
      case 'centrar':
        if (this.selected[0]) this.focusOn(this.selected[0]);
        break;
      case 'linterna': {
        const v = !sq[0]?.lamp;
        for (const c of sq) c.lamp = v && (!!c.eq.luz || c.inv.some((q) => ITEMS[q.id]?.light));
        this.bump();
        break;
      }
      case 'sigilo': {
        const v = !sq[0]?.sneak;
        for (const c of sq) c.sneak = v;
        this.bump();
        break;
      }
      case 'mantener': {
        const v = !sq[0]?.hold;
        for (const c of sq) c.hold = v;
        this.bump();
        break;
      }
      case 'cancelar':
        for (const c of sq) {
          c.order = null;
          c.queue.length = 0;
          c.target = 0;
          c.hasDest = false;
        }
        this.bump();
        break;
      case 'girarObra':
        if (this.buildDef) this.buildRot += (e.shiftKey ? -1 : 1) * (Math.PI / 12);
        break;
      case 'girarIzq':
        if (this.buildDef) this.buildRot += Math.PI / 12;
        break;
      case 'girarDer':
        if (this.buildDef) this.buildRot -= Math.PI / 12;
        break;
      default:
        break;
    }
  }

  dispose() {
    this.stop();
    for (const d of this.disposers) d();
    this.views?.dispose();
    this.things?.dispose();
    this.fx?.dispose();
    this.shared.worldGroup.removeFromParent();
    this.shared.propsGroup.removeFromParent();
    this.gfx.dispose();
  }
}

export { ITEMS };
