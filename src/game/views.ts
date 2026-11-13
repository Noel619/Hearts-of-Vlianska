// Vistas: sincroniza los personajes, edificios y objetos de la simulación con
// sus modelos 3D (creación, destrucción, animación, luz de sonda).

import * as THREE from 'three';
import { CREATURES } from '../data/criaturas';
import { BUILDS } from '../data/edificios';
import { ITEMS } from '../data/items';
import { hashStr } from '../core/math';
import { HumanAnimator, defaultAnimInput, type AnimInput } from '../render/chars/anim';
import { QUAD_BONES, QuadAnimator, buildBrute, buildQuadruped, type QuadInput } from '../render/chars/creatures';
import { HUMAN_BONES } from '../render/chars/humanoid';
import { HumanView } from '../render/chars/humanView';
import { makeSkeleton } from '../render/chars/skin';
import { MeshBuilder } from '../render/geo';
import { drawProp, propGeometry } from '../render/kit/core';
import { cloneProbeMaterial, probeMaterial, setProbe } from '../render/materials';
import { effectiveLook, limpSide, weaponItem } from '../sim/chars';
import type { Sim } from '../sim/sim';
import type { Building, Char } from '../sim/types';

const RANGE = 150;
const out = new Float32Array(6);

interface CharView {
  group: THREE.Group;
  kind: 'humano' | 'cuadrupedo' | 'bipedo';
  human?: HumanView;
  quad?: { anim: QuadAnimator; input: QuadInput; mat: THREE.MeshStandardMaterial };
  brute?: { anim: HumanAnimator; input: AnimInput; mat: THREE.MeshStandardMaterial };
  sig: string;
  probe: Float32Array;
  y: number;
}

const creatureGeo = new Map<string, THREE.BufferGeometry>();
let creatureMat: THREE.MeshStandardMaterial | null = null;

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
    const v: CharView = { group: g, kind: 'humano', sig: '', probe: new Float32Array([0.2, 0.2, 0.25, 0, 0.3, 0]), y: 0 };
    if (c.kind === 'humano') {
      const look = effectiveLook(c)!;
      v.human = new HumanView(look);
      g.add(v.human.group);
    } else {
      const def = CREATURES[c.kind];
      if (!creatureMat) creatureMat = probeMaterial({ roughness: 0.75 });
      const mat = cloneProbeMaterial(creatureMat);
      let geo = creatureGeo.get(c.kind);
      if (def.shape === 'cuadrupedo') {
        if (!geo) creatureGeo.set(c.kind, (geo = buildQuadruped(def)));
        const { bones, skeleton, root } = makeSkeleton(QUAD_BONES);
        const mesh = new THREE.SkinnedMesh(geo, mat);
        mesh.add(root);
        mesh.bind(skeleton);
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        g.add(mesh);
        v.kind = 'cuadrupedo';
        v.quad = { anim: new QuadAnimator(bones, c.id), input: { speed: 0, attackT: 0, attacking: false, sinceHit: 9, dead: false, seed: c.id }, mat };
      } else {
        if (!geo) creatureGeo.set(c.kind, (geo = buildBrute(def)));
        const { bones, skeleton, root } = makeSkeleton(HUMAN_BONES);
        const mesh = new THREE.SkinnedMesh(geo, mat);
        mesh.add(root);
        mesh.bind(skeleton);
        mesh.frustumCulled = false;
        mesh.castShadow = true;
        g.add(mesh);
        v.kind = 'bipedo';
        v.brute = { anim: new HumanAnimator(bones, c.id), input: defaultAnimInput(c.id), mat };
      }
      g.scale.setScalar(def.scale);
    }
    this.group.add(g);
    this.views.set(c.id, v);
    return v;
  }

  private destroy(id: number) {
    const v = this.views.get(id);
    if (!v) return;
    v.human?.dispose();
    v.quad?.mat.dispose();
    v.brute?.mat.dispose();
    v.group.removeFromParent();
    this.views.delete(id);
  }

  update(dt: number, fx: number, fz: number) {
    const sim = this.sim;
    const nav = sim.world.nav;
    const field = sim.world.field;
    this.frame++;
    const seen = new Set<number>();
    for (const c of sim.state.chars) {
      const d = Math.hypot(c.x - fx, c.z - fz);
      if (d > RANGE) continue;
      seen.add(c.id);
      let v = this.views.get(c.id);
      if (!v) v = this.create(c);
      // Posición
      let y = nav.heightAt(c.x, c.z);
      let x = c.x;
      let z = c.z;
      let face = c.face;
      if (c.carriedBy) {
        const o = sim.char(c.carriedBy);
        if (o) {
          y = nav.heightAt(o.x, o.z) + 1.28;
          x = o.x - Math.sin(o.face) * 0.16;
          z = o.z + Math.cos(o.face) * 0.16;
          face = o.face + Math.PI;
        }
      } else if (c.pose === 'tumbado' && c.ai.sub !== '') y += 0.32;
      v.y += (y - v.y) * Math.min(1, dt * 14);
      if (Math.abs(y - v.y) > 1.5) v.y = y;
      // Sonda de luz (escalonada entre fotogramas)
      if ((this.frame + c.id) % 5 === 0) {
        field.sample(c.x, y + 1.1, c.z, 0, 1, 0, false, out);
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
        const inp = h.input;
        inp.speed = c.speed;
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
        h.aimYaw = c.face;
        h.place(x, v.y, z, face);
        h.setProbe(p[0], p[1], p[2], p[3], p[4], p[5]);
        // Lejos de la cámara se anima a media frecuencia
        if (d < 70 || (this.frame + c.id) % 2 === 0) h.update(d < 70 ? dt : dt * 2);
      } else if (v.quad) {
        const q = v.quad;
        q.input.speed = c.speed;
        q.input.attacking = c.atkT >= 0;
        q.input.attackT = Math.max(0, c.atkT);
        q.input.sinceHit = c.sinceHit;
        q.input.dead = c.st !== 'ok';
        v.group.position.set(x, v.y, z);
        v.group.rotation.y = Math.PI / 2 - face;
        setProbe(q.mat, p[0], p[1], p[2], p[3], p[4], p[5]);
        q.anim.update(dt, q.input);
      } else if (v.brute) {
        const b = v.brute;
        const inp = b.input;
        inp.speed = c.speed / CREATURES[c.kind].scale;
        inp.pose = c.st === 'muerto' ? 'muerto' : c.st === 'ko' ? 'ko' : 'normal';
        inp.attack = c.atkT >= 0 ? (c.id % 2 ? 'golpe' : 'tajo') : null;
        inp.attackT = Math.max(0, c.atkT);
        inp.sinceHit = c.sinceHit;
        inp.hitSide = c.hitSide;
        inp.sneak = c.kind === 'sheptun' && c.speed < 1;
        v.group.position.set(x, v.y, z);
        v.group.rotation.y = Math.PI / 2 - face;
        setProbe(b.mat, p[0], p[1], p[2], p[3], p[4], p[5]);
        b.anim.update(dt, inp);
      }
    }
    for (const id of this.views.keys()) if (!seen.has(id)) this.destroy(id);
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
      if (!this.views.get(key)) {
        const geo = geoFor('saco', (b) => {
          b.color([0.34, 0.28, 0.18]);
          b.sphere(0, 0.16, 0, 0.26, 0.17, 0.22, 8, 5);
          b.color([0.2, 0.16, 0.1]).cyl(0, 0.3, 0, 0.05, 0.08, 0.08, 6);
        });
        this.add(key, 'suelto', geo, d.x, nav.heightAt(d.x, d.z), d.z, (hashStr(key) % 628) / 100, 0.4);
      }
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

export function itemModelGeometry(id: string): THREE.BufferGeometry | null {
  const def = ITEMS[id];
  if (!def) return null;
  void drawProp;
  return null;
}

export type { Building };
