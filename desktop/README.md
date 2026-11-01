# Karnameh for Windows (offline)

A self-contained Electron app for Windows that runs **entirely offline** and uses
the same `karnameh-export` JSON bundle as the Android app. No server, no
`INTERNET` access, no cloud calls.

## Run (development)

```powershell
cd D:\Projects\karnameh\desktop
npm install          # already installed in this workspace
npm start
```

## Build the portable EXE

```powershell
cd D:\Projects\karnameh\desktop
npm run dist
```

Output: `desktop/release/Karnameh-0.7.1-win-portable.exe` (single portable EXE,
no installer). Electron is packaged from the local `node_modules/electron/dist`,
so the build does not download anything.

## Two portable builds

| Build | Contains | Use it for |
|---|---|---|
| Seeded EXE | A local `seed/karnameh-seed.json` (personal data, **not in git**) | Personal machines; first run has data immediately |
| Clean EXE | **No personal data**; starts with an empty workspace | Shared/work PCs; import your JSON, then delete the folder |

The repository does **not** contain the real seed. `npm run dist` from a fresh
clone therefore produces the clean variant. For a seeded demo build, copy the
synthetic bundle first:

```powershell
Copy-Item ..\samples\karnameh-seed.sample.json seed\karnameh-seed.json
npm run dist
```

Both variants share the same app code, features and data format.

Both delivery folders also ship `Delete-Karnameh-Data.cmd` and a Persian README;
`Delete-Karnameh-Data.cmd` removes `Karnameh-Data`, the `%APPDATA%`/
`%LOCALAPPDATA%` fallbacks and leftover portable extraction folders.

## Where the data lives

| Item | Path |
|---|---|
| Data bundle (portable) | `<folder of the EXE>\Karnameh-Data\karnameh.json` |
| Attachment files | `<Karnameh-Data>\attachments\` |
| Electron cache/session/logs | `<Karnameh-Data>\session`, `\logs`, `\crashes`, `\temp` |
| Fallback (read-only folder) | `%APPDATA%\Karnameh\` |
| Bundled first-run seed | `seed/karnameh-seed.json` (inside the app) |

On the **first launch** the app copies a local seed bundle to the data folder.
to the data folder. An existing `karnameh.json` is never overwritten.

The portable build keeps **everything** next to the EXE in `Karnameh-Data`, so
deleting that folder removes the app's entire footprint (data, attachments,
Chromium caches, logs). If the EXE's folder is not writable (e.g. Program Files),
the app falls back to `%APPDATA%\Karnameh`; the real path is shown in
**بیشتر → داده‌ها** with an «بازکردن پوشهٔ داده» button.

Cleanup on a shared/work computer:

1. Close the app completely.
2. Delete `Karnameh-Data` (or run `Delete-Karnameh-Data.cmd` from the release
   folder, which also removes `%APPDATA%\Karnameh`, `%LOCALAPPDATA%\Karnameh`
   and leftover portable extraction folders).
3. Delete the EXE and any exported JSON/CSV files; clear the clipboard if a
   report was copied for Google Sheets.

For testing, override the data folder:

```powershell
$env:KARNAMEH_DATA_DIR = 'C:\temp\karnameh-test'
npm start
```

## Feature set (matches the Android 0.7.1 client)

- **خانه:** open/done/today counters, focus time, due/overdue tasks, 7-day time
  chart, activity.
- **کارها:** list, board (add column), table, Jalali calendar, Gantt, timeline,
  workload; filters (status/priority/assignee/tag/sort/group), saved views,
  spaces/lists, search.
- **جزئیات کار:** title, description, status, priority, assignees, tags, custom
  fields, subtasks, attachments, Jalali start/end date + clock time, estimate in
  hours + minutes, worked time vs estimate with a progress bar, delete.
- **تمرکز و زمان:** free timer and Pomodoro, linked open-task dropdown, timer
  survives restarts (persisted in `localStorage`), every stop records time on the
  task, manual entry, log filters (day/week/month/task/all) with day subtotals.
- **اهداف:** goals with progress, add/update/delete.
- **اتوماسیون‌ها:** local rules (task created/updated/status changed → priority,
  status, tag, assign); enable/disable, delete, run log in `activity`.
- **بیشتر:** light/dark/system theme, reports, JSON import/export, reset,
  members/tags/custom fields management, stats.
- **گزارش‌ها:** period filter, tasks + time entries preview, **CSV download**
  (UTF-8 BOM, opens in Excel) and **copy for Google Sheets** (TSV clipboard).
  The app is offline, so Google Sheets requires an import/paste — there is no
  direct upload.
- Advanced search overlay (`Ctrl+K`).
- Files/JSON are stored locally; attachments are copied into the data folder and
  opened with the default Windows app.

## Security / isolation

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer only gets `loadData/saveData/saveFile/openDataFile/attachFile/...`
  through a preload bridge; it has no direct filesystem access.
- Content-Security-Policy allows local scripts/styles only.

## Known limits

- The portable build extracts itself to `%TEMP%` while running; the launcher
  normally cleans that folder on exit (the cleanup script removes leftovers).
  Windows Prefetch/Recent/Event Log entries are OS-level, not app data.
- Report export is CSV, not a native `.xlsx`; the CSV opens in Excel and imports
  into Google Sheets.
- Attachments are not embedded in the JSON export (metadata only), same as the
  Android client.
- Closing the window stops the timer process; reopening continues from the saved
  start time (elapsed time includes the closed period).
- No automatic updates, code signing, or installer; the artifact is portable.
