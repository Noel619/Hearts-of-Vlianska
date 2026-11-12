// Punto de entrada. Con ?view se abre el visor de desarrollo del mundo.
import '@fontsource/big-shoulders-stencil-display/latin-600';
import '@fontsource/big-shoulders-stencil-display/latin-700';
import '@fontsource/pt-sans/latin-400.css';
import '@fontsource/pt-sans/latin-700.css';
import '@fontsource/pt-sans/latin-400-italic.css';
import '@fontsource/pt-sans-narrow/latin-400.css';
import '@fontsource/pt-sans-narrow/latin-700.css';
import '@fontsource/pt-mono/latin-400.css';
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
