// Texturas continuas para la interfaz: acero cepillado, hormigón y papel viejo.
// Se generan una vez al arrancar y se exponen como variables CSS.
import { ctx2d, makeCanvas } from './canvas';
import { fbm } from './noise';
import { hash2, range, rng } from './rng';

function tileNoise(size: number, cells: number, seed: number, octaves: number, fn: (n: number, x: number, y: number) => [number, number, number, number]) {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  const img = g.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm((x / size) * cells, (y / size) * cells, octaves, seed, cells);
      const [r, gg, b, a] = fn(n, x, y);
      const i = (y * size + x) * 4;
      d[i] = r;
      d[i + 1] = gg;
      d[i + 2] = b;
      d[i + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Acero oscuro cepillado con manchas de óxido y arañazos. */
export function steelTexture(size = 256): HTMLCanvasElement {
  const c = tileNoise(size, 4, 11, 5, (n, x, y) => {
    const streak = (hash2(0, y, 3) - 0.5) * 10 + (hash2(Math.floor(x / 64), y, 4) - 0.5) * 6;
    const v = 30 + n * 22 + streak;
    return [v, v + 2, v + 2, 255];
  });
  const g = ctx2d(c);
  const r = rng('steel');
  // Óxido
  const rust = tileNoise(size, 6, 23, 4, (n) => {
    const a = Math.max(0, (n - 0.62) * 3.2);
    return [96, 48, 22, Math.min(1, a) * 150];
  });
  g.globalAlpha = 0.55;
  g.drawImage(rust, 0, 0);
  g.globalAlpha = 1;
  // Arañazos (repetidos en los bordes para que la textura siga siendo continua)
  g.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = range(r, 0, size);
    const y = range(r, 0, size);
    const a = range(r, -0.3, 0.3) + (r() < 0.3 ? Math.PI / 2 : 0);
    const l = range(r, 8, 40);
    g.strokeStyle = `rgba(200,205,205,${range(r, 0.04, 0.12)})`;
    g.lineWidth = range(r, 0.4, 1);
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
        g.stroke();
      }
    }
  }
  return c;
}

/** Hormigón con poros y manchas de humedad. */
export function concreteTexture(size = 256): HTMLCanvasElement {
  const c = tileNoise(size, 8, 5, 6, (n, x, y) => {
    const pore = hash2(x, y, 9) > 0.985 ? -18 : 0;
    const v = 26 + n * 26 + pore + (hash2(x, y, 2) - 0.5) * 8;
    return [v + 1, v + 1, v - 1, 255];
  });
  const g = ctx2d(c);
  const damp = tileNoise(size, 3, 41, 4, (n) => [8, 12, 10, Math.max(0, (n - 0.55) * 2.2) * 120]);
  g.drawImage(damp, 0, 0);
  return c;
}

/** Papel envejecido para la crónica y los documentos. */
export function paperTexture(size = 256): HTMLCanvasElement {
  return tileNoise(size, 6, 17, 6, (n, x, y) => {
    const fiber = (hash2(x, y, 5) - 0.5) * 14;
    const v = 200 + n * 40 + fiber;
    return [v, v * 0.93, v * 0.78, 255];
  });
}

/** Malla metálica / rejilla para fondos de paneles. */
export function gridTexture(size = 64): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = ctx2d(c);
  g.fillStyle = 'rgba(0,0,0,0)';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(255,255,255,0.025)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, 0.5);
  g.lineTo(size, 0.5);
  g.moveTo(0.5, 0);
  g.lineTo(0.5, size);
  g.stroke();
  return c;
}

let installed = false;

/** Genera las texturas y las publica como variables CSS en :root. */
export function installTextures() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  const root = document.documentElement.style;
  const set = (name: string, c: HTMLCanvasElement) => root.setProperty(name, `url(${c.toDataURL('image/png')})`);
  set('--tex-steel', steelTexture());
  set('--tex-concrete', concreteTexture());
  set('--tex-paper', paperTexture());
  set('--tex-grid', gridTexture());
}
