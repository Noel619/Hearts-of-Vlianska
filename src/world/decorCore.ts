// Decoración del metro: coloca el atrezo, las luces y los puntos de interés
// (puestos, guardias, hogueras…) sobre el trazado. Es código puro y
// determinista: la simulación usa las huellas y los puntos; el render, las piezas.
//
// Este archivo contiene el contexto de trabajo; la orquestación está en
// decor.ts, las estaciones en decorStations.ts y los túneles en decorTunnels.ts.

import { FACTION_LORE } from '../data/historia/facciones';
import type { FactionId, SideId } from '../data/tipos';
import type { V2 } from '../core/math';
import { CELL, F_OBST, F_SLOW, F_TALL, type NavGrid } from './grid';
import type { Layout } from './layout';
import { makeLight, type LightDef } from './lights';
import { PROPS, type PropInst } from './props';

export type SpotKind =
  | 'guardia'
  | 'vendedor'
  | 'ocio'
  | 'asiento'
  | 'cama'
  | 'bar'
  | 'lider'
  | 'trabajo'
  | 'patrulla'
  | 'entrada'
  | 'peaje'
  | 'medico'
  | 'recluta'
  | 'figura'
  | 'nido'
  | 'campamento'
  | 'chatarra'
  | 'botin';

export interface Spot {
  kind: SpotKind;
  x: number;
  z: number;
  /** Hacia dónde mira quien lo ocupa (ángulo matemático en XZ). */
  rot: number;
  /** Estación, cruce o túnel al que pertenece. */
  place: string;
  /** Dato adicional: tipo de tienda, id de figura, criatura del nido, etc. */
  data?: string;
  /** Bando de quien lo ocupa, si no es el dueño del lugar. */
  side?: SideId;
  /** Tienda que regenta una figura de la historia. */
  shop?: string;
}

export interface Decor {
  props: PropInst[];
  lights: LightDef[];
  spots: Spot[];
}

export interface PutOptions {
  variant?: number;
  tint?: number;
  scale?: number;
  dark?: boolean;
  wall?: [number, number];
  y?: number;
  /** No marca la huella en la rejilla. */
  ghost?: boolean;
  /** Coloca aunque el sitio no esté libre. */
  force?: boolean;
  /** Puede ocupar pasillos reservados. */
  aisle?: boolean;
}

/** Índice de emblema (variante de estandartes y banderas) de cada facción. */
export const EMBLEM: Record<FactionId, number> = { UNI: 0, SDR: 1, LEV: 2, STA: 3, VHL: 4, CHE: 5, CAL: 6, NOR: 7 };

/** Contexto de trabajo de los decoradores. */
export class DecorCtx {
  props: PropInst[] = [];
  lights: LightDef[] = [];
  spots: Spot[] = [];
  nav: NavGrid;
  /** Pasillos reservados: aquí no se coloca nada que estorbe el paso. */
  private keep: Uint8Array;
  private seedN = 1;

  constructor(readonly layout: Layout) {
    this.nav = layout.nav;
    this.keep = new Uint8Array(this.nav.w * this.nav.h);
  }

  // --- Pasillos reservados

  reserveRect(x: number, z: number, hl: number, hw: number, rot: number) {
    this.scan(x, z, hl, hw, rot, (i) => {
      this.keep[i] = 1;
      return false;
    });
  }

  reserveCircle(x: number, z: number, r: number) {
    this.reserveRect(x, z, r, r, 0);
  }

  /** Reserva un pasillo a lo largo de una polilínea. */
  reservePath(pts: V2[], r: number) {
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      this.reserveRect((a.x + b.x) / 2, (a.z + b.z) / 2, len / 2 + r * 0.5, r, Math.atan2(b.z - a.z, b.x - a.x));
    }
  }

  private scan(x: number, z: number, hl: number, hw: number, rot: number, fn: (i: number) => boolean): boolean {
    const nav = this.nav;
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const ext = Math.abs(hl * c) + Math.abs(hw * s);
    const extZ = Math.abs(hl * s) + Math.abs(hw * c);
    const x0 = Math.max(0, nav.cx(x - ext));
    const x1 = Math.min(nav.w - 1, nav.cx(x + ext));
    const z0 = Math.max(0, nav.cz(z - extZ));
    const z1 = Math.min(nav.h - 1, nav.cz(z + extZ));
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const dx = nav.wx(cx) - x;
        const dz = nav.wz(cz) - z;
        const u = dx * c + dz * s;
        const v = -dx * s + dz * c;
        if (Math.abs(u) <= hl && Math.abs(v) <= hw && fn(cz * nav.w + cx)) return true;
      }
    }
    return false;
  }

  /** ¿Pisa un pasillo reservado? (ángulo matemático) */
  reserved(x: number, z: number, hl: number, hw: number, rot: number): boolean {
    return this.scan(x, z, hl, hw, rot, (i) => this.keep[i] === 1);
  }

  // --- Piezas

  /** ¿Cabe la pieza aquí? (suelo libre, sin escalones y fuera de los pasillos) */
  fits(type: string, x: number, z: number, rot: number, margin = 0.15, aisle = false): boolean {
    const def = PROPS[type];
    if (!def?.foot) return this.nav.passableAt(x, z, true) && (aisle || !this.reserved(x, z, CELL * 0.5, CELL * 0.5, 0));
    if ('r' in def.foot) {
      const r = def.foot.r + margin;
      return this.nav.rectFree(x, z, r, r, 0) && (aisle || !this.reserved(x, z, r, r, 0));
    }
    return this.nav.rectFree(x, z, def.foot.hx + margin, def.foot.hz + margin, -rot) && (aisle || !this.reserved(x, z, def.foot.hx + margin, def.foot.hz + margin, -rot));
  }

  /** ¿Hay sitio libre para un rectángulo cualquiera? (ángulo matemático) */
  free(x: number, z: number, hl: number, hw: number, rot: number, aisle = false): boolean {
    return this.nav.rectFree(x, z, hl, hw, rot) && (aisle || !this.reserved(x, z, hl, hw, rot));
  }

  put(type: string, x: number, z: number, rot = 0, o: PutOptions = {}): PropInst | null {
    const def = PROPS[type];
    if (!def) throw new Error(`Atrezo desconocido: ${type}`);
    if (!o.force && !o.wall) {
      if (def.foot) {
        if (!this.fits(type, x, z, rot, 0.05, !!o.aisle)) return null;
      } else if (!this.nav.isFloor(x, z)) return null;
    }
    const y = o.y ?? this.nav.heightAt(x, z);
    const seed = this.seedN++;
    const inst: PropInst = { type, x, y, z, rot, seed };
    if (o.variant !== undefined) inst.variant = o.variant;
    else if (def.variants) inst.variant = seed % def.variants;
    if (o.tint !== undefined) inst.tint = o.tint;
    if (o.scale !== undefined) inst.scale = o.scale;
    if (o.dark) inst.dark = true;
    if (o.wall) {
      inst.wnx = o.wall[0];
      inst.wnz = o.wall[1];
    }
    this.props.push(inst);
    if (def.foot && !o.ghost) {
      const flags = def.slow ? F_SLOW : F_OBST | (def.tall ? F_TALL : 0);
      if ('r' in def.foot) this.nav.stampCircle(x, z, def.foot.r, flags);
      else this.nav.stampRect(x, z, def.foot.hx, def.foot.hz, -rot, flags);
    }
    if (def.light && !o.dark) {
      const L = def.light;
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const ox = L.ox ?? 0;
      const oz = L.oz ?? 0;
      // Local -> mundo (rotación Y de three: x' = x cos + z sin, z' = -x sin + z cos)
      const lx = x + ox * c + oz * s;
      const lz = z - ox * s + oz * c;
      this.lights.push(makeLight(lx, y + L.y, lz, L.color, L.intensity * (o.scale ?? 1), L.radius, L.kind ?? 'lamp', L.flicker ?? 0));
    }
    return inst;
  }

  /** Luz suelta (sin pieza). */
  light(x: number, y: number, z: number, color: number, intensity: number, radius: number, kind: LightDef['kind'] = 'lamp', flicker = 0) {
    this.lights.push(makeLight(x, y, z, color, intensity, radius, kind, flicker));
  }

  spot(kind: SpotKind, x: number, z: number, rot: number, place: string, data?: string, extra?: { side?: SideId; shop?: string }): Spot {
    const s: Spot = { kind, x, z, rot, place };
    if (data !== undefined) s.data = data;
    if (extra?.side) s.side = extra.side;
    if (extra?.shop) s.shop = extra.shop;
    this.spots.push(s);
    return s;
  }
}

/** Rotación Y (three) que orienta el eje +Z local de una pieza hacia (dx, dz). */
export function faceDir(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Rotación Y que alinea el eje +X local con (dx, dz). */
export function alignX(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

/** Ángulo de mirada de un personaje hacia (dx, dz). */
export function lookDir(dx: number, dz: number): number {
  return Math.atan2(dz, dx);
}

export const factionColor = (f: FactionId | null): number => (f ? parseInt(FACTION_LORE[f].color.slice(1), 16) : 0x8a8478);

