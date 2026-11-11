// Herramienta de desarrollo: dibuja el trazado del metro en un PNG.
//   npx tsx tools/blueprint.ts salida.png [idEstacion|all] [pxPorMetro]
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { buildLayout, stationToWorld, type Layout } from '../src/world/layout';
import { F_OBST, F_TALL, F_WALK, F_WATER } from '../src/world/grid';

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

export function encodePng(w: number, h: number, rgba: Uint8Array): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export interface View {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  ppm: number;
}

export function drawBlueprint(layout: Layout, view: View, extra?: (plot: (x: number, z: number, r: number, g: number, b: number, size?: number) => void) => void) {
  const w = Math.ceil((view.x1 - view.x0) * view.ppm);
  const h = Math.ceil((view.z1 - view.z0) * view.ppm);
  const img = new Uint8Array(w * h * 4);
  const { nav, sdf } = layout;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = view.x0 + (px + 0.5) / view.ppm;
      const z = view.z0 + (py + 0.5) / view.ppm;
      const f = nav.flagAt(x, z);
      let r = 14;
      let g = 14;
      let b = 18;
      if (f & F_WALK) {
        const hh = nav.heightAt(x, z);
        const t = hh / 1.1;
        r = 70 + 70 * t;
        g = 74 + 62 * t;
        b = 82 + 30 * t;
        if (f & F_WATER) {
          r = 40;
          g = 90;
          b = 130;
        }
        if (f & F_OBST) {
          r = f & F_TALL ? 190 : 150;
          g = f & F_TALL ? 120 : 110;
          b = 60;
        }
      } else {
        const d = sdf.sample(x, z);
        if (d < 1.0) {
          r = 30;
          g = 30;
          b = 36;
        }
      }
      const i = (py * w + px) * 4;
      img[i] = r;
      img[i + 1] = g;
      img[i + 2] = b;
      img[i + 3] = 255;
    }
  }
  const plot = (x: number, z: number, r: number, g: number, b: number, size = 1) => {
    const px = Math.round((x - view.x0) * view.ppm);
    const py = Math.round((z - view.z0) * view.ppm);
    for (let dy = -size + 1; dy < size; dy++) {
      for (let dx = -size + 1; dx < size; dx++) {
        const qx = px + dx;
        const qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
        const i = (qy * w + qx) * 4;
        img[i] = r;
        img[i + 1] = g;
        img[i + 2] = b;
      }
    }
  };
  const line = (ax: number, az: number, bx: number, bz: number, r: number, g: number, b: number, size = 1) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) * view.ppm));
    for (let i = 0; i <= n; i++) plot(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n, r, g, b, size);
  };
  // Contornos, con un color por propietario
  for (const c of layout.contours) {
    for (let i = 0; i < c.count; i++) {
      const j = (i + 1) % c.count;
      const reg = layout.regions[c.owner[i]];
      const col = reg.kind === 'station' ? [255, 210, 120] : reg.kind === 'node' ? [140, 220, 160] : [150, 170, 230];
      line(c.data[i * 4], c.data[i * 4 + 1], c.data[j * 4], c.data[j * 4 + 1], col[0], col[1], col[2]);
    }
  }
  // Vías
  for (const l of layout.links) for (const t of l.tracks) for (let i = 1; i < t.length; i++) line(t[i - 1].x, t[i - 1].z, t[i].x, t[i].z, 200, 80, 80);
  for (const f of layout.stations) {
    for (const t of f.tracks) for (let i = 1; i < t.length; i++) line(t[i - 1].x, t[i - 1].z, t[i].x, t[i].z, 230, 110, 60);
    for (const p of f.ports) plot(p.x, p.z, 80, 255, 255, 2);
    const a = stationToWorld(f, f.hl, 0);
    plot(a.x, a.z, 255, 60, 255, 2);
  }
  // Río
  for (const r of layout.rivers) for (let i = 1; i < r.length; i++) line(r[i - 1].x, r[i - 1].z, r[i].x, r[i].z, 40, 70, 110);
  extra?.(plot);
  return { w, h, img };
}

const isMain = process.argv[1]?.endsWith('blueprint.ts');
if (isMain) {
  const out = process.argv[2] ?? 'blueprint.png';
  const which = process.argv[3] ?? 'all';
  const t0 = Date.now();
  const layout = buildLayout();
  console.log('layout', Date.now() - t0, 'ms', 'contornos', layout.contours.length, 'vértices', layout.contours.reduce((a, c) => a + c.count, 0), 'nav', layout.nav.w, 'x', layout.nav.h);
  let total = 0;
  for (const l of layout.links) total += l.length;
  console.log('túneles', Math.round(total), 'm');
  let view: View;
  if (which === 'all') {
    const ppm = Number(process.argv[4] ?? 1);
    view = { x0: layout.bounds.minX, z0: layout.bounds.minZ, x1: layout.bounds.maxX, z1: layout.bounds.maxZ, ppm };
  } else {
    const f = layout.stationById[which];
    const n = layout.nodeById[which];
    const c = f ?? n;
    const r = Number(process.argv[5] ?? (f ? Math.max(f.hl, f.hw) + 40 : 60));
    view = { x0: c.x - r, z0: c.z - r, x1: c.x + r, z1: c.z + r, ppm: Number(process.argv[4] ?? 4) };
  }
  const { w, h, img } = drawBlueprint(layout, view);
  writeFileSync(out, encodePng(w, h, img));
  console.log('escrito', out, w, 'x', h);
}
