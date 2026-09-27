// Partículas del mapa: humo de hogueras, brasas, polvo en la luz, fogonazos,
// trazadoras y explosiones. Todo en coordenadas del mundo.
import type { Ctx } from '../canvas';
import { lightSprite } from './props';

export type ParticleKind = 'smoke' | 'ember' | 'dust' | 'spark' | 'flash' | 'tracer' | 'ring' | 'debris';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  x2?: number;
  y2?: number;
}

const MAX = 900;

export class Particles {
  list: Particle[] = [];

  spawn(p: Omit<Particle, 'life'> & { life?: number }) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({ ...p, life: p.life ?? p.max });
  }

  update(dt: number) {
    const out: Particle[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x2 !== undefined && p.y2 !== undefined) {
        p.x2 += p.vx * dt;
        p.y2 += p.vy * dt;
      }
      switch (p.kind) {
        case 'smoke':
          p.vx *= 0.99;
          p.vy *= 0.99;
          p.size *= 1 + dt * 0.45;
          break;
        case 'ember':
          p.vx += (Math.random() - 0.5) * dt * 20;
          break;
        case 'dust':
          p.vx += (Math.random() - 0.5) * dt * 3;
          p.vy += (Math.random() - 0.5) * dt * 3;
          break;
        case 'debris':
          p.vx *= 0.93;
          p.vy *= 0.93;
          break;
        case 'ring':
          p.size += dt * 60;
          break;
        default:
          break;
      }
      out.push(p);
    }
    this.list = out;
  }

  draw(g: Ctx, zoom: number, view: [number, number, number, number]) {
    const [vx0, vy0, vx1, vy1] = view;
    g.save();
    for (const p of this.list) {
      if (p.x < vx0 - 60 || p.x > vx1 + 60 || p.y < vy0 - 60 || p.y > vy1 + 60) continue;
      const t = p.life / p.max;
      switch (p.kind) {
        case 'smoke': {
          const spr = lightSprite(p.color, 64);
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = Math.min(1, (1 - t) * 3) * t * 0.35;
          g.drawImage(spr, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          break;
        }
        case 'ember':
        case 'spark': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = t;
          g.fillStyle = p.color;
          const s = Math.max(p.size, 0.9 / zoom);
          if (p.kind === 'spark') {
            g.strokeStyle = p.color;
            g.lineWidth = s;
            g.beginPath();
            g.moveTo(p.x, p.y);
            g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            g.stroke();
          } else {
            g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
          }
          break;
        }
        case 'dust': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = Math.sin(t * Math.PI) * 0.5;
          g.fillStyle = p.color;
          const s = Math.max(p.size, 0.7 / zoom);
          g.fillRect(p.x, p.y, s, s);
          break;
        }
        case 'flash': {
          const spr = lightSprite(p.color, 64);
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = t;
          g.drawImage(spr, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
          break;
        }
        case 'tracer': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = Math.min(1, t * 2);
          g.strokeStyle = p.color;
          g.lineWidth = Math.max(p.size, 1 / zoom);
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(p.x, p.y);
          g.lineTo(p.x2 ?? p.x, p.y2 ?? p.y);
          g.stroke();
          break;
        }
        case 'ring': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = t * 0.6;
          g.strokeStyle = p.color;
          g.lineWidth = Math.max(1 / zoom, 2 * t);
          g.beginPath();
          g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          g.stroke();
          break;
        }
        case 'debris': {
          g.globalCompositeOperation = 'source-over';
          g.globalAlpha = t;
          g.fillStyle = p.color;
          g.fillRect(p.x, p.y, p.size, p.size);
          break;
        }
      }
    }
    g.restore();
  }
}
