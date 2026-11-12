// Piezas de asentamiento: tiendas, barracones, vagones, puestos, muebles,
// talleres, cultivos y enseres de la vida en los andenes.

import { C, bulb, cloth, crate, defProp, drum, plank, sandbag, vary, type MeshBuilder, type RGB, type Rng } from './core';

/** Lona tensada entre cuatro puntos (dos faldones a dos aguas). */
function ridgeTent(b: MeshBuilder, w: number, d: number, h: number, wall: number, col: RGB, rng: Rng, open = true) {
  const hw = w / 2;
  const hd = d / 2;
  const c = vary(col, rng, 0.1);
  // Faldones
  for (const s of [-1, 1]) {
    b.color(c, s > 0 ? 1 : 0.86);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const x0 = -hw + (w * i) / n;
      const x1 = -hw + (w * (i + 1)) / n;
      // Ligera comba entre apoyos
      const sag0 = Math.sin((i / n) * Math.PI) * 0.06;
      const sag1 = Math.sin(((i + 1) / n) * Math.PI) * 0.06;
      if (s > 0) b.quad(x0, wall, hd, x1, wall, hd, x1, h - sag1, 0, x0, h - sag0, 0, 0.82);
      else b.quad(x1, wall, -hd, x0, wall, -hd, x0, h - sag0, 0, x1, h - sag1, 0, 0.82);
    }
    // Paredes bajas
    b.color(c, 0.78);
    if (s > 0) b.quad(-hw, 0, hd, hw, 0, hd, hw, wall, hd, -hw, wall, hd, 0.75);
    else b.quad(hw, 0, -hd, -hw, 0, -hd, -hw, wall, -hd, hw, wall, -hd, 0.75);
  }
  // Hastiales: el delantero con la entrada abierta
  for (const s of [-1, 1]) {
    const x = s * hw;
    b.color(c, 0.7);
    const front = s > 0 && open;
    const door = front ? 0.5 : 0;
    const tri = (z0: number, z1: number) => {
      const y0 = wall + (h - wall) * (1 - Math.abs(z0) / hd);
      const y1 = wall + (h - wall) * (1 - Math.abs(z1) / hd);
      if (s > 0) b.quad(x, 0, z1, x, 0, z0, x, y0, z0, x, y1, z1, 0.7);
      else b.quad(x, 0, z0, x, 0, z1, x, y1, z1, x, y0, z0, 0.7);
    };
    if (front) {
      tri(-hd, -door);
      tri(door, hd);
      // Interior oscuro y cálido
      b.color([0.09, 0.06, 0.04]).glow(0.35);
      b.quad(x - 0.04, 0, door, x - 0.04, 0, -door, x - 0.04, h - 0.25, -0.05, x - 0.04, h - 0.25, 0.05);
      b.glow(0);
    } else {
      tri(-hd, 0);
      tri(0, hd);
    }
  }
  // Costuras, cumbrera y remiendos
  const slope = Math.atan2(h - wall, hd);
  b.color(c, 0.7);
  const seams = Math.max(2, Math.round(w / 0.9));
  for (const s of [-1, 1]) {
    for (let i = 1; i < seams; i++) {
      const x = -hw + (w * i) / seams;
      b.beam(x, wall + 0.012, s * hd, x, h - 0.045, 0, 0.03, 0.012);
    }
    b.beam(-hw, wall + 0.01, s * (hd + 0.006), hw, wall + 0.01, s * (hd + 0.006), 0.012, 0.05);
  }
  b.color(c, 0.6).beam(-hw - 0.03, h + 0.004, 0, hw + 0.03, h + 0.004, 0, 0.1, 0.02);
  const patches = 2 + Math.floor(rng.next() * 3);
  for (let i = 0; i < patches; i++) {
    const s = rng.chance(0.5) ? 1 : -1;
    const k = rng.range(0.2, 0.8);
    b.push().translate(rng.range(-hw + 0.4, hw - 0.4), wall + (h - wall) * k + 0.01, s * hd * (1 - k)).rotateX(s * slope).rotateY(rng.range(-0.3, 0.3));
    b.color(vary(rng.pick([C.canvasDark, C.burlap, C.cloth, C.canvasGrey]), rng, 0.2));
    b.cube(0, 0, 0, rng.range(0.25, 0.5), 0.012, rng.range(0.22, 0.4));
    b.pop();
  }
  if (open) {
    // Faldón recogido y farol en la puerta
    const x = hw;
    b.color(c, 1.08);
    b.triangle(x + 0.02, 0, 0.5, x + 0.28, 0, 0.98, x + 0.02, h - 0.4, 0.07);
    b.triangle(x + 0.28, 0, 0.98, x + 0.02, 0, 0.5, x + 0.02, h - 0.4, 0.07);
    b.color(C.iron).cube(x + 0.13, h - 0.42, 0, 0.07, 0.03, 0.07);
    bulb(b, x + 0.13, h - 0.5, 0, 0.04, C.bulb, 3.5);
  }
  // Palos, vientos y piquetas
  b.color(C.woodDark);
  b.cyl(hw - 0.02, 0, 0, 0.03, 0.03, h + 0.12, 5);
  b.cyl(-hw + 0.02, 0, 0, 0.03, 0.03, h + 0.12, 5);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      b.color(C.burlap, 0.7).tube([sx * hw, wall, sz * hd, sx * (hw + 0.35), 0.02, sz * (hd + 0.4)], 0.008, 3);
      b.color(C.woodDark).cyl(sx * (hw + 0.35), 0, sz * (hd + 0.4), 0.02, 0.012, 0.14, 4);
    }
  }
}

defProp('tienda', (b, v, rng) => {
  const cols = [C.canvas, C.canvasGreen, C.canvasGrey, C.tarp];
  ridgeTent(b, 2.7, 2.2, 1.75, 0.5, cols[v % 4], rng);
  // Remiendos y franja teñible
  b.color(C.tint, 0.6).tinted(1);
  b.quad(-1.36, 0.42, 1.105, 1.36, 0.42, 1.105, 1.36, 0.52, 1.105, -1.36, 0.52, 1.105);
  b.tinted(0);
  if (v === 1) {
    b.color(C.clothRed, 0.7);
    b.quad(-0.4, 0.75, 0.86, 0.1, 0.72, 0.87, 0.12, 1.02, 0.65, -0.38, 1.05, 0.63);
  }
  if (v >= 2) crate(b, -1.0, 0, 1.45, 0.45, 0.4, rng, C.woodGrey, 0.3);
});

defProp('tiendaGrande', (b, v, rng) => {
  ridgeTent(b, 5.8, 4.0, 2.7, 1.5, v === 0 ? C.white : C.canvasGreen, rng);
  // Palos centrales
  b.color(C.woodDark);
  for (const x of [-1.4, 1.4]) b.cyl(x, 0, 0, 0.04, 0.04, 2.7, 5);
  if (v === 0) {
    // Cruz roja del hospital
    b.color(C.red);
    for (const s of [-1, 1]) {
      b.push().translate(0, 2.05, s * 1.02).rotateX(s * -0.53);
      b.box(0, -0.3, 0, 0.22, 0.7, 0.02, 0b111111);
      b.box(0, -0.06, 0, 0.7, 0.22, 0.021, 0b111111);
      b.pop();
    }
  } else {
    b.color(C.tint, 0.75).tinted(1);
    b.quad(-2.9, 1.2, 2.005, 2.9, 1.2, 2.005, 2.9, 1.42, 2.005, -2.9, 1.42, 2.005);
    b.tinted(0);
  }
});

defProp('barracon', (b, v, rng) => {
  // Chabola de chapa, tablones y lona
  const w = 3.6;
  const d = 2.8;
  const h = 2.3;
  const sheet = [C.rust, C.steel, C.rustLight, C.enamelGreen][v % 4];
  const wall = (x0: number, z0: number, x1: number, z1: number, plankWall: boolean) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(2, Math.round(len / 0.55));
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const hh = h + rng.range(-0.12, 0.1);
      b.color(vary(plankWall ? C.woodGrey : sheet, rng, 0.16));
      const ax = x0 + (x1 - x0) * t0;
      const az = z0 + (z1 - z0) * t0;
      const bx = x0 + (x1 - x0) * t1;
      const bz = z0 + (z1 - z0) * t1;
      b.quad(ax, 0, az, bx, 0, bz, bx, hh, bz, ax, hh, az, 0.7);
    }
  };
  wall(-w / 2, d / 2, -0.55, d / 2, v % 2 === 0);
  wall(0.55, d / 2, w / 2, d / 2, v % 2 === 0);
  wall(w / 2, d / 2, w / 2, -d / 2, false);
  wall(w / 2, -d / 2, -w / 2, -d / 2, true);
  wall(-w / 2, -d / 2, -w / 2, d / 2, false);
  // Dintel y puerta de lona
  b.color(C.woodDark).cube(0, 1.95, d / 2, 1.3, 0.14, 0.1);
  b.color(C.canvasDark);
  cloth(b, -0.55, 1.95, d / 2 + 0.02, 0.2, 1.95, d / 2 + 0.02, 1.7, 4, 0.05, rng);
  b.color([0.1, 0.07, 0.04]).glow(0.5).quad(0.2, 0, d / 2 - 0.02, 0.55, 0, d / 2 - 0.02, 0.55, 1.9, d / 2 - 0.02, 0.2, 1.9, d / 2 - 0.02);
  b.glow(0);
  // Tejado inclinado de chapa con piedras
  b.push().translate(0, h + 0.05, 0).rotateX(0.09);
  for (let i = 0; i < 4; i++) {
    const rc = vary(i % 2 ? C.rustDark : sheet, rng, 0.15);
    const cx = -w / 2 + 0.47 + i * 0.94;
    b.color(rc).cube(cx, i % 2 ? 0.012 : 0, 0, 1.0, 0.035, d + 0.5 - (i % 2) * 0.12);
    // Ondas de la chapa
    b.color(rc, 0.72);
    for (let k = 0; k < 5; k++) b.cube(cx - 0.4 + k * 0.2, 0.035 + (i % 2) * 0.012, 0, 0.035, 0.018, d + 0.44 - (i % 2) * 0.12);
  }
  // Un neumático y un remiendo de lona para las goteras
  b.color(C.rubber, 1.4).lathe(-0.9, 0.05, 0.5, [0.14, 0.02, 0.28, 0, 0.33, 0.07, 0.28, 0.14, 0.14, 0.12], 10);
  b.color(vary(C.tarp, rng, 0.15)).cube(0.9, 0.056, -0.5, 1.1, 0.012, 0.8);
  b.pop();
  // Ventanuco iluminado en un lateral
  b.color([1, 0.7, 0.36]).glow(1.5);
  b.quad(w / 2 + 0.006, 1.25, 0.35, w / 2 + 0.006, 1.25, -0.35, w / 2 + 0.006, 1.7, -0.35, w / 2 + 0.006, 1.7, 0.35);
  b.glow(0).color(C.woodDark);
  b.cube(w / 2 + 0.01, 1.2, 0, 0.03, 0.05, 0.8).cube(w / 2 + 0.01, 1.7, 0, 0.03, 0.05, 0.8).cube(w / 2 + 0.012, 1.25, 0, 0.02, 0.45, 0.04);
  b.color(C.stone);
  for (let i = 0; i < 4; i++) b.sphere(rng.range(-1.4, 1.4), h + 0.16, rng.range(-1, 1), 0.14, 0.09, 0.12, 5, 3);
  // Chimenea de tubo
  b.color(C.rustDark).cyl(1.2, h, -0.8, 0.07, 0.07, 0.9, 6);
  if (v >= 2) {
    b.color(C.tint, 0.7).tinted(1).cube(-1.2, 1.5, d / 2 + 0.012, 0.6, 0.4, 0.01);
    b.tinted(0);
  }
});

defProp('vagon', (b, v, rng) => {
  // Vagón de metro soviético reconvertido en vivienda (19 m)
  const L = 18.8;
  const W = 2.7;
  const body = v === 0 ? vary([0.16, 0.3, 0.42], rng, 0.08) : v === 1 ? vary(C.rust, rng, 0.1) : vary([0.22, 0.34, 0.26], rng, 0.08);
  // Bogies y bajos
  b.color(C.iron);
  for (const x of [-6.2, 6.2]) {
    b.cube(x, 0.12, 0, 2.6, 0.5, 2.0);
    for (const dx of [-0.8, 0.8]) for (const z of [-0.76, 0.76]) {
      b.push().translate(x + dx, 0.42, z - 0.06).rotateX(Math.PI / 2);
      b.cyl(0, 0, 0, 0.4, 0.4, 0.12, 12, 3);
      b.pop();
    }
  }
  b.color(C.steelDark).cube(0, 0.55, 0, L - 0.6, 0.22, W - 0.5);
  // Caja: franja inferior, ventanas y techo
  b.color(body).box(0, 0.77, 0, L, 0.95, W, 0b110011);
  b.color([0.85, 0.82, 0.74], 0.75);
  b.box(0, 1.72, 0, L, 0.12, W, 0b110011);
  // Montantes y ventanas (algunas iluminadas, otras tapiadas)
  const nWin = 13;
  for (const s of [-1, 1]) {
    for (let i = 0; i < nWin; i++) {
      const x = -L / 2 + 0.9 + (i * (L - 1.8)) / (nWin - 1);
      const door = i === 2 || i === 6 || i === 10;
      const lit = rng.chance(0.35);
      const boarded = !lit && rng.chance(0.4);
      b.color(body, 0.92);
      b.cube(x - 0.62, 1.84, s * (W / 2 - 0.03), 0.16, 0.86, 0.06);
      if (door) {
        b.color(body, 0.8).cube(x, 0.77, s * (W / 2 + 0.01), 1.0, 1.93, 0.04);
        b.color([0.05, 0.05, 0.06]).cube(x, 1.9, s * (W / 2 + 0.035), 0.7, 0.6, 0.01);
      } else {
        if (boarded) b.color(vary(C.woodGrey, rng, 0.2));
        else if (lit) b.color([1, 0.72, 0.38]).glow(1.4);
        else b.color([0.04, 0.05, 0.06]);
        b.cube(x, 1.84, s * (W / 2 - 0.02), 1.08, 0.86, 0.05);
        b.glow(0);
      }
    }
    b.color(body, 0.95).cube(0, 2.7, s * (W / 2 - 0.03), L, 0.2, 0.06);
  }
  // Testeros
  for (const s of [-1, 1]) {
    b.color(body, 0.85).cube(s * (L / 2 - 0.03), 0.77, 0, 0.06, 2.13, W);
    b.color([0.05, 0.06, 0.07]).cube(s * (L / 2 + 0.005), 1.9, 0, 0.01, 0.7, 1.9);
    b.color([1, 0.9, 0.6]).glow(v === 0 ? 2 : 0);
    for (const z of [-0.9, 0.9]) b.cube(s * (L / 2 + 0.01), 1.05, z, 0.02, 0.16, 0.22);
    b.glow(0);
  }
  // Techo abombado
  b.color([0.3, 0.31, 0.32]);
  const rs = 6;
  for (let i = 0; i < rs; i++) {
    const a0 = (i / rs) * Math.PI;
    const a1 = ((i + 1) / rs) * Math.PI;
    b.quad(-L / 2, 2.9 + Math.sin(a0) * 0.38, Math.cos(a0) * W * 0.5, L / 2, 2.9 + Math.sin(a0) * 0.38, Math.cos(a0) * W * 0.5, L / 2, 2.9 + Math.sin(a1) * 0.38, Math.cos(a1) * W * 0.5, -L / 2, 2.9 + Math.sin(a1) * 0.38, Math.cos(a1) * W * 0.5);
  }
  // Vida: chimenea, ropa tendida, escalerilla
  b.color(C.rustDark).cyl(3, 3.2, 0.4, 0.08, 0.08, 0.8, 6);
  b.color(C.woodGrey);
  for (const x of [-5.1, 0.2, 5.5]) {
    b.cube(x, 0, W / 2 + 0.5, 0.9, 0.25, 0.5);
    b.cube(x, 0.25, W / 2 + 0.3, 0.9, 0.25, 0.3);
  }
  b.color(C.tint, 0.7).tinted(1).cube(-8.2, 1.15, W / 2 + 0.012, 1.4, 0.5, 0.01);
  b.tinted(0);
});

defProp('puesto', (b, v, rng) => {
  // Puesto de mercado con toldo
  const cols = [C.clothRed, C.clothBlue, C.clothGreen, C.canvas, C.yellow];
  b.color(C.woodDark);
  for (const x of [-1.2, 1.2]) for (const z of [-0.6, 0.6]) b.cyl(x, 0, z, 0.04, 0.04, z < 0 ? 2.35 : 2.05, 5);
  // Mostrador
  for (let i = 0; i < 5; i++) plank(b, -1.0 + i * 0.5, 0.82, 0.45, 0.48, 0.05, 0.5, rng, C.wood);
  b.color(C.woodGrey, 0.8).cube(0, 0, 0.66, 2.3, 0.82, 0.05);
  // Toldo a rayas
  const tc = cols[v % 5];
  for (let i = 0; i < 6; i++) {
    b.color(i % 2 ? tc : C.white, i % 2 ? 1 : 0.8);
    const x0 = -1.35 + i * 0.45;
    b.quad(x0, 2.0, 0.85, x0 + 0.45, 2.0, 0.85, x0 + 0.45, 2.38, -0.7, x0, 2.38, -0.7);
    b.quad(x0 + 0.45, 2.0, 0.85, x0, 2.0, 0.85, x0, 2.38, -0.7, x0 + 0.45, 2.38, -0.7);
    b.quad(x0, 1.85, 0.86, x0 + 0.45, 1.85, 0.86, x0 + 0.45, 2.0, 0.85, x0, 2.0, 0.85);
  }
  // Mercancía según el tipo de puesto
  if (v === 0) {
    for (let i = 0; i < 4; i++) {
      b.color(vary(C.mushroom, rng, 0.2));
      b.sphere(-0.8 + i * 0.5, 0.94, 0.45, 0.16, 0.08, 0.14, 7, 3);
    }
    crate(b, -0.9, 0, -0.2, 0.5, 0.45, rng);
  } else if (v === 1) {
    b.color(C.iron);
    for (let i = 0; i < 4; i++) b.cube(-0.8 + i * 0.5, 0.87, 0.45, 0.07, 0.04, 0.42);
    b.color(C.olive).cube(0.6, 0, -0.2, 0.8, 0.35, 0.42);
    b.color(C.wood).cube(-0.2, 0.92, 0.3, 0.9, 0.04, 0.08);
  } else if (v === 2) {
    for (let i = 0; i < 4; i++) {
      b.color(vary(rng.pick([C.cloth, C.clothBlue, C.clothGreen, C.canvasDark]), rng, 0.15));
      b.cube(-0.8 + i * 0.5, 0.87, 0.45, 0.4, 0.06 + i * 0.02, 0.36);
    }
    b.color(C.woodDark).beam(-1.2, 1.7, -0.55, 1.2, 1.7, -0.55, 0.03, 0.03);
    for (let i = 0; i < 4; i++) {
      b.color(vary(rng.pick([C.olive, C.leather, C.cloth]), rng, 0.15));
      b.cube(-0.9 + i * 0.6, 1.05, -0.55, 0.4, 0.62, 0.06);
    }
  } else if (v === 3) {
    for (let i = 0; i < 5; i++) {
      b.color(vary(rng.pick([C.rust, C.steel, C.copper]), rng, 0.2));
      b.cyl(-0.9 + i * 0.42, 0.87, 0.45, 0.07, 0.09, 0.14, 7);
    }
    drum(b, 0.8, 0, -0.25, C.rustDark, rng);
  } else {
    b.color(C.glass, 0.8);
    for (let i = 0; i < 6; i++) b.cyl(-0.9 + i * 0.35, 0.87, 0.42 + (i % 2) * 0.12, 0.04, 0.03, 0.2 + (i % 3) * 0.05, 6);
    b.color(C.paper).cube(0.5, 0.87, 0.3, 0.3, 0.02, 0.22);
  }
  bulb(b, 0, 1.95, 0.2, 0.05, C.bulb, 6);
  b.color(C.rubber).tube([0, 2.0, 0.2, 0, 2.25, -0.1], 0.006, 3);
});

defProp('mesa', (b, v, rng) => {
  for (let i = 0; i < 3; i++) plank(b, 0, 0.74, -0.27 + i * 0.27, 1.4, 0.045, 0.26, rng, C.wood);
  b.color(C.woodDark);
  for (const x of [-0.6, 0.6]) for (const z of [-0.32, 0.32]) b.cube(x, 0, z, 0.06, 0.74, 0.06);
  if (v === 1) {
    // Mesa de estudio: libros, papeles y un flexo
    b.color(C.paper).cube(-0.2, 0.79, 0.05, 0.3, 0.008, 0.22);
    b.color(C.clothRed, 0.8).cube(0.35, 0.79, -0.1, 0.2, 0.07, 0.26);
    b.color(C.clothBlue, 0.7).cube(0.36, 0.86, -0.1, 0.18, 0.05, 0.24);
    b.color(C.iron).tube([-0.55, 0.79, -0.25, -0.55, 1.1, -0.25, -0.35, 1.18, -0.1], 0.012, 4);
    bulb(b, -0.33, 1.14, -0.08, 0.04, C.bulb, 6);
  } else {
    b.color(C.steelDark).cyl(0.3, 0.79, 0.1, 0.08, 0.07, 0.08, 7);
    b.color(C.glass).cyl(-0.3, 0.79, -0.1, 0.035, 0.03, 0.2, 6);
  }
});

defProp('banco', (b, _v, rng) => {
  plank(b, 0, 0.42, 0, 1.6, 0.05, 0.3, rng, C.woodGrey);
  b.color(C.iron);
  for (const x of [-0.65, 0.65]) b.cube(x, 0, 0, 0.06, 0.42, 0.3);
});

defProp('taburete', (b, v, rng) => {
  if (v === 0) crate(b, 0, 0, 0, 0.4, 0.42, rng, C.woodGrey, rng.range(0, 1));
  else {
    b.color(vary(C.rustDark, rng, 0.2)).cyl(0, 0, 0, 0.2, 0.2, 0.42, 9, 3);
  }
});

defProp('cama', (b, v, rng) => {
  if (v === 1) {
    // Jergón en el suelo
    b.color(vary(C.canvasDark, rng, 0.15)).cube(0, 0, 0, 1.9, 0.1, 0.8);
    b.color(vary(C.cloth, rng, 0.2)).cube(-0.15, 0.1, 0, 1.3, 0.06, 0.78);
    b.color(C.paper, 0.7).cube(0.75, 0.1, 0, 0.3, 0.09, 0.5);
    return;
  }
  // Catre de tubo
  b.color(C.steelDark);
  for (const x of [-0.95, 0.95]) for (const z of [-0.4, 0.4]) b.cyl(x, 0, z, 0.02, 0.02, x > 0 ? 0.75 : 0.5, 5);
  b.beam(0.95, 0.72, -0.4, 0.95, 0.72, 0.4, 0.03, 0.03);
  b.color(vary(C.canvas, rng, 0.1)).cube(0, 0.36, 0, 1.9, 0.1, 0.8);
  b.color(vary(C.clothBlue, rng, 0.2)).cube(-0.2, 0.46, 0, 1.4, 0.05, 0.78);
  b.color(C.paper, 0.75).cube(0.72, 0.46, 0, 0.32, 0.09, 0.5);
});

defProp('litera', (b, _v, rng) => {
  b.color(C.woodDark);
  for (const x of [-0.95, 0.95]) for (const z of [-0.45, 0.45]) b.cube(x, 0, z, 0.07, 1.7, 0.07);
  for (const y of [0.35, 1.2]) {
    b.color(vary(C.woodGrey, rng, 0.1)).cube(0, y, 0, 1.9, 0.06, 0.9);
    b.color(vary(rng.pick([C.clothBlue, C.cloth, C.clothGreen]), rng, 0.2)).cube(-0.15, y + 0.06, 0, 1.5, 0.07, 0.82);
    b.color(C.paper, 0.7).cube(0.75, y + 0.06, 0, 0.3, 0.09, 0.5);
  }
});

defProp('estufa', (b) => {
  // Burzhuika: estufa de bidón con tubo
  b.color(C.iron).cyl(0, 0.18, 0, 0.3, 0.3, 0.55, 10, 3);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.283;
    b.cube(Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24, 0.04, 0.18, 0.04);
  }
  b.color(C.ember).glow(4);
  b.push().translate(0, 0.36, 0.3).rotateX(Math.PI / 2).disc(0, 0, 0, 0.09, 8, 1).pop();
  b.glow(0).color(C.rustDark);
  b.tube([0, 0.73, 0, 0, 1.9, 0, 0.4, 2.3, 0, 0.4, 3.2, 0], 0.055, 6);
});

defProp('olla', (b, _v, rng) => {
  // Olla colgada sobre brasas
  b.color(C.soot).disc(0, 0.012, 0, 0.5, 10, 1);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.283;
    b.color(vary(C.stone, rng, 0.2)).sphere(Math.cos(a) * 0.4, 0.07, Math.sin(a) * 0.4, 0.11, 0.08, 0.1, 5, 3);
  }
  b.color(C.ember).glow(4);
  for (let i = 0; i < 5; i++) b.sphere(rng.range(-0.2, 0.2), 0.05, rng.range(-0.2, 0.2), 0.06, 0.035, 0.06, 5, 3);
  b.glow(0).color(C.iron);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * 6.283 + 0.5;
    b.beam(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55, 0, 1.45, 0, 0.03, 0.03);
  }
  b.tube([0, 1.42, 0, 0, 0.85, 0], 0.008, 3);
  b.color(C.soot, 1.6).lathe(0, 0.45, 0, [0.12, 0, 0.24, 0.08, 0.27, 0.3, 0.24, 0.4], 10, false, true);
  b.color(C.mushroomCap, 0.8).disc(0, 0.8, 0, 0.23, 10, 1);
});

defProp('tendedero', (b, _v, rng) => {
  b.color(C.woodDark);
  b.cyl(-1.6, 0, 0, 0.03, 0.03, 2.0, 5);
  b.cyl(1.6, 0, 0, 0.03, 0.03, 2.0, 5);
  b.color(C.burlap).tube([-1.6, 1.95, 0, 0, 1.85, 0, 1.6, 1.95, 0], 0.007, 3);
  for (let i = 0; i < 5; i++) {
    b.color(vary(rng.pick([C.cloth, C.clothBlue, C.white, C.clothRed, C.canvas]), rng, 0.2));
    const x = -1.25 + i * 0.6;
    cloth(b, x, 1.88, 0, x + 0.42, 1.88, 0, rng.range(0.4, 0.8), 3, 0.03, rng);
  }
});

defProp('alfombra', (b, v, rng) => {
  const base = [C.clothRed, C.clothGreen, C.clothBlue][v % 3];
  b.color(base, 0.9).cube(0, 0, 0, 1.9, 0.02, 1.2);
  b.color(C.yellow, 0.7).cube(0, 0.021, 0, 1.6, 0.002, 0.95);
  b.color(base, 0.7).cube(0, 0.024, 0, 1.3, 0.002, 0.7);
  b.color(C.white, 0.7);
  for (let i = 0; i < 3; i++) b.cube(-0.4 + i * 0.4, 0.027, 0, 0.14, 0.002, 0.3);
  void rng;
});

defProp('estanteria', (b, v, rng) => {
  b.color(C.woodDark);
  for (const x of [-0.85, 0.85]) b.cube(x, 0, 0, 0.06, 1.9, 0.4);
  for (let i = 0; i < 4; i++) {
    plank(b, 0, 0.1 + i * 0.55, 0, 1.7, 0.04, 0.4, rng, C.woodGrey);
    for (let k = 0; k < 4; k++) {
      const x = -0.65 + k * 0.42 + rng.range(-0.05, 0.05);
      const kind = (i + k + v) % 4;
      if (kind === 0) crate(b, x, 0.14 + i * 0.55, 0, 0.3, 0.28, rng, C.wood, rng.range(0, 0.3));
      else if (kind === 1) {
        b.color(vary(rng.pick([C.rust, C.steel, C.olive]), rng, 0.2)).cyl(x, 0.14 + i * 0.55, 0, 0.09, 0.09, 0.26, 7);
      } else if (kind === 2) {
        b.color(vary(rng.pick([C.clothRed, C.clothBlue, C.paper]), rng, 0.2)).cube(x, 0.14 + i * 0.55, 0, 0.3, 0.2, 0.24);
      } else {
        b.color(C.glass);
        for (let q = 0; q < 3; q++) b.cyl(x - 0.1 + q * 0.1, 0.14 + i * 0.55, 0, 0.035, 0.03, 0.22, 6);
      }
    }
  }
});

defProp('barra', (b, _v, rng) => {
  // Barra de bar con botellas y barril
  b.color(C.woodDark).box(0, 0, 0, 3.2, 1.0, 0.6);
  for (let i = 0; i < 6; i++) plank(b, -1.35 + i * 0.54, 1.0, 0, 0.52, 0.05, 0.72, rng, C.wood);
  b.color(C.glass);
  for (let i = 0; i < 7; i++) b.cyl(-1.2 + i * 0.32 + rng.range(-0.05, 0.05), 1.05, rng.range(-0.15, 0.15), 0.035, 0.03, 0.24, 6);
  b.color(C.steelDark).cyl(1.3, 1.05, 0, 0.09, 0.08, 0.12, 8);
  drum(b, -1.9, 0, 0.0, C.woodDark, rng);
  b.color(C.brass).cyl(-1.9, 0.5, 0.3, 0.03, 0.03, 0.1, 5);
});

/** Emblemas de facción en relieve sobre un paño (centrados en el origen, plano XY, z hacia fuera). */
function emblem(b: MeshBuilder, v: number, s: number) {
  const z = 0.012;
  const bar = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * w * 0.5;
    const ny = (dx / l) * w * 0.5;
    b.quad((x0 - nx) * s, (y0 - ny) * s, z, (x1 - nx) * s, (y1 - ny) * s, z, (x1 + nx) * s, (y1 + ny) * s, z, (x0 + nx) * s, (y0 + ny) * s, z);
  };
  const ring = (r: number, w: number, n = 16) => {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 6.283;
      const a1 = ((i + 1) / n) * 6.283;
      bar(Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r, w);
    }
  };
  b.color(C.white);
  switch (v) {
    case 0: {
      // Unión: estrella de cinco puntas
      for (let i = 0; i < 5; i++) {
        const a0 = Math.PI / 2 + (i / 5) * 6.283;
        const a1 = a0 + 6.283 / 10;
        const a2 = a0 - 6.283 / 10;
        b.triangle(0, 0, z, Math.cos(a2) * 0.2 * s, Math.sin(a2) * 0.2 * s, z, Math.cos(a0) * 0.5 * s, Math.sin(a0) * 0.5 * s, z);
        b.triangle(0, 0, z, Math.cos(a0) * 0.5 * s, Math.sin(a0) * 0.5 * s, z, Math.cos(a1) * 0.2 * s, Math.sin(a1) * 0.2 * s, z);
      }
      break;
    }
    case 1:
      // Seguidores: tridente
      bar(0, -0.5, 0, 0.5, 0.1);
      bar(-0.3, 0.05, -0.3, 0.45, 0.09);
      bar(0.3, 0.05, 0.3, 0.45, 0.09);
      bar(-0.3, 0.07, 0.3, 0.07, 0.09);
      bar(-0.16, -0.28, 0.16, -0.28, 0.08);
      break;
    case 2:
      // Levantamiento: rueda dentada
      b.color(C.yellow);
      ring(0.3, 0.1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283;
        bar(Math.cos(a) * 0.33, Math.sin(a) * 0.33, Math.cos(a) * 0.48, Math.sin(a) * 0.48, 0.12);
      }
      bar(-0.07, 0, 0.07, 0, 0.14);
      break;
    case 3:
      // Staraya: cinco túneles que se cruzan
      b.color(C.black);
      ring(0.44, 0.07);
      for (let i = 0; i < 5; i++) {
        const a = Math.PI / 2 + (i / 5) * 6.283;
        bar(0, 0, Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0.08);
      }
      break;
    case 4:
      // Vhlainska: la A en un círculo
      b.color(C.black);
      ring(0.45, 0.07);
      bar(-0.26, -0.34, 0, 0.4, 0.09);
      bar(0.26, -0.34, 0, 0.4, 0.09);
      bar(-0.3, -0.08, 0.3, -0.08, 0.08);
      break;
    case 5:
      // Chernovodskaya: espada sobre aguas negras
      bar(0, -0.1, 0, 0.5, 0.08);
      bar(-0.14, 0.02, 0.14, 0.02, 0.07);
      b.color(C.black);
      for (let k = 0; k < 2; k++) for (let i = 0; i < 6; i++) bar(-0.45 + i * 0.15, -0.28 - k * 0.14 + (i % 2) * 0.06, -0.3 + i * 0.15, -0.28 - k * 0.14 + ((i + 1) % 2) * 0.06, 0.06);
      break;
    case 6:
      // Califato: creciente y esmeralda
      for (let i = 0; i < 10; i++) {
        const a0 = 0.9 + (i / 10) * 4.5;
        const a1 = 0.9 + ((i + 1) / 10) * 4.5;
        bar(Math.cos(a0) * 0.36 - 0.05, Math.sin(a0) * 0.36, Math.cos(a1) * 0.36 - 0.05, Math.sin(a1) * 0.36, 0.05 + Math.sin((i / 10) * Math.PI) * 0.09);
      }
      b.quad(0.2 * s, -0.12 * s, z, 0.32 * s, 0, z, 0.2 * s, 0.12 * s, z, 0.08 * s, 0, z);
      break;
    default:
      // República del Norte: estrella polar de ocho puntas
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.283;
        const r = i % 2 ? 0.28 : 0.5;
        const a0 = a - 0.25;
        const a1 = a + 0.25;
        b.triangle(Math.cos(a0) * 0.1 * s, Math.sin(a0) * 0.1 * s, z, Math.cos(a1) * 0.1 * s, Math.sin(a1) * 0.1 * s, z, Math.cos(a) * r * s, Math.sin(a) * r * s, z);
      }
      break;
  }
}

/** Variante de emblema para un bando (índice del kit). */
export const EMBLEM_INDEX: Record<string, number> = { UNI: 0, SDR: 1, LEV: 2, STA: 3, VHL: 4, CHE: 5, CAL: 6, NOR: 7 };

defProp('estandarte', (b, v) => {
  // Pendón de pared con el emblema de la facción (el paño toma su color)
  b.color(C.woodDark).cube(0, 0.02, 0.06, 1.5, 0.05, 0.05);
  b.color(C.tint, 0.85).tinted(1);
  b.quad(-0.65, -2.2, 0.05, 0.65, -2.2, 0.05, 0.65, 0, 0.05, -0.65, 0, 0.05, 0.75);
  b.triangle(-0.65, -2.2, 0.05, 0, -2.55, 0.05, 0.65, -2.2, 0.05);
  b.tinted(0);
  b.push().translate(0, -1.05, 0.05);
  emblem(b, v, 1.0);
  b.pop();
});

defProp('bandera', (b, v, rng) => {
  b.color(C.steelDark).cyl(0, 0, 0, 0.03, 0.025, 3.6, 6);
  b.color(C.concreteDark).cyl(0, 0, 0, 0.2, 0.16, 0.12, 8);
  b.color(C.tint, 0.9).tinted(1);
  cloth(b, 0.03, 3.5, 0, 1.5, 3.42, 0, 0.9, 6, 0.06, rng);
  b.tinted(0);
  b.push().translate(0.75, 3.0, 0.05);
  emblem(b, v, 0.6);
  b.pop();
  b.push().translate(0.75, 3.0, -0.05).rotateY(Math.PI);
  emblem(b, v, 0.6);
  b.pop();
});

defProp('cartel', (b, v, rng) => {
  // Carteles pegados a la pared (consignas, avisos, retratos)
  const paper = vary(C.paper, rng, 0.12);
  b.color(paper).cube(0, -0.45, 0.012, 0.6, 0.85, 0.008);
  if (v % 3 === 0) {
    b.color(C.tint, 0.8).tinted(1).cube(0, -0.2, 0.017, 0.52, 0.34, 0.004);
    b.tinted(0);
    b.color(C.black);
    for (let i = 0; i < 3; i++) b.cube(0, -0.36 + i * -0.02 - i * 0.03, 0.017, 0.44 - i * 0.08, 0.02, 0.004);
  } else if (v % 3 === 1) {
    b.color(C.black);
    b.sphere(0, 0.1, 0.017, 0.12, 0.14, 0.003, 8, 4);
    b.cube(0, -0.32, 0.017, 0.34, 0.24, 0.004);
    b.color(C.red).cube(0, -0.42, 0.018, 0.5, 0.06, 0.004);
  } else {
    b.color(C.black);
    for (let i = 0; i < 6; i++) b.cube(rng.range(-0.04, 0.04), -0.02 - i * 0.065, 0.017, rng.range(0.3, 0.5), 0.018, 0.004);
  }
  if (v >= 3) {
    // Esquina despegada
    b.color(paper, 0.7);
    b.triangle(0.3, -0.45, 0.02, 0.3, -0.25, 0.02, 0.18, -0.4, 0.07);
  }
});

defProp('rotulo', (b) => {
  // Placa esmaltada con el nombre de la estación (franja teñible)
  b.color(C.steelDark).cube(0, -0.3, 0.02, 3.2, 0.6, 0.03);
  b.color(C.white, 0.85).cube(0, -0.27, 0.04, 3.05, 0.48, 0.012);
  b.color(C.tint, 0.85).tinted(1).cube(0, -0.27, 0.047, 3.05, 0.1, 0.006);
  b.tinted(0);
  // Letras (bloques)
  b.color(C.black);
  let x = -1.3;
  for (let i = 0; i < 11; i++) {
    const w = 0.12 + ((i * 7) % 5) * 0.025;
    b.cube(x + w / 2, -0.03, 0.05, w, 0.2, 0.004);
    x += w + 0.07;
  }
});

defProp('tablon', (b, _v, rng) => {
  b.color(C.woodDark);
  b.cube(-0.7, 0, 0, 0.07, 1.9, 0.07).cube(0.7, 0, 0, 0.07, 1.9, 0.07);
  b.color(C.woodGrey).cube(0, 0.9, 0, 1.5, 0.95, 0.04);
  for (let i = 0; i < 6; i++) {
    b.color(vary(C.paper, rng, 0.15));
    b.cube(-0.5 + (i % 3) * 0.5 + rng.range(-0.05, 0.05), 1.0 + Math.floor(i / 3) * 0.42 + rng.range(-0.03, 0.03), 0.025, 0.3, 0.36, 0.006);
  }
});

defProp('altavoz', (b) => {
  b.color(C.steelDark).cyl(0, 0, 0, 0.04, 0.03, 3.8, 6);
  for (const s of [-1, 1]) {
    b.push().translate(s * 0.12, 3.6, 0).rotateZ(s * -1.25);
    b.color(C.steel).lathe(0, 0, 0, [0.04, 0, 0.06, 0.1, 0.2, 0.42], 10);
    b.color(C.black).disc(0, 0.41, 0, 0.19, 10, 1);
    b.pop();
  }
});

defProp('reloj', (b) => {
  // Reloj de andén: cifras rojas que ya no marcan la hora de ningún tren
  b.color(C.black).cube(0, -0.22, 0.06, 1.3, 0.44, 0.12);
  b.color([1, 0.12, 0.06]).glow(4);
  for (let i = 0; i < 4; i++) {
    const x = -0.42 + i * 0.26 + (i > 1 ? 0.08 : 0);
    b.cube(x, -0.08, 0.125, 0.14, 0.03, 0.004).cube(x, -0.2, 0.125, 0.14, 0.03, 0.004).cube(x, -0.32, 0.125, 0.14, 0.03, 0.004);
    b.cube(x + 0.07, -0.2, 0.125, 0.03, 0.26, 0.004);
    if (i % 2) b.cube(x - 0.07, -0.26, 0.125, 0.03, 0.12, 0.004);
  }
  b.cube(0.04, -0.14, 0.125, 0.03, 0.03, 0.004).cube(0.04, -0.26, 0.125, 0.03, 0.03, 0.004);
  b.glow(0);
});

// --- Taller e industria ---------------------------------------------------------

defProp('bancoTrabajo', (b, v, rng) => {
  b.color(C.woodDark);
  for (const x of [-0.85, 0.85]) for (const z of [-0.34, 0.34]) b.cube(x, 0, z, 0.08, 0.85, 0.08);
  for (let i = 0; i < 3; i++) plank(b, 0, 0.85, -0.28 + i * 0.28, 1.9, 0.06, 0.27, rng, C.wood);
  b.color(C.woodGrey).cube(0, 0.25, 0, 1.7, 0.04, 0.6);
  // Panel de herramientas
  b.color(C.woodGrey, 0.8).cube(0, 0.91, -0.38, 1.9, 0.75, 0.04);
  b.color(C.iron);
  for (let i = 0; i < 5; i++) b.cube(-0.7 + i * 0.35, 1.15 + (i % 2) * 0.12, -0.35, 0.05, 0.3, 0.02);
  if (v === 0) {
    // Desguace: tornillo de banco y piezas
    b.color(C.steelDark).cube(0.6, 0.91, 0.1, 0.16, 0.14, 0.24);
    b.color(C.rust);
    for (let i = 0; i < 4; i++) b.cube(-0.6 + i * 0.25, 0.91, 0.12, 0.16, 0.05 + i * 0.01, 0.12);
    crate(b, -0.5, 0.29, 0, 0.5, 0.4, rng, C.woodGrey);
  } else if (v === 1) {
    // Armero: fusil a medio montar
    b.color(C.iron).cube(-0.1, 0.92, 0.1, 0.9, 0.04, 0.05);
    b.color(C.wood).cube(-0.6, 0.92, 0.1, 0.35, 0.06, 0.08);
    b.color(C.steelDark).cube(0.6, 0.91, 0.1, 0.16, 0.14, 0.24);
    b.color(C.olive).cube(0.4, 0.29, 0, 0.6, 0.3, 0.4);
  } else {
    // Prensa o laboratorio: palanca, matraces y balanza
    b.color(C.steelDark).cube(0.55, 0.91, 0, 0.22, 0.36, 0.22);
    b.color(C.red).beam(0.55, 1.27, 0, 0.9, 1.5, 0, 0.03, 0.03);
    b.color(C.glass).glow(0.2);
    for (let i = 0; i < 4; i++) b.lathe(-0.7 + i * 0.25, 0.91, 0.1, [0.06, 0, 0.07, 0.06, 0.02, 0.14, 0.02, 0.2], 7);
    b.glow(0);
    b.color(C.brass).cyl(-0.1, 0.91, -0.1, 0.1, 0.1, 0.02, 8);
  }
  bulb(b, 0, 1.72, -0.3, 0.045, C.bulb, 5);
});

defProp('fragua', (b, _v, rng) => {
  // Fragua de ladrillo con campana, fuelle y yunque
  for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
    b.color(vary([0.32, 0.15, 0.1], rng, 0.2));
    b.cube(-0.6 + k * 0.4 + (r % 2) * 0.05, r * 0.22, -0.2, 0.38, 0.2, 0.9);
  }
  b.color(C.ember).glow(6).cube(0, 0.88, -0.2, 1.0, 0.05, 0.6);
  b.glow(0).color(C.rustDark);
  b.push().translate(0, 1.5, -0.2);
  b.lathe(0, 0, 0, [0.75, 0, 0.3, 0.6, 0.16, 0.7, 0.16, 1.9], 4);
  b.pop();
  b.color(C.iron);
  b.cube(1.05, 0, 0.3, 0.3, 0.5, 0.3);
  b.cube(1.05, 0.5, 0.3, 0.5, 0.14, 0.2);
  b.color(C.leather).sphere(-1.1, 0.6, -0.2, 0.3, 0.2, 0.25, 7, 4);
});

defProp('torno', (b) => {
  b.color([0.2, 0.3, 0.28]).box(0, 0, 0, 2.0, 0.7, 0.7);
  b.color(C.steelDark).cube(-0.6, 0.7, 0, 0.6, 0.5, 0.55);
  b.color(C.steelLight);
  b.push().translate(-0.3, 0.95, 0).rotateZ(-Math.PI / 2);
  b.cyl(0, 0, 0, 0.14, 0.14, 0.12, 10, 3);
  b.cyl(0, 0.12, 0, 0.05, 0.05, 0.9, 7, 3);
  b.pop();
  b.color(C.steelDark).cube(0.7, 0.7, 0, 0.25, 0.3, 0.4);
  b.color(C.red).cyl(0.2, 0.7, 0.3, 0.07, 0.07, 0.04, 8);
});

defProp('horno', (b, _v, rng) => {
  // Horno de fundición de Industrialnaya
  b.color(vary(C.rustDark, rng, 0.1));
  b.lathe(0, 0, 0, [1.5, 0, 1.6, 0.3, 1.6, 2.6, 1.2, 3.6, 0.6, 4.2, 0.6, 5.2], 12);
  b.color(C.iron);
  for (const y of [0.9, 1.9, 2.9]) b.lathe(0, y, 0, [1.62, 0, 1.66, 0.06, 1.62, 0.12], 12);
  // Boca incandescente hacia +Z
  b.color(C.soot).cube(0, 0.5, 1.55, 1.1, 1.1, 0.2);
  b.color([1, 0.45, 0.1]).glow(7).cube(0, 0.62, 1.63, 0.8, 0.8, 0.06);
  b.glow(0).color(C.iron);
  b.cube(-0.5, 0.5, 1.72, 0.06, 1.1, 0.06).cube(0.5, 0.5, 1.72, 0.06, 1.1, 0.06);
  // Canal de colada
  b.color(C.concreteDark).cube(0, 0.2, 2.3, 0.4, 0.2, 1.3);
  b.color([1, 0.55, 0.15]).glow(5).cube(0, 0.4, 2.3, 0.2, 0.02, 1.2);
  b.glow(0);
  // Tubos y escalerilla
  b.color(C.rust).tube([1.4, 2.4, 0, 2.2, 2.6, 0, 2.2, 5.2, 0], 0.16, 7);
  b.color(C.steelDark);
  for (let i = 0; i < 9; i++) b.cube(-1.66, 0.4 + i * 0.36, -0.3, 0.05, 0.03, 0.5);
});

defProp('cinta', (b, _v, rng) => {
  b.color(C.steelDark);
  for (const x of [-2.3, 0, 2.3]) for (const z of [-0.4, 0.4]) b.cube(x, 0, z, 0.07, 0.8, 0.07);
  b.color(C.rubber, 1.3).cube(0, 0.8, 0, 5.2, 0.06, 0.8);
  b.color(C.steel).cube(0, 0.74, 0.42, 5.2, 0.14, 0.04).cube(0, 0.74, -0.42, 5.2, 0.14, 0.04);
  for (let i = 0; i < 5; i++) {
    b.color(vary(C.olive, rng, 0.1)).cube(-2 + i * 1.0, 0.86, rng.range(-0.1, 0.1), 0.5, 0.22, 0.32);
  }
});

defProp('generador', (b, _v, rng) => {
  b.color(C.steelDark).cube(0, 0, 0, 1.7, 0.12, 0.95);
  b.color(vary([0.5, 0.36, 0.1], rng, 0.1)).cube(-0.3, 0.12, 0, 0.9, 0.7, 0.7);
  b.color(C.iron).cube(0.5, 0.12, 0, 0.5, 0.55, 0.6);
  b.push().translate(0.78, 0.4, 0).rotateZ(-Math.PI / 2);
  b.color(C.steelDark).cyl(0, 0, 0, 0.24, 0.24, 0.1, 10, 3);
  b.pop();
  b.color(C.rustDark).tube([-0.5, 0.82, 0.2, -0.5, 1.5, 0.2, -0.3, 1.7, 0.2], 0.05, 6);
  b.color(C.red).cube(0.2, 0.82, 0.25, 0.3, 0.16, 0.2);
  b.color([0.4, 1, 0.4]).glow(4).cube(-0.3, 0.6, 0.355, 0.05, 0.05, 0.01);
  b.glow(0).color(C.rubber).tube([0.5, 0.3, 0.32, 0.9, 0.05, 0.6, 1.5, 0.03, 0.7], 0.02, 4);
});

defProp('deposito', (b, v, rng) => {
  if (v === 1) {
    // Alambique: caldera de cobre y serpentín
    b.color(C.concreteDark).cyl(0, 0, 0, 1.0, 1.0, 0.25, 12);
    b.color(C.ember).glow(3).cyl(0, 0.25, 0, 0.5, 0.5, 0.08, 8, 0);
    b.glow(0).color(vary(C.copper, rng, 0.1));
    b.lathe(0, 0.33, 0, [0.5, 0, 0.75, 0.3, 0.75, 1.0, 0.4, 1.5, 0.12, 1.8, 0.1, 2.2], 12);
    const path: number[] = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 6;
      path.push(1.0 + Math.cos(a) * 0.2, 2.2 - i * 0.07, Math.sin(a) * 0.2);
    }
    b.tube([0, 2.5, 0, 0.5, 2.6, 0, 1.0, 2.25, 0], 0.045, 6);
    b.tube(path, 0.035, 5);
    b.color(C.steelDark).cyl(1.0, 0, 0, 0.3, 0.3, 0.5, 9, 3);
    return;
  }
  // Depósito de agua sobre patas con lona recolectora
  b.color(C.steelDark);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.283 + 0.78;
    b.beam(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9, Math.cos(a) * 0.8, 1.0, Math.sin(a) * 0.8, 0.08, 0.08);
  }
  b.color(vary([0.25, 0.36, 0.42], rng, 0.1));
  b.lathe(0, 1.0, 0, [0.95, 0, 1.0, 0.05, 1.0, 1.5, 0.95, 1.55], 14, false, true);
  b.color(C.iron);
  for (const y of [1.3, 2.2]) b.lathe(0, y, 0, [1.01, 0, 1.03, 0.04, 1.01, 0.08], 14);
  b.color([0.2, 0.4, 0.5]).glow(0.3).disc(0, 2.45, 0, 0.93, 14, 1);
  b.glow(0).color(C.copper).tube([1.0, 1.2, 0, 1.25, 1.1, 0, 1.25, 0.5, 0], 0.03, 5);
  b.color(C.red).cyl(1.25, 0.9, 0.05, 0.06, 0.06, 0.02, 6);
});

defProp('bancal', (b, v, rng) => {
  // Bancal de hongos en cajones escalonados
  const tiers = v === 1 ? 3 : 2;
  for (let t = 0; t < tiers; t++) {
    const y = t * 0.55;
    const z = -0.3 + t * 0.3 - (tiers - 2) * 0.15;
    b.color(vary(C.woodGrey, rng, 0.12)).box(0, y, z, 3.0, 0.3, 0.55, 0b110011);
    b.color(C.dirt).cube(0, y + 0.24, z, 2.9, 0.04, 0.48);
    for (let i = 0; i < 16; i++) {
      const x = rng.range(-1.35, 1.35);
      const zz = z + rng.range(-0.18, 0.18);
      const h = rng.range(0.05, 0.16);
      b.color(vary(C.mushroom, rng, 0.2)).cyl(x, y + 0.28, zz, 0.014, 0.012, h, 4, 0);
      b.color(vary(C.mushroomCap, rng, 0.25)).sphere(x, y + 0.28 + h, zz, 0.05, 0.03, 0.05, 6, 3, 0.5, 1);
    }
    if (t > 0) {
      b.color(C.woodDark);
      for (const x of [-1.4, 1.4]) b.cube(x, 0, z, 0.06, y, 0.06);
    }
  }
});

defProp('corral', (b, _v, rng) => {
  // Cercado de tablones con comedero y dos cerdos
  b.color(C.woodDark);
  for (const x of [-2, 0, 2]) for (const z of [-1.5, 1.5]) b.cube(x, 0, z, 0.08, 0.9, 0.08);
  for (const z of [-1.5, 1.5]) for (const y of [0.3, 0.65]) plank(b, 0, y, z, 4.0, 0.12, 0.03, rng, C.woodGrey);
  for (const x of [-2, 2]) for (const y of [0.3, 0.65]) plank(b, x, y, 0, 0.03, 0.12, 3.0, rng, C.woodGrey);
  b.color(C.dirt, 0.8).cube(0, 0, 0, 3.9, 0.03, 2.9);
  b.color(C.woodGrey).box(1.2, 0, -1.0, 1.2, 0.25, 0.4);
  for (const [x, z, r] of [
    [-0.8, 0.3, 0.4],
    [0.5, -0.2, 2.2],
  ]) {
    b.push().translate(x, 0, z).rotateY(r);
    b.color(vary(C.pink, rng, 0.1));
    b.sphere(0, 0.42, 0, 0.5, 0.3, 0.3, 9, 5);
    b.sphere(0.5, 0.45, 0, 0.2, 0.19, 0.18, 7, 4);
    b.cyl(0.66, 0.38, 0, 0.07, 0.07, 0.1, 6);
    for (const lx of [-0.3, 0.3]) for (const lz of [-0.15, 0.15]) b.cyl(lx, 0, lz, 0.05, 0.06, 0.26, 5, 0);
    b.pop();
  }
});

defProp('hidroponico', (b, _v, rng) => {
  b.color(C.steelDark);
  for (const x of [-1.3, 1.3]) for (const z of [-0.35, 0.35]) b.cube(x, 0, z, 0.05, 2.0, 0.05);
  for (let t = 0; t < 3; t++) {
    const y = 0.3 + t * 0.6;
    b.color(C.white, 0.7).box(0, y, 0, 2.6, 0.14, 0.6, 0b110011);
    b.color([0.15, 0.35, 0.4]).glow(0.2).cube(0, y + 0.1, 0, 2.5, 0.02, 0.5);
    b.glow(0);
    for (let i = 0; i < 9; i++) {
      b.color(vary([0.2, 0.5, 0.18], rng, 0.25));
      b.sphere(-1.1 + i * 0.28, y + 0.24, rng.range(-0.12, 0.12), 0.1, 0.12, 0.1, 6, 3);
    }
    b.color([0.85, 0.4, 1]).glow(5).cube(0, y + 0.5, 0, 2.4, 0.03, 0.06);
    b.glow(0);
  }
});

defProp('vagoneta', (b, v, rng) => {
  // Draisina de mano
  b.color(C.iron);
  for (const x of [-0.8, 0.8]) for (const z of [-0.76, 0.76]) {
    b.push().translate(x, 0.24, z - 0.04).rotateX(Math.PI / 2);
    b.cyl(0, 0, 0, 0.24, 0.24, 0.08, 10, 3);
    b.pop();
  }
  for (let i = 0; i < 5; i++) plank(b, -1.0 + i * 0.5, 0.4, 0, 0.48, 0.06, 1.5, rng, C.woodGrey);
  b.color(C.steelDark).cube(0, 0.3, 0, 2.4, 0.1, 1.2);
  if (v === 0) {
    // Balancín
    b.cube(0, 0.46, 0, 0.3, 0.7, 0.3);
    b.color(C.rust).beam(-0.9, 1.3, 0, 0.9, 1.05, 0, 0.05, 0.05);
    b.beam(-0.9, 1.3, -0.3, -0.9, 1.3, 0.3, 0.04, 0.04);
    b.beam(0.9, 1.05, -0.3, 0.9, 1.05, 0.3, 0.04, 0.04);
  } else {
    crate(b, -0.5, 0.46, 0, 0.8, 0.7, rng);
    drum(b, 0.6, 0.46, 0.2, C.navy, rng);
    for (let i = 0; i < 3; i++) sandbag(b, 0.5, 0.46 + i * 0.2, -0.4, 0.3, rng);
  }
});

defProp('carretilla', (b, _v, rng) => {
  b.color(C.rustDark);
  b.push().translate(0.6, 0.22, 0).rotateX(Math.PI / 2);
  b.cyl(0, -0.04, 0, 0.22, 0.22, 0.08, 10, 3);
  b.pop();
  b.color(vary(C.rust, rng, 0.15));
  b.quad(-0.5, 0.35, 0.35, 0.5, 0.3, 0.25, 0.5, 0.3, -0.25, -0.5, 0.35, -0.35);
  b.quad(-0.55, 0.7, 0.4, 0.6, 0.6, 0.3, 0.5, 0.3, 0.25, -0.5, 0.35, 0.35);
  b.quad(0.6, 0.6, -0.3, -0.55, 0.7, -0.4, -0.5, 0.35, -0.35, 0.5, 0.3, -0.25);
  b.color(C.woodDark);
  b.beam(-1.3, 0.75, 0.32, 0.5, 0.3, 0.26, 0.04, 0.04);
  b.beam(-1.3, 0.75, -0.32, 0.5, 0.3, -0.26, 0.04, 0.04);
  b.beam(-0.5, 0.35, 0.3, -0.6, 0, 0.3, 0.04, 0.04);
  b.beam(-0.5, 0.35, -0.3, -0.6, 0, -0.3, 0.04, 0.04);
});

defProp('railes', (b, _v, rng) => {
  // Carriles apilados
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) {
    b.color(vary(C.rustDark, rng, 0.2));
    b.cube(rng.range(-0.1, 0.1), 0.1 + r * 0.17, -0.36 + i * 0.24 + r * 0.12, 4.4, 0.15, 0.09);
  }
  b.color(C.woodDark).cube(-1.5, 0, 0, 0.2, 0.1, 1.0).cube(1.5, 0, 0, 0.2, 0.1, 1.0);
});

// --- Hospital ---------------------------------------------------------------------

defProp('camilla', (b, v, rng) => {
  b.color(C.steelLight, 0.7);
  for (const x of [-0.95, 0.95]) for (const z of [-0.4, 0.4]) b.cyl(x, 0, z, 0.02, 0.02, 0.6, 5);
  b.color(C.white, 0.85).cube(0, 0.52, 0, 1.95, 0.12, 0.82);
  b.color(C.white, 0.7).cube(0.72, 0.64, 0, 0.36, 0.08, 0.5);
  b.color(vary([0.55, 0.66, 0.6], rng, 0.1)).cube(-0.25, 0.64, 0, 1.35, 0.05, 0.8);
  if (v === 1) {
    // Gotero
    b.color(C.steelLight).cyl(1.05, 0, 0.5, 0.015, 0.015, 1.9, 5);
    b.color(C.glass).glow(0.3).cube(1.05, 1.6, 0.5, 0.1, 0.22, 0.05);
    b.glow(0);
  }
});

defProp('biombo', (b, _v, rng) => {
  b.color(C.steelLight, 0.7);
  for (const x of [-0.9, 0, 0.9]) b.cyl(x, 0, 0, 0.018, 0.018, 1.8, 5);
  b.color(vary(C.white, rng, 0.06), 0.8);
  cloth(b, -0.9, 1.75, 0, 0, 1.75, 0, 1.5, 4, 0.03, rng);
  cloth(b, 0, 1.75, 0, 0.9, 1.75, 0, 1.5, 4, 0.03, rng);
});

defProp('armario', (b) => {
  b.color(C.white, 0.75).box(0, 0, 0, 1.0, 1.9, 0.5);
  b.color(C.steelDark).cube(0, 0.1, 0.255, 0.02, 1.7, 0.004);
  b.color(C.red).cube(0.25, 1.45, 0.256, 0.2, 0.06, 0.004).cube(0.25, 1.38, 0.256, 0.06, 0.2, 0.004);
});

// --- Peligro y ambiente -------------------------------------------------------------

defProp('huesos', (b, v, rng) => {
  b.color(C.bone, 0.85);
  for (let i = 0; i < 5 + v * 2; i++) {
    const a = rng.range(0, 6.28);
    const r = rng.range(0, 0.5);
    b.push().translate(Math.cos(a) * r, 0.03, Math.sin(a) * r).rotateY(rng.range(0, 6));
    b.cube(0, 0, 0, rng.range(0.2, 0.45), 0.035, 0.035);
    b.pop();
  }
  // Calavera y costillar
  b.sphere(0.2, 0.1, 0.1, 0.1, 0.1, 0.12, 7, 4);
  b.color(C.black).sphere(0.24, 0.12, 0.2, 0.025, 0.03, 0.02, 4, 3).sphere(0.16, 0.12, 0.2, 0.025, 0.03, 0.02, 4, 3);
  if (v > 0) {
    b.color(C.bone, 0.75);
    for (let i = 0; i < 5; i++) b.tube([-0.3 + i * 0.08, 0.02, -0.2, -0.3 + i * 0.08, 0.2, -0.1, -0.3 + i * 0.08, 0.02, 0.05], 0.012, 3);
  }
});

defProp('telarana', (b, v) => {
  b.color([0.6, 0.6, 0.6], 0.5);
  for (let i = 0; i < 6 + v * 3; i++) {
    const a = (i / (6 + v * 3)) * Math.PI;
    b.tube([0, 0, 0.02, Math.cos(a) * 0.9, -Math.sin(a) * 0.9, 0.3], 0.004, 3);
  }
});

defProp('nido', (b, v, rng) => {
  // Nido: trapos, huesos y sacos de huevos que brillan
  for (let i = 0; i < 12; i++) {
    const a = rng.range(0, 6.28);
    const r = rng.range(0.2, 1.3);
    b.color(vary(rng.pick([C.dirt, C.canvasDark, C.cloth]), rng, 0.2), 0.7);
    const v0 = b.vcount;
    b.sphere(Math.cos(a) * r, 0.12, Math.sin(a) * r, rng.range(0.25, 0.5), rng.range(0.1, 0.25), rng.range(0.25, 0.45), 6, 3);
    b.jitter(v0, 0.08, i);
  }
  for (let i = 0; i < 5 + v * 3; i++) {
    const a = rng.range(0, 6.28);
    const r = rng.range(0, 0.8);
    b.color([0.5, 0.9, 0.3]).glow(rng.range(1, 2.4));
    b.sphere(Math.cos(a) * r, 0.25, Math.sin(a) * r, 0.13, 0.19, 0.13, 7, 4);
  }
  b.glow(0).color(C.bone, 0.8);
  for (let i = 0; i < 6; i++) {
    b.push().translate(rng.range(-1, 1), 0.2, rng.range(-1, 1)).rotateY(rng.range(0, 6)).rotateZ(rng.range(-0.5, 0.5));
    b.cube(0, 0, 0, rng.range(0.3, 0.5), 0.035, 0.035);
    b.pop();
  }
});

defProp('picas', (b, v, rng) => {
  // Picas con calaveras: advertencia para quien quiera entrar
  const n = v === 1 ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.5;
    const h = rng.range(2.0, 2.5);
    b.color(C.woodDark).cyl(x, 0, 0, 0.03, 0.02, h, 5);
    b.color(C.bone, 0.85).sphere(x, h + 0.05, 0, 0.1, 0.11, 0.12, 7, 4);
    b.color(C.black).sphere(x + 0.04, h + 0.07, 0.1, 0.025, 0.03, 0.02, 4, 3).sphere(x - 0.04, h + 0.07, 0.1, 0.025, 0.03, 0.02, 4, 3);
    b.color(C.clothRed, 0.6);
    cloth(b, x, h - 0.2, 0.03, x + 0.01, h - 0.2, 0.2, 0.5, 2, 0.02, rng);
  }
});

defProp('charco', (b, v) => {
  b.color([0.05, 0.07, 0.08]);
  const n = 12;
  const c = b.v(0, 0.012, 0, 0, 1, 0);
  const base = b.vcount;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 6.283;
    const r = 0.8 + 0.4 * Math.sin(a * 2 + v) + 0.2 * Math.sin(a * 3 + v * 2);
    b.v(Math.cos(a) * r, 0.012, Math.sin(a) * r, 0, 1, 0);
  }
  for (let i = 0; i < n; i++) b.tri(c, base + i + 1, base + i);
});

defProp('maleta', (b, v, rng) => {
  b.color(vary([C.leather, C.clothBlue, C.cloth][v % 3], rng, 0.15));
  b.push().rotateY(rng.range(0, 3)).rotateZ(v === 2 ? 1.5 : 0);
  b.cube(0, 0, 0, 0.7, 0.45, 0.24);
  b.color(C.brass).cube(0, 0.45, 0, 0.2, 0.03, 0.04);
  b.pop();
});

defProp('jaula', (b) => {
  b.color(C.rustDark);
  b.cube(0, 0, 0, 1.6, 0.06, 1.6).cube(0, 1.7, 0, 1.6, 0.06, 1.6);
  for (let i = 0; i < 7; i++) {
    const t = -0.75 + i * 0.25;
    b.cyl(t, 0.06, 0.78, 0.018, 0.018, 1.64, 4, 0);
    b.cyl(t, 0.06, -0.78, 0.018, 0.018, 1.64, 4, 0);
    b.cyl(0.78, 0.06, t, 0.018, 0.018, 1.64, 4, 0);
    b.cyl(-0.78, 0.06, t, 0.018, 0.018, 1.64, 4, 0);
  }
});

defProp('botin', (b, v, rng) => {
  // Montón de botín: cajas, fardos, armas y cacharros
  crate(b, -0.5, 0, 0.2, 0.7, 0.6, rng, C.wood, 0.3);
  crate(b, 0.4, 0, -0.3, 0.6, 0.5, rng, C.woodGrey, -0.4);
  crate(b, 0, 0.55, 0, 0.5, 0.45, rng, C.woodLight, 0.8);
  for (let i = 0; i < 4; i++) sandbag(b, rng.range(-0.8, 0.8), 0, rng.range(0.5, 0.9), rng.range(0, 3), rng, 0.55, C.canvas);
  b.color(C.olive).cube(0.8, 0, 0.4, 0.7, 0.3, 0.36);
  b.color(C.iron);
  b.beam(-0.9, 0.05, -0.5, -0.2, 0.75, -0.3, 0.035, 0.05);
  b.beam(0.9, 0.05, -0.6, 0.5, 0.8, -0.4, 0.035, 0.05);
  drum(b, -0.9, 0, -0.6, C.red, rng);
  if (v === 1) {
    b.color(C.brass).glow(0.4);
    for (let i = 0; i < 5; i++) b.cyl(rng.range(-0.3, 0.6), 0.02, rng.range(0.9, 1.2), 0.05, 0.05, 0.02, 6);
    b.glow(0);
  }
});

export { emblem };
