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

// Resuelve cada nombre exportado por lucide-react a su archivo y extrae los
// trazos del icono. Así los iconos se pueden dibujar tanto en el DOM como en
// canvas (medallas, escenas, mapa) sin depender de lucide en tiempo de ejecución.
const LUCIDE = 'node_modules/lucide-react/dist/esm';
const index = readFileSync(join(LUCIDE, 'lucide-react.mjs'), 'utf8');
const fileOf = new Map();
for (const m of index.matchAll(/export \{([^}]+)\} from '\.\/icons\/([a-z0-9-]+)\.mjs'/g)) {
  for (const part of m[1].split(',')) {
    const alias = part.trim().split(/\s+as\s+/)[1];
    if (alias) fileOf.set(alias, m[2]);
  }
}
const nodes = {};
for (const name of sorted) {
  const file = fileOf.get(name);
  if (!file) throw new Error(`Icono desconocido en lucide-react: ${name}`);
  const src = readFileSync(join(LUCIDE, 'icons', `${file}.mjs`), 'utf8');
  const m = src.match(/const __iconData = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error(`No se pudo leer el icono ${name}`);
  const { node } = new Function(`return ${m[1]}`)();
  nodes[name] = node.map(([tag, attrs]) => {
    const { key, ...rest } = attrs;
    void key;
    return [tag, rest];
  });
}
const body = `// Archivo generado por scripts/gen-icons.mjs a partir de lucide (ISC). No editar a mano.
export type IconNode = [string, Record<string, string>];

export const ICON_NODES: Record<string, IconNode[]> = ${JSON.stringify(nodes)};
`;
writeFileSync('src/ui/iconMap.generated.ts', body);
console.log(`iconMap.generated.ts: ${sorted.length} iconos`);
