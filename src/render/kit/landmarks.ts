// Hitos: las piezas únicas que dan carácter a cada estación, las
// fortificaciones y lo que levanta el jugador con chapa y soldadura.

import { C, bulb, cloth, crate, defProp, drum, plank, sandbag, vary, type MeshBuilder, type RGB, type Rng } from './core';
import { emblem } from './settlement';

const MARBLE: RGB = [0.62, 0.6, 0.56];
const CHAR: RGB = [0.1, 0.09, 0.085];
const SCORCH: RGB = [0.24, 0.21, 0.19];
const PLASTER: RGB = [0.5, 0.48, 0.42];
const BRONZE: RGB = [0.16, 0.2, 0.15];

/** Letras de rótulo como bloques (cirílico de mentira, legible solo de lejos). */
function lettering(b: MeshBuilder, x0: number, y: number, z: number, n: number, h: number, col: RGB, glow = 0) {
  b.color(col).glow(glow);
  let x = x0;
  for (let i = 0; i < n; i++) {
    const w = h * (0.55 + ((i * 7) % 5) * 0.09);
    b.cube(x + w / 2, y, z, w, h, 0.012);
    if (i % 3 === 1) b.color(col, 0.55).cube(x + w / 2, y + h * 0.35, z + 0.004, w * 0.4, h * 0.3, 0.012).color(col);
    x += w + h * 0.28;
  }
  b.glow(0);
}

/** Franja de peligro amarilla y negra a lo largo de X. */
function hazard(b: MeshBuilder, x0: number, x1: number, y: number, z: number, h: number, nz = 1) {
  const n = Math.max(2, Math.round((x1 - x0) / 0.3));
  for (let i = 0; i < n; i++) {
    b.color(i % 2 ? C.black : C.yellow, 0.9);
    const xa = x0 + ((x1 - x0) * i) / n;
    const xb = x0 + ((x1 - x0) * (i + 1)) / n;
    if (nz > 0) b.quad(xa, y, z, xb, y, z, xb, y + h, z, xa, y + h, z);
    else b.quad(xb, y, z, xa, y, z, xa, y + h, z, xb, y + h, z);
  }
}

/** Rollo de alambre de espino a lo largo de X. */
function wireCoil(b: MeshBuilder, x0: number, x1: number, y: number, z: number, r: number) {
  b.color(C.steel, 0.8);
  const path: number[] = [];
  const turns = Math.round((x1 - x0) / 0.32);
  const n = turns * 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    path.push(x0 + (x1 - x0) * t, y + r + Math.sin(a) * r, z + Math.cos(a) * r);
  }
  b.tube(path, 0.009, 3);
}

// --- Defensa -----------------------------------------------------------------------

defProp('torreVigia', (b, _v, rng) => {
  // Torre de vigilancia de tubo y tablones con proyector
  b.color(C.steelDark);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.beam(sx * 0.95, 0, sz * 0.95, sx * 0.82, 3.2, sz * 0.82, 0.09, 0.09);
  b.color(C.rustDark);
  for (const s of [-1, 1]) {
    b.beam(-0.92, 0.3, s * 0.92, 0.85, 2.9, s * 0.85, 0.05, 0.05);
    b.beam(0.92, 0.3, s * 0.92, -0.85, 2.9, s * 0.85, 0.05, 0.05);
    b.beam(s * 0.92, 0.3, -0.92, s * 0.85, 2.9, 0.85, 0.05, 0.05);
  }
  for (let i = 0; i < 6; i++) plank(b, -0.9 + i * 0.36, 3.2, 0, 0.34, 0.06, 2.1, rng, C.woodGrey);
  // Parapeto de chapa y sacos
  b.color(vary(C.rust, rng, 0.1));
  b.cube(0, 3.26, -1.02, 2.1, 0.9, 0.04);
  b.cube(-1.02, 3.26, 0, 0.04, 0.9, 2.1);
  b.cube(1.02, 3.26, 0, 0.04, 0.9, 2.1);
  for (let i = 0; i < 3; i++) sandbag(b, -0.62 + i * 0.62, 3.26, 0.95, 0, rng);
  for (let i = 0; i < 2; i++) sandbag(b, -0.31 + i * 0.62, 3.46, 0.95, 0, rng);
  b.color(C.steelDark);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cyl(sx * 0.95, 3.26, sz * 0.95, 0.03, 0.03, 1.75, 5, 0);
  b.push().translate(0, 5.0, 0).rotateX(0.08);
  b.color(vary(C.rustDark, rng, 0.1)).cube(0, 0, 0, 2.5, 0.05, 2.5);
  b.pop();
  // Escalera de mano
  b.color(C.woodDark);
  b.beam(-0.3, 0, -1.3, -0.3, 3.3, -1.08, 0.05, 0.05);
  b.beam(0.3, 0, -1.3, 0.3, 3.3, -1.08, 0.05, 0.05);
  for (let i = 0; i < 9; i++) b.cube(0, 0.3 + i * 0.34, -1.28 + i * 0.0227, 0.6, 0.035, 0.035);
  // Proyector hacia +Z
  b.push().translate(0.6, 4.3, 0.9).rotateX(1.0);
  b.color(C.iron).lathe(0, 0, 0, [0.1, -0.12, 0.18, 0, 0.2, 0.12], 10, false, true);
  b.color(C.bulbCold).glow(9).disc(0, 0.115, 0, 0.185, 10, 1);
  b.glow(0);
  b.pop();
  b.color(C.tint, 0.8).tinted(1).cube(0, 3.5, -1.05, 1.0, 0.45, 0.012);
  b.tinted(0);
});

defProp('muroHormigon', (b, v, rng) => {
  // Lienzo de hormigón armado (4 m) con contrafuertes y espino
  const c = vary(C.concrete, rng, 0.06);
  b.color(c);
  if (v === 1) {
    // Con tronera
    b.box(-1.25, 0, 0, 1.5, 2.6, 0.5);
    b.box(1.25, 0, 0, 1.5, 2.6, 0.5);
    b.box(0, 0, 0, 1.0, 1.25, 0.5);
    b.box(0, 1.6, 0, 1.0, 1.0, 0.5);
    b.color(C.black).cube(0, 1.25, -0.05, 1.0, 0.35, 0.3);
    for (let i = 0; i < 3; i++) sandbag(b, -0.62 + i * 0.62, 0, 0.5, 0, rng);
  } else b.box(0, 0, 0, 4.0, 2.6, 0.5);
  b.color(c, 0.82);
  for (const x of [-1.9, 1.9]) {
    b.box(x, 0, 0, 0.2, 2.75, 0.62);
    b.triangle(x - 0.1, 0, -0.31, x - 0.1, 1.6, -0.31, x - 0.1, 0, -0.75);
    b.triangle(x + 0.1, 0, -0.31, x + 0.1, 0, -0.75, x + 0.1, 1.6, -0.31);
    b.quad(x - 0.1, 0, -0.75, x - 0.1, 1.6, -0.31, x + 0.1, 1.6, -0.31, x + 0.1, 0, -0.75);
  }
  // Juntas de encofrado y desconchones
  b.color(c, 0.7);
  for (const y of [0.85, 1.72]) b.cube(0, y, 0.251, 3.6, 0.025, 0.006);
  b.color(C.rust, 0.7);
  for (let i = 0; i < 4; i++) b.cube(rng.range(-1.6, 1.6), rng.range(1.9, 2.3), 0.252, 0.03, rng.range(0.3, 0.6), 0.004);
  hazard(b, -1.8, 1.8, 0.02, 0.2525, 0.22);
  b.color(C.tint, 0.75).tinted(1).cube(0, 2.2, 0.253, 3.6, 0.16, 0.004);
  b.tinted(0);
  // Espino
  b.color(C.steelDark);
  for (const x of [-1.9, -0.63, 0.63, 1.9]) b.beam(x, 2.6, 0, x, 3.0, 0.22, 0.03, 0.03);
  wireCoil(b, -1.95, 1.95, 2.72, 0.08, 0.17);
});

defProp('muroChapa', (b, _v, rng) => {
  // Muro del jugador: planchas soldadas sobre un armazón de tubo (3 m)
  b.color(C.steelDark);
  for (const x of [-1.45, 0, 1.45]) b.box(x, 0, -0.08, 0.09, 2.5, 0.09);
  b.beam(-1.45, 2.3, -0.08, 1.45, 2.3, -0.08, 0.06, 0.06);
  b.beam(-1.45, 0.4, -0.08, 1.45, 0.4, -0.08, 0.06, 0.06);
  b.color(C.rustDark);
  b.beam(-1.4, 0.05, -0.2, -1.4, 1.5, -0.08, 0.05, 0.05);
  b.beam(1.4, 0.05, -0.2, 1.4, 1.5, -0.08, 0.05, 0.05);
  // Planchas solapadas de distinta procedencia
  let x = -1.5;
  let i = 0;
  while (x < 1.5) {
    const w = Math.min(1.5 - x, rng.range(0.45, 0.8));
    const h = rng.range(2.2, 2.55);
    const col = rng.pick([C.rust, C.rustLight, C.steel, C.rustDark, C.enamelGreen, C.enamelBlue]);
    b.color(vary(col, rng, 0.15));
    b.push().translate(x + w / 2, 0, 0.02 + (i % 2) * 0.025).rotateZ(rng.range(-0.02, 0.02));
    b.cube(0, 0.03, 0, w + 0.06, h, 0.02);
    // Nervaduras de chapa ondulada
    b.color(col, 0.7);
    if (i % 2 === 0) for (let k = 1; k < 5; k++) b.cube(-w / 2 + (w * k) / 5, 0.05, 0.012, 0.02, h - 0.06, 0.008);
    else {
      b.color(C.steelLight, 0.6);
      for (const yy of [0.3, h - 0.25]) for (const xx of [-w / 2 + 0.07, w / 2 - 0.07]) b.sphere(xx, yy, 0.014, 0.02, 0.02, 0.01, 5, 3);
    }
    b.pop();
    x += w;
    i++;
  }
  b.color(C.steelDark);
  for (let k = 0; k < 5; k++) b.beam(-1.3 + k * 0.65, 2.5, 0, -1.3 + k * 0.65 + 0.1, 2.85, 0.05, 0.025, 0.025);
});

defProp('portonChapa', (b, _v, rng) => {
  // Portón del jugador: dos hojas de chapa en un marco de carril
  b.color(C.rustDark);
  b.box(-1.42, 0, 0, 0.16, 2.9, 0.22);
  b.box(1.42, 0, 0, 0.16, 2.9, 0.22);
  b.box(0, 2.74, 0, 3.0, 0.16, 0.22, 0b111111);
  for (const s of [-1, 1]) {
    b.push().translate(s * 1.33, 0, 0.02).rotateY(s * 0.16);
    const c = vary(s > 0 ? C.rust : C.steel, rng, 0.12);
    b.color(c).cube(-s * 0.64, 0.08, 0, 1.28, 2.56, 0.04);
    b.color(c, 0.7);
    b.cube(-s * 0.64, 0.2, 0.025, 1.2, 0.06, 0.02).cube(-s * 0.64, 1.3, 0.025, 1.2, 0.06, 0.02).cube(-s * 0.64, 2.4, 0.025, 1.2, 0.06, 0.02);
    b.beam(-s * 0.06, 0.24, 0.03, -s * 1.22, 1.3, 0.03, 0.05, 0.02);
    b.beam(-s * 0.06, 1.34, 0.03, -s * 1.22, 2.4, 0.03, 0.05, 0.02);
    b.color(C.steelDark);
    for (const y of [0.4, 1.3, 2.2]) b.cyl(0, y, 0.02, 0.035, 0.035, 0.18, 6);
    b.pop();
  }
  // Tranca y cadena
  b.color(C.woodDark).cube(0, 1.18, 0.11, 1.5, 0.12, 0.07);
  b.color(C.steelLight, 0.7).tube([-0.2, 1.3, 0.14, 0, 1.12, 0.17, 0.2, 1.3, 0.14], 0.014, 4);
  b.color(C.tint, 0.8).tinted(1).cube(0, 2.9, 0, 1.2, 0.34, 0.03);
  b.tinted(0);
});

/** Marco de boca de túnel: jambas, dintel con rótulo y luces de señal. */
function gantry(b: MeshBuilder, v: number, rng: Rng, gates: boolean) {
  const hw = v === 1 ? 5.0 : v === 2 ? 2.0 : 3.0;
  const H = v === 1 ? 4.6 : v === 2 ? 3.0 : 3.9;
  const c = vary(C.concrete, rng, 0.05);
  for (const s of [-1, 1]) {
    b.color(c).box(s * (hw + 0.05), 0, 0, 0.5, H, 0.6);
    b.color(c, 0.8).box(s * (hw + 0.05), 0, 0, 0.62, 0.35, 0.72);
    hazard(b, s * (hw + 0.05) - 0.25, s * (hw + 0.05) + 0.25, 0.35, 0.305, 0.9);
    hazard(b, s * (hw + 0.05) - 0.25, s * (hw + 0.05) + 0.25, 0.35, -0.305, 0.9, -1);
  }
  b.color(c, 0.9).box(0, H, 0, hw * 2 + 0.7, 0.6, 0.6, 0b111111);
  // Placa del rótulo con la franja de la facción (a las dos caras)
  const pw = Math.min(hw * 1.5, 4.4);
  for (const s of [-1, 1]) {
    b.push();
    if (s < 0) b.rotateY(Math.PI);
    b.color(C.white, 0.85).cube(0, H + 0.08, 0.305, pw, 0.44, 0.012);
    b.color(C.tint, 0.85).tinted(1).cube(0, H + 0.08, 0.312, pw, 0.09, 0.006);
    b.tinted(0);
    lettering(b, -pw / 2 + 0.2, H + 0.22, 0.312, Math.floor(pw / 0.33), 0.2, C.black);
    // Semáforos
    for (const x of [-hw + 0.2, hw - 0.2]) {
      b.color(C.black).cube(x, H - 0.42, 0.25, 0.2, 0.4, 0.12);
      b.color([1, 0.15, 0.1]).glow(5).cube(x, H - 0.2, 0.312, 0.09, 0.09, 0.01);
      b.glow(0).color([0.1, 0.3, 0.12]).cube(x, H - 0.38, 0.312, 0.09, 0.09, 0.01);
    }
    b.pop();
  }
  if (!gates) return;
  // Hojas de acero abiertas contra los muros (hacia +Z)
  for (const s of [-1, 1]) {
    const L = hw * 0.98;
    b.push().translate(s * (hw - 0.22), 0, 0.3).rotateY(s * -1.45);
    // La hoja se extiende a lo largo de -s·X local desde la bisagra
    const cx = (-s * L) / 2;
    const col = vary(C.steel, rng, 0.08);
    b.color(col).cube(cx, 0.12, 0, L, H - 0.5, 0.09);
    b.color(col, 0.72);
    for (const y of [0.3, (H - 0.5) / 2, H - 0.75]) b.cube(cx, y, 0.05, L - 0.1, 0.1, 0.03).cube(cx, y, -0.05, L - 0.1, 0.1, 0.03);
    for (let k = 0; k < 3; k++) b.cube(-s * (0.2 + ((L - 0.4) * k) / 2), 0.14, 0.05, 0.08, H - 0.56, 0.03);
    hazard(b, Math.min(0, -s * L) + 0.05, Math.max(0, -s * L) - 0.05, 0.14, 0.068, 0.4);
    b.color(C.rust, 0.7);
    for (let k = 0; k < 5; k++) b.cube(-s * rng.range(0.3, L - 0.3), rng.range(1.2, H - 1.4), 0.047, 0.04, rng.range(0.3, 0.8), 0.004);
    b.color(C.steelDark);
    for (const y of [0.5, H - 0.9]) b.cyl(0, y, 0, 0.06, 0.06, 0.3, 6);
    b.pop();
  }
}

defProp('portal', (b, v, rng) => gantry(b, v, rng, false));
defProp('portonEstacion', (b, v, rng) => gantry(b, v, rng, true));

defProp('puertaBlindada', (b, _v, rng) => {
  // Puerta hermética de la defensa civil (va en el muro, a ras de suelo)
  b.color(C.concreteDark).box(0, 0, 0.1, 3.6, 3.3, 0.24);
  const c = vary([0.3, 0.34, 0.33], rng, 0.06);
  b.color(c).cube(0, 0.1, 0.24, 2.8, 2.9, 0.14);
  b.color(c, 0.75);
  for (const y of [0.5, 1.5, 2.5]) b.cube(0, y, 0.32, 2.7, 0.12, 0.05);
  for (const x of [-1.1, 1.1]) b.cube(x, 0.2, 0.32, 0.12, 2.7, 0.05);
  // Volante y cerrojos
  b.push().translate(0, 1.55, 0.4).rotateX(Math.PI / 2);
  b.color(C.red, 0.8).lathe(0, 0, 0, [0.33, 0, 0.37, 0.03, 0.33, 0.06], 14);
  b.color(C.steelDark).cyl(0, -0.06, 0, 0.07, 0.07, 0.12, 8, 3);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    b.beam(0, 0.03, 0, Math.cos(a) * 0.34, 0.03, Math.sin(a) * 0.34, 0.035, 0.035);
  }
  b.pop();
  b.color(C.steelDark);
  for (const y of [0.5, 2.6]) for (const s of [-1, 1]) b.cube(s * 1.42, y, 0.3, 0.3, 0.16, 0.1);
  hazard(b, -1.8, 1.8, 0, 0.225, 0.3);
  b.color(C.rust, 0.7);
  for (let i = 0; i < 6; i++) b.cube(rng.range(-1.2, 1.2), rng.range(0.4, 1.4), 0.312, 0.05, rng.range(0.4, 1.3), 0.004);
  lettering(b, -0.9, 2.72, 0.315, 7, 0.17, C.white);
});

// --- Edificios pequeños ----------------------------------------------------------------

/** Caseta: cuatro paredes con hueco de ventanilla al frente (+Z) y tejado. */
function kiosk(b: MeshBuilder, w: number, d: number, h: number, body: RGB, roof: RGB, rng: Rng, win: { x: number; w: number; y: number; h: number; lit: number }, door?: number) {
  const hw = w / 2;
  const hd = d / 2;
  const c = vary(body, rng, 0.06);
  b.color(c);
  b.box(0, 0, -hd + 0.04, w, h, 0.08);
  b.box(-hw + 0.04, 0, 0, 0.08, h, d);
  b.box(hw - 0.04, 0, 0, 0.08, h, d);
  // Frente con ventanilla
  const wx0 = win.x - win.w / 2;
  const wx1 = win.x + win.w / 2;
  const z = hd - 0.04;
  b.box((-hw + wx0) / 2, 0, z, wx0 + hw, h, 0.08);
  b.box((wx1 + hw) / 2, 0, z, hw - wx1, h, 0.08);
  b.box(win.x, 0, z, win.w, win.y, 0.08);
  b.box(win.x, win.y + win.h, z, win.w, h - win.y - win.h, 0.08);
  // Interior iluminado
  b.color([1, 0.78, 0.45]).glow(win.lit);
  b.quad(wx0, win.y, z - 0.05, wx1, win.y, z - 0.05, wx1, win.y + win.h, z - 0.05, wx0, win.y + win.h, z - 0.05);
  b.glow(0);
  // Repisa
  b.color(C.woodDark).cube(win.x, win.y - 0.05, z + 0.14, win.w + 0.2, 0.05, 0.3);
  // Zócalo y esquineros
  b.color(c, 0.7);
  b.box(0, 0, 0, w + 0.06, 0.3, d + 0.06, 0b110011);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(sx * hw, 0, sz * hd, 0.1, h, 0.1);
  if (door !== undefined) {
    b.color(c, 0.6).cube(door, 0.02, z + 0.045, 0.85, 2.0, 0.02);
    b.color(C.brass).sphere(door + 0.3, 1.0, z + 0.07, 0.03, 0.03, 0.03, 5, 3);
  }
  // Tejado con alero
  b.color(vary(roof, rng, 0.08));
  b.push().translate(0, h, 0).rotateX(0.07);
  b.cube(0, 0, 0.12, w + 0.5, 0.08, d + 0.7);
  b.pop();
}

defProp('correos', (b, _v, rng) => {
  // La oficina de correos del andén: nadie reparte ya, pero los cajones siguen llenos
  kiosk(b, 4.0, 2.8, 2.6, [0.12, 0.25, 0.42], C.rustDark, rng, { x: -0.6, w: 1.5, y: 1.05, h: 0.95, lit: 1.6 }, 1.25);
  // Rótulo ПОЧТА
  b.color(C.yellow, 0.9).cube(0, 2.62, 1.45, 3.4, 0.42, 0.05);
  lettering(b, -0.95, 2.71, 1.48, 5, 0.26, [0.08, 0.14, 0.3]);
  // Buzón, reja de la ventanilla y sacas
  b.color([0.1, 0.2, 0.36]).cube(-1.72, 0.9, 1.52, 0.4, 0.6, 0.22);
  b.color(C.black).cube(-1.72, 1.3, 1.635, 0.26, 0.03, 0.005);
  b.color(C.white, 0.8).cube(-1.72, 1.02, 1.635, 0.2, 0.14, 0.005);
  b.color(C.steelDark);
  for (let i = 0; i < 6; i++) b.cyl(-1.25 + i * 0.26, 1.05, 1.37, 0.012, 0.012, 0.95, 4, 0);
  for (let i = 0; i < 4; i++) sandbag(b, 1.7 + (i % 2) * 0.25, Math.floor(i / 2) * 0.2, 1.75 + (i % 2) * 0.2, 0.7 + i, rng, 0.7, C.canvas);
  b.color(C.paper);
  for (let i = 0; i < 5; i++) b.cube(-0.9 + i * 0.16 + rng.range(-0.03, 0.03), 1.05, 1.56, 0.12, 0.012, 0.09);
  bulb(b, -0.6, 2.25, 1.62, 0.055, C.bulb, 7);
  b.color(C.steelDark).tube([-0.6, 2.55, 1.42, -0.6, 2.45, 1.62, -0.6, 2.32, 1.62], 0.012, 4);
});

defProp('comisaria', (b, _v, rng) => {
  // Puesto de la policía de la Unión
  kiosk(b, 4.8, 3.2, 2.7, [0.3, 0.34, 0.4], C.steelDark, rng, { x: 0.9, w: 1.6, y: 1.1, h: 0.9, lit: 1.1 }, -1.3);
  b.color(C.steelDark);
  for (let i = 0; i < 7; i++) b.cyl(0.2 + i * 0.235, 1.1, 1.57, 0.014, 0.014, 0.9, 4, 0);
  b.cube(0.9, 1.52, 1.57, 1.6, 0.03, 0.03);
  // Placa y faro azul
  b.color([0.1, 0.16, 0.34]).cube(0, 2.72, 1.65, 3.0, 0.36, 0.05);
  lettering(b, -1.2, 2.79, 1.68, 8, 0.2, C.white);
  b.color(C.steelDark).cyl(1.9, 2.95, 1.2, 0.07, 0.07, 0.12, 6);
  b.color([0.25, 0.5, 1]).glow(7).sphere(1.9, 3.16, 1.2, 0.11, 0.13, 0.11, 8, 5);
  b.glow(0);
  b.color(C.tint, 0.8).tinted(1).cube(-1.3, 2.25, 1.615, 0.9, 0.2, 0.01);
  b.tinted(0);
  // Banco y sacos junto a la puerta
  plank(b, 0.1, 0.42, 1.95, 1.3, 0.05, 0.3, rng, C.woodGrey);
  b.color(C.iron).cube(-0.45, 0, 1.95, 0.06, 0.42, 0.3).cube(0.65, 0, 1.95, 0.06, 0.42, 0.3);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 2; i++) sandbag(b, -2.1 + i * 0.3 * (r % 2), r * 0.2, 1.95 + i * 0.35, 1.57, rng);
});

defProp('peaje', (b, _v, rng) => {
  // Garita de peaje del Consejo Mercantil: aquí paga todo el que cruza
  kiosk(b, 1.8, 1.6, 2.35, C.wood, C.rust, rng, { x: 0, w: 1.1, y: 1.0, h: 0.85, lit: 1.8 });
  b.color(C.woodDark).cube(0, 2.4, 0.85, 1.9, 0.5, 0.05);
  // Un cartucho de latón por emblema
  b.color(C.brass).glow(0.5);
  b.push().translate(-0.6, 2.47, 0.89).rotateZ(-0.5);
  b.cube(0, 0, 0, 0.1, 0.3, 0.02);
  b.triangle(-0.05, 0.3, 0.01, 0.05, 0.3, 0.01, 0, 0.42, 0.01);
  b.pop();
  b.glow(0);
  lettering(b, -0.3, 2.55, 0.88, 5, 0.2, C.paper);
  b.color(C.tint, 0.85).tinted(1).cube(0, 0.5, 0.812, 1.7, 0.16, 0.01);
  b.tinted(0);
  // Caja fuerte, balanza y farol
  b.color(C.iron).cube(0.35, 1.0, 0.92, 0.3, 0.2, 0.22);
  b.color(C.brass).cyl(-0.3, 1.0, 0.95, 0.09, 0.07, 0.03, 8);
  bulb(b, 0, 2.2, 1.0, 0.05, C.bulb, 7);
  b.color(C.steelDark).tube([0, 2.38, 0.86, 0, 2.3, 1.0, 0, 2.26, 1.0], 0.01, 4);
});

// --- Tsentral'naya ----------------------------------------------------------------------

/** Tramo de muro en ruinas a lo largo de +X (de 0 a len), con huecos de ventana. */
function ruinWall(b: MeshBuilder, len: number, h0: number, h1: number, rng: Rng, windows: boolean) {
  const n = Math.max(1, Math.round(len / 1.5));
  for (let i = 0; i < n; i++) {
    const xa = (len * i) / n;
    const xb = (len * (i + 1)) / n;
    const h = rng.range(h0, h1);
    const cx = (xa + xb) / 2;
    const w = xb - xa;
    b.color(vary(rng.chance(0.4) ? CHAR : rng.chance(0.5) ? SCORCH : PLASTER, rng, 0.25));
    if (windows && h > 2.7) {
      b.box(cx, 0, 0, w, 1.0, 0.3);
      b.box(xa + 0.17, 1.0, 0, 0.34, 1.35, 0.3);
      b.box(xb - 0.17, 1.0, 0, 0.34, 1.35, 0.3);
      b.box(cx, 2.35, 0, w, h - 2.35, 0.3);
      // Hollín que sube desde el hueco
      b.color(CHAR).cube(cx, 2.3, 0.155, w - 0.5, Math.min(0.8, h - 2.35), 0.004);
    } else b.box(cx, 0, 0, w, h, 0.3);
  }
  b.color(SCORCH, 0.8).box(len / 2, 0, 0, len + 0.04, 0.35, 0.36, 0b110011);
}

defProp('edificioQuemado', (b, _v, rng) => {
  // El edificio del gobierno ruso: ardió con sus archivos en 2019 y nadie lo ha reconstruido
  const W = 11.6;
  const D = 7.6;
  // Suelo calcinado
  b.color(CHAR, 1.4).cube(0, 0, 0, W, 0.04, D);
  // Fachada (+Z) con el hueco de la entrada
  b.push().translate(-W / 2, 0, D / 2 - 0.15);
  ruinWall(b, 4.6, 3.4, 5.6, rng, true);
  b.pop();
  b.push().translate(1.2, 0, D / 2 - 0.15);
  ruinWall(b, 4.6, 2.2, 5.2, rng, true);
  b.pop();
  // Trasera y laterales
  b.push().translate(-W / 2, 0, -D / 2 + 0.15);
  ruinWall(b, W, 1.4, 4.6, rng, true);
  b.pop();
  b.push().translate(-W / 2 + 0.15, 0, D / 2).rotateY(Math.PI / 2);
  ruinWall(b, D, 2.6, 5.4, rng, true);
  b.pop();
  b.push().translate(W / 2 - 0.15, 0, D / 2).rotateY(Math.PI / 2);
  ruinWall(b, D, 0.8, 3.6, rng, false);
  b.pop();
  // Tabique interior
  b.push().translate(-1.2, 0, -D / 2 + 0.3).rotateY(-Math.PI / 2);
  ruinWall(b, 4.2, 0.6, 2.8, rng, false);
  b.pop();
  // Pórtico: dos columnas y un frontón partido
  b.color(vary(PLASTER, rng, 0.1));
  for (const x of [-1.25, 1.25]) {
    b.box(x, 0, D / 2 + 0.55, 0.6, 0.25, 0.6);
    b.lathe(x, 0.25, D / 2 + 0.55, [0.24, 0, 0.22, 0.2, 0.2, 3.0, 0.26, 3.1, 0.28, 3.25], 10, true);
  }
  b.color(SCORCH).cube(-0.5, 3.5, D / 2 + 0.55, 2.3, 0.4, 0.7);
  b.push().translate(0.95, 3.3, D / 2 + 0.7).rotateZ(-0.5);
  b.color(CHAR).cube(0.5, 0, 0, 1.6, 0.36, 0.6);
  b.pop();
  // Vigas carbonizadas caídas
  b.color(CHAR);
  for (let i = 0; i < 9; i++) {
    const x = rng.range(-W / 2 + 0.6, W / 2 - 0.6);
    const z0 = rng.range(-D / 2 + 0.4, -0.5);
    b.beam(x, rng.range(1.2, 4.2), z0, x + rng.range(-2, 2), 0.12, z0 + rng.range(2, 4.5), 0.2, 0.24);
  }
  for (let i = 0; i < 5; i++) b.beam(rng.range(-5, 0), rng.range(3.0, 4.4), -D / 2 + 0.2, rng.range(-5, 0), rng.range(3.0, 4.6), D / 2 - 0.2, 0.18, 0.22);
  // Escombros, muebles quemados y papeles
  for (let i = 0; i < 16; i++) {
    b.color(vary(rng.chance(0.5) ? CHAR : SCORCH, rng, 0.3));
    const v0 = b.vcount;
    b.sphere(rng.range(-W / 2 + 0.8, W / 2 - 0.8), 0.14, rng.range(-D / 2 + 0.8, D / 2 - 0.8), rng.range(0.3, 0.8), rng.range(0.15, 0.4), rng.range(0.3, 0.7), 6, 3);
    b.jitter(v0, 0.12, i + 1);
  }
  b.color(SCORCH);
  b.cube(-3.6, 0.04, -1.6, 1.5, 0.75, 0.75).cube(-3.6, 0.04, 0.6, 1.5, 0.75, 0.75);
  b.push().translate(2.8, 0.04, -2.2).rotateZ(1.2);
  b.color([0.14, 0.16, 0.15]).cube(0, 0, 0, 0.5, 1.4, 0.6);
  b.pop();
  b.color(C.paper, 0.5);
  for (let i = 0; i < 14; i++) {
    b.push().translate(rng.range(-5, 5), 0.05, rng.range(-3, 5)).rotateY(rng.range(0, 6));
    b.cube(0, 0, 0, 0.21, 0.004, 0.3);
    b.pop();
  }
  // El escudo caído a la puerta
  b.push().translate(-0.2, 0.08, D / 2 + 1.5).rotateX(-1.35).rotateZ(0.3);
  b.color([0.22, 0.2, 0.16]).lathe(0, 0, 0, [0.02, 0, 0.75, 0.02, 0.8, 0.08, 0.02, 0.1], 14);
  b.pop();
  // Brasas que alguien mantiene encendidas en la entrada
  b.color(C.ember).glow(2);
  for (let i = 0; i < 4; i++) b.sphere(rng.range(-0.6, 0.6), 0.09, rng.range(1.2, 2.2), 0.05, 0.03, 0.05, 5, 3);
  b.glow(0);
});

// --- Severnyy y Kholodnogo Vozduha -------------------------------------------------------

defProp('escaleraMecanica', (b, _v, rng) => {
  // Tres escaleras mecánicas detenidas que suben hacia el vestíbulo y la superficie (+X)
  const x0 = -5.2;
  const x1 = 3.0;
  const H = 5.2;
  const laneW = 1.05;
  const pitch = 1.75;
  const half = pitch * 1.5 + 0.35;
  const N = 34;
  const dx = (x1 - x0) / N;
  const dy = H / N;
  // Peldaños
  for (let l = -1; l <= 1; l++) {
    for (let i = 0; i < N; i++) {
      b.color(i % 2 ? [0.2, 0.2, 0.21] : [0.25, 0.25, 0.26]);
      b.box(x0 + dx * (i + 0.5), i * dy, l * pitch, dx, dy, laneW, 0b000110);
    }
    // Peines amarillos al pie
    b.color(C.yellow, 0.8).cube(x0 - 0.2, 0.005, l * pitch, 0.4, 0.02, laneW);
  }
  // Balaustradas con pasamanos de goma
  for (let k = 0; k < 4; k++) {
    const z = (k - 1.5) * pitch;
    b.color(vary([0.34, 0.24, 0.16], rng, 0.08));
    b.beam(x0 - 0.5, 0.42, z, x1, H + 0.42, z, pitch - laneW, 0.86);
    b.color(C.steelLight, 0.7);
    b.beam(x0 - 0.5, 0.86, z, x1, H + 0.86, z, pitch - laneW + 0.04, 0.03);
    b.color(C.rubber);
    for (const s of [-1, 1]) b.beam(x0 - 0.5, 0.92, z + s * (pitch - laneW) * 0.36, x1, H + 0.92, z + s * (pitch - laneW) * 0.36, 0.09, 0.07);
    // Las lámparas de antorcha de todo metro soviético
    if (k === 1 || k === 2) {
      for (let i = 0; i < 4; i++) {
        const t = 0.14 + i * 0.24;
        const x = x0 + (x1 - x0) * t;
        const y = H * t + 0.88;
        b.color(C.brass).cyl(x, y, z, 0.035, 0.03, 0.75, 6, 0);
        b.color(C.bulbCold).glow(i === 2 ? 0 : 5).sphere(x, y + 0.86, z, 0.14, 0.15, 0.14, 8, 5);
        b.glow(0);
      }
    }
  }
  // Macizo de hormigón revestido bajo las escaleras
  b.color(vary(MARBLE, rng, 0.05));
  for (const s of [-1, 1]) {
    const z = s * half;
    if (s > 0) b.triangle(x0, 0, z, x1, 0, z, x1, H, z);
    else b.triangle(x1, 0, z, x0, 0, z, x1, H, z);
  }
  // Rellano superior y vestíbulo
  b.color(vary(MARBLE, rng, 0.05), 0.92).box((x1 + 5.5) / 2, 0, 0, 5.5 - x1, H, half * 2 + 1.2);
  b.color([0.5, 0.52, 0.55]).cube((x1 + 5.5) / 2, H, 0, 5.5 - x1, 0.03, half * 2 + 1.2);
  // Arco de salida con la compuerta hermética a medio cerrar
  for (const s of [-1, 1]) b.color(MARBLE, 0.85).box(4.7, H, s * 2.3, 0.7, 3.2, 0.8);
  b.color(MARBLE, 0.8).box(4.7, H + 3.2, 0, 0.7, 0.7, 5.4, 0b111111);
  b.color([0.72, 0.86, 1]).glow(2.6);
  b.quad(5.2, H, 1.9, 5.2, H, -1.9, 5.2, H + 3.2, -1.9, 5.2, H + 3.2, 1.9);
  b.glow(0);
  b.color(vary([0.26, 0.3, 0.3], rng, 0.05)).cube(5.0, H + 0.03, -0.9, 0.2, 3.1, 2.1);
  b.color(C.red, 0.8);
  b.push().translate(4.88, H + 1.6, -0.9).rotateZ(Math.PI / 2);
  b.lathe(0, 0, 0, [0.3, 0, 0.34, 0.03, 0.3, 0.06], 12);
  b.pop();
  // Rótulo: SALIDA A LA CIUDAD
  b.push().translate(4.33, H + 3.36, 0).rotateY(-Math.PI / 2);
  b.color([0.1, 0.2, 0.4]).cube(0, 0, 0, 3.6, 0.42, 0.03);
  lettering(b, -1.5, 0.1, 0.02, 11, 0.2, C.white, 0.6);
  b.pop();
  // Nieve que entra de la superficie
  b.color([0.8, 0.86, 0.92]);
  for (let i = 0; i < 8; i++) {
    const t = rng.range(0.72, 1.0);
    const v0 = b.vcount;
    b.sphere(x0 + (x1 - x0) * t + rng.range(0, 1.6), H * Math.min(1, t) + 0.04, rng.range(-half + 0.4, half - 0.4), rng.range(0.4, 0.9), 0.1, rng.range(0.3, 0.7), 7, 3);
    b.jitter(v0, 0.04, i + 2);
  }
  // Barreras al pie
  b.color(C.steelLight, 0.7);
  for (let k = 0; k < 4; k++) {
    const z = (k - 1.5) * pitch;
    b.cyl(x0 - 0.75, 0, z, 0.05, 0.05, 0.95, 6);
  }
});

defProp('pozoAire', (b, _v, rng) => {
  // Pozo de ventilación: el aire helado de la superficie baja por él día y noche
  const R = 3.0;
  const c = vary(C.concrete, rng, 0.05);
  b.color(c);
  b.lathe(0, 0, 0, [R + 0.3, 0, R + 0.3, 0.45, R, 0.6, R, 2.0], 22);
  // Anillo de lamas por donde sale el aire
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    b.push().translate(Math.cos(a) * (R - 0.05), 2.0, Math.sin(a) * (R - 0.05)).rotateY(-a);
    b.color(c, 0.85).box(0, 0, 0, 0.3, 1.5, 0.22);
    b.pop();
  }
  b.color(C.steelDark);
  for (let k = 0; k < 5; k++) b.lathe(0, 2.12 + k * 0.28, 0, [R - 0.02, 0.1, R + 0.1, 0], 22);
  b.color([0.02, 0.04, 0.07]).lathe(0, 2.0, 0, [R - 0.3, 0, R - 0.3, 1.5], 22);
  // Fuste hasta la bóveda
  b.color(c).lathe(0, 3.5, 0, [R, 0, R + 0.12, 0.12, R, 0.24, R, 3.3, R + 0.2, 3.4, R + 0.2, 3.7], 22);
  b.color(c, 0.7);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    b.push().translate(Math.cos(a) * (R + 0.02), 3.8, Math.sin(a) * (R + 0.02)).rotateY(-a);
    b.cube(0, 0, 0, 0.1, 3.0, 0.5);
    b.pop();
  }
  // Boca: rejilla, aspas y el resplandor azul del día polar
  b.color([0.55, 0.75, 1]).glow(1.6).disc(0, 6.75, 0, R - 0.1, 22, 1);
  b.glow(0).color(C.steelDark);
  b.cyl(0, 6.8, 0, 0.4, 0.4, 0.3, 10, 3);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.push().translate(0, 6.95, 0).rotateY(a).rotateX(0.35);
    b.cube(1.55, 0, 0, 2.5, 0.04, 0.7);
    b.pop();
  }
  for (let i = -3; i <= 3; i++) {
    const w = Math.sqrt(Math.max(0, R * R - (i * 0.8) * (i * 0.8)));
    b.cube(0, 7.18, i * 0.8, w * 2, 0.05, 0.06);
    b.cube(i * 0.8, 7.18, 0, 0.06, 0.05, w * 2);
  }
  // Escarcha y carámbanos
  b.color([0.82, 0.9, 0.96], 0.95);
  b.lathe(0, 0.012, 0, [R + 0.3, 0, R + 1.5, 0.004], 22);
  for (let i = 0; i < 40; i++) {
    const a = rng.range(0, Math.PI * 2);
    const y = rng.chance(0.5) ? 2.05 : 3.5;
    const l = rng.range(0.15, 0.6);
    b.cyl(Math.cos(a) * (R + 0.04), y - l, Math.sin(a) * (R + 0.04), 0.004, 0.035, l, 4, 0);
  }
  for (let i = 0; i < 10; i++) {
    const a = rng.range(0, Math.PI * 2);
    const v0 = b.vcount;
    b.sphere(Math.cos(a) * (R + 0.5), 0.05, Math.sin(a) * (R + 0.5), rng.range(0.3, 0.7), 0.1, rng.range(0.3, 0.6), 6, 3);
    b.jitter(v0, 0.04, i + 5);
  }
  // Conductos hacia la estación y escalera de gato
  b.color(vary(C.steel, rng, 0.08));
  for (const s of [-1, 1]) b.tube([s * 1.6, 4.4, R - 0.1, s * 1.7, 4.6, R + 0.9, s * 1.7, 3.4, R + 1.25, s * 1.7, 0, R + 1.25], 0.32, 8);
  b.color(C.steelDark);
  for (let i = 0; i < 18; i++) b.cube(-R - 0.08, 0.5 + i * 0.36, 0, 0.05, 0.03, 0.5);
  b.cube(-R - 0.1, 0.4, 0.26, 0.04, 6.4, 0.04).cube(-R - 0.1, 0.4, -0.26, 0.04, 6.4, 0.04);
  // Franja de peligro
  for (let i = 0; i < 44; i++) {
    const a0 = (i / 44) * Math.PI * 2;
    const a1 = ((i + 1) / 44) * Math.PI * 2;
    b.color(i % 2 ? C.black : C.yellow, 0.85);
    const r = R + 0.305;
    b.quad(Math.cos(a1) * r, 0.1, Math.sin(a1) * r, Math.cos(a0) * r, 0.1, Math.sin(a0) * r, Math.cos(a0) * r, 0.38, Math.sin(a0) * r, Math.cos(a1) * r, 0.38, Math.sin(a1) * r);
  }
});

// --- Salas de gobierno -----------------------------------------------------------------------

function chair(b: MeshBuilder, x: number, z: number, rot: number, rng: Rng, col: RGB = C.woodDark) {
  b.push().translate(x, 0, z).rotateY(rot);
  b.color(vary(col, rng, 0.12));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.cube(sx * 0.19, 0, sz * 0.19, 0.04, 0.45, 0.04);
  b.cube(0, 0.45, 0, 0.44, 0.05, 0.44);
  b.cube(0, 0.5, -0.2, 0.44, 0.5, 0.04);
  b.color(C.clothRed, 0.7).cube(0, 0.5, 0, 0.38, 0.03, 0.38);
  b.pop();
}

defProp('mesaConferencia', (b, _v, rng) => {
  // La mesa redonda de la Conferencia de Zvezdnaya (2021)
  b.color(C.woodDark).lathe(0, 0, 0, [0.5, 0, 0.3, 0.1, 0.22, 0.66, 0.6, 0.72], 12);
  b.color(vary(C.wood, rng, 0.06)).lathe(0, 0.72, 0, [1.7, 0, 1.74, 0.03, 1.7, 0.07], 24, true, true);
  b.color([0.12, 0.3, 0.2]).disc(0, 0.795, 0, 1.52, 24, 1);
  // Sillas, carpetas y vasos
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    if (i !== 4) chair(b, Math.cos(a) * 2.02, Math.sin(a) * 2.02, -a - Math.PI / 2, rng);
    else {
      // Una silla volcada: no todos los delegados se fueron en paz
      b.push().translate(Math.cos(a) * 2.2, 0.22, Math.sin(a) * 2.2).rotateZ(1.5);
      chair(b, 0, 0, 0.6, rng);
      b.pop();
    }
    b.push().translate(Math.cos(a) * 1.25, 0.8, Math.sin(a) * 1.25).rotateY(-a + rng.range(-0.3, 0.3));
    b.color(vary(i % 2 ? C.paper : C.clothBlue, rng, 0.1)).cube(0, 0, 0, 0.3, 0.012, 0.22);
    b.color(C.glass).cyl(0.28, 0, 0.05, 0.03, 0.025, 0.1, 6);
    b.pop();
  }
  // Banderines de las estaciones fundadoras y una lámpara de pantalla verde
  b.color(C.brass).cyl(0, 0.8, 0, 0.12, 0.1, 0.03, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.color(C.brass).cyl(Math.cos(a) * 0.22, 0.8, Math.sin(a) * 0.22, 0.008, 0.008, 0.42, 4, 0);
    b.color(i === 0 ? C.tint : [C.clothRed, C.yellow, C.white][i - 1], 0.85).tinted(i === 0 ? 1 : 0);
    b.cube(Math.cos(a) * 0.22 + 0.09, 1.08, Math.sin(a) * 0.22, 0.18, 0.12, 0.006);
    b.tinted(0);
  }
  b.color(C.brass).cyl(0.75, 0.8, -0.4, 0.07, 0.05, 0.03, 8).cyl(0.75, 0.83, -0.4, 0.012, 0.012, 0.3, 5, 0);
  b.color([0.1, 0.4, 0.22]).glow(0.6).lathe(0.75, 1.1, -0.4, [0.16, 0, 0.06, 0.1], 10, true);
  bulb(b, 0.75, 1.08, -0.4, 0.035, C.bulb, 6);
});

defProp('tribuna', (b, _v, rng) => {
  // Tribuna de mítines: tarima, atril y megáfonos
  for (let i = 0; i < 8; i++) plank(b, -2.1 + i * 0.6, 0.3, 0, 0.58, 0.06, 2.6, rng, C.wood);
  b.color(C.woodDark).box(0, 0, 0, 4.76, 0.3, 2.56, 0b110011);
  b.color(C.woodGrey).cube(0, 0, 1.5, 1.4, 0.15, 0.4);
  // Paño frontal con el emblema
  b.color(C.tint, 0.9).tinted(1);
  b.quad(-2.38, 0.02, 1.29, 2.38, 0.02, 1.29, 2.38, 0.36, 1.29, -2.38, 0.36, 1.29);
  b.tinted(0);
  // Atril
  b.color(vary(C.woodDark, rng, 0.08)).box(0, 0.36, 0.85, 0.7, 1.05, 0.45);
  b.push().translate(0, 1.41, 0.85).rotateX(-0.3);
  b.cube(0, 0, 0, 0.8, 0.04, 0.55);
  b.color(C.paper).cube(0, 0.04, 0, 0.3, 0.008, 0.4);
  b.pop();
  b.color(C.tint, 0.9).tinted(1).cube(0, 0.5, 1.08, 0.6, 0.75, 0.012);
  b.tinted(0);
  b.color(C.steelDark).tube([0.2, 1.42, 0.9, 0.2, 1.7, 0.95, 0.12, 1.78, 1.02], 0.012, 4);
  b.color(C.black).sphere(0.1, 1.79, 1.04, 0.035, 0.035, 0.045, 6, 4);
  // Pancarta entre dos mástiles
  b.color(C.woodDark);
  b.cyl(-2.2, 0.36, -1.1, 0.04, 0.035, 3.4, 6).cyl(2.2, 0.36, -1.1, 0.04, 0.035, 3.4, 6);
  b.color(C.tint, 0.95).tinted(1);
  cloth(b, -2.2, 3.6, -1.1, 2.2, 3.6, -1.1, 1.1, 10, 0.04, rng);
  b.tinted(0);
  lettering(b, -1.8, 2.9, -1.05, 12, 0.24, C.white);
  // Megáfonos
  for (const s of [-1, 1]) {
    b.push().translate(s * 2.2, 3.45, -1.0).rotateZ(s * -0.5).rotateX(0.9);
    b.color(C.steel).lathe(0, 0, 0, [0.04, 0, 0.06, 0.1, 0.2, 0.42], 10);
    b.color(C.black).disc(0, 0.41, 0, 0.19, 10, 1);
    b.pop();
  }
});

defProp('asamblea', (b, _v, rng) => {
  // Mesa de la presidencia del Consejo: paño, urna y campanilla
  b.color(C.woodDark);
  for (const x of [-1.25, 1.25]) for (const z of [-0.45, 0.45]) b.cube(x, 0, z, 0.08, 0.78, 0.08);
  b.color(vary(C.wood, rng, 0.08)).cube(0, 0.78, 0, 2.8, 0.06, 1.1);
  b.color(C.tint, 0.9).tinted(1);
  b.cube(0, 0.845, 0, 2.7, 0.012, 1.0);
  b.quad(-1.36, 0.1, 0.56, 1.36, 0.1, 0.56, 1.36, 0.85, 0.56, -1.36, 0.85, 0.56, 0.75);
  b.tinted(0);
  b.push().translate(0, 0.47, 0.57);
  emblem(b, 2, 0.5);
  b.pop();
  // Urna de votación
  b.color(vary(C.woodLight, rng, 0.08)).cube(-0.75, 0.86, 0, 0.5, 0.42, 0.4);
  b.color(C.black).cube(-0.75, 1.281, 0, 0.26, 0.004, 0.03);
  b.color(C.red).cube(-0.75, 0.98, 0.202, 0.3, 0.16, 0.004);
  // Campanilla, jarra, actas y un mazo
  b.color(C.brass).lathe(0.2, 0.86, 0.1, [0.07, 0, 0.06, 0.06, 0.02, 0.1, 0.012, 0.16], 8);
  b.color(C.glass).cyl(0.75, 0.86, -0.15, 0.06, 0.045, 0.24, 8);
  b.color(C.paper);
  for (let i = 0; i < 3; i++) b.cube(0.4 + i * 0.3, 0.86, 0.25, 0.22, 0.012 + i * 0.008, 0.3);
  b.color(C.woodDark).cube(1.05, 0.86, 0.3, 0.2, 0.07, 0.08).cube(1.05, 0.875, 0.42, 0.03, 0.03, 0.22);
});

defProp('estatua', (b, v, rng) => {
  // Bronce de antes de la guerra sobre un pedestal de granito
  b.color(vary([0.34, 0.3, 0.3], rng, 0.05));
  b.box(0, 0, 0, 1.3, 0.25, 1.3);
  b.box(0, 0.25, 0, 1.05, 1.15, 1.05);
  b.box(0, 1.4, 0, 1.2, 0.14, 1.2);
  b.color(C.brass, 0.7).cube(0, 0.7, 0.53, 0.6, 0.3, 0.012);
  b.color(C.tint, 0.7).tinted(1).cube(0, 0.36, 0.53, 0.9, 0.1, 0.012);
  b.tinted(0);
  // Figura: obrero del metro con el martillo neumático al hombro
  const c = vary(BRONZE, rng, 0.08);
  b.color(c);
  for (const s of [-1, 1]) {
    b.cyl(s * 0.16, 1.54, s * 0.05, 0.1, 0.09, 0.95, 7, 0);
    b.cube(s * 0.16, 1.54, s * 0.05 + 0.06, 0.16, 0.08, 0.3);
  }
  b.lathe(0, 2.45, 0, [0.22, 0, 0.26, 0.25, 0.3, 0.55, 0.2, 0.72, 0.09, 0.78], 9);
  b.sphere(0, 3.36, 0.02, 0.13, 0.15, 0.14, 8, 5);
  b.lathe(0, 3.42, 0.02, [0.17, 0, 0.14, 0.07, 0.05, 0.12], 8, true);
  // Brazos y herramienta
  b.beam(-0.28, 3.1, 0, -0.42, 2.55, 0.12, 0.1, 0.1);
  b.beam(-0.42, 2.55, 0.12, -0.3, 2.3, 0.3, 0.09, 0.09);
  b.beam(0.28, 3.1, 0, 0.5, 3.0, 0.2, 0.1, 0.1);
  b.beam(0.5, 3.0, 0.2, 0.36, 3.3, 0.1, 0.09, 0.09);
  b.color(c, 0.8).beam(0.6, 3.5, -0.4, 0.2, 3.15, 0.45, 0.08, 0.08);
  b.cube(0.62, 3.42, -0.48, 0.22, 0.2, 0.22);
  // Cardenillo y cagadas de murciélago
  b.color([0.3, 0.5, 0.42], 0.7);
  for (let i = 0; i < 6; i++) b.sphere(rng.range(-0.2, 0.2), rng.range(2.6, 3.3), rng.range(0.1, 0.28), 0.05, 0.09, 0.02, 5, 3);
  void v;
});

// --- Izumrudnaya -------------------------------------------------------------------------------

const EMERALD: RGB = [0.08, 0.5, 0.34];
const JADE: RGB = [0.2, 0.62, 0.46];

defProp('manantial', (b, _v, rng) => {
  // El manantial esmeralda: agua limpia que brota entre los azulejos verdes
  b.color(vary([0.5, 0.55, 0.5], rng, 0.05)).lathe(0, 0, 0, [2.15, 0, 2.15, 0.34, 2.0, 0.42, 1.72, 0.42, 1.68, 0.12], 20);
  // Azulejos del brocal
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    b.push().translate(Math.cos(a) * 2.16, 0.04, Math.sin(a) * 2.16).rotateY(-a + Math.PI / 2);
    b.color(vary(i % 3 === 0 ? [0.85, 0.82, 0.7] : i % 3 === 1 ? EMERALD : JADE, rng, 0.12)).cube(0, 0, 0, 0.6, 0.28, 0.02);
    b.pop();
  }
  // Agua
  b.color([0.1, 0.9, 0.6]).glow(1.5).disc(0, 0.26, 0, 1.7, 20, 1);
  b.color([0.6, 1, 0.85]).glow(2.4).disc(0.2, 0.265, -0.5, 0.5, 12, 1);
  b.glow(0);
  // La roca de la que mana y el caño
  for (let i = 0; i < 5; i++) {
    b.color(vary([0.3, 0.36, 0.32], rng, 0.15));
    const v0 = b.vcount;
    b.sphere(rng.range(-0.3, 0.6), 0.5 + i * 0.22, -1.0 + rng.range(-0.3, 0.3), rng.range(0.5, 0.9) - i * 0.08, rng.range(0.35, 0.5), rng.range(0.45, 0.7), 7, 4);
    b.jitter(v0, 0.1, i + 9);
  }
  b.color(C.copper).tube([0.2, 1.25, -0.9, 0.2, 1.3, -0.6, 0.2, 1.2, -0.45], 0.05, 6);
  b.color([0.5, 1, 0.8]).glow(2.2).tube([0.2, 1.2, -0.45, 0.2, 0.9, -0.4, 0.2, 0.27, -0.42], 0.03, 5);
  b.glow(0);
  // Musgo, ofrendas y cántaros
  b.color([0.12, 0.34, 0.14]);
  for (let i = 0; i < 8; i++) b.sphere(rng.range(-0.6, 0.9), rng.range(0.5, 1.4), -0.7 + rng.range(-0.2, 0.3), 0.18, 0.08, 0.16, 6, 3);
  for (let i = 0; i < 5; i++) {
    const a = 0.6 + i * 0.5;
    b.color(vary(C.copper, rng, 0.2)).lathe(Math.cos(a) * 2.5, 0, Math.sin(a) * 2.5, [0.1, 0, 0.17, 0.14, 0.14, 0.3, 0.06, 0.38, 0.08, 0.44], 8);
  }
  for (let i = 0; i < 6; i++) {
    const a = 3.6 + i * 0.3;
    b.color(C.paper).cyl(Math.cos(a) * 1.86, 0.42, Math.sin(a) * 1.86, 0.02, 0.02, 0.1, 5);
    b.color([1, 0.75, 0.3]).glow(7).sphere(Math.cos(a) * 1.86, 0.55, Math.sin(a) * 1.86, 0.012, 0.03, 0.012, 4, 3);
    b.glow(0);
  }
});

defProp('mihrab', (b, _v, rng) => {
  // Nicho de oración de azulejos verdes, orientado por la brújula de un zapador
  const c = vary([0.82, 0.8, 0.7], rng, 0.04);
  b.color(c).box(0, 0, -0.2, 3.2, 3.4, 0.5);
  // Mosaico
  for (let j = 0; j < 9; j++) {
    for (let i = 0; i < 10; i++) {
      const x = -1.44 + i * 0.32;
      const y = 0.3 + j * 0.32;
      // El hueco del arco apuntado
      const inside = Math.abs(x) < 0.72 && y < 2.2 - Math.abs(x) * 0.9;
      if (inside) continue;
      b.color(vary((i + j) % 3 === 0 ? [0.85, 0.82, 0.68] : (i + j) % 3 === 1 ? EMERALD : JADE, rng, 0.14));
      b.cube(x, y, 0.052, 0.29, 0.29, 0.012);
    }
  }
  // Nicho
  b.color([0.03, 0.12, 0.09]);
  b.quad(-0.72, 0.3, 0.056, 0.72, 0.3, 0.056, 0.72, 1.55, 0.056, -0.72, 1.55, 0.056);
  b.triangle(-0.72, 1.55, 0.056, 0.72, 1.55, 0.056, 0, 2.3, 0.056);
  b.color([0.2, 1, 0.7]).glow(1.6);
  for (const s of [-1, 1]) {
    b.beam(s * 0.72, 0.3, 0.07, s * 0.72, 1.55, 0.07, 0.035, 0.035);
    b.beam(s * 0.72, 1.55, 0.07, 0, 2.3, 0.07, 0.035, 0.035);
  }
  b.glow(0);
  // Cornisa y lámparas colgantes
  b.color(c, 0.85).box(0, 3.4, -0.2, 3.4, 0.16, 0.62, 0b111111);
  for (const s of [-1, 1]) {
    b.color(C.brass).tube([s * 1.1, 3.4, 0.25, s * 1.1, 2.75, 0.25], 0.008, 3);
    b.lathe(s * 1.1, 2.5, 0.25, [0.02, 0, 0.1, 0.1, 0.08, 0.22, 0.02, 0.26], 8);
    bulb(b, s * 1.1, 2.62, 0.25, 0.04, [0.7, 1, 0.8], 6);
  }
  // Estante con libros
  b.color(C.woodDark).cube(1.25, 0.9, 0.2, 0.5, 0.04, 0.26);
  for (let i = 0; i < 4; i++) b.color(vary(C.clothGreen, rng, 0.25)).cube(1.1 + i * 0.1, 0.94, 0.2, 0.07, 0.24, 0.18);
});

// --- Vhlainska -------------------------------------------------------------------------------------

defProp('trono', (b, _v, rng) => {
  // El trono del Tuerto: asientos de vagón, raíles y el botín de cien caravanas
  // Tarima de palés y chapa
  for (let i = 0; i < 6; i++) plank(b, -1.3 + i * 0.52, 0.28, 0, 0.5, 0.05, 2.6, rng, C.woodGrey);
  b.color(C.woodDark).box(0, 0, 0, 3.1, 0.28, 2.6, 0b110011);
  b.color(vary(C.rust, rng, 0.1)).cube(0, 0.33, 0.4, 1.9, 0.02, 1.5);
  // Pieles
  b.color([0.3, 0.24, 0.2]);
  const v0 = b.vcount;
  b.sphere(0, 0.36, 0.9, 0.9, 0.03, 0.55, 8, 3);
  b.jitter(v0, 0.05, 4);
  // Sillón: asiento de cuero de vagón con respaldo de carriles
  b.color(vary(C.leather, rng, 0.1));
  b.cube(0, 0.35, -0.3, 1.1, 0.5, 0.9);
  b.cube(0, 0.85, -0.3, 1.0, 0.14, 0.8);
  b.cube(0, 0.85, -0.7, 1.1, 1.3, 0.18);
  for (const s of [-1, 1]) {
    b.color(C.woodDark).cube(s * 0.62, 0.35, -0.3, 0.16, 0.85, 0.9);
    b.color(C.bone).sphere(s * 0.62, 1.28, 0.1, 0.1, 0.11, 0.12, 7, 4);
    b.color(C.black).sphere(s * 0.62 + 0.04, 1.3, 0.2, 0.025, 0.03, 0.02, 4, 3).sphere(s * 0.62 - 0.04, 1.3, 0.2, 0.025, 0.03, 0.02, 4, 3);
  }
  b.color(C.rustDark);
  for (let i = 0; i < 5; i++) {
    const x = -0.5 + i * 0.25;
    const h = 2.7 + (i === 2 ? 0.6 : i % 2 ? 0.25 : 0);
    b.cube(x, 0.33, -0.86, 0.09, h, 0.12);
    b.triangle(x - 0.045, h + 0.33, -0.8, x + 0.045, h + 0.33, -0.8, x, h + 0.6, -0.8);
  }
  // El letrero de la estación, arrancado, por corona
  b.push().translate(0, 2.55, -0.76).rotateZ(0.06);
  b.color(C.white, 0.7).cube(0, 0, 0, 1.7, 0.4, 0.03);
  lettering(b, -0.72, 0.1, 0.02, 7, 0.2, C.black);
  b.color(C.tint, 0.85).tinted(1).cube(0, 0.0, 0.02, 1.7, 0.07, 0.006);
  b.tinted(0);
  b.pop();
  // Botín a los pies
  crate(b, -1.15, 0.33, 0.6, 0.55, 0.5, rng, C.wood, 0.3);
  crate(b, 1.15, 0.33, 0.2, 0.5, 0.42, rng, C.woodLight, -0.2);
  b.color(C.olive).cube(1.1, 0.33, 0.85, 0.7, 0.3, 0.36);
  drum(b, -1.2, 0.33, -0.7, C.red, rng);
  b.color(C.brass).glow(0.5);
  for (let i = 0; i < 14; i++) b.cyl(rng.range(-1.3, -0.7), 0.335, rng.range(0.95, 1.2), 0.02, 0.02, 0.07, 5);
  b.glow(0);
  b.color(C.glass);
  for (let i = 0; i < 4; i++) b.cyl(0.5 + i * 0.1, 0.35, 1.0 + (i % 2) * 0.1, 0.035, 0.03, 0.24, 6);
  // Picas con calaveras a los lados
  for (const s of [-1, 1]) {
    b.color(C.woodDark).cyl(s * 1.45, 0, -1.1, 0.03, 0.02, 2.4, 5);
    b.color(C.bone, 0.85).sphere(s * 1.45, 2.45, -1.1, 0.1, 0.11, 0.12, 7, 4);
    b.color(C.clothRed, 0.6);
    cloth(b, s * 1.45, 2.2, -1.07, s * 1.45 + 0.01, 2.2, -0.9, 0.5, 2, 0.02, rng);
  }
});

// --- Industria pesada ---------------------------------------------------------------------------------

defProp('fundicion', (b, _v, rng) => {
  // Cubilote de Mostovaya: funde los carriles del puente en lingotes
  const c = vary([0.3, 0.14, 0.1], rng, 0.1);
  b.color(C.concreteDark).cyl(0, 0, -0.3, 1.35, 1.35, 0.3, 14);
  b.color(c).lathe(0, 0.3, -0.3, [1.15, 0, 1.2, 0.3, 1.2, 2.5, 0.95, 3.1, 0.6, 3.5], 14);
  b.color(C.iron);
  for (const y of [0.9, 1.7, 2.5]) b.lathe(0, y, -0.3, [1.22, 0, 1.26, 0.05, 1.22, 0.1], 14);
  // Campana y chimenea
  b.color(vary(C.rustDark, rng, 0.1)).lathe(0, 3.8, -0.3, [0.62, 0, 0.5, 0.5, 0.36, 0.8, 0.36, 2.6], 10);
  // Boca de carga y piquera
  b.color(C.soot).cube(0, 1.5, 0.82, 0.8, 0.7, 0.2);
  b.color([1, 0.5, 0.12]).glow(7).cube(0, 1.58, 0.9, 0.6, 0.5, 0.06);
  b.glow(0).color(C.iron);
  b.cube(0, 0.55, 0.95, 0.3, 0.2, 0.5);
  b.color([1, 0.6, 0.15]).glow(6).cube(0, 0.72, 0.98, 0.12, 0.03, 0.44);
  // Cuchara de colada sobre caballete
  b.glow(0).color(C.steelDark);
  for (const s of [-1, 1]) {
    b.beam(s * 0.65, 0, 1.25, s * 0.55, 0.95, 1.4, 0.07, 0.07);
    b.beam(s * 0.65, 0, 1.55, s * 0.55, 0.95, 1.4, 0.07, 0.07);
  }
  b.push().translate(0, 0.95, 1.4).rotateX(0.25);
  b.color(C.iron).lathe(0, -0.45, 0, [0.28, 0, 0.42, 0.1, 0.46, 0.6], 10, false, true);
  b.color([1, 0.62, 0.2]).glow(8).disc(0, 0.08, 0, 0.42, 10, 1);
  b.glow(0);
  b.pop();
  b.color(C.steelDark).beam(-0.7, 0.95, 1.4, 0.7, 0.95, 1.4, 0.05, 0.05);
  // Lingoteras, escoria y fuelle
  for (let i = 0; i < 4; i++) {
    const x = -1.3 + (i % 2) * 0.45;
    const z = 0.9 + Math.floor(i / 2) * 0.5;
    b.color(C.iron).cube(x, 0, z, 0.4, 0.14, 0.4);
    b.color(i < 2 ? [1, 0.45, 0.1] : [0.5, 0.2, 0.08]).glow(i < 2 ? 4 : 0.6).cube(x, 0.14, z, 0.3, 0.012, 0.3);
    b.glow(0);
  }
  for (let i = 0; i < 6; i++) {
    b.color(vary(C.soot, rng, 0.3), 1.6);
    const v0 = b.vcount;
    b.sphere(1.2 + rng.range(-0.3, 0.3), 0.12, 0.9 + rng.range(-0.4, 0.5), rng.range(0.2, 0.4), rng.range(0.1, 0.22), rng.range(0.2, 0.36), 6, 3);
    b.jitter(v0, 0.08, i + 11);
  }
  b.color(C.rust).tube([1.2, 1.2, -0.3, 1.5, 1.3, -0.3, 1.5, 0.5, -0.9], 0.11, 6);
  b.color(C.leather).sphere(1.5, 0.4, -1.15, 0.3, 0.26, 0.4, 7, 4);
});

defProp('arsenal', (b, v, rng) => {
  if (v === 1) {
    // Taquillas de la junta
    for (let i = 0; i < 3; i++) {
      const x = -0.92 + i * 0.92;
      b.color(vary(C.olive, rng, 0.08)).box(x, 0, 0, 0.9, 2.0, 0.7);
      b.color(C.oliveDark).cube(x, 0.08, 0.352, 0.82, 1.84, 0.006);
      b.color(C.steelDark);
      for (let k = 0; k < 4; k++) b.cube(x, 1.55 + k * 0.07, 0.357, 0.5, 0.025, 0.004);
      b.color(C.brass).cube(x + 0.3, 1.0, 0.36, 0.05, 0.12, 0.02);
      b.color(C.white, 0.6).cube(x - 0.2, 1.25, 0.357, 0.22, 0.1, 0.004);
    }
    b.color(C.steelDark).sphere(-0.9, 2.1, 0, 0.16, 0.12, 0.2, 8, 4, 0.5, 1);
    b.color(C.olive).cube(0.5, 2.0, 0, 0.6, 0.22, 0.36);
    return;
  }
  // Armero: fusiles en pie y cajas de munición
  b.color(C.woodDark);
  b.box(-1.35, 0, 0, 0.08, 1.9, 0.6);
  b.box(1.35, 0, 0, 0.08, 1.9, 0.6);
  b.cube(0, 0.25, 0, 2.7, 0.06, 0.6);
  b.cube(0, 1.1, -0.2, 2.7, 0.1, 0.12);
  b.cube(0, 1.84, 0, 2.78, 0.06, 0.66);
  b.color(C.woodGrey).cube(0, 0.31, -0.28, 2.7, 1.53, 0.03);
  for (let i = 0; i < 9; i++) {
    const x = -1.12 + i * 0.28;
    b.push().translate(x, 0.31, 0.02).rotateX(-0.13);
    b.color(vary(C.wood, rng, 0.2)).cube(0, 0, 0, 0.055, 0.42, 0.11);
    b.color(C.iron).cube(0, 0.42, 0, 0.045, 0.3, 0.07);
    b.cyl(0, 0.72, 0, 0.014, 0.014, 0.5, 5);
    if (i % 3 === 0) b.cube(0, 0.4, 0.07, 0.035, 0.22, 0.07);
    b.pop();
  }
  for (let i = 0; i < 3; i++) {
    b.color(vary(C.olive, rng, 0.1)).cube(-0.85 + i * 0.85, 0, 0.02, 0.7, 0.24, 0.42);
    b.color(C.yellow, 0.7).cube(-0.85 + i * 0.85, 0.08, 0.232, 0.3, 0.07, 0.004);
  }
  b.color(C.tint, 0.8).tinted(1).cube(0, 1.9, 0, 0.9, 0.3, 0.02);
  b.tinted(0);
});

defProp('radio', (b, _v, rng) => {
  // Emisora de campaña: receptor de válvulas, manipulador y antena hasta la bóveda
  for (let i = 0; i < 3; i++) plank(b, 0, 0.74, -0.26 + i * 0.26, 1.4, 0.045, 0.25, rng, C.wood);
  b.color(C.woodDark);
  for (const x of [-0.6, 0.6]) for (const z of [-0.32, 0.32]) b.cube(x, 0, z, 0.06, 0.74, 0.06);
  // Receptor
  b.color(vary(C.olive, rng, 0.06)).cube(-0.2, 0.785, -0.1, 0.8, 0.42, 0.36);
  b.color(C.black).cube(-0.2, 0.83, 0.082, 0.72, 0.33, 0.004);
  b.color([1, 0.8, 0.3]).glow(3.5).cube(-0.3, 1.02, 0.086, 0.4, 0.08, 0.003);
  b.color([1, 0.3, 0.2]).glow(5).cube(0.08, 1.1, 0.086, 0.03, 0.03, 0.003);
  b.glow(0).color(C.steelLight);
  for (let i = 0; i < 4; i++) {
    b.push().translate(-0.45 + i * 0.17, 0.9, 0.086).rotateX(Math.PI / 2);
    b.cyl(0, 0, 0, 0.035, 0.03, 0.03, 8);
    b.pop();
  }
  b.color(C.steelDark).cube(0.12, 0.86, 0.086, 0.14, 0.2, 0.003);
  // Fuente, manipulador, cascos y cuaderno
  b.color(C.iron).cube(0.48, 0.785, -0.12, 0.3, 0.26, 0.28);
  b.color(C.brass).cube(0.3, 0.785, 0.22, 0.14, 0.02, 0.07).cube(0.3, 0.805, 0.22, 0.1, 0.015, 0.02);
  b.color(C.black).sphere(0.33, 0.83, 0.22, 0.02, 0.012, 0.02, 5, 3);
  b.color(C.rubber);
  b.tube([-0.5, 0.8, 0.22, -0.5, 0.9, 0.18, -0.38, 0.9, 0.18, -0.38, 0.8, 0.22], 0.012, 4);
  b.sphere(-0.5, 0.81, 0.24, 0.045, 0.03, 0.045, 6, 3).sphere(-0.38, 0.81, 0.24, 0.045, 0.03, 0.045, 6, 3);
  b.color(C.paper).cube(0.0, 0.785, 0.24, 0.2, 0.012, 0.15);
  // Mástil con vientos y dipolo
  b.color(C.steelDark).cyl(0.62, 0, -0.34, 0.03, 0.018, 5.6, 5);
  b.color(C.steelLight, 0.7);
  for (let i = 0; i < 3; i++) b.beam(0.62 - 0.5 + i * 0.05, 4.4 + i * 0.4, -0.34, 0.62 + 0.5 - i * 0.05, 4.4 + i * 0.4, -0.34, 0.015, 0.015);
  b.color(C.burlap, 0.7);
  b.tube([0.62, 3.6, -0.34, 1.4, 0.02, 0.5], 0.006, 3).tube([0.62, 3.6, -0.34, -0.3, 0.02, -1.1], 0.006, 3);
  b.color(C.rubber).tube([0.62, 1.0, -0.34, 0.4, 1.1, -0.3, 0.2, 1.2, -0.2], 0.01, 3);
});

