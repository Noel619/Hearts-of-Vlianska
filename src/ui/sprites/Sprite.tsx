// Hoja de sprites: todos los dibujos viven como <symbol> en un único SVG
// oculto y cada icono de la interfaz es un <use> que lo referencia.

import { memo, type CSSProperties } from 'react';
import { ITEM_SPRITES } from './items';
import { UI_SPRITES } from './icons';

const SHEET =
  Object.entries(ITEM_SPRITES)
    .map(([id, body]) => `<symbol id="it-${id}" viewBox="0 0 64 64">${body}</symbol>`)
    .join('') +
  Object.entries(UI_SPRITES)
    .map(([id, body]) => `<symbol id="ui-${id}" viewBox="0 0 32 32">${body}</symbol>`)
    .join('');

/** Se monta una sola vez, en la raíz de la aplicación. */
export const SpriteSheet = memo(function SpriteSheet() {
  return <svg width="0" height="0" style={{ position: 'absolute', overflow: 'hidden' }} aria-hidden dangerouslySetInnerHTML={{ __html: SHEET }} />;
});

export function hasItemSprite(id: string) {
  return id in ITEM_SPRITES;
}

/** Sprite de un objeto del juego. */
export function ItemSprite({ id, size = 32, className = '', style }: { id: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={'spr ' + className} width={size} height={size} viewBox="0 0 64 64" style={style} aria-hidden>
      <use href={`#it-${hasItemSprite(id) ? id : 'chatarra'}`} />
    </svg>
  );
}

/** Icono de la interfaz (monocromo: hereda el color del texto). */
export function Icon({ id, size = 18, className = '', style }: { id: string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg className={'icn ' + className} width={size} height={size} viewBox="0 0 32 32" style={style} aria-hidden>
      <use href={`#ui-${id}`} />
    </svg>
  );
}
