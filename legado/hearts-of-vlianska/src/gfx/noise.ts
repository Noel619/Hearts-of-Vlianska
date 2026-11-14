// Ruido de valor y fBm para texturas (roca, óxido, humo, niebla).
import { hash2 } from './rng';

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Ruido de valor 2D en [0, 1]. Con `period` se repite (textura continua). */
export function valueNoise(x: number, y: number, seed = 0, period = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  let x0 = xi;
  let y0 = yi;
  let x1 = xi + 1;
  let y1 = yi + 1;
  if (period > 0) {
    x0 = ((x0 % period) + period) % period;
    y0 = ((y0 % period) + period) % period;
    x1 = ((x1 % period) + period) % period;
    y1 = ((y1 % period) + period) % period;
  }
  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  const u = fade(xf);
  const v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Suma fractal de octavas. Devuelve aproximadamente [0, 1]. */
export function fbm(x: number, y: number, octaves = 5, seed = 0, period = 0, lacunarity = 2, gain = 0.5): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 17, period ? period * freq : 0);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Ruido "crestado": vetas y grietas. */
export function ridged(x: number, y: number, octaves = 4, seed = 0, period = 0): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = valueNoise(x * freq, y * freq, seed + i * 31, period ? period * freq : 0);
    sum += amp * (1 - Math.abs(n * 2 - 1));
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Deformación de dominio: fbm evaluado sobre coordenadas deformadas por otro fbm. */
export function warped(x: number, y: number, seed = 0, strength = 1.5, octaves = 5): number {
  const qx = fbm(x, y, 3, seed + 101);
  const qy = fbm(x + 5.2, y + 1.3, 3, seed + 202);
  return fbm(x + strength * qx, y + strength * qy, octaves, seed);
}
