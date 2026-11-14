// Vídeo y rendimiento: preajustes de calidad, límite de fotogramas, resolución
// del mapa y efectos de la interfaz. Todo se guarda con el resto de ajustes.
import type { MapQuality } from '../gfx/quality';

export interface VideoSettings {
  /** Densidad de píxeles máxima del mapa: 2 = nativa (pantallas HiDPI), 1 = normal, 0.5 = mitad. */
  resolution: number;
  /** Fotogramas por segundo máximos del mapa y del menú (0 = los de la pantalla). */
  fpsCap: number;
  lights: boolean;
  /** Densidad de partículas: 0, 0.4 o 1. */
  particles: number;
  tunnelDetail: boolean;
  postfx: boolean;
  /** Escena animada del menú principal. */
  menuAnimation: boolean;
  /** Sombras difuminadas y desenfoques de la interfaz. */
  uiEffects: boolean;
  /** Transiciones y animaciones de la interfaz. */
  uiAnimations: boolean;
  /** Contador de fotogramas en la esquina del mapa. */
  showFps: boolean;
}

export type PresetId = 'baja' | 'media' | 'alta';

type PresetValues = Omit<VideoSettings, 'showFps'>;

export const VIDEO_PRESETS: Record<PresetId, { name: string; desc: string; values: PresetValues }> = {
  baja: {
    name: 'Baja',
    desc: 'Para ordenadores modestos o portátiles con batería: 30 FPS, resolución reducida y sin efectos.',
    values: { resolution: 0.75, fpsCap: 30, lights: false, particles: 0, tunnelDetail: false, postfx: false, menuAnimation: false, uiEffects: false, uiAnimations: false },
  },
  media: {
    name: 'Media',
    desc: 'Equilibrio: 60 FPS, resolución normal y menos partículas.',
    values: { resolution: 1, fpsCap: 60, lights: true, particles: 0.4, tunnelDetail: true, postfx: false, menuAnimation: true, uiEffects: true, uiAnimations: true },
  },
  alta: {
    name: 'Alta',
    desc: 'Todo activado, a la resolución y frecuencia de tu pantalla.',
    values: { resolution: 2, fpsCap: 0, lights: true, particles: 1, tunnelDetail: true, postfx: true, menuAnimation: true, uiEffects: true, uiAnimations: true },
  },
};

export const PRESET_IDS: PresetId[] = ['baja', 'media', 'alta'];

/** Preajuste que encaja con los valores actuales, o null si están personalizados. */
export function currentPreset(s: VideoSettings): PresetId | null {
  return PRESET_IDS.find((id) => (Object.keys(VIDEO_PRESETS[id].values) as (keyof PresetValues)[]).every((k) => VIDEO_PRESETS[id].values[k] === s[k])) ?? null;
}

/** Preajuste recomendado para este equipo (la primera vez que se abre el juego). */
export function detectPreset(): PresetId {
  if (typeof navigator === 'undefined') return 'alta';
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (cores <= 2 || memory <= 2) return 'baja';
  if (cores <= 4 || memory <= 4) return 'media';
  return 'alta';
}

export function defaultVideoSettings(): VideoSettings {
  const values = { ...VIDEO_PRESETS[detectPreset()].values };
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    values.uiAnimations = false;
    values.menuAnimation = false;
  }
  return { ...values, showFps: false };
}

export const RESOLUTIONS: { v: number; label: string }[] = [
  { v: 2, label: 'Nativa' },
  { v: 1.5, label: 'Alta (150 %)' },
  { v: 1, label: 'Normal (100 %)' },
  { v: 0.75, label: 'Reducida (75 %)' },
  { v: 0.5, label: 'Mínima (50 %)' },
];

export const FPS_CAPS: { v: number; label: string }[] = [
  { v: 0, label: 'Sin límite (la de la pantalla)' },
  { v: 60, label: '60 FPS' },
  { v: 30, label: '30 FPS' },
];

export const PARTICLE_LEVELS: { v: number; label: string }[] = [
  { v: 1, label: 'Todas' },
  { v: 0.4, label: 'Reducidas' },
  { v: 0, label: 'Ninguna' },
];

/** Densidad de píxeles con la que se dibujan los lienzos. */
export function renderDpr(s: VideoSettings, max = 2): number {
  const native = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return Math.max(0.5, Math.min(native, s.resolution, max));
}

export function mapQuality(s: Pick<VideoSettings, keyof MapQuality>): MapQuality {
  return { lights: s.lights, particles: s.particles, tunnelDetail: s.tunnelDetail, postfx: s.postfx };
}

/** Clases del documento que desactivan los efectos caros de la interfaz. */
export function applyVideoClasses(s: VideoSettings) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('gfx-lite', !s.uiEffects);
  root.classList.toggle('gfx-still', !s.uiAnimations);
}

/**
 * Limita los fotogramas de un bucle de requestAnimationFrame.
 * `ready(now, fps)` dice si toca dibujar; con fps 0 dibuja siempre.
 */
export class FrameLimiter {
  private last = -Infinity;
  private frames = 0;
  private since = 0;
  /** Fotogramas dibujados por segundo (medidos). */
  fps = 0;

  ready(now: number, fps: number): boolean {
    if (fps > 0) {
      const interval = 1000 / fps;
      // Un milisegundo de margen para no perder fotogramas por redondeo con pantallas de 60 Hz.
      if (now - this.last < interval - 1) return false;
      const next = this.last + interval;
      // Si nos hemos quedado muy atrás (pestaña oculta, pausa), se vuelve a empezar desde ahora.
      this.last = now - next > interval ? now : next;
    } else this.last = now;
    this.frames++;
    if (now - this.since >= 500) {
      this.fps = (this.frames * 1000) / (now - this.since);
      this.frames = 0;
      this.since = now;
    }
    return true;
  }
}

// ---------------------------------------------------------------------------
// Pantalla completa y versión de escritorio
// ---------------------------------------------------------------------------

/** Puente que expone la versión de escritorio (desktop/preload.cjs). */
export interface DesktopBridge {
  platform: string;
  quit: () => void;
  setFullscreen: (on: boolean) => void;
  isFullscreen: () => boolean;
  onFullscreenChange: (fn: (on: boolean) => void) => () => void;
}

export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : (window as Window & { vlianskaDesktop?: DesktopBridge }).vlianskaDesktop;
}

export const isDesktopApp = () => !!desktopBridge();

// En la versión de escritorio se usa la pantalla completa de la ventana (F11), que no
// captura la tecla Esc: el juego la necesita para cerrar paneles y abrir el menú.
export function isFullscreen(): boolean {
  const d = desktopBridge();
  if (d) return d.isFullscreen();
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

export function fullscreenSupported(): boolean {
  return isDesktopApp() || (typeof document !== 'undefined' && !!document.documentElement.requestFullscreen);
}

export async function setFullscreen(on: boolean) {
  const d = desktopBridge();
  if (d) return d.setFullscreen(on);
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    else if (!on && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* el navegador lo ha impedido */
  }
}

export function onFullscreenChange(fn: () => void): () => void {
  const d = desktopBridge();
  if (d) return d.onFullscreenChange(() => fn());
  document.addEventListener('fullscreenchange', fn);
  return () => document.removeEventListener('fullscreenchange', fn);
}
