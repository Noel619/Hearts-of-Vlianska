// Efectos de sonido de la interfaz y del mundo, todos sintetizados. Los del
// mundo se colocan en el estéreo y se atenúan con la distancia a la cámara.
import type { AudioEngine } from './engine';
import { beep } from './ambience';
import { bell, brass, drum, metal, noiseHit } from './instruments';

export type Sfx =
  // Interfaz
  | 'click'
  | 'abrir'
  | 'cerrar'
  | 'error'
  | 'orden'
  | 'colocar'
  | 'aviso'
  | 'avisoMalo'
  | 'avisoHistoria'
  | 'moneda'
  | 'pausa'
  | 'nivel'
  // Combate
  | 'tiro'
  | 'escopeta'
  | 'tiroAire'
  | 'silbido'
  | 'impacto'
  | 'corte'
  | 'golpe'
  | 'parada'
  | 'caida'
  | 'muerte'
  | 'recarga'
  | 'grunido'
  | 'chillido'
  | 'rugido'
  // Trabajo y objetos
  | 'martillo'
  | 'pico'
  | 'chatarra'
  | 'coger'
  | 'soltar'
  | 'equipar'
  | 'comer'
  | 'venda'
  | 'cerradura'
  | 'hecho'
  | 'alarma'
  // Gas
  | 'tos'
  | 'filtro';

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Ganancia de cada efecto (medida con OfflineAudioContext para igualar niveles). */
export const SFX_LEVEL: Record<Sfx, number> = {
  click: 7.0,
  abrir: 3.4,
  cerrar: 9.5,
  error: 4.8,
  orden: 6.46,
  colocar: 1.23,
  aviso: 5.14,
  avisoMalo: 1.46,
  avisoHistoria: 1.21,
  moneda: 5.5,
  pausa: 12.0,
  nivel: 2.59,
  tiro: 2.35,
  escopeta: 1.51,
  tiroAire: 5.82,
  silbido: 7.44,
  impacto: 3.14,
  corte: 2.62,
  golpe: 1.53,
  parada: 3.22,
  caida: 0.95,
  muerte: 0.72,
  recarga: 2.96,
  grunido: 3.88,
  chillido: 7.5,
  rugido: 2.97,
  martillo: 2.74,
  pico: 7.2,
  chatarra: 2.72,
  coger: 12.38,
  soltar: 4.44,
  equipar: 5.33,
  comer: 7.26,
  venda: 5.54,
  cerradura: 3.46,
  hecho: 2.62,
  alarma: 2.3,
  tos: 2.5,
  filtro: 2.0,
};

const UI = new Set<Sfx>(['click', 'abrir', 'cerrar', 'error', 'orden', 'colocar', 'aviso', 'avisoMalo', 'avisoHistoria', 'moneda', 'pausa', 'nivel']);

export interface SfxPos {
  /** -1 izquierda … 1 derecha. */
  pan: number;
  /** Volumen por distancia (0..1). */
  gain: number;
}

/** Cadena de salida de un efecto: volumen, estéreo, bus y más reverberación cuanto más lejos. */
function output(e: AudioEngine, name: Sfx, pos?: SfxPos): AudioNode {
  const ctx = e.ctx;
  const g = ctx.createGain();
  const bus = UI.has(name) ? e.ui : e.sfx;
  const k = SFX_LEVEL[name] * (pos ? pos.gain : 1);
  g.gain.value = k;
  if (pos) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pos.pan));
    g.connect(p);
    p.connect(bus.in);
    // Lo lejano llega sobre todo como eco del túnel
    const send = ctx.createGain();
    send.gain.value = 0.25 + (1 - pos.gain) * 0.9;
    p.connect(send);
    send.connect(bus.verb);
  } else g.connect(bus.in);
  return g;
}

function tone(e: AudioEngine, dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, gain: number, attack = 0.004) {
  const ctx = e.ctx;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(dest);
  o.start(t);
  o.stop(t + dur + 0.03);
}

/** Voz animal: diente de sierra con formante que barre. */
function growl(e: AudioEngine, dest: AudioNode, t: number, f0: number, f1: number, dur: number, gain: number, formant: [number, number], rough = 30) {
  const ctx = e.ctx;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  // Aspereza: modulación rápida de la frecuencia
  const m = ctx.createOscillator();
  m.frequency.value = rough;
  const mg = ctx.createGain();
  mg.gain.value = f0 * 0.12;
  m.connect(mg);
  mg.connect(o.frequency);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(formant[0], t);
  f.frequency.linearRampToValueAtTime(formant[1], t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + Math.min(0.06, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f);
  f.connect(g);
  g.connect(dest);
  o.start(t);
  m.start(t);
  o.stop(t + dur + 0.05);
  m.stop(t + dur + 0.05);
}

export function playSfx(e: AudioEngine, name: Sfx, pos?: SfxPos) {
  const t = e.now + 0.005;
  const out = output(e, name, pos);
  switch (name) {
    // --- Interfaz -----------------------------------------------------------
    case 'click':
      // Interruptor metálico: chasquido y un tono corto
      noiseHit(e, out, t, { type: 'highpass', freq: 2600, dur: 0.025, gain: 0.09 });
      tone(e, out, t, 'triangle', 1500, 700, 0.05, 0.05, 0.002);
      break;
    case 'abrir':
      // Chapa metálica que se desliza
      noiseHit(e, out, t, { type: 'bandpass', freq: 500, sweepTo: 1700, q: 1.4, dur: 0.16, gain: 0.07, kind: 'pink' });
      metal(e, out, t + 0.13, { freq: 900, gain: 0.02, decay: 0.3 });
      break;
    case 'cerrar':
      noiseHit(e, out, t, { type: 'bandpass', freq: 1500, sweepTo: 450, q: 1.4, dur: 0.14, gain: 0.06, kind: 'pink' });
      noiseHit(e, out, t + 0.12, { type: 'lowpass', freq: 600, dur: 0.05, gain: 0.08 });
      break;
    case 'error':
      for (const f of [110, 117]) tone(e, out, t, 'square', f, f, 0.22, 0.03, 0.01);
      break;
    case 'orden':
      noiseHit(e, out, t, { type: 'highpass', freq: 1800, dur: 0.03, gain: 0.06 });
      beep(e, out, t + 0.01, 84, 0.018);
      break;
    case 'colocar':
      drum(e, out, t, { from: 120, to: 50, dur: 0.25, gain: 0.3, noise: 0.3 });
      metal(e, out, t + 0.02, { freq: 420, gain: 0.03, decay: 0.5 });
      break;
    case 'aviso':
      bell(e, out, 76, t, 0.03, { ratio: 2, index: 1, decay: 0.7 });
      break;
    case 'avisoMalo':
      brass(e, out, [50, 53], t, 0.35, 0.05);
      brass(e, out, [49, 52], t + 0.4, 0.5, 0.05);
      break;
    case 'avisoHistoria':
      // Telégrafo: raya-punto-raya y un golpe grave
      drum(e, out, t, { from: 90, to: 40, dur: 0.6, gain: 0.25, noise: 0.2 });
      [0, 0.14, 0.2, 0.34].forEach((dt, i) => beep(e, out, t + 0.12 + dt, 81, i % 2 ? 0.02 : 0.03));
      break;
    case 'moneda':
      // Cartuchos que caen en la mano
      for (let i = 0; i < 4; i++) bell(e, out, 92 + Math.floor(rnd(0, 8)), t + i * rnd(0.04, 0.07), 0.02, { ratio: 1.41, index: 3, decay: 0.25, pan: rnd(-0.2, 0.2) });
      break;
    case 'pausa':
      noiseHit(e, out, t, { type: 'lowpass', freq: 900, dur: 0.05, gain: 0.08 });
      break;
    case 'nivel':
      bell(e, out, 79, t, 0.035, { ratio: 2, index: 1, decay: 0.8 });
      bell(e, out, 86, t + 0.09, 0.03, { ratio: 2, index: 1, decay: 1.1 });
      break;
    // --- Combate ------------------------------------------------------------
    case 'tiro':
      // Chasquido seco, cuerpo grave y cola
      noiseHit(e, out, t, { type: 'highpass', freq: 1400, dur: 0.035, gain: 0.5 });
      drum(e, out, t, { from: 190, to: 50, dur: 0.18, gain: 0.5, noise: 0.5 });
      noiseHit(e, out, t + 0.02, { type: 'bandpass', freq: 800, sweepTo: 300, q: 0.7, dur: 0.35, gain: 0.12, kind: 'pink' });
      break;
    case 'escopeta':
      noiseHit(e, out, t, { type: 'lowpass', freq: 2400, dur: 0.07, gain: 0.6 });
      drum(e, out, t, { from: 140, to: 34, dur: 0.4, gain: 0.7, noise: 0.7 });
      noiseHit(e, out, t + 0.03, { type: 'bandpass', freq: 500, sweepTo: 180, q: 0.6, dur: 0.6, gain: 0.16, kind: 'brown' });
      break;
    case 'tiroAire':
      // Fusil neumático: soplido y un «ping» del depósito
      noiseHit(e, out, t, { type: 'bandpass', freq: 2600, sweepTo: 900, q: 1.2, dur: 0.12, gain: 0.3 });
      metal(e, out, t + 0.01, { freq: 1300, gain: 0.03, decay: 0.25 });
      break;
    case 'silbido':
      noiseHit(e, out, t, { type: 'bandpass', freq: 5200, sweepTo: 1800, q: 9, dur: 0.16, gain: 0.25 });
      break;
    case 'impacto':
      noiseHit(e, out, t, { type: 'lowpass', freq: 700, dur: 0.06, gain: 0.4, kind: 'brown' });
      drum(e, out, t, { from: 110, to: 60, dur: 0.1, gain: 0.25, noise: 0.2 });
      break;
    case 'corte':
      noiseHit(e, out, t, { type: 'bandpass', freq: 4200, sweepTo: 1500, q: 2.5, dur: 0.09, gain: 0.2 });
      noiseHit(e, out, t + 0.05, { type: 'lowpass', freq: 900, dur: 0.07, gain: 0.3, kind: 'pink' });
      break;
    case 'golpe':
      drum(e, out, t, { from: 130, to: 55, dur: 0.14, gain: 0.5, noise: 0.25 });
      noiseHit(e, out, t, { type: 'lowpass', freq: 500, dur: 0.05, gain: 0.25, kind: 'brown' });
      break;
    case 'parada':
      metal(e, out, t, { freq: rnd(700, 1100), gain: 0.08, decay: 0.35 });
      noiseHit(e, out, t, { type: 'highpass', freq: 3000, dur: 0.03, gain: 0.12 });
      break;
    case 'caida':
      drum(e, out, t, { from: 90, to: 38, dur: 0.3, gain: 0.5, noise: 0.3 });
      noiseHit(e, out, t + 0.04, { type: 'bandpass', freq: 900, q: 0.8, dur: 0.18, gain: 0.08, kind: 'pink' });
      break;
    case 'muerte':
      drum(e, out, t, { from: 70, to: 30, dur: 0.9, gain: 0.5, noise: 0.15 });
      tone(e, out, t + 0.02, 'sine', 196, 98, 1.1, 0.06, 0.05);
      break;
    case 'recarga':
      metal(e, out, t, { freq: 1500, gain: 0.03, decay: 0.08 });
      noiseHit(e, out, t, { type: 'highpass', freq: 2200, dur: 0.02, gain: 0.1 });
      metal(e, out, t + 0.16, { freq: 1100, gain: 0.04, decay: 0.1 });
      noiseHit(e, out, t + 0.16, { type: 'bandpass', freq: 1600, q: 2, dur: 0.035, gain: 0.12 });
      break;
    case 'grunido':
      // Skrebun: gruñido grave y rasposo
      growl(e, out, t, rnd(85, 110), rnd(55, 70), rnd(0.35, 0.55), 0.3, [500, 300], 34);
      break;
    case 'chillido':
      // Rata: chillido corto y agudo
      growl(e, out, t, rnd(1400, 1900), rnd(900, 1200), rnd(0.09, 0.16), 0.12, [2600, 1800], 70);
      break;
    case 'rugido':
      // Algo grande
      growl(e, out, t, rnd(60, 75), 38, 1.2, 0.4, [420, 180], 22);
      noiseHit(e, out, t, { type: 'lowpass', freq: 300, dur: 1.0, gain: 0.2, kind: 'brown' });
      break;
    // --- Trabajo y objetos ----------------------------------------------------
    case 'martillo':
      metal(e, out, t, { freq: rnd(480, 620), gain: 0.06, decay: 0.3 });
      noiseHit(e, out, t, { type: 'bandpass', freq: 2500, dur: 0.03, gain: 0.08 });
      break;
    case 'pico':
      noiseHit(e, out, t, { type: 'bandpass', freq: rnd(1800, 2600), q: 3, dur: 0.03, gain: 0.25 });
      for (let i = 0; i < 3; i++) noiseHit(e, out, t + 0.06 + i * rnd(0.04, 0.08), { type: 'lowpass', freq: 800, dur: 0.04, gain: 0.07, kind: 'brown' });
      break;
    case 'chatarra':
      for (let i = 0; i < 4; i++) metal(e, out, t + i * rnd(0.05, 0.1), { freq: rnd(300, 900), gain: 0.03, decay: rnd(0.15, 0.4), pan: rnd(-0.2, 0.2) });
      break;
    case 'coger':
      noiseHit(e, out, t, { type: 'bandpass', freq: 1800, sweepTo: 2600, q: 0.8, dur: 0.07, gain: 0.07, kind: 'pink' });
      break;
    case 'soltar':
      noiseHit(e, out, t, { type: 'lowpass', freq: 420, dur: 0.07, gain: 0.25, kind: 'brown' });
      break;
    case 'equipar':
      noiseHit(e, out, t, { type: 'bandpass', freq: 1200, sweepTo: 2800, q: 1.5, dur: 0.09, gain: 0.08, kind: 'pink' });
      metal(e, out, t + 0.08, { freq: 1700, gain: 0.015, decay: 0.08 });
      break;
    case 'comer':
      for (let i = 0; i < 3; i++) noiseHit(e, out, t + i * 0.16, { type: 'bandpass', freq: rnd(900, 1500), q: 1.8, dur: 0.05, gain: 0.07, kind: 'pink' });
      break;
    case 'venda':
      noiseHit(e, out, t, { type: 'bandpass', freq: 2400, sweepTo: 3600, q: 1.2, dur: 0.22, gain: 0.06 });
      break;
    case 'cerradura':
      metal(e, out, t, { freq: 2100, gain: 0.02, decay: 0.06 });
      metal(e, out, t + 0.12, { freq: 1500, gain: 0.03, decay: 0.1 });
      noiseHit(e, out, t + 0.22, { type: 'bandpass', freq: 400, sweepTo: 700, q: 5, dur: 0.3, gain: 0.05, kind: 'pink' });
      break;
    case 'hecho':
      bell(e, out, 81, t, 0.03, { ratio: 2, index: 1, decay: 0.6 });
      bell(e, out, 88, t + 0.1, 0.025, { ratio: 2, index: 1, decay: 0.8 });
      break;
    case 'alarma': {
      // Sirena de manivela
      const ctx = e.ctx;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(300, t);
      o.frequency.linearRampToValueAtTime(760, t + 1.1);
      o.frequency.linearRampToValueAtTime(420, t + 2.2);
      o.frequency.linearRampToValueAtTime(760, t + 3.1);
      o.frequency.linearRampToValueAtTime(300, t + 4.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.4);
      g.gain.setValueAtTime(0.05, t + 3.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.3);
      o.connect(lp);
      lp.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + 4.4);
      break;
    }
    // --- Gas --------------------------------------------------------------------
    case 'tos': {
      // Una, dos o tres toses roncas: soplo de garganta con un poco de voz
      const n = 1 + Math.floor(rnd(0, 2.6));
      let at = t;
      for (let i = 0; i < n; i++) {
        const k = 1 - i * 0.22;
        noiseHit(e, out, at, { type: 'bandpass', freq: rnd(700, 950), sweepTo: rnd(420, 520), q: 1.6, dur: rnd(0.1, 0.15), gain: 0.32 * k, kind: 'pink' });
        noiseHit(e, out, at, { type: 'lowpass', freq: 380, dur: 0.07, gain: 0.18 * k, kind: 'brown' });
        tone(e, out, at + 0.005, 'triangle', rnd(150, 190), rnd(105, 125), 0.09, 0.035 * k, 0.006);
        at += rnd(0.2, 0.3);
      }
      break;
    }
    case 'filtro':
      // Se desenrosca el filtro gastado y se enrosca el nuevo: chasquidos y un soplo
      metal(e, out, t, { freq: 1900, gain: 0.025, decay: 0.05 });
      noiseHit(e, out, t + 0.06, { type: 'highpass', freq: 2800, dur: 0.22, gain: 0.05 });
      metal(e, out, t + 0.3, { freq: 1500, gain: 0.03, decay: 0.07 });
      noiseHit(e, out, t + 0.3, { type: 'bandpass', freq: 1300, q: 2, dur: 0.03, gain: 0.1 });
      break;
  }
}
