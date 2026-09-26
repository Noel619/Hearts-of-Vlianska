// Emblemas de facción y retratos procedurales en SVG.
import { useId } from 'react';
import { FACTIONS } from '../../data';
import type { FactionId, PortraitParams } from '../../game/types';

const W = 'white';

function EmblemGlyph({ faction }: { faction: FactionId | null }) {
  switch (faction) {
    case 'UNI': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 30 : 12.5;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(`${50 + r * Math.cos(a)},${52 + r * Math.sin(a)}`);
      }
      return <polygon points={pts.join(' ')} fill={W} />;
    }
    case 'SDR':
      return (
        <g stroke={W} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M50 80 V24" />
          <path d="M29 26 V42 Q29 60 50 60 Q71 60 71 42 V26" />
          <path d="M42 70 H58" />
        </g>
      );
    case 'LEV':
      return (
        <g stroke={W} fill="none" strokeLinecap="round">
          <path d="M60 25 A25 25 0 1 1 29 50" strokeWidth={7} />
          <path d="M35 64 L25 75" strokeWidth={8} />
          <path d="M42 42 L66 68" strokeWidth={6} />
          <path d="M33 45 L49 29" strokeWidth={10} strokeLinecap="butt" />
        </g>
      );
    case 'STA':
      return (
        <g fill={W}>
          <rect x={46} y={20} width={9} height={62} />
          <rect x={22} y={41} width={57} height={9} />
        </g>
      );
    case 'VHL':
      return (
        <g stroke={W} fill="none" strokeWidth={6} strokeLinejoin="round" strokeLinecap="round">
          <circle cx={50} cy={51} r={27} />
          <path d="M33 78 L50 20 L67 78" />
          <path d="M26 58 H74" />
        </g>
      );
    case 'CHE':
      return (
        <g stroke={W} strokeLinecap="round" fill={W}>
          <path d="M30 26 L72 70" strokeWidth={7} />
          <path d="M70 26 L28 70" strokeWidth={7} />
          <path d="M64 70 L78 58" strokeWidth={6} />
          <path d="M36 70 L22 58" strokeWidth={6} />
          <circle cx={76} cy={76} r={5} stroke="none" />
          <circle cx={24} cy={76} r={5} stroke="none" />
        </g>
      );
    case 'CAL':
      return (
        <g stroke={W} fill="none" strokeLinecap="round">
          <path d="M24 68 A26 26 0 0 1 76 68" strokeWidth={9} />
          <path d="M37 68 A13 13 0 0 1 63 68" strokeWidth={6} />
          <path d="M20 76 H80" strokeWidth={5} />
        </g>
      );
    case 'NOR':
      return (
        <g stroke={W} fill="none" strokeWidth={6} strokeLinecap="round">
          <circle cx={50} cy={50} r={27} />
          <path d="M39 27 V73 M50 23 V77 M61 27 V73" />
        </g>
      );
    default:
      return (
        <g stroke={W} fill="none" strokeWidth={6} strokeLinecap="round">
          <path d="M31 31 L69 69 M69 31 L31 69" />
        </g>
      );
  }
}

export function Emblem({ faction, size = 40, className, ring }: { faction: FactionId | null; size?: number; className?: string; ring?: string }) {
  const color = faction ? FACTIONS[faction].color : '#1a1a1a';
  const dark = faction ? FACTIONS[faction].colorDark : '#000';
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <radialGradient id={`eg${id}`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      <circle cx={50} cy={50} r={47} fill={`url(#eg${id})`} stroke={ring ?? '#0a0a0a'} strokeWidth={5} />
      <EmblemGlyph faction={faction} />
    </svg>
  );
}

/** Versión sin <defs> para dibujar dentro del mapa (más ligera). */
export function MapEmblem({ faction, x, y, r, ring }: { faction: FactionId | null; x: number; y: number; r: number; ring: string }) {
  const color = faction ? FACTIONS[faction].color : '#171717';
  const k = r / 50;
  return (
    <g transform={`translate(${x - r} ${y - r}) scale(${k})`}>
      <circle cx={50} cy={50} r={46} fill={color} stroke={ring} strokeWidth={8} />
      <EmblemGlyph faction={faction} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Retratos
// ---------------------------------------------------------------------------

const SKIN = ['#f0d0b4', '#d9ab88', '#b98159', '#8a5a3c', '#5e3b26'];
const HAIR = ['#1d1a18', '#3b2618', '#6b4526', '#c9a45c', '#9a9a95', '#a2482a'];
const OUTFIT: Record<PortraitParams['outfit'], { base: string; trim: string }> = {
  military: { base: '#3d4a33', trim: '#29331f' },
  coat: { base: '#40362c', trim: '#2a231c' },
  suit: { base: '#2b2e35', trim: '#1a1c21' },
  rags: { base: '#57503f', trim: '#3b3629' },
  robe: { base: '#3c4a46', trim: '#26302d' },
  leather: { base: '#3a2a20', trim: '#221810' },
};

export function Portrait({ p, size = 96, className }: { p: PortraitParams; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  const skin = SKIN[p.skin] ?? SKIN[1];
  const hair = HAIR[p.hairColor] ?? HAIR[0];
  const out = OUTFIT[p.outfit];
  const female = !!p.female;
  const old = p.age === 'old';
  const headRx = female ? 17 : 18.5;
  const headRy = female ? 21 : 22;
  const hat = p.hat ?? 'none';
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 100 120" className={className} aria-hidden>
      <defs>
        <linearGradient id={`pbg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.accent} stopOpacity={0.55} />
          <stop offset="100%" stopColor="#0c0e0d" />
        </linearGradient>
        <radialGradient id={`plight${id}`} cx="50%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#ffd98a" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#000" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={100} height={120} fill={`url(#pbg${id})`} />
      <rect x={0} y={0} width={100} height={120} fill={`url(#plight${id})`} />
      {/* Hombros */}
      <path d={`M8 120 C10 96 24 86 50 84 C76 86 90 96 92 120 Z`} fill={out.base} />
      <path d="M40 86 L50 104 L60 86" fill={out.trim} />
      {p.outfit === 'military' && <path d="M14 104 L30 96 M86 104 L70 96" stroke="#8c7a4a" strokeWidth={3} />}
      {p.outfit === 'suit' && <path d="M46 88 L50 112 L54 88 Z" fill="#6d2323" />}
      {p.outfit === 'robe' && <path d="M50 86 V120" stroke={out.trim} strokeWidth={3} />}
      {p.medals && (
        <g>
          <circle cx={30} cy={104} r={3.5} fill="#e0b84e" />
          <circle cx={38} cy={106} r={3.5} fill="#c9c9c9" />
          <rect x={27} y={97} width={7} height={4} fill="#b33" />
        </g>
      )}
      {/* Cuello */}
      <rect x={43} y={70} width={14} height={16} fill={skin} />
      <rect x={43} y={78} width={14} height={6} fill="#000" opacity={0.15} />
      {/* Pelo largo detrás */}
      {(p.hair === 'long' || p.hair === 'bun') && hat !== 'hood' && (
        <path d={`M${50 - headRx - 3} 50 Q${50 - headRx - 6} 80 ${50 - headRx + 2} 84 L${50 + headRx - 2} 84 Q${50 + headRx + 6} 80 ${50 + headRx + 3} 50 Z`} fill={hair} />
      )}
      {hat === 'hood' && <path d="M24 86 Q22 40 50 24 Q78 40 76 86 Z" fill={out.trim} />}
      {/* Cabeza */}
      <ellipse cx={50} cy={50} rx={headRx} ry={headRy} fill={skin} />
      <ellipse cx={50} cy={58} rx={headRx - 3} ry={headRy - 8} fill="#000" opacity={0.06} />
      {/* Orejas */}
      {hat !== 'hood' && hat !== 'ushanka' && hat !== 'gasmask' && (
        <g fill={skin}>
          <ellipse cx={50 - headRx} cy={52} rx={3} ry={5} />
          <ellipse cx={50 + headRx} cy={52} rx={3} ry={5} />
        </g>
      )}
      {/* Ojos y boca */}
      {hat !== 'gasmask' && (
        <g>
          <ellipse cx={43} cy={50} rx={2.2} ry={1.6} fill="#1b1b1b" />
          {p.eyepatch ? (
            <g>
              <path d="M30 42 L70 36" stroke="#111" strokeWidth={1.6} />
              <ellipse cx={57} cy={50} rx={5} ry={4} fill="#111" />
            </g>
          ) : (
            <ellipse cx={57} cy={50} rx={2.2} ry={1.6} fill="#1b1b1b" />
          )}
          <path d="M39 45 Q43 43 47 45 M53 45 Q57 43 61 45" stroke={hair} strokeWidth={old ? 1.2 : 1.8} fill="none" />
          <path d="M50 52 Q48 58 50 60" stroke="#000" strokeOpacity={0.25} strokeWidth={1.2} fill="none" />
          <path d={female ? 'M45 64 Q50 66 55 64' : 'M44 64 Q50 65.5 56 64'} stroke={female ? '#8a3f3f' : '#5a3a2e'} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          {old && <path d="M38 56 Q40 58 41 60 M62 56 Q60 58 59 60" stroke="#000" strokeOpacity={0.2} strokeWidth={1} fill="none" />}
        </g>
      )}
      {p.scar && <path d="M60 40 L64 58" stroke="#8d4b3f" strokeWidth={1.4} />}
      {/* Vello facial */}
      {p.facial === 'mustache' && <path d="M42 61 Q50 57 58 61 Q50 60 42 61 Z" fill={hair} stroke={hair} strokeWidth={2} />}
      {p.facial === 'stubble' && <path d={`M${50 - headRx + 3} 58 Q50 78 ${50 + headRx - 3} 58 Q50 70 ${50 - headRx + 3} 58 Z`} fill={hair} opacity={0.3} />}
      {(p.facial === 'beard' || p.facial === 'fullbeard') && (
        <path
          d={p.facial === 'fullbeard' ? `M${50 - headRx + 1} 52 Q${50 - headRx} 80 50 82 Q${50 + headRx} 80 ${50 + headRx - 1} 52 Q50 70 ${50 - headRx + 1} 52 Z` : 'M40 62 Q50 78 60 62 Q50 68 40 62 Z'}
          fill={hair}
        />
      )}
      {(p.facial === 'beard' || p.facial === 'fullbeard') && <path d="M42 61 Q50 57 58 61" stroke={hair} strokeWidth={3} fill="none" />}
      {/* Pelo */}
      {hat === 'none' && p.hair === 'short' && <path d={`M${50 - headRx} 46 Q${50 - headRx} 24 50 26 Q${50 + headRx} 24 ${50 + headRx} 46 Q58 32 44 34 Q${50 - headRx + 4} 38 ${50 - headRx} 46 Z`} fill={hair} />}
      {hat === 'none' && p.hair === 'buzz' && <path d={`M${50 - headRx + 1} 42 Q50 22 ${50 + headRx - 1} 42 Q50 32 ${50 - headRx + 1} 42 Z`} fill={hair} opacity={0.85} />}
      {hat === 'none' && (p.hair === 'long' || p.hair === 'bun') && <path d={`M${50 - headRx - 2} 52 Q${50 - headRx - 2} 24 50 25 Q${50 + headRx + 2} 24 ${50 + headRx + 2} 52 Q${50 + headRx - 2} 34 50 34 Q${50 - headRx + 2} 34 ${50 - headRx - 2} 52 Z`} fill={hair} />}
      {hat === 'none' && p.hair === 'bun' && <circle cx={50} cy={22} r={7} fill={hair} />}
      {hat === 'none' && p.hair === 'none' && <ellipse cx={50} cy={32} rx={headRx - 4} ry={4} fill="#fff" opacity={0.12} />}
      {/* Sombreros */}
      {hat === 'ushanka' && (
        <g>
          <path d="M28 44 Q28 20 50 20 Q72 20 72 44 Z" fill="#5a4a3a" />
          <rect x={27} y={36} width={46} height={10} rx={4} fill="#7a6650" />
          <path d="M28 44 L26 66 L34 66 L35 46 Z M72 44 L74 66 L66 66 L65 46 Z" fill="#7a6650" />
          <circle cx={50} cy={40} r={3} fill="#c33" />
        </g>
      )}
      {hat === 'cap' && (
        <g>
          <path d="M29 38 Q30 22 50 21 Q70 22 71 38 Z" fill={p.outfit === 'military' ? '#3b4731' : '#2d3140'} />
          <path d="M30 38 H70 Q66 44 50 44 Q34 44 30 38 Z" fill="#161616" />
          <rect x={30} y={33} width={40} height={5} fill="#7a2525" />
          <circle cx={50} cy={30} r={3.2} fill="#d9b64e" />
        </g>
      )}
      {hat === 'beret' && <path d="M29 38 Q26 22 52 22 Q76 24 71 36 Q50 30 29 38 Z" fill={p.accent} />}
      {hat === 'helmet' && (
        <g>
          <path d="M27 44 Q27 18 50 18 Q73 18 73 44 L78 46 L22 46 Z" fill="#4b5540" />
          <path d="M27 40 H73" stroke="#343c2c" strokeWidth={2} />
        </g>
      )}
      {hat === 'bandana' && (
        <g>
          <path d="M30 40 Q30 24 50 23 Q70 24 70 40 Q50 34 30 40 Z" fill={p.accent} />
          <path d="M68 38 L78 44 L72 48 Z" fill={p.accent} />
        </g>
      )}
      {hat === 'kufi' && <path d="M32 36 Q32 23 50 23 Q68 23 68 36 Q50 32 32 36 Z" fill="#e8e2d0" />}
      {hat === 'gasmask' && (
        <g>
          <path d="M30 40 Q30 22 50 22 Q70 22 70 40 L72 62 Q50 80 28 62 Z" fill="#3a3f37" />
          <circle cx={42} cy={48} r={6} fill="#9fb4a8" stroke="#1c1f1b" strokeWidth={2} />
          <circle cx={58} cy={48} r={6} fill="#9fb4a8" stroke="#1c1f1b" strokeWidth={2} />
          <circle cx={50} cy={66} r={7} fill="#262a24" stroke="#555" strokeWidth={2} />
          <path d="M28 44 L20 40 M72 44 L80 40" stroke="#222" strokeWidth={3} />
        </g>
      )}
      {p.glasses && hat !== 'gasmask' && (
        <g stroke="#222" strokeWidth={1.4} fill="#cfe3ec" fillOpacity={0.18}>
          <circle cx={43} cy={50} r={5} />
          <circle cx={57} cy={50} r={5} />
          <path d="M48 50 H52" />
        </g>
      )}
      <rect x={0.5} y={0.5} width={99} height={119} fill="none" stroke="#000" strokeOpacity={0.6} />
    </svg>
  );
}
