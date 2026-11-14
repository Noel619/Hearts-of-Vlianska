// Vistas: sincroniza los personajes, edificios y objetos de la simulación con
// sus modelos 3D (creación, destrucción, animación, luz de sonda).

import * as THREE from 'three';
import { CREATURES } from '../data/criaturas';
import { BUILDS } from '../data/edificios';
import { ITEMS } from '../data/items';
import { angleDiff, hashStr } from '../core/math';
import type { AnimInput } from '../render/chars/anim';
import { CreatureView } from '../render/chars/creatures';
import { HumanView } from '../render/chars/humanView';
import { MeshBuilder } from '../render/geo';
import { propGeometry } from '../render/kit/core';
import { drawHeld, hasHeld, heldGrip } from '../render/kit/weapons';
import { cloneProbeMaterial, probeMaterial, setProbe } from '../render/materials';
import { effectiveLook, limpSide, weaponItem } from '../sim/chars';
import { Sim } from '../sim/sim';
import type { Building, Char, Drop } from '../sim/types';

const RANGE = 150;
const out = new Float32Array(6);

interface CharView {
  group: THREE.Group;
  kind: 'humano' | 'cuadrupedo' | 'bipedo';
  human?: HumanView;
  creature?: CreatureView;
  sig: string;
  probe: Float32Array;
  y: number;
  // Interpolación entre pasos de la simulación: posición y rumbo del paso
  // anterior (p*) y del último (c*), y lo que se dibuja (x, z, face)
  tick: number;
  px: number;
  pz: number;
  pf: number;
  cx: number;
  cz: number;
  cf: number;
  x: number;
  z: number;
  face: number;
  /** Velocidad sobre el suelo (m/s de juego) y su dirección en el mundo, suavizadas. */
  gs: number;
  vx: number;
  vz: number;
  /** Velocidad de giro (rad/s de juego, + hacia la izquierda del personaje), suavizada. */
  turn: number;
  /** Distancia recorrida en este fotograma (m). */
  moved: number;
}

const WORK_TOOL: Record<string, string> = { martillo: 'martillo', pico: 'pico', guitarra: 'guitarra', cargarCaja: 'cajaCarga' };

export class CharViews {
  readonly group = new THREE.Group();
  private views = new Map<number, CharView>();
  private frame = 0;

  constructor(readonly sim: Sim) {
    this.group.name = 'personajes';
  }

  get(id: number): CharView | undefined {
    return this.views.get(id);
  }

  private create(c: Char): CharView {
    const g = new THREE.Group();
    const v: CharView = {
      group: g,
      kind: 'humano',
      sig: '',
      probe: new Float32Array([0.2, 0.2, 0.25, 0, 0.3, 0]),
      y: 0,
      tick: -1,
      px: c.x,
      pz: c.z,
      pf: c.face,
      cx: c.x,
      cz: c.z,
      cf: c.face,
      x: c.x,
      z: c.z,
      face: c.face,
      gs: 0,
      vx: 0,
      vz: 0,
      turn: 0,
      moved: 0,
    };
    if (c.kind === 'humano') {
      const look = effectiveLook(c)!;
      v.human = new HumanView(look);
      g.add(v.human.group);
    } else {
      const def = CREATURES[c.kind];
      v.creature = new CreatureView(def, c.id);
      v.kind = def.shape;
      g.add(v.creature.group);
    }
    this.group.add(g);
    this.views.set(c.id, v);
    return v;
  }

  private destroy(id: number) {
    const v = this.views.get(id);
    if (!v) return;
    v.human?.dispose();
    v.creature?.dispose();
    v.group.removeFromParent();
    this.views.delete(id);
  }

  /** Posición y rumbo con que se dibuja a un personaje (interpolados entre pasos), si está a la vista. */
  shown(id: number): { x: number; z: number; face: number; y: number } | undefined {
    return this.views.get(id);
  }

  update(dt: number, fx: number, fz: number) {
    const sim = this.sim;
    const nav = sim.world.nav;
    const field = sim.world.field;
    const alpha = sim.alpha;
    this.frame++;
    const seen = new Set<number>();
    for (const c of sim.state.chars) {
      const d = Math.hypot(c.x - fx, c.z - fz);
      if (d > RANGE) continue;
      seen.add(c.id);
      let v = this.views.get(c.id);
      if (!v) v = this.create(c);
      // Posición del último paso de la simulación
      let x = c.x;
      let z = c.z;
      let face = c.face;
      let lift = 0;
      if (c.carriedBy) {
        const o = sim.char(c.carriedBy);
        if (o) {
          lift = 1.28;
          x = o.x - Math.sin(o.face) * 0.16;
          z = o.z + Math.cos(o.face) * 0.16;
          face = o.face + Math.PI;
        }
      } else if (c.pose === 'tumbado' && c.ai.sub !== '') lift = 0.32;
      this.track(v, x, z, face, alpha);
      const y = nav.heightAt(v.x, v.z) + lift;
      v.y += (y - v.y) * Math.min(1, dt * 14);
      if (Math.abs(y - v.y) > 1.5) v.y = y;
      // Sonda de luz (escalonada entre fotogramas)
      if ((this.frame + c.id) % 5 === 0) {
        field.sample(v.x, y + 1.1, v.z, 0, 1, 0, false, out);
        const p = v.probe;
        for (let i = 0; i < 6; i++) p[i] += (out[i] - p[i]) * 0.5;
      }
      const p = v.probe;
      if (v.human) {
        const h = v.human;
        // Aspecto y armas (solo si cambia el equipo)
        const sig = `${c.eq.arma?.id ?? ''}|${c.eq.cabeza?.id ?? ''}|${c.eq.cara?.id ?? ''}|${c.eq.torso?.id ?? ''}|${c.eq.mochila?.id ?? ''}|${c.look?.armband ?? ''}`;
        if (sig !== v.sig) {
          v.sig = sig;
          h.setLook(effectiveLook(c)!);
        }
        const tool = WORK_TOOL[c.work];
        const w = weaponItem(c);
        // El arma va en la mano salvo que las tenga ocupadas, esté sentado o tumbado:
        // entonces se la cuelga a la espalda (o al cinto, si es corta)
        const up = c.st === 'ok' && c.pose !== 'tumbado';
        const busy = c.work !== 'nada' && c.work !== 'guardia';
        const seated = c.pose === 'sentado' || c.pose === 'sentadoSuelo' || c.pose === 'cuclillas';
        const drawn = !busy && !seated && c.carry === 0 ? (w?.model ?? null) : c.carry !== 0 && w?.weapon?.hold !== 'dos' && w?.weapon?.hold !== 'fusil' ? (w?.model ?? null) : null;
        const inHand = up ? (tool ?? drawn) : null;
        h.setWeapon(inHand);
        h.setBack(up && w?.model && inHand !== w.model ? w.model : null);
        // La luz encendida se ve: linterna en la frente o farol en la mano
        const lampId = c.lamp && up ? (c.eq.luz?.id ?? c.inv.find((q) => ITEMS[q.id]?.light)?.id ?? null) : null;
        h.setLamp(lampId === 'farol' ? 'farol' : lampId ? 'frontal' : null);
        const inp = h.input;
        this.motion(v, inp, h.scale);
        inp.sneak = c.sneak;
        inp.limp = limpSide(c);
        inp.hold = tool ? (tool === 'pico' ? 'dos' : 'nada') : inHand ? (w?.weapon?.hold ?? 'nada') : 'nada';
        inp.aim = c.aim;
        inp.pose = c.st === 'muerto' ? 'muerto' : c.st === 'ko' ? (c.carriedBy ? 'cargado' : 'ko') : c.pose;
        inp.work = c.work;
        inp.carrying = c.carry !== 0;
        inp.attack = c.atkT >= 0 ? (c.atkKind as AnimInput['attack']) : null;
        inp.attackT = Math.max(0, c.atkT);
        inp.sinceFire = c.sinceFire;
        inp.sinceHit = c.sinceHit;
        inp.hitSide = c.hitSide;
        inp.sinceBlock = c.sinceBlock;
        this.lookAt(v, c, inp, 1.62 * h.scale);
        h.aimYaw = v.face;
        h.place(v.x, v.y, v.z, v.face);
        h.setProbe(p[0], p[1], p[2], p[3], p[4], p[5]);
        // Lejos de la cámara se anima a media frecuencia
        if (d < 70 || (this.frame + c.id) % 2 === 0) h.update(d < 70 ? dt : dt * 2);
      } else if (v.creature) {
        const cv = v.creature;
        const def = cv.def;
        if (cv.quad) {
          const q = cv.qin;
          q.speed = v.gs / def.scale;
          q.dist = v.moved / def.scale;
          q.turn = v.turn;
          q.attacking = c.atkT >= 0;
          q.attackT = Math.max(0, c.atkT);
          q.sinceHit = c.sinceHit;
          q.hitSide = c.hitSide;
          q.dead = c.st !== 'ok';
          // Mira a su presa
          const t = c.target && c.st === 'ok' ? this.sim.char(c.target) : undefined;
          q.alert = t ? 1 : 0;
          q.look = t ? -angleDiff(v.face, Math.atan2((this.views.get(t.id)?.z ?? t.z) - v.z, (this.views.get(t.id)?.x ?? t.x) - v.x)) : null;
        } else {
          const inp = cv.bin;
          this.motion(v, inp, def.scale);
          inp.pose = c.st === 'muerto' ? 'muerto' : c.st === 'ko' ? 'ko' : 'normal';
          inp.attack = c.atkT >= 0 ? (c.id % 2 ? 'golpe' : 'tajo') : null;
          inp.attackT = Math.max(0, c.atkT);
          inp.sinceHit = c.sinceHit;
          inp.hitSide = c.hitSide;
          inp.sneak = c.kind === 'sheptun' && v.gs < 1;
          this.lookAt(v, c, inp, 1.62 * def.scale);
        }
        cv.place(v.x, v.y, v.z, v.face);
        cv.setProbe(p[0], p[1], p[2], p[3], p[4], p[5]);
        if (d < 70 || (this.frame + c.id) % 2 === 0) cv.update(d < 70 ? dt : dt * 2);
      }
    }
    for (const id of this.views.keys()) if (!seen.has(id)) this.destroy(id);
  }

  /**
   * Interpola entre los dos últimos pasos de la simulación y mide la marcha real
   * (velocidad, giro y distancia recorrida en este fotograma).
   */
  private track(v: CharView, x: number, z: number, face: number, alpha: number) {
    const sim = this.sim;
    const ticks = sim.tick - v.tick;
    if (v.tick < 0 || ticks > 0) {
      const first = v.tick < 0;
      v.px = v.cx;
      v.pz = v.cz;
      v.pf = v.cf;
      v.cx = x;
      v.cz = z;
      v.cf = face;
      v.tick = sim.tick;
      if (first || Math.hypot(v.cx - v.px, v.cz - v.pz) > 2.5) {
        // Recién aparecido o teletransportado: sin estela
        v.px = v.cx;
        v.pz = v.cz;
        v.pf = v.cf;
        v.vx = v.vz = v.gs = v.turn = 0;
        v.x = x;
        v.z = z;
        v.face = face;
      } else {
        const span = Math.min(ticks, 6) * Sim.STEP;
        const k = 1 - Math.exp(-span * 9);
        v.vx += ((v.cx - v.px) / span - v.vx) * k;
        v.vz += ((v.cz - v.pz) / span - v.vz) * k;
        v.gs = Math.hypot(v.vx, v.vz);
        // Rumbo matemático (de +X hacia +Z): girar a la izquierda del personaje lo hace bajar
        v.turn += (-angleDiff(v.pf, v.cf) / span - v.turn) * (1 - Math.exp(-span * 7));
      }
    }
    const nx = v.px + (v.cx - v.px) * alpha;
    const nz = v.pz + (v.cz - v.pz) * alpha;
    v.moved = Math.hypot(nx - v.x, nz - v.z);
    if (v.moved > 2.5) v.moved = 0;
    v.x = nx;
    v.z = nz;
    v.face = v.pf + angleDiff(v.pf, v.cf) * alpha;
  }

  /** Marcha medida → entrada del animador, en unidades del modelo (sin la escala del personaje). */
  private motion(v: CharView, inp: AnimInput, scale: number) {
    inp.speed = v.gs / scale;
    inp.dist = v.moved / scale;
    inp.turn = v.turn;
    if (v.gs > 0.05) {
      const sf = Math.sin(v.face);
      const cf = Math.cos(v.face);
      // Componentes hacia la izquierda y hacia delante del personaje
      inp.moveDir = Math.atan2(v.vx * sf - v.vz * cf, v.vx * cf + v.vz * sf);
    } else inp.moveDir = 0;
  }

  /** Hacia dónde mira: al enemigo con quien pelea (la cabeza y el pecho lo siguen). */
  private lookAt(v: CharView, c: Char, inp: AnimInput, eye: number) {
    inp.look = null;
    inp.alert = 0;
    if (c.st !== 'ok' || !c.target) return;
    const t = this.sim.char(c.target);
    if (!t || t.st === 'muerto') return;
    inp.alert = 1;
    const tv = this.views.get(t.id);
    const tx = tv ? tv.x : t.x;
    const tz = tv ? tv.z : t.z;
    const dd = Math.hypot(tx - v.x, tz - v.z);
    if (dd < 0.3 || dd > 40) return;
    inp.look = -angleDiff(v.face, Math.atan2(tz - v.z, tx - v.x));
    const th = this.heightOf(t) * (t.st === 'ok' ? 0.86 : 0.15);
    inp.lookPitch = Math.atan2(th - eye, dd);
  }

  /** Altura del modelo de un personaje (para barras y selección). */
  heightOf(c: Char): number {
    if (c.kind === 'humano') return 1.85 * (c.look?.height ?? 1);
    const def = CREATURES[c.kind];
    return (def.shape === 'cuadrupedo' ? 0.95 : 1.85) * def.scale;
  }

  dispose() {
    for (const id of [...this.views.keys()]) this.destroy(id);
    this.group.removeFromParent();
  }
}

// ---------------------------------------------------------------------------
// Edificios del jugador, contenedores, objetos sueltos y nodos
// ---------------------------------------------------------------------------

interface ThingView {
  mesh: THREE.Mesh;
  kind: string;
  sig: string;
}

let thingMat: THREE.MeshStandardMaterial | null = null;
const thingGeo = new Map<string, THREE.BufferGeometry>();

function geoFor(key: string, build: (b: MeshBuilder) => void): THREE.BufferGeometry {
  let g = thingGeo.get(key);
  if (!g) {
    const b = new MeshBuilder({ fx: true });
    build(b);
    g = b.toGeometry();
    thingGeo.set(key, g);
  }
  return g;
}

export class ThingViews {
  readonly group = new THREE.Group();
  private views = new Map<string, ThingView>();
  private ghost: THREE.Mesh | null = null;
  private ghostMat = new THREE.MeshBasicMaterial({ color: 0x7dff9a, transparent: true, opacity: 0.4, depthWrite: false });

  constructor(readonly sim: Sim) {
    this.group.name = 'cosas';
    if (!thingMat) thingMat = probeMaterial({ roughness: 0.84, grunge: true });
  }

  private add(key: string, kind: string, geo: THREE.BufferGeometry, x: number, y: number, z: number, rot: number, sampleY = 0.8): ThingView {
    const mat = cloneProbeMaterial(thingMat!);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rot;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.sim.world.field.sample(x, y + sampleY, z, 0, 1, 0, false, out);
    setProbe(mat, out[0], out[1], out[2], out[3], out[4], out[5]);
    this.group.add(mesh);
    const v: ThingView = { mesh, kind, sig: '' };
    this.views.set(key, v);
    return v;
  }

  private remove(key: string) {
    const v = this.views.get(key);
    if (!v) return;
    v.mesh.removeFromParent();
    (v.mesh.material as THREE.Material).dispose();
    this.views.delete(key);
  }

  /** Vuelve a muestrear la luz de todo (al encender o apagar luces de la base). */
  relight() {
    const field = this.sim.world.field;
    for (const v of this.views.values()) {
      const p = v.mesh.position;
      field.sample(p.x, p.y + 0.8, p.z, 0, 1, 0, false, out);
      setProbe(v.mesh.material as THREE.Material, out[0], out[1], out[2], out[3], out[4], out[5]);
    }
  }

  update(fx: number, fz: number) {
    const sim = this.sim;
    const nav = sim.world.nav;
    const seen = new Set<string>();
    const R = 170;
    for (const b of sim.state.buildings) {
      if (Math.hypot(b.x - fx, b.z - fz) > R) continue;
      const key = 'b' + b.id;
      seen.add(key);
      const def = BUILDS[b.def];
      let v = this.views.get(key);
      if (!v) v = this.add(key, 'edificio', propGeometry(def.prop, def.variant ?? 0), b.x, nav.heightAt(b.x, b.z), b.z, b.rot, def.tall ? 1.6 : 0.8);
      // Obra: el modelo se levanta poco a poco y se ve translúcido
      const sig = b.prog >= 1 ? 'ok' : 'obra' + Math.floor(b.prog * 20);
      if (sig !== v.sig) {
        v.sig = sig;
        const m = v.mesh.material as THREE.MeshStandardMaterial;
        if (b.prog >= 1) {
          v.mesh.scale.set(1, 1, 1);
          m.transparent = false;
          m.opacity = 1;
          m.color.setRGB(1, 1, 1);
        } else {
          v.mesh.scale.set(1, 0.25 + 0.75 * b.prog, 1);
          m.transparent = true;
          m.opacity = 0.45 + 0.4 * b.prog;
          m.color.setRGB(0.7, 0.85, 1);
        }
        m.needsUpdate = true;
      }
    }
    for (const c of sim.state.containers) {
      if (Math.hypot(c.x - fx, c.z - fz) > R) continue;
      const key = 'c' + c.id;
      seen.add(key);
      if (!this.views.get(key)) {
        const geo = c.kind === 'almacen' ? propGeometry('caja', 3) : c.kind === 'botin' ? propGeometry('cajas', 2) : c.kind === 'cajon' ? propGeometry('caja', 1) : propGeometry('caja', (c.id % 2) * 2);
        this.add(key, 'contenedor', geo, c.x, nav.heightAt(c.x, c.z), c.z, (hashStr(key) % 628) / 100);
      }
    }
    for (const d of sim.state.drops) {
      if (Math.hypot(d.x - fx, d.z - fz) > R) continue;
      const key = 'd' + d.id;
      seen.add(key);
      if (!this.views.get(key)) this.add(key, 'suelto', dropGeometry(d), d.x, nav.heightAt(d.x, d.z), d.z, (hashStr(key) % 628) / 100, 0.4);
    }
    for (const n of sim.state.nodes) {
      if (Math.hypot(n.x - fx, n.z - fz) > R) continue;
      const key = 'n' + n.id;
      seen.add(key);
      if (!this.views.get(key)) {
        let geo: THREE.BufferGeometry;
        if (n.kind === 'chatarra') geo = propGeometry('chatarra', n.id % 3);
        else if (n.kind === 'salitre') {
          geo = geoFor('salitre', (b) => {
            for (let i = 0; i < 9; i++) {
              const a = i * 2.4;
              const r = 0.2 + (i % 4) * 0.22;
              b.color([0.78, 0.76, 0.7], 0.8 + (i % 3) * 0.1);
              b.sphere(Math.cos(a) * r, 0.05, Math.sin(a) * r, 0.2 + (i % 3) * 0.08, 0.08, 0.18, 6, 3);
            }
          });
        } else if (n.kind === 'derrumbe') {
          geo = geoFor('derrumbe', (b) => {
            // Tapón de escombros que ciega el túnel
            for (let i = 0; i < 70; i++) {
              const a = i * 2.399;
              const r = Math.sqrt(i / 70) * 6.2;
              const s = 0.7 + ((i * 7) % 11) * 0.12;
              const h = (1 - r / 7) * 3.4;
              b.color(i % 3 ? [0.3, 0.29, 0.27] : [0.2, 0.19, 0.18], 0.8 + ((i * 3) % 5) * 0.08);
              const v0 = b.vcount;
              b.push().translate(Math.cos(a) * r, Math.max(0, h * (0.3 + ((i * 5) % 7) * 0.1) - s * 0.3), Math.sin(a) * r).rotateY(a * 3).rotateX(a);
              b.box(0, 0, 0, s * 1.5, s, s * 1.2, 0b111111);
              b.pop();
              b.jitter(v0, s * 0.4, i + 3);
            }
            b.color([0.25, 0.14, 0.09]);
            for (let i = 0; i < 6; i++) b.beam(-4 + i * 1.5, 0.4, -2 + (i % 3) * 1.6, -3 + i * 1.4, 2.6 + (i % 2), -1 + (i % 3), 0.14, 0.2);
          });
        } else {
          geo = geoFor('muro', (b) => {
            // Tabique soviético de ladrillo
            for (let r = 0; r < 12; r++) {
              for (let k = 0; k < 9; k++) {
                const off = r % 2 ? 0.2 : 0;
                b.color([0.36, 0.17, 0.12], 0.75 + ((r * 3 + k * 5) % 6) * 0.07);
                b.cube(-1.8 + k * 0.42 + off, r * 0.24, 0, 0.4, 0.22, 0.42);
              }
            }
            b.color([0.8, 0.78, 0.7], 0.5).cube(0, 1.3, 0.22, 1.2, 0.5, 0.01);
          });
        }
        const v = this.add(key, 'nodo', geo, n.x, nav.heightAt(n.x, n.z), n.z, n.kind === 'muro' ? this.wallRot(n.x, n.z) : (hashStr(key) % 628) / 100, n.kind === 'derrumbe' ? 2 : 0.8);
        v.kind = n.kind;
      }
    }
    for (const key of [...this.views.keys()]) if (!seen.has(key)) this.remove(key);
  }

  /** Orienta el tabique atravesado en el túnel. */
  private wallRot(x: number, z: number): number {
    const g: [number, number] = [0, 0];
    this.sim.world.layout.sdf.gradient(x + 0.7, z + 0.4, g);
    return Math.atan2(g[0], g[1]) + Math.PI / 2;
  }

  // --- Fantasma de construcción ---------------------------------------------------

  setGhost(defId: string | null, x = 0, z = 0, rot = 0, ok = true) {
    if (!defId) {
      if (this.ghost) {
        this.ghost.removeFromParent();
        this.ghost = null;
      }
      return;
    }
    const def = BUILDS[defId];
    const geo = propGeometry(def.prop, def.variant ?? 0);
    if (!this.ghost) {
      this.ghost = new THREE.Mesh(geo, this.ghostMat);
      this.ghost.renderOrder = 5;
      this.group.add(this.ghost);
    } else if (this.ghost.geometry !== geo) this.ghost.geometry = geo;
    this.ghost.position.set(x, this.sim.world.nav.heightAt(x, z) + 0.02, z);
    this.ghost.rotation.y = rot;
    this.ghostMat.color.setHex(ok ? 0x7dff9a : 0xff5a4a);
  }

  dispose() {
    for (const key of [...this.views.keys()]) this.remove(key);
    this.setGhost(null);
    this.group.removeFromParent();
  }
}

/**
 * Lo que se ve en el suelo cuando alguien suelta cosas: el arma o la herramienta
 * tirada tal cual, una caja de munición, un botiquín… y un saco para el resto.
 */
function dropGeometry(d: Drop): THREE.BufferGeometry {
  let model: string | null = null;
  let best = -1;
  let ammo = false;
  let med = false;
  let other = false;
  for (const s of d.items) {
    const def = ITEMS[s.id];
    if (!def) continue;
    if (def.model && hasHeld(def.model) && (def.weapon || def.tool || def.light)) {
      if (def.price > best) {
        best = def.price;
        model = def.model;
      }
    } else if (def.kind === 'municion') ammo = true;
    else if (def.kind === 'medicina') med = true;
    else other = true;
  }
  const key = `suelto:${model ?? ''}:${ammo ? 1 : 0}${med ? 1 : 0}${other || (!model && !ammo && !med) ? 1 : 0}`;
  return geoFor(key, (b) => {
    const sack = other || (!model && !ammo && !med);
    if (sack) {
      b.color([0.34, 0.28, 0.18]);
      b.sphere(model ? -0.32 : 0, 0.16, model ? 0.1 : 0, 0.26, 0.17, 0.22, 8, 5);
      b.color([0.2, 0.16, 0.1]).cyl(model ? -0.32 : 0, 0.3, model ? 0.1 : 0, 0.05, 0.08, 0.08, 6);
    }
    if (model) {
      // Tumbada de costado sobre el suelo
      const gun = !!heldGrip(model)?.gun;
      b.push().translate(0.12, 0.035, -0.1);
      if (gun) b.rotateZ(Math.PI / 2);
      else b.rotateX(Math.PI / 2).rotateY(Math.PI / 2);
      drawHeld(b, model);
      b.pop();
    }
    if (ammo) {
      // Caja de munición
      b.color([0.22, 0.27, 0.16]).cube(0.3, 0, 0.26, 0.3, 0.16, 0.16);
      b.color([0.16, 0.2, 0.12]).cube(0.3, 0.16, 0.26, 0.31, 0.03, 0.17);
      b.color([0.72, 0.58, 0.2]).cube(0.3, 0.06, 0.345, 0.12, 0.05, 0.006);
    }
    if (med) {
      b.color([0.86, 0.84, 0.78]).cube(-0.05, 0, 0.34, 0.26, 0.14, 0.18);
      b.color([0.62, 0.1, 0.08]).cube(-0.05, 0.14, 0.34, 0.1, 0.006, 0.035).cube(-0.05, 0.14, 0.34, 0.035, 0.006, 0.1);
    }
  });
}

export type { Building };
