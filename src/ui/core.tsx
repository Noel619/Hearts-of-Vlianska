// Piezas comunes de la interfaz: contexto del juego, refresco, ventanas,
// barras, iconos de objetos y textos de estado.

import { Axe, Backpack, BookOpen, Box, Cross, Crosshair, Drumstick, FlaskConical, Hammer, HardHat, Key, Lightbulb, Shield, Sword, Wrench, type LucideIcon } from 'lucide-react';
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { CREATURES } from '../data/criaturas';
import { ROLE_NAMES } from '../data/gente';
import { FACTION_LORE } from '../data/historia/facciones';
import { ITEMS, type ItemDef, type Stack } from '../data/items';
import type { SideId } from '../data/tipos';
import type { Game } from '../game/game';
import type { Char } from '../sim/types';

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

export function Win({ title, onClose, children, width, cls = '' }: { title: string; onClose?: () => void; children: ReactNode; width?: number | string; cls?: string }) {
  return (
    <div className="shade" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'panel win ' + cls} style={width ? { width } : undefined}>
        <header>
          <h2>{title}</h2>
          {onClose && (
            <button className="x" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          )}
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}

const KIND_ICON: Record<ItemDef['kind'], LucideIcon> = {
  recurso: Box,
  comida: Drumstick,
  medicina: Cross,
  municion: Crosshair,
  arma: Sword,
  armadura: Shield,
  herramienta: Wrench,
  varios: FlaskConical,
  clave: Key,
};

function iconFor(def: ItemDef): LucideIcon {
  if (def.weapon?.ranged) return Crosshair;
  if (def.id === 'hacha') return Axe;
  if (def.id === 'martillo' || def.id === 'pico') return Hammer;
  if (def.armor?.slot === 'mochila') return Backpack;
  if (def.armor?.slot === 'cabeza') return HardHat;
  if (def.light) return Lightbulb;
  if (def.id === 'libros' || def.id === 'planos' || def.id === 'cartaBessmertny') return BookOpen;
  return KIND_ICON[def.kind];
}

const KIND_BG: Record<ItemDef['kind'], string> = {
  recurso: '#2a2620',
  comida: '#2c2a1a',
  medicina: '#1e2a26',
  municion: '#2c2616',
  arma: '#24262b',
  armadura: '#22272a',
  herramienta: '#262422',
  varios: '#26222a',
  clave: '#2e2a14',
};

export function ItemIcon({ id, size = 28 }: { id: string; size?: number }) {
  const def = ITEMS[id];
  if (!def) return <span className="ico" style={{ width: size, height: size }} />;
  const I = iconFor(def);
  const tint = def.tint !== undefined ? hex(def.tint) : def.kind === 'arma' ? '#c9c2b0' : '#b8b0a0';
  return (
    <span className="ico" style={{ width: size, height: size, background: KIND_BG[def.kind] }}>
      <I size={size * 0.62} color={tint} strokeWidth={1.8} />
    </span>
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

/** Tooltip sencillo que sigue al ratón. */
export function useTooltip() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const bind = (text: string) => ({
    onMouseEnter: (e: React.MouseEvent) => setTip({ text, x: e.clientX, y: e.clientY }),
    onMouseMove: (e: React.MouseEvent) => setTip({ text, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => setTip(null),
  });
  const node = tip ? (
    <div className="panel tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 300), top: Math.min(tip.y + 16, window.innerHeight - 160) }}>
      {tip.text.split('\n').map((l, i) => (i === 0 ? <b key={i}>{l}</b> : <div key={i}>{l}</div>))}
    </div>
  ) : null;
  return { bind, node, clear: () => setTip(null) };
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
