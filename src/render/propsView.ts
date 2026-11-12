// Atrezo del mundo: mallas instanciadas por tipo y baldosa, con la luz
// horneada por instancia. Las piezas grandes y únicas se funden en mallas
// propias con luz por vértice.

import * as THREE from 'three';
import type { LightField } from '../world/lights';
import { PROPS, type PropInst } from '../world/props';
import { MeshBuilder, lin } from './geo';
import { drawProp, propGeometry } from './kit/core';
import { propMaterial, solidMaterial } from './materials';
import './kit/basics';
import './kit/settlement';
import './kit/landmarks';

const TILE = 96;

export interface PropsView {
  group: THREE.Group;
  material: THREE.MeshStandardMaterial;
  count: number;
}

const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpP = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Comprime la luz horneada muy intensa (piezas pegadas a una lámpara) para que no se queme. */
function soften(out: Float32Array | number[], limit = 1.0, extra = 0.5) {
  const mx = Math.max(out[0], out[1], out[2]);
  if (mx <= limit) return;
  const k = (limit + extra * (1 - Math.exp(-(mx - limit) / extra))) / mx;
  out[0] *= k;
  out[1] *= k;
  out[2] *= k;
}

/** Altura a la que se muestrea la luz de cada pieza. */
function sampleHeight(type: string): number {
  const d = PROPS[type];
  if (d?.wall) return 0;
  return d?.tall ? 1.6 : 0.7;
}

export function buildPropsView(props: PropInst[], field: LightField, shared?: { material?: THREE.MeshStandardMaterial; solid?: THREE.MeshStandardMaterial }): PropsView {
  const group = new THREE.Group();
  group.name = 'atrezo';
  const material = shared?.material ?? propMaterial();
  const solid = shared?.solid ?? solidMaterial();
  const buckets = new Map<string, PropInst[]>();
  const uniques = new Map<string, PropInst[]>();
  for (const p of props) {
    const def = PROPS[p.type];
    const tile = `${Math.floor(p.x / TILE)},${Math.floor(p.z / TILE)}`;
    if (def?.unique) {
      let arr = uniques.get(tile);
      if (!arr) uniques.set(tile, (arr = []));
      arr.push(p);
      continue;
    }
    const key = `${p.type}#${p.variant ?? 0}|${tile}`;
    let arr = buckets.get(key);
    if (!arr) buckets.set(key, (arr = []));
    arr.push(p);
  }
  const out = new Float32Array(6);
  let count = 0;
  for (const [key, list] of buckets) {
    const [tv] = key.split('|');
    const [type, variant] = tv.split('#');
    const geo = propGeometry(type, Number(variant));
    const mesh = new THREE.InstancedMesh(geo, material, list.length);
    const n = list.length;
    const bakeCol = new Float32Array(n * 3);
    const bakeDir = new Float32Array(n * 3);
    const wall = new Float32Array(n * 3);
    const tint = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = list[i];
      const s = p.scale ?? 1;
      tmpQ.setFromAxisAngle(UP, p.rot);
      tmpM.compose(tmpP.set(p.x, p.y, p.z), tmpQ, tmpS.set(s, s, s));
      mesh.setMatrixAt(i, tmpM);
      // Las piezas de pared se muestrean un poco separadas del muro
      const off = p.wnx !== undefined ? 0.5 : 0;
      field.sample(p.x - (p.wnx ?? 0) * off, p.y + sampleHeight(type), p.z - (p.wnz ?? 0) * off, 0, 1, 0, false, out);
      soften(out);
      bakeCol[i * 3] = out[0];
      bakeCol[i * 3 + 1] = out[1];
      bakeCol[i * 3 + 2] = out[2];
      bakeDir[i * 3] = out[3];
      bakeDir[i * 3 + 1] = out[4];
      bakeDir[i * 3 + 2] = out[5];
      wall[i * 3] = p.wnx ?? 0;
      wall[i * 3 + 1] = p.wnz ?? 0;
      const phase = (((p.seed ?? i) * 0.6180339) % 1) * 0.98 + 0.01;
      wall[i * 3 + 2] = p.dark ? -phase : phase;
      const t = p.tint !== undefined ? lin(p.tint) : [1, 1, 1];
      tint[i * 3] = t[0];
      tint[i * 3 + 1] = t[1];
      tint[i * 3 + 2] = t[2];
    }
    // Atributos por instancia en una copia ligera de la geometría (comparte búferes)
    const g = new THREE.BufferGeometry();
    g.index = geo.index;
    for (const name of Object.keys(geo.attributes)) g.setAttribute(name, geo.attributes[name]);
    g.setAttribute('iBakeCol', new THREE.InstancedBufferAttribute(bakeCol, 3));
    g.setAttribute('iBakeDir', new THREE.InstancedBufferAttribute(bakeDir, 3));
    g.setAttribute('iWall', new THREE.InstancedBufferAttribute(wall, 3));
    g.setAttribute('iTint', new THREE.InstancedBufferAttribute(tint, 3));
    g.boundingBox = geo.boundingBox;
    g.boundingSphere = geo.boundingSphere;
    mesh.geometry = g;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = !PROPS[type]?.wall;
    mesh.receiveShadow = true;
    mesh.name = key;
    group.add(mesh);
    count += n;
  }
  // Piezas únicas: una malla por baldosa con luz por vértice
  for (const [tile, list] of uniques) {
    const b = new MeshBuilder({ fx: true });
    for (const p of list) {
      b.push();
      b.translate(p.x, p.y, p.z);
      b.rotateY(p.rot);
      if (p.scale && p.scale !== 1) b.scale(p.scale);
      const v0 = b.vcount;
      drawProp(b, p.type, p.variant ?? 0, p.seed ?? 1);
      b.pop();
      if (p.tint !== undefined) {
        // Aplica el tinte de facción directamente al color de los vértices marcados
        const t = lin(p.tint);
        for (let i = v0; i < b.vcount; i++) {
          const m = b.fx![i * 2 + 1];
          if (m > 0) {
            b.col[i * 3] *= 1 + (t[0] - 1) * m;
            b.col[i * 3 + 1] *= 1 + (t[1] - 1) * m;
            b.col[i * 3 + 2] *= 1 + (t[2] - 1) * m;
          }
        }
      }
    }
    if (b.empty) continue;
    const n = b.vcount;
    const bakeCol = new Float32Array(n * 3);
    const bakeDir = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const q = i * 3;
      field.sample(b.pos[q], b.pos[q + 1], b.pos[q + 2], b.nor[q], b.nor[q + 1], b.nor[q + 2], true, out, false);
      soften(out, 1.0, 0.6);
      bakeCol[q] = out[0];
      bakeCol[q + 1] = out[1];
      bakeCol[q + 2] = out[2];
      bakeDir[q] = out[3];
      bakeDir[q + 1] = out[4];
      bakeDir[q + 2] = out[5];
    }
    const g = b.toGeometry();
    g.setAttribute('bakeCol', new THREE.BufferAttribute(bakeCol, 3));
    g.setAttribute('bakeDir', new THREE.BufferAttribute(bakeDir, 3));
    const mesh = new THREE.Mesh(g, solid);
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'unicos|' + tile;
    group.add(mesh);
    count += list.length;
  }
  return { group, material, count };
}
