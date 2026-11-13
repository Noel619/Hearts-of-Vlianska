// HUD de la partida: barra superior, escuadra, panel del personaje
// seleccionado, inspección, registro, menú contextual y ayudas en pantalla.

import { useEffect, useRef, useState } from 'react';
import { BUILDS, RECIPES } from '../data/edificios';
import { propThumb } from '../render/thumbs';
import { FILTER_LIFE, GAS_DENSE } from '../data/gases';
import { ITEMS, type EquipSlot } from '../data/items';
import { BODY_PARTS, SKILLS, SKILL_IDS, skillWord, type SkillId } from '../data/skills';
import type { FactionId } from '../data/tipos';
import { dropItem, hasLamp, unequipSlot, useItem } from '../sim/actions';
import { armorBulk, BULK_WEIGHT, invWeight, maxCarry, NAME_MAX, totalHpFrac, weaponDef } from '../sim/chars';
import { hostile, relation } from '../sim/combat';
import { nameError, renameChar, squadCap } from '../sim/events';
import { filterMask, spareFilters } from '../sim/gas';
import { firstSteps } from '../sim/hilos';
import type { Char, Stance } from '../sim/types';
import { Bar, BodyDoll, Face, ItemIcon, Money, charTitle, hex, itemTip, sideName, statusBad, statusIcon, statusText, useGame, useTick, useTooltip } from './core';
import { Emblem } from './sprites/Emblem';
import { Icon, ItemSprite } from './sprites/Sprite';

export type Screen = 'construir' | 'investigar' | 'mapa' | 'facciones' | 'cronica' | 'hilos' | 'pausa' | 'registro' | null;

const SPEEDS: [number, string][] = [
  [1, 'play'],
  [2, 'rapido'],
  [4, 'rapido2'],
  [8, 'rapido3'],
];
const KEYS: [Screen, string, string, string][] = [
  ['construir', 'construir', 'Construir', 'B'],
  ['investigar', 'estudio', 'Estudio', 'I'],
  ['mapa', 'mapa', 'Mapa', 'M'],
  ['facciones', 'facciones', 'Facciones', 'G'],
  ['hilos', 'estrella', 'Hilos', 'J'],
  ['cronica', 'cronica', 'Crónica', 'K'],
  ['pausa', 'menu', 'Menú', 'Esc'],
];

export function TopBar({ open }: { open: (s: Screen) => void }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  return (
    <div className="topbar">
      <div className="plaque" title={g.gasHere ? `${g.gasHere.def.name}: ${g.gasHere.def.desc}` : 'Dónde está la cámara'}>
        <Emblem side="JUG" size={34} playerColor={hex(sim.state.playerColor)} />
        <div>
          {g.gasHere ? (
            <small className="gaswarn">
              <Icon id="gas" size={11} /> {g.gasHere.def.peak > GAS_DENSE ? 'Gas denso' : 'Gas ligero'}
            </small>
          ) : (
            <small>Metro de Vlianska</small>
          )}
          <b>{g.placeLabel || 'Túneles'}</b>
        </div>
      </div>
      <div className="clockbox" title={sim.dateText()}>
        <span className="day">
          Día <b>{sim.day}</b>
        </span>
        <span className="time">{sim.clockText()}</span>
        <span className="date">{sim.dateText()}</span>
      </div>
      <div className="speed">
        <button className={'key' + (g.paused ? ' on' : '')} onClick={() => g.togglePause()} title="Pausa (Espacio)">
          <Icon id="pausa" size={15} />
        </button>
        {SPEEDS.map(([sp, icon], i) => (
          <button key={sp} className={'key' + (!g.paused && g.speed === sp ? ' on' : '')} onClick={() => g.setSpeed(sp)} title={`Velocidad ×${sp} (${i + 1})`}>
            <Icon id={icon} size={15} />
          </button>
        ))}
      </div>
      <div className="sp" />
      <div className="counter" title="Cartuchos de grado militar: la moneda del metro">
        <Money n={sim.state.money} size={24} />
      </div>
      <div className="counter" title="Tamaño de la escuadra">
        <Icon id="escuadra" size={17} />
        {sim.players.length}
        <i>/{squadCap(sim)}</i>
      </div>
      <div className="keys">
        {KEYS.map(([scr, icon, label, k]) => (
          <button key={label} className="key tall" onClick={() => open(scr)} title={`${label} (${k})`}>
            <Icon id={icon} size={19} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SquadBar() {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const sel = new Set(g.selected);
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
            <Face c={c} size={46} playerColor={sim.state.playerColor} />
            <div className="grow">
              <div className="nm">{c.name}</div>
              <Bar v={totalHpFrac(c)} cls="thin" color={c.st === 'muerto' ? '#555' : undefined} />
              <div className="row" style={{ gap: 3, marginTop: 2 }}>
                <Bar v={c.blood / 100} cls="thin blood" style={{ flex: 1 }} />
                <Bar v={c.hunger / 100} cls="thin amber" style={{ flex: 1 }} />
              </div>
              <div className={'st' + (statusBad(c) ? ' bad' : '')}>
                <Icon id={statusIcon(c)} size={11} />
                {statusText(g, c)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const STANCES: [Stance, string, string, string][] = [
  ['agresivo', 'Agresivo', 'Ataca a cualquier enemigo que vea', 'agresivo'],
  ['defensivo', 'Defensivo', 'Solo se defiende y defiende a los suyos', 'defensivo'],
  ['pasivo', 'Pasivo', 'No pelea salvo que se lo ordenes', 'pasivo'],
];
/** Huecos de equipo: nombre y sprite fantasma que se ve cuando está vacío. */
const SLOTS: [EquipSlot, string, string][] = [
  ['arma', 'Arma', 'ak'],
  ['cabeza', 'Cabeza', 'casco'],
  ['cara', 'Cara', 'mascaraGas'],
  ['torso', 'Torso', 'chaleco'],
  ['mochila', 'Espalda', 'mochila'],
  ['luz', 'Luz', 'linterna'],
];

export function SelectionPanel() {
  const g = useGame();
  useTick();
  const [tab, setTab] = useState<'inv' | 'skills' | 'jobs'>('inv');
  const [editing, setEditing] = useState(false);
  const tip = useTooltip();
  const sim = g.sim;
  const chars = g.selected.map((id) => sim.char(id)).filter((c): c is Char => !!c);
  const c = chars[0];
  const firstId = c?.id ?? 0;
  useEffect(() => setEditing(false), [firstId]);
  if (!c) return null;
  const many = chars.length > 1;
  const setAll = (fn: (c: Char) => void) => {
    chars.forEach(fn);
    g.bump();
  };
  const weight = invWeight(c);
  const cap = maxCarry(c);
  const w = weaponDef(c);
  const bulk = armorBulk(c);
  const bulkPct = Math.round(bulk * BULK_WEIGHT * 100);
  const mask = filterMask(c);
  const filFrac = mask ? (mask.fil ?? 0) / FILTER_LIFE : 0;
  const spares = mask ? spareFilters(sim, c) : 0;
  return (
    <div className="panel selpanel">
      <div className="selhead">
        <Face c={c} size={58} playerColor={sim.state.playerColor} />
        <div className="grow" style={{ minWidth: 0 }}>
          {editing && !many ? (
            <NameEdit key={c.id} c={c} done={() => setEditing(false)} />
          ) : (
            <div className="namerow">
              <div className="name" title={many ? undefined : 'Doble clic para cambiarle el nombre'} onDoubleClick={() => !many && setEditing(true)}>
                {c.name}
              </div>
              {!many && (
                <button className="key mini" title="Cambiar el nombre" onClick={() => setEditing(true)}>
                  <Icon id="editar" size={12} />
                </button>
              )}
            </div>
          )}
          <div className="sub">
            {many ? `y ${chars.length - 1} más seleccionados` : charTitle(c) || 'Superviviente'}
            {w ? ` · ${c.eq.arma ? ITEMS[c.eq.arma.id].name : ''}` : ''}
          </div>
        </div>
        <span className={'chipst' + (statusBad(c) ? ' bad' : '')}>
          <Icon id={statusIcon(c)} size={13} />
          {statusText(g, c)}
        </span>
        {!many && (
          <button
            className="key mini"
            title="Despedir de la escuadra…"
            onClick={() => {
              g.panel = { t: 'despedir', id: c.id };
              g.paused = true;
              g.bump();
            }}
          >
            <Icon id="salir" size={13} />
          </button>
        )}
      </div>
      <div className="tabs">
        <button className={'tab' + (tab === 'inv' ? ' on' : '')} onClick={() => setTab('inv')}>
          <Icon id="equipo" size={13} /> Equipo
        </button>
        <button className={'tab' + (tab === 'skills' ? ' on' : '')} onClick={() => setTab('skills')}>
          <Icon id="habilidades" size={13} /> Habilidades
        </button>
        <button className={'tab' + (tab === 'jobs' ? ' on' : '')} onClick={() => setTab('jobs')}>
          <Icon id="trabajos" size={13} /> Trabajos {c.jobs.length ? `(${c.jobs.length})` : ''}
        </button>
      </div>
      <div className="selbody">
        <div className="vitals">
          <BodyDoll c={c} size={116} names={BODY_PARTS} />
          <div className="meters">
            <div className="meter" title={`Salud: ${Math.round(totalHpFrac(c) * 100)} %`}>
              <Icon id="corazon" size={13} />
              <Bar v={totalHpFrac(c)} />
            </div>
            <div className="meter" title={`Sangre: ${Math.round(c.blood)} %${c.bleed > 0.05 ? ' · sangrando' : ''}`}>
              <Icon id="sangre" size={13} className={c.bleed > 0.05 ? 'bad' : ''} />
              <Bar v={c.blood / 100} cls="blood" />
            </div>
            <div className="meter" title={`Hambre: ${Math.round(c.hunger)} %`}>
              <Icon id="hambre" size={13} />
              <Bar v={c.hunger / 100} cls="amber" />
            </div>
            <div className="meter" title={`Carga: ${weight.toFixed(1)} de ${cap.toFixed(0)} kg`}>
              <Icon id="carga" size={13} className={weight > cap ? 'bad' : ''} />
              <Bar v={weight / cap} color={weight > cap ? '#e0624f' : '#9a968a'} />
            </div>
            {mask && (
              <div className="meter" title={`Filtro de la máscara: ${Math.ceil(filFrac * 100)} % · ${spares === 1 ? 'un filtro' : `${spares} filtros`} de repuesto${spares ? '' : ': cuando se gaste, el gas pasará'}`}>
                <Icon id="gas" size={13} className={c.gas > 0.05 ? 'bad' : ''} />
                <Bar v={filFrac} color={filFrac > 0.25 ? '#9fbf5a' : '#e0624f'} />
              </div>
            )}
            <div className="kg">
              {weight.toFixed(0)}/{cap.toFixed(0)} kg
            </div>
            {bulk > 0 && (
              <div className="kg" title={`El equipo puesto estorba: en sigilo te ven desde un ${bulkPct} % más lejos y avanzas más despacio, y sin arma esquivas un ${bulkPct} % peor`}>
                estorbo −{bulkPct} %
              </div>
            )}
          </div>
        </div>
        <div className="grow col" style={{ gap: 0, minHeight: 0 }}>
          <div className="grow scroll">
            {tab === 'inv' && (
              <>
                <div className="eqrow">
                  {SLOTS.map(([slot, label, ghost]) => {
                    const st = c.eq[slot];
                    return (
                      <div
                        key={slot}
                        className={'slot eq' + (st ? ' k-' + (ITEMS[st.id]?.kind ?? 'varios') : ' empty')}
                        {...(st ? tip.bind(itemTip(st) + '\nClic: quitar', st.id) : tip.bind(`${label}: vacío`))}
                        onClick={() => {
                          if (st) {
                            unequipSlot(sim, c, slot);
                            tip.clear();
                            g.bump();
                          }
                        }}
                      >
                        <ItemSprite id={st ? st.id : ghost} size={40} className={st ? '' : 'ghost'} />
                        <span className="lbl">{label}</span>
                        {st?.mag !== undefined && <span className="n">{st.mag}</span>}
                        {st && ITEMS[st.id]?.armor?.filter && <span className={'n' + ((st.fil ?? 0) > 0 ? '' : ' bad')}>{(st.fil ?? 0) > 0 ? `${Math.ceil(((st.fil ?? 0) / FILTER_LIFE) * 100)}%` : '0%'}</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="inv">
                  {c.inv.map((st, i) => (
                    <div
                      key={i + st.id}
                      className={'slot k-' + (ITEMS[st.id]?.kind ?? 'varios')}
                      {...tip.bind(itemTip(st) + '\nClic: usar o equipar · Mayús+clic: soltar', st.id)}
                      onClick={(e) => {
                        if (e.shiftKey) dropItem(sim, c, i, e.ctrlKey ? st.n : 1);
                        else {
                          const why = useItem(sim, c, i);
                          if (why) sim.emit({ t: 'flota', x: c.x, z: c.z, text: why, color: '#d8a060' });
                        }
                        tip.clear();
                        g.bump();
                      }}
                    >
                      <ItemSprite id={st.id} size={38} />
                      {st.n > 1 && <span className="n">{st.n}</span>}
                      {st.hot && st.hot !== 'acarreo' && <span className="tag" title="Robado" />}
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
                    <div className="jobrow" key={i}>
                      <span className="num">{i + 1}</span>
                      <Icon id={j.t === 'construir' ? 'construir' : j.t === 'acarrear' ? 'caja' : j.t === 'chatarrear' ? 'trabajos' : 'trabajar'} size={14} />
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
                      <Icon id={t === 'construir' ? 'construir' : 'caja'} size={12} /> {t === 'construir' ? 'Construir obras' : 'Acarrear'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="toggles">
            <div className="seg">
              {STANCES.map(([id, label, t, icon]) => (
                <button key={id} className={'key' + (c.stance === id ? ' on' : '')} title={`${label}: ${t}`} onClick={() => setAll((q) => (q.stance = id))}>
                  <Icon id={icon} size={16} />
                </button>
              ))}
            </div>
            <span className="stance">{STANCES.find((x) => x[0] === c.stance)?.[1]}</span>
            <span className="sp" />
            <button className={'key' + (c.lamp ? ' on' : '')} disabled={!hasLamp(c)} title="Linterna (L): ves mejor, pero te ven desde lejos" onClick={() => setAll((q) => (q.lamp = hasLamp(q) ? !c.lamp : false))}>
              <Icon id="luz" size={16} />
            </button>
            <button className={'key' + (c.sneak ? ' on' : '')} title="Sigilo (C): lento y difícil de ver, sobre todo a oscuras" onClick={() => setAll((q) => (q.sneak = !c.sneak))}>
              <Icon id="sigilo" size={16} />
            </button>
            <button className={'key' + (c.hold ? ' on' : '')} title="Mantener posición (H)" onClick={() => setAll((q) => (q.hold = !c.hold))}>
              <Icon id="quieto" size={16} />
            </button>
            <button className={'key' + (c.autoHeal ? ' on' : '')} title="Médico: cura a los compañeros heridos cuando no tiene órdenes" onClick={() => setAll((q) => (q.autoHeal = !c.autoHeal))}>
              <Icon id="medico" size={16} />
            </button>
          </div>
        </div>
      </div>
      {tip.node}
    </div>
  );
}

/** Campo para cambiar el nombre: Intro acepta, Esc o un nombre vacío lo dejan como estaba. */
function NameEdit({ c, done }: { c: Char; done: () => void }) {
  const g = useGame();
  const [v, setV] = useState(c.name);
  const [err, setErr] = useState('');
  const finished = useRef(false);
  const finish = (save: boolean) => {
    if (finished.current) return;
    if (save) {
      const e = renameChar(c, v);
      if (e) {
        setErr(e);
        return;
      }
      g.bump();
    }
    finished.current = true;
    done();
  };
  return (
    <div className="namerow">
      <input
        className={'txt nameedit' + (err ? ' bad' : '')}
        autoFocus
        value={v}
        maxLength={NAME_MAX}
        aria-label="Nombre"
        title={err || 'Intro para aceptar · Esc para dejarlo como estaba'}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setV(e.target.value);
          setErr('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true);
          else if (e.key === 'Escape') {
            e.stopPropagation();
            finish(false);
          }
        }}
        onBlur={() => finish(!nameError(v))}
      />
      {err && <span className="bad small">{err}</span>}
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
  const wname = c.eq.arma ? ITEMS[c.eq.arma.id].name : c.kind === 'humano' ? 'Desarmado' : '';
  const mood = c.st === 'muerto' ? 'Muerto' : c.st === 'ko' ? 'Inconsciente' : hs ? 'Hostil' : rel !== null ? (rel > 30 ? 'Amistoso' : rel < -20 ? 'Receloso' : 'Neutral') : 'Neutral';
  return (
    <div className="panel inspect">
      <div className="row" style={{ gap: 9, alignItems: 'flex-start' }}>
        <Face c={c} size={62} playerColor={sim.state.playerColor} />
        <div className="grow">
          <h3>{c.name}</h3>
          <div className="row side">
            <Emblem side={c.side} size={18} playerColor={hex(sim.state.playerColor)} />
            <span>{sideName(c.side, sim.state.playerName)}</span>
          </div>
          <div className="dim">{charTitle(c)}</div>
        </div>
      </div>
      <Bar v={totalHpFrac(c)} color={hs ? '#e0624f' : undefined} style={{ margin: '8px 0 6px' }} />
      <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
        <span className={'chipst' + (hs || c.st !== 'ok' ? ' bad' : '')}>
          <Icon id={c.st === 'muerto' ? 'calavera' : c.st === 'ko' ? 'ko' : hs ? 'agresivo' : 'ojo'} size={12} />
          {mood}
        </span>
        {wname && (
          <span className="chipst">
            {c.eq.arma ? <ItemSprite id={c.eq.arma.id} size={18} /> : <Icon id="pasivo" size={12} />}
            {wname}
          </span>
        )}
      </div>
      {c.kind === 'humano' && (
        <div className="dim" style={{ marginTop: 5 }}>
          Combate {Math.floor((c.sk.ataque + c.sk.defensa) / 2)} · Puntería {Math.floor(c.sk.punteria)}
        </div>
      )}
      {c.bio && <div style={{ marginTop: 6, lineHeight: 1.35 }}>{c.bio}</div>}
      {c.hire && (
        <div className="amber row" style={{ marginTop: 5 }}>
          Se contrata por <Money n={c.hire} />
        </div>
      )}
      {c.vendor && (
        <div className="amber row" style={{ marginTop: 5 }}>
          <Icon id="comerciar" size={14} /> Comercia. Clic derecho para hablar.
        </div>
      )}
    </div>
  );
}

/** Ficha de lo que hay bajo el ratón cuando no es una persona: obra, almacén, bulto o veta. */
export function ThingPanel() {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const h = g.hover;
  if (!h || h.kind === 'char' || h.kind === 'ground' || g.inspect || g.panel || g.buildDef) return null;
  const stacks = (items: { id: string; n: number }[], max = 12) => (
    <div className="stacks">
      {items.slice(0, max).map((st, i) => (
        <span key={i + st.id} className="chip" title={ITEMS[st.id]?.name}>
          <ItemSprite id={st.id} size={24} />
          {st.n > 1 ? st.n : ''}
        </span>
      ))}
      {items.length > max && <span className="dim">+{items.length - max}</span>}
    </div>
  );
  if (h.kind === 'build') {
    const b = sim.state.buildings.find((x) => x.id === h.id);
    if (!b) return null;
    const def = BUILDS[b.def];
    const thumb = propThumb(g.gfx.renderer, def.prop, def.variant ?? 0);
    const missing = def.cost.map(([id, n]) => [id, n - (b.got.find((q) => q.id === id)?.n ?? 0)] as [string, number]).filter(([, n]) => n > 0);
    const rec = b.recipe ? RECIPES[b.recipe] : null;
    return (
      <div className="panel inspect">
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <span className="thumb sm">{thumb && <img src={thumb} alt="" draggable={false} />}</span>
          <div className="grow">
            <h3>{def.name}</h3>
            <div className="dim" style={{ lineHeight: 1.3 }}>
              {def.desc}
            </div>
          </div>
        </div>
        {b.prog < 1 ? (
          <>
            <div className="meter" style={{ margin: '8px 0 5px' }}>
              <Icon id="construir" size={13} />
              <Bar v={b.prog} cls="amber" />
              <span className="amber">{Math.round(b.prog * 100)} %</span>
            </div>
            {missing.length > 0 && (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <span className="bad">Falta:</span>
                {missing.map(([id, n]) => (
                  <span key={id} className="chip no" title={ITEMS[id]?.name}>
                    <ItemSprite id={id} size={20} />
                    {n}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="meter" style={{ margin: '8px 0 5px' }} title="Estado de la estructura">
              <Icon id="defensivo" size={13} />
              <Bar v={b.hp / def.hp} />
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>
              {def.beds ? (
                <span className="chipst">
                  <Icon id="cama" size={12} /> {def.beds} {def.beds === 1 ? 'cama' : 'camas'}
                </span>
              ) : null}
              {def.power && def.power > 0 ? (
                <span className={'chipst' + (b.on ? '' : ' bad')}>
                  <Icon id="energia" size={12} /> {b.on ? `Consume ${def.power}` : 'Sin energía'}
                </span>
              ) : null}
              {def.power && def.power < 0 ? (
                <span className={'chipst' + (b.on ? '' : ' bad')}>
                  <Icon id="energia" size={12} /> {b.on ? `Da ${-def.power} de energía` : 'Parado: sin combustible'}
                </span>
              ) : null}
              {def.farm && (
                <span className="chipst">
                  <Icon id="hambre" size={12} /> Cosecha {Math.round(b.grow * 100)} %
                </span>
              )}
              {def.radio && (
                <span className="chipst">
                  <Icon id="ojo" size={12} /> {sim.state.flags.senal ? 'Señal captada' : `Barrido de frecuencias ${Math.round(b.craft * 100)} %`}
                </span>
              )}
            </div>
            {rec && (
              <div className="meter" style={{ marginTop: 6 }}>
                <ItemSprite id={rec.out[0]} size={22} />
                <Bar v={b.craft} cls="amber" />
                <span className="dim">{rec.name}</span>
              </div>
            )}
            {b.store.length > 0 && stacks(b.store)}
          </>
        )}
      </div>
    );
  }
  if (h.kind === 'cont') {
    const c = sim.container(h.id);
    if (!c) return null;
    return (
      <div className="panel inspect">
        <div className="row" style={{ gap: 10 }}>
          <span className="face">
            <Icon id={c.lock > 0 && !c.opened ? 'candado' : 'abrir'} size={26} />
          </span>
          <div className="grow">
            <h3>{c.label}</h3>
            {c.owner && c.owner !== 'JUG' ? (
              <div className="row side">
                <Emblem side={c.owner} size={18} />
                <span className="bad">Tiene dueño: abrirlo es robar</span>
              </div>
            ) : (
              <div className="dim">Sin dueño</div>
            )}
          </div>
        </div>
        <div className="row" style={{ marginTop: 7, flexWrap: 'wrap', gap: 4 }}>
          {c.lock > 0 && !c.opened && (
            <span className="chipst bad">
              <Icon id="candado" size={12} /> Cerradura de nivel {Math.round(c.lock)}
            </span>
          )}
          {c.opened && !c.items.length && <span className="chipst">Vacío</span>}
        </div>
        {c.opened && c.items.length > 0 && stacks(c.items)}
      </div>
    );
  }
  if (h.kind === 'drop') {
    const d = sim.state.drops.find((x) => x.id === h.id);
    if (!d) return null;
    return (
      <div className="panel inspect">
        <h3>En el suelo</h3>
        {stacks(d.items)}
        <div className="dim" style={{ marginTop: 6 }}>
          Clic derecho para recogerlo.
        </div>
      </div>
    );
  }
  const n = sim.state.nodes.find((x) => x.id === h.id);
  if (!n) return null;
  const NODE: Record<string, [string, string, string]> = {
    chatarra: ['Montón de chatarra', 'chatarra', 'Hierros y restos de vagones. Se desguaza para sacar chatarra.'],
    salitre: ['Costras de salitre', 'salitre', 'Se rasca de la pared húmeda. Es la base de la pólvora.'],
    derrumbe: ['Derrumbe', 'pico', 'Toneladas de escombro ciegan el túnel. Se puede excavar con la técnica adecuada.'],
    muro: ['Tabique', 'pico', 'Alguien tapió esta galería. Se puede echar abajo.'],
  };
  const [name, sprite, desc] = NODE[n.kind] ?? NODE.chatarra;
  return (
    <div className="panel inspect">
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <ItemIcon id={sprite} size={56} />
        <div className="grow">
          <h3>{name}</h3>
          <div className="dim" style={{ lineHeight: 1.3 }}>
            {desc}
          </div>
        </div>
      </div>
      {(n.kind === 'chatarra' || n.kind === 'salitre') && (
        <div className="row" style={{ marginTop: 7 }}>
          <span className="chipst">
            <Icon id="caja" size={12} /> Quedan {Math.max(0, Math.round(n.amount))}
          </span>
        </div>
      )}
    </div>
  );
}

/** Primeros pasos: el siguiente que queda por dar, a la vista hasta completarlos. */
export function Tracker({ open }: { open: (s: Screen) => void }) {
  const g = useGame();
  useTick();
  const steps = firstSteps(g.sim);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next || g.sim.state.flags.tOculto) return null;
  return (
    <div className="tracker" onClick={() => open('hilos')} title="Abrir los hilos (J)">
      <span className="count">
        {done}/{steps.length}
      </span>
      <div className="grow">
        <b>{next.title}</b>
        <small>{next.hint}</small>
      </div>
      <button
        className="x mini"
        title="Ocultar los primeros pasos"
        onClick={(e) => {
          e.stopPropagation();
          g.sim.state.flags.tOculto = 1;
          g.bump();
        }}
      >
        <Icon id="cerrar" size={9} />
      </button>
    </div>
  );
}

export const LOG_ICON: Record<string, string> = { bueno: 'check', malo: 'aviso', historia: 'cronica', info: 'diario' };

export function LogView() {
  const g = useGame();
  useTick();
  const now = g.sim.state.time;
  const recent = g.sim.state.log.filter((l) => now - l.t < (l.kind === 'historia' ? 60 : 22)).slice(-5);
  return (
    <div className="log">
      {recent.reverse().map((l) => (
        <div key={l.t + l.msg} className={'logline ' + l.kind}>
          <Icon id={LOG_ICON[l.kind] ?? 'diario'} size={13} />
          <span>{l.msg}</span>
        </div>
      ))}
    </div>
  );
}

/** Icono de cada acción del menú contextual, según lo que dice. */
function actionIcon(label: string): string {
  const l = label.toLowerCase();
  if (/atacar|rematar/.test(l)) return 'atacar';
  if (/comerciar/.test(l)) return 'comerciar';
  if (/hablar/.test(l)) return 'hablar';
  if (/curar|auxilios/.test(l)) return 'curar';
  if (/cargar|acostar/.test(l)) return 'cargar';
  if (/seguir/.test(l)) return 'seguir';
  if (/forzar/.test(l)) return 'candado';
  if (/recoger|registrar/.test(l)) return 'saquear';
  if (/abrir|contenido/.test(l)) return 'abrir';
  if (/construir/.test(l)) return 'construir';
  if (/descansar/.test(l)) return 'descansar';
  if (/receta/.test(l)) return 'receta';
  if (/asignar/.test(l)) return 'fijo';
  if (/derribar el muro|excavar/.test(l)) return 'excavar';
  if (/derribar/.test(l)) return 'derribar';
  if (/desguazar|rascar/.test(l)) return 'trabajos';
  if (/trabajar|atender|investigar/.test(l)) return 'trabajar';
  return 'ir';
}

export function ContextMenuView() {
  const g = useGame();
  useTick();
  const m = g.menu;
  if (!m) return null;
  const x = Math.min(m.x, window.innerWidth - 230);
  const y = Math.min(m.y, window.innerHeight - 50 - m.actions.length * 36);
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
          <Icon id={actionIcon(a.label)} size={16} />
          <span>
            {a.label}
            {a.hint && <small>{a.hint}</small>}
          </span>
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
      {g.paused && !g.panel && (
        <div className="paused-tag pass">
          <Icon id="pausa" size={15} /> Pausa
        </div>
      )}
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
