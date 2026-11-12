// Agua estancada: una lámina oscura sobre las celdas inundadas que refleja
// las lámparas (luz horneada por vértice) y se desvanece en las orillas.

import * as THREE from 'three';
import { CELL, F_WALK, F_WATER, type NavGrid } from '../world/grid';
import type { LightField } from '../world/lights';
import { globals, waterMaterial } from './materials';
import type { TextureSet } from './textures';

const TILE = 64;
const LEVEL = 0.075;

export function buildWaterMesh(nav: NavGrid, field: LightField, tex: TextureSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'agua';
  const { w, h, flags } = nav;
  const wet = (cx: number, cz: number) => cx >= 0 && cz >= 0 && cx < w && cz < h && (flags[cz * w + cx] & (F_WATER | F_WALK)) === (F_WATER | F_WALK);
  // Celdas por baldosa
  const tiles = new Map<string, number[]>();
  for (let cz = 0; cz < h; cz++) {
    for (let cx = 0; cx < w; cx++) {
      if (!wet(cx, cz)) continue;
      const key = `${Math.floor(nav.wx(cx) / TILE)},${Math.floor(nav.wz(cz) / TILE)}`;
      let a = tiles.get(key);
      if (!a) tiles.set(key, (a = []));
      a.push(cx, cz);
    }
  }
  if (!tiles.size) return group;
  const normal = tex.rock.normalMap.clone();
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.needsUpdate = true;
  const mat = waterMaterial(normal);
  const out = new Float32Array(6);
  for (const cells of tiles.values()) {
    const index = new Map<number, number>();
    const pos: number[] = [];
    const col: number[] = [];
    const uv: number[] = [];
    const bakeCol: number[] = [];
    const bakeDir: number[] = [];
    const idx: number[] = [];
    // Vértice en la esquina (vx, vz) de la rejilla
    const vert = (vx: number, vz: number): number => {
      const key = vz * (w + 1) + vx;
      let i = index.get(key);
      if (i !== undefined) return i;
      i = pos.length / 3;
      index.set(key, i);
      const x = nav.ox + vx * CELL;
      const z = nav.oz + vz * CELL;
      // La orilla: si alguna de las cuatro celdas que comparten la esquina está seca, el agua se desvanece
      const full = wet(vx - 1, vz - 1) && wet(vx, vz - 1) && wet(vx - 1, vz) && wet(vx, vz);
      let deep = full ? 1 : 0;
      if (full) {
        // Más opaca lejos de la orilla
        const far = wet(vx - 2, vz - 2) && wet(vx + 1, vz - 2) && wet(vx - 2, vz + 1) && wet(vx + 1, vz + 1);
        deep = far ? 1 : 0.6;
      }
      const cy = nav.height[Math.min(h - 1, Math.max(0, vz)) * w + Math.min(w - 1, Math.max(0, vx))] * 0.1;
      pos.push(x, cy + LEVEL, z);
      col.push(1, 1, 1, deep);
      uv.push(x * 0.13, z * 0.13);
      field.sample(x, cy + LEVEL, z, 0, 1, 0, true, out);
      bakeCol.push(out[0], out[1], out[2]);
      bakeDir.push(out[3], out[4], out[5]);
      return i;
    };
    for (let k = 0; k < cells.length; k += 2) {
      const cx = cells[k];
      const cz = cells[k + 1];
      const a = vert(cx, cz);
      const b = vert(cx + 1, cz);
      const c = vert(cx + 1, cz + 1);
      const d = vert(cx, cz + 1);
      idx.push(a, d, c, a, c, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const nrm = new Float32Array(pos.length);
    for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('bakeCol', new THREE.Float32BufferAttribute(bakeCol, 3));
    g.setAttribute('bakeDir', new THREE.Float32BufferAttribute(bakeDir, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.matrixAutoUpdate = false;
    mesh.renderOrder = 2;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  // Ondas lentas: la textura de relieve se desliza con el tiempo
  const first = group.children[0] as THREE.Mesh;
  first.onBeforeRender = () => {
    const t = globals.uTime.value;
    normal.offset.set(t * 0.011, t * 0.007);
  };
  return group;
}
