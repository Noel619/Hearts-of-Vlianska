// Emblemas de facción: insignia de metal esmaltado con el símbolo de cada
// una (los mismos símbolos del juego original de estrategia).

import { memo } from 'react';
import { FACTION_LORE } from '../../data/historia/facciones';
import type { SideId } from '../../data/tipos';
import { star } from './draw';

interface Glyph {
  fill?: string;
  strokes?: [string, number, ('butt' | 'round')?][];
}

const GLYPHS: Record<string, Glyph> = {
  UNI: { fill: star(50, 53, 31, 13) },
  SDR: {
    strokes: [
      ['M50 80 V22', 7.5],
      ['M29 24 V41 Q29 60 50 60 Q71 60 71 41 V24', 7.5],
      ['M40 71 H60', 6.5],
      ['M29 24 L25 31 M71 24 L75 31 M50 22 L46 29 M50 22 L54 29', 4],
    ],
  },
  LEV: {
    strokes: [
      ['M61 25 A25 25 0 1 1 28 51', 7.5],
      ['M35 65 L24 76', 8.5],
      ['M42 42 L67 69', 6.5],
      ['M31 46 L48 29', 11, 'butt'],
    ],
  },
  STA: { fill: 'M45.5 18 H55.5 V84 H45.5 Z M21 40 H80 V50 H21 Z' },
  VHL: {
    strokes: [
      ['M77 51 A27 27 0 1 1 76.99 50.2', 6.5],
      ['M32 80 L50 18 L68 80', 7],
      ['M24 58 H76', 6.5],
    ],
  },
  CHE: {
    fill: 'M82.5 77 A5.5 5.5 0 1 1 71.5 77 A5.5 5.5 0 1 1 82.5 77 Z M28.5 77 A5.5 5.5 0 1 1 17.5 77 A5.5 5.5 0 1 1 28.5 77 Z',
    strokes: [
      ['M28 24 L72 70', 7.5],
      ['M72 24 L28 70', 7.5],
      ['M63 71 L79 57', 6.5],
      ['M37 71 L21 57', 6.5],
    ],
  },
  CAL: {
    fill: star(50, 30, 7, 3),
    strokes: [
      ['M23 69 A27 27 0 0 1 77 69', 9.5],
      ['M37 69 A13 13 0 0 1 63 69', 6.5],
      ['M18 78 H82', 5.5],
    ],
  },
  NOR: {
    strokes: [
      ['M77 50 A27 27 0 1 1 76.99 49.2', 6.5],
      ['M39 27 V73 M50 22 V78 M61 27 V73', 6.5],
    ],
  },
  JUG: { strokes: [['M27 32 L50 74 L73 32', 10]] },
  LIB: { strokes: [['M50 24 V76 M30 40 L50 24 L70 40', 8]] },
  MUT: { strokes: [['M30 24 Q36 50 28 76 M50 20 Q56 50 48 80 M70 24 Q76 50 68 76', 8]] },
};

function glyph(gl: Glyph, color: string, extra = 0): string {
  let s = '';
  if (gl.fill) s += `<path d="${gl.fill}" fill="${color}" stroke="${color}" stroke-width="${extra}" stroke-linejoin="round"/>`;
  for (const [d, w, cap] of gl.strokes ?? []) s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w + extra}" stroke-linecap="${cap ?? 'round'}" stroke-linejoin="round"/>`;
  return s;
}

export function sideEmblemColor(side: SideId, playerColor = '#d8c27a'): [string, string] {
  if (side === 'JUG') return [playerColor, '#5a4a22'];
  if (side === 'LIB') return ['#7a756a', '#3a372f'];
  if (side === 'MUT') return ['#7a2a22', '#3a100c'];
  return [FACTION_LORE[side].color, FACTION_LORE[side].colorDark];
}

/** Insignia redonda de una facción (o de tu escuadra, la gente libre o las criaturas). */
export const Emblem = memo(function Emblem({ side, size = 40, playerColor }: { side: SideId; size?: number; playerColor?: string }) {
  const [c, dark] = sideEmblemColor(side, playerColor);
  const gl = GLYPHS[side] ?? GLYPHS.LIB;
  const gid = `emb-${side}-${c.replace('#', '')}`;
  const html =
    `<defs><radialGradient id="${gid}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${c}"/><stop offset="0.6" stop-color="${c}"/><stop offset="1" stop-color="${dark}"/></radialGradient>` +
    `<linearGradient id="${gid}-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4ecd2"/><stop offset="0.35" stop-color="#b09a62"/><stop offset="0.6" stop-color="#5e4e2a"/><stop offset="0.8" stop-color="#cdb878"/><stop offset="1" stop-color="#4a3c1e"/></linearGradient></defs>` +
    `<circle cx="50" cy="52" r="47" fill="#000" opacity="0.45"/>` +
    `<circle cx="50" cy="50" r="47" fill="url(#${gid}-m)" stroke="#0e0c0a" stroke-width="2.4"/>` +
    `<circle cx="50" cy="50" r="39.6" fill="url(#${gid})" stroke="#0e0c0a" stroke-width="2"/>` +
    `<path d="M14 50 A36 36 0 0 0 86 50 A40 30 0 0 1 14 50 Z" fill="#000" opacity="0.22"/>` +
    `<g transform="translate(50 51) scale(0.72) translate(-50 -50)"><g transform="translate(1.2 2.6)">${glyph(gl, 'rgba(0,0,0,0.6)', 2)}</g>${glyph(gl, '#f3ead2')}</g>` +
    `<ellipse cx="42" cy="29" rx="25" ry="13" fill="#fff" opacity="0.16" transform="rotate(-18 42 29)"/>` +
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<circle cx="${50 + 43.4 * Math.cos((i + 0.5) * 0.7854)}" cy="${50 + 43.4 * Math.sin((i + 0.5) * 0.7854)}" r="1.9" fill="#2a2212"/>`).join('');
  return <svg className="emblem-spr" width={size} height={size} viewBox="0 0 100 100" aria-hidden dangerouslySetInnerHTML={{ __html: html }} />;
});
