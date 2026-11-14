// Decoración de la superficie: lo que quedó en las calles del barrio norte.
// Coches y trolebuses varados, farolas torcidas, árboles muertos, patios con
// columpios y garajes, naves con chimeneas, vagones congelados, barricadas de
// 2013… y lo que se puede rapiñar: maleteros, quioscos, pisos, una farmacia y
// las cajas militares de las barricadas. También los nidos de lo que vive aquí
// arriba y los puestos de guardia junto a las salidas del metro.

import { Rng, seedFrom } from '../core/rng';
import type { SideId } from '../data/tipos';
import { DecorCtx, alignX, faceDir, lookDir } from './decorCore';
import { boxPoint, inBox, type SBlock, type SBox, type SStreet } from './surface';

export function decorateSurface(ctx: DecorCtx) {
  const plan = ctx.layout.surface;
  const rng = new Rng(seedFrom('decor-superficie'));
  // Las bocas de salida quedan libres
  for (const b of plan.buildings) {
    if (!b.hollow) continue;
    ctx.reserveRect(b.box.cx, b.box.cz, b.box.hl + 4, b.box.hw - 1, b.box.rot);
  }
  for (const o of plan.open) if (o.kind === 'boca') ctx.reserveRect(o.box.cx, o.box.cz, o.box.hl + 6, o.box.hw + 2, o.box.rot);
  const zoneAt = (x: number, z: number): string => {
    let best = plan.zones[0].id;
    let bd = Infinity;
    for (const o of plan.open) {
      if (!inBox(o.box, x, z, 0.5)) continue;
      const d = o.kind === 'avenida' || o.kind === 'calle' ? 1 : 0;
      if (d < bd) {
        bd = d;
        best = o.zone;
      }
    }
    return best;
  };
  const spot = (kind: Parameters<DecorCtx['spot']>[0], x: number, z: number, look: number, data?: string, side?: SideId) =>
    ctx.spot(kind, x, z, look, zoneAt(x, z), data, side ? { side } : undefined);

  exits(ctx, rng, spot);
  rubble(ctx, rng);
  for (const st of plan.streets) street(ctx, st, rng, spot);
  for (const bl of plan.blocks) block(ctx, bl, rng, spot);
}

type SpotFn = (kind: Parameters<DecorCtx['spot']>[0], x: number, z: number, look: number, data?: string, side?: SideId) => unknown;

// ---------------------------------------------------------------------------
// Escombros al pie de los edificios hundidos
// ---------------------------------------------------------------------------

function rubble(ctx: DecorCtx, rng: Rng) {
  for (const b of ctx.layout.surface.buildings) {
    if (b.hollow || b.damage < 0.35) continue;
    const B = b.box;
    const n = Math.round(b.damage * 4 + (B.hl + B.hw) / 25);
    for (let k = 0; k < n; k++) {
      // A lo largo de una fachada, pegado a ella
      const along = rng.range(-0.9, 0.9);
      const side = rng.chance(0.5) ? 1 : -1;
      const longSide = rng.chance(0.75);
      const u = longSide ? along * B.hl : side * (B.hl + rng.range(1.5, 3.5));
      const v = longSide ? side * (B.hw + rng.range(1.6, 3.6)) : along * B.hw;
      const [x, z] = boxPoint(B, u, v);
      ctx.put(rng.chance(0.7) ? 'escombrosGrandes' : 'escombros', x, z, rng.range(0, 6), { variant: rng.int(0, 1) });
    }
  }
}

// ---------------------------------------------------------------------------
// Calles
// ---------------------------------------------------------------------------

function street(ctx: DecorCtx, st: SStreet, rng: Rng, spot: SpotFn) {
  const [ax, az] = st.a;
  const [bx, bz] = st.b;
  const len = Math.hypot(bx - ax, bz - az);
  const dx = (bx - ax) / len;
  const dz = (bz - az) / len;
  const nx = -dz;
  const nz = dx;
  const at = (s: number, off: number) => ({ x: ax + dx * s + nx * off, z: az + dz * s + nz * off });
  const avenue = st.kind === 'avenida';
  // Farolas en las aceras, alternas
  for (let s = 10; s < len - 6; s += avenue ? 26 : 32) {
    for (const side of [-1, 1]) {
      const p = at(s + (side > 0 ? 0 : 13), side * (st.w / 2 - 1.2));
      const v = rng.chance(0.18) ? 2 : rng.chance(0.25) ? 1 : 0;
      ctx.put('farolaCalle', p.x, p.z, faceDir(-nx * side, -nz * side), { variant: v });
    }
  }
  // Coches abandonados junto al bordillo, alguno cruzado en medio
  let s = rng.range(8, 30);
  while (s < len - 8) {
    const side = rng.chance(0.5) ? 1 : -1;
    const mid = rng.chance(0.18);
    const p = at(s, mid ? rng.range(-2, 2) : side * (st.w / 2 - 3.4));
    const rot = mid ? rng.range(0, Math.PI * 2) : faceDir(dx * (rng.chance(0.5) ? 1 : -1), dz * (rng.chance(0.5) ? 1 : -1)) + rng.range(-0.15, 0.15);
    const burned = rng.chance(0.22);
    if (ctx.put('coche', p.x, p.z, rot, { variant: burned ? 4 : rng.int(0, 3) }) && !burned && rng.chance(0.4)) {
      const q = at(s + 2.9 * (rng.chance(0.5) ? 1 : -1), mid ? 2 : side * (st.w / 2 - 5.6));
      spot('botin', q.x, q.z, 0, 'coche');
    }
    s += rng.range(12, avenue ? 26 : 38);
  }
  if (avenue) {
    // Postes del tendido del trolebús por el eje y trolebuses y autobuses varados
    for (let q = 20; q < len; q += 34) {
      const p = at(q, 0.2);
      ctx.put('postePalo', p.x, p.z, alignX(nx, nz));
    }
    for (let k = 0; k < 6; k++) {
      const p = at(rng.range(40, len - 40), rng.range(-4, 4));
      ctx.put(rng.chance(0.5) ? 'trolebus' : 'autobus', p.x, p.z, faceDir(dx, dz) + rng.range(-0.25, 0.25), { variant: rng.int(0, 1) });
    }
    // Barricadas de 2013 con lo que dejó el ejército
    for (let k = 0; k < 4; k++) {
      const q = rng.range(80, len - 80);
      const p = at(q, rng.range(-st.w / 4, st.w / 4));
      if (ctx.put('barricadaCalle', p.x, p.z, faceDir(dx, dz) + rng.range(-0.2, 0.2))) {
        const m = at(q - 4, rng.range(-3, 3));
        spot('botin', m.x, m.z, 0, 'militar');
        const tk = at(q + 9, rng.range(-st.w / 3, st.w / 3));
        if (k % 2 === 0) ctx.put('blindado', tk.x, tk.z, faceDir(dx, dz) + rng.range(-0.6, 0.6));
        else ctx.put('camion', tk.x, tk.z, faceDir(-dx, -dz) + rng.range(-0.6, 0.6));
      }
    }
  }
  // Montones de nieve sucia a lo largo de los bordillos
  for (let k = 0; k < len / 40; k++) {
    const side = rng.chance(0.5) ? 1 : -1;
    const p = at(rng.range(5, len - 5), side * (st.w / 2 - rng.range(0.8, 2.2)));
    ctx.put('montonNieve', p.x, p.z, rng.range(0, 6), { variant: rng.int(0, 1) });
  }
}

// ---------------------------------------------------------------------------
// Manzanas
// ---------------------------------------------------------------------------

function block(ctx: DecorCtx, bl: SBlock, rng: Rng, spot: SpotFn) {
  const r = bl.rect;
  const W = r.x1 - r.x0;
  const D = r.z1 - r.z0;
  const rand = (m = 4) => ({ x: rng.range(r.x0 + m, r.x1 - m), z: rng.range(r.z0 + m, r.z1 - m) });
  const scatter = (type: string, n: number, opts: { variant?: number; m?: number } = {}) => {
    const out: { x: number; z: number }[] = [];
    for (let k = 0; k < n * 6 && out.length < n; k++) {
      const p = rand(opts.m ?? 4);
      if (ctx.put(type, p.x, p.z, rng.range(0, Math.PI * 2), { variant: opts.variant ?? rng.int(0, 2) })) out.push(p);
    }
    return out;
  };
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  switch (bl.kind) {
    case 'losas':
    case 'perimetro': {
      // Patio de vecinos: árboles, columpios, garajes, coches, cubos y restos de los pisos
      scatter('arbolSeco', Math.round((W * D) / 600));
      scatter('columpio', 1, { m: 14 });
      scatter('banco', 4, { m: 10 });
      scatter('garajes', rng.chance(0.7) ? 1 : 0, { m: 12 });
      scatter('coche', 4, { m: 10 });
      scatter('barril', 4, { m: 8 });
      scatter('cajas', 2, { m: 8 });
      scatter('maleta', 3, { m: 8 });
      scatter('montonNieve', 5, { variant: 1 });
      if (rng.chance(0.35)) scatter('kiosco', 1, { m: 12 });
      for (const p of scatter('chatarra', 1, { m: 10 })) spot('chatarra', p.x + 1.6, p.z, 0, 'chatarra');
      for (let k = 0; k < 2; k++) {
        const p = rand(10);
        if (ctx.nav.passableAt(p.x, p.z)) spot('botin', p.x, p.z, 0, rng.chance(0.15) ? 'farmacia' : 'piso');
      }
      break;
    }
    case 'parque': {
      // Arboleda muerta con su quiosco, bancos y la estatua de alguien
      for (let x = r.x0 + 8; x < r.x1 - 6; x += 9) {
        for (let z = r.z0 + 8; z < r.z1 - 6; z += 9) {
          if (rng.chance(0.25)) continue;
          ctx.put('arbolSeco', x + rng.range(-2.5, 2.5), z + rng.range(-2.5, 2.5), rng.range(0, 6), { variant: rng.int(0, 2) });
        }
      }
      ctx.put('estatua', cx, cz, faceDir(0, 1), { tint: 0x6a6a64 });
      ctx.put('kiosco', cx + 14, cz + 10, faceDir(0, 1), { variant: 1 });
      spot('botin', cx + 14, cz + 12.2, 0, 'kiosco');
      for (const s of [-1, 1]) ctx.put('banco', cx + s * 6, cz + 4, faceDir(0, -1));
      spot('nido', cx - W * 0.3, cz - D * 0.25, 0, 'skrebun');
      break;
    }
    case 'fabrica': {
      // Patio de fábrica: chimeneas, grúa, palés, bidones y chatarra
      ctx.put('chimenea', r.x0 + W * 0.18, r.z0 + 38, 0);
      ctx.put('chimenea', r.x1 - W * 0.2, r.z0 + 42, 0);
      ctx.put('grua', cx, cz - 6, alignX(1, 0));
      scatter('palet', 12, { m: 8 });
      scatter('barriles', 9, { m: 8 });
      scatter('cajas', 8, { m: 8 });
      scatter('bobina', 4, { m: 8 });
      scatter('vagoneta', 3, { m: 8 });
      scatter('camion', 2, { m: 12 });
      scatter('escombrosGrandes', 3, { m: 10 });
      // Un apartadero con un vagón
      for (let x = r.x0 + 8; x < r.x1 - 8; x += 12) ctx.put('viaFerrea', x, r.z0 + 52, alignX(0, 1));
      ctx.put('vagonMercancias', cx + 8, r.z0 + 52, faceDir(1, 0), { variant: 1 });
      for (const p of scatter('chatarra', 3, { m: 8 })) spot('chatarra', p.x + 1.8, p.z, 0, 'chatarra');
      for (let k = 0; k < 2; k++) {
        const p = rand(10);
        spot('botin', p.x, p.z, 0, 'coche');
      }
      break;
    }
    case 'via': {
      // Playa de vías: carriles en paralelo y vagones de mercancías congelados
      for (let line = 0; line < 4; line++) {
        const z = r.z0 + 12 + line * ((D - 24) / 3);
        for (let x = r.x0 + 6; x < r.x1 - 6; x += 12) ctx.put('viaFerrea', x, z, alignX(0, 1));
        let x = r.x0 + rng.range(10, 20);
        while (x < r.x1 - 10) {
          if (rng.chance(0.55)) ctx.put('vagonMercancias', x, z, faceDir(1, 0), { variant: rng.int(0, 1) });
          x += rng.range(15, 22);
        }
      }
      for (let k = 0; k < 2; k++) {
        const p = rand(8);
        spot('botin', p.x, p.z, 0, 'militar');
      }
      spot('nido', r.x0 + W * 0.5, r.z0 + D * 0.5, 0, 'skrebun');
      break;
    }
    case 'ruina': {
      // Bloques hundidos: montañas de escombros y lo que anida entre ellos
      for (let k = 0; k < 8; k++) {
        const p = rand(8);
        ctx.put('escombrosGrandes', p.x, p.z, rng.range(0, 6), { variant: rng.int(0, 1) });
      }
      scatter('arbolSeco', 3);
      scatter('maleta', 6, { m: 6 });
      scatter('huesos', 5, { m: 6 });
      for (const p of scatter('chatarra', 2, { m: 8 })) spot('chatarra', p.x + 1.6, p.z, 0, 'chatarra');
      const n = rand(14);
      ctx.put('nido', n.x, n.z, 0, { ghost: true, variant: 0 });
      spot('nido', n.x, n.z, 0, rng.chance(0.5) ? 'sheptun' : 'skrebun');
      spot('botin', n.x + 4, n.z + 2, 0, 'piso');
      break;
    }
    case 'terminal': {
      // Plaza del Terminal: la parada de autobuses, quioscos y el monumento
      const z0 = r.z0 + 40;
      for (let k = 0; k < 3; k++) ctx.put('autobus', r.x0 + 18 + k * 9, z0 + 10, faceDir(0, 1), { variant: k % 2 });
      ctx.put('paradaBus', r.x0 + 30, z0 + 1, faceDir(0, 1));
      ctx.put('estatua', cx + 10, cz + 12, faceDir(0, 1), { tint: 0x5e6266 });
      for (const [kx, kz] of [
        [r.x1 - 22, z0 + 4],
        [r.x1 - 16, z0 + 14],
      ]) {
        ctx.put('kiosco', kx, kz, faceDir(-1, 0), { variant: rng.int(0, 1) });
        spot('botin', kx - 2, kz, 0, 'kiosco');
      }
      ctx.put('cartelera', cx - 4, r.z0 + 36, faceDir(0, 1), { variant: 0 });
      scatter('arbolSeco', 6, { m: 6 });
      scatter('montonNieve', 4);
      break;
    }
    case 'ventiladores': {
      // Las torres de ventilación de Kholodnogo Vozduha
      ctx.put('torreVentilacion', cx - 22, cz - 4, 0, { variant: 1 });
      ctx.put('torreVentilacion', cx + 26, cz - 12, 0, { variant: 0 });
      ctx.put('torreVentilacion', cx + 6, r.z0 + 12, 0, { variant: 0 });
      scatter('arbolSeco', 10, { m: 8 });
      scatter('coche', 6, { m: 8 });
      scatter('banco', 4, { m: 10 });
      scatter('montonNieve', 5);
      ctx.put('cartelera', cx - 30, r.z0 + 9, faceDir(0, 1), { variant: 1 });
      ctx.put('paradaBus', cx - 40, r.z0 + 20, faceDir(0, 1));
      ctx.put('kiosco', cx + 40, r.z0 + 18, faceDir(0, 1), { variant: 0 });
      spot('botin', cx + 40, r.z0 + 20.5, 0, 'kiosco');
      ctx.put('trolebus', cx - 10, r.z0 + 30, faceDir(1, 0) + 0.3);
      break;
    }
    case 'plaza':
      break;
  }
}

// ---------------------------------------------------------------------------
// Salidas del metro
// ---------------------------------------------------------------------------

function exits(ctx: DecorCtx, rng: Rng, spot: SpotFn) {
  const plan = ctx.layout.surface;
  for (const e of plan.exits) {
    if (e.station === 'IND') {
      // La boca de la rampa: tapia con sacos, un foco y la guardia de los Seguidores
      const ox = e.x;
      const oz = e.z - 19;
      for (const s of [-1, 1]) {
        ctx.put('sacosAlto', ox + s * (e.width / 2 + 2.2), oz + 1, faceDir(0, -1));
        spot('guardia', ox + s * (e.width / 2 + 1.0), oz - 1.0, lookDir(0, -1), 'stalker', 'SDR');
      }
      ctx.put('foco', ox + e.width / 2 + 3.6, oz - 1.5, faceDir(0, -1));
      ctx.put('bidonFuego', ox - e.width / 2 - 3.8, oz - 2.5, 0);
      ctx.put('letreroM', ox + e.width / 2 + 5.5, oz + 0.5, faceDir(0, -1));
      continue;
    }
    const b = plan.buildings.find((q) => q.hollow && Math.hypot(q.box.cx - e.x, q.box.cz - e.z) < 14);
    if (!b) continue;
    const B: SBox = b.box;
    const front = (u: number, v: number) => {
      const [x, z] = boxPoint(B, u, v);
      return { x, z };
    };
    const fdx = Math.cos(B.rot);
    const fdz = Math.sin(B.rot);
    // Letrero de la «M», sacos a los lados de la puerta y un fuego para calentarse
    const m = front(B.hl + 2.5, B.hw - 1.5);
    ctx.put('letreroM', m.x, m.z, faceDir(fdx, fdz));
    for (const s of [-1, 1]) {
      const p = front(B.hl + 3.2, s * (B.hw * 0.5 + 1.2));
      ctx.put('sacos', p.x, p.z, faceDir(fdx, fdz));
    }
    const side: SideId = e.station === 'SEV' ? 'NOR' : 'SDR';
    for (const s of [-1, 1]) {
      const g = front(B.hl + 1.8, s * 2.6);
      spot('guardia', g.x, g.z, lookDir(fdx, fdz), 'stalker', side);
    }
    // Dentro del pabellón: un bidón encendido y un banco donde se ajustan las máscaras
    const f = front(-1.5, B.hw - 2.2);
    ctx.put('bidonFuego', f.x, f.z, 0);
    const bn = front(1.0, -(B.hw - 1.6));
    ctx.put('banco', bn.x, bn.z, faceDir(-Math.sin(B.rot) * -1, Math.cos(B.rot) * -1));
    if (e.station === 'SEV') {
      // El campamento de los stalkers frente a la plaza
      const c = front(B.hl + 11, -(B.hw + 4));
      if (ctx.put('hoguera', c.x, c.z, 0)) {
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + 0.4;
          spot('ocio', c.x + Math.cos(a) * 1.6, c.z + Math.sin(a) * 1.6, lookDir(-Math.cos(a), -Math.sin(a)), 'fuego');
        }
        const t = front(B.hl + 13.5, -(B.hw + 8.5));
        ctx.put('tienda', t.x, t.z, faceDir(fdx, fdz), { tint: 0x4a5a3a, variant: 1 });
        const cr = front(B.hl + 8, -(B.hw + 8));
        ctx.put('cajas', cr.x, cr.z, rng.range(0, 6));
      }
    }
  }
}
