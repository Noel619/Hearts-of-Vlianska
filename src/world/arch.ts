// Arquitectura de las estaciones: la nave (de pilones, de columnas o de bóveda
// única), las salas anejas que se abren en sus muros, los vestíbulos y los
// túneles de escaleras que suben hacia la superficie.
//
// Todo está en coordenadas locales de estación (u a lo largo del eje, v
// lateral) y es puro: el trazado lo estampa en el campo de distancias, la
// decoración lo amuebla y el render lo reviste.

import { PLATFORM_H } from './plans';

/** Altura del suelo de la superficie: los túneles de escaleras suben hasta aquí. */
export const SURFACE_Y = 17.1;

export type HallKind = 'pilones' | 'columnas' | 'boveda';

/** Muro de la nave (o de la sala de la que parte): L = -v, R = +v, A = -u, B = +u. */
export type ArchWall = 'L' | 'R' | 'A' | 'B';

export type AnnexUse =
  | 'vestibulo'
  | 'escaleras'
  | 'rampa'
  | 'pozo'
  | 'stalkers'
  | 'descontaminacion'
  | 'bombas'
  | 'hospital'
  | 'quirofano'
  | 'despacho'
  | 'hornos'
  | 'talleres'
  | 'municion'
  | 'casamata'
  | 'calabozo'
  | 'armeria'
  | 'caravasar'
  | 'aduana'
  | 'almacen'
  | 'santuario'
  | 'comisaria'
  | 'correos'
  | 'cambio'
  | 'defensa'
  | 'derrumbe'
  | 'guarida'
  | 'jaulas'
  | 'botin'
  | 'granja'
  | 'porqueriza'
  | 'consejo'
  | 'escuela'
  | 'biblioteca'
  | 'bunker'
  | 'mezquita'
  | 'banos'
  | 'conferencia'
  | 'archivo'
  | 'fundicion'
  | 'arsenal'
  | 'cuartel'
  | 'comedor'
  | 'generador';

export interface AnnexSpec {
  id: string;
  use: AnnexUse;
  /** Nombre que se ve en el juego. */
  name: string;
  /** Muro en el que se abre (de la nave o de la sala `from`). */
  wall: ArchWall;
  /**
   * Centro a lo largo del muro: coordenada local (u en L/R, v en A/B) si parte
   * de la nave; desplazamiento desde el centro de la sala si parte de `from`.
   */
  at: number;
  /** Ancho a lo largo del muro y fondo hacia fuera (m). */
  w: number;
  d: number;
  from?: string;
  /** Grosor del muro que la separa (m). */
  gap?: number;
  /** Ancho de la puerta (m). */
  door?: number;
  /** Desplazamiento de la puerta respecto al centro de la sala, a lo largo del muro. */
  doorAt?: number;
  shape?: 'box' | 'round' | 'cave';
  /** Subida total a lo largo del fondo (túneles de escaleras y rampas). */
  rise?: number;
  /** Lleva a la superficie: id de la salida. */
  exit?: string;
  /** Termina en unas puertas herméticas cerradas. */
  sealed?: boolean;
}

export interface StationArch {
  hall: HallKind;
  /** Pilones: franja de andén entre el borde de la vía y la cara exterior de los pilones (m). */
  strip?: number;
  annexes: AnnexSpec[];
}

/** Rectángulo local (mismo formato que LRect del trazado). */
export interface ARect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

export interface Annex extends ARect {
  id: string;
  use: AnnexUse;
  name: string;
  wall: ArchWall;
  parent: string | null;
  /** Dirección local hacia el fondo (de la puerta hacia dentro). */
  du: number;
  dv: number;
  /** Puertas: rectángulos locales que atraviesan el muro. */
  doors: ARect[];
  /** Centro de la puerta principal sobre el muro de origen. */
  doorU: number;
  doorV: number;
  /** Altura del suelo en la entrada y subida a lo largo del fondo. */
  y0: number;
  rise: number;
  shape: 'box' | 'round' | 'cave';
  exit?: string;
  sealed: boolean;
  /** Fondo a lo largo de la dirección de entrada. */
  depth: number;
  /** Ancho perpendicular a la entrada. */
  width: number;
}

const GAP = 1.7;
/** Rellanos planos al pie y en lo alto de las escaleras (m). */
export const LANDING = 3.2;

// ---------------------------------------------------------------------------
// Programas de cada estación
// ---------------------------------------------------------------------------

/** Marca de subida hasta la superficie (se recalcula según la altura de partida). */
const UP = SURFACE_Y;

export const STATION_ARCH: Record<string, StationArch> = {
  SEV: {
    hall: 'boveda',
    annexes: [
      { id: 'vestibulo', use: 'vestibulo', name: 'Vestíbulo de las escaleras', wall: 'A', at: 0, w: 22, d: 12, door: 12 },
      { id: 'escaleras', use: 'escaleras', name: 'Escaleras mecánicas de Severnyy', wall: 'A', from: 'vestibulo', at: 0, w: 9.5, d: 44, door: 8, gap: 1.4, rise: UP, exit: 'SEV' },
      { id: 'stalkers', use: 'stalkers', name: 'Base de los stalkers', wall: 'R', at: -24, w: 15, d: 9 },
      { id: 'descontaminacion', use: 'descontaminacion', name: 'Descontaminación', wall: 'L', at: -28, w: 11, d: 7 },
      { id: 'bombas', use: 'bombas', name: 'Cuarto de bombas', wall: 'L', at: 18, w: 9, d: 6 },
    ],
  },
  UBE: {
    hall: 'columnas',
    annexes: [
      { id: 'hospital', use: 'hospital', name: 'Hospital de la Esperanza', wall: 'R', at: -16, w: 22, d: 12, doorAt: -4 },
      { id: 'quirofano', use: 'quirofano', name: 'Quirófano', wall: 'R', at: 10, w: 13, d: 10 },
      { id: 'despacho', use: 'despacho', name: 'Gobierno de la República del Norte', wall: 'L', at: -26, w: 13, d: 9 },
      { id: 'refugio', use: 'vestibulo', name: 'Refugio de la defensa civil', wall: 'L', at: 8, w: 16, d: 10 },
      { id: 'escaleraRefugio', use: 'escaleras', name: 'Escalera sellada', wall: 'L', from: 'refugio', at: 0, w: 8, d: 24, door: 7, gap: 1.4, rise: 7, sealed: true },
    ],
  },
  IND: {
    hall: 'pilones',
    strip: 2.4,
    annexes: [
      { id: 'hornos', use: 'hornos', name: 'La nave de los hornos', wall: 'A', at: 0, w: 28, d: 16, door: 14 },
      { id: 'carga', use: 'vestibulo', name: 'Muelle de carga', wall: 'L', at: -30, w: 13, d: 9 },
      { id: 'rampa', use: 'rampa', name: 'Rampa de carga de la Fábrica', wall: 'L', from: 'carga', at: 0, w: 7.5, d: 56, door: 6.5, gap: 1.4, rise: UP, exit: 'IND' },
      { id: 'talleres', use: 'talleres', name: 'Talleres de la Fábrica', wall: 'R', at: -12, w: 24, d: 11, doorAt: -5 },
      { id: 'municion', use: 'municion', name: 'Almacén de munición', wall: 'R', at: 22, w: 13, d: 8 },
    ],
  },
  RUB: {
    hall: 'columnas',
    annexes: [
      { id: 'casamata', use: 'casamata', name: 'Casamata', wall: 'L', at: -12, w: 17, d: 9 },
      { id: 'calabozo', use: 'calabozo', name: 'Calabozos', wall: 'L', at: 15, w: 12, d: 7 },
      { id: 'armeria', use: 'armeria', name: 'Armería de la frontera', wall: 'R', at: -14, w: 12, d: 8 },
    ],
  },
  KHO: {
    hall: 'columnas',
    annexes: [
      { id: 'pozoOeste', use: 'pozo', name: 'Pozo de aire frío (oeste)', wall: 'L', at: -32, w: 17, d: 17, shape: 'round', door: 5 },
      { id: 'pozoEste', use: 'pozo', name: 'Pozo de aire frío (este)', wall: 'L', at: 30, w: 17, d: 17, shape: 'round', door: 5 },
      { id: 'escaleraPozo', use: 'escaleras', name: 'Escalera de servicio del pozo', wall: 'L', from: 'pozoEste', at: 0, w: 5.2, d: 34, door: 4, gap: 1.2, rise: UP, exit: 'KHO' },
      { id: 'mando', use: 'despacho', name: 'Cuartel general de los Seguidores', wall: 'R', at: 2, w: 17, d: 10 },
    ],
  },
  STA: {
    hall: 'columnas',
    annexes: [
      { id: 'caravasar', use: 'caravasar', name: 'El caravasar', wall: 'L', at: -26, w: 24, d: 12 },
      { id: 'aduana', use: 'aduana', name: 'Aduana del Consejo Mercantil', wall: 'L', at: 18, w: 13, d: 8 },
      { id: 'almacenes', use: 'almacen', name: 'Almacenes del Consejo', wall: 'R', at: -22, w: 19, d: 10 },
      { id: 'santuario', use: 'santuario', name: 'Capilla de Lazarev', wall: 'R', at: 24, w: 11, d: 8 },
      { id: 'salidaVieja', use: 'vestibulo', name: 'La salida vieja', wall: 'R', at: 2, w: 13, d: 8, door: 5 },
      { id: 'escaleraVieja', use: 'escaleras', name: 'Escalera tapiada', wall: 'R', from: 'salidaVieja', at: 0, w: 7, d: 20, door: 6, gap: 1.3, rise: 6, sealed: true },
    ],
  },
  TSE: {
    hall: 'columnas',
    annexes: [
      { id: 'vestibulo', use: 'vestibulo', name: 'Vestíbulo central', wall: 'R', at: 4, w: 28, d: 14, door: 10 },
      { id: 'escaleras', use: 'escaleras', name: 'Escaleras del Kremlin', wall: 'R', from: 'vestibulo', at: 0, w: 11, d: 30, door: 9.5, gap: 1.4, rise: 9, sealed: true },
      { id: 'union', use: 'despacho', name: 'Sede de la Unión de Estaciones', wall: 'R', at: -48, w: 19, d: 11 },
      { id: 'comisaria', use: 'comisaria', name: 'Comisaría central', wall: 'L', at: -32, w: 15, d: 9 },
      { id: 'correos', use: 'correos', name: 'Correos del metro', wall: 'L', at: 22, w: 13, d: 8 },
      { id: 'cambio', use: 'cambio', name: 'Casa de cambio', wall: 'L', at: 50, w: 11, d: 7 },
    ],
  },
  TEN: {
    hall: 'pilones',
    strip: 2.0,
    annexes: [
      { id: 'almacenes', use: 'defensa', name: 'Almacenes de la defensa civil', wall: 'L', at: 6, w: 19, d: 12, door: 3.2 },
      { id: 'derrumbe', use: 'derrumbe', name: 'Vestíbulo hundido', wall: 'R', at: -6, w: 14, d: 9, shape: 'cave' },
    ],
  },
  VHL: {
    hall: 'boveda',
    annexes: [
      { id: 'guarida', use: 'guarida', name: 'La guarida del Tuerto', wall: 'L', at: 0, w: 17, d: 11, shape: 'cave' },
      { id: 'jaulas', use: 'jaulas', name: 'Las jaulas', wall: 'L', at: 22, w: 11, d: 7, shape: 'cave' },
      { id: 'botin', use: 'botin', name: 'El botín', wall: 'R', at: -10, w: 13, d: 8, shape: 'cave' },
    ],
  },
  RAS: {
    hall: 'boveda',
    annexes: [
      { id: 'granjas', use: 'granja', name: 'Galería de las granjas', wall: 'A', at: 0, w: 24, d: 22, door: 10 },
      { id: 'porqueriza', use: 'porqueriza', name: 'Porqueriza', wall: 'L', at: -16, w: 15, d: 9 },
      { id: 'granero', use: 'almacen', name: 'Granero', wall: 'R', at: 14, w: 13, d: 8 },
      { id: 'salida', use: 'vestibulo', name: 'Vestíbulo del Amanecer', wall: 'R', at: -14, w: 13, d: 8, door: 5 },
      { id: 'escalera', use: 'escaleras', name: 'Escalera sellada', wall: 'R', from: 'salida', at: 0, w: 7, d: 20, door: 6, gap: 1.3, rise: 6, sealed: true },
    ],
  },
  STL: {
    hall: 'pilones',
    strip: 2.4,
    annexes: [
      { id: 'consejo', use: 'consejo', name: 'Sala del Consejo Revolucionario', wall: 'R', at: -6, w: 24, d: 13, doorAt: 0 },
      { id: 'escuela', use: 'escuela', name: 'Escuela del Pueblo', wall: 'R', at: 24, w: 13, d: 8 },
      { id: 'biblioteca', use: 'biblioteca', name: 'Biblioteca del Pueblo', wall: 'L', at: 14, w: 13, d: 8 },
      { id: 'cuartel', use: 'cuartel', name: 'Cuartel de la Guardia Roja', wall: 'L', at: -16, w: 16, d: 9 },
    ],
  },
  VYS: {
    hall: 'columnas',
    annexes: [
      { id: 'bunker', use: 'bunker', name: 'Búnker de mando', wall: 'L', at: 8, w: 13, d: 8 },
      { id: 'hospital', use: 'hospital', name: 'Hospital de campaña', wall: 'R', at: -12, w: 13, d: 8 },
      { id: 'cuartel', use: 'cuartel', name: 'Barracones del frente', wall: 'R', at: 12, w: 15, d: 8 },
    ],
  },
  MER: {
    hall: 'boveda',
    annexes: [
      { id: 'mezquita', use: 'mezquita', name: 'Sala de oración', wall: 'R', at: 10, w: 15, d: 10 },
      { id: 'banos', use: 'banos', name: 'Baños de las abluciones', wall: 'L', at: 4, w: 11, d: 7 },
    ],
  },
  ZVE: {
    hall: 'columnas',
    annexes: [
      { id: 'conferencia', use: 'conferencia', name: 'Sala de la Conferencia', wall: 'R', at: 0, w: 24, d: 14 },
      { id: 'archivo', use: 'archivo', name: 'Archivo de la Unión', wall: 'L', at: -18, w: 11, d: 7 },
      { id: 'salida', use: 'vestibulo', name: 'Vestíbulo de las Estrellas', wall: 'L', at: 12, w: 14, d: 9, door: 6 },
      { id: 'escalera', use: 'escaleras', name: 'Escalera sellada', wall: 'L', from: 'salida', at: 0, w: 8, d: 22, door: 7, gap: 1.3, rise: 7, sealed: true },
    ],
  },
  MOS: {
    hall: 'columnas',
    annexes: [
      { id: 'fundicion', use: 'fundicion', name: 'Fundición del puente', wall: 'L', at: -10, w: 18, d: 10 },
      { id: 'taller', use: 'talleres', name: 'Taller', wall: 'R', at: -14, w: 12, d: 8 },
      { id: 'salida', use: 'vestibulo', name: 'Vestíbulo del puente', wall: 'R', at: 12, w: 13, d: 8, door: 5 },
      { id: 'escalera', use: 'escaleras', name: 'Escalera sellada', wall: 'R', from: 'salida', at: 0, w: 7, d: 20, door: 6, gap: 1.3, rise: 6, sealed: true },
    ],
  },
  CHE: {
    hall: 'columnas',
    annexes: [
      { id: 'arsenal', use: 'arsenal', name: 'Arsenal de la Junta', wall: 'B', at: 0, w: 20, d: 12, door: 3.4 },
      { id: 'mando', use: 'despacho', name: 'Cuartel general de la Junta', wall: 'L', at: -8, w: 15, d: 9 },
      { id: 'calabozo', use: 'calabozo', name: 'Calabozos', wall: 'R', at: -14, w: 12, d: 7 },
      { id: 'comedor', use: 'comedor', name: 'Comedor de tropa', wall: 'R', at: 14, w: 13, d: 8 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

/** Dirección local hacia fuera de un muro. */
export function wallDir(w: ArchWall): [number, number] {
  return w === 'R' ? [0, 1] : w === 'L' ? [0, -1] : w === 'B' ? [1, 0] : [-1, 0];
}

/**
 * Resuelve las salas de una estación a partir de su programa.
 * `hall` es el rectángulo de la nave (−hl..hl, −hw..hw); `hallFloor` da la
 * altura del suelo de la nave junto a cada muro (andén o vía).
 */
export function resolveAnnexes(arch: StationArch, hall: ARect, hallFloor: (w: ArchWall) => number = () => PLATFORM_H): Annex[] {
  const out: Annex[] = [];
  const byId = new Map<string, Annex>();
  for (const spec of arch.annexes) {
    const parent = spec.from ? byId.get(spec.from) : null;
    if (spec.from && !parent) throw new Error(`Sala ${spec.id}: falta ${spec.from}`);
    const P: ARect = parent ?? hall;
    const gap = spec.gap ?? GAP;
    const [du, dv] = wallDir(spec.wall);
    const along = spec.wall === 'L' || spec.wall === 'R';
    // Centro a lo largo del muro
    const centre = parent ? (along ? (P.u0 + P.u1) / 2 : (P.v0 + P.v1) / 2) + spec.at : spec.at;
    const door = spec.door ?? Math.min(2.6, spec.w - 1);
    const dc = centre + (spec.doorAt ?? 0);
    let r: ARect;
    let doorR: ARect;
    let doorU: number;
    let doorV: number;
    if (along) {
      const edge = spec.wall === 'R' ? P.v1 : P.v0;
      const near = edge + dv * gap;
      const far = near + dv * spec.d;
      r = { u0: centre - spec.w / 2, u1: centre + spec.w / 2, v0: Math.min(near, far), v1: Math.max(near, far) };
      doorR = { u0: dc - door / 2, u1: dc + door / 2, v0: Math.min(edge - dv * 0.6, near + dv * 0.6), v1: Math.max(edge - dv * 0.6, near + dv * 0.6) };
      doorU = dc;
      doorV = edge;
    } else {
      const edge = spec.wall === 'B' ? P.u1 : P.u0;
      const near = edge + du * gap;
      const far = near + du * spec.d;
      r = { u0: Math.min(near, far), u1: Math.max(near, far), v0: centre - spec.w / 2, v1: centre + spec.w / 2 };
      doorR = { u0: Math.min(edge - du * 0.6, near + du * 0.6), u1: Math.max(edge - du * 0.6, near + du * 0.6), v0: dc - door / 2, v1: dc + door / 2 };
      doorU = edge;
      doorV = dc;
    }
    // Altura en la entrada: la de la nave junto a ese muro, o la del extremo alto de la sala de origen
    let y0 = hallFloor(spec.wall);
    if (parent) {
      const pd = parent.du * du + parent.dv * dv;
      y0 = parent.y0 + (pd > 0.5 ? parent.rise : 0);
    }
    const a: Annex = {
      ...r,
      id: spec.id,
      use: spec.use,
      name: spec.name,
      wall: spec.wall,
      parent: spec.from ?? null,
      du,
      dv,
      doors: door > 0 ? [doorR] : [],
      doorU,
      doorV,
      y0,
      rise: spec.exit ? SURFACE_Y - y0 : (spec.rise ?? 0),
      shape: spec.shape ?? 'box',
      exit: spec.exit,
      sealed: !!spec.sealed,
      depth: spec.d,
      width: spec.w,
    };
    out.push(a);
    byId.set(a.id, a);
  }
  return out;
}

/** Distancia (local) desde la entrada de la sala hacia su fondo. */
export function annexDepthAt(a: Annex, u: number, v: number): number {
  if (a.du > 0) return u - a.u0;
  if (a.du < 0) return a.u1 - u;
  if (a.dv > 0) return v - a.v0;
  return a.v1 - v;
}

/** Altura del suelo dentro de una sala (rampas y escaleras con rellanos). */
export function annexFloorAt(a: Annex, u: number, v: number): number {
  if (!a.rise) return a.y0;
  const t = annexDepthAt(a, u, v);
  const run = Math.max(1, a.depth - LANDING * 2);
  const k = Math.min(1, Math.max(0, (t - LANDING) / run));
  return a.y0 + a.rise * k;
}

/** ¿Está el punto local dentro de la sala (con margen)? */
export function insideAnnex(a: Annex, u: number, v: number, margin = 0): boolean {
  return u >= a.u0 - margin && u <= a.u1 + margin && v >= a.v0 - margin && v <= a.v1 + margin;
}

/** Punto local del centro de la sala. */
export function annexCentre(a: Annex): [number, number] {
  return [(a.u0 + a.u1) / 2, (a.v0 + a.v1) / 2];
}

/** Punto local a una profundidad `t` desde la entrada y un desplazamiento lateral `s`. */
export function annexPoint(a: Annex, t: number, s = 0): [number, number] {
  const [cu, cv] = annexCentre(a);
  if (a.du !== 0) {
    const u = a.du > 0 ? a.u0 + t : a.u1 - t;
    return [u, cv + s];
  }
  const v = a.dv > 0 ? a.v0 + t : a.v1 - t;
  return [cu + s, v];
}

// ---------------------------------------------------------------------------
// Escaleras mecánicas: carriles, balaustradas y farolas (lo comparten la
// decoración, que pone las luces, y el render, que modela los peldaños)
// ---------------------------------------------------------------------------

export interface EscalatorPlan {
  /** Mecánica (varios carriles con balaustradas) o de servicio (peldaños de lado a lado). */
  kind: 'mecanica' | 'servicio';
  /** Centros laterales de los carriles (desplazamiento s desde el eje) y su ancho. */
  lanes: number[];
  laneW: number;
  /** Centros laterales de las balaustradas y su ancho. */
  rails: number[];
  railW: number;
  /** Profundidades (t) de las farolas sobre las balaustradas. */
  lamps: number[];
  /** Inicio y fin del tramo inclinado. */
  t0: number;
  t1: number;
}

export function escalatorPlan(a: Annex): EscalatorPlan {
  const t0 = LANDING;
  const t1 = a.depth - LANDING;
  if (a.width < 7) {
    const lamps: number[] = [];
    for (let t = t0 + 4; t < t1 - 1; t += 8) lamps.push(t);
    return { kind: 'servicio', lanes: [0], laneW: a.width - 0.6, rails: [], railW: 0, lamps, t0, t1 };
  }
  const laneW = 1.25;
  const railW = 0.8;
  const n = Math.max(2, Math.floor((a.width - 1.2 + railW) / (laneW + railW)));
  const total = n * laneW + (n - 1) * railW;
  const lanes: number[] = [];
  const rails: number[] = [];
  for (let i = 0; i < n; i++) lanes.push(-total / 2 + laneW / 2 + i * (laneW + railW));
  for (let i = 0; i < n - 1; i++) rails.push(-total / 2 + laneW + railW / 2 + i * (laneW + railW));
  const lamps: number[] = [];
  for (let t = t0 + 3; t < t1 - 1; t += 5.5) lamps.push(t);
  return { kind: 'mecanica', lanes, laneW, rails, railW, lamps, t0, t1 };
}
