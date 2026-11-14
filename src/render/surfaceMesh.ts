// La superficie en 3D: el suelo nevado de calles y patios y los edificios del
// barrio norte (bloques de paneles, ladrillo, estalinistas, naves, la estación
// de ferrocarril y los pabellones del metro). Va en su propio grupo: se ve
// cuando la cámara sube a la superficie y se oculta bajo tierra.

import * as THREE from 'three';
import { clamp, clamp01, fbm2, hash2, lerp, noise2, smoothstep } from '../core/math';
import { Rng } from '../core/rng';
import { SURFACE_Y } from '../world/arch';
import type { Layout } from '../world/layout';
import type { LightField } from '../world/lights';
import { inBox, surfaceHeight, type SBox, type SBuilding, type SOpen } from '../world/surface';
import { MeshBuilder, lin, scalec, type RGB } from './geo';
import { buildingMaterial, floorMaterial } from './materials';
import type { TextureSet } from './textures';

const TILE = 64;
const CELL = 2;

export interface SurfaceMesh {
  group: THREE.Group;
  stats: { vertices: number; triangles: number };
}

type Bucket = { b: MeshBuilder; bld: number[] };

/** Altura del suelo de la superficie en un punto (a ras en pabellones y bocas). */
export function surfaceGroundY(layout: Layout, x: number, z: number): number {
  for (const o of layout.surface.open) if ((o.kind === 'pabellon' || o.kind === 'boca') && inBox(o.box, x, z, 1.5)) return SURFACE_Y;
  return surfaceHeight(x, z);
}

export function buildSurfaceMesh(layout: Layout, field: LightField, tex: TextureSet): SurfaceMesh {
  const group = new THREE.Group();
  group.name = 'superficie';
  const mats: Record<string, THREE.Material> = {
    ground: floorMaterial(tex.asphalt, tex.snow, tex.dirt, 0.92),
    panel: buildingMaterial(tex.facadePanel, 1.2),
    brick: buildingMaterial(tex.facadeBrick, 1.2),
    stucco: buildingMaterial(tex.facadeStucco, 1.0),
    roof: buildingMaterial(tex.roof, 0.8),
    concrete: buildingMaterial(tex.concreteWall, 1.0),
  };
  const buckets = new Map<string, Bucket>();
  const B = (x: number, z: number, mat: string): Bucket => {
    const key = `${Math.floor(x / TILE)},${Math.floor(z / TILE)}|${mat}`;
    let k = buckets.get(key);
    if (!k) {
      k = { b: new MeshBuilder({ uv: true, splat: mat === 'ground' }), bld: [] };
      k.b.ao = 0;
      buckets.set(key, k);
    }
    return k;
  };
  buildGround(layout, B);
  for (const b of layout.surface.buildings) buildBuilding(b, B);

  // Luz horneada (farolas y fuegos de la superficie) y mallas
  const out = new Float32Array(6);
  let vertices = 0;
  let triangles = 0;
  for (const [key, k] of buckets) {
    const b = k.b;
    if (b.empty) continue;
    const mat = key.split('|')[1];
    const n = b.vcount;
    const bakeCol = new Float32Array(n * 3);
    const bakeDir = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = i * 3;
      field.sample(b.pos[p], b.pos[p + 1] + 0.05, b.pos[p + 2], b.nor[p], b.nor[p + 1], b.nor[p + 2], true, out);
      bakeCol[p] = out[0];
      bakeCol[p + 1] = out[1];
      bakeCol[p + 2] = out[2];
      bakeDir[p] = out[3];
      bakeDir[p + 1] = out[4];
      bakeDir[p + 2] = out[5];
    }
    const g = b.toGeometry();
    g.setAttribute('bakeCol', new THREE.BufferAttribute(bakeCol, 3));
    g.setAttribute('bakeDir', new THREE.BufferAttribute(bakeDir, 3));
    if (mat !== 'ground') {
      const bld = new Float32Array(n * 4);
      for (let i = 0; i < n * 4; i++) bld[i] = k.bld[i] ?? 0;
      g.setAttribute('bld', new THREE.BufferAttribute(bld, 4));
      // El corte mueve vértices: amplía la esfera para no descartar de más
      g.computeBoundingSphere();
      g.boundingSphere!.radius += 2;
    }
    const mesh = new THREE.Mesh(g, mats[mat]);
    mesh.name = 'sup:' + key;
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    mesh.castShadow = mat !== 'ground';
    group.add(mesh);
    vertices += n;
    triangles += b.icount / 3;
  }
  return { group, stats: { vertices, triangles } };
}

// ---------------------------------------------------------------------------
// Suelo
// ---------------------------------------------------------------------------

function buildGround(layout: Layout, B: (x: number, z: number, mat: string) => Bucket) {
  const { sdf, owner, regions } = layout;
  const sb = layout.surface.bounds;
  const isSurf = (k: number) => regions[owner[k]]?.kind === 'surface';
  const kindAt = (x: number, z: number): SOpen['kind'] | null => {
    let best: SOpen | null = null;
    for (const o of layout.surface.open) {
      if (!inBox(o.box, x, z, 1)) continue;
      // Las calles mandan sobre las manzanas
      if (!best || rank(o.kind) > rank(best.kind)) best = o;
    }
    return best?.kind ?? null;
  };
  const nx = Math.ceil((sb.x1 - sb.x0) / CELL);
  const nz = Math.ceil((sb.z1 - sb.z0) / CELL);
  const ids = new Map<string, Map<number, number>>();
  const vert = (bk: Bucket, key: string, gi: number, gj: number): number => {
    let vm = ids.get(key);
    if (!vm) ids.set(key, (vm = new Map()));
    const k = gj * (nx + 1) + gi;
    let id = vm.get(k);
    if (id !== undefined) return id;
    const x = sb.x0 + gi * CELL;
    const z = sb.z0 + gj * CELL;
    const d = sdf.sample(x, z);
    const b = bk.b;
    const tone = 0.9 + noise2(x * 0.03, z * 0.03, 5) * 0.2;
    b.color([tone, tone, tone], lerp(0.72, 1, smoothstep(0, 3, -d)));
    id = b.v(x, surfaceGroundY(layout, x, z), z, 0, 1, 0, x / 4, z / 4);
    // Mezcla: asfalto en calles, nieve en patios y plazas (y amontonada junto a los muros), barro en fábricas y ruinas
    const kind = kindAt(x, z);
    let wa = kind === 'avenida' || kind === 'calle' ? 1 : kind === 'plaza' || kind === 'pabellon' || kind === 'boca' ? 0.45 : 0;
    let wd = kind === 'fabrica' || kind === 'via' || kind === 'ruina' ? 0.75 : 0.08;
    let ws = 1 - wa;
    const n = fbm2(x * 0.06, z * 0.06, 3, 91);
    // Huellas de neumáticos y pisadas: el asfalto asoma en el centro de las calles
    const drift = smoothstep(2.6, 0.2, -d) * 0.9 + smoothstep(0.62, 0.8, n) * 0.5;
    ws += drift;
    wa *= 1 - clamp01(drift * 0.8);
    wd *= 1 - clamp01(drift * 0.5);
    const s = b.splat!;
    s[id * 4] = wa;
    s[id * 4 + 1] = ws;
    s[id * 4 + 2] = wd;
    s[id * 4 + 3] = d;
    vm.set(k, id);
    return id;
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = sb.x0 + (i + 0.5) * CELL;
      const z = sb.z0 + (j + 0.5) * CELL;
      const gi = Math.round((x - sdf.ox) / sdf.cell);
      const gj = Math.round((z - sdf.oz) / sdf.cell);
      if (gi < 0 || gj < 0 || gi >= sdf.w || gj >= sdf.h) continue;
      const k = gj * sdf.w + gi;
      // Solo celdas de la superficie con suelo cerca
      if (!isSurf(k) || sdf.sample(x, z) > 1.6) continue;
      const key = `${Math.floor(x / TILE)},${Math.floor(z / TILE)}`;
      const bk = B(x, z, 'ground');
      const a = vert(bk, key, i, j);
      const b1 = vert(bk, key, i + 1, j);
      const c = vert(bk, key, i + 1, j + 1);
      const d = vert(bk, key, i, j + 1);
      if ((i + j) & 1) bk.b.tri(a, d, c).tri(a, c, b1);
      else bk.b.tri(a, d, b1).tri(b1, d, c);
    }
  }
}

function rank(k: SOpen['kind']): number {
  return k === 'pabellon' || k === 'boca' ? 4 : k === 'avenida' ? 3 : k === 'calle' ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Edificios
// ---------------------------------------------------------------------------

const PANEL_TINTS = [0xd8d2c4, 0xc9cfd2, 0xd9c6b4, 0xbcc8c2, 0xd2c7cf, 0xcfc0a2];
const STUCCO_TINTS = [0xffffff, 0xf2e6cf, 0xe8f0e6];

function styleMat(b: SBuilding): { wall: string; tint: RGB; uScale: number } {
  const rng = new Rng(b.seed);
  switch (b.style) {
    case 'panel':
      return { wall: 'panel', tint: lin(rng.pick(PANEL_TINTS)), uScale: 6 };
    case 'ladrillo':
      return { wall: 'brick', tint: scalec([1, 1, 1], rng.range(0.85, 1.05)), uScale: 6 };
    case 'estalinista':
    case 'terminal':
      return { wall: 'stucco', tint: lin(rng.pick(STUCCO_TINTS)), uScale: 6 };
    case 'nave':
      return { wall: 'brick', tint: [0.78, 0.72, 0.68], uScale: 9 };
    case 'pabellon':
      return { wall: 'stucco', tint: lin(0xe8e2d6), uScale: 6 };
    default:
      return { wall: 'concrete', tint: [0.8, 0.79, 0.76], uScale: 4 };
  }
}

function buildBuilding(b: SBuilding, B: (x: number, z: number, mat: string) => Bucket) {
  const box = b.box;
  const rng = new Rng(b.seed * 13 + 7);
  const sm = styleMat(b);
  const c = Math.cos(box.rot);
  const s = Math.sin(box.rot);
  const W = (u: number, v: number): [number, number] => [box.cx + c * u - s * v, box.cz + s * u + c * v];
  const H = b.floors * b.floorH + (b.style === 'nave' ? 1.5 : 0.6);
  const y0 = SURFACE_Y - 0.7;
  const radius = Math.hypot(box.hl, box.hw);
  const stub = SURFACE_Y + Math.min(2.8, H);
  const wallB = B(box.cx, box.cz, sm.wall);
  const roofB = B(box.cx, box.cz, 'roof');
  const tag = (k: Bucket, from: number, st = stub) => {
    for (let i = from; i < k.b.vcount; i++) k.bld.push(box.cx, box.cz, radius, st);
  };
  if (b.hollow) {
    buildHollow(b, W, H, y0, wallB, roofB, sm, tag);
    return;
  }
  // Tramos a lo largo del eje largo con su propia altura: los derrumbes muerden la silueta
  const along = box.hl >= box.hw;
  const L = along ? box.hl : box.hw;
  const n = Math.max(1, Math.round((L * 2) / 3.2));
  const heights: number[] = [];
  const centre = rng.range(-1, 1);
  const spread = rng.range(0.25, 0.6);
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n) * 2 - 1;
    const bite = b.damage * Math.exp(-((t - centre) * (t - centre)) / (spread * spread));
    const floorsLost = Math.floor(bite * b.floors * rng.range(0.8, 1.15) + (b.damage > 0.3 && rng.chance(b.damage * 0.25) ? 1 : 0));
    let h = Math.max(b.floorH * 0.6, H - floorsLost * b.floorH);
    if (b.style === 'terminal' && Math.abs(t) < 0.1) h = H + 13;
    heights.push(h);
  }
  const P = (k: number, side: number): [number, number] => {
    // k: borde de tramo 0..n a lo largo; side: −1/+1 a lo ancho
    const a = -L + (2 * L * k) / n;
    return along ? W(a, side * box.hw) : W(side * box.hl, a);
  };
  const wb = wallB.b;
  const rb = roofB.b;
  const fw = wallB.b.vcount;
  const fr = roofB.b.vcount;
  const tint = sm.tint;
  const floorH = b.floorH;
  const vOf = (y: number) => (y - SURFACE_Y) / (2 * floorH);
  const face = (pa: [number, number], pb: [number, number], ya: number, yb: number, ua: number, ub: number, nx: number, nz: number) => {
    // Cara vertical de pa a pb entre y0 y la altura de cada extremo
    const k = 0.85 + rng.range(-0.04, 0.04);
    wb.color(tint, k * 0.8);
    const i0 = wb.v(pa[0], y0, pa[1], nx, 0, nz, ua, vOf(y0));
    const i1 = wb.v(pb[0], y0, pb[1], nx, 0, nz, ub, vOf(y0));
    wb.color(tint, k);
    const i2 = wb.v(pb[0], yb, pb[1], nx, 0, nz, ub, vOf(yb));
    const i3 = wb.v(pa[0], ya, pa[1], nx, 0, nz, ua, vOf(ya));
    // De frente si pb queda a la derecha de pa vista desde fuera
    if ((pb[0] - pa[0]) * nz - (pb[1] - pa[1]) * nx > 0) wb.quadIdx(i0, i1, i2, i3);
    else wb.quadIdx(i3, i2, i1, i0);
  };
  // Normales de los lados en el mundo
  const nL = along ? [-s, c] : [c, s]; // lado +ancho
  for (let i = 0; i < n; i++) {
    const h = SURFACE_Y + heights[i];
    const a0 = (2 * L * i) / n;
    const a1 = (2 * L * (i + 1)) / n;
    // Fachadas largas (+ y −)
    face(P(i + 1, 1), P(i, 1), h, h, -a1 / sm.uScale, -a0 / sm.uScale, nL[0], nL[1]);
    face(P(i, -1), P(i + 1, -1), h, h, a0 / sm.uScale, a1 / sm.uScale, -nL[0], -nL[1]);
    // Azotea del tramo
    const q = [P(i, -1), P(i + 1, -1), P(i + 1, 1), P(i, 1)];
    rb.color([1, 1, 1], 0.95);
    const r0 = rb.v(q[0][0], h, q[0][1], 0, 1, 0, q[0][0] / 6, q[0][1] / 6);
    const r1 = rb.v(q[1][0], h, q[1][1], 0, 1, 0, q[1][0] / 6, q[1][1] / 6);
    const r2 = rb.v(q[2][0], h, q[2][1], 0, 1, 0, q[2][0] / 6, q[2][1] / 6);
    const r3 = rb.v(q[3][0], h, q[3][1], 0, 1, 0, q[3][0] / 6, q[3][1] / 6);
    // Orientación hacia arriba
    const ux = q[1][0] - q[0][0];
    const uz = q[1][1] - q[0][1];
    const vx = q[3][0] - q[0][0];
    const vz = q[3][1] - q[0][1];
    if (uz * vx - ux * vz >= 0) rb.quadIdx(r0, r1, r2, r3);
    else rb.quadIdx(r3, r2, r1, r0);
    // Escalón entre tramos de distinta altura
    if (i < n - 1 && Math.abs(heights[i + 1] - heights[i]) > 0.1) {
      const hi = Math.max(heights[i], heights[i + 1]);
      const lo = Math.min(heights[i], heights[i + 1]);
      const dir = heights[i] > heights[i + 1] ? 1 : -1;
      const pa = P(i + 1, -1);
      const pb = P(i + 1, 1);
      const tn = along ? [c * dir, s * dir] : [-s * dir, c * dir];
      const k = 0.7;
      wb.color(tint, k);
      const e0 = wb.v(pa[0], SURFACE_Y + lo, pa[1], tn[0], 0, tn[1], 0, vOf(SURFACE_Y + lo));
      const e1 = wb.v(pb[0], SURFACE_Y + lo, pb[1], tn[0], 0, tn[1], (box.hw * 2) / sm.uScale, vOf(SURFACE_Y + lo));
      const e2 = wb.v(pb[0], SURFACE_Y + hi, pb[1], tn[0], 0, tn[1], (box.hw * 2) / sm.uScale, vOf(SURFACE_Y + hi));
      const e3 = wb.v(pa[0], SURFACE_Y + hi, pa[1], tn[0], 0, tn[1], 0, vOf(SURFACE_Y + hi));
      const fx = (pb[0] - pa[0]) * 0 + tn[0];
      void fx;
      // El escalón mira hacia el tramo bajo
      const cross = (pb[0] - pa[0]) * tn[1] - (pb[1] - pa[1]) * tn[0];
      if (cross > 0) wb.quadIdx(e0, e1, e2, e3);
      else wb.quadIdx(e3, e2, e1, e0);
    }
  }
  // Testeros
  const hA = SURFACE_Y + heights[0];
  const hB = SURFACE_Y + heights[n - 1];
  const tw = (2 * (along ? box.hw : box.hl)) / sm.uScale;
  const eA = along ? [-c, -s] : [s, -c];
  face(P(0, 1), P(0, -1), hA, hA, 0, tw, eA[0], eA[1]);
  face(P(n, -1), P(n, 1), hB, hB, 0, tw, -eA[0], -eA[1]);
  tag(wallB, fw);
  tag(roofB, fr);
  void clamp;
  void hash2;
}

/** Pabellón hueco: muros con sus puertas y una cubierta que desaparece al acercarse. */
function buildHollow(
  b: SBuilding,
  W: (u: number, v: number) => [number, number],
  H: number,
  y0: number,
  wallB: Bucket,
  roofB: Bucket,
  sm: { wall: string; tint: RGB; uScale: number },
  tag: (k: Bucket, from: number, st?: number) => void,
) {
  const box: SBox = b.box;
  const t = b.hollow!.wall;
  const wb = wallB.b;
  const fw = wb.vcount;
  const top = SURFACE_Y + H;
  const c = Math.cos(box.rot);
  const s = Math.sin(box.rot);
  const slab = (u0: number, u1: number, v0: number, v1: number) => {
    // Caja de muro en coordenadas locales
    const pts = [W(u0, v0), W(u1, v0), W(u1, v1), W(u0, v1)];
    const faces: [number, number, number, number][] = [
      [0, 1, 0, -1],
      [1, 2, 1, 0],
      [2, 3, 0, 1],
      [3, 0, -1, 0],
    ];
    for (const [a, bb, lu, lv] of faces) {
      const nx = c * lu - s * lv;
      const nz = s * lu + c * lv;
      const pa = pts[a];
      const pb = pts[bb];
      const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      wb.color(sm.tint, 0.75);
      const i0 = wb.v(pa[0], y0, pa[1], nx, 0, nz, 0, 0);
      const i1 = wb.v(pb[0], y0, pb[1], nx, 0, nz, len / sm.uScale, 0);
      wb.color(sm.tint, 0.92);
      const i2 = wb.v(pb[0], top, pb[1], nx, 0, nz, len / sm.uScale, (top - SURFACE_Y) / 6);
      const i3 = wb.v(pa[0], top, pa[1], nx, 0, nz, 0, (top - SURFACE_Y) / 6);
      const cross = (pb[0] - pa[0]) * nz - (pb[1] - pa[1]) * nx;
      if (cross > 0) wb.quadIdx(i0, i1, i2, i3);
      else wb.quadIdx(i3, i2, i1, i0);
    }
    // Remate
    wb.color([0.3, 0.3, 0.32]);
    const r = pts.map((p) => wb.v(p[0], top, p[1], 0, 1, 0, 0, 0));
    const ux = pts[1][0] - pts[0][0];
    const uz = pts[1][1] - pts[0][1];
    const vx = pts[3][0] - pts[0][0];
    const vz = pts[3][1] - pts[0][1];
    if (uz * vx - ux * vz >= 0) wb.quadIdx(r[0], r[1], r[2], r[3]);
    else wb.quadIdx(r[3], r[2], r[1], r[0]);
  };
  const sides: { side: 'u+' | 'u-' | 'v+' | 'v-'; len: number }[] = [
    { side: 'u+', len: box.hw },
    { side: 'u-', len: box.hw },
    { side: 'v+', len: box.hl },
    { side: 'v-', len: box.hl },
  ];
  for (const sd of sides) {
    const doors = b.hollow!.doors.filter((d) => d.side === sd.side).map((d) => [d.at - d.w / 2, d.at + d.w / 2] as [number, number]);
    doors.sort((p, q) => p[0] - q[0]);
    let cur = -sd.len;
    const cuts: [number, number][] = [];
    for (const [d0, d1] of doors) {
      if (d0 > cur) cuts.push([cur, d0]);
      cur = Math.max(cur, d1);
    }
    if (cur < sd.len) cuts.push([cur, sd.len]);
    for (const [a0, a1] of cuts) {
      if (a1 - a0 < 0.3) continue;
      if (sd.side === 'u+') slab(box.hl - t, box.hl, a0, a1);
      else if (sd.side === 'u-') slab(-box.hl, -box.hl + t, a0, a1);
      else if (sd.side === 'v+') slab(a0, a1, box.hw - t, box.hw);
      else slab(a0, a1, -box.hw, -box.hw + t);
    }
    // Dintel sobre cada puerta
    for (const [d0, d1] of doors) {
      const lintel = (u0: number, u1: number, v0: number, v1: number) => {
        const pts = [W(u0, v0), W(u1, v0), W(u1, v1), W(u0, v1)];
        wb.color(sm.tint, 0.85);
        const yA = SURFACE_Y + 3.2;
        const ids = pts.map((p) => wb.v(p[0], yA, p[1], 0, -1, 0, 0, 0));
        wb.quadIdx(ids[3], ids[2], ids[1], ids[0]);
        const idt = pts.map((p) => wb.v(p[0], top, p[1], 0, 1, 0, 0, 0));
        wb.quadIdx(idt[0], idt[1], idt[2], idt[3]);
      };
      if (sd.side === 'u+') lintel(box.hl - t, box.hl, d0, d1);
      else if (sd.side === 'u-') lintel(-box.hl, -box.hl + t, d0, d1);
      else if (sd.side === 'v+') lintel(d0, d1, box.hw - t, box.hw);
      else lintel(d0, d1, -box.hw, -box.hw + t);
    }
  }
  tag(wallB, fw);
  // Cubierta: se hunde bajo el suelo cuando la cámara se acerca, para ver el interior
  const rb = roofB.b;
  const fr = rb.vcount;
  const q = [W(-box.hl, -box.hw), W(box.hl, -box.hw), W(box.hl, box.hw), W(-box.hl, box.hw)];
  rb.color([1, 1, 1], 0.9);
  const ids = q.map((p) => rb.v(p[0], top + 0.02, p[1], 0, 1, 0, p[0] / 6, p[1] / 6));
  const ux = q[1][0] - q[0][0];
  const uz = q[1][1] - q[0][1];
  const vx = q[3][0] - q[0][0];
  const vz = q[3][1] - q[0][1];
  if (uz * vx - ux * vz >= 0) rb.quadIdx(ids[0], ids[1], ids[2], ids[3]);
  else rb.quadIdx(ids[3], ids[2], ids[1], ids[0]);
  tag(roofB, fr, SURFACE_Y - 2);
}
