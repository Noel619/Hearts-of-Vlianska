// Estado de la simulación. Todo son datos planos (serializables a JSON):
// las reglas están en los módulos de sistemas.

import type { Role } from '../data/gente';
import type { EquipSlot, Stack } from '../data/items';
import type { Look } from '../data/looks';
import type { SkillId } from '../data/skills';
import type { FactionId, SideId } from '../data/tipos';

export type CharState = 'ok' | 'ko' | 'muerto';
export type Stance = 'agresivo' | 'defensivo' | 'pasivo';

export type OrderType =
  | 'mover'
  | 'atacar'
  | 'seguir'
  | 'recoger'
  | 'saquear'
  | 'hablar'
  | 'curar'
  | 'cargar'
  | 'soltar'
  | 'abrir'
  | 'construir'
  | 'operar'
  | 'chatarrear'
  | 'excavar'
  | 'descansar'
  | 'derribar'
  | 'entregar';

export interface Order {
  t: OrderType;
  x?: number;
  z?: number;
  /** Entidad objetivo: personaje, edificio, contenedor, objeto del suelo o nodo. */
  id?: number;
  data?: string;
}

export type JobType = 'operar' | 'construir' | 'acarrear' | 'cultivar' | 'chatarrear' | 'medico' | 'guardia' | 'cocinar' | 'investigar';

export interface Job {
  t: JobType;
  /** Edificio o nodo asignado. */
  id?: number;
}

export type PoseId = 'normal' | 'sentado' | 'sentadoSuelo' | 'arrodillado' | 'cuclillas' | 'tumbado' | 'ko' | 'muerto' | 'cargado' | 'gateo';
export type WorkId = 'nada' | 'martillo' | 'pico' | 'operar' | 'cocinar' | 'rebuscar' | 'vendar' | 'comer' | 'hablar' | 'guitarra' | 'calentarse' | 'escribir' | 'cargarCaja' | 'rezar' | 'guardia';

export interface CharAI {
  /** Comportamiento de fondo. */
  mode: 'quieto' | 'residente' | 'guardia' | 'vendedor' | 'escuadra' | 'fiera' | 'jugador' | 'huir' | 'trabajo';
  /** Temporizador de decisión. */
  t: number;
  homeX: number;
  homeZ: number;
  homeFace: number;
  /** Lugar al que pertenece (estación o cruce). */
  place: string;
  /** Punto de interés ocupado (índice en decor.spots) o -1. */
  spot: number;
  /** Subestado y datos libres. */
  sub: string;
  n: number;
}

export interface Char {
  id: number;
  name: string;
  side: SideId;
  /** 'humano' o id de criatura. */
  kind: string;
  role: Role | '';
  squad: number;
  x: number;
  z: number;
  face: number;
  look: Look | null;
  sk: Record<SkillId, number>;
  /** Salud de las 7 partes del cuerpo. */
  hp: number[];
  hpMax: number[];
  blood: number;
  bleed: number;
  /** Herida abierta por parte: sangra y no cura hasta que se venda. */
  wound: number[];
  hunger: number;
  st: CharState;
  koT: number;
  inv: Stack[];
  eq: Partial<Record<EquipSlot, Stack>>;
  money: number;
  // Movimiento
  path: number[] | null;
  pi: number;
  route: number[] | null;
  ri: number;
  destX: number;
  destZ: number;
  hasDest: boolean;
  arrive: number;
  speed: number;
  run: boolean;
  stuck: number;
  repath: number;
  // Órdenes
  order: Order | null;
  queue: Order[];
  // Combate
  target: number;
  atkT: number;
  atkDur: number;
  atkKind: string;
  atkDone: boolean;
  cd: number;
  sinceFire: number;
  sinceHit: number;
  hitSide: number;
  sinceBlock: number;
  reload: number;
  aim: number;
  /** Tiempo trabajando en la tarea actual. */
  workT: number;
  // Estado
  player: boolean;
  sneak: boolean;
  lamp: boolean;
  stance: Stance;
  hold: boolean;
  autoHeal: boolean;
  carry: number;
  carriedBy: number;
  ai: CharAI;
  jobs: Job[];
  pose: PoseId;
  work: WorkId;
  /** Figura de la historia. */
  unique?: string;
  /** Tipo de tienda que atiende. */
  vendor?: string;
  /** Precio de contratación (está disponible como recluta). */
  hire?: number;
  /** Texto de presentación. */
  bio?: string;
  /** Se guarda aunque nadie lo vea. */
  persist: boolean;
  /** Residente genérico: "lugar:índice". */
  slot?: string;
  /** Nivel de luz en su posición (0..1+), actualizado periódicamente. */
  lit: number;
  /** Visto por el jugador hace poco. */
  seenT: number;
  /** Segundos hasta que el cadáver desaparece. */
  rot: number;
}

export type SquadKind = 'jugador' | 'patrulla' | 'caravana' | 'banda' | 'jauria' | 'asalto' | 'cobradores' | 'refugiados' | 'stalkers';

export interface SquadMember {
  /** Arquetipo humano o id de criatura. */
  k: string;
  /** Personaje materializado (0 si no lo está). */
  id: number;
  dead?: boolean;
}

export interface Squad {
  id: number;
  side: SideId;
  kind: SquadKind;
  name: string;
  roster: SquadMember[];
  x: number;
  z: number;
  /** Lista de lugares por los que pasa (ids de estación o cruce). */
  plan: string[];
  pi: number;
  /** Destino actual en el mundo. */
  gx: number;
  gz: number;
  route: number[] | null;
  ri: number;
  wait: number;
  mat: boolean;
  home: string;
  /** Estado: viajando, acampada, atacando, comerciando, volviendo. */
  mode: 'viaje' | 'espera' | 'asalto' | 'trato' | 'vuelta' | 'acecho';
  /** Hostil al jugador aunque su facción no lo sea (cobradores rechazados, etc.). */
  angry?: boolean;
  /** Mercancía de la caravana. */
  cargo?: Stack[];
  /** Objetivo de un asalto: id de edificio del jugador o 0. */
  aim?: number;
  /** Temporizador de vida (bandas y asaltos se retiran). */
  life: number;
  talked?: boolean;
}

export interface Building {
  id: number;
  def: string;
  x: number;
  z: number;
  rot: number;
  hp: number;
  /** Progreso de obra (1 = terminado). */
  prog: number;
  /** Materiales ya aportados a la obra. */
  got: Stack[];
  /** Almacén o búferes de entrada/salida. */
  store: Stack[];
  recipe: string | null;
  craft: number;
  on: boolean;
  /** Crecimiento del cultivo (0..1) o combustible restante. */
  grow: number;
  fuel: number;
  side: SideId;
  /** Trabajador que la está usando ahora. */
  user: number;
  /** Repetir la receta sin fin. */
  loop: boolean;
  /** Cola de unidades pendientes de la receta. */
  count: number;
}

export interface Drop {
  id: number;
  x: number;
  z: number;
  items: Stack[];
  /** Segundos de vida restantes. */
  t: number;
}

export interface Container {
  id: number;
  x: number;
  z: number;
  place: string;
  items: Stack[];
  /** Dificultad de la cerradura (0 = abierto). */
  lock: number;
  /** Dueño: abrirlo es robar. */
  owner: SideId | null;
  kind: 'caja' | 'almacen' | 'botin' | 'cajon';
  opened: boolean;
  /** Reposición (segundos de juego) o 0. */
  refill: number;
  label: string;
}

/** Nodo de recursos (chatarra, salitre, derrumbe excavable…). */
export interface ResNode {
  id: number;
  x: number;
  z: number;
  kind: 'chatarra' | 'salitre' | 'derrumbe' | 'muro';
  amount: number;
  /** Trabajo restante para excavar (derrumbes). */
  work: number;
  place: string;
}

export interface Shop {
  kind: string;
  stock: Stack[];
  money: number;
  restock: number;
}

export interface StationState {
  id: string;
  owner: SideId | null;
  shops: Record<string, Shop>;
  /** Alarma contra el jugador (segundos). */
  alert: number;
  /** Residentes muertos (índices) hasta su reposición. */
  dead: Record<string, number>;
  visited: boolean;
}

export interface LogEntry {
  t: number;
  msg: string;
  kind: 'info' | 'bueno' | 'malo' | 'combate' | 'historia';
}

export interface SimState {
  version: number;
  seed: number;
  rng: number;
  /** Segundos de juego desde el inicio (1 s real a velocidad 1 = 1 minuto de juego). */
  time: number;
  nextId: number;
  money: number;
  scenario: string;
  playerName: string;
  playerColor: number;
  chars: Char[];
  squads: Squad[];
  buildings: Building[];
  drops: Drop[];
  containers: Container[];
  nodes: ResNode[];
  stations: Record<string, StationState>;
  /** Relaciones entre facciones (-100..100), clave "A|B" ordenada. */
  rel: Record<string, number>;
  /** Reputación del jugador con cada facción. */
  rep: Record<FactionId, number>;
  /** Crímenes pendientes: recompensa por la cabeza del jugador en cada facción. */
  bounty: Record<FactionId, number>;
  flags: Record<string, number>;
  tech: { done: string[]; cur: string | null; prog: number };
  log: LogEntry[];
  /** Temporizadores de sucesos. */
  timers: Record<string, number>;
  stats: { kills: number; days: number; earned: number; built: number };
}

/** Sucesos efímeros para el render, el sonido y la interfaz. */
export type SimEvent =
  | { t: 'tiro'; id: number; x: number; z: number; tx: number; tz: number; hit: boolean; w: string }
  | { t: 'golpe'; id: number; target: number; part: number; dmg: number; kind: 'corte' | 'contusion' | 'bala'; block: boolean }
  | { t: 'ataque'; id: number }
  | { t: 'ko'; id: number }
  | { t: 'muerte'; id: number }
  | { t: 'habla'; id: number; text: string }
  | { t: 'flota'; x: number; z: number; text: string; color: string }
  | { t: 'sonido'; k: string; x: number; z: number; v?: number }
  | { t: 'nace'; id: number }
  | { t: 'adios'; id: number }
  | { t: 'obra'; id: number; k: 'nueva' | 'lista' | 'fuera' | 'cambio' }
  | { t: 'mundo'; k: string; id?: number; a?: number }
  | { t: 'aviso'; msg: string; kind: LogEntry['kind'] }
  | { t: 'nivel'; id: number; skill: SkillId; lvl: number };

export const SAVE_VERSION = 1;
