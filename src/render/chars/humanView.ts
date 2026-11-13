// Vista de un personaje humano: malla con esqueleto, animador y arma en mano.
// Las armas largas y las de dos manos mandan sobre los brazos: el animador
// decide dónde está el arma y aquí se resuelven hombro, codo y muñeca para
// que cada mano llegue a su empuñadura (cinemática inversa de dos huesos).

import * as THREE from 'three';
import type { Look } from '../../data/looks';
import { cloneProbeMaterial, probeMaterial, setProbe } from '../materials';
import { heldGeometry, heldGrip, type Grip } from '../kit/weapons';
import { HumanAnimator, defaultAnimInput, type AnimInput } from './anim';
import { HAND, HB, HUMAN_BONES, buildHumanoid } from './humanoid';
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

/** Giro del arma dentro de la mano: el eje +Z del arma sale por los nudillos y el +Y por el pulgar. */
const HAND_ROT = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
const HAND_ROT_INV = HAND_ROT.clone().invert();
/** Centro del puño respecto a la muñeca (mano derecha; en la izquierda cambia el signo de x). */
const FIST_Y = HAND.knuckle - HAND.wrist + 0.004;
const GRIP_GUN = new THREE.Vector3(0.03, -0.094, 0.048);
const GRIP_BAR = new THREE.Vector3(0.033, FIST_Y, 0);
/** Hueco del hombro donde se apoya la culata y punto ante el pecho donde se encara la pistola (espacio del pecho). */
const POCKET = new THREE.Vector3(-0.118, 0.13, 0.085);
const PISTOL_ANCHOR = new THREE.Vector3(-0.03, 0.14, 0.08);
const POLE_R = new THREE.Vector3(-0.5, -0.8, -0.33).normalize();
const POLE_R_AIM = new THREE.Vector3(-0.8, -0.55, -0.2).normalize();
const POLE_L = new THREE.Vector3(0.42, -0.9, -0.1).normalize();

const m1 = new THREE.Matrix4();
const m2 = new THREE.Matrix4();
const meshInv = new THREE.Matrix4();
const chestM = new THREE.Matrix4();
const chestQ = new THREE.Quaternion();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const q3 = new THREE.Quaternion();
const qUa = new THREE.Quaternion();
const qFa = new THREE.Quaternion();
const qPar = new THREE.Quaternion();
const qHand = new THREE.Quaternion();
const qWeapon = new THREE.Quaternion();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const vS = new THREE.Vector3();
const vE = new THREE.Vector3();
const vW = new THREE.Vector3();
const vX = new THREE.Vector3();
const vY = new THREE.Vector3();
const vZ = new THREE.Vector3();
const vPos = new THREE.Vector3();
const vDir = new THREE.Vector3();
const vUp = new THREE.Vector3();
const vOff = new THREE.Vector3();
const vPole = new THREE.Vector3();
const vScale = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** Grosor de la prenda de arriba, para que lo enfundado no la atraviese. */
const TOP_BULK: Partial<Record<Look['top'], number>> = { chaqueton: 0.032, abrigo: 0.024, cuero: 0.018 };

/** Cuaternión a partir de tres ejes ortonormales (columnas x, y, z). */
function basisQuat(x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3, out: THREE.Quaternion) {
  m1.makeBasis(x, y, z);
  return out.setFromRotationMatrix(m1);
}

/**
 * Orientación de un arma dado su eje largo y una pista de hacia dónde mira el
 * lomo (armas de fuego: +Z largo, +Y lomo) o el filo (astas: +Y largo, +Z filo).
 */
function weaponQuat(gun: boolean, long: THREE.Vector3, hint: THREE.Vector3, out: THREE.Quaternion) {
  vZ.copy(long).normalize();
  vY.copy(hint).addScaledVector(vZ, -hint.dot(vZ));
  if (vY.lengthSq() < 1e-6) vY.set(0, 1, 0).addScaledVector(vZ, -vZ.y);
  vY.normalize();
  if (gun) {
    vX.crossVectors(vY, vZ);
    return basisQuat(vX, vY, vZ, out);
  }
  // Asta: largo = +Y, filo = +Z
  vX.crossVectors(vZ, vY);
  return basisQuat(vX, vZ, vY, out);
}

export class HumanView {
  readonly group = new THREE.Group();
  readonly input: AnimInput;
  mesh!: THREE.SkinnedMesh;
  bones!: THREE.Bone[];
  animator!: HumanAnimator;
  readonly material: THREE.MeshStandardMaterial;
  private key = '';
  private look!: Look;
  private weaponId: string | null = null;
  private weapon: THREE.Mesh | null = null;
  private grip: Grip | null = null;
  private backId: string | null = null;
  private back: THREE.Mesh | null = null;
  /** Pesos suavizados de la cinemática inversa de cada brazo. */
  private ikMain = 0;
  private ikOff = 0;
  private armL1 = 0.3;
  private armL2 = 0.26;
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
    this.look = look;
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
      this.armL1 = bones[HB.forearmR].position.length();
      this.armL2 = bones[HB.handR].position.length();
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
    this.placeBack();
  }

  /** Arma o herramienta en la mano derecha (null = nada). */
  setWeapon(id: string | null) {
    if (id === this.weaponId) return;
    this.weaponId = id;
    if (this.weapon) {
      this.weapon.removeFromParent();
      this.weapon = null;
    }
    this.grip = null;
    const geo = id ? heldGeometry(id) : null;
    if (!geo) return;
    this.grip = heldGrip(id!);
    const m = new THREE.Mesh(geo, this.material);
    m.position.copy(this.grip?.gun ? GRIP_GUN : GRIP_BAR);
    m.quaternion.copy(HAND_ROT);
    m.castShadow = true;
    this.bones[HB.handR].add(m);
    this.weapon = m;
  }

  /** Arma enfundada: las largas cruzadas a la espalda, las cortas al cinto. */
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
    m.castShadow = true;
    this.back = m;
    this.placeBack();
  }

  private placeBack() {
    const m = this.back;
    if (!m || !this.backId) return;
    const g = heldGrip(this.backId);
    const gun = !!g?.gun;
    const mid = g?.mid ?? 0.15;
    const bulk = TOP_BULK[this.look.top] ?? 0.012;
    if (mid < 0.12) {
      // Al cinto, en la cadera derecha, con la boca o la hoja hacia abajo
      this.bones[HB.hips].add(m);
      vDir.set(-0.06, gun ? -0.96 : -1, gun ? -0.26 : -0.12).normalize();
      weaponQuat(gun, vDir, gun ? v1.set(0, -0.2, -1) : v1.set(0, 0, -1), m.quaternion);
      m.position.set(-(0.2 + bulk + (this.look.build > 0 ? this.look.build * 0.02 : 0)), gun ? 0.02 : 0.0, 0.01).addScaledVector(vDir, gun ? 0.0 : -0.06);
      return;
    }
    this.bones[HB.chest].add(m);
    const z = this.look.backpack !== undefined ? -0.37 : -(0.14 + bulk + (this.look.vest !== undefined ? 0.03 : 0));
    // Eje largo en diagonal: la boca (o la cabeza del arma) asoma sobre el hombro izquierdo
    vDir.set(0.5, 0.86, 0).normalize();
    weaponQuat(gun, vDir, v1.set(-0.86, 0.5, 0), m.quaternion);
    m.position.set(0.02, 0.05, z).addScaledVector(vDir, -mid);
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
    const inp = this.input;
    const g = this.grip;
    const hold = inp.hold;
    const upright = inp.pose !== 'ko' && inp.pose !== 'muerto' && inp.pose !== 'cargado' && inp.pose !== 'gateo' && inp.pose !== 'tumbado';
    const armsFree = inp.work === 'nada' || inp.work === 'guardia';
    const long = hold === 'fusil' || hold === 'dos';
    // Qué brazos sigue el arma
    let wantMain = 0;
    let wantOff = 0;
    if (this.weapon && g && upright) {
      if (long && armsFree) {
        wantMain = 1;
        wantOff = g.off && !inp.carrying ? 1 : 0;
        if (inp.carrying) wantMain = 0;
      } else if (long && g.off) {
        // Trabajando con una herramienta de dos manos: la izquierda acompaña
        wantOff = 1;
      } else if (hold === 'pistola' && armsFree) {
        wantMain = inp.aim;
        wantOff = g.off && !inp.carrying ? inp.aim : 0;
      }
    }
    const k = 1 - Math.exp(-12 * dt);
    this.ikMain += (wantMain - this.ikMain) * k;
    this.ikOff += (wantOff - this.ikOff) * k;
    inp.armed = !!this.weapon && inp.pose !== 'ko' && inp.pose !== 'muerto';
    inp.offHand = this.ikOff > 0.5 ? (g?.offMode === 'bajo' ? 0.9 : 1) : 0;
    this.animator.update(dt, inp);
    if (this.ikMain < 0.01 && this.ikOff < 0.01) return;
    this.solveArms(g!);
  }

  /** Lleva las manos al arma. Todo se calcula en el espacio del modelo (el de la malla). */
  private solveArms(g: Grip) {
    const bones = this.bones;
    const an = this.animator;
    const inp = this.input;
    bones[0].updateMatrixWorld(true);
    meshInv.copy(this.mesh.matrixWorld).invert();
    chestM.multiplyMatrices(meshInv, bones[HB.chest].matrixWorld);
    chestM.decompose(v1, chestQ, vScale);
    const aw = an.aimWeight;
    const rifle = inp.hold === 'fusil';
    const pistol = inp.hold === 'pistola';
    if (this.ikMain > 0.01) {
      // Postura del arma: la del animador (espacio del pecho) y, al apuntar, encarada hacia el blanco
      const wk = an.weapon;
      vPos.copy(wk.p).applyMatrix4(chestM);
      vDir.copy(wk.d).applyQuaternion(chestQ);
      vUp.copy(wk.u).applyQuaternion(chestQ);
      if ((rifle || pistol) && aw > 0.001) {
        // Rumbo de tiro en el espacio del modelo: al frente, con la elevación de la puntería
        v2.set(0, Math.sin(this.aimPitch), Math.cos(this.aimPitch));
        const anchor = rifle ? POCKET : PISTOL_ANCHOR;
        v3.copy(anchor).applyMatrix4(chestM).addScaledVector(v2, rifle ? (g.stock ?? 0.32) : g.offMode === 'bajo' ? 0.36 : 0.46);
        if (rifle) v3.y += 0.012;
        if (pistol) {
          vPos.copy(v3);
          vDir.copy(v2);
          vUp.copy(Y_AXIS);
        } else {
          vPos.lerp(v3, aw);
          vDir.lerp(v2, aw).normalize();
          vUp.lerp(Y_AXIS, aw).normalize();
        }
        // Retroceso: el arma recula y la boca sube
        const r = an.recoil * aw;
        if (r > 0.001) {
          vPos.addScaledVector(vDir, -0.035 * r);
          vDir.y += 0.07 * r;
          vDir.normalize();
        }
      }
      weaponQuat(g.gun, vDir, vUp, qWeapon);
      // De la postura del arma a la de la mano que la empuña
      qHand.copy(qWeapon).multiply(HAND_ROT_INV);
      v1.copy(g.gun ? GRIP_GUN : GRIP_BAR).applyQuaternion(qHand);
      vW.copy(vPos).sub(v1);
      vPole.copy(rifle && aw > 0.5 ? POLE_R_AIM : POLE_R).applyQuaternion(chestQ);
      this.solveArm(-1, vW, qHand, vPole, this.ikMain);
      bones[HB.shoulderR].updateMatrixWorld(true);
    }
    if (this.ikOff > 0.01 && g.off && this.weapon) {
      // La mano de apoyo va al punto del arma tal y como ha quedado
      m2.multiplyMatrices(meshInv, this.weapon.matrixWorld);
      m2.decompose(vPos, qWeapon, vScale);
      const side = 1;
      const sh = bones[HB.upperArmL];
      m1.multiplyMatrices(meshInv, sh.matrixWorld);
      vS.setFromMatrixPosition(m1);
      const reach = (this.armL1 + this.armL2) * 0.985;
      const under = g.offMode === 'bajo';
      if (under) {
        // Palma hacia arriba bajo el guardamanos, con la muñeca caída hacia el codo
        const rho = 0.42;
        vX.set(-Math.sin(rho), -Math.cos(rho), 0);
        vY.set(Math.cos(rho), -Math.sin(rho), 0);
        vZ.set(0, 0, 1);
        basisQuat(vX, vY, vZ, q1);
        qHand.copy(qWeapon).multiply(q1);
      } else {
        qHand.copy(qWeapon).multiply(HAND_ROT_INV);
      }
      // Centro del agarre respecto a la muñeca izquierda
      v2.set(-side * (under ? HAND.palm + (g.offR ?? 0.024) : GRIP_BAR.x), FIST_Y, 0).applyQuaternion(qHand);
      const axis = g.gun ? 2 : 1;
      const base = an.weapon.slide;
      for (let i = 0; i < 6; i++) {
        // Si no llega, la mano se desliza hacia la principal
        const t = base * (1 - i * 0.13);
        vOff.set(g.off[0], g.off[1], g.off[2]);
        vOff.setComponent(axis, vOff.getComponent(axis) * t);
        vW.copy(vOff).applyQuaternion(qWeapon).add(vPos).sub(v2);
        if (vW.distanceTo(vS) <= reach) break;
      }
      vPole.copy(POLE_L).applyQuaternion(chestQ);
      this.solveArm(1, vW, qHand, vPole, this.ikOff);
    }
  }

  /**
   * Cinemática inversa de un brazo: coloca la muñeca en `wrist` con la mano
   * orientada según `handQ` (espacio del modelo) y el codo hacia `pole`.
   */
  private solveArm(side: 1 | -1, wrist: THREE.Vector3, handQ: THREE.Quaternion, pole: THREE.Vector3, weight: number) {
    const bones = this.bones;
    const sh = bones[side > 0 ? HB.shoulderL : HB.shoulderR];
    const ua = bones[side > 0 ? HB.upperArmL : HB.upperArmR];
    const fa = bones[side > 0 ? HB.forearmL : HB.forearmR];
    const hd = bones[side > 0 ? HB.handL : HB.handR];
    const L1 = this.armL1;
    const L2 = this.armL2;
    // El hombro se adelanta si el blanco queda lejos
    m1.multiplyMatrices(meshInv, ua.matrixWorld);
    vS.setFromMatrixPosition(m1);
    const far = THREE.MathUtils.clamp((vS.distanceTo(wrist) / (L1 + L2) - 0.8) / 0.2, 0, 1);
    if (far > 0) {
      q1.setFromAxisAngle(Y_AXIS, -side * 0.5 * far * weight);
      sh.quaternion.multiply(q1);
      sh.updateMatrixWorld(true);
      m1.multiplyMatrices(meshInv, ua.matrixWorld);
      vS.setFromMatrixPosition(m1);
    }
    m1.multiplyMatrices(meshInv, sh.matrixWorld);
    m1.decompose(v1, qPar, vScale);
    // Triángulo hombro-codo-muñeca
    v1.subVectors(wrist, vS);
    const dist = THREE.MathUtils.clamp(v1.length(), Math.abs(L1 - L2) + 0.02, L1 + L2 - 0.004);
    v1.normalize();
    vW.copy(vS).addScaledVector(v1, dist);
    const cosA = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    v2.copy(pole).addScaledVector(v1, -pole.dot(v1));
    if (v2.lengthSq() < 1e-6) v2.set(0, -1, 0).addScaledVector(v1, v1.y);
    v2.normalize();
    vE.copy(vS).addScaledVector(v1, L1 * cosA).addScaledVector(v2, L1 * sinA);
    // Brazo: -Y hacia el codo, X = eje de la bisagra
    vX.crossVectors(v1, v2).normalize();
    vY.subVectors(vS, vE).normalize();
    vZ.crossVectors(vX, vY).normalize();
    vX.crossVectors(vY, vZ);
    basisQuat(vX, vY, vZ, qUa);
    const hx = v3.copy(vX);
    vY.subVectors(vE, vW).normalize();
    vZ.crossVectors(hx, vY).normalize();
    vX.crossVectors(vY, vZ);
    basisQuat(vX, vY, vZ, qFa);
    // La mitad del giro de muñeca la absorbe el antebrazo (pronación)
    q1.copy(qFa).invert().multiply(handQ);
    q2.set(0, q1.y, 0, q1.w);
    if (q2.lengthSq() > 1e-8) {
      q2.normalize();
      q3.set(0, 0, 0, 1).slerp(q2, 0.5);
      qFa.multiply(q3);
    }
    // A espacio local de cada hueso y mezcla con la animación
    q1.copy(qPar).invert().multiply(qUa);
    ua.quaternion.slerp(q1, weight);
    q1.copy(qUa).invert().multiply(qFa);
    fa.quaternion.slerp(q1, weight);
    q1.copy(qFa).invert().multiply(handQ);
    hd.quaternion.slerp(q1, weight);
    ua.updateMatrixWorld(true);
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
