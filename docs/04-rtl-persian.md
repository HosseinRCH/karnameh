# 04 – RTL & Persian (right-hand mode)

Persian support is a **first-class feature**, not a locale pack. English is the default UI
(`en`, LTR); when Persian (`fa-IR`) is selected the app renders `dir="rtl"`, switches to the
Jalali calendar, and applies Persian typography and normalized search.

## 1. Direction & layout

- Default is `lang="en" dir="ltr"`; Persian mode sets `lang="fa" dir="rtl"`. Direction is a
  runtime token, not hard-coded per screen, so both modes share one component library.
- **CSS logical properties only**: `margin-inline-start`, `padding-inline-end`, `inset-inline-*`,
  `border-inline-*`, `text-align: start`. Physical `left/right` are banned (enforced by lint).
- Tailwind uses logical variants (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`); an ESLint
  rule fails the build on physical spacing utilities in RTL-sensitive components.
- Icons with direction semantics (chevrons, arrows, back/forward, progress) **mirror** in RTL.
  Logos and universally recognizable glyphs (play, clock) do **not** mirror.
- Charts: axes and legends follow reading direction; time axes still flow left→right where a
  conventional chronology is expected — `❓` confirm preference for Gantt/Timeline.

## 2. Typography

- UI font: **Vazirmatn** (variable, self-hosted `woff2`), fallback `system-ui`.
- Latin numerals/text inside Persian use the same family; digits are rendered per numeral policy.
- Line height and letter-spacing tuned for Persian; avoid faux-bold.

## 3. Numerals & formatting

- Central formatter (Intl-based) with a workspace setting: **Persian digits** (۰۱۲۳) or Latin.
- Numbers, currency (`IRR`, optional Toman display), percentages, and file sizes use the same
  formatting layer — no ad-hoc `toFixed` strings in the UI.
- Persian decimal/thousands separators respected; inputs accept both digit sets and normalize.

## 4. Calendar & time

- Default calendar: **Jalali (Shamsi)**; Gregorian available per workspace/user.
- Libraries: `date-fns-jalali` (or `jalaali-js`) behind a single `Calendar` adapter so both
  calendars share one interface.
- Week starts **Saturday**; weekend = Friday (`❓` Thu–Fri for some orgs).
- Date pickers, Gantt/Timeline zoom levels, and goal periods use Jalali months/quarters
  (e.g. Q1 = Farvardin–Khordad).
- Timezone default `Asia/Tehran` (**UTC+03:30**, fixed — no DST since 2022).

## 5. Bidirectional text

- Mixed Persian/Latin content (code, emails, URLs) uses proper bidi isolation
  (`<bdi>`, `dir="auto"`, or Unicode isolates) so punctuation and numbers sit correctly.
- Task titles, comments and custom-field text accept both scripts without corruption.
- Search matches across both digit sets and script variants.

## 6. Persian text normalization & search

Normalize **at write** (store `text_normalized`) and at query time:

| Variant | Normalize to |
|---------|-------------|
| Arabic Yeh `ي` / Alef Maksura `ى` | Persian Yeh `ی` |
| Arabic Kaf `ك` | Persian Kaf `ک` |
| Arabic-Indic digits `٠-٩` | Latin `0-9` (in the search index) |
| Zero-width non-joiner (ZWNJ) | Optional/ignored boundary in the index |
| Diacritics (harakat) | Stripped |
| Whitespace / kashida | Collapsed |

- Postgres full-text uses a custom dictionary (or `pg_trgm` + normalized column) tuned for
  Persian; verified by a search test suite with Persian queries.

## 7. i18n plumbing

- i18next + ICU; all strings externalized; no concatenated sentences (grammar differs).
- `fa-IR` default; `en` fallback. Missing keys fall back gracefully and are logged.
- Plural/ordinal rules via ICU; Persian has distinct plural categories.
- Dates/numbers always via the formatters above; never raw `Date`/`Number` in the view layer.

## 8. Accessibility (RTL-aware)

- Focus order follows DOM order = visual order under RTL (no reordering hacks).
- Arrow-key navigation in menus/board is direction-aware (Left moves "forward" in RTL).
- Screen-reader labels are localized; `aria-*` text in Persian.
- Contrast and target sizes meet WCAG 2.1 AA; RTL mirroring must not break focus rings.

## 9. Forms & inputs

- Phone input defaults to `+98` with Persian-friendly formatting.
- Currency inputs accept Persian digits and separators; validation messages localized.
- Numeric steppers and sliders adjust to RTL where it affects meaning.

## 10. Acceptance criteria

- **AC-R1** Switching a workspace to Persian yields an RTL UI with Jalali dates and Persian
  digits; the default English UI stays LTR with Gregorian dates.
- **AC-R2** Lint fails if a physical `left/right` utility appears in RTL-sensitive components.
- **AC-R3** Searching `کار` matches both `کار` and `كار`; searching `۱۲۰` matches `120`.
- **AC-R4** Toggling between English and Persian flips `dir` without layout breakage in Gantt,
  Board and forms.
- **AC-R5** Dashboard charts and Gantt bars render correctly in both directions.
- **AC-R6** A mixed Persian/English task title displays punctuation correctly (`dir="auto"`).
