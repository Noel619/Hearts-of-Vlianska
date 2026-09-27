// Panel contextual: estación/tramo seleccionado o unidades seleccionadas.
import { useState } from 'react';
import { BUILDINGS, DECISIONS, FACTIONS, MAP, STATIONS, TERRAIN_INFO } from '../../data';
import type { Battle, BuildingId, Unit } from '../../game/types';
import { canBuild, contribution, queueBuilding, stationFood } from '../../game/economy';
import { factionName, provinceName } from '../../game/helpers';
import { etaHours, isDefending, stopUnits, unitStats } from '../../game/military';
import { COMBAT } from '../../game/combat';
import { canTakeDecision, takeDecision } from '../../game/decisions';
import { disbandUnit } from '../../game/playerActions';
import { revoltChance } from '../../game/resistance';
import { Emblem } from '../components/art';
import { Bar, Icon, ModLines, Tip, fmt, fmtSigned, pct } from '../components/core';
import { store, ui, useGame } from '../store';
import { visibleProvinces } from '../map/mapUtil';
import { TemplateTooltip } from '../panels/ArmyPanel';

function UnitLine({ u }: { u: Unit }) {
  const state = useGame();
  const s = unitStats(state, u);
  const tpl = state.countries[u.owner].templates.find((t) => t.id === u.template);
  const moving = u.path.length ? `hacia ${provinceName(u.path[u.path.length - 1])} · ${Math.max(1, Math.ceil(etaHours(state, u) / 24))} d` : '';
  const dug = u.dug ?? 0;
  const status = u.battle
    ? isDefending(state, u)
      ? 'Defendiendo'
      : 'Atacando'
    : u.retreating
      ? `Replegándose ${moving}`
      : moving
        ? moving.charAt(0).toUpperCase() + moving.slice(1)
        : dug >= 0.99
          ? 'Atrincherada'
          : dug > 0.05
            ? `Atrincherándose (${pct(dug)})`
            : 'En posición';
  return (
    <div className="sel-unit">
      <Tip content={() => (tpl ? <TemplateTooltip tpl={tpl} /> : <div>{u.name}</div>)} as="div" className="sel-unit-name">
        <Emblem faction={u.owner} size={18} />
        <span>{u.name}</span>
      </Tip>
      <div className="sel-unit-bars">
        <Tip content={`Organización: ${fmt(u.org, 1)} / ${fmt(s.org, 1)}`}>
          <Bar value={u.org / Math.max(1, s.org)} color="green" thin />
        </Tip>
        <Tip content={`Fuerza: ${pct(u.strength)} (${fmt(s.men * u.strength)} hombres)`}>
          <Bar value={u.strength} thin />
        </Tip>
      </div>
      <div className={`sel-unit-status ${u.battle ? 'bad' : ''}`}>
        {status}
        {u.outOfSupply && <span className="bad"> · sin suministro</span>}
      </div>
    </div>
  );
}

function BattleBox({ pid }: { pid: string }) {
  const state = useGame();
  const b = Object.values(state.battles).find((x) => x.province === pid);
  if (!b) return null;
  const side = (ids: string[]) => ids.map((id) => state.units[id]).filter(Boolean) as Unit[];
  return (
    <div className="battle-box">
      <div className="battle-head">
        <Icon name="Swords" size={16} className="bad" /> Batalla · {Math.floor((state.hour - b.start) / 24)} días
      </div>
      <div className="battle-adv">
        <Emblem faction={b.attackerSide} size={20} />
        <Bar value={b.lastAdvantage} color="red" />
        <Emblem faction={b.defenderSide} size={20} />
      </div>
      <div className="battle-sides">
        <div>
          <div className="label">Atacantes</div>
          {side(b.attackers).map((u) => (
            <UnitLine key={u.id} u={u} />
          ))}
        </div>
        <div>
          <div className="label">Defensores</div>
          {side(b.defenders).map((u) => (
            <UnitLine key={u.id} u={u} />
          ))}
        </div>
      </div>
      {b.factors && <BattleFactorsView b={b} />}
      <div className="dim num">
        Bajas: {fmt(b.attackerLosses)} atacantes · {fmt(b.defenderLosses)} defensores
      </div>
      {b.defenders.some((id) => state.units[id]?.owner === state.player) && (
        <div className="hint">Puedes replegar a tus defensores dándoles otra orden de movimiento.</div>
      )}
    </div>
  );
}

function BattleFactorsView({ b }: { b: Battle }) {
  const fx = b.factors!;
  const terrain = TERRAIN_INFO[MAP.provinces[b.province].terrain];
  return (
    <Tip
      as="div"
      content={
        <div>
          <h4>Factores del combate</h4>
          <div className="tt-desc">
            Solo combaten a la vez las unidades que caben en el ancho del frente; el resto espera en reserva y releva a las agotadas (los morteros disparan desde la reserva). Atacar desde más túneles amplía el frente y da bonificación de flanqueo.
          </div>
          <div className="tt-row"><span>Terreno</span><span className="num">{terrain.name} ({fmtSigned(terrain.attack * 100, 0)} % al atacante)</span></div>
          <div className="tt-row"><span>Ancho del frente</span><span className="num">{fmt(fx.width)}</span></div>
          <div className="tt-row"><span>Direcciones de ataque</span><span className="num">{fx.dirs}{fx.dirs >= 2 ? ` (flanqueo ×${fmt(COMBAT.FLANK[Math.min(COMBAT.FLANK.length - 1, fx.dirs)], 2)})` : ''}</span></div>
          <div className="tt-row"><span>Barricadas</span><span className="num">{fx.fort}/5</span></div>
          <div className="tt-row"><span>Atrincheramiento del defensor</span><span className="num">{pct(fx.dig)}</span></div>
          <div className="tt-sep" />
          <div className="tt-row"><span>Fuego efectivo del atacante</span><span className={`num ${fx.attackMod < 1 ? 'bad' : 'good'}`}>×{fmt(fx.attackMod, 2)}</span></div>
          <div className="tt-row"><span>Defensa del defensor</span><span className="num good">×{fmt(fx.defenseMod, 2)}</span></div>
        </div>
      }
    >
      <div className="battle-factors">
        <span><Icon name="MoveHorizontal" size={12} /> {fmt(fx.widthA)}/{fmt(fx.width)} · {fmt(fx.widthD)}/{fmt(fx.width)}</span>
        <span><Icon name="Split" size={12} /> {fx.dirs}</span>
        <span><Icon name="BrickWall" size={12} /> {fx.fort}</span>
        <span><Icon name="Shovel" size={12} /> {pct(fx.dig)}</span>
        <span className={fx.attackMod < 1 ? 'bad' : 'good'}><Icon name="Crosshair" size={12} /> ×{fmt(fx.attackMod, 2)}</span>
      </div>
    </Tip>
  );
}

function ProvincePanel({ pid }: { pid: string }) {
  const state = useGame();
  const f = state.player!;
  const def = MAP.provinces[pid];
  const p = state.provinces[pid];
  const st = state.stations[pid];
  const sdef = STATIONS[pid];
  const tInfo = TERRAIN_INFO[def.terrain];
  const vis = store.settings.fog ? visibleProvinces(state) : null;
  const units = Object.values(state.units).filter((u) => u.province === pid && (!vis || vis.has(pid) || u.owner === f));
  const mine = units.filter((u) => u.owner === f);
  const mineControl = p.controller === f;
  const buildables: BuildingId[] = st ? ['civil', 'militar', 'granja', 'infraestructura', 'fortificacion'] : ['fortificacion'];
  const revolt = st ? revoltChance(state, pid) : null;
  const food = st ? stationFood(state, pid) : null;

  const batida = DECISIONS.dec_batida;
  const excavar = DECISIONS.dec_excavar;
  const colonizar = DECISIONS.dec_recolonizar;
  const canBatida = batida && canTakeDecision(state, f, 'dec_batida', pid);
  const canExcavar = excavar && canTakeDecision(state, f, 'dec_excavar', pid);
  const canColonizar = colonizar && st && !st.owner ? canTakeDecision(state, f, 'dec_recolonizar', pid) : null;

  return (
    <div className="sel-province">
      <header className="sel-head">
        {st ? <Emblem faction={st.owner} size={40} /> : <div className="terrain-dot" style={{ background: p.controller ? FACTIONS[p.controller].color : '#3d3d37' }} />}
        <div>
          <h3>{st ? sdef.name : def.name}</h3>
          <div className="dim">
            {st ? (st.owner ? FACTIONS[st.owner].name : 'Estación abandonada') : `${tInfo.name} · ${p.controller ? factionName(p.controller) : 'tierra de nadie'}`}
          </div>
          {st && p.controller !== st.owner && <div className="bad">Ocupada por {factionName(p.controller)}</div>}
        </div>
        <button className="btn icon ghost" onClick={() => ui.set({ selectedProvince: null })} aria-label="Cerrar">
          <Icon name="X" size={16} />
        </button>
      </header>
      {st && <p className="sel-desc">{sdef.desc}</p>}
      <div className="sel-stats">
        {st && (
          <>
            <div className="tt-row"><span>Población</span><span className="num">{fmt(st.population)}</span></div>
            <div className="tt-row"><span>Puntos de victoria</span><span className="num">{sdef.victoryPoints}</span></div>
            <div className="tt-row"><span>Espacios</span><span className="num">{st.buildings.civil + st.buildings.militar + st.buildings.granja}/{st.slots}</span></div>
            <div className="building-icons">
              <Tip content={BUILDINGS.civil.name}><span><Icon name="Store" size={14} /> {st.buildings.civil}</span></Tip>
              <Tip content={BUILDINGS.militar.name}><span><Icon name="Factory" size={14} /> {st.buildings.militar}</span></Tip>
              <Tip content={BUILDINGS.granja.name}><span><Icon name="Sprout" size={14} /> {st.buildings.granja}</span></Tip>
              <Tip content={BUILDINGS.infraestructura.name}><span><Icon name="Cable" size={14} /> {st.buildings.infraestructura}</span></Tip>
              <Tip content={BUILDINGS.fortificacion.name}><span><Icon name="BrickWall" size={14} /> {p.fort}</span></Tip>
            </div>
            <div className="tt-row"><span>Recursos (ch/pó/co)</span><span className="num">{st.resources.chatarra}/{st.resources.polvora}/{st.resources.combustible}</span></div>
            {food && <div className="tt-row"><span>Comida</span><span className="num">+{fmt(food.prod, 1)} / −{fmt(food.cons, 1)}</span></div>}
            {st.owner === f && contribution(state, pid, f) < 1 && (
              <div className="warn">Estación no integrada: rinde el {pct(contribution(state, pid, f))}. Intégrala con una decisión.</div>
            )}
            {revolt && revolt.claimant && (
              <Tip content={<div>Probabilidad mensual de revuelta. Baja con tropas en la estación y con estabilidad alta.</div>}>
                <div className="warn">
                  Resistencia de {factionName(revolt.claimant)}: {pct(revolt.chance, 1)} al mes
                </div>
              </Tip>
            )}
            {sdef.feature && (
              <Tip content={<div><h4>{sdef.feature.name}</h4><div className="tt-desc">{sdef.feature.desc}</div><ModLines mods={sdef.feature.modifiers} /></div>}>
                <div className="chip gold">
                  <Icon name="Star" size={12} /> {sdef.feature.name}
                </div>
              </Tip>
            )}
            {st.cores.length > 0 && <div className="dim">Núcleo de: {st.cores.map((x) => FACTIONS[x].shortName).join(', ')}</div>}
            {st.claims.length > 0 && <div className="dim">Reclamada por: {st.claims.map((x) => FACTIONS[x].shortName).join(', ')}</div>}
          </>
        )}
        {!st && (
          <>
            <div className="dim">{tInfo.desc}</div>
            <div className="tt-row"><span>Barricadas</span><span className="num">{p.fort}/5</span></div>
            <div className="tt-row"><span>Ancho de combate</span><span className="num">{tInfo.width}</span></div>
            {def.tunnel && <div className="dim">{def.tunnel}</div>}
          </>
        )}
        <div className={`tt-row ${p.danger >= 40 ? 'bad' : ''}`}>
          <span>Peligro mutante</span>
          <span className="num">{Math.round(p.danger)}</span>
        </div>
        {p.collapsed && <div className="bad">Derrumbe: infranqueable hasta que se excave.</div>}
        {p.floodedUntil && p.floodedUntil > state.hour && <div className="bad">Inundado</div>}
      </div>

      <BattleBox pid={pid} />

      {units.length > 0 && (
        <div className="sel-units">
          <div className="label">Unidades</div>
          {units.map((u) => (
            <UnitLine key={u.id} u={u} />
          ))}
          {mine.length > 0 && (
            <button className="btn small" onClick={() => ui.set({ selectedUnits: mine.map((u) => u.id), selectedProvince: null })}>
              Seleccionar mis unidades
            </button>
          )}
        </div>
      )}

      <div className="sel-actions">
        {mineControl &&
          buildables.map((b) => {
            const can = canBuild(state, f, b, pid);
            if (!st && b !== 'fortificacion') return null;
            if (st && st.owner !== f && b !== 'fortificacion') return null;
            return (
              <Tip key={b} content={can.ok ? `Construir ${BUILDINGS[b].name.toLowerCase()} (coste ${BUILDINGS[b].cost})` : <span className="bad">{can.reason}</span>}>
                <button className="btn small" disabled={!can.ok} onClick={() => store.act((s) => queueBuilding(s, f, b, pid))}>
                  <Icon name={BUILDINGS[b].icon} size={14} />
                  {st ? '' : ' Barricadas'}
                </button>
              </Tip>
            );
          })}
        {p.danger >= 25 && !p.collapsed && batida && (
          <Tip content={canBatida?.ok ? batida.desc : <span className="bad">{canBatida?.reason}</span>}>
            <button className="btn small" disabled={!canBatida?.ok} onClick={() => store.act((s) => takeDecision(s, f, 'dec_batida', pid))}>
              <Icon name="Flame" size={14} /> Batida
            </button>
          </Tip>
        )}
        {p.collapsed && excavar && (
          <Tip content={canExcavar?.ok ? excavar.desc : <span className="bad">{canExcavar?.reason}</span>}>
            <button className="btn small" disabled={!canExcavar?.ok} onClick={() => store.act((s) => takeDecision(s, f, 'dec_excavar', pid))}>
              <Icon name="Pickaxe" size={14} /> Excavar
            </button>
          </Tip>
        )}
        {st && !st.owner && colonizar && (
          <Tip content={canColonizar?.ok ? colonizar.desc : <span className="bad">{canColonizar?.reason ?? 'Necesitas tropas en la estación.'}</span>}>
            <button className="btn small primary" disabled={!canColonizar?.ok} onClick={() => store.act((s) => takeDecision(s, f, 'dec_recolonizar', pid))}>
              <Icon name="Flag" size={14} /> Recolonizar
            </button>
          </Tip>
        )}
        {st && st.owner === f && mineControl && (
          <button className="btn small ghost" onClick={() => ui.set({ panel: 'ejercito' })}>
            <Icon name="Users" size={14} /> Reclutar
          </button>
        )}
      </div>
    </div>
  );
}

function UnitsPanel({ ids }: { ids: string[] }) {
  const state = useGame();
  const f = state.player!;
  const s = ui.use();
  const [confirm, setConfirm] = useState(false);
  const units = ids.map((id) => state.units[id]).filter((u): u is Unit => !!u && u.owner === f);
  if (units.length === 0) return null;
  return (
    <div className="sel-province">
      <header className="sel-head">
        <Emblem faction={f} size={32} />
        <div>
          <h3>{units.length === 1 ? units[0].name : `${units.length} unidades`}</h3>
          <div className="dim">Clic derecho en el mapa para mover</div>
        </div>
        <button className="btn icon ghost" onClick={() => ui.set({ selectedUnits: [], moveMode: false })} aria-label="Deseleccionar">
          <Icon name="X" size={16} />
        </button>
      </header>
      <div className="sel-units scroll">
        {units.map((u) => (
          <UnitLine key={u.id} u={u} />
        ))}
      </div>
      <div className="sel-actions">
        <button className={`btn small ${s.moveMode ? 'primary' : ''}`} onClick={() => ui.set({ moveMode: !s.moveMode })}>
          <Icon name="Move" size={14} /> {s.moveMode ? 'Elige destino…' : 'Mover'}
        </button>
        <button className="btn small" onClick={() => store.act((st) => stopUnits(st, units.map((u) => u.id)))}>
          <Icon name="Square" size={14} /> Detener
        </button>
        {!confirm ? (
          <button className="btn small danger" onClick={() => setConfirm(true)}>
            <Icon name="Trash2" size={14} /> Disolver
          </button>
        ) : (
          <>
            <span className="warn">¿Disolver {units.length}?</span>
            <button
              className="btn small danger"
              onClick={() => {
                store.act((st) => units.forEach((u) => disbandUnit(st, f, u.id)));
                ui.set({ selectedUnits: [] });
                setConfirm(false);
              }}
            >
              Sí
            </button>
            <button className="btn small ghost" onClick={() => setConfirm(false)}>
              No
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function SelectionPanel() {
  const s = ui.use();
  const state = useGame();
  if (s.selectedUnits.length) {
    const any = s.selectedUnits.some((id) => state.units[id]?.owner === state.player);
    if (any) return <aside className="selection"><UnitsPanel ids={s.selectedUnits} /></aside>;
  }
  if (s.selectedProvince && MAP.provinces[s.selectedProvince]) {
    return (
      <aside className="selection">
        <ProvincePanel pid={s.selectedProvince} />
      </aside>
    );
  }
  return null;
}
