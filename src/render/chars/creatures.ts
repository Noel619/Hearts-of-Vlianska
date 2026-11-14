// Criaturas de los túneles. Los cuadrúpedos (ratas, skrebuns, cerdos) tienen
// esqueleto propio con patas de tres segmentos —las traseras con corvejón,
// como las de un perro— y cola en cadena; cada especie tiene su malla. Se
// animan con la misma idea que las personas: una pose suavizada (alerta,
// embestida, caída) y encima la marcha, que pasa del paso al trote y al
// galope, con las patas plantadas por cinemática inversa. Los bípedos
// monstruosos (glubinnik, sheptun) usan el esqueleto humano con su propia
// malla y su propia forma de moverse.

import * as THREE from 'three';
import type { CreatureDef } from '../../data/criaturas';
import { clamp, clamp01, hash2, hermite, lerp, smoothstep } from '../../core/math';
import { lin, mixc, scalec, type RGB } from '../geo';
import { cloneProbeMaterial, probeMaterial, setProbe } from '../materials';
import { HumanAnimator, defaultAnimInput, type AnimInput } from './anim';
import { HB, HUMAN_BONES } from './humanoid';
import { SkinBuilder, makeSkeleton, type BoneDef, type W } from './skin';

const PI = Math.PI;
const TAU = PI * 2;

// ---------------------------------------------------------------------------
// Esqueleto del cuadrúpedo
// ---------------------------------------------------------------------------

export const Q = {
  hips: 0,
  spine: 1,
  chest: 2,
  neck: 3,
  head: 4,
  jaw: 5,
  t1: 6,
  t2: 7,
  t3: 8,
  t4: 9,
  flU: 10,
  flL: 11,
  flP: 12,
  frU: 13,
  frL: 14,
  frP: 15,
  blU: 16,
  blL: 17,
  blP: 18,
  brU: 19,
  brL: 20,
  brP: 21,
} as const;
const NQ = 22;

type P3 = [number, number, number];

/** Proporciones de una especie (unidades del modelo, antes de su escala). */
interface QuadProps {
  hip: [number, number];
  chest: [number, number];
  neck: [number, number];
  head: [number, number];
  legX: number;
  /** Pata delantera: hombro, codo, muñeca (y, z) y punta de la pata (z). */
  front: [number, number, number, number, number, number, number];
  /** Pata trasera: cadera, rodilla, corvejón (y, z) y punta de la pata (z). */
  hind: [number, number, number, number, number, number, number];
  tail: number;
}

const PROPS: Record<'rata' | 'skrebun' | 'cerdo', QuadProps> = {
  skrebun: {
    hip: [0.64, -0.34],
    chest: [0.68, 0.24],
    neck: [0.72, 0.44],
    head: [0.77, 0.6],
    legX: 0.12,
    front: [0.62, 0.28, 0.37, 0.21, 0.1, 0.27, 0.35],
    hind: [0.62, -0.36, 0.39, -0.21, 0.15, -0.43, -0.33],
    tail: 0.66,
  },
  rata: {
    hip: [0.5, -0.3],
    chest: [0.46, 0.22],
    neck: [0.48, 0.4],
    head: [0.52, 0.55],
    legX: 0.12,
    front: [0.4, 0.26, 0.23, 0.2, 0.07, 0.25, 0.31],
    hind: [0.46, -0.32, 0.27, -0.16, 0.1, -0.37, -0.27],
    tail: 0.95,
  },
  cerdo: {
    hip: [0.52, -0.36],
    chest: [0.5, 0.26],
    neck: [0.5, 0.44],
    head: [0.48, 0.58],
    legX: 0.15,
    front: [0.38, 0.3, 0.21, 0.29, 0.07, 0.31, 0.36],
    hind: [0.42, -0.38, 0.24, -0.3, 0.085, -0.39, -0.34],
    tail: 0.16,
  },
};

function propsOf(def: CreatureDef): QuadProps {
  return PROPS[def.id as keyof typeof PROPS] ?? PROPS.skrebun;
}

/** Huesos de un cuadrúpedo según sus proporciones. */
export function quadBones(def: CreatureDef): BoneDef[] {
  const p = propsOf(def);
  const t = p.tail;
  const [hy, hz] = p.hip;
  const [cy, cz] = p.chest;
  const out: BoneDef[] = [
    { name: 'hips', parent: -1, pos: [0, hy, hz] },
    { name: 'spine', parent: 0, pos: [0, (hy + cy) / 2 + 0.03, (hz + cz) / 2] },
    { name: 'chest', parent: 1, pos: [0, cy, cz] },
    { name: 'neck', parent: 2, pos: [0, p.neck[0], p.neck[1]] },
    { name: 'head', parent: 3, pos: [0, p.head[0], p.head[1]] },
    { name: 'jaw', parent: 4, pos: [0, p.head[0] - 0.04, p.head[1] + 0.03] },
    { name: 'tail1', parent: 0, pos: [0, hy + 0.01, hz - 0.13] },
    { name: 'tail2', parent: 6, pos: [0, hy - 0.01, hz - 0.13 - t * 0.25] },
    { name: 'tail3', parent: 7, pos: [0, hy - 0.04, hz - 0.13 - t * 0.5] },
    { name: 'tail4', parent: 8, pos: [0, hy - 0.08, hz - 0.13 - t * 0.75] },
  ];
  const f = p.front;
  const h = p.hind;
  for (const s of [1, -1]) {
    const x = p.legX * s;
    const b = out.length;
    out.push({ name: s > 0 ? 'flU' : 'frU', parent: 2, pos: [x, f[0], f[1]] });
    out.push({ name: s > 0 ? 'flL' : 'frL', parent: b, pos: [x, f[2], f[3]] });
    out.push({ name: s > 0 ? 'flP' : 'frP', parent: b + 1, pos: [x, f[4], f[5]] });
  }
  for (const s of [1, -1]) {
    const x = (p.legX + 0.005) * s;
    const b = out.length;
    out.push({ name: s > 0 ? 'blU' : 'brU', parent: 0, pos: [x, h[0], h[1]] });
    out.push({ name: s > 0 ? 'blL' : 'brL', parent: b, pos: [x, h[2], h[3]] });
    out.push({ name: s > 0 ? 'blP' : 'brP', parent: b + 1, pos: [x, h[4], h[5]] });
  }
  return out;
}

/** Puntas de las patas en reposo (contacto con el suelo), en el orden FL, FR, HL, HR. */
export function quadToes(def: CreatureDef): P3[] {
  const p = propsOf(def);
  return [
    [p.legX, 0.012, p.front[6]],
    [-p.legX, 0.012, p.front[6]],
    [p.legX + 0.005, 0.012, p.hind[6]],
    [-(p.legX + 0.005), 0.012, p.hind[6]],
  ];
}

// ---------------------------------------------------------------------------
// Utilidades de malla
// ---------------------------------------------------------------------------

interface TubePt {
  p: P3;
  r: number;
  /** Radio en la otra dirección (si no, igual que r). */
  ry?: number;
  w: W;
  c: RGB;
}

const tv = new THREE.Vector3();
const tu = new THREE.Vector3();
const tw = new THREE.Vector3();

/** Tubo que sigue una polilínea cualquiera: anillos perpendiculares a la dirección local. */
function tube(sb: SkinBuilder, pts: TubePt[], n: number, capStart = false, capEnd = true, jitter = 0, seed = 0) {
  const rings: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)].p;
    const b = pts[Math.min(pts.length - 1, i + 1)].p;
    tv.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    // Base del anillo: u horizontal (eje X si se puede) y w perpendicular a los dos
    tu.set(1, 0, 0);
    if (Math.abs(tv.x) > 0.9) tu.set(0, 0, 1);
    tu.addScaledVector(tv, -tu.dot(tv)).normalize();
    tw.crossVectors(tv, tu).normalize();
    const pt = pts[i];
    const ry = pt.ry ?? pt.r;
    sb.color(pt.c);
    const start = sb.vcount;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * TAU;
      const j = jitter ? 1 + (hash2(i * 31 + k, seed, 5) - 0.5) * jitter : 1;
      const cu = Math.cos(ang) * pt.r * j;
      const cw = Math.sin(ang) * ry * j;
      sb.v(pt.p[0] + tu.x * cu + tw.x * cw, pt.p[1] + tu.y * cu + tw.y * cw, pt.p[2] + tu.z * cu + tw.z * cw, pt.w);
    }
    rings.push(start);
    if (i > 0) {
      const q = pts[i - 1].p;
      sb.bridge(rings[i - 1], start, n, (q[0] + pt.p[0]) / 2, (q[1] + pt.p[1]) / 2, (q[2] + pt.p[2]) / 2);
    }
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (capStart) {
    const nx = pts[1].p;
    sb.color(first.c).fan(rings[0], n, first.p[0], first.p[1], first.p[2], first.w, first.p[0] - nx[0], first.p[1] - nx[1], first.p[2] - nx[2]);
  }
  if (capEnd) {
    const pv = pts[pts.length - 2].p;
    const d = Math.hypot(last.p[0] - pv[0], last.p[1] - pv[1], last.p[2] - pv[2]) || 1;
    const k = (last.r * 0.6) / d;
    sb.color(last.c).fan(
      rings[rings.length - 1],
      n,
      last.p[0] + (last.p[0] - pv[0]) * k,
      last.p[1] + (last.p[1] - pv[1]) * k,
      last.p[2] + (last.p[2] - pv[2]) * k,
      last.w,
      last.p[0] - pv[0],
      last.p[1] - pv[1],
      last.p[2] - pv[2],
    );
  }
  return rings;
}

/** Sección del cuerpo a lo largo de Z: lomo, vientre y semiancho. */
type BodySec = [z: number, top: number, bot: number, rx: number];

/** Pesos del cuerpo según la posición a lo largo del espinazo. */
function spineWeights(defs: BoneDef[], z: number): W {
  const chain = [Q.hips, Q.spine, Q.chest, Q.neck, Q.head];
  const zs = chain.map((b) => defs[b].pos[2]);
  if (z <= zs[0]) return z < zs[0] - 0.12 ? [[Q.hips, 0.8], [Q.t1, 0.2]] : [[Q.hips, 1]];
  for (let i = 1; i < chain.length; i++) {
    if (z <= zs[i]) {
      const t = (z - zs[i - 1]) / (zs[i] - zs[i - 1]);
      return [
        [chain[i - 1], 1 - t],
        [chain[i], t],
      ];
    }
  }
  return [[Q.head, 1]];
}

/** Interpola una tabla de secciones del cuerpo. */
function bodyAt(secs: BodySec[], z: number): BodySec {
  if (z <= secs[0][0]) return secs[0];
  for (let i = 1; i < secs.length; i++) {
    if (z <= secs[i][0]) {
      const a = secs[i - 1];
      const b = secs[i];
      const t = (z - a[0]) / (b[0] - a[0]);
      return [z, lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t)];
    }
  }
  return secs[secs.length - 1];
}

/** Cuerpo: anillos perpendiculares a Z con la sección dada; `col` colorea cada vértice. */
function bodyLoft(sb: SkinBuilder, defs: BoneDef[], secs: BodySec[], n: number, col: (a: number, z: number, y: number) => RGB, jitter = 0, seed = 0, shape = 2.2) {
  const rings: number[] = [];
  const centers: P3[] = [];
  const e = 2 / shape;
  secs.forEach(([z, top, bot, rx], i) => {
    const cy = (top + bot) / 2;
    const ry = (top - bot) / 2;
    const w = spineWeights(defs, z);
    rings.push(
      sb.ringBy(n, (a, k, o) => {
        const c = Math.cos(a);
        const s = Math.sin(a);
        const j = jitter ? 1 + (hash2(i * 17 + k, seed, 9) - 0.5) * jitter : 1;
        o.x = Math.sign(c) * Math.pow(Math.abs(c), e) * rx * j;
        o.y = cy + Math.sign(s) * Math.pow(Math.abs(s), e) * ry * j;
        o.z = z;
        o.c = col(a, z, o.y);
        o.w = w;
      }),
    );
    centers.push([0, cy, z]);
  });
  sb.loft(rings, n, centers);
  // Tapas: la grupa detrás; delante queda dentro del cuello
  const r0 = secs[0];
  sb.color(col(PI / 2, r0[0], (r0[1] + r0[2]) / 2)).fan(rings[0], n, 0, (r0[1] + r0[2]) / 2, r0[0] - r0[3] * 0.5, spineWeights(defs, r0[0]), 0, 0, -1);
  return rings;
}

/** Pata: tubo por hombro o cadera, codo o rodilla, muñeca o corvejón y punta. */
function leg(sb: SkinBuilder, defs: BoneDef[], U: number, rTop: number, rMid: number, rLow: number, rPaw: number, toe: P3, cTop: RGB, cLow: RGB, n = 7) {
  const L = U + 1;
  const Pw = U + 2;
  const parent = defs[U].parent;
  const a = defs[U].pos;
  const b = defs[L].pos;
  const c = defs[Pw].pos;
  const mid = (p: readonly number[], q: readonly number[], t: number): P3 => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
  return tube(
    sb,
    [
      { p: [a[0], a[1] + rTop * 0.7, a[2]], r: rTop * 0.8, w: [[parent, 0.75], [U, 0.25]], c: cTop },
      { p: [a[0], a[1], a[2]], r: rTop, w: [[parent, 0.35], [U, 0.65]], c: cTop },
      { p: mid(a, b, 0.5), r: lerp(rTop, rMid, 0.6), w: [[U, 1]], c: cTop },
      { p: [b[0], b[1], b[2]], r: rMid, w: [[U, 0.5], [L, 0.5]], c: mixc(cTop, cLow, 0.4) },
      { p: mid(b, c, 0.5), r: lerp(rMid, rLow, 0.6), w: [[L, 1]], c: cLow },
      { p: [c[0], c[1], c[2]], r: rLow, w: [[L, 0.5], [Pw, 0.5]], c: cLow },
      { p: mid(c, toe, 0.6), r: rPaw, w: [[Pw, 1]], c: cLow },
      { p: toe, r: rPaw * 0.8, w: [[Pw, 1]], c: scalec(cLow, 0.85) },
    ],
    n,
    false,
    true,
  );
}

function eyes(sb: SkinBuilder, x: number, y: number, z: number, r: number, c: RGB, glow: number, w: W, socket?: RGB) {
  for (const s of [1, -1]) {
    if (socket) sb.color(socket).glow(0).blob(s * x, y, z - r * 0.3, r * 1.5, r * 1.3, r * 0.9, 6, 3, w);
    sb.color(c).glow(glow).blob(s * x, y, z, r, r, r * 0.8, 7, 4, w);
    sb.glow(0);
  }
}

/** Cola en cadena (cuatro huesos), de la grupa a la punta. */
function tailTube(sb: SkinBuilder, defs: BoneDef[], r0: number, r1: number, c0: RGB, c1: RGB, n: number, banded = false) {
  const chain = [Q.t1, Q.t2, Q.t3, Q.t4];
  const P = chain.map((b) => defs[b].pos);
  const end: P3 = [0, P[3][1] - (P[2][1] - P[3][1]) * 1.1 - 0.02, P[3][2] + (P[3][2] - P[2][2])];
  const along: P3[] = [...P.map((p) => [p[0], p[1], p[2]] as P3), end];
  const steps = 10;
  const pts: TubePt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (along.length - 1);
    const k = Math.min(along.length - 2, Math.floor(t));
    const f = t - k;
    const a = along[k];
    const b = along[k + 1];
    const bone = chain[Math.min(3, k)];
    const next = chain[Math.min(3, k + 1)];
    const u = i / steps;
    const band = banded && i % 2 === 1 ? 0.85 : 1;
    const blend = f > 0.6 && next !== bone ? (f - 0.6) / 0.8 : 0;
    pts.push({
      p: [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)],
      r: lerp(r0, r1, u),
      w: blend > 0 ? [[bone, 1 - blend], [next, blend]] : i === 0 ? [[Q.hips, 0.5], [bone, 0.5]] : [[bone, 1]],
      c: scalec(mixc(c0, c1, u), band),
    });
  }
  tube(sb, pts, n, false, true);
}

// ---------------------------------------------------------------------------
// Mallas de los cuadrúpedos
// ---------------------------------------------------------------------------

/** Malla de un cuadrúpedo: rata, skrebun o cerdo, cada uno con su forma. */
export function buildQuadruped(def: CreatureDef): THREE.BufferGeometry {
  if (def.id === 'rata') return buildRat(def);
  if (def.id === 'cerdo') return buildPig(def);
  return buildSkrebun(def);
}

const LIMBS: [number, number][] = [
  [Q.flU, 0],
  [Q.frU, 1],
  [Q.blU, 2],
  [Q.brU, 3],
];

/**
 * Skrebun: pálido, sin pelo y consumido. Grupa huesuda, cintura recogida,
 * pecho hondo con las costillas marcadas, púas en el espinazo, cráneo largo
 * con los labios recogidos sobre los dientes y garras como hoces.
 */
function buildSkrebun(def: CreatureDef): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const defs = quadBones(def);
  const base = lin(def.color);
  const dark = lin(def.color2);
  const pale = scalec(base, 1.12);
  const body: BodySec[] = [
    [-0.52, 0.67, 0.56, 0.05],
    [-0.45, 0.73, 0.52, 0.1],
    [-0.36, 0.77, 0.5, 0.125],
    [-0.24, 0.76, 0.53, 0.105],
    [-0.12, 0.75, 0.55, 0.09],
    [0.0, 0.77, 0.5, 0.11],
    [0.1, 0.8, 0.45, 0.14],
    [0.2, 0.82, 0.45, 0.15],
    [0.3, 0.82, 0.5, 0.135],
    [0.38, 0.8, 0.58, 0.105],
    [0.46, 0.79, 0.66, 0.072],
  ];
  bodyLoft(sb, defs, body, 14, (a, z, y) => {
    const s = Math.sin(a);
    // Costillas: bandas oscuras en los flancos del pecho
    const rib = z > -0.04 && z < 0.3 && Math.abs(Math.cos(a)) > 0.45 && s < 0.5 && Math.sin(((z + 0.04) / 0.055) * PI) > 0.55;
    const c = s < -0.3 ? mixc(pale, [0.75, 0.62, 0.58], 0.25) : rib ? scalec(base, 0.7) : base;
    return y > 0.74 ? scalec(c, 0.88) : c;
  });
  // Espinazo con púas de hueso
  sb.color(scalec(dark, 0.75));
  for (let i = 0; i < 9; i++) {
    const z = -0.42 + i * 0.1;
    const top = bodyAt(body, z)[1];
    const h = 0.05 + 0.03 * Math.sin((i / 8) * PI);
    sb.blob(0, top + h * 0.4, z, 0.014, h, 0.03, 5, 3, spineWeights(defs, z));
  }
  // Cuello y cráneo alargado; la mandíbula aparte
  const HW: W = [[Q.head, 1]];
  tube(
    sb,
    [
      { p: [0, 0.74, 0.42], r: 0.078, ry: 0.088, w: [[Q.chest, 0.4], [Q.neck, 0.6]], c: base },
      { p: [0, 0.77, 0.52], r: 0.072, ry: 0.078, w: [[Q.neck, 0.6], [Q.head, 0.4]], c: base },
      { p: [0, 0.79, 0.6], r: 0.078, ry: 0.07, w: HW, c: base },
      { p: [0, 0.79, 0.67], r: 0.066, ry: 0.058, w: HW, c: base },
      { p: [0, 0.775, 0.75], r: 0.048, ry: 0.042, w: HW, c: scalec(base, 0.95) },
      { p: [0, 0.762, 0.82], r: 0.032, ry: 0.03, w: HW, c: mixc(base, dark, 0.3) },
      { p: [0, 0.755, 0.86], r: 0.018, ry: 0.018, w: HW, c: dark },
    ],
    10,
  );
  // Labios recogidos: encía oscura y la fila de dientes de arriba
  sb.color([0.3, 0.12, 0.12]).blob(0, 0.737, 0.745, 0.042, 0.014, 0.1, 8, 3, HW);
  sb.color([0.86, 0.82, 0.7]);
  for (let i = 0; i < 7; i++) {
    const z = 0.67 + i * 0.026;
    const x = 0.036 - i * 0.003;
    for (const s of [1, -1]) sb.box(s * x, 0.726, z, 0.007, 0.022 - i * 0.0015, 0.008, HW);
  }
  // Mandíbula con sus dientes
  const JW: W = [[Q.jaw, 1]];
  tube(
    sb,
    [
      { p: [0, 0.69, 0.6], r: 0.05, ry: 0.025, w: [[Q.jaw, 0.7], [Q.head, 0.3]], c: dark },
      { p: [0, 0.695, 0.7], r: 0.042, ry: 0.02, w: JW, c: scalec(base, 0.85) },
      { p: [0, 0.705, 0.8], r: 0.025, ry: 0.014, w: JW, c: scalec(base, 0.8) },
    ],
    8,
    true,
  );
  sb.color([0.86, 0.82, 0.7]);
  for (let i = 0; i < 6; i++) {
    const z = 0.66 + i * 0.026;
    const x = 0.03 - i * 0.003;
    for (const s of [1, -1]) sb.box(s * x, 0.718, z, 0.006, 0.02 - i * 0.0015, 0.007, JW);
  }
  // Ojos que brillan y agujeros donde tendría orejas
  eyes(sb, 0.048, 0.81, 0.69, 0.013, lin(def.eyes), 5, HW, [0.08, 0.06, 0.05]);
  sb.color([0.12, 0.08, 0.07]);
  for (const s of [1, -1]) sb.blob(s * 0.07, 0.82, 0.57, 0.012, 0.016, 0.014, 5, 3, HW);
  // Patas largas y huesudas con garras como hoces
  const T = quadToes(def);
  for (const [U, i] of LIMBS) {
    leg(sb, defs, U, i < 2 ? 0.058 : 0.072, 0.036, 0.026, 0.024, T[i], base, mixc(base, dark, 0.35), 8);
    sb.color([0.1, 0.08, 0.07]);
    const t = T[i];
    for (const k of [-1, 0, 1]) {
      const v0 = sb.vcount;
      sb.blob(t[0] + k * 0.018, 0.022, t[2] + 0.05, 0.006, 0.01, 0.05, 4, 3, [[U + 2, 1]]);
      sb.rotate(v0, sb.vcount, t[0] + k * 0.018, 0.022, t[2] + 0.02, 0.5, k * 0.15);
    }
  }
  // Cola fina como un látigo
  tailTube(sb, defs, 0.034, 0.006, dark, base, 8);
  return sb.finish(0.35);
}

/**
 * Rata de túnel: del tamaño de un perro. Cuerpo de pera con el lomo
 * arqueado y el pelo erizado, hocico afilado con bigotes, incisivos
 * amarillos, orejas redondas y rosadas, manos rosadas y cola larga anillada.
 */
function buildRat(def: CreatureDef): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const defs = quadBones(def);
  const fur = lin(def.color);
  const furL = lin(def.color2);
  const pink: RGB = lin(0xa07a70);
  const seed = 17;
  const body: BodySec[] = [
    [-0.43, 0.5, 0.42, 0.06],
    [-0.38, 0.58, 0.35, 0.14],
    [-0.28, 0.63, 0.31, 0.19],
    [-0.14, 0.64, 0.3, 0.2],
    [0.0, 0.61, 0.31, 0.18],
    [0.12, 0.575, 0.33, 0.16],
    [0.24, 0.55, 0.36, 0.135],
    [0.33, 0.54, 0.4, 0.1],
  ];
  bodyLoft(
    sb,
    defs,
    body,
    16,
    (a, z) => {
      const s = Math.sin(a);
      const c = s < -0.35 ? furL : s > 0.6 ? scalec(fur, 0.85) : fur;
      return scalec(c, 0.86 + 0.28 * hash2(Math.round(a * 10), Math.round(z * 40), seed));
    },
    0.14,
    seed,
  );
  // Cabeza puntiaguda
  const HW: W = [[Q.head, 1]];
  tube(
    sb,
    [
      { p: [0, 0.48, 0.32], r: 0.1, ry: 0.08, w: [[Q.chest, 0.4], [Q.neck, 0.6]], c: fur },
      { p: [0, 0.5, 0.42], r: 0.096, ry: 0.078, w: [[Q.neck, 0.5], [Q.head, 0.5]], c: fur },
      { p: [0, 0.505, 0.51], r: 0.078, ry: 0.066, w: HW, c: fur },
      { p: [0, 0.495, 0.59], r: 0.052, ry: 0.046, w: HW, c: mixc(fur, furL, 0.3) },
      { p: [0, 0.482, 0.66], r: 0.03, ry: 0.028, w: HW, c: mixc(fur, furL, 0.5) },
      { p: [0, 0.474, 0.7], r: 0.016, ry: 0.016, w: HW, c: pink },
    ],
    10,
    false,
    true,
    0.12,
    seed + 1,
  );
  // Mandíbula, incisivos amarillos y bigotes
  sb.color(furL).blob(0, 0.448, 0.6, 0.036, 0.016, 0.08, 7, 3, [[Q.jaw, 1]]);
  sb.color([0.8, 0.66, 0.3]);
  for (const s of [1, -1]) sb.box(s * 0.006, 0.452, 0.69, 0.008, 0.024, 0.006, HW);
  sb.color([0.12, 0.1, 0.09]);
  for (const s of [1, -1]) {
    for (let k = 0; k < 3; k++) {
      const v0 = sb.vcount;
      sb.box(s * 0.06, 0.485 - k * 0.008, 0.645, 0.09, 0.0025, 0.0025, HW);
      sb.rotate(v0, sb.vcount, s * 0.02, 0.485, 0.645, 0, s * (0.25 - k * 0.2), s * (k - 1) * 0.12);
    }
  }
  // Orejas redondas y rosadas
  for (const s of [1, -1]) {
    const v0 = sb.vcount;
    sb.color(pink).blob(s * 0.065, 0.575, 0.465, 0.034, 0.038, 0.01, 8, 4, HW);
    sb.color(scalec(pink, 0.7)).blob(s * 0.066, 0.574, 0.471, 0.022, 0.026, 0.006, 7, 3, HW);
    sb.rotate(v0, sb.vcount, s * 0.065, 0.56, 0.465, -0.3, s * 0.5, s * 0.3);
  }
  eyes(sb, 0.042, 0.53, 0.575, 0.013, lin(def.eyes), 5, HW);
  // Patas cortas con manos rosadas
  const T = quadToes(def);
  for (const [U, i] of LIMBS) {
    leg(sb, defs, U, i < 2 ? 0.06 : 0.085, 0.034, 0.022, 0.022, T[i], fur, pink, 7);
    sb.color(scalec(pink, 0.85));
    const t = T[i];
    for (const k of [-1, 0, 1]) sb.blob(t[0] + k * 0.014, 0.012, t[2] + 0.03, 0.006, 0.006, 0.02, 4, 3, [[U + 2, 1]]);
  }
  // Cola larga, rosada y anillada
  tailTube(sb, defs, 0.032, 0.006, pink, scalec(pink, 0.8), 7, true);
  return sb.finish(0.35);
}

/**
 * Cerdo del metro: barril redondo con la tripa caída, cerdas en el lomo,
 * cabeza grande con el disco del hocico, orejas caídas, patas cortas con
 * pezuñas partidas y cola rizada.
 */
function buildPig(def: CreatureDef): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const defs = quadBones(def);
  const skin = lin(def.color);
  const dark = lin(def.color2);
  const snoutC: RGB = lin(0xd8a8a0);
  const body: BodySec[] = [
    [-0.54, 0.54, 0.46, 0.07],
    [-0.48, 0.62, 0.35, 0.16],
    [-0.38, 0.67, 0.3, 0.21],
    [-0.22, 0.69, 0.26, 0.23],
    [0.0, 0.69, 0.25, 0.235],
    [0.18, 0.67, 0.27, 0.22],
    [0.32, 0.64, 0.31, 0.19],
    [0.42, 0.61, 0.37, 0.15],
  ];
  bodyLoft(sb, defs, body, 16, (a, z) => {
    const c = Math.sin(a) < -0.4 ? scalec(skin, 1.08) : skin;
    // Manchas
    return scalec(c, hash2(Math.round(a * 4), Math.round(z * 10), 23) > 0.82 ? 0.75 : 1);
  });
  // Cerdas del lomo
  sb.color(scalec(dark, 0.8));
  for (let i = 0; i < 8; i++) {
    const z = -0.36 + i * 0.09;
    sb.box(0, bodyAt(body, z)[1] + 0.008, z, 0.012, 0.018, 0.05, spineWeights(defs, z));
  }
  // Cabeza grande con el hocico chato
  const HW: W = [[Q.head, 1]];
  tube(
    sb,
    [
      { p: [0, 0.5, 0.4], r: 0.15, ry: 0.13, w: [[Q.chest, 0.4], [Q.neck, 0.6]], c: skin },
      { p: [0, 0.5, 0.5], r: 0.14, ry: 0.13, w: [[Q.neck, 0.5], [Q.head, 0.5]], c: skin },
      { p: [0, 0.485, 0.6], r: 0.115, ry: 0.105, w: HW, c: skin },
      { p: [0, 0.465, 0.69], r: 0.08, ry: 0.07, w: HW, c: skin },
      { p: [0, 0.455, 0.76], r: 0.062, ry: 0.055, w: HW, c: mixc(skin, snoutC, 0.5) },
      { p: [0, 0.455, 0.785], r: 0.064, ry: 0.056, w: HW, c: snoutC },
    ],
    12,
    false,
    false,
  );
  // Disco del hocico con los orificios
  sb.color(snoutC).blob(0, 0.455, 0.785, 0.064, 0.056, 0.014, 12, 3, HW);
  sb.color([0.25, 0.12, 0.12]);
  for (const s of [1, -1]) sb.blob(s * 0.022, 0.456, 0.798, 0.011, 0.016, 0.004, 6, 3, HW);
  // Boca y papada
  sb.color(scalec(skin, 0.55)).box(0, 0.42, 0.72, 0.09, 0.006, 0.08, [[Q.jaw, 1]]);
  sb.color(scalec(skin, 0.9)).blob(0, 0.41, 0.66, 0.07, 0.03, 0.08, 8, 3, [[Q.jaw, 1]]);
  // Orejas caídas hacia delante
  for (const s of [1, -1]) {
    const v0 = sb.vcount;
    sb.color(scalec(skin, 0.92)).blob(s * 0.085, 0.59, 0.6, 0.055, 0.012, 0.075, 8, 3, HW);
    sb.rotate(v0, sb.vcount, s * 0.07, 0.59, 0.56, 0.7, s * 0.35, -s * 0.5);
  }
  eyes(sb, 0.07, 0.535, 0.665, 0.011, lin(def.eyes), 0, HW);
  // Patas cortas con pezuñas partidas
  const T = quadToes(def);
  for (const [U, i] of LIMBS) {
    leg(sb, defs, U, i < 2 ? 0.095 : 0.12, 0.066, 0.05, 0.044, T[i], skin, scalec(skin, 0.9), 8);
    const t = T[i];
    sb.color([0.16, 0.12, 0.1]);
    for (const k of [-1, 1]) sb.blob(t[0] + k * 0.014, 0.022, t[2] + 0.01, 0.014, 0.022, 0.03, 5, 3, [[U + 2, 1]]);
  }
  // Cola corta y rizada
  const tz = defs[Q.t1].pos[2];
  const ty = defs[Q.t1].pos[1];
  const pts: TubePt[] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * PI * 1.6;
    pts.push({
      p: [Math.sin(a) * 0.025, ty + 0.02 + Math.sin(a * 0.5) * 0.04, tz + 0.02 - (1 - Math.cos(a)) * 0.02 - i * 0.008],
      r: 0.012 - i * 0.0012,
      w: i < 2 ? [[Q.hips, 0.5], [Q.t1, 0.5]] : [[Q.t1, 0.5], [Q.t2, 0.5]],
      c: scalec(skin, 0.9),
    });
  }
  tube(sb, pts, 5);
  return sb.finish(0.35);
}

// ---------------------------------------------------------------------------
// Animación de los cuadrúpedos
// ---------------------------------------------------------------------------

export interface QuadInput {
  /** Velocidad (unidades del modelo por segundo) y distancia recorrida en este fotograma. */
  speed: number;
  dist: number;
  turn: number;
  attackT: number;
  attacking: boolean;
  sinceHit: number;
  hitSide: number;
  dead: boolean;
  alert: number;
  seed: number;
  /** Hacia dónde mira respecto al frente (rad; + izquierda) o null. */
  look?: number | null;
}

interface Leg {
  side: 1 | -1;
  front: boolean;
  U: number;
  L1: number;
  L2: number;
  /** Del codo o corvejón a la punta de la pata, en reposo. */
  paw: THREE.Vector3;
  rest: P3;
  /** Inversas de los marcos de reposo de cada segmento. */
  qr: [THREE.Quaternion, THREE.Quaternion, THREE.Quaternion];
  /** +1: la rodilla apunta adelante (trasera); -1: el codo apunta atrás (delantera). */
  pole: 1 | -1;
  /** Desfase en el paso, el trote y el galope. */
  off: [number, number, number];
}

const X_AXIS = new THREE.Vector3(1, 0, 0);
const ONE = new THREE.Vector3(1, 1, 1);
const mA = new THREE.Matrix4();
const mHips = new THREE.Matrix4();
const mSpine = new THREE.Matrix4();
const mChest = new THREE.Matrix4();
const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const qPar = new THREE.Quaternion();
const qInv = new THREE.Quaternion();
const qU = new THREE.Quaternion();
const qL = new THREE.Quaternion();
const qP = new THREE.Quaternion();
const vJ = new THREE.Vector3();
const vT = new THREE.Vector3();
const vW = new THREE.Vector3();
const vK = new THREE.Vector3();
const vD = new THREE.Vector3();
const vS = new THREE.Vector3();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const vH = new THREE.Vector3();
const vPole = new THREE.Vector3();
const vX = new THREE.Vector3();
const vY = new THREE.Vector3();
const vZ = new THREE.Vector3();
const tmpE = new THREE.Euler();

/** Marco ortonormal con el eje Y en `d` y el X lo más cerca posible de `h`. */
function frameQ(h: THREE.Vector3, d: THREE.Vector3, out: THREE.Quaternion) {
  vY.copy(d).normalize();
  vX.copy(h).addScaledVector(vY, -h.dot(vY));
  if (vX.lengthSq() < 1e-8) vX.set(1, 0, 0).addScaledVector(vY, -vY.x);
  vX.normalize();
  vZ.crossVectors(vX, vY);
  mA.makeBasis(vX, vY, vZ);
  return out.setFromRotationMatrix(mA);
}

export class QuadAnimator {
  phase = 0;
  time = 0;
  private cyc = 0;
  private cur = new Float32Array(NQ * 3);
  private tgt = new Float32Array(NQ * 3);
  private y: number;
  private fz = 0;
  private fx = 0;
  private rz = 0;
  private rx = 0;
  private first = true;
  private v = 0;
  private turnS = 0;
  private alertW = 0;
  private deadT = -1;
  private upW = 1;
  private lookW = 0;
  private lookYaw = 0;
  private legs: Leg[];
  private restY: number;
  private restZ: number;
  private sniff = 0;
  private sniffWait: number;
  private seedA: number;
  private targets = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  private pitches = [0, 0, 0, 0];
  private plants = [1, 1, 1, 1];

  constructor(
    readonly bones: THREE.Bone[],
    seed: number,
    readonly def: CreatureDef,
  ) {
    this.time = hash2(seed, 2, 5) * 10;
    this.cyc = hash2(seed, 3, 5);
    this.seedA = hash2(seed, 4, 5);
    this.sniffWait = 2 + this.seedA * 6;
    const defs = quadBones(def);
    this.restY = defs[0].pos[1];
    this.restZ = defs[0].pos[2];
    this.y = this.restY;
    const T = quadToes(def);
    const mk = (U: number, i: number): Leg => {
      const a = new THREE.Vector3(...defs[U].pos);
      const b = new THREE.Vector3(...defs[U + 1].pos);
      const c = new THREE.Vector3(...defs[U + 2].pos);
      const t = new THREE.Vector3(...T[i]);
      const front = i < 2;
      const inv = (d: THREE.Vector3) => frameQ(X_AXIS, d, new THREE.Quaternion()).invert();
      return {
        side: i % 2 === 0 ? 1 : -1,
        front,
        U,
        L1: a.distanceTo(b),
        L2: b.distanceTo(c),
        paw: t.clone().sub(c),
        rest: T[i],
        qr: [inv(b.clone().sub(a)), inv(c.clone().sub(b)), inv(t.clone().sub(c))],
        pole: front ? -1 : 1,
        // Paso lateral (TI, DI, TD, DD), trote en diagonal y galope rotatorio
        off: front ? (i === 0 ? [0.25, 0.0, 0.52] : [0.75, 0.5, 0.42]) : i === 2 ? [0.0, 0.5, 0.0] : [0.5, 0.0, 0.1],
      };
    };
    this.legs = [mk(Q.flU, 0), mk(Q.frU, 1), mk(Q.blU, 2), mk(Q.brU, 3)];
  }

  update(dt: number, s: QuadInput) {
    this.time += dt;
    const t = this.time;
    const first = this.first;
    const ease = (r: number) => (first ? 1 : 1 - Math.exp(-r * dt));
    // --- Parámetros suavizados ---------------------------------------------------
    this.v += (Math.max(0, s.speed) - this.v) * ease(8);
    const v = this.v;
    this.turnS += (clamp(s.turn, -6, 6) - this.turnS) * ease(5);
    this.alertW += ((s.alert > 0 && !s.dead ? 1 : 0) - this.alertW) * ease(3);
    if (s.dead && this.deadT < 0) this.deadT = first ? 9 : 0;
    if (!s.dead) this.deadT = -1;
    if (this.deadT >= 0) this.deadT += dt;
    this.upW += ((s.dead ? 0 : 1) - this.upW) * ease(s.dead ? 18 : 5);
    const walk = smoothstep(0.03, 0.25, v);
    const trot = smoothstep(0.45, 1.3, v);
    const gal = smoothstep(2.4, 4.4, v);
    const idle = 1 - walk;
    // --- Zancada --------------------------------------------------------------------
    const legLen = this.legs[2].L1 + this.legs[2].L2;
    const S = Math.max(0.3, Math.min(lerp(lerp(0.35 + 0.6 * v, 0.5 + 0.42 * v, trot), 0.9 + 0.3 * v, gal), 4.2 * legLen));
    const moved = s.dist >= 0 ? s.dist : v * dt;
    this.cyc = (this.cyc + Math.min(0.45, moved / S)) % 1;
    this.phase = this.cyc * TAU;
    const beta = Math.min(lerp(lerp(0.66, 0.46, trot), 0.32, gal), (legLen * 0.95) / S);
    // --- Pose objetivo (se suaviza) ----------------------------------------------------
    const e = this.tgt;
    e.fill(0);
    const set = (b: number, x: number, y = 0, z = 0) => {
      e[b * 3] = x;
      e[b * 3 + 1] = y;
      e[b * 3 + 2] = z;
    };
    const add = (b: number, x: number, y = 0, z = 0) => {
      e[b * 3] += x;
      e[b * 3 + 1] += y;
      e[b * 3 + 2] += z;
    };
    let ty = this.restY * 0.965 - 0.02 * trot - 0.03 * gal;
    let tfz = 0;
    let tfx = 0;
    let trz = 0;
    let trx = 0;
    // Alerta: agachado, cabeza baja y adelantada, cola tiesa
    const al = this.alertW;
    ty -= 0.06 * al;
    add(Q.neck, 0.18 * al);
    add(Q.head, -0.12 * al);
    add(Q.t1, -0.15 * al);
    // Al correr estira el cuello hacia delante
    add(Q.neck, -0.12 * gal + 0.08 * trot * (1 - gal));
    // Olfatear: de vez en cuando baja la cabeza al suelo
    if (!s.dead && idle > 0.8 && !s.attacking && al < 0.3) {
      this.sniffWait -= dt;
      if (this.sniffWait <= 0 && this.sniff <= 0) {
        this.sniff = 2.5;
        this.sniffWait = 4 + hash2(Math.floor(t), 7, 3) * 8;
      }
    }
    if (this.sniff > 0) {
      this.sniff -= dt;
      const u = 1 - this.sniff / 2.5;
      const env = smoothstep(0, 0.2, u) * (1 - smoothstep(0.8, 1, u)) * idle;
      add(Q.neck, 0.55 * env, 0.25 * env * Math.sin(t * 1.3));
      add(Q.head, 0.25 * env + 0.05 * env * Math.sin(t * 22));
      ty -= 0.02 * env;
    }
    // Mira al enemigo o alrededor
    const want = s.look !== undefined && s.look !== null && !s.dead;
    this.lookW += ((want ? 1 : 0) - this.lookW) * ease(4);
    if (want) this.lookYaw += (clamp(s.look!, -1.2, 1.2) - this.lookYaw) * ease(6);
    const wander = idle * (1 - this.lookW) * 0.35 * Math.sin(t * 0.37 + this.seedA * 9);
    add(Q.neck, 0, this.lookYaw * this.lookW * 0.5 + wander * 0.6);
    add(Q.head, 0, this.lookYaw * this.lookW * 0.5 + wander * 0.4);
    // Mandíbula: entreabierta; jadea al correr; el skrebun la tiene siempre algo abierta
    set(Q.jaw, (this.def.id === 'skrebun' ? 0.12 : 0.04) + 0.12 * gal * (0.5 + 0.5 * Math.sin(t * 9)) + 0.03 * Math.sin(t * 2.7) * idle);
    // Ataque: se agacha, salta con las zarpas por delante y muerde
    let reach = 0;
    if (s.attacking && !s.dead) {
      const a = clamp01(s.attackT);
      const wind = smoothstep(0, 0.3, a) * (1 - smoothstep(0.3, 0.45, a));
      const lunge = smoothstep(0.3, 0.46, a) * (1 - smoothstep(0.6, 1, a));
      const bite = smoothstep(0.38, 0.48, a) * (1 - smoothstep(0.5, 0.62, a));
      ty += -0.1 * wind + 0.06 * lunge;
      tfz += -0.07 * wind + 0.3 * lunge;
      trx += 0.12 * wind - 0.22 * lunge;
      add(Q.neck, 0.2 * wind - 0.35 * lunge);
      add(Q.head, -0.2 * wind + 0.15 * lunge);
      add(Q.spine, -0.1 * wind + 0.12 * lunge);
      set(Q.jaw, 0.25 * wind + 0.95 * lunge * (1 - bite) + 0.1 * bite);
      add(Q.t1, -0.3 * wind);
      reach = lunge;
    }
    // Golpe recibido: se encoge hacia un lado
    if (s.sinceHit < 0.5 && !s.dead) {
      const r = Math.exp(-s.sinceHit * 9) * Math.sin(Math.min(1, s.sinceHit * 14) * Math.PI * 0.5);
      const hs = s.hitSide || 1;
      add(Q.spine, 0.15 * r, 0.3 * r * hs);
      add(Q.neck, -0.2 * r);
      trz += 0.25 * r * hs;
      tfx -= 0.06 * r * hs;
      ty -= 0.04 * r;
    }
    // Muerte: ceden las patas, cae de costado y patalea un momento
    const side = this.seedA < 0.5 ? 1 : -1;
    if (s.dead) {
      const f = Math.min(this.deadT, 3);
      const buckle = smoothstep(0, 0.25, f);
      const roll = smoothstep(0.2, 0.6, f);
      ty = lerp(this.restY, lerp(this.restY * 0.55, 0.15, roll), buckle);
      trz = side * (PI / 2 - 0.12) * roll * roll;
      set(Q.neck, 0.3 * roll, -0.4 * side * roll);
      set(Q.head, 0.4 * roll, -0.2 * side * roll);
      set(Q.jaw, 0.45 * roll);
      const kick = f < 1.6 ? Math.sin(f * 26) * (1 - f / 1.6) * 0.25 * roll : 0;
      for (const L of this.legs) {
        const bend = (1 - roll) * 0.9;
        set(L.U, (L.front ? -0.25 : 0.35) * roll + kick * L.side + (L.front ? 0.6 : -0.6) * bend);
        set(L.U + 1, (L.front ? 0.45 : -0.4) * roll + (L.front ? 0.8 : -0.8) * bend);
        set(L.U + 2, 0.4 * roll);
      }
      set(Q.t1, 0.4, 0.3 * side);
      set(Q.t2, 0.2);
    }
    // --- Suavizado ------------------------------------------------------------------------
    const k = ease(s.attacking ? 26 : s.dead ? 30 : 12);
    const kr = ease(s.attacking ? 22 : s.dead ? 30 : 9);
    this.first = false;
    for (let i = 0; i < NQ * 3; i++) this.cur[i] += (e[i] - this.cur[i]) * k;
    this.y += (ty - this.y) * kr;
    this.fz += (tfz - this.fz) * k;
    this.fx += (tfx - this.fx) * k;
    this.rz += (trz - this.rz) * kr;
    this.rx += (trx - this.rx) * kr;
    // --- Capa cíclica: lomo que se flexiona al galopar, bote, curvas, respiración, cola ----------
    const F = this.tgt;
    F.set(this.cur);
    const up = this.upW;
    const ph = this.phase;
    const gw = walk * up;
    // Galope: el espinazo se dobla y se estira como un muelle y el cuerpo cabecea
    const flex = Math.sin(ph) * gal * gw;
    F[Q.spine * 3] += 0.16 * flex;
    F[Q.chest * 3] -= 0.1 * flex;
    const pitch = 0.07 * Math.sin(ph + 1.2) * gal * gw;
    // Trote: dos botes por zancada; paso: un bamboleo de lado
    const y = this.y + (0.012 * Math.cos(2 * ph) * trot * (1 - gal) + 0.035 * Math.sin(ph + 0.6) * gal) * gw;
    F[Q.spine * 3 + 2] += 0.05 * Math.sin(ph) * walk * (1 - trot) * up;
    F[Q.spine * 3 + 1] += 0.06 * Math.sin(ph) * walk * up;
    // La cabeza compensa el cabeceo
    F[Q.neck * 3] -= 0.6 * pitch;
    // Curvas: el cuerpo se dobla hacia dentro
    const bend = clamp(this.turnS * 0.08, -0.25, 0.25) * up;
    F[Q.spine * 3 + 1] += bend;
    F[Q.chest * 3 + 1] += bend;
    // Respiración
    F[Q.chest * 3] += 0.015 * Math.sin(t * (1.8 + 2.5 * gal)) * up;
    // Cola: una ola que recorre la cadena con retraso; meneo en reposo, estela al correr
    const pig = this.def.id === 'cerdo';
    const tailAmp = (0.1 + 0.22 * idle * (pig ? 2 : 1) + 0.1 * walk) * up;
    const tailLift = this.def.id === 'rata' ? 0.12 : pig ? -0.5 : 0.05 - 0.2 * gal;
    for (let i = 0; i < 4; i++) {
      const b = Q.t1 + i;
      F[b * 3] += (i === 0 ? tailLift : 0.04 + 0.05 * i * idle) * up + (1 - up) * 0.15;
      F[b * 3 + 1] += tailAmp * Math.sin(t * (2.2 + 4 * walk) - i * 0.9 + this.seedA * 6) * (0.5 + i * 0.25) - this.turnS * 0.08 * i * up;
    }
    // --- Volcado a los huesos ----------------------------------------------------------------
    const bones = this.bones;
    for (let i = 1; i < NQ; i++) {
      tmpE.set(F[i * 3], F[i * 3 + 1], F[i * 3 + 2], 'YXZ');
      bones[i].quaternion.setFromEuler(tmpE);
    }
    tmpE.set(this.rx + pitch + F[0], F[1], this.rz + F[2], 'YXZ');
    bones[0].quaternion.setFromEuler(tmpE);
    bones[0].position.set(this.fx, y, this.restZ + this.fz);
    // --- Patas plantadas ------------------------------------------------------------------------
    if (up > 0.002) this.plant(walk, trot, gal, beta, S, reach, up);
  }

  /** Coloca las cuatro patas: zancada con su desfase, salto del ataque y suelo. */
  private plant(walk: number, trot: number, gal: number, beta: number, S: number, reach: number, w: number) {
    const bones = this.bones;
    const root = bones[0];
    const H = lerp(lerp(0.06, 0.1, trot), 0.16, gal) * (this.def.id === 'cerdo' ? 0.7 : 1);
    const D = beta * S;
    const c0 = -0.02 * gal;
    // Objetivos de cada pata
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      const off = lerp(lerp(L.off[0], L.off[1], trot), L.off[2], gal);
      const u = (this.cyc + off) % 1;
      let along: number;
      let lift = 0;
      let pitch: number;
      let plant = 1;
      if (u < beta) {
        const sp = u / beta;
        along = D * (0.5 - sp) + c0;
        pitch = 0.5 * smoothstep(0.6, 1, sp);
      } else {
        const sw = (u - beta) / (1 - beta);
        const m = -S * (1 - beta);
        along = hermite(-D / 2 + c0, 0.85 * m, D / 2 + c0, 0.35 * m, sw);
        lift = H * Math.sin(PI * Math.pow(sw, 0.8));
        pitch = lerp(0.5, -0.1, smoothstep(0.1, 0.9, sw)) + 0.5 * Math.sin(PI * sw);
        plant = Math.max(1 - smoothstep(0, 0.2, sw), smoothstep(0.8, 1, sw));
      }
      const t = this.targets[i];
      t.set(L.rest[0], L.rest[1] + lift * walk, L.rest[2] + along * walk);
      // Ataque: las patas de delante se levantan y se estiran hacia la presa
      if (L.front && reach > 0) {
        t.z += 0.22 * reach;
        t.y += 0.16 * reach;
        plant *= 1 - reach;
      }
      this.pitches[i] = pitch * walk + (L.front ? -0.6 : 0) * reach;
      this.plants[i] = lerp(1, plant, walk);
    }
    // El cuerpo baja lo que haga falta para que lleguen las patas que apoyan
    this.girdles(root);
    let drop = 0;
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      const M = L.front ? mChest : mHips;
      vJ.copy(bones[L.U].position).applyMatrix4(M);
      qA.setFromAxisAngle(X_AXIS, this.pitches[i]);
      vD.copy(L.paw).applyQuaternion(qA);
      vW.copy(this.targets[i]).sub(vD);
      const R = (L.L1 + L.L2) * 0.97;
      const hx = vW.x - vJ.x;
      const hz = vW.z - vJ.z;
      const need = vJ.y - (vW.y + Math.sqrt(Math.max(0, R * R - hx * hx - hz * hz)));
      drop = Math.max(drop, need * this.plants[i]);
    }
    if (drop > 0) {
      root.position.y -= Math.min(drop, 0.25) * w;
      this.girdles(root);
    }
    for (let i = 0; i < 4; i++) {
      const L = this.legs[i];
      this.solveLeg(L, L.front ? mChest : mHips, this.targets[i], this.pitches[i], w);
    }
  }

  /** Matrices de la pelvis y del pecho en el espacio de la malla. */
  private girdles(root: THREE.Bone) {
    const bones = this.bones;
    mHips.compose(root.position, root.quaternion, ONE);
    mSpine.compose(bones[Q.spine].position, bones[Q.spine].quaternion, ONE).premultiply(mHips);
    mChest.compose(bones[Q.chest].position, bones[Q.chest].quaternion, ONE).premultiply(mSpine);
  }

  /** IK de una pata de tres segmentos: la punta en `toe` y el último segmento con el cabeceo dado. */
  private solveLeg(L: Leg, parentM: THREE.Matrix4, toe: THREE.Vector3, pitch: number, w: number) {
    const bones = this.bones;
    const bU = bones[L.U];
    const bL = bones[L.U + 1];
    const bP = bones[L.U + 2];
    parentM.decompose(vS, qPar, vD);
    // Articulación de arriba en el espacio de la malla
    vJ.copy(bU.position).applyMatrix4(parentM);
    // Último segmento: el vector de reposo inclinado por el cabeceo
    qA.setFromAxisAngle(X_AXIS, pitch);
    vD.copy(L.paw).applyQuaternion(qA);
    vW.copy(toe).sub(vD);
    // Dos segmentos de la articulación de arriba a la del medio
    v1.subVectors(vW, vJ);
    const L1 = L.L1;
    const L2 = L.L2;
    const d = clamp(v1.length(), Math.abs(L1 - L2) + 0.01, (L1 + L2) * 0.999);
    v1.normalize();
    const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    vPole.set(0, 0, L.pole).applyQuaternion(qPar);
    v2.copy(vPole).addScaledVector(v1, -vPole.dot(v1));
    if (v2.lengthSq() < 1e-8) v2.set(0, 0, L.pole);
    v2.normalize();
    vK.copy(vJ).addScaledVector(v1, L1 * cosA).addScaledVector(v2, L1 * sinA);
    vW.copy(vJ).addScaledVector(v1, d);
    // Bisagra común: el eje X del cuerpo
    vH.set(1, 0, 0).applyQuaternion(qPar);
    frameQ(vH, v1.subVectors(vK, vJ), qU).multiply(L.qr[0]);
    frameQ(vH, v1.subVectors(vW, vK), qL).multiply(L.qr[1]);
    frameQ(vH, v1.subVectors(toe, vW), qP).multiply(L.qr[2]);
    // A locales y mezcla con la pose
    qInv.copy(qPar).invert();
    qB.copy(qInv).multiply(qU);
    bU.quaternion.slerp(qB, w);
    qB.copy(qU).invert().multiply(qL);
    bL.quaternion.slerp(qB, w);
    qB.copy(qL).invert().multiply(qP);
    bP.quaternion.slerp(qB, w);
  }
}

// ---------------------------------------------------------------------------
// Bípedos monstruosos (usan el esqueleto humano)
// ---------------------------------------------------------------------------

export function buildBrute(def: CreatureDef): THREE.BufferGeometry {
  return def.id === 'sheptun' ? buildSheptun(def) : buildGlubinnik(def);
}

const B = HB;

/** Columna de anillos horizontales para los bípedos: [y, rx, rz, pesos, color, cx?, cz?]. */
type BSec = [number, number, number, W, RGB, number?, number?];
function bcol(sb: SkinBuilder, secs: BSec[], sides: number, capTop = false, capBottom = false) {
  let prev = -1;
  let last: BSec | null = null;
  for (const s of secs) {
    sb.color(s[4]);
    const r = sb.ring(s[5] ?? 0, s[0], s[6] ?? 0, s[1], s[2], sides, 'y', s[3]);
    if (prev >= 0) sb.bridge(prev, r, sides, s[5] ?? 0, s[0] - 0.03, s[6] ?? 0);
    else if (capBottom) sb.fan(r, sides, s[5] ?? 0, s[0] - 0.03, s[6] ?? 0, s[3], 0, -1, 0);
    prev = r;
    last = s;
  }
  if (capTop && last) sb.fan(prev, sides, last[5] ?? 0, last[0] + 0.03, last[6] ?? 0, last[3], 0, 1, 0);
}

/**
 * Glubinnik: una mole de piel húmeda gris azulada. Torso enorme con jorobas
 * de hueso, cabeza pequeña hundida entre los hombros con una boca ancha
 * llena de dientes, brazos gruesos y larguísimos con tres garras y piernas
 * cortas como columnas.
 */
function buildGlubinnik(def: CreatureDef): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const base = lin(def.color);
  const dark = lin(def.color2);
  const belly = mixc(base, [0.45, 0.5, 0.48], 0.35);
  const mottle = (c: RGB, i: number) => scalec(c, 0.85 + 0.3 * hash2(i, 3, 41));
  bcol(
    sb,
    [
      [0.84, 0.17, 0.15, [[B.hips, 1]], dark],
      [0.94, 0.27, 0.22, [[B.hips, 1]], base],
      [1.06, 0.29, 0.25, [[B.hips, 0.4], [B.spine, 0.6]], belly, 0, 0.02],
      [1.18, 0.31, 0.26, [[B.spine, 1]], belly, 0, 0.03],
      [1.3, 0.36, 0.28, [[B.spine, 0.4], [B.chest, 0.6]], mixc(base, belly, 0.3), 0, 0.02],
      [1.42, 0.4, 0.29, [[B.chest, 1]], base],
      [1.52, 0.34, 0.25, [[B.chest, 1]], base, 0, -0.02],
      [1.6, 0.2, 0.18, [[B.chest, 0.6], [B.neck, 0.4]], dark],
    ],
    14,
    false,
    true,
  );
  // Joroba y placas de hueso en la espalda
  sb.color(scalec(dark, 0.75));
  for (let i = 0; i < 6; i++) {
    const y = 1.1 + i * 0.09;
    const bw: W = [[i < 2 ? B.spine : B.chest, 1]];
    sb.blob(0, y, -0.25 - (i > 1 && i < 5 ? 0.05 : 0), 0.15 - Math.abs(i - 2.5) * 0.02, 0.06, 0.07, 7, 3, bw);
    for (const s of [1, -1]) sb.blob(s * 0.17, y + 0.04, -0.2, 0.05, 0.04, 0.05, 5, 3, bw);
  }
  // Cabeza pequeña, sin cuello, con la boca ancha
  const HWt: W = [[B.head, 1]];
  bcol(
    sb,
    [
      [1.55, 0.13, 0.13, [[B.neck, 0.5], [B.head, 0.5]], dark, 0, 0.1],
      [1.62, 0.15, 0.16, HWt, base, 0, 0.12],
      [1.7, 0.14, 0.15, HWt, base, 0, 0.11],
      [1.77, 0.1, 0.11, HWt, mixc(base, dark, 0.4), 0, 0.09],
    ],
    12,
    true,
  );
  sb.color(scalec(dark, 0.6)).blob(0, 1.6, 0.25, 0.12, 0.035, 0.05, 10, 3, HWt);
  sb.color([0.2, 0.08, 0.08]).box(0, 1.6, 0.27, 0.18, 0.02, 0.02, HWt);
  sb.color([0.82, 0.8, 0.7]);
  for (let i = 0; i < 9; i++) {
    const x = -0.08 + i * 0.02;
    sb.box(x, 1.613, 0.268, 0.008, 0.02, 0.008, HWt);
    sb.box(x + 0.01, 1.588, 0.264, 0.008, 0.018, 0.008, HWt);
  }
  eyes(sb, 0.055, 1.69, 0.245, 0.018, lin(def.eyes), 4, HWt, [0.05, 0.06, 0.07]);
  // Brazos larguísimos y gruesos: las manos le llegan a las rodillas
  for (const s of [1, -1]) {
    const sh = s > 0 ? B.shoulderL : B.shoulderR;
    const ua = s > 0 ? B.upperArmL : B.upperArmR;
    const fa = s > 0 ? B.forearmL : B.forearmR;
    const hd = s > 0 ? B.handL : B.handR;
    const x = s * 0.33;
    const ar = 0.085;
    bcol(
      sb,
      [
        [0.58, ar * 0.7, ar * 1.1, [[hd, 1]], dark, x, 0.02],
        [0.68, ar * 1.15, ar * 1.35, [[hd, 1]], mottle(dark, s), x, 0.02],
        [0.8, ar * 1.0, ar * 1.1, [[hd, 0.6], [fa, 0.4]], dark, x],
        [0.92, ar * 1.35, ar * 1.35, [[fa, 1]], base, x],
        [1.04, ar * 1.4, ar * 1.4, [[fa, 1]], mottle(base, s + 4), x],
        [1.14, ar * 1.15, ar * 1.15, [[fa, 0.5], [ua, 0.5]], mixc(base, dark, 0.3), x, -0.01],
        [1.28, ar * 1.45, ar * 1.45, [[ua, 1]], base, x],
        [1.42, ar * 1.7, ar * 1.6, [[ua, 0.6], [sh, 0.4]], base, x],
        [1.53, ar * 1.25, ar * 1.25, [[sh, 0.7], [ua, 0.3]], dark, x - s * 0.04],
      ],
      9,
      true,
      true,
    );
    // Tres garras gruesas
    sb.color([0.08, 0.07, 0.06]);
    for (const q of [-1, 0, 1]) {
      const v0 = sb.vcount;
      sb.blob(x + q * 0.035, 0.53, 0.06, 0.016, 0.07, 0.018, 5, 3, [[hd, 1]]);
      sb.rotate(v0, sb.vcount, x + q * 0.035, 0.58, 0.04, 0.4, 0);
    }
  }
  // Piernas cortas y anchas como columnas
  for (const s of [1, -1]) {
    const th = s > 0 ? B.thighL : B.thighR;
    const shn = s > 0 ? B.shinL : B.shinR;
    const ft = s > 0 ? B.footL : B.footR;
    const x = s * 0.15;
    const lr = 0.1;
    bcol(
      sb,
      [
        [0.03, lr * 1.35, lr * 1.8, [[ft, 1]], dark, x, 0.05],
        [0.1, lr * 1.0, lr * 1.15, [[ft, 0.5], [shn, 0.5]], dark, x],
        [0.3, lr * 1.15, lr * 1.2, [[shn, 1]], base, x],
        [0.52, lr * 1.05, lr * 1.1, [[shn, 0.5], [th, 0.5]], mixc(base, dark, 0.3), x],
        [0.72, lr * 1.45, lr * 1.5, [[th, 1]], base, x],
        [0.9, lr * 1.4, lr * 1.45, [[th, 0.5], [B.hips, 0.5]], base, x],
      ],
      9,
      false,
      true,
    );
    sb.color([0.08, 0.07, 0.06]);
    for (const q of [-1, 0, 1]) sb.blob(x + q * 0.045, 0.03, 0.2, 0.02, 0.018, 0.04, 5, 3, [[ft, 1]]);
  }
  return sb.finish(0.35);
}

/**
 * Sheptun: alto, negro y consumido. Costillas marcadas, cabeza alargada
 * con una boca que no se cierra, brazos larguísimos con dedos como agujas
 * y jirones de piel colgando.
 */
function buildSheptun(def: CreatureDef): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const base = lin(def.color);
  const dark = lin(def.color2);
  const bone: RGB = [0.13, 0.12, 0.14];
  bcol(
    sb,
    [
      [0.86, 0.08, 0.07, [[B.hips, 1]], dark],
      [0.95, 0.12, 0.09, [[B.hips, 1]], base],
      [1.08, 0.09, 0.07, [[B.spine, 1]], base, 0, 0.01],
      [1.2, 0.12, 0.09, [[B.spine, 0.5], [B.chest, 0.5]], base, 0, 0.02],
      [1.32, 0.15, 0.1, [[B.chest, 1]], base, 0, 0.02],
      [1.44, 0.15, 0.09, [[B.chest, 1]], base],
      [1.52, 0.08, 0.07, [[B.chest, 0.5], [B.neck, 0.5]], dark],
      [1.58, 0.045, 0.05, [[B.neck, 1]], dark, 0, 0.02],
    ],
    12,
    false,
    true,
  );
  // Costillas
  sb.color(bone);
  for (let i = 0; i < 5; i++) {
    const y = 1.2 + i * 0.05;
    for (const s of [1, -1]) {
      const v0 = sb.vcount;
      sb.box(s * 0.08, y, 0.07, 0.1, 0.012, 0.012, [[B.chest, 1]]);
      sb.rotate(v0, sb.vcount, s * 0.08, y, 0.07, 0, -s * 0.5, s * 0.15);
    }
  }
  // Cabeza alargada hacia atrás, boca abierta, ojos blancos
  const HWt: W = [[B.head, 1]];
  bcol(
    sb,
    [
      [1.56, 0.05, 0.06, HWt, dark, 0, 0.05],
      [1.62, 0.07, 0.09, HWt, base, 0, 0.04],
      [1.7, 0.072, 0.11, HWt, base],
      [1.78, 0.06, 0.12, HWt, base, 0, -0.04],
      [1.84, 0.035, 0.08, HWt, dark, 0, -0.08],
    ],
    12,
    true,
  );
  sb.color([0.03, 0.02, 0.03]).blob(0, 1.6, 0.1, 0.04, 0.035, 0.02, 8, 3, HWt);
  sb.color([0.7, 0.68, 0.66]);
  for (let i = 0; i < 6; i++) sb.box(-0.025 + i * 0.01, 1.625, 0.108, 0.004, 0.014, 0.004, HWt);
  eyes(sb, 0.03, 1.71, 0.1, 0.012, lin(def.eyes), 9, HWt);
  // Brazos larguísimos y finos, con dedos como agujas
  for (const s of [1, -1]) {
    const sh = s > 0 ? B.shoulderL : B.shoulderR;
    const ua = s > 0 ? B.upperArmL : B.upperArmR;
    const fa = s > 0 ? B.forearmL : B.forearmR;
    const hd = s > 0 ? B.handL : B.handR;
    const x = s * 0.2;
    const ar = 0.03;
    bcol(
      sb,
      [
        [0.74, ar * 0.8, ar * 1.3, [[hd, 1]], dark, x],
        [0.86, ar * 1.0, ar * 1.2, [[hd, 0.5], [fa, 0.5]], dark, x],
        [1.0, ar * 1.25, ar * 1.25, [[fa, 1]], base, x],
        [1.13, ar * 1.1, ar * 1.1, [[fa, 0.5], [ua, 0.5]], bone, x],
        [1.28, ar * 1.3, ar * 1.3, [[ua, 1]], base, x],
        [1.44, ar * 1.6, ar * 1.6, [[ua, 0.5], [sh, 0.5]], base, x],
        [1.5, ar * 1.2, ar * 1.2, [[sh, 0.7], [ua, 0.3]], dark, x - s * 0.03],
      ],
      7,
      true,
      true,
    );
    sb.color([0.06, 0.05, 0.07]);
    for (const q of [-1.5, -0.5, 0.5, 1.5]) sb.blob(x, 0.6, q * 0.016, 0.006, 0.14, 0.006, 4, 3, [[hd, 1]]);
    // Jirones colgando del brazo
    sb.color(scalec(dark, 0.8));
    for (let i = 0; i < 3; i++) {
      const v0 = sb.vcount;
      sb.box(x + s * 0.03, 1.2 - i * 0.12, -0.02, 0.008, 0.12, 0.05, [[i === 0 ? ua : fa, 1]]);
      sb.rotate(v0, sb.vcount, x + s * 0.03, 1.26 - i * 0.12, -0.02, 0, 0, s * 0.15);
    }
  }
  // Piernas largas y flacas
  for (const s of [1, -1]) {
    const th = s > 0 ? B.thighL : B.thighR;
    const shn = s > 0 ? B.shinL : B.shinR;
    const ft = s > 0 ? B.footL : B.footR;
    const x = s * 0.08;
    const lr = 0.035;
    bcol(
      sb,
      [
        [0.03, lr * 1.2, lr * 2.0, [[ft, 1]], dark, x, 0.06],
        [0.1, lr * 0.9, lr * 1.0, [[ft, 0.5], [shn, 0.5]], dark, x],
        [0.3, lr * 1.05, lr * 1.1, [[shn, 1]], base, x],
        [0.52, lr * 1.0, lr * 1.0, [[shn, 0.5], [th, 0.5]], bone, x],
        [0.72, lr * 1.3, lr * 1.35, [[th, 1]], base, x],
        [0.9, lr * 1.5, lr * 1.5, [[th, 0.5], [B.hips, 0.5]], base, x],
      ],
      7,
      false,
      true,
    );
  }
  // Jirones del cuerpo
  sb.color(scalec(dark, 0.7));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    sb.box(Math.cos(a) * 0.11, 0.82, Math.sin(a) * 0.09, 0.03, 0.16, 0.006, [[B.hips, 1]], -a + PI / 2);
  }
  return sb.finish(0.35);
}

// ---------------------------------------------------------------------------
// Vista de una criatura (la usan el juego y el banco de pruebas)
// ---------------------------------------------------------------------------

const geoCache = new Map<string, THREE.BufferGeometry>();
let baseMat: THREE.MeshStandardMaterial | null = null;

export class CreatureView {
  readonly group = new THREE.Group();
  readonly mesh: THREE.SkinnedMesh;
  readonly mat: THREE.MeshStandardMaterial;
  readonly bones: THREE.Bone[];
  readonly quad: QuadAnimator | null = null;
  readonly brute: HumanAnimator | null = null;
  /** Entrada del animador de cuadrúpedos y del de bípedos (solo se usa la que toca). */
  readonly qin: QuadInput;
  readonly bin: AnimInput;

  constructor(
    readonly def: CreatureDef,
    seed: number,
  ) {
    if (!baseMat) baseMat = probeMaterial({ roughness: 0.72 });
    this.mat = cloneProbeMaterial(baseMat);
    const quad = def.shape === 'cuadrupedo';
    let geo = geoCache.get(def.id);
    if (!geo) {
      geo = quad ? buildQuadruped(def) : buildBrute(def);
      geoCache.set(def.id, geo);
    }
    const { bones, skeleton, root } = makeSkeleton(quad ? quadBones(def) : HUMAN_BONES);
    this.bones = bones;
    const mesh = new THREE.SkinnedMesh(geo, this.mat);
    mesh.add(root);
    mesh.bind(skeleton);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    this.mesh = mesh;
    this.group.add(mesh);
    this.group.scale.setScalar(def.scale);
    this.qin = { speed: 0, dist: -1, turn: 0, attackT: 0, attacking: false, sinceHit: 9, hitSide: 0, dead: false, alert: 0, seed, look: null };
    this.bin = { ...defaultAnimInput(seed), style: def.id === 'glubinnik' ? 'bruto' : 'acechador' };
    if (quad) this.quad = new QuadAnimator(bones, seed, def);
    else this.brute = new HumanAnimator(bones, seed);
  }

  place(x: number, y: number, z: number, facing: number) {
    this.group.position.set(x, y, z);
    this.group.rotation.y = Math.PI / 2 - facing;
  }

  setProbe(r: number, g: number, b: number, dx: number, dy: number, dz: number) {
    setProbe(this.mat, r, g, b, dx, dy, dz);
  }

  update(dt: number) {
    if (this.quad) this.quad.update(dt, this.qin);
    else this.brute!.update(dt, this.bin);
  }

  dispose() {
    this.group.removeFromParent();
    this.mat.dispose();
  }
}
