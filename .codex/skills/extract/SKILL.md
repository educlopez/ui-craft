---
name: extract
description: "Pull repeated patterns into components and lift magic values into tokens. Invoke when the user asks for extract on their UI, or mentions 'extract' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Extract reusable pieces from the target the user described. Load the `ui-craft` skill.

**Step 1 — Scan the target for extraction candidates:**

- **Repeated Tailwind class combos** — any class string that appears ≥3 times becomes a component (or a `cva`/`tv` variant if the project uses one — check first).
- **Magic values** — hex colors, pixel sizes, shadow definitions, font sizes, z-index values appearing in literal form. Lift into CSS variables or `theme.extend`.
- **Repeated markup** — blocks that differ only by text/props collapse into a single component with props.

**Step 2 — Match the project's conventions, don't impose new ones:**

- **Naming** — look at neighboring components. PascalCase file? kebab-case file? Named export vs default export? Match exactly.
- **Location** — check `components/ui/`, `ui/`, `primitives/`, `src/components/` before creating a new directory. Reuse.
- **Tokens** — respect existing CSS variable naming (`--color-*`, `--space-*`, `--font-*`, `--radius-*`). Don't introduce a parallel system.

**Step 3 — Anti-Slop Test on every new component** (from SKILL.md):

- Component name must be domain-specific, not generic. `MetricCard` / `PricingTier` / `InviteRow` beats `Card` / `Box` / `Item`.
- If the component is generic ("a card with a title and description"), ask yourself whether it should instead be an inline composition — premature abstraction is worse than repetition.

**Step 4 — Update every call-site.** No half-migrations.

**Knob-agnostic** — DRY is not tunable.

**References to read**: `references/layout.md` (composition patterns), `references/typography.md` and `references/color.md` (token naming), plus the project's existing component library (scan before writing).

**Output**:
1. The new component file(s) + any token additions.
2. A table showing every call-site update:

| File | Before | After |
| --- | --- | --- |

3. A one-line delta: "Extracted N components, M tokens. Call-sites updated: X."
