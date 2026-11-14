// Dibuja los iconos (trazos de lucide) sobre canvas: grabados, relieves y siluetas.
import { ICON_NODES } from '../ui/iconMap.generated';
import type { Ctx } from './canvas';

interface IconShape {
  path: Path2D;
  filled: boolean;
}

const shapeCache = new Map<string, IconShape[]>();

function points(attr: string | undefined): number[] {
  return (attr ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
}

export function iconShapes(name: string): IconShape[] {
  const hit = shapeCache.get(name);
  if (hit) return hit;
  const nodes = ICON_NODES[name] ?? ICON_NODES.CircleHelp;
  const out: IconShape[] = [];
  for (const [tag, a] of nodes) {
    const n = (k: string) => Number(a[k] ?? 0);
    const p = new Path2D();
    switch (tag) {
      case 'path':
        p.addPath(new Path2D(a.d));
        break;
      case 'circle':
        p.arc(n('cx'), n('cy'), n('r'), 0, Math.PI * 2);
        break;
      case 'ellipse':
        p.ellipse(n('cx'), n('cy'), n('rx'), n('ry'), 0, 0, Math.PI * 2);
        break;
      case 'rect': {
        const rx = Number(a.rx ?? a.ry ?? 0);
        if (rx > 0 && typeof p.roundRect === 'function') p.roundRect(n('x'), n('y'), n('width'), n('height'), rx);
        else p.rect(n('x'), n('y'), n('width'), n('height'));
        break;
      }
      case 'line':
        p.moveTo(n('x1'), n('y1'));
        p.lineTo(n('x2'), n('y2'));
        break;
      case 'polyline':
      case 'polygon': {
        const pts = points(a.points);
        for (let i = 0; i + 1 < pts.length; i += 2) {
          if (i === 0) p.moveTo(pts[i], pts[i + 1]);
          else p.lineTo(pts[i], pts[i + 1]);
        }
        if (tag === 'polygon') p.closePath();
        break;
      }
      default:
        continue;
    }
    out.push({ path: p, filled: a.fill === 'currentColor' });
  }
  shapeCache.set(name, out);
  return out;
}

/**
 * Traza un icono centrado en (x, y) con un tamaño dado.
 * `style` decide el color del trazo; `width` es el grosor en unidades del icono (24).
 */
export function strokeIcon(g: Ctx, name: string, x: number, y: number, size: number, style: string | CanvasGradient, width = 2) {
  const k = size / 24;
  g.save();
  g.translate(x - size / 2, y - size / 2);
  g.scale(k, k);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = width;
  g.strokeStyle = style;
  g.fillStyle = style;
  for (const s of iconShapes(name)) {
    if (s.filled) g.fill(s.path);
    g.stroke(s.path);
  }
  g.restore();
}

/**
 * Icono en relieve metálico: sombra, bisel oscuro, cuerpo con degradado y brillo.
 * Da el aspecto de una insignia estampada en latón o acero.
 */
export function embossIcon(
  g: Ctx,
  name: string,
  x: number,
  y: number,
  size: number,
  metal: { light: string; mid: string; dark: string },
  width = 2.3,
) {
  // Sombra proyectada
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.75)';
  g.shadowBlur = size * 0.08;
  g.shadowOffsetY = size * 0.045;
  strokeIcon(g, name, x, y, size, 'rgba(0,0,0,0.6)', width + 0.9);
  g.restore();
  // Bisel inferior
  strokeIcon(g, name, x + size * 0.012, y + size * 0.022, size, metal.dark, width + 0.6);
  // Cuerpo con degradado vertical
  const grad = g.createLinearGradient(x, y - size / 2, x, y + size / 2);
  grad.addColorStop(0, metal.light);
  grad.addColorStop(0.45, metal.mid);
  grad.addColorStop(1, metal.dark);
  strokeIcon(g, name, x, y, size, grad, width);
  // Brillo superior fino
  g.save();
  g.beginPath();
  g.rect(x - size / 2, y - size / 2, size, size * 0.5);
  g.clip();
  strokeIcon(g, name, x - size * 0.008, y - size * 0.016, size, 'rgba(255,255,255,0.35)', Math.max(0.6, width * 0.35));
  g.restore();
}

/** Silueta rellena (para sombras, recortes y señales). */
export function iconPath2D(name: string): Path2D[] {
  return iconShapes(name).map((s) => s.path);
}
