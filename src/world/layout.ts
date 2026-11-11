// Trazado del metro: convierte el plano del autor en geometría continua.
//  1. Marcos de estación (ejes, andenes, vías, bocas de túnel).
//  2. Ejes de túnel suavizados entre bocas y cruces.
//  3. Campo de distancias (SDF) de la unión de todas las formas.
//  4. Contornos (muros) por marching squares y rejilla de navegación.
// Todo es determinista y no depende del render.

import { LINKS, NODES, RIVERS, STATIONS, type LinkDef, type NodeDef, type StationDef } from '../data/historia/mapa';
import type { Terrain } from '../data/tipos';
import { DEG, clamp, distToSegment, hash2, hermite, lerp, noise2, resample, type V2, vdist } from '../core/math';
import { Rng, seedFrom } from '../core/rng';
import { CELL, F_WALK, F_WATER, FloatGrid, NavGrid } from './grid';
import {
  COLLAPSE_NODES,
  NODE_ROOMS,
  PLATFORM_H,
  STATION_PLANS,
  TRACK_OFFSET,
  TUNNEL_TRACKS,
  TUNNEL_WIDTH,
  mapToWorld,
  type NodeRoom,
  type StationPlan,
} from './plans';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface Region {
  id: number;
  kind: 'station' | 'link' | 'node';
  /** Id de estación, índice de enlace o id de cruce. */
  ref: string;
  name: string;
  terrain: Terrain | 'estacion';
}

export interface Lane {
  v: number;
  width: number;
  u0: number;
  u1: number;
  /** Posición lateral (v) de cada vía. */
  tracks: number[];
}

/** Rectángulo en coordenadas locales de estación. */
export interface LRect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export interface Ramp extends LRect {
  /** Dirección de subida. */
  dir: 'u+' | 'u-' | 'v+' | 'v-';
  /** Tipo visual. */
  kind: 'rampa' | 'escalera';
}

export interface Port {
  other: string;
  link: number;
  end: 'A' | 'B';
  wall: 'end' | 'L' | 'R';
  u: number;
  v: number;
  x: number;
  z: number;
  /** Dirección hacia fuera de la estación. */
  dx: number;
  dz: number;
  width: number;
  terrain: Terrain;
}

export interface StationFrame {
  id: string;
  def: StationDef;
  plan: StationPlan;
  x: number;
  z: number;
  rot: number;
  ax: number;
  az: number;
  lx: number;
  lz: number;
  hl: number;
  hw: number;
  lanes: Lane[];
  platforms: LRect[];
  /** Zonas de cabecera (fondo de saco) a nivel de andén. */
  heads: LRect[];
  ramps: Ramp[];
  decks: LRect[];
  ports: Port[];
  /** Vías dentro de la estación (polilíneas en el mundo). */
  tracks: V2[][];
  region: number;
}

export interface Alcove {
  x: number;
  z: number;
  rot: number;
  hl: number;
  hw: number;
  /** Distancia a lo largo del túnel. */
  s: number;
  side: 1 | -1;
}

export interface LinkGeom {
  index: number;
  def: LinkDef;
  a: string;
  b: string;
  terrain: Terrain;
  pts: V2[];
  cum: Float32Array;
  length: number;
  hw: Float32Array;
  tracks: V2[][];
  alcoves: Alcove[];
  region: number;
  /** Tramos (s0,s1) que pasan bajo el río. */
  underRiver: [number, number][];
}

export interface NodeGeom {
  id: string;
  def: NodeDef;
  room: NodeRoom;
  x: number;
  z: number;
  rot: number;
  links: number[];
  region: number;
}

export interface Contour {
  /** x, z, nx, nz por vértice (la normal apunta hacia la roca). */
  data: Float32Array;
  owner: Uint16Array;
  count: number;
}

export interface Layout {
  regions: Region[];
  stations: StationFrame[];
  stationById: Record<string, StationFrame>;
  links: LinkGeom[];
  nodes: NodeGeom[];
  nodeById: Record<string, NodeGeom>;
  sdf: FloatGrid;
  owner: Uint16Array;
  contours: Contour[];
  nav: NavGrid;
  rivers: V2[][];
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number };
}

// ---------------------------------------------------------------------------
// Marcos de estación
// ---------------------------------------------------------------------------

const LANE_W = 5.0;
const LANE_W_DOUBLE = 5.6;
const HEAD_LEN = 13;

export function stationToWorld(f: StationFrame, u: number, v: number): V2 {
  return { x: f.x + f.ax * u + f.lx * v, z: f.z + f.az * u + f.lz * v };
}
export function stationToLocal(f: StationFrame, x: number, z: number): [number, number] {
  const dx = x - f.x;
  const dz = z - f.z;
  return [dx * f.ax + dz * f.az, dx * f.lx + dz * f.lz];
}
export function insideStation(f: StationFrame, x: number, z: number, margin = 0): boolean {
  const [u, v] = stationToLocal(f, x, z);
  return Math.abs(u) <= f.hl + margin && Math.abs(v) <= f.hw + margin;
}

function buildFrame(def: StationDef, region: number): StationFrame {
  const plan = STATION_PLANS[def.id];
  const c = mapToWorld(def.x, def.y);
  const rot = plan.axis * DEG;
  const ax = Math.cos(rot);
  const az = Math.sin(rot);
  const f: StationFrame = {
    id: def.id,
    def,
    plan,
    x: c.x,
    z: c.z,
    rot,
    ax,
    az,
    lx: -az,
    lz: ax,
    hl: plan.length / 2,
    hw: plan.width / 2,
    lanes: [],
    platforms: [],
    heads: [],
    ramps: [],
    decks: [],
    ports: [],
    tracks: [],
    region,
  };
  const { hl, hw } = f;
  const closedA = plan.throatA === 0;
  const closedB = plan.throatB === 0;
  // Extremos de andén
  const pA = closedA ? -hl + HEAD_LEN : -hl + plan.throatA;
  const pB = closedB ? hl - HEAD_LEN : hl - plan.throatB;
  const laneU0 = closedA ? -hl + HEAD_LEN : -hl;
  const laneU1 = closedB ? hl - HEAD_LEN : hl;
  if (closedA) f.heads.push({ u0: -hl, u1: -hl + HEAD_LEN, v0: -hw, v1: hw });
  if (closedB) f.heads.push({ u0: hl - HEAD_LEN, u1: hl, v0: -hw, v1: hw });
  const hasDouble = Object.keys(plan.ports).some((o) => linkBetween(def.id, o)?.terrain === 'linea');
  const rampAt = (u: number, v: number, dir: Ramp['dir'], kind: Ramp['kind'] = 'rampa', half = 1.4, len = 3.6) => {
    if (dir === 'u+') f.ramps.push({ u0: u - len, u1: u, v0: v - half, v1: v + half, dir, kind });
    else if (dir === 'u-') f.ramps.push({ u0: u, u1: u + len, v0: v - half, v1: v + half, dir, kind });
    else if (dir === 'v+') f.ramps.push({ u0: u - half, u1: u + half, v0: v - len, v1: v, dir, kind });
    else f.ramps.push({ u0: u - half, u1: u + half, v0: v, v1: v + len, dir, kind });
  };
  // Escaleras laterales repartidas a lo largo de un borde de andén
  const sideStairs = (vEdge: number, dir: 'v+' | 'v-', count: number, phase = 0) => {
    const span = pB - pA;
    for (let i = 0; i < count; i++) {
      const u = pA + (span * (i + 0.5 + phase)) / count;
      rampAt(u, vEdge, dir, 'escalera', 1.1, 2.3);
    }
  };
  if (plan.kind === 'isla') {
    const pv = hw - LANE_W;
    f.platforms.push({ u0: pA, u1: pB, v0: -pv, v1: pv });
    for (const s of [-1, 1]) f.lanes.push({ v: s * (hw - LANE_W / 2), width: LANE_W, u0: laneU0, u1: laneU1, tracks: [s * (hw - LANE_W / 2)] });
    if (!closedA) for (const s of [-1, 1]) rampAt(pA, s * pv * 0.5, 'u+');
    if (!closedB) for (const s of [-1, 1]) rampAt(pB, s * pv * 0.5, 'u-');
    const n = Math.max(2, Math.round((pB - pA) / 34));
    sideStairs(pv, 'v-', n, 0);
    sideStairs(-pv, 'v+', n, 0.25);
  } else if (plan.kind === 'lateral') {
    const lw = hasDouble ? 9.8 : LANE_W_DOUBLE;
    f.lanes.push({ v: 0, width: lw, u0: laneU0, u1: laneU1, tracks: hasDouble ? [-TRACK_OFFSET, TRACK_OFFSET] : [0] });
    f.platforms.push({ u0: pA, u1: pB, v0: lw / 2, v1: hw });
    f.platforms.push({ u0: pA, u1: pB, v0: -hw, v1: -lw / 2 });
    const pm = (lw / 2 + hw) / 2;
    if (!closedA) for (const s of [-1, 1]) rampAt(pA, s * pm, 'u+');
    if (!closedB) for (const s of [-1, 1]) rampAt(pB, s * pm, 'u-');
    const span = pB - pA;
    const nd = Math.max(2, Math.round(span / 36));
    for (let i = 0; i < nd; i++) {
      const u = pA + (span * (i + 0.5)) / nd;
      f.decks.push({ u0: u - 1.6, u1: u + 1.6, v0: -lw / 2, v1: lw / 2 });
    }
    sideStairs(lw / 2, 'v+', nd, 0.5);
    sideStairs(-lw / 2, 'v-', nd, 0.5);
  } else {
    const lv = plan.kind === 'doble' ? (def.id === 'TSE' ? 10.5 : 9) : 9;
    const lw = LANE_W_DOUBLE;
    for (const s of [-1, 1]) f.lanes.push({ v: s * lv, width: lw, u0: laneU0, u1: laneU1, tracks: [s * lv] });
    const ci = lv - lw / 2;
    const so = lv + lw / 2;
    f.platforms.push({ u0: pA, u1: pB, v0: -ci, v1: ci });
    f.platforms.push({ u0: pA, u1: pB, v0: so, v1: hw });
    f.platforms.push({ u0: pA, u1: pB, v0: -hw, v1: -so });
    const sm = (so + hw) / 2;
    if (!closedA) {
      for (const s of [-1, 1]) rampAt(pA, s * ci * 0.5, 'u+');
      for (const s of [-1, 1]) rampAt(pA, s * sm, 'u+');
    }
    if (!closedB) {
      for (const s of [-1, 1]) rampAt(pB, s * ci * 0.5, 'u-');
      for (const s of [-1, 1]) rampAt(pB, s * sm, 'u-');
    }
    const span = pB - pA;
    const nd = Math.max(3, Math.round(span / 30));
    for (let i = 0; i < nd; i++) {
      const u = pA + (span * (i + 0.5)) / nd;
      for (const s of [-1, 1]) f.decks.push({ u0: u - 1.7, u1: u + 1.7, v0: Math.min(s * ci, s * so), v1: Math.max(s * ci, s * so) });
    }
    sideStairs(ci, 'v-', nd, 0.5);
    sideStairs(-ci, 'v+', nd, 0.5);
  }
  return f;
}

function linkBetween(a: string, b: string): LinkDef | undefined {
  return LINKS.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a));
}

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

interface EndInfo {
  x: number;
  z: number;
  /** Dirección de salida (unidad) o null si es un cruce libre. */
  dx: number;
  dz: number;
  fixed: boolean;
}

const SDF_CELL = 1.0;
const SDF_FAR = 4;

export function buildLayout(): Layout {
  const regions: Region[] = [{ id: 0, kind: 'node', ref: '', name: 'Roca', terrain: 'derrumbe' }];
  const addRegion = (kind: Region['kind'], ref: string, name: string, terrain: Region['terrain']) => {
    regions.push({ id: regions.length, kind, ref, name, terrain });
    return regions.length - 1;
  };

  // --- Estaciones
  const stations = STATIONS.map((s) => buildFrame(s, addRegion('station', s.id, s.name, 'estacion')));
  const stationById = Object.fromEntries(stations.map((s) => [s.id, s]));

  // --- Cruces
  const nodes: NodeGeom[] = NODES.map((n) => {
    const p = mapToWorld(n.x, n.y);
    return { id: n.id, def: n, room: NODE_ROOMS[n.id], x: p.x, z: p.z, rot: 0, links: [], region: addRegion('node', n.id, n.name, n.terrain) };
  });
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const posOf = (id: string): V2 => (stationById[id] ? { x: stationById[id].x, z: stationById[id].z } : { x: nodeById[id].x, z: nodeById[id].z });
  for (const n of nodes) {
    const toward = n.room.toward ?? LINKS.find((l) => l.a === n.id || l.b === n.id)?.[LINKS.find((l) => l.a === n.id || l.b === n.id)!.a === n.id ? 'b' : 'a'];
    if (toward) {
      const p = posOf(toward);
      n.rot = Math.atan2(p.z - n.z, p.x - n.x);
    }
  }

  // --- Bocas de túnel
  LINKS.forEach((link, index) => {
    for (const [self, other] of [
      [link.a, link.b],
      [link.b, link.a],
    ]) {
      const f = stationById[self];
      if (!f) continue;
      const spec = f.plan.ports[other];
      if (!spec) throw new Error(`Falta la boca ${self} -> ${other}`);
      const width = TUNNEL_WIDTH[link.terrain];
      const wall = spec.wall ?? 'end';
      const sgn = spec.end === 'A' ? -1 : 1;
      let u: number;
      let v: number;
      let du: number;
      let dv: number;
      if (wall === 'end') {
        u = sgn * f.hl;
        v = spec.v ?? 0;
        du = sgn;
        dv = 0;
      } else {
        const throat = spec.end === 'A' ? f.plan.throatA : f.plan.throatB;
        u = sgn * (f.hl - Math.max(width / 2 + 1.5, throat / 2));
        v = wall === 'L' ? -f.hw : f.hw;
        du = 0;
        dv = wall === 'L' ? -1 : 1;
      }
      const p = stationToWorld(f, u, v);
      f.ports.push({
        other,
        link: index,
        end: spec.end,
        wall,
        u,
        v,
        x: p.x,
        z: p.z,
        dx: f.ax * du + f.lx * dv,
        dz: f.az * du + f.lz * dv,
        width,
        terrain: link.terrain,
      });
    }
  });

  // --- Ejes de túnel
  const rivers: V2[][] = RIVERS.map((r) => r.map(([x, y]) => mapToWorld(x, y)));
  const riverDist = (x: number, z: number) => {
    let best = Infinity;
    for (const r of rivers) for (let i = 1; i < r.length; i++) best = Math.min(best, distToSegment(x, z, r[i - 1].x, r[i - 1].z, r[i].x, r[i].z)[0]);
    return best;
  };
  const links: LinkGeom[] = LINKS.map((def, index) => {
    const endInfo = (self: string, other: string): EndInfo => {
      const f = stationById[self];
      if (f) {
        const port = f.ports.find((p) => p.link === index)!;
        return { x: port.x, z: port.z, dx: port.dx, dz: port.dz, fixed: true };
      }
      const n = nodeById[self];
      return { x: n.x, z: n.z, dx: 0, dz: 0, fixed: false };
    };
    const A = endInfo(def.a, def.b);
    const B = endInfo(def.b, def.a);
    const noVia = stationById[def.a]?.plan.ports[def.b]?.noVia || stationById[def.b]?.plan.ports[def.a]?.noVia;
    const ctrl: V2[] = [{ x: A.x, z: A.z }, ...(noVia ? [] : (def.via ?? []).map(([x, y]) => mapToWorld(x, y))), { x: B.x, z: B.z }];
    // Tangentes
    const tan: V2[] = ctrl.map((p, i) => {
      if (i === 0) {
        const d = vdist(ctrl[0], ctrl[1]);
        if (A.fixed) {
          const k = clamp(d * 0.75, 12, 75);
          return { x: A.dx * k, z: A.dz * k };
        }
        return { x: (ctrl[1].x - p.x) * 1, z: (ctrl[1].z - p.z) * 1 };
      }
      if (i === ctrl.length - 1) {
        const d = vdist(ctrl[i - 1], p);
        if (B.fixed) {
          const k = clamp(d * 0.75, 12, 75);
          return { x: -B.dx * k, z: -B.dz * k };
        }
        return { x: p.x - ctrl[i - 1].x, z: p.z - ctrl[i - 1].z };
      }
      return { x: (ctrl[i + 1].x - ctrl[i - 1].x) * 0.5, z: (ctrl[i + 1].z - ctrl[i - 1].z) * 0.5 };
    });
    const dense: V2[] = [];
    // Un tramo recto hacia dentro de la estación asegura que el muro se abra
    if (A.fixed) dense.push({ x: A.x - A.dx * 2.5, z: A.z - A.dz * 2.5 });
    for (let i = 0; i < ctrl.length - 1; i++) {
      const steps = Math.max(8, Math.ceil(vdist(ctrl[i], ctrl[i + 1]) / 1.5));
      for (let s = i === 0 ? 0 : 1; s <= steps; s++) {
        const t = s / steps;
        dense.push({
          x: hermite(ctrl[i].x, tan[i].x, ctrl[i + 1].x, tan[i + 1].x, t),
          z: hermite(ctrl[i].z, tan[i].z, ctrl[i + 1].z, tan[i + 1].z, t),
        });
      }
    }
    if (B.fixed) dense.push({ x: B.x - B.dx * 2.5, z: B.z - B.dz * 2.5 });
    const pts = resample(dense, 2);
    const cum = new Float32Array(pts.length);
    for (let i = 1; i < pts.length; i++) cum[i] = cum[i - 1] + vdist(pts[i - 1], pts[i]);
    const length = cum[pts.length - 1];
    // Anchos (los túneles peligrosos son irregulares)
    const base = TUNNEL_WIDTH[def.terrain] / 2;
    const wild = def.terrain === 'peligroso' || def.terrain === 'auxiliarPeligroso' || def.terrain === 'derrumbe';
    const hw = new Float32Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      let w = base;
      if (wild) {
        const edge = Math.min(cum[i], length - cum[i]);
        const k = clamp(edge / 18, 0, 1);
        w += (noise2(cum[i] * 0.09, index * 7.3, 11) - 0.35) * 1.5 * k;
      }
      hw[i] = w;
    }
    // Tramos bajo el río
    const underRiver: [number, number][] = [];
    let start = -1;
    for (let i = 0; i < pts.length; i++) {
      const under = riverDist(pts[i].x, pts[i].z) < 22;
      if (under && start < 0) start = cum[i];
      if ((!under || i === pts.length - 1) && start >= 0) {
        if (cum[i] - start > 6) underRiver.push([start, cum[i]]);
        start = -1;
      }
    }
    const g: LinkGeom = {
      index,
      def,
      a: def.a,
      b: def.b,
      terrain: def.terrain,
      pts,
      cum,
      length,
      hw,
      tracks: [],
      alcoves: [],
      region: addRegion('link', String(index), def.tunnel, def.terrain),
      underRiver,
    };
    // Vías (se detienen antes de las bocas laterales)
    const nt = TUNNEL_TRACKS[def.terrain];
    const portA = stationById[def.a]?.ports.find((p) => p.link === index);
    const portB = stationById[def.b]?.ports.find((p) => p.link === index);
    const trimA = portA ? (portA.wall === 'end' ? 2.5 : 9) : 0;
    const trimB = portB ? (portB.wall === 'end' ? 2.5 : 9) : 0;
    for (let t = 0; t < nt; t++) {
      const off = nt === 1 ? 0 : t === 0 ? -TRACK_OFFSET : TRACK_OFFSET;
      const line: V2[] = [];
      for (let i = 0; i < pts.length; i++) {
        if (cum[i] < trimA || cum[i] > length - trimB) continue;
        const [nx, nz] = linkNormal(g, i);
        line.push({ x: pts[i].x + nx * off, z: pts[i].z + nz * off });
      }
      if (line.length > 1) g.tracks.push(line);
    }
    // Nichos y cuevas laterales
    const rng = new Rng(seedFrom('nicho', index));
    const spacing = def.terrain === 'linea' ? 70 : def.terrain === 'tunel' ? 85 : wild ? 55 : 110;
    if (def.terrain !== 'estrecho') {
      let s = 30 + rng.range(0, 25);
      let side: 1 | -1 = rng.chance(0.5) ? 1 : -1;
      while (s < length - 30) {
        const i = pointIndexAt(g, s);
        const [nx, nz] = linkNormal(g, i);
        const deep = wild ? rng.range(3.2, 6.5) : rng.range(2.4, 3.6);
        const along = wild ? rng.range(4, 8) : rng.range(3.5, 6);
        const off = hw[i] + deep * 0.5 - 0.4;
        const tx = -nz * side;
        const tz = nx * side;
        g.alcoves.push({
          x: pts[i].x + nx * side * off,
          z: pts[i].z + nz * side * off,
          rot: Math.atan2(tz, tx),
          hl: along,
          hw: deep * 0.5 + 0.4,
          s,
          side,
        });
        side = side === 1 ? -1 : 1;
        s += spacing * rng.range(0.7, 1.35);
      }
    }
    return g;
  });
  for (const l of links) {
    nodeById[l.a]?.links.push(l.index);
    nodeById[l.b]?.links.push(l.index);
  }

  // --- Vías dentro de las estaciones
  for (const f of stations) buildStationTracks(f, links);

  // --- Límites del mundo
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  const grow = (x: number, z: number, r: number) => {
    minX = Math.min(minX, x - r);
    minZ = Math.min(minZ, z - r);
    maxX = Math.max(maxX, x + r);
    maxZ = Math.max(maxZ, z + r);
  };
  for (const f of stations) grow(f.x, f.z, Math.hypot(f.hl, f.hw) + 4);
  for (const n of nodes) grow(n.x, n.z, n.room.r + 8);
  for (const l of links) for (const p of l.pts) grow(p.x, p.z, 14);
  minX = Math.floor(minX - 10);
  minZ = Math.floor(minZ - 10);
  maxX = Math.ceil(maxX + 10);
  maxZ = Math.ceil(maxZ + 10);

  // --- Campo de distancias
  const gw = Math.ceil((maxX - minX) / SDF_CELL) + 1;
  const gh = Math.ceil((maxZ - minZ) / SDF_CELL) + 1;
  const sdf = new FloatGrid(minX, minZ, SDF_CELL, gw, gh, SDF_FAR);
  const owner = new Uint16Array(gw * gh);
  const stampBox = (cx: number, cz: number, rot: number, hl: number, hw: number, r: number, region: number, rough = 0) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const ext = Math.hypot(hl, hw) + 3 + rough;
    const x0 = Math.max(0, Math.floor((cx - ext - minX) / SDF_CELL));
    const x1 = Math.min(gw - 1, Math.ceil((cx + ext - minX) / SDF_CELL));
    const z0 = Math.max(0, Math.floor((cz - ext - minZ) / SDF_CELL));
    const z1 = Math.min(gh - 1, Math.ceil((cz + ext - minZ) / SDF_CELL));
    for (let j = z0; j <= z1; j++) {
      for (let i = x0; i <= x1; i++) {
        const wx = minX + i * SDF_CELL;
        const wz = minZ + j * SDF_CELL;
        const dx = wx - cx;
        const dz = wz - cz;
        const qx = Math.abs(dx * c + dz * s) - hl + r;
        const qz = Math.abs(-dx * s + dz * c) - hw + r;
        let d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
        if (rough) d += (noise2(wx * 0.22, wz * 0.22, 5) - 0.5) * 2 * rough;
        const k = j * gw + i;
        if (d < sdf.data[k]) {
          sdf.data[k] = d;
          owner[k] = region;
        }
      }
    }
  };
  const stampCircle = (cx: number, cz: number, rad: number, region: number, rough = 0) => {
    const ext = rad + 3 + rough;
    const x0 = Math.max(0, Math.floor((cx - ext - minX) / SDF_CELL));
    const x1 = Math.min(gw - 1, Math.ceil((cx + ext - minX) / SDF_CELL));
    const z0 = Math.max(0, Math.floor((cz - ext - minZ) / SDF_CELL));
    const z1 = Math.min(gh - 1, Math.ceil((cz + ext - minZ) / SDF_CELL));
    for (let j = z0; j <= z1; j++) {
      for (let i = x0; i <= x1; i++) {
        const wx = minX + i * SDF_CELL;
        const wz = minZ + j * SDF_CELL;
        let d = Math.hypot(wx - cx, wz - cz) - rad;
        if (rough) d += (noise2(wx * 0.2, wz * 0.2, 9) - 0.5) * 2 * rough;
        const k = j * gw + i;
        if (d < sdf.data[k]) {
          sdf.data[k] = d;
          owner[k] = region;
        }
      }
    }
  };
  const stampSegment = (ax: number, az: number, bx: number, bz: number, ra: number, rb: number, region: number, rough: number) => {
    const ext = Math.max(ra, rb) + 3 + rough;
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - ext - minX) / SDF_CELL));
    const x1 = Math.min(gw - 1, Math.ceil((Math.max(ax, bx) + ext - minX) / SDF_CELL));
    const z0 = Math.max(0, Math.floor((Math.min(az, bz) - ext - minZ) / SDF_CELL));
    const z1 = Math.min(gh - 1, Math.ceil((Math.max(az, bz) + ext - minZ) / SDF_CELL));
    for (let j = z0; j <= z1; j++) {
      for (let i = x0; i <= x1; i++) {
        const wx = minX + i * SDF_CELL;
        const wz = minZ + j * SDF_CELL;
        const [dist, t] = distToSegment(wx, wz, ax, az, bx, bz);
        let d = dist - lerp(ra, rb, t);
        if (rough) d += (noise2(wx * 0.3, wz * 0.3, 3) - 0.5) * 2 * rough;
        const k = j * gw + i;
        if (d < sdf.data[k]) {
          sdf.data[k] = d;
          owner[k] = region;
        }
      }
    }
  };
  // Túneles primero; salas y estaciones después (ganan la propiedad del contorno)
  for (const l of links) {
    const wild = l.terrain === 'peligroso' || l.terrain === 'auxiliarPeligroso' || l.terrain === 'derrumbe';
    const rough = wild ? 0.45 : 0;
    for (let i = 1; i < l.pts.length; i++) stampSegment(l.pts[i - 1].x, l.pts[i - 1].z, l.pts[i].x, l.pts[i].z, l.hw[i - 1], l.hw[i], l.region, rough);
    for (const a of l.alcoves) stampBox(a.x, a.z, a.rot, a.hl, a.hw, 0.8, l.region, wild ? 0.5 : 0);
  }
  for (const n of nodes) {
    if (n.room.shape === 'circle') stampCircle(n.x, n.z, n.room.r, n.region, n.room.rough ?? 0);
    else stampBox(n.x, n.z, n.rot, n.room.r, n.room.w ?? n.room.r, 1.6, n.region, n.room.rough ?? 0);
  }
  for (const f of stations) stampBox(f.x, f.z, f.rot, f.hl, f.hw, 0.5, f.region);

  // Evita ceros exactos (aristas alineadas con la rejilla)
  for (let i = 0; i < sdf.data.length; i++) if (Math.abs(sdf.data[i]) < 1e-4) sdf.data[i] = -1e-4;

  // --- Contornos
  const contours = extractContours(sdf, owner);

  // --- Navegación
  const nav = new NavGrid(minX, minZ, (gw - 1) * 2, (gh - 1) * 2);
  for (let cz = 0; cz < nav.h; cz++) {
    for (let cx = 0; cx < nav.w; cx++) {
      const x = nav.wx(cx);
      const z = nav.wz(cz);
      if (sdf.sample(x, z) < -0.32) nav.flags[cz * nav.w + cx] = F_WALK;
    }
  }
  // Alturas de andén, rampas y pasarelas
  for (const f of stations) stampStationHeights(f, nav);
  // Agua: el Cruce del Río y los tramos peligrosos bajo el cauce
  for (const n of nodes) {
    if (n.room.theme === 'inundado') {
      const r = n.room.r + 6;
      for (let cz = nav.cz(n.z - r); cz <= nav.cz(n.z + r); cz++) {
        for (let cx = nav.cx(n.x - r); cx <= nav.cx(n.x + r); cx++) {
          if (!nav.inside(cx, cz)) continue;
          const i = cz * nav.w + cx;
          if (nav.flags[i] & F_WALK && Math.hypot(nav.wx(cx) - n.x, nav.wz(cz) - n.z) < r) nav.flags[i] |= F_WATER;
        }
      }
    }
  }
  for (const l of links) {
    if (l.terrain !== 'peligroso' && l.terrain !== 'auxiliarPeligroso' && l.terrain !== 'auxiliar') continue;
    for (const [s0, s1] of l.underRiver) {
      for (let i = 0; i < l.pts.length; i++) {
        if (l.cum[i] < s0 || l.cum[i] > s1) continue;
        // Charcos irregulares
        const r = l.hw[i] + 1;
        for (let cz = nav.cz(l.pts[i].z - r); cz <= nav.cz(l.pts[i].z + r); cz++) {
          for (let cx = nav.cx(l.pts[i].x - r); cx <= nav.cx(l.pts[i].x + r); cx++) {
            if (!nav.inside(cx, cz)) continue;
            const k = cz * nav.w + cx;
            if (nav.flags[k] & F_WALK && noise2(nav.wx(cx) * 0.16, nav.wz(cz) * 0.16, 77) > 0.42) nav.flags[k] |= F_WATER;
          }
        }
      }
    }
  }
  nav.computeNear();

  return { regions, stations, stationById, links, nodes, nodeById, sdf, owner, contours, nav, rivers, bounds: { minX, minZ, maxX, maxZ } };
}

/** Normal (izquierda) del eje del túnel en el punto i. */
export function linkNormal(l: LinkGeom, i: number): [number, number] {
  const a = l.pts[Math.max(0, i - 1)];
  const b = l.pts[Math.min(l.pts.length - 1, i + 1)];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  return [-dz / len, dx / len];
}

export function pointIndexAt(l: LinkGeom, s: number): number {
  let lo = 0;
  let hi = l.pts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (l.cum[mid] < s) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Punto y dirección a una distancia `s` del extremo A del túnel. */
export function linkPointAt(l: LinkGeom, s: number): { x: number; z: number; dx: number; dz: number; hw: number } {
  s = clamp(s, 0, l.length);
  let i = pointIndexAt(l, s);
  if (i === 0) i = 1;
  const a = l.pts[i - 1];
  const b = l.pts[i];
  const seg = l.cum[i] - l.cum[i - 1] || 1;
  const t = (s - l.cum[i - 1]) / seg;
  const dx = (b.x - a.x) / seg;
  const dz = (b.z - a.z) / seg;
  return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), dx, dz, hw: lerp(l.hw[i - 1], l.hw[i], t) };
}

function buildStationTracks(f: StationFrame, links: LinkGeom[]) {
  // Vías rectas de cada carril
  const laneTracks: { v: number; u0: number; u1: number; usedA: boolean; usedB: boolean }[] = [];
  const closedA = f.plan.throatA === 0;
  const closedB = f.plan.throatB === 0;
  const tA = closedA ? f.lanes[0].u0 + 2.5 : -f.hl + f.plan.throatA;
  const tB = closedB ? f.lanes[0].u1 - 2.5 : f.hl - f.plan.throatB;
  for (const lane of f.lanes) for (const v of lane.tracks) laneTracks.push({ v, u0: tA, u1: tB, usedA: false, usedB: false });
  for (const t of laneTracks) f.tracks.push([stationToWorld(f, t.u0, t.v), stationToWorld(f, t.u1, t.v)]);
  // Conexiones en las gargantas: de la vía del túnel a la vía del carril
  for (const port of f.ports) {
    if (port.wall !== 'end') continue;
    const link = links[port.link];
    const sgn = port.end === 'A' ? -1 : 1;
    const uPort = sgn * f.hl;
    const uLane = port.end === 'A' ? tA : tB;
    const nt = TUNNEL_TRACKS[link.terrain];
    if (nt === 0) continue;
    const offs = nt === 1 ? [0] : [-TRACK_OFFSET, TRACK_OFFSET];
    for (const off of offs) {
      const v0 = port.v + off;
      // Carriles destino: el más cercano; una vía única centrada se bifurca
      const sorted = [...laneTracks].sort((a, b) => Math.abs(a.v - v0) - Math.abs(b.v - v0));
      const targets = nt === 1 && sorted.length > 1 && Math.abs(Math.abs(sorted[0].v - v0) - Math.abs(sorted[1].v - v0)) < 0.5 ? [sorted[0], sorted[1]] : [sorted[0]];
      for (const tgt of targets) {
        const span = Math.abs(uLane - uPort);
        const k = span * 0.55;
        const line: V2[] = [];
        // Empalme con la vía del túnel (2.5 m fuera de la boca)
        const uStart = uPort + sgn * 2.5;
        const n = 14;
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const u = hermite(uStart, (uLane - uStart) * 0.9, uLane, (uLane - uStart) * 0.9, t);
          const v = hermite(v0, 0, tgt.v, 0, t);
          void k;
          line.push(stationToWorld(f, u, v));
        }
        f.tracks.push(line);
      }
    }
  }
}

function stampStationHeights(f: StationFrame, nav: NavGrid) {
  const H = Math.round(PLATFORM_H * 10);
  const ext = Math.hypot(f.hl, f.hw) + 6;
  const x0 = Math.max(0, nav.cx(f.x - ext));
  const x1 = Math.min(nav.w - 1, nav.cx(f.x + ext));
  const z0 = Math.max(0, nav.cz(f.z - ext));
  const z1 = Math.min(nav.h - 1, nav.cz(f.z + ext));
  const inRect = (r: LRect, u: number, v: number) => u >= r.u0 && u <= r.u1 && v >= r.v0 && v <= r.v1;
  for (let cz = z0; cz <= z1; cz++) {
    for (let cx = x0; cx <= x1; cx++) {
      const i = cz * nav.w + cx;
      if (!(nav.flags[i] & F_WALK)) continue;
      const [u, v] = stationToLocal(f, nav.wx(cx), nav.wz(cz));
      if (Math.abs(u) > f.hl + 1 || Math.abs(v) > f.hw + 1) continue;
      let h = 0;
      for (const p of f.platforms) if (inRect(p, u, v)) h = H;
      for (const p of f.heads) if (inRect(p, u, v)) h = H;
      for (const d of f.decks) if (inRect(d, u, v)) h = H;
      for (const r of f.ramps) {
        if (!inRect(r, u, v)) continue;
        let t: number;
        if (r.dir === 'u+') t = (u - r.u0) / (r.u1 - r.u0);
        else if (r.dir === 'u-') t = (r.u1 - u) / (r.u1 - r.u0);
        else if (r.dir === 'v+') t = (v - r.v0) / (r.v1 - r.v0);
        else t = (r.v1 - v) / (r.v1 - r.v0);
        h = Math.round(H * clamp(t, 0, 1));
      }
      nav.height[i] = h;
    }
  }
}

// ---------------------------------------------------------------------------
// Contornos (marching squares)
// ---------------------------------------------------------------------------

function extractContours(sdf: FloatGrid, owner: Uint16Array): Contour[] {
  const { w, h, data, ox, oz, cell } = sdf;
  // Vértices sobre aristas de la rejilla: clave = índice*2 (+1 si es vertical)
  const vx: number[] = [];
  const vz: number[] = [];
  const vkey = new Map<number, number>();
  const next = new Map<number, number>();
  const edgeVertex = (i: number, j: number, vertical: boolean): number => {
    const key = (j * w + i) * 2 + (vertical ? 1 : 0);
    let id = vkey.get(key);
    if (id !== undefined) return id;
    const a = data[j * w + i];
    const b = vertical ? data[(j + 1) * w + i] : data[j * w + i + 1];
    const t = clamp(a / (a - b), 0.002, 0.998);
    id = vx.length;
    vx.push(ox + (i + (vertical ? 0 : t)) * cell);
    vz.push(oz + (j + (vertical ? t : 0)) * cell);
    vkey.set(key, id);
    return id;
  };
  // Orienta cada segmento con una esquina de referencia de la celda: el
  // interior (valor negativo) queda siempre a la izquierda del avance.
  const addSeg = (p: number, q: number, ci: number, cj: number, refInside: boolean) => {
    const dx = vx[q] - vx[p];
    const dz = vz[q] - vz[p];
    const rx = ox + ci * cell - vx[p];
    const rz = oz + cj * cell - vz[p];
    const left = -dz * rx + dx * rz > 0;
    if (left === refInside) next.set(p, q);
    else next.set(q, p);
  };
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const k = j * w + i;
      const c0 = data[k] < 0 ? 1 : 0;
      const c1 = data[k + 1] < 0 ? 2 : 0;
      const c2 = data[k + w + 1] < 0 ? 4 : 0;
      const c3 = data[k + w] < 0 ? 8 : 0;
      const m = c0 | c1 | c2 | c3;
      if (m === 0 || m === 15) continue;
      // Aristas: abajo (i,j,h), derecha (i+1,j,v), arriba (i,j+1,h), izquierda (i,j,v)
      const eB = () => edgeVertex(i, j, false);
      const eR = () => edgeVertex(i + 1, j, true);
      const eT = () => edgeVertex(i, j + 1, false);
      const eL = () => edgeVertex(i, j, true);
      switch (m) {
        case 1:
        case 14:
          addSeg(eL(), eB(), i, j, m === 1);
          break;
        case 2:
        case 13:
          addSeg(eB(), eR(), i + 1, j, m === 2);
          break;
        case 4:
        case 11:
          addSeg(eR(), eT(), i + 1, j + 1, m === 4);
          break;
        case 8:
        case 7:
          addSeg(eT(), eL(), i, j + 1, m === 8);
          break;
        case 3:
        case 12:
          addSeg(eL(), eR(), i, j, m === 3);
          break;
        case 6:
        case 9:
          addSeg(eB(), eT(), i + 1, j, m === 6);
          break;
        case 5:
        case 10: {
          const center = (data[k] + data[k + 1] + data[k + w] + data[k + w + 1]) / 4;
          const joined = center < 0;
          if ((m === 5) === joined) {
            // Corta las esquinas c3 y c1
            addSeg(eL(), eT(), i, j + 1, m === 10);
            addSeg(eB(), eR(), i + 1, j, m === 10);
          } else {
            // Corta las esquinas c0 y c2
            addSeg(eL(), eB(), i, j, m === 5);
            addSeg(eR(), eT(), i + 1, j + 1, m === 5);
          }
          break;
        }
      }
    }
  }
  // Encadenado en bucles
  const contours: Contour[] = [];
  const done = new Set<number>();
  const g: [number, number] = [0, 0];
  for (const start of next.keys()) {
    if (done.has(start)) continue;
    const loop: number[] = [];
    let cur = start;
    while (!done.has(cur)) {
      done.add(cur);
      loop.push(cur);
      const n = next.get(cur);
      if (n === undefined) break;
      cur = n;
    }
    if (loop.length < 4) continue;
    // Simplifica tramos rectos y vuelve a subdividir a ~2 m
    let px = loop.map((id) => vx[id]);
    let pz = loop.map((id) => vz[id]);
    [px, pz] = simplifyLoop(px, pz, 0.045);
    [px, pz] = subdivideLoop(px, pz, 2.2);
    const n = px.length;
    const dataOut = new Float32Array(n * 4);
    const own = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
      sdf.gradient(px[i], pz[i], g);
      dataOut[i * 4] = px[i];
      dataOut[i * 4 + 1] = pz[i];
      dataOut[i * 4 + 2] = g[0];
      dataOut[i * 4 + 3] = g[1];
      // Propietario: la muestra interior más cercana
      const sx = px[i] - g[0] * 0.8;
      const sz = pz[i] - g[1] * 0.8;
      const gi = clamp(Math.round((sx - ox) / cell), 0, w - 1);
      const gj = clamp(Math.round((sz - oz) / cell), 0, h - 1);
      own[i] = owner[gj * w + gi];
    }
    contours.push({ data: dataOut, owner: own, count: n });
  }
  return contours;
}

function simplifyLoop(px: number[], pz: number[], eps: number): [number[], number[]] {
  const n = px.length;
  if (n < 8) return [px, pz];
  const keep = new Uint8Array(n);
  // Ancla en dos puntos opuestos y aplica Douglas-Peucker a cada mitad
  const half = n >> 1;
  keep[0] = 1;
  keep[half] = 1;
  const stack: [number, number][] = [
    [0, half],
    [half, n],
  ];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const bi = b % n;
    let worst = -1;
    let worstD = eps;
    for (let i = a + 1; i < b; i++) {
      const d = distToSegment(px[i], pz[i], px[a], pz[a], px[bi], pz[bi])[0];
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  const ox: number[] = [];
  const oz: number[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) {
      ox.push(px[i]);
      oz.push(pz[i]);
    }
  }
  return [ox, oz];
}

function subdivideLoop(px: number[], pz: number[], maxLen: number): [number[], number[]] {
  const ox: number[] = [];
  const oz: number[] = [];
  const n = px.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const d = Math.hypot(px[j] - px[i], pz[j] - pz[i]);
    const parts = Math.max(1, Math.ceil(d / maxLen));
    for (let k = 0; k < parts; k++) {
      ox.push(lerp(px[i], px[j], k / parts));
      oz.push(lerp(pz[i], pz[j], k / parts));
    }
  }
  return [ox, oz];
}

/** Región (estación, túnel o cruce) en un punto del mundo; 0 si es roca. */
export function regionAt(layout: Layout, x: number, z: number): number {
  const { sdf, owner } = layout;
  const i = clamp(Math.round((x - sdf.ox) / sdf.cell), 0, sdf.w - 1);
  const j = clamp(Math.round((z - sdf.oz) / sdf.cell), 0, sdf.h - 1);
  const k = j * sdf.w + i;
  return sdf.data[k] < 0.5 ? owner[k] : 0;
}

export { COLLAPSE_NODES, hash2 };
export { CELL };
