// Pantalla principal de juego.
import { useEffect, useRef, useState } from 'react';
import { FACTIONS } from '../../data';
import type { LogEntry } from '../../game/types';
import { formatShortDate } from '../../game/time';
import { MapView } from '../map/MapView';
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

const MAP_MODES: { id: MapMode; label: string; icon: string }[] = [
  { id: 'politico', label: 'Político', icon: 'Flag' },
  { id: 'diplomatico', label: 'Diplomático', icon: 'Handshake' },
  { id: 'terreno', label: 'Túneles', icon: 'Route' },
  { id: 'peligro', label: 'Peligro mutante', icon: 'Skull' },
  { id: 'suministro', label: 'Suministro', icon: 'Package' },
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
        </div>
      )}
    </div>
  );
}

interface Toast {
  id: number;
  entry: LogEntry;
}

function Toasts() {
  const state = useGame();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef(state.log.length);
  const counter = useRef(0);
  const f = state.player!;
  const name = FACTIONS[f].name;
  useEffect(() => {
    if (state.log.length < seen.current) seen.current = 0;
    const fresh = state.log.slice(seen.current);
    seen.current = state.log.length;
    const relevant = fresh.filter((l) => l.faction === f || l.text.includes(name) || l.kind === 'evento').slice(-3);
    if (relevant.length === 0) return;
    const add = relevant.map((entry) => ({ id: ++counter.current, entry }));
    setToasts((t) => [...t, ...add].slice(-4));
    const ids = add.map((a) => a.id);
    const timer = window.setTimeout(() => setToasts((t) => t.filter((x) => !ids.includes(x.id))), 6000);
    return () => window.clearTimeout(timer);
  }, [state.log.length, f, name, state.log]);
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast ${t.entry.kind}`} onClick={() => t.entry.province && centerMapOn(t.entry.province)}>
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
      <Toasts />
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
