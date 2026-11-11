// Motor gráfico: renderizador WebGL, escena, niebla, posprocesado (bloom,
// viñeta, grano y gradación de color) y niveles de calidad.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { globals } from './materials';

export type Quality = 'baja' | 'media' | 'alta';

export interface GfxOptions {
  quality: Quality;
  /** Límite de densidad de píxeles. */
  maxPixelRatio?: number;
}

const FinalShader = {
  name: 'VlFinal',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.9 },
    uGrain: { value: 0.035 },
    uHurt: { value: 0 },
    uDesat: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uHurt;
    uniform float uDesat;
    varying vec2 vUv;
    float hash( vec2 p ) {
      p = fract( p * vec2( 123.34, 456.21 ) );
      p += dot( p, p + 45.32 );
      return fract( p.x * p.y );
    }
    void main() {
      vec2 d = vUv - 0.5;
      float r2 = dot( d, d );
      // Aberración cromática muy leve hacia los bordes
      vec2 off = d * r2 * 0.012;
      vec3 c;
      c.r = texture2D( tDiffuse, vUv + off ).r;
      c.g = texture2D( tDiffuse, vUv ).g;
      c.b = texture2D( tDiffuse, vUv - off ).b;
      // Gradación: sombras frías, luces cálidas
      float l = dot( c, vec3( 0.299, 0.587, 0.114 ) );
      c = mix( c, c * vec3( 0.92, 1.0, 1.1 ), ( 1.0 - smoothstep( 0.0, 0.35, l ) ) * 0.5 );
      c = mix( c, c * vec3( 1.06, 1.01, 0.93 ), smoothstep( 0.45, 1.0, l ) * 0.6 );
      c = mix( c, vec3( l ), uDesat );
      // Viñeta
      float v = smoothstep( 0.95, 0.18, r2 * uVignette * 1.7 );
      c *= mix( 0.42, 1.0, v );
      // Daño: bordes rojos
      c = mix( c, vec3( 0.5, 0.02, 0.0 ) * ( 0.4 + l ), uHurt * smoothstep( 0.08, 0.5, r2 ) );
      // Grano
      float g = hash( vUv * vec2( 1920.0, 1080.0 ) + fract( uTime ) * 91.7 ) - 0.5;
      c += g * uGrain * ( 1.0 - l * 0.6 );
      gl_FragColor = vec4( c, 1.0 );
    }
  `,
};

export class Gfx {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.5, 520);
  readonly composer: EffectComposer;
  readonly bloom: UnrealBloomPass;
  readonly finalPass: ShaderPass;
  readonly ambient: THREE.AmbientLight;
  quality: Quality;
  time = 0;
  private maxPixelRatio: number;

  constructor(
    readonly canvas: HTMLCanvasElement,
    opts: GfxOptions,
  ) {
    this.quality = opts.quality;
    this.maxPixelRatio = opts.maxPixelRatio ?? (opts.quality === 'alta' ? 2 : opts.quality === 'media' ? 1.5 : 1);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.renderer = renderer;
    renderer.info.autoReset = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = opts.quality !== 'baja';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x030405, 1);
    this.scene.fog = new THREE.FogExp2(0x040608, 0.0105);
    this.scene.background = new THREE.Color(0x030405);
    this.ambient = new THREE.AmbientLight(0x8fa3c4, 0.62);
    this.scene.add(this.ambient);
    this.scene.add(this.camera);

    const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: opts.quality === 'baja' ? 0 : 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.7, 0.92);
    this.bloom.enabled = opts.quality !== 'baja';
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.finalPass = new ShaderPass(FinalShader);
    this.composer.addPass(this.finalPass);
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.maxPixelRatio);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt: number) {
    this.time += dt;
    globals.uTime.value = this.time;
    globals.uCam.value.copy(this.camera.position);
    this.finalPass.uniforms.uTime.value = this.time;
    this.renderer.info.reset();
    this.composer.render(dt);
  }

  dispose() {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
