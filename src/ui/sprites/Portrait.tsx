// Retratos: un busto dibujado a partir del aspecto (`Look`) de cada
// personaje, con su piel, pelo, barba, sombrero, máscara y ropa. Es el
// mismo dato que usa el modelo 3D, así que retrato y personaje coinciden.

import { memo, useMemo } from 'react';
import type { Look } from '../../data/looks';
import { C, Cf, E, Ef, F, K, P, R, Rf, S, star } from './draw';

const h2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
/** Color numérico → hex, multiplicado por k. */
function col(n: number, k = 1): string {
  return '#' + h2(((n >> 16) & 255) * k) + h2(((n >> 8) & 255) * k) + h2((n & 255) * k);
}
function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
function rnd(seed: number, i: number): number {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const HEAD = 'M20 26 Q20 11.6 32 11.6 Q44 11.6 44 26 Q44 35.6 38.6 40.6 Q32 45 25.4 40.6 Q20 35.6 20 26 Z';
const HEAD_F = 'M20.6 26 Q20.6 12 32 12 Q43.4 12 43.4 26 Q43.4 34.6 37.6 40.4 Q32 44.4 26.4 40.4 Q20.6 34.6 20.6 26 Z';

export function portraitSvg(l: Look): string {
  const o: string[] = [];
  const skin = l.skin;
  const hairN = l.age === 2 ? mix(l.hairColor, 0x9a9a96, 0.75) : l.hairColor;
  const hair = col(hairN);
  const hairD = col(hairN, 0.7);
  const top = l.topColor;
  const masked = l.mask === 'antigas' || l.hat === 'pasamontanas';
  const fem = l.female;
  const head = fem ? HEAD_F : HEAD;
  const j = (i: number) => rnd(l.seed, i) - 0.5;
  const wide = 1 + l.build * 0.08;

  // --- Detrás de la cabeza ----------------------------------------------------
  if (l.backpack !== undefined) {
    o.push(P('M8 44 H56 Q60 44 60 48.6 Q60 53 56 53 H8 Q4 53 4 48.6 Q4 44 8 44 Z', '#6c6a5c'));
    o.push(F('M8 45 H56 V46.8 H8 Z', '#908e80'));
    o.push(S('M14 44 V53 M50 44 V53', col(l.backpack, 0.6), 2));
  }
  if (l.hat === 'capucha') o.push(P('M15 44 Q12 8 32 7 Q52 8 49 44 Z', col(l.hatColor, 0.75)));
  if (!masked && l.hair === 'largo' && l.hat !== 'capucha') {
    o.push(P('M18 24 Q16 40 19 52 H45 Q48 40 46 24 Q44 14 32 14 Q20 14 18 24 Z', hairD));
    o.push(S('M21 30 Q20 42 22 50 M43 30 Q44 42 42 50', hair, 1.2, 0.8));
  }
  if (!masked && l.hair === 'mono' && l.hat === 'nada') o.push(C(32, 9.6, 5, hair));

  // --- Torso ------------------------------------------------------------------
  const sx = (x: number) => (32 + (x - 32) * wide).toFixed(1);
  o.push(P(`M${sx(1)} 66 Q${sx(3)} 53 ${sx(15)} 50 L25 45.4 H39 L${sx(49)} 50 Q${sx(61)} 53 ${sx(63)} 66 Z`, col(top)));
  o.push(F(`M${sx(3.4)} 64 Q${sx(5)} 54.6 ${sx(15.6)} 51.4 L22 48.6 Q12 53 10 64 Z`, col(top, 1.28), 0.8));
  o.push(F(`M54 64 Q53 55 44 50.4 L${sx(49)} 51 Q${sx(59.6)} 54 ${sx(61)} 64 Z`, col(top, 0.68), 0.8));
  switch (l.top) {
    case 'guerrera':
      o.push(P('M24.6 44 H39.4 L40 50 H24 Z', col(top, 0.82), 1.3));
      o.push(S('M32 50 V64', K, 1.2));
      o.push(Cf(32, 54, 1.1, '#c8a84a') + Cf(32, 59.6, 1.1, '#c8a84a'));
      o.push(S('M24 49.6 L28.6 52 M40 49.6 L35.4 52', col(top, 0.6), 1.2));
      break;
    case 'chaqueton':
      o.push(S('M12 56 Q32 61 52 56 M9 62 Q32 67 55 62', col(top, 0.68), 1.3));
      o.push(P('M24 45.4 L32 54 L40 45.4 L43 49 L32 60 L21 49 Z', col(top, 1.2), 1.3));
      o.push(S('M32 54 V64', K, 1.2));
      break;
    case 'abrigo':
    case 'cuero':
      o.push(P('M25 45.4 L32 56 L39 45.4 L46 49.6 L37 62 H27 L18 49.6 Z', col(top, l.top === 'cuero' ? 1.35 : 1.2), 1.3));
      o.push(F('M27.6 47 L32 54.6 L36.4 47 Z', col(mix(top, 0x8a8272, 0.7))));
      o.push(S('M32 56 V64', K, 1.2));
      break;
    case 'traje':
      o.push(P('M26 45.4 L32 60 L38 45.4 Z', '#d8d4c8', 1.2));
      o.push(P('M30.4 47 H33.6 L34.6 56 L32 59.6 L29.4 56 Z', '#6e1712', 1));
      o.push(P('M25 45.4 L32 60 L26 64 L18.6 50 Z M39 45.4 L32 60 L38 64 L45.4 50 Z', col(top, 1.3), 1.3));
      break;
    case 'tunica':
      o.push(S('M24.6 46 Q32 54 39.4 46', col(top, 0.66), 2));
      o.push(S('M32 52 V64', col(top, 0.76), 1.2));
      break;
    case 'harapos':
      o.push(S('M24.6 46 Q30 52 34 49 Q37 51.6 39.4 46', col(top, 0.6), 1.6));
      o.push(S('M14 56 l5 3 M44 60 l5 -3 M24 61 l3 3', col(top, 0.55), 1.3));
      o.push(F('M41 53 l5 1 l-2 5 Z', col(skin, 0.9), 0.9));
      break;
    case 'mono':
      o.push(S('M32 47 V64', K, 1.4));
      o.push(P('M25 45.4 L32 52 L39 45.4 L41 48.4 L32 56 L23 48.4 Z', col(top, 0.8), 1.2));
      o.push(R(38, 55, 8, 6, col(top, 0.8), 0.6, 1));
      break;
    default:
      // Camisa abierta
      o.push(P('M25 45.4 L32 55 L39 45.4 L42 48 L32 58.6 L22 48 Z', col(top, 1.22), 1.2));
      o.push(F('M28 47 L32 53 L36 47 Z', col(skin, 0.86)));
      break;
  }
  if (l.vest !== undefined) {
    const v = l.vest;
    o.push(P('M18 50.4 L26 46.6 L32 57 L38 46.6 L46 50.4 L48 66 H16 Z', col(v), 1.4));
    o.push(F('M18.6 51.4 L25.6 48 L27.6 51.6 L20 55 Z', col(v, 1.35), 0.8));
    if (l.vestPlates) {
      o.push(R(20, 55.4, 10.6, 9, '#5a636a', 0.6, 1.1) + R(33.4, 55.4, 10.6, 9, '#5a636a', 0.6, 1.1));
      o.push(Cf(21.6, 57, 0.8, K) + Cf(29, 57, 0.8, K) + Cf(35, 57, 0.8, K) + Cf(42.4, 57, 0.8, K));
    } else if (l.pouches) {
      o.push(R(20, 57, 9, 7, col(v, 0.72), 0.8, 1.1) + R(35, 57, 9, 7, col(v, 0.72), 0.8, 1.1));
      o.push(S('M20 59.6 H29 M35 59.6 H44', col(v, 1.3), 1));
    }
  }
  if (l.bandolier) {
    o.push(P('M40 46 L46 49 L22 66 H14 Z', '#3a2616', 1.2));
    for (let i = 0; i < 4; i++) o.push(R(36.6 - i * 5.6, 49.6 + i * 4, 2.6, 5, '#c8a84a', 0.4, 0.8));
  }
  if (l.backpack !== undefined) o.push(S('M19.6 50 L22 64 M44.4 50 L42 64', K, 4.2) + S('M19.6 50 L22 64 M44.4 50 L42 64', col(l.backpack, 0.7), 2.4));
  if (l.shoulderPads !== undefined) {
    const c = col(mix(l.shoulderPads, 0x2a2a2a, 0.2));
    o.push(P('M3 60 Q3 49 14 48 L21 50 Q20 57 15 61 Z', c) + P('M61 60 Q61 49 50 48 L43 50 Q44 57 49 61 Z', c));
    o.push(S('M7 54 l5 5 M11 51 l5 6 M57 54 l-5 5 M53 51 l-5 6', '#5e6265', 1.2));
  }
  if (l.medals) {
    o.push(R(38, 53.6, 3, 4.6, '#c8a84a', 0.4, 0.8) + R(42, 53.6, 3, 4.6, '#a8281f', 0.4, 0.8) + R(46, 53.6, 3, 4.6, '#c8a84a', 0.4, 0.8));
    o.push(Cf(39.5, 59.6, 1.5, '#e8cc7a') + Cf(43.5, 59.6, 1.5, '#e8cc7a') + Cf(47.5, 59.6, 1.5, '#cfd5d9'));
  }
  if (l.armband !== undefined) o.push(P('M52.6 52 L59.4 54.4 L60.6 60 L53.6 57.6 Z', col(l.armband), 1.1));

  // --- Cuello y bufanda -------------------------------------------------------------
  o.push(P('M26 36 V46.4 Q32 50.6 38 46.4 V36 Z', col(masked && l.hat === 'pasamontanas' ? l.hatColor : skin, 0.78), 1.3));
  if (l.scarf !== undefined && l.mask !== 'panuelo') {
    o.push(P('M22.6 43 Q32 48.6 41.4 43 L43.6 49.4 Q32 56 20.4 49.4 Z', col(l.scarf)));
    o.push(S('M24 46.6 Q32 51.6 40 46.6', col(l.scarf, 0.66), 1.2));
    o.push(P('M35 51 L41 49.6 L42.6 60 L37 61 Z', col(l.scarf, 0.86), 1.2));
  }

  // --- Cabeza -------------------------------------------------------------------------
  const faceN = l.mask === 'antigas' ? 0x5a5e60 : l.hat === 'pasamontanas' ? l.hatColor : skin;
  const face = col(faceN);
  if (!masked) o.push(E(19.8, 28, 2.4, 3.6, col(skin, 0.9), 1.2) + E(44.2, 28, 2.4, 3.6, col(skin, 0.78), 1.2));
  o.push(P(head, face));
  o.push(F('M38 15 Q43 20 42.6 27 Q42.6 34.6 37.6 39.6 Q34 42.4 32 42.6 Q38 38 39 30 Q40 22 38 15 Z', col(faceN, 0.76), 0.75));
  o.push(F('M22 24 Q22 15 30 13.4 Q25 17 24.6 25 Q24.4 30 26 34 Q22 30 22 24 Z', col(faceN, 1.14), 0.7));

  const eyeY = 27 + j(1) * 0.8;
  const eyeX = 5.4 + j(2) * 0.6;
  if (!masked) {
    if (l.facial === 'barba3') o.push(F('M21.6 31 Q24 40 32 43.4 Q40 40 42.4 31 Q40 36 32 36.6 Q24 36 21.6 31 Z', hair, 0.3));
    // Cejas, ojos, nariz y boca
    const brow = l.age === 2 ? 0.6 : j(3) * 1.2;
    o.push(S(`M${32 - eyeX - 3} ${eyeY - 3.6 + brow} Q${32 - eyeX} ${eyeY - 5} ${32 - eyeX + 3} ${eyeY - 3.8} M${32 + eyeX - 3} ${eyeY - 3.8} Q${32 + eyeX} ${eyeY - 5} ${32 + eyeX + 3} ${eyeY - 3.6 + brow}`, hairD, fem ? 1.2 : 1.7));
    o.push(Ef(32 - eyeX, eyeY, 2.4, 1.5, '#f2ede0') + Ef(32 + eyeX, eyeY, 2.4, 1.5, '#f2ede0'));
    o.push(Cf(32 - eyeX + 0.3, eyeY + 0.1, 1.25, '#1c140e') + Cf(32 + eyeX + 0.3, eyeY + 0.1, 1.25, '#1c140e'));
    o.push(S(`M${32 - eyeX - 2.6} ${eyeY - 1} Q${32 - eyeX} ${eyeY - 2.4} ${32 - eyeX + 2.6} ${eyeY - 1} M${32 + eyeX - 2.6} ${eyeY - 1} Q${32 + eyeX} ${eyeY - 2.4} ${32 + eyeX + 2.6} ${eyeY - 1}`, K, fem ? 1.3 : 0.9));
    o.push(S(`M32.4 ${eyeY + 1} L30.4 ${eyeY + 6.4} Q32 ${eyeY + 7.6} 34 ${eyeY + 6.4}`, col(skin, 0.6), 1.3));
    const my = 37 + j(4) * 0.6;
    if (fem) o.push(P(`M28.6 ${my} Q32 ${my - 1.4} 35.4 ${my} Q32 ${my + 2.2} 28.6 ${my} Z`, '#9a4a44', 0.8));
    else o.push(S(`M28.4 ${my} Q32 ${my + 1 + j(5) * 1.4} 35.6 ${my}`, col(skin, 0.5), 1.4));
    if (l.age === 2) o.push(S(`M23.6 ${eyeY + 3} q2 1 3.6 0.4 M36.8 ${eyeY + 3.4} q2 0.6 3.6 -0.4 M27 21.6 h10 M26 ${my + 0.6} q-1.4 -2.6 -0.4 -5 M38 ${my + 0.6} q1.4 -2.6 0.4 -5`, col(skin, 0.62), 0.9, 0.9));
    if (l.scar) o.push(S('M38.6 23 L41 34', '#8a2c26', 1.3) + S('M38 26 l3 -0.6 M38.6 30 l3 -0.6', '#8a2c26', 0.9));
    // Vello facial
    if (l.mask !== 'respirador' && l.mask !== 'panuelo') {
      if (l.facial === 'barba' || l.facial === 'barbaLarga') {
        const long = l.facial === 'barbaLarga';
        o.push(P(`M20.6 29 Q21 39 26 ${long ? 46 : 42.6} Q32 ${long ? 53 : 47} 38 ${long ? 46 : 42.6} Q43 39 43.4 29 Q41 34.6 36.4 35.4 Q32 34 27.6 35.4 Q23 34.6 20.6 29 Z`, hair, 1.3));
        o.push(S(`M26 39 q1 3 0.4 5 M32 39.6 v${long ? 9 : 5} M38 39 q-1 3 -0.4 5`, hairD, 1, 0.8));
        o.push(S(`M29.4 ${my + 0.4} Q32 ${my + 1.4} 34.6 ${my + 0.4}`, col(skin, 0.5), 1.2));
      }
      if (l.facial === 'bigote' || l.facial === 'barba' || l.facial === 'barbaLarga') o.push(P(`M26.4 ${my - 1} Q29 ${my - 3.6} 32 ${my - 2.2} Q35 ${my - 3.6} 37.6 ${my - 1} Q35 ${my - 0.4} 32 ${my - 0.8} Q29 ${my - 0.4} 26.4 ${my - 1} Z`, hair, 1));
    }
    if (l.eyepatch) {
      o.push(S(`M20.4 ${eyeY - 6} L43.6 ${eyeY - 1}`, K, 1.6));
      o.push(P(`M${32 + eyeX - 3.6} ${eyeY - 2.6} H${32 + eyeX + 3.6} Q${32 + eyeX + 4} ${eyeY + 3.6} ${32 + eyeX} ${eyeY + 3.8} Q${32 + eyeX - 4} ${eyeY + 3.6} ${32 + eyeX - 3.6} ${eyeY - 2.6} Z`, '#141414', 1));
    }
    if (l.glasses && l.mask === 'nada') {
      o.push(S(`M${32 - eyeX - 3.6} ${eyeY - 2.6} h7.2 v4.8 q-3.6 1.6 -7.2 0 Z M${32 + eyeX - 3.6} ${eyeY - 2.6} h7.2 v4.8 q-3.6 1.6 -7.2 0 Z M${32 - eyeX + 3.6} ${eyeY - 1} h${eyeX * 2 - 7.2} M20.4 ${eyeY - 1.6} h${11.6 - eyeX - 3.6} M${32 + eyeX + 3.6} ${eyeY - 1.6} H43.6`, K, 1.3));
      o.push(F(`M${32 - eyeX - 3} ${eyeY - 2} h2.4 l-2 3.4 Z M${32 + eyeX - 3} ${eyeY - 2} h2.4 l-2 3.4 Z`, '#fff', 0.5));
    }
    // Pelo
    const covered = l.hat !== 'nada' && l.hat !== 'panuelo' && l.hat !== 'boina' && l.hat !== 'kufi';
    if (l.hair === 'rapado') o.push(F('M20.4 24 Q20 11.6 32 11.6 Q44 11.6 43.6 24 Q42 16.6 32 16 Q22 16.6 20.4 24 Z', hair, 0.42));
    else if (l.hair !== 'calvo') {
      if (!covered) {
        const part = j(6) * 5;
        o.push(P(`M19.6 26.4 Q18 10 32 9.6 Q46 10 44.4 26.4 Q43.4 19.6 39 17.6 Q${33 + part} 16.4 ${28 + part} 18.6 Q22 19 19.6 26.4 Z`, hair));
        o.push(S(`M23 15.6 Q28 11.6 34 12 M27 17 Q32 14 38 15`, col(hairN, 1.4), 1, 0.7));
        if (fem && l.hair !== 'largo') o.push(P('M19.6 26 Q18.4 32 20 36 Q22 30 22 22 Z M44.4 26 Q45.6 32 44 36 Q42 30 42 22 Z', hair, 1.1));
      } else o.push(F('M20 27.6 Q20.6 23 22.6 21.6 V29 Z M44 27.6 Q43.4 23 41.4 21.6 V29 Z', hair));
      if (l.hair === 'largo' && l.hat !== 'capucha') o.push(P('M19.4 24 Q17 34 19.6 46 Q23 42 22.6 30 Z M44.6 24 Q47 34 44.4 46 Q41 42 41.4 30 Z', hair, 1.2));
    }
  } else if (l.hat === 'pasamontanas') {
    // Abertura de los ojos
    o.push(P('M22.4 25.6 Q32 21.6 41.6 25.6 Q41.6 31 32 31.6 Q22.4 31 22.4 25.6 Z', col(skin), 1.2));
    o.push(Ef(27, 27, 2.2, 1.4, '#f2ede0') + Ef(37, 27, 2.2, 1.4, '#f2ede0') + Cf(27.2, 27.1, 1.15, '#1c140e') + Cf(37.2, 27.1, 1.15, '#1c140e'));
    o.push(S('M24 24.6 Q27 23.4 30 24.6 M34 24.6 Q37 23.4 40 24.6', '#2a1c12', 1.2));
    o.push(S('M25 41 v3 M28.4 42 v3.4 M32 42.6 v3.4 M35.6 42 v3.4 M39 41 v3', col(l.hatColor, 2.2), 0.9, 0.7));
  }

  // --- Máscaras -----------------------------------------------------------------------
  if (l.mask === 'antigas') {
    o.push(S('M24 14.6 Q32 11.6 40 14.6', '#3a3e40', 1.1));
    o.push(C(26, 26.4, 5.4, '#5a636a', 1.4) + C(38, 26.4, 5.4, '#5a636a', 1.4));
    o.push(Cf(26, 26.4, 3.7, '#3f6a74') + Cf(38, 26.4, 3.7, '#3f6a74'));
    o.push(F('M23 25.6 Q23.6 23.2 26 23 Q24.6 24.2 24.6 26 Z M35 25.6 Q35.6 23.2 38 23 Q36.6 24.2 36.6 26 Z', '#c4e6ea'));
    o.push(E(32, 39, 7, 6.4, '#646a42') + E(32, 39, 4.4, 4, '#42472c', 1));
    o.push(Cf(32, 39, 0.9, K) + Cf(30, 37.6, 0.8, K) + Cf(34, 37.6, 0.8, K) + Cf(30, 40.6, 0.8, K) + Cf(34, 40.6, 0.8, K));
  } else if (l.mask === 'respirador') {
    o.push(S('M20.4 30 L26 33 M43.6 30 L38 33', K, 2.8) + S('M20.4 30 L26 33 M43.6 30 L38 33', '#4a4c4e', 1.3));
    o.push(P('M25 31 Q32 27.6 39 31 Q41 38 37.6 42 Q32 45.6 26.4 42 Q23 38 25 31 Z', '#484b4e'));
    o.push(C(22.4, 38.6, 4.6, '#646a42', 1.3) + C(41.6, 38.6, 4.6, '#646a42', 1.3) + Cf(22.4, 38.6, 2.2, '#42472c') + Cf(41.6, 38.6, 2.2, '#42472c'));
    o.push(C(32, 37.6, 3, '#2a2c2e', 1.1) + S('M30.4 37 h3.2 M30.4 38.6 h3.2', '#74797e', 0.8));
  } else if (l.mask === 'gafas') {
    o.push(Rf(20, 24, 24, 3.4, '#2a2018'));
    o.push(R(21.6, 22.6, 9, 7, '#5a3a14', 2.6, 1.3) + R(33.4, 22.6, 9, 7, '#5a3a14', 2.6, 1.3));
    o.push(F('M23 24 h3 l-2.4 3.6 Z M34.8 24 h3 l-2.4 3.6 Z', '#ffd88a', 0.7));
  } else if (l.mask === 'panuelo') {
    const c = l.scarf ?? 0x40342a;
    o.push(P('M19.6 30 Q32 27 44.4 30 Q44.6 40 39 46 Q32 51.6 25 46 Q19.4 40 19.6 30 Z', col(c)));
    o.push(F('M37.6 31 Q42.6 31.6 43 34 Q42.6 40 38.6 44.6 Q40.6 38 37.6 31 Z', col(c, 0.68), 0.8));
    o.push(S('M22 34 Q32 31.6 42 34 M24 39 Q32 37 40 39', col(c, 0.7), 1));
  }

  // --- Sombreros ----------------------------------------------------------------------
  const hc = l.hatColor;
  switch (l.hat) {
    case 'gorra':
      o.push(P('M19 22.6 Q18 8.6 32 8.6 Q46 8.6 45 22.6 Q32 18.6 19 22.6 Z', col(hc)));
      o.push(F('M21 20 Q21 11.6 30 10 Q24.6 13 24 20 Z', col(hc, 1.4), 0.8));
      o.push(P('M17 22.4 Q32 16.6 47 22.4 Q46 26 41 25 Q32 22 23 25 Q18 26 17 22.4 Z', col(hc, 0.66), 1.3));
      break;
    case 'plato':
      o.push(P('M13 13 Q32 2.6 51 13 Q52 17.6 45 18.6 H19 Q12 17.6 13 13 Z', col(hc)));
      o.push(F('M15 13.4 Q32 4.6 49 13.4 Q32 8 15 13.4 Z', col(hc, 1.4), 0.9));
      o.push(P('M19.4 18.6 H44.6 V23.6 Q32 20.6 19.4 23.6 Z', col(hc, 0.6), 1.3));
      o.push(P('M18.6 23.4 Q32 19.6 45.4 23.4 Q44.6 27 40 26 Q32 23.6 24 26 Q19.4 27 18.6 23.4 Z', '#141414', 1.2));
      o.push(P(star(32, 17.6, 3.6, 1.5), '#c8a84a', 0.9));
      break;
    case 'ushanka':
      o.push(P('M16.6 24 Q13.6 34 18 40 Q22.6 37 22 26 Z M47.4 24 Q50.4 34 46 40 Q41.4 37 42 26 Z', col(hc, 0.82)));
      o.push(P('M18 24 Q17 7.6 32 7.6 Q47 7.6 46 24 Z', col(hc)));
      o.push(P('M17 21 Q32 14.6 47 21 V27 Q32 21.6 17 27 Z', col(hc, 1.3)));
      o.push(S('M21 23.4 l1 2.4 M25.6 21.6 l1 2.4 M38.4 21.6 l-1 2.4 M43 23.4 l-1 2.4', col(hc, 0.6), 1));
      o.push(P(star(32, 21.4, 3.2, 1.3), '#a8281f', 0.9));
      break;
    case 'boina':
      o.push(P('M17.6 20.6 Q14 9 30 8 Q48 7 49.6 16 Q50 21 44.6 21.6 Q32 17.6 17.6 20.6 Z', col(hc)));
      o.push(F('M19.6 17 Q19 11 30 9.6 Q23 13 22.6 18.6 Z', col(hc, 1.45), 0.8));
      o.push(S('M18.6 21 Q32 17.6 45 22', col(hc, 0.55), 2));
      o.push(Cf(31, 8, 1.2, col(hc, 0.6)));
      break;
    case 'casco':
      o.push(P('M16.6 24 Q15.6 6.6 32 6.6 Q48.4 6.6 47.4 24 Q32 19.6 16.6 24 Z', col(hc)));
      o.push(F('M19 21 Q19 10 29.6 8.6 Q23 12 22.6 21 Z', col(hc, 1.45), 0.8));
      o.push(P('M15.6 23 Q32 18 48.4 23 V26.4 Q32 21.6 15.6 26.4 Z', col(hc, 0.66), 1.3));
      o.push(S('M21.6 26 Q20.4 36 27 42.6 M42.4 26 Q43.6 36 37 42.6', K, 2.6) + S('M21.6 26 Q20.4 36 27 42.6 M42.4 26 Q43.6 36 37 42.6', '#6e4a2a', 1.2));
      break;
    case 'panuelo':
      o.push(P('M19.4 23.6 Q18 9.6 32 9.6 Q46 9.6 44.6 23.6 Q32 18.6 19.4 23.6 Z', col(hc)));
      o.push(S('M22 17 Q32 12.6 42 17', col(hc, 0.66), 1.1));
      o.push(P('M44 20 L50 18 L49 23.6 L52.6 27 L46 26.6 Z', col(hc, 0.86), 1.2));
      break;
    case 'kufi':
      o.push(P('M20.4 20 Q20 9.6 32 9.6 Q44 9.6 43.6 20 Q32 16.6 20.4 20 Z', col(hc)));
      o.push(S('M21 16.6 Q32 13 43 16.6', col(hc, 0.72), 1.1));
      break;
    case 'capucha':
      o.push(P('M17.4 40 Q13 9 32 8 Q51 9 46.6 40 Q46 26 41.4 19.6 Q32 14.6 22.6 19.6 Q18 26 17.4 40 Z', col(hc)));
      o.push(F('M19 34 Q16.6 12.6 29.6 10 Q21 15 20.6 26 Z', col(hc, 1.4), 0.75));
      break;
    default:
      break;
  }
  return o.join('');
}

const cache = new Map<string, string>();

/** Retrato de un personaje. `dim` lo apaga (muerto o inconsciente). */
export const Portrait = memo(function Portrait({ look, size = 40, dim = false }: { look: Look; size?: number; dim?: boolean }) {
  const html = useMemo(() => {
    const key = JSON.stringify(look);
    let s = cache.get(key);
    if (!s) {
      s = portraitSvg(look);
      if (cache.size > 400) cache.clear();
      cache.set(key, s);
    }
    return s;
  }, [look]);
  return <svg className={'portrait' + (dim ? ' dim' : '')} width={size} height={size} viewBox="2 4 60 60" aria-hidden dangerouslySetInnerHTML={{ __html: html }} />;
});
