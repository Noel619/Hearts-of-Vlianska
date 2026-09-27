// Fondo animado del menú principal (src/gfx/scenes/menu.ts).
import { useEffect, useRef } from 'react';
import { MenuScene } from '../../gfx/scenes/menu';
import { preloadMap } from '../map/MapView';
import { store } from '../store';
import { FrameLimiter, renderDpr } from '../video';

export function MenuBackdrop() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const scene = new MenuScene(canvas.current!);
    const limiter = new FrameLimiter();
    let raf = 0;
    let last = performance.now();
    let resizeTimer = 0;
    let dpr = 0;
    // Con la animación desactivada basta con un fotograma fijo (y otro si cambia el tamaño).
    let stillDrawn = false;
    const apply = () => {
      const r = wrap.current!.getBoundingClientRect();
      dpr = Math.min(1.5, renderDpr(store.settings));
      scene.resize(Math.max(1, r.width), Math.max(1, r.height), dpr);
      stillDrawn = false;
    };
    apply();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(apply, 120);
    });
    ro.observe(wrap.current!);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const s = store.settings;
      if (Math.min(1.5, renderDpr(s)) !== dpr) apply();
      if (!s.menuAnimation) {
        if (!stillDrawn) scene.render(0, 0);
        stillDrawn = true;
        last = now;
        return;
      }
      stillDrawn = false;
      if (!limiter.ready(now, s.fpsCap)) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      scene.render(now / 1000, dt);
    };
    raf = requestAnimationFrame(loop);
    // Mientras se mira el menú, se preparan las capas del mapa
    preloadMap();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.clearTimeout(resizeTimer);
    };
  }, []);
  return (
    <div ref={wrap} className="menu-backdrop">
      <canvas ref={canvas} />
    </div>
  );
}
