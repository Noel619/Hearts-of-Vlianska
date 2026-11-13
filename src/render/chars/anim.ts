// Animación procedural de los humanoides: no hay clips grabados. Cada
// fotograma se calcula una pose objetivo (ángulos por hueso) a partir del
// estado del personaje y se suaviza hacia ella, de modo que cualquier cambio
// de estado produce una transición continua.

import * as THREE from 'three';
import { clamp01, hash2, lerp, smoothstep } from '../../core/math';
import { HB } from './humanoid';

export type WeaponHold = 'nada' | 'una' | 'dos' | 'fusil' | 'pistola';
export type BodyPose = 'normal' | 'sentado' | 'sentadoSuelo' | 'arrodillado' | 'cuclillas' | 'tumbado' | 'ko' | 'muerto' | 'cargado' | 'gateo';
export type WorkAnim =
  | 'nada'
  | 'martillo'
  | 'pico'
  | 'operar'
  | 'cocinar'
  | 'rebuscar'
  | 'vendar'
  | 'comer'
  | 'hablar'
  | 'guitarra'
  | 'calentarse'
  | 'escribir'
  | 'cargarCaja'
  | 'rezar'
  | 'guardia';
export type AttackAnim = 'tajo' | 'golpe' | 'estocada' | 'punetazo';

export interface AnimInput {
  /** Velocidad horizontal (m/s). */
  speed: number;
  sneak: boolean;
  /** Cojera: -1 pierna izquierda, 1 derecha, 0 ninguna. */
  limp: number;
  hold: WeaponHold;
  /** Apuntando (0 o 1; se suaviza dentro). */
  aim: number;
  pose: BodyPose;
  work: WorkAnim;
  /** Lleva a alguien al hombro. */
  carrying: boolean;
  /** Ataque en curso: tipo y progreso 0..1 (o null). */
  attack: AttackAnim | null;
  attackT: number;
  /** Segundos desde el último disparo, golpe recibido y bloqueo. */
  sinceFire: number;
  sinceHit: number;
  hitSide: number;
  sinceBlock: number;
  seed: number;
  /** Lleva algo empuñado en la mano derecha (cierra el puño). */
  armed: boolean;
  /** Cierre de la mano izquierda (0 relajada … 1 puño), cuando apoya en el arma. */
  offHand: number;
  /** Lleva un farol en la mano izquierda. */
  lantern: boolean;
}

export function defaultAnimInput(seed = 1): AnimInput {
  return { speed: 0, sneak: false, limp: 0, hold: 'nada', aim: 0, pose: 'normal', work: 'nada', carrying: false, attack: null, attackT: 0, sinceFire: 9, sinceHit: 9, hitSide: 0, sinceBlock: 9, seed, armed: false, offHand: 0, lantern: false };
}

const NB = 19;
const B = HB;

class Pose {
  e = new Float32Array(NB * 3);
  y = 0.98;
  rx = 0;
  ry = 0;
  rz = 0;
  fz = 0;
  reset() {
    this.e.fill(0);
    this.y = 0.98;
    this.rx = this.ry = this.rz = this.fz = 0;
  }
  set(b: number, x: number, y = 0, z = 0) {
    this.e[b * 3] = x;
    this.e[b * 3 + 1] = y;
    this.e[b * 3 + 2] = z;
  }
  add(b: number, x: number, y = 0, z = 0) {
    this.e[b * 3] += x;
    this.e[b * 3 + 1] += y;
    this.e[b * 3 + 2] += z;
  }
  /** Mezcla el hueso hacia un valor con peso w. */
  mix(b: number, w: number, x: number, y = 0, z = 0) {
    const i = b * 3;
    this.e[i] += (x - this.e[i]) * w;
    this.e[i + 1] += (y - this.e[i + 1]) * w;
    this.e[i + 2] += (z - this.e[i + 2]) * w;
  }
  x(b: number) {
    return this.e[b * 3];
  }
}

const T = new Pose();

const tmpE = new THREE.Euler();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Posturas del arma en el espacio del pecho (x a la izquierda del personaje,
 * y arriba, z al frente): dónde queda la empuñadura, hacia dónde apunta el
 * eje largo y hacia dónde mira el lomo (armas de fuego) o el filo (astas).
 * Los brazos se resuelven después para que las manos lleguen al arma.
 */
interface WKey {
  p: THREE.Vector3;
  d: THREE.Vector3;
  u: THREE.Vector3;
  /** Cuánto se acerca la mano de apoyo a la principal (1 = en su sitio). */
  slide: number;
}
const key = (p: [number, number, number], d: [number, number, number], u: [number, number, number], slide = 1): WKey => ({ p: V(...p), d: V(...d).normalize(), u: V(...u).normalize(), slide });

const RIFLE = {
  // Arma terciada: culata bajo el brazo derecho, boca hacia abajo y a la izquierda
  ready: key([-0.13, -0.1, 0.25], [0.72, -0.42, 0.55], [-0.15, 1, 0.2]),
  // A la carrera: cruzada sobre el pecho, boca arriba
  port: key([-0.13, -0.1, 0.25], [0.74, 0.5, 0.45], [-0.3, 0.6, 0.75]),
  sneak: key([-0.1, -0.02, 0.3], [0.45, -0.3, 0.84], [-0.1, 1, 0.1]),
  wind: key([-0.2, -0.04, 0.14], [0.25, 0.1, 0.96], [0, 1, 0]),
  strike: key([-0.08, 0.02, 0.42], [0.15, 0.25, 0.95], [0, 1, -0.25], 0.8),
  block: key([-0.1, 0.1, 0.3], [0.85, 0.45, 0.25], [0, 0.3, 1]),
};
const POLE = {
  // Asta en guardia: mano atrás junto a la cadera, cabeza del arma arriba y al frente
  ready: key([-0.15, -0.3, 0.2], [0.6, 0.62, 0.5], [0.5, -0.5, 0.7]),
  run: key([-0.17, -0.22, 0.2], [0.55, 0.78, 0.3], [0.5, -0.4, 0.75]),
  golpeWind: key([-0.08, 0.3, 0.08], [0.12, 0.86, -0.5], [0, 0.5, 0.86], 0.8),
  golpeStrike: key([-0.04, -0.12, 0.34], [0.04, -0.22, 0.97], [0, -0.97, -0.22]),
  tajoWind: key([-0.24, 0.02, 0.08], [-0.66, 0.42, -0.62], [-0.6, 0, 0.8], 0.75),
  tajoStrike: key([0.0, -0.1, 0.32], [0.62, -0.08, 0.78], [0.78, 0, -0.62]),
  thrustWind: key([-0.22, -0.14, 0.02], [0.12, 0.12, 0.98], [0, -1, 0.1], 0.9),
  thrustStrike: key([-0.1, -0.06, 0.2], [0.04, 0.3, 0.95], [0, -1, 0.3], 0.62),
  block: key([-0.14, 0.02, 0.28], [0.8, 0.55, 0.22], [0, -0.2, 1]),
};

function blendKey(out: WKey, k: WKey, w: number) {
  if (w <= 0) return;
  out.p.lerp(k.p, w);
  out.d.lerp(k.d, w).normalize();
  out.u.lerp(k.u, w).normalize();
  out.slide += (k.slide - out.slide) * w;
}

const TW: WKey = key([0, 0, 0.3], [0, 0, 1], [0, 1, 0]);
const Q_ID = new THREE.Quaternion();
/** Pulgar cerrado sobre el mango (mano derecha; la izquierda es su espejo). */
const THUMB_GRIP_R = new THREE.Quaternion().setFromUnitVectors(V(0.006, -0.066, 0.042).normalize(), V(0.05, -0.05, -0.004).normalize());
const THUMB_GRIP_L = new THREE.Quaternion(-THUMB_GRIP_R.x, THUMB_GRIP_R.y, THUMB_GRIP_R.z, -THUMB_GRIP_R.w).normalize();

export class HumanAnimator {
  /** Fase del ciclo de paso. */
  phase = 0;
  time = 0;
  private cur = new Float32Array(NB * 3);
  private y = 0.98;
  private rx = 0;
  private ry = 0;
  private rz = 0;
  private fz = 0;
  private aimW = 0;
  private first = true;
  private gripR = 0.15;
  private gripL = 0.15;
  /** Peso de apuntado suavizado (lo usa la vista para orientar el arma). */
  get aimWeight() {
    return this.aimW;
  }
  /** Postura deseada del arma en el espacio del pecho (fusiles y armas a dos manos). */
  readonly weapon: WKey = key([0, 0, 0.3], [0, 0, 1], [0, 1, 0]);
  /** Retroceso del último disparo (0..1) y peso del golpe en curso. */
  recoil = 0;
  striking = 0;

  constructor(
    readonly bones: THREE.Bone[],
    seed: number,
  ) {
    this.phase = hash2(seed, 3, 7) * 6.28;
    this.time = hash2(seed, 5, 9) * 20;
  }

  update(dt: number, s: AnimInput) {
    this.time += dt;
    const t = this.time;
    const sp = s.speed;
    // El ciclo avanza con la distancia recorrida (zancada más larga al correr)
    const stride = s.pose === 'gateo' ? 0.9 : s.sneak ? 1.1 : lerp(1.35, 2.5, smoothstep(2, 5, sp));
    this.phase += (sp * dt * Math.PI * 2) / stride;
    this.aimW += (s.aim - this.aimW) * Math.min(1, dt * 10);
    const p = T;
    p.reset();
    const ph = this.phase;
    const sn = Math.sin(ph);
    const cs = Math.cos(ph);
    const walk = smoothstep(0.04, 0.5, sp);
    const run = smoothstep(2.2, 4.4, sp);
    const idle = 1 - walk;
    const seedA = hash2(s.seed, 11, 3);
    const seedB = hash2(s.seed, 12, 4);

    // --- Locomoción en pie ------------------------------------------------
    const A = lerp(0.42, 0.88, run) * walk * (s.sneak ? 0.7 : 1);
    const K = lerp(0.85, 1.8, run) * walk;
    const arm = lerp(0.4, 0.92, run) * walk;
    const elbow = lerp(0.18, 1.3, run);
    const lean = lerp(0.03, 0.2, run) * walk;
    const bounce = lerp(0.02, 0.05, run) * walk;
    let aL = 1;
    let aR = 1;
    if (s.limp < 0) aL = 0.45;
    else if (s.limp > 0) aR = 0.45;
    p.set(B.thighL, -A * sn * aL - 0.06 * walk);
    p.set(B.thighR, A * sn * aR - 0.06 * walk);
    const kL = K * Math.max(0, cs) * aL + 0.1 * walk;
    const kR = K * Math.max(0, -cs) * aR + 0.1 * walk;
    p.set(B.shinL, kL);
    p.set(B.shinR, kR);
    p.set(B.footL, -(p.x(B.thighL) + kL) * 0.55 + 0.25 * Math.max(0, -sn) * walk);
    p.set(B.footR, -(p.x(B.thighR) + kR) * 0.55 + 0.25 * Math.max(0, sn) * walk);
    p.y += bounce * Math.cos(ph * 2) - bounce;
    p.set(B.hips, 0, -0.1 * sn * walk, 0.045 * cs * walk);
    p.set(B.spine, lean * 0.6, 0.05 * sn * walk, -0.03 * cs * walk);
    p.set(B.chest, lean * 0.4, 0.13 * sn * walk, 0);
    p.set(B.neck, -lean * 0.35, -0.05 * sn * walk, 0);
    p.set(B.head, -lean * 0.3, -0.04 * sn * walk, 0);
    p.set(B.upperArmL, arm * sn, 0, 0.06);
    p.set(B.upperArmR, -arm * sn, 0, -0.06);
    p.set(B.forearmL, -(elbow + 0.3 * Math.max(0, -sn) * walk) * (0.3 + 0.7 * walk) - 0.12);
    p.set(B.forearmR, -(elbow + 0.3 * Math.max(0, sn) * walk) * (0.3 + 0.7 * walk) - 0.12);
    if (s.limp !== 0) {
      p.add(B.spine, 0.08, 0, -s.limp * 0.1 * (0.5 + 0.5 * Math.abs(sn)));
      p.y -= 0.03 * Math.abs(sn) * walk;
    }
    // Reposo: respiración y balanceo
    const br = Math.sin(t * 1.5 + seedA * 6);
    p.add(B.chest, 0.018 * br * idle, 0, 0);
    p.add(B.spine, 0, 0, 0.015 * Math.sin(t * 0.43 + seedB * 6) * idle);
    p.add(B.hips, 0, 0, -0.012 * Math.sin(t * 0.43 + seedB * 6) * idle);
    p.add(B.head, 0.02 * Math.sin(t * 0.7 + seedA * 3) * idle, 0.16 * Math.sin(t * 0.27 + seedB * 9) * idle, 0);
    p.add(B.upperArmL, 0.03 * br * idle, 0, 0);
    p.add(B.upperArmR, 0.03 * br * idle, 0, 0);

    // --- Sigilo -------------------------------------------------------------------
    if (s.sneak && s.pose === 'normal') {
      p.y -= 0.24;
      p.add(B.thighL, -0.8);
      p.add(B.thighR, -0.8);
      p.add(B.shinL, 1.35);
      p.add(B.shinR, 1.35);
      p.add(B.footL, -0.5);
      p.add(B.footR, -0.5);
      p.add(B.spine, 0.42);
      p.add(B.chest, 0.15);
      p.add(B.neck, -0.25);
      p.add(B.head, -0.22);
      p.add(B.upperArmL, -0.3);
      p.add(B.upperArmR, -0.3);
      p.add(B.forearmL, -0.5);
      p.add(B.forearmR, -0.5);
    }

    // --- Sujeción del arma ----------------------------------------------------------
    const aw = this.aimW;
    const sway = Math.sin(t * 1.1 + seedA * 4) * 0.02;
    if (s.hold === 'fusil') {
      p.mix(B.upperArmR, 0.92, -0.32 + sway, 0.38, -0.12);
      p.mix(B.forearmR, 0.92, -0.95);
      p.mix(B.upperArmL, 0.92, -0.78 + sway, -0.55, 0.05);
      p.mix(B.forearmL, 0.92, -1.0);
      if (aw > 0.01) {
        p.mix(B.upperArmR, aw, -0.95, 0.15, -0.72);
        p.mix(B.forearmR, aw, -1.9);
        p.mix(B.upperArmL, aw, -1.36, -0.34, 0.1);
        p.mix(B.forearmL, aw, -0.42);
        // Cuerpo de perfil: hombro izquierdo adelantado, cabeza sobre la culata
        p.add(B.spine, 0.05 * aw, -0.16 * aw, 0);
        p.add(B.chest, 0.06 * aw, -0.36 * aw, 0);
        p.add(B.hips, 0, -0.2 * aw, 0);
        p.add(B.neck, 0.08 * aw, 0.3 * aw, -0.1 * aw);
        p.add(B.head, 0.04 * aw, 0.36 * aw, -0.12 * aw);
        p.add(B.thighL, -0.14 * aw * idle);
        p.add(B.shinL, 0.26 * aw * idle);
        p.add(B.thighR, 0.1 * aw * idle);
        p.add(B.shinR, 0.12 * aw * idle);
        p.y -= 0.02 * aw;
      }
    } else if (s.hold === 'pistola') {
      p.mix(B.upperArmR, 0.7, -0.1, 0, -0.05);
      p.mix(B.forearmR, 0.7, -0.4);
      if (aw > 0.01) {
        p.mix(B.upperArmR, aw, -1.46, 0.2, -0.05);
        p.mix(B.forearmR, aw, -0.08);
        p.mix(B.upperArmL, aw, -1.28, -0.5, 0.05);
        p.mix(B.forearmL, aw, -0.55);
        p.add(B.chest, 0, -0.12 * aw, 0);
      }
    } else if (s.hold === 'una') {
      // Brazo suelto con el arma apuntando al frente; la muñeca la deja caer un poco
      p.mix(B.upperArmR, 0.85, -0.12 + sway, 0, -0.16);
      p.mix(B.forearmR, 0.85, -0.5 - 0.25 * walk);
      p.set(B.handR, 0.42, 0, 0.1);
    } else if (s.hold === 'dos') {
      p.mix(B.upperArmR, 0.9, -0.22 + sway, 0.5, -0.1);
      p.mix(B.forearmR, 0.9, -1.0);
      p.mix(B.upperArmL, 0.9, -0.92 + sway, -0.62, 0.05);
      p.mix(B.forearmL, 0.9, -0.92);
    }
    // Farol en la mano izquierda: por delante y algo separado del cuerpo
    if (s.lantern) {
      p.mix(B.upperArmL, 0.9, -0.42 + sway, 0, 0.16);
      p.mix(B.forearmL, 0.9, -0.62);
    }
    // Retroceso del disparo
    this.recoil = s.sinceFire < 0.4 ? Math.exp(-s.sinceFire * 16) : 0;
    if (s.sinceFire < 0.4) {
      const r = Math.exp(-s.sinceFire * 16);
      p.add(B.chest, -0.07 * r);
      p.add(B.upperArmR, 0.1 * r);
      p.add(B.forearmR, -0.12 * r);
      p.add(B.head, -0.04 * r);
      p.fz -= 0.03 * r;
    }

    // --- Llevar a alguien al hombro --------------------------------------------------
    if (s.carrying) {
      p.mix(B.upperArmL, 1, -2.1, 0, 0.5);
      p.mix(B.forearmL, 1, -1.35);
      p.add(B.spine, 0.1, 0, -0.1);
      p.add(B.chest, 0.06, 0, -0.06);
      p.y -= 0.03;
    }

    // --- Trabajos (en pie) -------------------------------------------------------------
    this.work(p, s, t);

    // --- Ataques cuerpo a cuerpo ---------------------------------------------------------
    if (s.attack) this.attack(p, s.attack, clamp01(s.attackT), s.hold);
    this.weaponPose(s, run, dt);
    if (s.sinceBlock < 0.35) {
      const r = Math.sin(clamp01(s.sinceBlock / 0.35) * Math.PI);
      p.mix(B.upperArmR, r, -1.05, 0.2, 0.35);
      p.mix(B.forearmR, r, -1.65);
      p.add(B.spine, -0.08 * r);
    }
    // Golpe recibido
    if (s.sinceHit < 0.6) {
      const r = Math.exp(-s.sinceHit * 8) * Math.sin(Math.min(1, s.sinceHit * 14) * Math.PI * 0.5);
      p.add(B.spine, -0.3 * r, 0, 0.22 * r * s.hitSide);
      p.add(B.chest, -0.15 * r, 0.3 * r * s.hitSide, 0);
      p.add(B.head, 0.3 * r, 0, -0.2 * r * s.hitSide);
      p.fz -= 0.08 * r;
      p.y -= 0.03 * r;
    }

    // --- Posturas de cuerpo entero ---------------------------------------------------------
    this.fullBody(p, s, t, sn, cs, walk);

    // --- Suavizado y volcado a los huesos ---------------------------------------------------
    const fast = s.attack ? 30 : 16;
    const k = this.first ? 1 : 1 - Math.exp(-fast * dt);
    const lying = s.pose === 'ko' || s.pose === 'muerto' || s.pose === 'tumbado' || s.pose === 'gateo';
    const kr = this.first ? 1 : 1 - Math.exp(-(lying ? 7 : 9) * dt);
    const wasFirst = this.first;
    this.first = false;
    const c = this.cur;
    for (let i = 0; i < NB * 3; i++) c[i] += (p.e[i] - c[i]) * k;
    this.y += (p.y - this.y) * kr;
    this.rx += (p.rx - this.rx) * kr;
    this.ry += (p.ry - this.ry) * kr;
    this.rz += (p.rz - this.rz) * kr;
    this.fz += (p.fz - this.fz) * k;
    const bones = this.bones;
    for (let i = 1; i < NB; i++) {
      tmpE.set(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], 'YXZ');
      bones[i].quaternion.setFromEuler(tmpE);
    }
    // Raíz: giro global (caídas) más el balanceo de la pelvis
    tmpE.set(this.rx + c[0], this.ry + c[1], this.rz + c[2], 'YXZ');
    bones[0].quaternion.setFromEuler(tmpE);
    bones[0].position.set(0, this.y, this.fz);
    // Dedos: abiertos y algo curvados en reposo, cerrados en puño al empuñar
    if (bones.length > B.thumbR) {
      const limp = s.pose === 'ko' || s.pose === 'muerto' || s.pose === 'cargado';
      const fist = s.attack === 'punetazo' ? 1 : 0;
      const tR = limp ? 0.2 : s.armed ? 1 : Math.max(fist, s.work === 'cargarCaja' ? 0.45 : s.work === 'calentarse' || s.work === 'hablar' ? 0.02 : 0.16);
      const tL = limp ? 0.2 : Math.max(s.offHand, fist, s.work === 'cargarCaja' ? 0.45 : s.work === 'pico' ? 1 : s.work === 'calentarse' ? 0.02 : 0.16);
      const kg = wasFirst ? 1 : 1 - Math.exp(-14 * dt);
      this.gripR += (tR - this.gripR) * kg;
      this.gripL += (tL - this.gripL) * kg;
      const gR = this.gripR;
      const gL = this.gripL;
      tmpE.set(0, 0, 1.32 * gR, 'YXZ');
      bones[B.fingersR].quaternion.setFromEuler(tmpE);
      tmpE.set(0, 0, 1.5 * gR, 'YXZ');
      bones[B.tipsR].quaternion.setFromEuler(tmpE);
      bones[B.thumbR].quaternion.copy(Q_ID).slerp(THUMB_GRIP_R, gR);
      tmpE.set(0, 0, -1.32 * gL, 'YXZ');
      bones[B.fingersL].quaternion.setFromEuler(tmpE);
      tmpE.set(0, 0, -1.5 * gL, 'YXZ');
      bones[B.tipsL].quaternion.setFromEuler(tmpE);
      bones[B.thumbL].quaternion.copy(Q_ID).slerp(THUMB_GRIP_L, gL);
    }
  }

  /** Calcula dónde debe estar el arma (fusiles y astas) según lo que hace el personaje. */
  private weaponPose(s: AnimInput, run: number, dt: number) {
    const o = TW;
    const t = clamp01(s.attackT);
    const wind = s.attack ? smoothstep(0, 0.28, t) * (1 - smoothstep(0.3, 0.44, t)) : 0;
    const strike = s.attack ? smoothstep(0.3, 0.46, t) * (1 - smoothstep(0.58, 1, t)) : 0;
    const block = s.sinceBlock < 0.35 ? Math.sin(clamp01(s.sinceBlock / 0.35) * Math.PI) : 0;
    this.striking = Math.max(wind, strike, block);
    if (s.hold === 'fusil') {
      o.p.copy(RIFLE.ready.p);
      o.d.copy(RIFLE.ready.d);
      o.u.copy(RIFLE.ready.u);
      o.slide = 1;
      blendKey(o, RIFLE.port, run);
      if (s.sneak) blendKey(o, RIFLE.sneak, 1);
      blendKey(o, RIFLE.wind, wind);
      blendKey(o, RIFLE.strike, strike);
      blendKey(o, RIFLE.block, block);
    } else {
      o.p.copy(POLE.ready.p);
      o.d.copy(POLE.ready.d);
      o.u.copy(POLE.ready.u);
      o.slide = 1;
      blendKey(o, POLE.run, run);
      const k = s.attack === 'golpe' ? 0 : s.attack === 'estocada' ? 2 : 1;
      blendKey(o, k === 0 ? POLE.golpeWind : k === 2 ? POLE.thrustWind : POLE.tajoWind, wind);
      blendKey(o, k === 0 ? POLE.golpeStrike : k === 2 ? POLE.thrustStrike : POLE.tajoStrike, strike);
      blendKey(o, POLE.block, block);
    }
    // Balanceo al andar y al respirar
    const sw = Math.sin(this.phase * 2) * 0.012 * smoothstep(0.04, 0.5, s.speed);
    o.p.y += sw + Math.sin(this.time * 1.5) * 0.004;
    const w = this.weapon;
    const k2 = this.first ? 1 : 1 - Math.exp(-(s.attack ? 34 : 14) * dt);
    w.p.lerp(o.p, k2);
    w.d.lerp(o.d, k2).normalize();
    w.u.lerp(o.u, k2).normalize();
    w.slide += (o.slide - w.slide) * k2;
  }

  private work(p: Pose, s: AnimInput, t: number) {
    switch (s.work) {
      case 'martillo': {
        const h = Math.max(0, Math.sin(t * 9));
        p.mix(B.upperArmR, 1, -0.75 - 0.55 * h, 0.1, -0.15);
        p.mix(B.forearmR, 1, -1.5 + 0.9 * h);
        p.mix(B.upperArmL, 1, -0.85, -0.3, 0);
        p.mix(B.forearmL, 1, -0.7);
        p.add(B.spine, 0.3);
        p.add(B.head, 0.1);
        break;
      }
      case 'pico': {
        const c = (t * 0.9) % 1;
        const up = smoothstep(0, 0.55, c) * (1 - smoothstep(0.62, 0.74, c));
        const down = smoothstep(0.62, 0.74, c) * (1 - smoothstep(0.82, 1, c));
        for (const [ua, fa, sg] of [
          [B.upperArmR, B.forearmR, -1],
          [B.upperArmL, B.forearmL, 1],
        ] as const) {
          p.mix(ua, 1, -0.9 - 1.6 * up + 0.2 * down, sg * -0.35, sg * 0.05);
          p.mix(fa, 1, -0.9 - 0.6 * up + 0.5 * down);
        }
        p.add(B.spine, 0.18 - 0.3 * up + 0.4 * down);
        p.add(B.thighL, -0.2);
        p.add(B.shinL, 0.35);
        p.y -= 0.03 + 0.04 * down;
        break;
      }
      case 'operar': {
        const a = Math.sin(t * 3.1);
        const b2 = Math.sin(t * 2.3 + 1);
        p.mix(B.upperArmR, 1, -0.7 + 0.1 * a, 0.15, -0.1);
        p.mix(B.forearmR, 1, -1.15 + 0.2 * b2);
        p.mix(B.upperArmL, 1, -0.72 + 0.1 * b2, -0.15, 0.1);
        p.mix(B.forearmL, 1, -1.1 + 0.2 * a);
        p.add(B.spine, 0.16);
        p.add(B.head, 0.25, 0.1 * a);
        break;
      }
      case 'cocinar': {
        p.mix(B.upperArmR, 1, -0.75 + 0.1 * Math.sin(t * 4), 0.1 * Math.cos(t * 4), -0.1);
        p.mix(B.forearmR, 1, -1.05 + 0.12 * Math.cos(t * 4));
        p.mix(B.upperArmL, 1, -0.1, 0, 0.35);
        p.mix(B.forearmL, 1, -1.5);
        p.add(B.spine, 0.15);
        p.add(B.head, 0.22);
        break;
      }
      case 'comer': {
        const c = Math.max(0, Math.sin(t * 2.2));
        p.mix(B.upperArmR, 1, -0.7 - 0.35 * c, 0.3, -0.1);
        p.mix(B.forearmR, 1, -1.5 - 0.75 * c);
        p.add(B.head, 0.12 * c);
        break;
      }
      case 'hablar': {
        const g = Math.max(0, Math.sin(t * 1.3 + s.seed));
        p.mix(B.upperArmR, 0.7 * g + 0.2, -0.4, 0.2, -0.12);
        p.mix(B.forearmR, 0.7 * g + 0.2, -1.2 + 0.25 * Math.sin(t * 5));
        p.add(B.head, 0.04 * Math.sin(t * 4), 0.08 * Math.sin(t * 1.7), 0);
        break;
      }
      case 'guitarra': {
        p.mix(B.upperArmL, 1, -0.55, 0.2, 0.55);
        p.mix(B.forearmL, 1, -1.75 + 0.05 * Math.sin(t * 2));
        p.mix(B.upperArmR, 1, -0.4, 0.25, -0.22);
        p.mix(B.forearmR, 1, -1.35 + 0.22 * Math.sin(t * 7.5));
        p.add(B.head, 0.12, 0.25 * Math.sin(t * 0.5), 0.06 * Math.sin(t * 1.9));
        p.add(B.spine, 0, 0, 0.04 * Math.sin(t * 1.9));
        break;
      }
      case 'calentarse': {
        const r = Math.sin(t * 6) * 0.04;
        p.mix(B.upperArmR, 1, -1.05, 0.25, -0.05);
        p.mix(B.forearmR, 1, -0.55 + r);
        p.mix(B.upperArmL, 1, -1.05, -0.25, 0.05);
        p.mix(B.forearmL, 1, -0.55 - r);
        p.add(B.spine, 0.12);
        break;
      }
      case 'escribir': {
        p.mix(B.upperArmR, 1, -0.62, 0.2, -0.08);
        p.mix(B.forearmR, 1, -1.25 + 0.04 * Math.sin(t * 9));
        p.mix(B.upperArmL, 1, -0.55, -0.25, 0.08);
        p.mix(B.forearmL, 1, -1.2);
        p.add(B.spine, 0.2);
        p.add(B.head, 0.35, 0.06 * Math.sin(t * 0.8));
        break;
      }
      case 'cargarCaja': {
        p.mix(B.upperArmR, 1, -0.55, 0.25, -0.1);
        p.mix(B.forearmR, 1, -1.3);
        p.mix(B.upperArmL, 1, -0.55, -0.25, 0.1);
        p.mix(B.forearmL, 1, -1.3);
        p.add(B.spine, -0.07);
        break;
      }
      case 'guardia': {
        p.add(B.head, 0, 0.5 * Math.sin(t * 0.35 + s.seed), 0);
        p.add(B.chest, 0, 0.15 * Math.sin(t * 0.35 + s.seed), 0);
        break;
      }
      default:
        break;
    }
  }

  private attack(p: Pose, kind: AttackAnim, t: number, hold: WeaponHold) {
    const wind = smoothstep(0, 0.28, t) * (1 - smoothstep(0.3, 0.44, t));
    const strike = smoothstep(0.3, 0.46, t) * (1 - smoothstep(0.58, 1, t));
    const two = hold === 'dos' || hold === 'fusil';
    if (kind === 'tajo') {
      // La muñeca se arma hacia atrás y latiguea al golpear
      p.mix(B.handR, wind, -0.45, 0, 0);
      p.mix(B.handR, strike, 0.75, 0, 0);
      p.mix(B.upperArmR, wind, 0.55, -0.2, -1.5);
      p.mix(B.forearmR, wind, -1.5);
      p.add(B.chest, -0.06 * wind, -0.55 * wind, 0);
      p.mix(B.upperArmR, strike, -1.3, 0.45, 0.3);
      p.mix(B.forearmR, strike, -0.25);
      p.add(B.chest, 0.12 * strike, 0.6 * strike, 0);
      p.add(B.spine, 0.2 * strike, 0.2 * strike, 0);
      if (two) {
        p.mix(B.upperArmL, wind, -0.3, -0.9, 0.2);
        p.mix(B.forearmL, wind, -1.9);
        p.mix(B.upperArmL, strike, -1.2, -0.2, 0.1);
        p.mix(B.forearmL, strike, -0.6);
      }
      p.add(B.thighL, -0.42 * strike);
      p.add(B.shinL, 0.35 * strike);
      p.add(B.thighR, 0.28 * strike);
      p.fz += 0.14 * strike;
      p.y -= 0.04 * strike;
    } else if (kind === 'golpe') {
      for (const [ua, fa, sg] of [
        [B.upperArmR, B.forearmR, -1],
        [B.upperArmL, B.forearmL, 1],
      ] as const) {
        p.mix(ua, wind, -2.75, sg * -0.25, sg * 0.1);
        p.mix(fa, wind, -1.25);
        p.mix(ua, strike, -0.85, sg * -0.3, sg * 0.05);
        p.mix(fa, strike, -0.3);
      }
      p.add(B.spine, -0.25 * wind + 0.45 * strike);
      p.add(B.chest, -0.1 * wind + 0.2 * strike);
      p.add(B.thighL, -0.35 * strike);
      p.add(B.shinL, 0.5 * strike);
      p.add(B.thighR, -0.1 * strike);
      p.add(B.shinR, 0.3 * strike);
      p.y -= 0.08 * strike;
      p.fz += 0.1 * strike;
    } else if (kind === 'estocada') {
      // La punta se alinea con el antebrazo para clavar
      p.mix(B.handR, wind, 0.9, 0, 0);
      p.mix(B.handR, strike, 1.25, 0, 0);
      p.mix(B.upperArmR, wind, 0.75, 0.2, -0.3);
      p.mix(B.forearmR, wind, -1.75);
      p.add(B.chest, 0, -0.42 * wind, 0);
      p.mix(B.upperArmR, strike, -1.45, 0.25, 0.05);
      p.mix(B.forearmR, strike, -0.06);
      p.add(B.chest, 0.1 * strike, 0.38 * strike, 0);
      p.add(B.spine, 0.22 * strike);
      if (two) {
        p.mix(B.upperArmL, wind, -0.5, -0.7, 0.1);
        p.mix(B.forearmL, wind, -1.5);
        p.mix(B.upperArmL, strike, -1.3, -0.4, 0.05);
        p.mix(B.forearmL, strike, -0.4);
      }
      p.add(B.thighL, -0.6 * strike);
      p.add(B.shinL, 0.55 * strike);
      p.add(B.thighR, 0.35 * strike);
      p.fz += 0.24 * strike;
      p.y -= 0.07 * strike;
    } else {
      // Puñetazo: directo con la derecha
      p.mix(B.upperArmL, 0.8, -0.9, -0.3, 0.1);
      p.mix(B.forearmL, 0.8, -1.9);
      p.mix(B.upperArmR, wind, 0.25, 0.1, -0.35);
      p.mix(B.forearmR, wind, -2.0);
      p.add(B.chest, 0, -0.4 * wind, 0);
      p.mix(B.upperArmR, strike, -1.42, 0.3, 0.1);
      p.mix(B.forearmR, strike, -0.1);
      p.add(B.chest, 0.06 * strike, 0.45 * strike, 0);
      p.add(B.thighL, -0.3 * strike);
      p.add(B.shinL, 0.3 * strike);
      p.fz += 0.12 * strike;
    }
  }

  private fullBody(p: Pose, s: AnimInput, t: number, sn: number, cs: number, walk: number) {
    const sa = hash2(s.seed, 21, 1);
    const sb = hash2(s.seed, 22, 2);
    const sc = hash2(s.seed, 23, 3);
    const br = Math.sin(t * 1.3 + sa * 6);
    switch (s.pose) {
      case 'sentado': {
        p.y = 0.56;
        p.set(B.thighL, -1.5, 0, 0.1);
        p.set(B.thighR, -1.5, 0, -0.1);
        p.set(B.shinL, 1.5);
        p.set(B.shinR, 1.5);
        p.set(B.footL, 0);
        p.set(B.footR, 0);
        p.set(B.hips, 0, 0, 0);
        p.add(B.spine, 0.14 + 0.01 * br);
        if (s.work === 'nada' || s.work === 'guardia') {
          p.mix(B.upperArmL, 1, -0.42, 0, 0.08);
          p.mix(B.upperArmR, 1, -0.42, 0, -0.08);
          p.mix(B.forearmL, 1, -1.05);
          p.mix(B.forearmR, 1, -1.05);
        }
        break;
      }
      case 'sentadoSuelo': {
        p.y = 0.2;
        p.set(B.thighL, -1.7, 0, 0.45);
        p.set(B.thighR, -1.7, 0, -0.45);
        p.set(B.shinL, 2.05);
        p.set(B.shinR, 2.05);
        p.set(B.footL, -0.2);
        p.set(B.footR, -0.2);
        p.set(B.hips, 0, 0, 0);
        p.add(B.spine, 0.26 + 0.012 * br);
        p.add(B.chest, 0.1);
        p.add(B.head, -0.2);
        if (s.work === 'nada') {
          p.mix(B.upperArmL, 1, -0.75, 0, 0.2);
          p.mix(B.upperArmR, 1, -0.75, 0, -0.2);
          p.mix(B.forearmL, 1, -0.75);
          p.mix(B.forearmR, 1, -0.75);
        }
        break;
      }
      case 'arrodillado': {
        p.y = 0.55;
        p.set(B.thighL, -1.45);
        p.set(B.shinL, 1.5);
        p.set(B.footL, -0.05);
        p.set(B.thighR, 0.12);
        p.set(B.shinR, 1.72);
        p.set(B.footR, 0.85);
        p.set(B.hips, 0, 0, 0);
        p.add(B.spine, 0.22);
        if (s.work === 'vendar' || s.work === 'rebuscar') {
          const a = Math.sin(t * 5);
          p.mix(B.upperArmR, 1, -0.95 + 0.08 * a, 0.2, -0.05);
          p.mix(B.forearmR, 1, -0.7 - 0.15 * a);
          p.mix(B.upperArmL, 1, -0.95 - 0.08 * a, -0.2, 0.05);
          p.mix(B.forearmL, 1, -0.7 + 0.15 * a);
          p.add(B.spine, 0.25);
          p.add(B.head, 0.3);
        } else if (s.work === 'rezar') {
          const bow = smoothstep(0.2, 0.8, Math.sin(t * 0.6) * 0.5 + 0.5);
          p.set(B.thighL, 0.1);
          p.set(B.shinL, 1.75);
          p.set(B.footL, 0.85);
          p.y = 0.5 - 0.12 * bow;
          p.add(B.spine, 0.9 * bow);
          p.add(B.chest, 0.5 * bow);
          p.mix(B.upperArmL, 1, -1.3 - 0.8 * bow, 0, 0.1);
          p.mix(B.upperArmR, 1, -1.3 - 0.8 * bow, 0, -0.1);
          p.mix(B.forearmL, 1, -0.6);
          p.mix(B.forearmR, 1, -0.6);
        }
        break;
      }
      case 'cuclillas': {
        p.y = 0.44;
        p.set(B.thighL, -1.95, 0, 0.25);
        p.set(B.thighR, -1.95, 0, -0.25);
        p.set(B.shinL, 2.5);
        p.set(B.shinR, 2.5);
        p.set(B.footL, -0.55);
        p.set(B.footR, -0.55);
        p.set(B.hips, 0, 0, 0);
        p.add(B.spine, 0.5);
        p.add(B.head, -0.2);
        const a = Math.sin(t * 4);
        p.mix(B.upperArmR, 1, -0.9 + 0.12 * a, 0.2, -0.1);
        p.mix(B.forearmR, 1, -0.55 - 0.2 * a);
        p.mix(B.upperArmL, 1, -0.9 - 0.12 * a, -0.2, 0.1);
        p.mix(B.forearmL, 1, -0.55 + 0.2 * a);
        break;
      }
      case 'tumbado': {
        p.e.fill(0);
        p.rx = -Math.PI / 2;
        p.y = 0.13;
        p.set(B.upperArmL, 0.05, 0, 0.22);
        p.set(B.upperArmR, 0.05, 0, -0.22);
        p.set(B.forearmL, -0.25);
        p.set(B.forearmR, -0.25);
        p.set(B.chest, 0.02 * br);
        p.set(B.head, 0.1, 0.3 * (sa - 0.5), 0);
        p.set(B.thighL, 0, 0, 0.08);
        p.set(B.thighR, 0, 0, -0.08);
        break;
      }
      case 'ko':
      case 'muerto': {
        p.e.fill(0);
        const up = sa > 0.55;
        p.rx = (up ? -1 : 1) * (Math.PI / 2 - 0.04);
        p.ry = (sb - 0.5) * 0.5;
        p.y = 0.125;
        const breath = s.pose === 'ko' ? 0.02 * br : 0;
        p.set(B.spine, (sb - 0.5) * 0.3, (sc - 0.5) * 0.5, (sa - 0.5) * 0.3);
        p.set(B.chest, breath, (sb - 0.5) * 0.3, 0);
        p.set(B.head, up ? 0.15 : -0.1, (sc - 0.5) * 1.6, 0);
        p.set(B.upperArmL, up ? 0.1 : -0.2, 0, 0.5 + sb * 1.3);
        p.set(B.forearmL, -0.4 - sc * 1.2);
        p.set(B.upperArmR, up ? 0.1 : -0.2, 0, -0.4 - sc * 1.4);
        p.set(B.forearmR, -0.3 - sa * 1.3);
        p.set(B.thighL, up ? -0.1 - sb * 0.5 : 0.05, 0, 0.12 + sc * 0.3);
        p.set(B.shinL, 0.2 + sb * (up ? 0.9 : 0.3));
        p.set(B.thighR, up ? -0.05 : 0.02, 0, -0.1 - sa * 0.3);
        p.set(B.shinR, 0.1 + sc * (up ? 0.5 : 0.25));
        p.set(B.footL, 0.5);
        p.set(B.footR, 0.5);
        break;
      }
      case 'cargado': {
        p.e.fill(0);
        p.rx = 1.25;
        p.y = 0;
        p.set(B.spine, 0.9);
        p.set(B.chest, 0.45);
        p.set(B.head, 0.3);
        p.set(B.upperArmL, -2.6 + 0.05 * sn, 0, 0.15);
        p.set(B.upperArmR, -2.6 - 0.05 * sn, 0, -0.15);
        p.set(B.forearmL, -0.2);
        p.set(B.forearmR, -0.2);
        p.set(B.thighL, -0.5);
        p.set(B.thighR, -0.4);
        p.set(B.shinL, 0.4);
        p.set(B.shinR, 0.3);
        break;
      }
      case 'gateo': {
        p.e.fill(0);
        p.rx = Math.PI / 2 - 0.12;
        p.y = 0.2;
        p.set(B.head, -0.7);
        p.set(B.neck, -0.3);
        p.set(B.upperArmL, -2.5 + 0.5 * sn * walk, 0, 0.35);
        p.set(B.forearmL, -0.9 - 0.5 * sn * walk);
        p.set(B.upperArmR, -2.5 - 0.5 * sn * walk, 0, -0.35);
        p.set(B.forearmR, -0.9 + 0.5 * sn * walk);
        p.set(B.spine, 0, 0.12 * cs * walk, 0);
        p.set(B.thighL, 0.05 * sn * walk, 0, 0.1);
        p.set(B.thighR, -0.05 * sn * walk, 0, -0.1);
        p.set(B.shinL, 0.15);
        p.set(B.shinR, 0.2);
        p.set(B.footL, 0.6);
        p.set(B.footR, 0.6);
        break;
      }
      default:
        break;
    }
  }
}
