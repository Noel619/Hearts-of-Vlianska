// Bolsas de gas: los «túneles peligrosos» de la historia no lo son solo por
// los mutantes. Cada bolsa ocupa un tramo de túnel o una sala, y su densidad
// decide qué máscara hace falta para cruzarla.

export interface GasDef {
  id: string;
  name: string;
  desc: string;
  /** Tramo de túnel: extremos, centro (fracción del recorrido desde `a`) y semilongitud en metros. */
  link?: { a: string; b: string; at: number; half: number };
  /** Sala de un cruce: se llena entera y rebosa un poco por las bocas. */
  node?: string;
  /** Densidad en el centro (0..1). Por encima de la mitad, un respirador ya no basta. */
  peak: number;
  /** Ocupa toda la superficie (y lo alto de las escaleras que suben a ella). */
  surface?: boolean;
  /** No se pinta como niebla ni como mancha en el mapa (el aire de arriba se ve por la nieve). */
  hidden?: boolean;
}

/** Densidad a partir de la cual se habla de gas denso. */
export const GAS_DENSE = 0.5;

/** Segundos de gas denso que aguanta un filtro (cinco horas de reloj del metro). */
export const FILTER_LIFE = 300;

export const GASES: GasDef[] = [
  {
    id: 'tuberias',
    name: 'Galería de las Tuberías',
    desc: 'Las cañerías reventadas rezuman un vapor amarillento que se queda pegado al suelo. El salitre crece mejor aquí que en ningún otro sitio.',
    node: 'W5',
    peak: 0.75,
  },
  {
    id: 'hondonada',
    name: 'La Hondonada',
    desc: 'En el punto más bajo del Túnel de la Escarcha se estanca un gas pesado y dulzón. Las patrullas lo cruzan a la carrera.',
    link: { a: 'KHO', b: 'VHL', at: 0.55, half: 28 },
    peak: 0.9,
  },
  {
    id: 'aliento',
    name: 'El Aliento de Tenevskaya',
    desc: 'Una nube verdosa sube de los respiraderos al sur de Tenevskaya. Nadie se queda dentro más de lo necesario.',
    link: { a: 'E5', b: 'E6', at: 0.5, half: 34 },
    peak: 1,
  },
  {
    id: 'superficie',
    name: 'Polvo de superficie',
    desc: 'Cerca de las escaleras de Severnyy baja el polvo de la superficie con cada ráfaga. Un respirador basta.',
    link: { a: 'SEV', b: 'UBE', at: 0.18, half: 32 },
    peak: 0.45,
  },
  {
    id: 'superficie-norte',
    name: 'Aire de la superficie',
    desc: 'Veinte años después, el aire de arriba sigue quemando los pulmones. Sin máscara antigás y filtros de repuesto, nadie aguanta en las calles.',
    surface: true,
    hidden: true,
    peak: 0.62,
  },
  {
    id: 'viciado',
    name: 'Aire viciado',
    desc: 'Veinte años tapiada: el aire de la Galería Olvidada no se ha movido desde las bombas.',
    link: { a: 'MER', b: 'MOS', at: 0.5, half: 40 },
    peak: 0.85,
  },
];
