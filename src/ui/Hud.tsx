// HUD de la partida: barra superior, escuadra, panel del personaje
// seleccionado, inspección, registro, menú contextual y ayudas en pantalla.

import { useEffect, useRef, useState } from 'react';
import { BUILDS } from '../data/edificios';
import { ITEMS, type EquipSlot } from '../data/items';
import { BODY_PARTS, SKILLS, SKILL_IDS, skillWord, type SkillId } from '../data/skills';
import type { FactionId } from '../data/tipos';
import { dropItem, hasLamp, unequipSlot, useItem } from '../sim/actions';
import { invWeight, maxCarry, totalHpFrac, weaponDef } from '../sim/chars';
import { hostile, relation } from '../sim/combat';
import { squadCap } from '../sim/events';
import type { Char, Stance } from '../sim/types';
import { Bar, ItemIcon, charTitle, hex, itemTip, sideColor, sideName, statusText, useGame, useTick, useTooltip } from './core';

export type Screen = 'construir' | 'investigar' | 'mapa' | 'facciones' | 'cronica' | 'pausa' | 'registro' | null;

export function TopBar({ open }: { open: (s: Screen) => void }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const speeds = [1, 2, 4, 8];
  return (
    <div className="topbar">
      <div className="place">{g.placeLabel || 'Metro de Vlianska'}</div>
      <div className="clock">
        Día {sim.day} · {sim.clockText()} · {sim.dateText()}
      </div>
      <div className="row speed">
        <button className={'btn' + (g.paused ? ' on' : '')} onClick={() => g.togglePause()} title="Pausa (Espacio)">
          ❚❚
        </button>
        {speeds.map((s, i) => (
          <button key={s} className={'btn' + (!g.paused && g.speed === s ? ' on' : '')} onClick={() => g.setSpeed(s)} title={`Velocidad ×${s} (${i + 1})`}>
            ×{s}
          </button>
        ))}
      </div>
      <div className="sp" />
      <div className="money" title="Cartuchos de grado militar: la moneda del metro">
        <span style={{ display: 'inline-block', width: 7, height: 15, background: 'linear-gradient(#f2d28a,#a8791e)', borderRadius: '3px 3px 1px 1px' }} />
        {sim.state.money}
      </div>
      <div className="dim" title="Tamaño de la escuadra">
        {sim.players.length}/{squadCap(sim)}
      </div>
      <button className="btn" onClick={() => open('construir')} title="Construir (B)">
        Construir
      </button>
      <button className="btn" onClick={() => open('investigar')} title="Investigación (I)">
        Estudio
      </button>
      <button className="btn" onClick={() => open('mapa')} title="Mapa del metro (M)">
        Mapa
      </button>
      <button className="btn" onClick={() => open('facciones')} title="Facciones (G)">
        Facciones
      </button>
      <button className="btn" onClick={() => open('cronica')} title="Crónica del metro (K)">
        Crónica
      </button>
      <button className="btn" onClick={() => open('pausa')} title="Menú (Esc)">
        ☰
      </button>
    </div>
  );
}

export function SquadBar() {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const sel = new Set(g.selected);
  const col = hex(sim.state.playerColor);
  const lastClick = useRef({ id: 0, t: 0 });
  const all = sim.state.chars.filter((c) => c.player);
  return (
    <div className="squad scroll">
      {all.map((c) => {
        const down = c.st !== 'ok';
        return (
          <div
            key={c.id}
            className={'member' + (sel.has(c.id) ? ' sel' : '') + (down ? ' down' : '')}
            onClick={(e) => {
              const now = performance.now();
              if (lastClick.current.id === c.id && now - lastClick.current.t < 350) g.focusOn(c.id);
              lastClick.current = { id: c.id, t: now };
              if (c.st !== 'muerto') g.select([c.id], e.shiftKey);
            }}
          >
            <div className="face" style={{ background: c.st === 'muerto' ? '#444' : col, opacity: down ? 0.6 : 1 }}>
              {c.name[0]}
            </div>
            <div className="grow">
              <div className="nm">{c.name}</div>
              <Bar v={totalHpFrac(c)} cls="thin" color={c.st === 'muerto' ? '#555' : undefined} />
              <div className="row" style={{ gap: 3, marginTop: 2 }}>
                <Bar v={c.blood / 100} cls="thin blood" style={{ flex: 1 }} />
                <Bar v={c.hunger / 100} cls="thin amber" style={{ flex: 1 }} />
              </div>
              <div className="st">{statusText(g, c)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STANCES: [Stance, string, string][] = [
  ['agresivo', 'Agresivo', 'Ataca a cualquier enemigo que vea'],
  ['defensivo', 'Defensivo', 'Solo se defiende y defiende a los suyos'],
  ['pasivo', 'Pasivo', 'No pelea salvo que se lo ordenes'],
];
const SLOTS: [EquipSlot, string][] = [
  ['arma', 'Arma'],
  ['cabeza', 'Cabeza'],
  ['cara', 'Cara'],
  ['torso', 'Torso'],
  ['mochila', 'Espalda'],
  ['luz', 'Luz'],
];

export function SelectionPanel() {
  const g = useGame();
  useTick();
  const [tab, setTab] = useState<'inv' | 'skills' | 'jobs'>('inv');
  const tip = useTooltip();
  const sim = g.sim;
  const chars = g.selected.map((id) => sim.char(id)).filter((c): c is Char => !!c);
  const c = chars[0];
  if (!c) return null;
  const many = chars.length > 1;
  const setAll = (fn: (c: Char) => void) => {
    chars.forEach(fn);
    g.bump();
  };
  const w = weaponDef(c);
  const weight = invWeight(c);
  const cap = maxCarry(c);
  return (
    <div className="panel selpanel">
      <div className="selhead">
        <span className="name">{c.name}</span>
        <span className="dim">{many ? `y ${chars.length - 1} más` : charTitle(c)}</span>
        <span className="sp" />
        <span className={c.st !== 'ok' ? 'bad' : 'dim'}>{statusText(g, c)}</span>
      </div>
      <div className="tabs">
        <button className={'tab' + (tab === 'inv' ? ' on' : '')} onClick={() => setTab('inv')}>
          Equipo
        </button>
        <button className={'tab' + (tab === 'skills' ? ' on' : '')} onClick={() => setTab('skills')}>
          Habilidades
        </button>
        <button className={'tab' + (tab === 'jobs' ? ' on' : '')} onClick={() => setTab('jobs')}>
          Trabajos {c.jobs.length ? `(${c.jobs.length})` : ''}
        </button>
      </div>
      <div className="selbody">
        <div className="vitals">
          {BODY_PARTS.map((name, i) => (
            <div className="part" key={i} title={c.wound[i] > 0.8 ? 'Herida abierta: sangra hasta que se vende' : ''}>
              <span className={c.wound[i] > 0.8 ? 'bad' : c.hp[i] <= 0 ? 'bad' : ''}>{name}</span>
              <Bar v={c.hp[i] / c.hpMax[i]} color={c.hp[i] <= 0 ? '#7a1a14' : c.hp[i] < c.hpMax[i] * 0.4 ? '#d98a2a' : undefined} />
            </div>
          ))}
          <div className="part" style={{ marginTop: 4 }}>
            <span>Sangre</span>
            <Bar v={c.blood / 100} cls="blood" />
          </div>
          <div className="part">
            <span>Hambre</span>
            <Bar v={c.hunger / 100} cls="amber" />
          </div>
          <div className="part">
            <span className={weight > cap ? 'bad' : ''}>Carga</span>
            <Bar v={weight / cap} color={weight > cap ? '#e0624f' : '#8d8a80'} />
          </div>
        </div>
        <div className="grow col" style={{ gap: 0, minHeight: 0 }}>
          <div className="grow scroll">
            {tab === 'inv' && (
              <>
                <div className="inv" style={{ gridTemplateColumns: 'repeat(6, 1fr)', paddingBottom: 2 }}>
                  {SLOTS.map(([slot, label]) => {
                    const s = c.eq[slot];
                    return (
                      <div
                        key={slot}
                        className={'slot eq' + (s ? '' : ' empty')}
                        {...(s ? tip.bind(itemTip(s) + '\nClic: quitar') : tip.bind(label))}
                        onClick={() => {
                          if (s) {
                            unequipSlot(sim, c, slot);
                            tip.clear();
                            g.bump();
                          }
                        }}
                      >
                        {s ? <ItemIcon id={s.id} size={30} /> : null}
                        <span className="lbl">{label}</span>
                        {s?.mag !== undefined && <span className="n">{s.mag}</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="inv">
                  {c.inv.map((s, i) => (
                    <div
                      key={i + s.id}
                      className="slot"
                      {...tip.bind(itemTip(s) + '\nClic: usar o equipar · Mayús+clic: soltar')}
                      onClick={(e) => {
                        if (e.shiftKey) dropItem(sim, c, i, e.ctrlKey ? s.n : 1);
                        else useItem(sim, c, i);
                        tip.clear();
                        g.bump();
                      }}
                    >
                      <ItemIcon id={s.id} size={30} />
                      {s.n > 1 && <span className="n">{s.n}</span>}
                      {s.hot && s.hot !== 'acarreo' && <span className="tag">●</span>}
                    </div>
                  ))}
                  {c.inv.length === 0 && <div className="dim" style={{ gridColumn: '1 / -1', padding: 6 }}>No lleva nada.</div>}
                </div>
              </>
            )}
            {tab === 'skills' && <SkillList c={c} />}
            {tab === 'jobs' && (
              <div className="col" style={{ padding: 8, gap: 4 }}>
                {c.jobs.length === 0 && (
                  <div className="dim" style={{ lineHeight: 1.4 }}>
                    Sin trabajos fijos. Haz clic derecho en una obra, un taller, un cultivo o un montón de chatarra y elige «Asignar como trabajo fijo». También puedes marcar tareas generales:
                  </div>
                )}
                {c.jobs.map((j, i) => {
                  const b = j.id ? sim.state.buildings.find((x) => x.id === j.id) : null;
                  const label = j.t === 'construir' ? 'Construir obras' : j.t === 'acarrear' ? 'Acarrear al almacén' : j.t === 'chatarrear' ? 'Desguazar chatarra' : b ? `${j.t === 'cultivar' ? 'Cultivar' : j.t === 'investigar' ? 'Investigar' : 'Trabajar'}: ${BUILDS[b.def].name}` : j.t;
                  return (
                    <div className="row" key={i}>
                      <span className="amber" style={{ fontFamily: 'var(--mono)', width: 18 }}>{i + 1}.</span>
                      <span className="grow">{label}</span>
                      <button
                        className="btn small"
                        onClick={() => {
                          c.jobs.splice(i, 1);
                          g.bump();
                        }}
                      >
                        Quitar
                      </button>
                    </div>
                  );
                })}
                <div className="row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
                  {(['construir', 'acarrear'] as const).map((t) => (
                    <button
                      key={t}
                      className={'btn small' + (c.jobs.some((j) => j.t === t) ? ' on' : '')}
                      onClick={() =>
                        setAll((q) => {
                          const k = q.jobs.findIndex((j) => j.t === t);
                          if (k >= 0) q.jobs.splice(k, 1);
                          else q.jobs.unshift({ t });
                        })
                      }
                    >
                      {t === 'construir' ? 'Construir obras' : 'Acarrear'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="toggles">
            {STANCES.map(([id, label, t]) => (
              <button key={id} className={'btn small' + (c.stance === id ? ' on' : '')} title={t} onClick={() => setAll((q) => (q.stance = id))}>
                {label}
              </button>
            ))}
            <span className="sp" />
            <button className={'btn small' + (c.lamp ? ' on' : '')} disabled={!hasLamp(c)} title="Linterna (L): ves mejor, pero te ven desde lejos" onClick={() => setAll((q) => (q.lamp = hasLamp(q) ? !c.lamp : false))}>
              Luz
            </button>
            <button className={'btn small' + (c.sneak ? ' on' : '')} title="Sigilo (C): lento y difícil de ver, sobre todo a oscuras" onClick={() => setAll((q) => (q.sneak = !c.sneak))}>
              Sigilo
            </button>
            <button className={'btn small' + (c.hold ? ' on' : '')} title="Mantener posición (H)" onClick={() => setAll((q) => (q.hold = !c.hold))}>
              Quieto
            </button>
            <button className={'btn small' + (c.autoHeal ? ' on' : '')} title="Cura a los compañeros heridos cuando no tiene órdenes" onClick={() => setAll((q) => (q.autoHeal = !c.autoHeal))}>
              Médico
            </button>
          </div>
        </div>
      </div>
      {w && false}
      {tip.node}
    </div>
  );
}

function SkillList({ c }: { c: Char }) {
  const groups = ['Atributos', 'Combate', 'Supervivencia', 'Oficios'];
  return (
    <div style={{ columns: 2, columnGap: 0, padding: '2px 0 6px' }}>
      {groups.map((grp) => (
        <div key={grp} style={{ breakInside: 'avoid' }}>
          <div className="grp">{grp}</div>
          {SKILL_IDS.filter((k) => SKILLS[k].group === grp).map((k: SkillId) => (
            <div className="skill" key={k} title={`${SKILLS[k].desc} (${skillWord(c.sk[k])})`}>
              <span>{SKILLS[k].name}</span>
              <b>{Math.floor(c.sk[k])}</b>
              <Bar v={c.sk[k] % 1} cls="thin amber" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function InspectPanel() {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const id = g.inspect || (g.hover?.kind === 'char' ? g.hover.id : 0);
  const c = id ? sim.char(id) : null;
  if (!c || c.player) return null;
  const first = sim.players[0];
  const hs = first ? hostile(sim, first, c) : false;
  const rel = c.side !== 'MUT' && c.side !== 'LIB' && c.side !== 'JUG' ? relation(sim, 'JUG', c.side) : null;
  const w = weaponDef(c);
  const wname = c.eq.arma ? ITEMS[c.eq.arma.id].name : c.kind === 'humano' ? 'Desarmado' : '';
  return (
    <div className="panel inspect">
      <h3>{c.name}</h3>
      <div className="row" style={{ marginBottom: 5 }}>
        <span style={{ width: 10, height: 10, background: sideColor(c.side, sim.state.playerColor), display: 'inline-block', border: '1px solid #000' }} />
        <span>{sideName(c.side, sim.state.playerName)}</span>
        <span className="dim">· {charTitle(c)}</span>
      </div>
      <Bar v={totalHpFrac(c)} color={hs ? '#e0624f' : undefined} />
      <div className="dim" style={{ margin: '5px 0 2px' }}>
        {c.st === 'muerto' ? 'Muerto' : c.st === 'ko' ? 'Inconsciente' : hs ? 'Hostil' : rel !== null ? (rel > 30 ? 'Amistoso' : rel < -20 ? 'Receloso' : 'Neutral') : 'Neutral'}
        {wname ? ` · ${wname}` : ''}
        {w?.ranged ? ' (arma de fuego)' : ''}
      </div>
      {c.kind === 'humano' && (
        <div className="dim">
          Combate {Math.floor((c.sk.ataque + c.sk.defensa) / 2)} · Puntería {Math.floor(c.sk.punteria)}
        </div>
      )}
      {c.bio && <div style={{ marginTop: 6, lineHeight: 1.35 }}>{c.bio}</div>}
      {c.hire && <div className="amber" style={{ marginTop: 5 }}>Se contrata por {c.hire} cartuchos.</div>}
      {c.vendor && <div className="amber" style={{ marginTop: 5 }}>Comercia. Clic derecho para hablar.</div>}
    </div>
  );
}

export function LogView() {
  const g = useGame();
  useTick();
  const now = g.sim.state.time;
  const recent = g.sim.state.log.filter((l) => now - l.t < (l.kind === 'historia' ? 60 : 22)).slice(-5);
  return (
    <div className="log">
      {recent.reverse().map((l) => (
        <div key={l.t + l.msg} className={'logline ' + l.kind}>
          {l.msg}
        </div>
      ))}
    </div>
  );
}

export function ContextMenuView() {
  const g = useGame();
  useTick();
  const m = g.menu;
  if (!m) return null;
  const x = Math.min(m.x, window.innerWidth - 200);
  const y = Math.min(m.y, window.innerHeight - 40 - m.actions.length * 32);
  return (
    <div className="panel ctx" style={{ left: x, top: y }}>
      <div className="ttl">{m.title}</div>
      {m.actions.map((a, i) => (
        <button
          key={i}
          className={a.danger ? 'danger' : ''}
          onClick={() => {
            a.run();
            g.menu = null;
            g.bump();
          }}
        >
          {a.label}
          {a.hint && <small>{a.hint}</small>}
        </button>
      ))}
    </div>
  );
}

/** Rectángulo de selección, textos flotantes y avisos de modo. */
export function Overlays() {
  const g = useGame();
  useTick();
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (g.fx.floats.length) force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [g]);
  const b = g.box;
  const def = g.buildDef ? BUILDS[g.buildDef] : null;
  return (
    <>
      {b && <div className="boxsel" style={{ left: Math.min(b.x0, b.x1), top: Math.min(b.y0, b.y1), width: Math.abs(b.x1 - b.x0), height: Math.abs(b.y1 - b.y0) }} />}
      {g.fx.floats.map((f, i) => {
        const p = g.project(f.x, f.y + f.t * 0.6, f.z);
        if (!p.ok) return null;
        return (
          <div key={i} className="float" style={{ left: p.x, top: p.y, color: f.color, opacity: Math.min(1, 2.2 - f.t) }}>
            {f.text}
          </div>
        );
      })}
      {g.paused && !g.panel && <div className="paused-tag pass">PAUSA</div>}
      {def && (
        <div className="panel hint">
          <b className="amber">{def.name}</b> · clic para colocar · <kbd>R</kbd> girar · <kbd>Mayús</kbd> colocar varias · clic derecho o <kbd>Esc</kbd> para cancelar
          {g.buildWhy && <span className="bad"> · {g.buildWhy}</span>}
        </div>
      )}
    </>
  );
}

export function repWord(v: number): string {
  if (v <= -50) return 'Enemigos';
  if (v <= -20) return 'Hostiles';
  if (v < 20) return 'Indiferentes';
  if (v < 50) return 'Cordiales';
  return 'Aliados';
}

export type { FactionId };
