// Materiales del juego. Todos parten de MeshStandardMaterial y añaden, por
// inyección de GLSL:
//  - luz horneada por vértice / por instancia / por sonda (color + dirección dominante),
//  - corte dinámico de los muros que quedan entre la cámara y el pasillo,
//  - emisión y tinte de facción por vértice, suciedad triplanar,
//  - mezcla de tres texturas para los suelos.

import * as THREE from 'three';
import type { SurfaceTex, TextureSet } from './textures';

/** Uniformes compartidos por todos los materiales. */
export const globals = {
  uCam: { value: new THREE.Vector3(0, 50, 0) },
  uTime: { value: 0 },
  uCollapse: { value: 1 },
  uGrunge: { value: null as THREE.Texture | null },
};

const VERT_PARS = /* glsl */ `
uniform vec3 uCam;
uniform float uTime;
uniform float uCollapse;
#ifdef VL_BAKE_VERTEX
  attribute vec3 bakeCol;
  attribute vec3 bakeDir;
#endif
#ifdef VL_BAKE_INSTANCE
  attribute vec3 iBakeCol;
  attribute vec3 iBakeDir;
#endif
#if defined( VL_BAKE_VERTEX ) || defined( VL_BAKE_INSTANCE )
  varying vec3 vBakeCol;
  varying vec3 vBakeDir;
#endif
#ifdef VL_WALL
  attribute vec3 wallN;
#endif
#ifdef VL_IWALL
  attribute vec3 iWall;
#endif
#ifdef VL_FX
  attribute vec2 fx;
  varying vec2 vFx;
  varying float vPhase;
#endif
#ifdef VL_ITINT
  attribute vec3 iTint;
  varying vec3 vTint;
#endif
#ifdef VL_SPLAT
  attribute vec4 splat;
  varying vec4 vSplat;
#endif
#ifdef VL_GRUNGE
  varying vec3 vObjPos;
  varying vec3 vObjNor;
#endif
`;

const VERT_BEGIN = /* glsl */ `
vec3 transformed = vec3( position );
float vlLowered = 0.0;
#ifdef VL_WALL
  {
    float vlSide = dot( wallN.xy, uCam.xz - transformed.xz );
    float vlK = smoothstep( -0.5, 3.0, vlSide ) * step( 0.001, wallN.z ) * uCollapse;
    vlLowered = vlK * step( wallN.z + 0.01, transformed.y );
    transformed.y = mix( transformed.y, min( transformed.y, wallN.z ), vlK );
    #ifdef USE_COLOR
      vColor.rgb *= 1.0 - 0.72 * vlLowered;
    #endif
  }
#endif
#ifdef VL_IWALL
  {
    vec3 vlIp = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
    float vlSide = dot( iWall.xy, uCam.xz - vlIp.xz );
    float vlK = smoothstep( -0.5, 3.0, vlSide ) * step( 0.001, dot( iWall.xy, iWall.xy ) ) * uCollapse;
    transformed *= ( 1.0 - vlK );
  }
#endif
#ifdef VL_BAKE_VERTEX
  vBakeCol = bakeCol * ( 1.0 - 0.8 * vlLowered );
  vBakeDir = bakeDir;
#endif
#ifdef VL_BAKE_INSTANCE
  vBakeCol = iBakeCol;
  vBakeDir = iBakeDir;
#endif
#ifdef VL_FX
  vFx = fx;
  vPhase = 0.0;
  #ifdef VL_IWALL
    vPhase = iWall.z;
  #endif
#endif
#ifdef VL_ITINT
  vTint = iTint;
#endif
#ifdef VL_SPLAT
  vSplat = splat;
#endif
#ifdef VL_GRUNGE
  vObjPos = position;
  vObjNor = normal;
  #ifdef VL_IWALL
    vObjPos += vec3( iWall.z * 37.0, iWall.z * 11.0, iWall.z * 23.0 );
  #endif
#endif
`;

const FRAG_PARS = /* glsl */ `
uniform float uTime;
#if defined( VL_BAKE_VERTEX ) || defined( VL_BAKE_INSTANCE )
  varying vec3 vBakeCol;
  varying vec3 vBakeDir;
#endif
#ifdef VL_PROBE
  uniform vec3 uProbeCol;
  uniform vec3 uProbeDir;
#endif
#ifdef VL_FX
  varying vec2 vFx;
  varying float vPhase;
#endif
#ifdef VL_ITINT
  varying vec3 vTint;
#endif
#ifdef VL_SPLAT
  varying vec4 vSplat;
  uniform sampler2D uMapB;
  uniform sampler2D uMapC;
  uniform sampler2D uNormB;
  uniform sampler2D uNormC;
  uniform float uClipSdf;
#endif
#ifdef VL_GRUNGE
  uniform sampler2D uGrunge;
  varying vec3 vObjPos;
  varying vec3 vObjNor;
#endif
`;

const FRAG_MAIN_BEGIN = /* glsl */ `
vec3 vlSpecDir = vec3( 0.0, 0.0, 1.0 );
vec3 vlSpecCol = vec3( 0.0 );
float vlRough = 0.5;
#ifdef VL_SPLAT
  vec3 vlW = max( vSplat.xyz, 0.0 );
  vlW /= ( vlW.x + vlW.y + vlW.z + 0.0001 );
#endif
`;

const FRAG_MAP = /* glsl */ `
#ifdef VL_SPLAT
  if ( vSplat.w > uClipSdf ) discard;
  vec4 sampledDiffuseColor = texture2D( map, vMapUv ) * vlW.x + texture2D( uMapB, vMapUv ) * vlW.y + texture2D( uMapC, vMapUv ) * vlW.z;
  diffuseColor *= sampledDiffuseColor;
#else
  #include <map_fragment>
#endif
`;

const FRAG_COLOR = /* glsl */ `
#include <color_fragment>
#ifdef VL_ITINT
  diffuseColor.rgb *= mix( vec3( 1.0 ), vTint, clamp( vFx.y, 0.0, 1.0 ) );
#endif
#ifdef VL_GRUNGE
  {
    vec3 vlAn = abs( normalize( vObjNor ) );
    vlAn /= ( vlAn.x + vlAn.y + vlAn.z );
    vec3 vlP = vObjPos * 0.31;
    vec3 vlG = texture2D( uGrunge, vlP.zy ).rgb * vlAn.x + texture2D( uGrunge, vlP.xz ).rgb * vlAn.y + texture2D( uGrunge, vlP.xy ).rgb * vlAn.z;
    diffuseColor.rgb *= 0.7 + vlG.r * 0.6;
    diffuseColor.rgb *= 1.0 - vlG.b * 0.25;
    vlRough = vlG.g;
  }
#endif
`;

const FRAG_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp( roughnessFactor + ( vlRough - 0.5 ) * 0.35, 0.06, 1.0 );
`;

const FRAG_NORMAL_MAPS = /* glsl */ `
#ifdef VL_SPLAT
  vec3 mapN = ( texture2D( normalMap, vNormalMapUv ).xyz * vlW.x + texture2D( uNormB, vNormalMapUv ).xyz * vlW.y + texture2D( uNormC, vNormalMapUv ).xyz * vlW.z ) * 2.0 - 1.0;
  mapN.xy *= normalScale;
  normal = normalize( tbn * mapN );
#else
  #include <normal_fragment_maps>
#endif
`;

const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
#ifdef VL_FX
  {
    float vlPh = abs( vPhase );
    float vlFl = 1.0 + 0.16 * sin( uTime * 11.0 + vlPh * 50.0 ) * sin( uTime * 5.3 + vlPh * 31.0 );
    totalEmissiveRadiance += vColor.rgb * vFx.x * vlFl * step( 0.0, vPhase );
  }
#endif
`;

const FRAG_LIGHTS_MAPS = /* glsl */ `
#include <lights_fragment_maps>
#if defined( VL_BAKE_VERTEX ) || defined( VL_BAKE_INSTANCE ) || defined( VL_PROBE )
  {
    #ifdef VL_PROBE
      vec3 vlCol = uProbeCol;
      vec3 vlDirW = uProbeDir;
    #else
      vec3 vlCol = vBakeCol;
      vec3 vlDirW = vBakeDir;
    #endif
    float vlLen = length( vlDirW );
    if ( vlLen > 0.001 ) {
      float vlD = min( vlLen, 1.0 );
      vec3 vlDirV = normalize( ( viewMatrix * vec4( vlDirW, 0.0 ) ).xyz );
      const float vlWr = 0.35;
      float vlA = ( max( dot( normal, vlDirV ), - vlWr ) + vlWr ) / ( 1.0 + vlWr );
      #ifdef VL_BAKE_VERTEX
        float vlB = ( max( dot( normalize( vNormal ), vlDirV ), - vlWr ) + vlWr ) / ( 1.0 + vlWr );
        vlCol *= mix( 1.0, clamp( vlA / max( vlB, 0.12 ), 0.0, 2.4 ), vlD );
      #else
        vlCol *= mix( 1.0, vlA * 1.5, vlD );
      #endif
      vlSpecDir = vlDirV;
      vlSpecCol = vlCol * vlD;
    }
    irradiance += vlCol * PI;
  }
#endif
`;

const FRAG_LIGHTS_END = /* glsl */ `
#include <lights_fragment_end>
#if defined( VL_BAKE_VERTEX ) || defined( VL_BAKE_INSTANCE ) || defined( VL_PROBE )
  {
    vec3 vlH = normalize( vlSpecDir + geometryViewDir );
    float vlS = pow( max( dot( normal, vlH ), 0.0 ), mix( 70.0, 5.0, roughnessFactor ) );
    reflectedLight.directSpecular += vlSpecCol * vlS * ( 1.0 - roughnessFactor ) * 1.1;
  }
#endif
`;

function patch(shader: THREE.WebGLProgramParametersWithUniforms, mat: THREE.Material) {
  shader.uniforms.uCam = globals.uCam;
  shader.uniforms.uTime = globals.uTime;
  shader.uniforms.uCollapse = globals.uCollapse;
  shader.uniforms.uGrunge = globals.uGrunge;
  const extra = mat.userData.uniforms as Record<string, THREE.IUniform> | undefined;
  if (extra) for (const k of Object.keys(extra)) shader.uniforms[k] = extra[k];
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_PARS).replace('#include <begin_vertex>', VERT_BEGIN);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
    .replace('#include <clipping_planes_fragment>', FRAG_MAIN_BEGIN + '\n#include <clipping_planes_fragment>')
    .replace('#include <map_fragment>', FRAG_MAP)
    .replace('#include <color_fragment>', FRAG_COLOR)
    .replace('#include <roughnessmap_fragment>', FRAG_ROUGH)
    .replace('#include <normal_fragment_maps>', FRAG_NORMAL_MAPS)
    .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
    .replace('#include <lights_fragment_maps>', FRAG_LIGHTS_MAPS)
    .replace('#include <lights_fragment_end>', FRAG_LIGHTS_END);
}

function onCompile(this: THREE.Material, shader: THREE.WebGLProgramParametersWithUniforms) {
  patch(shader, this);
}

export type Defines = Partial<Record<'VL_BAKE_VERTEX' | 'VL_BAKE_INSTANCE' | 'VL_PROBE' | 'VL_WALL' | 'VL_IWALL' | 'VL_FX' | 'VL_ITINT' | 'VL_SPLAT' | 'VL_GRUNGE', ''>>;

function make(params: THREE.MeshStandardMaterialParameters, defines: Defines, uniforms?: Record<string, THREE.IUniform>): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial(params);
  m.defines = { ...(m.defines ?? {}), ...defines };
  if (uniforms) m.userData.uniforms = uniforms;
  m.onBeforeCompile = onCompile;
  return m;
}

export interface WorldMatOptions {
  roughness?: number;
  metalness?: number;
  normalScale?: number;
  alphaTest?: number;
  wall?: boolean;
  side?: THREE.Side;
  polygonOffset?: number;
}

/** Superficie texturizada del mundo con luz horneada por vértice. */
export function worldMaterial(tex: SurfaceTex, o: WorldMatOptions = {}): THREE.MeshStandardMaterial {
  const m = make(
    {
      map: tex.map,
      normalMap: tex.normalMap,
      roughnessMap: tex.roughnessMap,
      roughness: o.roughness ?? 1,
      metalness: o.metalness ?? 0,
      vertexColors: true,
      alphaTest: o.alphaTest ?? 0,
      side: o.side ?? THREE.FrontSide,
    },
    { VL_BAKE_VERTEX: '', ...(o.wall ? { VL_WALL: '' } : {}) },
  );
  m.normalScale.setScalar(o.normalScale ?? 1);
  if (o.polygonOffset) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -o.polygonOffset;
    m.polygonOffsetUnits = -o.polygonOffset * 2;
  }
  return m;
}

/** Suelo: mezcla de tres texturas y recorte por distancia al muro. */
export function floorMaterial(a: SurfaceTex, b: SurfaceTex, c: SurfaceTex, clipSdf: number): THREE.MeshStandardMaterial {
  return make(
    { map: a.map, normalMap: a.normalMap, roughness: 0.86, metalness: 0, vertexColors: true },
    { VL_BAKE_VERTEX: '', VL_SPLAT: '' },
    {
      uMapB: { value: b.map },
      uMapC: { value: c.map },
      uNormB: { value: b.normalMap },
      uNormC: { value: c.normalMap },
      uClipSdf: { value: clipSdf },
    },
  );
}

/** Atrezo instanciado: color por vértice, emisión, tinte y luz por instancia. */
export function propMaterial(opts: { metalness?: number; roughness?: number; side?: THREE.Side } = {}): THREE.MeshStandardMaterial {
  return make(
    { vertexColors: true, roughness: opts.roughness ?? 0.82, metalness: opts.metalness ?? 0, side: opts.side ?? THREE.FrontSide },
    { VL_BAKE_INSTANCE: '', VL_IWALL: '', VL_FX: '', VL_ITINT: '', VL_GRUNGE: '' },
  );
}

/** Mallas únicas con color por vértice y luz horneada por vértice. */
export function solidMaterial(opts: { wall?: boolean; roughness?: number; metalness?: number; side?: THREE.Side; grunge?: boolean } = {}): THREE.MeshStandardMaterial {
  return make(
    { vertexColors: true, roughness: opts.roughness ?? 0.82, metalness: opts.metalness ?? 0, side: opts.side ?? THREE.FrontSide },
    { VL_BAKE_VERTEX: '', VL_FX: '', ...(opts.grunge === false ? {} : { VL_GRUNGE: '' }), ...(opts.wall ? { VL_WALL: '' } : {}) },
  );
}

/** Personajes y objetos móviles: luz por sonda (uniformes propios de cada material). */
export function probeMaterial(opts: { roughness?: number; metalness?: number; grunge?: boolean; side?: THREE.Side } = {}): THREE.MeshStandardMaterial {
  const uniforms = {
    uProbeCol: { value: new THREE.Vector3(0.2, 0.2, 0.2) },
    uProbeDir: { value: new THREE.Vector3(0, 0.5, 0) },
  };
  const m = make(
    { vertexColors: true, roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0, side: opts.side ?? THREE.FrontSide },
    { VL_PROBE: '', VL_FX: '', ...(opts.grunge ? { VL_GRUNGE: '' } : {}) },
    uniforms,
  );
  return m;
}

/** Clona un material de sonda con uniformes independientes. */
export function cloneProbeMaterial(src: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const m = src.clone();
  m.defines = { ...src.defines };
  m.userData.uniforms = {
    uProbeCol: { value: new THREE.Vector3(0.2, 0.2, 0.2) },
    uProbeDir: { value: new THREE.Vector3(0, 0.5, 0) },
  };
  m.onBeforeCompile = onCompile;
  return m;
}

export function setProbe(m: THREE.Material, r: number, g: number, b: number, dx: number, dy: number, dz: number) {
  const u = m.userData.uniforms as { uProbeCol: { value: THREE.Vector3 }; uProbeDir: { value: THREE.Vector3 } };
  u.uProbeCol.value.set(r, g, b);
  u.uProbeDir.value.set(dx, dy, dz);
}

export function initMaterialGlobals(tex: TextureSet) {
  globals.uGrunge.value = tex.grunge;
}
