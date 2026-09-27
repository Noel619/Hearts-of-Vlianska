// Andenes vistos en planta: vías, columnas, tiendas, hogueras, vagones y los
// detalles propios de cada estación. Cada sprite se pinta una vez por dueño.
import { FACTIONS } from '../../data';
import type { FactionId } from '../../game/types';
import { blurCanvas, ctx2d, makeCanvas, type Ctx } from '../canvas';
import { mix, rgba, shade } from '../color';
import { chance, pick, range, rng, type Rand } from '../rng';
import { STATION_GEO_BY_ID, type Pt } from './geometry';

export interface HallSprite {
  canvas: HTMLCanvasElement;
  ppu: number;
  /** Tamaño del lienzo en unidades del mundo (incluye margen). */
  w: number;
  h: number;
  lamps: Pt[];
  fires: Pt[];
  abandoned: boolean;
}

type Props = 'standard' | 'hospital' | 'factory' | 'fortress' | 'vents' | 'market' | 'capital' | 'scrap' | 'military' | 'workers' | 'carpets';

interface HallStyle {
  props: Props;
  escalator?: 'big' | 'small';
  snow?: boolean;
  frost?: boolean;
  carriage?: boolean;
  abandoned?: boolean;
  island?: boolean;
}

const STYLES: Record<string, HallStyle> = {
  SEV: { props: 'standard', escalator: 'big', snow: true },
  UBE: { props: 'hospital', escalator: 'small' },
  IND: { props: 'factory', island: true },
  RUB: { props: 'fortress' },
  KHO: { props: 'vents', frost: true, island: true },
  STA: { props: 'market', carriage: true, escalator: 'small' },
  TSE: { props: 'capital', carriage: true, escalator: 'small' },
  ZVE: { props: 'standard', escalator: 'small', island: true },
  MOS: { props: 'standard', carriage: true },
  VHL: { props: 'scrap', carriage: true },
  CHE: { props: 'military', escalator: 'small' },
  RAS: { props: 'workers', island: true },
  STL: { props: 'workers', carriage: true, escalator: 'small' },
  VYS: { props: 'workers' },
  MER: { props: 'carpets', island: true },
  TEN: { props: 'standard', abandoned: true, carriage: true },
};

const MARGIN = 18;

const TARPS = ['#6e3b2e', '#4b5a3a', '#3f4d5c', '#7a6a4a', '#5c3f52', '#8a5a2a', '#3d5a52', '#6b6358'];

interface Layout {
  L: number;
  W: number;
  island: boolean;
  /** Franjas de andén [y0, y1] */
  platforms: [number, number][];
  /** Franjas de vía [y0, y1] */
  tracks: [number, number][];
}

function layoutOf(len: number, wid: number, island: boolean): Layout {
  if (island) {
    const pw = wid * 0.44;
    return {
      L: len,
      W: wid,
      island,
      platforms: [[-pw / 2, pw / 2]],
      tracks: [
        [-wid / 2, -pw / 2],
        [pw / 2, wid / 2],
      ],
    };
  }
  const tb = wid * 0.34;
  return {
    L: len,
    W: wid,
    island,
    platforms: [
      [-wid / 2, -tb / 2],
      [tb / 2, wid / 2],
    ],
    tracks: [[-tb / 2, tb / 2]],
  };
}

function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

function drawTrack(g: Ctx, L: number, y0: number, y1: number, r: Rand) {
  const h = y1 - y0;
  // Balasto
  g.fillStyle = '#16140f';
  g.fillRect(-L / 2, y0, L, h);
  for (let i = 0; i < L * h * 0.9; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(90,82,70,0.35)' : 'rgba(0,0,0,0.35)';
    g.fillRect(range(r, -L / 2, L / 2), range(r, y0, y1), 0.35, 0.35);
  }
  const cy = (y0 + y1) / 2;
  const gauge = Math.min(h * 0.32, 3.6);
  // Traviesas
  g.fillStyle = '#35291d';
  for (let x = -L / 2 + 1; x < L / 2; x += 2.2) {
    g.fillRect(x, cy - gauge - 1.2, 1.1, gauge * 2 + 2.4);
  }
  // Carriles
  for (const s of [-1, 1]) {
    g.fillStyle = '#4d4a45';
    g.fillRect(-L / 2, cy + s * gauge - 0.45, L, 0.9);
    g.fillStyle = 'rgba(210,205,195,0.55)';
    g.fillRect(-L / 2, cy + s * gauge - 0.4, L, 0.3);
  }
  // Tercer carril (electrificado, ya muerto)
  g.fillStyle = 'rgba(60,55,48,0.9)';
  g.fillRect(-L / 2, cy + gauge + 2.2, L, 0.5);
}

function drawPlatform(g: Ctx, L: number, y0: number, y1: number, r: Rand, frost: boolean, edges: ('top' | 'bottom')[]) {
  const h = y1 - y0;
  const base = frost ? '#6a6f70' : '#5f584c';
  g.fillStyle = base;
  g.fillRect(-L / 2, y0, L, h);
  // Baldosas de granito
  const t = 3;
  for (let x = -L / 2; x < L / 2; x += t) {
    for (let y = y0; y < y1; y += t) {
      const v = range(r, -0.12, 0.1);
      g.fillStyle = v > 0 ? rgba('#ffffff', v * 0.5) : rgba('#000000', -v);
      g.fillRect(x, y, t, Math.min(t, y1 - y));
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 0.18;
  g.beginPath();
  for (let x = -L / 2; x <= L / 2; x += t) {
    g.moveTo(x, y0);
    g.lineTo(x, y1);
  }
  for (let y = y0; y <= y1; y += t) {
    g.moveTo(-L / 2, y);
    g.lineTo(L / 2, y);
  }
  g.stroke();
  // Suciedad y desgaste
  for (let i = 0; i < L * h * 0.08; i++) {
    g.fillStyle = rgba('#1a150f', range(r, 0.05, 0.2));
    g.beginPath();
    g.arc(range(r, -L / 2, L / 2), range(r, y0, y1), range(r, 0.3, 2.2), 0, Math.PI * 2);
    g.fill();
  }
  // Línea de seguridad junto a la vía
  for (const e of edges) {
    const y = e === 'top' ? y0 + 0.9 : y1 - 1.5;
    g.fillStyle = frost ? 'rgba(200,210,215,0.35)' : 'rgba(196,160,62,0.55)';
    g.fillRect(-L / 2, y, L, 0.6);
    g.fillStyle = 'rgba(0,0,0,0.5)';
    g.fillRect(-L / 2, e === 'top' ? y0 : y1 - 0.5, L, 0.5);
  }
}

function drawColumn(g: Ctx, x: number, y: number, s: number, frost: boolean) {
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(x - s / 2 + 0.8, y - s / 2 + 0.9, s, s);
  const grad = g.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2);
  grad.addColorStop(0, frost ? '#d8dcdc' : '#b9ad93');
  grad.addColorStop(1, frost ? '#7d8485' : '#6d6452');
  g.fillStyle = grad;
  g.fillRect(x - s / 2, y - s / 2, s, s);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 0.25;
  g.strokeRect(x - s / 2, y - s / 2, s, s);
}

function drawTent(g: Ctx, x: number, y: number, w: number, h: number, color: string, r: Rand) {
  g.save();
  g.translate(x, y);
  g.rotate(range(r, -0.06, 0.06));
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(-w / 2 + 0.7, -h / 2 + 0.9, w, h);
  // Dos faldones con la cumbrera en el centro
  const light = shade(color, 0.18);
  const dark = shade(color, -0.3);
  g.fillStyle = light;
  g.fillRect(-w / 2, -h / 2, w, h / 2);
  g.fillStyle = dark;
  g.fillRect(-w / 2, 0, w, h / 2);
  g.strokeStyle = shade(color, -0.55);
  g.lineWidth = 0.3;
  g.strokeRect(-w / 2, -h / 2, w, h);
  g.beginPath();
  g.moveTo(-w / 2, 0);
  g.lineTo(w / 2, 0);
  g.stroke();
  // Remiendos
  if (chance(r, 0.6)) {
    g.fillStyle = shade(pick(r, TARPS), 0.05);
    g.fillRect(range(r, -w / 2, w / 2 - 2), range(r, -h / 2, h / 2 - 1.6), 1.8, 1.4);
  }
  g.restore();
}

function drawCrate(g: Ctx, x: number, y: number, s: number, r: Rand) {
  g.save();
  g.translate(x, y);
  g.rotate(range(r, -0.4, 0.4));
  g.fillStyle = 'rgba(0,0,0,0.45)';
  g.fillRect(-s / 2 + 0.4, -s / 2 + 0.5, s, s);
  g.fillStyle = pick(r, ['#6b5233', '#5a4630', '#4a5236', '#5b5b55']);
  g.fillRect(-s / 2, -s / 2, s, s);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 0.2;
  g.strokeRect(-s / 2, -s / 2, s, s);
  g.beginPath();
  g.moveTo(-s / 2, -s / 2);
  g.lineTo(s / 2, s / 2);
  g.stroke();
  g.restore();
}

function drawFirePit(g: Ctx, x: number, y: number) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillStyle = '#4a4540';
    g.beginPath();
    g.arc(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 0.55, 0, Math.PI * 2);
    g.fill();
  }
  const eg = g.createRadialGradient(x, y, 0.1, x, y, 1.6);
  eg.addColorStop(0, '#ffd27a');
  eg.addColorStop(0.5, '#d45a1a');
  eg.addColorStop(1, '#3a1a0a');
  g.fillStyle = eg;
  g.beginPath();
  g.arc(x, y, 1.5, 0, Math.PI * 2);
  g.fill();
}

function drawCarriage(g: Ctx, x: number, y: number, len: number, wid: number, color: string, r: Rand, wrecked = false) {
  g.save();
  g.translate(x, y);
  if (wrecked) g.rotate(range(r, 0.05, 0.14));
  g.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(g, -len / 2 + 0.8, -wid / 2 + 1, len, wid, 1.2);
  g.fill();
  const grad = g.createLinearGradient(0, -wid / 2, 0, wid / 2);
  grad.addColorStop(0, shade(color, 0.15));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, shade(color, -0.4));
  g.fillStyle = grad;
  roundRect(g, -len / 2, -wid / 2, len, wid, 1.2);
  g.fill();
  // Techo: rejillas y remaches
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 0.2;
  for (let k = 1; k < 5; k++) {
    const xx = -len / 2 + (len / 5) * k;
    g.beginPath();
    g.moveTo(xx, -wid / 2);
    g.lineTo(xx, wid / 2);
    g.stroke();
  }
  g.fillStyle = 'rgba(30,30,30,0.6)';
  for (let k = 0; k < 3; k++) g.fillRect(-len / 2 + len * (0.2 + k * 0.3) - 1.5, -0.8, 3, 1.6);
  // Óxido
  for (let i = 0; i < len * 1.2; i++) {
    g.fillStyle = rgba('#6a3517', range(r, 0.1, 0.35));
    g.beginPath();
    g.arc(range(r, -len / 2, len / 2), range(r, -wid / 2, wid / 2), range(r, 0.2, 1), 0, Math.PI * 2);
    g.fill();
  }
  // Tendedero o chimenea: el vagón es una vivienda
  if (!wrecked) {
    g.strokeStyle = 'rgba(210,200,180,0.5)';
    g.lineWidth = 0.15;
    g.beginPath();
    g.moveTo(-len / 2 + 4, -wid / 2 - 0.4);
    g.lineTo(-len / 2 + 14, -wid / 2 - 0.4);
    g.stroke();
    for (let k = 0; k < 4; k++) {
      g.fillStyle = pick(r, ['#c9b99a', '#8a6a5a', '#6a7a8a']);
      g.fillRect(-len / 2 + 5 + k * 2.3, -wid / 2 - 0.4, 1.4, 1.1);
    }
  }
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 0.3;
  roundRect(g, -len / 2, -wid / 2, len, wid, 1.2);
  g.stroke();
  g.restore();
}

function drawSandbags(g: Ctx, x0: number, y0: number, x1: number, y1: number) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 1.8));
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.ellipse(x + 0.3, y + 0.4, 1.2, 0.8, 0, 0, Math.PI * 2);
    g.fill();
    const bg = g.createRadialGradient(x - 0.3, y - 0.3, 0.1, x, y, 1.3);
    bg.addColorStop(0, '#b3a27a');
    bg.addColorStop(1, '#5e533b');
    g.fillStyle = bg;
    g.beginPath();
    g.ellipse(x, y, 1.15, 0.8, 0, 0, Math.PI * 2);
    g.fill();
  }
}

function drawBanner(g: Ctx, x: number, y: number, color: string, down: boolean) {
  const h = 4.5;
  const w = 2.6;
  const y0 = down ? y : y - h;
  g.fillStyle = 'rgba(0,0,0,0.4)';
  g.fillRect(x - w / 2 + 0.4, y0 + 0.4, w, h);
  const grad = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  grad.addColorStop(0, shade(color, 0.15));
  grad.addColorStop(1, shade(color, -0.35));
  g.fillStyle = grad;
  g.beginPath();
  if (down) {
    g.moveTo(x - w / 2, y0);
    g.lineTo(x + w / 2, y0);
    g.lineTo(x + w / 2, y0 + h);
    g.lineTo(x, y0 + h - 1);
    g.lineTo(x - w / 2, y0 + h);
  } else {
    g.moveTo(x - w / 2, y0 + h);
    g.lineTo(x + w / 2, y0 + h);
    g.lineTo(x + w / 2, y0);
    g.lineTo(x, y0 + 1);
    g.lineTo(x - w / 2, y0);
  }
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(255,240,200,0.55)';
  g.beginPath();
  g.arc(x, y0 + h / 2, 0.55, 0, Math.PI * 2);
  g.fill();
}

function drawEscalator(g: Ctx, x: number, wid: number, dir: 1 | -1, big: boolean, snow: boolean) {
  const len = big ? 22 : 13;
  const w = big ? wid * 0.62 : wid * 0.42;
  const x0 = dir > 0 ? x : x - len;
  g.fillStyle = '#0d0c0a';
  g.fillRect(x0 - 1, -w / 2 - 1.5, len + 2, w + 3);
  const lanes = big ? 3 : 2;
  const lw = w / lanes;
  for (let i = 0; i < lanes; i++) {
    const y = -w / 2 + i * lw;
    g.fillStyle = i % 2 ? '#2d2a25' : '#34302a';
    g.fillRect(x0, y + 0.3, len, lw - 0.6);
    g.strokeStyle = 'rgba(150,140,120,0.35)';
    g.lineWidth = 0.15;
    for (let s = 0; s < len; s += 0.9) {
      g.beginPath();
      g.moveTo(x0 + s, y + 0.3);
      g.lineTo(x0 + s, y + lw - 0.3);
      g.stroke();
    }
  }
  // Oscuridad hacia arriba
  const fade = g.createLinearGradient(x0, 0, x0 + len, 0);
  fade.addColorStop(dir > 0 ? 0 : 1, 'rgba(0,0,0,0)');
  fade.addColorStop(dir > 0 ? 1 : 0, 'rgba(0,0,0,0.85)');
  g.fillStyle = fade;
  g.fillRect(x0, -w / 2, len, w);
  if (snow) {
    const sx = dir > 0 ? x0 + len : x0;
    const sg = g.createRadialGradient(sx, 0, 1, sx, 0, w * 0.8);
    sg.addColorStop(0, 'rgba(230,240,245,0.75)');
    sg.addColorStop(1, 'rgba(230,240,245,0)');
    g.fillStyle = sg;
    g.fillRect(sx - w, -w, w * 2, w * 2);
  }
}

export function paintHall(sid: string, owner: FactionId | null, ppu = 5): HallSprite {
  const sg = STATION_GEO_BY_ID[sid];
  const style = STYLES[sid] ?? { props: 'standard' };
  const abandoned = !!style.abandoned || owner === null;
  const r = rng(`hall-${sid}`);
  const L = sg.len;
  const W = sg.wid;
  const cw = L + MARGIN * 2 + 26;
  const ch = W + MARGIN * 2;
  const c = makeCanvas(cw * ppu, ch * ppu);
  const g = ctx2d(c);
  g.scale(ppu, ppu);
  g.translate(cw / 2, ch / 2);
  const lay = layoutOf(L, W, !!style.island);
  const color = owner ? FACTIONS[owner].color : '#444444';
  const lamps: Pt[] = [];
  const fires: Pt[] = [];

  // Sombra del hueco excavado
  {
    const sh = makeCanvas(c.width, c.height);
    const sgc = ctx2d(sh);
    sgc.scale(ppu, ppu);
    sgc.translate(cw / 2, ch / 2);
    sgc.fillStyle = 'rgba(0,0,0,0.85)';
    roundRect(sgc, -L / 2 - 6, -W / 2 - 6, L + 12, W + 12, 5);
    sgc.fill();
    blurCanvas(sh, 5 * ppu);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(sh, 0, 0);
    g.restore();
  }
  // Escaleras mecánicas en un extremo
  if (style.escalator) drawEscalator(g, L / 2 + 1, W, 1, style.escalator === 'big', !!style.snow);
  // Muros
  g.fillStyle = '#1b1a17';
  roundRect(g, -L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 3);
  g.fill();
  g.strokeStyle = 'rgba(140,130,110,0.35)';
  g.lineWidth = 0.5;
  roundRect(g, -L / 2 - 2.6, -W / 2 - 2.6, L + 5.2, W + 5.2, 2.6);
  g.stroke();
  // Clip al interior
  g.save();
  g.beginPath();
  g.rect(-L / 2, -W / 2, L, W);
  g.clip();
  for (const [y0, y1] of lay.tracks) drawTrack(g, L, y0, y1, r);
  for (const [y0, y1] of lay.platforms) {
    const edges: ('top' | 'bottom')[] = [];
    if (lay.tracks.some(([a, b]) => Math.abs(b - y0) < 0.01 || Math.abs(a - y0) < 0.01)) edges.push('top');
    if (lay.tracks.some(([a]) => Math.abs(a - y1) < 0.01)) edges.push('bottom');
    drawPlatform(g, L, y0, y1, r, !!style.frost, edges);
  }
  // Vagones aparcados en la vía (viviendas o chatarra)
  if (style.carriage) {
    const [y0, y1] = lay.tracks[0];
    const cx = range(r, -L * 0.18, L * 0.18);
    drawCarriage(g, cx, (y0 + y1) / 2, L * 0.46, Math.min(y1 - y0, 7.5), abandoned ? '#4a3c30' : pick(r, ['#5d3a36', '#3e5a4a', '#3c4a62', '#6b5a3a']), r, abandoned);
  }
  // Columnas
  const colRows: number[] = lay.island ? [lay.platforms[0][0] + 3, lay.platforms[0][1] - 3] : [lay.platforms[0][0] + (lay.platforms[0][1] - lay.platforms[0][0]) * 0.55, lay.platforms[1][0] + (lay.platforms[1][1] - lay.platforms[1][0]) * 0.45];
  const colSpacing = 11;
  const colXs: number[] = [];
  for (let x = -L / 2 + 7; x <= L / 2 - 6; x += colSpacing) colXs.push(x);
  // Accesorios sobre los andenes
  const slots: { x: number; y0: number; y1: number }[] = [];
  for (const [y0, y1] of lay.platforms) {
    for (let x = -L / 2 + 3; x < L / 2 - 6; x += 7.5) slots.push({ x, y0: y0 + 1.6, y1: y1 - 1.6 });
  }
  const place = (fn: (x: number, y: number, w: number, h: number) => void, density: number) => {
    for (const s of slots) {
      if (!chance(r, density)) continue;
      const h = Math.min(s.y1 - s.y0, range(r, 4, 6.5));
      const w = range(r, 5, 7);
      const y = range(r, s.y0 + h / 2, Math.max(s.y0 + h / 2, s.y1 - h / 2));
      fn(s.x + w / 2, y, w, h);
    }
  };
  if (abandoned) {
    // Escombros, huesos, charcos y restos de campamento
    for (let i = 0; i < 70; i++) {
      g.fillStyle = rgba(pick(r, ['#3a3631', '#2a2622', '#4d463c']), range(r, 0.6, 1));
      g.beginPath();
      const x = range(r, -L / 2, L / 2);
      const y = range(r, -W / 2, W / 2);
      const n = 5 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const rr = range(r, 0.4, 1.6);
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.closePath();
      g.fill();
    }
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(40,70,60,0.5)';
      g.beginPath();
      g.ellipse(range(r, -L / 2, L / 2), range(r, -W / 2, W / 2), range(r, 3, 7), range(r, 1.5, 3), range(r, 0, 3), 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(220,210,190,0.7)';
    g.lineWidth = 0.35;
    for (let i = 0; i < 16; i++) {
      const x = range(r, -L / 2, L / 2);
      const y = range(r, -W / 2, W / 2);
      const a = range(r, 0, Math.PI);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6);
      g.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const x = range(r, -L / 2 + 8, L / 2 - 8);
      const pl = pick(r, lay.platforms);
      drawTent(g, x, (pl[0] + pl[1]) / 2, 5, 4, '#2c2926', r);
    }
    // Manchas de moho fosforescente
    for (let i = 0; i < 10; i++) {
      const x = range(r, -L / 2, L / 2);
      const y = range(r, -W / 2, W / 2);
      const mg = g.createRadialGradient(x, y, 0.1, x, y, 3);
      mg.addColorStop(0, 'rgba(120,200,120,0.35)');
      mg.addColorStop(1, 'rgba(120,200,120,0)');
      g.fillStyle = mg;
      g.fillRect(x - 3, y - 3, 6, 6);
    }
  } else {
    const tarps = TARPS.map((t) => mix(t, color, 0.18));
    switch (style.props) {
      case 'hospital':
        place((x, y, w, h) => {
          // Camas en fila con cruz roja
          for (let k = 0; k < 2; k++) {
            const bx = x - w / 4 + k * (w / 2);
            g.fillStyle = 'rgba(0,0,0,0.4)';
            g.fillRect(bx - 1.1 + 0.3, y - h / 2 + 0.4, 2.2, h * 0.8);
            g.fillStyle = '#d9d4c6';
            g.fillRect(bx - 1.1, y - h / 2, 2.2, h * 0.8);
            g.fillStyle = '#9fb2b8';
            g.fillRect(bx - 1.1, y - h / 2, 2.2, 1.1);
          }
        }, 0.7);
        place((x, y) => {
          g.fillStyle = '#e8e2d4';
          g.fillRect(x - 2, y - 2, 4, 4);
          g.fillStyle = '#b3202c';
          g.fillRect(x - 0.5, y - 1.5, 1, 3);
          g.fillRect(x - 1.5, y - 0.5, 3, 1);
        }, 0.12);
        break;
      case 'factory':
        place((x, y, w, h) => {
          g.fillStyle = 'rgba(0,0,0,0.5)';
          g.fillRect(x - w / 2 + 0.5, y - h / 2 + 0.6, w, h);
          const mg = g.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
          mg.addColorStop(0, '#6f7275');
          mg.addColorStop(1, '#2f3133');
          g.fillStyle = mg;
          g.fillRect(x - w / 2, y - h / 2, w, h);
          g.strokeStyle = 'rgba(255,255,255,0.15)';
          g.lineWidth = 0.2;
          g.strokeRect(x - w / 2 + 0.6, y - h / 2 + 0.6, w - 1.2, h - 1.2);
          // Engranaje
          g.strokeStyle = '#1b1c1d';
          g.lineWidth = 0.5;
          g.beginPath();
          g.arc(x + w * 0.2, y, Math.min(w, h) * 0.22, 0, Math.PI * 2);
          g.stroke();
        }, 0.55);
        place((x, y) => {
          fires.push([x, y]);
          const fg = g.createRadialGradient(x, y, 0.2, x, y, 2.4);
          fg.addColorStop(0, '#ffcf6a');
          fg.addColorStop(0.6, '#b3401a');
          fg.addColorStop(1, '#2b140a');
          g.fillStyle = '#26221d';
          g.fillRect(x - 3, y - 3, 6, 6);
          g.fillStyle = fg;
          g.fillRect(x - 2.2, y - 2.2, 4.4, 4.4);
        }, 0.1);
        break;
      case 'fortress':
        place((x, y, w, h) => drawTent(g, x, y, w * 0.8, h * 0.8, pick(r, tarps), r), 0.35);
        for (const sx of [-1, 1]) {
          drawSandbags(g, sx * (L / 2 - 4), -W / 2 + 2, sx * (L / 2 - 4), W / 2 - 2);
          drawSandbags(g, sx * (L / 2 - 7), -W / 2 + 4, sx * (L / 2 - 7), -W / 2 + 12);
        }
        place((x, y) => drawCrate(g, x, y, 2.2, r), 0.35);
        break;
      case 'vents':
        for (const [y0, y1] of lay.platforms) {
          for (let x = -L / 2 + 14; x < L / 2 - 8; x += 26) {
            const y = (y0 + y1) / 2;
            const rad = Math.min(6, (y1 - y0) / 2 - 0.5);
            g.fillStyle = '#101314';
            g.beginPath();
            g.arc(x, y, rad + 0.8, 0, Math.PI * 2);
            g.fill();
            g.strokeStyle = '#7d8a90';
            g.lineWidth = 0.6;
            g.beginPath();
            g.arc(x, y, rad, 0, Math.PI * 2);
            g.stroke();
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * Math.PI * 2;
              g.strokeStyle = 'rgba(160,175,180,0.8)';
              g.lineWidth = 0.9;
              g.beginPath();
              g.moveTo(x, y);
              g.quadraticCurveTo(x + Math.cos(a + 0.5) * rad * 0.6, y + Math.sin(a + 0.5) * rad * 0.6, x + Math.cos(a) * rad * 0.95, y + Math.sin(a) * rad * 0.95);
              g.stroke();
            }
            const fr = g.createRadialGradient(x, y, rad * 0.5, x, y, rad * 2.6);
            fr.addColorStop(0, 'rgba(200,225,235,0.3)');
            fr.addColorStop(1, 'rgba(200,225,235,0)');
            g.fillStyle = fr;
            g.fillRect(x - rad * 3, y - rad * 3, rad * 6, rad * 6);
          }
        }
        place((x, y, w, h) => drawTent(g, x, y, w * 0.8, h * 0.8, pick(r, tarps), r), 0.3);
        break;
      case 'market':
        place((x, y, w, h) => {
          // Puestos con toldos de colores
          for (let k = 0; k < 2; k++) {
            const sx = x - w / 4 + k * (w / 2);
            const col = pick(r, ['#8a3b2a', '#c79a3a', '#3b6a5a', '#6a4a7a', '#a0602a', '#4a6a8a']);
            g.fillStyle = 'rgba(0,0,0,0.45)';
            g.fillRect(sx - 1.6 + 0.4, y - h / 2 + 0.5, 3.2, h * 0.7);
            g.fillStyle = col;
            g.fillRect(sx - 1.6, y - h / 2, 3.2, h * 0.7);
            g.fillStyle = 'rgba(255,255,255,0.25)';
            for (let s = 0; s < 3; s++) g.fillRect(sx - 1.6 + s * 1.1, y - h / 2, 0.5, h * 0.7);
          }
        }, 0.85);
        place((x, y) => drawCrate(g, x, y, 1.8, r), 0.4);
        break;
      case 'capital':
        place((x, y, w, h) => drawTent(g, x, y, w, h, pick(r, tarps), r), 0.55);
        // Tienda del gobierno, más grande y con estandartes
        {
          const pl = lay.platforms[0];
          const y = (pl[0] + pl[1]) / 2;
          drawTent(g, 0, y, 16, Math.min(9, pl[1] - pl[0] - 1.5), shade(color, -0.35), r);
          drawBanner(g, -9, pl[0] + 0.5, color, true);
          drawBanner(g, 9, pl[0] + 0.5, color, true);
        }
        place((x, y) => drawCrate(g, x, y, 2, r), 0.25);
        break;
      case 'scrap':
        place((x, y, w, h) => drawTent(g, x, y, w * 0.9, h * 0.8, pick(r, ['#4a3a2e', '#3a3430', '#5a3a26']), r), 0.45);
        for (let i = 0; i < 50; i++) {
          g.fillStyle = rgba(pick(r, ['#6a5a4a', '#5a3a2a', '#77706a', '#4a4a4a']), range(r, 0.6, 1));
          g.save();
          g.translate(range(r, -L / 2, L / 2), range(r, -W / 2, W / 2));
          g.rotate(range(r, 0, 3));
          g.fillRect(-range(r, 0.3, 1.5), -0.3, range(r, 0.6, 3), range(r, 0.3, 0.9));
          g.restore();
        }
        break;
      case 'military':
        place((x, y, w, h) => {
          // Tiendas militares en formación
          drawTent(g, x, y, w * 0.85, h * 0.8, pick(r, ['#4a5236', '#525a3c', '#3e4630']), r);
        }, 0.55);
        for (const sx of [-1, 1]) drawSandbags(g, sx * (L / 2 - 5), -W / 2 + 3, sx * (L / 2 - 5), W / 2 - 3);
        place((x, y) => drawCrate(g, x, y, 2.2, r), 0.3);
        break;
      case 'workers':
        place((x, y, w, h) => drawTent(g, x, y, w, h, pick(r, tarps), r), 0.6);
        for (let i = 0; i < 4; i++) drawBanner(g, -L / 2 + 10 + i * (L - 20) / 3, -W / 2 + 0.2, color, true);
        break;
      case 'carpets':
        place((x, y, w, h) => {
          const col = pick(r, ['#7a2a2a', '#2a4a6a', '#6a4a1a', '#1f6a52']);
          g.fillStyle = col;
          g.fillRect(x - w / 2, y - h / 2, w, h);
          g.strokeStyle = '#d9b64e';
          g.lineWidth = 0.35;
          g.strokeRect(x - w / 2 + 0.6, y - h / 2 + 0.6, w - 1.2, h - 1.2);
          g.strokeStyle = 'rgba(217,182,78,0.6)';
          g.beginPath();
          g.moveTo(x, y - h / 2 + 1.2);
          g.lineTo(x + w / 2 - 1.2, y);
          g.lineTo(x, y + h / 2 - 1.2);
          g.lineTo(x - w / 2 + 1.2, y);
          g.closePath();
          g.stroke();
        }, 0.5);
        place((x, y, w, h) => drawTent(g, x, y, w * 0.8, h * 0.8, pick(r, tarps), r), 0.3);
        break;
      default:
        place((x, y, w, h) => drawTent(g, x, y, w, h, pick(r, tarps), r), 0.55);
        place((x, y) => drawCrate(g, x, y, 1.9, r), 0.3);
    }
    // Hogueras
    const nFires = style.props === 'hospital' ? 1 : 2 + Math.floor(r() * 2);
    for (let i = 0; i < nFires; i++) {
      const pl = pick(r, lay.platforms);
      const x = range(r, -L / 2 + 6, L / 2 - 6);
      const y = range(r, pl[0] + 2.5, pl[1] - 2.5);
      drawFirePit(g, x, y);
      fires.push([x, y]);
    }
  }
  // Columnas encima de todo lo del suelo
  for (const y of colRows) for (const x of colXs) drawColumn(g, x, y, 2.6, !!style.frost);
  // Lámparas colgadas sobre los andenes
  for (const [y0, y1] of lay.platforms) {
    for (let x = -L / 2 + 12; x < L / 2 - 6; x += abandoned ? 40 : 20) {
      const y = (y0 + y1) / 2;
      lamps.push([x, y]);
      if (!abandoned) {
        g.fillStyle = '#fff2c8';
        g.beginPath();
        g.arc(x, y, 0.6, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // Luz ambiental pintada: zonas oscuras en los bordes y charcos de luz
  const amb = g.createRadialGradient(0, 0, Math.min(L, W) * 0.2, 0, 0, L * 0.6);
  amb.addColorStop(0, 'rgba(0,0,0,0)');
  amb.addColorStop(1, abandoned ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)');
  g.fillStyle = amb;
  g.fillRect(-L / 2, -W / 2, L, W);
  if (!abandoned) {
    g.globalCompositeOperation = 'lighter';
    for (const [x, y] of [...lamps, ...fires]) {
      const lg = g.createRadialGradient(x, y, 0.2, x, y, 9);
      lg.addColorStop(0, 'rgba(255,190,110,0.28)');
      lg.addColorStop(1, 'rgba(255,190,110,0)');
      g.fillStyle = lg;
      g.fillRect(x - 9, y - 9, 18, 18);
    }
    g.globalCompositeOperation = 'source-over';
  } else {
    g.fillStyle = 'rgba(10,20,16,0.35)';
    g.fillRect(-L / 2, -W / 2, L, W);
  }
  g.restore();
  // Estandartes en los muros de los extremos
  if (!abandoned && style.props !== 'workers') {
    drawBanner(g, -L / 2 + 5, -W / 2 - 0.5, color, true);
    drawBanner(g, L / 2 - 5, W / 2 + 0.5, color, false);
  }
  // Borde interior del muro
  g.strokeStyle = 'rgba(0,0,0,0.8)';
  g.lineWidth = 0.8;
  g.strokeRect(-L / 2, -W / 2, L, W);
  return { canvas: c, ppu, w: cw, h: ch, lamps, fires, abandoned };
}
