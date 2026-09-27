// Emblemas de facción y retratos: sprites generados por código (src/gfx).
import type { FactionId, PortraitParams } from '../../game/types';
import { emblemURL } from '../../gfx/emblems';
import { portraitURL } from '../../gfx/portraits';
import { useSprite } from '../../gfx/queue';

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
