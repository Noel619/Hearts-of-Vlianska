// La superficie: el barrio norte de Vlianska, en ruinas y bajo la nieve, al que
// suben las escaleras mecánicas de Severnyy, la rampa de carga de
// Industrialnaya y la escalera del pozo de Kholodnogo Vozduha.
//
// Es un plan puro y determinista: calles, manzanas, edificios y pabellones.
// El trazado lo estampa en el campo de distancias (a la altura SURFACE_Y), la
// decoración lo llena de coches, farolas y escombros, y el render levanta los
// edificios.

import { fbm2, noise2 } from '../core/math';
import { Rng, seedFrom } from '../core/rng';
import { SURFACE_Y } from './arch';

/** Rectángulo alineado con los ejes (x0 < x1, z0 < z1; el norte es −z). */
export interface SRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Caja orientada: eje largo (cos rot, sin rot), como los marcos de estación. */
export interface SBox {
  cx: number;
  cz: number;
  rot: number;
  hl: number;
  hw: number;
}

export type OpenKind = 'avenida' | 'calle' | 'plaza' | 'patio' | 'parque' | 'fabrica' | 'via' | 'pabellon' | 'ruina' | 'boca';
export interface SOpen {
  kind: OpenKind;
  box: SBox;
  zone: string;
}

export type BStyle = 'panel' | 'ladrillo' | 'estalinista' | 'nave' | 'pabellon' | 'terminal' | 'caseta';

export interface SDoor {
  /** Lado de la caja: u± a lo largo del eje, v± a lo ancho. */
  side: 'u+' | 'u-' | 'v+' | 'v-';
  /** Centro de la puerta a lo largo del lado (m desde el centro). */
  at: number;
  w: number;
}

export interface SBuilding {
  id: number;
  box: SBox;
  floors: number;
  floorH: number;
  style: BStyle;
  /** 0 intacto … 1 casi derrumbado. */
  damage: number;
  seed: number;
  zone: string;
  /** Edificio hueco que se recorre por dentro (pabellones del metro). */
  hollow?: { wall: number; doors: SDoor[] };
  name?: string;
}

export interface SZone {
  id: string;
  name: string;
  desc: string;
  x: number;
  z: number;
}

export interface SExit {
  station: string;
  x: number;
  z: number;
  dx: number;
  dz: number;
  width: number;
}

export type BlockKind = 'losas' | 'perimetro' | 'fabrica' | 'parque' | 'plaza' | 'terminal' | 'via' | 'ruina' | 'ventiladores';

export interface SBlock {
  rect: SRect;
  kind: BlockKind;
  zone: string;
}

export interface SStreet {
  a: [number, number];
  b: [number, number];
  w: number;
  kind: 'avenida' | 'calle';
}

export interface SurfacePlan {
  bounds: SRect;
  zones: SZone[];
  open: SOpen[];
  buildings: SBuilding[];
  exits: SExit[];
  streets: SStreet[];
  blocks: SBlock[];
}

export const SURFACE_ZONES: SZone[] = [
  { id: 'SUP_TER', name: 'Plaza del Terminal', desc: 'La plaza de la vieja estación de ferrocarril de Severnyy. Los autobuses siguen en sus andenes, cubiertos de nieve.', x: -760, z: -905 },
  { id: 'SUP_VIA', name: 'Playa de vías', desc: 'Vagones de mercancías congelados en las vías muertas al oeste del Terminal.', x: -860, z: -960 },
  { id: 'SUP_FAB', name: 'La Fábrica', desc: 'Las naves de Industrialnaya en la superficie: chimeneas frías, grúas y el patio al que sube la rampa de carga.', x: -270, z: -790 },
  { id: 'SUP_VEN', name: 'Plaza de los Ventiladores', desc: 'Las torres de ventilación de Kholodnogo Vozduha asoman entre los bloques; por aquí sube la escalera del pozo.', x: 690, z: -790 },
  { id: 'SUP_AV', name: 'Prospekt Severnyy', desc: 'La gran avenida del norte: trolebuses varados, barricadas de 2013 y farolas torcidas.', x: 0, z: -850 },
  { id: 'SUP_BAR', name: 'Barrio del Norte', desc: 'Bloques de viviendas de cinco y nueve plantas, patios con columpios y garajes. Nadie vive aquí desde las bombas.', x: 200, z: -980 },
];

const ZONE_BY_ID = Object.fromEntries(SURFACE_ZONES.map((z) => [z.id, z]));
export function surfaceZone(id: string): SZone | undefined {
  return ZONE_BY_ID[id];
}

// ---------------------------------------------------------------------------
// Relieve: nieve amontonada y escombros
// ---------------------------------------------------------------------------

/** Altura del suelo de la superficie (m). */
export function surfaceHeight(x: number, z: number): number {
  return SURFACE_Y + (fbm2(x * 0.035, z * 0.035, 3, 71) - 0.5) * 0.35 + Math.max(0, noise2(x * 0.11, z * 0.11, 72) - 0.72) * 0.9;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

const X0 = -900;
const X1 = 860;
/** Límite norte y eje de la avenida (el norte es −z). */
const ZN = -1060;
const ZAV = -850;
const AVW = 24;
/** Calle paralela al norte de la avenida. */
const ZST = -966;
const STW = 12;
/** Líneas de las calles norte-sur. */
const XS = [-820, -700, -580, -460, -340, -200, -80, 40, 160, 280, 400, 520, 620, 760];
const CW = 12;
/** Fondo de las hileras de edificios que cierran el barrio. */
const EDGE_ROW = 14;

const rectBox = (r: SRect): SBox => ({ cx: (r.x0 + r.x1) / 2, cz: (r.z0 + r.z1) / 2, rot: 0, hl: (r.x1 - r.x0) / 2, hw: (r.z1 - r.z0) / 2 });

/**
 * Traza el barrio. `edgeZ(x0, x1)` devuelve el punto más al norte del metro
 * entre x0 y x1: la superficie siempre queda al norte, con roca de por medio.
 */
export function planSurface(exits: SExit[], edgeZ: (x0: number, x1: number) => number): SurfacePlan {
  const rng = new Rng(seedFrom('superficie'));
  const open: SOpen[] = [];
  const buildings: SBuilding[] = [];
  const streets: SStreet[] = [];
  const blocks: SBlock[] = [];
  const zoneAt = (x: number, z: number): string => {
    if (x < -820 && z < -860) return 'SUP_VIA';
    if (x < -680) return 'SUP_TER';
    if (x > -470 && x < -70 && z > ZAV + AVW / 2) return 'SUP_FAB';
    if (x > 600 && z > ZAV + AVW / 2) return 'SUP_VEN';
    if (z > ZAV - AVW / 2 - 2 && z < ZAV + AVW / 2 + 2) return 'SUP_AV';
    return 'SUP_BAR';
  };
  /** Límite sur de la superficie entre x0 y x1 (roca de por medio con el metro). */
  const south = (x0: number, x1: number) => Math.min(-745, edgeZ(x0 - 8, x1 + 8) - 9);
  const addOpen = (kind: OpenKind, r: SRect, zone?: string) => {
    if (r.x1 - r.x0 < 1 || r.z1 - r.z0 < 1) return;
    open.push({ kind, box: rectBox(r), zone: zone ?? zoneAt((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2) });
  };
  const addBuilding = (box: SBox, floors: number, style: BStyle, damage: number, zone?: string, extra?: Partial<SBuilding>): SBuilding => {
    const b: SBuilding = { id: buildings.length, box, floors, floorH: style === 'nave' ? 8 : style === 'terminal' ? 5 : 3, style, damage, seed: rng.int(1, 1e6), zone: zone ?? zoneAt(box.cx, box.cz), ...extra };
    buildings.push(b);
    return b;
  };
  const addRectBuilding = (r: SRect, floors: number, style: BStyle, damage: number, zone?: string) => {
    if (r.x1 - r.x0 < 4 || r.z1 - r.z0 < 4) return null;
    return addBuilding(rectBox(r), floors, style, damage, zone);
  };

  // --- Calles ------------------------------------------------------------------
  // Avenida por tramos (cada tramo se recorta contra el metro)
  const lines = [X0, ...XS, X1];
  for (let i = 0; i < lines.length - 1; i++) {
    const xa = lines[i] - (i === 0 ? 0 : CW / 2);
    const xb = lines[i + 1] + (i === lines.length - 2 ? 0 : CW / 2);
    const zs = Math.min(ZAV + AVW / 2, south(xa, xb));
    addOpen('avenida', { x0: xa, z0: ZAV - AVW / 2, x1: xb, z1: zs }, 'SUP_AV');
  }
  streets.push({ a: [X0, ZAV], b: [X1, ZAV], w: AVW, kind: 'avenida' });
  addOpen('calle', { x0: X0, z0: ZST - STW / 2, x1: X1, z1: ZST + STW / 2 });
  streets.push({ a: [X0, ZST], b: [X1, ZST], w: STW, kind: 'calle' });
  // Calles norte-sur: del límite norte hasta la avenida, y hasta el límite sur donde quepa
  for (const x of XS) {
    addOpen('calle', { x0: x - CW / 2, z0: ZN, x1: x + CW / 2, z1: ZAV });
    const zs = south(x - CW / 2, x + CW / 2);
    if (zs > ZAV + AVW / 2 + 10) addOpen('calle', { x0: x - CW / 2, z0: ZAV, x1: x + CW / 2, z1: zs });
    streets.push({ a: [x, ZN], b: [x, Math.max(ZAV, zs)], w: CW, kind: 'calle' });
  }

  // --- Manzanas -------------------------------------------------------------------
  const kindFor = (x0: number, x1: number, row: 'S' | 'M' | 'N'): BlockKind => {
    const cx = (x0 + x1) / 2;
    if (row === 'M' && cx > -820 && cx < -700) return 'terminal';
    if (cx < -820 && row !== 'S') return 'via';
    if (row === 'S' && cx > -470 && cx < -70) return 'fabrica';
    if (row === 'S' && cx > 620 && cx < 760) return 'ventiladores';
    if (row === 'M' && cx > 160 && cx < 280) return 'parque';
    if (row === 'N' && cx > -460 && cx < -340) return 'parque';
    if ((row === 'M' && cx > 400 && cx < 520) || (row === 'N' && cx > -80 && cx < 40)) return 'ruina';
    if (row === 'S' && cx > 520 && cx < 620) return 'ruina';
    return rng.chance(0.42) ? 'perimetro' : 'losas';
  };
  for (let i = 0; i < lines.length - 1; i++) {
    const x0 = lines[i] + (i === 0 ? 0 : CW / 2);
    const x1 = lines[i + 1] - (i === lines.length - 2 ? 0 : CW / 2);
    const rows: [SRect, 'S' | 'M' | 'N'][] = [
      [{ x0, z0: ZN, x1, z1: ZST - STW / 2 }, 'N'],
      [{ x0, z0: ZST + STW / 2, x1, z1: ZAV - AVW / 2 }, 'M'],
    ];
    const zs = south(x0, x1);
    if (zs - (ZAV + AVW / 2) > 22) rows.push([{ x0, z0: ZAV + AVW / 2, x1, z1: zs }, 'S']);
    for (const [r, row] of rows) {
      const kind = kindFor(r.x0, r.x1, row);
      const zone = zoneAt((r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2);
      blocks.push({ rect: r, kind, zone });
      fillBlock(r, kind, zone, row);
    }
  }

  function fillBlock(r: SRect, kind: BlockKind, zone: string, row: 'S' | 'M' | 'N') {
    const W = r.x1 - r.x0;
    const D = r.z1 - r.z0;
    const openKind: OpenKind = kind === 'parque' ? 'parque' : kind === 'fabrica' ? 'fabrica' : kind === 'via' ? 'via' : kind === 'ruina' ? 'ruina' : kind === 'terminal' || kind === 'ventiladores' ? 'plaza' : 'patio';
    addOpen(openKind, r, zone);
    const southRow = row === 'S';
    switch (kind) {
      case 'losas': {
        // Bloques de cinco o nueve plantas en paralelo, con patios entre ellos
        const n = Math.max(1, Math.floor((D - 14) / 34));
        for (let k = 0; k < n; k++) {
          const zc = r.z0 + 10 + 6 + ((D - 20 - 12) * (n === 1 ? 0.5 : k / (n - 1)));
          const floors = rng.chance(0.3) ? 9 : 5;
          const split = W > 90 && rng.chance(0.55);
          const style: BStyle = floors === 9 ? 'panel' : rng.chance(0.5) ? 'panel' : 'ladrillo';
          if (split) {
            const gap = rng.range(10, 16);
            const mid = r.x0 + W * rng.range(0.4, 0.6);
            addRectBuilding({ x0: r.x0 + 8, z0: zc - 6, x1: mid - gap / 2, z1: zc + 6 }, floors, style, damageRoll(), zone);
            addRectBuilding({ x0: mid + gap / 2, z0: zc - 6, x1: r.x1 - 8, z1: zc + 6 }, floors, style, damageRoll(), zone);
          } else addRectBuilding({ x0: r.x0 + 8, z0: zc - 6, x1: r.x1 - 8, z1: zc + 6 }, floors, style, damageRoll(), zone);
        }
        // Del lado sur, una hilera que cierra el barrio
        if (southRow) edgeRow(r, 'south', 5, zone);
        break;
      }
      case 'perimetro': {
        // Manzana cerrada de ladrillo o estalinista con arcos de entrada al patio
        const floors = rng.int(4, 7);
        const style: BStyle = rng.chance(0.5) ? 'estalinista' : 'ladrillo';
        const d = 13;
        const gapN = rng.range(0.3, 0.7);
        const gapS = rng.range(0.3, 0.7);
        const side = (x0: number, x1: number, z0: number, z1: number, gapAt: number | null) => {
          if (gapAt === null) {
            addRectBuilding({ x0, z0, x1, z1 }, floors, style, damageRoll(), zone);
            return;
          }
          const along = x1 - x0 > z1 - z0;
          const g = 9;
          if (along) {
            const m = x0 + (x1 - x0) * gapAt;
            addRectBuilding({ x0, z0, x1: m - g / 2, z1 }, floors, style, damageRoll(), zone);
            addRectBuilding({ x0: m + g / 2, z0, x1, z1 }, floors, style, damageRoll(), zone);
          } else {
            const m = z0 + (z1 - z0) * gapAt;
            addRectBuilding({ x0, z0, x1, z1: m - g / 2 }, floors, style, damageRoll(), zone);
            addRectBuilding({ x0, z0: m + g / 2, x1, z1 }, floors, style, damageRoll(), zone);
          }
        };
        side(r.x0 + 2, r.x1 - 2, r.z0 + 2, r.z0 + 2 + d, gapN);
        side(r.x0 + 2, r.x1 - 2, r.z1 - 2 - d, r.z1 - 2, southRow ? null : gapS);
        side(r.x0 + 2, r.x0 + 2 + d, r.z0 + 2 + d + 1, r.z1 - 2 - d - 1, rng.chance(0.5) ? 0.5 : null);
        side(r.x1 - 2 - d, r.x1 - 2, r.z0 + 2 + d + 1, r.z1 - 2 - d - 1, rng.chance(0.5) ? 0.5 : null);
        break;
      }
      case 'fabrica': {
        // Naves alrededor de un patio; en el de Industrialnaya desemboca la rampa
        const hasRamp = exits.some((e) => e.station === 'IND' && e.x > r.x0 && e.x < r.x1);
        addRectBuilding({ x0: r.x0 + 4, z0: r.z0 + 6, x1: r.x0 + 4 + W * 0.42, z1: r.z0 + 6 + 26 }, 1, 'nave', damageRoll() * 0.6, zone);
        addRectBuilding({ x0: r.x1 - 4 - W * 0.38, z0: r.z0 + 6, x1: r.x1 - 4, z1: r.z0 + 6 + 30 }, 1, 'nave', damageRoll() * 0.6, zone);
        if (D > 70) addRectBuilding({ x0: r.x0 + 4, z0: r.z0 + 46, x1: r.x0 + 28, z1: r.z1 - (hasRamp ? 6 : 18) }, 2, 'ladrillo', damageRoll(), zone);
        if (!hasRamp) addRectBuilding({ x0: r.x0 + W * 0.35, z0: r.z1 - 20, x1: r.x1 - 6, z1: r.z1 - 4 }, 1, 'nave', damageRoll() * 0.5, zone);
        else {
          // Tapia sur con la boca de la rampa
          const e = exits.find((q) => q.station === 'IND')!;
          addRectBuilding({ x0: r.x0 + 30, z0: r.z1 - 3, x1: e.x - e.width / 2 - 3, z1: r.z1 }, 1, 'caseta', 0.2, zone);
          addRectBuilding({ x0: e.x + e.width / 2 + 3, z0: r.z1 - 3, x1: r.x1 - 2, z1: r.z1 }, 1, 'caseta', 0.2, zone);
        }
        break;
      }
      case 'terminal': {
        // La estación de ferrocarril de Severnyy al norte de su plaza
        const b = addRectBuilding({ x0: r.x0 + 10, z0: r.z0 + 6, x1: r.x1 - 10, z1: r.z0 + 6 + 26 }, 3, 'terminal', 0.25, 'SUP_TER');
        if (b) b.name = 'Estación de ferrocarril de Severnyy';
        break;
      }
      case 'via': {
        // Una caseta de señales y nada más: las vías y los vagones los pone la decoración
        addRectBuilding({ x0: r.x1 - 22, z0: r.z0 + 8, x1: r.x1 - 10, z1: r.z0 + 18 }, 2, 'ladrillo', 0.5, 'SUP_VIA');
        break;
      }
      case 'ruina': {
        // Bloques hundidos: dos medio en pie y escombros alrededor
        addRectBuilding({ x0: r.x0 + 8, z0: r.z0 + 10, x1: r.x0 + W * 0.45, z1: r.z0 + 22 }, 5, 'panel', 0.85, zone);
        addRectBuilding({ x0: r.x0 + W * 0.55, z0: r.z1 - 24, x1: r.x1 - 8, z1: r.z1 - 12 }, 9, 'panel', 0.75, zone);
        if (southRow) edgeRow(r, 'south', 3, zone, 0.6);
        break;
      }
      case 'parque': {
        addRectBuilding({ x0: (r.x0 + r.x1) / 2 - 5, z0: r.z0 + 6, x1: (r.x0 + r.x1) / 2 + 5, z1: r.z0 + 14 }, 1, 'caseta', 0.3, zone);
        break;
      }
      case 'ventiladores': {
        if (southRow) edgeRow(r, 'south', 5, zone, 0.3, exits.find((e) => e.station === 'KHO'));
        break;
      }
      case 'plaza':
        break;
    }
  }

  function damageRoll() {
    const r = rng.next();
    return r < 0.45 ? rng.range(0, 0.2) : r < 0.85 ? rng.range(0.2, 0.55) : rng.range(0.55, 0.9);
  }

  /** Hilera de edificios que cierra un borde de manzana, con hueco para una salida. */
  function edgeRow(r: SRect, side: 'south', floors: number, zone: string, damage = 0.3, gapFor?: SExit) {
    void side;
    const z0 = r.z1 - EDGE_ROW;
    const z1 = r.z1;
    if (gapFor && gapFor.x > r.x0 && gapFor.x < r.x1) {
      const g0 = gapFor.x - 12;
      const g1 = gapFor.x + 12;
      addRectBuilding({ x0: r.x0, z0, x1: g0, z1 }, floors, 'panel', damage, zone);
      addRectBuilding({ x0: g1, z0, x1: r.x1, z1 }, floors, 'panel', damage, zone);
    } else addRectBuilding({ x0: r.x0, z0, x1: r.x1, z1 }, floors, 'panel', damage, zone);
  }

  // --- Bordes del barrio: hileras de bloques al oeste, este y norte --------------------
  addRectBuilding({ x0: X0 - EDGE_ROW, z0: ZN - EDGE_ROW, x1: X0, z1: -745 }, 5, 'panel', 0.3, 'SUP_VIA');
  addRectBuilding({ x0: X1, z0: ZN - EDGE_ROW, x1: X1 + EDGE_ROW, z1: -745 }, 5, 'panel', 0.3, 'SUP_VEN');
  for (let x = X0; x < X1; x += 110) addRectBuilding({ x0: x, z0: ZN - EDGE_ROW, x1: Math.min(X1, x + 110), z1: ZN }, rng.chance(0.4) ? 9 : 5, 'panel', damageRoll() * 0.7, 'SUP_BAR');

  // --- Pabellones de salida ----------------------------------------------------------
  const exitsOut: SExit[] = [];
  for (const e of exits) {
    exitsOut.push(e);
    if (e.station === 'IND') {
      // La rampa sale al patio de la fábrica por una boca abierta en la tapia
      addOpen('boca', { x0: e.x - e.width / 2 - 1, z0: south(e.x - 30, e.x + 30) - 2, x1: e.x + e.width / 2 + 1, z1: e.z + 1.6 }, 'SUP_FAB');
      continue;
    }
    // Pabellón hueco sobre el rellano de arriba: el fondo da a la escalera, el frente a la calle
    const rot = Math.atan2(e.dz, e.dx);
    const len = e.station === 'SEV' ? 15 : 12;
    const wid = e.station === 'SEV' ? 18 : 13;
    const box: SBox = { cx: e.x + e.dx * (len / 2 - 1.6), cz: e.z + e.dz * (len / 2 - 1.6), rot, hl: len / 2, hw: wid / 2 };
    open.push({ kind: 'pabellon', box: { ...box, hl: box.hl - 0.8, hw: box.hw - 0.8 }, zone: e.station === 'SEV' ? 'SUP_TER' : 'SUP_VEN' });
    // Paso del pabellón a la calle: hasta la avenida (Severnyy) o hasta la plaza (Kholodnogo)
    const reach = e.station === 'SEV' ? 18 : 10;
    open.push({
      kind: 'pabellon',
      box: { cx: e.x + e.dx * (len - 1.6 + reach / 2 - 1), cz: e.z + e.dz * (len - 1.6 + reach / 2 - 1), rot, hl: reach / 2 + 1, hw: e.station === 'SEV' ? 5 : 3.5 },
      zone: e.station === 'SEV' ? 'SUP_TER' : 'SUP_VEN',
    });
    addBuilding(box, 1, 'pabellon', 0.15, e.station === 'SEV' ? 'SUP_TER' : 'SUP_VEN', {
      floorH: 6,
      hollow: {
        wall: 0.8,
        doors: [
          { side: 'u-', at: 0, w: e.width + 0.6 },
          { side: 'u+', at: 0, w: e.station === 'SEV' ? 8 : 5.5 },
        ],
      },
      name: e.station === 'SEV' ? 'Pabellón del metro: Severnyy Terminal' : 'Casa del pozo de Kholodnogo Vozduha',
    });
  }

  const bounds: SRect = { x0: X0 - EDGE_ROW - 6, z0: ZN - EDGE_ROW - 6, x1: X1 + EDGE_ROW + 6, z1: -720 };
  return { bounds, zones: SURFACE_ZONES, open, buildings, exits: exitsOut, streets, blocks };
}

/** ¿Está el punto dentro de la caja (con margen)? */
export function inBox(b: SBox, x: number, z: number, margin = 0): boolean {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  const dx = x - b.cx;
  const dz = z - b.cz;
  return Math.abs(dx * c + dz * s) <= b.hl + margin && Math.abs(-dx * s + dz * c) <= b.hw + margin;
}

/** Punto del mundo a partir de coordenadas locales (u a lo largo, v a lo ancho) de una caja. */
export function boxPoint(b: SBox, u: number, v: number): [number, number] {
  const c = Math.cos(b.rot);
  const s = Math.sin(b.rot);
  return [b.cx + c * u - s * v, b.cz + s * u + c * v];
}
