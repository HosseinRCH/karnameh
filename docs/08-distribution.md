# 08 – Distribution & cloud access (EXE, APK, Google sign-in)

Goal: use Karnameh on **Windows (EXE)**, **Android (APK/PWA)** and the web from anywhere,
with **Google sign-in**, while the backend runs on your own PC behind a tunnel.

```
Phone / EXE / Web
      │  HTTPS
      ▼
Cloudflare Tunnel  ──►  Karnameh API (:4000)  ──►  Postgres (Docker)
                            │
                            └── also serves the built web app (single origin)
```

The API serves the built SPA, so one tunnel exposes everything: no CORS, one URL for the
PWA, the desktop app and the phone.

---

## 1. Build and run the server

```powershell
cd "D:\Projects\karnameh"
npm install
npm run build          # builds shared + API + web (web dist is served by the API)
npm run docker:up      # Postgres + Redis + MinIO
npm run db:push        # apply schema
npm run db:seed        # demo data (optional)
npm run dev:api        # http://localhost:4000 (serves the app + API)
```

Check: <http://localhost:4000> shows the login page. `/health` returns `{"status":"ok"}`.

---

## 2. Expose it over HTTPS (Cloudflare Tunnel)

Install `cloudflared` (one time):

```powershell
winget install --id Cloudflare.cloudflared
```

Start a **quick tunnel** (free, no domain):

```powershell
cloudflared tunnel --url http://localhost:4000 --edge-ip-version 4 --protocol http2
```

> If you see `Failed to initialize DNS local resolver ... region1.v2.argotunnel.com`, your
> network is preferring IPv6 and timing out. The flags above force **IPv4 + http2** and fix it;
> the DNS-resolver message after a successful “Registered tunnel connection” is harmless.
> If `cloudflared` is not recognised, open a **new** terminal (or run
> `"C:\Program Files (x86)\cloudflared\cloudflared.exe"`).

It prints a URL like `https://random-words.trycloudflare.com`. That is your public HTTPS URL.

> Quick-tunnel URLs **change** when you restart it. For a stable URL, create a **named tunnel**
> and attach a domain in the Cloudflare dashboard.

Keep the PC on and the tunnel running while you want remote access.

---

## 3. Google sign-in (OAuth)

1. Open <https://console.cloud.google.com/> → create/select a project.
2. **APIs & Services → OAuth consent screen**: choose *External*, add your own email as a
   **test user** (or publish the app).
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Add an **Authorized redirect URI**:

   ```
   https://YOUR-TUNNEL-URL/auth/oauth/google/callback
   ```

5. Copy the **Client ID** and **Client secret** into `apps/api/.env`:

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   WEB_APP_URL=https://YOUR-TUNNEL-URL
   API_BASE_URL=https://YOUR-TUNNEL-URL
   ```

6. Restart `npm run dev:api`. A **“Continue with google”** button appears on the login page.
   Signing in creates/uses the user with that Google email; your data follows the account.

> The client **secret never goes to the EXE/APK** — only the server uses it. The desktop/mobile
> apps are thin clients of the same web app.

---

## 4. Windows EXE (Electron)

The desktop shell lives in `desktop/` and loads `http://localhost:4000` by default
(override with the `KARNAMEH_URL` environment variable).

```powershell
cd "D:\Projects\karnameh\desktop"
npm install
npm run dist
```

Output: `desktop/release/Karnameh-0.1.0-portable.exe` (portable, no install).

Notes:

- The EXE is **unsigned** → Windows SmartScreen shows a warning (“More info → Run anyway”).
  Code signing requires a paid certificate.
- If the Electron download is blocked, use a mirror before `npm install` /
  `node node_modules/electron/install.js`:

  ```powershell
  $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
  ```

- If electron-builder fails with *“Cannot create symbolic link”*, `signAndEditExecutable` is
  already disabled in `desktop/package.json`. Enabling Windows **Developer Mode** also fixes it.
- The EXE expects the server at `localhost:4000`. Start it first (`npm run dev:api`), or set
  `KARNAMEH_URL` to the tunnel URL.

---

## 5. Android APK (PWABuilder / TWA)

The web app is now a **PWA** (manifest + service worker + icons), which is what PWABuilder needs.

1. Build and serve the app, then start the tunnel (steps 1–2).
2. Open <https://www.pwabuilder.com>.
3. Enter your **tunnel URL** and click **Start**.
4. **Package for stores → Android** → download the package.
5. Install the APK on your phone. (PWABuilder can generate a signing key for you, or you can
   supply your own keystore.)

The APK is a **Trusted Web Activity**: it opens your tunnel URL full-screen, with Google
sign-in working through the browser, and follows your account across devices.

> The phone needs the tunnel URL to stay reachable, which means the PC and `cloudflared` must be
> running. For always-on access, use a named tunnel on a small always-on server.

---

## 6. What is stored where

- Data (tasks, time, goals, automations…) lives in **PostgreSQL on your PC**.
- **Google** provides the **identity** (sign-in); your data is tied to that account.
- If you need the data **literally inside Google Drive**, that is a different sync design
  (`appDataFolder`); it is not what this setup does.

## 7. Security checklist

- Keep `GOOGLE_CLIENT_SECRET` and `JWT_SECRET` only in `apps/api/.env` (never committed).
- The tunnel exposes your server publicly; optionally protect it with **Cloudflare Access**.
- Use a strong `JWT_SECRET` before sharing the tunnel URL.
- Back up the Docker volume (`karnameh-db`) regularly.
