// Teclas del juego: cada acción tiene una tecla (física, por su código, así
// que no depende de la distribución del teclado) que el jugador puede cambiar
// en Ajustes. Se guardan en el navegador. Algunas combinaciones son fijas:
// Esc (cancelar y menú), Ctrl/Alt + número (grupos), Ctrl+A (todos), Mayús
// (encadenar órdenes) y las flechas, que siempre mueven la cámara.

export type KeyGroup = 'Cámara' | 'Tiempo' | 'Escuadra' | 'Pantallas' | 'Partida';

export interface KeyAction {
  id: string;
  label: string;
  group: KeyGroup;
  def: string;
}

export const KEY_ACTIONS: KeyAction[] = [
  { id: 'camArriba', label: 'Mover la cámara adelante', group: 'Cámara', def: 'KeyW' },
  { id: 'camAbajo', label: 'Mover la cámara atrás', group: 'Cámara', def: 'KeyS' },
  { id: 'camIzq', label: 'Mover la cámara a la izquierda', group: 'Cámara', def: 'KeyA' },
  { id: 'camDer', label: 'Mover la cámara a la derecha', group: 'Cámara', def: 'KeyD' },
  { id: 'girarIzq', label: 'Girar la cámara (y la obra) a la izquierda', group: 'Cámara', def: 'KeyQ' },
  { id: 'girarDer', label: 'Girar la cámara (y la obra) a la derecha', group: 'Cámara', def: 'KeyE' },
  { id: 'centrar', label: 'Centrar la cámara en el seleccionado', group: 'Cámara', def: 'KeyF' },
  { id: 'pausa', label: 'Pausa', group: 'Tiempo', def: 'Space' },
  { id: 'vel1', label: 'Velocidad ×1', group: 'Tiempo', def: 'Digit1' },
  { id: 'vel2', label: 'Velocidad ×2', group: 'Tiempo', def: 'Digit2' },
  { id: 'vel3', label: 'Velocidad ×4', group: 'Tiempo', def: 'Digit3' },
  { id: 'vel4', label: 'Velocidad ×8', group: 'Tiempo', def: 'Digit4' },
  { id: 'siguiente', label: 'Siguiente de la escuadra', group: 'Escuadra', def: 'Tab' },
  { id: 'linterna', label: 'Linterna', group: 'Escuadra', def: 'KeyL' },
  { id: 'sigilo', label: 'Sigilo', group: 'Escuadra', def: 'KeyC' },
  { id: 'mantener', label: 'Mantener posición', group: 'Escuadra', def: 'KeyH' },
  { id: 'cancelar', label: 'Cancelar órdenes', group: 'Escuadra', def: 'KeyX' },
  { id: 'girarObra', label: 'Girar la obra antes de colocarla', group: 'Escuadra', def: 'KeyR' },
  { id: 'construir', label: 'Construir', group: 'Pantallas', def: 'KeyB' },
  { id: 'investigar', label: 'Estudio', group: 'Pantallas', def: 'KeyI' },
  { id: 'mapa', label: 'Mapa', group: 'Pantallas', def: 'KeyM' },
  { id: 'facciones', label: 'Facciones', group: 'Pantallas', def: 'KeyG' },
  { id: 'cronica', label: 'Crónica', group: 'Pantallas', def: 'KeyK' },
  { id: 'hilos', label: 'Hilos', group: 'Pantallas', def: 'KeyJ' },
  { id: 'guardar', label: 'Guardado rápido', group: 'Partida', def: 'F5' },
  { id: 'cargar', label: 'Carga rápida', group: 'Partida', def: 'F9' },
];

export const KEY_GROUPS: KeyGroup[] = ['Cámara', 'Tiempo', 'Escuadra', 'Pantallas', 'Partida'];

/** Teclas que no se pueden asignar: Esc cancela y abre el menú; las de modificador van en combinación. */
const RESERVED = new Set(['Escape', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'ContextMenu', 'CapsLock', 'NumLock', 'ScrollLock', 'Fn']);

const STORE = 'sombras:teclas';
const ACTION = new Map(KEY_ACTIONS.map((a) => [a.id, a]));
let bound: Record<string, string> = defaults();
let byCode = new Map<string, string>();
const listeners = new Set<() => void>();

function defaults(): Record<string, string> {
  return Object.fromEntries(KEY_ACTIONS.map((a) => [a.id, a.def]));
}

function reindex() {
  byCode = new Map(Object.entries(bound).map(([a, k]) => [k, a]));
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function save() {
  const custom: Record<string, string> = {};
  for (const a of KEY_ACTIONS) if (bound[a.id] !== a.def) custom[a.id] = bound[a.id];
  try {
    const st = storage();
    if (!st) return;
    if (Object.keys(custom).length) st.setItem(STORE, JSON.stringify(custom));
    else st.removeItem(STORE);
  } catch {
    // Sin almacenamiento: valen hasta que se cierre la página
  }
}

function changed() {
  reindex();
  save();
  for (const fn of listeners) fn();
}

/** Carga las teclas guardadas; descarta las que no valen o chocan entre sí. */
export function loadKeys(text?: string | null) {
  bound = defaults();
  let raw: unknown = null;
  try {
    raw = JSON.parse(text ?? storage()?.getItem(STORE) ?? 'null');
  } catch {
    raw = null;
  }
  if (raw && typeof raw === 'object') {
    for (const [id, code] of Object.entries(raw as Record<string, unknown>)) {
      if (!ACTION.has(id) || typeof code !== 'string' || RESERVED.has(code) || !code) continue;
      // Si otra acción ya tenía esa tecla, se queda con la tecla de esta (intercambio)
      const other = Object.keys(bound).find((a) => a !== id && bound[a] === code);
      if (other) bound[other] = bound[id];
      bound[id] = code;
    }
  }
  reindex();
}
loadKeys();

/** Tecla (código) de una acción. */
export function keyFor(action: string): string {
  return bound[action] ?? ACTION.get(action)?.def ?? '';
}

/** Acción de una tecla, o null. */
export function actionFor(code: string): string | null {
  return byCode.get(code) ?? null;
}

/** ¿Se puede asignar esta tecla? Devuelve el motivo si no. */
export function keyProblem(code: string): string | null {
  if (code === 'Escape') return 'Esc está reservada para cancelar y abrir el menú';
  if (RESERVED.has(code)) return 'Las teclas de modificador van en combinación';
  return null;
}

/**
 * Asigna una tecla a una acción. Si ya la usaba otra, intercambian teclas
 * (nada se queda sin tecla). Devuelve la acción con la que se intercambió.
 */
export function setKey(action: string, code: string): string | null {
  if (!ACTION.has(action) || keyProblem(code)) return null;
  const prev = bound[action];
  if (prev === code) return null;
  const other = byCode.get(code) ?? null;
  bound[action] = code;
  if (other && other !== action) bound[other] = prev;
  changed();
  return other && other !== action ? other : null;
}

export function resetKeys() {
  bound = defaults();
  changed();
}

export function keysCustomized(): boolean {
  return KEY_ACTIONS.some((a) => bound[a.id] !== a.def);
}

export function actionLabel(action: string): string {
  return ACTION.get(action)?.label ?? action;
}

/** Avisa cuando cambian las teclas. */
export function onKeysChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// --- Nombres de las teclas -------------------------------------------------------

const NAMES: Record<string, string> = {
  Space: 'Espacio',
  Tab: 'Tab',
  Enter: 'Intro',
  NumpadEnter: 'Intro (num.)',
  Backspace: 'Retroceso',
  Delete: 'Supr',
  Insert: 'Insert',
  Home: 'Inicio',
  End: 'Fin',
  PageUp: 'Re Pág',
  PageDown: 'Av Pág',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Pause: 'Pausa',
  PrintScreen: 'Impr Pant',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  IntlBackslash: '<',
};

/** Caracteres de la distribución del teclado del jugador, si el navegador los da. */
let layout: Map<string, string> | null = null;
type LayoutNav = Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } };
if (typeof navigator !== 'undefined') {
  (navigator as LayoutNav).keyboard
    ?.getLayoutMap?.()
    .then((m) => {
      layout = m;
      for (const fn of listeners) fn();
    })
    .catch(() => {});
}

/** Nombre legible de una tecla: lo que pone en la tecla del jugador. */
export function keyLabel(code: string): string {
  const ch = layout?.get(code);
  if (ch && ch.trim()) return ch.length === 1 ? ch.toUpperCase() : ch;
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6).replace('Add', '+').replace('Subtract', '-').replace('Multiply', '*').replace('Divide', '/').replace('Decimal', '.');
  return NAMES[code] ?? code;
}

/** Nombre de la tecla de una acción. */
export function keyName(action: string): string {
  return keyLabel(keyFor(action));
}

/** Sustituye las marcas «{tecla:acción}» de un texto por el nombre de su tecla. */
export function withKeys(text: string): string {
  return text.replace(/\{tecla:([a-zA-Z0-9]+)\}/g, (_, a: string) => keyName(a));
}
