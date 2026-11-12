// Catálogo de atrezo para desarrollo: ?view&kit[=tipo,tipo…] muestra las
// piezas del kit sobre un suelo neutro, con todas sus variantes.

import * as THREE from 'three';
import { CameraRig } from '../render/camera';
import { Gfx, type Quality } from '../render/gfx';
import { initMaterialGlobals } from '../render/materials';
import { buildPropsView } from '../render/propsView';
import { buildTextures } from '../render/textures';
import { F_WALK, NavGrid } from '../world/grid';
import { LightField, makeLight, type LightDef } from '../world/lights';
import { PROPS, type PropInst } from '../world/props';

export async function startKit(root: HTMLElement, params: URLSearchParams) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  root.appendChild(canvas);
  const gfx = new Gfx(canvas, { quality: (params.get('q') as Quality) ?? 'media' });
  initMaterialGlobals(buildTextures());
  const want = (params.get('kit') ?? '').split(',').filter(Boolean);
  const types = want.length ? want : Object.keys(PROPS);
  // Rejilla de piezas: una fila por tipo, una columna por variante
  const props: PropInst[] = [];
  const tint = parseInt(params.get('tint') ?? '2f6fb7', 16);
  const cols = Number(params.get('cols') ?? 4);
  let x = 0;
  let z = 0;
  let rowDepth = 0;
  let n = 0;
  const rot = Number(params.get('rot') ?? 0);
  for (const type of types) {
    const def = PROPS[type];
    if (!def) continue;
    const vars = def.variants ?? 1;
    const size = def.foot ? ('r' in def.foot ? def.foot.r * 2 : Math.max(def.foot.hx, def.foot.hz) * 2) : 2;
    const cell = Math.max(3.2, size + 1.6);
    for (let v = 0; v < vars; v++) {
      const wall = def.wall ? { wnx: 0, wnz: -1 } : {};
      props.push({ type, x: x + cell / 2, y: def.wall ? 2.6 : 0, z: z + cell / 2, rot, variant: v, tint, seed: n + 1, ...wall });
      x += cell;
      rowDepth = Math.max(rowDepth, cell);
      n++;
      if (n % cols === 0) {
        x = 0;
        z += rowDepth;
        rowDepth = 0;
      }
    }
  }
  const W = Math.max(40, cols * 14);
  const D = z + rowDepth + 20;
  const nav = new NavGrid(-10, -10, Math.ceil((W + 20) * 2), Math.ceil((D + 20) * 2));
  nav.flags.fill(F_WALK);
  const lights: LightDef[] = [];
  for (let lz = -4; lz < D; lz += 9) for (let lx = -4; lx < W; lx += 9) lights.push(makeLight(lx, 6.5, lz, 0xfff0dc, 0.75, 24, 'lamp', 0));
  const field = new LightField(nav, lights);
  const view = buildPropsView(props, field);
  gfx.scene.add(view.group);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 40, D + 40), new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(W / 2 - 10, -0.01, D / 2 - 10);
  gfx.scene.add(floor);
  gfx.scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 0.5));
  const rig = new CameraRig(gfx.camera);
  const cam = params.get('cam');
  if (cam) {
    const [cx, cz, d, yaw, pitch] = cam.split(',').map(Number);
    rig.jump(cx, cz, d || 20, yaw || 0.5, pitch || 0.8);
  } else rig.jump(Math.min(W, cols * 5) / 2, (z + rowDepth) / 2, Number(params.get('d') ?? 22), Number(params.get('yaw') ?? 0.5), Number(params.get('pitch') ?? 0.8));
  window.addEventListener('resize', () => gfx.resize());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    rig.zoom(Math.exp(e.deltaY * 0.001));
  }, { passive: false });
  let drag = false;
  canvas.addEventListener('mousedown', () => (drag = true));
  window.addEventListener('mouseup', () => (drag = false));
  window.addEventListener('mousemove', (e) => {
    if (drag) {
      if (e.buttons & 2) rig.rotate(-e.movementX * 0.005, e.movementY * 0.004);
      else rig.pan(-e.movementX * rig.dist * 0.0016, e.movementY * rig.dist * 0.0016);
    }
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  let last = performance.now();
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    rig.update(dt);
    gfx.render(dt);
    requestAnimationFrame(loop);
  };
  loop();
  (window as unknown as Record<string, unknown>).__ready = true;
}
