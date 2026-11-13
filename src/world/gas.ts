// Geometría de las bolsas de gas: una rejilla de densidad por bolsa, ceñida
// al túnel o a la sala que ocupa. Es estática, determinista y no depende del
// render; la simulación la consulta y el render la pinta.

import { GASES, type GasDef } from '../data/gases';
import { distToSegment, smoothstep } from '../core/math';
import { linkPointAt, regionAt, type Layout, type LinkGeom } from './layout';

/** Lado de la celda de densidad (m). */
const CELL = 1;
/** Tramo en el que el gas se desvanece por los extremos (m). */
const RAMP = 10;

export interface GasPocket {
  def: GasDef;
  /** Lugar que ocupa, como `placeId`: 'L<n>' para un túnel o el id del cruce. */
  place: string;
  /** Centro aproximado y radio que lo abarca (para el mapa y el sonido). */
  x: number;
  z: number;
  r: number;
  x0: number;
  z0: number;
  cols: number;
  rows: number;
  /** Densidad por celda (0..1). */
  dens: Float32Array;
  /** Puntos de aire limpio justo fuera de la bolsa, siguiendo el túnel: por ahí se sale. */
  exits: { x: number; z: number }[];
}

export class GasField {
  constructor(readonly pockets: GasPocket[]) {}

  /** Densidad del gas en un punto (0 = aire limpio, 1 = gas denso). */
  at(x: number, z: number): number {
    let best = 0;
    for (const p of this.pockets) {
      const d = sample(p, x, z);
      if (d > best) best = d;
    }
    return best;
  }

  /** Bolsa en la que está un punto, o null si el aire está limpio. */
  pocketAt(x: number, z: number, min = 0.04): GasPocket | null {
    let best: GasPocket | null = null;
    let bd = min;
    for (const p of this.pockets) {
      const d = sample(p, x, z);
      if (d > bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }
}

/** Densidad interpolada dentro de una bolsa (0 fuera de su rectángulo). */
function sample(p: GasPocket, x: number, z: number): number {
  const fx = (x - p.x0) / CELL - 0.5;
  const fz = (z - p.z0) / CELL - 0.5;
  if (fx < -1 || fz < -1 || fx > p.cols || fz > p.rows) return 0;
  const i = Math.floor(fx);
  const j = Math.floor(fz);
  const tx = fx - i;
  const tz = fz - j;
  const at = (a: number, b: number) => (a < 0 || b < 0 || a >= p.cols || b >= p.rows ? 0 : p.dens[b * p.cols + a]);
  const top = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
  const bot = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
  return top * (1 - tz) + bot * tz;
}

function findLink(layout: Layout, a: string, b: string): { l: LinkGeom; flip: boolean } | null {
  for (const l of layout.links) {
    if (l.a === a && l.b === b) return { l, flip: false };
    if (l.a === b && l.b === a) return { l, flip: true };
  }
  return null;
}

function grid(x0: number, z0: number, x1: number, z1: number) {
  const cols = Math.max(1, Math.ceil((x1 - x0) / CELL));
  const rows = Math.max(1, Math.ceil((z1 - z0) / CELL));
  return { x0, z0, cols, rows, dens: new Float32Array(cols * rows) };
}

function linkPocket(layout: Layout, def: GasDef): GasPocket | null {
  const spec = def.link!;
  const found = findLink(layout, spec.a, spec.b);
  if (!found) return null;
  const { l, flip } = found;
  const sc = (flip ? 1 - spec.at : spec.at) * l.length;
  const s0 = sc - spec.half;
  const s1 = sc + spec.half;
  // Tramo del eje que abarca la bolsa
  const idx: number[] = [];
  for (let i = 0; i < l.pts.length; i++) if (l.cum[i] >= s0 - RAMP - 4 && l.cum[i] <= s1 + RAMP + 4) idx.push(i);
  if (idx.length < 2) return null;
  const i0 = Math.max(0, idx[0] - 1);
  const i1 = Math.min(l.pts.length - 1, idx[idx.length - 1] + 1);
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  let hw = 0;
  for (let i = i0; i <= i1; i++) {
    minX = Math.min(minX, l.pts[i].x);
    maxX = Math.max(maxX, l.pts[i].x);
    minZ = Math.min(minZ, l.pts[i].z);
    maxZ = Math.max(maxZ, l.pts[i].z);
    hw = Math.max(hw, l.hw[i]);
  }
  // Margen para los nichos laterales del túnel
  const m = hw + 8;
  const g = grid(minX - m, minZ - m, maxX + m, maxZ + m);
  let cx = 0;
  let cz = 0;
  let n = 0;
  for (let j = 0; j < g.rows; j++) {
    for (let i = 0; i < g.cols; i++) {
      const x = g.x0 + (i + 0.5) * CELL;
      const z = g.z0 + (j + 0.5) * CELL;
      if (regionAt(layout, x, z) !== l.region) continue;
      // Distancia a lo largo del túnel del punto más cercano del eje
      let bestD = Infinity;
      let s = 0;
      for (let k = i0; k < i1; k++) {
        const a = l.pts[k];
        const b = l.pts[k + 1];
        const [d, t] = distToSegment(x, z, a.x, a.z, b.x, b.z);
        if (d < bestD) {
          bestD = d;
          s = l.cum[k] + (l.cum[k + 1] - l.cum[k]) * t;
        }
      }
      const v = def.peak * smoothstep(s0 - RAMP, s0, s) * (1 - smoothstep(s1, s1 + RAMP, s));
      if (v <= 0.005) continue;
      g.dens[j * g.cols + i] = v;
      cx += x * v;
      cz += z * v;
      n += v;
    }
  }
  if (n <= 0) return null;
  const exits = [s0 - RAMP - 4, s1 + RAMP + 4].filter((s) => s > 0 && s < l.length).map((s) => {
    const p = linkPointAt(l, s);
    return { x: p.x, z: p.z };
  });
  return { def, place: 'L' + l.index, x: cx / n, z: cz / n, r: spec.half + RAMP, ...g, exits };
}

function nodePocket(layout: Layout, def: GasDef): GasPocket | null {
  const node = layout.nodeById[def.node!];
  if (!node) return null;
  const R = node.room.r + 4;
  // Llena la sala y rebosa un poco por las bocas de sus túneles (nunca a través de la roca)
  const regions = new Set([node.region, ...node.links.map((i) => layout.links[i].region)]);
  const g = grid(node.x - R, node.z - R, node.x + R, node.z + R);
  for (let j = 0; j < g.rows; j++) {
    for (let i = 0; i < g.cols; i++) {
      const x = g.x0 + (i + 0.5) * CELL;
      const z = g.z0 + (j + 0.5) * CELL;
      if (!regions.has(regionAt(layout, x, z))) continue;
      const d = Math.hypot(x - node.x, z - node.z);
      const v = def.peak * (1 - smoothstep(R * 0.55, R, d));
      if (v > 0.005) g.dens[j * g.cols + i] = v;
    }
  }
  // Salidas: cada túnel de la sala, pasado el borde de la bolsa
  const exits = node.links.map((i) => {
    const l = layout.links[i];
    const fromA = l.a === node.id;
    const p = linkPointAt(l, fromA ? Math.min(l.length, R + 4) : Math.max(0, l.length - R - 4));
    return { x: p.x, z: p.z };
  });
  return { def, place: node.id, x: node.x, z: node.z, r: R, ...g, exits };
}

export function buildGas(layout: Layout, defs: GasDef[] = GASES): GasField {
  const pockets: GasPocket[] = [];
  for (const def of defs) {
    const p = def.node ? nodePocket(layout, def) : linkPocket(layout, def);
    if (p) pockets.push(p);
  }
  return new GasField(pockets);
}
