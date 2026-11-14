// Texturas procedurales: todo se sintetiza en el navegador (color, relieve
// convertido en mapa de normales y rugosidad). No hay ni un archivo de imagen.

import * as THREE from 'three';
import { clamp01, hash2, lerp, smoothstep } from '../core/math';

export interface SurfaceTex {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

/** Salida de un téxel: color sRGB, altura, rugosidad y alfa. */
interface Texel {
  r: number;
  g: number;
  b: number;
  h: number;
  rough: number;
  a: number;
}

// --- Ruido periódico -------------------------------------------------------

const fade = (t: number) => t * t * (3 - 2 * t);
const wrap = (i: number, n: number) => ((i % n) + n) % n;

/** Ruido de valor periódico: x en [0,px), y en [0,py). */
function pn(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = fade(x - xi);
  const yf = fade(y - yi);
  const x0 = wrap(xi, px);
  const x1 = wrap(xi + 1, px);
  const y0 = wrap(yi, py);
  const y1 = wrap(yi + 1, py);
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** fBm periódico: `freq` periodos enteros en la textura. */
function pfbm(u: number, v: number, freq: number, oct: number, seed: number, gain = 0.5): number {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  let f = freq;
  for (let i = 0; i < oct; i++) {
    sum += pn(u * f, v * f, f, f, seed + i * 17) * amp;
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

/** Ruido celular periódico: distancia al punto más cercano, al segundo y hash de celda. */
function pcell(u: number, v: number, n: number, seed: number, out: [number, number, number]): void {
  const x = u * n;
  const y = v * n;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = 9;
  let d2 = 9;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = wrap(xi + i, n);
      const cy = wrap(yi + j, n);
      const px = xi + i + 0.15 + hash2(cx, cy, seed) * 0.7;
      const py = yi + j + 0.15 + hash2(cx, cy, seed + 1) * 0.7;
      const d = Math.hypot(px - x, py - y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash2(cx, cy, seed + 2);
      } else if (d < d2) d2 = d;
    }
  }
  out[0] = d1;
  out[1] = d2;
  out[2] = id;
}

// --- Síntesis ---------------------------------------------------------------

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: false })!];
}

function finish(tex: THREE.Texture, srgb: boolean, repeat = true): THREE.Texture {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.flipY = false;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function synth(w: number, h: number, fn: (u: number, v: number, t: Texel) => void, normalStrength = 2.2, alpha = false): SurfaceTex {
  const [cc, cctx] = canvasOf(w, h);
  const [nc, nctx] = canvasOf(w, h);
  const [rc, rctx] = canvasOf(w, h);
  const cimg = cctx.createImageData(w, h);
  const nimg = nctx.createImageData(w, h);
  const rimg = rctx.createImageData(w, h);
  const height = new Float32Array(w * h);
  const t: Texel = { r: 0, g: 0, b: 0, h: 0, rough: 0.8, a: 1 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      t.r = t.g = t.b = 0.5;
      t.h = 0;
      t.rough = 0.8;
      t.a = 1;
      fn((x + 0.5) / w, (y + 0.5) / h, t);
      const i = (y * w + x) * 4;
      cimg.data[i] = clamp01(t.r) * 255;
      cimg.data[i + 1] = clamp01(t.g) * 255;
      cimg.data[i + 2] = clamp01(t.b) * 255;
      cimg.data[i + 3] = alpha ? clamp01(t.a) * 255 : 255;
      height[y * w + x] = t.h;
      const rr = clamp01(t.rough) * 255;
      rimg.data[i] = rr;
      rimg.data[i + 1] = rr;
      rimg.data[i + 2] = rr;
      rimg.data[i + 3] = 255;
    }
  }
  // Relieve -> normales (Sobel con envoltura)
  for (let y = 0; y < h; y++) {
    const y0 = wrap(y - 1, h) * w;
    const y1 = y * w;
    const y2 = wrap(y + 1, h) * w;
    for (let x = 0; x < w; x++) {
      const x0 = wrap(x - 1, w);
      const x2 = wrap(x + 1, w);
      const dx = height[y0 + x2] + 2 * height[y1 + x2] + height[y2 + x2] - height[y0 + x0] - 2 * height[y1 + x0] - height[y2 + x0];
      const dy = height[y2 + x0] + 2 * height[y2 + x] + height[y2 + x2] - height[y0 + x0] - 2 * height[y0 + x] - height[y0 + x2];
      let nx = -dx * normalStrength;
      let ny = -dy * normalStrength;
      const l = Math.hypot(nx, ny, 1);
      nx /= l;
      ny /= l;
      const i = (y * w + x) * 4;
      nimg.data[i] = (nx * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (1 / l) * 0.5 * 255 + 127.5;
      nimg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  nctx.putImageData(nimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return {
    map: finish(new THREE.CanvasTexture(cc), true),
    normalMap: finish(new THREE.CanvasTexture(nc), false),
    roughnessMap: finish(new THREE.CanvasTexture(rc), false),
  };
}

const cellOut: [number, number, number] = [0, 0, 0];

// --- Superficies -------------------------------------------------------------

/** Hormigón: manchas, poros, fisuras finas. Cubre 4 x 4 m. */
function concrete(seed: number, formwork: boolean): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const big = pfbm(u, v, 3, 5, seed);
    const fine = pfbm(u, v, 48, 3, seed + 5);
    const stain = smoothstep(0.52, 0.72, pfbm(u, v, 2, 4, seed + 9));
    let c = 0.47 + (big - 0.5) * 0.2 + (fine - 0.5) * 0.09;
    c -= stain * 0.1;
    // Fisuras: curvas de nivel estrechas de un ruido suave
    const crackN = pfbm(u, v, 4, 4, seed + 21);
    const crack = 1 - smoothstep(0.0, 0.0035, Math.abs(crackN - 0.5));
    const crackMask = smoothstep(0.56, 0.7, pfbm(u, v, 2, 2, seed + 30));
    const ck = crack * crackMask;
    // Poros
    pcell(u, v, 40, seed + 40, cellOut);
    const pore = (1 - smoothstep(0.04, 0.1, cellOut[0])) * (cellOut[2] > 0.72 ? 1 : 0);
    let h = big * 0.4 + fine * 0.22 - ck * 0.3 - pore * 0.3;
    if (formwork) {
      // Juntas de encofrado cada 1 m y chorretones verticales
      const jv = Math.abs(((v * 4) % 1) - 0.5);
      const joint = smoothstep(0.485, 0.5, jv);
      h -= joint * 0.5;
      c -= joint * 0.07;
      const drip = smoothstep(0.62, 0.9, pn(u * 40, v * 3, 40, 3, seed + 60)) * smoothstep(0.3, 0.8, pfbm(u, v, 3, 2, seed + 61));
      c -= drip * 0.08;
    }
    c -= ck * 0.1 + pore * 0.08;
    t.r = c * 1.0;
    t.g = c * 0.99;
    t.b = c * 0.965;
    t.h = h;
    t.rough = 0.82 + (fine - 0.5) * 0.2 - stain * 0.12;
  });
}

/** Dovelas de túnel (tubbing): paneles atornillados, óxido y cal. 2 anillos x 2 m de alto. */
function tubbing(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const cu = (u * 2) % 1; // anillo de 1 m
    const row = Math.floor(v * 2);
    const cv = (v * 2) % 1; // dovela de 1 m
    const su = (cu + (row % 2) * 0.5) % 1;
    const eu = Math.min(su, 1 - su);
    const ev = Math.min(cv, 1 - cv);
    const edge = Math.min(eu, ev);
    const flange = 1 - smoothstep(0.035, 0.07, edge);
    const inner = smoothstep(0.07, 0.16, edge);
    // Nervio central vertical de cada dovela
    const rib = 1 - smoothstep(0.012, 0.03, Math.abs(su - 0.5));
    // Tornillos en las bridas
    const bu = Math.abs(((su * 4) % 1) - 0.5);
    const bv = Math.abs(((cv * 4) % 1) - 0.5);
    const boltU = ev < 0.07 ? 1 - smoothstep(0.05, 0.11, Math.hypot(bu, (ev - 0.035) * 4)) : 0;
    const boltV = eu < 0.07 ? 1 - smoothstep(0.05, 0.11, Math.hypot(bv, (eu - 0.035) * 4)) : 0;
    const bolt = Math.max(boltU, boltV);
    const big = pfbm(u, v, 3, 4, seed);
    const fine = pfbm(u, v, 40, 3, seed + 3);
    const rustN = pfbm(u, v, 5, 4, seed + 7);
    const rust = smoothstep(0.5, 0.7, rustN + flange * 0.12 + bolt * 0.2);
    // Chorretones de óxido y de cal hacia abajo
    const streak = smoothstep(0.6, 0.95, pn(u * 48, v * 2, 48, 2, seed + 11)) * smoothstep(0.35, 0.7, pfbm(u, v, 4, 2, seed + 13));
    const lime = smoothstep(0.72, 0.97, pn(u * 36, v * 2, 36, 2, seed + 15)) * smoothstep(0.5, 0.8, pfbm(u, v, 3, 2, seed + 17));
    let r = 0.3 + (big - 0.5) * 0.12 + (fine - 0.5) * 0.07;
    let g = r * 0.98;
    let b = r * 0.96;
    // Óxido
    r = lerp(r, 0.4, rust * 0.75);
    g = lerp(g, 0.225, rust * 0.75);
    b = lerp(b, 0.13, rust * 0.75);
    r = lerp(r, 0.36, streak * 0.5);
    g = lerp(g, 0.2, streak * 0.5);
    b = lerp(b, 0.12, streak * 0.5);
    // Cal
    r = lerp(r, 0.66, lime * 0.5);
    g = lerp(g, 0.66, lime * 0.5);
    b = lerp(b, 0.62, lime * 0.5);
    const shade = 1 - inner * 0.16 + flange * 0.05;
    t.r = r * shade;
    t.g = g * shade;
    t.b = b * shade;
    t.h = flange * 0.9 + rib * 0.55 * inner + bolt * 0.6 - inner * 0.2 + fine * 0.12 + rust * 0.08;
    t.rough = 0.62 + rust * 0.28 + lime * 0.1 - bolt * 0.1;
  }, 2.6);
}

/** Balasto: piedra partida. Cubre 2 x 2 m. */
function ballast(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    pcell(u, v, 26, seed, cellOut);
    const d1 = cellOut[0];
    const d2 = cellOut[1];
    const id = cellOut[2];
    const gap = smoothstep(0.0, 0.16, d2 - d1);
    const fine = pfbm(u, v, 64, 2, seed + 4);
    const oil = smoothstep(0.5, 0.75, pfbm(u, v, 2, 4, seed + 8));
    let c = 0.2 + id * 0.2 + (fine - 0.5) * 0.08;
    c *= 0.4 + gap * 0.6;
    c *= 1 - oil * 0.35;
    const warm = id > 0.6 ? 1.06 : 0.98;
    t.r = c * warm;
    t.g = c * 0.985;
    t.b = c * (2 - warm) * 0.95;
    t.h = gap * (0.5 + id * 0.5) * (1 - d1 * 0.6);
    t.rough = 0.9 - oil * 0.25;
  }, 3.2);
}

/** Losas de andén (granito): 4 x 4 losas de 0,6 m con desgaste. */
function floorTiles(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const n = 4;
    const tx = Math.floor(u * n);
    const ty = Math.floor(v * n);
    const fu = u * n - tx;
    const fv = v * n - ty;
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
    const grout = 1 - smoothstep(0.012, 0.03, edge);
    const id = hash2(tx, ty, seed);
    const speck = pfbm(u, v, 80, 2, seed + 2);
    const cloud = pfbm(u, v, 6, 4, seed + 4);
    const wear = smoothstep(0.45, 0.75, pfbm(u, v, 3, 4, seed + 6));
    const checker = (tx + ty) % 2 === 0 ? 0.035 : -0.035;
    let c = 0.44 + checker + (id - 0.5) * 0.07 + (speck - 0.5) * 0.14 + (cloud - 0.5) * 0.1;
    c += wear * 0.05;
    // Losas rotas
    const broken = id > 0.9;
    let crack = 0;
    if (broken) {
      const cn = pn(u * 24, v * 24, 24, 24, seed + 9);
      crack = 1 - smoothstep(0.0, 0.05, Math.abs(cn - 0.5));
      c -= crack * 0.2 + 0.04;
    }
    c = lerp(c, 0.17, grout);
    t.r = c * 1.01;
    t.g = c * 0.98;
    t.b = c * 0.94;
    t.h = (1 - grout) * 0.5 + speck * 0.06 - crack * 0.3 + (id - 0.5) * 0.08;
    t.rough = lerp(0.42 + wear * 0.3 + (speck - 0.5) * 0.1, 0.95, grout);
  }, 1.8);
}

/** Azulejo cerámico de pared: 8 x 8 azulejos de 15 cm, algunos caídos. */
function wallTiles(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const n = 8;
    const tx = Math.floor(u * n);
    const ty = Math.floor(v * n);
    const fu = u * n - tx;
    const fv = v * n - ty;
    const edge = Math.min(fu, 1 - fu, fv, 1 - fv);
    const grout = 1 - smoothstep(0.03, 0.07, edge);
    const id = hash2(tx, ty, seed);
    const missing = id > 0.93;
    const dirt = pfbm(u, v, 4, 4, seed + 3);
    const grime = smoothstep(0.45, 0.8, dirt);
    const fine = pfbm(u, v, 64, 2, seed + 5);
    let c = 0.8 + (id - 0.5) * 0.08 - grime * 0.22;
    // Bisel del azulejo
    const bevel = smoothstep(0.03, 0.16, edge);
    let h = bevel * 0.6;
    let rough = 0.22 + grime * 0.35;
    if (missing) {
      c = 0.36 + (fine - 0.5) * 0.12;
      h = -0.25 + fine * 0.2;
      rough = 0.95;
    }
    c = lerp(c, 0.3, grout * (missing ? 0 : 1));
    t.r = c;
    t.g = c * 0.995;
    t.b = c * 0.97;
    t.h = h;
    t.rough = lerp(rough, 0.9, grout);
  }, 2.0);
}

/** Mármol pulido en placas de 1,2 x 0,6 m con vetas. */
function marble(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const row = Math.floor(v * 4);
    const su = (u * 2 + (row % 2) * 0.5) % 1;
    const sv = (v * 4) % 1;
    const edge = Math.min(su * 2, (1 - su) * 2, sv, 1 - sv);
    const joint = 1 - smoothstep(0.01, 0.025, edge);
    const warp = pfbm(u, v, 3, 4, seed) * 2.2;
    const vein = Math.abs(Math.sin((u * 3 + v * 2 + warp) * Math.PI * 2));
    const veins = 1 - smoothstep(0.0, 0.12, vein);
    const cloud = pfbm(u, v, 5, 4, seed + 4);
    const id = hash2(Math.floor(u * 2 + (row % 2) * 0.5), row, seed + 8);
    let c = 0.66 + (cloud - 0.5) * 0.16 + (id - 0.5) * 0.06;
    c -= veins * 0.22 * smoothstep(0.3, 0.7, pfbm(u, v, 2, 3, seed + 12));
    const dirt = smoothstep(0.55, 0.85, pfbm(u, v, 4, 4, seed + 15));
    c -= dirt * 0.14;
    c = lerp(c, 0.2, joint);
    t.r = c * 1.02;
    t.g = c * 0.985;
    t.b = c * 0.93;
    t.h = (1 - joint) * 0.4;
    t.rough = lerp(0.24 + dirt * 0.4, 0.9, joint);
  }, 1.4);
}

/** Ladrillo a soga: 4 x 12 hiladas en 1 x 1 m. */
function brick(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const rows = 12;
    const cols = 4;
    const ry = Math.floor(v * rows);
    const fv = v * rows - ry;
    const su = u * cols + (ry % 2) * 0.5;
    const bx = Math.floor(su);
    const fu = su - bx;
    const id = hash2(wrap(bx, cols), ry, seed);
    const mortar = Math.max(1 - smoothstep(0.03, 0.07, Math.min(fu, 1 - fu)), 1 - smoothstep(0.08, 0.17, Math.min(fv, 1 - fv)));
    const fine = pfbm(u, v, 64, 3, seed + 3);
    const soot = smoothstep(0.45, 0.8, pfbm(u, v, 3, 4, seed + 6));
    let r = 0.42 + (id - 0.5) * 0.16 + (fine - 0.5) * 0.1;
    let g = 0.22 + (id - 0.5) * 0.08 + (fine - 0.5) * 0.06;
    let b = 0.17 + (id - 0.5) * 0.05 + (fine - 0.5) * 0.04;
    if (id > 0.85) {
      r *= 0.7;
      g *= 0.72;
      b *= 0.8;
    }
    const k = 1 - soot * 0.4;
    r *= k;
    g *= k;
    b *= k;
    const mc = 0.46 + (fine - 0.5) * 0.12 - soot * 0.12;
    t.r = lerp(r, mc, mortar);
    t.g = lerp(g, mc * 0.98, mortar);
    t.b = lerp(b, mc * 0.94, mortar);
    t.h = (1 - mortar) * 0.6 + fine * 0.2 + (id - 0.5) * 0.15;
    t.rough = 0.88;
  }, 2.4);
}

/** Tablones de madera: 5 tablas de 20 cm a lo largo de U. */
function planks(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const n = 5;
    const row = Math.floor(v * n);
    const fv = v * n - row;
    const id = hash2(row, 7, seed);
    const gap = 1 - smoothstep(0.02, 0.06, Math.min(fv, 1 - fv));
    // Junta a tope en cada tabla
    const jointPos = hash2(row, 3, seed + 1);
    const du = Math.abs(u - jointPos);
    const butt = 1 - smoothstep(0.003, 0.008, Math.min(du, 1 - du));
    const grain = pfbm(u * 0.5 + id * 3, v * n * 0.5, 4, 4, seed + 4);
    const lines = pn(u * 6 + grain * 2.5, (v * n + id * 9) * 14, 6, n * 14, seed + 6);
    // Nudos
    pcell(u, v, 5, seed + 8, cellOut);
    const knot = (1 - smoothstep(0.03, 0.09, cellOut[0])) * (cellOut[2] > 0.6 ? 1 : 0);
    let c = 0.36 + (id - 0.5) * 0.14 + (lines - 0.5) * 0.14 + (grain - 0.5) * 0.08;
    c -= knot * 0.16;
    const dirt = smoothstep(0.5, 0.85, pfbm(u, v, 3, 3, seed + 11));
    c -= dirt * 0.1;
    c = lerp(c, 0.07, Math.max(gap, butt));
    t.r = c * 1.12;
    t.g = c * 0.9;
    t.b = c * 0.66;
    t.h = (1 - Math.max(gap, butt)) * 0.7 + (lines - 0.5) * 0.25 - knot * 0.2 + (id - 0.5) * 0.2;
    t.rough = 0.86;
  }, 2.2);
}

/** Chapa ondulada con pintura vieja y óxido. */
function rustMetal(seed: number, corrugated: boolean): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const wave = corrugated ? Math.sin(u * Math.PI * 2 * 12) : 0;
    const big = pfbm(u, v, 3, 5, seed);
    const fine = pfbm(u, v, 56, 3, seed + 2);
    const rustN = pfbm(u, v, 4, 5, seed + 5) + (fine - 0.5) * 0.25;
    const rust = smoothstep(0.48, 0.62, rustN);
    const heavy = smoothstep(0.62, 0.78, rustN);
    const streak = smoothstep(0.6, 0.95, pn(u * 60, v * 2, 60, 2, seed + 8)) * smoothstep(0.4, 0.75, pfbm(u, v, 3, 2, seed + 9));
    // Chapa unida con remaches cada 0,5 m
    const pu = Math.abs(((u * 2) % 1) - 0.5);
    const pv = Math.abs(((v * 2) % 1) - 0.5);
    const seam = corrugated ? 0 : Math.max(smoothstep(0.485, 0.5, pu), smoothstep(0.485, 0.5, pv));
    const rivU = Math.abs(((u * 16) % 1) - 0.5);
    const rivV = Math.abs(((v * 16) % 1) - 0.5);
    const rivet = corrugated ? 0 : (pu > 0.44 || pv > 0.44 ? 1 : 0) * (1 - smoothstep(0.1, 0.2, Math.hypot(rivU, rivV)));
    // Pintura base clara (se tiñe con el color de vértice)
    let r = 0.62 + (big - 0.5) * 0.1 + (fine - 0.5) * 0.06;
    let g = r;
    let b = r;
    r = lerp(r, 0.45, rust);
    g = lerp(g, 0.25, rust);
    b = lerp(b, 0.14, rust);
    r = lerp(r, 0.23, heavy);
    g = lerp(g, 0.12, heavy);
    b = lerp(b, 0.08, heavy);
    r = lerp(r, 0.38, streak * 0.5);
    g = lerp(g, 0.22, streak * 0.5);
    b = lerp(b, 0.13, streak * 0.5);
    const sh = 1 + wave * 0.1 - seam * 0.25;
    t.r = r * sh;
    t.g = g * sh;
    t.b = b * sh;
    t.h = wave * 0.5 + rust * 0.1 + fine * 0.08 - seam * 0.4 + rivet * 0.5;
    t.rough = 0.5 + rust * 0.35 + heavy * 0.1;
  }, corrugated ? 1.6 : 1.8);
}

/** Roca y tierra compactada (cuevas y derrumbes). */
function rock(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const big = pfbm(u, v, 3, 5, seed);
    const ridge = 1 - Math.abs(pfbm(u, v, 4, 5, seed + 3) - 0.5) * 2;
    const strata = pn(u * 2 + big * 1.5, v * 18 + big * 4, 2, 18, seed + 6);
    const fine = pfbm(u, v, 48, 3, seed + 9);
    pcell(u, v, 9, seed + 12, cellOut);
    const facet = smoothstep(0.0, 0.2, cellOut[1] - cellOut[0]);
    let c = 0.22 + (big - 0.5) * 0.14 + (strata - 0.5) * 0.08 + (fine - 0.5) * 0.07;
    c *= 0.72 + facet * 0.28;
    t.r = c * 1.06;
    t.g = c * 0.98;
    t.b = c * 0.9;
    t.h = ridge * 0.5 + facet * 0.5 + fine * 0.15 + cellOut[2] * 0.3;
    t.rough = 0.93;
  }, 2.6);
}

/** Barro y tierra con guijarros. */
function dirt(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const big = pfbm(u, v, 3, 5, seed);
    const fine = pfbm(u, v, 40, 3, seed + 2);
    pcell(u, v, 22, seed + 4, cellOut);
    const pebble = (1 - smoothstep(0.12, 0.26, cellOut[0])) * (cellOut[2] > 0.55 ? 1 : 0);
    const wet = smoothstep(0.52, 0.7, pfbm(u, v, 2, 4, seed + 7));
    let c = 0.2 + (big - 0.5) * 0.12 + (fine - 0.5) * 0.08;
    c *= 1 - wet * 0.35;
    const pc = 0.3 + cellOut[2] * 0.14;
    t.r = lerp(c * 1.12, pc, pebble);
    t.g = lerp(c * 0.95, pc * 0.98, pebble);
    t.b = lerp(c * 0.78, pc * 0.94, pebble);
    t.h = big * 0.5 + fine * 0.2 + pebble * 0.5 - wet * 0.25;
    t.rough = 0.92 - wet * 0.5;
  }, 2.2);
}

/** Lona y tela gruesa (tiendas): trama fina y arrugas. Color claro, se tiñe. */
function canvasCloth(seed: number): SurfaceTex {
  return synth(256, 256, (u, v, t) => {
    const weaveU = Math.sin(u * Math.PI * 2 * 64);
    const weaveV = Math.sin(v * Math.PI * 2 * 64);
    const fold = pfbm(u, v, 3, 4, seed);
    const stain = smoothstep(0.5, 0.8, pfbm(u, v, 4, 4, seed + 5));
    const c = 0.78 + (fold - 0.5) * 0.2 + weaveU * weaveV * 0.035 - stain * 0.16;
    t.r = c;
    t.g = c * 0.985;
    t.b = c * 0.95;
    t.h = fold * 0.9 + (weaveU + weaveV) * 0.05;
    t.rough = 0.95;
  }, 1.5);
}

/**
 * Lecho de vía: balasto, traviesas y placas. U cruza la vía (2,6 m) y V la
 * recorre (2,4 m = 4 traviesas). El borde es irregular (alfa).
 */
function trackBed(seed: number): SurfaceTex {
  return synth(
    256,
    512,
    (u, v, t) => {
      pcell(u * 0.5, v, 30, seed, cellOut);
      const gap = smoothstep(0.0, 0.16, cellOut[1] - cellOut[0]);
      const id = cellOut[2];
      const fine = pfbm(u, v, 48, 2, seed + 3);
      const oilCenter = 1 - smoothstep(0.0, 0.14, Math.abs(u - 0.5));
      let c = (0.2 + id * 0.18 + (fine - 0.5) * 0.08) * (0.42 + gap * 0.58);
      c *= 1 - oilCenter * 0.35;
      let r = c * 1.03;
      let g = c * 0.99;
      let b = c * 0.93;
      let h = gap * (0.4 + id * 0.4);
      let rough = 0.9 - oilCenter * 0.2;
      // Traviesas
      const sv = (v * 4) % 1;
      const inSleeper = Math.abs(sv - 0.5) < 0.19 && u > 0.07 && u < 0.93;
      if (inSleeper) {
        const sid = hash2(Math.floor(v * 4), 3, seed + 6);
        const grain = pn(u * 4, v * 160, 4, 160, seed + 8);
        const edge = Math.min(0.19 - Math.abs(sv - 0.5), Math.min(u - 0.07, 0.93 - u) * 0.6);
        const bevel = smoothstep(0.0, 0.03, edge);
        const sc = 0.26 + (sid - 0.5) * 0.08 + (grain - 0.5) * 0.09 + (fine - 0.5) * 0.05;
        r = sc * 1.08 * (0.6 + bevel * 0.4);
        g = sc * 0.95 * (0.6 + bevel * 0.4);
        b = sc * 0.8 * (0.6 + bevel * 0.4);
        h = 0.9 * bevel + (grain - 0.5) * 0.15;
        rough = 0.85;
        // Placas de asiento bajo los carriles
        for (const ru of [0.5 - 0.292, 0.5 + 0.292]) {
          const pu = Math.abs(u - ru);
          if (pu < 0.06 && Math.abs(sv - 0.5) < 0.15) {
            r = 0.2;
            g = 0.15;
            b = 0.12;
            h = 1.05;
            rough = 0.6;
            const bolt = Math.hypot((pu - 0.042) * 2.6, Math.abs(sv - 0.5) - 0.1);
            if (bolt < 0.03) h = 1.3;
          }
        }
      }
      // Borde irregular
      const edgeN = pn(u * 3, v * 14, 3, 14, seed + 12) * 0.05;
      const a = smoothstep(0.0, 0.035, Math.min(u, 1 - u) - 0.01 - edgeN);
      t.r = r;
      t.g = g;
      t.b = b;
      t.h = h;
      t.rough = rough;
      t.a = a;
    },
    3.0,
    true,
  );
}

// --- Superficie ---------------------------------------------------------------

/** Nieve: ondulaciones suaves, brillo granulado y algún pisotón sucio. Cubre 6 x 6 m. */
function snow(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const big = pfbm(u, v, 2, 4, seed);
    const mid = pfbm(u, v, 6, 3, seed + 3);
    const fine = pfbm(u, v, 80, 2, seed + 7);
    const dirt = smoothstep(0.58, 0.85, pfbm(u, v, 2, 4, seed + 11)) * 0.5;
    const spark = hash2(Math.floor(u * 512), Math.floor(v * 512), seed + 13) > 0.998 ? 0.2 : 0;
    const c = 0.72 + (big - 0.5) * 0.12 + (mid - 0.5) * 0.05 + (fine - 0.5) * 0.04 - dirt * 0.16 + spark;
    t.r = c * 0.97;
    t.g = c * 0.99;
    t.b = c * 1.04;
    t.h = big * 0.7 + mid * 0.25 + fine * 0.05;
    t.rough = 0.62 - spark * 1.5 + dirt * 0.2;
  }, 1.2);
}

/** Asfalto agrietado con nieve en las grietas y placas de hielo. Cubre 4 x 4 m. */
function asphalt(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const big = pfbm(u, v, 3, 4, seed);
    const grain = hash2(Math.floor(u * 512), Math.floor(v * 512), seed + 1);
    const crackN = pfbm(u, v, 5, 4, seed + 21);
    const crack = 1 - smoothstep(0.0, 0.004, Math.abs(crackN - 0.5));
    const ice = smoothstep(0.66, 0.8, pfbm(u, v, 2, 3, seed + 31));
    const dust = smoothstep(0.55, 0.85, pfbm(u, v, 2, 3, seed + 41));
    let c = 0.24 + (big - 0.5) * 0.06 + (grain - 0.5) * 0.05;
    c = lerp(c, 0.5, crack * 0.45);
    c = lerp(c, 0.5, dust * 0.4);
    c = lerp(c, 0.36, ice * 0.4);
    t.r = c * 0.98;
    t.g = c * 1.0;
    t.b = c * 1.05;
    t.h = big * 0.3 + grain * 0.12 - crack * 0.4;
    t.rough = 0.9 - ice * 0.65;
  }, 2.0);
}

/** Ventana de fachada en una celda (fu, fv en 0..1): devuelve el color o null si es muro. */
function windowCell(fu: number, fv: number, w: number, h: number, sill: number, id: number, out: [number, number, number, number]): boolean {
  const x0 = 0.5 - w / 2;
  const x1 = 0.5 + w / 2;
  const y0 = sill;
  const y1 = sill + h;
  const frame = 0.035;
  if (fu < x0 - frame || fu > x1 + frame || fv < y0 - frame || fv > y1 + frame) {
    // Nieve en el alféizar
    if (fu > x0 - frame && fu < x1 + frame && fv > y0 - frame - 0.04 && fv < y0 - frame) {
      out[0] = out[1] = out[2] = 0.9;
      out[3] = 0.3;
      return true;
    }
    return false;
  }
  const inner = fu > x0 && fu < x1 && fv > y0 && fv < y1;
  if (!inner) {
    out[0] = out[1] = out[2] = 0.62;
    out[3] = 0.5;
    return true;
  }
  if (id < 0.12) {
    // Tapiada con tablones
    const plank = Math.floor((fv - y0) / (h / 4));
    const k = 0.32 + hash2(plank, Math.floor(id * 100), 3) * 0.12;
    out[0] = k * 1.1;
    out[1] = k * 0.85;
    out[2] = k * 0.6;
    out[3] = 0.25;
    return true;
  }
  // Cristal oscuro (o el hueco negro de un cristal roto) con el parteluz
  const broken = id > 0.7;
  const mull = Math.abs(fu - 0.5) < 0.012 || Math.abs(fv - (y0 + h * 0.62)) < 0.012;
  if (mull) {
    out[0] = out[1] = out[2] = 0.55;
    out[3] = 0.4;
    return true;
  }
  const g = broken ? 0.03 : 0.08 + (fv - y0) * 0.12;
  out[0] = g * 0.9;
  out[1] = g * 1.0;
  out[2] = g * 1.15;
  out[3] = -0.6;
  return true;
}

const winOut: [number, number, number, number] = [0, 0, 0, 0];

/** Fachada de paneles prefabricados: 2 crujías x 2 plantas (6 x 6 m). */
function facadePanel(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const bu = u * 2;
    const bv = v * 2;
    const cu = bu - Math.floor(bu);
    const cv = 1 - (bv - Math.floor(bv));
    const id = hash2(Math.floor(bu), Math.floor(bv), seed);
    const fine = pfbm(u, v, 48, 3, seed + 3);
    const stain = smoothstep(0.5, 0.8, pfbm(u * 3, v * 0.6, 3, 3, seed + 6));
    let c = 0.6 + (fine - 0.5) * 0.08 - stain * 0.14;
    const joint = Math.max(1 - smoothstep(0.004, 0.012, Math.min(cu, 1 - cu)), 1 - smoothstep(0.004, 0.012, Math.min(cv, 1 - cv)));
    c -= joint * 0.25;
    let r = c * 0.98;
    let g = c * 0.96;
    let b = c * 0.92;
    let h = 0.5 + fine * 0.1 - joint * 0.4;
    // Chorreones de óxido bajo la ventana
    const rust = (Math.abs(cu - 0.5) < 0.22 ? 1 : 0) * smoothstep(0.32, 0.05, cv) * smoothstep(0.55, 0.8, pn(u * 60, v * 4, 60, 4, seed + 9)) * 0.4;
    r += rust * 0.12;
    g -= rust * 0.04;
    b -= rust * 0.08;
    if (windowCell(cu, cv, 0.48, 0.44, 0.3, id, winOut)) {
      r = winOut[0];
      g = winOut[1];
      b = winOut[2];
      h = 0.5 + winOut[3] * 0.5;
    }
    t.r = r;
    t.g = g;
    t.b = b;
    t.h = h;
    t.rough = 0.85;
  }, 2.4);
}

/** Fachada de ladrillo con ventanas de marco blanco: 2 crujías x 2 plantas (6 x 6 m). */
function facadeBrick(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const bu = u * 2;
    const bv = v * 2;
    const cu = bu - Math.floor(bu);
    const cv = 1 - (bv - Math.floor(bv));
    const id = hash2(Math.floor(bu), Math.floor(bv), seed);
    const rows = 80;
    const ry = Math.floor(v * rows);
    const fv = v * rows - ry;
    const su = u * 24 + (ry % 2) * 0.5;
    const bx = Math.floor(su);
    const fu = su - bx;
    const bid = hash2(wrap(bx, 24), ry, seed + 1);
    const mortar = Math.max(1 - smoothstep(0.04, 0.09, Math.min(fu, 1 - fu)), 1 - smoothstep(0.1, 0.2, Math.min(fv, 1 - fv)));
    const soot = smoothstep(0.45, 0.85, pfbm(u, v, 3, 3, seed + 6));
    let r = (0.46 + (bid - 0.5) * 0.14) * (1 - soot * 0.35);
    let g = (0.24 + (bid - 0.5) * 0.07) * (1 - soot * 0.35);
    let b = (0.18 + (bid - 0.5) * 0.05) * (1 - soot * 0.35);
    r = lerp(r, 0.5, mortar);
    g = lerp(g, 0.49, mortar);
    b = lerp(b, 0.46, mortar);
    let h = (1 - mortar) * 0.5;
    if (windowCell(cu, cv, 0.38, 0.5, 0.28, id, winOut)) {
      const frame = winOut[3] > 0.45 && winOut[3] < 0.55;
      r = frame ? 0.8 : winOut[0];
      g = frame ? 0.78 : winOut[1];
      b = frame ? 0.72 : winOut[2];
      h = 0.5 + winOut[3] * 0.5;
    }
    t.r = r;
    t.g = g;
    t.b = b;
    t.h = h;
    t.rough = 0.88;
  }, 2.2);
}

/** Fachada estalinista: estuco ocre, ventanas altas, impostas y pilastras (6 x 6 m). */
function facadeStucco(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    const bu = u * 2;
    const bv = v * 2;
    const cu = bu - Math.floor(bu);
    const cv = 1 - (bv - Math.floor(bv));
    const id = hash2(Math.floor(bu), Math.floor(bv), seed);
    const fine = pfbm(u, v, 40, 3, seed + 3);
    const peel = smoothstep(0.58, 0.75, pfbm(u, v, 5, 4, seed + 8));
    let r = 0.78 + (fine - 0.5) * 0.06;
    let g = 0.66 + (fine - 0.5) * 0.06;
    let b = 0.46 + (fine - 0.5) * 0.05;
    // Desconchones que dejan ver el ladrillo
    r = lerp(r, 0.45, peel);
    g = lerp(g, 0.27, peel);
    b = lerp(b, 0.2, peel);
    let h = 0.5 + fine * 0.08 - peel * 0.25;
    // Imposta en cada planta y pilastras entre crujías
    const belt = cv < 0.06 ? 1 : 0;
    const pil = Math.min(cu, 1 - cu) < 0.06 ? 1 : 0;
    if (belt || pil) {
      r = 0.86;
      g = 0.8;
      b = 0.64;
      h = 0.75;
    }
    if (windowCell(cu, cv, 0.36, 0.56, 0.24, id, winOut)) {
      r = winOut[0];
      g = winOut[1];
      b = winOut[2];
      h = 0.5 + winOut[3] * 0.5;
    }
    t.r = r;
    t.g = g;
    t.b = b;
    t.h = h;
    t.rough = 0.8;
  }, 2.2);
}

/** Azotea: tela asfáltica con nieve acumulada y algún respiradero. Cubre 6 x 6 m. */
function roof(seed: number): SurfaceTex {
  return synth(512, 512, (u, v, t) => {
    // Casi todo cubierto de nieve: solo asoma la tela asfáltica en alguna calva
    const drift = 1 - smoothstep(0.78, 0.9, pfbm(u, v, 2, 4, seed)) * 0.7;
    const fine = pfbm(u, v, 50, 2, seed + 2);
    const big = pfbm(u, v, 2, 3, seed + 5);
    const tar = 0.18 + (fine - 0.5) * 0.06;
    const c = lerp(tar, 0.7 + (big - 0.5) * 0.1 + (fine - 0.5) * 0.04, drift);
    t.r = c * 0.98;
    t.g = c;
    t.b = c * 1.03;
    t.h = drift * 0.8 + fine * 0.1;
    t.rough = lerp(0.8, 0.65, drift);
  }, 1.4);
}

export interface TextureSet {
  concrete: SurfaceTex;
  concreteWall: SurfaceTex;
  tubbing: SurfaceTex;
  ballast: SurfaceTex;
  floorTiles: SurfaceTex;
  wallTiles: SurfaceTex;
  marble: SurfaceTex;
  brick: SurfaceTex;
  planks: SurfaceTex;
  sheet: SurfaceTex;
  plate: SurfaceTex;
  rock: SurfaceTex;
  dirt: SurfaceTex;
  cloth: SurfaceTex;
  trackBed: SurfaceTex;
  snow: SurfaceTex;
  asphalt: SurfaceTex;
  facadePanel: SurfaceTex;
  facadeBrick: SurfaceTex;
  facadeStucco: SurfaceTex;
  roof: SurfaceTex;
  grunge: THREE.Texture;
  soft: THREE.Texture;
  blob: THREE.Texture;
  flame: THREE.Texture;
}

/** Ruido de suciedad de un canal (se muestrea en triplanar sobre el atrezo). */
function grungeTex(): THREE.Texture {
  const s = 256;
  const [c, ctx] = canvasOf(s, s);
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = (x + 0.5) / s;
      const v = (y + 0.5) / s;
      const a = pfbm(u, v, 4, 5, 901);
      const b = pfbm(u, v, 24, 3, 907);
      const scratch = smoothstep(0.8, 1, pn(u * 6, v * 90, 6, 90, 911));
      const i = (y * s + x) * 4;
      img.data[i] = clamp01(0.5 + (a - 0.5) * 1.3) * 255;
      img.data[i + 1] = clamp01(b) * 255;
      img.data[i + 2] = clamp01(scratch) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(new THREE.CanvasTexture(c), false);
}

/** Disco suave para partículas y halos. */
function softTex(power: number): THREE.Texture {
  const s = 128;
  const [c, ctx] = canvasOf(s, s);
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const d = Math.hypot((x + 0.5) / s - 0.5, (y + 0.5) / s - 0.5) * 2;
      const a = Math.pow(clamp01(1 - d), power);
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = finish(new THREE.CanvasTexture(c), true, false);
  return t;
}

/** Lengua de fuego (alfa) para las llamas animadas. */
function flameTex(): THREE.Texture {
  const s = 128;
  const [c, ctx] = canvasOf(s, s);
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = (x + 0.5) / s;
      const v = 1 - (y + 0.5) / s; // 0 = base
      const widthAt = 0.36 * Math.pow(1 - v, 0.65) + 0.02;
      const d = Math.abs(u - 0.5) / widthAt;
      const n = pfbm(u, v, 5, 3, 77);
      const a = clamp01(1.25 - d * d - (n - 0.4) * 0.9 * (0.3 + v)) * smoothstep(0, 0.12, v) * (1 - smoothstep(0.75, 1, v));
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = clamp01(a) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(new THREE.CanvasTexture(c), true, false);
}

export function buildTextures(onStep?: (name: string) => void): TextureSet {
  const step = <T>(name: string, fn: () => T): T => {
    onStep?.(name);
    return fn();
  };
  return {
    concrete: step('hormigón', () => concrete(11, false)),
    concreteWall: step('muros', () => concrete(23, true)),
    tubbing: step('dovelas', () => tubbing(31)),
    ballast: step('balasto', () => ballast(41)),
    floorTiles: step('losas', () => floorTiles(53)),
    wallTiles: step('azulejos', () => wallTiles(61)),
    marble: step('mármol', () => marble(71)),
    brick: step('ladrillo', () => brick(83)),
    planks: step('tablones', () => planks(97)),
    sheet: step('chapa', () => rustMetal(101, true)),
    plate: step('acero', () => rustMetal(113, false)),
    rock: step('roca', () => rock(127)),
    dirt: step('barro', () => dirt(131)),
    cloth: step('lona', () => canvasCloth(139)),
    trackBed: step('vías', () => trackBed(149)),
    snow: step('nieve', () => snow(151)),
    asphalt: step('asfalto', () => asphalt(157)),
    facadePanel: step('fachadas', () => facadePanel(163)),
    facadeBrick: step('fachadas de ladrillo', () => facadeBrick(167)),
    facadeStucco: step('fachadas estalinistas', () => facadeStucco(173)),
    roof: step('azoteas', () => roof(179)),
    grunge: grungeTex(),
    soft: softTex(1.6),
    blob: softTex(0.9),
    flame: flameTex(),
  };
}
