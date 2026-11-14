// Rejillas del mundo: campo de distancias (SDF) y rejilla de navegación con
// alturas, obstáculos, búsqueda de caminos (A*) y líneas de visión.

export const CELL = 0.5;

/** Rejilla densa de floats con interpolación bilineal. */
export class FloatGrid {
  readonly data: Float32Array;
  constructor(
    readonly ox: number,
    readonly oz: number,
    readonly cell: number,
    readonly w: number,
    readonly h: number,
    fill = 0,
  ) {
    this.data = new Float32Array(w * h);
    if (fill !== 0) this.data.fill(fill);
  }

  /** Valor en coordenadas del mundo (bilineal, con borde extendido). */
  sample(x: number, z: number): number {
    const fx = (x - this.ox) / this.cell;
    const fz = (z - this.oz) / this.cell;
    let ix = Math.floor(fx);
    let iz = Math.floor(fz);
    if (ix < 0) ix = 0;
    else if (ix > this.w - 2) ix = this.w - 2;
    if (iz < 0) iz = 0;
    else if (iz > this.h - 2) iz = this.h - 2;
    let tx = fx - ix;
    let tz = fz - iz;
    tx = tx < 0 ? 0 : tx > 1 ? 1 : tx;
    tz = tz < 0 ? 0 : tz > 1 ? 1 : tz;
    const i = iz * this.w + ix;
    const d = this.data;
    const a = d[i];
    const b = d[i + 1];
    const c = d[i + this.w];
    const e = d[i + this.w + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + e) * tx * tz;
  }

  /** Gradiente normalizado (apunta hacia donde crece el valor). */
  gradient(x: number, z: number, out: [number, number] = [0, 0]): [number, number] {
    const e = this.cell * 0.6;
    const gx = this.sample(x + e, z) - this.sample(x - e, z);
    const gz = this.sample(x, z + e) - this.sample(x, z - e);
    const l = Math.hypot(gx, gz) || 1;
    out[0] = gx / l;
    out[1] = gz / l;
    return out;
  }
}

// Banderas de celda
export const F_WALK = 1; // suelo transitable (estático)
export const F_OBST = 2; // obstáculo de atrezo (estático)
export const F_WATER = 4; // agua: se vadea despacio
export const F_TALL = 8; // obstáculo alto: tapa la luz y las balas
export const F_DYN = 16; // obstáculo dinámico (obras del jugador, escombros)
export const F_GATE = 32; // portón: solo pasan los aliados de su dueño
export const F_SLOW = 64; // terreno lento (alambre, escombros bajos)
export const F_NEAR = 128; // pegado a una pared (se prefiere evitar)

const BLOCK_MASK = F_WALK | F_OBST | F_DYN;

export interface PathOptions {
  /** Puede atravesar portones (aliado del dueño). */
  gates?: boolean;
  /** Margen de búsqueda alrededor del segmento inicio-meta (m). */
  margin?: number;
  /** Límite de nodos expandidos. */
  maxNodes?: number;
  /** Si la meta no es alcanzable, acércate lo más posible. */
  partial?: boolean;
}

export class NavGrid {
  readonly flags: Uint8Array;
  /** Altura del suelo en decímetros (16 bits: las escaleras suben hasta la superficie). */
  readonly height: Int16Array;
  /** Versión: cambia cuando se modifican obstáculos (invalida caminos). */
  version = 1;

  // Búferes de búsqueda reutilizados
  private stamp: Uint32Array;
  private gScore: Float32Array;
  private parent: Int32Array;
  private closed: Uint8Array;
  private heap: Int32Array;
  private heapF: Float32Array;
  private stampId = 1;
  private static readonly MAXW = 420;

  constructor(
    readonly ox: number,
    readonly oz: number,
    readonly w: number,
    readonly h: number,
  ) {
    this.flags = new Uint8Array(w * h);
    this.height = new Int16Array(w * h);
    const n = NavGrid.MAXW * NavGrid.MAXW;
    this.stamp = new Uint32Array(n);
    this.gScore = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.heap = new Int32Array(n);
    this.heapF = new Float32Array(n);
  }

  cx(x: number) {
    return Math.floor((x - this.ox) / CELL);
  }
  cz(z: number) {
    return Math.floor((z - this.oz) / CELL);
  }
  wx(cx: number) {
    return this.ox + (cx + 0.5) * CELL;
  }
  wz(cz: number) {
    return this.oz + (cz + 0.5) * CELL;
  }
  inside(cx: number, cz: number) {
    return cx >= 0 && cz >= 0 && cx < this.w && cz < this.h;
  }
  flagAt(x: number, z: number): number {
    const cx = this.cx(x);
    const cz = this.cz(z);
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return 0;
    return this.flags[cz * this.w + cx];
  }

  /** ¿Se puede pisar esta celda? */
  passable(cx: number, cz: number, gates = false): boolean {
    if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return false;
    const f = this.flags[cz * this.w + cx];
    if ((f & BLOCK_MASK) !== F_WALK) return false;
    if (f & F_GATE && !gates) return false;
    return true;
  }

  passableAt(x: number, z: number, gates = false): boolean {
    return this.passable(this.cx(x), this.cz(z), gates);
  }

  /** Suelo estático (ignora atrezo y obras). */
  isFloor(x: number, z: number): boolean {
    return (this.flagAt(x, z) & F_WALK) !== 0;
  }

  /** Altura del suelo en metros (interpolada salvo en los bordes de andén). */
  heightAt(x: number, z: number): number {
    const fx = (x - this.ox) / CELL - 0.5;
    const fz = (z - this.oz) / CELL - 0.5;
    let ix = Math.floor(fx);
    let iz = Math.floor(fz);
    if (ix < 0) ix = 0;
    else if (ix > this.w - 2) ix = this.w - 2;
    if (iz < 0) iz = 0;
    else if (iz > this.h - 2) iz = this.h - 2;
    const i = iz * this.w + ix;
    const a = this.height[i];
    const b = this.height[i + 1];
    const c = this.height[i + this.w];
    const d = this.height[i + this.w + 1];
    const mn = Math.min(a, b, c, d);
    const mx = Math.max(a, b, c, d);
    if (mx - mn > 4) {
      // Borde de andén: sin interpolar
      const cx = this.cx(x);
      const cz = this.cz(z);
      if (!this.inside(cx, cz)) return 0;
      return this.height[cz * this.w + cx] * 0.1;
    }
    const tx = Math.min(1, Math.max(0, fx - ix));
    const tz = Math.min(1, Math.max(0, fz - iz));
    return (a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz) * 0.1;
  }

  /** ¿Se puede pasar de una celda a su vecina (escalón pequeño)? */
  canStep(i0: number, i1: number): boolean {
    const d = this.height[i0] - this.height[i1];
    return d <= 4 && d >= -4;
  }

  /** Marca un rectángulo orientado. */
  stampRect(x: number, z: number, hl: number, hw: number, rot: number, set: number, clear = 0) {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const ext = Math.abs(hl * c) + Math.abs(hw * s);
    const extZ = Math.abs(hl * s) + Math.abs(hw * c);
    const x0 = Math.max(0, this.cx(x - ext));
    const x1 = Math.min(this.w - 1, this.cx(x + ext));
    const z0 = Math.max(0, this.cz(z - extZ));
    const z1 = Math.min(this.h - 1, this.cz(z + extZ));
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const dx = this.wx(cx) - x;
        const dz = this.wz(cz) - z;
        const u = dx * c + dz * s;
        const v = -dx * s + dz * c;
        if (Math.abs(u) <= hl && Math.abs(v) <= hw) {
          const i = cz * this.w + cx;
          this.flags[i] = (this.flags[i] | set) & ~clear;
        }
      }
    }
    this.version++;
  }

  stampCircle(x: number, z: number, r: number, set: number, clear = 0) {
    const x0 = Math.max(0, this.cx(x - r));
    const x1 = Math.min(this.w - 1, this.cx(x + r));
    const z0 = Math.max(0, this.cz(z - r));
    const z1 = Math.min(this.h - 1, this.cz(z + r));
    const r2 = r * r;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const dx = this.wx(cx) - x;
        const dz = this.wz(cz) - z;
        if (dx * dx + dz * dz <= r2) {
          const i = cz * this.w + cx;
          this.flags[i] = (this.flags[i] | set) & ~clear;
        }
      }
    }
    this.version++;
  }

  /** ¿Hay alguna celda no transitable dentro del rectángulo? */
  rectFree(x: number, z: number, hl: number, hw: number, rot: number, maxSlope = 2): boolean {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const ext = Math.abs(hl * c) + Math.abs(hw * s);
    const extZ = Math.abs(hl * s) + Math.abs(hw * c);
    const x0 = this.cx(x - ext);
    const x1 = this.cx(x + ext);
    const z0 = this.cz(z - extZ);
    const z1 = this.cz(z + extZ);
    let hmin = 32767;
    let hmax = -32768;
    for (let cz = z0; cz <= z1; cz++) {
      for (let cx = x0; cx <= x1; cx++) {
        const dx = this.wx(cx) - x;
        const dz = this.wz(cz) - z;
        const u = dx * c + dz * s;
        const v = -dx * s + dz * c;
        if (Math.abs(u) <= hl && Math.abs(v) <= hw) {
          if (!this.inside(cx, cz)) return false;
          const i = cz * this.w + cx;
          if ((this.flags[i] & BLOCK_MASK) !== F_WALK) return false;
          const hh = this.height[i];
          if (hh < hmin) hmin = hh;
          if (hh > hmax) hmax = hh;
        }
      }
    }
    return hmax - hmin <= maxSlope;
  }

  /** Recalcula la bandera F_NEAR (celdas pegadas a algo intransitable). */
  computeNear() {
    const { w, h, flags } = this;
    for (let cz = 1; cz < h - 1; cz++) {
      for (let cx = 1; cx < w - 1; cx++) {
        const i = cz * w + cx;
        if (!(flags[i] & F_WALK)) continue;
        const blocked =
          (flags[i - 1] & BLOCK_MASK) !== F_WALK ||
          (flags[i + 1] & BLOCK_MASK) !== F_WALK ||
          (flags[i - w] & BLOCK_MASK) !== F_WALK ||
          (flags[i + w] & BLOCK_MASK) !== F_WALK;
        if (blocked) flags[i] |= F_NEAR;
        else flags[i] &= ~F_NEAR;
      }
    }
  }

  /** Celda transitable más cercana a un punto (búsqueda en espiral). */
  nearestPassable(x: number, z: number, maxR = 6, gates = true): { x: number; z: number } | null {
    const cx0 = this.cx(x);
    const cz0 = this.cz(z);
    if (this.passable(cx0, cz0, gates)) return { x, z };
    const maxC = Math.ceil(maxR / CELL);
    let best: { x: number; z: number } | null = null;
    let bestD = Infinity;
    for (let r = 1; r <= maxC; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (this.passable(cx0 + dx, cz0 + dz, gates)) {
            const wx = this.wx(cx0 + dx);
            const wz = this.wz(cz0 + dz);
            const d = (wx - x) * (wx - x) + (wz - z) * (wz - z);
            if (d < bestD) {
              bestD = d;
              best = { x: wx, z: wz };
            }
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Línea de paso libre entre dos puntos (para atajar caminos). */
  walkLine(ax: number, az: number, bx: number, bz: number, gates = false): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return this.passableAt(ax, az, gates);
    const steps = Math.ceil(len / (CELL * 0.45));
    let pcx = this.cx(ax);
    let pcz = this.cz(az);
    if (!this.passable(pcx, pcz, gates)) return false;
    let pi = pcz * this.w + pcx;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const cx = this.cx(ax + dx * t);
      const cz = this.cz(az + dz * t);
      if (cx === pcx && cz === pcz) continue;
      if (!this.passable(cx, cz, gates)) return false;
      const i = cz * this.w + cx;
      if (!this.canStep(pi, i)) return false;
      if (cx !== pcx && cz !== pcz) {
        // Diagonal: no recortar esquinas
        if (!this.passable(cx, pcz, gates) || !this.passable(pcx, cz, gates)) return false;
      }
      pcx = cx;
      pcz = cz;
      pi = i;
    }
    return true;
  }

  /**
   * Rayo de visión/bala: devuelve la fracción [0,1] recorrida antes de chocar
   * con un muro o un obstáculo alto (1 = llega al destino).
   */
  sightLine(ax: number, az: number, bx: number, bz: number): number {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return 1;
    const steps = Math.ceil(len / (CELL * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const cx = this.cx(ax + dx * t);
      const cz = this.cz(az + dz * t);
      if (cx < 0 || cz < 0 || cx >= this.w || cz >= this.h) return t;
      const f = this.flags[cz * this.w + cx];
      if (!(f & F_WALK) || f & F_TALL) return t;
    }
    return 1;
  }

  // -------------------------------------------------------------------------
  // A*
  // -------------------------------------------------------------------------

  /**
   * Camino entre dos puntos del mundo. Devuelve una lista de puntos [x,z,...]
   * ya simplificada, o null si no hay camino dentro de la ventana de búsqueda.
   */
  findPath(sx: number, sz: number, gx: number, gz: number, opts: PathOptions = {}): number[] | null {
    const gates = opts.gates ?? false;
    const margin = opts.margin ?? 22;
    const maxNodes = opts.maxNodes ?? 24000;
    let scx = this.cx(sx);
    let scz = this.cz(sz);
    let gcx = this.cx(gx);
    let gcz = this.cz(gz);
    if (!this.passable(scx, scz, true)) {
      const p = this.nearestPassable(sx, sz, 3, true);
      if (!p) return null;
      scx = this.cx(p.x);
      scz = this.cz(p.z);
    }
    if (!this.passable(gcx, gcz, gates)) {
      const p = this.nearestPassable(gx, gz, 4, gates);
      if (!p) return null;
      gx = p.x;
      gz = p.z;
      gcx = this.cx(p.x);
      gcz = this.cz(p.z);
    }
    if (scx === gcx && scz === gcz) return [gx, gz];
    // Atajo: línea recta libre
    if (this.walkLine(sx, sz, gx, gz, gates)) return [gx, gz];

    const mc = Math.ceil(margin / CELL);
    let x0 = Math.max(0, Math.min(scx, gcx) - mc);
    let x1 = Math.min(this.w - 1, Math.max(scx, gcx) + mc);
    let z0 = Math.max(0, Math.min(scz, gcz) - mc);
    let z1 = Math.min(this.h - 1, Math.max(scz, gcz) + mc);
    const M = NavGrid.MAXW;
    if (x1 - x0 + 1 > M) {
      const mid = (scx + gcx) >> 1;
      x0 = Math.max(0, mid - (M >> 1));
      x1 = Math.min(this.w - 1, x0 + M - 1);
    }
    if (z1 - z0 + 1 > M) {
      const mid = (scz + gcz) >> 1;
      z0 = Math.max(0, mid - (M >> 1));
      z1 = Math.min(this.h - 1, z0 + M - 1);
    }
    if (scx < x0 || scx > x1 || scz < z0 || scz > z1 || gcx < x0 || gcx > x1 || gcz < z0 || gcz > z1) return null;
    const ww = x1 - x0 + 1;
    const W = this.w;
    const flags = this.flags;
    const { stamp, gScore, parent, closed, heap, heapF } = this;
    const id = ++this.stampId;
    if (id > 4e9) {
      stamp.fill(0);
      this.stampId = 1;
    }
    let heapN = 0;
    const push = (li: number, f: number) => {
      let i = heapN++;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heapF[p] <= f) break;
        heap[i] = heap[p];
        heapF[i] = heapF[p];
        i = p;
      }
      heap[i] = li;
      heapF[i] = f;
    };
    const pop = () => {
      const top = heap[0];
      const li = heap[--heapN];
      const f = heapF[heapN];
      let i = 0;
      for (;;) {
        let c = i * 2 + 1;
        if (c >= heapN) break;
        if (c + 1 < heapN && heapF[c + 1] < heapF[c]) c++;
        if (heapF[c] >= f) break;
        heap[i] = heap[c];
        heapF[i] = heapF[c];
        i = c;
      }
      heap[i] = li;
      heapF[i] = f;
      return top;
    };
    const hfun = (cx: number, cz: number) => {
      const dx = Math.abs(cx - gcx);
      const dz = Math.abs(cz - gcz);
      return (dx + dz + (1.41421356 - 2) * Math.min(dx, dz)) * 1.001;
    };
    const sl = (scz - z0) * ww + (scx - x0);
    const gl = (gcz - z0) * ww + (gcx - x0);
    stamp[sl] = id;
    gScore[sl] = 0;
    parent[sl] = -1;
    closed[sl] = 0;
    push(sl, hfun(scx, scz));
    let expanded = 0;
    let found = false;
    let bestL = sl;
    let bestH = hfun(scx, scz);
    while (heapN > 0) {
      const cur = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === gl) {
        found = true;
        break;
      }
      if (++expanded > maxNodes) break;
      const lx = cur % ww;
      const lz = (cur - lx) / ww;
      const cx = lx + x0;
      const cz = lz + z0;
      const gi = cz * W + cx;
      const g = gScore[cur];
      const hh = hfun(cx, cz);
      if (hh < bestH) {
        bestH = hh;
        bestL = cur;
      }
      for (let d = 0; d < 8; d++) {
        const ddx = d === 0 || d === 4 || d === 5 ? 1 : d === 1 || d === 6 || d === 7 ? -1 : 0;
        const ddz = d === 2 || d === 4 || d === 6 ? 1 : d === 3 || d === 5 || d === 7 ? -1 : 0;
        const nx = cx + ddx;
        const nz = cz + ddz;
        if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
        const ni = nz * W + nx;
        const f = flags[ni];
        if ((f & BLOCK_MASK) !== F_WALK) continue;
        if (f & F_GATE && !gates) continue;
        const dh = this.height[gi] - this.height[ni];
        if (dh > 4 || dh < -4) continue;
        if (d >= 4) {
          // Diagonal: ambas ortogonales libres y al mismo nivel
          const fa = flags[cz * W + nx];
          const fb = flags[nz * W + cx];
          if ((fa & BLOCK_MASK) !== F_WALK || (fb & BLOCK_MASK) !== F_WALK) continue;
          if ((fa & F_GATE || fb & F_GATE) && !gates) continue;
          const ha = this.height[gi] - this.height[cz * W + nx];
          const hb = this.height[gi] - this.height[nz * W + cx];
          if (ha > 4 || ha < -4 || hb > 4 || hb < -4) continue;
        }
        const nl = (nz - z0) * ww + (nx - x0);
        if (stamp[nl] === id && closed[nl]) continue;
        let cost = d >= 4 ? 1.41421356 : 1;
        if (f & F_WATER) cost *= 1.7;
        if (f & F_SLOW) cost *= 2.6;
        if (f & F_NEAR) cost += 0.45;
        const ng = g + cost;
        if (stamp[nl] !== id || ng < gScore[nl]) {
          stamp[nl] = id;
          closed[nl] = 0;
          gScore[nl] = ng;
          parent[nl] = cur;
          push(nl, ng + hfun(nx, nz));
        }
      }
    }
    if (!found) {
      if (!opts.partial || bestL === sl) return null;
    }
    // Reconstrucción
    const cells: number[] = [];
    let c = found ? gl : bestL;
    while (c !== -1) {
      cells.push(c);
      c = parent[c];
    }
    cells.reverse();
    const pts: number[] = [];
    for (const li of cells) {
      const lx = li % ww;
      const lz = (li - lx) / ww;
      pts.push(this.wx(lx + x0), this.wz(lz + z0));
    }
    if (found) {
      pts[pts.length - 2] = gx;
      pts[pts.length - 1] = gz;
    }
    return this.smoothPath(sx, sz, pts, gates);
  }

  /** Tira de la cuerda: elimina puntos intermedios con línea de paso libre. */
  private smoothPath(sx: number, sz: number, pts: number[], gates: boolean): number[] {
    const out: number[] = [];
    let ax = sx;
    let az = sz;
    let i = 0;
    const n = pts.length / 2;
    while (i < n) {
      // Busca el punto más lejano alcanzable en línea recta
      let best = i;
      let step = Math.min(64, n - 1 - i);
      let j = i + step;
      // Búsqueda descendente con saltos
      while (j > i) {
        if (this.walkLine(ax, az, pts[j * 2], pts[j * 2 + 1], gates)) {
          best = j;
          break;
        }
        step = Math.max(1, step >> 1);
        j -= step;
      }
      // Intenta ampliar un poco más desde el mejor encontrado
      while (best + 1 < n && best - i < 96 && this.walkLine(ax, az, pts[(best + 1) * 2], pts[(best + 1) * 2 + 1], gates)) best++;
      ax = pts[best * 2];
      az = pts[best * 2 + 1];
      out.push(ax, az);
      i = best + 1;
    }
    return out;
  }
}
