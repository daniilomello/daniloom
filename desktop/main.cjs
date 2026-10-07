const { app, BrowserWindow, Menu, dialog, desktopCapturer, globalShortcut, ipcMain, powerSaveBlocker, session, shell, systemPreferences, Tray, nativeImage, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { createDesktopServer } = require('./server.cjs');
const { RecordingStore } = require('./recordings.cjs');
const { createCapturePicker } = require('./capture-picker.cjs');
const { createPermissionRequester } = require('./permissions.cjs');
const { promisify } = require('node:util');
const execFile = promisify(require('node:child_process').execFile);
let permissionReady = Promise.resolve();
const { localOrigin, webOrigin, authOrigin, port } = require('./config.cjs');

app.setName('Daniloom');
let mainWindow;
let controls;
let tray;
let capturePicker;
let localServer;
let recordings;
let blocker;
let quitting = false;
let widgetMode = false;
let dockVisible = true;
let preferencesPath;
function showStudio() {
  widgetMode = false;
  mainWindow.show(); mainWindow.focus();
  if (!recordingState.recording) controls.hide();
}
function showWidget() {
  widgetMode = true;
  mainWindow.hide(); controls.show(); controls.focus();
}
async function setDockVisible(value) {
  dockVisible = value === true;
  if (process.platform === 'darwin') {
    if (dockVisible) await app.dock.show(); else app.dock.hide();
  }
  fs.writeFileSync(preferencesPath, JSON.stringify({ dockVisible }));
  updateTray();
}
let recordingState = { recording: false, paused: false, duration: 0 };

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus(); });
  app.whenReady().then(start).catch((error) => {
    dialog.showErrorBox('Não foi possível abrir o Daniloom', error.message);
    app.quit();
  });
}

function isTrusted(event, allowControls = false) {
  const contents = event.sender;
  return (contents === mainWindow?.webContents || (allowControls && contents === controls?.webContents))
    && event.senderFrame === contents.mainFrame
    && new URL(event.senderFrame.url).origin === localOrigin;
}
function handle(channel, callback, allowControls = false) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrusted(event, allowControls)) throw new Error('Origem não autorizada.');
    return callback(...args);
  });
}
function sendAction(action) {
  if (!['toggle', 'stop', 'split', 'restart', 'cancel', 'screen', 'window', 'area'].includes(action)) throw new Error('Ação inválida.');
  if (['screen', 'window', 'area'].includes(action)) {
    if (recordingState.recording || recordingState.finalizing || recordingState.countdown != null) return;
    if (!widgetMode) { mainWindow.show(); mainWindow.focus(); }
    if (new URL(mainWindow.webContents.getURL()).pathname !== '/') {
      mainWindow.loadURL(localOrigin).then(() => setTimeout(() => mainWindow.webContents.send('desktop:action', action), 500));
      return;
    }
  }
  mainWindow?.webContents.send('desktop:action', action);
}
function protectWindow(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== localOrigin) {
      event.preventDefault();
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    }
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
}

function updateTray() {
  if (!tray) return;
  tray.setTitle(recordingState.recording ? (recordingState.paused ? 'Ⅱ' : '●') : '');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Abrir Daniloom', click: showStudio },
    { label: 'Modo widget', click: showWidget },
    { label: 'Mostrar no Dock', type: 'checkbox', checked: dockVisible, click: item => void setDockVisible(item.checked) },
    { type: 'separator' },
    { label: 'Gravar tela inteira', enabled: !recordingState.recording, click: () => sendAction('screen') },
    { label: 'Gravar janela', enabled: !recordingState.recording, click: () => sendAction('window') },
    { label: 'Gravar área selecionada…', enabled: !recordingState.recording, click: () => sendAction('area') },
    { type: 'separator' },
    { label: recordingState.paused ? 'Continuar gravação' : 'Pausar gravação', enabled: recordingState.recording, click: () => sendAction('toggle') },
    { label: 'Parar e salvar', enabled: recordingState.recording, click: () => sendAction('stop') },
    { type: 'separator' }, { role: 'quit', label: 'Sair do Daniloom' },
  ]));
}

async function start() {
  preferencesPath = path.join(process.env.DANILOOM_SMOKE_TEST === '1' ? app.getPath('temp') : app.getPath('userData'), process.env.DANILOOM_SMOKE_TEST === '1' ? 'daniloom-smoke-preferences.json' : 'desktop-preferences.json');
  if (process.env.DANILOOM_SMOKE_TEST !== '1') {
    try { dockVisible = JSON.parse(fs.readFileSync(preferencesPath, 'utf8')).dockVisible !== false; } catch {}
  }
  recordings = new RecordingStore(process.env.DANILOOM_SMOKE_TEST === '1'
    ? path.join(app.getPath('temp'), 'daniloom-smoke-recordings')
    : path.join(app.getPath('videos'), 'Daniloom'));
  await recordings.organizeLegacy();
  localServer = createDesktopServer({ dist: app.isPackaged ? path.join(process.resourcesPath, 'ui') : path.join(__dirname, '../dist'), webOrigin, authOrigin, port });
  await new Promise((resolve, reject) => {
    localServer.server.once('error', reject);
    localServer.server.listen(port, '127.0.0.1', resolve);
  });
  const desktopSession = session.fromPartition(process.env.DANILOOM_SMOKE_TEST === '1' ? 'daniloom-smoke' : 'persist:daniloom');
  desktopSession.setPermissionCheckHandler((contents, permission, origin) => {
    return [mainWindow?.webContents, controls?.webContents].includes(contents)
      && origin === localOrigin && ['media', 'display-capture', 'fullscreen', 'clipboard-sanitized-write'].includes(permission);
  });
  desktopSession.setPermissionRequestHandler(async (contents, permission, callback, details) => {
    if (process.env.DANILOOM_SMOKE_TEST === '1') { callback(false); return; }
    if (contents !== mainWindow?.webContents || new URL(contents.getURL()).origin !== localOrigin || !['media', 'display-capture', 'fullscreen', 'clipboard-sanitized-write'].includes(permission)) {
      callback(false); return;
    }
    try {
      if (process.platform === 'darwin' && permission === 'media') {
        await permissionReady;
        for (const kind of details.mediaTypes || []) {
          const type = kind === 'video' ? 'camera' : kind === 'audio' ? 'microphone' : null;
          if (type && systemPreferences.getMediaAccessStatus(type) !== 'granted') { callback(false); return; }
        }
      }
      callback(true);
    } catch { callback(false); }
  });
  capturePicker = createCapturePicker({ origin: localOrigin, session: desktopSession, parent: () => widgetMode ? controls : mainWindow,
    menuPresenter: process.env.DANILOOM_SMOKE_TEST === '1' ? () => {} : undefined,
    sourceProvider: process.env.DANILOOM_SMOKE_TEST === '1' ? async () => [{ id: 'screen:smoke:0', name: 'Tela de teste', display_id: String(screen.getPrimaryDisplay().id), thumbnail: nativeImage.createFromPath(path.join(app.isPackaged ? path.join(process.resourcesPath, 'ui') : path.join(__dirname, '../dist'), 'pwa-192x192.png')) }] : undefined,
  });
  desktopSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!request.frame || request.frame !== mainWindow?.webContents.mainFrame || new URL(request.frame.url).origin !== localOrigin) { callback({}); return; }
    try {
      await permissionReady;
      const source = await capturePicker.choose();
      if (!source || request.frame.isDestroyed()) { callback({}); return; }
      callback({ video: source, ...(request.audioRequested && ['darwin', 'win32'].includes(process.platform) ? { audio: 'loopback' } : {}) });
    } catch (error) {
      console.warn('Seleção de captura:', error.message);
      callback({});
    }
  }, { useSystemPicker: false });

  const webPreferences = { preload: path.join(__dirname, 'preload.cjs'), session: desktopSession, nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false };
  mainWindow = new BrowserWindow({ width: 1440, height: 960, minWidth: 1000, minHeight: 700, backgroundColor: '#0c0d0f', title: 'Daniloom', webPreferences });
  controls = new BrowserWindow({ width: 460, height: 64, resizable: false, minimizable: false, maximizable: false, frame: false, alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#0c0d0f', webPreferences });
  controls.setContentProtection(true);
  controls.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
  protectWindow(mainWindow);
  protectWindow(controls);
  controls.on('close', (event) => { if (!quitting) { event.preventDefault(); controls.hide(); } });
  mainWindow.on('close', (event) => {
    if (recordingState.recording || recordings.sessions.size) { event.preventDefault(); mainWindow.minimize(); }
    else if (!quitting) { event.preventDefault(); mainWindow.hide(); }
  });
  const requestPermissions = createPermissionRequester({
    preferences: systemPreferences,
    nativeRequest: async () => {
      const helper = app.isPackaged ? path.join(process.resourcesPath, 'permissions-helper') : path.join(__dirname, '../assets/permissions-helper');
      const { stdout } = await execFile(helper, ['--request'], { maxBuffer: 4096 });
      return JSON.parse(stdout);
    },
  });
  handle('desktop:permissions', async () => {
    if (process.platform !== 'darwin' || process.env.DANILOOM_SMOKE_TEST === '1') return;
    const status = await requestPermissions();
    const denied = [status.camera !== 'granted' && 'Câmera', status.microphone !== 'granted' && 'Microfone', !status.screen && 'Tela'].filter(Boolean);
    const result = await dialog.showMessageBox(mainWindow, {
      title: 'Permissões do Daniloom',
      message: denied.length ? `Permissões pendentes: ${denied.join(', ')}` : 'Câmera, microfone e tela estão autorizados.',
      detail: 'O áudio do sistema é autorizado separadamente pelo macOS. Você pode revisar todas as permissões nos Ajustes de Privacidade e Segurança.',
      buttons: ['Abrir Ajustes', 'Fechar'], defaultId: 1, cancelId: 1,
    });
    if (result.response === 0) await shell.openExternal('x-apple.systempreferences:com.apple.preference.security');
  });
  handle('desktop:capture-mode', mode => capturePicker.setMode(mode));
  handle('desktop:capture-region', () => capturePicker.getRegion());
  handle('desktop:authorize', (scope) => localServer.beginAuth(scope, (url) => shell.openExternal(url)).then((credential) => {
    mainWindow.show(); mainWindow.focus(); return credential;
  }));
  handle('desktop:browser', (pathname = '/') => {
    if (typeof pathname !== 'string' || !/^\/(?!\/)/.test(pathname)) throw new Error('Caminho inválido.');
    const target = new URL(pathname, authOrigin);
    if (target.origin !== authOrigin) throw new Error('Origem inválida.');
    return shell.openExternal(target.href);
  });
  handle('desktop:recordings', async () => {
    await require('node:fs/promises').mkdir(recordings.directory, { recursive: true });
    return shell.openPath(recordings.directory);
  });
  handle('desktop:begin', (mime, project) => {
    if (typeof mime !== 'string' || !/^video\/(mp4|webm)(;|$)/.test(mime)) throw new Error('Formato inválido.');
    return recordings.begin(mime, project);
  });
  handle('desktop:append', (id, bytes) => recordings.append(id, bytes));
  handle('desktop:finish', async (id, discard) => {
    recordingState.finalizing = discard !== true;
    controls.webContents.send('desktop:state', recordingState);
    return recordings.finish(id, discard === true);
  });
  const deviceKind = kind => { if (!['camera', 'microphone'].includes(kind)) throw new Error('Dispositivo inválido.'); };
  handle('desktop:device-toggle', kind => {
    deviceKind(kind);
    if (recordingState.recording && !recordingState.waiting) return;
    mainWindow.webContents.send('desktop:device', { kind });
  }, true);
  handle('desktop:device-menu', kind => {
    deviceKind(kind);
    if (recordingState.recording && !recordingState.waiting) return;
    const devices = recordingState.devices;
    if (!devices) return;
    const list = kind === 'camera' ? devices.cameras : devices.microphones;
    const selected = kind === 'camera' ? devices.selectedCamera : devices.selectedMicrophone;
    Menu.buildFromTemplate([
      { label: 'Desativado', type: 'checkbox', checked: !devices[kind], click: () => mainWindow.webContents.send('desktop:device', { kind, id: 'off' }) },
      { label: 'Padrão do sistema', type: 'checkbox', checked: devices[kind] && !selected || devices[kind] && selected === 'default', click: () => mainWindow.webContents.send('desktop:device', { kind, id: 'default' }) },
      ...list.filter(device => device.id !== 'default').map(device => ({ label: device.label, type: 'checkbox', checked: devices[kind] && selected === device.id, click: () => mainWindow.webContents.send('desktop:device', { kind, id: device.id }) })),
    ]).popup({ window: controls });
  }, true);
  handle('desktop:widget', showWidget, true);
  handle('desktop:studio', showStudio, true);
  handle('desktop:clip-ready', (continueSession) => {
    recordingState.finalizing = false;
    controls.webContents.send('desktop:state', recordingState);
    if (widgetMode && continueSession !== true) showStudio();
  });
  handle('desktop:state', async (state) => {
    recordingState = { ...recordingState, recording: state.recording === true, paused: state.paused === true, duration: Math.max(0, Math.floor(Number(state.duration) || 0)), waiting: state.waiting === true, devices: state.devices, countdown: Number.isInteger(state.countdown) ? state.countdown : null };
    controls.webContents.send('desktop:state', recordingState);
    updateTray();
    if (recordingState.recording) {
      if (blocker === undefined) blocker = powerSaveBlocker.start('prevent-display-sleep');
      controls.showInactive();
    } else {
      if (widgetMode) controls.showInactive(); else controls.hide();
      if (blocker !== undefined) { powerSaveBlocker.stop(blocker); blocker = undefined; }
    }
  });
  handle('desktop:get-state', () => recordingState, true);
  handle('desktop:action', sendAction, true);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Daniloom', submenu: [{ role: 'about' }, { type: 'separator' }, { label: 'Abrir no navegador', click: () => shell.openExternal(webOrigin) }, { label: 'Gravações no Finder', click: () => shell.openPath(recordings.directory) }, { type: 'separator' }, { role: 'quit' }] },
    { role: 'editMenu' },
    { label: 'Gravação', submenu: [{ label: 'Gravar / pausar / continuar', click: () => sendAction('toggle') }, { label: 'Parar gravação', click: () => sendAction('stop') }, { label: 'Mostrar controles', click: () => recordingState.recording && controls.showInactive() }] },
    { role: 'viewMenu' }, { role: 'windowMenu' },
  ]));
  const uiPath = app.isPackaged ? path.join(process.resourcesPath, 'ui') : path.join(__dirname, '../dist');
  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular');
    if (dockVisible) await app.dock.show(); else app.dock.hide();
    app.dock.setIcon(nativeImage.createFromPath(path.join(uiPath, 'desktop-icon.png')));
  }
  const trayIcon = nativeImage.createFromPath(path.join(uiPath, 'trayTemplate.png'));
  trayIcon.setTemplateImage(true);
  tray = new Tray(trayIcon);
  tray.setToolTip('Daniloom · gravação rápida');
  updateTray();
  app.on('activate', showStudio);
  const shortcuts = [['CommandOrControl+Alt+Shift+R', 'toggle'], ['CommandOrControl+Alt+Shift+S', 'stop']];
  for (const [shortcut, action] of shortcuts) {
    if (!globalShortcut.register(shortcut, () => sendAction(action))) console.warn(`Atalho indisponível: ${shortcut}`);
  }
  if (process.platform === 'darwin' && process.env.DANILOOM_SMOKE_TEST !== '1') {
    permissionReady = requestPermissions().catch(error => {
      console.warn('Permissões nativas:', error.message);
      dialog.showErrorBox('Permissões do Daniloom', 'Não foi possível solicitar todas as permissões. Use o ícone de permissões no Workspace para tentar novamente.');
    });
  }
  await Promise.all([mainWindow.loadURL(localOrigin), controls.loadURL(`${localOrigin}/desktop-controls`)]);
  if (process.env.DANILOOM_SMOKE_TEST === '1') {
    setTimeout(async () => {
      try {
        const state = await mainWindow.webContents.executeJavaScript('({ desktop: !!window.daniloomDesktop, text: document.body.innerText.slice(0, 800), theme: document.documentElement.className })');
        if (!state.desktop || !state.text.includes('Workspace') || state.text.includes('cópia local em disco')) throw new Error('A interface desktop não carregou.');
        const media = await mainWindow.webContents.executeJavaScript(`(async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 64; canvas.height = 64;
          const context = canvas.getContext('2d');
          context.fillStyle = '#4f5ac4'; context.fillRect(0, 0, 64, 64);
          const stream = canvas.captureStream(10);
          const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
          const chunks = [];
          recorder.ondataavailable = event => chunks.push(event.data);
          const stopped = new Promise(resolve => recorder.onstop = resolve);
          recorder.start(100);
          await new Promise(resolve => setTimeout(resolve, 400));
          recorder.stop(); await stopped;
          stream.getTracks().forEach(track => track.stop());
          const blob = new Blob(chunks, { type: 'video/webm' });
          const id = await window.daniloomDesktop.beginRecording(blob.type);
          for (const chunk of chunks) await window.daniloomDesktop.appendRecording(id, await chunk.arrayBuffer());
          const file = await window.daniloomDesktop.finishRecording(id);
          return { file, size: blob.size };
        })()`);
        const disk = await require('node:fs/promises').stat(media.file);
        if (!media.size || disk.size !== media.size) throw new Error('A gravação de teste não foi persistida integralmente.');
        await require('node:fs/promises').unlink(media.file);
        if (process.platform === 'darwin' && !app.dock.isVisible()) throw new Error('O Dock não está visível.');
        if (!tray || tray.isDestroyed()) throw new Error('O menu da barra superior não foi criado.');
        await setDockVisible(false);
        showWidget();
        if (mainWindow.isVisible() || !controls.isVisible() || app.dock?.isVisible() || tray.isDestroyed()) throw new Error('Modo widget sem Dock falhou.');
        await mainWindow.webContents.executeJavaScript('window.daniloomDesktop.recordingComplete()');
        if (!mainWindow.isVisible() || widgetMode || app.dock?.isVisible()) throw new Error('Retorno ao Studio falhou.');
        await setDockVisible(true);
        await mainWindow.webContents.executeJavaScript(`(() => {
          const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
          canvas.getContext('2d').fillRect(0, 0, 640, 360);
          window.smokeCanvas = canvas;
          let frame = 0;
          setInterval(() => { const context = canvas.getContext('2d'); context.fillStyle = 'hsl(' + (frame++ % 360) + ', 60%, 50%)'; context.fillRect(0, 0, 640, 360); }, 50);
          localStorage.setItem('daniloom_active_project_id', 'smoke-project');
          localStorage.setItem('daniloom_active_project_name', 'Projeto de teste');
          navigator.mediaDevices.getDisplayMedia = async () => canvas.captureStream(15);
        })()`);
        await controls.webContents.executeJavaScript("window.daniloomDesktop.toggleDevice('microphone')");
        const waitState = async predicate => {
          for (let attempt = 0; attempt < 150; attempt++) {
            if (predicate()) return;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          throw new Error('Transição de gravação do widget não foi concluída.');
        };
        showWidget(); sendAction('screen');
        await waitState(() => recordingState.recording && !recordingState.paused);
        await new Promise(resolve => setTimeout(resolve, 600));
        sendAction('split');
        await waitState(() => recordingState.waiting && recordingState.paused && !recordingState.finalizing);
        await new Promise(resolve => setTimeout(resolve, 200));
        if (!widgetMode || !controls.isVisible() || mainWindow.isVisible()) throw new Error('Encerrar clipe abriu o Studio antes da hora.');
        sendAction('toggle');
        await waitState(() => recordingState.recording && !recordingState.paused && !recordingState.waiting);
        await new Promise(resolve => setTimeout(resolve, 600));
        sendAction('restart');
        await waitState(() => !recordingState.recording);
        await waitState(() => recordingState.recording && !recordingState.paused);
        await new Promise(resolve => setTimeout(resolve, 600));
        sendAction('split');
        await waitState(() => recordingState.waiting && !recordingState.finalizing);
        await new Promise(resolve => setTimeout(resolve, 200));
        sendAction('stop');
        await waitState(() => !recordingState.recording && mainWindow.isVisible());
        const projectFiles = (await require('node:fs/promises').readdir(recordings.directory, { withFileTypes: true })).filter(entry => entry.isDirectory() && entry.name.startsWith('Projeto de teste--'));
        if (projectFiles.length !== 1 || (await require('node:fs/promises').readdir(path.join(recordings.directory, projectFiles[0].name))).filter(name => /\.(mp4|webm)$/.test(name)).length < 2) throw new Error('Os clipes não foram salvos na pasta do projeto: ' + JSON.stringify({ directory: recordings.directory, folders: await require('node:fs/promises').readdir(recordings.directory), projectFiles, storage: await mainWindow.webContents.executeJavaScript("({id: localStorage.getItem('daniloom_active_project_id'), name: localStorage.getItem('daniloom_active_project_name')})") }));
        const clipLabels = await mainWindow.webContents.executeJavaScript("document.body.innerText");
        if (!clipLabels.includes('Clipe 1') || !clipLabels.includes('Clipe 2') || clipLabels.includes('Clipe 3')) throw new Error('Os dois clipes da sessão não foram preservados corretamente.');
        showWidget(); sendAction('screen');
        await waitState(() => recordingState.recording && !recordingState.paused);
        await new Promise(resolve => setTimeout(resolve, 600));
        sendAction('cancel');
        await waitState(() => !recordingState.recording && recordings.sessions.size === 0);
        if (!widgetMode || !controls.isVisible()) throw new Error('Cancelar fechou o widget.');
        showStudio();

        const picked = capturePicker.choose();
        const waitWindow = async (getWindow) => {
          for (let attempt = 0; attempt < 30; attempt++) {
            const window = getWindow();
            if (window && !window.webContents.isLoading()) return window;
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          throw new Error('O seletor de captura não carregou.');
        };
        for (let attempt = 0; !capturePicker.getMenu() && attempt < 30; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
        const menu = capturePicker.getMenu();
        if (!menu || !menu.items.some(item => item.label === 'Desktop') || !menu.items.some(item => item.label === 'Selecionar área…')) throw new Error('Opções do dropdown ausentes.');
        menu.items.find(item => item.label === 'Selecionar área…').click();
        const areaWindow = await waitWindow(() => capturePicker.getWindows().overlays[0]);
        await new Promise(resolve => setTimeout(resolve, 200));
        areaWindow.webContents.sendInputEvent({ type: 'mouseDown', x: 40, y: 100, button: 'left', clickCount: 1 });
        areaWindow.webContents.sendInputEvent({ type: 'mouseMove', x: 300, y: 280 });
        areaWindow.webContents.sendInputEvent({ type: 'mouseUp', x: 300, y: 280, button: 'left', clickCount: 1 });
        const selected = await Promise.race([picked, new Promise((_, reject) => setTimeout(() => reject(new Error('Seleção de área não foi concluída.')), 3000))]);
        if (selected?.id !== 'screen:smoke:0' || !capturePicker.getRegion()?.width) throw new Error('Recorte não foi aplicado.');
        const screenshot = await mainWindow.webContents.capturePage();
        await require('node:fs/promises').writeFile(path.join(app.getPath('temp'), 'daniloom-desktop-smoke.png'), screenshot.toPNG());
        console.log('DANILOOM_DESKTOP_READY', JSON.stringify({ ...state, syntheticRecordingBytes: media.size, projectFolders: true, dock: app.dock?.isVisible(), tray: !tray.isDestroyed(), areaSelected: !!capturePicker.getRegion() }));
      } catch (error) { capturePicker.cancel(); console.error('DANILOOM_DESKTOP_FAILED', error.message); process.exitCode = 1; }
      app.quit();
    }, 2500);
  }
}

app.on('before-quit', (event) => {
  if (quitting) return;
  event.preventDefault();
  if (recordingState.recording || recordings?.sessions.size) {
    mainWindow?.show();
    void dialog.showMessageBox(mainWindow, { title: 'Gravação em andamento', message: 'Pare a gravação antes de sair do Daniloom.', buttons: ['Voltar à gravação'] });
    return;
  }
  quitting = true;
  globalShortcut.unregisterAll();
  localServer?.cancelAuth();
  capturePicker?.cancel();
  tray?.destroy();
  if (blocker !== undefined) powerSaveBlocker.stop(blocker);
  Promise.resolve(recordings?.close()).finally(() => {
    localServer?.server.close();
    app.quit();
  });
});
