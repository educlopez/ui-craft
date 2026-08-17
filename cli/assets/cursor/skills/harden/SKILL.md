---
name: harden
description: "Production-readiness pass — audits and implements the full non-happy-path matrix: loading skeletons, empty states, error messages, partial data, i18n, offline, permissions, and first-run guidance. Use when preparing a surface for production or when the user says \"it crashes on empty data\" / \"there's no loading state\" / \"harden this\". Invoke when the user asks for harden on their UI, or mentions 'harden' alongside design / UI / frontend work."
---

<!-- HARNESS MIRROR — do not edit here. Canonical source: skills/ or commands/. After editing source, copy into cli/assets/<harness>/ and repo-root harness mirrors. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Harden the UI at `$ARGUMENTS` for production. Load the `ui-craft` skill.

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

**Then run the archetype's coverage parts.** The nine items above are cross-cutting; they do not know what kind of screen this is. Name the archetype (data table, settings, search, detail view, first-run, billing, pricing, docs page, checkout, onboarding, destructive confirm, invite/share) and pull its parts:

- **MCP connected** → call `ux_coverage` with the archetype. It returns that archetype's parts and the reporting contract.
- **No MCP** → read the matching section of `references/coverage.md`.
- **No archetype matches** → skip this step and say so in one line. Coverage is deliberately partial; an unlisted surface is not a failure.

Each part carries what present looks like, the ui-craft rule for building it, and what the user loses without it. Report the cost, not just the absence — "no export" is a status, "the user expects the 24 rows on screen and receives 10,000" is the reason it matters.

**References to read**: `references/accessibility.md` (keyboard + screen reader paths), `references/copy.md` (error and empty-state voice), `references/motion.md` Rendering Performance section (skeleton motion + reduced-motion).

**Output**: two sections, reported side by side and never combined.

1. **Hardening matrix** — the 9 items above, each marked present / partial / missing.
2. **Coverage** — the archetype's parts, each marked **present / partial / missing / not-needed / unknown**. `not-needed` requires a stated reason; if you cannot say why it does not apply here, it is missing. `unknown` says whether more input would settle it.

**No score, no count, no percentage on either section.** "7 of 9" makes `not-needed` read as a failure and turns a hardening pass into a grade. Coverage never gates: it reports, and the build still ships.

Then edit the code to fix what's missing. Print the Review Format table showing fixes. End with a "still at risk" list for anything you couldn't safely auto-fix (requires backend, requires design decision, requires translation files).

**Next step:** `/finalize` — the pre-ship gate (rung 3).
