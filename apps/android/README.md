# Karnameh Android (offline, native)

> **New session?** Start it in `D:\Projects\karnameh` and read
> [`../../AGENTS.md`](../../AGENTS.md) and [`../../HANDOFF.md`](../../HANDOFF.md)
> first. They contain the current state, known bugs, build commands and a
> copy-paste prompt.

Native Android client for Karnameh, built with Kotlin + Jetpack Compose.
Persian-first, RTL, **fully offline** (no server, no `INTERNET` permission), with
JSON import/export as the only way data moves between devices.

## Design

- Material 3 + **Vazirmatn**, matching the Windows app's slate/indigo palette.
- Bottom navigation: خانه، کارها، تمرکز، اهداف، بیشتر.
- **Theme switch:** More → «تم برنامه» → روشن / تاریک / سیستم (default light).
- Jalali (Shamsi) date pickers everywhere, plus wheel time pickers for
  start/end clock time (they open on the current time).

## Current scope (0.7.1)

- خانه: dashboard widgets (status, priority, 7-day time, workload, goals),
  due/overdue tasks, activity, **advanced search** entry
- کارها: list / board / table / calendar / Gantt / timeline / workload, filters,
  saved views, grouping, search; the board can add new status columns
- جزئیات کار: title, description, status, priority, Jalali start/end date + time,
  estimate as hours and minutes, **worked time vs estimate**, subtasks,
  assignees, tags, custom fields, **attachments**, delete
- **تمرکز و زمان:** the single time-tracking screen
  - free timer and Pomodoro, linked task chosen from a dropdown of open tasks
  - stopping a session records a time entry on the task **immediately**, so
    worked time and the time log stay in sync
  - manual time entry (task + hours + minutes)
  - time log with روزانه / هفتگی / ماهانه / بر اساس تسک / همه filters and
    per-day subtotals
  - **Background timer:** a foreground service keeps the timer running when the
    app is closed, with an ongoing notification (chronometer) and
    pause/resume/stop actions.
  - State is persisted; reopening the app restores a running/paused timer.
- **گزارش‌ها:** More → «گزارش تسک‌ها و زمان‌ها» → period filter (today / 7 days /
  30 days / all), summary, CSV download (UTF-8 BOM, opens in Excel) and
  «کپی برای Google Sheets» (TSV in the clipboard).
- اهداف: goals and progress
- مدیریت: spaces, lists, statuses, members, tags, custom fields
- اتوماسیون محلی: task created / status changed / updated rules with priority
  condition; actions: priority, status, tag, assign, start timer; enable/disable,
  delete, recent runs; imported server rule types are mapped where possible
- **جستجوی پیشرفته:** text + priority + assignee + tag + list filters across all
  lists, results open the task detail
- بیشتر: theme, import/export, stats, reset

## Permissions (no internet)

- `POST_NOTIFICATIONS` — timer notification on Android 13+.
- `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_SPECIAL_USE` — keep the timer alive
  in the background (service type `specialUse`).
- The app does **not** request `INTERNET`; all data stays on the device.

## Limitations / next phase

- Attachments are copied into app-private storage; they are **not** included in
  the JSON export (only their metadata is). Moving files between devices needs a
  separate bundle/zip.
- Report export is CSV, not a native `.xlsx`; Google Sheets needs an import or a
  clipboard paste because the app is fully offline.
- Timer notifications show progress and actions, but due-date reminders are not
  implemented yet.
- Custom field types: text, long text, number, date, checkbox.
- AI and multi-user collaboration are not meaningful in an offline single-user app.

## Offline data model

`/data/data/com.karnameh.app/files/karnameh.json`, using the
`karnameh-export` bundle format. Extra local arrays (`views`, `activity`,
`focusSessions`, `automationRuns`, `attachments`, `assignees`, `fields`,
`values`) are preserved on import/export.

On a **fresh install** (no data file yet) the app seeds itself from
`app/src/main/assets/karnameh-seed.json`, so a local work bundle can travel
inside the APK. An existing `karnameh.json` is never overwritten.

The real seed bundle is **not committed** to git (it contains personal work
data). For a demo/seed build, copy `samples/karnameh-seed.sample.json` to
`app/src/main/assets/karnameh-seed.json` before building; without it the app
starts with a minimal empty workspace.

## Requirements

- JDK 17+ (Android Studio's bundled JBR 25 works)
- Android SDK Platform 37, Build-Tools 36.0.0
- Gradle 9.8.2 (project wrapper)

`local.properties`:

```
sdk.dir=D\:/Android/Sdk
```

## Build

```powershell
$env:JAVA_HOME = 'D:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'D:\Android\Sdk'

& 'D:\gradle\dist\gradle-9.8.2\bin\gradle.bat' :app:assembleDebug --console=plain
```

Output: `app/build/outputs/apk/debug/app-debug.apk`.

## Install

```powershell
& 'D:\Android\Sdk\platform-tools\adb.exe' install -r 'D:\Projects\karnameh\apps\android\app\build\outputs\apk\debug\app-debug.apk'
```

## Notes

- `minSdk = 26`, `targetSdk = 37`, `compileSdk = 37`.
- No emulator system image is installed on this machine; the APK is compiled and
  lint-checked, and can be installed on a real device.
- The Windows desktop app in `../../desktop` is still a shell around the server
  and is **not** offline yet.

