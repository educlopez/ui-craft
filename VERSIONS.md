# Versions

## v0.7.0 (2026-04-18) — style variants + eval infra

- **Three new sibling skills** under `skills/`: `ui-craft-minimal` (Linear/Notion aesthetic), `ui-craft-editorial` (Medium/Substack), `ui-craft-dense-dashboard` (Bloomberg/Retool). Each locks the knobs (`CRAFT_LEVEL` / `MOTION_INTENSITY` / `VISUAL_DENSITY`) and adds style-specific overrides. Variants defer to the main `ui-craft` skill for base rules and references — minimal duplication.
- **`plugin.json`** now registers all 4 skills (main + 3 variants).
- **`scripts/sync-harnesses.mjs`** rewritten to iterate every folder under `skills/`, so adding new variants requires no script changes. Sync now produces 55 dirs per harness (4 skills × harnesses + 7 commands-as-sub-skills × harnesses).
- **`evals/` folder added** with query sets for `skill-creator`'s description optimizer. Shipping `evals/ui-craft.json` (20 realistic should-trigger / should-not-trigger queries) and `evals/README.md` documenting how to run `run_loop.py` and write eval sets for the variants.
- **`references/stack.md` small additions**: Motion v12 animates `oklch()` / `oklab()` / `color-mix()` directly (dynamic theming), GSAP `IntersectionObserver` pattern to pause off-screen timelines, R3F `<Html>` overlay with `distanceFactor` + `occlude`, R3F axis-specific prop notation (`position-x={x}`).
- Marketplace CalVer bumped to `2026.4.18.2100`; package.json to `0.7.0`.

## v0.6.0 (2026-04-18) — multi-harness support

Following `pbakaus/impeccable`'s pattern (5 agent harnesses, each with the skill + commands-as-sub-skills).

- **`scripts/sync-harnesses.mjs`** generates mirrors for 5 harnesses: `.codex/`, `.cursor/`, `.gemini/`, `.opencode/`, `.agents/`. The main `ui-craft` skill is copied verbatim; each of the 7 commands is materialized as a peer sub-skill with `name` + `description` frontmatter (since only Claude Code supports slash commands — other agents only understand skills).
- **`package.json`** added (thin, private) with `npm run sync` alias.
- **`.github/workflows/sync-harnesses.yml`** re-runs the sync on push to `main` when source changes and commits any drift, so mirrors stay fresh automatically.
- Generated dirs are committed (not gitignored) so users installing via `npx skills add educlopez/ui-craft` get the right mirror for their agent immediately.
- `README.md` documents the install matrix and the sync workflow.
- Source of truth stays `skills/ui-craft/` + `commands/` — never edit files under the harness dirs directly.

## v0.5.1 (2026-04-18) — robustness audit

Audited against two specialized reviewers (`plugin-dev:skill-reviewer`, `plugin-dev:plugin-validator`) and the `skill-creator` methodology. Fixed contradictions introduced by the v0.5.0 refactor and completed knob plumbing.

**Critical fixes:**
- `commands/animate.md` no longer recommends `ease-in` for exits (contradicted `animation.md`). Exit now `ease-out` at ~75% duration, or `cubic-bezier(0.4, 0, 1, 1)` for a softer tail.
- `SKILL.md` Routing + Reference Files rows for `stack.md` now say **"OPT-IN ONLY"** explicitly — prevents agents loading 442 lines for unrelated motion tasks.
- `SKILL.md` "never center hero" softened to allow centered heroes with asymmetric supporting elements (reconciles with `inspiration.md`'s documentation of dub/linear/vercel/stripe/cursor).
- `SKILL.md` "NEVER default blue" → "never *default* to blue" (brand blues are fine).
- `references/review.md` no longer references fake commands `/ui-craft review` / `/ui-craft audit` — updated to real `/ui-craft:critique|audit|polish`.

**Dedup — one canonical home per rule:**
- Anti-Slop list → SKILL.md only (review.md links).
- Animation Decision Ladder → `animation.md` only (SKILL.md + `animate.md` link).
- Polish Pass compound details → `review.md` only (`commands/polish.md` is a thin pointer).
- Interaction Rules (touch/focus/keyboard/overscroll) → `accessibility.md` only.
- `@starting-style` → `modern-css.md` only.
- Hardware-acceleration / shorthand-prop gotcha → `performance.md` only.
- Spring section opens with "pick spring OR tween globally" note.

**Knob plumbing completed:**
- `/polish` → `CRAFT_LEVEL` gating (skip ≤4, full pass 5-7, + signature 8+).
- `/animate` → `MOTION_INTENSITY` tiers (≤3 / 4-7 / 8+).
- `/critique` → `CRAFT_LEVEL` sets severity threshold (3 = critical only / 9+ = flag minor polish).
- `/adapt` → `VISUAL_DENSITY` drives column count + spacing per breakpoint.
- `/distill` → `CRAFT_LEVEL` drives cut aggression + signature preservation.
- `/audit` and `/typeset` → explicitly knob-agnostic.

**Housekeeping:** `.gitignore` now covers `**/.DS_Store`.

## v0.5.0 (2026-04-18)

- **SKILL.md slimmed** from 35KB → 13.6KB by applying progressive disclosure. Always-needed rules stay in SKILL.md; depth moves to matching references.
- **Knobs** added at top of SKILL.md: `CRAFT_LEVEL`, `MOTION_INTENSITY`, `VISUAL_DENSITY` (1-10). Change behavior, not just tone.
- **Seven slash commands** under `commands/`: `audit`, `critique`, `polish`, `animate`, `distill`, `adapt`, `typeset`. Each applies a single lens from the skill.
- **New `references/stack.md`** (opt-in during Discovery): Motion, GSAP, Three.js + R3F. Decision tree, install, top patterns, clashes with ui-craft rules, perf gotchas, anti-patterns.
- **`stack.md` enriched** after gap analysis against the top-installed stack skills in the agent-skills ecosystem (GreenSock's official `gsap-performance`, `hyperframes@gsap`, `framer-motion-animator`, `awesome-copilot@gsap-framer-scroll-animation`, Vercel Labs' `react-three-fiber`, and `claudedesignskills@react-three-fiber`). Added: Motion `useSpring` scroll smoothing + viewport trigger + App Router `'use client'` caveat, GSAP `quickTo` + `autoAlpha` + `immediateRender` trap + `ScrollTrigger.refresh` discipline, R3F Suspense/progressive loading + `<Bounds>`/`<Center>` auto-fit + DRACO/KTX2 compression + `invalidate()` for demand rendering. New cross-stack rules: `will-change` lifecycle, no smooth-scroll libraries, strip-debug checklist.
- **Discovery phase** gains a 4th question — optional animation stack — that gates `stack.md` load.
- Reference files enriched with content moved from SKILL.md: `review.md` (Polish Pass, Common Issues, Component Craft), `accessibility.md` (Quick Checklist, Forms), `animation.md` (Interaction Rules, Decision Rules), `performance.md` (Core Rules), `typography.md` / `layout.md` / `copy.md` (Essentials sections).

## v0.4.2 (2026-03-31)

- Fix `skills/ui-craft/SKILL.md` description length so it stays within Codex's 1024-character limit
- Keep skill metadata valid for installation and agent loading

## v0.2.0 (2026-03-21)

- Quick Start: Top 10 rules for highest-impact guidance
- 6 new anti-slop rules: uniform border-radius, emoji as icons, gradient blobs, bento grid abuse, stagger-animate-everything, star-rating testimonials
- "Why" annotations on all existing anti-slop items
- Font recommendations table (Inter, Geist, DM Sans, Plus Jakarta Sans)
- Concrete `prefers-reduced-motion` fallback examples
- Fixed 60-30-10 color rule: replaced with 90%+ neutral guidance for SaaS apps
- Fixed letter-spacing contradiction: nuanced per-size guidance
- Added CONTRIBUTING.md and LICENSE

## v0.1.0 (2026-03-19)

Initial public release.

- 12 domains: Animation, Layout, Typography, Color, Accessibility, Performance, Modern CSS, Responsive, Sound, UX Copy, UI Review, Orchestration
- 4 modes: Build, Animate, Review, Polish
- Anti-slop detection system
- Stack detection: Tailwind CSS, CSS Modules, styled-components, CSS-in-JS, SFC styles, vanilla CSS
- 12 reference files for deep domain knowledge
