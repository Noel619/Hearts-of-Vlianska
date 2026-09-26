// Paneles de decisiones y de registro/noticias.
import { useState } from 'react';
import { DECISIONS } from '../../data';
import type { DecisionDef } from '../../game/types';
import { canTakeDecision, decisionCost, decisionTargets, takeDecision, visibleDecisions } from '../../game/decisions';
import { describeCondition, describeEffects } from '../../game/describe';
import { formatDate, formatShortDate } from '../../game/time';
import { Bar, Empty, Icon, Lines, Panel, Section, Tip } from '../components/core';
import { centerMapOn, store, ui, useGame } from '../store';

function DecisionCard({ d }: { d: DecisionDef }) {
  const state = useGame();
  const f = state.player!;
  const targets = decisionTargets(state, f, d);
  const [target, setTarget] = useState<string>('');
  const chosen = targets ? (targets.some((t) => t.id === target) ? target : targets[0]?.id ?? '') : undefined;
  const can = canTakeDecision(state, f, d.id, chosen || undefined);
  const cost = decisionCost(state, f, d);
  const c = state.countries[f];
  const key = chosen ? `${d.id}:${chosen}` : d.id;
  const cooldown = c.cooldowns[key] && c.cooldowns[key] > state.hour ? c.cooldowns[key] : null;
  const costText = [cost.pp ? `${cost.pp} PP` : '', cost.manpower ? `${cost.manpower} hombres` : '', cost.food ? `${cost.food} raciones` : '', cost.armas ? `${cost.armas} armas` : '']
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`decision ${can.ok ? '' : 'disabled'}`}>
      <Tip
        as="div"
        className="decision-head"
        content={() => (
          <div>
            <h4>{d.name}</h4>
            <div className="tt-desc">{d.desc}</div>
            {d.available && (
              <>
                <div className="tt-sub">Requisitos</div>
                <Lines lines={describeCondition(d.available, state, { root: f, target: chosen || undefined })} />
              </>
            )}
            {d.effects.length > 0 && (
              <>
                <div className="tt-sub">Efectos inmediatos</div>
                <Lines lines={describeEffects(d.effects, state, { root: f, target: chosen || undefined })} />
              </>
            )}
            {d.completeEffects && (
              <>
                <div className="tt-sub">{d.days ? `Al cabo de ${d.days} días` : 'Efectos'}</div>
                <Lines lines={describeEffects(d.completeEffects, state, { root: f, target: chosen || undefined })} />
              </>
            )}
            {d.cooldown && <div className="faint">Se puede repetir cada {d.cooldown} días.</div>}
          </div>
        )}
      >
        <Icon name={d.icon} size={24} className="amber" />
        <div>
          <strong>{d.name}</strong>
          <div className="dim">{costText || 'Gratis'}{d.days ? ` · ${d.days} días` : ''}</div>
        </div>
      </Tip>
      {targets && (
        <select value={chosen} onChange={(e) => setTarget(e.target.value)} aria-label="Objetivo">
          {targets.length === 0 && <option value="">Sin objetivos disponibles</option>}
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      )}
      <div className="decision-foot">
        {cooldown ? <span className="dim">Disponible el {formatShortDate(cooldown)}</span> : !can.ok ? <span className="bad">{can.reason}</span> : <span />}
        <button className="btn small primary" disabled={!can.ok} onClick={() => store.act((s) => takeDecision(s, f, d.id, chosen || undefined))}>
          Tomar
        </button>
      </div>
    </div>
  );
}

export function DecisionsPanel() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const list = visibleDecisions(state, f);
  const cats = [...new Set(list.map((d) => d.category))];
  return (
    <Panel title="Decisiones" icon="ScrollText" onClose={() => ui.set({ panel: null })}>
      {c.activeDecisions.length > 0 && (
        <Section title="En curso">
          {c.activeDecisions.map((a, i) => {
            const d = DECISIONS[a.id];
            const total = (d.days ?? 1) * 24;
            const left = a.until - state.hour;
            return (
              <div key={i} className="queue-item">
                <Icon name={d.icon} size={18} className="amber" />
                <div className="queue-main">
                  <div>{d.name}</div>
                  <Bar value={1 - left / total} thin />
                  <span className="dim num">{Math.ceil(left / 24)} días</span>
                </div>
              </div>
            );
          })}
        </Section>
      )}
      {cats.map((cat) => (
        <Section key={cat} title={cat}>
          <div className="decisions">
            {list
              .filter((d) => d.category === cat)
              .map((d) => (
                <DecisionCard key={d.id} d={d} />
              ))}
          </div>
        </Section>
      ))}
      {list.length === 0 && <Empty>No hay decisiones disponibles.</Empty>}
    </Panel>
  );
}

export function LogPanel() {
  const state = useGame();
  const [tab, setTab] = useState<'todo' | 'guerra' | 'noticias'>('todo');
  const f = state.player;
  const entries = [...state.log]
    .reverse()
    .filter((l) => (tab === 'guerra' ? l.kind === 'guerra' : true))
    .slice(0, 150);
  return (
    <Panel title="Registro" icon="Newspaper" onClose={() => ui.set({ panel: null })}>
      <div className="res-tabs">
        <button className={`btn small ${tab === 'todo' ? 'primary' : 'ghost'}`} onClick={() => setTab('todo')}>
          Todo
        </button>
        <button className={`btn small ${tab === 'guerra' ? 'primary' : 'ghost'}`} onClick={() => setTab('guerra')}>
          Guerra
        </button>
        <button className={`btn small ${tab === 'noticias' ? 'primary' : 'ghost'}`} onClick={() => setTab('noticias')}>
          Noticias del metro
        </button>
      </div>
      {tab === 'noticias' ? (
        <div className="news">
          {state.news.length === 0 && <Empty>Sin noticias.</Empty>}
          {[...state.news].reverse().map((n, i) => (
            <article key={i} className="news-item">
              <Icon name={n.picture} size={22} className="amber" />
              <div>
                <div className="label">{formatDate(n.hour)}</div>
                <h3>{n.title}</h3>
                <p>{n.text}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="log">
          {entries.map((l, i) => (
            <button key={i} className={`log-item ${l.kind} ${l.faction === f ? 'mine' : ''}`} onClick={() => l.province && centerMapOn(l.province)} disabled={!l.province}>
              <span className="num dim">{formatShortDate(l.hour)}</span>
              <span>{l.text}</span>
            </button>
          ))}
          {entries.length === 0 && <Empty>Nada que contar todavía.</Empty>}
        </div>
      )}
    </Panel>
  );
}
