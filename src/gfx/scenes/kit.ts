// Kit de pintura de escenas: fondos en perspectiva (túnel, andén, superficie),
// siluetas humanas a contraluz, fuego, humo, faroles, banderas y utilería.
// Lo usan las ilustraciones de eventos y la escena animada del menú.
import { blurCanvas, ctx2d, makeCanvas, type Ctx } from '../canvas';
import { mix, rgba, shade } from '../color';
import { fbm } from '../noise';
import { range, type Rand } from '../rng';

export interface Stage {
  g: Ctx;
  w: number;
  h: number;
  r: Rand;
}

// ---------------------------------------------------------------------------
// Luz
// ---------------------------------------------------------------------------

export function glowAt(g: Ctx, x: number, y: number, rad: number, color: string, alpha = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, rad);
  gr.addColorStop(0, rgba(color, alpha));
  gr.addColorStop(0.35, rgba(color, alpha * 0.4));
  gr.addColorStop(1, rgba(color, 0));
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.fillStyle = gr;
  g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  g.restore();
}

/** Cono de luz de una lámpara colgada o una linterna. */
export function lightCone(g: Ctx, x: number, y: number, angle: number, spread: number, len: number, color: string, alpha = 0.25) {
  g.save();
  g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, len);
  gr.addColorStop(0, rgba(color, alpha));
  gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x, y);
  g.arc(x, y, len, angle - spread, angle + spread);
  g.closePath();
  g.fill();
  g.restore();
}

export function hangingLamp(g: Ctx, x: number, y: number, s: number, color = '#ffc978', lit = 1) {
  g.strokeStyle = 'rgba(10,10,10,0.9)';
  g.lineWidth = Math.max(1, s * 0.08);
  g.beginPath();
  g.moveTo(x, y - s * 3);
  g.lineTo(x, y - s * 0.6);
  g.stroke();
  g.fillStyle = '#1a1916';
  g.beginPath();
  g.moveTo(x - s * 0.9, y);
  g.lineTo(x + s * 0.9, y);
  g.lineTo(x + s * 0.4, y - s * 0.7);
  g.lineTo(x - s * 0.4, y - s * 0.7);
  g.closePath();
  g.fill();
  if (lit > 0) {
    g.fillStyle = rgba('#fff4d6', lit);
    g.beginPath();
    g.ellipse(x, y + s * 0.15, s * 0.45, s * 0.25, 0, 0, Math.PI * 2);
    g.fill();
    glowAt(g, x, y + s * 0.2, s * 7, color, 0.55 * lit);
    lightCone(g, x, y, Math.PI / 2, 0.55, s * 14, color, 0.14 * lit);
  }
}

// ---------------------------------------------------------------------------
// Fondos
// ---------------------------------------------------------------------------

export interface TunnelOpts {
  vx: number;
  vy: number;
  far: string;
  farGlow?: number;
  wall?: string;
  rails?: boolean;
  lamps?: boolean;
  flooded?: boolean;
}

/** Túnel circular de tubbing en perspectiva de un punto. */
export function tunnel({ g, w, h, r }: Stage, o: TunnelOpts) {
  const wall = o.wall ?? '#2c2924';
  const Rn = Math.hypot(w / 2, h / 2) * 1.04;
  const k = (d: number) => 1 / (1 + d * 11);
  const cx = (d: number) => o.vx + (w / 2 - o.vx) * k(d);
  const cy = (d: number) => o.vy + (h * 0.42 - o.vy) * k(d);
  const ring = (d: number) => Rn * k(d);
  const floorY = (d: number) => cy(d) + ring(d) * 0.6;
  const halfW = (d: number) => ring(d) * 0.8;
  // Pared: degradado radial desde la luz del fondo
  const base = g.createRadialGradient(o.vx, o.vy, 0, o.vx, o.vy, Math.hypot(w, h) * 0.7);
  base.addColorStop(0, mix(wall, o.far, 0.75));
  base.addColorStop(0.12, mix(wall, o.far, 0.35));
  base.addColorStop(0.45, shade(wall, -0.35));
  base.addColorStop(1, shade(wall, -0.85));
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // Costillas de tubbing, de lejos a cerca
  const N = 30;
  for (let i = N; i >= 1; i--) {
    const d = Math.pow(i / N, 1.35);
    const rr = ring(d);
    const x = cx(d);
    const y = cy(d);
    const light = Math.pow(1 - d, 0.5);
    const near = 1 - d;
    // Junta oscura
    g.strokeStyle = rgba('#000000', 0.35 + near * 0.25);
    g.lineWidth = Math.max(0.6, rr * 0.03);
    g.beginPath();
    g.arc(x, y, rr, Math.PI * 0.82, Math.PI * 2.18);
    g.stroke();
    // Reborde iluminado por la luz del fondo (cara que mira hacia allí)
    g.strokeStyle = rgba(mix('#c8b48a', o.far, 0.5), 0.1 + (1 - light) * 0.05 + 0.12 * (1 - near * 0.7));
    g.lineWidth = Math.max(0.4, rr * 0.012);
    g.beginPath();
    g.arc(x, y, rr * 0.975, Math.PI * 0.85, Math.PI * 2.15);
    g.stroke();
    // Pernos de los segmentos
    if (i % 2 === 0 && d < 0.85) {
      g.fillStyle = rgba('#d8c8a8', 0.12 + near * 0.08);
      for (let b = 0; b < 16; b++) {
        const a = Math.PI * 0.85 + (b / 15) * Math.PI * 1.3;
        const bs = Math.max(0.8, rr * 0.006);
        g.fillRect(x + Math.cos(a) * rr * 0.955 - bs / 2, y + Math.sin(a) * rr * 0.955 - bs / 2, bs, bs);
      }
    }
  }
  // Luz del fondo
  glowAt(g, o.vx, o.vy, Math.min(w, h) * 0.6, o.far, o.farGlow ?? 0.7);
  // Suelo (tapa la parte baja de los anillos)
  const steps = 40;
  g.fillStyle = o.flooded ? '#0c171c' : '#15130f';
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const d = i / steps;
    const x = cx(d) - halfW(d);
    if (i === 0) g.moveTo(x, floorY(d));
    else g.lineTo(x, floorY(d));
  }
  for (let i = steps; i >= 0; i--) {
    const d = i / steps;
    g.lineTo(cx(d) + halfW(d), floorY(d));
  }
  g.closePath();
  g.fill();
  // Luz del fondo reflejada en el suelo
  const fl = g.createLinearGradient(0, floorY(1), 0, h);
  fl.addColorStop(0, rgba(o.far, 0.35));
  fl.addColorStop(0.3, rgba(o.far, 0.08));
  fl.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fl;
  g.fill();
  if (o.rails !== false && !o.flooded) {
    for (let i = 1; i < 70; i++) {
      const d = Math.pow(i / 70, 1.7);
      const y = floorY(d);
      const hw = halfW(d) * 0.45;
      g.strokeStyle = rgba('#3d2e1f', 0.95 * (1 - d * 0.6));
      g.lineWidth = Math.max(0.5, ring(d) * 0.028);
      g.beginPath();
      g.moveTo(cx(d) - hw, y);
      g.lineTo(cx(d) + hw, y);
      g.stroke();
    }
    for (const side of [-1, 1]) {
      g.beginPath();
      for (let i = 0; i <= 40; i++) {
        const d = Math.pow(i / 40, 1.5);
        const x = cx(d) + side * halfW(d) * 0.3;
        const y = floorY(d) - ring(d) * 0.012;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokeStyle = '#2a2826';
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = rgba(mix('#e8e0d0', o.far, 0.4), 0.55);
      g.lineWidth = 1.2;
      g.stroke();
    }
  }
  if (o.flooded) {
    for (let i = 0; i < 60; i++) {
      const d = Math.pow(range(r, 0, 1), 1.4);
      const x = cx(d) + range(r, -1, 1) * halfW(d) * 0.9;
      const y = floorY(d) - range(r, 0, ring(d) * 0.04);
      g.strokeStyle = rgba(mix('#9fd0e0', o.far, 0.4), 0.3 * (1 - d * 0.5));
      g.lineWidth = Math.max(0.5, 1.6 * (1 - d));
      g.beginPath();
      g.moveTo(x - ring(d) * 0.08, y);
      g.lineTo(x + ring(d) * 0.08, y);
      g.stroke();
    }
  }
  // Cables a lo largo de la pared izquierda
  for (let c2 = 0; c2 < 3; c2++) {
    const a = Math.PI * (1.08 + c2 * 0.045);
    g.strokeStyle = rgba('#070707', 0.95);
    g.lineWidth = 3 - c2 * 0.7;
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const d = Math.pow(i / 40, 1.4);
      const rr = ring(d) * 0.93;
      const x = cx(d) + Math.cos(a) * rr;
      const y = cy(d) + Math.sin(a) * rr + Math.abs(Math.sin(i * 0.9)) * rr * 0.015;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // Lámparas en la pared derecha
  if (o.lamps !== false) {
    for (let i = 1; i < 8; i++) {
      const d = Math.pow(i / 8, 1.6);
      const a = Math.PI * 1.88;
      const rr = ring(d) * 0.9;
      const x = cx(d) + Math.cos(a) * rr;
      const y = cy(d) + Math.sin(a) * rr;
      glowAt(g, x, y, ring(d) * 0.4, '#ffc070', 0.5 * (1 - d * 0.3));
      g.fillStyle = '#fff0c8';
      const ls = Math.max(1, ring(d) * 0.012);
      g.fillRect(x - ls, y - ls, ls * 2, ls * 2);
    }
  }
  return { cx, cy, ring, floorY, halfW };
}

/** Andén de estación en perspectiva: bóveda, columnas, arcos y suelo de baldosas. */
export function platformHall({ g, w, h, r }: Stage, o: { vx: number; vy: number; warm?: string; columns?: string; lampsLit?: number }) {
  const warm = o.warm ?? '#ffb45e';
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#0c0b0a');
  bg.addColorStop(0.55, '#1c1914');
  bg.addColorStop(1, '#0d0c0a');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  const floor = h * 0.66;
  // Suelo de baldosas
  const fg = g.createLinearGradient(0, o.vy, 0, h);
  fg.addColorStop(0, '#2a241c');
  fg.addColorStop(1, '#4a4034');
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(0, h);
  g.lineTo(0, floor);
  g.lineTo(o.vx, o.vy);
  g.lineTo(w, floor);
  g.lineTo(w, h);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 1;
  for (let k = -14; k <= 14; k++) {
    g.beginPath();
    g.moveTo(o.vx, o.vy);
    g.lineTo(o.vx + k * w * 0.12, h);
    g.stroke();
  }
  for (let i = 1; i < 18; i++) {
    const t = Math.pow(i / 18, 2);
    const y = o.vy + (h - o.vy) * t;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  // Columnas y arcos a ambos lados
  const colCol = o.columns ?? '#6f6656';
  for (const side of [-1, 1]) {
    for (let i = 7; i >= 0; i--) {
      const d = i / 8;
      const k = 1 / (1 + d * 4.5);
      const x = o.vx + side * w * 0.52 * k;
      const top = o.vy - (o.vy - h * 0.05) * k;
      const bottom = o.vy + (h * 1.02 - o.vy) * k;
      const cw = w * 0.06 * k;
      const light = 1 - d * 0.75;
      const cg = g.createLinearGradient(x - cw, 0, x + cw, 0);
      cg.addColorStop(side < 0 ? 0 : 1, shade(colCol, -0.7));
      cg.addColorStop(0.5, shade(colCol, -0.2 - (1 - light) * 0.6));
      cg.addColorStop(side < 0 ? 1 : 0, shade(colCol, -0.05 - (1 - light) * 0.6));
      g.fillStyle = cg;
      g.fillRect(x - cw, top, cw * 2, bottom - top);
      // Arco hacia la siguiente columna
      const k2 = 1 / (1 + (d + 1 / 8) * 4.5);
      const x2 = o.vx + side * w * 0.52 * k2;
      const top2 = o.vy - (o.vy - h * 0.05) * k2;
      g.strokeStyle = shade(colCol, -0.55 - (1 - light) * 0.3);
      g.lineWidth = Math.max(1, 6 * k);
      g.beginPath();
      g.moveTo(x, top + (bottom - top) * 0.18);
      g.quadraticCurveTo((x + x2) / 2, top - 10 * k, x2, top2 + (o.vy - top2) * 0.2);
      g.stroke();
      if (i % 2 === 0 && (o.lampsLit ?? 1) > 0) {
        const lx = (x + x2) / 2;
        const ly = top + (bottom - top) * 0.22;
        hangingLamp(g, lx, ly, 6 * k, warm, (o.lampsLit ?? 1) * (0.6 + range(r, 0, 0.4)));
      }
    }
  }
  // Bruma
  const haze = g.createLinearGradient(0, 0, 0, h);
  haze.addColorStop(0, 'rgba(0,0,0,0.6)');
  haze.addColorStop(0.5, rgba(warm, 0.05));
  haze.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = haze;
  g.fillRect(0, 0, w, h);
  return { floor };
}

/** La superficie: cielo encapotado, ciudad en ruinas y nieve. */
export function surface({ g, w, h, r }: Stage, o: { horizon: number; sky?: string; snow?: boolean; tint?: string }) {
  const sky = g.createLinearGradient(0, 0, 0, o.horizon);
  sky.addColorStop(0, o.sky ?? '#2b333a');
  sky.addColorStop(1, mix(o.sky ?? '#2b333a', '#9aa6ab', 0.55));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, o.horizon + 2);
  // Nubes (se pintan en un lienzo aparte para respetar la escala del escenario)
  const clouds = makeCanvas(Math.ceil(w / 2), Math.ceil(o.horizon / 2));
  const cg = ctx2d(clouds);
  const img = cg.createImageData(clouds.width, clouds.height);
  const d = img.data;
  const seed = Math.floor(r() * 1000);
  for (let y = 0; y < clouds.height; y++) {
    for (let x = 0; x < clouds.width; x++) {
      const n = fbm(x / 60, y / 25, 4, seed);
      const i = (y * clouds.width + x) * 4;
      const v = n > 0.5 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = Math.abs(n - 0.5) * 2 * 70;
    }
  }
  cg.putImageData(img, 0, 0);
  g.drawImage(clouds, 0, 0, w, o.horizon);
  // Tres planos de edificios en ruinas
  const layers = [
    { base: o.horizon, hMax: h * 0.28, col: mix('#3a4247', o.sky ?? '#2b333a', 0.4), win: 0 },
    { base: o.horizon + h * 0.04, hMax: h * 0.4, col: '#20252a', win: 0.03 },
    { base: o.horizon + h * 0.09, hMax: h * 0.55, col: '#0e1114', win: 0.05 },
  ];
  for (const L of layers) {
    let x = -20;
    g.fillStyle = L.col;
    while (x < w + 20) {
      const bw = range(r, 30, 90);
      const bh = range(r, L.hMax * 0.35, L.hMax);
      const top = L.base - bh;
      g.beginPath();
      g.moveTo(x, L.base + 2);
      g.lineTo(x, top + range(r, 0, bh * 0.2));
      // Techo roto
      const steps = 3 + Math.floor(r() * 4);
      for (let s = 1; s <= steps; s++) g.lineTo(x + (bw * s) / steps, top + range(r, -4, bh * 0.25));
      g.lineTo(x + bw, L.base + 2);
      g.closePath();
      g.fill();
      if (L.win > 0) {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        for (let wy = top + 8; wy < L.base - 6; wy += 9) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 8) if (r() < 0.6) g.fillRect(wx, wy, 3.5, 4.5);
        }
        g.fillStyle = L.col;
      }
      if (r() < 0.12) {
        // Grúa o antena
        g.strokeStyle = L.col;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x + bw * 0.5, top);
        g.lineTo(x + bw * 0.5, top - bh * 0.6);
        g.lineTo(x + bw * 1.2, top - bh * 0.6);
        g.stroke();
      }
      x += bw + range(r, -6, 12);
    }
  }
  // Suelo nevado
  const ground = g.createLinearGradient(0, o.horizon + h * 0.09, 0, h);
  ground.addColorStop(0, '#6b7378');
  ground.addColorStop(1, '#2c3033');
  g.fillStyle = ground;
  g.fillRect(0, o.horizon + h * 0.09, w, h);
  // Niebla de nieve
  const fog = g.createLinearGradient(0, o.horizon - h * 0.2, 0, o.horizon + h * 0.2);
  fog.addColorStop(0, 'rgba(180,195,200,0)');
  fog.addColorStop(0.5, 'rgba(180,195,200,0.25)');
  fog.addColorStop(1, 'rgba(180,195,200,0)');
  g.fillStyle = fog;
  g.fillRect(0, 0, w, h);
  if (o.snow !== false) snowfall({ g, w, h, r }, 500);
}

export function snowfall({ g, w, h, r }: Stage, n: number) {
  g.save();
  for (let i = 0; i < n; i++) {
    const x = range(r, 0, w);
    const y = range(r, 0, h);
    const s = range(r, 0.5, 2.2);
    g.fillStyle = `rgba(230,238,242,${range(r, 0.25, 0.8)})`;
    g.beginPath();
    g.ellipse(x, y, s, s * 0.8, 0, 0, Math.PI * 2);
    g.fill();
    if (s > 1.6) {
      g.strokeStyle = 'rgba(230,238,242,0.15)';
      g.lineWidth = s * 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - 10, y - 4);
      g.stroke();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------------------
// Figuras humanas
// ---------------------------------------------------------------------------

export type Pose = 'stand' | 'rifle' | 'aim' | 'walk' | 'sit' | 'dig' | 'guitar' | 'raise' | 'kneel' | 'point' | 'carry';
export type Head = 'bare' | 'helmet' | 'gasmask' | 'hood' | 'ushanka' | 'cap' | 'kerchief';

export interface FigureOpts {
  pose: Pose;
  head?: Head;
  facing?: 1 | -1;
  color?: string;
  coat?: boolean;
  lantern?: boolean;
  female?: boolean;
  armband?: string;
  bulk?: number;
  /** Fase de animación (brazo de la guitarra, paso al andar...). */
  phase?: number;
}

type P2 = [number, number];

/** Miembro con grosor variable (de w1 a w2) y extremos redondeados. */
function capsule(parts: Path2D[], a: P2, b: P2, w1: number, w2: number) {
  const p = new Path2D();
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const nx = Math.cos(ang + Math.PI / 2);
  const ny = Math.sin(ang + Math.PI / 2);
  p.moveTo(a[0] + nx * w1 * 0.5, a[1] + ny * w1 * 0.5);
  p.lineTo(b[0] + nx * w2 * 0.5, b[1] + ny * w2 * 0.5);
  p.arc(b[0], b[1], w2 * 0.5, ang + Math.PI / 2, ang - Math.PI / 2, true);
  p.lineTo(a[0] - nx * w1 * 0.5, a[1] - ny * w1 * 0.5);
  p.arc(a[0], a[1], w1 * 0.5, ang - Math.PI / 2, ang + Math.PI / 2, true);
  p.closePath();
  parts.push(p);
}

export interface FigureShape {
  body: Path2D[];
  gear: Path2D[];
  head: [number, number, number];
  hand: P2;
}

/** Silueta articulada de una persona (pies en x, y; altura H). */
export function figureShape(x: number, y: number, H: number, o: FigureOpts): FigureShape {
  const f = o.facing ?? 1;
  const bulk = o.bulk ?? 1;
  const fem = !!o.female;
  const P = (dx: number, dy: number): P2 => [x + dx * f * H, y - dy * H];
  const body: Path2D[] = [];
  const gear: Path2D[] = [];
  const ph = o.phase ?? 0;
  const pose = o.pose;
  const sit = pose === 'sit' || pose === 'guitar';
  const kneel = pose === 'kneel' || pose === 'aim';
  const drop = sit ? 0.24 : kneel ? 0.17 : 0;
  const hipY = 0.5 - drop;
  const sY = 0.815 - drop;
  const shW = (fem ? 0.095 : 0.108) * bulk;
  const hipW = (fem ? 0.058 : 0.05) * bulk;
  const thigh = 0.078 * bulk;
  const calf = 0.056 * bulk;
  // ---- Piernas
  const leg = (hip: P2, knee: P2, ankle: P2, toe: number) => {
    capsule(body, hip, knee, thigh, calf * 1.05);
    capsule(body, knee, ankle, calf, calf * 0.72);
    // Bota
    const boot = new Path2D();
    boot.moveTo(ankle[0] - f * H * 0.025, ankle[1] - H * 0.02);
    boot.lineTo(ankle[0] + f * H * (0.035 + toe), ankle[1] + H * 0.012);
    boot.lineTo(ankle[0] + f * H * (0.04 + toe), ankle[1] + H * 0.036);
    boot.lineTo(ankle[0] - f * H * 0.03, ankle[1] + H * 0.036);
    boot.closePath();
    body.push(boot);
  };
  if (sit) {
    leg(P(-0.02, hipY), P(0.17, hipY + 0.04), P(0.19, 0.04), 0.02);
    leg(P(0.03, hipY), P(0.22, hipY + 0.02), P(0.26, 0.04), 0.02);
  } else if (kneel) {
    leg(P(0.02, hipY), P(0.15, 0.3), P(0.14, 0.04), 0.02);
    leg(P(-0.02, hipY), P(-0.07, 0.05), P(-0.24, 0.05), -0.04);
  } else {
    const walk = pose === 'walk' || pose === 'carry';
    const stride = walk ? Math.sin(ph) * 0.1 : pose === 'dig' ? 0.1 : 0.028;
    const lift = walk ? Math.max(0, Math.cos(ph)) * 0.04 : 0;
    leg(P(0.03 * 0.5, hipY), P(stride * 0.6 + 0.01, 0.27 + lift), P(stride, 0.04 + lift * 0.6), 0.02);
    leg(P(-0.03 * 0.5, hipY), P(-stride * 0.6 - 0.01, 0.27), P(-stride, 0.04), 0.02);
  }
  // ---- Torso (con abrigo opcional)
  const t = new Path2D();
  const waistY = hipY + 0.07;
  t.moveTo(...P(-shW, sY));
  t.quadraticCurveTo(...P(-shW * 0.2, sY + 0.035), ...P(0, sY + 0.03));
  t.quadraticCurveTo(...P(shW * 0.2, sY + 0.035), ...P(shW, sY));
  t.quadraticCurveTo(...P(shW * 1.12, sY - 0.05), ...P(shW * 0.86, sY - 0.14));
  t.quadraticCurveTo(...P(shW * 0.7, waistY + 0.04), ...P(hipW * 1.2, waistY));
  if (o.coat) {
    const hem = sit ? hipY - 0.02 : kneel ? hipY - 0.1 : 0.26;
    t.quadraticCurveTo(...P(hipW * 2.4, (waistY + hem) / 2), ...P(hipW * 2.6, hem));
    t.lineTo(...P(0.01, hem + 0.02));
    t.lineTo(...P(-hipW * 2.5, hem));
    t.quadraticCurveTo(...P(-hipW * 2.3, (waistY + hem) / 2), ...P(-hipW * 1.2, waistY));
  } else {
    t.lineTo(...P(hipW * 1.25, hipY - 0.02));
    t.lineTo(...P(-hipW * 1.25, hipY - 0.02));
    t.lineTo(...P(-hipW * 1.2, waistY));
  }
  t.quadraticCurveTo(...P(-shW * 0.7, waistY + 0.04), ...P(-shW * 0.86, sY - 0.14));
  t.quadraticCurveTo(...P(-shW * 1.12, sY - 0.05), ...P(-shW, sY));
  t.closePath();
  body.push(t);
  // ---- Cuello y cabeza
  const hc = P(0.012, sY + 0.09);
  const hrx = 0.05 * H;
  const hry = 0.062 * H;
  capsule(body, P(0, sY), P(0.006, sY + 0.05), 0.05 * H, 0.045 * H);
  const head = new Path2D();
  head.ellipse(hc[0], hc[1], hrx, hry, 0, 0, Math.PI * 2);
  // Mandíbula / nariz insinuadas hacia delante
  head.moveTo(hc[0] + f * hrx * 0.7, hc[1] - hry * 0.1);
  head.quadraticCurveTo(hc[0] + f * hrx * 1.25, hc[1] + hry * 0.1, hc[0] + f * hrx * 0.75, hc[1] + hry * 0.45);
  head.lineTo(hc[0], hc[1]);
  head.closePath();
  body.push(head);
  // ---- Brazos
  const upper = 0.056 * bulk * H;
  const fore = 0.046 * bulk * H;
  const shF = P(shW * 0.8, sY - 0.02);
  const shB = P(-shW * 0.8, sY - 0.02);
  const arm = (sh: P2, el: P2, hd: P2) => {
    capsule(body, sh, el, upper, fore * 1.02);
    capsule(body, el, hd, fore, fore * 0.85);
    const hand = new Path2D();
    hand.arc(hd[0], hd[1], fore * 0.55, 0, Math.PI * 2);
    body.push(hand);
  };
  let hand: P2 = P(0.1, hipY);
  const stick = (a: P2, b: P2, wd: number) => capsule(gear, a, b, wd * H, wd * H);
  switch (pose) {
    case 'rifle':
      arm(shF, P(0.13, sY - 0.17), P(0.08, sY - 0.09));
      arm(shB, P(-0.05, sY - 0.2), P(0.02, sY - 0.22));
      stick(P(-0.07, sY - 0.34), P(0.15, sY + 0.1), 0.026);
      hand = P(0.08, sY - 0.09);
      break;
    case 'aim':
      arm(shF, P(0.04, sY - 0.1), P(0.03, sY - 0.02));
      arm(shB, P(0.12, sY - 0.08), P(0.24, sY - 0.02));
      stick(P(-0.02, sY), P(0.5, sY + 0.012), 0.028);
      capsule(gear, P(0.02, sY - 0.01), P(0.04, sY - 0.08), 0.03 * H, 0.03 * H);
      hand = P(0.5, sY + 0.012);
      break;
    case 'point':
      arm(shF, P(0.18, sY - 0.01), P(0.34, sY + 0.03));
      arm(shB, P(-0.11, sY - 0.16), P(-0.09, sY - 0.3));
      hand = P(0.34, sY + 0.03);
      break;
    case 'raise':
      arm(shF, P(0.15, sY + 0.08), P(0.12, sY + 0.24));
      arm(shB, P(-0.11, sY - 0.16), P(-0.09, sY - 0.3));
      hand = P(0.12, sY + 0.24);
      break;
    case 'dig': {
      const up = Math.sin(ph) * 0.06;
      arm(shF, P(0.12, sY - 0.08 + up), P(0.06, sY + 0.02 + up));
      arm(shB, P(-0.02, sY - 0.1 + up), P(0.03, sY - 0.04 + up));
      stick(P(0.1, sY - 0.12 + up), P(-0.14, sY + 0.2 + up), 0.02);
      const pick = new Path2D();
      const top = P(-0.14, sY + 0.2 + up);
      pick.moveTo(top[0] - f * H * 0.1, top[1] + H * 0.06);
      pick.quadraticCurveTo(top[0], top[1] - H * 0.03, top[0] + f * H * 0.1, top[1] + H * 0.05);
      pick.lineTo(top[0], top[1] + H * 0.01);
      pick.closePath();
      gear.push(pick);
      hand = P(0.06, sY + 0.02 + up);
      break;
    }
    case 'carry': {
      arm(shF, P(0.12, sY - 0.12), P(0.16, sY - 0.06));
      arm(shB, P(0.03, sY - 0.13), P(0.1, sY - 0.08));
      const box = new Path2D();
      const b0 = P(0.07, sY + 0.02);
      box.rect(Math.min(b0[0], b0[0] + f * H * 0.17), b0[1], H * 0.17, H * 0.14);
      gear.push(box);
      hand = P(0.16, sY - 0.06);
      break;
    }
    case 'guitar': {
      const strum = Math.sin(ph) * 0.025;
      const gb = P(0.1, hipY + 0.07);
      const guitar = new Path2D();
      guitar.ellipse(gb[0], gb[1], 0.1 * H, 0.075 * H, -0.45 * f, 0, Math.PI * 2);
      guitar.moveTo(gb[0] + f * H * 0.06, gb[1] - H * 0.06);
      guitar.ellipse(gb[0] + f * H * 0.06, gb[1] - H * 0.06, 0.07 * H, 0.055 * H, -0.45 * f, 0, Math.PI * 2);
      gear.push(guitar);
      stick(P(0.06, hipY + 0.1), P(-0.26, hipY + 0.33), 0.022);
      arm(shF, P(0.15, sY - 0.14), P(0.14, hipY + 0.1 + strum));
      arm(shB, P(-0.12, sY - 0.1), P(-0.2, hipY + 0.28));
      hand = P(0.14, hipY + 0.1 + strum);
      break;
    }
    case 'sit':
      arm(shF, P(0.1, sY - 0.14), P(0.17, hipY + 0.06));
      arm(shB, P(0.02, sY - 0.15), P(0.1, hipY + 0.05));
      hand = P(0.17, hipY + 0.06);
      break;
    default: {
      const swing = pose === 'walk' ? Math.sin(ph) * 0.07 : 0.01;
      arm(shF, P(0.1 + swing * 0.6, sY - 0.17), P(0.09 + swing, sY - 0.32));
      arm(shB, P(-0.1 - swing * 0.6, sY - 0.17), P(-0.08 - swing, sY - 0.32));
      hand = P(0.09 + swing, sY - 0.32);
    }
  }
  if (o.lantern) {
    const hd = pose === 'stand' || pose === 'walk' || pose === 'rifle' ? P(0.1, hipY - 0.02) : hand;
    capsule(gear, hd, [hd[0], hd[1] + H * 0.05], 0.008 * H, 0.008 * H);
    const lan = new Path2D();
    lan.rect(hd[0] - H * 0.022, hd[1] + H * 0.05, H * 0.044, H * 0.06);
    gear.push(lan);
    hand = [hd[0], hd[1] + H * 0.08];
  }
  // ---- Tocado
  const hw = new Path2D();
  const [hx, hy] = hc;
  switch (o.head) {
    case 'helmet':
      hw.ellipse(hx, hy - hry * 0.25, hrx * 1.35, hry * 1.05, 0, Math.PI, 0);
      hw.lineTo(hx + hrx * 1.5, hy - hry * 0.15);
      hw.lineTo(hx - hrx * 1.5, hy - hry * 0.15);
      hw.closePath();
      break;
    case 'gasmask': {
      hw.ellipse(hx + f * hrx * 0.95, hy + hry * 0.35, hrx * 0.62, hry * 0.5, 0, 0, Math.PI * 2);
      hw.moveTo(hx + f * hrx * 1.35, hy + hry * 0.7);
      hw.arc(hx + f * hrx * 1.35, hy + hry * 0.72, hrx * 0.42, 0, Math.PI * 2);
      break;
    }
    case 'hood':
      hw.moveTo(hx - f * hrx * 1.35, hy + hry * 1.5);
      hw.quadraticCurveTo(hx - f * hrx * 1.8, hy - hry * 1.4, hx + f * hrx * 0.1, hy - hry * 1.35);
      hw.quadraticCurveTo(hx + f * hrx * 1.5, hy - hry * 1.1, hx + f * hrx * 1.25, hy + hry * 0.2);
      hw.quadraticCurveTo(hx + f * hrx * 0.9, hy + hry * 1.1, hx + f * hrx * 0.4, hy + hry * 1.6);
      hw.closePath();
      break;
    case 'ushanka':
      hw.ellipse(hx, hy - hry * 0.45, hrx * 1.35, hry * 0.85, 0, Math.PI, 0);
      hw.lineTo(hx + hrx * 1.35, hy + hry * 0.6);
      hw.quadraticCurveTo(hx + hrx * 1.1, hy + hry * 0.9, hx + hrx * 0.9, hy + hry * 0.5);
      hw.lineTo(hx + hrx * 0.9, hy - hry * 0.2);
      hw.lineTo(hx - hrx * 0.9, hy - hry * 0.2);
      hw.lineTo(hx - hrx * 0.9, hy + hry * 0.5);
      hw.quadraticCurveTo(hx - hrx * 1.1, hy + hry * 0.9, hx - hrx * 1.35, hy + hry * 0.6);
      hw.closePath();
      break;
    case 'cap':
      hw.ellipse(hx - f * hrx * 0.05, hy - hry * 0.55, hrx * 1.12, hry * 0.62, 0, Math.PI, 0);
      hw.lineTo(hx + f * hrx * 1.75, hy - hry * 0.42);
      hw.lineTo(hx + f * hrx * 1.0, hy - hry * 0.3);
      hw.lineTo(hx - f * hrx * 1.1, hy - hry * 0.4);
      hw.closePath();
      break;
    case 'kerchief':
      hw.ellipse(hx, hy - hry * 0.3, hrx * 1.15, hry * 1.0, 0, Math.PI * 1.05, Math.PI * 1.95);
      hw.lineTo(hx + f * hrx * 1.0, hy + hry * 0.4);
      hw.lineTo(hx - f * hrx * 1.3, hy + hry * 0.9);
      hw.lineTo(hx - f * hrx * 1.9, hy + hry * 1.6);
      hw.lineTo(hx - f * hrx * 1.2, hy + hry * 0.3);
      hw.closePath();
      break;
    default:
      // Pelo
      hw.ellipse(hx - f * hrx * 0.15, hy - hry * 0.35, hrx * 1.05, hry * 0.75, -0.2 * f, Math.PI * 0.95, Math.PI * 2.05);
      hw.closePath();
      break;
  }
  body.push(hw);
  return { body, gear, head: [hx, hy, hrx], hand };
}

/**
 * Dibuja una figura a contraluz: silueta oscura, un leve relleno de luz del lado
 * iluminado, luz de contorno y un toque de color (brazalete o pañuelo).
 */
export function figure(stage: Stage, x: number, y: number, H: number, o: FigureOpts, light: { x: number; y: number; color: string; strength?: number }) {
  const { g, w, h } = stage;
  const shp = figureShape(x, y, H, o);
  const col = o.color ?? '#0c0c0b';
  const all = [...shp.body, ...shp.gear];
  // Sombra en el suelo, alejándose de la luz
  g.save();
  const away = Math.sign(x - light.x) || 1;
  const sx = x + away * H * 0.1;
  const sh = g.createRadialGradient(sx, y, 0, sx, y, H * 0.3);
  sh.addColorStop(0, 'rgba(0,0,0,0.55)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(sx, y, H * 0.3, H * 0.045, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Silueta
  const sil = makeCanvas(w, h);
  const sg = ctx2d(sil);
  sg.fillStyle = col;
  for (const p of all) sg.fill(p);
  // Relleno tenue del lado iluminado
  sg.globalCompositeOperation = 'source-atop';
  const lx = light.x - x;
  const fillGrad = sg.createLinearGradient(x - H * 0.3, 0, x + H * 0.3, 0);
  const lit = rgba(mix(col, light.color, 0.35), 0.55);
  fillGrad.addColorStop(lx < 0 ? 0 : 1, lit);
  fillGrad.addColorStop(0.5, rgba(col, 0));
  sg.fillStyle = fillGrad;
  sg.fillRect(x - H, y - H * 1.2, H * 2, H * 1.3);
  // Brazalete
  if (o.armband) {
    const f = o.facing ?? 1;
    const shoulderY = y - H * (0.815 - (o.pose === 'sit' || o.pose === 'guitar' ? 0.24 : o.pose === 'aim' || o.pose === 'kneel' ? 0.17 : 0));
    sg.fillStyle = o.armband;
    sg.globalAlpha = 0.9;
    sg.fillRect(x + f * H * 0.075 - (f < 0 ? H * 0.06 : 0), shoulderY + H * 0.07, H * 0.06, H * 0.028);
    sg.globalAlpha = 1;
  }
  g.drawImage(sil, 0, 0);
  // Luz de contorno
  const dx = Math.sign(light.x - x) || 1;
  const dy = Math.sign(light.y - (y - H * 0.6)) || -1;
  const layer = makeCanvas(w, h);
  const lg = ctx2d(layer);
  lg.fillStyle = light.color;
  for (const p of all) lg.fill(p);
  lg.globalCompositeOperation = 'destination-out';
  lg.translate(-dx * Math.max(1, H * 0.014), -dy * Math.max(0.5, H * 0.008));
  for (const p of all) lg.fill(p);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = light.strength ?? 0.85;
  g.drawImage(layer, 0, 0);
  g.restore();
  // Lentes de la máscara
  if (o.head === 'gasmask') {
    const [hx, hy, R] = shp.head;
    const f = o.facing ?? 1;
    g.fillStyle = rgba(mix('#a8c8c0', light.color, 0.5), 0.85);
    g.beginPath();
    g.ellipse(hx + f * R * 0.55, hy - R * 0.2, R * 0.28, R * 0.34, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (o.lantern) {
    const [lx2, ly2] = shp.hand;
    glowAt(g, lx2, ly2, H * 0.55, '#ffc070', 0.65);
    g.fillStyle = '#fff2c8';
    g.fillRect(lx2 - H * 0.013, ly2 - H * 0.02, H * 0.026, H * 0.035);
  }
}

// ---------------------------------------------------------------------------
// Fuego, humo y utilería
// ---------------------------------------------------------------------------

/** Llamas por capas (se puede animar con `t`). */
export function fire(g: Ctx, x: number, y: number, s: number, t = 0, seed = 0) {
  glowAt(g, x, y - s * 0.6, s * 5, '#ff8a2a', 0.5);
  glowAt(g, x, y - s * 0.3, s * 2, '#ffd27a', 0.5);
  const layers: [string, number][] = [
    ['#b32a10', 1],
    ['#f06a1a', 0.8],
    ['#ffb640', 0.55],
    ['#fff0b0', 0.3],
  ];
  for (const [col, k] of layers) {
    g.fillStyle = col;
    for (let i = 0; i < 5; i++) {
      const ph = t * (5 + i) + seed * 3 + i * 1.7;
      const fx = x + (i - 2) * s * 0.18 * k;
      const fh = s * k * (1.2 + 0.35 * Math.sin(ph) + 0.25 * Math.sin(ph * 1.7 + 2));
      const fw = s * 0.28 * k;
      const lean = Math.sin(ph * 0.8) * s * 0.12;
      g.beginPath();
      g.moveTo(fx - fw, y);
      g.quadraticCurveTo(fx - fw * 0.8, y - fh * 0.55, fx + lean, y - fh);
      g.quadraticCurveTo(fx + fw * 0.8, y - fh * 0.55, fx + fw, y);
      g.closePath();
      g.fill();
    }
  }
  // Leña
  g.strokeStyle = '#1b120b';
  g.lineWidth = s * 0.12;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - s * 0.6, y + s * 0.05);
  g.lineTo(x + s * 0.5, y - s * 0.12);
  g.moveTo(x + s * 0.6, y + s * 0.05);
  g.lineTo(x - s * 0.45, y - s * 0.14);
  g.stroke();
}

export function smoke(stage: Stage, x: number, y: number, s: number, n: number, color = '#8a8278', alpha = 0.18) {
  const { g, w, h, r } = stage;
  const layer = makeCanvas(w, h);
  const lg = ctx2d(layer);
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const px = x + Math.sin(k * 6 + r() * 2) * s * k * 1.5 + range(r, -s, s) * 0.3;
    const py = y - k * s * 6;
    const rad = s * (0.5 + k * 1.8);
    const gr = lg.createRadialGradient(px, py, 0, px, py, rad);
    gr.addColorStop(0, rgba(color, alpha * (1 - k * 0.7)));
    gr.addColorStop(1, rgba(color, 0));
    lg.fillStyle = gr;
    lg.fillRect(px - rad, py - rad, rad * 2, rad * 2);
  }
  blurCanvas(layer, 3);
  g.drawImage(layer, 0, 0);
}

export function flag(g: Ctx, x: number, y: number, w: number, h: number, color: string, t = 0) {
  g.strokeStyle = '#1a1510';
  g.lineWidth = Math.max(1.5, w * 0.04);
  g.beginPath();
  g.moveTo(x, y + h * 2.2);
  g.lineTo(x, y - h * 0.1);
  g.stroke();
  const grad = g.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, shade(color, 0.1));
  grad.addColorStop(0.5, shade(color, -0.25));
  grad.addColorStop(1, shade(color, 0.05));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(x, y);
  const N = 12;
  for (let i = 0; i <= N; i++) {
    const k = i / N;
    g.lineTo(x + w * k, y + Math.sin(k * 5 + t) * h * 0.08 * k);
  }
  for (let i = N; i >= 0; i--) {
    const k = i / N;
    g.lineTo(x + w * k, y + h + Math.sin(k * 5 + t + 0.4) * h * 0.08 * k);
  }
  g.closePath();
  g.fill();
}

export function crate(g: Ctx, x: number, y: number, s: number, lightFrom = -1) {
  const front = '#4a3a28';
  g.fillStyle = shade(front, -0.3);
  g.beginPath();
  g.moveTo(x, y - s);
  g.lineTo(x + s * 0.3, y - s * 1.2);
  g.lineTo(x + s * 1.3, y - s * 1.2);
  g.lineTo(x + s, y - s);
  g.closePath();
  g.fill();
  g.fillStyle = shade(front, lightFrom < 0 ? 0.05 : -0.2);
  g.fillRect(x, y - s, s, s);
  g.fillStyle = shade(front, -0.45);
  g.beginPath();
  g.moveTo(x + s, y);
  g.lineTo(x + s, y - s);
  g.lineTo(x + s * 1.3, y - s * 1.2);
  g.lineTo(x + s * 1.3, y - s * 0.2);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 1;
  g.strokeRect(x + s * 0.08, y - s * 0.92, s * 0.84, s * 0.84);
  g.beginPath();
  g.moveTo(x + s * 0.08, y - s * 0.08);
  g.lineTo(x + s * 0.92, y - s * 0.92);
  g.stroke();
}

export function sandbags(g: Ctx, x: number, y: number, w: number, rows: number, s: number) {
  for (let row = 0; row < rows; row++) {
    const n = Math.floor(w / (s * 1.9));
    for (let i = 0; i < n; i++) {
      const bx = x + i * s * 1.9 + (row % 2 ? s * 0.95 : 0);
      const by = y - row * s * 0.95;
      const gr = g.createLinearGradient(bx, by - s, bx, by);
      gr.addColorStop(0, '#8b7b58');
      gr.addColorStop(1, '#3a3222');
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(bx + s, by - s * 0.5, s * 1.02, s * 0.55, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

export function rubble(stage: Stage, x: number, y: number, w: number, hgt: number, n = 40) {
  const { g, r } = stage;
  for (let i = 0; i < n; i++) {
    const px = x + range(r, 0, w);
    const k = 1 - Math.abs(px - (x + w / 2)) / (w / 2);
    const py = y - range(r, 0, hgt * k);
    const s = range(r, 3, 12);
    g.fillStyle = mix('#2a2622', '#6a6258', range(r, 0, 0.6));
    g.beginPath();
    const m = 5;
    for (let j = 0; j < m; j++) {
      const a = (j / m) * Math.PI * 2 + range(r, -0.3, 0.3);
      const rr = s * range(r, 0.6, 1);
      if (j === 0) g.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7);
      else g.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr * 0.7);
    }
    g.closePath();
    g.fill();
  }
}

/** Gradación de color final: viñeta, virado y grano. */
export function grade(stage: Stage, tint: string, strength = 0.18) {
  const { g, w, h } = stage;
  g.save();
  g.globalCompositeOperation = 'soft-light';
  g.fillStyle = rgba(tint, strength * 2);
  g.fillRect(0, 0, w, h);
  g.restore();
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.7)');
  g.fillStyle = v;
  g.fillRect(0, 0, w, h);
}
