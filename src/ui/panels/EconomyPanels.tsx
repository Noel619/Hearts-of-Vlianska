// Paneles de construcción, producción y comercio.
import { useState } from 'react';
import { BUILDINGS, EQUIPMENT, FACTIONS, MAX_CIV_PER_PROJECT, STATIONS } from '../../data';
import type { BuildingId, EquipmentId, ResourceId } from '../../game/types';
import { EQUIPMENT_IDS, FACTION_IDS, RESOURCE_IDS } from '../../game/types';
import {
  TRADE_CIV_PER_UNIT,
  addProductionLine,
  addTrade,
  buildDaysLeft,
  canBuild,
  canTrade,
  cancelBuilding,
  cancelTrade,
  equipmentCost,
  exportable,
  lineOutput,
  moveBuilding,
  queueBuilding,
  removeProductionLine,
  setLineFactories,
  slotsUsed,
  stationResourceOutput,
} from '../../game/economy';
import { equipmentLevel } from '../../game/research';
import { factionName, ownedStations, provinceName } from '../../game/helpers';
import { Emblem } from '../components/art';
import { Bar, Empty, Icon, Panel, Section, Tip, fmt, fmtSigned } from '../components/core';
import { RES_NAMES } from '../game/TopBar';
import { store, ui, useGame } from '../store';
import { focusProvince } from '../map/MapView';
import { RESOURCES, ResourceChips, resourceUsers } from '../components/Resources';

const STATION_BUILDINGS: BuildingId[] = ['civil', 'militar', 'granja', 'infraestructura', 'fortificacion'];

export function ConstructionPanel() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const [building, setBuilding] = useState<BuildingId>('civil');
  const stations = ownedStations(state, f).filter((s) => state.provinces[s].controller === f);

  return (
    <Panel title="Construcción" icon="Hammer" onClose={() => ui.set({ panel: null })}>
      <div className="stat-row">
        <div>
          <span className="label">Talleres civiles disponibles</span>
          <strong className="num">{fmt(c.derived.civAvailable, 1)}</strong>
        </div>
        <div>
          <span className="label">Máximo por obra</span>
          <strong className="num">{MAX_CIV_PER_PROJECT}</strong>
        </div>
      </div>

      <Section title="Nueva construcción">
        <div className="build-types">
          {STATION_BUILDINGS.map((b) => (
            <Tip key={b} content={<div><h4>{BUILDINGS[b].name}</h4><div className="tt-desc">{BUILDINGS[b].desc}</div><div>Coste: {BUILDINGS[b].cost}</div></div>}>
              <button className={`build-type ${building === b ? 'active' : ''}`} onClick={() => setBuilding(b)} aria-pressed={building === b}>
                <Icon name={BUILDINGS[b].icon} size={20} />
                <span>{BUILDINGS[b].name}</span>
              </button>
            </Tip>
          ))}
        </div>
        <div className="station-build-list">
          {stations.map((sid) => {
            const st = state.stations[sid];
            const can = canBuild(state, f, building, sid);
            const used = slotsUsed(state, sid, f);
            return (
              <div key={sid} className="station-build">
                <button className="link" onClick={() => focusProvince(sid)}>
                  {STATIONS[sid].shortName}
                </button>
                <span className="dim num">
                  {building === 'fortificacion'
                    ? `Barricadas ${state.provinces[sid].fort}/5`
                    : building === 'infraestructura'
                      ? `Infra. ${st.buildings.infraestructura}/5`
                      : `Espacios ${used}/${st.slots}`}
                </span>
                <Tip content={can.ok ? 'Añadir a la cola' : <span className="bad">{can.reason}</span>}>
                  <button className="btn small" disabled={!can.ok} onClick={() => store.act((s) => queueBuilding(s, f, building, sid))}>
                    <Icon name="Plus" size={14} />
                  </button>
                </Tip>
              </div>
            );
          })}
        </div>
        {building === 'fortificacion' && <div className="hint">Para fortificar un tramo de túnel, selecciónalo en el mapa.</div>}
      </Section>

      <Section title={`Cola de construcción (${c.construction.length})`}>
        {c.construction.length === 0 && <Empty>No hay nada en construcción.</Empty>}
        {c.construction.map((item, i) => {
          const days = buildDaysLeft(state, f, i);
          const cost = BUILDINGS[item.building].cost;
          return (
            <div key={item.id} className="queue-item">
              <Icon name={BUILDINGS[item.building].icon} size={20} className="amber" />
              <div className="queue-main">
                <div>
                  {BUILDINGS[item.building].name} · <button className="link" onClick={() => focusProvince(item.location)}>{provinceName(item.location)}</button>
                </div>
                <Bar value={item.progress / cost} thin />
                <span className="dim num">{days === null ? 'En espera (sin talleres libres)' : `${Math.ceil(days)} días`}</span>
              </div>
              <div className="queue-actions">
                <button className="btn icon small ghost" disabled={i === 0} onClick={() => store.act((s) => moveBuilding(s, f, item.id, -1))} aria-label="Subir">
                  <Icon name="ChevronUp" size={14} />
                </button>
                <button className="btn icon small ghost" disabled={i === c.construction.length - 1} onClick={() => store.act((s) => moveBuilding(s, f, item.id, 1))} aria-label="Bajar">
                  <Icon name="ChevronDown" size={14} />
                </button>
                <button className="btn icon small ghost" onClick={() => store.act((s) => cancelBuilding(s, f, item.id))} aria-label="Cancelar">
                  <Icon name="X" size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </Section>
    </Panel>
  );
}

export function ProductionPanel() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const d = c.derived;
  const free = Math.floor(d.milTotal) - d.milAssigned;

  return (
    <Panel title="Producción militar" icon="Factory" onClose={() => ui.set({ panel: null })}>
      <div className="stat-row">
        <div>
          <span className="label">Talleres militares</span>
          <strong className="num">{fmt(d.milTotal, 1)}</strong>
        </div>
        <div>
          <span className="label">Asignados</span>
          <strong className={`num ${free > 0 ? 'warn' : ''}`}>{d.milAssigned}</strong>
        </div>
      </div>
      <Section title="Líneas de producción">
        {c.production.length === 0 && <Empty>Sin líneas de producción.</Empty>}
        {c.production.map((l) => {
          const eq = EQUIPMENT[l.equipment];
          const lvl = equipmentLevel(state, f, l.equipment);
          const out = lineOutput(state, f, l.id);
          const missing = Object.keys(eq.resources).filter((r) => d.resourceRatio[r as ResourceId] < 0.999);
          return (
            <div key={l.id} className="prod-line">
              <Tip content={<div><h4>{eq.name}</h4><div className="tt-desc">{eq.desc}</div><div>Modelo actual: {eq.levels[lvl - 1]}</div><div>Coste por unidad: {fmt(equipmentCost(state, f, l.equipment), 2)}</div><div>Recursos por taller: {Object.entries(eq.resources).map(([r, v]) => `${v} ${RES_NAMES[r].name.toLowerCase()}`).join(', ')}</div></div>}>
                <div className="prod-eq">
                  <Icon name={equipmentIcon(l.equipment)} size={22} className="amber" />
                  <div>
                    <strong>{eq.name}</strong>
                    <div className="dim">{eq.levels[lvl - 1]}</div>
                  </div>
                </div>
              </Tip>
              <div className="prod-controls">
                <button className="btn icon small" onClick={() => store.act((s) => setLineFactories(s, f, l.id, l.factories - 1))} aria-label="Quitar taller">
                  <Icon name="Minus" size={14} />
                </button>
                <span className="num prod-count">{l.factories}</span>
                <button className="btn icon small" disabled={free <= 0} onClick={() => store.act((s) => setLineFactories(s, f, l.id, l.factories + 1))} aria-label="Añadir taller">
                  <Icon name="Plus" size={14} />
                </button>
              </div>
              <div className="prod-stats">
                <Tip content={<div>Eficiencia de producción. Crece con el tiempo hasta el tope.</div>}>
                  <div>
                    <span className="label">Eficiencia</span>
                    <Bar value={l.efficiency} thin color="green" />
                  </div>
                </Tip>
                <span className="num">{fmt(out, 2)}/día</span>
                {missing.length > 0 && <span className="bad">Falta {missing.map((r) => RES_NAMES[r].name.toLowerCase()).join(', ')}</span>}
              </div>
              <button className="btn icon small ghost" onClick={() => store.act((s) => removeProductionLine(s, f, l.id))} aria-label="Eliminar línea">
                <Icon name="Trash2" size={14} />
              </button>
            </div>
          );
        })}
        <div className="add-line">
          {EQUIPMENT_IDS.map((eq) => (
            <button key={eq} className="btn small ghost" onClick={() => store.act((s) => addProductionLine(s, f, eq, Math.min(1, Math.max(0, free))))}>
              <Icon name="Plus" size={13} /> {EQUIPMENT[eq].name}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Almacén">
        <table className="table">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Reservas</th>
              <th>Necesario</th>
            </tr>
          </thead>
          <tbody>
            {EQUIPMENT_IDS.map((eq) => (
              <tr key={eq}>
                <td>{EQUIPMENT[eq].name}</td>
                <td className="num">{fmt(c.stockpile[eq])}</td>
                <td className={`num ${d.equipmentNeed[eq] > c.stockpile[eq] ? 'bad' : 'dim'}`}>{fmt(d.equipmentNeed[eq])}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hint">«Necesario» es lo que falta para completar las unidades y el reclutamiento en curso.</div>
      </Section>
    </Panel>
  );
}

export function equipmentIcon(eq: EquipmentId) {
  return { armas: 'Crosshair', apoyo: 'Wrench', morteros: 'Bomb', lanzallamas: 'Flame', draisinas: 'TrainFront' }[eq];
}

export function TradePanel() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const d = c.derived;
  const [res, setRes] = useState<ResourceId | 'alimentos'>('chatarra');
  const partners = FACTION_IDS.filter((p) => p !== f && state.countries[p].alive);
  const foodBal = d.foodProd - d.foodCons + d.foodTrade;

  return (
    <Panel title="Comercio y recursos" icon="Coins" onClose={() => ui.set({ panel: null })}>
      <Section title="Recursos">
        <table className="table">
          <thead>
            <tr>
              <th>Recurso</th>
              <th>Producción</th>
              <th>Comercio</th>
              <th>Uso</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCE_IDS.map((r) => {
              const x = d.resources[r];
              return (
                <tr key={r}>
                  <td>
                    <Tip
                      content={() => (
                        <div>
                          <h4>{RESOURCES[r].name}</h4>
                          <div className="tt-desc">{RESOURCES[r].desc}</div>
                          <div className="tt-sub">Lo producen</div>
                          {ownedStations(state, f).filter((sid) => state.stations[sid].resources[r] > 0).length === 0 && <div className="dim">Ninguna de tus estaciones.</div>}
                          {Object.keys(state.stations)
                            .filter((sid) => stationResourceOutput(state, sid, f, r) > 0)
                            .map((sid) => (
                              <div key={sid} className="tt-row">
                                <span>{STATIONS[sid].shortName}</span>
                                <span className="num">{fmt(stationResourceOutput(state, sid, f, r), 1)}</span>
                              </div>
                            ))}
                          <div className="tt-sub">Lo consumen (por taller)</div>
                          <div>{resourceUsers(r)}</div>
                        </div>
                      )}
                    >
                      <span>
                        <Icon name={RES_NAMES[r].icon} size={14} style={{ color: RESOURCES[r].color }} /> {RES_NAMES[r].name}
                      </span>
                    </Tip>
                  </td>
                  <td className="num">{fmt(x.produced, 1)}</td>
                  <td className="num">{fmtSigned(x.imported - x.exported, 1)}</td>
                  <td className={`num ${x.used > x.available ? 'bad' : ''}`}>{fmt(x.used, 1)}</td>
                </tr>
              );
            })}
            <tr>
              <td>
                <Icon name="Wheat" size={14} /> Alimentos
              </td>
              <td className="num">{fmt(d.foodProd, 1)}</td>
              <td className="num">{fmtSigned(d.foodTrade, 1)}</td>
              <td className={`num ${foodBal < 0 ? 'bad' : ''}`}>{fmt(d.foodCons, 1)}</td>
            </tr>
          </tbody>
        </table>
      </Section>
      <Section title="Importaciones">
        {c.trades.length === 0 && <Empty>No importas nada.</Empty>}
        {c.trades.map((t) => (
          <div key={t.id} className="trade-item">
            <Emblem faction={t.partner} size={24} />
            <span>
              {fmt(t.amount, 1)} de {RES_NAMES[t.resource].name.toLowerCase()}/día desde {factionName(t.partner)}
            </span>
            <span className="dim num">−{fmt(t.amount * TRADE_CIV_PER_UNIT, 1)} talleres</span>
            <button className="btn icon small ghost" onClick={() => store.act((s) => cancelTrade(s, f, t.id))} aria-label="Cancelar">
              <Icon name="X" size={14} />
            </button>
          </div>
        ))}
      </Section>
      <Section title="Comprar recursos">
        <div className="res-tabs">
          {([...RESOURCE_IDS, 'alimentos'] as const).map((r) => (
            <button key={r} className={`btn small ${res === r ? 'primary' : 'ghost'}`} onClick={() => setRes(r)}>
              {RES_NAMES[r].name}
            </button>
          ))}
        </div>
        <div className="hint">Cada unidad diaria importada cuesta {TRADE_CIV_PER_UNIT} talleres civiles. Hace falta una ruta de caravanas segura.</div>
        {partners.map((p) => {
          const avail = exportable(state, p, res);
          const can = canTrade(state, f, p, res, 1);
          return (
            <div key={p} className="trade-partner">
              <Emblem faction={p} size={24} />
              <span>{FACTIONS[p].shortName}</span>
              <span className="num dim">{fmt(avail, 1)} disponible</span>
              <Tip content={can.ok ? 'Importar 1 unidad diaria' : <span className="bad">{can.reason}</span>}>
                <button className="btn small" disabled={!can.ok} onClick={() => store.act((s) => addTrade(s, f, p, res, 1))}>
                  +1
                </button>
              </Tip>
            </div>
          );
        })}
      </Section>
      <Section title="Estaciones">
        <table className="table">
          <thead>
            <tr>
              <th>Estación</th>
              <th>Hab.</th>
              <th>Granjas</th>
              <th>Recursos</th>
            </tr>
          </thead>
          <tbody>
            {ownedStations(state, f).map((sid) => {
              const st = state.stations[sid];
              return (
                <tr key={sid} onClick={() => focusProvince(sid)} className="clickable">
                  <td>{STATIONS[sid].shortName}</td>
                  <td className="num">{fmt(st.population)}</td>
                  <td className="num">{st.buildings.granja}</td>
                  <td>
                    <ResourceChips state={state} sid={sid} f={f} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="hint">Yacimientos de chatarra, pólvora y combustible de cada estación (al día). El modo de mapa «Recursos» los muestra sobre el mapa.</div>
      </Section>
    </Panel>
  );
}
