// Pantallas a ventana completa: construcción, investigación, mapa del metro,
// facciones, crónica, menú de pausa y fin de partida.

import { useEffect, useRef, useState } from 'react';
import { audio, type Volumes } from '../audio';
import { BUILD_CATS, BUILD_LIST, TECHS, TECH_LIST, type BuildCat } from '../data/edificios';
import { LORE } from '../data/historia/cronica';
import { FACTION_IDS, FACTION_LORE } from '../data/historia/facciones';
import { FIGURE_BY_ID } from '../data/historia/figuras';
import { ITEMS } from '../data/items';
import type { FactionId } from '../data/tipos';
import { owned, startResearch, techState } from '../sim/actions';
import { hasTech } from '../sim/build';
import { deleteSave, listSaves, loadGame, saveGame } from '../sim/save';
import { propThumb } from '../render/thumbs';
import { SCENARIOS } from '../data/escenarios';
import { burnLetter } from '../sim/events';
import { epilogue, firstSteps, storyThreads } from '../sim/hilos';
import { VERSION, VERSION_LABEL } from '../version';
import { Bar, Cost, Face, ItemIcon, Money, Win, hex, useGame, useTick } from './core';
import { LOG_ICON } from './Hud';
import { Emblem } from './sprites/Emblem';
import { Icon } from './sprites/Sprite';
import { repWord, type Screen } from './Hud';

const CAT_ICON: Record<BuildCat, string> = { Refugio: 'cama', Supervivencia: 'hambre', Almacén: 'caja', Industria: 'trabajar', Defensa: 'defensivo', Luz: 'luz' };

export function BuildScreen({ close }: { close: () => void }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const [cat, setCat] = useState<BuildCat>('Refugio');
  return (
    <Win title="Construir" icon="construir" onClose={close} width={960}>
      <div className="tabs big">
        {BUILD_CATS.map((c) => (
          <button key={c} className={'tab' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
            <Icon id={CAT_ICON[c]} size={15} /> {c}
          </button>
        ))}
      </div>
      <div className="cards builds">
        {BUILD_LIST.filter((b) => b.cat === cat).map((b) => {
          const locked = !hasTech(sim, b.tech);
          const thumb = propThumb(g.gfx.renderer, b.prop, b.variant ?? 0);
          return (
            <button
              key={b.id}
              className={'card build' + (locked ? ' off' : '')}
              onClick={() => {
                if (locked) return;
                g.startBuild(b.id);
                close();
              }}
            >
              <span className="thumb">{thumb ? <img src={thumb} alt="" draggable={false} /> : <Icon id="construir" size={40} />}</span>
              <span className="info">
                <h4>{b.name}</h4>
                <small>{b.desc}</small>
                <Cost items={b.cost} have={(id) => owned(sim, id)} />
                {locked && (
                  <small className="bad row">
                    <Icon id="candado" size={12} /> Requiere: {TECHS[b.tech!]?.name}
                  </small>
                )}
                {b.power && b.power > 0 ? (
                  <small className="amber row">
                    <Icon id="energia" size={12} /> Consume {b.power} de energía
                  </small>
                ) : null}
                {b.power && b.power < 0 ? (
                  <small className="good row">
                    <Icon id="energia" size={12} /> Produce {-b.power} de energía
                  </small>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="dim" style={{ marginBottom: 0 }}>
        Puedes construir en cualquier túnel, cruce o estación sin dueño. Los materiales salen de las mochilas de tu gente y de los almacenes de la base.
      </p>
    </Win>
  );
}

/** Sprite que representa cada técnica. */
const TECH_SPRITE: Record<string, string> = {
  construccion: 'tablones',
  hongos2: 'hongos',
  cerdos: 'carne',
  agua: 'agua',
  medicina1: 'botiquin',
  antibioticos: 'antibioticos',
  fundicion: 'acero',
  herramientas: 'martillo',
  municion: 'balas',
  quimica: 'polvora',
  destilacion: 'combustible',
  generadores: 'componentes',
  hidroponia: 'hongosSecos',
  armas1: 'fusilTunel',
  armas2: 'carabina',
  neumaticas: 'neumatico',
  blindaje: 'chalecoPlacas',
  mascaras: 'mascaraGas',
  excavacion: 'pico',
  mando: 'casco',
  radio: 'radioPiezas',
};

export function ResearchScreen({ close }: { close: () => void }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const [msg, setMsg] = useState('');
  const cur = sim.state.tech.cur ? TECHS[sim.state.tech.cur] : null;
  return (
    <Win title="Mesa de estudio" icon="estudio" onClose={close} width={980}>
      {cur ? (
        <div className="curtech">
          <ItemIcon id={TECH_SPRITE[cur.id] ?? 'libros'} size={52} />
          <div className="grow">
            <div className="row">
              <b className="amber">Investigando: {cur.name}</b>
              <span className="sp" />
              <span className="dim">
                {Math.floor(sim.state.tech.prog)}/{cur.cost}
              </span>
            </div>
            <Bar v={sim.state.tech.prog / cur.cost} cls="amber fat" />
          </div>
        </div>
      ) : (
        <p className="dim" style={{ marginTop: 0 }}>
          Elige qué estudiar. Hace falta una mesa de estudio y alguien que trabaje en ella; algunas técnicas consumen libros o planos.
        </p>
      )}
      <div className="cards techs">
        {TECH_LIST.map((t) => {
          const st = techState(sim, t.id);
          return (
            <button
              key={t.id}
              className={'card tech' + (st === 'bloqueada' ? ' off' : '') + (st === 'en curso' ? ' sel' : '') + (st === 'hecha' ? ' done' : '')}
              onClick={() => st === 'disponible' && (setMsg(startResearch(sim, t.id) ?? ''), g.bump())}
            >
              <span className="medal">
                <ItemIcon id={TECH_SPRITE[t.id] ?? 'libros'} size={50} />
                {st === 'hecha' && (
                  <i className="badge good">
                    <Icon id="check" size={11} />
                  </i>
                )}
                {st === 'bloqueada' && (
                  <i className="badge">
                    <Icon id="candado" size={11} />
                  </i>
                )}
              </span>
              <span className="info">
                <h4>{t.name}</h4>
                <small>{t.desc}</small>
                <span className="row">
                  <span className="chip" title="Puntos de estudio">
                    <Icon id="estudio" size={13} />
                    {t.cost}
                  </span>
                  {t.needs && <Cost items={t.needs} have={st === 'hecha' ? undefined : (id) => owned(sim, id)} />}
                </span>
                {st === 'bloqueada' && <small className="bad">Antes: {(t.req ?? []).map((r) => TECHS[r].name).join(', ')}</small>}
              </span>
            </button>
          );
        })}
      </div>
      {msg && <p className="bad">{msg}</p>}
    </Win>
  );
}

const TERRAIN_COLOR: Record<string, string> = {
  linea: '#d8d2c0',
  tunel: '#9a968a',
  peligroso: '#b3472e',
  auxiliar: '#6f7a86',
  auxiliarPeligroso: '#8a4a3a',
  estrecho: '#5c6068',
  derrumbe: '#b3472e',
};
const LINE_COLOR: Record<string, string> = { verde: '#3f8f3a', roja: '#b3202c', azul: '#2f62d8' };

export function MapScreen({ close }: { close: () => void }) {
  const g = useGame();
  useTick();
  const ref = useRef<HTMLCanvasElement>(null);
  const sim = g.sim;
  const layout = g.shared.world.layout;
  const b = layout.bounds;
  const W = 1200;
  const H = Math.round((W * (b.maxZ - b.minZ)) / (b.maxX - b.minX));
  const sx = (x: number) => ((x - b.minX) / (b.maxX - b.minX)) * W;
  const sz = (z: number) => ((z - b.minZ) / (b.maxZ - b.minZ)) * H;
  const px = (x: number) => `${((x - b.minX) / (b.maxX - b.minX)) * 100}%`;
  const pz = (z: number) => `${((z - b.minZ) / (b.maxZ - b.minZ)) * 100}%`;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    // Papel de plano viejo
    const bg = ctx.createRadialGradient(W / 2, H / 2, H * 0.1, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, '#1c1e22');
    bg.addColorStop(1, '#0b0c0e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
      ctx.stroke();
    }
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Río Vlia (en superficie)
    for (const r of layout.rivers) {
      ctx.strokeStyle = 'rgba(70,120,180,0.2)';
      ctx.lineWidth = 22;
      ctx.beginPath();
      r.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sz(p.z)) : ctx.moveTo(sx(p.x), sz(p.z))));
      ctx.stroke();
      ctx.strokeStyle = 'rgba(90,150,210,0.3)';
      ctx.lineWidth = 9;
      ctx.stroke();
    }
    const blocked = sim.world.graph.blockedLinks;
    const path = (l: (typeof layout.links)[number]) => {
      ctx.beginPath();
      l.pts.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sz(p.z)) : ctx.moveTo(sx(p.x), sz(p.z))));
    };
    // Túneles: primero el borde oscuro, luego el color
    for (const pass of [0, 1]) {
      for (const l of layout.links) {
        const main = l.terrain === 'linea';
        const thin = l.terrain === 'estrecho' || l.terrain.startsWith('aux');
        const w = main ? 6 : thin ? 2 : 3.4;
        ctx.setLineDash(pass && blocked.has(l.index) ? [3, 7] : pass && (l.terrain === 'peligroso' || l.terrain === 'auxiliarPeligroso') ? [9, 5] : []);
        ctx.strokeStyle = pass ? (l.def.line ? LINE_COLOR[l.def.line] : TERRAIN_COLOR[l.terrain]) : '#050505';
        ctx.lineWidth = pass ? w : w + 3.4;
        path(l);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    // Obras de la base
    ctx.fillStyle = hex(sim.state.playerColor);
    for (const bd of sim.state.buildings) ctx.fillRect(sx(bd.x) - 2, sz(bd.z) - 2, 4, 4);
  });
  const f = g.rig.focus;
  const squad = sim.players;
  const cxm = squad.length ? squad.reduce((a, c) => a + c.x, 0) / squad.length : 0;
  const czm = squad.length ? squad.reduce((a, c) => a + c.z, 0) / squad.length : 0;
  return (
    <Win title="Metro de Vlianska" icon="mapa" onClose={close}>
      <div
        className="mapbox"
        style={{ width: `min(${W}px, calc(100vw - 80px), calc((100vh - 230px) * ${W / H}))`, aspectRatio: `${W} / ${H}` }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = b.minX + ((e.clientX - r.left) / r.width) * (b.maxX - b.minX);
          const z = b.minZ + ((e.clientY - r.top) / r.height) * (b.maxZ - b.minZ);
          g.rig.jump(x, z);
          close();
        }}
      >
        <canvas ref={ref} width={W} height={H} />
        {sim.state.nodes
          .filter((n) => n.kind === 'derrumbe' || n.kind === 'muro')
          .map((n) => (
            <span key={n.id} className="mk block" style={{ left: px(n.x), top: pz(n.z) }} title={n.kind === 'derrumbe' ? 'Derrumbe' : 'Tabique'}>
              <Icon id="cerrar" size={11} />
            </span>
          ))}
        {layout.stations.map((st) => {
          const state = sim.state.stations[st.id];
          const owner = state?.owner ?? 'LIB';
          const vertical = Math.abs(Math.sin(st.rot)) > 0.7;
          return (
            <span key={st.id} className={'mk sta' + (state?.visited ? ' seen' : '') + (vertical ? ' v' : '')} style={{ left: px(st.x), top: pz(st.z) }}>
              <Emblem side={owner} size={30} playerColor={hex(sim.state.playerColor)} />
              <b>{st.def.shortName}</b>
            </span>
          );
        })}
        <span className="mk cam" style={{ left: px(f.x), top: pz(f.z) }} />
        {squad.length > 0 && (
          <span className="mk squad" style={{ left: px(cxm), top: pz(czm) }} title={sim.state.playerName}>
            <Icon id="escuadra" size={13} />
          </span>
        )}
      </div>
      <div className="maplegend">
        <span>
          <i style={{ background: LINE_COLOR.verde }} /> Línea Verde
        </span>
        <span>
          <i style={{ background: LINE_COLOR.roja }} /> Línea Roja
        </span>
        <span>
          <i style={{ background: LINE_COLOR.azul }} /> Línea Azul
        </span>
        <span>
          <i className="dash" style={{ color: TERRAIN_COLOR.peligroso }} /> Túnel peligroso
        </span>
        <span>
          <i className="thin" style={{ background: TERRAIN_COLOR.auxiliar }} /> Auxiliar
        </span>
        <span>
          <span className="mk block inl">
            <Icon id="cerrar" size={9} />
          </span>{' '}
          Derrumbe o tabique
        </span>
        <span>
          <span className="mk squad inl">
            <Icon id="escuadra" size={10} />
          </span>{' '}
          Tu escuadra
        </span>
        <span className="sp" />
        <span className="dim">Haz clic para llevar la cámara</span>
      </div>
    </Win>
  );
}

export function FactionsScreen({ close }: { close: () => void }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const [open, setOpen] = useState<FactionId | null>(null);
  if (open) {
    const f = FACTION_LORE[open];
    const leader = FIGURE_BY_ID[f.leader];
    const dead = sim.state.flags['muerto_' + f.leader];
    return (
      <Win title={f.name} icon="facciones" onClose={() => setOpen(null)} width={760} cls="lore">
        <div className="row" style={{ marginBottom: 8, gap: 12 }}>
          <Emblem side={open} size={76} />
          <div>
            <div>{f.government}</div>
            <div className="dim">
              {leader?.name}, {leader?.title} {dead ? <span className="bad">(muerto o preso)</span> : null}
            </div>
          </div>
        </div>
        <p className="quote">{f.summary}</p>
        {f.lore.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <p className="dim">Objetivos: {f.goals.join(' · ')}</p>
        <p className="dim">
          Relaciones:{' '}
          {FACTION_IDS.filter((o) => o !== open)
            .map((o) => `${FACTION_LORE[o].shortName} ${sim.state.rel[o < open ? o + '|' + open : open + '|' + o] ?? 0}`)
            .join(' · ')}
        </p>
      </Win>
    );
  }
  return (
    <Win title="Facciones del metro" icon="facciones" onClose={close} width={820}>
      <div className="list" style={{ gap: 5 }}>
        {FACTION_IDS.map((id) => {
          const f = FACTION_LORE[id];
          const rep = sim.state.rep[id];
          const bounty = sim.state.bounty[id];
          const stations = Object.values(sim.state.stations).filter((s) => s.owner === id).length;
          return (
            <div key={id} className="fac" onClick={() => setOpen(id)}>
              <Emblem side={id} size={52} />
              <div>
                <b className="fname">{f.name}</b>
                <div className="dim" style={{ fontSize: 12.5 }}>
                  {f.government} · {stations} {stations === 1 ? 'estación' : 'estaciones'}
                  {bounty > 0 ? <span className="bad"> · Te buscan ({bounty})</span> : null}
                </div>
              </div>
              <div>
                <div className="relbar">
                  <i style={{ left: `${(rep + 100) / 2}%` }} />
                </div>
                <div className="dim right" style={{ fontSize: 12, marginTop: 3 }}>
                  {repWord(rep)} ({Math.round(rep)})
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="dim" style={{ marginBottom: 0 }}>
        La reputación sube comerciando, ayudando y entregando a quienes buscan; baja robando y atacando a su gente. Por debajo de −50 te disparan nada más verte.
      </p>
    </Win>
  );
}

const STATE_LABEL: Record<string, string> = { pendiente: 'Por hacer', 'en curso': 'En marcha', hecho: 'Cerrado' };

/** Hilos de la trama, primeros pasos y estado de la base. */
export function ThreadsScreen({ close }: { close: () => void }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const [msg, setMsg] = useState('');
  const steps = firstSteps(sim);
  const threads = storyThreads(sim);
  const stepsDone = steps.filter((s) => s.done).length;
  const hasLetter = sim.players.some((q) => q.inv.some((i) => i.id === 'cartaBessmertny'));
  return (
    <Win title="Hilos del metro" icon="estrella" onClose={close} width={940}>
      {stepsDone < steps.length && (
        <div className="steps">
          <h4>
            Primeros pasos{' '}
            <span className="dim">
              {stepsDone}/{steps.length}
            </span>
          </h4>
          {steps.map((s) => (
            <div key={s.id} className={'step' + (s.done ? ' done' : '')}>
              <i className={'badge' + (s.done ? ' good' : '')}>{s.done && <Icon id="check" size={11} />}</i>
              <b>{s.title}</b>
              {!s.done && <small>{s.hint}</small>}
            </div>
          ))}
        </div>
      )}
      <div className="threads">
        {threads.map((t) => (
          <div key={t.id} className={'thread s-' + t.state.replace(' ', '')}>
            <span className="medal">
              <ItemIcon id={t.sprite} size={54} />
              {t.state === 'hecho' && (
                <i className="badge good">
                  <Icon id="check" size={11} />
                </i>
              )}
            </span>
            <div className="grow">
              <div className="row">
                <h4 className="grow">{t.title}</h4>
                <span className={'chipst st-' + t.state.replace(' ', '')}>{STATE_LABEL[t.state]}</span>
              </div>
              <p>{t.text}</p>
              {t.hint && (
                <p className="hintline">
                  <Icon id="flecha" size={11} /> {t.hint}
                </p>
              )}
              {t.progress !== undefined && t.progress > 0 && t.state !== 'hecho' && <Bar v={t.progress} cls="amber" />}
              {t.id === 'carta' && t.state === 'en curso' && hasLetter && (
                <button className="btn small danger" style={{ marginTop: 6 }} onClick={() => (setMsg(burnLetter(sim) ?? ''), g.bump())}>
                  <Icon id="aviso" size={12} /> Quemar la carta
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="quote" style={{ marginTop: 12 }}>{msg}</p>}
    </Win>
  );
}

/** Informe al bajar al metro: quiénes sois, qué lleváis y cómo se manda. */
export function Briefing({ scenario, close }: { scenario: string; close: () => void }) {
  const g = useGame();
  const sim = g.sim;
  const sc = SCENARIOS.find((s) => s.id === scenario);
  return (
    <Win title={sc?.name ?? 'Bajada al metro'} icon="play" width={720} cls="brief">
      {(sc?.intro ?? []).map((p, i) => (
        <p key={i} className={i === 0 ? 'quote' : ''}>
          {p}
        </p>
      ))}
      <div className="crew">
        {sim.players.map((c) => (
          <div key={c.id} className="crewman">
            <Face c={c} size={64} playerColor={sim.state.playerColor} />
            <b>{c.name.split(' ')[0]}</b>
            <small>{c.eq.arma ? ITEMS[c.eq.arma.id].name : 'Desarmado'}</small>
          </div>
        ))}
      </div>
      <div className="help brief-keys">
        <kbd>Clic izquierdo</kbd>
        <span>Seleccionar a los tuyos (arrastra para elegir a varios)</span>
        <kbd>Clic derecho</kbd>
        <span>En el suelo, ir; sobre algo o alguien, menú de acciones</span>
        <kbd>Espacio</kbd>
        <span>Pausa: da órdenes con calma</span>
        <kbd>W A S D · Q E · Rueda</kbd>
        <span>Mover, girar y acercar la cámara</span>
        <kbd>J</kbd>
        <span>Hilos: qué se cuece en el metro y qué te falta por hacer</span>
      </div>
      <div className="row foot">
        <span className="dim">La partida se guarda sola cada minuto. F5 guarda, F9 carga.</span>
        <span className="sp" />
        <button className="btn big" onClick={close} autoFocus>
          <Icon id="play" size={16} /> Empezar
        </button>
      </div>
    </Win>
  );
}

/** Epílogo: la emisora ha captado la señal. El final es abierto y se puede seguir jugando. */
export function Epilogue({ close, exit }: { close: () => void; exit: () => void }) {
  const g = useGame();
  const st = g.sim.state;
  return (
    <Win title="Aquí Múrmansk" icon="estrella" width={700} cls="brief">
      <div className="talk">
        <ItemIcon id="radioPiezas" size={96} />
        <div className="grow">
          <p className="quote">
            Entre el ruido estático, una voz repite coordenadas y una frase en ruso: «Aquí Múrmansk. Seguimos vivos.» La señal se pierde a los pocos minutos. Nadie sabe si fue grabada hace años. Pero hay más supervivientes. Hay esperanza.
          </p>
        </div>
      </div>
      <div className="lore" style={{ marginTop: 6 }}>
        <h3>El metro, {g.sim.dateText()}</h3>
        {epilogue(g.sim).map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
      <div className="startkit">
        <span className="chipst" title="Días bajo tierra">
          <Icon id="reloj" size={12} /> {g.sim.day} {g.sim.day === 1 ? 'día' : 'días'}
        </span>
        <span className="chipst" title="Enemigos abatidos">
          <Icon id="calavera" size={12} /> {st.stats.kills}
        </span>
        <span className="chipst" title="Obras levantadas">
          <Icon id="construir" size={12} /> {st.stats.built}
        </span>
        <Money n={st.stats.earned} />
      </div>
      <div className="row foot">
        <span className="dim">Has llegado al final de la historia de la versión {VERSION}. El metro sigue ahí.</span>
        <span className="sp" />
        <button className="btn" onClick={exit}>
          <Icon id="salir" size={14} /> Volver al menú
        </button>
        <button className="btn big" onClick={close}>
          <Icon id="play" size={16} /> Seguir jugando
        </button>
      </div>
    </Win>
  );
}

export function CodexScreen({ close }: { close: () => void }) {
  return (
    <Win title="Crónica del metro" icon="cronica" onClose={close} width={780} cls="lore">
      {LORE.map((ch) => (
        <section key={ch.title}>
          <h3>{ch.title}</h3>
          {ch.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>
      ))}
      <p className="dim">Universo, historia y mapa de Vlianska: Noel619.</p>
    </Win>
  );
}

export function LogScreen({ close }: { close: () => void }) {
  const g = useGame();
  useTick();
  return (
    <Win title="Diario" icon="diario" onClose={close} width={720}>
      <div className="list">
        {[...g.sim.state.log].reverse().map((l, i) => (
          <div key={i} className={'logline ' + l.kind} style={{ animation: 'none' }}>
            <Icon id={LOG_ICON[l.kind] ?? 'diario'} size={13} />
            <span>
              <span className="dim">Día {Math.floor(l.t / 1440) + 1} · </span>
              {l.msg}
            </span>
          </div>
        ))}
      </div>
    </Win>
  );
}

export function HelpBody() {
  const rows: [string, string][] = [
    ['Clic izquierdo', 'Seleccionar a alguien de tu escuadra (arrastra para elegir a varios; Mayús para añadir)'],
    ['Clic derecho', 'En el suelo: ir. Sobre algo o alguien: menú de acciones. Sobre un enemigo: atacar'],
    ['Mayús + clic derecho', 'Encadenar órdenes'],
    ['W A S D', 'Mover la cámara'],
    ['Q / E', 'Girar la cámara (o arrastra con el botón central o el derecho)'],
    ['Rueda', 'Acercar y alejar'],
    ['Espacio', 'Pausa'],
    ['1 2 3 4', 'Velocidad del tiempo'],
    ['Tab', 'Siguiente miembro de la escuadra'],
    ['F', 'Centrar la cámara en el seleccionado'],
    ['L · C · H', 'Linterna · Sigilo · Mantener posición'],
    ['X', 'Cancelar órdenes'],
    ['B · I · M · G · K · J', 'Construir · Estudio · Mapa · Facciones · Crónica · Hilos'],
    ['R', 'Girar la obra antes de colocarla'],
    ['F5 / F9', 'Guardado y carga rápidos'],
  ];
  return (
    <>
      <div className="help">
        {rows.map(([k, d]) => (
          <div key={k} style={{ display: 'contents' }}>
            <kbd>{k}</kbd>
            <span>{d}</span>
          </div>
        ))}
      </div>
      <p className="dim" style={{ lineHeight: 1.5 }}>
        Nadie te espera ni te debe nada. Las habilidades suben con el uso; los golpes van a partes concretas del cuerpo; las heridas abiertas sangran hasta que alguien las venda. Quien cae inconsciente puede levantarse… o desangrarse. Comercia, rebusca chatarra, caza skrebuns, contrata gente en los bares y levanta tu propia estación donde nadie mande.
      </p>
    </>
  );
}

export function PauseScreen({ close, exit, open }: { close: () => void; exit: () => void; open: (s: Screen) => void }) {
  const g = useGame();
  const [view, setView] = useState<'menu' | 'guardar' | 'cargar' | 'ayuda' | 'ajustes'>('menu');
  const [msg, setMsg] = useState('');
  const saves = listSaves();
  const slots = ['partida1', 'partida2', 'partida3'];
  if (view === 'ayuda')
    return (
      <Win title="Cómo se juega" icon="ayuda" onClose={() => setView('menu')} width={700}>
        <HelpBody />
      </Win>
    );
  if (view === 'ajustes')
    return (
      <Win title="Ajustes" icon="ajustes" onClose={() => setView('menu')} width={460}>
        <SettingsBody />
      </Win>
    );
  if (view === 'guardar' || view === 'cargar')
    return (
      <Win title={view === 'guardar' ? 'Guardar partida' : 'Cargar partida'} icon="guardar" onClose={() => setView('menu')} width={560}>
        <div className="list" style={{ gap: 5 }}>
          {(view === 'guardar' ? slots : [...new Set([...saves.map((s) => s.slot), ...slots])]).map((slot) => {
            const m = saves.find((s) => s.slot === slot);
            return (
              <div key={slot} className="row">
                <button
                  className="btn grow"
                  style={{ textAlign: 'left' }}
                  disabled={view === 'cargar' && !m}
                  onClick={() => {
                    if (view === 'guardar') {
                      setMsg(saveGame(slot, g.sim.state) ? 'Partida guardada.' : 'No se pudo guardar.');
                    } else {
                      const st = loadGame(slot);
                      if (st) {
                        g.loadState(st);
                        close();
                      } else setMsg('La partida no es compatible.');
                    }
                  }}
                >
                  <Icon id="guardar" size={14} /> {m ? `${m.name} · día ${m.day} · ${m.squad} en la escuadra · ${new Date(m.when).toLocaleString('es-ES')}` : `${slot === 'auto' ? 'Autoguardado' : slot === 'rapido' ? 'Guardado rápido' : 'Hueco libre'}`}
                </button>
                {m && view === 'cargar' && (
                  <button className="btn danger" onClick={() => (deleteSave(slot), setMsg('Borrada.'))}>
                    Borrar
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {msg && <p className="amber">{msg}</p>}
      </Win>
    );
  return (
    <Win title="Sombras de Vlianska" icon="menu" onClose={close} width={380}>
      <div className="col menu-list">
        <button className="btn big" onClick={close}>
          <Icon id="play" size={16} /> Continuar
        </button>
        <button className="btn big" onClick={() => setView('guardar')}>
          <Icon id="guardar" size={16} /> Guardar
        </button>
        <button className="btn big" onClick={() => setView('cargar')}>
          <Icon id="recoger" size={16} /> Cargar
        </button>
        <button className="btn big" onClick={() => open('hilos')}>
          <Icon id="estrella" size={16} /> Hilos
        </button>
        <button className="btn big" onClick={() => open('registro')}>
          <Icon id="diario" size={16} /> Diario
        </button>
        <button className="btn big" onClick={() => setView('ajustes')}>
          <Icon id="ajustes" size={16} /> Ajustes
        </button>
        <button className="btn big" onClick={() => setView('ayuda')}>
          <Icon id="ayuda" size={16} /> Cómo se juega
        </button>
        <button className="btn big danger" onClick={exit}>
          <Icon id="salir" size={16} /> Salir al menú
        </button>
        <div className="dim version">{VERSION_LABEL}</div>
      </div>
    </Win>
  );
}

/** Volúmenes y calidad gráfica. */
export function SettingsBody() {
  const [v, setV] = useState<Volumes>(audio.volumes);
  const [q, setQ] = useState<string>(() => localStorage.getItem('sombras:calidad') ?? 'media');
  const [changed, setChanged] = useState(false);
  const set = (patch: Partial<Volumes>) => {
    const n = { ...v, ...patch };
    setV(n);
    audio.setVolumes(n);
  };
  const slider = (label: string, key: 'master' | 'music' | 'ambience' | 'sfx') => (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={0} max={100} value={Math.round(v[key] * 100)} onChange={(e) => set({ [key]: Number(e.target.value) / 100 })} />
      <b>{Math.round(v[key] * 100)}</b>
    </label>
  );
  return (
    <div className="col settings">
      <h4>Sonido</h4>
      {slider('General', 'master')}
      {slider('Música', 'music')}
      {slider('Ambiente', 'ambience')}
      {slider('Efectos', 'sfx')}
      <button className={'btn' + (v.muted ? ' on' : '')} onClick={() => set({ muted: !v.muted })}>
        {v.muted ? 'Sonido apagado' : 'Silenciar todo'}
      </button>
      <h4 style={{ marginTop: 14 }}>Gráficos</h4>
      <div className="row">
        {(['baja', 'media', 'alta'] as const).map((k) => (
          <button
            key={k}
            className={'btn grow' + (q === k ? ' on' : '')}
            onClick={() => {
              localStorage.setItem('sombras:calidad', k);
              setQ(k);
              setChanged(true);
            }}
          >
            {k === 'baja' ? 'Baja' : k === 'media' ? 'Media' : 'Alta'}
          </button>
        ))}
      </div>
      <p className="dim" style={{ fontSize: 12, margin: 0 }}>
        Baja: sin sombras ni resplandor. Alta: sombras nítidas y más resolución. La calidad se aplica al recargar la página; guarda antes la partida.
      </p>
      {changed && (
        <button className="btn" onClick={() => location.reload()}>
          Recargar ahora
        </button>
      )}
    </div>
  );
}

export function GameOver({ exit }: { exit: () => void }) {
  const g = useGame();
  const st = g.sim.state;
  return (
    <Win title="La escuadra ha caído" icon="calavera" width={520}>
      <p className="quote">El metro no guarda luto. Mañana otros ocuparán vuestro sitio junto a la hoguera.</p>
      <p>
        {st.playerName} resistió {g.sim.day} {g.sim.day === 1 ? 'día' : 'días'}. Enemigos abatidos: {st.stats.kills}. Cartuchos ganados: {st.stats.earned}. Obras levantadas: {st.stats.built}.
      </p>
      <div className="row">
        <button className="btn big" onClick={exit}>
          Volver al menú
        </button>
      </div>
    </Win>
  );
}
