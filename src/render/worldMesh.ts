// Geometría estática del metro: suelos, muros con corte, andenes, rampas,
// pasarelas y vías. Todo se trocea en baldosas de 64 m para el descarte por
// cámara y lleva la luz horneada en los vértices.

import * as THREE from 'three';
import { FACTION_LORE } from '../data/historia/facciones';
import type { Terrain } from '../data/tipos';
import { clamp, clamp01, hash2, lerp, noise2, smoothstep, type V2 } from '../core/math';
import type { Layout, LRect, Ramp, Region, StationFrame } from '../world/layout';
import { stationToLocal, stationToWorld } from '../world/layout';
import type { LightField } from '../world/lights';
import { PLATFORM_H } from '../world/plans';
import { MeshBuilder, lin, mixc, scalec, type RGB } from './geo';
import { annexCells, annexFloorKind, annexWallKind, annexYAt, buildAnnexStairs, ridgeDepth, type AnnexWallKind } from './annexMesh';
import { annexAt, stationToLocal as toLocal } from '../world/layout';
import { annexFloorAt, type Annex } from '../world/arch';
import { floorMaterial, solidMaterial, worldMaterial } from './materials';
import type { TextureSet } from './textures';

const TILE = 64;
const FLOOR_CLIP = 0.92;

// ---------------------------------------------------------------------------
// Aspecto de cada estación
// ---------------------------------------------------------------------------

type WallKind = 'tiles' | 'marble' | 'concrete' | 'brick';
type FloorKind = 'tiles' | 'marble' | 'concrete';

interface StationLook {
  wall: WallKind;
  wallTint: number;
  floor: FloorKind;
  floorTint: number;
  /** Altura del muro de la nave. */
  height: number;
}

const LOOKS: Record<string, StationLook> = {
  SEV: { wall: 'concrete', wallTint: 0xc9d4dc, floor: 'concrete', floorTint: 0xd0d6dc, height: 5.0 },
  UBE: { wall: 'tiles', wallTint: 0xf2f4ee, floor: 'tiles', floorTint: 0xe6e2d8, height: 4.8 },
  IND: { wall: 'brick', wallTint: 0xb0a090, floor: 'concrete', floorTint: 0xa8a39a, height: 5.4 },
  RUB: { wall: 'concrete', wallTint: 0xb9b9ad, floor: 'concrete', floorTint: 0xb4b2a8, height: 4.6 },
  KHO: { wall: 'marble', wallTint: 0xc8d0d2, floor: 'tiles', floorTint: 0xcfd6d6, height: 5.4 },
  STA: { wall: 'brick', wallTint: 0xd8c4ae, floor: 'tiles', floorTint: 0xe4d8c4, height: 5.0 },
  TSE: { wall: 'marble', wallTint: 0xf0e6d2, floor: 'marble', floorTint: 0xe8dcc8, height: 5.6 },
  TEN: { wall: 'tiles', wallTint: 0x9aa39c, floor: 'tiles', floorTint: 0x8c8c86, height: 4.6 },
  VHL: { wall: 'concrete', wallTint: 0x9c8f80, floor: 'concrete', floorTint: 0x9a9084, height: 4.4 },
  RAS: { wall: 'tiles', wallTint: 0xe8dcc0, floor: 'concrete', floorTint: 0xc4b8a4, height: 4.6 },
  STL: { wall: 'marble', wallTint: 0xe6d2c4, floor: 'tiles', floorTint: 0xdccdc0, height: 5.2 },
  VYS: { wall: 'concrete', wallTint: 0xb8aea2, floor: 'concrete', floorTint: 0xb2aaa0, height: 4.6 },
  MER: { wall: 'tiles', wallTint: 0x58c79a, floor: 'tiles', floorTint: 0xb9d6c6, height: 4.6 },
  ZVE: { wall: 'marble', wallTint: 0xe4e2ea, floor: 'tiles', floorTint: 0xd8d8e0, height: 5.2 },
  MOS: { wall: 'concrete', wallTint: 0xaab0b6, floor: 'concrete', floorTint: 0xaeb2b6, height: 4.8 },
  CHE: { wall: 'concrete', wallTint: 0xa69ead, floor: 'concrete', floorTint: 0xa8a2aa, height: 4.6 },
};

const LINE_COLORS: Record<string, number> = { verde: 0x2f7a35, roja: 0xa02828, azul: 0x2a4f9c };

// ---------------------------------------------------------------------------
// Perfiles de muro
// ---------------------------------------------------------------------------

interface PP {
  d: number;
  y: number;
  c: RGB;
}
interface WallStyle {
  mat: string;
  strips: PP[][];
  uScale: number;
  vScale: number;
  stub: number;
}

const CAP: RGB = [0.022, 0.021, 0.024];
const WHITE: RGB = [1, 1, 1];

function vertWall(H: number, thick: number, base: RGB, dado: RGB | null, dadoH: number, trim: RGB | null = null): PP[][] {
  const strips: PP[][] = [];
  const grime = scalec(dado ?? base, 0.62);
  if (dado) {
    strips.push([
      { d: 0, y: 0, c: grime },
      { d: 0, y: 0.35, c: scalec(dado, 0.9) },
      { d: 0, y: dadoH, c: dado },
    ]);
    if (trim) {
      strips.push([
        { d: 0, y: dadoH, c: trim },
        { d: 0, y: dadoH + 0.09, c: trim },
      ]);
      dadoH += 0.09;
    }
    strips.push([
      { d: 0, y: dadoH, c: base },
      { d: 0, y: lerp(dadoH, H, 0.55), c: base },
      { d: 0, y: H, c: scalec(base, 0.8) },
    ]);
  } else {
    strips.push([
      { d: 0, y: 0, c: scalec(base, 0.6) },
      { d: 0, y: 0.5, c: scalec(base, 0.92) },
      { d: 0, y: H * 0.55, c: base },
      { d: 0, y: H, c: scalec(base, 0.8) },
    ]);
  }
  strips.push([
    { d: 0, y: H, c: CAP },
    { d: thick, y: H, c: CAP },
  ]);
  strips.push([
    { d: thick, y: H, c: scalec(CAP, 0.8) },
    { d: thick, y: 0, c: scalec(CAP, 0.5) },
  ]);
  return strips;
}

function tubeWall(R: number, cy: number, H: number, thick: number, base: RGB): PP[][] {
  const inner: PP[] = [];
  const d0 = Math.sqrt(Math.max(0, R * R - cy * cy));
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const y = (H * i) / n;
    const d = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy))) - d0;
    const k = i === 0 ? 0.55 : i === 1 ? 0.85 : i === n ? 0.8 : 1;
    inner.push({ d, y, c: scalec(base, k) });
  }
  const dTop = inner[n].d;
  return [
    inner,
    [
      { d: dTop, y: H, c: CAP },
      { d: dTop + thick, y: H, c: CAP },
    ],
    [
      { d: dTop + thick, y: H, c: scalec(CAP, 0.8) },
      { d: dTop + thick, y: 0, c: scalec(CAP, 0.5) },
    ],
  ];
}

function caveWall(H: number, base: RGB): PP[][] {
  return [
    [
      { d: 0, y: 0, c: scalec(base, 0.55) },
      { d: 0.35, y: 0.7, c: scalec(base, 0.9) },
      { d: 0.25, y: 1.6, c: base },
      { d: 0.6, y: 2.5, c: base },
      { d: 0.45, y: H, c: scalec(base, 0.75) },
    ],
    [
      { d: 0.45, y: H, c: CAP },
      { d: 1.9, y: H, c: CAP },
    ],
    [
      { d: 1.9, y: H, c: scalec(CAP, 0.8) },
      { d: 1.9, y: 0, c: scalec(CAP, 0.5) },
    ],
  ];
}

const facLin = (id: string | null): RGB => (id ? lin(parseInt(FACTION_LORE[id as keyof typeof FACTION_LORE].color.slice(1), 16)) : [0.2, 0.2, 0.2]);

function buildWallStyles(layout: Layout): WallStyle[] {
  const styles: WallStyle[] = [];
  for (const reg of layout.regions) {
    let st: WallStyle;
    if (reg.kind === 'station') {
      const f = layout.stationById[reg.ref];
      const look = LOOKS[f.id];
      const base = lin(look.wallTint);
      const dado = scalec(mixc(facLin(f.def.owner), [0.12, 0.12, 0.12], 0.45), look.wall === 'brick' ? 1.4 : 0.9);
      const mat = look.wall === 'tiles' ? 'w_tiles' : look.wall === 'marble' ? 'w_marble' : look.wall === 'brick' ? 'w_brick' : 'w_concrete';
      const strips = vertWall(look.height, 1.1, base, f.def.owner ? dado : scalec(base, 0.5), 1.25, look.wall === 'concrete' ? null : scalec(base, 0.55));
      st = { mat, strips, uScale: look.wall === 'marble' ? 2.4 : look.wall === 'tiles' ? 1.2 : look.wall === 'brick' ? 1.0 : 4, vScale: look.wall === 'marble' ? 2.4 : look.wall === 'tiles' ? 1.2 : look.wall === 'brick' ? 1.0 : 4, stub: 0.45 };
    } else if (reg.kind === 'node') {
      const n = layout.nodeById[reg.ref];
      if (!n) {
        st = { mat: 'w_rock', strips: caveWall(3.4, WHITE), uScale: 3, vScale: 3, stub: 0.45 };
      } else {
        const theme = n.room.theme;
        if (theme === 'cueva' || theme === 'nido' || theme === 'inundado' || theme === 'derrumbe') st = { mat: 'w_rock', strips: caveWall(3.6, [0.95, 0.92, 0.88]), uScale: 3, vScale: 3, stub: 0.5 };
        else if (theme === 'anden') st = { mat: 'w_tiles', strips: vertWall(4.2, 1.0, lin(0x9aa39c), lin(0x4c5650), 1.25, lin(0x5a5f5a)), uScale: 1.2, vScale: 1.2, stub: 0.45 };
        else if (theme === 'tuberias' || theme === 'nicho') st = { mat: 'w_brick', strips: vertWall(3.4, 0.9, [0.9, 0.86, 0.8], null, 0), uScale: 1, vScale: 1, stub: 0.45 };
        else st = { mat: 'w_concrete', strips: vertWall(4.0, 1.0, [0.92, 0.9, 0.86], lin(0x4a5148), 1.2), uScale: 4, vScale: 4, stub: 0.45 };
      }
    } else {
      const link = layout.links[Number(reg.ref)];
      const t = link.terrain as Terrain;
      if (t === 'linea') {
        const lc = lin(LINE_COLORS[link.def.line ?? 'azul'] ?? 0x555555);
        st = { mat: 'w_concrete', strips: vertWall(4.3, 1.0, [0.9, 0.88, 0.84], scalec(lc, 0.75), 1.15, [0.75, 0.73, 0.68]), uScale: 4, vScale: 4, stub: 0.45 };
      } else if (t === 'tunel') st = { mat: 'w_tubbing', strips: tubeWall(3.15, 2.05, 3.7, 1.0, [1, 0.98, 0.95]), uScale: 2, vScale: 2, stub: 0.45 };
      else if (t === 'peligroso' || t === 'derrumbe') st = { mat: 'w_tubbing', strips: tubeWall(3.3, 2.1, 3.6, 1.2, [0.72, 0.7, 0.66]), uScale: 2, vScale: 2, stub: 0.5 };
      else if (t === 'auxiliar') st = { mat: 'w_concrete', strips: vertWall(3.3, 0.8, [0.82, 0.8, 0.77], lin(0x39413a), 1.0), uScale: 4, vScale: 4, stub: 0.45 };
      else if (t === 'auxiliarPeligroso') st = { mat: 'w_brick', strips: vertWall(3.2, 0.9, [0.62, 0.6, 0.58], null, 0), uScale: 1, vScale: 1, stub: 0.45 };
      else st = { mat: 'w_brick', strips: vertWall(2.9, 0.7, [0.85, 0.8, 0.76], null, 0), uScale: 1, vScale: 1, stub: 0.45 };
    }
    styles[reg.id] = st;
  }
  return styles;
}

/** Muro de una sala aneja según su uso (los de «station» repiten el de la nave). */
function annexStyle(f: StationFrame, kind: AnnexWallKind, hall: WallStyle): WallStyle {
  const look = LOOKS[f.id];
  const H = look.height - 0.4;
  const dado = scalec(mixc(facLin(f.def.owner), [0.12, 0.12, 0.12], 0.45), 0.9);
  const P = PLATFORM_H;
  switch (kind) {
    case 'tiles':
      return { mat: 'w_tiles', strips: vertWall(H, 1.0, [0.95, 0.96, 0.93], lin(0x6f8a86), 1.4 + P, lin(0x4f5f5c)), uScale: 1.2, vScale: 1.2, stub: 0.45 };
    case 'green':
      return { mat: 'w_tiles', strips: vertWall(H, 1.0, lin(0x6fcfa6), lin(0x2c6a52), 1.3 + P, lin(0xd8c890)), uScale: 1.2, vScale: 1.2, stub: 0.45 };
    case 'concrete':
      return { mat: 'w_concrete', strips: vertWall(H, 1.0, [0.82, 0.8, 0.76], scalec(dado, 0.8), 1.2 + P), uScale: 4, vScale: 4, stub: 0.45 };
    case 'brick':
      return { mat: 'w_brick', strips: vertWall(H, 1.0, [0.9, 0.82, 0.74], null, 0), uScale: 1, vScale: 1, stub: 0.45 };
    case 'rock':
      return { mat: 'w_rock', strips: caveWall(H, [0.9, 0.86, 0.8]), uScale: 3, vScale: 3, stub: 0.5 };
    case 'tubbing':
      return { mat: 'w_tubbing', strips: tubeWall(4.4, 2.0 + P, 4.2 + P, 1.0, [0.86, 0.84, 0.8]), uScale: 2, vScale: 2, stub: 0.45 };
    default:
      return hall;
  }
}

// ---------------------------------------------------------------------------
// Construcción
// ---------------------------------------------------------------------------

export interface WorldMesh {
  group: THREE.Group;
  materials: Record<string, THREE.Material>;
  stats: { vertices: number; triangles: number; meshes: number };
}

type Progress = (label: string, frac: number) => Promise<void> | void;

export async function buildWorldMesh(layout: Layout, field: LightField, tex: TextureSet, progress: Progress = () => {}): Promise<WorldMesh> {
  const group = new THREE.Group();
  group.name = 'mundo';
  const materials: Record<string, THREE.Material> = {
    floor: floorMaterial(tex.ballast, tex.concrete, tex.dirt, FLOOR_CLIP),
    w_tubbing: worldMaterial(tex.tubbing, { wall: true, normalScale: 1.3 }),
    w_concrete: worldMaterial(tex.concreteWall, { wall: true }),
    w_tiles: worldMaterial(tex.wallTiles, { wall: true }),
    w_marble: worldMaterial(tex.marble, { wall: true }),
    w_brick: worldMaterial(tex.brick, { wall: true, normalScale: 1.2 }),
    w_rock: worldMaterial(tex.rock, { wall: true, normalScale: 1.5 }),
    s_tiles: worldMaterial(tex.floorTiles),
    s_marble: worldMaterial(tex.marble),
    s_concrete: worldMaterial(tex.concrete),
    s_planks: worldMaterial(tex.planks),
    trackbed: worldMaterial(tex.trackBed, { alphaTest: 0.5, polygonOffset: 1 }),
    steel: solidMaterial({ metalness: 0.7, roughness: 0.42, grunge: false }),
    solid: solidMaterial({ roughness: 0.8 }),
    floorRoom: floorMaterial(tex.floorTiles, tex.concrete, tex.planks, FLOOR_CLIP),
  };
  const builders = new Map<string, MeshBuilder>();
  const B = (x: number, z: number, mat: string): MeshBuilder => {
    const key = `${Math.floor(x / TILE)},${Math.floor(z / TILE)}|${mat}`;
    let b = builders.get(key);
    if (!b) {
      b = new MeshBuilder({ uv: mat !== 'steel' && mat !== 'solid', wall: mat.startsWith('w_'), splat: mat === 'floor' || mat === 'floorRoom', fx: mat === 'steel' || mat === 'solid' });
      b.ao = 0;
      builders.set(key, b);
    }
    return b;
  };

  await progress('Suelos', 0.02);
  buildFloors(layout, B);
  await progress('Muros', 0.12);
  buildWalls(layout, B);
  await progress('Andenes', 0.22);
  for (const f of layout.stations) buildStationSlabs(layout, f, B);
  await progress('Vías', 0.3);
  buildTracks(layout, B);
  buildAnnexStairs(layout, (x, z, m) => B(x, z, m === 'steel' ? 'solid' : m));

  // Horneado de luz y creación de mallas
  const out = new Float32Array(6);
  let done = 0;
  let vertices = 0;
  let triangles = 0;
  const total = builders.size;
  for (const [key, b] of builders) {
    if (b.empty) continue;
    const mat = key.split('|')[1];
    const n = b.vcount;
    const bakeCol = new Float32Array(n * 3);
    const bakeDir = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = i * 3;
      field.sample(b.pos[p], b.pos[p + 1] + 0.02, b.pos[p + 2], b.nor[p], b.nor[p + 1], b.nor[p + 2], true, out);
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
    const mesh = new THREE.Mesh(g, materials[mat]);
    mesh.name = key;
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    mesh.castShadow = mat.startsWith('w_') || mat.startsWith('s_');
    if (mat.startsWith('w_')) {
      // El corte de muros mueve vértices: amplía la esfera para no descartar de más
      g.boundingSphere!.radius += 1;
    }
    group.add(mesh);
    vertices += n;
    triangles += b.icount / 3;
    done++;
    if (done % 12 === 0) await progress('Luz', 0.32 + 0.6 * (done / total));
  }
  builders.clear();
  return { group, materials, stats: { vertices, triangles, meshes: group.children.length } };
}

// --- Suelos ------------------------------------------------------------------

function buildFloors(layout: Layout, B: (x: number, z: number, mat: string) => MeshBuilder) {
  const { sdf, owner, regions } = layout;
  const { w, h, data, ox, oz } = sdf;
  // Peso de balasto alrededor de las vías
  const ballast = new Float32Array(w * h);
  const stampTrack = (line: V2[]) => {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1];
      const b = line[i];
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.7));
      for (let s = 0; s <= steps; s++) {
        const x = lerp(a.x, b.x, s / steps);
        const z = lerp(a.z, b.z, s / steps);
        const ci = Math.round(x - ox);
        const cj = Math.round(z - oz);
        for (let dj = -3; dj <= 3; dj++) {
          for (let di = -3; di <= 3; di++) {
            const gi = ci + di;
            const gj = cj + dj;
            if (gi < 0 || gj < 0 || gi >= w || gj >= h) continue;
            const d = Math.hypot(ox + gi - x, oz + gj - z);
            const v = 1 - smoothstep(1.25, 2.3, d);
            const k = gj * w + gi;
            if (v > ballast[k]) ballast[k] = v;
          }
        }
      }
    }
  };
  for (const l of layout.links) for (const t of l.tracks) stampTrack(t);
  for (const f of layout.stations) for (const t of f.tracks) stampTrack(t);
  // Suciedad por región
  const dirtOf = (reg: Region): number => {
    if (reg.kind === 'station') return reg.ref === 'TEN' ? 0.35 : reg.ref === 'VHL' ? 0.3 : 0.04;
    if (reg.kind === 'node') {
      const th = layout.nodeById[reg.ref]?.room.theme;
      return th === 'cueva' || th === 'nido' || th === 'inundado' || th === 'derrumbe' ? 1 : th === 'anden' ? 0.4 : 0.08;
    }
    const t = reg.terrain;
    return t === 'peligroso' ? 0.75 : t === 'auxiliarPeligroso' ? 0.8 : t === 'derrumbe' ? 0.9 : t === 'tunel' ? 0.16 : 0.03;
  };
  const dirtReg = regions.map(dirtOf);
  // Zonas cubiertas por andenes (no se dibuja suelo debajo)
  const covered = (x: number, z: number): boolean => {
    for (const f of layout.stations) {
      if (Math.abs(x - f.x) > f.hl + f.hw || Math.abs(z - f.z) > f.hl + f.hw) continue;
      const [u, v] = stationToLocal(f, x, z);
      for (const r of f.platforms) if (u > r.u0 + 1.5 && u < r.u1 - 1.5 && v > r.v0 + 1.5 && v < r.v1 - 1.5) return true;
      for (const r of f.heads) if (u > r.u0 + 1.5 && u < r.u1 - 1.5 && v > r.v0 + 1.5 && v < r.v1 - 1.5) return true;
    }
    return false;
  };
  // Salas anejas: suelo propio y a su altura
  const rooms = annexCells(layout);
  let cellRoom = -1;
  const vmaps = new Map<MeshBuilder, Map<number, number>>();
  const vert = (b: MeshBuilder, gi: number, gj: number): number => {
    let vm = vmaps.get(b);
    if (!vm) vmaps.set(b, (vm = new Map()));
    const k = gj * w + gi;
    let id = vm.get(k);
    if (id !== undefined) return id;
    const x = ox + gi;
    const z = oz + gj;
    const d = data[k];
    // Color: oclusión junto a los muros y variación amplia
    const ao = lerp(0.5, 1, smoothstep(0, 2.4, -d));
    const tone = 0.86 + noise2(x * 0.045, z * 0.045, 3) * 0.28;
    b.color([tone, tone, tone * 0.98], ao);
    let y = 0;
    if (cellRoom >= 0) {
      const r = rooms.list[cellRoom];
      y = annexYAt(r.f, r.a, x, z);
      const kind = annexFloorKind(r.a.use);
      if (kind >= 0) {
        // Suelo de sala: una sola textura (baldosa, hormigón o tablones) con algo de suciedad en los bordes
        id = b.v(x, y + 0.004, z, 0, 1, 0, x / 2.4, z / 2.4);
        const s = b.splat!;
        s[id * 4] = kind === 0 ? 1 : 0;
        s[id * 4 + 1] = kind === 1 ? 1 : 0;
        s[id * 4 + 2] = kind === 2 ? 1 : 0;
        s[id * 4 + 3] = d;
        vm.set(k, id);
        return id;
      }
    }
    id = b.v(x, y, z, 0, 1, 0, x / 3, z / 3);
    // Mezcla de texturas (promedio 3x3 para suavizar los cambios de región)
    let dirt = 0;
    let cnt = 0;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const gi2 = clamp(gi + di, 0, w - 1);
        const gj2 = clamp(gj + dj, 0, h - 1);
        const k2 = gj2 * w + gi2;
        if (data[k2] < 1.5) {
          dirt += dirtReg[owner[k2]];
          cnt++;
        }
      }
    }
    dirt = cnt ? dirt / cnt : 0;
    if (dirt > 0.02) dirt = clamp01(dirt + (noise2(x * 0.19, z * 0.19, 8) - 0.5) * 0.8 * Math.min(1, dirt * 1.6));
    const bal = ballast[k] * (1 - dirt * 0.55);
    const s = b.splat!;
    s[id * 4] = bal;
    s[id * 4 + 1] = (1 - bal) * (1 - dirt);
    s[id * 4 + 2] = (1 - bal) * dirt;
    s[id * 4 + 3] = d;
    vm.set(k, id);
    return id;
  };
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const k = j * w + i;
      const m = Math.min(data[k], data[k + 1], data[k + w], data[k + w + 1]);
      if (m > FLOOR_CLIP + 0.1) continue;
      const cx = ox + i + 0.5;
      const cz = oz + j + 0.5;
      cellRoom = rooms.cell[k];
      if (cellRoom < 0 && covered(cx, cz)) continue;
      const b = B(cx, cz, cellRoom >= 0 && annexFloorKind(rooms.list[cellRoom].a.use) >= 0 ? 'floorRoom' : 'floor');
      const a = vert(b, i, j);
      const b1 = vert(b, i + 1, j);
      const c = vert(b, i + 1, j + 1);
      const d = vert(b, i, j + 1);
      // Diagonal alterna para que la luz horneada no marque una dirección
      if ((i + j) & 1) b.tri(a, d, c).tri(a, c, b1);
      else b.tri(a, d, b1).tri(b1, d, c);
    }
  }
}

// --- Muros --------------------------------------------------------------------

function buildWalls(layout: Layout, B: (x: number, z: number, mat: string) => MeshBuilder) {
  const styles = buildWallStyles(layout);
  const { nav } = layout;
  const roomStyles = new Map<string, WallStyle>();
  const roomStyle = (f: StationFrame, a: Annex): WallStyle => {
    const key = f.id + ':' + a.id;
    let st = roomStyles.get(key);
    if (!st) roomStyles.set(key, (st = annexStyle(f, annexWallKind(f, a.use), styles[f.region])));
    return st;
  };
  for (const c of layout.contours) {
    // Por vértice: estilo (el de la sala si da a una), base del muro (escaleras) y tope de la tapa
    const vStyle: WallStyle[] = new Array(c.count);
    const vBase = new Float32Array(c.count);
    const vStub = new Float32Array(c.count);
    const vRidge = new Float32Array(c.count);
    for (let i = 0; i < c.count; i++) {
      const x = c.data[i * 4];
      const z = c.data[i * 4 + 1];
      const nx = c.data[i * 4 + 2];
      const nz = c.data[i * 4 + 3];
      let st = styles[c.owner[i]] ?? styles[1];
      let base = 0;
      let stub = -1;
      const reg = layout.regions[c.owner[i]];
      if (reg?.kind === 'station') {
        const f = layout.stationById[reg.ref];
        const ix = x - nx * 0.9;
        const iz = z - nz * 0.9;
        const [u, v] = toLocal(f, ix, iz);
        const a = Math.abs(u) <= f.hl && Math.abs(v) <= f.hw ? null : annexAt(f, ix, iz, 0.4);
        if (a) {
          st = roomStyle(f, a);
          const fl = annexFloorAt(a, u, v);
          base = Math.max(0, fl - PLATFORM_H);
          stub = fl + st.stub;
        }
      }
      vStyle[i] = st;
      vBase[i] = base;
      vStub[i] = stub;
      vRidge[i] = ridgeDepth(layout, x, z, nx, nz, 4);
    }
    // Longitud acumulada para las UV
    const cum = new Float32Array(c.count + 1);
    for (let i = 0; i < c.count; i++) {
      const j = (i + 1) % c.count;
      cum[i + 1] = cum[i] + Math.hypot(c.data[j * 4] - c.data[i * 4], c.data[j * 4 + 1] - c.data[i * 4 + 1]);
    }
    for (let i = 0; i < c.count; i++) {
      const j = (i + 1) % c.count;
      const st = vStyle[i];
      const ax = c.data[i * 4];
      const az = c.data[i * 4 + 1];
      const bx = c.data[j * 4];
      const bz = c.data[j * 4 + 1];
      let anx = c.data[i * 4 + 2];
      let anz = c.data[i * 4 + 3];
      let bnx = c.data[j * 4 + 2];
      let bnz = c.data[j * 4 + 3];
      // En las esquinas vivas usa la normal del propio tramo para no deformar el perfil
      const sdx = bx - ax;
      const sdz = bz - az;
      const sl = Math.hypot(sdx, sdz) || 1;
      const snx = sdz / sl;
      const snz = -sdx / sl;
      if (anx * snx + anz * snz < 0.85) {
        anx = snx;
        anz = snz;
      }
      if (bnx * snx + bnz * snz < 0.85) {
        bnx = snx;
        bnz = snz;
      }
      const b = B((ax + bx) / 2, (az + bz) / 2, st.mat);
      // Zócalo más alto junto a los andenes
      const hA = nav.heightAt(ax - anx * 1.0, az - anz * 1.0);
      const hB = nav.heightAt(bx - bnx * 1.0, bz - bnz * 1.0);
      const stubA = vStub[i] >= 0 ? vStub[i] : st.stub + (hA > 0.6 ? PLATFORM_H : 0);
      const stubB = vStub[j] >= 0 ? vStub[j] : st.stub + (hB > 0.6 ? PLATFORM_H : 0);
      const baseA = vBase[i];
      const baseB = vBase[j];
      const rA = vRidge[i];
      const rB = vRidge[j];
      const u0 = cum[i] / st.uScale;
      const u1 = cum[i + 1] / st.uScale;
      for (const strip of st.strips) {
        let vAcc = 0;
        let prevA = -1;
        let prevB = -1;
        for (let k = 0; k < strip.length; k++) {
          const p = strip[k];
          const pp = strip[Math.max(0, k - 1)];
          const pn = strip[Math.min(strip.length - 1, k + 1)];
          const td = pn.d - pp.d;
          const ty = pn.y - pp.y;
          const tl = Math.hypot(td, ty) || 1;
          const n2x = -ty / tl;
          const n2y = td / tl;
          if (k > 0) vAcc += Math.hypot(p.d - strip[k - 1].d, p.y - strip[k - 1].y);
          const vv = vAcc / st.vScale;
          b.color(p.c);
          b.wallNormal(anx, anz, stubA);
          const dA = Math.min(p.d, rA);
          const dB = Math.min(p.d, rB);
          const ia = b.v(ax + anx * dA, p.y + baseA, az + anz * dA, anx * n2x, n2y, anz * n2x, u0, vv);
          b.wallNormal(bnx, bnz, stubB);
          const ib = b.v(bx + bnx * dB, p.y + baseB, bz + bnz * dB, bnx * n2x, n2y, bnz * n2x, u1, vv);
          if (k > 0) b.quadIdx(prevA, prevB, ib, ia);
          prevA = ia;
          prevB = ib;
        }
      }
    }
  }
}

// --- Andenes --------------------------------------------------------------------

function buildStationSlabs(layout: Layout, f: StationFrame, B: (x: number, z: number, mat: string) => MeshBuilder) {
  const look = LOOKS[f.id];
  const topMat = look.floor === 'tiles' ? 's_tiles' : look.floor === 'marble' ? 's_marble' : 's_concrete';
  const tint = lin(look.floorTint);
  const H = PLATFORM_H;
  const uvS = look.floor === 'tiles' ? 2.4 : look.floor === 'marble' ? 2.4 : 4;
  const W = (u: number, v: number) => stationToWorld(f, u, v);
  // Vector normal en el mundo a partir de componentes locales
  const N = (nu: number, nv: number): [number, number] => [f.ax * nu + f.lx * nv, f.az * nu + f.lz * nv];

  /** Cara superior teselada de un rectángulo local. */
  const top = (r: LRect, y: number, mat: string, col: RGB, cell = 2, uvScale = uvS, bandV0 = false, bandV1 = false) => {
    const nu = Math.max(1, Math.ceil((r.u1 - r.u0) / cell));
    const vs: number[] = [r.v0];
    if (bandV0) vs.push(r.v0 + 0.55);
    const inner0 = bandV0 ? r.v0 + 0.55 : r.v0;
    const inner1 = bandV1 ? r.v1 - 0.55 : r.v1;
    const nv = Math.max(1, Math.ceil((inner1 - inner0) / cell));
    for (let k = 1; k <= nv; k++) vs.push(lerp(inner0, inner1, k / nv));
    if (bandV1) vs.push(r.v1);
    const ids: number[][] = [];
    const mid = W((r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2);
    const b = B(mid.x, mid.z, mat);
    for (let i = 0; i <= nu; i++) {
      const u = lerp(r.u0, r.u1, i / nu);
      const row: number[] = [];
      for (let k = 0; k < vs.length; k++) {
        const v = vs[k];
        const p = W(u, v);
        const band = (bandV0 && k <= 1) || (bandV1 && k >= vs.length - 2);
        const tone = 0.9 + noise2(p.x * 0.07, p.z * 0.07, 5) * 0.2;
        b.color(band ? mixc(col, [0.78, 0.76, 0.7], 0.5) : col, tone);
        row.push(b.v(p.x, y, p.z, 0, 1, 0, u / uvScale, v / uvScale));
      }
      ids.push(row);
    }
    for (let i = 0; i < nu; i++) for (let k = 0; k < vs.length - 1; k++) b.quadIdx(ids[i][k], ids[i][k + 1], ids[i + 1][k + 1], ids[i + 1][k]);
  };

  /** Cara vertical entre dos puntos locales (normal local nu,nv). */
  const side = (u0: number, v0: number, u1: number, v1: number, y0: number, y1: number, nu: number, nv: number, mat: string, col: RGB, uvScale = 4) => {
    const len = Math.hypot(u1 - u0, v1 - v0);
    const parts = Math.max(1, Math.ceil(len / 2.5));
    const [nx, nz] = N(nu, nv);
    for (let i = 0; i < parts; i++) {
      const a = W(lerp(u0, u1, i / parts), lerp(v0, v1, i / parts));
      const c = W(lerp(u0, u1, (i + 1) / parts), lerp(v0, v1, (i + 1) / parts));
      const b = B((a.x + c.x) / 2, (a.z + c.z) / 2, mat);
      const s0 = (len * i) / parts / uvScale;
      const s1 = (len * (i + 1)) / parts / uvScale;
      b.color(col, 0.5);
      const i0 = b.v(a.x, y0, a.z, nx, 0, nz, s0, y0 / uvScale);
      const i1 = b.v(c.x, y0, c.z, nx, 0, nz, s1, y0 / uvScale);
      b.color(col, 0.95);
      const i2 = b.v(c.x, y1, c.z, nx, 0, nz, s1, y1 / uvScale);
      const i3 = b.v(a.x, y1, a.z, nx, 0, nz, s0, y1 / uvScale);
      // El orden depende de la orientación de la cara respecto al recorrido
      const cross = (u1 - u0) * nv - (v1 - v0) * nu;
      if (cross > 0) b.quadIdx(i0, i1, i2, i3);
      else b.quadIdx(i1, i0, i3, i2);
    }
  };

  /** Bloque macizo (andén o cabecera) con labio en el borde. */
  const slab = (r: LRect, bandLong: boolean) => {
    const atWall0 = r.v0 <= -f.hw + 0.3;
    const atWall1 = r.v1 >= f.hw - 0.3;
    top(r, H, topMat, tint, 2, uvS, bandLong && !atWall0, bandLong && !atWall1);
    const edge: RGB = [0.62, 0.6, 0.56];
    if (!atWall0) side(r.u0, r.v0, r.u1, r.v0, 0, H, 0, -1, 's_concrete', edge);
    if (!atWall1) side(r.u1, r.v1, r.u0, r.v1, 0, H, 0, 1, 's_concrete', edge);
    if (r.u0 > -f.hl + 0.3) side(r.u0, r.v1, r.u0, r.v0, 0, H, -1, 0, 's_concrete', edge);
    if (r.u1 < f.hl - 0.3) side(r.u1, r.v0, r.u1, r.v1, 0, H, 1, 0, 's_concrete', edge);
    // Línea de seguridad pintada junto al borde de vía
    for (const [vEdge, sgn, at] of [
      [r.v0, 1, atWall0],
      [r.v1, -1, atWall1],
    ] as [number, number, boolean][]) {
      if (at || !bandLong) continue;
      const v0 = vEdge + sgn * 0.62;
      const v1 = vEdge + sgn * 0.74;
      const parts = Math.ceil((r.u1 - r.u0) / 3);
      for (let i = 0; i < parts; i++) {
        const ua = lerp(r.u0, r.u1, i / parts);
        const ub = lerp(r.u0, r.u1, (i + 1) / parts);
        // Pintura gastada: se interrumpe a trozos
        if (hash2(i, Math.round(vEdge * 10), 77) < 0.14) continue;
        const a = W(ua, Math.min(v0, v1));
        const bb = W(ub, Math.min(v0, v1));
        const c = W(ub, Math.max(v0, v1));
        const d = W(ua, Math.max(v0, v1));
        const b = B(a.x, a.z, 's_concrete');
        b.color([0.85, 0.66, 0.12], 0.8 + hash2(i, 3, 5) * 0.3);
        const i0 = b.v(a.x, H + 0.006, a.z, 0, 1, 0, ua / 4, v0 / 4);
        const i1 = b.v(d.x, H + 0.006, d.z, 0, 1, 0, ua / 4, v1 / 4);
        const i2 = b.v(c.x, H + 0.006, c.z, 0, 1, 0, ub / 4, v1 / 4);
        const i3 = b.v(bb.x, H + 0.006, bb.z, 0, 1, 0, ub / 4, v0 / 4);
        b.quadIdx(i0, i1, i2, i3);
      }
    }
  };
  for (const p of f.platforms) slab(p, true);
  for (const p of f.heads) slab(p, false);

  // Pasarelas de tablones sobre las vías
  const wood: RGB = [0.95, 0.9, 0.82];
  for (const d of f.decks) {
    top(d, H + 0.01, 's_planks', wood, 1.7, 1.6);
    side(d.u0, d.v0, d.u0, d.v1, 0, H, -1, 0, 's_planks', scalec(wood, 0.8), 1.6);
    side(d.u1, d.v1, d.u1, d.v0, 0, H, 1, 0, 's_planks', scalec(wood, 0.8), 1.6);
  }

  // Rampas y escaleras
  for (const r of f.ramps) buildRamp(f, r, B, W, N);
}

function buildRamp(f: StationFrame, r: Ramp, B: (x: number, z: number, mat: string) => MeshBuilder, W: (u: number, v: number) => V2, N: (nu: number, nv: number) => [number, number]) {
  const H = PLATFORM_H;
  const alongU = r.dir === 'u+' || r.dir === 'u-';
  // Extremo bajo (lo) y alto (hi) a lo largo del eje de subida; ancho en el otro eje
  const lo = r.dir === 'u+' ? r.u0 : r.dir === 'u-' ? r.u1 : r.dir === 'v+' ? r.v0 : r.v1;
  const hi = r.dir === 'u+' ? r.u1 : r.dir === 'u-' ? r.u0 : r.dir === 'v+' ? r.v1 : r.v0;
  const w0 = alongU ? r.v0 : r.u0;
  const w1 = alongU ? r.v1 : r.u1;
  const P = (t: number, w: number) => (alongU ? W(lerp(lo, hi, t), w) : W(w, lerp(lo, hi, t)));
  const mid = P(0.5, (w0 + w1) / 2);
  const mat = r.kind === 'rampa' ? 's_planks' : 's_concrete';
  const b = B(mid.x, mid.z, mat);
  const col: RGB = r.kind === 'rampa' ? [0.9, 0.85, 0.78] : [0.8, 0.78, 0.74];
  // Normales laterales en el mundo
  const nLo = alongU ? N(Math.sign(lo - hi), 0) : N(0, Math.sign(lo - hi));
  const nW0 = alongU ? N(0, -1) : N(-1, 0);
  const nW1 = alongU ? N(0, 1) : N(1, 0);
  const quad = (a: V2, ya: number, bb: V2, yb: number, c: V2, yc: number, d: V2, yd: number, nx: number, ny: number, nz: number, uv: number[]) => {
    const i0 = b.v(a.x, ya, a.z, nx, ny, nz, uv[0], uv[1]);
    const i1 = b.v(bb.x, yb, bb.z, nx, ny, nz, uv[2], uv[3]);
    const i2 = b.v(c.x, yc, c.z, nx, ny, nz, uv[4], uv[5]);
    const i3 = b.v(d.x, yd, d.z, nx, ny, nz, uv[6], uv[7]);
    // Comprueba la orientación con el producto vectorial
    const ux = bb.x - a.x;
    const uy = yb - ya;
    const uz = bb.z - a.z;
    const vx = d.x - a.x;
    const vy = yd - ya;
    const vz = d.z - a.z;
    const cx = uy * vz - uz * vy;
    const cy = uz * vx - ux * vz;
    const cz = ux * vy - uy * vx;
    if (cx * nx + cy * ny + cz * nz >= 0) b.quadIdx(i0, i1, i2, i3);
    else b.quadIdx(i3, i2, i1, i0);
  };
  const len = Math.abs(hi - lo);
  const wid = Math.abs(w1 - w0);
  if (r.kind === 'rampa') {
    // Tablero inclinado
    const sl = Math.hypot(len, H);
    const dir = alongU ? N(Math.sign(hi - lo), 0) : N(0, Math.sign(hi - lo));
    const ny = len / sl;
    const nh = -H / sl;
    b.color(col);
    quad(P(0, w0), 0, P(0, w1), 0, P(1, w1), H, P(1, w0), H, dir[0] * nh, ny, dir[1] * nh, [0, 0, wid / 1.6, 0, wid / 1.6, sl / 1.6, 0, sl / 1.6]);
    // Costados triangulares
    for (const [w, n] of [
      [w0, nW0],
      [w1, nW1],
    ] as [number, [number, number]][]) {
      b.color(col, 0.6);
      const a = P(0, w);
      const c = P(1, w);
      const i0 = b.v(a.x, 0, a.z, n[0], 0, n[1], 0, 0);
      const i1 = b.v(c.x, 0, c.z, n[0], 0, n[1], len / 1.6, 0);
      const i2 = b.v(c.x, H, c.z, n[0], 0, n[1], len / 1.6, H / 1.6);
      const ux = c.x - a.x;
      const uz = c.z - a.z;
      // (c-a) x (arriba) = (-uz, 0, ux)... orientación por signo
      if (-uz * n[0] + ux * n[1] >= 0) b.tri(i0, i1, i2);
      else b.tri(i0, i2, i1);
    }
    void nLo;
  } else {
    // Escalera de peldaños
    const steps = 5;
    const dir = alongU ? N(Math.sign(lo - hi), 0) : N(0, Math.sign(lo - hi));
    for (let s = 0; s < steps; s++) {
      const t0 = s / steps;
      const t1 = (s + 1) / steps;
      const y1 = (H * (s + 1)) / steps;
      const y0 = (H * s) / steps;
      b.color(col, 0.9 + (s % 2) * 0.06);
      // Huella
      quad(P(t0, w0), y1, P(t0, w1), y1, P(t1, w1), y1, P(t1, w0), y1, 0, 1, 0, [0, t0, wid / 2, t0, wid / 2, t1, 0, t1]);
      // Contrahuella
      b.color(col, 0.62);
      quad(P(t0, w0), y0, P(t0, w1), y0, P(t0, w1), y1, P(t0, w0), y1, dir[0], 0, dir[1], [0, y0, wid / 2, y0, wid / 2, y1, 0, y1]);
      // Costados
      for (const [w, n] of [
        [w0, nW0],
        [w1, nW1],
      ] as [number, [number, number]][]) {
        quad(P(t0, w), 0, P(t1, w), 0, P(t1, w), y1, P(t0, w), y1, n[0], 0, n[1], [t0, 0, t1, 0, t1, y1 / 2, t0, y1 / 2]);
      }
    }
  }
  void f;
}

// --- Vías ---------------------------------------------------------------------

function buildTracks(layout: Layout, B: (x: number, z: number, mat: string) => MeshBuilder) {
  const lines: V2[][] = [];
  for (const l of layout.links) for (const t of l.tracks) lines.push(t);
  for (const f of layout.stations) for (const t of f.tracks) lines.push(t);
  const GAUGE = 0.76;
  const railTop: RGB = [0.5, 0.5, 0.52];
  const railSide: RGB = [0.12, 0.085, 0.07];
  for (const raw of lines) {
    // Subdivide a ~1,5 m
    const line: V2[] = [];
    for (let i = 0; i < raw.length - 1; i++) {
      const a = raw[i];
      const b = raw[i + 1];
      const parts = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 1.5));
      for (let k = 0; k < parts; k++) line.push({ x: lerp(a.x, b.x, k / parts), z: lerp(a.z, b.z, k / parts) });
    }
    line.push(raw[raw.length - 1]);
    let acc = 0;
    let prev: { bed: [number, number]; rails: number[][] } | null = null;
    let prevB: MeshBuilder | null = null;
    let prevS: MeshBuilder | null = null;
    for (let i = 0; i < line.length; i++) {
      const p = line[i];
      const a = line[Math.max(0, i - 1)];
      const c = line[Math.min(line.length - 1, i + 1)];
      const dx = c.x - a.x;
      const dz = c.z - a.z;
      const dl = Math.hypot(dx, dz) || 1;
      const nx = -dz / dl;
      const nz = dx / dl;
      if (i > 0) acc += Math.hypot(p.x - line[i - 1].x, p.z - line[i - 1].z);
      const segMid = i > 0 ? { x: (p.x + line[i - 1].x) / 2, z: (p.z + line[i - 1].z) / 2 } : p;
      const bed = B(segMid.x, segMid.z, 'trackbed');
      const steel = B(segMid.x, segMid.z, 'steel');
      // Si cambia de baldosa, reinicia la tira duplicando el anillo anterior
      const mk = (bb: MeshBuilder, sb: MeshBuilder, q: V2, qnx: number, qnz: number, s: number) => {
        bb.color(WHITE);
        const b0 = bb.v(q.x + qnx * 1.3, 0.018, q.z + qnz * 1.3, 0, 1, 0, 0, s / 2.4);
        const b1 = bb.v(q.x - qnx * 1.3, 0.018, q.z - qnz * 1.3, 0, 1, 0, 1, s / 2.4);
        const rails: number[][] = [];
        for (const sgn of [-1, 1]) {
          const cx = q.x + qnx * GAUGE * sgn;
          const cz = q.z + qnz * GAUGE * sgn;
          const ring: number[] = [];
          // Sección: exterior-abajo, exterior-arriba | arriba x2 | interior-arriba, interior-abajo
          sb.color(railSide);
          ring.push(sb.v(cx + qnx * 0.045, 0.02, cz + qnz * 0.045, qnx, 0, qnz));
          ring.push(sb.v(cx + qnx * 0.035, 0.17, cz + qnz * 0.035, qnx, 0, qnz));
          sb.color(railTop);
          ring.push(sb.v(cx + qnx * 0.035, 0.17, cz + qnz * 0.035, 0, 1, 0));
          ring.push(sb.v(cx - qnx * 0.035, 0.17, cz - qnz * 0.035, 0, 1, 0));
          sb.color(railSide);
          ring.push(sb.v(cx - qnx * 0.035, 0.17, cz - qnz * 0.035, -qnx, 0, -qnz));
          ring.push(sb.v(cx - qnx * 0.045, 0.02, cz - qnz * 0.045, -qnx, 0, -qnz));
          rails.push(ring);
        }
        return { bed: [b0, b1] as [number, number], rails };
      };
      if (i > 0 && (bed !== prevB || steel !== prevS)) {
        const q = line[i - 1];
        const a2 = line[Math.max(0, i - 2)];
        const ddx = p.x - a2.x;
        const ddz = p.z - a2.z;
        const l2 = Math.hypot(ddx, ddz) || 1;
        prev = mk(bed, steel, q, -ddz / l2, ddx / l2, acc - Math.hypot(p.x - q.x, p.z - q.z));
      }
      const cur = mk(bed, steel, p, nx, nz, acc);
      if (prev && i > 0) {
        bed.quadIdx(prev.bed[0], cur.bed[0], cur.bed[1], prev.bed[1]);
        for (let r = 0; r < 2; r++) {
          const A = prev.rails[r];
          const C = cur.rails[r];
          steel.quadIdx(A[0], C[0], C[1], A[1]);
          steel.quadIdx(A[2], C[2], C[3], A[3]);
          steel.quadIdx(A[4], C[4], C[5], A[5]);
        }
      }
      prev = cur;
      prevB = bed;
      prevS = steel;
    }
  }
}
