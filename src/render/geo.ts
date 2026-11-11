// Constructor de mallas procedurales: primitivas con color por vértice,
// pila de transformaciones y atributos extra (emisión, tinte, muros).

import * as THREE from 'three';
import { hash3 } from '../core/math';

export type RGB = readonly [number, number, number];

const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** Color sRGB hexadecimal a RGB lineal. */
export function lin(hex: number): [number, number, number] {
  return [s2l(((hex >> 16) & 255) / 255), s2l(((hex >> 8) & 255) / 255), s2l((hex & 255) / 255)];
}
export function mixc(a: RGB, b: RGB, t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function scalec(a: RGB, k: number): [number, number, number] {
  return [a[0] * k, a[1] * k, a[2] * k];
}

export interface BuilderOptions {
  uv?: boolean;
  /** Atributo de muro (normal exterior XZ + altura del zócalo). */
  wall?: boolean;
  /** Atributo fx (emisión, máscara de tinte). */
  fx?: boolean;
  /** Atributos de suelo: mezcla de texturas y distancia al muro. */
  splat?: boolean;
}

export class MeshBuilder {
  pos = new Float32Array(3 * 1024);
  nor = new Float32Array(3 * 1024);
  col = new Float32Array(3 * 1024);
  uv: Float32Array | null = null;
  wall: Float32Array | null = null;
  fx: Float32Array | null = null;
  splat: Float32Array | null = null;
  idx = new Uint32Array(3 * 2048);
  vcount = 0;
  icount = 0;

  // Estado actual
  r = 1;
  g = 1;
  b = 1;
  emis = 0;
  tint = 0;
  wnx = 0;
  wnz = 0;
  wstub = 0;
  /** Oscurecimiento vertical: los vértices bajos de las caras laterales se oscurecen. */
  ao = 0.16;

  private m = new THREE.Matrix4();
  private nm = new THREE.Matrix3();
  private stack: THREE.Matrix4[] = [];
  private identity = true;
  private tv = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();

  constructor(readonly opts: BuilderOptions = {}) {
    if (opts.uv) this.uv = new Float32Array(2 * 1024);
    if (opts.wall) this.wall = new Float32Array(3 * 1024);
    if (opts.fx) this.fx = new Float32Array(2 * 1024);
    if (opts.splat) this.splat = new Float32Array(4 * 1024);
  }

  // --- Transformaciones ---------------------------------------------------

  push(): this {
    this.stack.push(this.m.clone());
    return this;
  }
  pop(): this {
    this.m.copy(this.stack.pop()!);
    this.sync();
    return this;
  }
  private sync() {
    this.nm.getNormalMatrix(this.m);
    const e = this.m.elements;
    this.identity = e[0] === 1 && e[5] === 1 && e[10] === 1 && e[12] === 0 && e[13] === 0 && e[14] === 0 && e[1] === 0 && e[2] === 0 && e[4] === 0 && e[6] === 0 && e[8] === 0 && e[9] === 0;
  }
  translate(x: number, y: number, z: number): this {
    this.m.multiply(this.tmpM.makeTranslation(x, y, z));
    this.sync();
    return this;
  }
  rotateY(a: number): this {
    this.m.multiply(this.tmpM.makeRotationY(a));
    this.sync();
    return this;
  }
  rotateX(a: number): this {
    this.m.multiply(this.tmpM.makeRotationX(a));
    this.sync();
    return this;
  }
  rotateZ(a: number): this {
    this.m.multiply(this.tmpM.makeRotationZ(a));
    this.sync();
    return this;
  }
  scale(x: number, y = x, z = x): this {
    this.m.multiply(this.tmpM.makeScale(x, y, z));
    this.sync();
    return this;
  }
  /** Ejecuta `fn` con una transformación local y la restaura. */
  at(x: number, y: number, z: number, rotY: number, fn: () => void): this {
    this.push();
    this.translate(x, y, z);
    if (rotY) this.rotateY(rotY);
    fn();
    this.pop();
    return this;
  }
  reset(): this {
    this.m.identity();
    this.stack.length = 0;
    this.sync();
    return this;
  }

  // --- Estado -------------------------------------------------------------

  color(c: number | RGB, k = 1): this {
    const v = typeof c === 'number' ? lin(c) : c;
    this.r = v[0] * k;
    this.g = v[1] * k;
    this.b = v[2] * k;
    return this;
  }
  /** Emisión (0 = nada; >1 brilla con bloom) y máscara de tinte de facción. */
  glow(e: number): this {
    this.emis = e;
    return this;
  }
  tinted(t: number): this {
    this.tint = t;
    return this;
  }
  wallNormal(nx: number, nz: number, stub: number): this {
    this.wnx = nx;
    this.wnz = nz;
    this.wstub = stub;
    return this;
  }

  // --- Vértices -----------------------------------------------------------

  private grow(nv: number, ni: number) {
    if ((this.vcount + nv) * 3 > this.pos.length) {
      const cap = Math.max(this.pos.length * 2, (this.vcount + nv) * 3);
      const n = cap / 3;
      const re = (a: Float32Array, k: number) => {
        const o = new Float32Array(n * k);
        o.set(a);
        return o;
      };
      this.pos = re(this.pos, 3);
      this.nor = re(this.nor, 3);
      this.col = re(this.col, 3);
      if (this.uv) this.uv = re(this.uv, 2);
      if (this.wall) this.wall = re(this.wall, 3);
      if (this.fx) this.fx = re(this.fx, 2);
      if (this.splat) this.splat = re(this.splat, 4);
    }
    if (this.icount + ni > this.idx.length) {
      const o = new Uint32Array(Math.max(this.idx.length * 2, this.icount + ni));
      o.set(this.idx);
      this.idx = o;
    }
  }

  /** Añade un vértice (posición y normal en espacio local) y devuelve su índice. */
  v(x: number, y: number, z: number, nx: number, ny: number, nz: number, u = 0, vv = 0, shade = 1): number {
    this.grow(1, 0);
    const i = this.vcount++;
    if (!this.identity) {
      const t = this.tv.set(x, y, z).applyMatrix4(this.m);
      x = t.x;
      y = t.y;
      z = t.z;
      t.set(nx, ny, nz).applyMatrix3(this.nm).normalize();
      nx = t.x;
      ny = t.y;
      nz = t.z;
    }
    const p = i * 3;
    this.pos[p] = x;
    this.pos[p + 1] = y;
    this.pos[p + 2] = z;
    this.nor[p] = nx;
    this.nor[p + 1] = ny;
    this.nor[p + 2] = nz;
    this.col[p] = this.r * shade;
    this.col[p + 1] = this.g * shade;
    this.col[p + 2] = this.b * shade;
    if (this.uv) {
      this.uv[i * 2] = u;
      this.uv[i * 2 + 1] = vv;
    }
    if (this.wall) {
      this.wall[p] = this.wnx;
      this.wall[p + 1] = this.wnz;
      this.wall[p + 2] = this.wstub;
    }
    if (this.fx) {
      this.fx[i * 2] = this.emis;
      this.fx[i * 2 + 1] = this.tint;
    }
    return i;
  }

  tri(a: number, b: number, c: number): this {
    this.grow(0, 3);
    this.idx[this.icount++] = a;
    this.idx[this.icount++] = b;
    this.idx[this.icount++] = c;
    return this;
  }
  quadIdx(a: number, b: number, c: number, d: number): this {
    this.grow(0, 6);
    const o = this.icount;
    this.idx[o] = a;
    this.idx[o + 1] = b;
    this.idx[o + 2] = c;
    this.idx[o + 3] = a;
    this.idx[o + 4] = c;
    this.idx[o + 5] = d;
    this.icount += 6;
    return this;
  }

  /** Cuadrilátero plano con normal calculada (a,b,c,d en sentido antihorario visto de frente). */
  quad(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, dx: number, dy: number, dz: number, shadeLow = 1, uvs?: number[]): this {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = dx - ax;
    const vy = dy - ay;
    const vz = dz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const u = uvs ?? [0, 0, 1, 0, 1, 1, 0, 1];
    const i0 = this.v(ax, ay, az, nx, ny, nz, u[0], u[1], shadeLow);
    const i1 = this.v(bx, by, bz, nx, ny, nz, u[2], u[3], shadeLow);
    const i2 = this.v(cx, cy, cz, nx, ny, nz, u[4], u[5]);
    const i3 = this.v(dx, dy, dz, nx, ny, nz, u[6], u[7]);
    return this.quadIdx(i0, i1, i2, i3);
  }

  triangle(ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number): this {
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const i0 = this.v(ax, ay, az, nx, ny, nz);
    const i1 = this.v(bx, by, bz, nx, ny, nz);
    const i2 = this.v(cx, cy, cz, nx, ny, nz);
    return this.tri(i0, i1, i2);
  }

  // --- Primitivas ---------------------------------------------------------

  /**
   * Caja centrada en (x, z) con base en `y`. `faces` es una máscara de caras a
   * dibujar: 1 +X, 2 -X, 4 +Y, 8 -Y, 16 +Z, 32 -Z (por defecto, todas menos la base).
   */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, faces = 0b110111): this {
    const x0 = x - sx / 2;
    const x1 = x + sx / 2;
    const y0 = y;
    const y1 = y + sy;
    const z0 = z - sz / 2;
    const z1 = z + sz / 2;
    const lo = 1 - this.ao;
    if (faces & 1) this.quad(x1, y0, z1, x1, y0, z0, x1, y1, z0, x1, y1, z1, lo);
    if (faces & 2) this.quad(x0, y0, z0, x0, y0, z1, x0, y1, z1, x0, y1, z0, lo);
    if (faces & 4) this.quad(x0, y1, z1, x1, y1, z1, x1, y1, z0, x0, y1, z0);
    if (faces & 8) this.quad(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, lo);
    if (faces & 16) this.quad(x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1, lo);
    if (faces & 32) this.quad(x1, y0, z0, x0, y0, z0, x0, y1, z0, x1, y1, z0, lo);
    return this;
  }

  /** Caja completa (incluida la base). */
  cube(x: number, y: number, z: number, sx: number, sy: number, sz: number): this {
    return this.box(x, y, z, sx, sy, sz, 0b111111);
  }

  /** Viga entre dos puntos con sección rectangular (ancho w, alto h). */
  beam(ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, h = w): this {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-5) return this;
    this.push();
    this.translate(ax, ay, az);
    this.rotateY(Math.atan2(-dz, dx));
    this.rotateZ(Math.asin(clampUnit(dy / len)));
    const keep = this.ao;
    this.ao = 0;
    this.box(len / 2, -h / 2, 0, len, h, w, 0b111111);
    this.ao = keep;
    this.pop();
    return this;
  }

  /** Cilindro/cono truncado sobre el eje Y con base en (x, y, z). */
  cyl(x: number, y: number, z: number, r0: number, r1: number, h: number, segs = 10, caps = 0b10, smooth = true): this {
    const lo = 1 - this.ao;
    const slope = (r0 - r1) / (h || 1);
    const nl = Math.hypot(1, slope);
    if (smooth) {
      const base = this.vcount;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        this.v(x + c * r0, y, z + s * r0, c / nl, slope / nl, s / nl, i / segs, 0, lo);
        this.v(x + c * r1, y + h, z + s * r1, c / nl, slope / nl, s / nl, i / segs, 1);
      }
      for (let i = 0; i < segs; i++) {
        const k = base + i * 2;
        this.quadIdx(k, k + 1, k + 3, k + 2);
      }
    } else {
      for (let i = 0; i < segs; i++) {
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        const c0 = Math.cos(a0);
        const s0 = Math.sin(a0);
        const c1 = Math.cos(a1);
        const s1 = Math.sin(a1);
        this.quad(x + c1 * r0, y, z + s1 * r0, x + c0 * r0, y, z + s0 * r0, x + c0 * r1, y + h, z + s0 * r1, x + c1 * r1, y + h, z + s1 * r1, lo);
      }
    }
    if (caps & 2 && r1 > 1e-4) {
      const c = this.v(x, y + h, z, 0, 1, 0, 0.5, 0.5);
      const base = this.vcount;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        this.v(x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1, 0, 1, 0);
      }
      for (let i = 0; i < segs; i++) this.tri(c, base + i + 1, base + i);
    }
    if (caps & 1 && r0 > 1e-4) {
      const c = this.v(x, y, z, 0, -1, 0, 0.5, 0.5, lo);
      const base = this.vcount;
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        this.v(x + Math.cos(a) * r0, y, z + Math.sin(a) * r0, 0, -1, 0, 0, 0, lo);
      }
      for (let i = 0; i < segs; i++) this.tri(c, base + i, base + i + 1);
    }
    return this;
  }

  /** Superficie de revolución alrededor del eje Y. `profile` = [r0,y0, r1,y1, ...] de abajo arriba. */
  lathe(x: number, y: number, z: number, profile: number[], segs = 12, capTop = false, capBottom = false): this {
    const n = profile.length / 2;
    const base = this.vcount;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let j = 0; j < n; j++) {
      ymin = Math.min(ymin, profile[j * 2 + 1]);
      ymax = Math.max(ymax, profile[j * 2 + 1]);
    }
    for (let j = 0; j < n; j++) {
      const r = profile[j * 2];
      const yy = profile[j * 2 + 1];
      const jp = Math.max(0, j - 1);
      const jn = Math.min(n - 1, j + 1);
      const dr = profile[jn * 2] - profile[jp * 2];
      const dy = profile[jn * 2 + 1] - profile[jp * 2 + 1];
      const l = Math.hypot(dr, dy) || 1;
      const nr = dy / l;
      const ny = -dr / l;
      const shade = 1 - this.ao * (1 - (yy - ymin) / (ymax - ymin || 1));
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        this.v(x + c * r, y + yy, z + s * r, c * nr, ny, s * nr, i / segs, j / (n - 1), shade);
      }
    }
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < segs; i++) {
        const k = base + j * (segs + 1) + i;
        this.quadIdx(k, k + segs + 1, k + segs + 2, k + 1);
      }
    }
    if (capTop) this.disc(x, y + profile[(n - 1) * 2 + 1], z, profile[(n - 1) * 2], segs, 1);
    if (capBottom) this.disc(x, y + profile[1], z, profile[0], segs, -1);
    return this;
  }

  disc(x: number, y: number, z: number, r: number, segs = 12, dir = 1): this {
    const c = this.v(x, y, z, 0, dir, 0, 0.5, 0.5);
    const base = this.vcount;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      this.v(x + Math.cos(a) * r, y, z + Math.sin(a) * r, 0, dir, 0, 0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    }
    for (let i = 0; i < segs; i++) {
      if (dir > 0) this.tri(c, base + i + 1, base + i);
      else this.tri(c, base + i, base + i + 1);
    }
    return this;
  }

  /** Elipsoide centrado en (x, y, z). `top`/`bottom` recortan en latitud (0..1). */
  sphere(x: number, y: number, z: number, rx: number, ry = rx, rz = rx, segs = 10, rings = 6, from = 0, to = 1): this {
    const base = this.vcount;
    for (let j = 0; j <= rings; j++) {
      const t = from + ((to - from) * j) / rings;
      const phi = -Math.PI / 2 + Math.PI * t;
      const cy = Math.sin(phi);
      const cr = Math.cos(phi);
      const shade = 1 - this.ao * (1 - t);
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const nx = Math.cos(a) * cr;
        const nz = Math.sin(a) * cr;
        // Normal del elipsoide
        const ex = nx / rx;
        const ey = cy / ry;
        const ez = nz / rz;
        const l = Math.hypot(ex, ey, ez) || 1;
        this.v(x + nx * rx, y + cy * ry, z + nz * rz, ex / l, ey / l, ez / l, i / segs, t, shade);
      }
    }
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segs; i++) {
        const k = base + j * (segs + 1) + i;
        this.quadIdx(k, k + segs + 1, k + segs + 2, k + 1);
      }
    }
    return this;
  }

  /** Tubo que sigue una polilínea 3D [x,y,z,...]. */
  tube(path: number[], radius: number, sides = 6, closedEnds = false): this {
    const n = path.length / 3;
    if (n < 2) return this;
    const base = this.vcount;
    let ux = 0;
    let uy = 1;
    let uz = 0;
    for (let i = 0; i < n; i++) {
      const p = i * 3;
      const a = Math.max(0, i - 1) * 3;
      const b = Math.min(n - 1, i + 1) * 3;
      let tx = path[b] - path[a];
      let ty = path[b + 1] - path[a + 1];
      let tz = path[b + 2] - path[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      // Marco: vector "arriba" proyectado
      if (Math.abs(ux * tx + uy * ty + uz * tz) > 0.95) {
        ux = 1;
        uy = 0;
        uz = 0;
      }
      let sx = uy * tz - uz * ty;
      let sy = uz * tx - ux * tz;
      let sz = ux * ty - uy * tx;
      const sl = Math.hypot(sx, sy, sz) || 1;
      sx /= sl;
      sy /= sl;
      sz /= sl;
      ux = ty * sz - tz * sy;
      uy = tz * sx - tx * sz;
      uz = tx * sy - ty * sx;
      for (let k = 0; k <= sides; k++) {
        const a2 = (k / sides) * Math.PI * 2;
        const c = Math.cos(a2);
        const s = Math.sin(a2);
        const nx = sx * c + ux * s;
        const ny = sy * c + uy * s;
        const nz = sz * c + uz * s;
        this.v(path[p] + nx * radius, path[p + 1] + ny * radius, path[p + 2] + nz * radius, nx, ny, nz, k / sides, i);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < sides; k++) {
        const q = base + i * (sides + 1) + k;
        this.quadIdx(q, q + 1, q + sides + 2, q + sides + 1);
      }
    }
    void closedEnds;
    return this;
  }

  /**
   * Malla entre anillos (loft). Cada anillo es [x,y,z,...] con el mismo número
   * de puntos. Las normales se suavizan después con `smooth`.
   */
  loft(rings: number[][], closed = true): [number, number] {
    const m = rings[0].length / 3;
    const v0 = this.vcount;
    const i0 = this.icount;
    for (const ring of rings) for (let k = 0; k < m; k++) this.v(ring[k * 3], ring[k * 3 + 1], ring[k * 3 + 2], 0, 1, 0);
    const lim = closed ? m : m - 1;
    for (let j = 0; j < rings.length - 1; j++) {
      for (let k = 0; k < lim; k++) {
        const a = v0 + j * m + k;
        const b = v0 + j * m + ((k + 1) % m);
        this.quadIdx(a, a + m, b + m, b);
      }
    }
    this.smooth(v0, this.vcount, i0, this.icount);
    return [v0, this.vcount];
  }

  /** Recalcula normales suaves para un rango de vértices/índices. */
  smooth(v0: number, v1: number, i0: number, i1: number): this {
    const { pos, nor, idx } = this;
    for (let i = v0 * 3; i < v1 * 3; i++) nor[i] = 0;
    for (let i = i0; i < i1; i += 3) {
      const a = idx[i] * 3;
      const b = idx[i + 1] * 3;
      const c = idx[i + 2] * 3;
      const ux = pos[b] - pos[a];
      const uy = pos[b + 1] - pos[a + 1];
      const uz = pos[b + 2] - pos[a + 2];
      const vx = pos[c] - pos[a];
      const vy = pos[c + 1] - pos[a + 1];
      const vz = pos[c + 2] - pos[a + 2];
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) {
        nor[k] += nx;
        nor[k + 1] += ny;
        nor[k + 2] += nz;
      }
    }
    for (let i = v0; i < v1; i++) {
      const p = i * 3;
      const l = Math.hypot(nor[p], nor[p + 1], nor[p + 2]) || 1;
      nor[p] /= l;
      nor[p + 1] /= l;
      nor[p + 2] /= l;
    }
    return this;
  }

  /** Prisma: polígono convexo XZ [x,z,...] extruido entre y0 e y1. */
  prism(poly: number[], y0: number, y1: number, cap = true): this {
    const n = poly.length / 2;
    const lo = 1 - this.ao;
    // Orientación del polígono
    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += poly[i * 2] * poly[j * 2 + 1] - poly[j * 2] * poly[i * 2 + 1];
    }
    const flip = area > 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = poly[i * 2];
      const az = poly[i * 2 + 1];
      const bx = poly[j * 2];
      const bz = poly[j * 2 + 1];
      if (flip) this.quad(bx, y0, bz, ax, y0, az, ax, y1, az, bx, y1, bz, lo);
      else this.quad(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az, lo);
    }
    if (cap) {
      let cx = 0;
      let cz = 0;
      for (let i = 0; i < n; i++) {
        cx += poly[i * 2] / n;
        cz += poly[i * 2 + 1] / n;
      }
      const c = this.v(cx, y1, cz, 0, 1, 0);
      const base = this.vcount;
      for (let i = 0; i < n; i++) this.v(poly[i * 2], y1, poly[i * 2 + 1], 0, 1, 0);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        if (flip) this.tri(c, base + j, base + i);
        else this.tri(c, base + i, base + j);
      }
    }
    return this;
  }

  /** Desplaza los vértices del rango con ruido (para formas orgánicas). */
  jitter(v0: number, amount: number, seed = 1): this {
    for (let i = v0; i < this.vcount; i++) {
      const p = i * 3;
      const qx = Math.round(this.pos[p] * 40);
      const qy = Math.round(this.pos[p + 1] * 40);
      const qz = Math.round(this.pos[p + 2] * 40);
      this.pos[p] += (hash3(qx, qy, qz, seed) - 0.5) * amount;
      this.pos[p + 1] += (hash3(qx, qy, qz, seed + 1) - 0.5) * amount;
      this.pos[p + 2] += (hash3(qx, qy, qz, seed + 2) - 0.5) * amount;
    }
    return this;
  }

  /** Copia otra malla aplicando la transformación actual. */
  append(o: MeshBuilder): this {
    const base = this.vcount;
    for (let i = 0; i < o.vcount; i++) {
      const p = i * 3;
      const keep = [this.r, this.g, this.b, this.emis, this.tint] as const;
      this.r = o.col[p];
      this.g = o.col[p + 1];
      this.b = o.col[p + 2];
      if (o.fx) {
        this.emis = o.fx[i * 2];
        this.tint = o.fx[i * 2 + 1];
      }
      this.v(o.pos[p], o.pos[p + 1], o.pos[p + 2], o.nor[p], o.nor[p + 1], o.nor[p + 2], o.uv ? o.uv[i * 2] : 0, o.uv ? o.uv[i * 2 + 1] : 0);
      [this.r, this.g, this.b, this.emis, this.tint] = keep;
    }
    this.grow(0, o.icount);
    for (let i = 0; i < o.icount; i++) this.idx[this.icount++] = o.idx[i] + base;
    return this;
  }

  get empty() {
    return this.icount === 0;
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    const n = this.vcount;
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, n * 3), 3));
    if (this.uv) g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, n * 2), 2));
    if (this.wall) g.setAttribute('wallN', new THREE.BufferAttribute(this.wall.slice(0, n * 3), 3));
    if (this.fx) g.setAttribute('fx', new THREE.BufferAttribute(this.fx.slice(0, n * 2), 2));
    if (this.splat) g.setAttribute('splat', new THREE.BufferAttribute(this.splat.slice(0, n * 4), 4));
    g.setIndex(new THREE.BufferAttribute(n > 65535 ? this.idx.slice(0, this.icount) : new Uint16Array(this.idx.subarray(0, this.icount)), 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

function clampUnit(v: number) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}
