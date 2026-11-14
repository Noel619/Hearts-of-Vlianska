// Escena animada del menú principal: una noche en el andén. Un guitarrista
// toca junto a la hoguera mientras la estación duerme.
import { ctx2d, grain, makeCanvas, type Ctx } from '../canvas';
import { rgba, shade } from '../color';
import { rng } from '../rng';
import { Particles } from '../map/particles';
import { crate, figure, fire, flag, glowAt, platformHall, sandbags, type Stage } from './kit';

interface Layout {
  fx: number;
  fy: number;
  fs: number;
  guitar: { x: number; y: number; H: number };
}

export class MenuScene {
  private g: Ctx;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private bg: HTMLCanvasElement | null = null;
  private vignette: HTMLCanvasElement | null = null;
  private frames: HTMLCanvasElement[] = [];
  private frameBox = { x: 0, y: 0, w: 0, h: 0 };
  private layout: Layout = { fx: 0, fy: 0, fs: 1, guitar: { x: 0, y: 0, H: 1 } };
  private particles = new Particles();
  private acc = 0;
  private readonly canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = ctx2d(canvas);
  }

  resize(w: number, h: number, dpr: number) {
    const W = Math.round(w * dpr);
    const H = Math.round(h * dpr);
    if (W === this.canvas.width && H === this.canvas.height && this.bg) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = W;
    this.canvas.height = H;
    this.bake();
  }

  private bake() {
    const { w, h, dpr } = this;
    const portrait = h > w * 1.1;
    const cx = portrait ? w * 0.5 : w * 0.63;
    const bg = makeCanvas(w * dpr, h * dpr);
    const g = ctx2d(bg);
    g.scale(dpr, dpr);
    const r = rng('menu-scene');
    const stage: Stage = { g, w, h, r };
    platformHall(stage, { vx: cx + w * 0.02, vy: h * 0.4, lampsLit: 0.5, columns: '#5e5648' });
    const fy = h * 0.86;
    const fs = Math.max(16, h * 0.06);
    this.layout = { fx: cx, fy, fs, guitar: { x: cx - h * 0.2, y: h * 0.88, H: h * 0.33 } };
    const light = { x: cx, y: fy - fs, color: '#ff9a4a', strength: 1 };
    // Refugios de lona al fondo del andén
    for (let i = 0; i < 5; i++) {
      const k = 1 / (1 + i * 0.7);
      const tx = cx + w * 0.34 * k;
      const ty = h * 0.4 + h * 0.36 * k;
      const tw = w * 0.11 * k;
      const th = h * 0.1 * k;
      const col = ['#5a3a2e', '#3f4a36', '#3a4552', '#5e5238', '#4a3548'][i];
      // Faldón trasero en sombra, techo inclinado y abertura oscura
      g.fillStyle = shade(col, -0.55);
      g.fillRect(tx - tw / 2, ty - th * 0.55, tw, th * 0.55);
      g.fillStyle = shade(col, -0.2);
      g.beginPath();
      g.moveTo(tx - tw * 0.56, ty - th * 0.5);
      g.quadraticCurveTo(tx - tw * 0.1, ty - th * 1.25, tx + tw * 0.2, ty - th * 1.05);
      g.lineTo(tx + tw * 0.56, ty - th * 0.45);
      g.closePath();
      g.fill();
      g.fillStyle = rgba('#ff9a4a', 0.16 * k);
      g.beginPath();
      g.moveTo(tx - tw * 0.56, ty - th * 0.5);
      g.quadraticCurveTo(tx - tw * 0.1, ty - th * 1.25, tx + tw * 0.2, ty - th * 1.05);
      g.lineTo(tx - tw * 0.05, ty - th * 0.6);
      g.closePath();
      g.fill();
      g.fillStyle = '#060606';
      g.fillRect(tx - tw * 0.12, ty - th * 0.45, tw * 0.22, th * 0.45);
    }
    // Tendedero y bombillas de colores
    g.strokeStyle = 'rgba(15,13,10,0.9)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(cx - w * 0.3, h * 0.2);
    g.quadraticCurveTo(cx, h * 0.34, cx + w * 0.38, h * 0.18);
    g.stroke();
    for (let i = 1; i < 18; i++) {
      const t = i / 18;
      const x = cx - w * 0.3 + t * w * 0.68;
      const y = h * 0.2 + Math.sin(t * Math.PI) * h * 0.12 - t * h * 0.02;
      glowAt(g, x, y, h * 0.018, ['#ffd27a', '#ff8a6a', '#fff0c0', '#9ad0ff'][i % 4], 0.55);
    }
    // Banderas colgadas entre columnas
    flag(g, cx - w * 0.22, h * 0.12, w * 0.035, h * 0.09, '#6b2a22', 0.4);
    flag(g, cx + w * 0.2, h * 0.1, w * 0.035, h * 0.09, '#2f4a6a', 1.3);
    // Utilería en primer plano
    sandbags(g, cx + w * 0.26, h * 1.0, w * 0.2, 2, h * 0.022);
    crate(g, cx - w * 0.36, h * 0.97, h * 0.07);
    crate(g, cx - w * 0.3, h * 0.99, h * 0.05);
    // Piedras de la hoguera y leña
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.fillStyle = '#3a342d';
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * fs * 1.4, fy + Math.sin(a) * fs * 0.35, fs * 0.28, fs * 0.18, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Oyentes y centinela, iluminados por la hoguera
    figure(stage, cx + h * 0.21, h * 0.9, h * 0.33, { pose: 'sit', facing: -1, head: 'ushanka', coat: true }, light);
    figure(stage, cx + h * 0.1, h * 0.8, h * 0.24, { pose: 'sit', facing: -1, head: 'kerchief', female: true }, light);
    figure(stage, cx - h * 0.08, h * 0.79, h * 0.23, { pose: 'sit', facing: 1, head: 'cap' }, light);
    figure(stage, cx + h * 0.48, h * 0.98, h * 0.52, { pose: 'rifle', facing: -1, head: 'gasmask', coat: true, lantern: false }, light);
    figure(stage, cx - h * 0.62, h * 1.0, h * 0.5, { pose: 'stand', facing: 1, head: 'hood', coat: true, lantern: true }, { ...light, strength: 0.6 });
    this.bg = bg;
    // Viñeta y grano (estáticos)
    const v = makeCanvas(w * dpr, h * dpr);
    const vg = ctx2d(v);
    const grad = vg.createRadialGradient(cx * dpr, h * 0.7 * dpr, h * 0.2 * dpr, cx * dpr, h * 0.6 * dpr, Math.hypot(w, h) * 0.7 * dpr);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.75)');
    vg.fillStyle = grad;
    vg.fillRect(0, 0, v.width, v.height);
    grain(vg, v.width, v.height, 0.05, 11);
    this.vignette = v;
    this.bakeGuitarist(light);
  }

  /** Fotogramas del guitarrista (rasgueo) pintados una vez. */
  private bakeGuitarist(light: { x: number; y: number; color: string; strength: number }) {
    const { dpr } = this;
    const { x, y, H } = this.layout.guitar;
    const bw = H * 1.3;
    const bh = H * 1.15;
    this.frameBox = { x: x - bw * 0.5, y: y - bh * 0.95, w: bw, h: bh };
    this.frames = [];
    const N = 8;
    for (let i = 0; i < N; i++) {
      const c = makeCanvas(bw * dpr, bh * dpr);
      const g = ctx2d(c);
      g.scale(dpr, dpr);
      const stage: Stage = { g, w: bw, h: bh, r: rng(`gtr-${i}`) };
      const lx = light.x - this.frameBox.x;
      const ly = light.y - this.frameBox.y;
      figure(stage, bw * 0.5, bh * 0.95, H, { pose: 'guitar', facing: 1, head: 'bare', coat: true, phase: (i / N) * Math.PI * 2 }, { x: lx, y: ly, color: light.color, strength: 1 });
      this.frames.push(c);
    }
  }

  render(time: number, dt: number) {
    const g = this.g;
    if (!this.bg) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.drawImage(this.bg, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const { fx, fy, fs } = this.layout;
    // Parpadeo de la luz de la hoguera sobre todo el andén
    const flick = 0.75 + 0.12 * Math.sin(time * 7.1) + 0.08 * Math.sin(time * 13.3 + 1) + 0.05 * Math.sin(time * 2.3);
    glowAt(g, fx, fy - fs, this.h * 0.75, '#ff8a3a', 0.2 * flick);
    glowAt(g, fx, fy - fs * 0.6, this.h * 0.25, '#ffb45e', 0.35 * flick);
    // Guitarrista (rasgueo con ritmo irregular)
    const beat = time * 2.2;
    const strum = Math.floor((beat + Math.sin(beat * 0.5) * 0.3) * 4) % this.frames.length;
    const fr = this.frames[(strum + this.frames.length) % this.frames.length];
    if (fr) g.drawImage(fr, this.frameBox.x, this.frameBox.y, this.frameBox.w, this.frameBox.h);
    fire(g, fx, fy, fs, time, 1);
    // Humo, brasas y polvo
    this.acc += dt;
    while (this.acc > 0.04) {
      this.acc -= 0.04;
      if (Math.random() < 0.55) this.particles.spawn({ kind: 'smoke', x: fx + (Math.random() - 0.5) * fs, y: fy - fs * 1.5, vx: (Math.random() - 0.3) * fs * 0.3, vy: -fs * (0.8 + Math.random() * 0.6), max: 4 + Math.random() * 2, size: fs * 0.6, color: '#8a8278' });
      if (Math.random() < 0.5) this.particles.spawn({ kind: 'ember', x: fx + (Math.random() - 0.5) * fs, y: fy - fs, vx: (Math.random() - 0.5) * fs, vy: -fs * (2 + Math.random() * 3), max: 1 + Math.random() * 1.4, size: Math.max(1.2, fs * 0.06), color: '#ffb050' });
      if (Math.random() < 0.2) this.particles.spawn({ kind: 'dust', x: Math.random() * this.w, y: Math.random() * this.h * 0.8, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 3, max: 5 + Math.random() * 5, size: Math.max(1, this.h * 0.0016), color: '#ffe0b0' });
    }
    this.particles.update(Math.min(0.1, dt));
    this.particles.draw(g, 1, [-100, -100, this.w + 100, this.h + 100]);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.vignette) g.drawImage(this.vignette, 0, 0);
  }
}
