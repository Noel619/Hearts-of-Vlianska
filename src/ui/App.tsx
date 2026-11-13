// Aplicación: carga del mundo, menú principal, comienzo de partida y juego.

import { useCallback, useEffect, useRef, useState } from 'react';
import { audio } from '../audio';
import { attachAudio } from '../audio/director';
import { SCENARIOS } from '../data/escenarios';
import { LORE } from '../data/historia/cronica';
import { Game, type Shared } from '../game/game';
import type { Quality } from '../render/gfx';
import { listSaves, loadGame, saveGame } from '../sim/save';
import { GameCtx, hex } from './core';
import { Emblem } from './sprites/Emblem';
import { Icon, ItemSprite, SpriteSheet } from './sprites/Sprite';
import { ITEMS } from '../data/items';
import { ContextMenuView, InspectPanel, LogView, Overlays, SelectionPanel, SquadBar, ThingPanel, TopBar, type Screen } from './Hud';
import { PanelView } from './Panels';
import { BuildScreen, CodexScreen, FactionsScreen, GameOver, HelpBody, LogScreen, MapScreen, PauseScreen, ResearchScreen, SettingsBody } from './Screens';
import { Win } from './core';

const COLORS = [0xd8c27a, 0xc86a4a, 0x7fb8c9, 0x9fc77a, 0xc9a0d8, 0xe0e0e0];
const QUOTES = [
  'Los más desafortunados tuvieron que esconderse en lo más profundo de los metros, con la esperanza de sobrevivir aunque fuera un día más.',
  'Las estaciones, con líderes totalitarios y ávidos de poder, convirtieron el metro en una carnicería.',
  'La carta nunca llegó a Volkov. Nadie sabe por qué.',
  'Cinco túneles, cinco peajes.',
  'Nadie sabe qué pasó en Tenevskaya; quienes se acercan hablan de voces en la oscuridad.',
  '«Aquí Múrmansk. Seguimos vivos.»',
];

type Mode = 'cargando' | 'menu' | 'nueva' | 'juego';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('cargando');
  const [progress, setProgress] = useState({ label: 'Preparando', frac: 0 });
  const [game, setGame] = useState<Game | null>(null);
  const [screen, setScreen] = useState<Screen>(null);
  const [menuView, setMenuView] = useState<'main' | 'cronica' | 'ayuda' | 'cargar' | 'ajustes'>('main');
  const [error, setError] = useState<string | null>(null);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  const [, force] = useState(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Carga del mundo (una sola vez)
  useEffect(() => {
    let cancelled = false;
    let g: Game | null = null;
    (async () => {
      const params = new URLSearchParams(location.search);
      const quality = (params.get('q') as Quality) ?? (localStorage.getItem('sombras:calidad') as Quality) ?? 'media';
      const shared: Shared = await Game.prepare((label, frac) => {
        if (!cancelled) setProgress({ label, frac });
      });
      if (cancelled || !canvasRef.current) return;
      g = Game.create(canvasRef.current, shared, quality);
      // Escena de fondo del menú: una partida muda con la cámara dando vueltas
      const direct = params.get('escenario');
      g.startNew({ scenario: direct ?? 'nadie', seed: params.get('seed') ? Number(params.get('seed')) : undefined });
      g.start();
      setGame(g);
      (window as unknown as Record<string, unknown>).__game = g;
      (window as unknown as Record<string, unknown>).__audio = audio;
      setMode(direct ? 'juego' : 'menu');
      (window as unknown as Record<string, unknown>).__ready = true;
    })().catch((e) => {
      console.error(e);
      setError(String(e?.stack ?? e));
    });
    return () => {
      cancelled = true;
      g?.dispose();
    };
  }, []);

  // En el menú la cámara orbita despacio sobre el andén donde espera la escuadra de fondo
  useEffect(() => {
    if (!game) return;
    if (mode !== 'menu' && mode !== 'nueva') return;
    game.selected = [];
    const p = game.sim.players[0];
    const f = game.shared.world.layout.stationById.TSE;
    game.rig.jump(p ? p.x - f.ax * 9 : f.x, p ? p.z - f.az * 9 : f.z, 27, 0.4, 0.6);
    game.paused = false;
    const id = setInterval(() => game.rig.rotate(0.0012, 0), 16);
    return () => clearInterval(id);
  }, [game, mode]);

  // Sonido: se desbloquea con el primer gesto; el menú tiene su canción y la partida su director
  useEffect(() => {
    const unlock = () => audio.unlock();
    const click = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest('button, .card, .swatch')) audio.play('click');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('click', click, true);
    };
  }, []);
  useEffect(() => {
    if (!game) return;
    if (mode === 'juego') return attachAudio(game);
    audio.setMood('menu');
    audio.setAmbience('menu');
    return undefined;
  }, [game, mode]);
  useEffect(() => {
    if (mode === 'juego') audio.play(screen ? 'abrir' : 'cerrar');
  }, [screen, mode]);

  // Atajos de las pantallas
  useEffect(() => {
    if (!game) return;
    game.onHotkey = (code) => {
      if (modeRef.current !== 'juego') return true;
      const map: Record<string, Screen> = { KeyB: 'construir', KeyI: 'investigar', KeyM: 'mapa', KeyG: 'facciones', KeyK: 'cronica' };
      if (map[code]) {
        setScreen((s) => (s === map[code] ? null : map[code]));
        return true;
      }
      if (code === 'Escape' && !game.buildDef && !game.menu && !game.panel) {
        setScreen((s) => (s ? null : 'pausa'));
        return true;
      }
      if (code === 'F5') {
        saveGame('rapido', game.sim.state);
        game.sim.log('Partida guardada.', 'info');
        return true;
      }
      if (code === 'F9') {
        const st = loadGame('rapido');
        if (st) game.loadState(st);
        return true;
      }
      return false;
    };
    return () => {
      game.onHotkey = null;
    };
  }, [game]);

  // Pausa mientras hay una pantalla abierta, autoguardado y fin de partida
  useEffect(() => {
    if (!game || mode !== 'juego') return;
    if (screen) game.paused = true;
    else if (!game.panel) game.paused = false;
    game.bump();
  }, [screen, game, mode]);
  useEffect(() => {
    if (!game || mode !== 'juego') return;
    const id = setInterval(() => {
      if (game.sim.players.length) saveGame('auto', game.sim.state);
      force((n) => n + 1);
    }, 60000);
    const un = game.subscribe(() => {
      if (game.sim.players.length === 0) force((n) => n + 1);
    });
    return () => {
      clearInterval(id);
      un();
    };
  }, [game, mode]);

  const exit = useCallback(() => {
    if (!game) return;
    setScreen(null);
    game.startNew({ scenario: 'nadie' });
    setMode('menu');
    setMenuView('main');
  }, [game]);

  const dead = mode === 'juego' && game && game.sim.players.length === 0 && game.sim.state.chars.every((c) => !c.player || c.st === 'muerto');

  return (
    <>
      <SpriteSheet />
      <canvas ref={canvasRef} className="game-canvas" tabIndex={0} />
      {error && (
        <div className="loading">
          <div className="box">
            <h2 className="stencil bad">Algo ha fallado</h2>
            <pre style={{ textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: 12 }}>{error}</pre>
          </div>
        </div>
      )}
      {mode === 'cargando' && !error && (
        <div className="loading">
          <div className="box">
            <Emblem side="JUG" size={92} />
            <h1 className="title" style={{ fontSize: 52 }}>
              <span>Sombras de</span>Vlianska
            </h1>
            <div className="track">
              <i style={{ width: `${progress.frac * 100}%` }} />
            </div>
            <div className="dim">{progress.label}…</div>
            <p className="quote" style={{ textAlign: 'left', marginTop: 26 }}>
              {quote}
            </p>
          </div>
        </div>
      )}
      {game && (
        <GameCtx.Provider value={game}>
          {mode === 'menu' && (
            <div className="menu">
              <div className="side">
                <div className="logo">
                  <Emblem side="JUG" size={84} />
                  <h1 className="title">
                    <span>Sombras de</span>Vlianska
                  </h1>
                </div>
                <p className="tagline">
                  Enero de 2033. Veinte años después de las bombas, ocho facciones se reparten las dieciséis estaciones del metro. Tú no eres ninguna de ellas. Todavía.
                </p>
                <button className="btn big" onClick={() => setMode('nueva')}>
                  <Icon id="play" size={17} /> Nueva partida
                </button>
                <button className="btn big" disabled={!listSaves().length} onClick={() => setMenuView('cargar')}>
                  <Icon id="guardar" size={17} /> Continuar
                </button>
                <button className="btn big" onClick={() => setMenuView('cronica')}>
                  <Icon id="cronica" size={17} /> Crónica del metro
                </button>
                <button className="btn big" onClick={() => setMenuView('ayuda')}>
                  <Icon id="ayuda" size={17} /> Cómo se juega
                </button>
                <button className="btn big" onClick={() => setMenuView('ajustes')}>
                  <Icon id="ajustes" size={17} /> Ajustes
                </button>
                <div className="sp" />
                <div className="dim" style={{ fontSize: 12 }}>
                  Universo, historia y mapa de Vlianska: Noel619.
                </div>
              </div>
              {menuView === 'cronica' && (
                <Win title="Crónica del metro" icon="cronica" onClose={() => setMenuView('main')} width={780} cls="lore">
                  {LORE.map((ch) => (
                    <section key={ch.title}>
                      <h3>{ch.title}</h3>
                      {ch.paragraphs.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </section>
                  ))}
                </Win>
              )}
              {menuView === 'ayuda' && (
                <Win title="Cómo se juega" icon="ayuda" onClose={() => setMenuView('main')} width={700}>
                  <HelpBody />
                </Win>
              )}
              {menuView === 'ajustes' && (
                <Win title="Ajustes" icon="ajustes" onClose={() => setMenuView('main')} width={460}>
                  <SettingsBody />
                </Win>
              )}
              {menuView === 'cargar' && (
                <Win title="Continuar" icon="guardar" onClose={() => setMenuView('main')} width={620}>
                  <div className="list" style={{ gap: 5 }}>
                    {listSaves().map((m) => (
                      <button
                        key={m.slot}
                        className="btn"
                        style={{ textAlign: 'left' }}
                        onClick={() => {
                          const st = loadGame(m.slot);
                          if (st) {
                            game.loadState(st);
                            setMode('juego');
                          }
                        }}
                      >
                        <Icon id="guardar" size={14} /> {m.name} · día {m.day} · {m.squad} en la escuadra · {m.slot === 'auto' ? 'autoguardado' : m.slot === 'rapido' ? 'guardado rápido' : m.slot} · {new Date(m.when).toLocaleString('es-ES')}
                      </button>
                    ))}
                  </div>
                </Win>
              )}
            </div>
          )}
          {mode === 'nueva' && (
            <NewGame
              back={() => setMode('menu')}
              start={(scenario, name, color) => {
                game.startNew({ scenario, name, color });
                game.paused = true;
                setScreen(null);
                setMode('juego');
              }}
            />
          )}
          {mode === 'juego' && (
            <div className="ui">
              <TopBar open={setScreen} />
              <SquadBar />
              <SelectionPanel />
              <InspectPanel />
              <ThingPanel />
              <LogView />
              <Overlays />
              <ContextMenuView />
              <PanelView />
              {screen === 'construir' && <BuildScreen close={() => setScreen(null)} />}
              {screen === 'investigar' && <ResearchScreen close={() => setScreen(null)} />}
              {screen === 'mapa' && <MapScreen close={() => setScreen(null)} />}
              {screen === 'facciones' && <FactionsScreen close={() => setScreen(null)} />}
              {screen === 'cronica' && <CodexScreen close={() => setScreen(null)} />}
              {screen === 'registro' && <LogScreen close={() => setScreen(null)} />}
              {screen === 'pausa' && <PauseScreen close={() => setScreen(null)} exit={exit} open={setScreen} />}
              {dead && <GameOver exit={exit} />}
            </div>
          )}
        </GameCtx.Provider>
      )}
    </>
  );
}

function NewGame({ back, start }: { back: () => void; start: (scenario: string, name: string, color: number) => void }) {
  const [sel, setSel] = useState(SCENARIOS[0].id);
  const [name, setName] = useState('Los Sin Nombre');
  const [color, setColor] = useState(COLORS[0]);
  const sc = SCENARIOS.find((s) => s.id === sel)!;
  // Lo que lleva la escuadra al empezar, sumado
  const kitMap = new Map<string, number>();
  for (const m of sc.members) {
    if (m.weapon) kitMap.set(m.weapon, (kitMap.get(m.weapon) ?? 0) + 1);
    for (const a of m.armor ?? []) kitMap.set(a, (kitMap.get(a) ?? 0) + 1);
    for (const [id, n] of m.items ?? []) kitMap.set(id, (kitMap.get(id) ?? 0) + n);
  }
  const kit = [...kitMap].filter(([id]) => ITEMS[id]);
  return (
    <div className="shade">
      <div className="panel win newgame">
        <header>
          <Icon id="play" size={20} className="hic" />
          <h2>Nueva partida</h2>
          <button className="x" onClick={back} aria-label="Cerrar">
            <Icon id="cerrar" size={13} />
          </button>
        </header>
        <div className="body">
          <div className="cols">
            <div className="col">
              {SCENARIOS.map((s) => (
                <button key={s.id} className={'card scen' + (s.id === sel ? ' sel' : '')} onClick={() => setSel(s.id)}>
                  <h4>{s.name}</h4>
                  <small className="row">
                    <Icon id="escuadra" size={12} /> {s.members.length} · <span className={'diff d-' + s.difficulty.replace(/\s/g, '')}>{s.difficulty}</span>
                  </small>
                </button>
              ))}
            </div>
            <div className="col lore" style={{ gap: 4 }}>
              <h3 style={{ marginTop: 0 }}>{sc.name}</h3>
              {sc.intro.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              <div className="startkit">
                <span className="chip" title="Cartuchos para empezar">
                  <ItemSprite id="cartucho" size={22} />
                  {sc.money}
                </span>
                <span className="chip" title="Gente en la escuadra">
                  <Icon id="escuadra" size={15} />
                  {sc.members.length}
                </span>
                {kit.map(([id, n]) => (
                  <span key={id} className="chip" title={ITEMS[id]?.name}>
                    <ItemSprite id={id} size={24} />
                    {n > 1 ? n : ''}
                  </span>
                ))}
              </div>
              <div className="sp" />
              <label className="dim">Nombre de tu gente</label>
              <input className="txt" value={name} maxLength={28} onChange={(e) => setName(e.target.value)} />
              <label className="dim" style={{ marginTop: 6 }}>
                Color del brazalete
              </label>
              <div className="swatches">
                {COLORS.map((c) => (
                  <div key={c} className={'swatch' + (c === color ? ' on' : '')} onClick={() => setColor(c)}>
                    <Emblem side="JUG" size={34} playerColor={hex(c)} />
                  </div>
                ))}
              </div>
              <div className="row" style={{ marginTop: 14 }}>
                <button className="btn big" onClick={() => start(sel, name.trim() || 'Los Sin Nombre', color)}>
                  <Icon id="play" size={17} /> Bajar al metro
                </button>
                <button className="btn" onClick={back}>
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
