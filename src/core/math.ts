// Utilidades matemáticas compartidas por la simulación y el render.
// El mundo es un plano XZ (metros) con Y hacia arriba.

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (a === b ? 0 : (v - a) / (b - a));
export const remap = (v: number, a: number, b: number, c: number, d: number) => c + (d - c) * clamp01(invLerp(a, b, v));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const sign = (v: number) => (v < 0 ? -1 : 1);
export const sqr = (v: number) => v * v;

/** Aproximación exponencial independiente del paso de tiempo. */
export const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Diferencia angular más corta de a hacia b, en (-PI, PI]. */
export function angleDiff(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}
export function angleLerp(a: number, b: number, t: number) {
  return a + angleDiff(a, b) * t;
}
export function angleDamp(a: number, b: number, lambda: number, dt: number) {
  return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));
}
/** Gira `a` hacia `b` como mucho `maxStep` radianes. */
export function angleToward(a: number, b: number, maxStep: number) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

export interface V2 {
  x: number;
  z: number;
}

export const v2 = (x = 0, z = 0): V2 => ({ x, z });
export const dist = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);
export const dist2 = (ax: number, az: number, bx: number, bz: number) => (ax - bx) * (ax - bx) + (az - bz) * (az - bz);
export const vdist = (a: V2, b: V2) => Math.hypot(a.x - b.x, a.z - b.z);

/** Distancia de un punto a un segmento y parámetro t del punto más cercano. */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): [number, number] {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (pz - az) * dz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.hypot(px - (ax + t * dx), pz - (az + t * dz)), t];
}

/** Rota (x,z) un ángulo `a` (sentido de +X hacia +Z). */
export function rot2(x: number, z: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - z * s, x * s + z * c];
}

// ---------------------------------------------------------------------------
// Hash y ruido deterministas (sin estado).
// ---------------------------------------------------------------------------

export function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hash3(x: number, y: number, z: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Ruido de valor 2D suave en [0,1]. */
export function noise2(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

export function noise3(x: number, y: number, z: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const zf = fade(z - zi);
  const n = (i: number, j: number, k: number) => hash3(xi + i, yi + j, zi + k, seed);
  const x00 = lerp(n(0, 0, 0), n(1, 0, 0), xf);
  const x10 = lerp(n(0, 1, 0), n(1, 1, 0), xf);
  const x01 = lerp(n(0, 0, 1), n(1, 0, 1), xf);
  const x11 = lerp(n(0, 1, 1), n(1, 1, 1), xf);
  return lerp(lerp(x00, x10, yf), lerp(x01, x11, yf), zf);
}

/** Ruido fractal (fBm) 2D en [0,1]. */
export function fbm2(x: number, y: number, octaves = 4, seed = 0, lacunarity = 2, gain = 0.5): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x, y, seed + i * 131) * amp;
    norm += amp;
    x *= lacunarity;
    y *= lacunarity;
    amp *= gain;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Curvas
// ---------------------------------------------------------------------------

/** Interpolación de Hermite cúbica. */
export function hermite(p0: number, m0: number, p1: number, m1: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * m1;
}

export function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Longitud de una polilínea. */
export function polylineLength(pts: V2[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += vdist(pts[i - 1], pts[i]);
  return l;
}

/** Remuestrea una polilínea a pasos de longitud ~`step` conservando los extremos. */
export function resample(pts: V2[], step: number): V2[] {
  const total = polylineLength(pts);
  const n = Math.max(1, Math.round(total / step));
  const out: V2[] = [{ x: pts[0].x, z: pts[0].z }];
  let seg = 1;
  let acc = 0;
  let segLen = vdist(pts[0], pts[1]);
  for (let i = 1; i < n; i++) {
    const target = (total * i) / n;
    while (acc + segLen < target && seg < pts.length - 1) {
      acc += segLen;
      seg++;
      segLen = vdist(pts[seg - 1], pts[seg]);
    }
    const t = segLen === 0 ? 0 : (target - acc) / segLen;
    out.push({ x: lerp(pts[seg - 1].x, pts[seg].x, t), z: lerp(pts[seg - 1].z, pts[seg].z, t) });
  }
  const last = pts[pts.length - 1];
  out.push({ x: last.x, z: last.z });
  return out;
}

/** Formatea un número con separador de miles español. */
export function fmt(n: number, digits = 0) {
  return n.toLocaleString('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
