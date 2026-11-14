// Modelos y animación de personajes y criaturas: mallas válidas, pies que no
// patinan, poses sin NaN y movimiento continuo entre pasos de la simulación.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { CREATURES } from '../src/data/criaturas';
import { makeLook, type Role } from '../src/data/gente';
import { FACTION_IDS } from '../src/data/historia/facciones';
import { ITEMS } from '../src/data/items';
import type { Look } from '../src/data/looks';
import { CharViews } from '../src/game/views';
import { HumanAnimator, defaultAnimInput, type AnimInput, type AttackAnim, type BodyPose, type WeaponHold, type WorkAnim } from '../src/render/chars/anim';
import { QuadAnimator, buildBrute, buildQuadruped, quadBones, quadToes } from '../src/render/chars/creatures';
import { HB, HUMAN_BONES, buildHumanoid } from '../src/render/chars/humanoid';
import { makeSkeleton } from '../src/render/chars/skin';
import { setDest } from '../src/sim/move';
import { newGame } from '../src/sim/newGame';
import { buildWorld, type World } from '../src/sim/world';

/** Comprueba una malla con esqueleto: posiciones finitas, normales, pesos e índices. */
function checkSkinned(g: THREE.BufferGeometry, bones: number): string | null {
  const p = g.attributes.position.array as Float32Array;
  const n = g.attributes.normal.array as Float32Array;
  const si = g.attributes.skinIndex.array as Uint16Array;
  const sw = g.attributes.skinWeight.array as Float32Array;
  const idx = g.index!.array;
  const vc = p.length / 3;
  for (const x of p) if (!Number.isFinite(x)) return 'posición no finita';
  for (let i = 0; i < n.length; i += 3) if (!(Math.hypot(n[i], n[i + 1], n[i + 2]) > 0.5)) return `normal nula en ${i / 3}`;
  for (let i = 0; i < sw.length; i += 4) if (Math.abs(sw[i] + sw[i + 1] + sw[i + 2] + sw[i + 3] - 1) > 1e-3) return `pesos que no suman 1 en ${i / 4}`;
  for (const b of si) if (b >= bones) return `hueso ${b} inexistente`;
  for (const k of idx) if (k >= vc) return `índice ${k} fuera de la malla`;
  return null;
}

describe('mallas', () => {
  it('cualquier aspecto da una malla humana válida y de tamaño razonable', () => {
    const rng = new Rng(42);
    const roles: Role[] = ['soldado', 'civil', 'comerciante', 'lider', 'bandido', 'stalker', 'medico', 'refugiado'];
    const sides = [...FACTION_IDS, 'LIB'] as const;
    const armor = Object.values(ITEMS)
      .map((d) => d.armor?.look)
      .filter((l): l is Partial<Look> => !!l);
    let maxV = 0;
    for (let i = 0; i < 160; i++) {
      let look = makeLook(rng, sides[i % sides.length] as never, roles[i % roles.length]);
      if (i % 3 === 0) look = { ...look, ...armor[i % armor.length] };
      if (i % 5 === 0) look = { ...look, female: !look.female, hair: (['largo', 'mono', 'corto', 'rapado', 'calvo'] as const)[i % 5] };
      const g = buildHumanoid(look);
      expect(checkSkinned(g, HUMAN_BONES.length), JSON.stringify(look)).toBeNull();
      maxV = Math.max(maxV, g.attributes.position.count);
    }
    expect(maxV).toBeLessThan(6000);
  });

  it('cada criatura tiene su malla válida', () => {
    for (const def of Object.values(CREATURES)) {
      const quad = def.shape === 'cuadrupedo';
      const g = quad ? buildQuadruped(def) : buildBrute(def);
      expect(checkSkinned(g, quad ? quadBones(def).length : HUMAN_BONES.length), def.id).toBeNull();
      expect(g.attributes.position.count, def.id).toBeGreaterThan(600);
    }
  });
});

/** Hace andar a un esqueleto humano (el modelo avanza de verdad) y mide cuánto patinan los pies. */
function walkHuman(speed: number, extra: Partial<AnimInput> = {}) {
  const { bones, root } = makeSkeleton(HUMAN_BONES);
  const mesh = new THREE.Object3D();
  mesh.add(root);
  const an = new HumanAnimator(bones, 7);
  const inp = { ...defaultAnimInput(7), ...extra, speed };
  const dt = 1 / 60;
  let z = 0;
  let slide = 0;
  let travel = 0;
  let badKnee = 0;
  const ball = new THREE.Vector3();
  const heel = new THREE.Vector3();
  const prev: ({ p: THREE.Vector3; k: number } | null)[] = [null, null];
  const e = new THREE.Euler();
  for (let f = 0; f < 4 * 60; f++) {
    const d = speed * dt;
    z += d;
    inp.dist = d;
    mesh.position.set(0, 0, z);
    an.update(dt, inp);
    mesh.updateMatrixWorld(true);
    if (f < 60) continue;
    travel += d;
    for (let i = 0; i < 2; i++) {
      const foot = bones[i === 0 ? HB.footL : HB.footR];
      ball.set(0, -0.085, 0.13).applyMatrix4(foot.matrixWorld);
      heel.set(0, -0.085, -0.075).applyMatrix4(foot.matrixWorld);
      // Punto de apoyo: el pie plano, la bola o el talón, según lo que toque el suelo
      const G = 0.014;
      const k = ball.y < G && heel.y < G ? 3 : ball.y < G ? 1 : heel.y < G ? 2 : 0;
      const cp = k === 3 ? ball.clone().add(heel).multiplyScalar(0.5) : k === 1 ? ball.clone() : heel.clone();
      const pv = prev[i];
      if (k && pv && pv.k === k) slide += Math.hypot(cp.x - pv.p.x, cp.z - pv.p.z);
      prev[i] = k ? { p: cp, k } : null;
      e.setFromQuaternion(bones[i === 0 ? HB.shinL : HB.shinR].quaternion, 'YXZ');
      if (e.x < -0.05) badKnee++;
    }
  }
  return { slide: slide / travel, badKnee };
}

describe('animación humana', () => {
  it('los pies que apoyan no patinan al andar, correr ni ir agachado', () => {
    for (const [v, extra] of [
      [1, {}],
      [1.45, {}],
      [3.5, {}],
      [5, {}],
      [1.2, { sneak: true }],
      [2.5, { carrying: true }],
      [1.2, { limp: -1 }],
      [2, { style: 'bruto' }],
      [3.5, { style: 'acechador' }],
    ] as [number, Partial<AnimInput>][]) {
      const r = walkHuman(v, extra);
      // Quien cojea arrastra a propósito la pierna mala al levantarla y al apoyarla
      expect(r.slide, `${v} m/s ${JSON.stringify(extra)}`).toBeLessThan(extra.limp ? 0.05 : 0.03);
      expect(r.badKnee, 'rodilla doblada al revés').toBe(0);
    }
  });

  it('ninguna combinación de postura, trabajo, arma y ataque da NaN', () => {
    const poses: BodyPose[] = ['normal', 'sentado', 'sentadoSuelo', 'arrodillado', 'cuclillas', 'tumbado', 'ko', 'muerto', 'cargado', 'gateo'];
    const works: WorkAnim[] = ['nada', 'martillo', 'pico', 'operar', 'cocinar', 'rebuscar', 'vendar', 'comer', 'hablar', 'guitarra', 'calentarse', 'escribir', 'cargarCaja', 'rezar', 'guardia'];
    const holds: WeaponHold[] = ['nada', 'una', 'dos', 'fusil', 'pistola'];
    const attacks: (AttackAnim | null)[] = [null, 'tajo', 'golpe', 'estocada', 'punetazo'];
    const { bones, root } = makeSkeleton(HUMAN_BONES);
    new THREE.Object3D().add(root);
    const an = new HumanAnimator(bones, 3);
    const inp = defaultAnimInput(3);
    let frames = 0;
    for (const pose of poses) {
      for (let i = 0; i < 30; i++) {
        inp.pose = pose;
        inp.work = works[i % works.length];
        inp.hold = holds[i % holds.length];
        inp.attack = attacks[(i * 3) % attacks.length];
        inp.attackT = (i % 7) / 6;
        inp.speed = (i % 4) * 1.5;
        inp.dist = -1;
        inp.aim = i % 2;
        inp.sneak = i % 5 === 0;
        inp.look = i % 3 ? null : 0.8;
        inp.alert = i % 2;
        inp.turn = i % 6 === 0 ? 3 : 0;
        inp.sinceHit = (i % 4) * 0.2;
        inp.sinceFire = (i % 3) * 0.1;
        for (let f = 0; f < 6; f++) {
          an.update(1 / 30, inp);
          frames++;
          for (const b of bones) {
            const q = b.quaternion;
            expect(Number.isFinite(q.x + q.y + q.z + q.w + b.position.x + b.position.y + b.position.z), `${pose} ${inp.work} ${inp.hold} ${inp.attack}`).toBe(true);
          }
        }
      }
    }
    expect(frames).toBeGreaterThan(1000);
  });

  it('al caer y al levantarse pasa por el suelo sin saltos', () => {
    const { bones, root } = makeSkeleton(HUMAN_BONES);
    new THREE.Object3D().add(root);
    const an = new HumanAnimator(bones, 5);
    const inp = defaultAnimInput(5);
    let y = root.position.y;
    let maxJump = 0;
    let minY = 9;
    for (let f = 0; f < 6 * 30; f++) {
      inp.pose = f > 30 && f < 90 ? 'ko' : 'normal';
      an.update(1 / 30, inp);
      maxJump = Math.max(maxJump, Math.abs(root.position.y - y));
      y = root.position.y;
      minY = Math.min(minY, y);
    }
    expect(minY).toBeLessThan(0.2);
    // De pie otra vez al final
    expect(root.position.y).toBeGreaterThan(0.9);
    expect(maxJump).toBeLessThan(0.12);
  });
});

describe('animación de los cuadrúpedos', () => {
  it('las patas que apoyan no patinan al paso, al trote ni al galope', () => {
    for (const id of ['rata', 'skrebun', 'cerdo']) {
      const def = CREATURES[id];
      const defs = quadBones(def);
      const T = quadToes(def);
      for (const v of [0.6, 1.5, 3, 6]) {
        const { bones, root } = makeSkeleton(defs);
        const mesh = new THREE.Object3D();
        mesh.add(root);
        const an = new QuadAnimator(bones, 5, def);
        const paws = [12, 15, 18, 21];
        const tip = paws.map((b, i) => new THREE.Vector3(T[i][0] - defs[b].pos[0], T[i][1] - defs[b].pos[1], T[i][2] - defs[b].pos[2]));
        const inp = { speed: v, dist: 0, turn: 0, attackT: 0, attacking: false, sinceHit: 9, hitSide: 0, dead: false, alert: 0, seed: 5, look: null };
        const dt = 1 / 60;
        let z = 0;
        let slide = 0;
        let travel = 0;
        const prev: (THREE.Vector3 | null)[] = [null, null, null, null];
        for (let f = 0; f < 4 * 60; f++) {
          const d = v * dt;
          z += d;
          inp.dist = d;
          mesh.position.set(0, 0, z);
          an.update(dt, inp);
          mesh.updateMatrixWorld(true);
          if (f < 60) continue;
          travel += d;
          paws.forEach((b, i) => {
            const p = tip[i].clone().applyMatrix4(bones[b].matrixWorld);
            expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
            const pv = prev[i];
            if (p.y < 0.0135 && pv) slide += Math.hypot(p.x - pv.x, p.z - pv.z);
            prev[i] = p.y < 0.0135 ? p : null;
          });
        }
        expect(slide / travel, `${id} a ${v}`).toBeLessThan(0.02);
      }
    }
  });

  it('atacar, recibir y morir no dan NaN', () => {
    for (const id of ['rata', 'skrebun', 'cerdo']) {
      const def = CREATURES[id];
      const { bones, root } = makeSkeleton(quadBones(def));
      new THREE.Object3D().add(root);
      const an = new QuadAnimator(bones, 9, def);
      const inp = { speed: 0, dist: -1, turn: 0, attackT: 0, attacking: false, sinceHit: 9, hitSide: 1, dead: false, alert: 1, seed: 9, look: 0.5 as number | null };
      for (let f = 0; f < 200; f++) {
        inp.attacking = f < 60;
        inp.attackT = (f % 30) / 30;
        inp.sinceHit = f > 60 && f < 90 ? (f - 60) / 30 : 9;
        inp.dead = f > 120;
        inp.speed = f > 90 && f < 120 ? 4 : 0;
        an.update(1 / 30, inp);
        for (const b of bones) expect(Number.isFinite(b.quaternion.x + b.quaternion.w + b.position.y), `${id} ${f}`).toBe(true);
      }
      // Muerto: tendido de costado
      expect(Math.abs(new THREE.Euler().setFromQuaternion(bones[0].quaternion, 'YXZ').z)).toBeGreaterThan(1.2);
    }
  });
});

describe('movimiento en pantalla', () => {
  let world: World;
  beforeAll(() => {
    world = buildWorld();
  });

  it('a 60 Hz el personaje avanza en cada fotograma aunque la simulación vaya a 30', () => {
    const sim = newGame(world, { scenario: 'nadie', seed: 3 });
    const views = new CharViews(sim);
    const c = sim.players[0];
    setDest(c, c.x + Math.cos(c.face) * 9, c.z + Math.sin(c.face) * 9, 0.5, false);
    const steps: number[] = [];
    let last: { x: number; z: number } | null = null;
    for (let f = 0; f < 120; f++) {
      sim.step(1 / 60);
      views.update(1 / 60, c.x, c.z);
      const s = views.shown(c.id)!;
      if (last && c.speed > 1) {
        steps.push(Math.hypot(s.x - last.x, s.z - last.z));
        // Nunca va más de un paso por detrás de la simulación
        expect(Math.hypot(s.x - c.x, s.z - c.z)).toBeLessThan(c.speed * (2 / 30) + 0.02);
      }
      last = { x: s.x, z: s.z };
    }
    expect(steps.length).toBeGreaterThan(40);
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    // Sin interpolar, uno de cada dos fotogramas se quedaría quieto
    const still = steps.filter((d) => d < mean * 0.3).length;
    expect(still).toBe(0);
    views.dispose();
  });
});
