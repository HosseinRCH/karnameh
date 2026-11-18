/* پاکای آفلاین — رابط کاربری */
(function (global) {
  'use strict';

  const S = global.PacaStore;
  const Y = global.PacaSync;
  const J = global.KJalali;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const view = () => $('#view');

  // ---------- کمکی‌ها ----------
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const fa = (v) => String(v).replace(/\d/g, (d) => FA[d]);
  const en = (v) => String(v || '').replace(/[۰-۹]/g, (d) => FA.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  function dur(min) {
    min = Math.round(min || 0);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return fa(m) + ' دقیقه';
    return fa(h) + ' ساعت' + (m ? ' و ' + fa(m) + ' دقیقه' : '');
  }
  const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600); return fa((h ? h + ':' : '') + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60)); };
  const jdate = (iso) => (iso ? fa(J.isoToJalaali(String(iso).slice(0, 10))) : '');
  const localDay = (iso) => J.localIso(new Date(iso));
  const today = () => J.localIso(new Date());
  function parseJalali(text) {
    const t = en(text).trim();
    if (!t) return null;
    const m = t.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (!m) return undefined;
    const jy = +m[1], jm = +m[2], jd = +m[3];
    if (jm < 1 || jm > 12 || jd < 1 || jd > J.daysInMonth(jy, jm)) return undefined;
    return J.jalaaliToIso(jy, jm, jd);
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const IMPORTANCE = ['بدون اولویت', 'کم', 'متوسط', 'زیاد', 'فوری'];
  const STATUS = [['todo', 'برای انجام'], ['doing', 'در حال انجام'], ['done', 'انجام‌شده']];

  // ---------- وضعیت رابط ----------
  const ui = JSON.parse(localStorage.getItem('paca.ui') || '{}');
  ui.tab = ui.tab || 'tasks';
  ui.project = ui.project || 'all';
  ui.range = ui.range || 'week';
  ui.q = '';
  const saveUi = () => localStorage.setItem('paca.ui', JSON.stringify({ tab: ui.tab, project: ui.project, range: ui.range }));

  // =========================================================================
  // کارها
  // =========================================================================
  function renderTasks() {
    const projects = S.projects();
    if (ui.project !== 'all' && !S.project(ui.project)) ui.project = 'all';
    const q = ui.q.trim();
    let list = S.tasks().filter((t) => ui.project === 'all' || t.projectSyncId === ui.project);
    if (q) list = list.filter((t) => (t.title + ' ' + (t.tags || []).join(' ') + ' ' + S.blocksToText(t.description)).includes(q));
    list.sort((a, b) => (b.importance || 0) - (a.importance || 0) || String(a.dueDate || '9').localeCompare(String(b.dueDate || '9')) || String(b.updatedAt).localeCompare(String(a.updatedAt)));

    const chips = ['<button class="chip ' + (ui.project === 'all' ? 'active' : '') + '" data-project="all">همهٔ پروژه‌ها</button>']
      .concat(projects.map((p) => `<button class="chip ${ui.project === p.syncId ? 'active' : ''}" data-project="${p.syncId}">${esc(p.name)} <span class="muted">${fa(S.tasks().filter((t) => t.projectSyncId === p.syncId && t.status !== 'done').length)}</span></button>`))
      .join('');

    const col = (key, title) => {
      const items = list.filter((t) => (t.status || 'todo') === key);
      return `<div class="column" data-status="${key}"><h3><span>${title}</span><span class="muted">${fa(items.length)}</span></h3>${items.map(taskCard).join('') || '<div class="empty">خالی</div>'}</div>`;
    };

    view().innerHTML = `
      <div class="card">
        <div class="row" style="margin-bottom:10px">
          <input id="q" class="grow" placeholder="جستجو در کارها…" value="${esc(ui.q)}" style="max-width:340px" />
          <button class="btn primary" id="new-task">+ کار جدید</button>
          <button class="btn" id="new-project">+ پروژه</button>
          ${ui.project !== 'all' ? '<button class="btn" id="edit-project">ویرایش پروژه</button>' : ''}
        </div>
        <div class="chips">${chips}</div>
      </div>
      ${projects.length || list.length ? `<div class="board">${STATUS.map(([k, t]) => col(k, t)).join('')}</div>` : `<div class="card empty">هنوز پروژه‌ای نیست. یک پروژه بسازید یا در «تنظیمات» به فایل همگام‌سازی پاکا وصل شوید.</div>`}`;

    $('#q').addEventListener('input', (e) => { ui.q = e.target.value; const pos = e.target.selectionStart; renderTasks(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); });
    $('#new-task').onclick = () => taskDialog(null);
    $('#new-project').onclick = () => projectDialog(null);
    if ($('#edit-project')) $('#edit-project').onclick = () => projectDialog(ui.project);
    view().querySelectorAll('[data-project]').forEach((b) => (b.onclick = () => { ui.project = b.dataset.project; saveUi(); renderTasks(); }));
    view().querySelectorAll('.task').forEach((el) => {
      el.onclick = (e) => {
        if (e.target.closest('input,button')) return;
        taskDialog(el.dataset.id);
      };
    });
    view().querySelectorAll('.task input[type=checkbox]').forEach((c) => (c.onchange = () => S.updateTask(c.dataset.id, { status: c.checked ? 'done' : 'todo' })));
    view().querySelectorAll('.focus-btn').forEach((b) => (b.onclick = () => { Focus.start(b.dataset.id); }));
  }

  function taskCard(t) {
    const p = S.project(t.projectSyncId);
    const worked = S.workedMinutes(t.syncId);
    const overdue = t.dueDate && t.status !== 'done' && t.dueDate < today();
    return `<div class="task ${t.status === 'done' ? 'done' : ''}" data-id="${t.syncId}">
      <div class="title"><input type="checkbox" data-id="${t.syncId}" ${t.status === 'done' ? 'checked' : ''} /><span>${esc(t.title)}</span></div>
      <div class="meta">
        ${ui.project === 'all' && p ? `<span>${esc(p.name)}</span>` : ''}
        ${t.importance ? `<span class="badge imp-${t.importance}">${IMPORTANCE[t.importance]}</span>` : ''}
        ${(t.tags || []).map((g) => `<span class="badge">#${esc(g)}</span>`).join('')}
        ${t.dueDate ? `<span class="${overdue ? 'overdue' : ''}">📅 ${jdate(t.dueDate)}</span>` : ''}
        ${worked ? `<span>⏱ ${dur(worked)}${t.estimateMinutes ? ' از ' + dur(t.estimateMinutes) : ''}</span>` : ''}
        ${t.status !== 'done' ? `<button class="focus-btn" data-id="${t.syncId}">▶ تمرکز</button>` : ''}
      </div></div>`;
  }

  function openDialog(html, bind) {
    const d = $('#dialog');
    d.innerHTML = `<div class="dlg">${html}</div>`;
    bind(d);
    if (!d.open) d.showModal();
  }
  const closeDialog = () => $('#dialog').close();

  function taskDialog(id) {
    const t = id ? S.task(id) : null;
    const projects = S.projects();
    const pid = t ? t.projectSyncId : ui.project !== 'all' ? ui.project : (projects[0] || {}).syncId;
    const entries = t ? S.entries().filter((e) => e.taskSyncId === id).sort((a, b) => String(b.start).localeCompare(String(a.start))) : [];
    openDialog(`
      <h2>${t ? 'ویرایش کار' : 'کار جدید'}</h2>
      <label>عنوان</label><input id="f-title" value="${esc(t ? t.title : '')}" />
      <div class="grid2">
        <div><label>پروژه</label><select id="f-project">${projects.map((p) => `<option value="${p.syncId}" ${p.syncId === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}<option value="__new">+ پروژهٔ جدید…</option></select></div>
        <div><label>وضعیت</label><select id="f-status">${STATUS.map(([k, v]) => `<option value="${k}" ${(t ? t.status : 'todo') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label>اولویت</label><select id="f-imp">${IMPORTANCE.map((v, i) => `<option value="${i}" ${(t ? t.importance : 0) === i ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div><label>موعد (شمسی، مثل ۱۴۰۵/۰۹/۰۱)</label><input id="f-due" value="${t && t.dueDate ? jdate(t.dueDate) : ''}" placeholder="۱۴۰۵/۰۹/۰۱" /></div>
        <div><label>برچسب‌ها (با ویرگول جدا کنید)</label><input id="f-tags" value="${esc(t ? (t.tags || []).join('، ') : '')}" /></div>
        <div><label>تخمین زمان (دقیقه)</label><input id="f-est" inputmode="numeric" value="${t && t.estimateMinutes ? fa(t.estimateMinutes) : ''}" /></div>
      </div>
      <label>توضیحات</label><textarea id="f-desc">${esc(t ? S.blocksToText(t.description) : '')}</textarea>
      ${t ? `<h3>زمان ثبت‌شده: ${dur(S.workedMinutes(id))}</h3>
        ${entries.length ? `<table>${entries.slice(0, 8).map((e) => `<tr><td>${jdate(e.start)}</td><td>${dur(e.minutes)}</td><td class="muted">${e.kind === 'pomodoro' ? 'پومودورو' : e.kind === 'focus' ? 'تمرکز' : 'دستی'}</td></tr>`).join('')}</table>` : '<div class="muted">هنوز زمانی ثبت نشده.</div>'}` : ''}
      <div class="actions">
        <button class="btn primary" id="f-save">ذخیره</button>
        ${t && t.status !== 'done' ? '<button class="btn" id="f-focus">▶ شروع تمرکز</button>' : ''}
        <button class="btn" id="f-cancel">انصراف</button>
        ${t ? '<button class="btn danger" id="f-del" style="margin-inline-start:auto">حذف</button>' : ''}
      </div>`, (d) => {
      $('#f-project', d).onchange = (e) => {
        if (e.target.value !== '__new') return;
        const name = prompt('نام پروژهٔ جدید:');
        if (!name) { e.target.value = pid || ''; return; }
        const p = S.addProject(name);
        e.target.insertAdjacentHTML('afterbegin', `<option value="${p.syncId}">${esc(p.name)}</option>`);
        e.target.value = p.syncId;
      };
      $('#f-cancel', d).onclick = closeDialog;
      const save = () => {
        const due = parseJalali($('#f-due', d).value);
        if (due === undefined) { toast('تاریخ موعد درست نیست؛ مثل ۱۴۰۵/۰۹/۰۱ بنویسید.'); return null; }
        const fields = {
          title: $('#f-title', d).value.trim() || 'کار بی‌عنوان',
          projectSyncId: $('#f-project', d).value,
          status: $('#f-status', d).value,
          importance: Number($('#f-imp', d).value) || 0,
          dueDate: due,
          tags: $('#f-tags', d).value.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
          estimateMinutes: Number(en($('#f-est', d).value)) || 0,
          descriptionText: $('#f-desc', d).value,
        };
        const rec = t ? S.updateTask(id, fields) : S.addTask(fields);
        closeDialog();
        return rec;
      };
      $('#f-save', d).onclick = save;
      if ($('#f-focus', d)) $('#f-focus', d).onclick = () => { const r = save(); if (r) Focus.start(r.syncId); };
      if ($('#f-del', d)) $('#f-del', d).onclick = () => { if (confirm('این کار حذف شود؟')) { S.deleteTask(id); closeDialog(); } };
      setTimeout(() => $('#f-title', d).focus(), 30);
    });
  }

  function projectDialog(id) {
    const p = id ? S.project(id) : null;
    openDialog(`
      <h2>${p ? 'ویرایش پروژه' : 'پروژهٔ جدید'}</h2>
      <label>نام</label><input id="p-name" value="${esc(p ? p.name : '')}" />
      <label>توضیح</label><textarea id="p-desc" style="min-height:70px">${esc(p ? p.description : '')}</textarea>
      <div class="actions">
        <button class="btn primary" id="p-save">ذخیره</button>
        <button class="btn" id="p-cancel">انصراف</button>
        ${p ? '<button class="btn danger" id="p-del" style="margin-inline-start:auto">حذف پروژه</button>' : ''}
      </div>`, (d) => {
      $('#p-cancel', d).onclick = closeDialog;
      $('#p-save', d).onclick = () => {
        const name = $('#p-name', d).value.trim();
        if (!name) return toast('نام پروژه را بنویسید.');
        if (p) S.updateProject(id, { name, description: $('#p-desc', d).value });
        else { const n = S.addProject(name, $('#p-desc', d).value); ui.project = n.syncId; saveUi(); }
        closeDialog();
      };
      if ($('#p-del', d)) $('#p-del', d).onclick = () => { if (confirm('پروژه و همهٔ کارهایش حذف شوند؟')) { S.deleteProject(id); ui.project = 'all'; saveUi(); closeDialog(); } };
      setTimeout(() => $('#p-name', d).focus(), 30);
    });
  }

  // =========================================================================
  // تمرکز (تایمر آزاد و پومودورو)
  // =========================================================================
  const Focus = (() => {
    const KEY = 'paca.focus';
    let st = Object.assign({ mode: 'pomo', workMin: 25, breakMin: 5, taskSyncId: null, running: false, startedAt: 0, accMs: 0, phase: 'work' }, JSON.parse(localStorage.getItem(KEY) || '{}'));
    const save = () => localStorage.setItem(KEY, JSON.stringify(st));
    const elapsed = () => st.accMs + (st.running ? Date.now() - st.startedAt : 0);
    const active = () => st.running || st.accMs > 0;
    const remaining = () => (st.phase === 'work' ? st.workMin : st.breakMin) * 60000 - elapsed();

    function beep() {
      try {
        const ctx = new (global.AudioContext || global.webkitAudioContext)();
        [0, 0.35, 0.7].forEach((t) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.value = 0.15; o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); });
      } catch { /* بی‌صدا */ }
    }
    function notify(text) {
      toast(text);
      beep();
      try { if (global.Notification && Notification.permission === 'granted') new Notification('پاکا', { body: text, icon: 'icon.png' }); } catch { /* ignore */ }
      if (global.PacaAndroid) global.PacaSync && global.PacaAndroid.call('0', 'notify', text);
    }

    function start(taskId) {
      if (taskId) st.taskSyncId = taskId;
      if (st.running) { if (taskId) { save(); render(); } return; }
      if (st.phase !== 'work' && st.mode === 'pomo' && !st.accMs) st.phase = 'work';
      st.running = true;
      st.startedAt = Date.now();
      save();
      try { if (global.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ }
      if (taskId) toast('تمرکز روی «' + ((S.task(taskId) || {}).title || '') + '» شروع شد.');
      render();
    }
    function pause() { if (!st.running) return; st.accMs = elapsed(); st.running = false; save(); render(); }
    function record(ms, kind) {
      const minutes = Math.round(ms / 60000);
      if (ms < 30000) return 0;
      S.addEntry({ taskSyncId: st.taskSyncId, start: new Date(Date.now() - ms).toISOString(), end: new Date().toISOString(), minutes: Math.max(1, minutes), kind });
      return Math.max(1, minutes);
    }
    function stop(keep) {
      const ms = elapsed();
      let saved = 0;
      if (keep !== false && st.phase === 'work') saved = record(ms, st.mode === 'pomo' ? 'pomodoro' : 'focus');
      st.running = false; st.accMs = 0; st.startedAt = 0; st.phase = 'work';
      save();
      if (saved) toast(dur(saved) + ' ثبت شد.');
      render();
    }
    function tick() {
      if (st.running && st.mode === 'pomo' && remaining() <= 0) {
        if (st.phase === 'work') {
          record(st.workMin * 60000, 'pomodoro');
          st.phase = 'break'; st.accMs = 0; st.startedAt = Date.now();
          notify('پومودورو تمام شد؛ ' + fa(st.breakMin) + ' دقیقه استراحت.');
        } else {
          st.phase = 'work'; st.running = false; st.accMs = 0;
          notify('استراحت تمام شد؛ آماده‌ی پومودوروی بعدی؟');
        }
        save();
        render();
      }
      const shown = st.mode === 'pomo' ? remaining() : elapsed();
      document.querySelectorAll('[data-clock]').forEach((el) => (el.textContent = clock(shown)));
    }
    setInterval(tick, 1000);

    function bar() {
      const b = $('#timer-bar');
      if (!active() || ui.tab === 'focus') { b.classList.add('hidden'); return; }
      const t = S.task(st.taskSyncId);
      b.classList.remove('hidden');
      b.innerHTML = `<span>${st.phase === 'break' ? '☕ استراحت' : '🎯 ' + esc(t ? t.title : 'تمرکز آزاد')}</span><span class="clock" data-clock></span><span class="grow"></span>
        <button data-a="toggle">${st.running ? 'توقف' : 'ادامه'}</button><button data-a="stop">پایان و ثبت</button><button data-a="open">باز کردن</button>`;
      b.querySelector('[data-a=toggle]').onclick = () => (st.running ? pause() : start());
      b.querySelector('[data-a=stop]').onclick = () => stop();
      b.querySelector('[data-a=open]').onclick = () => go('focus');
      tick();
    }

    function render() {
      bar();
      if (ui.tab === 'focus') renderFocus();
    }

    function renderFocus() {
      const tasks = S.tasks().filter((t) => t.status !== 'done');
      const todayMin = S.entries().filter((e) => localDay(e.start) === today()).reduce((s, e) => s + e.minutes, 0);
      const recent = S.entries().sort((a, b) => String(b.start).localeCompare(String(a.start))).slice(0, 10);
      view().innerHTML = `
        <div class="card">
          <div class="row">
            <div class="chips"><button class="chip ${st.mode === 'pomo' ? 'active' : ''}" data-mode="pomo">پومودورو</button><button class="chip ${st.mode === 'free' ? 'active' : ''}" data-mode="free">تمرکز آزاد</button></div>
            <span class="grow"></span><span class="muted">امروز: ${dur(todayMin)}</span>
          </div>
          <div class="timer">
            <div class="label">${st.mode === 'pomo' ? (st.phase === 'work' ? 'زمان کار' : 'استراحت') : 'زمان سپری‌شده'}</div>
            <div class="clock" data-clock></div>
          </div>
          <label>روی کدام کار؟</label>
          <select id="fo-task"><option value="">— بدون کار (تمرکز آزاد) —</option>${tasks.map((t) => `<option value="${t.syncId}" ${t.syncId === st.taskSyncId ? 'selected' : ''}>${esc(t.title)}${S.project(t.projectSyncId) ? ' — ' + esc(S.project(t.projectSyncId).name) : ''}</option>`).join('')}</select>
          ${st.mode === 'pomo' ? `<div class="grid2"><div><label>دقیقهٔ کار</label><input id="fo-work" inputmode="numeric" value="${fa(st.workMin)}" ${active() ? 'disabled' : ''} /></div><div><label>دقیقهٔ استراحت</label><input id="fo-break" inputmode="numeric" value="${fa(st.breakMin)}" ${active() ? 'disabled' : ''} /></div></div>` : ''}
          <div class="actions" style="justify-content:center">
            ${st.running ? '<button class="btn" id="fo-pause">توقف موقت</button>' : `<button class="btn primary" id="fo-start">${active() ? 'ادامه' : 'شروع'}</button>`}
            ${active() ? '<button class="btn primary" id="fo-stop">پایان و ثبت</button><button class="btn danger" id="fo-drop">رها کردن</button>' : ''}
          </div>
        </div>
        <div class="card">
          <h2>ثبت دستی زمان</h2>
          <div class="grid2">
            <div><label>کار</label><select id="m-task"><option value="">— بدون کار —</option>${S.tasks().map((t) => `<option value="${t.syncId}">${esc(t.title)}</option>`).join('')}</select></div>
            <div><label>تاریخ (شمسی)</label><input id="m-date" value="${jdate(today())}" /></div>
            <div><label>مدت (دقیقه)</label><input id="m-min" inputmode="numeric" placeholder="۴۵" /></div>
            <div><label>یادداشت</label><input id="m-note" /></div>
          </div>
          <div class="actions"><button class="btn primary" id="m-add">ثبت</button></div>
        </div>
        <div class="card">
          <h2>آخرین ثبت‌ها</h2>
          ${recent.length ? `<table><tr><th>تاریخ</th><th>کار</th><th>مدت</th><th></th></tr>${recent.map((e) => `<tr><td>${jdate(e.start)}</td><td>${esc((S.task(e.taskSyncId) || {}).title || '—')}</td><td>${dur(e.minutes)}</td><td><button class="btn small danger" data-del="${e.id}">حذف</button></td></tr>`).join('')}</table>` : '<div class="empty">هنوز چیزی ثبت نشده.</div>'}
        </div>`;
      view().querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { if (active()) return toast('اول جلسهٔ فعلی را تمام کنید.'); st.mode = b.dataset.mode; st.phase = 'work'; save(); render(); }));
      $('#fo-task').onchange = (e) => { st.taskSyncId = e.target.value || null; save(); };
      const num = (sel, def) => { const n = Number(en($(sel).value)); return n > 0 && n < 600 ? n : def; };
      if ($('#fo-work')) { $('#fo-work').onchange = () => { st.workMin = num('#fo-work', 25); save(); tick(); }; $('#fo-break').onchange = () => { st.breakMin = num('#fo-break', 5); save(); }; }
      if ($('#fo-start')) $('#fo-start').onclick = () => start();
      if ($('#fo-pause')) $('#fo-pause').onclick = pause;
      if ($('#fo-stop')) $('#fo-stop').onclick = () => stop();
      if ($('#fo-drop')) $('#fo-drop').onclick = () => { if (confirm('این جلسه بدون ثبت رها شود؟')) stop(false); };
      $('#m-add').onclick = () => {
        const day = parseJalali($('#m-date').value);
        const minutes = Number(en($('#m-min').value));
        if (!day) return toast('تاریخ درست نیست.');
        if (!(minutes > 0)) return toast('مدت را به دقیقه بنویسید.');
        const end = new Date(day + 'T12:00:00');
        S.addEntry({ taskSyncId: $('#m-task').value || null, start: new Date(end - minutes * 60000).toISOString(), end: end.toISOString(), minutes, kind: 'manual', note: $('#m-note').value });
        toast(dur(minutes) + ' ثبت شد.');
      };
      view().querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { if (confirm('این ثبت حذف شود؟')) S.deleteEntry(b.dataset.del); }));
      tick();
    }

    return { start, stop, pause, render, renderFocus, bar, active };
  })();

  // =========================================================================
  // گزارش
  // =========================================================================
  function rangeStart() {
    const t = today();
    if (ui.range === 'today') return t;
    if (ui.range === 'week') return J.addDays(t, -J.weekdayIndex(t));
    if (ui.range === 'month') { const p = J.todayParts(); return J.jalaaliToIso(p.jy, p.jm, 1); }
    return '0000-00-00';
  }

  function renderReport() {
    const from = rangeStart();
    const list = S.entries().filter((e) => localDay(e.start) >= from);
    const total = list.reduce((s, e) => s + e.minutes, 0);
    const byProject = new Map();
    const byTask = new Map();
    for (const e of list) {
      const pid = e.projectSyncId || (S.task(e.taskSyncId) || {}).projectSyncId || '';
      byProject.set(pid, (byProject.get(pid) || 0) + e.minutes);
      byTask.set(e.taskSyncId || '', (byTask.get(e.taskSyncId || '') || 0) + e.minutes);
    }
    const max = Math.max(1, ...byProject.values());
    const doneCount = S.tasks().filter((t) => t.status === 'done' && localDay(t.updatedAt) >= from).length;
    const open = S.tasks().filter((t) => t.status !== 'done').length;
    const ranges = [['today', 'امروز'], ['week', 'این هفته'], ['month', 'این ماه'], ['all', 'همه']];
    view().innerHTML = `
      <div class="card">
        <div class="row"><div class="chips">${ranges.map(([k, v]) => `<button class="chip ${ui.range === k ? 'active' : ''}" data-range="${k}">${v}</button>`).join('')}</div><span class="grow"></span><button class="btn small" id="csv">خروجی CSV</button></div>
        <div style="margin-top:12px">
          <span class="stat">زمان ثبت‌شده<b>${dur(total)}</b></span>
          <span class="stat">کارهای انجام‌شده<b>${fa(doneCount)}</b></span>
          <span class="stat">کارهای باز<b>${fa(open)}</b></span>
        </div>
      </div>
      <div class="card"><h2>بر اساس پروژه</h2>
        ${byProject.size ? [...byProject.entries()].sort((a, b) => b[1] - a[1]).map(([pid, m]) => `<div style="margin-bottom:10px"><div class="row"><span class="grow">${esc((S.project(pid) || {}).name || 'بدون پروژه')}</span><span class="muted">${dur(m)}</span></div><div class="bar"><i style="width:${(m / max) * 100}%"></i></div></div>`).join('') : '<div class="empty">در این بازه زمانی ثبت نشده.</div>'}
      </div>
      <div class="card"><h2>بر اساس کار</h2>
        ${byTask.size ? `<table><tr><th>کار</th><th>زمان</th></tr>${[...byTask.entries()].sort((a, b) => b[1] - a[1]).map(([tid, m]) => `<tr><td>${esc((S.task(tid) || {}).title || 'تمرکز آزاد')}</td><td>${dur(m)}</td></tr>`).join('')}</table>` : '<div class="empty">—</div>'}
      </div>`;
    view().querySelectorAll('[data-range]').forEach((b) => (b.onclick = () => { ui.range = b.dataset.range; saveUi(); renderReport(); }));
    $('#csv').onclick = () => {
      const rows = [['تاریخ', 'پروژه', 'کار', 'دقیقه', 'نوع', 'یادداشت']].concat(
        list.map((e) => [J.isoToJalaali(localDay(e.start)), (S.project(e.projectSyncId) || {}).name || '', (S.task(e.taskSyncId) || {}).title || '', e.minutes, e.kind, e.note || '']),
      );
      const csv = '\ufeff' + rows.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
      download('paca-time-' + today() + '.csv', csv, 'text/csv');
    };
  }

  function download(name, text, type) {
    if (global.PacaDesktop) return global.PacaDesktop.saveFile(name, text);
    if (global.PacaAndroid) return Y && global.PacaAndroid.call('0', 'saveFile', JSON.stringify({ name, text, type }));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // =========================================================================
  // تنظیمات و همگام‌سازی
  // =========================================================================
  async function renderSettings() {
    const a = Y.current();
    const last = Y.state.last;
    const linked = Boolean(a);
    const plat = Y.platform;
    const howTo = {
      web: 'با حساب گوگل وارد شوید؛ برنامه فایل <code>My Drive/Paca/paca-sync.json</code> را پیدا می‌کند (یا می‌سازد). دسترسی گوگل در مرورگر حدود یک ساعت می‌ماند و بعد دکمهٔ «ورود دوباره» می‌آید.',
      windows: 'Google Drive for desktop را نصب کنید، بعد فایل <code>paca-sync.json</code> را در پوشهٔ <code>My Drive\\Paca</code> انتخاب کنید (یا همان‌جا بسازید). فایل از طریق خود Google Drive همگام می‌شود.',
      android: 'با «ورود با گوگل» فایل <code>My Drive/Paca/paca-sync.json</code> مستقیم از درایو خوانده و نوشته می‌شود. اگر ورود گوگل کار نکرد، با «انتخاب فایل» همان فایل را از برنامهٔ Drive انتخاب کنید.',
    }[plat];
    let buttons = '';
    if (!linked) {
      if (plat === 'web') buttons = '<button class="btn primary" data-link="drive-api">ورود با گوگل و اتصال</button>';
      if (plat === 'windows') buttons = '<button class="btn primary" data-link="file:auto">انتخاب یا ساخت فایل در پوشهٔ گوگل درایو</button>';
      if (plat === 'android') buttons = '<button class="btn primary" data-link="drive-api">ورود با گوگل</button><button class="btn" data-link="file:existing">انتخاب فایل</button><button class="btn" data-link="file:new">ساخت فایل جدید</button>';
    } else {
      const needs = await a.needsClick();
      buttons = `${needs ? '<button class="btn primary" id="relogin">ورود دوباره با گوگل و همگام‌سازی</button>' : '<button class="btn primary" id="sync-now">همگام‌سازی الان</button>'}
        <button class="btn danger" id="unlink">قطع اتصال</button>`;
    }
    view().innerHTML = `
      <div class="card">
        <h2>همگام‌سازی با گوگل درایو</h2>
        <p class="notice">${howTo}<br/>همین فایل را افزونهٔ «همگام‌سازی با گوگل درایو» پاکای روی کامپیوتر هم می‌خواند؛ پس پروژه‌ها و کارها بین وب، ویندوز، اندروید و پاکای اصلی یکی می‌مانند.</p>
        ${linked ? `<p>وصل به: <code>${esc(a.label())}</code></p>` : '<p class="muted">هنوز وصل نیست.</p>'}
        ${last ? `<p class="muted">آخرین همگام‌سازی: ${esc(last.message)} — ${fa(new Date(last.at).toLocaleTimeString('fa-IR'))}</p>` : ''}
        <div class="row">${buttons}</div>
        ${linked ? `<label class="row" style="margin-top:12px;color:var(--text)"><input type="checkbox" id="auto" style="width:auto" ${Y.auto() ? 'checked' : ''}/> همگام‌سازی خودکار (هنگام باز شدن، هر ۳ دقیقه و پس از هر تغییر)</label>` : ''}
      </div>
      <div class="card">
        <h2>پاکای آنلاین و ایجنت‌ها (برای بعد)</h2>
        <p class="notice">این نسخه کاملاً آفلاین است و دادهٔ هر دستگاه همان قالب <code>paca-sync</code> پاکاست. هر وقت سرور گرفتید: پاکای اصلی را با راهنمای <code>cloud/</code> روی سرور بالا بیاورید، افزونهٔ <code>com.karnameh.drive-sync</code> را نصب کنید و به همین فایل وصل کنید؛ همهٔ پروژه‌ها و کارها به پاکای سرور می‌روند و ایجنت‌های پاکا روی آن‌ها کار می‌کنند. آدرس سرور را این‌جا بنویسید تا از همین برنامه باز شود.</p>
        <label>آدرس پاکای آنلاین</label>
        <div class="row"><input id="srv" class="grow" dir="ltr" placeholder="https://paca.example.com" value="${esc(Y.server.url())}" /><button class="btn" id="srv-save">ذخیره</button>${Y.server.url() ? '<button class="btn primary" id="srv-open">باز کردن</button>' : ''}</div>
      </div>
      <div class="card">
        <h2>پشتیبان</h2>
        <div class="row"><button class="btn" id="export">دریافت فایل پشتیبان (JSON)</button><label class="btn" style="margin:0;color:var(--text)">بازگردانی از فایل<input type="file" id="import" accept=".json,application/json" class="hidden" /></label></div>
        <p class="muted">بازگردانی، فایل انتخاب‌شده را با دادهٔ فعلی ادغام می‌کند (چیزی پاک نمی‌شود).</p>
        <p class="muted">${fa(S.projects().length)} پروژه، ${fa(S.tasks().length)} کار، ${fa(S.entries().length)} ثبت زمان · نسخهٔ ${fa(global.PACA_OFFLINE_VERSION || '')}</p>
      </div>`;

    view().querySelectorAll('[data-link]').forEach((b) => (b.onclick = async () => {
      const [mode, arg] = b.dataset.link.split(':');
      b.disabled = true;
      try {
        const ok = await Y.adapters[mode].link(arg);
        if (ok) { Y.setMode(mode); toast('وصل شد. در حال همگام‌سازی…'); await Y.syncNow({ interactive: true }); }
        else toast('اتصال انجام نشد.');
      } catch (e) {
        toast('اتصال ممکن نشد: ' + ((e && e.message) || e));
      }
      renderSettings();
    }));
    if ($('#sync-now')) $('#sync-now').onclick = async () => { await Y.syncNow({ interactive: true }); toast(Y.state.last.message); renderSettings(); };
    if ($('#relogin')) $('#relogin').onclick = async () => { await Y.syncNow({ interactive: true }); toast(Y.state.last.message); renderSettings(); };
    if ($('#unlink')) $('#unlink').onclick = async () => { if (!confirm('اتصال به فایل قطع شود؟ داده‌های این دستگاه می‌ماند.')) return; await a.unlink(); renderSettings(); };
    if ($('#auto')) $('#auto').onchange = (e) => Y.setAuto(e.target.checked);
    $('#srv-save').onclick = () => { Y.server.setUrl($('#srv').value); toast('ذخیره شد.'); renderSettings(); };
    if ($('#srv-open')) $('#srv-open').onclick = () => {
      const url = Y.server.url();
      if (global.PacaDesktop) global.PacaDesktop.openExternal(url);
      else if (global.PacaAndroid) global.PacaAndroid.call('0', 'openUrl', url);
      else global.open(url, '_blank');
    };
    $('#export').onclick = () => download('paca-offline-' + today() + '.json', JSON.stringify(S.snapshot(), null, 2), 'application/json');
    $('#import').onchange = async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const doc = S.parse(await f.text());
      if (!doc) return toast('این فایل قالب paca-sync ندارد.');
      S.replace(S.mergeDocs(S.snapshot(), doc));
      toast('فایل ادغام شد.');
      Y.syncNow();
    };
  }

  // =========================================================================
  // ناوبری و نوار همگام‌سازی
  // =========================================================================
  function go(tab) {
    ui.tab = tab;
    saveUi();
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    render();
  }

  function render() {
    if (ui.tab === 'tasks') renderTasks();
    else if (ui.tab === 'focus') Focus.renderFocus();
    else if (ui.tab === 'report') renderReport();
    else renderSettings();
    Focus.bar();
  }

  function pill() {
    const p = $('#sync-pill');
    const st = Y.state;
    const a = Y.current();
    p.className = 'sync-pill';
    if (!a) { p.textContent = '○ همگام نیست'; p.className += ' warn'; return; }
    if (st.running) { p.textContent = '⟳ در حال همگام‌سازی…'; return; }
    const o = st.last && st.last.outcome;
    if (o === 'NEEDS_PERMISSION') { p.textContent = '⚠ ورود دوباره'; p.className += ' warn'; return; }
    if (o === 'FAILED') { p.textContent = '✕ خطای همگام‌سازی'; p.className += ' err'; return; }
    p.textContent = '✓ همگام' + (st.last ? ' · ' + fa(new Date(st.last.at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) : '');
    p.className += ' ok';
  }

  function init() {
    S.load();
    $('#platform-badge').textContent = { web: 'وب', windows: 'ویندوز', android: 'اندروید' }[Y.platform] + ' · آفلاین';
    document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
    $('#sync-pill').onclick = async () => {
      if (!Y.current()) return go('settings');
      await Y.syncNow({ interactive: true });
      toast(Y.state.last.message);
    };
    let renderTimer = null;
    S.onChange(() => {
      clearTimeout(renderTimer);
      renderTimer = setTimeout(() => {
        if ($('#dialog').open) return;
        if (ui.tab === 'settings' && !Y.state.running) return renderSettings();
        if (ui.tab !== 'settings') render();
      }, 50);
    });
    Y.subscribe(() => { pill(); });
    if (global.PacaSync.adapters.file && global.PacaSync.adapters.file.init) global.PacaSync.adapters.file.init().then(() => { pill(); if (ui.tab === 'settings') renderSettings(); });
    pill();
    go(ui.tab);
    Y.start();
  }

  global.PacaApp = { init, go, toast };
})(window);
