// Constructor de mallas con esqueleto (skinning): anillos, cadenas de tubos,
// elipsoides y cajas con pesos por hueso y color por vértice.

import * as THREE from 'three';
import type { RGB } from '../geo';

export interface BoneDef {
  name: string;
  parent: number;
  /** Posición en reposo, en el espacio del modelo. */
  pos: [number, number, number];
}

/** Pesos de un vértice: pares hueso/peso (máximo 4). */
export type W = readonly (readonly [number, number])[];

export class SkinBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  fx: number[] = [];
  si: number[] = [];
  sw: number[] = [];
  idx: number[] = [];
  r = 1;
  g = 1;
  b = 1;
  emis = 0;
  private w: W = [[0, 1]];

  get vcount() {
    return this.pos.length / 3;
  }

  color(c: RGB, k = 1): this {
    this.r = c[0] * k;
    this.g = c[1] * k;
    this.b = c[2] * k;
    return this;
  }
  glow(e: number): this {
    this.emis = e;
    return this;
  }
  weights(w: W): this {
    this.w = w;
    return this;
  }

  v(x: number, y: number, z: number, w: W = this.w, shade = 1): number {
    const i = this.vcount;
    this.pos.push(x, y, z);
    this.nor.push(0, 0, 0);
    this.col.push(this.r * shade, this.g * shade, this.b * shade);
    this.fx.push(this.emis, 0);
    let total = 0;
    for (let k = 0; k < 4; k++) total += w[k]?.[1] ?? 0;
    for (let k = 0; k < 4; k++) {
      this.si.push(w[k]?.[0] ?? 0);
      this.sw.push((w[k]?.[1] ?? 0) / (total || 1));
    }
    return i;
  }

  tri(a: number, b: number, c: number) {
    this.idx.push(a, b, c);
  }

  /** Une dos anillos del mismo número de lados; orienta las caras hacia fuera de `center`. */
  bridge(a: number, b: number, n: number, cx: number, cy: number, cz: number, closed = true) {
    const P = this.pos;
    const lim = closed ? n : n - 1;
    // Orientación: comprueba el primer triángulo
    const i0 = a * 3;
    const i1 = (a + 1) * 3;
    const i2 = b * 3;
    const ux = P[i1] - P[i0];
    const uy = P[i1 + 1] - P[i0 + 1];
    const uz = P[i1 + 2] - P[i0 + 2];
    const vx = P[i2] - P[i0];
    const vy = P[i2 + 1] - P[i0 + 1];
    const vz = P[i2 + 2] - P[i0 + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const ox = (P[i0] + P[i1]) / 2 - cx;
    const oy = (P[i0 + 1] + P[i1 + 1]) / 2 - cy;
    const oz = (P[i0 + 2] + P[i1 + 2]) / 2 - cz;
    const flip = nx * ox + ny * oy + nz * oz < 0;
    for (let k = 0; k < lim; k++) {
      const k2 = (k + 1) % n;
      if (flip) {
        this.idx.push(a + k, b + k, a + k2, a + k2, b + k, b + k2);
      } else {
        this.idx.push(a + k, a + k2, b + k, a + k2, b + k2, b + k);
      }
    }
  }

  /** Abanico que cierra un anillo en un punto. */
  fan(ring: number, n: number, px: number, py: number, pz: number, w: W, awayX: number, awayY: number, awayZ: number) {
    const c = this.v(px, py, pz, w);
    const P = this.pos;
    const i0 = ring * 3;
    const i1 = (ring + 1) * 3;
    const ux = P[i0] - px;
    const uy = P[i0 + 1] - py;
    const uz = P[i0 + 2] - pz;
    const vx = P[i1] - px;
    const vy = P[i1 + 1] - py;
    const vz = P[i1 + 2] - pz;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const flip = nx * awayX + ny * awayY + nz * awayZ < 0;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      if (flip) this.idx.push(c, ring + k2, ring + k);
      else this.idx.push(c, ring + k, ring + k2);
    }
  }

  /**
   * Anillo elíptico alrededor de `c`, en el plano perpendicular al eje dado
   * ('y' vertical o 'z' horizontal). `shape` > 2 lo hace más cuadrado.
   */
  ring(cx: number, cy: number, cz: number, ra: number, rb: number, n: number, axis: 'y' | 'z' = 'y', w: W = this.w, shape = 2, perVertex?: (k: number, a: number) => W | null): number {
    const start = this.vcount;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      let c = Math.cos(a);
      let s = Math.sin(a);
      if (shape !== 2) {
        // Superelipse
        const e = 2 / shape;
        c = Math.sign(c) * Math.pow(Math.abs(c), e);
        s = Math.sign(s) * Math.pow(Math.abs(s), e);
      }
      const ww = perVertex?.(k, a) ?? w;
      if (axis === 'y') this.v(cx + c * ra, cy, cz + s * rb, ww);
      else this.v(cx + c * ra, cy + s * rb, cz, ww);
    }
    return start;
  }

  /** Elipsoide (o casquete) con pesos fijos. lat0..lat1 en [0,1] de abajo arriba. */
  blob(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, segs: number, rings: number, w: W = this.w, lat0 = 0, lat1 = 1): this {
    const ids: number[] = [];
    const ys: number[] = [];
    for (let j = 0; j <= rings; j++) {
      const t = lat0 + ((lat1 - lat0) * j) / rings;
      const phi = -Math.PI / 2 + Math.PI * t;
      const y = Math.sin(phi);
      const r = Math.cos(phi);
      ys.push(cy + y * ry);
      ids.push(r < 1e-3 ? -1 : this.ring(cx, cy + y * ry, cz, r * rx, r * rz, segs, 'y', w));
    }
    for (let j = 0; j < rings; j++) {
      const a = ids[j];
      const b = ids[j + 1];
      if (a >= 0 && b >= 0) this.bridge(a, b, segs, cx, (ys[j] + ys[j + 1]) / 2, cz);
      else if (a < 0 && b >= 0) this.fan(b, segs, cx, ys[j], cz, w, 0, -1, 0);
      else if (a >= 0 && b < 0) this.fan(a, segs, cx, ys[j + 1], cz, w, 0, 1, 0);
    }
    return this;
  }

  /** Caja con pesos fijos (caras con normales planas: vértices no compartidos). */
  box(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, w: W = this.w, rotY = 0): this {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const P = (x: number, y: number, z: number) => this.v(cx + x * c + z * s, cy + y, cz - x * s + z * c, w);
    const hx = sx / 2;
    const hy = sy / 2;
    const hz = sz / 2;
    const face = (a: number[], b: number[], cc: number[], d: number[]) => {
      const i0 = P(a[0], a[1], a[2]);
      const i1 = P(b[0], b[1], b[2]);
      const i2 = P(cc[0], cc[1], cc[2]);
      const i3 = P(d[0], d[1], d[2]);
      this.idx.push(i0, i1, i2, i0, i2, i3);
    };
    face([hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]);
    face([-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]);
    face([-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]);
    face([-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]);
    face([-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]);
    face([hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]);
    return this;
  }

  /** Calcula normales suaves (vértices compartidos) con oclusión falsa por orientación. */
  finish(ao = 0.28): THREE.BufferGeometry {
    const P = this.pos;
    const N = this.nor;
    for (let i = 0; i < this.idx.length; i += 3) {
      const a = this.idx[i] * 3;
      const b = this.idx[i + 1] * 3;
      const c = this.idx[i + 2] * 3;
      const ux = P[b] - P[a];
      const uy = P[b + 1] - P[a + 1];
      const uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a];
      const vy = P[c + 1] - P[a + 1];
      const vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) {
        N[k] += nx;
        N[k + 1] += ny;
        N[k + 2] += nz;
      }
    }
    const n = this.vcount;
    for (let i = 0; i < n; i++) {
      const p = i * 3;
      const l = Math.hypot(N[p], N[p + 1], N[p + 2]);
      if (l > 1e-9) {
        N[p] /= l;
        N[p + 1] /= l;
        N[p + 2] /= l;
      } else {
        // Vértice suelto o de triángulos degenerados: una normal nula daría NaN en el shader
        N[p] = 0;
        N[p + 1] = 1;
        N[p + 2] = 0;
      }
      // Las caras que miran hacia abajo quedan algo más oscuras
      const k = 1 - ao * Math.max(0, -N[p + 1] * 0.8 + 0.2);
      this.col[p] *= k;
      this.col[p + 1] *= k;
      this.col[p + 2] *= k;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('fx', new THREE.Float32BufferAttribute(this.fx, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(n > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Crea los huesos de three a partir de una definición de esqueleto. */
export function makeSkeleton(defs: BoneDef[], scale = 1): { bones: THREE.Bone[]; skeleton: THREE.Skeleton; root: THREE.Bone } {
  const bones = defs.map((d) => {
    const b = new THREE.Bone();
    b.name = d.name;
    return b;
  });
  defs.forEach((d, i) => {
    const p = d.parent >= 0 ? defs[d.parent].pos : [0, 0, 0];
    bones[i].position.set((d.pos[0] - p[0]) * scale, (d.pos[1] - p[1]) * scale, (d.pos[2] - p[2]) * scale);
    if (d.parent >= 0) bones[d.parent].add(bones[i]);
  });
  bones[0].updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  return { bones, skeleton, root: bones[0] };
}
