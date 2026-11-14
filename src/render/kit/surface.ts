// Kit de la superficie: lo que queda en las calles de Vlianska veinte años
// después. Vehículos varados, farolas, árboles muertos, quioscos, vallas,
// barricadas, vagones y las torres de ventilación del metro, todo con su capa
// de nieve. Convención del kit: +Z es el frente de la pieza; Y hacia arriba.

import { C, MeshBuilder, crate, defProp, plank, sandbag, vary, type RGB } from './core';
import type { Rng } from './core';

const SNOW: RGB = [0.86, 0.88, 0.92];
const GLASS: RGB = [0.08, 0.1, 0.12];

/** Capa de nieve sobre una superficie horizontal. */
function snowCap(b: MeshBuilder, x: number, y: number, z: number, sx: number, sz: number, rng: Rng, th = 0.08) {
  b.color(vary(SNOW, rng, 0.04));
  b.sphere(x, y, z, sx / 2, th, sz / 2, 8, 3, 0, 0.5);
}

function wheel(b: MeshBuilder, x: number, y: number, z: number, r: number, w: number) {
  b.push().translate(x, y, z).rotateZ(Math.PI / 2);
  b.color(C.rubber).cyl(0, -w / 2, 0, r, r, w, 10, 0b11);
  b.color(C.steelDark).cyl(0, -w / 2 - 0.01, 0, r * 0.5, r * 0.5, w + 0.02, 8, 0b11);
  b.pop();
}

// --- Vehículos ----------------------------------------------------------------------------

const CAR_COLORS: RGB[] = [[0.72, 0.66, 0.5], [0.42, 0.55, 0.62], [0.55, 0.16, 0.12], [0.3, 0.42, 0.3]];

defProp('coche', (b, v, rng) => {
  // Berlina soviética: capó largo, cabina atrás, óxido y nieve
  const burned = v >= 4;
  const body: RGB = burned ? [0.09, 0.08, 0.07] : vary(CAR_COLORS[v % 4], rng, 0.08);
  const L = 4.5;
  const Wd = 1.74;
  b.color(body).box(0, 0.28, 0, Wd, 0.55, L);
  b.color(body, 0.92).box(0, 0.83, -0.25, Wd - 0.12, 0.52, 2.3);
  // Cristales (rotos o ennegrecidos)
  b.color(burned ? C.black : GLASS);
  b.box(0, 0.9, 0.92, Wd - 0.22, 0.36, 0.02);
  b.box(0, 0.9, -1.4, Wd - 0.22, 0.34, 0.02);
  for (const s of [-1, 1]) b.box((s * (Wd - 0.11)) / 2, 0.9, -0.25, 0.02, 0.36, 2.1);
  // Paragolpes, faros y óxido
  b.color(C.steelLight, burned ? 0.3 : 0.9).box(0, 0.3, L / 2 + 0.04, Wd, 0.12, 0.08).box(0, 0.3, -L / 2 - 0.04, Wd, 0.12, 0.08);
  b.color(C.white, burned ? 0.2 : 0.8);
  for (const s of [-1, 1]) b.cyl((s * Wd) / 2.6, 0.55, L / 2 + 0.01, 0.09, 0.09, 0.02, 8, 0b11);
  b.color(C.rust);
  for (let i = 0; i < 4; i++) b.box((rng.chance(0.5) ? 1 : -1) * (Wd / 2 + 0.005), 0.35 + rng.range(0, 0.3), rng.range(-1.8, 1.8), 0.01, rng.range(0.1, 0.25), rng.range(0.2, 0.6));
  // Ruedas: alguna pinchada o robada
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      if (rng.chance(burned ? 0.5 : 0.15)) continue;
      wheel(b, (sx * (Wd - 0.1)) / 2, rng.chance(0.25) ? 0.22 : 0.3, sz * 1.38, 0.3, 0.2);
    }
  }
  if (!burned) {
    snowCap(b, 0, 1.36, -0.25, Wd - 0.1, 2.2, rng, 0.1);
    snowCap(b, 0, 0.84, 1.45, Wd - 0.1, 1.3, rng, 0.07);
  } else {
    b.color(C.soot);
    b.box(0, 0.83, 1.5, Wd - 0.1, 0.02, 1.2);
  }
});

defProp('autobus', (b, v, rng) => {
  // Autobús urbano de morro redondo, crema y rojo, con la nieve en el techo
  const L = 10.6;
  const Wd = 2.5;
  const H = 2.9;
  const top: RGB = vary(v % 2 ? [0.82, 0.7, 0.42] : [0.82, 0.78, 0.66], rng, 0.05);
  const band: RGB = vary(v % 2 ? [0.6, 0.18, 0.12] : [0.25, 0.35, 0.55], rng, 0.06);
  b.color(band).box(0, 0.35, 0, Wd, 1.0, L);
  b.color(top).box(0, 1.35, 0, Wd, H - 1.35, L);
  b.color(top, 0.9).sphere(0, H - 0.05, 0, Wd / 2, 0.18, L / 2, 10, 3, 0, 0.5);
  // Ventanillas
  b.color(GLASS);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.box((s * Wd) / 2 + s * 0.005, 1.45, -L / 2 + 1.4 + i * 1.45, 0.02, 0.85, 1.2);
  b.box(0, 1.45, L / 2 + 0.005, Wd - 0.3, 0.95, 0.02);
  // Puertas plegables
  b.color(C.steelDark);
  for (const z of [-2.8, 0.6, 3.6]) b.box(Wd / 2 + 0.01, 0.35, z, 0.02, 2.2, 1.05);
  for (const z of [-3.6, 3.4]) {
    wheel(b, -Wd / 2 + 0.25, 0.48, z, 0.48, 0.32);
    wheel(b, Wd / 2 - 0.25, 0.48, z, 0.48, 0.32);
  }
  snowCap(b, 0, H + 0.08, 0, Wd - 0.2, L - 0.6, rng, 0.14);
});

defProp('trolebus', (b, _v, rng) => {
  // Trolebús: autobús con sus dos pértigas caídas
  const L = 11;
  const Wd = 2.5;
  const H = 3.0;
  b.color(vary([0.32, 0.5, 0.42], rng, 0.05)).box(0, 0.35, 0, Wd, 1.0, L);
  b.color(vary([0.84, 0.82, 0.72], rng, 0.05)).box(0, 1.35, 0, Wd, H - 1.35, L);
  b.color(GLASS);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) b.box((s * Wd) / 2 + s * 0.005, 1.45, -L / 2 + 1.5 + i * 1.5, 0.02, 0.9, 1.25);
  b.box(0, 1.45, L / 2 + 0.005, Wd - 0.3, 1.0, 0.02);
  for (const z of [-3.8, 3.6]) {
    wheel(b, -Wd / 2 + 0.25, 0.48, z, 0.48, 0.32);
    wheel(b, Wd / 2 - 0.25, 0.48, z, 0.48, 0.32);
  }
  b.color(C.steelDark).box(0, H, -1.2, 1.2, 0.25, 2.4);
  for (const s of [-1, 1]) b.beam(s * 0.35, H + 0.2, -1.8, s * 0.6, H + 1.7, -6.5, 0.05, 0.05);
  snowCap(b, 0, H + 0.08, 1.5, Wd - 0.2, L * 0.55, rng, 0.12);
});

defProp('camion', (b, _v, rng) => {
  // Camión militar de caja entoldada
  const olive = vary(C.olive, rng, 0.08);
  b.color(olive).box(0, 0.7, 2.6, 2.3, 1.5, 1.9);
  b.color(GLASS).box(0, 1.55, 3.56, 1.9, 0.55, 0.02);
  b.color(olive, 0.85).box(0, 0.7, 2.2, 2.4, 0.5, 1.2);
  b.color(C.steelDark).box(0, 0.55, -0.4, 2.0, 0.3, 6.4);
  b.color(vary(C.canvasGreen, rng, 0.1)).box(0, 0.85, -1.2, 2.4, 1.9, 4.2);
  b.sphere(0, 2.7, -1.2, 1.2, 0.3, 2.1, 8, 3, 0, 0.5);
  for (const z of [2.5, -1.4, -2.7]) {
    wheel(b, -1.0, 0.52, z, 0.52, 0.36);
    wheel(b, 1.0, 0.52, z, 0.52, 0.36);
  }
  snowCap(b, 0, 2.95, -1.2, 2.2, 4.0, rng, 0.12);
  snowCap(b, 0, 2.22, 2.6, 2.1, 1.7, rng, 0.08);
});

defProp('blindado', (b, _v, rng) => {
  // Transporte blindado abandonado en una barricada de 2013
  const g = vary([0.26, 0.29, 0.22], rng, 0.06);
  b.color(g).box(0, 0.55, 0, 2.8, 1.3, 7.4);
  b.color(g, 0.9).box(0, 1.85, -0.3, 2.4, 0.5, 5.6);
  b.color(g, 0.85).cyl(0, 2.35, 0.6, 0.55, 0.5, 0.45, 10);
  b.color(C.steelDark).beam(0, 2.6, 0.9, 0, 2.62, 3.1, 0.07, 0.07);
  for (let i = 0; i < 4; i++) {
    wheel(b, -1.45, 0.55, -2.6 + i * 1.75, 0.55, 0.35);
    wheel(b, 1.45, 0.55, -2.6 + i * 1.75, 0.55, 0.35);
  }
  b.color(C.rust, 0.8);
  for (let i = 0; i < 6; i++) b.box(rng.chance(0.5) ? 1.405 : -1.405, rng.range(0.7, 1.6), rng.range(-3, 3), 0.01, rng.range(0.2, 0.5), rng.range(0.3, 0.8));
  snowCap(b, 0, 2.35, -0.3, 2.3, 5.4, rng, 0.12);
});

// --- Calle -----------------------------------------------------------------------------

defProp('farolaCalle', (b, v, rng) => {
  // Farola de hormigón con brazo curvo: recta, torcida o rota
  const tilt = v === 1 ? 0.14 : v === 2 ? 0.32 : 0;
  b.push().rotateX(tilt);
  b.color(vary(C.concrete, rng, 0.08)).cyl(0, 0, 0, 0.16, 0.1, 8.5, 8);
  if (v !== 2) {
    b.color(C.steelDark).beam(0, 8.3, 0, 0, 8.9, 1.2, 0.06, 0.06).beam(0, 8.9, 1.2, 0, 8.7, 1.9, 0.06, 0.06);
    b.color(C.steelDark).box(0, 8.45, 1.95, 0.32, 0.18, 0.6);
    b.color([0.25, 0.27, 0.28]).box(0, 8.4, 1.95, 0.26, 0.05, 0.5);
    snowCap(b, 0, 8.64, 1.95, 0.32, 0.6, rng, 0.05);
  }
  b.pop();
  b.color(C.concreteDark).cyl(0, 0, 0, 0.3, 0.3, 0.4, 8);
});

defProp('arbolSeco', (b, v, rng) => {
  // Árbol muerto: tronco y ramas desnudas con algo de nieve
  const h = 5.5 + v * 1.4 + rng.range(-0.5, 0.5);
  const bark: RGB = vary([0.2, 0.17, 0.14], rng, 0.1);
  b.color(bark).cyl(0, 0, 0, 0.24, 0.12, h * 0.55, 7);
  const branch = (x: number, y: number, z: number, len: number, ang: number, up: number, depth: number) => {
    const ex = x + Math.cos(ang) * len * (1 - up * 0.4);
    const ez = z + Math.sin(ang) * len * (1 - up * 0.4);
    const ey = y + len * up;
    b.color(bark).beam(x, y, z, ex, ey, ez, 0.1 * (depth + 1) * 0.5, 0.1 * (depth + 1) * 0.5);
    if (depth > 0) {
      for (let i = 0; i < 2; i++) branch(ex, ey, ez, len * 0.6, ang + rng.range(-0.9, 0.9), rng.range(0.3, 0.8), depth - 1);
    } else if (rng.chance(0.5)) {
      b.color(SNOW).beam(x, y + 0.04, z, ex, ey + 0.04, ez, 0.06, 0.03);
    }
  };
  const n = 4 + (v % 2);
  for (let i = 0; i < n; i++) branch(0, h * (0.45 + i * 0.08), 0, h * 0.35, (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3), rng.range(0.35, 0.8), 2);
});

defProp('kiosco', (b, v, rng) => {
  // Quiosco de prensa de chapa y cristal, con el rótulo desconchado
  const col: RGB = vary(v % 2 ? C.enamelBlue : C.enamelGreen, rng, 0.08);
  b.color(col).box(0, 0, 0, 2.6, 0.9, 2.0);
  b.color(GLASS).box(0, 0.9, 0.98, 2.4, 1.2, 0.02);
  for (const s of [-1, 1]) b.color(GLASS).box(s * 1.29, 0.9, 0, 0.02, 1.2, 1.8);
  b.color(col).box(0, 0.9, -0.95, 2.6, 1.2, 0.1);
  b.color(col, 0.8).box(0, 2.1, 0, 2.9, 0.18, 2.3);
  b.color(C.white, 0.85).box(0, 2.28, 1.05, 2.4, 0.35, 0.04);
  b.color(C.red);
  for (let i = 0; i < 6; i++) b.box(-0.9 + i * 0.36, 2.34, 1.075, 0.2, 0.22, 0.01);
  snowCap(b, 0, 2.29, 0, 2.8, 2.2, rng, 0.12);
});

defProp('paradaBus', (b, _v, rng) => {
  // Marquesina de autobús: tejadillo de hormigón, banco y el horario helado
  b.color(C.concrete).box(0, 2.4, 0, 4.2, 0.18, 1.6);
  b.color(C.concreteDark);
  for (const s of [-1, 1]) b.box(s * 1.9, 0, -0.65, 0.2, 2.4, 0.2);
  b.color(vary([0.62, 0.6, 0.55], rng, 0.05)).box(0, 0, -0.75, 4.0, 2.1, 0.08);
  b.color(C.woodDark).box(0, 0.45, -0.45, 3.4, 0.06, 0.4);
  for (const s of [-1, 1]) b.box(s * 1.5, 0, -0.45, 0.08, 0.45, 0.35);
  b.color(C.white).box(1.4, 1.4, -0.7, 0.5, 0.6, 0.02);
  snowCap(b, 0, 2.58, 0, 4.2, 1.6, rng, 0.12);
});

defProp('valla', (b, v, rng) => {
  // Valla de placas de hormigón con relieve de rombos (o de chapa, la variante 1)
  if (v === 1) {
    const col = vary(C.rust, rng, 0.15);
    for (let i = 0; i < 8; i++) b.color(col, 0.8 + (i % 2) * 0.15).box(-1.75 + i * 0.5, 0, 0, 0.48, 2.2 + rng.range(-0.15, 0.1), 0.05);
    return;
  }
  b.color(vary(C.concrete, rng, 0.06)).box(0, 0, 0, 4.0, 2.5, 0.16);
  b.color(C.concrete, 0.8);
  for (let i = 0; i < 6; i++) for (let k = 0; k < 3; k++) b.box(-1.6 + i * 0.64, 0.45 + k * 0.7, 0.085, 0.3, 0.3, 0.02);
  snowCap(b, 0, 2.5, 0, 4.0, 0.2, rng, 0.05);
});

defProp('barricadaCalle', (b, _v, rng) => {
  // Barricada de 2013: un coche volcado, cajas, sacos y alambre
  b.push().translate(-1.2, 0, 0).rotateZ(Math.PI / 2 - 0.15);
  b.color([0.2, 0.18, 0.16]).box(0, -0.85, 0, 1.6, 1.7, 4.2);
  b.pop();
  crate(b, 1.2, 0, 0.6, 0.9, 0.8, rng);
  crate(b, 2.1, 0, -0.4, 0.8, 0.7, rng, C.woodGrey, 0.3);
  for (let i = 0; i < 5; i++) sandbag(b, 0.6 + i * 0.55, 0, -1.0, 0, rng);
  for (let i = 0; i < 4; i++) sandbag(b, 0.9 + i * 0.55, 0.22, -1.0, 0, rng);
  b.color(C.steelDark);
  for (let i = 0; i < 5; i++) b.cyl(-2.5 + i * 1.2, 0, 1.3, 0.03, 0.03, 0.9, 4);
  snowCap(b, 0.5, 0.8, 0, 4.0, 2.0, rng, 0.1);
});

defProp('montonNieve', (b, v, rng) => {
  b.color(vary(SNOW, rng, 0.05));
  b.sphere(0, 0, 0, 1.4 + v * 0.4, 0.7 + v * 0.2, 1.0 + v * 0.3, 10, 4, 0, 0.5);
});

defProp('escombrosGrandes', (b, v, rng) => {
  // Montón de losas de hormigón, ladrillos y varillas retorcidas
  const n = 9 + v * 3;
  for (let i = 0; i < n; i++) {
    const x = rng.range(-2.4, 2.4);
    const z = rng.range(-2.0, 2.0);
    const r = 1 - Math.hypot(x / 2.6, z / 2.2);
    if (r < 0) continue;
    b.push().translate(x, r * 1.2, z).rotateY(rng.range(0, 6)).rotateX(rng.range(-0.6, 0.6)).rotateZ(rng.range(-0.5, 0.5));
    b.color(vary(rng.chance(0.3) ? [0.5, 0.28, 0.22] : C.concrete, rng, 0.12)).box(0, -0.15, 0, rng.range(0.8, 2.2), rng.range(0.15, 0.3), rng.range(0.6, 1.6));
    b.pop();
  }
  b.color(vary([0.42, 0.4, 0.38], rng, 0.08)).sphere(0, 0, 0, 2.6, 1.0, 2.2, 10, 4, 0, 0.5);
  b.color(C.rust);
  for (let i = 0; i < 5; i++) b.beam(rng.range(-1.5, 1.5), 0.8, rng.range(-1, 1), rng.range(-2, 2), rng.range(1.2, 2.2), rng.range(-1.5, 1.5), 0.025, 0.025);
  snowCap(b, 0.3, 1.05, -0.2, 3.4, 2.8, rng, 0.14);
});

defProp('postePalo', (b, _v, rng) => {
  b.color(vary([0.3, 0.24, 0.18], rng, 0.1)).cyl(0, 0, 0, 0.14, 0.11, 8.2, 7);
  b.color([0.3, 0.24, 0.18]).box(0, 7.4, 0, 1.8, 0.12, 0.12);
  b.color(C.white, 0.8);
  for (const x of [-0.75, 0, 0.75]) b.cyl(x, 7.46, 0, 0.05, 0.04, 0.16, 6);
  b.color(C.black);
  for (const x of [-0.75, 0.75]) b.beam(x, 7.6, 0, x, 6.2, 9, 0.012, 0.012);
});

defProp('semaforo', (b, _v, rng) => {
  b.color(C.steelDark).cyl(0, 0, 0, 0.07, 0.06, 3.0, 6);
  b.color(C.black).box(0, 2.2, 0.1, 0.32, 0.85, 0.22);
  for (let i = 0; i < 3; i++) b.color(i === 0 ? [0.3, 0.05, 0.04] : i === 1 ? [0.3, 0.22, 0.04] : [0.04, 0.2, 0.08]).disc(0, 2.9 - i * 0.26, 0.215, 0.09, 8, 1);
  snowCap(b, 0, 3.06, 0.1, 0.32, 0.22, rng, 0.04);
});

defProp('cartelera', (b, v, rng) => {
  // Valla publicitaria con un lema de antes de la guerra
  b.color(C.steelDark);
  for (const s of [-1, 1]) b.beam(s * 2.3, 0, 0, s * 2.3, 3.2, 0, 0.12, 0.12);
  const bg: RGB = v === 0 ? [0.6, 0.1, 0.08] : v === 1 ? [0.12, 0.25, 0.45] : [0.75, 0.68, 0.5];
  b.color(vary(bg, rng, 0.05)).box(0, 3.0, 0, 6.0, 2.8, 0.1);
  b.color(v === 2 ? C.red : C.white);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 9 - r * 2; i++) b.box(-2.4 + r * 0.6 + i * 0.6, 4.6 - r * 0.8, 0.06, 0.42, 0.5, 0.01);
  b.color(C.paper, 0.7);
  for (let i = 0; i < 3; i++) b.box(rng.range(-2.5, 2.5), rng.range(3.2, 5.4), 0.065, rng.range(0.4, 0.9), rng.range(0.3, 0.8), 0.005);
  snowCap(b, 0, 5.82, 0, 6.0, 0.18, rng, 0.06);
});

defProp('columpio', (b, _v, rng) => {
  b.color(vary(C.enamelBlue, rng, 0.1));
  for (const s of [-1, 1]) {
    b.beam(s * 1.5, 0, 0.7, s * 1.5, 2.3, 0, 0.06, 0.06);
    b.beam(s * 1.5, 0, -0.7, s * 1.5, 2.3, 0, 0.06, 0.06);
  }
  b.beam(-1.5, 2.3, 0, 1.5, 2.3, 0, 0.07, 0.07);
  b.color(C.steelDark);
  for (const x of [-0.6, 0.6]) {
    b.beam(x - 0.2, 2.3, 0, x - 0.2, 0.55, 0.15, 0.015, 0.015);
    b.beam(x + 0.2, 2.3, 0, x + 0.2, 0.55, 0.15, 0.015, 0.015);
    b.color(C.woodDark).box(x, 0.5, 0.15, 0.5, 0.05, 0.22).color(C.steelDark);
  }
  snowCap(b, 0, 2.38, 0, 3.0, 0.15, rng, 0.04);
});

defProp('garajes', (b, _v, rng) => {
  // Hilera de garajes de chapa con puertas abolladas
  for (let i = 0; i < 3; i++) {
    const x = -3.1 + i * 3.1;
    const col: RGB = vary(rng.pick([C.enamelGreen, C.rust, C.enamelBlue, [0.45, 0.45, 0.42] as RGB]), rng, 0.08);
    b.color(col).box(x, 0, 0, 3.0, 2.4, 6.0);
    b.color(col, 0.75).box(x, 0.1, 3.01, 2.6, 2.1, 0.02);
    b.color(C.steelDark).box(x, 1.1, 3.03, 0.06, 0.25, 0.02);
    snowCap(b, x, 2.45, 0, 3.0, 6.0, rng, 0.14);
  }
});

defProp('vagonMercancias', (b, v, rng) => {
  // Vagón de mercancías cerrado, con el número pintado y la nieve en el techo
  const col: RGB = vary(v % 2 ? [0.42, 0.2, 0.14] : [0.3, 0.34, 0.3], rng, 0.06);
  b.color(C.black).box(0, 0.6, 0, 2.6, 0.3, 13.6);
  b.color(col).box(0, 0.9, 0, 2.95, 3.1, 13.8);
  b.color(col, 0.8);
  for (let i = 0; i < 12; i++) b.box(1.48, 0.95, -6.4 + i * 1.16, 0.02, 3.0, 0.06);
  for (let i = 0; i < 12; i++) b.box(-1.48, 0.95, -6.4 + i * 1.16, 0.02, 3.0, 0.06);
  b.color(C.steelDark).box(1.49, 1.0, 0, 0.03, 2.4, 2.8);
  b.color(C.white, 0.8).box(-1.5, 2.6, 2.5, 0.01, 0.4, 2.2);
  for (const z of [-5.0, -3.8, 3.8, 5.0]) {
    wheel(b, -0.75, 0.45, z, 0.45, 0.14);
    wheel(b, 0.75, 0.45, z, 0.45, 0.14);
  }
  snowCap(b, 0, 4.05, 0, 2.8, 13.4, rng, 0.18);
});

defProp('viaFerrea', (b, _v, rng) => {
  // Doce metros de vía con traviesas medio enterradas en la nieve
  for (let i = 0; i < 16; i++) plank(b, 0, 0, -5.6 + i * 0.75, 2.5, 0.12, 0.24, rng, C.woodGrey);
  b.color([0.3, 0.29, 0.28]);
  for (const s of [-1, 1]) b.box(s * 0.76, 0.12, 0, 0.08, 0.14, 12);
  b.color(SNOW);
  for (let i = 0; i < 5; i++) b.sphere(rng.range(-1, 1), 0.08, rng.range(-5, 5), rng.range(0.4, 0.9), 0.1, rng.range(0.5, 1.6), 7, 3, 0, 0.5);
});

defProp('torreVentilacion', (b, v, rng) => {
  // Torre de ventilación del metro: cubo de hormigón con rejillas de lamas
  const h = 6 + v * 2;
  b.color(vary(C.concreteLight, rng, 0.05)).box(0, 0, 0, 5.2, h, 5.2);
  b.color(C.concreteDark).box(0, h, 0, 5.8, 0.4, 5.8);
  for (const [nx, nz] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ]) {
    for (let k = 0; k < 9; k++) {
      const y = h * 0.35 + k * 0.32;
      b.color(C.steelDark, 0.8 + (k % 2) * 0.15);
      if (nx === 0) b.box(0, y, nz * 2.62, 3.6, 0.08, 0.14);
      else b.box(nx * 2.62, y, 0, 0.14, 0.08, 3.6);
    }
  }
  b.color(C.red, 0.6).box(0, h * 0.2, 2.61, 1.6, 0.3, 0.02);
  snowCap(b, 0, h + 0.4, 0, 5.6, 5.6, rng, 0.2);
});

defProp('chimenea', (b, _v, rng) => {
  // Chimenea de fábrica de ladrillo, fría desde hace veinte años
  const h = 30;
  b.color(vary([0.42, 0.24, 0.18], rng, 0.06)).cyl(0, 0, 0, 1.7, 1.05, h, 14, 0b10);
  b.color(C.concreteDark).cyl(0, 0, 0, 2.2, 2.2, 1.6, 12);
  b.color(C.soot);
  b.cyl(0, h - 3, 0, 1.13, 1.06, 3.05, 14, 0);
  b.disc(0, h + 0.02, 0, 0.95, 12, 1);
  b.color([0.65, 0.6, 0.55]);
  for (const y of [8, 16, 24]) b.cyl(0, y, 0, 1.7 - (y / h) * 0.65 + 0.05, 1.7 - ((y + 0.4) / h) * 0.65 + 0.05, 0.4, 14, 0);
});

defProp('letreroM', (b, _v, rng) => {
  // El letrero del metro: una «M» roja sobre un mástil
  b.color(C.steelDark).cyl(0, 0, 0, 0.08, 0.08, 3.6, 6);
  b.color([0.55, 0.06, 0.05]).cyl(0, 3.6, 0, 0.55, 0.55, 0.12, 14).push().translate(0, 4.15, 0).rotateX(Math.PI / 2);
  b.color([0.75, 0.08, 0.06]).cyl(0, -0.06, 0, 0.62, 0.62, 0.12, 16, 0b11);
  b.pop();
  b.color(C.white);
  b.box(-0.24, 3.85, 0.07, 0.09, 0.62, 0.02).box(0.24, 3.85, 0.07, 0.09, 0.62, 0.02);
  b.beam(-0.24, 4.47, 0.07, 0, 4.1, 0.07, 0.08, 0.02).beam(0.24, 4.47, 0.07, 0, 4.1, 0.07, 0.08, 0.02);
  snowCap(b, 0, 4.79, 0, 0.3, 0.14, rng, 0.04);
});

defProp('grua', (b, _v, rng) => {
  // Grúa pórtico del patio de la fábrica
  const col = vary(C.yellow, rng, 0.1);
  b.color(col);
  for (const s of [-1, 1]) {
    b.beam(s * 7, 0, -1.2, s * 7, 9, 0, 0.35, 0.35);
    b.beam(s * 7, 0, 1.2, s * 7, 9, 0, 0.35, 0.35);
  }
  b.box(0, 9, 0, 15, 0.8, 1.0);
  b.color(C.steelDark).box(2, 8.2, 0, 1.2, 0.8, 1.4);
  b.beam(2, 8.2, 0, 2, 3.0, 0, 0.03, 0.03);
  b.box(2, 2.6, 0, 0.6, 0.4, 0.6);
  snowCap(b, 0, 9.82, 0, 15, 1.0, rng, 0.1);
});

export { MeshBuilder };
