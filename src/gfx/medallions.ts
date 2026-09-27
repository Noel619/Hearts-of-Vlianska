// Medallas pintadas para enfoques, tecnologías, decisiones y espíritus nacionales:
// campo esmaltado del color de la categoría, icono estampado en relieve y marco
// metálico biselado.
import { cachedCanvas, ctx2d, makeCanvas, spriteURL, type Ctx } from './canvas';
import { mix, rgba, shade } from './color';
import { metalRing } from './emblems';
import { embossIcon } from './icons';
import { range, rng } from './rng';

export type MedalShape = 'shield' | 'circle' | 'square' | 'hex';
export type Metal = 'brass' | 'steel' | 'iron' | 'gold';

const CATEGORY: { color: string; icons: string[] }[] = [
  // Militar
  { color: '#8f2b22', icons: ['Swords', 'Crosshair', 'Target', 'Bomb', 'Shield', 'ShieldHalf', 'ShieldCheck', 'ShieldPlus', 'Castle', 'BrickWall', 'Siren', 'Footprints', 'Medal', 'Trophy', 'HardHat'] },
  // Industria
  { color: '#8a5a1c', icons: ['Factory', 'Hammer', 'Anvil', 'Cog', 'Wrench', 'Drill', 'Pickaxe', 'Shovel', 'Construction', 'Warehouse', 'Container', 'Boxes', 'Fuel', 'Zap', 'BatteryCharging', 'PlugZap', 'Cable', 'Recycle', 'Package'] },
  // Economía
  { color: '#8b7424', icons: ['Coins', 'Banknote', 'HandCoins', 'CircleDollarSign', 'PiggyBank', 'Store', 'Gem', 'Scale', 'TrendingUp', 'TrendingDown'] },
  // Política
  { color: '#5b2a6e', icons: ['Landmark', 'Crown', 'Flag', 'Megaphone', 'Vote', 'Gavel', 'ScrollText', 'Newspaper', 'Eye', 'Fingerprint', 'Lock', 'Unlock', 'Ban'] },
  // Diplomacia
  { color: '#23507a', icons: ['Handshake', 'Route', 'Merge', 'Split', 'Mail', 'Globe', 'Network', 'RadioTower', 'Radio', 'TrainFront', 'TrainTrack', 'TramFront', 'DoorOpen'] },
  // Ciencia
  { color: '#1f6a6a', icons: ['Microscope', 'FlaskConical', 'Lightbulb', 'Cpu', 'GraduationCap', 'Library', 'BookOpen', 'Gauge', 'Activity'] },
  // Sociedad y salud
  { color: '#3d6a2c', icons: ['Users', 'UsersRound', 'Heart', 'HeartPulse', 'HeartCrack', 'Hospital', 'Stethoscope', 'Pill', 'Soup', 'Wheat', 'Sprout', 'Leaf', 'House', 'Sunrise'] },
  // Superficie, mutantes y peligros
  { color: '#4a4f3a', icons: ['Skull', 'Biohazard', 'Radiation', 'Ghost', 'Bug', 'Rat', 'MountainSnow', 'Snowflake', 'Wind', 'Flashlight', 'Moon', 'Backpack', 'Shell', 'Waves', 'Droplets', 'Flame'] },
];

const ICON_COLOR = new Map<string, string>();
for (const c of CATEGORY) for (const i of c.icons) ICON_COLOR.set(i, c.color);

export function categoryColor(icon: string, fallback = '#4a4436'): string {
  return ICON_COLOR.get(icon) ?? fallback;
}

const METALS: Record<Metal, { light: string; mid: string; dark: string; ring: 'brass' | 'steel' | 'iron' }> = {
  brass: { light: '#fff3c8', mid: '#d9b566', dark: '#6b4c1c', ring: 'brass' },
  gold: { light: '#fffbe0', mid: '#f0c95a', dark: '#7a5510', ring: 'brass' },
  steel: { light: '#ffffff', mid: '#c9d0d4', dark: '#4d555a', ring: 'steel' },
  iron: { light: '#e8e2d6', mid: '#a39c8e', dark: '#3a3630', ring: 'iron' },
};

function shapePath(shape: MedalShape, s: number, inset = 0): Path2D {
  const p = new Path2D();
  const c = s / 2;
  const i = inset;
  switch (shape) {
    case 'circle':
      p.arc(c, c, c - i, 0, Math.PI * 2);
      break;
    case 'square': {
      const r = s * 0.12;
      const x = i;
      const y = i;
      const w = s - i * 2;
      p.moveTo(x + r, y);
      p.lineTo(x + w - r, y);
      p.quadraticCurveTo(x + w, y, x + w, y + r);
      p.lineTo(x + w, y + w - r);
      p.quadraticCurveTo(x + w, y + w, x + w - r, y + w);
      p.lineTo(x + r, y + w);
      p.quadraticCurveTo(x, y + w, x, y + w - r);
      p.lineTo(x, y + r);
      p.quadraticCurveTo(x, y, x + r, y);
      p.closePath();
      break;
    }
    case 'hex': {
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        const x = c + Math.cos(a) * (c - i);
        const y = c + Math.sin(a) * (c - i);
        if (k === 0) p.moveTo(x, y);
        else p.lineTo(x, y);
      }
      p.closePath();
      break;
    }
    case 'shield': {
      const top = s * 0.06 + i;
      const side = s * 0.1 + i;
      p.moveTo(c, top);
      p.quadraticCurveTo(c + s * 0.22, top + s * 0.05, s - side, top + s * 0.02);
      p.lineTo(s - side, s * 0.46);
      p.quadraticCurveTo(s - side, s * 0.78, c, s - s * 0.04 - i);
      p.quadraticCurveTo(side, s * 0.78, side, s * 0.46);
      p.lineTo(side, top + s * 0.02);
      p.quadraticCurveTo(c - s * 0.22, top + s * 0.05, c, top);
      p.closePath();
      break;
    }
  }
  return p;
}

function frame(g: Ctx, shape: MedalShape, s: number, metal: Metal) {
  if (shape === 'circle') {
    metalRing(g, s / 2, s / 2, s / 2 - 1, s / 2 - s * 0.1, METALS[metal].ring, 8);
    return;
  }
  const m = METALS[metal];
  const outer = shapePath(shape, s, 1);
  const inner = shapePath(shape, s, s * 0.085);
  const ring = new Path2D();
  ring.addPath(outer);
  ring.addPath(inner);
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.65)';
  g.shadowBlur = s * 0.06;
  g.shadowOffsetY = s * 0.025;
  const grad = g.createLinearGradient(0, 0, s, s);
  grad.addColorStop(0, m.light);
  grad.addColorStop(0.35, m.mid);
  grad.addColorStop(0.65, m.dark);
  grad.addColorStop(0.85, m.mid);
  grad.addColorStop(1, m.dark);
  g.fillStyle = grad;
  g.fill(ring, 'evenodd');
  g.restore();
  // Bisel
  const bevel = g.createLinearGradient(0, 0, 0, s);
  bevel.addColorStop(0, 'rgba(255,255,255,0.4)');
  bevel.addColorStop(0.5, 'rgba(255,255,255,0)');
  bevel.addColorStop(1, 'rgba(0,0,0,0.4)');
  g.fillStyle = bevel;
  g.fill(ring, 'evenodd');
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.lineWidth = Math.max(1, s * 0.012);
  g.stroke(outer);
  g.stroke(inner);
  // Remaches en las esquinas
  const rr = s * 0.022;
  const pts: [number, number][] =
    shape === 'square'
      ? [
          [s * 0.1, s * 0.1],
          [s * 0.9, s * 0.1],
          [s * 0.1, s * 0.9],
          [s * 0.9, s * 0.9],
        ]
      : shape === 'shield'
        ? [
            [s * 0.16, s * 0.12],
            [s * 0.84, s * 0.12],
            [s * 0.5, s * 0.9],
          ]
        : [];
  for (const [x, y] of pts) {
    const rg = g.createRadialGradient(x - rr * 0.4, y - rr * 0.4, rr * 0.1, x, y, rr);
    rg.addColorStop(0, m.light);
    rg.addColorStop(1, m.dark);
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, rr, 0, Math.PI * 2);
    g.fill();
  }
}

/** Pinta una medalla cuadrada de lado `s` píxeles. */
export function paintMedal(icon: string, shape: MedalShape, color: string, metal: Metal, s = 128): HTMLCanvasElement {
  const c = makeCanvas(s, s);
  const g = ctx2d(c);
  const r = rng(`medal-${icon}-${shape}-${color}`);
  const field = shapePath(shape, s, s * 0.07);
  // Campo esmaltado con luz desde arriba a la izquierda
  const fg = g.createRadialGradient(s * 0.38, s * 0.3, s * 0.05, s * 0.5, s * 0.55, s * 0.62);
  fg.addColorStop(0, shade(color, 0.35));
  fg.addColorStop(0.55, color);
  fg.addColorStop(1, shade(color, -0.6));
  g.fillStyle = fg;
  g.fill(field);
  g.save();
  g.clip(field);
  // Rayos de luz tenues detrás del símbolo
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + range(r, -0.1, 0.1);
    g.fillStyle = rgba(shade(color, 0.5), 0.05);
    g.beginPath();
    g.moveTo(s / 2, s / 2);
    g.lineTo(s / 2 + Math.cos(a - 0.08) * s, s / 2 + Math.sin(a - 0.08) * s);
    g.lineTo(s / 2 + Math.cos(a + 0.08) * s, s / 2 + Math.sin(a + 0.08) * s);
    g.closePath();
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // Textura de esmalte gastado
  for (let i = 0; i < 180; i++) {
    g.fillStyle = r() < 0.55 ? rgba('#000000', range(r, 0.04, 0.12)) : rgba('#ffffff', range(r, 0.02, 0.06));
    g.beginPath();
    g.arc(range(r, 0, s), range(r, 0, s), range(r, 0.3, 1.4) * (s / 100), 0, Math.PI * 2);
    g.fill();
  }
  // Sombra interior del marco
  const inner = g.createRadialGradient(s / 2, s * 0.56, s * 0.28, s / 2, s / 2, s * 0.56);
  inner.addColorStop(0, 'rgba(0,0,0,0)');
  inner.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = inner;
  g.fillRect(0, 0, s, s);
  g.restore();
  // Símbolo
  const glyphSize = shape === 'shield' ? s * 0.5 : s * 0.52;
  const cy = shape === 'shield' ? s * 0.46 : s * 0.5;
  embossIcon(g, icon, s / 2, cy, glyphSize, METALS[metal], 2.1);
  // Brillo de barniz
  g.save();
  g.clip(field);
  const gloss = g.createLinearGradient(0, 0, 0, s * 0.55);
  gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gloss;
  g.beginPath();
  g.ellipse(s * 0.45, s * 0.22, s * 0.4, s * 0.2, -0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  frame(g, shape, s, metal);
  return c;
}

export function medalCanvas(icon: string, shape: MedalShape, color: string, metal: Metal = 'brass', s = 128): HTMLCanvasElement {
  return cachedCanvas(`medal-${icon}-${shape}-${color}-${metal}-${s}`, () => paintMedal(icon, shape, color, metal, s));
}

export function medalURL(icon: string, shape: MedalShape, color: string, metal: Metal = 'brass', s = 128): string {
  return spriteURL(`medal-url-${icon}-${shape}-${color}-${metal}-${s}`, () => medalCanvas(icon, shape, color, metal, s));
}

/** Color de fondo para una medalla de facción (mezcla del color de la facción y la categoría). */
export function blendCategory(icon: string, factionColor: string): string {
  const cat = ICON_COLOR.get(icon);
  return cat ? mix(cat, factionColor, 0.25) : shade(factionColor, -0.25);
}
