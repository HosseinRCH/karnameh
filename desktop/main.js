const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Karnameh');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isWritable(dir) {
  try {
    ensureDir(dir);
    const probe = path.join(dir, '.write-test');
    fs.writeFileSync(probe, 'ok', 'utf8');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Portable builds keep every file next to the EXE in `Karnameh-Data`, so the
 * whole footprint can be removed by deleting that one folder. If that location
 * is read-only (e.g. Program Files), fall back to `%APPDATA%\Karnameh`.
 */
function resolveDataRoot() {
  if (process.env.KARNAMEH_DATA_DIR) {
    return ensureDir(path.resolve(process.env.KARNAMEH_DATA_DIR));
  }
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableDir) {
    const candidate = path.join(portableDir, 'Karnameh-Data');
    if (isWritable(candidate)) return candidate;
  }
  return ensureDir(path.join(app.getPath('appData'), 'Karnameh'));
}

const dataRoot = resolveDataRoot();

// Keep Chromium/Electron caches and logs inside the portable data folder too.
try {
  app.setPath('userData', dataRoot);
  app.setPath('sessionData', ensureDir(path.join(dataRoot, 'session')));
  app.setPath('logs', ensureDir(path.join(dataRoot, 'logs')));
  app.setPath('crashDumps', ensureDir(path.join(dataRoot, 'crashes')));
  app.setPath('temp', ensureDir(path.join(dataRoot, 'temp')));
} catch (error) {
  console.error('Karnameh: could not redirect app paths', error);
}

function dataDir() {
  return dataRoot;
}

function dataFile() {
  return path.join(dataDir(), 'karnameh.json');
}

function attachmentsDir() {
  const dir = path.join(dataDir(), 'attachments');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function seedFile() {
  return path.join(__dirname, 'seed', 'karnameh-seed.json');
}

function atomicWrite(target, text) {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const temp = `${target}.tmp`;
  fs.writeFileSync(temp, text, 'utf8');
  fs.renameSync(temp, target);
}

function loadData() {
  const target = dataFile();
  if (!fs.existsSync(target)) {
    try {
      const seed = fs.readFileSync(seedFile(), 'utf8');
      atomicWrite(target, seed);
    } catch {
      return null;
    }
  }
  try {
    return fs.readFileSync(target, 'utf8');
  } catch {
    return null;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1024,
    minHeight: 660,
    title: 'کارنامه',
    backgroundColor: '#f8fafc',
    icon: path.join(__dirname, 'renderer', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.setMenuBarVisibility(false);
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  return win;
}

ipcMain.handle('data:load', () => loadData());

ipcMain.on('data:save', (_event, text) => {
  if (typeof text !== 'string' || !text.includes('karnameh-export')) return;
  try {
    atomicWrite(dataFile(), text);
  } catch (error) {
    console.error('Karnameh: could not save data', error);
  }
});

ipcMain.handle('file:save', async (event, name, content) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showSaveDialog(win, {
    title: 'ذخیرهٔ فایل',
    defaultPath: path.join(app.getPath('downloads'), name || 'karnameh.json'),
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'CSV', extensions: ['csv'] },
      { name: 'همهٔ فایل‌ها', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePath) return false;
  try {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error('Karnameh: could not write file', error);
    return false;
  }
});

ipcMain.handle('file:open', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(win, {
    title: 'انتخاب بستهٔ کارنامه',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePaths || !result.filePaths.length) return null;
  try {
    return fs.readFileSync(result.filePaths[0], 'utf8');
  } catch (error) {
    console.error('Karnameh: could not read file', error);
    return null;
  }
});

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('app:data-dir', () => dataRoot);

ipcMain.handle('data:open-folder', async () => {
  ensureDir(dataRoot);
  const error = await shell.openPath(dataRoot);
  return error === '';
});

ipcMain.handle('file:attach', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
  const result = await dialog.showOpenDialog(win, {
    title: 'انتخاب پیوست',
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths || !result.filePaths.length) return null;
  try {
    const source = result.filePaths[0];
    const name = path.basename(source);
    const fileName = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}${path.extname(source)}`;
    const target = path.join(attachmentsDir(), fileName);
    fs.copyFileSync(source, target);
    return { name, fileName, mimeType: '', size: fs.statSync(target).size };
  } catch (error) {
    console.error('Karnameh: could not attach file', error);
    return null;
  }
});

ipcMain.handle('file:open-attachment', async (_event, fileName) => {
  const target = path.join(attachmentsDir(), path.basename(String(fileName || '')));
  if (!fs.existsSync(target)) return false;
  const error = await shell.openPath(target);
  return error === '';
});

ipcMain.handle('file:delete-attachment', (_event, fileName) => {
  const target = path.join(attachmentsDir(), path.basename(String(fileName || '')));
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
    return true;
  } catch (error) {
    console.error('Karnameh: could not delete attachment', error);
    return false;
  }
});

// ---------- Google Drive sync (file in the Google Drive for desktop folder) ----------
function syncConfigFile() {
  return path.join(dataDir(), 'drive-sync.json');
}

function readSyncConfig() {
  try {
    return JSON.parse(fs.readFileSync(syncConfigFile(), 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeSyncConfig(config) {
  atomicWrite(syncConfigFile(), JSON.stringify(config, null, 2));
  return config;
}

/** Best guess for the Google Drive for desktop "My Drive" folder. */
function guessDriveFolder() {
  const candidates = [];
  for (const letter of 'GHIJKLMNOPDEF') {
    candidates.push(`${letter}:\\My Drive`, `${letter}:\\درایو من`);
  }
  const home = app.getPath('home');
  candidates.push(path.join(home, 'Google Drive', 'My Drive'), path.join(home, 'Google Drive'), path.join(home, 'My Drive'));
  return candidates.find((dir) => {
    try {
      return fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  }) || app.getPath('documents');
}

ipcMain.handle('sync:config', () => readSyncConfig());

ipcMain.handle('sync:set-config', (_event, patch) => {
  const current = readSyncConfig();
  const next = { ...current };
  if (patch && Number.isInteger(patch.rev)) next.rev = patch.rev;
  if (patch && typeof patch.hash === 'string') next.hash = patch.hash;
  if (patch && typeof patch.auto === 'boolean') next.auto = patch.auto;
  return writeSyncConfig(next);
});

ipcMain.handle('sync:pick', async (event, mode) => {
  const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
  const defaultDir = guessDriveFolder();
  let filePath = null;
  if (mode === 'new') {
    const result = await dialog.showSaveDialog(win, {
      title: 'ساخت فایل همگام‌سازی در پوشهٔ Google Drive',
      defaultPath: path.join(defaultDir, 'karnameh-sync.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    filePath = result.filePath;
  } else {
    const result = await dialog.showOpenDialog(win, {
      title: 'انتخاب فایل karnameh-sync.json در پوشهٔ Google Drive',
      defaultPath: defaultDir,
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths || !result.filePaths.length) return null;
    filePath = result.filePaths[0];
  }
  const auto = readSyncConfig().auto;
  return writeSyncConfig({ path: filePath, rev: -1, hash: null, auto: auto !== false });
});

ipcMain.handle('sync:unlink', () => {
  const auto = readSyncConfig().auto;
  return writeSyncConfig({ auto: auto !== false });
});

ipcMain.handle('sync:read', () => {
  const { path: target } = readSyncConfig();
  if (!target) throw new Error('فایلی انتخاب نشده');
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target, 'utf8');
});

ipcMain.handle('sync:write', (_event, text) => {
  const { path: target } = readSyncConfig();
  if (!target) throw new Error('فایلی انتخاب نشده');
  if (typeof text !== 'string' || !text.includes('karnameh-export')) throw new Error('دادهٔ نامعتبر');
  // Write in place (no temp + rename) so Google Drive keeps the same file and its ID,
  // which the Android app is linked to.
  fs.writeFileSync(target, text, 'utf8');
  return true;
});

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
