import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../src/gfx/rng';
import { fbm, valueNoise } from '../src/gfx/noise';
import { EDGE_GEO, STATION_GEO, insideStation, sampleAt } from '../src/gfx/map/geometry';
import { MAP } from '../src/data';

describe('gráficos procedurales', () => {
  it('la aleatoriedad con semilla es determinista', () => {
    const a = rng('Vlianska');
    const b = rng('Vlianska');
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
    expect(hashString('UNI')).not.toBe(hashString('SDR'));
  });

  it('el ruido está acotado y se repite con periodo', () => {
    for (let i = 0; i < 500; i++) {
      const x = i * 0.37;
      const y = i * 0.61;
      const n = fbm(x, y, 5, 3);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(valueNoise(x, y, 7, 8)).toBeCloseTo(valueNoise(x + 8, y + 8, 7, 8), 10);
    }
  });

  it('la geometría del mapa cubre todos los túneles y estaciones', () => {
    expect(EDGE_GEO.length).toBe(MAP.edges.length);
    for (const g of EDGE_GEO) {
      expect(g.len).toBeGreaterThan(0);
      const a = MAP.provinces[g.edge.a];
      const b = MAP.provinces[g.edge.b];
      const s0 = sampleAt(g, 0);
      const s1 = sampleAt(g, g.len);
      expect(Math.hypot(s0.x - a.x, s0.y - a.y)).toBeLessThan(1);
      expect(Math.hypot(s1.x - b.x, s1.y - b.y)).toBeLessThan(1);
    }
    for (const s of STATION_GEO) {
      expect(insideStation(s, s.x, s.y)).toBe(true);
      expect(Math.abs(s.angle)).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    }
  });
});
