// Panel de diplomacia: relaciones, guerras, alianzas y acuerdos.
import { useState } from 'react';
import { INFLUENCE, influenceDrift, influenceOf } from '../../game/influence';
import { InfluenceRow } from '../components/Influence';
import { FACTIONS, IDEOLOGIES, LEADERS } from '../../data';
import type { FactionId } from '../../game/types';
import { FACTION_IDS } from '../../game/types';
import { factionName, hasAccess, hasNap, isAtWarWith, ownedStations, pactOf, relation, samePact, sideIn } from '../../game/helpers';
import {
  EMBARGO_COST,
  GUARANTEE_COST,
  IMPROVE_COST,
  JUSTIFY_COST,
  NAP_COST,
  canDeclareWar,
  canJustify,
  capitulationLimit,
  cancelJustify,
  declareWar,
  improveRelations,
  justifyDays,
  leavePact,
  startJustify,
} from '../../game/diplomacy';
import {
  armySummary,
  freeSubject,
  invitePact,
  isEmbargoing,
  proposeNap,
  proposePeace,
  requestAccess,
  toggleEmbargo,
  toggleGrantAccess,
  toggleGuarantee,
  type ActionResult,
} from '../../game/playerActions';
import { formatDate } from '../../game/time';
import { Emblem, Portrait } from '../components/art';
import { Bar, Icon, Panel, Section, Tip, fmt, pct } from '../components/core';
import { store, ui, useGame } from '../store';

function relTone(v: number) {
  return v >= 30 ? 'good' : v <= -30 ? 'bad' : '';
}

export function DiplomacyPanel() {
  const state = useGame();
  const f = state.player!;
  const s = ui.use();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [confirmWar, setConfirmWar] = useState<FactionId | null>(null);
  const others = FACTION_IDS.filter((x) => x !== f && state.countries[x].alive);
  const target = s.diploTarget && state.countries[s.diploTarget]?.alive ? s.diploTarget : null;
  const c = state.countries[f];

  const run = (fn: () => ActionResult | undefined) => {
    const r = fn();
    if (r) setResult(r);
  };

  const statusChips = (t: FactionId) => {
    const chips: { text: string; cls: string }[] = [];
    if (isAtWarWith(state, f, t)) chips.push({ text: 'En guerra', cls: 'war' });
    if (samePact(state, f, t)) chips.push({ text: 'Aliado', cls: 'ally' });
    if (hasNap(state, f, t)) chips.push({ text: 'No agresión', cls: 'info' });
    if (state.countries[t].overlord === f) chips.push({ text: 'Protectorado', cls: 'gold' });
    if (c.overlord === t) chips.push({ text: 'Nuestro señor', cls: 'gold' });
    if (state.guarantees.some((g) => g.guarantor === f && g.target === t)) chips.push({ text: 'Garantizada', cls: 'ally' });
    if (state.guarantees.some((g) => g.guarantor === t && g.target === f)) chips.push({ text: 'Nos garantiza', cls: 'ally' });
    if (hasAccess(state, f, t) && !samePact(state, f, t)) chips.push({ text: 'Acceso', cls: 'info' });
    if (state.embargoes.some((e) => (e.from === f && e.to === t) || (e.from === t && e.to === f))) chips.push({ text: 'Embargo', cls: 'war' });
    const wg = c.wargoals.find((w) => w.target === t);
    if (wg) chips.push({ text: wg.ready ? 'Objetivo listo' : `Justificando ${Math.round(wg.progress * 100)} %`, cls: 'war' });
    if (state.countries[t].wargoals.some((w) => w.target === f)) chips.push({ text: '¡Nos amenaza!', cls: 'war' });
    if (influenceOf(state, f, t) >= INFLUENCE.TUTELAGE) chips.push({ text: 'Nos tutela', cls: 'war' });
    else if (influenceOf(state, f, t) > 0) chips.push({ text: `Influencia ${Math.round(influenceOf(state, f, t))}`, cls: 'info' });
    if (influenceOf(state, t, f) >= INFLUENCE.TUTELAGE) chips.push({ text: 'Bajo nuestra tutela', cls: 'gold' });
    return chips;
  };

  return (
    <Panel title="Diplomacia" icon="Handshake" onClose={() => ui.set({ panel: null })}>
      {result && (
        <div className={`result ${result.ok ? 'ok' : 'ko'}`} role="status">
          <Icon name={result.ok ? 'Check' : 'Ban'} size={16} />
          <span>{result.text}</span>
          <button className="btn icon small ghost" onClick={() => setResult(null)} aria-label="Cerrar">
            <Icon name="X" size={14} />
          </button>
        </div>
      )}
      <Section title="Facciones del metro">
        <div className="faction-list">
          {others.map((t) => {
            const rel = relation(state, f, t);
            return (
              <button key={t} className={`faction-row ${target === t ? 'active' : ''}`} onClick={() => ui.set({ diploTarget: t })}>
                <Emblem faction={t} size={30} />
                <div className="faction-row-main">
                  <div className="faction-row-name">
                    {FACTIONS[t].name}
                    <i className="ideo-dot" style={{ background: IDEOLOGIES[state.countries[t].ideology].color }} />
                  </div>
                  <div className="faction-row-chips">
                    {statusChips(t).map((ch, i) => (
                      <span key={i} className={`chip ${ch.cls}`}>
                        {ch.text}
                      </span>
                    ))}
                  </div>
                </div>
                <span className={`num rel ${relTone(rel)}`}>{rel > 0 ? `+${Math.round(rel)}` : Math.round(rel)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {target && (
        <Section title={FACTIONS[target].name}>
          {(() => {
            const tc = state.countries[target];
            const leader = LEADERS[tc.leader];
            const army = armySummary(state, target);
            const wg = c.wargoals.find((w) => w.target === target);
            const atWar = isAtWarWith(state, f, target);
            const canJ = canJustify(state, f, target);
            const canD = canDeclareWar(state, f, target);
            const pact = pactOf(state, target);
            return (
              <div className="diplo-detail">
                <div className="diplo-head">
                  <Portrait p={leader.portrait} size={64} />
                  <div>
                    <strong>{leader.name}</strong>
                    <div className="dim">{leader.title}</div>
                    <div style={{ color: IDEOLOGIES[tc.ideology].color }}>{IDEOLOGIES[tc.ideology].name}</div>
                    <div className="dim">
                      {ownedStations(state, target).length} estaciones · {army.units} unidades (~{fmt(army.men)} hombres)
                    </div>
                    {pact && <div className="dim">Alianza: {pact.name}</div>}
                  </div>
                </div>
                <div className="tt-row">
                  <span>Opinión de {factionName(target)}</span>
                  <span className={`num ${relTone(relation(state, target, f))}`}>{Math.round(relation(state, target, f))}</span>
                </div>
                {(influenceOf(state, f, target) > 0 || influenceDrift(state, f, target) !== 0) && (
                  <InfluenceRow state={state} over={f} by={target} label="Su influencia sobre nosotros" />
                )}
                {(influenceOf(state, target, f) > 0 || influenceDrift(state, target, f) !== 0) && (
                  <InfluenceRow state={state} over={target} by={f} label="Nuestra influencia sobre ellos" />
                )}
                <div className="diplo-actions">
                  <Tip content={<div>Coste: {IMPROVE_COST} PP. +15 de relaciones. Una vez al mes.</div>}>
                    <button className="btn small" disabled={atWar || c.pp < IMPROVE_COST || (c.cooldowns[`mejorar_${target}`] ?? 0) > state.hour} onClick={() => store.act((st) => improveRelations(st, f, target))}>
                      <Icon name="TrendingUp" size={14} /> Mejorar relaciones
                    </button>
                  </Tip>
                  {!atWar && !wg && (
                    <Tip content={<div><h4>Justificar guerra</h4><div>Coste: {JUSTIFY_COST} PP. Tarda unos {Math.round(justifyDays(state, f))} días y aumenta la tensión.</div>{!canJ.ok && <div className="bad">{canJ.reason}</div>}</div>}>
                      <button className="btn small danger" disabled={!canJ.ok} onClick={() => store.act((st) => startJustify(st, f, target))}>
                        <Icon name="Crosshair" size={14} /> Justificar guerra
                      </button>
                    </Tip>
                  )}
                  {wg && !wg.ready && (
                    <div className="justify">
                      <span className="dim">Justificando… {Math.round(wg.progress * 100)} %</span>
                      <Bar value={wg.progress} color="red" thin />
                      <button className="btn small ghost" onClick={() => store.act((st) => cancelJustify(st, f, target))}>
                        Cancelar
                      </button>
                    </div>
                  )}
                  {wg?.ready && !atWar && (
                    <Tip content={<div><h4>Declarar la guerra</h4>{wg.expires && <div className="dim">El objetivo caduca el {formatDate(wg.expires)}.</div>}{!canD.ok && <div className="bad">{canD.reason}</div>}</div>}>
                      <button className="btn small primary" disabled={!canD.ok} onClick={() => setConfirmWar(target)}>
                        <Icon name="Swords" size={14} /> Declarar la guerra
                      </button>
                    </Tip>
                  )}
                  {atWar && (
                    <button className="btn small" onClick={() => run(() => store.act((st) => proposePeace(st, f, target)))}>
                      <Icon name="Flag" size={14} /> Proponer paz blanca
                    </button>
                  )}
                  {!atWar && !hasNap(state, f, target) && (
                    <Tip content={<div>Coste: {NAP_COST} PP si aceptan. Dos años sin guerra entre vosotros.</div>}>
                      <button className="btn small" disabled={c.pp < NAP_COST} onClick={() => run(() => store.act((st) => proposeNap(st, f, target)))}>
                        <Icon name="Shield" size={14} /> Pacto de no agresión
                      </button>
                    </Tip>
                  )}
                  {!atWar && !samePact(state, f, target) && (
                    <button className="btn small" onClick={() => run(() => store.act((st) => invitePact(st, f, target)))}>
                      <Icon name="Handshake" size={14} /> Invitar a la alianza
                    </button>
                  )}
                  {!atWar && !hasAccess(state, f, target) && (
                    <button className="btn small" onClick={() => run(() => store.act((st) => requestAccess(st, f, target)))}>
                      <Icon name="Route" size={14} /> Pedir acceso militar
                    </button>
                  )}
                  {!atWar && (
                    <button className="btn small ghost" onClick={() => run(() => store.act((st) => toggleGrantAccess(st, f, target)))}>
                      <Icon name="Route" size={14} /> {state.access.some((a) => a.from === f && a.to === target) ? 'Retirar acceso' : 'Conceder acceso'}
                    </button>
                  )}
                  {!atWar && (
                    <Tip content={<div>Coste: {GUARANTEE_COST} PP. Entrarás en guerra si alguien la ataca.</div>}>
                      <button className="btn small ghost" onClick={() => run(() => store.act((st) => toggleGuarantee(st, f, target)))}>
                        <Icon name="ShieldCheck" size={14} /> {state.guarantees.some((g) => g.guarantor === f && g.target === target) ? 'Retirar garantía' : 'Garantizar independencia'}
                      </button>
                    </Tip>
                  )}
                  <Tip content={<div>Coste: {EMBARGO_COST} PP. Corta todo el comercio entre vosotros.</div>}>
                    <button className="btn small ghost" onClick={() => run(() => store.act((st) => toggleEmbargo(st, f, target)))}>
                      <Icon name="Ban" size={14} /> {isEmbargoing(state, f, target) ? 'Levantar embargo' : 'Embargo'}
                    </button>
                  </Tip>
                  {tc.overlord === f && (
                    <button className="btn small ghost" onClick={() => run(() => store.act((st) => freeSubject(st, f, target)))}>
                      Liberar protectorado
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </Section>
      )}

      <Section title="Guerras">
        {state.wars.length === 0 && <div className="dim">El metro está en paz… por ahora.</div>}
        {state.wars.map((w) => {
          const mine = sideIn(w, f);
          return (
            <div key={w.id} className={`war-card ${mine ? 'mine' : ''}`}>
              <div className="war-title">
                <Icon name="Swords" size={16} /> {w.name}
                <span className="dim num">desde {formatDate(w.start)}</span>
              </div>
              <div className="war-sides">
                {[w.attackers, w.defenders].map((side, i) => (
                  <div key={i} className="war-side">
                    {side.map((x) => (
                      <Tip key={x} content={<div><h4>{FACTIONS[x].name}</h4><div>Capitulación: {pct(state.countries[x].surrender)} de {pct(capitulationLimit(state, x))}</div></div>}>
                        <div className="war-member">
                          <Emblem faction={x} size={22} />
                          <span>{FACTIONS[x].shortName}</span>
                          <Bar value={state.countries[x].surrender / capitulationLimit(state, x)} color="red" thin className="war-bar" />
                        </div>
                      </Tip>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="Alianzas">
        {state.pacts.length === 0 && <div className="dim">No hay alianzas formales.</div>}
        {state.pacts.map((p) => (
          <div key={p.id} className="pact">
            <strong>{p.name}</strong>
            <div className="pact-members">
              {p.members.map((m) => (
                <Tip key={m} content={<div>{FACTIONS[m].name}{m === p.leader ? ' (líder)' : ''}</div>}>
                  <Emblem faction={m} size={24} />
                </Tip>
              ))}
            </div>
            {p.members.includes(f) && (
              <button className="btn small ghost" onClick={() => store.act((st) => leavePact(st, f))}>
                Abandonar
              </button>
            )}
          </div>
        ))}
      </Section>

      {confirmWar && (
        <div className="confirm">
          <p>
            ¿Declarar la guerra a <strong>{FACTIONS[confirmWar].name}</strong>? Sus aliados y garantes pueden unirse a la defensa.
          </p>
          <div className="confirm-actions">
            <button className="btn ghost" onClick={() => setConfirmWar(null)}>
              Cancelar
            </button>
            <button
              className="btn primary"
              onClick={() => {
                store.act((st) => declareWar(st, f, confirmWar));
                setConfirmWar(null);
              }}
            >
              ¡A la guerra!
            </button>
          </div>
        </div>
      )}
    </Panel>
  );
}
