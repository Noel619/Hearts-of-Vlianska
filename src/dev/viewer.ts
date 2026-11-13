// Visor de desarrollo: construye el mundo y permite recorrerlo con la cámara.
// Se abre con ?view en la dirección. Parámetros: at=ID, cam=x,z,dist,yaw,pitch, q=baja|media|alta.

import * as THREE from 'three';
import { CameraRig } from '../render/camera';
import { Gfx, type Quality } from '../render/gfx';
import { initMaterialGlobals } from '../render/materials';
import { buildPropsView } from '../render/propsView';
import { buildTextures } from '../render/textures';
import { buildWaterMesh } from '../render/waterMesh';
import { buildWorldMesh } from '../render/worldMesh';
import { decorate } from '../world/decor';
import { buildLayout } from '../world/layout';
import { LightField } from '../world/lights';
import { addCharTest } from './charTest';
import { startKit } from './kitView';
import { startPoses } from './poseView';

export async function startViewer(root: HTMLElement) {
  const params = new URLSearchParams(location.search);
  if (params.has('kit')) return startKit(root, params);
  if (params.has('poses')) return startPoses(root, params);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  root.appendChild(canvas);
  const info = document.createElement('div');
  info.style.cssText = 'position:absolute;left:8px;top:8px;color:#e8a33d;font:12px monospace;white-space:pre;text-shadow:0 1px 2px #000';
  root.appendChild(info);
  const say = (t: string) => (info.textContent = t);
  const gfx = new Gfx(canvas, { quality: (params.get('q') as Quality) ?? 'media' });
  const t0 = performance.now();
  say('Trazado…');
  await new Promise((r) => setTimeout(r, 10));
  const layout = buildLayout();
  const t1 = performance.now();
  const decor = decorate(layout);
  const t2 = performance.now();
  say('Texturas…');
  await new Promise((r) => setTimeout(r, 10));
  const tex = buildTextures();
  initMaterialGlobals(tex);
  const t3 = performance.now();
  const field = new LightField(layout.nav, decor.lights);
  const world = await buildWorldMesh(layout, field, tex, async (label, f) => {
    say(`${label} ${(f * 100).toFixed(0)} %`);
    await new Promise((r) => setTimeout(r, 0));
  });
  gfx.scene.add(world.group);
  gfx.scene.add(buildWaterMesh(layout.nav, field, tex));
  const t4 = performance.now();
  const props = buildPropsView(decor.props, field);
  gfx.scene.add(props.group);
  const t5 = performance.now();
  const rig = new CameraRig(gfx.camera);
  const at = params.get('at');
  const cam = params.get('cam');
  if (cam) {
    const [x, z, d, yaw, pitch] = cam.split(',').map(Number);
    rig.jump(x, z, d || 34, yaw || 0.6, pitch || 0.98);
  } else {
    const c = layout.stationById[at ?? 'STA'] ?? layout.nodeById[at ?? ''] ?? layout.stationById.STA;
    rig.jump(c.x, c.z, Number(params.get('d') ?? 46), Number(params.get('yaw') ?? 0.6), Number(params.get('pitch') ?? 0.95));
  }
  let charTick: ((dt: number) => void) | null = null;
  if (params.has('chars')) charTick = addCharTest(gfx.scene, field, rig.tx, rig.tz, layout.nav.heightAt(rig.tx, rig.tz), rig.yaw);
  const keys = new Set<string>();
  window.addEventListener('keydown', (e) => keys.add(e.code));
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('resize', () => gfx.resize());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    rig.zoom(Math.exp(e.deltaY * 0.001));
  }, { passive: false });
  let drag = false;
  canvas.addEventListener('mousedown', (e) => (drag = e.button !== 0));
  window.addEventListener('mouseup', () => (drag = false));
  window.addEventListener('mousemove', (e) => {
    if (drag) rig.rotate(-e.movementX * 0.005, e.movementY * 0.004);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  const stats = `trazado ${(t1 - t0).toFixed(0)} ms · decoración ${(t2 - t1).toFixed(0)} ms · texturas ${(t3 - t2).toFixed(0)} ms · mundo ${(t4 - t3).toFixed(0)} ms · atrezo ${(t5 - t4).toFixed(0)} ms\n` +
    `vértices ${world.stats.vertices} · triángulos ${world.stats.triangles} · mallas ${world.stats.meshes} · piezas ${props.count} · luces ${decor.lights.length}`;
  let last = performance.now();
  let frames = 0;
  let fpsT = 0;
  let fps = 0;
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const sp = rig.dist * 0.9 * dt;
    if (keys.has('KeyW')) rig.pan(0, sp);
    if (keys.has('KeyS')) rig.pan(0, -sp);
    if (keys.has('KeyA')) rig.pan(-sp, 0);
    if (keys.has('KeyD')) rig.pan(sp, 0);
    if (keys.has('KeyQ')) rig.rotate(dt * 1.5, 0);
    if (keys.has('KeyE')) rig.rotate(-dt * 1.5, 0);
    rig.update(dt);
    charTick?.(dt);
    gfx.render(dt);
    frames++;
    fpsT += dt;
    if (fpsT > 0.5) {
      fps = frames / fpsT;
      frames = 0;
      fpsT = 0;
      const ri = gfx.renderer.info;
      say(`${stats}\n${fps.toFixed(0)} fps · llamadas ${ri.render.calls} · tris ${ri.render.triangles}\ncam ${rig.tx.toFixed(0)},${rig.tz.toFixed(0)},${rig.dist.toFixed(0)},${rig.yaw.toFixed(2)},${rig.pitch.toFixed(2)}`);
    }
    requestAnimationFrame(loop);
  };
  loop();
  (window as unknown as Record<string, unknown>).__vl = { gfx, rig, layout, decor, field, THREE };
  (window as unknown as Record<string, unknown>).__ready = true;
}
