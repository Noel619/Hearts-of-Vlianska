// Pantalla principal de juego.
import { useEffect, useRef, useState } from 'react';
import { FACTIONS } from '../../data';
import type { LogEntry } from '../../game/types';
import { formatShortDate } from '../../game/time';
import { MapView, mapActivity } from '../map/MapView';
import { TERRAIN_COLOR } from '../map/mapUtil';
import { Icon, Tip, TooltipLayer, hideTip } from '../components/core';
import { store, ui, useGame, type MapMode, centerMapOn } from '../store';
import { TopBar } from './TopBar';
import { Alerts, FocusTicker, Rail, openItem } from './Rail';
import { SelectionPanel } from './SelectionPanel';
import { EndModal, EventModal, GameMenu, PeaceModal } from './Modals';
import { PoliticsPanel } from '../panels/PoliticsPanel';
import { DiplomacyPanel } from '../panels/DiplomacyPanel';
import { ConstructionPanel, ProductionPanel, TradePanel } from '../panels/EconomyPanels';
import { ArmyPanel, TemplateDesigner } from '../panels/ArmyPanel';
import { DecisionsPanel, LogPanel } from '../panels/MiscPanels';
import { FocusTreeView } from '../trees/FocusTree';
import { TechTreeView } from '../trees/TechTree';
import { HelpModal } from '../screens/Help';
import { RESOURCES } from '../components/Resources';
import { RESOURCE_IDS } from '../../game/types';

const MAP_MODES: { id: MapMode; label: string; icon: string }[] = [
  { id: 'politico', label: 'Político', icon: 'Flag' },
  { id: 'diplomatico', label: 'Diplomático', icon: 'Handshake' },
  { id: 'terreno', label: 'Túneles', icon: 'Route' },
  { id: 'peligro', label: 'Peligro mutante', icon: 'Skull' },
  { id: 'suministro', label: 'Suministro', icon: 'Package' },
  { id: 'recursos', label: 'Recursos', icon: 'Anvil' },
];

function MapControls() {
  const s = ui.use();
  const [legend, setLegend] = useState(false);
  return (
    <div className="map-controls">
      <div className="mapmodes" role="radiogroup" aria-label="Modo de mapa">
        {MAP_MODES.map((m) => (
          <Tip key={m.id} content={m.label}>
            <button className={`mapmode ${s.mapMode === m.id ? 'active' : ''}`} onClick={() => ui.set({ mapMode: m.id })} role="radio" aria-checked={s.mapMode === m.id} aria-label={m.label}>
              <Icon name={m.icon} size={17} />
            </button>
          </Tip>
        ))}
        <Tip content="Leyenda">
          <button className={`mapmode ${legend ? 'active' : ''}`} onClick={() => setLegend(!legend)} aria-label="Leyenda">
            <Icon name="Info" size={17} />
          </button>
        </Tip>
      </div>
      {legend && (
        <div className="legend">
          <div className="legend-row"><i style={{ background: TERRAIN_COLOR.linea, height: 7 }} /> Línea principal</div>
          <div className="legend-row"><i style={{ background: TERRAIN_COLOR.tunel }} /> Túnel</div>
          <div className="legend-row"><i className="danger" style={{ background: TERRAIN_COLOR.peligroso }} /> Túnel peligroso</div>
          <div className="legend-row"><i style={{ background: TERRAIN_COLOR.auxiliar, height: 4 }} /> Túnel auxiliar (sin draisinas)</div>
          <div className="legend-row"><i className="collapsed" /> Derrumbe</div>
          <div className="legend-row"><span className="legend-skull">☠</span> Peligro mutante alto</div>
          <div className="legend-row"><span className="legend-fort">▮▮</span> Barricadas</div>
          <div className="legend-row"><span className="legend-star">★</span> Capital</div>
          {s.mapMode === 'recursos' &&
            RESOURCE_IDS.map((r) => (
              <div key={r} className="legend-row">
                <Icon name={RESOURCES[r].icon} size={14} style={{ color: RESOURCES[r].color }} /> {RESOURCES[r].name} al día
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/** Contador de fotogramas (Ajustes → Vídeo y rendimiento). */
function FpsMeter() {
  const [stats, setStats] = useState({ fps: 0, ms: 0 });
  useEffect(() => {
    const id = window.setInterval(() => setStats({ fps: mapActivity.fps, ms: mapActivity.renderMs }), 500);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="fps-meter num" aria-hidden>
      {Math.round(stats.fps)} FPS · {stats.ms.toFixed(1)} ms
    </div>
  );
}

interface Toast {
  id: number;
  entry: LogEntry;
}

/** ¿Merece una notificación emergente? Lo rutinario solo va al registro. */
function toastWorthy(entry: LogEntry, f: string, name: string, mode: 'importantes' | 'todas'): boolean {
  if (entry.kind === 'evento') return true;
  const mine = entry.faction === f || entry.text.includes(name);
  if (!mine) return false;
  return mode === 'todas' || !entry.quiet;
}

/** Avisos pequeños en la esquina inferior derecha (a la izquierda del panel de selección si está abierto). */
function Toasts() {
  const state = useGame();
  const s = ui.use();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(state.log.length);
  const counter = useRef(0);
  const timers = useRef(new Set<number>());
  const f = state.player!;
  const name = FACTIONS[f].name;
  const mode = store.settings.toasts;
  useEffect(() => {
    if (state.log.length < seen.current) seen.current = 0;
    const fresh = state.log.slice(seen.current);
    seen.current = state.log.length;
    if (mode === 'ninguna') return;
    const relevant = fresh.filter((l) => toastWorthy(l, f, name, mode)).slice(-3);
    if (relevant.length === 0) return;
    const add = relevant.map((entry) => ({ id: ++counter.current, entry }));
    setToasts((t) => [...t, ...add].slice(-3));
    const ids = add.map((a) => a.id);
    // Cada tanda se retira sola a los 5 s (los mensajes nuevos no alargan los anteriores).
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      setToasts((t) => t.filter((x) => !ids.includes(x.id)));
    }, 5000);
    timers.current.add(timer);
  }, [state.log.length, f, name, state.log, mode]);
  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => window.clearTimeout(t));
  }, []);
  if (!toasts.length || mode === 'ninguna') return null;
  const besideSelection = s.selectedUnits.length > 0 || !!s.selectedProvince;
  return (
    <div className={`toasts ${besideSelection ? 'beside-selection' : ''}`} aria-live="polite">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`toast ${t.entry.kind}`}
          onClick={() => {
            if (t.entry.province) centerMapOn(t.entry.province);
            setToasts((all) => all.filter((x) => x.id !== t.id));
          }}
        >
          <span className="num dim">{formatShortDate(t.entry.hour)}</span>
          <span>{t.entry.text}</span>
        </button>
      ))}
    </div>
  );
}

const PANEL_KEYS: Record<string, Parameters<typeof openItem>[0]> = {
  g: 'politica',
  f: 'focus',
  i: 'tech',
  d: 'diplomacia',
  c: 'comercio',
  b: 'construccion',
  p: 'produccion',
  e: 'ejercito',
  x: 'decisiones',
  l: 'registro',
};

export function GameScreen() {
  const state = useGame();
  const s = ui.use();

  useEffect(() => {
    store.start();
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === ' ') {
        e.preventDefault();
        store.togglePause();
        return;
      }
      if (/^[1-5]$/.test(e.key)) {
        store.setSpeed(Number(e.key));
        return;
      }
      if (e.key === '+' || e.key === '=') store.setSpeed(Math.min(5, (store.speed || store.lastSpeed) + 1));
      if (e.key === '-') store.setSpeed(Math.max(1, (store.speed || store.lastSpeed) - 1));
      if (e.key === 'Escape') {
        hideTip();
        const cur = ui.get();
        if (cur.moveMode) ui.set({ moveMode: false });
        else if (cur.overlay) ui.set({ overlay: null });
        else if (cur.panel) ui.set({ panel: null });
        else if (cur.selectedUnits.length || cur.selectedProvince) ui.set({ selectedUnits: [], selectedProvince: null });
        else ui.set({ menuOpen: true });
        return;
      }
      const k = e.key.toLowerCase();
      if (!e.ctrlKey && !e.metaKey && !e.altKey && PANEL_KEYS[k]) openItem(PANEL_KEYS[k]);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      store.stop();
    };
  }, []);

  if (!state || !state.player) return null;

  return (
    <div className={`game ${s.panel ? 'with-panel' : ''}`}>
      <TopBar />
      <div className="game-body">
        <Rail />
        <main className="map-area">
          <MapView mode="game" state={state} />
          <Alerts />
          <FocusTicker />
          <MapControls />
          {store.settings.showFps && <FpsMeter />}
          <Toasts />
          {store.speed === 0 && !s.menuOpen && <div className="paused-badge">EN PAUSA · <span className="kbd">Espacio</span></div>}
          {s.moveMode && <div className="move-hint">Elige el destino en el mapa · <span className="kbd">Esc</span> para cancelar</div>}
        </main>
        {s.panel && (
          <div className="side-panel">
            {s.panel === 'politica' && <PoliticsPanel />}
            {s.panel === 'diplomacia' && <DiplomacyPanel />}
            {s.panel === 'construccion' && <ConstructionPanel />}
            {s.panel === 'produccion' && <ProductionPanel />}
            {s.panel === 'comercio' && <TradePanel />}
            {s.panel === 'ejercito' && <ArmyPanel />}
            {s.panel === 'decisiones' && <DecisionsPanel />}
            {s.panel === 'registro' && <LogPanel />}
          </div>
        )}
        <SelectionPanel />
      </div>
      {s.overlay === 'focus' && <FocusTreeView />}
      {s.overlay === 'tech' && <TechTreeView />}
      {s.overlay === 'templates' && <TemplateDesigner />}
      <EventModal />
      <PeaceModal />
      <EndModal />
      {s.menuOpen && <GameMenu />}
      {s.helpOpen && <HelpModal onClose={() => ui.set({ helpOpen: false })} />}
      <TooltipLayer />
    </div>
  );
}
