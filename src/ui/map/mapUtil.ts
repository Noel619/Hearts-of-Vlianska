// Utilidades del mapa: colores por modo, visibilidad y curvas.
import { FACTIONS, MAP } from '../../data';
import type { FactionId, GameState, Terrain } from '../../game/types';
import { friendly, hasNap, isAtWarWith, samePact } from '../../game/helpers';
import { unitStats } from '../../game/military';
import type { MapMode } from '../store';

export const NEUTRAL = '#3d3d37';
export const NEUTRAL_DARK = '#1f1f1c';

export const TERRAIN_COLOR: Record<Terrain, string> = {
  estacion: '#c8b88f',
  linea: '#7f8ea0',
  tunel: '#8e8676',
  peligroso: '#b24a33',
  auxiliar: '#9a7440',
  auxiliarPeligroso: '#b3572f',
  estrecho: '#c28a3e',
  derrumbe: '#4b463d',
};

/** De gris (sin recursos) a dorado (estación muy rica). */
export function resourceColor(total: number): string {
  const t = Math.max(0, Math.min(1, total / 6));
  const r = Math.round(62 + t * (233 - 62));
  const g = Math.round(62 + t * (165 - 62));
  const b = Math.round(55 + t * (60 - 55));
  return `rgb(${r},${g},${b})`;
}

export function dangerColor(d: number): string {
  const t = Math.max(0, Math.min(1, d / 80));
  const r = Math.round(90 + t * 150);
  const g = Math.round(150 - t * 110);
  const b = Math.round(70 - t * 30);
  return `rgb(${r},${g},${b})`;
}

export function provinceColor(state: GameState, pid: string, mode: MapMode, supplied?: Set<string>): string {
  const p = state.provinces[pid];
  const ctrl = p.controller;
  const player = state.player;
  switch (mode) {
    case 'terreno':
      return TERRAIN_COLOR[MAP.provinces[pid].terrain];
    case 'peligro':
      return dangerColor(p.danger);
    case 'recursos': {
      // Estaciones según la riqueza de su yacimiento; los túneles, apagados.
      const st = state.stations[pid];
      if (!st) return NEUTRAL_DARK;
      const total = st.resources.chatarra + st.resources.polvora + st.resources.combustible;
      return resourceColor(total);
    }
    case 'suministro':
      if (!supplied) return NEUTRAL;
      return supplied.has(pid) ? '#6f9e4c' : ctrl === player ? '#b8492f' : NEUTRAL;
    case 'diplomatico': {
      if (!ctrl) return NEUTRAL;
      if (!player) return FACTIONS[ctrl].color;
      if (ctrl === player) return '#e9a53c';
      if (isAtWarWith(state, player, ctrl)) return '#c9412c';
      if (samePact(state, player, ctrl) || friendly(state, player, ctrl)) return '#6aa84f';
      if (hasNap(state, player, ctrl)) return '#5b8fbf';
      const rel = state.countries[player].relations[ctrl] ?? 0;
      return rel >= 30 ? '#8fae84' : rel <= -40 ? '#8a5a4a' : '#77756c';
    }
    default:
      return ctrl ? FACTIONS[ctrl].color : NEUTRAL;
  }
}

/** Provincias que el jugador puede ver (niebla de guerra). */
export function visibleProvinces(state: GameState): Set<string> | null {
  const f = state.player;
  if (!f) return null;
  const vis = new Set<string>();
  const seeds: { id: string; range: number }[] = [];
  for (const [pid, p] of Object.entries(state.provinces)) {
    if (p.controller && (p.controller === f || friendly(state, f, p.controller))) seeds.push({ id: pid, range: 1 });
  }
  for (const u of Object.values(state.units)) {
    if (u.owner === f || friendly(state, f, u.owner)) {
      const extra = unitStats(state, u).vision;
      seeds.push({ id: u.province, range: 1 + extra });
    }
  }
  for (const { id, range } of seeds) {
    let frontier = [id];
    vis.add(id);
    for (let i = 0; i < range; i++) {
      const next: string[] = [];
      for (const cur of frontier) {
        for (const { to } of MAP.adjacency[cur]) {
          if (!vis.has(to)) {
            vis.add(to);
            next.push(to);
          }
        }
      }
      frontier = next;
    }
  }
  return vis;
}

/** Curva suave (Catmull-Rom → Bézier) a partir de una lista de puntos. */
export function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export function polyPath(points: [number, number][]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ');
}

/** Divide una polilínea en dos mitades por longitud. */
export function splitHalf(points: [number, number][]): [[number, number][], [number, number][]] {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    if (acc + seg >= total / 2) {
      const k = seg === 0 ? 0 : (total / 2 - acc) / seg;
      const mid: [number, number] = [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * k, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * k];
      return [
        [...points.slice(0, i), mid],
        [mid, ...points.slice(i)],
      ];
    }
    acc += seg;
  }
  return [points, points];
}

export function factionOrNeutral(f: FactionId | null): string {
  return f ? FACTIONS[f].color : NEUTRAL;
}
