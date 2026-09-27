// Nidos de criaturas: las arañas de Tenevskaya.
//
// "Criaturas arácnidas extremadamente sensibles a la luz que acechan en las oscuras profundidades."
// - Hembras (se lanzan con sus quelíceros) y machos (telarañas y cola, desgastan la organización).
// - Extremadamente resistentes a los disparos, vulnerables al fuego y a la luz.
// - Viven solo en la oscuridad: nunca salen del nido. Quien quiera la estación tiene que entrar a por ellas.
// - Si el nido no se limpia del todo, crían y vuelven a llenarlo.
import { MAP } from '../data';
import type { GameState, Nest, SpiderPack, Unit } from './types';
import { addLog, factionName, friendly, neighbors, provinceName } from './helpers';
import { applyLoss, removeUnit, unitStats } from './military';

export const SPIDERS = {
  /** Fracción del daño de las balas que les hace algo. */
  BULLETS: 0.15,
  /** Multiplicador del fuego de los lanzallamas. */
  FIRE: 4,
  /** Ancho del frente dentro del nido: las demás unidades esperan su turno. */
  WIDTH: 12,
  /** Daño que reciben los grupos por punto de ataque y hora (sobre su vida 0..1). */
  K_DAMAGE: 0.0016,
  /** Ataque por hora de cada grupo con la vida completa. */
  ATTACK: { hembra: 16, macho: 7 },
  /** Los machos atacan con telarañas: más desgaste de la organización. */
  WEB_ORG: 1.8,
  /** Organización y fuerza que quita cada punto de ataque. */
  K_ORG: 0.09,
  K_STR: 0.0025,
  /** Con focos o antorchas (stalkers, Operación Luz en el Túnel) las arañas hacen menos daño. */
  LIGHT: 0.7,
  /** Vida que recupera cada grupo por hora cuando nadie lo ataca. */
  REGEN: 0.0003,
  /** Días entre crías y tope de grupos. */
  BROOD_DAYS: 60,
  MAX_PACKS: 6,
};

export const PACK_NAMES: Record<SpiderPack['kind'], string> = { hembra: 'Hembras', macho: 'Machos' };

export function createNests(start: number): Record<string, Nest> {
  const packs: SpiderPack[] = [
    { id: 'ara1', kind: 'hembra', hp: 1 },
    { id: 'ara2', kind: 'hembra', hp: 1 },
    { id: 'ara3', kind: 'macho', hp: 1 },
    { id: 'ara4', kind: 'macho', hp: 1 },
    { id: 'ara5', kind: 'macho', hp: 1 },
  ];
  return { TEN: { province: 'TEN', packs, nextBrood: start + 24 * SPIDERS.BROOD_DAYS } };
}

/** ¿Hay un nido vivo en la provincia? */
export function nestAt(state: GameState, pid: string): Nest | undefined {
  const n = state.nests?.[pid];
  return n && n.packs.length > 0 ? n : undefined;
}

export function nestStrength(n: Nest): number {
  return n.packs.reduce((s, p) => s + p.hp, 0);
}

/** Unidades que combaten contra el nido: las que están dentro y las que atacan desde un túnel vecino. */
function fightersOf(state: GameState, n: Nest): Unit[] {
  return Object.values(state.units).filter(
    (u) =>
      u.province === n.province ||
      (u.path[0] === n.province && !u.battle && !u.retreating && MAP.adjacency[u.province]?.some((a) => a.to === n.province)),
  );
}

function hasLight(state: GameState, u: Unit): boolean {
  return unitStats(state, u).vision > 0 || state.countries[u.owner].spirits.some((sp) => sp.id === 'uni_luz_tunel');
}

/** Huida del nido hacia un túnel propio o de nadie; si no hay salida, las arañas los devoran. */
function flee(state: GameState, u: Unit, n: Nest) {
  u.path = [];
  u.moveProgress = 0;
  u.nest = undefined;
  if (u.province !== n.province) return;
  const exit = neighbors(state, n.province).find((x) => {
    const ctrl = state.provinces[x.to].controller;
    return !ctrl || friendly(state, ctrl, u.owner);
  });
  if (exit) {
    u.province = exit.to;
    return;
  }
  if (state.player === u.owner) addLog(state, { text: `Las arañas devoran a ${u.name} en ${provinceName(n.province)}.`, kind: 'malo', faction: u.owner, province: n.province });
  removeUnit(state, u.id);
}

/** Una hora de combate contra cada nido. */
export function hourlyNests(state: GameState) {
  for (const n of Object.values(state.nests ?? {})) {
    if (n.packs.length === 0) continue;
    const fighters = fightersOf(state, n);
    for (const u of Object.values(state.units)) if (u.nest === n.province && !fighters.includes(u)) u.nest = undefined;
    if (fighters.length === 0) {
      // En calma, las heridas se cierran (despacio: un nido acosado sin tregua acaba cayendo).
      for (const p of n.packs) p.hp = Math.min(1, p.hp + SPIDERS.REGEN);
      continue;
    }
    for (const u of fighters) u.nest = n.province;
    // Solo cabe un frente estrecho: combaten las unidades más frescas; las demás relevan.
    const front: Unit[] = [];
    let width = 0;
    for (const u of [...fighters].sort((a, b) => b.org - a.org)) {
      const w = unitStats(state, u).width;
      if (front.length && width + w > SPIDERS.WIDTH) continue;
      front.push(u);
      width += w;
    }
    // Daño a las arañas: casi nada de las balas, mucho del fuego.
    let dmg = 0;
    for (const u of front) {
      const s = unitStats(state, u);
      const orgK = s.org > 0 ? Math.max(0.2, u.org / s.org) : 0;
      const bullets = Math.max(0, s.soft - s.fireSoft) * SPIDERS.BULLETS;
      dmg += (bullets + s.fireSoft * SPIDERS.FIRE) * (0.3 + 0.7 * u.strength) * orgK;
    }
    const share = (dmg * SPIDERS.K_DAMAGE) / n.packs.length;
    for (const p of n.packs) p.hp -= share;
    // Ataque de las arañas, repartido entre quienes las atacan.
    for (const p of n.packs) {
      if (p.hp <= 0) continue;
      const atk = SPIDERS.ATTACK[p.kind] * p.hp;
      const per = atk / front.length;
      for (const u of front) {
        if (!state.units[u.id]) continue;
        const s = unitStats(state, u);
        const light = hasLight(state, u) ? SPIDERS.LIGHT : 1;
        const block = 1 / (1 + s.def / 25);
        u.org = Math.max(0, u.org - per * SPIDERS.K_ORG * light * block * (p.kind === 'macho' ? SPIDERS.WEB_ORG : 1));
        if (p.kind === 'hembra') applyLoss(state, u, per * SPIDERS.K_STR * light * block, s);
      }
    }
    n.packs = n.packs.filter((p) => p.hp > 0);
    // Quien se queda sin organización huye (o muere si no tiene adónde ir).
    for (const u of fighters) {
      if (!state.units[u.id]) continue;
      const s = unitStats(state, u);
      if (u.org <= s.org * 0.05 || u.strength <= 0.05) flee(state, u, n);
    }
    if (n.packs.length === 0) {
      const winner = fighters.find((u) => state.units[u.id])?.owner;
      for (const u of fighters) if (state.units[u.id]) u.nest = undefined;
      addLog(state, {
        text: winner ? `¡${factionName(winner)} limpia el nido de arañas de ${provinceName(n.province)}!` : `El nido de arañas de ${provinceName(n.province)} ha sido destruido.`,
        kind: 'guerra',
        faction: winner,
        province: n.province,
      });
    }
  }
}

/** Cada cierto tiempo, un nido que no se ha limpiado cría un grupo nuevo. */
export function dailyNests(state: GameState) {
  for (const n of Object.values(state.nests ?? {})) {
    if (n.packs.length === 0 || state.hour < n.nextBrood) continue;
    n.nextBrood = state.hour + 24 * SPIDERS.BROOD_DAYS;
    if (n.packs.length >= SPIDERS.MAX_PACKS) continue;
    const kind: SpiderPack['kind'] = n.packs.filter((p) => p.kind === 'hembra').length < 2 ? 'hembra' : 'macho';
    n.packs.push({ id: `ara${state.hour}`, kind, hp: 0.5 });
  }
}

/** Daño directo al nido (decisiones y enfoques de quema). */
export function burnNest(state: GameState, pid: string, fraction: number) {
  const n = nestAt(state, pid);
  if (!n) return;
  for (const p of n.packs) p.hp -= fraction;
  n.packs = n.packs.filter((p) => p.hp > 0);
}
