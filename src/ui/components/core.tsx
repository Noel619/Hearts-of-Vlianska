// Componentes básicos: iconos, tooltips, barras, paneles y modales.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ICONS } from '../iconMap.generated';
import { createUIStore, useVersion } from '../store';
import type { Line } from '../../game/describe';
import { describeMods } from '../../game/modifiers';
import type { Modifiers } from '../../game/types';

// ---------------------------------------------------------------------------
// Iconos
// ---------------------------------------------------------------------------

export function Icon({ name, size = 16, className, style, strokeWidth = 2 }: { name: string; size?: number; className?: string; style?: CSSProperties; strokeWidth?: number }) {
  const C = ICONS[name] ?? ICONS.CircleHelp;
  return <C size={size} className={className} style={style} strokeWidth={strokeWidth} aria-hidden />;
}

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------

type TipContent = ReactNode | (() => ReactNode);
const tipStore = createUIStore<{ content: TipContent | null; x: number; y: number }>({ content: null, x: 0, y: 0 });

// En pantallas táctiles el navegador simula eventos de ratón tras cada toque;
// se ignoran para que los tooltips no se queden abiertos encima de los paneles.
let lastTouch = 0;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') lastTouch = performance.now();
    },
    { capture: true, passive: true },
  );
}
const fromTouch = () => performance.now() - lastTouch < 1200;

export function Tip({ content, children, className, style, as = 'span' }: { content: TipContent; children: ReactNode; className?: string; style?: CSSProperties; as?: 'span' | 'div' }) {
  const timer = useRef<number>(0);
  const handlers = {
    onMouseEnter: (e: React.MouseEvent) => {
      if (!fromTouch()) tipStore.set({ content, x: e.clientX, y: e.clientY });
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!fromTouch()) tipStore.set({ content, x: e.clientX, y: e.clientY });
    },
    onMouseLeave: () => tipStore.set({ content: null }),
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const { clientX, clientY } = e;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => tipStore.set({ content, x: clientX, y: clientY - 40 }), 420);
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      window.clearTimeout(timer.current);
      window.setTimeout(() => tipStore.set({ content: null }), 1800);
    },
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (as === 'div')
    return (
      <div className={className} style={style} {...handlers}>
        {children}
      </div>
    );
  return (
    <span className={className} style={style} {...handlers}>
      {children}
    </span>
  );
}

export function hideTip() {
  tipStore.set({ content: null });
}

export function showTip(content: TipContent, x: number, y: number) {
  tipStore.set({ content, x, y });
}

/** Igual que showTip, pero no hace nada si el «hover» viene de un toque. */
export function showHoverTip(content: TipContent, x: number, y: number) {
  if (!fromTouch()) tipStore.set({ content, x, y });
}

export function TooltipLayer() {
  const tip = tipStore.use();
  useVersion();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = tip.x + 16;
    let top = tip.y + 18;
    if (left + w > window.innerWidth - 8) left = Math.max(8, tip.x - w - 12);
    if (top + h > window.innerHeight - 8) top = Math.max(8, tip.y - h - 12);
    setPos({ left, top });
  }, [tip.x, tip.y, tip.content]);
  if (!tip.content) return null;
  const content = typeof tip.content === 'function' ? (tip.content as () => ReactNode)() : tip.content;
  if (!content) return null;
  return (
    <div className="tooltip" ref={ref} style={{ left: pos.left, top: pos.top }} role="tooltip">
      {content}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Líneas descriptivas (efectos, condiciones, modificadores)
// ---------------------------------------------------------------------------

export function Lines({ lines }: { lines: Line[] }) {
  return (
    <>
      {lines.map((l, i) => {
        const cls = l.met === true ? 'met' : l.met === false ? 'unmet' : l.tone === 'good' ? 'good' : l.tone === 'bad' ? 'bad' : '';
        return (
          <div key={i} className={`tt-line ${cls}`} style={{ paddingLeft: (l.indent ?? 0) * 14 }}>
            {l.met !== undefined && <span>{l.met ? '✓' : '✗'}</span>}
            <span>{l.text}</span>
          </div>
        );
      })}
    </>
  );
}

export function ModLines({ mods }: { mods: Modifiers }) {
  const lines = describeMods(mods);
  if (lines.length === 0) return <div className="dim">Sin efectos.</div>;
  return (
    <>
      {lines.map((l, i) => (
        <div key={i} className={`tt-line ${l.tone === 'good' ? 'good' : l.tone === 'bad' ? 'bad' : ''}`}>
          {l.text}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Barras y valores
// ---------------------------------------------------------------------------

export function Bar({ value, color, thin, className }: { value: number; color?: 'green' | 'red' | 'blue'; thin?: boolean; className?: string }) {
  const w = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`bar ${color ?? ''} ${thin ? 'thin' : ''} ${className ?? ''}`}>
      <span style={{ width: `${w}%` }} />
    </div>
  );
}

export function fmt(v: number, digits = 0): string {
  if (!isFinite(v)) return '—';
  return v.toLocaleString('es-ES', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

export function fmtSigned(v: number, digits = 1): string {
  const s = fmt(Math.abs(v), digits);
  return v > 0.0001 ? `+${s}` : v < -0.0001 ? `−${s}` : s;
}

export function pct(v: number, digits = 0): string {
  return `${fmt(v * 100, digits)} %`;
}

// ---------------------------------------------------------------------------
// Paneles y modales
// ---------------------------------------------------------------------------

export function Panel({ title, icon, onClose, children, className, actions }: { title: string; icon?: string; onClose?: () => void; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`panel ${className ?? ''}`} aria-label={title}>
      <header className="panel-head">
        {icon && <Icon name={icon} size={20} className="amber" />}
        <h2>{title}</h2>
        <div className="panel-actions">
          {actions}
          {onClose && (
            <button className="btn icon ghost" onClick={onClose} aria-label="Cerrar">
              <Icon name="X" size={18} />
            </button>
          )}
        </div>
      </header>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="section">
      <div className="section-head">
        <h3>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Modal({ children, onClose, className, wide }: { children: ReactNode; onClose?: () => void; className?: string; wide?: boolean }) {
  useEffect(() => {
    if (!onClose) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''} ${className ?? ''}`} role="dialog" aria-modal>
        {children}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
