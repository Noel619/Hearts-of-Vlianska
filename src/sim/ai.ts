// Comportamiento de los personajes: ejecución de órdenes (jugador y PNJ) y
// conductas de fondo: residentes, guardias, vendedores, escuadras y fieras.

import { CREATURES } from '../data/criaturas';
import { ITEMS, stackState } from '../data/items';
import { addItem, countItem, crawling, gainXp, healthFrac, invWeight, limpSide, maxCarry } from './chars';
import { findEnemy, hostile, needsCare, stepFight, topUpMagazine, treat } from './combat';
import { clearDest, faceTo, setDest, stepMove } from './move';
import { stepJobs, workOnBuilding } from './build';
import { cleanAirNear } from './gas';
import { freeSpot, occupySpot, pickSpot } from './population';
import { isCivilDefense, workNode } from './events';
import type { Sim } from './sim';
import type { Char, Order } from './types';

const PEACEFUL = new Set(['civil', 'comerciante', 'refugiado', 'obrero', 'medico', 'caravanero']);

export function stepChar(sim: Sim, c: Char, dt: number): void {
  // --- Llevado a hombros ------------------------------------------------------
  if (c.carriedBy) {
    const o = sim.char(c.carriedBy);
    if (!o || o.st !== 'ok') {
      c.carriedBy = 0;
      if (o) o.carry = 0;
      c.pose = c.st === 'ok' ? 'normal' : 'ko';
    } else {
      c.x = o.x;
      c.z = o.z;
      c.face = o.face + Math.PI;
      c.pose = 'cargado';
      c.speed = 0;
      return;
    }
  }
  if (c.st === 'ko') {
    c.pose = 'ko';
    c.speed = 0;
    c.work = 'nada';
    return;
  }
  // Estado visual por defecto (cada rama lo ajusta)
  const prevPose = c.pose;
  c.pose = crawling(c) ? 'gateo' : 'normal';
  c.work = 'nada';

  // --- Percepción y decisión ----------------------------------------------------
  c.ai.t -= dt;
  if (c.ai.t <= 0) {
    c.ai.t = 0.35 + ((c.id * 0.137) % 0.2);
    think(sim, c);
  }

  // --- Huida -------------------------------------------------------------------------
  if (c.ai.sub === 'susto' || c.ai.sub === 'huye') {
    c.ai.n -= dt;
    if (c.ai.n <= 0) {
      c.ai.sub = '';
    } else {
      if (!c.hasDest) setDest(c, c.ai.homeX, c.ai.homeZ, 1.5, true);
      stepMove(sim, c, dt);
      return;
    }
  }

  // --- Combate --------------------------------------------------------------------------
  const mayFight = !(c.order && (c.order.t === 'mover' || c.order.t === 'cargar') && c.player && c.stance !== 'agresivo' && c.order.data !== 'ataque');
  if (c.target && (mayFight || c.order?.t === 'atacar')) {
    if (stepFight(sim, c, dt)) {
      stepMove(sim, c, dt);
      return;
    }
  } else if (c.atkT >= 0) {
    c.atkT = -1;
  }
  c.aim = 0;

  // --- Órdenes ------------------------------------------------------------------------------
  if (!c.order && c.queue.length) c.order = c.queue.shift()!;
  if (c.order) {
    runOrder(sim, c, c.order, dt);
  } else {
    idle(sim, c, dt, prevPose);
  }
  const arrived = stepMove(sim, c, dt);
  if (arrived && c.order?.t === 'mover') c.order = null;
}

// ---------------------------------------------------------------------------
// Decisión
// ---------------------------------------------------------------------------

function think(sim: Sim, c: Char): void {
  const creature = c.kind !== 'humano' ? CREATURES[c.kind] : null;
  if (c.target) {
    const t = sim.char(c.target);
    if (!t || t.st === 'muerto') c.target = 0;
    return;
  }
  if (creature) {
    if (!creature.hostile) {
      // Los animales mansos huyen de las fieras
      return;
    }
    // Las criaturas que temen la luz no entran en zonas iluminadas
    if (creature.lightFear && c.lit > 0.55) {
      c.ai.sub = 'huye';
      c.ai.n = 5;
      return;
    }
    const e = findEnemy(sim, c, creature.sight + 6);
    if (e && !(creature.lightFear && e.lit > 0.7)) c.target = e.id;
    return;
  }
  if (c.player) {
    if (c.stance === 'pasivo') return;
    // No interrumpe órdenes de movimiento salvo en modo agresivo
    const e = findEnemy(sim, c, c.stance === 'agresivo' ? 40 : 11);
    if (e && (c.stance === 'agresivo' || !c.order || c.order.t !== 'mover')) c.target = e.id;
    return;
  }
  if (PEACEFUL.has(c.role)) {
    // Los civiles huyen del peligro cercano
    let danger: Char | null = null;
    sim.forNear(c.x, c.z, 14, (o) => {
      if (!danger && o.st === 'ok' && (hostile(sim, c, o) || (o.atkT >= 0 && o.side !== c.side))) danger = o;
    });
    if (danger) {
      c.ai.sub = 'susto';
      c.ai.n = 8;
      freeSpot(sim, c);
      const d = danger as Char;
      const ang = Math.atan2(c.z - d.z, c.x - d.x);
      const p = sim.world.nav.nearestPassable(c.x + Math.cos(ang) * 18, c.z + Math.sin(ang) * 18, 6);
      if (p) setDest(c, p.x, p.z, 1.5, true);
    }
    return;
  }
  // Combatientes: moral
  if (healthFrac(c) < 0.28 && c.side !== 'CAL' && c.role !== 'elite' && c.role !== 'lider' && sim.rng.chance(0.5)) {
    c.ai.sub = 'huye';
    c.ai.n = 14;
    c.target = 0;
    setDest(c, c.ai.homeX, c.ai.homeZ, 2, true);
    return;
  }
  const e = findEnemy(sim, c, 38);
  if (e) {
    c.target = e.id;
    freeSpot(sim, c);
  }
}

// ---------------------------------------------------------------------------
// Órdenes
// ---------------------------------------------------------------------------

/** Se acerca a un punto; devuelve true cuando está a `range` o menos. */
function approach(sim: Sim, c: Char, x: number, z: number, range: number, run = true): boolean {
  const d = Math.hypot(x - c.x, z - c.z);
  if (d <= range) {
    if (c.hasDest) clearDest(c);
    return true;
  }
  const o = c.order;
  if (!c.hasDest && o) {
    // Sin destino en marcha: o es el primer intento o el anterior no encontró camino
    o.fail = (o.fail ?? 0) + 1;
    if (o.fail > 2) {
      // Tan cerca como se puede: vale si el objetivo está a la vista
      if (d <= range + 2.6 && sim.world.nav.sightLine(c.x, c.z, x, z) >= 0.99) return true;
      if (c.player) sim.emit({ t: 'flota', x: c.x, z: c.z, text: 'No puedo llegar', color: '#d8a060' });
      done(c);
      return false;
    }
  }
  setDest(c, x, z, range * 0.8, run);
  return false;
}

function done(c: Char) {
  c.order = null;
  c.workT = 0;
}

function runOrder(sim: Sim, c: Char, o: Order, dt: number): void {
  switch (o.t) {
    case 'mover': {
      if (!c.hasDest) {
        const d = Math.hypot((o.x ?? c.x) - c.x, (o.z ?? c.z) - c.z);
        if (d < 0.6) done(c);
        else setDest(c, o.x!, o.z!, 0.4, o.data !== 'andar');
      }
      break;
    }
    case 'atacar': {
      const t = sim.char(o.id!);
      if (!t || t.st === 'muerto' || (t.st === 'ko' && o.data !== 'rematar')) {
        done(c);
        c.target = 0;
      } else {
        if (t.st === 'ko' && o.data === 'rematar') {
          // Rematar a un caído
          if (approach(sim, c, t.x, t.z, 1.4)) c.target = t.id;
        } else c.target = t.id;
      }
      break;
    }
    case 'seguir': {
      const t = sim.char(o.id!);
      if (!t || t.st === 'muerto') {
        done(c);
        break;
      }
      const d = Math.hypot(t.x - c.x, t.z - c.z);
      if (d > 3.2) setDest(c, t.x, t.z, 2.2, d > 7);
      break;
    }
    case 'recoger': {
      const dr = sim.state.drops.find((d) => d.id === o.id);
      if (!dr) {
        done(c);
        break;
      }
      if (approach(sim, c, dr.x, dr.z, 1.2)) {
        const cap = maxCarry(c) * 1.6;
        for (let i = dr.items.length - 1; i >= 0; i--) {
          const s = dr.items[i];
          const w = ITEMS[s.id]?.w ?? 0;
          const can = w > 0 ? Math.floor((cap - invWeight(c)) / w) : s.n;
          const n = Math.min(s.n, Math.max(0, can));
          if (n > 0) {
            addItem(c, s.id, n, stackState(s));
            s.n -= n;
            if (s.n <= 0) dr.items.splice(i, 1);
          }
        }
        sim.emit({ t: 'sonido', k: 'coger', x: c.x, z: c.z });
        done(c);
      }
      break;
    }
    case 'saquear':
    case 'abrir': {
      const t = o.t === 'saquear' ? sim.char(o.id!) : null;
      const cont = o.t === 'abrir' ? sim.container(o.id!) : null;
      const tx = t?.x ?? cont?.x;
      const tz = t?.z ?? cont?.z;
      if (tx === undefined || tz === undefined) {
        done(c);
        break;
      }
      if (approach(sim, c, tx, tz, 1.5)) {
        c.pose = 'arrodillado';
        c.work = 'rebuscar';
        faceTo(c, tx, tz, dt);
        if (cont && cont.lock > 0 && !cont.opened && c.player && isCivilDefense(cont) && sim.players.some((q) => countItem(q, 'llaveAlmacen') > 0)) {
          // La llave de la defensa civil abre las puertas blindadas de Tenevskaya
          cont.opened = true;
          sim.log('La llave de la defensa civil gira con un chasquido. La puerta blindada se abre por primera vez en veinte años.', 'historia');
          sim.emit({ t: 'sonido', k: 'cerradura', x: cont.x, z: cont.z });
        }
        if (cont && cont.lock > 0 && !cont.opened) {
          // Forzar la cerradura
          c.workT += dt * (0.5 + c.sk.cerraduras * 0.03 + (c.inv.some((s) => s.id === 'ganzuas') ? 0.4 : 0));
          if (c.workT > cont.lock * 0.35) {
            c.workT = 0;
            gainXp(sim, c, 'cerraduras', 2 + cont.lock * 0.2);
            if (sim.rng.chance(Math.min(0.95, 0.35 + (c.sk.cerraduras - cont.lock) * 0.03 + 0.3))) {
              cont.opened = true;
              sim.emit({ t: 'sonido', k: 'cerradura', x: cont.x, z: cont.z });
            } else sim.emit({ t: 'flota', x: cont.x, z: cont.z, text: 'La cerradura resiste', color: '#c8a070' });
          }
          break;
        }
        if (cont) cont.opened = true;
        sim.emit({ t: 'mundo', k: o.t, id: o.id, a: c.id });
        done(c);
      }
      break;
    }
    case 'hablar': {
      const t = sim.char(o.id!);
      if (!t || t.st !== 'ok') {
        done(c);
        break;
      }
      if (approach(sim, c, t.x, t.z, 3.1, false)) {
        faceTo(c, t.x, t.z, dt);
        if (c.player) sim.state.flags.tHablar = 1;
        sim.emit({ t: 'mundo', k: 'hablar', id: t.id, a: c.id });
        done(c);
      }
      break;
    }
    case 'curar': {
      const t = sim.char(o.id!);
      if (!t || t.st === 'muerto') {
        done(c);
        break;
      }
      if (t === c) {
        c.pose = 'arrodillado';
        c.work = 'vendar';
        if (!treat(sim, c, c, dt)) done(c);
        break;
      }
      if (approach(sim, c, t.x, t.z, 1.3)) {
        c.pose = 'arrodillado';
        c.work = 'vendar';
        faceTo(c, t.x, t.z, dt);
        if (!treat(sim, c, t, dt)) done(c);
      }
      break;
    }
    case 'cargar': {
      const t = sim.char(o.id!);
      if (!t || t.carriedBy || c.carry) {
        done(c);
        break;
      }
      if (approach(sim, c, t.x, t.z, 1.2)) {
        if (t.st === 'ok' && t.side !== c.side) {
          done(c);
          break;
        }
        c.carry = t.id;
        t.carriedBy = c.id;
        t.order = null;
        t.queue.length = 0;
        clearDest(t);
        sim.emit({ t: 'sonido', k: 'coger', x: c.x, z: c.z });
        done(c);
      }
      break;
    }
    case 'soltar': {
      if (c.carry) {
        const t = sim.char(c.carry);
        if (t) {
          t.carriedBy = 0;
          const bed = o.id ? sim.state.buildings.find((b) => b.id === o.id) : null;
          if (bed) {
            t.x = bed.x;
            t.z = bed.z;
            t.face = -bed.rot + Math.PI / 2;
            t.ai.sub = 'cama';
            t.ai.n = bed.id;
          } else {
            t.x = c.x + Math.cos(c.face) * 0.7;
            t.z = c.z + Math.sin(c.face) * 0.7;
          }
          t.pose = t.st === 'ok' ? 'normal' : 'ko';
        }
        c.carry = 0;
      }
      done(c);
      break;
    }
    case 'construir':
    case 'operar':
    case 'derribar':
    case 'descansar': {
      if (!workOnBuilding(sim, c, o, dt)) done(c);
      break;
    }
    case 'chatarrear':
    case 'excavar': {
      if (!workNode(sim, c, o, dt)) done(c);
      break;
    }
    default:
      done(c);
  }
}

// ---------------------------------------------------------------------------
// Conductas de fondo
// ---------------------------------------------------------------------------

function idle(sim: Sim, c: Char, dt: number, prevPose: string): void {
  switch (c.ai.mode) {
    case 'jugador': {
      // Recarga, cura a los compañeros y atiende sus trabajos
      topUpMagazine(sim, c, dt);
      if (c.ai.sub === 'cama') {
        c.pose = 'tumbado';
        return;
      }
      if (c.autoHeal && (sim.tick + c.id) % 20 === 0 && !c.hasDest) {
        if (needsCare(c) && hasMeds(c)) {
          c.order = { t: 'curar', id: c.id };
          return;
        }
        let patient: Char | null = null;
        sim.forNear(c.x, c.z, 14, (o) => {
          if (!patient && o.player && o !== c && needsCare(o) && !o.carriedBy) patient = o;
        });
        if (patient && hasMeds(c)) {
          c.order = { t: 'curar', id: (patient as Char).id };
          return;
        }
      }
      // Sin órdenes, nadie se queda a respirar gas (salvo que se le mande quedarse quieto)
      if (c.gas > 0 && !c.hold) {
        if (!c.hasDest && (sim.tick + c.id) % 15 === 0) {
          const p = cleanAirNear(sim, c);
          if (p) {
            setDest(c, p.x, p.z, 0.8, true);
            sim.emit({ t: 'flota', x: c.x, z: c.z, text: 'Me aparto del gas', color: '#b9d77a' });
          }
        }
        return;
      }
      if (!c.hold && stepJobs(sim, c, dt)) return;
      break;
    }
    case 'residente':
      resident(sim, c, dt, prevPose);
      break;
    case 'guardia':
    case 'vendedor': {
      const d = Math.hypot(c.ai.homeX - c.x, c.ai.homeZ - c.z);
      if (d > 1.2) setDest(c, c.ai.homeX, c.ai.homeZ, 0.5, d > 12);
      else if (!c.hasDest) {
        const fd = c.ai.homeFace - c.face;
        c.face += Math.atan2(Math.sin(fd), Math.cos(fd)) * Math.min(1, dt * 5);
        c.work = c.ai.mode === 'guardia' ? 'guardia' : 'nada';
        if (c.ai.sub === 'sentado') c.pose = 'sentado';
        // Tras el combate, atiende a los suyos
        if ((sim.tick + c.id) % 45 === 0 && hasMeds(c)) {
          sim.forNear(c.x, c.z, 16, (o) => {
            if (!c.order && o.side === c.side && o !== c && needsCare(o)) c.order = { t: 'curar', id: o.id };
          });
        }
      }
      topUpMagazine(sim, c, dt);
      break;
    }
    case 'fiera': {
      // Merodea alrededor de su guarida
      c.ai.n -= dt;
      if (c.ai.sub === 'ruido') {
        if (!c.hasDest) setDest(c, c.ai.homeX, c.ai.homeZ, 2, true);
        if (Math.hypot(c.ai.homeX - c.x, c.ai.homeZ - c.z) < 4) c.ai.sub = '';
      } else if (c.ai.n <= 0 && !c.hasDest) {
        c.ai.n = 3 + sim.rng.next() * 7;
        const a = sim.rng.next() * 6.283;
        const r = 3 + sim.rng.next() * 10;
        const p = sim.world.nav.nearestPassable(c.ai.homeX + Math.cos(a) * r, c.ai.homeZ + Math.sin(a) * r, 3);
        if (p) setDest(c, p.x, p.z, 0.8, false);
      }
      break;
    }
    case 'escuadra': {
      // El destino lo fija la lógica de escuadras; aquí solo detalles
      topUpMagazine(sim, c, dt);
      if (!c.hasDest && c.ai.sub === 'acampa') {
        c.pose = 'sentadoSuelo';
        c.work = 'calentarse';
      }
      if ((sim.tick + c.id) % 60 === 0 && hasMeds(c) && !c.order) {
        sim.forNear(c.x, c.z, 14, (o) => {
          if (!c.order && o.side === c.side && o !== c && o.squad === c.squad && needsCare(o)) c.order = { t: 'curar', id: o.id };
        });
      }
      break;
    }
    default:
      break;
  }
}

function hasMeds(c: Char): boolean {
  for (const s of c.inv) if (s.id === 'vendas' || s.id === 'botiquin') return true;
  return false;
}

/** Vida cotidiana: va de un punto de interés a otro y hace algo en cada uno. */
function resident(sim: Sim, c: Char, dt: number, prevPose: string): void {
  const ai = c.ai;
  const spots = sim.world.decor.spots;
  if (ai.sub === 'estar' && ai.spot >= 0) {
    const sp = spots[ai.spot];
    ai.n -= dt;
    const fd = sp.rot - c.face;
    c.face += Math.atan2(Math.sin(fd), Math.cos(fd)) * Math.min(1, dt * 4);
    if (sp.kind === 'asiento') {
      c.pose = sp.data === 'suelo' ? 'sentadoSuelo' : 'sentado';
      c.work = sp.data === 'guitarra' ? 'guitarra' : sp.data === 'fuego' || sp.data === 'suelo' ? 'calentarse' : (c.id + Math.floor(sim.state.time / 40)) % 3 === 0 ? 'comer' : 'nada';
    } else if (sp.kind === 'cama') {
      c.pose = 'tumbado';
    } else if (sp.kind === 'trabajo') {
      c.work = sp.data === 'martillo' ? 'martillo' : sp.data === 'cocina' ? 'cocinar' : sp.data === 'rezo' ? 'rezar' : sp.data === 'escribir' ? 'escribir' : sp.data === 'cultivo' ? 'rebuscar' : 'operar';
      if (sp.data === 'rezo') c.pose = 'arrodillado';
      if (sp.data === 'cultivo') c.pose = 'cuclillas';
    } else {
      c.work = sp.data === 'fuego' ? 'calentarse' : (c.id + Math.floor(sim.state.time / 30)) % 2 === 0 ? 'hablar' : 'nada';
    }
    if (ai.n <= 0) {
      freeSpot(sim, c);
      ai.sub = '';
    }
    return;
  }
  if (ai.sub === 'ir' && ai.spot >= 0) {
    const sp = spots[ai.spot];
    if (!c.hasDest) {
      const d = Math.hypot(sp.x - c.x, sp.z - c.z);
      if (d < 1.1) {
        ai.sub = 'estar';
        // En la cama de noche se queda hasta el amanecer (más o menos)
        const h = sim.hour;
        ai.n = sp.kind === 'cama' && (h >= 22 || h < 6) ? 240 + sim.rng.next() * 360 : 25 + sim.rng.next() * 90;
        c.x += (sp.x - c.x) * 0.5;
        c.z += (sp.z - c.z) * 0.5;
      } else {
        // No pudo llegar: prueba otro sitio
        freeSpot(sim, c);
        ai.sub = '';
        ai.n = 2;
      }
    }
    return;
  }
  ai.n -= dt;
  if (ai.n > 0) return;
  const idx = pickSpot(sim, c);
  if (idx >= 0) {
    occupySpot(sim, c, idx);
    ai.sub = 'ir';
    const sp = spots[idx];
    setDest(c, sp.x, sp.z, 0.6, false);
  } else {
    ai.n = 4 + sim.rng.next() * 6;
    // Paseo corto
    const a = sim.rng.next() * 6.283;
    const p = sim.world.nav.nearestPassable(ai.homeX + Math.cos(a) * 6, ai.homeZ + Math.sin(a) * 6, 3);
    if (p) setDest(c, p.x, p.z, 0.6, false);
  }
  void prevPose;
  void limpSide;
}
