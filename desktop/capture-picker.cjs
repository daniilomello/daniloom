const { BrowserWindow, desktopCapturer, ipcMain, screen, Menu } = require('electron');
const path = require('node:path');
const { captureMenu } = require('./capture-menu.cjs');

function createCapturePicker({ origin, session, parent, sourceProvider, menuPresenter }) {
  let overlays = [];
  let pending;
  let mode = 'choose';
  let region = null;
  let menu = null;
  let selecting = false;
  const trusted = event => overlays.some(window => !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && new URL(event.senderFrame.url).origin === origin);
  const preferences = { preload: path.join(__dirname, 'preload.cjs'), session, nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false };
  const finish = selection => {
    const resolve = pending;
    pending = null;
    const windows = overlays; overlays = [];
    if (menu) { menu.closePopup(); menu = null; }
    for (const window of windows) if (!window.isDestroyed()) window.destroy();
    region = selection?.region || null;
    resolve?.(selection?.source || null);
  };
  const selectArea = async source => {
    selecting = true;
    try {
      const display = screen.getAllDisplays().find(item => String(item.id) === source.display_id);
      if (!display) throw new Error('Tela desconectada. Escolha novamente.');
      const overlay = new BrowserWindow({ ...display.bounds, frame: false, transparent: true, backgroundColor: '#00000000', resizable: false, movable: false, hasShadow: false, skipTaskbar: true, alwaysOnTop: true, show: process.env.DANILOOM_SMOKE_TEST !== '1', enableLargerThanScreen: true, webPreferences: preferences });
      overlays.push(overlay);
      overlay.setAlwaysOnTop(true, 'screen-saver');
      overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
      overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      overlay.webContents.on('will-navigate', event => event.preventDefault());
      overlay.webContents.on('will-attach-webview', event => event.preventDefault());
      overlay.on('closed', () => { if (pending) finish(null); });
      overlay.captureSource = source;
      await overlay.loadURL(`${origin}/desktop-region`);
      if (process.env.DANILOOM_SMOKE_TEST !== '1') { overlay.show(); overlay.focus(); }
    } catch (error) { console.warn('Seleção de área:', error.message); finish(null); }
  };
  ipcMain.handle('desktop:select-region', (event, rect) => {
    if (!trusted(event)) throw new Error('Origem inválida.');
    if (!rect) { finish(null); return; }
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > 1.000001 || rect.y + rect.height > 1.000001) throw new Error('Área inválida.');
    const overlay = overlays.find(window => window.webContents === event.sender);
    finish({ source: overlay.captureSource, region: rect });
  });
  return {
    setMode(value) { if (!['choose', 'screen', 'window', 'area'].includes(value)) throw new Error('Modo inválido.'); mode = value; },
    getRegion() { return region; },
    cancel() { finish(null); },
    getWindows() { return { overlays }; },
    getMenu() { return menu; },
    async choose() {
      if (pending) throw new Error('Já existe uma seleção aberta.');
      region = null;
      const selectedMode = mode; mode = 'choose';
      const sources = await (sourceProvider ? sourceProvider() : desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 }, fetchWindowIcons: false }));
      if (!sources.length) throw new Error('Nenhuma fonte disponível. Verifique a permissão de gravação de tela.');
      return new Promise(resolve => {
        pending = resolve; selecting = false;
        const select = source => { selecting = true; finish({ source }); };
        if (selectedMode === 'area') {
          const displays = sources.filter(source => source.id.startsWith('screen:'));
          if (displays.length === 1) { void selectArea(displays[0]); return; }
        }
        const template = captureMenu(sources, selectedMode === 'area' ? 'screen' : selectedMode, select, source => { void selectArea(source); }, () => finish(null));
        menu = Menu.buildFromTemplate(template);
        const onClose = () => { if (pending && !selecting) finish(null); };
        if (menuPresenter) menuPresenter(menu, onClose);
        else menu.popup({ window: parent(), callback: onClose });
      });
    },
  };
}
module.exports = { createCapturePicker };
