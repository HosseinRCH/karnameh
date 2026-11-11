/*
 * Karnameh — two-way sync of the offline bundle with one JSON file in Google Drive.
 * Shared by the Windows app and the web version. Same protocol as Android
 * (docs/09-drive-sync.md): the bundle carries
 *   "sync": { "rev": n, "updatedBy": "...", "updatedAt": "ISO" }
 * and each client remembers the rev it last saw plus a hash of the data at that moment.
 * When both sides changed, every array of records is merged by "id" and the record with
 * the newer updatedAt (or createdAt) wins; any other value follows Drive.
 *
 * An adapter does the file I/O:
 *   isLinked()          -> boolean
 *   label()             -> string shown to the user (file path or name)
 *   ready()             -> Promise<boolean>  (permission available without a click)
 *   read()              -> Promise<string|null>
 *   write(text)         -> Promise<void>
 *   loadMemory()        -> { rev, hash }
 *   saveMemory({rev,hash})
 */
(function (global) {
  const IGNORED = new Set(['sync', 'exportedAt']);

  function canonical(value) {
    if (value === null || value === undefined) return 'null';
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (typeof value === 'object') {
      return `{${Object.keys(value)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  async function dataHash(obj) {
    const copy = {};
    for (const key of Object.keys(obj)) if (!IGNORED.has(key)) copy[key] = obj[key];
    const bytes = new TextEncoder().encode(canonical(copy));
    if (global.crypto && global.crypto.subtle) {
      const digest = await global.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback (non-secure context): FNV-1a 64-ish, good enough to detect change.
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (const b of bytes) { h1 = Math.imul(h1 ^ b, 16777619); h2 = Math.imul(h2 ^ b, 2246822519); }
    return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16) + bytes.length;
  }

  const isRecordArray = (a) => Array.isArray(a) && a.every((x) => x && typeof x === 'object' && 'id' in x);

  function stamp(item) {
    const t = Date.parse(item.updatedAt || item.createdAt || '');
    return Number.isNaN(t) ? 0 : t;
  }

  function mergeRecords(local, remote) {
    const byId = new Map();
    for (const item of remote) byId.set(String(item.id), item);
    for (const item of local) {
      const other = byId.get(String(item.id));
      if (!other || stamp(item) > stamp(other)) byId.set(String(item.id), item);
    }
    return Array.from(byId.values());
  }

  function merge(local, remote) {
    const result = JSON.parse(JSON.stringify(remote));
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
      if (IGNORED.has(key)) continue;
      const l = local[key];
      const r = remote[key];
      if (r === undefined) result[key] = l;
      else if (isRecordArray(l) && isRecordArray(r)) result[key] = mergeRecords(l, r);
    }
    return result;
  }

  function parseBundle(text) {
    if (!text || !String(text).trim()) return null;
    try {
      const obj = JSON.parse(text);
      return obj && obj.format === 'karnameh-export' && obj.workspace ? obj : null;
    } catch {
      return null;
    }
  }

  /**
   * store: { raw(): object, importJson(text) }
   * onApplied(): called after Drive data was loaded into the store, so the UI refreshes.
   */
  function createSync({ adapter, store, clientName, onApplied }) {
    let running = null;

    function serialize(data, rev) {
      const out = JSON.parse(JSON.stringify(data));
      out.sync = { rev, updatedBy: clientName, updatedAt: new Date().toISOString() };
      return JSON.stringify(out, null, 2);
    }

    async function push(data, rev) {
      await adapter.write(serialize(data, rev));
    }

    async function applyLocally(data, remoteRev, remoteHash) {
      store.importJson(JSON.stringify(data));
      const applied = store.raw();
      const appliedHash = await dataHash(applied);
      if (appliedHash !== remoteHash) {
        const rev = remoteRev + 1;
        await push(applied, rev);
        adapter.saveMemory({ rev, hash: appliedHash });
      } else {
        adapter.saveMemory({ rev: remoteRev, hash: appliedHash });
      }
      if (onApplied) onApplied();
    }

    async function syncLocked() {
      if (!adapter.isLinked()) return { outcome: 'NOT_LINKED', message: 'هنوز فایلی در گوگل درایو انتخاب نشده.' };
      if (!(await adapter.ready())) return { outcome: 'NEEDS_PERMISSION', message: 'برای همگام‌سازی، دسترسی به فایل را دوباره تأیید کنید.' };
      const memory = adapter.loadMemory() || {};
      const lastRev = Number.isInteger(memory.rev) ? memory.rev : -1;
      const lastHash = memory.hash || null;

      const local = JSON.parse(JSON.stringify(store.raw()));
      const localHash = await dataHash(local);
      const localDirty = localHash !== lastHash;

      const remote = parseBundle(await adapter.read());
      if (!remote) {
        const rev = Math.max(lastRev, 0) + 1;
        await push(local, rev);
        adapter.saveMemory({ rev, hash: localHash });
        return { outcome: 'PUSHED', message: 'داده‌ها در گوگل درایو ذخیره شد.' };
      }

      const remoteRev = remote.sync && Number.isInteger(remote.sync.rev) ? remote.sync.rev : 0;
      const remoteHash = await dataHash(remote);
      if (remoteHash === localHash) {
        adapter.saveMemory({ rev: remoteRev, hash: localHash });
        return { outcome: 'UP_TO_DATE', message: 'همه‌چیز به‌روز است.' };
      }
      const remoteChanged = remoteRev !== lastRev;
      const firstLink = lastRev === -1;
      const localEmpty = !Array.isArray(local.tasks) || local.tasks.length === 0;
      if (firstLink && localEmpty) {
        // A fresh install linking to an existing file: take Drive as is.
        await applyLocally(remote, remoteRev, remoteHash);
        return { outcome: 'PULLED', message: 'داده‌های گوگل درایو روی این دستگاه آمد.' };
      }
      if (localDirty && !remoteChanged) {
        const rev = remoteRev + 1;
        await push(local, rev);
        adapter.saveMemory({ rev, hash: localHash });
        return { outcome: 'PUSHED', message: 'تغییرات این دستگاه به گوگل درایو رفت.' };
      }
      if (localDirty && remoteChanged) {
        await applyLocally(merge(local, remote), remoteRev, remoteHash);
        return { outcome: 'MERGED', message: 'تغییرات این دستگاه و گوگل درایو ادغام شد.' };
      }
      await applyLocally(remote, remoteRev, remoteHash);
      return { outcome: 'PULLED', message: 'تغییرات گوگل درایو دریافت شد.' };
    }

    async function sync() {
      if (running) return running;
      running = (async () => {
        try {
          return { ...(await syncLocked()), at: Date.now() };
        } catch (e) {
          return { outcome: 'FAILED', message: `خطا در همگام‌سازی: ${(e && e.message) || e}`, at: Date.now() };
        } finally {
          running = null;
        }
      })();
      return running;
    }

    return { sync };
  }

  global.KarnamehSync = { createSync, merge, dataHash, canonical };
})(window);
