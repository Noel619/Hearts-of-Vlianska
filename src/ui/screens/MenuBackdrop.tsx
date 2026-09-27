// Fondo animado del menú principal (src/gfx/scenes/menu.ts).
import { useEffect, useRef } from 'react';
import { DPR } from '../../gfx/canvas';
import { MenuScene } from '../../gfx/scenes/menu';
import { preloadMap } from '../map/MapView';

export function MenuBackdrop() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const scene = new MenuScene(canvas.current!);
    let raf = 0;
    let last = performance.now();
    let resizeTimer = 0;
    const apply = () => {
      const r = wrap.current!.getBoundingClientRect();
      scene.resize(Math.max(1, r.width), Math.max(1, r.height), Math.min(1.5, DPR()));
    };
    apply();
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(apply, 120);
    });
    ro.observe(wrap.current!);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      scene.render(reduced ? 0 : now / 1000, reduced ? 0 : dt);
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
