// Genera src/ui/iconMap.generated.ts con los iconos de lucide que usa el juego.
// Así el paquete final solo incluye los iconos necesarios.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const UI_ICONS = [
  'Landmark', 'Target', 'Microscope', 'Handshake', 'Scale', 'Hammer', 'Factory', 'Users', 'ScrollText', 'Newspaper',
  'Pause', 'Play', 'Plus', 'Minus', 'Menu', 'X', 'Check', 'ChevronRight', 'ChevronLeft', 'ChevronDown', 'ChevronUp',
  'Save', 'FolderOpen', 'LogOut', 'Settings', 'Volume2', 'VolumeX', 'Info', 'CircleHelp', 'TriangleAlert', 'Trash2',
  'Swords', 'Shield', 'Flag', 'Coins', 'Wheat', 'Store', 'Skull', 'Crosshair', 'Clock', 'Hourglass', 'MapPin', 'Map',
  'Layers', 'Eye', 'EyeOff', 'Move', 'Square', 'Ban', 'Crown', 'Star', 'Package', 'Anvil', 'Fuel', 'FlaskConical',
  'Cog', 'BrickWall', 'Sprout', 'Cable', 'Route', 'Sparkles', 'Download', 'Upload', 'Copy', 'RotateCcw', 'House',
  'BookOpen', 'Gauge', 'Siren', 'Radiation', 'Activity', 'TrendingUp', 'TrendingDown', 'UsersRound', 'Wrench',
  'CircleDollarSign', 'Unplug', 'Waves', 'Pickaxe', 'Flame', 'Mail', 'ArrowRight', 'Maximize', 'Minimize', 'LocateFixed',
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const names = new Set(UI_ICONS);
for (const file of walk('src/data')) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:icon|picture):\s*'([A-Za-z0-9]+)'/g)) names.add(m[1]);
}
const sorted = [...names].sort();
const body = `// Archivo generado por scripts/gen-icons.mjs. No editar a mano.
import { ${sorted.join(', ')} } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = { ${sorted.join(', ')} };
`;
writeFileSync('src/ui/iconMap.generated.ts', body);
console.log(`iconMap.generated.ts: ${sorted.length} iconos`);
