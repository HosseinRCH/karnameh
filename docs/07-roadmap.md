# 07 – Roadmap

Phased delivery. Each phase ends with a **usable increment**, a demo and a review gate. Effort is
in **developer-weeks** for one full-time developer and is a rough order of magnitude, not a promise.

## Phase 0 — Foundation (≈ 6–8 weeks)

**Scope:** identity, workspaces, hierarchy, tasks, custom fields, List + Board views, and the
RTL/Persian shell.

- Workspaces, users, memberships, roles; email auth + optional OAuth; 2FA-ready.
- Spaces → folders → lists → tasks/subtasks; assignees, tags, priorities, statuses.
- Custom fields (all core types).
- List and Board views with filters/sort/group; saved views.
- **RTL-first UI shell**: `dir="rtl"`, Vazirmatn, Jalali dates, Persian numerals, Persian search
  normalization, i18n plumbing.
- Docker Compose dev stack; CI with RTL lint + Persian search tests.

**Exit:** a team can run real work in Persian, RTL. Covers requested item **#1** (fields) and the
foundation for everything else.

**Status — ✅ complete.** Implemented: email auth + roles; spaces/folders/lists/tasks (with
subtasks); assignees, tags, priorities, statuses; custom fields; List + Board with search,
filters, sort, **grouping** and **saved views**; a **Manage** panel that can add *and remove*
members, tags, custom fields, statuses, lists and folders; sidebar creation of
spaces/folders/lists; **RTL/LTR shell** (direction switch, Vazirmatn, Jalali dates, Persian
numerals, Persian search normalization); Docker Compose; CI (typecheck, unit tests, RTL guard,
build).

**Extra (this pass):** **2FA (TOTP)** end-to-end; a **native Jalali (Shamsi) date picker**;
**workspace creation + a workspace switcher**; **status reordering**. **OAuth** (Google/Microsoft)
is implemented but **dormant until credentials are configured** — set `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` (and `MICROSOFT_*`) — and is therefore **not verified**.

## Phase 1 — Views & dashboards (≈ 4–6 weeks)

- Calendar, **Gantt**, **Timeline**, **Workload**, Table, Activity views; dependencies.
- **Dashboards**: widgets (number, bar, line, pie, table, goal), unlimited per workspace.
- View sharing/defaults.

**Exit:** requested item **#4** and dashboards of **#1** complete. **AC-4.x** pass.

**Status — ✅ complete (widgets partial).** Views: List, Board, Calendar (**Jalali-first**, with a
Gregorian sub-date, in both languages), Gantt (SVG with dependency elbows), Timeline (grouped),
Workload (per-assignee estimate load), Table, **Activity**, Dashboard and Focus. Task
**dependencies** and per-task **estimates**. **Dashboards** with number / bar / pie / table
widgets over status, priority, assignee and completion. **Default saved view** (set +
auto-applied). Remaining: `line` and `goal` widget types.

## Phase 2 — Time tracking & reporting (≈ 4–6 weeks)

- **Gamified focus sessions** — the core time primitive (grid, points, streaks, ruins).
  *A first slice is already implemented in the Phase 0 build.*
- Timers (one per user), manual entries, **billable** flags and rate resolution.
- **Timesheets** with submit/approve workflow.
- **Estimates per assignee**; estimate-vs-actual.
- Reports: time by user/list/space/client, utilization, billable totals; CSV/XLSX export.

**Exit:** requested item **#2** complete. **AC-2.x** pass.

**Status — ✅ complete.** Focus sessions with a **billable** flag; **manual time entries**; a
**Time** view with totals, **estimate-vs-actual**, a per-user breakdown, **hourly rate + currency**
and a computed **billable amount**, **CSV export**, and **timesheets** (submit → approve / reject);
per-assignee estimates. Remaining: XLSX export (CSV is provided).

## Phase 3 — Goals & targets (≈ 2–3 weeks)

- Goals with Jalali-aware periods; targets (numeric/currency/task-completion/boolean).
- Link tasks/tags/lists; **live progress** roll-up via realtime events.
- Goal folders and dashboards widgets.

**Exit:** requested item **#6** complete. **AC-6.x** pass.

**Status — ✅ complete.** Goals with **Jalali-aware** month / quarter / custom periods and
folders; targets of type **number / currency / task_completion / boolean**; **task linking**
(task-completion targets); **live weighted progress** (ticking a linked task updates the target →
the goal); and a **goals** metric for dashboards.

## Phase 4 — Automations (≈ 4–5 weeks)

- Rule builder UI; trigger/condition/action engine; run log; dry-run; loop protection.
- Seed recipes, including the owner's "In Progress → start timer + set High".

**Exit:** requested item **#3** complete. **AC-5.x** pass.

**Status — ✅ complete.** Trigger → conditions → actions engine; triggers **task created / updated /
status-changed**; conditions on priority / status / assignee; actions **set priority**, **set
status**, **assign**, **start timer**; **run log**, **dry-run** and **loop protection** (depth cap +
visited set). The owner's recipe is verified: *task → In Progress ⇒ start timer + set priority
High*. Remaining: scheduled (cron) triggers and outbound webhooks.

## Phase 5 — AI add-on (≈ 4–6 weeks)

- Sources + chunking + embeddings (pgvector); ask/summarize/generate jobs.
- Provider gateway (cloud + self-hosted Ollama); citations; metering; privacy controls.

**Exit:** requested item **#5** complete. **AC-6.x** pass.

## Phase 6 — Hardening & integrations (≈ 4–6 weeks)
- Realtime everywhere, notifications (in-app + email), audits.
- Public API + webhooks, Zapier-style outbound integrations, form builder.
- PWA polish, performance passes, accessibility audit, backups/DR.
- **In-app Guide** covering every module — *delivered early (available now)*.

**Status — 🟡 started.** Delivered: **workspace activity log**, **in-app notifications** (bell +
assignment alerts), **realtime SSE** sync, and the **in-app Guide**. Remaining: email
notifications, public API + outbound webhooks, XLSX export, PWA polish, accessibility audit.

## Cross-phase deliverables (continuous)

- Persian + RTL checks in CI; Persian search test suite.
- Docs, seed/demo data, migration discipline.
- Security review at the end of each phase.

## Milestone summary

| Milestone | Includes | Cumulative (single dev) |
|-----------|----------|------------------------|
| **M1** Persian RTL core | Phase 0 | ~2 months |
| **M2** Views & dashboards | Phase 1 | ~3–3.5 months |
| **M3** Time & billing | Phase 2 | ~4–5 months |
| **M4** Goals | Phase 3 | ~5 months |
| **M5** Automations | Phase 4 | ~6 months |
| **M6** AI add-on | Phase 5 | ~7–7.5 months |
| **M7** Integrations & hardening | Phase 6 | ~9 months |

> These estimates assume one developer. A team of 3–4 (frontend, backend, design, QA) compresses
> this roughly in proportion, with M1–M2 reachable in the first quarter.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Scope is very large | Strict phase gates; ship M1/M2 early for real use |
| Gantt/Timeline complexity | Prototype the hardest view (Gantt) in Phase 1 immediately |
| Persian search/typography gaps | Dedicated normalization layer + test suite from Phase 0 |
| AI cost/privacy | Provider gateway with self-hosted option; metering and opt-in |
| Single-dev bus factor | Documentation-first, CI, and this design set |

## Immediate next step (on design approval)

Build **M1 / Phase 0** foundation:
1. Monorepo skeleton (web + api + shared types), Docker Compose (Postgres/Redis/MinIO).
2. Auth + workspace + hierarchy + task schema and migrations.
3. RTL app shell (Vazirmatn, Jalali, Persian formatters, i18n) with List + Board views.
4. CI: lint, RTL lint rule, Persian search tests.

## Decisions confirmed

- Backend stack: **Node.js + TypeScript**; web: **React + TypeScript**.
- Deploy target: **local**, Docker Compose on this machine.
- Languages: **English default**, **Persian (RTL) fully supported**.

## Open questions

- ❓ Approve phase order and the M1 scope above.
