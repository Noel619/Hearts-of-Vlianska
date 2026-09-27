// Estado de la interfaz y bucle de tiempo de la partida.
import { useSyncExternalStore } from 'react';
import type { FactionId, GameState } from '../game/types';
import { advanceHour } from '../game/engine';
import { isNewMonth } from '../game/time';
import { autosave } from './saves';

/** Horas de juego por segundo real en cada velocidad. */
export const SPEEDS = [0, 4, 10, 24, 60, 160];

export interface Settings {
  pauseOnEvents: boolean;
  autosave: boolean;
  fog: boolean;
  confirmWar: boolean;
  /** Volúmenes (0..1) y silencio general. */
  volMaster: number;
  volMusic: number;
  volAmbience: number;
  volSfx: number;
  muted: boolean;
}

const SETTINGS_KEY = 'hov-settings';

function loadSettings(): Settings {
  const defaults: Settings = { pauseOnEvents: true, autosave: true, fog: true, confirmWar: true, volMaster: 0.8, volMusic: 0.6, volAmbience: 0.55, volSfx: 0.8, muted: false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* almacenamiento no disponible */
  }
  return defaults;
}

class GameStore {
  state: GameState | null = null;
  version = 0;
  speed = 0;
  lastSpeed = 2;
  settings: Settings = loadSettings();
  gameOverSeen = false;
  private listeners = new Set<() => void>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private lastEmit = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  getVersion = () => this.version;

  emit() {
    this.version++;
    for (const l of this.listeners) l();
  }

  setState(s: GameState | null) {
    this.state = s;
    this.speed = 0;
    this.acc = 0;
    this.gameOverSeen = !!s?.gameOver;
    this.emit();
  }

  /** Ejecuta un cambio sobre la partida y refresca la interfaz. */
  act<T>(fn: (s: GameState) => T): T | undefined {
    if (!this.state) return undefined;
    const r = fn(this.state);
    this.emit();
    return r;
  }

  setSpeed(n: number) {
    const v = Math.max(0, Math.min(5, n));
    if (v > 0) this.lastSpeed = v;
    this.speed = v;
    this.emit();
  }

  togglePause() {
    this.setSpeed(this.speed === 0 ? this.lastSpeed : 0);
  }

  updateSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignorado */
    }
    this.emit();
  }

  get player(): FactionId | null {
    return this.state?.player ?? null;
  }

  blocked(): boolean {
    const s = this.state;
    if (!s) return true;
    if (this.settings.pauseOnEvents && s.playerEvents.length > 0) return true;
    if (s.peaceOffers.length > 0) return true;
    if (s.gameOver && !this.gameOverSeen) return true;
    return false;
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.25, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      const s = this.state;
      if (!s || this.speed === 0) return;
      if (this.blocked()) {
        this.speed = 0;
        this.emit();
        return;
      }
      this.acc += dt * SPEEDS[this.speed];
      let steps = Math.floor(this.acc);
      if (steps <= 0) return;
      this.acc -= steps;
      steps = Math.min(steps, 96);
      let stopped = false;
      for (let i = 0; i < steps; i++) {
        advanceHour(s);
        if (isNewMonth(s.hour) && this.settings.autosave) autosave(s);
        if (this.blocked()) {
          this.speed = 0;
          stopped = true;
          break;
        }
      }
      if (stopped || t - this.lastEmit > 45) {
        this.lastEmit = t;
        this.emit();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }
}

export const store = new GameStore();

export function useVersion() {
  return useSyncExternalStore(store.subscribe, store.getVersion);
}

/** Devuelve la partida actual y vuelve a renderizar cuando cambia. */
export function useGame(): GameState {
  useVersion();
  return store.state as GameState;
}

// ---------------------------------------------------------------------------
// Pequeño almacén genérico para el estado de la interfaz
// ---------------------------------------------------------------------------

export function createUIStore<T extends object>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  const api = {
    get: () => value,
    set: (patch: Partial<T> | ((v: T) => Partial<T>)) => {
      const p = typeof patch === 'function' ? patch(value) : patch;
      value = { ...value, ...p };
      for (const l of listeners) l();
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    use: () => useSyncExternalStore(api.subscribe, api.get),
  };
  return api;
}

export type PanelId = 'politica' | 'diplomacia' | 'construccion' | 'produccion' | 'comercio' | 'ejercito' | 'decisiones' | 'registro';
export type MapMode = 'politico' | 'terreno' | 'peligro' | 'suministro' | 'diplomatico';

export interface UIState {
  panel: PanelId | null;
  overlay: 'focus' | 'tech' | 'templates' | null;
  menuOpen: boolean;
  selectedUnits: string[];
  selectedProvince: string | null;
  mapMode: MapMode;
  moveMode: boolean;
  diploTarget: FactionId | null;
  helpOpen: boolean;
  centerOn: { id: string; n: number } | null;
}

export const ui = createUIStore<UIState>({
  panel: null,
  overlay: null,
  menuOpen: false,
  selectedUnits: [],
  selectedProvince: null,
  mapMode: 'politico',
  moveMode: false,
  diploTarget: null,
  helpOpen: false,
  centerOn: null,
});

let centerCounter = 0;
export function centerMapOn(id: string) {
  centerCounter++;
  ui.set({ centerOn: { id, n: centerCounter } });
}

// ---------------------------------------------------------------------------
// Navegación entre pantallas
// ---------------------------------------------------------------------------

export type Screen = 'menu' | 'setup' | 'game' | 'lore';
export const nav = createUIStore<{ screen: Screen; loadOpen: boolean; helpOpen: boolean }>({ screen: 'menu', loadOpen: false, helpOpen: false });

export function go(screen: Screen) {
  nav.set({ screen, loadOpen: false, helpOpen: false });
  ui.set({ panel: null, overlay: null, menuOpen: false, selectedUnits: [], selectedProvince: null, moveMode: false, helpOpen: false });
}
