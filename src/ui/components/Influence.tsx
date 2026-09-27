// Barras de influencia extranjera (soberanía) para los paneles de gobierno y diplomacia.
import { FACTIONS } from '../../data';
import type { FactionId, GameState } from '../../game/types';
import { INFLUENCE, influenceDrift, influenceOf, influenceStage } from '../../game/influence';
import { Emblem } from './art';
import { Bar, Tip, fmtSigned } from './core';

export function InfluenceTip() {
  return (
    <div>
      <h4>Influencia extranjera</h4>
      <div className="tt-desc">
        Negociar desde la debilidad, pagar tributos o aceptar comisarios da a otra facción poder sobre tus decisiones. Sin presión activa, se desvanece poco a poco.
      </div>
      <div className="tt-row"><span>Cualquier nivel</span><span>resta poder político y extiende su ideología</span></div>
      <div className="tt-row"><span>{INFLUENCE.TUTELAGE} o más</span><span>sus tropas cruzan tus túneles; no puedes justificar una guerra contra ella</span></div>
      <div className="tt-row"><span>{INFLUENCE.CRISIS}</span><span>crisis de soberanía: protectorado o ruptura</span></div>
    </div>
  );
}

export function InfluenceRow({ state, over, by, label }: { state: GameState; over: FactionId; by: FactionId; label?: string }) {
  const level = influenceOf(state, over, by);
  const drift = influenceDrift(state, over, by);
  return (
    <Tip content={() => <InfluenceTip />} as="div" className="influence-row">
      <Emblem faction={by} size={22} />
      <div className="influence-main">
        <div className="influence-head">
          <span>{label ?? FACTIONS[by].name}</span>
          <span className="num">
            {Math.round(level)}
            {drift ? <span className={drift > 0 ? 'bad' : 'good'}> ({fmtSigned(drift, Number.isInteger(drift) ? 0 : 1)}/mes)</span> : null}
          </span>
        </div>
        <Bar value={level / 100} color={level >= INFLUENCE.TUTELAGE ? 'red' : undefined} thin />
        <span className="dim small">{influenceStage(level)}</span>
      </div>
    </Tip>
  );
}

/** Todas las facciones que influyen sobre `f`. */
export function influencers(state: GameState, f: FactionId): FactionId[] {
  const c = state.countries[f];
  return (Object.keys({ ...(c.influence ?? {}), ...(c.influenceDrift ?? {}) }) as FactionId[]).filter(
    (by) => state.countries[by]?.alive && (influenceOf(state, f, by) > 0 || influenceDrift(state, f, by) !== 0),
  );
}
