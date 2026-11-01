# 05 – Automations

A rules engine in the spirit of "Zapier built in": **when** something happens, **if** conditions
hold, **then** run actions. Rules are stored as data (JSON), not code, so they are editable in the
UI and safe to version.

## Rule shape

```jsonc
{
  "name": "Auto-start timer when work begins",
  "scope": { "type": "space", "id": "space_123" },
  "enabled": true,
  "runAs": "owner",              // or "actor"
  "trigger": { "type": "task.status_changed", "to": "<status:in_progress>" },
  "conditions": {
    "op": "and",
    "items": [
      { "field": "task.assignees", "operator": "includes_actor" }
    ]
  },
  "actions": [
    { "type": "time.start",  "params": { "for": "actor" } },
    { "type": "task.set_priority", "params": { "value": "high" } }
  ]
}
```

This encodes the owner's example directly: *when a task goes In Progress → activate the timer and
set priority High.*

## Triggers

| Trigger | Fires when | Payload |
|---------|-----------|---------|
| `task.created` | a task/subtask is created | task |
| `task.updated` | any field changes | task, diff |
| `task.status_changed` | status moves | task, from, to |
| `task.assigned` | assignee added/removed | task, assignee |
| `task.completed` | status enters a `done` type | task |
| `task.due_approaching` | N minutes/hours before due | task, offset |
| `comment.created` | a comment is posted | task, comment |
| `field.changed` | a custom field changes | task, field, value |
| `tag.added` | a tag is added | task, tag |
| `schedule` | cron expression (Jalali-aware) | timestamp |
| `webhook.inbound` | external call to a rule URL | body |
| `form.submitted` | a form (created from a list) is submitted | submission |

## Conditions

- Boolean tree of `and` / `or` groups over task fields, custom fields, assignees, tags, dates,
  and actor attributes.
- Operators: `equals`, `not_equals`, `contains`, `includes_actor`, `is_empty`, `is_before`,
  `is_after`, `greater_than`, `less_than`, `in`, `changed_from`, `changed_to`.
- Dates compared in the workspace calendar (Jalali) and timezone.

## Actions

| Category | Actions |
|----------|---------|
| Status/fields | `task.set_status`, `task.set_priority`, `task.set_field`, `task.set_dates`, `task.set_estimate` |
| People | `task.assign`, `task.unassign`, `task.notify` |
| Content | `task.add_comment`, `task.add_checklist`, `task.apply_template`, `task.create_subtask`, `list.create_task` |
| Placement | `task.move_list`, `task.add_tag`, `task.remove_tag` |
| Time | `time.start`, `time.stop`, `time.log` |
| External | `webhook.post`, `http.request`, `email.send` |

## Engine semantics

- Evaluated **after** the originating transaction commits (transactional outbox).
- Actions run **in order**; a failing action is logged and does not silently abort the rest
  (configurable: `continueOnError`).
- **Loop protection**: each run carries a `causation` chain and a per-entity visit counter; a rule
  that would re-trigger itself beyond a depth limit (default 3) is marked `looped` and halted.
- **Idempotency**: run keyed by `(automation_id, event_id)` so retries don't duplicate effects.
- **Dry-run**: evaluate a rule against a sample task and return the projected changes without
  persisting them.
- **Versioning**: editing a rule creates a new version; runs record the version used.
- **Permissions**: `runAs: "owner"` runs with the rule owner's rights (recommended); `"actor"`
  runs with the triggering user's rights — both checked against target entities.

## Reliability

- Queue: BullMQ with retries + exponential backoff; per-workspace concurrency limit.
- Delivery of `webhook.post`/`http.request` signed (HMAC) and retried.
- Run log retention configurable; failures surface in a workspace "Automation health" panel.

## Ready-made recipes (seed)

1. **Start timer on In Progress** (owner's example).
2. When a task is completed → notify watchers + post a summary comment.
3. When priority = Urgent → assign to team lead + tag `urgent`.
4. When due date is within 24h → notify assignee (once).
5. Every Sunday (Jalali) → create recurring "Weekly review" task.
6. When a form is submitted → create a task in list X with fields mapped.

## Acceptance criteria

- **AC-5.1** Recipe 1 starts a timer and sets priority within 3 s; a run appears in the log.
- **AC-5.2** A self-retriggering rule halts at the depth limit and is flagged `looped`.
- **AC-5.3** Dry-run shows projected changes and persists nothing.
- **AC-5.4** A failed external action is retried, then recorded as `failed` with the response body.
- **AC-5.5** Disabling a rule stops new runs immediately.

## Open questions

- ❓ Numeric cap on runs per plan (e.g. Business: X runs/month)?
- ❓ Should `schedule` cron use Jalali dates natively (recommended) or Gregorian only?
