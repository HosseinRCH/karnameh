# 01 – Feature Specification

Each section states the goal, the behavior, and testable **acceptance criteria (AC)**.
Data touchpoints link to [02 – Data Model](02-data-model.md).
`❓` marks an open question needing an owner decision.

---

## 1. Limits & plans

**Goal:** the requested "unlimited" tiers are a *plan policy*, not a hard schema limit.

### Behavior

- Plan tiers: `Free`, `Business`, `Business Plus` (analogue of the requested premium tier).
- "Unlimited" means **no product-imposed count limit**; storage is governed by fair-use and a
  configurable per-workspace soft quota.
- If a workspace ever exceeds its soft quota, uploads warn (and can be blocked) but existing
  data is never deleted.

### Acceptance criteria

- **AC-1.1** A Business workspace can create **>100 custom fields**, **>100 dashboards** and
  view them without pagination errors.
- **AC-1.2** Storage is measured per workspace and shown in admin settings; the soft quota is
  configurable by a workspace owner.
- **AC-1.3** Enforcing a quota never removes existing tasks, fields, dashboards or files.

### Open questions

- ❓ Concrete soft quota for the "unlimited" tier (e.g. 1 TB fair-use)?
- ❓ Are quotas enforced per workspace or per storage bucket?

---

## 2. Time tracking & reporting

**Goal:** track work, bill it, and estimate per assignee.

### 2.0 Gamified focus sessions — the core time primitive

All time in Karnameh is captured through **Focus Sessions** (deep-work blocks). A session places a
*blueprint* on the user's **architectural grid**; the outcome drives a reward economy:

- **Success** (timer reaches 0): the blueprint becomes a building; the user earns
  `points = duration in minutes` and the streak increments.
- **Failure / interruption** (window blur, tab hidden, or manual "Give up"): the blueprint becomes
  a **ruin**, no points are earned, and the streak resets.
- **Recovery**: a ruin can be cleared by spending `2 × its duration` in points.

A session may be linked to a task. Focus sessions are the unit that time entries, estimates,
reports and (later) the Calendar/Gantt/Timeline views aggregate over.

**AC-2.0**
- Completing a 25-minute session adds 25 points and +1 streak; a 50-minute session constructs a
  *landmark* instead of a *residential* building.
- Losing window focus mid-session (guard on) fails the session and leaves a ruin.
- A ruin can be cleared only when the user holds at least `2 × duration` points.

### 2.1 Billable time

- Any time entry can be flagged **billable** and carries a rate (currency).
- Rate resolution order (most specific wins): task/list override → user billable rate →
  workspace default rate. Currency is workspace-level (`IRR`; display may be Toman).
- Entry states: `running` (from a timer) → `completed`; then possibly `approved`/`rejected`.

**AC-2.1**
- Starting a timer then stopping it creates one entry with start, end and duration.
- Only **one running timer per user** at a time; starting a new one offers to stop the current.
- A report can total **billable vs non-billable** time per user, list, task and client.
- Changing a rate does **not** retroactively change already-approved entries unless explicitly
  recalculated.

### 2.2 Timesheets

- A timesheet is a period (default: Jalali week, Sat–Fri) of a user's entries with a workflow:
  `draft → submitted → approved | rejected`.
- Managers (workspace admins / list managers) see and approve their team's timesheets.
- Rejected timesheets return to the user with a reason.

**AC-2.2**
- A user can submit a period; it becomes locked from casual edits while pending.
- A manager can approve or reject with a comment; the user is notified.
- Approved timesheets are exportable to CSV/XLSX with Jalali and Gregorian date columns.

### 2.3 Time estimates per assignee

- A task has a **total estimate** and an optional **per-assignee estimate** table
  (one estimate per assigned user), summing to at most/at the total.
- Views show estimate vs logged time and a progress indicator per assignee.

**AC-2.3**
- Adding two assignees with estimates 4h and 6h shows a task total of 10h (auto-suggested,
  overridable).
- A task cannot be saved with per-assignee estimates exceeding a manually-set total unless the
  user confirms exceeding.
- The Task view shows `logged / estimate` per assignee and in total.

### Reporting

- Reports: time by user, list, space, tag, billable flag, client field; utilization;
  estimate-vs-actual.
- Filters respect the active workspace locale/calendar.

### Open questions

- ❓ Multi-currency support, or `IRR`-only for v1?
- ❓ Is an approval workflow required at launch, or is billable flagging enough initially?

---

## 3. Automations

**Goal:** a built-in, Zapier-like rules engine: **when <trigger>, if <conditions>, then <actions>**.

### Behavior

- Automations attach to a scope (workspace, space, folder, list, task, or personal "my rules").
- One trigger, zero-or-more conditions (AND/OR groups), one-or-more actions, executed in order.
- Triggers: task created/updated/status-changed/assigned, due-date approaching, comment added,
  custom-field changed, tag added, schedule (cron, Jalali-aware), inbound webhook, form submitted.
- Actions: set field/status/priority/assignee/dates, add tag/comment/checklist, create task/subtask,
  move list, **start/stop timer**, set estimate, notify (email/in-app/webhook), call HTTP API,
  apply template.
- Guarantees: **loop protection** (an automation cannot retrigger itself indefinitely), per-rule
  run logging, dry-run preview, enable/disable, versioning.

### Worked example (owner's request)

> **WHEN** task status changes to *In Progress*
> **THEN** start the timer for the acting user
> **AND** set priority to *High*.

Full DSL and engine semantics: [05 – Automations](05-automations.md).

**AC-3.1** The example above fires within 3 s of the status change and produces a run log.
**AC-3.2** A rule that would cause a loop is halted and flagged, never infinite.
**AC-3.3** Users can dry-run a rule against a sample task and see the resulting changes.

### Open questions

- ❓ Should automations be able to run **as** the triggering user (with their permissions) or as
  the rule owner? (Recommendation: rule owner, with permission checks.)
- ❓ Monthly cap on automation runs per plan?

---

## 4. Project views

**Goal:** many presentations of one task data set, created without limit.

| View | Purpose | Key config |
|------|---------|-----------|
| **List** | Dense table/grouped list | columns, grouping, subtask rollup |
| **Board** | Kanban by status/field | column source, WIP limits |
| **Calendar** | Tasks by date (Jalali) | date field, month/week |
| **Gantt** | Dependencies + duration bars | zoom, critical path, dependencies |
| **Timeline** | Bars without dependency emphasis | zoom, grouping |
| **Workload** | Capacity vs assigned effort per user | capacity model, estimate source |
| **Table** | Spreadsheet-style editing | inline edit, formulas |
| **Activity** | Changelog feed | filters |

- **Unlimited Gantt**: a workspace may create any number of Gantt views; each is independent.
- **Workload**: sums per-user estimates (including per-assignee estimates from §2.3) against a
  capacity (daily/weekly hours) and highlights over-allocation.
- **Timeline**: like Gantt, focused on sequential planning, Jalali month/quarter zoom.

**AC-4.1** A change to a task's dates reflects in List, Gantt, Timeline and Calendar immediately.
**AC-4.2** Workload marks a user over capacity when assigned estimates exceed capacity.
**AC-4.3** Drag on the Gantt bar changes start/due dates and persists; dependency arrows stay
consistent.
**AC-4.4** A task with a blocked-by dependency cannot be completed without a warning.

### Open questions

- ❓ Capacity model default: 8h/day × 5-day week (Sat–Wed) or configurable per user?
- ❓ Critical-path calculation in v1, or dependencies only?

---

## 5. Karnameh AI (add-on)

**Goal:** an optional, paid add-on connected to the whole workspace. Three headline abilities:

1. **Answer questions from documents** — retrieve-and-answer over workspace files (RAG).
2. **Automatic task summarization** — condense a task, its comments and subtasks into a short brief.
3. **Content & subtask generation** — draft descriptions, and break a task into subtasks.

### Behavior

- Toggle per workspace; usage metered; separate entitlements from the core plan.
- Sources: uploaded files, task/list descriptions, comments, URLs, and (optionally) docs.
- Answers **cite** the source chunks they used.
- Provider-agnostic (cloud model or self-hosted). Persian quality is a selection criterion.
- Privacy: workspace data is not used to train external models; requests are logged for audit only.

Details: [06 – AI Module](06-ai-module.md).

**AC-5.1** Uploading a PDF/DOCX and asking a question returns an answer with at least one citation.
**AC-5.2** "Summarize this task" returns ≤5 bullet points from the task and its comments.
**AC-5.3** "Generate subtasks" proposes a list the user can accept/edit/dismiss before creation.
**AC-5.4** Disabling the add-on stops all AI calls and hides AI UI.

### Open questions

- ❓ Self-hosted-only, cloud-only, or pluggable (recommended)?
- ❓ Usage metering unit: tokens, requests, or seats?
- ❓ Which document formats must be supported at launch (PDF, DOCX, XLSX, TXT)?

---

## 6. Goals & targets

**Goal:** define monthly/quarterly macro goals and connect tasks so progress fills live.

### Behavior

- **Goal** = macro objective with owner(s), period (month/quarter/custom, Jalali-aware), status.
- A goal holds one or more **Targets** (key results): numeric, currency, task-completion, or boolean.
- Targets can be **linked to tasks** (by tag, list, or explicit selection). Completing a linked
  task auto-updates the target and therefore the goal's progress bar.
- Progress = weighted roll-up of its targets; updates are live via realtime events.
- Goalfolders group goals.

**AC-6.1** Ticking/completeing a linked task updates the target and the goal progress bar within
one realtime tick, no manual refresh.
**AC-6.2** A target of type "task-completion" shows `completed / total` linked tasks.
**AC-6.3** Period boundaries use the Jalali calendar (e.g. Q1 = Farvardin–Khordad).
**AC-6.4** A goal's progress equals the weighted average of its targets.

### Open questions

- ❓ Weighting rule when targets are mixed types (recommend equal weight by default).
- ❓ Can goals span spaces, or are they space-scoped?

---

## 7. Cross-cutting requirements

| Area | Requirement |
|------|-------------|
| **RTL/Persian** | English default; Persian mode is RTL with Jalali calendar and Persian numerals/formatting. See [04](04-rtl-persian.md). |
| **Realtime** | Task/field/view/goal/timer updates propagate to all open clients. |
| **Notifications** | In-app + email; per-user subscription preferences; Persian templates. |
| **Search** | Full-text over tasks/comments/docs with Persian normalization. |
| **Permissions** | Workspace roles + per-list privacy + guest access. |
| **Audit** | Activity log for tasks, automations, timesheet approvals and AI usage. |
| **Accessibility** | Keyboard navigable, WCAG 2.1 AA where practical, RTL-aware. |

### Open questions

- ❓ Guest/client access at launch?
- ❓ Email provider for transactional notifications (local SMTP vs. service)?
