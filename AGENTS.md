# Karnameh — Agent Rules

Karnameh is a Persian-first, RTL team/task app. This folder contains:

- `apps/android` — **native Kotlin + Jetpack Compose, fully offline** (no server,
  no `INTERNET` permission). The active mobile client.
- `desktop` — **offline Electron app for Windows** (0.7.1) that shares the same
  `karnameh-export` JSON bundle. No server, no `INTERNET`.
- `apps/web` + `apps/api` — the server-backed web app and API (not offline).

Read `HANDOFF.md` before changing the Android or desktop app.

## Canonical source

- Work in `D:\Projects\karnameh`.
- This folder is a git repository with a **public** GitHub remote
  (`HosseinRCH/karnameh`). Do not rewrite published history or force-push.
- Real seed bundles are ignored by git; use `samples/karnameh-seed.sample.json`
  for demo data.
- Never edit Autonameh files or the XAMPP runtime for Karnameh work.

## Non-negotiables for Android

1. **Offline only**: no `INTERNET` permission, no remote API calls, no hidden
   server. The timer foreground service is local only.
2. **Data moves only via import/export**: a single JSON bundle in the
   `karnameh-export` format, stored at
   `/data/data/com.karnameh.app/files/karnameh.json`.
3. **Preserve unknown bundle keys**: the store keeps arrays such as
   `views`, `activity`, `focusSessions`, `automationRuns`, `attachments`,
   `assignees`, `fields`, `values`. Do not drop arrays the UI does not edit.
4. **Compatibility**: the bundle should remain readable by the server's
   `/export` + `/import` format. Bump the bundle `version` only with a migration.
5. **No release/publish** without explicit approval. The APK is debug-signed.
6. Smallest safe change; no duplicate/backup/final files.

## Build and verify (Android)

Environment variables (do not rely on PATH):

```powershell
$env:JAVA_HOME = 'D:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = 'D:\Android\Sdk'
```

Build with the locally installed Gradle 9.8.2 (the wrapper would re-download
~145 MB):

```powershell
cd "D:\Projects\karnameh\apps\android"
& 'D:\gradle\dist\gradle-9.8.2\bin\gradle.bat' :app:assembleDebug :app:lintDebug --console=plain
```

Output: `app/build/outputs/apk/debug/app-debug.apk`.

Toolchain facts:

- `compileSdk 37`, `minSdk 26`, `targetSdk 37`, Build-Tools `36.0.0`.
- AGP `9.4.1`, Gradle `9.8.2`, Kotlin `2.4.21`, Compose BOM `2026.09.00`.
- No emulator system image is installed and no phone is usually connected, so
  runtime behaviour is **unverified** unless the user installs the APK.
- Dependency resolution uses Aliyun mirrors first because Google's Android
  repositories return 404 from this network. Do not remove them without a
  working alternative.
- `local.properties` uses `sdk.dir=D\:/Android/Sdk` (escaped colon for lint).

## Web/API (only when the task requires it)

```powershell
cd "D:\Projects\karnameh"
npm run typecheck
npm run test
npm run quality
```

Docker Desktop is installed but its engine is often off. The API needs
Postgres/Redis/MinIO via `docker compose up -d`.

## Where to look

- `HANDOFF.md` — current state, known bugs, test checklist, next steps.
- `apps/android/README.md` — Android behaviour and limitations.
- `apps/android/app/src/main/java/com/karnameh/app/` — Compose UI, store, timer
  service, automations.
- `apps/api/src/routes/transfer.ts` — canonical export/import bundle shape.
- `docs/` — product/architecture docs (some are older than the code).

## Definition of done

- `assembleDebug` and `lintDebug` pass.
- Report exactly which runtime checks were **not** performed.
- List changed files, risks, and the next step.
- Never claim a runtime fix is verified without a device/emulator test.
