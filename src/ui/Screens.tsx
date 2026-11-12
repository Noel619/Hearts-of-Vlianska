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
import { Bar, Win, hex, useGame, useTick } from './core';
import { repWord, type Screen } from './Hud';

export function BuildScreen({ close }: { close: () => void }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const [cat, setCat] = useState<BuildCat>('Refugio');
  return (
    <Win title="Construir" onClose={close} width={900}>
      <div className="tabs" style={{ marginBottom: 10, border: '1px solid var(--line)' }}>
        {BUILD_CATS.map((c) => (
          <button key={c} className={'tab' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="cards">
        {BUILD_LIST.filter((b) => b.cat === cat).map((b) => {
          const locked = !hasTech(sim, b.tech);
          return (
            <button
              key={b.id}
              className={'card' + (locked ? ' off' : '')}
              onClick={() => {
                if (locked) return;
                g.startBuild(b.id);
                close();
              }}
            >
              <h4>{b.name}</h4>
              <small>{b.desc}</small>
              <div className="cost">
                {b.cost.map(([id, n]) => (
                  <span key={id} className={owned(sim, id) >= n ? '' : 'no'}>
                    {n} {ITEMS[id].name}
                  </span>
                ))}
              </div>
              {locked && <small className="bad">Requiere: {TECHS[b.tech!]?.name}</small>}
              {b.power && b.power > 0 ? <small className="amber">Consume {b.power} de energía</small> : null}
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

export function ResearchScreen({ close }: { close: () => void }) {
  const g = useGame();
  useTick();
  const sim = g.sim;
  const [msg, setMsg] = useState('');
  const cur = sim.state.tech.cur ? TECHS[sim.state.tech.cur] : null;
  return (
    <Win title="Mesa de estudio" onClose={close} width={920}>
      {cur ? (
        <div style={{ marginBottom: 10 }}>
          <div className="row">
            <b className="amber">Investigando: {cur.name}</b>
            <span className="sp" />
            <span className="dim">
              {Math.floor(sim.state.tech.prog)}/{cur.cost}
            </span>
          </div>
          <Bar v={sim.state.tech.prog / cur.cost} cls="amber" />
        </div>
      ) : (
        <p className="dim" style={{ marginTop: 0 }}>
          Elige qué estudiar. Hace falta una mesa de estudio y alguien que trabaje en ella; algunas técnicas consumen libros o planos.
        </p>
      )}
      <div className="cards">
        {TECH_LIST.map((t) => {
          const st = techState(sim, t.id);
          return (
            <button
              key={t.id}
              className={'card' + (st === 'bloqueada' ? ' off' : '') + (st === 'en curso' ? ' sel' : '')}
              onClick={() => st === 'disponible' && (setMsg(startResearch(sim, t.id) ?? ''), g.bump())}
            >
              <h4>
                {t.name} {st === 'hecha' && <span className="good">✓</span>}
              </h4>
              <small>{t.desc}</small>
              <div className="cost">
                <span>{t.cost} de estudio</span>
                {(t.needs ?? []).map(([id, n]) => (
                  <span key={id} className={owned(sim, id) >= n || st === 'hecha' ? '' : 'no'}>
                    {n} {ITEMS[id].name}
                  </span>
                ))}
              </div>
              {st === 'bloqueada' && <small className="bad">Antes: {(t.req ?? []).map((r) => TECHS[r].name).join(', ')}</small>}
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
  const W = 1040;
  const H = Math.round((W * (b.maxZ - b.minZ)) / (b.maxX - b.minX));
  const sx = (x: number) => ((x - b.minX) / (b.maxX - b.minX)) * W;
  const sz = (z: number) => ((z - b.minZ) / (b.maxZ - b.minZ)) * H;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.fillStyle = '#0c0d0f';
    ctx.fillRect(0, 0, W, H);
    // Río Vlia (en superficie)
    ctx.strokeStyle = 'rgba(60,100,150,0.35)';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const r of layout.rivers) {
      ctx.beginPath();
      r.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sz(p.z)) : ctx.moveTo(sx(p.x), sz(p.z))));
      ctx.stroke();
    }
    const blocked = sim.world.graph.blockedLinks;
    for (const l of layout.links) {
      ctx.strokeStyle = l.def.line ? LINE_COLOR[l.def.line] : TERRAIN_COLOR[l.terrain];
      ctx.lineWidth = l.terrain === 'linea' ? 4 : l.terrain === 'estrecho' || l.terrain.startsWith('aux') ? 1.5 : 2.5;
      ctx.setLineDash(blocked.has(l.index) ? [3, 5] : l.terrain === 'peligroso' || l.terrain === 'auxiliarPeligroso' ? [7, 3] : []);
      ctx.beginPath();
      l.pts.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sz(p.z)) : ctx.moveTo(sx(p.x), sz(p.z))));
      ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const n of sim.state.nodes) {
      if (n.kind !== 'derrumbe' && n.kind !== 'muro') continue;
      ctx.fillStyle = '#e0624f';
      ctx.font = 'bold 13px PT Sans';
      ctx.textAlign = 'center';
      ctx.fillText('✕', sx(n.x), sz(n.z) + 4);
    }
    for (const f of layout.stations) {
      const st = sim.state.stations[f.id];
      const owner = st?.owner;
      const col = owner && owner !== 'JUG' && owner !== 'LIB' && owner !== 'MUT' ? FACTION_LORE[owner as FactionId].color : owner === 'JUG' ? hex(sim.state.playerColor) : '#55585e';
      ctx.save();
      ctx.translate(sx(f.x), sz(f.z));
      ctx.rotate(f.rot);
      const hl = Math.max(9, (f.hl / (b.maxX - b.minX)) * W);
      ctx.fillStyle = col;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-hl, -6, hl * 2, 12, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.font = '600 13px "PT Sans Narrow", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = st?.visited ? '#efe6cc' : '#8d8a80';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      const y = sz(f.z) + (Math.abs(Math.sin(f.rot)) > 0.7 ? 0 : -12);
      const x = sx(f.x) + (Math.abs(Math.sin(f.rot)) > 0.7 ? 14 : 0);
      ctx.textAlign = Math.abs(Math.sin(f.rot)) > 0.7 ? 'left' : 'center';
      ctx.strokeText(f.def.shortName, x, y);
      ctx.fillText(f.def.shortName, x, y);
    }
    // Obras de la base
    ctx.fillStyle = hex(sim.state.playerColor);
    for (const bd of sim.state.buildings) ctx.fillRect(sx(bd.x) - 1.5, sz(bd.z) - 1.5, 3, 3);
    // La escuadra
    for (const c of sim.players) {
      ctx.beginPath();
      ctx.arc(sx(c.x), sz(c.z), 4, 0, 7);
      ctx.fillStyle = '#8dffa0';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Cámara
    const f = g.rig.focus;
    ctx.strokeStyle = '#ffc56b';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx(f.x) - 12, sz(f.z) - 8, 24, 16);
  });
  return (
    <Win title="Metro de Vlianska" onClose={close}>
      <canvas
        ref={ref}
        width={W}
        height={H}
        style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', width: 'auto', height: 'auto', margin: '0 auto', cursor: 'crosshair', border: '1px solid var(--line)' }}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = b.minX + ((e.clientX - r.left) / r.width) * (b.maxX - b.minX);
          const z = b.minZ + ((e.clientY - r.top) / r.height) * (b.maxZ - b.minZ);
          g.rig.jump(x, z);
          close();
        }}
      />
      <div className="row dim" style={{ marginTop: 8, flexWrap: 'wrap', gap: 14 }}>
        <span>
          <b style={{ color: LINE_COLOR.verde }}>━</b> Línea Verde
        </span>
        <span>
          <b style={{ color: LINE_COLOR.roja }}>━</b> Línea Roja
        </span>
        <span>
          <b style={{ color: LINE_COLOR.azul }}>━</b> Línea Azul
        </span>
        <span>
          <b style={{ color: TERRAIN_COLOR.peligroso }}>╍</b> Túnel peligroso
        </span>
        <span>
          <b style={{ color: TERRAIN_COLOR.auxiliar }}>─</b> Auxiliar
        </span>
        <span>
          <b className="bad">✕</b> Derrumbe o muro
        </span>
        <span className="sp" />
        <span>Haz clic para llevar la cámara</span>
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
      <Win title={f.name} onClose={() => setOpen(null)} width={760} cls="lore">
        <div className="row" style={{ marginBottom: 8 }}>
          <div className="emblem" style={{ background: f.color }}>
            {f.id}
          </div>
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
    <Win title="Facciones del metro" onClose={close} width={800}>
      <div className="list" style={{ gap: 5 }}>
        {FACTION_IDS.map((id) => {
          const f = FACTION_LORE[id];
          const rep = sim.state.rep[id];
          const bounty = sim.state.bounty[id];
          const stations = Object.values(sim.state.stations).filter((s) => s.owner === id).length;
          return (
            <div key={id} className="fac" onClick={() => setOpen(id)}>
              <div className="emblem" style={{ background: f.color }}>
                {id}
              </div>
              <div>
                <b className="amber" style={{ fontFamily: 'var(--stencil)', fontSize: 18, fontWeight: 'normal', letterSpacing: '0.04em' }}>
                  {f.name}
                </b>
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

export function CodexScreen({ close }: { close: () => void }) {
  return (
    <Win title="Crónica del metro" onClose={close} width={780} cls="lore">
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
    <Win title="Diario" onClose={close} width={720}>
      <div className="list">
        {[...g.sim.state.log].reverse().map((l, i) => (
          <div key={i} className={'logline ' + l.kind} style={{ animation: 'none' }}>
            <span className="dim">Día {Math.floor(l.t / 1440) + 1} · </span>
            {l.msg}
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
    ['B · I · M · G · K', 'Construir · Estudio · Mapa · Facciones · Crónica'],
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
      <Win title="Cómo se juega" onClose={() => setView('menu')} width={700}>
        <HelpBody />
      </Win>
    );
  if (view === 'ajustes')
    return (
      <Win title="Ajustes" onClose={() => setView('menu')} width={460}>
        <SettingsBody />
      </Win>
    );
  if (view === 'guardar' || view === 'cargar')
    return (
      <Win title={view === 'guardar' ? 'Guardar partida' : 'Cargar partida'} onClose={() => setView('menu')} width={520}>
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
                  {m ? `${m.name} · día ${m.day} · ${m.squad} en la escuadra · ${new Date(m.when).toLocaleString('es-ES')}` : `${slot === 'auto' ? 'Autoguardado' : slot === 'rapido' ? 'Guardado rápido' : 'Hueco libre'}`}
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
    <Win title="Sombras de Vlianska" onClose={close} width={360}>
      <div className="col">
        <button className="btn big" onClick={close}>
          Continuar
        </button>
        <button className="btn big" onClick={() => setView('guardar')}>
          Guardar
        </button>
        <button className="btn big" onClick={() => setView('cargar')}>
          Cargar
        </button>
        <button className="btn big" onClick={() => open('registro')}>
          Diario
        </button>
        <button className="btn big" onClick={() => setView('ajustes')}>
          Ajustes
        </button>
        <button className="btn big" onClick={() => setView('ayuda')}>
          Cómo se juega
        </button>
        <button className="btn big danger" onClick={exit}>
          Salir al menú
        </button>
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
    <Win title="La escuadra ha caído" width={520}>
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
