// IA diplomática: justificar guerras, declararlas, buscar aliados y firmar la paz.
import { FACTIONS } from '../../data';
import type { FactionId, GameState } from '../types';
import {
  aliveFactions,
  enemiesOf,
  hasNap,
  isAtWar,
  isAtWarWith,
  neighborFactions,
  neighbors,
  pactOf,
  provincePassable,
  relation,
  samePact,
  warsOf,
} from '../helpers';
import {
  addNap,
  addToPact,
  aiAcceptsNap,
  aiAcceptsPact,
  aiAcceptsPeace,
  canDeclareWar,
  canJustify,
  declareWar,
  improveRelations,
  startJustify,
  whitePeace,
} from '../diplomacy';
import { fireEvent } from '../events';
import { unitStats, unitsOf } from '../military';
import { rand } from '../rng';

export function armyPower(state: GameState, f: FactionId): number {
  let p = 0;
  for (const u of unitsOf(state, f)) {
    const s = unitStats(state, u);
    p += (s.soft + s.hard + s.def + s.brk) * u.strength;
  }
  return p + state.countries[f].derived.milTotal * 6;
}

/** Quién defendería a t si lo atacamos. */
export function defenderCoalition(state: GameState, attacker: FactionId, t: FactionId): FactionId[] {
  const out = new Set<FactionId>([t]);
  const tc = state.countries[t];
  if (tc.overlord) out.add(tc.overlord);
  for (const f of aliveFactions(state)) if (state.countries[f].overlord === t) out.add(f);
  const pact = pactOf(state, t);
  if (pact) for (const m of pact.members) if (!samePact(state, m, attacker)) out.add(m);
  for (const g of state.guarantees) if (g.target === t && g.guarantor !== attacker) out.add(g.guarantor);
  out.delete(attacker);
  return [...out];
}

export function landConnected(state: GameState, a: FactionId, b: FactionId): boolean {
  const start = state.countries[a].capital;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    if (state.provinces[cur].controller === b) return true;
    for (const n of neighbors(state, cur)) {
      if (seen.has(n.to) || !provincePassable(state, n.to)) continue;
      seen.add(n.to);
      queue.push(n.to);
    }
  }
  return false;
}

function cooldownOk(state: GameState, f: FactionId, key: string, days: number) {
  const c = state.countries[f];
  if ((c.cooldowns[key] ?? -Infinity) > state.hour) return false;
  c.cooldowns[key] = state.hour + days * 24;
  return true;
}

const AGGRESSIVE = new Set(['nacionalismo', 'autocracia', 'comunismo', 'teocracia', 'anarquia']);

/** Objetivos de la IA: los de su historia, más vecinos sobre los que tenga reclamaciones o que sean mucho más débiles. */
export function aiTargetList(state: GameState, f: FactionId): { target: FactionId; weight: number }[] {
  const out = new Map<FactionId, number>();
  for (const t of FACTIONS[f].aiTargets) if (state.countries[t.target].alive) out.set(t.target, t.weight);
  const myPower = armyPower(state, f);
  const aggressive = AGGRESSIVE.has(state.countries[f].ideology);
  for (const n of neighborFactions(state, f, 6)) {
    if (!state.countries[n].alive || samePact(state, f, n) || state.countries[n].overlord === f) continue;
    const claims = Object.keys(state.stations).some((s) => state.stations[s].owner === n && state.stations[s].claims.includes(f));
    if (claims) out.set(n, Math.max(out.get(n) ?? 0, 2));
    else if (aggressive && myPower > armyPower(state, n) * 1.6 && state.tension > 0.25) out.set(n, Math.max(out.get(n) ?? 0, 0.6));
  }
  return [...out.entries()].map(([target, weight]) => ({ target, weight })).sort((a, b) => b.weight - a.weight);
}

export function aiDiplomacy(state: GameState, f: FactionId) {
  const c = state.countries[f];
  if (c.overlord) return;
  const myPower = armyPower(state, f);

  // --- Paz
  for (const w of warsOf(state, f)) {
    const mySide = w.attackers.includes(f) ? 'att' : 'def';
    const leader = mySide === 'att' ? w.attackerLeader : w.defenderLeader;
    if (leader !== f) continue;
    const enemyLeader = mySide === 'att' ? w.defenderLeader : w.attackerLeader;
    const days = (state.hour - w.start) / 24;
    const enemyPower = (mySide === 'att' ? w.defenders : w.attackers).reduce((s, e) => s + armyPower(state, e), 0);
    const losing = c.surrender >= 0.3 || (days > 90 && myPower < enemyPower * 0.5) || (days > 400 && c.surrender > state.countries[enemyLeader].surrender);
    if (!losing || !cooldownOk(state, f, `paz_${enemyLeader}`, 60)) continue;
    if (state.player === enemyLeader) fireEvent(state, enemyLeader, 'diplo_propuesta_paz', { from: f });
    else if (aiAcceptsPeace(state, enemyLeader, f).ok) whitePeace(state, f, enemyLeader);
  }

  // --- Declarar guerra con objetivos listos
  if (!isAtWar(state, f)) {
    for (const wg of c.wargoals.filter((w) => w.ready)) {
      const t = wg.target;
      if (!canDeclareWar(state, f, t).ok) continue;
      if (!landConnected(state, f, t)) continue;
      const theirPower = defenderCoalition(state, f, t).reduce((s, x) => s + armyPower(state, x), 0);
      const ratio = myPower / Math.max(1, theirPower);
      const waited = wg.expires ? state.hour > wg.expires - 24 * 400 : true;
      if (ratio >= 1.15 || (ratio >= 0.9 && waited)) {
        declareWar(state, f, t);
        return;
      }
    }
  }

  // --- Justificar
  const day = state.hour / 24;
  if (!isAtWar(state, f) && c.wargoals.length === 0 && day > 45) {
    for (const { target, weight } of aiTargetList(state, f)) {
      if (!state.countries[target].alive) continue;
      if (!canJustify(state, f, target).ok) continue;
      if (!landConnected(state, f, target)) continue;
      const theirPower = defenderCoalition(state, f, target).reduce((s, x) => s + armyPower(state, x), 0);
      if (myPower < theirPower * 0.95) continue;
      if (rand(state) < weight * 0.035) {
        startJustify(state, f, target);
        break;
      }
    }
  }

  // --- Buscar aliados si nos amenazan
  const threats = aliveFactions(state).filter(
    (o) => o !== f && (isAtWarWith(state, o, f) || state.countries[o].wargoals.some((w) => w.target === f)) && armyPower(state, o) > myPower * 0.9,
  );
  if (threats.length > 0 && !pactOf(state, f) && cooldownOk(state, f, 'buscar_pacto', 90)) {
    const cands = aliveFactions(state)
      .filter((o) => o !== f && !threats.includes(o) && !isAtWarWith(state, o, f))
      .sort((a, b) => {
        const fa = FACTIONS[f].aiFriends.includes(a) ? 50 : 0;
        const fb = FACTIONS[f].aiFriends.includes(b) ? 50 : 0;
        return relation(state, f, b) + fb - (relation(state, f, a) + fa);
      });
    for (const o of cands.slice(0, 2)) {
      if (state.player === o) {
        fireEvent(state, o, 'diplo_invitacion_pacto', { from: f });
        break;
      }
      if (aiAcceptsPact(state, o, f).ok) {
        const existing = pactOf(state, o);
        if (existing) addToPact(state, o, f);
        else addToPact(state, f, o);
        break;
      }
    }
  }

  // --- Pactos de no agresión con vecinos fuertes que no queremos atacar
  if (cooldownOk(state, f, 'nap_check', 60)) {
    const near = neighborFactions(state, f, 6);
    for (const o of near) {
      if (o === f || hasNap(state, f, o) || isAtWarWith(state, f, o) || samePact(state, f, o)) continue;
      if (FACTIONS[f].aiTargets.some((t) => t.target === o && t.weight >= 2)) continue;
      if (enemiesOf(state, o).length > 0) continue;
      if (armyPower(state, o) < myPower * 1.4) continue;
      if (relation(state, f, o) < -40) continue;
      if (state.player === o) {
        if (cooldownOk(state, f, `nap_player_${o}`, 240)) fireEvent(state, o, 'diplo_propuesta_nap', { from: f });
      } else if (aiAcceptsNap(state, o, f).ok) {
        addNap(state, f, o, 730);
      }
      break;
    }
  }

  // --- Mejorar relaciones con los amigos
  if (c.pp > 160) {
    for (const o of FACTIONS[f].aiFriends) {
      if (state.countries[o].alive && relation(state, f, o) < 70 && improveRelations(state, f, o)) break;
    }
  }
}
