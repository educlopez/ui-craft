---
name: animate
description: "Add or fix motion. Honors MOTION_INTENSITY and loads the stack reference if opted in. Invoke when the user asks for animate on their UI, or mentions 'animate' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Add or fix animations in the target the user described. Load the `ui-craft` skill.

**Step 1 — Decision Ladder**: run the Decision Ladder from `references/animation.md` first. Anything that fails it gets removed, not improved.

**Step 2 — Pick the library**:

- If user opted into a stack during Discovery → read `references/stack.md`. Use the matching section (Motion, GSAP, or Three.js). Never mix libraries on the same property.
- Otherwise → CSS transitions / `@keyframes` / `animation-timeline: view()` only.

**Step 3 — Apply motion budget**:

| Element | Budget |
|---|---|
| Color/opacity | 100-150ms |
| Small UI (tooltips, dropdowns) | 150-200ms |
| Medium UI (modals, panels) | 200-300ms |
| Large UI (page transitions, drawers) | 300-400ms |

Exit ≈ 75% of entrance duration (shorter, same `ease-out` — or a flatter tail like `cubic-bezier(0.4, 0, 1, 1)` for a softer exit). Never `ease-in` on UI (see `references/animation.md`). `cubic-bezier(0.22, 1, 0.36, 1)` is a safe spring-like default.

**Step 4 — Multi-stage sequences** → read `references/animation-orchestration.md`. Stagger 30-80ms, not 200ms.

**Step 5 — Respect the knobs**:
- `MOTION_INTENSITY ≤ 3` → hover states only, no entrances, no scroll-triggered.
- `MOTION_INTENSITY 4-7` → standard entrances + hover, one scroll reveal max per section.
- `MOTION_INTENSITY 8+` → scroll-linked, page transitions, magnetic cursor OK (still honor reduced-motion).

**Output**: edit code directly. After each file, print the Review Format table. Flag any animation you removed and why.
