// Banco de criaturas para desarrollo: ?view&criaturas[=todas|marcha|ataque|muerte]
// muestra una fila de criaturas sobre un suelo neutro para revisar sus
// modelos y cómo se mueven. Parámetros (como el banco de poses):
//   only=rata,cerdo   solo esas especies       pick=0,3   solo esos casos
//   cam=x,z,d,yaw,pitch   y=0.3   gap=1.6       move   freeze (avanzar con __vl.step)

import * as THREE from 'three';
import { CREATURES } from '../data/criaturas';
import { CameraRig } from '../render/camera';
import { CreatureView } from '../render/chars/creatures';
import { Gfx, type Quality } from '../render/gfx';
import { initMaterialGlobals } from '../render/materials';
import { buildTextures } from '../render/textures';
import { F_WALK, NavGrid } from '../world/grid';
import { LightField, makeLight, type LightDef } from '../world/lights';

interface Case {
  kind: string;
  /** Velocidad (m/s del mundo). */
  speed?: number;
  attack?: boolean;
  dead?: boolean;
  alert?: boolean;
  hit?: boolean;
}

const KINDS = ['rata', 'skrebun', 'cerdo', 'glubinnik', 'sheptun'];

function casesFor(preset: string): Case[] {
  const out: Case[] = [];
  switch (preset) {
    case 'marcha':
      for (const kind of KINDS) {
        const v = CREATURES[kind].speed;
        out.push({ kind, speed: v * 0.3 }, { kind, speed: v * 0.6 }, { kind, speed: v });
      }
      break;
    case 'ataque':
      for (const kind of KINDS) out.push({ kind, attack: true, alert: true });
      break;
    case 'muerte':
      for (const kind of KINDS) out.push({ kind, dead: true });
      break;
    default:
      for (const kind of KINDS) out.push({ kind }, { kind, alert: true, hit: true });
      break;
  }
  return out;
}

export async function startCreatures(root: HTMLElement, params: URLSearchParams) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  root.appendChild(canvas);
  const gfx = new Gfx(canvas, { quality: (params.get('q') as Quality) ?? 'media' });
  initMaterialGlobals(buildTextures());
  gfx.scene.fog = null;
  gfx.scene.background = new THREE.Color(0x3a3d42);
  const preset = params.get('criaturas') || 'todas';
  let cases = casesFor(preset);
  const only = (params.get('only') ?? '').split(',').filter(Boolean);
  if (only.length) cases = cases.filter((c) => only.includes(c.kind));
  const pick = (params.get('pick') ?? '').split(',').filter(Boolean).map(Number);
  if (pick.length) cases = cases.filter((_, i) => pick.includes(i));
  const gap = Number(params.get('gap') ?? 1.6);
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
  const moving = params.has('move');
  const frozen = params.has('freeze');
  const facing = Number(params.get('face') ?? Math.PI / 2);
  const out = new Float32Array(6);
  const views = cases.map((c, i) => {
    const def = CREATURES[c.kind];
    const v = new CreatureView(def, i * 7 + 3);
    const x = (i + 0.5) * gap;
    v.place(x, 0, 0, facing);
    gfx.scene.add(v.group);
    field.sample(x, 1.0, 0, 0, 1, 0, false, out);
    v.setProbe(out[0], out[1], out[2], out[3], out[4], out[5]);
    return { v, c, t: i * 0.37, x, z: moving ? -1.5 : 0, x0: x };
  });
  const rig = new CameraRig(gfx.camera);
  rig.minDist = 1.2;
  rig.ty = Number(params.get('y') ?? 0.0);
  gfx.camera.near = 0.1;
  gfx.camera.updateProjectionMatrix();
  const cam = params.get('cam');
  if (cam) {
    const [cx, cz, d, yaw, pitch] = cam.split(',').map(Number);
    rig.jump(cx, cz, d || 6, yaw || 0, pitch || 0.25);
  } else rig.jump(W / 2, 0, Number(params.get('d') ?? Math.max(5, W * 0.8)), Number(params.get('yaw') ?? 0.5), Number(params.get('pitch') ?? 0.3));
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
      const { v, c } = e;
      const def = v.def;
      const speed = c.speed ?? 0;
      const attacking = !!c.attack && e.t % 2 < def.attackTime;
      const attackT = (e.t % 2) / def.attackTime;
      const dead = !!c.dead && e.t % 6 > 1;
      const sinceHit = c.hit ? e.t % 3 : 9;
      let dist = speed * dt;
      if (moving && speed > 0) {
        e.z += dist;
        if (e.z > 3.5) {
          e.z = -1.5;
          dist = 0;
        }
      }
      v.place(e.x, 0, e.z, facing);
      if (v.quad) {
        const q = v.qin;
        q.speed = speed / def.scale;
        q.dist = dist / def.scale;
        q.attacking = attacking;
        q.attackT = attackT;
        q.dead = dead;
        q.alert = c.alert ? 1 : 0;
        q.sinceHit = sinceHit;
        q.hitSide = 1;
        q.look = c.alert ? 0.4 : null;
      } else {
        const b = v.bin;
        b.speed = speed / def.scale;
        b.dist = dist / def.scale;
        b.attack = attacking ? (Math.floor(e.t / 2) % 2 ? 'golpe' : 'tajo') : null;
        b.attackT = attackT;
        b.pose = dead ? 'muerto' : 'normal';
        b.alert = c.alert ? 1 : 0;
        b.look = c.alert ? 0.4 : null;
        b.sinceHit = sinceHit;
        b.hitSide = 1;
        b.sneak = c.kind === 'sheptun' && speed < 1;
      }
      v.update(dt);
    }
  };
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
