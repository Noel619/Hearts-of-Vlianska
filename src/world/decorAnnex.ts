// Amueblado de las salas anejas. Cada uso tiene su programa (el vestíbulo con
// torniquetes y taquilla, el hospital con camas y biombos, la escuela con
// pupitres…), su luz y los puntos de actividad de quienes lo ocupan.

import { annexFloorAt, annexPoint, escalatorPlan, type Annex, type AnnexUse } from './arch';
import { faceDir, type PutOptions, type SpotKind } from './decorCore';
import { BLOCKS, SlotCtx, type Band, type SlotFrame, type St } from './decorStationKit';

const BULB = 0xffd9a0;

/** Argumentos de cada sala (figuras de la historia, tipo de tienda…), por estación e id de sala. */
const ARGS: Record<string, Record<string, string[]>> = {
  SEV: { stalkers: ['nor_arkhipova'] },
  UBE: { hospital: ['nor_sidorov'], despacho: ['lebedeva'] },
  IND: { hornos: ['zhdanov'], talleres: ['chatarrero', 'armas'] },
  KHO: { mando: ['bessmertny'] },
  STA: { caravasar: ['sta_fedorova'], aduana: ['orlova'], santuario: ['sta_lazarev'] },
  TSE: { union: ['volkov'], comisaria: ['uni_gromov'] },
  VHL: { guarida: ['rybak'] },
  STL: { consejo: ['morozov'], biblioteca: ['lev_smirnov'] },
  MER: { mezquita: ['karimov'] },
  ZVE: { conferencia: ['uni_kuznetsov', 'yefimova'] },
  CHE: { mando: ['voronov', 'dragunov'] },
  MOS: { taller: ['armas'] },
  VYS: {},
};

/** Marco de trabajo de una sala: x a lo ancho (0 en el centro), t hacia el fondo desde la puerta. */
export class Room {
  readonly S: SlotCtx;
  readonly W: number;
  readonly D: number;
  readonly frame: SlotFrame;
  readonly doorX: number;
  readonly doorW: number;
  readonly args: string[];
  private n = 0;

  constructor(
    readonly st: St,
    readonly a: Annex,
    readonly index: number,
  ) {
    let fr: SlotFrame;
    if (a.dv !== 0) fr = { ou: (a.u0 + a.u1) / 2, ov: a.dv > 0 ? a.v0 : a.v1, xu: 1, xv: 0, tu: 0, tv: a.dv };
    else fr = { ou: a.du > 0 ? a.u0 : a.u1, ov: (a.v0 + a.v1) / 2, xu: 0, xv: 1, tu: a.du, tv: 0 };
    this.frame = fr;
    this.W = a.dv !== 0 ? a.u1 - a.u0 : a.v1 - a.v0;
    this.D = a.dv !== 0 ? a.v1 - a.v0 : a.u1 - a.u0;
    const band: Band = { u0: a.u0, u1: a.u1, v0: fr.ov, dv: 1, D: this.D, kind: 'side' };
    this.S = new SlotCtx(st, band, fr.ou, this.W, this.D, index, fr, 1);
    const d = a.doors[0];
    if (d) {
      const du = (d.u0 + d.u1) / 2 - fr.ou;
      const dv = (d.v0 + d.v1) / 2 - fr.ov;
      this.doorX = du * fr.xu + dv * fr.xv;
      this.doorW = a.dv !== 0 ? d.u1 - d.u0 : d.v1 - d.v0;
      // Paso libre desde la puerta hacia dentro
      this.reserve(this.doorX - this.doorW / 2 - 0.25, this.doorX + this.doorW / 2 + 0.25, -0.5, Math.min(2.4, this.D * 0.35));
    } else {
      this.doorX = 0;
      this.doorW = 0;
    }
    this.args = ARGS[st.id]?.[a.id] ?? [];
  }

  /** Coordenadas locales de estación de un punto de la sala. */
  uv(x: number, t: number): [number, number] {
    return this.S.uv(x, t);
  }

  /** Altura del suelo en un punto de la sala. */
  y(x: number, t: number): number {
    const [u, v] = this.uv(x, t);
    return annexFloorAt(this.a, u, v);
  }

  reserve(x0: number, x1: number, t0: number, t1: number) {
    const [ua, va] = this.uv(x0, t0);
    const [ub, vb] = this.uv(x1, t1);
    this.st.reserve(Math.min(ua, ub), Math.max(ua, ub), Math.min(va, vb), Math.max(va, vb));
  }

  put(type: string, x: number, t: number, dx: number, dt: number, o: PutOptions = {}) {
    return this.S.put(type, x, t, dx, dt, o);
  }
  putX(type: string, x: number, t: number, dx: number, dt: number, o: PutOptions = {}) {
    return this.S.putX(type, x, t, dx, dt, o);
  }
  spot(kind: SpotKind, x: number, t: number, dx: number, dt: number, data?: string, extra?: { side?: import('../data/tipos').SideId; shop?: string }) {
    return this.S.spot(kind, x, t, dx, dt, data, extra);
  }
  seat(x: number, t: number, dx: number, dt: number, data?: string) {
    this.S.seat(x, t, dx, dt, data);
  }
  bench(x: number, t: number, dx: number, dt: number) {
    this.S.bench(x, t, dx, dt);
  }
  table(x: number, t: number, recruit = false) {
    return this.S.table(x, t, recruit);
  }

  /** Ejecuta un bloque del kit de andén en un hueco de la sala (de cara a t0). */
  block(name: string, x: number, w: number, t0: number, d: number, arg = '', arg2 = '') {
    const def = BLOCKS[name];
    if (!def || w < def.minW || d < def.minD) return false;
    const [ou, ov] = this.uv(x, t0);
    const fr: SlotFrame = { ou, ov, xu: this.frame.xu, xv: this.frame.xv, tu: this.frame.tu, tv: this.frame.tv };
    const band: Band = { u0: this.a.u0, u1: this.a.u1, v0: ov, dv: 1, D: d, kind: 'side' };
    def.fn(new SlotCtx(this.st, band, ou, w - 0.3, d, this.index * 7 + this.n++, fr, 1), arg, arg2);
    return true;
  }

  /** Pieza de pared: en el fondo ('back') o en un costado ('left' x = −W/2, 'right' x = +W/2). */
  wall(type: string, side: 'back' | 'left' | 'right' | 'front', pos: number, h: number, o: PutOptions = {}) {
    let x: number;
    let t: number;
    let ndx: number;
    let ndt: number;
    if (side === 'back') {
      x = pos;
      t = this.D - 0.04;
      ndx = 0;
      ndt = 1;
    } else if (side === 'front') {
      x = pos;
      t = 0.04;
      ndx = 0;
      ndt = -1;
    } else {
      x = side === 'left' ? -this.W / 2 + 0.04 : this.W / 2 - 0.04;
      t = pos;
      ndx = side === 'left' ? -1 : 1;
      ndt = 0;
    }
    const [u, v] = this.uv(x, t);
    const [du, dv] = this.S.dir(ndx, ndt);
    const [nx, nz] = this.st.wd(du, dv);
    const p = this.st.w(u, v);
    return this.st.ctx.put(type, p.x, p.z, faceDir(-nx, -nz), { ...o, wall: [nx, nz], y: annexFloorAt(this.a, u, v) + h });
  }

  /** Luz suelta a una altura sobre el suelo. */
  light(x: number, t: number, h: number, color: number, intensity: number, radius: number, kind: 'lamp' | 'fire' | 'spot' | 'glow' = 'lamp', flicker = 0) {
    const [u, v] = this.uv(x, t);
    const p = this.st.w(u, v);
    this.st.ctx.light(p.x, annexFloorAt(this.a, u, v) + h, p.z, color, intensity, radius, kind, flicker);
  }

  /** Lámparas en los costados (y en el fondo si la sala es ancha). */
  lamps(type: 'fluorescente' | 'lamparaPared' | 'bombilla', step = 6.5) {
    const n = Math.max(1, Math.round((this.D - 1) / step));
    for (let i = 0; i < n; i++) {
      const t = (this.D * (i + 0.5)) / n;
      this.wall(type, 'left', t, 2.6);
      if (this.W > 6) this.wall(type, 'right', t, 2.6);
    }
    if (this.W > 13) {
      const m = Math.round(this.W / 9);
      for (let i = 0; i < m; i++) this.wall(type, 'back', -this.W / 2 + (this.W * (i + 0.5)) / m, 2.7);
    }
  }

  /** Posiciones repartidas a lo ancho, evitando el paso de la puerta. */
  spread(n: number, margin = 1.2): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(-this.W / 2 + margin + ((this.W - margin * 2) * (i + 0.5)) / n);
    return out;
  }
}

// ---------------------------------------------------------------------------
// Programas por uso
// ---------------------------------------------------------------------------

type Decorator = (R: Room, all: Annex[]) => void;

const childOf = (R: Room, all: Annex[]) => all.find((o) => o.parent === R.a.id) ?? null;

/** Literas a lo largo del fondo; devuelve cuántas cupieron. */
function bunks(R: Room, x0: number, x1: number, t: number) {
  let k = 0;
  for (let x = x0; x + 0.9 <= x1; x += 2.3) {
    if (R.putX('litera', x + 1.0, t, 1, 0)) {
      if (k % 2 === 0) R.spot('cama', x + 1.0, t, 1, 0);
      k++;
    }
  }
  return k;
}

const DECOR: Partial<Record<AnnexUse, Decorator>> = {
  vestibulo: (R, all) => {
    const child = childOf(R, all);
    const W = R.W;
    const D = R.D;
    R.lamps('lamparaPared', 6);
    if (child?.exit) {
      // Puesto de salida a la superficie: torniquetes, taquilla, máscaras y la guardia de stalkers
      const tt = D * 0.52;
      for (const s of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          const x = s * (1.6 + k * 0.85);
          if (Math.abs(x) < W / 2 - 1.6) R.put('torniquete', x, tt, 0, -1);
        }
      }
      R.put('taquilla', -W / 2 + 1.6, D - 1.3, 1, -1);
      R.spot('vendedor', -W / 2 + 2.6, D - 2.9, -0.3, -1, 'medico');
      R.put('taquillas', W / 2 - 0.4, D - 2.2, -1, 0, { variant: 1 });
      R.wall('mascaras', 'right', D - 5.2, 1.7);
      R.wall('cartelAviso', 'back', -2.6, 2.4, { variant: 0 });
      R.wall('cartelAviso', 'back', 2.6, 2.4, { variant: 2 });
      R.bench(-W / 2 + 1.2, 1.4, 1, 0);
      R.bench(W / 2 - 1.2, 1.6, -1, 0);
      R.put('estufa', -W / 2 + 1.0, tt - 2.2, 1, 0);
      R.seat(-W / 2 + 2.0, tt - 2.3, -1, 0, 'fuego');
      R.spot('guardia', -1.0, tt + 1.4, 0, -1, 'stalker');
      R.spot('guardia', 1.0, tt + 1.4, 0, -1, 'stalker');
      R.spot('ocio', W / 2 - 2.4, tt - 1.5, -1, 0.3);
      R.put('colgante', 0, tt - 1.8, 0, 1);
      return;
    }
    if (child?.sealed) {
      // Salida tapiada: parapeto ante las escaleras, tablón de anuncios y un retén de guardia
      for (const x of [-child.width / 2 - 0.4, child.width / 2 + 0.4]) R.putX('sacosAlto', x * 0.7, D - 1.2, 1, 0);
      R.wall('cartelAviso', 'back', -W / 2 + 1.6, 2.4, { variant: 1 });
      R.wall('cartelAviso', 'back', W / 2 - 1.6, 2.4, { variant: 0 });
      R.put('tablon', -W / 2 + 0.5, D * 0.45, 1, 0);
      if (R.put('mesa', W / 2 - 1.4, D * 0.4, -1, 0, { variant: 0 })) {
        R.seat(W / 2 - 2.4, D * 0.4, 1, 0);
        R.spot('guardia', W / 2 - 0.6, D * 0.4 - 1.2, -1, 0);
      }
      R.spot('guardia', -1.4, D - 2.6, 0, -1);
      R.spot('guardia', 1.5, D - 2.4, 0, -1);
      if (W >= 14) {
        // El refugio de la defensa civil: literas y víveres a los lados
        bunks(R, -W / 2 + 0.4, -W / 2 + 5.2, 1.0);
        R.put('cajas', -W / 2 + 1.2, D * 0.45 + 2.3, 1, 0);
        R.put('barriles', W / 2 - 1.1, 1.3, -1, 0);
      }
      R.bench(-1.0, 1.2, 0, 1);
      R.spot('ocio', 1.2, 1.6, -0.5, 1);
      return;
    }
    R.put('tablon', 0, D - 0.4, 0, -1);
    R.bench(-W / 2 + 1.2, D * 0.5, 1, 0);
    R.bench(W / 2 - 1.2, D * 0.5, -1, 0);
    R.spot('ocio', 0.5, D * 0.5, 0, 1);
  },

  escaleras: (R) => {
    const a = R.a;
    const plan = escalatorPlan(a);
    const f = R.st.f;
    // Farolas de las balaustradas (o lámparas de pared en la escalera de servicio)
    if (plan.kind === 'mecanica') {
      for (const s of plan.rails) {
        for (const t of plan.lamps) {
          const [u, v] = annexPoint(a, t, s);
          const p = R.st.w(u, v);
          R.st.ctx.light(p.x, annexFloorAt(a, u, v) + 2.4, p.z, 0xffcf8a, 0.55, 9, 'lamp');
        }
      }
    } else {
      for (const t of plan.lamps) {
        R.wall('lamparaPared', 'left', t, 2.4);
        R.wall('lamparaPared', 'right', t + 4, 2.4);
      }
    }
    if (a.sealed) {
      // Las puertas herméticas, cerradas desde 2013
      R.wall('puertaBlindada', 'back', 0, 0, { scale: Math.min(2.4, (R.W - 0.6) / 3.6) });
      R.wall('cartelAviso', 'left', R.D - 3.5, 2.2, { variant: 1 });
      R.putX('sacos', 0, R.D - 4.6, 1, 0, { aisle: true });
      R.put('bidonFuego', R.W / 2 - 1.0, R.D - 5.5, 0, -1, { aisle: true });
    } else {
      R.wall('cartelAviso', 'left', 2.5, 2.2, { variant: 0 });
    }
    void f;
  },

  rampa: (R) => {
    for (let t = 3; t < R.D - 2; t += 7) {
      R.wall('lamparaPared', 'left', t, 2.6);
      R.wall('lamparaPared', 'right', t + 3.5, 2.6);
    }
    R.put('cabrestante', R.W / 2 - 1.3, 1.6, -1, 0, { aisle: true });
    R.spot('trabajo', R.W / 2 - 2.6, 1.6, 1, 0, 'operar');
    R.put('vagonetaCarga', -1.3, R.D * 0.35, 0, 1, { aisle: true });
    R.put('palet', -R.W / 2 + 1.0, 1.2, 0, 1, { aisle: true });
    R.wall('cartelAviso', 'left', 1.2, 2.2, { variant: 0 });
    R.spot('guardia', -1.4, 2.6, 0, -1);
    R.spot('guardia', 1.4, 2.6, 0, -1);
  },

  pozo: (R, all) => {
    const c = childOf(R, all);
    const tc = R.D / 2;
    if (R.put('pozoAire', 0, tc, 0, 1, { aisle: true })) R.spot('trabajo', -3.9, tc, 1, 0, 'operar');
    R.put('bidonFuego', R.W / 2 - 2.6, 2.6, 0, 1);
    R.spot('ocio', R.W / 2 - 3.6, 3.4, 0.7, -0.5, 'fuego');
    R.spot('ocio', R.W / 2 - 1.8, 3.6, -0.4, -0.7, 'fuego');
    R.wall('cartelAviso', 'left', tc, 2.2, { variant: c ? 2 : 1 });
    R.light(0, 1.0, 3.2, 0xa9c8ff, 0.35, 10);
    if (c) R.spot('guardia', 0.4, R.D - 1.8, 0, -1, 'elite');
  },

  stalkers: (R) => {
    const fig = R.args[0];
    R.lamps('lamparaPared', 6);
    bunks(R, -R.W / 2 + 0.3, 0.4, R.D - 0.7);
    R.put('taquillas', R.W / 2 - 1.5, R.D - 0.35, 0, -1, { variant: 1 });
    R.put('arsenal', R.W / 2 - 0.45, R.D * 0.5, -1, 0, { variant: 1, tint: R.st.tint });
    R.wall('mascaras', 'left', R.D * 0.45, 1.7);
    if (R.put('mesa', 0.8, R.D * 0.45, 0, -1, { variant: 1 })) {
      R.seat(-0.3, R.D * 0.45, 1, 0);
      R.seat(1.9, R.D * 0.45, -1, 0);
      R.put('colgante', 0.8, R.D * 0.45, 0, 1);
    }
    if (fig) R.spot('figura', 0.8, R.D * 0.45 + 1.2, 0, -1, fig);
    R.table(-R.W / 2 + 2.0, 2.2, true);
    R.put('cajas', R.W / 2 - 1.3, 1.2, 0, -1);
    R.spot('guardia', R.doorX - 1.6, 0.6, 0, -1, 'stalker');
  },

  descontaminacion: (R) => {
    R.lamps('fluorescente', 5);
    const xs = R.spread(3, 1.2);
    xs.forEach((x, i) => {
      if (i === 1) return;
      R.put('ducha', x, R.D - 0.75, 0, -1);
    });
    R.put('deposito', xs[1], R.D - 1.1, 0, -1, { variant: 0 });
    R.putX('biombo', -1.6, R.D * 0.45, 1, 0);
    R.putX('camilla', -R.W / 2 + 1.2, 1.5, 0, 1, { variant: 1 });
    R.put('armario', R.W / 2 - 0.6, 1.0, -1, 0);
    R.spot('medico', 1.2, R.D * 0.42, 0, -1, 'medico');
    R.spot('trabajo', -0.4, R.D - 2.0, 0, 1, 'operar');
    R.wall('cartelAviso', 'right', R.D * 0.5, 2.3, { variant: 0 });
  },

  bombas: (R) => {
    R.lamps('bombilla', 5);
    R.put('bomba', -R.W / 2 + 1.6, R.D - 1.0, 0, -1);
    R.put('bomba', R.W / 2 - 1.6, R.D - 1.0, 0, -1);
    R.wall('tuberia', 'back', 0, 2.8, { variant: 1 });
    R.put('charco', 0.4, R.D * 0.45, 0, 1);
    R.put('deposito', 0, R.D - 1.1, 0, -1, { variant: 1 });
    R.spot('trabajo', -R.W / 2 + 1.6, R.D - 2.2, 0, 1, 'operar');
  },

  hospital: (R) => {
    const fig = R.args[0];
    R.lamps('fluorescente', 5.5);
    // Camas en fila a lo largo del fondo y de un costado, separadas por biombos
    const n = Math.max(2, Math.floor((R.W - 2.6) / 2.4));
    for (let i = 0; i < n; i++) {
      const x = -R.W / 2 + 1.3 + i * 2.4;
      if (Math.abs(x - R.doorX) < R.doorW / 2 + 0.6 && R.D < 9) continue;
      if (R.putX('camilla', x, R.D - 1.05, 0, 1, { variant: i % 2 })) {
        if (i % 2 === 0) R.spot('cama', x, R.D - 1.05, 0, -1);
        if (i < n - 1) R.putX('biombo', x + 1.2, R.D - 1.0, 0, 1);
      }
    }
    if (R.D >= 10) {
      // Segunda fila en el centro, pies con pies
      const m = Math.max(1, Math.floor((R.W - 6) / 2.4));
      for (let i = 0; i < m; i++) {
        const x = -R.W / 2 + 3.0 + i * 2.4;
        if (R.putX('camilla', x, R.D * 0.5, 0, 1, { variant: (i + 1) % 2 }) && i % 2 === 1) R.spot('cama', x, R.D * 0.5, 0, 1);
      }
    }
    R.put('armario', R.W / 2 - 0.6, R.D - 0.45, 0, -1);
    R.put('armario', R.W / 2 - 1.8, R.D - 0.45, 0, -1);
    if (R.put('mesa', R.W / 2 - 1.6, 1.6, 0, -1, { variant: 0 })) R.spot('medico', R.W / 2 - 1.6, 2.5, 0, -1, 'medico');
    R.put('estufa', -R.W / 2 + 0.9, 1.2, 1, 0);
    R.bench(-R.W / 2 + 2.4, 1.1, 0, 1);
    if (fig) R.spot('figura', 0, R.D * 0.5 - 1.6, 0, -1, fig);
    R.spot('trabajo', -1.6, R.D - 2.4, 0, 1, 'operar');
    R.spot('trabajo', 2.0, R.D * 0.5 + 1.2, 0, 1, 'operar');
  },

  quirofano: (R) => {
    R.lamps('fluorescente', 5);
    const tc = R.D * 0.55;
    R.putX('camilla', 0, tc, 1, 0, { variant: 1 });
    R.put('foco', 1.6, tc + 1.2, -1, -0.5);
    R.put('armario', -R.W / 2 + 0.6, R.D - 0.5, 1, 0);
    R.put('armario', R.W / 2 - 0.6, R.D - 0.5, -1, 0);
    R.put('mesa', -1.8, tc - 1.6, 1, 0, { variant: 0 });
    R.putX('biombo', 0, 1.6, 1, 0);
    R.spot('trabajo', -1.2, tc, 1, 0, 'operar');
    R.spot('trabajo', 1.2, tc - 0.6, -1, 0.2, 'operar');
    R.spot('medico', R.W / 2 - 1.6, 1.4, -0.3, -1, 'medico');
  },

  despacho: (R) => {
    const [fig, fig2] = R.args;
    R.lamps('lamparaPared', 5);
    const tm = R.D - 2.0;
    R.put('alfombra', 0, tm - 1.6, 0, -1, { variant: 0 });
    R.put('mesa', 0, tm, 0, -1, { variant: 1 });
    if (fig) R.spot('lider', 0, tm + 0.9, 0, -1, fig);
    else R.spot('guardia', 0, tm + 0.9, 0, -1, 'oficial');
    R.put('bandera', -1.8, R.D - 0.4, 0, -1, { tint: R.st.tint, variant: R.st.emblem });
    R.put('bandera', 1.8, R.D - 0.4, 0, -1, { tint: R.st.tint, variant: R.st.emblem });
    R.wall('estandarte', 'back', 0, 3.6, { tint: R.st.tint, variant: R.st.emblem });
    R.put('estanteria', -R.W / 2 + 0.35, R.D * 0.5, 1, 0);
    R.put('fichero', -R.W / 2 + 0.45, R.D * 0.5 + 1.6, 1, 0);
    R.put('cajaFuerte', R.W / 2 - 0.6, R.D - 0.6, -1, 0);
    R.put('radio', R.W / 2 - 0.6, R.D * 0.45, -1, 0);
    R.spot('trabajo', R.W / 2 - 1.6, R.D * 0.45, 1, 0, 'operar');
    if (R.W >= 14 && R.put('mesa', -R.W / 2 + 3.6, 2.4, 0, -1, { variant: 0 })) {
      R.seat(-R.W / 2 + 2.5, 2.4, 1, 0);
      R.seat(-R.W / 2 + 4.7, 2.4, -1, 0);
      R.put('colgante', -R.W / 2 + 3.6, 2.4, 0, 1);
    }
    if (fig2) R.spot('figura', 2.2, tm - 1.2, -0.5, -1, fig2);
    R.spot('guardia', R.doorX - 1.4, 0.8, 0, -1, 'elite');
    R.spot('guardia', R.doorX + 1.4, 0.8, 0, -1, 'elite');
  },

  hornos: (R) => {
    const fig = R.args[0];
    R.lamps('lamparaPared', 7);
    for (const s of [-1, 1]) {
      const x = s * (R.W / 2 - 3.2);
      if (R.put('horno', x, R.D - 2.2, 0, -1)) {
        R.spot('trabajo', x, R.D - 4.6, 0, 1, 'operar');
        R.spot('trabajo', x - s * 2.6, R.D - 3.4, s, 0.4, 'martillo');
      }
      R.putX('cinta', x * 0.55, R.D * 0.42, 0, 1);
      R.put('chatarra', s * (R.W / 2 - 1.5), R.D * 0.32, 0, 1);
      R.put('generador', s * (R.W / 2 - 1.2), 1.4, 0, 1);
    }
    if (R.put('fragua', 0, R.D - 1.4, 0, -1)) R.spot('trabajo', 0, R.D - 2.9, 0, 1, 'martillo');
    R.put('bobina', -2.2, R.D * 0.6, 0, 1);
    R.put('palet', 2.4, R.D * 0.62, 0, 1);
    R.put('carretilla', 1.0, 2.8, 1, 0.3);
    if (fig) R.spot('figura', R.doorX + 2.6, 2.0, 0, 1, fig);
    R.spot('guardia', R.doorX - 2.8, 1.2, 0, -1, 'elite');
    R.spot('guardia', R.doorX + 4.2, 1.0, 0, -1, 'elite');
  },

  talleres: (R) => {
    R.lamps('lamparaPared', 6);
    const n = Math.max(1, Math.floor(R.W / 6.2));
    const w = R.W / n;
    for (let i = 0; i < n; i++) {
      const x = -R.W / 2 + w * (i + 0.5);
      R.block('taller', x, w, R.D - 4.6, 4.6, R.args[i] ?? '');
    }
    R.put('chatarra', -R.W / 2 + 1.4, 1.6, 0, 1);
    R.put('barriles', R.W / 2 - 1.2, 1.4, 0, 1);
    R.spot('ocio', 0.6, 2.4, 0, 1);
  },

  municion: (R) => {
    R.lamps('bombilla', 5);
    for (const x of R.spread(Math.max(2, Math.floor(R.W / 2.6)), 1.0)) R.put('estanteria', x, R.D - 0.35, 0, -1, { variant: 1 });
    R.put('cajas', -R.W / 2 + 1.2, R.D * 0.45, 0, 1);
    R.put('cajas', R.W / 2 - 1.2, R.D * 0.5, 0, 1);
    R.put('arsenal', R.W / 2 - 0.45, 1.6, -1, 0, { variant: 0, tint: R.st.tint });
    R.put('cajaFuerte', -R.W / 2 + 0.6, 1.0, 1, 0);
    R.spot('guardia', R.doorX + 1.6, 0.8, 0, -1, 'elite');
    R.spot('trabajo', 0.6, R.D - 1.6, 0, 1, 'operar');
  },

  casamata: (R) => {
    R.lamps('bombilla', 5);
    R.block('cuartel', -R.W / 4, R.W / 2, 0, R.D);
    R.block('armeria', R.W / 4, R.W / 2, R.D - 4.0, 4.0);
    R.table(R.W / 4, 1.6);
  },

  calabozo: (R) => {
    R.lamps('bombilla', 5);
    const n = Math.max(2, Math.floor((R.W - 2) / 2.2));
    for (let i = 0; i < n; i++) R.put('jaula', -R.W / 2 + 1.3 + i * 2.2, R.D - 1.0, 0, -1);
    if (R.put('mesa', R.W / 2 - 1.4, 1.4, -1, 0, { variant: 0 })) R.seat(R.W / 2 - 2.4, 1.4, 1, 0);
    R.spot('guardia', 0.4, R.D - 2.6, 0, 1);
    R.put('barril', -R.W / 2 + 0.6, 1.0, 0, 1);
  },

  armeria: (R) => {
    R.lamps('bombilla', 5);
    R.block('armeria', 0, R.W, R.D - 4.2, 4.2);
    R.put('cajas', -R.W / 2 + 1.2, 1.4, 0, 1);
  },

  caravasar: (R) => {
    const fig = R.args[0];
    R.lamps('lamparaPared', 6);
    // Comedor de la posada: dos mesas largas bajo las bombillas
    for (const s of [-1, 1]) {
      const x = s * 3.2;
      const t = R.D * 0.42;
      if (R.put('mesaLarga', x, t, 0, 1)) {
        for (const k of [-1.1, 0, 1.1]) {
          R.spot('asiento', x + k, t - 0.75, 0, 1, 'banco');
          R.spot('asiento', x + k + 0.3, t + 0.75, 0, -1, 'banco');
        }
        R.put('colgante', x, t, 0, 1);
      }
    }
    // Barra al fondo y literas para los viajeros
    if (R.put('barra', R.W / 2 - 3.2, R.D - 1.6, 0, -1)) R.spot('bar', R.W / 2 - 3.2, R.D - 0.7, 0, -1, 'bar');
    R.put('barriles', R.W / 2 - 0.9, R.D - 0.8, 0, -1);
    bunks(R, -R.W / 2 + 0.3, -R.W / 2 + 7.0, R.D - 0.7);
    // Carga de las caravanas
    R.put('vagonetaCarga', -R.W / 2 + 1.6, 2.2, 1, 0);
    R.putX('sacos', R.W / 2 - 1.3, 2.0, 1, 0);
    R.put('cajas', R.W / 2 - 1.2, 3.6, 0, 1);
    if (fig) R.spot('figura', -R.W / 2 + 3.2, 2.4, 1, 0.3, fig, { shop: 'caravana' });
    R.table(0, R.D - 2.0, true);
    R.put('guirnalda', 0, R.D * 0.42, 0, 1);
    R.spot('guardia', R.doorX + 1.8, 0.7, 0, -1);
  },

  aduana: (R) => {
    const fig = R.args[0];
    R.lamps('lamparaPared', 5);
    if (R.put('barra', 0, R.D * 0.42, 0, -1)) R.spot('peaje', 0.3, R.D * 0.42 + 0.95, 0, -1, 'oficial');
    R.put('cajas', -R.W / 2 + 1.3, 1.4, 0, 1);
    R.put('cajas', -R.W / 2 + 1.3, 3.3, 0, 1);
    R.put('cajaFuerte', R.W / 2 - 0.6, R.D - 0.6, -1, 0);
    R.put('fichero', -R.W / 2 + 0.45, R.D - 0.6, 1, 0);
    if (R.put('mesa', 1.2, R.D - 1.6, 0, -1, { variant: 1 })) {
      if (fig) R.spot('lider', 1.2, R.D - 0.75, 0, -1, fig);
      R.put('bandera', 3.0, R.D - 0.4, 0, -1, { tint: R.st.tint, variant: R.st.emblem });
    }
    R.spot('guardia', R.W / 2 - 1.2, 1.0, -0.5, -1, 'oficial');
    R.spot('guardia', R.doorX - 1.5, 0.8, 0, -1);
  },

  almacen: (R) => {
    R.lamps('bombilla', 6);
    const n = Math.max(1, Math.floor(R.W / 5.2));
    const w = R.W / n;
    for (let i = 0; i < n; i++) R.block('almacen', -R.W / 2 + w * (i + 0.5), w, R.D - Math.min(5.4, R.D - 1), Math.min(5.4, R.D - 1));
    R.put('sacos', 0.5, 1.6, 1, 0);
  },

  santuario: (R) => {
    const fig = R.args[0];
    R.block('santuario', 0, Math.min(R.W, 6), R.D - 3.4, 3.4, fig);
    R.put('velas', -R.W / 2 + 0.8, R.D - 0.8, 0, -1);
    R.put('velas', R.W / 2 - 0.8, R.D - 0.8, 0, -1);
    R.wall('cartel', 'back', 0, 2.5, { variant: 3 });
    R.bench(-1.4, R.D * 0.35, 0, 1);
    R.bench(1.4, R.D * 0.35, 0, 1);
    R.light(0, R.D - 1.2, 1.6, 0xffb060, 0.5, 9, 'fire', 1);
  },

  comisaria: (R) => {
    R.lamps('fluorescente', 5);
    R.block('comisaria', 0, R.W - 2, R.D - 5.0, 5.0, R.args[0] ?? '');
    R.put('jaula', -R.W / 2 + 1.0, 1.6, 0, 1);
    R.put('fichero', R.W / 2 - 0.45, 1.2, -1, 0);
    R.bench(R.W / 2 - 1.3, 2.6, -1, 0);
  },

  correos: (R) => {
    R.lamps('lamparaPared', 5);
    R.block('correos', 0, Math.min(R.W, 7.5), R.D - 4.4, 4.4);
    R.put('estanteria', -R.W / 2 + 0.35, R.D * 0.4, 1, 0);
    R.put('fichero', R.W / 2 - 0.45, 1.2, -1, 0);
    R.spot('ocio', -1.2, 1.4, 0, 1);
  },

  cambio: (R) => {
    R.lamps('lamparaPared', 5);
    if (R.put('barra', 0, R.D * 0.5, 0, -1)) R.spot('vendedor', 0, R.D * 0.5 + 0.95, 0, -1, 'bazar');
    R.put('cajaFuerte', -1.2, R.D - 0.6, 0, -1);
    R.put('cajaFuerte', 0.2, R.D - 0.6, 0, -1);
    R.spot('guardia', R.W / 2 - 1.0, 1.0, -0.5, -1, 'elite');
    R.bench(-R.W / 2 + 1.2, 1.4, 1, 0);
  },

  defensa: (R) => {
    // Puerta blindada abierta contra el muro y estanterías intactas desde 2013
    R.wall('puertaBlindada', 'front', R.doorX + R.doorW / 2 + 2.0, 0);
    const rows = Math.max(2, Math.floor((R.D - 3) / 2.6));
    for (let r = 0; r < rows; r++) {
      const t = 3.0 + r * 2.6;
      for (const x of [-R.W / 2 + 1.4, -R.W / 2 + 3.4, R.W / 2 - 3.4, R.W / 2 - 1.4]) R.put('estanteria', x, t, 0, 1, { variant: r % 2 });
    }
    for (const x of [-2.2, 0, 2.2]) R.spot('botin', x, R.D - 1.4, 0, -1, 'almacen');
    R.put('cajas', -R.W / 2 + 1.2, R.D - 1.0, 0, -1);
    R.put('cajas', R.W / 2 - 1.2, R.D - 1.0, 0, -1);
    R.put('huesos', 0.6, 2.0, 1, 0);
    R.put('hongosLuz', -R.W / 2 + 0.8, 1.6, 1, 0);
    R.put('hongosLuz', R.W / 2 - 0.8, R.D * 0.5, 1, 0);
  },

  derrumbe: (R) => {
    for (let i = 0; i < 7; i++) R.put('escombros', R.S.rng.range(-R.W / 2 + 1.5, R.W / 2 - 1.5), R.S.rng.range(1.5, R.D - 1), 1, 0);
    for (let i = 0; i < 4; i++) R.put(i % 2 ? 'huesos' : 'maleta', R.S.rng.range(-R.W / 2 + 1, R.W / 2 - 1), R.S.rng.range(1, R.D - 1), Math.cos(i), Math.sin(i));
    R.spot('chatarra', 0, R.D * 0.6, 0, 1, 'chatarra');
  },

  guarida: (R) => {
    R.block('trono', 0, Math.min(R.W, 8), R.D - 5.0, 5.0, R.args[0] ?? '');
    R.put('botin', -R.W / 2 + 1.6, R.D - 1.6, 1, 0, { variant: 0 });
    R.put('botin', R.W / 2 - 1.6, R.D - 1.8, -1, 0, { variant: 1 });
    R.put('alfombra', 0, R.D * 0.35, 0, 1, { variant: 1 });
    R.put('hoguera', -R.W / 2 + 2.2, 2.4, 0, 1);
    R.seat(-R.W / 2 + 3.6, 2.4, -1, 0, 'suelo');
    R.seat(-R.W / 2 + 2.2, 3.8, 0, -1, 'fuego');
  },

  jaulas: (R) => {
    R.block('jaulas', 0, R.W - 1, R.D - 3.6, 3.6);
    R.put('bidonFuego', R.W / 2 - 1.0, 1.2, 0, 1);
    R.put('jaula', -R.W / 2 + 1.0, 1.6, 0, 1);
  },

  botin: (R) => {
    R.block('guarida', 0, Math.min(R.W, 6), R.D - 3.8, 3.8);
    R.put('botin', -R.W / 2 + 1.4, 1.6, 1, 0, { variant: 1 });
    R.put('barriles', R.W / 2 - 1.2, 1.4, 0, 1);
    R.put('bidonFuego', 0.4, 1.4, 0, 1);
  },

  granja: (R) => {
    // Hileras de bancales de hongos bajo lámparas de sodio
    let k = 0;
    for (let t = 2.6; t + 0.8 < R.D; t += 2.2) {
      for (let x = -R.W / 2 + 2.0; x < R.W / 2 - 1.8; x += 3.6) {
        if (Math.abs(x - R.doorX) < R.doorW / 2 + 0.4 && t < 4) continue;
        if (R.putX('bancal', x, t, 1, 0)) {
          if (k % 3 === 0) R.put('lamparaSodio', x, t, 1, 0);
          if (k % 4 === 1) R.spot('trabajo', x, t + 1.0, 0, -1, 'cultivo');
          k++;
        }
      }
    }
    R.put('deposito', -R.W / 2 + 1.3, 1.3, 0, 1, { variant: 0 });
    R.put('carretilla', R.W / 2 - 1.2, 1.4, -1, 0.3);
  },

  porqueriza: (R) => {
    R.lamps('bombilla', 5);
    const n = Math.max(1, Math.floor((R.W - 1) / 4.6));
    for (let i = 0; i < n; i++) R.putX('corral', -R.W / 2 + 2.5 + i * 4.6, R.D - 1.7, 1, 0);
    R.putX('sacos', -R.W / 2 + 1.4, 1.0, 1, 0, { variant: 0 });
    R.put('barril', R.W / 2 - 0.6, 1.0, 0, 1);
    R.spot('trabajo', 0.4, R.D - 3.8, 0, 1, 'cultivo');
    R.spot('trabajo', R.W / 2 - 2.6, R.D - 3.6, 0, 1, 'cultivo');
  },

  consejo: (R) => {
    R.lamps('lamparaPared', 6);
    R.block('asamblea', 0, Math.min(R.W, 8), 0, R.D, R.args[0] ?? '');
    for (const s of [-1, 1]) {
      for (let t = R.D - 3.0; t >= 1.2; t -= 1.4) R.bench(s * (R.W / 2 - 2.6), t, 0, 1);
    }
    R.wall('estandarte', 'back', -R.W / 2 + 2.5, 3.6, { tint: R.st.tint, variant: R.st.emblem });
    R.wall('estandarte', 'back', R.W / 2 - 2.5, 3.6, { tint: R.st.tint, variant: R.st.emblem });
    R.spot('guardia', R.doorX - 2.0, 0.8, 0, -1, 'elite');
  },

  escuela: (R) => {
    R.lamps('fluorescente', 5);
    R.put('pizarra', 0, R.D - 0.55, 0, -1);
    R.spot('trabajo', 1.4, R.D - 1.5, 0, -1, 'escribir');
    for (let t = R.D - 3.2; t >= 1.6; t -= 1.5) {
      for (const x of [-2.8, -1.2, 1.2, 2.8]) {
        if (Math.abs(x) > R.W / 2 - 1) continue;
        if (R.put('pupitre', x, t, 0, 1)) R.spot('asiento', x, t - 0.42, 0, 1);
      }
    }
    R.put('estufa', -R.W / 2 + 0.8, 1.0, 1, 0);
    R.put('estanteria', R.W / 2 - 0.35, R.D * 0.5, -1, 0);
    R.wall('cartel', 'left', R.D * 0.5, 2.3, { variant: 4 });
  },

  biblioteca: (R) => {
    R.lamps('lamparaPared', 5);
    for (let t = R.D - 0.6; t > 3.6; t -= 2.4) {
      for (const x of [-R.W / 2 + 1.6, -R.W / 2 + 3.6]) R.put('estanteria', x, t, 0, -1, { variant: 0 });
    }
    R.put('estanteria', R.W / 2 - 1.2, R.D - 0.35, 0, -1, { variant: 0 });
    if (R.put('mesa', R.W / 2 - 3.2, R.D * 0.5, 0, -1, { variant: 0 })) {
      R.seat(R.W / 2 - 3.2, R.D * 0.5 - 0.85, 0, 1);
      R.seat(R.W / 2 - 3.2, R.D * 0.5 + 0.85, 0, -1);
      R.put('colgante', R.W / 2 - 3.2, R.D * 0.5, 0, 1);
    }
    if (R.args[0]) R.spot('figura', R.W / 2 - 1.6, R.D * 0.5, -1, 0, R.args[0]);
    R.spot('trabajo', -R.W / 2 + 2.6, 2.2, 0, 1, 'escribir');
  },

  cuartel: (R) => {
    R.lamps('bombilla', 5);
    const n = Math.max(1, Math.floor(R.W / 7));
    const w = R.W / n;
    for (let i = 0; i < n; i++) R.block('cuartel', -R.W / 2 + w * (i + 0.5), w, 0, R.D);
  },

  bunker: (R) => {
    R.lamps('bombilla', 5);
    R.block('mando', 0, Math.min(R.W, 8), 0, R.D, R.args[0] ?? '');
    R.put('mesa', -R.W / 2 + 1.4, R.D * 0.45, 1, 0, { variant: 1 });
    R.spot('trabajo', -R.W / 2 + 2.4, R.D * 0.45, -1, 0, 'escribir');
  },

  mezquita: (R) => {
    R.block('mezquita', 0, Math.min(R.W - 1, 8), 0, R.D, R.args[0] ?? '');
    R.lamps('bombilla', 6);
    R.light(0, R.D - 1.0, 1.4, 0xffb060, 0.5, 9, 'fire', 1);
  },

  banos: (R) => {
    R.lamps('fluorescente', 5);
    const xs = R.spread(3, 1.4);
    xs.forEach((x, i) => {
      if (R.put('lavadero', x, R.D - 0.6, 0, -1)) R.spot('trabajo', x, R.D - 1.5, 0, 1, i === 1 ? 'cultivo' : 'operar');
    });
    R.put('ducha', -R.W / 2 + 0.9, 2.0, 1, 0);
    R.put('deposito', R.W / 2 - 1.2, 1.4, 0, 1, { variant: 0 });
    R.put('tendedero', 0, 2.2, 0, 1);
    R.seat(-1.2, 1.2, 0, 1);
  },

  conferencia: (R) => {
    R.lamps('lamparaPared', 6);
    const [a1, a2] = R.args;
    R.block('conferencia', 0, Math.min(R.W, 10), 1.0, R.D - 1.0, a1 ?? '', a2 ?? '');
    for (const s of [-1, 1]) for (let t = 2.0; t < R.D - 2; t += 1.6) R.seat(s * (R.W / 2 - 1.2), t, -s, 0);
    R.wall('estandarte', 'back', 0, 3.6, { tint: R.st.tint, variant: R.st.emblem });
    R.wall('reloj', 'back', -R.W / 2 + 2.5, 3.0);
  },

  archivo: (R) => {
    R.lamps('fluorescente', 5);
    for (const x of R.spread(Math.max(2, Math.floor(R.W / 1.4)), 0.8)) R.put('fichero', x, R.D - 0.45, 0, -1);
    R.put('estanteria', -R.W / 2 + 0.35, R.D * 0.45, 1, 0);
    if (R.put('mesa', 1.0, R.D * 0.4, 0, -1, { variant: 0 })) R.spot('trabajo', 1.0, R.D * 0.4 - 0.8, 0, 1, 'escribir');
  },

  fundicion: (R) => {
    R.lamps('lamparaPared', 6);
    const n = Math.max(1, Math.floor(R.W / 7.5));
    const w = R.W / n;
    for (let i = 0; i < n; i++) R.block('fundicion', -R.W / 2 + w * (i + 0.5), w, R.D - 5.2, 5.2);
    R.put('chatarra', -R.W / 2 + 1.5, 1.6, 0, 1);
    R.put('railes', R.W / 2 - 2.4, 1.2, 0, 1);
  },

  arsenal: (R) => {
    R.wall('puertaBlindada', 'front', R.doorX + R.doorW / 2 + 2.0, 0);
    R.lamps('bombilla', 5);
    for (const s of [-1, 1]) for (let t = 2.6; t < R.D - 1; t += 3.2) R.put('arsenal', s * (R.W / 2 - 0.45), t, -s, 0, { variant: Math.round(t) % 2, tint: R.st.tint });
    R.put('arsenal', -2.6, R.D - 0.45, 0, -1, { variant: 0, tint: R.st.tint });
    R.put('arsenal', 2.6, R.D - 0.45, 0, -1, { variant: 1, tint: R.st.tint });
    R.spot('botin', -3.4, R.D - 1.8, 0, -1, 'arsenal');
    R.spot('botin', 3.4, R.D - 1.8, 0, -1, 'arsenal');
    R.put('cajas', 0, R.D * 0.5, 0, 1);
    R.put('cajaFuerte', 0, R.D - 0.6, 0, -1);
    R.spot('guardia', R.doorX - 1.6, 1.0, 0, -1, 'elite');
    R.spot('guardia', R.doorX + 1.6, 1.0, 0, -1, 'elite');
  },

  comedor: (R) => {
    R.lamps('lamparaPared', 5);
    const t = R.D * 0.45;
    if (R.put('mesaLarga', -1.4, t, 0, 1)) {
      for (const k of [-1.1, 0, 1.1]) {
        R.spot('asiento', -1.4 + k, t - 0.75, 0, 1, 'banco');
        R.spot('asiento', -1.1 + k, t + 0.75, 0, -1, 'banco');
      }
      R.put('colgante', -1.4, t, 0, 1);
    }
    if (R.put('olla', R.W / 2 - 1.3, R.D - 1.2, 0, -1)) R.spot('trabajo', R.W / 2 - 1.3, R.D - 2.3, 0, 1, 'cocina');
    if (R.put('mesa', R.W / 2 - 1.2, 1.6, -1, 0, { variant: 0 })) R.spot('vendedor', R.W / 2 - 0.4, 1.6, -1, 0, 'comida');
  },

  generador: (R) => {
    R.lamps('bombilla', 5);
    R.put('generador', -1.2, R.D - 0.8, 0, -1);
    R.put('generador', 1.2, R.D - 0.8, 0, -1);
    R.put('barriles', R.W / 2 - 1.0, 1.2, 0, 1);
    R.spot('trabajo', 0, R.D - 2.0, 0, 1, 'operar');
  },
};

/** Amuebla todas las salas de una estación. */
export function decorateAnnexes(st: St) {
  const all = st.f.annexes;
  all.forEach((a, i) => {
    const R = new Room(st, a, i);
    DECOR[a.use]?.(R, all);
  });
}

void BULB;
