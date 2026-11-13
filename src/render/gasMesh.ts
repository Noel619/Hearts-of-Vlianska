// Bolsas de gas: niebla baja y pesada, a ras de suelo, que se arremolina
// despacio. Son discos horizontales suaves (no atraviesan el suelo) teñidos
// con la luz horneada del sitio y un poco de brillo propio para que se vean
// también a oscuras.

import * as THREE from 'three';
import { Rng } from '../core/rng';
import type { GasField } from '../world/gas';
import type { NavGrid } from '../world/grid';
import type { LightField } from '../world/lights';
import { globals } from './materials';
import type { TextureSet } from './textures';

/** Separación entre bocanadas (m). */
const STEP = 2.0;

const VERT = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iData;
  attribute vec3 iLight;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vCol;
  varying float vA;
  varying float vPh;
  #include <fog_pars_vertex>
  void main() {
    float ph = iData.y;
    // Gira y deriva despacio; la capa alta se mueve más
    float ang = uTime * ( 0.05 + 0.04 * fract( ph * 7.3 ) ) * ( fract( ph * 3.1 ) > 0.5 ? 1.0 : -1.0 ) + ph * 6.283;
    float cs = cos( ang );
    float sn = sin( ang );
    vec2 q = vec2( position.x * cs - position.y * sn, position.x * sn + position.y * cs );
    float s = iData.x * ( 0.92 + 0.1 * sin( uTime * 0.21 + ph * 11.0 ) );
    vec3 p = iPos;
    p.x += sin( uTime * 0.07 + ph * 6.283 ) * 0.7;
    p.z += cos( uTime * 0.06 + ph * 4.7 ) * 0.7;
    p.y += sin( uTime * 0.17 + ph * 9.0 ) * 0.08;
    vec4 mvPosition = modelViewMatrix * vec4( p.x + q.x * s, p.y, p.z + q.y * s, 1.0 );
    gl_Position = projectionMatrix * mvPosition;
    vUv = uv;
    vCol = iLight;
    vA = iData.z;
    vPh = ph;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uNoise;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vCol;
  varying float vA;
  varying float vPh;
  #include <fog_pars_fragment>
  void main() {
    float r = length( vUv - 0.5 ) * 2.0;
    float soft = 1.0 - smoothstep( 0.0, 1.0, r );
    soft *= soft;
    vec2 nuv = vUv * 0.55 + vec2( vPh, vPh * 0.37 ) + vec2( uTime * 0.006, -uTime * 0.004 );
    float n = texture2D( uNoise, nuv ).r;
    float n2 = texture2D( uNoise, nuv * 2.3 + 0.5 ).g;
    // Volutas: el ruido modula la densidad sin llegar a abrir huecos
    float a = soft * mix( 0.5, 1.0, smoothstep( 0.2, 0.85, n * 0.7 + n2 * 0.45 ) ) * vA;
    if ( a < 0.003 ) discard;
    gl_FragColor = vec4( vCol * a, a );
    #ifdef USE_FOG
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
      gl_FragColor *= 1.0 - fogFactor;
    #endif
  }
`;

export function buildGasMesh(gas: GasField, nav: NavGrid, field: LightField, tex: TextureSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'gas';
  const pos: number[] = [];
  const data: number[] = [];
  const light: number[] = [];
  const out = new Float32Array(6);
  // Amarillo verdoso sucio; el brillo propio mínimo para verlo sin lámparas
  const tint = [0.78, 0.86, 0.36];
  for (const p of gas.pockets) {
    const rng = new Rng(p.def.id.length * 7919 + Math.round(p.x * 13 + p.z * 7));
    for (let z = p.z0; z < p.z0 + p.rows; z += STEP) {
      for (let x = p.x0; x < p.x0 + p.cols; x += STEP) {
        const jx = x + rng.range(-0.7, 0.7);
        const jz = z + rng.range(-0.7, 0.7);
        const d = gas.at(jx, jz);
        if (d < 0.05 || !nav.passableAt(jx, jz, true)) continue;
        const ground = nav.heightAt(jx, jz);
        // Dos capas: una pegada al suelo y otra a media pierna, más tenue
        for (const layer of [0, 1]) {
          if (layer === 1 && rng.next() > d) continue;
          const y = ground + (layer ? rng.range(0.7, 1.1) : rng.range(0.12, 0.3));
          pos.push(jx, y, jz);
          data.push(rng.range(3.6, 5.4) * (layer ? 1.2 : 1), rng.next(), Math.min(1, d * (layer ? 0.2 : 0.3)), 0);
          field.sample(jx, y + 0.5, jz, 0, 1, 0, false, out);
          const lit = Math.min(1.6, out[0] * 0.3 + out[1] * 0.55 + out[2] * 0.15);
          const k = 0.22 + lit * 0.85;
          light.push(tint[0] * k, tint[1] * k, tint[2] * k);
        }
      }
    }
  }
  if (!pos.length) return group;
  const g = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  g.index = quad.index;
  g.setAttribute('position', quad.attributes.position);
  g.setAttribute('uv', quad.attributes.uv);
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('iData', new THREE.InstancedBufferAttribute(new Float32Array(data), 4));
  g.setAttribute('iLight', new THREE.InstancedBufferAttribute(new Float32Array(light), 3));
  g.instanceCount = pos.length / 3;
  const noise = tex.grunge.clone();
  noise.wrapS = noise.wrapT = THREE.RepeatWrapping;
  noise.needsUpdate = true;
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...THREE.UniformsLib.fog, uTime: globals.uTime, uNoise: { value: noise } },
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  group.add(mesh);
  return group;
}
