'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  saveFile: (name, content, filters) => ipcRenderer.invoke('save-file', { name, content, filters }),
  savePDF: (name) => ipcRenderer.invoke('save-pdf', { name }),
  info: () => ipcRenderer.invoke('app-info'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen')
});
