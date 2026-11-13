// Miniaturas: dibuja una pieza del kit en un lienzo pequeño para usarla como
// sprite en la interfaz (catálogo de obras). Usa el renderizador del juego.

import * as THREE from 'three';
import { propGeometry } from './kit/core';
import { cloneProbeMaterial, probeMaterial, setProbe } from './materials';

const cache = new Map<string, string>();
let base: THREE.MeshStandardMaterial | null = null;

const toSrgb = (v: number) => {
  // Curva suave para que las luces no se quemen, y gamma
  const t = v / (1 + v * 0.45);
  return Math.round(255 * Math.pow(Math.max(0, Math.min(1, t)), 1 / 2.2));
};

/** Devuelve la URL (data:) de la miniatura de una pieza. */
export function propThumb(renderer: THREE.WebGLRenderer, type: string, variant = 0, size = 144): string {
  const key = `${type}#${variant}#${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let url = '';
  try {
    const geo = propGeometry(type, variant);
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const c = bb.getCenter(new THREE.Vector3());
    const r = Math.max(0.4, bb.getSize(new THREE.Vector3()).length() / 2);
    if (!base) base = probeMaterial({ roughness: 0.84, grunge: true });
    const mat = cloneProbeMaterial(base);
    setProbe(mat, 1.5, 1.32, 1.08, -0.55, 0.62, 0.55);
    const mesh = new THREE.Mesh(geo, mat);
    const scene = new THREE.Scene();
    scene.add(mesh);
    scene.add(new THREE.AmbientLight(0xa8b8d8, 0.9));
    const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 200);
    const d = r / Math.sin((12 * Math.PI) / 180) * 1.04;
    const yaw = 0.62;
    const pitch = 0.5;
    cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
    cam.lookAt(c);
    const rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, samples: 4 });
    const prevTarget = renderer.getRenderTarget();
    const prevColor = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    const buf = new Float32Array(size * size * 4);
    const half = new Uint16Array(size * size * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, half);
    for (let i = 0; i < half.length; i++) buf[i] = THREE.DataUtils.fromHalfFloat(half[i]);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevColor, prevAlpha);
    rt.dispose();
    mat.dispose();
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = ((size - 1 - y) * size + x) * 4;
        const o = (y * size + x) * 4;
        const a = Math.max(0, Math.min(1, buf[s + 3]));
        const k = a > 0.001 ? 1 / a : 0;
        img.data[o] = toSrgb(buf[s] * k);
        img.data[o + 1] = toSrgb(buf[s + 1] * k);
        img.data[o + 2] = toSrgb(buf[s + 2] * k);
        img.data[o + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    url = cv.toDataURL('image/png');
  } catch (e) {
    console.warn('No se pudo dibujar la miniatura de', type, e);
  }
  cache.set(key, url);
  return url;
}
