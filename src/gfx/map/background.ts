// Fondo del mapa: el subsuelo de Vlianska visto en planta. Roca con vetas y
// humedad, el cauce del río en superficie y el trazado fantasma de la ciudad.
import { MAP_HEIGHT, MAP_WIDTH, RIVERS } from '../../data';
import { blurCanvas, ctx2d, makeCanvas } from '../canvas';
import { fbm, ridged, warped } from '../noise';
import { hash2, range, rng } from '../rng';
import type { Pt } from './geometry';

/** Rectángulo del mundo que cubre el fondo (más allá del plano, para poder desplazarse). */
export const WORLD = { x: -700, y: -480, w: MAP_WIDTH + 1400, h: MAP_HEIGHT + 960 };

function distToRiver(x: number, y: number): number {
  let best = Infinity;
  for (const river of RIVERS) {
    for (let i = 1; i < river.length; i++) {
      const a = river[i - 1];
      const b = river[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      let t = l2 ? ((x - a[0]) * dx + (y - a[1]) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
      if (d < best) best = d;
    }
  }
  return best;
}

/** Campo de distancias al río en una rejilla gruesa (para no recalcularlo por píxel). */
function riverField(cols: number, rows: number, sx: number, sy: number): Float32Array {
  const f = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      f[j * cols + i] = distToRiver(WORLD.x + i * sx, WORLD.y + j * sy);
    }
  }
  return f;
}

/**
 * Roca en baja resolución (se escala al dibujar); los detalles finos los pone
 * la textura de grano, que se repite en espacio del mundo.
 */
export function paintRock(ppu = 0.42): HTMLCanvasElement {
  const w = Math.round(WORLD.w * ppu);
  const h = Math.round(WORLD.h * ppu);
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const img = g.createImageData(w, h);
  const d = img.data;
  const step = 8;
  const cols = Math.ceil(w / step) + 1;
  const rows = Math.ceil(h / step) + 1;
  const field = riverField(cols, rows, step / ppu, step / ppu);
  // Ruido grueso en una rejilla de 3 px, interpolado después
  const S = 3;
  const gc = Math.ceil(w / S) + 2;
  const gr = Math.ceil(h / S) + 2;
  const macroG = new Float32Array(gc * gr);
  const strataG = new Float32Array(gc * gr);
  const mossG = new Float32Array(gc * gr);
  for (let j = 0; j < gr; j++) {
    for (let i = 0; i < gc; i++) {
      const wx = WORLD.x + (i * S) / ppu;
      const wy = WORLD.y + (j * S) / ppu;
      const macro = warped(wx / 520, wy / 520, 3, 1.2, 4);
      macroG[j * gc + i] = macro;
      strataG[j * gc + i] = ridged(wx / 260 + macro * 1.5, wy / 90 + macro * 0.8, 3, 7);
      mossG[j * gc + i] = fbm(wx / 180, wy / 180, 3, 21);
    }
  }
  const lerpGrid = (arr: Float32Array, gx: number, gy: number) => {
    const i0 = Math.floor(gx);
    const j0 = Math.floor(gy);
    const fx = gx - i0;
    const fy = gy - j0;
    const a = arr[j0 * gc + i0];
    const b = arr[j0 * gc + i0 + 1];
    const c2 = arr[(j0 + 1) * gc + i0];
    const d2 = arr[(j0 + 1) * gc + i0 + 1];
    return a + (b - a) * fx + (c2 - a) * fy + (a - b - c2 + d2) * fx * fy;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const wx = WORLD.x + x / ppu;
      const wy = WORLD.y + y / ppu;
      const macro = lerpGrid(macroG, x / S, y / S);
      const strata = lerpGrid(strataG, x / S, y / S);
      const mossN = lerpGrid(mossG, x / S, y / S);
      const grainN = fbm(wx / 38, wy / 38, 2, 11);
      // Distancia al río (interpolada de la rejilla)
      const gx = x / step;
      const gy = y / step;
      const i0 = Math.floor(gx);
      const j0 = Math.floor(gy);
      const fx = gx - i0;
      const fy = gy - j0;
      const at = (i: number, j: number) => field[Math.min(rows - 1, j) * cols + Math.min(cols - 1, i)];
      const rd = at(i0, j0) * (1 - fx) * (1 - fy) + at(i0 + 1, j0) * fx * (1 - fy) + at(i0, j0 + 1) * (1 - fx) * fy + at(i0 + 1, j0 + 1) * fx * fy;
      const wet = Math.max(0, 1 - rd / 150);
      let r = 17 + macro * 18 + strata * 13 + grainN * 8;
      let gg = 17 + macro * 16 + strata * 11 + grainN * 7;
      let b = 15 + macro * 12 + strata * 8 + grainN * 6;
      // Vetas minerales ocres y zonas húmedas verdosas
      const vein = Math.max(0, strata - 0.72) * 3.2;
      r += vein * 22;
      gg += vein * 14;
      b += vein * 4;
      const moss = Math.max(0, mossN - 0.58) * 2.4;
      gg += moss * 6;
      b += moss * 3;
      r -= wet * 7;
      gg -= wet * 3;
      b += wet * 4;
      // Borde del plano: más oscuro fuera de la zona del metro
      const ex = Math.max(0, -wx, wx - MAP_WIDTH) / 420;
      const ey = Math.max(0, -wy, wy - MAP_HEIGHT) / 320;
      const edge = Math.min(1, Math.hypot(ex, ey));
      const k = 1 - edge * 0.55;
      const i = (y * w + x) * 4;
      d[i] = r * k;
      d[i + 1] = gg * k;
      d[i + 2] = b * k;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Grietas
  const rr = rng('rock-cracks');
  g.save();
  g.scale(ppu, ppu);
  g.translate(-WORLD.x, -WORLD.y);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 90; i++) {
    let x = range(rr, WORLD.x, WORLD.x + WORLD.w);
    let y = range(rr, WORLD.y, WORLD.y + WORLD.h);
    let a = range(rr, 0, Math.PI * 2);
    const n = 6 + Math.floor(rr() * 14);
    g.strokeStyle = `rgba(0,0,0,${range(rr, 0.25, 0.5)})`;
    g.lineWidth = range(rr, 1.2, 3);
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < n; s++) {
      a += range(rr, -0.7, 0.7);
      const l = range(rr, 10, 34);
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  return c;
}

/** Cauce del río (en superficie) como capa translúcida desenfocada. */
export function paintRiver(ppu = 0.42): HTMLCanvasElement {
  const w = Math.round(WORLD.w * ppu);
  const h = Math.round(WORLD.h * ppu);
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  g.scale(ppu, ppu);
  g.translate(-WORLD.x, -WORLD.y);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const river of RIVERS) {
    const path = new Path2D();
    river.forEach(([x, y], i) => (i === 0 ? path.moveTo(x, y) : path.lineTo(x, y)));
    g.strokeStyle = 'rgba(20,70,95,0.55)';
    g.lineWidth = 58;
    g.stroke(path);
    g.strokeStyle = 'rgba(30,95,125,0.55)';
    g.lineWidth = 34;
    g.stroke(path);
    g.strokeStyle = 'rgba(60,140,170,0.25)';
    g.lineWidth = 12;
    g.stroke(path);
  }
  blurCanvas(c, 5);
  return c;
}

/**
 * Textura de grano de roca, continua. Se repite en espacio del mundo para dar
 * detalle nítido cuando se acerca la cámara.
 */
export function paintRockGrain(size = 256): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * 16, (y / size) * 16, 4, 91, 16);
      const speck = hash2(x, y, 5);
      let v = 128 + (n - 0.5) * 120;
      if (speck > 0.992) v += 70;
      else if (speck < 0.01) v -= 70;
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = Math.max(0, Math.min(255, v));
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

// ---------------------------------------------------------------------------
// La ciudad en superficie: manzanas y calles de Vlianska, apenas insinuadas.
// ---------------------------------------------------------------------------

export interface CityPlan {
  streets: Path2D;
  blocks: Path2D;
  ruins: Path2D;
}

export function buildCity(): CityPlan {
  const r = rng('vlianska-city');
  const streets = new Path2D();
  const blocks = new Path2D();
  const ruins = new Path2D();
  // Retícula ligeramente girada por barrios
  const districts: { x: number; y: number; w: number; h: number; a: number; cell: number }[] = [
    { x: -200, y: -120, w: 900, h: 560, a: -0.12, cell: 70 },
    { x: 700, y: -160, w: 1000, h: 520, a: 0.05, cell: 64 },
    { x: 1550, y: -140, w: 700, h: 700, a: 0.2, cell: 80 },
    { x: -260, y: 460, w: 1000, h: 760, a: 0.08, cell: 74 },
    { x: 760, y: 380, w: 900, h: 540, a: -0.06, cell: 60 },
    { x: 1100, y: 880, w: 1100, h: 520, a: 0.14, cell: 76 },
  ];
  for (const dsc of districts) {
    const cos = Math.cos(dsc.a);
    const sin = Math.sin(dsc.a);
    const T = (x: number, y: number): Pt => [dsc.x + x * cos - y * sin, dsc.y + x * sin + y * cos];
    const nx = Math.floor(dsc.w / dsc.cell);
    const ny = Math.floor(dsc.h / dsc.cell);
    for (let i = 0; i <= nx; i++) {
      const a = T(i * dsc.cell, 0);
      const b = T(i * dsc.cell, ny * dsc.cell);
      streets.moveTo(a[0], a[1]);
      streets.lineTo(b[0], b[1]);
    }
    for (let j = 0; j <= ny; j++) {
      const a = T(0, j * dsc.cell);
      const b = T(nx * dsc.cell, j * dsc.cell);
      streets.moveTo(a[0], a[1]);
      streets.lineTo(b[0], b[1]);
    }
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const cx = (i + 0.5) * dsc.cell;
        const cy = (j + 0.5) * dsc.cell;
        const [wx, wy] = T(cx, cy);
        if (distToRiver(wx, wy) < 60) continue;
        // Edificios dentro de la manzana
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const bw = range(r, 0.22, 0.4) * dsc.cell;
          const bh = range(r, 0.2, 0.36) * dsc.cell;
          const ox = range(r, -0.28, 0.28) * dsc.cell;
          const oy = range(r, -0.28, 0.28) * dsc.cell;
          const target = r() < 0.18 ? ruins : blocks;
          const p1 = T(cx + ox - bw / 2, cy + oy - bh / 2);
          const p2 = T(cx + ox + bw / 2, cy + oy - bh / 2);
          const p3 = T(cx + ox + bw / 2, cy + oy + bh / 2);
          const p4 = T(cx + ox - bw / 2, cy + oy + bh / 2);
          target.moveTo(p1[0], p1[1]);
          target.lineTo(p2[0], p2[1]);
          target.lineTo(p3[0], p3[1]);
          target.lineTo(p4[0], p4[1]);
          target.closePath();
        }
      }
    }
  }
  return { streets, blocks, ruins };
}
