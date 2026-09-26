// Mapa del metro: túneles, estaciones, unidades y batallas.
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FACTIONS, MAP, MAP_HEIGHT, MAP_WIDTH, RIVERS, STATION_SEEDS, STATIONS, TERRAIN_INFO } from '../../data';
import type { FactionId, GameState, Unit } from '../../game/types';
import { friendly, isAtWarWith, provinceName } from '../../game/helpers';
import { suppliedProvinces } from '../../game/military';
import { orderMove, unitStats } from '../../game/military';
import { MapEmblem } from '../components/art';
import { Bar, fmt, hideTip, showHoverTip, showTip } from '../components/core';
import { centerMapOn, store, ui, type MapMode } from '../store';
import { factionOrNeutral, polyPath, provinceColor, smoothPath, splitHalf, visibleProvinces } from './mapUtil';

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FULL: View = { x: 0, y: 0, w: MAP_WIDTH, h: MAP_HEIGHT };
/** Encuadre del menú principal; el movimiento de cámara lo hace una animación CSS. */
const DEMO: View = { x: 180, y: 40, w: 1500, h: 1500 * (MAP_HEIGHT / MAP_WIDTH) };

const LABEL_OFFSETS: Record<string, [number, number, 'start' | 'middle' | 'end']> = {
  left: [-30, 6, 'end'],
  right: [30, 6, 'start'],
  top: [0, -32, 'middle'],
  bottom: [0, 44, 'middle'],
  topleft: [-18, -30, 'end'],
  topright: [18, -30, 'start'],
  bottomleft: [-14, 44, 'end'],
  bottomright: [14, 44, 'start'],
};

const Background = memo(function Background() {
  return (
    <g>
      <defs>
        <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke="#1d231f" strokeWidth="1" />
        </pattern>
        <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.65" />
        </radialGradient>
        <radialGradient id="lamp" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb347" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
        <pattern id="hazard" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="16" fill="#e6b93f" />
          <rect x="8" width="8" height="16" fill="#1a1a14" />
        </pattern>
        <filter id="blurRiver" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <rect x={-2000} y={-2000} width={MAP_WIDTH + 4000} height={MAP_HEIGHT + 4000} fill="#0b0e0c" />
      <rect x={-2000} y={-2000} width={MAP_WIDTH + 4000} height={MAP_HEIGHT + 4000} fill="url(#grid)" />
      <g filter="url(#blurRiver)" opacity={0.55}>
        {RIVERS.map((r, i) => (
          <path key={i} d={smoothPath(r)} stroke="#1f5775" strokeWidth={34} fill="none" strokeLinecap="round" />
        ))}
      </g>
      {RIVERS.map((r, i) => (
        <path key={`c${i}`} d={smoothPath(r)} stroke="#2f6f8f" strokeOpacity={0.35} strokeWidth={3} fill="none" strokeDasharray="2 10" />
      ))}
      <text x={1560} y={300} className="map-surface-label" transform="rotate(72 1560 300)">
        Río Vlia · superficie
      </text>
      <text x={40} y={1060} className="map-surface-label">
        Metro de Vlianska · Óblast de Múrmansk
      </text>
    </g>
  );
});

function edgeWidth(terrain: string) {
  switch (terrain) {
    case 'linea':
      return 12;
    case 'tunel':
    case 'peligroso':
      return 9;
    case 'derrumbe':
      return 8;
    default:
      return 6;
  }
}

function initialView(mode: MapViewProps['mode'], state: GameState): View {
  if (mode === 'demo') return DEMO;
  if (mode !== 'game') return FULL;
  // En pantallas estrechas se empieza cerca de la capital del jugador.
  const narrow = typeof window !== 'undefined' && window.innerWidth < 820;
  const cap = state.player ? MAP.provinces[state.countries[state.player].capital] : undefined;
  if (narrow && cap) {
    const w = 760;
    const h = w * Math.max(1, window.innerHeight / window.innerWidth);
    return { x: cap.x - w / 2, y: cap.y - h / 2, w, h };
  }
  return { x: 60, y: 0, w: 1800, h: 1080 };
}

export interface MapViewProps {
  mode: 'game' | 'preview' | 'demo';
  state: GameState;
  highlight?: FactionId | null;
  onPickFaction?: (f: FactionId) => void;
  mapMode?: MapMode;
}

export function MapView({ mode, state, highlight, onPickFaction, mapMode: forcedMode }: MapViewProps) {
  const uiState = ui.use();
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(() => initialView(mode, state));
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean; id: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; view: View } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const mapMode = forcedMode ?? (mode === 'game' ? uiState.mapMode : 'politico');
  const interactive = mode === 'game';

  // Centrar el mapa cuando se pide desde un panel
  useEffect(() => {
    if (!uiState.centerOn || mode !== 'game') return;
    const p = MAP.provinces[uiState.centerOn.id];
    if (!p) return;
    setView((v) => {
      const w = Math.min(v.w, 1100);
      const h = w * (v.h / v.w);
      return { x: p.x - w / 2, y: p.y - h / 2, w, h };
    });
  }, [uiState.centerOn, mode]);

  const toSvg = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const r = pt.matrixTransform(m.inverse());
    return { x: r.x, y: r.y };
  };

  const clampView = (v: View): View => {
    const w = Math.max(420, Math.min(2400, v.w));
    const h = w * (v.h / v.w);
    const x = Math.max(-600, Math.min(MAP_WIDTH - w + 600, v.x));
    const y = Math.max(-400, Math.min(MAP_HEIGHT - h + 400, v.y));
    return { x, y, w, h };
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    const p = toSvg(e.clientX, e.clientY);
    const k = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const w = Math.max(420, Math.min(2400, v.w * k));
      const kk = w / v.w;
      return clampView({ x: p.x - (p.x - v.x) * kk, y: p.y - (p.y - v.y) * kk, w, h: v.h * kk });
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), view };
      drag.current = null;
      return;
    }
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, id: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!interactive) return;
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const base = pinch.current.view;
      const k = pinch.current.d / Math.max(10, d);
      const cx = base.x + base.w / 2;
      const cy = base.y + base.h / 2;
      const w = base.w * k;
      const h = base.h * k;
      setView(clampView({ x: cx - w / 2, y: cy - h / 2, w, h }));
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scale = Math.max(view.w / rect.width, view.h / rect.height);
    const dx = (e.clientX - d.x) * scale;
    const dy = (e.clientY - d.y) * scale;
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 5) d.moved = true;
    if (d.moved) {
      hideTip();
      setView((v) => clampView({ ...v, x: d.vx - dx, y: d.vy - dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && interactive && (e.target as Element).getAttribute?.('data-bg')) {
      ui.set({ selectedProvince: null, selectedUnits: [], moveMode: false });
    }
  };

  // ------------------------------------------------------------------ Datos derivados
  const vis = useMemo(() => (mode === 'game' && store.settings.fog ? visibleProvinces(state) : null), [state, state.hour, mode]);
  const supplied = useMemo(() => (mapMode === 'suministro' && state.player ? suppliedProvinces(state, state.player) : undefined), [mapMode, state, state.hour]);
  const openEdges = MAP.edges.filter((e) => !e.latent || state.openEdges.includes(e.id));
  const selectedSet = new Set(uiState.selectedUnits);

  const colorOf = (pid: string) => provinceColor(state, pid, mapMode, supplied);

  const clickProvince = (pid: string, e: React.MouseEvent) => {
    if (drag.current?.moved) return;
    if (mode === 'preview' && onPickFaction) {
      const owner = state.stations[pid]?.owner ?? state.provinces[pid].controller;
      if (owner) onPickFaction(owner);
      return;
    }
    if (!interactive) return;
    e.stopPropagation();
    const s = ui.get();
    if (s.moveMode && s.selectedUnits.length) {
      issueMove(pid);
      return;
    }
    ui.set({ selectedProvince: pid, selectedUnits: e.shiftKey ? s.selectedUnits : [] });
  };

  const issueMove = (pid: string) => {
    const s = ui.get();
    const ids = s.selectedUnits.filter((id) => state.units[id]?.owner === state.player);
    if (!ids.length) return;
    const n = store.act((st) => orderMove(st, ids, pid)) ?? 0;
    ui.set({ moveMode: false });
    if (n === 0) showTip(<div className="bad">No hay ruta posible hasta {provinceName(pid)}.</div>, window.innerWidth / 2, 120);
  };

  const contextProvince = (pid: string, e: React.MouseEvent) => {
    if (!interactive) return;
    e.preventDefault();
    e.stopPropagation();
    if (ui.get().selectedUnits.length) issueMove(pid);
  };

  const hoverTip = (pid: string) => (): ReactNode => {
    const def = MAP.provinces[pid];
    const p = state.provinces[pid];
    const st = state.stations[pid];
    const tInfo = TERRAIN_INFO[def.terrain];
    return (
      <div>
        <h4>{def.name}</h4>
        {st ? (
          <div className="tt-row">
            <span>Dueño</span>
            <span>{st.owner ? FACTIONS[st.owner].name : 'Abandonada'}</span>
          </div>
        ) : (
          <div className="tt-desc">{tInfo.name}</div>
        )}
        {p.controller !== (st?.owner ?? p.controller) && (
          <div className="tt-row bad">
            <span>Ocupada por</span>
            <span>{p.controller ? FACTIONS[p.controller].name : 'nadie'}</span>
          </div>
        )}
        {!st && (
          <div className="tt-row">
            <span>Control</span>
            <span>{p.controller ? FACTIONS[p.controller].name : 'Tierra de nadie'}</span>
          </div>
        )}
        {st && (
          <div className="tt-row">
            <span>Población</span>
            <span className="num">{fmt(st.population)}</span>
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
        {p.floodedUntil && p.floodedUntil > state.hour && <div className="bad">Inundado</div>}
        {def.underRiver && <div className="dim">Pasa bajo el río</div>}
        <div className="tt-sep" />
        <div className="dim">{tInfo.desc}</div>
        <div className="dim">Ancho de combate: {tInfo.width}</div>
        {interactive && <div className="faint" style={{ marginTop: 4 }}>Clic: detalles · Clic derecho: mover unidades aquí</div>}
      </div>
    );
  };

  const enter = (pid: string) => (e: React.MouseEvent) => {
    setHover(pid);
    showHoverTip(hoverTip(pid), e.clientX, e.clientY);
  };
  const move = (pid: string) => (e: React.MouseEvent) => showHoverTip(hoverTip(pid), e.clientX, e.clientY);
  const leave = () => {
    setHover(null);
    hideTip();
  };

  // ------------------------------------------------------------------ Unidades por provincia
  const unitsByProvince = new Map<string, Unit[]>();
  for (const u of Object.values(state.units)) {
    if (vis && !vis.has(u.province) && u.owner !== state.player) continue;
    if (!unitsByProvince.has(u.province)) unitsByProvince.set(u.province, []);
    unitsByProvince.get(u.province)!.push(u);
  }

  const selectUnitsAt = (pid: string, owner: FactionId, e: React.MouseEvent) => {
    e.stopPropagation();
    if (drag.current?.moved) return;
    if (!interactive) return;
    const s = ui.get();
    if (s.moveMode && s.selectedUnits.length) {
      issueMove(pid);
      return;
    }
    const ids = (unitsByProvince.get(pid) ?? []).filter((u) => u.owner === owner).map((u) => u.id);
    if (owner !== state.player) {
      ui.set({ selectedProvince: pid, selectedUnits: [] });
      return;
    }
    const next = e.shiftKey ? [...new Set([...s.selectedUnits, ...ids])] : ids;
    ui.set({ selectedUnits: next, selectedProvince: null });
  };

  const highlightSet = useMemo(() => {
    if (!highlight) return null;
    return new Set(Object.keys(state.provinces).filter((p) => state.provinces[p].controller === highlight));
  }, [highlight, state]);

  const dimOf = (pid: string) => (highlightSet && !highlightSet.has(pid) ? 0.35 : 1);

  // Rutas planificadas de las unidades seleccionadas o propias
  const paths: { id: string; d: string; color: string }[] = [];
  if (interactive) {
    for (const u of Object.values(state.units)) {
      if (u.owner !== state.player || u.path.length === 0) continue;
      if (!selectedSet.has(u.id) && selectedSet.size > 0) continue;
      const pts: [number, number][] = [[MAP.provinces[u.province].x, MAP.provinces[u.province].y]];
      for (const pid of u.path) pts.push([MAP.provinces[pid].x, MAP.provinces[pid].y]);
      paths.push({ id: u.id, d: polyPath(pts), color: selectedSet.has(u.id) ? '#ffd27a' : '#e9a53c' });
    }
  }

  const k = view.w / 1800;

  return (
    <svg
      ref={svgRef}
      className={`map-svg ${interactive ? 'interactive' : ''} ${mode === 'demo' ? 'demo' : ''} ${uiState.moveMode && interactive ? 'move-mode' : ''}`}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      role="img"
      aria-label="Mapa del metro de Vlianska"
    >
      <Background />
      <rect data-bg="1" x={-2000} y={-2000} width={MAP_WIDTH + 4000} height={MAP_HEIGHT + 4000} fill="transparent" />

      {/* Luz de las estaciones */}
      {STATION_SEEDS.map((s) => (
        <circle key={`l${s.id}`} cx={s.x} cy={s.y} r={90} fill="url(#lamp)" opacity={state.stations[s.id].owner ? 1 : 0.2} />
      ))}

      {/* Túneles */}
      <g>
        {openEdges.map((e) => {
          const w = edgeWidth(e.terrain);
          const collapsed = state.provinces[e.a].collapsed || state.provinces[e.b].collapsed;
          const [h1, h2] = splitHalf(e.points);
          const aux = e.terrain === 'auxiliar' || e.terrain === 'auxiliarPeligroso' || e.terrain === 'estrecho';
          const casing = aux ? '#2d2215' : '#050606';
          const op = Math.min(dimOf(e.a), dimOf(e.b));
          return (
            <g key={e.id} opacity={op}>
              <path d={polyPath(e.points)} stroke={casing} strokeWidth={w + 6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              {collapsed ? (
                <path d={polyPath(e.points)} stroke="#4a443a" strokeWidth={w} fill="none" strokeDasharray="6 7" strokeLinecap="butt" />
              ) : (
                <>
                  <path d={polyPath(h1)} stroke={colorOf(e.a)} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={aux ? 0.8 : 0.95} />
                  <path d={polyPath(h2)} stroke={colorOf(e.b)} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={aux ? 0.8 : 0.95} />
                  {aux && <path d={polyPath(e.points)} stroke="#b0843f" strokeOpacity={0.55} strokeWidth={1.5} fill="none" strokeDasharray="3 5" />}
                  {e.line && <path d={polyPath(e.points)} stroke="#fff" strokeOpacity={0.12} strokeWidth={2} fill="none" />}
                  {(e.terrain === 'peligroso' || e.terrain === 'auxiliarPeligroso') && (
                    <path d={polyPath(e.points)} stroke="#0a0a08" strokeWidth={Math.max(2, w * 0.28)} fill="none" strokeLinecap="round" opacity={0.85} />
                  )}
                </>
              )}
            </g>
          );
        })}
      </g>

      {/* Rutas planificadas */}
      {paths.map((p) => (
        <path key={`p${p.id}`} d={p.d} stroke={p.color} strokeWidth={3} fill="none" strokeDasharray="10 7" className="march" />
      ))}

      {/* Tramos y cruces */}
      {MAP.provinceList
        .filter((p) => p.kind !== 'estacion')
        .map((p) => {
          const ps = state.provinces[p.id];
          const selected = uiState.selectedProvince === p.id;
          const r = p.kind === 'cruce' ? 8 : 6.5;
          const flooded = ps.floodedUntil && ps.floodedUntil > state.hour;
          const collapsed = ps.collapsed;
          return (
            <g
              key={p.id}
              className="prov"
              opacity={dimOf(p.id)}
              onClick={(e) => clickProvince(p.id, e)}
              onContextMenu={(e) => contextProvince(p.id, e)}
              onMouseEnter={enter(p.id)}
              onMouseMove={move(p.id)}
              onMouseLeave={leave}
            >
              <circle cx={p.x} cy={p.y} r={r + 10} fill="transparent" />
              {collapsed ? (
                <g stroke="#b9a98a" strokeWidth={3} strokeLinecap="round">
                  <circle cx={p.x} cy={p.y} r={11} fill="#1d1a15" stroke="#6d6250" strokeWidth={2} />
                  <path d={`M${p.x - 6} ${p.y - 6} L${p.x - 1} ${p.y} L${p.x - 5} ${p.y + 6} M${p.x + 6} ${p.y - 6} L${p.x + 1} ${p.y} L${p.x + 5} ${p.y + 6}`} fill="none" />
                </g>
              ) : (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={colorOf(p.id)}
                  stroke={selected ? '#ffd27a' : hover === p.id ? '#e4dccb' : '#070807'}
                  strokeWidth={selected || hover === p.id ? 3 : 2.5}
                />
              )}
              {flooded && (
                <path d={`M${p.x - 9} ${p.y + 12} q3 -4 6 0 t6 0 t6 0`} stroke="#6fb7e0" strokeWidth={2.5} fill="none" />
              )}
              {!collapsed && ps.fort > 0 && (
                <g>
                  {Array.from({ length: ps.fort }).map((_, i) => (
                    <rect key={i} x={p.x - 9 + i * 4} y={p.y - r - 7} width={3} height={4} fill="#c9b27a" />
                  ))}
                </g>
              )}
              {!collapsed && ps.danger >= 45 && mapMode !== 'peligro' && (
                <g transform={`translate(${p.x + 7} ${p.y + 5})`}>
                  <circle r={5.5} fill="#2a0e09" stroke="#e0614a" strokeWidth={1.4} />
                  <circle cx={-1.6} cy={-0.8} r={1.1} fill="#e0614a" />
                  <circle cx={1.6} cy={-0.8} r={1.1} fill="#e0614a" />
                  <path d="M-2 2.2 H2" stroke="#e0614a" strokeWidth={1} />
                </g>
              )}
            </g>
          );
        })}

      {/* Estaciones */}
      {STATION_SEEDS.map((s) => {
        const st = state.stations[s.id];
        const ctrl = state.provinces[s.id].controller;
        const occupied = ctrl !== st.owner;
        const selected = uiState.selectedProvince === s.id;
        const isCapital = st.owner && state.countries[st.owner].capital === s.id;
        const [lx, ly, anchor] = LABEL_OFFSETS[s.label];
        const ringColor = selected ? '#ffd27a' : occupied ? factionOrNeutral(ctrl) : hover === s.id ? '#e4dccb' : '#070807';
        const political = mapMode === 'politico' || mode !== 'game';
        return (
          <g
            key={s.id}
            className="prov station"
            opacity={dimOf(s.id)}
            onClick={(e) => clickProvince(s.id, e)}
            onContextMenu={(e) => contextProvince(s.id, e)}
            onMouseEnter={enter(s.id)}
            onMouseMove={move(s.id)}
            onMouseLeave={leave}
          >
            {!political && <circle cx={s.x} cy={s.y} r={27} fill={colorOf(s.id)} stroke="#050505" strokeWidth={3} />}
            {occupied && <circle cx={s.x} cy={s.y} r={30} fill="none" stroke={factionOrNeutral(ctrl)} strokeWidth={5} strokeDasharray="6 4" />}
            <MapEmblem faction={st.owner} x={s.x} y={s.y} r={political ? 22 : 16} ring={ringColor} />
            {isCapital && (
              <path
                d={`M${s.x} ${s.y - 38} l3.5 7 7.5 1 -5.5 5.2 1.4 7.5 -6.9 -3.7 -6.9 3.7 1.4 -7.5 -5.5 -5.2 7.5 -1 z`}
                fill="#ffd27a"
                stroke="#3a2a0a"
                strokeWidth={1.5}
              />
            )}
            <text x={s.x + lx} y={s.y + ly} textAnchor={anchor} className="map-label" style={{ fontSize: Math.max(15, 17 * Math.min(1.25, k)) }}>
              {STATIONS[s.id].shortName}
            </text>
          </g>
        );
      })}

      {/* Batallas */}
      {Object.values(state.battles).map((b) => {
        const p = MAP.provinces[b.province];
        if (vis && !vis.has(b.province)) return null;
        const adv = b.lastAdvantage;
        return (
          <g key={b.id} transform={`translate(${p.x} ${p.y - (p.kind === 'estacion' ? 50 : 26)})`} className="battle-icon" onClick={(e) => clickProvince(b.province, e)}>
            <rect x={-22} y={-14} width={44} height={24} rx={3} fill="#1b0f0c" stroke="#e0614a" strokeWidth={2} />
            <path d="M-11 -8 L3 6 M-3 6 L11 -8 M-12 3 L-6 3 M6 3 L12 3" stroke="#ffd2c6" strokeWidth={2.4} strokeLinecap="round" />
            <rect x={-20} y={11} width={40} height={4} fill="#3a1a14" />
            <rect x={-20} y={11} width={40 * adv} height={4} fill={factionOrNeutral(b.attackerSide)} />
          </g>
        );
      })}

      {/* Unidades */}
      {[...unitsByProvince.entries()].map(([pid, units]) => {
        const p = MAP.provinces[pid];
        const owners = [...new Set(units.map((u) => u.owner))];
        const baseX = p.kind === 'estacion' ? p.x + 24 : p.x - 17;
        const baseY = p.kind === 'estacion' ? p.y + 8 : p.y - 36;
        return owners.map((owner, i) => {
          const list = units.filter((u) => u.owner === owner);
          const sel = list.some((u) => selectedSet.has(u.id));
          const strength = list.reduce((s, u) => s + u.strength, 0) / list.length;
          const org = list.reduce((s, u) => s + u.org / Math.max(1, unitStats(state, u).org), 0) / list.length;
          const moving = list.some((u) => u.path.length > 0);
          const inBattle = list.some((u) => u.battle);
          const x = baseX + i * 36;
          const y = baseY;
          const color = FACTIONS[owner].color;
          const hostile = state.player && isAtWarWith(state, state.player, owner);
          const ally = state.player && owner !== state.player && friendly(state, state.player, owner);
          return (
            <g
              key={`${pid}-${owner}`}
              className="unit-counter"
              transform={`translate(${x} ${y})`}
              onClick={(e) => selectUnitsAt(pid, owner, e)}
              onContextMenu={(e) => contextProvince(pid, e)}
              onMouseEnter={(e) =>
                showHoverTip(
                  () => (
                    <div>
                      <h4>{FACTIONS[owner].name}</h4>
                      {list.map((u) => (
                        <div key={u.id} style={{ marginBottom: 4 }}>
                          <div>{u.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <Bar value={u.org / Math.max(1, unitStats(state, u).org)} color="green" thin />
                            <Bar value={u.strength} thin />
                          </div>
                        </div>
                      ))}
                      {owner === state.player && <div className="faint">Clic: seleccionar · Mayús+clic: añadir</div>}
                    </div>
                  ),
                  e.clientX,
                  e.clientY,
                )
              }
              onMouseLeave={leave}
            >
              <rect x={-1} y={-1} width={34} height={27} rx={3} fill={sel ? '#ffd27a' : hostile ? '#e0614a' : ally ? '#8cc063' : '#050505'} />
              <rect x={1} y={1} width={30} height={16} rx={2} fill={color} />
              <rect x={4} y={4} width={12} height={10} fill="none" stroke="#fff" strokeWidth={1.4} />
              <path d="M4 4 L16 14 M16 4 L4 14" stroke="#fff" strokeWidth={1.2} />
              <text x={24} y={13.5} textAnchor="middle" className="unit-count">
                {list.length}
              </text>
              <rect x={1} y={18} width={30} height={3} fill="#0a0a0a" />
              <rect x={1} y={18} width={30 * Math.max(0, Math.min(1, org))} height={3} fill="#8cc063" />
              <rect x={1} y={21.5} width={30} height={3} fill="#0a0a0a" />
              <rect x={1} y={21.5} width={30 * Math.max(0, Math.min(1, strength))} height={3} fill="#e9a53c" />
              {moving && !inBattle && <path d="M34 8 l6 4 -6 4 z" fill="#ffd27a" />}
            </g>
          );
        });
      })}

      <rect x={-2000} y={-2000} width={MAP_WIDTH + 4000} height={MAP_HEIGHT + 4000} fill="url(#vignette)" pointerEvents="none" opacity={0.7} />
    </svg>
  );
}

export function focusProvince(id: string) {
  centerMapOn(id);
  ui.set({ selectedProvince: id });
}
