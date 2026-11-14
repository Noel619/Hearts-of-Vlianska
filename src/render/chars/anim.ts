// Animación procedural de los humanoides: no hay clips grabados. Cada
// fotograma se calcula una pose objetivo (ángulos por hueso) a partir del
// estado del personaje y se suaviza hacia ella, de modo que cualquier cambio
// de estado produce una transición continua.
//
// Encima de esa pose suavizada van las capas que no se suavizan porque son
// cíclicas o dependen del instante: la zancada, el contrabalanceo de pelvis,
// pecho y brazos, la respiración, el cambio de peso, los gestos sueltos y la
// mirada. Las piernas se resuelven al final por cinemática inversa: cada pie
// sigue su trayectoria (apoyo plantado en el suelo, despegue sobre la punta,
// vuelo, apoyo de talón) y la cadera baja lo que haga falta para alcanzarlo,
// así que el cuerpo puede embestir, agacharse o retroceder sin que los pies
// patinen.

import * as THREE from 'three';
import { angleDiff, clamp, clamp01, hash2, hermite, lerp, smoothstep } from '../../core/math';
import { HB, HUMAN_BONES } from './humanoid';

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
/** Forma de moverse: persona, mole que arrastra los brazos o acechador encorvado. */
export type BodyStyle = 'humano' | 'bruto' | 'acechador';

export interface AnimInput {
  /** Velocidad horizontal (m/s, en unidades del modelo). */
  speed: number;
  /** Distancia recorrida en este fotograma (unidades del modelo); negativa = se deduce de la velocidad. */
  dist: number;
  /** Dirección de la marcha respecto al frente (rad; + hacia la izquierda). */
  moveDir: number;
  /** Velocidad de giro (rad/s; + hacia la izquierda). */
  turn: number;
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
  /** Hacia dónde mira respecto al frente (rad; + izquierda) o null si no mira a nada en concreto. */
  look: number | null;
  /** Elevación de la mirada (rad; + arriba). */
  lookPitch: number;
  /** Hay pelea cerca: guardia con los pies abiertos (0..1). */
  alert: number;
  style: BodyStyle;
}

export function defaultAnimInput(seed = 1): AnimInput {
  return {
    speed: 0,
    dist: -1,
    moveDir: 0,
    turn: 0,
    sneak: false,
    limp: 0,
    hold: 'nada',
    aim: 0,
    pose: 'normal',
    work: 'nada',
    carrying: false,
    attack: null,
    attackT: 0,
    sinceFire: 9,
    sinceHit: 9,
    hitSide: 0,
    sinceBlock: 9,
    seed,
    armed: false,
    offHand: 0,
    lantern: false,
    look: null,
    lookPitch: 0,
    alert: 0,
    style: 'humano',
  };
}

const NB = 19;
const B = HB;
const TAU = Math.PI * 2;

// --- Medidas de la pierna, sacadas del esqueleto -------------------------------------
const bp = (i: number) => new THREE.Vector3(...HUMAN_BONES[i].pos);
const HIP_Y = HUMAN_BONES[HB.hips].pos[1];
/** Muslo y pantorrilla (cadera → rodilla → tobillo). */
const L1 = bp(HB.thighL).distanceTo(bp(HB.shinL));
const L2 = bp(HB.shinL).distanceTo(bp(HB.footL));
/** Altura del tobillo con el pie plano. */
const ANKLE = HUMAN_BONES[HB.footL].pos[1];
/** Articulación de la cadera respecto al hueso de la pelvis. */
const JX = HUMAN_BONES[HB.thighL].pos[0];
const JY = HUMAN_BONES[HB.thighL].pos[1] - HIP_Y;
/** Pelvis en reposo: las rodillas no se bloquean del todo. */
const STAND_Y = HIP_Y - 0.008;
/** Alcance útil de la pierna (no se estira hasta el último milímetro). */
const REACH = (L1 + L2) * 0.99;
/** Bola del pie y talón respecto al tobillo (altura de la suela y avance): pivotes al rodar el pie. */
const SOLE = -(ANKLE - 0.005);
const BALL = 0.13;
const HEEL = -0.075;
/** Lo más que se separan los pies en un apoyo (por encima, la carrera vuela más). */
const MAX_STANCE = 0.84;

class Pose {
  e = new Float32Array(NB * 3);
  y = STAND_Y;
  rx = 0;
  ry = 0;
  rz = 0;
  fz = 0;
  fx = 0;
  /** Pies: desplazamiento (x a la izquierda, z al frente) y giro sobre la postura de base; izquierdo y derecho. */
  st = new Float32Array(6);
  reset() {
    this.e.fill(0);
    this.st.fill(0);
    this.y = STAND_Y;
    this.rx = this.ry = this.rz = this.fz = this.fx = 0;
  }
  copy(o: Pose): this {
    this.e.set(o.e);
    this.st.set(o.st);
    this.y = o.y;
    this.rx = o.rx;
    this.ry = o.ry;
    this.rz = o.rz;
    this.fz = o.fz;
    this.fx = o.fx;
    return this;
  }
  /** Avanza hacia `o` una fracción `k` (huesos y pies) y `kr` (raíz). */
  approach(o: Pose, k: number, kr = k): this {
    const e = this.e;
    for (let i = 0; i < e.length; i++) e[i] += (o.e[i] - e[i]) * k;
    for (let i = 0; i < 6; i++) this.st[i] += (o.st[i] - this.st[i]) * k;
    this.y += (o.y - this.y) * kr;
    this.rx += (o.rx - this.rx) * kr;
    this.ry += (o.ry - this.ry) * kr;
    this.rz += (o.rz - this.rz) * kr;
    this.fz += (o.fz - this.fz) * k;
    this.fx += (o.fx - this.fx) * k;
    return this;
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
  /** Mueve un pie (0 izquierdo, 1 derecho) sobre su postura de base. */
  foot(side: 0 | 1, dx: number, dz: number, yaw = 0) {
    this.st[side * 3] += dx;
    this.st[side * 3 + 1] += dz;
    this.st[side * 3 + 2] += yaw;
  }
}

/** Objetivo de un pie en el espacio del modelo. */
interface FootTarget {
  x: number;
  y: number;
  z: number;
  /** Cabeceo (+ punta abajo) y giro (+ a la izquierda). */
  pitch: number;
  yaw: number;
  /** Cuánto peso aguanta (1 apoyado, 0 en el aire). */
  plant: number;
}

const T = new Pose();
/** Poses de trabajo para caídas y para la pose final de cada fotograma. */
const K1 = new Pose();
const K2 = new Pose();
const FT: [FootTarget, FootTarget] = [
  { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, plant: 1 },
  { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, plant: 1 },
];

const tmpE = new THREE.Euler();
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const qRootInv = new THREE.Quaternion();
const qFootM = new THREE.Quaternion();
const qFootH = new THREE.Quaternion();
const qThigh = new THREE.Quaternion();
const qShinH = new THREE.Quaternion();
const qTmp = new THREE.Quaternion();
const mBasis = new THREE.Matrix4();
const vA = new THREE.Vector3();
const vJ = new THREE.Vector3();
const vP = new THREE.Vector3();
const vK = new THREE.Vector3();
const vW = new THREE.Vector3();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const xT = new THREE.Vector3();
const yT = new THREE.Vector3();
const zT = new THREE.Vector3();

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

/** Duración de la caída (rodillas que ceden, desplome y rebote) y de levantarse. */
const FALL_END = 1.0;
const RISE_KNEEL = 0.55;
const RISE_END = 1.2;

type Fidget = 'mirar' | 'hombros' | 'rascar' | 'estirar';

/** Largo de una zancada completa (dos pasos) según la velocidad. */
function strideLength(v: number, run: number, sneak: number, carry: number, style: BodyStyle): number {
  const walk = clamp(0.42 + 0.62 * v, 0.42, 1.38);
  const runS = 0.62 + 0.5 * v;
  let S = lerp(walk, runS, run);
  S = lerp(S, clamp(0.5 + 0.48 * v, 0.5, 1.25), sneak);
  S *= 1 - 0.2 * carry;
  if (style === 'bruto') S *= 0.84;
  else if (style === 'acechador') S *= 1.12;
  return S;
}

/**
 * Al rodar el pie sobre la bola (talón arriba, cabeceo > 0) o sobre el talón
 * (punta arriba) ese punto no se mueve: el tobillo sube y avanza o retrocede.
 * Devuelve [subida, avance] del tobillo.
 */
const PIV: [number, number] = [0, 0];
function footPivot(pitch: number): [number, number] {
  const pz = pitch > 0 ? BALL : HEEL;
  const c = Math.cos(pitch);
  const sn = Math.sin(pitch);
  // Rotación en X: (y, z) → (y·c − z·s, y·s + z·c); el tobillo compensa lo que se mueve el pivote
  PIV[0] = SOLE - (SOLE * c - pz * sn);
  PIV[1] = pz - (SOLE * sn + pz * c);
  return PIV;
}

const lyingPose = (q: BodyPose) => q === 'ko' || q === 'muerto' || q === 'tumbado' || q === 'gateo' || q === 'cargado';

export class HumanAnimator {
  /** Fase del ciclo de paso (rad). */
  phase = 0;
  time = 0;
  /** Fase del ciclo de paso (0..1): el pie izquierdo apoya en 0 y el derecho en 0,5. */
  private cyc = 0;
  private cur = new Pose();
  private fin = new Pose();
  private aimW = 0;
  private first = true;
  private gripR = 0.15;
  private gripL = 0.15;
  // Parámetros suavizados de la marcha y del cuerpo
  private v = 0;
  private accel = 0;
  private turnS = 0;
  private dir = 0;
  private stride = 1;
  private sneakW = 0;
  private alertW = 0;
  private carryW = 0;
  private limpW = 0;
  private uprightW = 1;
  private stepW = 0;
  private freeL = 1;
  private freeR = 1;
  private lookW = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  /** Cansancio de correr: respira más deprisa y más hondo. */
  private exert = 0;
  private breath = 0;
  /** Cambio de peso actual (-1 derecha … 1 izquierda) y su peso. */
  private ws = 0;
  private wsW = 0;
  // Caídas y levantarse
  private lastPose: BodyPose = 'normal';
  private fallT = -1;
  private fallFrom = new Pose();
  private riseT = -1;
  // Gestos sueltos
  private fid: Fidget | null = null;
  private fidAge = 0;
  private fidDur = 1;
  private fidDir = 1;
  private fidWait: number;
  private fidN = 0;
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
    readonly seed: number,
  ) {
    this.cyc = hash2(seed, 3, 7);
    this.phase = this.cyc * TAU;
    this.time = hash2(seed, 5, 9) * 20;
    this.fidWait = 4 + hash2(seed, 6, 1) * 10;
  }

  update(dt: number, s: AnimInput) {
    this.time += dt;
    const t = this.time;
    const first = this.first;
    const ease = (rate: number) => (first ? 1 : 1 - Math.exp(-rate * dt));

    // --- Cambios de postura: caer y levantarse ---------------------------------------
    if (s.pose !== this.lastPose) {
      const was = this.lastPose;
      this.lastPose = s.pose;
      if (!first && (s.pose === 'ko' || s.pose === 'muerto') && !lyingPose(was)) {
        this.fallT = 0;
        this.fallFrom.copy(this.cur);
      } else if (!first && s.pose === 'normal' && (was === 'ko' || was === 'tumbado' || was === 'gateo')) {
        this.riseT = 0;
      }
    }
    if (this.fallT >= 0) {
      this.fallT += dt;
      if (this.fallT > FALL_END || (s.pose !== 'ko' && s.pose !== 'muerto')) this.fallT = -1;
    }
    if (this.riseT >= 0) {
      this.riseT += dt;
      if (this.riseT > RISE_END || s.pose !== 'normal') this.riseT = -1;
    }
    const falling = this.fallT >= 0;
    const kneeling = this.riseT >= 0 && this.riseT < RISE_KNEEL;
    const upright = s.pose === 'normal' && !kneeling;

    // --- Parámetros suavizados ---------------------------------------------------------
    const v0 = this.v;
    this.v += (Math.max(0, s.speed) - this.v) * ease(10);
    const v = this.v;
    if (dt > 0 && !first) this.accel += (clamp((v - v0) / dt, -10, 10) - this.accel) * ease(5);
    this.turnS += (clamp(s.turn, -8, 8) - this.turnS) * ease(6);
    if (s.speed > 0.05) this.dir += angleDiff(this.dir, s.moveDir) * ease(8);
    this.aimW += (s.aim - this.aimW) * Math.min(1, dt * 10);
    this.sneakW += ((s.sneak && s.pose === 'normal' ? 1 : 0) - this.sneakW) * ease(6);
    this.alertW += ((s.alert > 0 && upright && !s.sneak ? 1 : 0) - this.alertW) * ease(3);
    this.carryW += ((s.carrying ? 1 : 0) - this.carryW) * ease(6);
    this.limpW += (s.limp - this.limpW) * ease(3);
    this.uprightW += ((upright && !falling ? 1 : 0) - this.uprightW) * ease(falling ? 30 : 9);
    const walk = smoothstep(0.03, 0.3, v);
    const run = smoothstep(2.1, 4.3, v) * (1 - this.sneakW);
    this.exert = clamp01(this.exert + dt * (run > 0.5 ? 0.12 : -0.05));

    // --- Fase de la zancada: avanza con la distancia recorrida ---------------------------
    this.stride = strideLength(v, run, this.sneakW, this.carryW, s.style);
    const moved = s.dist >= 0 ? s.dist : v * dt;
    const turning = s.pose === 'normal' ? (1 - walk) * smoothstep(0.9, 2.4, Math.abs(this.turnS)) : 0;
    this.stepW += (turning - this.stepW) * ease(6);
    this.cyc = (this.cyc + Math.min(0.45, moved / this.stride + dt * 1.6 * this.stepW)) % 1;
    this.phase = this.cyc * TAU;
    const ph = this.phase;
    const sn = Math.sin(ph);
    const cs = Math.cos(ph);

    // --- Pose objetivo (se suaviza) -------------------------------------------------------
    const p = T;
    p.reset();
    const seedA = hash2(s.seed, 11, 3);
    this.base(p, s, walk, run);
    this.holds(p, s, t, seedA, walk);
    this.work(p, s, t);
    if (s.attack) this.attack(p, s.attack, clamp01(s.attackT), s.hold);
    this.weaponPose(s, run, dt);
    this.reactions(p, s);
    this.fullBody(p, s, t, sn, cs, walk);
    if (kneeling) this.kneel(p);
    if (falling) this.fall(p, s);

    // --- Suavizado -----------------------------------------------------------------------
    const lying = s.pose === 'ko' || s.pose === 'muerto' || s.pose === 'tumbado' || s.pose === 'gateo';
    const k = falling ? 1 : ease(s.attack ? 30 : 16);
    const kr = falling ? 1 : ease(s.attack ? 24 : lying || kneeling ? 7 : 9);
    const wasFirst = first;
    this.first = false;
    this.cur.approach(p, k, kr);

    // --- Capas sin suavizar: zancada, respiración, peso, gestos y mirada ---------------------
    const F = this.fin.copy(this.cur);
    this.armFreedom(s, ease(8));
    this.gaitLayer(F, s, walk, run);
    this.idleLayer(F, s, dt, walk);
    this.lookLayer(F, s, ease);

    // --- Volcado a los huesos ------------------------------------------------------------------
    const bones = this.bones;
    const c = F.e;
    for (let i = 1; i < NB; i++) {
      tmpE.set(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], 'YXZ');
      bones[i].quaternion.setFromEuler(tmpE);
    }
    // Raíz: giro global (caídas, inclinación en las curvas) más el balanceo de la pelvis
    tmpE.set(F.rx + c[0], F.ry + c[1], F.rz + c[2], 'YXZ');
    bones[0].quaternion.setFromEuler(tmpE);
    bones[0].position.set(F.fx, F.y, F.fz);
    // Piernas: pies plantados
    if (this.uprightW > 0.002) this.plantFeet(s, F, walk, run);
    this.fingers(s, dt, wasFirst);
  }

  // =========================================================================================
  // Pose objetivo
  // =========================================================================================

  /** Postura del cuerpo según la marcha, el sigilo y la forma de moverse. */
  private base(p: Pose, s: AnimInput, walk: number, run: number) {
    // Se inclina al correr y al acelerar; al frenar, hacia atrás
    const lean = lerp(0.03, 0.13, run) * walk + clamp(this.accel * 0.03, -0.1, 0.14) + 0.08 * this.carryW;
    p.y = STAND_Y - 0.012 * walk - 0.03 * run;
    p.set(B.spine, lean * 0.55);
    p.set(B.chest, lean * 0.35);
    p.set(B.neck, -lean * 0.4);
    p.set(B.head, -lean * 0.35);
    // Brazos sueltos, algo separados; los codos se doblan al andar y mucho al correr
    p.set(B.upperArmL, 0.02, 0, 0.07 + 0.09 * run);
    p.set(B.upperArmR, 0.02, 0, -0.07 - 0.09 * run);
    p.set(B.forearmL, -(0.14 + 0.2 * walk + 1.15 * run));
    p.set(B.forearmR, -(0.14 + 0.2 * walk + 1.15 * run));
    p.set(B.handL, 0.06 * run);
    p.set(B.handR, 0.06 * run);
    // Cojera: carga el peso en la pierna sana
    if (s.limp !== 0) p.add(B.spine, 0.06, 0, -s.limp * 0.08);
    if (s.sneak && s.pose === 'normal') {
      p.y -= 0.27;
      p.add(B.spine, 0.42);
      p.add(B.chest, 0.12);
      p.add(B.neck, -0.25);
      p.add(B.head, -0.2);
      p.add(B.upperArmL, -0.32);
      p.add(B.upperArmR, -0.32);
      p.add(B.forearmL, -0.55);
      p.add(B.forearmR, -0.55);
    }
    if (s.style === 'bruto') {
      // Mole encorvada: brazos colgando por delante, piernas abiertas
      p.y -= 0.06;
      p.add(B.spine, 0.3);
      p.add(B.chest, 0.26);
      p.add(B.neck, -0.32);
      p.add(B.head, -0.3);
      p.set(B.upperArmL, -0.22, 0, 0.3);
      p.set(B.upperArmR, -0.22, 0, -0.3);
      p.set(B.forearmL, -0.4 - 0.35 * run);
      p.set(B.forearmR, -0.4 - 0.35 * run);
    } else if (s.style === 'acechador') {
      // Encorvado, con las garras por delante y la cabeza adelantada
      p.y -= 0.1;
      p.add(B.spine, 0.46);
      p.add(B.chest, 0.22);
      p.add(B.neck, -0.36);
      p.add(B.head, -0.4);
      p.set(B.upperArmL, -0.62 + 0.2 * run, 0, 0.26);
      p.set(B.upperArmR, -0.62 + 0.2 * run, 0, -0.26);
      p.set(B.forearmL, -0.95);
      p.set(B.forearmR, -0.95);
      p.set(B.handL, 0.55);
      p.set(B.handR, 0.55);
    }
  }

  /** Cómo sujeta el arma, el farol o a quien lleva al hombro. */
  private holds(p: Pose, s: AnimInput, t: number, seedA: number, walk: number) {
    const aw = this.aimW;
    const idle = 1 - walk;
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
        // Pie izquierdo adelantado y abierto, derecho atrás: tirador de pie
        p.foot(0, 0.03 * aw * idle, 0.16 * aw * idle, 0.25 * aw * idle);
        p.foot(1, -0.04 * aw * idle, -0.1 * aw * idle, -0.55 * aw * idle);
        p.y -= 0.025 * aw;
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
        p.foot(0, 0.02 * aw * idle, 0.1 * aw * idle, 0.1 * aw * idle);
        p.foot(1, -0.02 * aw * idle, -0.06 * aw * idle, -0.3 * aw * idle);
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
    // Retroceso del disparo: el golpe de la culata echa el cuerpo atrás
    this.recoil = s.sinceFire < 0.4 ? Math.exp(-s.sinceFire * 16) : 0;
    if (s.sinceFire < 0.4) {
      const r = Math.exp(-s.sinceFire * 16);
      p.add(B.chest, -0.07 * r);
      p.add(B.upperArmR, 0.1 * r);
      p.add(B.forearmR, -0.12 * r);
      p.add(B.head, -0.04 * r);
      p.fz -= 0.03 * r;
    }
    // Llevar a alguien al hombro
    if (s.carrying) {
      p.mix(B.upperArmL, 1, -2.1, 0, 0.5);
      p.mix(B.forearmL, 1, -1.35);
      p.add(B.spine, 0.1, 0, -0.1);
      p.add(B.chest, 0.06, 0, -0.06);
      p.y -= 0.035;
    }
  }

  /** Bloqueos y golpes recibidos. */
  private reactions(p: Pose, s: AnimInput) {
    if (s.sinceBlock < 0.35) {
      const r = Math.sin(clamp01(s.sinceBlock / 0.35) * Math.PI);
      p.mix(B.upperArmR, r, -1.05, 0.2, 0.35);
      p.mix(B.forearmR, r, -1.65);
      p.add(B.spine, -0.08 * r);
      p.fz -= 0.04 * r;
    }
    // Golpe recibido: el cuerpo se dobla y recula; los pies aguantan
    if (s.sinceHit < 0.6) {
      const r = Math.exp(-s.sinceHit * 8) * Math.sin(Math.min(1, s.sinceHit * 14) * Math.PI * 0.5);
      p.add(B.spine, -0.3 * r, 0, 0.22 * r * s.hitSide);
      p.add(B.chest, -0.15 * r, 0.3 * r * s.hitSide, 0);
      p.add(B.head, 0.3 * r, 0, -0.2 * r * s.hitSide);
      p.add(B.upperArmL, -0.25 * r, 0, 0.2 * r);
      p.add(B.upperArmR, -0.25 * r, 0, -0.2 * r);
      p.fz -= 0.1 * r;
      p.fx -= 0.05 * r * s.hitSide;
      p.y -= 0.04 * r;
      // Un pie retrocede para no caer
      p.foot(1, 0, -0.12 * r);
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
    // Balanceo al andar (sube y baja con cada paso) y al respirar
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
        // Golpe con el peso del cuerpo: se arma, cae y rebota
        const c = (t * 1.45) % 1;
        const up = smoothstep(0, 0.6, c) * (1 - smoothstep(0.66, 0.78, c));
        const hit = smoothstep(0.66, 0.78, c) * (1 - smoothstep(0.8, 1, c));
        p.mix(B.upperArmR, 1, -0.7 - 0.85 * up + 0.15 * hit, 0.1, -0.15 - 0.1 * up);
        p.mix(B.forearmR, 1, -1.55 + 0.25 * up + 0.85 * hit);
        p.mix(B.upperArmL, 1, -0.85, -0.3, 0);
        p.mix(B.forearmL, 1, -0.7);
        p.add(B.spine, 0.26 - 0.06 * up + 0.08 * hit);
        p.add(B.chest, 0, -0.1 * up, 0);
        p.add(B.head, 0.12);
        p.foot(0, 0.03, 0.1, 0.1);
        p.foot(1, -0.03, -0.05, -0.15);
        p.y -= 0.03 + 0.015 * hit;
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
        p.foot(0, 0.03, 0.2, 0.1);
        p.foot(1, -0.04, -0.08, -0.25);
        p.y -= 0.05 + 0.06 * down;
        p.fz += 0.04 * down;
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
        // Gesticula con una mano y luego con la otra
        const g = Math.max(0, Math.sin(t * 1.3 + s.seed));
        const g2 = Math.max(0, Math.sin(t * 0.9 + s.seed * 2 + 2));
        p.mix(B.upperArmR, 0.7 * g + 0.2, -0.4, 0.2, -0.12);
        p.mix(B.forearmR, 0.7 * g + 0.2, -1.2 + 0.25 * Math.sin(t * 5));
        p.mix(B.upperArmL, 0.5 * g2, -0.35, -0.2, 0.14);
        p.mix(B.forearmL, 0.5 * g2, -1.1 + 0.2 * Math.sin(t * 4 + 1));
        p.add(B.head, 0.04 * Math.sin(t * 4), 0.08 * Math.sin(t * 1.7), 0.05 * Math.sin(t * 0.8));
        p.add(B.chest, 0, 0.05 * Math.sin(t * 0.7), 0);
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
        p.y -= 0.02;
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
    // Preparación (se arma y carga el peso atrás), golpe (el peso pasa al pie de delante) y recuperación
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
      p.add(B.hips, 0, -0.2 * wind + 0.25 * strike, 0);
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
      p.foot(0, 0.02 * strike, 0.3 * strike - 0.05 * wind, 0.15 * strike);
      p.foot(1, -0.02 * strike, -0.12 * strike, -0.3 * strike);
      p.fz += 0.15 * strike - 0.05 * wind;
      p.y -= 0.05 * strike;
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
      p.foot(0, 0.02 * strike, 0.24 * strike, 0.1 * strike);
      p.foot(1, -0.02 * strike, -0.1 * strike, -0.25 * strike);
      p.y += 0.015 * wind - 0.11 * strike;
      p.fz += 0.1 * strike - 0.04 * wind;
    } else if (kind === 'estocada') {
      // La punta se alinea con el antebrazo para clavar: zancada larga hacia delante
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
      p.foot(0, 0.03 * strike, 0.44 * strike - 0.04 * wind, 0.1 * strike);
      p.foot(1, -0.02 * strike, -0.16 * strike, -0.3 * strike);
      p.fz += 0.25 * strike - 0.06 * wind;
      p.y -= 0.1 * strike;
    } else {
      // Puñetazo: directo con la derecha, el hombro detrás
      p.mix(B.upperArmL, 0.8, -0.9, -0.3, 0.1);
      p.mix(B.forearmL, 0.8, -1.9);
      p.mix(B.upperArmR, wind, 0.25, 0.1, -0.35);
      p.mix(B.forearmR, wind, -2.0);
      p.add(B.chest, 0, -0.4 * wind, 0);
      p.add(B.hips, 0, -0.15 * wind + 0.2 * strike, 0);
      p.mix(B.upperArmR, strike, -1.42, 0.3, 0.1);
      p.mix(B.forearmR, strike, -0.1);
      p.add(B.chest, 0.06 * strike, 0.45 * strike, 0);
      p.foot(0, 0.02, 0.16 * strike + 0.06, 0.15);
      p.foot(1, -0.02, -0.08 * strike - 0.04, -0.35);
      p.fz += 0.12 * strike;
      p.y -= 0.04;
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
        p.st.fill(0);
        p.rx = -Math.PI / 2;
        p.y = 0.13;
        p.fz = 0;
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
        p.st.fill(0);
        const up = sa > 0.55;
        p.rx = (up ? -1 : 1) * (Math.PI / 2 - 0.04);
        p.ry = (sb - 0.5) * 0.5;
        p.y = 0.125;
        p.fz = 0;
        p.fx = 0;
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
        p.st.fill(0);
        p.rx = 1.25;
        p.y = 0;
        p.fz = 0;
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
        p.st.fill(0);
        p.rx = Math.PI / 2 - 0.12;
        p.y = 0.2;
        p.fz = 0;
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

  /** De rodillas un momento al levantarse del suelo: una mano en la rodilla para impulsarse. */
  private kneel(p: Pose) {
    p.e.fill(0);
    p.st.fill(0);
    p.rx = p.ry = p.rz = p.fx = 0;
    p.fz = 0.04;
    p.y = 0.56;
    p.set(B.thighL, -1.4, 0, 0.05);
    p.set(B.shinL, 1.45);
    p.set(B.footL, -0.05);
    p.set(B.thighR, 0.15, 0, -0.05);
    p.set(B.shinR, 1.7);
    p.set(B.footR, 0.85);
    p.set(B.spine, 0.42);
    p.set(B.chest, 0.15);
    p.set(B.neck, -0.15);
    p.set(B.head, -0.1);
    p.set(B.upperArmL, -0.75, 0, 0.12);
    p.set(B.forearmL, -0.5);
    p.set(B.upperArmR, -0.25, 0, -0.18);
    p.set(B.forearmR, -0.3);
  }

  /**
   * Caída al quedar inconsciente o morir de pie, en tres tiempos: ceden las
   * rodillas; quien cae de espaldas se sienta y quien cae de bruces da con las
   * rodillas en el suelo; y el tronco se desploma como un peso muerto (cada vez
   * más deprisa) hasta quedar tendido, con un pequeño rebote.
   */
  private fall(p: Pose, s: AnimInput) {
    const f = this.fallT;
    const back = hash2(s.seed, 21, 1) > 0.55;
    const side = s.hitSide || (hash2(s.seed, 24, 1) < 0.5 ? -1 : 1);
    // 1) Las rodillas ceden
    const a = K1.copy(this.fallFrom);
    a.rx = a.ry = a.rz = a.fx = 0;
    a.st.fill(0);
    a.y = 0.62;
    a.fz = back ? -0.05 : 0.08;
    a.set(B.hips, 0, 0, 0);
    a.set(B.thighL, -1.0, 0, 0.12);
    a.set(B.thighR, -0.85, 0, -0.1);
    a.set(B.shinL, 1.75);
    a.set(B.shinR, 1.55);
    a.set(B.footL, 0.3);
    a.set(B.footR, 0.4);
    a.set(B.spine, back ? -0.08 : 0.4);
    a.set(B.chest, back ? -0.04 : 0.2);
    a.set(B.neck, back ? 0.2 : 0.25);
    a.set(B.head, back ? 0.35 : 0.3, 0.25 * side);
    a.set(B.upperArmL, -0.2, 0, 0.32);
    a.set(B.upperArmR, -0.2, 0, -0.32);
    a.set(B.forearmL, -0.45);
    a.set(B.forearmR, -0.4);
    // 2) Sentado en el suelo (de espaldas) o de rodillas (de bruces)
    const b = K2.copy(a);
    if (back) {
      b.y = 0.2;
      b.rx = -0.3;
      b.fz = -0.12;
      b.set(B.thighL, -1.25, 0, 0.18);
      b.set(B.thighR, -1.05, 0, -0.14);
      b.set(B.shinL, 1.35);
      b.set(B.shinR, 0.95);
      b.set(B.footL, 0.1);
      b.set(B.footR, 0.2);
      b.set(B.spine, -0.05);
      b.set(B.head, 0.45, 0.35 * side);
      // Las manos atrás, a parar el golpe
      b.set(B.upperArmL, 0.55, 0, 0.45);
      b.set(B.upperArmR, 0.55, 0, -0.45);
      b.set(B.forearmL, -0.15);
      b.set(B.forearmR, -0.15);
    } else {
      b.y = 0.5;
      b.rx = 0.3;
      b.fz = 0.06;
      b.set(B.thighL, -0.35, 0, 0.1);
      b.set(B.thighR, -0.25, 0, -0.1);
      b.set(B.shinL, 1.45);
      b.set(B.shinR, 1.35);
      b.set(B.footL, 0.7);
      b.set(B.footR, 0.7);
      b.set(B.spine, 0.35);
      b.set(B.head, 0.2, 0.3 * side);
      // Los brazos por delante para frenar la caída
      b.set(B.upperArmL, -1.1, 0, 0.3);
      b.set(B.upperArmR, -1.1, 0, -0.3);
      b.set(B.forearmL, -0.25);
      b.set(B.forearmR, -0.25);
    }
    const T1 = 0.26;
    const T2 = back ? 0.5 : 0.44;
    const T3 = T2 + 0.32;
    if (f < T1) {
      p.copy(this.fallFrom).approach(a, smoothstep(0, T1, f));
      return;
    }
    if (f < T2) {
      // Del agacharse al suelo: cae, acelerando
      const u = (f - T1) / (T2 - T1);
      p.copy(a).approach(b, u * u);
      return;
    }
    // 3) El tronco se desploma hasta quedar tendido
    const u = clamp01((f - T2) / (T3 - T2));
    const g = u * u;
    const end = K1.copy(p);
    p.copy(b).approach(end, smoothstep(0, 1, u), 0);
    p.rx = lerp(b.rx, end.rx, g);
    p.ry = lerp(b.ry, end.ry, g);
    p.y = lerp(b.y, end.y, g);
    p.fz = lerp(b.fz, end.fz, g);
    // Rebote al dar contra el suelo
    if (f > T3) p.y += 0.035 * Math.sin(clamp01((f - T3) / 0.18) * Math.PI);
  }

  // =========================================================================================
  // Capas sin suavizar
  // =========================================================================================

  /** Cuánto se balancea cada brazo al andar (nada si sujeta algo o trabaja). */
  private armFreedom(s: AnimInput, k: number) {
    let l = 1;
    let r = 1;
    if (s.hold === 'fusil' || s.hold === 'dos') l = r = 0;
    else if (s.hold === 'pistola') {
      r = 0.35 * (1 - s.aim);
      l = 1 - s.aim;
    } else if (s.hold === 'una') r = 0.5;
    if (s.lantern) l = 0;
    if (s.carrying) {
      l = 0;
      r *= 0.7;
    }
    if ((s.work !== 'nada' && s.work !== 'guardia') || s.attack || s.pose !== 'normal' || this.fallT >= 0) l = r = 0;
    if (s.sneak) {
      l *= 0.35;
      r *= 0.35;
    }
    if (s.style !== 'humano') {
      l *= 0.8;
      r *= 0.8;
    }
    this.freeL += (l - this.freeL) * k;
    this.freeR += (r - this.freeR) * k;
  }

  /** Contrabalanceo al andar: pelvis que gira y se ladea, pecho que compensa, brazos que bracean. */
  private gaitLayer(F: Pose, s: AnimInput, walk: number, run: number) {
    const uw = this.uprightW;
    const gw = Math.max(walk, this.stepW) * uw;
    if (gw < 0.001) return;
    const ph = this.phase;
    const beta = this.duty(run);
    const brute = s.style === 'bruto';
    // cos(ph) = 1 cuando apoya el pie izquierdo: el lado izquierdo de la pelvis va delante
    const swing = Math.cos(ph);
    const yawA = lerp(0.075, 0.12, run) * (brute ? 1.6 : 1) * gw;
    F.add(B.hips, 0, -yawA * swing, 0);
    F.add(B.spine, 0, yawA * 0.4 * swing, 0);
    F.add(B.chest, 0, yawA * 1.1 * swing, 0);
    F.add(B.neck, 0, -yawA * 0.25 * swing, 0);
    F.add(B.head, 0, -yawA * 0.25 * swing, 0);
    // La pelvis se ladea hacia la pierna en el aire y se desplaza sobre la que apoya
    const mid = Math.cos(ph - Math.PI * beta);
    const rollA = lerp(0.045, 0.025, run) * (brute ? 2 : 1) * walk * uw;
    F.add(B.hips, 0, 0, rollA * mid);
    F.add(B.spine, 0, 0, -rollA * 0.5 * mid);
    F.add(B.chest, 0, 0, -rollA * 0.4 * mid);
    F.fx += lerp(0.02, 0.006, run) * (brute ? 3 : 1) * walk * uw * mid;
    // Bote: al andar se sube sobre el pie que apoya; al correr se hunde al apoyar y vuela entre pasos
    const bob = Math.cos(2 * (ph - Math.PI * beta));
    F.y += (0.01 * (1 - run) - 0.035 * run) * walk * uw * bob;
    F.add(B.head, 0.02 * run * walk * bob, 0, 0);
    // Inclinación hacia dentro en las curvas
    F.rz -= clamp(this.turnS * this.v * 0.03, -0.22, 0.22) * uw;
    // Braceo: el brazo izquierdo va adelante con la pierna derecha, con un leve retraso
    const armA = lerp(0.34, 0.62, run) * (brute ? 1.35 : 1) * gw;
    const aL = Math.cos(ph - 0.25);
    F.add(B.upperArmL, armA * aL * this.freeL, 0, 0);
    F.add(B.upperArmR, -armA * aL * this.freeR, 0, 0);
    const elbow = lerp(0.38, 0.32, run) * gw;
    F.add(B.forearmL, -elbow * Math.max(0, -aL) * this.freeL);
    F.add(B.forearmR, -elbow * Math.max(0, aL) * this.freeR);
    // Al correr los brazos cruzan algo por delante del cuerpo
    F.add(B.upperArmL, 0, -0.12 * run * gw * this.freeL * Math.max(0, -aL), 0);
    F.add(B.upperArmR, 0, 0.12 * run * gw * this.freeR * Math.max(0, aL), 0);
  }

  /** Respiración, cambio de peso entre las piernas y gestos sueltos cuando está parado. */
  private idleLayer(F: Pose, s: AnimInput, dt: number, walk: number) {
    const t = this.time;
    const seedA = hash2(s.seed, 11, 3);
    const seedB = hash2(s.seed, 12, 4);
    const uw = this.uprightW;
    const idle = (1 - walk) * (1 - this.stepW) * uw;
    // Respiración: más rápida y honda después de correr
    this.breath += dt * (1.35 + 1.6 * this.exert);
    const br = Math.sin(this.breath + seedA * 6);
    const deep = 1 + 1.5 * this.exert;
    F.add(B.chest, 0.018 * br * deep, 0, 0);
    F.add(B.neck, -0.01 * br * deep, 0, 0);
    F.add(B.upperArmL, 0.022 * br * idle, 0, 0.012 * br * deep * uw);
    F.add(B.upperArmR, 0.022 * br * idle, 0, -0.012 * br * deep * uw);
    if (this.exert > 0.2 && walk < 0.3) F.add(B.spine, 0.1 * this.exert * idle);
    // Cambio de peso: se apoya un rato en una pierna y luego en la otra
    const wave = Math.sin(t * (0.2 + 0.1 * seedA) + seedB * 6) + 0.45 * Math.sin(t * 0.47 + seedA * 9);
    this.ws = Math.tanh(wave * 2.2);
    const quiet = idle * (1 - 0.75 * this.alertW) * (1 - 0.8 * this.aimW) * (1 - 0.7 * this.sneakW) * (s.style === 'humano' ? 1 : 0.4);
    this.wsW = quiet;
    const ws = this.ws * quiet;
    F.fx += 0.03 * ws;
    F.add(B.hips, 0, 0.05 * ws, 0.07 * ws);
    F.add(B.spine, 0, 0, -0.035 * ws);
    F.add(B.chest, 0, -0.03 * ws, -0.04 * ws);
    F.add(B.head, 0, 0, 0.035 * ws);
    F.y -= 0.01 * Math.abs(ws);
    // La mirada vaga cuando no hay nada que mirar
    const free = idle * (1 - this.lookW);
    F.add(B.head, 0.02 * Math.sin(t * 0.7 + seedA * 3) * free, 0.16 * Math.sin(t * 0.27 + seedB * 9) * free, 0);
    // El acechador sacude la cabeza a tirones
    if (s.style === 'acechador') {
      const j = Math.pow(Math.max(0, Math.sin(t * 1.7 + seedA * 5)), 18);
      F.add(B.head, 0.1 * j, 0.5 * j * Math.sign(Math.sin(t * 0.37)), 0.45 * j);
      F.add(B.neck, 0, 0, -0.2 * j);
    }
    this.fidgets(F, s, dt, idle);
  }

  /** De vez en cuando, quien espera mira alrededor, se estira, se rasca la nuca… */
  private fidgets(F: Pose, s: AnimInput, dt: number, idle: number) {
    const calm = idle > 0.9 && s.work === 'nada' && !s.attack && this.aimW < 0.05 && this.alertW < 0.1 && s.style === 'humano' && s.sinceHit > 3;
    if (!this.fid) {
      if (calm) this.fidWait -= dt;
      if (this.fidWait > 0) return;
      const n = this.fidN++;
      const r = hash2(this.seed, n, 77);
      const leftFree = this.freeL > 0.8 && !s.lantern;
      const bothFree = leftFree && this.freeR > 0.8 && s.hold === 'nada';
      this.fid = r < 0.38 ? 'mirar' : r < 0.6 ? 'hombros' : leftFree && r < 0.82 ? 'rascar' : bothFree ? 'estirar' : 'mirar';
      this.fidDur = this.fid === 'mirar' ? 3.2 : this.fid === 'hombros' ? 1.8 : this.fid === 'rascar' ? 2.4 : 2.6;
      this.fidDir = hash2(this.seed, n, 78) < 0.5 ? -1 : 1;
      this.fidAge = 0;
      this.fidWait = 7 + hash2(this.seed, n, 79) * 14;
    }
    this.fidAge += dt;
    const u = this.fidAge / this.fidDur;
    if (u >= 1) {
      this.fid = null;
      return;
    }
    // Si deja de estar tranquilo, el gesto se corta con suavidad
    const env = smoothstep(0, 0.22, u) * (1 - smoothstep(0.72, 1, u)) * idle * (calm ? 1 : 0.4);
    const d = this.fidDir;
    switch (this.fid) {
      case 'mirar': {
        // Mira a un lado, luego al otro
        const yaw = 0.95 * d * env * (u < 0.55 ? smoothstep(0.05, 0.3, u) : 1 - 2 * smoothstep(0.55, 0.85, u));
        F.add(B.chest, 0, yaw * 0.2, 0);
        F.add(B.neck, 0, yaw * 0.35, 0);
        F.add(B.head, -0.05 * env, yaw * 0.45, 0);
        break;
      }
      case 'hombros': {
        // Encoge los hombros y estira el cuello
        const sh = Math.sin(u * Math.PI);
        F.add(B.chest, -0.06 * env, 0, 0);
        F.add(B.upperArmL, 0, 0, 0.08 * env * sh);
        F.add(B.upperArmR, 0, 0, -0.08 * env * sh);
        F.add(B.neck, 0, 0, 0.22 * d * env * sh);
        F.add(B.head, -0.08 * env, 0, 0.2 * d * env * sh);
        break;
      }
      case 'rascar': {
        // La mano izquierda a la nuca
        const sc = Math.sin(this.fidAge * 22) * 0.12 * smoothstep(0.25, 0.4, u) * (1 - smoothstep(0.6, 0.7, u));
        F.mix(B.upperArmL, env, -2.35, 0.3, 0.75);
        F.mix(B.forearmL, env, -2.15 + sc);
        F.mix(B.handL, env, -0.3, 0, 0.4);
        F.add(B.head, 0.18 * env, 0, -0.12 * env);
        F.add(B.chest, 0, 0, -0.05 * env);
        break;
      }
      case 'estirar': {
        // Estira la espalda con los brazos atrás
        F.mix(B.upperArmL, env, 0.4, 0, 0.35);
        F.mix(B.upperArmR, env, 0.4, 0, -0.35);
        F.mix(B.forearmL, env, -0.1);
        F.mix(B.forearmR, env, -0.1);
        F.add(B.chest, -0.16 * env, 0, 0);
        F.add(B.spine, -0.1 * env, 0, 0);
        F.add(B.head, -0.22 * env, 0, 0);
        break;
      }
      default:
        break;
    }
  }

  /** La cabeza y el pecho se vuelven hacia el enemigo. */
  private lookLayer(F: Pose, s: AnimInput, ease: (rate: number) => number) {
    const want = s.look !== null && s.pose === 'normal';
    this.lookW += ((want ? 1 : 0) - this.lookW) * ease(4);
    if (want) {
      this.lookYaw += (clamp(s.look!, -1.5, 1.5) - this.lookYaw) * ease(7);
      this.lookPitch += (clamp(s.lookPitch, -0.8, 0.5) - this.lookPitch) * ease(7);
    }
    const w = this.lookW * (1 - 0.85 * this.aimW) * this.uprightW;
    if (w < 0.001) return;
    const y = this.lookYaw * w;
    const pt = this.lookPitch * w;
    F.add(B.chest, 0, y * 0.22, 0);
    F.add(B.neck, -pt * 0.35, y * 0.33, 0);
    F.add(B.head, -pt * 0.55, y * 0.45, 0);
  }

  /** Fracción del ciclo que cada pie pasa en el suelo. */
  private duty(run: number): number {
    const beta = lerp(lerp(0.6, 0.36, run), 0.66, this.sneakW);
    // Si la zancada es muy larga, el apoyo se acorta (más tiempo en el aire)
    return Math.min(beta, MAX_STANCE / Math.max(0.01, this.stride));
  }

  // =========================================================================================
  // Piernas
  // =========================================================================================

  /** Dónde va cada pie: postura de base, desplazamientos de la pose y zancada. */
  private footTargets(s: AnimInput, F: Pose, walk: number, run: number) {
    const S = this.stride;
    const beta0 = this.duty(run);
    const c0 = lerp(-0.02, -0.07, run);
    const H = lerp(lerp(0.085, 0.24, run), 0.065, this.sneakW) * (s.style === 'bruto' ? 0.75 : 1) * (1 - 0.3 * this.carryW);
    const mx = Math.sin(this.dir);
    const mz = Math.cos(this.dir);
    const guard = this.alertW * (1 - walk);
    const wide = (s.style === 'bruto' ? 0.08 : s.style === 'acechador' ? 0.035 : 0) + 0.04 * this.alertW + 0.025 * this.sneakW;
    for (let i = 0; i < 2; i++) {
      const sg = i === 0 ? 1 : -1;
      const ft = FT[i];
      // Postura de base: pies a la anchura de la cadera, puntas algo abiertas
      let bx = sg * (0.104 + wide) + F.st[i * 3];
      let bz = sg * 0.012 + (sg > 0 ? 0.13 : -0.11) * guard + F.st[i * 3 + 1];
      let yaw = sg * (0.1 + 0.08 * this.alertW) + (sg > 0 ? 0.05 : -0.28) * guard + F.st[i * 3 + 2];
      // Cambio de peso: el pie que descansa se adelanta y apoya poco
      const relax = Math.max(0, -sg * this.ws) * this.wsW;
      bz += 0.05 * relax;
      yaw += sg * 0.12 * relax;
      // Cojera: la pierna mala apoya menos rato y se arrastra
      const bad = (sg > 0 ? -this.limpW : this.limpW) > 0.3 ? 1 : 0;
      const beta = beta0 + (this.limpW !== 0 ? (bad ? -0.12 : 0.05) * Math.abs(this.limpW) : 0);
      const u = (this.cyc + (sg > 0 ? 0 : 0.5)) % 1;
      const D = beta * S;
      let along: number;
      let lift = 0;
      let pitch: number;
      let plant = 1;
      const heelUp = 0.42 + 0.3 * run;
      const toesUp = -0.25 * (1 - 0.75 * run);
      if (u < beta) {
        const sp = u / beta;
        along = D * (0.5 - sp) + c0;
        pitch = toesUp * (1 - smoothstep(0, 0.16, sp)) + heelUp * smoothstep(0.6, 1, sp);
      } else {
        const sw = (u - beta) / (1 - beta);
        // En el aire el pie va de atrás adelante: sale y llega acompañando algo al
        // suelo (sin frenazo) y apenas se pasa del punto donde apoyará
        const m = -S * (1 - beta);
        along = hermite(-D / 2 + c0, 0.85 * m, D / 2 + c0, 0.35 * m, sw);
        pitch = lerp(heelUp, toesUp, smoothstep(0.08, 0.92, sw));
        // Al correr el talón sube pronto hacia el glúteo y luego la rodilla tira adelante
        lift = H * Math.sin(Math.PI * Math.pow(sw, lerp(0.85, 0.65, run))) * (bad ? 0.5 : 1);
        plant = Math.max(1 - smoothstep(0, 0.2, sw), smoothstep(0.8, 1, sw));
      }
      const gw = walk;
      // Al girar en el sitio solo se levantan los pies, por turnos, sin avanzar
      const st = this.stepW * (1 - gw);
      const stepUp = u >= 0.5 ? Math.sin(Math.PI * (u - 0.5) * 2) : 0;
      ft.pitch = pitch * gw + 0.18 * relax + 0.2 * st * stepUp;
      const [ry, rz] = footPivot(ft.pitch);
      ft.x = bx + mx * along * gw + Math.sin(yaw) * rz;
      ft.z = bz + mz * along * gw + Math.cos(yaw) * rz;
      ft.y = ANKLE + lift * gw + 0.045 * st * stepUp + ry;
      ft.yaw = yaw;
      ft.plant = lerp(1, plant, gw) * (1 - st * stepUp);
    }
  }

  /** Coloca los pies: baja la cadera si no llega y resuelve cada pierna. */
  private plantFeet(s: AnimInput, F: Pose, walk: number, run: number) {
    this.footTargets(s, F, walk, run);
    const root = this.bones[0];
    const w = this.uprightW;
    // La cadera no puede quedar más alta de lo que alcanzan las piernas que apoyan
    let cap = root.position.y;
    for (let i = 0; i < 2; i++) {
      const sg = i === 0 ? 1 : -1;
      const ft = FT[i];
      vJ.set(sg * JX, JY, 0).applyQuaternion(root.quaternion);
      const hx = ft.x - (root.position.x + vJ.x);
      const hz = ft.z - (root.position.z + vJ.z);
      const reach = Math.sqrt(Math.max(0, REACH * REACH - hx * hx - hz * hz));
      cap = Math.min(cap, ft.y + reach - vJ.y + (1 - ft.plant) * 0.3);
    }
    // Cojera: al cargar en la pierna mala, la cadera se hunde
    if (Math.abs(this.limpW) > 0.3) {
      const bad = this.limpW < 0 ? FT[0] : FT[1];
      cap -= 0.035 * bad.plant * walk * Math.abs(this.limpW);
    }
    root.position.y = lerp(root.position.y, Math.min(root.position.y, cap), w);
    for (let i = 0; i < 2; i++) this.solveLeg(i === 0 ? 1 : -1, FT[i], w);
  }

  /**
   * Cinemática inversa de una pierna (cadera → rodilla → tobillo) en el espacio
   * de la pelvis: la rodilla apunta hacia la punta del pie y el pie toma el
   * cabeceo y el giro pedidos.
   */
  private solveLeg(sg: 1 | -1, ft: FootTarget, w: number) {
    const bones = this.bones;
    const root = bones[0];
    const th = bones[sg > 0 ? B.thighL : B.thighR];
    const sh = bones[sg > 0 ? B.shinL : B.shinR];
    const fo = bones[sg > 0 ? B.footL : B.footR];
    qRootInv.copy(root.quaternion).invert();
    vA.set(ft.x, ft.y, ft.z).sub(root.position).applyQuaternion(qRootInv);
    vJ.set(sg * JX, JY, 0);
    tmpE.set(ft.pitch, ft.yaw, 0, 'YXZ');
    qFootM.setFromEuler(tmpE);
    qFootH.copy(qRootInv).multiply(qFootM);
    // La rodilla apunta hacia donde mira el pie (algo hacia fuera)
    vP.set(Math.sin(ft.yaw) + sg * 0.08, 0, Math.cos(ft.yaw)).applyQuaternion(qRootInv);
    v1.subVectors(vA, vJ);
    const d = clamp(v1.length(), Math.abs(L1 - L2) + 0.01, (L1 + L2) * 0.9995);
    v1.normalize();
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    v2.copy(vP).addScaledVector(v1, -vP.dot(v1));
    if (v2.lengthSq() < 1e-8) v2.set(0, 0, 1).addScaledVector(v1, -v1.z);
    v2.normalize();
    vK.copy(vJ).addScaledVector(v1, L1 * cosA).addScaledVector(v2, L1 * sinA);
    vW.copy(vJ).addScaledVector(v1, d);
    // Muslo: +Y de la rodilla a la cadera, X = eje de la bisagra
    xT.crossVectors(v2, v1).normalize();
    yT.subVectors(vJ, vK).normalize();
    zT.crossVectors(xT, yT).normalize();
    xT.crossVectors(yT, zT);
    mBasis.makeBasis(xT, yT, zT);
    qThigh.setFromRotationMatrix(mBasis);
    // Pantorrilla: misma bisagra
    yT.subVectors(vK, vW).normalize();
    zT.crossVectors(xT, yT).normalize();
    xT.crossVectors(yT, zT);
    mBasis.makeBasis(xT, yT, zT);
    qShinH.setFromRotationMatrix(mBasis);
    th.quaternion.slerp(qThigh, w);
    qTmp.copy(qThigh).invert().multiply(qShinH);
    sh.quaternion.slerp(qTmp, w);
    qTmp.copy(qShinH).invert().multiply(qFootH);
    fo.quaternion.slerp(qTmp, w);
  }

  /** Dedos: abiertos y algo curvados en reposo, cerrados en puño al empuñar. */
  private fingers(s: AnimInput, dt: number, wasFirst: boolean) {
    const bones = this.bones;
    if (bones.length <= B.thumbR) return;
    const limp = s.pose === 'ko' || s.pose === 'muerto' || s.pose === 'cargado';
    const fist = s.attack === 'punetazo' ? 1 : 0;
    const scratch = this.fid === 'rascar' ? 0.55 : 0;
    const tR = limp ? 0.2 : s.armed ? 1 : Math.max(fist, s.work === 'cargarCaja' ? 0.45 : s.work === 'calentarse' || s.work === 'hablar' ? 0.02 : 0.16 + 0.3 * smoothstep(2.5, 4.5, this.v));
    const tL = limp ? 0.2 : Math.max(s.offHand, fist, scratch, s.work === 'cargarCaja' ? 0.45 : s.work === 'pico' ? 1 : s.work === 'calentarse' ? 0.02 : 0.16 + 0.3 * smoothstep(2.5, 4.5, this.v));
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
