// Modelo humano procedural con esqueleto. A partir de un `Look` genera una
// única malla con skinning: tronco con anatomía (pecho, omóplatos, glúteos,
// trapecio y deltoides), cabeza esculpida (mandíbula, pómulos, cejas, ojos
// con iris y párpado, nariz, labios y orejas), pelo con su nacimiento, barbas,
// ropa con cuellos, botones, bolsillos y puños, botas con suela y tacón,
// sombrero, máscara, chaleco, mochila y complementos.

import type * as THREE from 'three';
import type { Look } from '../../data/looks';
import { clamp01, hash2, lerp, smoothstep } from '../../core/math';
import { lin, mixc, scalec, type RGB } from '../geo';
import { SkinBuilder, type BoneDef, type VOut, type W } from './skin';

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

const B = HB;
const PI = Math.PI;
const HALF = PI / 2;

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

/** Colores de iris: castaño, avellana, verde, azul, gris. */
const IRIS: RGB[] = [lin(0x3a2416), lin(0x5a3d1e), lin(0x6a5a2c), lin(0x3e5a3a), lin(0x3a5a78), lin(0x5a6670)];

/** Superelipse: coseno y seno «aplastados» con exponente e (2 = elipse, más = más cuadrada). */
const se = (v: number, e: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / e);
/** Campana gaussiana. */
const bell = (d: number, w: number) => Math.exp(-(d * d) / (w * w));
/** Diferencia angular más corta. */
const adiff = (a: number, b: number) => {
  let d = (a - b) % (2 * PI);
  if (d > PI) d -= 2 * PI;
  if (d < -PI) d += 2 * PI;
  return d;
};

// ---------------------------------------------------------------------------
// Cabeza: perfil por alturas (semiancho, fondo delante y detrás, centro, forma de la cara)
// ---------------------------------------------------------------------------

type HeadRow = [y: number, w: number, f: number, b: number, cz: number, e: number];
const HEAD: HeadRow[] = [
  [1.546, 0.04, 0.05, 0.044, 0.008, 2.0], // bajo la mandíbula, junto al cuello
  [1.563, 0.05, 0.072, 0.05, 0.012, 1.75], // barbilla por debajo
  [1.58, 0.058, 0.088, 0.058, 0.01, 1.7], // barbilla
  [1.6, 0.067, 0.093, 0.068, 0.006, 1.95], // mandíbula
  [1.622, 0.075, 0.096, 0.078, 0.004, 2.25], // boca
  [1.646, 0.081, 0.098, 0.086, 0.002, 2.45], // labio de arriba, mejillas
  [1.671, 0.085, 0.098, 0.092, 0, 2.6], // pómulos
  [1.697, 0.086, 0.095, 0.096, -0.002, 2.7], // ojos
  [1.72, 0.086, 0.098, 0.099, -0.004, 2.6], // cejas
  [1.744, 0.083, 0.092, 0.1, -0.006, 2.4], // frente
  [1.767, 0.075, 0.08, 0.097, -0.008, 2.2],
  [1.787, 0.061, 0.062, 0.084, -0.01, 2.05],
  [1.801, 0.04, 0.038, 0.058, -0.012, 2.0],
  [1.809, 0.016, 0.014, 0.02, -0.012, 2.0],
];
const HEAD_TOP = 1.812;

/** Perfil de la cabeza interpolado a una altura cualquiera. */
function headRow(y: number, out: HeadRow): HeadRow {
  const H = HEAD;
  if (y <= H[0][0]) {
    for (let i = 0; i < 6; i++) out[i] = H[0][i];
    out[0] = y;
    return out;
  }
  for (let i = 1; i < H.length; i++) {
    if (y <= H[i][0] || i === H.length - 1) {
      const a = H[i - 1];
      const b = H[i];
      const t = clamp01((y - a[0]) / (b[0] - a[0]));
      for (let j = 1; j < 6; j++) out[j] = a[j] + (b[j] - a[j]) * t;
      out[0] = y;
      return out;
    }
  }
  return out;
}

export function buildHumanoid(look: Look): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const rnd = (i: number) => hash2(look.seed, i, 91);
  const skin = lin(look.skin);
  const hairBase = lin(look.hairColor);
  const old = look.age === 2;
  const hair = old ? mixc(hairBase, [0.55, 0.55, 0.54], 0.75) : look.age === 1 && rnd(40) < 0.3 ? mixc(hairBase, [0.5, 0.5, 0.49], 0.25) : hairBase;
  const top = lin(look.topColor);
  const pants = look.top === 'mono' ? top : lin(look.pantsColor);
  const boots = lin(look.bootsColor);
  const pad = TOP_PAD[look.top];
  const k = 1 + look.build * 0.13;
  const fem = look.female;
  const shW = (fem ? 0.168 : 0.19) * (1 + look.build * 0.07);
  const hipW = (fem ? 0.182 : 0.168) * k;
  const waistW = (fem ? 0.126 : 0.148) * k;
  const ribW = (fem ? 0.146 : 0.168) * k;
  const dep = k * (fem ? 0.95 : 1);
  const belly = Math.max(0, look.build - 0.2) * (old ? 1.3 : 1);
  const N = 20;
  const leather: RGB = [0.07, 0.045, 0.03];

  // --- Pelvis (pantalón) --------------------------------------------------------
  // Va por dentro de la prenda de arriba; la entrepierna queda tapada por los muslos
  const hipWt = (y: number): W => (y < 0.97 ? [[B.hips, 1]] : [[B.hips, 1 - (y - 0.97) / 0.09], [B.spine, (y - 0.97) / 0.09]]);
  const glute = fem ? 0.024 : 0.017;
  {
    const secs: [number, number, number, number][] = [
      // y, semiancho, delante, detrás
      [0.862, 0.118 * k, 0.074 * dep, 0.086 * dep],
      [0.905, hipW * 0.96, 0.094 * dep, 0.108 * dep],
      [0.95, hipW, 0.102 * dep, 0.108 * dep],
      [1.0, (hipW + waistW) / 2 + 0.006, 0.106 * dep + belly * 0.02, 0.098 * dep],
      [1.055, waistW + 0.014, 0.108 * dep + belly * 0.03, 0.094 * dep],
    ];
    const rings: number[] = [];
    const centers: [number, number, number][] = [];
    for (const [y, w, f, b] of secs) {
      rings.push(
        sb.ringBy(N, (a, _k, o) => {
          const c = Math.cos(a);
          const s = Math.sin(a);
          let x = w * se(c, 2.3);
          let z = (s >= 0 ? f : b) * se(s, 2.3);
          // Glúteos: dos lóbulos detrás
          const g = glute * bell(y - 0.915, 0.04) * (bell(adiff(a, 1.5 * PI - 0.45), 0.42) + bell(adiff(a, 1.5 * PI + 0.45), 0.42));
          z -= g * Math.max(0, -s);
          x += g * c * 0.3;
          o.x = x;
          o.y = y;
          o.z = z;
          o.c = pants;
          o.w = hipWt(y);
        }),
      );
      centers.push([0, y, 0]);
    }
    sb.loft(rings, N, centers);
    sb.color(pants).fan(rings[0], N, 0, 0.835, 0.004, [[B.hips, 1]], 0, -1, 0);
  }

  // --- Tronco (prenda de arriba) -----------------------------------------------------
  const quilted = look.top === 'chaqueton';
  const vneck = look.top === 'camisa' || look.top === 'harapos';
  const torsoWt = (y: number): W => {
    if (y < 0.97) return [[B.hips, 1]];
    if (y < 1.06) return [[B.hips, 1 - (y - 0.97) / 0.09], [B.spine, (y - 0.97) / 0.09]];
    if (y < 1.19) return [[B.spine, 1]];
    if (y < 1.31) return [[B.spine, 1 - (y - 1.19) / 0.12], [B.chest, (y - 1.19) / 0.12]];
    if (y < 1.455) return [[B.chest, 1]];
    const t = clamp01((y - 1.455) / 0.06);
    return [[B.chest, 1 - t * 0.6], [B.neck, t * 0.6]];
  };
  type TS = [y: number, w: number, f: number, b: number, cz: number, e: number];
  const TORSO: TS[] = [
    [1.03, waistW + 0.006, 0.106 * dep + belly * 0.03, 0.095 * dep, 0.002, 2.3],
    [1.09, waistW, 0.106 * dep + belly * 0.035, 0.09 * dep, 0.004, 2.3],
    [1.15, (waistW + ribW) / 2, 0.11 * dep + belly * 0.025, 0.096 * dep, 0.003, 2.3],
    [1.21, ribW, 0.117 * dep, 0.105 * dep, 0, 2.35],
    [1.27, shW * 0.93, 0.123 * dep, 0.113 * dep, -0.002, 2.4],
    [1.33, shW * 0.97, 0.125 * dep, 0.118 * dep, -0.004, 2.45],
    [1.385, shW, 0.118 * dep, 0.118 * dep, -0.006, 2.5],
    [1.43, shW * 0.94, 0.102 * dep, 0.107 * dep, -0.008, 2.45],
    [1.462, shW * 0.7, 0.083, 0.09, -0.01, 2.2],
    [1.488, 0.096, 0.07, 0.073, -0.006, 2.1],
    [1.505, 0.074, 0.064, 0.065, -0.002, 2.0],
  ];
  {
    const rings: number[] = [];
    const centers: [number, number, number][] = [];
    const pecs = fem ? 0 : 0.008 * (1 + look.build * 0.6);
    const bust = fem ? 0.03 + 0.008 * look.build : 0;
    for (const [y, w0, f0, b0, cz, e] of TORSO) {
      const w = w0 + pad;
      const f = f0 + pad;
      const b = b0 + pad;
      // Pespuntes del acolchado (anillos más claros y más oscuros)
      const q = quilted ? 1 + 0.06 * Math.sin((y - 1.03) * 2 * PI / 0.06) : 1;
      rings.push(
        sb.ringBy(N, (a, _k, o) => {
          const c = Math.cos(a);
          const s = Math.sin(a);
          let x = w * se(c, e);
          let z = (s >= 0 ? f : b) * se(s, e);
          // Pecho o busto: dos lóbulos delante; omóplatos: dos detrás
          const front = Math.max(0, s);
          const lobes = bell(adiff(a, HALF - 0.5), 0.38) + bell(adiff(a, HALF + 0.5), 0.38);
          z += (bust * bell(y - 1.31, 0.04) + pecs * bell(y - 1.34, 0.035)) * lobes * front;
          const blades = bell(adiff(a, 1.5 * PI - 0.55), 0.4) + bell(adiff(a, 1.5 * PI + 0.55), 0.4);
          z -= 0.008 * bell(y - 1.36, 0.05) * blades * Math.max(0, -s);
          o.x = x;
          o.y = y;
          o.z = z + cz;
          // Escote de la camisa: se ve la piel en una V
          const v = vneck && y > 1.39 && Math.abs(adiff(a, HALF)) < 0.12 + (y - 1.39) * 4 ? 1 : 0;
          o.c = v ? scalec(skin, 0.92) : scalec(top, q * (y < 1.06 ? 0.9 : 1));
          o.w = torsoWt(y);
        }),
      );
      centers.push([0, y, cz]);
    }
    sb.loft(rings, N, centers);
  }
  // Cuello de la prenda
  const collar = vneck ? 0 : look.top === 'tunica' ? 0.006 : 0.016;
  if (collar) {
    const cc = look.top === 'chaqueton' ? scalec(top, 0.72) : look.top === 'cuero' || look.top === 'traje' ? scalec(top, 0.8) : scalec(top, 0.88);
    column(
      sb,
      [
        { y: 1.465, rx: 0.08 + collar, rz: 0.076 + collar, w: [[B.chest, 0.6], [B.neck, 0.4]], c: cc, cz: -0.004 },
        { y: 1.505, rx: 0.07 + collar, rz: 0.068 + collar, w: [[B.neck, 0.8], [B.chest, 0.2]], c: cc, cz: -0.002 },
        { y: 1.53, rx: 0.064 + collar * 0.8, rz: 0.064 + collar * 0.8, w: [[B.neck, 1]], c: scalec(cc, 1.06) },
      ],
      N,
    );
  }
  // Cuello
  column(
    sb,
    [
      { y: 1.47, rx: 0.056, rz: 0.058, w: [[B.chest, 0.4], [B.neck, 0.6]], c: scalec(skin, 0.86), cz: 0.002 },
      { y: 1.53, rx: 0.052, rz: 0.055, w: [[B.neck, 1]], c: scalec(skin, 0.88), cz: 0.004 },
      { y: 1.585, rx: 0.05, rz: 0.054, w: [[B.neck, 0.4], [B.head, 0.6]], c: scalec(skin, 0.9), cz: 0.002 },
    ],
    12,
  );
  if (!fem) sb.color(scalec(skin, 0.9)).blob(0, 1.535, 0.05, 0.012, 0.016, 0.01, 5, 3, [[B.neck, 1]]);

  // --- Faldón de la prenda -------------------------------------------------
  const hem = HEM[look.top];
  const longSkirt = hem !== null && hem < 0.7;
  if (hem !== null) {
    const y0 = 1.035;
    const steps = longSkirt ? 6 : 3;
    let prev = -1;
    const open = look.top === 'abrigo' || look.top === 'traje' || look.top === 'cuero' || look.top === 'chaqueton';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = y0 + (hem - y0) * t;
      const flare = longSkirt ? 0.11 : 0.024;
      const rx = (i === 0 ? waistW + 0.01 : hipW + 0.014) + pad + flare * t;
      const rz = (i === 0 ? 0.108 : 0.122) * dep + pad + flare * t;
      const rag = look.top === 'harapos' && i === steps;
      const n2 = N + 2;
      const ring = sb.ringBy(n2, (a, kk, o) => {
        o.x = Math.cos(a) * rx;
        o.y = y + (rag ? (hash2(kk, look.seed, 5) - 0.5) * 0.1 : 0);
        o.z = Math.sin(a) * rz - (i === 0 ? 0 : glute * 0.6 * Math.max(0, -Math.sin(a)));
        // Abertura delantera: línea oscura en el centro
        const seam = open && Math.abs(adiff(a, HALF)) < 0.2 ? 0.55 : 1;
        o.c = scalec(top, (0.94 - t * 0.12) * seam);
        // El faldón sigue a las piernas: más cuanto más abajo
        const side = Math.cos(a);
        const fw = Math.min(longSkirt ? 0.8 : 0.62, t * (longSkirt ? 1.05 : 0.35));
        const l = fw * Math.max(0, Math.min(1, 0.5 + side * 1.2));
        const r = fw * Math.max(0, Math.min(1, 0.5 - side * 1.2));
        const lower = t > 0.75 && longSkirt ? 0.25 * (t - 0.75) * 4 : 0;
        o.w = [
          [B.hips, 1 - l - r],
          [B.thighL, l * (1 - lower)],
          [B.thighR, r * (1 - lower)],
          [side > 0 ? B.shinL : B.shinR, (l + r) * lower],
        ];
      });
      if (prev >= 0) sb.bridge(prev, ring, n2, 0, y, 0);
      prev = ring;
    }
  }

  // --- Cinturón ---------------------------------------------------------------
  if (look.top !== 'tunica' && look.top !== 'harapos') {
    const br = pad + 0.012;
    column(
      sb,
      [
        { y: 1.0, rx: waistW + br + 0.014, rz: 0.108 * dep + br + 0.01 + belly * 0.02, w: [[B.hips, 0.7], [B.spine, 0.3]], c: leather },
        { y: 1.045, rx: waistW + br + 0.01, rz: 0.106 * dep + br + 0.008 + belly * 0.03, w: [[B.hips, 0.6], [B.spine, 0.4]], c: scalec(leather, 1.35) },
      ],
      N,
    );
    const bz = 0.108 * dep + br + 0.014 + belly * 0.025;
    sb.color([0.5, 0.4, 0.16]).box(0, 1.022, bz, 0.045, 0.04, 0.012, [[B.hips, 0.7], [B.spine, 0.3]]);
    sb.color(scalec(leather, 0.7)).box(0, 1.022, bz + 0.005, 0.03, 0.026, 0.008, [[B.hips, 0.7], [B.spine, 0.3]]);
    // Funda o bolsa al costado
    if (rnd(44) < 0.5) sb.color(scalec(leather, 1.4)).box(waistW + br + 0.02, 0.98, -0.02, 0.03, 0.08, 0.07, [[B.hips, 1]]);
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

  // --- Detalles de la prenda: botones, bolsillos, solapas, cremalleras ---------------
  const zf = (y: number) => {
    // Frente del tronco a una altura dada (para pegar piezas encima)
    let best: TS = TORSO[0];
    for (const r of TORSO) if (Math.abs(r[0] - y) < Math.abs(best[0] - y)) best = r;
    return best[2] + pad + best[4];
  };
  const chestW: W = [[B.chest, 1]];
  const brass: RGB = [0.55, 0.43, 0.17];
  if (look.vest === undefined) {
    if (look.top === 'guerrera' || look.top === 'abrigo' || look.top === 'traje') {
      const cols = look.top === 'abrigo' ? [-0.045, 0.045] : [0];
      const ys = look.top === 'traje' ? [1.1, 1.17] : [1.08, 1.15, 1.22, 1.29, 1.36];
      for (const x of cols) for (const y of ys) sb.color(look.top === 'traje' ? scalec(top, 0.5) : brass).box(x, y, zf(y) + 0.004, 0.014, 0.014, 0.008, torsoWt(y));
    }
    if (look.top === 'guerrera' || look.top === 'mono' || look.top === 'chaqueton') {
      // Bolsillos de pecho con solapa
      for (const s of look.top === 'mono' ? [1] : [1, -1]) {
        const x = s * 0.075;
        sb.color(scalec(top, 0.92)).box(x, 1.33, zf(1.33) + 0.004, 0.07, 0.075, 0.01, chestW);
        sb.color(scalec(top, 0.78)).box(x, 1.37, zf(1.37) + 0.009, 0.074, 0.022, 0.012, chestW);
      }
    }
    if (look.top === 'abrigo' || look.top === 'traje' || look.top === 'cuero') {
      // Solapas: dos piezas en V sobre el pecho
      const lc = look.top === 'traje' ? scalec(top, 0.85) : scalec(top, 0.82);
      for (const s of [1, -1]) {
        const v0 = sb.vcount;
        sb.color(lc).box(s * 0.05, 1.37, zf(1.37) + 0.008, 0.045, 0.16, 0.012, chestW);
        sb.rotate(v0, sb.vcount, s * 0.05, 1.37, zf(1.37), 0, 0, -s * 0.38);
      }
      if (look.top === 'traje') {
        // Camisa clara y corbata
        sb.color([0.75, 0.73, 0.68]).box(0, 1.4, zf(1.4) + 0.002, 0.05, 0.08, 0.008, chestW);
        sb.color(scalec(top, 0.45)).box(0, 1.36, zf(1.36) + 0.009, 0.022, 0.13, 0.008, chestW);
      }
    }
    if (look.top === 'cuero' || look.top === 'mono') {
      // Cremallera
      for (let y = 1.06; y < 1.45; y += 0.05) sb.color([0.42, 0.42, 0.4]).box(look.top === 'cuero' ? 0.018 : 0, y, zf(y) + 0.003, 0.007, 0.05, 0.006, torsoWt(y));
    }
    if (look.top === 'harapos') {
      // Remiendos
      for (let i = 0; i < 3; i++) {
        const y = 1.12 + rnd(50 + i) * 0.25;
        const x = (rnd(60 + i) - 0.5) * 0.18;
        sb.color(scalec(mixc(top, [0.4, 0.35, 0.28], 0.5), 0.8 + rnd(70 + i) * 0.4)).box(x, y, zf(y) + 0.002, 0.05, 0.05, 0.006, torsoWt(y));
      }
    }
  }

  // --- Brazos --------------------------------------------------------------------
  const gloves = look.gloves !== undefined ? lin(look.gloves) : null;
  const sleeve = top;
  const armR = 0.05 * (1 + look.build * 0.1) * (fem ? 0.9 : 1);
  const delt = (shW / 0.19) * (fem ? 0.94 : 1);
  const rolled = look.top === 'camisa' && rnd(9) < 0.5;
  for (const s of [1, -1]) {
    const sh = s > 0 ? B.shoulderL : B.shoulderR;
    const ua = s > 0 ? B.upperArmL : B.upperArmR;
    const fa = s > 0 ? B.forearmL : B.forearmR;
    const hd = s > 0 ? B.handL : B.handR;
    const x = 0.205 * s;
    const handC = gloves ?? skin;
    const bare = (look.top === 'harapos' && rnd(s + 5) > 0.5) || rolled;
    const lower = bare ? skin : sleeve;
    const cuff = bare ? skin : scalec(sleeve, look.top === 'chaqueton' || look.top === 'cuero' ? 0.75 : 0.85);
    const f1 = s > 0 ? B.fingersL : B.fingersR;
    const f2 = s > 0 ? B.tipsL : B.tipsR;
    const th = s > 0 ? B.thumbL : B.thumbR;
    const lp = bare ? 0 : pad;
    // Brazo y palma: la palma mira hacia el cuerpo
    column(
      sb,
      [
        { y: HAND.knuckle - 0.004, rx: HAND.palm * 0.8, rz: 0.04, w: [[hd, 1]], c: scalec(handC, 0.88), cx: x, shape: 3 },
        { y: HAND.knuckle + 0.012, rx: HAND.palm, rz: 0.044, w: [[hd, 1]], c: handC, cx: x, shape: 3 },
        { y: 0.84, rx: HAND.palm * 1.06, rz: 0.042, w: [[hd, 1]], c: handC, cx: x, shape: 2.6 },
        { y: 0.866, rx: 0.021, rz: 0.031, w: [[hd, 0.6], [fa, 0.4]], c: handC, cx: x },
        { y: 0.882, rx: armR * 0.6 + lp * 0.9, rz: armR * 0.66 + lp * 0.9, w: [[fa, 0.8], [hd, 0.2]], c: scalec(cuff, 0.9), cx: x },
        { y: 0.905, rx: armR * 0.68 + lp * 1.2, rz: armR * 0.72 + lp * 1.2, w: [[fa, 1]], c: cuff, cx: x },
        { y: 0.93, rx: armR * 0.68 + lp, rz: armR * 0.72 + lp, w: [[fa, 1]], c: lower, cx: x },
        { y: 1.01, rx: armR * 0.84 + lp, rz: armR * 0.88 + lp, w: [[fa, 1]], c: lower, cx: x, cz: 0.003 },
        { y: 1.075, rx: armR * 0.88 + lp, rz: armR * 0.9 + lp, w: [[fa, 0.9], [ua, 0.1]], c: rolled ? scalec(sleeve, 0.9) : lower, cx: x },
        { y: 1.13, rx: armR * 0.84 + pad, rz: armR * 0.86 + pad, w: [[fa, 0.5], [ua, 0.5]], c: scalec(sleeve, 0.9), cx: x, cz: -0.003 },
        { y: 1.18, rx: armR * 0.88 + pad, rz: armR * 0.92 + pad, w: [[ua, 0.85], [fa, 0.15]], c: sleeve, cx: x },
        { y: 1.27, rx: armR * 0.95 + pad, rz: armR * 1.04 + pad, w: [[ua, 1]], c: sleeve, cx: x, cz: 0.004 },
        { y: 1.35, rx: armR * 1.0 * delt + pad, rz: armR * 1.06 + pad, w: [[ua, 0.9], [sh, 0.1]], c: sleeve, cx: x + s * 0.002 },
        { y: 1.405, rx: armR * 1.05 * delt + pad, rz: armR * 1.1 + pad, w: [[ua, 0.75], [sh, 0.25]], c: sleeve, cx: x },
        { y: 1.445, rx: armR * 0.92 * delt + pad, rz: armR * 0.98 + pad, w: [[ua, 0.5], [sh, 0.5]], c: sleeve, cx: x - s * 0.014 },
        { y: 1.47, rx: armR * 0.6 * delt + pad, rz: armR * 0.7 + pad, w: [[sh, 0.7], [ua, 0.3]], c: scalec(sleeve, 0.96), cx: x - s * 0.032 },
      ],
      10,
      true,
      true,
    );
    if (rolled) {
      // Manga remangada sobre el codo
      column(
        sb,
        [
          { y: 1.06, rx: armR * 0.98 + 0.01, rz: armR + 0.01, w: [[fa, 0.8], [ua, 0.2]], c: scalec(sleeve, 0.85), cx: x },
          { y: 1.1, rx: armR * 0.98 + 0.012, rz: armR + 0.012, w: [[fa, 0.6], [ua, 0.4]], c: sleeve, cx: x },
        ],
        10,
      );
    }
    // Cuatro dedos de dos falanges (índice hacia delante) y pulgar
    const FZ = [0.0305, 0.0105, -0.0095, -0.029];
    const FL = [0.038, 0.043, 0.039, 0.03];
    const FW = [0.0092, 0.0096, 0.0092, 0.0084];
    for (let kk = 0; kk < 4; kk++) {
      const z = FZ[kk];
      const r = FW[kk];
      const dark = scalec(handC, 0.9);
      column(
        sb,
        [
          { y: HAND.knuckle + 0.006, rx: r * 0.95, rz: r, w: [[hd, 1]], c: handC, cx: x, cz: z, shape: 2.8 },
          { y: HAND.knuckle - 0.004, rx: r, rz: r, w: [[hd, 0.45], [f1, 0.55]], c: handC, cx: x, cz: z, shape: 2.8 },
          { y: HAND.joint + 0.012, rx: r * 0.96, rz: r * 0.98, w: [[f1, 1]], c: handC, cx: x, cz: z, shape: 2.8 },
          { y: HAND.joint, rx: r * 0.94, rz: r * 0.96, w: [[f1, 0.5], [f2, 0.5]], c: dark, cx: x, cz: z, shape: 2.8 },
          { y: HAND.joint - 0.012, rx: r * 0.9, rz: r * 0.94, w: [[f2, 1]], c: handC, cx: x, cz: z, shape: 2.8 },
          { y: HAND.joint - FL[kk], rx: r * 0.74, rz: r * 0.8, w: [[f2, 1]], c: dark, cx: x, cz: z, shape: 2.4 },
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
          { y: 1.255, rx: armR + pad + 0.012, rz: armR * 1.04 + pad + 0.014, w: [[ua, 1]], c: lin(look.armband), cx: x },
          { y: 1.33, rx: armR * 1.05 * delt + pad + 0.012, rz: armR * 1.09 + pad + 0.014, w: [[ua, 1]], c: lin(look.armband), cx: x },
        ],
        10,
      );
    }
    if (look.shoulderPads !== undefined) {
      sb.color(lin(look.shoulderPads));
      sb.blob(x + s * 0.01, 1.43, 0, 0.085, 0.07, 0.095, 8, 4, [[sh, 0.6], [ua, 0.4]], 0.45, 1);
    }
  }

  // --- Piernas ---------------------------------------------------------------------
  const legR = 0.08 * k * (fem ? 0.98 : 1);
  const bootTop = 0.37;
  for (const s of [1, -1]) {
    const th = s > 0 ? B.thighL : B.thighR;
    const shn = s > 0 ? B.shinL : B.shinR;
    const ft = s > 0 ? B.footL : B.footR;
    const x = 0.1 * s;
    const wear = scalec(pants, 0.86);
    // Los muslos se tocan por dentro: la entrepierna queda tapada
    column(
      sb,
      [
        { y: bootTop - 0.01, rx: 0.056, rz: 0.06, w: [[shn, 1]], c: scalec(pants, 0.8), cx: x, cz: -0.004 },
        { y: 0.42, rx: 0.058, rz: 0.064, w: [[shn, 1]], c: pants, cx: x, cz: -0.008 },
        { y: 0.48, rx: 0.058, rz: 0.06, w: [[shn, 0.85], [th, 0.15]], c: pants, cx: x },
        { y: 0.52, rx: 0.06, rz: 0.064, w: [[shn, 0.5], [th, 0.5]], c: wear, cx: x, cz: 0.007 },
        { y: 0.565, rx: 0.062, rz: 0.064, w: [[th, 0.85], [shn, 0.15]], c: pants, cx: x, cz: 0.003 },
        { y: 0.64, rx: legR * 0.8, rz: legR * 0.84, w: [[th, 1]], c: pants, cx: x, cz: 0.004 },
        { y: 0.74, rx: legR * 0.92, rz: legR * 0.98, w: [[th, 1]], c: pants, cx: x, cz: 0.007 },
        { y: 0.83, rx: legR * 1.02, rz: legR * 1.07, w: [[th, 0.9], [B.hips, 0.1]], c: pants, cx: x * 0.97, cz: 0.005 },
        { y: 0.9, rx: legR * 1.07, rz: legR * 1.12, w: [[th, 0.7], [B.hips, 0.3]], c: pants, cx: x * 0.93 },
        { y: 0.955, rx: legR * 1.02, rz: legR * 1.08, w: [[th, 0.45], [B.hips, 0.55]], c: pants, cx: x * 0.92 },
      ],
      10,
      true,
      false,
    );
    // Caña de la bota, con el borde vuelto
    column(
      sb,
      [
        { y: 0.105, rx: 0.046, rz: 0.054, w: [[shn, 0.45], [ft, 0.55]], c: scalec(boots, 0.92), cx: x, cz: -0.006 },
        { y: 0.15, rx: 0.049, rz: 0.055, w: [[shn, 0.8], [ft, 0.2]], c: boots, cx: x, cz: -0.006 },
        { y: 0.26, rx: 0.056, rz: 0.06, w: [[shn, 1]], c: boots, cx: x, cz: -0.008 },
        { y: bootTop - 0.012, rx: 0.062, rz: 0.066, w: [[shn, 1]], c: scalec(boots, 1.05), cx: x, cz: -0.006 },
        { y: bootTop + 0.006, rx: 0.066, rz: 0.07, w: [[shn, 1]], c: scalec(boots, 1.15), cx: x, cz: -0.006 },
        { y: bootTop + 0.012, rx: 0.06, rz: 0.064, w: [[shn, 1]], c: scalec(boots, 0.7), cx: x, cz: -0.006 },
      ],
      10,
    );
    // Pie de la bota: anillos a lo largo de Z, del talón a la puntera
    const footRings: [number, number, number, number, RGB][] = [
      // z, semiancho, semialto, centro y, color
      [-0.09, 0.034, 0.038, 0.062, scalec(boots, 0.82)],
      [-0.07, 0.044, 0.052, 0.066, boots],
      [-0.025, 0.05, 0.06, 0.072, boots],
      [0.03, 0.053, 0.05, 0.06, boots],
      [0.09, 0.052, 0.04, 0.048, boots],
      [0.14, 0.048, 0.033, 0.042, scalec(boots, 1.05)],
      [0.178, 0.04, 0.027, 0.038, scalec(boots, 1.1)],
      [0.2, 0.022, 0.018, 0.036, scalec(boots, 0.95)],
    ];
    const FW: W = [[ft, 1]];
    const fr: number[] = [];
    const fc: [number, number, number][] = [];
    for (const [z, rx, ry, cy, c] of footRings) {
      sb.color(c);
      fr.push(sb.ring(x, cy, z, rx, ry, 10, 'z', FW, 2.4));
      fc.push([x, cy, z]);
    }
    sb.loft(fr, 10, fc);
    sb.fan(fr[0], 10, x, 0.062, -0.1, FW, 0, 0, -1);
    sb.fan(fr[fr.length - 1], 10, x, 0.036, 0.208, FW, 0, 0, 1);
    // Suela y tacón, más anchos y oscuros
    const sole = scalec(mixc(boots, [0.05, 0.045, 0.04], 0.6), 0.8);
    const soleRings: [number, number, number, number][] = [
      [-0.096, 0.036, 0.018, 0.02],
      [-0.03, 0.05, 0.018, 0.02],
      [-0.01, 0.052, 0.01, 0.011],
      [0.06, 0.057, 0.01, 0.011],
      [0.15, 0.052, 0.01, 0.012],
      [0.206, 0.03, 0.01, 0.014],
    ];
    const sr: number[] = [];
    const sc: [number, number, number][] = [];
    for (const [z, rx, ry, cy] of soleRings) {
      sb.color(sole);
      sr.push(sb.ring(x, cy, z, rx, ry, 10, 'z', FW, 5));
      sc.push([x, cy, z]);
    }
    sb.loft(sr, 10, sc);
    sb.fan(sr[0], 10, x, 0.02, -0.1, FW, 0, 0, -1);
    sb.fan(sr[sr.length - 1], 10, x, 0.014, 0.21, FW, 0, 0, 1);
    // Cordones sobre el empeine
    sb.color(scalec(boots, 0.6));
    for (let i = 0; i < 3; i++) sb.box(x, 0.105 - i * 0.012, 0.035 + i * 0.022, 0.03, 0.005, 0.008, FW);
    if (look.kneePads !== undefined) {
      sb.color(lin(look.kneePads));
      sb.blob(x, 0.525, 0.052, 0.05, 0.065, 0.032, 8, 4, [[shn, 0.5], [th, 0.5]]);
    }
    if (look.top === 'mono' || (look.vest !== undefined && rnd(30 + s) < 0.6)) {
      // Bolsillo de muslo
      sb.color(scalec(pants, 0.85)).box(x + s * (legR * 0.95), 0.72, 0.012, 0.022, 0.1, 0.085, [[th, 1]]);
      sb.color(scalec(pants, 0.72)).box(x + s * (legR * 0.95 + 0.004), 0.775, 0.012, 0.024, 0.02, 0.09, [[th, 1]]);
    }
  }

  // --- Cabeza ----------------------------------------------------------------------
  const HW: W = [[B.head, 1]];
  const masked = look.mask === 'antigas' || look.hat === 'pasamontanas';
  const rubber: RGB = look.mask === 'antigas' ? [0.1, 0.105, 0.1] : lin(look.hatColor);
  const faceC = masked ? rubber : skin;
  const hs = fem ? 1.0 : 1.05;
  const row: HeadRow = [0, 0, 0, 0, 0, 0];
  /** Punto de la superficie de la cabeza a un ángulo y altura, inflado `off`. */
  const headPt = (a: number, y: number, off: number, o: { x: number; z: number }) => {
    headRow(y, row);
    const c = Math.cos(a);
    const s = Math.sin(a);
    const e = s >= 0 ? row[5] : 2.15;
    o.x = (row[1] * hs + off) * se(c, e);
    o.z = row[4] + ((s >= 0 ? row[2] : row[3]) * hs + off) * se(s, e);
    return o;
  };
  /** Profundidad de la cara (z) en un punto (x, y). */
  const faceZ = (x: number, y: number) => {
    headRow(y, row);
    const w = row[1] * hs;
    const e = row[5];
    const q = Math.min(0.999, Math.abs(x) / w);
    return row[4] + row[2] * hs * Math.pow(1 - Math.pow(q, e), 1 / e);
  };
  const stubble = !masked && look.facial === 'barba3';
  const P = { x: 0, z: 0 };
  {
    const rings: number[] = [];
    const centers: [number, number, number][] = [];
    const ys = HEAD.map((r) => r[0]);
    for (const y of ys) {
      rings.push(
        sb.ringBy(N, (a, _k, o: VOut) => {
          headPt(a, y, 0, P);
          let x = P.x;
          let z = P.z;
          if (!masked) {
            // Cuencas de los ojos, arco de las cejas y pómulos
            const front = Math.max(0, Math.sin(a));
            const eyeA = Math.min(Math.abs(adiff(a, HALF - 0.38)), Math.abs(adiff(a, HALF + 0.38)));
            z -= 0.006 * bell(y - 1.697, 0.014) * bell(eyeA, 0.2) * front;
            z += 0.004 * bell(y - 1.722, 0.01) * bell(adiff(a, HALF), 0.55) * front;
            const cheekA = Math.min(Math.abs(adiff(a, HALF - 0.75)), Math.abs(adiff(a, HALF + 0.75)));
            const cb = 0.004 * bell(y - 1.672, 0.016) * bell(cheekA, 0.25);
            x += cb * Math.cos(a);
            z += cb * front;
          }
          o.x = x;
          o.y = y;
          o.z = z;
          // Barba de tres días: la parte baja de la cara se oscurece
          const beardLine = 1.655 - 0.02 * bell(adiff(a, HALF), 0.5);
          const st = stubble && Math.sin(a) > -0.2 && y < beardLine ? 0.35 : 0;
          o.c = st ? mixc(faceC, hair, st) : y < 1.585 ? scalec(faceC, 0.92) : faceC;
          o.w = HW;
        }),
      );
      headRow(y, row);
      centers.push([0, y, row[4]]);
    }
    sb.loft(rings, N, centers);
    sb.color(faceC).fan(rings[rings.length - 1], N, 0, HEAD_TOP, -0.012, HW, 0, 1, 0);
    sb.color(scalec(faceC, 0.9)).fan(rings[0], N, 0, 1.54, 0.01, HW, 0, -1, 0);
  }
  const eyeX = 0.034 * hs;
  const eyeY = 1.697;
  const iris = IRIS[Math.floor(rnd(31) * IRIS.length) % IRIS.length];
  /** Ojo: blanco, iris, pupila, párpado de arriba y pestañas. */
  const eye = (s: number, ex: number, ez: number, ey: number) => {
    sb.color([0.78, 0.76, 0.72]).blob(ex, ey, ez, 0.0125, 0.0072, 0.007, 8, 4, HW);
    sb.color(iris).blob(ex, ey - 0.0005, ez + 0.0052, 0.0058, 0.0058, 0.0026, 8, 3, HW);
    sb.color([0.02, 0.018, 0.016]).blob(ex, ey - 0.0005, ez + 0.0072, 0.0026, 0.0026, 0.0012, 6, 3, HW);
    // El párpado tapa el tercio de arriba del ojo y le quita la cara de susto
    const lv = sb.vcount;
    sb.color(scalec(skin, 0.86)).blob(ex, ey + 0.0058, ez + 0.0035, 0.0142, 0.0042, 0.0066, 8, 3, HW, 0.05, 1);
    sb.rotate(lv, sb.vcount, ex, ey, ez, -0.15, 0, -s * 0.06);
    sb.color(fem ? [0.03, 0.025, 0.02] : scalec(hair, 0.45)).box(ex, ey + 0.0045, ez + 0.0072, 0.025, fem ? 0.0028 : 0.0018, 0.002, HW);
  };
  if (look.hat === 'pasamontanas' && look.mask !== 'antigas') {
    // Ranura del pasamontañas: se ven la piel alrededor de los ojos y los ojos
    const ez = faceZ(0, eyeY) + 0.002;
    sb.color(scalec(skin, 0.8)).blob(0, eyeY + 0.002, ez - 0.006, 0.066, 0.016, 0.01, 12, 3, HW);
    for (const s of [1, -1]) eye(s, s * eyeX, faceZ(s * eyeX, eyeY) - 0.002, eyeY);
  }
  if (!masked) {
    // Nariz: caballete, punta y aletas
    const nz = faceZ(0, 1.69);
    const v0 = sb.vcount;
    sb.color(scalec(skin, 0.97)).blob(0, 1.688, nz + 0.002, 0.008, 0.026, 0.011, 6, 4, HW);
    const tipZ = faceZ(0, 1.662) + 0.014 * (fem ? 0.85 : 1);
    sb.color(scalec(skin, 0.95)).blob(0, 1.663, tipZ, 0.0125 * (fem ? 0.85 : 1), 0.013, 0.012, 7, 4, HW);
    for (const s of [1, -1]) sb.color(scalec(skin, 0.9)).blob(s * 0.012, 1.659, tipZ - 0.008, 0.0085, 0.008, 0.008, 6, 3, HW);
    sb.rotate(v0, sb.vcount, 0, 1.66, nz, -0.08, 0);
    for (const s of [1, -1]) {
      const ex = s * eyeX;
      const ez = faceZ(ex, eyeY) - 0.006;
      eye(s, ex, ez, eyeY);
      if (old) sb.color(scalec(skin, 0.82)).box(ex, eyeY - 0.0085, ez + 0.003, 0.02, 0.003, 0.004, HW);
      // Ceja
      const bv = sb.vcount;
      const brow = fem ? scalec(hair, 0.75) : scalec(hair, 0.85);
      sb.color(brow).box(ex + s * 0.002, 1.716, faceZ(ex, 1.716) + 0.0035, 0.03, fem ? 0.0045 : 0.0065, 0.007, HW);
      sb.rotate(bv, sb.vcount, ex, 1.716, faceZ(ex, 1.716), 0, 0, s * (0.02 + rnd(35) * 0.08));
      // Oreja: concha con el hueco más oscuro
      headRow(1.675, row);
      const earX = s * (row[1] * hs + 0.002);
      sb.color(scalec(skin, 0.9)).blob(earX, 1.675, row[4] - 0.008, 0.011, 0.028, 0.019, 7, 4, HW);
      sb.color(scalec(skin, 0.68)).blob(earX + s * 0.004, 1.673, row[4] - 0.004, 0.006, 0.016, 0.01, 6, 3, HW);
    }
    // Boca: labios y comisura
    const mz = faceZ(0, 1.624);
    const lipC = mixc(scalec(skin, 0.78), [0.55, 0.25, 0.22], fem ? 0.4 : 0.2);
    sb.color(scalec(skin, 0.5)).box(0, 1.6245, mz + 0.002, 0.036, 0.0025, 0.006, HW);
    sb.color(lipC).blob(0, 1.6285, mz + 0.0012, 0.017, 0.0034, 0.005, 8, 3, HW);
    sb.color(scalec(lipC, 1.06)).blob(0, 1.62, mz + 0.0006, 0.0155, fem ? 0.0048 : 0.0038, 0.0055, 8, 3, HW);
    // Barbilla marcada
    if (!fem) sb.color(scalec(faceC, stubble ? 0.85 : 0.97)).blob(0, 1.583, faceZ(0, 1.583) - 0.004, 0.022, 0.012, 0.008, 6, 3, HW);
    // Arrugas de la edad
    if (old) {
      sb.color(scalec(skin, 0.8));
      for (const y of [1.748, 1.756]) sb.box(0, y, faceZ(0, y) + 0.001, 0.05, 0.0018, 0.003, HW);
      for (const s of [1, -1]) {
        const v1 = sb.vcount;
        sb.box(s * 0.024, 1.64, faceZ(s * 0.024, 1.64) + 0.001, 0.0018, 0.022, 0.003, HW);
        sb.rotate(v1, sb.vcount, s * 0.024, 1.64, faceZ(s * 0.024, 1.64), 0, 0, s * 0.35);
      }
    }
    if (look.scar) {
      const v1 = sb.vcount;
      sb.color([0.42, 0.14, 0.12]).box(0.048, 1.66, faceZ(0.048, 1.66) + 0.002, 0.005, 0.05, 0.006, HW);
      sb.rotate(v1, sb.vcount, 0.048, 1.66, faceZ(0.048, 1.66), 0, 0, 0.5);
    }
  }

  // --- Pelo -------------------------------------------------------------------------
  // Línea de nacimiento por ángulo (0 = sobre la oreja izquierda, π/2 = frente, 3π/2 = nuca)
  const HAIRLINE: [number, number][] = [
    [0, 1.716],
    [0.2, 1.71],
    [0.42, 1.665],
    [0.55, 1.69],
    [0.85, 1.728],
    [1.15, 1.744],
    [HALF, 1.748],
  ];
  const hairline = (a: number) => {
    // Simétrica respecto al plano del frente y con la nuca más baja
    let t = ((a % (2 * PI)) + 2 * PI) % (2 * PI);
    if (t > PI) {
      // Detrás: de la oreja a la nuca
      const u = Math.abs(t - 1.5 * PI) / HALF;
      return lerp(1.612, 1.7, smoothstep(0, 1, u)) + 0.016 * bell(u - 0.92, 0.12);
    }
    if (t > HALF) t = PI - t;
    for (let i = 1; i < HAIRLINE.length; i++) {
      if (t <= HAIRLINE[i][0]) {
        const [a0, y0] = HAIRLINE[i - 1];
        const [a1, y1] = HAIRLINE[i];
        return lerp(y0, y1, (t - a0) / (a1 - a0));
      }
    }
    return HAIRLINE[HAIRLINE.length - 1][1];
  };
  const hatCovers = look.hat !== 'nada' && look.hat !== 'panuelo' && look.hat !== 'boina' && look.hat !== 'kufi';
  const hatBand = look.hat === 'casco' ? 1.715 : look.hat === 'ushanka' ? 1.72 : look.hat === 'capucha' ? 1.6 : 1.742;
  const balding = look.hair === 'calvo' && old;
  const hairStyle = masked ? null : look.hair === 'calvo' ? (balding ? 'calvo' : null) : look.hair;
  if (hairStyle && !(look.hat === 'capucha')) {
    const thick = hairStyle === 'rapado' ? 0.0035 : hairStyle === 'calvo' ? 0.004 : 0.011;
    const hc = hairStyle === 'rapado' || hairStyle === 'calvo' ? mixc(skin, hair, 0.6) : hair;
    const yMax = hatCovers ? hatBand : balding ? 1.728 : HEAD_TOP;
    const cols = 24;
    const rows = 7;
    // Rejilla: cada columna (ángulo) va de su nacimiento a la coronilla (o al ala del sombrero)
    const grid: number[] = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      grid.push(
        sb.ringBy(cols, (a, kk, o) => {
          const y0 = hairline(a);
          const top = Math.max(y0 + 0.002, yMax);
          const y = lerp(y0, top, Math.pow(t, 0.9));
          // Mechones: grosor irregular, más fino en el borde
          const tuft = hairStyle === 'rapado' ? 1 : 0.7 + 0.6 * hash2(kk, r, look.seed);
          const off = thick * tuft * smoothstep(0, 0.25, t + 0.04);
          headPt(a, Math.min(y, HEAD_TOP - 0.004), off, P);
          o.x = P.x;
          o.z = P.z;
          o.y = y + (y >= HEAD_TOP - 0.01 ? off : 0);
          const shade = 0.88 + 0.2 * hash2(kk * 3, r, look.seed + 1);
          o.c = scalec(hc, shade * (t < 0.15 ? 0.85 : 1));
          o.w = y < 1.62 ? [[B.head, 0.85], [B.neck, 0.15]] : HW;
        }),
      );
    }
    for (let r = 1; r <= rows; r++) sb.bridge(grid[r - 1], grid[r], cols, 0, 1.7, -0.01);
    if (!hatCovers && !balding) sb.color(hc).fan(grid[rows], cols, 0, HEAD_TOP + thick, -0.012, HW, 0, 1, 0);
    if (hairStyle === 'largo') {
      // Melena: cae por detrás y por los lados hasta los hombros
      const lr: number[] = [];
      const lc: [number, number, number][] = [];
      const levels = [1.72, 1.67, 1.61, 1.55, 1.5, 1.455, 1.42];
      const hl = scalec(hair, 0.9);
      levels.forEach((y, i) => {
        const t = i / (levels.length - 1);
        lr.push(
          sb.ringBy(
            16,
            (a, kk, o) => {
              // Por detrás, de una sien a la otra pasando por la nuca; abajo se abre sobre los hombros
              const side = Math.cos(a);
              const back = -Math.sin(a);
              const r = (0.098 + 0.012 * t) * hs;
              const spread = 1 + 0.55 * smoothstep(0.3, 1, t) * Math.abs(side);
              o.x = side * r * spread;
              o.z = -0.012 - back * r * (0.98 + 0.3 * t) - 0.015 * t + (1 - back) * 0.012 * t;
              o.y = y - (i === levels.length - 1 ? hash2(kk, 7, look.seed) * 0.05 : 0);
              o.c = scalec(hl, 0.85 + 0.3 * hash2(kk, i, look.seed + 3));
              o.w = i < 2 ? HW : i < 4 ? [[B.head, 0.5], [B.neck, 0.5]] : [[B.neck, 0.4], [B.chest, 0.6]];
            },
            PI - 0.45,
            2 * PI + 0.45,
            false,
          ),
        );
        lc.push([0, y, -0.012]);
      });
      sb.loft(lr, 16, lc, false);
    } else if (hairStyle === 'mono') {
      // Moño en la coronilla, con su goma
      sb.color(scalec(hair, 0.95)).blob(0, 1.75, -0.112 * hs, 0.042, 0.04, 0.04, 9, 5, HW);
      sb.color([0.12, 0.1, 0.1]).blob(0, 1.75, -0.085 * hs, 0.03, 0.03, 0.01, 8, 3, HW);
    }
  }
  // Vello facial
  if (!masked && look.mask !== 'respirador' && look.mask !== 'panuelo' && look.facial !== 'nada' && look.facial !== 'barba3') {
    const bc = scalec(hair, 0.92);
    if (look.facial === 'barba' || look.facial === 'barbaLarga') {
      // Barba: cáscara sobre mandíbula, mejillas y barbilla
      const cols = 16;
      const rows = 5;
      const a0 = 0.12;
      const a1 = PI - 0.12;
      const grid: number[] = [];
      for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        grid.push(
          sb.ringBy(
            cols,
            (a, kk, o) => {
              // De la línea de las mejillas hacia abajo, hasta debajo de la barbilla;
              // en el centro empieza bajo el labio, para que se vea la boca
              const center = bell(adiff(a, HALF), 0.42);
              const line = lerp(1.668, 1.607, center);
              const y = lerp(line, 1.55, t);
              const thick = 0.006 + 0.008 * smoothstep(0, 0.3, t) * (0.7 + 0.6 * hash2(kk, r, look.seed + 9));
              headPt(a, y, thick, P);
              o.x = P.x;
              o.z = P.z + (y < 1.575 ? 0.01 * (1 - (y - 1.55) / 0.025) * Math.max(0, Math.sin(a)) : 0);
              o.y = y;
              o.c = scalec(bc, 0.85 + 0.25 * hash2(kk * 5, r, look.seed));
              o.w = HW;
            },
            a0,
            a1,
            false,
          ),
        );
      }
      for (let r = 1; r <= rows; r++) sb.bridge(grid[r - 1], grid[r], cols, 0, 1.61, -0.01, false);
      if (look.facial === 'barbaLarga') {
        // Barba larga que cae sobre el pecho
        column(
          sb,
          [
            { y: 1.575, rx: 0.05, rz: 0.03, w: HW, c: bc, cz: 0.085 },
            { y: 1.53, rx: 0.047, rz: 0.028, w: [[B.head, 0.7], [B.neck, 0.3]], c: scalec(bc, 0.95), cz: 0.096 },
            { y: 1.48, rx: 0.034, rz: 0.022, w: [[B.head, 0.4], [B.neck, 0.6]], c: scalec(bc, 0.9), cz: 0.104 },
            { y: 1.44, rx: 0.016, rz: 0.012, w: [[B.neck, 0.5], [B.chest, 0.5]], c: scalec(bc, 0.85), cz: 0.112 },
          ],
          10,
          false,
          true,
        );
      }
    }
    // Bigote: dos mechones caídos sobre el labio
    const mz = faceZ(0, 1.637);
    for (const s of [1, -1]) {
      const v1 = sb.vcount;
      sb.color(bc).blob(s * 0.014, 1.636, mz + 0.004, 0.017, 0.0055, 0.008, 7, 3, HW);
      sb.rotate(v1, sb.vcount, s * 0.014, 1.636, mz, 0, 0, s * 0.22);
    }
  }
  if (look.eyepatch && !masked) {
    sb.color([0.03, 0.03, 0.03]).blob(0.034 * hs, 1.697, faceZ(0.034, 1.697) + 0.002, 0.022, 0.019, 0.01, 7, 3, HW);
    sb.box(0, 1.712, -0.004, 0.18, 0.007, 0.205, HW);
  }
  if (look.glasses && !masked && look.mask === 'nada') {
    sb.color([0.05, 0.05, 0.05]);
    const gz = faceZ(0.034, 1.697) + 0.012;
    for (const s of [1, -1]) {
      sb.box(s * 0.034, 1.708, gz, 0.036, 0.004, 0.004, HW);
      sb.box(s * 0.034, 1.686, gz, 0.036, 0.004, 0.004, HW);
      sb.box(s * 0.052, 1.697, gz, 0.004, 0.024, 0.004, HW);
      sb.box(s * 0.016, 1.697, gz, 0.004, 0.024, 0.004, HW);
      sb.box(s * 0.083, 1.703, 0.03, 0.004, 0.004, 0.11, HW);
    }
    sb.box(0, 1.702, gz, 0.03, 0.004, 0.004, HW);
    sb.color([0.5, 0.55, 0.55]).glow(0.04);
    for (const s of [1, -1]) sb.box(s * 0.034, 1.697, gz - 0.001, 0.032, 0.02, 0.001, HW);
    sb.glow(0);
  }

  // --- Sombreros -------------------------------------------------------------------
  const hatC = lin(look.hatColor);
  switch (look.hat) {
    case 'gorra':
      sb.color(hatC).blob(0, 1.738, -0.006, 0.1, 0.086, 0.114, 12, 4, HW, 0.42, 1);
      sb.color(scalec(hatC, 0.7)).box(0, 1.742, 0.128, 0.12, 0.012, 0.075, HW);
      sb.color(scalec(hatC, 0.85)).blob(0, 1.822, -0.006, 0.012, 0.006, 0.012, 6, 3, HW);
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
      sb.color([0.07, 0.05, 0.03]).box(0.08, 1.63, 0.03, 0.006, 0.16, 0.014, HW).box(-0.08, 1.63, 0.03, 0.006, 0.16, 0.014, HW);
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
      sb.color([0.3, 0.3, 0.3]).blob(s * 0.036, 1.69, 0.092, 0.03, 0.03, 0.014, 8, 3, HW);
      sb.color(glass).glow(0.25).blob(s * 0.036, 1.69, 0.1, 0.023, 0.023, 0.008, 8, 3, HW);
      sb.glow(0);
    }
    // Filtro
    column(
      sb,
      [
        { y: 1.575, rx: 0.042, rz: 0.042, w: HW, c: [0.2, 0.22, 0.18], cz: 0.12 },
        { y: 1.63, rx: 0.042, rz: 0.042, w: HW, c: [0.24, 0.26, 0.21], cz: 0.11 },
        { y: 1.64, rx: 0.026, rz: 0.03, w: HW, c: [0.1, 0.1, 0.1], cz: 0.095 },
      ],
      8,
      true,
      true,
    );
  } else if (look.mask === 'respirador') {
    sb.color([0.14, 0.14, 0.14]).blob(0, 1.628, 0.08, 0.05, 0.042, 0.045, 8, 4, HW);
    sb.color([0.3, 0.32, 0.26]);
    for (const s of [1, -1]) sb.blob(s * 0.058, 1.618, 0.07, 0.026, 0.026, 0.02, 7, 3, HW);
    sb.color([0.08, 0.08, 0.08]).box(0, 1.655, -0.004, 0.18, 0.01, 0.205, HW);
  } else if (look.mask === 'gafas') {
    sb.color([0.08, 0.07, 0.06]).box(0, 1.697, -0.004, 0.184, 0.022, 0.212, HW);
    for (const s of [1, -1]) {
      sb.color([0.12, 0.1, 0.08]).blob(s * 0.036, 1.697, 0.094, 0.03, 0.026, 0.016, 8, 3, HW);
      sb.color([0.3, 0.2, 0.08]).glow(0.2).blob(s * 0.036, 1.697, 0.104, 0.022, 0.019, 0.008, 8, 3, HW);
      sb.glow(0);
    }
  } else if (look.mask === 'panuelo') {
    sb.color(look.scarf !== undefined ? lin(look.scarf) : [0.25, 0.2, 0.16]);
    sb.blob(0, 1.62, 0.016, 0.088, 0.062, 0.1, 10, 4, HW, 0.1, 0.95);
  }

  // --- Bufanda -----------------------------------------------------------------------
  if (look.scarf !== undefined && look.mask !== 'panuelo') {
    const sc = lin(look.scarf);
    column(
      sb,
      [
        { y: 1.475, rx: 0.104, rz: 0.1, w: [[B.chest, 0.7], [B.neck, 0.3]], c: scalec(sc, 0.8) },
        { y: 1.52, rx: 0.094, rz: 0.096, w: [[B.neck, 0.8], [B.chest, 0.2]], c: sc },
        { y: 1.565, rx: 0.082, rz: 0.087, w: [[B.neck, 0.7], [B.head, 0.3]], c: scalec(sc, 0.9) },
      ],
      12,
    );
    sb.color(scalec(sc, 0.85)).box(0.05, 1.36, zf(1.36) + 0.006, 0.06, 0.2, 0.02, [[B.chest, 1]]);
    sb.color(scalec(sc, 0.7)).box(0.05, 1.255, zf(1.26) + 0.006, 0.062, 0.012, 0.022, [[B.chest, 0.6], [B.spine, 0.4]]);
  }

  // --- Chaleco, placas y bolsillos ---------------------------------------------------
  if (look.vest !== undefined) {
    const vc = lin(look.vest);
    const vp = pad + 0.028;
    column(
      sb,
      [
        { y: 1.06, rx: waistW + vp, rz: 0.108 * dep + vp + belly * 0.03, w: [[B.spine, 0.7], [B.hips, 0.3]], c: scalec(vc, 0.8) },
        { y: 1.16, rx: waistW + vp + 0.008, rz: 0.112 * dep + vp + belly * 0.02, w: [[B.spine, 1]], c: vc },
        { y: 1.27, rx: shW * 0.9 + vp, rz: 0.122 * dep + vp, w: [[B.spine, 0.5], [B.chest, 0.5]], c: vc },
        { y: 1.38, rx: shW * 0.86 + vp, rz: 0.126 * dep + vp, w: [[B.chest, 1]], c: vc },
        { y: 1.45, rx: shW * 0.66 + vp, rz: 0.11 * dep + vp, w: [[B.chest, 1]], c: scalec(vc, 0.9) },
      ],
      N,
      true,
    );
    // Hebillas laterales
    sb.color(scalec(vc, 0.6));
    for (const s of [1, -1]) for (const y of [1.12, 1.22]) sb.box(s * (waistW + vp + 0.004), y, 0, 0.012, 0.03, 0.05, [[B.spine, 1]]);
    if (look.vestPlates) {
      const pc: RGB = [0.2, 0.21, 0.22];
      sb.color(pc).box(0, 1.3, 0.125 * dep + vp + 0.01, 0.24, 0.22, 0.02, [[B.chest, 0.7], [B.spine, 0.3]]);
      sb.color(scalec(pc, 0.8)).box(0, 1.3, -(0.125 * dep + vp + 0.008), 0.26, 0.26, 0.02, [[B.chest, 0.7], [B.spine, 0.3]]);
      sb.color(scalec(pc, 1.3));
      for (const s of [1, -1]) sb.box(s * 0.1, 1.4, 0.125 * dep + vp + 0.022, 0.012, 0.012, 0.006, [[B.chest, 1]]);
    }
    if (look.pouches) {
      sb.color(scalec(vc, 0.72));
      for (const px of [-0.09, 0, 0.09]) {
        sb.box(px, 1.12, 0.112 * dep + vp + 0.022 + belly * 0.02, 0.07, 0.09, 0.04, [[B.spine, 1]]);
        sb.color(scalec(vc, 0.6)).box(px, 1.16, 0.112 * dep + vp + 0.043 + belly * 0.02, 0.072, 0.02, 0.006, [[B.spine, 1]]);
        sb.color(scalec(vc, 0.72));
      }
    }
  } else if (look.pouches) {
    sb.color([0.12, 0.09, 0.06]);
    for (const px of [-0.12, 0.12]) sb.box(px, 0.99, 0.115 * dep + pad + 0.03, 0.07, 0.08, 0.04, [[B.hips, 1]]);
  }
  if (look.bandolier) {
    const bc: RGB = [0.1, 0.07, 0.045];
    const zb = 0.125 * dep + pad + (look.vest !== undefined ? 0.04 : 0.012);
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = 0.15 - t * 0.3;
      const y = 1.42 - t * 0.36;
      sb.color(bc).box(x, y, zb * (1 - Math.abs(t - 0.5) * 0.1), 0.05, 0.085, 0.012, [[t < 0.5 ? B.chest : B.spine, 1]], 0);
      if (i > 0 && i < 5) sb.color([0.6, 0.48, 0.18]).box(x, y, zb + 0.012, 0.03, 0.03, 0.014, [[t < 0.5 ? B.chest : B.spine, 1]]);
    }
  }
  if (look.medals) {
    const zm = zf(1.365) + 0.004;
    for (let i = 0; i < 3; i++) {
      sb.color(i === 1 ? [0.5, 0.08, 0.06] : [0.62, 0.5, 0.18]).box(0.06 + i * 0.03, 1.365, zm, 0.02, 0.035, 0.008, [[B.chest, 1]]);
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
    for (const s of [1, -1]) sb.color(scalec(bc, 0.75)).box(s * 0.145, 1.24, zb, 0.03, 0.2, 0.12, CW);
    // Manta enrollada
    sb.color([0.36, 0.33, 0.25]);
    sb.blob(0, 1.49, zb, 0.17, 0.055, 0.055, 8, 4, CW);
    sb.color([0.2, 0.15, 0.1]);
    for (const s of [1, -1]) sb.box(s * 0.09, 1.49, zb, 0.012, 0.115, 0.115, CW);
    // Correas
    sb.color(scalec(bc, 0.55));
    for (const s of [1, -1]) {
      sb.box(s * 0.11, 1.32, zf(1.32) + 0.008, 0.035, 0.3, 0.012, [[B.chest, 1]]);
      sb.box(s * 0.11, 1.475, -0.004, 0.035, 0.012, 0.22, [[B.chest, 1]]);
    }
  }

  // Textura de la tela y de la piel: variaciones suaves de tono
  const seedN = look.seed % 997;
  const ph1 = seedN * 0.37;
  const ph2 = seedN * 0.71;
  sb.tint(0, sb.vcount, (x, y, z) => 0.955 + 0.045 * Math.sin(x * 47 + ph1) * Math.sin(y * 39 + z * 21) + 0.03 * Math.sin(z * 53 + y * 17 + ph2));
  return sb.finish();
}
