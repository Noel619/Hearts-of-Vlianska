// Piezas básicas: arquitectura, luces, almacenaje y defensa.

import { C, bulb, crate, defProp, drum, plank, sandbag, vary, type MeshBuilder, type RGB } from './core';

const CAPC: RGB = [0.03, 0.03, 0.033];

// --- Arquitectura -------------------------------------------------------------

defProp('pilar', (b, v, rng) => {
  const H = 4.7;
  if (v === 1) {
    // Columna redonda de mármol
    b.color(C.concreteDark).box(0, 0, 0, 1.0, 0.16, 1.0);
    b.color([0.78, 0.74, 0.68]);
    b.lathe(0, 0.16, 0, [0.46, 0, 0.5, 0.06, 0.46, 0.14, 0.4, 0.2, 0.39, 0.3, 0.37, 2.2, 0.35, H - 0.75, 0.4, H - 0.66, 0.36, H - 0.6, 0.47, H - 0.4, 0.52, H - 0.3, 0.52, H - 0.16], 16);
    b.color(CAPC).disc(0, H, 0, 0.52, 16, 1);
    // Franja con el color de la facción
    b.color(C.tint, 0.7).tinted(1);
    b.lathe(0, 0, 0, [0.395, 1.25, 0.4, 1.27, 0.4, 1.4, 0.395, 1.42], 16);
    b.tinted(0);
  } else if (v === 2) {
    // Pilar de acero roblonado
    const c = vary(C.steel, rng, 0.06);
    b.color(c);
    b.box(0, 0, 0, 0.9, 0.08, 0.7);
    b.box(0, 0.08, 0.24, 0.62, H - 0.08, 0.05);
    b.box(0, 0.08, -0.24, 0.62, H - 0.08, 0.05);
    b.color(c, 0.8).box(0, 0.08, 0, 0.05, H - 0.08, 0.44);
    // Cartelas y roblones
    b.color(c, 1.1);
    for (let y = 0.5; y < H; y += 0.9) {
      b.box(0, y, 0.27, 0.66, 0.16, 0.02);
      b.box(0, y, -0.27, 0.66, 0.16, 0.02);
      for (const x of [-0.26, -0.09, 0.09, 0.26]) {
        b.sphere(x, y + 0.08, 0.285, 0.022, 0.022, 0.012, 5, 3);
        b.sphere(x, y + 0.08, -0.285, 0.022, 0.022, 0.012, 5, 3);
      }
    }
    // Ménsulas diagonales
    b.color(c, 0.85);
    b.beam(0.3, H - 1.3, 0, 1.1, H - 0.2, 0, 0.1, 0.1);
    b.beam(-0.3, H - 1.3, 0, -1.1, H - 0.2, 0, 0.1, 0.1);
    b.color(CAPC).box(0, H - 0.2, 0, 2.4, 0.2, 0.6);
    b.color(C.rust, 0.8).box(0, 0.08, 0, 0.7, 0.3, 0.56);
  } else {
    // Pilar cuadrado alicatado
    b.color(C.concreteDark).box(0, 0, 0, 0.98, 0.22, 0.98);
    b.color([0.72, 0.7, 0.65]).box(0, 0.22, 0, 0.8, 1.0, 0.8);
    b.color(C.tint, 0.62).tinted(1).box(0, 1.22, 0, 0.82, 0.14, 0.82);
    b.tinted(0);
    b.color([0.8, 0.78, 0.72]).box(0, 1.36, 0, 0.76, H - 1.36 - 0.6, 0.76);
    // Capitel escalonado
    b.color([0.7, 0.68, 0.63]).box(0, H - 0.6, 0, 0.9, 0.2, 0.9);
    b.box(0, H - 0.4, 0, 1.06, 0.4, 1.06, 0b110011);
    b.color(CAPC).box(0, H - 0.4, 0, 1.06, 0.4, 1.06, 0b000100);
    // Pilastras
    b.color([0.66, 0.64, 0.6]);
    for (const s of [-1, 1]) {
      b.box(s * 0.36, 1.36, 0.385, 0.06, H - 1.96, 0.02);
      b.box(s * 0.36, 1.36, -0.385, 0.06, H - 1.96, 0.02);
      b.box(0.385, 1.36, s * 0.36, 0.02, H - 1.96, 0.06);
      b.box(-0.385, 1.36, s * 0.36, 0.02, H - 1.96, 0.06);
    }
  }
});

defProp('tope', (b, _v, rng) => {
  // Topera de vía: caballetes de carril y travesaño rojo y blanco
  b.color(C.rustDark);
  for (const z of [-0.76, 0.76]) {
    b.beam(-0.3, 0.02, z, 0.25, 0.95, z, 0.09, 0.14);
    b.beam(0.8, 0.02, z, 0.25, 0.95, z, 0.09, 0.14);
    b.box(0.25, 0, z, 1.2, 0.08, 0.16);
  }
  for (let i = 0; i < 6; i++) {
    b.color(i % 2 ? C.white : C.red, 0.9);
    b.cube(0.2, 0.78, -1.05 + i * 0.35 + 0.175, 0.14, 0.26, 0.35);
  }
  b.color(C.rubber);
  for (const z of [-0.76, 0.76]) b.cyl(0.12, 0.83, z, 0.13, 0.13, 0.1, 8, 3).cyl(0.02, 0.86, z, 0.05, 0.05, 0.1, 6, 0);
  void rng;
});

// --- Luces ---------------------------------------------------------------------

defProp('lamparaPared', (b) => {
  // Aplique de brazo con pantalla esmaltada y bombilla enjaulada
  b.color(C.steelDark).cube(0, -0.16, 0.02, 0.2, 0.32, 0.04);
  b.tube([0, 0, 0.04, 0, 0.1, 0.3, 0, 0.14, 0.58, 0, 0.1, 0.75], 0.022, 5);
  b.color(C.enamelGreen);
  b.lathe(0, 0, 0.75, [0.05, 0.1, 0.07, 0.07, 0.2, -0.02, 0.26, -0.07], 12);
  b.color(C.white, 0.9).glow(0.9);
  b.lathe(0, 0, 0.75, [0.245, -0.065, 0.19, -0.02, 0.06, 0.06], 12);
  b.glow(0);
  bulb(b, 0, -0.08, 0.75, 0.07, C.bulb, 9);
  b.color(C.steelDark);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.tube([Math.cos(a) * 0.1, -0.02, 0.75 + Math.sin(a) * 0.1, Math.cos(a) * 0.11, -0.14, 0.75 + Math.sin(a) * 0.11, 0, -0.22, 0.75], 0.006, 3);
  }
});

defProp('lamparaTunel', (b) => {
  // Ojo de buey estanco con rejilla y tubo de cable
  b.color(C.steelDark).cube(0, -0.17, 0.03, 0.26, 0.34, 0.06);
  b.color(C.iron);
  b.push().translate(0, 0, 0.06).rotateX(Math.PI / 2);
  b.lathe(0, 0, 0, [0.16, 0, 0.165, 0.05, 0.13, 0.09], 12);
  b.color(C.bulb).glow(7);
  b.sphere(0, 0.07, 0, 0.115, 0.07, 0.115, 10, 4, 0.5, 1);
  b.glow(0);
  b.pop();
  b.color(C.steelDark);
  b.cube(0, -0.015, 0.165, 0.33, 0.03, 0.03);
  b.cube(0, -0.165, 0.165, 0.03, 0.33, 0.03);
  // Tubo de cable hacia arriba
  b.color(C.iron).tube([0.09, 0.15, 0.03, 0.09, 1.2, 0.03], 0.018, 4);
});

defProp('fluorescente', (b) => {
  b.color(C.steelLight, 0.7).cube(0, -0.05, 0.05, 1.3, 0.1, 0.1);
  b.color(C.bulbCold).glow(5);
  b.push().translate(-0.6, -0.08, 0.12).rotateZ(-Math.PI / 2);
  b.cyl(0, 0, 0, 0.022, 0.022, 1.2, 6, 0);
  b.pop();
  b.glow(0);
  b.color(C.steelDark);
  b.cube(-0.62, -0.12, 0.12, 0.04, 0.08, 0.06);
  b.cube(0.62, -0.12, 0.12, 0.04, 0.08, 0.06);
});

defProp('bombilla', (b) => {
  b.color(C.iron).cube(0, -0.03, 0.02, 0.06, 0.06, 0.04);
  b.tube([0, 0, 0.03, 0, 0.02, 0.3, 0, -0.02, 0.5, 0, -0.3, 0.5], 0.008, 3);
  b.color(C.black).cyl(0, -0.36, 0.5, 0.025, 0.03, 0.06, 6);
  bulb(b, 0, -0.42, 0.5, 0.055, C.bulb, 8);
});

defProp('farola', (b, v) => {
  // Poste de obra con dos focos
  b.color(C.concreteDark).cyl(0, 0, 0, 0.2, 0.16, 0.14, 8);
  b.color(C.steelDark).cyl(0, 0.14, 0, 0.045, 0.035, 3.2, 6, 0);
  b.tube([0, 3.3, 0, 0.25, 3.42, 0, 0.5, 3.36, 0], 0.022, 4);
  b.tube([0, 3.3, 0, -0.25, 3.42, 0, -0.5, 3.36, 0], 0.022, 4);
  for (const s of [-1, 1]) {
    b.color(C.enamelBlue);
    b.lathe(s * 0.5, 3.36, 0, [0.04, 0.06, 0.06, 0.03, 0.19, -0.05, 0.23, -0.09], 10);
    b.color(C.white, 0.9).glow(0.8);
    b.lathe(s * 0.5, 3.36, 0, [0.22, -0.085, 0.17, -0.04, 0.05, 0.03], 10);
    b.glow(0);
    bulb(b, s * 0.5, 3.27, 0, 0.065, C.bulb, 9);
  }
  // Cable enrollado al poste
  b.color(C.rubber).tube([0.05, 0.2, 0, -0.05, 0.9, 0.03, 0.05, 1.7, -0.02, -0.04, 2.5, 0.02, 0.03, 3.3, 0], 0.012, 3);
  void v;
});

defProp('foco', (b) => {
  // Proyector sobre trípode
  b.color(C.steelDark);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.beam(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45, 0, 1.5, 0, 0.03, 0.03);
  }
  b.cyl(0, 1.5, 0, 0.03, 0.03, 0.75, 5, 0);
  b.push().translate(0, 2.35, 0).rotateX(0.35);
  b.color(C.iron).lathe(0, 0, 0, [0.12, -0.12, 0.2, 0, 0.23, 0.14], 12, false, true);
  b.color(C.bulbCold).glow(9).disc(0, 0.13, 0, 0.21, 12, 1);
  b.glow(0);
  b.pop();
  b.color(C.rubber).tube([0, 2.2, -0.1, 0.1, 1.2, -0.2, 0.3, 0.1, -0.3, 0.8, 0.02, -0.5], 0.014, 3);
});

defProp('hoguera', (b, _v, rng) => {
  // Círculo de cascotes, leños y brasas
  b.color(C.soot).disc(0, 0.012, 0, 0.62, 12, 1);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng.range(-0.1, 0.1);
    const r = 0.5 + rng.range(-0.03, 0.04);
    const s = rng.range(0.1, 0.16);
    b.color(vary(C.stone, rng, 0.2));
    const v0 = b.vcount;
    b.sphere(Math.cos(a) * r, s * 0.6, Math.sin(a) * r, s, s * 0.75, s * 0.9, 6, 4);
    b.jitter(v0, 0.05, i + 3);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rng.range(-0.2, 0.2);
    b.color(vary(C.woodDark, rng, 0.2), 0.7);
    b.beam(Math.cos(a) * 0.38, 0.04, Math.sin(a) * 0.38, Math.cos(a + 2.6) * 0.1, 0.34, Math.sin(a + 2.6) * 0.1, 0.07, 0.07);
  }
  b.color(C.ember).glow(5);
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, 6.28);
    const r = rng.range(0, 0.26);
    b.sphere(Math.cos(a) * r, 0.05, Math.sin(a) * r, 0.07, 0.04, 0.07, 5, 3);
  }
  b.glow(0);
});

defProp('bidonFuego', (b, _v, rng) => {
  drum(b, 0, 0, 0, C.rustDark, rng, true);
  // Agujeros de ventilación incandescentes
  b.color(C.ember).glow(4);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.push().translate(Math.cos(a) * 0.295, 0.2 + (i % 2) * 0.14, Math.sin(a) * 0.295).rotateY(-a + Math.PI / 2);
    b.quad(-0.03, 0, 0, 0.03, 0, 0, 0.03, 0.06, 0, -0.03, 0.06, 0);
    b.pop();
  }
  b.glow(6).disc(0, 0.78, 0, 0.26, 10, 1);
  b.glow(0);
  b.color(C.woodDark, 0.6);
  b.beam(-0.1, 0.7, 0.05, 0.15, 1.05, -0.1, 0.05, 0.05);
  b.beam(0.1, 0.7, 0.1, -0.12, 1.0, 0.05, 0.05, 0.05);
});

defProp('hongosLuz', (b, v, rng) => {
  const n = 5 + v * 2;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, 6.28);
    const r = rng.range(0, 0.45);
    const h = rng.range(0.08, 0.32);
    const cr = rng.range(0.05, 0.13);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    b.color([0.55, 0.9, 0.75], 0.5).glow(0.5);
    b.cyl(x, 0, z, 0.018, 0.014, h, 5, 0);
    b.color([0.3, 1.0, 0.72]).glow(rng.range(1.6, 3.2));
    b.sphere(x, h, z, cr, cr * 0.55, cr, 7, 3, 0.5, 1);
    b.glow(0.6).disc(x, h, z, cr * 0.9, 7, -1);
    b.glow(0);
  }
});

defProp('lamparaSodio', (b) => {
  // Lámpara de cultivo colgada de un caballete
  b.color(C.steelDark);
  b.beam(-1.1, 0, 0, -1.1, 2.7, 0, 0.05, 0.05);
  b.beam(1.1, 0, 0, 1.1, 2.7, 0, 0.05, 0.05);
  b.beam(-1.1, 2.7, 0, 1.1, 2.7, 0, 0.05, 0.05);
  b.color(C.iron).cube(0, 2.48, 0, 0.9, 0.1, 0.3);
  b.color([1, 0.62, 0.22]).glow(7).cube(0, 2.44, 0, 0.8, 0.04, 0.22);
  b.glow(0);
});

defProp('senal', (b, v) => {
  // Semáforo de túnel
  b.color(C.iron).cube(0, -0.3, 0.06, 0.2, 0.6, 0.12);
  b.color(C.black);
  for (const y of [0.16, -0.02, -0.2]) b.cube(0, y - 0.07, 0.13, 0.14, 0.14, 0.04);
  b.color([1, 0.15, 0.1]).glow(v === 1 ? 0 : 6);
  b.push().translate(0, 0.16, 0.16).rotateX(Math.PI / 2).disc(0, 0, 0, 0.05, 8, 1).pop();
  b.glow(0).color([0.15, 0.3, 0.12]);
  b.push().translate(0, -0.2, 0.16).rotateX(Math.PI / 2).disc(0, 0, 0, 0.05, 8, 1).pop();
});

defProp('velas', (b, _v, rng) => {
  for (let i = 0; i < 5; i++) {
    const x = rng.range(-0.2, 0.2);
    const z = rng.range(-0.2, 0.2);
    const h = rng.range(0.06, 0.2);
    b.color(C.paper).cyl(x, 0, z, 0.02, 0.018, h, 5);
    b.color([1, 0.7, 0.3]).glow(8).sphere(x, h + 0.03, z, 0.012, 0.03, 0.012, 4, 3);
    b.glow(0);
  }
  b.color(C.paper, 0.8).disc(0, 0.004, 0, 0.3, 8, 1);
});

defProp('guirnalda', (b, _v, rng) => {
  // Ristra de bombillas entre dos postes (5 m)
  b.color(C.woodDark);
  b.beam(-2.5, 0, 0, -2.5, 2.9, 0, 0.07, 0.07);
  b.beam(2.5, 0, 0, 2.5, 2.9, 0, 0.07, 0.07);
  const path: number[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = -2.5 + t * 5;
    path.push(x, 2.85 - Math.sin(t * Math.PI) * 0.4, 0);
  }
  b.color(C.rubber).tube(path, 0.012, 3);
  const cols: RGB[] = [C.bulb, [1, 0.5, 0.3], [0.6, 0.9, 0.6], C.bulb, [0.6, 0.75, 1]];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    bulb(b, -2.5 + t * 5, 2.78 - Math.sin(t * Math.PI) * 0.4, 0, 0.04, rng.pick(cols), 6);
  }
});

// --- Tuberías y cables ------------------------------------------------------------

defProp('cables', (b, v, rng) => {
  // Mazo de cables sobre ménsulas: cubre 2,3 m de muro
  const L = 2.34;
  b.color(C.iron);
  for (const x of [-L / 2 + 0.2, L / 2 - 0.2]) {
    b.cube(x, -0.02, 0.07, 0.04, 0.04, 0.14);
    b.cube(x, -0.32, 0.07, 0.04, 0.04, 0.14);
    b.cube(x, -0.33, 0.02, 0.04, 0.36, 0.03);
  }
  const n = 3 + v;
  for (let i = 0; i < n; i++) {
    const y = i < 3 ? 0.03 + rng.range(-0.004, 0.004) : -0.27;
    const z = 0.04 + (i % 3) * 0.04;
    const sag = rng.range(0.01, 0.045);
    const r = rng.range(0.012, 0.022);
    b.color(i === 1 ? C.rustDark : C.rubber, rng.range(0.8, 1.5));
    const path: number[] = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      path.push(-L / 2 + t * L, y - Math.sin(t * Math.PI) * sag, z);
    }
    b.tube(path, r, 4);
  }
});

defProp('tuberia', (b, v, rng) => {
  const L = 2.34;
  b.color(vary(C.rust, rng, 0.2));
  b.push().translate(-L / 2, 0.1, 0.16).rotateZ(-Math.PI / 2);
  b.cyl(0, 0, 0, 0.1, 0.1, L, 8, 0);
  b.color(C.rustDark);
  b.cyl(0, L * 0.5 - 0.03, 0, 0.125, 0.125, 0.06, 8, 3);
  b.pop();
  b.color(vary(C.steel, rng, 0.15));
  b.push().translate(-L / 2, 0.38, 0.1).rotateZ(-Math.PI / 2);
  b.cyl(0, 0, 0, 0.055, 0.055, L, 6, 0);
  b.pop();
  b.color(C.iron);
  b.cube(0.6, -0.02, 0.08, 0.05, 0.5, 0.05);
  b.cube(-0.6, -0.02, 0.08, 0.05, 0.5, 0.05);
  if (v === 1) {
    // Válvula de volante
    b.color(C.red);
    b.push().translate(0.2, 0.1, 0.3).rotateX(Math.PI / 2);
    b.lathe(0, 0, 0, [0.11, 0, 0.13, 0.012, 0.11, 0.024], 10);
    b.pop();
    b.color(C.iron).cube(0.2, 0.08, 0.26, 0.04, 0.04, 0.08);
  } else if (v === 2) {
    // Fuga con mancha
    b.color(C.rustDark, 0.6).cube(-0.3, -0.5, 0.012, 0.3, 0.55, 0.01);
  }
});

// --- Almacén y defensa ----------------------------------------------------------

defProp('caja', (b, v, rng) => {
  if (v === 1) {
    // Caja de munición verde
    b.color(C.olive);
    b.box(0, 0, 0, 0.82, 0.34, 0.42);
    b.color(C.oliveDark).box(0, 0.34, 0, 0.84, 0.05, 0.44);
    b.color(C.yellow, 0.8).cube(0, 0.14, 0.212, 0.5, 0.07, 0.004);
    b.color(C.iron).cube(-0.42, 0.14, 0, 0.02, 0.05, 0.16).cube(0.42, 0.14, 0, 0.02, 0.05, 0.16);
  } else if (v === 2) {
    crate(b, 0, 0, 0, 0.62, 0.5, rng, C.woodGrey, 0.1);
  } else if (v === 3) {
    // Cajón metálico
    b.color(vary(C.steel, rng, 0.1));
    b.box(0, 0, 0, 0.9, 0.6, 0.6);
    b.color(C.steelDark);
    b.box(0, 0.6, 0, 0.94, 0.05, 0.64);
    for (const x of [-0.3, 0.3]) b.cube(x, 0.4, 0.305, 0.08, 0.14, 0.02);
  } else {
    crate(b, 0, 0, 0, 0.85, 0.75, rng, C.wood, 0);
  }
});

defProp('cajas', (b, v, rng) => {
  crate(b, -0.5, 0, -0.15, 0.85, 0.75, rng, C.wood, 0.05);
  crate(b, 0.48, 0, 0.1, 0.8, 0.7, rng, C.woodGrey, -0.12);
  crate(b, -0.1, 0.75, -0.05, 0.75, 0.65, rng, C.woodLight, 0.4);
  if (v > 0) crate(b, 0.5, 0.7, 0.05, 0.6, 0.5, rng, C.wood, 0.9);
  if (v > 1) {
    // Lona por encima
    b.color(C.tarp, 0.9);
    b.box(-0.1, 1.4, -0.05, 0.9, 0.04, 0.9);
    b.box(-0.1, 0.95, 0.41, 0.9, 0.46, 0.03);
  }
});

defProp('barril', (b, v, rng) => {
  const cols: RGB[] = [C.navy, C.rust, C.olive, C.red];
  drum(b, 0, 0, 0, cols[v % 4], rng);
});

defProp('barriles', (b, v, rng) => {
  drum(b, -0.42, 0, -0.18, C.navy, rng);
  drum(b, 0.3, 0, -0.22, C.rust, rng);
  drum(b, -0.05, 0, 0.3, C.olive, rng);
  if (v) {
    b.push().translate(0.5, 0.3, 0.3).rotateZ(Math.PI / 2).rotateY(0.3);
    drum(b, 0, -0.44, 0, C.rustDark, rng);
    b.pop();
  }
});

defProp('sacos', (b, v, rng) => {
  // Parapeto bajo de sacos terreros (2,3 m)
  const rows = 3 + (v === 2 ? 1 : 0);
  for (let r = 0; r < rows; r++) {
    const n = r % 2 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.58;
      sandbag(b, x, r * 0.2, rng.range(-0.03, 0.03), 0, rng);
    }
  }
  if (v === 1) {
    for (let i = 0; i < 4; i++) sandbag(b, (i - 1.5) * 0.58, 0, 0.34, 0, rng);
  }
});

defProp('sacosAlto', (b, v, rng) => {
  // Muro alto con tronera
  for (let r = 0; r < 8; r++) {
    const n = r % 2 ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.58;
      if (v === 1 && r >= 5 && r <= 6 && Math.abs(x) < 0.4) continue;
      sandbag(b, x, r * 0.2, rng.range(-0.03, 0.03), 0, rng);
      sandbag(b, x + 0.1, r * 0.2, 0.36 + rng.range(-0.03, 0.03), 0, rng);
    }
  }
  b.color(C.woodDark);
  if (v === 1) b.cube(0, 1.38, 0.18, 1.0, 0.06, 0.8);
});

defProp('bloque', (b, v, rng) => {
  // Bloque de hormigón tipo barrera
  const c = vary(C.concrete, rng, 0.1);
  b.color(c);
  b.prism([-1.1, -0.34, 1.1, -0.34, 1.1, 0.34, -1.1, 0.34], 0, 0.28, false);
  // Tronco trapezoidal
  const y0 = 0.28;
  const y1 = 0.95;
  b.quad(-1.1, y0, 0.34, 1.1, y0, 0.34, 1.1, y1, 0.12, -1.1, y1, 0.12, 0.85);
  b.quad(1.1, y0, -0.34, -1.1, y0, -0.34, -1.1, y1, -0.12, 1.1, y1, -0.12, 0.85);
  b.quad(1.1, y0, 0.34, 1.1, y0, -0.34, 1.1, y1, -0.12, 1.1, y1, 0.12, 0.85);
  b.quad(-1.1, y0, -0.34, -1.1, y0, 0.34, -1.1, y1, 0.12, -1.1, y1, -0.12, 0.85);
  b.quad(-1.1, y1, 0.12, 1.1, y1, 0.12, 1.1, y1, -0.12, -1.1, y1, -0.12);
  if (v === 1) {
    for (let i = 0; i < 5; i++) {
      b.color(i % 2 ? C.yellow : C.black, 0.8);
      b.quad(-1.0 + i * 0.4, 0.4, 0.31, -0.6 + i * 0.4, 0.4, 0.31, -0.6 + i * 0.4, 0.78, 0.185, -1.0 + i * 0.4, 0.78, 0.185);
    }
  }
});

defProp('alambrada', (b, _v, rng) => {
  // Caballo de Frisia con alambre de espino
  b.color(C.woodDark);
  for (const x of [-1.1, 0, 1.1]) {
    b.beam(x, 0, -0.42, x, 0.85, 0.42, 0.07, 0.07);
    b.beam(x, 0, 0.42, x, 0.85, -0.42, 0.07, 0.07);
  }
  b.beam(-1.25, 0.43, 0, 1.25, 0.43, 0, 0.07, 0.07);
  b.color(C.steelLight, 0.7);
  for (let k = 0; k < 3; k++) {
    const path: number[] = [];
    const ph = rng.range(0, 6);
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const a = t * Math.PI * 2 * 5 + ph;
      path.push(-1.2 + t * 2.4, 0.43 + Math.sin(a) * (0.3 + k * 0.05), Math.cos(a) * (0.3 + k * 0.05));
    }
    b.tube(path, 0.008, 3);
  }
});

defProp('erizo', (b, _v, rng) => {
  // Erizo checo de perfiles soldados
  b.color(vary(C.rustDark, rng, 0.2));
  b.beam(-0.6, 0.02, -0.5, 0.6, 1.0, 0.5, 0.11, 0.11);
  b.beam(0.6, 0.02, -0.5, -0.6, 1.0, 0.5, 0.11, 0.11);
  b.beam(0, 0.02, 0.7, 0, 1.0, -0.7, 0.11, 0.11);
});

defProp('nidoMG', (b, _v, rng) => {
  // Nido de ametralladora: anillo de sacos y arma pesada sobre trípode
  for (let r = 0; r < 5; r++) {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = ((i + (r % 2) * 0.5) / n) * Math.PI * 1.5 - Math.PI * 0.75 + Math.PI / 2;
      sandbag(b, Math.cos(a) * 1.05, r * 0.2, Math.sin(a) * 1.05, -a + Math.PI / 2, rng);
    }
  }
  // Trípode y arma apuntando a +Z
  b.color(C.steelDark);
  b.beam(0, 0.75, 0, 0.35, 0, 0.35, 0.035, 0.035);
  b.beam(0, 0.75, 0, -0.35, 0, 0.35, 0.035, 0.035);
  b.beam(0, 0.75, 0, 0, 0, -0.45, 0.035, 0.035);
  b.color(C.iron);
  b.cube(0, 0.74, 0.05, 0.11, 0.14, 0.6);
  b.push().translate(0, 0.83, 0.35).rotateX(Math.PI / 2);
  b.cyl(0, 0, 0, 0.022, 0.022, 0.75, 6);
  b.cyl(0, 0.68, 0, 0.035, 0.035, 0.1, 6);
  b.pop();
  b.color(C.olive).cube(0.14, 0.62, 0.05, 0.16, 0.2, 0.26);
  b.color(C.woodDark).cube(0, 0.72, -0.34, 0.05, 0.1, 0.16);
});

defProp('garita', (b, _v, rng) => {
  const c = vary(C.olive, rng, 0.08);
  b.color(c);
  // Paredes con ventanas
  b.box(0, 0, -0.72, 1.5, 2.2, 0.06);
  b.box(-0.72, 0, 0, 0.06, 2.2, 1.5);
  b.box(0.72, 0, 0, 0.06, 2.2, 1.5);
  b.box(-0.5, 0, 0.72, 0.5, 2.2, 0.06);
  b.box(0.5, 1.0, 0.72, 0.5, 0.2, 0.06);
  b.box(0.5, 0, 0.72, 0.5, 1.0, 0.06);
  b.box(0.5, 1.9, 0.72, 0.5, 0.3, 0.06);
  b.color(C.rustDark).box(0, 2.2, 0, 1.8, 0.08, 1.8, 0b111111);
  b.color(C.bulb).glow(2.5).cube(0.5, 1.2, 0.7, 0.44, 0.7, 0.02);
  b.glow(0);
  // Franjas
  for (let i = 0; i < 5; i++) {
    b.color(i % 2 ? C.white : C.red, 0.85);
    b.cube(-0.72 + 0.15 + i * 0.3, 0, -0.755, 0.3, 0.5, 0.01);
  }
});

defProp('barrera', (b) => {
  // Barrera levadiza (levantada)
  b.color(C.concreteDark).box(0, 0, 0, 0.4, 0.5, 0.4);
  b.color(C.steelDark).box(0, 0.5, 0, 0.18, 0.7, 0.18);
  b.push().translate(0, 1.15, 0).rotateZ(1.1);
  for (let i = 0; i < 8; i++) {
    b.color(i % 2 ? C.white : C.red, 0.9);
    b.cube(0.2 + i * 0.42, -0.04, 0, 0.42, 0.09, 0.07);
  }
  b.color(C.iron).cube(-0.4, -0.1, 0, 0.5, 0.2, 0.16);
  b.pop();
});

defProp('palet', (b, v, rng) => {
  // Palé con mercancía
  b.color(C.woodGrey);
  for (const z of [-0.45, 0, 0.45]) b.cube(0, 0, z, 1.2, 0.1, 0.1);
  for (let i = 0; i < 6; i++) plank(b, -0.5 + i * 0.2, 0.1, 0, 0.16, 0.025, 1.0, rng, C.woodGrey);
  if (v === 0) {
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) sandbag(b, -0.3 + k * 0.6, 0.13 + i * 0.2, (i % 2) * 0.1 - 0.05, 0, rng, 0.6, C.paper);
  } else if (v === 1) {
    crate(b, -0.28, 0.125, 0, 0.55, 0.5, rng, C.wood);
    crate(b, 0.3, 0.125, 0.1, 0.5, 0.42, rng, C.woodLight, 0.2);
  } else {
    drum(b, -0.3, 0.125, -0.15, C.navy, rng);
    drum(b, 0.3, 0.125, 0.15, C.red, rng);
  }
});

defProp('bobina', (b, _v, rng) => {
  // Bobina de cable tumbada
  b.color(vary(C.wood, rng, 0.12));
  b.cyl(0, 0, 0, 0.6, 0.6, 0.06, 14, 3);
  b.cyl(0, 0.66, 0, 0.6, 0.6, 0.06, 14, 3);
  b.color(C.rubber, 1.4).cyl(0, 0.06, 0, 0.4, 0.4, 0.6, 12, 0);
  b.color(C.woodDark).cyl(0, 0.72, 0, 0.08, 0.08, 0.02, 6);
});

defProp('escombros', (b, v, rng) => {
  const n = 7 + v * 3;
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, 6.28);
    const r = rng.range(0, 0.75);
    const s = rng.range(0.14, 0.42) * (1 - r * 0.4);
    b.color(vary(i % 3 ? C.concrete : C.concreteDark, rng, 0.2));
    const v0 = b.vcount;
    b.push().translate(Math.cos(a) * r, 0, Math.sin(a) * r).rotateY(rng.range(0, 3));
    b.box(0, 0, 0, s * 1.4, s, s * 1.1, 0b111111);
    b.pop();
    b.jitter(v0, s * 0.35, i * 7 + v);
  }
  // Armaduras retorcidas
  b.color(C.rustDark);
  for (let i = 0; i < 2 + v; i++) {
    const a = rng.range(0, 6.28);
    b.tube([Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3, Math.cos(a) * 0.5, 0.5, Math.sin(a) * 0.4, Math.cos(a + 0.5) * 0.7, 0.7, Math.sin(a + 0.5) * 0.6], 0.012, 3);
  }
});

defProp('chatarra', (b, v, rng) => {
  // Montón de chatarra: chapas, tubos, ruedas y una carcasa
  for (let i = 0; i < 9 + v * 2; i++) {
    const a = rng.range(0, 6.28);
    const r = rng.range(0, 0.95);
    const s = rng.range(0.3, 0.75);
    b.color(vary(rng.pick([C.rust, C.rustDark, C.steel, C.rustLight, C.steelDark]), rng, 0.2));
    b.push().translate(Math.cos(a) * r, rng.range(0, 0.4) * (1 - r), Math.sin(a) * r).rotateY(rng.range(0, 6)).rotateX(rng.range(-0.6, 0.6)).rotateZ(rng.range(-0.5, 0.5));
    const kind = rng.int(0, 3);
    if (kind === 0) b.cube(0, 0, 0, s, 0.03, s * 0.7);
    else if (kind === 1) b.cyl(0, 0, 0, 0.05, 0.05, s * 1.6, 6, 3);
    else if (kind === 2) b.lathe(0, 0, 0, [0.12, 0, 0.26, 0.02, 0.28, 0.1, 0.26, 0.18, 0.12, 0.2], 10);
    else b.box(0, 0, 0, s * 0.7, s * 0.45, s * 0.5, 0b111111);
    b.pop();
  }
  b.color(C.rubber);
  b.push().translate(0.5, 0.12, -0.4).rotateX(1.2);
  b.lathe(0, 0, 0, [0.18, 0, 0.3, 0.03, 0.32, 0.1, 0.3, 0.17, 0.18, 0.2], 10);
  b.pop();
});
