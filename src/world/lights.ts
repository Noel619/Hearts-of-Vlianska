// Campo de luz estática del metro. Es código puro: lo usan el render (para
// hornear la luz en los vértices y en las sondas de los personajes) y la
// simulación (para saber si alguien está a oscuras o iluminado).

import type { NavGrid } from './grid';

export interface LightDef {
  x: number;
  y: number;
  z: number;
  /** Color lineal ya multiplicado por la intensidad. */
  r: number;
  g: number;
  b: number;
  radius: number;
  /** 0 fija, 1 fuego (parpadea), 2 fluorescente averiado. */
  flicker: number;
  kind: 'lamp' | 'fire' | 'spot' | 'glow';
  /** Dueño (obra del jugador) para poder retirarla. */
  owner?: number;
  off?: boolean;
}

const HASH = 16;
const R0 = 2.6;

export class LightField {
  private cells = new Map<number, LightDef[]>();
  readonly lights: LightDef[] = [];

  constructor(
    readonly nav: NavGrid,
    lights: LightDef[] = [],
  ) {
    for (const l of lights) this.add(l);
  }

  private key(cx: number, cz: number) {
    return (cx + 4096) * 8192 + (cz + 4096);
  }

  add(l: LightDef) {
    this.lights.push(l);
    const r = l.radius;
    for (let cz = Math.floor((l.z - r) / HASH); cz <= Math.floor((l.z + r) / HASH); cz++) {
      for (let cx = Math.floor((l.x - r) / HASH); cx <= Math.floor((l.x + r) / HASH); cx++) {
        const k = this.key(cx, cz);
        let arr = this.cells.get(k);
        if (!arr) this.cells.set(k, (arr = []));
        arr.push(l);
      }
    }
  }

  remove(l: LightDef) {
    const i = this.lights.indexOf(l);
    if (i >= 0) this.lights.splice(i, 1);
    for (const arr of this.cells.values()) {
      const j = arr.indexOf(l);
      if (j >= 0) arr.splice(j, 1);
    }
  }

  near(x: number, z: number): LightDef[] {
    return this.cells.get(this.key(Math.floor(x / HASH), Math.floor(z / HASH))) ?? EMPTY;
  }

  /**
   * Luz que llega a un punto. `out` = [r, g, b, dx, dy, dz]: color e
   * dirección dominante (su módulo es la direccionalidad, 0..1).
   * Si se da una normal, se aplica el coseno (superficies); si no, es omnidireccional.
   */
  sample(x: number, y: number, z: number, nx: number, ny: number, nz: number, surface: boolean, out: Float32Array | number[], shadows = true): void {
    let r = 0;
    let g = 0;
    let b = 0;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    let wsum = 0;
    const list = this.near(x, z);
    // Punto de comprobación de sombra, separado de la superficie
    const px = x + nx * 0.38;
    const pz = z + nz * 0.38;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      if (l.off) continue;
      const lx = l.x - x;
      const ly = l.y - y;
      const lz = l.z - z;
      const d2 = lx * lx + ly * ly + lz * lz;
      const R = l.radius;
      if (d2 >= R * R) continue;
      const d = Math.sqrt(d2) || 1e-3;
      const w = 1 - d2 / (R * R);
      let att = (w * w) / (1 + d2 / (R0 * R0));
      const ux = lx / d;
      const uy = ly / d;
      const uz = lz / d;
      let ndl = 1;
      if (surface) {
        ndl = (ux * nx + uy * ny + uz * nz + 0.28) / 1.28;
        if (ndl <= 0) {
          // Un poco de rebote para las caras de espaldas
          ndl = 0.04;
        }
      }
      // Rebote difuso barato: una fracción que ignora las sombras
      let vis = 1;
      if (shadows) {
        const hd = Math.hypot(l.x - px, l.z - pz);
        if (hd > 0.9) {
          const t = this.nav.sightLine(l.x, l.z, px, pz);
          if (t < 1 - 0.75 / hd) vis = 0.07;
        }
      }
      att *= ndl * vis;
      if (att <= 1e-5) continue;
      const cr = l.r * att;
      const cg = l.g * att;
      const cb = l.b * att;
      r += cr;
      g += cg;
      b += cb;
      const lum = cr * 0.3 + cg * 0.55 + cb * 0.15;
      dx += ux * lum;
      dy += uy * lum;
      dz += uz * lum;
      wsum += lum;
    }
    out[0] = r;
    out[1] = g;
    out[2] = b;
    if (wsum > 1e-6) {
      out[3] = dx / wsum;
      out[4] = dy / wsum;
      out[5] = dz / wsum;
    } else {
      out[3] = out[4] = out[5] = 0;
    }
  }

  /** Nivel de luz (0 = negro, ~1 = bien iluminado) en un punto a la altura del pecho. */
  level(x: number, z: number, y = 1.2): number {
    this.sample(x, y, z, 0, 1, 0, false, TMP, true);
    return TMP[0] * 0.3 + TMP[1] * 0.55 + TMP[2] * 0.15;
  }
}

const EMPTY: LightDef[] = [];
const TMP = new Float32Array(6);

/** Crea una luz a partir de un color sRGB hexadecimal y una intensidad. */
export function makeLight(x: number, y: number, z: number, hex: number, intensity: number, radius: number, kind: LightDef['kind'] = 'lamp', flicker = 0): LightDef {
  const s2l = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  // La intensidad se expresa como irradiancia aproximada a 3 m
  const k = intensity * (1 + 9 / (R0 * R0));
  return {
    x,
    y,
    z,
    r: s2l(((hex >> 16) & 255) / 255) * k,
    g: s2l(((hex >> 8) & 255) / 255) * k,
    b: s2l((hex & 255) / 255) * k,
    radius,
    flicker,
    kind,
  };
}
