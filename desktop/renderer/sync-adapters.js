/*
 * File adapters for KarnamehSync.
 *  - Windows (Electron): the file lives in the Google Drive for desktop folder
 *    (for example G:\My Drive\karnameh-sync.json); the main process reads and writes it.
 *  - Web (any browser): signs in with Google and uses the Drive API directly on
 *    My Drive/Karnameh/karnameh-sync.json. Access lasts about an hour per sign-in.
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

  // ---------- Web: Google Drive API ----------
  // Signs in with Google (Google Identity Services token client) and reads/writes
  // Karnameh/karnameh-sync.json in the user's My Drive. Works in any modern browser,
  // phone included. The Client ID comes from config.js (window.KARNAMEH_GOOGLE_CLIENT_ID).
  const MEM = 'karnameh.sync.memory';
  const AUTO = 'karnameh.sync.auto';
  const LINK = 'karnameh.drive.link';
  const TOKEN = 'karnameh.drive.token';
  const FOLDER_NAME = 'Karnameh';
  const FILE_NAME = 'karnameh-sync.json';
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const SCOPE = 'https://www.googleapis.com/auth/drive';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

  function loadGis() {
    if (global.google && global.google.accounts && global.google.accounts.oauth2) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('gsi'));
      document.head.appendChild(s);
    });
  }

  async function createWebAdapter() {
    const clientId = global.KARNAMEH_GOOGLE_CLIENT_ID || '';
    const supported = Boolean(clientId) && typeof fetch === 'function';
    let link = null;
    try { link = JSON.parse(localStorage.getItem(LINK) || 'null'); } catch { link = null; }
    let token = null;
    try { token = JSON.parse(sessionStorage.getItem(TOKEN) || 'null'); } catch { token = null; }
    let tokenClient = null;
    let pending = null;

    const tokenValid = () => Boolean(token && token.value && token.exp - 60000 > Date.now());

    async function ensureClient() {
      if (tokenClient) return tokenClient;
      await loadGis();
      tokenClient = global.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          const p = pending; pending = null;
          if (!p) return;
          if (resp && resp.access_token) {
            token = { value: resp.access_token, exp: Date.now() + Number(resp.expires_in || 3600) * 1000 };
            try { sessionStorage.setItem(TOKEN, JSON.stringify(token)); } catch { /* ignore */ }
            p.resolve(true);
          } else p.resolve(false);
        },
        error_callback: () => { const p = pending; pending = null; if (p) p.resolve(false); },
      });
      return tokenClient;
    }

    // Must run from a click: Google opens a small popup.
    async function signIn(prompt) {
      if (tokenValid()) return true;
      const client = await ensureClient();
      return new Promise((resolve) => {
        pending = { resolve };
        const hint = link && link.email ? { login_hint: link.email } : {};
        client.requestAccessToken({ prompt: prompt || '', ...hint });
      });
    }

    async function api(url, init = {}) {
      if (!tokenValid()) throw new Error('auth');
      const res = await fetch(url, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${token.value}` },
        cache: 'no-store',
      });
      if (res.status === 401) {
        token = null;
        try { sessionStorage.removeItem(TOKEN); } catch { /* ignore */ }
        throw new Error('auth');
      }
      if (!res.ok) throw new Error(`drive ${res.status}`);
      return res;
    }

    const q = (query, fields) => `${API}/files?${new URLSearchParams({ q: query, fields, spaces: 'drive', pageSize: '10' })}`;

    async function findOrCreate() {
      const about = await (await api(`${API}/about?fields=user(emailAddress)`)).json();
      const email = about.user && about.user.emailAddress;
      // 1) folder Karnameh in My Drive
      let folders = (await (await api(q(`name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`, 'files(id)'))).json()).files || [];
      let folderId = folders[0] && folders[0].id;
      if (!folderId) {
        const made = await (await api(`${API}/files?fields=id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
        })).json();
        folderId = made.id;
      }
      // 2) the file inside it
      let files = (await (await api(q(`name = '${FILE_NAME}' and '${folderId}' in parents and trashed = false`, 'files(id,modifiedTime)'))).json()).files || [];
      let fileId = files[0] && files[0].id;
      if (!fileId) {
        // An older file in the root of My Drive: move it into the folder (same id).
        const old = (await (await api(q(`name = '${FILE_NAME}' and 'root' in parents and trashed = false`, 'files(id)'))).json()).files || [];
        if (old[0]) {
          await api(`${API}/files/${old[0].id}?addParents=${folderId}&removeParents=root&fields=id`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
          });
          fileId = old[0].id;
        }
      }
      if (!fileId) {
        const made = await (await api(`${API}/files?fields=id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: FILE_NAME, parents: [folderId], mimeType: 'application/json' }),
        })).json();
        fileId = made.id;
      }
      return { folderId, fileId, email };
    }

    async function link_() {
      if (!(await signIn('consent'))) return false;
      try {
        const found = await findOrCreate();
        link = found;
        localStorage.setItem(LINK, JSON.stringify(link));
        localStorage.setItem(MEM, JSON.stringify({ rev: -1, hash: null }));
        return true;
      } catch {
        return false;
      }
    }

    return {
      kind: 'web',
      supported,
      isLinked: () => Boolean(link && link.fileId),
      label: () => (link ? `Google Drive › ${FOLDER_NAME} › ${FILE_NAME}${link.email ? ` (${link.email})` : ''}` : ''),
      ready: async () => tokenValid(),
      async read() {
        try {
          return await (await api(`${API}/files/${link.fileId}?alt=media`)).text();
        } catch (e) {
          if (String(e.message).includes('404')) {
            // File was deleted or moved: find (or recreate) it in the Karnameh folder.
            const found = await findOrCreate();
            link = { ...link, ...found };
            localStorage.setItem(LINK, JSON.stringify(link));
            return await (await api(`${API}/files/${link.fileId}?alt=media`)).text();
          }
          throw e;
        }
      },
      async write(text) {
        await api(`${UPLOAD}/files/${link.fileId}?uploadType=media&fields=id`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: text,
        });
      },
      loadMemory: () => {
        try { return JSON.parse(localStorage.getItem(MEM) || '{}'); } catch { return {}; }
      },
      saveMemory: (m) => localStorage.setItem(MEM, JSON.stringify(m)),
      isAuto: () => localStorage.getItem(AUTO) !== 'false',
      setAuto: (v) => localStorage.setItem(AUTO, v ? 'true' : 'false'),
      linkNew: link_,
      linkExisting: link_,
      async unlink() {
        link = null;
        localStorage.removeItem(LINK);
        localStorage.removeItem(MEM);
        if (token && global.google && global.google.accounts) {
          try { global.google.accounts.oauth2.revoke(token.value, () => {}); } catch { /* ignore */ }
        }
        token = null;
        try { sessionStorage.removeItem(TOKEN); } catch { /* ignore */ }
      },
      needsClick: async () => Boolean(link && link.fileId) && !tokenValid(),
      requestAccess: () => signIn(''),
    };
  }

  global.KarnamehSyncAdapters = {
    create: () => (global.karnameh && global.karnameh.syncConfig ? createDesktopAdapter() : createWebAdapter()),
  };
})(window);
