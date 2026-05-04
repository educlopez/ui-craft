---
name: harden
description: "Audit and fill in the UX that works when things go wrong — the stuff AI skips. Invoke when the user asks for harden on their UI, or mentions 'harden' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Harden the UI at the target the user described for production. Load the `ui-craft` skill.

**Coverage matrix — check every key surface:**

1. **Loading** — skeletons match the final layout (no CLS on resolve), shown after ~200ms to avoid flash on fast responses. Never a generic centered spinner when a skeleton is possible.
2. **Empty** — purposeful: one line explaining why it's empty + one clear primary action. Illustration optional, CTA mandatory.
3. **Error** — inline, actionable. "Save failed. Try again / Copy error / Contact support" — never just "Something went wrong." Surface the *what* and the *next step*.
4. **Partial data** — `—` (em dash) for missing metrics, never `N/A` or `null` or `0` when the value is truly unknown.
5. **Long content** — truncation with `title` tooltip, `text-overflow: ellipsis`, container queries for constrained regions. Test with a 120-character name.
6. **i18n** — no hardcoded strings, ~1.3× text expansion slack for German, narrower glyphs for CJK, RTL flip consideration for icons with direction.
7. **Offline / slow** — optimistic UI with reconciliation on failure; skeleton persists past timeout with a "still loading…" affordance.
8. **Permission** — what happens when the user lacks access: disabled vs hidden. Always surface a "why" (tooltip, inline helper) when disabled.
9. **Zero-state → first-run** — inline hints beat 5-step tours. Guide within the surface, not over it.

**Knob-agnostic** — correctness is not tunable. Run the full matrix regardless of CRAFT_LEVEL / MOTION_INTENSITY / VISUAL_DENSITY.

**References to read**: `references/accessibility.md` (keyboard + screen reader paths), `references/copy.md` (error and empty-state voice), `references/motion.md` Rendering Performance section (skeleton motion + reduced-motion).

**Output**: a per-surface checklist marking each of the 9 items as present / missing / partial. Then edit the code to fix what's missing. Print the Review Format table showing fixes. End with a "still at risk" list for anything you couldn't safely auto-fix (requires backend, requires design decision, requires translation files).
