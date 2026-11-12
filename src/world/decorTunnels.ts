// Decoración de túneles y cruces: luces de pared, cables, nichos, nidos,
// puestos de control y los restos que veinte años de abandono dejaron atrás.

import type { FactionId, SideId, Terrain } from '../data/tipos';
import { Rng, seedFrom } from '../core/rng';
import { DecorCtx, EMBLEM, alignX, faceDir, factionColor, lookDir } from './decorCore';
import { type Alcove, type LinkGeom, type NodeGeom, linkPointAt } from './layout';

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
  tunel: { lamp: 'lamparaTunel', spacing: 32, broken: 0.4, height: 2.7, cables: true },
  peligroso: { lamp: 'lamparaTunel', spacing: 60, broken: 0.93, height: 2.7 },
  auxiliar: { lamp: 'fluorescente', spacing: 30, broken: 0.4, height: 2.5, pipes: true },
  auxiliarPeligroso: { lamp: 'fluorescente', spacing: 55, broken: 0.9, height: 2.5, pipes: true },
  estrecho: { lamp: 'bombilla', spacing: 26, broken: 0.5, height: 2.2, pipes: true },
  derrumbe: { lamp: 'lamparaTunel', spacing: 70, broken: 0.97, height: 2.7 },
};

/** Estaciones con poca luz eléctrica. */
const DIM_STATIONS: Record<string, number> = { TEN: 1, VHL: 0.7, MER: 0.45, CHE: 0.35, VYS: 0.25 };

/** Bando que guarnece cada cruce. */
export const NODE_SIDE: Record<string, SideId> = {
  W1: 'LEV',
  W6: 'LEV',
  W8: 'UNI',
  W11: 'UNI',
  E6: 'UNI',
  S1: 'UNI',
  S2: 'CHE',
  E1: 'SDR',
  E3: 'STA',
  H2: 'VHL',
  W7: 'LIB',
  E4: 'LIB',
};

export function decorateWalls(ctx: DecorCtx) {
  const { layout } = ctx;
  for (let ci = 0; ci < layout.contours.length; ci++) {
    const c = layout.contours[ci];
    const rng = new Rng(seedFrom('muro', ci));
    let sinceLamp = rng.range(0, 10);
    let sinceExtra = 0;
    let sinceArt = rng.range(0, 6);
    let sinceSign = 20;
    for (let i = 0; i < c.count; i++) {
      const j = (i + 1) % c.count;
      const x = c.data[i * 4];
      const z = c.data[i * 4 + 1];
      const nx = c.data[i * 4 + 2];
      const nz = c.data[i * 4 + 3];
      const seg = Math.hypot(c.data[j * 4] - x, c.data[j * 4 + 1] - z);
      sinceLamp += seg;
      sinceExtra += seg;
      sinceArt += seg;
      sinceSign += seg;
      const region = layout.regions[c.owner[i]];
      if (c.owner[j] !== c.owner[i]) continue;
      let rule: WallRule;
      let station: string | null = null;
      if (region.kind === 'station') {
        station = region.ref;
        rule = { lamp: 'lamparaPared', spacing: 11, broken: DIM_STATIONS[region.ref] ?? 0.08, height: 3.6 };
      } else if (region.kind === 'node') {
        const theme = layout.nodeById[region.ref].room.theme;
        if (theme === 'cueva' || theme === 'nido' || theme === 'inundado' || theme === 'derrumbe') rule = { lamp: 'lamparaTunel', spacing: 40, broken: 0.95, height: 2.6 };
        else if (theme === 'tuberias') rule = { lamp: 'fluorescente', spacing: 16, broken: 0.5, height: 2.6, pipes: true };
        else rule = { lamp: 'lamparaPared', spacing: 13, broken: theme === 'anden' ? 0.85 : theme === 'deposito' ? 0.6 : 0.2, height: 3.0, cables: true };
      } else rule = TUNNEL_RULES[region.terrain as Terrain];
      // Evita las curvas cerradas y las esquinas (normales que cambian mucho)
      const dot = nx * c.data[j * 4 + 2] + nz * c.data[j * 4 + 3];
      if (dot < 0.96) continue;
      const rot = faceDir(-nx, -nz);
      if (sinceLamp >= rule.spacing) {
        sinceLamp = rng.range(-3, 3);
        sinceArt = Math.min(sinceArt, 2.5);
        const broken = rng.chance(rule.broken);
        // Lámpara en el muro, mirando hacia el pasillo (-n)
        ctx.put(rule.lamp, x - nx * 0.05, z - nz * 0.05, rot, { wall: [nx, nz], y: rule.height, dark: broken });
        continue;
      }
      if (station && sinceArt >= 5.5) {
        sinceArt = rng.range(-1.5, 1.5);
        const owner = layout.stationById[station].def.owner as FactionId | null;
        const tint = factionColor(owner);
        const px = x - nx * 0.04;
        const pz = z - nz * 0.04;
        if (!owner) {
          // Tenevskaya: telarañas y carteles de hace veinte años
          if (rng.chance(0.5)) ctx.put('telarana', px, pz, rot, { wall: [nx, nz], y: rng.range(2.6, 3.8) });
          else ctx.put('cartel', px, pz, rot, { wall: [nx, nz], y: 2.5, variant: 3 + rng.int(0, 2), tint: 0x6a6458 });
        } else if (sinceSign > 38 && rng.chance(0.5)) {
          sinceSign = 0;
          ctx.put('rotulo', px, pz, rot, { wall: [nx, nz], y: 3.25, tint });
        } else {
          const r = rng.next();
          if (r < 0.34) ctx.put('estandarte', px, pz, rot, { wall: [nx, nz], y: 4.0, variant: EMBLEM[owner], tint });
          else if (r < 0.8) ctx.put('cartel', px, pz, rot, { wall: [nx, nz], y: rng.range(2.3, 2.7), variant: rng.int(0, 5), tint });
          else if (r < 0.87) ctx.put('reloj', px, pz, rot, { wall: [nx, nz], y: 3.7 });
        }
        continue;
      }
      if (sinceExtra >= 4 && (rule.cables || rule.pipes)) {
        sinceExtra = 0;
        ctx.put(rule.pipes ? 'tuberia' : 'cables', x - nx * 0.02, z - nz * 0.02, rot, { wall: [nx, nz], y: rule.pipes ? 0.5 : 2.2, scale: seg / 2.2 });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Cruces
// ---------------------------------------------------------------------------

/** Utilidades de colocación en el marco local de un cruce. */
class Room {
  readonly rng: Rng;
  readonly e1x: number;
  readonly e1z: number;
  readonly e2x: number;
  readonly e2z: number;
  readonly hl: number;
  readonly hw: number;
  readonly box: boolean;

  constructor(
    readonly ctx: DecorCtx,
    readonly n: NodeGeom,
  ) {
    this.rng = new Rng(seedFrom('nodo' + n.id));
    this.e1x = Math.cos(n.rot);
    this.e1z = Math.sin(n.rot);
    this.e2x = -this.e1z;
    this.e2z = this.e1x;
    this.box = n.room.shape === 'box';
    this.hl = n.room.r;
    this.hw = this.box ? (n.room.w ?? n.room.r) : n.room.r;
  }

  w(a: number, b: number) {
    return { x: this.n.x + this.e1x * a + this.e2x * b, z: this.n.z + this.e1z * a + this.e2z * b };
  }

  /** Coloca una pieza con su +Z local mirando hacia (da, db) en el marco del cruce. */
  put(type: string, a: number, b: number, da: number, db: number, o: Parameters<DecorCtx['put']>[4] = {}) {
    const p = this.w(a, b);
    return this.ctx.put(type, p.x, p.z, faceDir(this.e1x * da + this.e2x * db, this.e1z * da + this.e2z * db), o);
  }

  /** Coloca una pieza con su +X local alineado con (da, db). */
  putX(type: string, a: number, b: number, da: number, db: number, o: Parameters<DecorCtx['put']>[4] = {}) {
    const p = this.w(a, b);
    return this.ctx.put(type, p.x, p.z, alignX(this.e1x * da + this.e2x * db, this.e1z * da + this.e2z * db), o);
  }

  spot(kind: Parameters<DecorCtx['spot']>[0], a: number, b: number, da: number, db: number, data?: string, extra?: { side?: SideId; shop?: string }) {
    const p = this.w(a, b);
    return this.ctx.spot(kind, p.x, p.z, lookDir(this.e1x * da + this.e2x * db, this.e1z * da + this.e2z * db), this.n.id, data, extra);
  }

  /** Punto al azar dentro de la sala. */
  random(margin = 1.5): [number, number] {
    if (this.box) return [this.rng.range(-this.hl + margin, this.hl - margin), this.rng.range(-this.hw + margin, this.hw - margin)];
    const a = this.rng.range(0, Math.PI * 2);
    const r = Math.sqrt(this.rng.next()) * (this.hl - margin);
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  /** Reparte piezas por la sala donde quepan. Devuelve las posiciones usadas. */
  scatter(type: string, count: number, o: Parameters<DecorCtx['put']>[4] = {}, margin = 1.6): [number, number][] {
    const out: [number, number][] = [];
    for (let k = 0; k < count * 8 && out.length < count; k++) {
      const [a, b] = this.random(margin);
      const ang = this.rng.range(0, Math.PI * 2);
      if (this.put(type, a, b, Math.cos(ang), Math.sin(ang), o)) out.push([a, b]);
    }
    return out;
  }

  /** Busca un sitio libre para un objeto del mundo (botín, chatarra, nido). */
  findFree(r: number, margin = 2, tries = 30): [number, number] | null {
    for (let k = 0; k < tries; k++) {
      const [a, b] = this.random(margin);
      const p = this.w(a, b);
      if (this.ctx.free(p.x, p.z, r, r, 0)) return [a, b];
    }
    return null;
  }
}

function nest(R: Room, kind: string, variant = 0) {
  const at = R.findFree(1.7, 2.6);
  if (!at) return;
  const [a, b] = at;
  R.put('nido', a, b, 1, 0, { variant, ghost: true });
  R.spot('nido', a, b, 1, 0, kind);
  for (let i = 0; i < 3; i++) R.put('huesos', a + R.rng.range(-2.5, 2.5), b + R.rng.range(-2.5, 2.5), 1, 0);
}

function loot(R: Room, data?: string) {
  const at = R.findFree(0.9, 1.8);
  if (!at) return;
  R.spot('botin', at[0], at[1], 1, 0, data);
  const p = R.w(at[0], at[1]);
  R.ctx.reserveCircle(p.x, p.z, 1.0);
}

function scrap(R: Room, data?: string) {
  const at = R.findFree(1.5, 2.2);
  if (!at) return;
  R.spot('chatarra', at[0], at[1], 1, 0, data);
  const p = R.w(at[0], at[1]);
  R.ctx.reserveCircle(p.x, p.z, 1.6);
}

/** Puesto de control sobre la línea: sacos, garita, barrera y guardia. */
function checkpoint(R: Room, side: SideId) {
  const tint = side === 'LIB' ? 0x8a8478 : factionColor(side as FactionId);
  const w = R.hw;
  const l = R.hl;
  const emblem = side === 'LIB' ? 0 : EMBLEM[side as FactionId];
  // Parapetos a ambos lados de las vías, en los dos accesos
  for (const sa of [-1, 1]) {
    for (const sb of [-1, 1]) {
      const a = sa * l * 0.45;
      for (const b of [w - 1.0, w - 2.6, w - 4.2]) {
        if (b < 2.4) continue;
        R.putX('sacos', a, sb * b, 0, 1);
      }
    }
  }
  R.put('garita', -l * 0.12, w - 1.25, 0, -1);
  R.putX('barrera', l * 0.12, w - 2.4, 0, -1);
  R.put('bidonFuego', l * 0.1 + 2.2, w - 1.3, 0, -1);
  R.put('foco', -l * 0.45 - 1.6, -(w - 1.1), 1, 0.4);
  R.put('foco', l * 0.45 + 1.6, -(w - 1.1), -1, 0.4);
  R.put('bandera', -l * 0.12 - 1.6, w - 0.9, 0, -1, { tint, variant: emblem });
  R.put('cajas', l * 0.3, -(w - 1.2), 0, 1);
  R.put('barril', l * 0.3 + 1.6, -(w - 0.9), 0, 1);
  // Guardia
  const ex = { side };
  R.spot('guardia', -l * 0.45 + 1.2, w - 3.4, -1, 0, undefined, ex);
  R.spot('guardia', l * 0.45 - 1.2, w - 3.4, 1, 0, undefined, ex);
  R.spot('guardia', -l * 0.45 + 1.2, -(w - 3.2), -1, 0, undefined, ex);
  R.spot('guardia', l * 0.45 - 1.2, -(w - 3.2), 1, 0, 'oficial', ex);
  R.spot('guardia', l * 0.1 + 1.2, w - 2.2, 0, -1, undefined, ex);
}

/** Retén pequeño en un cruce redondo. */
function outpost(R: Room, side: SideId) {
  const r = R.hl;
  const tint = side === 'LIB' ? 0x8a8478 : factionColor(side as FactionId);
  // Busca el hueco más despejado del anillo exterior
  let best: [number, number] | null = null;
  for (let k = 0; k < 16; k++) {
    const ang = (k / 16) * Math.PI * 2 + 0.2;
    const a = Math.cos(ang) * (r - 2.2);
    const b = Math.sin(ang) * (r - 2.2);
    const p = R.w(a, b);
    if (R.ctx.free(p.x, p.z, 1.9, 1.9, 0)) {
      best = [a, b];
      break;
    }
  }
  if (!best) return;
  const [a, b] = best;
  const d = Math.hypot(a, b) || 1;
  const ia = -a / d;
  const ib = -b / d;
  const ex = { side };
  if (side === 'VHL') {
    // Vigías de la Hermandad: picas, fuego y una advertencia
    R.put('bidonFuego', a, b, ia, ib);
    R.put('picas', a - ib * 1.5, b + ia * 1.5, ia, ib, { variant: 1 });
    R.put('picas', a + ib * 1.5, b - ia * 1.5, ia, ib, { variant: 0 });
    R.spot('guardia', a + ia * 1.4, b + ib * 1.4, ia, ib, undefined, ex);
    R.spot('guardia', a + ia * 1.0 - ib * 1.6, b + ib * 1.0 + ia * 1.6, ia, ib, undefined, ex);
    return;
  }
  if (side === 'LIB') {
    // Posada de caminantes: una tienda, un fuego y alguien que vende lo que encuentra
    R.putX('tienda', a, b, ia, ib, { tint });
    R.put('hoguera', a + ia * 3.1, b + ib * 3.1, ia, ib);
    R.put('caja', a + ia * 3.1 - ib * 1.5, b + ib * 3.1 + ia * 1.5, ia, ib, { ghost: true });
    R.spot('vendedor', a + ia * 2.0 + ib * 1.6, b + ib * 2.0 - ia * 1.6, ia, ib, 'bazar', ex);
    R.spot('recluta', a + ia * 3.1 - ib * 1.5, b + ib * 3.1 + ia * 1.5, ib, -ia, undefined, ex);
    return;
  }
  R.putX('sacos', a + ia * 1.3, b + ib * 1.3, -ib, ia);
  R.put('bidonFuego', a - ib * 1.2, b + ia * 1.2, ia, ib);
  R.put('caja', a + ib * 1.3, b - ia * 1.3, ia, ib);
  R.put('bandera', a - ia * 0.9, b - ib * 0.9, ia, ib, { tint, variant: EMBLEM[side as FactionId] });
  R.spot('guardia', a + ia * 2.3, b + ib * 2.3, ia, ib, undefined, ex);
  R.spot('guardia', a + ia * 0.3 - ib * 0.4, b + ib * 0.3 + ia * 0.4, ia, ib, undefined, ex);
}

export function decorateNode(ctx: DecorCtx, n: NodeGeom) {
  const R = new Room(ctx, n);
  const rng = R.rng;
  const theme = n.room.theme;
  const side = NODE_SIDE[n.id];
  switch (theme) {
    case 'control':
      checkpoint(R, side ?? 'UNI');
      break;
    case 'cruce':
      if (side) outpost(R, side);
      else R.scatter('bidonFuego', 1);
      R.scatter('caja', 2);
      break;
    case 'sala':
      // Salas de servicio abandonadas: buen sitio para instalarse
      R.put('estanteria', -R.hl + 0.6, R.hw * 0.4, 1, 0);
      R.put('cajas', -R.hl + 1.4, -R.hw * 0.5, 1, 0);
      R.put('generador', R.hl - 1.4, R.hw - 0.9, 0, -1, { dark: true });
      R.scatter('escombros', 2);
      R.scatter('barril', 2);
      loot(R);
      scrap(R);
      R.spot('campamento', 0, 0, 1, 0);
      break;
    case 'deposito': {
      // Cocheras: dos vagones varados, chatarra de sobra y ratas
      R.putX('vagon', -3, R.hw - 2.4, 1, 0, { variant: 1 });
      R.putX('vagon', 4, -(R.hw - 2.4), 1, 0.04, { variant: 2 });
      R.put('railes', -R.hl + 3.5, -(R.hw - 1.2), 0, 1);
      R.scatter('bobina', 2);
      R.scatter('palet', 3);
      R.scatter('escombros', 2);
      R.scatter('vagoneta', 1);
      for (let i = 0; i < 3; i++) scrap(R);
      loot(R);
      loot(R);
      nest(R, 'rata');
      break;
    }
    case 'tuberias':
      R.scatter('deposito', 1, { variant: 0 });
      R.scatter('barril', 3);
      for (let i = 0; i < 5; i++) {
        const [a, b] = R.random(1);
        R.put('charco', a, b, 1, 0);
      }
      scrap(R, 'salitre');
      scrap(R, 'salitre');
      loot(R);
      break;
    case 'cueva':
      R.scatter('hongosLuz', 7, {}, 1.2);
      R.scatter('escombros', 3);
      nest(R, 'skrebun', 1);
      loot(R);
      scrap(R, 'salitre');
      break;
    case 'inundado':
      // La guarida del glubinnik: agua negra hasta la rodilla
      R.scatter('hongosLuz', 5, {}, 1.2);
      for (let i = 0; i < 8; i++) {
        const [a, b] = R.random(1);
        R.put('charco', a, b, 1, 0, { scale: rng.range(1.2, 2.4) });
      }
      nest(R, 'glubinnik', 1);
      loot(R);
      loot(R);
      scrap(R, 'salitre');
      break;
    case 'anden':
      // El Andén Roto: una estación que nunca llegó a abrir
      R.scatter('escombros', 5);
      R.scatter('banco', 3);
      for (let i = 0; i < 6; i++) {
        const [a, b] = R.random(1.2);
        R.put(rng.chance(0.5) ? 'maleta' : 'huesos', a, b, 1, 0);
      }
      R.scatter('hongosLuz', 3);
      nest(R, 'rata');
      loot(R);
      scrap(R);
      break;
    case 'nido':
      R.scatter('hongosLuz', 5, {}, 1.2);
      for (let i = 0; i < 6; i++) {
        const [a, b] = R.random(1.2);
        R.put('huesos', a, b, 1, 0);
      }
      nest(R, 'skrebun', 1);
      nest(R, 'skrebun', 0);
      loot(R);
      break;
    case 'nicho':
      R.put('huesos', 0.8, 0.6, 1, 0);
      R.put('maleta', -0.9, 0.4, 1, 0);
      loot(R);
      break;
    case 'derrumbe':
      break;
  }
}

// ---------------------------------------------------------------------------
// Túneles
// ---------------------------------------------------------------------------

function decorateAlcove(ctx: DecorCtx, l: LinkGeom, a: Alcove, rng: Rng, wild: boolean, wet: boolean) {
  const place = 'L' + l.index;
  // Marco local: t a lo largo del túnel, o hacia el fondo del nicho
  const tx = Math.cos(a.rot);
  const tz = Math.sin(a.rot);
  const ox = Math.sin(a.rot);
  const oz = -Math.cos(a.rot);
  const w = (s: number, d: number) => ({ x: a.x + tx * s + ox * d, z: a.z + tz * s + oz * d });
  const put = (type: string, s: number, d: number, o: Parameters<DecorCtx['put']>[4] = {}) => {
    const p = w(s, d);
    return ctx.put(type, p.x, p.z, faceDir(-ox, -oz), o);
  };
  const spot = (kind: Parameters<DecorCtx['spot']>[0], s: number, d: number, data?: string) => {
    const p = w(s, d);
    ctx.spot(kind, p.x, p.z, lookDir(-ox, -oz), place, data);
    if (kind !== 'nido') ctx.reserveCircle(p.x, p.z, kind === 'chatarra' ? 1.6 : 1.0);
  };
  const back = a.hw - 0.9;
  const r = rng.next();
  if (wild) {
    if (r < 0.4) {
      const kind = l.terrain === 'auxiliarPeligroso' ? (rng.chance(0.5) ? 'skrebun' : 'rata') : rng.chance(0.3) ? 'skrebun' : 'rata';
      put('nido', 0, back * 0.3, { ghost: true, variant: kind === 'skrebun' ? 1 : 0 });
      spot('nido', 0, back * 0.3, kind);
      put('huesos', rng.range(-2, 2), -0.4);
      put('huesos', rng.range(-2, 2), 0.6);
    } else if (r < 0.65) {
      // El alijo de alguien que no volvió
      spot('botin', rng.range(-1, 1), back * 0.5);
      put('huesos', rng.range(-1.6, 1.6), -0.2, { variant: 2 });
      put('maleta', rng.range(-2, 2), 0.2);
      put('hongosLuz', -a.hl + 1, back);
    } else if (r < 0.82) {
      spot('chatarra', 0, back * 0.3, wet ? 'salitre' : undefined);
      put('escombros', a.hl - 1.4, back * 0.4);
    } else {
      put('hongosLuz', -1.2, back);
      put('hongosLuz', 1.4, back * 0.6);
      put('escombros', 0, back * 0.5);
    }
    return;
  }
  if (r < 0.3) {
    put('cajas', -a.hl * 0.4, back);
    put(rng.chance(0.5) ? 'barril' : 'bobina', a.hl * 0.35, back * 0.8);
    if (rng.chance(0.35)) spot('botin', a.hl * 0.1, back * 0.1);
  } else if (r < 0.5) {
    spot('chatarra', 0, back * 0.2, wet ? 'salitre' : undefined);
    put('escombros', -a.hl + 1.5, back * 0.5);
  } else if (r < 0.66) {
    // Alto de caminantes: un bidón encendido y cajas por asiento
    put('bidonFuego', 0, back * 0.5);
    put('caja', -1.4, back * 0.6);
    put('caja', 1.5, back * 0.3);
    if (rng.chance(0.4)) spot('botin', a.hl - 1.2, back * 0.4);
  } else if (r < 0.76) {
    const p = w(0, back * 0.4);
    ctx.put('vagoneta', p.x, p.z, alignX(tx, tz));
  } else if (r < 0.88) {
    put('escombros', rng.range(-1, 1), back * 0.5);
    put('palet', a.hl * 0.5, back * 0.8);
  }
}

export function decorateLink(ctx: DecorCtx, l: LinkGeom) {
  const rng = new Rng(seedFrom('tunel', l.index));
  const wild = l.terrain === 'peligroso' || l.terrain === 'auxiliarPeligroso' || l.terrain === 'derrumbe';
  const underRiver = (s: number) => l.underRiver.some(([a, b]) => s >= a && s <= b);
  for (const a of l.alcoves) decorateAlcove(ctx, l, a, rng, wild, underRiver(a.s) || l.terrain.startsWith('auxiliar'));
  // Goteras bajo el río
  for (const [s0, s1] of l.underRiver) {
    for (let s = s0 + rng.range(0, 6); s < s1; s += rng.range(5, 12)) {
      const p = linkPointAt(l, s);
      const off = rng.range(-1, 1) * (p.hw - 0.8);
      ctx.put('charco', p.x - p.dz * off, p.z + p.dx * off, rng.range(0, 6), { scale: rng.range(0.7, 1.5) });
    }
  }
  if (wild) {
    let s = rng.range(15, 40);
    while (s < l.length - 15) {
      const p = linkPointAt(l, s);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = (p.hw - 0.9) * side;
      const x = p.x - p.dz * off;
      const z = p.z + p.dx * off;
      const r = rng.next();
      if (r < 0.55) ctx.put('hongosLuz', x, z, rng.range(0, 6));
      else if (r < 0.75) ctx.put('huesos', x, z, rng.range(0, 6));
      else if (r < 0.87) ctx.put('maleta', x, z, rng.range(0, 6));
      else ctx.put('escombros', p.x - p.dz * (p.hw - 1.3) * side, p.z + p.dx * (p.hw - 1.3) * side, rng.range(0, 6));
      s += rng.range(16, 40);
    }
  }
  // Semáforos al acercarse a una estación
  if (l.terrain === 'linea' || l.terrain === 'tunel') {
    for (const [isStation, s] of [
      [!!ctx.layout.stationById[l.a], 16],
      [!!ctx.layout.stationById[l.b], l.length - 16],
    ] as [boolean, number][]) {
      if (!isStation || l.length < 60) continue;
      const p = linkPointAt(l, s);
      const nx = -p.dz;
      const nz = p.dx;
      ctx.put('senal', p.x + nx * (p.hw - 0.04), p.z + nz * (p.hw - 0.04), faceDir(-nx, -nz), { wall: [nx, nz], y: 2.5 });
    }
  }
}
