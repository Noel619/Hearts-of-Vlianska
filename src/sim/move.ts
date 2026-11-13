// Movimiento: ruta larga por el grafo del metro, camino local por la rejilla,
// dirección, colisión con muros y separación entre personajes.

import { angleDiff } from '../core/math';
import { F_SLOW, F_WATER } from '../world/grid';
import { moveSpeed, trainMove } from './chars';
import type { Sim } from './sim';
import type { Char } from './types';

export function setDest(c: Char, x: number, z: number, arrive = 0.45, run = true): void {
  // No recalcula si el destino apenas cambia
  if (c.hasDest && Math.abs(c.destX - x) < 0.3 && Math.abs(c.destZ - z) < 0.3) {
    c.arrive = arrive;
    c.run = run;
    return;
  }
  c.destX = x;
  c.destZ = z;
  c.arrive = arrive;
  c.run = run;
  c.hasDest = true;
  c.path = null;
  c.route = null;
  c.pi = 0;
  c.ri = 0;
  c.stuck = 0;
}

export function clearDest(c: Char): void {
  c.hasDest = false;
  c.path = null;
  c.route = null;
}

export function faceTo(c: Char, x: number, z: number, dt: number, rate = 9): void {
  const want = Math.atan2(z - c.z, x - c.x);
  const d = angleDiff(c.face, want);
  const step = rate * dt;
  c.face += Math.abs(d) < step ? d : Math.sign(d) * step;
}

/** Avanza al personaje hacia su destino. Devuelve true al llegar. */
export function stepMove(sim: Sim, c: Char, dt: number): boolean {
  const nav = sim.world.nav;
  if (!c.hasDest) {
    c.speed = Math.max(0, c.speed - dt * 12);
    return false;
  }
  const dx = c.destX - c.x;
  const dz = c.destZ - c.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= c.arrive) {
    clearDest(c);
    c.speed = Math.max(0, c.speed - dt * 12);
    return true;
  }
  const gates = c.side === 'JUG';
  // --- Planificación ---------------------------------------------------------
  c.repath -= dt;
  if (!c.path || c.pi >= c.path.length) {
    if (c.repath > 0 && c.path === null && c.route === null) {
      c.speed = Math.max(0, c.speed - dt * 10);
      return false;
    }
    let ok = false;
    if (c.route && c.ri < c.route.length) {
      // Siguiente punto de paso de la ruta larga
      const wx = c.route[c.ri];
      const wz = c.route[c.ri + 1];
      if (Math.hypot(wx - c.x, wz - c.z) < 2.2) {
        c.ri += 2;
        c.path = null;
        return false;
      }
      const p = nav.findPath(c.x, c.z, wx, wz, { gates, margin: 14, maxNodes: 9000, partial: true });
      if (p) {
        c.path = p;
        c.pi = 0;
        ok = true;
      } else {
        // Punto inalcanzable: lo salta
        c.ri += 2;
      }
    } else if (dist < 55 || !c.route) {
      const direct = dist < 55 ? nav.findPath(c.x, c.z, c.destX, c.destZ, { gates, margin: 18, partial: dist < 55 && !!c.route }) : null;
      if (direct) {
        c.path = direct;
        c.pi = 0;
        c.route = null;
        ok = true;
      } else if (!c.route) {
        const r = sim.world.graph.route(c.x, c.z, c.destX, c.destZ);
        if (r && r.length) {
          c.route = r;
          c.ri = 0;
          ok = true;
        } else if (dist < 55) {
          const partial = nav.findPath(c.x, c.z, c.destX, c.destZ, { gates, margin: 18, partial: true });
          if (partial) {
            c.path = partial;
            c.pi = 0;
            ok = true;
          }
        }
      } else {
        // Ruta agotada y sin camino directo: se da por llegado
        clearDest(c);
        return true;
      }
    }
    if (!ok) {
      c.repath = 0.8 + sim.rng.next() * 0.6;
      // Los del jugador se rinden antes: alguien espera una respuesta
      c.stuck += c.player ? 2.5 : 1;
      if (c.stuck > 6) {
        clearDest(c);
        return true;
      }
    }
    if (!c.path) return false;
  }
  // --- Atajos de la ruta larga ---------------------------------------------------
  if (c.route && c.ri + 2 < c.route.length && (sim.tick + c.id) % 8 === 0) {
    const nx = c.route[c.ri + 2];
    const nz = c.route[c.ri + 3];
    if (Math.hypot(nx - c.x, nz - c.z) < 30 && nav.walkLine(c.x, c.z, nx, nz, gates)) {
      c.ri += 2;
      c.path = [nx, nz];
      c.pi = 0;
    }
  }
  // --- Seguimiento del camino ------------------------------------------------------
  let tx = c.path[c.pi];
  let tz = c.path[c.pi + 1];
  let td = Math.hypot(tx - c.x, tz - c.z);
  while (td < 0.35 && c.pi + 2 < c.path.length) {
    c.pi += 2;
    tx = c.path[c.pi];
    tz = c.path[c.pi + 1];
    td = Math.hypot(tx - c.x, tz - c.z);
  }
  if (td < 0.3 && c.pi + 2 >= c.path.length) {
    c.pi = c.path.length;
    if (c.route) c.ri += 2;
    return false;
  }
  const flags = nav.flagAt(c.x, c.z);
  let vmax = moveSpeed(c, c.run);
  if (flags & F_WATER) vmax *= 0.62;
  if (flags & F_SLOW) vmax *= 0.4;
  // Frena al llegar
  const remain = c.route ? 99 : dist;
  const want = Math.min(vmax, Math.max(0.6, remain * 3.2));
  c.speed += (want - c.speed) * Math.min(1, dt * 7);
  // Gira hacia el punto; avanza más despacio si va muy cruzado
  const wantFace = Math.atan2(tz - c.z, tx - c.x);
  const dAng = angleDiff(c.face, wantFace);
  const turn = (c.kind === 'humano' ? 9 : 7) * dt;
  c.face += Math.abs(dAng) < turn ? dAng : Math.sign(dAng) * turn;
  const align = Math.max(0.15, Math.cos(Math.min(1.5, Math.abs(dAng))));
  const stepLen = Math.min(td, c.speed * align * dt);
  const mx = Math.cos(c.face) * stepLen;
  const mz = Math.sin(c.face) * stepLen;
  // Si está bien alineado va directo al punto para no orbitar
  const ux = (tx - c.x) / (td || 1);
  const uz = (tz - c.z) / (td || 1);
  const k = Math.abs(dAng) < 0.5 ? 1 : 0;
  const nx = c.x + (k ? ux * stepLen : mx);
  const nz = c.z + (k ? uz * stepLen : mz);
  const ox = c.x;
  const oz = c.z;
  if (tryMove(sim, c, nx, nz, gates)) {
    c.stuck = Math.max(0, c.stuck - dt * 2);
    trainMove(sim, c, Math.hypot(c.x - ox, c.z - oz));
  } else {
    c.stuck += dt * 4;
    if (c.stuck > 2.5) {
      c.path = null;
      c.stuck = 0;
      c.repath = 0;
    }
  }
  return false;
}

/** Intenta mover al personaje; si choca, resbala por un eje. */
export function tryMove(sim: Sim, c: Char, nx: number, nz: number, gates: boolean): boolean {
  const nav = sim.world.nav;
  const cx0 = nav.cx(c.x);
  const cz0 = nav.cz(c.z);
  const ok = (x: number, z: number) => {
    const cx = nav.cx(x);
    const cz = nav.cz(z);
    if (cx === cx0 && cz === cz0) return true;
    if (!nav.passable(cx, cz, gates)) return false;
    return nav.canStep(cz0 * nav.w + cx0, cz * nav.w + cx);
  };
  if (ok(nx, nz)) {
    c.x = nx;
    c.z = nz;
    return true;
  }
  if (ok(nx, c.z)) {
    c.x = nx;
    return true;
  }
  if (ok(c.x, nz)) {
    c.z = nz;
    return true;
  }
  return false;
}

/** Empuja suavemente a los personajes que se solapan. */
export function separate(sim: Sim, c: Char): void {
  if (c.st !== 'ok' || c.carriedBy) return;
  const r = 0.62;
  sim.forNear(c.x, c.z, r, (o) => {
    if (o.id <= c.id || o.st !== 'ok' || o.carriedBy) return;
    const dx = o.x - c.x;
    const dz = o.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d >= r) return;
    const push = (r - d) * 0.5;
    let ux = dx / (d || 1);
    let uz = dz / (d || 1);
    if (d < 1e-3) {
      const a = (c.id * 2.399) % 6.283;
      ux = Math.cos(a);
      uz = Math.sin(a);
    }
    // Quien está quieto cede menos
    const wc = c.hasDest ? 0.4 : 0.6;
    const wo = 1 - wc;
    tryMove(sim, c, c.x - ux * push * wc * 2, c.z - uz * push * wc * 2, true);
    tryMove(sim, o, o.x + ux * push * wo * 2, o.z + uz * push * wo * 2, true);
  });
}
