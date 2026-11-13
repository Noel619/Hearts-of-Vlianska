// Catálogo de sprites para desarrollo: ?sprites muestra todos los dibujos de
// objetos e iconos a varios tamaños.

import { ITEM_LIST } from '../data/items';
import { Icon, ItemSprite, SpriteSheet } from '../ui/sprites/Sprite';
import { UI_SPRITES } from '../ui/sprites/icons';

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
    </div>
  );
}
