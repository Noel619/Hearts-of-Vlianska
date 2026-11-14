// Criaturas de los túneles: cuadrúpedos con esqueleto y animación propios
// (ratas, skrebuns, cerdos) y bípedos monstruosos que reutilizan el esqueleto
// humano (glubinnik, sheptun).

import * as THREE from 'three';
import type { CreatureDef } from '../../data/criaturas';
import { hash2, smoothstep } from '../../core/math';
import { lin, mixc, scalec, type RGB } from '../geo';
import { HB } from './humanoid';
import { SkinBuilder, type BoneDef, type W } from './skin';

// ---------------------------------------------------------------------------
// Cuadrúpedo
// ---------------------------------------------------------------------------

export const QUAD_BONES: BoneDef[] = [
  { name: 'hips', parent: -1, pos: [0, 0.62, -0.35] },
  { name: 'spine', parent: 0, pos: [0, 0.66, -0.05] },
  { name: 'chest', parent: 1, pos: [0, 0.66, 0.28] },
  { name: 'neck', parent: 2, pos: [0, 0.7, 0.5] },
  { name: 'head', parent: 3, pos: [0, 0.72, 0.68] },
  { name: 'jaw', parent: 4, pos: [0, 0.66, 0.72] },
  { name: 'tail1', parent: 0, pos: [0, 0.62, -0.5] },
  { name: 'tail2', parent: 6, pos: [0, 0.56, -0.8] },
  { name: 'flU', parent: 2, pos: [0.16, 0.55, 0.32] },
  { name: 'flL', parent: 8, pos: [0.16, 0.28, 0.34] },
  { name: 'frU', parent: 2, pos: [-0.16, 0.55, 0.32] },
  { name: 'frL', parent: 10, pos: [-0.16, 0.28, 0.34] },
  { name: 'blU', parent: 0, pos: [0.15, 0.55, -0.36] },
  { name: 'blL', parent: 12, pos: [0.15, 0.28, -0.42] },
  { name: 'brU', parent: 0, pos: [-0.15, 0.55, -0.36] },
  { name: 'brL', parent: 14, pos: [-0.15, 0.28, -0.42] },
];
const Q = { hips: 0, spine: 1, chest: 2, neck: 3, head: 4, jaw: 5, tail1: 6, tail2: 7, flU: 8, flL: 9, frU: 10, frL: 11, blU: 12, blL: 13, brU: 14, brL: 15 } as const;

/** Malla de un cuadrúpedo. `style` cambia las proporciones: rata, skrebun o cerdo. */
export function buildQuadruped(def: CreatureDef): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const base = lin(def.color);
  const dark = lin(def.color2);
  const style = def.id;
  const fat = style === 'cerdo' ? 1.45 : style === 'rata' ? 1.1 : 0.92;
  const n = 9;
  // Cuerpo: anillos en el plano XY a lo largo de Z
  const body: [number, number, number, number, W, RGB][] = [
    [-0.52, 0.6, 0.07, 0.08, [[Q.hips, 1]], scalec(dark, 0.9)],
    [-0.4, 0.62, 0.15 * fat, 0.16 * fat, [[Q.hips, 1]], base],
    [-0.18, 0.64, 0.19 * fat, 0.19 * fat, [[Q.hips, 0.5], [Q.spine, 0.5]], base],
    [0.08, 0.65, 0.19 * fat, 0.2 * fat, [[Q.spine, 0.6], [Q.chest, 0.4]], mixc(base, dark, 0.15)],
    [0.3, 0.66, 0.2 * fat, 0.22 * fat, [[Q.chest, 1]], base],
    [0.46, 0.68, 0.15 * fat, 0.17 * fat, [[Q.chest, 0.5], [Q.neck, 0.5]], base],
    [0.58, 0.71, 0.11 * fat, 0.12 * fat, [[Q.neck, 0.6], [Q.head, 0.4]], base],
  ];
  let prev = -1;
  body.forEach(([z, y, rx, ry, w, c], i) => {
    sb.color(c);
    const r = sb.ring(0, y, z, rx, ry, n, 'z', w);
    if (prev >= 0) sb.bridge(prev, r, n, 0, y, z - 0.1);
    else sb.fan(r, n, 0, y, z - 0.04, w, 0, 0, -1);
    prev = r;
  });
  // Lomo erizado del skrebun
  if (style === 'skrebun') {
    sb.color(scalec(dark, 0.7));
    for (let i = 0; i < 7; i++) {
      const z = -0.3 + i * 0.12;
      sb.blob(0, 0.86 - Math.abs(i - 3) * 0.012, z, 0.018, 0.07, 0.03, 5, 3, [[i < 3 ? Q.hips : i < 5 ? Q.spine : Q.chest, 1]]);
    }
  }
  // Cabeza: hocico alargado
  const HWt: W = [[Q.head, 1]];
  const snout = style === 'cerdo' ? 0.16 : style === 'rata' ? 0.22 : 0.26;
  const head: [number, number, number, number, RGB][] = [
    [0.56, 0.72, 0.105 * fat, 0.11 * fat, base],
    [0.68, 0.73, 0.1 * fat, 0.1 * fat, base],
    [0.68 + snout * 0.5, 0.71, 0.065, 0.062, mixc(base, dark, 0.3)],
    [0.68 + snout, 0.7, style === 'cerdo' ? 0.05 : 0.03, style === 'cerdo' ? 0.045 : 0.03, style === 'cerdo' ? lin(0xd8a8a0) : dark],
  ];
  let ph = prev;
  head.forEach(([z, y, rx, ry, c], i) => {
    sb.color(c);
    const r = sb.ring(0, y, z, rx, ry, n, 'z', i === 0 ? [[Q.neck, 0.5], [Q.head, 0.5]] : HWt);
    sb.bridge(ph, r, n, 0, y, z - 0.05);
    ph = r;
  });
  sb.fan(ph, n, 0, 0.7, 0.68 + snout + 0.02, HWt, 0, 0, 1);
  // Mandíbula
  sb.color(scalec(dark, 0.8));
  const JW: W = [[Q.jaw, 1]];
  sb.blob(0, 0.655, 0.72 + snout * 0.35, 0.05, 0.022, snout * 0.5, 6, 3, JW);
  if (style !== 'cerdo') {
    // Colmillos
    sb.color([0.85, 0.8, 0.68]);
    for (const s of [1, -1]) {
      sb.blob(s * 0.028, 0.675, 0.72 + snout * 0.72, 0.008, 0.024, 0.008, 4, 3, JW);
      sb.blob(s * 0.03, 0.682, 0.7 + snout * 0.75, 0.008, 0.026, 0.008, 4, 3, HWt);
    }
  }
  // Orejas
  sb.color(style === 'rata' ? lin(0xa07a70) : scalec(base, 0.85));
  for (const s of [1, -1]) {
    if (style === 'rata') sb.blob(s * 0.075, 0.82, 0.63, 0.014, 0.05, 0.04, 5, 3, HWt);
    else if (style === 'cerdo') sb.blob(s * 0.085, 0.82, 0.64, 0.03, 0.04, 0.012, 5, 3, HWt);
    else sb.blob(s * 0.07, 0.8, 0.6, 0.012, 0.03, 0.03, 4, 3, HWt);
  }
  // Ojos que brillan en la oscuridad
  const eye = lin(def.eyes);
  for (const s of [1, -1]) {
    sb.color(eye).glow(style === 'cerdo' ? 0 : 5);
    sb.blob(s * 0.058, 0.765, 0.72, 0.014, 0.014, 0.014, 5, 3, HWt);
    sb.glow(0);
  }
  // Patas
  const legs: [number, number, number, number, number][] = [
    [0.16, 0.32, Q.flU, Q.flL, Q.chest],
    [-0.16, 0.32, Q.frU, Q.frL, Q.chest],
    [0.15, -0.38, Q.blU, Q.blL, Q.hips],
    [-0.15, -0.38, Q.brU, Q.brL, Q.hips],
  ];
  const lr = style === 'cerdo' ? 0.062 : style === 'rata' ? 0.04 : 0.05;
  for (const [x, z, U, L, P] of legs) {
    const back = z < 0;
    const secs: [number, number, number, W, RGB][] = [
      [0.62, lr * 1.5, z, [[U, 0.5], [P, 0.5]], base],
      [0.5, lr * 1.35, z + (back ? -0.02 : 0.01), [[U, 1]], base],
      [0.3, lr * 0.95, z + (back ? -0.06 : 0.02), [[U, 0.5], [L, 0.5]], mixc(base, dark, 0.3)],
      [0.12, lr * 0.7, z + (back ? -0.02 : 0.03), [[L, 1]], dark],
      [0.03, lr * 0.95, z + 0.04, [[L, 1]], scalec(dark, 0.7)],
    ];
    let p2 = -1;
    for (const [y, r, zz, w, c] of secs) {
      sb.color(c);
      const ring = sb.ring(x, y, zz, r, r, 6, 'y', w);
      if (p2 >= 0) sb.bridge(p2, ring, 6, x, y + 0.05, zz);
      p2 = ring;
    }
    sb.fan(p2, 6, x, 0, z + 0.05, [[L, 1]], 0, -1, 0);
    if (style === 'skrebun') {
      // Garras como hoces
      sb.color([0.12, 0.1, 0.09]);
      for (const k of [-1, 0, 1]) sb.blob(x + k * 0.03, 0.03, z + 0.13, 0.009, 0.014, 0.05, 4, 3, [[L, 1]]);
    }
  }
  // Cola
  const tl = style === 'rata' ? 0.75 : style === 'cerdo' ? 0.12 : 0.5;
  const tc = style === 'rata' ? lin(0xa07a70) : dark;
  sb.color(tc);
  let pt = sb.ring(0, 0.6, -0.5, 0.035, 0.035, 5, 'z', [[Q.tail1, 1]]);
  const t1 = sb.ring(0, 0.57, -0.5 - tl * 0.45, 0.022, 0.022, 5, 'z', [[Q.tail1, 0.4], [Q.tail2, 0.6]]);
  sb.bridge(pt, t1, 5, 0, 0.58, -0.6);
  pt = t1;
  const t2 = sb.ring(0, 0.5, -0.5 - tl, 0.008, 0.008, 5, 'z', [[Q.tail2, 1]]);
  sb.bridge(pt, t2, 5, 0, 0.54, -0.9);
  return sb.finish(0.35);
}

export interface QuadInput {
  speed: number;
  dist: number;
  turn: number;
  attackT: number;
  attacking: boolean;
  sinceHit: number;
  hitSide: number;
  dead: boolean;
  alert: number;
  seed: number;
}

const tmpE = new THREE.Euler();

export class QuadAnimator {
  phase = 0;
  time = 0;
  private cur = new Float32Array(16 * 3);
  private y = 0;
  private rz = 0;
  private first = true;

  constructor(
    readonly bones: THREE.Bone[],
    seed: number,
  ) {
    this.time = hash2(seed, 2, 5) * 10;
    this.phase = hash2(seed, 3, 5) * 6;
  }

  update(dt: number, s: QuadInput) {
    this.time += dt;
    const t = this.time;
    this.phase += s.speed * dt * 5.2;
    const e = new Float32Array(16 * 3);
    const set = (b: number, x: number, y = 0, z = 0) => {
      e[b * 3] = x;
      e[b * 3 + 1] = y;
      e[b * 3 + 2] = z;
    };
    let yOff = 0;
    let rz = 0;
    if (s.dead) {
      rz = 1.45;
      yOff = -0.42;
      set(Q.flU, -0.6);
      set(Q.frU, 0.3);
      set(Q.blU, 0.5);
      set(Q.brU, -0.2);
      set(Q.head, 0.3, 0.2);
      set(Q.jaw, 0.4);
    } else {
      const w = smoothstep(0.05, 0.8, s.speed);
      const run = smoothstep(2.5, 5, s.speed);
      const A = (0.5 + 0.45 * run) * w;
      const ph = this.phase;
      // Trote: diagonales a la par; al galope, delanteras y traseras a contratiempo
      const fl = Math.sin(ph);
      const fr = Math.sin(ph + Math.PI * (1 - run * 0.7));
      const bl = Math.sin(ph + Math.PI * (1 - run * 0.3));
      const br = Math.sin(ph + run * Math.PI * 0.4);
      set(Q.flU, -A * fl);
      set(Q.flL, A * 0.9 * Math.max(0, Math.cos(ph)) + 0.1 * w);
      set(Q.frU, -A * fr);
      set(Q.frL, A * 0.9 * Math.max(0, Math.cos(ph + Math.PI * (1 - run * 0.7))) + 0.1 * w);
      set(Q.blU, -A * bl);
      set(Q.blL, -A * 0.8 * Math.max(0, Math.cos(ph + Math.PI)) - 0.1 * w);
      set(Q.brU, -A * br);
      set(Q.brL, -A * 0.8 * Math.max(0, Math.cos(ph)) - 0.1 * w);
      yOff = Math.abs(Math.sin(ph)) * 0.03 * w + run * 0.03 * Math.sin(ph * 2);
      set(Q.spine, 0.06 * run * Math.sin(ph * 2), 0.06 * w * Math.sin(ph));
      set(Q.chest, -0.05 * run * Math.sin(ph * 2), -0.05 * w * Math.sin(ph));
      // Cabeza: olfatea en reposo
      const idle = 1 - w;
      set(Q.neck, 0.25 * idle + 0.1 * Math.sin(t * 0.9) * idle, 0.35 * Math.sin(t * 0.5 + s.seed) * idle);
      set(Q.head, 0.12 * Math.sin(t * 2.3) * idle - 0.1 * run, 0.2 * Math.sin(t * 0.7 + 1) * idle);
      set(Q.tail1, 0.25 + 0.1 * run, 0.35 * Math.sin(t * 2 + s.seed) * (0.4 + w));
      set(Q.tail2, 0.2, 0.45 * Math.sin(t * 2 + s.seed - 0.8) * (0.4 + w));
      set(Q.jaw, 0.06 + 0.05 * Math.sin(t * 3) * idle);
      if (s.attacking) {
        const a = s.attackT;
        const wind = smoothstep(0, 0.3, a) * (1 - smoothstep(0.3, 0.45, a));
        const bite = smoothstep(0.3, 0.45, a) * (1 - smoothstep(0.6, 1, a));
        set(Q.neck, -0.35 * wind + 0.25 * bite);
        set(Q.head, -0.3 * wind + 0.2 * bite);
        set(Q.jaw, 0.8 * wind + 0.9 * bite * (1 - bite));
        set(Q.flU, -0.5 * bite);
        set(Q.frU, -0.9 * bite);
        set(Q.spine, -0.15 * wind + 0.12 * bite);
        yOff += 0.1 * bite;
      }
      if (s.sinceHit < 0.5) {
        const r = Math.exp(-s.sinceHit * 9);
        set(Q.spine, 0.2 * r, 0.3 * r);
        yOff -= 0.05 * r;
      }
    }
    const k = this.first ? 1 : 1 - Math.exp(-(s.dead ? 6 : 18) * dt);
    this.first = false;
    for (let i = 0; i < 48; i++) this.cur[i] += (e[i] - this.cur[i]) * k;
    this.y += (yOff - this.y) * k;
    this.rz += (rz - this.rz) * k;
    const c = this.cur;
    for (let i = 1; i < 16; i++) {
      tmpE.set(c[i * 3], c[i * 3 + 1], c[i * 3 + 2], 'YXZ');
      this.bones[i].quaternion.setFromEuler(tmpE);
    }
    tmpE.set(c[0], c[1], this.rz, 'YXZ');
    this.bones[0].quaternion.setFromEuler(tmpE);
    this.bones[0].position.set(0, 0.62 + this.y, -0.35);
  }
}

// ---------------------------------------------------------------------------
// Bípedos monstruosos (usan el esqueleto humano)
// ---------------------------------------------------------------------------

export function buildBrute(def: CreatureDef): THREE.BufferGeometry {
  const sb = new SkinBuilder();
  const B = HB;
  const base = lin(def.color);
  const dark = lin(def.color2);
  const thin = def.id === 'sheptun';
  const k = thin ? 0.62 : 1.5;
  const n = 10;
  const col = (secs: [number, number, number, W, RGB, number?, number?][], sides = n, capTop = false, capBottom = false) => {
    let prev = -1;
    let last: [number, number, number, W, RGB, number?, number?] | null = null;
    for (const s of secs) {
      sb.color(s[4]);
      const r = sb.ring(s[5] ?? 0, s[0], s[6] ?? 0, s[1], s[2], sides, 'y', s[3]);
      if (prev >= 0) sb.bridge(prev, r, sides, s[5] ?? 0, s[0] - 0.03, s[6] ?? 0);
      else if (capBottom) sb.fan(r, sides, s[5] ?? 0, s[0] - 0.03, s[6] ?? 0, s[3], 0, -1, 0);
      prev = r;
      last = s;
    }
    if (capTop && last) sb.fan(prev, sides, last[5] ?? 0, last[0] + 0.04, last[6] ?? 0, last[3], 0, 1, 0);
  };
  // Torso encorvado y macizo (o esquelético)
  col(
    [
      [0.84, 0.12 * k, 0.1 * k, [[B.hips, 1]], dark],
      [0.95, 0.19 * k, 0.14 * k, [[B.hips, 1]], base],
      [1.1, 0.17 * k, 0.14 * k, [[B.spine, 1]], base],
      [1.26, 0.23 * k, 0.19 * k, [[B.spine, 0.5], [B.chest, 0.5]], mixc(base, dark, 0.2), 0, 0.03],
      [1.4, 0.26 * k, 0.21 * k, [[B.chest, 1]], base, 0, 0.05],
      [1.5, 0.2 * k, 0.17 * k, [[B.chest, 0.7], [B.neck, 0.3]], base, 0, 0.07],
      [1.56, 0.1 * k, 0.1 * k, [[B.neck, 1]], dark, 0, 0.09],
    ],
    n,
    false,
    true,
  );
  // Cabeza sin cuello, hundida entre los hombros
  const HWt: W = [[B.head, 1]];
  col(
    [
      [1.54, 0.08 * (thin ? 0.8 : 1.2), 0.09 * (thin ? 0.8 : 1.2), HWt, dark, 0, 0.1],
      [1.62, 0.1 * (thin ? 0.8 : 1.25), 0.115 * (thin ? 0.8 : 1.25), HWt, base, 0, 0.11],
      [1.71, 0.095 * (thin ? 0.85 : 1.2), 0.11 * (thin ? 0.85 : 1.2), HWt, base, 0, 0.1],
      [1.78, 0.06 * (thin ? 0.8 : 1.1), 0.07 * (thin ? 0.8 : 1.1), HWt, mixc(base, dark, 0.4), 0, 0.08],
    ],
    n,
    true,
  );
  const eye = lin(def.eyes);
  for (const s of [1, -1]) {
    sb.color(eye).glow(thin ? 9 : 4);
    sb.blob(s * 0.04, 1.68, 0.2 * (thin ? 0.86 : 1.18), thin ? 0.016 : 0.02, thin ? 0.022 : 0.016, 0.012, 6, 3, HWt);
    sb.glow(0);
  }
  if (!thin) {
    // Mandíbula ancha y placas en la espalda
    sb.color(dark).blob(0, 1.585, 0.2, 0.1, 0.045, 0.07, 8, 3, HWt);
    sb.color(scalec(dark, 0.7));
    for (let i = 0; i < 4; i++) sb.blob(0, 1.2 + i * 0.1, -0.2 - (i === 1 || i === 2 ? 0.05 : 0), 0.12 - i * 0.012, 0.06, 0.06, 6, 3, [[i < 2 ? B.spine : B.chest, 1]]);
  }
  // Brazos largos que casi tocan el suelo
  const ar = thin ? 0.03 : 0.085;
  for (const s of [1, -1]) {
    const sh = s > 0 ? B.shoulderL : B.shoulderR;
    const ua = s > 0 ? B.upperArmL : B.upperArmR;
    const fa = s > 0 ? B.forearmL : B.forearmR;
    const hd = s > 0 ? B.handL : B.handR;
    const x = s * (thin ? 0.19 : 0.34);
    col(
      [
        [0.74, ar * 0.9, ar * 1.5, [[hd, 1]], dark, x],
        [0.87, ar * 1.25, ar * 1.3, [[hd, 0.5], [fa, 0.5]], dark, x],
        [1.0, ar * 1.35, ar * 1.35, [[fa, 1]], base, x],
        [1.13, ar * 1.05, ar * 1.05, [[fa, 0.5], [ua, 0.5]], mixc(base, dark, 0.3), x],
        [1.28, ar * 1.4, ar * 1.4, [[ua, 1]], base, x],
        [1.42, ar * 1.6, ar * 1.6, [[ua, 0.5], [sh, 0.5]], base, x],
        [1.5, ar * 1.0, ar * 1.1, [[sh, 0.7], [ua, 0.3]], base, x - s * 0.03],
      ],
      7,
      true,
      true,
    );
    // Garras
    sb.color([0.08, 0.07, 0.06]);
    for (const q of [-1, 0, 1]) sb.blob(x, 0.68 - (thin ? 0.06 : 0), q * ar * 0.9, 0.012, thin ? 0.12 : 0.07, 0.014, 4, 3, [[hd, 1]]);
  }
  // Piernas cortas y gruesas (o zancos)
  const lr = thin ? 0.035 : 0.1;
  for (const s of [1, -1]) {
    const th = s > 0 ? B.thighL : B.thighR;
    const shn = s > 0 ? B.shinL : B.shinR;
    const ft = s > 0 ? B.footL : B.footR;
    const x = s * (thin ? 0.08 : 0.15);
    col(
      [
        [0.03, lr * 1.3, lr * 1.7, [[ft, 1]], dark, x, 0.05],
        [0.1, lr * 0.9, lr * 1.0, [[ft, 0.5], [shn, 0.5]], dark, x],
        [0.3, lr * 1.05, lr * 1.1, [[shn, 1]], base, x],
        [0.52, lr * 0.95, lr * 1.0, [[shn, 0.5], [th, 0.5]], mixc(base, dark, 0.3), x],
        [0.72, lr * 1.35, lr * 1.4, [[th, 1]], base, x],
        [0.9, lr * 1.3, lr * 1.35, [[th, 0.5], [B.hips, 0.5]], base, x],
      ],
      7,
      false,
      true,
    );
  }
  return sb.finish(0.35);
}
