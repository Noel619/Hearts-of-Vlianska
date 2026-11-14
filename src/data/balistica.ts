// Balística: los cartuchos de las armas del metro con sus datos reales (masa y
// calibre del proyectil, velocidad en boca), cómo los frena el aire, cuánta
// energía ceden dentro del cuerpo y qué blindaje los para.
//
// En el metro se recargan a mano con casquillos recuperados, pero la física es
// la misma. La energía de una bala es ½·m·v²: un 7,62×39 sale del Kaláshnikov
// con unos dos mil julios, siete veces lo que lleva una bala de Makárov. El
// aire apenas la frena en las distancias de un túnel. Lo que hiere es la
// energía que suelta dentro del cuerpo, y eso depende de cuánto tarda en
// frenarse o en voltear: una 5,45 vuelca a los pocos centímetros y lo cede casi
// todo; una 7,62 blindada atraviesa un brazo sin apenas frenarse.

export type CartId = '9x18' | '762x39' | '545x39' | '762x54' | '12g' | 'bola13';

export interface Cartridge {
  name: string;
  /** Masa de cada proyectil (g). */
  mass: number;
  /** Diámetro del proyectil (mm). */
  diam: number;
  /** Proyectiles por disparo (la posta). */
  pellets: number;
  /** Coeficiente de arrastre en el aire (bala ojival ≈ 0,3; esfera ≈ 0,47). */
  cd: number;
  /** Recorrido en el cuerpo (cm) en el que suelta casi dos tercios de su energía. */
  tissue: number;
}

export const CARTRIDGES: Record<CartId, Cartridge> = {
  '9x18': { name: '9×18 mm Makárov', mass: 6.1, diam: 9.27, pellets: 1, cd: 0.25, tissue: 30 },
  '762x39': { name: '7,62×39 mm', mass: 7.9, diam: 7.85, pellets: 1, cd: 0.3, tissue: 45 },
  '545x39': { name: '5,45×39 mm', mass: 3.4, diam: 5.6, pellets: 1, cd: 0.3, tissue: 22 },
  '762x54': { name: '7,62×54 mm R', mass: 9.6, diam: 7.85, pellets: 1, cd: 0.28, tissue: 35 },
  '12g': { name: 'Calibre 12 con posta', mass: 3.5, diam: 8.4, pellets: 9, cd: 0.47, tissue: 25 },
  bola13: { name: 'Bola de rodamiento de 12,7 mm', mass: 8.4, diam: 12.7, pellets: 1, cd: 0.47, tissue: 18 },
};

/** Densidad del aire en el metro (kg/m³). */
const AIR = 1.2;

/** Sección del proyectil (mm²). */
export function section(k: Cartridge): number {
  return Math.PI * (k.diam / 2) ** 2;
}

/** Distancia (m) en la que el aire deja la velocidad en 1/e de la inicial: 2·m / (ρ·Cd·A). */
export function dragLength(k: Cartridge): number {
  return (2 * k.mass) / 1000 / (AIR * k.cd * section(k) * 1e-6);
}

/** Velocidad (m/s) a `d` metros de la boca. */
export function velocityAt(k: Cartridge, v0: number, d: number): number {
  return v0 * Math.exp(-d / dragLength(k));
}

/** Energía (J) de un proyectil a `v` m/s. */
export function energy(k: Cartridge, v: number): number {
  return 0.5 * (k.mass / 1000) * v * v;
}

/** Energía por milímetro cuadrado de sección (J/mm²): lo que decide si atraviesa una chapa. */
export function energyDensity(k: Cartridge, v: number): number {
  return energy(k, v) / section(k);
}

/**
 * El cráneo como blindaje (J/mm²): una bala de cualquier arma de fuego lo
 * atraviesa; una bola de aire comprimido, a duras penas.
 */
export const SKULL = 0.8;

/** Recorrido de una bala a través de cada parte del cuerpo (cm): cabeza, pecho, vientre, brazos y piernas. */
export const PATH = [14, 24, 22, 8, 8, 13, 13];

/** Energía (J) que una bala con `e` julios cede al cruzar `path` cm de cuerpo. */
export function deposited(k: Cartridge, e: number, path: number, tissue = k.tissue): number {
  return e * (1 - Math.exp(-path / tissue));
}
