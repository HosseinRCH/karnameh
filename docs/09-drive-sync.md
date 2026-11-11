# 09 – Google Drive sync (Android, Windows, web)

The Android app stays fully offline, but can sync its `karnameh-export` bundle with one
JSON file in Google Drive. Other tools (for example an AI assistant with access to the
same Drive) can read and edit that file; the phone picks the changes up on its next sync.

## On the phone
More → Data → **Google Drive sync** → *Create a new file in Google Drive*, then pick
**Google Drive** in the side menu of the system file picker (default name
`karnameh-sync.json`). The app syncs when it opens and when it goes to the background,
plus on demand with *Sync now*. No Google Cloud project or OAuth client is needed: the
Google Drive app on the phone handles the network.

## On Windows
Install **Google Drive for desktop** so My Drive shows up as a folder (usually `G:\My Drive`).
In the app: بیشتر → **همگام‌سازی با گوگل درایو** → *اتصال به فایل موجود*, and pick the same
`karnameh-sync.json` the phone uses. The app reads and writes that file in place (same Drive
file ID), syncing on start, on focus, 15 s after a change and every 3 minutes. Settings live in
`drive-sync.json` in the app's data folder. Windows EXE: release `windows-latest` (`Karnameh.exe`).

## Web version
GitHub Pages serves the same UI (`web/build.sh` builds it from `desktop/renderer`). Data stays
in the browser (localStorage). In Chrome or Edge on a computer, the File System Access API links
the same `karnameh-sync.json` from the Google Drive for desktop folder; the browser asks to
confirm access once per visit (button *تأیید دسترسی و همگام‌سازی*). Other browsers work without sync.

A client linking for the first time with no tasks takes the Drive file as is; otherwise both
sides are merged. Clients write `updatedBy` as `android`, `windows` or `web`.

## File protocol
The file is a normal `karnameh-export` bundle plus a `sync` object:

```json
"sync": { "rev": 12, "updatedBy": "android", "updatedAt": "2026-11-11T06:30:00Z" }
```

Anyone editing the file outside the app must:
1. Read the file, change the records, set `updatedAt` on every record changed or created
   (ISO-8601 UTC) and give new records a fresh UUID `id`.
2. Raise `sync.rev` by one and set `updatedBy` to who they are.
3. Write the whole file back, keeping the same Drive file (update content, do not create a new file).

## Conflicts
If both the phone and Drive changed since the last sync, every array of records is merged
by `id`; the record with the newer `updatedAt` (or `createdAt`) wins. Other values follow
Drive. A record deleted on one side while the other side also changed comes back.

## Notes
- The Google Drive app may serve a cached copy for a short while after a remote edit;
  *Sync now* a minute later picks it up.
- Attachments' binary files are not synced, only their metadata.
