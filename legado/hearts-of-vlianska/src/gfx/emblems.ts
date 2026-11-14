// Emblemas de facción: insignias de metal esmaltado con el símbolo en relieve.
import { FACTIONS } from '../data';
import type { FactionId } from '../game/types';
import { cachedCanvas, ctx2d, makeCanvas, spriteURL, type Ctx } from './canvas';
import { hexToRgb, rgba, shade } from './color';
import { rng } from './rng';

interface Glyph {
  fill?: Path2D;
  strokes?: { path: Path2D; width: number; cap?: CanvasLineCap }[];
}

function star(cx: number, cy: number, outer: number, inner: number, n = 5): Path2D {
  const p = new Path2D();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    if (i === 0) p.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    else p.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  p.closePath();
  return p;
}

const glyphCache = new Map<string, Glyph>();

/** Símbolos en un espacio de 100 × 100. */
function glyphOf(f: FactionId | null): Glyph {
  const key = f ?? 'none';
  const hit = glyphCache.get(key);
  if (hit) return hit;
  let gl: Glyph;
  switch (f) {
    case 'UNI':
      gl = { fill: star(50, 53, 31, 13) };
      break;
    case 'SDR':
      gl = {
        strokes: [
          { path: new Path2D('M50 80 V22'), width: 7.5 },
          { path: new Path2D('M29 24 V41 Q29 60 50 60 Q71 60 71 41 V24'), width: 7.5 },
          { path: new Path2D('M40 71 H60'), width: 6.5 },
          { path: new Path2D('M29 24 L25 31 M71 24 L75 31 M50 22 L46 29 M50 22 L54 29'), width: 4 },
        ],
      };
      break;
    case 'LEV':
      gl = {
        strokes: [
          { path: new Path2D('M61 25 A25 25 0 1 1 28 51'), width: 7.5 },
          { path: new Path2D('M35 65 L24 76'), width: 8.5 },
          { path: new Path2D('M42 42 L67 69'), width: 6.5 },
          { path: new Path2D('M31 46 L48 29'), width: 11, cap: 'butt' },
        ],
      };
      break;
    case 'STA': {
      const p = new Path2D();
      p.rect(45.5, 18, 10, 66);
      p.rect(21, 40, 59, 10);
      gl = { fill: p, strokes: [{ path: new Path2D('M50.5 18 V84 M21 45 H80'), width: 1.2 }] };
      break;
    }
    case 'VHL':
      gl = {
        strokes: [
          { path: new Path2D('M77 51 A27 27 0 1 1 76.99 50.2'), width: 6.5 },
          { path: new Path2D('M32 80 L50 18 L68 80'), width: 7 },
          { path: new Path2D('M24 58 H76'), width: 6.5 },
        ],
      };
      break;
    case 'CHE': {
      const pommels = new Path2D();
      pommels.arc(77, 77, 5.5, 0, Math.PI * 2);
      pommels.moveTo(28.5, 77);
      pommels.arc(23, 77, 5.5, 0, Math.PI * 2);
      gl = {
        fill: pommels,
        strokes: [
          { path: new Path2D('M28 24 L72 70'), width: 7.5 },
          { path: new Path2D('M72 24 L28 70'), width: 7.5 },
          { path: new Path2D('M63 71 L79 57'), width: 6.5 },
          { path: new Path2D('M37 71 L21 57'), width: 6.5 },
        ],
      };
      break;
    }
    case 'CAL':
      gl = {
        strokes: [
          { path: new Path2D('M23 69 A27 27 0 0 1 77 69'), width: 9.5 },
          { path: new Path2D('M37 69 A13 13 0 0 1 63 69'), width: 6.5 },
          { path: new Path2D('M18 78 H82'), width: 5.5 },
        ],
        fill: star(50, 30, 6, 2.6),
      };
      break;
    case 'NOR':
      gl = {
        strokes: [
          { path: new Path2D('M77 50 A27 27 0 1 1 76.99 49.2'), width: 6.5 },
          { path: new Path2D('M39 27 V73 M50 22 V78 M61 27 V73'), width: 6.5 },
        ],
      };
      break;
    default:
      gl = { strokes: [{ path: new Path2D('M31 31 L69 69 M69 31 L31 69'), width: 7 }] };
  }
  glyphCache.set(key, gl);
  return gl;
}

function drawGlyph(g: Ctx, gl: Glyph, style: string | CanvasGradient, extra = 0) {
  g.fillStyle = style;
  g.strokeStyle = style;
  g.lineJoin = 'round';
  if (gl.fill) {
    g.fill(gl.fill);
    if (extra > 0) {
      g.lineWidth = extra;
      g.stroke(gl.fill);
    }
  }
  for (const s of gl.strokes ?? []) {
    g.lineCap = s.cap ?? 'round';
    g.lineWidth = s.width + extra;
    g.stroke(s.path);
  }
}

/** Símbolo estampado en relieve dentro de un espacio de 100 × 100 ya transformado. */
export function embossGlyph(g: Ctx, f: FactionId | null, metal = { light: '#fffaf0', mid: '#e7dcc4', dark: '#8f8166' }) {
  const gl = glyphOf(f);
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.7)';
  g.shadowBlur = 5;
  g.shadowOffsetY = 3;
  drawGlyph(g, gl, 'rgba(0,0,0,0.55)', 1.5);
  g.restore();
  g.save();
  g.translate(0.6, 1.4);
  drawGlyph(g, gl, metal.dark, 0.8);
  g.restore();
  const grad = g.createLinearGradient(0, 18, 0, 84);
  grad.addColorStop(0, metal.light);
  grad.addColorStop(0.5, metal.mid);
  grad.addColorStop(1, metal.dark);
  drawGlyph(g, gl, grad);
  g.save();
  g.beginPath();
  g.rect(0, 0, 100, 48);
  g.clip();
  g.translate(-0.3, -0.8);
  g.globalAlpha = 0.5;
  drawGlyph(g, gl, 'rgba(255,255,255,0.55)', -3);
  g.restore();
}

function conic(g: Ctx, cx: number, cy: number, stops: [number, string][], fallback: string): CanvasGradient | string {
  const anyG = g as Ctx & { createConicGradient?: (a: number, x: number, y: number) => CanvasGradient };
  if (typeof anyG.createConicGradient !== 'function') return fallback;
  const cg = anyG.createConicGradient(-Math.PI / 4, cx, cy);
  for (const [t, c] of stops) cg.addColorStop(t, c);
  return cg;
}

/** Aro metálico biselado (latón o acero) con remaches. */
export function metalRing(g: Ctx, cx: number, cy: number, rOuter: number, rInner: number, metal: 'brass' | 'steel' | 'iron', rivets = 8) {
  const pal =
    metal === 'brass'
      ? ['#fff0c2', '#c9a35a', '#6d5226', '#e8cf8e', '#4a3818']
      : metal === 'steel'
        ? ['#f4f6f7', '#9aa3a8', '#40474b', '#cfd6da', '#23282b']
        : ['#b8b1a6', '#6b665e', '#2c2a27', '#8e877c', '#1a1917'];
  const ring = new Path2D();
  ring.arc(cx, cy, rOuter, 0, Math.PI * 2);
  ring.arc(cx, cy, rInner, 0, Math.PI * 2, true);
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)';
  g.shadowBlur = rOuter * 0.12;
  g.shadowOffsetY = rOuter * 0.05;
  g.fillStyle = conic(
    g,
    cx,
    cy,
    [
      [0, pal[0]],
      [0.12, pal[1]],
      [0.3, pal[2]],
      [0.45, pal[3]],
      [0.6, pal[1]],
      [0.78, pal[4]],
      [0.9, pal[1]],
      [1, pal[0]],
    ],
    pal[1],
  );
  g.fill(ring, 'evenodd');
  g.restore();
  // Bisel: luz arriba, sombra abajo
  const bevel = g.createLinearGradient(cx, cy - rOuter, cx, cy + rOuter);
  bevel.addColorStop(0, 'rgba(255,255,255,0.45)');
  bevel.addColorStop(0.5, 'rgba(255,255,255,0)');
  bevel.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = bevel;
  g.fill(ring, 'evenodd');
  g.lineWidth = Math.max(1, rOuter * 0.025);
  g.strokeStyle = 'rgba(0,0,0,0.7)';
  g.beginPath();
  g.arc(cx, cy, rOuter - g.lineWidth / 2, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, rInner, 0, Math.PI * 2);
  g.stroke();
  // Remaches
  const rr = (rOuter - rInner) * 0.2;
  for (let i = 0; i < rivets; i++) {
    const a = (i / rivets) * Math.PI * 2 + Math.PI / rivets;
    const x = cx + Math.cos(a) * (rOuter + rInner) / 2;
    const y = cy + Math.sin(a) * (rOuter + rInner) / 2;
    const rg = g.createRadialGradient(x - rr * 0.35, y - rr * 0.4, rr * 0.1, x, y, rr);
    rg.addColorStop(0, pal[0]);
    rg.addColorStop(0.5, pal[1]);
    rg.addColorStop(1, pal[4]);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.beginPath();
    g.arc(x + rr * 0.15, y + rr * 0.3, rr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fill();
  }
}

const METAL_OF: Record<FactionId, 'brass' | 'steel' | 'iron'> = {
  UNI: 'steel',
  SDR: 'brass',
  LEV: 'brass',
  STA: 'brass',
  VHL: 'iron',
  CHE: 'steel',
  CAL: 'brass',
  NOR: 'steel',
};

/** Pinta el emblema completo en un lienzo cuadrado de lado `size`. */
export function paintEmblem(f: FactionId | null, size = 160): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const s = size / 100;
  g.scale(s, s);
  const color = f ? FACTIONS[f].color : '#2a2a28';
  const dark = f ? FACTIONS[f].colorDark : '#0d0d0c';
  const r = rng(`emblem-${f ?? 'none'}`);
  const cx = 50;
  const cy = 50;
  // Campo esmaltado
  const field = new Path2D();
  field.arc(cx, cy, 40, 0, Math.PI * 2);
  const eg = g.createRadialGradient(38, 32, 4, 50, 50, 46);
  eg.addColorStop(0, shade(color, 0.28));
  eg.addColorStop(0.55, color);
  eg.addColorStop(1, dark);
  g.fillStyle = eg;
  g.fill(field);
  g.save();
  g.clip(field);
  // Textura del esmalte: vetas y motas
  for (let i = 0; i < 120; i++) {
    const x = r() * 100;
    const y = r() * 100;
    const rad = 0.4 + r() * 1.6;
    g.fillStyle = r() < 0.5 ? rgba('#000000', 0.05 + r() * 0.08) : rgba('#ffffff', 0.03 + r() * 0.05);
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  // Arañazos
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    const x = 15 + r() * 70;
    const y = 15 + r() * 70;
    const a = r() * Math.PI;
    const l = 3 + r() * 10;
    g.strokeStyle = rgba('#ffffff', 0.08 + r() * 0.1);
    g.lineWidth = 0.35;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  // Sombra interior del aro
  const inner = g.createRadialGradient(cx, cy + 4, 30, cx, cy, 42);
  inner.addColorStop(0, 'rgba(0,0,0,0)');
  inner.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = inner;
  g.fillRect(0, 0, 100, 100);
  g.restore();
  // Símbolo
  g.save();
  g.translate(50, 51);
  g.scale(0.74, 0.74);
  g.translate(-50, -50);
  const metal = f === 'STA' || f === 'NOR' ? { light: '#fff6dc', mid: '#f0dca8', dark: '#8a6c34' } : { light: '#ffffff', mid: '#ece6d8', dark: '#8d857a' };
  embossGlyph(g, f, metal);
  g.restore();
  // Barniz: brillo de cristal
  g.save();
  g.clip(field);
  const gloss = g.createLinearGradient(0, 10, 0, 55);
  gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gloss;
  g.beginPath();
  g.ellipse(46, 30, 30, 19, -0.25, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Aro
  metalRing(g, cx, cy, 48, 40, f ? METAL_OF[f] : 'iron', 8);
  // Óxido en los bordes
  if (f === 'VHL' || f === 'LEV' || f === null) {
    const [rr, gg, bb] = hexToRgb('#7a3b14');
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2;
      const d = 40 + r() * 8;
      g.fillStyle = `rgba(${rr},${gg},${bb},${0.15 + r() * 0.3})`;
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.5 + r() * 1.8, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

export function emblemCanvas(f: FactionId | null, size = 160): HTMLCanvasElement {
  return cachedCanvas(`emblem-${f ?? 'none'}-${size}`, () => paintEmblem(f, size));
}

export function emblemURL(f: FactionId | null): string {
  return spriteURL(`emblem-url-${f ?? 'none'}`, () => emblemCanvas(f, 160));
}
