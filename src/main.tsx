import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { go, store, ui as uiStore } from './ui/store';
import { deserialize, serialize } from './game/save';
import '@fontsource/big-shoulders-stencil-display/latin-700';
import '@fontsource/big-shoulders-stencil-display/latin-800';
import '@fontsource/pt-sans/latin-400.css';
import '@fontsource/pt-sans/latin-700.css';
import '@fontsource/pt-sans/latin-400-italic.css';
import '@fontsource/pt-sans-narrow/latin-400.css';
import '@fontsource/pt-sans-narrow/latin-700.css';
import '@fontsource/pt-mono/latin-400.css';
import './ui/styles/base.css';
import './ui/styles/layout.css';
import './ui/styles/panels.css';
import './ui/styles/trees.css';
import './ui/styles/screens.css';
import './ui/styles/textures.css';
import { installTextures } from './gfx/textures';
import { mapActivity } from './ui/map/MapView';
import { installAudio } from './audio/hooks';
import { audio } from './audio';
import { installFullscreenKey } from './ui/video';

// Conserva la partida si la página se actualiza en caliente dentro de un Artifact.
interface HotApi {
  snapshot?: (fn: () => unknown) => void;
  ready?: (fn: (data: unknown) => void) => void;
  data?: unknown;
}
const hot = (window as unknown as { claude?: { hot?: HotApi } }).claude?.hot;

// Métricas para depuración desde la consola del navegador
(window as unknown as { __vlianska?: unknown }).__vlianska = { mapActivity, store, ui: uiStore, audio };

function start(data: unknown) {
  installTextures();
  installAudio();
  installFullscreenKey();
  const saved = (data as { game?: string } | undefined)?.game;
  if (saved) {
    try {
      store.setState(deserialize(saved));
      go('game');
    } catch {
      /* partida no recuperable */
    }
  }
  hot?.snapshot?.(() => (store.state ? { game: serialize(store.state) } : {}));
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

if (hot?.ready) hot.ready(start);
else start(hot?.data ?? {});
