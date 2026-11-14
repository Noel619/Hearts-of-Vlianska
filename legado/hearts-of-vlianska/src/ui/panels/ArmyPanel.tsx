// Panel del ejército: reclutamiento, cola de instrucción, unidades y diseñador de plantillas.
import { useState } from 'react';
import { BATTALIONS, EQUIPMENT, LINE_BATTALIONS, STATIONS, SUPPORT_BATTALIONS } from '../../data';
import type { Template } from '../../game/types';
import { EQUIPMENT_IDS } from '../../game/types';
import { canRecruit, cancelRecruit, deleteTemplate, recruit, recruitDays, saveTemplate, templateStats, unitStats, unitsOf, validateTemplate, etaHours } from '../../game/military';
import { templateSlots, unlockedBattalions } from '../../game/research';
import { ownedStations, provinceName } from '../../game/helpers';
import { Bar, Empty, Icon, Modal, Panel, Section, Tip, fmt } from '../components/core';
import { centerMapOn, store, ui, useGame } from '../store';

function StatGrid({ t }: { t: ReturnType<typeof templateStats> }) {
  const rows: [string, string][] = [
    ['Hombres', fmt(t.men)],
    ['Ancho de combate', fmt(t.width)],
    ['Organización', fmt(t.org, 1)],
    ['Puntos de vida', fmt(t.hp)],
    ['Ataque blando', fmt(t.soft, 1)],
    ['Ataque duro', fmt(t.hard, 1)],
    ['Defensa', fmt(t.def, 1)],
    ['Ruptura', fmt(t.brk, 1)],
    ['Blindaje', fmt(t.armor, 1)],
    ['Perforación', fmt(t.pierce, 1)],
    ['Velocidad', fmt(t.speed)],
  ];
  return (
    <div className="stat-grid">
      {rows.map(([k, v]) => (
        <div key={k} className="tt-row">
          <span className="dim">{k}</span>
          <span className="num">{v}</span>
        </div>
      ))}
      {t.noAux && <div className="warn">No puede usar túneles auxiliares.</div>}
      {t.attritionReduction > 0 && <div className="good">−{Math.round(t.attritionReduction * 100)} % de desgaste en túneles peligrosos.</div>}
      {t.casualtyReduction > 0 && <div className="good">−{Math.round(t.casualtyReduction * 100)} % de bajas.</div>}
      {t.fortBonus > 0 && <div className="good">+{Math.round(t.fortBonus * 100)} % de eficacia de barricadas al defender.</div>}
      {t.antiFort > 0 && <div className="good">Ignora parte de las barricadas enemigas.</div>}
    </div>
  );
}

export function TemplateTooltip({ tpl }: { tpl: Template }) {
  const state = useGame();
  const t = templateStats(state, state.player!, tpl);
  return (
    <div>
      <h4>{tpl.name}</h4>
      <div className="tt-desc">{[...tpl.line, ...tpl.support].map((b) => BATTALIONS[b]?.name).join(', ')}</div>
      <StatGrid t={t} />
      <div className="tt-sub">Equipo</div>
      {EQUIPMENT_IDS.filter((e) => t.equipment[e] > 0).map((e) => (
        <div key={e} className="tt-row">
          <span>{EQUIPMENT[e].name}</span>
          <span className="num">{fmt(t.equipment[e])}</span>
        </div>
      ))}
    </div>
  );
}

export function ArmyPanel() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const units = unitsOf(state, f);
  const stations = ownedStations(state, f).filter((s) => state.provinces[s].controller === f);
  const [where, setWhere] = useState<string>(c.capital);
  const byProvince = new Map<string, typeof units>();
  for (const u of units) {
    if (!byProvince.has(u.province)) byProvince.set(u.province, []);
    byProvince.get(u.province)!.push(u);
  }
  const days = Math.ceil(recruitDays(state, f));
  let men = 0;
  for (const u of units) men += unitStats(state, u).men * u.strength;

  return (
    <Panel
      title="Ejército"
      icon="Swords"
      onClose={() => ui.set({ panel: null })}
      actions={
        <button className="btn small" onClick={() => ui.set({ overlay: 'templates' })}>
          <Icon name="Wrench" size={14} /> Plantillas
        </button>
      }
    >
      <div className="stat-row">
        <div>
          <span className="label">Unidades</span>
          <strong className="num">{units.length}</strong>
        </div>
        <div>
          <span className="label">Hombres en filas</span>
          <strong className="num">{fmt(men)}</strong>
        </div>
        <div>
          <span className="label">Reclutables</span>
          <strong className="num">{fmt(c.derived.manpowerAvailable)}</strong>
        </div>
      </div>

      <Section
        title="Reclutar"
        right={
          <select value={stations.includes(where) ? where : c.capital} onChange={(e) => setWhere(e.target.value)} aria-label="Estación de reclutamiento">
            {stations.map((s) => (
              <option key={s} value={s}>
                {STATIONS[s].shortName}
              </option>
            ))}
          </select>
        }
      >
        <div className="hint">Instrucción: {days} días. Las unidades se equipan con lo que haya en el almacén al terminar.</div>
        {c.templates.map((tpl) => {
          const can = canRecruit(state, f, tpl.id);
          const t = templateStats(state, f, tpl);
          return (
            <div key={tpl.id} className="recruit-row">
              <Tip content={() => <TemplateTooltip tpl={tpl} />} as="div" className="recruit-info">
                <strong>{tpl.name}</strong>
                <span className="dim">
                  {t.men} hombres · ataque {fmt(t.soft, 0)} · defensa {fmt(t.def, 0)}
                </span>
              </Tip>
              <Tip content={can.ok ? 'Empezar la instrucción' : <span className="bad">{can.reason}</span>}>
                <button className="btn small" disabled={!can.ok} onClick={() => store.act((s) => recruit(s, f, tpl.id, where))}>
                  Reclutar
                </button>
              </Tip>
            </div>
          );
        })}
      </Section>

      {c.recruitment.length > 0 && (
        <Section title="En instrucción">
          {c.recruitment.map((r) => {
            const tpl = c.templates.find((t) => t.id === r.template);
            return (
              <div key={r.id} className="queue-item">
                <Icon name="Users" size={18} className="amber" />
                <div className="queue-main">
                  <div>
                    {tpl?.name ?? r.template} · {STATIONS[r.station]?.shortName}
                  </div>
                  <Bar value={r.progress / days} thin />
                  <span className="dim num">{Math.max(0, Math.ceil(days - r.progress))} días</span>
                </div>
                <button className="btn icon small ghost" onClick={() => store.act((s) => cancelRecruit(s, f, r.id))} aria-label="Cancelar">
                  <Icon name="X" size={14} />
                </button>
              </div>
            );
          })}
        </Section>
      )}

      <Section
        title="Unidades"
        right={
          units.length > 0 ? (
            <button className="btn small ghost" onClick={() => ui.set({ selectedUnits: units.map((u) => u.id), selectedProvince: null })}>
              Seleccionar todas
            </button>
          ) : undefined
        }
      >
        {units.length === 0 && <Empty>No tienes unidades.</Empty>}
        {[...byProvince.entries()].map(([pid, list]) => (
          <div key={pid} className="unit-group">
            <button className="link unit-group-title" onClick={() => { centerMapOn(pid); ui.set({ selectedUnits: list.map((u) => u.id), selectedProvince: null }); }}>
              <Icon name="MapPin" size={13} /> {provinceName(pid)}
            </button>
            {list.map((u) => {
              const s = unitStats(state, u);
              return (
                <button key={u.id} className="unit-row" onClick={() => { centerMapOn(u.province); ui.set({ selectedUnits: [u.id], selectedProvince: null }); }}>
                  <span className="unit-name">{u.name}</span>
                  <span className="unit-bars">
                    <Bar value={u.org / Math.max(1, s.org)} color="green" thin />
                    <Bar value={u.strength} thin />
                  </span>
                  <span className="unit-status">
                    {u.battle ? <Icon name="Swords" size={14} className="bad" /> : u.path.length ? <span className="num dim">{Math.ceil(etaHours(state, u) / 24)} d</span> : null}
                    {u.outOfSupply && <Icon name="Unplug" size={14} className="bad" />}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </Section>
    </Panel>
  );
}

export function TemplateDesigner() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const slots = templateSlots(state, f);
  const unlocked = unlockedBattalions(state, f);
  const [editing, setEditing] = useState<Template>(() => ({ ...(c.templates[0] ?? { id: 'nueva', name: 'Nueva plantilla', line: ['fusileros'], support: [] }), line: [...(c.templates[0]?.line ?? ['fusileros'])], support: [...(c.templates[0]?.support ?? [])] }));
  const [pick, setPick] = useState<{ kind: 'line' | 'support'; index: number } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const err = validateTemplate(state, f, editing);
  const stats = templateStats(state, f, editing);
  const existing = c.templates.some((t) => t.id === editing.id);
  const inUse = Object.values(state.units).some((u) => u.owner === f && u.template === editing.id);

  const setSlot = (kind: 'line' | 'support', index: number, b: string | null) => {
    setEditing((e) => {
      const arr = [...e[kind]];
      if (b === null) arr.splice(index, 1);
      else arr[index] = b;
      return { ...e, [kind]: arr };
    });
    setPick(null);
  };

  const options = pick ? (pick.kind === 'line' ? LINE_BATTALIONS : SUPPORT_BATTALIONS) : [];

  return (
    <Modal onClose={() => ui.set({ overlay: null })} wide className="designer">
      <header className="modal-head">
        <Icon name="Wrench" size={20} className="amber" />
        <h2>Diseñador de plantillas</h2>
        <button className="btn icon ghost" onClick={() => ui.set({ overlay: null })} aria-label="Cerrar">
          <Icon name="X" size={18} />
        </button>
      </header>
      <div className="designer-body">
        <aside className="designer-list">
          {c.templates.map((t) => (
            <button key={t.id} className={`designer-item ${t.id === editing.id ? 'active' : ''}`} onClick={() => { setEditing({ ...t, line: [...t.line], support: [...t.support] }); setMsg(null); }}>
              {t.name}
            </button>
          ))}
          <button
            className="btn small ghost"
            onClick={() => {
              setEditing({ id: `t${Date.now().toString(36)}`, name: 'Nueva plantilla', line: ['fusileros', 'fusileros'], support: [], custom: true });
              setMsg(null);
            }}
          >
            <Icon name="Plus" size={14} /> Nueva plantilla
          </button>
        </aside>
        <div className="designer-main">
          <label className="label" htmlFor="tpl-name">
            Nombre
          </label>
          <input id="tpl-name" type="text" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} maxLength={40} />
          <div className="designer-slots">
            <div>
              <div className="label">Batallones de línea ({editing.line.length}/{slots.line})</div>
              <div className="slot-grid">
                {Array.from({ length: slots.line }).map((_, i) => {
                  const b = editing.line[i];
                  return (
                    <button key={i} className={`slot ${b ? 'filled' : ''} ${pick?.kind === 'line' && pick.index === i ? 'picking' : ''}`} onClick={() => setPick({ kind: 'line', index: b ? i : editing.line.length })}>
                      {b ? (
                        <>
                          <span className="slot-short">{BATTALIONS[b].short}</span>
                          <span className="slot-name">{BATTALIONS[b].name}</span>
                        </>
                      ) : (
                        <Icon name="Plus" size={16} className="faint" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div className="label">Compañías de apoyo ({editing.support.length}/{slots.support})</div>
              <div className="slot-grid support">
                {Array.from({ length: slots.support }).map((_, i) => {
                  const b = editing.support[i];
                  return (
                    <button key={i} className={`slot ${b ? 'filled' : ''} ${pick?.kind === 'support' && pick.index === i ? 'picking' : ''}`} onClick={() => setPick({ kind: 'support', index: b ? i : editing.support.length })}>
                      {b ? (
                        <>
                          <span className="slot-short">{BATTALIONS[b].short}</span>
                          <span className="slot-name">{BATTALIONS[b].name}</span>
                        </>
                      ) : (
                        <Icon name="Plus" size={16} className="faint" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {pick && (
            <div className="bat-picker">
              {options.map((b) => {
                const ok = unlocked.has(b.id);
                return (
                  <Tip
                    key={b.id}
                    content={
                      <div>
                        <h4>{b.name}</h4>
                        <div className="tt-desc">{b.desc}</div>
                        <div className="tt-row"><span>Hombres</span><span className="num">{b.men}</span></div>
                        <div className="tt-row"><span>Ataque blando / duro</span><span className="num">{b.soft} / {b.hard}</span></div>
                        <div className="tt-row"><span>Defensa / ruptura</span><span className="num">{b.def} / {b.brk}</span></div>
                        <div className="tt-row"><span>Organización</span><span className="num">{b.org}</span></div>
                        {!ok && <div className="bad">Requiere investigar su tecnología.</div>}
                      </div>
                    }
                  >
                    <button className="btn small" disabled={!ok} onClick={() => setSlot(pick.kind, pick.index, b.id)}>
                      {b.name}
                    </button>
                  </Tip>
                );
              })}
              {editing[pick.kind][pick.index] && (
                <button className="btn small danger" onClick={() => setSlot(pick.kind, pick.index, null)}>
                  Quitar
                </button>
              )}
            </div>
          )}
          {err && <div className="bad">{err}</div>}
          {msg && <div className="good">{msg}</div>}
          <div className="designer-actions">
            {existing && (
              <Tip content={inUse ? 'Hay unidades usando esta plantilla.' : 'Eliminar plantilla'}>
                <button
                  className="btn danger"
                  disabled={inUse}
                  onClick={() => {
                    store.act((s) => deleteTemplate(s, f, editing.id));
                    setMsg('Plantilla eliminada.');
                  }}
                >
                  Eliminar
                </button>
              </Tip>
            )}
            <button
              className="btn primary"
              disabled={!!err}
              onClick={() => {
                const e = store.act((s) => saveTemplate(s, f, editing));
                setMsg(e ? null : 'Plantilla guardada. Las unidades existentes se actualizan automáticamente.');
              }}
            >
              Guardar
            </button>
          </div>
        </div>
        <aside className="designer-stats">
          <div className="label">Estadísticas</div>
          <StatGrid t={stats} />
          <div className="tt-sub">Equipo necesario</div>
          {EQUIPMENT_IDS.filter((e) => stats.equipment[e] > 0).map((e) => (
            <div key={e} className="tt-row">
              <span>{EQUIPMENT[e].name}</span>
              <span className="num">{fmt(stats.equipment[e])}</span>
            </div>
          ))}
        </aside>
      </div>
    </Modal>
  );
}
