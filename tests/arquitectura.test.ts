import { beforeAll, describe, expect, it } from 'vitest';
import { STATION_ARCH, SURFACE_Y, annexCentre, annexFloorAt, annexPoint } from '../src/world/arch';
import { regionAt, stationToWorld } from '../src/world/layout';
import { F_WALK } from '../src/world/grid';
import { buildWorld, placeId, stationAt, type World } from '../src/sim/world';
import { newGame } from '../src/sim/newGame';

let world: World;

beforeAll(() => {
  world = buildWorld();
});

describe('arquitectura de las estaciones', () => {
  it('cada estación tiene su programa y sus salas', () => {
    for (const f of world.layout.stations) {
      expect(STATION_ARCH[f.id], f.id).toBeTruthy();
      expect(f.annexes.length, f.id).toBe(STATION_ARCH[f.id].annexes.length);
    }
  });

  it('las salas se alcanzan desde el andén y no invaden túneles ajenos', () => {
    const { layout, nav, graph } = world;
    for (const f of layout.stations) {
      for (const a of f.annexes) {
        const [cu, cv] = a.rise ? annexPoint(a, 1.5, 0) : annexCentre(a);
        const c = stationToWorld(f, cu, cv);
        const p = nav.nearestPassable(c.x, c.z, 3, true);
        expect(p, `${f.id}/${a.id}: suelo`).not.toBeNull();
        // Por el grafo de rutas, desde el centro de la estación
        expect(graph.route(f.x, f.z, p!.x, p!.z), `${f.id}/${a.id}: ruta`).not.toBeNull();
        // Lo que hay dentro de la sala es de la estación (o roca)
        for (let k = 0; k < 9; k++) {
          const u = a.u0 + ((a.u1 - a.u0) * ((k % 3) + 0.5)) / 3;
          const v = a.v0 + ((a.v1 - a.v0) * (Math.floor(k / 3) + 0.5)) / 3;
          const w = stationToWorld(f, u, v);
          const reg = regionAt(layout, w.x, w.z);
          expect(reg === 0 || reg === f.region, `${f.id}/${a.id}: región ${layout.regions[reg]?.name}`).toBe(true);
        }
        // Y cuenta como parte de la estación
        expect(stationAt(world, p!.x, p!.z)?.id, `${f.id}/${a.id}: estación`).toBe(f.id);
      }
    }
  });

  it('las escaleras suben de verdad y se pueden subir andando', () => {
    const { layout, nav } = world;
    for (const f of layout.stations) {
      for (const a of f.annexes) {
        if (!a.rise) continue;
        const bot = stationToWorld(f, ...annexPoint(a, 1.0, 0));
        const top = stationToWorld(f, ...annexPoint(a, a.depth - 1.0, 0));
        expect(nav.heightAt(bot.x, bot.z), `${f.id}/${a.id}: pie`).toBeCloseTo(a.y0, 0);
        expect(nav.heightAt(top.x, top.z), `${f.id}/${a.id}: lo alto`).toBeCloseTo(a.y0 + a.rise, 0);
        expect(nav.findPath(bot.x, bot.z, top.x, top.z, { gates: true, margin: 12, maxNodes: 60000 }), `${f.id}/${a.id}: se sube`).not.toBeNull();
        expect(annexFloorAt(a, ...annexPoint(a, a.depth / 2, 0))).toBeGreaterThan(a.y0);
      }
    }
  });

  it('los pilones son macizos y entre ellos hay arcos de paso', () => {
    const { layout, nav } = world;
    const ind = layout.stationById.IND;
    expect(ind.pylons.length).toBeGreaterThan(10);
    for (const p of ind.pylons) {
      const c = stationToWorld(ind, (p.u0 + p.u1) / 2, (p.v0 + p.v1) / 2);
      expect(nav.flags[nav.cz(c.z) * nav.w + nav.cx(c.x)] & F_WALK, 'pilón').toBe(0);
    }
    // Al menos un arco con escalera comunica la nave central con el borde del andén
    const P = ind.platforms[0];
    const stair = ind.ramps.find((r) => r.kind === 'escalera');
    expect(stair).toBeTruthy();
    const u = (stair!.u0 + stair!.u1) / 2;
    const s = Math.sign(stair!.v0 + stair!.v1);
    const a = stationToWorld(ind, u, 0);
    const b = stationToWorld(ind, u, s * (P.v1 - 0.6));
    expect(nav.findPath(a.x, a.z, b.x, b.z, { gates: true, margin: 10 })).not.toBeNull();
  });
});

describe('superficie', () => {
  it('sube desde Severnyy, Industrialnaya y Kholodnogo Vozduha', () => {
    const { layout, graph } = world;
    expect(layout.surface.exits.map((e) => e.station).sort()).toEqual(['IND', 'KHO', 'SEV']);
    for (const zn of layout.surface.zones) {
      for (const id of ['SEV', 'IND', 'KHO', 'TSE']) {
        const f = layout.stationById[id];
        expect(graph.route(f.x, f.z, zn.x, zn.z), `${id} -> ${zn.name}`).not.toBeNull();
      }
    }
  });

  it('está arriba, al aire libre y con el aire envenenado', () => {
    const { layout, nav, gas } = world;
    let n = 0;
    for (const o of layout.surface.open) {
      if (o.kind !== 'avenida' && o.kind !== 'calle') continue;
      const p = nav.nearestPassable(o.box.cx, o.box.cz, 6, true);
      if (!p) continue;
      n++;
      expect(nav.heightAt(p.x, p.z)).toBeGreaterThan(SURFACE_Y - 0.6);
      expect(placeId(world, p.x, p.z).startsWith('SUP'), `${o.zone}`).toBe(true);
      expect(gas.at(p.x, p.z)).toBeGreaterThan(0.5);
    }
    expect(n).toBeGreaterThan(10);
    // Abajo no llega
    for (const f of layout.stations) expect(gas.at(f.x, f.z), f.id).toBe(0);
  });

  it('tiene botín, chatarra y guardia en las salidas', () => {
    const spots = world.decor.spots.filter((s) => s.place.startsWith('SUP'));
    expect(spots.filter((s) => s.kind === 'botin').length).toBeGreaterThan(20);
    expect(spots.filter((s) => s.kind === 'chatarra').length).toBeGreaterThan(10);
    expect(spots.filter((s) => s.kind === 'guardia' && s.side).length).toBeGreaterThanOrEqual(4);
    // Las cajas se crean al empezar la partida
    const sim = newGame(world, { scenario: 'stalkers', seed: 5 });
    expect(sim.state.containers.filter((c) => c.place.startsWith('SUP')).length).toBeGreaterThan(20);
  });
});
