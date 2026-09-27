// Utilidades de color para el pintado procedural.

export type RGB = [number, number, number];

const cache = new Map<string, RGB>();

export function hexToRgb(hex: string): RGB {
  const hit = cache.get(hex);
  if (hit) return hit;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const out: RGB = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  cache.set(hex, out);
  return out;
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function rgbToHex([r, g, b]: RGB): string {
  return `#${((1 << 24) | (clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).slice(1)}`;
}

export function rgba(color: string | RGB, a = 1): string {
  const [r, g, b] = typeof color === 'string' ? hexToRgb(color) : color;
  return `rgba(${clamp255(r)},${clamp255(g)},${clamp255(b)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

/** Mezcla lineal de dos colores (t = 0 → a, t = 1 → b). */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** Aclara (k > 0) u oscurece (k < 0) un color. */
export function shade(hex: string, k: number): string {
  return k >= 0 ? mix(hex, '#ffffff', k) : mix(hex, '#000000', -k);
}

/** Desatura hacia el gris de la misma luminosidad. */
export function desaturate(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return rgbToHex([r + (l - r) * k, g + (l - g) * k, b + (l - b) * k]);
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Tiñe un color neutro con otro (para metales pintados, telas, etc.). */
export function tint(base: string, color: string, k: number): string {
  const B = hexToRgb(base);
  const C = hexToRgb(color);
  const l = (0.3 * B[0] + 0.59 * B[1] + 0.11 * B[2]) / 255;
  return rgbToHex([B[0] + (C[0] * l - B[0]) * k, B[1] + (C[1] * l - B[1]) * k, B[2] + (C[2] * l - B[2]) * k]);
}
