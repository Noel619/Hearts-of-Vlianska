// Decoración del metro: orquesta a los decoradores de estaciones, cruces y
// túneles y entrega las piezas, las luces y los puntos de interés.

import { DecorCtx, type Decor, type Spot } from './decorCore';
import { decorateStation } from './decorStations';
import { decorateLink, decorateNode, decorateWalls } from './decorTunnels';
import { decorateSurface } from './decorSurface';
import type { Layout } from './layout';

export * from './decorCore';

/** Los puntos donde hay que estar de pie deben caer en suelo libre. */
function settleSpots(ctx: DecorCtx) {
  const nav = ctx.nav;
  const out: Spot[] = [];
  for (const s of ctx.spots) {
    if (s.kind === 'botin' || s.kind === 'chatarra' || s.kind === 'nido') {
      // Objetos del mundo: basta con que haya suelo cerca
      if (nav.isFloor(s.x, s.z)) out.push(s);
      else {
        const p = nav.nearestPassable(s.x, s.z, 3);
        if (p) {
          s.x = p.x;
          s.z = p.z;
          out.push(s);
        }
      }
      continue;
    }
    if (nav.passableAt(s.x, s.z)) {
      out.push(s);
      continue;
    }
    const p = nav.nearestPassable(s.x, s.z, 1.6);
    if (p) {
      s.x = p.x;
      s.z = p.z;
      out.push(s);
    }
  }
  ctx.spots = out;
}

export function decorate(layout: Layout): Decor {
  const ctx = new DecorCtx(layout);
  // Las vías y los ejes de los túneles quedan siempre libres
  for (const f of layout.stations) for (const t of f.tracks) ctx.reservePath(t, 1.3);
  for (const l of layout.links) {
    if (l.tracks.length) for (const t of l.tracks) ctx.reservePath(t, 1.25);
    else ctx.reservePath(l.pts, 0.85);
  }
  for (const f of layout.stations) decorateStation(ctx, f);
  for (const n of layout.nodes) decorateNode(ctx, n);
  for (const l of layout.links) decorateLink(ctx, l);
  decorateWalls(ctx);
  decorateSurface(ctx);
  settleSpots(ctx);
  layout.nav.computeNear();
  return { props: ctx.props, lights: ctx.lights, spots: ctx.spots };
}
