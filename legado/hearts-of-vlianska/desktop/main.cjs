// Versión de escritorio (Electron): abre el juego compilado en dist/ en una ventana propia.
//   npm run desktop      → compila y abre el juego
//   npm run dist:win     → Windows: instalador y ejecutable portable en release/
//   npm run dist:linux   → Linux: AppImage en release/
//   npm run dist:mac     → macOS: imagen .dmg en release/
const { app, BrowserWindow, Menu, ipcMain, net, protocol, screen, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// El juego se sirve desde un protocolo propio: origen estable (las partidas guardadas en
// localStorage no se pierden) y sin las restricciones de file://.
const SCHEME = 'vlianska';
const DIST = path.join(__dirname, '..', 'dist');

protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } }]);

if (!app.requestSingleInstanceLock()) app.quit();

// ---------------------------------------------------------------------------
// Tamaño y posición de la ventana entre sesiones
// ---------------------------------------------------------------------------

const stateFile = () => path.join(app.getPath('userData'), 'ventana.json');

function loadWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    // Solo si sigue cabiendo en alguna pantalla (monitores desconectados, cambios de resolución...).
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea;
      return s.x < a.x + a.width - 100 && s.x + s.width > a.x + 100 && s.y < a.y + a.height - 100 && s.y + s.height > a.y;
    });
    return visible ? s : { maximized: s.maximized, fullscreen: s.fullscreen };
  } catch {
    return null;
  }
}

function saveWindowState(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized(), fullscreen: win.isFullScreen() }));
  } catch {
    /* sin permiso de escritura: se usará el tamaño por defecto */
  }
}

// ---------------------------------------------------------------------------
// Ventana
// ---------------------------------------------------------------------------

let win = null;

function serveGame() {
  protocol.handle(SCHEME, (req) => {
    let rel = decodeURIComponent(new URL(req.url).pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(DIST, rel));
    if (!file.startsWith(DIST + path.sep)) return new Response('Prohibido', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const saved = loadWindowState();
  const area = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    width: saved?.width ?? Math.min(1600, area.width),
    height: saved?.height ?? Math.min(900, area.height),
    x: saved?.x,
    y: saved?.y,
    minWidth: 1024,
    minHeight: 640,
    title: 'Hearts of Vlianska',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#070807',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      // La música empieza en el menú sin esperar al primer clic.
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  // La primera vez, maximizada si la pantalla es pequeña.
  if (saved?.maximized || (!saved && (area.width <= 1600 || area.height <= 900))) win.maximize();
  if (saved?.fullscreen) win.setFullScreen(true);
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveWindowState(win));
  win.on('closed', () => {
    win = null;
  });
  const sendFullscreen = () => win?.webContents.send('vlianska:fullscreen', win.isFullScreen());
  win.on('enter-full-screen', sendFullscreen);
  win.on('leave-full-screen', sendFullscreen);

  // Teclas propias de la versión de escritorio.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      e.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    } else if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      e.preventDefault();
      win.webContents.toggleDevTools();
    }
  });

  // Los enlaces externos se abren en el navegador; la ventana nunca sale del juego.
  const external = (url) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    external(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (url.startsWith(`${SCHEME}://`)) return;
    e.preventDefault();
    external(url);
  });

  void win.loadURL(`${SCHEME}://juego/index.html`);
}

ipcMain.on('vlianska:quit', () => app.quit());
ipcMain.on('vlianska:set-fullscreen', (_e, on) => win?.setFullScreen(!!on));
ipcMain.on('vlianska:is-fullscreen', (e) => {
  e.returnValue = !!win?.isFullScreen();
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  // Sin barra de menús; en macOS se deja el menú mínimo para que funcionen Cmd+Q y copiar/pegar.
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]) : null);
  serveGame();
  createWindow();
  app.on('activate', () => {
    if (!win) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
