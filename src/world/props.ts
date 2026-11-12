// Catálogo puro del atrezo: huella en la rejilla, si tapa la luz y qué luz
// emite. La geometría de cada pieza está en render/kit.

export interface PropLight {
  color: number;
  intensity: number;
  radius: number;
  /** Altura de la luz sobre la base de la pieza. */
  y: number;
  /** Desplazamiento local (eje X de la pieza) de la luz. */
  ox?: number;
  oz?: number;
  flicker?: number;
  kind?: 'lamp' | 'fire' | 'spot' | 'glow';
}

export interface PropDef {
  /** Huella rectangular (medio largo en X local, medio fondo en Z local) o radio. */
  foot?: { hx: number; hz: number } | { r: number };
  /** Obstáculo alto: tapa la luz y las balas. */
  tall?: boolean;
  /** Terreno lento en vez de obstáculo. */
  slow?: boolean;
  light?: PropLight;
  /** Se oculta junto con el muro al que está fijada. */
  wall?: boolean;
  /** Número de variantes de geometría. */
  variants?: number;
  /** Pieza grande y única: se construye como malla propia con luz por vértice. */
  unique?: boolean;
}

export interface PropInst {
  type: string;
  x: number;
  y: number;
  z: number;
  rot: number;
  scale?: number;
  variant?: number;
  /** Color de facción (hex sRGB) para las partes teñibles. */
  tint?: number;
  /** Normal exterior del muro (para piezas de pared). */
  wnx?: number;
  wnz?: number;
  /** La luz de la pieza está apagada o rota. */
  dark?: boolean;
  seed?: number;
}

const WARM = 0xffc27a;
const BULB = 0xffd9a0;
const COLD = 0xcfe4ff;
const FIRE = 0xff8a3c;
const SODIUM = 0xffa246;

export const PROPS: Record<string, PropDef> = {
  // --- Arquitectura
  pilar: { foot: { r: 0.55 }, tall: true, variants: 3 },
  portal: { variants: 3 },
  tope: { foot: { hx: 0.35, hz: 1.1 } },
  // --- Luz
  lamparaPared: { wall: true, light: { color: BULB, intensity: 1.0, radius: 15, y: 0, oz: 0.75 } },
  lamparaTunel: { wall: true, light: { color: WARM, intensity: 0.75, radius: 14, y: 0, oz: 0.8 } },
  fluorescente: { wall: true, light: { color: COLD, intensity: 0.8, radius: 13, y: 0, oz: 0.7, flicker: 2 } },
  bombilla: { wall: true, light: { color: BULB, intensity: 0.5, radius: 10, y: 0, oz: 0.5 } },
  farola: { foot: { r: 0.18 }, light: { color: BULB, intensity: 1.15, radius: 17, y: 3.3 } },
  foco: { foot: { r: 0.5 }, light: { color: COLD, intensity: 1.6, radius: 22, y: 2.4, kind: 'spot' } },
  hoguera: { foot: { r: 0.62 }, light: { color: FIRE, intensity: 1.25, radius: 14, y: 0.7, flicker: 1, kind: 'fire' } },
  bidonFuego: { foot: { r: 0.42 }, light: { color: FIRE, intensity: 1.0, radius: 12, y: 1.15, flicker: 1, kind: 'fire' } },
  lamparaSodio: { light: { color: SODIUM, intensity: 1.2, radius: 12, y: 2.5 } },
  senal: { wall: true, light: { color: 0xff3020, intensity: 0.28, radius: 8, y: 0, oz: 0.4, kind: 'glow' } },
  velas: { light: { color: 0xffb060, intensity: 0.3, radius: 6, y: 0.35, flicker: 1, kind: 'glow' } },
  guirnalda: { light: { color: BULB, intensity: 0.7, radius: 11, y: 2.6 } },
  hongosLuz: { light: { color: 0x58ffc0, intensity: 0.22, radius: 7, y: 0.3, kind: 'glow' }, variants: 3 },
  // --- Asentamiento
  tienda: { foot: { hx: 1.45, hz: 1.2 }, tall: true, variants: 4 },
  tiendaGrande: { foot: { hx: 3.0, hz: 2.1 }, tall: true, variants: 2 },
  barracon: { foot: { hx: 1.9, hz: 1.5 }, tall: true, variants: 4 },
  vagon: { foot: { hx: 9.4, hz: 1.4 }, tall: true, variants: 3, unique: true },
  puesto: { foot: { hx: 1.3, hz: 0.75 }, variants: 5 },
  mesa: { foot: { hx: 0.7, hz: 0.4 }, variants: 2 },
  banco: { foot: { hx: 0.8, hz: 0.22 } },
  taburete: { variants: 2 },
  cama: { foot: { hx: 1.0, hz: 0.45 }, variants: 2 },
  litera: { foot: { hx: 1.0, hz: 0.5 }, tall: false },
  estufa: { foot: { r: 0.4 }, light: { color: FIRE, intensity: 0.35, radius: 6, y: 0.5, flicker: 1, kind: 'glow' } },
  olla: { foot: { r: 0.5 }, light: { color: FIRE, intensity: 0.6, radius: 9, y: 0.4, flicker: 1, kind: 'fire' } },
  tendedero: {},
  alfombra: { variants: 3 },
  estanteria: { foot: { hx: 0.9, hz: 0.25 }, tall: true, variants: 2 },
  barra: { foot: { hx: 1.6, hz: 0.4 } },
  estandarte: { wall: true, variants: 8 },
  bandera: { foot: { r: 0.12 }, variants: 8 },
  cartel: { wall: true, variants: 6 },
  rotulo: { wall: true },
  tablon: { foot: { hx: 0.8, hz: 0.12 } },
  altavoz: { foot: { r: 0.14 } },
  reloj: { wall: true },
  // --- Almacén, defensa, industria
  caja: { foot: { hx: 0.5, hz: 0.5 }, variants: 4 },
  cajas: { foot: { hx: 1.0, hz: 0.75 }, tall: true, variants: 3 },
  barril: { foot: { r: 0.36 }, variants: 4 },
  barriles: { foot: { hx: 0.8, hz: 0.6 }, variants: 2 },
  sacos: { foot: { hx: 1.15, hz: 0.38 }, variants: 3 },
  sacosAlto: { foot: { hx: 1.15, hz: 0.42 }, tall: true, variants: 2 },
  bloque: { foot: { hx: 1.1, hz: 0.35 }, variants: 2 },
  alambrada: { foot: { hx: 1.3, hz: 0.5 }, slow: true },
  erizo: { foot: { r: 0.6 } },
  nidoMG: { foot: { r: 1.25 } },
  garita: { foot: { hx: 0.8, hz: 0.8 }, tall: true },
  barrera: {},
  torreVigia: { foot: { hx: 1.0, hz: 1.0 }, tall: true, light: { color: COLD, intensity: 1.3, radius: 22, y: 4.4, kind: 'spot' } },
  generador: { foot: { hx: 0.85, hz: 0.5 }, light: { color: 0x9dff9d, intensity: 0.08, radius: 4, y: 0.9, kind: 'glow' } },
  bancoTrabajo: { foot: { hx: 0.95, hz: 0.42 }, variants: 3 },
  fragua: { foot: { hx: 0.8, hz: 0.7 }, light: { color: 0xff6a20, intensity: 0.8, radius: 9, y: 0.9, flicker: 1, kind: 'fire' } },
  torno: { foot: { hx: 1.0, hz: 0.45 } },
  horno: { foot: { hx: 1.8, hz: 1.6 }, tall: true, light: { color: 0xff5a18, intensity: 1.4, radius: 14, y: 1.0, oz: 1.9, flicker: 1, kind: 'fire' } },
  cinta: { foot: { hx: 2.6, hz: 0.5 } },
  tuberia: { wall: true, variants: 3 },
  cables: { wall: true, variants: 3 },
  deposito: { foot: { r: 1.1 }, tall: true, variants: 2 },
  bancal: { foot: { hx: 1.5, hz: 0.6 }, variants: 2 },
  corral: { foot: { hx: 2.0, hz: 1.5 } },
  hidroponico: { foot: { hx: 1.4, hz: 0.5 }, tall: true, light: { color: 0xd070ff, intensity: 0.5, radius: 8, y: 1.6, kind: 'glow' } },
  chatarra: { foot: { r: 1.2 }, variants: 3 },
  vagoneta: { foot: { hx: 1.3, hz: 0.75 }, variants: 2 },
  carretilla: { foot: { hx: 0.7, hz: 0.4 } },
  palet: { foot: { hx: 0.65, hz: 0.55 }, variants: 3 },
  bobina: { foot: { r: 0.6 } },
  escombros: { foot: { r: 0.9 }, variants: 3 },
  railes: { foot: { hx: 2.2, hz: 0.5 } },
  // --- Hospital
  camilla: { foot: { hx: 1.0, hz: 0.45 }, variants: 2 },
  biombo: { foot: { hx: 0.9, hz: 0.1 } },
  armario: { foot: { hx: 0.5, hz: 0.3 }, tall: true },
  // --- Peligro y ambiente
  huesos: { variants: 3 },
  telarana: { wall: true, variants: 2 },
  nido: { foot: { r: 1.5 }, light: { color: 0x9dff60, intensity: 0.3, radius: 9, y: 0.6, kind: 'glow' }, variants: 2 },
  picas: { foot: { r: 0.3 }, variants: 2 },
  charco: { variants: 3 },
  maleta: { variants: 3 },
  jaula: { foot: { hx: 0.8, hz: 0.8 }, tall: false },
  botin: { foot: { r: 1.1 }, variants: 2 },
  // --- Hitos
  escaleraMecanica: { foot: { hx: 5.5, hz: 5 }, tall: true, unique: true, light: { color: 0xbcd8ff, intensity: 1.5, radius: 24, y: 4, ox: 3 } },
  pozoAire: { foot: { r: 3.4 }, tall: true, unique: true, light: { color: 0xa9c8ff, intensity: 0.7, radius: 16, y: 3.5 } },
  edificioQuemado: { foot: { hx: 6, hz: 4 }, tall: true, unique: true, light: { color: 0xff8a4a, intensity: 0.45, radius: 11, y: 1.4, oz: 5.4, flicker: 1, kind: 'fire' } },
  correos: { foot: { hx: 2.0, hz: 1.4 }, tall: true, unique: true, light: { color: BULB, intensity: 0.7, radius: 9, y: 2.2, oz: 1.6 } },
  comisaria: { foot: { hx: 2.4, hz: 1.6 }, tall: true, unique: true, light: { color: 0x5fa0ff, intensity: 0.6, radius: 10, y: 2.8, oz: 1.8 } },
  mesaConferencia: { foot: { r: 2.3 }, unique: true },
  tribuna: { foot: { hx: 2.4, hz: 1.4 }, unique: true },
  manantial: { foot: { r: 2.2 }, unique: true, light: { color: 0x3dffb0, intensity: 0.9, radius: 14, y: 0.9, kind: 'glow' } },
  mihrab: { foot: { hx: 1.6, hz: 0.5 }, tall: true, unique: true },
  trono: { foot: { hx: 1.6, hz: 1.4 }, unique: true },
  asamblea: { foot: { hx: 1.4, hz: 0.6 }, unique: true },
  estatua: { foot: { r: 0.7 }, tall: true, unique: true },
  peaje: { foot: { hx: 0.9, hz: 0.8 }, tall: true, light: { color: BULB, intensity: 0.6, radius: 9, y: 2.3 } },
  puertaBlindada: { wall: true, unique: true },
  fundicion: { foot: { hx: 1.6, hz: 1.6 }, tall: true, light: { color: 0xff7a22, intensity: 1.5, radius: 15, y: 1.6, flicker: 1, kind: 'fire' } },
  arsenal: { foot: { hx: 1.4, hz: 0.4 }, tall: true, variants: 2 },
  muroHormigon: { foot: { hx: 2.0, hz: 0.4 }, tall: true, variants: 2 },
  portonEstacion: { unique: true },
  // --- Obra del jugador
  muroChapa: { foot: { hx: 1.5, hz: 0.25 }, tall: true },
  portonChapa: { foot: { hx: 1.5, hz: 0.3 }, tall: true },
  radio: { foot: { hx: 0.7, hz: 0.4 }, light: { color: 0xffd060, intensity: 0.1, radius: 4, y: 1.1, kind: 'glow' } },
};

export function propFootRadius(def: PropDef): number {
  if (!def.foot) return 0;
  return 'r' in def.foot ? def.foot.r : Math.hypot(def.foot.hx, def.foot.hz);
}
