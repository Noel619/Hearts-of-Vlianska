// Sprites pequeños del mapa: soldados, draisinas, barricadas, luces y rótulos.
import { FACTIONS } from '../../data';
import type { FactionId } from '../../game/types';
import { cachedCanvas, ctx2d, makeCanvas, type Ctx } from '../canvas';
import { hexToRgb, mix, shade } from '../color';
import { range, rng } from '../rng';

export type UnitKind = 'soldier' | 'militia' | 'stalker' | 'draisina';

interface Uniform {
  coat: string;
  pants: string;
  head: 'helmet' | 'gasmask' | 'ushanka' | 'cap' | 'beret' | 'bandana' | 'hood' | 'turban';
  headColor: string;
  accent: string;
}

const UNIFORMS: Record<FactionId, Uniform> = {
  UNI: { coat: '#3d4b60', pants: '#2a3342', head: 'helmet', headColor: '#2f4a7a', accent: '#6f9cff' },
  SDR: { coat: '#4c5a37', pants: '#353f27', head: 'ushanka', headColor: '#6b5642', accent: '#d8c070' },
  LEV: { coat: '#6a5a3a', pants: '#463c28', head: 'cap', headColor: '#5a4c30', accent: '#d8323a' },
  STA: { coat: '#5c4631', pants: '#3e3024', head: 'beret', headColor: '#c07a24', accent: '#f0b040' },
  VHL: { coat: '#3b2b22', pants: '#2a211b', head: 'gasmask', headColor: '#3a3f37', accent: '#f06a30' },
  CHE: { coat: '#3f3949', pants: '#2b2733', head: 'helmet', headColor: '#3a3444', accent: '#b56ae0' },
  CAL: { coat: '#8a7a58', pants: '#5e5340', head: 'turban', headColor: '#d9d0b8', accent: '#2fbf92' },
  NOR: { coat: '#8b8e88', pants: '#5f625d', head: 'hood', headColor: '#a2a59e', accent: '#d8b070' },
};

/** Añade un contorno oscuro alrededor de lo pintado (lectura a tamaño pequeño). */
function outline(src: HTMLCanvasElement, px: number, color = 'rgba(8,8,8,0.95)'): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const g = ctx2d(out);
  const sil = makeCanvas(src.width, src.height);
  const sg = ctx2d(sil);
  sg.drawImage(src, 0, 0);
  sg.globalCompositeOperation = 'source-in';
  sg.fillStyle = color;
  sg.fillRect(0, 0, sil.width, sil.height);
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    g.drawImage(sil, Math.cos(ang) * px, Math.sin(ang) * px);
  }
  g.drawImage(src, 0, 0);
  return out;
}

function soldier(g: Ctx, f: FactionId, kind: UnitKind, frame: number) {
  const u = UNIFORMS[f];
  const r = rng(`soldier-${f}-${kind}`);
  const coat = kind === 'militia' ? mix(u.coat, '#5c5443', 0.55) : kind === 'stalker' ? mix(u.coat, '#3c3a33', 0.5) : u.coat;
  const step = frame === 0 ? 3 : frame === 1 ? 1 : -1;
  // Piernas
  g.lineCap = 'round';
  g.strokeStyle = shade(u.pants, -0.1);
  g.lineWidth = 1.9;
  g.beginPath();
  g.moveTo(11.2, 15.5);
  g.lineTo(12 - step, 21.4);
  g.stroke();
  g.strokeStyle = u.pants;
  g.beginPath();
  g.moveTo(12.8, 15.5);
  g.lineTo(12 + step, 21.4);
  g.stroke();
  g.fillStyle = '#16130f';
  for (const fx of [12 - step, 12 + step]) {
    g.beginPath();
    g.ellipse(fx + 0.5, 21.8, 1.35, 0.75, 0, 0, Math.PI * 2);
    g.fill();
  }
  // Mochila
  if (kind !== 'draisina') {
    g.fillStyle = shade(coat, -0.35);
    g.fillRect(6.8, 8.6, 3.4, 5.2);
    if (kind === 'stalker') {
      // Rollo de manta
      g.fillStyle = '#6b5a44';
      g.fillRect(6.6, 7.8, 3.8, 1.3);
    }
  }
  // Abrigo
  const hem = kind === 'stalker' ? 19 : 17.2;
  const cg = g.createLinearGradient(8, 8, 16, 18);
  cg.addColorStop(0, shade(coat, 0.2));
  cg.addColorStop(1, shade(coat, -0.35));
  g.fillStyle = cg;
  g.beginPath();
  g.moveTo(9.4, 8.4);
  g.lineTo(14.8, 8.4);
  g.quadraticCurveTo(15.6, 12, 16 + (kind === 'stalker' ? 0.6 : 0), hem);
  g.lineTo(8 - (kind === 'stalker' ? 0.6 : 0), hem);
  g.quadraticCurveTo(8.6, 12, 9.4, 8.4);
  g.closePath();
  g.fill();
  // Remiendos en la milicia
  if (kind === 'militia') {
    g.fillStyle = shade(coat, 0.25);
    g.fillRect(range(r, 9, 12), range(r, 11, 15), 1.4, 1.2);
  }
  // Cinturón y correaje
  g.strokeStyle = '#1e1a14';
  g.lineWidth = 0.7;
  g.beginPath();
  g.moveTo(8.8, 13);
  g.lineTo(15.4, 13);
  g.moveTo(9.6, 8.8);
  g.lineTo(14.6, 13);
  g.stroke();
  // Brazalete / pañuelo de la facción
  g.fillStyle = u.accent;
  g.fillRect(13.6, 9.6, 1.6, 1.1);
  // Brazo y arma
  g.strokeStyle = shade(coat, -0.2);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(13.8, 9.4);
  g.lineTo(16.2, 12.2);
  g.stroke();
  if (kind === 'stalker') {
    // Farol en la mano
    g.strokeStyle = '#1b1a18';
    g.lineWidth = 0.4;
    g.beginPath();
    g.moveTo(16.4, 12.4);
    g.lineTo(16.6, 14.2);
    g.stroke();
    const lg = g.createRadialGradient(16.7, 15, 0.1, 16.7, 15, 3);
    lg.addColorStop(0, 'rgba(255,230,150,0.95)');
    lg.addColorStop(0.3, 'rgba(255,190,90,0.5)');
    lg.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = lg;
    g.fillRect(13.5, 11.8, 6.4, 6.4);
    g.fillStyle = '#ffe6a0';
    g.fillRect(16.1, 14.2, 1.2, 1.5);
    // Fusil a la espalda
    g.strokeStyle = '#1a1714';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(7.2, 16);
    g.lineTo(11.5, 5);
    g.stroke();
  } else {
    // Fusil de asalto
    g.strokeStyle = '#141311';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(10.4, 14.2);
    g.lineTo(20.2, 6.6);
    g.stroke();
    g.strokeStyle = '#5a3a22';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(10.4, 14.2);
    g.lineTo(12.4, 12.6);
    g.stroke();
    g.fillStyle = '#141311';
    g.save();
    g.translate(15.6, 10.2);
    g.rotate(-0.65);
    g.fillRect(-0.3, 0.2, 0.9, 2);
    g.restore();
  }
  g.fillStyle = '#b8906c';
  g.beginPath();
  g.arc(16.2, 12.2, 0.7, 0, Math.PI * 2);
  g.fill();
  // Cabeza
  const skin = '#c79a74';
  const hx = 12.3;
  const hy = 6;
  const head = kind === 'stalker' ? 'hood' : kind === 'militia' ? (u.head === 'turban' ? 'turban' : 'cap') : u.head;
  g.fillStyle = skin;
  g.beginPath();
  g.arc(hx, hy, 2.35, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(80,40,20,0.35)';
  g.beginPath();
  g.arc(hx - 0.6, hy + 0.5, 2, 0, Math.PI * 2);
  g.fill();
  switch (head) {
    case 'helmet': {
      const hg = g.createRadialGradient(hx - 0.8, hy - 2, 0.2, hx, hy - 1, 3.4);
      hg.addColorStop(0, shade(u.headColor, 0.45));
      hg.addColorStop(1, shade(u.headColor, -0.3));
      g.fillStyle = hg;
      g.beginPath();
      g.arc(hx, hy - 0.4, 2.9, Math.PI, 0);
      g.lineTo(hx + 3.4, hy + 0.1);
      g.lineTo(hx - 3.4, hy + 0.1);
      g.closePath();
      g.fill();
      // Máscara de gas bajo el casco
      g.fillStyle = '#2f332c';
      g.beginPath();
      g.ellipse(hx + 1.1, hy + 1, 1.5, 1.4, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#9fb4a8';
      g.beginPath();
      g.arc(hx + 1.7, hy + 0.2, 0.55, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'gasmask':
      g.fillStyle = u.headColor;
      g.beginPath();
      g.arc(hx, hy, 2.6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#b8d0c4';
      g.beginPath();
      g.arc(hx + 1.4, hy - 0.5, 0.75, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#23261f';
      g.beginPath();
      g.arc(hx + 2.1, hy + 1.3, 1.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = u.accent;
      g.fillRect(hx - 2.8, hy - 1.2, 1.4, 1.1);
      break;
    case 'ushanka':
      g.fillStyle = u.headColor;
      g.beginPath();
      g.arc(hx, hy - 0.6, 2.8, Math.PI * 1.05, Math.PI * 1.95);
      g.lineTo(hx + 2.9, hy + 1.8);
      g.lineTo(hx + 1.6, hy + 1.8);
      g.lineTo(hx + 1.6, hy - 0.4);
      g.lineTo(hx - 1.6, hy - 0.4);
      g.lineTo(hx - 1.8, hy + 2);
      g.lineTo(hx - 3, hy + 2);
      g.closePath();
      g.fill();
      g.fillStyle = '#c23a2a';
      g.beginPath();
      g.arc(hx + 1.2, hy - 1.6, 0.45, 0, Math.PI * 2);
      g.fill();
      break;
    case 'cap':
      g.fillStyle = u.headColor;
      g.beginPath();
      g.ellipse(hx, hy - 1.8, 2.7, 1.3, 0, Math.PI, 0);
      g.fill();
      g.fillRect(hx - 2.6, hy - 1.9, 5.2, 0.9);
      g.fillStyle = '#141210';
      g.fillRect(hx + 1.2, hy - 1.2, 2.4, 0.6);
      g.fillStyle = u.accent;
      g.beginPath();
      g.arc(hx + 0.6, hy - 2.2, 0.45, 0, Math.PI * 2);
      g.fill();
      break;
    case 'beret':
      g.fillStyle = u.headColor;
      g.beginPath();
      g.ellipse(hx - 0.3, hy - 2, 3, 1.4, -0.2, 0, Math.PI * 2);
      g.fill();
      break;
    case 'bandana':
      g.fillStyle = u.accent;
      g.fillRect(hx - 2.4, hy - 2.4, 4.8, 1.3);
      break;
    case 'hood': {
      g.fillStyle = kind === 'stalker' ? '#3a372f' : u.headColor;
      g.beginPath();
      g.arc(hx - 0.2, hy - 0.2, 2.9, Math.PI * 0.5, Math.PI * 2.1);
      g.lineTo(hx + 1.6, hy + 2.4);
      g.closePath();
      g.fill();
      g.fillStyle = '#1b1d1a';
      g.beginPath();
      g.ellipse(hx + 1.2, hy + 0.4, 1.3, 1.6, 0, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'turban':
      g.fillStyle = u.headColor;
      g.beginPath();
      g.ellipse(hx, hy - 1.6, 2.9, 1.8, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = u.accent;
      g.fillRect(hx - 1, hy + 0.8, 3.6, 1.8);
      break;
  }
}

function draisina(g: Ctx, f: FactionId, frame: number) {
  const color = FACTIONS[f].color;
  const u = UNIFORMS[f];
  // Ruedas
  for (const x of [6, 12, 18]) {
    const wg = g.createRadialGradient(x - 0.4, 19.6, 0.1, x, 20, 1.9);
    wg.addColorStop(0, '#8a8680');
    wg.addColorStop(1, '#1b1a18');
    g.fillStyle = wg;
    g.beginPath();
    g.arc(x, 20, 1.8, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#0c0c0b';
    g.lineWidth = 0.4;
    g.beginPath();
    const a = frame * 0.8;
    g.moveTo(x + Math.cos(a) * 1.5, 20 + Math.sin(a) * 1.5);
    g.lineTo(x - Math.cos(a) * 1.5, 20 - Math.sin(a) * 1.5);
    g.stroke();
  }
  // Chasis blindado
  const bg = g.createLinearGradient(0, 11, 0, 19);
  bg.addColorStop(0, '#7a7c74');
  bg.addColorStop(0.5, '#4a4c46');
  bg.addColorStop(1, '#23241f');
  g.fillStyle = bg;
  g.beginPath();
  g.moveTo(2.5, 18.6);
  g.lineTo(3.4, 13);
  g.lineTo(20.8, 13);
  g.lineTo(21.6, 18.6);
  g.closePath();
  g.fill();
  // Franja de la facción
  g.fillStyle = color;
  g.fillRect(3.1, 15, 18.2, 1.3);
  // Cabina y aspillera
  g.fillStyle = '#3b3d37';
  g.fillRect(7, 9.2, 8.6, 3.9);
  g.fillStyle = '#0f100e';
  g.fillRect(8.2, 10.4, 4.4, 0.8);
  // Torreta con cañón
  g.fillStyle = '#4c4e47';
  g.beginPath();
  g.arc(11.3, 9.2, 2.3, Math.PI, 0);
  g.fill();
  g.strokeStyle = '#1a1b18';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(12.6, 8.2);
  g.lineTo(19.8, 6.6);
  g.stroke();
  // Remaches
  g.fillStyle = 'rgba(220,215,200,0.6)';
  for (let x = 4; x < 21; x += 2.2) {
    g.beginPath();
    g.arc(x, 13.7, 0.25, 0, Math.PI * 2);
    g.fill();
  }
  // Faro
  const hg = g.createRadialGradient(21.6, 16.6, 0.1, 21.6, 16.6, 2.4);
  hg.addColorStop(0, 'rgba(255,240,190,1)');
  hg.addColorStop(1, 'rgba(255,240,190,0)');
  g.fillStyle = hg;
  g.fillRect(19, 14, 5, 5);
  g.fillStyle = u.accent;
  g.fillRect(4.2, 11.6, 1.2, 1.4);
}

/** Sprite de unidad: 24 × 24 unidades a 3 px por unidad, con contorno. */
export function unitSprite(f: FactionId, kind: UnitKind, frame: number): HTMLCanvasElement {
  return cachedCanvas(`unit-${f}-${kind}-${frame}`, () => {
    const s = 3;
    const c = makeCanvas(24 * s, 24 * s);
    const g = ctx2d(c);
    g.scale(s, s);
    // Sombra en el suelo
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.ellipse(12, 22.3, kind === 'draisina' ? 10 : 5.5, 1.2, 0, 0, Math.PI * 2);
    g.fill();
    if (kind === 'draisina') draisina(g, f, frame);
    else soldier(g, f, kind, frame);
    return outline(c, 2.2);
  });
}

/** Mancha de luz blanca con caída suave; se tiñe con `lightSprite`. */
export function lightSprite(color: string, size = 128): HTMLCanvasElement {
  return cachedCanvas(`light-${color}-${size}`, () => {
    const c = makeCanvas(size, size);
    const g = ctx2d(c);
    const [r, gg, b] = hexToRgb(color);
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
    grad.addColorStop(0.25, `rgba(${r},${gg},${b},0.55)`);
    grad.addColorStop(0.6, `rgba(${r},${gg},${b},0.16)`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
  });
}

/** Barricada de sacos terreros atravesando el túnel (nivel 1-5). */
export function barricadeSprite(level: number): HTMLCanvasElement {
  return cachedCanvas(`barricade-${level}`, () => {
    const s = 6;
    const W = 12;
    const H = 18;
    const c = makeCanvas(W * s, H * s);
    const g = ctx2d(c);
    g.scale(s, s);
    const rows = Math.min(3, 1 + Math.floor(level / 2));
    const r = rng(`barr-${level}`);
    for (let row = 0; row < rows; row++) {
      const x = 3 + row * 2.2;
      const n = 7;
      for (let i = 0; i < n; i++) {
        const y = 1.5 + (i / (n - 1)) * (H - 3) + (row % 2 ? 1 : 0);
        if (y > H - 1) continue;
        g.fillStyle = 'rgba(0,0,0,0.45)';
        g.beginPath();
        g.ellipse(x + 0.4, y + 0.4, 1.1, 1.35, 0, 0, Math.PI * 2);
        g.fill();
        const bg = g.createRadialGradient(x - 0.3, y - 0.4, 0.1, x, y, 1.4);
        bg.addColorStop(0, '#9c8b64');
        bg.addColorStop(1, '#443a29');
        g.fillStyle = bg;
        g.beginPath();
        g.ellipse(x, y, 1.05, 1.3, range(r, -0.2, 0.2), 0, Math.PI * 2);
        g.fill();
      }
    }
    if (level >= 3) {
      // Alambre de espino
      g.strokeStyle = 'rgba(170,165,155,0.9)';
      g.lineWidth = 0.18;
      g.beginPath();
      for (let y = 0.5; y < H - 0.5; y += 0.6) {
        const x = 1 + Math.sin(y * 3) * 0.6;
        if (y === 0.5) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    if (level >= 5) {
      // Nido de ametralladora
      g.fillStyle = '#2d2f2a';
      g.fillRect(8.2, H / 2 - 1.8, 2.6, 3.6);
      g.strokeStyle = '#141412';
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(9.5, H / 2);
      g.lineTo(5.2, H / 2 - 0.4);
      g.stroke();
    }
    return c;
  });
}

/** Rótulo de estación: placa oscura con borde de latón y letras de plantilla. */
export function labelSprite(text: string, dpr: number, small = false): HTMLCanvasElement {
  return cachedCanvas(`label-${text}-${dpr}-${small ? 1 : 0}`, () => {
    const size = (small ? 11.5 : 14) * dpr;
    const font = `700 ${size}px 'Big Shoulders Stencil Display', 'Arial Narrow', sans-serif`;
    const probe = ctx2d(makeCanvas(4, 4));
    probe.font = font;
    const tracking = 1.1 * dpr;
    const upper = text.toUpperCase();
    let tw = 0;
    for (const ch of upper) tw += probe.measureText(ch).width + tracking;
    const padX = 7 * dpr;
    const h = Math.round(size + 8 * dpr);
    const w = Math.round(tw + padX * 2);
    const c = makeCanvas(w + 4 * dpr, h + 4 * dpr);
    const g = ctx2d(c);
    g.translate(2 * dpr, 2 * dpr);
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(dpr, 1.5 * dpr, w, h);
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(34,38,34,0.92)');
    bg.addColorStop(1, 'rgba(14,16,15,0.92)');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(179,149,92,0.7)';
    g.lineWidth = dpr;
    g.strokeRect(dpr / 2, dpr / 2, w - dpr, h - dpr);
    g.font = font;
    g.textBaseline = 'middle';
    g.fillStyle = '#e8dcc0';
    let x = padX;
    for (const ch of upper) {
      g.fillText(ch, x, h / 2 + dpr * 0.5);
      x += probe.measureText(ch).width + tracking;
    }
    return c;
  });
}

/** Estrella dorada de capital. */
export function starSprite(dpr: number): HTMLCanvasElement {
  return cachedCanvas(`star-${dpr}`, () => {
    const s = 16 * dpr;
    const c = makeCanvas(s, s);
    const g = ctx2d(c);
    g.translate(s / 2, s / 2);
    const R = s * 0.46;
    const path = new Path2D();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? R : R * 0.45;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) path.moveTo(rr * Math.cos(a), rr * Math.sin(a));
      else path.lineTo(rr * Math.cos(a), rr * Math.sin(a));
    }
    path.closePath();
    const grad = g.createLinearGradient(0, -R, 0, R);
    grad.addColorStop(0, '#fff3c0');
    grad.addColorStop(0.5, '#e7b74a');
    grad.addColorStop(1, '#7a520f');
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = 2 * dpr;
    g.fillStyle = grad;
    g.fill(path);
    g.shadowColor = 'transparent';
    g.strokeStyle = '#3a2708';
    g.lineWidth = 0.8 * dpr;
    g.stroke(path);
    return c;
  });
}

export function uniformAccent(f: FactionId): string {
  return UNIFORMS[f].accent;
}

export function relationColor(kind: 'own' | 'ally' | 'enemy' | 'neutral' | 'selected'): string {
  switch (kind) {
    case 'selected':
      return '#ffd27a';
    case 'enemy':
      return '#e0614a';
    case 'ally':
      return '#8cc063';
    case 'own':
      return '#d8bb7e';
    default:
      return '#101010';
  }
}

