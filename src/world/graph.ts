// Grafo de rutas del metro: puntos de paso a lo largo de los túneles y dentro
// de las estaciones. Los viajes largos se planifican aquí y el detalle
// (esquivar obstáculos) se resuelve con la rejilla de navegación.

import { type Layout, stationToWorld } from './layout';
import type { NavGrid } from './grid';

export interface WayNode {
  x: number;
  z: number;
  /** Enlace al que pertenece (-1 si es de estación o cruce). */
  link: number;
}

interface Edge {
  to: number;
  d: number;
  /** Índice de enlace del túnel (para poder cortarlo), o -1. */
  link: number;
}

const HASH = 24;

export class RouteGraph {
  nodes: WayNode[] = [];
  adj: Edge[][] = [];
  /** Enlaces cortados (derrumbes, muros tapiados). */
  blockedLinks = new Set<number>();
  private cells = new Map<number, number[]>();
  // Búferes de Dijkstra
  private dist: Float32Array = new Float32Array(0);
  private prev: Int32Array = new Int32Array(0);
  private done: Uint8Array = new Uint8Array(0);

  constructor(
    readonly layout: Layout,
    readonly nav: NavGrid,
  ) {
    this.build();
  }

  private add(x: number, z: number, link = -1): number {
    const i = this.nodes.length;
    this.nodes.push({ x, z, link });
    this.adj.push([]);
    const k = this.key(x, z);
    let arr = this.cells.get(k);
    if (!arr) this.cells.set(k, (arr = []));
    arr.push(i);
    return i;
  }

  private key(x: number, z: number) {
    return (Math.floor(x / HASH) + 512) * 4096 + Math.floor(z / HASH) + 512;
  }

  private connect(a: number, b: number, link = -1) {
    if (a === b) return;
    const d = Math.hypot(this.nodes[a].x - this.nodes[b].x, this.nodes[a].z - this.nodes[b].z);
    if (this.adj[a].some((e) => e.to === b)) return;
    this.adj[a].push({ to: b, d, link });
    this.adj[b].push({ to: a, d, link });
  }

  private build() {
    const { layout, nav } = this;
    const endNode = new Map<string, number[]>();
    const reg = (id: string, n: number) => {
      const a = endNode.get(id) ?? [];
      a.push(n);
      endNode.set(id, a);
    };
    // Túneles: un punto cada ~20 m
    for (const l of layout.links) {
      const step = 20;
      const n = Math.max(1, Math.round(l.length / step));
      let prev = -1;
      for (let i = 0; i <= n; i++) {
        const s = (l.length * i) / n;
        // Punto de la polilínea más cercano a s
        let k = 0;
        while (k < l.pts.length - 1 && l.cum[k] < s) k++;
        const p = l.pts[k];
        const q = nav.nearestPassable(p.x, p.z, 4, true) ?? p;
        const id = this.add(q.x, q.z, l.index);
        if (prev >= 0) this.connect(prev, id, l.index);
        prev = id;
        if (i === 0) reg(l.a + '|' + l.index, id);
        if (i === n) reg(l.b + '|' + l.index, id);
      }
    }
    // Cruces: une los extremos de todos los túneles que llegan
    for (const nd of layout.nodes) {
      const c = nav.nearestPassable(nd.x, nd.z, 6, true) ?? nd;
      const center = this.add(c.x, c.z);
      for (const li of nd.links) for (const e of endNode.get(nd.id + '|' + li) ?? []) this.connect(center, e);
    }
    // Estaciones
    for (const f of layout.stations) {
      const local: number[] = [];
      const P = (u: number, v: number) => {
        const w = stationToWorld(f, u, v);
        const q = nav.nearestPassable(w.x, w.z, 2.5, true);
        if (!q) return -1;
        const id = this.add(q.x, q.z);
        local.push(id);
        return id;
      };
      for (const port of f.ports) {
        const id = P(port.u - (port.wall === 'end' ? Math.sign(port.u) * 4 : 0), port.v - (port.wall === 'end' ? 0 : Math.sign(port.v) * 4));
        if (id >= 0) for (const e of endNode.get(f.id + '|' + port.link) ?? []) this.connect(id, e);
      }
      if (f.plan.throatA > 0) for (const v of [-f.hw * 0.5, 0, f.hw * 0.5]) P(-f.hl + f.plan.throatA / 2, v);
      if (f.plan.throatB > 0) for (const v of [-f.hw * 0.5, 0, f.hw * 0.5]) P(f.hl - f.plan.throatB / 2, v);
      for (const r of f.ramps) {
        const um = (r.u0 + r.u1) / 2;
        const vm = (r.v0 + r.v1) / 2;
        const e = 0.9;
        let a: number;
        let b: number;
        if (r.dir === 'u+' || r.dir === 'u-') {
          a = P(r.u0 - e, vm);
          b = P(r.u1 + e, vm);
        } else {
          a = P(um, r.v0 - e);
          b = P(um, r.v1 + e);
        }
        if (a >= 0 && b >= 0) this.connect(a, b);
      }
      for (const p of [...f.platforms, ...f.heads]) {
        const len = p.u1 - p.u0;
        const n = Math.max(1, Math.round(len / 14));
        const wid = p.v1 - p.v0;
        const rows = wid > 9 ? [0.28, 0.72] : [0.5];
        for (let i = 0; i <= n; i++) for (const rv of rows) P(p.u0 + 1.2 + ((len - 2.4) * i) / n, p.v0 + wid * rv);
      }
      for (const d of f.decks) P((d.u0 + d.u1) / 2, (d.v0 + d.v1) / 2);
      for (const lane of f.lanes) {
        const len = lane.u1 - lane.u0;
        const n = Math.max(1, Math.round(len / 18));
        for (let i = 0; i <= n; i++) P(lane.u0 + 1.5 + ((len - 3) * i) / n, lane.v);
      }
      // Une los puntos que se ven entre sí (o con un rodeo corto)
      for (let i = 0; i < local.length; i++) {
        const a = this.nodes[local[i]];
        const cand: [number, number][] = [];
        for (let j = 0; j < local.length; j++) {
          if (i === j) continue;
          const b = this.nodes[local[j]];
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          if (d < 30) cand.push([d, local[j]]);
        }
        cand.sort((p, q) => p[0] - q[0]);
        let made = 0;
        for (const [d, j] of cand) {
          if (made >= 7) break;
          const b = this.nodes[j];
          if (nav.walkLine(a.x, a.z, b.x, b.z, true)) {
            this.connect(local[i], j);
            made++;
          } else if (d < 16 && made < 3) {
            const path = nav.findPath(a.x, a.z, b.x, b.z, { gates: true, margin: 8, maxNodes: 4000 });
            if (path) {
              let len = 0;
              let px = a.x;
              let pz = a.z;
              for (let k = 0; k < path.length; k += 2) {
                len += Math.hypot(path[k] - px, path[k + 1] - pz);
                px = path[k];
                pz = path[k + 1];
              }
              if (len < d * 1.7 + 2) {
                this.connect(local[i], j);
                made++;
              }
            }
          }
        }
      }
    }
    const n = this.nodes.length;
    this.dist = new Float32Array(n);
    this.prev = new Int32Array(n);
    this.done = new Uint8Array(n);
  }

  /** Nodo más cercano a un punto (prefiere los que se alcanzan en línea recta). */
  nearest(x: number, z: number): number {
    let best = -1;
    let bestD = Infinity;
    let bestSeen = -1;
    let bestSeenD = Infinity;
    const cx = Math.floor(x / HASH);
    const cz = Math.floor(z / HASH);
    for (let r = 1; r <= 3 && bestSeen < 0; r++) {
      for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
          const arr = this.cells.get((cx + i + 512) * 4096 + cz + j + 512);
          if (!arr) continue;
          for (const id of arr) {
            const nd = this.nodes[id];
            const d = Math.hypot(nd.x - x, nd.z - z);
            if (d < bestD) {
              bestD = d;
              best = id;
            }
            if (d < bestSeenD && d < 40 && this.nav.walkLine(x, z, nd.x, nd.z, true)) {
              bestSeenD = d;
              bestSeen = id;
            }
          }
        }
      }
    }
    return bestSeen >= 0 ? bestSeen : best;
  }

  /** Ruta entre dos puntos: lista [x,z,...] de puntos de paso (sin incluir el origen ni el destino). */
  route(ax: number, az: number, bx: number, bz: number): number[] | null {
    const a = this.nearest(ax, az);
    const b = this.nearest(bx, bz);
    if (a < 0 || b < 0) return null;
    if (a === b) return [this.nodes[a].x, this.nodes[a].z];
    const { dist, prev, done, nodes, adj } = this;
    dist.fill(Infinity);
    done.fill(0);
    prev.fill(-1);
    dist[a] = 0;
    // Montículo binario simple
    const heap: number[] = [a];
    const hf: number[] = [0];
    const push = (id: number, f: number) => {
      let i = heap.length;
      heap.push(id);
      hf.push(f);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hf[p] <= f) break;
        heap[i] = heap[p];
        hf[i] = hf[p];
        i = p;
      }
      heap[i] = id;
      hf[i] = f;
    };
    const pop = () => {
      const top = heap[0];
      const id = heap.pop()!;
      const f = hf.pop()!;
      const n = heap.length;
      if (n > 0) {
        let i = 0;
        for (;;) {
          let c = i * 2 + 1;
          if (c >= n) break;
          if (c + 1 < n && hf[c + 1] < hf[c]) c++;
          if (hf[c] >= f) break;
          heap[i] = heap[c];
          hf[i] = hf[c];
          i = c;
        }
        heap[i] = id;
        hf[i] = f;
      }
      return top;
    };
    const tx = nodes[b].x;
    const tz = nodes[b].z;
    while (heap.length) {
      const cur = pop();
      if (done[cur]) continue;
      done[cur] = 1;
      if (cur === b) break;
      for (const e of adj[cur]) {
        if (done[e.to]) continue;
        if (e.link >= 0 && this.blockedLinks.has(e.link)) continue;
        const nd = dist[cur] + e.d;
        if (nd < dist[e.to]) {
          dist[e.to] = nd;
          prev[e.to] = cur;
          push(e.to, nd + Math.hypot(nodes[e.to].x - tx, nodes[e.to].z - tz));
        }
      }
    }
    if (!done[b]) return null;
    const out: number[] = [];
    for (let c = b; c !== -1; c = prev[c]) out.push(nodes[c].z, nodes[c].x);
    out.reverse();
    return out;
  }

  /** Distancia de viaje aproximada entre dos puntos (m), o Infinity. */
  travelDistance(ax: number, az: number, bx: number, bz: number): number {
    const r = this.route(ax, az, bx, bz);
    if (!r) return Infinity;
    let d = 0;
    let px = ax;
    let pz = az;
    for (let i = 0; i < r.length; i += 2) {
      d += Math.hypot(r[i] - px, r[i + 1] - pz);
      px = r[i];
      pz = r[i + 1];
    }
    return d + Math.hypot(bx - px, bz - pz);
  }
}
