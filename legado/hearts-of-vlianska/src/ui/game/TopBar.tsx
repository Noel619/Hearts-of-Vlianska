// Barra superior: facción, recursos, tensión, fecha y velocidad.
import type { ReactNode } from 'react';
import { EQUIPMENT, FACTIONS, LAWS, LEADERS } from '../../data';
import type { FactionId, GameState, ModifierKey } from '../../game/types';
import { RESOURCE_IDS } from '../../game/types';
import { formatModValue, modSources } from '../../game/modifiers';
import { BASE_PP } from '../../game/economy';
import { formatDate } from '../../game/time';
import { Emblem } from '../components/art';
import { Icon, Tip, fmt, fmtSigned, pct } from '../components/core';
import { store, ui, useGame } from '../store';
import { MuteButton } from '../components/SoundSettings';

export const RES_NAMES: Record<string, { name: string; icon: string }> = {
  chatarra: { name: 'Chatarra', icon: 'Anvil' },
  polvora: { name: 'Pólvora', icon: 'FlaskConical' },
  combustible: { name: 'Combustible', icon: 'Fuel' },
  alimentos: { name: 'Alimentos', icon: 'Wheat' },
};

export function ModBreakdown({ state, f, keys }: { state: GameState; f: FactionId; keys: ModifierKey[] }) {
  const rows: { label: string; text: string; v: number }[] = [];
  for (const src of modSources(state, f)) {
    for (const k of keys) {
      const v = src.mods[k];
      if (v) rows.push({ label: src.label, text: formatModValue(k, v), v });
    }
  }
  if (!rows.length) return null;
  return (
    <>
      {rows.map((r, i) => (
        <div key={i} className="tt-row">
          <span className="dim">{r.label}</span>
          <span className="num">{r.text}</span>
        </div>
      ))}
    </>
  );
}

function Chip({ icon, value, tip, tone, onClick, label }: { icon: string; value: ReactNode; tip: () => ReactNode; tone?: string; onClick?: () => void; label: string }) {
  return (
    <Tip content={tip} className="top-chip-wrap">
      <button className={`top-chip ${tone ?? ''}`} onClick={onClick} aria-label={label}>
        <Icon name={icon} size={16} />
        <span className="num">{value}</span>
      </button>
    </Tip>
  );
}

export function TopBar() {
  const state = useGame();
  const f = state.player!;
  const c = state.countries[f];
  const d = c.derived;
  const leader = LEADERS[c.leader];
  const foodBal = d.foodProd - d.foodCons + d.foodTrade;
  const resProblems = RESOURCE_IDS.filter((r) => d.resourceRatio[r] < 0.999);

  return (
    <header className="topbar">
      <Tip content={() => <div><h4>{FACTIONS[f].name}</h4><div className="dim">{leader?.name} · {leader?.title}</div><div className="faint">Clic: gobierno</div></div>}>
        <button className="top-faction" onClick={() => ui.set({ panel: 'politica', overlay: null })} aria-label="Gobierno">
          <Emblem faction={f} size={38} />
          <span className="top-faction-name">{FACTIONS[f].shortName}</span>
        </button>
      </Tip>

      <div className="top-chips">
        <Chip
          icon="Landmark"
          label="Poder político"
          value={`${fmt(c.pp)} (${fmtSigned(d.ppGain, 2)})`}
          onClick={() => ui.set({ panel: 'politica' })}
          tip={() => (
            <div>
              <h4>Poder político</h4>
              <div className="tt-desc">Se gasta en leyes, asesores, decisiones y diplomacia.</div>
              <div className="tt-row"><span>Base</span><span className="num">+{BASE_PP}</span></div>
              <ModBreakdown state={state} f={f} keys={['ppDiario']} />
              <div className="tt-row"><span>Factor de estabilidad</span><span className="num">×{fmt(1 + (d.stability - 0.5) * 0.6, 2)}</span></div>
              <div className="tt-sep" />
              <div className="tt-row"><span>Ganancia diaria</span><span className="num good">{fmtSigned(d.ppGain, 2)}</span></div>
            </div>
          )}
        />
        <Chip
          icon="Scale"
          label="Estabilidad"
          value={pct(d.stability)}
          tone={d.stability < 0.35 ? 'bad' : d.stability > 0.7 ? 'good' : ''}
          tip={() => (
            <div>
              <h4>Estabilidad</h4>
              <div className="tt-desc">Por debajo del 50 % se reduce la producción. Por debajo del 30 %, crecen las revueltas.</div>
              <div className="tt-row"><span>Base</span><span className="num">{pct(c.stabilityBase)}</span></div>
              <ModBreakdown state={state} f={f} keys={['estabilidad']} />
              {d.famine > 0 && <div className="tt-row bad"><span>Hambruna</span><span className="num">−{pct(d.famine * 0.3)}</span></div>}
            </div>
          )}
        />
        <Chip
          icon="Swords"
          label="Apoyo a la guerra"
          value={pct(d.warSupport)}
          tone={d.warSupport < 0.3 ? 'bad' : ''}
          tip={() => (
            <div>
              <h4>Apoyo a la guerra</h4>
              <div className="tt-desc">Permite leyes de reclutamiento y economía más duras y retrasa la capitulación.</div>
              <div className="tt-row"><span>Base</span><span className="num">{pct(c.warSupportBase)}</span></div>
              <ModBreakdown state={state} f={f} keys={['apoyoGuerra']} />
              {state.wars.some((w) => w.defenders.includes(f)) && <div className="tt-row good"><span>Guerra defensiva</span><span className="num">+10 %</span></div>}
              {c.recentLosses > 0 && <div className="tt-row bad"><span>Bajas recientes</span><span className="num">−{pct(Math.min(0.25, (c.recentLosses / Math.max(1, d.population)) * 4))}</span></div>}
            </div>
          )}
        />
        <Chip
          icon="Users"
          label="Mano de obra"
          value={`${fmt(d.manpowerAvailable)}`}
          tone={d.manpowerAvailable < 20 ? 'bad' : ''}
          onClick={() => ui.set({ panel: 'ejercito' })}
          tip={() => (
            <div>
              <h4>Mano de obra</h4>
              <div className="tt-desc">Hombres disponibles para reclutar y reforzar unidades.</div>
              <div className="tt-row"><span>Población</span><span className="num">{fmt(d.population)}</span></div>
              <div className="tt-row"><span>Ley: {LAWS[c.laws.reclutamiento].name}</span><span className="num">{pct(LAWS[c.laws.reclutamiento].value ?? 0)}</span></div>
              <ModBreakdown state={state} f={f} keys={['reclutables', 'manoObra']} />
              <div className="tt-sep" />
              <div className="tt-row"><span>Máximo reclutable</span><span className="num">{fmt(d.manpowerMax)}</span></div>
              <div className="tt-row"><span>En uso (tropas e instrucción)</span><span className="num">{fmt(d.manpowerUsed)}</span></div>
              <div className="tt-row"><span>Disponible</span><span className="num good">{fmt(d.manpowerAvailable)}</span></div>
            </div>
          )}
        />
        <Chip
          icon="Store"
          label="Talleres civiles"
          value={`${fmt(d.civAvailable, 1)}/${fmt(d.civTotal, 1)}`}
          onClick={() => ui.set({ panel: 'construccion' })}
          tip={() => (
            <div>
              <h4>Talleres civiles</h4>
              <div className="tt-desc">Construyen edificios y pagan el comercio. Parte se dedica a bienes de consumo.</div>
              <div className="tt-row"><span>Total</span><span className="num">{fmt(d.civTotal, 1)}</span></div>
              <div className="tt-row"><span>Bienes de consumo</span><span className="num bad">−{fmt(d.civConsumer, 1)}</span></div>
              <div className="tt-row"><span>Importaciones</span><span className="num bad">−{fmt(d.civTrade, 1)}</span></div>
              <div className="tt-sep" />
              <div className="tt-row"><span>Disponibles para construir</span><span className="num good">{fmt(d.civAvailable, 1)}</span></div>
            </div>
          )}
        />
        <Chip
          icon="Factory"
          label="Talleres militares"
          value={`${fmt(d.milAssigned)}/${fmt(d.milTotal, 1)}`}
          tone={d.milAssigned < Math.floor(d.milTotal) ? 'warn' : ''}
          onClick={() => ui.set({ panel: 'produccion' })}
          tip={() => (
            <div>
              <h4>Talleres militares</h4>
              <div className="tt-desc">Fabrican equipo en las líneas de producción.</div>
              <div className="tt-row"><span>Disponibles</span><span className="num">{fmt(d.milTotal, 1)}</span></div>
              <div className="tt-row"><span>Asignados</span><span className="num">{fmt(d.milAssigned)}</span></div>
              <div className="tt-sep" />
              {Object.values(EQUIPMENT).map((e) => (
                <div key={e.id} className="tt-row"><span>{e.name}</span><span className="num">{fmt(c.stockpile[e.id])}</span></div>
              ))}
            </div>
          )}
        />
        <Chip
          icon="Wheat"
          label="Comida"
          value={`${fmt(c.food)} (${fmtSigned(foodBal, 1)})`}
          tone={foodBal < 0 ? (c.food < 60 ? 'bad' : 'warn') : ''}
          onClick={() => ui.set({ panel: 'comercio' })}
          tip={() => (
            <div>
              <h4>Comida</h4>
              <div className="tt-desc">Granjas de hongos y cerdos. Si las reservas se agotan, llega la hambruna.</div>
              <div className="tt-row"><span>Producción</span><span className="num good">+{fmt(d.foodProd, 1)}</span></div>
              <div className="tt-row"><span>Consumo</span><span className="num bad">−{fmt(d.foodCons, 1)}</span></div>
              <div className="tt-row"><span>Comercio</span><span className="num">{fmtSigned(d.foodTrade, 1)}</span></div>
              <div className="tt-sep" />
              <div className="tt-row"><span>Balance diario</span><span className={`num ${foodBal < 0 ? 'bad' : 'good'}`}>{fmtSigned(foodBal, 1)}</span></div>
              <div className="tt-row"><span>Reservas</span><span className="num">{fmt(c.food)}</span></div>
              {d.famine > 0 && <div className="bad">¡Hambruna! La población disminuye.</div>}
            </div>
          )}
        />
        <Chip
          icon="Package"
          label="Recursos"
          value={resProblems.length ? 'Escasez' : 'OK'}
          tone={resProblems.length ? 'bad' : ''}
          onClick={() => ui.set({ panel: 'comercio' })}
          tip={() => (
            <div>
              <h4>Recursos</h4>
              <div className="tt-desc">Las líneas de producción consumen recursos. Si faltan, producen menos.</div>
              {RESOURCE_IDS.map((r) => {
                const x = d.resources[r];
                return (
                  <div key={r} className="tt-row">
                    <span>{RES_NAMES[r].name}</span>
                    <span className={`num ${x.available < x.used ? 'bad' : ''}`}>
                      {fmt(x.available, 1)} / {fmt(x.used, 1)} usados
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        />
      </div>

      <div className="top-right">
        <Tip content={() => (
          <div>
            <h4>Tensión del metro</h4>
            <div className="tt-desc">Sube con las justificaciones y las guerras. Los gobiernos democráticos y mercantiles necesitan tensión alta para justificar guerras sin reclamaciones.</div>
            <div className="tt-row"><span>Tensión actual</span><span className="num">{pct(state.tension)}</span></div>
          </div>
        )}>
          <div className="tension">
            <Icon name="Radiation" size={16} />
            <div className="tension-bar"><span style={{ width: `${state.tension * 100}%` }} /></div>
            <span className="num">{Math.round(state.tension * 100)}%</span>
          </div>
        </Tip>
        <SpeedControls />
        <MuteButton className="top-mute" />
        <button className="btn icon ghost" onClick={() => ui.set({ menuOpen: true })} aria-label="Menú">
          <Icon name="Menu" size={20} />
        </button>
      </div>
    </header>
  );
}

export function SpeedControls() {
  const state = useGame();
  const speed = store.speed;
  return (
    <div className="speed">
      <div className="speed-date">
        <span className="num">{formatDate(state.hour)}</span>
        <span className="speed-hour num">{String(state.hour % 24).padStart(2, '0')}:00</span>
      </div>
      <button className={`btn icon ${speed === 0 ? 'primary' : ''}`} onClick={() => store.togglePause()} aria-label={speed === 0 ? 'Reanudar' : 'Pausa'}>
        <Icon name={speed === 0 ? 'Play' : 'Pause'} size={18} />
      </button>
      <div className="speed-pips" aria-label="Velocidad">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} className={`pip ${store.lastSpeed >= n ? 'on' : ''} ${speed === 0 ? 'paused' : ''}`} onClick={() => store.setSpeed(n)} aria-label={`Velocidad ${n}`} />
        ))}
      </div>
    </div>
  );
}
