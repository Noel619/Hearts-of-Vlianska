// Piezas de construcción de las estaciones: el marco local, las bandas de
// andén y los «bloques» (tiendas, puestos, bar, taller, cuartel…) con los que
// se compone cada asentamiento.

import type { FactionId, SideId } from '../data/tipos';
import { clamp } from '../core/math';
import { Rng, seedFrom } from '../core/rng';
import { DecorCtx, EMBLEM, alignX, faceDir, factionColor, lookDir, type PutOptions, type SpotKind } from './decorCore';
import { type LRect, type StationFrame, stationToWorld } from './layout';

type Extra = { side?: SideId; shop?: string };

/** Marco local de una estación (u a lo largo del eje, v lateral). */
export class St {
  readonly rng: Rng;
  readonly id: string;
  readonly owner: FactionId | null;
  readonly tint: number;
  readonly emblem: number;
  /** Zonas ocupadas por los hitos: las bandas las esquivan. */
  readonly blocked: LRect[] = [];

  constructor(
    readonly ctx: DecorCtx,
    readonly f: StationFrame,
  ) {
    this.id = f.id;
    this.rng = new Rng(seedFrom('est' + f.id));
    this.owner = f.def.owner;
    this.tint = factionColor(this.owner);
    this.emblem = this.owner ? EMBLEM[this.owner] : 0;
  }

  w(u: number, v: number) {
    return stationToWorld(this.f, u, v);
  }

  wd(du: number, dv: number): [number, number] {
    const f = this.f;
    return [f.ax * du + f.lx * dv, f.az * du + f.lz * dv];
  }

  /** Coloca una pieza con su +Z local mirando hacia (du, dv). */
  put(type: string, u: number, v: number, du: number, dv: number, o: PutOptions = {}) {
    const p = this.w(u, v);
    const [dx, dz] = this.wd(du, dv);
    return this.ctx.put(type, p.x, p.z, faceDir(dx, dz), o);
  }

  /** Coloca una pieza con su +X local alineado con (du, dv). */
  putX(type: string, u: number, v: number, du: number, dv: number, o: PutOptions = {}) {
    const p = this.w(u, v);
    const [dx, dz] = this.wd(du, dv);
    return this.ctx.put(type, p.x, p.z, alignX(dx, dz), o);
  }

  spot(kind: SpotKind, u: number, v: number, du: number, dv: number, data?: string, extra?: Extra) {
    const p = this.w(u, v);
    const [dx, dz] = this.wd(du, dv);
    return this.ctx.spot(kind, p.x, p.z, lookDir(dx, dz), this.id, data, extra);
  }

  /** Reserva un pasillo (rectángulo local). */
  reserve(u0: number, u1: number, v0: number, v1: number) {
    const p = this.w((u0 + u1) / 2, (v0 + v1) / 2);
    this.ctx.reserveRect(p.x, p.z, Math.abs(u1 - u0) / 2, Math.abs(v1 - v0) / 2, this.f.rot);
  }

  /** Declara una zona ocupada por un hito. */
  block(u0: number, u1: number, v0: number, v1: number) {
    this.blocked.push({ u0: Math.min(u0, u1), u1: Math.max(u0, u1), v0: Math.min(v0, v1), v1: Math.max(v0, v1) });
  }

  free(u: number, v: number, hu: number, hv: number, aisle = false) {
    const p = this.w(u, v);
    return this.ctx.free(p.x, p.z, hu, hv, this.f.rot, aisle);
  }

  /** Reparte piezas al azar dentro de un rectángulo local. */
  scatter(type: string, count: number, r: LRect, o: PutOptions = {}, margin = 0.8): [number, number][] {
    const out: [number, number][] = [];
    for (let k = 0; k < count * 8 && out.length < count; k++) {
      const u = this.rng.range(r.u0 + margin, r.u1 - margin);
      const v = this.rng.range(r.v0 + margin, r.v1 - margin);
      const a = this.rng.range(0, Math.PI * 2);
      if (this.put(type, u, v, Math.cos(a), Math.sin(a), o)) out.push([u, v]);
    }
    return out;
  }
}

/** Franja de andén donde se levantan los bloques, de cara a un pasillo. */
export interface Band {
  u0: number;
  u1: number;
  /** Borde junto al pasillo. */
  v0: number;
  /** Sentido hacia el fondo. */
  dv: 1 | -1;
  D: number;
  kind: 'main' | 'side';
}

/** Hueco de una banda: coordenadas x (a lo largo) y t (fondo desde el pasillo). */
export class SlotCtx {
  readonly rng: Rng;
  readonly mir: 1 | -1;
  /** Bando de quienes ocupan el bloque (por defecto, el dueño de la estación). */
  side: SideId | undefined;
  tint: number;
  emblem: number;

  constructor(
    readonly st: St,
    readonly band: Band,
    readonly uc: number,
    readonly W: number,
    readonly D: number,
    readonly index: number,
  ) {
    this.rng = st.rng;
    this.mir = st.rng.chance(0.5) ? 1 : -1;
    this.tint = st.tint;
    this.emblem = st.emblem;
  }

  uv(x: number, t: number): [number, number] {
    return [this.uc + x * this.mir, this.band.v0 + this.band.dv * t];
  }

  /** Pieza con su +Z local hacia (dx, dt); (0, -1) mira al pasillo. */
  put(type: string, x: number, t: number, dx: number, dt: number, o: PutOptions = {}) {
    const [u, v] = this.uv(x, t);
    return this.st.put(type, u, v, dx * this.mir, dt * this.band.dv, o);
  }

  putX(type: string, x: number, t: number, dx: number, dt: number, o: PutOptions = {}) {
    const [u, v] = this.uv(x, t);
    return this.st.putX(type, u, v, dx * this.mir, dt * this.band.dv, o);
  }

  spot(kind: SpotKind, x: number, t: number, dx: number, dt: number, data?: string, extra?: Extra) {
    const [u, v] = this.uv(x, t);
    const ex = this.side ? { ...extra, side: this.side } : extra;
    return this.st.spot(kind, u, v, dx * this.mir, dt * this.band.dv, data, ex);
  }

  /** Un sitio donde sentarse mirando hacia (dx, dt). */
  seat(x: number, t: number, dx: number, dt: number, data?: string) {
    if (data !== 'suelo') this.put('taburete', x, t, dx, dt);
    this.spot('asiento', x, t, dx, dt, data);
  }

  /** Banco con dos plazas mirando hacia (dx, dt). */
  bench(x: number, t: number, dx: number, dt: number) {
    if (!this.put('banco', x, t, dx, dt, { ghost: true })) return;
    // El banco se extiende a lo largo de su X local: perpendicular a la mirada
    const px = -dt;
    const pt = dx;
    this.spot('asiento', x + px * 0.4, t + pt * 0.4, dx, dt, 'banco');
    this.spot('asiento', x - px * 0.4, t - pt * 0.4, dx, dt, 'banco');
  }

  /** Mesa con asientos a los lados; devuelve si se colocó. */
  table(x: number, t: number, recruit = false): boolean {
    if (!this.put('mesa', x, t, 0, -1, { variant: 0 })) return false;
    this.put('taburete', x - 1.05, t, 1, 0);
    this.put('taburete', x + 1.05, t, -1, 0);
    if (recruit) this.spot('recluta', x - 1.05, t, 1, 0);
    else this.spot('asiento', x - 1.05, t, 1, 0);
    this.spot('asiento', x + 1.05, t, -1, 0);
    return true;
  }
}

/** Fuego con gente alrededor. */
function campfire(S: SlotCtx, x: number, t: number, r: number, type = 'hoguera', seats = 4) {
  if (!S.put(type, x, t, 0, -1)) return false;
  const kinds = ['fuego', 'suelo', 'fuego', 'guitarra', 'suelo', 'fuego'];
  const a0 = S.rng.range(0, 6.28);
  for (let i = 0; i < seats; i++) {
    const a = a0 + (i / seats) * Math.PI * 2 + S.rng.range(-0.2, 0.2);
    const sx = x + Math.cos(a) * r;
    const st = t + Math.sin(a) * r;
    if (st < 0.3 || st > S.D - 0.15 || Math.abs(sx) > S.W / 2 - 0.15) continue;
    S.seat(sx, st, -Math.cos(a), -Math.sin(a), kinds[(i + S.index) % kinds.length]);
  }
  return true;
}

/** Variante del puesto según lo que vende. */
const STALL_VARIANT: Record<string, number> = { comida: 0, armas: 1, ropa: 2, chatarrero: 3, bazar: 4, medico: 4, libros: 4, negro: 3, caravana: 2, bar: 0 };

export type BlockFn = (S: SlotCtx, arg: string, arg2: string) => void;
export interface BlockDef {
  minD: number;
  minW: number;
  fn: BlockFn;
}

function barracks(S: SlotCtx, fig: string, side?: SideId) {
  if (side) {
    S.side = side;
    S.tint = factionColor(side as FactionId);
    S.emblem = EMBLEM[side as FactionId] ?? 0;
  }
  const n = clamp(Math.floor((S.W - 2.6) / 2.3), 1, 3);
  for (let i = 0; i < n; i++) S.putX('litera', -S.W / 2 + 1.25 + i * 2.3, S.D - 0.65, 1, 0);
  S.put('arsenal', S.W / 2 - 1.55, S.D - 0.5, 0, -1, { variant: S.index % 2, tint: S.tint });
  const tm = clamp(S.D - 2.7, 1.5, 2.4);
  S.table(0.3, tm);
  S.putX('sacos', -S.W / 2 + 1.25, 0.45, 1, 0);
  S.putX('sacos', S.W / 2 - 1.25, 0.45, 1, 0);
  S.put('bandera', -S.W / 2 + 0.35, 1.3, 0, -1, { tint: S.tint, variant: S.emblem });
  S.put('caja', S.W / 2 - 0.7, 1.4, 0, -1, { variant: 1 });
  S.spot('guardia', -0.7, 0.45, 0, -1);
  S.spot('guardia', 0.8, 0.5, 0, -1);
  S.spot('guardia', 1.9, tm + 0.2, -1, 0, 'oficial');
  if (fig) S.spot('figura', -1.6, tm + 0.3, 0.3, -1, fig);
}

export const BLOCKS: Record<string, BlockDef> = {
  // --- Vivienda -------------------------------------------------------------------
  tiendas: {
    minD: 3.1,
    minW: 4.2,
    fn: (S) => {
      const n = clamp(Math.floor((S.W - 0.4) / 2.9), 1, 3);
      const tt = Math.max(1.55, S.D - 1.6);
      for (let i = 0; i < n; i++) S.putX('tienda', (i - (n - 1) / 2) * 2.9 + S.rng.range(-0.08, 0.08), tt, 0, -1, { tint: S.tint });
      const front = tt - 1.5;
      if (front >= 2.6) {
        campfire(S, 0, front / 2 + 0.15, Math.min(1.4, front / 2 - 0.05), S.rng.chance(0.3) ? 'olla' : 'hoguera', 4);
        S.put('caja', -S.W / 2 + 0.6, 0.6, 0, -1);
      } else if (front >= 0.8) {
        S.spot('ocio', -0.7, front - 0.35, 1, 0.1);
        S.spot('ocio', 0.5, front - 0.3, -1, 0);
        S.put('barril', S.W / 2 - 0.5, Math.max(0.5, front - 0.4), 0, -1);
        S.seat(-S.W / 2 + 0.6, Math.max(0.4, front - 0.4), 1, 0);
      }
      if (n >= 2 && S.D >= 5.2) S.put('tendedero', 0, tt - 1.75, 0, -1);
    },
  },
  barracon: {
    minD: 3.4,
    minW: 4.4,
    fn: (S) => {
      const two = S.W >= 8.6;
      const tt = Math.max(1.6, S.D - 1.65);
      const xs = two ? [-2.15, 2.15] : [-0.35];
      for (const x of xs) S.put('barracon', x, tt, 0, -1, { tint: S.tint });
      const front = tt - 1.55;
      if (front >= 1.1) {
        S.bench(xs[0] + 1.3, front - 0.35, 0, -1);
        if (front >= 2.4) S.put('estufa', xs[0] - 0.9, front - 0.9, 0, -1);
      }
      S.put('barril', S.W / 2 - 0.5, Math.min(S.D - 0.5, 1.2), 0, -1);
      S.put('caja', S.W / 2 - 0.65, Math.min(S.D - 0.6, 2.3), 0, -1);
      S.spot('ocio', xs[0] - 0.2, Math.max(0.4, front - 0.3), 0.6, 0.5);
    },
  },
  dormitorio: {
    minD: 3.0,
    minW: 4.2,
    fn: (S) => {
      const cols = Math.max(2, Math.floor((S.W - 0.6) / 1.3));
      let k = 0;
      for (let t = 1.25; t + 1.1 <= S.D; t += 2.5) {
        for (let c = 0; c < cols; c++) {
          const x = (c - (cols - 1) / 2) * 1.3;
          if (S.rng.chance(0.15)) continue;
          if (!S.putX('cama', x, t, 0, 1, { variant: 1, ghost: true })) continue;
          if (k++ % 2 === 0) S.spot('cama', x, t, 0, 1);
          if (S.rng.chance(0.4)) S.put('maleta', x + 0.45, t - 0.9, 0, -1);
        }
      }
      S.put('estufa', -S.W / 2 + 0.6, 0.6, 0, -1);
      S.seat(-S.W / 2 + 1.6, 0.55, -1, 0, 'fuego');
      if (S.D >= 4.6) S.put('tendedero', 0, S.D - 0.35, 0, -1);
    },
  },
  hoguera: {
    minD: 3.6,
    minW: 4.4,
    fn: (S) => {
      const t = clamp(S.D / 2, 1.8, 3.2);
      campfire(S, 0, t, 1.45, 'hoguera', 5);
      S.spot('ocio', -2.25, t - 0.4, 1, 0.2, 'fuego');
      S.spot('ocio', 2.2, t + 0.3, -1, -0.1, 'fuego');
      S.put('caja', -S.W / 2 + 0.65, S.D - 0.65, 0, -1);
      S.put('barril', S.W / 2 - 0.5, S.D - 0.5, 0, -1);
      if (S.D >= 5.4) S.put('tendedero', 0, S.D - 0.4, 0, -1);
    },
  },
  // --- Comercio -------------------------------------------------------------------
  puesto: {
    minD: 2.6,
    minW: 3.4,
    fn: (S, kind, kind2) => {
      const kinds = kind2 ? [kind || 'bazar', kind2] : [kind || 'bazar'];
      const two = kinds.length === 2 && S.W >= 6.4;
      const xs = two ? [-S.W / 4 - 0.1, S.W / 4 + 0.1] : [S.W >= 5.6 ? -1.0 : 0];
      xs.forEach((x, i) => {
        const k = kinds[i] ?? kinds[0];
        if (S.put('puesto', x, 0.95, 0, -1, { variant: STALL_VARIANT[k] ?? 4 })) {
          S.spot('vendedor', x, 2.2, 0, -1, k);
          S.spot('ocio', x + 0.45, -0.55, 0, 1);
        }
      });
      if (!two && S.W >= 5.6) {
        S.put('cajas', 1.85, 1.0, 0, -1);
        S.put('barril', 1.5, Math.min(S.D - 0.5, 2.5), 0, -1);
      }
      if (S.D >= 3.7) S.put('estanteria', xs[0], S.D - 0.32, 0, -1);
      if (kind === 'libros' && S.D >= 3.7 && S.W >= 5.6) S.put('estanteria', 2.0, S.D - 0.32, 0, -1);
      if (S.W >= 5.4) S.put('guirnalda', 0, 0.2, 0, -1);
    },
  },
  figura: {
    minD: 2.8,
    minW: 3.4,
    fn: (S, fig, shop) => {
      if (shop) {
        if (S.put('puesto', 0, 0.95, 0, -1, { variant: STALL_VARIANT[shop] ?? 4 })) S.spot('ocio', 0.45, -0.55, 0, 1);
        S.spot('figura', 0, 2.2, 0, -1, fig, { shop });
      } else {
        S.put('mesa', 0, 1.3, 0, -1, { variant: 1 });
        S.spot('figura', 0, 2.15, 0, -1, fig);
        S.put('alfombra', 0, 0.3, 0, -1, { variant: 1 });
      }
      S.put('cajas', -S.W / 2 + 1.15, S.D - 0.85, 0, -1);
      if (S.D >= 3.6) S.put('estanteria', S.W / 2 - 1.1, S.D - 0.32, 0, -1);
      S.put('bandera', S.W / 2 - 0.4, 0.4, 0, -1, { tint: S.tint, variant: S.emblem });
    },
  },
  bar: {
    minD: 4.1,
    minW: 5.4,
    fn: (S) => {
      const tb = S.D - 1.75;
      if (!S.put('barra', 0.4, tb, 0, -1)) return;
      S.spot('bar', 0.4, tb + 0.95, 0, -1, 'bar');
      if (S.D >= 5.0) S.put('estanteria', 0.4, S.D - 0.3, 0, -1);
      S.put('barriles', -S.W / 2 + 1.0, S.D - 0.75, 0, -1);
      if (S.D >= 5.2) {
        S.seat(-0.4, tb - 0.85, 0, 1);
        S.seat(1.2, tb - 0.85, 0, 1);
      }
      const tm = clamp(tb - 2.4, 0.75, 1.4);
      const xs = S.W >= 7.2 ? [-S.W / 4, S.W / 4] : [-0.6];
      xs.forEach((x, i) => S.table(x, tm, i === 0 || S.index % 2 === 0));
      S.put('guirnalda', 0, 0.22, 0, -1);
    },
  },
  cocina: {
    minD: 3.6,
    minW: 4.6,
    fn: (S) => {
      if (S.put('olla', -1.2, S.D - 1.3, 0, -1)) S.spot('trabajo', -1.2, S.D - 2.35, 0, 1, 'cocina');
      S.put('estufa', 0.5, S.D - 0.6, 0, -1);
      S.put('barril', 1.5, S.D - 0.5, 0, -1);
      S.putX('sacos', S.W / 2 - 1.3, S.D - 1.4, 0, 1, { variant: 0 });
      // Mostrador de rancho y una mesa
      if (S.put('mesa', -S.W / 2 + 1.0, 0.95, 0, -1, { variant: 0 })) S.spot('vendedor', -S.W / 2 + 1.0, 1.8, 0, -1, 'comida');
      if (S.W >= 5.6) S.table(S.W / 2 - 1.9, 1.0);
    },
  },
  // --- Trabajo --------------------------------------------------------------------
  taller: {
    minD: 3.6,
    minW: 5.0,
    fn: (S, vendor) => {
      const tb = S.D - 0.55;
      if (S.put('bancoTrabajo', -1.3, tb, 0, -1, { variant: vendor === 'armas' ? 1 : 0 })) S.spot('trabajo', -1.3, tb - 1.0, 0, 1, 'martillo');
      if (S.W >= 5.6 && S.put('torno', 1.35, tb - 0.05, 0, -1)) S.spot('trabajo', 1.35, tb - 1.05, 0, 1, 'operar');
      if (S.W >= 6.6 && S.D >= 4.4 && S.put('fragua', S.W / 2 - 1.1, 1.3, 0, -1)) S.spot('trabajo', S.W / 2 - 2.5, 1.3, 1, 0, 'martillo');
      if (vendor) {
        if (S.put('cajas', -S.W / 2 + 1.2, 0.95, 0, -1)) S.spot('vendedor', -S.W / 2 + 1.2, 2.0, 0, -1, vendor);
      } else S.put('bobina', -S.W / 2 + 0.8, 0.8, 0, -1);
      S.put('barril', S.W / 2 - 0.5, S.D - 2.0, 0, -1);
      if (S.D >= 5.6) S.put('chatarra', -S.W / 2 + 1.4, S.D - 2.6, 0, -1);
    },
  },
  fundicion: {
    minD: 4.4,
    minW: 5.6,
    fn: (S) => {
      if (S.put('fundicion', -0.6, S.D - 1.75, 0, -1)) {
        S.spot('trabajo', -0.6, S.D - 4.0, 0, 1, 'operar');
        S.spot('trabajo', -2.75, S.D - 1.4, 1, 0, 'martillo');
      }
      if (S.W >= 7.4) S.putX('railes', S.W / 2 - 0.8, S.D - 2.4, 0, 1);
      S.put('carretilla', S.W / 2 - 1.2, 0.8, -1, 0.2);
      S.put('barril', -S.W / 2 + 0.5, 0.6, 0, -1);
    },
  },
  granja: {
    minD: 3.4,
    minW: 4.4,
    fn: (S) => {
      const cols = Math.max(1, Math.floor((S.W - 0.4) / 3.25));
      let row = 0;
      for (let t = 0.9; t + 0.7 <= S.D; t += 1.9, row++) {
        for (let c = 0; c < cols; c++) {
          const x = (c - (cols - 1) / 2) * 3.25;
          S.put('bancal', x, t, 0, -1);
          if ((row + c) % 2 === 0) S.put('lamparaSodio', x, t, 0, -1);
        }
        if (row % 2 === 0) S.spot('trabajo', S.rng.range(-0.5, 0.5) * (cols - 1) * 3.25, t + 0.95, 0, -1, 'cultivo');
      }
    },
  },
  hidro: {
    minD: 3.2,
    minW: 4.4,
    fn: (S) => {
      const cols = Math.max(1, Math.floor((S.W - 0.4) / 3.1));
      let row = 0;
      for (let t = 0.8; t + 0.6 <= S.D - 0.2; t += 1.8, row++) {
        for (let c = 0; c < cols; c++) S.put('hidroponico', (c - (cols - 1) / 2) * 3.1, t, 0, -1);
        if (row % 2 === 0) S.spot('trabajo', S.rng.range(-0.5, 0.5) * (cols - 1) * 3.1, t + 0.9, 0, -1, 'operar');
      }
    },
  },
  corral: {
    minD: 3.9,
    minW: 4.6,
    fn: (S) => {
      S.putX('corral', 0, S.D - 1.65, 1, 0);
      S.spot('trabajo', -0.6, S.D - 3.55, 0, 1, 'cultivo');
      S.put('barril', -S.W / 2 + 0.5, 0.6, 0, -1);
      S.putX('sacos', S.W / 2 - 1.3, 0.5, 1, 0, { variant: 0 });
    },
  },
  almacen: {
    minD: 3.0,
    minW: 4.2,
    fn: (S) => {
      const n = Math.max(1, Math.floor((S.W - 0.3) / 2.4));
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 2.4;
        S.put(i % 2 ? 'palet' : 'cajas', x, S.D - 0.9, 0, -1);
        if (S.D >= 4.6) S.put(i % 2 ? 'barriles' : 'palet', x, S.D - 2.75, 0, -1);
      }
      S.put('carretilla', 0.6, 0.9, 1, 0.3);
      S.spot('guardia', -S.W / 2 + 0.7, 0.5, 0, -1);
      S.spot('trabajo', 1.2, Math.max(0.4, S.D - 1.9 - (S.D >= 4.6 ? 1.9 : 0)), 0, 1, 'operar');
    },
  },
  // --- Milicia y gobierno ---------------------------------------------------------
  cuartel: { minD: 4.1, minW: 5.6, fn: (S, fig) => barracks(S, fig) },
  brigada: { minD: 4.1, minW: 5.6, fn: (S) => barracks(S, '', 'UNI') },
  armeria: {
    minD: 3.4,
    minW: 5.0,
    fn: (S) => {
      S.put('arsenal', -1.5, S.D - 0.5, 0, -1, { variant: 0, tint: S.tint });
      if (S.W >= 6.4) S.put('arsenal', 1.5, S.D - 0.5, 0, -1, { variant: 1, tint: S.tint });
      if (S.put('cajas', 0, 1.0, 0, -1)) S.spot('vendedor', 0, 2.0, 0, -1, 'armas');
      S.put('caja', 1.4, 1.0, 0, -1, { variant: 1 });
      S.spot('guardia', -S.W / 2 + 0.7, 0.5, 0, -1, 'elite');
      S.spot('guardia', S.W / 2 - 0.7, 0.5, 0, -1);
    },
  },
  mando: {
    minD: 4.0,
    minW: 5.4,
    fn: (S, fig, fig2) => {
      const tm = S.D - 1.55;
      S.put('alfombra', 0, tm - 1.35, 0, -1, { variant: 0 });
      S.put('mesa', 0, tm, 0, -1, { variant: 1 });
      if (fig) S.spot('lider', 0, tm + 0.85, 0, -1, fig);
      else S.spot('guardia', 0, tm + 0.85, 0, -1, 'oficial');
      S.put('bandera', -1.7, S.D - 0.35, 0, -1, { tint: S.tint, variant: S.emblem });
      S.put('bandera', 1.7, S.D - 0.35, 0, -1, { tint: S.tint, variant: S.emblem });
      S.put('estanteria', -S.W / 2 + 1.0, S.D - 1.4, 1, 0);
      if (S.W >= 6.6) S.put('radio', S.W / 2 - 0.9, S.D - 1.0, -1, 0);
      S.putX('sacos', -S.W / 2 + 1.25, 0.45, 1, 0);
      S.putX('sacos', S.W / 2 - 1.25, 0.45, 1, 0);
      S.spot('guardia', -0.8, 0.5, 0, -1, 'elite');
      S.spot('guardia', 0.9, 0.5, 0, -1, 'elite');
      if (fig2) S.spot('figura', 1.6, tm - 0.9, -0.4, -1, fig2);
    },
  },
  radio: {
    minD: 2.9,
    minW: 3.4,
    fn: (S) => {
      if (S.put('radio', 0, S.D - 0.5, 0, -1)) S.spot('trabajo', 0, S.D - 1.4, 0, 1, 'operar');
      S.put('generador', -S.W / 2 + 1.0, S.D - 0.6, 0, -1);
      S.put('cajas', S.W / 2 - 1.1, S.D - 0.85, 0, -1);
      S.spot('guardia', S.W / 2 - 0.6, 0.5, 0, -1);
    },
  },
  plaza: {
    minD: 2.9,
    minW: 4.2,
    fn: (S, extra) => {
      if (extra === 'estatua' && S.D >= 3.4) S.put('estatua', 0, Math.min(S.D / 2, 2.4), 0, -1, { tint: S.tint });
      else S.put('tablon', 0, S.D - 0.3, 0, -1);
      S.bench(-S.W / 2 + 1.2, S.D - 0.55, 0, -1);
      S.bench(S.W / 2 - 1.2, S.D - 0.55, 0, -1);
      S.put('altavoz', S.W / 2 - 0.35, 0.35, 0, -1);
      S.spot('ocio', -1.2, 0.9, 1, 0.2);
      S.spot('ocio', -0.1, 1.2, -1, -0.1);
      S.spot('ocio', 1.4, 0.7, -0.6, 0.6);
      if (extra && extra !== 'estatua') S.spot('figura', 0.9, Math.min(1.9, S.D - 1.2), 0, -1, extra);
    },
  },
  asamblea: {
    minD: 5.0,
    minW: 5.6,
    fn: (S, fig) => {
      S.put('asamblea', 0, S.D - 1.5, 0, -1, { tint: S.tint });
      if (fig) S.spot('lider', 0.3, S.D - 0.45, 0, -1, fig);
      S.put('bandera', -2.2, S.D - 0.4, 0, -1, { tint: S.tint, variant: S.emblem });
      S.put('bandera', 2.2, S.D - 0.4, 0, -1, { tint: S.tint, variant: S.emblem });
      for (let t = S.D - 3.5; t >= 0.6; t -= 1.25) {
        S.bench(-1.15, t, 0, 1);
        S.bench(1.15, t, 0, 1);
      }
      S.spot('guardia', -S.W / 2 + 0.5, S.D - 1.2, 1, -0.4, 'elite');
    },
  },
  mitin: {
    minD: 3.4,
    minW: 5.4,
    fn: (S, fig) => {
      S.put('tribuna', 0, S.D - 1.6, 0, -1, { tint: S.tint });
      const front = S.D - 3.2;
      if (fig) S.spot('figura', 0.9, Math.max(0.3, front - 0.4), 0, -1, fig);
      S.put('altavoz', -S.W / 2 + 0.35, 0.35, 0, -1);
      S.put('altavoz', S.W / 2 - 0.35, 0.35, 0, -1);
      const tc = front >= 2.4 ? front - 1.6 : -0.5;
      S.spot('ocio', -1.4, tc, 0.2, 1);
      S.spot('ocio', -0.2, tc - 0.3, 0, 1);
      S.spot('ocio', 2.2, tc, -0.3, 1);
    },
  },
  conferencia: {
    minD: 5.2,
    minW: 6.8,
    fn: (S, fig, fig2) => {
      const t = Math.max(2.65, S.D / 2 + 0.2);
      S.put('mesaConferencia', 0, t, 0, -1, { tint: S.tint });
      S.put('bandera', -S.W / 2 + 0.4, S.D - 0.4, 0, -1, { tint: S.tint, variant: S.emblem });
      S.put('bandera', S.W / 2 - 0.4, S.D - 0.4, 0, -1, { tint: S.tint, variant: S.emblem });
      if (fig) S.spot('figura', -S.W / 2 + 0.6, 1.0, 0.8, 0.4, fig);
      if (fig2) S.spot('figura', S.W / 2 - 0.6, 1.2, -0.8, 0.4, fig2);
      S.spot('guardia', -S.W / 2 + 0.6, 0.2, 0, -1);
    },
  },
  // --- Sanidad y culto ------------------------------------------------------------
  hospital: {
    minD: 4.2,
    minW: 5.6,
    fn: (S, fig) => {
      if (S.D >= 6.3 && S.W >= 6.7) {
        // Tienda de campaña con la cruz roja y camillas fuera
        S.putX('tiendaGrande', 0, S.D - 3.1, 0, -1, { variant: 0 });
        S.putX('camilla', -2.9, S.D - 1.2, 0, 1, { variant: 1 });
        S.putX('camilla', 2.9, S.D - 1.2, 0, 1, { variant: 0 });
        S.spot('medico', 2.85, S.D - 2.6, 0, -1, 'medico');
        if (fig) S.spot('figura', -2.85, S.D - 2.7, 0, -1, fig);
        S.bench(-2.9, 0.6, 0, -1);
        return;
      }
      const n = Math.max(1, Math.floor((S.W - 1.4) / 2.5));
      for (let i = 0; i < n; i++) {
        const x = -S.W / 2 + 1.2 + i * 2.5;
        S.putX('camilla', x, S.D - 0.6, 1, 0, { variant: i % 2 });
        if (i < n - 1) S.putX('biombo', x + 1.25, S.D - 0.9, 0, 1);
      }
      S.put('armario', S.W / 2 - 0.6, S.D - 0.4, 0, -1);
      if (S.put('mesa', S.W / 2 - 1.2, 1.0, 0, -1, { variant: 0 })) S.spot('medico', S.W / 2 - 1.2, 1.85, 0, -1, 'medico');
      if (fig) S.spot('figura', 0, S.D - 1.7, 0, -1, fig);
      S.bench(-S.W / 2 + 1.2, 0.6, 0, -1);
    },
  },
  santuario: {
    minD: 3.0,
    minW: 4.2,
    fn: (S, fig) => {
      S.put('mesa', 0, S.D - 0.5, 0, -1, { variant: 0 });
      S.put('velas', -0.9, S.D - 1.2, 0, -1);
      S.put('velas', 0.9, S.D - 1.25, 0, -1);
      S.putX('alfombra', -0.75, S.D - 2.3, 0, 1, { variant: 0 });
      S.putX('alfombra', 0.75, S.D - 2.3, 0, 1, { variant: 2 });
      S.spot('trabajo', -0.75, S.D - 2.2, 0, 1, 'rezo');
      S.spot('trabajo', 0.75, S.D - 2.25, 0, 1, 'rezo');
      if (fig) S.spot('figura', S.W / 2 - 0.7, S.D - 1.3, -0.5, -1, fig);
    },
  },
  mezquita: {
    minD: 3.8,
    minW: 5.0,
    fn: (S, fig) => {
      S.put('mihrab', 0, S.D - 0.6, 0, -1);
      S.put('velas', -2.1, S.D - 0.8, 0, -1);
      S.put('velas', 2.1, S.D - 0.8, 0, -1);
      let k = 0;
      for (let t = S.D - 2.3; t >= 0.9; t -= 1.35) {
        for (const x of [-1.35, 0, 1.35]) {
          S.putX('alfombra', x, t, 0, 1, { variant: (k + 1) % 3 });
          if (k++ % 2 === 0) S.spot('trabajo', x, t - 0.1, 0, 1, 'rezo');
        }
      }
      if (fig) S.spot('figura', S.W / 2 - 0.6, S.D - 1.7, -0.6, -0.6, fig);
    },
  },
  // --- Tsentral'naya ---------------------------------------------------------------
  comisaria: {
    minD: 4.4,
    minW: 5.6,
    fn: (S, fig) => {
      S.put('comisaria', -0.3, S.D - 1.7, 0, -1, { tint: S.tint });
      const front = S.D - 3.4;
      if (fig) S.spot('figura', 0.6, Math.max(0.4, front - 0.6), 0, -1, fig);
      S.spot('guardia', -1.7, Math.max(0.3, front - 0.5), 0, -1);
      S.spot('guardia', 2.6, Math.max(0.5, front - 0.2), 0, -1, 'oficial');
      if (S.W >= 7.4) S.put('jaula', S.W / 2 - 0.95, S.D - 0.95, 0, -1);
    },
  },
  correos: {
    minD: 4.2,
    minW: 5.2,
    fn: (S) => {
      S.put('correos', -0.4, S.D - 1.5, 0, -1);
      const front = S.D - 2.95;
      // El cajón donde lleva meses una carta con el tridente verde
      S.spot('botin', S.W / 2 - 0.8, S.D - 0.9, 0, -1, 'correos');
      S.spot('trabajo', -1.0, Math.max(0.3, front - 0.45), 0, 1, 'escribir');
      S.bench(S.W / 2 - 1.3, Math.max(0.4, front - 0.6), 0, -1);
    },
  },
  // --- Vhlainska -------------------------------------------------------------------
  trono: {
    minD: 4.3,
    minW: 5.4,
    fn: (S, fig) => {
      S.put('trono', 0, S.D - 1.55, 0, -1, { tint: S.tint });
      if (fig) S.spot('lider', 0, S.D - 3.55, 0, -1, fig);
      S.spot('figura', -1.5, S.D - 3.5, 0.2, -1, 'vhl_kostolom');
      S.put('picas', -2.3, S.D - 2.4, 0, -1, { variant: 1 });
      S.put('picas', 2.3, S.D - 2.4, 0, -1, { variant: 1 });
      S.put('bidonFuego', -S.W / 2 + 0.6, 0.6, 0, -1);
      S.put('bidonFuego', S.W / 2 - 0.6, 0.6, 0, -1);
      S.spot('guardia', -1.6, 0.6, 0, -1, 'elite');
      S.spot('guardia', 1.7, 0.6, 0, -1, 'elite');
    },
  },
  guarida: {
    minD: 3.4,
    minW: 4.4,
    fn: (S) => {
      S.put('botin', -1.0, S.D - 1.3, 0, -1, { variant: 1 });
      S.put('cajas', 1.4, S.D - 0.9, 0, -1);
      S.spot('botin', 0.6, S.D - 2.3, 0, -1, 'guarida');
      S.put('picas', -S.W / 2 + 0.5, 0.5, 0, -1, { variant: 0 });
      S.spot('guardia', S.W / 2 - 0.8, 0.6, 0, -1);
      S.spot('guardia', -0.6, 0.5, 0, -1);
    },
  },
  jaulas: {
    minD: 3.2,
    minW: 4.4,
    fn: (S) => {
      S.put('jaula', -1.1, S.D - 0.95, 0, -1);
      S.put('jaula', 1.1, S.D - 0.95, 0, -1);
      S.put('huesos', 0, S.D - 2.2, 0, -1, { variant: 2 });
      S.put('picas', -S.W / 2 + 0.5, 0.6, 0, -1, { variant: 1 });
      S.spot('guardia', 0.4, S.D - 2.6, 0, 1);
    },
  },
};
