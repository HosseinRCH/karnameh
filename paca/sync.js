/*
 * پاکای آفلاین — همگام‌سازی با My Drive/Paca/paca-sync.json
 *
 * سه راه رسیدن به همان فایل:
 *  - drive-api: ورود با گوگل و Drive API v3 (وب: Google Identity Services،
 *               اندروید: ورود بومی گوگل از طریق پل PacaNative).
 *  - file:      فایل روی دیسک (ویندوز: پوشهٔ Google Drive for desktop،
 *               اندروید: انتخاب فایل با Storage Access Framework).
 *  - server:    جای خالی برای «آنلاین شدن» بعدی (پاکای سرور)؛ فعلاً فقط آدرس را نگه می‌دارد.
 */
(function (global) {
  'use strict';

  const S = global.PacaStore;
  const FOLDER_NAME = 'Paca';
  const FILE_NAME = 'paca-sync.json';
  const FOLDER_MIME = 'application/vnd.google-apps.folder';
  const SCOPE = 'https://www.googleapis.com/auth/drive';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const CFG = 'paca.sync.config';

  function readCfg() { try { return JSON.parse(localStorage.getItem(CFG) || '{}') || {}; } catch { return {}; } }
  function writeCfg(c) { try { localStorage.setItem(CFG, JSON.stringify(c)); } catch { /* ignore */ } }

  // ---------------------------------------------------------------------------
  // پل بومی (اندروید): فراخوانی ناهمگام با شناسه
  // ---------------------------------------------------------------------------
  const pending = new Map();
  let seq = 0;
  const Native = global.PacaAndroid
    ? {
        call(method, arg) {
          return new Promise((resolve, reject) => {
            const id = String(++seq);
            pending.set(id, { resolve, reject });
            try { global.PacaAndroid.call(id, method, arg == null ? '' : String(arg)); } catch (e) { pending.delete(id); reject(e); }
          });
        },
      }
    : null;
  global.__pacaNativeDone = function (id, ok, value) {
    const p = pending.get(String(id));
    if (!p) return;
    pending.delete(String(id));
    if (ok) p.resolve(value); else p.reject(new Error(value || 'native'));
  };

  const platform = global.PacaDesktop ? 'windows' : Native ? 'android' : 'web';

  // ---------------------------------------------------------------------------
  // توکن گوگل
  // ---------------------------------------------------------------------------
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

  function webTokenProvider() {
    const KEY = 'paca.drive.token';
    let token = null;
    try { token = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { token = null; }
    let client = null;
    let waiting = null;
    const valid = () => Boolean(token && token.value && token.exp - 60000 > Date.now());
    return {
      supported: Boolean(global.PACA_GOOGLE_CLIENT_ID),
      valid,
      get: () => (valid() ? token.value : null),
      async interactive(prompt, hint) {
        if (valid()) return true;
        await loadGis();
        if (!client) {
          client = global.google.accounts.oauth2.initTokenClient({
            client_id: global.PACA_GOOGLE_CLIENT_ID,
            scope: SCOPE,
            callback: (r) => {
              const w = waiting; waiting = null;
              if (r && r.access_token) {
                token = { value: r.access_token, exp: Date.now() + Number(r.expires_in || 3600) * 1000 };
                try { sessionStorage.setItem(KEY, JSON.stringify(token)); } catch { /* ignore */ }
                if (w) w(true);
              } else if (w) w(false);
            },
            error_callback: () => { const w = waiting; waiting = null; if (w) w(false); },
          });
        }
        return new Promise((resolve) => {
          waiting = resolve;
          client.requestAccessToken(Object.assign({ prompt: prompt || '' }, hint ? { login_hint: hint } : {}));
        });
      },
      silent: async () => valid(),
      drop() { token = null; try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } },
    };
  }

  function androidTokenProvider() {
    let token = null;
    const valid = () => Boolean(token && token.exp - 60000 > Date.now());
    async function ask(interactive) {
      try {
        const value = await Native.call('googleToken', interactive ? '1' : '0');
        if (value) { token = { value, exp: Date.now() + 50 * 60000 }; return true; }
      } catch (e) {
        if (interactive) throw e;
      }
      return false;
    }
    return {
      supported: true,
      valid,
      get: () => (valid() ? token.value : null),
      interactive: () => ask(true),
      silent: async () => valid() || ask(false),
      drop() { if (token) Native.call('clearToken', token.value).catch(() => {}); token = null; },
    };
  }

  // ---------------------------------------------------------------------------
  // آداپتر Drive API
  // ---------------------------------------------------------------------------
  function driveAdapter(tokens) {
    let cfg = readCfg();
    const link = () => cfg.drive || null;

    async function api(url, init) {
      const value = tokens.get();
      if (!value) throw new Error('auth');
      const res = await fetch(url, Object.assign({}, init || {}, {
        headers: Object.assign({}, (init && init.headers) || {}, { Authorization: 'Bearer ' + value }),
        cache: 'no-store',
      }));
      if (res.status === 401) { tokens.drop(); throw new Error('auth'); }
      if (!res.ok) throw new Error('drive ' + res.status);
      return res;
    }
    const list = async (query, fields) =>
      ((await (await api(API + '/files?' + new URLSearchParams({ q: query, fields, spaces: 'drive', pageSize: '10' }))).json()).files) || [];

    async function findOrCreate() {
      const about = await (await api(API + '/about?fields=user(emailAddress)')).json();
      const email = about.user && about.user.emailAddress;
      let folderId = ((await list(`name = '${FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`, 'files(id)'))[0] || {}).id;
      if (!folderId) {
        folderId = (await (await api(API + '/files?fields=id', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: FOLDER_NAME, mimeType: FOLDER_MIME }),
        })).json()).id;
      }
      let fileId = ((await list(`name = '${FILE_NAME}' and '${folderId}' in parents and trashed = false`, 'files(id)'))[0] || {}).id;
      if (!fileId) {
        fileId = (await (await api(API + '/files?fields=id', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: FILE_NAME, parents: [folderId], mimeType: 'application/json' }),
        })).json()).id;
      }
      return { folderId, fileId, email };
    }

    return {
      kind: 'drive-api',
      supported: tokens.supported,
      isLinked: () => Boolean(link() && link().fileId),
      label: () => (link() ? `Google Drive › ${FOLDER_NAME} › ${FILE_NAME}${link().email ? ' (' + link().email + ')' : ''}` : ''),
      ready: () => tokens.silent(),
      needsClick: async () => !(await tokens.silent()),
      async requestAccess() { return tokens.interactive('', link() && link().email); },
      async link() {
        if (!(await tokens.interactive(platform === 'web' ? 'consent' : ''))) return false;
        const found = await findOrCreate();
        cfg = readCfg();
        cfg.mode = 'drive-api';
        cfg.drive = found;
        writeCfg(cfg);
        return true;
      },
      async unlink() { cfg = readCfg(); delete cfg.drive; delete cfg.mode; writeCfg(cfg); tokens.drop(); },
      async read() {
        try {
          return await (await api(`${API}/files/${link().fileId}?alt=media`)).text();
        } catch (e) {
          if (String(e.message).includes('404')) {
            cfg = readCfg(); cfg.drive = Object.assign({}, cfg.drive, await findOrCreate()); writeCfg(cfg);
            return await (await api(`${API}/files/${link().fileId}?alt=media`)).text();
          }
          throw e;
        }
      },
      async write(text) {
        await api(`${UPLOAD}/files/${link().fileId}?uploadType=media&fields=id`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: text,
        });
      },
    };
  }

  // ---------------------------------------------------------------------------
  // آداپتر فایل (ویندوز / اندروید SAF)
  // ---------------------------------------------------------------------------
  function desktopFileAdapter() {
    const host = global.PacaDesktop;
    let cfg = {};
    const refresh = async () => { cfg = (await host.syncConfig()) || {}; };
    refresh();
    return {
      kind: 'file',
      supported: true,
      isLinked: () => Boolean(cfg.path),
      label: () => cfg.path || '',
      ready: async () => true,
      needsClick: async () => false,
      requestAccess: async () => true,
      init: refresh,
      async link(mode) { const next = await host.syncPick(mode || 'auto'); if (next) cfg = next; return Boolean(next && next.path); },
      async unlink() { cfg = (await host.syncUnlink()) || {}; },
      read: () => host.syncRead(),
      write: (text) => host.syncWrite(text),
    };
  }

  function androidFileAdapter() {
    let cfg = readCfg();
    return {
      kind: 'file',
      supported: true,
      isLinked: () => Boolean(cfg.saf && cfg.saf.uri),
      label: () => (cfg.saf ? cfg.saf.name || cfg.saf.uri : ''),
      ready: async () => true,
      needsClick: async () => false,
      requestAccess: async () => true,
      async link(mode) {
        const res = await Native.call('pickFile', mode === 'new' ? 'new' : 'existing');
        if (!res) return false;
        const info = JSON.parse(res);
        cfg = readCfg(); cfg.mode = 'file'; cfg.saf = info; writeCfg(cfg);
        return true;
      },
      async unlink() { cfg = readCfg(); delete cfg.saf; delete cfg.mode; writeCfg(cfg); },
      read: () => Native.call('readFile', cfg.saf.uri),
      write: (text) => Native.call('writeFile', JSON.stringify({ uri: cfg.saf.uri, text })),
    };
  }

  // ---------------------------------------------------------------------------
  // موتور همگام‌سازی
  // ---------------------------------------------------------------------------
  const adapters = {};
  if (platform === 'windows') adapters.file = desktopFileAdapter();
  if (platform === 'android') { adapters['drive-api'] = driveAdapter(androidTokenProvider()); adapters.file = androidFileAdapter(); }
  if (platform === 'web') adapters['drive-api'] = driveAdapter(webTokenProvider());

  function current() {
    const c = readCfg();
    if (c.mode && adapters[c.mode] && adapters[c.mode].isLinked()) return adapters[c.mode];
    for (const k of Object.keys(adapters)) if (adapters[k].isLinked()) return adapters[k];
    return null;
  }

  const state = { phase: 'idle', last: null, running: null };
  const subs = new Set();
  const emit = () => subs.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });

  function finish(outcome, message) {
    state.phase = 'idle';
    state.last = { outcome, message, at: Date.now() };
    const c = readCfg(); c.last = state.last; writeCfg(c);
    emit();
    return state.last;
  }

  /** یک دور کامل: خواندن فایل، ادغام با دادهٔ محلی، نوشتن در صورت نیاز. */
  function syncNow(opts) {
    if (state.running) return state.running;
    state.running = (async () => {
      const a = current();
      if (!a) return finish('NOT_LINKED', 'هنوز به فایل همگام‌سازی وصل نشده‌اید.');
      try {
        if (!(await a.ready())) {
          if (opts && opts.interactive) {
            if (!(await a.requestAccess())) return finish('NEEDS_PERMISSION', 'ورود با گوگل انجام نشد.');
          } else {
            return finish('NEEDS_PERMISSION', 'برای همگام‌سازی دوباره با گوگل وارد شوید.');
          }
        }
        state.phase = 'reading'; emit();
        const text = await a.read();
        const remote = S.parse(text);
        if (text && text.trim() && !remote) return finish('FAILED', 'فایل درایو قالب paca-sync ندارد؛ چیزی نوشته نشد.');
        const local = S.snapshot();
        const merged = S.mergeDocs(local, remote);
        const sigRemote = S.signature(remote);
        const sigMerged = S.signature(merged);
        const sigLocal = S.signature(local);
        let outcome = 'UP_TO_DATE';
        if (sigMerged !== sigRemote) {
          state.phase = 'writing'; emit();
          merged.sync = { rev: ((remote && remote.sync && remote.sync.rev) || 0) + 1, updatedBy: platform, updatedAt: new Date().toISOString() };
          merged.exportedAt = merged.sync.updatedAt;
          await a.write(JSON.stringify(merged, null, 2));
          outcome = sigMerged === sigLocal ? 'PUSHED' : 'MERGED';
        } else if (sigMerged !== sigLocal) {
          outcome = 'PULLED';
        }
        if (sigMerged !== sigLocal || (remote && remote.sync && remote.sync.rev !== (local.sync || {}).rev)) {
          merged.sync = merged.sync || (remote && remote.sync);
          S.replace(merged, { fromSync: true });
        }
        const msg = {
          UP_TO_DATE: 'همه‌چیز به‌روز است.',
          PUSHED: 'تغییرات این دستگاه در درایو نوشته شد.',
          PULLED: 'تغییرات تازه از درایو دریافت شد.',
          MERGED: 'تغییرات دو طرف با هم ادغام شد.',
        }[outcome];
        return finish(outcome, msg);
      } catch (e) {
        if (String(e && e.message) === 'auth') return finish('NEEDS_PERMISSION', 'دسترسی گوگل تمام شده؛ دوباره وارد شوید.');
        console.error(e);
        return finish('FAILED', 'همگام‌سازی ناموفق بود: ' + ((e && e.message) || e));
      } finally {
        state.running = null;
        setTimeout(emit, 0);
      }
    })();
    emit();
    return state.running;
  }

  // همگام‌سازی خودکار: هنگام باز شدن، هر ۳ دقیقه، برگشت به برنامه، و چند ثانیه بعد از هر تغییر.
  let changeTimer = null;
  function auto() { return readCfg().auto !== false; }
  function start() {
    state.last = readCfg().last || null;
    const kick = () => { if (auto() && current()) syncNow(); };
    setTimeout(kick, 800);
    setInterval(kick, 3 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kick(); });
    global.addEventListener('focus', kick);
    S.onChange((o) => {
      if (!o.local) return;
      clearTimeout(changeTimer);
      changeTimer = setTimeout(kick, 4000);
    });
  }

  // ---------------------------------------------------------------------------
  // پاکای آنلاین (برای بعد)
  // ---------------------------------------------------------------------------
  const server = {
    url: () => readCfg().serverUrl || '',
    setUrl(u) { const c = readCfg(); c.serverUrl = String(u || '').trim().replace(/\/+$/, ''); writeCfg(c); },
  };

  global.PacaSync = {
    platform,
    adapters,
    current,
    state,
    subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
    syncNow,
    start,
    auto,
    setAuto(v) { const c = readCfg(); c.auto = Boolean(v); writeCfg(c); emit(); },
    setMode(m) { const c = readCfg(); c.mode = m; writeCfg(c); emit(); },
    server,
    FOLDER_NAME,
    FILE_NAME,
  };
})(window);
