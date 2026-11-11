/* Karnameh Windows — offline desktop UI (vanilla JS). */
(function () {
  const J = window.KJalali;
  const PRIORITIES = ['urgent', 'high', 'normal', 'low', 'none'];
  const LS = {
    data: 'karnameh.data',
    timer: 'karnameh.timer',
    theme: 'karnameh.theme',
  };

  let store = null;
  let timer = null;
  let toastTimer = null;
  let syncAdapter = null;
  let syncer = null;
  let syncDebounce = null;

  const state = {
    tab: 'home',
    spaceId: null,
    listId: null,
    view: 'list',
    query: '',
    filters: { statusId: '', priority: '', assigneeId: '', tagId: '', sortBy: 'position', groupBy: 'none' },
    detailTaskId: null,
    modal: null,
    searchOpen: false,
    searchQuery: '',
    searchFilters: { priority: '', assigneeId: '', tagId: '', listId: '' },
    cal: null,
    logFilter: 'day',
    logTaskId: '',
    focusTaskId: '',
    focusMode: 'focus',
    focusPreset: 25 * 60,
    reportPeriod: 'month',
    theme: 'light',
    dataDir: '',
    sync: { supported: false, linked: false, label: '', auto: true, busy: false, needsClick: false, status: null, kind: '' },
  };

  // ---------- utilities ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (value) =>
    String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const pad2 = (n) => String(n).padStart(2, '0');
  const todayIso = () => J.localIso();
  const fmtDate = (iso) => (iso ? J.isoToJalaali(iso) : '—');
  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${J.isoToJalaali(iso)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };
  const fmtMinutes = (minutes) => {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    if (m < 60) return `${m} دقیقه`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest === 0 ? `${h} ساعت` : `${h} ساعت و ${rest} دقیقه`;
  };
  const fmtClock = (minutes) => {
    const m = Math.max(0, Math.round(Number(minutes) || 0));
    return m < 60 ? `${m} دقیقه` : `${Math.floor(m / 60)}:${pad2(m % 60)}`;
  };
  const priorityLabel = (p) =>
    ({ urgent: 'فوری', high: 'زیاد', normal: 'معمولی', low: 'کم', none: 'بدون اولویت' }[p] || 'بدون اولویت');
  const priorityPill = (p) =>
    `<span class="pill ${p && p !== 'none' ? `p-${p}` : ''}">${priorityLabel(p)}</span>`;
  const statusOf = (id) => store.status(id);
  const listOf = (id) => store.allLists().find((l) => l.id === id) || null;
  const isDone = (row) => row.done;
  const openTasks = () => store.allTasks().filter((t) => !t.done);

  function workedText(task) {
    const worked = task.workedMinutes || 0;
    const estimate = task.estimateMs ? Math.round(task.estimateMs / 60000) : 0;
    if (estimate > 0) return `کارکرد: ${fmtClock(worked)} از ${fmtClock(estimate)}`;
    if (worked > 0) return `کارکرد: ${fmtClock(worked)}`;
    return 'بدون زمان';
  }

  function progressPct(task) {
    if (!task.estimateMs) return 0;
    const est = Math.round(task.estimateMs / 60000);
    return est > 0 ? Math.min(100, Math.round(((task.workedMinutes || 0) / est) * 100)) : 0;
  }

  function activeList() {
    const lists = store.allLists();
    return lists.find((l) => l.id === state.listId) || lists[0] || null;
  }

  function ensureSelection() {
    const spaces = store.spaces();
    if (!spaces.some((s) => s.id === state.spaceId)) state.spaceId = spaces[0] ? spaces[0].id : null;
    const lists = store.lists(state.spaceId);
    if (!lists.some((l) => l.id === state.listId)) state.listId = lists[0] ? lists[0].id : null;
  }

  function applyTheme() {
    let theme = state.theme;
    if (theme === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.dataset.theme = theme;
  }

  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast show';
    el.textContent = message;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  function persist(json) {
    scheduleSync();
    if (window.karnameh && window.karnameh.saveData) {
      window.karnameh.saveData(json);
    } else {
      try {
        localStorage.setItem(LS.data, json);
      } catch {
        toast('ذخیرهٔ داده‌ها ممکن نشد.');
      }
    }
  }

  function rerender() {
    const active = document.activeElement;
    const id = active && active.id;
    let start = null;
    let end = null;
    if (active && typeof active.selectionStart === 'number') {
      start = active.selectionStart;
      end = active.selectionEnd;
    }
    const modal = document.querySelector('.modal');
    const modalScroll = modal ? modal.scrollTop : 0;
    const pageScroll = window.scrollY;
    render();
    window.scrollTo(0, pageScroll);
    const nextModal = document.querySelector('.modal');
    if (nextModal) nextModal.scrollTop = modalScroll;
    if (id) {
      const el = document.getElementById(id);
      if (el) {
        el.focus();
        if (start != null) {
          try {
            el.setSelectionRange(start, end);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  // ---------- timer ----------
  function readTimer() {
    try {
      return JSON.parse(localStorage.getItem(LS.timer) || 'null');
    } catch {
      return null;
    }
  }
  function saveTimer() {
    if (timer) localStorage.setItem(LS.timer, JSON.stringify(timer));
    else localStorage.removeItem(LS.timer);
  }
  function elapsedSeconds() {
    if (!timer) return 0;
    const live = timer.runningSince ? Math.floor((Date.now() - timer.runningSince) / 1000) : 0;
    return Math.max(0, (timer.accumulatedSeconds || 0) + live);
  }
  function displaySeconds() {
    if (!timer) return 0;
    if (timer.mode === 'pomodoro') return Math.max(0, timer.targetSeconds - elapsedSeconds());
    return elapsedSeconds();
  }
  function startTimer(mode, taskId, targetSeconds) {
    timer = {
      mode: mode || 'focus',
      taskId: taskId || null,
      targetSeconds: targetSeconds || 25 * 60,
      accumulatedSeconds: 0,
      runningSince: Date.now(),
    };
    saveTimer();
    rerender();
  }
  function pauseTimer() {
    if (!timer || !timer.runningSince) return;
    timer.accumulatedSeconds = elapsedSeconds();
    timer.runningSince = null;
    saveTimer();
    rerender();
  }
  function resumeTimer() {
    if (!timer || timer.runningSince) return;
    timer.runningSince = Date.now();
    saveTimer();
    rerender();
  }
  function stopTimer(completed) {
    if (!timer) return;
    const seconds = elapsedSeconds();
    const wasPomodoro = timer.mode === 'pomodoro';
    if (seconds > 0) {
      store.recordFocusSession(timer.mode, timer.taskId, seconds, Boolean(completed));
    }
    timer = null;
    saveTimer();
    rerender();
    if (completed && wasPomodoro && typeof Notification !== 'undefined') {
      try {
        new Notification('کارنامه', { body: 'جلسهٔ تمرکز تمام شد.' });
      } catch {
        /* notifications may be unavailable */
      }
    }
    toast('زمان ثبت شد.');
  }
  function cancelTimer() {
    timer = null;
    saveTimer();
    rerender();
  }

  function tickTimer() {
    if (!timer || !timer.runningSince) return;
    const el = document.getElementById('big-timer');
    if (el) el.textContent = fmtElapsed(displaySeconds());
    const statusEl = document.getElementById('timer-status');
    if (statusEl) statusEl.textContent = 'در حال اجرا';
    if (timer.mode === 'pomodoro' && elapsedSeconds() >= timer.targetSeconds) {
      stopTimer(true);
    }
  }
  function fmtElapsed(seconds) {
    const s = Math.max(0, Math.round(seconds || 0));
    return `${pad2(Math.floor(s / 3600))}:${pad2(Math.floor((s % 3600) / 60))}:${pad2(s % 60)}`;
  }

  // ---------- shell ----------
  const NAV = [
    { id: 'home', label: 'خانه', icon: '⌂' },
    { id: 'tasks', label: 'کارها', icon: '▤' },
    { id: 'focus', label: 'تمرکز و زمان', icon: '◉' },
    { id: 'goals', label: 'اهداف', icon: '◎' },
    { id: 'more', label: 'بیشتر', icon: '⋯' },
  ];
  const TITLES = {
    home: 'خانه', tasks: 'کارها', focus: 'تمرکز و زمان', goals: 'اهداف', more: 'بیشتر', report: 'گزارش‌ها',
  };

  function shell() {
    const today = J.todayParts();
    const dateLabel = `${J.WEEKDAYS_FULL[J.weekdayIndex(todayIso())]} ${today.jd} ${J.MONTHS[today.jm - 1]} ${today.jy}`;
    return `
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">ک</div>
          <div>
            <div class="brand-title">کارنامه</div>
            <div class="brand-sub">نسخهٔ آفلاین ویندوز ۰.۷.۱</div>
          </div>
        </div>
        <div class="workspace">
          <strong>${esc(store.workspace().name)}</strong>
          ${dateLabel}
        </div>
        <nav class="nav">
          ${NAV.map((item) => `
            <button type="button" class="${state.tab === item.id ? 'active' : ''}"
              data-action="tab" data-id="${item.id}">
              <span class="ico">${item.icon}</span><span>${item.label}</span>
            </button>`).join('')}
        </nav>
        <div class="sidebar-foot">
          آفلاین — داده‌ها فقط روی همین رایانه ذخیره می‌شوند.<br />
          JSON قابل انتقال با نسخهٔ اندروید.
        </div>
      </aside>`;
  }

  function topbar() {
    const title = TITLES[state.tab] || 'کارنامه';
    return `
      <header class="topbar">
        ${state.tab === 'report'
          ? '<button type="button" class="btn sm ghost" data-action="tab" data-id="more">← بازگشت</button>'
          : ''}
        <div>
          <h1 class="page-title">${title}</h1>
          <div class="page-sub">${pageSubtitle()}</div>
        </div>
        <div class="spacer"></div>
        <button type="button" class="btn sm icon-btn" title="جستجو (Ctrl+K)" data-action="open-search">⌕</button>
        ${state.tab === 'tasks'
          ? '<button type="button" class="btn sm primary" data-action="add-task">＋ کار جدید</button>'
          : state.tab === 'goals'
            ? '<button type="button" class="btn sm primary" data-action="add-goal">＋ هدف جدید</button>'
            : ''}
      </header>`;
  }

  function pageSubtitle() {
    if (state.tab === 'tasks') {
      const list = activeList();
      return list ? `${store.listName(list.id)} · ${store.tasks(list.id).length} کار` : 'لیستی وجود ندارد';
    }
    if (state.tab === 'focus') return 'تایمر تمرکز، ثبت زمان و گزارش روزانه';
    if (state.tab === 'goals') return 'اهداف و پیشرفت';
    if (state.tab === 'more') return 'تنظیمات، داده‌ها و گزارش‌ها';
    if (state.tab === 'report') return 'خروجی اکسل و Google Sheets';
    return 'نمای کلی کارها و زمان';
  }

  function render() {
    applyTheme();
    ensureBootDefaults();
    const app = document.getElementById('app');
    app.innerHTML = `
      ${shell()}
      <div class="main">
        ${topbar()}
        <div class="content">${contentHtml()}</div>
      </div>
      ${state.detailTaskId ? taskDetailHtml() : ''}
      ${state.modal ? modalHtml() : ''}
      ${state.searchOpen ? searchHtml() : ''}`;
    const searchInput = document.getElementById('search-box');
    if (searchInput && state.tab === 'tasks' && state.query) searchInput.value = state.query;
  }

  function ensureBootDefaults() {
    if (!state.cal) {
      const t = J.todayParts();
      state.cal = { jy: t.jy, jm: t.jm };
    }
    if (!state.spaceId || !state.listId) ensureSelection();
  }

  function contentHtml() {
    switch (state.tab) {
      case 'tasks': return tasksHtml();
      case 'focus': return focusHtml();
      case 'goals': return goalsHtml();
      case 'more': return moreHtml();
      case 'report': return reportHtml();
      default: return homeHtml();
    }
  }

  // ---------- home ----------
  function homeHtml() {
    const stats = store.stats();
    const focusMinutes = store.todayFocusMinutes();
    const due = store.dueSoon();
    const days = store.last7Days();
    const max = Math.max(1, ...days.map((d) => d.minutes));
    const activity = store.activity(8);
    const today = J.todayParts();
    return `
      <div class="card" style="background:linear-gradient(120deg,var(--primary-soft),var(--surface));">
        <div class="row between wrap">
          <div>
            <div style="font-size:18px;font-weight:700;">سلام 👋</div>
            <div class="small muted">${J.WEEKDAYS_FULL[J.weekdayIndex(todayIso())]} ${today.jd} ${J.MONTHS[today.jm - 1]} ${today.jy}</div>
          </div>
          <div class="chips">
            <button type="button" class="btn sm primary" data-action="add-task">＋ کار جدید</button>
            <button type="button" class="btn sm" data-action="tab" data-id="focus">شروع تمرکز</button>
            <button type="button" class="btn sm" data-action="tab" data-id="report">گزارش</button>
          </div>
        </div>
      </div>
      <div class="grid grid-4" style="margin-top:12px;">
        ${statCard('کار باز', stats.openTasks)}
        ${statCard('انجام‌شدهٔ امروز', stats.doneToday)}
        ${statCard('زمان امروز', fmtMinutes(stats.todayMinutes))}
        ${statCard('تمرکز امروز', fmtMinutes(focusMinutes))}
      </div>
      <div class="grid grid-2" style="margin-top:14px;align-items:start;">
        <div class="card">
          <h3 class="card-title">سررسید و عقب‌افتاده</h3>
          ${due.length === 0 ? '<div class="empty">کاری برای امروز یا گذشته باقی نمانده.</div>' : `
            <div class="list">
              ${due.slice(0, 8).map((t) => taskCard(t)).join('')}
            </div>`}
        </div>
        <div class="card">
          <h3 class="card-title">۷ روز اخیر</h3>
          <div class="bars">
            ${days.map((d) => `
              <div class="bar-wrap" title="${d.jd} · ${fmtMinutes(d.minutes)}">
                <div class="bar" style="height:${Math.max(2, Math.round((d.minutes / max) * 92))}%"></div>
                <div class="bar-label">${d.jd.slice(5)}</div>
              </div>`).join('')}
          </div>
          <div class="small muted" style="margin-top:6px;">جمع: ${fmtMinutes(days.reduce((s, d) => s + d.minutes, 0))}</div>
        </div>
      </div>
      <div class="card" style="margin-top:14px;">
        <h3 class="card-title">آخرین فعالیت‌ها</h3>
        ${activity.length === 0 ? '<div class="empty">فعلاً فعالیتی ثبت نشده.</div>' : `
          <div class="list">
            ${activity.map((a) => `
              <div class="row between" style="border-bottom:1px solid var(--border);padding:6px 2px;">
                <span class="small">${esc(a.title)}</span>
                <span class="tiny muted">${fmtDateTime(a.createdAt)}</span>
              </div>`).join('')}
          </div>`}
      </div>`;
  }

  function statCard(label, value) {
    return `<div class="stat"><div class="stat-value">${esc(value)}</div><div class="stat-label">${label}</div></div>`;
  }

  // ---------- tasks ----------
  function filteredTasks() {
    let rows = store.tasks(state.listId, state.query);
    const f = state.filters;
    if (f.statusId) rows = rows.filter((t) => t.statusId === f.statusId);
    if (f.priority) rows = rows.filter((t) => (t.priority || 'none') === f.priority);
    if (f.assigneeId) rows = rows.filter((t) => t.assignees.some((a) => a.id === f.assigneeId));
    if (f.tagId) rows = rows.filter((t) => t.tags.some((tag) => tag.id === f.tagId));
    switch (f.sortBy) {
      case 'title': rows.sort((a, b) => a.title.localeCompare(b.title, 'fa')); break;
      case 'dueDate': rows.sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'))); break;
      case 'priority': rows.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)); break;
      default: break;
    }
    return rows;
  }

  function tasksHtml() {
    ensureSelection();
    const spaces = store.spaces();
    const lists = store.lists(state.spaceId);
    if (spaces.length === 0) {
      return `<div class="empty">هنوز فضایی نداری. <button class="btn sm" data-action="add-space">ساخت فضا</button></div>`;
    }
    const statuses = store.statuses(state.listId);
    const members = store.members();
    const tags = store.tags();
    const rows = filteredTasks();
    const views = store.views(state.listId);
    const filtersActive = ['statusId', 'priority', 'assigneeId', 'tagId'].filter((k) => state.filters[k]).length;
    return `
      <div class="toolbar">
        <select class="select" style="width:150px" data-change="space">
          ${spaces.map((s) => `<option value="${s.id}" ${s.id === state.spaceId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
        <select class="select" style="width:160px" data-change="list">
          ${lists.map((l) => `<option value="${l.id}" ${l.id === state.listId ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
        </select>
        <input class="input" id="task-search" data-input="query" placeholder="جستجو در کارها…" value="${esc(state.query)}" />
        <button type="button" class="btn sm" data-action="add-list" ${state.spaceId ? '' : 'disabled'}>＋ لیست</button>
        <button type="button" class="btn sm" data-action="add-space">＋ فضا</button>
        ${state.view === 'board' ? '<button type="button" class="btn sm" data-action="add-status">＋ ستون</button>' : ''}
        <div class="spacer"></div>
        <select class="select" style="width:150px" data-change="view">
          ${[['list', 'لیست'], ['board', 'برد'], ['table', 'جدول'], ['calendar', 'تقویم'], ['gantt', 'گانت'], ['timeline', 'تایم‌لاین'], ['workload', 'بار کاری']]
            .map(([v, label]) => `<option value="${v}" ${state.view === v ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="card tight" style="margin-bottom:12px;">
        <div class="row wrap">
          <span class="small muted">فیلترها${filtersActive ? ` (${filtersActive})` : ''}:</span>
          <select class="select" style="width:130px" data-change="filter-status">
            <option value="">همهٔ وضعیت‌ها</option>
            ${statuses.map((s) => `<option value="${s.id}" ${state.filters.statusId === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
          <select class="select" style="width:110px" data-change="filter-priority">
            <option value="">همهٔ اولویت‌ها</option>
            ${PRIORITIES.map((p) => `<option value="${p}" ${state.filters.priority === p ? 'selected' : ''}>${priorityLabel(p)}</option>`).join('')}
          </select>
          <select class="select" style="width:120px" data-change="filter-assignee">
            <option value="">همهٔ مسئولان</option>
            ${members.map((m) => `<option value="${m.id}" ${state.filters.assigneeId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
          </select>
          <select class="select" style="width:120px" data-change="filter-tag">
            <option value="">همهٔ برچسب‌ها</option>
            ${tags.map((t) => `<option value="${t.id}" ${state.filters.tagId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
          </select>
          <select class="select" style="width:110px" data-change="filter-sort">
            <option value="position" ${state.filters.sortBy === 'position' ? 'selected' : ''}>پیش‌فرض</option>
            <option value="dueDate" ${state.filters.sortBy === 'dueDate' ? 'selected' : ''}>سررسید</option>
            <option value="priority" ${state.filters.sortBy === 'priority' ? 'selected' : ''}>اولویت</option>
            <option value="title" ${state.filters.sortBy === 'title' ? 'selected' : ''}>عنوان</option>
          </select>
          <select class="select" style="width:110px" data-change="filter-group">
            <option value="none" ${state.filters.groupBy === 'none' ? 'selected' : ''}>بدون گروه</option>
            <option value="status" ${state.filters.groupBy === 'status' ? 'selected' : ''}>گروه: وضعیت</option>
          </select>
          <div class="spacer"></div>
          <select class="select" style="width:150px" data-change="apply-view">
            <option value="">ویوهای ذخیره‌شده</option>
            ${views.map((v) => `<option value="${v.id}">${esc(v.name)}${v.isDefault ? ' ★' : ''}</option>`).join('')}
          </select>
          <button type="button" class="btn sm" data-action="save-view">ذخیرهٔ ویو</button>
          <button type="button" class="btn sm ghost" data-action="clear-filters">پاک‌کردن</button>
        </div>
      </div>
      ${rows.length === 0 && ['list', 'board'].includes(state.view)
        ? '<div class="empty">کاری با این فیلترها پیدا نشد. <button class="btn sm" data-action="add-task">کار جدید</button></div>'
        : viewHtml(rows)}`;
  }

  function viewHtml(rows) {
    switch (state.view) {
      case 'board': return boardHtml(rows);
      case 'table': return tableHtml(rows);
      case 'calendar': return calendarHtml(rows);
      case 'gantt': return ganttHtml(rows);
      case 'timeline': return timelineHtml(rows);
      case 'workload': return workloadHtml();
      default: return listHtml(rows);
    }
  }

  function taskCard(task) {
    const status = statusOf(task.statusId);
    const pct = progressPct(task);
    const over = task.estimateMs && task.workedMinutes > Math.round(task.estimateMs / 60000);
    return `
      <div class="task-card" data-action="open-task" data-id="${task.id}">
        <div style="flex:1;min-width:0;">
          <div class="title" style="${task.done ? 'color:var(--muted)' : ''}">${esc(task.title)}</div>
          <div class="meta">
            ${status ? `<span class="pill">${esc(status.name)}</span>` : ''}
            ${priorityPill(task.priority)}
            ${task.dueDate ? `<span class="small muted">پایان: ${fmtDate(task.dueDate)}${task.dueTime ? ` <span dir="ltr">${esc(task.dueTime)}</span>` : ''}</span>` : ''}
            <span class="small muted">${workedText(task)}</span>
            ${task.tags.map((t) => `<span class="pill tag">${esc(t.name)}</span>`).join('')}
            ${task.assignees.map((a) => `<span class="pill">${esc(a.name)}</span>`).join('')}
          </div>
          ${task.estimateMs ? `<div class="progress ${over ? 'over' : ''}"><span style="width:${pct}%"></span></div>` : ''}
        </div>
      </div>`;
  }

  function listHtml(rows) {
    if (state.filters.groupBy === 'status') {
      return store.statuses(state.listId).map((status) => {
        const group = rows.filter((t) => t.statusId === status.id);
        if (!group.length) return '';
        return `<div class="section-title">${esc(status.name)} · ${group.length}</div>
          <div class="list">${group.map(taskCard).join('')}</div>`;
      }).join('') || '<div class="empty">کاری نیست.</div>';
    }
    return `<div class="list">${rows.map(taskCard).join('')}</div>`;
  }

  function boardHtml(rows) {
    const statuses = store.statuses(state.listId);
    return `
      <div class="board">
        ${statuses.map((status) => {
          const group = rows.filter((t) => t.statusId === status.id);
          return `
            <div class="column">
              <div class="column-head">
                <span class="dot" style="background:${status.color}"></span>
                <span style="flex:1">${esc(status.name)}</span>
                <span class="tiny muted">${group.length}</span>
              </div>
              ${group.map(taskCard).join('')}
            </div>`;
        }).join('')}
        <div class="column" style="display:grid;place-items:center;">
          <button type="button" class="btn sm" data-action="add-status">＋ افزودن ستون</button>
        </div>
      </div>`;
  }

  function tableHtml(rows) {
    const statuses = store.statuses(state.listId);
    return `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>عنوان</th><th>وضعیت</th><th>اولویت</th><th>کارکرد / تخمین</th>
            <th>شروع</th><th>پایان</th><th>مسئول</th>
          </tr></thead>
          <tbody>
            ${rows.map((t) => {
              const status = statuses.find((s) => s.id === t.statusId);
              return `<tr data-action="open-task" data-id="${t.id}" style="cursor:pointer">
                <td>${esc(t.title)}</td>
                <td>${status ? esc(status.name) : '—'}</td>
                <td>${priorityLabel(t.priority)}</td>
                <td>${workedText(t)}</td>
                <td>${t.startDate ? fmtDate(t.startDate) : '—'}</td>
                <td>${t.dueDate ? fmtDate(t.dueDate) : '—'}</td>
                <td>${esc(t.assignees.map((a) => a.name).join('، ')) || '—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function calendarHtml(rows) {
    const { jy, jm } = state.cal;
    const days = J.daysInMonth(jy, jm);
    const first = J.firstWeekday(jy, jm);
    const byDay = {};
    for (const t of rows) {
      if (t.dueDate) (byDay[t.dueDate] = byDay[t.dueDate] || []).push(t);
    }
    const today = todayIso();
    const cells = [];
    for (let i = 0; i < first; i += 1) cells.push('<div class="day empty"></div>');
    for (let d = 1; d <= days; d += 1) {
      const iso = J.jalaaliToIso(jy, jm, d);
      const items = byDay[iso] || [];
      cells.push(`
        <div class="day ${iso === today ? 'today' : ''}">
          <div class="num">${d}</div>
          ${items.slice(0, 3).map((t) => `<span class="chip-task" data-action="open-task" data-id="${t.id}" title="${esc(t.title)}">${esc(t.title)}</span>`).join('')}
          ${items.length > 3 ? `<span class="tiny muted">+${items.length - 3}</span>` : ''}
        </div>`);
    }
    return `
      <div class="card">
        <div class="row between" style="margin-bottom:8px;">
          <button type="button" class="btn sm" data-action="cal-prev">‹</button>
          <strong>${J.MONTHS[jm - 1]} ${jy}</strong>
          <div class="row">
            <button type="button" class="btn sm" data-action="cal-today">امروز</button>
            <button type="button" class="btn sm" data-action="cal-next">›</button>
          </div>
        </div>
        <div class="calendar">
          ${J.WEEKDAYS.map((d) => `<div class="dow">${d}</div>`).join('')}
          ${cells.join('')}
        </div>
      </div>`;
  }

  function ganttHtml(rows) {
    const dated = rows.filter((t) => t.startDate || t.dueDate);
    if (!dated.length) return '<div class="empty">کاری با تاریخ شروع/پایان نیست.</div>';
    const all = [];
    dated.forEach((t) => {
      if (t.startDate) all.push(t.startDate);
      if (t.dueDate) all.push(t.dueDate);
    });
    all.sort();
    const min = all[0];
    const max = all[all.length - 1];
    const total = Math.max(1, Math.round((new Date(`${max}T00:00:00Z`) - new Date(`${min}T00:00:00Z`)) / 86400000) + 1);
    return `
      <div class="card gantt">
        <div class="small muted" style="margin-bottom:6px;">${fmtDate(min)} تا ${fmtDate(max)}</div>
        ${dated.map((t) => {
          const start = t.startDate || t.dueDate;
          const end = t.dueDate || t.startDate;
          const offset = Math.round((new Date(`${start}T00:00:00Z`) - new Date(`${min}T00:00:00Z`)) / 86400000);
          const span = Math.max(1, Math.round((new Date(`${end}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000) + 1);
          const left = (offset / total) * 100;
          const width = (span / total) * 100;
          return `<div class="gantt-row">
            <div class="gantt-name" title="${esc(t.title)}" data-action="open-task" data-id="${t.id}">${esc(t.title)}</div>
            <div class="gantt-track"><div class="gantt-bar" style="left:${left}%;width:${width}%"></div></div>
          </div>`;
        }).join('')}
      </div>`;
  }

  function timelineHtml(rows) {
    const groups = {};
    rows.forEach((t) => {
      const key = t.dueDate || 'none';
      (groups[key] = groups[key] || []).push(t);
    });
    const keys = Object.keys(groups).sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : a.localeCompare(b)));
    return keys.map((key) => `
      <div class="timeline-group">
        <div class="timeline-head"><span>${key === 'none' ? 'بدون تاریخ' : fmtDate(key)}</span><span>${groups[key].length} کار</span></div>
        <div class="list">${groups[key].map(taskCard).join('')}</div>
      </div>`).join('');
  }

  function workloadHtml() {
    const rows = store.workload();
    if (!rows.length) return '<div class="empty">عضوی ثبت نشده.</div>';
    return `
      <div class="grid grid-2">
        ${rows.map((r) => `
          <div class="card">
            <div class="row between">
              <strong>${esc(r.name)}</strong>
              <span class="pill">${r.openTasks} کار باز</span>
            </div>
            <div class="small muted" style="margin-top:4px;">تخمین: ${fmtMinutes(r.estimateMinutes)}</div>
          </div>`).join('')}
      </div>`;
  }

  // ---------- task detail ----------
  function taskDetailHtml() {
    const task = store.task(state.detailTaskId);
    if (!task) {
      state.detailTaskId = null;
      return '';
    }
    const statuses = store.statuses(task.listId);
    const members = store.members();
    const tags = store.tags();
    const fields = store.fields(task.listId);
    const attachments = store.attachments(task.id);
    const est = task.estimateMs ? Math.round(task.estimateMs / 60000) : 0;
    const estH = est ? Math.floor(est / 60) : '';
    const estM = est ? est % 60 : '';
    const pct = progressPct(task);
    const over = task.estimateMs && task.workedMinutes > est;
    return `
      <div class="modal-overlay" data-action="close-detail">
        <div class="modal" data-stop="1">
          <div class="modal-head">
            <h2 class="modal-title">جزئیات کار</h2>
            <button type="button" class="btn sm ghost" data-action="close-detail">بستن</button>
            <button type="button" class="btn sm danger" data-action="delete-task" data-id="${task.id}">حذف</button>
          </div>
          <div class="small muted">لیست: ${esc(store.listName(task.listId))}</div>
          <div class="field" style="margin-top:8px;">
            <label>عنوان</label>
            <input class="input" id="detail-title" data-change="task-title" data-id="${task.id}" value="${esc(task.title)}" />
          </div>
          <div class="grid grid-2">
            <div>
              <div class="field"><label>وضعیت</label>
                <div class="chips">
                  ${statuses.map((s) => `<button type="button" class="chip ${s.id === task.statusId ? 'active' : ''}" data-action="task-status" data-id="${s.id}">${esc(s.name)}</button>`).join('')}
                </div>
              </div>
              <div class="field"><label>اولویت</label>
                <div class="chips">
                  ${PRIORITIES.map((p) => `<button type="button" class="chip ${p === task.priority ? 'active' : ''}" data-action="task-priority" data-id="${p}">${priorityLabel(p)}</button>`).join('')}
                </div>
              </div>
              <div class="field"><label>مسئولان</label>
                <div class="chips">
                  ${members.length ? members.map((m) => {
                    const on = task.assignees.some((a) => a.id === m.id);
                    return `<button type="button" class="chip ${on ? 'active' : ''}" data-action="task-assignee" data-id="${m.id}">${esc(m.name)}</button>`;
                  }).join('') : '<span class="small muted">عضوی نیست.</span>'}
                  <button type="button" class="chip" data-action="add-member">＋ عضو</button>
                </div>
              </div>
              <div class="field"><label>برچسب‌ها</label>
                <div class="chips">
                  ${tags.map((t) => {
                    const on = task.tags.some((x) => x.id === t.id);
                    return `<button type="button" class="chip ${on ? 'active' : ''}" data-action="task-tag" data-id="${t.id}">${esc(t.name)}</button>`;
                  }).join('')}
                  <button type="button" class="chip" data-action="add-tag">＋ برچسب</button>
                </div>
              </div>
            </div>
            <div>
              <div class="field">
                <label>تاریخ شروع</label>
                <div class="row">
                  <button type="button" class="btn sm" data-action="pick-date" data-id="startDate">${task.startDate ? fmtDate(task.startDate) : 'انتخاب'}</button>
                  <button type="button" class="btn sm" data-action="pick-time" data-id="startTime"><span dir="ltr">${task.startTime || 'ساعت'}</span></button>
                  ${task.startDate ? `<button type="button" class="btn sm ghost" data-action="clear-date" data-id="startDate">پاک</button>` : ''}
                </div>
              </div>
              <div class="field">
                <label>تاریخ پایان</label>
                <div class="row">
                  <button type="button" class="btn sm" data-action="pick-date" data-id="dueDate">${task.dueDate ? fmtDate(task.dueDate) : 'انتخاب'}</button>
                  <button type="button" class="btn sm" data-action="pick-time" data-id="dueTime"><span dir="ltr">${task.dueTime || 'ساعت'}</span></button>
                  ${task.dueDate ? `<button type="button" class="btn sm ghost" data-action="clear-date" data-id="dueDate">پاک</button>` : ''}
                </div>
              </div>
              <div class="field">
                <label>تخمین زمان (ساعت و دقیقه)</label>
                <div class="estimate-grid">
                  <input class="input" type="number" min="0" id="est-hours" data-change="estimate" data-id="${task.id}" placeholder="ساعت" value="${estH}" />
                  <input class="input" type="number" min="0" id="est-minutes" data-change="estimate" data-id="${task.id}" placeholder="دقیقه" value="${estM}" />
                </div>
              </div>
              <div class="card tight" style="box-shadow:none;background:var(--surface-2);">
                <div class="small muted">زمان کار</div>
                <div style="font-weight:700;">${workedText(task)}</div>
                ${task.estimateMs ? `<div class="progress ${over ? 'over' : ''}"><span style="width:${pct}%"></span></div>` : ''}
              </div>
            </div>
          </div>
          <div class="field" style="margin-top:12px;">
            <label>توضیحات</label>
            <textarea class="textarea" id="detail-desc" data-change="task-desc" data-id="${task.id}">${esc(task.description)}</textarea>
          </div>
          ${fields.length ? `
            <div class="section-title">فیلدهای سفارشی</div>
            ${fields.map((f) => `
              <div class="field"><label>${esc(f.name)}</label>
                <input class="input" data-change="field-value" data-id="${f.id}" data-task="${task.id}" value="${esc(task.fieldValues[f.id] || '')}" />
              </div>`).join('')}` : ''}
          <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>پیوست‌ها (${attachments.length})</span>
            <button type="button" class="btn sm" data-action="attach-file">＋ افزودن</button>
          </div>
          ${attachments.length ? attachments.map((a) => `
            <div class="entry-row" style="margin-bottom:6px;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(a.name)}</div>
                <div class="tiny muted">${Math.max(1, Math.round(a.size / 1024))} KB</div>
              </div>
              <button type="button" class="btn sm ghost" data-action="open-attachment" data-id="${esc(a.fileName)}">باز کردن</button>
              <button type="button" class="btn sm ghost danger-text" data-action="delete-attachment" data-id="${a.id}">✕</button>
            </div>`).join('') : '<div class="small muted">پیوستی ثبت نشده.</div>'}
          <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>زیرکارها (${task.subtasks.length})</span>
            <button type="button" class="btn sm" data-action="add-subtask" data-id="${task.id}">＋ زیرکار</button>
          </div>
          ${task.subtasks.length ? task.subtasks.map((sub) => `
            <div class="entry-row" style="margin-bottom:6px;">
              <span style="flex:1;${sub.done ? 'color:var(--muted)' : ''}">${esc(sub.title)}</span>
              <button type="button" class="btn sm ghost" data-action="toggle-subtask" data-id="${sub.id}">${sub.done ? 'بازگشایی' : 'انجام شد'}</button>
              <button type="button" class="btn sm ghost" data-action="delete-task" data-id="${sub.id}">✕</button>
            </div>`).join('') : '<div class="small muted">زیرکاری ثبت نشده.</div>'}
        </div>
      </div>`;
  }

  // ---------- focus / time ----------
  function focusHtml() {
    const tasks = openTasks();
    const activeTask = timer && timer.taskId ? store.task(timer.taskId) : null;
    const selectedId = timer ? timer.taskId || '' : state.focusTaskId;
    const active = Boolean(timer);
    const mode = timer ? timer.mode : (state.focusMode || 'focus');
    const target = timer ? timer.targetSeconds : (state.focusPreset || 25 * 60);
    const entries = store.timeEntries();
    const filtered = filterEntries(entries);
    const groups = {};
    filtered.forEach((e) => {
      (groups[e.spentOn] = groups[e.spentOn] || []).push(e);
    });
    const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const logTaskOptions = store.allTasks().filter((t) => entries.some((e) => e.taskId === t.id));
    return `
      <div class="grid grid-2" style="align-items:start;">
        <div>
          <div class="card">
            <div class="chips" style="margin-bottom:10px;">
              <button type="button" class="chip ${mode === 'focus' ? 'active' : ''}" data-action="focus-mode" data-id="focus" ${active ? 'disabled' : ''}>تمرکز آزاد</button>
              <button type="button" class="chip ${mode === 'pomodoro' ? 'active' : ''}" data-action="focus-mode" data-id="pomodoro" ${active ? 'disabled' : ''}>پومودورو</button>
            </div>
            ${mode === 'pomodoro' && !active ? `
              <div class="chips" style="margin-bottom:10px;">
                ${[[25 * 60, '۲۵ دقیقه'], [50 * 60, '۵۰ دقیقه'], [5 * 60, '۵ دقیقه استراحت']]
                  .map(([s, label]) => `<button type="button" class="chip ${target === s ? 'active' : ''}" data-action="focus-preset" data-id="${s}">${label}</button>`).join('')}
              </div>` : ''}
            <div style="text-align:center;padding:10px 0;">
              <div id="big-timer" style="font-size:52px;font-weight:700;color:var(--primary);font-variant-numeric:tabular-nums;line-height:1.2;">${fmtElapsed(displaySeconds())}</div>
              <div class="small muted" id="timer-status">${!timer ? 'آمادهٔ شروع' : timer.runningSince ? 'در حال اجرا' : 'متوقف‌شده'}</div>
            </div>
            <div class="field">
              <label>کار مرتبط</label>
              <select class="select" data-change="focus-task" ${active ? 'disabled' : ''}>
                <option value="">بدون کار</option>
                ${tasks.map((t) => `<option value="${t.id}" ${selectedId === t.id ? 'selected' : ''}>${esc(t.title)}${t.workedMinutes ? ` — ${fmtClock(t.workedMinutes)}` : ''}</option>`).join('')}
              </select>
              ${activeTask ? `<div class="small muted" style="margin-top:4px;">${workedText(activeTask)}</div>` : ''}
            </div>
            <div class="row">
              ${!timer ? `<button type="button" class="btn primary" style="flex:1" data-action="start-timer">شروع</button>` : `
                ${timer.runningSince
                  ? `<button type="button" class="btn" style="flex:1" data-action="pause-timer">توقف موقت</button>`
                  : `<button type="button" class="btn" style="flex:1" data-action="resume-timer">ادامه</button>`}
                <button type="button" class="btn primary" style="flex:1" data-action="stop-timer">پایان و ثبت</button>
                <button type="button" class="btn danger" data-action="cancel-timer">صفر</button>`}
            </div>
            <div class="tiny muted" style="margin-top:8px;">با «پایان و ثبت»، زمان روی کار و در فهرست پایین ثبت می‌شود.</div>
          </div>
          <div class="grid grid-2" style="margin-top:10px;">
            ${statCard('تمرکز امروز', fmtMinutes(store.todayFocusMinutes()))}
            ${statCard('زمان امروز', fmtMinutes(store.todayMinutes()))}
          </div>
          <button type="button" class="btn" style="width:100%;margin-top:10px;" data-action="manual-entry">＋ ثبت زمان دستی</button>
        </div>
        <div class="card">
          <div class="row between wrap" style="margin-bottom:8px;">
            <h3 class="card-title" style="margin:0;">ثبت‌های زمان</h3>
          </div>
          <div class="chips" style="margin-bottom:8px;">
            ${[['day', 'روزانه'], ['week', 'هفتگی'], ['month', 'ماهانه'], ['task', 'بر اساس تسک'], ['all', 'همه']]
              .map(([key, label]) => `<button type="button" class="chip ${state.logFilter === key ? 'active' : ''}" data-action="log-filter" data-id="${key}">${label}</button>`).join('')}
          </div>
          ${state.logFilter === 'task' ? `
            <select class="select" style="margin-bottom:8px;" data-change="log-task">
              <option value="">یک تسک انتخاب کن</option>
              ${logTaskOptions.map((t) => `<option value="${t.id}" ${state.logTaskId === t.id ? 'selected' : ''}>${esc(t.title)}</option>`).join('')}
            </select>` : ''}
          <div class="row between" style="background:var(--surface-2);border-radius:10px;padding:8px 10px;margin-bottom:8px;">
            <div><div class="tiny muted">جمع این بازه</div><strong>${fmtMinutes(filtered.reduce((s, e) => s + e.minutes, 0))}</strong></div>
            <div><div class="tiny muted">تعداد ثبت</div><strong>${filtered.length}</strong></div>
          </div>
          ${filtered.length === 0 ? '<div class="empty">در این بازه چیزی ثبت نشده.</div>' : days.map((day) => `
            <div class="day-head"><span>${fmtDate(day)}</span><span>${fmtMinutes(groups[day].reduce((s, e) => s + e.minutes, 0))}</span></div>
            ${groups[day].map((e) => `
              <div class="entry-row" style="margin-bottom:5px;">
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(e.taskTitle || e.description || 'زمان ثبت‌شده')}</div>
                  <div class="tiny muted">${e.description && e.taskTitle ? `${esc(e.description)} · ` : ''}${fmtMinutes(e.minutes)}</div>
                </div>
                <button type="button" class="btn sm ghost danger-text" data-action="delete-entry" data-id="${e.id}">حذف</button>
              </div>`).join('')}`).join('')}
        </div>
      </div>`;
  }

  function filterEntries(entries) {
    const t = todayIso();
    switch (state.logFilter) {
      case 'day': return entries.filter((e) => e.spentOn === t);
      case 'week': return entries.filter((e) => e.spentOn >= J.addDays(t, -6) && e.spentOn <= t);
      case 'month': return entries.filter((e) => e.spentOn >= J.addDays(t, -29) && e.spentOn <= t);
      case 'task': return state.logTaskId ? entries.filter((e) => e.taskId === state.logTaskId) : [];
      default: return entries;
    }
  }

  // ---------- goals ----------
  function goalsHtml() {
    const goals = store.goals();
    return `
      ${goals.length === 0 ? '<div class="empty">هنوز هدفی نساخته‌ای. <button class="btn sm primary" data-action="add-goal">هدف جدید</button></div>' : `
        <div class="grid grid-2">
          ${goals.map((g) => `
            <div class="card">
              <div class="row between">
                <strong>${esc(g.name)}</strong>
                <span class="pill">${g.progress}%</span>
              </div>
              <div class="small muted" style="margin-top:4px;">${g.currentValue} از ${g.targetValue}${g.unit ? ` ${esc(g.unit)}` : ''}</div>
              <div class="progress"><span style="width:${g.progress}%"></span></div>
              <div class="row" style="margin-top:10px;">
                <button type="button" class="btn sm" data-action="edit-goal" data-id="${g.id}">به‌روزرسانی</button>
                <button type="button" class="btn sm ghost danger-text" data-action="delete-goal" data-id="${g.id}">حذف</button>
              </div>
            </div>`).join('')}
        </div>`}`;
  }

  // ---------- more ----------
  function moreHtml() {
    const stats = store.stats();
    const rules = store.automations();
    const manageList = activeList();
    const listFields = manageList ? store.fields(manageList.id) : [];
    return `
      <div class="grid grid-2" style="align-items:start;">
        <div class="card">
          <h3 class="card-title">ظاهر</h3>
          <div class="chips">
            ${[['light', 'روشن'], ['dark', 'تاریک'], ['system', 'سیستم']]
              .map(([key, label]) => `<button type="button" class="chip ${state.theme === key ? 'active' : ''}" data-action="theme" data-id="${key}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="card">
          <h3 class="card-title">گزارش‌ها</h3>
          <div class="small muted" style="margin-bottom:8px;">گزارش تسک‌ها و زمان‌ها برای Excel و Google Sheets.</div>
          <button type="button" class="btn primary" data-action="tab" data-id="report">بازکردن گزارش‌ها</button>
        </div>
        <div class="card">
          <h3 class="card-title">داده‌ها</h3>
          <div class="row wrap">
            <button type="button" class="btn" data-action="export-json">اکسپورت JSON</button>
            <button type="button" class="btn" data-action="import-json">ایمپورت JSON</button>
            <button type="button" class="btn danger" data-action="reset-data">بازنشانی همهٔ داده‌ها</button>
          </div>
          <div class="tiny muted" style="margin-top:8px;">فایل JSON همان قالب «karnameh-export» است و با نسخهٔ اندروید جابجا می‌شود.</div>
          ${state.dataDir ? `
            <div class="hr"></div>
            <div class="tiny muted">محل داده‌ها روی این رایانه:</div>
            <div class="tiny" dir="ltr" style="word-break:break-all;">${esc(state.dataDir)}</div>
            <div class="row" style="margin-top:8px;">
              <button type="button" class="btn sm" data-action="open-data-folder">بازکردن پوشهٔ داده</button>
            </div>
            <div class="tiny muted" style="margin-top:6px;">برای پاک‌سازی کامل: برنامه را ببندید و پوشهٔ <span dir="ltr">Karnameh-Data</span> را حذف کنید.</div>` : ''}
        </div>
        ${syncCardHtml()}
        <div class="card">
          <h3 class="card-title">آمار</h3>
          <div class="grid grid-3">
            ${statCard('کارها', stats.totalTasks)}
            ${statCard('باز', stats.openTasks)}
            ${statCard('عقب‌افتاده', stats.overdue)}
            ${statCard('فضاها', stats.spaces)}
            ${statCard('لیست‌ها', stats.lists)}
            ${statCard('اهداف', stats.goals)}
          </div>
        </div>
      </div>
      <div class="card" style="margin-top:14px;">
        <h3 class="card-title">مدیریت لیست «${esc(manageList ? manageList.name : '—')}»</h3>
        <div class="small muted" style="margin-bottom:6px;">فیلدهای سفارشی، برچسب‌ها و اعضا</div>
        <div class="chips">
          ${listFields.map((f) => `<button type="button" class="chip" data-action="delete-field" data-id="${f.id}" title="حذف">${esc(f.name)} ✕</button>`).join('')}
          <button type="button" class="chip" data-action="add-field">＋ فیلد</button>
        </div>
        <div class="chips" style="margin-top:8px;">
          ${store.tags().map((t) => `<button type="button" class="chip" data-action="delete-tag" data-id="${t.id}" title="حذف">${esc(t.name)} ✕</button>`).join('')}
          <button type="button" class="chip" data-action="add-tag">＋ برچسب</button>
        </div>
        <div class="chips" style="margin-top:8px;">
          ${store.members().map((m) => `<button type="button" class="chip" data-action="delete-member" data-id="${m.id}" title="حذف">${esc(m.name)} ✕</button>`).join('')}
          <button type="button" class="chip" data-action="add-member">＋ عضو</button>
        </div>
      </div>
      <div class="card" style="margin-top:14px;">
        <div class="row between">
          <h3 class="card-title" style="margin:0;">اتوماسیون‌های محلی</h3>
          <button type="button" class="btn sm" data-action="add-automation">＋ اتوماسیون</button>
        </div>
        ${rules.length === 0 ? '<div class="small muted">اتوماسیونی نساخته‌ای.</div>' : `
          <div class="list">
            ${rules.map((r) => `
              <div class="entry-row">
                <div style="flex:1">
                  <div style="font-weight:600;">${esc(r.name)}</div>
                  <div class="tiny muted">${automationText(r)}</div>
                </div>
                <label class="checkbox-row">
                  <input type="checkbox" ${r.enabled ? 'checked' : ''} data-change="automation-toggle" data-id="${r.id}" />
                  فعال
                </label>
                <button type="button" class="btn sm ghost danger-text" data-action="delete-automation" data-id="${r.id}">حذف</button>
              </div>`).join('')}
          </div>`}
      </div>
      <div class="card" style="margin-top:14px;">
        <h3 class="card-title">درباره</h3>
        <div class="small muted">کارنامه ویندوز ۰.۷.۱ — کاملاً آفلاین، بدون سرور و بدون اینترنت.<br />
          داده‌ها در <span class="kbd">karnameh.json</span> روی همین رایانه ذخیره می‌شوند.</div>
      </div>`;
  }

  function automationText(rule) {
    const trigger = rule.triggerType === 'task.created' ? 'ساخته‌شدن کار'
      : rule.triggerType === 'task.updated' ? 'ویرایش کار'
        : `تغییر وضعیت${rule.triggerTo ? ` به «${rule.triggerTo}»` : ''}`;
    const action = {
      'task.set_priority': 'اولویت', priority: 'اولویت', 'task.set_status': 'وضعیت', status: 'وضعیت',
      'task.assign': 'مسئول', assign: 'مسئول', 'task.add_tag': 'برچسب', tag: 'برچسب',
    }[rule.actionType] || rule.actionType;
    return `${trigger}${rule.conditionPriority ? ` و اولویت ${priorityLabel(rule.conditionPriority)}` : ''} ← ${action} ${rule.actionValue || ''}`;
  }

  // ---------- report ----------
  function periodIncludes(iso, period) {
    if (period === 'all') return true;
    if (!iso) return false;
    const d = String(iso).slice(0, 10);
    const t = todayIso();
    if (period === 'today') return d === t;
    if (period === 'week') return d >= J.addDays(t, -6) && d <= t;
    if (period === 'month') return d >= J.addDays(t, -29) && d <= t;
    return true;
  }

  function reportData() {
    const period = state.reportPeriod;
    const entries = store.timeEntries().filter((e) => periodIncludes(e.spentOn, period));
    const ids = new Set();
    const worked = {};
    entries.forEach((e) => {
      const match = e.taskId ? null : store.taskForDescription(e.description);
      const id = e.taskId || (match ? match.id : null);
      if (!id) return;
      ids.add(id);
      worked[id] = (worked[id] || 0) + e.minutes;
    });
    const tasks = store.allTasks().filter((t) =>
      period === 'all' || ids.has(t.id) || periodIncludes(t.completedAt, period) || periodIncludes(t.startDate, period) || periodIncludes(t.dueDate, period));
    return { tasks, entries, worked };
  }

  function reportRows(data) {
    const periodLabel = { today: 'امروز', week: '۷ روز اخیر', month: '۳۰ روز اخیر', all: 'همه' }[state.reportPeriod];
    const total = data.entries.reduce((s, e) => s + e.minutes, 0);
    const rows = [];
    rows.push(['گزارش کارنامه']);
    rows.push(['بازه', periodLabel]);
    rows.push(['تاریخ تولید', fmtDate(todayIso())]);
    rows.push(['جمع زمان ثبت‌شده (دقیقه)', String(total)]);
    rows.push([]);
    rows.push(['تسک‌ها']);
    rows.push(['عنوان', 'لیست', 'وضعیت', 'اولویت', 'تاریخ شروع', 'ساعت شروع', 'تاریخ پایان', 'ساعت پایان', 'تاریخ انجام', 'تخمین (دقیقه)', 'کارکرد در بازه (دقیقه)', 'مسئولان', 'برچسب‌ها']);
    data.tasks.forEach((t) => {
      rows.push([
        t.title, store.listName(t.listId), (statusOf(t.statusId) || {}).name || '—',
        priorityLabel(t.priority), fmtDate(t.startDate), t.startTime || '', fmtDate(t.dueDate),
        t.dueTime || '', fmtDate(t.completedAt ? String(t.completedAt).slice(0, 10) : null),
        t.estimateMs ? String(Math.round(t.estimateMs / 60000)) : '',
        String(data.worked[t.id] || 0),
        t.assignees.map((a) => a.name).join('، '), t.tags.map((x) => x.name).join('، '),
      ]);
    });
    rows.push([]);
    rows.push(['ثبت‌های زمان']);
    rows.push(['تاریخ (جلالی)', 'تاریخ (میلادی)', 'تسک', 'توضیح', 'دقیقه']);
    data.entries.forEach((e) => {
      const matched = e.taskTitle ? null : store.taskForDescription(e.description);
      rows.push([fmtDate(e.spentOn), e.spentOn, e.taskTitle || (matched && matched.title) || 'بدون تسک', e.description || '', String(e.minutes)]);
    });
    rows.push([]);
    rows.push(['جمع', '', '', '', String(total)]);
    return rows;
  }

  function renderDelimited(rows, delimiter) {
    const escape = (cell) => delimiter === ','
      ? `"${cell == null ? '' : String(cell).replace(/"/g, '""')}"`
      : (cell == null ? '' : String(cell)).replace(/\t/g, ' ').replace(/\n/g, ' ');
    return rows.map((row) => row.map(escape).join(delimiter)).join(delimiter === ',' ? '\r\n' : '\n');
  }

  function reportHtml() {
    const data = reportData();
    return `
      <div class="card">
        <div class="row between wrap">
          <div>
            <h3 class="card-title" style="margin:0;">گزارش کارنامه</h3>
            <div class="small muted">تسک‌ها و ثبت‌های زمان در بازهٔ انتخابی</div>
          </div>
          <div class="chips">
            ${[['today', 'امروز'], ['week', '۷ روز اخیر'], ['month', '۳۰ روز اخیر'], ['all', 'همه']]
              .map(([key, label]) => `<button type="button" class="chip ${state.reportPeriod === key ? 'active' : ''}" data-action="report-period" data-id="${key}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="grid grid-3" style="margin-top:12px;">
          ${statCard('تسک‌ها', data.tasks.length)}
          ${statCard('ثبت‌های زمان', data.entries.length)}
          ${statCard('زمان کل', fmtMinutes(data.entries.reduce((s, e) => s + e.minutes, 0)))}
        </div>
        <div class="row wrap" style="margin-top:12px;">
          <button type="button" class="btn primary" data-action="download-csv">دانلود اکسل (CSV)</button>
          <button type="button" class="btn" data-action="copy-tsv">کپی برای Google Sheets</button>
        </div>
        <div class="tiny muted" style="margin-top:6px;">فایل CSV در Excel باز می‌شود؛ متن کپی‌شده را می‌توانید در Google Sheets پیست کنید.</div>
      </div>
      <div class="grid grid-2" style="margin-top:14px;align-items:start;">
        <div class="card">
          <h3 class="card-title">تسک‌های این بازه</h3>
          ${data.tasks.length ? data.tasks.slice(0, 30).map((t) => `
            <div class="entry-row" style="margin-bottom:5px;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:12px;">${esc(t.title)}</div>
                <div class="tiny muted">${esc((statusOf(t.statusId) || {}).name || '—')} · کارکرد در بازه: ${fmtMinutes(data.worked[t.id] || 0)}</div>
              </div>
              ${priorityPill(t.priority)}
            </div>`).join('') : '<div class="small muted">در این بازه تسکی نیست.</div>'}
        </div>
        <div class="card">
          <h3 class="card-title">ثبت‌های زمان این بازه</h3>
          ${data.entries.length ? data.entries.slice(0, 30).map((e) => `
            <div class="entry-row" style="margin-bottom:5px;">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:12px;">${esc(e.taskTitle || (store.taskForDescription(e.description) || {}).title || e.description || 'بدون تسک')}</div>
                <div class="tiny muted">${fmtDate(e.spentOn)} · ${fmtMinutes(e.minutes)}</div>
              </div>
            </div>`).join('') : '<div class="small muted">در این بازه زمانی ثبت نشده.</div>'}
        </div>
      </div>`;
  }

  // ---------- search ----------
  function searchHtml() {
    const rows = store.allTasks(state.searchQuery).filter((t) => {
      const f = state.searchFilters;
      if (f.priority && (t.priority || 'none') !== f.priority) return false;
      if (f.assigneeId && !t.assignees.some((a) => a.id === f.assigneeId)) return false;
      if (f.tagId && !t.tags.some((x) => x.id === f.tagId)) return false;
      if (f.listId && t.listId !== f.listId) return false;
      return true;
    });
    return `
      <div class="search-overlay" data-action="close-search">
        <div class="search-panel" data-stop="1">
          <div class="row between">
            <h3 class="card-title" style="margin:0;">جستجوی پیشرفته</h3>
            <button type="button" class="btn sm ghost" data-action="close-search">بستن</button>
          </div>
          <input class="input" id="search-box" data-input="search-query" placeholder="متن جستجو…" value="${esc(state.searchQuery)}" style="margin-bottom:8px;" />
          <div class="row wrap" style="margin-bottom:10px;">
            <select class="select" style="width:120px" data-change="search-priority">
              <option value="">همهٔ اولویت‌ها</option>
              ${PRIORITIES.map((p) => `<option value="${p}" ${state.searchFilters.priority === p ? 'selected' : ''}>${priorityLabel(p)}</option>`).join('')}
            </select>
            <select class="select" style="width:130px" data-change="search-assignee">
              <option value="">همهٔ مسئولان</option>
              ${store.members().map((m) => `<option value="${m.id}" ${state.searchFilters.assigneeId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
            </select>
            <select class="select" style="width:130px" data-change="search-tag">
              <option value="">همهٔ برچسب‌ها</option>
              ${store.tags().map((t) => `<option value="${t.id}" ${state.searchFilters.tagId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
            </select>
            <select class="select" style="width:130px" data-change="search-list">
              <option value="">همهٔ لیست‌ها</option>
              ${store.allLists().map((l) => `<option value="${l.id}" ${state.searchFilters.listId === l.id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
            </select>
          </div>
          ${rows.length === 0 ? '<div class="empty">نتیجه‌ای پیدا نشد.</div>' : `<div class="list">${rows.slice(0, 40).map(taskCard).join('')}</div>`}
        </div>
      </div>`;
  }

  // ---------- modals ----------
  function modalHtml() {
    const modal = state.modal;
    if (!modal) return '';
    if (modal.type === 'date') return dateModalHtml(modal);
    if (modal.type === 'time') return timeModalHtml(modal);
    if (modal.type === 'manual') return manualModalHtml();
    if (modal.type === 'goal') return goalModalHtml(modal);
    if (modal.type === 'automation') return automationModalHtml();
    return nameModalHtml(modal);
  }

  function modalWrap(inner, wide) {
    return `
      <div class="modal-overlay" data-action="close-modal">
        <div class="modal ${wide ? 'wide' : 'narrow'}" data-stop="1">${inner}</div>
      </div>`;
  }

  function nameModalHtml(modal) {
    return modalWrap(`
      <div class="modal-head">
        <h2 class="modal-title">${esc(modal.title || '')}</h2>
        <button type="button" class="btn sm ghost" data-action="close-modal">بستن</button>
      </div>
      <div class="field">
        <label>${esc(modal.label || '')}</label>
        <input class="input" id="modal-text" value="${esc(modal.value || '')}" ${modal.number ? 'type="number" min="0"' : ''} />
      </div>
      ${modal.extra ? modal.extra : ''}
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">انصراف</button>
        <button type="button" class="btn primary" data-action="modal-submit">${esc(modal.confirm || 'ثبت')}</button>
      </div>`);
  }

  function dateModalHtml(modal) {
    const { jy, jm } = modal;
    const days = J.daysInMonth(jy, jm);
    const first = J.firstWeekday(jy, jm);
    const selected = modal.value ? J.isoToJalaali(modal.value) : '';
    const cells = [];
    for (let i = 0; i < first; i += 1) cells.push('<button disabled></button>');
    for (let d = 1; d <= days; d += 1) {
      const iso = J.jalaaliToIso(jy, jm, d);
      const sel = iso === modal.value;
      const today = iso === todayIso();
      cells.push(`<button type="button" class="${sel ? 'selected' : ''} ${today ? 'today' : ''}" data-action="date-pick" data-id="${iso}">${d}</button>`);
    }
    return modalWrap(`
      <div class="modal-head">
        <h2 class="modal-title">انتخاب تاریخ</h2>
        <button type="button" class="btn sm ghost" data-action="close-modal">بستن</button>
      </div>
      <div class="row between">
        <button type="button" class="btn sm" data-action="date-prev">‹</button>
        <strong>${J.MONTHS[jm - 1]} ${jy}</strong>
        <button type="button" class="btn sm" data-action="date-next">›</button>
      </div>
      <div class="date-grid">
        ${J.WEEKDAYS.map((d) => `<div class="dow">${d}</div>`).join('')}
        ${cells.join('')}
      </div>
      <div class="row between" style="margin-top:10px;">
        <button type="button" class="btn sm ghost danger-text" data-action="date-clear">پاک‌کردن</button>
        <button type="button" class="btn sm" data-action="date-today">امروز</button>
      </div>
      <div class="tiny muted" style="margin-top:6px;">انتخاب‌شده: ${selected || '—'}</div>`);
  }

  function timeModalHtml(modal) {
    const step = (part, delta) => {
      const max = part === 'hour' ? 24 : 60;
      let v = Number(modal[part]) + delta;
      v = ((v % max) + max) % max;
      modal[part] = v;
      rerender();
    };
    const h = modal.hour;
    const m = modal.minute;
    return modalWrap(`
      <div class="modal-head">
        <h2 class="modal-title">انتخاب ساعت</h2>
        <button type="button" class="btn sm ghost" data-action="close-modal">بستن</button>
      </div>
      <div class="wheel-row">
        <div class="wheel" data-wheel="hour">
          <button type="button" data-action="time-step" data-field="hour" data-delta="1">▲</button>
          <div class="value side" data-action="time-step" data-field="hour" data-delta="1">${pad2((h + 1) % 24)}</div>
          <div class="value">${pad2(h)}</div>
          <div class="value side" data-action="time-step" data-field="hour" data-delta="-1">${pad2((h - 1 + 24) % 24)}</div>
          <button type="button" data-action="time-step" data-field="hour" data-delta="-1">▼</button>
        </div>
        <div class="wheel" data-wheel="minute">
          <button type="button" data-action="time-step" data-field="minute" data-delta="1">▲</button>
          <div class="value side" data-action="time-step" data-field="minute" data-delta="1">${pad2((m + 1) % 60)}</div>
          <div class="value">${pad2(m)}</div>
          <div class="value side" data-action="time-step" data-field="minute" data-delta="-1">${pad2((m - 1 + 60) % 60)}</div>
          <button type="button" data-action="time-step" data-field="minute" data-delta="-1">▼</button>
        </div>
      </div>
      <div class="small muted" style="text-align:center;" dir="ltr">${pad2(h)}:${pad2(m)}</div>
      <div class="row between" style="margin-top:10px;">
        <button type="button" class="btn sm ghost" data-action="time-now">زمان حال</button>
        <div class="row">
          <button type="button" class="btn sm ghost" data-action="close-modal">انصراف</button>
          <button type="button" class="btn sm primary" data-action="time-confirm">تأیید</button>
        </div>
      </div>`);
  }

  function manualModalHtml() {
    const tasks = openTasks();
    const h = state.modal.hour || 0;
    const m = state.modal.minute || '';
    return modalWrap(`
      <div class="modal-head">
        <h2 class="modal-title">ثبت زمان دستی</h2>
        <button type="button" class="btn sm ghost" data-action="close-modal">بستن</button>
      </div>
      <div class="field"><label>کار</label>
        <select class="select" id="manual-task">
          <option value="">بدون کار</option>
          ${tasks.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('')}
        </select>
      </div>
      <div class="estimate-grid">
        <div class="field"><label>ساعت</label><input class="input" id="manual-hours" type="number" min="0" value="${h}" /></div>
        <div class="field"><label>دقیقه</label><input class="input" id="manual-minutes" type="number" min="0" value="${m}" /></div>
      </div>
      <div class="field"><label>توضیح (اختیاری)</label><input class="input" id="manual-desc" value="" /></div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">انصراف</button>
        <button type="button" class="btn primary" data-action="manual-submit">ثبت</button>
      </div>`);
  }

  function goalModalHtml(modal) {
    return modalWrap(`
      <div class="modal-head">
        <h2 class="modal-title">${modal.goalId ? 'به‌روزرسانی هدف' : 'هدف جدید'}</h2>
        <button type="button" class="btn sm ghost" data-action="close-modal">بستن</button>
      </div>
      ${modal.goalId ? '' : `<div class="field"><label>نام هدف</label><input class="input" id="goal-name" value="" /></div>`}
      <div class="estimate-grid">
        <div class="field"><label>مقدار فعلی</label><input class="input" id="goal-current" type="number" value="${modal.current || 0}" /></div>
        <div class="field"><label>مقدار هدف</label><input class="input" id="goal-target" type="number" value="${modal.target || 0}" /></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">انصراف</button>
        <button type="button" class="btn primary" data-action="goal-submit" data-id="${modal.goalId || ''}">ثبت</button>
      </div>`);
  }

  function automationModalHtml() {
    const statuses = store.statuses(state.listId);
    return modalWrap(`
      <div class="modal-head">
        <h2 class="modal-title">اتوماسیون جدید</h2>
        <button type="button" class="btn sm ghost" data-action="close-modal">بستن</button>
      </div>
      <div class="field"><label>نام</label><input class="input" id="auto-name" value="" /></div>
      <div class="field"><label>رویداد</label>
        <select class="select" id="auto-trigger">
          <option value="task.status_changed">وضعیت کار تغییر کرد</option>
          <option value="task.created">کار ساخته شد</option>
          <option value="task.updated">کار ویرایش شد</option>
        </select>
      </div>
      <div class="field"><label>وضعیت مقصد (برای رویداد وضعیت)</label>
        <select class="select" id="auto-to">
          <option value="">هر وضعیتی</option>
          ${statuses.map((s) => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>شرط اولویت</label>
        <select class="select" id="auto-priority">
          <option value="">بدون شرط</option>
          ${PRIORITIES.map((p) => `<option value="${p}">${priorityLabel(p)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>اقدام</label>
        <select class="select" id="auto-action">
          <option value="priority">تغییر اولویت</option>
          <option value="status">تغییر وضعیت</option>
          <option value="tag">افزودن برچسب</option>
          <option value="assign">اختصاص به خودم</option>
        </select>
      </div>
      <div class="field"><label>مقدار اقدام</label><input class="input" id="auto-value" placeholder="مثلاً زیاد / انجام شد / نام برچسب" /></div>
      <div class="modal-actions">
        <button type="button" class="btn ghost" data-action="close-modal">انصراف</button>
        <button type="button" class="btn primary" data-action="automation-submit">ایجاد</button>
      </div>`);
  }

  // ---------- actions ----------
  const actions = {
    tab(id) {
      state.tab = id;
      state.detailTaskId = null;
      state.searchOpen = false;
      state.modal = null;
      if (id === 'tasks') ensureSelection();
      rerender();
    },
    'open-task'(id) {
      state.detailTaskId = id;
      state.searchOpen = false;
      rerender();
    },
    'close-detail'() {
      state.detailTaskId = null;
      rerender();
    },
    'open-search'() {
      state.searchOpen = true;
      state.searchQuery = '';
      rerender();
    },
    'close-search'() {
      state.searchOpen = false;
      rerender();
    },
    'tab-report'() {
      state.tab = 'report';
      rerender();
    },
    'add-task'() {
      ensureSelection();
      if (!state.listId) return;
      state.modal = { type: 'name', title: 'کار جدید', label: 'عنوان کار', submit: 'create-task', value: '' };
      rerender();
    },
    'add-space'() {
      state.modal = { type: 'name', title: 'فضای جدید', label: 'نام فضا', submit: 'create-space', value: '' };
      rerender();
    },
    'add-list'() {
      state.modal = { type: 'name', title: 'لیست جدید', label: 'نام لیست', submit: 'create-list', value: '' };
      rerender();
    },
    'add-status'() {
      state.modal = { type: 'name', title: 'ستون جدید', label: 'نام ستون (وضعیت)', submit: 'create-status', value: '' };
      rerender();
    },
    'add-tag'() {
      state.modal = { type: 'name', title: 'برچسب جدید', label: 'نام برچسب', submit: 'create-tag', value: '' };
      rerender();
    },
    'add-member'() {
      state.modal = { type: 'name', title: 'عضو جدید', label: 'نام عضو', submit: 'create-member', value: '' };
      rerender();
    },
    'add-field'() {
      state.modal = { type: 'name', title: 'فیلد سفارشی جدید', label: 'نام فیلد', submit: 'create-field', value: '' };
      rerender();
    },
    'delete-field'(id) {
      if (!confirm('این فیلد و مقدارهایش حذف شوند؟')) return;
      store.deleteField(id);
      rerender();
    },
    'delete-tag'(id) {
      if (!confirm('این برچسب حذف شود؟')) return;
      store.deleteTag(id);
      rerender();
    },
    'delete-member'(id) {
      if (!confirm('این عضو حذف شود؟')) return;
      store.deleteMember(id);
      rerender();
    },
    'add-goal'() {
      state.modal = { type: 'goal', current: 0, target: 10 };
      rerender();
    },
    'add-automation'() {
      state.modal = { type: 'automation' };
      rerender();
    },
    'add-subtask'(id) {
      state.modal = { type: 'name', title: 'زیرکار جدید', label: 'عنوان زیرکار', submit: 'create-subtask', value: '', parentId: id };
      rerender();
    },
    'manual-entry'() {
      state.modal = { type: 'manual', hour: 0, minute: 30 };
      rerender();
    },
    'manual-submit'() {
      const taskId = ((document.getElementById('manual-task') || {}).value) || null;
      const hours = Number((document.getElementById('manual-hours') || {}).value || 0);
      const minutes = Number((document.getElementById('manual-minutes') || {}).value || 0);
      const total = Math.max(0, hours) * 60 + Math.max(0, minutes);
      if (total <= 0) {
        toast('ساعت یا دقیقه را وارد کنید.');
        return;
      }
      const description = ((document.getElementById('manual-desc') || {}).value || '').trim();
      store.addTimeEntry(taskId, total, description || null);
      state.modal = null;
      rerender();
      toast('زمان ثبت شد.');
    },
    'close-modal'() {
      state.modal = null;
      rerender();
    },
    'modal-submit'() {
      const value = (document.getElementById('modal-text') || {}).value || '';
      const submit = state.modal.submit;
      if (!value.trim()) return;
      switch (submit) {
        case 'create-task':
          if (!state.listId) return;
          store.createTask(state.listId, value.trim());
          break;
        case 'create-space': {
          const space = store.createSpace(value.trim());
          state.spaceId = space.id;
          state.listId = null;
          ensureSelection();
          break;
        }
        case 'create-list': {
          const list = store.createList(state.spaceId, value.trim());
          state.listId = list.id;
          break;
        }
        case 'create-status':
          store.createStatus(state.listId, value.trim());
          break;
        case 'create-tag':
          store.createTag(value.trim());
          break;
        case 'create-member':
          store.createMember(value.trim());
          break;
        case 'create-field':
          if (state.listId) store.createField(state.listId, value.trim(), 'text');
          break;
        case 'create-subtask':
          store.createTask(state.listId, value.trim(), state.modal.parentId);
          break;
        case 'save-view':
          store.saveView(state.listId, value.trim(), state.filters);
          break;
        default:
          break;
      }
      state.modal = null;
      rerender();
      toast('ثبت شد.');
    },
    'task-status'(id) {
      store.setStatus(state.detailTaskId, id);
      rerender();
    },
    'task-priority'(id) {
      store.updateTask(state.detailTaskId, { priority: id });
      rerender();
    },
    'task-assignee'(id) {
      const task = store.task(state.detailTaskId);
      const ids = task.assignees.map((a) => a.id);
      if (ids.includes(id)) ids.splice(ids.indexOf(id), 1);
      else ids.push(id);
      store.setTaskAssignees(state.detailTaskId, ids);
      rerender();
    },
    'task-tag'(id) {
      const task = store.task(state.detailTaskId);
      const ids = task.tags.map((t) => t.id);
      if (ids.includes(id)) ids.splice(ids.indexOf(id), 1);
      else ids.push(id);
      store.setTaskTags(state.detailTaskId, ids);
      rerender();
    },
    'pick-date'(field) {
      const task = store.task(state.detailTaskId);
      const iso = task[field] || todayIso();
      const j = J.isoParts(iso);
      const jp = J.toJalaali(j.gy, j.gm, j.gd);
      state.modal = { type: 'date', field, value: task[field] || '', jy: jp.jy, jm: jp.jm };
      rerender();
    },
    'clear-date'(field) {
      store.updateTask(state.detailTaskId, { [field]: null });
      rerender();
    },
    'date-prev'() {
      const m = state.modal;
      if (m.jm === 1) { m.jm = 12; m.jy -= 1; } else m.jm -= 1;
      rerender();
    },
    'date-next'() {
      const m = state.modal;
      if (m.jm === 12) { m.jm = 1; m.jy += 1; } else m.jm += 1;
      rerender();
    },
    'date-pick'(iso) {
      store.updateTask(state.detailTaskId, { [state.modal.field]: iso });
      state.modal = null;
      rerender();
    },
    'date-clear'() {
      store.updateTask(state.detailTaskId, { [state.modal.field]: null });
      state.modal = null;
      rerender();
    },
    'date-today'() {
      store.updateTask(state.detailTaskId, { [state.modal.field]: todayIso() });
      state.modal = null;
      rerender();
    },
    'pick-time'(field) {
      const task = store.task(state.detailTaskId);
      const value = task[field] || '';
      const now = new Date();
      const [h, m] = value ? value.split(':').map(Number) : [now.getHours(), now.getMinutes()];
      state.modal = { type: 'time', field, hour: h, minute: m };
      rerender();
    },
    'time-step'(field) {
      const el = document.querySelector('[data-action="time-step"][data-field="' + field + '"]');
      // handled via data attributes in the click dispatcher
    },
    'time-confirm'() {
      const m = state.modal;
      store.updateTask(state.detailTaskId, { [m.field]: `${pad2(m.hour)}:${pad2(m.minute)}` });
      state.modal = null;
      rerender();
    },
    'time-now'() {
      const now = new Date();
      state.modal.hour = now.getHours();
      state.modal.minute = now.getMinutes();
      rerender();
    },
    async 'attach-file'() {
      if (!window.karnameh || !window.karnameh.attachFile) {
        toast('افزودن پیوست فقط در نسخهٔ ویندوز فعال است.');
        return;
      }
      const result = await window.karnameh.attachFile();
      if (!result) return;
      store.addAttachment(state.detailTaskId, result);
      rerender();
      toast('پیوست اضافه شد.');
    },
    'open-attachment'(fileName) {
      if (window.karnameh && window.karnameh.openAttachment) {
        void window.karnameh.openAttachment(fileName);
      }
    },
    'delete-attachment'(id) {
      const file = store.deleteAttachment(id);
      if (file && window.karnameh && window.karnameh.deleteAttachmentFile) {
        void window.karnameh.deleteAttachmentFile(file);
      }
      rerender();
    },
    'toggle-subtask'(id) {
      const sub = store.task(id);
      const statuses = store.statuses(sub.listId);
      const target = sub.done ? statuses.find((s) => s.type === 'open') || statuses[0] : statuses.find((s) => s.type === 'done') || statuses[statuses.length - 1];
      if (target) store.setStatus(id, target.id);
      rerender();
    },
    'delete-task'(id) {
      if (!confirm('این کار و زیرکارهایش حذف شوند؟')) return;
      store.deleteTask(id);
      if (state.detailTaskId === id) state.detailTaskId = null;
      rerender();
    },
    'delete-entry'(id) {
      store.deleteTimeEntry(id);
      rerender();
    },
    'focus-mode'(id) {
      state.focusMode = id;
      rerender();
    },
    'focus-preset'(id) {
      state.focusPreset = Number(id);
      rerender();
    },
    'start-timer'() {
      const mode = state.focusMode || 'focus';
      const target = state.focusPreset || 25 * 60;
      startTimer(mode, state.focusTaskId, target);
    },
    'pause-timer'() { pauseTimer(); },
    'resume-timer'() { resumeTimer(); },
    'stop-timer'() { stopTimer(false); },
    'cancel-timer'() {
      if (confirm('این جلسه بدون ثبت دور ریخته شود؟')) cancelTimer();
    },
    'log-filter'(id) {
      state.logFilter = id;
      rerender();
    },
    'theme'(id) {
      state.theme = id;
      localStorage.setItem(LS.theme, id);
      applyTheme();
      rerender();
    },
    'cal-prev'() {
      if (state.cal.jm === 1) { state.cal.jm = 12; state.cal.jy -= 1; } else state.cal.jm -= 1;
      rerender();
    },
    'cal-next'() {
      if (state.cal.jm === 12) { state.cal.jm = 1; state.cal.jy += 1; } else state.cal.jm += 1;
      rerender();
    },
    'cal-today'() {
      const t = J.todayParts();
      state.cal = { jy: t.jy, jm: t.jm };
      rerender();
    },
    'clear-filters'() {
      state.filters = { statusId: '', priority: '', assigneeId: '', tagId: '', sortBy: 'position', groupBy: 'none' };
      rerender();
    },
    'save-view'() {
      state.modal = { type: 'name', title: 'ذخیرهٔ ویو', label: 'نام ویو', submit: 'save-view', value: '' };
      rerender();
    },
    'export-json'() { void exportJson(); },
    'sync-new'() { void linkSync('new'); },
    'sync-existing'() { void linkSync('existing'); },
    'sync-now'() { void runSync(true); },
    async 'sync-access'() {
      if (syncAdapter && (await syncAdapter.requestAccess())) {
        await refreshSyncState();
        await runSync(true);
      } else {
        toast('دسترسی به فایل داده نشد.');
      }
    },
    async 'sync-unlink'() {
      if (!syncAdapter || !confirm('اتصال به فایل گوگل درایو قطع شود؟ داده‌های این دستگاه پاک نمی‌شوند.')) return;
      await syncAdapter.unlink();
      state.sync.status = null;
      await refreshSyncState();
      rerender();
    },
    'import-json'() { void importJson(); },
    'open-data-folder'() {
      if (window.karnameh && window.karnameh.openDataFolder) {
        void window.karnameh.openDataFolder();
      }
    },
    'reset-data'() {
      if (!confirm('همهٔ داده‌ها روی این رایانه پاک و با دادهٔ اولیهٔ برنامه جایگزین می‌شوند؟')) return;
      store.reset();
      state.spaceId = null;
      state.listId = null;
      state.detailTaskId = null;
      ensureSelection();
      rerender();
      toast('داده‌ها بازنشانی شد.');
    },
    'report-period'(id) {
      state.reportPeriod = id;
      rerender();
    },
    'download-csv'() { void downloadCsv(); },
    'copy-tsv'() { void copyTsv(); },
    'edit-goal'(id) {
      const g = store.goals().find((x) => x.id === id);
      if (!g) return;
      state.modal = { type: 'goal', goalId: id, current: g.currentValue, target: g.targetValue };
      rerender();
    },
    'delete-goal'(id) {
      if (!confirm('این هدف حذف شود؟')) return;
      store.deleteGoal(id);
      rerender();
    },
    'goal-submit'(id) {
      const current = Number((document.getElementById('goal-current') || {}).value || 0);
      const target = Number((document.getElementById('goal-target') || {}).value || 0);
      if (id) {
        store.updateGoal(id, current, target);
      } else {
        const name = (document.getElementById('goal-name') || {}).value || '';
        if (!name.trim()) return;
        store.createGoal(name.trim(), target, current);
      }
      state.modal = null;
      rerender();
      toast('ثبت شد.');
    },
    'automation-submit'() {
      const name = (document.getElementById('auto-name') || {}).value || '';
      const trigger = (document.getElementById('auto-trigger') || {}).value || 'task.status_changed';
      const to = (document.getElementById('auto-to') || {}).value || '';
      const priority = (document.getElementById('auto-priority') || {}).value || '';
      const actionType = (document.getElementById('auto-action') || {}).value || 'priority';
      const value = (document.getElementById('auto-value') || {}).value || '';
      if (!name.trim()) return;
      const params = actionType === 'priority' ? { priority: value || 'high' }
        : actionType === 'status' ? { status: value }
          : actionType === 'tag' ? { tag: value }
            : {};
      store.createAutomation({
        name: name.trim(),
        trigger: { type: trigger, to },
        conditions: { items: priority ? [{ field: 'priority', operator: 'eq', value: priority }] : [] },
        actions: [{ type: actionType, params }],
      });
      state.modal = null;
      rerender();
      toast('اتوماسیون ساخته شد.');
    },
    'delete-automation'(id) {
      if (!confirm('این اتوماسیون حذف شود؟')) return;
      store.deleteAutomation(id);
      rerender();
    },
    'automation-toggle'() { /* handled by change */ },
  };

  // ---------- inputs / change ----------
  function onChange(event) {
    const el = event.target;
    if (el.matches('[data-action="time-step"]')) return;
    const kind = el.dataset.change;
    if (!kind) return;
    const id = el.dataset.id || '';
    const value = el.value;
    switch (kind) {
      case 'space': state.spaceId = value; state.listId = null; ensureSelection(); break;
      case 'list': state.listId = value; break;
      case 'view': state.view = value; break;
      case 'filter-status': state.filters.statusId = value; break;
      case 'filter-priority': state.filters.priority = value; break;
      case 'filter-assignee': state.filters.assigneeId = value; break;
      case 'filter-tag': state.filters.tagId = value; break;
      case 'filter-sort': state.filters.sortBy = value; break;
      case 'filter-group': state.filters.groupBy = value; break;
      case 'apply-view': {
        const view = store.views(state.listId).find((v) => v.id === value);
        if (view) {
          try {
            const cfg = JSON.parse(view.config || '{}');
            state.filters = {
              statusId: cfg.statusId || '', priority: cfg.priority || '', assigneeId: cfg.assigneeId || '',
              tagId: cfg.tagId || '', sortBy: cfg.sortBy || 'position', groupBy: cfg.groupBy || 'none',
            };
          } catch { /* ignore */ }
        }
        break;
      }
      case 'task-title':
        store.updateTask(id, { title: value.trim() || 'بدون عنوان' });
        return;
      case 'task-desc':
        store.updateTask(id, { description: value || null });
        return;
      case 'estimate': {
        const hours = Number((document.getElementById('est-hours') || {}).value || 0);
        const minutes = Number((document.getElementById('est-minutes') || {}).value || 0);
        const total = Math.max(0, hours) * 60 + Math.max(0, minutes);
        store.updateTask(id, { estimateMs: total > 0 ? total * 60000 : null });
        return;
      }
      case 'field-value':
        store.setFieldValue(el.dataset.task, id, value);
        return;
      case 'focus-task':
        state.focusTaskId = value;
        rerender();
        return;
      case 'log-task':
        state.logTaskId = value;
        break;
      case 'search-priority': state.searchFilters.priority = value; break;
      case 'search-assignee': state.searchFilters.assigneeId = value; break;
      case 'search-tag': state.searchFilters.tagId = value; break;
      case 'search-list': state.searchFilters.listId = value; break;
      case 'automation-toggle':
        store.toggleAutomation(id, el.checked);
        break;
      case 'sync-auto':
        if (syncAdapter) syncAdapter.setAuto(el.checked);
        state.sync.auto = el.checked;
        break;
      default:
        return;
    }
    rerender();
  }

  function onInput(event) {
    const el = event.target;
    if (el.dataset.input === 'query') {
      state.query = el.value;
      rerender();
    } else if (el.dataset.input === 'search-query') {
      state.searchQuery = el.value;
      rerender();
    }
  }

  // ---------- click dispatcher ----------
  function onClick(event) {
    const wheel = event.target.closest('[data-action="time-step"]');
    if (wheel) {
      const field = wheel.dataset.field;
      const delta = Number(wheel.dataset.delta || 0);
      const modal = state.modal;
      if (modal && modal.type === 'time') {
        const max = field === 'hour' ? 24 : 60;
        modal[field] = ((Number(modal[field]) + delta) % max + max) % max;
        rerender();
      }
      return;
    }
    const el = event.target.closest('[data-action], [data-stop]');
    if (!el) return;
    if (el.dataset.stop) {
      event.stopPropagation();
      return;
    }
    const action = el.dataset.action;
    if (!action) return;
    const fn = actions[action];
    if (fn) {
      event.stopPropagation();
      fn(el.dataset.id || '');
    }
  }

  function onWheel(event) {
    const wheel = event.target.closest('.wheel');
    if (!wheel || !state.modal || state.modal.type !== 'time') return;
    event.preventDefault();
    const field = wheel.dataset.wheel;
    const max = field === 'hour' ? 24 : 60;
    const delta = event.deltaY > 0 ? 1 : -1;
    state.modal[field] = ((Number(state.modal[field]) + delta) % max + max) % max;
    rerender();
  }

  // ---------- data / files ----------
  function downloadBlob(name, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportJson() {
    const text = store.exportJson();
    if (window.karnameh && window.karnameh.saveFile) {
      const result = await window.karnameh.saveFile(`karnameh-${todayIso()}.json`, text);
      if (result) toast('فایل اکسپورت ذخیره شد.');
    } else {
      downloadBlob(`karnameh-${todayIso()}.json`, text, 'application/json;charset=utf-8');
      toast('فایل اکسپورت دانلود شد.');
    }
  }

  async function importJson() {
    let text = null;
    if (window.karnameh && window.karnameh.openDataFile) {
      text = await window.karnameh.openDataFile();
    } else {
      text = await new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) return resolve(null);
          file.text().then(resolve).catch(() => resolve(null));
        };
        input.click();
      });
    }
    if (!text) return;
    if (!store.isValidBundle(text)) {
      toast('فایل انتخاب‌شده بستهٔ معتبر کارنامه نیست.');
      return;
    }
    if (!confirm('همهٔ داده‌های فعلی با این فایل جایگزین شوند؟')) return;
    try {
      store.importJson(text);
      state.listId = null;
      state.spaceId = null;
      ensureSelection();
      rerender();
      toast('ایمپورت انجام شد.');
    } catch (e) {
      toast('ایمپورت ناموفق بود.');
    }
  }

  async function downloadCsv() {
    const rows = reportRows(reportData());
    const csv = renderDelimited(rows, ',');
    const content = `\uFEFF${csv}`;
    const name = `karnameh-report-${todayIso()}.csv`;
    if (window.karnameh && window.karnameh.saveFile) {
      const result = await window.karnameh.saveFile(name, content);
      if (result) toast('فایل CSV ذخیره شد.');
    } else {
      downloadBlob(name, content, 'text/csv;charset=utf-8');
      toast('فایل CSV دانلود شد.');
    }
  }

  async function copyTsv() {
    const rows = reportRows(reportData());
    const tsv = renderDelimited(rows, '\t');
    try {
      await navigator.clipboard.writeText(tsv);
      toast('گزارش کپی شد؛ در Google Sheets پیست کنید.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = tsv;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('گزارش کپی شد.');
    }
  }

  // ---------- Google Drive sync ----------
  async function refreshSyncState() {
    if (!syncAdapter) return;
    state.sync.kind = syncAdapter.kind;
    state.sync.supported = syncAdapter.supported;
    state.sync.linked = syncAdapter.isLinked();
    state.sync.label = syncAdapter.label();
    state.sync.auto = syncAdapter.isAuto();
    try {
      state.sync.needsClick = await syncAdapter.needsClick();
    } catch {
      state.sync.needsClick = false;
    }
  }

  async function runSync(manual) {
    if (!syncer || !syncAdapter || !syncAdapter.isLinked()) return;
    if (!manual && !syncAdapter.isAuto()) return;
    if (state.sync.busy) return;
    state.sync.busy = true;
    if (manual || state.tab === 'more') rerender();
    const result = await syncer.sync();
    state.sync.busy = false;
    state.sync.status = result;
    await refreshSyncState();
    if (manual || state.tab === 'more') rerender();
    if (manual) toast(result.message);
  }

  function scheduleSync() {
    if (!syncer) return;
    clearTimeout(syncDebounce);
    syncDebounce = setTimeout(() => { void runSync(false); }, 15000);
  }

  function syncCardHtml() {
    const s = state.sync;
    const title = '<h3 class="card-title">همگام‌سازی با گوگل درایو</h3>';
    if (!s.supported) {
      return `<div class="card">${title}
        <div class="small muted">همگام‌سازی با گوگل درایو در این نسخه هنوز تنظیم نشده. بقیهٔ برنامه همین‌جا کار می‌کند و داده‌ها در همین مرورگر ذخیره می‌شوند.</div>
      </div>`;
    }
    if (!s.linked && s.kind === 'web') {
      return `<div class="card">${title}
        <div class="small muted" style="margin-bottom:8px;">با حساب گوگل وارد شوید تا برنامه از پوشهٔ <b>Karnameh</b> در گوگل درایو (فایل <span dir="ltr">karnameh-sync.json</span>، همان فایل گوشی و ویندوز) بخواند و در آن بنویسد. اگر پوشه یا فایل نباشد ساخته می‌شود.</div>
        <div class="row wrap">
          <button type="button" class="btn primary" data-action="sync-existing">ورود با گوگل و اتصال</button>
        </div>
      </div>`;
    }
    const where = 'فایل باید داخل پوشهٔ <b>Karnameh</b> در Google Drive روی این رایانه باشد (برنامهٔ Google Drive for desktop، معمولاً <span dir="ltr">G:\\My Drive\\Karnameh</span>).';
    if (!s.linked) {
      return `<div class="card">${title}
        <div class="small muted" style="margin-bottom:8px;">همان فایل <span dir="ltr">karnameh-sync.json</span> که گوشی با آن همگام می‌شود را انتخاب کنید. ${where}</div>
        <div class="row wrap">
          <button type="button" class="btn primary" data-action="sync-existing">اتصال به فایل موجود</button>
          <button type="button" class="btn" data-action="sync-new">ساخت فایل جدید</button>
        </div>
      </div>`;
    }
    const st = s.status;
    const last = st ? `<div class="tiny ${st.outcome === 'FAILED' ? '' : 'muted'}" style="margin-top:8px;">${esc(st.message)} · ${fmtDateTime(new Date(st.at).toISOString())}</div>` : '';
    return `<div class="card">${title}
      <div class="tiny muted">فایل متصل:</div>
      <div class="tiny" dir="ltr" style="word-break:break-all;">${esc(s.label)}</div>
      <div class="row wrap" style="margin-top:8px;">
        ${s.needsClick
          ? `<button type="button" class="btn primary" data-action="sync-access">${s.kind === 'web' ? 'ورود دوباره با گوگل و همگام‌سازی' : 'تأیید دسترسی و همگام‌سازی'}</button>`
          : `<button type="button" class="btn primary" data-action="sync-now" ${s.busy ? 'disabled' : ''}>${s.busy ? 'در حال همگام‌سازی…' : 'همگام‌سازی الان'}</button>`}
        <button type="button" class="btn sm danger" data-action="sync-unlink">قطع اتصال</button>
      </div>
      <label class="row small" style="margin-top:8px;gap:6px;">
        <input type="checkbox" ${s.auto ? 'checked' : ''} data-change="sync-auto" />
        همگام‌سازی خودکار (هنگام باز شدن، بعد از هر تغییر و هر چند دقیقه)
      </label>
      ${last}
    </div>`;
  }

  async function linkSync(mode) {
    if (!syncAdapter) return;
    const ok = mode === 'new' ? await syncAdapter.linkNew() : await syncAdapter.linkExisting();
    await refreshSyncState();
    rerender();
    if (ok) await runSync(true);
  }

  async function initSync() {
    if (!window.KarnamehSyncAdapters || !window.KarnamehSync) return;
    try {
      syncAdapter = await window.KarnamehSyncAdapters.create();
    } catch {
      return;
    }
    syncer = window.KarnamehSync.createSync({
      adapter: syncAdapter,
      store,
      clientName: syncAdapter.kind === 'desktop' ? 'windows' : 'web',
      onApplied: () => {
        ensureSelection();
        rerender();
      },
    });
    await refreshSyncState();
    rerender();
    void runSync(false);
    setInterval(() => { void runSync(false); }, 3 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { void runSync(false); });
    window.addEventListener('focus', () => { void runSync(false); });
  }

  // ---------- boot ----------
  async function boot() {
    state.theme = localStorage.getItem(LS.theme) || 'light';
    timer = readTimer();
    let text = null;
    if (window.karnameh && window.karnameh.loadData) {
      text = await window.karnameh.loadData();
    } else {
      text = localStorage.getItem(LS.data);
      if (!text) {
        try {
          const res = await fetch('../seed/karnameh-seed.json');
          if (res.ok) text = await res.text();
        } catch {
          /* ignore */
        }
      }
    }
    if (!text || !text.includes('karnameh-export')) {
      const starter = window.KarnamehStore.starter();
      text = JSON.stringify(starter, null, 2);
      persist(text);
    }
    store = window.KarnamehStore.createStore(text, persist);
    if (!window.karnameh && !localStorage.getItem(LS.data)) {
      persist(store.exportJson());
    }
    if (window.karnameh && window.karnameh.dataDir) {
      try {
        state.dataDir = await window.karnameh.dataDir();
      } catch {
        state.dataDir = '';
      }
    }
    ensureSelection();
    const t = J.todayParts();
    state.cal = { jy: t.jy, jm: t.jm };
    if (timer && timer.mode === 'pomodoro' && elapsedSeconds() >= timer.targetSeconds) {
      timer.accumulatedSeconds = timer.targetSeconds;
      stopTimer(true);
    }
    render();
    void initSync();
    setInterval(tickTimer, 500);
    setInterval(() => {
      if (state.tab === 'home') rerender();
    }, 60000);
  }

  // ---------- events ----------
  document.addEventListener('click', onClick);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('wheel', onWheel, { passive: false });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (state.modal) { state.modal = null; rerender(); }
      else if (state.searchOpen) { state.searchOpen = false; rerender(); }
      else if (state.detailTaskId) { state.detailTaskId = null; rerender(); }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      state.searchOpen = true;
      rerender();
    }
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') applyTheme();
  });

  boot();
})();
