/*
 * پاکای آفلاین — داده‌ها
 *
 * کل داده در یک سند به قالب `paca-sync` نگه داشته می‌شود؛ همان قالبی که افزونهٔ
 * «همگام‌سازی با گوگل درایو» پاکا (sync-plugin) در My Drive/Paca/paca-sync.json می‌نویسد.
 * پس هر وقت پاکای آنلاین (سرور) بالا بیاید، با همان افزونه همهٔ پروژه‌ها و کارها را
 * از همین فایل برمی‌دارد.
 *
 * فیلدهای پایهٔ قالب (که پاکا می‌شناسد):
 *   projects[]: syncId, name, description, createdAt, updatedAt
 *   tasks[]:    syncId, projectSyncId, title, description (BlockNote), importance, tags,
 *               createdAt, updatedAt
 * فیلدهای اضافهٔ نسخهٔ آفلاین (پاکا نادیده می‌گیرد و افزونه دست‌نخورده نگهشان می‌دارد):
 *   tasks[]:    status, dueDate, estimateMinutes, deleted
 *   projects[]: color, deleted
 *   timeEntries[]: id, taskSyncId, projectSyncId, start, end, minutes, kind, note,
 *                  createdAt, updatedAt, deleted
 */
(function (global) {
  'use strict';

  const KEY = 'paca.offline.data';
  const listeners = new Set();
  let data = null;
  let saveTimer = null;

  const nowIso = () => new Date().toISOString();
  const uid = () =>
    global.crypto && global.crypto.randomUUID
      ? global.crypto.randomUUID()
      : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  function empty() {
    return {
      format: 'paca-sync',
      version: 1,
      exportedAt: nowIso(),
      sync: { rev: 0, updatedBy: 'offline', updatedAt: nowIso() },
      projects: [],
      tasks: [],
      timeEntries: [],
    };
  }

  function normalize(doc) {
    const d = doc && typeof doc === 'object' ? doc : empty();
    d.format = 'paca-sync';
    d.version = 1;
    if (!d.sync) d.sync = { rev: 0, updatedBy: 'offline', updatedAt: nowIso() };
    d.projects = Array.isArray(d.projects) ? d.projects : [];
    d.tasks = Array.isArray(d.tasks) ? d.tasks : [];
    d.timeEntries = Array.isArray(d.timeEntries) ? d.timeEntries : [];
    for (const t of d.tasks) {
      if (!t.status) t.status = 'todo';
      if (!Array.isArray(t.tags)) t.tags = [];
      if (typeof t.importance !== 'number') t.importance = Number(t.importance) || 0;
    }
    return d;
  }

  // ---------- BlockNote <-> متن ساده ----------
  function textToBlocks(text) {
    const lines = String(text || '').split('\n');
    if (!String(text || '').trim()) return null;
    return lines.map((line) => ({
      id: uid(),
      type: 'paragraph',
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'right' },
      content: line ? [{ type: 'text', text: line, styles: {} }] : [],
      children: [],
    }));
  }

  function blocksToText(desc) {
    if (desc == null) return '';
    if (typeof desc === 'string') return desc;
    const out = [];
    const walk = (blocks) => {
      if (!Array.isArray(blocks)) return;
      for (const b of blocks) {
        if (!b || typeof b !== 'object') continue;
        let line = '';
        const content = b.content;
        if (typeof content === 'string') line = content;
        else if (Array.isArray(content)) {
          line = content
            .map((c) => (c && typeof c.text === 'string' ? c.text : c && Array.isArray(c.content) ? c.content.map((x) => x.text || '').join('') : ''))
            .join('');
        }
        out.push(line);
        if (Array.isArray(b.children) && b.children.length) walk(b.children);
      }
    };
    walk(desc);
    return out.join('\n');
  }

  // ---------- ذخیره ----------
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch { raw = null; }
    try { data = normalize(raw ? JSON.parse(raw) : empty()); } catch { data = empty(); }
    return data;
  }

  function persistNow() {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.error('save failed', e); }
  }

  function changed(opts) {
    data.exportedAt = nowIso();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNow, 150);
    for (const fn of listeners) {
      try { fn(opts || {}); } catch (e) { console.error(e); }
    }
  }

  // ---------- پروژه‌ها ----------
  const projects = () => data.projects.filter((p) => !p.deleted).sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa'));
  const project = (id) => data.projects.find((p) => p.syncId === id) || null;

  function addProject(name, description) {
    const t = nowIso();
    const p = { syncId: uid(), name: String(name || '').trim() || 'پروژهٔ بی‌نام', description: description || '', createdAt: t, updatedAt: t };
    data.projects.push(p);
    changed({ local: true });
    return p;
  }

  function updateProject(id, patch) {
    const p = project(id);
    if (!p) return null;
    Object.assign(p, patch, { updatedAt: nowIso() });
    changed({ local: true });
    return p;
  }

  function deleteProject(id) {
    const p = project(id);
    if (!p) return;
    const t = nowIso();
    p.deleted = true;
    p.updatedAt = t;
    for (const task of data.tasks) {
      if (task.projectSyncId === id && !task.deleted) { task.deleted = true; task.updatedAt = t; }
    }
    changed({ local: true });
  }

  // ---------- کارها ----------
  const tasks = () => data.tasks.filter((t) => !t.deleted && (!t.projectSyncId || !(project(t.projectSyncId) || {}).deleted));
  const task = (id) => data.tasks.find((t) => t.syncId === id) || null;

  function addTask(fields) {
    const t = nowIso();
    const rec = {
      syncId: uid(),
      projectSyncId: fields.projectSyncId || (projects()[0] || addProject('صندوق ورودی')).syncId,
      title: String(fields.title || '').trim() || 'کار بی‌عنوان',
      description: fields.descriptionText != null ? textToBlocks(fields.descriptionText) : fields.description ?? null,
      importance: Number(fields.importance) || 0,
      tags: Array.isArray(fields.tags) ? fields.tags : [],
      status: fields.status || 'todo',
      dueDate: fields.dueDate || null,
      estimateMinutes: Number(fields.estimateMinutes) || 0,
      createdAt: t,
      updatedAt: t,
    };
    data.tasks.push(rec);
    changed({ local: true });
    return rec;
  }

  function updateTask(id, patch) {
    const rec = task(id);
    if (!rec) return null;
    const p = Object.assign({}, patch);
    if ('descriptionText' in p) {
      if (p.descriptionText !== blocksToText(rec.description)) p.description = textToBlocks(p.descriptionText);
      delete p.descriptionText;
    }
    Object.assign(rec, p, { updatedAt: nowIso() });
    changed({ local: true });
    return rec;
  }

  function deleteTask(id) { updateTask(id, { deleted: true }); }

  // ---------- زمان ----------
  const entries = () => data.timeEntries.filter((e) => !e.deleted);

  function addEntry(fields) {
    const t = nowIso();
    const rec = {
      id: uid(),
      taskSyncId: fields.taskSyncId || null,
      projectSyncId: fields.projectSyncId || (fields.taskSyncId && (task(fields.taskSyncId) || {}).projectSyncId) || null,
      start: fields.start || t,
      end: fields.end || t,
      minutes: Math.max(0, Math.round(Number(fields.minutes) || 0)),
      kind: fields.kind || 'manual',
      note: fields.note || '',
      createdAt: t,
      updatedAt: t,
    };
    data.timeEntries.push(rec);
    changed({ local: true });
    return rec;
  }

  function deleteEntry(id) {
    const e = data.timeEntries.find((x) => x.id === id);
    if (!e) return;
    e.deleted = true;
    e.updatedAt = nowIso();
    changed({ local: true });
  }

  const workedMinutes = (taskId) => entries().filter((e) => e.taskSyncId === taskId).reduce((s, e) => s + (e.minutes || 0), 0);

  // ---------- همگام‌سازی ----------
  const stamp = (v) => { const n = Date.parse(v || ''); return Number.isNaN(n) ? 0 : n; };

  function mergeList(localList, remoteList, key) {
    const map = new Map();
    for (const r of remoteList || []) if (r && r[key]) map.set(r[key], r);
    for (const l of localList || []) {
      if (!l || !l[key]) continue;
      const r = map.get(l[key]);
      if (!r) { map.set(l[key], l); continue; }
      const localNewer = stamp(l.updatedAt) >= stamp(r.updatedAt);
      // نسخهٔ جدیدتر برنده است، اما فیلدهایی که فقط نسخهٔ قدیمی‌تر دارد حفظ می‌شوند
      map.set(l[key], localNewer ? Object.assign({}, r, l) : Object.assign({}, l, r));
    }
    return Array.from(map.values());
  }

  /** ادغام دو سند paca-sync؛ کلیدهای ناشناخته هم حفظ می‌شوند. */
  function mergeDocs(local, remote) {
    if (!remote) return normalize(JSON.parse(JSON.stringify(local)));
    if (!local) return normalize(JSON.parse(JSON.stringify(remote)));
    const merged = Object.assign({}, remote, local);
    merged.projects = mergeList(local.projects, remote.projects, 'syncId');
    merged.tasks = mergeList(local.tasks, remote.tasks, 'syncId');
    merged.timeEntries = mergeList(local.timeEntries, remote.timeEntries, 'id');
    merged.sync = Object.assign({}, remote.sync || {}, { rev: Math.max((local.sync || {}).rev || 0, (remote.sync || {}).rev || 0) });
    return normalize(merged);
  }

  function stable(value) {
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
    }
    return JSON.stringify(value === undefined ? null : value);
  }

  /** امضای محتوا (بدون exportedAt و sync) برای فهمیدن این‌که چیزی عوض شده یا نه. */
  function signature(doc) {
    if (!doc) return '';
    const copy = Object.assign({}, doc);
    delete copy.exportedAt;
    delete copy.sync;
    const sortBy = (k) => (a, b) => String(a[k]).localeCompare(String(b[k]));
    copy.projects = [...(copy.projects || [])].sort(sortBy('syncId'));
    copy.tasks = [...(copy.tasks || [])].sort(sortBy('syncId'));
    copy.timeEntries = [...(copy.timeEntries || [])].sort(sortBy('id'));
    return stable(copy);
  }

  function parse(text) {
    if (!text || !String(text).trim()) return null;
    try {
      const v = JSON.parse(text);
      if (v && v.format === 'paca-sync' && Array.isArray(v.projects) && Array.isArray(v.tasks)) return normalize(v);
    } catch { /* نامعتبر */ }
    return null;
  }

  function replace(doc, opts) {
    data = normalize(doc);
    persistNow();
    changed(Object.assign({ local: false }, opts || {}));
  }

  function snapshot() { return JSON.parse(JSON.stringify(data)); }

  global.PacaStore = {
    load,
    get data() { return data; },
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    persistNow,
    uid,
    nowIso,
    projects, project, addProject, updateProject, deleteProject,
    tasks, task, addTask, updateTask, deleteTask,
    entries, addEntry, deleteEntry, workedMinutes,
    textToBlocks, blocksToText,
    mergeDocs, signature, parse, replace, snapshot, empty, normalize,
  };
})(window);
