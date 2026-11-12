// Vista de un personaje humano: malla con esqueleto, animador y arma en mano.

import * as THREE from 'three';
import type { Look } from '../../data/looks';
import { cloneProbeMaterial, probeMaterial, setProbe } from '../materials';
import { heldGeometry } from '../kit/weapons';
import { HumanAnimator, defaultAnimInput, type AnimInput } from './anim';
import { HB, HUMAN_BONES, buildHumanoid } from './humanoid';
import { makeSkeleton } from './skin';

let baseMaterial: THREE.MeshStandardMaterial | null = null;
function getBase() {
  if (!baseMaterial) baseMaterial = probeMaterial({ roughness: 0.86 });
  return baseMaterial;
}

const geoCache = new Map<string, { geo: THREE.BufferGeometry; refs: number }>();

function lookKey(l: Look): string {
  return JSON.stringify(l);
}

const HAND_ROT = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const tmpQ = new THREE.Quaternion();
const tmpQ2 = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpM = new THREE.Matrix4();
const Z = new THREE.Vector3(0, 0, 1);

export class HumanView {
  readonly group = new THREE.Group();
  readonly input: AnimInput;
  mesh!: THREE.SkinnedMesh;
  bones!: THREE.Bone[];
  animator!: HumanAnimator;
  readonly material: THREE.MeshStandardMaterial;
  private key = '';
  private weaponId: string | null = null;
  private weapon: THREE.Mesh | null = null;
  private backId: string | null = null;
  private back: THREE.Mesh | null = null;
  /** Dirección de puntería en el mundo (ángulo en XZ) y elevación. */
  aimYaw = 0;
  aimPitch = 0;

  constructor(look: Look) {
    this.material = cloneProbeMaterial(getBase());
    this.input = defaultAnimInput(look.seed);
    this.setLook(look);
  }

  setLook(look: Look) {
    const key = lookKey(look);
    if (key === this.key) return;
    const old = this.key;
    this.key = key;
    let entry = geoCache.get(key);
    if (!entry) {
      entry = { geo: buildHumanoid(look), refs: 0 };
      geoCache.set(key, entry);
    }
    entry.refs++;
    if (this.mesh) {
      this.mesh.geometry = entry.geo;
      releaseGeo(old);
    } else {
      const { bones, skeleton, root } = makeSkeleton(HUMAN_BONES);
      this.bones = bones;
      const mesh = new THREE.SkinnedMesh(entry.geo, this.material);
      mesh.add(root);
      mesh.bind(skeleton);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      this.mesh = mesh;
      this.group.add(mesh);
      this.animator = new HumanAnimator(bones, look.seed);
    }
    this.group.scale.setScalar(look.height);
  }

  /** Arma o herramienta en la mano derecha (null = nada). */
  setWeapon(id: string | null) {
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.weapon) {
      this.weapon.removeFromParent();
      this.weapon = null;
    }
    const geo = id ? heldGeometry(id) : null;
    if (!geo) return;
    const m = new THREE.Mesh(geo, this.material);
    m.position.set(0.012, -0.075, 0.012);
    m.quaternion.copy(HAND_ROT);
    m.castShadow = true;
    this.bones[HB.handR].add(m);
    this.weapon = m;
  }

  /** Arma colgada a la espalda. */
  setBack(id: string | null) {
    if (id === this.backId) return;
    this.backId = id;
    if (this.back) {
      this.back.removeFromParent();
      this.back = null;
    }
    const geo = id ? heldGeometry(id) : null;
    if (!geo) return;
    const m = new THREE.Mesh(geo, this.material);
    m.position.set(0.02, 0.02, -0.19);
    m.rotation.set(0, Math.PI / 2, 2.3, 'YXZ');
    this.bones[HB.chest].add(m);
    this.back = m;
  }

  setProbe(r: number, g: number, b: number, dx: number, dy: number, dz: number) {
    setProbe(this.material, r, g, b, dx, dy, dz);
  }

  /** Coloca al personaje: posición en el mundo y rumbo (ángulo matemático en XZ). */
  place(x: number, y: number, z: number, facing: number) {
    this.group.position.set(x, y, z);
    this.group.rotation.y = Math.PI / 2 - facing;
  }

  update(dt: number) {
    this.animator.update(dt, this.input);
    // Al apuntar, el arma se alinea con la dirección de tiro aunque el antebrazo no lo esté
    const w = this.weapon;
    if (w) {
      const aw = this.animator.aimWeight;
      if (aw > 0.02 && (this.input.hold === 'fusil' || this.input.hold === 'pistola')) {
        this.group.updateMatrixWorld(true);
        const hand = this.bones[HB.handR];
        hand.getWorldQuaternion(tmpQ);
        // Orientación deseada en el mundo: +Z del arma hacia la puntería
        const yaw = Math.PI / 2 - this.aimYaw;
        tmpV.set(Math.sin(yaw) * Math.cos(this.aimPitch), Math.sin(this.aimPitch), Math.cos(yaw) * Math.cos(this.aimPitch));
        tmpM.lookAt(new THREE.Vector3(0, 0, 0), tmpV.clone().negate(), THREE.Object3D.DEFAULT_UP);
        tmpQ2.setFromRotationMatrix(tmpM);
        // Mundo -> local de la mano
        tmpQ.invert().multiply(tmpQ2);
        w.quaternion.copy(HAND_ROT).slerp(tmpQ, aw);
      } else {
        w.quaternion.copy(HAND_ROT);
      }
    }
  }

  dispose() {
    this.group.removeFromParent();
    releaseGeo(this.key);
    this.material.dispose();
  }
}

function releaseGeo(key: string) {
  const e = geoCache.get(key);
  if (!e) return;
  e.refs--;
  if (e.refs <= 0) {
    e.geo.dispose();
    geoCache.delete(key);
  }
}

void Z;
