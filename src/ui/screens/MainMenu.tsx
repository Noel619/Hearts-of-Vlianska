// Menú principal, selección de facción y crónica.
import { useMemo, useState } from 'react';
import { FACTIONS, FACTION_LIST, IDEOLOGIES, LEADERS, STATIONS } from '../../data';
import { LORE } from '../../data/lore';
import type { Difficulty, FactionId } from '../../game/types';
import { newGame } from '../../game/state';
import { ownedStations, populationOf } from '../../game/helpers';
import { MapView } from '../map/MapView';
import { Emblem, Portrait } from '../components/art';
import { Icon, Modal, TooltipLayer, fmt } from '../components/core';
import { AUTOSAVE_SLOT, hasAutosave, loadGame } from '../saves';
import { go, nav, store, ui } from '../store';
import { ImportSave } from '../game/Modals';
import { HelpModal } from './Help';
import { deleteSave, listSaves } from '../saves';

function LoadModal({ onClose }: { onClose: () => void }) {
  const [saves, setSaves] = useState(listSaves());
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal onClose={onClose} className="menu-modal">
      <header className="modal-head">
        <Icon name="FolderOpen" size={20} className="amber" />
        <h2>Cargar partida</h2>
        <button className="btn icon ghost" onClick={onClose} aria-label="Cerrar">
          <Icon name="X" size={18} />
        </button>
      </header>
      <div className="save-list">
        {saves.length === 0 && <div className="dim">No hay partidas guardadas en este navegador.</div>}
        {saves.map((m) => (
          <div key={m.slot} className="save-item">
            <div>
              <strong>{m.name}</strong>
              <div className="dim">
                {m.faction} · {m.date}
              </div>
            </div>
            <div className="save-actions">
              <button
                className="btn small"
                onClick={() => {
                  const s = loadGame(m.slot);
                  if (!s) {
                    setErr('No se pudo cargar la partida.');
                    return;
                  }
                  store.setState(s);
                  go('game');
                }}
              >
                Cargar
              </button>
              <button
                className="btn icon small ghost"
                onClick={() => {
                  deleteSave(m.slot);
                  setSaves(listSaves());
                }}
                aria-label="Borrar"
              >
                <Icon name="Trash2" size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <ImportSave onLoaded={() => go('game')} />
      {err && <div className="bad">{err}</div>}
    </Modal>
  );
}

export function MainMenu() {
  const n = nav.use();
  const demo = useMemo(() => newGame({ player: null, seed: 2033 }), []);
  const canContinue = hasAutosave();
  return (
    <div className="menu-screen">
      <div className="menu-map">
        <MapView mode="demo" state={demo} />
      </div>
      <div className="menu-shade" />
      <div className="menu-content">
        <div className="menu-title">
          <span className="menu-kicker">Óblast de Múrmansk · 2033</span>
          <h1>
            Hearts of <span>Vlianska</span>
          </h1>
          <p className="menu-sub">Veinte años después de las bombas, ocho facciones se disputan los túneles del metro. Gobierna la tuya.</p>
        </div>
        <div className="menu-actions">
          {canContinue && (
            <button
              className="btn primary big"
              onClick={() => {
                const s = loadGame(AUTOSAVE_SLOT);
                if (s) {
                  store.setState(s);
                  go('game');
                }
              }}
            >
              <Icon name="Play" size={18} /> Continuar
            </button>
          )}
          <button className={`btn big ${canContinue ? '' : 'primary'}`} onClick={() => go('setup')}>
            <Icon name="Flag" size={18} /> Nueva partida
          </button>
          <button className="btn big" onClick={() => nav.set({ loadOpen: true })}>
            <Icon name="FolderOpen" size={18} /> Cargar partida
          </button>
          <button className="btn big" onClick={() => go('lore')}>
            <Icon name="BookOpen" size={18} /> Crónica del metro
          </button>
          <button className="btn big" onClick={() => nav.set({ helpOpen: true })}>
            <Icon name="CircleHelp" size={18} /> Cómo jugar
          </button>
        </div>
        <footer className="menu-footer">
          <span>Universo, historia y mapa de Vlianska: Noel619.</span>
          <span>Un juego de gran estrategia inspirado en Hearts of Iron IV y Metro 2033.</span>
        </footer>
      </div>
      {n.loadOpen && <LoadModal onClose={() => nav.set({ loadOpen: false })} />}
      {n.helpOpen && <HelpModal onClose={() => nav.set({ helpOpen: false })} />}
      <TooltipLayer />
    </div>
  );
}

const DIFFICULTIES: { id: Difficulty; name: string; desc: string }[] = [
  { id: 'facil', name: 'Recluta', desc: 'Más producción y estabilidad para ti; la IA es algo más débil.' },
  { id: 'normal', name: 'Veterano', desc: 'Las reglas son iguales para todos.' },
  { id: 'dificil', name: 'Élite', desc: 'La IA produce, investiga y combate mejor.' },
];

const DIFF_CLASS: Record<string, string> = { Fácil: 'good', Normal: '', Difícil: 'warn', 'Muy difícil': 'bad' };

export function FactionSelect() {
  const [sel, setSel] = useState<FactionId>('UNI');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [historical, setHistorical] = useState(true);
  const preview = useMemo(() => newGame({ player: null, seed: 7 }), []);
  const def = FACTIONS[sel];
  const leader = LEADERS[def.leader];
  const c = preview.countries[sel];

  const start = () => {
    const s = newGame({ player: sel, difficulty, historicalAI: historical });
    store.setState(s);
    ui.set({ panel: null, overlay: null, selectedProvince: s.countries[sel].capital });
    go('game');
    store.setSpeed(0);
  };

  return (
    <div className="setup-screen">
      <header className="setup-head">
        <button className="btn ghost" onClick={() => go('menu')}>
          <Icon name="ChevronLeft" size={16} /> Menú
        </button>
        <h1>Elige tu facción</h1>
        <span className="dim">1 de enero de 2033</span>
      </header>
      <div className="setup-body">
        <nav className="setup-list" aria-label="Facciones">
          {FACTION_LIST.map((f) => (
            <button key={f.id} className={`setup-faction ${sel === f.id ? 'active' : ''}`} onClick={() => setSel(f.id)} style={{ ['--fc' as string]: f.color }}>
              <Emblem faction={f.id} size={40} />
              <div>
                <strong>{f.name}</strong>
                <span className={`diff ${DIFF_CLASS[f.difficulty]}`}>{f.difficulty}</span>
              </div>
            </button>
          ))}
        </nav>
        <div className="setup-map">
          <MapView mode="preview" state={preview} highlight={sel} onPickFaction={setSel} />
        </div>
        <article className="setup-detail">
          <div className="setup-leader">
            <Portrait p={leader.portrait} size={110} />
            <div>
              <div className="label">{def.government}</div>
              <h2 style={{ color: def.color }}>{def.name}</h2>
              <div>{leader.name}</div>
              <div className="dim">{leader.title}</div>
              <div style={{ color: IDEOLOGIES[def.ideology].color }}>{IDEOLOGIES[def.ideology].name}</div>
            </div>
          </div>
          <p className="setup-summary">{def.summary}</p>
          <div className="setup-stats">
            <div>
              <span className="label">Estaciones</span>
              <strong className="num">{ownedStations(preview, sel).length}</strong>
            </div>
            <div>
              <span className="label">Población</span>
              <strong className="num">{fmt(populationOf(preview, sel))}</strong>
            </div>
            <div>
              <span className="label">Talleres</span>
              <strong className="num">
                {fmt(c.derived.civTotal, 0)} / {fmt(c.derived.milTotal, 0)}
              </strong>
            </div>
            <div>
              <span className="label">Unidades</span>
              <strong className="num">{Object.values(preview.units).filter((u) => u.owner === sel).length}</strong>
            </div>
          </div>
          <div className="setup-goals">
            <div className="label">Objetivos</div>
            <ul>
              {def.goals.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
          <div className="setup-lore">
            {def.lore.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <div className="dim">Estaciones: {ownedStations(preview, sel).map((s) => STATIONS[s].shortName).join(', ')}</div>
          </div>
        </article>
      </div>
      <footer className="setup-foot">
        <div className="setup-options">
          <div className="difficulty" role="radiogroup" aria-label="Dificultad">
            {DIFFICULTIES.map((d) => (
              <button key={d.id} className={`btn small ${difficulty === d.id ? 'primary' : 'ghost'}`} onClick={() => setDifficulty(d.id)} title={d.desc} role="radio" aria-checked={difficulty === d.id}>
                {d.name}
              </button>
            ))}
          </div>
          <label className="toggle">
            <input type="checkbox" checked={historical} onChange={(e) => setHistorical(e.target.checked)} />
            IA histórica (las facciones siguen su historia)
          </label>
        </div>
        <button className="btn primary big" onClick={start}>
          <Icon name="Play" size={18} /> Empezar como {def.shortName}
        </button>
      </footer>
      <TooltipLayer />
    </div>
  );
}

export function LoreScreen() {
  const [ch, setCh] = useState(0);
  return (
    <div className="lore-screen">
      <header className="setup-head">
        <button className="btn ghost" onClick={() => go('menu')}>
          <Icon name="ChevronLeft" size={16} /> Menú
        </button>
        <h1>Crónica del metro</h1>
        <span />
      </header>
      <div className="lore-body">
        <nav className="lore-nav">
          {LORE.map((c, i) => (
            <button key={c.title} className={`help-tab ${i === ch ? 'active' : ''}`} onClick={() => setCh(i)}>
              {c.title}
            </button>
          ))}
          {(['STA', 'VHL'] as FactionId[]).map((f) => (
            <button key={f} className={`help-tab ${ch === 100 + (f === 'STA' ? 0 : 1) ? 'active' : ''}`} onClick={() => setCh(100 + (f === 'STA' ? 0 : 1))}>
              {FACTIONS[f].name}
            </button>
          ))}
        </nav>
        <article className="lore-text">
          {ch < 100 ? (
            <>
              <h2>{LORE[ch].title}</h2>
              {LORE[ch].paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </>
          ) : (
            (() => {
              const f: FactionId = ch === 100 ? 'STA' : 'VHL';
              return (
                <>
                  <h2>{FACTIONS[f].name}</h2>
                  {FACTIONS[f].lore.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </>
              );
            })()
          )}
        </article>
      </div>
    </div>
  );
}
