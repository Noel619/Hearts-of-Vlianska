// Modelo humano procedural con esqueleto. A partir de un `Look` genera una
// única malla con skinning: cuerpo, cara, pelo, ropa, sombrero, máscara,
// chaleco, mochila y complementos.

import type * as THREE from 'three';
import type { Look } from '../../data/looks';
import { hash2 } from '../../core/math';
import { lin, mixc, scalec, type RGB } from '../geo';
import { SkinBuilder, type BoneDef, type W } from './skin';

/** Medidas de la mano en reposo (brazo caído): alturas de muñeca, nudillos y falange. */
export const HAND = { wrist: 0.87, knuckle: 0.787, joint: 0.743, thumbY: 0.852, thumbZ: 0.03, palm: 0.017 } as const;

export const HUMAN_BONES: BoneDef[] = [
  { name: 'hips', parent: -1, pos: [0, 0.98, 0] },
  { name: 'spine', parent: 0, pos: [0, 1.1, 0] },
  { name: 'chest', parent: 1, pos: [0, 1.28, 0] },
  { name: 'neck', parent: 2, pos: [0, 1.5, 0] },
  { name: 'head', parent: 3, pos: [0, 1.57, 0] },
  { name: 'shoulderL', parent: 2, pos: [0.07, 1.44, 0] },
  { name: 'upperArmL', parent: 5, pos: [0.205, 1.43, 0] },
  { name: 'forearmL', parent: 6, pos: [0.205, 1.13, 0] },
  { name: 'handL', parent: 7, pos: [0.205, 0.87, 0] },
  { name: 'shoulderR', parent: 2, pos: [-0.07, 1.44, 0] },
  { name: 'upperArmR', parent: 9, pos: [-0.205, 1.43, 0] },
  { name: 'forearmR', parent: 10, pos: [-0.205, 1.13, 0] },
  { name: 'handR', parent: 11, pos: [-0.205, 0.87, 0] },
  { name: 'thighL', parent: 0, pos: [0.1, 0.94, 0] },
  { name: 'shinL', parent: 13, pos: [0.1, 0.52, 0] },
  { name: 'footL', parent: 14, pos: [0.1, 0.09, 0] },
  { name: 'thighR', parent: 0, pos: [-0.1, 0.94, 0] },
  { name: 'shinR', parent: 16, pos: [-0.1, 0.52, 0] },
  { name: 'footR', parent: 17, pos: [-0.1, 0.09, 0] },
  // Dedos: los cuatro dedos se doblan juntos por dos falanges; el pulgar, aparte
  { name: 'fingersL', parent: 8, pos: [0.205, HAND.knuckle, 0] },
  { name: 'tipsL', parent: 19, pos: [0.205, HAND.joint, 0] },
  { name: 'thumbL', parent: 8, pos: [0.205, HAND.thumbY, HAND.thumbZ] },
  { name: 'fingersR', parent: 12, pos: [-0.205, HAND.knuckle, 0] },
  { name: 'tipsR', parent: 22, pos: [-0.205, HAND.joint, 0] },
  { name: 'thumbR', parent: 12, pos: [-0.205, HAND.thumbY, HAND.thumbZ] },
];

export const HB = {
  hips: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  shoulderL: 5,
  upperArmL: 6,
  forearmL: 7,
  handL: 8,
  shoulderR: 9,
  upperArmR: 10,
  forearmR: 11,
  handR: 12,
  thighL: 13,
  shinL: 14,
  footL: 15,
  thighR: 16,
  shinR: 17,
  footR: 18,
  fingersL: 19,
  tipsL: 20,
  thumbL: 21,
  fingersR: 22,
  tipsR: 23,
  thumbR: 24,
} as const;

interface Sec {
  y: number;
  rx: number;
  rz: number;
  w: W;
  c: RGB;
  cx?: number;
  cz?: number;
  shape?: number;
}

/** Columna de anillos horizontales unidos. Devuelve los índices de anillo. */
function column(sb: SkinBuilder, secs: Sec[], n: number, capTop = false, capBottom = false): number[] {
  const rings: number[] = [];
  for (let i = 0; i < secs.length; i++) {
    const s = secs[i];
    sb.color(s.c);
    rings.push(sb.ring(s.cx ?? 0, s.y, s.cz ?? 0, s.rx, s.rz, n, 'y', s.w, s.shape ?? 2));
    if (i > 0) {
      const p = secs[i - 1];
      sb.bridge(rings[i - 1], rings[i], n, ((p.cx ?? 0) + (s.cx ?? 0)) / 2, (p.y + s.y) / 2, ((p.cz ?? 0) + (s.cz ?? 0)) / 2);
    }
  }
  if (capTop) {
    const s = secs[secs.length - 1];
    const up = s.y >= secs[0].y ? 1 : -1;
    sb.color(s.c);
    sb.fan(rings[rings.length - 1], n, s.cx ?? 0, s.y + up * Math.min(s.rx, s.rz) * 0.35, s.cz ?? 0, s.w, 0, up, 0);
  }
  if (capBottom) {
    const s = secs[0];
    const up = secs[secs.length - 1].y >= s.y ? -1 : 1;
    sb.color(s.c);
    sb.fan(rings[0], n, s.cx ?? 0, s.y + up * Math.min(s.rx, s.rz) * 0.35, s.cz ?? 0, s.w, 0, up, 0);
  }
  return rings;
}

const TOP_PAD: Record<Look['top'], number> = {
  camisa: 0.004,
  guerrera: 0.012,
  chaqueton: 0.03,
  abrigo: 0.022,
  tunica: 0.014,
  harapos: 0.012,
  mono: 0.012,
  traje: 0.012,
  cuero: 0.016,
};

/** Largo del faldón: altura del dobladillo (m) o null si la prenda va por dentro. */
const HEM: Record<Look['top'], number | null> = {
  camisa: null,
  guerrera: 0.88,
  chaqueton: 0.86,
  abrigo: 0.5,
  tunica: 0.18,
  harapos: 0.78,
  mono: null,
  traje: 0.84,
  cuero: 0.88,
};

export function buildHumanoid(look: Look): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const B = HB;
  const rnd = (i: number) => hash2(look.seed, i, 91);
  const skin = lin(look.skin);
  const hairBase = lin(look.hairColor);
  const hair = look.age === 2 ? mixc(hairBase, [0.55, 0.55, 0.54], 0.75) : hairBase;
  const top = lin(look.topColor);
  const pants = look.top === 'mono' ? top : lin(look.pantsColor);
  const boots = lin(look.bootsColor);
  const pad = TOP_PAD[look.top];
  const k = 1 + look.build * 0.13;
  const fem = look.female;
  const shW = (fem ? 0.166 : 0.19) * (1 + look.build * 0.07);
  const hipW = (fem ? 0.182 : 0.172) * k;
  const waistW = (fem ? 0.13 : 0.15) * k;
  const dep = k * (fem ? 0.95 : 1);
  const N = 10;

  // --- Pelvis y torso -----------------------------------------------------
  const longSkirt = HEM[look.top] !== null && HEM[look.top]! < 0.7;
  column(
    sb,
    [
      { y: 0.84, rx: 0.1 * k, rz: 0.085 * dep, w: [[B.hips, 1]], c: scalec(pants, 0.8) },
      { y: 0.9, rx: hipW * 0.95, rz: 0.108 * dep, w: [[B.hips, 1]], c: pants },
      { y: 0.97, rx: hipW, rz: 0.115 * dep, w: [[B.hips, 1]], c: pants },
      { y: 1.04, rx: waistW + 0.012, rz: 0.108 * dep, w: [[B.hips, 0.6], [B.spine, 0.4]], c: pants },
    ],
    N,
    false,
    true,
  );
  const quilted = look.top === 'chaqueton';
  const torso: Sec[] = [];
  const tsec = (y: number, rx: number, rz: number, w: W, shade = 1) => torso.push({ y, rx: rx + pad, rz: rz + pad, w, c: scalec(top, shade) });
  tsec(1.03, waistW + 0.006, 0.106 * dep, [[B.hips, 0.6], [B.spine, 0.4]], 0.88);
  tsec(1.09, waistW, 0.105 * dep, [[B.spine, 1]]);
  if (quilted) tsec(1.125, waistW + 0.012, 0.112 * dep, [[B.spine, 1]], 1.06);
  tsec(1.16, waistW + 0.006, 0.11 * dep, [[B.spine, 1]], quilted ? 0.9 : 1);
  if (quilted) tsec(1.21, waistW + 0.026, 0.12 * dep, [[B.spine, 0.7], [B.chest, 0.3]], 1.06);
  tsec(1.26, shW * 0.93, 0.12 * dep + (fem ? 0.012 : 0), [[B.spine, 0.5], [B.chest, 0.5]], quilted ? 0.9 : 1);
  if (quilted) tsec(1.31, shW * 0.99, 0.128 * dep, [[B.chest, 1]], 1.06);
  tsec(1.36, shW, 0.126 * dep + (fem ? 0.014 : 0), [[B.chest, 1]], quilted ? 0.92 : 1);
  tsec(1.43, shW * 0.98, 0.112 * dep, [[B.chest, 1]]);
  tsec(1.475, 0.1, 0.085, [[B.chest, 0.75], [B.neck, 0.25]], 0.92);
  column(sb, torso, N);
  // Cuello de la prenda
  const collar = look.top === 'camisa' || look.top === 'harapos' || look.top === 'tunica' ? 0 : 0.016;
  column(
    sb,
    [
      { y: 1.47, rx: 0.072 + collar, rz: 0.07 + collar, w: [[B.chest, 0.6], [B.neck, 0.4]], c: collar ? scalec(top, 0.85) : skin },
      { y: 1.51, rx: 0.058 + collar, rz: 0.062 + collar, w: [[B.neck, 1]], c: collar ? scalec(top, 0.9) : skin },
    ],
    N,
  );
  column(
    sb,
    [
      { y: 1.5, rx: 0.054, rz: 0.058, w: [[B.neck, 1]], c: scalec(skin, 0.85) },
      { y: 1.585, rx: 0.052, rz: 0.057, w: [[B.neck, 0.5], [B.head, 0.5]], c: scalec(skin, 0.9), cz: 0.004 },
    ],
    N,
  );

  // --- Faldón de la prenda -------------------------------------------------
  const hem = HEM[look.top];
  if (hem !== null) {
    const y0 = 1.035;
    const steps = longSkirt ? 5 : 2;
    let prev = -1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = y0 + (hem - y0) * t;
      const flare = longSkirt ? 0.07 : 0.022;
      const rx = (i === 0 ? waistW + 0.008 : hipW + 0.012) + pad + flare * t;
      const rz = (i === 0 ? 0.108 : 0.122) * dep + pad + flare * t;
      const rag = look.top === 'harapos' && i === steps;
      sb.color(top, 0.94 - t * 0.14);
      const ring = sb.ring(0, y, 0, rx, rz, N + 2, 'y', undefined, 2, (kk, a) => {
        // El faldón sigue a las piernas: más cuanto más abajo
        const side = Math.cos(a);
        const f = Math.min(0.62, t * (longSkirt ? 0.7 : 0.35));
        const l = f * Math.max(0, Math.min(1, 0.5 + side * 1.2));
        const r = f * Math.max(0, Math.min(1, 0.5 - side * 1.2));
        const lower = t > 0.75 && longSkirt ? 0.25 * (t - 0.75) * 4 : 0;
        return [
          [B.hips, 1 - l - r],
          [B.thighL, l * (1 - lower)],
          [B.thighR, r * (1 - lower)],
          [side > 0 ? B.shinL : B.shinR, (l + r) * lower],
        ];
      });
      if (rag) {
        for (let q = 0; q < N + 2; q++) sb.pos[(ring + q) * 3 + 1] += (hash2(q, look.seed, 5) - 0.5) * 0.1;
      }
      if (look.top === 'abrigo' || look.top === 'traje' || look.top === 'cuero' || look.top === 'chaqueton') {
        // Abertura delantera: línea oscura en el centro
        const fq = Math.round((N + 2) / 4);
        for (let c = 0; c < 3; c++) sb.col[(ring + fq) * 3 + c] *= 0.55;
      }
      if (prev >= 0) sb.bridge(prev, ring, N + 2, 0, y, 0);
      prev = ring;
    }
  }

  // --- Cinturón ---------------------------------------------------------------
  const leather: RGB = [0.07, 0.045, 0.03];
  if (look.top !== 'tunica' && look.top !== 'harapos') {
    const br = pad + 0.012;
    column(
      sb,
      [
        { y: 1.0, rx: waistW + br + 0.012, rz: 0.108 * dep + br + 0.008, w: [[B.hips, 0.7], [B.spine, 0.3]], c: leather },
        { y: 1.045, rx: waistW + br + 0.006, rz: 0.106 * dep + br + 0.006, w: [[B.hips, 0.6], [B.spine, 0.4]], c: scalec(leather, 1.3) },
      ],
      N,
    );
    sb.color([0.5, 0.4, 0.16]).box(0, 1.022, 0.108 * dep + br + 0.012, 0.045, 0.04, 0.012, [[B.hips, 0.7], [B.spine, 0.3]]);
  } else if (look.top === 'tunica') {
    // Fajín de tela
    column(
      sb,
      [
        { y: 0.99, rx: waistW + pad + 0.02, rz: 0.11 * dep + pad + 0.016, w: [[B.hips, 0.7], [B.spine, 0.3]], c: scalec(top, 0.6) },
        { y: 1.06, rx: waistW + pad + 0.016, rz: 0.108 * dep + pad + 0.014, w: [[B.hips, 0.5], [B.spine, 0.5]], c: scalec(top, 0.7) },
      ],
      N,
    );
  }

  // --- Brazos --------------------------------------------------------------------
  const gloves = look.gloves !== undefined ? lin(look.gloves) : null;
  const sleeve = look.top === 'harapos' ? mixc(top, skin, 0.0) : top;
  const armR = 0.05 * (1 + look.build * 0.1) * (fem ? 0.9 : 1);
  for (const s of [1, -1]) {
    const sh = s > 0 ? B.shoulderL : B.shoulderR;
    const ua = s > 0 ? B.upperArmL : B.upperArmR;
    const fa = s > 0 ? B.forearmL : B.forearmR;
    const hd = s > 0 ? B.handL : B.handR;
    const x = 0.205 * s * (shW / 0.19);
    const handC = gloves ?? skin;
    const bare = look.top === 'harapos' && rnd(s + 5) > 0.5;
    const lower = bare ? skin : sleeve;
    const f1 = s > 0 ? B.fingersL : B.fingersR;
    const f2 = s > 0 ? B.tipsL : B.tipsR;
    const th = s > 0 ? B.thumbL : B.thumbR;
    // Brazo y palma: la palma mira hacia el cuerpo
    column(
      sb,
      [
        { y: HAND.knuckle - 0.004, rx: HAND.palm * 0.8, rz: 0.04, w: [[hd, 1]], c: scalec(handC, 0.88), cx: x, shape: 3 },
        { y: HAND.knuckle + 0.012, rx: HAND.palm, rz: 0.044, w: [[hd, 1]], c: handC, cx: x, shape: 3 },
        { y: 0.84, rx: HAND.palm * 1.06, rz: 0.042, w: [[hd, 1]], c: handC, cx: x, shape: 2.6 },
        { y: 0.866, rx: 0.021, rz: 0.031, w: [[hd, 0.6], [fa, 0.4]], c: handC, cx: x },
        { y: 0.885, rx: armR * 0.66 + pad * 0.9, rz: armR * 0.7 + pad * 0.9, w: [[fa, 0.8], [hd, 0.2]], c: scalec(lower, 0.82), cx: x },
        { y: 1.0, rx: armR * 0.82 + pad, rz: armR * 0.86 + pad, w: [[fa, 1]], c: lower, cx: x },
        { y: 1.09, rx: armR * 0.88 + pad, rz: armR * 0.9 + pad, w: [[fa, 0.85], [ua, 0.15]], c: lower, cx: x },
        { y: 1.13, rx: armR * 0.86 + pad, rz: armR * 0.88 + pad, w: [[fa, 0.5], [ua, 0.5]], c: scalec(sleeve, 0.9), cx: x },
        { y: 1.17, rx: armR * 0.9 + pad, rz: armR * 0.92 + pad, w: [[ua, 0.85], [fa, 0.15]], c: sleeve, cx: x },
        { y: 1.28, rx: armR * 0.98 + pad, rz: armR + pad, w: [[ua, 1]], c: sleeve, cx: x },
        { y: 1.38, rx: armR * 1.08 + pad, rz: armR * 1.12 + pad, w: [[ua, 0.8], [sh, 0.2]], c: sleeve, cx: x },
        { y: 1.44, rx: armR * 1.02 + pad, rz: armR * 1.06 + pad, w: [[ua, 0.5], [sh, 0.5]], c: sleeve, cx: x - s * 0.008 },
        { y: 1.475, rx: armR * 0.62 + pad, rz: armR * 0.7 + pad, w: [[sh, 0.7], [ua, 0.3]], c: scalec(sleeve, 0.95), cx: x - s * 0.025 },
      ],
      8,
      true,
      true,
    );
    // Cuatro dedos de dos falanges (índice hacia delante) y pulgar
    const FZ = [0.0305, 0.0105, -0.0095, -0.029];
    const FL = [0.038, 0.043, 0.039, 0.03];
    const FW = [0.0092, 0.0096, 0.0092, 0.0084];
    for (let k = 0; k < 4; k++) {
      const z = FZ[k];
      const r = FW[k];
      const dark = scalec(handC, 0.9);
      column(
        sb,
        [
          { y: HAND.knuckle + 0.006, rx: r * 0.95, rz: r, w: [[hd, 1]], c: handC, cx: x, cz: z, shape: 2.8 },
          { y: HAND.knuckle - 0.004, rx: r, rz: r, w: [[hd, 0.45], [f1, 0.55]], c: handC, cx: x, cz: z, shape: 2.8 },
          { y: HAND.joint + 0.012, rx: r * 0.96, rz: r * 0.98, w: [[f1, 1]], c: handC, cx: x, cz: z, shape: 2.8 },
          { y: HAND.joint, rx: r * 0.94, rz: r * 0.96, w: [[f1, 0.5], [f2, 0.5]], c: dark, cx: x, cz: z, shape: 2.8 },
          { y: HAND.joint - 0.012, rx: r * 0.9, rz: r * 0.94, w: [[f2, 1]], c: handC, cx: x, cz: z, shape: 2.8 },
          { y: HAND.joint - FL[k], rx: r * 0.74, rz: r * 0.8, w: [[f2, 1]], c: dark, cx: x, cz: z, shape: 2.4 },
        ],
        6,
        true,
        false,
      );
    }
    column(
      sb,
      [
        { y: HAND.thumbY + 0.006, rx: 0.011, rz: 0.014, w: [[hd, 1]], c: handC, cx: x - s * 0.002, cz: HAND.thumbZ - 0.002 },
        { y: HAND.thumbY - 0.012, rx: 0.0115, rz: 0.0135, w: [[hd, 0.4], [th, 0.6]], c: handC, cx: x - s * 0.004, cz: HAND.thumbZ + 0.012 },
        { y: HAND.thumbY - 0.036, rx: 0.0105, rz: 0.012, w: [[th, 1]], c: handC, cx: x - s * 0.007, cz: HAND.thumbZ + 0.028 },
        { y: HAND.thumbY - 0.062, rx: 0.008, rz: 0.009, w: [[th, 1]], c: scalec(handC, 0.9), cx: x - s * 0.009, cz: HAND.thumbZ + 0.04 },
      ],
      6,
      true,
      false,
    );
    if (look.armband !== undefined && s > 0) {
      column(
        sb,
        [
          { y: 1.255, rx: armR + pad + 0.012, rz: armR + pad + 0.014, w: [[ua, 1]], c: lin(look.armband), cx: x },
          { y: 1.33, rx: armR * 1.05 + pad + 0.012, rz: armR * 1.07 + pad + 0.014, w: [[ua, 1]], c: lin(look.armband), cx: x },
        ],
        8,
      );
    }
    if (look.shoulderPads !== undefined) {
      sb.color(lin(look.shoulderPads));
      sb.blob(x + s * 0.01, 1.43, 0, 0.085, 0.07, 0.095, 8, 4, [[sh, 0.6], [ua, 0.4]], 0.45, 1);
    }
  }

  // --- Piernas ---------------------------------------------------------------------
  const robe = look.top === 'tunica';
  const legR = 0.078 * k * (fem ? 0.96 : 1);
  for (const s of [1, -1]) {
    const th = s > 0 ? B.thighL : B.thighR;
    const shn = s > 0 ? B.shinL : B.shinR;
    const ft = s > 0 ? B.footL : B.footR;
    const x = 0.1 * s;
    const bootTop = 0.37;
    column(
      sb,
      [
        { y: 0.105, rx: 0.045, rz: 0.05, w: [[shn, 0.5], [ft, 0.5]], c: scalec(boots, 0.9), cx: x },
        { y: 0.2, rx: 0.049, rz: 0.054, w: [[shn, 1]], c: boots, cx: x },
        { y: bootTop, rx: 0.062, rz: 0.066, w: [[shn, 1]], c: boots, cx: x, cz: -0.006 },
        { y: bootTop + 0.004, rx: 0.056, rz: 0.062, w: [[shn, 1]], c: scalec(pants, 0.82), cx: x, cz: -0.006 },
        { y: 0.47, rx: 0.058, rz: 0.06, w: [[shn, 0.85], [th, 0.15]], c: pants, cx: x },
        { y: 0.52, rx: 0.06, rz: 0.062, w: [[shn, 0.5], [th, 0.5]], c: scalec(pants, 0.9), cx: x, cz: 0.004 },
        { y: 0.57, rx: 0.062, rz: 0.064, w: [[th, 0.85], [shn, 0.15]], c: pants, cx: x },
        { y: 0.7, rx: legR * 0.9, rz: legR * 0.94, w: [[th, 1]], c: pants, cx: x },
        { y: 0.84, rx: legR * 1.02, rz: legR * 1.08, w: [[th, 0.85], [B.hips, 0.15]], c: pants, cx: x },
        { y: 0.92, rx: legR, rz: legR * 1.08, w: [[th, 0.5], [B.hips, 0.5]], c: pants, cx: x * 1.02 },
      ],
      8,
      true,
      false,
    );
    // Bota: cadena a lo largo de Z
    const ring = (z: number, rx: number, ry: number, cy: number, c: RGB) => {
      sb.color(c);
      return sb.ring(x, cy, z, rx, ry, 8, 'z', [[ft, 1]], 2.6);
    };
    const r0 = ring(-0.075, 0.04, 0.05, 0.055, scalec(boots, 0.8));
    const r1 = ring(-0.02, 0.048, 0.058, 0.062, boots);
    const r2 = ring(0.07, 0.05, 0.046, 0.05, boots);
    const r3 = ring(0.14, 0.048, 0.036, 0.04, boots);
    const r4 = ring(0.185, 0.034, 0.024, 0.03, scalec(boots, 0.85));
    sb.bridge(r0, r1, 8, x, 0.055, -0.05);
    sb.bridge(r1, r2, 8, x, 0.055, 0.02);
    sb.bridge(r2, r3, 8, x, 0.045, 0.1);
    sb.bridge(r3, r4, 8, x, 0.035, 0.16);
    sb.fan(r0, 8, x, 0.055, -0.092, [[ft, 1]], 0, 0, -1);
    sb.fan(r4, 8, x, 0.03, 0.2, [[ft, 1]], 0, 0, 1);
    if (look.kneePads !== undefined) {
      sb.color(lin(look.kneePads));
      sb.blob(x, 0.52, 0.045, 0.05, 0.065, 0.035, 7, 4, [[shn, 0.5], [th, 0.5]]);
    }
  }
  void robe;

  // --- Cabeza ----------------------------------------------------------------------
  const HW: W = [[B.head, 1]];
  const masked = look.mask === 'antigas' || look.hat === 'pasamontanas';
  const rubber: RGB = look.mask === 'antigas' ? [0.1, 0.105, 0.1] : lin(look.hatColor);
  const faceC = masked ? rubber : skin;
  const stub = !masked && look.facial === 'barba3' ? mixc(skin, hair, 0.32) : faceC;
  const hs = fem ? 1.02 : 1.07;
  column(
    sb,
    [
      { y: 1.572, rx: 0.04 * hs, rz: 0.05 * hs, w: HW, c: scalec(stub, 0.9), cz: 0.022 },
      { y: 1.6, rx: 0.068 * hs, rz: 0.082 * hs, w: HW, c: stub, cz: 0.012 },
      { y: 1.64, rx: 0.08 * hs, rz: 0.094 * hs, w: HW, c: stub, cz: 0.006 },
      { y: 1.685, rx: 0.084 * hs, rz: 0.098 * hs, w: HW, c: faceC, cz: 0.002 },
      { y: 1.73, rx: 0.083 * hs, rz: 0.097 * hs, w: HW, c: faceC, cz: -0.002 },
      { y: 1.768, rx: 0.07 * hs, rz: 0.084 * hs, w: HW, c: faceC, cz: -0.006 },
      { y: 1.792, rx: 0.042 * hs, rz: 0.052 * hs, w: HW, c: faceC, cz: -0.008 },
    ],
    12,
    true,
    true,
  );
  if (!masked) {
    // Nariz, orejas, ojos y cejas
    sb.color(scalec(skin, 0.96)).blob(0, 1.662, 0.098 * hs, 0.014, 0.026, 0.02, 6, 3, HW);
    for (const s of [1, -1]) {
      sb.color(scalec(skin, 0.88)).blob(s * 0.085 * hs, 1.672, -0.004, 0.012, 0.026, 0.017, 6, 3, HW);
      sb.color([0.82, 0.8, 0.76]).blob(s * 0.033, 1.692, 0.083 * hs, 0.014, 0.009, 0.01, 6, 3, HW);
      sb.color([0.03, 0.025, 0.02]).blob(s * 0.033, 1.692, 0.09 * hs, 0.007, 0.007, 0.005, 5, 3, HW);
      sb.color(scalec(hair, 0.8)).box(s * 0.034, 1.711, 0.087 * hs, 0.03, 0.007, 0.012, HW, -s * 0.12);
    }
    // Boca
    sb.color(scalec(skin, 0.55)).box(0, 1.622, 0.086 * hs, 0.034, 0.005, 0.01, HW);
    if (look.scar) sb.color([0.42, 0.14, 0.12]).box(0.05, 1.65, 0.078, 0.006, 0.05, 0.012, HW, 0.5);
  }

  // Pelo
  const hatCovers = look.hat !== 'nada' && look.hat !== 'panuelo' && look.hat !== 'boina' && look.hat !== 'kufi';
  if (!masked && look.hair !== 'calvo') {
    const hc = look.hair === 'rapado' ? mixc(skin, hair, 0.55) : hair;
    sb.color(hc);
    const thick = look.hair === 'rapado' ? 0.003 : 0.012;
    if (!hatCovers || look.hair === 'rapado') sb.blob(0, 1.715, -0.012, (0.086 + thick) * hs, 0.098 + thick, (0.1 + thick) * hs, 12, 5, HW, 0.5, 1);
    // Parte trasera y laterales
    sb.blob(0, 1.69, -0.028, (0.083 + thick) * hs, 0.075, (0.085 + thick) * hs, 12, 4, HW, 0.25, 0.75);
    if (look.hair === 'largo') {
      sb.blob(0, 1.6, -0.05, 0.088 * hs, 0.13, 0.07, 10, 5, [[B.head, 0.7], [B.neck, 0.3]]);
    } else if (look.hair === 'mono') {
      sb.blob(0, 1.735, -0.105, 0.04, 0.04, 0.04, 8, 5, HW);
    }
  }
  // Vello facial
  if (!masked && look.mask !== 'respirador' && look.mask !== 'panuelo') {
    sb.color(scalec(hair, 0.9));
    if (look.facial === 'bigote' || look.facial === 'barba' || look.facial === 'barbaLarga') sb.box(0, 1.636, 0.09 * hs, 0.05, 0.012, 0.014, HW);
    if (look.facial === 'barba') sb.blob(0, 1.6, 0.024, 0.07, 0.05, 0.072, 10, 4, HW, 0, 0.72);
    if (look.facial === 'barbaLarga') sb.blob(0, 1.575, 0.03, 0.072, 0.085, 0.07, 10, 5, HW, 0, 0.78);
  }
  if (look.eyepatch && !masked) {
    sb.color([0.03, 0.03, 0.03]).blob(0.034, 1.692, 0.088, 0.024, 0.02, 0.012, 6, 3, HW);
    sb.box(0, 1.705, 0, 0.176, 0.008, 0.2, HW);
  }
  if (look.glasses && !masked && look.mask === 'nada') {
    sb.color([0.05, 0.05, 0.05]);
    for (const s of [1, -1]) {
      sb.box(s * 0.034, 1.692, 0.098, 0.036, 0.004, 0.004, HW);
      sb.box(s * 0.034, 1.676, 0.098, 0.036, 0.004, 0.004, HW);
      sb.box(s * 0.052, 1.684, 0.098, 0.004, 0.02, 0.004, HW);
      sb.box(s * 0.07, 1.69, 0.05, 0.004, 0.004, 0.1, HW);
    }
    sb.box(0, 1.69, 0.098, 0.03, 0.004, 0.004, HW);
  }

  // --- Sombreros -------------------------------------------------------------------
  const hatC = lin(look.hatColor);
  switch (look.hat) {
    case 'gorra':
      sb.color(hatC).blob(0, 1.738, -0.006, 0.1, 0.086, 0.114, 12, 4, HW, 0.42, 1);
      sb.color(scalec(hatC, 0.7)).box(0, 1.742, 0.128, 0.12, 0.012, 0.075, HW);
      break;
    case 'plato': {
      column(
        sb,
        [
          { y: 1.745, rx: 0.096, rz: 0.11, w: HW, c: scalec(hatC, 0.55) },
          { y: 1.79, rx: 0.098, rz: 0.112, w: HW, c: hatC },
          { y: 1.825, rx: 0.13, rz: 0.142, w: HW, c: hatC, cz: 0.006 },
          { y: 1.84, rx: 0.125, rz: 0.136, w: HW, c: scalec(hatC, 1.1), cz: 0.006 },
        ],
        12,
        true,
      );
      sb.color([0.03, 0.03, 0.03]).box(0, 1.748, 0.135, 0.13, 0.01, 0.07, HW);
      sb.color([0.62, 0.5, 0.18]).box(0, 1.782, 0.115, 0.03, 0.03, 0.008, HW);
      break;
    }
    case 'ushanka':
      sb.color(hatC).blob(0, 1.73, -0.004, 0.106, 0.096, 0.118, 12, 4, HW, 0.4, 1);
      sb.color(scalec(hatC, 0.82));
      for (const s of [1, -1]) sb.blob(s * 0.099, 1.665, -0.004, 0.022, 0.075, 0.055, 6, 4, HW);
      sb.blob(0, 1.76, 0.1, 0.07, 0.036, 0.022, 8, 3, HW);
      sb.blob(0, 1.68, -0.1, 0.075, 0.06, 0.024, 8, 4, HW);
      break;
    case 'boina':
      sb.color(hatC).blob(0.022, 1.79, -0.006, 0.118, 0.042, 0.122, 12, 4, HW);
      sb.color(scalec(hatC, 0.6)).blob(0, 1.762, -0.004, 0.094, 0.022, 0.108, 12, 2, HW, 0.3, 0.7);
      break;
    case 'casco':
      sb.color(hatC).blob(0, 1.722, -0.006, 0.114, 0.108, 0.13, 12, 5, HW, 0.47, 1);
      sb.color(scalec(hatC, 0.7)).blob(0, 1.725, -0.006, 0.122, 0.012, 0.138, 12, 2, HW, 0.3, 0.7);
      sb.color([0.07, 0.05, 0.03]).box(0.078, 1.63, 0.03, 0.006, 0.16, 0.014, HW).box(-0.078, 1.63, 0.03, 0.006, 0.16, 0.014, HW);
      break;
    case 'panuelo':
      sb.color(hatC).blob(0, 1.725, -0.008, 0.096, 0.096, 0.11, 12, 4, HW, 0.45, 1);
      sb.blob(0, 1.705, -0.116, 0.026, 0.026, 0.022, 6, 3, HW);
      sb.box(0.02, 1.66, -0.12, 0.022, 0.07, 0.008, HW, 0.2);
      break;
    case 'kufi':
      column(
        sb,
        [
          { y: 1.75, rx: 0.092, rz: 0.106, w: HW, c: scalec(hatC, 0.85), cz: -0.004 },
          { y: 1.815, rx: 0.086, rz: 0.098, w: HW, c: hatC, cz: -0.006 },
        ],
        12,
        true,
      );
      break;
    case 'capucha': {
      // La capucha envuelve la nuca; por delante queda detrás del plano de la cara
      const rings: number[] = [];
      const hsecs: [number, number, number][] = [
        [1.5, 0.11, 0.1],
        [1.6, 0.108, 0.118],
        [1.7, 0.108, 0.124],
        [1.77, 0.092, 0.11],
        [1.815, 0.05, 0.06],
      ];
      hsecs.forEach(([y, rx, rz], i) => {
        sb.color(hatC, i === 0 ? 0.8 : 1);
        const w: W = i === 0 ? [[B.chest, 0.6], [B.neck, 0.4]] : HW;
        const r = sb.ring(0, y, -0.02, rx, rz, 12, 'y', w);
        for (let q = 0; q < 12; q++) {
          const p = (r + q) * 3;
          if (sb.pos[p + 2] > 0.045 && y < 1.76 && y > 1.52) sb.pos[p + 2] = 0.045;
        }
        rings.push(r);
        if (i > 0) sb.bridge(rings[i - 1], r, 12, 0, y - 0.04, -0.02);
      });
      sb.fan(rings[rings.length - 1], 12, 0, 1.83, -0.02, HW, 0, 1, 0);
      break;
    }
  }

  // --- Máscaras ----------------------------------------------------------------------
  if (look.mask === 'antigas') {
    const glass: RGB = [0.16, 0.24, 0.26];
    for (const s of [1, -1]) {
      sb.color([0.3, 0.3, 0.3]).blob(s * 0.036, 1.69, 0.086, 0.03, 0.03, 0.014, 8, 3, HW);
      sb.color(glass).glow(0.25).blob(s * 0.036, 1.69, 0.094, 0.023, 0.023, 0.008, 8, 3, HW);
      sb.glow(0);
    }
    // Filtro
    sb.color([0.2, 0.22, 0.18]);
    column(
      sb,
      [
        { y: 1.575, rx: 0.042, rz: 0.042, w: HW, c: [0.2, 0.22, 0.18], cz: 0.115 },
        { y: 1.63, rx: 0.042, rz: 0.042, w: HW, c: [0.24, 0.26, 0.21], cz: 0.105 },
        { y: 1.64, rx: 0.026, rz: 0.03, w: HW, c: [0.1, 0.1, 0.1], cz: 0.09 },
      ],
      8,
      true,
      true,
    );
  } else if (look.mask === 'respirador') {
    sb.color([0.14, 0.14, 0.14]).blob(0, 1.625, 0.07, 0.05, 0.042, 0.045, 8, 4, HW);
    sb.color([0.3, 0.32, 0.26]);
    for (const s of [1, -1]) sb.blob(s * 0.058, 1.615, 0.06, 0.026, 0.026, 0.02, 7, 3, HW);
    sb.color([0.08, 0.08, 0.08]).box(0, 1.65, 0, 0.176, 0.01, 0.2, HW);
  } else if (look.mask === 'gafas') {
    sb.color([0.08, 0.07, 0.06]).box(0, 1.692, 0, 0.18, 0.022, 0.205, HW);
    for (const s of [1, -1]) {
      sb.color([0.12, 0.1, 0.08]).blob(s * 0.036, 1.692, 0.088, 0.03, 0.026, 0.016, 8, 3, HW);
      sb.color([0.3, 0.2, 0.08]).glow(0.2).blob(s * 0.036, 1.692, 0.098, 0.022, 0.019, 0.008, 8, 3, HW);
      sb.glow(0);
    }
  } else if (look.mask === 'panuelo') {
    sb.color(look.scarf !== undefined ? lin(look.scarf) : [0.25, 0.2, 0.16]);
    sb.blob(0, 1.615, 0.012, 0.084, 0.058, 0.094, 10, 4, HW, 0.1, 0.95);
  }

  // --- Bufanda -----------------------------------------------------------------------
  if (look.scarf !== undefined && look.mask !== 'panuelo') {
    const sc = lin(look.scarf);
    column(
      sb,
      [
        { y: 1.475, rx: 0.1, rz: 0.098, w: [[B.chest, 0.7], [B.neck, 0.3]], c: scalec(sc, 0.8) },
        { y: 1.52, rx: 0.092, rz: 0.094, w: [[B.neck, 0.8], [B.chest, 0.2]], c: sc },
        { y: 1.565, rx: 0.08, rz: 0.085, w: [[B.neck, 0.7], [B.head, 0.3]], c: scalec(sc, 0.9) },
      ],
      10,
    );
    sb.color(scalec(sc, 0.85)).box(0.05, 1.36, 0.118 * dep + pad, 0.06, 0.2, 0.02, [[B.chest, 1]]);
  }

  // --- Chaleco, placas y bolsillos ---------------------------------------------------
  if (look.vest !== undefined) {
    const vc = lin(look.vest);
    const vp = pad + 0.028;
    column(
      sb,
      [
        { y: 1.06, rx: waistW + vp, rz: 0.108 * dep + vp, w: [[B.spine, 0.7], [B.hips, 0.3]], c: scalec(vc, 0.8) },
        { y: 1.16, rx: waistW + vp + 0.008, rz: 0.112 * dep + vp, w: [[B.spine, 1]], c: vc },
        { y: 1.27, rx: shW * 0.9 + vp, rz: 0.122 * dep + vp, w: [[B.spine, 0.5], [B.chest, 0.5]], c: vc },
        { y: 1.38, rx: shW * 0.86 + vp, rz: 0.126 * dep + vp, w: [[B.chest, 1]], c: vc },
        { y: 1.45, rx: shW * 0.66 + vp, rz: 0.11 * dep + vp, w: [[B.chest, 1]], c: scalec(vc, 0.9) },
      ],
      N,
      true,
    );
    if (look.vestPlates) {
      const pc: RGB = [0.2, 0.21, 0.22];
      sb.color(pc).box(0, 1.3, 0.125 * dep + vp + 0.01, 0.24, 0.22, 0.02, [[B.chest, 0.7], [B.spine, 0.3]]);
      sb.color(scalec(pc, 0.8)).box(0, 1.3, -(0.125 * dep + vp + 0.008), 0.26, 0.26, 0.02, [[B.chest, 0.7], [B.spine, 0.3]]);
    }
    if (look.pouches) {
      sb.color(scalec(vc, 0.72));
      for (const px of [-0.09, 0, 0.09]) sb.box(px, 1.12, 0.112 * dep + vp + 0.022, 0.07, 0.09, 0.04, [[B.spine, 1]]);
    }
  } else if (look.pouches) {
    sb.color([0.12, 0.09, 0.06]);
    for (const px of [-0.12, 0.12]) sb.box(px, 0.99, 0.115 * dep + pad + 0.03, 0.07, 0.08, 0.04, [[B.hips, 1]]);
  }
  if (look.bandolier) {
    const bc: RGB = [0.1, 0.07, 0.045];
    const zf = 0.125 * dep + pad + (look.vest !== undefined ? 0.04 : 0.012);
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = 0.15 - t * 0.3;
      const y = 1.42 - t * 0.36;
      sb.color(bc).box(x, y, zf * (1 - Math.abs(t - 0.5) * 0.1), 0.05, 0.085, 0.012, [[t < 0.5 ? B.chest : B.spine, 1]], 0, );
      if (i > 0 && i < 5) sb.color([0.6, 0.48, 0.18]).box(x, y, zf + 0.012, 0.03, 0.03, 0.014, [[t < 0.5 ? B.chest : B.spine, 1]]);
    }
  }
  if (look.medals) {
    const zf = 0.127 * dep + pad + 0.004;
    for (let i = 0; i < 3; i++) {
      sb.color(i === 1 ? [0.5, 0.08, 0.06] : [0.62, 0.5, 0.18]).box(0.06 + i * 0.03, 1.365, zf, 0.02, 0.035, 0.008, [[B.chest, 1]]);
    }
  }

  // --- Mochila -------------------------------------------------------------------------
  if (look.backpack !== undefined) {
    const bc = lin(look.backpack);
    const zb = -(0.125 * dep + pad + (look.vest !== undefined ? 0.03 : 0) + 0.085);
    const CW: W = [[B.chest, 0.7], [B.spine, 0.3]];
    sb.color(bc).box(0, 1.27, zb, 0.27, 0.36, 0.17, CW);
    sb.color(scalec(bc, 0.8)).box(0, 1.38, zb - 0.09, 0.2, 0.12, 0.03, CW);
    sb.color(scalec(bc, 0.7)).box(0, 1.16, zb - 0.095, 0.18, 0.11, 0.045, CW);
    // Manta enrollada
    sb.color([0.36, 0.33, 0.25]);
    const r0 = sb.ring(-0.16, 1.49, zb, 0.055, 0.055, 8, 'z', CW);
    void r0;
    sb.blob(0, 1.49, zb, 0.17, 0.055, 0.055, 8, 4, CW);
    // Correas
    sb.color(scalec(bc, 0.55));
    for (const s of [1, -1]) {
      sb.box(s * 0.11, 1.32, 0.126 * dep + pad + 0.008, 0.035, 0.3, 0.012, [[B.chest, 1]]);
      sb.box(s * 0.11, 1.475, 0, 0.035, 0.012, 0.22, [[B.chest, 1]]);
    }
  }

  return sb.finish();
}
