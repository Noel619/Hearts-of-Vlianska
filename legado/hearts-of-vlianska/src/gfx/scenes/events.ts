// Ilustraciones de eventos: escenas pintadas por código a partir del tipo de
// evento y de las facciones implicadas.
import { FACTIONS } from '../../data';
import type { FactionId } from '../../game/types';
import { ctx2d, grain, makeCanvas, spriteURLOnce } from '../canvas';
import { mix, rgba, shade } from '../color';
import { pick, range, rng } from '../rng';
import { crate, figure, fire, flag, glowAt, grade, hangingLamp, lightCone, platformHall, rubble, sandbags, smoke, snowfall, surface, tunnel, type FigureOpts, type Stage } from './kit';

export const SCENE_W = 640;
export const SCENE_H = 240;

interface SceneCtx {
  a: string; // color de la facción que origina el evento
  b: string; // color del jugador
  aId: FactionId | null;
  bId: FactionId | null;
}

type Painter = (s: Stage, c: SceneCtx) => void;

const heads: FigureOpts['head'][] = ['helmet', 'gasmask', 'hood', 'ushanka', 'cap', 'bare'];

function headFor(f: FactionId | null): FigureOpts['head'] {
  switch (f) {
    case 'UNI':
    case 'CHE':
      return 'helmet';
    case 'SDR':
      return 'ushanka';
    case 'LEV':
      return 'cap';
    case 'VHL':
      return 'gasmask';
    case 'CAL':
      return 'kerchief';
    case 'NOR':
      return 'hood';
    default:
      return 'bare';
  }
}

// ---------------------------------------------------------------------------
// Escenas
// ---------------------------------------------------------------------------

const conference: Painter = (s, c) => {
  const { g, w, h } = s;
  platformHall(s, { vx: w / 2, vy: h * 0.44, lampsLit: 0.5 });
  flag(g, w * 0.3, h * 0.12, 70, 42, c.a);
  flag(g, w * 0.62, h * 0.12, 70, 42, c.b, 1.3);
  // Mesa
  g.fillStyle = '#1c140d';
  g.beginPath();
  g.moveTo(w * 0.28, h * 0.72);
  g.lineTo(w * 0.72, h * 0.72);
  g.lineTo(w * 0.66, h * 0.62);
  g.lineTo(w * 0.34, h * 0.62);
  g.closePath();
  g.fill();
  g.fillStyle = '#2e2216';
  g.fillRect(w * 0.28, h * 0.72, w * 0.44, 6);
  // Papeles y mapa sobre la mesa
  g.fillStyle = 'rgba(220,205,170,0.85)';
  g.save();
  g.translate(w * 0.5, h * 0.665);
  g.rotate(-0.05);
  g.fillRect(-34, -8, 68, 16);
  g.restore();
  const light = { x: w / 2, y: h * 0.2, color: '#ffc27a' };
  hangingLamp(g, w / 2, h * 0.2, 9, '#ffc27a');
  lightCone(g, w / 2, h * 0.2, Math.PI / 2, 0.6, h * 0.9, '#ffc27a', 0.2);
  figure(s, w * 0.22, h * 0.97, h * 0.6, { pose: 'point', facing: 1, head: headFor(c.aId), armband: c.a, coat: true }, light);
  figure(s, w * 0.33, h * 0.95, h * 0.55, { pose: 'stand', facing: 1, head: 'bare', armband: c.a }, light);
  figure(s, w * 0.68, h * 0.95, h * 0.56, { pose: 'stand', facing: -1, head: 'bare', armband: c.b }, light);
  figure(s, w * 0.8, h * 0.98, h * 0.6, { pose: 'raise', facing: -1, head: headFor(c.bId), armband: c.b, coat: true }, light);
  smoke(s, w * 0.5, h * 0.35, 18, 10, '#c9b89a', 0.06);
};

const letter: Painter = (s, c) => {
  const { g, w, h, r } = s;
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#15130f');
  wall.addColorStop(1, '#221c14');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);
  // Mapa clavado en la pared
  g.save();
  g.translate(w * 0.72, h * 0.28);
  g.rotate(0.04);
  g.fillStyle = '#6d6048';
  g.fillRect(-90, -45, 180, 90);
  g.strokeStyle = 'rgba(40,30,20,0.6)';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(range(r, -80, 80), range(r, -40, 40));
    g.lineTo(range(r, -80, 80), range(r, -40, 40));
    g.stroke();
  }
  g.fillStyle = '#9a2a1a';
  for (let i = 0; i < 4; i++) g.fillRect(range(r, -80, 80), range(r, -38, 38), 4, 4);
  g.restore();
  // Mesa
  const desk = g.createLinearGradient(0, h * 0.55, 0, h);
  desk.addColorStop(0, '#3d2a1a');
  desk.addColorStop(1, '#1a110a');
  g.fillStyle = desk;
  g.fillRect(0, h * 0.55, w, h * 0.45);
  g.strokeStyle = 'rgba(0,0,0,0.3)';
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.moveTo(0, h * 0.6 + i * 12);
    g.bezierCurveTo(w * 0.3, h * 0.6 + i * 12 + 4, w * 0.6, h * 0.6 + i * 12 - 4, w, h * 0.6 + i * 12 + 2);
    g.stroke();
  }
  // Carta con lacre del remitente
  g.save();
  g.translate(w * 0.42, h * 0.74);
  g.rotate(-0.08);
  g.fillStyle = '#d9ccb0';
  g.fillRect(-80, -34, 160, 68);
  g.strokeStyle = 'rgba(60,45,30,0.55)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(-66, -22 + i * 9);
    g.lineTo(range(r, 20, 66), -22 + i * 9);
    g.stroke();
  }
  const seal = g.createRadialGradient(46, 18, 2, 50, 20, 14);
  seal.addColorStop(0, shade(c.a, 0.3));
  seal.addColorStop(1, shade(c.a, -0.5));
  g.fillStyle = seal;
  g.beginPath();
  g.arc(50, 20, 12, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Vela
  const cx = w * 0.18;
  const cy = h * 0.66;
  g.fillStyle = '#cfc2a0';
  g.fillRect(cx - 6, cy - 40, 12, 40);
  fire(g, cx, cy - 40, 7, 1.2, 3);
  glowAt(g, cx, cy - 46, 240, '#ffb45e', 0.35);
  // Radio a la derecha
  g.fillStyle = '#1d1c19';
  g.fillRect(w * 0.78, h * 0.5, 110, 58);
  glowAt(g, w * 0.78 + 30, h * 0.5 + 22, 30, '#9fe07a', 0.5);
  g.fillStyle = '#b8e89a';
  g.fillRect(w * 0.78 + 18, h * 0.5 + 16, 28, 10);
  g.fillStyle = '#3a3833';
  for (const k of [0, 1]) {
    g.beginPath();
    g.arc(w * 0.78 + 70 + k * 22, h * 0.5 + 30, 8, 0, Math.PI * 2);
    g.fill();
  }
};

const crowd: Painter = (s, c) => {
  const { g, w, h, r } = s;
  platformHall(s, { vx: w * 0.5, vy: h * 0.42 });
  for (let i = 0; i < 4; i++) flag(g, w * (0.12 + i * 0.22), h * 0.1, 44, 70, i % 2 ? c.b : c.a, i);
  const light = { x: w * 0.5, y: h * 0.25, color: '#ffc27a' };
  // Orador sobre una caja
  crate(g, w * 0.47, h * 0.66, 26);
  figure(s, w * 0.5, h * 0.56, h * 0.42, { pose: 'raise', facing: 1, head: 'cap', armband: c.a, coat: true }, light);
  // Multitud en varias filas
  for (let row = 0; row < 3; row++) {
    const n = 7 + row * 2;
    for (let i = 0; i < n; i++) {
      const x = range(s.r, 0, w);
      if (Math.abs(x - w * 0.5) < 40 && row < 2) continue;
      const y = h * (0.8 + row * 0.08);
      const H = h * (0.36 + row * 0.12);
      figure(s, x, y, H, { pose: pick(r, ['stand', 'raise', 'stand', 'point']), facing: x < w / 2 ? 1 : -1, head: pick(r, heads), coat: r() < 0.5 }, light);
    }
  }
};

const parade: Painter = (s, c) => {
  const { g, w, h } = s;
  platformHall(s, { vx: w * 0.5, vy: h * 0.42, warm: '#ffc27a' });
  for (let i = 0; i < 3; i++) flag(g, w * (0.2 + i * 0.26), h * 0.08, 60, 80, c.b, i * 0.7);
  const light = { x: w * 0.5, y: h * 0.2, color: '#ffd89a' };
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 8 + row; i++) {
      const x = w * 0.08 + i * (w * 0.84) / (7 + row);
      figure(s, x, h * (0.74 + row * 0.1), h * (0.3 + row * 0.1), { pose: 'rifle', facing: 1, head: headFor(c.bId) ?? 'helmet', armband: c.b }, light);
    }
  }
};

const battle: Painter = (s, c) => {
  const { g, w, h, r } = s;
  tunnel(s, { vx: w * 0.55, vy: h * 0.42, far: '#ff7a3a', farGlow: 0.6 });
  // Fogonazos lejanos del enemigo
  for (let i = 0; i < 6; i++) {
    const x = w * 0.55 + range(r, -40, 40);
    const y = h * 0.44 + range(r, -10, 16);
    glowAt(g, x, y, 14, '#ffd27a', 0.9);
  }
  // Trazadoras
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const x1 = range(r, w * 0.1, w * 0.9);
    const y1 = range(r, h * 0.5, h * 0.8);
    const x2 = w * 0.55 + (x1 - w * 0.55) * 0.3;
    const y2 = h * 0.44 + (y1 - h * 0.44) * 0.3;
    const t = range(r, 0.2, 0.8);
    g.strokeStyle = rgba(i % 2 ? '#ffdc8a' : '#ff8a5a', 0.8);
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    g.lineTo(x1 + (x2 - x1) * (t + 0.12), y1 + (y2 - y1) * (t + 0.12));
    g.stroke();
  }
  smoke(s, w * 0.4, h * 0.7, 26, 14, '#9a8e80', 0.14);
  const light = { x: w * 0.55, y: h * 0.4, color: '#ffae6a' };
  sandbags(g, w * 0.05, h * 0.98, w * 0.9, 3, 14);
  figure(s, w * 0.22, h * 0.9, h * 0.5, { pose: 'aim', facing: 1, head: headFor(c.bId) ?? 'helmet', armband: c.b }, light);
  figure(s, w * 0.72, h * 0.92, h * 0.52, { pose: 'aim', facing: -1, head: 'gasmask', armband: c.b }, light);
  figure(s, w * 0.46, h * 1.0, h * 0.62, { pose: 'point', facing: 1, head: 'helmet', armband: c.b, coat: true }, light);
  // Fogonazos propios
  glowAt(g, w * 0.22 + h * 0.25, h * 0.9 - h * 0.34, 22, '#ffe0a0', 0.9);
  glowAt(g, w * 0.72 - h * 0.26, h * 0.92 - h * 0.35, 20, '#ffe0a0', 0.8);
};

const siren: Painter = (s, c) => {
  battle(s, c);
  const { g, w, h } = s;
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = 'rgba(255,40,20,0.55)';
  g.fillRect(0, 0, w, h);
  g.restore();
  glowAt(g, w * 0.12, h * 0.12, 120, '#ff3020', 0.8);
  lightCone(g, w * 0.12, h * 0.12, 0.35, 0.3, w * 0.8, '#ff4030', 0.35);
};

const defense: Painter = (s, c) => {
  const { g, w, h } = s;
  tunnel(s, { vx: w * 0.5, vy: h * 0.42, far: '#6a7a8a', farGlow: 0.4 });
  const light = { x: w * 0.2, y: h * 0.2, color: '#ffc27a' };
  hangingLamp(g, w * 0.2, h * 0.2, 8);
  sandbags(g, w * 0.08, h * 0.96, w * 0.84, 4, 13);
  figure(s, w * 0.3, h * 0.96 - 50, h * 0.42, { pose: 'rifle', facing: 1, head: headFor(c.bId), armband: c.b }, light);
  figure(s, w * 0.62, h * 0.96 - 50, h * 0.44, { pose: 'rifle', facing: -1, head: 'helmet', armband: c.b }, light);
};

const dig: Painter = (s, c) => {
  const { g, w, h } = s;
  const geo = tunnel(s, { vx: w * 0.5, vy: h * 0.45, far: '#3a3530', farGlow: 0.1, lamps: false });
  rubble(s, w * 0.2, geo.floorY(0.25), w * 0.6, h * 0.4, 110);
  smoke(s, w * 0.5, h * 0.55, 30, 14, '#8a8070', 0.12);
  const light = { x: w * 0.5, y: h * 0.3, color: '#ffd08a' };
  figure(s, w * 0.3, h * 0.96, h * 0.55, { pose: 'dig', facing: 1, head: 'helmet', lantern: false, armband: c.b }, light);
  figure(s, w * 0.66, h * 0.98, h * 0.58, { pose: 'dig', facing: -1, head: 'cap' }, light);
  figure(s, w * 0.84, h * 1.0, h * 0.62, { pose: 'stand', facing: -1, head: 'helmet', lantern: true }, light);
  lightCone(g, w * 0.3 + 20, h * 0.5, -0.6, 0.35, 200, '#fff0c0', 0.25);
};

const blaze: Painter = (s) => {
  const { g, w, h, r } = s;
  platformHall(s, { vx: w * 0.5, vy: h * 0.42, warm: '#ff7a2a', lampsLit: 0.2 });
  smoke(s, w * 0.5, h * 0.55, 50, 24, '#3a3028', 0.35);
  fire(g, w * 0.5, h * 0.8, 46, 0.6, 2);
  fire(g, w * 0.3, h * 0.78, 22, 1.4, 5);
  fire(g, w * 0.72, h * 0.8, 26, 2.2, 7);
  const light = { x: w * 0.5, y: h * 0.62, color: '#ff9a4a', strength: 1 };
  for (let i = 0; i < 5; i++) {
    const x = range(r, w * 0.05, w * 0.95);
    if (Math.abs(x - w * 0.5) < 60) continue;
    figure(s, x, h * 0.98, h * range(r, 0.45, 0.6), { pose: pick(r, ['walk', 'carry', 'raise']), facing: x < w / 2 ? 1 : -1, head: pick(r, heads), phase: r() * 6 }, light);
  }
  for (let i = 0; i < 60; i++) {
    g.fillStyle = rgba('#ffc060', range(r, 0.3, 0.9));
    g.fillRect(range(r, w * 0.3, w * 0.7), range(r, h * 0.2, h * 0.8), 1.6, 1.6);
  }
};

const market: Painter = (s, c) => {
  const { g, w, h, r } = s;
  platformHall(s, { vx: w * 0.5, vy: h * 0.42 });
  // Puestos con toldos a ambos lados
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const k = 1 / (1 + i * 0.9);
      const x = w * 0.5 + side * w * (0.38 * k);
      const y = h * 0.42 + (h * 0.58) * k * 0.9;
      const sw = 90 * k;
      const col = pick(r, ['#8a3b2a', '#c79a3a', '#3b6a5a', '#6a4a7a', mix(c.a, '#6a5a3a', 0.4)]);
      g.fillStyle = shade(col, -0.35);
      g.fillRect(x - sw / 2, y - 60 * k, sw, 60 * k);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x - sw * 0.6, y - 58 * k);
      g.lineTo(x + sw * 0.6, y - 58 * k);
      g.lineTo(x + sw * 0.5, y - 80 * k);
      g.lineTo(x - sw * 0.5, y - 80 * k);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      for (let st = 0; st < 5; st++) g.fillRect(x - sw * 0.5 + st * sw * 0.22, y - 80 * k, sw * 0.08, 22 * k);
      hangingLamp(g, x, y - 52 * k, 5 * k);
      crate(g, x - sw * 0.35, y, 18 * k);
    }
  }
  const light = { x: w * 0.5, y: h * 0.3, color: '#ffc27a' };
  for (let i = 0; i < 6; i++) {
    const x = range(r, w * 0.25, w * 0.75);
    figure(s, x, h * range(r, 0.86, 1), h * range(r, 0.42, 0.56), { pose: pick(r, ['carry', 'walk', 'stand', 'point']), facing: r() < 0.5 ? 1 : -1, head: pick(r, heads), coat: r() < 0.6, phase: r() * 6 }, light);
  }
};

const caravan: Painter = (s, c) => {
  const { g, w, h } = s;
  const geo = tunnel(s, { vx: w * 0.62, vy: h * 0.44, far: '#ffb45e', farGlow: 0.5 });
  // Dresina de carga sobre la vía
  const y = geo.floorY(0.05);
  g.fillStyle = '#2a241c';
  g.fillRect(w * 0.18, y - 60, 230, 40);
  g.fillStyle = '#141210';
  for (const k of [0, 1, 2]) {
    g.beginPath();
    g.arc(w * 0.18 + 30 + k * 85, y - 16, 14, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 5; i++) crate(g, w * 0.2 + i * 40, y - 60, 30);
  const light = { x: w * 0.62, y: h * 0.4, color: '#ffc27a' };
  figure(s, w * 0.7, y + 4, h * 0.5, { pose: 'walk', facing: 1, head: 'hood', lantern: true, armband: c.a }, light);
  figure(s, w * 0.12, y + 6, h * 0.55, { pose: 'rifle', facing: 1, head: headFor(c.aId), armband: c.a }, light);
};

const flood: Painter = (s) => {
  const { g, w, h } = s;
  tunnel(s, { vx: w * 0.5, vy: h * 0.45, far: '#7ab0c8', farGlow: 0.35, flooded: true });
  const light = { x: w * 0.5, y: h * 0.35, color: '#b0d8ea' };
  figure(s, w * 0.36, h * 0.95, h * 0.55, { pose: 'carry', facing: 1, head: 'helmet' }, light);
  figure(s, w * 0.6, h * 0.92, h * 0.5, { pose: 'walk', facing: -1, head: 'gasmask', lantern: true }, light);
  // Agua hasta las rodillas
  const water = g.createLinearGradient(0, h * 0.82, 0, h);
  water.addColorStop(0, 'rgba(30,70,90,0.85)');
  water.addColorStop(1, 'rgba(10,25,35,0.95)');
  g.fillStyle = water;
  g.fillRect(0, h * 0.84, w, h * 0.16);
  g.strokeStyle = 'rgba(170,215,235,0.35)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 30; i++) {
    const x = (i * 37) % w;
    g.beginPath();
    g.moveTo(x, h * 0.86 + (i % 5) * 6);
    g.lineTo(x + 20, h * 0.86 + (i % 5) * 6);
    g.stroke();
  }
};

const kitchen: Painter = (s) => {
  const { g, w, h, r } = s;
  platformHall(s, { vx: w * 0.5, vy: h * 0.42, lampsLit: 0.6 });
  // Olla sobre el fuego
  fire(g, w * 0.5, h * 0.9, 24, 0.5, 1);
  g.fillStyle = '#26221e';
  g.beginPath();
  g.moveTo(w * 0.5 - 50, h * 0.72);
  g.lineTo(w * 0.5 + 50, h * 0.72);
  g.lineTo(w * 0.5 + 40, h * 0.86);
  g.lineTo(w * 0.5 - 40, h * 0.86);
  g.closePath();
  g.fill();
  g.fillStyle = '#5a4a36';
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.72, 50, 8, 0, 0, Math.PI * 2);
  g.fill();
  smoke(s, w * 0.5, h * 0.7, 20, 16, '#d8d0c0', 0.12);
  const light = { x: w * 0.5, y: h * 0.8, color: '#ff9a4a' };
  for (let i = 0; i < 7; i++) {
    const x = w * 0.62 + i * 34;
    figure(s, x, h * (0.92 - i * 0.015), h * (0.5 - i * 0.02), { pose: 'carry', facing: -1, head: pick(r, heads), coat: true, bulk: 0.9 }, light);
  }
  figure(s, w * 0.36, h * 0.95, h * 0.52, { pose: 'point', facing: 1, head: 'kerchief' }, light);
};

const snowScene: Painter = (s) => {
  const { g, w, h } = s;
  surface(s, { horizon: h * 0.5 });
  const light = { x: w * 0.1, y: h * 0.2, color: '#c8d8e0', strength: 0.5 };
  figure(s, w * 0.44, h * 0.95, h * 0.44, { pose: 'walk', facing: 1, head: 'gasmask', coat: true, lantern: true, phase: 1 }, light);
  figure(s, w * 0.3, h * 0.92, h * 0.38, { pose: 'walk', facing: 1, head: 'hood', coat: true, phase: 3 }, light);
  snowfall(s, 200);
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = 'rgba(120,160,190,0.4)';
  g.fillRect(0, 0, w, h);
  g.restore();
};

const deathScene: Painter = (s) => {
  const { g, w, h, r } = s;
  const geo = tunnel(s, { vx: w * 0.5, vy: h * 0.44, far: '#6a8a5a', farGlow: 0.3 });
  // Cuerpos y huesos en el suelo
  for (let i = 0; i < 5; i++) {
    const d = range(r, 0.02, 0.3);
    const x = w * 0.5 + range(r, -1, 1) * geo.halfW(d) * 0.7;
    const y = geo.floorY(d) - 4;
    g.fillStyle = '#0c0c0b';
    g.beginPath();
    g.ellipse(x, y, 40 / (1 + d * 6), 9 / (1 + d * 6), range(r, -0.2, 0.2), 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(210,200,180,0.7)';
  g.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const x = range(r, w * 0.2, w * 0.8);
    const y = range(r, h * 0.8, h * 0.98);
    const a = range(r, 0, Math.PI);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 4);
    g.stroke();
  }
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = 'rgba(80,140,70,0.35)';
  g.fillRect(0, 0, w, h);
  g.restore();
};

const plague: Painter = (s) => {
  deathScene(s, { a: '#000', b: '#000', aId: null, bId: null });
  const { g, w, h } = s;
  const light = { x: w * 0.5, y: h * 0.4, color: '#b0e090' };
  figure(s, w * 0.28, h * 0.98, h * 0.6, { pose: 'carry', facing: 1, head: 'gasmask', coat: true }, light);
  figure(s, w * 0.74, h * 1.0, h * 0.62, { pose: 'point', facing: -1, head: 'gasmask', coat: true }, light);
  smoke(s, w * 0.5, h * 0.7, 40, 20, '#9ad07a', 0.12);
  // Señal de peligro biológico
  g.fillStyle = '#d9b43a';
  g.beginPath();
  g.moveTo(w * 0.86, h * 0.14);
  g.lineTo(w * 0.93, h * 0.3);
  g.lineTo(w * 0.79, h * 0.3);
  g.closePath();
  g.fill();
  g.fillStyle = '#141210';
  g.beginPath();
  g.arc(w * 0.86, h * 0.25, 6, 0, Math.PI * 2);
  g.fill();
};

const rats: Painter = (s) => {
  const { g, w, h, r } = s;
  const geo = tunnel(s, { vx: w * 0.5, vy: h * 0.44, far: '#5a4a3a', farGlow: 0.25, lamps: false });
  for (let i = 0; i < 70; i++) {
    const d = Math.pow(range(r, 0, 1), 1.3);
    const x = w * 0.5 + range(r, -1, 1) * geo.halfW(d) * 0.9;
    const y = geo.floorY(d) - range(r, 0, 10) / (1 + d * 3);
    const k = 1 / (1 + d * 5);
    // Cuerpo
    g.fillStyle = '#0d0b0a';
    g.beginPath();
    g.ellipse(x, y, 11 * k, 5 * k, range(r, -0.3, 0.3), 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#0d0b0a';
    g.lineWidth = Math.max(0.6, 1.2 * k);
    g.beginPath();
    g.moveTo(x - 10 * k, y);
    g.quadraticCurveTo(x - 20 * k, y - 4 * k, x - 24 * k, y + 2 * k);
    g.stroke();
    // Ojos rojos
    g.fillStyle = '#ff3a1a';
    g.fillRect(x + 7 * k, y - 2 * k, Math.max(1, 1.8 * k), Math.max(1, 1.8 * k));
    glowAt(g, x + 8 * k, y - 1.5 * k, 6 * k, '#ff3a1a', 0.5);
  }
  const light = { x: w * 0.5, y: h * 0.2, color: '#ffc27a' };
  figure(s, w * 0.8, h * 1.02, h * 0.66, { pose: 'rifle', facing: -1, head: 'helmet', lantern: true }, light);
};

const radio: Painter = (s) => {
  const { g, w, h, r } = s;
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#101311');
  wall.addColorStop(1, '#1b1e1a');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);
  // Equipos de radio apilados
  for (let i = 0; i < 3; i++) {
    const x = w * 0.45 + i * 95;
    const y = h * 0.3 + (i % 2) * 20;
    g.fillStyle = '#23241f';
    g.fillRect(x, y, 88, 70);
    g.strokeStyle = 'rgba(160,160,140,0.25)';
    g.strokeRect(x + 3, y + 3, 82, 64);
    for (let k = 0; k < 3; k++) {
      const gx = x + 18 + k * 26;
      g.fillStyle = '#3a3a33';
      g.beginPath();
      g.arc(gx, y + 46, 8, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#c8f0a0';
    g.fillRect(x + 12, y + 12, 50, 12);
    glowAt(g, x + 37, y + 18, 40, '#9fe07a', 0.6);
    for (let k = 0; k < 4; k++) {
      g.fillStyle = r() < 0.5 ? '#ff5a3a' : '#ffd24a';
      g.fillRect(x + 68, y + 12 + k * 7, 4, 4);
    }
  }
  // Mesa y operador
  g.fillStyle = '#2a1f14';
  g.fillRect(0, h * 0.72, w, h * 0.28);
  const light = { x: w * 0.55, y: h * 0.4, color: '#b0f08a' };
  figure(s, w * 0.3, h * 0.98, h * 0.6, { pose: 'sit', facing: 1, head: 'cap', coat: true }, light);
  // Cascos
  g.strokeStyle = '#141412';
  g.lineWidth = 3;
  g.beginPath();
  g.arc(w * 0.3 + 2, h * 0.98 - h * 0.6 * 0.71, 12, Math.PI, 0);
  g.stroke();
};

const blackout: Painter = (s) => {
  const { g, w, h, r } = s;
  tunnel(s, { vx: w * 0.5, vy: h * 0.44, far: '#1a1a1a', farGlow: 0.05, lamps: false });
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(0, 0, w, h);
  // Cable que chispea
  g.strokeStyle = '#0a0a0a';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(w * 0.1, h * 0.1);
  g.bezierCurveTo(w * 0.3, h * 0.5, w * 0.4, h * 0.3, w * 0.48, h * 0.62);
  g.stroke();
  glowAt(g, w * 0.48, h * 0.62, 90, '#9ad0ff', 0.9);
  for (let i = 0; i < 40; i++) {
    const a = range(r, 0, Math.PI * 2);
    const l = range(r, 5, 50);
    g.strokeStyle = rgba(r() < 0.5 ? '#ffffff' : '#9ad0ff', range(r, 0.4, 1));
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(w * 0.48, h * 0.62);
    g.lineTo(w * 0.48 + Math.cos(a) * l, h * 0.62 + Math.sin(a) * l);
    g.stroke();
  }
  const light = { x: w * 0.48, y: h * 0.62, color: '#b0d8ff' };
  figure(s, w * 0.7, h * 1.0, h * 0.6, { pose: 'point', facing: -1, head: 'helmet' }, light);
};

const ghost: Painter = (s) => {
  const { g, w, h } = s;
  tunnel(s, { vx: w * 0.5, vy: h * 0.44, far: '#9ab8c8', farGlow: 0.4, lamps: false });
  smoke(s, w * 0.5, h * 0.8, 60, 18, '#c8dde8', 0.12);
  // Figura translúcida al fondo
  g.save();
  g.globalAlpha = 0.45;
  figure(s, w * 0.52, h * 0.66, h * 0.3, { pose: 'stand', facing: -1, head: 'bare', color: '#cfe4ee' }, { x: w * 0.5, y: h * 0.4, color: '#ffffff' });
  g.restore();
  glowAt(g, w * 0.52, h * 0.52, 60, '#dff2ff', 0.35);
  figure(s, w * 0.18, h * 1.0, h * 0.62, { pose: 'rifle', facing: 1, head: 'gasmask', lantern: true }, { x: w * 0.5, y: h * 0.45, color: '#b8d8e8' });
};

const eyes: Painter = (s) => {
  const { g, w, h, r } = s;
  tunnel(s, { vx: w * 0.5, vy: h * 0.44, far: '#101010', farGlow: 0.05, lamps: false });
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9; i++) {
    const x = range(r, w * 0.2, w * 0.8);
    const y = range(r, h * 0.3, h * 0.7);
    const sz = range(r, 2, 5);
    for (const dx of [-sz * 2.2, sz * 2.2]) {
      glowAt(g, x + dx, y, sz * 5, '#ffd24a', 0.7);
      g.fillStyle = '#fff2a0';
      g.beginPath();
      g.ellipse(x + dx, y, sz, sz * 0.6, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
};

const campfire: Painter = (s, c) => {
  const { g, w, h, r } = s;
  platformHall(s, { vx: w * 0.5, vy: h * 0.4, lampsLit: 0.35 });
  // Guirnaldas de bombillas
  for (let k = 0; k < 2; k++) {
    g.strokeStyle = 'rgba(20,18,15,0.9)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(0, h * (0.12 + k * 0.08));
    g.quadraticCurveTo(w / 2, h * (0.32 + k * 0.08), w, h * (0.12 + k * 0.08));
    g.stroke();
    for (let i = 1; i < 16; i++) {
      const t = i / 16;
      const x = w * t;
      const y = h * (0.12 + k * 0.08) + Math.sin(t * Math.PI) * h * 0.2;
      glowAt(g, x, y, 12, pick(r, ['#ffd27a', '#ff9a6a', '#fff0c0']), 0.6);
    }
  }
  const fx = w * 0.5;
  const fy = h * 0.9;
  smoke(s, fx, fy - 30, 18, 14, '#b8a890', 0.1);
  fire(g, fx, fy, 30, 0.8, 4);
  const light = { x: fx, y: fy - 20, color: '#ff9a4a', strength: 1 };
  figure(s, w * 0.3, h * 0.98, h * 0.58, { pose: 'guitar', facing: 1, head: 'bare', coat: true, phase: 1.2 }, light);
  figure(s, w * 0.7, h * 0.98, h * 0.55, { pose: 'sit', facing: -1, head: 'ushanka', coat: true }, light);
  figure(s, w * 0.82, h * 1.0, h * 0.6, { pose: 'sit', facing: -1, head: 'kerchief', female: true }, light);
  figure(s, w * 0.16, h * 1.0, h * 0.62, { pose: 'stand', facing: 1, head: 'helmet', armband: c.b }, light);
};

const wedding: Painter = (s, c) => {
  campfire(s, c);
  const { g, w, h } = s;
  const light = { x: w * 0.5, y: h * 0.7, color: '#ffb46a', strength: 1 };
  figure(s, w * 0.46, h * 0.8, h * 0.4, { pose: 'stand', facing: 1, head: 'bare', coat: true }, light);
  figure(s, w * 0.54, h * 0.8, h * 0.37, { pose: 'stand', facing: -1, head: 'kerchief', female: true }, light);
  glowAt(g, w * 0.5, h * 0.5, 50, '#ffd8a0', 0.4);
};

const spy: Painter = (s) => {
  const { g, w, h } = s;
  tunnel(s, { vx: w * 0.3, vy: h * 0.45, far: '#304050', farGlow: 0.25, lamps: false, rails: false });
  hangingLamp(g, w * 0.62, h * 0.16, 9, '#ffe0a0');
  lightCone(g, w * 0.62, h * 0.16, Math.PI / 2, 0.4, h * 1.1, '#ffe0a0', 0.35);
  const light = { x: w * 0.62, y: h * 0.16, color: '#ffe0a0', strength: 1 };
  figure(s, w * 0.62, h * 0.97, h * 0.62, { pose: 'stand', facing: -1, head: 'hood', coat: true }, light);
  // Sombra larga
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath();
  g.moveTo(w * 0.6, h * 0.97);
  g.lineTo(w * 0.2, h * 1.0);
  g.lineTo(w * 0.62, h * 1.0);
  g.closePath();
  g.fill();
};

const archive: Painter = (s) => {
  const { g, w, h, r } = s;
  g.fillStyle = '#14110d';
  g.fillRect(0, 0, w, h);
  // Estanterías
  for (let shelf = 0; shelf < 4; shelf++) {
    const y = h * 0.15 + shelf * h * 0.2;
    g.fillStyle = '#2a1f14';
    g.fillRect(0, y + h * 0.16, w, 6);
    let x = 4;
    while (x < w) {
      const bw = range(r, 6, 14);
      const bh = range(r, h * 0.1, h * 0.16);
      g.fillStyle = pick(r, ['#5a2a22', '#2a3a4a', '#4a3a22', '#3a4a2a', '#6a5a3a', '#3a2a3a']);
      g.fillRect(x, y + h * 0.16 - bh, bw, bh);
      g.fillStyle = 'rgba(255,230,180,0.15)';
      g.fillRect(x + 1, y + h * 0.16 - bh + 4, bw - 2, 2);
      x += bw + range(r, 0, 2);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#2a1f14';
  g.fillRect(0, h * 0.78, w, h * 0.22);
  const lx = w * 0.62;
  const ly = h * 0.62;
  glowAt(g, lx, ly, 240, '#ffc27a', 0.6);
  lightCone(g, lx, ly - 10, Math.PI / 2, 0.8, 160, '#ffd89a', 0.35);
  g.fillStyle = '#d9ccb0';
  g.fillRect(w * 0.45, h * 0.78, 90, 10);
  figure(s, w * 0.4, h * 0.99, h * 0.62, { pose: 'sit', facing: 1, head: 'bare', coat: true }, { x: lx, y: ly, color: '#ffc27a', strength: 1 });
};

const gate: Painter = (s, c) => {
  const { g, w, h } = s;
  tunnel(s, { vx: w * 0.5, vy: h * 0.45, far: '#2a2a2a', farGlow: 0.1, lamps: false });
  // Compuerta hermética
  const cx = w * 0.5;
  const cy = h * 0.5;
  const R = h * 0.42;
  const dg = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
  dg.addColorStop(0, '#5a5a52');
  dg.addColorStop(1, '#1e1e1a');
  g.fillStyle = dg;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#0d0d0b';
  g.lineWidth = 6;
  g.stroke();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    g.fillStyle = '#8a8676';
    g.beginPath();
    g.arc(cx + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9, 3, 0, Math.PI * 2);
    g.fill();
  }
  // Volante
  g.strokeStyle = '#2a2622';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(cx, cy, R * 0.28, 0, Math.PI * 2);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.3;
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * R * 0.28, cy + Math.sin(a) * R * 0.28);
  }
  g.stroke();
  // Cadenas y pintura de la facción
  g.strokeStyle = '#6a655a';
  g.lineWidth = 4;
  for (let i = 0; i < 16; i++) {
    const t = i / 15;
    g.beginPath();
    g.ellipse(cx - R + t * R * 2, cy + Math.sin(t * Math.PI) * 20, 7, 4, 0.5, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = rgba(c.a, 0.7);
  g.fillRect(cx - R * 0.8, cy - R * 0.6, R * 1.6, 12);
  hangingLamp(g, w * 0.14, h * 0.2, 7, '#ff5a3a');
  const light = { x: w * 0.14, y: h * 0.2, color: '#ff8a5a' };
  figure(s, w * 0.84, h * 1.0, h * 0.62, { pose: 'rifle', facing: -1, head: headFor(c.bId), armband: c.b }, light);
};

const PAINTERS: Record<string, Painter> = {
  Handshake: conference,
  Mail: letter,
  Users: crowd,
  Merge: crowd,
  Flag: crowd,
  Medal: parade,
  Swords: battle,
  Shield: defense,
  Siren: siren,
  Pickaxe: dig,
  Flame: blaze,
  Banknote: market,
  Coins: market,
  HandCoins: market,
  TrendingDown: market,
  Package: caravan,
  Waves: flood,
  Soup: kitchen,
  Snowflake: snowScene,
  Skull: deathScene,
  Biohazard: plague,
  Rat: rats,
  Radio: radio,
  PlugZap: blackout,
  Ghost: ghost,
  Eye: eyes,
  Heart: wedding,
  HandMetal: campfire,
  Fingerprint: spy,
  BookOpen: archive,
  Ban: gate,
};

const TINTS: Record<string, string> = {
  Snowflake: '#8ab0c8',
  Skull: '#6a8a5a',
  Biohazard: '#7ab05a',
  Ghost: '#9ab8d8',
  PlugZap: '#6a9ad8',
  Waves: '#5a8ab0',
};

export function paintEventScene(picture: string, from: FactionId | null, player: FactionId | null, scale = 1.5): HTMLCanvasElement {
  const w = SCENE_W;
  const h = SCENE_H;
  const c = makeCanvas(w * scale, h * scale);
  const g = ctx2d(c);
  g.scale(scale, scale);
  const r = rng(`scene-${picture}-${from ?? ''}-${player ?? ''}`);
  const stage: Stage = { g, w, h, r };
  const ctx: SceneCtx = {
    a: from ? FACTIONS[from].color : '#8a7a5a',
    b: player ? FACTIONS[player].color : '#b3955c',
    aId: from,
    bId: player,
  };
  (PAINTERS[picture] ?? defense)(stage, ctx);
  grade(stage, TINTS[picture] ?? '#e9a53c', 0.12);
  g.setTransform(1, 0, 0, 1, 0, 0);
  grain(g, c.width, c.height, 0.07, 3);
  return c;
}

export function eventSceneURL(picture: string, from: FactionId | null, player: FactionId | null): string {
  return spriteURLOnce(`scene-${picture}-${from ?? ''}-${player ?? ''}`, () => paintEventScene(picture, from, player), 'image/jpeg', 0.88);
}
