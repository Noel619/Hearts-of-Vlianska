// Mapa del metro de Vlianska (plano original del autor, 1920 x 1080).
// Estaciones, cruces, túneles y el río Vlia. Los textos son los de la historia.

import type { FactionId, Terrain } from '../tipos';

export const MAP_WIDTH = 1920;
export const MAP_HEIGHT = 1080;

export interface StationDef {
  id: string;
  name: string;
  shortName: string;
  /** Posición en el plano original. */
  x: number;
  y: number;
  desc: string;
  population: number;
  owner: FactionId | null;
  claims?: FactionId[];
  /** Tiene salida a la superficie. */
  surface?: boolean;
  feature?: { name: string; desc: string };
}

export const STATIONS: StationDef[] = [
  {
    id: "SEV",
    name: "Severnyy Terminal",
    shortName: "Severnyy",
    x: 483,
    y: 53,
    desc: "La terminal norte del metro. Sus escaleras mecánicas, hoy detenidas, son la salida más segura hacia la superficie helada.",
    population: 450,
    owner: "NOR",
    claims: ["UNI"],
    surface: true,
    feature: { name: "Terminal de superficie", desc: "Acceso directo a la superficie: las expediciones salen de aquí." },
  },
  {
    id: "UBE",
    name: "Ubezhishche Nadezhdy",
    shortName: "Nadezhdy",
    x: 626,
    y: 275,
    desc: "El \"Refugio de la Esperanza\". Su antiguo hospital de campaña es el mejor del metro y la sede del gobierno de la República del Norte.",
    population: 500,
    owner: "NOR",
    claims: ["UNI"],
    feature: { name: "Hospital de la Esperanza", desc: "Médicos de verdad, medicinas de antes de la guerra y camas limpias." },
  },
  {
    id: "IND",
    name: "Industrialnaya",
    shortName: "Industrialnaya",
    x: 798,
    y: 110,
    desc: "La Fábrica del Metro. Munición, equipo pesado y armamento improvisado salen de sus talleres día y noche.",
    population: 700,
    owner: "SDR",
    feature: { name: "La Fábrica del Metro", desc: "Los talleres más grandes de Vlianska." },
  },
  {
    id: "RUB",
    name: "Rubezh",
    shortName: "Rubezh",
    x: 1007,
    y: 93,
    desc: "\"La frontera\". Una estación-fortaleza que guarda el paso entre Industrialnaya y el resto del metro.",
    population: 400,
    owner: "SDR",
    feature: { name: "Frontera fortificada", desc: "Muros de hormigón, troneras y alambre de espino." },
  },
  {
    id: "KHO",
    name: "Stantsiya Kholodnogo Vozduha",
    shortName: "Kholodnogo Vozduha",
    x: 1389,
    y: 97,
    desc: "La \"Estación del Aire Frío\". Sus enormes pozos de ventilación bajan el aire helado de la superficie. Capital de los Seguidores de Rusia.",
    population: 600,
    owner: "SDR",
    surface: true,
    feature: { name: "Pozos de aire frío", desc: "Los pozos de ventilación comunican con la superficie." },
  },
  {
    id: "STA",
    name: "Stantsiya Staraya",
    shortName: "Staraya",
    x: 1165,
    y: 297,
    desc: "La estación más antigua de Vlianska y su mayor cruce: cinco túneles convergen en sus andenes. Quien controla Staraya cobra peaje a medio metro.",
    population: 750,
    owner: "STA",
    claims: ["SDR"],
    feature: { name: "La Encrucijada", desc: "Todas las caravanas del este pasan por aquí, y todas pagan." },
  },
  {
    id: "TSE",
    name: "Tsentral'naya Stantsiya",
    shortName: "Tsentral'naya",
    x: 908,
    y: 453,
    desc: "La estación central, la más poblada y rica del metro. Aquí ardió el edificio del gobierno ruso; hoy es la capital de la Unión de Estaciones.",
    population: 1100,
    owner: "UNI",
    feature: { name: "Gran Mercado Central", desc: "El mayor mercado del metro: si algo existe, se vende en Tsentral'naya." },
  },
  {
    id: "TEN",
    name: "Tenevskaya",
    shortName: "Tenevskaya",
    x: 1106,
    y: 495,
    desc: "Estación abandonada. Nadie sabe qué pasó en Tenevskaya; quienes se acercan hablan de voces en la oscuridad. Sus almacenes siguen intactos.",
    population: 0,
    owner: null,
    feature: { name: "Almacenes de la defensa civil", desc: "Cajas de material soviético que nadie ha tocado en veinte años." },
  },
  {
    id: "VHL",
    name: "Vhlainska",
    shortName: "Vhlainska",
    x: 1325,
    y: 510,
    desc: "Una estación obrera que todos abandonaron durante los años del caos. Sus habitantes sobrevivieron asaltando las caravanas del este.",
    population: 350,
    owner: "VHL",
    claims: ["SDR"],
    feature: { name: "Guarida de los saqueadores", desc: "Botín amontonado, trampas en cada túnel y ojos en la oscuridad." },
  },
  {
    id: "RAS",
    name: "Rassvetnaya",
    shortName: "Rassvetnaya",
    x: 240,
    y: 470,
    desc: "\"La del Amanecer\". Primera estación conquistada por el Levantamiento Popular (2024). Sus granjas de hongos alimentan a toda la Variante Perimetral.",
    population: 400,
    owner: "LEV",
    feature: { name: "Granjas del Amanecer", desc: "Hileras interminables de hongos bajo lámparas de sodio." },
  },
  {
    id: "STL",
    name: "Stalingradskaya Maly",
    shortName: "Stalingradskaya",
    x: 572,
    y: 552,
    desc: "Cuna del Levantamiento Popular. Se organizó por votación cuando cayó el gobierno ruso y hoy es sede del Consejo Revolucionario.",
    population: 800,
    owner: "LEV",
    feature: { name: "Consejo Revolucionario", desc: "Asambleas abiertas y disciplina de hierro." },
  },
  {
    id: "VYS",
    name: "Vysotnaya",
    shortName: "Vysotnaya",
    x: 657,
    y: 793,
    desc: "Conquistada por el Levantamiento a finales de 2028. Desde sus barricadas se vigila el túnel de Mertvaya.",
    population: 450,
    owner: "LEV",
  },
  {
    id: "MER",
    name: "Mertvaya (Izumrudnaya)",
    shortName: "Mertvaya",
    x: 905,
    y: 925,
    desc: "Izumrudnaya, la \"Esmeralda\", para sus habitantes; Mertvaya, \"la Muerta\", para los soldados del frente. Aislada por el embargo desde 2029.",
    population: 300,
    owner: "CAL",
    claims: ["LEV"],
    feature: { name: "Manantial esmeralda", desc: "Una fuente de agua limpia que brota entre los azulejos verdes." },
  },
  {
    id: "ZVE",
    name: "Zvezdnaya",
    shortName: "Zvezdnaya",
    x: 1000,
    y: 682,
    desc: "Aquí se celebró en 2021 la Conferencia de Zvezdnaya, origen de la Unión de Estaciones. Hoy sus elecciones las decide Tsentral'naya.",
    population: 550,
    owner: "UNI",
    feature: { name: "Sala de la Conferencia", desc: "Donde nació la Unión." },
  },
  {
    id: "MOS",
    name: "Mostovaya",
    shortName: "Mostovaya",
    x: 1196,
    y: 800,
    desc: "La estación del puente. Al sur, el túnel hacia Chernovodskaya termina en un muro de escombros desde 2031.",
    population: 450,
    owner: "UNI",
  },
  {
    id: "CHE",
    name: "Chernovodskaya",
    shortName: "Chernovodskaya",
    x: 1413,
    y: 825,
    desc: "Gobernada por una junta militar. Voló su único túnel en 2031 para no caer ante la Unión y quedó sola, arruinada y encerrada.",
    population: 420,
    owner: "CHE",
    claims: ["UNI"],
    feature: { name: "Arsenal de la Junta", desc: "El viejo arsenal de la defensa civil, todavía en manos militares." },
  },
];

export const STATION_BY_ID: Record<string, StationDef> = Object.fromEntries(STATIONS.map((s) => [s.id, s]));

/** Rótulos en cirílico de los andenes. */
export const STATION_CYRILLIC: Record<string, string> = {
  SEV: 'СЕВЕРНЫЙ ТЕРМИНАЛ',
  UBE: 'УБЕЖИЩЕ НАДЕЖДЫ',
  IND: 'ИНДУСТРИАЛЬНАЯ',
  RUB: 'РУБЕЖ',
  KHO: 'ХОЛОДНОГО ВОЗДУХА',
  STA: 'СТАРАЯ',
  TSE: 'ЦЕНТРАЛЬНАЯ',
  TEN: 'ТЕНЕВСКАЯ',
  VHL: 'ВЛАИНСКА',
  RAS: 'РАССВЕТНАЯ',
  STL: 'СТАЛИНГРАДСКАЯ-МАЛАЯ',
  VYS: 'ВЫСОТНАЯ',
  MER: 'ИЗУМРУДНАЯ',
  ZVE: 'ЗВЁЗДНАЯ',
  MOS: 'МОСТОВАЯ',
  CHE: 'ЧЕРНОВОДСКАЯ',
};

// ---------------------------------------------------------------------------
// Cruces (nudos entre túneles) y puntos especiales
// ---------------------------------------------------------------------------

export interface NodeDef {
  id: string;
  name: string;
  x: number;
  y: number;
  terrain: Terrain;
}

export const NODES: NodeDef[] = [
  // Red auxiliar oeste
  { id: 'W1', name: 'Cruce de Rassvetnaya', x: 365, y: 490, terrain: 'linea' },
  { id: 'W2', name: 'Galería del Refugio', x: 596, y: 405, terrain: 'peligroso' },
  { id: 'W3', name: 'Cruce del Río', x: 588, y: 482, terrain: 'peligroso' },
  { id: 'W4', name: 'Nudo Auxiliar Oeste', x: 682, y: 408, terrain: 'auxiliar' },
  { id: 'W5', name: 'Galería de las Tuberías', x: 698, y: 455, terrain: 'auxiliar' },
  { id: 'W6', name: 'Cruce de Stalingradskaya', x: 712, y: 508, terrain: 'tunel' },
  { id: 'W7', name: 'Cruce de Nadezhdy', x: 800, y: 390, terrain: 'tunel' },
  { id: 'W8', name: 'Cruce Central Oeste', x: 785, y: 490, terrain: 'tunel' },
  { id: 'W9', name: 'Nudo del Depósito', x: 820, y: 575, terrain: 'auxiliar' },
  { id: 'W10', name: 'Galería Sur de Stalingradskaya', x: 625, y: 640, terrain: 'auxiliar' },
  { id: 'W11', name: 'Cruce Azul', x: 944, y: 543, terrain: 'linea' },
  // Red auxiliar este
  { id: 'E1', name: 'Cruce de Rubezh', x: 1088, y: 198, terrain: 'tunel' },
  { id: 'E2', name: 'Galería de la Frontera', x: 1006, y: 268, terrain: 'auxiliar' },
  { id: 'E3', name: 'Cruce de Staraya', x: 1060, y: 361, terrain: 'tunel' },
  { id: 'E4', name: 'Cruce Oriental', x: 1000, y: 397, terrain: 'tunel' },
  { id: 'E5', name: 'Nudo de Tenevskaya', x: 1016, y: 470, terrain: 'auxiliarPeligroso' },
  { id: 'E6', name: 'Cruce de Zvezdnaya', x: 975, y: 620, terrain: 'linea' },
  // Tenevskaya - Vhlainska
  { id: 'H1', name: 'Andén Roto', x: 1160, y: 498, terrain: 'peligroso' },
  { id: 'X1', name: 'Derrumbe de Tenevskaya', x: 1212, y: 502, terrain: 'derrumbe' },
  { id: 'H2', name: 'Túnel Oeste de Vhlainska', x: 1266, y: 507, terrain: 'tunel' },
  { id: 'H3', name: 'Paso de Mantenimiento', x: 1210, y: 530, terrain: 'estrecho' },
  // Mostovaya - Chernovodskaya
  { id: 'S1', name: 'Túnel Sur (lado de Mostovaya)', x: 1252, y: 806, terrain: 'tunel' },
  { id: 'X2', name: 'El Derrumbe del Sur', x: 1308, y: 812, terrain: 'derrumbe' },
  { id: 'S2', name: 'Túnel Sur (lado de Chernovodskaya)', x: 1362, y: 818, terrain: 'tunel' },
];

export const NODE_BY_ID: Record<string, NodeDef> = Object.fromEntries(NODES.map((n) => [n.id, n]));

// ---------------------------------------------------------------------------
// Túneles
// ---------------------------------------------------------------------------

export interface LinkDef {
  a: string;
  b: string;
  terrain: Terrain;
  /** Nombre del túnel al que pertenece el tramo. */
  tunnel: string;
  line?: 'verde' | 'roja' | 'azul';
  /** Tramos intermedios del plano original (se conserva como dato). */
  segs?: number;
  /** Puntos de paso en coordenadas del plano. */
  via?: [number, number][];
  /** Túnel tapiado: solo existe cuando alguien lo abre. */
  latent?: boolean;
}

export const LINKS: LinkDef[] = [
  // Línea Verde (Seguidores de Rusia)
  { a: 'IND', b: 'RUB', terrain: 'linea', line: 'verde', segs: 1, tunnel: 'Línea Verde' },
  { a: 'RUB', b: 'KHO', terrain: 'linea', line: 'verde', segs: 2, tunnel: 'Línea Verde' },
  // Línea Roja (Levantamiento Popular)
  { a: 'RAS', b: 'W1', terrain: 'linea', line: 'roja', tunnel: 'Línea Roja' },
  { a: 'W1', b: 'STL', terrain: 'linea', line: 'roja', segs: 1, tunnel: 'Línea Roja' },
  { a: 'STL', b: 'VYS', terrain: 'linea', line: 'roja', segs: 1, tunnel: 'Línea Roja' },
  // Línea Azul (Unión de Estaciones)
  { a: 'TSE', b: 'W11', terrain: 'linea', line: 'azul', tunnel: 'Línea Azul' },
  { a: 'W11', b: 'E6', terrain: 'linea', line: 'azul', tunnel: 'Línea Azul' },
  { a: 'E6', b: 'ZVE', terrain: 'linea', line: 'azul', tunnel: 'Línea Azul' },
  { a: 'ZVE', b: 'MOS', terrain: 'linea', line: 'azul', segs: 1, tunnel: 'Línea Azul' },
  // Túnel Sur, volado en 2031
  { a: 'MOS', b: 'S1', terrain: 'tunel', tunnel: 'Túnel Sur' },
  { a: 'S1', b: 'X2', terrain: 'derrumbe', tunnel: 'Túnel Sur' },
  { a: 'X2', b: 'S2', terrain: 'derrumbe', tunnel: 'Túnel Sur' },
  { a: 'S2', b: 'CHE', terrain: 'tunel', tunnel: 'Túnel Sur' },
  // Túneles principales
  { a: 'SEV', b: 'UBE', terrain: 'peligroso', segs: 1, tunnel: 'Túnel del Terminal' },
  { a: 'UBE', b: 'W2', terrain: 'peligroso', tunnel: 'Túnel del Refugio' },
  { a: 'W2', b: 'W3', terrain: 'peligroso', tunnel: 'Túnel del Refugio' },
  { a: 'W3', b: 'STL', terrain: 'peligroso', tunnel: 'Túnel del Refugio' },
  { a: 'UBE', b: 'W7', terrain: 'tunel', segs: 1, tunnel: 'Túnel de Nadezhdy' },
  { a: 'W7', b: 'TSE', terrain: 'tunel', tunnel: 'Túnel de Nadezhdy' },
  { a: 'STL', b: 'W6', terrain: 'tunel', tunnel: 'Túnel del Oeste' },
  { a: 'W6', b: 'W8', terrain: 'tunel', tunnel: 'Túnel del Oeste' },
  { a: 'W8', b: 'TSE', terrain: 'tunel', tunnel: 'Túnel del Oeste' },
  { a: 'RUB', b: 'E1', terrain: 'tunel', tunnel: 'Túnel de Rubezh' },
  { a: 'E1', b: 'STA', terrain: 'tunel', tunnel: 'Túnel de Rubezh' },
  { a: 'KHO', b: 'STA', terrain: 'tunel', segs: 1, tunnel: 'Túnel del Aire Frío' },
  { a: 'STA', b: 'E3', terrain: 'tunel', tunnel: 'Túnel del Comercio' },
  { a: 'E3', b: 'E4', terrain: 'tunel', tunnel: 'Túnel del Comercio' },
  { a: 'E4', b: 'TSE', terrain: 'tunel', tunnel: 'Túnel del Comercio' },
  { a: 'KHO', b: 'VHL', terrain: 'peligroso', segs: 2, tunnel: 'Túnel de la Escarcha' },
  { a: 'STA', b: 'VHL', terrain: 'peligroso', segs: 1, tunnel: 'Túnel de los Saqueadores' },
  { a: 'TEN', b: 'H1', terrain: 'peligroso', tunnel: 'Túnel de Tenevskaya' },
  { a: 'H1', b: 'X1', terrain: 'derrumbe', tunnel: 'Túnel de Tenevskaya' },
  { a: 'X1', b: 'H2', terrain: 'derrumbe', tunnel: 'Túnel de Tenevskaya' },
  { a: 'H2', b: 'VHL', terrain: 'tunel', tunnel: 'Túnel de Tenevskaya' },
  { a: 'VYS', b: 'MER', terrain: 'peligroso', segs: 1, tunnel: 'Túnel de Mertvaya' },
  // Túneles auxiliares (red oeste)
  { a: 'W1', b: 'W2', terrain: 'auxiliar', segs: 1, via: [[435, 435]], tunnel: 'Galería de Rassvetnaya' },
  { a: 'W2', b: 'W4', terrain: 'auxiliar', via: [[640, 392]], tunnel: 'Túneles auxiliares del oeste' },
  { a: 'W3', b: 'W5', terrain: 'auxiliar', tunnel: 'Túneles auxiliares del oeste' },
  { a: 'W4', b: 'W5', terrain: 'auxiliar', tunnel: 'Túneles auxiliares del oeste' },
  { a: 'W5', b: 'W6', terrain: 'auxiliar', tunnel: 'Túneles auxiliares del oeste' },
  { a: 'W4', b: 'W7', terrain: 'auxiliar', tunnel: 'Túneles auxiliares del oeste' },
  { a: 'W8', b: 'W9', terrain: 'auxiliar', tunnel: 'Túneles auxiliares del oeste' },
  { a: 'STL', b: 'W10', terrain: 'auxiliar', via: [[606, 580]], tunnel: 'Túneles auxiliares del oeste' },
  { a: 'W10', b: 'W9', terrain: 'auxiliar', segs: 1, tunnel: 'Túneles auxiliares del oeste' },
  { a: 'W9', b: 'W11', terrain: 'auxiliar', tunnel: 'Túneles auxiliares del oeste' },
  // Túneles auxiliares (red este): conectan Tenevskaya con Tsentral'naya, Zvezdnaya y Staraya
  { a: 'E1', b: 'E2', terrain: 'auxiliar', tunnel: 'Galería de la Frontera' },
  { a: 'E2', b: 'E3', terrain: 'auxiliar', tunnel: 'Galería de la Frontera' },
  { a: 'E4', b: 'E5', terrain: 'auxiliar', tunnel: 'Túneles auxiliares de Tenevskaya' },
  { a: 'E5', b: 'TEN', terrain: 'auxiliarPeligroso', tunnel: 'Túneles auxiliares de Tenevskaya' },
  { a: 'E5', b: 'E6', terrain: 'auxiliarPeligroso', via: [[996, 532]], tunnel: 'Túneles auxiliares de Tenevskaya' },
  // Túnel de mantenimiento que rodea el derrumbe Tenevskaya - Vhlainska
  { a: 'H1', b: 'H3', terrain: 'estrecho', via: [[1175, 530]], tunnel: 'Túnel de mantenimiento' },
  { a: 'H3', b: 'H2', terrain: 'estrecho', via: [[1245, 530]], tunnel: 'Túnel de mantenimiento' },
  // Túnel latente: solo se abre mediante enfoques o decisiones
  { a: 'MER', b: 'MOS', terrain: 'auxiliarPeligroso', segs: 1, via: [[1060, 900]], latent: true, tunnel: 'Galería Olvidada' },
];

// Río en superficie (decorativo; marca los tramos que pasan bajo el cauce).
export const RIVERS: [number, number][][] = [
  [
    [170, -10], [155, 40], [142, 90], [135, 140], [137, 190], [155, 230], [185, 258], [230, 280], [280, 298],
    [340, 316], [410, 332], [480, 348], [540, 364], [590, 384], [635, 405], [668, 428], [695, 452], [718, 480],
    [738, 510], [758, 545], [775, 580], [790, 615], [805, 650], [822, 690], [840, 725], [860, 758], [885, 786],
    [915, 815], [950, 840], [990, 860], [1040, 878], [1100, 898], [1160, 915], [1220, 935], [1290, 955],
    [1360, 960], [1430, 950], [1490, 938], [1540, 918], [1580, 890], [1610, 860], [1630, 820], [1645, 780],
    [1655, 740], [1660, 700], [1655, 660], [1645, 620], [1628, 585], [1605, 550], [1582, 515], [1560, 480],
    [1543, 445], [1528, 410], [1515, 375], [1505, 340], [1500, 300], [1500, 262], [1505, 225], [1518, 195],
    [1540, 168], [1575, 150], [1630, 132], [1700, 118], [1780, 110], [1850, 118], [1930, 132],
  ],
  [
    [-10, 448], [25, 428], [60, 408], [100, 392], [160, 383], [240, 381], [320, 384], [380, 393], [440, 400],
    [500, 401], [560, 398], [610, 400], [640, 408],
  ],
];
