// Efectos de sonido de la interfaz y de la partida, todos sintetizados.
import type { AudioEngine } from './engine';
import { beep } from './ambience';
import { bell, brass, drum, metal, noiseHit, snare } from './instruments';

export type Sfx =
  | 'click'
  | 'hover'
  | 'open'
  | 'close'
  | 'page'
  | 'confirm'
  | 'error'
  | 'tick'
  | 'event'
  | 'build'
  | 'recruit'
  | 'move'
  | 'battle'
  | 'coin'
  | 'alert'
  | 'siren'
  | 'select'
  | 'pause';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Ganancia de cada efecto (medida con OfflineAudioContext para igualar niveles). */
const LEVEL: Record<Sfx, number> = {
  click: 5,
  hover: 22,
  open: 4,
  close: 7,
  page: 6,
  confirm: 4,
  error: 2.4,
  tick: 5,
  event: 3,
  build: 3,
  recruit: 2.6,
  move: 5,
  battle: 1.6,
  coin: 5,
  alert: 1.8,
  siren: 3,
  select: 5,
  pause: 12,
};

function trim(e: AudioEngine, dest: AudioNode, k: number): GainNode {
  const g = e.ctx.createGain();
  g.gain.value = k;
  g.connect(dest);
  return g;
}

export function playSfx(e: AudioEngine, name: Sfx) {
  const t = e.now + 0.005;
  const k = LEVEL[name];
  const ui = trim(e, e.ui.in, k);
  const fx = trim(e, e.sfx.in, k);
  const ctx = e.ctx;
  switch (name) {
    case 'click': {
      // Interruptor metálico: chasquido y un tono corto
      noiseHit(e, ui, t, { type: 'highpass', freq: 2600, dur: 0.025, gain: 0.09 });
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(700, t + 0.03);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g);
      g.connect(ui);
      o.start(t);
      o.stop(t + 0.06);
      break;
    }
    case 'hover':
      noiseHit(e, ui, t, { type: 'bandpass', freq: 4200, q: 2, dur: 0.012, gain: 0.018 });
      break;
    case 'select':
      noiseHit(e, ui, t, { type: 'highpass', freq: 1800, dur: 0.03, gain: 0.07 });
      beep(e, ui, t + 0.01, 88, 0.02);
      break;
    case 'open':
      // Chapa metálica que se desliza
      noiseHit(e, ui, t, { type: 'bandpass', freq: 500, sweepTo: 1700, q: 1.4, dur: 0.16, gain: 0.07, kind: 'pink' });
      metal(e, ui, t + 0.13, { freq: 900, gain: 0.02, decay: 0.3 });
      break;
    case 'close':
      noiseHit(e, ui, t, { type: 'bandpass', freq: 1500, sweepTo: 450, q: 1.4, dur: 0.14, gain: 0.06, kind: 'pink' });
      noiseHit(e, ui, t + 0.12, { type: 'lowpass', freq: 600, dur: 0.05, gain: 0.08 });
      break;
    case 'page':
      // Papel que se despliega
      noiseHit(e, ui, t, { type: 'bandpass', freq: 3000, sweepTo: 1200, q: 0.6, dur: 0.28, gain: 0.05, kind: 'pink' });
      noiseHit(e, ui, t + 0.08, { type: 'highpass', freq: 5000, dur: 0.1, gain: 0.02 });
      break;
    case 'confirm':
      bell(e, ui, 79, t, 0.035, { ratio: 2, index: 1, decay: 0.8 });
      bell(e, ui, 86, t + 0.08, 0.03, { ratio: 2, index: 1, decay: 1 });
      break;
    case 'error': {
      for (const f of [110, 117]) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.03, t + 0.01);
        g.gain.setValueAtTime(0.03, t + 0.16);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(lp);
        lp.connect(g);
        g.connect(ui);
        o.start(t);
        o.stop(t + 0.25);
      }
      break;
    }
    case 'tick':
      noiseHit(e, ui, t, { type: 'highpass', freq: 3500, dur: 0.02, gain: 0.08 });
      noiseHit(e, ui, t + 0.035, { type: 'bandpass', freq: 1400, q: 3, dur: 0.02, gain: 0.05 });
      break;
    case 'pause':
      noiseHit(e, ui, t, { type: 'lowpass', freq: 900, dur: 0.05, gain: 0.08 });
      break;
    case 'event':
      // Telégrafo: raya-punto-raya y un golpe grave
      drum(e, fx, t, { from: 90, to: 40, dur: 0.6, gain: 0.25, noise: 0.2 });
      [0, 0.14, 0.2, 0.34].forEach((dt, i) => beep(e, fx, t + 0.12 + dt, 81, i % 2 ? 0.02 : 0.03));
      break;
    case 'build':
      metal(e, fx, t, { freq: 520, gain: 0.05, decay: 0.8, pan: -0.2 });
      metal(e, fx, t + 0.22, { freq: 560, gain: 0.04, decay: 0.7, pan: -0.2 });
      noiseHit(e, fx, t, { type: 'bandpass', freq: 2500, dur: 0.05, gain: 0.05 });
      break;
    case 'recruit':
      // Botas en formación y una orden seca
      for (let i = 0; i < 4; i++) noiseHit(e, fx, t + i * 0.28, { type: 'lowpass', freq: 380, dur: 0.1, gain: 0.12, kind: 'brown', pan: i % 2 ? 0.2 : -0.2 });
      snare(e, fx, t + 1.1, 0.07);
      break;
    case 'move': {
      // Radio: chasquido, estática y confirmación
      noiseHit(e, fx, t, { type: 'bandpass', freq: 1800, q: 3, dur: 0.14, gain: 0.05 });
      beep(e, fx, t + 0.15, 84, 0.02);
      beep(e, fx, t + 0.22, 88, 0.02);
      break;
    }
    case 'battle':
      for (let i = 0; i < 6; i++) noiseHit(e, fx, t + i * rnd(0.05, 0.1), { type: 'bandpass', freq: rnd(900, 2000), q: 1.1, dur: 0.06, gain: rnd(0.04, 0.08), pan: rnd(-0.5, 0.5) });
      drum(e, fx, t + 0.3, { from: 80, to: 30, dur: 0.9, gain: 0.2, noise: 0.6 });
      break;
    case 'coin':
      bell(e, fx, 93, t, 0.03, { ratio: 1.41, index: 3, decay: 0.5, pan: 0.2 });
      bell(e, fx, 98, t + 0.06, 0.025, { ratio: 1.41, index: 3, decay: 0.6, pan: 0.2 });
      break;
    case 'alert':
      brass(e, fx, [50, 53], t, 0.35, 0.05);
      brass(e, fx, [49, 52], t + 0.4, 0.45, 0.05);
      break;
    case 'siren': {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(380, t);
      o.frequency.linearRampToValueAtTime(820, t + 0.9);
      o.frequency.linearRampToValueAtTime(420, t + 1.8);
      o.frequency.linearRampToValueAtTime(820, t + 2.7);
      o.frequency.linearRampToValueAtTime(380, t + 3.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.3);
      g.gain.setValueAtTime(0.05, t + 3.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.7);
      o.connect(g);
      g.connect(fx);
      g.connect(trim(e, e.sfx.verb, k));
      o.start(t);
      o.stop(t + 3.8);
      break;
    }
  }
}
