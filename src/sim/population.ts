// Población del metro: los residentes de cada estación y las escuadras que
// recorren los túneles (patrullas, caravanas, bandas y jaurías). Solo existen
// como personajes completos cerca del jugador; lejos se simulan en abstracto.

import { CREATURES } from '../data/criaturas';
import { FIGURES } from '../data/historia/figuras';
import { ROLE_NAMES, type Role } from '../data/gente';
import { HAIR_COLORS, SKIN_TONES, type Look } from '../data/looks';
import type { FactionId, SideId } from '../data/tipos';
import { seedFrom } from '../core/rng';
import { makeCreature, makeHuman } from './chars';
import { hostile } from './combat';
import { clearDest, setDest } from './move';
import type { Sim } from './sim';
import type { Char, Squad, SquadKind } from './types';
import { stationAt } from './world';

const ON = 78;
const OFF = 115;

interface Runtime {
  spotUser: Map<number, number>;
  spotsByPlace: Map<string, number[]>;
  /** Centro y radio de cada lugar con residentes. */
  places: Map<string, { x: number; z: number; rad: number }>;
  active: Set<string>;
}

/** Puntos que ocupa gente (el resto son objetos del mundo). */
const PEOPLE_SPOTS = new Set(['guardia', 'vendedor', 'bar', 'medico', 'recluta', 'lider', 'figura', 'peaje']);
const RT = new WeakMap<Sim, Runtime>();

function rt(sim: Sim): Runtime {
  let r = RT.get(sim);
  if (!r) {
    r = { spotUser: new Map(), spotsByPlace: new Map(), places: new Map(), active: new Set() };
    const box = new Map<string, [number, number, number, number]>();
    sim.world.decor.spots.forEach((s, i) => {
      let a = r!.spotsByPlace.get(s.place);
      if (!a) r!.spotsByPlace.set(s.place, (a = []));
      a.push(i);
      if (!PEOPLE_SPOTS.has(s.kind)) return;
      const b = box.get(s.place);
      if (!b) box.set(s.place, [s.x, s.z, s.x, s.z]);
      else {
        b[0] = Math.min(b[0], s.x);
        b[1] = Math.min(b[1], s.z);
        b[2] = Math.max(b[2], s.x);
        b[3] = Math.max(b[3], s.z);
      }
    });
    for (const [place, b] of box) {
      const f = sim.world.layout.stationById[place];
      if (f) r.places.set(place, { x: f.x, z: f.z, rad: Math.max(f.hl, f.hw) });
      else r.places.set(place, { x: (b[0] + b[2]) / 2, z: (b[1] + b[3]) / 2, rad: Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 6 });
    }
    // Los residentes ya presentes (partida cargada) siguen activos
    for (const c of sim.state.chars) if (c.slot) r.active.add(c.slot.split(':')[0]);
    RT.set(sim, r);
  }
  return r;
}

// --- Puntos de interés ---------------------------------------------------------

export function pickSpot(sim: Sim, c: Char): number {
  const r = rt(sim);
  const list = r.spotsByPlace.get(c.ai.place);
  if (!list) return -1;
  const spots = sim.world.decor.spots;
  const worker = c.role === 'obrero' || c.role === 'medico';
  let best = -1;
  let bestScore = -Infinity;
  for (let k = 0; k < 8; k++) {
    const i = list[Math.floor(sim.rng.next() * list.length)];
    const s = spots[i];
    if (r.spotUser.has(i)) continue;
    let score = 0;
    if (s.kind === 'asiento') score = 3;
    else if (s.kind === 'ocio') score = 2.5;
    else if (s.kind === 'trabajo') score = worker ? 5 : s.data === 'rezo' && c.side === 'CAL' ? 4 : 0.5;
    else if (s.kind === 'cama') score = 0.6;
    else continue;
    score += sim.rng.next() * 2 - Math.hypot(s.x - c.x, s.z - c.z) * 0.02;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export function occupySpot(sim: Sim, c: Char, i: number) {
  rt(sim).spotUser.set(i, c.id);
  c.ai.spot = i;
}

export function freeSpot(sim: Sim, c: Char) {
  if (c.ai.spot >= 0) {
    const r = rt(sim);
    if (r.spotUser.get(c.ai.spot) === c.id) r.spotUser.delete(c.ai.spot);
    c.ai.spot = -1;
  }
}

// --- Figuras de la historia ---------------------------------------------------------

function figureLook(sim: Sim, id: string, side: SideId): Partial<Look> | null {
  const f = FIGURES.find((x) => x.id === id);
  if (!f) return null;
  const l = f.look;
  const hair = l.hair === 'short' ? 'corto' : l.hair === 'long' ? 'largo' : l.hair === 'bun' ? 'mono' : l.hair === 'buzz' ? 'rapado' : 'calvo';
  const facial = l.facial === 'stubble' ? 'barba3' : l.facial === 'mustache' ? 'bigote' : l.facial === 'beard' ? 'barba' : l.facial === 'fullbeard' ? 'barbaLarga' : 'nada';
  const hat = l.hat === 'cap' ? 'plato' : l.hat === 'ushanka' ? 'ushanka' : l.hat === 'beret' ? 'boina' : l.hat === 'helmet' ? 'casco' : l.hat === 'bandana' ? 'panuelo' : l.hat === 'kufi' ? 'kufi' : l.hat === 'hood' ? 'capucha' : 'nada';
  const top = l.outfit === 'suit' ? 'traje' : l.outfit === 'coat' ? 'abrigo' : l.outfit === 'military' ? 'guerrera' : l.outfit === 'leather' ? 'cuero' : l.outfit === 'rags' ? 'harapos' : 'tunica';
  void side;
  void sim;
  return {
    female: !!l.female,
    skin: SKIN_TONES[Math.min(4, l.skin + (l.skin > 1 ? 1 : 0))],
    hair,
    hairColor: HAIR_COLORS[Math.min(5, l.hairColor)],
    facial,
    hat,
    top,
    age: l.age === 'young' ? 0 : l.age === 'old' ? 2 : 1,
    glasses: !!l.glasses,
    scar: !!l.scar,
    eyepatch: !!l.eyepatch,
    medals: !!l.medals,
    mask: l.hat === 'gasmask' ? 'antigas' : 'nada',
    height: l.female ? 0.94 : 1.02,
  };
}

/** Crea (o recupera) a una figura de la historia en un punto. */
export function spawnFigure(sim: Sim, id: string, x: number, z: number, face: number, place: string): Char | null {
  if (sim.state.flags['muerto_' + id]) return null;
  const existing = sim.state.chars.find((c) => c.unique === id);
  if (existing) return existing;
  const f = FIGURES.find((q) => q.id === id);
  if (!f) return null;
  const side = (f.faction ?? 'LIB') as SideId;
  const role: Role = f.ruler ? 'lider' : /Comandante|General|Coronel|mercenarios|Rompehuesos|guardia|stalkers|Cazadora/i.test(f.title) ? 'elite' : /Médic|Hospital|Dr\./i.test(f.title + f.name) ? 'medico' : 'comerciante';
  const c = makeHuman(sim, side, role, x, z, seedFrom(id));
  const patch = figureLook(sim, id, side);
  if (patch && c.look) Object.assign(c.look, patch);
  c.name = f.name;
  c.unique = id;
  c.bio = `${f.title}. ${f.bio}`;
  c.persist = true;
  c.face = face;
  c.ai.mode = 'guardia';
  c.ai.homeX = x;
  c.ai.homeZ = z;
  c.ai.homeFace = face;
  c.ai.place = place;
  // Las figuras son duras de pelar
  for (let i = 0; i < 7; i++) {
    c.hpMax[i] = Math.round(c.hpMax[i] * 1.4);
    c.hp[i] = c.hpMax[i];
  }
  sim.addChar(c);
  return c;
}

// --- Residentes ----------------------------------------------------------------------

function spawnPlace(sim: Sim, place: string) {
  const r = rt(sim);
  const f = sim.world.layout.stationById[place];
  const st = sim.state.stations[place];
  const owner = (st?.owner ?? null) as SideId | null;
  const list = r.spotsByPlace.get(place) ?? [];
  const spots = sim.world.decor.spots;
  const now = sim.state.time;
  let n = 0;
  const alive = (slot: string) => !(st && st.dead[slot] && st.dead[slot] > now);
  const base = (c: Char, slot: string, sp: { x: number; z: number; rot: number }, mode: Char['ai']['mode']) => {
    c.slot = slot;
    c.ai.mode = mode;
    c.ai.place = place;
    c.ai.homeX = sp.x;
    c.ai.homeZ = sp.z;
    c.ai.homeFace = sp.rot;
    c.face = sp.rot;
    sim.addChar(c);
  };
  const ROLES = ROLE_NAMES as Record<string, string>;
  for (const i of list) {
    const sp = spots[i];
    const slot = `${place}:${i}`;
    if (sim.state.chars.some((c) => c.slot === slot)) continue;
    if (sp.kind === 'lider' || sp.kind === 'figura') {
      if (sp.data) {
        const fig = spawnFigure(sim, sp.data, sp.x, sp.z, sp.rot, place);
        if (fig && sp.shop && !fig.vendor) fig.vendor = sp.shop;
      }
      continue;
    }
    if (!PEOPLE_SPOTS.has(sp.kind)) continue;
    const side = (sp.side ?? owner) as SideId | null;
    if (!side) continue;
    if (!alive(slot)) continue;
    const seed = seedFrom(slot, sim.state.seed + (st?.dead[slot] ?? 0));
    if (sp.kind === 'guardia' || sp.kind === 'peaje') {
      let role: Role;
      if (sp.data && ROLES[sp.data]) role = sp.data as Role;
      else if (side === 'VHL') role = 'bandido';
      else if (side === 'LIB') role = 'mercenario';
      else if (side === 'STA' && (seed & 1) === 0) role = 'mercenario';
      else role = (seed & 3) === 0 ? 'soldado' : 'guardia';
      const c = makeHuman(sim, side, role, sp.x, sp.z, seed);
      if (sp.kind === 'peaje') c.bio = 'Cobrador del Consejo Mercantil. Cinco túneles, cinco peajes.';
      base(c, slot, sp, 'guardia');
      n++;
    } else if (sp.kind === 'vendedor' || sp.kind === 'bar' || sp.kind === 'medico') {
      const c = makeHuman(sim, side, sp.kind === 'medico' ? 'medico' : 'comerciante', sp.x, sp.z, seed);
      c.vendor = sp.data ?? 'bazar';
      base(c, slot, sp, 'vendedor');
      n++;
    } else if (sp.kind === 'recluta') {
      const role: Role = (['mercenario', 'obrero', 'cazador', 'refugiado', 'medico', 'soldado'] as Role[])[seed % 6];
      const c = makeHuman(sim, 'LIB', role, sp.x, sp.z, seed);
      const power = c.sk.ataque + c.sk.punteria + c.sk.medicina * 0.5 + c.sk.ingenieria * 0.5;
      c.hire = Math.round((40 + power * 3.2) / 10) * 10;
      c.bio = `${ROLE_NAMES[role]} sin trabajo. Se une a quien pague.`;
      base(c, slot, sp, 'vendedor');
      c.ai.sub = 'sentado';
      n++;
    }
  }
  // Vecinos: según la población de la estación
  if (f && owner) {
    const count = Math.max(6, Math.min(26, Math.round(f.def.population / 26)));
    for (let k = 0; k < count; k++) {
      const slot = `${place}:v${k}`;
      if (sim.state.chars.some((c) => c.slot === slot) || !alive(slot)) continue;
      const seed = seedFrom(slot, sim.state.seed + (st?.dead[slot] ?? 0));
      const role: Role = owner === 'VHL' ? ((seed & 3) === 0 ? 'civil' : 'bandido') : (seed % 5) === 0 ? 'obrero' : (seed % 11) === 0 ? 'refugiado' : 'civil';
      // Sitio de aparición: un punto de ocio al azar o el centro del andén
      const cand = list.filter((i) => spots[i].kind === 'ocio' || spots[i].kind === 'asiento');
      const sp = cand.length ? spots[cand[seed % cand.length]] : { x: f.x, z: f.z, rot: 0 };
      const p = sim.world.nav.nearestPassable(sp.x + ((seed % 7) - 3) * 0.6, sp.z + ((seed % 5) - 2) * 0.6, 4) ?? sp;
      const c = makeHuman(sim, owner, role, p.x, p.z, seed);
      base(c, slot, { x: p.x, z: p.z, rot: (seed % 628) / 100 }, 'residente');
      c.ai.n = (seed % 10) * 0.7;
      n++;
    }
  }
  return n;
}

function despawnPlace(sim: Sim, place: string) {
  const chars = sim.state.chars;
  for (let i = chars.length - 1; i >= 0; i--) {
    const c = chars[i];
    if (c.player || c.squad) continue;
    if (c.ai.place !== place) continue;
    if (c.persist && c.unique) {
      // Las figuras se retiran pero su estado se conserva
      continue;
    }
    if (c.slot || !c.persist) {
      freeSpot(sim, c);
      sim.removeChar(c);
    }
  }
}

// --- Escuadras -------------------------------------------------------------------------

export function placePos(sim: Sim, id: string): { x: number; z: number } | null {
  const f = sim.world.layout.stationById[id];
  if (f) return { x: f.x, z: f.z };
  const n = sim.world.layout.nodeById[id];
  if (n) return { x: n.x, z: n.z };
  return null;
}

export function newSquad(sim: Sim, side: SideId, kind: SquadKind, name: string, roster: string[], at: { x: number; z: number }, plan: string[], home: string): Squad {
  const s: Squad = {
    id: sim.state.nextId++,
    side,
    kind,
    name,
    roster: roster.map((k) => ({ k, id: 0 })),
    x: at.x,
    z: at.z,
    plan,
    pi: 0,
    gx: at.x,
    gz: at.z,
    route: null,
    ri: 0,
    wait: 0,
    mat: false,
    home,
    mode: 'viaje',
    life: 1e9,
  };
  return sim.addSquad(s);
}

function materialize(sim: Sim, s: Squad) {
  s.mat = true;
  const nav = sim.world.nav;
  let k = 0;
  for (const m of s.roster) {
    if (m.dead || m.id) continue;
    const a = (k / Math.max(1, s.roster.length)) * 6.283;
    const r = 1.2 + (k % 3) * 0.9;
    const p = nav.nearestPassable(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, 5) ?? nav.nearestPassable(s.x, s.z, 8);
    if (!p) continue;
    const c = CREATURES[m.k] ? makeCreature(sim, m.k, p.x, p.z) : makeHuman(sim, s.side, m.k as Role, p.x, p.z);
    c.squad = s.id;
    c.ai.mode = CREATURES[m.k] ? 'fiera' : 'escuadra';
    c.ai.homeX = s.x;
    c.ai.homeZ = s.z;
    c.ai.place = s.home;
    c.stance = 'agresivo';
    if (s.kind === 'caravana' && k === 0 && s.cargo) {
      c.vendor = 'caravana';
    }
    m.id = c.id;
    sim.addChar(c);
    k++;
  }
}

function dematerialize(sim: Sim, s: Squad) {
  s.mat = false;
  let sx = 0;
  let sz = 0;
  let n = 0;
  for (const m of s.roster) {
    if (!m.id) continue;
    const c = sim.char(m.id);
    if (c) {
      if (c.st === 'muerto') m.dead = true;
      else {
        sx += c.x;
        sz += c.z;
        n++;
      }
      sim.removeChar(c);
    }
    m.id = 0;
  }
  if (n) {
    s.x = sx / n;
    s.z = sz / n;
  }
  s.route = null;
}

function aliveMembers(sim: Sim, s: Squad): Char[] {
  const out: Char[] = [];
  for (const m of s.roster) {
    if (!m.id) continue;
    const c = sim.char(m.id);
    if (!c || c.st === 'muerto') {
      m.dead = true;
      continue;
    }
    if (c.st === 'ok') out.push(c);
  }
  return out;
}

function nextGoal(sim: Sim, s: Squad) {
  if (!s.plan.length) return;
  s.pi = (s.pi + 1) % s.plan.length;
  const p = placePos(sim, s.plan[s.pi]);
  if (p) {
    const q = sim.world.nav.nearestPassable(p.x, p.z, 10) ?? p;
    s.gx = q.x;
    s.gz = q.z;
    s.route = null;
    s.mode = 'viaje';
  }
}

function stepSquad(sim: Sim, s: Squad, dt: number) {
  s.life -= dt;
  const pd = sim.playerDist(s.x, s.z);
  if (!s.mat && pd < ON) materialize(sim, s);
  else if (s.mat && pd > OFF) dematerialize(sim, s);
  const wild = s.kind === 'jauria';
  if (s.mat) {
    const members = aliveMembers(sim, s);
    if (!members.length) {
      // Todos caídos: si no queda nadie vivo la escuadra desaparece
      if (s.roster.every((m) => m.dead || !m.id || sim.char(m.id)?.st === 'muerto')) {
        for (const m of s.roster) m.id = 0;
        sim.removeSquad(s);
      }
      return;
    }
    const lead = members[0];
    s.x = lead.x;
    s.z = lead.z;
    if (wild) return;
    const fighting = members.some((c) => c.target);
    if (fighting) return;
    if (s.mode === 'viaje' || s.mode === 'vuelta' || s.mode === 'asalto') {
      const d = Math.hypot(s.gx - lead.x, s.gz - lead.z);
      if (d < 7) arriveSquad(sim, s);
      else {
        if (!lead.order) setDest(lead, s.gx, s.gz, 3, false);
        for (let i = 1; i < members.length; i++) {
          const c = members[i];
          if (c.order) continue;
          const row = Math.floor((i + 1) / 2);
          const side = i % 2 ? 1 : -1;
          const bx = lead.x - Math.cos(lead.face) * row * 1.5 - Math.sin(lead.face) * side * 0.9;
          const bz = lead.z - Math.sin(lead.face) * row * 1.5 + Math.cos(lead.face) * side * 0.9;
          const dd = Math.hypot(bx - c.x, bz - c.z);
          if (dd > 1.6) setDest(c, bx, bz, 0.8, dd > 6);
          c.ai.sub = '';
        }
      }
    } else if (s.mode === 'espera' || s.mode === 'acecho') {
      s.wait -= dt;
      for (const c of members) if (!c.hasDest && !c.order) c.ai.sub = s.kind === 'banda' || s.kind === 'refugiados' ? 'acampa' : '';
      if (s.wait <= 0) nextGoal(sim, s);
    }
  } else {
    // Movimiento abstracto a paso de marcha
    if (wild) return;
    if (s.mode === 'espera' || s.mode === 'acecho') {
      s.wait -= dt;
      if (s.wait <= 0) nextGoal(sim, s);
      return;
    }
    if (!s.route) {
      s.route = sim.world.graph.route(s.x, s.z, s.gx, s.gz) ?? [];
      s.ri = 0;
    }
    let move = 1.35 * dt;
    while (move > 0) {
      const tx = s.ri < s.route.length ? s.route[s.ri] : s.gx;
      const tz = s.ri < s.route.length ? s.route[s.ri + 1] : s.gz;
      const d = Math.hypot(tx - s.x, tz - s.z);
      if (d <= move) {
        s.x = tx;
        s.z = tz;
        move -= d;
        if (s.ri < s.route.length) s.ri += 2;
        else {
          arriveSquad(sim, s);
          break;
        }
      } else {
        s.x += ((tx - s.x) / d) * move;
        s.z += ((tz - s.z) / d) * move;
        move = 0;
      }
    }
  }
  if (s.life <= 0 && !s.mat) sim.removeSquad(s);
}

function arriveSquad(sim: Sim, s: Squad) {
  if (s.mode === 'vuelta' && s.pi === 0 && s.life < 1e8) {
    // De vuelta en casa: se disuelve
    if (!s.mat) sim.removeSquad(s);
    else s.life = 0;
    return;
  }
  s.mode = s.kind === 'banda' ? 'acecho' : 'espera';
  s.wait = s.kind === 'caravana' ? 240 + sim.rng.next() * 240 : s.kind === 'banda' ? 300 + sim.rng.next() * 500 : 60 + sim.rng.next() * 120;
  s.route = null;
  if (s.mat) for (const m of s.roster) {
    const c = m.id ? sim.char(m.id) : null;
    if (c) clearDest(c);
  }
}

// --- Generación de escuadras ---------------------------------------------------------------

const FACTION_STATIONS = (sim: Sim, side: SideId) => Object.values(sim.state.stations).filter((s) => s.owner === side).map((s) => s.id);

function spawnRoamers(sim: Sim) {
  const st = sim.state;
  const count = (kind: SquadKind, side?: SideId) => st.squads.filter((q) => q.kind === kind && (!side || q.side === side)).length;
  // Patrullas de cada facción entre sus estaciones
  for (const side of ['UNI', 'SDR', 'LEV', 'NOR'] as FactionId[]) {
    const own = FACTION_STATIONS(sim, side);
    if (own.length < 2 || count('patrulla', side) >= (side === 'UNI' || side === 'LEV' ? 2 : 1)) continue;
    const a = own[Math.floor(sim.rng.next() * own.length)];
    const plan = [a, ...sim.rng.shuffle(own.filter((x) => x !== a))];
    const p = placePos(sim, a)!;
    newSquad(sim, side, 'patrulla', 'Patrulla', ['oficial', 'soldado', 'soldado', 'soldado', ...(sim.rng.chance(0.5) ? ['soldado'] : [])], sim.world.nav.nearestPassable(p.x, p.z, 10) ?? p, plan, a);
  }
  // Caravanas
  if (count('caravana') < 4) {
    const owners: [SideId, string][] = [
      ['STA', 'STA'],
      ['UNI', 'TSE'],
      ['LIB', 'STA'],
      ['SDR', 'IND'],
      ['LEV', 'RAS'],
      ['NOR', 'UBE'],
    ];
    const [side, home] = owners[Math.floor(sim.rng.next() * owners.length)];
    const routes: Record<string, string[][]> = {
      STA: [['STA', 'TSE', 'ZVE'], ['STA', 'KHO', 'RUB'], ['STA', 'TSE', 'UBE']],
      TSE: [['TSE', 'ZVE', 'MOS'], ['TSE', 'STA'], ['TSE', 'UBE', 'SEV'], ['TSE', 'STL']],
      IND: [['IND', 'RUB', 'KHO']],
      RAS: [['RAS', 'STL', 'VYS']],
      UBE: [['UBE', 'SEV'], ['UBE', 'TSE']],
    };
    const plan = sim.rng.pick(routes[home]);
    const p = placePos(sim, home)!;
    const sq = newSquad(sim, side, 'caravana', 'Caravana', ['caravanero', 'caravanero', 'guardia', 'guardia', ...(side === 'STA' ? ['mercenario'] : [])], sim.world.nav.nearestPassable(p.x, p.z, 10) ?? p, plan, home);
    sq.cargo = [];
  }
  // Bandas de Vhlainska en los túneles del este
  if (st.stations.VHL.owner === 'VHL' && count('banda') < 3) {
    const lairs = ['H2', 'E1', 'E3', 'VHL', 'H3', 'E2'];
    const a = sim.rng.pick(lairs);
    const p = placePos(sim, 'VHL')!;
    const n = sim.rng.int(3, 5);
    newSquad(sim, 'VHL', 'banda', 'Banda de saqueadores', ['jefe', ...Array(n).fill('bandido')], sim.world.nav.nearestPassable(p.x, p.z, 10) ?? p, [a, sim.rng.pick(lairs), 'VHL'], 'VHL');
  }
  // Stalkers del Norte
  if (st.stations.SEV.owner === 'NOR' && count('stalkers') < 1) {
    const p = placePos(sim, 'SEV')!;
    newSquad(sim, 'NOR', 'stalkers', 'Stalkers del Norte', ['stalker', 'stalker', 'stalker'], sim.world.nav.nearestPassable(p.x, p.z, 10) ?? p, ['SEV', 'UBE', 'W2', 'UBE'], 'SEV');
  }
}

/** Jaurías: se asientan en los nidos y en los túneles peligrosos. */
export function seedPacks(sim: Sim) {
  const spots = sim.world.decor.spots;
  spots.forEach((sp, i) => {
    if (sp.kind !== 'nido') return;
    const kind = sp.data ?? 'rata';
    const def = CREATURES[kind];
    if (!def) return;
    const key = 'nido' + i;
    if (sim.state.squads.some((q) => q.name === key)) return;
    const n = sim.rng.int(def.pack[0], def.pack[1]);
    const sq = newSquad(sim, 'MUT', 'jauria', key, Array(n).fill(kind), { x: sp.x, z: sp.z }, [], sp.place);
    sq.wait = i;
  });
}

function respawnPacks(sim: Sim) {
  // Un nido vaciado se repuebla al cabo de unos días
  const spots = sim.world.decor.spots;
  const t = sim.state.time;
  spots.forEach((sp, i) => {
    if (sp.kind !== 'nido') return;
    const key = 'nido' + i;
    if (sim.state.squads.some((q) => q.name === key)) return;
    const until = sim.state.timers[key];
    if (until === undefined) sim.state.timers[key] = t + 3 * 1440 + sim.rng.next() * 1440;
    else if (t >= until && sim.playerDist(sp.x, sp.z) > 150) {
      delete sim.state.timers[key];
      const kind = sp.data ?? 'rata';
      const def = CREATURES[kind];
      if (!def || sim.state.flags['limpio_' + sp.place]) return;
      const n = sim.rng.int(def.pack[0], def.pack[1]);
      newSquad(sim, 'MUT', 'jauria', key, Array(n).fill(kind), { x: sp.x, z: sp.z }, [], sp.place);
    }
  });
}

// --- Actualización ---------------------------------------------------------------------------

let roamT = 0;

export function updatePopulation(sim: Sim, dt: number) {
  const r = rt(sim);
  // Estaciones, cruces y altos del camino con residentes
  for (const [place, p] of r.places) {
    const d = sim.playerDist(p.x, p.z);
    if (!r.active.has(place) && d < p.rad + ON) {
      r.active.add(place);
      spawnPlace(sim, place);
    } else if (r.active.has(place) && d > p.rad + OFF) {
      r.active.delete(place);
      despawnPlace(sim, place);
    }
  }
  for (const id of Object.keys(sim.state.stations)) {
    const st = sim.state.stations[id];
    if (st.alert > 0) st.alert -= dt;
    if (!st.visited) {
      const f = sim.world.layout.stationById[id];
      if (f && sim.playerDist(f.x, f.z) < Math.max(f.hl, f.hw) + 10) {
        st.visited = true;
        sim.emit({ t: 'mundo', k: 'llegada', a: 0, id: 0 });
        sim.log(`Has llegado a ${f.def.name}.`, 'historia');
      }
    }
  }
  for (let i = sim.state.squads.length - 1; i >= 0; i--) {
    const s = sim.state.squads[i];
    if (s.kind === 'jugador') continue;
    stepSquad(sim, s, dt);
  }
  roamT -= dt;
  if (roamT <= 0) {
    roamT = 20;
    spawnRoamers(sim);
    respawnPacks(sim);
  }
  void hostile;
  void stationAt;
}
