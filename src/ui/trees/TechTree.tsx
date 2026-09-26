// Árbol tecnológico a pantalla completa, con los espacios de investigación.
import { useState } from 'react';
import { BATTALIONS, EQUIPMENT, TECH_BY_ID, TECH_CATEGORIES, TECHS } from '../../data';
import type { TechCategory, TechDef } from '../../game/types';
import { AHEAD_PENALTY, bestBonus, cancelResearch, daysLeft, researchCost, researchSpeed, startResearch, techStatus } from '../../game/research';
import { describeEffects } from '../../game/describe';
import { yearOf } from '../../game/time';
import { Bar, Icon, Lines, ModLines, Tip, fmt } from '../components/core';
import { store, ui, useGame } from '../store';
import { useDragScroll } from './FocusTree';

const COL_W = 212;
const ROW_H = 86;
const NODE_W = 188;
const NODE_H = 62;
const PAD_X = 30;
const PAD_Y = 44;
const BASE_YEAR = 2032;

const STATUS_TEXT = {
  done: 'Investigada',
  active: 'En investigación',
  available: 'Disponible',
  locked: 'Requiere tecnologías previas',
  excluded: 'Excluida por otra doctrina o elección',
};

function TechTooltip({ t }: { t: TechDef }) {
  const state = useGame();
  const f = state.player!;
  const status = techStatus(state, f, t.id);
  const ahead = Math.max(0, t.year - yearOf(state.hour));
  const bonus = bestBonus(state, f, t);
  return (
    <div>
      <h4>{t.name}</h4>
      <div className="tt-desc">{t.desc}</div>
      <div className="tt-row">
        <span>Año</span>
        <span className="num">{t.year}</span>
      </div>
      <div className="tt-row">
        <span>Coste</span>
        <span className="num">{fmt(researchCost(state, t))} días base</span>
      </div>
      {ahead > 0 && <div className="warn">Adelantada {ahead} año(s): +{Math.round(AHEAD_PENALTY * ahead * 100)} % de coste.</div>}
      {bonus && status === 'available' && <div className="good">Se aplicará la bonificación «{bonus.label}» (+{Math.round(bonus.v * 100)} %).</div>}
      <div className={status === 'locked' || status === 'excluded' ? 'bad' : 'good'}>{STATUS_TEXT[status]}</div>
      {t.prereq && (
        <>
          <div className="tt-sub">Requiere</div>
          {t.prereq.map((p) => (
            <div key={p} className={`tt-line ${state.countries[f].research.done.includes(p) ? 'met' : 'unmet'}`}>
              {TECH_BY_ID[p].name}
            </div>
          ))}
        </>
      )}
      {t.exclusive && (
        <>
          <div className="tt-sub">Excluye</div>
          {t.exclusive.map((p) => (
            <div key={p} className="tt-line">
              {TECH_BY_ID[p].name}
            </div>
          ))}
        </>
      )}
      <div className="tt-sub">Efectos</div>
      {t.modifiers && <ModLines mods={t.modifiers} />}
      {t.unlocks?.battalions?.map((b) => (
        <div key={b} className="tt-line good">
          Desbloquea el batallón: {BATTALIONS[b].name}
        </div>
      ))}
      {t.unlocks?.equipment && (
        <div className="tt-line good">
          {EQUIPMENT[t.unlocks.equipment.id].name}: modelo «{EQUIPMENT[t.unlocks.equipment.id].levels[t.unlocks.equipment.level - 1]}»
        </div>
      )}
      {(t.unlocks?.lineSlots || t.unlocks?.supportSlots) && <div className="tt-line good">Plantillas más grandes</div>}
      {t.effects && <Lines lines={describeEffects(t.effects, state, { root: f })} />}
    </div>
  );
}

export function TechTreeView() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const [cat, setCat] = useState<TechCategory>('armamento');
  const [msg, setMsg] = useState<string | null>(null);
  const { ref, handlers, wasDrag } = useDragScroll();
  const techs = TECHS.filter((t) => t.cat === cat);
  const maxX = Math.max(...TECHS.map((t) => t.x));
  const maxY = Math.max(...techs.map((t) => t.y));
  const width = (maxX + 1) * COL_W + PAD_X * 2;
  const height = (maxY + 1) * ROW_H + PAD_Y + 30;
  const pos = (t: TechDef) => ({ x: PAD_X + t.x * COL_W, y: PAD_Y + t.y * ROW_H });
  const speed = researchSpeed(state, f);
  const year = yearOf(state.hour);

  const click = (t: TechDef) => {
    if (wasDrag()) return;
    const status = techStatus(state, f, t.id);
    if (status !== 'available') {
      setMsg(STATUS_TEXT[status]);
      return;
    }
    const slot = c.research.active.findIndex((a, i) => !a && i < c.research.slots);
    if (slot < 0) {
      setMsg('Todos los espacios de investigación están ocupados.');
      return;
    }
    store.act((s) => startResearch(s, f, slot, t.id));
    setMsg(null);
  };

  return (
    <div className="overlay tech-overlay">
      <header className="overlay-head">
        <Icon name="Microscope" size={30} className="amber" />
        <div>
          <div className="label">Investigación · velocidad {Math.round(speed * 100)} %</div>
          <h2>Tecnología</h2>
        </div>
        <div className="research-slots">
          {Array.from({ length: c.research.slots }).map((_, i) => {
            const a = c.research.active[i];
            if (!a)
              return (
                <div key={i} className="research-slot empty">
                  <Icon name="Plus" size={16} className="faint" /> Espacio libre
                </div>
              );
            const t = TECH_BY_ID[a.tech];
            return (
              <Tip key={i} content={() => <TechTooltip t={t} />} as="div" className="research-slot">
                <Icon name={t.icon} size={22} className="amber" />
                <div className="research-slot-text">
                  <strong>{t.name}</strong>
                  <Bar value={a.progress / researchCost(state, t)} color="blue" thin />
                  <span className="dim num">{Math.ceil(daysLeft(state, f, a))} días{a.bonus ? ` · +${Math.round(a.bonus * 100)} %` : ''}</span>
                </div>
                <button className="btn icon small ghost" onClick={() => store.act((s) => cancelResearch(s, f, i))} aria-label="Cancelar">
                  <Icon name="X" size={14} />
                </button>
              </Tip>
            );
          })}
        </div>
        {msg && <span className="overlay-msg">{msg}</span>}
        <button className="btn icon ghost" onClick={() => ui.set({ overlay: null })} aria-label="Cerrar">
          <Icon name="X" size={22} />
        </button>
      </header>
      <div className="tech-tabs" role="tablist">
        {TECH_CATEGORIES.map((tc) => {
          const done = TECHS.filter((t) => t.cat === tc.id && c.research.done.includes(t.id)).length;
          const total = TECHS.filter((t) => t.cat === tc.id).length;
          const bonus = c.research.bonuses.some((b) => b.cat === tc.id);
          return (
            <button key={tc.id} role="tab" aria-selected={cat === tc.id} className={`tech-tab ${cat === tc.id ? 'active' : ''}`} onClick={() => setCat(tc.id)}>
              <Icon name={tc.icon} size={18} />
              <span>{tc.name}</span>
              <span className="num dim">
                {done}/{total}
              </span>
              {bonus && <Icon name="Sparkles" size={14} className="amber" />}
            </button>
          );
        })}
        {c.research.bonuses.length > 0 && (
          <Tip
            content={
              <div>
                <h4>Bonificaciones de investigación</h4>
                {c.research.bonuses.map((b) => (
                  <div key={b.id}>
                    +{Math.round(b.v * 100)} % en {TECH_CATEGORIES.find((x) => x.id === b.cat)?.name} ({b.uses} uso/s) · {b.label}
                  </div>
                ))}
              </div>
            }
          >
            <span className="chip gold">
              <Icon name="Sparkles" size={12} /> {c.research.bonuses.length} bonificación(es)
            </span>
          </Tip>
        )}
      </div>
      <div className="tree-scroll" ref={ref} {...handlers}>
        <div className="tree-canvas" style={{ width, height }}>
          {Array.from({ length: maxX + 1 }).map((_, i) => (
            <div key={i} className={`year-col ${BASE_YEAR + i === year ? 'now' : ''}`} style={{ left: PAD_X + i * COL_W - 12, width: COL_W, height }}>
              <span>{BASE_YEAR + i}</span>
            </div>
          ))}
          <svg className="tree-lines" width={width} height={height} aria-hidden>
            {techs.flatMap((t) =>
              (t.prereq ?? []).map((p) => {
                const parent = TECH_BY_ID[p];
                if (parent.cat !== cat) return null;
                const a = pos(parent);
                const b = pos(t);
                const x1 = a.x + NODE_W;
                const y1 = a.y + NODE_H / 2;
                const x2 = b.x;
                const y2 = b.y + NODE_H / 2;
                const mx = x1 + (x2 - x1) / 2;
                return <path key={`${p}-${t.id}`} d={`M${x1} ${y1} H${mx} V${y2} H${x2}`} className={`tree-line ${c.research.done.includes(p) ? 'done' : ''}`} />;
              }),
            )}
          </svg>
          {techs.map((t) => {
            const p = pos(t);
            const status = techStatus(state, f, t.id);
            const active = c.research.active.find((a) => a?.tech === t.id);
            return (
              <Tip key={t.id} content={() => <TechTooltip t={t} />} as="div" className="tech-node-wrap" style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}>
                <button className={`tech-node ${status} ${t.year > year ? 'ahead' : ''}`} onClick={() => click(t)}>
                  <Icon name={t.icon} size={24} strokeWidth={1.8} />
                  <span className="tech-text">
                    <span className="tech-name">{t.name}</span>
                    <span className="tech-meta num">
                      {t.year} · {fmt(researchCost(state, t) / speed)} d
                    </span>
                  </span>
                  {active && (
                    <span className="tech-progress">
                      <Bar value={active.progress / researchCost(state, t)} color="blue" thin />
                    </span>
                  )}
                </button>
              </Tip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
