/*
 * File adapters for KarnamehSync.
 *  - Windows (Electron): the file lives in the Google Drive for desktop folder
 *    (for example G:\My Drive\karnameh-sync.json); the main process reads and writes it.
 *  - Web (Chrome / Edge on a computer): the File System Access API keeps a handle to
 *    the same file, stored in IndexedDB. The browser asks to confirm access once per visit.
 */
(function (global) {
  // ---------- Windows ----------
  async function createDesktopAdapter() {
    const api = global.karnameh;
    let config = (await api.syncConfig()) || {};
    const persistMemory = () => api.syncSetConfig({ rev: config.rev, hash: config.hash, auto: config.auto });
    return {
      kind: 'desktop',
      supported: true,
      isLinked: () => Boolean(config.path),
      label: () => config.path || '',
      ready: async () => true,
      read: () => api.syncRead(),
      write: (text) => api.syncWrite(text),
      loadMemory: () => ({ rev: config.rev, hash: config.hash }),
      saveMemory: (m) => { config.rev = m.rev; config.hash = m.hash; persistMemory(); },
      isAuto: () => config.auto !== false,
      setAuto: (v) => { config.auto = Boolean(v); persistMemory(); },
      async linkNew() {
        const next = await api.syncPick('new');
        if (next) config = next;
        return Boolean(next);
      },
      async linkExisting() {
        const next = await api.syncPick('existing');
        if (next) config = next;
        return Boolean(next);
      },
      async unlink() {
        config = (await api.syncUnlink()) || {};
      },
      needsClick: async () => false,
      requestAccess: async () => true,
    };
  }

  // ---------- Web ----------
  const DB = 'karnameh-sync';
  const KEY = 'handle';
  const MEM = 'karnameh.sync.memory';
  const AUTO = 'karnameh.sync.auto';

  function idb(mode, fn) {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('kv', mode);
        const req = fn(tx.objectStore('kv'));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      };
    });
  }

  async function createWebAdapter() {
    const supported = typeof global.showOpenFilePicker === 'function' && typeof global.showSaveFilePicker === 'function';
    let handle = null;
    if (supported) {
      try { handle = (await idb('readonly', (s) => s.get(KEY))) || null; } catch { handle = null; }
    }
    const opts = { mode: 'readwrite' };
    const types = [{ description: 'Karnameh JSON', accept: { 'application/json': ['.json'] } }];

    async function remember(h) {
      handle = h;
      localStorage.setItem(MEM, JSON.stringify({ rev: -1, hash: null }));
      await idb('readwrite', (s) => s.put(h, KEY));
    }

    return {
      kind: 'web',
      supported,
      isLinked: () => Boolean(handle),
      label: () => (handle ? handle.name : ''),
      ready: async () => Boolean(handle) && (await handle.queryPermission(opts)) === 'granted',
      read: async () => (await handle.getFile()).text(),
      async write(text) {
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
      },
      loadMemory: () => {
        try { return JSON.parse(localStorage.getItem(MEM) || '{}'); } catch { return {}; }
      },
      saveMemory: (m) => localStorage.setItem(MEM, JSON.stringify(m)),
      isAuto: () => localStorage.getItem(AUTO) !== 'false',
      setAuto: (v) => localStorage.setItem(AUTO, v ? 'true' : 'false'),
      async linkNew() {
        try {
          const h = await global.showSaveFilePicker({ suggestedName: 'karnameh-sync.json', types });
          await remember(h);
          return true;
        } catch { return false; }
      },
      async linkExisting() {
        try {
          const [h] = await global.showOpenFilePicker({ types, multiple: false });
          if (!h) return false;
          if ((await h.requestPermission(opts)) !== 'granted') return false;
          await remember(h);
          return true;
        } catch { return false; }
      },
      async unlink() {
        handle = null;
        localStorage.removeItem(MEM);
        try { await idb('readwrite', (s) => s.delete(KEY)); } catch { /* ignore */ }
      },
      needsClick: async () => Boolean(handle) && (await handle.queryPermission(opts)) !== 'granted',
      requestAccess: async () => Boolean(handle) && (await handle.requestPermission(opts)) === 'granted',
    };
  }

  global.KarnamehSyncAdapters = {
    create: () => (global.karnameh && global.karnameh.syncConfig ? createDesktopAdapter() : createWebAdapter()),
  };
})(window);
