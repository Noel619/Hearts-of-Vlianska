import { describe, expect, it } from 'vitest';
import {
  ADVISORS,
  DECISIONS,
  EVENTS,
  FACTIONS,
  FOCUS_TREES,
  LEADERS,
  MAP,
  SPECIAL_TEMPLATES,
  SPIRITS,
  STATIONS,
  TECH_BY_ID,
  TECHS,
  TRAITS,
  BATTALIONS,
  LAWS,
} from '../src/data';
import type { Condition, Effect, FactionId } from '../src/game/types';
import { FACTION_IDS } from '../src/game/types';

const KNOWN_CUSTOM = new Set([
  'expedicion',
  'saqueo',
  'colonizar',
  'integrar',
  'excavar',
  'batida',
  'mercenarios',
  'repartirEquipo',
  'robarEquipo',
  'unirseGuerra',
  'limpiarPermanente',
  'inundacion',
  'aplastarRevuelta',
  'liberarEstacion',
]);

const errors: string[] = [];

function stationRef(ref: string, where: string) {
  if (ref === 'CAPITAL' || ref === 'TARGET') return;
  if (!STATIONS[ref]) errors.push(`${where}: estación desconocida ${ref}`);
}

function templateExists(id: string, faction?: FactionId) {
  if (SPECIAL_TEMPLATES[id]) return true;
  if (faction) return FACTIONS[faction].templates.some((t) => t.id === id);
  return FACTION_IDS.some((f) => FACTIONS[f].templates.some((t) => t.id === id));
}

function checkCond(c: Condition | undefined, where: string) {
  if (!c) return;
  switch (c.c) {
    case 'hasFocus':
      if (!Object.values(FOCUS_TREES).some((t) => t.focuses.some((f) => f.id === c.id))) errors.push(`${where}: enfoque desconocido ${c.id}`);
      break;
    case 'hasTech':
      if (!TECH_BY_ID[c.id]) errors.push(`${where}: tecnología desconocida ${c.id}`);
      break;
    case 'hasSpirit':
      if (!SPIRITS[c.id]) errors.push(`${where}: espíritu desconocido ${c.id}`);
      break;
    case 'controls':
    case 'owns':
      stationRef(c.station, where);
      break;
    case 'stationFree':
      stationRef(c.station, where);
      break;
    case 'edgeOpen':
      if (!MAP.provinces[c.province] && !MAP.edges.some((e) => e.tunnel === c.province)) errors.push(`${where}: provincia desconocida ${c.province}`);
      break;
    case 'provinceDanger':
      if (!MAP.provinces[c.province]) errors.push(`${where}: provincia desconocida ${c.province}`);
      break;
    case 'leader':
      if (!LEADERS[c.id]) errors.push(`${where}: líder desconocido ${c.id}`);
      break;
    case 'and':
    case 'or':
      c.list.forEach((x) => checkCond(x, where));
      break;
    case 'not':
      checkCond(c.cond, where);
      break;
    case 'scoped':
      checkCond(c.cond, where);
      break;
    default:
      break;
  }
}

function checkEffects(list: Effect[] | undefined, where: string, faction?: FactionId) {
  for (const e of list ?? []) {
    switch (e.t) {
      case 'addSpirit':
      case 'removeSpirit':
        if (!SPIRITS[e.id]) errors.push(`${where}: espíritu desconocido ${e.id}`);
        break;
      case 'event':
        if (!EVENTS[e.id]) errors.push(`${where}: evento desconocido ${e.id}`);
        break;
      case 'tech':
        if (!TECH_BY_ID[e.id]) errors.push(`${where}: tecnología desconocida ${e.id}`);
        break;
      case 'template':
        if (!SPECIAL_TEMPLATES[e.id]) errors.push(`${where}: plantilla especial desconocida ${e.id}`);
        break;
      case 'unit':
        if (!templateExists(e.template, faction)) errors.push(`${where}: plantilla desconocida ${e.template}`);
        stationRef(e.station, where);
        break;
      case 'setIdeology':
        if (e.leader && !LEADERS[e.leader]) errors.push(`${where}: líder desconocido ${e.leader}`);
        break;
      case 'setLeader':
        if (!LEADERS[e.leader]) errors.push(`${where}: líder desconocido ${e.leader}`);
        break;
      case 'unlockDecision':
        if (!DECISIONS[e.id]) errors.push(`${where}: decisión desconocida ${e.id}`);
        break;
      case 'building':
      case 'slots':
      case 'resource':
      case 'population':
      case 'claim':
      case 'core':
      case 'fortAround':
        stationRef(e.station, where);
        break;
      case 'withdrawUnits':
        stationRef(e.from, where);
        break;
      case 'transferStation':
        stationRef(e.station, where);
        break;
      case 'danger':
      case 'clearCollapse':
        if (e.province !== 'TARGET' && !MAP.provinces[e.province]) errors.push(`${where}: provincia desconocida ${e.province}`);
        break;
      case 'openEdge':
        if (!MAP.edges.some((x) => x.id === e.edge || x.tunnel === e.edge)) errors.push(`${where}: túnel desconocido ${e.edge}`);
        break;
      case 'custom':
        if (!KNOWN_CUSTOM.has(e.id)) errors.push(`${where}: efecto especial desconocido ${e.id}`);
        if (e.id === 'mercenarios' && e.arg && !SPECIAL_TEMPLATES[String(e.arg)]) errors.push(`${where}: plantilla de mercenarios desconocida ${e.arg}`);
        if (e.id === 'limpiarPermanente') {
          for (const id of String(e.arg ?? '').split(',')) if (!MAP.provinces[id]) errors.push(`${where}: provincia desconocida ${id}`);
        }
        break;
      case 'if':
        checkCond(e.cond, where);
        checkEffects(e.then, where, faction);
        checkEffects(e.else, where, faction);
        break;
      case 'random':
        checkEffects(e.then, where, faction);
        checkEffects(e.else, where, faction);
        break;
      case 'scoped':
        checkEffects(e.effects, where);
        break;
      default:
        break;
    }
  }
}

describe('contenido', () => {
  it('todas las referencias existen', () => {
    for (const f of FACTION_IDS) {
      const def = FACTIONS[f];
      if (!LEADERS[def.leader]) errors.push(`${f}: líder desconocido`);
      for (const s of def.spirits) if (!SPIRITS[s]) errors.push(`${f}: espíritu inicial desconocido ${s}`);
      for (const t of def.techs) if (!TECH_BY_ID[t]) errors.push(`${f}: tecnología inicial desconocida ${t}`);
      for (const l of Object.values(def.laws)) if (!LAWS[l]) errors.push(`${f}: ley desconocida ${l}`);
      for (const tpl of def.templates) for (const b of [...tpl.line, ...tpl.support]) if (!BATTALIONS[b]) errors.push(`${f}: batallón desconocido ${b}`);
      for (const u of def.units) {
        if (!def.templates.some((t) => t.id === u.template)) errors.push(`${f}: plantilla inicial desconocida ${u.template}`);
        if (!MAP.provinces[u.province]) errors.push(`${f}: provincia inicial desconocida ${u.province}`);
      }
      const tree = FOCUS_TREES[f];
      if (!tree) {
        errors.push(`${f}: sin árbol de enfoques`);
        continue;
      }
      const ids = new Set(tree.focuses.map((x) => x.id));
      const pos = new Set<string>();
      for (const focus of tree.focuses) {
        const where = `enfoque ${focus.id}`;
        for (const group of focus.prereq ?? []) for (const p of group) if (!ids.has(p)) errors.push(`${where}: prerrequisito desconocido ${p}`);
        for (const x of focus.exclusive ?? []) if (!ids.has(x)) errors.push(`${where}: exclusivo desconocido ${x}`);
        const key = `${focus.x},${focus.y}`;
        if (pos.has(key)) errors.push(`${where}: posición repetida ${key}`);
        pos.add(key);
        checkCond(focus.available, where);
        checkCond(focus.bypass, where);
        for (const r of focus.aiIf ?? []) checkCond(r.cond, where);
        checkEffects(focus.effects, where, f);
      }
    }
    for (const ev of Object.values(EVENTS)) {
      checkCond(ev.trigger, `evento ${ev.id}`);
      if (!ev.triggeredOnly && !ev.mtth) errors.push(`evento ${ev.id}: sin mtth ni triggeredOnly`);
      for (const o of ev.options) {
        checkCond(o.available, `evento ${ev.id}`);
        for (const r of o.aiIf ?? []) checkCond(r.cond, `evento ${ev.id}`);
        checkEffects(o.effects, `evento ${ev.id}`, ev.factions?.length === 1 ? ev.factions[0] : undefined);
      }
    }
    for (const d of Object.values(DECISIONS)) {
      checkCond(d.visible, `decisión ${d.id}`);
      checkCond(d.available, `decisión ${d.id}`);
      checkEffects(d.effects, `decisión ${d.id}`, d.factions?.[0]);
      checkEffects(d.completeEffects, `decisión ${d.id}`, d.factions?.[0]);
    }
    for (const t of TECHS) {
      for (const p of t.prereq ?? []) if (!TECH_BY_ID[p]) errors.push(`tecnología ${t.id}: prerrequisito desconocido ${p}`);
      for (const p of t.exclusive ?? []) if (!TECH_BY_ID[p]) errors.push(`tecnología ${t.id}: exclusiva desconocida ${p}`);
      checkEffects(t.effects, `tecnología ${t.id}`);
    }
    for (const l of Object.values(LEADERS)) for (const t of l.traits) if (!TRAITS[t]) errors.push(`líder ${l.id}: rasgo desconocido ${t}`);
    for (const a of ADVISORS) if (a.faction && !FACTIONS[a.faction]) errors.push(`asesor ${a.id}: facción desconocida`);
    for (const tpl of Object.values(SPECIAL_TEMPLATES)) for (const b of [...tpl.line, ...tpl.support]) if (!BATTALIONS[b]) errors.push(`plantilla ${tpl.id}: batallón ${b}`);
    expect(errors).toEqual([]);
  });

  it('los árboles de enfoques están bien construidos', () => {
    const problems: string[] = [];
    const unlockable = new Set<string>();
    const collect = (list: Effect[] | undefined) => {
      for (const e of list ?? []) {
        if (e.t === 'unlockDecision') unlockable.add(e.id);
        if (e.t === 'if') {
          collect(e.then);
          collect(e.else);
        }
        if (e.t === 'random') {
          collect(e.then);
          collect(e.else);
        }
        if (e.t === 'scoped') collect(e.effects);
      }
    };
    for (const f of FACTION_IDS) {
      const tree = FOCUS_TREES[f];
      const byId = new Map(tree.focuses.map((x) => [x.id, x]));
      // Árboles largos: dan para toda la partida.
      if (tree.focuses.length < 30) problems.push(`${f}: solo ${tree.focuses.length} enfoques`);
      const roots = tree.focuses.filter((x) => !x.prereq?.length);
      if (roots.length !== 1) problems.push(`${f}: debe tener una sola raíz (tiene ${roots.map((r) => r.id).join(', ')})`);
      for (const focus of tree.focuses) {
        collect(focus.effects);
        for (const x of focus.exclusive ?? []) {
          if (!byId.get(x)?.exclusive?.includes(focus.id)) problems.push(`${focus.id}: la exclusión con ${x} no es mutua`);
        }
        for (const group of focus.prereq ?? []) {
          for (const p of group) {
            const parent = byId.get(p);
            if (parent && parent.y >= focus.y) problems.push(`${focus.id}: su requisito ${p} no está por encima`);
          }
        }
        if (tree.branches && !tree.branches.some((b) => focus.x >= b.x0 && focus.x <= b.x1)) problems.push(`${focus.id}: fuera de cualquier rama`);
      }
      const branches = [...(tree.branches ?? [])].sort((a, b) => a.x0 - b.x0);
      for (let i = 1; i < branches.length; i++) if (branches[i].x0 <= branches[i - 1].x1) problems.push(`${f}: ramas solapadas`);
      if (!tree.desc) problems.push(`${f}: el árbol no tiene descripción`);
    }
    for (const ev of Object.values(EVENTS)) for (const o of ev.options) collect(o.effects);
    for (const d of Object.values(DECISIONS)) {
      if (d.unlockedBy) {
        if (!Object.values(FOCUS_TREES).some((t) => t.focuses.some((x) => x.id === d.unlockedBy))) problems.push(`decisión ${d.id}: enfoque ${d.unlockedBy} desconocido`);
        if (!unlockable.has(d.id)) problems.push(`decisión ${d.id}: nada la desbloquea`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('el mapa respeta las conexiones del metro', () => {
    // Conexiones entre estaciones sin pasar por otras estaciones.
    const reach = (from: string) => {
      const seen = new Set([from]);
      const out = new Set<string>();
      const queue = [from];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const { to, edge } of MAP.adjacency[cur]) {
          if (edge.latent || seen.has(to)) continue;
          if (MAP.provinces[to].terrain === 'derrumbe') continue;
          seen.add(to);
          if (MAP.provinces[to].kind === 'estacion') out.add(to);
          else queue.push(to);
        }
      }
      return out;
    };
    const expectLinks: [string, string][] = [
      ['RAS', 'STL'],
      ['STL', 'VYS'],
      ['STL', 'UBE'],
      ['STL', 'TSE'],
      ['VYS', 'MER'],
      ['UBE', 'SEV'],
      ['TSE', 'ZVE'],
      ['TSE', 'STA'],
      ['TSE', 'TEN'],
      ['ZVE', 'MOS'],
      ['ZVE', 'TEN'],
      ['STA', 'TEN'],
      ['STA', 'VHL'],
      ['STA', 'KHO'],
      ['STA', 'RUB'],
      ['VHL', 'TEN'],
      ['VHL', 'KHO'],
      ['KHO', 'RUB'],
      ['RUB', 'IND'],
    ];
    for (const [a, b] of expectLinks) expect(reach(a).has(b), `${a}-${b}`).toBe(true);
    // Mostovaya y Chernovodskaya empiezan incomunicadas.
    expect(reach('MOS').has('CHE')).toBe(false);
    expect(reach('CHE').size).toBe(0);
  });
});
