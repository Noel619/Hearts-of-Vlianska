// Piezas comunes de la interfaz: contexto del juego, refresco, ventanas,
// barras, iconos de objetos y textos de estado.

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CREATURES } from '../data/criaturas';
import { ROLE_NAMES } from '../data/gente';
import { FACTION_LORE } from '../data/historia/facciones';
import { ITEMS, type ItemDef, type Stack } from '../data/items';
import type { SideId } from '../data/tipos';
import type { Game } from '../game/game';
import { effectiveLook } from '../sim/chars';
import type { Char } from '../sim/types';
import { Emblem } from './sprites/Emblem';
import { Portrait } from './sprites/Portrait';
import { Icon, ItemSprite } from './sprites/Sprite';

export const GameCtx = createContext<Game | null>(null);

export function useGame(): Game {
  const g = useContext(GameCtx);
  if (!g) throw new Error('Sin juego');
  return g;
}

/** Vuelve a pintar el componente cada vez que el juego avisa (unas 6 veces por segundo). */
export function useTick(): number {
  const g = useGame();
  return useSyncExternalStore(g.subscribe, g.getVersion);
}

export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export function sideName(side: SideId, playerName = 'Tu escuadra'): string {
  if (side === 'JUG') return playerName;
  if (side === 'LIB') return 'Gente libre';
  if (side === 'MUT') return 'Criaturas';
  return FACTION_LORE[side].name;
}

export function sideColor(side: SideId, playerColor = 0xd8c27a): string {
  if (side === 'JUG') return hex(playerColor);
  if (side === 'LIB') return '#8a8478';
  if (side === 'MUT') return '#7a2a22';
  return FACTION_LORE[side].color;
}

export function Bar({ v, cls = '', color, style }: { v: number; cls?: string; color?: string; style?: CSSProperties }) {
  return (
    <div className={'bar ' + cls} style={style}>
      <i style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

export function Win({ title, icon, onClose, children, width, cls = '' }: { title: string; icon?: string; onClose?: () => void; children: ReactNode; width?: number | string; cls?: string }) {
  return (
    <div className="shade" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'panel win ' + cls} style={width ? { width } : undefined}>
        <header>
          {icon && <Icon id={icon} size={20} className="hic" />}
          <h2>{title}</h2>
          {onClose && (
            <button className="x" onClick={onClose} aria-label="Cerrar">
              <Icon id="cerrar" size={13} />
            </button>
          )}
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

/** Sprite de un objeto dentro de su hueco (el fondo se tiñe según la clase de objeto). */
export function ItemIcon({ id, size = 34 }: { id: string; size?: number }) {
  const def = ITEMS[id];
  return (
    <span className={'ico k-' + (def?.kind ?? 'varios')} style={{ width: size, height: size }}>
      <ItemSprite id={id} size={size - 2} />
    </span>
  );
}

/** Cartuchos: la moneda del metro. */
export function Money({ n, size = 18, cls = '' }: { n: number | string; size?: number; cls?: string }) {
  return (
    <span className={'money ' + cls}>
      <ItemSprite id="cartucho" size={size} />
      {n}
    </span>
  );
}

/** Lista de materiales con su sprite; en rojo lo que falta. */
export function Cost({ items, have }: { items: readonly (readonly [string, number])[]; have?: (id: string) => number }) {
  return (
    <div className="cost">
      {items.map(([id, n]) => {
        const got = have ? have(id) : null;
        return (
          <span key={id} className={'chip' + (got !== null && got < n ? ' no' : '')} title={ITEMS[id]?.name + (got !== null ? ` (tienes ${got})` : '')}>
            <ItemSprite id={id} size={20} />
            {n}
          </span>
        );
      })}
    </div>
  );
}

/** Retrato de un personaje: busto para la gente, insignia para las criaturas. */
export function Face({ c, size = 40, playerColor }: { c: Char; size?: number; playerColor?: number }) {
  const look = c.kind === 'humano' ? effectiveLook(c) : null;
  const down = c.st !== 'ok';
  return (
    <span className={'face' + (down ? ' down' : '') + (c.st === 'muerto' ? ' dead' : '')} style={{ width: size, height: size, ['--ring' as string]: sideColor(c.side, playerColor) }}>
      {look ? <Portrait look={look} size={size - 4} dim={down} /> : <Emblem side="MUT" size={size - 6} />}
    </span>
  );
}

const PART_SHAPES = [
  // cabeza, pecho, abdomen, brazo izq., brazo der., pierna izq., pierna der. (el muñeco mira al jugador)
  'M30 3 Q39 3 39 13 Q39 22 30 23 Q21 22 21 13 Q21 3 30 3 Z',
  'M17 27 Q30 23 43 27 L45 48 Q30 51 15 48 Z',
  'M15.6 50.4 Q30 53.4 44.4 50.4 L46 66 Q30 70 14 66 Z',
  'M45.4 27.6 Q53 29 54 37 L57.6 66 Q55.6 70 51.6 68 L47.6 44 Z',
  'M14.6 27.6 Q7 29 6 37 L2.4 66 Q4.4 70 8.4 68 L12.4 44 Z',
  'M31.6 69.6 Q39 70 46 68.4 L45 116 Q39.6 119 35.6 116 Z',
  'M28.4 69.6 Q21 70 14 68.4 L15 116 Q20.4 119 24.4 116 Z',
];

function partColor(v: number): string {
  if (v <= 0) return '#4a1612';
  if (v < 0.25) return '#c8372c';
  if (v < 0.5) return '#d9782a';
  if (v < 0.8) return '#cfb23e';
  return '#6fae5e';
}

/** Muñeco de salud: cada parte del cuerpo se tiñe según su estado; las heridas abiertas laten. */
export function BodyDoll({ c, size = 118, names }: { c: Char; size?: number; names: readonly string[] }) {
  return (
    <svg className="doll" width={(size * 60) / 120} height={size} viewBox="0 0 60 120">
      {PART_SHAPES.map((d, i) => {
        const v = c.hp[i] / c.hpMax[i];
        const open = c.wound[i] > 0.8;
        return (
          <path key={i} d={d} fill={partColor(v)} className={open ? 'wound' : ''}>
            <title>{`${names[i]}: ${Math.max(0, Math.round(c.hp[i]))}/${c.hpMax[i]}${open ? ' · herida abierta: sangra hasta que se vende' : ''}`}</title>
          </path>
        );
      })}
    </svg>
  );
}

export function itemTip(s: Stack): string {
  const def = ITEMS[s.id];
  if (!def) return s.id;
  const lines = [def.name, def.desc];
  const w = def.weapon;
  if (w) {
    const dmg = [w.cut ? `corte ${w.cut}` : '', w.blunt ? `contusión ${w.blunt}` : '', w.pierce ? `perforación ${w.pierce}` : ''].filter(Boolean).join(' · ');
    lines.push(`Daño: ${dmg}`);
    if (w.ranged) lines.push(`Alcance ${w.ranged.range} m · cargador ${w.ranged.mag}${s.mag !== undefined ? ` (${s.mag} dentro)` : ''} · ruido ${w.ranged.noise} m`);
    else lines.push(`Alcance ${w.reach} m · ${w.speed.toFixed(1)} s por golpe`);
  }
  const a = def.armor;
  if (a && a.cover.length) lines.push(`Protección: corte ${Math.round(a.cut * 100)} % · golpes ${Math.round(a.blunt * 100)} % · balas ${Math.round(a.pierce * 100)} %`);
  if (a?.carry) lines.push(`+${a.carry} kg de carga`);
  if (a?.filter) lines.push('Filtra el aire viciado');
  if (def.food) lines.push(`Alimento: ${def.food}`);
  if (def.med) lines.push(`Cura ${def.med.heal}${def.med.bleed ? ' y corta la hemorragia' : ''}`);
  lines.push(`${def.w} kg · ${def.price} cartuchos`);
  if (s.hot && s.hot !== 'acarreo') lines.push('Robado');
  return lines.join('\n');
}

/** Tooltip que sigue al ratón. Se pinta fuera de los paneles para que no lo recorten. */
export function useTooltip() {
  const [tip, setTip] = useState<{ text: string; item?: string; x: number; y: number } | null>(null);
  const bind = (text: string, item?: string) => ({
    onMouseEnter: (e: React.MouseEvent) => setTip({ text, item, x: e.clientX, y: e.clientY }),
    onMouseMove: (e: React.MouseEvent) => setTip({ text, item, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setTip(null),
  });
  const node = tip
    ? createPortal(
        <div className="tooltip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 330), top: Math.min(tip.y + 18, window.innerHeight - 210) }}>
          {tip.item && (
            <span className={'ico big k-' + (ITEMS[tip.item]?.kind ?? 'varios')}>
              <ItemSprite id={tip.item} size={60} />
            </span>
          )}
          <div>
            {tip.text.split('\n').map((l, i) => (i === 0 ? <b key={i}>{l}</b> : <div key={i} className={i === 1 && tip.item ? 'dim it' : ''}>{l}</div>))}
          </div>
        </div>,
        document.body,
      )
    : null;
  return { bind, node, clear: () => setTip(null) };
}

/** Icono que resume el estado de un personaje. */
export function statusIcon(c: Char): string {
  if (c.st === 'muerto') return 'calavera';
  if (c.st === 'ko') return 'ko';
  if (c.target) return 'agresivo';
  if (c.bleed > 0.05) return 'sangre';
  const o = c.order;
  if (o) {
    switch (o.t) {
      case 'mover':
      case 'seguir':
        return 'seguir';
      case 'atacar':
        return 'atacar';
      case 'curar':
        return 'curar';
      case 'construir':
        return 'construir';
      case 'operar':
        return 'trabajar';
      case 'chatarrear':
        return 'trabajos';
      case 'excavar':
        return 'excavar';
      case 'descansar':
        return 'descansar';
      case 'hablar':
        return 'hablar';
      case 'saquear':
      case 'abrir':
        return 'saquear';
      case 'cargar':
        return 'cargar';
      default:
        return 'reloj';
    }
  }
  if (c.ai.sub === 'cama') return 'descansar';
  if (c.hunger < 20) return 'hambre';
  if (c.jobs.length && c.hasDest) return 'trabajar';
  return c.sneak ? 'sigilo' : 'reloj';
}

/** Qué está haciendo un personaje, en pocas palabras. */
export function statusText(g: Game, c: Char): string {
  if (c.st === 'muerto') return 'Muerto';
  if (c.st === 'ko') return c.bleed > 0.05 ? 'Inconsciente y sangrando' : 'Inconsciente';
  if (c.carriedBy) return 'A hombros';
  if (c.target && (c.atkT >= 0 || c.aim > 0)) return 'Luchando';
  if (c.target) return 'En combate';
  const o = c.order;
  if (o) {
    switch (o.t) {
      case 'mover':
        return 'En marcha';
      case 'atacar':
        return 'Atacando';
      case 'curar':
        return 'Curando';
      case 'construir':
        return 'Construyendo';
      case 'operar':
        return 'Trabajando';
      case 'chatarrear':
        return 'Desguazando';
      case 'excavar':
        return 'Excavando';
      case 'descansar':
        return 'Descansando';
      case 'seguir':
        return 'Siguiendo';
      case 'hablar':
        return 'Va a hablar';
      case 'saquear':
      case 'abrir':
        return 'Registrando';
      case 'cargar':
        return 'Va a cargar';
      default:
        return 'Ocupado';
    }
  }
  if (c.ai.sub === 'cama') return 'En cama';
  if (c.bleed > 0.05) return 'Sangrando';
  if (c.hunger < 20) return 'Hambriento';
  if (c.jobs.length && c.hasDest) return 'De faena';
  void g;
  return c.sneak ? 'Al acecho' : 'A la espera';
}

export function charTitle(c: Char): string {
  if (c.kind !== 'humano') return CREATURES[c.kind]?.name ?? c.kind;
  return c.role ? ROLE_NAMES[c.role] : '';
}

/** Cierra con Escape. */
export function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.stopPropagation();
        fn();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [fn]);
}
