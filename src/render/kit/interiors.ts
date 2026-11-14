// Kit de interiores: piezas de las salas anejas y de la vida diaria en los
// andenes (vestíbulos, escuela, baños, chabolas, cortinas, avisos…).
// Convención del kit: +Z local es el frente de la pieza; Y hacia arriba.

import { C, MeshBuilder, bulb, cloth, crate, defProp, plank, vary, type RGB } from './core';

// --- Vestíbulos -----------------------------------------------------------------------

defProp('torniquete', (b, _v, rng) => {
  // Torniquete de metro: cuerpo de acero pulido con la ranura de la ficha y aspas
  const body = vary([0.42, 0.42, 0.44], rng, 0.05);
  b.color(body).box(0, 0, 0, 0.32, 0.95, 1.05);
  b.color([0.6, 0.6, 0.62]).box(0, 0.95, 0, 0.36, 0.06, 1.1);
  b.color(C.black).box(0.17, 0.62, 0.3, 0.02, 0.12, 0.18);
  // Piloto rojo o verde
  b.color(rng.chance(0.5) ? [1, 0.2, 0.15] : [0.3, 1, 0.4]).glow(2).box(0.17, 0.85, -0.38, 0.02, 0.06, 0.06);
  b.glow(0);
  // Aspas plegadas
  b.color(C.steelDark);
  for (const z of [-0.3, 0.3]) b.beam(0.16, 0.7, z, 0.65, 0.7, z * 0.6, 0.05, 0.05);
});

defProp('taquilla', (b, _v, rng) => {
  // Taquilla del vestíbulo: caseta de madera barnizada con ventanilla iluminada
  const w = 2.4;
  const d = 1.8;
  const h = 2.3;
  const wood = vary(C.woodDark, rng, 0.1);
  b.color(wood).box(0, 0, -d / 2 + 0.05, w, h, 0.1);
  for (const s of [-1, 1]) b.box((s * (w - 0.1)) / 2, 0, 0, 0.1, h, d);
  b.color(wood).box(-0.75, 0, d / 2 - 0.05, 0.9, h, 0.1);
  b.box(0.75, 0, d / 2 - 0.05, 0.9, h, 0.1);
  b.box(0, 0, d / 2 - 0.05, 0.6, 0.95, 0.1);
  b.box(0, 1.75, d / 2 - 0.05, 0.6, h - 1.75, 0.1);
  b.color([0.9, 0.82, 0.6]).glow(1.2).box(0, 0.95, d / 2 - 0.08, 0.6, 0.8, 0.02);
  b.glow(0);
  // Mostrador y tejadillo
  b.color(C.woodLight).box(0, 0.95, d / 2 + 0.12, 0.9, 0.05, 0.3);
  b.color(C.concreteDark).box(0, h, 0, w + 0.2, 0.1, d + 0.2);
  // Rótulo «КАССА»
  b.color(C.white, 0.9).box(0, h - 0.4, d / 2 + 0.01, 1.4, 0.26, 0.02);
  b.color(C.red);
  for (let i = 0; i < 5; i++) b.box(-0.5 + i * 0.25, h - 0.36, d / 2 + 0.025, 0.14, 0.18, 0.01);
  bulb(b, 0, 2.05, d / 2 - 0.3, 0.06);
});

defProp('cartelAviso', (b, v) => {
  // Cartel de aviso pintado en el muro (radiación, prohibido el paso, filtros)
  const col: RGB = v === 0 ? C.yellow : v === 1 ? C.red : C.white;
  b.color(col).box(0, -0.45, 0.02, 0.9, 0.9, 0.03);
  b.color(C.black);
  if (v === 0) {
    // Trébol de radiación
    b.disc(0, 0, 0.04, 0.09, 10, 1);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
      b.box(Math.cos(a) * 0.22, Math.sin(a) * 0.22 - 0.1, 0.04, 0.17, 0.2, 0.005);
    }
  } else if (v === 1) {
    b.color(C.white).box(0, -0.07, 0.04, 0.6, 0.14, 0.005);
  } else {
    b.box(0, 0.15, 0.04, 0.7, 0.07, 0.005);
    b.box(0, 0.0, 0.04, 0.6, 0.05, 0.005);
    b.box(0, -0.12, 0.04, 0.66, 0.05, 0.005);
    b.box(0, -0.25, 0.04, 0.5, 0.05, 0.005);
  }
});

defProp('mascaras', (b, _v, rng) => {
  // Percha de pared con máscaras antigás y filtros colgados
  b.color(C.woodDark).box(0, 0, 0.04, 1.8, 0.1, 0.08);
  for (let i = 0; i < 4; i++) {
    const x = -0.68 + i * 0.45;
    b.color(vary([0.18, 0.2, 0.18], rng, 0.1)).sphere(x, -0.32, 0.16, 0.13, 0.17, 0.11, 8, 5);
    b.color(C.glass, 0.6);
    for (const s of [-1, 1]) b.sphere(x + s * 0.055, -0.26, 0.26, 0.04, 0.04, 0.02, 6, 3);
    b.color(vary(C.olive, rng, 0.15)).cyl(x, -0.6, 0.2, 0.06, 0.06, 0.12, 8);
  }
});

// --- Vivienda y vida diaria -------------------------------------------------------------

defProp('chabola', (b, v, rng) => {
  // Chabola de contrachapado, chapa y puertas de vagón, con ventanuco y tendedero
  const w = 3.3;
  const d = 2.6;
  const h = 2.25;
  const mats: RGB[] = [C.woodGrey, C.rust, C.enamelBlue, C.canvasGreen];
  const main = mats[v % 4];
  const panel = (x0: number, x1: number, z: number, hh: number, col: RGB) => {
    b.color(vary(col, rng, 0.14));
    b.quad(x0, 0, z, x1, 0, z, x1, hh, z, x0, hh, z, 0.7);
  };
  // Frente con puerta de vagón
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x0 = -w / 2 + (w * i) / n;
    const x1 = x0 + w / n;
    if (i === 3) continue;
    panel(x0, x1, d / 2, h + rng.range(-0.1, 0.08), i % 2 ? main : C.woodGrey);
  }
  // Puerta de vagón azul con ventanilla
  b.color(vary(C.enamelBlue, rng, 0.08)).box(-w / 2 + (w * 3.5) / n, 0, d / 2 - 0.03, w / n - 0.04, 1.95, 0.06);
  b.color([1, 0.72, 0.4]).glow(1.3).box(-w / 2 + (w * 3.5) / n, 1.25, d / 2 + 0.005, 0.32, 0.4, 0.01);
  b.glow(0);
  // Costados y fondo
  b.color(vary(main, rng, 0.1));
  b.box(-w / 2, 0, 0, 0.06, h, d);
  b.box(w / 2, 0, 0, 0.06, h, d);
  b.color(vary(C.woodGrey, rng, 0.1)).box(0, 0, -d / 2, w, h, 0.06);
  // Tejado de chapa ondulada con lona
  b.push().translate(0, h + 0.04, 0).rotateZ(0.06);
  b.color(vary(C.rust, rng, 0.15)).cube(0, 0, 0, w + 0.4, 0.04, d + 0.4);
  b.color(vary(C.tarp, rng, 0.2)).cube(rng.range(-0.6, 0.6), 0.04, 0, 1.4, 0.02, d * 0.8);
  b.pop();
  // Ventanuco con cortina
  b.color([1, 0.78, 0.45]).glow(1.0).box(-w / 2 + 0.75, 1.15, d / 2 + 0.005, 0.6, 0.45, 0.01);
  b.glow(0).color(C.clothRed, 0.9).box(-w / 2 + 0.55, 1.15, d / 2 + 0.012, 0.2, 0.45, 0.01);
  // Chimenea
  b.color(C.rustDark).cyl(w / 2 - 0.4, h, -0.6, 0.07, 0.07, 0.8, 6);
  if (v % 2 === 0) {
    // Cubo y leña a la puerta
    b.color(C.steel).cyl(w / 2 - 0.3, 0, d / 2 + 0.35, 0.16, 0.18, 0.32, 8);
    for (let i = 0; i < 4; i++) plank(b, -w / 2 + 0.35, 0.05 + i * 0.1, d / 2 + 0.3, 0.6, 0.09, 0.1, rng, C.woodDark);
  }
});

defProp('cortina', (b, v, rng) => {
  // Cortina colgada de una cuerda entre dos pilones: separa una vivienda del andén
  const cols: RGB[] = [C.clothRed, C.clothBlue, C.canvas, C.clothGreen];
  b.color(C.steelDark).beam(-1.5, 2.25, 0, 1.5, 2.25, 0, 0.03, 0.03);
  b.color(vary(cols[v % 4], rng, 0.18));
  cloth(b, -1.45, 2.22, 0, -0.05, 2.22, 0, 2.05, 6, 0.08, rng);
  b.color(vary(cols[(v + 1) % 4], rng, 0.18));
  cloth(b, 0.15, 2.22, 0, 1.45, 2.22, 0, 2.05, 6, 0.08, rng);
});

defProp('colgante', (b) => {
  // Bombilla desnuda colgando de su cable
  b.color(C.black).beam(0, 2.62, 0, 0, 5.2, 0, 0.012, 0.012);
  b.color(C.steelDark).cyl(0, 2.6, 0, 0.03, 0.05, 0.08, 6);
  bulb(b, 0, 2.55, 0, 0.07);
});

defProp('pizarra', (b) => {
  // Pizarra escolar sobre caballete
  b.color(C.woodDark);
  for (const s of [-1, 1]) {
    b.beam(s * 1.0, 0, 0.25, s * 1.0, 1.9, 0, 0.06, 0.06);
    b.beam(s * 1.0, 0, -0.25, s * 1.0, 1.9, 0, 0.06, 0.06);
  }
  b.color([0.08, 0.16, 0.12]).box(0, 0.75, 0.02, 2.0, 1.05, 0.05);
  b.color(C.woodLight).box(0, 0.7, 0.06, 2.1, 0.06, 0.12);
  // Tiza: unas líneas de cuentas y un mapa
  b.color([0.85, 0.85, 0.8]);
  for (let i = 0; i < 4; i++) b.box(-0.6 + i * 0.05, 1.5 - i * 0.18, 0.05, 0.7 - i * 0.1, 0.025, 0.005);
  b.box(0.5, 1.15, 0.05, 0.02, 0.5, 0.005).box(0.5, 1.15, 0.05, 0.6, 0.02, 0.005);
});

defProp('pupitre', (b, v, rng) => {
  // Pupitre escolar con banco corrido
  const wood = vary(v ? C.wood : C.woodLight, rng, 0.1);
  b.color(wood).box(0, 0.68, -0.05, 1.2, 0.04, 0.45);
  b.color(C.steelDark);
  for (const s of [-1, 1]) b.box(s * 0.55, 0, -0.05, 0.04, 0.68, 0.4);
  b.color(wood, 0.85).box(0, 0.4, 0.42, 1.2, 0.04, 0.26);
  b.color(C.steelDark);
  for (const s of [-1, 1]) b.box(s * 0.55, 0, 0.42, 0.04, 0.4, 0.22);
  b.color(C.paper).box(rng.range(-0.3, 0.3), 0.72, -0.05, 0.25, 0.01, 0.18);
});

defProp('lavadero', (b, _v, rng) => {
  // Pila de lavar de chapa sobre caballetes, con tabla y cubo
  b.color(C.woodDark);
  for (const s of [-1, 1]) b.box(s * 0.55, 0, 0, 0.08, 0.6, 0.6);
  b.color(vary(C.steel, rng, 0.1)).box(0, 0.6, 0, 1.35, 0.32, 0.7);
  b.color([0.24, 0.32, 0.34]).box(0, 0.88, 0, 1.25, 0.02, 0.6);
  b.color(C.woodLight).beam(0.3, 0.92, -0.1, 0.55, 1.2, 0.22, 0.3, 0.03);
  b.color(C.steelLight).cyl(-0.85, 0, 0.3, 0.16, 0.19, 0.34, 8);
  b.color(vary(C.cloth, rng, 0.2)).sphere(-0.2, 0.92, 0.05, 0.25, 0.08, 0.2, 7, 4);
});

defProp('ducha', (b, _v, rng) => {
  // Cabina de ducha de descontaminación: tubo, alcachofa, cortina de hule y rejilla
  b.color(C.steelDark).box(0, 0, 0, 1.2, 0.06, 1.2);
  b.color(C.steel);
  b.beam(-0.55, 0, -0.55, -0.55, 2.3, -0.55, 0.05, 0.05);
  b.beam(-0.55, 2.3, -0.55, 0.0, 2.3, 0.0, 0.04, 0.04);
  b.cyl(0, 2.15, 0, 0.12, 0.05, 0.12, 8);
  b.color(C.steelDark).beam(-0.6, 2.25, 0.6, 0.6, 2.25, 0.6, 0.02, 0.02);
  b.color(vary([0.7, 0.75, 0.65], rng, 0.08));
  cloth(b, -0.6, 2.22, 0.6, 0.15, 2.22, 0.6, 1.95, 5, 0.06, rng);
  b.color(C.yellow).box(0.5, 0.06, -0.5, 0.3, 0.02, 0.05);
});

defProp('cajaFuerte', (b, _v, rng) => {
  // Caja fuerte de hierro con rueda
  b.color(vary([0.22, 0.26, 0.24], rng, 0.08)).box(0, 0, 0, 0.8, 1.1, 0.7);
  b.color(C.steelDark).box(0, 0.08, 0.36, 0.66, 0.9, 0.03);
  b.color(C.brass).cyl(0, 0.62, 0.38, 0.12, 0.12, 0.04, 10).box(0.24, 0.52, 0.38, 0.04, 0.2, 0.04);
});

defProp('bomba', (b, _v, rng) => {
  // Bomba de achique: motor, volante y tuberías que se meten en el suelo
  b.color(C.concreteDark).box(0, 0, 0, 1.5, 0.2, 0.9);
  b.color(vary(C.enamelGreen, rng, 0.1)).cyl(-0.3, 0.2, 0, 0.32, 0.32, 0.7, 12);
  b.color(C.steelDark).cyl(0.35, 0.2, 0, 0.22, 0.22, 0.5, 10);
  b.push().translate(0.35, 0.55, 0.32).rotateX(Math.PI / 2);
  b.color(C.red, 0.8).lathe(0, 0, 0, [0.22, 0, 0.25, 0.02, 0.22, 0.04], 12);
  b.pop();
  b.color(C.rust);
  b.beam(-0.3, 0.6, 0, -0.3, 1.4, 0, 0.12, 0.12);
  b.beam(-0.3, 1.4, 0, -0.9, 1.4, 0, 0.1, 0.1);
  b.beam(0.6, 0.35, 0, 0.75, 0.0, 0, 0.1, 0.1);
});

defProp('cabrestante', (b, _v, rng) => {
  // Torno de cable al pie de la rampa de carga
  b.color(C.concreteDark).box(0, 0, 0, 1.8, 0.25, 1.4);
  b.color(vary(C.yellow, rng, 0.1));
  for (const s of [-1, 1]) b.box(s * 0.75, 0.25, 0, 0.12, 0.9, 0.8);
  b.push().translate(0, 0.85, 0).rotateZ(Math.PI / 2);
  b.color(C.rustDark).cyl(0, -0.7, 0, 0.32, 0.32, 1.4, 12);
  b.color(C.steelDark);
  for (let i = 0; i < 6; i++) b.cyl(0, -0.62 + i * 0.24, 0, 0.34, 0.34, 0.05, 12, 0);
  b.pop();
  b.color(C.steel).box(0.95, 0.25, 0, 0.3, 0.5, 0.5);
});

defProp('taquillas', (b, v, rng) => {
  // Fila de taquillas metálicas abolladas (vestuario de stalkers o de tropa)
  const n = 4;
  const col = vary(v ? C.enamelGreen : [0.38, 0.4, 0.42], rng, 0.08);
  for (let i = 0; i < n; i++) {
    const x = -0.9 + i * 0.6;
    b.color(col, 0.9 + rng.range(-0.08, 0.08)).box(x, 0, 0, 0.58, 1.9, 0.5);
    b.color(col, 0.6);
    for (let k = 0; k < 3; k++) b.box(x, 1.55 + k * 0.08, 0.255, 0.3, 0.025, 0.01);
    b.color(C.steelDark).box(x + 0.2, 0.95, 0.26, 0.04, 0.12, 0.02);
    if (rng.chance(0.35)) {
      // Una puerta entreabierta con ropa
      b.color(vary(C.olive, rng, 0.2)).box(x, 0.6, 0.2, 0.4, 0.9, 0.1);
    }
  }
});

defProp('escenario', (b, _v, rng) => {
  // Tarima de tablones con telón y un par de cajas de altavoz
  const w = 4.2;
  const d = 2.6;
  b.color(C.woodDark).box(0, 0, 0, w, 0.45, d);
  for (let i = 0; i < 8; i++) plank(b, -w / 2 + 0.27 + i * 0.52, 0.45, 0, 0.5, 0.04, d, rng, C.wood);
  b.color(C.steelDark);
  for (const s of [-1, 1]) b.beam((s * w) / 2, 0.45, -d / 2 + 0.1, (s * w) / 2, 3.2, -d / 2 + 0.1, 0.07, 0.07);
  b.beam(-w / 2, 3.2, -d / 2 + 0.1, w / 2, 3.2, -d / 2 + 0.1, 0.06, 0.06);
  b.color(vary(C.clothRed, rng, 0.1));
  cloth(b, -w / 2, 3.15, -d / 2 + 0.15, 0, 3.15, -d / 2 + 0.15, 2.65, 7, 0.12, rng);
  cloth(b, 0, 3.15, -d / 2 + 0.15, w / 2, 3.15, -d / 2 + 0.15, 2.65, 7, 0.12, rng);
  for (const s of [-1, 1]) {
    b.color(C.black).box(s * (w / 2 - 0.35), 0.45, d / 2 - 0.4, 0.5, 0.7, 0.45);
    b.color(C.steelDark).cyl(s * (w / 2 - 0.35), 0.8, d / 2 - 0.17, 0.15, 0.15, 0.02, 10);
  }
  bulb(b, -1.0, 3.0, -d / 2 + 0.4, 0.06, C.bulb, 4);
  bulb(b, 1.0, 3.0, -d / 2 + 0.4, 0.06, C.bulb, 4);
});

defProp('mesaLarga', (b, _v, rng) => {
  // Mesa de comedor de tablones con bancos corridos a ambos lados
  const L = 3.4;
  for (let i = 0; i < 4; i++) plank(b, 0, 0.74, -0.33 + i * 0.22, L, 0.05, 0.21, rng, C.wood);
  b.color(C.woodDark);
  for (const s of [-1, 1]) b.box((s * (L - 0.4)) / 2, 0, 0, 0.1, 0.74, 0.7);
  for (const z of [-0.75, 0.75]) {
    plank(b, 0, 0.42, z, L, 0.05, 0.3, rng, C.woodLight);
    for (const s of [-1, 1]) b.color(C.woodDark).box((s * (L - 0.5)) / 2, 0, z, 0.08, 0.42, 0.26);
  }
  // Cuencos y una lámpara de queroseno
  b.color(C.steelLight);
  for (let i = 0; i < 4; i++) b.cyl(rng.range(-1.4, 1.4), 0.79, rng.range(-0.25, 0.25), 0.09, 0.06, 0.06, 8);
  b.color(C.brass).cyl(0.2, 0.79, 0, 0.07, 0.06, 0.18, 8);
  bulb(b, 0.2, 1.02, 0, 0.05, [1, 0.75, 0.4], 3);
});

defProp('fichero', (b, _v, rng) => {
  // Archivador metálico de cajones
  b.color(vary([0.42, 0.44, 0.4], rng, 0.08)).box(0, 0, 0, 0.55, 1.35, 0.65);
  b.color(C.steelDark);
  for (let i = 0; i < 4; i++) b.box(0, 0.12 + i * 0.32, 0.33, 0.45, 0.26, 0.01);
  b.color(C.steelLight);
  for (let i = 0; i < 4; i++) b.box(0, 0.24 + i * 0.32, 0.345, 0.12, 0.03, 0.02);
});

defProp('vagonetaCarga', (b, _v, rng) => {
  // Plataforma de carga sobre ruedas, con cajas atadas
  b.color(C.rustDark).box(0, 0.25, 0, 2.2, 0.2, 1.2);
  b.color(C.black);
  for (const x of [-0.75, 0.75]) for (const z of [-0.5, 0.5]) b.push().translate(x, 0.2, z).rotateX(Math.PI / 2).cyl(0, -0.05, 0, 0.2, 0.2, 0.1, 10).pop();
  crate(b, -0.5, 0.45, 0, 0.75, 0.6, rng);
  crate(b, 0.45, 0.45, 0.1, 0.65, 0.5, rng, C.woodGrey, 0.2);
  b.color(C.olive).box(0.45, 0.95, 0.1, 0.6, 0.25, 0.5);
});

export { MeshBuilder };
