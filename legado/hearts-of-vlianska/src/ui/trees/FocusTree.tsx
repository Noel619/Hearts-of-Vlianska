// Árbol de enfoques nacionales a pantalla completa.
import { useEffect, useRef, useState } from 'react';
import { FOCUS_BY_ID, FOCUS_TREES } from '../../data';
import type { FocusDef } from '../../game/types';
import { canBypass, cancelFocus, focusDays, focusDaysLeft, focusSpeed, focusStatus, startFocus, type FocusStatus } from '../../game/focus';
import { describeCondition, describeEffects } from '../../game/describe';
import { Emblem, Medal } from '../components/art';
import { blendCategory } from '../../gfx/medallions';
import { FACTIONS } from '../../data';
import { Bar, Icon, Lines, Tip } from '../components/core';
import { store, ui, useGame } from '../store';

const CELL_W = 152;
const CELL_H = 128;
const NODE_W = 136;
const PAD = 40;
/** Espacio para los nombres de las ramas. */
const HEAD_H = 46;

const STATUS_LABEL: Record<FocusStatus, string> = {
  done: 'Completado',
  current: 'En curso',
  available: 'Disponible',
  locked: 'Bloqueado: faltan requisitos previos',
  excluded: 'Excluido por otra elección',
  blocked: 'No se cumplen los requisitos',
};

export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; l: number; t: number; moved: boolean } | null>(null);
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || !ref.current || e.pointerType === 'touch') return;
      drag.current = { x: e.clientX, y: e.clientY, l: ref.current.scrollLeft, t: ref.current.scrollTop, moved: false };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || !ref.current) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) d.moved = true;
      if (d.moved) {
        ref.current.scrollLeft = d.l - dx;
        ref.current.scrollTop = d.t - dy;
      }
    },
    onPointerUp: () => {
      setTimeout(() => (drag.current = null), 0);
    },
    onPointerLeave: () => {
      drag.current = null;
    },
  };
  const wasDrag = () => !!drag.current?.moved;
  return { ref, handlers, wasDrag };
}

function FocusTooltip({ focus }: { focus: FocusDef }) {
  const state = useGame();
  const f = state.player!;
  const status = focusStatus(state, f, focus.id);
  return (
    <div>
      <h4>{focus.name}</h4>
      <div className="tt-desc">{focus.desc}</div>
      <div className="tt-row">
        <span>Duración</span>
        <span className="num">{Math.ceil(focusDays(focus) / focusSpeed(state, f))} días</span>
      </div>
      <div className={status === 'available' || status === 'done' || status === 'current' ? 'good' : 'bad'}>{STATUS_LABEL[status]}</div>
      {focus.bypass && (
        <>
          <div className="tt-sub">Se omite si</div>
          <Lines lines={describeCondition(focus.bypass, state, { root: f })} />
          {canBypass(state, f, focus) && status === 'available' && <div className="warn">Ya no tiene sentido: al elegirlo se completará al instante, sin efectos.</div>}
        </>
      )}
      {focus.prereq && focus.prereq.length > 0 && (
        <>
          <div className="tt-sub">Requiere</div>
          {focus.prereq.map((group, i) => (
            <div key={i} className={`tt-line ${group.some((p) => state.countries[f].focus.done.includes(p)) ? 'met' : 'unmet'}`}>
              {group.map((p) => FOCUS_BY_ID[p]?.name).join(' o ')}
            </div>
          ))}
        </>
      )}
      {focus.exclusive && focus.exclusive.length > 0 && (
        <>
          <div className="tt-sub">Excluye</div>
          {focus.exclusive.map((x) => (
            <div key={x} className="tt-line">
              {FOCUS_BY_ID[x]?.name}
            </div>
          ))}
        </>
      )}
      {focus.available && (
        <>
          <div className="tt-sub">Disponible si</div>
          <Lines lines={describeCondition(focus.available, state, { root: f })} />
        </>
      )}
      <div className="tt-sub">Efectos</div>
      <Lines lines={describeEffects(focus.effects, state, { root: f })} />
    </div>
  );
}

export function FocusTreeView() {
  const state = useGame();
  const f = state.player!;
  const tree = FOCUS_TREES[f];
  const c = state.countries[f];
  const { ref, handlers, wasDrag } = useDragScroll();
  const [msg, setMsg] = useState<string | null>(null);
  const maxX = Math.max(...tree.focuses.map((x) => x.x));
  const maxY = Math.max(...tree.focuses.map((x) => x.y));
  const width = (maxX + 1) * CELL_W + PAD * 2;
  const height = (maxY + 1) * CELL_H + PAD * 2 + HEAD_H;
  const pos = (focus: FocusDef) => ({ x: PAD + focus.x * CELL_W + (CELL_W - NODE_W) / 2, y: PAD + HEAD_H + focus.y * CELL_H });
  const doneCount = tree.focuses.filter((x) => c.focus.done.includes(x.id)).length;
  // Al abrir, centra la vista en el enfoque en curso o, si no hay, en la raíz del árbol.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = (c.focus.current && tree.focuses.find((x) => x.id === c.focus.current)) || tree.focuses.find((x) => !x.prereq?.length) || tree.focuses[0];
    const p = pos(target);
    el.scrollLeft = Math.max(0, p.x + NODE_W / 2 - el.clientWidth / 2);
    el.scrollTop = Math.max(0, p.y - 120);
    // Solo al abrir el árbol.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const byId = Object.fromEntries(tree.focuses.map((x) => [x.id, x]));
  const current = c.focus.current ? FOCUS_BY_ID[c.focus.current] : null;

  const lines: { d: string; dashed: boolean; done: boolean }[] = [];
  for (const focus of tree.focuses) {
    for (const group of focus.prereq ?? []) {
      for (const pid of group) {
        const parent = byId[pid];
        if (!parent) continue;
        const a = pos(parent);
        const b = pos(focus);
        const x1 = a.x + NODE_W / 2;
        const y1 = a.y + 102;
        const x2 = b.x + NODE_W / 2;
        const y2 = b.y + 4;
        const my = y2 - 18;
        lines.push({ d: `M${x1} ${y1} V${my} H${x2} V${y2}`, dashed: group.length > 1, done: c.focus.done.includes(pid) });
      }
    }
  }
  const exclusives: { x1: number; x2: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const focus of tree.focuses) {
    for (const x of focus.exclusive ?? []) {
      const other = byId[x];
      if (!other || other.y !== focus.y) continue;
      const key = [focus.id, x].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const a = pos(focus);
      const b = pos(other);
      const left = a.x < b.x ? a : b;
      const right = a.x < b.x ? b : a;
      exclusives.push({ x1: left.x + NODE_W / 2 + 36, x2: right.x + NODE_W / 2 - 36, y: a.y + 36 });
    }
  }

  const click = (focus: FocusDef) => {
    if (wasDrag()) return;
    const status = focusStatus(state, f, focus.id);
    if (status !== 'available') {
      setMsg(STATUS_LABEL[status]);
      return;
    }
    if (c.focus.current) {
      setMsg('Ya hay un enfoque en curso. Cancélalo primero si quieres cambiarlo.');
      return;
    }
    store.act((s) => startFocus(s, f, focus.id));
    setMsg(null);
  };

  return (
    <div className="overlay focus-overlay">
      <header className="overlay-head">
        <Emblem faction={f} size={36} />
        <Tip content={<div><h4>{tree.name}</h4>{tree.desc && <div className="tt-desc">{tree.desc}</div>}<div className="dim">{doneCount} de {tree.focuses.length} enfoques completados</div></div>}>
          <div>
            <div className="label">Enfoque nacional · {doneCount}/{tree.focuses.length}</div>
            <h2>{tree.name}</h2>
          </div>
        </Tip>
        <div className="overlay-current">
          {current ? (
            <>
              <Medal icon={current.icon} shape="shield" color={blendCategory(current.icon, FACTIONS[f].color)} size={42} />
              <div className="overlay-current-text">
                <strong>{current.name}</strong>
                <Bar value={c.focus.progress / focusDays(current)} />
                <span className="dim num">{Math.ceil(focusDaysLeft(state, f))} días restantes</span>
              </div>
              <button className="btn small ghost" onClick={() => store.act((s) => cancelFocus(s, f))}>
                Cancelar
              </button>
            </>
          ) : (
            <span className="warn">Elige un enfoque disponible.</span>
          )}
        </div>
        {msg && <span className="overlay-msg">{msg}</span>}
        <button className="btn icon ghost" onClick={() => ui.set({ overlay: null })} aria-label="Cerrar">
          <Icon name="X" size={22} />
        </button>
      </header>
      <div className="tree-scroll" ref={ref} {...handlers}>
        <div className="tree-canvas" style={{ width, height }}>
          {tree.branches?.map((br, i) => (
            <div key={br.name} className={`tree-branch ${i % 2 ? 'odd' : ''}`} style={{ left: PAD + br.x0 * CELL_W, width: (br.x1 - br.x0 + 1) * CELL_W, height: height - 8 }}>
              <Tip content={<div><h4>{br.name}</h4>{br.desc && <div className="tt-desc">{br.desc}</div>}</div>}>
                <span className="tree-branch-name">{br.name}</span>
              </Tip>
            </div>
          ))}
          <svg className="tree-lines" width={width} height={height} aria-hidden>
            {lines.map((l, i) => (
              <path key={i} d={l.d} className={`tree-line ${l.done ? 'done' : ''}`} strokeDasharray={l.dashed ? '6 5' : undefined} />
            ))}
            {exclusives.map((e, i) => (
              <g key={`x${i}`}>
                <path d={`M${e.x1} ${e.y} H${e.x2}`} className="tree-excl" />
                <circle cx={(e.x1 + e.x2) / 2} cy={e.y} r={9} fill="#2a0e09" stroke="#e0614a" strokeWidth={2} />
                <path d={`M${(e.x1 + e.x2) / 2 - 5} ${e.y + 5} L${(e.x1 + e.x2) / 2 + 5} ${e.y - 5}`} stroke="#e0614a" strokeWidth={2} />
              </g>
            ))}
          </svg>
          {tree.focuses.map((focus) => {
            const p = pos(focus);
            const status = focusStatus(state, f, focus.id);
            return (
              <Tip key={focus.id} content={() => <FocusTooltip focus={focus} />} as="div" className="focus-node-wrap" style={{ left: p.x, top: p.y, width: NODE_W }}>
                <button
                  className={`focus-node ${status} ${status === 'available' && canBypass(state, f, focus) ? 'bypass' : ''}`}
                  onClick={() => click(focus)}
                  aria-label={`${focus.name}: ${STATUS_LABEL[status]}`}
                >
                  <span className="focus-icon">
                    <Medal icon={focus.icon} shape="shield" color={blendCategory(focus.icon, FACTIONS[f].color)} metal={status === 'done' ? 'gold' : 'brass'} size={76} />
                    {status === 'done' && <span className="focus-check" aria-hidden />}
                    {status === 'excluded' && <span className="focus-cross" aria-hidden />}
                  </span>
                  <span className="focus-name">{focus.name}</span>
                  {status === 'current' && (
                    <span className="focus-progress">
                      <Bar value={c.focus.progress / focusDays(focus)} thin />
                    </span>
                  )}
                </button>
              </Tip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
