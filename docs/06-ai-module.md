# 06 – AI Module (Karnameh AI)

An optional, **paid add-on** connected to the whole workspace. Provider-agnostic: it can call a
cloud model or a self-hosted model (Ollama), chosen per workspace for privacy or cost.

## Capabilities (the three headline features)

1. **Answer questions from documents** — retrieval-augmented generation over workspace sources,
   with citations.
2. **Automatic task summarization** — condense a task, its comments and subtasks into a brief.
3. **Content & subtask generation** — draft task descriptions and propose subtask breakdowns.

Supporting features: Persian↔English translation of task content, and a daily/weekly digest.

## Pipeline

```
Ingest → Chunk → Embed → Store (pgvector)
                              │
User asks ──► embed query ──► retrieve top-k ──► prompt (with citations) ──► answer
```

- **Ingest**: files (PDF, DOCX, XLSX, TXT), URLs, task/list descriptions, comments.
- **Chunk**: token-aware windows with overlap; Persian-aware sentence boundaries.
- **Embed**: model selected by workspace config; vectors stored in `ai_chunk.embedding`.
- **Retrieve**: cosine similarity, optionally filtered by scope (list/space) and locale.
- **Generate**: prompt includes retrieved chunks + instructions; response returns citations.

## Jobs

| Job | Input | Output |
|-----|-------|--------|
| `ask` | question, scope | answer + citations |
| `summarize` | task id (or list) | ≤5 bullets |
| `generate_subtasks` | task id | proposed subtasks (user confirms before save) |
| `generate_content` | prompt, context | draft text |
| `translate` | text, target locale | translation |
| `digest` | user/workspace, period | summary of activity |

All jobs are asynchronous (`ai_job`) with status, token accounting, and audit logging.

## Persian quality

- Model selection favors strong Persian support; prompts are tested on Persian task text.
- Embeddings evaluated on a Persian query set before a model is accepted.
- Number/date rendering in AI output uses the same formatters as the UI (Jalali, Persian digits).

## Privacy & safety

- Opt-in per workspace; disabling the add-on stops all calls and hides AI UI.
- Workspace data is **not** used to train external models.
- Requests/responses logged for audit (configurable retention); PII redaction option for prompts.
- Generated subtasks/content are always **proposals** — nothing is written without user action.
- Answers always carry citations; low-confidence answers say so rather than guessing.

## Metering

- Usage recorded per workspace in `ai_job` (tokens/requests); surfaced in admin.
- `❓` Billing unit (tokens vs. requests vs. seats) and included allowance per plan.

## Acceptance criteria

- **AC-6.1** Upload a Persian PDF → ask a question → answer includes ≥1 citation to a real chunk.
- **AC-6.2** "Summarize this task" returns ≤5 bullets drawn from the task and its comments.
- **AC-6.3** "Generate subtasks" returns proposals; the user can edit then create them.
- **AC-6.4** With a self-hosted provider configured, no external network calls are made.
- **AC-6.5** Disabling the add-on removes AI entry points and blocks API calls.

## Open questions

- ❓ Launch formats: PDF + DOCX + TXT sufficient, or XLSX/images (OCR) too?
- ❓ Is a self-hosted-only mode required for compliance?
- ❓ Included monthly AI allowance per plan tier?
