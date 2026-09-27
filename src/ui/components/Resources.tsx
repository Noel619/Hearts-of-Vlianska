// Recursos de las estaciones: iconos con cantidades y explicación de para qué sirve cada uno.
import { EQUIPMENT, STATIONS } from '../../data';
import type { FactionId, GameState, ResourceId } from '../../game/types';
import { RESOURCE_IDS } from '../../game/types';
import { contribution, stationResourceOutput } from '../../game/economy';
import { Icon, Tip, fmt, pct } from './core';

export const RESOURCES: Record<ResourceId, { name: string; icon: string; color: string; desc: string }> = {
  chatarra: { name: 'Chatarra', icon: 'Anvil', color: '#b9b4a8', desc: 'Metal rescatado de trenes, raíles y ruinas.' },
  polvora: { name: 'Pólvora', icon: 'FlaskConical', color: '#e0823f', desc: 'Salitre, azufre y munición desmontada.' },
  combustible: { name: 'Combustible', icon: 'Fuel', color: '#e2c54a', desc: 'Gasóleo de los depósitos y aceite de hongos.' },
};

/** Equipo que consume cada recurso (por taller y día). */
export function resourceUsers(res: ResourceId): string {
  return Object.values(EQUIPMENT)
    .filter((e) => (e.resources[res] ?? 0) > 0)
    .map((e) => `${e.name} (${e.resources[res]})`)
    .join(', ');
}

export function ResourceTip({ state, sid, f }: { state: GameState; sid: string; f: FactionId | null }) {
  const st = state.stations[sid];
  const k = f ? contribution(state, sid, f) : 0;
  return (
    <div>
      <h4>Recursos de {STATIONS[sid].shortName}</h4>
      <div className="tt-desc">Lo que el yacimiento de la estación da cada día a quien la controla.</div>
      {RESOURCE_IDS.map((r) => (
        <div key={r} className="tt-row">
          <span>
            <Icon name={RESOURCES[r].icon} size={13} /> {RESOURCES[r].name}
          </span>
          <span className="num">
            {st.resources[r]}
            {f && k > 0 && st.resources[r] > 0 ? ` → ${fmt(stationResourceOutput(state, sid, f, r), 1)} para ti` : ''}
          </span>
        </div>
      ))}
      {f && k > 0 && k < 1 && <div className="warn">Rinde el {pct(k)}: {st.owner === f ? 'estación sin integrar' : 'ocupación militar'}.</div>}
      {st.buildings.infraestructura > 0 && <div className="dim">Infraestructura: +{st.buildings.infraestructura * 5} % de extracción.</div>}
    </div>
  );
}

/** Iconos de chatarra, pólvora y combustible con la cantidad diaria del yacimiento. */
export function ResourceChips({ state, sid, f, tip = true }: { state: GameState; sid: string; f: FactionId | null; tip?: boolean }) {
  const st = state.stations[sid];
  const chips = (
    <span className="res-chips">
      {RESOURCE_IDS.map((r) => (
        <span key={r} className={`res-chip ${st.resources[r] ? '' : 'none'}`} style={{ color: st.resources[r] ? RESOURCES[r].color : undefined }}>
          <Icon name={RESOURCES[r].icon} size={13} />
          <span className="num">{st.resources[r]}</span>
        </span>
      ))}
    </span>
  );
  return tip ? <Tip content={() => <ResourceTip state={state} sid={sid} f={f} />}>{chips}</Tip> : chips;
}
