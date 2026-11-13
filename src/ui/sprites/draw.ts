// Utensilios de dibujo de los sprites: cada sprite es un trozo de SVG en una
// cuadrícula de 64 × 64, con contorno oscuro y sombreado plano a dos o tres
// tonos (la luz viene de arriba a la izquierda).

/** Color del contorno. */
export const K = '#0e0c0a';

const op = (o: number) => (o < 1 ? ` opacity="${o}"` : '');

/** Forma con contorno. */
export const P = (d: string, fill: string, w = 1.5) => `<path d="${d}" fill="${fill}" fill-rule="evenodd" stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
/** Forma sin contorno (luces, sombras y detalles). */
export const F = (d: string, fill: string, o = 1) => `<path d="${d}" fill="${fill}" fill-rule="evenodd"${op(o)}/>`;
/** Trazo. */
export const S = (d: string, color: string, w = 1.5, o = 1) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${op(o)}/>`;
/** Tubo o correa: trazo de color con su contorno. */
export const T = (d: string, color: string, w: number) => S(d, K, w + 2.6) + S(d, color, w);
/** Círculo con contorno. */
export const C = (x: number, y: number, r: number, fill: string, w = 1.5) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${K}" stroke-width="${w}"/>`;
/** Círculo sin contorno. */
export const Cf = (x: number, y: number, r: number, fill: string, o = 1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${op(o)}/>`;
/** Elipse con contorno. */
export const E = (x: number, y: number, rx: number, ry: number, fill: string, w = 1.5) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${K}" stroke-width="${w}"/>`;
/** Elipse sin contorno. */
export const Ef = (x: number, y: number, rx: number, ry: number, fill: string, o = 1) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${op(o)}/>`;
/** Rectángulo con contorno. */
export const R = (x: number, y: number, w: number, h: number, fill: string, rx = 0, sw = 1.5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${K}" stroke-width="${sw}" stroke-linejoin="round"/>`;
/** Rectángulo sin contorno. */
export const Rf = (x: number, y: number, w: number, h: number, fill: string, o = 1, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"${op(o)}/>`;
/** Grupo transformado. */
export const G = (transform: string, ...parts: string[]) => `<g transform="${transform}">${parts.join('')}</g>`;
/** Sombra de contacto en el suelo. */
export const shadow = (x = 32, y = 55, rx = 20, ry = 4) => Ef(x, y, rx, ry, '#000', 0.38);
/** Las armas se dibujan tumbadas y se giran en diagonal. */
export const diag = (deg: number, ...parts: string[]) => G(`rotate(${deg} 32 32)`, ...parts);

/** Estrella de n puntas. */
export function star(cx: number, cy: number, ro: number, ri: number, n = 5): string {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    d += `${i ? 'L' : 'M'}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return d + 'Z';
}

/** Rueda dentada con su agujero. */
export function gear(cx: number, cy: number, r: number, teeth: number, hole: number): string {
  let d = '';
  const n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const k = i % 4;
    const rr = k < 2 ? r : r * 0.78;
    const a = ((i - 0.5) / n) * Math.PI * 2;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`;
  }
  d += 'Z';
  // Agujero (sentido contrario para la regla par-impar)
  d += `M${cx + hole} ${cy}A${hole} ${hole} 0 1 0 ${cx - hole} ${cy}A${hole} ${hole} 0 1 0 ${cx + hole} ${cy}Z`;
  return d;
}

// --- Paleta: claro, medio, oscuro (y muy oscuro) -----------------------------
export const ST = { l: '#cfd5d9', m: '#939ca3', d: '#5a636a', k: '#363c42' };
export const IR = { l: '#8f979f', m: '#5d656d', d: '#3b4148', k: '#22262a' };
export const WD = { l: '#c8965c', m: '#9b6a3a', d: '#6a4424', k: '#472c15' };
export const WG = { l: '#a59c8a', m: '#7b7363', d: '#544e42', k: '#3a352c' };
export const RU = { l: '#c4743e', m: '#96502a', d: '#66331a', k: '#40200f' };
export const BR = { l: '#f2d480', m: '#c29a3e', d: '#7d5e22', k: '#4f3a12' };
export const CU = { l: '#e6a070', m: '#b86c3c', d: '#7c4222', k: '#4e2812' };
export const OL = { l: '#8a905c', m: '#646a42', d: '#42472c', k: '#2a2e1c' };
export const CV = { l: '#cdbf96', m: '#a3946a', d: '#73674a', k: '#4c4430' };
export const LE = { l: '#9a6c42', m: '#6e4a2a', d: '#462d18', k: '#2c1b0d' };
export const RD = { l: '#dc4c40', m: '#a8281f', d: '#6e1712', k: '#430d0a' };
export const WH = { l: '#f6f3ea', m: '#d8d3c4', d: '#a39e90', k: '#6f6b60' };
export const BK = { l: '#5e6265', m: '#34373a', d: '#1e2022', k: '#0e0f10' };
export const GL = { l: '#c4e6ea', m: '#7fb0b8', d: '#3f6a74', k: '#234048' };
export const PA = { l: '#efe6c8', m: '#d6caa4', d: '#a39672', k: '#6e6448' };
