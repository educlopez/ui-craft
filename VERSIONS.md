# Versions

## v0.15.0 (2026-04-19) — detector v0.5 (33 rules + `init-hook`)

**Detector `ui-craft-detect@0.5.0`** — 4 new rules (total 33) + new `init-hook` subcommand.

**New rules:**
- `a11y/streaming-no-live-region` (critical, file-level) — files rendering streaming content (useChat / useStream / SSE / token-by-token setState loops) without `aria-live`, `role="status"`, or a named LiveRegion component. Screen readers miss streamed updates otherwise.
- `forms/autocomplete-missing` (major, line-level) — inputs typed or named for email / tel / password / credit card / address without the `autocomplete` attribute. Breaks browser autofill + mobile UX.
- `a11y/heading-order-skip` (major, file-level) — heading levels jumping more than one level down (e.g., `<h1>` → `<h3>` with no `<h2>`). Breaks screen-reader document outline.
- `perf/image-no-dimensions` (major, line-level) — `<img>` without `width` + `height` OR `aspect-ratio` (inline style or Tailwind `aspect-*` class). Source of Cumulative Layout Shift. Skips `data:` URIs and decorative images.

**New `init-hook` subcommand** — replaces the need for a separate `ui-craft-detect-hooks` npm package. One CLI, one install, full tooling coverage:
```bash
npx ui-craft-detect init-hook                  # auto-detect husky or native
npx ui-craft-detect init-hook --native         # .githooks/pre-commit + chmod +x
npx ui-craft-detect init-hook --husky          # .husky/pre-commit
npx ui-craft-detect init-hook --github-action  # CI workflow
npx ui-craft-detect init-hook --all            # all three
npx ui-craft-detect init-hook --dry-run        # preview only
```
- Interactive overwrite prompt with colored diff (bypass with `--yes`).
- Every generated hook uses `npx ui-craft-detect` so it's zero-config in other repos.
- Graceful error on non-git directories. Updated `--help` documents both scan and init-hook.

**Implementation:** detector 1427 → 1960 lines (+533). Zero new dependencies (uses `readline` built-in for prompts). All v0.4.0 features intact — ignore comments, `.uicraftrc.json` config, `--fix` / `--fix-dry-run`, `--json`, `--sarif`. `package.json` bumped to `0.5.0`.

## v0.14.0 (2026-04-19) — full consolidation pruning

Post-audit pruning. Six targeted merges/moves/deletes to kill duplication debt accumulated across v0.5.0-v0.13.0. No new capabilities — tighter ones.

**Merges:**
- `animation.md` + `motion-system.md` → `motion.md` (284 lines — 36% smaller than the 443 lines of the two inputs). Dropped the 22-variant easing list in favor of 4 canonical tokens (`--ease-out`, `--ease-in-out`, `--ease-emphasized`, `--ease-soft`). Single authoritative duration scale (120 / 200 / 280 / 400 / 600ms). One spring-vs-tween rule.
- `copy.md` + `ux-writing.md` → `copy.md` (273 lines — 19% smaller than inputs). System-level sections first (voice matrix, tone-by-context, reading level, terminology, inclusive language, locale), then tactical (CTAs, errors, empty states, confirmations), then banned dark patterns. One file, one mental model for anything UX-copy-shaped.

**Moves:**
- `animation-orchestration.md` → `examples/animation-storyboard.md` (it was always a single template, not a reference).
- Variants `ui-craft-playful` + `ui-craft-brutalist` → `examples/presets/`. These covered <5% of real asks and competed with the main skill's triggers. As presets, they stay discoverable ("use playful preset") without polluting the skill trigger space.
- `evals/ui-craft-playful.json` + `ui-craft-brutalist.json` → `evals/presets/`.

**Deletes (unique bits absorbed elsewhere):**
- `/bolder` command — its type-amplification moved into `/typeset` ("Amplifying hierarchy" section); signature-detail concept was already owned by `/polish` at `CRAFT_LEVEL 8+`.
- `/quieter` command — its accent-reduction moved into `/colorize` ("Over-colored? Reduce."); visual-weight reduction moved into `/distill`; motion-trim was already in `/animate` at `MOTION_INTENSITY ≤ 3`.

**Trims:**
- `ui-craft-minimal` description 520 → 264 chars, `ui-craft-editorial` 557 → 268, `ui-craft-dense-dashboard` 623 → 286. Stripped `"Defers all base..."` boilerplate present across all variant descriptions. Triggering is cleaner, no trigger-fatigue.

**Net state:** 23 → 20 references · 17 → 15 commands · 6 → 4 skills · 115 → 95 dirs per harness sync · validator 79 → 63 checks (fewer files, fewer assertions — all pass).

Updated references to the merged/moved files across `SKILL.md`, `stack.md`, `dataviz.md`, `ai-chat.md`, `forms.md`, `commands/animate.md`, `commands/delight.md`, `commands/shape.md`, `commands/typeset.md`, `commands/distill.md`, `commands/colorize.md`, `skills/ui-craft-minimal/SKILL.md`, `skills/ui-craft-dense-dashboard/SKILL.md`, `plugin.json`, and `README.md`. Landing docs follow in a separate commit.

## v0.13.0 (2026-04-19) — AI-chat, modern-CSS platform, forms, dashboard hierarchy, detector v0.4

Filtered through two gates applied to every proposed addition: (a) stack-agnostic, (b) design-engineer-pure. Product / growth / marketing concerns deferred to future sibling skills. This release expands only what passes both filters.

**New references:**
- `references/ai-chat.md` (158 lines) — framework-neutral interaction patterns for AI surfaces. Streaming contract (first pixel <400ms / Doherty), 7-state affordance table (idle / composing / thinking / streaming / tool-calling / complete / error), tool traces, citation chips with deep-link, feedback affordances, retry vs regenerate vs continue, inline response actions, generative UI patterns, conversation surface layout, 10 anti-patterns. Does not assume any specific SDK.
- `references/forms.md` (161 lines) — holistic form system design beyond labels/errors. Validation timing decision tree, progressive disclosure, multi-step wizards with resume-on-return, autosave + conflict resolution, optimistic submit, keyboard contract, field-specific patterns (phone / date / timezone / credit card / password / magic-link / file upload), destructive actions inside forms, 10 anti-patterns.

**Expanded references:**
- `references/modern-css.md` — added Anchor Positioning (Baseline 2026), Popover API + `<dialog>`, `interpolate-size: allow-keywords`, `color-mix()` for theme derivations, `transition-behavior: allow-discrete` with `@starting-style`, deeper container-query patterns (style queries, named containers). Replaces the need for a separate `native-platform.md` — consolidated into the existing reference.
- `references/dashboard.md` — added "Signal-to-noise hierarchy" section. The 4-tier model (hero metric / supporting / context / deep-dive), the "8-equal-cards" anti-pattern, the squint test, 4 ranking questions to answer per dashboard.

**Detector `ui-craft-detect@0.4.0`** — 4 new rules (total 29):
- `a11y/modal-without-dialog` (critical, file-level) — custom div modals when native `<dialog>` or `[popover]` would work. Skips files importing Radix / HeadlessUI / Ariakit / Reach / Vaul / React Aria / React Modal (already a11y-correct).
- `forms/placeholder-as-label` (critical, line-level) — inputs with placeholder but no `<label>` / `aria-label` / `aria-labelledby`.
- `a11y/outline-none-no-replacement` (critical, line-level) — `outline: none` or `outline-none` without `:focus-visible` replacement in a 6-line window.
- `tables/no-overflow-handling` (major, file-level) — tables without horizontal overflow handling OR sticky thead (emits up to 2 findings per file).

`package.json` bumped to `0.4.0`. Detector: 1272 → 1427 lines. All prior features intact (ignore comments, `.uicraftrc.json`, `--fix`, `--json`, `--sarif`).

**Explicitly NOT added** (failed filter):
- `de-shadcnify.md` — React-specific. Principles already dispersed across existing refs.
- `onboarding.md` — adjacent to product strategy, not pure design engineering.
- `command-menu.md` — too narrow for its own file.
- `native-platform.md` — redundant with `modern-css.md`.

## v0.12.0 (2026-04-18) — detector v0.3 + docs expansion

**Detector `ui-craft-detect@0.3.0`** — 6 new rules (total 25). All from the Tier 3 competitive research backlog.
- `dark-pattern/confirmshaming` (critical) — "No thanks, I hate saving money"-style shaming copy
- `dark-pattern/destructive-no-confirm` (critical) — `<button>Delete</button>` without a nearby `AlertDialog`/`onConfirm`/`useConfirm`
- `a11y/icon-only-button-no-label` (critical) — `<button>` with only an `<svg>`/`<Icon>` child and no `aria-label`
- `dataviz/categorical-rainbow` (major) — chart library imports + 6+ inline color literals without a named palette (`viridis`, `okabe`, `tableau`, `colorBrewer`)
- `state/missing-empty-or-error` (major) — data-fetching components (`useQuery`, `useSWR`, `fetch`) with no empty/error/loading branches in the JSX
- `copy/placeholder-shipped` (critical) — `Lorem ipsum`, `TODO`, `XXX`, `John Doe`, `555-0123` in shipped text nodes

`package.json` bumped to `0.3.0`. Line count 1055 → 1272 (within budget). Existing features preserved: ignore comments, `.uicraftrc.json` config, `--fix`/`--fix-dry-run`, `--json`, `--sarif`.

**Landing docs expanded** (`skills.smoothui.dev/docs`) — 6 new reference pages in the new `reference` section of the docs site: `heuristics`, `personas`, `state-design`, `dataviz`, `ux-writing`, `motion-system`. Total docs pages: 11 (was 5). Each page is docs-appropriate (not agent-appropriate), written for devs already using the skill. Uses the existing `DocsLayout.astro` — no layout changes. `pnpm run build` exits 0 with 13 pages.

## v0.11.0 (2026-04-18) — dataviz, ux-writing, motion system, `/shape`

Tier 2 of the differentiation push. Fills three expert-knowledge gaps flagged by the competitive research (senior product designer / design-systems lead / data-viz lead lenses) and adds the wireframe-first command.

**New references:**
- `references/dataviz.md` — Cleveland-McGill perceptual hierarchy, chart selection matrix, color for data (sequential / diverging / categorical with ColorBrewer + Okabe-Ito), Tufte principles distilled, direct labeling, small multiples, animated-transition pattern, 10-item anti-slop checklist. Fills the gap `dashboard.md` left (chrome vs data science).
- `references/ux-writing.md` — voice vs tone distinction, 3-axis voice matrix, tone-by-context table, reading level (Flesch ≥70) with concrete grade-14 → grade-7 rewrite examples, terminology consistency, 9-row inclusive-language swap table, locale-aware strings (`Intl.*`, plural rules, length tolerance, RTL, logical CSS properties), 3-part error-copy anatomy, CTA respect rules, banned dark patterns. Complements `copy.md` (tactical) with the system layer.
- `references/motion-system.md` — duration scale (120 / 200 / 280 / 400 / 600ms as tokens), easing scale (4 cubic-béziers), 5 choreography rules (hierarchy, stagger, exit < enter, co-located, shared element), motion budget per surface, reduced-motion contract with the 2 documented exceptions, Figma JSON token export, framework mapping, 8 system-level anti-patterns. Complements `animation.md` (tactical) and `animation-orchestration.md` (multi-stage) with the token/rhythm layer.

**New command (total 17):**
- `/ui-craft:shape [description]` — wireframe-first pass. Outputs ASCII layout (desktop + mobile), content inventory with P0/P1/P2 annotations, state list pointing at `state-design.md`, and 3-5 open questions — all before any JSX. Knob-aware (at `CRAFT_LEVEL ≥ 7`, also adds motion shape + typography hierarchy plan). Low-fi gate to prevent jumping straight to hi-fi.

**Impact:** 3 new expert domains (dataviz / ux-writing / motion-system) + a wireframe-first workflow. Competitors stop at `impeccable`'s system-level depth; we now cover it and add dataviz + the shape-first discipline. Total: 6 skills, 17 commands, 21 domains.

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
