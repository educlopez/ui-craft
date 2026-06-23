# Project & User Memory — Self-Correction

A portable, file-based memory system so the skill remembers conventions and corrections — at two reaches — without ever weakening its quality floor. Modeled on how persistent agent memory works (engram / MemGPT-style tiers / mem0), but implemented as plain files so it works identically across every harness with no database, MCP, or network.

## Two stores, two reaches

| Store | Location | Holds | Travels |
| --- | --- | --- | --- |
| **Project** | `.ui-craft/memory/` (in the repo, beside `.ui-craft/brief.md`) | Conventions and corrections specific to *this* codebase | Commit it → the team shares it |
| **User/global** | `~/.ui-craft/memory/` (user home) | Things the user wants applied across *all* their projects | Follows the user, every repo |

The user told you something they want to replicate everywhere → it belongs in the **global** store. Something true only of this codebase → **project** store. When unsure, see *Choosing the reach* below.

## The precedence ladder

Every decision resolves top-down. A higher tier always wins.

```
1. HARD FLOOR — never overridden by any memory
   a11y (keyboard, focus-visible, APCA contrast, reduced-motion),
   correctness, the Critical anti-slop tells.
2. PROJECT MEMORY  (.ui-craft/memory/)        ← most specific
3. USER/GLOBAL MEMORY  (~/.ui-craft/memory/)  ← the user's cross-project rules
4. SKILL DEFAULTS  (references/* + Knobs)
```

**Specific beats general:** a project memory overrides a global one (a per-repo correction wins over the user's usual taste). Both override skill defaults. Nothing overrides the floor — if a correction would breach it (e.g. "remove focus rings"), apply the closest compliant interpretation and say so in one line. Never silently obey, never silently refuse.

## Store layout — tiered, like real memory systems

Each store is a directory, not one flat file. This gives two tiers — a cheap always-loaded index (core memory) and on-demand full records (archival memory):

```
.ui-craft/memory/            (or ~/.ui-craft/memory/)
  INDEX.md                   ← TIER 1 (core): one line per memory, ALWAYS loaded at Discovery
  profile.md                 ← TIER 1 (core): stack/tokens/style — always loaded (project store only)
  2026-06-23-no-gradient-hero.md   ← TIER 2 (archival): one file = one atomic memory, read on demand
  2026-06-20-press-scale.md
  ...
```

**INDEX.md** — the recall layer. One line per memory: its id, a one-line hook, and tags. Loaded every session so the skill *knows what it knows* cheaply; it reads the full memory file only when a hook matches the current task. This is the portable stand-in for semantic search — at project scale, hooks + the model's judgment match as well as a vector store, with zero infra.

```markdown
# ui-craft memory index
- no-gradient-hero → 2026-06-23-no-gradient-hero.md — never gradients on hero here · #color #hero #brand
- press-scale → 2026-06-20-press-scale.md — cap button press at scale(0.97) · #motion #button
```

**profile.md** — autodetected project shape (stack, tokens, brand hue, font, style). Always loaded; refreshed when the stack changes. (Project store only — the global store has no single project to profile.)

**Atomic memory file** — one record, with frontmatter:

```markdown
---
id: no-gradient-hero
type: correction        # profile | convention | preference | correction
scope: surface:hero     # all (default) | surface:<name> | stack:<name>
status: active          # active | superseded
date: 2026-06-23
supersedes: []          # ids this replaces
tags: [color, hero, brand]
---
Rejected a gradient hero background.
**Why:** brand reads enterprise/restrained — flashy undercuts trust.
**Apply:** never propose gradient backgrounds on hero/landing surfaces in this project.
```

**Field meaning:** `type` (profile = project shape, convention = established pattern, preference = taste, correction = a fix the user made). `scope` narrows *within* a store; the folder decides reach. `status` + `supersedes` handle conflicts. `tags` feed the index hooks.

The **Why** is mandatory — it's what lets a memory generalize instead of pattern-matching one literal case. The **Apply** line is the operative rule the next build follows without the original context.

## Read — at Discovery

In Discovery Step 1, after the brief, load memory **both** stores (global first, then project so project can override):

1. Read `~/.ui-craft/memory/INDEX.md` if present, then `.ui-craft/memory/INDEX.md` + `profile.md`.
2. Apply `profile` as known facts — skip questions it already answers.
3. For the current task, pull the full memory files whose index hooks/tags match the surface or decision at hand. Treat each active entry as a binding constraint at its tier.
4. On any conflict, resolve by the ladder (project > global > defaults; floor over all).
5. Absent stores → behave exactly as today. Memory is additive, never required.

## Write — when corrected

Append a memory when the user signals a correction or a durable preference. Triggers (any language):
- Rejects/dislikes output: "no así", "no me gusta", "that's not what I want", "undo that".
- States a standing rule: "siempre haz X", "always use Y", "never Z".
- Reverses a non-default choice and the reversal reads as a preference, not a one-off.

Do **not** write for a one-off tweak with no generalizable reason, exploratory back-and-forth that doesn't land, or anything an existing memory already covers (update that one instead).

### Choosing the reach (project vs global)

- **Global signals** → write to `~/.ui-craft/memory/`: "in all my projects", "en todos mis proyectos", "siempre que trabajes conmigo", "as a rule for me", "I always like…". The preference is about *the user's taste*, not this brand.
- **Project signals** → write to `.ui-craft/memory/`: "here", "this project", "en este proyecto", or anything tied to *this* brand/stack. **Default to project** when there's no cross-project signal.
- **Ambiguous and clearly about personal taste** → ask once, one line: "¿solo en este proyecto o en todos los tuyos?" Then write to the chosen store.

### How to write

1. Create the dated atomic file with frontmatter; capture the **Why**, not just the what.
2. Add a one-line entry to that store's `INDEX.md` (id, hook, tags).
3. Phrase **Apply** as a rule actionable without the original context.
4. Confirm in one line where it landed: "Anotado en memoria de proyecto: nunca gradientes en hero aquí." Silent memory is spooky — keep the user in the loop.

## Promotion & the upstream funnel

A correction can travel up three different paths — pick by *how widely it's true*:

| The correction is true for… | Destination |
| --- | --- |
| Only this codebase | **Project** store |
| All of the user's work | **User/global** store (promote with "do this everywhere": copy the file to `~/.ui-craft/memory/`, mark the project copy `superseded by global`) |
| Most projects, for everyone | **Upstream**: it's not memory, it's a baseline gap — suggest a PR against the skill's `references/*` |

Test: *would this be right on most projects, for most people?* Yes → upstream candidate. Right for this one user everywhere → global. Right only here → project. Local memory is the discovery pipeline for improving the skill itself.

## Hygiene

Memory rots like any notes store. Keep both healthy (run `/ui-craft:memory-lint`):
- One memory per file; date every file (ISO); newest hooks at the top of INDEX.
- A new memory that contradicts an old one marks the old `status: superseded` and lists it in `supersedes` — don't leave two live entries that conflict.
- Superseded files stay (so the history of *why* survives) but are never applied; the lint can archive them.
- If two active memories conflict and neither is superseded, ask the user which holds, then mark the loser.
- Cap each store. If a store's active `Learned` set grows past ~20, the most stable entries are real conventions — fold them into `profile.md` (project) or propose promoting them.

## Optional engram bridge

The file store is canonical and works with zero dependencies. **If** the user's harness exposes an engram (or compatible) memory MCP, the skill may *additionally* mirror writes there (`mem_save` with a `ui-craft/<project>` topic key) and consult it at Discovery — gaining cross-session semantic recall on top. The bridge is strictly additive: never required, and the files remain the source of truth so the skill behaves identically for users without it.
