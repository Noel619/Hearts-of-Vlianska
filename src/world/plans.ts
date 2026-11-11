// Planos de obra: cómo se convierte el plano del autor (2D) en un metro 3D.
// Aquí solo hay geometría: ejes de las estaciones, bocas de túnel, anchos y
// salas de los cruces. Los nombres y la historia están en data/historia.

import type { Terrain } from '../data/tipos';
import type { V2 } from '../core/math';

/** Metros por unidad del plano original. */
export const WORLD_SCALE = 1.5;

export function mapToWorld(mx: number, my: number): V2 {
  return { x: (mx - 960) * WORLD_SCALE, z: (my - 540) * WORLD_SCALE };
}
export function worldToMap(x: number, z: number): [number, number] {
  return [x / WORLD_SCALE + 960, z / WORLD_SCALE + 540];
}

/** Altura del andén sobre el nivel de vías. */
export const PLATFORM_H = 1.1;

/** Ancho total del suelo de cada tipo de túnel (m). */
export const TUNNEL_WIDTH: Record<Terrain, number> = {
  linea: 10,
  tunel: 6,
  peligroso: 6.6,
  auxiliar: 4,
  auxiliarPeligroso: 4.4,
  estrecho: 2.6,
  derrumbe: 6.2,
};

/** Número de vías por tipo de túnel. */
export const TUNNEL_TRACKS: Record<Terrain, number> = {
  linea: 2,
  tunel: 1,
  peligroso: 1,
  auxiliar: 0,
  auxiliarPeligroso: 0,
  estrecho: 0,
  derrumbe: 1,
};

/** Separación entre ejes de vía en túneles de vía doble. */
export const TRACK_OFFSET = 2.35;

export interface PortSpec {
  /** Extremo de la estación: A = -u, B = +u. */
  end: 'A' | 'B';
  /** Pared: fondo (por defecto) o lateral izquierda/derecha dentro de la garganta. */
  wall?: 'end' | 'L' | 'R';
  /** Desplazamiento lateral en metros (solo pared de fondo). */
  v?: number;
  /** Ignora los puntos de paso del plano original. */
  noVia?: boolean;
}

export type StationKind = 'isla' | 'lateral' | 'doble';

export interface StationPlan {
  /** Dirección del eje +u en grados (0 = este, 90 = sur). */
  axis: number;
  length: number;
  width: number;
  kind: StationKind;
  /** Longitud de la garganta (zona a nivel de vías) en cada extremo; 0 = fondo de saco. */
  throatA: number;
  throatB: number;
  ports: Record<string, PortSpec>;
}

export const STATION_PLANS: Record<string, StationPlan> = {
  SEV: { axis: 57, length: 112, width: 28, kind: 'isla', throatA: 0, throatB: 16, ports: { UBE: { end: 'B' } } },
  UBE: {
    axis: 100,
    length: 124,
    width: 30,
    kind: 'isla',
    throatA: 16,
    throatB: 17,
    ports: { SEV: { end: 'A' }, W2: { end: 'B' }, W7: { end: 'B', wall: 'L' } },
  },
  IND: { axis: 0, length: 134, width: 34, kind: 'isla', throatA: 0, throatB: 18, ports: { RUB: { end: 'B' } } },
  RUB: {
    axis: 0,
    length: 102,
    width: 26,
    kind: 'isla',
    throatA: 16,
    throatB: 17,
    ports: { IND: { end: 'A' }, KHO: { end: 'B' }, E1: { end: 'B', wall: 'R' } },
  },
  KHO: {
    axis: 0,
    length: 150,
    width: 32,
    kind: 'isla',
    throatA: 17,
    throatB: 16,
    ports: { RUB: { end: 'A' }, STA: { end: 'A', wall: 'R' }, VHL: { end: 'B', wall: 'R' } },
  },
  STA: {
    axis: 0,
    length: 144,
    width: 40,
    kind: 'doble',
    throatA: 17,
    throatB: 17,
    ports: { E1: { end: 'A', v: -9 }, E3: { end: 'A', v: 9 }, KHO: { end: 'B', v: -9 }, VHL: { end: 'B', v: 9 } },
  },
  TSE: {
    axis: 30,
    length: 172,
    width: 46,
    kind: 'doble',
    throatA: 18,
    throatB: 18,
    ports: { W7: { end: 'A', v: -10.5 }, W8: { end: 'A', v: 10.5 }, E4: { end: 'B', v: -10.5 }, W11: { end: 'B', v: 10.5 } },
  },
  TEN: { axis: 3, length: 76, width: 24, kind: 'isla', throatA: 13, throatB: 13, ports: { E5: { end: 'A' }, H1: { end: 'B' } } },
  VHL: {
    axis: 90,
    length: 92,
    width: 26,
    kind: 'isla',
    throatA: 16,
    throatB: 15,
    ports: { KHO: { end: 'A', v: -7 }, STA: { end: 'A', v: 7 }, H2: { end: 'B', wall: 'R' } },
  },
  RAS: { axis: 9, length: 112, width: 30, kind: 'lateral', throatA: 0, throatB: 16, ports: { W1: { end: 'B' } } },
  STL: {
    axis: 70.6,
    length: 132,
    width: 34,
    kind: 'isla',
    throatA: 17,
    throatB: 16,
    ports: {
      W3: { end: 'A', v: -11 },
      W1: { end: 'A', v: 6.5 },
      W6: { end: 'A', wall: 'L' },
      VYS: { end: 'B', v: 3.5 },
      W10: { end: 'B', v: -13.5, noVia: true },
    },
  },
  VYS: { axis: 70.6, length: 102, width: 26, kind: 'isla', throatA: 16, throatB: 18, ports: { STL: { end: 'A' }, MER: { end: 'B', v: -4 } } },
  MER: { axis: 28, length: 92, width: 26, kind: 'isla', throatA: 18, throatB: 14, ports: { VYS: { end: 'A' }, MOS: { end: 'B', v: -8 } } },
  ZVE: { axis: 31, length: 112, width: 28, kind: 'isla', throatA: 16, throatB: 16, ports: { E6: { end: 'A' }, MOS: { end: 'B' } } },
  MOS: {
    axis: 6,
    length: 102,
    width: 26,
    kind: 'isla',
    throatA: 17,
    throatB: 16,
    ports: { ZVE: { end: 'A', v: -3.5 }, MER: { end: 'A', v: 10.4 }, S1: { end: 'B' } },
  },
  CHE: { axis: 8, length: 104, width: 28, kind: 'isla', throatA: 17, throatB: 0, ports: { S2: { end: 'A' } } },
};

// ---------------------------------------------------------------------------
// Salas de los cruces
// ---------------------------------------------------------------------------

export interface NodeRoom {
  shape: 'circle' | 'box';
  /** Radio (círculo) o medio largo (caja). */
  r: number;
  /** Medio ancho de la caja. */
  w?: number;
  /** La caja se orienta hacia este vecino (por defecto, el primer enlace). */
  toward?: string;
  /** Irregularidad del contorno, en metros (cuevas). */
  rough?: number;
  /** Carácter del lugar (lo usa la decoración). */
  theme: 'cruce' | 'deposito' | 'tuberias' | 'cueva' | 'inundado' | 'anden' | 'control' | 'derrumbe' | 'nicho' | 'nido' | 'sala';
}

export const NODE_ROOMS: Record<string, NodeRoom> = {
  W1: { shape: 'box', r: 13, w: 8, toward: 'RAS', theme: 'control' },
  W2: { shape: 'circle', r: 12, rough: 2.2, theme: 'cueva' },
  W3: { shape: 'circle', r: 11, rough: 1.6, theme: 'inundado' },
  W4: { shape: 'box', r: 11, w: 8, toward: 'W7', theme: 'sala' },
  W5: { shape: 'box', r: 15, w: 5, toward: 'W6', theme: 'tuberias' },
  W6: { shape: 'circle', r: 7.5, theme: 'cruce' },
  W7: { shape: 'circle', r: 8, theme: 'cruce' },
  W8: { shape: 'circle', r: 8, theme: 'cruce' },
  W9: { shape: 'box', r: 20, w: 11, toward: 'W10', theme: 'deposito' },
  W10: { shape: 'box', r: 10, w: 5, toward: 'W9', theme: 'sala' },
  W11: { shape: 'box', r: 12, w: 8.5, toward: 'TSE', theme: 'control' },
  E1: { shape: 'circle', r: 8, theme: 'cruce' },
  E2: { shape: 'box', r: 9, w: 6, toward: 'E3', theme: 'sala' },
  E3: { shape: 'circle', r: 8, theme: 'control' },
  E4: { shape: 'circle', r: 8.5, theme: 'cruce' },
  E5: { shape: 'circle', r: 10, rough: 1.8, theme: 'nido' },
  E6: { shape: 'box', r: 12, w: 8.5, toward: 'ZVE', theme: 'control' },
  H1: { shape: 'box', r: 21, w: 7.5, toward: 'TEN', theme: 'anden' },
  X1: { shape: 'circle', r: 6.5, rough: 1.2, theme: 'derrumbe' },
  H2: { shape: 'circle', r: 7, theme: 'cruce' },
  H3: { shape: 'circle', r: 4.2, theme: 'nicho' },
  S1: { shape: 'box', r: 9, w: 6, toward: 'MOS', theme: 'control' },
  X2: { shape: 'circle', r: 6.5, rough: 1.2, theme: 'derrumbe' },
  S2: { shape: 'box', r: 9, w: 6, toward: 'CHE', theme: 'control' },
};

/** Cruces que empiezan cegados por un derrumbe. */
export const COLLAPSE_NODES = ['X1', 'X2'];
