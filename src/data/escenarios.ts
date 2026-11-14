// Comienzos posibles. No hay elegido ni destino: empiezas siendo nadie en
// algún rincón del metro, en enero de 2033.
//
// Cada comienzo cuenta solo lo que es verdad al empezar la partida: dónde
// está la escuadra (la estación y la sala o el rincón exactos), qué lleva,
// quién la quiere y quién no (reputación, precio por su cabeza y otras
// marcas) y qué puede hacer primero (sus pasos, en sim/hilos.ts). Las
// pruebas comprueban que el texto y la partida dicen lo mismo.

import type { SpotKind } from '../world/decorCore';
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
  /** Balas en el cargador al empezar (si no se dice, lleno). */
  mag?: number;
  /** Vida que le queda al filtro de su máscara (0..1; si no se dice, nuevo). */
  filter?: number;
}

/** Dónde empieza la escuadra dentro del lugar: una sala aneja (por su id) o un rincón de la decoración. */
export type StartAt = { annex: string } | { spot: SpotKind; data?: string };

export interface Scenario {
  id: string;
  name: string;
  difficulty: 'Fácil' | 'Normal' | 'Difícil' | 'Muy difícil';
  /** Estación o cruce de inicio. */
  place: string;
  /** Sala o rincón exacto del lugar de inicio. */
  at?: StartAt;
  money: number;
  /** Quiénes sois, en una línea (la tarjeta del menú). */
  tagline: string;
  intro: string[];
  members: StartMember[];
  rep?: Partial<Record<FactionId, number>>;
  /** Precio por vuestras cabezas al empezar. */
  bounty?: Partial<Record<FactionId, number>>;
  /** Marcas de la partida al empezar (p. ej. `hermano`: la Hermandad os tiene por suyos). */
  flags?: Record<string, number>;
  /** Estado inicial: hambre y heridas. */
  hungry?: boolean;
  hurt?: boolean;
  /** Primeros pasos de este comienzo, en orden (ids del catálogo de sim/hilos.ts). */
  steps: string[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'nadie',
    name: 'Nadie',
    difficulty: 'Normal',
    place: 'TSE',
    at: { spot: 'asiento', data: 'suelo' },
    money: 60,
    tagline: 'Tres refugiados que duermen en el suelo del andén de Tsentral’naya, sin amo ni oficio.',
    intro: [
      'Llegasteis a Tsentral’naya hace tres días con un grupo de refugiados de una estación que ya no existe. Los guardias de la Unión os dejaron pasar porque no traíais nada que valiera la pena quitaros. Los demás del grupo ya han encontrado amo, taller o tumba; vosotros seguís durmiendo en el suelo del andén.',
      'Sois tres. Entre todos, un cuchillo, un tubo de plomo, diez puñados de hongos secos, dos vendas, un poco de té y sesenta cartuchos: comida para unos días o el principio de algo. En el Gran Mercado se vende todo lo que existe, la chatarra de los túneles se paga en cualquier puesto y en las cantinas se alquila gente.',
    ],
    members: [
      { role: 'refugiado', from: 'LIB', weapon: 'cuchillo', items: [['hongosSecos', 4], ['vendas', 2]] },
      { role: 'refugiado', from: 'LIB', weapon: 'tubo', items: [['hongosSecos', 3]] },
      { role: 'civil', from: 'LIB', weapon: null, items: [['hongosSecos', 3], ['te', 2]] },
    ],
    steps: ['hablar', 'chatarra', 'comercio', 'recluta', 'construir', 'estudio'],
  },
  {
    id: 'cartero',
    name: 'La saca de correo',
    difficulty: 'Fácil',
    place: 'STA',
    at: { annex: 'caravasar' },
    money: 180,
    tagline: 'El cartero que llevó la carta de Bessmertny sin saberlo, y el mercenario que le guarda las espaldas.',
    intro: [
      'Eres el cartero de la línea de Kholodnogo Vozduha a Tsentral’naya. Hace cinco días, en el Túnel del Comercio, una banda de la Hermandad os salió al paso y se llevó la mitad de la saca. Lo que salvaste lo entregaste en Correos del metro, en Tsentral’naya, y volviste a Staraya con el mercenario que te guarda las espaldas y ciento ochenta cartuchos de paga.',
      'Esta noche, en el caravasar de Staraya, los arrieros de los Seguidores no hablan de otra cosa: Bessmertny escribió a Volkov y la carta, lacrada con el tridente verde, nunca llegó. Tú la llevabas. Iba en lo que salvaste, y la dejaste en Correos con las demás. Alguien en Tsentral’naya la ha escondido. ¿Quién, y por qué?',
      'En Staraya te conocen de sobra: aquí no pagas peaje. La Hermandad, en cambio, sabe muy bien quién lleva el correo.',
    ],
    members: [
      { role: 'caravanero', from: 'STA', weapon: 'escopeta', armor: ['mochila'], items: [['cartuchosEscopeta', 14], ['guiso', 3], ['vendas', 3], ['tela', 6], ['samogon', 2]], skill: 1.3 },
      { role: 'mercenario', from: 'STA', weapon: 'machete', armor: ['chaleco'], items: [['hongosSecos', 4], ['vendas', 2]], skill: 0.9 },
    ],
    rep: { STA: 15, SDR: 10, UNI: 5, VHL: -25 },
    steps: ['tse', 'carta', 'cartaDecidida', 'comercio', 'recluta', 'construir'],
  },
  {
    id: 'colonos',
    name: 'Colonos de Tenevskaya',
    difficulty: 'Difícil',
    place: 'E4',
    money: 120,
    tagline: 'Cinco colonos con material para levantar un campamento a las puertas de la estación fantasma.',
    intro: [
      'Nadie sabe qué pasó en Tenevskaya. Quienes se acercan hablan de voces en la oscuridad. Pero sus almacenes de la defensa civil siguen intactos tras puertas blindadas, y una estación vacía es una estación sin amo.',
      'Sois cinco, salidos de Tsentral’naya con todo lo que teníais: tablones, chatarra, piezas, lona, agua y hongos para unos días. Acabáis de llegar al Cruce Oriental, en el Túnel del Comercio: por aquí pasan las caravanas entre Tsentral’naya y Staraya, y también las bandas de la Hermandad, que cobran peaje a quien encuentran.',
      'Al sur, un túnel auxiliar baja al Nudo de Tenevskaya, donde anidan los skrebuns, y sigue hasta la estación fantasma. Levantad el campamento antes de adentraros.',
    ],
    members: [
      { role: 'obrero', from: 'LIB', weapon: 'palanca', armor: ['mochila'], items: [['tablones', 14], ['chatarra', 16], ['martillo', 1], ['hongosSecos', 5]], skill: 1.2 },
      { role: 'obrero', from: 'LIB', weapon: 'pala', armor: ['mochila'], items: [['tablones', 12], ['chatarra', 14], ['piezas', 8], ['hongosSecos', 5]] },
      { role: 'guardia', from: 'LIB', weapon: 'fusilTunel', items: [['balas', 40], ['vendas', 3], ['hongosSecos', 4]], skill: 1.1 },
      { role: 'civil', from: 'LIB', weapon: 'cuchillo', armor: ['mochila'], items: [['tela', 16], ['agua', 8], ['hongos', 10], ['linterna', 1]] },
      { role: 'medico', from: 'LIB', weapon: null, items: [['vendas', 6], ['botiquin', 1], ['hongosSecos', 4], ['libros', 1]] },
    ],
    rep: { UNI: 5 },
    steps: ['campamento', 'chatarra', 'comidaPropia', 'estudio', 'tenevskaya', 'almacen'],
  },
  {
    id: 'stalkers',
    name: 'Stalkers del Norte',
    difficulty: 'Normal',
    place: 'SEV',
    at: { annex: 'stalkers' },
    money: 90,
    tagline: 'Tres stalkers sin patrón que viven de lo que bajan de la superficie helada.',
    intro: [
      'Severnyy Terminal. Las escaleras mecánicas, paradas desde 2013, son la salida más segura a la superficie helada, y en la base de los stalkers se reparte el trabajo. Olga Arkhipova, que ha subido más de cien veces, decide quién sube y cuándo.',
      'Sois tres stalkers sin patrón: dos máscaras antigás y un respirador, cinco filtros de repuesto y un fusil neumático que no hace ruido. Arriba, entre los bloques nevados del Barrio del Norte, queda botín que nadie ha bajado en veinte años, y cazan los skrebuns. En el Hospital de la Esperanza, en Nadezhdy, pagan sus glándulas a buen precio; el túnel que lleva hasta allí, con el polvo que baja de la superficie, es de los peores del metro.',
    ],
    members: [
      { role: 'stalker', from: 'NOR', weapon: 'neumatico', armor: ['mascaraGas', 'mochila'], items: [['filtros', 3], ['vendas', 3], ['hongosSecos', 5], ['linterna', 1], ['componentes', 2]], skill: 1.1 },
      { role: 'stalker', from: 'NOR', weapon: 'escopeta', armor: ['respirador'], items: [['cartuchosEscopeta', 16], ['vendas', 2], ['hongosSecos', 4]] },
      { role: 'cazador', from: 'NOR', weapon: 'lanza', armor: ['mascaraGas'], items: [['filtros', 2], ['hongosSecos', 4], ['botiquin', 1]] },
    ],
    rep: { NOR: 20 },
    steps: ['hablar', 'superficie', 'botinArriba', 'skrebun', 'glandula', 'construir'],
  },
  {
    id: 'hermandad',
    name: 'Hijos de Vhlainska',
    difficulty: 'Difícil',
    place: 'VHL',
    at: { annex: 'guarida' },
    money: 40,
    tagline: 'Cuatro de la Hermandad que se largan por su cuenta, sabiendo dónde guarda el Tuerto la llave de Tenevskaya.',
    intro: [
      'Vhlainska, la guarida de la Hermandad. Lleváis años asaltando caravanas en el Túnel de los Saqueadores, y el Tuerto se queda con la mitad de cada botín y os manda siempre por delante. Esta noche se lo habéis dicho a la cara en su guarida: os vais por vuestra cuenta. Rybak se ha reído —en la Hermandad cada cual es libre de largarse—, pero lo que saquéis a partir de ahora será vuestro, y nada más.',
      'Seguís siendo hermanos: aquí nadie os toca y las bandas de Vhlainska no os cobran peaje. Fuera es otra cosa: en Staraya y entre los Seguidores os disparan nada más veros, y Staraya paga por vuestras cabezas.',
      'Y sabéis algo que el Tuerto cree que solo sabe él: en el botín de la Hermandad, junto a su guarida, guarda la llave que le quitó a un oficial de la defensa civil. Abre los almacenes blindados de Tenevskaya, al otro lado del túnel de mantenimiento. Si alguien os ve cogerla, dejaréis de ser hermanos.',
    ],
    members: [
      { role: 'bandido', from: 'VHL', weapon: 'escopeta', armor: ['petoCuero'], items: [['cartuchosEscopeta', 12], ['samogon', 2], ['hongosSecos', 3]], skill: 1.2 },
      { role: 'bandido', from: 'VHL', weapon: 'machete', items: [['hongosSecos', 3], ['vendas', 2], ['ganzuas', 1]], skill: 1.1 },
      { role: 'bandido', from: 'VHL', weapon: 'hacha', items: [['hongosSecos', 3]] },
      { role: 'bandido', from: 'VHL', weapon: 'cuchillo', items: [['hongosSecos', 3], ['ganzuas', 1], ['vendas', 2]] },
    ],
    rep: { VHL: 40, STA: -55, SDR: -55, UNI: -30 },
    bounty: { STA: 90 },
    flags: { hermano: 1 },
    steps: ['llave', 'comercio', 'tenevskaya', 'almacen', 'construir', 'recluta'],
  },
  {
    id: 'veteranos',
    name: 'Veteranos del sur',
    difficulty: 'Muy difícil',
    place: 'KHO',
    at: { annex: 'escaleraPozo' },
    money: 15,
    tagline: 'Dos desertores de la junta de Chernovodskaya que bajan del frío, hambrientos y con una treintena de balas.',
    intro: [
      'Chernovodskaya lleva dos años encerrada desde que la junta voló el túnel sur, y ya no queda qué comer. Cuando el general Voronov mandó fusilar a los que pedían reabrirlo, desertasteis: dos veteranos de la guerra de 2030 con las máscaras de la defensa civil y lo poco que pudisteis llevaros.',
      'Cuatro días cruzando la ciudad muerta por la superficie, y al fin la casa del pozo de Kholodnogo Vozduha. Acabáis de bajar por su escalera de servicio, medio congelados, con los filtros casi agotados, dos fusiles, una treintena de balas y ninguna comida.',
      'Esta es la capital de los Seguidores de Rusia: no odian a la junta, pero tampoco os deben nada. Para la Unión sois el enemigo de ayer, y la junta os busca por desertores. En la República del Norte, que la apoyó en la guerra, aún hay quien os mira con buenos ojos.',
    ],
    members: [
      { role: 'soldado', from: 'CHE', weapon: 'cerrojo', mag: 3, armor: ['casco', 'mascaraGas'], filter: 0.1, items: [['balas', 8], ['vendas', 2]], skill: 1.9 },
      { role: 'soldado', from: 'CHE', weapon: 'ak', mag: 9, armor: ['mascaraGas'], filter: 0.05, items: [['balas', 11], ['vendas', 1]], skill: 1.7 },
    ],
    rep: { CHE: -40, UNI: -40, NOR: 15 },
    hungry: true,
    hurt: true,
    steps: ['comer', 'curar', 'municion', 'comercio', 'recluta', 'construir'],
  },
  {
    id: 'esmeralda',
    name: 'El hambre de la Esmeralda',
    difficulty: 'Muy difícil',
    place: 'MER',
    at: { annex: 'banos' },
    money: 5,
    tagline: 'Tres vecinos hambrientos de la estación sitiada, con un pico y un rumor.',
    intro: [
      'Desde 2029 ni una caravana entra en Izumrudnaya. El Levantamiento la llama Mertvaya, «la Muerta», y desde sus barricadas de Vysotnaya disparan a todo lo que sale por el túnel. El embargo mata más que las balas, y no todos en la estación comparten el fanatismo del califa Baghdadi: el imán Karimov se opone en silencio, y hay quien ya no espera a que se lo permitan.',
      'Sois tres vecinos con el estómago vacío, cinco cartuchos, agua del manantial y un pico. Los viejos hablan de una galería soviética que salía de Izumrudnaya hacia Mostovaya, tapiada por los dos extremos antes de las bombas; dentro, el aire lleva veinte años sin moverse. Si se abriera, la comida volvería a entrar, y vosotros podríais salir.',
    ],
    members: [
      { role: 'civil', from: 'CAL', weapon: 'cuchillo', items: [['agua', 4]] },
      { role: 'civil', from: 'CAL', weapon: 'tubo', items: [['agua', 3]] },
      { role: 'obrero', from: 'CAL', weapon: 'pico', items: [['agua', 3], ['vendas', 1]] },
    ],
    rep: { CAL: 15, LEV: -55 },
    hungry: true,
    steps: ['comer', 'muro', 'tabique', 'galeria', 'contrabando', 'construir'],
  },
];

export const SCENARIO_BY_ID: Record<string, Scenario> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
