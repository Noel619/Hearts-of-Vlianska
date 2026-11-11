// Punto de entrada.
import { startViewer } from './dev/viewer';

const root = document.getElementById('root')!;
startViewer(root).catch((e) => {
  console.error(e);
  root.textContent = String(e?.stack ?? e);
});
