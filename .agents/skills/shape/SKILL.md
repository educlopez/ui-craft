---
name: shape
description: "Wireframe-first pass — outputs an ASCII layout + state list + content inventory + question list before any code. Use when starting a new screen from scratch or when the user's brief is still ambiguous. Invoke when the user asks for shape on their UI, or mentions 'shape' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Shape the UI for the target the user described before writing code. Load the `ui-craft` skill.

This command produces a **shape artifact**, not JSX. The point is to force low-fi thinking — content inventory, layout regions, state coverage, open questions — before any component is written. Skipping this step is how generic AI UIs get built: straight to hi-fi, no discovery, every screen looks the same.

**Step 1 — Clarify (3-5 questions).** Ask the user before shaping. Don't guess. Minimum questions:

- What's the **primary user action** on this screen? (One verb, one object.)
- What data is **visible by default** vs **hidden behind a click or tab**?
- What does **success** look like — a state, a redirect, a toast?
- Who's the **primary user** — first-timer, power user, mobile-first?

**Step 2 — Content inventory.** Bullet list of every piece of content that will appear. Annotate each by priority:

- **P0** — must be visible on first paint. Cut it and the screen fails.
- **P1** — one click away (tab, accordion, drawer).
- **P2** — settings-level; rarely accessed.

Example:
```
- P0  Headline (one line, the value prop)
- P0  Primary CTA
- P0  Hero chart / metric
- P1  Secondary nav tabs
- P1  Recent activity list
- P2  Export / integrations menu
```

**Step 3 — ASCII layout.** Low-fi sketch showing regions. No specific copy, no colors, no font sizes. One desktop variant + one mobile variant. Use box characters:

```
Desktop
┌──────────────────────────────────────────────┐
│ [logo]                 [nav]         [user]  │
├──────────────────────────────────────────────┤
│  ┌────────────────┐   ┌───────────────────┐  │
│  │ Headline + sub │   │                   │  │
│  │                │   │   Hero visual     │  │
│  │ [Primary CTA]  │   │                   │  │
│  └────────────────┘   └───────────────────┘  │
│                                              │
│  ── Social proof row ──                      │
│                                              │
│  ┌─── Feature 1 ───┐   ┌─── Feature 2 ───┐   │
│  └─────────────────┘   └─────────────────┘   │
└──────────────────────────────────────────────┘

Mobile
┌──────────────────┐
│ [logo]     [☰]   │
├──────────────────┤
│  Headline + sub  │
│                  │
│  [Primary CTA]   │
│                  │
│  ┌── Hero ──┐    │
│  └──────────┘    │
│                  │
│  Social proof    │
│                  │
│  Feature 1       │
│  Feature 2       │
└──────────────────┘
```

Asymmetry is fine and often better — don't force center-everything.

**Step 4 — State list.** Enumerate the states this screen must handle. Point at [references/state-design.md](../skills/ui-craft/references/state-design.md) for the contracts.

- **idle** — default state, data present.
- **loading** — skeletons that mirror final layout, 200ms delay before showing.
- **empty** — first-run or no data; doubles as onboarding.
- **error** — specific cause + recovery action + support ID.
- **partial** — some data loaded, some failed (e.g., one widget erred).
- **conflict** — user-edit collision (rare but load-bearing on collaborative surfaces).
- **offline** — queue writes, reconcile on reconnect.
- **success** — confirmation state after the primary action completes.

Mark each as **required** / **optional (why)** / **N/A**.

**Step 5 — Open questions.** Do NOT start coding until these are answered. Default set:

- Accent color — brand-defined, or to be chosen? (See Discovery in `SKILL.md`.)
- Typography — existing tokens, or new system? (Reference `typography.md`.)
- Responsive breakpoints — what's the minimum supported width?
- Stack — CSS only, or Motion / GSAP / Three.js? (Only load `stack.md` if the user opts in.)
- Data source — real API ready, or mock for shape?
- Keyboard / a11y requirements — anything beyond the baseline from `accessibility.md`?

**Knob awareness.**

- At `CRAFT_LEVEL ≥ 7`, add two more sections:
  - **Motion shape** — which elements enter, in what order, with what stagger. Pick from the duration scale in `references/motion.md`.
  - **Typography hierarchy plan** — display / headline / body / label sizes and weights, before code.
- At `CRAFT_LEVEL ≤ 4`, strip Step 4 to `idle / loading / error` only. Skip the motion shape.

**Output contract.**

- Produce a single Markdown block with all five steps, in order. Nothing else.
- Do **NOT** write JSX, CSS, or component code in this command.
- End the output with: _"Ready to build? Review the shape, confirm the open questions, then run `/ui-craft:audit` (or use Build mode) once the code exists."_
