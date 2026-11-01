/*
 * Offline Karnameh store for the Windows app.
 * Uses the same `karnameh-export` bundle as the Android app and the server,
 * keeps unknown keys, and persists the whole document after every change.
 */
(function (global) {
  const J = global.KJalali;
  const ARRAYS = [
    'members', 'spaces', 'folders', 'lists', 'statuses', 'tasks', 'fields', 'values',
    'assignees', 'tags', 'taskTags', 'dependencies', 'goals', 'targets', 'targetTasks',
    'dashboards', 'automations', 'timeEntries', 'timesheets', 'activity', 'views',
    'focusSessions', 'automationRuns', 'attachments',
  ];
  const PRIORITIES = ['urgent', 'high', 'normal', 'low', 'none'];

  const uid = () =>
    global.crypto && typeof global.crypto.randomUUID === 'function'
      ? global.crypto.randomUUID()
      : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
  const nowIso = () => new Date().toISOString();
  const today = () => J.localIso();
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  function ensureShape(source) {
    if (!source || typeof source !== 'object') source = {};
    if (source.format !== 'karnameh-export') source.format = 'karnameh-export';
    if (!source.version) source.version = 1;
    if (!source.exportedAt) source.exportedAt = nowIso();
    for (const key of ARRAYS) {
      if (!Array.isArray(source[key])) source[key] = [];
    }
    if (!source.workspace || typeof source.workspace !== 'object') source.workspace = {};
    return source;
  }

  function starter() {
    const stamp = nowIso();
    const workspaceId = uid();
    const spaceId = uid();
    const listId = uid();
    const bundle = ensureShape({
      format: 'karnameh-export',
      version: 1,
      exportedAt: stamp,
      workspace: {
        id: workspaceId,
        name: 'میزکار من',
        slug: 'my-workspace',
        defaultLocale: 'fa',
        currency: 'IRR',
        hourlyRate: null,
        createdAt: stamp,
        updatedAt: stamp,
      },
      members: [{ id: uid(), name: 'من', email: 'me@karnameh.local', role: 'owner' }],
      spaces: [{
        id: spaceId, workspaceId, name: 'عمومی', color: '#0f766e', position: 0,
        createdAt: stamp, updatedAt: stamp,
      }],
      lists: [{
        id: listId, spaceId, folderId: null, name: 'کارها', position: 0,
        createdAt: stamp, updatedAt: stamp,
      }],
      statuses: [
        { id: uid(), listId, name: 'برای انجام', type: 'open', color: '#94a3b8', position: 0 },
        { id: uid(), listId, name: 'در حال انجام', type: 'custom', color: '#3b82f6', position: 1 },
        { id: uid(), listId, name: 'انجام شد', type: 'done', color: '#22c55e', position: 2 },
      ],
    });
    return bundle;
  }

  function createStore(text, persist) {
    let bundle;
    try {
      bundle = ensureShape(JSON.parse(text));
    } catch {
      bundle = starter();
    }
    if (!Array.isArray(bundle.tasks)) bundle = starter();

    const objects = (key) => (Array.isArray(bundle[key]) ? bundle[key].filter((x) => x && typeof x === 'object') : []);
    const arr = (key) => {
      if (!Array.isArray(bundle[key])) bundle[key] = [];
      return bundle[key];
    };
    const findById = (key, id) => objects(key).find((x) => x.id === id);
    const findTask = (id) => findById('tasks', id);
    const removeWhere = (key, field, value) => {
      bundle[key] = arr(key).filter((x) => !x || x[field] !== value);
    };
    const removeWhereIn = (key, field, values) => {
      const set = new Set(values);
      bundle[key] = arr(key).filter((x) => !x || !set.has(x[field]));
    };

    function save() {
      const json = JSON.stringify(bundle, null, 2);
      if (persist) persist(json);
    }

    function log(title, action, entityType, entityId) {
      arr('activity').push({
        id: uid(), title, action, entityType,
        entityId: entityId || null, createdAt: nowIso(),
      });
    }

    // ---- Workspace / hierarchy -----------------------------------------
    function workspace() {
      const w = bundle.workspace || {};
      return { id: w.id || '', name: w.name || 'میزکار من' };
    }
    const spaces = () =>
      objects('spaces').slice().sort((a, b) => num(a.position) - num(b.position))
        .map((s) => ({ id: s.id, name: s.name, color: s.color || '#0f766e' }));
    const allLists = () =>
      objects('lists').slice().sort((a, b) => num(a.position) - num(b.position))
        .map((l) => ({ id: l.id, spaceId: l.spaceId, folderId: l.folderId || null, name: l.name }));
    const lists = (spaceId) => allLists().filter((l) => l.spaceId === spaceId);
    const listName = (listId) => (findById('lists', listId) || {}).name || 'لیست';

    function createSpace(name) {
      const stamp = nowIso();
      const item = {
        id: uid(), workspaceId: workspace().id, name, color: '#0f766e',
        position: arr('spaces').length, createdAt: stamp, updatedAt: stamp,
      };
      arr('spaces').push(item);
      log(`فضای «${name}» ساخته شد`, 'created', 'space', item.id);
      save();
      return item;
    }

    function createList(spaceId, name) {
      const stamp = nowIso();
      const listId = uid();
      arr('lists').push({
        id: listId, spaceId, folderId: null, name,
        position: arr('lists').length, createdAt: stamp, updatedAt: stamp,
      });
      addStatusRow(listId, 'برای انجام', 'open', '#94a3b8', 0);
      addStatusRow(listId, 'در حال انجام', 'custom', '#3b82f6', 1);
      addStatusRow(listId, 'انجام شد', 'done', '#22c55e', 2);
      log(`لیست «${name}» ساخته شد`, 'created', 'list', listId);
      save();
      return { id: listId, spaceId, name };
    }

    function addStatusRow(listId, name, type, color, position) {
      const item = { id: uid(), listId, name, type, color, position };
      arr('statuses').push(item);
      return item;
    }

    const statuses = (listId) =>
      objects('statuses').filter((s) => s.listId === listId)
        .sort((a, b) => num(a.position) - num(b.position))
        .map((s) => ({ id: s.id, name: s.name, type: s.type, color: s.color || '#94a3b8' }));
    const status = (id) => {
      const s = findById('statuses', id);
      return s ? { id: s.id, name: s.name, type: s.type, color: s.color || '#94a3b8' } : null;
    };
    const isDone = (statusId) => {
      const s = findById('statuses', statusId);
      return Boolean(s && (s.type === 'done' || s.type === 'closed'));
    };

    function createStatus(listId, name, type, color) {
      const position = objects('statuses').filter((s) => s.listId === listId).length;
      const item = addStatusRow(
        listId, name, type || 'custom',
        color || ['#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6'][position % 4],
        position,
      );
      log(`وضعیت «${name}» ساخته شد`, 'created', 'status', item.id);
      save();
      return item;
    }

    function deleteStatus(statusId) {
      const status = findById('statuses', statusId);
      if (!status) return;
      const fallback = objects('statuses').find((s) => s.listId === status.listId && s.id !== statusId);
      for (const task of objects('tasks')) {
        if (task.statusId === statusId) task.statusId = fallback ? fallback.id : '';
      }
      removeWhere('statuses', 'id', statusId);
      save();
    }

    function reorderStatuses(listId, ids) {
      ids.forEach((id, index) => {
        const s = findById('statuses', id);
        if (s && s.listId === listId) s.position = index;
      });
      save();
    }

    // ---- Tasks ----------------------------------------------------------
    function workedByTask() {
      const tasks = objects('tasks');
      const titles = new Map(tasks.map((t) => [normalizeText(t.title), t.id]));
      const totals = new Map();
      for (const entry of objects('timeEntries')) {
        let taskId = entry.taskId || null;
        if (!taskId && entry.description) {
          taskId = titles.get(normalizeText(entry.description)) || matchByTitle(entry.description, tasks);
        }
        if (!taskId) continue;
        totals.set(taskId, (totals.get(taskId) || 0) + num(entry.durationMinutes));
      }
      return totals;
    }

    /**
     * Old manual entries stored only a title in `description`, sometimes with an
     * extra word in the middle ("گوشی"). Match by token coverage, preferring the
     * most complete/longest title so historic work still counts toward the task.
     */
    function matchByTitle(description, tasks) {
      const descTokens = new Set(tokens(description));
      if (descTokens.size < 3) return null;
      let best = null;
      for (const task of tasks) {
        const titleTokens = tokens(task.title);
        if (titleTokens.length < 3) continue;
        const covered = titleTokens.filter((token) => descTokens.has(token)).length;
        const ratio = covered / titleTokens.length;
        if (ratio < 0.8) continue;
        const score = ratio * 100 + titleTokens.length;
        if (!best || score > best.score) best = { id: task.id, score };
      }
      return best ? best.id : null;
    }

    function tokens(value) {
      return normalizeText(value).split(/\s+/).filter(Boolean);
    }

    /** Find the task a legacy description-only time entry belongs to. */
    function taskForDescription(description) {
      if (!description) return null;
      const tasks = objects('tasks');
      const normalized = normalizeText(description);
      const exact = tasks.find((t) => normalizeText(t.title) === normalized);
      if (exact) return exact;
      const id = matchByTitle(description, tasks);
      return id ? findTask(id) : null;
    }

    function taskTags(taskId) {
      const ids = new Set(objects('taskTags').filter((t) => t.taskId === taskId).map((t) => t.tagId));
      return objects('tags').filter((t) => ids.has(t.id))
        .map((t) => ({ id: t.id, name: t.name, color: t.color || '#6366f1' }));
    }

    function taskAssignees(taskId) {
      const ids = new Set(objects('assignees').filter((a) => a.taskId === taskId).map((a) => a.userId));
      return objects('members').filter((m) => ids.has(m.id))
        .map((m) => ({ id: m.id, name: m.name, email: m.email || '', role: m.role || 'member' }));
    }

    function toRow(task, worked) {
      const id = task.id;
      return {
        id,
        title: task.title || '',
        statusId: task.statusId || '',
        priority: task.priority || 'none',
        dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : null,
        completedAt: task.completedAt || null,
        listId: task.listId || '',
        startDate: task.startDate ? String(task.startDate).slice(0, 10) : null,
        startTime: task.startTime ? String(task.startTime).slice(0, 5) : null,
        dueTime: task.dueTime ? String(task.dueTime).slice(0, 5) : null,
        estimateMs: task.estimateMs == null ? null : num(task.estimateMs),
        parentTaskId: task.parentTaskId || null,
        workedMinutes: worked.get(id) || 0,
        done: isDone(task.statusId),
        tags: taskTags(id),
        assignees: taskAssignees(id),
      };
    }

    function matchesQuery(task, query) {
      const q = String(query || '').trim();
      if (!q) return true;
      return normalizeText(`${task.title} ${task.description || ''}`).includes(normalizeText(q));
    }

    function tasks(listId, query) {
      const worked = workedByTask();
      return objects('tasks')
        .filter((t) => t.listId === listId && matchesQuery(t, query))
        .sort((a, b) => num(a.position) - num(b.position))
        .map((t) => toRow(t, worked));
    }

    function allTasks(query) {
      const worked = workedByTask();
      return objects('tasks')
        .filter((t) => matchesQuery(t, query))
        .sort((a, b) => num(a.position) - num(b.position))
        .map((t) => toRow(t, worked));
    }

    function task(id) {
      const t = findTask(id);
      if (!t) return null;
      const worked = workedByTask();
      const row = toRow(t, worked);
      return {
        ...row,
        description: t.description || '',
        parentTaskId: t.parentTaskId || null,
        subtasks: objects('tasks').filter((x) => x.parentTaskId === id)
          .map((x) => toRow(x, worked)),
        fieldValues: fieldValues(id),
        createdAt: t.createdAt || null,
        updatedAt: t.updatedAt || null,
      };
    }

    function createTask(listId, title, parentTaskId) {
      const first = statuses(listId)[0];
      const stamp = nowIso();
      const task = {
        id: uid(), listId, parentTaskId: parentTaskId || null,
        title, description: null,
        statusId: first ? first.id : '', priority: 'none',
        position: arr('tasks').length,
        startDate: null, startTime: null, dueDate: null, dueTime: null,
        completedAt: null, estimateMs: null,
        createdAt: stamp, updatedAt: stamp,
      };
      arr('tasks').push(task);
      runAutomations('task.created', task, null);
      log(`کار «${title}» ساخته شد`, 'created', 'task', task.id);
      save();
      return task;
    }

    function updateTask(taskId, patch) {
      const task = findTask(taskId);
      if (!task) return null;
      for (const [key, value] of Object.entries(patch)) {
        task[key] = value === undefined ? null : value;
      }
      task.updatedAt = nowIso();
      runAutomations('task.updated', task, null);
      log(`کار «${task.title}» ویرایش شد`, 'updated', 'task', taskId);
      save();
      return task;
    }

    function setStatus(taskId, statusId) {
      const task = findTask(taskId);
      const st = findById('statuses', statusId);
      if (!task) return null;
      task.statusId = statusId;
      task.completedAt = st && (st.type === 'done' || st.type === 'closed') ? nowIso() : null;
      task.updatedAt = nowIso();
      runAutomations('task.status_changed', task, st ? st.name : null);
      log(`وضعیت «${task.title}» به ${st ? st.name : '—'} تغییر کرد`, 'status_changed', 'task', taskId);
      save();
      return task;
    }

    function deleteTask(taskId) {
      const task = findTask(taskId);
      if (!task) return;
      const removedIds = [taskId, ...objects('tasks').filter((t) => t.parentTaskId === taskId).map((t) => t.id)];
      removeWhereIn('tasks', 'id', removedIds);
      removeWhereIn('timeEntries', 'taskId', removedIds);
      removeWhereIn('taskTags', 'taskId', removedIds);
      removeWhereIn('assignees', 'taskId', removedIds);
      removeWhereIn('values', 'taskId', removedIds);
      removeWhereIn('attachments', 'taskId', removedIds);
      log(`کار «${task.title}» حذف شد`, 'deleted', 'task', taskId);
      save();
    }

    // ---- Time -----------------------------------------------------------
    function timeEntries() {
      return objects('timeEntries')
        .slice()
        .sort((a, b) => {
          const byDate = String(b.spentOn || '').localeCompare(String(a.spentOn || ''));
          if (byDate !== 0) return byDate;
          return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
        })
        .map((entry) => toEntry(entry));
    }

    function toEntry(entry) {
      const matched = entry.taskId ? null : taskForDescription(entry.description);
      const task = entry.taskId ? findTask(entry.taskId) : matched;
      return {
        id: entry.id,
        taskId: entry.taskId || (matched ? matched.id : null),
        taskTitle: task ? task.title : null,
        description: entry.description || null,
        minutes: num(entry.durationMinutes),
        spentOn: entry.spentOn || '',
        createdAt: entry.createdAt || '',
        billable: Boolean(entry.billable),
      };
    }

    function addTimeEntry(taskId, minutes, description, spentOn) {
      const entry = {
        id: uid(),
        taskId: taskId || null,
        description: description || null,
        durationMinutes: Math.max(1, Math.round(num(minutes))),
        billable: false,
        spentOn: spentOn || today(),
        createdAt: nowIso(),
      };
      arr('timeEntries').push(entry);
      log(`${entry.durationMinutes} دقیقه زمان ثبت شد`, 'time_logged', 'time', entry.id);
      save();
      return toEntry(entry);
    }

    function deleteTimeEntry(entryId) {
      removeWhere('timeEntries', 'id', entryId);
      save();
    }

    function todayMinutes() {
      return objects('timeEntries')
        .filter((e) => e.spentOn === today())
        .reduce((sum, e) => sum + num(e.durationMinutes), 0);
    }

    function focusSessions() {
      return objects('focusSessions')
        .slice()
        .sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')))
        .map((s) => ({
          id: s.id, mode: s.mode || 'focus', taskId: s.taskId || null,
          seconds: num(s.seconds), completed: Boolean(s.completed),
          startedAt: s.startedAt || '',
          taskTitle: s.taskId ? (findTask(s.taskId) || {}).title || null : null,
        }));
    }

    function todayFocusMinutes() {
      return Math.floor(
        objects('focusSessions')
          .filter((s) => s.startedAt && J.localIso(new Date(s.startedAt)) === today())
          .reduce((sum, s) => sum + num(s.seconds), 0) / 60,
      );
    }

    function recordFocusSession(mode, taskId, seconds, completed) {
      const stamp = nowIso();
      const safe = Math.max(0, Math.round(num(seconds)));
      arr('focusSessions').push({
        id: uid(), mode: mode || 'focus', taskId: taskId || null,
        seconds: safe, completed: Boolean(completed),
        startedAt: stamp, endedAt: stamp,
      });
      if (safe > 0) {
        const minutes = Math.max(1, Math.floor(safe / 60));
        const entryId = uid();
        arr('timeEntries').push({
          id: entryId, taskId: taskId || null,
          description: taskId ? 'جلسهٔ تمرکز' : 'تمرکز آزاد',
          durationMinutes: minutes, billable: false,
          spentOn: today(), createdAt: stamp,
        });
        log(`${minutes} دقیقه زمان ثبت شد`, 'time_logged', 'time', entryId);
      }
      log(`جلسهٔ تمرکز ثبت شد (${Math.floor(safe / 60)} دقیقه)`, 'focus', 'focus', mode || 'focus');
      save();
    }

    // ---- Stats / dashboards --------------------------------------------
    function stats() {
      const all = objects('tasks');
      const t = today();
      const done = all.filter((x) => x.completedAt);
      return {
        totalTasks: all.length,
        openTasks: all.length - done.length,
        doneToday: all.filter((x) => x.completedAt && J.localIso(new Date(x.completedAt)) === t).length,
        dueToday: all.filter((x) => String(x.dueDate || '').slice(0, 10) === t && !x.completedAt).length,
        overdue: all.filter((x) => {
          const due = String(x.dueDate || '').slice(0, 10);
          return due && due < t && !x.completedAt;
        }).length,
        todayMinutes: todayMinutes(),
        spaces: objects('spaces').length,
        lists: objects('lists').length,
        goals: objects('goals').length,
      };
    }

    function dueSoon() {
      const worked = workedByTask();
      const t = today();
      return objects('tasks')
        .filter((task) => {
          const due = String(task.dueDate || '').slice(0, 10);
          return due && due <= t && !task.completedAt;
        })
        .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
        .map((task) => toRow(task, worked));
    }

    function last7Days() {
      const days = [];
      for (let i = 6; i >= 0; i -= 1) {
        const iso = J.addDays(today(), -i);
        const minutes = objects('timeEntries')
          .filter((e) => e.spentOn === iso)
          .reduce((sum, e) => sum + num(e.durationMinutes), 0);
        days.push({ date: iso, jd: J.isoToJalaali(iso), minutes });
      }
      return days;
    }

    function statusBreakdown() {
      const statusList = objects('statuses');
      return statusList.map((s) => ({
        id: s.id, label: s.name, color: s.color || '#94a3b8',
        count: objects('tasks').filter((t) => t.statusId === s.id).length,
      })).filter((s) => s.count > 0);
    }

    function priorityBreakdown() {
      return PRIORITIES.map((p) => ({
        id: p, label: p, count: objects('tasks').filter((t) => (t.priority || 'none') === p).length,
      })).filter((p) => p.count > 0);
    }

    function workload() {
      return objects('members').map((member) => {
        const assigned = objects('assignees').filter((a) => a.userId === member.id).map((a) => a.taskId);
        const open = objects('tasks').filter((t) => assigned.includes(t.id) && !t.completedAt);
        return {
          memberId: member.id,
          name: member.name,
          openTasks: open.length,
          estimateMinutes: Math.round(open.reduce((sum, t) => sum + num(t.estimateMs), 0) / 60000),
        };
      });
    }

    function activity(limit) {
      return objects('activity')
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, limit || 10)
        .map((a) => ({
          id: a.id, title: a.title, action: a.action,
          entityType: a.entityType, entityId: a.entityId || null,
          createdAt: a.createdAt || '',
        }));
    }

    function search(query) {
      return allTasks(query);
    }

    // ---- Tags / members / fields ---------------------------------------
    function tags() {
      return objects('tags')
        .slice()
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fa'))
        .map((t) => ({ id: t.id, name: t.name, color: t.color || '#6366f1' }));
    }

    function createTag(name, color) {
      const tag = {
        id: uid(), workspaceId: workspace().id, name,
        color: color || '#6366f1',
      };
      arr('tags').push(tag);
      log(`برچسب «${name}» ساخته شد`, 'created', 'tag', tag.id);
      save();
      return tag;
    }

    function deleteTag(tagId) {
      removeWhere('tags', 'id', tagId);
      removeWhere('taskTags', 'tagId', tagId);
      save();
    }

    function setTaskTags(taskId, tagIds) {
      bundle.taskTags = arr('taskTags').filter((t) => t.taskId !== taskId);
      for (const tagId of tagIds) bundle.taskTags.push({ taskId, tagId });
      save();
    }

    function members() {
      return objects('members')
        .map((m) => ({ id: m.id, name: m.name, email: m.email || '', role: m.role || 'member' }));
    }

    function createMember(name, email, role) {
      const member = {
        id: uid(), name, email: email || `${uid()}@karnameh.local`, role: role || 'member',
      };
      arr('members').push(member);
      log(`عضو «${name}» اضافه شد`, 'created', 'member', member.id);
      save();
      return member;
    }

    function deleteMember(memberId) {
      removeWhere('members', 'id', memberId);
      removeWhere('assignees', 'userId', memberId);
      save();
    }

    function setTaskAssignees(taskId, memberIds) {
      const existing = objects('assignees').filter((a) => a.taskId === taskId);
      bundle.assignees = arr('assignees').filter((a) => a.taskId !== taskId);
      for (const userId of memberIds) {
        const member = findById('members', userId);
        if (member) {
          bundle.assignees.push({
            taskId, userId, email: member.email || '', estimateMs: null,
          });
        }
      }
      if (existing.length !== memberIds.length) {
        log('مسئولان کار به‌روزرسانی شد', 'updated', 'task', taskId);
      }
      save();
    }

    function fields(listId) {
      return objects('fields')
        .filter((f) => f.listId === listId)
        .map((f) => ({ id: f.id, listId: f.listId, name: f.name, type: f.type || 'text' }));
    }

    function createField(listId, name, type) {
      const field = { id: uid(), listId, name, type: type || 'text' };
      arr('fields').push(field);
      save();
      return field;
    }

    function deleteField(fieldId) {
      removeWhere('fields', 'id', fieldId);
      removeWhere('values', 'fieldId', fieldId);
      save();
    }

    function fieldValues(taskId) {
      const map = {};
      for (const v of objects('values').filter((x) => x.taskId === taskId)) {
        map[v.fieldId] = v.value == null ? '' : String(v.value);
      }
      return map;
    }

    function setFieldValue(taskId, fieldId, value) {
      bundle.values = arr('values').filter(
        (v) => !(v.taskId === taskId && v.fieldId === fieldId),
      );
      if (value != null && String(value).trim() !== '') {
        bundle.values.push({ id: uid(), fieldId, taskId, value: String(value) });
      }
      save();
    }

    // ---- Attachments (metadata; files live in the app data folder) -------
    function attachments(taskId) {
      return objects('attachments')
        .filter((a) => a.taskId === taskId)
        .map((a) => ({
          id: a.id, taskId: a.taskId, name: a.name || 'پیوست',
          fileName: a.fileName || '', mimeType: a.mimeType || '',
          size: num(a.size), createdAt: a.createdAt || null,
        }));
    }

    function addAttachment(taskId, input) {
      const item = {
        id: uid(), taskId, name: input.name || 'پیوست',
        fileName: input.fileName || '', mimeType: input.mimeType || '',
        size: num(input.size), createdAt: nowIso(),
      };
      arr('attachments').push(item);
      log(`پیوست «${item.name}» اضافه شد`, 'created', 'attachment', item.id);
      save();
      return item;
    }

    function deleteAttachment(attachmentId) {
      const item = findById('attachments', attachmentId);
      if (!item) return null;
      removeWhere('attachments', 'id', attachmentId);
      save();
      return item.fileName || null;
    }

    // ---- Views ----------------------------------------------------------
    function views(listId) {
      return objects('views')
        .filter((v) => v.listId === listId)
        .map((v) => ({
          id: v.id, listId, name: v.name,
          config: v.config || '{}', isDefault: Boolean(v.isDefault),
        }));
    }

    function saveView(listId, name, config) {
      const view = {
        id: uid(), listId, name,
        config: JSON.stringify(config || {}), isDefault: false,
      };
      arr('views').push(view);
      save();
      return view;
    }

    function deleteView(viewId) {
      removeWhere('views', 'id', viewId);
      save();
    }

    function setDefaultView(listId, viewId) {
      for (const view of objects('views')) {
        if (view.listId === listId) view.isDefault = view.id === viewId;
      }
      save();
    }

    // ---- Goals ----------------------------------------------------------
    function goals() {
      return objects('goals').map((goal) => {
        const target = objects('targets').find((t) => t.goalId === goal.id) || {};
        const targetValue = num(target.targetValue);
        const currentValue = num(target.currentValue);
        const progress = targetValue > 0
          ? Math.max(0, Math.min(100, Math.round((currentValue / targetValue) * 100)))
          : 0;
        return {
          id: goal.id, name: goal.name || '',
          currentValue, targetValue, progress,
          unit: target.unit || '', periodEnd: goal.periodEnd || null,
        };
      });
    }

    function createGoal(name, targetValue, currentValue) {
      const stamp = nowIso();
      const goalId = uid();
      arr('goals').push({
        id: goalId, workspaceId: workspace().id, name,
        folder: null, periodType: 'custom',
        periodStart: today(), periodEnd: J.addDays(today(), 30),
        progress: 0, createdAt: stamp, updatedAt: stamp,
      });
      const target = {
        id: uid(), goalId, name, type: 'number', unit: null,
        startValue: 0, currentValue: num(currentValue), targetValue: num(targetValue),
        weight: 1,
        progress: num(targetValue) > 0 ? Math.round((num(currentValue) / num(targetValue)) * 100) : 0,
      };
      arr('targets').push(target);
      log(`هدف «${name}» ساخته شد`, 'created', 'goal', goalId);
      save();
      return goalId;
    }

    function updateGoal(goalId, currentValue, targetValue) {
      const target = objects('targets').find((t) => t.goalId === goalId);
      if (!target) return;
      target.currentValue = num(currentValue);
      target.targetValue = num(targetValue);
      target.progress = target.targetValue > 0
        ? Math.max(0, Math.min(100, Math.round((target.currentValue / target.targetValue) * 100)))
        : 0;
      const goal = findById('goals', goalId);
      if (goal) {
        goal.progress = target.progress;
        goal.updatedAt = nowIso();
        log(`هدف «${goal.name}» به‌روزرسانی شد`, 'updated', 'goal', goalId);
      }
      save();
    }

    function deleteGoal(goalId) {
      removeWhere('goals', 'id', goalId);
      removeWhere('targets', 'goalId', goalId);
      removeWhere('targetTasks', 'goalId', goalId);
      save();
    }

    // ---- Automations ----------------------------------------------------
    function automations() {
      return objects('automations').map((a) => {
        const trigger = a.trigger || {};
        const action = (a.actions || [])[0] || {};
        const condition = (((a.conditions || {}).items) || [])[0] || {};
        return {
          id: a.id, name: a.name || 'اتوماسیون',
          enabled: a.enabled !== false,
          triggerType: trigger.type || 'task.status_changed',
          triggerTo: trigger.to || '',
          conditionPriority: condition.value || '',
          actionType: action.type || 'task.set_priority',
          actionValue: (action.params && (action.params.priority || action.params.status || action.params.tag || action.params.value)) || '',
        };
      });
    }

    function createAutomation(input) {
      const rule = {
        id: uid(),
        workspaceId: workspace().id,
        name: input.name,
        enabled: true,
        trigger: input.trigger || { type: 'task.status_changed' },
        conditions: input.conditions || { items: [] },
        actions: input.actions || [],
        createdAt: nowIso(),
      };
      arr('automations').push(rule);
      save();
      return rule;
    }

    function toggleAutomation(id, enabled) {
      const rule = findById('automations', id);
      if (rule) rule.enabled = Boolean(enabled);
      save();
    }

    function deleteAutomation(id) {
      removeWhere('automations', 'id', id);
      save();
    }

    function automationRuns(limit) {
      return objects('automationRuns')
        .slice()
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
        .slice(0, limit || 10);
    }

    let automating = false;
    function runAutomations(triggerType, task, toName) {
      if (automating) return;
      automating = true;
      try {
        for (const rule of objects('automations')) {
          if (rule.enabled === false) continue;
          const trigger = rule.trigger || {};
          if (trigger.type !== triggerType) continue;
          if (triggerType === 'task.status_changed' && trigger.to && toName && trigger.to !== toName) continue;
          const items = ((rule.conditions || {}).items) || [];
          const matches = items.every((c) => {
            if (c.field === 'priority') return String(task.priority || 'none') === String(c.value);
            return true;
          });
          if (!matches) continue;
          for (const action of rule.actions || []) applyAction(task, action);
          arr('automationRuns').push({
            id: uid(), automationId: rule.id, name: rule.name,
            status: 'success', triggerType, createdAt: nowIso(),
          });
          log(`اتوماسیون «${rule.name}» اجرا شد`, 'automation_run', 'automation', rule.id);
        }
      } finally {
        automating = false;
      }
    }

    function applyAction(task, action) {
      const type = action.type || '';
      const params = action.params || {};
      const value = params.priority ?? params.status ?? params.tag ?? params.value;
      if (type === 'task.set_priority' || type === 'priority') {
        if (value) task.priority = String(value);
      } else if (type === 'task.set_status' || type === 'status') {
        const st = objects('statuses').find((s) => s.id === value || s.name === value)
          || objects('statuses').find((s) => s.listId === task.listId && s.name === value);
        if (st) {
          task.statusId = st.id;
          task.completedAt = st.type === 'done' || st.type === 'closed' ? nowIso() : null;
        }
      } else if (type === 'task.assign' || type === 'assign') {
        const member = objects('members')[0];
        if (member) {
          const exists = objects('assignees').some(
            (a) => a.taskId === task.id && a.userId === member.id,
          );
          if (!exists) {
            arr('assignees').push({
              taskId: task.id, userId: member.id,
              email: member.email || '', estimateMs: null,
            });
          }
        }
      } else if (type === 'task.add_tag' || type === 'tag') {
        const name = params.tag || params.name || value;
        if (name) {
          let tag = objects('tags').find((t) => t.name === name);
          if (!tag) {
            tag = { id: uid(), workspaceId: workspace().id, name, color: '#6366f1' };
            arr('tags').push(tag);
          }
          if (!objects('taskTags').some((t) => t.taskId === task.id && t.tagId === tag.id)) {
            arr('taskTags').push({ taskId: task.id, tagId: tag.id });
          }
        }
      }
    }

    // ---- Import / export ------------------------------------------------
    function exportJson() {
      bundle.exportedAt = nowIso();
      return JSON.stringify(bundle, null, 2);
    }

    function isValidBundle(text) {
      try {
        const parsed = JSON.parse(text);
        return parsed && parsed.format === 'karnameh-export' && Boolean(parsed.workspace);
      } catch {
        return false;
      }
    }

    function importJson(text) {
      const parsed = JSON.parse(text);
      if (!parsed || parsed.format !== 'karnameh-export' || !parsed.workspace) {
        throw new Error('این فایل بستهٔ معتبر کارنامه نیست.');
      }
      bundle = ensureShape(parsed);
      save();
    }

    function reset() {
      bundle = starter();
      save();
    }

    return {
      raw: () => bundle,
      workspace, spaces, lists, allLists, listName, createSpace, createList,
      statuses, status, createStatus, deleteStatus, reorderStatuses,
      tasks, allTasks, task, createTask, updateTask, setStatus, deleteTask,
      timeEntries, addTimeEntry, deleteTimeEntry, todayMinutes,
      focusSessions, todayFocusMinutes, recordFocusSession,
      stats, dueSoon, last7Days, statusBreakdown, priorityBreakdown, workload,
      activity, search,
      tags, createTag, deleteTag, taskTags, setTaskTags,
      members, createMember, deleteMember, taskAssignees, setTaskAssignees,
      fields, createField, deleteField, fieldValues, setFieldValue,
      attachments, addAttachment, deleteAttachment,
      views, saveView, deleteView, setDefaultView,
      goals, createGoal, updateGoal, deleteGoal,
      automations, createAutomation, toggleAutomation, deleteAutomation, automationRuns,
      exportJson, isValidBundle, importJson, reset,
      isDone, taskForDescription,
    };
  }

  function normalizeText(value) {
    return String(value || '')
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/\u200c/g, ' ')
      .toLowerCase()
      .trim();
  }

  global.KarnamehStore = { createStore, starter, normalizeText };
})(window);
