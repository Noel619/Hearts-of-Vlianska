// Arquetipos de la gente del metro: aspecto, equipo y pericia según la
// facción y el oficio. Los colores siguen la historia: la estrella azul de la
// Unión, el tridente verde de los Seguidores, las banderas rojas del
// Levantamiento, el ámbar de Staraya…

import type { Rng } from '../core/rng';
import { DEFAULT_LOOK, HAIR_COLORS, SKIN_TONES, type Facial, type HairStyle, type Hat, type Look, type Mask, type Top } from './looks';
import type { SideId } from './tipos';

export type Role =
  | 'soldado'
  | 'elite'
  | 'oficial'
  | 'guardia'
  | 'civil'
  | 'obrero'
  | 'comerciante'
  | 'medico'
  | 'stalker'
  | 'bandido'
  | 'jefe'
  | 'mercenario'
  | 'caravanero'
  | 'refugiado'
  | 'cazador'
  | 'lider';

interface Palette {
  top: Top[];
  topColor: number[];
  pants: number[];
  hats: Hat[];
  hatColor: number[];
  armband?: number;
  scarf?: number;
}

const CIVIL_TOPS: number[] = [0x5a5c4a, 0x6a5c4c, 0x4a4f58, 0x7a6a52, 0x5c4a3e, 0x4f5a4a, 0x70685c, 0x3f4650];
const CIVIL_PANTS: number[] = [0x3f4038, 0x2e3030, 0x3a342c, 0x35302a, 0x3a4250];

/** Paleta militar de cada bando. */
const MIL: Record<string, Palette> = {
  UNI: { top: ['guerrera'], topColor: [0x2f4263, 0x334a6e], pants: [0x232a38, 0x2a3040], hats: ['casco', 'gorra'], hatColor: [0x3a4a66], armband: 0x2f62d8 },
  SDR: { top: ['chaqueton'], topColor: [0x4a5a3a, 0x525f40], pants: [0x3a3f2e], hats: ['ushanka', 'casco'], hatColor: [0x4a4436, 0x44502f], armband: 0x3f8f3a },
  LEV: { top: ['chaqueton', 'mono'], topColor: [0x6a5238, 0x5c4a36], pants: [0x3c3a34], hats: ['gorra', 'ushanka'], hatColor: [0x7a2a24, 0x5a3a2c], armband: 0xb3202c },
  STA: { top: ['cuero', 'abrigo'], topColor: [0x4a3626, 0x5a4632], pants: [0x35302a], hats: ['boina', 'ushanka', 'nada'], hatColor: [0x8a5a18, 0x3a2e24], scarf: 0xe39b2d },
  VHL: { top: ['cuero', 'harapos'], topColor: [0x2e2622, 0x3a2e28, 0x4a3a30], pants: [0x3a342c, 0x2a2622], hats: ['panuelo', 'capucha', 'nada'], hatColor: [0xe8572a, 0x3a2a22], scarf: 0x8a3a1c },
  CHE: { top: ['guerrera'], topColor: [0x5a5066, 0x4f465c], pants: [0x3a3440], hats: ['casco', 'gorra'], hatColor: [0x4a3f5a], armband: 0x8e3bbf },
  CAL: { top: ['tunica'], topColor: [0x1f6e58, 0x2a5a4a, 0x3a4a3a], pants: [0x3a3a34], hats: ['panuelo', 'kufi'], hatColor: [0x1f9e7a, 0xd8d2bc], scarf: 0x1f9e7a },
  NOR: { top: ['mono', 'chaqueton'], topColor: [0x6a5f44, 0x74684a], pants: [0x4a4636], hats: ['casco', 'capucha', 'gorra'], hatColor: [0x6a5f44], armband: 0xb08948 },
  LIB: { top: ['abrigo', 'chaqueton', 'harapos'], topColor: CIVIL_TOPS, pants: CIVIL_PANTS, hats: ['ushanka', 'gorra', 'capucha', 'nada'], hatColor: [0x4a4436, 0x3a3a3a] },
  JUG: { top: ['chaqueton', 'abrigo', 'cuero'], topColor: CIVIL_TOPS, pants: CIVIL_PANTS, hats: ['nada', 'gorra', 'ushanka'], hatColor: [0x4a4436, 0x3a3a3a] },
};

export function randomBody(rng: Rng, opts: { female?: boolean; age?: 0 | 1 | 2; dark?: boolean } = {}): Pick<Look, 'seed' | 'height' | 'build' | 'female' | 'skin' | 'hair' | 'hairColor' | 'facial' | 'age'> {
  const female = opts.female ?? rng.chance(0.32);
  const age = opts.age ?? (rng.weighted([0, 1, 2] as const, (a) => [0.25, 0.55, 0.2][a]) as 0 | 1 | 2);
  const hairs: HairStyle[] = female ? ['largo', 'mono', 'corto', 'largo'] : ['corto', 'corto', 'rapado', 'calvo', 'largo'];
  const facials: Facial[] = female ? ['nada'] : ['nada', 'nada', 'barba3', 'bigote', 'barba', 'barbaLarga'];
  return {
    seed: rng.int(1, 1e9),
    height: (female ? 0.93 : 1) * rng.range(0.95, 1.06),
    build: rng.range(-0.7, 0.9),
    female,
    skin: opts.dark ? rng.pick(SKIN_TONES.slice(2)) : rng.weighted(SKIN_TONES, (_s) => 1 - SKIN_TONES.indexOf(_s) * 0.18),
    hair: age === 2 && !female && rng.chance(0.4) ? 'calvo' : rng.pick(hairs),
    hairColor: age === 2 ? HAIR_COLORS[4] : rng.pick(HAIR_COLORS.slice(0, 4).concat(HAIR_COLORS[5])),
    facial: rng.pick(facials),
    age,
  };
}

/** Aspecto completo para un arquetipo. */
export function makeLook(rng: Rng, side: SideId, role: Role): Look {
  const pal = MIL[side] ?? MIL.LIB;
  const body = randomBody(rng, { dark: side === 'CAL' && rng.chance(0.75), female: role === 'soldado' || role === 'elite' || role === 'bandido' ? rng.chance(0.15) : undefined });
  const look: Look = { ...DEFAULT_LOOK, ...body, bootsColor: rng.pick([0x221c18, 0x2a2420, 0x1a1a1a]) };
  const military = role === 'soldado' || role === 'elite' || role === 'oficial' || role === 'guardia' || role === 'bandido' || role === 'jefe' || role === 'mercenario' || role === 'stalker' || role === 'cazador' || role === 'lider';
  if (military) {
    look.top = rng.pick(pal.top);
    look.topColor = rng.pick(pal.topColor);
    look.pantsColor = rng.pick(pal.pants);
    look.hat = rng.pick(pal.hats);
    look.hatColor = rng.pick(pal.hatColor);
    if (pal.armband !== undefined) look.armband = pal.armband;
    if (pal.scarf !== undefined && rng.chance(0.6)) look.scarf = pal.scarf;
  } else {
    const tops: Top[] = role === 'obrero' ? ['mono', 'chaqueton', 'camisa'] : role === 'comerciante' ? ['abrigo', 'traje', 'cuero'] : role === 'medico' ? ['abrigo'] : role === 'refugiado' ? ['harapos', 'harapos', 'abrigo'] : ['chaqueton', 'abrigo', 'camisa', 'harapos', 'cuero'];
    look.top = rng.pick(tops);
    look.topColor = role === 'medico' ? 0xd8d8d0 : rng.pick(CIVIL_TOPS);
    look.pantsColor = rng.pick(CIVIL_PANTS);
    look.hat = rng.pick<Hat>(['nada', 'nada', 'ushanka', 'gorra', 'panuelo']);
    look.hatColor = rng.pick([0x4a4436, 0x3a3a3a, 0x5a3a2c, 0x2e3a4a]);
    if (rng.chance(0.3)) look.scarf = rng.pick([0x6a3a2a, 0x3a4a5a, 0x5a5a3a, 0x7a6a4a]);
    // Un detalle del color de su estación
    if (pal.armband !== undefined && rng.chance(0.25)) look.armband = pal.armband;
    if (side === 'CAL') {
      look.top = 'tunica';
      look.topColor = rng.pick([0xd8d2bc, 0x8a8468, 0x3a5a4a, 0x6a6456]);
      look.hat = look.female ? 'panuelo' : rng.pick<Hat>(['kufi', 'kufi', 'nada']);
      look.hatColor = look.female ? rng.pick([0x1f6e58, 0x8a8468, 0x4a4a4a]) : 0xe8e4d8;
      if (!look.female && rng.chance(0.6)) look.facial = rng.pick<Facial>(['barba', 'barbaLarga']);
    }
    if (side === 'STA' && role === 'comerciante') look.scarf = 0xe39b2d;
  }
  switch (role) {
    case 'elite':
      look.hat = 'casco';
      look.vest = side === 'SDR' ? 0x2e3326 : side === 'UNI' ? 0x1e2430 : 0x2e2a26;
      look.vestPlates = true;
      look.pouches = true;
      look.kneePads = 0x222222;
      break;
    case 'soldado':
    case 'guardia':
      if (rng.chance(0.5)) {
        look.vest = side === 'UNI' ? 0x1e2430 : 0x3a3c30;
        look.pouches = true;
      }
      if (rng.chance(0.3)) look.bandolier = true;
      break;
    case 'oficial':
    case 'lider':
      look.hat = side === 'CAL' ? 'kufi' : side === 'VHL' ? 'panuelo' : 'plato';
      look.medals = side !== 'VHL' && side !== 'CAL';
      look.top = side === 'CAL' ? 'tunica' : side === 'VHL' ? 'cuero' : 'guerrera';
      break;
    case 'bandido':
      if (rng.chance(0.6)) look.mask = rng.pick<Mask>(['panuelo', 'gafas', 'respirador']);
      if (rng.chance(0.4)) look.shoulderPads = 0x3a3a3a;
      if (rng.chance(0.3)) look.bandolier = true;
      break;
    case 'jefe':
      look.shoulderPads = 0x4a3a2a;
      look.bandolier = true;
      look.build = Math.max(look.build, 0.5);
      break;
    case 'mercenario':
      look.vest = 0x2e2a26;
      look.pouches = true;
      look.hat = rng.pick<Hat>(['boina', 'casco', 'pasamontanas']);
      look.hatColor = look.hat === 'boina' ? 0x5a1e1a : 0x2a2a2a;
      break;
    case 'stalker':
    case 'cazador':
      look.mask = rng.chance(0.7) ? 'antigas' : 'gafas';
      look.hat = 'capucha';
      look.hatColor = 0x4a4a3c;
      look.backpack = 0x4a4636;
      look.gloves = 0x1a1a1a;
      look.kneePads = 0x2a2a2a;
      break;
    case 'caravanero':
      look.backpack = rng.pick([0x4a4636, 0x5a4a36, 0x3d4a3a]);
      break;
    case 'obrero':
      if (rng.chance(0.5)) look.gloves = 0x5a4a30;
      break;
    case 'medico':
      if (rng.chance(0.5)) look.mask = 'respirador';
      break;
    default:
      break;
  }
  if (rng.chance(0.07)) look.glasses = true;
  if (military && rng.chance(0.08)) look.scar = true;
  return look;
}

export interface Loadout {
  weapon: string | null;
  /** Arma secundaria en el inventario. */
  sidearm?: string;
  armor: string[];
  items: [string, number][];
  /** Nivel medio de combate y de oficio. */
  combat: number;
  craft: number;
  money: number;
}

const RIFLES: Record<string, string[]> = {
  UNI: ['ak', 'fusilTunel', 'cerrojo'],
  SDR: ['ak', 'ak', 'fusilTunel'],
  LEV: ['cerrojo', 'fusilTunel', 'fusilTunel'],
  STA: ['fusilTunel', 'escopeta', 'ak'],
  VHL: ['escopeta', 'fusilTunel', 'subfusil'],
  CHE: ['cerrojo', 'ak', 'fusilTunel'],
  CAL: ['fusilTunel', 'cerrojo'],
  NOR: ['fusilTunel', 'cerrojo', 'neumatico'],
  LIB: ['fusilTunel', 'escopeta'],
  JUG: ['fusilTunel'],
};
const MELEE = ['cuchillo', 'machete', 'tubo', 'llave', 'pala', 'hacha', 'lanza', 'palanca'];

export function makeLoadout(rng: Rng, side: SideId, role: Role): Loadout {
  const rifles = RIFLES[side] ?? RIFLES.LIB;
  const food: [string, number][] = [[rng.pick(['hongosSecos', 'hongos', 'guiso']), rng.int(1, 3)]];
  switch (role) {
    case 'soldado':
      return { weapon: rng.chance(0.75) ? rng.pick(rifles) : 'machete', sidearm: 'cuchillo', armor: rng.chance(0.4) ? ['casco'] : [], items: [['balas', rng.int(20, 50)], ['vendas', rng.int(0, 2)], ...food], combat: rng.range(18, 32), craft: 8, money: rng.int(2, 14) };
    case 'guardia':
      return { weapon: rng.chance(0.6) ? rng.pick(rifles) : rng.pick(['tubo', 'machete', 'pala']), armor: [], items: [['balas', rng.int(12, 30)], ...food], combat: rng.range(14, 26), craft: 8, money: rng.int(2, 10) };
    case 'elite':
      return { weapon: side === 'NOR' ? 'carabina' : 'ak', sidearm: 'machete', armor: ['casco', 'chalecoPlacas'], items: [['balas', rng.int(60, 100)], ['vendas', 2], ['botiquin', rng.int(0, 1)], ...food], combat: rng.range(38, 55), craft: 12, money: rng.int(10, 30) };
    case 'oficial':
      return { weapon: 'pistola', sidearm: 'cuchillo', armor: [], items: [['balas', rng.int(16, 32)], ['vendas', 1], ...food], combat: rng.range(30, 45), craft: 20, money: rng.int(20, 60) };
    case 'lider':
      return { weapon: 'pistola', armor: [], items: [['balas', 24], ['botiquin', 1], ['conserva', 2]], combat: rng.range(40, 60), craft: 30, money: rng.int(80, 200) };
    case 'bandido':
      return { weapon: rng.chance(0.4) ? rng.pick(rifles) : rng.pick(['machete', 'tubo', 'hacha', 'cuchillo', 'lanza']), sidearm: 'cuchillo', armor: rng.chance(0.25) ? ['petoCuero'] : [], items: [['balas', rng.int(6, 22)], ['cartuchosEscopeta', rng.int(2, 8)], ['samogon', rng.int(0, 1)], ...food], combat: rng.range(12, 30), craft: 5, money: rng.int(0, 12) };
    case 'jefe':
      return { weapon: rng.pick(['ak', 'escopeta', 'hacha']), sidearm: 'machete', armor: ['petoCuero'], items: [['balas', 50], ['cartuchosEscopeta', 12], ['vendas', 2], ['samogon', 1], ['conserva', 1]], combat: rng.range(36, 52), craft: 8, money: rng.int(30, 90) };
    case 'mercenario':
      return { weapon: rng.pick(['ak', 'escopeta', 'fusilTunel']), sidearm: 'machete', armor: ['chaleco', ...(rng.chance(0.5) ? ['casco'] : [])], items: [['balas', rng.int(40, 70)], ['cartuchosEscopeta', 8], ['vendas', 2], ...food], combat: rng.range(32, 48), craft: 10, money: rng.int(10, 40) };
    case 'stalker':
    case 'cazador':
      return { weapon: rng.pick(['escopeta', 'neumatico', 'fusilTunel']), sidearm: 'machete', armor: ['mascaraGas', 'mochila'], items: [['balas', rng.int(20, 40)], ['cartuchosEscopeta', rng.int(6, 14)], ['filtros', rng.int(1, 3)], ['vendas', 2], ...food], combat: rng.range(28, 44), craft: 22, money: rng.int(8, 30) };
    case 'caravanero':
      return { weapon: rng.chance(0.5) ? 'escopeta' : rng.pick(['tubo', 'machete']), armor: ['mochila'], items: [['cartuchosEscopeta', rng.int(4, 10)], ...food], combat: rng.range(10, 22), craft: 14, money: rng.int(15, 50) };
    case 'comerciante':
      return { weapon: rng.chance(0.25) ? 'pistola' : null, armor: [], items: [...food], combat: rng.range(4, 12), craft: 25, money: rng.int(30, 90) };
    case 'medico':
      return { weapon: null, armor: [], items: [['vendas', rng.int(3, 6)], ['botiquin', rng.int(1, 2)], ...food], combat: rng.range(3, 10), craft: 45, money: rng.int(10, 40) };
    case 'obrero':
      return { weapon: rng.chance(0.3) ? rng.pick(['llave', 'palanca', 'pala']) : null, armor: [], items: [...food], combat: rng.range(4, 14), craft: 28, money: rng.int(1, 8) };
    case 'refugiado':
      return { weapon: rng.chance(0.15) ? 'cuchillo' : null, armor: [], items: rng.chance(0.4) ? food : [], combat: rng.range(2, 8), craft: 6, money: rng.int(0, 3) };
    default:
      return { weapon: rng.chance(0.2) ? rng.pick(MELEE) : null, armor: [], items: [...food], combat: rng.range(3, 12), craft: 12, money: rng.int(1, 12) };
  }
}

/** Nombre del oficio para la ficha del personaje. */
export const ROLE_NAMES: Record<Role, string> = {
  soldado: 'Soldado',
  elite: 'Tropa de choque',
  oficial: 'Oficial',
  guardia: 'Guardia',
  civil: 'Vecino',
  obrero: 'Obrero',
  comerciante: 'Comerciante',
  medico: 'Médico',
  stalker: 'Stalker',
  bandido: 'Saqueador',
  jefe: 'Cabecilla',
  mercenario: 'Mercenario',
  caravanero: 'Caravanero',
  refugiado: 'Refugiado',
  cazador: 'Cazador de mutantes',
  lider: 'Líder',
};
