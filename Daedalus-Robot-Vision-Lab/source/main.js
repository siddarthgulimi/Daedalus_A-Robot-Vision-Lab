// DAEDALUS — Robot Vision Lab : Electron main process
'use strict';
const { app, BrowserWindow, protocol, session, ipcMain, dialog, shell, Menu, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_DIR = path.join(__dirname, 'app');

// A privileged custom scheme gives the renderer a secure, stable origin:
// camera access, WebAssembly streaming, ES modules and persistent localStorage all work offline.
protocol.registerSchemesAsPrivileged([
  { scheme: 'daedalus', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.task': 'application/octet-stream',
  '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8'
};

function registerProtocol() {
  protocol.handle('daedalus', async (request) => {
    try {
      const url = new URL(request.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.normalize(path.join(APP_DIR, rel));
      if (!file.startsWith(APP_DIR)) return new Response('Forbidden', { status: 403 });
      const data = await fs.promises.readFile(file);
      return new Response(data, { headers: { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' } });
    } catch (e) {
      return new Response('Not found', { status: 404 });
    }
  });
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700,
    title: 'Daedalus — Robot Vision Lab',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0f17' : '#f4f6fb',
    icon: path.join(APP_DIR, 'assets', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadURL('daedalus://app/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  registerProtocol();
  Menu.setApplicationMenu(null);
  // Camera is the heart of the app: allow media for our own origin only.
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
    const own = (details.requestingUrl || '').startsWith('daedalus://');
    cb(own && (permission === 'media' || permission === 'fullscreen' || permission === 'clipboard-sanitized-write'));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => {
    return (origin || '').startsWith('daedalus://') && (permission === 'media' || permission === 'fullscreen');
  });

  ipcMain.handle('save-file', async (e, { name, content, filters }) => {
    const res = await dialog.showSaveDialog(win, { defaultPath: name, filters: filters || [{ name: 'All files', extensions: ['*'] }] });
    if (res.canceled || !res.filePath) return { ok: false };
    await fs.promises.writeFile(res.filePath, content, 'utf8');
    return { ok: true, path: res.filePath };
  });
  ipcMain.handle('save-pdf', async (e, { name }) => {
    const res = await dialog.showSaveDialog(win, { defaultPath: name, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (res.canceled || !res.filePath) return { ok: false };
    const pdf = await e.sender.printToPDF({ printBackground: true, pageSize: 'A4' });
    await fs.promises.writeFile(res.filePath, pdf);
    return { ok: true, path: res.filePath };
  });
  ipcMain.handle('app-info', () => ({ version: app.getVersion(), platform: process.platform, electron: process.versions.electron, userData: app.getPath('userData') }));
  ipcMain.handle('toggle-fullscreen', () => { win.setFullScreen(!win.isFullScreen()); return win.isFullScreen(); });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
