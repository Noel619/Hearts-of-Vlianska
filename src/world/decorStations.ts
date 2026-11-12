// Decoración de las estaciones: cada una es un asentamiento con su programa
// (qué bloques levanta y dónde), sus hitos y sus defensas en las bocas de túnel.

import type { FactionId } from '../data/tipos';
import { DecorCtx } from './decorCore';
import { BLOCKS, SlotCtx, St, type Band } from './decorStationKit';
import type { LRect, Port, StationFrame } from './layout';

// ---------------------------------------------------------------------------
// Programas
// ---------------------------------------------------------------------------

/**
 * Bloques obligatorios (por orden de prioridad) y de relleno. Sintaxis:
 *   [m/|s/|p/|n/]nombre[:arg[:arg2]][@posición]
 * m/ andén principal, s/ andén lateral, p/ lado +v, n/ lado -v; la posición
 * va de -1 (extremo A) a 1 (extremo B).
 */
interface Program {
  must: string[];
  fill: string[];
  fillSide?: string[];
  fillPos?: string[];
  /** Alumbrado del andén. */
  lamp?: 'farola' | 'bidon' | 'poca';
}

const PROGRAMS: Record<string, Program> = {
  SEV: {
    must: ['hidro@-0.8', 'hidro@-0.6', 'puesto:ropa@-0.3', 'puesto:libros@-0.2', 'cocina@0', 'puesto:comida@0.1', 'plaza@0.2', 'bar@0.4', 'hospital@0.6', 'taller:chatarrero@0.8', 'cuartel@0.95', 'almacen@-0.9', 'radio@-0.45'],
    fill: ['tiendas', 'barracon', 'hoguera', 'tiendas', 'dormitorio', 'almacen'],
  },
  UBE: {
    must: ['hospital:nor_sidorov@0', 'hospital@0.14', 'hospital@-0.14', 'mando:lebedeva@-0.4', 'puesto:medico@0.3', 'puesto:comida@0.4', 'puesto:bazar@0.5', 'puesto:ropa@-0.6', 'bar@0.7', 'cocina@-0.7', 'plaza:estatua@0.2', 'cuartel@0.95', 'cuartel@-0.95', 'granja@-0.8', 'taller@0.85', 'radio@-0.5'],
    fill: ['tiendas', 'hoguera', 'barracon', 'tiendas', 'dormitorio', 'almacen'],
  },
  IND: {
    must: ['fundicion@-0.8', 'taller:armas@-0.55', 'taller:chatarrero@-0.65', 'taller:armas@-0.35', 'taller@-0.15', 'almacen@-0.9', 'almacen@0', 'puesto:bazar@0.1', 'puesto:comida@0.2', 'cocina@0.3', 'bar@0.45', 'plaza@0.55', 'cuartel@0.65', 'hospital@0.8', 'cuartel@0.95'],
    fill: ['barracon', 'barracon', 'tiendas', 'hoguera', 'almacen', 'taller'],
  },
  RUB: {
    must: ['mando:sdr_kravets@0', 'cuartel@-0.8', 'cuartel@0.8', 'armeria@0.2', 'cuartel@-0.5', 'cuartel@0.5', 'puesto:armas@-0.2', 'cocina@0.1', 'bar@-0.3', 'hospital@0.35', 'almacen@-0.1', 'puesto:comida@0.3'],
    fill: ['tiendas', 'almacen', 'hoguera', 'barracon'],
  },
  KHO: {
    must: ['mitin:sdr_popova@0', 'mando:bessmertny@-0.14', 'cuartel@-0.92', 'cuartel@0.92', 'armeria@-0.75', 'puesto:comida@0.2', 'puesto:ropa@0.26', 'puesto:armas@0.34', 'puesto:bazar@0.46', 'bar@0.6', 'cocina@-0.55', 'hospital@-0.65', 'plaza:estatua@0.14', 'taller@0.75', 'granja@-0.3', 'radio@-0.22'],
    fill: ['tiendas', 'barracon', 'hoguera', 'tiendas', 'almacen', 'dormitorio'],
  },
  STA: {
    must: [
      's/mando:orlova@0',
      'm/figura:sta_fedorova:caravana@0',
      's/cuartel:sta_markov@-0.5',
      's/brigada@0.5',
      's/brigada@0.7',
      's/santuario:sta_lazarev@-0.75',
      'm/puesto:comida@-0.8',
      'm/puesto:bazar@-0.6',
      'm/puesto:armas@-0.45',
      'm/puesto:ropa@-0.3',
      'm/puesto:chatarrero@-0.15',
      'm/puesto:medico@0.15',
      'm/puesto:libros@0.3',
      'm/puesto:comida@0.45',
      'm/puesto:bazar@0.6',
      'm/puesto:negro@0.8',
      'm/puesto:armas@0.9',
      's/bar@-0.2',
      's/bar@0.25',
      's/cocina@0.1',
      's/hospital@-0.35',
      's/almacen@-0.9',
      's/almacen@0.9',
      'm/plaza@0.05',
    ],
    fill: ['puesto:bazar', 'puesto:comida', 'plaza', 'puesto:ropa'],
    fillSide: ['tiendas', 'barracon', 'almacen', 'hoguera', 'dormitorio'],
  },
  TSE: {
    must: [
      's/mando:volkov@0',
      'p/comisaria:uni_gromov@-0.3',
      'n/correos@0.3',
      'm/figura:uni_ivanova:bazar@-0.2',
      'm/puesto:comida@-0.7',
      'm/puesto:bazar@-0.55',
      'm/puesto:ropa@-0.4',
      'm/puesto:armas@-0.3',
      'm/puesto:medico@0.2',
      'm/puesto:libros@0.3',
      'm/puesto:chatarrero@0.42',
      'm/puesto:comida@0.55',
      'm/puesto:armas@0.7',
      'm/puesto:bazar@0.85',
      'm/puesto:ropa@0.95',
      'm/plaza:estatua@-0.85',
      's/bar@-0.6',
      's/bar@0.6',
      's/hospital@0.8',
      's/cuartel@-0.92',
      's/cuartel@0.95',
      's/cocina@-0.15',
      's/taller@0.45',
      's/radio@0.12',
      's/plaza@-0.45',
    ],
    fill: ['puesto:bazar', 'puesto:comida', 'plaza', 'hoguera'],
    fillSide: ['tiendas', 'barracon', 'tiendas', 'dormitorio', 'almacen', 'hoguera'],
  },
  VHL: {
    must: ['trono:rybak@0', 'figura:vhl_lisa:negro@0.3', 'guarida@0.12', 'bar@-0.3', 'jaulas@0.5', 'santuario:vhl_monje@-0.8', 'hoguera@-0.55', 'hoguera@0.75', 'taller:armas@-0.95', 'almacen@0.95'],
    fill: ['barracon', 'tiendas', 'hoguera', 'almacen', 'dormitorio'],
    lamp: 'bidon',
  },
  RAS: {
    must: [
      'p/granja@-0.9',
      'p/granja@-0.65',
      'p/granja@-0.4',
      'p/granja@-0.15',
      'p/granja@0.1',
      'p/granja@0.35',
      'p/granja@0.6',
      'p/corral@0.85',
      'n/mando:voronina@0',
      'n/cocina@0.2',
      'n/puesto:comida@0.35',
      'n/puesto:bazar@0.5',
      'n/bar@-0.3',
      'n/cuartel@0.9',
      'n/hospital@-0.6',
      'n/almacen@-0.85',
      'n/taller@0.7',
    ],
    fill: ['tiendas', 'barracon', 'hoguera', 'dormitorio', 'almacen'],
    fillPos: ['granja', 'granja', 'corral'],
  },
  STL: {
    must: ['asamblea:morozov@0', 'mitin:lev_belov@0.2', 'figura:lev_smirnov@-0.2', 'puesto:libros@-0.33', 'cocina@0.35', 'puesto:comida@0.5', 'puesto:ropa@0.6', 'puesto:bazar@-0.5', 'cuartel@-0.92', 'cuartel@0.92', 'armeria@-0.75', 'hospital@0.75', 'taller:armas@-0.62', 'bar@0.45', 'plaza:estatua@0.1', 'granja@-0.45', 'radio@0.28'],
    fill: ['tiendas', 'barracon', 'hoguera', 'tiendas', 'dormitorio', 'almacen'],
  },
  VYS: {
    must: ['cuartel@0.9', 'cuartel@0.7', 'armeria@0.55', 'cuartel@0.4', 'mando@0.2', 'hospital@0', 'cocina@-0.2', 'puesto:comida@-0.4', 'puesto:armas@-0.5', 'bar@-0.6', 'almacen@0.1', 'plaza@-0.3'],
    fill: ['tiendas', 'hoguera', 'barracon', 'almacen'],
    lamp: 'poca',
  },
  MER: {
    must: ['mando:baghdadi:cal_harbi@-0.35', 'mezquita:karimov@0.35', 'figura:cal_aliyev:negro@0.6', 'puesto:comida@0.5', 'cocina@0.2', 'cuartel@-0.8', 'granja@0.8', 'corral@0.92', 'hospital@-0.6'],
    fill: ['tiendas', 'hoguera', 'dormitorio', 'almacen'],
    lamp: 'poca',
  },
  ZVE: {
    must: ['conferencia:uni_kuznetsov:yefimova@0', 'puesto:comida@-0.4', 'puesto:ropa@-0.3', 'puesto:bazar@0.3', 'puesto:libros@0.4', 'bar@0.55', 'plaza:estatua@-0.15', 'cuartel@0.92', 'cuartel@-0.92', 'hospital@-0.6', 'cocina@0.2', 'taller@0.7', 'granja@-0.75'],
    fill: ['tiendas', 'barracon', 'hoguera', 'tiendas', 'almacen', 'dormitorio'],
  },
  MOS: {
    must: ['fundicion@0', 'taller:chatarrero@0.2', 'taller:armas@-0.2', 'cuartel@0.9', 'armeria@0.75', 'cuartel@0.6', 'puesto:comida@-0.4', 'puesto:armas@-0.5', 'bar@-0.6', 'cocina@-0.3', 'almacen@0.4', 'hospital@0.5'],
    fill: ['tiendas', 'barracon', 'hoguera', 'almacen'],
  },
  CHE: {
    must: ['cuartel@0.7', 'cuartel@0.45', 'taller@0.3', 'figura:che_minin@0.2', 'plaza:sokolova@-0.2', 'puesto:comida@-0.3', 'cocina@-0.1', 'hospital@0.1', 'granja@-0.6', 'granja@-0.75', 'corral@-0.9', 'bar@-0.45', 'almacen@0.85'],
    fill: ['tiendas', 'dormitorio', 'hoguera', 'barracon', 'dormitorio'],
    lamp: 'poca',
  },
};

interface Entry {
  name: string;
  arg: string;
  arg2: string;
  at: number | null;
  where: 'm' | 's' | 'p' | 'n' | null;
}

function parseEntry(src: string): Entry {
  let s = src;
  let where: Entry['where'] = null;
  if (s[1] === '/') {
    where = s[0] as Entry['where'];
    s = s.slice(2);
  }
  let at: number | null = null;
  const k = s.indexOf('@');
  if (k >= 0) {
    at = parseFloat(s.slice(k + 1));
    s = s.slice(0, k);
  }
  const [name, arg = '', arg2 = ''] = s.split(':');
  if (!BLOCKS[name]) throw new Error(`Bloque desconocido: ${src}`);
  return { name, arg, arg2, at, where };
}

// ---------------------------------------------------------------------------
// Andenes: pasillos, bandas y huecos
// ---------------------------------------------------------------------------

interface BandX extends Band {
  /** Tramos que deben quedar libres (escaleras, pasarelas, hitos). */
  gaps: [number, number][];
  /** Límites aprovechables. */
  a: number;
  b: number;
}

interface Slot {
  band: BandX;
  uc: number;
  W: number;
  D: number;
  used: string;
}

const AISLE = 1.4;
const SIDE_AISLE = 1.9;

function makeBands(st: St): BandX[] {
  const f = st.f;
  const bands: BandX[] = [];
  const openA = f.plan.throatA !== 0;
  const openB = f.plan.throatB !== 0;
  const add = (P: LRect, v0: number, dv: 1 | -1, D: number, kind: Band['kind']) => {
    bands.push({ u0: P.u0, u1: P.u1, v0, dv, D, kind, gaps: [], a: P.u0 + (openA ? 2.7 : 0.5), b: P.u1 - (openB ? 2.7 : 0.5) });
  };
  // Pasillos de cabecera: de las rampas al resto del andén
  for (const P of f.platforms) {
    if (openA) st.reserve(P.u0, P.u0 + 2.4, P.v0, P.v1);
    if (openB) st.reserve(P.u1 - 2.4, P.u1, P.v0, P.v1);
  }
  if (f.plan.kind === 'isla') {
    const P = f.platforms[0];
    st.reserve(P.u0, P.u1, -AISLE, AISLE);
    for (const dv of [1, -1] as const) add(P, dv * AISLE, dv, P.v1 - 3.25, 'main');
  } else if (f.plan.kind === 'doble') {
    const C = f.platforms[0];
    st.reserve(C.u0, C.u1, -AISLE, AISLE);
    for (const dv of [1, -1] as const) add(C, dv * AISLE, dv, C.v1 - 3.25, 'main');
    const P = f.platforms[1];
    const so = P.v0;
    for (const dv of [1, -1] as const) {
      st.reserve(P.u0, P.u1, dv * (so + 1.7), dv * (so + 1.7 + SIDE_AISLE));
      add(P, dv * (so + 1.8 + SIDE_AISLE), dv, f.hw - so - 2.2 - SIDE_AISLE, 'side');
    }
  } else {
    const P = f.platforms[0];
    const lw = P.v0;
    for (const dv of [1, -1] as const) {
      st.reserve(P.u0, P.u1, dv * (lw + 1.7), dv * (lw + 1.7 + SIDE_AISLE));
      add(P, dv * (lw + 1.8 + SIDE_AISLE), dv, f.hw - lw - 2.2 - SIDE_AISLE, 'main');
    }
  }
  // Pasillos transversales hacia escaleras y pasarelas
  const cross = (uc: number, sign: number, half: number) => {
    for (const b of bands) {
      if (b.kind !== 'main' || b.dv !== sign || f.plan.kind === 'lateral') continue;
      b.gaps.push([uc - half - 0.2, uc + half + 0.2]);
      st.reserve(uc - half, uc + half, 0, sign * (Math.abs(b.v0) + b.D + 2));
    }
  };
  for (const r of f.ramps) {
    if (r.kind !== 'escalera') continue;
    cross((r.u0 + r.u1) / 2, Math.sign(r.v0 + r.v1), 1.3);
  }
  for (const d of f.decks) cross((d.u0 + d.u1) / 2, Math.sign(d.v0 + d.v1), 1.8);
  return bands;
}

function makeSlots(st: St, bands: BandX[]): Slot[] {
  const slots: Slot[] = [];
  for (const b of bands) {
    // Los hitos que pisan la banda abren un hueco
    const vA = Math.min(b.v0, b.v0 + b.dv * b.D);
    const vB = Math.max(b.v0, b.v0 + b.dv * b.D);
    const gaps = [...b.gaps];
    for (const r of st.blocked) if (r.v1 > vA && r.v0 < vB) gaps.push([r.u0 - 0.3, r.u1 + 0.3]);
    gaps.sort((p, q) => p[0] - q[0]);
    let cur = b.a;
    const intervals: [number, number][] = [];
    for (const [g0, g1] of gaps) {
      if (g0 > cur) intervals.push([cur, Math.min(g0, b.b)]);
      cur = Math.max(cur, g1);
    }
    if (cur < b.b) intervals.push([cur, b.b]);
    for (const [i0, i1] of intervals) {
      const L = i1 - i0;
      if (L < 4.2) continue;
      let n = Math.max(1, Math.round(L / 7.4));
      if (L / n > 10.4) n++;
      const W = L / n;
      for (let i = 0; i < n; i++) slots.push({ band: b, uc: i0 + W * (i + 0.5), W, D: b.D, used: '' });
    }
  }
  return slots;
}

function layoutBands(st: St, bands: BandX[], prog: Program) {
  const slots = makeSlots(st, bands);
  const P = st.f.platforms[0];
  const mid = (P.u0 + P.u1) / 2;
  const half = (P.u1 - P.u0) / 2;
  const matches = (s: Slot, where: Entry['where']) =>
    where === null || (where === 'm' && s.band.kind === 'main') || (where === 's' && s.band.kind === 'side') || (where === 'p' && s.band.dv > 0) || (where === 'n' && s.band.dv < 0);
  const run = (s: Slot, i: number, e: Entry) => {
    s.used = e.name;
    BLOCKS[e.name].fn(new SlotCtx(st, s.band, s.uc, s.W - 0.3, s.D, i), e.arg, e.arg2);
  };
  // Obligatorios: al hueco libre más cercano a su sitio
  for (const src of prog.must) {
    const e = parseEntry(src);
    const def = BLOCKS[e.name];
    let best = -1;
    let bestScore = Infinity;
    slots.forEach((s, i) => {
      if (s.used || !matches(s, e.where) || s.D < def.minD || s.W - 0.3 < def.minW) return;
      const score = e.at === null ? st.rng.next() * 100 : Math.abs(s.uc - (mid + e.at * half)) + st.rng.next() * 1.5;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0) run(slots[best], best, e);
  }
  // Relleno
  let k = 0;
  slots.forEach((s, i) => {
    if (s.used) return;
    const list = s.band.kind === 'side' && prog.fillSide ? prog.fillSide : s.band.dv > 0 && prog.fillPos ? prog.fillPos : prog.fill;
    for (let tries = 0; tries < list.length * 2; tries++) {
      const e = parseEntry(list[k++ % list.length]);
      const def = BLOCKS[e.name];
      if (s.D < def.minD || s.W - 0.3 < def.minW) continue;
      if (i > 0 && slots[i - 1].band === s.band && slots[i - 1].used === e.name && tries < list.length) continue;
      run(s, i, e);
      break;
    }
  });
  // Alumbrado: postes en las esquinas de los bloques, al borde del pasillo
  const mode = prog.lamp ?? 'farola';
  let n = 0;
  let prev: Slot | null = null;
  for (const s of slots) {
    const first = !prev || prev.band !== s.band || Math.abs(prev.uc + prev.W / 2 - (s.uc - s.W / 2)) > 0.5;
    const b = s.band;
    const place = (u: number) => {
      const v = b.v0 + b.dv * 0.3;
      n++;
      if (mode === 'bidon') {
        if (n % 2 === 0) st.put('bidonFuego', u, b.v0 + b.dv * 0.5, 0, -b.dv, { aisle: true });
      } else if (mode === 'poca') {
        if (n % 3 === 0) st.put('farola', u, v, 0, -b.dv, { aisle: true });
        else if (n % 3 === 1) st.put('bidonFuego', u, b.v0 + b.dv * 0.5, 0, -b.dv, { aisle: true });
      } else if (n % 2 === 0 || b.kind === 'side') st.put('farola', u, v, 0, -b.dv, { aisle: true });
    };
    if (first) place(s.uc - s.W / 2 + 0.2);
    place(s.uc + s.W / 2 - 0.2);
    prev = s;
  }
}

// ---------------------------------------------------------------------------
// Estructura común: pilares, topes y vagones
// ---------------------------------------------------------------------------

function structure(st: St) {
  const f = st.f;
  const variant = f.id === 'TSE' || f.id === 'ZVE' || f.id === 'STL' || f.id === 'KHO' ? 1 : f.id === 'MOS' || f.id === 'IND' ? 2 : 0;
  // Las escaleras y pasarelas quedan despejadas
  const clear: [number, number][] = [];
  for (const r of f.ramps) if (r.kind === 'escalera') clear.push([(r.u0 + r.u1) / 2, (r.v0 + r.v1) / 2]);
  for (const d of f.decks) {
    clear.push([(d.u0 + d.u1) / 2, d.v0]);
    clear.push([(d.u0 + d.u1) / 2, d.v1]);
  }
  for (const p of f.platforms) {
    const len = p.u1 - p.u0;
    const n = Math.max(2, Math.round(len / 9));
    for (let i = 0; i < n; i++) {
      const u = p.u0 + (len * (i + 0.5)) / n;
      for (const v of [p.v0 + 1.1, p.v1 - 1.1]) {
        if (Math.abs(v) > f.hw - 1.6) continue; // pegado al muro: sin pilar
        if (clear.some(([cu, cv]) => Math.abs(cu - u) < 1.9 && Math.abs(cv - v) < 4)) continue;
        st.put('pilar', u, v, 1, 0, { variant, tint: st.tint });
      }
    }
  }
  // Topes al final de las vías ciegas
  for (const lane of f.lanes) {
    for (const [u, closed] of [
      [lane.u0, f.plan.throatA === 0],
      [lane.u1, f.plan.throatB === 0],
    ] as [number, boolean][]) {
      if (!closed) continue;
      for (const tv of lane.tracks) st.putX('tope', u + (u < 0 ? 1.6 : -1.6), tv, 1, 0, { aisle: true });
    }
  }
}

/** Vagones varados en las vías ciegas, convertidos en viviendas. */
function wagons(st: St, lanes: number[], variant: number) {
  const f = st.f;
  const closedA = f.plan.throatA === 0;
  for (const li of lanes) {
    const lane = f.lanes[Math.min(li, f.lanes.length - 1)];
    const tv = lane.tracks[li % lane.tracks.length];
    const sgn = closedA ? 1 : -1;
    const start = (closedA ? lane.u0 : lane.u1) + sgn * 13.5;
    for (let k = 0; k < 7; k++) {
      const u = start + sgn * k * 3;
      if (st.putX('vagon', u, tv, 1, 0, { variant, aisle: true, tint: st.tint })) {
        st.spot('ocio', u - 5.1, tv + (tv >= 0 ? -1 : 1) * 2.2, 0, tv >= 0 ? 1 : -1);
        break;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Bocas de túnel
// ---------------------------------------------------------------------------

/** Bocas que dan a un frente o a túneles de los que nadie se fía. */
const FRONTS: Record<string, string[] | 'all'> = { RUB: 'all', VYS: ['MER'], MER: ['VYS'], MOS: ['S1'], CHE: ['S2'], KHO: ['VHL'], STA: ['VHL'], SEV: ['UBE'], UBE: ['W2'], STL: ['W3'] };

function ports(st: St) {
  const f = st.f;
  const owner = st.owner;
  for (const port of f.ports) {
    // Marco de la boca: hacia dentro (i) y a lo ancho (l)
    const iu = port.wall === 'end' ? (port.end === 'A' ? 1 : -1) : 0;
    const iv = port.wall === 'L' ? 1 : port.wall === 'R' ? -1 : 0;
    const lu = -iv;
    const lv = iu;
    const half = port.width / 2;
    const at = (din: number, lat: number): [number, number] => [port.u + iu * din + lu * lat, port.v + iv * din + lv * lat];
    const variant = port.width >= 9 ? 1 : port.width <= 4.5 ? 2 : 0;
    const [gu, gv] = at(0.9, 0);
    if (!owner) {
      // Tenevskaya: los portones siguen ahí, nadie los cierra
      st.put('portal', gu, gv, iu, iv, { variant, tint: 0x5a564e, aisle: true });
      continue;
    }
    const narrow = port.width <= 4.5;
    st.put(narrow ? 'portal' : 'portonEstacion', gu, gv, iu, iv, { variant, tint: st.tint, aisle: true });
    const fronts = FRONTS[f.id];
    const front = fronts === 'all' || (fronts?.includes(port.other) ?? false);
    if (owner === 'VHL') {
      // La Hermandad no monta guardia: advierte
      for (const s of [-1, 1]) {
        const [pu, pv] = at(3.2, s * (half + 1.3));
        st.put('picas', pu, pv, -iu, -iv, { variant: s > 0 ? 1 : 0 });
      }
      const [bu, bv] = at(6.5, half + 2.2);
      st.put('bidonFuego', bu, bv, -iu, -iv);
      const [q1u, q1v] = at(6.2, half + 0.9);
      st.spot('guardia', q1u, q1v, -iu, -iv);
      const [q2u, q2v] = at(5.6, -(half + 1.4));
      st.spot('guardia', q2u, q2v, -iu, -iv);
      continue;
    }
    // Parapetos y centinelas a ambos lados de la vía
    for (const s of [-1, 1]) {
      const [su, sv] = at(4.2, s * (half + 1.7));
      st.put(front ? 'sacosAlto' : 'sacos', su, sv, -iu, -iv);
      const [qu, qv] = at(5.5, s * (half + 1.5));
      st.spot('guardia', qu, qv, -iu, -iv, s > 0 && (front || port.width >= 9) ? 'oficial' : undefined);
    }
    const [bu, bv] = at(7.4, half + 2.7);
    st.put('bidonFuego', bu, bv, -iu, -iv);
    if (!narrow) {
      const [fu, fv] = at(3.0, -(half + 1.3));
      st.put('foco', fu, fv, -iu, -iv);
    }
    if (owner === 'STA') {
      // Cinco túneles, cinco peajes
      const [pu, pv] = at(9.0, half + 2.9);
      if (st.put('peaje', pu, pv, -lu, -lv, { tint: st.tint })) {
        const [cu, cv] = at(9.0, half + 1.3);
        st.spot('peaje', cu, cv, -lu, -lv, 'oficial');
        const [ru, rv] = at(6.6, half + 0.6);
        st.put('barrera', ru, rv, -iu, -iv, { aisle: true });
      }
    }
    if (front) {
      const [mu, mv] = at(8.2, -(half + 2.5));
      st.put('nidoMG', mu, mv, -iu, -iv);
      const [nu, nv] = at(8.6, -(half + 1.0));
      st.spot('guardia', nu, nv, -iu, -iv, 'elite');
      for (const s of [-1, 1]) {
        const [au, av] = at(2.0, s * (half + 2.4));
        st.put('alambrada', au, av, -iu, -iv);
        const [eu, ev] = at(3.1 + (s > 0 ? 0.6 : 0), s * (half + 4.4));
        st.put('erizo', eu, ev, -iu, -iv);
        const [wu, wv] = at(6.3, s * (half + 4.6));
        st.put('muroHormigon', wu, wv, -iu, -iv, { variant: s > 0 ? 1 : 0, tint: st.tint });
      }
      const [tu, tv] = at(10.6, half + 4.2);
      st.put('torreVigia', tu, tv, -iu, -iv, { tint: st.tint });
    }
  }
}

/** Línea de defensa en el extremo de un andén de isla: muro central y sacos. */
function platformWall(st: St, end: 'A' | 'B') {
  const P = st.f.platforms[0];
  const sgn = end === 'A' ? -1 : 1;
  const u = (end === 'A' ? P.u0 : P.u1) - sgn * 3.0;
  st.put('muroHormigon', u, 0, sgn, 0, { variant: 1, tint: st.tint, aisle: true });
  for (const s of [-1, 1]) {
    st.put('sacosAlto', u, s * (P.v1 - 1.25), sgn, 0, { aisle: true });
    st.spot('guardia', u - sgn * 1.3, s * 1.0, sgn, 0, s > 0 ? 'elite' : undefined);
  }
  st.put('foco', u - sgn * 1.2, P.v1 - 2.9, sgn, 0, { aisle: true });
  st.block(u - 2.2, u + 2.2, P.v0, P.v1);
}

// ---------------------------------------------------------------------------
// Hitos de cada estación
// ---------------------------------------------------------------------------

const SPECIALS: Record<string, (st: St) => void> = {
  SEV: (st) => {
    // Las escaleras mecánicas hacia la superficie y la base de los stalkers
    const h = st.f.heads[0];
    const uc = h.u0 + 6.2;
    st.putX('escaleraMecanica', uc, 0, -1, 0, { aisle: true, tint: st.tint });
    st.spot('guardia', h.u1 - 0.5, -2.7, 1, 0, 'stalker');
    st.spot('guardia', h.u1 - 0.5, 2.7, 1, 0, 'stalker');
    // Stalkers (lado +v): literas, armero y la jefa
    st.putX('litera', h.u0 + 1.0, 8.2, 0, 1);
    st.putX('litera', h.u0 + 1.0, 10.8, 0, 1);
    st.put('arsenal', h.u0 + 4.6, st.f.hw - 0.75, 0, -1, { variant: 0, tint: st.tint });
    st.put('arsenal', h.u0 + 8.0, st.f.hw - 0.75, 0, -1, { variant: 1, tint: st.tint });
    if (st.put('mesa', h.u0 + 6.2, 9.4, 0, -1, { variant: 1 })) {
      st.put('taburete', h.u0 + 5.1, 9.4, 1, 0);
      st.spot('asiento', h.u0 + 5.1, 9.4, 1, 0);
      st.put('taburete', h.u0 + 7.3, 9.4, -1, 0);
      st.spot('asiento', h.u0 + 7.3, 9.4, -1, 0);
    }
    st.spot('figura', h.u0 + 6.2, 7.9, 0.6, -1, 'nor_arkhipova');
    st.spot('guardia', h.u0 + 9.6, 7.6, 1, -0.2, 'stalker');
    st.put('cajas', h.u0 + 11.2, st.f.hw - 1.1, 0, -1);
    st.put('bandera', h.u1 - 0.6, 6.0, 1, 0, { tint: st.tint, variant: st.emblem });
    // Descontaminación (lado -v)
    st.put('deposito', h.u0 + 2.2, -11.6, 0, 1, { variant: 0 });
    st.putX('biombo', h.u0 + 5.2, -8.4, 1, 0);
    st.putX('biombo', h.u0 + 7.4, -8.4, 1, 0);
    st.put('armario', h.u0 + 0.75, -7.6, 1, 0);
    st.putX('camilla', h.u0 + 6.2, -10.6, 1, 0, { variant: 1 });
    st.put('barriles', h.u0 + 10.4, st.f.hw * -1 + 1.0, 0, 1);
    st.put('foco', h.u1 - 1.4, -6.6, -1, 0.5);
    st.spot('medico', h.u0 + 8.6, -9.8, 1, 0.3, 'medico');
    st.spot('trabajo', h.u0 + 4.2, -10.4, -1, 0, 'operar');
  },
  IND: (st) => {
    // La nave de los hornos: la Fábrica del Metro
    const h = st.f.heads[0];
    for (const s of [-1, 1]) {
      if (st.put('horno', h.u0 + 2.7, s * 7, 1, 0)) {
        st.spot('trabajo', h.u0 + 6.9, s * 7, -1, 0, 'operar');
        st.spot('trabajo', h.u0 + 6.2, s * 4.4, -0.8, s * 0.6, 'martillo');
      }
      st.putX('cinta', h.u0 + 10.0, s * 9.6, 1, 0);
      st.putX('railes', h.u0 + 3.2, s * (st.f.hw - 1.0), 1, 0);
      st.put('chatarra', h.u0 + 8.4, s * (st.f.hw - 1.7), 1, 0);
      st.put('generador', h.u0 + 11.4, s * (st.f.hw - 1.0), 0, -s);
      st.put('farola', h.u1 - 0.6, s * 3.6, 1, 0, { aisle: true });
    }
    if (st.put('fragua', h.u0 + 1.3, 0, 1, 0)) st.spot('trabajo', h.u0 + 2.9, 0.2, -1, 0, 'martillo');
    st.put('bobina', h.u0 + 5.6, 1.6, 1, 0);
    st.put('palet', h.u0 + 8.8, -1.4, 1, 0);
    // El magnate vigila su nave
    st.spot('figura', h.u1 - 1.6, 1.2, -1, 0, 'zhdanov');
    st.spot('guardia', h.u1 - 1.0, -1.4, 1, 0, 'elite');
    st.spot('guardia', h.u1 - 1.0, 3.6, 1, 0, 'elite');
  },
  RAS: (st) => {
    // Las Granjas del Amanecer ocupan toda la cabecera
    const h = st.f.heads[0];
    let k = 0;
    for (let u = h.u0 + 1.6; u < h.u1 - 1.2; u += 2.1) {
      for (let v = -11.2; v <= 11.3; v += 3.7) {
        if (Math.abs(v) < 0.2 && k % 2) continue;
        if (st.putX('bancal', u, v, 0, 1)) {
          if (k % 3 === 0) st.put('lamparaSodio', u, v, 1, 0);
          if (k % 5 === 2) st.spot('trabajo', u + 1.0, v, -1, 0, 'cultivo');
          k++;
        }
      }
    }
    st.put('deposito', h.u0 + 1.6, st.f.hw - 1.6, 0, -1, { variant: 0 });
    st.put('deposito', h.u0 + 1.6, -st.f.hw + 1.6, 0, 1, { variant: 0 });
  },
  KHO: (st) => {
    // Los pozos de aire frío
    const P = st.f.platforms[0];
    const mid = (P.u0 + P.u1) / 2;
    const half = (P.u1 - P.u0) / 2;
    for (const s of [-1, 1]) {
      const v = s * 5.3;
      // Prueba varios sitios: los pasillos de las escaleras mandan
      for (const k of [0.44, 0.5, 0.38, 0.56, 0.32]) {
        const u = mid + s * half * k;
        if (!st.free(u, v, 3.5, 3.5) || !st.put('pozoAire', u, v, 0, -s)) continue;
        st.block(u - 4.4, u + 4.4, Math.min(v - 4, v + 4), Math.max(v - 4, v + 4));
        st.put('bidonFuego', u + 4.9, s * 2.2, 0, -s, { aisle: true });
        st.spot('ocio', u + 4.9, s * 3.4, 0, -s, 'fuego');
        st.spot('ocio', u + 6.0, s * 2.3, -1, 0, 'fuego');
        break;
      }
    }
  },
  TSE: (st) => {
    // El edificio del gobierno ruso, en mitad del andén central
    st.put('edificioQuemado', 0, 0, 0, 1, { aisle: true });
    st.block(-7.8, 7.8, -6, 6);
    st.put('velas', 1.4, 5.3, 0, -1);
    st.put('velas', -1.6, 5.2, 0, -1);
    for (const [u, v] of [
      [-7.4, 5.4],
      [7.4, 5.4],
      [-7.4, -5.4],
      [7.4, -5.4],
    ]) st.put('farola', u, v, 0, 1, { aisle: true });
    st.spot('ocio', 0.2, 6.0, 0, -1);
    st.spot('guardia', -8.6, 0.6, -1, 0);
    st.spot('guardia', 8.6, -0.6, 1, 0);
  },
  VYS: (st) => platformWall(st, 'B'),
  RUB: (st) => {
    platformWall(st, 'A');
    platformWall(st, 'B');
  },
  MER: (st) => {
    platformWall(st, 'A');
    // El manantial esmeralda, en el centro
    const P = st.f.platforms[0];
    const uc = (P.u0 + P.u1) / 2;
    if (st.put('manantial', uc, 0, 0, 1, { aisle: true })) {
      st.block(uc - 4.3, uc + 4.3, -3.2, 3.2);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        const u = uc + Math.cos(a) * 3.2;
        const v = Math.sin(a) * 3.2;
        if (i % 2) st.spot('ocio', u, v, -Math.cos(a), -Math.sin(a));
        else st.spot('trabajo', u, v, -Math.cos(a), -Math.sin(a), 'rezo');
      }
      st.put('velas', uc + 2.7, 2.0, 0, -1);
      st.put('velas', uc - 2.8, -1.8, 0, 1);
    }
  },
  CHE: (st) => {
    // La cabecera es el cuartel general de la junta y su arsenal
    const h = st.f.heads[0];
    for (const v of [-9.2, -4.9, 4.9, 9.2]) st.put('muroHormigon', h.u0 + 0.7, v, -1, 0, { variant: Math.abs(v) < 6 ? 1 : 0, tint: st.tint });
    st.spot('guardia', h.u0 + 1.7, -1.5, -1, 0, 'elite');
    st.spot('guardia', h.u0 + 1.7, 1.5, -1, 0, 'elite');
    for (const v of [-9.6, -6.2, 6.2, 9.6]) st.put('arsenal', h.u1 - 0.75, v, -1, 0, { variant: Math.abs(v) > 8 ? 1 : 0, tint: st.tint });
    st.spot('botin', h.u1 - 2.2, -7.9, -1, 0, 'arsenal');
    st.spot('botin', h.u1 - 2.2, 7.9, -1, 0, 'arsenal');
    st.put('alfombra', h.u1 - 5.4, 0, -1, 0, { variant: 0 });
    st.put('mesa', h.u1 - 3.6, 0, -1, 0, { variant: 1 });
    st.spot('lider', h.u1 - 2.6, 0, -1, 0, 'voronov');
    st.put('bandera', h.u1 - 0.7, -1.7, -1, 0, { tint: st.tint, variant: st.emblem });
    st.put('bandera', h.u1 - 0.7, 1.7, -1, 0, { tint: st.tint, variant: st.emblem });
    st.put('radio', h.u1 - 0.9, 12.0, -1, 0);
    st.spot('trabajo', h.u1 - 1.9, 12.0, 1, 0, 'operar');
    st.spot('figura', h.u0 + 5.0, -4.6, -1, 0.3, 'dragunov');
    st.spot('guardia', h.u1 - 3.4, -3.2, -1, 0, 'oficial');
    st.put('torreVigia', h.u0 + 2.6, 11.4, -1, 0, { tint: st.tint });
    st.put('farola', h.u0 + 4.4, 3.4, 1, 0);
    st.put('farola', h.u1 - 4.6, -6.0, 1, 0);
  },
};

/** Tenevskaya: abandonada, a oscuras y con sus almacenes intactos. */
function tenevskaya(st: St) {
  const f = st.f;
  const P = f.platforms[0];
  const rng = st.rng;
  const mid = (P.u0 + P.u1) / 2;
  // Los almacenes de la defensa civil, al fondo del andén
  for (const v of [-4.2, 0, 4.2]) {
    const p = st.w(P.u1 - 3.6, v);
    st.spot('botin', P.u1 - 3.6, v, -1, 0, 'almacen');
    st.ctx.reserveCircle(p.x, p.z, 1.2);
    st.put('estanteria', P.u1 - 0.9, v, -1, 0, { aisle: true });
  }
  st.put('cajas', P.u1 - 6.0, -2.4, -1, 0, { aisle: true });
  st.put('cajas', P.u1 - 6.3, 2.6, -1, 0, { aisle: true });
  // El nido del que nadie vuelve
  const nestAt = (u: number, v: number, kind: string, variant: number) => {
    const p = st.w(u, v);
    st.put('nido', u, v, 1, 0, { ghost: true, variant, aisle: true });
    st.spot('nido', u, v, 1, 0, kind);
    st.ctx.reserveCircle(p.x, p.z, 1.8);
    for (let i = 0; i < 4; i++) st.put('huesos', u + rng.range(-3, 3), v + rng.range(-2.5, 2.5), 1, 0);
  };
  nestAt(mid + 4, 0.5, 'sheptun', 1);
  nestAt(P.u0 + 8, -3.2, 'skrebun', 1);
  nestAt(-f.hl + 6, 6, 'rata', 0);
  nestAt(f.hl - 7, -6.5, 'rata', 0);
  // Lo que quedó del éxodo
  st.scatter('tienda', 4, P, { tint: 0x57524a, variant: 2, aisle: true }, 2.2);
  st.scatter('escombros', 6, P, { aisle: true }, 1.4);
  st.scatter('banco', 5, P, { aisle: true }, 1.2);
  st.scatter('cajas', 3, P, { aisle: true }, 1.6);
  st.scatter('hongosLuz', 9, P, {}, 0.6);
  for (let i = 0; i < 26; i++) {
    const u = rng.range(P.u0 + 1, P.u1 - 1);
    const v = rng.range(P.v0 + 0.8, P.v1 - 0.8);
    const r = rng.next();
    st.put(r < 0.45 ? 'maleta' : r < 0.75 ? 'huesos' : 'charco', u, v, Math.cos(i * 2.4), Math.sin(i * 2.4));
  }
  // Las vías
  for (const lane of f.lanes) {
    for (let i = 0; i < 4; i++) st.put(rng.chance(0.5) ? 'huesos' : 'charco', rng.range(lane.u0 + 4, lane.u1 - 4), lane.v + rng.range(-1.8, 1.8), 1, 0);
  }
}

// ---------------------------------------------------------------------------

export function decorateStation(ctx: DecorCtx, f: StationFrame) {
  const st = new St(ctx, f);
  const bands = makeBands(st);
  structure(st);
  ports(st);
  if (f.id === 'TEN') {
    tenevskaya(st);
    return;
  }
  SPECIALS[f.id]?.(st);
  const prog = PROGRAMS[f.id];
  if (prog) layoutBands(st, bands, prog);
  if (f.id === 'SEV') wagons(st, [1], 0);
  else if (f.id === 'IND') wagons(st, [0, 1], 1);
  else if (f.id === 'RAS') wagons(st, [1], 2);
  else if (f.id === 'CHE') wagons(st, [0], 1);
}

export type { FactionId, Port };
