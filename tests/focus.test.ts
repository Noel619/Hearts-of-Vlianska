import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game/state';
import { advanceDays } from '../src/game/engine';
import { answerEvent } from '../src/game/events';
import { completeFocus, focusStatus, startFocus } from '../src/game/focus';
import { canJustify } from '../src/game/diplomacy';
import { hasAccess } from '../src/game/helpers';
import { modSources } from '../src/game/modifiers';
import { FOCUS_TREES, EVENTS } from '../src/data';
import type { FactionId, GameState } from '../src/game/types';

/** Completa un enfoque del jugador y responde a sus eventos con la opción indicada (o la primera). */
function take(state: GameState, f: FactionId, id: string, answer = 0) {
  expect(focusStatus(state, f, id), `${id} debería estar disponible`).toBe('available');
  completeFocus(state, f, id);
  while (state.playerEvents.length) answerEvent(state, state.playerEvents[0].uid, answer);
}

describe('enfoques: el Califato', () => {
  it('negociar trae comida, pero los comisarios del Levantamiento deciden cada vez más', () => {
    const s = newGame({ player: 'CAL', seed: 1 });
    take(s, 'CAL', 'cal_quinto_invierno');
    take(s, 'CAL', 'cal_tregua'); // La noche de los ancianos: gobiernan Karimov y los ancianos.
    expect(s.countries.CAL.leader).toBe('karimov');
    take(s, 'CAL', 'cal_liberar_cautivos');
    take(s, 'CAL', 'cal_bandera_blanca'); // El Levantamiento (IA) acepta hablar.
    expect(s.countries.CAL.flags.cal_tregua_abierta).toBeDefined();
    take(s, 'CAL', 'cal_corredor'); // El Levantamiento abre el corredor con sus comisarios.
    const spirits = () => s.countries.CAL.spirits.map((x) => x.id);
    expect(spirits()).not.toContain('hambruna');
    expect(spirits()).toContain('cal_comisarios_rojos');
    expect(s.embargoes.some((e) => e.from === 'LEV' && e.to === 'CAL')).toBe(false);
    take(s, 'CAL', 'cal_entregar_culpables');
    take(s, 'CAL', 'cal_comision_mixta');
    // La Comisión Mixta sustituye a los comisarios: sus tropas cruzan nuestros túneles y no podemos atacarles.
    expect(spirits()).toContain('cal_comision');
    expect(spirits()).not.toContain('cal_comisarios_rojos');
    expect(hasAccess(s, 'LEV', 'CAL')).toBe(true);
    expect(canJustify(s, 'CAL', 'LEV').ok).toBe(false);
    // Y se nota en el poder político.
    const drain = modSources(s, 'CAL').find((m) => m.label.includes('Comisión Mixta'));
    expect(drain?.mods.ppDiario).toBeLessThan(0);
    // Mientras dure, la Comisión vuelve cada pocos meses con nuevas exigencias.
    expect(EVENTS.cal_exigencias.once).toBe(false);
    s.player = null;
    advanceDays(s, 400);
    expect(s.countries.CAL.firedEvents.cal_exigencias ?? 0).toBeGreaterThan(0);
  });

  it('recuperar la soberanía expulsa a los comisarios', () => {
    const s = newGame({ player: 'CAL', seed: 2 });
    for (const id of ['cal_quinto_invierno', 'cal_tregua', 'cal_liberar_cautivos', 'cal_bandera_blanca', 'cal_corredor', 'cal_comision_mixta']) take(s, 'CAL', id);
    s.countries.CAL.food = 500;
    s.countries.CAL.derived.foodProd = 50;
    s.countries.CAL.derived.foodCons = 10;
    take(s, 'CAL', 'cal_recuperar_soberania');
    expect(s.countries.CAL.spirits.some((x) => x.id === 'cal_comision')).toBe(false);
    expect(hasAccess(s, 'LEV', 'CAL')).toBe(false);
    expect(focusStatus(s, 'CAL', 'cal_autonomia_tutelada')).toBe('excluded');
  });

  it('abrir las puertas convierte la Esmeralda en protectorado del Levantamiento', () => {
    const s = newGame({ player: 'CAL', seed: 3 });
    take(s, 'CAL', 'cal_quinto_invierno');
    take(s, 'CAL', 'cal_abrir_puertas');
    expect(s.countries.CAL.overlord).toBe('LEV');
    expect(s.countries.CAL.alive).toBe(true);
    take(s, 'CAL', 'cal_amnistia');
    take(s, 'CAL', 'cal_comisarios');
    take(s, 'CAL', 'cal_esmeralda_roja');
    expect(s.countries.CAL.ideology).toBe('comunismo');
    expect(s.countries.CAL.leader).toBe('nasser');
  });

  it('la IA del Califato elige la guerra santa si no está desesperada', () => {
    const s = newGame({ player: null, seed: 4 });
    advanceDays(s, 120);
    const done = s.countries.CAL.focus.done;
    if (s.countries.CAL.alive) {
      expect(done).toContain('cal_guerra_santa');
      expect(done).not.toContain('cal_tregua');
    }
  });
});

describe('enfoques: sistema', () => {
  it('un enfoque sin sentido se omite al instante y sin efectos', () => {
    const s = newGame({ player: 'LEV', seed: 5 });
    completeFocus(s, 'LEV', 'lev_congreso');
    s.countries.CAL.alive = false;
    const pp = s.countries.LEV.pp;
    expect(startFocus(s, 'LEV', 'lev_cuestion_mertvaya')).toBe(true);
    expect(s.countries.LEV.focus.done).toContain('lev_cuestion_mertvaya');
    expect(s.countries.LEV.focus.current).toBeNull();
    expect(s.countries.LEV.pp).toBe(pp);
  });

  it('la Unión ofrece el protectorado a Staraya y la negativa tiene consecuencias', () => {
    const s = newGame({ player: 'STA', seed: 6 });
    completeFocus(s, 'UNI', 'uni_reforzar_staraya');
    completeFocus(s, 'UNI', 'uni_mano_staraya');
    expect(s.countries.STA.spirits.some((x) => x.id === 'sta_mano_union')).toBe(true);
    completeFocus(s, 'UNI', 'uni_protectorado_staraya');
    expect(s.playerEvents.map((e) => e.id)).toContain('uni_oferta_protectorado');
    answerEvent(s, s.playerEvents.find((e) => e.id === 'uni_oferta_protectorado')!.uid, 1);
    expect(s.countries.STA.overlord).toBeUndefined();
    expect(s.countries.STA.spirits.some((x) => x.id === 'sta_mano_union')).toBe(false);
    expect(s.countries.UNI.wargoals.some((w) => w.target === 'STA')).toBe(true);
  });

  it('todos los eventos de los árboles tienen opciones válidas', () => {
    for (const tree of Object.values(FOCUS_TREES)) {
      for (const focus of tree.focuses) {
        for (const e of focus.effects) if (e.t === 'event') expect(EVENTS[e.id]?.options.length).toBeGreaterThan(0);
      }
    }
  });
});
