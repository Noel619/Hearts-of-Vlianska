// Comienzos posibles. No hay elegido ni destino: empiezas siendo nadie en
// algún rincón del metro, en enero de 2033.

import type { Role } from './gente';
import type { FactionId } from './tipos';

export interface StartMember {
  role: Role;
  /** Bando del que procede su ropa. */
  from: FactionId | 'LIB';
  weapon?: string | null;
  armor?: string[];
  items?: [string, number][];
  /** Multiplicador de pericia. */
  skill?: number;
}

export interface Scenario {
  id: string;
  name: string;
  difficulty: 'Fácil' | 'Normal' | 'Difícil' | 'Muy difícil';
  /** Estación o cruce de inicio. */
  place: string;
  money: number;
  intro: string[];
  members: StartMember[];
  rep?: Partial<Record<FactionId, number>>;
  /** Estado inicial: hambre y heridas. */
  hungry?: boolean;
  hurt?: boolean;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'nadie',
    name: 'Nadie',
    difficulty: 'Normal',
    place: 'TSE',
    money: 60,
    intro: [
      'Llegasteis a Tsentral\'naya hace tres días con otro grupo de refugiados. Los demás ya han encontrado amo, taller o tumba.',
      'Tres bocas, un cuchillo y sesenta cartuchos. En el Gran Mercado Central se vende todo lo que existe; lo difícil es poder pagarlo.',
    ],
    members: [
      { role: 'refugiado', from: 'LIB', weapon: 'cuchillo', items: [['hongosSecos', 4], ['vendas', 2]] },
      { role: 'refugiado', from: 'LIB', weapon: 'tubo', items: [['hongosSecos', 3]] },
      { role: 'civil', from: 'LIB', weapon: null, items: [['hongosSecos', 3], ['te', 2]] },
    ],
  },
  {
    id: 'cartero',
    name: 'La saca de correo',
    difficulty: 'Fácil',
    place: 'STA',
    money: 180,
    intro: [
      'Llevabas el correo entre Kholodnogo Vozduha y Tsentral\'naya hasta que los saqueadores de Vhlainska os asaltaron en el Túnel del Comercio. Entregaste lo que quedó de la saca.',
      'Ahora, en los bares de Staraya, oyes hablar de una carta con el tridente verde que nunca llegó a su destino. Tú la llevabas. La dejaste en la oficina de correos de Tsentral\'naya. ¿Quién la escondió, y por qué?',
    ],
    members: [
      { role: 'caravanero', from: 'STA', weapon: 'escopeta', armor: ['mochila'], items: [['cartuchosEscopeta', 14], ['guiso', 3], ['vendas', 3], ['tela', 6], ['samogon', 2]], skill: 1.3 },
      { role: 'mercenario', from: 'STA', weapon: 'machete', armor: ['chaleco'], items: [['hongosSecos', 4], ['vendas', 2]], skill: 0.9 },
    ],
    rep: { STA: 15, VHL: -25 },
  },
  {
    id: 'colonos',
    name: 'Colonos de Tenevskaya',
    difficulty: 'Difícil',
    place: 'E4',
    money: 120,
    intro: [
      'Nadie sabe qué pasó en Tenevskaya. Quienes se acercan hablan de voces en la oscuridad. Pero sus almacenes de la defensa civil siguen intactos, y una estación vacía es una estación sin amo.',
      'Sois cinco, con tablones, chatarra y lona para empezar. El Cruce Oriental queda a un túnel auxiliar de la estación fantasma. Levantad un campamento antes de adentraros.',
    ],
    members: [
      { role: 'obrero', from: 'LIB', weapon: 'palanca', armor: ['mochila'], items: [['tablones', 14], ['chatarra', 16], ['martillo', 1], ['hongosSecos', 5]], skill: 1.2 },
      { role: 'obrero', from: 'LIB', weapon: 'pala', armor: ['mochila'], items: [['tablones', 12], ['chatarra', 14], ['piezas', 8], ['hongosSecos', 5]] },
      { role: 'guardia', from: 'LIB', weapon: 'fusilTunel', items: [['balas', 40], ['vendas', 3], ['hongosSecos', 4]], skill: 1.1 },
      { role: 'civil', from: 'LIB', weapon: 'cuchillo', armor: ['mochila'], items: [['tela', 16], ['agua', 8], ['hongos', 10], ['linterna', 1]] },
      { role: 'medico', from: 'LIB', weapon: null, items: [['vendas', 6], ['botiquin', 1], ['hongosSecos', 4], ['libros', 1]] },
    ],
  },
  {
    id: 'stalkers',
    name: 'Stalkers del Norte',
    difficulty: 'Normal',
    place: 'SEV',
    money: 90,
    intro: [
      'Las escaleras mecánicas de Severnyy Terminal, hoy detenidas, son la salida más segura hacia la superficie helada. Tres stalkers sin patrón viven de lo que rescatan arriba.',
      'El túnel hacia Ubezhishche Nadezhdy es de los más peligrosos del metro. Los médicos del Hospital de la Esperanza pagan bien por las glándulas de skrebun.',
    ],
    members: [
      { role: 'stalker', from: 'NOR', weapon: 'neumatico', armor: ['mascaraGas', 'mochila'], items: [['filtros', 3], ['vendas', 3], ['hongosSecos', 5], ['linterna', 1], ['componentes', 2]], skill: 1.1 },
      { role: 'stalker', from: 'NOR', weapon: 'escopeta', armor: ['respirador'], items: [['cartuchosEscopeta', 16], ['vendas', 2], ['hongosSecos', 4]] },
      { role: 'cazador', from: 'NOR', weapon: 'lanza', armor: ['mascaraGas'], items: [['filtros', 2], ['hongosSecos', 4], ['botiquin', 1]] },
    ],
    rep: { NOR: 20 },
  },
  {
    id: 'hermandad',
    name: 'Hijos de Vhlainska',
    difficulty: 'Difícil',
    place: 'VHL',
    money: 40,
    intro: [
      'Vhlainska era una estación obrera que todos abandonaron durante los años del caos. Sus habitantes aprendieron a sobrevivir de la única manera posible.',
      'Cuatro de la Hermandad, hartos de repartir el botín con el Tuerto. Medio metro os quiere ver colgados; el otro medio aún no os conoce.',
    ],
    members: [
      { role: 'bandido', from: 'VHL', weapon: 'escopeta', armor: ['petoCuero'], items: [['cartuchosEscopeta', 12], ['samogon', 2], ['hongosSecos', 3]], skill: 1.2 },
      { role: 'bandido', from: 'VHL', weapon: 'machete', items: [['hongosSecos', 3], ['vendas', 2], ['ganzuas', 1]], skill: 1.1 },
      { role: 'bandido', from: 'VHL', weapon: 'hacha', items: [['hongosSecos', 3]] },
      { role: 'bandido', from: 'VHL', weapon: 'cuchillo', items: [['hongosSecos', 3], ['ganzuas', 1], ['vendas', 2]] },
    ],
    rep: { VHL: 35, STA: -55, SDR: -55, UNI: -30 },
  },
  {
    id: 'veteranos',
    name: 'Veteranos del sur',
    difficulty: 'Muy difícil',
    place: 'MOS',
    money: 15,
    intro: [
      'La junta voló el túnel en 2031 para no rendirse. Dos años después, dos veteranos de Chernovodskaya cruzan la ciudad muerta por la superficie y bajan a Mostovaya medio congelados.',
      'Para la Unión sois el enemigo de ayer. Tenéis dos fusiles, poca munición y ninguna comida.',
    ],
    members: [
      { role: 'soldado', from: 'CHE', weapon: 'cerrojo', armor: ['casco'], items: [['balas', 14], ['vendas', 2]], skill: 1.9 },
      { role: 'soldado', from: 'CHE', weapon: 'ak', items: [['balas', 22], ['vendas', 1]], skill: 1.7 },
    ],
    rep: { CHE: -30, UNI: -30 },
    hungry: true,
    hurt: true,
  },
  {
    id: 'esmeralda',
    name: 'El hambre de la Esmeralda',
    difficulty: 'Muy difícil',
    place: 'MER',
    money: 5,
    intro: [
      'Desde 2029 ni una caravana entra en Mertvaya. El embargo mata más que las balas, y no todos en la estación comparten el fanatismo de su califa.',
      'Tres vecinos de Izumrudnaya con el estómago vacío. Al otro lado del túnel esperan las barricadas del Levantamiento. Dicen que hay una galería tapiada en tiempos soviéticos que lleva a Mostovaya…',
    ],
    members: [
      { role: 'civil', from: 'CAL', weapon: 'cuchillo', items: [['agua', 4]] },
      { role: 'civil', from: 'CAL', weapon: 'tubo', items: [['agua', 3]] },
      { role: 'obrero', from: 'CAL', weapon: 'pico', items: [['agua', 3], ['vendas', 1]] },
    ],
    rep: { CAL: 15, LEV: -25 },
    hungry: true,
  },
];

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
