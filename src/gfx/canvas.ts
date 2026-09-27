// Herramientas de canvas: lienzos, desenfoque, grano, viñeta y caché de sprites.
import { hash2 } from './rng';
import { fbm } from './noise';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  return c.getContext('2d', { willReadFrequently: false })!;
}

/** Crea un lienzo y ejecuta `draw` sobre él. */
export function paint(w: number, h: number, draw: (g: Ctx, w: number, h: number) => void): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  draw(g, c.width, c.height);
  return c;
}

// ---------------------------------------------------------------------------
// Desenfoque
// ---------------------------------------------------------------------------

let filterSupport: boolean | null = null;

/** ¿Soporta el navegador `ctx.filter`? (Safari antiguo no). */
export function canvasFilterSupported(): boolean {
  if (filterSupport !== null) return filterSupport;
  try {
    const c = makeCanvas(9, 9);
    const g = ctx2d(c);
    g.filter = 'blur(2px)';
    g.fillStyle = '#fff';
    g.fillRect(4, 4, 1, 1);
    const px = g.getImageData(1, 4, 1, 1).data;
    filterSupport = px[3] > 0;
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}

function boxBlurPass(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number, horizontal: boolean) {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 4 : w * 4;
  const inv = 1 / (r * 2 + 1);
  for (let line = 0; line < lines; line++) {
    const base = horizontal ? line * w * 4 : line * 4;
    for (let ch = 0; ch < 4; ch++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[base + Math.min(len - 1, Math.max(0, i)) * step + ch];
      for (let i = 0; i < len; i++) {
        dst[base + i * step + ch] = acc * inv;
        const add = Math.min(len - 1, i + r + 1);
        const sub = Math.max(0, i - r);
        acc += src[base + add * step + ch] - src[base + sub * step + ch];
      }
    }
  }
}

/** Desenfoque gaussiano aproximado (tres pasadas de caja) en el propio lienzo. */
export function blurCanvas(c: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  if (radius <= 0) return c;
  const g = ctx2d(c);
  if (canvasFilterSupported()) {
    const copy = makeCanvas(c.width, c.height);
    ctx2d(copy).drawImage(c, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.filter = `blur(${radius}px)`;
    g.drawImage(copy, 0, 0);
    g.restore();
    return c;
  }
  const img = g.getImageData(0, 0, c.width, c.height);
  const a = img.data;
  const b = new Uint8ClampedArray(a.length);
  const r = Math.max(1, Math.round(radius * 0.58));
  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(a, b, c.width, c.height, r, true);
    boxBlurPass(b, a, c.width, c.height, r, false);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Dibuja algo desenfocado: pinta en un lienzo aparte, lo desenfoca y lo compone. */
export function drawBlurred(g: Ctx, w: number, h: number, radius: number, draw: (b: Ctx) => void, op: GlobalCompositeOperation = 'source-over', alpha = 1) {
  const layer = makeCanvas(w, h);
  const lg = ctx2d(layer);
  draw(lg);
  blurCanvas(layer, radius);
  g.save();
  g.globalCompositeOperation = op;
  g.globalAlpha = alpha;
  g.drawImage(layer, 0, 0);
  g.restore();
}

// ---------------------------------------------------------------------------
// Acabados
// ---------------------------------------------------------------------------

/** Grano de película monocromo. */
export function grain(g: Ctx, w: number, h: number, amount = 0.08, seed = 1) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const k = amount * 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const n = (hash2(x, y, seed) - 0.5) * k;
      d[i] += n;
      d[i + 1] += n;
      d[i + 2] += n;
    }
  }
  g.putImageData(img, 0, 0);
}

export function vignette(g: Ctx, w: number, h: number, strength = 0.6, color = '0,0,0') {
  const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  grad.addColorStop(0, `rgba(${color},0)`);
  grad.addColorStop(1, `rgba(${color},${strength})`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
}

/** Resplandor radial (luces, llamas, lámparas). */
export function glow(g: Ctx, x: number, y: number, r: number, color: string, alpha = 1, op: GlobalCompositeOperation = 'lighter') {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.save();
  g.globalCompositeOperation = op;
  g.globalAlpha = alpha;
  g.fillStyle = grad;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

/**
 * Textura de ruido en escala de grises (canal alfa), útil para superponer
 * suciedad, óxido o manchas con cualquier color.
 */
export function noiseMask(w: number, h: number, scale: number, seed: number, contrast = 1.6, octaves = 4, period = 0): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = ctx2d(c);
  const img = g.createImageData(w, h);
  const d = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = fbm(x / scale, y / scale, octaves, seed, period);
      n = Math.max(0, Math.min(1, (n - 0.5) * contrast + 0.5));
      const i = (y * w + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = n * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Colorea una máscara alfa con un color (conserva la transparencia). */
export function colorize(mask: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = makeCanvas(mask.width, mask.height);
  const g = ctx2d(c);
  g.drawImage(mask, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/** Recorta un lienzo con un trazado (pinta solo dentro). */
export function clipTo(g: Ctx, path: Path2D, draw: () => void) {
  g.save();
  g.clip(path);
  draw();
  g.restore();
}

// ---------------------------------------------------------------------------
// Caché de sprites
// ---------------------------------------------------------------------------

const canvasCache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

export function cachedCanvas(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = canvasCache.get(key);
  if (!c) {
    c = make();
    canvasCache.set(key, c);
  }
  return c;
}

/** URL (data:) de un sprite, generado una sola vez. */
export function spriteURL(key: string, make: () => HTMLCanvasElement): string {
  let u = urlCache.get(key);
  if (!u) {
    u = cachedCanvas(key, make).toDataURL('image/png');
    urlCache.set(key, u);
  }
  return u;
}

/**
 * URL de un sprite grande que no hace falta conservar como lienzo (retratos,
 * escenas): se guarda comprimido y se libera la memoria del lienzo.
 */
export function spriteURLOnce(key: string, make: () => HTMLCanvasElement, type: 'image/png' | 'image/jpeg' = 'image/jpeg', quality = 0.9): string {
  let u = urlCache.get(key);
  if (!u) {
    const c = make();
    u = c.toDataURL(type, quality);
    urlCache.set(key, u);
    c.width = 0;
    c.height = 0;
  }
  return u;
}

export function forgetSprite(key: string) {
  canvasCache.delete(key);
  urlCache.delete(key);
}

export const DPR = () => (typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1));
