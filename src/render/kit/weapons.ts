// Modelos de armas y herramientas de mano. Convenio de empuñadura:
//  - armas de fuego: el cañón apunta a +Z, arriba es +Y y la mano está en el origen;
//  - armas blancas y herramientas: el eje largo va hacia +Y y el filo mira a +Z.

import type * as THREE from 'three';
import { MeshBuilder } from '../geo';
import { C } from './core';

type Fn = (b: MeshBuilder) => void;
const REG = new Map<string, Fn>();
const CACHE = new Map<string, THREE.BufferGeometry>();

/** Cómo se empuña una pieza: dónde va la mano de apoyo y cómo la envuelve. */
export interface Grip {
  /** Convenio del modelo: arma de fuego (cañón a +Z) o asta (eje largo a +Y). */
  gun: boolean;
  /** Punto de la mano de apoyo, en coordenadas del arma. */
  off?: [number, number, number];
  /** `bajo`: la palma sostiene el guardamanos por debajo; `puño`: mismo agarre que la mano principal. */
  offMode?: 'bajo' | 'puño';
  /** Radio de lo que agarra la mano de apoyo. */
  offR?: number;
  /** Distancia de la empuñadura a la cantonera (armas que se apoyan en el hombro). */
  stock?: number;
  /** Centro de gravedad a lo largo del eje, para colgarla a la espalda. */
  mid?: number;
}

const GRIPS = new Map<string, Grip>();

function def(id: string, fn: Fn, grip?: Partial<Grip>) {
  REG.set(id, fn);
  if (grip) GRIPS.set(id, { gun: false, ...grip });
}

/** Empuñadura de una pieza (las que no declaran nada se llevan en una mano). */
export function heldGrip(id: string): Grip | null {
  return GRIPS.get(id) ?? null;
}

export function heldGeometry(id: string): THREE.BufferGeometry | null {
  let g = CACHE.get(id);
  if (g) return g;
  const fn = REG.get(id);
  if (!fn) return null;
  const b = new MeshBuilder({ fx: true });
  b.ao = 0.08;
  fn(b);
  g = b.toGeometry();
  CACHE.set(id, g);
  return g;
}

export function hasHeld(id: string) {
  return REG.has(id);
}

/** Dibuja el modelo dentro de otro constructor (iconos, objetos en el suelo). */
export function drawHeld(b: MeshBuilder, id: string) {
  REG.get(id)?.(b);
}

/** Cañón o tubo a lo largo de +Z. */
function barrel(b: MeshBuilder, y: number, z0: number, z1: number, r: number, sides = 6) {
  b.push().translate(0, y, z0).rotateX(Math.PI / 2);
  b.cyl(0, 0, 0, r, r, z1 - z0, sides, 3);
  b.pop();
}

/** Cargador curvo bajo el cajón de mecanismos. */
function curvedMag(b: MeshBuilder, z: number, len: number) {
  b.color(C.steelDark);
  for (let i = 0; i < 4; i++) {
    const t = i / 4;
    b.push().translate(0, -0.03 - t * len, z + t * t * 0.07).rotateX(-0.25 - t * 0.45);
    b.cube(0, -len / 4, 0, 0.026, len / 4 + 0.008, 0.055);
    b.pop();
  }
}

// --- Armas de fuego -----------------------------------------------------------

def('ak', (b) => {
  // Kalashnikov restaurado
  b.color(C.steelDark).cube(0, 0.0, 0.1, 0.036, 0.062, 0.3);
  b.color(C.iron).cube(0, 0.062, 0.1, 0.03, 0.014, 0.26);
  // Culata de madera
  b.color(C.wood);
  b.push().translate(0, 0.02, -0.05).rotateX(0.12);
  b.cube(0, -0.035, -0.14, 0.032, 0.075, 0.28);
  b.pop();
  b.color(C.steelDark).cube(0, -0.035, -0.325, 0.034, 0.1, 0.012);
  // Empuñadura
  b.color(C.woodDark);
  b.push().translate(0, 0, 0.0).rotateX(0.3);
  b.cube(0, -0.1, 0, 0.028, 0.1, 0.04);
  b.pop();
  // Guardamanos
  b.color(C.wood).cube(0, 0.004, 0.335, 0.04, 0.05, 0.17);
  b.color(C.woodLight).cube(0, 0.054, 0.335, 0.034, 0.02, 0.15);
  // Cañón, tubo de gases y punto de mira
  b.color(C.iron);
  barrel(b, 0.03, 0.42, 0.62, 0.011);
  barrel(b, 0.066, 0.25, 0.47, 0.009);
  b.cube(0, 0.03, 0.57, 0.012, 0.055, 0.016);
  b.cube(0, 0.076, 0.23, 0.016, 0.022, 0.03);
  barrel(b, 0.03, 0.62, 0.66, 0.014);
  curvedMag(b, 0.13, 0.19);
  b.color(C.iron).cube(0, -0.045, 0.045, 0.006, 0.04, 0.06);
}, { gun: true, offMode: 'bajo', off: [0, 0.028, 0.3], offR: 0.026, stock: 0.325, mid: 0.14 });

def('fusilTunel', (b) => {
  // Fusil del túnel: tubo, chapa soldada y culata de tablón
  b.color(C.rust).cube(0, 0, 0.08, 0.04, 0.058, 0.26);
  b.color(C.rustDark).cube(0, 0.058, 0.06, 0.02, 0.012, 0.12);
  b.color(C.woodGrey);
  b.push().translate(0, 0.01, -0.05).rotateX(0.16);
  b.cube(0, -0.03, -0.13, 0.03, 0.085, 0.26);
  b.pop();
  b.color(C.woodDark);
  b.push().rotateX(0.35);
  b.cube(0, -0.1, 0, 0.03, 0.1, 0.038);
  b.pop();
  b.color(C.steel);
  barrel(b, 0.03, 0.21, 0.58, 0.016);
  b.color(C.rustDark);
  barrel(b, 0.03, 0.26, 0.4, 0.024, 8);
  b.color(C.steelDark).cube(0, -0.15, 0.1, 0.026, 0.15, 0.05);
  b.color(C.copper).cube(0, 0.03, 0.42, 0.036, 0.01, 0.01);
}, { gun: true, offMode: 'bajo', off: [0, 0.03, 0.31], offR: 0.026, stock: 0.31, mid: 0.13 });

def('carabina', (b) => {
  // Carabina de grado militar
  b.color(C.black).cube(0, 0, 0.09, 0.036, 0.066, 0.3);
  b.color(C.steelDark).cube(0, 0.066, 0.1, 0.03, 0.018, 0.22);
  b.color(C.black);
  b.push().translate(0, 0.03, -0.05);
  b.cube(0, -0.028, -0.12, 0.028, 0.05, 0.24);
  b.cube(0, -0.06, -0.24, 0.034, 0.11, 0.03);
  b.pop();
  b.push().rotateX(0.25);
  b.cube(0, -0.1, 0, 0.028, 0.1, 0.04);
  b.pop();
  b.color(C.oliveDark).cube(0, 0.002, 0.33, 0.044, 0.056, 0.2);
  b.color(C.iron);
  barrel(b, 0.03, 0.43, 0.6, 0.011);
  barrel(b, 0.03, 0.6, 0.67, 0.018, 8);
  // Mira óptica
  b.color(C.black);
  barrel(b, 0.115, 0.02, 0.22, 0.02, 8);
  b.cube(0, 0.084, 0.06, 0.016, 0.014, 0.02).cube(0, 0.084, 0.17, 0.016, 0.014, 0.02);
  b.color(C.glass).glow(0.4);
  b.push().translate(0, 0.115, 0.222).rotateX(Math.PI / 2).disc(0, 0, 0, 0.017, 8, 1).pop();
  b.glow(0);
  b.color(C.steelDark).cube(0, -0.16, 0.12, 0.024, 0.16, 0.05);
}, { gun: true, offMode: 'bajo', off: [0, 0.03, 0.3], offR: 0.03, stock: 0.3, mid: 0.14 });

def('subfusil', (b) => {
  b.color(C.steelDark);
  barrel(b, 0.025, -0.08, 0.2, 0.026, 8);
  b.color(C.iron);
  barrel(b, 0.025, 0.2, 0.38, 0.012);
  barrel(b, 0.025, 0.2, 0.34, 0.022, 8);
  b.color(C.woodDark);
  b.push().rotateX(0.25);
  b.cube(0, -0.1, 0, 0.028, 0.1, 0.038);
  b.pop();
  b.color(C.steelDark).cube(0, -0.2, 0.09, 0.022, 0.2, 0.036);
  // Culata de alambre
  b.color(C.iron);
  b.tube([0.012, 0.03, -0.08, 0.012, 0.02, -0.3, 0.012, -0.08, -0.31], 0.006, 3);
  b.tube([-0.012, 0.03, -0.08, -0.012, 0.02, -0.3, -0.012, -0.08, -0.31], 0.006, 3);
}, { gun: true, offMode: 'bajo', off: [0, 0.025, 0.25], offR: 0.024, stock: 0.31, mid: 0.04 });

def('pistola', (b) => {
  b.color(C.steelDark).cube(0, 0.012, 0.03, 0.024, 0.036, 0.16);
  b.color(C.iron).cube(0, 0.048, 0.03, 0.022, 0.012, 0.15);
  b.color(C.woodDark);
  b.push().rotateX(0.22);
  b.cube(0, -0.09, 0, 0.026, 0.105, 0.036);
  b.pop();
  b.color(C.iron).cube(0, -0.02, 0.04, 0.005, 0.03, 0.045);
}, { gun: true, offMode: 'puño', off: [0.012, -0.062, 0.008], mid: 0.02 });

def('escopeta', (b) => {
  // Recortada de dos cañones
  b.color(C.woodDark);
  b.push().rotateX(0.5);
  b.cube(0, -0.1, -0.02, 0.032, 0.12, 0.045);
  b.pop();
  b.color(C.wood).cube(0, -0.01, 0.16, 0.046, 0.036, 0.16);
  b.color(C.steelDark).cube(0, 0.0, 0.03, 0.044, 0.052, 0.1);
  b.color(C.iron);
  for (const x of [-0.013, 0.013]) {
    b.push().translate(x, 0.034, 0.08).rotateX(Math.PI / 2);
    b.cyl(0, 0, 0, 0.013, 0.013, 0.34, 6, 3);
    b.pop();
  }
}, { gun: true, offMode: 'bajo', off: [0, 0.006, 0.17], offR: 0.024, mid: 0.12 });

def('cerrojo', (b) => {
  // Fusil de cerrojo de caja larga
  b.color(C.wood);
  b.push().translate(0, 0.0, -0.04).rotateX(0.14);
  b.cube(0, -0.04, -0.15, 0.032, 0.07, 0.3);
  b.pop();
  b.cube(0, -0.012, 0.3, 0.036, 0.04, 0.62);
  b.color(C.steelDark).cube(0, 0.028, 0.06, 0.03, 0.03, 0.2);
  b.color(C.iron);
  barrel(b, 0.04, 0.16, 0.86, 0.011);
  b.tube([0.016, 0.045, 0.02, 0.05, 0.03, 0.02, 0.055, 0.0, 0.02], 0.007, 4);
  b.sphere(0.055, -0.004, 0.02, 0.012, 0.012, 0.012, 5, 3);
  b.cube(0, 0.04, 0.82, 0.008, 0.03, 0.01);
}, { gun: true, offMode: 'bajo', off: [0, 0.008, 0.33], offR: 0.024, stock: 0.335, mid: 0.2 });

def('neumatico', (b) => {
  // Fusil de aire comprimido casero: depósito, manómetro y cañón largo
  b.color(C.woodGrey);
  b.push().translate(0, 0, -0.05).rotateX(0.14);
  b.cube(0, -0.035, -0.14, 0.03, 0.07, 0.28);
  b.pop();
  b.color(C.steel).cube(0, 0, 0.08, 0.034, 0.05, 0.22);
  b.color(C.copper);
  barrel(b, -0.03, 0.12, 0.5, 0.028, 8);
  b.color(C.iron);
  barrel(b, 0.03, 0.18, 0.72, 0.009);
  b.color(C.brass);
  b.push().translate(0.034, 0.02, 0.1).rotateZ(-Math.PI / 2);
  b.cyl(0, 0, 0, 0.024, 0.024, 0.014, 8, 3);
  b.pop();
  b.color(C.woodDark);
  b.push().rotateX(0.3);
  b.cube(0, -0.1, 0, 0.028, 0.1, 0.038);
  b.pop();
  b.color(C.rubber).tube([0, -0.02, 0.5, 0.02, 0.0, 0.46, 0, 0.03, 0.4], 0.006, 3);
}, { gun: true, offMode: 'bajo', off: [0, -0.03, 0.3], offR: 0.03, stock: 0.33, mid: 0.16 });

def('ametralladora', (b) => {
  b.color(C.steelDark).cube(0, 0, 0.1, 0.05, 0.075, 0.36);
  b.color(C.wood);
  b.push().translate(0, 0.01, -0.07).rotateX(0.1);
  b.cube(0, -0.04, -0.13, 0.03, 0.09, 0.26);
  b.pop();
  b.color(C.woodDark);
  b.push().rotateX(0.3);
  b.cube(0, -0.1, 0, 0.03, 0.1, 0.04);
  b.pop();
  b.color(C.iron);
  barrel(b, 0.04, 0.28, 0.82, 0.014);
  barrel(b, 0.04, 0.76, 0.84, 0.02, 8);
  barrel(b, 0.012, 0.28, 0.6, 0.01);
  // Caja de cinta
  b.color(C.olive).cube(0.0, -0.13, 0.14, 0.09, 0.13, 0.13);
  // Bípode plegado
  b.color(C.iron);
  b.beam(0.02, 0.02, 0.7, 0.03, -0.04, 0.42, 0.008, 0.008);
  b.beam(-0.02, 0.02, 0.7, -0.03, -0.04, 0.42, 0.008, 0.008);
}, { gun: true, offMode: 'bajo', off: [0, 0.03, 0.34], offR: 0.03, stock: 0.335, mid: 0.2 });

// --- Armas blancas y herramientas (eje largo hacia +Y) ------------------------------

def('cuchillo', (b) => {
  b.color(C.woodDark).cube(0, -0.05, 0, 0.022, 0.11, 0.03);
  b.color(C.steelDark).cube(0, 0.06, 0, 0.012, 0.012, 0.06);
  b.color(C.steelLight);
  b.prism([-0.004, -0.014, 0.004, -0.014, 0.004, 0.02, -0.004, 0.02], 0.072, 0.21, false);
  b.triangle(-0.004, 0.21, -0.014, 0.004, 0.21, 0.02, 0, 0.27, -0.008);
  b.triangle(0.004, 0.21, -0.014, 0, 0.27, -0.008, 0.004, 0.21, 0.02);
  b.triangle(-0.004, 0.21, 0.02, -0.004, 0.21, -0.014, 0, 0.27, -0.008);
}, { mid: 0.08 });

def('machete', (b) => {
  b.color(C.woodDark).cube(0, -0.06, 0, 0.026, 0.13, 0.036);
  b.color(C.steel);
  b.cube(0, 0.07, 0.006, 0.006, 0.36, 0.05);
  b.color(C.steelLight);
  b.quad(-0.003, 0.07, 0.031, 0.003, 0.07, 0.031, 0.003, 0.5, 0.05, -0.003, 0.5, 0.05);
  b.color(C.steel);
  b.cube(0, 0.43, 0.014, 0.006, 0.08, 0.066);
  b.color(C.rust, 0.8).cube(0, 0.2, 0.0, 0.007, 0.1, 0.02);
}, { mid: 0.2 });

def('hacha', (b) => {
  b.color(C.wood).cube(0, -0.12, 0, 0.028, 0.72, 0.036);
  b.color(C.steelDark).cube(0, 0.5, 0.02, 0.04, 0.1, 0.09);
  b.color(C.steelLight);
  b.prism([-0.018, 0.06, 0.018, 0.06, 0.004, 0.17, -0.004, 0.17], 0.46, 0.64, true);
  b.color(C.red, 0.7).cube(0, 0.42, 0, 0.03, 0.06, 0.038);
}, { off: [0, 0.3, 0], offMode: 'puño', mid: 0.26 });

def('maza', (b) => {
  b.color(C.woodDark).cube(0, -0.15, 0, 0.032, 0.95, 0.036);
  b.color(C.iron).cube(0, 0.72, 0, 0.1, 0.11, 0.2);
  b.color(C.steelLight, 0.7).cube(0, 0.735, 0.1, 0.09, 0.08, 0.012);
  b.cube(0, 0.735, -0.1, 0.09, 0.08, 0.012);
}, { off: [0, 0.36, 0], offMode: 'puño', mid: 0.32 });

def('tubo', (b) => {
  // Tubo de plomo con un codo y cinta aislante
  b.color(C.rust).cyl(0, -0.12, 0, 0.018, 0.018, 0.72, 6, 3);
  b.color(C.rustDark).cyl(0, 0.52, 0, 0.03, 0.03, 0.09, 6, 3);
  b.color(C.black).cyl(0, -0.1, 0, 0.021, 0.021, 0.16, 6, 0);
}, { mid: 0.2 });

def('pala', (b) => {
  b.color(C.wood).cyl(0, -0.12, 0, 0.016, 0.016, 0.56, 6, 3);
  b.color(C.oliveDark);
  b.prism([-0.07, -0.006, 0.07, -0.006, 0.07, 0.006, -0.07, 0.006], 0.44, 0.6, true);
  b.triangle(-0.07, 0.6, 0, 0.07, 0.6, 0, 0, 0.68, 0);
  b.triangle(0.07, 0.6, 0, -0.07, 0.6, 0, 0, 0.68, 0);
}, { mid: 0.25 });

def('lanza', (b) => {
  // Lanza improvisada: tubo con bayoneta atada
  b.color(C.woodGrey).cyl(0, -0.55, 0, 0.016, 0.016, 1.5, 6, 3);
  b.color(C.steelLight);
  b.prism([-0.004, -0.014, 0.004, -0.014, 0.004, 0.014, -0.004, 0.014], 0.95, 1.2, false);
  b.triangle(-0.004, 1.2, -0.014, 0.004, 1.2, 0.014, 0, 1.3, 0);
  b.triangle(0.004, 1.2, -0.014, 0, 1.3, 0, 0.004, 1.2, 0.014);
  b.triangle(-0.004, 1.2, 0.014, -0.004, 1.2, -0.014, 0, 1.3, 0);
  b.color(C.burlap).cyl(0, 0.88, 0, 0.022, 0.022, 0.1, 6, 0);
}, { off: [0, 0.46, 0], offMode: 'puño', mid: 0.3 });

def('llave', (b) => {
  b.color(C.steel).cube(0, -0.08, 0, 0.012, 0.34, 0.03);
  b.cube(0, 0.26, 0.012, 0.014, 0.07, 0.06);
  b.color(C.steelDark).cube(0, 0.3, -0.02, 0.014, 0.03, 0.02);
}, { mid: 0.1 });

def('palanca', (b) => {
  b.color(C.iron).cyl(0, -0.12, 0, 0.013, 0.013, 0.66, 6, 3);
  b.tube([0, 0.54, 0, 0, 0.6, 0.02, 0, 0.62, 0.07], 0.013, 5);
  b.color(C.red, 0.6).cyl(0, 0.2, 0, 0.0135, 0.0135, 0.2, 6, 0);
}, { mid: 0.2 });

def('pico', (b) => {
  b.color(C.wood).cube(0, -0.15, 0, 0.03, 0.9, 0.036);
  b.color(C.iron);
  b.tube([0, 0.7, -0.24, 0, 0.74, -0.1, 0, 0.75, 0, 0, 0.74, 0.1, 0, 0.7, 0.24], 0.02, 5);
}, { off: [0, 0.34, 0], offMode: 'puño', mid: 0.3 });

def('martillo', (b) => {
  b.color(C.wood).cube(0, -0.08, 0, 0.022, 0.32, 0.028);
  b.color(C.iron).cube(0, 0.22, 0, 0.032, 0.04, 0.1);
}, { mid: 0.08 });

def('farol', (b) => {
  // Farol de queroseno
  b.color(C.rustDark).cyl(0, -0.2, 0, 0.055, 0.06, 0.04, 8, 3);
  b.color([1, 0.72, 0.36]).glow(5).cyl(0, -0.16, 0, 0.04, 0.045, 0.1, 8, 0);
  b.glow(0).color(C.rustDark).lathe(0, 0, 0, [0.05, -0.06, 0.03, -0.03, 0.012, -0.02], 8);
  b.tube([0.05, -0.16, 0, 0.06, -0.06, 0, 0, 0, 0, -0.06, -0.06, 0, -0.05, -0.16, 0], 0.005, 3);
});

def('guitarra', (b) => {
  // Se sujeta por el mástil
  b.color(C.woodLight);
  b.push().rotateZ(0).translate(0, -0.42, 0.02);
  b.lathe(0, 0, 0, [0.0, -0.05, 0.14, -0.045, 0.14, 0.045, 0, 0.05], 12);
  b.pop();
  b.push().translate(0, -0.42, 0.02).rotateX(Math.PI / 2).scale(1, 1, 1.25);
  b.color(C.wood).cyl(0, -0.045, 0, 0.17, 0.17, 0.09, 14, 3);
  b.color(C.black).disc(0, 0.046, 0.02, 0.045, 10, 1);
  b.pop();
  b.color(C.woodDark).cube(0, -0.26, 0.05, 0.045, 0.5, 0.022);
  b.cube(0, 0.24, 0.045, 0.06, 0.12, 0.02);
});

def('cajaCarga', (b) => {
  b.color(C.wood).cube(0, -0.2, 0.2, 0.5, 0.36, 0.38);
  b.color(C.woodDark).cube(0, -0.2, 0.2, 0.52, 0.05, 0.4).cube(0, 0.11, 0.2, 0.52, 0.05, 0.4);
});

def('saco', (b) => {
  b.color(C.burlap);
  b.sphere(0, -0.05, 0.18, 0.2, 0.26, 0.16, 8, 5);
});

def('botiquin', (b) => {
  b.color(C.white).cube(0, -0.2, 0, 0.09, 0.2, 0.26);
  b.color(C.red).cube(0.046, -0.13, 0, 0.004, 0.06, 0.02).cube(0.046, -0.11, 0, 0.004, 0.02, 0.06);
  b.color(C.steelDark).cube(0, 0, 0, 0.02, 0.012, 0.1);
});
