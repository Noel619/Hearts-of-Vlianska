// Emblemas de facción y retratos: sprites generados por código (src/gfx).
import type { FactionId, PortraitParams } from '../../game/types';
import { emblemURL } from '../../gfx/emblems';
import { portraitURL } from '../../gfx/portraits';
import { useSprite } from '../../gfx/queue';
import { medalURL, type MedalShape, type Metal } from '../../gfx/medallions';
import { Icon } from './core';
import { eventSceneURL } from '../../gfx/scenes/events';

export function Emblem({ faction, size = 40, className, ring }: { faction: FactionId | null; size?: number; className?: string; ring?: string }) {
  return (
    <img
      src={emblemURL(faction)}
      width={size}
      height={size}
      className={className ? `emblem ${className}` : 'emblem'}
      style={ring ? { borderRadius: '50%', boxShadow: `0 0 0 2px ${ring}` } : undefined}
      alt=""
      draggable={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Retratos (pintados por código en src/gfx/portraits.ts)
// ---------------------------------------------------------------------------

export function Portrait({ p, size = 96, className }: { p: PortraitParams; size?: number; className?: string }) {
  const key = `portrait-${JSON.stringify(p)}`;
  const url = useSprite(key, () => portraitURL(p));
  const style = { width: size, height: size * 1.2 };
  if (!url) return <div className={className ? `portrait portrait-loading ${className}` : 'portrait portrait-loading'} style={{ ...style, background: `linear-gradient(180deg, ${p.accent}55, #0c0e0d)` }} aria-hidden />;
  return <img src={url} className={className ? `portrait ${className}` : 'portrait'} style={style} alt="" draggable={false} />;
}

// ---------------------------------------------------------------------------
// Medallas (enfoques, tecnologías, decisiones, espíritus)
// ---------------------------------------------------------------------------

export function Medal({ icon, shape, color, metal = 'brass', size = 48, className }: { icon: string; shape: MedalShape; color: string; metal?: Metal; size?: number; className?: string }) {
  const url = useSprite(`medal-${icon}-${shape}-${color}-${metal}`, () => medalURL(icon, shape, color, metal, 128));
  const cls = className ? `medal ${className}` : 'medal';
  if (!url) {
    return (
      <span className={`${cls} medal-loading`} style={{ width: size, height: size }} aria-hidden>
        <Icon name={icon} size={Math.round(size * 0.5)} />
      </span>
    );
  }
  return <img src={url} width={size} height={size} className={cls} alt="" draggable={false} />;
}

// ---------------------------------------------------------------------------
// Ilustraciones de eventos
// ---------------------------------------------------------------------------

export function EventScene({ picture, from, player }: { picture: string; from: FactionId | null; player: FactionId | null }) {
  const url = useSprite(`scene-${picture}-${from ?? ''}-${player ?? ''}`, () => eventSceneURL(picture, from, player));
  if (!url) {
    return (
      <span className="event-scene event-scene-loading" aria-hidden>
        <Icon name={picture} size={60} strokeWidth={1.4} />
      </span>
    );
  }
  return <img src={url} className="event-scene" alt="" draggable={false} />;
}
