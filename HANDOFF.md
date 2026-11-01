# Karnameh — Handoff

**Status:** Two offline clients — Android (native Kotlin) and Windows (Electron).
Latest: Android **0.7.1** (`versionCode 9`, debug APK) and Windows **0.7.1**
(portable EXE). GitHub: `https://github.com/HosseinRCH/karnameh`.

**خلاصه:** نسخهٔ اندروید در `D:\Projects\karnameh\apps\android` کاملاً آفلاین است
(بدون سرور و بدون مجوز اینترنت) و داده فقط با فایل JSON جابجا می‌شود. در ۰.۷.۰
بخش «زمان» با «تمرکز» یکی شد، زمان کار روی هر تسک نمایش داده می‌شود، تاریخ‌ها
جلالی‌اند و ساعت شروع/پایان دارند، تخمین ساعت+دقیقه است، ستون برد قابل افزودن
است، و یک بستهٔ دادهٔ محلی/نمونه داخل APK قرار می‌گیرد. در ۰.۷.۱ انتخاب ساعت
چرخی و از زمان حال شد، باگ ثبت‌نشدن زمان تمرکز روی تسک (استایل کهنهٔ store) رفع
شد، فهرست ثبت‌های زمان فیلتر روزانه/هفتگی/ماهانه/تسک گرفت و بخش گزارش با خروجی
CSV و کپی برای Google Sheets اضافه شد.

**Windows:** یک اپ Electron کاملاً آفلاین در `desktop/` با همان مجموعهٔ امکانات و
همان قالب `karnameh-export`؛ دادهٔ ۲۵ اکتبر داخلش seed شده و به‌صورت portable EXE
ساخته می‌شود. جزئیات در بخش ۴ب و `desktop/README.md`.

---

## 1. Where things are

| Item | Path |
|---|---|
| Project root | `D:\Projects\karnameh` |
| GitHub | `https://github.com/HosseinRCH/karnameh` |
| Android app | `D:\Projects\karnameh\apps\android` |
| Kotlin/Compose sources | `apps/android/app/src/main/java/com/karnameh/app/` |
| Local data (on device) | `/data/data/com.karnameh.app/files/karnameh.json` |
| Debug APK | `apps/android/app/build/outputs/apk/debug/app-debug.apk` |
| Seed bundle (first launch) | `apps/android/app/src/main/assets/karnameh-seed.json` (local-only, ignored by git) |
| Latest copied APK | `<Downloads>\Karnameh-0.7.1-offline.apk` |
| Windows app source | `desktop/` (`main.js`, `preload.js`, `renderer/`, `seed/`) |
| Windows portable EXE | `desktop/release/Karnameh-0.7.1-win-portable.exe` |
| Latest copied EXE | `<Downloads>\Karnameh-0.7.1-windows-offline.exe` |
| Latest portable ZIP (EXE + cleanup) | `<Downloads>\Karnameh-0.7.1-portable-win.zip` |
| Clean EXE (no personal data) | `<Downloads>\Karnameh-0.7.1-clean-win-portable.exe` |
| Clean portable ZIP | `<Downloads>\Karnameh-0.7.1-clean-portable-win.zip` |
| Windows data (portable) | `<EXE folder>\Karnameh-Data\karnameh.json` (+ `attachments/`, caches) |
| Windows data (fallback) | `%APPDATA%\Karnameh\karnameh.json` |
| Windows cleanup script | `desktop/release/…` delivery folder: `Delete-Karnameh-Data.cmd` |
| Windows seed | `desktop/seed/karnameh-seed.json` (local-only, ignored by git) |
| Web/API | `apps/web`, `apps/api` (server-backed, not offline) |

The project is a **public GitHub repository**:
`https://github.com/HosseinRCH/karnameh`.

Real seed bundles (personal work data) are ignored by git. For demo data copy
`samples/karnameh-seed.sample.json` into `apps/android/app/src/main/assets/`
or `desktop/seed/` as described in `samples/README.md`.

## 2. Environment / toolchain

```powershell
$env:JAVA_HOME = 'D:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'D:\Android\Sdk'
```

- JDK: Android Studio JBR 25 (`D:\Program Files\Android\Android Studio\jbr`)
- SDK: `D:\Android\Sdk` (Platform 37, Build-Tools 36.0.0, Platform-Tools 37.0.1)
- Gradle: `D:\gradle\dist\gradle-9.8.2\bin\gradle.bat` (local distribution)
- AGP 9.4.1, Kotlin 2.4.21, Compose BOM 2026.09.00
- `compileSdk 37`, `minSdk 26`, `targetSdk 37`
- No emulator system image installed; no phone normally connected.
- Google's Android repositories are blocked from this network (404); the project
  resolves dependencies from Aliyun mirrors. Do not remove them casually.
- VPN may be on/off; Aliyun/Tencent mirrors work without it.
- `local.properties`: `sdk.dir=D\:/Android/Sdk` (escaped colon; lint requires it).

## 3. Build / install

```powershell
cd "D:\Projects\karnameh\apps\android"
$env:JAVA_HOME = 'D:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'D:\Android\Sdk'

& 'D:\gradle\dist\gradle-9.8.2\bin\gradle.bat' :app:assembleDebug :app:lintDebug --console=plain
```

Output: `app/build/outputs/apk/debug/app-debug.apk`.

Install on a connected phone:

```powershell
& 'D:\Android\Sdk\platform-tools\adb.exe' install -r 'D:\Projects\karnameh\apps\android\app\build\outputs\apk\debug\app-debug.apk'
```

## 4. Architecture (Android)

- **Single module** `:app`, package `com.karnameh.app`.
- **OfflineStore** (`OfflineStore.kt`): the single source of truth. One JSON
  document in app storage, `format = "karnameh-export"`, with arrays for
  spaces/lists/statuses/tasks/timeEntries/goals/tags/assignees/fields/values/
  views/activity/focusSessions/automationRuns/attachments. Unknown keys are
  preserved on export. On a fresh install it seeds from
  `assets/karnameh-seed.json`.
- **Compose UI**:
  - `App.kt` — bottom navigation (5 tabs), import/export launchers, theme wiring.
  - `HomeScreen.kt` — dashboard widgets, due tasks, activity, advanced search.
  - `TasksScreen.kt` — list/board/table/calendar/Gantt/timeline/workload,
    filters, saved views, create task/space/list, add board column.
  - `TaskDetailScreen.kt` — status/priority/Jalali dates+times/estimate/desc,
    worked time, subtasks, assignees, tags, custom fields, attachments, delete.
  - `FocusScreen.kt` — focus + time tracking in one place: free timer,
    Pomodoro, open-task dropdown, manual time entry, time log.
  - `TimeScreen.kt` — **removed** in 0.7.0 (merged into Focus).
  - `DatePickers.kt` — Jalali date picker and `HH:mm` clock picker.
  - `GoalsScreen.kt`, `MoreScreen.kt`, `SearchScreen.kt`,
    `AutomationsScreen.kt`, `CalendarView.kt`, `PlanningViews.kt`.
- **FocusTimer.kt** — singleton state + SharedPreferences persistence. A stopped
  session (>= 30s) records both a focus session and a `timeEntries` row, so
  worked time on tasks and the time log stay in sync.
- **FocusTimerService.kt** — foreground service, ongoing notification with
  chronometer and pause/resume/stop actions.
- **Theme.kt/SettingsStore.kt** — Material 3, Vazirmatn, slate/indigo palette,
  light/dark/system (default light).
- **Permissions**: `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`,
  `FOREGROUND_SERVICE_SPECIAL_USE`. **No `INTERNET`.**

## 4b. Windows offline app (`desktop/`)

Version **0.7.1**, Electron 31 + a dependency-free vanilla-JS renderer (no build
step). Shares the Android bundle format and feature set.

- **Process split**: `main.js` owns the window, files and dialogs; `preload.js`
  exposes `loadData/saveData/saveFile/openDataFile/attachFile/openAttachment/...`
  with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  The renderer (`renderer/app.js`) only talks to that bridge.
- **Store**: `renderer/store.js` is a direct port of `OfflineStore.kt`
  (tasks/statuses/time/goals/automations/views/activity/fields/values/attachments,
  worked-time aggregation, legacy title matching, automations engine). Unknown
  keys survive import/export. Writes are whole-file and atomic; a single-instance
  lock prevents two copies from fighting.
- **Data**: the portable build stores **everything** in `<EXE folder>\Karnameh-Data`
  (`karnameh.json`, `attachments/`, and Chromium `session/logs/crashes/temp`)
  because `userData/sessionData/logs/crashDumps/temp` are redirected there; the
  folder is read-only-safe with a `%APPDATA%\Karnameh` fallback. First launch
  copies a local `seed/karnameh-seed.json` only when no data file
  exists. `KARNAMEH_DATA_DIR` overrides the folder for testing. Closing the app
  and deleting `Karnameh-Data` removes all app data; `Delete-Karnameh-Data.cmd`
  in the delivery folder also clears the fallback and leftover portable
  extraction folders.
- **UI** (`renderer/`): RTL Persian, local Vazirmatn, slate/indigo, sidebar.
  خانه (stats, due tasks, 7-day bars, activity), کارها (list/board/table/Jalali
  calendar/Gantt/timeline/workload, filters, saved views, add column),
  task detail (status/priority/assignees/tags/fields/subtasks/attachments,
  Jalali date+wheel time, hours+minutes estimate, worked vs estimate),
  تمرکز و زمان (timer + Pomodoro persisted in localStorage, open-task dropdown,
  manual entry, day/week/month/task/all log), اهداف, automations, advanced search,
  theme, JSON import/export/reset, and گزارش‌ها (CSV + Google Sheets clipboard).
- **Build**: `cd desktop && npm run dist` → `release/Karnameh-0.7.1-win-portable.exe`
  (~71 MB, no installer). `electronDist` points at the local Electron so the
  build stays offline; icon comes from `renderer/icon.png`. Two variants exist:
  the **seeded** build (contains a local seed bundle, for personal machines)
  and the **clean** build (no personal data; empty workspace + JSON import, for
  shared/work PCs). `desktop/portable/` holds the cleanup script and Persian
  readmes shipped with the ZIPs.
- **Verified**: renderer flows in Chromium (Playwright) — add task, detail edits,
  status/priority/automation, Jalali date, wheel time, timer recording, report
  TSV, board column, saved view, goal; packaged EXE launched and driven over CDP
  (bridge present, seed copied, add-task persisted to disk).
- **Not verified**: native save/open/attach dialogs, file opening, CSV file in
  Excel, manual feel of the wheel, single-instance UX, and long-run timer.

## 5. What works

- Offline data: spaces/lists/statuses/tasks, subtasks, tags, members/assignees,
  custom fields, attachments, time entries, goals, focus sessions.
- Views: list, board, table, Jalali calendar, Gantt, timeline, workload; new
  board columns can be added (and persist as statuses).
- Filters + saved views (status/priority/assignee/tag/sort/group).
- Dashboard widgets: status/priority breakdown, 7-day time chart, workload,
  goals; due/overdue tasks; activity.
- Local automations: trigger (created/status changed/updated), priority
  condition, actions (priority/status/tag/assign/start timer).
- Focus + time: free timer + Pomodoro, background service + notification,
  persisted state; linked task picked from a dropdown of **open** tasks only;
  every stopped session (>= 30s) writes a time entry on the task; manual entry
  and time log. Historic entries that only stored a task title in
  `description` (from the old Time screen) are attributed by exact title match.
- Tasks show **worked time vs estimate** in list, board, table and detail.
- Jalali date pickers and separate start/end time (`startTime`/`dueTime`,
  `HH:mm`) on tasks; estimate entered as hours + minutes.
- Fresh install seeds a local bundle from
  `assets/karnameh-seed.json`. It is local-only and ignored by git;
  `samples/karnameh-seed.sample.json` is the committed demo substitute.
- Import/export JSON; theme switch; RTL Persian UI; Vazirmatn; Jalali dates.

## 6. Known issues / unverified areas

1. **HIGH, unverified:** everything in 0.7.0/0.7.1 (merged focus/time screen,
   Jalali date/time pickers, worked-time display, add-column, seed data, time-log
   filters, CSV report) is compile-/lint-checked only; no device or emulator ran it.
2. **HIGH, unverified:** the 0.6.1 fix for the focus screen not ticking. Cause was
   a `tick` state written but never read, so Compose did not recompose. Fixed by
   reading a `now` timestamp state in `elapsedSeconds(now)`. Still needs a device
   test.
3. **HIGH:** foreground timer behaviour on OEMs (Xiaomi/Samsung/Huawei) is
   unverified. Users may need to disable battery optimization. The service uses
   `specialUse` FGS type.
4. **INFO:** 0.7.1 fixed a stale-cache bug: `FocusTimer.stop` wrote through a new
   `OfflineStore` (activity or service), while the UI held another in-memory
   store, so the new time entry/task link was invisible until restart. The UI now
   calls `store.reload()` on every `onChanged`.
5. **MEDIUM:** very short sessions are recorded as at least 1 minute (`> 0s`) so
   «پایان و ثبت» always produces an entry; «صفر» discards without recording.
6. **MEDIUM:** `startTime`/`dueTime` are local task keys. The Android app and its
   export preserve them, but the server's `/export`/`/import` does not know them,
   so they are cosmetic round-trip data on the web side.
7. **MEDIUM:** attachments are copied into app storage and open via FileProvider,
   but files are **not** included in the JSON export (metadata only).
8. **MEDIUM:** automations support one condition and one action; imported server
   rules are mapped partially (`task.set_priority`, `task.set_status`,
   `task.assign`, `time.start`). Unsupported fields/triggers may be ignored.
9. **MEDIUM:** no due-date reminders/notifications. The only system notification
   is the timer FGS.
10. **MEDIUM:** report export is CSV (UTF-8 + BOM), not a native `.xlsx`. Excel
    opens it; Google Sheets needs import/paste (the app is offline and has no
    Google API access).
11. **LOW:** board columns have no drag-and-drop; tasks are moved by changing
    status in the task detail.
12. **LOW:** Gantt only shows tasks with a start/due date; range/day width is fixed.
13. **LOW:** timeline groups by due date only.
14. **LOW:** advanced search is an overlay over the tab content (bottom nav stays).
15. **LOW:** lint reports 0 errors, 6 warnings (Ktx/ObsoleteSdkInt).
16. **INFO:** APK is debug-signed; no release keystore/signing config.
17. **INFO (Windows):** native dialogs (JSON import/export, attachment open, CSV
    save) were not manually exercised; the packaged EXE was driven over CDP.
18. **INFO (Windows):** the seeded EXE embeds a local seed bundle inside
    `app.asar`; deleting only `Karnameh-Data` does not remove that copy. For
    shared/work PCs use the **clean** build (no seed) and import the JSON, or
    delete the seeded EXE as well.
19. **INFO (Windows):** the portable EXE is unsigned (SmartScreen may warn), has
    no installer/auto-update, exports CSV (not `.xlsx`), and does not include
    attachment files in the JSON export. Closing the window ends the timer
    process; elapsed time continues on reopen.
20. **INFO:** no git repository; `git init` not done.

## 7. Manual test checklist (0.7.1)

Install 0.7.1 (use `adb install -r` to keep data, or clear data first to test the
seed), then:

- [ ] More → About shows `۰.۷.۱`.
- [ ] Bottom bar has 5 tabs; there is no «زمان» tab.
- [ ] Fresh install with the demo seed shows the sample tasks/time entries;
      e.g. «طراحی صفحهٔ اصلی» shows `کارکرد: 2 ساعت`. A title-only legacy
      entry can be tested separately.
- [ ] Task list and board cards show worked time (and `از تخمین` when set).
- [ ] Task detail: start/end date pickers open a **Jalali** grid; start/end time
      pickers are **wheels** and open on the current time (not 09:00); estimate
      takes hours + minutes; progress bar reflects worked vs estimate.
- [ ] Focus task dropdown lists only open tasks; a completed task is not offered.
- [ ] Start a timer on a task, stop after ~10s, «پایان و ثبت»: a time entry
      appears immediately in the log **with the task name** and the task's worked
      time increases (no manual entry needed).
- [ ] Time log: «روزانه / هفتگی / ماهانه / بر اساس تسک / همه» change the list and
      the per-day subtotal; the list never shows every task at once by default.
- [ ] Manual «ثبت دستی» adds an entry (task + hours + minutes).
- [ ] More → «گزارش تسکها و زمانها»: period chips change the summary;
      «دانلود اکسل (CSV)» saves a file that opens in Excel with Persian intact;
      «کپی برای Google Sheets» copies a table that pastes into Sheets.
- [ ] Board: «＋ افزودن ستون» adds a status column; it survives app restart.
- [ ] Theme switch: light / dark / system; default is light.
- [ ] Pomodoro: countdown changes live, completes, records a session.
- [ ] Start a timer, go home, close the app from Recents, wait, reopen: timer
      continues and the notification is present.
- [ ] Notification actions: pause, resume, stop.
- [ ] Export JSON, clear app data, import it; data and unknown keys survive.
- [ ] RTL layout and Persian font.

### Windows checklist (0.7.1)

Run `Karnameh-0.7.1-win-portable.exe` (data in `<EXE folder>\Karnameh-Data`,
shown in «بیشتر ← داده‌ها»):

- [ ] First launch with the demo seed shows the sample tasks/time entries;
      «طراحی صفحهٔ اصلی» shows `کارکرد: 2 ساعت`.
- [ ] Add a task, open it, change status/priority, set a Jalali start/end date
      and a wheel clock time, set an estimate in hours + minutes.
- [ ] Focus: pick an open task, start, wait, «پایان و ثبت» → entry appears
      immediately with the task name and worked time increases.
- [ ] Time log filters day/week/month/task/all and per-day subtotal.
- [ ] Views: list/board/table/calendar/Gantt/timeline/workload; add a board column.
- [ ] Report: period chips, CSV downloads and opens in Excel; clipboard paste
      works in Google Sheets.
- [ ] Attach a file to a task, reopen it from the detail, then delete it; file
      lands under `%APPDATA%\Karnameh\attachments`.
- [ ] Export JSON, reset data, import the file: tasks/times/unknown keys return.
- [ ] Close the window with a running timer and reopen: the elapsed time continues
      and the stop records it.
- [ ] Portable cleanup: close the app, run `Delete-Karnameh-Data.cmd`; the
      `Karnameh-Data` folder (and fallback) disappears and a fresh launch seeds
      the data again.
- [ ] Clean build: starts with 0 tasks; import the JSON and the tasks appear;
      close, run the cleanup script, confirm the folder is gone.
- [ ] Theme light/dark/system and `Ctrl+K` search.

## 8. Suggested next steps (priority)

1. Manually verify the Windows EXE against the checklist above (native dialogs
   are the only untested part).
2. Verify Android 0.7.1 on a real device, especially the focus → time-entry link
   and the wheel time picker.
3. Add due-date reminders (AlarmManager/WorkManager) with notification permission
   already in place.
4. Consider a real `.xlsx` writer (or Google Sheets API only if offline rules
   change); today the report is CSV + clipboard TSV.
5. Decide how `startTime`/`dueTime` should travel to the server bundle (map to a
   datetime field or keep them local-only).
6. Include attachments in export/import (ZIP bundle with JSON + files) and bump
   the bundle version.
7. Multi-condition/multi-action automations; drag-and-drop on the board.
8. Release signing config (APK) and a signed Windows build/installer.
9. Optional: `git init` + baseline commit (ask the maintainer first).

## 9. Starting a new chat correctly

The previous work was done from an Autonameh worktree, which is the wrong
directory. Start the new OpenCode session with the working directory:

```
D:\Projects\karnameh
```

`AGENTS.md` in that folder is loaded automatically. Then paste:

```text
در پوشهٔ D:\Projects\karnameh کار می‌کنیم (اپ کارنامه).
قبل از هر تغییر، AGENTS.md و HANDOFF.md را کامل بخوان.

هدف: رفع ایرادات نسخهٔ اندروید آفلاین 0.7.1.
قوانین: هیچ سرور/اینترنت/مجوز INTERNET اضافه نکن؛ داده فقط با JSON
import/export جابجا شود؛ فرمت karnameh-export را نشکن.

اولویت‌ها:
1) تأیید اجرایی 0.7.1 روی دستگاه: ثبت زمان تمرکز روی تسک، انتخابگر چرخی ساعت،
   فیلترهای ثبت زمان، و خروجی CSV/Google Sheets.
2) تست تایمر پس‌زمینه و نوتیفیکیشن (pause/resume/stop، بستن اپ).
3) تست seed: پاک‌کردن داده و نصب دوباره باید دادهٔ دو روز را برگرداند.

بیلد:
$env:JAVA_HOME = 'D:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'D:\Android\Sdk'
cd "D:\Projects\karnameh\apps\android"
& 'D:\gradle\dist\gradle-9.8.2\bin\gradle.bat' :app:assembleDebug :app:lintDebug --console=plain

در پایان: فایل‌های تغییرکرده، چک‌های اجراشده، چیزهای تست‌نشده و ریسک‌ها را گزارش کن.
```

## 10. Do not

- Add `INTERNET` or a remote server to the Android app.
- Replace the offline JSON store with a cloud API.
- Remove the import/export compatibility or unknown-key preservation.
- Publish/deploy or create a release build without explicit approval.
- Touch Autonameh or the XAMPP runtime for Karnameh work.
