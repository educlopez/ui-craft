# Composition Spec

Defines `.ui-craft/spec.md` — the durable "what" between brief (why) and build (how). Created by `/shape` Step 6, consumed by `/sddesign` and `/craft`. Sits beside `brief.md` in `.ui-craft/` and is committed to the repo.

---

## The Spec Format

One file. Per-surface `## Surface: <name>` sections. Append-mostly — new surfaces add a new section; existing sections are only edited when a composition decision changes. No JSX, no component code — this is a design document, not implementation.

Multiple surfaces coexist in a single file, just as a brief covers one project with multiple concerns in one place.

---

## Per-Surface Template

Copy this block for each new surface. Fill every subsection — leave none empty or the acceptance bar is undefined.

```markdown
## Surface: <name>

### Composition

**Recipe:** `recipe-<type>.md` → <Variant name>
**Why:** <one line citing the brief principle or constraint that drove this choice>

### Layout skeleton

Desktop
┌──────────────────────────────────────────────┐
│ [region]               [region]     [region] │
├──────────────────────────────────────────────┤
│  ┌────────────────┐   ┌───────────────────┐  │
│  │ <content area> │   │ <content area>    │  │
│  └────────────────┘   └───────────────────┘  │
└──────────────────────────────────────────────┘

Mobile
┌──────────────────┐
│ [region]   [☰]   │
├──────────────────┤
│  <content area>  │
└──────────────────┘

### Component inventory

| Region | Component | Contract ref |
|--------|-----------|--------------|
| header | Nav bar | components.md → Nav bar |
| hero | Headline + CTA | components.md → Buttons |
| … | … | … |

### State lattice

| State | Required / Optional / N-A | Notes |
|-------|--------------------------|-------|
| idle | Required | default, data present |
| loading | Required | skeletons mirror final layout |
| empty | Required | first-run or no data |
| error | Required | cause + recovery action |
| partial | Optional — only if widgets can fail independently | |
| conflict | N-A | no collaborative editing on this surface |
| offline | Optional — only if writes are queued | |
| success | Required | confirmation after primary action |

See [state-design.md](state-design.md) for state contracts and CRAFT_LEVEL thresholds.

### Acceptance bar

Drawn from the recipe's acceptance criteria. All items must be green before build reports done.

- [ ] <recipe checklist item 1>
- [ ] <recipe checklist item 2>
- [ ] <recipe checklist item 3>
```

---

## How the Spec Gets Used

**Discovery phase** — read `.ui-craft/spec.md` after `brief.md`. If the surface already has a spec section, it is the composition ground truth; do not re-derive from scratch.

**Build phase** — `/craft <surface>` builds against the acceptance bar in the surface's spec section. Every item in the acceptance bar must be green before the build reports done.

**Finalize phase** — `/finalize` verifies against the acceptance bar and the brief's learned constraints (§6). The acceptance bar is the surface-level definition of done; the brief's §6 constraints are the project-level floor.

---

## When to Update

Update a spec section when any of these change:

- **Composition changes** — different recipe variant selected.
- **New surface** — append a new `## Surface: <name>` section. Never overwrite an existing section.
- **Recipe swap** — the recipe file changed and the acceptance bar items shift.
- **Learned constraint overrides a composition choice** — note it in the Composition subsection, citing the brief §6 entry.

Append-mostly. When deprecating a composition choice within a surface, mark the old entry as:

```markdown
~~**Recipe:** [recipe-landing.md](recipe-landing.md) → Product-forward~~ — deprecated 2026-06-24, swapped to Message-forward per brief §6 constraint (no hero visuals).
```

Never delete past composition records — the spec is a log, not a config file.

---

## File Location and Git

Commit `.ui-craft/spec.md` to the repo. It belongs in version control alongside the code it governs — losing it between sessions means losing the composition rationale.

The `.ui-craft/` directory is the project's design decision store:

```
.ui-craft/
├── brief.md      # why — principles, user, success metric
├── spec.md       # what — chosen composition, layout, inventory, acceptance bar
└── (tokens live in the project's own token files)
```

`brief.md` and `spec.md` are companions: the brief anchors principles; the spec records how those principles translated into a specific surface composition. When they conflict, the brief wins — a spec choice that violates a brief §6 constraint must be updated to comply.

See `../SKILL.md` for routing and when to run `/sddesign` vs `/craft`.
