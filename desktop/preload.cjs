const { contextBridge, ipcRenderer } = require('electron');
function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
contextBridge.exposeInMainWorld('daniloomDesktop', {
  platform: process.platform,
  deviceMenu: kind => ipcRenderer.invoke('desktop:device-menu', kind),
  toggleDevice: kind => ipcRenderer.invoke('desktop:device-toggle', kind),
  onDevice: callback => subscribe('desktop:device', callback),
  openWidget: () => ipcRenderer.invoke('desktop:widget'),
  openStudio: () => ipcRenderer.invoke('desktop:studio'),
  recordingComplete: continueSession => ipcRenderer.invoke('desktop:clip-ready', continueSession),
  setCaptureMode: mode => ipcRenderer.invoke('desktop:capture-mode', mode),
  getCaptureRegion: () => ipcRenderer.invoke('desktop:capture-region'),
  selectCaptureRegion: region => ipcRenderer.invoke('desktop:select-region', region),
  requestPermissions: () => ipcRenderer.invoke('desktop:permissions'),
  authorize: (scope) => ipcRenderer.invoke('desktop:authorize', scope),
  openBrowser: (pathname) => ipcRenderer.invoke('desktop:browser', pathname),
  openRecordings: () => ipcRenderer.invoke('desktop:recordings'),
  beginRecording: (mimeType, project) => ipcRenderer.invoke('desktop:begin', mimeType, project),
  appendRecording: (id, bytes) => ipcRenderer.invoke('desktop:append', id, bytes),
  finishRecording: (id, discard) => ipcRenderer.invoke('desktop:finish', id, discard),
  setRecordingState: (state) => ipcRenderer.invoke('desktop:state', state),
  action: (action) => ipcRenderer.invoke('desktop:action', action),
  getRecordingState: () => ipcRenderer.invoke('desktop:get-state'),
  onAction: (callback) => subscribe('desktop:action', callback),
  onRecordingState: (callback) => subscribe('desktop:state', callback),
});
