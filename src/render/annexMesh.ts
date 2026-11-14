// Revestimiento de las salas anejas: qué suelo y qué muro lleva cada uso, y
// los peldaños de las escaleras mecánicas y de servicio.

import { clamp, lerp, type V2 } from '../core/math';
import { annexFloorAt, annexPoint, escalatorPlan, insideAnnex, type Annex, type AnnexUse } from '../world/arch';
import type { Layout, StationFrame } from '../world/layout';
import { stationToLocal, stationToWorld } from '../world/layout';
import { PLATFORM_H } from '../world/plans';
import { MeshBuilder, lin, scalec, type RGB } from './geo';

// ---------------------------------------------------------------------------
// Suelos
// ---------------------------------------------------------------------------

/** Suelo de una sala: 0 baldosa, 1 hormigón, 2 tablones, -1 el suelo sucio de los túneles (cuevas). */
export function annexFloorKind(use: AnnexUse): number {
  switch (use) {
    case 'hospital':
    case 'quirofano':
    case 'descontaminacion':
    case 'banos':
    case 'despacho':
    case 'consejo':
    case 'conferencia':
    case 'archivo':
    case 'biblioteca':
    case 'escuela':
    case 'comisaria':
    case 'correos':
    case 'cambio':
    case 'aduana':
    case 'vestibulo':
    case 'santuario':
    case 'mezquita':
      return 0;
    case 'caravasar':
    case 'comedor':
    case 'cuartel':
    case 'stalkers':
      return 2;
    case 'guarida':
    case 'jaulas':
    case 'botin':
    case 'derrumbe':
    case 'granja':
    case 'porqueriza':
      return -1;
    default:
      return 1;
  }
}

export interface AnnexCells {
  /** Índice de sala por celda del campo de distancias (−1: ninguna). */
  cell: Int32Array;
  list: { f: StationFrame; a: Annex }[];
}

/** Rasteriza las salas sobre las celdas del campo de distancias (centro de celda). */
export function annexCells(layout: Layout): AnnexCells {
  const { sdf } = layout;
  const cell = new Int32Array(sdf.w * sdf.h).fill(-1);
  const list: AnnexCells['list'] = [];
  for (const f of layout.stations) {
    for (const a of f.annexes) {
      const idx = list.length;
      list.push({ f, a });
      const rects = [a, ...a.doors];
      for (const r of rects) {
        const pts = [stationToWorld(f, r.u0, r.v0), stationToWorld(f, r.u1, r.v0), stationToWorld(f, r.u0, r.v1), stationToWorld(f, r.u1, r.v1)];
        const x0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.x)) - sdf.ox) - 1);
        const x1 = Math.min(sdf.w - 2, Math.ceil(Math.max(...pts.map((p) => p.x)) - sdf.ox) + 1);
        const z0 = Math.max(0, Math.floor(Math.min(...pts.map((p) => p.z)) - sdf.oz) - 1);
        const z1 = Math.min(sdf.h - 2, Math.ceil(Math.max(...pts.map((p) => p.z)) - sdf.oz) + 1);
        for (let j = z0; j <= z1; j++) {
          for (let i = x0; i <= x1; i++) {
            const cx = sdf.ox + i + 0.5;
            const cz = sdf.oz + j + 0.5;
            const [u, v] = stationToLocal(f, cx, cz);
            if (u < r.u0 - 0.5 || u > r.u1 + 0.5 || v < r.v0 - 0.5 || v > r.v1 + 0.5) continue;
            // Lo que cae dentro de la nave lo cubren sus andenes y pasarelas
            if (Math.abs(u) < f.hl && Math.abs(v) < f.hw) continue;
            const k = j * sdf.w + i;
            if (cell[k] < 0 || r === a) cell[k] = idx;
          }
        }
      }
    }
  }
  return { cell, list };
}

/** Altura del suelo de una sala en un punto del mundo. */
export function annexYAt(f: StationFrame, a: Annex, x: number, z: number): number {
  const [u, v] = stationToLocal(f, x, z);
  if (!insideAnnex(a, u, v)) return a.y0;
  return annexFloorAt(a, u, v);
}

// ---------------------------------------------------------------------------
// Muros
// ---------------------------------------------------------------------------

export type AnnexWallKind = 'station' | 'tiles' | 'concrete' | 'brick' | 'rock' | 'tubbing' | 'green';

export function annexWallKind(f: StationFrame, use: AnnexUse): AnnexWallKind {
  switch (use) {
    case 'hospital':
    case 'quirofano':
    case 'descontaminacion':
    case 'banos':
    case 'escuela':
      return f.id === 'MER' ? 'green' : 'tiles';
    case 'mezquita':
      return 'green';
    case 'escaleras':
      return 'tubbing';
    case 'guarida':
    case 'jaulas':
    case 'botin':
    case 'derrumbe':
      return 'rock';
    case 'hornos':
    case 'talleres':
    case 'fundicion':
    case 'caravasar':
    case 'granja':
    case 'porqueriza':
    case 'santuario':
    case 'comedor':
      return 'brick';
    case 'rampa':
    case 'pozo':
    case 'municion':
    case 'casamata':
    case 'calabozo':
    case 'armeria':
    case 'bunker':
    case 'cuartel':
    case 'arsenal':
    case 'defensa':
    case 'almacen':
    case 'bombas':
    case 'generador':
    case 'stalkers':
      return 'concrete';
    default:
      return 'station';
  }
}

/** Busca el inicio de la roca maciza: hasta dónde puede llegar la tapa de un muro sin pisar la del otro lado. */
export function ridgeDepth(layout: Layout, x: number, z: number, nx: number, nz: number, maxD: number): number {
  let prev = layout.sdf.sample(x, z);
  for (let t = 0.25; t <= maxD; t += 0.25) {
    const d = layout.sdf.sample(x + nx * t, z + nz * t);
    if (d < prev - 0.015) return Math.max(0.2, t - 0.2);
    prev = d;
  }
  return maxD;
}

// ---------------------------------------------------------------------------
// Escaleras
// ---------------------------------------------------------------------------

const STEEL: RGB = [0.16, 0.16, 0.17];
const STEP: RGB = [0.34, 0.33, 0.31];
const RUBBER: RGB = [0.02, 0.02, 0.022];
const WOOD: RGB = lin(0x7a5434);
const BRASS: RGB = lin(0xa98a3c);
const CONCRETE: RGB = [0.52, 0.51, 0.48];

type BFn = (x: number, z: number, mat: string) => MeshBuilder;

/** Peldaños, zócalos, balaustradas y farolas de los túneles de escaleras. */
export function buildAnnexStairs(layout: Layout, B: BFn) {
  for (const f of layout.stations) {
    for (const a of f.annexes) {
      if (a.use !== 'escaleras' || !a.rise) continue;
      buildStairs(f, a, B);
    }
  }
}

function buildStairs(f: StationFrame, a: Annex, B: BFn) {
  const plan = escalatorPlan(a);
  const W = (t: number, s: number): V2 => {
    const [u, v] = annexPoint(a, t, s);
    return stationToWorld(f, u, v);
  };
  const Y = (t: number) => {
    const [u, v] = annexPoint(a, t, 0);
    return annexFloorAt(a, u, v);
  };
  // Ejes en el mundo: a lo largo (t) y lateral (s)
  const p0 = W(0, 0);
  const p1 = W(1, 0);
  const tx = p1.x - p0.x;
  const tz = p1.z - p0.z;
  const q1 = W(0, 1);
  const sx = q1.x - p0.x;
  const sz = q1.z - p0.z;
  const mid = W(a.depth / 2, 0);
  const b = B(mid.x, mid.z, 'steel');
  const quad = (pa: V2, ya: number, pb: V2, yb: number, pc: V2, yc: number, pd: V2, yd: number, nx: number, ny: number, nz: number) => {
    const i0 = b.v(pa.x, ya, pa.z, nx, ny, nz);
    const i1 = b.v(pb.x, yb, pb.z, nx, ny, nz);
    const i2 = b.v(pc.x, yc, pc.z, nx, ny, nz);
    const i3 = b.v(pd.x, yd, pd.z, nx, ny, nz);
    const ux = pb.x - pa.x;
    const uy = yb - ya;
    const uz = pb.z - pa.z;
    const vx = pd.x - pa.x;
    const vy = yd - ya;
    const vz = pd.z - pa.z;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx * nx + cy * ny + cz * nz >= 0) b.quadIdx(i0, i1, i2, i3);
    else b.quadIdx(i3, i2, i1, i0);
  };
  /** Caja inclinada que sigue la pendiente entre t0 y t1, de s0 a s1, desde la altura del suelo + y0 hasta + y1. */
  const slabAlong = (t0: number, t1: number, s0: number, s1: number, y0: number, y1: number, col: RGB, sides = true) => {
    const n = Math.max(1, Math.ceil((t1 - t0) / 3));
    for (let k = 0; k < n; k++) {
      const ta = lerp(t0, t1, k / n);
      const tb = lerp(t0, t1, (k + 1) / n);
      const ya = Y(ta);
      const yb = Y(tb);
      b.color(col);
      quad(W(ta, s0), ya + y1, W(ta, s1), ya + y1, W(tb, s1), yb + y1, W(tb, s0), yb + y1, 0, 1, 0);
      if (sides) {
        b.color(col, 0.7);
        quad(W(ta, s0), ya + y0, W(tb, s0), yb + y0, W(tb, s0), yb + y1, W(ta, s0), ya + y1, -sx, 0, -sz);
        quad(W(ta, s1), ya + y0, W(ta, s1), ya + y1, W(tb, s1), yb + y1, W(tb, s1), yb + y0, sx, 0, sz);
      }
    }
  };
  const tread = plan.kind === 'mecanica' ? 0.42 : 0.34;
  const steps = (s0: number, s1: number, col: RGB) => {
    const n = Math.max(1, Math.round((plan.t1 - plan.t0) / tread));
    const dt = (plan.t1 - plan.t0) / n;
    for (let k = 0; k < n; k++) {
      const ta = plan.t0 + k * dt;
      const tb = ta + dt;
      const ya = Y(ta);
      const yb = Y(tb);
      // Huella a la altura del final del peldaño y contrahuella al inicio
      b.color(col, 0.92 + (k % 2) * 0.08);
      quad(W(ta, s0), yb + 0.02, W(ta, s1), yb + 0.02, W(tb, s1), yb + 0.02, W(tb, s0), yb + 0.02, 0, 1, 0);
      b.color(col, 0.55);
      quad(W(ta, s0), ya - 0.05, W(ta, s1), ya - 0.05, W(ta, s1), yb + 0.02, W(ta, s0), yb + 0.02, -tx, 0, -tz);
    }
  };
  if (plan.kind === 'servicio') {
    const half = plan.laneW / 2;
    steps(-half, half, CONCRETE);
    // Pasamanos de tubo a ambos lados
    for (const s of [-half + 0.08, half - 0.08]) slabAlong(plan.t0 - 0.4, plan.t1 + 0.4, s - 0.04, s + 0.04, 0.95, 1.0, STEEL, false);
    return;
  }
  for (const s of plan.lanes) {
    const h = plan.laneW / 2;
    steps(s - h + 0.06, s + h - 0.06, STEP);
    // Zócalos de chapa a los lados del carril
    for (const e of [s - h, s + h - 0.06]) slabAlong(plan.t0 - 0.6, plan.t1 + 0.6, e, e + 0.06, -0.1, 0.92, STEEL);
    // Pasamanos de goma
    for (const e of [s - h - 0.02, s + h - 0.04]) slabAlong(plan.t0 - 0.9, plan.t1 + 0.9, e, e + 0.06, 0.92, 1.0, RUBBER, false);
    // Peines metálicos al pie y en lo alto
    for (const t of [plan.t0 - 0.5, plan.t1]) {
      const y = Y(t) + 0.025;
      b.color(scalec(STEEL, 1.6));
      quad(W(t, s - h), y, W(t, s + h), y, W(t + 0.5, s + h), y, W(t + 0.5, s - h), y, 0, 1, 0);
    }
  }
  // Balaustradas de madera con farolas de bronce
  for (const s of plan.rails) {
    const h = plan.railW / 2;
    slabAlong(plan.t0 - 0.6, plan.t1 + 0.6, s - h, s + h, -0.1, 0.78, WOOD);
    for (const t of plan.lamps) {
      const p = W(t, s);
      const y = Y(t) + 0.78;
      b.color(BRASS);
      b.cyl(p.x, y, p.z, 0.05, 0.035, 1.5, 6, 0);
      b.color([1, 0.86, 0.6]).glow(5);
      b.sphere(p.x, y + 1.62, p.z, 0.16, 0.2, 0.16, 8, 5);
      b.glow(0);
    }
  }
  void clamp;
  void PLATFORM_H;
}
