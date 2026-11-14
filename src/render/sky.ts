// El cielo de la superficie: cuando la cámara sube por las escaleras, el metro
// se oculta y aparecen la luz del día (o de la luna), la niebla blanquecina y
// la nevada; al bajar, vuelve la oscuridad de los túneles.

import * as THREE from 'three';
import { clamp, damp, lerp, smoothstep } from '../core/math';
import type { Gfx } from './gfx';
import { globals } from './materials';
import type { TextureSet } from './textures';

/** Altura del punto de mira a partir de la cual se considera que la cámara está arriba. */
export const SURFACE_VIEW_Y = 9;

const METRO_FOG = new THREE.Color(0x040608);
const DAY_FOG = new THREE.Color(0x7d8791);
const NIGHT_FOG = new THREE.Color(0x161d2a);
const METRO_AMB = new THREE.Color(0x8fa3c4);
const DAY_AMB = new THREE.Color(0xb4c2d6);
const NIGHT_AMB = new THREE.Color(0x4a5d80);

const FLAKES = 2600;
const BOX = 70;
const BOXH = 46;

export class Sky {
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  readonly snow: THREE.Points;
  /** 0 bajo tierra … 1 en la superficie (suavizado). */
  k = 0;
  /** ¿Se muestra la superficie? */
  up = false;
  private vel: Float32Array;
  private fog = new THREE.Color();
  private amb = new THREE.Color();

  constructor(
    readonly gfx: Gfx,
    tex: TextureSet,
    readonly metro: THREE.Object3D[],
    readonly surface: THREE.Object3D[],
  ) {
    this.sun = new THREE.DirectionalLight(0xfff0dc, 0);
    this.sun.castShadow = gfx.quality !== 'baja';
    const sz = gfx.quality === 'alta' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sz, sz);
    const cam = this.sun.shadow.camera;
    cam.left = -70;
    cam.right = 70;
    cam.top = 70;
    cam.bottom = -70;
    cam.near = 1;
    cam.far = 220;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.sun.visible = false;
    gfx.scene.add(this.sun);
    gfx.scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xdfe8f2, 0x8a8172, 0);
    this.hemi.visible = false;
    gfx.scene.add(this.hemi);
    // Copos de nieve: puntos que caen en una caja que acompaña a la cámara
    const pos = new Float32Array(FLAKES * 3);
    this.vel = new Float32Array(FLAKES * 2);
    for (let i = 0; i < FLAKES; i++) {
      pos[i * 3] = (Math.random() - 0.5) * BOX * 2;
      pos[i * 3 + 1] = Math.random() * BOXH;
      pos[i * 3 + 2] = (Math.random() - 0.5) * BOX * 2;
      this.vel[i * 2] = 1.1 + Math.random() * 1.6;
      this.vel[i * 2 + 1] = Math.random() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, map: tex.soft, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true, fog: true });
    this.snow = new THREE.Points(g, m);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.snow.name = 'nieve';
    gfx.scene.add(this.snow);
    this.apply();
  }

  /** `hour`: hora del día (0..24); `focus`: punto al que mira la cámara. */
  update(dt: number, focus: { x: number; y: number; z: number }, hour: number) {
    globals.uFocus.value.set(focus.x, focus.y, focus.z);
    const want = focus.y > SURFACE_VIEW_Y ? 1 : 0;
    this.k = damp(this.k, want, 5, dt);
    if (Math.abs(this.k - want) < 0.002) this.k = want;
    const up = this.k > 0.5;
    if (up !== this.up) {
      this.up = up;
      for (const o of this.metro) o.visible = !up;
      for (const o of this.surface) o.visible = up;
    }
    // Luz del día de enero: clarea a las siete y media y oscurece pasadas las cinco
    const day = smoothstep(6.6, 8.4, hour) * (1 - smoothstep(16.4, 18.2, hour));
    const k = this.k;
    this.fog.copy(NIGHT_FOG).lerp(DAY_FOG, day);
    this.fog.lerp(METRO_FOG, 1 - k);
    const sc = this.gfx.scene;
    (sc.fog as THREE.FogExp2).color.copy(this.fog);
    (sc.fog as THREE.FogExp2).density = lerp(0.0105, lerp(0.011, 0.0058, day), k);
    (sc.background as THREE.Color).copy(this.fog);
    this.gfx.renderer.setClearColor(this.fog, 1);
    this.amb.copy(NIGHT_AMB).lerp(DAY_AMB, day);
    this.gfx.ambient.color.copy(METRO_AMB).lerp(this.amb, k);
    this.gfx.ambient.intensity = lerp(0.62, lerp(0.5, 0.72, day), k);
    // Sol bajo de invierno desde el suroeste, que sigue al punto de mira
    const sunK = k * lerp(0.05, 1, day);
    this.sun.intensity = 1.6 * sunK;
    this.sun.visible = sunK > 0.01;
    const elev = lerp(0.35, 0.62, day);
    this.sun.position.set(focus.x - 60 * Math.cos(elev), focus.y + 90 * Math.sin(elev), focus.z + 45 * Math.cos(elev));
    this.sun.target.position.set(focus.x, focus.y, focus.z);
    this.sun.target.updateMatrixWorld();
    this.sun.color.setRGB(1, lerp(0.75, 0.94, day), lerp(0.6, 0.86, day));
    this.hemi.intensity = 0.55 * k * lerp(0.25, 1, day);
    this.hemi.visible = this.hemi.intensity > 0.01;
    // Nieve
    const m = this.snow.material as THREE.PointsMaterial;
    m.opacity = clamp(k * 0.85, 0, 0.85);
    this.snow.visible = k > 0.02;
    if (this.snow.visible) this.fall(dt, focus);
  }

  private fall(dt: number, f: { x: number; y: number; z: number }) {
    const attr = this.snow.geometry.getAttribute('position') as THREE.BufferAttribute;
    const p = attr.array as Float32Array;
    const t = performance.now() / 1000;
    const wind = 1.4 + Math.sin(t * 0.21) * 0.8;
    const ox = f.x;
    const oz = f.z;
    for (let i = 0; i < FLAKES; i++) {
      const v = this.vel[i * 2];
      const ph = this.vel[i * 2 + 1];
      p[i * 3] += (wind + Math.sin(t * 1.3 + ph) * 0.4) * dt;
      p[i * 3 + 1] -= v * dt;
      p[i * 3 + 2] += Math.cos(t * 1.1 + ph) * 0.35 * dt;
      // Se recicla dentro de la caja que rodea a la cámara (coordenadas del mundo)
      let x = p[i * 3] - ox;
      let z = p[i * 3 + 2] - oz;
      if (x > BOX) x -= BOX * 2;
      else if (x < -BOX) x += BOX * 2;
      if (z > BOX) z -= BOX * 2;
      else if (z < -BOX) z += BOX * 2;
      p[i * 3] = ox + x;
      p[i * 3 + 2] = oz + z;
      if (p[i * 3 + 1] < f.y - 2) p[i * 3 + 1] += BOXH;
      else if (p[i * 3 + 1] > f.y + BOXH) p[i * 3 + 1] -= BOXH;
    }
    attr.needsUpdate = true;
  }

  private apply() {
    for (const o of this.metro) o.visible = true;
    for (const o of this.surface) o.visible = false;
  }
}
