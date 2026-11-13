// Catálogo de sprites para desarrollo: ?sprites muestra todos los dibujos de
// objetos e iconos a varios tamaños.

import { ITEM_LIST } from '../data/items';
import { Icon, ItemSprite, SpriteSheet } from '../ui/sprites/Sprite';
import { UI_SPRITES } from '../ui/sprites/icons';
import { Emblem } from '../ui/sprites/Emblem';
import { Portrait } from '../ui/sprites/Portrait';
import { DEFAULT_LOOK, type Look } from '../data/looks';
import { FACTION_IDS } from '../data/historia/facciones';
import { TEST_CASES } from './charTest';
import type { SideId } from '../data/tipos';

export function SpriteCatalog() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', background: '#1c1d20', padding: 18, userSelect: 'text' }}>
      <SpriteSheet />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 150px)', gap: 8 }}>
        {[...ITEM_LIST.map((d) => [d.id, d.name]), ['cartucho', 'Cartucho (moneda)']].map(([id, name]) => (
          <div key={id} style={{ background: '#101114', border: '1px solid #34363c', padding: 6, textAlign: 'center', fontSize: 11.5, color: '#d9d4c7' }}>
            <ItemSprite id={id} size={112} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ItemSprite id={id} size={40} />
              <ItemSprite id={id} size={26} />
              <span>{name}</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18, color: '#ffc56b' }}>
        {Object.keys(UI_SPRITES).map((id) => (
          <div key={id} style={{ textAlign: 'center', fontSize: 11, width: 74 }}>
            <Icon id={id} size={44} />
            <div style={{ color: '#8d8a80' }}>{id}</div>
            <Icon id={id} size={18} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
        {([...FACTION_IDS, 'JUG', 'LIB', 'MUT'] as SideId[]).map((id) => (
          <div key={id} style={{ textAlign: 'center' }}>
            <Emblem side={id} size={84} />
            <br />
            <Emblem side={id} size={30} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
        {TEST_CASES.map((c, i) => {
          const look: Look = { ...DEFAULT_LOOK, seed: i * 17 + 3, ...c.look };
          return (
            <div key={i} style={{ background: '#101114', border: '1px solid #34363c', padding: 4 }}>
              <Portrait look={look} size={110} />
              <Portrait look={look} size={40} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
