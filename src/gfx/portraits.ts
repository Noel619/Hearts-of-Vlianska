// Retratos pintados por código: fondo de túnel, busto con ropa, cabeza con
// rasgos, pelo, sombreros y accesorios, iluminación de lámpara y grano.
import type { PortraitParams } from '../game/types';
import { blurCanvas, ctx2d, drawBlurred, grain, makeCanvas, spriteURLOnce, vignette, type Ctx } from './canvas';
import { hexToRgb, luminance, mix, rgba, shade } from './color';
import { pick, range, rng, type Rand } from './rng';

const W = 200;
const H = 240;

const SKIN = ['#f1d2b6', '#dcae8a', '#b9825d', '#8b5b3d', '#5e3b27'];
const HAIR = ['#1c1917', '#3a2517', '#6b4526', '#c7a25a', '#8f8d88', '#9c4426'];
const EYES = ['#4a3222', '#5b3d25', '#3f5d7a', '#4f6b4a', '#6b6f73', '#2e2620'];

interface Outfit {
  base: string;
  dark: string;
  trim: string;
}

const OUTFITS: Record<PortraitParams['outfit'], Outfit> = {
  military: { base: '#4a5638', dark: '#262d1c', trim: '#8c7a4a' },
  coat: { base: '#4a3e33', dark: '#241d17', trim: '#6e5f4e' },
  suit: { base: '#2c3038', dark: '#15171b', trim: '#4a505c' },
  rags: { base: '#5c5443', dark: '#2e2a21', trim: '#7a6e57' },
  robe: { base: '#3c4d48', dark: '#1d2724', trim: '#c9b27a' },
  leather: { base: '#3b2a20', dark: '#1a120d', trim: '#8b6b4a' },
};

interface Face {
  cx: number;
  topY: number;
  eyeY: number;
  w: number;
  jawW: number;
  chinY: number;
  eyeDX: number;
  noseY: number;
  mouthY: number;
  mouthW: number;
  noseW: number;
  skin: string;
  skinDark: string;
  skinLight: string;
  hair: string;
  eye: string;
  female: boolean;
  old: boolean;
  young: boolean;
}

function makeFace(p: PortraitParams, r: Rand): Face {
  const female = !!p.female;
  const old = p.age === 'old';
  const young = p.age === 'young';
  const skin = SKIN[p.skin] ?? SKIN[1];
  let hair = HAIR[p.hairColor] ?? HAIR[0];
  if (old && p.hairColor !== 4) hair = mix(hair, '#a9a7a2', 0.55);
  const w = (female ? 32.5 : 35) + range(r, -1.5, 1.5);
  return {
    cx: 100,
    topY: 50 + range(r, -2, 2),
    eyeY: 106 + range(r, -1.5, 1.5),
    w,
    jawW: (female ? 21 : 26) + range(r, -2, 2.5) + (old ? 1.5 : 0),
    chinY: (female ? 147 : 151) + range(r, -2, 2),
    eyeDX: 15.5 + range(r, -0.8, 1),
    noseY: 124 + range(r, -1.5, 2),
    mouthY: 137 + range(r, -1, 1.5),
    mouthW: (female ? 10.5 : 11.5) + range(r, -1, 1.5),
    noseW: (female ? 6 : 7.2) + range(r, -0.6, 1),
    skin,
    skinDark: mix(skin, '#4a1f16', 0.42),
    skinLight: mix(skin, '#fff3e4', 0.35),
    hair,
    eye: pick(r, EYES),
    female,
    old,
    young,
  };
}

function headPath(f: Face): Path2D {
  const { cx, topY, eyeY, w, jawW, chinY } = f;
  const p = new Path2D();
  p.moveTo(cx, topY);
  p.bezierCurveTo(cx + w * 0.62, topY, cx + w * 1.02, topY + 22, cx + w, eyeY - 6);
  p.bezierCurveTo(cx + w * 0.99, eyeY + 16, cx + jawW + 6, chinY - 20, cx + jawW * 0.52, chinY - 4);
  p.quadraticCurveTo(cx, chinY + 3, cx - jawW * 0.52, chinY - 4);
  p.bezierCurveTo(cx - jawW - 6, chinY - 20, cx - w * 0.99, eyeY + 16, cx - w, eyeY - 6);
  p.bezierCurveTo(cx - w * 1.02, topY + 22, cx - w * 0.62, topY, cx, topY);
  p.closePath();
  return p;
}

function shouldersPath(f: Face): Path2D {
  const cx = f.cx;
  const sw = f.female ? 80 : 94;
  const neckW = f.female ? 15 : 19;
  const p = new Path2D();
  p.moveTo(cx - sw - 18, H + 2);
  p.bezierCurveTo(cx - sw - 14, 222, cx - sw - 6, 202, cx - sw + 10, 194);
  p.bezierCurveTo(cx - sw + 36, 183, cx - neckW - 14, 181, cx - neckW - 3, 171);
  p.quadraticCurveTo(cx, 181, cx + neckW + 3, 171);
  p.bezierCurveTo(cx + neckW + 14, 181, cx + sw - 36, 183, cx + sw - 10, 194);
  p.bezierCurveTo(cx + sw + 6, 202, cx + sw + 14, 222, cx + sw + 18, H + 2);
  p.closePath();
  return p;
}

// ---------------------------------------------------------------------------
// Capas
// ---------------------------------------------------------------------------

function background(g: Ctx, p: PortraitParams, r: Rand) {
  const accent = p.accent;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, mix(shade(accent, -0.45), '#1a1c1a', 0.35));
  bg.addColorStop(0.55, mix(shade(accent, -0.75), '#0d0f0e', 0.5));
  bg.addColorStop(1, '#070807');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // Arco del túnel al fondo
  g.save();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 16;
  g.beginPath();
  g.ellipse(100, 150, 130, 150, 0, Math.PI, 0);
  g.stroke();
  g.strokeStyle = rgba(shade(accent, -0.2), 0.08);
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(100, 150, 122, 142, 0, Math.PI, 0);
  g.stroke();
  g.restore();
  // Luces desenfocadas (bokeh)
  drawBlurred(g, W, H, 3.5, (b) => {
    for (let i = 0; i < 9; i++) {
      const x = range(r, 0, W);
      const y = range(r, 8, 120);
      const rad = range(r, 3, 11);
      const warm = r() < 0.7;
      b.fillStyle = warm ? rgba('#ffb45a', range(r, 0.12, 0.35)) : rgba(shade(accent, 0.4), range(r, 0.1, 0.25));
      b.beginPath();
      b.arc(x, y, rad, 0, Math.PI * 2);
      b.fill();
    }
  }, 'lighter');
  // Resplandor tras la cabeza
  const halo = g.createRadialGradient(92, 92, 10, 100, 110, 120);
  halo.addColorStop(0, rgba('#ffc680', 0.22));
  halo.addColorStop(0.5, rgba(accent, 0.1));
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
}

/** Luz lateral: medialuna brillante en el borde derecho de una forma. */
function rimLight(g: Ctx, path: Path2D, color: string, dx = -3.5, dy = 1.5, blur = 1.6, alpha = 0.7) {
  const layer = makeCanvas(W, H);
  const lg = ctx2d(layer);
  lg.fillStyle = color;
  lg.fill(path);
  lg.globalCompositeOperation = 'destination-out';
  lg.translate(dx, dy);
  lg.fill(path);
  blurCanvas(layer, blur);
  g.save();
  g.globalCompositeOperation = 'screen';
  g.globalAlpha = alpha;
  g.drawImage(layer, 0, 0);
  g.restore();
}

function shadeInside(g: Ctx, path: Path2D, blur: number, draw: (b: Ctx) => void, op: GlobalCompositeOperation = 'source-over', alpha = 1) {
  const layer = makeCanvas(W, H);
  const lg = ctx2d(layer);
  draw(lg);
  blurCanvas(layer, blur);
  lg.globalCompositeOperation = 'destination-in';
  lg.fill(path);
  g.save();
  g.globalCompositeOperation = op;
  g.globalAlpha = alpha;
  g.drawImage(layer, 0, 0);
  g.restore();
}

function fabricNoise(g: Ctx, path: Path2D, r: Rand, dark: string, n = 260) {
  g.save();
  g.clip(path);
  for (let i = 0; i < n; i++) {
    const x = range(r, 0, W);
    const y = range(r, 160, H);
    g.fillStyle = r() < 0.5 ? rgba(dark, range(r, 0.05, 0.16)) : rgba('#ffffff', range(r, 0.015, 0.05));
    g.fillRect(x, y, range(r, 0.6, 2.2), range(r, 0.6, 2.2));
  }
  g.restore();
}

function body(g: Ctx, f: Face, p: PortraitParams, r: Rand) {
  const o = OUTFITS[p.outfit];
  const base = p.outfit === 'robe' ? mix(o.base, p.accent, 0.25) : o.base;
  const path = shouldersPath(f);
  const grad = g.createLinearGradient(20, 170, 190, 240);
  grad.addColorStop(0, shade(base, 0.12));
  grad.addColorStop(0.5, base);
  grad.addColorStop(1, o.dark);
  g.fillStyle = grad;
  g.fill(path);
  fabricNoise(g, path, r, o.dark);
  const cx = f.cx;
  g.save();
  g.clip(path);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  switch (p.outfit) {
    case 'military': {
      // Cuello de la guerrera con distintivos
      g.fillStyle = shade(base, -0.25);
      g.beginPath();
      g.moveTo(cx - 34, 178);
      g.lineTo(cx - 6, 196);
      g.lineTo(cx, 186);
      g.lineTo(cx + 6, 196);
      g.lineTo(cx + 34, 178);
      g.lineTo(cx + 22, 172);
      g.lineTo(cx, 180);
      g.lineTo(cx - 22, 172);
      g.closePath();
      g.fill();
      for (const sx of [-1, 1]) {
        g.fillStyle = shade(p.accent, -0.1);
        g.beginPath();
        g.moveTo(cx + sx * 14, 181);
        g.lineTo(cx + sx * 27, 176);
        g.lineTo(cx + sx * 25, 185);
        g.lineTo(cx + sx * 11, 190);
        g.closePath();
        g.fill();
        g.fillStyle = '#d9b64e';
        g.beginPath();
        g.arc(cx + sx * 20, 182, 1.6, 0, Math.PI * 2);
        g.fill();
        // Hombreras
        g.fillStyle = shade(base, -0.15);
        g.beginPath();
        g.ellipse(cx + sx * 64, 196, 20, 7, sx * 0.35, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = o.trim;
        g.lineWidth = 1.6;
        g.stroke();
      }
      // Botones
      for (let i = 0; i < 3; i++) {
        const y = 204 + i * 15;
        const bg = g.createRadialGradient(cx - 0.8, y - 0.8, 0.3, cx, y, 3);
        bg.addColorStop(0, '#fff1b8');
        bg.addColorStop(0.5, '#c99a3c');
        bg.addColorStop(1, '#5a3f12');
        g.fillStyle = bg;
        g.beginPath();
        g.arc(cx, y, 2.8, 0, Math.PI * 2);
        g.fill();
      }
      // Correaje
      g.strokeStyle = shade(o.trim, -0.35);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(cx + 44, 184);
      g.lineTo(cx - 30, H + 4);
      g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.08);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx + 42, 183);
      g.lineTo(cx - 32, H + 3);
      g.stroke();
      break;
    }
    case 'coat': {
      // Solapas anchas y cuello de piel o paño
      g.fillStyle = shade(base, -0.28);
      g.beginPath();
      g.moveTo(cx - 44, 176);
      g.quadraticCurveTo(cx - 20, 200, cx - 4, H);
      g.lineTo(cx - 20, H);
      g.quadraticCurveTo(cx - 36, 210, cx - 58, 186);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx + 44, 176);
      g.quadraticCurveTo(cx + 20, 200, cx + 4, H);
      g.lineTo(cx + 20, H);
      g.quadraticCurveTo(cx + 36, 210, cx + 58, 186);
      g.closePath();
      g.fill();
      // Jersey o camisa
      g.fillStyle = mix(p.accent, '#2a2622', 0.7);
      g.beginPath();
      g.moveTo(cx - 20, 178);
      g.quadraticCurveTo(cx, 186, cx + 20, 178);
      g.lineTo(cx + 6, H);
      g.lineTo(cx - 6, H);
      g.closePath();
      g.fill();
      // Botones dobles
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
          g.fillStyle = '#1b1612';
          g.beginPath();
          g.arc(cx + sx * 24, 212 + i * 17, 2.6, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = rgba('#ffffff', 0.18);
          g.beginPath();
          g.arc(cx + sx * 24 - 0.7, 211.3 + i * 17, 0.9, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case 'suit': {
      // Camisa, corbata y solapas
      g.fillStyle = '#d9d4c7';
      g.beginPath();
      g.moveTo(cx - 18, 176);
      g.lineTo(cx, 198);
      g.lineTo(cx + 18, 176);
      g.lineTo(cx + 10, H);
      g.lineTo(cx - 10, H);
      g.closePath();
      g.fill();
      g.fillStyle = shade(p.accent, -0.35);
      g.beginPath();
      g.moveTo(cx - 4, 184);
      g.lineTo(cx + 4, 184);
      g.lineTo(cx + 6, 222);
      g.lineTo(cx, 232);
      g.lineTo(cx - 6, 222);
      g.closePath();
      g.fill();
      g.fillStyle = shade(base, -0.3);
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + sx * 20, 174);
        g.lineTo(cx + sx * 8, 216);
        g.lineTo(cx + sx * 14, H);
        g.lineTo(cx + sx * 26, H);
        g.lineTo(cx + sx * 22, 206);
        g.lineTo(cx + sx * 34, 196);
        g.closePath();
        g.fill();
      }
      break;
    }
    case 'rags': {
      // Bufanda enrollada y remiendos
      for (let i = 0; i < 4; i++) {
        g.fillStyle = shade(mix(p.accent, '#5c5443', 0.6), -0.1 - i * 0.07);
        g.beginPath();
        g.ellipse(cx + range(r, -4, 4), 184 + i * 7, 40 - i * 3, 9, range(r, -0.08, 0.08), 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = rgba('#000000', 0.25);
        g.lineWidth = 1;
        g.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const x = range(r, 30, 170);
        const y = range(r, 205, 232);
        g.fillStyle = shade(base, range(r, -0.3, 0.15));
        g.fillRect(x, y, range(r, 10, 18), range(r, 8, 14));
        g.strokeStyle = rgba('#e0d4b0', 0.35);
        g.setLineDash([2, 2]);
        g.lineWidth = 0.8;
        g.strokeRect(x, y, 14, 10);
        g.setLineDash([]);
      }
      break;
    }
    case 'robe': {
      // Túnica con bordado en el cuello
      g.strokeStyle = o.trim;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx - 24, 174);
      g.quadraticCurveTo(cx, 210, cx + 24, 174);
      g.stroke();
      g.lineWidth = 1.2;
      g.strokeStyle = shade(o.trim, 0.3);
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const x = cx - 24 + 48 * t;
        const y = 174 + Math.sin(t * Math.PI) * 18;
        g.beginPath();
        g.arc(x, y, 1.3, 0, Math.PI * 2);
        g.stroke();
      }
      g.strokeStyle = rgba(o.dark, 0.6);
      g.lineWidth = 2.5;
      for (const x of [cx - 50, cx - 30, cx + 32, cx + 54]) {
        g.beginPath();
        g.moveTo(x, 200);
        g.quadraticCurveTo(x + range(r, -6, 6), 220, x + range(r, -4, 4), H);
        g.stroke();
      }
      break;
    }
    case 'leather': {
      // Chaqueta de cuero con cremallera y tachuelas
      g.fillStyle = shade(base, -0.35);
      g.beginPath();
      g.moveTo(cx - 30, 174);
      g.lineTo(cx - 10, 214);
      g.lineTo(cx - 2, H);
      g.lineTo(cx - 14, H);
      g.lineTo(cx - 48, 186);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx + 30, 174);
      g.lineTo(cx + 10, 214);
      g.lineTo(cx + 2, H);
      g.lineTo(cx + 14, H);
      g.lineTo(cx + 48, 186);
      g.closePath();
      g.fill();
      g.fillStyle = '#1d1a18';
      g.beginPath();
      g.moveTo(cx - 12, 178);
      g.quadraticCurveTo(cx, 186, cx + 12, 178);
      g.lineTo(cx + 3, H);
      g.lineTo(cx - 3, H);
      g.closePath();
      g.fill();
      // Brillos del cuero
      g.strokeStyle = rgba('#ffe2c0', 0.13);
      g.lineWidth = 2.2;
      for (let i = 0; i < 6; i++) {
        const x = range(r, 30, 170);
        g.beginPath();
        g.moveTo(x, range(r, 196, 210));
        g.quadraticCurveTo(x + range(r, -8, 8), 222, x + range(r, -6, 6), H);
        g.stroke();
      }
      // Tachuelas en los hombros
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 5; i++) {
          const x = cx + sx * (52 + i * 6);
          const y = 190 + i * 3.5;
          const sg = g.createRadialGradient(x - 0.6, y - 0.6, 0.2, x, y, 2.2);
          sg.addColorStop(0, '#ffffff');
          sg.addColorStop(0.4, '#a9a9a9');
          sg.addColorStop(1, '#2b2b2b');
          g.fillStyle = sg;
          g.beginPath();
          g.arc(x, y, 2.1, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
  }
  // Pliegues suaves
  g.restore();
  shadeInside(g, path, 3, (b) => {
    b.strokeStyle = rgba(o.dark, 0.55);
    b.lineWidth = 5;
    b.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const x = range(r, 24, 176);
      b.beginPath();
      b.moveTo(x, range(r, 190, 205));
      b.quadraticCurveTo(x + range(r, -14, 14), 222, x + range(r, -10, 10), H);
      b.stroke();
    }
  });
  // Sombra que proyecta la cabeza sobre el pecho
  shadeInside(g, path, 7, (b) => {
    b.fillStyle = 'rgba(0,0,0,0.55)';
    b.beginPath();
    b.ellipse(f.cx + 4, 178, 34, 12, 0, 0, Math.PI * 2);
    b.fill();
  });
  // Medallas
  if (p.medals) medals(g, f.cx - 44, 204, r);
  rimLight(g, path, '#ffd9a8', -3, 1.5, 1.8, 0.45);
}

function medals(g: Ctx, x: number, y: number, r: Rand) {
  const ribbons = [
    ['#b3202c', '#e8d9a0', '#b3202c'],
    ['#2f62d8', '#e9e2cf', '#2f62d8'],
    ['#3f8f3a', '#d9b64e', '#3f8f3a'],
  ];
  const n = 2 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const rx = x + i * 11;
    const rib = ribbons[i % ribbons.length];
    for (let k = 0; k < 3; k++) {
      g.fillStyle = rib[k];
      g.fillRect(rx + k * 3, y, 3, 6);
    }
    g.strokeStyle = 'rgba(0,0,0,0.4)';
    g.lineWidth = 0.6;
    g.strokeRect(rx, y, 9, 6);
    const mx = rx + 4.5;
    const my = y + 12;
    const mg = g.createRadialGradient(mx - 1.2, my - 1.4, 0.4, mx, my, 4.4);
    mg.addColorStop(0, '#fff6cf');
    mg.addColorStop(0.45, i === 1 ? '#c9c9c9' : '#d6a73e');
    mg.addColorStop(1, i === 1 ? '#4b4b4b' : '#5c3d0e');
    g.fillStyle = mg;
    g.beginPath();
    if (i % 2 === 0) {
      for (let s = 0; s < 10; s++) {
        const rr = s % 2 === 0 ? 4.4 : 2;
        const a = -Math.PI / 2 + (s * Math.PI) / 5;
        g.lineTo(mx + rr * Math.cos(a), my + rr * Math.sin(a));
      }
      g.closePath();
    } else {
      g.arc(mx, my, 3.8, 0, Math.PI * 2);
    }
    g.fill();
  }
}

function neck(g: Ctx, f: Face) {
  const nw = f.female ? 14 : 18;
  const path = new Path2D();
  path.moveTo(f.cx - nw, f.chinY - 22);
  path.lineTo(f.cx - nw - 2, 184);
  path.quadraticCurveTo(f.cx, 190, f.cx + nw + 2, 184);
  path.lineTo(f.cx + nw, f.chinY - 22);
  path.closePath();
  const grad = g.createLinearGradient(f.cx - nw, 0, f.cx + nw, 0);
  grad.addColorStop(0, mix(f.skin, f.skinDark, 0.3));
  grad.addColorStop(1, f.skinDark);
  g.fillStyle = grad;
  g.fill(path);
  shadeInside(g, path, 3, (b) => {
    b.fillStyle = rgba(f.skinDark, 0.95);
    b.beginPath();
    b.ellipse(f.cx, f.chinY - 2, f.jawW + 4, 12, 0, 0, Math.PI * 2);
    b.fill();
  });
  if (!f.female) {
    g.strokeStyle = rgba(f.skinDark, 0.35);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(f.cx - 2, f.chinY + 10);
    g.quadraticCurveTo(f.cx, f.chinY + 14, f.cx + 2, f.chinY + 10);
    g.stroke();
  }
}

function ears(g: Ctx, f: Face) {
  for (const sx of [-1, 1]) {
    const x = f.cx + sx * (f.w - 0.5);
    const y = f.eyeY + 6;
    const grad = g.createRadialGradient(x - sx * 1, y - 2, 1, x, y, 10);
    grad.addColorStop(0, sx < 0 ? f.skin : f.skinDark);
    grad.addColorStop(1, f.skinDark);
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, 6, 11, sx * 0.12, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba(mix(f.skinDark, '#000000', 0.3), 0.6);
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(x + sx * 0.6, y, 3, 7, sx * 0.12, -Math.PI / 2, Math.PI / 2, sx < 0);
    g.stroke();
  }
}

function skin(g: Ctx, f: Face, head: Path2D, r: Rand) {
  const grad = g.createRadialGradient(f.cx - 12, f.eyeY - 8, 6, f.cx + 4, f.eyeY + 6, f.w * 1.6);
  grad.addColorStop(0, f.skinLight);
  grad.addColorStop(0.45, f.skin);
  grad.addColorStop(1, f.skinDark);
  g.fillStyle = grad;
  g.fill(head);
  // Modelado: cuencas, pómulos, lado en sombra, barbilla
  shadeInside(g, head, 5, (b) => {
    b.fillStyle = rgba(f.skinDark, 0.55);
    for (const sx of [-1, 1]) {
      b.beginPath();
      b.ellipse(f.cx + sx * f.eyeDX, f.eyeY - 1, 10, 7, 0, 0, Math.PI * 2);
      b.fill();
    }
    // Lado derecho en sombra
    b.fillStyle = rgba(f.skinDark, 0.7);
    b.beginPath();
    b.ellipse(f.cx + f.w * 0.95, f.eyeY + 14, 12, 40, -0.1, 0, Math.PI * 2);
    b.fill();
    // Bajo el pómulo
    b.fillStyle = rgba(f.skinDark, 0.35);
    for (const sx of [-1, 1]) {
      b.beginPath();
      b.ellipse(f.cx + sx * (f.w - 8), f.noseY + 6, 6, 10, sx * 0.3, 0, Math.PI * 2);
      b.fill();
    }
    // Sombra de la nariz y bajo el labio
    b.fillStyle = rgba(f.skinDark, 0.5);
    b.beginPath();
    b.ellipse(f.cx + 5, f.noseY - 4, 3.5, 11, 0.15, 0, Math.PI * 2);
    b.fill();
    b.beginPath();
    b.ellipse(f.cx, f.mouthY + 8, 8, 3, 0, 0, Math.PI * 2);
    b.fill();
  }, 'multiply', 0.9);
  // Luces: frente, puente de la nariz, pómulo iluminado, barbilla
  shadeInside(g, head, 4, (b) => {
    b.fillStyle = rgba(f.skinLight, 0.8);
    b.beginPath();
    b.ellipse(f.cx - 7, f.topY + 26, 14, 8, -0.2, 0, Math.PI * 2);
    b.fill();
    b.beginPath();
    b.ellipse(f.cx - 1.5, f.noseY - 8, 2, 9, 0, 0, Math.PI * 2);
    b.fill();
    b.beginPath();
    b.ellipse(f.cx - f.eyeDX - 4, f.eyeY + 12, 7, 5, 0.3, 0, Math.PI * 2);
    b.fill();
    b.beginPath();
    b.ellipse(f.cx - 2, f.chinY - 8, 5, 3, 0, 0, Math.PI * 2);
    b.fill();
  }, 'screen', 0.55);
  // Rubor
  shadeInside(g, head, 6, (b) => {
    b.fillStyle = rgba('#c0504a', f.female ? 0.3 : 0.18);
    for (const sx of [-1, 1]) {
      b.beginPath();
      b.ellipse(f.cx + sx * (f.eyeDX + 3), f.noseY + 2, 7, 5, 0, 0, Math.PI * 2);
      b.fill();
    }
  });
  // Poros y textura de piel
  g.save();
  g.clip(head);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = r() < 0.5 ? rgba(f.skinDark, range(r, 0.04, 0.1)) : rgba('#ffffff', range(r, 0.02, 0.05));
    g.fillRect(range(r, f.cx - f.w, f.cx + f.w), range(r, f.topY, f.chinY), 0.8, 0.8);
  }
  g.restore();
}

function eyes(g: Ctx, f: Face, p: PortraitParams, r: Rand) {
  for (const sx of [-1, 1]) {
    const x = f.cx + sx * f.eyeDX;
    const y = f.eyeY;
    if (p.eyepatch && sx > 0) continue;
    const ew = 8;
    const eh = f.female ? 3.9 : 3.4;
    const almond = new Path2D();
    almond.moveTo(x - ew, y + 0.4);
    almond.quadraticCurveTo(x - 1, y - eh * 1.6, x + ew, y);
    almond.quadraticCurveTo(x + 1, y + eh * 1.2, x - ew, y + 0.4);
    almond.closePath();
    g.fillStyle = mix('#d4ccbf', f.skin, 0.25);
    g.fill(almond);
    g.save();
    g.clip(almond);
    const ig = g.createRadialGradient(x + 0.3, y - 0.2, 0.5, x + 0.3, y, 4.1);
    ig.addColorStop(0, shade(f.eye, 0.3));
    ig.addColorStop(0.7, f.eye);
    ig.addColorStop(1, shade(f.eye, -0.5));
    g.fillStyle = ig;
    g.beginPath();
    g.arc(x + 0.3, y, 4.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0b0908';
    g.beginPath();
    g.arc(x + 0.3, y, 1.5, 0, Math.PI * 2);
    g.fill();
    // Sombra del párpado sobre el ojo
    g.fillStyle = rgba('#2a1a14', 0.55);
    g.fillRect(x - ew, y - eh * 2, ew * 2, eh * 1.35);
    g.restore();
    // Brillo
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(x - 0.8, y - 1.1, 0.8, 0, Math.PI * 2);
    g.fill();
    // Párpado superior
    g.strokeStyle = rgba('#1c120e', 0.9);
    g.lineWidth = f.female ? 1.6 : 1.3;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - ew - 0.5, y + 0.6);
    g.quadraticCurveTo(x - 1, y - eh * 1.75, x + ew + 0.5, y - 0.2);
    g.stroke();
    // Pliegue y párpado inferior
    g.strokeStyle = rgba(f.skinDark, 0.55);
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(x - ew + 1, y - eh * 1.2);
    g.quadraticCurveTo(x, y - eh * 2.6, x + ew, y - eh * 1.3);
    g.stroke();
    g.beginPath();
    g.moveTo(x - ew + 1.5, y + 1.8);
    g.quadraticCurveTo(x, y + eh * 1.5, x + ew - 1, y + 1.2);
    g.stroke();
    if (f.old) {
      // Bolsas y patas de gallo
      g.strokeStyle = rgba(f.skinDark, 0.5);
      g.beginPath();
      g.moveTo(x - ew + 2, y + 4.5);
      g.quadraticCurveTo(x, y + 7, x + ew - 1, y + 4);
      g.stroke();
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo(x + sx * (ew + 1), y - 1 + k * 2);
        g.lineTo(x + sx * (ew + 5), y - 2 + k * 3);
        g.stroke();
      }
    }
    if (f.female) {
      g.strokeStyle = rgba('#140c09', 0.8);
      g.lineWidth = 0.7;
      for (let k = 0; k < 4; k++) {
        const t = 0.35 + k * 0.18;
        const lx = x - ew + ew * 2 * t;
        const ly = y - eh * 1.5 * Math.sin(t * Math.PI) + 0.3;
        g.beginPath();
        g.moveTo(lx, ly);
        g.lineTo(lx + sx * 1.2 + 0.8, ly - 2);
        g.stroke();
      }
    }
  }
  // Cejas
  const browColor = shade(f.hair, luminance(f.hair) > 0.45 ? -0.35 : 0);
  for (const sx of [-1, 1]) {
    const x = f.cx + sx * f.eyeDX;
    const y = f.eyeY - 10 - (f.female ? 1.5 : 0);
    const stern = p.outfit === 'military' || p.outfit === 'leather';
    g.strokeStyle = rgba(browColor, 0.9);
    g.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      const t = k / 15;
      const bx = x - sx * 8 + sx * 17 * t;
      const lift = Math.sin(t * Math.PI) * (f.female ? 3.6 : 2.6) - (stern ? (1 - t) * 2 : 0);
      const by = y - lift + range(r, -0.4, 0.4);
      g.lineWidth = (f.female ? 1 : 1.5) * (1 - t * 0.5);
      g.beginPath();
      g.moveTo(bx, by + 1.2);
      g.lineTo(bx + sx * 2.2, by - 0.6);
      g.stroke();
    }
  }
}

function noseAndMouth(g: Ctx, f: Face, p: PortraitParams) {
  const { cx, noseY, noseW, mouthY, mouthW } = f;
  // Aletas y orificios
  g.fillStyle = rgba(f.skinDark, 0.75);
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + sx * (noseW * 0.5), noseY + 1.5, 2.2, 1.3, sx * 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = rgba(f.skinDark, 0.8);
  g.lineWidth = 1.2;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx - noseW, noseY - 1);
  g.quadraticCurveTo(cx - noseW - 1, noseY + 3, cx - noseW * 0.4, noseY + 3.5);
  g.moveTo(cx + noseW, noseY - 1);
  g.quadraticCurveTo(cx + noseW + 1, noseY + 3, cx + noseW * 0.4, noseY + 3.5);
  g.stroke();
  // Punta iluminada
  g.fillStyle = rgba(f.skinLight, 0.55);
  g.beginPath();
  g.ellipse(cx - 1, noseY - 2, 2.4, 1.8, 0, 0, Math.PI * 2);
  g.fill();
  // Surco nasolabial
  if (f.old || !f.young) {
    g.strokeStyle = rgba(f.skinDark, f.old ? 0.5 : 0.25);
    g.lineWidth = 1.1;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + sx * (noseW + 2), noseY);
      g.quadraticCurveTo(cx + sx * (mouthW + 4), mouthY - 4, cx + sx * (mouthW + 3), mouthY + 5);
      g.stroke();
    }
  }
  if (p.facial === 'fullbeard' || p.facial === 'beard') return;
  // Labios
  const lip = f.female ? mix(f.skin, '#9c3b3b', 0.55) : mix(f.skin, '#7a3b30', 0.4);
  g.fillStyle = shade(lip, -0.12);
  g.beginPath();
  g.moveTo(cx - mouthW, mouthY);
  g.quadraticCurveTo(cx - mouthW * 0.4, mouthY - 3.4, cx, mouthY - 1.8);
  g.quadraticCurveTo(cx + mouthW * 0.4, mouthY - 3.4, cx + mouthW, mouthY);
  g.quadraticCurveTo(cx, mouthY + 0.8, cx - mouthW, mouthY);
  g.fill();
  g.fillStyle = lip;
  g.beginPath();
  g.moveTo(cx - mouthW + 1, mouthY + 0.4);
  g.quadraticCurveTo(cx, mouthY + (f.female ? 5.2 : 4), cx + mouthW - 1, mouthY + 0.4);
  g.quadraticCurveTo(cx, mouthY + 1.2, cx - mouthW + 1, mouthY + 0.4);
  g.fill();
  g.fillStyle = rgba('#ffffff', 0.18);
  g.beginPath();
  g.ellipse(cx - 2, mouthY + 2.2, 3, 0.9, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = rgba('#2a1411', 0.75);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - mouthW, mouthY);
  g.quadraticCurveTo(cx, mouthY + 1.4, cx + mouthW, mouthY);
  g.stroke();
  if (f.old) {
    // Arrugas de la frente
    g.strokeStyle = rgba(f.skinDark, 0.4);
    g.lineWidth = 0.9;
    for (let k = 0; k < 3; k++) {
      const y = f.topY + 22 + k * 5;
      g.beginPath();
      g.moveTo(cx - 16 + k * 2, y);
      g.quadraticCurveTo(cx, y - 2, cx + 16 - k * 2, y);
      g.stroke();
    }
  }
}

function hairStrands(g: Ctx, clip: Path2D, r: Rand, color: string, n: number, from: () => [number, number], len: [number, number], angle: () => number, width = 0.9) {
  g.save();
  g.clip(clip);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const [x, y] = from();
    const a = angle();
    const l = range(r, len[0], len[1]);
    const bend = range(r, -0.35, 0.35);
    const light = r();
    g.strokeStyle = light < 0.35 ? rgba(shade(color, 0.35), range(r, 0.25, 0.55)) : light < 0.7 ? rgba(shade(color, -0.35), range(r, 0.3, 0.6)) : rgba(color, 0.5);
    g.lineWidth = width * range(r, 0.6, 1.3);
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a + bend) * l * 0.5, y + Math.sin(a + bend) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.restore();
}

function hairBack(g: Ctx, f: Face, p: PortraitParams, r: Rand) {
  if (p.hat === 'hood' || p.hat === 'gasmask') return;
  if (p.hair !== 'long' && p.hair !== 'bun') return;
  if (p.hair === 'long') {
    const path = new Path2D();
    path.moveTo(f.cx - f.w - 6, f.eyeY - 20);
    path.bezierCurveTo(f.cx - f.w - 16, f.eyeY + 30, f.cx - f.w - 16, 186, f.cx - f.w - 2, 200);
    path.lineTo(f.cx + f.w + 2, 200);
    path.bezierCurveTo(f.cx + f.w + 16, 186, f.cx + f.w + 16, f.eyeY + 30, f.cx + f.w + 6, f.eyeY - 20);
    path.closePath();
    const grad = g.createLinearGradient(0, f.eyeY, 0, 200);
    grad.addColorStop(0, shade(f.hair, -0.1));
    grad.addColorStop(1, shade(f.hair, -0.55));
    g.fillStyle = grad;
    g.fill(path);
    hairStrands(g, path, r, f.hair, 140, () => [range(r, f.cx - f.w - 14, f.cx + f.w + 14), range(r, f.eyeY - 20, f.eyeY + 20)], [40, 90], () => Math.PI / 2 + range(r, -0.15, 0.15), 1.1);
  }
}

function hairFront(g: Ctx, f: Face, p: PortraitParams, r: Rand, head: Path2D) {
  const hat = p.hat ?? 'none';
  if (hat === 'gasmask' || hat === 'hood') return;
  const { cx, topY, w, eyeY } = f;
  const hairline = topY + (f.old && !f.female ? 20 : 15);
  // Con gorra o casco solo asoman las patillas
  if (hat !== 'none' && hat !== 'bandana') {
    if (p.hair === 'long') {
      const side = new Path2D();
      for (const sx of [-1, 1]) {
        side.moveTo(cx + sx * (w - 2), eyeY - 14);
        side.quadraticCurveTo(cx + sx * (w + 8), eyeY + 20, cx + sx * (w + 5), eyeY + 44);
        side.lineTo(cx + sx * (w - 2), eyeY + 40);
        side.quadraticCurveTo(cx + sx * (w - 3), eyeY + 10, cx + sx * (w - 8), eyeY - 14);
        side.closePath();
      }
      g.fillStyle = shade(f.hair, -0.15);
      g.fill(side);
      hairStrands(g, side, r, f.hair, 40, () => [cx + (r() < 0.5 ? -1 : 1) * (w + 1), range(r, eyeY - 14, eyeY)], [20, 40], () => Math.PI / 2, 0.9);
    }
    // Patillas
    g.fillStyle = rgba(f.hair, 0.8);
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + sx * (w - 1), eyeY - 12);
      g.lineTo(cx + sx * (w - 5), eyeY - 12);
      g.lineTo(cx + sx * (w - 3), eyeY + 4);
      g.lineTo(cx + sx * (w - 0.5), eyeY + 3);
      g.closePath();
      g.fill();
    }
    return;
  }
  if (p.hair === 'none') {
    // Calva: brillo en la coronilla
    g.save();
    g.clip(head);
    const sh = g.createRadialGradient(cx - 8, topY + 10, 1, cx - 8, topY + 10, 18);
    sh.addColorStop(0, 'rgba(255,255,255,0.35)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh;
    g.fillRect(cx - 30, topY - 5, 50, 40);
    g.restore();
    return;
  }
  const path = new Path2D();
  if (p.hair === 'buzz') {
    path.moveTo(cx - w + 1, eyeY - 12);
    path.bezierCurveTo(cx - w, topY - 2, cx + w, topY - 2, cx + w - 1, eyeY - 12);
    path.quadraticCurveTo(cx + w - 6, hairline + 2, cx, hairline + 1);
    path.quadraticCurveTo(cx - w + 6, hairline + 2, cx - w + 1, eyeY - 12);
    path.closePath();
    g.fillStyle = rgba(f.hair, 0.75);
    g.fill(path);
    g.save();
    g.clip(path);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rgba(r() < 0.5 ? shade(f.hair, -0.4) : shade(f.hair, 0.25), range(r, 0.2, 0.6));
      g.fillRect(range(r, cx - w, cx + w), range(r, topY - 4, eyeY - 8), 0.7, 1.1);
    }
    g.restore();
    return;
  }
  const volume = p.hair === 'long' || p.hair === 'bun' ? 6 : 4;
  path.moveTo(cx - w - 2, eyeY - 4);
  path.bezierCurveTo(cx - w - volume, topY - 6, cx - 10, topY - volume - 8, cx + 4, topY - volume - 6);
  path.bezierCurveTo(cx + w * 0.7, topY - volume - 4, cx + w + volume, topY + 4, cx + w + 2, eyeY - 4);
  // Flequillo / raya
  path.quadraticCurveTo(cx + w - 4, hairline - 2, cx + w * 0.4, hairline + 2);
  path.quadraticCurveTo(cx + 2, hairline - 6, cx - w * 0.35, hairline + (p.hair === 'short' ? 6 : 2));
  path.quadraticCurveTo(cx - w + 4, hairline, cx - w - 2, eyeY - 4);
  path.closePath();
  const grad = g.createLinearGradient(cx - w, topY - 10, cx + w, eyeY);
  grad.addColorStop(0, shade(f.hair, 0.22));
  grad.addColorStop(0.5, f.hair);
  grad.addColorStop(1, shade(f.hair, -0.45));
  g.fillStyle = grad;
  g.fill(path);
  // Mechones desde la raya hacia los lados
  hairStrands(
    g,
    path,
    r,
    f.hair,
    220,
    () => [cx + range(r, -8, 6), range(r, topY - 8, topY + 4)],
    [18, 48],
    () => (r() < 0.55 ? Math.PI * 0.95 : 0.05) + range(r, -0.1, 0.55),
    1,
  );
  // Brillo del pelo
  g.save();
  g.clip(path);
  g.strokeStyle = rgba('#ffffff', 0.18);
  g.lineWidth = 4;
  g.beginPath();
  g.arc(cx - 4, topY + 30, 34, Math.PI * 1.15, Math.PI * 1.55);
  g.stroke();
  g.restore();
  rimLight(g, path, '#ffe0b0', -2.5, 1, 1.2, 0.35);
  if (p.hair === 'bun') {
    const bx = cx + 2;
    const by = topY - 12;
    const bun = new Path2D();
    bun.ellipse(bx, by, 15, 12, 0, 0, Math.PI * 2);
    const bg = g.createRadialGradient(bx - 5, by - 5, 2, bx, by, 16);
    bg.addColorStop(0, shade(f.hair, 0.25));
    bg.addColorStop(1, shade(f.hair, -0.45));
    g.fillStyle = bg;
    g.fill(bun);
    hairStrands(g, bun, r, f.hair, 60, () => [bx + range(r, -12, 12), by + range(r, -9, 9)], [8, 18], () => range(r, 0, Math.PI * 2), 0.8);
  }
}

function facialHair(g: Ctx, f: Face, p: PortraitParams, r: Rand, head: Path2D) {
  const kind = p.facial ?? 'none';
  if (kind === 'none' || p.hat === 'gasmask') return;
  const { cx, mouthY, jawW, chinY, noseY, w } = f;
  if (kind === 'stubble' || kind === 'beard' || kind === 'fullbeard') {
    // Sombra de barba
    const area = new Path2D();
    area.moveTo(cx - w + 2, f.eyeY + 14);
    area.quadraticCurveTo(cx - w + 6, chinY - 4, cx, chinY + 3);
    area.quadraticCurveTo(cx + w - 6, chinY - 4, cx + w - 2, f.eyeY + 14);
    area.quadraticCurveTo(cx + w - 10, noseY + 6, cx + 10, noseY + 6);
    area.lineTo(cx - 10, noseY + 6);
    area.quadraticCurveTo(cx - w + 10, noseY + 6, cx - w + 2, f.eyeY + 14);
    area.closePath();
    g.save();
    g.clip(head);
    g.clip(area);
    g.fillStyle = rgba(f.hair, 0.16);
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rgba(shade(f.hair, -0.2), range(r, 0.15, 0.5));
      g.fillRect(range(r, cx - w, cx + w), range(r, noseY, chinY + 4), 0.6, 0.9);
    }
    g.restore();
  }
  if (kind === 'beard' || kind === 'fullbeard') {
    const full = kind === 'fullbeard';
    const path = new Path2D();
    const side = full ? w - 1 : jawW + 2;
    const top = full ? f.eyeY + 12 : mouthY - 6;
    path.moveTo(cx - side, top);
    path.bezierCurveTo(cx - side - 2, chinY, cx - jawW * 0.8, chinY + (full ? 24 : 14), cx, chinY + (full ? 28 : 16));
    path.bezierCurveTo(cx + jawW * 0.8, chinY + (full ? 24 : 14), cx + side + 2, chinY, cx + side, top);
    path.quadraticCurveTo(cx + side - 6, mouthY + 2, cx + f.mouthW + 2, mouthY + 1);
    path.quadraticCurveTo(cx, mouthY + 6, cx - f.mouthW - 2, mouthY + 1);
    path.quadraticCurveTo(cx - side + 6, mouthY + 2, cx - side, top);
    path.closePath();
    const grad = g.createLinearGradient(0, top, 0, chinY + 28);
    grad.addColorStop(0, shade(f.hair, 0.05));
    grad.addColorStop(1, shade(f.hair, -0.45));
    g.fillStyle = grad;
    g.fill(path);
    hairStrands(g, path, r, f.hair, full ? 320 : 180, () => [range(r, cx - side, cx + side), range(r, top, chinY + 6)], [6, 16], () => Math.PI / 2 + range(r, -0.5, 0.5), 0.8);
    // Boca asomando
    g.strokeStyle = rgba('#2a1411', 0.8);
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(cx - 6, mouthY + 1.5);
    g.quadraticCurveTo(cx, mouthY + 3, cx + 6, mouthY + 1.5);
    g.stroke();
  }
  if (kind === 'mustache' || kind === 'beard' || kind === 'fullbeard') {
    const path = new Path2D();
    path.moveTo(cx - 1, noseY + 5);
    path.bezierCurveTo(cx - 8, noseY + 3, cx - 16, mouthY - 3, cx - 17, mouthY + 3);
    path.quadraticCurveTo(cx - 9, mouthY - 1, cx, mouthY - 1);
    path.quadraticCurveTo(cx + 9, mouthY - 1, cx + 17, mouthY + 3);
    path.bezierCurveTo(cx + 16, mouthY - 3, cx + 8, noseY + 3, cx + 1, noseY + 5);
    path.closePath();
    g.fillStyle = shade(f.hair, -0.1);
    g.fill(path);
    hairStrands(g, path, r, f.hair, 90, () => [cx + range(r, -2, 2), noseY + range(r, 4, 7)], [6, 17], () => (r() < 0.5 ? Math.PI * 0.8 : Math.PI * 0.2) + range(r, -0.2, 0.2), 0.8);
  }
}

function scarsAndPatch(g: Ctx, f: Face, p: PortraitParams) {
  if (p.scar && p.hat !== 'gasmask') {
    const x0 = f.cx - f.eyeDX - 6;
    const y0 = f.eyeY - 16;
    g.lineCap = 'round';
    g.strokeStyle = rgba('#7a3a33', 0.75);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo(x0 + 4, y0 + 14, x0 + 9, y0 + 30);
    g.stroke();
    g.strokeStyle = rgba('#f0c0a8', 0.45);
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(x0 - 0.8, y0);
    g.quadraticCurveTo(x0 + 3, y0 + 14, x0 + 8, y0 + 30);
    g.stroke();
    for (let k = 0; k < 5; k++) {
      const t = k / 4;
      const x = x0 + 1 + 8 * t;
      const y = y0 + 3 + 26 * t;
      g.strokeStyle = rgba('#7a3a33', 0.5);
      g.beginPath();
      g.moveTo(x - 2, y);
      g.lineTo(x + 2, y + 0.6);
      g.stroke();
    }
  }
  if (p.eyepatch && p.hat !== 'gasmask') {
    const x = f.cx + f.eyeDX;
    const y = f.eyeY;
    g.strokeStyle = '#141210';
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(f.cx - f.w - 1, f.eyeY - 16);
    g.lineTo(x, y);
    g.lineTo(f.cx + f.w + 1, f.eyeY - 2);
    g.stroke();
    const pg = g.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
    pg.addColorStop(0, '#3a3530');
    pg.addColorStop(1, '#0d0c0b');
    g.fillStyle = pg;
    g.beginPath();
    g.ellipse(x, y + 0.5, 8.5, 7, 0.1, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba('#ffffff', 0.12);
    g.lineWidth = 0.8;
    g.stroke();
  }
}

function glasses(g: Ctx, f: Face, p: PortraitParams) {
  if (!p.glasses || p.hat === 'gasmask') return;
  const y = f.eyeY + 0.5;
  g.save();
  for (const sx of [-1, 1]) {
    const x = f.cx + sx * f.eyeDX;
    g.fillStyle = 'rgba(190,215,225,0.1)';
    g.beginPath();
    g.ellipse(x, y, 9.5, 8, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1b1a18';
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(x, y, 7, 5.5, 0, Math.PI * 1.1, Math.PI * 1.45);
    g.stroke();
  }
  g.strokeStyle = '#1b1a18';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(f.cx - f.eyeDX + 9.5, y - 1);
  g.quadraticCurveTo(f.cx, y - 4, f.cx + f.eyeDX - 9.5, y - 1);
  g.moveTo(f.cx - f.eyeDX - 9.5, y - 1);
  g.lineTo(f.cx - f.w, y - 3);
  g.moveTo(f.cx + f.eyeDX + 9.5, y - 1);
  g.lineTo(f.cx + f.w, y - 3);
  g.stroke();
  g.restore();
}

function hats(g: Ctx, f: Face, p: PortraitParams, r: Rand) {
  const hat = p.hat ?? 'none';
  const { cx, topY, w, eyeY } = f;
  switch (hat) {
    case 'ushanka': {
      const fur = '#6b5642';
      const flaps = new Path2D();
      for (const sx of [-1, 1]) {
        flaps.moveTo(cx + sx * (w - 4), eyeY - 18);
        flaps.quadraticCurveTo(cx + sx * (w + 12), eyeY, cx + sx * (w + 9), eyeY + 34);
        flaps.lineTo(cx + sx * (w - 3), eyeY + 36);
        flaps.quadraticCurveTo(cx + sx * (w - 2), eyeY + 6, cx + sx * (w - 10), eyeY - 14);
        flaps.closePath();
      }
      furFill(g, flaps, r, fur, 260);
      const crown = new Path2D();
      crown.moveTo(cx - w - 4, eyeY - 18);
      crown.bezierCurveTo(cx - w - 4, topY - 30, cx + w + 4, topY - 30, cx + w + 4, eyeY - 18);
      crown.closePath();
      const cg = g.createLinearGradient(0, topY - 30, 0, eyeY - 18);
      cg.addColorStop(0, '#6a5a48');
      cg.addColorStop(1, '#3c3226');
      g.fillStyle = cg;
      g.fill(crown);
      const band = new Path2D();
      band.moveTo(cx - w - 9, eyeY - 12);
      band.bezierCurveTo(cx - w - 10, topY + 2, cx + w + 10, topY + 2, cx + w + 9, eyeY - 12);
      band.quadraticCurveTo(cx, eyeY - 20, cx - w - 9, eyeY - 12);
      band.closePath();
      furFill(g, band, r, fur, 380);
      // Estrella
      const sx0 = cx;
      const sy0 = topY + 12;
      g.fillStyle = '#b3202c';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? 5.5 : 2.3;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(sx0 + rr * Math.cos(a), sy0 + rr * Math.sin(a));
      }
      g.closePath();
      g.fill();
      g.strokeStyle = '#e6c15a';
      g.lineWidth = 0.8;
      g.stroke();
      break;
    }
    case 'cap': {
      const military = p.outfit === 'military';
      const crownCol = military ? '#3f4a32' : '#2b303d';
      const crown = new Path2D();
      crown.moveTo(cx - w - 4, eyeY - 18);
      crown.bezierCurveTo(cx - w - 14, topY - 22, cx + w + 14, topY - 24, cx + w + 4, eyeY - 18);
      crown.closePath();
      const cg = g.createLinearGradient(0, topY - 24, 0, eyeY - 18);
      cg.addColorStop(0, shade(crownCol, 0.25));
      cg.addColorStop(1, shade(crownCol, -0.3));
      g.fillStyle = cg;
      g.fill(crown);
      rimLight(g, crown, '#ffe2b0', -3, 1, 1.2, 0.4);
      // Cinta
      g.fillStyle = shade(p.accent, -0.2);
      g.beginPath();
      g.moveTo(cx - w - 3, eyeY - 18);
      g.quadraticCurveTo(cx, eyeY - 26, cx + w + 3, eyeY - 18);
      g.lineTo(cx + w + 2, eyeY - 25);
      g.quadraticCurveTo(cx, eyeY - 33, cx - w - 2, eyeY - 25);
      g.closePath();
      g.fill();
      // Visera
      const visor = new Path2D();
      visor.moveTo(cx - w - 2, eyeY - 17);
      visor.quadraticCurveTo(cx, eyeY - 24, cx + w + 2, eyeY - 17);
      visor.quadraticCurveTo(cx, eyeY - 4, cx - w - 2, eyeY - 17);
      visor.closePath();
      const vg = g.createLinearGradient(0, eyeY - 22, 0, eyeY - 8);
      vg.addColorStop(0, '#3a3a3a');
      vg.addColorStop(0.5, '#0e0e0e');
      vg.addColorStop(1, '#050505');
      g.fillStyle = vg;
      g.fill(visor);
      g.strokeStyle = 'rgba(255,255,255,0.3)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx - w + 6, eyeY - 16);
      g.quadraticCurveTo(cx - 6, eyeY - 21, cx + 6, eyeY - 20);
      g.stroke();
      // Escarapela
      const bx = cx;
      const by = eyeY - 36;
      const bg = g.createRadialGradient(bx - 1.2, by - 1.2, 0.5, bx, by, 6);
      bg.addColorStop(0, '#fff3c0');
      bg.addColorStop(0.5, '#d4a63f');
      bg.addColorStop(1, '#5c3d0c');
      g.fillStyle = bg;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? 6 : 2.6;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(bx + rr * Math.cos(a), by + rr * Math.sin(a));
      }
      g.closePath();
      g.fill();
      // Sombra de la visera sobre la frente
      g.save();
      g.globalCompositeOperation = 'multiply';
      const sg = g.createLinearGradient(0, eyeY - 12, 0, eyeY + 2);
      sg.addColorStop(0, 'rgba(40,20,10,0.55)');
      sg.addColorStop(1, 'rgba(40,20,10,0)');
      g.fillStyle = sg;
      g.fillRect(cx - w, eyeY - 12, w * 2, 14);
      g.restore();
      break;
    }
    case 'beret': {
      const path = new Path2D();
      path.moveTo(cx - w - 6, eyeY - 18);
      path.bezierCurveTo(cx - w - 16, topY - 20, cx + w + 20, topY - 28, cx + w + 16, eyeY - 26);
      path.quadraticCurveTo(cx + w + 6, eyeY - 14, cx + w - 4, eyeY - 18);
      path.quadraticCurveTo(cx, eyeY - 26, cx - w - 6, eyeY - 18);
      path.closePath();
      const bg = g.createLinearGradient(cx - w, topY - 20, cx + w, eyeY);
      bg.addColorStop(0, shade(p.accent, 0.1));
      bg.addColorStop(1, shade(p.accent, -0.55));
      g.fillStyle = bg;
      g.fill(path);
      fabricNoiseTop(g, path, r, shade(p.accent, -0.6));
      g.strokeStyle = shade(p.accent, -0.6);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx - w - 4, eyeY - 18);
      g.quadraticCurveTo(cx, eyeY - 25, cx + w - 2, eyeY - 18);
      g.stroke();
      rimLight(g, path, '#ffe2b0', -3, 1, 1.2, 0.35);
      break;
    }
    case 'helmet': {
      const path = new Path2D();
      path.moveTo(cx - w - 8, eyeY - 12);
      path.bezierCurveTo(cx - w - 8, topY - 30, cx + w + 8, topY - 30, cx + w + 8, eyeY - 12);
      path.lineTo(cx + w + 14, eyeY - 8);
      path.lineTo(cx - w - 14, eyeY - 8);
      path.closePath();
      const hg = g.createRadialGradient(cx - 12, topY - 8, 3, cx, topY + 10, 60);
      hg.addColorStop(0, '#8a9477');
      hg.addColorStop(0.5, '#4b5540');
      hg.addColorStop(1, '#1c2118');
      g.fillStyle = hg;
      g.fill(path);
      g.save();
      g.clip(path);
      for (let i = 0; i < 80; i++) {
        g.fillStyle = rgba(r() < 0.5 ? '#000000' : '#c9c1a0', range(r, 0.05, 0.18));
        g.beginPath();
        g.arc(range(r, cx - w - 8, cx + w + 8), range(r, topY - 30, eyeY - 8), range(r, 0.4, 1.6), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      g.strokeStyle = '#1a1e16';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - w - 13, eyeY - 8.5);
      g.lineTo(cx + w + 13, eyeY - 8.5);
      g.stroke();
      // Correa
      g.strokeStyle = '#2a2217';
      g.lineWidth = 2.4;
      for (const sx of [-1, 1]) {
        g.beginPath();
        g.moveTo(cx + sx * (w + 2), eyeY - 8);
        g.quadraticCurveTo(cx + sx * (w - 2), f.chinY - 10, cx + sx * 8, f.chinY + 2);
        g.stroke();
      }
      // Brillo especular
      g.strokeStyle = 'rgba(255,255,240,0.35)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx - 6, eyeY - 14, 40, Math.PI * 1.18, Math.PI * 1.42);
      g.stroke();
      break;
    }
    case 'bandana': {
      const path = new Path2D();
      path.moveTo(cx - w - 2, eyeY - 14);
      path.bezierCurveTo(cx - w - 6, topY - 14, cx + w + 6, topY - 14, cx + w + 2, eyeY - 14);
      path.quadraticCurveTo(cx, eyeY - 24, cx - w - 2, eyeY - 14);
      path.closePath();
      const bg = g.createLinearGradient(0, topY - 12, 0, eyeY - 14);
      bg.addColorStop(0, shade(p.accent, 0.05));
      bg.addColorStop(1, shade(p.accent, -0.45));
      g.fillStyle = bg;
      g.fill(path);
      // Motas del estampado
      g.save();
      g.clip(path);
      for (let i = 0; i < 26; i++) {
        g.fillStyle = rgba('#f0e2c8', 0.35);
        g.beginPath();
        g.arc(range(r, cx - w, cx + w), range(r, topY - 10, eyeY - 16), range(r, 0.8, 1.6), 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
      // Nudo y puntas
      g.fillStyle = shade(p.accent, -0.3);
      g.beginPath();
      g.moveTo(cx + w, eyeY - 18);
      g.lineTo(cx + w + 16, eyeY - 6);
      g.lineTo(cx + w + 10, eyeY + 2);
      g.lineTo(cx + w - 2, eyeY - 12);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(cx + w, eyeY - 16);
      g.lineTo(cx + w + 20, eyeY + 8);
      g.lineTo(cx + w + 13, eyeY + 12);
      g.closePath();
      g.fill();
      rimLight(g, path, '#ffe2b0', -3, 1, 1.2, 0.35);
      break;
    }
    case 'kufi': {
      const path = new Path2D();
      path.moveTo(cx - w + 1, eyeY - 20);
      path.bezierCurveTo(cx - w, topY - 12, cx + w, topY - 12, cx + w - 1, eyeY - 20);
      path.quadraticCurveTo(cx, eyeY - 27, cx - w + 1, eyeY - 20);
      path.closePath();
      const kg = g.createLinearGradient(0, topY - 12, 0, eyeY - 20);
      kg.addColorStop(0, '#f3eee0');
      kg.addColorStop(1, '#a9a28c');
      g.fillStyle = kg;
      g.fill(path);
      g.save();
      g.clip(path);
      g.strokeStyle = rgba(shade(p.accent, -0.2), 0.7);
      g.lineWidth = 0.9;
      for (let row = 0; row < 3; row++) {
        const y = eyeY - 24 - row * 7;
        for (let x = cx - w; x < cx + w; x += 6) {
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x + 3, y - 3);
          g.lineTo(x + 6, y);
          g.stroke();
        }
      }
      g.restore();
      break;
    }
    case 'hood': {
      const hood = new Path2D();
      hood.moveTo(cx - 62, H);
      hood.bezierCurveTo(cx - 70, 120, cx - 56, topY - 26, cx, topY - 28);
      hood.bezierCurveTo(cx + 56, topY - 26, cx + 70, 120, cx + 62, H);
      hood.lineTo(cx + 40, H);
      hood.bezierCurveTo(cx + 48, 150, cx + 44, topY + 4, cx, topY + 2);
      hood.bezierCurveTo(cx - 44, topY + 4, cx - 48, 150, cx - 40, H);
      hood.closePath();
      const col = OUTFITS[p.outfit].base;
      const hg = g.createLinearGradient(cx - 60, 0, cx + 60, 0);
      hg.addColorStop(0, shade(col, 0.1));
      hg.addColorStop(1, shade(col, -0.5));
      g.fillStyle = hg;
      g.fill(hood);
      fabricNoiseTop(g, hood, r, shade(col, -0.6));
      // Sombra de la capucha sobre la cara
      g.save();
      g.globalCompositeOperation = 'multiply';
      const sg = g.createLinearGradient(0, topY, 0, eyeY + 20);
      sg.addColorStop(0, 'rgba(20,12,8,0.85)');
      sg.addColorStop(1, 'rgba(20,12,8,0)');
      g.fillStyle = sg;
      g.fillRect(cx - 50, topY - 10, 100, eyeY + 30 - topY);
      g.restore();
      break;
    }
    case 'gasmask':
      gasmask(g, f, r);
      break;
    default:
      break;
  }
}

function fabricNoiseTop(g: Ctx, path: Path2D, r: Rand, dark: string) {
  g.save();
  g.clip(path);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = r() < 0.5 ? rgba(dark, range(r, 0.06, 0.16)) : rgba('#ffffff', range(r, 0.02, 0.05));
    g.fillRect(range(r, 0, W), range(r, 0, H), range(r, 0.6, 1.8), range(r, 0.6, 1.8));
  }
  g.restore();
}

function furFill(g: Ctx, path: Path2D, r: Rand, color: string, n: number) {
  const bb = { x0: 0, y0: 0, x1: W, y1: H };
  g.fillStyle = shade(color, -0.3);
  g.fill(path);
  g.save();
  g.clip(path);
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = range(r, bb.x0, bb.x1);
    const y = range(r, bb.y0, bb.y1);
    const a = Math.PI / 2 + range(r, -0.9, 0.9);
    const l = range(r, 2.5, 6);
    const t = r();
    g.strokeStyle = t < 0.3 ? rgba(shade(color, 0.45), 0.7) : t < 0.7 ? rgba(color, 0.8) : rgba(shade(color, -0.5), 0.8);
    g.lineWidth = range(r, 0.8, 1.6);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.restore();
  rimLight(g, path, '#ffe2b0', -2.5, 1, 1.2, 0.3);
}

function gasmask(g: Ctx, f: Face, r: Rand) {
  const { cx, topY, w, eyeY, chinY } = f;
  const mask = new Path2D();
  mask.moveTo(cx - w - 3, eyeY - 18);
  mask.bezierCurveTo(cx - w - 6, topY - 12, cx + w + 6, topY - 12, cx + w + 3, eyeY - 18);
  mask.bezierCurveTo(cx + w + 6, eyeY + 20, cx + 24, chinY + 6, cx, chinY + 8);
  mask.bezierCurveTo(cx - 24, chinY + 6, cx - w - 6, eyeY + 20, cx - w - 3, eyeY - 18);
  mask.closePath();
  const mg = g.createRadialGradient(cx - 12, eyeY - 10, 4, cx, eyeY + 10, 60);
  mg.addColorStop(0, '#5a6055');
  mg.addColorStop(0.6, '#33382f');
  mg.addColorStop(1, '#161914');
  g.fillStyle = mg;
  g.fill(mask);
  g.save();
  g.clip(mask);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = rgba(r() < 0.5 ? '#000000' : '#b7c0a8', range(r, 0.04, 0.12));
    g.fillRect(range(r, cx - w - 6, cx + w + 6), range(r, topY - 12, chinY + 8), 1, 1);
  }
  g.restore();
  // Correas
  g.strokeStyle = '#1b1c18';
  g.lineWidth = 4;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sx * (w + 1), eyeY - 6);
    g.lineTo(cx + sx * (w + 12), eyeY - 14);
    g.stroke();
  }
  // Lentes
  for (const sx of [-1, 1]) {
    const x = cx + sx * 15;
    const y = eyeY - 2;
    g.fillStyle = '#16140f';
    g.beginPath();
    g.arc(x, y, 11, 0, Math.PI * 2);
    g.fill();
    const lg = g.createRadialGradient(x - 3, y - 4, 1, x, y, 9);
    lg.addColorStop(0, '#d9ecef');
    lg.addColorStop(0.3, '#6f8a88');
    lg.addColorStop(1, '#1e2926');
    g.fillStyle = lg;
    g.beginPath();
    g.arc(x, y, 8.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#8b8f86';
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(x, y, 9.5, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.ellipse(x - 3.5, y - 3.5, 2.2, 1.2, -0.6, 0, Math.PI * 2);
    g.fill();
  }
  // Filtro
  const fx = cx + 2;
  const fy = chinY - 4;
  const fg = g.createLinearGradient(fx - 11, 0, fx + 11, 0);
  fg.addColorStop(0, '#6b6f63');
  fg.addColorStop(0.4, '#3a3d35');
  fg.addColorStop(1, '#141612');
  g.fillStyle = fg;
  g.beginPath();
  g.ellipse(fx, fy, 11, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#0d0e0b';
  g.lineWidth = 1.2;
  for (let k = -2; k <= 2; k++) {
    g.beginPath();
    g.moveTo(fx - 8, fy + k * 3.5);
    g.lineTo(fx + 8, fy + k * 3.5);
    g.stroke();
  }
  rimLight(g, mask, '#ffe2b0', -3, 1, 1.4, 0.4);
}

function finish(g: Ctx, p: PortraitParams) {
  // Sombra general en el lado derecho y luz cálida de lámpara a la izquierda
  g.save();
  g.globalCompositeOperation = 'multiply';
  const side = g.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, 'rgba(255,255,255,1)');
  side.addColorStop(0.55, 'rgba(235,225,215,1)');
  side.addColorStop(1, 'rgba(90,70,80,1)');
  g.fillStyle = side;
  g.fillRect(0, 0, W, H);
  g.restore();
  g.save();
  g.globalCompositeOperation = 'soft-light';
  const warm = g.createRadialGradient(60, 70, 10, 60, 70, 170);
  warm.addColorStop(0, 'rgba(255,190,110,0.8)');
  warm.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = warm;
  g.fillRect(0, 0, W, H);
  const [ar, ag, ab] = hexToRgb(p.accent);
  const cool = g.createLinearGradient(W, 0, W * 0.5, 0);
  cool.addColorStop(0, `rgba(${ar},${ag},${ab},0.55)`);
  cool.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
  g.fillStyle = cool;
  g.fillRect(0, 0, W, H);
  g.restore();
  vignette(g, W, H, 0.55);
}

export function paintPortrait(p: PortraitParams, scale = 2): HTMLCanvasElement {
  const seed = JSON.stringify(p);
  const r = rng(seed);
  const c = makeCanvas(W * scale, H * scale);
  const g = ctx2d(c);
  g.scale(scale, scale);
  const f = makeFace(p, r);
  background(g, p, r);
  hairBack(g, f, p, r);
  body(g, f, p, r);
  g.save();
  g.translate(100, 187);
  g.scale(1.16, 1.16);
  g.translate(-100, -176);
  neck(g, f);
  const hideEars = p.hat === 'ushanka' || p.hat === 'hood' || p.hat === 'gasmask' || (p.hair === 'long' && p.hat !== 'cap');
  if (!hideEars) ears(g, f);
  const head = headPath(f);
  skin(g, f, head, r);
  if (p.hat !== 'gasmask') {
    eyes(g, f, p, r);
    noseAndMouth(g, f, p);
    facialHair(g, f, p, r, head);
    scarsAndPatch(g, f, p);
  }
  rimLight(g, head, '#ffd9a8', -3, 1, 1.5, 0.55);
  hairFront(g, f, p, r, head);
  hats(g, f, p, r);
  glasses(g, f, p);
  g.restore();
  finish(g, p);
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.06, 7);
  return c;
}

export function portraitURL(p: PortraitParams): string {
  return spriteURLOnce(`portrait-${JSON.stringify(p)}`, () => paintPortrait(p, 2), 'image/jpeg', 0.92);
}
