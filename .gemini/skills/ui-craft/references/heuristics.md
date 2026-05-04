# Heuristics — Scored Critique Methodology

Any skill can list anti-patterns. A scored critique is a defensible artifact a PM can action. Every finding gets a heuristic, a score (1-5), and an impact estimate. This file is the source of truth for the `/ui-craft:heuristic` command — the rubric, the laws, the output shape.

---

## How to Use

Run the full pass: Nielsen's 10 (score 1-5 each) → 6 Design Laws (PASS/FAIL each) → rank findings by impact tag. Output is a machine-parseable scorecard PMs can paste into any issue tracker.

Usability is not a knob. `CRAFT_LEVEL` does not relax these scores — a 2 is a 2 at every craft level.

---

## Scoring Rubric (applies to every heuristic)

| Score | Meaning |
|-------|---------|
| **1** | Blocks users. Core task cannot complete. |
| **2** | Severe friction. Users abandon or error repeatedly. |
| **3** | Works but confusing. Users complete with hesitation. |
| **4** | Works, minor polish left. No user impact. |
| **5** | Best-in-class. Nothing to add. |

Every finding is recorded in a row: `| Heuristic | Score | Finding | Impact |`.

---

## Nielsen's 10 Usability Heuristics

Source: Nielsen, J. (1994). "10 Usability Heuristics for User Interface Design." Nielsen Norman Group.

### 1. Visibility of System Status

The system should always keep users informed about what is going on, through appropriate feedback within reasonable time.

**What to look for:**
- [ ] Every async action has a loading state (spinner, progress, skeleton)
- [ ] Submit buttons disable + show progress while in flight
- [ ] Optimistic UI reconciles on server response (no silent failure)
- [ ] Navigation state is visible (active tab, breadcrumb, selected row)
- [ ] Long operations (>5s) escalate to progress percentage or estimate

**Common failures in AI-generated UIs:**
- Form submit has no loading state — user clicks 3-4x thinking nothing happened
- Toast appears then disappears before the user can read it
- No indication that a save succeeded ("did it work?")

### 2. Match Between System and the Real World

Speak the user's language — words, phrases, concepts they know. Follow real-world conventions.

**What to look for:**
- [ ] No system jargon in user-facing copy ("exception thrown", "null ref")
- [ ] Icons match cultural convention (trash = delete, not a cog)
- [ ] Dates are formatted for the user's locale, not ISO
- [ ] Error messages speak human, not stack trace
- [ ] Metaphors are consistent (folder, file, workspace)

**Common failures in AI-generated UIs:**
- "Submit payload" instead of "Save changes"
- "Entity not found" instead of "We couldn't find that project"
- Time displayed as `1713369600` (Unix) instead of `2 hours ago`

### 3. User Control and Freedom

Users often perform actions by mistake. They need a clearly marked emergency exit.

**What to look for:**
- [ ] Every destructive action has Undo (preferred) or a confirm dialog
- [ ] Modals close on Esc and on backdrop click
- [ ] Multi-step flows have Back without losing state
- [ ] Autosave preserves in-progress work on nav away
- [ ] URL reflects state so the back button works

**Common failures in AI-generated UIs:**
- Delete is instant and irreversible — no undo toast
- Modal traps the user; no way out without completing the form
- Browser back loses all form input

### 4. Consistency and Standards

Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform conventions.

**What to look for:**
- [ ] Primary action placement consistent across views (right side, solid fill)
- [ ] Same verb for same operation throughout ("Delete" always, not "Delete"/"Remove"/"Trash")
- [ ] Icon meanings stable across screens
- [ ] Form patterns match platform (e.g., Cmd+Enter submits on macOS)

**Common failures in AI-generated UIs:**
- Buttons swap position between modals (Cancel left here, right there)
- Three different words for "delete" in the same product
- Non-standard scroll hijacking on a standard content page

### 5. Error Prevention

Better than good error messages is a design that prevents the problem from occurring in the first place.

**What to look for:**
- [ ] Destructive actions require confirmation typed with the resource name
- [ ] Disabled states prevent invalid submissions (with explanation on hover)
- [ ] Input constraints enforced client-side (date pickers, typed inputs)
- [ ] Autosave + version history on content-creation surfaces
- [ ] Warn before leaving unsaved changes

**Common failures in AI-generated UIs:**
- Freeform "Are you sure?" confirms that users mindlessly click
- No validation until submit; user fills 12 fields then sees 4 errors
- Paste blocked on fields (password confirm, order IDs)

### 6. Recognition Rather Than Recall

Minimize the user's memory load by making objects, actions, and options visible.

**What to look for:**
- [ ] Recently used / favorited items surfaced
- [ ] Autocomplete on any field with a known set of answers
- [ ] Keyboard shortcuts listed in tooltips (not hidden in a help menu)
- [ ] Current selection persists visibly
- [ ] Empty states suggest next actions

**Common failures in AI-generated UIs:**
- Power-user shortcuts (Cmd+K) exist but are undiscoverable
- User must remember which tab they were on after a refresh
- Dropdown with 200 options and no search

### 7. Flexibility and Efficiency of Use

Accelerators — unseen by novice — may speed up the interaction for the expert.

**What to look for:**
- [ ] Keyboard shortcuts for frequent actions (Cmd+K, j/k nav)
- [ ] Bulk actions on lists (multi-select + batch operate)
- [ ] Saved views / filters / segments
- [ ] Customization for heavy users (column config, hotkeys)
- [ ] Paste-to-action patterns (URL paste auto-parses)

**Common failures in AI-generated UIs:**
- Forces the same flow for novice and expert
- No way to multi-select in lists of 100+
- Command palette missing on tools users will spend hours in

### 8. Aesthetic and Minimalist Design

Dialogues should not contain information that is irrelevant or rarely needed.

**What to look for:**
- [ ] Every section answers one question; no filler
- [ ] Visual weight proportional to importance
- [ ] One accent, 3-5 placements per viewport (see SKILL.md anti-slop)
- [ ] White space is used, not avoided
- [ ] No decorative graphics competing with content

**Common failures in AI-generated UIs:**
- Hero has 4 CTAs of equal weight
- Every card has a colored top border
- Gradient backgrounds on every section

### 9. Help Users Recognize, Diagnose, and Recover From Errors

Error messages in plain language, precisely indicate the problem, and constructively suggest a solution.

**What to look for:**
- [ ] Errors appear inline, at the field, not as a global banner
- [ ] Messages specify what went wrong AND how to fix it
- [ ] Server errors include a copy-to-clipboard ID for support
- [ ] Recovery is one click (retry, undo, contact support)
- [ ] Network errors differ from validation errors

**Common failures in AI-generated UIs:**
- "Something went wrong" with no detail, no retry, no support path
- Red toast that disappears before the user reads it
- Error blames the user ("Invalid input") instead of explaining

### 10. Help and Documentation

Even though it is better if the system can be used without documentation, help may be necessary.

**What to look for:**
- [ ] Help is contextual, not a separate site the user must leave to
- [ ] Empty states double as onboarding ("Create your first project")
- [ ] Tooltips on non-obvious icons
- [ ] Inline help links in complex forms
- [ ] Searchable docs for deep features

**Common failures in AI-generated UIs:**
- No tooltips on icon-only buttons
- Help buried behind a "?" in the corner with a 404 behind it
- Onboarding is a 10-slide lightbox the user skips

---

## The 6 Design Laws

Each is scored PASS / FAIL with a specific detail. These are physics + psychology, not preferences — failing them has measurable UX impact.

### Fitts's Law

Source: Fitts, P. M. (1954). "The information capacity of the human motor system in controlling the amplitude of movement."

**Statement:** Time to acquire a target is a function of its size and distance.

**When load-bearing:** Every tappable / clickable surface. Critical on mobile.

**How to score:**
- **PASS** — touch targets ≥ 44px on mobile, ≥ 24px on desktop; primary CTA in the natural eye/thumb path; related actions grouped
- **FAIL** — touch targets under 44px mobile; destructive actions adjacent to primary actions; CTA placed far from where the user just looked

### Hick's Law

Source: Hick, W. E. (1952). "On the rate of gain of information."

**Statement:** Decision time grows logarithmically with the number of choices.

**When load-bearing:** Menus, navigation, plan selectors, form fields, dashboards.

**How to score:**
- **PASS** — nav ≤ 7 items at any level; no field offers 20+ unfiltered options without search
- **FAIL** — 12+ top-nav items; a single select with 200 entries and no type-ahead; dashboard with 18 metrics at equal weight

### Doherty Threshold

Source: Doherty, W. J. & Thadani, A. J. (1982). "The Economic Value of Rapid Response Time." IBM.

**Statement:** Productivity soars when response time is under 400ms.

**When load-bearing:** Every user-initiated action. Critical on data-heavy views and transitions.

**How to score:**
- **PASS** — perceived response < 400ms; optimistic UI for saves, likes, toggles; skeletons within 200ms
- **FAIL** — form submit shows a spinner for 2s with no optimistic state; nav click waits on full server round-trip before painting anything

### Cleveland-McGill Hierarchy

Source: Cleveland, W. S. & McGill, R. (1984). "Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods." JASA.

**Statement:** Humans decode visual encodings with different accuracy — position > length > angle > area > color-hue.

**When load-bearing:** Every chart, metric card, comparative dataviz.

**How to score:**
- **PASS** — quantitative comparisons use position or length (bar, line, dot); color reserved for category; no pie or 3D
- **FAIL** — pie chart used for comparison; donut with ≥ 5 slices; color-gradient used to encode magnitude where length would work

### Miller's Law

Source: Miller, G. A. (1956). "The Magical Number Seven, Plus or Minus Two."

**Statement:** Humans hold ~7 (±2) items in working memory. Chunking extends this.

**When load-bearing:** Nav depth, form section counts, onboarding flows, step counts.

**How to score:**
- **PASS** — navigation ≤ 7 items per level; forms chunked into ≤ 5 sections; multi-step flows ≤ 5 steps or with clear progress
- **FAIL** — 14-item top nav; a single-page form with 23 ungrouped fields; a checkout with 9 steps and no progress indicator

### Tesler's Law

Also called the Law of Conservation of Complexity. Attributed to Larry Tesler.

**Statement:** Every application has an irreducible amount of complexity. The only question is who deals with it — the user, the UI, or the backend.

**When load-bearing:** Feature-rich tools. Configuration-heavy flows. Anywhere you're tempted to "expose a toggle."

**How to score:**
- **PASS** — complexity absorbed by sensible defaults, automation, or backend inference; advanced controls behind progressive disclosure
- **FAIL** — UI exposes every backend knob; user must configure 8 things before they can accomplish the primary task; no default state, only empty forms

---

## Impact Tags

Every finding carries exactly one impact tag. This is how a PM prioritizes:

| Tag | Meaning | Example |
|-----|---------|---------|
| `blocks-conversion` | User cannot complete the core journey | Signup form submit silently fails on network error |
| `adds-friction` | User completes but abandonment rate rises | Submit button has no loading state; users click 3-4x |
| `reduces-trust` | Quality signal — affects retention | Typos in error messages; inconsistent button styles |
| `minor-polish` | Craft layer only; no measurable user impact | Missing `tabular-nums` on a metric |

Rank findings in the final output by impact tag, not by heuristic order: `blocks-conversion > adds-friction > reduces-trust > minor-polish`.

---

## Scoring Output Format

The `/ui-craft:heuristic` command outputs **exactly** this structure. Do not invent new sections. Do not merge tables. Do not drop the ranking at the end.

```markdown
## Heuristic Scorecard

| Heuristic | Score | Finding | Impact |
|-----------|-------|---------|--------|
| Visibility of system status | 2 | Form submit has no loading state; users click 3-4x thinking nothing happened | adds-friction |
| Match system and real world | 4 | Dates formatted for locale; one copy says "entity" instead of "project" | minor-polish |
| User control and freedom | 3 | Delete has confirm but no undo after it lands | reduces-trust |
| Consistency and standards | 4 | Primary CTA consistent; one modal has Cancel on right, rest on left | minor-polish |
| Error prevention | 4 | Delete confirms with the resource name — good | minor-polish |
| Recognition over recall | 3 | Cmd+K exists but not surfaced in tooltips | adds-friction |
| Flexibility and efficiency | 2 | No bulk-select on list of 200+ items | adds-friction |
| Aesthetic and minimalist | 3 | Hero has two competing accents | reduces-trust |
| Error recovery | 1 | "Something went wrong" with no ID, no retry | blocks-conversion |
| Help and documentation | 3 | Tooltips on most icons; empty state has no CTA | reduces-trust |

## Design Law Audit

| Law | Pass/Fail | Detail |
|-----|-----------|--------|
| Fitts's Law | FAIL | Primary CTA is 32px tall on mobile; expected ≥ 44px |
| Hick's Law | PASS | 5 top-nav items — within 7±2 |
| Doherty Threshold | FAIL | Save shows spinner for ~1.8s with no optimistic state |
| Cleveland-McGill | PASS | Bar charts for comparison, color for category only |
| Miller's Law | PASS | Form chunked into 4 logical sections |
| Tesler's Law | FAIL | New user sees 8 required config fields before first action |

## Top findings (ranked by impact)

1. Error recovery (score 1, blocks-conversion) — "Something went wrong" message strands users; no ID, no retry, no support path
2. Fitts's Law (FAIL, adds-friction) — primary CTA 32px on mobile; raise to ≥ 44px
3. Doherty Threshold (FAIL, adds-friction) — save feels broken; add optimistic UI
4. Flexibility (score 2, adds-friction) — bulk select missing on 200+ item list
5. Visibility (score 2, adds-friction) — submit has no loading state
```

**Notes on output:**
- The first row of each heuristic table is the short-name version (not the verbose Nielsen title). The heuristic is unambiguous from context.
- The `Top findings` list is a rank, not a re-listing. Include only findings at `reduces-trust` or worse. Cap at 5.
- Scores of 4-5 don't need a finding row unless the grader wants to surface what's working. Blank findings for 4-5 rows are fine; the Score column carries the signal.
