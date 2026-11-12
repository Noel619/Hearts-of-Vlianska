// Punto de entrada. Con ?view se abre el visor de desarrollo del mundo.
import '@fontsource/big-shoulders-stencil-display/600.css';
import '@fontsource/big-shoulders-stencil-display/700.css';
import '@fontsource/pt-sans/400.css';
import '@fontsource/pt-sans/700.css';
import '@fontsource/pt-sans-narrow/400.css';
import '@fontsource/pt-sans-narrow/700.css';
import '@fontsource/pt-mono/400.css';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';

const root = document.getElementById('root')!;
if (new URLSearchParams(location.search).has('view')) {
  void import('./dev/viewer').then((m) =>
    m.startViewer(root).catch((e) => {
      console.error(e);
      root.textContent = String(e?.stack ?? e);
    }),
  );
} else {
  createRoot(root).render(<App />);
}
