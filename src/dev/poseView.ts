// Banco de poses para desarrollo: ?view&poses[=listo|apuntar|ataque|marcha|correr|sigilo|reposo|caida|giro|varios]
// muestra una fila de personajes sobre un suelo neutro, cada uno con un arma,
// para revisar de cerca cómo la sujetan y cómo se mueven. Parámetros:
//   only=ak,hacha   solo esas armas       t=0.4   fase fija del ataque (0..1)
//   pick=0,3        solo esos casos del preset
//   cam=x,z,d,yaw,pitch                    y=1.1   altura a la que mira la cámara
//   move            avanzan de verdad (los pies que apoyan no deben patinar)
//   freeze          el tiempo solo avanza con __vl.step(dt) (para capturas)

import * as THREE from 'three';
import { DEFAULT_LOOK, type Look } from '../data/looks';
import { CameraRig } from '../render/camera';
import type { AnimInput } from '../render/chars/anim';
import { HumanView } from '../render/chars/humanView';
import { Gfx, type Quality } from '../render/gfx';
import { initMaterialGlobals } from '../render/materials';
import { buildTextures } from '../render/textures';
import { F_WALK, NavGrid } from '../world/grid';
import { LightField, makeLight, type LightDef } from '../world/lights';

interface Case {
  weapon: string | null;
  hold: AnimInput['hold'];
  aim?: number;
  attack?: AnimInput['attack'];
  speed?: number;
  sneak?: boolean;
  pose?: AnimInput['pose'];
  work?: AnimInput['work'];
  back?: string;
  lamp?: 'frontal' | 'farol';
  look?: Partial<Look>;
  /** Tumbarse y levantarse en bucle (prueba de caídas). */
  fall?: AnimInput['pose'];
  /** Giro en el sitio (rad/s). */
  turn?: number;
  limp?: number;
  carrying?: boolean;
  alert?: boolean;
}

const GUNS: [string, AnimInput['hold']][] = [
  ['ak', 'fusil'],
  ['fusilTunel', 'fusil'],
  ['carabina', 'fusil'],
  ['cerrojo', 'fusil'],
  ['neumatico', 'fusil'],
  ['ametralladora', 'fusil'],
  ['subfusil', 'pistola'],
  ['escopeta', 'pistola'],
  ['pistola', 'pistola'],
];
const TWO: string[] = ['hacha', 'maza', 'lanza', 'pico'];
const ONE: string[] = ['cuchillo', 'machete', 'tubo', 'llave', 'pala', 'palanca'];

const LOOKS: Partial<Look>[] = [
  { top: 'guerrera', topColor: 0x2f4263, pantsColor: 0x232a38, hat: 'casco', hatColor: 0x3a4a66, vest: 0x1e2430, pouches: true },
  { top: 'chaqueton', topColor: 0x4a5a3a, pantsColor: 0x3a3f2e, hat: 'ushanka', hatColor: 0x4a4436, facial: 'barba3' },
  { top: 'cuero', topColor: 0x4a3626, pantsColor: 0x35302a, hat: 'boina', hatColor: 0x5a1e1a, female: true, hair: 'corto' },
  { top: 'abrigo', topColor: 0x5a4632, pantsColor: 0x2e2a26, hat: 'gorra', hatColor: 0x2a2a2a, gloves: 0x1a1a1a },
  { top: 'mono', topColor: 0x6a5f44, pantsColor: 0x6a5f44, hat: 'capucha', hatColor: 0x4a4a3c, mask: 'antigas', backpack: 0x4a4636 },
  { top: 'camisa', topColor: 0x8a8272, pantsColor: 0x3a4250, hair: 'rapado', build: 0.7 },
];

function casesFor(preset: string): Case[] {
  const out: Case[] = [];
  const guns = (aim: number, extra: Partial<Case> = {}) => GUNS.forEach(([weapon, hold]) => out.push({ weapon, hold, aim, ...extra }));
  const two = (extra: Partial<Case> = {}) => TWO.forEach((weapon) => out.push({ weapon, hold: 'dos', ...extra }));
  const one = (extra: Partial<Case> = {}) => ONE.forEach((weapon) => out.push({ weapon, hold: 'una', ...extra }));
  switch (preset) {
    case 'apuntar':
      guns(1);
      break;
    case 'ataque':
      TWO.forEach((weapon, i) => out.push({ weapon, hold: 'dos', attack: weapon === 'lanza' ? 'estocada' : i % 2 ? 'tajo' : 'golpe' }));
      ONE.forEach((weapon, i) => out.push({ weapon, hold: 'una', attack: i % 2 ? 'estocada' : 'tajo' }));
      out.push({ weapon: null, hold: 'nada', attack: 'punetazo' });
      out.push({ weapon: 'ak', hold: 'fusil', attack: 'golpe' });
      break;
    case 'marcha':
      guns(0, { speed: 1.5 });
      two({ speed: 1.5 });
      one({ speed: 4.6 });
      break;
    case 'sigilo':
      guns(0, { sneak: true, speed: 0.9 });
      two({ sneak: true, speed: 0.9 });
      break;
    case 'correr':
      out.push({ weapon: null, hold: 'nada', speed: 3.6 });
      out.push({ weapon: null, hold: 'nada', speed: 5 });
      out.push({ weapon: 'ak', hold: 'fusil', speed: 4.2 });
      out.push({ weapon: 'machete', hold: 'una', speed: 4.2 });
      out.push({ weapon: 'hacha', hold: 'dos', speed: 4.2 });
      out.push({ weapon: 'pistola', hold: 'pistola', speed: 4.2 });
      out.push({ weapon: null, hold: 'nada', speed: 2.6, carrying: true });
      out.push({ weapon: null, hold: 'nada', speed: 1.3, limp: -1 });
      break;
    case 'reposo':
      out.push({ weapon: null, hold: 'nada' });
      out.push({ weapon: null, hold: 'nada', look: { female: true, hair: 'largo' } });
      out.push({ weapon: 'machete', hold: 'una' });
      out.push({ weapon: 'ak', hold: 'fusil' });
      out.push({ weapon: null, hold: 'nada', lamp: 'farol' });
      out.push({ weapon: 'hacha', hold: 'dos', alert: true });
      out.push({ weapon: 'cuchillo', hold: 'una', alert: true });
      out.push({ weapon: null, hold: 'nada', alert: true });
      break;
    case 'caida':
      out.push({ weapon: null, hold: 'nada', fall: 'ko' });
      out.push({ weapon: 'ak', hold: 'fusil', fall: 'ko', look: { seed: 4 } });
      out.push({ weapon: 'machete', hold: 'una', fall: 'muerto', look: { seed: 9 } });
      out.push({ weapon: null, hold: 'nada', fall: 'ko', look: { seed: 7 } });
      break;
    case 'giro':
      out.push({ weapon: null, hold: 'nada', turn: 2.5 });
      out.push({ weapon: 'ak', hold: 'fusil', turn: -3 });
      out.push({ weapon: null, hold: 'nada', speed: 1.4, turn: 1.2 });
      out.push({ weapon: null, hold: 'nada', speed: 4.4, turn: 1.6 });
      break;
    case 'varios':
      out.push({ weapon: null, hold: 'nada' });
      out.push({ weapon: 'martillo', hold: 'nada', work: 'martillo', back: 'ak' });
      out.push({ weapon: 'pico', hold: 'dos', work: 'pico', back: 'fusilTunel' });
      out.push({ weapon: 'ak', hold: 'fusil', pose: 'sentado' });
      out.push({ weapon: 'ak', hold: 'fusil', pose: 'arrodillado', aim: 1 });
      out.push({ weapon: null, hold: 'nada', back: 'cerrojo' });
      out.push({ weapon: null, hold: 'nada', back: 'hacha' });
      out.push({ weapon: null, hold: 'nada', lamp: 'farol' });
      out.push({ weapon: 'machete', hold: 'una', lamp: 'farol' });
      out.push({ weapon: 'ak', hold: 'fusil', lamp: 'farol' });
      out.push({ weapon: 'cerrojo', hold: 'fusil', lamp: 'frontal', aim: 1 });
      out.push({ weapon: 'pistola', hold: 'pistola', back: 'cuchillo' });
      break;
    default:
      guns(0);
      two();
      one();
      break;
  }
  return out;
}

export async function startPoses(root: HTMLElement, params: URLSearchParams) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  root.appendChild(canvas);
  const gfx = new Gfx(canvas, { quality: (params.get('q') as Quality) ?? 'media' });
  initMaterialGlobals(buildTextures());
  gfx.scene.fog = null;
  gfx.scene.background = new THREE.Color(0x3a3d42);
  const only = (params.get('only') ?? '').split(',').filter(Boolean);
  let cases = casesFor(params.get('poses') || 'listo');
  if (only.length) cases = cases.filter((c) => only.includes(c.weapon ?? 'nada'));
  const pick = (params.get('pick') ?? '').split(',').filter(Boolean).map(Number);
  if (pick.length) cases = cases.filter((_, i) => pick.includes(i));
  const gap = Number(params.get('gap') ?? 1.25);
  const W = cases.length * gap;
  const nav = new NavGrid(-20, -20, Math.ceil((W + 40) * 2), 80);
  nav.flags.fill(F_WALK);
  const lights: LightDef[] = [];
  for (let lx = -4; lx < W + 4; lx += 6) {
    lights.push(makeLight(lx, 5, 5, 0xfff2e0, 1.0, 22, 'lamp', 0));
    lights.push(makeLight(lx + 3, 4, -5, 0xc8d8ff, 0.5, 22, 'lamp', 0));
  }
  const field = new LightField(nav, lights);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 60, 60), new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2, -0.005, 0);
  gfx.scene.add(floor);
  gfx.scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 0.6));
  const fixedT = params.has('t') ? Number(params.get('t')) : null;
  const moving = params.has('move');
  const frozen = params.has('freeze');
  const facing = Number(params.get('face') ?? Math.PI / 2);
  const out = new Float32Array(6);
  const views = cases.map((c, i) => {
    const look: Look = { ...DEFAULT_LOOK, seed: i * 13 + 5, ...LOOKS[i % LOOKS.length], ...c.look };
    const v = new HumanView(look);
    const x = (i + 0.5) * gap;
    v.place(x, 0, 0, facing);
    v.aimYaw = facing;
    const inp = v.input;
    inp.hold = c.hold;
    inp.aim = c.aim ?? 0;
    inp.speed = c.speed ?? 0;
    inp.sneak = !!c.sneak;
    inp.pose = c.pose ?? 'normal';
    inp.work = c.work ?? 'nada';
    inp.limp = c.limp ?? 0;
    inp.carrying = !!c.carrying;
    inp.alert = c.alert ? 1 : 0;
    if (c.alert) inp.look = 0.3;
    v.setWeapon(c.weapon);
    v.setBack(c.back ?? null);
    v.setLamp(c.lamp ?? null);
    gfx.scene.add(v.group);
    field.sample(x, 1.2, 0, 0, 1, 0, false, out);
    v.setProbe(out[0], out[1], out[2], out[3], out[4], out[5]);
    return { v, c, t: i * 0.31, x, z: 0, face: facing };
  });
  const rig = new CameraRig(gfx.camera);
  rig.minDist = 1.2;
  rig.ty = Number(params.get('y') ?? 0.35);
  gfx.camera.near = 0.1;
  gfx.camera.updateProjectionMatrix();
  const cam = params.get('cam');
  if (cam) {
    const [cx, cz, d, yaw, pitch] = cam.split(',').map(Number);
    rig.jump(cx, cz, d || 6, yaw || 0, pitch || 0.25);
  } else rig.jump(W / 2, 0, Number(params.get('d') ?? Math.max(5, W * 0.95)), Number(params.get('yaw') ?? 0), Number(params.get('pitch') ?? 0.2));
  rig.update(1);
  window.addEventListener('resize', () => gfx.resize());
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      rig.zoom(Math.exp(e.deltaY * 0.001));
    },
    { passive: false },
  );
  let drag = 0;
  canvas.addEventListener('mousedown', (e) => (drag = e.button === 0 ? 1 : 2));
  window.addEventListener('mouseup', () => (drag = 0));
  window.addEventListener('mousemove', (e) => {
    if (drag === 2) rig.rotate(-e.movementX * 0.005, e.movementY * 0.004);
    else if (drag === 1) rig.pan(-e.movementX * rig.dist * 0.0016, e.movementY * rig.dist * 0.0016);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const step = (dt: number) => {
    for (const e of views) {
      e.t += dt;
      const inp = e.v.input;
      if (e.c.attack) {
        if (fixedT !== null) {
          inp.attack = e.c.attack;
          inp.attackT = fixedT;
        } else {
          const cyc = e.t % 1.8;
          inp.attack = cyc < 1 ? e.c.attack : null;
          inp.attackT = Math.min(1, cyc);
        }
      }
      if (inp.aim > 0 && fixedT === null) inp.sinceFire = e.t % 1.4;
      if (e.c.fall) {
        // Cae, se queda en el suelo y se levanta
        const cyc = e.t % 5;
        inp.pose = cyc > 1 && cyc < 3.2 ? e.c.fall : 'normal';
      }
      if (e.c.turn) {
        e.face -= e.c.turn * dt;
        inp.turn = e.c.turn;
      }
      if (moving && inp.speed > 0) {
        // Avanza de verdad y vuelve al principio tras unos metros
        const d = inp.speed * dt;
        e.x += Math.cos(e.face) * d;
        e.z += Math.sin(e.face) * d;
        inp.dist = d;
        if (Math.hypot(e.x - (e.v.group.userData.x0 ?? e.x), e.z) > 3.5) {
          e.x = e.v.group.userData.x0;
          e.z = -1.5;
          inp.dist = 0;
        }
      }
      e.v.place(e.x, 0, e.z, e.face);
      e.v.update(dt);
    }
  };
  for (const e of views) {
    e.v.group.userData.x0 = e.x;
    if (moving) e.z = -1.5;
  }
  // Deja que las poses se asienten antes del primer fotograma
  for (let i = 0; i < 40; i++) step(1 / 30);
  let last = performance.now();
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    rig.update(dt);
    if (!frozen) step(dt);
    gfx.render(dt);
    requestAnimationFrame(loop);
  };
  loop();
  (window as unknown as Record<string, unknown>).__vl = { gfx, rig, views, step, THREE };
  (window as unknown as Record<string, unknown>).__ready = true;
}
