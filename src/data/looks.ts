// Aspecto de los personajes: cuerpo, cara y ropa. Son datos puros que la
// simulación guarda y el render convierte en un modelo 3D.

export type HairStyle = 'corto' | 'largo' | 'mono' | 'rapado' | 'calvo';
export type Facial = 'nada' | 'barba3' | 'bigote' | 'barba' | 'barbaLarga';
export type Hat = 'nada' | 'gorra' | 'plato' | 'ushanka' | 'boina' | 'casco' | 'panuelo' | 'kufi' | 'capucha' | 'pasamontanas';
export type Mask = 'nada' | 'antigas' | 'respirador' | 'gafas' | 'panuelo';
export type Top = 'camisa' | 'guerrera' | 'chaqueton' | 'abrigo' | 'tunica' | 'harapos' | 'mono' | 'traje' | 'cuero';

export interface Look {
  seed: number;
  /** Escala de altura (1 = 1,78 m). */
  height: number;
  /** Complexión: -1 delgado … 1 corpulento. */
  build: number;
  female: boolean;
  skin: number;
  hair: HairStyle;
  hairColor: number;
  facial: Facial;
  /** 0 joven, 1 adulto, 2 viejo. */
  age: 0 | 1 | 2;
  eyepatch?: boolean;
  scar?: boolean;
  glasses?: boolean;
  top: Top;
  topColor: number;
  pantsColor: number;
  bootsColor: number;
  gloves?: number;
  /** Chaleco o armadura sobre el torso. */
  vest?: number;
  vestPlates?: boolean;
  pouches?: boolean;
  hat: Hat;
  hatColor: number;
  mask: Mask;
  scarf?: number;
  backpack?: number;
  armband?: number;
  bandolier?: boolean;
  shoulderPads?: number;
  kneePads?: number;
  medals?: boolean;
}

export const SKIN_TONES = [0xe6c3a4, 0xd9ae8c, 0xc4946c, 0xa8774f, 0x8a5c3a];
export const HAIR_COLORS = [0x1c1612, 0x3a2a1c, 0x5c4028, 0x8a6a3c, 0x9a9a96, 0x6e2e1a];

export const DEFAULT_LOOK: Look = {
  seed: 1,
  height: 1,
  build: 0,
  female: false,
  skin: SKIN_TONES[1],
  hair: 'corto',
  hairColor: HAIR_COLORS[1],
  facial: 'nada',
  age: 1,
  top: 'chaqueton',
  topColor: 0x5a5c4a,
  pantsColor: 0x3f4038,
  bootsColor: 0x221c18,
  hat: 'nada',
  hatColor: 0x444444,
  mask: 'nada',
};
