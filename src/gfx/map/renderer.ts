// Renderizador del mapa en canvas. Dibuja cada fotograma a partir del estado de
// la partida: el mundo (roca, túneles, andenes, luces, partículas, niebla) en
// coordenadas del mapa y los elementos de interfaz (emblemas, rótulos, fichas)
// a tamaño constante en pantalla, como en Hearts of Iron.
import { FACTIONS, MAP, RIVERS, STATION_SEEDS, STATIONS } from '../../data';
import type { FactionId, GameState, ResourceId, Terrain, Unit } from '../../game/types';
import { RESOURCE_IDS } from '../../game/types';
import { friendly, isAtWarWith } from '../../game/helpers';
import { edgeHours, suppliedProvinces, templateById, unitStats } from '../../game/military';
import type { MapMode } from '../../ui/store';
import { provinceColor, visibleProvinces } from '../../ui/map/mapUtil';
import { blurCanvas, ctx2d, makeCanvas, type Ctx } from '../canvas';
import { mix, rgba, shade } from '../color';
import { emblemCanvas } from '../emblems';
import { strokeIcon } from '../icons';
import { hash2 } from '../rng';
import { buildCity, paintRiver, paintRock, paintRockGrain, WORLD, type CityPlan } from './background';
import { AUX_TERRAIN, DANGER_TERRAIN, EDGE_GEO, RAIL_TERRAIN, STATION_GEO, distToPolyline, edgeBetween, insideStation, offsetLine, sampleAt, slice, type EdgeGeo, type Pt } from './geometry';
import { Particles } from './particles';
import { FULL_QUALITY, type MapQuality } from '../quality';
import { barricadeSprite, labelSprite, lightSprite, starSprite, unitSprite, type UnitKind } from './props';
import { paintHall, type HallSprite } from './stations';

/** Icono y color de cada recurso en el mapa (los mismos que en la interfaz). */
const RESOURCE_STYLE: Record<ResourceId, { icon: string; color: string }> = {
  chatarra: { icon: 'Anvil', color: '#b9b4a8' },
  polvora: { icon: 'FlaskConical', color: '#e0823f' },
  combustible: { icon: 'Fuel', color: '#e2c54a' },
};

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface RenderInput {
  state: GameState;
  mode: 'game' | 'preview' | 'demo';
  mapMode: MapMode;
  highlight: FactionId | null;
  selectedProvince: string | null;
  selectedUnits: Set<string>;
  hover: string | null;
  hoverCounter: string | null;
  moveMode: boolean;
  fog: boolean;
  time: number;
  dt: number;
  /** Calidad del dibujo (por defecto, la máxima). */
  quality?: MapQuality;
}

export interface CounterHit {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  province: string;
  owner: FactionId;
  ids: string[];
}

export type Hit = { type: 'counter'; counter: CounterHit } | { type: 'battle'; province: string } | { type: 'province'; id: string } | { type: 'bg' };

const FLOOR: Record<Terrain, string> = {
  estacion: '#35332e',
  linea: '#3a3832',
  tunel: '#302e29',
  peligroso: '#2c2a24',
  auxiliar: '#322b22',
  auxiliarPeligroso: '#2d2720',
  estrecho: '#3b3326',
  derrumbe: '#27241f',
};

const LABEL_DIR: Record<string, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
  topleft: [-0.8, -0.8],
  topright: [0.8, -0.8],
  bottomleft: [-0.8, 0.8],
  bottomright: [0.8, 0.8],
};

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function tracePts(g: Ctx | Path2D, pts: Pt[]) {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
}

function unitKind(state: GameState, u: Unit): UnitKind {
  const tpl = templateById(state, u.owner, u.template);
  if (!tpl) return 'soldier';
  const n = tpl.line.length || 1;
  const drai = tpl.line.filter((b) => b === 'draisina').length;
  const mil = tpl.line.filter((b) => b === 'milicia').length;
  if (drai / n >= 0.5) return 'draisina';
  if (tpl.support.includes('stalkers')) return 'stalker';
  if (mil / n > 0.5) return 'militia';
  return 'soldier';
}

/** Capas estáticas compartidas por todos los mapas (menú, selección y partida). */
interface SharedLayers {
  rock: HTMLCanvasElement;
  river: HTMLCanvasElement;
  grain: HTMLCanvasElement;
  city: CityPlan;
}
let shared: SharedLayers | null = null;
const hallCache = new Map<string, HallSprite>();

export function mapLayersReady() {
  return shared !== null;
}

/** Genera las capas estáticas (unos cientos de milisegundos la primera vez). */
export function prepareMapLayers() {
  if (shared) return;
  shared = { rock: paintRock(), river: paintRiver(), grain: paintRockGrain(), city: buildCity() };
}

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  private g: Ctx;
  private dpr = 1;
  cssW = 1;
  cssH = 1;
  private rock?: HTMLCanvasElement;
  private river?: HTMLCanvasElement;
  private grain?: CanvasPattern | null;
  private grainCanvas?: HTMLCanvasElement;
  private city?: CityPlan;
  private riverPath: Path2D;
  private territory: { key: string; canvas: HTMLCanvasElement } | null = null;
  private fogLayer: { key: string; canvas: HTMLCanvasElement } | null = null;
  private visCache: { hour: number; player: FactionId | null; vis: Set<string> | null } | null = null;
  private supplyCache: { hour: number; set?: Set<string> } | null = null;
  private needCache = new Map<string, { hour: number; need: number }>();
  private shown = new Map<string, { x: number; y: number; seen: number }>();
  private particles = new Particles();
  private spawnAcc = 0;
  counters: CounterHit[] = [];
  battleHits: { x: number; y: number; w: number; h: number; province: string }[] = [];
  /** Intensidad de combate visible (0..1), para el sonido. */
  battleLevel = 0;
  ready = false;
  private q: MapQuality = FULL_QUALITY;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.g = ctx2d(canvas);
    this.riverPath = new Path2D();
    for (const r of RIVERS) tracePts(this.riverPath, r as Pt[]);
  }

  /** Toma las capas estáticas compartidas (las genera si hace falta). */
  prepare() {
    if (this.ready) return;
    prepareMapLayers();
    this.rock = shared!.rock;
    this.river = shared!.river;
    this.grainCanvas = shared!.grain;
    this.city = shared!.city;
    this.ready = true;
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = Math.max(1, cssW);
    this.cssH = Math.max(1, cssH);
    this.dpr = dpr;
    const w = Math.round(this.cssW * dpr);
    const h = Math.round(this.cssH * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  worldToScreen(cam: Camera, x: number, y: number): [number, number] {
    return [(x - cam.x) * cam.zoom + this.cssW / 2, (y - cam.y) * cam.zoom + this.cssH / 2];
  }

  screenToWorld(cam: Camera, sx: number, sy: number): [number, number] {
    return [(sx - this.cssW / 2) / cam.zoom + cam.x, (sy - this.cssH / 2) / cam.zoom + cam.y];
  }

  private worldTransform(cam: Camera) {
    const k = this.dpr * cam.zoom;
    this.g.setTransform(k, 0, 0, k, this.dpr * (this.cssW / 2 - cam.x * cam.zoom), this.dpr * (this.cssH / 2 - cam.y * cam.zoom));
  }

  private screenTransform() {
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private hall(sid: string, owner: FactionId | null): HallSprite {
    const key = `${sid}|${owner ?? '-'}`;
    let h = hallCache.get(key);
    if (h) {
      // Uso reciente: se mueve al final (caché LRU)
      hallCache.delete(key);
      hallCache.set(key, h);
      return h;
    }
    h = paintHall(sid, owner, 5);
    hallCache.set(key, h);
    while (hallCache.size > 36) {
      const oldest = hallCache.keys().next().value as string;
      const old = hallCache.get(oldest);
      if (old) {
        old.canvas.width = 0;
        old.canvas.height = 0;
      }
      hallCache.delete(oldest);
    }
    return h;
  }

  private visibility(state: GameState, fog: boolean, mode: RenderInput['mode']): Set<string> | null {
    if (mode !== 'game' || !fog || !state.player) return null;
    const c = this.visCache;
    if (c && c.hour === state.hour && c.player === state.player) return c.vis;
    const vis = visibleProvinces(state);
    this.visCache = { hour: state.hour, player: state.player, vis };
    return vis;
  }

  private supplied(state: GameState, mapMode: MapMode): Set<string> | undefined {
    if (mapMode !== 'suministro' || !state.player) return undefined;
    if (this.supplyCache && this.supplyCache.hour === state.hour) return this.supplyCache.set;
    const set = suppliedProvinces(state, state.player);
    this.supplyCache = { hour: state.hour, set };
    return set;
  }

  // ------------------------------------------------------------------ Consultas

  hitTest(cam: Camera, sx: number, sy: number, state: GameState): Hit {
    for (let i = this.counters.length - 1; i >= 0; i--) {
      const c = this.counters[i];
      if (sx >= c.x && sx <= c.x + c.w && sy >= c.y && sy <= c.y + c.h) return { type: 'counter', counter: c };
    }
    for (const b of this.battleHits) {
      if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return { type: 'battle', province: b.province };
    }
    const [wx, wy] = this.screenToWorld(cam, sx, sy);
    // Emblemas de estación (tamaño constante en pantalla)
    for (const s of STATION_SEEDS) {
      const [ex, ey] = this.worldToScreen(cam, s.x, s.y);
      if (Math.hypot(sx - ex, sy - ey) <= 20) return { type: 'province', id: s.id };
    }
    for (const sg of STATION_GEO) if (insideStation(sg, wx, wy, 2)) return { type: 'province', id: sg.id };
    const tol = Math.max(6, 12 / cam.zoom);
    let best: { d: number; id: string } | null = null;
    for (const p of MAP.provinceList) {
      if (p.kind !== 'cruce') continue;
      const d = Math.hypot(wx - p.x, wy - p.y);
      if (d < 11 + tol && (!best || d < best.d)) best = { d, id: p.id };
    }
    if (best) return { type: 'province', id: best.id };
    let bestEdge: { d: number; geo: EdgeGeo; s: number } | null = null;
    for (const geo of EDGE_GEO) {
      if (geo.edge.latent && !state.openEdges.includes(geo.id)) continue;
      const [x0, y0, x1, y1] = geo.bbox;
      if (wx < x0 || wx > x1 || wy < y0 || wy > y1) continue;
      const { d, s } = distToPolyline([wx, wy], geo.pts);
      if (d <= geo.width / 2 + tol && (!bestEdge || d < bestEdge.d)) bestEdge = { d, geo, s };
    }
    if (bestEdge) {
      const { geo, s } = bestEdge;
      const id = s < geo.len / 2 ? geo.edge.a : geo.edge.b;
      // Si la mitad cae en una estación, se prefiere el tramo contiguo
      if (MAP.provinces[id].kind === 'estacion') {
        const other = id === geo.edge.a ? geo.edge.b : geo.edge.a;
        return { type: 'province', id: MAP.provinces[other].kind === 'estacion' ? id : other };
      }
      return { type: 'province', id };
    }
    return { type: 'bg' };
  }

  // ------------------------------------------------------------------ Capas en caché

  private colorSignature(input: RenderInput, colors: Record<string, string>) {
    let key = `${input.mapMode}|${input.highlight ?? ''}|`;
    for (const p of MAP.provinceList) key += colors[p.id].slice(1, 7);
    return key;
  }

  private buildTerritory(colors: Record<string, string>, state: GameState) {
    const ppu = 0.28;
    const c = makeCanvas(WORLD.w * ppu, WORLD.h * ppu);
    const g = ctx2d(c);
    g.scale(ppu, ppu);
    g.translate(-WORLD.x, -WORLD.y);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const geo of EDGE_GEO) {
      if (geo.edge.latent && !state.openEdges.includes(geo.id)) continue;
      const half = geo.len / 2;
      for (const [pid, s0, s1] of [
        [geo.edge.a, 0, half],
        [geo.edge.b, half, geo.len],
      ] as [string, number, number][]) {
        const col = colors[pid];
        const neutral = !state.provinces[pid].controller;
        g.strokeStyle = rgba(col, neutral ? 0.25 : 0.85);
        g.lineWidth = RAIL_TERRAIN.has(geo.edge.terrain) ? 52 : 38;
        g.beginPath();
        tracePts(g, slice(geo, s0, s1));
        g.stroke();
      }
    }
    for (const p of MAP.provinceList) {
      if (p.kind === 'tramo') continue;
      const neutral = !state.provinces[p.id].controller;
      const rad = p.kind === 'estacion' ? 88 : 30;
      const grad = g.createRadialGradient(p.x, p.y, rad * 0.2, p.x, p.y, rad);
      grad.addColorStop(0, rgba(colors[p.id], neutral ? 0.3 : 0.95));
      grad.addColorStop(1, rgba(colors[p.id], 0));
      g.fillStyle = grad;
      g.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
    }
    blurCanvas(c, 7);
    return c;
  }

  private buildFog(vis: Set<string>, state: GameState) {
    const ppu = 0.22;
    const c = makeCanvas(WORLD.w * ppu, WORLD.h * ppu);
    const g = ctx2d(c);
    g.fillStyle = 'rgba(3,4,4,0.72)';
    g.fillRect(0, 0, c.width, c.height);
    g.scale(ppu, ppu);
    g.translate(-WORLD.x, -WORLD.y);
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,1)';
    g.lineWidth = 46;
    for (const geo of EDGE_GEO) {
      if (geo.edge.latent && !state.openEdges.includes(geo.id)) continue;
      if (!vis.has(geo.edge.a) && !vis.has(geo.edge.b)) continue;
      const half = geo.len / 2;
      const pts = vis.has(geo.edge.a) && vis.has(geo.edge.b) ? geo.pts : vis.has(geo.edge.a) ? slice(geo, 0, half) : slice(geo, half, geo.len);
      g.beginPath();
      tracePts(g, pts);
      g.stroke();
    }
    for (const id of vis) {
      const p = MAP.provinces[id];
      const rad = p.kind === 'estacion' ? 72 : 30;
      g.beginPath();
      g.arc(p.x, p.y, rad, 0, Math.PI * 2);
      g.fill();
    }
    blurCanvas(c, 6);
    return c;
  }

  // ------------------------------------------------------------------ Dibujo

  render(input: RenderInput, cam: Camera) {
    const g = this.g;
    const { state } = input;
    const zoom = cam.zoom;
    const view: [number, number, number, number] = [
      cam.x - this.cssW / 2 / zoom,
      cam.y - this.cssH / 2 / zoom,
      cam.x + this.cssW / 2 / zoom,
      cam.y + this.cssH / 2 / zoom,
    ];
    const inView = (x: number, y: number, pad = 60) => x > view[0] - pad && x < view[2] + pad && y > view[1] - pad && y < view[3] + pad;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.fillStyle = '#070807';
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.ready) return;
    const q = (this.q = input.quality ?? FULL_QUALITY);
    this.particles.density = q.particles;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = q.postfx ? 'high' : 'low';

    const vis = this.visibility(state, input.fog, input.mode);
    const supplied = this.supplied(state, input.mapMode);
    const colors: Record<string, string> = {};
    for (const p of MAP.provinceList) {
      let col = provinceColor(state, p.id, input.mapMode, supplied);
      if (input.highlight && state.provinces[p.id].controller !== input.highlight) col = mix(col, '#1a1a18', 0.72);
      colors[p.id] = col;
    }
    const t = input.time;

    // ---------------------------------------------------------------- Mundo
    this.worldTransform(cam);
    g.drawImage(this.rock!, WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    // Grano de roca nítido
    if (!this.grain) this.grain = g.createPattern(this.grainCanvas!, 'repeat');
    if (q.postfx && this.grain) {
      this.grain.setTransform?.(new DOMMatrix().scale(0.55));
      g.save();
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = 0.28;
      g.fillStyle = this.grain;
      g.fillRect(view[0], view[1], view[2] - view[0], view[3] - view[1]);
      g.restore();
    }
    // Ciudad fantasma en superficie
    if (q.postfx && this.city) {
      const a = clamp(1.25 - zoom * 0.35, 0.25, 1);
      g.save();
      g.lineWidth = 3;
      g.strokeStyle = `rgba(120,160,185,${0.045 * a})`;
      g.stroke(this.city.streets);
      g.fillStyle = `rgba(120,160,185,${0.03 * a})`;
      g.fill(this.city.blocks);
      g.lineWidth = 0.8;
      g.strokeStyle = `rgba(140,175,200,${0.06 * a})`;
      g.stroke(this.city.blocks);
      g.setLineDash([3, 3]);
      g.strokeStyle = `rgba(160,120,100,${0.06 * a})`;
      g.stroke(this.city.ruins);
      g.setLineDash([]);
      g.restore();
    }
    // Río en superficie con brillo que fluye
    g.save();
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.85;
    g.drawImage(this.river!, WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    g.globalAlpha = 1;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (q.postfx) {
      g.setLineDash([18, 46]);
      g.lineDashOffset = -t * 14;
      g.strokeStyle = 'rgba(150,205,225,0.1)';
      g.lineWidth = 2.2;
      g.stroke(this.riverPath);
      g.setLineDash([6, 70]);
      g.lineDashOffset = -t * 22 + 30;
      g.strokeStyle = 'rgba(190,230,245,0.12)';
      g.lineWidth = 1.2;
      g.stroke(this.riverPath);
      g.setLineDash([]);
    }
    g.restore();
    this.worldText(g, 'RÍO VLIA · SUPERFICIE', 1562, 300, 72 * (Math.PI / 180), 'rgba(140,190,210,0.22)', 15);
    this.worldText(g, 'METRO DE VLIANSKA · ÓBLAST DE MÚRMANSK', 40, 1062, 0, 'rgba(180,160,120,0.16)', 16, 'left');

    // Territorio (caché)
    const sig = this.colorSignature(input, colors) + '|' + state.openEdges.join(',');
    if (!this.territory || this.territory.key !== sig) this.territory = { key: sig, canvas: this.buildTerritory(colors, state) };
    g.save();
    g.globalAlpha = input.mapMode === 'politico' ? 0.3 * clamp(1.35 - zoom * 0.45, 0.12, 1) : 0.45 * clamp(1.5 - zoom * 0.3, 0.4, 1);
    g.drawImage(this.territory.canvas, WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    g.restore();

    // Túneles
    const edges = EDGE_GEO.filter((geo) => {
      if (geo.edge.latent && !state.openEdges.includes(geo.id)) return false;
      const [x0, y0, x1, y1] = geo.bbox;
      return x1 > view[0] && x0 < view[2] && y1 > view[1] && y0 < view[3];
    });
    const collapsedEdge = (geo: EdgeGeo) => state.provinces[geo.edge.a].collapsed || state.provinces[geo.edge.b].collapsed || geo.edge.terrain === 'derrumbe';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    // a) sombra exterior y pared
    for (const geo of edges) {
      g.beginPath();
      tracePts(g, geo.pts);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = geo.width + 14;
      g.stroke();
      g.strokeStyle = '#060606';
      g.lineWidth = geo.width + 5;
      g.stroke();
    }
    // b) suelo
    for (const geo of edges) {
      g.beginPath();
      tracePts(g, geo.pts);
      g.strokeStyle = FLOOR[geo.edge.terrain];
      g.lineWidth = geo.width;
      g.stroke();
    }
    // c) franja de color del dueño (estilo plano de metro)
    const stripeA = input.mapMode === 'politico' ? clamp(1.1 - (zoom - 0.6) * 0.42, 0.16, 0.95) : 0.85;
    const trimA = clamp((zoom - 1.3) * 0.6, 0, 0.75);
    for (const geo of edges) {
      if (collapsedEdge(geo)) continue;
      const half = geo.len / 2;
      const rail = RAIL_TERRAIN.has(geo.edge.terrain);
      const w = geo.width * (rail ? 0.56 : 0.62);
      for (const [pid, s0, s1] of [
        [geo.edge.a, 0, half],
        [geo.edge.b, half, geo.len],
      ] as [string, number, number][]) {
        const col = colors[pid];
        const neutral = !state.provinces[pid].controller && input.mapMode === 'politico';
        g.beginPath();
        tracePts(g, slice(geo, s0, s1));
        g.strokeStyle = rgba(neutral ? '#4a4a44' : col, neutral ? 0.5 : stripeA);
        g.lineWidth = w;
        g.stroke();
        if (q.tunnelDetail && trimA > 0 && !neutral) {
          // Cable de luces del dueño a lo largo de las paredes
          for (const side of [-1, 1]) {
            const trim = offsetLine(slice(geo, s0, s1), side * (geo.width / 2 - 1));
            g.beginPath();
            tracePts(g, trim);
            g.strokeStyle = rgba(col, trimA);
            g.lineWidth = 0.9;
            g.stroke();
          }
        }
      }
    }
    // d) detalles: paredes, raíles, traviesas, tuberías
    if (q.tunnelDetail && zoom > 0.75) {
      const detailA = clamp((zoom - 0.75) * 1.6);
      for (const geo of edges) {
        if (collapsedEdge(geo)) continue;
        const terr = geo.edge.terrain;
        g.globalAlpha = detailA;
        // Bordes de la pared iluminados
        g.lineWidth = 0.7;
        g.strokeStyle = 'rgba(150,140,120,0.35)';
        g.beginPath();
        tracePts(g, geo.left);
        g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.beginPath();
        tracePts(g, geo.right);
        g.stroke();
        if (RAIL_TERRAIN.has(terr)) {
          const gauge = geo.width * 0.17;
          if (zoom > 1.25) {
            // Traviesas
            g.strokeStyle = 'rgba(52,40,28,0.95)';
            g.lineWidth = 1.3;
            g.beginPath();
            for (let s = 2; s < geo.len; s += 3.6) {
              const p = sampleAt(geo, s);
              const l = gauge + 2;
              g.moveTo(p.x + p.nx * l, p.y + p.ny * l);
              g.lineTo(p.x - p.nx * l, p.y - p.ny * l);
            }
            g.stroke();
          }
          for (const side of [-1, 1]) {
            const rail = offsetLine(geo.pts, gauge * side);
            g.beginPath();
            tracePts(g, rail);
            g.strokeStyle = '#2a2826';
            g.lineWidth = 1.2;
            g.stroke();
            g.strokeStyle = 'rgba(215,210,198,0.55)';
            g.lineWidth = 0.45;
            g.stroke();
          }
        } else if (AUX_TERRAIN.has(terr)) {
          // Tubería oxidada y cable a lo largo de la pared
          const pipe = offsetLine(geo.pts, geo.width * 0.3);
          g.beginPath();
          tracePts(g, pipe);
          g.strokeStyle = '#4a3a2c';
          g.lineWidth = 1.5;
          g.stroke();
          g.strokeStyle = 'rgba(200,150,100,0.35)';
          g.lineWidth = 0.4;
          g.stroke();
          const cable = offsetLine(geo.pts, -geo.width * 0.3);
          g.beginPath();
          tracePts(g, cable);
          g.strokeStyle = 'rgba(15,15,14,0.9)';
          g.lineWidth = 0.6;
          g.stroke();
          if (zoom > 1.5) {
            g.fillStyle = '#5a4a3a';
            for (let s = 6; s < geo.len; s += 12) {
              const p = sampleAt(geo, s);
              g.fillRect(p.x + p.nx * geo.width * 0.3 - 0.9, p.y + p.ny * geo.width * 0.3 - 0.9, 1.8, 1.8);
            }
          }
        } else if (terr === 'estrecho') {
          // Pasarela de rejilla
          g.strokeStyle = 'rgba(130,120,100,0.55)';
          g.lineWidth = 0.35;
          g.beginPath();
          for (let s = 1; s < geo.len; s += 1.6) {
            const p = sampleAt(geo, s);
            const l = geo.width * 0.42;
            g.moveTo(p.x + p.nx * l, p.y + p.ny * l);
            g.lineTo(p.x - p.nx * l, p.y - p.ny * l);
          }
          g.stroke();
        }
        g.globalAlpha = 1;
      }
    }
    // e) peligro, derrumbes e inundaciones
    for (const geo of edges) {
      const terr = geo.edge.terrain;
      if (collapsedEdge(geo)) {
        for (const d of geo.decals) {
          const p = sampleAt(geo, d.t);
          const x = p.x + p.nx * d.side * geo.width * 0.45;
          const y = p.y + p.ny * d.side * geo.width * 0.45;
          const s = d.size * 3.2;
          g.fillStyle = ['#4f483e', '#3d372f', '#5d554a', '#2e2a25'][d.kind % 4];
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = d.rot + (k / 6) * Math.PI * 2;
            const rr = s * (0.6 + hash2(k, d.kind, geo.seed) * 0.5);
            if (k === 0) g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
            else g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
          }
          g.closePath();
          g.fill();
        }
        // Polvo sobre el derrumbe
        g.strokeStyle = 'rgba(120,110,95,0.18)';
        g.lineWidth = geo.width + 6;
        g.beginPath();
        tracePts(g, geo.pts);
        g.stroke();
        continue;
      }
      if (DANGER_TERRAIN.has(terr) && zoom > 0.6) {
        for (const d of geo.decals) {
          const p = sampleAt(geo, d.t);
          const x = p.x + p.nx * d.side * geo.width * 0.42;
          const y = p.y + p.ny * d.side * geo.width * 0.42;
          if (d.kind < 4) {
            g.fillStyle = d.kind < 2 ? 'rgba(70,95,40,0.35)' : 'rgba(40,30,22,0.45)';
            g.beginPath();
            g.ellipse(x, y, d.size * 3.2, d.size * 1.8, d.rot, 0, Math.PI * 2);
            g.fill();
          } else if (d.kind < 6 && zoom > 1.4) {
            g.strokeStyle = 'rgba(200,190,170,0.35)';
            g.lineWidth = 0.35;
            g.beginPath();
            g.moveTo(x - Math.cos(d.rot) * 0.9, y - Math.sin(d.rot) * 0.9);
            g.lineTo(x + Math.cos(d.rot) * 0.9, y + Math.sin(d.rot) * 0.9);
            g.stroke();
          } else if (d.kind === 6) {
            g.fillStyle = 'rgba(120,20,15,0.3)';
            g.beginPath();
            g.arc(x, y, d.size * 2, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      for (const pid of [geo.edge.a, geo.edge.b]) {
        const fl = state.provinces[pid].floodedUntil;
        if (!fl || fl <= state.hour) continue;
        const half = geo.len / 2;
        const pts = pid === geo.edge.a ? slice(geo, 0, half) : slice(geo, half, geo.len);
        g.beginPath();
        tracePts(g, pts);
        g.strokeStyle = 'rgba(40,95,125,0.7)';
        g.lineWidth = geo.width + 2;
        g.stroke();
        g.setLineDash([2, 6]);
        g.lineDashOffset = -t * 6;
        g.strokeStyle = 'rgba(160,210,230,0.35)';
        g.lineWidth = geo.width * 0.6;
        g.stroke();
        g.setLineDash([]);
      }
    }

    // Frentes: alambre entre provincias enemigas
    if (input.mode === 'game') {
      for (const geo of edges) {
        const ca = state.provinces[geo.edge.a].controller;
        const cb = state.provinces[geo.edge.b].controller;
        if (!ca || !cb || ca === cb || !isAtWarWith(state, ca, cb)) continue;
        const m = sampleAt(geo, geo.len / 2);
        const l = geo.width * 0.9;
        g.save();
        g.translate(m.x, m.y);
        g.rotate(m.angle + Math.PI / 2);
        g.strokeStyle = 'rgba(224,97,74,0.9)';
        g.lineWidth = Math.max(1.2, 2 / zoom);
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const x = -l + (2 * l * k) / 8;
          g.lineTo(x, k % 2 ? -1.6 : 1.6);
        }
        g.stroke();
        g.restore();
      }
    }

    // Cruces y marcas de tramo
    for (const p of MAP.provinceList) {
      if (p.kind === 'estacion' || !inView(p.x, p.y)) continue;
      const ps = state.provinces[p.id];
      const col = colors[p.id];
      if (p.kind === 'cruce') {
        const r = 11;
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.beginPath();
        g.arc(p.x, p.y, r + 4, 0, Math.PI * 2);
        g.fill();
        const cg = g.createRadialGradient(p.x - 3, p.y - 3, 1, p.x, p.y, r);
        cg.addColorStop(0, ps.collapsed ? '#3a3530' : '#4a463e');
        cg.addColorStop(1, '#23211d');
        g.fillStyle = cg;
        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        g.fill();
        if (!ps.collapsed) {
          g.strokeStyle = rgba(col, ps.controller ? 0.75 : 0.35);
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(p.x, p.y, r - 1.2, 0, Math.PI * 2);
          g.stroke();
          if (zoom > 1) {
            // Plataforma giratoria
            g.strokeStyle = 'rgba(200,195,180,0.35)';
            g.lineWidth = 0.5;
            g.beginPath();
            g.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
            g.moveTo(p.x - r * 0.8, p.y);
            g.lineTo(p.x + r * 0.8, p.y);
            g.moveTo(p.x, p.y - r * 0.8);
            g.lineTo(p.x, p.y + r * 0.8);
            g.stroke();
          }
        } else {
          g.strokeStyle = '#8a7f6a';
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(p.x - 5, p.y - 5);
          g.lineTo(p.x + 5, p.y + 5);
          g.moveTo(p.x + 5, p.y - 5);
          g.lineTo(p.x - 5, p.y + 5);
          g.stroke();
        }
      } else {
        // Farol del tramo
        g.fillStyle = '#16140f';
        g.beginPath();
        g.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = ps.controller ? shade(col, 0.35) : '#3a3a34';
        g.beginPath();
        g.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        g.fill();
      }
      // Barricadas
      if (ps.fort > 0 && !ps.collapsed) {
        const adj = MAP.adjacency[p.id][0];
        let ang = 0;
        if (adj) {
          const geo = EDGE_GEO.find((e) => e.id === adj.edge.id)!;
          const near = adj.edge.a === p.id ? sampleAt(geo, 4) : sampleAt(geo, geo.len - 4);
          ang = near.angle;
        }
        const spr = barricadeSprite(Math.min(5, ps.fort));
        const w = 12;
        const h = 18;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(ang);
        g.drawImage(spr, -w / 2 - 4, -h / 2, w, h);
        g.restore();
      }
    }

    // Andenes
    for (const sg of STATION_GEO) {
      if (!inView(sg.x, sg.y, 120)) continue;
      const st = state.stations[sg.id];
      const h = this.hall(sg.id, st.owner);
      g.save();
      g.translate(sg.x, sg.y);
      g.rotate(sg.angle);
      if (input.highlight && state.provinces[sg.id].controller !== input.highlight) g.globalAlpha = 0.45;
      g.drawImage(h.canvas, -h.w / 2, -h.h / 2, h.w, h.h);
      // Ocupación: velo con el color del ocupante
      const ctrl = state.provinces[sg.id].controller;
      if (ctrl && ctrl !== st.owner) {
        g.globalAlpha = 0.22;
        g.fillStyle = FACTIONS[ctrl].color;
        g.fillRect(-sg.len / 2, -sg.wid / 2, sg.len, sg.wid);
      }
      // Barricadas en los extremos del andén
      const fort = state.provinces[sg.id].fort;
      if (fort > 0) {
        g.globalAlpha = 1;
        const spr = barricadeSprite(Math.min(5, fort));
        for (const sx of [-1, 1]) {
          g.save();
          g.translate(sx * (sg.len / 2 - 4), 0);
          if (sx > 0) g.scale(-1, 1);
          for (let y = -sg.wid / 2 + 1; y < sg.wid / 2 - 4; y += 16) g.drawImage(spr, -6, y, 12, 18);
          g.restore();
        }
      }
      g.restore();
    }

    // Ojos en la oscuridad: mutantes
    if (input.mapMode !== 'peligro') {
      for (const p of MAP.provinceList) {
        const ps = state.provinces[p.id];
        if (p.kind === 'estacion' || ps.danger < 45 || ps.collapsed || !inView(p.x, p.y)) continue;
        if (vis && !vis.has(p.id)) continue;
        const pairs = ps.danger >= 70 ? 3 : 2;
        for (let k = 0; k < pairs; k++) {
          const blink = Math.sin(t * (0.7 + k * 0.3) + hash2(k, p.x, 3) * 10) > -0.85 ? 1 : 0;
          if (!blink) continue;
          const ox = (hash2(k, p.y, 1) - 0.5) * 16;
          const oy = (hash2(k, p.x, 2) - 0.5) * 10;
          const x = p.x + ox;
          const y = p.y + oy;
          const s = Math.max(0.8, 1.6 / zoom);
          g.save();
          g.globalCompositeOperation = 'lighter';
          const spr = lightSprite('#ff3a1a', 32);
          g.globalAlpha = 0.55;
          g.drawImage(spr, x - 5 * s, y - 3 * s, 10 * s, 6 * s);
          g.globalAlpha = 1;
          g.fillStyle = '#ffb08a';
          g.fillRect(x - 1.6 * s, y - 0.4 * s, 0.9 * s, 0.8 * s);
          g.fillRect(x + 0.7 * s, y - 0.4 * s, 0.9 * s, 0.8 * s);
          g.restore();
        }
      }
    }

    // ---------------------------------------------------------------- Luces
    g.save();
    g.globalCompositeOperation = 'lighter';
    const warm = '#ffb45e';
    for (const sg of STATION_GEO) {
      if (!inView(sg.x, sg.y, 200)) continue;
      const st = state.stations[sg.id];
      const h = this.hall(sg.id, st.owner);
      const dim = input.highlight && state.provinces[sg.id].controller !== input.highlight ? 0.4 : 1;
      if (h.abandoned) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.6 + sg.x);
        g.globalAlpha = 0.16 * pulse * dim;
        const spr = lightSprite('#6fe0a0', 128);
        g.drawImage(spr, sg.x - 70, sg.y - 70, 140, 140);
        continue;
      }
      const flick = q.lights ? 0.92 + 0.08 * Math.sin(t * 1.3 + sg.y) * Math.sin(t * 0.7 + sg.x) : 1;
      g.globalAlpha = (q.lights ? 0.2 : 0.26) * flick * dim;
      const big = lightSprite(warm, 128);
      g.drawImage(big, sg.x - 125, sg.y - 110, 250, 220);
      if (!q.lights) continue;
      g.save();
      g.translate(sg.x, sg.y);
      g.rotate(sg.angle);
      for (const [lx, ly] of h.lamps) {
        const f = 0.85 + 0.15 * Math.sin(t * 7 + lx * 3.1 + ly);
        g.globalAlpha = 0.4 * f * dim;
        g.drawImage(lightSprite('#ffd08a', 64), lx - 13, ly - 13, 26, 26);
      }
      for (const [fx, fy] of h.fires) {
        const f = 0.7 + 0.3 * Math.sin(t * 11 + fx) * Math.sin(t * 7.3 + fy * 2);
        g.globalAlpha = 0.7 * f * dim;
        g.drawImage(lightSprite('#ff8a2a', 64), fx - 16, fy - 16, 32, 32);
        g.globalAlpha = 0.9 * f * dim;
        g.drawImage(lightSprite('#ffe0a0', 32), fx - 3, fy - 3, 6, 6);
      }
      g.restore();
    }
    // Faroles de los tramos con el color del dueño
    for (const p of MAP.provinceList) {
      if (!q.lights || p.kind !== 'tramo' || !inView(p.x, p.y)) continue;
      const ctrl = state.provinces[p.id].controller;
      if (!ctrl || state.provinces[p.id].collapsed) continue;
      const f = 0.8 + 0.2 * Math.sin(t * 3 + p.x * 0.7);
      g.globalAlpha = 0.28 * f;
      g.drawImage(lightSprite(mix(colors[p.id], '#ffc070', 0.45), 64), p.x - 18, p.y - 18, 36, 36);
    }
    g.restore();

    // ---------------------------------------------------------------- Partículas
    this.spawnAmbient(input, cam, view, vis);
    this.particles.update(Math.min(0.1, input.dt));
    this.particles.draw(g, zoom, view);

    // ---------------------------------------------------------------- Niebla de guerra
    if (vis) {
      const key = `${state.player}|${[...vis].sort().join(',')}|${state.openEdges.length}`;
      if (!this.fogLayer || this.fogLayer.key !== key) this.fogLayer = { key, canvas: this.buildFog(vis, state) };
      g.save();
      g.drawImage(this.fogLayer.canvas, WORLD.x, WORLD.y, WORLD.w, WORLD.h);
      g.restore();
    }

    // ---------------------------------------------------------------- Rutas
    if (input.mode === 'game' && state.player) {
      const sel = input.selectedUnits;
      for (const u of Object.values(state.units)) {
        if (u.owner !== state.player || u.path.length === 0) continue;
        if (sel.size > 0 && !sel.has(u.id)) continue;
        const pts: Pt[] = [];
        const shown = this.shown.get(this.groupKey(u));
        pts.push(shown ? [shown.x, shown.y] : [MAP.provinces[u.province].x, MAP.provinces[u.province].y]);
        let prev = u.province;
        for (const pid of u.path) {
          const eb = edgeBetween(prev, pid);
          if (eb) {
            const pp = eb.forward ? eb.geo.pts : [...eb.geo.pts].reverse();
            for (let i = 1; i < pp.length; i++) pts.push(pp[i]);
          } else pts.push([MAP.provinces[pid].x, MAP.provinces[pid].y]);
          prev = pid;
        }
        const isSel = sel.has(u.id);
        g.save();
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        tracePts(g, pts);
        g.strokeStyle = 'rgba(0,0,0,0.6)';
        g.lineWidth = 7 / zoom;
        g.stroke();
        g.strokeStyle = isSel ? 'rgba(255,210,122,0.95)' : 'rgba(233,165,60,0.75)';
        g.lineWidth = 3.4 / zoom;
        g.setLineDash([10 / zoom, 7 / zoom]);
        g.lineDashOffset = -t * (30 / zoom);
        g.stroke();
        g.setLineDash([]);
        // Punta de flecha
        const n = pts.length;
        if (n >= 2) {
          const [x1, y1] = pts[n - 1];
          const [x0, y0] = pts[n - 2];
          const a = Math.atan2(y1 - y0, x1 - x0);
          const s = 11 / zoom;
          g.fillStyle = isSel ? '#ffd27a' : '#e9a53c';
          g.beginPath();
          g.moveTo(x1 + Math.cos(a) * s * 0.6, y1 + Math.sin(a) * s * 0.6);
          g.lineTo(x1 + Math.cos(a + 2.5) * s, y1 + Math.sin(a + 2.5) * s);
          g.lineTo(x1 + Math.cos(a - 2.5) * s, y1 + Math.sin(a - 2.5) * s);
          g.closePath();
          g.fill();
        }
        g.restore();
      }
    }

    // Selección y hover de tramos y cruces
    for (const id of [input.selectedProvince, input.hover]) {
      if (!id) continue;
      const p = MAP.provinces[id];
      if (!p || p.kind === 'estacion') continue;
      const selected = id === input.selectedProvince;
      const pulse = selected ? 1 + 0.15 * Math.sin(t * 5) : 1;
      g.save();
      g.strokeStyle = selected ? '#ffd27a' : 'rgba(228,220,203,0.85)';
      g.lineWidth = 2.4 / zoom;
      g.beginPath();
      g.arc(p.x, p.y, Math.max(14, 15 / zoom) * pulse, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    // ---------------------------------------------------------------- Interfaz a tamaño constante
    this.screenTransform();
    this.drawStationMarkers(input, cam, colors);
    this.drawBattles(input, cam, vis);
    if (input.mode === 'game') this.drawUnits(input, cam, vis);
    else this.counters = [];

    // Viñeta
    if (!q.postfx) return;
    const vg = g.createRadialGradient(this.cssW / 2, this.cssH / 2, Math.min(this.cssW, this.cssH) * 0.35, this.cssW / 2, this.cssH / 2, Math.hypot(this.cssW, this.cssH) * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, this.cssW, this.cssH);
  }

  private worldText(g: Ctx, text: string, x: number, y: number, angle: number, color: string, size: number, align: CanvasTextAlign = 'center') {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.font = `400 ${size}px 'PT Sans Narrow', 'Arial Narrow', sans-serif`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    const spaced = text.split('').join('  ');
    g.fillText(spaced, 0, 0);
    g.restore();
  }

  private groupKey(u: Unit) {
    return `${u.province}|${u.owner}|${u.battle ? 'B' : u.path[0] ?? ''}`;
  }

  private spawnAmbient(input: RenderInput, cam: Camera, view: [number, number, number, number], vis: Set<string> | null) {
    const { state } = input;
    this.spawnAcc += input.dt;
    const zoom = cam.zoom;
    if (this.spawnAcc < 0.05) return;
    const steps = Math.min(4, Math.floor(this.spawnAcc / 0.05));
    this.spawnAcc -= steps * 0.05;
    const inView = (x: number, y: number) => x > view[0] - 40 && x < view[2] + 40 && y > view[1] - 40 && y < view[3] + 40;
    for (let s = 0; s < steps; s++) {
      // Humo y brasas de las hogueras
      if (zoom > 0.7) {
        for (const sg of STATION_GEO) {
          if (!inView(sg.x, sg.y)) continue;
          const h = hallCache.get(`${sg.id}|${state.stations[sg.id].owner ?? '-'}`);
          if (!h) continue;
          for (const [fx, fy] of h.fires) {
            if (Math.random() > 0.35) continue;
            const x = sg.x + fx * sg.cos - fy * sg.sin;
            const y = sg.y + fx * sg.sin + fy * sg.cos;
            this.particles.spawn({ kind: 'smoke', x, y, vx: (Math.random() - 0.5) * 2 + 1.5, vy: -2 - Math.random() * 2, max: 3 + Math.random() * 2, size: 2.5, color: '#8a8278' });
            if (Math.random() < 0.3) this.particles.spawn({ kind: 'ember', x, y, vx: (Math.random() - 0.5) * 4, vy: -4 - Math.random() * 6, max: 0.8 + Math.random() * 0.8, size: 0.45, color: '#ffb050' });
          }
          if (!h.abandoned && Math.random() < 0.25) {
            const lx = (Math.random() - 0.5) * sg.len;
            const ly = (Math.random() - 0.5) * sg.wid;
            this.particles.spawn({ kind: 'dust', x: sg.x + lx * sg.cos - ly * sg.sin, y: sg.y + lx * sg.sin + ly * sg.cos, vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, max: 4 + Math.random() * 4, size: 0.35, color: '#ffe0b0' });
          }
        }
      }
      // Combate: fogonazos y trazadoras
      let level = 0;
      for (const b of Object.values(state.battles)) {
        const p = MAP.provinces[b.province];
        if (!inView(p.x, p.y) || (vis && !vis.has(b.province))) continue;
        const n = b.attackers.length + b.defenders.length;
        level += n;
        const rate = Math.min(0.9, 0.18 + n * 0.08);
        if (Math.random() > rate) continue;
        const attackerUnit = state.units[b.attackers[Math.floor(Math.random() * b.attackers.length)]];
        const from = attackerUnit ? MAP.provinces[attackerUnit.province] : p;
        const ax = from.x + (Math.random() - 0.5) * 10;
        const ay = from.y + (Math.random() - 0.5) * 10;
        const dx = p.x + (Math.random() - 0.5) * 12;
        const dy = p.y + (Math.random() - 0.5) * 12;
        const fromDefender = Math.random() < 0.45;
        const [sx, sy, tx, ty] = fromDefender ? [dx, dy, ax, ay] : [ax, ay, dx, dy];
        this.particles.spawn({ kind: 'flash', x: sx, y: sy, vx: 0, vy: 0, max: 0.12, size: 6, color: '#ffd890' });
        const len = Math.hypot(tx - sx, ty - sy) || 1;
        const speed = 260;
        const ux = ((tx - sx) / len) * speed;
        const uy = ((ty - sy) / len) * speed;
        this.particles.spawn({ kind: 'tracer', x: sx, y: sy, x2: sx + ux * 0.03, y2: sy + uy * 0.03, vx: ux, vy: uy, max: Math.min(0.6, len / speed), size: 0.6, color: fromDefender ? '#ffcf7a' : '#ff8a5a' });
        if (Math.random() < 0.06) {
          this.particles.spawn({ kind: 'flash', x: dx, y: dy, vx: 0, vy: 0, max: 0.45, size: 22, color: '#ff9a40' });
          this.particles.spawn({ kind: 'ring', x: dx, y: dy, vx: 0, vy: 0, max: 0.5, size: 2, color: '#ffd8a0' });
          for (let k = 0; k < 6; k++) this.particles.spawn({ kind: 'debris', x: dx, y: dy, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, max: 0.7, size: 0.8, color: '#6a5a48' });
          this.particles.spawn({ kind: 'smoke', x: dx, y: dy, vx: 0, vy: -1, max: 3, size: 5, color: '#a09488' });
        }
        if (Math.random() < 0.15) this.particles.spawn({ kind: 'smoke', x: dx, y: dy, vx: (Math.random() - 0.5) * 3, vy: -1.5, max: 2.5, size: 3, color: '#9a918a' });
      }
      this.battleLevel = Math.min(1, level / 12);
    }
  }

  // ------------------------------------------------------------------ Emblemas y rótulos

  private drawStationMarkers(input: RenderInput, cam: Camera, colors: Record<string, string>) {
    const g = this.g;
    const { state } = input;
    const t = input.time;
    for (const s of STATION_SEEDS) {
      const [sx, sy] = this.worldToScreen(cam, s.x, s.y);
      if (sx < -80 || sy < -80 || sx > this.cssW + 80 || sy > this.cssH + 80) continue;
      const st = state.stations[s.id];
      const ctrl = state.provinces[s.id].controller;
      const occupied = ctrl !== st.owner;
      const selected = input.selectedProvince === s.id;
      const hovered = input.hover === s.id;
      const dim = input.highlight && ctrl !== input.highlight;
      const R = 18;
      g.save();
      if (dim) g.globalAlpha = 0.5;
      // Anillo del modo de mapa (fuera del político)
      if (input.mapMode !== 'politico' && input.mode === 'game') {
        g.fillStyle = colors[s.id];
        g.beginPath();
        g.arc(sx, sy, R + 5, 0, Math.PI * 2);
        g.fill();
      }
      if (occupied && ctrl) {
        g.strokeStyle = FACTIONS[ctrl].color;
        g.lineWidth = 3.5;
        g.setLineDash([5, 3.5]);
        g.lineDashOffset = -t * 8;
        g.beginPath();
        g.arc(sx, sy, R + 5, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
      }
      if (selected || hovered) {
        const pulse = selected ? 1 + 0.08 * Math.sin(t * 5) : 1;
        g.strokeStyle = selected ? '#ffd27a' : 'rgba(235,228,210,0.9)';
        g.lineWidth = 2.5;
        g.shadowColor = selected ? 'rgba(255,200,100,0.8)' : 'transparent';
        g.shadowBlur = selected && this.q.postfx ? 10 : 0;
        g.beginPath();
        g.arc(sx, sy, (R + 3) * pulse, 0, Math.PI * 2);
        g.stroke();
        g.shadowBlur = 0;
      }
      const em = emblemCanvas(st.owner, 96);
      g.drawImage(em, sx - R, sy - R, R * 2, R * 2);
      const isCapital = st.owner && state.countries[st.owner].capital === s.id;
      if (isCapital) {
        const star = starSprite(this.dpr);
        g.drawImage(star, sx - 8, sy - R - 15, 16, 16);
      }
      // Rótulo (se omite si el mapa se ve demasiado pequeño para leerlo)
      if (cam.zoom < 0.33 && !(input.highlight && ctrl === input.highlight)) {
        g.restore();
        continue;
      }
      const lab = labelSprite(STATIONS[s.id].shortName, this.dpr, cam.zoom < 0.55);
      const lw = lab.width / this.dpr;
      const lh = lab.height / this.dpr;
      const [dx, dy] = LABEL_DIR[s.label] ?? [1, 0];
      const gap = R + 6;
      let lx = sx + dx * gap;
      let ly = sy + dy * gap;
      if (dx < -0.1) lx -= lw;
      else if (Math.abs(dx) <= 0.1) lx -= lw / 2;
      if (dy < -0.1) ly -= lh + (isCapital && Math.abs(dx) <= 0.1 ? 12 : 0);
      else if (Math.abs(dy) <= 0.1) ly -= lh / 2;
      g.drawImage(lab, lx, ly, lw, lh);
      if (input.mapMode === 'recursos') this.drawResourceBadge(st.resources, sx, dy > 0.1 ? sy - R - (isCapital ? 34 : 22) : sy + R + 8);
      g.restore();
    }
  }

  /** Yacimientos de la estación (modo de mapa de recursos), al estilo de los iconos de HoI4. */
  private drawResourceBadge(res: Record<ResourceId, number>, cx: number, top: number) {
    const g = this.g;
    const items = RESOURCE_IDS.filter((r) => res[r] > 0);
    const W_ITEM = 30;
    const w = Math.max(24, items.length * W_ITEM + 6);
    const h = 18;
    const x = cx - w / 2;
    g.save();
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(10,12,11,0.9)';
    g.strokeStyle = 'rgba(233,165,60,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x, top, w, h, 4);
    g.fill();
    g.stroke();
    g.font = `700 11px 'PT Mono', ui-monospace, monospace`;
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    if (items.length === 0) {
      g.fillStyle = 'rgba(200,190,170,0.5)';
      g.textAlign = 'center';
      g.fillText('—', cx, top + h / 2 + 0.5);
    }
    items.forEach((r, i) => {
      const ix = x + 4 + i * W_ITEM;
      strokeIcon(g, RESOURCE_STYLE[r].icon, ix + 7, top + h / 2, 12, RESOURCE_STYLE[r].color, 2.2);
      g.fillStyle = RESOURCE_STYLE[r].color;
      g.fillText(String(res[r]), ix + 15, top + h / 2 + 0.5);
    });
    g.restore();
  }

  // ------------------------------------------------------------------ Batallas

  private drawBattles(input: RenderInput, cam: Camera, vis: Set<string> | null) {
    const g = this.g;
    const { state } = input;
    this.battleHits = [];
    for (const b of Object.values(state.battles)) {
      if (vis && !vis.has(b.province)) continue;
      const p = MAP.provinces[b.province];
      const [sx, sy0] = this.worldToScreen(cam, p.x, p.y);
      const sy = sy0 - (p.kind === 'estacion' ? 50 : 72);
      if (sx < -60 || sy < -60 || sx > this.cssW + 60 || sy > this.cssH + 60) continue;
      const w = 46;
      const h = 26;
      const x = sx - w / 2;
      const y = sy - h / 2;
      const pulse = 0.6 + 0.4 * Math.sin(input.time * 6);
      g.save();
      g.shadowColor = `rgba(224,97,74,${0.6 * pulse})`;
      g.shadowBlur = this.q.postfx ? 12 : 0;
      g.fillStyle = 'rgba(28,12,10,0.95)';
      g.beginPath();
      g.roundRect(x, y, w, h, 4);
      g.fill();
      g.shadowBlur = 0;
      g.strokeStyle = '#e0614a';
      g.lineWidth = 1.6;
      g.stroke();
      strokeIcon(g, 'Swords', sx, y + 11, 16, '#ffd2c6', 2.2);
      const adv = clamp(b.lastAdvantage);
      g.fillStyle = '#3a1a14';
      g.fillRect(x + 4, y + h - 6, w - 8, 3);
      g.fillStyle = FACTIONS[b.attackerSide].color;
      g.fillRect(x + 4, y + h - 6, (w - 8) * adv, 3);
      g.restore();
      this.battleHits.push({ x, y, w, h, province: b.province });
    }
  }

  // ------------------------------------------------------------------ Unidades

  private moveFraction(state: GameState, u: Unit): number {
    if (!u.path.length || u.battle || u.moveProgress <= 0) return 0;
    const cached = this.needCache.get(u.id);
    let need: number;
    if (cached && cached.hour === state.hour) need = cached.need;
    else {
      const eb = edgeBetween(u.province, u.path[0]);
      if (!eb) return 0;
      const stats = unitStats(state, u);
      need = edgeHours(state, u.owner, stats.speed, eb.geo.edge.length, eb.geo.edge.terrain, u.outOfSupply);
      this.needCache.set(u.id, { hour: state.hour, need });
    }
    return clamp(u.moveProgress / need, 0, 0.98);
  }

  private drawUnits(input: RenderInput, cam: Camera, vis: Set<string> | null) {
    const { state } = input;
    const player = state.player;
    const groups = new Map<string, Unit[]>();
    for (const u of Object.values(state.units)) {
      if (vis && !vis.has(u.province) && u.owner !== player) continue;
      const key = this.groupKey(u);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(u);
    }
    // Posición objetivo de cada grupo (a mitad de camino si avanza)
    const perProvince = new Map<string, number>();
    const items: { key: string; list: Unit[]; wx: number; wy: number; moving: boolean; slot: number }[] = [];
    for (const [key, list] of groups) {
      const u = list[0];
      const p = MAP.provinces[u.province];
      let wx = p.x;
      let wy = p.y;
      let moving = false;
      if (u.path.length && !u.battle) {
        const f = list.reduce((s, x) => s + this.moveFraction(state, x), 0) / list.length;
        const eb = edgeBetween(u.province, u.path[0]);
        if (eb && f > 0) {
          const pt = sampleAt(eb.geo, eb.forward ? eb.geo.len * f : eb.geo.len * (1 - f));
          wx = pt.x;
          wy = pt.y;
          moving = true;
        } else moving = true;
      }
      const slotKey = moving ? key : u.province;
      const slot = perProvince.get(slotKey) ?? 0;
      perProvince.set(slotKey, slot + 1);
      items.push({ key, list, wx, wy, moving, slot });
    }
    const now = input.time;
    const k = 1 - Math.exp(-input.dt * 7);
    this.counters = [];
    const seen = new Set<string>();
    for (const it of items) {
      seen.add(it.key);
      let shown = this.shown.get(it.key);
      if (!shown || Math.hypot(shown.x - it.wx, shown.y - it.wy) > 160) {
        // Al entrar en una provincia nueva se parte del punto de origen del grupo previo
        shown = { x: it.wx, y: it.wy, seen: now };
        this.shown.set(it.key, shown);
      } else {
        shown.x += (it.wx - shown.x) * k;
        shown.y += (it.wy - shown.y) * k;
        shown.seen = now;
      }
      const u = it.list[0];
      const p = MAP.provinces[u.province];
      const [sx, sy] = this.worldToScreen(cam, shown.x, shown.y);
      if (sx < -80 || sy < -80 || sx > this.cssW + 80 || sy > this.cssH + 80) continue;
      const W = 56;
      const H = 38;
      let x: number;
      let y: number;
      if (!it.moving && p.kind === 'estacion') {
        // Las fichas van al lado contrario del rótulo de la estación
        const seed = STATION_SEEDS.find((q) => q.id === p.id);
        const leftSide = (LABEL_DIR[seed?.label ?? 'left']?.[0] ?? 0) > 0.1;
        x = leftSide ? sx - 24 - W - it.slot * (W + 3) : sx + 24 + it.slot * (W + 3);
        y = sy - H / 2 + 2;
      } else {
        x = sx - W / 2 + it.slot * (W + 3);
        y = sy - H - 12;
      }
      this.drawCounter(input, it.list, x, y, W, H, it.moving);
      this.counters.push({ key: it.key, x, y, w: W, h: H, province: u.province, owner: u.owner, ids: it.list.map((x2) => x2.id) });
    }
    for (const key of [...this.shown.keys()]) if (!seen.has(key)) this.shown.delete(key);
  }

  private drawCounter(input: RenderInput, list: Unit[], x: number, y: number, W: number, H: number, moving: boolean) {
    const g = this.g;
    const { state } = input;
    const u = list[0];
    const owner = u.owner;
    const player = state.player;
    const sel = list.some((x2) => input.selectedUnits.has(x2.id));
    const hovered = input.hoverCounter === this.groupKey(u);
    const inBattle = list.some((x2) => x2.battle);
    const hostile = player && owner !== player && isAtWarWith(state, player, owner);
    const ally = player && owner !== player && friendly(state, player, owner);
    const border = sel ? '#ffd27a' : hostile ? '#e0614a' : ally ? '#8cc063' : owner === player ? '#b3955c' : '#555048';
    const strength = list.reduce((s, x2) => s + x2.strength, 0) / list.length;
    const org = list.reduce((s, x2) => s + x2.org / Math.max(1, unitStats(state, x2).org), 0) / list.length;
    const color = FACTIONS[owner].color;
    g.save();
    // Placa
    g.shadowColor = 'rgba(0,0,0,0.7)';
    g.shadowBlur = this.q.postfx ? 6 : 0;
    g.shadowOffsetY = 2;
    g.fillStyle = 'rgba(13,15,14,0.94)';
    g.beginPath();
    g.roundRect(x, y, W, H, 3);
    g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = sel || hovered ? 2 : 1.3;
    g.strokeStyle = inBattle ? `rgba(224,97,74,${0.6 + 0.4 * Math.sin(input.time * 8)})` : hovered && !sel ? '#e4dccb' : border;
    g.stroke();
    // Recuadro con el color de la facción y la figura
    const bx = x + 3;
    const by = y + 3;
    const bw = 31;
    const bh = H - 11;
    const bg = g.createLinearGradient(bx, by, bx, by + bh);
    bg.addColorStop(0, shade(color, 0.12));
    bg.addColorStop(1, shade(color, -0.45));
    g.fillStyle = bg;
    g.fillRect(bx, by, bw, bh);
    const kind = unitKind(state, u);
    const frame = moving ? Math.floor(input.time * 6) % 3 : 1;
    const spr = unitSprite(owner, kind, frame);
    const bob = moving ? Math.abs(Math.sin(input.time * 9)) * 0.8 : 0;
    g.save();
    g.beginPath();
    g.rect(bx, by, bw, bh);
    g.clip();
    g.drawImage(spr, bx + bw / 2 - 17, by + bh - 32 - bob, 34, 34);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 1;
    g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    // Número de unidades
    g.fillStyle = '#efe6d2';
    g.font = `700 15px 'PT Mono', ui-monospace, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(list.length), x + 34 + (W - 34) / 2, y + (H - 8) / 2 + 1);
    // Barras de organización y fuerza
    const barX = x + 3;
    const barW = W - 6;
    g.fillStyle = '#060606';
    g.fillRect(barX, y + H - 7, barW, 2.5);
    g.fillRect(barX, y + H - 4, barW, 2.5);
    g.fillStyle = '#8cc063';
    g.fillRect(barX, y + H - 7, barW * clamp(org), 2.5);
    g.fillStyle = '#e9a53c';
    g.fillRect(barX, y + H - 4, barW * clamp(strength), 2.5);
    if (moving && !inBattle) {
      g.fillStyle = '#ffd27a';
      g.beginPath();
      g.moveTo(x + W + 2, y + 9);
      g.lineTo(x + W + 8, y + 13);
      g.lineTo(x + W + 2, y + 17);
      g.closePath();
      g.fill();
    }
    g.restore();
  }
}
