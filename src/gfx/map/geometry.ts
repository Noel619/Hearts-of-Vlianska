// Geometría precalculada del mapa: túneles como polilíneas con normales,
// orientación y tamaño de los andenes, y utilidades de consulta.
import { MAP, STATION_SEEDS } from '../../data';
import type { EdgeDef, Terrain } from '../../game/types';
import { range, rng } from '../rng';

export type Pt = [number, number];

export const TUNNEL_WIDTH: Record<Terrain, number> = {
  estacion: 16,
  linea: 17,
  tunel: 13,
  peligroso: 13,
  auxiliar: 8.5,
  auxiliarPeligroso: 8.5,
  estrecho: 5.5,
  derrumbe: 13,
};

export const RAIL_TERRAIN = new Set<Terrain>(['linea', 'tunel', 'peligroso']);
export const AUX_TERRAIN = new Set<Terrain>(['auxiliar', 'auxiliarPeligroso']);
export const DANGER_TERRAIN = new Set<Terrain>(['peligroso', 'auxiliarPeligroso']);

export interface Decal {
  t: number; // distancia a lo largo del túnel
  side: number; // desplazamiento lateral (-1..1 del semiancho)
  size: number;
  kind: number;
  rot: number;
}

export interface EdgeGeo {
  edge: EdgeDef;
  id: string;
  pts: Pt[];
  cum: number[];
  len: number;
  width: number;
  left: Pt[];
  right: Pt[];
  bbox: [number, number, number, number];
  decals: Decal[];
  seed: number;
}

export interface StationGeo {
  id: string;
  x: number;
  y: number;
  angle: number;
  cos: number;
  sin: number;
  len: number;
  wid: number;
}

function dist(a: Pt, b: Pt) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Redondea las esquinas interiores de una polilínea con curvas cuadráticas muestreadas. */
function roundCorners(pts: Pt[], radius: number): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const d0 = dist(p0, p1);
    const d1 = dist(p1, p2);
    const r = Math.min(radius, d0 * 0.45, d1 * 0.45);
    const a: Pt = [p1[0] + ((p0[0] - p1[0]) / d0) * r, p1[1] + ((p0[1] - p1[1]) / d0) * r];
    const b: Pt = [p1[0] + ((p2[0] - p1[0]) / d1) * r, p1[1] + ((p2[1] - p1[1]) / d1) * r];
    const steps = 6;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * p1[0] + t * t * b[0];
      const y = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * p1[1] + t * t * b[1];
      out.push([x, y]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Polilínea desplazada lateralmente (normal a la izquierda del avance). */
export function offsetLine(pts: Pt[], d: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    let dx = next[0] - prev[0];
    let dy = next[1] - prev[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    out.push([pts[i][0] - dy * d, pts[i][1] + dx * d]);
  }
  return out;
}

function cumulative(pts: Pt[]): number[] {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + dist(pts[i - 1], pts[i]));
  return c;
}

/** Punto, ángulo y normal a una distancia `s` a lo largo de la polilínea. */
export function sampleAt(geo: { pts: Pt[]; cum: number[]; len: number }, s: number): { x: number; y: number; angle: number; nx: number; ny: number } {
  const { pts, cum } = geo;
  const t = Math.max(0, Math.min(geo.len, s));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < t) i++;
  const seg = cum[i] - cum[i - 1] || 1;
  const k = (t - cum[i - 1]) / seg;
  const a = pts[i - 1];
  const b = pts[i];
  const dx = (b[0] - a[0]) / seg;
  const dy = (b[1] - a[1]) / seg;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, angle: Math.atan2(dy, dx), nx: -dy, ny: dx };
}

/** Subpolilínea entre las distancias s0 y s1. */
export function slice(geo: { pts: Pt[]; cum: number[]; len: number }, s0: number, s1: number): Pt[] {
  const a = sampleAt(geo, s0);
  const out: Pt[] = [[a.x, a.y]];
  for (let i = 1; i < geo.pts.length - 1; i++) {
    if (geo.cum[i] > s0 && geo.cum[i] < s1) out.push(geo.pts[i]);
  }
  const b = sampleAt(geo, s1);
  out.push([b.x, b.y]);
  return out;
}

export function distToPolyline(p: Pt, pts: Pt[]): { d: number; s: number } {
  let best = Infinity;
  let bestS = 0;
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
    const segLen = Math.sqrt(l2);
    if (d < best) {
      best = d;
      bestS = acc + t * segLen;
    }
    acc += segLen;
  }
  return { d: best, s: bestS };
}

function buildEdges(): EdgeGeo[] {
  return MAP.edges.map((e, idx) => {
    const width = TUNNEL_WIDTH[e.terrain];
    const pts = roundCorners(e.points as Pt[], 28);
    const cum = cumulative(pts);
    const len = cum[cum.length - 1];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const pad = width + 30;
    const r = rng(`edge-${e.id}`);
    const decals: Decal[] = [];
    const nDecals = Math.round(len / (DANGER_TERRAIN.has(e.terrain) ? 7 : e.terrain === 'derrumbe' ? 4 : 26));
    for (let i = 0; i < nDecals; i++) {
      decals.push({ t: range(r, 0, len), side: range(r, -1, 1), size: range(r, 0.5, 1.4), kind: Math.floor(r() * 8), rot: range(r, 0, Math.PI * 2) });
    }
    return {
      edge: e,
      id: e.id,
      pts,
      cum,
      len,
      width,
      left: offsetLine(pts, width / 2),
      right: offsetLine(pts, -width / 2),
      bbox: [x0 - pad, y0 - pad, x1 + pad, y1 + pad],
      decals,
      seed: idx * 7919 + 13,
    };
  });
}

const LINE_WEIGHT: Partial<Record<Terrain, number>> = { linea: 4, tunel: 2.5, peligroso: 2, auxiliar: 0.6, auxiliarPeligroso: 0.6, estrecho: 0.3, derrumbe: 2 };

function buildStations(): StationGeo[] {
  return STATION_SEEDS.map((s) => {
    // Media axial de las direcciones de los túneles que salen de la estación
    let sx = 0;
    let sy = 0;
    for (const { edge } of MAP.adjacency[s.id]) {
      const pts = edge.points;
      const from = edge.a === s.id ? pts[0] : pts[pts.length - 1];
      const to = edge.a === s.id ? pts[Math.min(1, pts.length - 1)] : pts[Math.max(0, pts.length - 2)];
      const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
      const w = LINE_WEIGHT[edge.terrain] ?? 1;
      sx += Math.cos(2 * a) * w;
      sy += Math.sin(2 * a) * w;
    }
    let angle = sx === 0 && sy === 0 ? 0 : 0.5 * Math.atan2(sy, sx);
    // Los andenes se leen mejor cerca de la horizontal
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    const big = s.population >= 900 ? 1.2 : s.population >= 600 ? 1.08 : s.population >= 300 ? 1 : 0.9;
    return {
      id: s.id,
      x: s.x,
      y: s.y,
      angle,
      cos: Math.cos(angle),
      sin: Math.sin(angle),
      len: Math.round(92 * big),
      wid: Math.round(40 * Math.min(1.1, big)),
    };
  });
}

export const EDGE_GEO: EdgeGeo[] = buildEdges();
export const EDGE_GEO_BY_ID: Record<string, EdgeGeo> = Object.fromEntries(EDGE_GEO.map((g) => [g.id, g]));
export const STATION_GEO: StationGeo[] = buildStations();
export const STATION_GEO_BY_ID: Record<string, StationGeo> = Object.fromEntries(STATION_GEO.map((s) => [s.id, s]));

/** ¿Está el punto dentro del andén (rectángulo girado)? */
export function insideStation(sg: StationGeo, x: number, y: number, pad = 0): boolean {
  const dx = x - sg.x;
  const dy = y - sg.y;
  const lx = dx * sg.cos + dy * sg.sin;
  const ly = -dx * sg.sin + dy * sg.cos;
  return Math.abs(lx) <= sg.len / 2 + pad && Math.abs(ly) <= sg.wid / 2 + pad;
}

/** Arista que une dos provincias contiguas (en cualquier sentido). */
export function edgeBetween(a: string, b: string): { geo: EdgeGeo; forward: boolean } | null {
  const hit = MAP.adjacency[a]?.find((x) => x.to === b);
  if (!hit) return null;
  const geo = EDGE_GEO_BY_ID[hit.edge.id];
  return { geo, forward: hit.edge.a === a };
}
