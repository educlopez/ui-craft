---
name: audit
description: "Technical UI audit — a11y, performance, responsive. Produces a prioritized findings table. Invoke when the user asks for audit on their UI, or mentions 'audit' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Run a technical audit of the UI at the target the user described. Load the `ui-craft` skill and apply the audit lens.

**Note:** audit is knob-agnostic — accessibility and performance are not tunable.

**Scope (non-negotiable checks):**

1. **Accessibility** — read `references/accessibility.md`:
   - Visible `:focus-visible` on every interactive element
   - Keyboard reachable, no focus traps
   - Touch targets ≥ 44px (mobile)
   - Color not the only signal for state
   - Form labels, error association, required indication
   - `prefers-reduced-motion` honored for all animations
2. **Performance** — read `references/performance.md`:
   - Only `transform` / `opacity` animated (no `width`/`top`/`height`)
   - No `transition: all`
   - `will-change` scoped to active interaction, removed after
   - Images have `width`/`height` or `aspect-ratio` (CLS)
   - No layout thrash in scroll/resize handlers
3. **Responsive** — read `references/responsive.md`:
   - Mobile-first breakpoints, no fixed-width components
   - `env(safe-area-inset-*)` respected on fixed elements
   - Touch zones don't overlap
   - No horizontal scroll at 320px

**Output format** — the Review Format table from SKILL.md:

| Before | After | Why |
| --- | --- | --- |

Group findings by priority: **Critical** (blocks usability/a11y) → **High-impact** (immediately noticeable) → **Quick wins** (polish).

Do NOT rewrite code unless asked. Report findings first; wait for approval before editing.
