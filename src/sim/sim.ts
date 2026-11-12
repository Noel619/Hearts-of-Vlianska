// La simulación: estado del juego, bucle de actualización y servicios comunes
// (búsqueda espacial, registro, sucesos, crímenes, ruido).

import { FACTION_IDS, FACTION_LORE } from '../data/historia/facciones';
import { STATIONS } from '../data/historia/mapa';
import type { FactionId, SideId } from '../data/tipos';
import { Rng } from '../core/rng';
import { stepChar } from './ai';
import { relKey, stepNeeds } from './combat';
import { separate } from './move';
import { updatePopulation } from './population';
import { stepWorldEvents } from './events';
import { stepBuildings } from './build';
import type { Char, Container, LogEntry, ResNode, SimEvent, SimState, Squad } from './types';
import { SAVE_VERSION } from './types';
import type { World } from './world';

const HASH = 8;

export class Sim {
  state: SimState;
  rng: Rng;
  events: SimEvent[] = [];
  tick = 0;
  private byId = new Map<number, Char>();
  private squadById = new Map<number, Squad>();
  private cells = new Map<number, Char[]>();
  private acc = 0;
  private slowAcc = 0;
  private lastHunger = -999;
  /** Jugadores vivos (se recalcula cada paso). */
  players: Char[] = [];

  constructor(
    readonly world: World,
    state?: SimState,
  ) {
    this.state = state ?? blankState(1);
    this.rng = new Rng(this.state.rng || this.state.seed);
    this.reindex();
  }

  // --- Índices ---------------------------------------------------------------

  reindex() {
    this.byId.clear();
    for (const c of this.state.chars) this.byId.set(c.id, c);
    this.squadById.clear();
    for (const s of this.state.squads) this.squadById.set(s.id, s);
    this.rehash();
  }

  private rehash() {
    this.cells.clear();
    this.players.length = 0;
    for (const c of this.state.chars) {
      const k = (Math.floor(c.x / HASH) + 2048) * 4096 + Math.floor(c.z / HASH) + 2048;
      let a = this.cells.get(k);
      if (!a) this.cells.set(k, (a = []));
      a.push(c);
      if (c.player && c.st !== 'muerto') this.players.push(c);
    }
  }

  char(id: number): Char | null {
    return this.byId.get(id) ?? null;
  }
  squad(id: number): Squad | null {
    return this.squadById.get(id) ?? null;
  }

  addChar(c: Char): Char {
    this.state.chars.push(c);
    this.byId.set(c.id, c);
    this.emit({ t: 'nace', id: c.id });
    return c;
  }

  removeChar(c: Char) {
    const i = this.state.chars.indexOf(c);
    if (i >= 0) this.state.chars.splice(i, 1);
    this.byId.delete(c.id);
    if (c.carry) {
      const o = this.char(c.carry);
      if (o) o.carriedBy = 0;
    }
    if (c.carriedBy) {
      const o = this.char(c.carriedBy);
      if (o) o.carry = 0;
    }
    this.emit({ t: 'adios', id: c.id });
  }

  addSquad(s: Squad): Squad {
    this.state.squads.push(s);
    this.squadById.set(s.id, s);
    return s;
  }

  removeSquad(s: Squad) {
    const i = this.state.squads.indexOf(s);
    if (i >= 0) this.state.squads.splice(i, 1);
    this.squadById.delete(s.id);
  }

  /** Recorre los personajes a menos de `r` metros de un punto. */
  forNear(x: number, z: number, r: number, fn: (c: Char) => void) {
    const x0 = Math.floor((x - r) / HASH);
    const x1 = Math.floor((x + r) / HASH);
    const z0 = Math.floor((z - r) / HASH);
    const z1 = Math.floor((z + r) / HASH);
    const r2 = r * r;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const a = this.cells.get((cx + 2048) * 4096 + cz + 2048);
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const c = a[i];
          const dx = c.x - x;
          const dz = c.z - z;
          if (dx * dx + dz * dz <= r2) fn(c);
        }
      }
    }
  }

  /** Distancia al personaje del jugador más cercano. */
  playerDist(x: number, z: number): number {
    let best = Infinity;
    for (const p of this.players) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) best = d;
    }
    return best;
  }

  container(id: number): Container | null {
    return this.state.containers.find((c) => c.id === id) ?? null;
  }
  node(id: number): ResNode | null {
    return this.state.nodes.find((c) => c.id === id) ?? null;
  }

  // --- Sucesos y registro -------------------------------------------------------

  emit(e: SimEvent) {
    this.events.push(e);
  }

  log(msg: string, kind: LogEntry['kind'] = 'info') {
    this.state.log.push({ t: this.state.time, msg, kind });
    if (this.state.log.length > 80) this.state.log.shift();
    this.emit({ t: 'aviso', msg, kind });
  }

  hungerWarn(c: Char) {
    if (this.state.time - this.lastHunger < 240) return;
    this.lastHunger = this.state.time;
    this.log(`${c.name} tiene hambre y no queda comida.`, 'malo');
  }

  /** Ruido: alerta a quien pueda oírlo. */
  noise(src: Char, radius: number) {
    this.forNear(src.x, src.z, radius, (o) => {
      if (o === src || o.st !== 'ok' || o.target) return;
      if (o.ai.mode === 'fiera' && src.side !== 'MUT') {
        // Las fieras acuden al ruido
        o.ai.sub = 'ruido';
        o.ai.homeX = src.x;
        o.ai.homeZ = src.z;
      }
    });
  }

  // --- Reputación y crímenes ------------------------------------------------------

  rep(f: FactionId, delta: number, why?: string) {
    const st = this.state;
    const old = st.rep[f];
    st.rep[f] = Math.max(-100, Math.min(100, old + delta));
    if (why && Math.abs(delta) >= 3) this.log(`${FACTION_LORE[f].name}: ${delta > 0 ? '+' : ''}${Math.round(delta)} de reputación (${why}).`, delta > 0 ? 'bueno' : 'malo');
  }

  /** El jugador ha agredido o robado a alguien de un bando pacífico. */
  crime(victim: Char, severity: number) {
    const f = victim.side as string;
    if (!FACTION_IDS.includes(f as FactionId)) {
      if (victim.side === 'LIB') victim.ai.sub = 'enfadado';
      return;
    }
    const fid = f as FactionId;
    this.rep(fid, -severity * 0.3, 'agresión');
    this.state.bounty[fid] = Math.min(400, this.state.bounty[fid] + severity * 3);
    const st = this.state.stations[victim.ai.place];
    if (st) st.alert = 600;
    // Los presentes se vuelven hostiles
    this.forNear(victim.x, victim.z, 40, (o) => {
      if (o.side === victim.side && o.st === 'ok') o.ai.sub = 'enfadado';
    });
  }

  onUniqueDeath(c: Char, by: Char) {
    this.state.flags['muerto_' + c.unique] = 1;
    this.log(`${c.name} ha muerto a manos de ${by.name}. El metro entero se enterará.`, 'historia');
    this.emit({ t: 'mundo', k: 'figuraMuerta', id: c.id });
  }

  // --- Bucle ------------------------------------------------------------------------

  /** Avanza la simulación `dt` segundos (ya multiplicados por la velocidad de juego). */
  step(dt: number) {
    this.acc += dt;
    const h = 1 / 30;
    let n = 0;
    while (this.acc >= h && n < 12) {
      this.acc -= h;
      n++;
      this.stepFixed(h);
    }
    if (this.acc > h * 4) this.acc = 0;
  }

  private stepFixed(dt: number) {
    const st = this.state;
    st.time += dt;
    this.tick++;
    this.rehash();
    // Sistemas lentos (2 Hz)
    this.slowAcc += dt;
    if (this.slowAcc >= 0.5) {
      const sdt = this.slowAcc;
      this.slowAcc = 0;
      updatePopulation(this, sdt);
      for (let i = st.chars.length - 1; i >= 0; i--) {
        const c = st.chars[i];
        stepNeeds(this, c, sdt);
        if ((this.tick + c.id) % 3 === 0) c.lit = this.world.field.level(c.x, c.z);
        if (c.st === 'muerto' && c.rot <= 0 && !c.carriedBy) this.removeChar(c);
      }
      stepBuildings(this, sdt);
      stepWorldEvents(this, sdt);
      for (let i = st.drops.length - 1; i >= 0; i--) {
        st.drops[i].t -= sdt;
        if (st.drops[i].t <= 0 || st.drops[i].items.length === 0) st.drops.splice(i, 1);
      }
    }
    const chars = st.chars;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c.st === 'muerto') continue;
      c.sinceFire += dt;
      c.sinceHit += dt;
      c.sinceBlock += dt;
      stepChar(this, c, dt);
    }
    for (let i = 0; i < chars.length; i++) separate(this, chars[i]);
    st.rng = this.rng.s;
  }

  // --- Tiempo ------------------------------------------------------------------------

  /** Día de juego (empieza en 1). */
  get day() {
    return Math.floor(this.state.time / 1440) + 1;
  }
  /** Hora del día (0-24). */
  get hour() {
    return ((this.state.time / 60 + 8) % 24 + 24) % 24;
  }
  dateText(): string {
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const lens = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let d = Math.floor((this.state.time + 8 * 60) / 1440) + 11;
    let m = 0;
    let y = 2033;
    while (d >= lens[m]) {
      d -= lens[m];
      m++;
      if (m >= 12) {
        m = 0;
        y++;
      }
    }
    return `${d + 1} de ${months[m]} de ${y}`;
  }
  clockText(): string {
    const h = this.hour;
    return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  }
}

export function blankState(seed: number): SimState {
  const rel: Record<string, number> = {};
  for (const a of FACTION_IDS) {
    for (const b of FACTION_IDS) {
      if (a >= b) continue;
      const v1 = FACTION_LORE[a].relations[b];
      const v2 = FACTION_LORE[b].relations[a];
      rel[relKey(a, b)] = Math.round(((v1 ?? v2 ?? 0) + (v2 ?? v1 ?? 0)) / 2);
    }
  }
  const zero = () => Object.fromEntries(FACTION_IDS.map((f) => [f, 0])) as Record<FactionId, number>;
  const stations: SimState['stations'] = {};
  for (const s of STATIONS) stations[s.id] = { id: s.id, owner: s.owner as SideId | null, shops: {}, alert: 0, dead: {}, visited: false };
  return {
    version: SAVE_VERSION,
    seed,
    rng: seed * 7919 + 13,
    time: 0,
    nextId: 1,
    money: 0,
    scenario: '',
    playerName: 'Los Sin Nombre',
    playerColor: 0xd8c27a,
    chars: [],
    squads: [],
    buildings: [],
    drops: [],
    containers: [],
    nodes: [],
    stations,
    rel,
    rep: zero(),
    bounty: zero(),
    flags: {},
    tech: { done: [], cur: null, prog: 0 },
    log: [],
    timers: {},
    stats: { kills: 0, days: 0, earned: 0, built: 0 },
  };
}
