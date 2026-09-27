// Puente entre la ventana de escritorio y el juego (src/ui/video.ts → desktopBridge()).
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Set();
ipcRenderer.on('vlianska:fullscreen', (_e, on) => {
  for (const fn of listeners) fn(!!on);
});

contextBridge.exposeInMainWorld('vlianskaDesktop', {
  platform: process.platform,
  quit: () => ipcRenderer.send('vlianska:quit'),
  setFullscreen: (on) => ipcRenderer.send('vlianska:set-fullscreen', !!on),
  isFullscreen: () => ipcRenderer.sendSync('vlianska:is-fullscreen'),
  onFullscreenChange: (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
});
