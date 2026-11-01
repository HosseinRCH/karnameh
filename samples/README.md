# Sample data bundle

`karnameh-seed.sample.json` is a small, synthetic `karnameh-export` bundle used
for demos and for building a seeded client. It contains **no real work data**.

## Android

The app seeds itself from `app/src/main/assets/karnameh-seed.json`. That file is
ignored by git because the real one contains personal data. To build a demo
variant:

```powershell
Copy-Item samples\karnameh-seed.sample.json `
  apps\android\app\src\main\assets\karnameh-seed.json
```

Without it the app starts with a minimal empty workspace.

## Windows desktop

The portable build seeds from `desktop/seed/karnameh-seed.json` (ignored by git).
To build a seeded demo variant:

```powershell
Copy-Item samples\karnameh-seed.sample.json desktop\seed\karnameh-seed.json
cd desktop
npm run dist
```

Without it, the build is the **clean** variant (empty workspace + JSON import).

## Moving data

Both clients export/import the same `karnameh-export` JSON, so any bundle
(including a real one) can be moved between Android and Windows, and to the
server-backed web app.
