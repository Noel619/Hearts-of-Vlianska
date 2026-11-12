// Las criaturas de los túneles. «Seres que dejaron de ser animales para
// convertirse en monstruos.» Los nombres son del habla del metro.

export interface CreatureDef {
  id: string;
  name: string;
  desc: string;
  /** Forma del modelo. */
  shape: 'cuadrupedo' | 'bipedo';
  scale: number;
  /** Multiplicador de salud de las partes del cuerpo. */
  hp: number;
  speed: number;
  cut: number;
  blunt: number;
  reach: number;
  attackTime: number;
  /** Nivel de combate (ataque y defensa). */
  level: number;
  sight: number;
  pack: [number, number];
  /** Huye de la luz fuerte. */
  lightFear: boolean;
  /** Salud relativa a la que huye (0 = nunca). */
  flee: number;
  hostile: boolean;
  drops: [string, number, number][];
  color: number;
  color2: number;
  eyes: number;
}

export const CREATURES: Record<string, CreatureDef> = {
  rata: {
    id: 'rata',
    name: 'Rata de túnel',
    desc: 'Algunas son del tamaño de un perro. Atacan en manada y huyen de la luz.',
    shape: 'cuadrupedo',
    scale: 0.55,
    hp: 0.3,
    speed: 5.2,
    cut: 9,
    blunt: 0,
    reach: 1.1,
    attackTime: 0.8,
    level: 8,
    sight: 16,
    pack: [3, 7],
    lightFear: true,
    flee: 0.5,
    hostile: true,
    drops: [['carne', 1, 1], ['colmillo', 0, 1]],
    color: 0x3a3028,
    color2: 0x8a6a5a,
    eyes: 0xff4020,
  },
  skrebun: {
    id: 'skrebun',
    name: 'Skrebun',
    desc: '«El que araña». Pálido, sin pelo y con garras como hoces. Caza en los túneles oscuros.',
    shape: 'cuadrupedo',
    scale: 1.0,
    hp: 0.9,
    speed: 6.2,
    cut: 24,
    blunt: 4,
    reach: 1.6,
    attackTime: 1.0,
    level: 26,
    sight: 24,
    pack: [2, 4],
    lightFear: false,
    flee: 0.25,
    hostile: true,
    drops: [['carne', 2, 4], ['cuero', 1, 2], ['glandula', 0, 1], ['colmillo', 1, 3]],
    color: 0xa39a8c,
    color2: 0x5a4a44,
    eyes: 0xd8ff40,
  },
  glubinnik: {
    id: 'glubinnik',
    name: 'Glubinnik',
    desc: '«El de lo profundo». Una mole que vive en los tramos inundados bajo el río. Lento, pero un golpe suyo rompe huesos.',
    shape: 'bipedo',
    scale: 1.45,
    hp: 2.6,
    speed: 3.6,
    cut: 10,
    blunt: 46,
    reach: 2.2,
    attackTime: 1.6,
    level: 42,
    sight: 18,
    pack: [1, 1],
    lightFear: false,
    flee: 0,
    hostile: true,
    drops: [['carne', 6, 10], ['cuero', 3, 5], ['glandula', 1, 2], ['colmillo', 2, 4]],
    color: 0x3a4a48,
    color2: 0x1e2a2c,
    eyes: 0x60d0ff,
  },
  sheptun: {
    id: 'sheptun',
    name: 'Sheptun',
    desc: '«El que susurra». Dicen que en Tenevskaya algo llama a cada soldado por su nombre.',
    shape: 'bipedo',
    scale: 1.25,
    hp: 1.6,
    speed: 5.0,
    cut: 32,
    blunt: 8,
    reach: 2.0,
    attackTime: 1.1,
    level: 55,
    sight: 30,
    pack: [1, 1],
    lightFear: true,
    flee: 0,
    hostile: true,
    drops: [['glandula', 2, 3], ['cuero', 1, 2]],
    color: 0x16161a,
    color2: 0x2a2630,
    eyes: 0xffffff,
  },
  cerdo: {
    id: 'cerdo',
    name: 'Cerdo del metro',
    desc: 'Come de todo y se reproduce rápido.',
    shape: 'cuadrupedo',
    scale: 0.8,
    hp: 0.6,
    speed: 3.2,
    cut: 0,
    blunt: 6,
    reach: 1.0,
    attackTime: 1.2,
    level: 3,
    sight: 8,
    pack: [1, 3],
    lightFear: false,
    flee: 0.9,
    hostile: false,
    drops: [['carne', 4, 6], ['cuero', 1, 2]],
    color: 0xb8908a,
    color2: 0x7a5a54,
    eyes: 0x101010,
  },
};
