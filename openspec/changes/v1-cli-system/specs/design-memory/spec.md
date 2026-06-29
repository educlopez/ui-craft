# Design Memory Specification

## Purpose

`.ui-craft/` is a typed, committable markdown directory that stores project-level design
context for the ui-craft skill. It replaces the single `brief.md` file with a structured
directory. All files are plain markdown — no database, vector store, or external memory
product is used anywhere.

## Directory Schema

```
.ui-craft/
├── brief.md          ← always-loaded; project identity + design intent
├── tokens.md         ← always-loaded; design token decisions
├── decisions.md      ← lazy-loaded; date-stamped tried/rejected/accepted log (append-only; grows unbounded)
├── patterns.md       ← lazy-loaded; validated compositions and reuse patterns
└── surfaces/
    └── {name}.md     ← lazy-loaded; per-surface design notes
```

> **Load boundary rationale**: `brief.md` and `tokens.md` are small and define project taste/tokens
> needed for every UI task. `decisions.md` and `patterns.md` are append-only logs that grow with the
> project; always loading them would bloat context unnecessarily. They are loaded only when the task
> requires prior rationale or pattern reference.

## Requirements

### Requirement: Scaffold on Install

When design-memory is selected during install, the CLI MUST create the `.ui-craft/` directory
and scaffold all standard files with minimal placeholder content if they do not already exist.
Existing files MUST NOT be overwritten.

#### Scenario: First-time scaffold

- GIVEN `.ui-craft/` does not exist in the project
- WHEN the user selects design-memory during `ui-craft install`
- THEN the CLI creates `.ui-craft/` and writes `brief.md`, `tokens.md`, `decisions.md`, and `patterns.md` each with a minimal header placeholder; no `surfaces/` files are created

#### Scenario: Partial directory exists

- GIVEN `.ui-craft/` exists with only `brief.md`
- WHEN install runs with design-memory selected
- THEN only the missing files (`tokens.md`, `decisions.md`, `patterns.md`) are created; `brief.md` is left untouched

#### Scenario: Full directory already exists

- GIVEN `.ui-craft/` exists with all standard files
- WHEN install runs with design-memory selected
- THEN the CLI outputs "design-memory: already scaffolded" and makes no changes

---

### Requirement: Always-Loaded vs Lazy-Loaded Files

The ui-craft skill MUST apply the following load contract whenever `.ui-craft/` is present:

- **Always-load** `brief.md` and `tokens.md` on every invocation — they are small and define
  project taste/tokens needed for all UI work.
- **Lazy-load** `decisions.md`, `patterns.md`, and `surfaces/<name>.md` — load only when the
  current task requires prior rationale, a known pattern, or work on a named surface.
- Always-loading a growing append-only log (`decisions.md`) or pattern library (`patterns.md`) is
  PROHIBITED; it bloats context with content that may be irrelevant to the task.

#### Scenario: Skill invoked — always-loaded files only

- GIVEN `.ui-craft/brief.md`, `tokens.md`, `decisions.md`, and `patterns.md` all exist
- WHEN the ui-craft skill is invoked for a general UI task with no explicit surface or decision reference
- THEN `brief.md` and `tokens.md` are loaded into context before any other work; `decisions.md` and `patterns.md` are NOT loaded

#### Scenario: Skill invoked — lazy files loaded when relevant

- GIVEN `.ui-craft/decisions.md` and `.ui-craft/patterns.md` exist
- WHEN the user asks the skill to apply a pattern from past decisions or reference prior rationale
- THEN `decisions.md` and/or `patterns.md` are loaded on demand for that task only

#### Scenario: .ui-craft/ absent

- GIVEN no `.ui-craft/` directory exists in the project
- WHEN the ui-craft skill is invoked
- THEN the skill proceeds without error; no design memory files are loaded

---

### Requirement: Lazy-Loaded Surface Files

`surfaces/{name}.md` files MUST be loaded on demand — only when the current task references
the named surface. Loading all surface files eagerly is PROHIBITED (context budget concern).

#### Scenario: Task references a specific surface

- GIVEN `surfaces/dashboard.md` exists
- WHEN the user asks the skill to work on the dashboard surface
- THEN the skill loads `surfaces/dashboard.md` before proceeding

#### Scenario: Task does not reference any surface

- GIVEN multiple surface files exist
- WHEN the user asks a general design question unrelated to a specific surface
- THEN no surface files are loaded

---

### Requirement: File Schemas

Each file MUST follow a defined markdown schema so tooling and humans can parse it consistently.

| File           | Required Sections                                                    |
|----------------|----------------------------------------------------------------------|
| `brief.md`     | `# Project Brief`, `## Design Intent`, `## Audience`               |
| `tokens.md`    | `# Design Tokens`, `## Colors`, `## Typography`, `## Spacing`       |
| `decisions.md` | `# Design Decisions` + entries: `### YYYY-MM-DD — {title}` with `**Status**: accepted\|rejected\|tried` |
| `patterns.md`  | `# Patterns`, named pattern blocks with description + usage          |
| `surfaces/*.md`| `# {Surface Name}`, `## Layout`, `## Components`, `## Notes`       |

#### Scenario: decisions.md entry format

- GIVEN `decisions.md` is updated with a new design decision
- WHEN a new entry is appended
- THEN it follows the pattern `### YYYY-MM-DD — {title}` with a `**Status**:` line of `accepted`, `rejected`, or `tried`

---

### Requirement: Plain Markdown Only (Hard Constraint)

`.ui-craft/` files MUST be plain markdown. The system MUST NOT use, reference, or depend on
any database, vector store, embedding model, or named external memory product to read or write
design memory. Commitment to git MUST be the only persistence mechanism.

#### Scenario: Files are committable

- GIVEN a `.ui-craft/` directory with all scaffold files
- WHEN the user runs `git add .ui-craft/ && git commit`
- THEN all files commit without errors; no binary files or lock files are included
