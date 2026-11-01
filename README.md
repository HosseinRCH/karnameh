# Karnameh (کارنامه) — RTL-first Team & Task Management Platform

> Working name. **Karnameh** is an original product, designed from the feature list the owner
> requested. It is **not** derived from, and contains no code, assets or data from, any
> proprietary product. See [Reference & legal posture](docs/00-overview.md#reference--legal-posture).

**Status:** Phase 0 — foundation implemented (monorepo, API, DB schema, RTL/LTR web shell).
**Locale:** English (`en`) default; Persian (`fa-IR`) fully supported — RTL + Jalali on switch.
**Stack:** Node.js + TypeScript API; React + TypeScript web. **Deploy:** local Docker Compose.
**Offline clients:** Android (native, `apps/android`) and Windows (Electron, `desktop/`) run fully offline on the same `karnameh-export` JSON bundle. The server-backed web app stays in `apps/web` + `apps/api`.
**Location:** `D:\Projects\karnameh` (standalone; independent of the Autonameh repo).

## Why this exists

A team/task management platform where **Persian and RTL are first-class**, not a translation
layer bolted onto a left-to-right product. The default UI is English (`en`, LTR), while Persian
(`fa-IR`) is a complete, supported mode: RTL layout, Jalali (Shamsi) calendar, Persian
typography and Persian search normalization.

## Documentation index

| Doc | Contents |
|-----|----------|
| [00 – Overview](docs/00-overview.md) | Vision, scope, non-goals, glossary, legal posture |
| [01 – Feature Spec](docs/01-feature-spec.md) | Every requested feature, with acceptance criteria |
| [02 – Data Model](docs/02-data-model.md) | Entities, fields, relationships, ER diagram |
| [03 – Architecture](docs/03-architecture.md) | Stack, modules, APIs, realtime, storage, security |
| [04 – RTL & Persian](docs/04-rtl-persian.md) | RTL rules, Jalali calendar, numerals, i18n, a11y |
| [05 – Automations](docs/05-automations.md) | Trigger → condition → action engine & DSL |
| [06 – AI Module](docs/06-ai-module.md) | Document Q&A, summarization, generation (paid add-on) |
| [07 – Roadmap](docs/07-roadmap.md) | Phased plan, milestones, effort, risks |
| [08 – Distribution](docs/08-distribution.md) | EXE, APK/PWA, tunnel and Google sign-in |

## Decisions locked (from owner intake)

1. **Original design, no reverse engineering.** There is no third-party artifact to analyze and
   none will be used.
2. **Standalone project.** Lives outside the Autonameh repository.
3. **Spec + architecture first.** Implementation begins only after this design is reviewed.
4. **Stack:** Node.js + TypeScript (API), React + TypeScript (web).
5. **Deployment:** local, via Docker Compose on this machine.
6. **Languages:** English (`en`) default; Persian (`fa-IR`) fully supported (RTL + Jalali).

## Requested feature coverage

| # | Requested capability | Spec section | Phase |
|---|----------------------|--------------|-------|
| 1 | Unlimited storage, custom fields, dashboards | [01 §1](docs/01-feature-spec.md#1-limits--plans) | 0–1 |
| 2 | Billable time, timesheets, estimates per assignee | [01 §2](docs/01-feature-spec.md#2-time-tracking--reporting) | 2 |
| 3 | Zapier-like automations (condition → action) | [01 §3](docs/01-feature-spec.md#3-automations) · [05](docs/05-automations.md) | 4 |
| 4 | Gantt, Workload, Timeline views | [01 §4](docs/01-feature-spec.md#4-project-views) | 1 |
| 5 | AI: doc Q&A, summaries, content/subtask generation | [01 §5](docs/01-feature-spec.md#5-karnameh-ai-add-on) · [06](docs/06-ai-module.md) | 5 |
| 6 | Goals & targets with live progress | [01 §6](docs/01-feature-spec.md#6-goals--targets) | 3 |
| — | Persian + RTL ("right-hand mode") | [04](docs/04-rtl-persian.md) | all |

## How to review

1. Read [00 – Overview](docs/00-overview.md), then [01 – Feature Spec](docs/01-feature-spec.md).
2. Confirm or correct the **Open Questions** in each doc (they are marked `❓`).
3. Approve the stack in [03 – Architecture](docs/03-architecture.md) and the phasing in
   [07 – Roadmap](docs/07-roadmap.md).
4. On approval, Phase 0 implementation starts (foundation + RTL shell + core task model).

## Running locally

**Prerequisites:** Node.js ≥ 20 (verified on v26) and **Docker Desktop** with the WSL2 backend
(requires the Windows *Virtual Machine Platform* feature — see *Troubleshooting*).

```powershell
cd "D:\Projects\karnameh"
npm install
npm run build:shared
npm run db:generate   # generate the Prisma client

# start Postgres + Redis + MinIO (requires Docker)
npm run docker:up

# create the schema and demo data (db:push = quick dev sync, no migration files)
npm run db:push
npm run db:seed

# run the API (:4000) and web app (:5180) in two terminals
npm run dev:api
npm run dev:web
```

Open <http://localhost:5180> and sign in with `demo@karnameh.local` / `demo12345`.
Use the top-right toggle to switch between **English (LTR)** and **فارسی (RTL)**.

### Troubleshooting

**`pull access denied` / images won't download** — Docker Hub is blocked or unreliable in some
regions. `docker-compose.yml` already defaults to the ArvanCloud mirror; override it in `.env`:

```
DOCKER_MIRROR=docker.arvancloud.ir   # or docker.io, focker.ir, ...
```

**Docker won't start** — `Error response from daemon: Docker Desktop is unable to start`.
Docker's WSL2 engine needs the Windows **Virtual Machine Platform** feature. In an
**Administrator** PowerShell:

```powershell
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
```

Then **reboot**, run `wsl --update`, and start Docker Desktop (ensure CPU virtualization is
enabled in BIOS). Verify with `docker info`.

**Prefer no Docker?** Point the app at an existing local PostgreSQL by editing `apps/api/.env`:

```
DATABASE_URL=postgresql://postgres:<YOUR_PASSWORD>@localhost:5432/karnameh?schema=public
```

Then start that server and run `npm run db:push` followed by `npm run db:seed`.

### What Phase 0 contains

- Monorepo (npm workspaces): `packages/shared`, `apps/api`, `apps/web`.
- **API** (Fastify + Prisma): health, auth (register/login/me), workspaces + members, spaces,
  lists, tasks (create/update/status/dates), custom fields + values, assignees, tags, saved
  views, and Persian-normalized task search.
- **DB schema**: workspaces, users, memberships, spaces, folders, lists, statuses, tasks
  (with subtasks), custom fields and values, assignees, tags, saved views.
- **Web** (React + Vite + Tailwind): login, switchable RTL/LTR shell, sidebar, filter/sort bar
  with **saved views**, a **task detail drawer** (assignees, tags, custom fields, subtasks,
  dates), and **List** + **Board** (drag-and-drop) views with Jalali dates + Persian numerals.
- **Everything is managed in-app**: a **Manage** panel that adds *and removes* members, tags,
  custom fields, statuses, lists and folders, plus sidebar **＋** actions for spaces, folders and
  lists, and **group-by** in List view.
- **Accounts & security**: TOTP **2FA** (setup / verify / disable + two-step login), env-gated
  **OAuth** (Google/Microsoft), a **Jalali (Shamsi) date picker**, and a **workspace switcher**
  with creation.
- **Views (Phase 1)**: a view selector with List, Board, **Calendar (Jalali-first, with a
  Gregorian sub-date in both languages)**, **Gantt** (dependency arrows), **Timeline**,
  **Workload**, **Table**, **Activity**, **Dashboard** and Focus; task **dependencies** and
  per-task **estimates** feed Gantt/Workload, and dashboards offer number / bar / pie / table
  widgets. Saved views can be marked **default** (auto-applied).
- **Time (Phase 2)**: focus sessions carry a **billable** flag; **manual time entries**; a **Time**
  view with totals, **estimate vs actual** per task, per-user time, **hourly rate + currency** with a
  computed **billable amount**, **CSV export**, and **timesheets** (submit → approve / reject);
  per-assignee estimates in the task drawer.
- **Goals (Phase 3)**: goals with **Jalali-aware** periods and folders; targets of type number /
  currency / task-completion / boolean; **task linking** with **live weighted progress** (ticking a
  linked task fills the goal bar); and a **goals** dashboard metric.
- **Automations (Phase 4)**: a trigger → condition → action engine (task created/updated/status,
  set priority/status, assign, start timer) with a **run log**, **dry-run** and **loop
  protection**; includes the "In Progress ⇒ start timer + set priority High" recipe.
- **Guide (onboarding)**: an in-app **Guide** view (also a **?** button in the top bar) that
  explains every part of the app in **Persian and English**, each section with a
  “go to this section” shortcut.
- **Realtime, activity & notifications**: a real **activity log** (Activity view), an in-app
  **notification bell** (assignment alerts), and **SSE** syncing changes across open clients.
- **Gamified focus sessions** (core time primitive — first slice of Phase 2): timer state
  machine, architectural grid, points/streaks, ruin recovery, task linking.
- `docker-compose.yml` for Postgres 16, Redis 7 and MinIO.

## Verification

Verified on this machine (end-to-end):

- `npm run typecheck` — API and web TypeScript typecheck **pass**.
- `npm run test` — 5 Persian-normalization unit tests **pass**.
- `npm run check:rtl` — RTL guard **passes** (no physical-direction utilities).
- `npm run build` — shared, API and web production builds **pass**.
- `npm run db:generate` — Prisma client generated.
- `npm run docker:up` — Postgres 16, Redis 7 and MinIO containers **up** (Postgres healthy).
- `npm run db:push` + `npm run db:seed` — schema applied and demo data created.
- Full API round-trip: login → workspaces → spaces/list → tasks → custom fields all return
  correctly.
- Phase 0 additions: members, tags, task detail (assignees + tags), saved views, and
  **Persian-normalized search** (an Arabic-yeh query `طراحي` matches a Persian-yeh title `طراحی`).
- Phase 1 additions: task **dependencies** (`deps=1`), per-task **estimates** (`estimateMs`),
  and **dashboard** create / configure (`widgets=2`) / delete round-trip.
- Web bundle serves (`vite preview` → 200) with `<title>Karnameh</title>`.

**Note:** Docker Hub is blocked or unreliable in some regions. `docker-compose.yml` defaults to a
registry mirror (see *Troubleshooting*); set `DOCKER_MIRROR=docker.io` to use Docker Hub directly.

## Not yet done (later phases)

- Views beyond List/Board, and unlimited dashboards (Phase 1).
- Time tracking, timesheets, per-assignee estimates (Phase 2).
- Goals & targets with live progress (Phase 3).
- Automation engine (Phase 4).
- AI add-on (Phase 5).
- Realtime sync, notifications, guests, SSO.
- No ClickUp access, scrape, decompile, or asset reuse (original implementation only).
