# 00 – Overview

## Vision

**Karnameh** is a web work-management platform for teams, with **first-class Persian and RTL
support**. English is the default UI; switching to Persian gives a right-to-left interface with
the Jalali calendar. It combines hierarchical task management (spaces → folders → lists → tasks),
multiple project views, time tracking with billing, goals, a built-in automation engine, and an
optional AI assistant.

## Goals

- **English default, Persian first-class**: the default UI is `en`/LTR; Persian (`fa-IR`) turns on
  `dir="rtl"`, the Jalali calendar, Persian typography, Persian search and a Sat–Fri work week.
- **One coherent data model** spanning hierarchy, custom fields, views, time, goals,
  automations and AI — no bolt-on subsystems.
- **Incremental delivery**: each phase ships something usable.
- **Self-hostable**: runs locally on Windows via Docker, deployable to a single server.

## Non-goals (v1)

- Native iOS/Android apps (a PWA covers mobile initially).
- Payments, invoicing and subscription billing (plans are modeled but not billed).
- A third-party integration/app marketplace.
- Full offline sync / conflict resolution.
- Enterprise SSO (SAML/OIDC) — designed for, delivered later.
- Public API rate-limit tiers and partner program.

## Success criteria (v1)

1. A team can create a workspace, spaces, lists, tasks and subtasks in **English (default) or
   Persian (RTL)**.
2. Custom fields (all core types) work on every list.
3. List, Board, Calendar, Gantt, Timeline and Workload views render from one data set.
4. Timers, timesheets and per-assignee estimates produce billable reports.
5. Goals show live progress as linked tasks complete.
6. At least five automation recipes run reliably, including the owner's example.
7. The AI add-on answers questions over uploaded documents and summarizes tasks.

## Glossary

| Term | Meaning |
|------|---------|
| **Workspace** | Top-level tenant. One account, many users. |
| **Space** | A project area inside a workspace. |
| **Folder** | Optional grouping of lists inside a space. |
| **List** | A collection of tasks with its own statuses and fields. |
| **Task** | Work item; can nest as a subtask. |
| **Custom field** | User-defined attribute on tasks. |
| **View** | A presentation of tasks (List, Board, Gantt, Timeline, Workload…). |
| **Dashboard** | A page of widgets (charts, numbers, tables). |
| **Time entry** | A logged interval of work, optionally billable. |
| **Timesheet** | A submitted/approved set of time entries for a period. |
| **Goal / Target** | Macro objective (goal) and its measurable key result (target). |
| **Automation** | A trigger → condition → action rule. |
| **Karnameh AI** | Optional AI add-on module. |

## Reference & legal posture

- Karnameh is an **original implementation**. No proprietary product's source, binaries,
  network traces, UI assets, copy or data were obtained or reused.
- The feature list came from the owner's own requirements. Comparable *ideas* (kanban boards,
  Gantt charts, time tracking, automation rules) are generic industry concepts and are
  implemented independently.
- Third-party product names are referenced only to describe the requested capability set, not
  to claim compatibility, affiliation or endorsement.
- Open-source libraries are used under their own licenses; attribution lives in
  `THIRD-PARTY.md` once code exists.

## Constraints

- **Windows-first development**, Docker Desktop or WSL2 for services.
- Persian data requires correct bidirectional text handling and Unicode normalization.
- Iran timezone is fixed at **UTC+03:30** (DST abolished in 2022) — no DST logic needed.

## Decisions confirmed

- **Stack:** Node.js + TypeScript (API), React + TypeScript (web).
- **Deploy target:** local, via Docker Compose on this machine.
- **Languages:** English (`en`) is the default UI; Persian (`fa-IR`) is fully supported (RTL + Jalali).

## Open questions

- ❓ Is a mobile PWA enough for v1, or is a native app required?
- ❓ Self-hosted AI (Ollama) required for data-privacy reasons, or is a cloud provider acceptable?
