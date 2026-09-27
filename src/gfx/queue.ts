// Cola de generación en segundo plano: los sprites caros (retratos, escenas)
// se pintan en los huecos libres entre fotogramas para no congelar la interfaz.
import { useEffect, useState } from 'react';

type Job = { key: string; run: () => string };

const ready = new Map<string, string>();
const pending = new Map<string, Job>();
const listeners = new Map<string, Set<() => void>>();
let scheduled = false;

function schedule() {
  if (scheduled) return;
  scheduled = true;
  const tick = () => {
    scheduled = false;
    const start = performance.now();
    for (const [key, job] of pending) {
      pending.delete(key);
      try {
        ready.set(key, job.run());
      } catch (e) {
        console.error('No se pudo generar el sprite', key, e);
        ready.set(key, '');
      }
      listeners.get(key)?.forEach((fn) => fn());
      listeners.delete(key);
      if (performance.now() - start > 12) break;
    }
    if (pending.size) schedule();
  };
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(tick, { timeout: 120 });
  else setTimeout(tick, 16);
}

/** Devuelve la URL del sprite si ya existe; si no, lo encola y devuelve null. */
export function requestSprite(key: string, run: () => string, onReady?: () => void): string | null {
  const hit = ready.get(key);
  if (hit !== undefined) return hit;
  if (!pending.has(key)) pending.set(key, { key, run });
  if (onReady) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(onReady);
  }
  schedule();
  return null;
}

/** Hook de React: URL del sprite (o null mientras se pinta). */
export function useSprite(key: string, run: () => string): string | null {
  const [, force] = useState(0);
  const url = ready.get(key) ?? null;
  useEffect(() => {
    if (ready.has(key)) return;
    let alive = true;
    requestSprite(key, run, () => alive && force((n) => n + 1));
    return () => {
      alive = false;
    };
    // `run` cambia en cada render; la clave identifica el sprite.
  }, [key]);
  return url;
}

/** Genera por adelantado una lista de sprites (p. ej. al elegir facción). */
export function prewarm(jobs: { key: string; run: () => string }[]) {
  for (const j of jobs) requestSprite(j.key, j.run);
}
