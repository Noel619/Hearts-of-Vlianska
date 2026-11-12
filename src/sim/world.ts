// Mundo estático compartido por la simulación y el render: trazado, decoración,
// rejilla de navegación, grafo de rutas y campo de luz.

import { decorate, type Decor } from '../world/decor';
import { RouteGraph } from '../world/graph';
import type { NavGrid } from '../world/grid';
import { buildLayout, type Layout, type StationFrame, insideStation } from '../world/layout';
import { LightField } from '../world/lights';

export interface World {
  layout: Layout;
  decor: Decor;
  nav: NavGrid;
  graph: RouteGraph;
  field: LightField;
  /** Rejilla recién construida: a ella se vuelve al empezar o cargar una partida. */
  baseFlags: Uint8Array;
}

export function buildWorld(): World {
  const layout = buildLayout();
  const decor = decorate(layout);
  const field = new LightField(layout.nav, decor.lights);
  const graph = new RouteGraph(layout, layout.nav);
  return { layout, decor, nav: layout.nav, graph, field, baseFlags: layout.nav.flags.slice() };
}

/** Devuelve el mundo compartido a su estado inicial: sin obras, derrumbes ni luces de partida. */
export function resetWorld(world: World) {
  world.nav.flags.set(world.baseFlags);
  world.nav.version++;
  for (const l of [...world.field.lights]) if (l.owner) world.field.remove(l);
  world.graph.blockedLinks.clear();
}

/** Estación que contiene un punto (con margen), o null. */
export function stationAt(world: World, x: number, z: number, margin = 2): StationFrame | null {
  for (const f of world.layout.stations) {
    if (Math.abs(x - f.x) > f.hl + f.hw + margin || Math.abs(z - f.z) > f.hl + f.hw + margin) continue;
    if (insideStation(f, x, z, margin)) return f;
  }
  return null;
}

/** Nombre del lugar en un punto del mundo. */
export function placeName(world: World, x: number, z: number): string {
  const f = stationAt(world, x, z, 6);
  if (f) return f.def.name;
  const { sdf, owner } = world.layout;
  const i = Math.max(0, Math.min(sdf.w - 1, Math.round((x - sdf.ox) / sdf.cell)));
  const j = Math.max(0, Math.min(sdf.h - 1, Math.round((z - sdf.oz) / sdf.cell)));
  const reg = world.layout.regions[owner[j * sdf.w + i]];
  return reg && reg.id ? reg.name : 'Túneles';
}

/** Id del lugar (estación, cruce o túnel) en un punto. */
export function placeId(world: World, x: number, z: number): string {
  const f = stationAt(world, x, z, 6);
  if (f) return f.id;
  const { sdf, owner } = world.layout;
  const i = Math.max(0, Math.min(sdf.w - 1, Math.round((x - sdf.ox) / sdf.cell)));
  const j = Math.max(0, Math.min(sdf.h - 1, Math.round((z - sdf.oz) / sdf.cell)));
  const reg = world.layout.regions[owner[j * sdf.w + i]];
  if (!reg || !reg.id) return '';
  return reg.kind === 'link' ? 'L' + reg.ref : reg.ref;
}
