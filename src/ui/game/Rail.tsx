// Barra lateral de paneles y avisos al estilo HoI4.
import type { ReactNode } from 'react';
import { FACTIONS, FOCUS_BY_ID, TECH_BY_ID } from '../../data';
import { availableFocuses, focusDaysLeft } from '../../game/focus';
import { researchCost } from '../../game/research';
import { isAtWar } from '../../game/helpers';
import { Icon, Tip, Bar } from '../components/core';
import { Medal } from '../components/art';
import { blendCategory } from '../../gfx/medallions';
import { ui, useGame, type PanelId } from '../store';

const ITEMS: { id: PanelId | 'focus' | 'tech'; icon: string; label: string; key: string }[] = [
  { id: 'politica', icon: 'Landmark', label: 'Gobierno', key: 'G' },
  { id: 'focus', icon: 'Target', label: 'Enfoque nacional', key: 'F' },
  { id: 'tech', icon: 'Microscope', label: 'Investigación', key: 'I' },
  { id: 'diplomacia', icon: 'Handshake', label: 'Diplomacia', key: 'D' },
  { id: 'comercio', icon: 'Coins', label: 'Comercio y recursos', key: 'C' },
  { id: 'construccion', icon: 'Hammer', label: 'Construcción', key: 'B' },
  { id: 'produccion', icon: 'Factory', label: 'Producción', key: 'P' },
  { id: 'ejercito', icon: 'Swords', label: 'Ejército', key: 'E' },
  { id: 'decisiones', icon: 'ScrollText', label: 'Decisiones', key: 'X' },
  { id: 'registro', icon: 'Newspaper', label: 'Registro y noticias', key: 'L' },
];

export function openItem(id: PanelId | 'focus' | 'tech') {
  const s = ui.get();
  if (id === 'focus' || id === 'tech') {
    ui.set({ overlay: s.overlay === id ? null : id });
    return;
  }
  ui.set({ panel: s.panel === id ? null : id, overlay: null });
}

export function Rail() {
  const s = ui.use();
  const state = useGame();
  const c = state.countries[state.player!];
  return (
    <nav className="rail" aria-label="Paneles">
      {ITEMS.map((it) => {
        const active = it.id === 'focus' || it.id === 'tech' ? s.overlay === it.id : s.panel === it.id;
        let badge: ReactNode = null;
        if (it.id === 'focus' && c.focus.current) {
          const f = FOCUS_BY_ID[c.focus.current];
          badge = <Bar value={c.focus.progress / (f.cost ?? 35)} thin />;
        }
        if (it.id === 'tech') {
          const busy = c.research.active.filter(Boolean).length;
          badge = <span className="rail-count">{busy}/{c.research.slots}</span>;
        }
        return (
          <Tip key={it.id} content={<div><h4>{it.label}</h4><div className="faint">Tecla <span className="kbd">{it.key}</span></div></div>} as="div">
            <button className={`rail-btn ${active ? 'active' : ''}`} onClick={() => openItem(it.id)} aria-label={it.label} aria-pressed={active}>
              <Icon name={it.icon} size={24} />
              {badge && <span className="rail-badge">{badge}</span>}
            </button>
          </Tip>
        );
      })}
    </nav>
  );
}

interface Alert {
  id: string;
  icon: string;
  tone: 'warn' | 'bad' | 'good';
  title: string;
  text: string;
  onClick: () => void;
}

export function Alerts() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const d = c.derived;
  const alerts: Alert[] = [];
  if (!c.focus.current && availableFocuses(state, f).length) {
    alerts.push({ id: 'focus', icon: 'Target', tone: 'warn', title: 'Sin enfoque nacional', text: 'Elige un enfoque para seguir avanzando.', onClick: () => ui.set({ overlay: 'focus' }) });
  }
  const free = c.research.active.filter((a, i) => !a && i < c.research.slots).length;
  if (free > 0) alerts.push({ id: 'tech', icon: 'Microscope', tone: 'warn', title: 'Investigación libre', text: `${free} espacio(s) de investigación sin usar.`, onClick: () => ui.set({ overlay: 'tech' }) });
  if (d.milAssigned < Math.floor(d.milTotal)) {
    alerts.push({ id: 'mil', icon: 'Factory', tone: 'warn', title: 'Talleres militares sin asignar', text: `${Math.floor(d.milTotal) - d.milAssigned} taller(es) sin línea de producción.`, onClick: () => ui.set({ panel: 'produccion', overlay: null }) });
  }
  if (c.construction.length === 0 && d.civAvailable >= 1) {
    alerts.push({ id: 'civ', icon: 'Hammer', tone: 'warn', title: 'Construcción parada', text: 'Tus talleres civiles no están construyendo nada.', onClick: () => ui.set({ panel: 'construccion', overlay: null }) });
  }
  const foodBal = d.foodProd - d.foodCons + d.foodTrade;
  if (foodBal < 0) {
    const daysLeftFood = c.food / -foodBal;
    alerts.push({
      id: 'food',
      icon: 'Wheat',
      tone: daysLeftFood < 30 ? 'bad' : 'warn',
      title: d.famine > 0 ? '¡Hambruna!' : 'Déficit de comida',
      text: d.famine > 0 ? 'La población muere de hambre y la estabilidad cae.' : `Las reservas durarán unos ${Math.round(daysLeftFood)} días.`,
      onClick: () => ui.set({ panel: 'comercio', overlay: null }),
    });
  }
  const units = Object.values(state.units).filter((u) => u.owner === f);
  const oos = units.filter((u) => u.outOfSupply).length;
  if (oos) alerts.push({ id: 'supply', icon: 'Unplug', tone: 'bad', title: 'Unidades sin suministro', text: `${oos} unidad(es) sin suministro pierden fuerza cada día.`, onClick: () => ui.set({ panel: 'ejercito', overlay: null }) });
  const lowEq = units.filter((u) => u.strength < 0.6).length;
  if (lowEq && d.equipmentNeed.armas > c.stockpile.armas) alerts.push({ id: 'eq', icon: 'Package', tone: 'warn', title: 'Falta de equipo', text: 'Tus unidades no pueden reforzarse: produce más armas.', onClick: () => ui.set({ panel: 'produccion', overlay: null }) });
  if (c.wargoals.some((w) => w.ready) && !isAtWar(state, f)) {
    alerts.push({ id: 'wg', icon: 'Crosshair', tone: 'good', title: 'Objetivo de guerra listo', text: 'Puedes declarar la guerra desde Diplomacia.', onClick: () => ui.set({ panel: 'diplomacia', overlay: null }) });
  }
  if (d.stability < 0.3) alerts.push({ id: 'stab', icon: 'TriangleAlert', tone: 'bad', title: 'Estabilidad baja', text: 'Riesgo de revueltas y menor producción.', onClick: () => ui.set({ panel: 'politica', overlay: null }) });
  if (state.playerEvents.length) alerts.push({ id: 'ev', icon: 'Mail', tone: 'good', title: 'Eventos pendientes', text: `${state.playerEvents.length} evento(s) esperan tu decisión.`, onClick: () => {} });
  if (alerts.length === 0) return null;
  return (
    <div className="alerts" aria-label="Avisos">
      {alerts.map((a) => (
        <Tip key={a.id} content={<div><h4>{a.title}</h4><div>{a.text}</div></div>}>
          <button className={`alert ${a.tone}`} onClick={a.onClick} aria-label={a.title}>
            <Icon name={a.icon} size={17} />
          </button>
        </Tip>
      ))}
    </div>
  );
}

export function FocusTicker() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const cur = c.focus.current ? FOCUS_BY_ID[c.focus.current] : null;
  const active = c.research.active.filter(Boolean) as { tech: string; progress: number }[];
  return (
    <div className="ticker">
      <button className="ticker-item" onClick={() => ui.set({ overlay: 'focus' })}>
        {cur ? <Medal icon={cur.icon} shape="shield" color={blendCategory(cur.icon, FACTIONS[f].color)} size={34} /> : <Icon name="Target" size={18} className="faint" />}
        <div className="ticker-text">
          <span className="label">Enfoque</span>
          <span>{cur ? cur.name : 'Ninguno'}</span>
          {cur && <Bar value={c.focus.progress / (cur.cost ?? 35)} thin />}
        </div>
        {cur && <span className="num dim">{Math.ceil(focusDaysLeft(state, f))} d</span>}
      </button>
      {active.slice(0, 3).map((a) => (
        <button key={a.tech} className="ticker-item small" onClick={() => ui.set({ overlay: 'tech' })}>
          <Icon name={TECH_BY_ID[a.tech].icon} size={16} className="amber" />
          <div className="ticker-text">
            <span>{TECH_BY_ID[a.tech].name}</span>
            <Bar value={a.progress / researchCost(state, TECH_BY_ID[a.tech])} thin color="blue" />
          </div>
        </button>
      ))}
    </div>
  );
}
