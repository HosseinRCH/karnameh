# 03 – Architecture

## Style

**Modular monolith** with a clear domain-module boundary, deployed as a small number of
services. This keeps the first release operable on one server while leaving clean seams to
extract services later. Modules communicate through an in-process event bus; long-running work
goes to a job queue.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Web client (React + TS, RTL-first PWA)                              │
└───────────────┬───────────────────────────┬──────────────────────────┘
                │ REST /api/v1               │ WebSocket (realtime)
┌───────────────▼───────────────────────────▼──────────────────────────┐
│  API app (Node + TypeScript)                                         │
│  modules: identity · hierarchy · tasks · fields · views · dashboards │
│           time · goals · automations · ai · files · notifications    │
│           search · audit · billing(plan-only)                         │
│  ├─ in-process domain event bus ──► subscribers                      │
│  └─ job producers ──► Redis (BullMQ)                                 │
└───────┬───────────────┬──────────────────┬───────────────┬───────────┘
        │               │                  │               │
   PostgreSQL       Redis             Object store      Workers
   (+ pgvector)   (cache/queue/      (S3/MinIO)      automations ·
                   pub-sub)                           ai · reports ·
                                                      reminders
```

## Recommended stack

| Layer | Choice | Rationale |
|------|--------|-----------|
| Frontend | React 19 + TypeScript + Vite | Mature ecosystem; strong RTL tooling |
| Routing/data | TanStack Router + TanStack Query | Type-safe routes & server state |
| UI state | Zustand | Small, predictable |
| Styling | Tailwind CSS + Radix primitives, **CSS logical properties** | RTL without mirroring hacks |
| i18n | i18next + ICU MessageFormat | Plurals/formatting, RTL metadata |
| Charts/views | Custom + `visx`/`d3` primitives; virtualized lists | Gantt/Timeline/Workload control |
| Backend | Node 22 + TypeScript, **NestJS** (or Fastify) | Module boundaries, DI, OpenAPI |
| ORM/DB | Prisma + PostgreSQL 16 (`pgvector`) | Typed queries, migrations, vectors |
| Cache/queue | Redis + BullMQ | Realtime pub/sub + background jobs |
| Realtime | Socket.IO (WebSocket) with Redis adapter | Multi-instance fan-out |
| Files | S3-compatible object storage (MinIO locally) | "Unlimited" storage policy |
| AI | Provider-agnostic gateway (cloud + Ollama) | Privacy options, Persian quality |
| Packaging | Docker Compose (dev & single-host prod) | Reproducible on Windows |

**Confirmed by owner:** Node.js + TypeScript backend, React + TypeScript web, deployed locally
with Docker Compose. A PHP/Laravel backend was considered (closer to the owner's existing skills)
but rejected as the default because the realtime + AI/vector + shared-type story is simpler in one
language.

## Module responsibilities

| Module | Owns | Emits |
|--------|------|-------|
| identity | users, workspaces, memberships, auth, permissions | `member.joined` |
| hierarchy | spaces, folders, lists, statuses | `list.created` |
| tasks | tasks, subtasks, assignees, tags, dependencies, checklists, comments | `task.created/updated/status_changed/assigned/completed` |
| fields | custom fields & values, formulas/rollups | `field.changed` |
| views | saved views (incl. Gantt/Timeline/Workload configs) | — |
| dashboards | dashboards & widgets | — |
| time | timers, time entries, timesheets, rate rules, reports | `time.started/stopped/submitted/approved` |
| goals | goals, targets, link resolution, progress recompute | `goal.progress_changed` |
| automations | rules, evaluation, run log | `automation.run` |
| ai | sources, chunking, embeddings, jobs, conversations | `ai.job_finished` |
| files | uploads, storage policy, quotas | `file.uploaded` |
| notifications | preferences, delivery (in-app/email) | — |
| search | Persian-normalized full-text index | — |
| audit | activity log | — |

## API surface (v1 sketch)

- REST, versioned `/api/v1`, described by OpenAPI.
- Representative endpoints:
  - `POST /workspaces`, `GET /workspaces/:id`
  - `GET|POST /lists/:id/tasks`, `PATCH /tasks/:id`, `POST /tasks/:id/comments`
  - `GET|POST /lists/:id/views`, `POST /views/:id/preview`
  - `GET|POST /dashboards`, `POST /dashboards/:id/widgets`
  - `POST /time/start`, `POST /time/stop`, `GET|POST /timesheets`, `GET /reports/time`
  - `GET|POST /goals`, `POST /targets/:id/link`
  - `GET|POST /automations`, `POST /automations/:id/dry-run`
  - `POST /ai/ask`, `POST /ai/summarize`, `POST /ai/generate-subtasks`
- Auth: short-lived JWT access token + rotating refresh token; OAuth (Google/Microsoft);
  2FA optional.
- Realtime channels: `workspace:{id}` fan-out with entity-scoped topics
  (`task:{id}`, `list:{id}`, `goal:{id}`, `timer:{userId}`).

## Events & the automation loop

1. A write produces a domain event (transactional outbox).
2. Subscribers: automations, goals (progress), notifications, search indexer, audit.
3. The automation engine evaluates matching rules, applies actions, and records a run.
4. Actions may themselves produce events; a depth/visit guard prevents loops (see [05](05-automations.md)).

## Storage strategy ("unlimited")

- Files stored in S3/MinIO; metadata in `attachment`; content-addressed by checksum for dedupe.
- Storage usage aggregated per workspace for the admin panel and quota policy.
- Large text for AI is chunked and stored as vectors, not re-uploaded per query.

## Security & privacy

- Multi-tenant isolation: every query scoped by `workspace_id`; guarded at the repository layer.
- RBAC with per-list privacy and guest scoping; permission checks centralized.
- Secrets via environment/secret store; never committed. TLS everywhere in production.
- Rate limiting per user/IP; input validation on every endpoint; audit trail for sensitive actions.
- AI: opt-in per workspace; data not used for external model training; requests logged for audit.

## Performance

- Postgres indexes per [02](02-data-model.md); virtualized lists on the client.
- Read caching in Redis for hot views/dashboards; ETag/`If-None-Match` for lists.
- Workload/Gantt computed server-side with pagination/windowing by date range.

## DevOps

- `docker compose` for `db`, `redis`, `minio`, `api`, `worker`, `web`.
- Migrations on deploy; nightly DB + object-store backups.
- Structured logging, request tracing, health endpoints; error reporting hook.

## Risks

| Risk | Mitigation |
|------|-----------|
| Scope large vs. team size | Strict phasing ([07](07-roadmap.md)); ship usable slices |
| Persian search quality | Dedicated normalization + tuned full-text config early |
| AI provider dependency | Provider gateway + optional self-hosted model |
| RTL regressions | RTL checks in CI (visual + lint rules banning `left/right`) |
| Realtime cost | Entity-scoped topics + backpressure limits |
