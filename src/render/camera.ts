// Cámara de estrategia: orbita alrededor de un punto del suelo, con
// desplazamiento, giro, inclinación y zoom suavizados.

import * as THREE from 'three';
import { clamp, damp, angleDamp } from '../core/math';

export class CameraRig {
  /** Punto del suelo al que mira (objetivo deseado). */
  tx = 0;
  tz = 0;
  ty = 0;
  dist = 34;
  yaw = 0.6;
  pitch = 0.98;
  // Valores suavizados
  private sx = 0;
  private sz = 0;
  private sy = 0;
  private sd = 34;
  private syaw = 0.6;
  private spitch = 0.98;
  minDist = 5;
  maxDist = 95;
  /** Límites del mundo para el objetivo. */
  bounds: { minX: number; minZ: number; maxX: number; maxZ: number } | null = null;
  /** Punto a seguir (si no es null, el objetivo se pega a él). */
  follow: { x: number; z: number; y: number } | null = null;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  jump(x: number, z: number, dist = this.dist, yaw = this.yaw, pitch = this.pitch) {
    this.tx = this.sx = x;
    this.tz = this.sz = z;
    this.dist = this.sd = dist;
    this.yaw = this.syaw = yaw;
    this.pitch = this.spitch = pitch;
    this.apply();
  }

  /** Desplaza el objetivo en el plano de pantalla (derecha, adelante). */
  pan(right: number, forward: number) {
    const s = Math.sin(this.yaw);
    const c = Math.cos(this.yaw);
    this.tx += right * c - forward * s;
    this.tz += -right * s - forward * c;
    this.follow = null;
  }

  rotate(dyaw: number, dpitch: number) {
    this.yaw += dyaw;
    this.pitch = clamp(this.pitch + dpitch, 0.42, 1.48);
  }

  zoom(factor: number) {
    this.dist = clamp(this.dist * factor, this.minDist, this.maxDist);
  }

  update(dt: number) {
    if (this.follow) {
      this.tx = this.follow.x;
      this.tz = this.follow.z;
      this.ty = this.follow.y;
    }
    if (this.bounds) {
      this.tx = clamp(this.tx, this.bounds.minX, this.bounds.maxX);
      this.tz = clamp(this.tz, this.bounds.minZ, this.bounds.maxZ);
    }
    const k = 12;
    this.sx = damp(this.sx, this.tx, k, dt);
    this.sz = damp(this.sz, this.tz, k, dt);
    this.sy = damp(this.sy, this.ty, 6, dt);
    this.sd = damp(this.sd, this.dist, 10, dt);
    this.syaw = angleDamp(this.syaw, this.yaw, 12, dt);
    this.spitch = damp(this.spitch, this.pitch, 12, dt);
    this.apply();
  }

  private apply() {
    const cp = Math.cos(this.spitch);
    const sp = Math.sin(this.spitch);
    const x = this.sx + Math.sin(this.syaw) * cp * this.sd;
    const z = this.sz + Math.cos(this.syaw) * cp * this.sd;
    const y = this.sy + sp * this.sd;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.sx, this.sy + 0.8, this.sz);
    this.camera.updateMatrixWorld();
  }

  /** Punto suavizado al que mira la cámara. */
  get focus() {
    return { x: this.sx, z: this.sz, y: this.sy };
  }
  get smoothDist() {
    return this.sd;
  }
  get smoothYaw() {
    return this.syaw;
  }
}
