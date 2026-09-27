// Panel de gobierno: líder, ideologías, espíritus nacionales, leyes y asesores.
import { useState } from 'react';
import { ADVISOR_BY_ID, FACTIONS, IDEOLOGIES, IDEOLOGY_IDS, LAW_GROUPS, LAWS, LEADERS, MILITARY_SLOTS, POLITICAL_SLOTS, SPIRITS, TRAITS, lawsOfGroup } from '../../data';
import type { AdvisorDef, IdeologyId } from '../../game/types';
import { advisorCost, availableAdvisors, canEnactLaw, canHireAdvisor, enactLaw, fireAdvisor, hireAdvisor, lawCost } from '../../game/politics';
import { describeCondition } from '../../game/describe';
import { formatDate } from '../../game/time';
import { Medal, Portrait } from '../components/art';
import { categoryColor } from '../../gfx/medallions';
import { Icon, Lines, ModLines, Panel, Section, Tip } from '../components/core';
import { store, ui, useGame } from '../store';

function IdeologyPie({ pop }: { pop: Record<IdeologyId, number> }) {
  let acc = 0;
  const r = 34;
  const segs = IDEOLOGY_IDS.filter((i) => pop[i] > 0.2).map((id) => {
    const start = acc;
    acc += pop[id] / 100;
    const a0 = start * Math.PI * 2 - Math.PI / 2;
    const a1 = acc * Math.PI * 2 - Math.PI / 2;
    const large = acc - start > 0.5 ? 1 : 0;
    const d =
      acc - start >= 0.999
        ? `M40 ${40 - r} A${r} ${r} 0 1 1 39.99 ${40 - r} Z`
        : `M40 40 L${40 + r * Math.cos(a0)} ${40 + r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${40 + r * Math.cos(a1)} ${40 + r * Math.sin(a1)} Z`;
    return { id, d };
  });
  return (
    <svg width={80} height={80} viewBox="0 0 80 80" aria-hidden>
      {segs.map((s) => (
        <path key={s.id} d={s.d} fill={IDEOLOGIES[s.id].color} stroke="#0d0f0e" strokeWidth={1.2} />
      ))}
      <circle cx={40} cy={40} r={12} fill="#161a17" />
    </svg>
  );
}

function AdvisorCard({ a, hired, onAction }: { a: AdvisorDef; hired: boolean; onAction: () => void }) {
  const state = useGame();
  const f = state.player!;
  const can = hired ? { ok: true } : canHireAdvisor(state, f, a.id);
  return (
    <Tip
      content={() => (
        <div>
          <h4>{a.name}</h4>
          <div className="tt-desc">{a.role} · {a.desc}</div>
          <ModLines mods={a.modifiers} />
          {!hired && (
            <>
              <div className="tt-sep" />
              <div>Coste: {advisorCost(state, f, a.id)} de poder político</div>
              {!can.ok && <div className="bad">{can.reason}</div>}
            </>
          )}
        </div>
      )}
      as="div"
      className={`advisor ${hired ? 'hired' : ''}`}
    >
      <Portrait p={a.portrait} size={44} />
      <div className="advisor-text">
        <strong>{a.name}</strong>
        <span className="dim">{a.role}</span>
      </div>
      <button className={`btn small ${hired ? 'danger' : ''}`} disabled={!can.ok} onClick={onAction}>
        {hired ? 'Cesar' : `${advisorCost(state, f, a.id)} PP`}
      </button>
    </Tip>
  );
}

export function PoliticsPanel() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const leader = LEADERS[c.leader];
  const ideo = IDEOLOGIES[c.ideology];
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [slotPick, setSlotPick] = useState<'politico' | 'militar' | null>(null);
  const political = c.advisors.filter((a) => ADVISOR_BY_ID[a]?.slot === 'politico');
  const military = c.advisors.filter((a) => ADVISOR_BY_ID[a]?.slot === 'militar');
  const options = availableAdvisors(state, f).filter((a) => !c.advisors.includes(a.id) && a.slot === slotPick);

  return (
    <Panel title="Gobierno" icon="Landmark" onClose={() => ui.set({ panel: null })}>
      <div className="leader-card">
        <Portrait p={leader.portrait} size={104} className="leader-portrait" />
        <div className="leader-info">
          <div className="label">{FACTIONS[f].government}</div>
          <h3 className="leader-name">{leader.name}</h3>
          <div className="dim">{leader.title}</div>
          <div className="traits">
            {leader.traits.map((t) => (
              <Tip key={t} content={<div><h4>{TRAITS[t].name}</h4><div className="tt-desc">{TRAITS[t].desc}</div><ModLines mods={TRAITS[t].modifiers} /></div>}>
                <span className="chip gold">{TRAITS[t].name}</span>
              </Tip>
            ))}
          </div>
          <p className="leader-bio">{leader.bio}</p>
        </div>
      </div>

      <Section title="Ideología">
        <div className="ideology">
          <Tip
            content={() => (
              <div>
                <h4>Apoyo popular</h4>
                {IDEOLOGY_IDS.map((i) => (
                  <div key={i} className="tt-row">
                    <span style={{ color: IDEOLOGIES[i].color }}>{IDEOLOGIES[i].name}</span>
                    <span className="num">{c.popularity[i].toFixed(1)} %</span>
                  </div>
                ))}
              </div>
            )}
          >
            <IdeologyPie pop={c.popularity} />
          </Tip>
          <div>
            <Tip content={<div><h4>{ideo.name}</h4><div className="tt-desc">{ideo.desc}</div><ModLines mods={ideo.modifiers} /></div>}>
              <div className="ideo-name" style={{ color: ideo.color }}>
                {ideo.name}
              </div>
            </Tip>
            <div className="ideo-legend">
              {IDEOLOGY_IDS.filter((i) => c.popularity[i] >= 3)
                .sort((a, b) => c.popularity[b] - c.popularity[a])
                .map((i) => (
                  <span key={i} className="ideo-item">
                    <i style={{ background: IDEOLOGIES[i].color }} />
                    {IDEOLOGIES[i].name} <span className="num">{Math.round(c.popularity[i])} %</span>
                  </span>
                ))}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Espíritus nacionales">
        <div className="spirits">
          {c.spirits.length === 0 && <div className="dim">Ninguno.</div>}
          {c.spirits.map((s) => {
            const sp = SPIRITS[s.id];
            if (!sp) return null;
            return (
              <Tip
                key={s.id}
                content={
                  <div>
                    <h4>{sp.name}</h4>
                    <div className="tt-desc">{sp.desc}</div>
                    <ModLines mods={sp.modifiers} />
                    {s.until && <div className="faint">Hasta el {formatDate(s.until)}</div>}
                  </div>
                }
              >
                <div className={`spirit ${sp.negative ? 'negative' : ''}`}>
                  <Medal icon={sp.icon} shape="square" color={sp.negative ? '#5e1f18' : categoryColor(sp.icon, '#4a5a3a')} metal={sp.negative ? 'iron' : 'brass'} size={48} />
                </div>
              </Tip>
            );
          })}
        </div>
      </Section>

      <Section title="Leyes">
        <div className="laws">
          {LAW_GROUPS.map((g) => {
            const current = LAWS[c.laws[g.id]];
            return (
              <div key={g.id} className="law-group">
                <button className="law-current" onClick={() => setOpenGroup(openGroup === g.id ? null : g.id)} aria-expanded={openGroup === g.id}>
                  <span className="label">{g.name}</span>
                  <span className="law-name">{current.name}</span>
                  <Icon name={openGroup === g.id ? 'ChevronUp' : 'ChevronDown'} size={16} />
                </button>
                {openGroup === g.id && (
                  <div className="law-options">
                    {lawsOfGroup(g.id).map((l) => {
                      const can = canEnactLaw(state, f, l.id);
                      const isCur = l.id === current.id;
                      return (
                        <Tip
                          key={l.id}
                          as="div"
                          content={() => (
                            <div>
                              <h4>{l.name}</h4>
                              <div className="tt-desc">{l.desc}</div>
                              <ModLines mods={l.modifiers} />
                              {l.available && (
                                <>
                                  <div className="tt-sub">Requisitos</div>
                                  <Lines lines={describeCondition(l.available, state, { root: f })} />
                                </>
                              )}
                              {!isCur && <div className="tt-sep" />}
                              {!isCur && <div>Coste: {lawCost(state, f, l.id)} de poder político</div>}
                              {!isCur && !can.ok && <div className="bad">{can.reason}</div>}
                            </div>
                          )}
                        >
                          <button
                            className={`law-option ${isCur ? 'current' : ''}`}
                            disabled={isCur || !can.ok}
                            onClick={() => {
                              store.act((s) => enactLaw(s, f, l.id));
                              setOpenGroup(null);
                            }}
                          >
                            <span>{l.name}</span>
                            <span className="num dim">{isCur ? 'En vigor' : `${lawCost(state, f, l.id)} PP`}</span>
                          </button>
                        </Tip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Asesores">
        <div className="label">Gabinete político ({political.length}/{POLITICAL_SLOTS})</div>
        <div className="advisors">
          {political.map((id) => (
            <AdvisorCard key={id} a={ADVISOR_BY_ID[id]} hired onAction={() => store.act((s) => fireAdvisor(s, f, id))} />
          ))}
          {political.length < POLITICAL_SLOTS && (
            <button className="btn small ghost add-slot" onClick={() => setSlotPick(slotPick === 'politico' ? null : 'politico')}>
              <Icon name="Plus" size={14} /> Nombrar asesor político
            </button>
          )}
        </div>
        <div className="label" style={{ marginTop: 10 }}>
          Alto mando ({military.length}/{MILITARY_SLOTS})
        </div>
        <div className="advisors">
          {military.map((id) => (
            <AdvisorCard key={id} a={ADVISOR_BY_ID[id]} hired onAction={() => store.act((s) => fireAdvisor(s, f, id))} />
          ))}
          {military.length < MILITARY_SLOTS && (
            <button className="btn small ghost add-slot" onClick={() => setSlotPick(slotPick === 'militar' ? null : 'militar')}>
              <Icon name="Plus" size={14} /> Nombrar mando militar
            </button>
          )}
        </div>
        {slotPick && (
          <div className="advisor-pick">
            <div className="label">Candidatos</div>
            {options.map((a) => (
              <AdvisorCard
                key={a.id}
                a={a}
                hired={false}
                onAction={() => {
                  store.act((s) => hireAdvisor(s, f, a.id));
                  setSlotPick(null);
                }}
              />
            ))}
            {options.length === 0 && <div className="dim">No hay candidatos disponibles.</div>}
          </div>
        )}
      </Section>
    </Panel>
  );
}
