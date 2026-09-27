// Ventanas modales de la partida: eventos, paz, menú y final.
import { useEffect, useRef, useState } from 'react';
import { EVENTS, FACTIONS, STATIONS } from '../../data';
import { FACTION_IDS } from '../../game/types';
import { answerEvent, eventText } from '../../game/events';
import { resolvePeaceOffer } from '../../game/diplomacy';
import { check } from '../../game/conditions';
import { describeEffects } from '../../game/describe';
import { formatDate, formatMonth } from '../../game/time';
import { controlledStations, ownedStations, populationOf } from '../../game/helpers';
import { deserialize, serialize } from '../../game/save';
import { Emblem, EventScene } from '../components/art';
import { Icon, Lines, Modal, Tip, fmt } from '../components/core';
import { deleteSave, listSaves, loadGame, newSlotId, saveGame, type SaveMeta } from '../saves';
import { go, store, ui, useGame } from '../store';

export function EventModal() {
  const state = useGame();
  const pe = state.playerEvents[0];
  if (!pe) return null;
  const ev = EVENTS[pe.id];
  if (!ev) {
    return (
      <Modal>
        <p>Evento desconocido.</p>
        <button className="btn" onClick={() => store.act((s) => (s.playerEvents = s.playerEvents.slice(1)))}>
          Continuar
        </button>
      </Modal>
    );
  }
  const ctx = { root: state.player!, from: pe.from, target: pe.target };
  return (
    <Modal className="event-modal">
      <div className="event-picture">
        <EventScene picture={ev.picture} from={pe.from ?? null} player={state.player ?? null} />
        {pe.from && pe.from !== state.player && <Emblem faction={pe.from} size={50} className="event-from" />}
      </div>
      <div className="event-body">
        <div className="label">{formatDate(pe.hour)}{state.playerEvents.length > 1 ? ` · ${state.playerEvents.length - 1} evento(s) más` : ''}</div>
        <h2>{eventText(ev.title, ctx)}</h2>
        <p className="event-text">{eventText(ev.desc, ctx)}</p>
        <div className="event-options">
          {ev.options.map((o, i) => {
            const ok = check(state, o.available, ctx);
            return (
              <Tip
                key={i}
                as="div"
                content={() => {
                  const lines = describeEffects(o.effects, state, ctx);
                  return lines.length ? <Lines lines={lines} /> : <div className="dim">Sin efectos directos.</div>;
                }}
              >
                <button className="btn event-option" disabled={!ok} onClick={() => store.act((s) => answerEvent(s, pe.uid, i))}>
                  {eventText(o.name, ctx)}
                </button>
              </Tip>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export function PeaceModal() {
  const state = useGame();
  const offer = state.peaceOffers[0];
  if (!offer) return null;
  return (
    <Modal className="peace-modal">
      <header className="modal-head">
        <Icon name="Flag" size={22} className="amber" />
        <h2>Conferencia de paz</h2>
      </header>
      <div className="peace-body">
        <Emblem faction={offer.loser} size={72} />
        <div>
          <p>
            <strong>{FACTIONS[offer.loser].name}</strong> ha capitulado. Las estaciones que ocupábamos ya son nuestras. Aún conserva:
          </p>
          <ul>
            {offer.stations.map((s) => (
              <li key={s}>{STATIONS[s].name}</li>
            ))}
          </ul>
          <p className="dim">Anexionar nos da todo, pero las estaciones no integradas rinden menos y pueden sublevarse. Un protectorado conserva su gobierno, lucha a nuestro lado y nos entrega parte de sus talleres.</p>
        </div>
      </div>
      <div className="confirm-actions">
        <button className="btn" onClick={() => store.act((s) => resolvePeaceOffer(s, offer.uid, 'protectorado'))}>
          <Icon name="Handshake" size={16} /> Protectorado
        </button>
        <button className="btn primary" onClick={() => store.act((s) => resolvePeaceOffer(s, offer.uid, 'anexionar'))}>
          <Icon name="Flag" size={16} /> Anexionar
        </button>
      </div>
    </Modal>
  );
}

function SaveList({ onLoad, allowDelete }: { onLoad?: (m: SaveMeta) => void; allowDelete?: boolean }) {
  const [saves, setSaves] = useState(listSaves());
  if (saves.length === 0) return <div className="dim">No hay partidas guardadas en este navegador.</div>;
  return (
    <div className="save-list">
      {saves.map((m) => (
        <div key={m.slot} className="save-item">
          <div>
            <strong>{m.name}</strong>
            <div className="dim">
              {m.faction} · {m.date}
            </div>
          </div>
          <div className="save-actions">
            {onLoad && (
              <button className="btn small" onClick={() => onLoad(m)}>
                Cargar
              </button>
            )}
            {allowDelete && (
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
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImportSave({ onLoaded }: { onLoaded: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            store.setState(deserialize(text));
            onLoaded();
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : 'No se pudo leer el archivo.');
          }
        }}
      />
      <button className="btn small ghost" onClick={() => input.current?.click()}>
        <Icon name="Upload" size={14} /> Importar desde archivo
      </button>
      {err && <div className="bad">{err}</div>}
    </div>
  );
}

export function GameMenu() {
  const state = useGame();
  const [tab, setTab] = useState<'main' | 'save' | 'load' | 'settings'>('main');
  const [name, setName] = useState(`${state.player ? FACTIONS[state.player].shortName : 'Partida'} · ${formatMonth(state.hour)}`);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const close = () => ui.set({ menuOpen: false });
  useEffect(() => {
    store.setSpeed(0);
  }, []);

  return (
    <Modal onClose={close} className="menu-modal">
      <header className="modal-head">
        <Icon name="Menu" size={20} className="amber" />
        <h2>{tab === 'main' ? 'Menú' : tab === 'save' ? 'Guardar partida' : tab === 'load' ? 'Cargar partida' : 'Ajustes'}</h2>
        <button className="btn icon ghost" onClick={close} aria-label="Cerrar">
          <Icon name="X" size={18} />
        </button>
      </header>
      {tab === 'main' && (
        <div className="menu-buttons">
          <button className="btn" onClick={close}>
            <Icon name="Play" size={16} /> Volver a la partida
          </button>
          <button className="btn" onClick={() => setTab('save')}>
            <Icon name="Save" size={16} /> Guardar partida
          </button>
          <button className="btn" onClick={() => setTab('load')}>
            <Icon name="FolderOpen" size={16} /> Cargar partida
          </button>
          <button className="btn" onClick={() => setTab('settings')}>
            <Icon name="Settings" size={16} /> Ajustes
          </button>
          <button className="btn" onClick={() => ui.set({ helpOpen: true, menuOpen: false })}>
            <Icon name="CircleHelp" size={16} /> Cómo jugar
          </button>
          <button
            className="btn danger"
            onClick={() => {
              close();
              store.setState(null);
              go('menu');
            }}
          >
            <Icon name="LogOut" size={16} /> Salir al menú principal
          </button>
        </div>
      )}
      {tab === 'save' && (
        <div className="menu-save">
          <label className="label" htmlFor="save-name">
            Nombre
          </label>
          <div className="row">
            <input id="save-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            <button
              className="btn primary"
              onClick={() => {
                const r = saveGame(state, newSlotId(), name);
                setMsg(r.ok ? 'Partida guardada.' : r.error ?? 'Error al guardar.');
              }}
            >
              Guardar
            </button>
          </div>
          {msg && <div className={msg.startsWith('Partida') ? 'good' : 'bad'}>{msg}</div>}
          <div className="hint">Las partidas se guardan en este navegador. Para llevarlas a otro equipo, copia el código de la partida.</div>
          <button
            className="btn small ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(serialize(state));
                setCopied(true);
              } catch {
                setCopied(false);
                setMsg('No se pudo copiar al portapapeles.');
              }
            }}
          >
            <Icon name="Copy" size={14} /> {copied ? 'Copiado' : 'Copiar código de la partida'}
          </button>
          <SaveList allowDelete />
        </div>
      )}
      {tab === 'load' && (
        <div className="menu-save">
          <SaveList
            allowDelete
            onLoad={(m) => {
              const s = loadGame(m.slot);
              if (s) {
                store.setState(s);
                close();
              } else setMsg('No se pudo cargar la partida.');
            }}
          />
          <ImportSave onLoaded={close} />
          {msg && <div className="bad">{msg}</div>}
        </div>
      )}
      {tab === 'settings' && <SettingsForm />}
      {tab !== 'main' && (
        <button className="btn small ghost back" onClick={() => setTab('main')}>
          <Icon name="ChevronLeft" size={14} /> Volver
        </button>
      )}
    </Modal>
  );
}

export function SettingsForm() {
  useGame();
  const s = store.settings;
  return (
    <div className="settings">
      <label className="toggle">
        <input type="checkbox" checked={s.pauseOnEvents} onChange={(e) => store.updateSettings({ pauseOnEvents: e.target.checked })} />
        Pausar cuando llega un evento
      </label>
      <label className="toggle">
        <input type="checkbox" checked={s.autosave} onChange={(e) => store.updateSettings({ autosave: e.target.checked })} />
        Autoguardado mensual
      </label>
      <label className="toggle">
        <input type="checkbox" checked={s.fog} onChange={(e) => store.updateSettings({ fog: e.target.checked })} />
        Niebla de guerra (solo ves las tropas cercanas)
      </label>
    </div>
  );
}

export function EndModal() {
  const state = useGame();
  const go_ = state.gameOver;
  if (!go_ || store.gameOverSeen) return null;
  const f = state.player;
  const rows = FACTION_IDS.map((id) => ({
    id,
    alive: state.countries[id].alive,
    stations: controlledStations(state, id).length,
    owned: ownedStations(state, id).length,
    pop: populationOf(state, id),
    units: Object.values(state.units).filter((u) => u.owner === id).length,
  })).sort((a, b) => b.stations - a.stations || b.pop - a.pop);
  return (
    <Modal className="end-modal">
      <header className="modal-head">
        <Icon name={go_.victory ? 'Crown' : f && !state.countries[f].alive ? 'Skull' : 'Flag'} size={24} className="amber" />
        <h2>{go_.victory ? 'Victoria' : f && !state.countries[f].alive ? 'Derrota' : 'Fin de la partida'}</h2>
      </header>
      <p className="end-text">{go_.reason}</p>
      <table className="table">
        <thead>
          <tr>
            <th>Facción</th>
            <th>Estaciones</th>
            <th>Población</th>
            <th>Unidades</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.id === f ? 'mine' : ''}>
              <td>
                <Emblem faction={r.id} size={20} /> {FACTIONS[r.id].name} {!r.alive && <span className="dim">(desaparecida)</span>}
              </td>
              <td className="num">{r.stations}</td>
              <td className="num">{fmt(r.pop)}</td>
              <td className="num">{r.units}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dim">
        {state.stats.battles} batallas · {state.stats.captures} estaciones conquistadas · {formatDate(go_.hour)}
      </div>
      <div className="confirm-actions">
        <button
          className="btn"
          onClick={() => {
            store.setState(null);
            go('menu');
          }}
        >
          Menú principal
        </button>
        {(!f || state.countries[f].alive) && (
          <button
            className="btn primary"
            onClick={() => {
              store.gameOverSeen = true;
              store.emit();
            }}
          >
            Seguir jugando
          </button>
        )}
      </div>
    </Modal>
  );
}
