// El mundo en marcha: nodos de recursos y derrumbes, botines, tiendas y
// precios, contratación, asaltos a la base, peajes de bandidos y los hilos
// de la historia (la carta perdida, el embargo, el túnel sur, la radio).

import { BUILDS } from '../data/edificios';
import { FACTION_LORE } from '../data/historia/facciones';
import { ITEMS, type ItemDef, type Stack } from '../data/items';
import type { FactionId, SideId } from '../data/tipos';
import { F_DYN, F_TALL } from '../world/grid';
import { insideStation, linkPointAt } from '../world/layout';
import { COLLAPSE_NODES } from '../world/plans';
import { addItem, countItem, gainXp, invWeight, maxCarry, takeItem } from './chars';
import { hasTech } from './build';
import { clearDest, faceTo, setDest } from './move';
import { newSquad, placePos } from './population';
import type { Sim } from './sim';
import type { Char, Container, Order, ResNode, Shop } from './types';

// ---------------------------------------------------------------------------
// Siembra del mundo (partida nueva)
// ---------------------------------------------------------------------------

export function seedWorld(sim: Sim) {
  const st = sim.state;
  const { layout, decor } = sim.world;
  const rng = sim.rng;
  // Derrumbes del plano original
  for (const id of COLLAPSE_NODES) {
    const n = layout.nodeById[id];
    st.nodes.push({ id: st.nextId++, x: n.x, z: n.z, kind: 'derrumbe', amount: 0, work: id === 'X2' ? 1500 : 650, place: id });
  }
  // La Galería Olvidada: tapiada por los dos extremos
  for (const l of layout.links) {
    if (!l.def.latent) continue;
    for (const s of [18, l.length - 18]) {
      const p = linkPointAt(l, s);
      st.nodes.push({ id: st.nextId++, x: p.x, z: p.z, kind: 'muro', amount: 0, work: 320, place: 'L' + l.index });
    }
  }
  // Chatarra, salitre y botines repartidos por la decoración
  for (const sp of decor.spots) {
    if (sp.kind === 'chatarra') {
      st.nodes.push({ id: st.nextId++, x: sp.x, z: sp.z, kind: sp.data === 'salitre' ? 'salitre' : 'chatarra', amount: rng.int(60, 160), work: 0, place: sp.place });
    } else if (sp.kind === 'botin') {
      st.containers.push(makeContainer(sim, sp.x, sp.z, sp.place, sp.data ?? 'comun'));
    }
  }
  applyNodes(sim);
}

function makeContainer(sim: Sim, x: number, z: number, place: string, kind: string): Container {
  const rng = sim.rng;
  const items: Stack[] = [];
  const add = (id: string, a: number, b: number, p = 1) => {
    if (rng.chance(p)) {
      const n = rng.int(a, b);
      if (n > 0) addItem({ inv: items }, id, n);
    }
  };
  let lock = 0;
  let owner: SideId | null = null;
  let label = 'Caja abandonada';
  let ckind: Container['kind'] = 'caja';
  if (kind === 'almacen') {
    // Almacenes de la defensa civil de Tenevskaya
    label = 'Almacén de la defensa civil';
    ckind = 'almacen';
    lock = rng.int(35, 60);
    add('conserva', 6, 14);
    add('balas', 80, 200);
    add('botiquin', 2, 5);
    add('mascaraGas', 1, 2);
    add('filtros', 4, 10);
    add('componentes', 4, 10);
    add('planos', 1, 2, 0.8);
    add('libros', 1, 3, 0.8);
    add('acero', 4, 10);
    add('ak', 1, 1, 0.6);
    add('casco', 1, 2, 0.7);
    add('radioPiezas', 1, 1, 0.5);
    add('combustible', 3, 8);
  } else if (kind === 'correos') {
    label = 'Cajón de la oficina de correos';
    ckind = 'cajon';
    lock = 22;
    owner = 'UNI';
    addItem({ inv: items }, 'cartaBessmertny', 1);
    add('balas', 4, 10);
  } else if (kind === 'guarida') {
    label = 'Botín de la Hermandad';
    ckind = 'botin';
    owner = 'VHL';
    lock = 15;
    add('balas', 30, 90);
    add('cartuchosEscopeta', 10, 30);
    add('samogon', 2, 6);
    add('conserva', 2, 6);
    add('tela', 4, 10);
    add('machete', 1, 1, 0.7);
    add('escopeta', 1, 1, 0.5);
    add('petoCuero', 1, 1, 0.5);
    add('componentes', 1, 4, 0.6);
    // Lo que la Hermandad le quitó a un oficial de la defensa civil
    addItem({ inv: items }, 'llaveAlmacen', 1);
  } else if (kind === 'arsenal') {
    label = 'Taquilla del arsenal';
    ckind = 'almacen';
    owner = sim.state.stations[place]?.owner ?? null;
    lock = 45;
    add('balas', 60, 140);
    add('ak', 1, 1, 0.5);
    add('cerrojo', 1, 1, 0.6);
    add('casco', 1, 2);
    add('chaleco', 1, 1, 0.6);
    add('vendas', 3, 6);
  } else {
    // Restos en túneles y cruces
    add('chatarra', 3, 10, 0.7);
    add('piezas', 1, 5, 0.5);
    add('tela', 1, 4, 0.5);
    add('balas', 4, 20, 0.5);
    add('hongosSecos', 1, 3, 0.4);
    add('vendas', 1, 2, 0.35);
    add('conserva', 1, 1, 0.15);
    add('componentes', 1, 2, 0.2);
    add('libros', 1, 1, 0.08);
    add('filtros', 1, 2, 0.15);
    add('cuchillo', 1, 1, 0.12);
    add('tubo', 1, 1, 0.15);
    add('samogon', 1, 1, 0.15);
    if (rng.chance(0.25)) lock = rng.int(8, 25);
  }
  return { id: sim.state.nextId++, x, z, place, items, lock, owner, kind: ckind, opened: false, refill: 0, label };
}

/** Marca en la rejilla y en el grafo los derrumbes y muros que siguen en pie. */
export function applyNodes(sim: Sim) {
  const { nav, graph, layout } = sim.world;
  graph.blockedLinks.clear();
  for (const n of sim.state.nodes) {
    if (n.kind !== 'derrumbe' && n.kind !== 'muro') continue;
    nav.stampCircle(n.x, n.z, n.kind === 'derrumbe' ? 6.2 : 3.4, F_DYN | F_TALL);
    if (n.kind === 'derrumbe') {
      const nd = layout.nodeById[n.place];
      for (const li of nd?.links ?? []) graph.blockedLinks.add(li);
    } else graph.blockedLinks.add(Number(n.place.slice(1)));
  }
  nav.computeNear();
}

function clearNode(sim: Sim, n: ResNode) {
  const { nav } = sim.world;
  const i = sim.state.nodes.indexOf(n);
  if (i >= 0) sim.state.nodes.splice(i, 1);
  nav.stampCircle(n.x, n.z, n.kind === 'derrumbe' ? 6.2 : 3.4, 0, F_DYN | F_TALL);
  applyNodes(sim);
  sim.emit({ t: 'mundo', k: 'nodoFuera', id: n.id });
  if (n.place === 'X2') {
    sim.state.flags.tunelSur = 1;
    sim.log('El túnel sur, abierto. Tras dos años sepultado, el paso entre Mostovaya y Chernovodskaya vuelve a ser transitable. Lo que venga por ese túnel puede ser comercio… o guerra.', 'historia');
    sim.rep('CHE', 25, 'reabrir el túnel sur');
  } else if (n.place === 'X1') {
    sim.state.flags.tunelTenevskaya = 1;
    sim.log('El derrumbe de Tenevskaya ha sido despejado. La estación fantasma vuelve a estar unida a Vhlainska por el túnel principal.', 'historia');
  } else if (n.kind === 'muro') {
    if (!sim.state.nodes.some((q) => q.kind === 'muro')) {
      sim.state.flags.galeriaOlvidada = 1;
      sim.log('El muro soviético cae: una galería olvidada une Mostovaya con Izumrudnaya. El embargo del Levantamiento ya no es total.', 'historia');
      sim.rep('CAL', 30, 'abrir la Galería Olvidada');
      sim.rep('LEV', -15, 'romper el cerco');
    } else sim.log('El muro cede. Al otro lado, la galería sigue hasta otro tabique.', 'info');
  }
}

/** Chatarrear o excavar un nodo. Devuelve false cuando termina. */
export function workNode(sim: Sim, c: Char, o: Order, dt: number): boolean {
  const n = sim.node(o.id!);
  if (!n) return false;
  const reach = n.kind === 'derrumbe' ? 7.6 : n.kind === 'muro' ? 4.6 : 1.9;
  if (Math.hypot(n.x - c.x, n.z - c.z) > reach) {
    setDest(c, n.x, n.z, reach - 0.5, true);
    return true;
  }
  clearDest(c);
  faceTo(c, n.x, n.z, dt);
  if (n.kind === 'derrumbe' || n.kind === 'muro') {
    if (n.kind === 'derrumbe' && !hasTech(sim, 'excavacion')) {
      sim.emit({ t: 'flota', x: n.x, z: n.z, text: 'Hace falta saber excavar túneles', color: '#d8a060' });
      return false;
    }
    c.work = 'pico';
    const tool = c.inv.some((s) => s.id === 'pico') || c.eq.arma?.id === 'pico' ? 1.5 : 1;
    n.work -= dt * (0.5 + c.sk.ingenieria * 0.025) * tool;
    gainXp(sim, c, 'ingenieria', dt * 0.4);
    gainXp(sim, c, 'fuerza', dt * 0.15);
    if ((sim.tick + c.id) % 30 === 0) sim.emit({ t: 'sonido', k: 'pico', x: n.x, z: n.z });
    if (n.work <= 0) {
      clearNode(sim, n);
      return false;
    }
    return true;
  }
  if (n.amount <= 0) return false;
  if (invWeight(c) > maxCarry(c) * 1.05) {
    if (o.data !== 'job') sim.emit({ t: 'flota', x: c.x, z: c.z, text: 'No puedo cargar más', color: '#d8a060' });
    return false;
  }
  c.pose = n.kind === 'salitre' ? 'cuclillas' : 'normal';
  c.work = n.kind === 'salitre' ? 'rebuscar' : 'pico';
  const tool = c.inv.some((s) => s.id === 'palanca' || s.id === 'pico') || c.eq.arma?.id === 'palanca' ? 1.3 : 1;
  c.workT += dt * (0.5 + c.sk.chatarreria * 0.025) * tool;
  gainXp(sim, c, 'chatarreria', dt * 0.3);
  if ((sim.tick + c.id) % 36 === 0) sim.emit({ t: 'sonido', k: 'chatarra', x: n.x, z: n.z });
  sim.state.flags.tChatarra = 1;
  if (c.workT >= 4) {
    c.workT = 0;
    n.amount--;
    if (n.kind === 'salitre') addItem(c, 'salitre', 1);
    else {
      addItem(c, 'chatarra', 1);
      const r = sim.rng.next();
      const luck = c.sk.chatarreria * 0.002;
      if (r < 0.1 + luck) addItem(c, 'piezas', 1);
      else if (r < 0.14 + luck * 1.5) addItem(c, 'componentes', 1);
      else if (r < 0.2 + luck) addItem(c, 'tela', 1);
      else if (r < 0.26 + luck) addItem(c, 'tablones', 1);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Tiendas y precios
// ---------------------------------------------------------------------------

type Cat = ItemDef['kind'];
const SPECIAL: Record<string, Partial<Record<Cat | 'todo', number>> & Record<string, number>> = {
  IND: { arma: 0.78, municion: 0.7, recurso: 0.88 },
  RUB: { arma: 0.9, armadura: 0.9 },
  KHO: { combustible: 0.6, armadura: 0.9 },
  STA: { todo: 1 },
  TSE: { todo: 0.96 },
  ZVE: { piezas: 0.8, herramienta: 0.85 },
  MOS: { acero: 0.65, chatarra: 0.8 },
  RAS: { comida: 0.62 },
  STL: { comida: 0.85, tela: 0.85 },
  VYS: { medicina: 1.4, municion: 1.25 },
  MER: { comida: 3.2, medicina: 1.7, agua: 0.4 },
  UBE: { medicina: 0.62 },
  SEV: { componentes: 0.7, libros: 0.75, filtros: 0.7, planos: 0.8 },
  VHL: { arma: 0.88, samogon: 0.7 },
  CHE: { comida: 1.9, recurso: 1.5, arma: 0.82, medicina: 1.5 },
};

export function priceMult(sim: Sim, place: string, id: string): number {
  const def = ITEMS[id];
  const sp = SPECIAL[place];
  let m = 1;
  if (sp) m = sp[id] ?? sp[def.kind] ?? sp.todo ?? 1;
  if (sim.state.flags.inviernoCrudo && def.kind === 'comida') m *= 1.35;
  if (sim.state.flags.fiebre && def.kind === 'medicina') m *= 1.4;
  if (place === 'MER' && sim.state.flags.galeriaOlvidada && def.kind === 'comida') m = Math.min(m, 1.6);
  return m;
}

/** Precio de compra (lo que paga el jugador) y de venta (lo que le pagan). */
export function buyPrice(sim: Sim, place: string, id: string, side: SideId | null): number {
  const rep = side && side !== 'LIB' && side !== 'JUG' && side !== 'MUT' ? sim.state.rep[side as FactionId] : 0;
  return Math.max(1, Math.round(ITEMS[id].price * priceMult(sim, place, id) * 1.22 * (1 - Math.max(-30, Math.min(40, rep)) * 0.003)));
}
export function sellPrice(sim: Sim, place: string, id: string, side: SideId | null): number {
  const rep = side && side !== 'LIB' && side !== 'JUG' && side !== 'MUT' ? sim.state.rep[side as FactionId] : 0;
  return Math.max(0, Math.floor(ITEMS[id].price * priceMult(sim, place, id) * 0.5 * (1 + Math.max(-30, Math.min(40, rep)) * 0.003)));
}

const STOCK: Record<string, [string, number, number][]> = {
  bazar: [['hongosSecos', 6, 16], ['vendas', 3, 8], ['tela', 4, 12], ['tablones', 6, 16], ['chatarra', 10, 30], ['piezas', 4, 12], ['balas', 40, 120], ['linterna', 1, 2], ['farol', 1, 2], ['mochila', 0, 2], ['cuchillo', 1, 2], ['martillo', 1, 2], ['palanca', 0, 2], ['agua', 6, 14], ['te', 3, 8], ['samogon', 1, 4], ['ganzuas', 0, 1], ['pico', 0, 1]],
  comida: [['hongos', 12, 30], ['hongosSecos', 10, 24], ['guiso', 4, 12], ['carneAsada', 2, 8], ['carne', 2, 8], ['te', 4, 10], ['agua', 8, 20], ['conserva', 0, 3], ['samogon', 2, 6]],
  armas: [['balas', 80, 240], ['cartuchosEscopeta', 16, 50], ['cuchillo', 1, 3], ['machete', 1, 2], ['hacha', 0, 1], ['lanza', 0, 2], ['maza', 0, 1], ['pala', 1, 2], ['pistola', 0, 2], ['escopeta', 0, 2], ['fusilTunel', 1, 2], ['cerrojo', 0, 1], ['subfusil', 0, 1], ['ak', 0, 1], ['neumatico', 0, 1]],
  ropa: [['ushanka', 1, 3], ['pasamontanas', 1, 2], ['casco', 0, 2], ['chaleco', 1, 2], ['petoCuero', 0, 2], ['chalecoPlacas', 0, 1], ['mochila', 1, 2], ['mochilaGrande', 0, 1], ['mascaraGas', 0, 2], ['respirador', 1, 2], ['filtros', 3, 8], ['tela', 4, 10], ['cuero', 2, 6]],
  medico: [['vendas', 8, 20], ['botiquin', 2, 6], ['antibioticos', 0, 3], ['filtros', 2, 6], ['respirador', 0, 1]],
  chatarrero: [['chatarra', 30, 80], ['piezas', 10, 30], ['acero', 2, 10], ['tablones', 10, 30], ['componentes', 1, 6], ['salitre', 4, 14], ['polvora', 2, 8], ['combustible', 2, 10], ['cuero', 2, 6], ['tela', 4, 12], ['pico', 1, 1], ['martillo', 1, 2], ['palanca', 1, 2]],
  bar: [['guiso', 6, 14], ['carneAsada', 3, 8], ['te', 6, 12], ['samogon', 6, 14], ['hongosSecos', 4, 10]],
  negro: [['balas', 60, 160], ['samogon', 4, 10], ['ganzuas', 1, 2], ['escopeta', 0, 2], ['subfusil', 0, 1], ['petoCuero', 0, 1], ['conserva', 1, 5], ['componentes', 1, 5], ['libros', 0, 2], ['planos', 0, 1], ['mascaraGas', 0, 1], ['filtros', 2, 6]],
  libros: [['libros', 1, 4], ['planos', 0, 2], ['componentes', 2, 8], ['filtros', 4, 10], ['radioPiezas', 0, 1], ['mascaraGas', 1, 2], ['linterna', 1, 3]],
  caravana: [['hongosSecos', 8, 20], ['tela', 4, 12], ['piezas', 6, 16], ['balas', 40, 100], ['vendas', 2, 6], ['samogon', 2, 6], ['combustible', 1, 5], ['salitre', 2, 8], ['componentes', 0, 3]],
};

function restock(sim: Sim, shop: Shop) {
  const table = STOCK[shop.kind] ?? STOCK.bazar;
  shop.stock = shop.stock.filter((s) => !table.some((t) => t[0] === s.id));
  for (const [id, a, b] of table) {
    const n = sim.rng.int(a, b);
    if (n > 0) addItem({ inv: shop.stock }, id, n);
  }
  shop.money = sim.rng.int(120, 320) * (shop.kind === 'armas' || shop.kind === 'negro' ? 2 : 1);
  shop.restock = sim.state.time + 1440 * (0.8 + sim.rng.next() * 0.6);
}

/** Tienda de un vendedor (se crea la primera vez). */
export function shopOf(sim: Sim, vendor: Char): Shop {
  const place = vendor.ai.place || 'LIB';
  let st = sim.state.stations[place];
  if (!st) {
    // Vendedores ambulantes: la tienda vive en una "estación" virtual por escuadra
    const key = 'sq' + vendor.squad;
    st = sim.state.stations[key] ?? (sim.state.stations[key] = { id: key, owner: vendor.side, shops: {}, alert: 0, dead: {}, visited: true });
  }
  const kind = vendor.vendor ?? 'bazar';
  const key = kind + ':' + (vendor.slot ?? vendor.id);
  let shop = st.shops[key];
  if (!shop) {
    shop = st.shops[key] = { kind, stock: [], money: 0, restock: 0 };
    restock(sim, shop);
  } else if (sim.state.time > shop.restock) restock(sim, shop);
  return shop;
}

export function buyItem(sim: Sim, buyer: Char, vendor: Char, index: number, n: number): string | null {
  const shop = shopOf(sim, vendor);
  const s = shop.stock[index];
  if (!s) return 'Ya no queda';
  n = Math.min(n, s.n);
  const price = buyPrice(sim, vendor.ai.place, s.id, vendor.side) * n;
  if (price > sim.state.money) return 'No tienes cartuchos suficientes';
  sim.state.money -= price;
  shop.money += price;
  addItem(buyer, s.id, n, { mag: s.mag, fil: s.fil });
  s.n -= n;
  if (s.n <= 0) shop.stock.splice(index, 1);
  sim.emit({ t: 'sonido', k: 'moneda', x: buyer.x, z: buyer.z });
  sim.state.flags.tComercio = 1;
  return null;
}

export function sellItem(sim: Sim, seller: Char, vendor: Char, index: number, n: number): string | null {
  const shop = shopOf(sim, vendor);
  const s = seller.inv[index];
  if (!s) return 'No lo tienes';
  const def = ITEMS[s.id];
  if (def.kind === 'clave') return 'Eso no se vende';
  if (s.hot && s.hot === vendor.ai.place && shop.kind !== 'negro') return 'Aquí reconocen la mercancía robada';
  n = Math.min(n, s.n);
  let price = sellPrice(sim, vendor.ai.place, s.id, vendor.side) * n;
  if (price > shop.money) {
    if (shop.money <= 0) return 'El vendedor no tiene cartuchos';
    n = Math.max(1, Math.floor(shop.money / Math.max(1, sellPrice(sim, vendor.ai.place, s.id, vendor.side))));
    price = sellPrice(sim, vendor.ai.place, s.id, vendor.side) * n;
    if (price > shop.money) return 'El vendedor no tiene cartuchos';
  }
  shop.money -= price;
  sim.state.money += price;
  sim.state.stats.earned += price;
  sim.state.flags.tComercio = 1;
  addItem({ inv: shop.stock }, s.id, n, { mag: s.mag, fil: s.fil });
  s.n -= n;
  if (s.n <= 0) seller.inv.splice(index, 1);
  // Vender comida en la estación sitiada es romper el embargo
  if (vendor.ai.place === 'MER' && def.kind === 'comida' && n >= 3) {
    sim.rep('CAL', Math.min(6, n * 0.25));
    sim.state.flags.contrabando = (sim.state.flags.contrabando ?? 0) + n;
  }
  if (vendor.side !== 'LIB' && vendor.side !== 'JUG' && vendor.side !== 'MUT' && price >= 40) sim.rep(vendor.side as FactionId, Math.min(1.5, price / 300));
  sim.emit({ t: 'sonido', k: 'moneda', x: seller.x, z: seller.z });
  return null;
}

// ---------------------------------------------------------------------------
// Escuadra del jugador
// ---------------------------------------------------------------------------

export function squadCap(sim: Sim): number {
  return hasTech(sim, 'mando') ? 20 : 12;
}

export function hire(sim: Sim, npc: Char, free = false): string | null {
  if (sim.players.length >= squadCap(sim)) return 'Tu escuadra está completa';
  const price = free ? 0 : (npc.hire ?? 0);
  if (price > sim.state.money) return 'No tienes cartuchos suficientes';
  sim.state.money -= price;
  if (!free) sim.state.flags.tRecluta = 1;
  joinPlayer(sim, npc);
  sim.log(`${npc.name} se une a tu escuadra.`, 'bueno');
  return null;
}

export function joinPlayer(sim: Sim, c: Char) {
  c.side = 'JUG';
  c.player = true;
  c.persist = true;
  c.ai.mode = 'jugador';
  c.ai.sub = '';
  c.ai.place = '';
  delete c.slot;
  delete c.vendor;
  delete c.hire;
  c.squad = 0;
  c.stance = 'defensivo';
  c.target = 0;
  c.order = null;
  if (c.look) c.look = { ...c.look, armband: sim.state.playerColor };
  sim.emit({ t: 'mundo', k: 'escuadra', id: c.id });
}

// ---------------------------------------------------------------------------
// Sucesos periódicos
// ---------------------------------------------------------------------------

function baseCenter(sim: Sim): { x: number; z: number; n: number } | null {
  let x = 0;
  let z = 0;
  let n = 0;
  for (const b of sim.state.buildings) {
    if (b.prog < 1) continue;
    x += b.x;
    z += b.z;
    n++;
  }
  return n ? { x: x / n, z: z / n, n } : null;
}

function timer(sim: Sim, key: string, first: number): boolean {
  const t = sim.state.timers[key];
  if (t === undefined) {
    sim.state.timers[key] = sim.state.time + first;
    return false;
  }
  return sim.state.time >= t;
}

function setTimer(sim: Sim, key: string, delay: number) {
  sim.state.timers[key] = sim.state.time + delay;
}

const FLAVOR: { id: string; text: string; flag?: string; dur?: number }[] = [
  { id: 'invierno', text: 'Invierno crudo: el frío de la superficie baja por los pozos de ventilación. El agua se hiela en las tuberías, los hongos se marchitan y la comida sube de precio.', flag: 'inviernoCrudo', dur: 2 * 1440 },
  { id: 'fiebre', text: 'Fiebre en los andenes: una fiebre extraña se extiende por las estaciones. Los médicos no dan abasto y las medicinas se encarecen.', flag: 'fiebre', dur: 2 * 1440 },
  { id: 'refugiados', text: 'Llegan refugiados: un grupo de familias vaga por los túneles, huyendo de una estación que ya no existe.' },
  { id: 'caravana', text: 'Corre la voz: los saqueadores han asaltado otra caravana en los túneles del este. Los supervivientes llegaron heridos y sin mercancía.' },
  { id: 'apagon', text: 'Apagón: el generador principal de una estación ha reventado. Los andenes quedan a oscuras durante horas.' },
  { id: 'boda', text: 'Una boda en el andén: por una noche, nadie habla de la guerra.' },
  { id: 'stalker', text: 'Un stalker cubierto de escarcha cuenta en los bares que ha visto cosas en la superficie que nadie creería.' },
  { id: 'voces', text: 'Voces en Tenevskaya: una patrulla jura haber oído voces que llamaban a cada soldado por su nombre.' },
  { id: 'cerco', text: 'El cerco se estrecha: las patrullas del Levantamiento han sellado hasta los conductos de ventilación de Mertvaya. Las raciones menguan otra vez.' },
  { id: 'carta', text: 'En Kholodnogo Vozduha los oficiales murmuran: Bessmertny escribió a Volkov y no ha habido respuesta.' },
];

export function stepWorldEvents(sim: Sim, dt: number) {
  const st = sim.state;
  void dt;
  // Efectos temporales
  for (const f of ['inviernoCrudo', 'fiebre']) {
    if (st.flags[f] && st.time > st.flags[f]) delete st.flags[f];
  }
  // Rumores y sucesos del metro
  if (timer(sim, 'rumor', 900)) {
    setTimer(sim, 'rumor', 700 + sim.rng.next() * 900);
    const e = sim.rng.pick(FLAVOR);
    if (e.id !== 'carta' || !st.flags.cartaEntregada) {
      sim.log(e.text, 'historia');
      if (e.flag) st.flags[e.flag] = st.time + (e.dur ?? 1440);
      if (e.id === 'refugiados') {
        const home = sim.rng.pick(['TSE', 'STA', 'UBE', 'STL']);
        const p = placePos(sim, home);
        if (p) {
          const q = sim.world.nav.nearestPassable(p.x, p.z, 10) ?? p;
          const sq = newSquad(sim, 'LIB', 'refugiados', 'Refugiados', ['refugiado', 'refugiado', 'refugiado', 'civil'], q, [home, sim.rng.pick(['ZVE', 'UBE', 'STA', 'TSE'])], home);
          sq.life = 2 * 1440;
        }
      }
    }
  }
  // Nueva jornada
  const day = Math.floor(st.time / 1440);
  if (day > st.stats.days) {
    st.stats.days = day;
    // Las recompensas por tu cabeza se olvidan poco a poco
    for (const f of Object.keys(st.bounty) as FactionId[]) st.bounty[f] = Math.max(0, st.bounty[f] - 25);
    sim.emit({ t: 'mundo', k: 'dia' });
  }
  // Los nodos de chatarra se reponen despacio
  if (timer(sim, 'chatarra', 600)) {
    setTimer(sim, 'chatarra', 600);
    for (const n of st.nodes) if ((n.kind === 'chatarra' || n.kind === 'salitre') && n.amount < 120) n.amount += 4;
  }
  // Asaltos a la base
  const base = baseCenter(sim);
  if (base && base.n >= 3) {
    if (timer(sim, 'asalto', 2.2 * 1440)) {
      setTimer(sim, 'asalto', (1.6 + sim.rng.next() * 1.8) * 1440);
      raid(sim, base);
    }
    // Caravanas que paran en el puesto de comercio
    if (st.buildings.some((b) => b.prog >= 1 && BUILDS[b.def].trade) && timer(sim, 'visita', 900)) {
      setTimer(sim, 'visita', 1100 + sim.rng.next() * 900);
      const from = sim.rng.pick(['STA', 'TSE', 'ZVE', 'UBE', 'STL']);
      const p = placePos(sim, from);
      if (p && sim.world.graph.travelDistance(p.x, p.z, base.x, base.z) < 1500) {
        const q = sim.world.nav.nearestPassable(p.x, p.z, 10) ?? p;
        const sq = newSquad(sim, 'LIB', 'caravana', 'Buhoneros', ['caravanero', 'caravanero', 'guardia'], q, [], from);
        sq.cargo = [];
        const g = sim.world.nav.nearestPassable(base.x, base.z, 12) ?? base;
        sq.gx = g.x;
        sq.gz = g.z;
        sq.life = 1.5 * 1440;
        sim.log('Unos buhoneros se han puesto en camino hacia tu puesto de comercio.', 'info');
      }
    }
  }
  // Peaje de los bandidos
  for (const sq of st.squads) {
    if (sq.kind !== 'banda' || !sq.mat || sq.talked || sq.angry) continue;
    if (sim.playerDist(sq.x, sq.z) < 15 && st.rep.VHL > -50) {
      sq.talked = true;
      const lead = sq.roster.map((m) => (m.id ? sim.char(m.id) : null)).find((c) => c && c.st === 'ok');
      if (lead) sim.emit({ t: 'mundo', k: 'peaje', id: lead.id });
    }
  }
  // El peaje de Staraya: se cobra al entrar, una vez por jornada
  if (st.stations.STA?.owner === 'STA' && staTollState(sim) === 'libre' && st.rep.STA < 15 && st.rep.STA > -40) {
    const f = sim.world.layout.stationById.STA;
    const inside = sim.players.find((c) => c.st === 'ok' && insideStation(f, c.x, c.z, -7));
    if (inside) {
      let best: Char | null = null;
      let bd = 45;
      for (const c of st.chars) {
        if (c.side !== 'STA' || c.st !== 'ok' || c.squad) continue;
        const d = Math.hypot(c.x - inside.x, c.z - inside.z) - (c.bio?.startsWith('Cobrador') ? 12 : 0);
        if ((c.ai.mode === 'guardia' || c.bio?.startsWith('Cobrador')) && d < bd) {
          bd = d;
          best = c;
        }
      }
      if (best) {
        st.flags.peajeSTA = sim.day + 1;
        sim.emit({ t: 'mundo', k: 'peaje', id: best.id });
      }
    }
  }
  // La radio: el final abierto de la historia
  if (!st.flags.senal && st.buildings.some((b) => b.prog >= 1 && BUILDS[b.def].radio && b.craft >= 1)) radioSignal(sim);
}

/** Peaje de Staraya: tanto por cabeza y una parte de lo que se lleva en la bolsa. */
export function staTollFee(sim: Sim): number {
  const heads = sim.players.filter((c) => c.st !== 'muerto').length;
  return Math.max(8, heads * 5 + Math.round(sim.state.money * 0.04));
}

/** ¿Cómo está hoy la escuadra con los cobradores de Staraya? */
export function staTollState(sim: Sim): 'libre' | 'pagado' | 'moroso' {
  const today = sim.day + 1;
  if (sim.state.flags.peajePagado === today) return 'pagado';
  if (sim.state.flags.peajeSTA === today) return 'moroso';
  return 'libre';
}

export function payStaToll(sim: Sim): string | null {
  const fee = staTollFee(sim);
  if (sim.state.money < fee) return 'No tienes cartuchos suficientes';
  sim.state.money -= fee;
  sim.state.flags.peajePagado = sim.day + 1;
  sim.rep('STA', 1);
  sim.log(`Pagas ${fee} cartuchos de peaje al Consejo Mercantil de Staraya.`, 'info');
  sim.emit({ t: 'sonido', k: 'moneda', x: NaN, z: NaN });
  return null;
}

function raid(sim: Sim, base: { x: number; z: number; n: number }) {
  const st = sim.state;
  const vhlAlive = st.stations.VHL.owner === 'VHL' && !st.flags.muerto_rybak;
  // Punto de partida: un nodo del grafo a 120-220 m de la base
  const g = sim.world.graph;
  const cands = g.nodes.filter((n) => {
    const d = Math.hypot(n.x - base.x, n.z - base.z);
    return d > 110 && d < 230;
  });
  if (!cands.length) return;
  const from = sim.rng.pick(cands);
  if (g.travelDistance(from.x, from.z, base.x, base.z) > 600) return;
  const strength = Math.min(8, 2 + Math.floor(base.n / 3) + Math.floor(sim.day / 4));
  const human = vhlAlive && st.rep.VHL < 30 && sim.rng.chance(0.6);
  const roster = human ? ['jefe', ...Array(strength).fill('bandido')] : sim.rng.chance(0.5) ? Array(strength + 3).fill('rata') : Array(Math.max(2, strength - 1)).fill('skrebun');
  const sq = newSquad(sim, human ? 'VHL' : 'MUT', 'asalto', human ? 'Asalto de saqueadores' : 'Jauría hambrienta', roster, from, [], human ? 'VHL' : '');
  const p = sim.world.nav.nearestPassable(base.x, base.z, 12) ?? base;
  sq.gx = p.x;
  sq.gz = p.z;
  sq.mode = 'asalto';
  sq.angry = true;
  sq.life = 1440;
  sim.log(human ? 'Tus vigías dan la alarma: una banda de saqueadores se acerca a la base.' : 'Algo se mueve en la oscuridad: una jauría viene hacia la base.', 'malo');
  sim.emit({ t: 'sonido', k: 'alarma', x: base.x, z: base.z });
}

// ---------------------------------------------------------------------------
// Hilos de la historia
// ---------------------------------------------------------------------------

/** Entrega la carta de Bessmertny. Devuelve el texto del desenlace. */
export function deliverLetter(sim: Sim, carrier: Char, to: 'volkov' | 'bessmertny' | 'orlova' | 'quemar'): string {
  const st = sim.state;
  if (!takeItem(carrier, 'cartaBessmertny', 1) && to !== 'quemar') return '';
  if (to === 'quemar') takeItem(carrier, 'cartaBessmertny', 1);
  st.flags.cartaEntregada = 1;
  const key = 'SDR|UNI';
  if (to === 'volkov') {
    st.rel[key] = Math.min(100, (st.rel[key] ?? 0) + 35);
    sim.rep('UNI', 30, 'entregar la carta perdida');
    st.money += 150;
    st.flags.distension = 1;
    sim.log('Volkov lee la carta de Bessmertny dos veces. «Escribiremos al este. Quizá haya una salida.» La guerra entre la Unión y los Seguidores se aleja.', 'historia');
    return 'Volkov rompe el lacre del tridente verde y lee en silencio. «Seis años vivió entre nosotros… Escribiremos a Bessmertny.» Te paga 150 cartuchos.';
  }
  if (to === 'bessmertny') {
    st.rel[key] = Math.max(-100, (st.rel[key] ?? 0) - 30);
    sim.rep('SDR', 30, 'devolver la carta');
    st.money += 120;
    st.flags.ultimatum = 1;
    sim.log('Bessmertny sabe ahora que su carta nunca llegó: alguien en la Unión la escondió. Prepara un ultimátum.', 'historia');
    return 'Bessmertny mira el lacre intacto. «Así que nunca la leyó. Alguien quiso que no llegara.» Aprieta la mandíbula. «Esta vez irá en mano, con un ultimátum.» Te paga 120 cartuchos.';
  }
  if (to === 'orlova') {
    sim.rep('STA', 20, 'vender la carta');
    st.money += 260;
    st.flags.cartaStaraya = 1;
    sim.log('El Consejo Mercantil de Staraya guarda ahora la carta de Bessmertny. Saben exactamente cuánto vale la paz… y la guerra.', 'historia');
    return 'La Gran Tesorera sopesa el sobre como si fuera oro. «Esto vale más que diez caravanas.» Te paga 260 cartuchos sin regatear.';
  }
  sim.log('La carta de Bessmertny arde en una hoguera. Nadie sabrá nunca por qué no llegó.', 'historia');
  return 'El lacre verde se derrite sobre las brasas. Nadie sabrá nunca por qué la carta no llegó.';
}

/** Entrega de un prisionero buscado. */
export function deliverPrisoner(sim: Sim, carrier: Char, to: Char): string | null {
  const p = carrier.carry ? sim.char(carrier.carry) : null;
  if (!p || !p.unique) return null;
  const st = sim.state;
  if (p.unique === 'rybak' && (to.side === 'STA' || to.side === 'SDR' || to.side === 'UNI')) {
    carrier.carry = 0;
    p.carriedBy = 0;
    sim.removeChar(p);
    st.flags.muerto_rybak = 1;
    st.flags.rybakPreso = 1;
    st.money += 600;
    sim.rep(to.side as FactionId, 40, 'entregar al Tuerto');
    sim.rep('VHL', -40);
    sim.log('Grigori «el Tuerto» Rybak, cabecilla de la Hermandad, está entre rejas. Sin él, las bandas de Vhlainska se deshacen: los túneles del este respiran.', 'historia');
    for (const sq of st.squads) if (sq.kind === 'banda') sq.life = 0;
    return `«¿El Tuerto en persona?» ${to.name} no da crédito. Te paga 600 cartuchos de recompensa.`;
  }
  if (p.unique === 'baghdadi' && to.side === 'LEV') {
    carrier.carry = 0;
    p.carriedBy = 0;
    sim.removeChar(p);
    st.flags.muerto_baghdadi = 1;
    st.flags.baghdadiPreso = 1;
    st.money += 500;
    sim.rep('LEV', 40, 'entregar a Baghdadi');
    st.rel['CAL|LEV'] = -40;
    sim.log('Mohhammed Baghdadi responderá ante un tribunal del Levantamiento por las matanzas de Izumrudnaya. El imán Karimov preside ahora la estación y pide el fin del embargo.', 'historia');
    return `${to.name} asiente despacio. «Juicio justo, como prometimos.» Te paga 500 cartuchos.`;
  }
  return null;
}

/** ¿Es uno de los almacenes blindados de Tenevskaya? */
export function isCivilDefense(c: Container): boolean {
  return c.kind === 'almacen' && c.label.startsWith('Almacén de la defensa civil');
}

/** Quema la carta de Bessmertny, la lleve quien la lleve. */
export function burnLetter(sim: Sim): string | null {
  const carrier = sim.players.find((q) => countItem(q, 'cartaBessmertny') > 0);
  if (!carrier) return null;
  return deliverLetter(sim, carrier, 'quemar');
}

/** La emisora capta la señal (final abierto). */
export function radioSignal(sim: Sim): boolean {
  const st = sim.state;
  if (st.flags.senal) return false;
  st.flags.senal = 1;
  sim.log('Entre el ruido estático, una voz repite coordenadas y una frase en ruso: «Aquí Múrmansk. Seguimos vivos.» La señal se pierde a los pocos minutos. Nadie sabe si fue grabada hace años. Pero hay más supervivientes. Hay esperanza.', 'historia');
  sim.emit({ t: 'mundo', k: 'senal' });
  for (const f of Object.keys(st.rep) as FactionId[]) sim.rep(f, 5);
  return true;
}

export { FACTION_LORE, countItem };
