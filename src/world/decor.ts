// Decoración del metro: coloca el atrezo, las luces y los puntos de interés
// (puestos, guardias, hogueras…) sobre el trazado. Es código puro y
// determinista: la simulación usa las huellas y los puntos; el render, las piezas.

import { FACTION_LORE } from '../data/historia/facciones';
import type { FactionId, Terrain } from '../data/tipos';
import { Rng, seedFrom } from '../core/rng';
import { F_OBST, F_SLOW, F_TALL, F_WALK, type NavGrid } from './grid';
import { type Layout, type LinkGeom, type NodeGeom, type StationFrame, linkPointAt, stationToLocal, stationToWorld } from './layout';
import { makeLight, type LightDef } from './lights';
import { PLATFORM_H } from './plans';
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
  rot: number;
  /** Estación, cruce o túnel al que pertenece. */
  place: string;
  /** Dato adicional: tipo de tienda, id de figura, etc. */
  data?: string;
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
}

/** Contexto de trabajo de los decoradores. */
export class DecorCtx {
  props: PropInst[] = [];
  lights: LightDef[] = [];
  spots: Spot[] = [];
  nav: NavGrid;
  private seedN = 1;

  constructor(readonly layout: Layout) {
    this.nav = layout.nav;
  }

  /** ¿Cabe la pieza aquí? (suelo libre y sin escalones) */
  fits(type: string, x: number, z: number, rot: number, margin = 0.15): boolean {
    const def = PROPS[type];
    if (!def?.foot) return this.nav.passableAt(x, z, true);
    if ('r' in def.foot) return this.nav.rectFree(x, z, def.foot.r + margin, def.foot.r + margin, 0);
    return this.nav.rectFree(x, z, def.foot.hx + margin, def.foot.hz + margin, -rot);
  }

  put(type: string, x: number, z: number, rot = 0, o: PutOptions = {}): PropInst | null {
    const def = PROPS[type];
    if (!def) throw new Error(`Atrezo desconocido: ${type}`);
    if (!o.force && !o.wall && def.foot && !this.fits(type, x, z, rot, 0.05)) return null;
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
      const light = makeLight(lx, y + L.y, lz, L.color, L.intensity * (o.scale ?? 1), L.radius, L.kind ?? 'lamp', L.flicker ?? 0);
      this.lights.push(light);
    }
    return inst;
  }

  spot(kind: SpotKind, x: number, z: number, rot: number, place: string, data?: string) {
    this.spots.push({ kind, x, z, rot, place, data });
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

export const factionColor = (f: FactionId | null): number => (f ? parseInt(FACTION_LORE[f].color.slice(1), 16) : 0x8a8478);

// ---------------------------------------------------------------------------
// Luces y piezas de pared
// ---------------------------------------------------------------------------

interface WallRule {
  lamp: string;
  spacing: number;
  /** Probabilidad de que la lámpara esté rota. */
  broken: number;
  height: number;
  cables?: boolean;
  pipes?: boolean;
}

const TUNNEL_RULES: Record<Terrain, WallRule> = {
  linea: { lamp: 'lamparaTunel', spacing: 21, broken: 0.12, height: 3.0, cables: true },
  tunel: { lamp: 'lamparaTunel', spacing: 34, broken: 0.45, height: 2.7, cables: true },
  peligroso: { lamp: 'lamparaTunel', spacing: 60, broken: 0.93, height: 2.7 },
  auxiliar: { lamp: 'fluorescente', spacing: 30, broken: 0.4, height: 2.5, pipes: true },
  auxiliarPeligroso: { lamp: 'fluorescente', spacing: 55, broken: 0.9, height: 2.5, pipes: true },
  estrecho: { lamp: 'bombilla', spacing: 26, broken: 0.5, height: 2.2, pipes: true },
  derrumbe: { lamp: 'lamparaTunel', spacing: 70, broken: 0.97, height: 2.7 },
};

function decorateWalls(ctx: DecorCtx) {
  const { layout } = ctx;
  for (let ci = 0; ci < layout.contours.length; ci++) {
    const c = layout.contours[ci];
    const rng = new Rng(seedFrom('muro', ci));
    let sinceLamp = rng.range(0, 10);
    let sinceExtra = 0;
    let side = 0;
    for (let i = 0; i < c.count; i++) {
      const j = (i + 1) % c.count;
      const x = c.data[i * 4];
      const z = c.data[i * 4 + 1];
      const nx = c.data[i * 4 + 2];
      const nz = c.data[i * 4 + 3];
      const seg = Math.hypot(c.data[j * 4] - x, c.data[j * 4 + 1] - z);
      sinceLamp += seg;
      sinceExtra += seg;
      const region = layout.regions[c.owner[i]];
      if (c.owner[j] !== c.owner[i]) continue;
      let rule: WallRule;
      if (region.kind === 'station') rule = { lamp: 'lamparaPared', spacing: 11, broken: region.ref === 'TEN' ? 1 : 0.08, height: 3.6 };
      else if (region.kind === 'node') {
        const theme = layout.nodeById[region.ref].room.theme;
        if (theme === 'cueva' || theme === 'nido' || theme === 'inundado' || theme === 'derrumbe') rule = { lamp: 'lamparaTunel', spacing: 40, broken: 0.95, height: 2.6 };
        else rule = { lamp: 'lamparaPared', spacing: 13, broken: theme === 'anden' ? 0.8 : 0.2, height: 3.0, cables: true };
      } else rule = TUNNEL_RULES[region.terrain as Terrain];
      // Evita las curvas cerradas y las esquinas (normales que cambian mucho)
      const dot = nx * c.data[j * 4 + 2] + nz * c.data[j * 4 + 3];
      if (dot < 0.96) continue;
      if (sinceLamp >= rule.spacing) {
        sinceLamp = rng.range(-3, 3);
        const broken = rng.chance(rule.broken);
        // Lámpara en el muro, mirando hacia el pasillo (-n)
        ctx.put(rule.lamp, x - nx * 0.05, z - nz * 0.05, faceDir(-nx, -nz), { wall: [nx, nz], y: rule.height, dark: broken });
        side++;
      }
      if (sinceExtra >= 4 && (rule.cables || rule.pipes)) {
        sinceExtra = 0;
        const dirx = c.data[j * 4] - x;
        const dirz = c.data[j * 4 + 1] - z;
        void dirx;
        void dirz;
        ctx.put(rule.pipes ? 'tuberia' : 'cables', x - nx * 0.02, z - nz * 0.02, faceDir(-nx, -nz), { wall: [nx, nz], y: rule.pipes ? 0.5 : 2.2, scale: seg / 2.2 });
      }
    }
    void side;
  }
}

// ---------------------------------------------------------------------------
// Estaciones (base común)
// ---------------------------------------------------------------------------

function decorateStationBase(ctx: DecorCtx, f: StationFrame) {
  const rng = new Rng(seedFrom('est', f.def.id.charCodeAt(0) * 31 + f.def.id.charCodeAt(1)));
  const owner = f.def.owner;
  const tint = factionColor(owner);
  // Pilares a lo largo de los bordes de andén
  for (const p of f.platforms) {
    const len = p.u1 - p.u0;
    const n = Math.max(2, Math.round(len / 9));
    for (let i = 0; i < n; i++) {
      const u = p.u0 + (len * (i + 0.5)) / n;
      for (const v of [p.v0 + 1.1, p.v1 - 1.1]) {
        if (Math.abs(v) > f.hw - 1.6) continue; // pegado al muro: sin pilar
        const w = stationToWorld(f, u, v);
        ctx.put('pilar', w.x, w.z, -f.rot, { variant: f.def.id === 'TSE' || f.def.id === 'ZVE' || f.def.id === 'STL' || f.def.id === 'KHO' ? 1 : f.def.id === 'MOS' ? 2 : 0, tint });
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
      for (const tv of lane.tracks) {
        const w = stationToWorld(f, u + (u < 0 ? 1.6 : -1.6), tv);
        ctx.put('tope', w.x, w.z, -f.rot, {});
      }
    }
  }
  void rng;
}

// ---------------------------------------------------------------------------
// Cruces
// ---------------------------------------------------------------------------

function decorateNode(ctx: DecorCtx, n: NodeGeom) {
  const rng = new Rng(seedFrom('nodo' + n.id));
  const theme = n.room.theme;
  if (theme === 'cueva' || theme === 'nido' || theme === 'inundado') {
    for (let i = 0; i < 5; i++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(2, n.room.r - 1.5);
      ctx.put('hongosLuz', n.x + Math.cos(a) * r, n.z + Math.sin(a) * r, rng.range(0, 6));
    }
  } else if (theme !== 'derrumbe' && theme !== 'nicho') {
    const a = rng.range(0, Math.PI * 2);
    ctx.put('bidonFuego', n.x + Math.cos(a) * 2.5, n.z + Math.sin(a) * 2.5, 0);
  }
}

function decorateLink(ctx: DecorCtx, l: LinkGeom) {
  const rng = new Rng(seedFrom('tunel', l.index));
  if (l.terrain === 'peligroso' || l.terrain === 'auxiliarPeligroso' || l.terrain === 'derrumbe') {
    let s = rng.range(15, 40);
    while (s < l.length - 15) {
      const p = linkPointAt(l, s);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = (p.hw - 0.9) * side;
      ctx.put('hongosLuz', p.x - p.dz * off, p.z + p.dx * off, rng.range(0, 6));
      s += rng.range(18, 45);
    }
  }
}

export function decorate(layout: Layout): Decor {
  const ctx = new DecorCtx(layout);
  for (const f of layout.stations) decorateStationBase(ctx, f);
  for (const n of layout.nodes) decorateNode(ctx, n);
  for (const l of layout.links) decorateLink(ctx, l);
  decorateWalls(ctx);
  layout.nav.computeNear();
  return { props: ctx.props, lights: ctx.lights, spots: ctx.spots };
}

export { PLATFORM_H, stationToLocal, F_WALK };
