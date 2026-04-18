# Versions

## v0.10.0 (2026-04-18) — signature move: scored heuristic critique

After a competitive scan (Anthropic `canvas-design`, Vercel `agent-skills`, `taste-skill`, `impeccable`) and a senior-designer / design-systems-lead / data-viz-lead gap analysis, we picked the signature differentiator: **the only AI design skill that produces a scoreable, defensible critique.** Anyone can list anti-patterns. Fewer can score them against established methodology. Nobody else frames findings as business impact.

**New references:**
- `references/heuristics.md` — Nielsen's 10 usability heuristics + 6 design laws (Fitts, Hick, Doherty, Cleveland-McGill, Miller, Tesler), each with a 1-5 scoring rubric and impact framing (`blocks-conversion` / `adds-friction` / `reduces-trust` / `minor-polish`). Ships the exact Markdown scorecard format the new command emits.
- `references/personas.md` — 5 persona walkthroughs (Priya / Jordan / Adaeze / Kwame / Margo — first-timer, power, low-bandwidth, screen-reader, one-thumb) with checklists and red flags.
- `references/state-design.md` — the state lattice (idle / loading / empty / error / partial / conflict / offline) with per-state rules, xstate-style pseudocode, and a "design the unhappy path first" methodology.

**New commands (total 16):**
- `/ui-craft:heuristic [path] [--persona=<name>]` — scored critique using Nielsen + design laws; optional persona walkthroughs. Output is machine-parseable; PMs paste it into Linear/Jira. Knob-agnostic (usability is not a knob).
- `/ui-craft:unhappy [path]` — state-first pass; enumerate and stub every non-happy state before touching the happy path. Knob-aware (`CRAFT_LEVEL ≤4` stubs 3 states; `8+` all 6).

**Detector v0.2.0** (`ui-craft-detect@0.2.0`, now live on npm):
- **8 new rules** (total 19): `left-top-animation`, `no-focus-visible`, `pixel-radius-inconsistency`, `unit-mixing`, `absolute-zindex`, `setTimeout-animation`, `inline-any-style`, `aria-label-emoji`.
- **Ignore comments**: `// ui-craft-detect-ignore`, `…-next-line`, `…-file`, `…-ignore-rule: <id>`. Work in HTML comments too.
- **`.uicraftrc.json` config file** (walks up to `.git` boundary): per-rule `off` / `warn` / `error` overrides; glob-based `ignore`; `extends` acknowledged.
- **`--fix` + `--fix-dry-run`**: auto-remediate `transition: all` → `transition: opacity, transform`; strip `animate-bounce` from class lists. Concurrent-edit guarded.
- **`--sarif` output**: SARIF 2.1.0 JSON for GitHub code-scanning alerts.
- Summary line now reports config overrides + auto-fix count.
- Published to npm (`npm whoami: educalvolpz`).

**Landing docs** (`skills.smoothui.dev/docs`): migrated single-page landing to landing + `/docs/*` routes via Astro 6 content collections. Five initial pages: `getting-started`, `skill-anatomy`, `variants`, `commands`, `ui-craft-detect`. Shared docs layout with sticky sidebar (desktop) / collapsible drawer (mobile), matching the landing's Geist + `oklch()` aesthetic exactly.

**Per-variant eval JSONs** added: `ui-craft-playful.json`, `ui-craft-brutalist.json`. 15 should-trigger / should-not-trigger queries each; cross-variant discriminators as the high-signal negatives.

## v0.9.1 (2026-04-18) — publish `ui-craft-detect` on npm

The detector script is now shippable as a standalone npm package.

- `package.json` repurposed: `name: "ui-craft-detect"`, `version: 0.1.0`, `"private": false`, adds `bin`, `main`, `files`, `keywords`, `author`, `homepage`. Joins the user's existing CLI lineup (`smoothui-cli`, `design-bites`, `sparkbites-mcp`).
- `.npmignore` excludes skill content (skills/, commands/, .codex/, etc.) from the tarball. Only `scripts/detect.mjs`, `LICENSE`, `package.json`, and `README.md` ship (12.6kB tarball).
- `npx ui-craft-detect <path>` works anywhere — no clone, no clone, no install.
- Compatible with pre-commit hooks via `npx ui-craft-detect .` or Husky.

## v0.9.0 (2026-04-18) — 2 new variants, agent logos, pre-commit hook

- **`ui-craft-playful`** — Clay / Gumroad / Duolingo / Arc aesthetic. Knobs 8/7/4. Rounded corners, spring motion, multi-accent (≤3), colored soft shadows.
- **`ui-craft-brutalist`** — Swiss print revival / Nothing UI / Web 1.0 terminal. Knobs 7/2/6. Mono or geometric sans, hard 2-4px borders, type-as-hero, pure B/W allowed.
- **Style variants total: 5** (minimal + editorial + dense-dashboard + playful + brutalist).
- **Landing page**: real SVG agent logos (Claude Code, Codex, Cursor, Gemini, OpenCode) in the "Works in every agent" pill row, served from `/public/agents/`. Sourced from the `skills.sh` ecosystem icon set.
- **Pre-commit hook** (`.githooks/pre-commit`) now runs two steps: (1) auto-version `marketplace.json` CalVer, (2) run `scripts/detect.mjs` on staged UI files. Enable per clone: `git config core.hooksPath .githooks`.
- **Housekeeping**: `marketplace.json` `name` field is now `"ui-craft"` (kebab-case, matches directory + skill name). Display-only metadata; no install path or slug impact.

## v0.8.0 (2026-04-18) — more commands, detector, CI

- **7 new slash commands** (total 14): `/bolder`, `/quieter`, `/delight`, `/harden`, `/colorize`, `/clarify`, `/extract`. Each follows the existing command pattern (YAML frontmatter + knob gating where relevant + specific reference pointers + Review Format output). Materialized as sub-skills in every harness mirror.
- **`scripts/detect.mjs`** — zero-dependency static anti-slop detector. Scans CSS / JSX / TSX / Vue / Svelte / Astro for 11 anti-patterns (transition-all, bounce easing, purple/cyan gradients, ALL CAPS headings, glassmorphism stacks, gradient text on metrics, emoji-as-icons, pure black text, generic CTAs, uniform border-radius). Exits non-zero on findings — CI-ready. `npm run detect [path]`.
- **`scripts/validate.mjs`** + **`.github/workflows/validate.yml`** — validates plugin manifests, skill frontmatter (name + description ≤ 1024 chars for Codex), command frontmatter, and resolves every internal markdown link. Runs on push + PR. Currently 61/61 checks pass.
- **`evals/`** — added per-variant eval query sets: `ui-craft-minimal.json`, `ui-craft-editorial.json`, `ui-craft-dense-dashboard.json`. Each has 15 should-trigger / should-not-trigger queries focused on cross-variant discriminators (the high-signal negatives).
- **README** — before/after screenshots (hero + dashboard), updated commands table grouped by intent (Review & ship / Transform / Taste dial).
- Marketplace CalVer bumped to `2026.4.18.2300`; package.json to `0.8.0`.

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
