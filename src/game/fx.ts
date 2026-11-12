// Efectos y ayudas visuales: luces dinámicas (linternas, fogonazos, luces de
// la base), llamas y halos de las lámparas, partículas, trazadoras, sombras
// de contacto, anillos de selección y barras de salud.

import * as THREE from 'three';
import type { LightDef } from '../world/lights';
import type { TextureSet } from '../render/textures';

const tmpM = new THREE.Matrix4();
const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();
const FLAT = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

export interface DynLight {
  x: number;
  y: number;
  z: number;
  color: number;
  /** Intensidad en candelas. */
  power: number;
  dist: number;
  /** Prioridad adicional (los fogonazos mandan). */
  prio?: number;
}

export interface SpotReq {
  x: number;
  y: number;
  z: number;
  dx: number;
  dz: number;
  power: number;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  r: number;
  g: number;
  b: number;
  grav: number;
  add: boolean;
}

export interface FloatText {
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  t: number;
}

const BILLBOARD_VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iCol;
  attribute vec2 iSize;
  varying vec2 vUv;
  varying vec4 vCol;
  uniform float uTime;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    float fl = 1.0 + iSize.y * 0.18 * sin( uTime * 9.0 + iPos.x * 3.1 + iPos.z * 1.7 ) * sin( uTime * 4.3 + iPos.z );
    vCol = iCol * fl;
    vec4 mvPosition = modelViewMatrix * vec4( iPos, 1.0 );
    mvPosition.xy += position.xy * iSize.x * fl;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const HALO_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec4 vCol;
  #include <fog_pars_fragment>
  void main() {
    float d = length( vUv - 0.5 ) * 2.0;
    float a = pow( max( 0.0, 1.0 - d ), 2.2 );
    gl_FragColor = vec4( vCol.rgb * a * vCol.a, 1.0 );
    #ifdef USE_FOG
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
      gl_FragColor.rgb *= 1.0 - fogFactor;
    #endif
  }
`;
const FLAME_VERT = /* glsl */ `
  attribute vec4 iPos;
  varying vec2 vUv;
  varying float vPh;
  uniform float uTime;
  void main() {
    vUv = uv;
    vPh = iPos.w;
    vec3 p = position;
    float s = 0.55 + fract( iPos.w * 7.31 ) * 0.25;
    // Las llamas se mecen por arriba
    p.x += sin( uTime * 6.0 + iPos.w * 20.0 + p.y * 4.0 ) * 0.06 * p.y;
    p.y *= 1.0 + 0.2 * sin( uTime * 8.0 + iPos.w * 31.0 );
    vec4 mv = modelViewMatrix * vec4( iPos.xyz + p * s, 1.0 );
    gl_Position = projectionMatrix * mv;
  }
`;
const FLAME_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying float vPh;
  uniform float uTime;
  uniform sampler2D uTex;
  void main() {
    vec2 uv = vUv;
    uv.x += sin( uv.y * 9.0 - uTime * 7.0 + vPh * 40.0 ) * 0.07 * uv.y;
    float a = texture2D( uTex, vec2( uv.x, 1.0 - uv.y ) ).a;
    float n = texture2D( uTex, vec2( uv.x * 0.7 + vPh, 1.0 - fract( uv.y * 0.6 - uTime * 0.9 ) ) ).a;
    a *= 0.55 + 0.9 * n;
    vec3 c = mix( vec3( 1.0, 0.32, 0.05 ), vec3( 1.0, 0.85, 0.45 ), smoothstep( 0.25, 0.9, a ) * ( 1.0 - uv.y * 0.6 ) );
    gl_FragColor = vec4( c * a * 2.6, 1.0 );
  }
`;
const PART_VERT = /* glsl */ `
  attribute vec4 aCol;
  attribute float aSize;
  varying vec4 vCol;
  void main() {
    vCol = aCol;
    vec4 mv = modelViewMatrix * vec4( position, 1.0 );
    gl_PointSize = aSize * ( 520.0 / max( 1.0, - mv.z ) );
    gl_Position = projectionMatrix * mv;
  }
`;
const PART_FRAG = /* glsl */ `
  varying vec4 vCol;
  void main() {
    float d = length( gl_PointCoord - 0.5 ) * 2.0;
    float a = smoothstep( 1.0, 0.3, d ) * vCol.a;
    if ( a < 0.01 ) discard;
    gl_FragColor = vec4( vCol.rgb * a, a );
  }
`;
const BAR_VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec3 iBar;
  varying vec2 vUv;
  varying vec3 vBar;
  void main() {
    vUv = uv;
    vBar = iBar;
    vec4 mv = modelViewMatrix * vec4( iPos, 1.0 );
    float s = - mv.z * 0.018;
    mv.xy += position.xy * vec2( 3.4, 0.36 ) * s;
    gl_Position = projectionMatrix * mv;
  }
`;
const BAR_FRAG = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vBar;
  void main() {
    vec3 bg = vec3( 0.03 );
    vec3 c = vBar.y > 0.5 ? vec3( 0.25, 0.85, 0.35 ) : vBar.y < -0.5 ? vec3( 0.9, 0.22, 0.16 ) : vec3( 0.88, 0.84, 0.72 );
    float edge = step( 0.06, vUv.x ) * step( vUv.x, 0.94 ) * step( 0.18, vUv.y ) * step( vUv.y, 0.82 );
    float fill = step( vUv.x, 0.06 + 0.88 * vBar.x ) * edge;
    // Franja de sangre bajo la de salud
    vec3 col = mix( bg, c, fill );
    if ( vUv.y < 0.34 && edge > 0.5 ) col = mix( bg, vec3( 0.75, 0.08, 0.08 ), step( vUv.x, 0.06 + 0.88 * vBar.z ) );
    gl_FragColor = vec4( col, 0.9 );
  }
`;

export class Fx {
  readonly group = new THREE.Group();
  readonly points: THREE.PointLight[] = [];
  readonly spots: THREE.SpotLight[] = [];
  readonly floats: FloatText[] = [];
  private parts: Particle[] = [];
  private partGeo: THREE.BufferGeometry;
  private partGeoAdd: THREE.BufferGeometry;
  private tracers: { ax: number; ay: number; az: number; bx: number; by: number; bz: number; t: number }[] = [];
  private tracerGeo: THREE.BufferGeometry;
  private rings: THREE.InstancedMesh;
  private dests: THREE.InstancedMesh;
  private blobs: THREE.InstancedMesh;
  private bars: THREE.Mesh;
  private barGeo: THREE.InstancedBufferGeometry;
  private halos: THREE.Mesh | null = null;
  private flames: THREE.Mesh | null = null;
  private timeU = { value: 0 };
  private flashes: (DynLight & { t: number })[] = [];
  private fireLights: LightDef[] = [];
  private lampLights: LightDef[] = [];
  private dynLights: LightDef[] = [];
  private dirtyLights = true;

  constructor(
    readonly scene: THREE.Scene,
    readonly tex: TextureSet,
    quality: string,
  ) {
    this.group.name = 'fx';
    scene.add(this.group);
    const np = quality === 'baja' ? 4 : quality === 'media' ? 7 : 10;
    for (let i = 0; i < np; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 14, 1.8);
      this.points.push(l);
      scene.add(l);
    }
    const ns = quality === 'baja' ? 1 : 3;
    for (let i = 0; i < ns; i++) {
      const s = new THREE.SpotLight(0xfff0d8, 0, 26, 0.62, 0.65, 1.6);
      s.castShadow = i === 0 && quality !== 'baja';
      if (s.castShadow) {
        s.shadow.mapSize.set(quality === 'alta' ? 1024 : 512, quality === 'alta' ? 1024 : 512);
        s.shadow.bias = -0.002;
        s.shadow.camera.near = 0.4;
        s.shadow.camera.far = 26;
      }
      this.spots.push(s);
      scene.add(s);
      scene.add(s.target);
    }
    // Partículas
    const mkPart = (add: boolean) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3));
      g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(600 * 4), 4));
      g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(600), 1));
      g.setDrawRange(0, 0);
      const m = new THREE.ShaderMaterial({
        vertexShader: PART_VERT,
        fragmentShader: PART_FRAG,
        transparent: true,
        depthWrite: false,
        blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
        premultipliedAlpha: !add,
      });
      const p = new THREE.Points(g, m);
      p.frustumCulled = false;
      p.renderOrder = add ? 9 : 8;
      this.group.add(p);
      return g;
    };
    this.partGeo = mkPart(false);
    this.partGeoAdd = mkPart(true);
    // Trazadoras
    this.tracerGeo = new THREE.BufferGeometry();
    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
    this.tracerGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(64 * 6), 3));
    this.tracerGeo.setDrawRange(0, 0);
    const tl = new THREE.LineSegments(this.tracerGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    tl.frustumCulled = false;
    this.group.add(tl);
    // Anillos de selección, destinos y sombras de contacto
    const ringGeo = new THREE.RingGeometry(0.4, 0.5, 28);
    this.rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), 64);
    this.rings.frustumCulled = false;
    this.rings.count = 0;
    this.rings.renderOrder = 4;
    this.group.add(this.rings);
    this.dests = new THREE.InstancedMesh(new THREE.RingGeometry(0.2, 0.26, 20), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }), 64);
    this.dests.frustumCulled = false;
    this.dests.count = 0;
    this.dests.renderOrder = 4;
    this.group.add(this.dests);
    this.blobs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex.blob, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false }), 256);
    this.blobs.frustumCulled = false;
    this.blobs.count = 0;
    this.blobs.renderOrder = 2;
    this.group.add(this.blobs);
    // Barras de salud
    this.barGeo = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    this.barGeo.index = quad.index;
    this.barGeo.setAttribute('position', quad.attributes.position);
    this.barGeo.setAttribute('uv', quad.attributes.uv);
    this.barGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(128 * 3), 3));
    this.barGeo.setAttribute('iBar', new THREE.InstancedBufferAttribute(new Float32Array(128 * 3), 3));
    this.barGeo.instanceCount = 0;
    this.bars = new THREE.Mesh(this.barGeo, new THREE.ShaderMaterial({ vertexShader: BAR_VERT, fragmentShader: BAR_FRAG, transparent: true, depthTest: false, depthWrite: false }));
    this.bars.frustumCulled = false;
    this.bars.renderOrder = 20;
    this.group.add(this.bars);
  }

  /** Lámparas y fuegos del mundo (estáticos) y de la base (dinámicos). */
  setStaticLights(lights: LightDef[]) {
    this.fireLights = lights.filter((l) => l.kind === 'fire');
    this.lampLights = lights.filter((l) => l.kind !== 'fire');
    this.dirtyLights = true;
  }
  setDynamicLights(lights: LightDef[]) {
    this.dynLights = lights;
    this.dirtyLights = true;
  }

  private rebuildLights() {
    this.dirtyLights = false;
    this.halos?.removeFromParent();
    this.flames?.removeFromParent();
    const all = [...this.lampLights, ...this.fireLights, ...this.dynLights];
    // Halos
    {
      const g = new THREE.InstancedBufferGeometry();
      const quad = new THREE.PlaneGeometry(1, 1);
      g.index = quad.index;
      g.setAttribute('position', quad.attributes.position);
      g.setAttribute('uv', quad.attributes.uv);
      const pos = new Float32Array(all.length * 3);
      const col = new Float32Array(all.length * 4);
      const size = new Float32Array(all.length * 2);
      all.forEach((l, i) => {
        pos[i * 3] = l.x;
        pos[i * 3 + 1] = l.y;
        pos[i * 3 + 2] = l.z;
        const m = Math.max(l.r, l.g, l.b, 1e-4);
        col[i * 4] = l.r / m;
        col[i * 4 + 1] = l.g / m;
        col[i * 4 + 2] = l.b / m;
        col[i * 4 + 3] = l.kind === 'glow' ? 0.22 : l.kind === 'fire' ? 0.5 : 0.36;
        size[i * 2] = l.kind === 'glow' ? 1.0 : l.kind === 'fire' ? 2.6 : 1.9;
        size[i * 2 + 1] = l.flicker === 1 ? 1 : 0;
      });
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
      g.setAttribute('iCol', new THREE.InstancedBufferAttribute(col, 4));
      g.setAttribute('iSize', new THREE.InstancedBufferAttribute(size, 2));
      g.instanceCount = all.length;
      const m = new THREE.ShaderMaterial({
        vertexShader: BILLBOARD_VERT,
        fragmentShader: HALO_FRAG,
        uniforms: { ...THREE.UniformsLib.fog, uTime: this.timeU },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true,
      });
      this.halos = new THREE.Mesh(g, m);
      this.halos.frustumCulled = false;
      this.halos.renderOrder = 7;
      this.group.add(this.halos);
    }
    // Llamas
    {
      const fires = [...this.fireLights, ...this.dynLights.filter((l) => l.kind === 'fire')];
      const g = new THREE.InstancedBufferGeometry();
      // Dos planos cruzados con la base en el origen
      const p = new Float32Array([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1.5, 0, -0.5, 1.5, 0, 0, 0, -0.5, 0, 0, 0.5, 0, 1.5, 0.5, 0, 1.5, -0.5]);
      const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
      const ip = new Float32Array(fires.length * 4);
      fires.forEach((l, i) => {
        ip[i * 4] = l.x;
        ip[i * 4 + 1] = l.y - 0.45;
        ip[i * 4 + 2] = l.z;
        ip[i * 4 + 3] = (i * 0.618) % 1;
      });
      g.setAttribute('iPos', new THREE.InstancedBufferAttribute(ip, 4));
      g.instanceCount = fires.length;
      const m = new THREE.ShaderMaterial({
        vertexShader: FLAME_VERT,
        fragmentShader: FLAME_FRAG,
        uniforms: { uTime: this.timeU, uTex: { value: this.tex.flame } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      this.flames = new THREE.Mesh(g, m);
      this.flames.frustumCulled = false;
      this.flames.renderOrder = 6;
      this.group.add(this.flames);
    }
  }

  // --- Emisores ---------------------------------------------------------------

  spawn(x: number, y: number, z: number, n: number, o: { speed: number; life: number; size: number; color: [number, number, number]; grav?: number; add?: boolean; up?: number; spread?: number }) {
    for (let i = 0; i < n && this.parts.length < 560; i++) {
      const a = Math.random() * 6.283;
      const e = (Math.random() - 0.3) * (o.spread ?? 1);
      const s = o.speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x,
        y,
        z,
        vx: Math.cos(a) * s * Math.cos(e),
        vy: Math.sin(e) * s + (o.up ?? 0),
        vz: Math.sin(a) * s * Math.cos(e),
        life: o.life * (0.6 + Math.random() * 0.6),
        max: o.life,
        size: o.size * (0.6 + Math.random() * 0.7),
        r: o.color[0],
        g: o.color[1],
        b: o.color[2],
        grav: o.grav ?? 0,
        add: !!o.add,
      });
    }
  }

  blood(x: number, y: number, z: number, amount: number) {
    this.spawn(x, y, z, Math.min(14, 3 + Math.floor(amount / 4)), { speed: 2.2, life: 0.5, size: 0.09, color: [0.45, 0.02, 0.02], grav: 9, up: 1.2 });
  }
  sparks(x: number, y: number, z: number, n = 8) {
    this.spawn(x, y, z, n, { speed: 3.5, life: 0.3, size: 0.05, color: [1, 0.75, 0.3], grav: 6, add: true, up: 1 });
  }
  dust(x: number, y: number, z: number, n = 5) {
    this.spawn(x, y, z, n, { speed: 0.7, life: 1.1, size: 0.3, color: [0.3, 0.28, 0.25], up: 0.5, spread: 0.5 });
  }

  shot(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    this.tracers.push({ ax, ay, az, bx, by, bz, t: 0.09 });
    this.flashes.push({ x: ax, y: ay, z: az, color: 0xffc070, power: 260, dist: 16, prio: 5, t: 0.07 });
    this.spawn(ax, ay, az, 4, { speed: 2.5, life: 0.12, size: 0.14, color: [1, 0.8, 0.4], add: true });
  }

  text(x: number, y: number, z: number, text: string, color: string) {
    this.floats.push({ x, y, z, text, color, t: 0 });
    if (this.floats.length > 24) this.floats.shift();
  }

  // --- Actualización ------------------------------------------------------------

  update(
    dt: number,
    time: number,
    cam: THREE.Camera,
    focus: { x: number; z: number },
    data: {
      lights: DynLight[];
      spots: SpotReq[];
      rings: { x: number; y: number; z: number; r: number; color: number }[];
      dests: { x: number; y: number; z: number; color: number }[];
      blobs: { x: number; y: number; z: number; r: number }[];
      bars: { x: number; y: number; z: number; hp: number; kind: number; blood: number }[];
    },
  ) {
    this.timeU.value = time;
    if (this.dirtyLights) this.rebuildLights();
    // Luces puntuales: fogonazos y luces de la base, las más cercanas primero
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      this.flashes[i].t -= dt;
      if (this.flashes[i].t <= 0) this.flashes.splice(i, 1);
    }
    const cand = [...this.flashes, ...data.lights];
    cand.sort((a, b) => (b.prio ?? 0) - (a.prio ?? 0) || Math.hypot(a.x - focus.x, a.z - focus.z) - Math.hypot(b.x - focus.x, b.z - focus.z));
    for (let i = 0; i < this.points.length; i++) {
      const l = this.points[i];
      const c = cand[i];
      if (c && Math.hypot(c.x - focus.x, c.z - focus.z) < 110) {
        l.position.set(c.x, c.y, c.z);
        l.color.setHex(c.color);
        l.intensity = c.power;
        l.distance = c.dist;
      } else l.intensity = 0;
    }
    for (let i = 0; i < this.spots.length; i++) {
      const s = this.spots[i];
      const r = data.spots[i];
      if (r) {
        s.position.set(r.x, r.y, r.z);
        s.target.position.set(r.x + r.dx * 8, r.y - 1.5, r.z + r.dz * 8);
        s.intensity = r.power;
      } else s.intensity = 0;
    }
    // Partículas
    const pa = this.partGeo.attributes;
    const pb = this.partGeoAdd.attributes;
    let na = 0;
    let nb = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts.splice(i, 1);
        continue;
      }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.02) {
        p.y = 0.02;
        p.vy = 0;
        p.vx *= 0.5;
        p.vz *= 0.5;
      }
      const a = Math.min(1, p.life / (p.max * 0.5));
      const at = p.add ? pb : pa;
      const k = p.add ? nb++ : na++;
      (at.position.array as Float32Array).set([p.x, p.y, p.z], k * 3);
      (at.aCol.array as Float32Array).set([p.r, p.g, p.b, a], k * 4);
      (at.aSize.array as Float32Array)[k] = p.size;
    }
    for (const [g, n] of [
      [this.partGeo, na],
      [this.partGeoAdd, nb],
    ] as const) {
      g.setDrawRange(0, n);
      g.attributes.position.needsUpdate = true;
      g.attributes.aCol.needsUpdate = true;
      g.attributes.aSize.needsUpdate = true;
    }
    // Trazadoras
    {
      const pos = this.tracerGeo.attributes.position.array as Float32Array;
      const col = this.tracerGeo.attributes.color.array as Float32Array;
      let n = 0;
      for (let i = this.tracers.length - 1; i >= 0; i--) {
        const t = this.tracers[i];
        t.t -= dt;
        if (t.t <= 0) {
          this.tracers.splice(i, 1);
          continue;
        }
        if (n >= 64) continue;
        const k = t.t / 0.09;
        pos.set([t.ax, t.ay, t.az, t.bx, t.by, t.bz], n * 6);
        col.set([1 * k, 0.8 * k, 0.45 * k, 0.4 * k, 0.3 * k, 0.15 * k], n * 6);
        n++;
      }
      this.tracerGeo.setDrawRange(0, n * 2);
      this.tracerGeo.attributes.position.needsUpdate = true;
      this.tracerGeo.attributes.color.needsUpdate = true;
    }
    // Anillos
    const setRings = (mesh: THREE.InstancedMesh, list: { x: number; y: number; z: number; r?: number; color: number }[]) => {
      const n = Math.min(list.length, 64);
      for (let i = 0; i < n; i++) {
        const r = list[i];
        const s = (r.r ?? 0.45) / 0.45;
        tmpM.compose(tmpV.set(r.x, r.y + 0.04, r.z), FLAT, tmpS.set(s, s, 1));
        mesh.setMatrixAt(i, tmpM);
        mesh.setColorAt(i, tmpC.setHex(r.color));
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    setRings(this.rings, data.rings);
    setRings(this.dests, data.dests);
    {
      const n = Math.min(data.blobs.length, 256);
      for (let i = 0; i < n; i++) {
        const b = data.blobs[i];
        tmpM.compose(tmpV.set(b.x, b.y + 0.025, b.z), FLAT, tmpS.set(b.r * 2.2, b.r * 2.2, 1));
        this.blobs.setMatrixAt(i, tmpM);
      }
      this.blobs.count = n;
      this.blobs.instanceMatrix.needsUpdate = true;
    }
    {
      const ip = this.barGeo.attributes.iPos.array as Float32Array;
      const ib = this.barGeo.attributes.iBar.array as Float32Array;
      const n = Math.min(data.bars.length, 128);
      for (let i = 0; i < n; i++) {
        const b = data.bars[i];
        ip.set([b.x, b.y, b.z], i * 3);
        ib.set([b.hp, b.kind, b.blood], i * 3);
      }
      this.barGeo.instanceCount = n;
      this.barGeo.attributes.iPos.needsUpdate = true;
      this.barGeo.attributes.iBar.needsUpdate = true;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      this.floats[i].t += dt;
      if (this.floats[i].t > 2.2) this.floats.splice(i, 1);
    }
    void cam;
    void tmpQ;
  }

  dispose() {
    this.group.removeFromParent();
    for (const l of this.points) l.removeFromParent();
    for (const s of this.spots) {
      s.removeFromParent();
      s.target.removeFromParent();
    }
  }
}
