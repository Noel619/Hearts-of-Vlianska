// Mapa del metro: lienzo animado (src/gfx/map) con cámara, selección,
// órdenes de movimiento y tooltips.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FACTIONS, MAP, MAP_HEIGHT, MAP_WIDTH, TERRAIN_INFO } from '../../data';
import type { FactionId, GameState } from '../../game/types';
import { provinceName } from '../../game/helpers';
import { orderMove, unitStats } from '../../game/military';
import { DPR } from '../../gfx/canvas';
import { mapLayersReady, MapRenderer, prepareMapLayers, type Camera, type CounterHit } from '../../gfx/map/renderer';
import { Bar, fmt, hideTip, showHoverTip, showTip } from '../components/core';
import { centerMapOn, store, ui, type MapMode } from '../store';

export interface MapViewProps {
  mode: 'game' | 'preview' | 'demo';
  state: GameState;
  highlight?: FactionId | null;
  onPickFaction?: (f: FactionId) => void;
  mapMode?: MapMode;
}

/** Nivel de combate visible en el mapa de la partida (lo usa el sonido). */
export const mapActivity = { battle: 0, renderMs: 0 };

const MIN_VIEW_W = 300;
const MAX_VIEW_W = 2700;

function fitCamera(w: number, h: number, x: number, y: number, vw: number, vh: number): Camera {
  return { x: x + vw / 2, y: y + vh / 2, zoom: Math.min(w / vw, h / vh) };
}

function initialCamera(mode: MapViewProps['mode'], state: GameState, w: number, h: number): Camera {
  if (mode === 'demo') return fitCamera(w, h, 200, 40, 1480, 1480 * (MAP_HEIGHT / MAP_WIDTH));
  if (mode === 'preview') return fitCamera(w, h, -20, -10, MAP_WIDTH + 40, MAP_HEIGHT + 20);
  const cap = state.player ? MAP.provinces[state.countries[state.player].capital] : undefined;
  if (w < 820 && cap) return { x: cap.x, y: cap.y, zoom: w / 760 };
  return fitCamera(w, h, 60, 0, 1800, 1080);
}

function clampCamera(c: Camera, w: number): Camera {
  const zoom = Math.max(w / MAX_VIEW_W, Math.min(w / MIN_VIEW_W, c.zoom));
  return { zoom, x: Math.max(-300, Math.min(MAP_WIDTH + 300, c.x)), y: Math.max(-240, Math.min(MAP_HEIGHT + 240, c.y)) };
}

export function MapView({ mode, state, highlight, onPickFaction, mapMode: forcedMode }: MapViewProps) {
  const uiState = ui.use();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<MapRenderer | null>(null);
  const cam = useRef<Camera>({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2, zoom: 0.8 });
  const goal = useRef<Camera | null>(null);
  const size = useRef({ w: 1, h: 1, init: false });
  const hover = useRef<{ id: string | null; counter: string | null }>({ id: null, counter: null });
  const lastInput = useRef(performance.now());
  const [ready, setReady] = useState(mapLayersReady());
  const props = useRef({ mode, state, highlight, onPickFaction, forcedMode });
  props.current = { mode, state, highlight, onPickFaction, forcedMode };
  const interactive = mode === 'game';

  // Creación del renderizador y bucle de dibujo
  useEffect(() => {
    const canvas = canvasRef.current!;
    const r = new MapRenderer(canvas);
    renderer.current = r;
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let frame = 0;
    const start = () => {
      r.prepare();
      if (!alive) return;
      setReady(true);
      const loop = (now: number) => {
        if (!alive) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.1, (now - last) / 1000);
        frame++;
        const p = props.current;
        // A 30 fps cuando no pasa nada, para ahorrar batería
        const busy = now - lastInput.current < 2500 || store.speed > 0 || goal.current !== null || p.mode === 'demo';
        if (!busy && frame % 2 === 1) return;
        last = now;
        if (document.hidden) return;
        const c = cam.current;
        if (p.mode === 'demo') {
          const k = now / 1000;
          const base = initialCamera('demo', p.state, size.current.w, size.current.h);
          cam.current = { x: base.x + Math.sin(k * 0.05) * 150, y: base.y + Math.cos(k * 0.04) * 60, zoom: base.zoom * (1.03 + Math.sin(k * 0.07) * 0.06) };
        } else if (goal.current) {
          const gk = 1 - Math.exp(-dt * 7);
          const gl = goal.current;
          const next = { x: c.x + (gl.x - c.x) * gk, y: c.y + (gl.y - c.y) * gk, zoom: c.zoom + (gl.zoom - c.zoom) * gk };
          cam.current = next;
          if (Math.abs(gl.x - next.x) < 0.3 && Math.abs(gl.y - next.y) < 0.3 && Math.abs(gl.zoom - next.zoom) < 0.001) {
            cam.current = gl;
            goal.current = null;
          }
        }
        const u = ui.get();
        const t0 = performance.now();
        r.render(
          {
            state: p.state,
            mode: p.mode,
            mapMode: p.forcedMode ?? (p.mode === 'game' ? u.mapMode : 'politico'),
            highlight: p.highlight ?? null,
            selectedProvince: p.mode === 'game' ? u.selectedProvince : null,
            selectedUnits: new Set(p.mode === 'game' ? u.selectedUnits : []),
            hover: hover.current.id,
            hoverCounter: hover.current.counter,
            moveMode: u.moveMode,
            fog: store.settings.fog,
            time: now / 1000,
            dt,
          },
          cam.current,
        );
        mapActivity.renderMs = mapActivity.renderMs * 0.9 + (performance.now() - t0) * 0.1;
        if (p.mode === 'game') mapActivity.battle = r.battleLevel;
      };
      raf = requestAnimationFrame(loop);
    };
    // La primera vez hay que pintar la roca: se deja respirar a la interfaz antes.
    const t = window.setTimeout(start, mapLayersReady() ? 0 : 30);
    return () => {
      alive = false;
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
      if (props.current.mode === 'game') mapActivity.battle = 0;
    };
  }, []);

  // Tamaño del lienzo
  useEffect(() => {
    const el = wrapRef.current!;
    const apply = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      size.current.w = w;
      size.current.h = h;
      renderer.current?.resize(w, h, DPR());
      if (!size.current.init && w > 10) {
        size.current.init = true;
        cam.current = initialCamera(props.current.mode, props.current.state, w, h);
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Centrar el mapa cuando se pide desde un panel
  useEffect(() => {
    if (!uiState.centerOn || mode !== 'game') return;
    const p = MAP.provinces[uiState.centerOn.id];
    if (!p) return;
    const w = size.current.w;
    const zoom = Math.max(cam.current.zoom, w / 1100);
    goal.current = clampCamera({ x: p.x, y: p.y, zoom }, w);
  }, [uiState.centerOn, mode]);

  // ------------------------------------------------------------------ Interacción
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean; id: number; button: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; zoom: number; cx: number; cy: number } | null>(null);
  const hoverPending = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);

  const localPoint = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const issueMove = (pid: string) => {
    const s = ui.get();
    const st = props.current.state;
    const ids = s.selectedUnits.filter((id) => st.units[id]?.owner === st.player);
    if (!ids.length) return;
    const n = store.act((x) => orderMove(x, ids, pid)) ?? 0;
    ui.set({ moveMode: false });
    if (n === 0) showTip(<div className="bad">No hay ruta posible hasta {provinceName(pid)}.</div>, window.innerWidth / 2, 120);
  };

  const hoverTip = (pid: string) => (): ReactNode => {
    const st = props.current.state;
    const def = MAP.provinces[pid];
    const p = st.provinces[pid];
    const station = st.stations[pid];
    const tInfo = TERRAIN_INFO[def.terrain];
    return (
      <div>
        <h4>{def.name}</h4>
        {station ? (
          <div className="tt-row">
            <span>Dueño</span>
            <span>{station.owner ? FACTIONS[station.owner].name : 'Abandonada'}</span>
          </div>
        ) : (
          <div className="tt-desc">{tInfo.name}</div>
        )}
        {p.controller !== (station?.owner ?? p.controller) && (
          <div className="tt-row bad">
            <span>Ocupada por</span>
            <span>{p.controller ? FACTIONS[p.controller].name : 'nadie'}</span>
          </div>
        )}
        {!station && (
          <div className="tt-row">
            <span>Control</span>
            <span>{p.controller ? FACTIONS[p.controller].name : 'Tierra de nadie'}</span>
          </div>
        )}
        {station && (
          <div className="tt-row">
            <span>Población</span>
            <span className="num">{fmt(station.population)}</span>
          </div>
        )}
        <div className="tt-row">
          <span>Barricadas</span>
          <span className="num">{p.fort} / 5</span>
        </div>
        {p.danger > 0 && (
          <div className={`tt-row ${p.danger >= 40 ? 'bad' : ''}`}>
            <span>Peligro mutante</span>
            <span className="num">{Math.round(p.danger)}</span>
          </div>
        )}
        {p.collapsed && <div className="bad">Derrumbe: infranqueable</div>}
        {p.floodedUntil && p.floodedUntil > st.hour && <div className="bad">Inundado</div>}
        {def.underRiver && <div className="dim">Pasa bajo el río</div>}
        <div className="tt-sep" />
        <div className="dim">{tInfo.desc}</div>
        <div className="dim">Ancho de combate: {tInfo.width}</div>
        {interactive && <div className="faint" style={{ marginTop: 4 }}>Clic: detalles · Clic derecho: mover unidades aquí</div>}
      </div>
    );
  };

  const counterTip = (c: CounterHit) => (): ReactNode => {
    const st = props.current.state;
    const list = c.ids.map((id) => st.units[id]).filter(Boolean);
    return (
      <div>
        <h4>{FACTIONS[c.owner].name}</h4>
        {list.map((u) => (
          <div key={u.id} style={{ marginBottom: 4 }}>
            <div>{u.name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <Bar value={u.org / Math.max(1, unitStats(st, u).org)} color="green" thin />
              <Bar value={u.strength} thin />
            </div>
          </div>
        ))}
        {c.owner === st.player && <div className="faint">Clic: seleccionar · Mayús+clic: añadir</div>}
      </div>
    );
  };

  const updateHover = (x: number, y: number, clientX: number, clientY: number) => {
    const r = renderer.current;
    if (!r || !r.ready) return;
    const hit = r.hitTest(cam.current, x, y, props.current.state);
    const canvas = canvasRef.current!;
    if (hit.type === 'counter') {
      hover.current = { id: null, counter: hit.counter.key };
      if (props.current.mode === 'game') showHoverTip(counterTip(hit.counter), clientX, clientY);
      canvas.style.cursor = 'pointer';
    } else if (hit.type === 'province' || hit.type === 'battle') {
      const id = hit.type === 'province' ? hit.id : hit.province;
      hover.current = { id, counter: null };
      if (props.current.mode !== 'demo') showHoverTip(hoverTip(id), clientX, clientY);
      canvas.style.cursor = ui.get().moveMode ? 'crosshair' : 'pointer';
    } else {
      if (hover.current.id || hover.current.counter) hideTip();
      hover.current = { id: null, counter: null };
      canvas.style.cursor = ui.get().moveMode ? 'crosshair' : interactive ? 'grab' : 'default';
    }
  };

  const click = (x: number, y: number, button: number, shift: boolean) => {
    const r = renderer.current;
    if (!r) return;
    const st = props.current.state;
    const hit = r.hitTest(cam.current, x, y, st);
    if (props.current.mode === 'preview') {
      if (hit.type === 'province') {
        const owner = st.stations[hit.id]?.owner ?? st.provinces[hit.id].controller;
        if (owner) props.current.onPickFaction?.(owner);
      }
      return;
    }
    if (!interactive) return;
    const s = ui.get();
    const target = hit.type === 'counter' ? hit.counter.province : hit.type === 'province' ? hit.id : hit.type === 'battle' ? hit.province : null;
    if (button === 2) {
      if (target && s.selectedUnits.length) issueMove(target);
      return;
    }
    if (s.moveMode && s.selectedUnits.length && target) {
      issueMove(target);
      return;
    }
    if (hit.type === 'counter') {
      const c = hit.counter;
      if (c.owner !== st.player) {
        ui.set({ selectedProvince: c.province, selectedUnits: [] });
        return;
      }
      const next = shift ? [...new Set([...s.selectedUnits, ...c.ids])] : c.ids;
      ui.set({ selectedUnits: next, selectedProvince: null });
      return;
    }
    if (target) {
      ui.set({ selectedProvince: target, selectedUnits: shift ? s.selectedUnits : [] });
      return;
    }
    ui.set({ selectedProvince: null, selectedUnits: [], moveMode: false });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    lastInput.current = performance.now();
    if (mode === 'demo') return;
    const pt = localPoint(e);
    pointers.current.set(e.pointerId, pt);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2 && interactive) {
      const [a, b] = [...pointers.current.values()];
      const [cx, cy] = renderer.current!.screenToWorld(cam.current, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: cam.current.zoom, cx, cy };
      drag.current = null;
      return;
    }
    drag.current = { x: pt.x, y: pt.y, cx: cam.current.x, cy: cam.current.y, moved: false, id: e.pointerId, button: e.button };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    lastInput.current = performance.now();
    const pt = localPoint(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, pt);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const zoom = pinch.current.zoom * (d / Math.max(10, pinch.current.d));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const w = size.current.w;
      const h = size.current.h;
      goal.current = null;
      cam.current = clampCamera({ zoom, x: pinch.current.cx - (mx - w / 2) / zoom, y: pinch.current.cy - (my - h / 2) / zoom }, w);
      return;
    }
    const d = drag.current;
    if (d && d.id === e.pointerId && interactive) {
      if (Math.abs(pt.x - d.x) + Math.abs(pt.y - d.y) > 5) d.moved = true;
      if (d.moved) {
        hideTip();
        goal.current = null;
        canvasRef.current!.style.cursor = 'grabbing';
        cam.current = clampCamera({ zoom: cam.current.zoom, x: d.cx - (pt.x - d.x) / cam.current.zoom, y: d.cy - (pt.y - d.y) / cam.current.zoom }, size.current.w);
        return;
      }
    }
    if (e.pointerType === 'touch') return;
    // El hover se resuelve una vez por fotograma
    if (!hoverPending.current) {
      requestAnimationFrame(() => {
        const hp = hoverPending.current;
        hoverPending.current = null;
        if (hp) updateHover(hp.x, hp.y, hp.cx, hp.cy);
      });
    }
    hoverPending.current = { x: pt.x, y: pt.y, cx: e.clientX, cy: e.clientY };
  };

  const onPointerUp = (e: React.PointerEvent) => {
    lastInput.current = performance.now();
    const pt = localPoint(e);
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (d && d.id === e.pointerId && !d.moved) click(pt.x, pt.y, d.button, e.shiftKey);
    if (d?.moved && canvasRef.current) canvasRef.current.style.cursor = interactive ? 'grab' : 'default';
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    lastInput.current = performance.now();
    const pt = localPoint(e);
    const base = goal.current ?? cam.current;
    const factor = Math.exp(-Math.max(-300, Math.min(300, e.deltaY)) * 0.0022);
    const w = size.current.w;
    const h = size.current.h;
    const [wx, wy] = renderer.current!.screenToWorld(base, pt.x, pt.y);
    const zoom = Math.max(w / MAX_VIEW_W, Math.min(w / MIN_VIEW_W, base.zoom * factor));
    goal.current = clampCamera({ zoom, x: wx - (pt.x - w / 2) / zoom, y: wy - (pt.y - h / 2) / zoom }, w);
  };

  const onLeave = () => {
    hover.current = { id: null, counter: null };
    hideTip();
  };

  return (
    <div ref={wrapRef} className={`map-wrap ${interactive ? 'interactive' : ''} ${mode}`}>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onLeave}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        role="img"
        aria-label="Mapa del metro de Vlianska"
      />
      {!ready && mode !== 'demo' && (
        <div className="map-loading">
          <span className="spinner" />
          Cartografiando los túneles…
        </div>
      )}
    </div>
  );
}

export function focusProvince(id: string) {
  centerMapOn(id);
  ui.set({ selectedProvince: id });
}

/** Genera las capas del mapa por adelantado (por ejemplo, mientras se ve el menú). */
export function preloadMap() {
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
  const run = () => prepareMapLayers();
  if (w.requestIdleCallback) w.requestIdleCallback(run);
  else setTimeout(run, 200);
}
