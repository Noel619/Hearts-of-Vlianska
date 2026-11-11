// Núcleo del kit de atrezo: registro de piezas, paleta y utilidades de modelado.

import type * as THREE from 'three';
import { Rng } from '../../core/rng';
import { MeshBuilder, lin, type RGB } from '../geo';

export type PropFn = (b: MeshBuilder, variant: number, rng: Rng) => void;

const REG = new Map<string, PropFn>();
const CACHE = new Map<string, THREE.BufferGeometry>();

export function defProp(type: string, fn: PropFn) {
  REG.set(type, fn);
}

export function hasProp(type: string) {
  return REG.has(type);
}

/** Dibuja una pieza dentro de un constructor existente (para piezas únicas). */
export function drawProp(b: MeshBuilder, type: string, variant: number, seed = 1) {
  const fn = REG.get(type);
  if (fn) fn(b, variant, new Rng(seed * 7919 + variant * 31 + 5));
  else placeholder(b);
}

export function propGeometry(type: string, variant = 0): THREE.BufferGeometry {
  const key = `${type}#${variant}`;
  let g = CACHE.get(key);
  if (g) return g;
  const b = new MeshBuilder({ fx: true });
  drawProp(b, type, variant, hashType(type));
  g = b.toGeometry();
  CACHE.set(key, g);
  return g;
}

function hashType(t: string) {
  let h = 7;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) & 0xffff;
  return h;
}

function placeholder(b: MeshBuilder) {
  b.color(0xff00ff).box(0, 0, 0, 0.6, 0.6, 0.6);
}

// --- Paleta (sRGB) -----------------------------------------------------------

export const C = {
  concrete: lin(0x8c8a84),
  concreteDark: lin(0x5c5b57),
  concreteLight: lin(0xb4b1a8),
  steel: lin(0x5b6066),
  steelDark: lin(0x2f3236),
  steelLight: lin(0x8d949b),
  iron: lin(0x3a3632),
  rust: lin(0x7a4526),
  rustDark: lin(0x4a2a1a),
  rustLight: lin(0xa3602f),
  wood: lin(0x8a6a44),
  woodDark: lin(0x5a4129),
  woodLight: lin(0xb08a5a),
  woodGrey: lin(0x7a7266),
  canvas: lin(0x9a8c6a),
  canvasDark: lin(0x6e6248),
  canvasGreen: lin(0x5c6646),
  canvasGrey: lin(0x7c7b76),
  tarp: lin(0x3f5a6a),
  burlap: lin(0x9c8660),
  olive: lin(0x4f5638),
  oliveDark: lin(0x343a26),
  navy: lin(0x2a3a52),
  red: lin(0x9a2a22),
  redDark: lin(0x5e1a16),
  yellow: lin(0xd6a520),
  white: lin(0xdedad0),
  black: lin(0x141414),
  soot: lin(0x1c1a18),
  rubber: lin(0x1e1e20),
  brass: lin(0xa98a3c),
  copper: lin(0x9a5a34),
  glass: lin(0x9fb8c0),
  bone: lin(0xcfc6ae),
  cloth: lin(0x6c5f58),
  clothBlue: lin(0x3d5674),
  clothRed: lin(0x8a3530),
  clothGreen: lin(0x4a6a48),
  paper: lin(0xd8cfb4),
  leather: lin(0x5a3d28),
  mushroom: lin(0xc9b9a0),
  mushroomCap: lin(0xa8825e),
  dirt: lin(0x4a4034),
  stone: lin(0x6e6a64),
  ember: lin(0xff7a2a),
  bulb: lin(0xffd9a0),
  bulbCold: lin(0xcfe4ff),
  enamelGreen: lin(0x2f5a44),
  enamelBlue: lin(0x2b4a78),
  pink: lin(0xd89a9a),
  /** Blanco puro: lo que se pinta con él toma el color de facción. */
  tint: [1, 1, 1] as RGB,
};

/** Variación de un color. */
export function vary(c: RGB, rng: Rng, amount = 0.12): [number, number, number] {
  const k = 1 + (rng.next() * 2 - 1) * amount;
  const w = (rng.next() * 2 - 1) * amount * 0.4;
  return [c[0] * k * (1 + w), c[1] * k, c[2] * k * (1 - w)];
}

// --- Piezas reutilizables ------------------------------------------------------

/** Tablón de madera con ligera irregularidad. */
export function plank(b: MeshBuilder, x: number, y: number, z: number, sx: number, sy: number, sz: number, rng: Rng, base: RGB = C.wood) {
  b.color(vary(base, rng, 0.16));
  b.cube(x, y, z, sx, sy, sz);
}

/** Bombilla emisiva. */
export function bulb(b: MeshBuilder, x: number, y: number, z: number, r = 0.07, color: RGB = C.bulb, power = 7) {
  b.color(color).glow(power);
  b.sphere(x, y, z, r, r * 1.2, r, 7, 5);
  b.glow(0);
}

/** Bidón metálico. */
export function drum(b: MeshBuilder, x: number, y: number, z: number, color: RGB, rng: Rng, open = false) {
  const r = 0.29;
  const h = 0.88;
  b.color(vary(color, rng, 0.1));
  b.lathe(x, y, z, [r, 0, r + 0.012, 0.02, r, 0.04, r, h * 0.31, r + 0.014, h * 0.33, r, h * 0.35, r, h * 0.64, r + 0.014, h * 0.66, r, h * 0.68, r, h - 0.04, r + 0.012, h - 0.02, r, h], 12);
  if (open) {
    b.color(C.soot);
    b.disc(x, y + h - 0.12, z, r - 0.01, 12, 1);
  } else {
    b.color(vary(color, rng, 0.1), 0.85);
    b.disc(x, y + h - 0.015, z, r - 0.01, 12, 1);
    b.color(C.steelDark);
    b.cyl(x + r * 0.55, y + h - 0.015, z, 0.035, 0.035, 0.03, 6);
  }
}

/** Saco terrero. */
export function sandbag(b: MeshBuilder, x: number, y: number, z: number, rot: number, rng: Rng, len = 0.62, col: RGB = C.burlap) {
  b.push();
  b.translate(x, y, z);
  b.rotateY(rot + rng.range(-0.08, 0.08));
  b.color(vary(col, rng, 0.14));
  const keep = b.ao;
  b.ao = 0.3;
  b.sphere(0, 0.1, 0, len / 2, 0.115, 0.19, 7, 4);
  b.ao = keep;
  b.pop();
}

/** Caja de madera con listones. */
export function crate(b: MeshBuilder, x: number, y: number, z: number, s: number, h: number, rng: Rng, base: RGB = C.wood, rot = 0) {
  b.push();
  b.translate(x, y, z);
  b.rotateY(rot);
  const c = vary(base, rng, 0.14);
  b.color(c);
  b.box(0, 0, 0, s, h, s);
  // Listones de refuerzo
  b.color(c, 0.72);
  const t = 0.035;
  const w = 0.07;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.box((sx * (s - w)) / 2, 0, (sz * (s + t)) / 2, w, h, t, 0b110111);
    for (const sz of [-1, 1]) b.box((sx * (s + t)) / 2, 0, (sz * (s - w)) / 2, t, h, w, 0b110111);
  }
  for (const sz of [-1, 1]) {
    b.box(0, 0, (sz * (s + t)) / 2, s, w, t);
    b.box(0, h - w, (sz * (s + t)) / 2, s, w, t);
  }
  for (const sx of [-1, 1]) {
    b.box((sx * (s + t)) / 2, 0, 0, t, w, s);
    b.box((sx * (s + t)) / 2, h - w, 0, t, w, s);
  }
  b.pop();
}

/** Tela colgante con pliegues (plano subdividido con ondulación). */
export function cloth(b: MeshBuilder, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, drop: number, segs: number, wave: number, rng: Rng, double = true) {
  // De (x0,y0,z0) a (x1,y1,z1) en horizontal; cuelga `drop` hacia abajo
  const cols = segs;
  const rows = 4;
  const ph = rng.range(0, 6);
  const ids: number[][] = [];
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  for (let j = 0; j <= rows; j++) {
    const row: number[] = [];
    const tj = j / rows;
    for (let i = 0; i <= cols; i++) {
      const ti = i / cols;
      const off = Math.sin(ti * Math.PI * 3 + ph) * wave * tj;
      const shade = 0.82 + 0.18 * Math.cos(ti * Math.PI * 3 + ph) * tj + 0.1 * (1 - tj);
      row.push(b.v(x0 + dx * ti + nx * off, y0 + (y1 - y0) * ti - drop * tj, z0 + dz * ti + nz * off, nx, 0.15, nz, ti, tj, shade));
    }
    ids.push(row);
  }
  const i0 = b.icount;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      b.quadIdx(ids[j][i], ids[j + 1][i], ids[j + 1][i + 1], ids[j][i + 1]);
      if (double) b.quadIdx(ids[j][i], ids[j][i + 1], ids[j + 1][i + 1], ids[j + 1][i]);
    }
  }
  void i0;
}

export { MeshBuilder, lin, Rng };
export type { RGB };
