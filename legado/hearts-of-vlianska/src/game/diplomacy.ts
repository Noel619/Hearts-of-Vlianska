// Diplomacia: guerras, paz, pactos, acuerdos y capitulaciones.
import { FACTIONS, IDEOLOGIES, MAP, STATIONS } from '../data';
import type { FactionId, GameState, War } from './types';
import {
  addLog,
  aliveFactions,
  changeRelation,
  clamp,
  enemiesOf,
  factionName,
  hasNap,
  isAtWar,
  isAtWarWith,
  newId,
  ownedStations,
  pactOf,
  relation,
  samePact,
  sideIn,
  stationName,
  warsOf,
} from './helpers';
import { invalidateMods, mod } from './modifiers';
import { addSpirit } from './politics';
import { normalizeControl, relocateCapital, removeUnit, templateById } from './military';
import { fireEvent } from './events';
import { endBattle } from './combat';
import { militaryStrength } from './conditions';

export const JUSTIFY_COST = 30;
export const JUSTIFY_DAYS = 50;
export const IMPROVE_COST = 20;
export const NAP_COST = 25;
export const GUARANTEE_COST = 25;
export const PACT_COST = 50;
export const EMBARGO_COST = 10;

export function tensionGain(state: GameState, f: FactionId, v: number) {
  state.tension = clamp(state.tension + v * Math.max(0, 1 + mod(state, f, 'tension')), 0, 1);
}

// ---------------------------------------------------------------------------
// Justificación de guerra
// ---------------------------------------------------------------------------

export function hasClaimOn(state: GameState, f: FactionId, t: FactionId): boolean {
  return ownedStations(state, t).some((s) => state.stations[s].cores.includes(f) || state.stations[s].claims.includes(f));
}

export function canJustify(state: GameState, f: FactionId, t: FactionId): { ok: boolean; reason?: string } {
  const c = state.countries[f];
  if (f === t || !state.countries[t].alive) return { ok: false, reason: 'Objetivo no válido' };
  if (c.overlord) return { ok: false, reason: 'Un protectorado no puede declarar guerras' };
  if (isAtWarWith(state, f, t)) return { ok: false, reason: 'Ya estáis en guerra' };
  if (c.wargoals.some((w) => w.target === t)) return { ok: false, reason: 'Ya tienes o estás justificando un objetivo' };
  if (hasNap(state, f, t)) return { ok: false, reason: 'Tenéis un pacto de no agresión' };
  if (samePact(state, f, t)) return { ok: false, reason: 'Sois aliados' };
  if (state.countries[t].overlord === f) return { ok: false, reason: 'Es tu protectorado' };
  const needed = IDEOLOGIES[c.ideology].canJustifyAtTension;
  if (state.tension < needed && !hasClaimOn(state, f, t)) {
    return { ok: false, reason: `Tu gobierno ${IDEOLOGIES[c.ideology].adjective} necesita una tensión del ${Math.round(needed * 100)} % o una reclamación` };
  }
  if (c.pp < JUSTIFY_COST) return { ok: false, reason: `Necesitas ${JUSTIFY_COST} de poder político` };
  return { ok: true };
}

export function justifyDays(state: GameState, f: FactionId): number {
  return JUSTIFY_DAYS * Math.max(0.4, 1 + mod(state, f, 'justificacion'));
}

export function startJustify(state: GameState, f: FactionId, t: FactionId): boolean {
  if (!canJustify(state, f, t).ok) return false;
  const c = state.countries[f];
  c.pp -= JUSTIFY_COST;
  c.wargoals.push({ target: t, progress: 0, ready: false });
  tensionGain(state, f, 0.02);
  changeRelation(state, f, t, -15);
  addLog(state, { text: `${factionName(f)} empieza a justificar una guerra contra ${factionName(t)}.`, kind: 'diplo', faction: f });
  if (state.player === t) fireEvent(state, t, 'diplo_justificacion', { from: f });
  return true;
}

export function cancelJustify(state: GameState, f: FactionId, t: FactionId) {
  const c = state.countries[f];
  c.wargoals = c.wargoals.filter((w) => w.target !== t);
}

export function dailyJustify(state: GameState, f: FactionId) {
  const c = state.countries[f];
  const days = justifyDays(state, f);
  for (const w of c.wargoals) {
    if (!state.countries[w.target].alive) continue;
    if (!w.ready) {
      w.progress += 1 / days;
      if (w.progress >= 1) {
        w.ready = true;
        w.progress = 1;
        w.expires = state.hour + 24 * 540;
        tensionGain(state, f, 0.03);
        addLog(state, { text: `${factionName(f)} tiene un objetivo de guerra contra ${factionName(w.target)}.`, kind: 'diplo', faction: f });
      }
    }
  }
  c.wargoals = c.wargoals.filter((w) => state.countries[w.target].alive && (!w.expires || w.expires > state.hour));
}

// ---------------------------------------------------------------------------
// Guerra
// ---------------------------------------------------------------------------

export function canDeclareWar(state: GameState, f: FactionId, t: FactionId): { ok: boolean; reason?: string } {
  const c = state.countries[f];
  if (!state.countries[t].alive || f === t) return { ok: false, reason: 'Objetivo no válido' };
  if (c.overlord) return { ok: false, reason: 'Un protectorado no puede declarar guerras' };
  if (isAtWarWith(state, f, t)) return { ok: false, reason: 'Ya estáis en guerra' };
  if (hasNap(state, f, t)) return { ok: false, reason: 'Tenéis un pacto de no agresión' };
  if (samePact(state, f, t)) return { ok: false, reason: 'Sois aliados' };
  if (!c.wargoals.some((w) => w.target === t && w.ready)) return { ok: false, reason: 'Necesitas un objetivo de guerra justificado' };
  return { ok: true };
}

function warName(state: GameState, att: FactionId, def: FactionId) {
  const owned = ownedStations(state, def);
  if (owned.length === 1) return `Guerra por ${STATIONS[owned[0]].shortName}`;
  const strip = (s: string) => s.replace(/^(la|el|los|las) /, '');
  return `Guerra ${strip(FACTIONS[att].shortName)}–${strip(FACTIONS[def].shortName)}`;
}

function subjectsOf(state: GameState, f: FactionId): FactionId[] {
  return aliveFactions(state).filter((x) => state.countries[x].overlord === f);
}

export function declareWar(state: GameState, att: FactionId, def: FactionId, opts: { force?: boolean } = {}): War | null {
  if (!opts.force && !canDeclareWar(state, att, def).ok) return null;
  if (isAtWarWith(state, att, def) || att === def) return null;
  const ac = state.countries[att];
  ac.wargoals = ac.wargoals.filter((w) => w.target !== def);
  // Si ataca a un pacto de no agresión, se rompe.
  state.naps = state.naps.filter((n) => !((n.a === att && n.b === def) || (n.a === def && n.b === att)));
  const war: War = {
    id: newId(state, 'w'),
    name: warName(state, att, def),
    attackers: [att],
    defenders: [def],
    attackerLeader: att,
    defenderLeader: def,
    start: state.hour,
    casualties: {},
  };
  state.wars.push(war);
  const addSide = (f: FactionId, side: 'att' | 'def') => {
    if (!state.countries[f].alive) return;
    if (war.attackers.includes(f) || war.defenders.includes(f)) return;
    (side === 'att' ? war.attackers : war.defenders).push(f);
  };
  // Defensores: protectorados, señor feudal, aliados y garantes.
  const defOverlord = state.countries[def].overlord;
  if (defOverlord && defOverlord !== att) addSide(defOverlord, 'def');
  for (const s of subjectsOf(state, def)) if (s !== att) addSide(s, 'def');
  const defPact = pactOf(state, def);
  if (defPact) for (const m of defPact.members) if (m !== att && !samePact(state, m, att)) addSide(m, 'def');
  for (const g of state.guarantees.filter((g) => g.target === def)) {
    if (g.guarantor !== att && !war.attackers.includes(g.guarantor)) addSide(g.guarantor, 'def');
  }
  // Atacantes: protectorados y aliados que acepten.
  for (const s of subjectsOf(state, att)) addSide(s, 'att');
  const attPact = pactOf(state, att);
  if (attPact) {
    for (const m of attPact.members) {
      if (m === att || war.defenders.includes(m)) continue;
      if (state.player === m) {
        fireEvent(state, m, 'diplo_llamada_armas', { from: att, target: def });
        continue;
      }
      if (!hasNap(state, m, def) && relation(state, m, def) < 20) addSide(m, 'att');
    }
  }
  for (const d of war.defenders) {
    changeRelation(state, att, d, -40);
    state.countries[d].warSupportBase = clamp(state.countries[d].warSupportBase + 0.05, -0.5, 1.5);
  }
  tensionGain(state, att, 0.08);
  addLog(state, {
    text: `¡${factionName(att)} declara la guerra a ${factionName(def)}!${war.defenders.length > 1 ? ` Se unen a la defensa: ${war.defenders.slice(1).map(factionName).join(', ')}.` : ''}`,
    kind: 'guerra',
    faction: att,
  });
  state.news.push({
    hour: state.hour,
    title: `¡Guerra en el metro!`,
    text: `${factionName(att)} ha declarado la guerra a ${factionName(def)}.`,
    picture: 'Swords',
  });
  if (state.player && war.defenders.includes(state.player)) fireEvent(state, state.player, 'diplo_guerra_declarada', { from: att });
  invalidateMods(state);
  return war;
}

export function joinWar(state: GameState, f: FactionId, warId: string, side: 'att' | 'def') {
  const w = state.wars.find((x) => x.id === warId);
  if (!w || sideIn(w, f)) return;
  (side === 'att' ? w.attackers : w.defenders).push(f);
  for (const e of side === 'att' ? w.defenders : w.attackers) changeRelation(state, f, e, -30);
  addLog(state, { text: `${factionName(f)} entra en la guerra (${w.name}).`, kind: 'guerra', faction: f });
}

function endWar(state: GameState, w: War, winners: FactionId[] | null) {
  state.wars = state.wars.filter((x) => x.id !== w.id);
  // Cierra batallas que ya no tienen sentido.
  for (const b of Object.values(state.battles)) {
    if (!isAtWarWith(state, b.attackerSide, b.defenderSide)) endBattle(state, b);
  }
  if (winners) for (const f of winners) if (state.countries[f].alive) addSpirit(state, f, 'victoria_reciente', 180);
  normalizeControl(state);
  addLog(state, { text: `Termina la ${w.name}.`, kind: 'diplo' });
}

function removeFromWar(f: FactionId, w: War) {
  w.attackers = w.attackers.filter((x) => x !== f);
  w.defenders = w.defenders.filter((x) => x !== f);
  if (w.attackerLeader === f && w.attackers.length) w.attackerLeader = w.attackers[0];
  if (w.defenderLeader === f && w.defenders.length) w.defenderLeader = w.defenders[0];
}

/** Paz blanca: todo vuelve a como estaba antes de la guerra. */
export function whitePeace(state: GameState, a: FactionId, b: FactionId) {
  for (const w of [...state.wars]) {
    const sa = sideIn(w, a);
    const sb = sideIn(w, b);
    if (!sa || !sb || sa === sb) continue;
    const leaders = [w.attackerLeader, w.defenderLeader];
    if (leaders.includes(a) && leaders.includes(b)) {
      endWar(state, w, null);
    } else {
      const leaving = leaders.includes(a) ? b : a;
      removeFromWar(leaving, w);
      if (w.attackers.length === 0 || w.defenders.length === 0) endWar(state, w, null);
      else normalizeControl(state);
    }
  }
  changeRelation(state, a, b, 10);
  addLog(state, { text: `${factionName(a)} y ${factionName(b)} firman una paz blanca.`, kind: 'diplo' });
  state.news.push({ hour: state.hour, title: 'Paz en los túneles', text: `${factionName(a)} y ${factionName(b)} firman la paz.`, picture: 'Handshake' });
}

export function aiAcceptsPeace(state: GameState, ai: FactionId, proposer: FactionId): { ok: boolean; reason: string } {
  const c = state.countries[ai];
  const p = state.countries[proposer];
  const war = state.wars.find((w) => sideIn(w, ai) && sideIn(w, proposer) && sideIn(w, ai) !== sideIn(w, proposer));
  if (!war) return { ok: false, reason: 'No estáis en guerra.' };
  const duration = (state.hour - war.start) / 24;
  const myStr = militaryStrength(state, ai);
  const theirStr = militaryStrength(state, proposer);
  if (c.surrender >= 0.3) return { ok: true, reason: 'Estamos perdiendo la guerra.' };
  if (p.surrender >= 0.2) return { ok: false, reason: 'Estamos ganando: no hay paz sin victoria.' };
  if (myStr < theirStr * 0.6) return { ok: true, reason: 'Su ejército es muy superior.' };
  if (duration > 365 && c.derived.warSupport < 0.4) return { ok: true, reason: 'La población está cansada de la guerra.' };
  if (duration > 540 || (duration > 400 && c.surrender < 0.15 && p.surrender < 0.15)) return { ok: true, reason: 'La guerra se ha estancado.' };
  return { ok: false, reason: 'Todavía creemos que podemos ganar.' };
}

// ---------------------------------------------------------------------------
// Capitulación, anexión y protectorados
// ---------------------------------------------------------------------------

export function capitulationLimit(state: GameState, f: FactionId): number {
  const c = state.countries[f];
  return clamp(0.55 + 0.3 * c.derived.warSupport + mod(state, f, 'rendicion'), 0.4, 0.95);
}

export function computeSurrender(state: GameState, f: FactionId): number {
  const owned = ownedStations(state, f);
  let total = 0;
  let lost = 0;
  for (const s of owned) {
    const vp = STATIONS[s].victoryPoints;
    total += vp;
    const ctrl = state.provinces[s].controller;
    if (ctrl !== f && ctrl && isAtWarWith(state, ctrl, f)) lost += vp;
  }
  return total > 0 ? lost / total : 1;
}

export function dailySurrender(state: GameState) {
  for (const f of aliveFactions(state)) {
    const c = state.countries[f];
    c.surrender = isAtWar(state, f) ? computeSurrender(state, f) : 0;
  }
  for (const f of aliveFactions(state)) {
    const c = state.countries[f];
    if (!c.alive || !isAtWar(state, f)) continue;
    const controlsAny = ownedStations(state, f).some((s) => state.provinces[s].controller === f);
    if (c.surrender >= capitulationLimit(state, f) || !controlsAny) capitulate(state, f);
  }
}

function primaryWinner(state: GameState, loser: FactionId): FactionId | null {
  const enemies = enemiesOf(state, loser).filter((e) => state.countries[e].alive);
  if (enemies.length === 0) return null;
  const score = (e: FactionId) =>
    ownedStations(state, loser)
      .filter((s) => state.provinces[s].controller === e)
      .reduce((sum, s) => sum + STATIONS[s].victoryPoints, 0);
  enemies.sort((a, b) => score(b) - score(a));
  return enemies[0];
}

export function capitulate(state: GameState, loser: FactionId) {
  const winner = primaryWinner(state, loser);
  if (!winner) return;
  addLog(state, { text: `¡${factionName(loser)} capitula ante ${factionName(winner)}!`, kind: 'guerra', faction: loser });
  state.news.push({
    hour: state.hour,
    title: `La caída de ${FACTIONS[loser].name}`,
    text: `${factionName(loser)} se rinde. ${factionName(winner)} dicta las condiciones de paz.`,
    picture: 'Flag',
  });
  // Estaciones ocupadas: pasan a quien las controla.
  for (const s of ownedStations(state, loser)) {
    const ctrl = state.provinces[s].controller;
    if (ctrl && ctrl !== loser && isAtWarWith(state, ctrl, loser)) transferStation(state, s, ctrl, true);
  }
  const remaining = ownedStations(state, loser);
  if (state.player === winner && remaining.length > 0) {
    // El jugador decide: anexionar o crear un protectorado.
    state.peaceOffers.push({ uid: newId(state, 'p'), winner, loser, stations: remaining });
    // Mientras tanto, el perdedor sale de la guerra.
    leaveAllWars(state, loser);
    return;
  }
  if (remaining.length > 0) {
    for (const s of remaining) transferStation(state, s, winner, true);
  }
  eliminate(state, loser, winner);
}

function leaveAllWars(state: GameState, f: FactionId) {
  for (const w of [...warsOf(state, f)]) {
    const side = sideIn(w, f);
    removeFromWar(f, w);
    if (w.attackers.length === 0 || w.defenders.length === 0) {
      endWar(state, w, side === 'att' ? w.defenders : w.attackers);
    }
  }
  for (const u of Object.values(state.units)) {
    if (u.owner === f && u.battle) u.battle = null;
  }
  normalizeControl(state);
}

export function resolvePeaceOffer(state: GameState, uid: string, choice: 'anexionar' | 'protectorado') {
  const offer = state.peaceOffers.find((p) => p.uid === uid);
  if (!offer) return;
  state.peaceOffers = state.peaceOffers.filter((p) => p.uid !== uid);
  const { winner, loser } = offer;
  if (!state.countries[loser].alive) return;
  if (choice === 'anexionar') {
    for (const s of ownedStations(state, loser)) transferStation(state, s, winner, true);
    eliminate(state, loser, winner);
  } else {
    makeSubject(state, winner, loser);
    normalizeControl(state);
  }
}

function eliminate(state: GameState, loser: FactionId, winner: FactionId) {
  const lc = state.countries[loser];
  for (const u of Object.values(state.units)) if (u.owner === loser) removeUnit(state, u.id);
  lc.recruitment = [];
  lc.alive = false;
  lc.wargoals = [];
  for (const w of [...warsOf(state, loser)]) {
    const side = sideIn(w, loser);
    removeFromWar(loser, w);
    if (w.attackers.length === 0 || w.defenders.length === 0) endWar(state, w, side === 'att' ? w.defenders : w.attackers);
  }
  for (const p of state.pacts) p.members = p.members.filter((m) => m !== loser);
  state.pacts = state.pacts.filter((p) => p.members.length > 1);
  for (const p of state.pacts) if (!p.members.includes(p.leader)) p.leader = p.members[0];
  state.naps = state.naps.filter((n) => n.a !== loser && n.b !== loser);
  state.access = state.access.filter((a) => a.from !== loser && a.to !== loser);
  state.guarantees = state.guarantees.filter((g) => g.guarantor !== loser && g.target !== loser);
  state.embargoes = state.embargoes.filter((e) => e.from !== loser && e.to !== loser);
  for (const f of aliveFactions(state)) {
    const c = state.countries[f];
    if (c.overlord === loser) c.overlord = undefined;
    c.trades = c.trades.filter((t) => t.partner !== loser);
    c.wargoals = c.wargoals.filter((w) => w.target !== loser);
  }
  lc.trades = [];
  for (const b of Object.values(state.battles)) {
    if (b.attackerSide === loser || b.defenderSide === loser) endBattle(state, b);
  }
  normalizeControl(state);
  addLog(state, { text: `${factionName(loser)} desaparece. Sus estaciones pasan a ${factionName(winner)} y sus vecinos.`, kind: 'guerra', faction: loser });
  invalidateMods(state);
}

export function annexCountry(state: GameState, winner: FactionId, loser: FactionId) {
  // Anexión pacífica: las unidades y estaciones pasan al anexionador.
  for (const s of ownedStations(state, loser)) transferStation(state, s, winner, true);
  for (const u of Object.values(state.units)) {
    if (u.owner !== loser) continue;
    const tpl = templateById(state, loser, u.template);
    const wc = state.countries[winner];
    if (tpl && !wc.templates.some((t) => t.id === tpl.id)) wc.templates.push({ ...tpl, line: [...tpl.line], support: [...tpl.support] });
    u.owner = winner;
    u.battle = null;
  }
  const lc = state.countries[loser];
  const wc = state.countries[winner];
  for (const eq of Object.keys(lc.stockpile) as (keyof typeof lc.stockpile)[]) wc.stockpile[eq] += lc.stockpile[eq];
  wc.food += lc.food;
  eliminate(state, loser, winner);
}

export function makeSubject(state: GameState, overlord: FactionId, subject: FactionId) {
  const sc = state.countries[subject];
  sc.overlord = overlord;
  leaveAllWars(state, subject);
  // Sale de su pacto y entra en el del señor.
  for (const p of state.pacts) p.members = p.members.filter((m) => m !== subject);
  state.pacts = state.pacts.filter((p) => p.members.length > 1);
  const op = pactOf(state, overlord);
  if (op && !op.members.includes(subject)) op.members.push(subject);
  sc.wargoals = [];
  changeRelation(state, overlord, subject, 30);
  addLog(state, { text: `${factionName(subject)} se convierte en protectorado de ${factionName(overlord)}.`, kind: 'diplo', faction: overlord });
  invalidateMods(state);
}

export function releaseSubject(state: GameState, overlord: FactionId, subject: FactionId) {
  const sc = state.countries[subject];
  if (sc.overlord !== overlord) return;
  sc.overlord = undefined;
  addLog(state, { text: `${factionName(subject)} deja de ser protectorado de ${factionName(overlord)}.`, kind: 'diplo', faction: subject });
}

export function transferStation(state: GameState, sid: string, to: FactionId, silent = false) {
  const st = state.stations[sid];
  const from = st.owner;
  st.owner = to;
  st.ownedSince = state.hour;
  state.provinces[sid].controller = to;
  if (!state.countries[to].alive) state.countries[to].alive = true;
  if (from && state.countries[from].capital === sid) relocateCapital(state, from);
  if (!silent) addLog(state, { text: `${stationName(sid)} pasa a manos de ${factionName(to)}.`, kind: 'diplo', faction: to, province: sid });
  // Cuidado: los tramos adyacentes pasarán a su nuevo dueño al normalizar.
  for (const { to: n } of MAP.adjacency[sid]) {
    const p = state.provinces[n];
    if (p.controller === from && MAP.provinces[n].kind !== 'estacion' && (!from || !isAtWarWith(state, from, to))) p.controller = to;
  }
  invalidateMods(state);
}

// ---------------------------------------------------------------------------
// Pactos y acuerdos
// ---------------------------------------------------------------------------

export function createPact(state: GameState, leader: FactionId, name: string) {
  if (pactOf(state, leader)) return;
  state.pacts.push({ id: newId(state, 'pa'), name, leader, members: [leader] });
  addLog(state, { text: `${factionName(leader)} funda el pacto «${name}».`, kind: 'diplo', faction: leader });
}

export function addToPact(state: GameState, member: FactionId, newcomer: FactionId) {
  let pact = pactOf(state, member);
  if (!pact) {
    createPact(state, member, `Pacto de ${STATIONS[state.countries[member].capital].shortName}`);
    pact = pactOf(state, member)!;
  }
  if (pact.members.includes(newcomer)) return;
  leavePact(state, newcomer, true);
  pact.members.push(newcomer);
  changeRelation(state, member, newcomer, 20);
  addLog(state, { text: `${factionName(newcomer)} se une al pacto «${pact.name}».`, kind: 'diplo', faction: newcomer });
  // Se une a las guerras defensivas de sus nuevos aliados.
  for (const w of state.wars) {
    for (const m of pact.members) {
      if (m === newcomer) continue;
      if (w.defenders.includes(m) && !sideIn(w, newcomer) && !w.attackers.some((a) => samePact(state, a, newcomer))) {
        joinWar(state, newcomer, w.id, 'def');
      }
    }
  }
  invalidateMods(state);
}

export function leavePact(state: GameState, f: FactionId, silent = false) {
  const pact = pactOf(state, f);
  if (!pact) return;
  pact.members = pact.members.filter((m) => m !== f);
  if (pact.leader === f) pact.leader = pact.members[0];
  state.pacts = state.pacts.filter((p) => p.members.length > 1);
  if (!silent) addLog(state, { text: `${factionName(f)} abandona el pacto «${pact.name}».`, kind: 'diplo', faction: f });
}

export function aiAcceptsPact(state: GameState, ai: FactionId, inviter: FactionId): { ok: boolean; reason: string } {
  const c = state.countries[ai];
  if (pactOf(state, ai)) return { ok: false, reason: 'Ya pertenecemos a otro pacto.' };
  if (isAtWarWith(state, ai, inviter)) return { ok: false, reason: 'Estamos en guerra.' };
  if (FACTIONS[ai].aiTargets.some((t) => t.target === inviter && t.weight >= 3)) return { ok: false, reason: 'Tenemos otros planes para vosotros.' };
  let score = relation(state, ai, inviter);
  if (c.ideology === state.countries[inviter].ideology) score += 25;
  const commonEnemies = enemiesOf(state, ai).filter((e) => isAtWarWith(state, inviter, e)).length;
  score += commonEnemies * 40;
  if (FACTIONS[ai].aiFriends.includes(inviter)) score += 25;
  if (militaryStrength(state, inviter) > militaryStrength(state, ai)) score += 10;
  if (score >= 50) return { ok: true, reason: 'Juntos somos más fuertes.' };
  return { ok: false, reason: 'No confiamos lo suficiente en vosotros.' };
}

export function addNap(state: GameState, a: FactionId, b: FactionId, days = 730) {
  if (a === b) return;
  state.naps = state.naps.filter((n) => !((n.a === a && n.b === b) || (n.a === b && n.b === a)));
  state.naps.push({ a, b, until: state.hour + days * 24 });
  changeRelation(state, a, b, 15);
  addLog(state, { text: `${factionName(a)} y ${factionName(b)} firman un pacto de no agresión.`, kind: 'diplo', faction: a });
}

export function aiAcceptsNap(state: GameState, ai: FactionId, proposer: FactionId): { ok: boolean; reason: string } {
  if (isAtWarWith(state, ai, proposer)) return { ok: false, reason: 'Estamos en guerra.' };
  if (state.countries[ai].wargoals.some((w) => w.target === proposer)) return { ok: false, reason: 'No podemos prometer eso.' };
  const target = FACTIONS[ai].aiTargets.find((t) => t.target === proposer);
  const rel = relation(state, ai, proposer);
  const threatened = militaryStrength(state, proposer) > militaryStrength(state, ai) * 1.2;
  if (target && target.weight >= 3 && !threatened) return { ok: false, reason: 'Vuestras estaciones nos interesan demasiado.' };
  if (rel >= -10 || threatened) return { ok: true, reason: 'Nos conviene la paz en esa frontera.' };
  return { ok: false, reason: 'No nos fiamos de vosotros.' };
}

export function grantAccess(state: GameState, from: FactionId, to: FactionId) {
  if (state.access.some((a) => a.from === from && a.to === to)) return;
  state.access.push({ from, to });
  changeRelation(state, from, to, 10);
}

export function revokeAccess(state: GameState, from: FactionId, to: FactionId) {
  state.access = state.access.filter((a) => !(a.from === from && a.to === to));
  normalizeControl(state);
}

export function aiAcceptsAccess(state: GameState, ai: FactionId, requester: FactionId): { ok: boolean; reason: string } {
  if (isAtWarWith(state, ai, requester)) return { ok: false, reason: 'Estamos en guerra.' };
  if (samePact(state, ai, requester)) return { ok: true, reason: 'Somos aliados.' };
  const rel = relation(state, ai, requester);
  const enemiesInCommon = enemiesOf(state, requester).some((e) => relation(state, ai, e) < -30);
  if (rel >= 40 || (rel >= 10 && enemiesInCommon)) return { ok: true, reason: 'Podéis cruzar nuestros túneles.' };
  return { ok: false, reason: 'No queremos tropas extranjeras en nuestros andenes.' };
}

export function addGuarantee(state: GameState, guarantor: FactionId, target: FactionId) {
  if (state.guarantees.some((g) => g.guarantor === guarantor && g.target === target)) return;
  state.guarantees.push({ guarantor, target });
  changeRelation(state, guarantor, target, 15);
  addLog(state, { text: `${factionName(guarantor)} garantiza la independencia de ${factionName(target)}.`, kind: 'diplo', faction: guarantor });
}

export function removeGuarantee(state: GameState, guarantor: FactionId, target: FactionId) {
  state.guarantees = state.guarantees.filter((g) => !(g.guarantor === guarantor && g.target === target));
}

export function addEmbargo(state: GameState, from: FactionId, to: FactionId) {
  if (state.embargoes.some((e) => e.from === from && e.to === to)) return;
  state.embargoes.push({ from, to });
  changeRelation(state, from, to, -20);
  for (const f of [from, to]) {
    const other = f === from ? to : from;
    state.countries[f].trades = state.countries[f].trades.filter((t) => t.partner !== other);
  }
  addLog(state, { text: `${factionName(from)} impone un embargo a ${factionName(to)}.`, kind: 'diplo', faction: from });
}

export function liftEmbargo(state: GameState, from: FactionId, to: FactionId) {
  const had = state.embargoes.some((e) => e.from === from && e.to === to);
  state.embargoes = state.embargoes.filter((e) => !(e.from === from && e.to === to));
  if (had) addLog(state, { text: `${factionName(from)} levanta el embargo a ${factionName(to)}.`, kind: 'diplo', faction: from });
}

export function improveRelations(state: GameState, f: FactionId, t: FactionId): boolean {
  const c = state.countries[f];
  const key = `mejorar_${t}`;
  if (c.pp < IMPROVE_COST || (c.cooldowns[key] ?? 0) > state.hour || isAtWarWith(state, f, t)) return false;
  c.pp -= IMPROVE_COST;
  c.cooldowns[key] = state.hour + 24 * 30;
  changeRelation(state, f, t, 15);
  return true;
}

export function dailyDiplomacy(state: GameState) {
  // La tensión baja lentamente en tiempos de paz.
  const wars = state.wars.length;
  state.tension = clamp(state.tension + (wars > 0 ? 0.0002 * wars : -0.0006), 0, 1);
  state.naps = state.naps.filter((n) => n.until > state.hour && state.countries[n.a].alive && state.countries[n.b].alive);
  // Las relaciones tienden lentamente a su valor base.
  if (state.hour % (24 * 7) === 0) {
    for (const f of aliveFactions(state)) {
      const c = state.countries[f];
      for (const t of aliveFactions(state)) {
        if (t === f) continue;
        const base = FACTIONS[f].relations[t] ?? 0;
        const cur = c.relations[t] ?? 0;
        if (Math.abs(cur - base) > 1) c.relations[t] = cur + Math.sign(base - cur);
      }
    }
  }
  // Guerras sin enemigos vivos terminan.
  for (const w of [...state.wars]) {
    w.attackers = w.attackers.filter((f) => state.countries[f].alive);
    w.defenders = w.defenders.filter((f) => state.countries[f].alive);
    if (w.attackers.length === 0 || w.defenders.length === 0) endWar(state, w, w.attackers.length ? w.attackers : w.defenders);
  }
}
