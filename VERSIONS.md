# Versions

## v0.31.0 (2026-06-25) — `/start` front door + system repositioning

Closes the front-door gap surfaced by the holistic product analysis: ui-craft grew from a skill into a system (skill + 22 commands + 2 agents + 4 MCP tools + CLI + eval), but newcomers had no single "start here" and the copy everywhere still said "skill".

**New:**

- **`/start` command** (`commands/start.md`) — the front door. Read-only: detects the project (framework, token spine, brief, spec, harness, existing UI) and reports what ui-craft can do **right now** across the three usage layers (just-ask / drive / verify), then recommends one next step and routes to the real command. Orchestrate-only — never builds or edits. Materialized as a sub-skill in all 5 harness mirrors.
- **SKILL.md routing** gains a top "new here / unsure where to begin → `/start`" row.

**Repositioned (docs):**

- README leads with **"a design engineering system you install as a skill"** (skill = install format, not the ceiling) + a new **"Three ways to use it"** layered table. Counts corrected to 22 commands / 31 references.
- `ui-craft-docs` landing repositioned to match + `PARITY-BACKLOG.md` logged (the site documents ~v0.24; agents/MCP/score/sddesign pages tracked for a follow-up).
- Both GitHub repo descriptions updated "skill" → "system, install as a skill".

## v0.30.1 (2026-06-25) — fix: MCP server + plugin manifest actually work

Two shipped-but-broken bugs caught by a functional smoke test (the unit tests bypassed the real server + the manifest validator).

**Fixed:**

- **MCP server crashed on startup.** `McpServer.registerTool` (SDK 1.29) requires a Zod raw shape for `inputSchema`, not a JSON-Schema object — all 4 tools (check_anti_slop, tokens_lint, acceptance_bar, score_ui) failed to register, so the server never booted under a real client. Tools now register; added `zod` dep. The module-level unit tests passed because they called the tool functions directly, skipping the server.
- **Added a functional stdio smoke test** (`mcp/src/server.smoke.test.mjs`) — spawns the real server via an MCP client, asserts it lists the 4 tools and that calls return content. This is the regression guard that would have caught the above.
- **Plugin manifest was invalid** → `/plugin marketplace add educlopez/ui-craft` and `claude plugin validate` failed. `plugin.json` was missing the required `name` and used unsupported `skills`/`commands` path-arrays; it now carries `name`/`description`/`version` and relies on auto-discovery (`skills/*/SKILL.md`, `commands/*.md`, `agents/*.md`). `marketplace.json` rewritten from a single-plugin descriptor to the correct marketplace schema (`owner` + `plugins[]`). `claude plugin validate` now passes.

## v0.30.0 (2026-06-25) — design-quality eval harness + score_ui MCP tool

Adds a deterministic composite design-quality scorer (`evals/quality/score.mjs`) that composes three source-static signal dimensions into a single 0-100 UICraftScore + letter grade. Delivered in two PRs: PR 1 shipped the eval core, fixtures, baselines, CLI benchmark, and CI gate; PR 2 (this entry) adds the `score_ui` MCP tool and closes the v0.30 release.

**Scoring formula (deterministic, zero deps):**

`score = 100 − (antiSlop_crit×8) − (antiSlop_major×4) − (antiSlop_warn×1) − (token_findings×2) − (a11y_crit×8) − (a11y_major×4)`, clamped [0, 100].

Grade bands: A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · F < 60.

**Three dimensions:**

- **anti_slop** — 33 rules from `scripts/detect.mjs` `scan()`. Severities: critical (−8), major (−4), warn (−1).
- **token_discipline** — regex scanner via `mcp/src/tokens-rules.mjs` `scanTokens()`. Flat −2 per finding (error or warning).
- **a11y** — 5 new static checks in `evals/quality/a11y-static.mjs` (no rule-id overlap with detect.mjs — verified and documented): `img-no-alt` (critical), `non-semantic-interactive` (critical), `positive-tabindex` (major), `aria-invalid-no-describedby` (major), `no-reduced-motion` (major, file-scope). Severities: critical (−8), major (−4).

**New files (PR 1 — eval harness):**

- `evals/quality/a11y-static.mjs` — 5 new a11y checks, exports `scanA11y` + `a11yRules`. Zero deps.
- `evals/quality/score.mjs` — shared scoring core; exports `scoreUI`, `WEIGHTS`, `GRADE_BANDS`, `EVAL_VERSION`, `_buildResult`. Imports: `scan()` (scripts/detect.mjs), `scanTokens()` (mcp/src/tokens-rules.mjs), `scanA11y()` (./a11y-static.mjs).
- `evals/quality/score.test.mjs` — 46 node:test tests: formula unit, a11y hit/miss, regression fixture gate, separation assertion, edge cases.
- `evals/quality/baselines.json` — baseline bands (±5–10 margin) for 8 fixtures: 4 slop (scores 0–60) + 4 designer (scores 100). Separation holds: min(designer) > max(slop).
- `evals/quality/fixtures/slop/*.tsx` (4 files) — intentional violations across all 3 dims.
- `evals/quality/fixtures/designer/*.tsx` (4 files) — clean: token system, semantic elements, alt text, reduced-motion guards.
- `scripts/eval.mjs` — CLI + benchmark runner: single-file, directory, `--baseline`, `--json`, `--threshold`, `--min`. Zero deps. Exit codes 0/1/2. `--baseline` → 8/8 in-band gate.
- `evals/README.md` — updated with `quality/` section: formula, checks, fixtures, baselines, how to run.
- `.github/workflows/mcp-test.yml` — added path triggers for `evals/quality/**` + `scripts/eval.mjs`. Added `quality-eval` job (no npm install, runs at repo root): `node --test evals/quality/*.test.mjs` + `node scripts/eval.mjs --baseline`. Existing `mcp-test` job untouched.
- `.uicraftrc.json` — added `evals/quality/fixtures/**` to ignore list (prevents pre-commit double-flagging intentional slop fixtures).
- `.githooks/pre-commit` — copies `.uicraftrc.json` into hook's temp dir so ignore patterns apply.

**New files (PR 2 — score_ui MCP tool):**

- `mcp/src/tools/score-ui.mjs` — `score_ui` MCP tool adapter. `import { scoreUI } from '../../../evals/quality/score.mjs'` (same cross-package relative import pattern as `check-anti-slop.mjs → ../../../scripts/detect.mjs`). Input: `{ code?, path? }`. Output: UICraftScore envelope. Structured error on bad input or caught exception.
- `mcp/src/tools/score-ui.test.mjs` — 10 node:test tests: slop → low score, clean → high score, envelope shape, bad-input structured error, parity with direct `scoreUI()`, path inputs within baseline bands.

**Changed (PR 2):**

- `mcp/src/server.mjs` — registered `score_ui` as the 4th tool. Header comment updated (3 → 4 tools). Import of `scoreUiTool` from `./tools/score-ui.mjs`. Comment documents the cross-package import and mcp `files:["src"]` publish-packaging note (consistent with existing `check_anti_slop` behavior — flag if standalone npm publish is needed).
- `mcp/src/server.test.mjs` — updated to reflect 4 tools; imports `scoreUiTool`; adds `score_ui` to tool-name set assertion.
- `README.md` — added "Design-quality score" section with formula, CLI, MCP tool.
- `VERSIONS.md` — this entry.

**Architecture — cross-package import decision (ADR-1):**

The scoring core lives in `evals/quality/score.mjs` and is imported by both `scripts/eval.mjs` and the `score_ui` MCP tool via relative cross-package imports. This mirrors the shipped v0.29 pattern (`mcp/src/tools/check-anti-slop.mjs → ../../../scripts/detect.mjs`) — no new precedent created. The `mcp/package.json` `files: ["src"]` does NOT include `evals/`; `score_ui` is available in the repo-local server (via `.mcp.json` `npx`/local path). Flag for npm publish: add `../evals/quality` to mcp `files` if standalone publish is needed.

**Baseline regen procedure:** when intentionally changing rule weights or adding new rules, run `node scripts/eval.mjs --baseline` to see current scores, then update `evals/quality/baselines.json` bands to match + ±5–10 margin. Re-run `node --test evals/quality/*.test.mjs` to confirm 46/46. Commit baselines + rule change together.

**Verification (all green):**

- `node --test evals/quality/*.test.mjs` → 46/46 pass
- `node scripts/eval.mjs --baseline` → 8/8 in band, exit 0
- `node --test scripts/detect.test.mjs` → 8/8 pass (unchanged)
- `node scripts/validate.mjs` → 96/96 pass (unchanged)
- `cd mcp && node --test` → 46/46 pass (35 existing + 10 score_ui + 1 server.test update)
- Root `package.json`: zero new deps

This is the final phase of the skill → system roadmap started in v0.20 (outcome layer) → v0.27 (spec-driven design) → v0.28 (agent pack) → v0.29 (MCP server) → v0.30 (deterministic quality gate).

## v0.29.0 (2026-06-24) — MCP server + detect.mjs scan() export

Adds a self-contained `mcp/` package exposing three deterministic design-quality tools over stdio MCP. Also refactors `scripts/detect.mjs` to export a `scan()` function callable in-process (used by the MCP server). The CLI (`ui-craft-detect`) behavior is byte-identical — only an export and an entry guard are added.

**New (`mcp/` package — `ui-craft-mcp` npm, version 0.1.0):**

- `mcp/src/server.mjs` — stdio MCP server using `@modelcontextprotocol/sdk` v1.29.0 (`McpServer` + `registerTool` API + `StdioServerTransport`). Registers exactly 3 tools.
- `mcp/src/tools/check-anti-slop.mjs` — `check_anti_slop` tool: calls `scan()` from `scripts/detect.mjs` in-process; returns `{ findings, summary }`.
- `mcp/src/tools/tokens-lint.mjs` — `tokens_lint` tool: regex scanner for off-system hex colors, non-scale radius/spacing px, magic z-index. Rule IDs: `tokens/color`, `tokens/radius`, `tokens/spacing`, `tokens/z-index`.
- `mcp/src/tokens-rules.mjs` — exported regex ruleset derived from `references/tokens.md`.
- `mcp/src/tools/acceptance-bar.mjs` — `acceptance_bar` tool: returns bundled checklist per surface (dashboard/landing/auth/generic). Data only, no scoring.
- `mcp/src/acceptance-data.json` — static acceptance items hand-derived from `recipe-dashboard.md`, `recipe-landing.md`, `recipe-auth.md` (## Acceptance bar), and `finish-bar.md` (10 passes). Regen-on-recipe-edit: manual for v1.
- `mcp/src/server.test.mjs`, `mcp/src/tools/*.test.mjs` — 30 `node:test` tests (zero deps): tool registration, dispatch, happy paths, bad-input structured errors, token hit/miss, acceptance surfaces.
- `mcp/package.json` — `ui-craft-mcp`, v0.1.0, `type: module`, `bin: ui-craft-mcp`, `engines: node>=18`, dep `@modelcontextprotocol/sdk@1.29.0`.
- `mcp/README.md` — install, tool docs, boundary note, acceptance-data regen note.
- `.mcp.json.example` — wiring template for `.mcp.json` (`npx ui-craft-mcp`).
- `.github/workflows/mcp-test.yml` — separate CI job: `cd mcp && npm install && npm test`. Does not touch `validate.mjs` or `sync-harnesses.mjs`.

**Changed:**

- `scripts/detect.mjs` — added `export async function scan(target, { config } = {})` returning `{ version, summary, findings }`. Added CLI-entry guard (`import.meta.url === pathToFileURL(process.argv[1]).href`). Exported `rules` and `scanFile`. `ui-craft-detect` CLI behavior unchanged.
- `README.md` — added MCP section with tool table and quick-start wiring.
- `VERSIONS.md` — this entry.

**Architecture:** `mcp/` is a self-contained package; root `package.json` has zero new dependencies. `validate.mjs` scope (`plugin.json`, `SKILL.md` frontmatter, reference links) excludes `mcp/` — gate stays green. Tag `v0.29.0` covers both skill and MCP; `mcp/package.json` version `0.1.0` is the npm-independent version.

## v0.28.0 (2026-06-24) — design agent pack

Adds a two-agent parallel verify team as a new artifact class in the ui-craft plugin: `design-reviewer` (adversarial design critique) and `a11y-auditor` (accessibility audit). Both are read-only, fresh-context, and tool-scoped (Read/Grep/Glob). This is an additive Claude-Code-plugin-only layer — the skill, commands, and harness mirrors are unchanged.

**New:**

- `agents/design-reviewer.md` — adversarial design critic. Loads `references/review.md`, the Anti-Slop and Craft Test sections from `SKILL.md`, and `references/heuristics.md`. Returns severity-tagged findings (Critical / Warning / Suggestion, `file:line`). No edits. Invokable as `ui-craft:design-reviewer`.
- `agents/a11y-auditor.md` — accessibility auditor. Loads `references/accessibility.md`. Covers keyboard, focus-visible, APCA contrast, ARIA, touch targets, reduced-motion. Returns severity-tagged findings. No edits. Invokable as `ui-craft:a11y-auditor`.
- `references/agents.md` — 31st reference file. Describes the agent pack: roles, agent-vs-command guidance (fresh-context parallel delegation vs. inline commands), and parallel verify-team usage pattern (delegate both on the same diff simultaneously).

**Changed:**

- `skills/ui-craft/SKILL.md` — Routing table: new row directing parallel design-verify intent to `ui-craft:design-reviewer` + `ui-craft:a11y-auditor` with agent-vs-command distinction noted. Tier-4 Reference Files: new `agents.md` row.

**Architecture note:** Auto-discovery is used — `agents/` dir at plugin root, no `plugin.json` change. The `agents` field in plugin.json is optional and, if present, replaces default scan rather than extending it — leaving `plugin.json` as `{skills, commands}` is the lowest-risk and correct approach. Rollback: delete `agents/` + `references/agents.md`, revert SKILL.md/VERSIONS/README.

30 references (+ 1 agents reference = 31 total), 21 commands, 2 agents.

## v0.27.0 (2026-06-24) — spec-driven design

Closes the ephemeral gap between brief (why) and build (how) by persisting the composition decision as `.ui-craft/spec.md` and chaining all existing pipeline phases into one guided meta-command `/sddesign`.

**New:**

- `references/spec.md` — 30th reference file. Defines the `.ui-craft/spec.md` artifact: per-surface `## Surface: <name>` sections, each with chosen composition/recipe, layout skeleton (ASCII inline), component inventory wired to `components.md` contracts, state lattice (sourced from `state-design.md`), and acceptance bar (from the recipe). Append-mostly; multiple surfaces coexist as sections. Mirrors `brief.md` style (frontmatter-free).
- `commands/sddesign.md` — 21st command. Orchestrate-only meta-command that walks brief → tokens → spec → build → converge → ship. Calls existing phase commands at each gate; never re-implements their rules. Skippable gates with degraded-mode honesty; progress shown as a phase checklist. Respects brief §6 + a11y floor precedence.

**Changed:**

- `commands/shape.md` — Step 6 added: opt-in offer to persist shape output to `.ui-craft/spec.md`. Print-only remains the default; the write executes only on explicit user confirmation.
- `skills/ui-craft/SKILL.md` — Routing table: new `/sddesign` row (full spec-driven pipeline); existing `/craft` row updated to clarify "one-shot build" vs `/sddesign` "full pipeline". Tier-2 Reference Files: new `spec.md` row.

**Naming note:** The command is `/sddesign` (one word, no hyphen) to avoid collision with the SDD-phase skill family (`sdd-explore`, `sdd-design` agent phase, etc.). These are different systems: `/sddesign` is a ui-craft pipeline meta-command; `sdd-*` is the spec-driven development orchestration layer.

30 references, 21 commands.

## v0.26.0 (2026-06-24) — loop engine

Adds an iterate-until-converged loop engine so commands can run until a binary quality gate passes — not just produce a single-shot report. The engine is purely declarative (no runtime); it lives in a new reference file and is wired into three existing commands.

**New:**

- `references/loops.md` — 29th reference file. Engine contract (5 fields), numbered loop procedure, renderer detection ladder (5 rungs, OPT-IN only for npx), honesty/confidence contract, 3 presets, preset block template for future additions.

**Changed:**

- `commands/finalize.md` — Step 6b: convergence mode (opt-in); runs `visual-anti-slop` preset; explicitly notes that the findings-only hard-stop is lifted ONLY in convergence mode.
- `commands/unhappy.md` — convergence note after Step 4: run `state-coverage` preset; re-inventory until all required states present or budget.
- `commands/tokens.md` — converge mode in Step 3: run `token-consistency` preset; re-scan until zero off-system values or budget.
- `references/finish-bar.md` — short Convergence mode clause (re-run from Pass 1 after each fix until Done or budget; no pass duplication).
- `references/state-design.md` — 1-line gate framing linking the lattice to the `state-coverage` preset.
- `references/tokens.md` — 1-line gate framing linking the off-system-value definition to the `token-consistency` preset.
- `skills/ui-craft/SKILL.md` — 1 Routing row, 1 Tier-2 Reference Files row, 1 Core Rule pointer, all linking to loops.md.

29 references, 20 commands.

## v0.25.0 (2026-06-23) — self-correction folds into the brief

Settles the memory direction. UI Craft is a UI design skill, not a general memory engine — so the standalone memory store added in v0.23–v0.24 was the wrong shape. v0.25 folds project-scoped self-correction back into the artifact that already holds design decisions, the brief, and treats cross-project memory as an external concern reached through an optional bridge.

**Changed:**

- `references/brief.md` — new **section 6, Learned constraints** (append-only, dated, each pinning rule + why): the brief teaching itself from corrections. New **Self-Correction** section: when the user rejects or redirects a choice, record it as a learned constraint (`/remember`); learned constraints rank with the principles — override skill defaults, never the accessibility/correctness floor.
- `commands/remember.md` — rewritten to append a learned constraint to the brief; cross-project reach mirrors to an external memory service only if one is available, otherwise stays in the brief.
- SKILL.md — Discovery notes the brief's learned constraints; Core Rule reframed to **Self-Correction** (brief-based); routing + Tier 1 table updated.

**Removed:**

- The standalone memory store and its `/memory-lint` command — superseded by the brief-based approach. Project state stays in `.ui-craft/brief.md`; general cross-project memory belongs to an external service, not this skill. 28 references, 20 commands.

## v0.24.0 (2026-06-23) — tiered memory store (superseded by v0.25)

Reworked the v0.23 learning file into a tiered, file-based store with a second cross-project reach. Superseded by v0.25, which folds project self-correction back into the brief and treats cross-project memory as external — see above.

## v0.23.0 (2026-06-23) — project memory + self-correction

A portable, file-based learning layer so the skill remembers each project's conventions and the corrections a user makes — without ever weakening its quality floor. No database, no MCP, no network: one markdown file in the user's repo, read at Discovery, appended to when corrected. Works the same across all five harness mirrors.

**New:**

- `references/memory.md` — 29th reference. Defines `.ui-craft/memory.md` (sits beside the existing `.ui-craft/brief.md`): a **Profile** block (autodetected stack/tokens/style) + an append-only **Learned** log of corrections (each entry pins *what*, *why*, *apply-as-rule*, *scope*). Specifies the three-tier **precedence ladder** (hard a11y/correctness floor > project memory > skill defaults — memory can invert a default but never the floor), read-at-Discovery and write-on-correction behavior, supersede + hygiene rules, and the **upstream funnel** (project-specific corrections stay local; corrections that reveal a baseline gap become PR candidates against the skill).
- SKILL.md — Discovery Step 1 now loads `.ui-craft/memory.md` after the brief; new Core Rule **Project Memory & Self-Correction** (precedence ladder + correction-write trigger); Tier 1 reference table updated.

**Why it matters:** corrections stop being re-litigated every session, the skill adapts per-project while keeping one curated high-quality UI baseline, and the local memory doubles as a discovery pipeline for improving the skill itself.

## v0.22.0 (2026-06-23) — interface detail polish

Three net-new finish-level rules folded in from an external interface-detail technique scan, each pinned to exact values and made auditable in the review checklist. All were genuine gaps — the rest of the scanned set already lived in the skill.

**New:**

- `references/typography.md` — root font smoothing rule: `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale` applied once on `html` (macOS renders text heavier by default; this thins it). Set once at the root, never per-element, or weights look inconsistent.
- `references/color.md` — image outlines: inset `1px` outline at `rgba(0,0,0,0.1)` light / `rgba(255,255,255,0.1)` dark, `outline-offset: -1px`. Color is non-negotiable — never a tinted near-black/near-white or the accent hue (tinted picks up the surface and reads as dirt on the edge). The one place the hue-consistency rule is explicitly overridden.
- `references/motion.md` — Choreography rule #9: suppress entrance animation on first paint for default-state elements (`initial={false}` on `AnimatePresence`), with the deliberate-hero/loading exception called out.

**Audit:**

- `references/review.md` — three checklist lines added (Animation + Design audits) so the new rules are caught in review passes.

## v0.21.0 (2026-06-11) — recipes: landing + auth

Extends the v0.20 outcome layer to the two highest-visibility surfaces after dashboards. Both recipes were validated by building real screenshots with them first (the repo's refreshed hero-with and signin-with marketing assets are their output).

**New:**

- `references/recipe-landing.md` — 27th reference. Three compositions selected by what exists to show: **Product-forward** (text left F-pattern, real product shot cropped at fold + right edge as scroll tease, floating proof card), **Message-forward** (centered Z-pattern with deliberately asymmetric proof — for pre-launch with no product to show), **Proof-forward** (compact hero, evidence-led, for sales-led B2B). Section grammar with one-question-per-section ordering, pricing-block rules (recommended-plan highlight without burying siblings, sticky compare headers, % discounts under $100 / absolute above, genuine-scarcity-only), CTA three-level hierarchy, dual-benefit headline guidance, 10-item acceptance bar.
- `references/recipe-auth.md` — 28th reference. Two compositions (split-panel with tinted-neutral brand panel / centered card for utility apps), strict form contract (360-400px column, SSO ordering by usage, lowercase divider, no asterisks, inline Forgot-password, enabled submit validating on press, security-aware error copy), sign-up deltas (minimum fields, next-step disclosure), 8-item acceptance bar. Names the full-bleed saturated brand panel as the #1 AI tell on auth screens.
- SKILL.md routing + Tier 2 updated; `/craft` now routes `dashboard`, `landing`, `auth`.

## v0.20.0 (2026-06-11) — outcome layer: recipes, themes, /craft

Strategic shift from rules-first to outcome-first: "build me a dashboard" must produce shippable, designer-grade output by default. Competitive research (v0/Lovable/Bolt system prompts, skills-market scan) located the unowned territory: surface-level outcome recipes, ready-to-ship theme presets, and stack-agnostic composition intelligence inside the user's own codebase. Brand abstraction constraint reaffirmed — recipes describe patterns with exact values, never by product name.

**New:**

- `references/recipe-dashboard.md` — first outcome recipe. Three named compositions (Overview / Command / Analytics) selected by persona + 60-second decision, exact shell spec, component inventory wired to existing contracts, strict build order (tokens → shell → hero → states → keyboard → finish), and a 10-item acceptance bar defining "would a designer retouch this?".
- `references/themes.md` — four named production token presets (Graphite / Porcelain / Carbon / Signal): full OKLCH neutral ramps, accent + semantic colors, type, radius profile, shadows, motion tokens; light and dark both intentional; APCA verification rule; preset-choice table keyed to brief language.
- `commands/craft.md` — `/craft <surface>` one-shot pipeline: inputs (or silent defaults) → composition → build order → acceptance bar enforced before reporting. 19th command.
- 6 new eval scenarios: outcome requests ("build me a dashboard", Spanish variant), anti-slop remediation, no-token-system theming, plus 2 backend negatives — the first evals testing the skill's headline anti-slop/outcome claims.

**Fixed (fresh adversarial audit, 4 parallel reviewers):**

- `forms.md` — removed wrong `animation-timeline` recommendation for conditional fields (that property is scroll-driven animations); now transition + `interpolate-size: allow-keywords`.
- SKILL.md radius quick-start (4/8/12px) aligned to the tokens.md radius scale (6/10/14px, with pointer).
- Accent budget disambiguated: "one accent color, 3-5 placements of it" (color identity vs placement slot).
- Section spacing reconciled with inspiration.md observed range: 80-160px varied, cross-referenced.
- Animation Decision Ladder ceiling aligned with motion.md/finish-bar: ≤400ms (was <300ms, contradicting `--motion-slow: 400ms`).
- Brand-name regressions pruned: motion.md Sources (Material/Apple HIG/IBM Carbon dropped; WCAG 2.3.3 vs `prefers-reduced-motion` citation un-conflated), copy.md sign-in/log-in rule de-branded.
- modern-css.md freshness: `interpolate-size` and custom-property style queries marked Baseline 2025 (were "Chrome only / behind flag").
- dataviz.md: Okabe-Ito 8-value hex array added inline; viridis/cividis no longer attributed to Matplotlib.

**Closed out (remaining audit items):**

- Routing table now exposes all 19 commands: focused-pass commands annotated on their intent rows (`/typeset`, `/colorize`, `/audit`, `/clarify`, `/adapt`) and 5 new rows added (`/critique`, `/harden`, `/distill`, `/extract`, `/delight`). Previously 10 of 18 commands were invisible to agents routing through SKILL.md.
- 13 command descriptions rewritten from imperative instructions to trigger-condition form ("…. Use when <concrete user phrasings>"); 6 already compliant, untouched.
- Variant evals completed to the README-specified 20 queries each (were 15): each gains an outcome request, a cross-variant negative, a non-UI negative, and a Spanish-language query.
- Judgment fixes in SKILL.md: "all rules are universal" reconciled with When Rules Break; three-typeface exception registered (deliberate display/body/mono hierarchies); icon rule made project-first; "safe fonts" scoped to no-brand-font fallback.
- Silo cleanup: Cross-Refs footers added to sound.md and state-design.md; principles-catalog ↔ heuristics relationship stated; review.md internal path normalized; personas.md de-branded ("won't search for it").
- tokens.md "No exceptions" scoped (prototypes/standalone components exempt until a second surface appears); color.md tinted-neutral rule registers the achromatic-system exception; heuristics.md explains the wizard 5-step ceiling vs Miller's 7±2.
- `scripts/validate.mjs` now actually checks `argument-hint` on commands (the header comment claimed it; the code didn't).

**Knowledge ingest (component-anatomy pass):**

- `references/components.md` — new, 26th reference. Anatomy-level contracts distilled (in our own words, judgment-style) from an external component-design study: buttons (horizontal ≈ 2× vertical padding, desktop 32-40px vs touch 44-48px with the why, icon-left = action vs icon-right = destination semantics, height/font centering parity), menus (≤5 options = no dropdown, cut-item scroll affordance, searchable-sheet escalation, inline shortcuts), modals (verb-labeled buttons never Yes/No, three ways out, when a modal isn't warranted), search (no-results as a fork not a wall), content cards (grid-rhythm clamping, aspect-ratio consistency), nav bars (sticky plane separator values, variable-background contrast variants).
- `forms.md` — mark optional fields instead of required (with the inversion case), field width as content-length affordance, no inputs on translucent fills; required-asterisk anti-pattern upgraded accordingly.
- `responsive.md` — thumb-zone rule now carries the inversion: destructive/cancel actions deliberately outside easy reach.
- Rejected from the same source (conflicts with anti-slop core): gradient fills + inner shadows on product buttons, 60-30-10 palette framing (our 90% neutral + accent budget is stricter and stays). Pricing-psychology and hero-copy material parked for the v0.21 landing recipe.

**Knowledge ingest (logic-of-UI pass, second source):**

- `forms.md` — two of our own rules overturned with better arguments and rewritten as judgment calls: hints now go ABOVE the field (autofill menus and the mobile keyboard occlude below-field text while typing; errors stay below since they appear after typing), and the multi-step "Next" gate flipped to prefer always-enabled + validate-on-press (disabled buttons can't explain themselves and break assistive tech). The optional-vs-required marking rule rewritten to present both schools (mark optional minority vs mark both) with the real invariants: never rely on intro text, asterisks black never red, skip marking in single-field forms. New Field Layout section: single-column rule with the paired-fields exception, labels-above within 16px, selection-widget ladder by option count (2-5 radios → 6-10 contextual → >10 autocomplete → 1000+ cascading fields), steppers for numeric nudges, checkbox (on-submit) vs toggle (immediate) semantics with the positive-phrasing "yes" test.
- `components.md` — button tier contracts (one primary per context, secondary ≥3:1 outline, tertiary underline as a11y requirement not decoration), avoid-disabled-buttons with the alternatives ladder, icon-weight matching, and a destructive-action friction ladder scaled to blast radius (undo toast → verb-labeled confirm + named items → type-to-confirm/checkbox gate before the button activates).
- `color.md` — dark-mode elevation via stepped transparency (white 6/8/12% over base; light mode mirrors with black 4-9%) instead of hand-picked grays, with the why: transparent fills stay consistent at every elevation.
- `typography.md` — two-weight discipline, 18px floor for long-form reading (14-16px is for UI labels), scale ratio matched to product type (1.125-1.2 dense apps, 1.333-1.618 marketing/editorial).
- `copy.md` — numerals + hybrid big numbers ("2.4M"), labels drop possessives ("Email" not "My email"), verb+noun button labels readable out of screen-reader context.
- `layout.md` — Alignment Discipline section: max 1-2 alignment types per section, baseline alignment for mixed sizes, middle truncation for shared-prefix items.
- Validations from the same source (no change needed): APCA Lc tiers match ours, sentence case, pure-black eye-strain rule, 3-part error messages, single-accent-for-interaction, conventional form field shapes.
- Second-tier pass from the same source: link affordance exclusivity + visible icon labels (components.md), front-loading/inverted pyramid + abbreviation tax (copy.md), Serial Position Effect (layout.md), multi-step cost-upfront + easy→hard ordering and submit-button left alignment (forms.md), one-hue five-role palette recipe + reusable state-overlay tokens (color.md).

## v0.19.0 (2026-05-03) — close the audit chapter

v0.16, v0.17, and v0.18 progressively prune+ground+scoped every reference file. v0.19 closes the audit chapter: a triage of the 18 slash commands confirmed the prior releases' brand-cleanup and grounding work propagated through, and `dashboard.md` (one of the 4 strongest references per the original audit, but the only Tier 1 file that hadn't received a Why-clause pass) was brought to the same standard as the v0.18-grounded files.

**Phase A — slash command triage:**

Applied the same lens used for v0.16 and v0.18 references to all 18 slash commands (adapt, animate, audit, brief, clarify, colorize, critique, delight, distill, extract, finalize, harden, heuristic, polish, shape, tokens, typeset, unhappy). Categories swept: stale references (any `references/foo.md` mention where `foo.md` no longer exists or has been renamed), brand-name attributions used as design exemplars, vague intensifiers in operative instructions, universals stated as laws without grounding, contradictions with the references the command invokes, frontmatter compliance (`description` + `argument-hint`), outdated knob references inconsistent with the v0.16 Knobs section.

**Verdict: every command is clean.** All 18 commands have valid frontmatter with `description` and `argument-hint`. All cited reference paths resolve. Zero brand-name design attributions. No vague intensifiers in operative instructions. No contradictions with the references invoked. No architecture drift from the v0.16/v0.17 decision spine. The one stragglar caught in v0.18 (`commands/heuristic.md` "Linear or Jira" → "any issue tracker") was the only carry-over; nothing else slipped through.

The clean verdict is itself the finding worth recording: the v0.16/v0.18 brand-cleanup and grounding work is uniform across both `references/` and `commands/`. No follow-on housekeeping required for the commands as a group.

**Phase B — `dashboard.md` grounding:**

`dashboard.md` scored 9/10 in the original v0.16 audit (one of the four strongest files, alongside `inspiration.md`, `accessibility.md`, and `color.md`) and was preserved. v0.18 grounded six other references with Why-clauses citing named principles (Hick / Cleveland-McGill / colorblind statistics / acoustic physics / Tinker / etc), but `dashboard.md` was untouched. v0.19 brings it to the same standard.

Seven dashboard rules gained Why-clauses or When-it-breaks notes:

- **Date range selector universal** — Why: time-series without an interactive range silently encodes a default-window assumption that becomes wrong for power users; the dashboard becomes a screenshot. When it breaks: real-time monitoring with fixed last-N-minutes window — the range is the affordance, not the picker.
- **Never 4+ identical metric cards** — Why: uniform grids trigger the AI-template tell (variety signals editorial decision; uniformity signals defaulted-out) and fail the squint test. Cross-references the Signal-to-Noise Hierarchy section.
- **Never green/red arrows on change values** — Why sharpened: a 30% increase in costs is positive by sign and bad by goal; the green arrow encodes the wrong story. Render magnitude in neutral and let user interpretation supply meaning. When it breaks: trading surfaces where positive/negative is universally tied to goal — match the user's domain, don't fight it.
- **Never pie charts, never 3D charts** — Why: pie wedges fail Cleveland-McGill perceptual ranking (angle is below position); 3D depth occludes data and foreshortens position-based comparison. When it breaks: two-segment donut with center label for binary proportions (used vs free) — only one comparison to make.
- **Never rainbow palettes for multi-series** — Why: hue does not encode ordering; readers cannot rank red vs green by magnitude. Single-hue opacity ramps preserve perceptual ordering and remain colorblind-safe. Cross-references `dataviz.md`.
- **Never uppercase table headers** — Why: uppercase removes the lowercase letterforms that aid scan-pattern recognition; users read uppercase ~13-20% slower than sentence case (Tinker 1969). Reads as decorative-template, not data-functional.
- **Never solid primary buttons in a toolbar** — Why: a toolbar holds 5-15 tertiary actions; each solid primary button competes for the user's primary-action attention budget. Hick's Law applied to visual weight — the dashboard's actual primary action gets buried.

Strong sections preserved verbatim: Signal-to-Noise Hierarchy (the squint-test treatment, the 4-tier model, the "grid of 8 KPI cards with equal weight" anti-pattern, and the per-dashboard ranking decisions checklist) and Chart Type Decision Matrix (Cleveland-McGill-grounded mapping from data story to chart type).

**Coverage now uniform:** every reference file in the skill — including the four originally-strongest — has been grounded with named principles, scoped universals, and When-it-breaks notes where they apply. No reference sits at "rules without judgment" anymore.

**Validation:** 69/69 markdown link + frontmatter checks pass. Sync mirrored 4 source skills + 18 commands across 5 harnesses; 110 directories written. Brand sweep clean. Detector unchanged at v0.5.0 (33 rules).

**This closes the audit chapter.** v0.16 fixed the floor by cutting filler and grounding existing rules. v0.17 added the ceiling — durable artifacts (`.ui-craft/brief.md`, token spine) and the 10-pass finishing protocol with `/finalize`. v0.18 propagated the grounding across all remaining references. v0.19 confirmed the commands inherited the cleanup and brought the last unconverted reference to standard. The skill's structural shape — Discovery → `/brief` → `/tokens` → build → `/finalize` → ship — sits on top of a uniformly grounded foundation.

**Next iteration should not be more audit.** The marginal returns on more meta-design have flattened. The next leverage is real-world dogfooding — using the skill on actual projects, recording where it produces friction or weak output, and iterating on lived experience rather than on more rules. Possible v0.20+ candidates: detector ↔ `/finalize` JSON integration, `/hierarchy` standalone command (extracts Pass 1 of finish-bar) if the use case proves real, or content additions driven by what dogfooding surfaces.

---

## v0.18.0 (2026-05-03) — remaining references audited + principles catalog

v0.16 fixed the floor and v0.17 added the ceiling. v0.18 finishes the prune+ground+scope sweep across the references that escaped v0.16, and adds a worked-example bank for the principles workshop in `/brief`.

**Triage audit (Phase 1):**

Same lens as v0.16 (dev POV + designer POV) applied to seven references that had not been audited: `state-design.md`, `dataviz.md`, `ai-chat.md`, `forms.md`, `modern-css.md`, `responsive.md`, `sound.md`. Verdicts:

- **FIX (large):** `modern-css.md` — six "### Rules" sections without principle-to-rule justification, intro that blurred scope, syntax dumps without decision context.
- **FIX (medium):** `dataviz.md` — Never-defaults rules without inline citations to Cleveland-McGill / Tufte / colorblind statistics; one commercial-product palette name.
- **FIX (medium):** `forms.md` — validation debounce without grounding, "never show 20 fields" without scope, debounce-vs-debounce duplication that confused readers.
- **POLISH:** `responsive.md` — breakpoint strategy section internally contradictory, side-nav universal not scoped, generic Nevers that weren't responsive-specific.
- **POLISH:** `sound.md` — three rules labeled "Always" / "Critical" without explaining why; accessibility rules without caveat about the `prefers-reduced-motion` proxy.
- **POLISH:** `ai-chat.md` — logical contradiction in feedback-controls rule ("every" + "optional"), one vague state-table entry.
- **LEAVE:** `state-design.md` — already strong, scored 9/10 on both axes.

**Phase 2 — fixes (six files edited in parallel):**

- **`modern-css.md`** (434 → 423 lines) — every "### Rules" section gained a 2-3 line principle paragraph above it (View Transitions snapshot mechanism, Scroll Timelines compositor thread, Anchor Positioning declarative fallback chains, `interpolate-size` allow-keyword opt-in, `color-mix()` source-of-truth derivation, `transition-behavior: allow-discrete` for `display: none` exit). Intro rewritten with a crisp scope sentence. View Transitions decision tree added (when DOM identity preserves vs. when use `@starting-style` instead). Anchor Positioning kept and grounded (replaces JS-driven popover positioning, no coordinate math, no resize observers). CSS Nesting cut entirely (pure syntax with no design pattern).
- **`dataviz.md`** (193 → 196 lines) — every rule in Never-defaults gained inline citation: pie-chart limit cited to Cleveland-McGill angle hierarchy, rainbow palette cited to hue-has-no-order plus colorblind prevalence, 3-D charts cited to volume-ranking + occlusion. Colorblind statistic now cites Birch 2012 and Sharpe et al. 1999. Tableau 10 commercial palette name removed (replaced with academic Okabe-Ito, which is colorblind-safe and the stronger recommendation anyway).
- **`forms.md`** (160 → 169 lines) — validation debounce grounded in cognitive load (jittery feedback breaks typing flow, 300ms is the perceived "after I stopped" threshold). "Never show 20 fields" scoped to mobile multi-step forms with Hick's Law citation; desktop tolerates higher density when scan structure is clear. New `## Debounce Timings` section disambiguates validation debounce (300ms per-field) from autosave debounce (1-2s per-form) — same word, different mechanisms. "Destructive Actions Inside Forms" trimmed from 6 bullets to 3 + cross-reference to `copy.md`.
- **`responsive.md`** (150 → 160 lines) — Breakpoint Strategy section split into two clearly separated subsections: "Content-Driven (Preferred)" with container queries as the preferred mechanism, and "Device Reference (Fallback)" for integrating with existing systems. Side-navigation rule scoped to all three breakpoint contexts (always-visible desktop / icon-rail tablet / drawer mobile). Never section trimmed from 8 generic items to 4 responsive-specific ones (don't hide core functionality on mobile, don't assume touch-only on mobile, don't forget landscape, don't ship horizontal scroll without affordance).
- **`sound.md`** (143 lines, no change in count — additions balanced by Parameters consolidation) — exponential decay grounded in acoustic physics (linear decay creates an audible click; exponential mimics natural decay). `prefers-reduced-motion` rule expanded with caveat (proxy is imperfect; provide independent sound toggle). Single AudioContext rule grounded in browser limits (typically 6 instances per page) and timing synchronization across rapid-fire UI feedback.
- **`ai-chat.md`** (158 lines, no change) — feedback controls contradiction fixed (every AI response gets *visible* feedback controls; user *interaction* with them is optional). Idle state row tightened (starter prompt carousels only when tested against a control — no "what AI thinks users want to ask" pattern).

**Phase 3 — `references/principles-catalog.md` (NEW, 299 lines):**

A worked-example bank of 42 opinionated design principles across 8 product categories: Developer Tools (6), Consumer Apps (6), Finance / Regulated (5), Creative Tools (5), Data Analytics (5), Collaborative Tools (5), AI / Streaming Surfaces (5), Public-facing Forms (5). Each principle has four parts: title (4-7 words), statement (1 line), the design implication it produces (the change in product behavior), and an opposing principle it rules out (the contrast that proves it's opinionated).

Strongest examples per category: "Show the data, not the design" (developer tools), "The empty page is the customer" (consumer apps), "Wrong is worse than late" (finance), "The canvas is sacred" (creative tools), "One number per screen" (data analytics), "Conflict is expected, not exceptional" (collaborative), "Streaming is a state, not a transition" (AI surfaces), "Defaults are decisions" (forms).

The catalog ends with an "Anti-principles" section listing platitudes that masquerade as principles ("Be user-friendly", "Design with empathy", "Make it beautiful") — each one fails the "would anyone disagree?" test. Slogans go in marketing copy, not in `.ui-craft/brief.md`.

**Phase 4 — wiring:**

- `commands/brief.md` — the principles workshop branch now loads `references/principles-catalog.md` first, surfaces 2-3 principles from the closest product category as conversation seeds, then asks the user which resonate or which they'd flip. Seeds prime; the workshop refines.
- `SKILL.md` Tier 2 — new row for `principles-catalog.md` with the gate note "Load during `/brief` principles workshop branch as conversation seed." Not promoted to Tier 1 (not always-loaded) and not added to the Routing intent table (sub-resource, not a directly-invoked intent).

**Carry-over housekeeping:** one stale brand reference in `commands/heuristic.md` ("PM can paste it into Linear or Jira") cleaned to "any issue tracker", consistent with the same fix applied to `references/heuristics.md` in v0.16.

**Validation:** 69/69 markdown link + frontmatter checks pass (unchanged from v0.17 — no new commands, just a new reference). Sync mirrored 4 source skills + 18 commands across 5 harnesses; 110 directories written, none broken. Brand sweep clean across all design-attribution surfaces; remaining mentions are CSS keywords (`linear` easing in code blocks, `cursor` as input device or UI element), technical interop disclaimers (Vercel AI SDK / LangChain / CopilotKit), Figma as the consumer of the JSON token export in motion.md, and academic palette citations (Okabe-Ito, ColorBrewer, viridis).

**Detector unchanged** — `ui-craft-detect@0.5.0`, 33 rules. v0.18 is a content release.

**Coverage now:** every reference file in the skill has been audited and either pruned, grounded, scoped, or confirmed strong. The decision spine (`brief.md` + `tokens.md`) and ceiling (`finish-bar.md` + `/finalize`) sit on top of a uniformly grounded floor. The principles catalog turns `/brief`'s principles workshop from "name your principles" (often stuck) into "react to these archetypes" (productive).

---

## v0.17.0 (2026-05-03) — decision spine + finish bar + feedback hierarchy

v0.16 fixed the floor by pruning filler and grounding rules in principles. v0.17 lands the ceiling: durable artifacts that anchor design decisions across sessions, a 10-pass finishing protocol with measurable criteria, and a feedback hierarchy that prevents polish-before-fix.

**New decision spine — `references/brief.md` + `commands/brief.md`:**
- Codifies the format of `.ui-craft/brief.md`: a per-project durable artifact with five required sections — product purpose (1 sentence), primary user (1 sentence), 3-5 opinionated principles ranked for conflict resolution, success metric for the surface (observable behavior, not business outcome), explicit out-of-scope list. The brief survives across sessions and is the first thing the agent reads when working on any UI.
- The principles workshop teaches how to derive opinionated principles instead of platitudes: the "would anyone disagree?" test, the past-decisions check, the conflict-ranking rule, the "trim to 3-5 or none of them are load-bearing" constraint.
- `/brief` is the slash command that detects existing `.ui-craft/brief.md`, walks the user through the five sections in a single compact prompt (not five separate questions), and writes the file after confirmation. Refuses vague input — demands substance.
- Discovery Phase Step 1 now checks for `.ui-craft/brief.md` as its first action; recommends `/brief` when absent for non-trivial projects.

**New token spine — `references/tokens.md` + `commands/tokens.md`:**
- The 3-layer token contract: primitive tokens (raw values, named for what they are — `--gray-500`, `--space-md`), semantic tokens (contextual meaning, references primitives — `--text-primary`, `--surface-raised`, the layer that switches between modes), component tokens (specific usage, on demand per component). Layer 3 is created only when variant explosion forces it, never preemptively.
- Both light AND dark are intentionally crafted, never inverted. The intentional-dark test: dark mode rebalances the entire surface stack (canvas sits at gray-950 with hue tint, accents desaturate ~10-15% in OKLCH chroma, shadows fall back to border tints because shadow-on-dark is invisible), not just `gray-900` swapped to `gray-100`.
- All seven required token categories codified: color, spacing, type, radii, shadows, motion, z-index. Each cross-references the appropriate existing reference (`color.md`, `layout.md`, `typography.md`, `motion.md`) instead of duplicating scales.
- `/tokens` audits an existing system for completeness or proposes a minimal spine when absent; never overwrites without confirmation; suggests the right destination per stack (`globals.css` for Tailwind, `theme.ts` for CSS-in-JS, `tokens.css` for vanilla, `design-tokens.json` for cross-platform).

**New finish bar — `references/finish-bar.md` + `commands/finalize.md`:**
- Ten finishing passes, each with a Goal, measurable Criteria, How-to-verify procedure, and explicit When-it-doesn't-apply scope. The passes: (1) Hierarchy — squint test passes, P/S/T/Q named, ≥1.5x ratio, one focal point; (2) Type system — ≤3 weights per viewport, tabular nums on data, OpenType active, line-length 50-75ch on prose; (3) Surface stack — ≥3 distinguishable elevation levels, dark mode intentional, `color-scheme` declared; (4) Spacing rhythm — within < between < section invariant at every nesting level, token-based; (5) Iconography — single family, weight matched to type, geometry coherent; (6) State coverage — idle / loading / empty / error / success / partial / conflict / offline all explicitly designed; (7) Motion tuning — durations within scale, motion-gap audit clean, custom curves where character matters, reduced-motion honored; (8) Microcopy voice — verbs consistent, no placeholders, specific CTAs, errors name the operation; (9) Pixel honesty — sub-pixel borders via `color-mix`, shadow stacks 2-3 layers, varied corner radii by element role; (10) Data formatting — tabular nums, abbreviated counts, relative time where recency matters, currency localized.
- `/finalize` is the orchestrator: brief check (gates the whole flow), detector run, token audit, all 10 passes in order, feedback hierarchy filter on findings, output as severity-ranked report with explicit ship verdict. Knob-aware: `CRAFT_LEVEL ≤ 6` runs only the load-bearing passes (1, 6, 8); explicit invocation overrides.
- Findings are output, never auto-fixed. The pre-ship gate is for verdict, not for changes.

**New feedback hierarchy in `references/review.md`:**
- A new `## Feedback Hierarchy` section prepended to review.md, evaluated in order: Value (does this solve the problem the user came for?) → Ease of Use (can the user accomplish the task?) → Delight (does it feel polished?). Aesthetic feedback that arrives before Value and Ease is feedback misallocation.
- Explicit triage rule: if Value findings exist, surface them as the first section of the report and recommend deferring all Delight findings until Value is resolved. **Do not include Delight findings in a report where Value is failing — it dilutes the signal.**
- Cross-referenced from `/finalize` Step 5 so the orchestrator applies the same hierarchy.

**Screenshot-mandatory protocol:**
- `commands/critique.md` and `commands/audit.md` both gain a `## Step 0: Visual capture (mandatory)` section. Code-only review is insufficient. Try Playwright MCP first, then Browser DevTools / Chrome MCP, then other browser automation, then ask the user. If the user declines screenshots, the report runs anyway but is marked `[CODE-ONLY REVIEW — visual issues not assessed]` so the limitation is explicit.
- Visual capture covers desktop (1280×800), tablet (768×1024), mobile (375×812), and dark mode if supported.

**SKILL.md integration:**
- Routing intent table gains three new rows (pre-build brief, pre-build tokens, pre-ship finalize), placed at logical workflow stages.
- Reference Files Tier 1 prepended with `brief.md` and `tokens.md` — they are foundational, read before anything else. `finish-bar.md` added to Tier 2 with the gate note "load on `/finalize` or CRAFT_LEVEL ≥ 8".
- Discovery Phase Step 1 first action is now the brief check, with token-completeness recommendation at the end.

**Carry-over from v0.16:** four files still referenced the deleted `references/performance.md` — `commands/audit.md`, `commands/harden.md`, `skills/ui-craft-dense-dashboard/SKILL.md`, `skills/ui-craft-editorial/SKILL.md`. All four updated to reference `motion.md` Rendering Performance section (where the animation-relevant content was folded in v0.16) or to drop the bullet entirely where the reference was redundant. One stragglar brand reference in `commands/critique.md` (an "inspiration gap" line listing dub.co / linear.app / vercel.com) cleaned to reference observed pattern archetypes from `inspiration.md` instead.

**Validation:** 69/69 markdown link + frontmatter checks pass (was 63 — six new checks for the three new commands and three new references). Sync mirrored 4 source skills + 18 commands across 5 harnesses (`.codex`, `.cursor`, `.gemini`, `.opencode`, `.agents`); 110 directories written, none broken. Brand sweep clean across all design-attribution surfaces; remaining mentions are CSS keywords (`linear` easing function, magnetic-cursor effect), technical interop (Figma JSON token export, Playwright/Chrome MCP server names), and source citations (Mailchimp Style Guide and Shopify Polaris in `copy.md` footer).

**Detector unchanged** — `ui-craft-detect@0.5.0`, 33 rules. v0.17 is a content release.

**Floor + ceiling now both solid.** v0.16 cut filler and added judgment to existing rules; v0.17 adds the durable artifacts and finishing protocol that turn the skill from "won't ship slop" into "ships with intent". Future releases can extend the catalogue (more references audited and grounded; possible new commands for hierarchy planning or design-system documentation), but the structural shape — Discovery → brief → tokens → build → finish bar → feedback hierarchy → ship — is in place.

---

## v0.16.0 (2026-05-03) — prune + promote + judgment layer

A user-driven audit revealed the skill taught rules but not judgment, and that strong material was buried under filler. Devs were applying rules mechanically and producing a different kind of slop ("template-clone" instead of "AI-generic"). This release reshapes the floor before adding any new ceiling.

**Pruned:**
- `references/performance.md` — **deleted**. ~60% of its content (animation pipeline, FLIP, layer promotion, blur cost, scroll-linked motion, CSS variable animation gotcha) was animation discipline, not generic web perf — those folded into `motion.md` as a new `## Rendering Performance` section. The remaining ~40% (image preloading, virtualization, preconnect, `font-display`, mutation latency targets, Web Workers) was out of design scope and intentionally cut.
- `references/layout.md` — **rewritten** from a tool-and-token dump (Flexbox vs Grid, z-index, shadows) into a composition guide. Now leads with Gestalt grouping principles, the spacing rhythm invariant (within < between < section), the squint test with its perceptual basis (low-pass spatial frequency filter), measurable hierarchy ratios (1.5x minimum between adjacent levels), and composition strategies (symmetry/asymmetry, focal point, optical center 5–8% above geometric). Tools and tokens demoted to a reference appendix.
- `references/motion.md` — **trimmed and grounded**. Every easing in the scale gained a perceptual-basis sentence (why `ease-out` matches gravity, why `linear` reads as robotic). Duration scale gained band annotations (<100ms instant, 100–250ms transition, 250–400ms deliberate, 400ms+ storytelling). Spring vs Tween section gained a stiffness/damping intuition paragraph + per-preset feel captions. The "bounce when used" hedge replaced with explicit anti-pattern + scoped exception. New `## Motion Gap Audit` section (the most common motion failure is missing motion entirely — UI state changes that snap with no transition).
- `references/typography.md` — **scoped**. Heuristics that were stated as universal laws ("tracking-tight ≥24px") are now scoped to actual valid contexts (Latin sans-serif display only; never on serifs or non-Latin scripts) with `When it breaks` notes. Line-height bucketed by script and role. ALL CAPS `Never` softened with explicit acceptable contexts (small category labels, regulatory text, utilitarian aesthetics).

**Promoted:**
- `references/inspiration.md` — **rewritten**. Restructured from a per-brand analysis (Dub.co / Cursor.com / Linear.app / Vercel.com / Stripe.com) into category-organized pattern observation. Six hero-section archetypes named by structural characteristics, not by source. Signature details grouped by pattern type (cards, typography, color, microinteraction, spacing). The "what mature interfaces NEVER do" section preserved verbatim — it remains the highest-signal content in the skill. Reference token values (type scales, shadow stacks, color tinted-neutrals, motion timings) preserved with anonymized provenance — designers steal the numbers, not the brand attribution.
- `SKILL.md` — **routing tiered.** The flat `## Reference Files` table replaced with four explicit tiers: Tier 1 *Required before writing UI* (`inspiration.md`, `accessibility.md`, `color.md`, `layout.md`), Tier 2 *Surface-specific* (`dashboard.md`, `forms.md`, `ai-chat.md`, `review.md`), Tier 3 *Foundations* (`typography.md`, `motion.md`, `modern-css.md`, `responsive.md`, `copy.md`, `sound.md`), Tier 4 *Opt-in* (`stack.md`, `heuristics.md`, `personas.md`, `state-design.md`, `dataviz.md`). The audit found the strongest material was buried — tiering surfaces it.

**Judgment layer (the structural change):**
- New `### When Rules Break` subsection inside Core Rules, right after `The Craft Test`. Five inversions documented (ALL CAPS exception for small labels, multi-tenant accent exception, two-segment donut exception, emoji-as-content vs emoji-as-icon, branded-marketing gradient exception) plus the general principle: every rule encodes a default that prevents the most common failure mode; when context inverts the failure mode, the rule may invert too.
- Strong rules in `Quick Start: Top 12` and `The Craft Test` gained `Why:` clauses citing the underlying principle (Hick's Law for accent budget, AI-template tell for content-type variety, etc.). Rules now teach the reasoning, not just the verdict.
- **Discovery / Knobs contradiction resolved.** Quick Start #0 ("ask before assuming") and the Knobs defaults (CRAFT 7 / MOTION 5 / DENSITY 5) used to contradict — when did the agent ask, when did it assume? Knobs are now explicitly **fallback defaults applied only when the user declines to specify**. Ask first; fall back only on opt-out.
- Vague intensifiers replaced with explicit scope: "if present" → "if any token system is present"; "per viewport" → "per above-the-fold viewport"; "when used" → named context.

**Brand de-attribution:** every product name (Linear, Vercel, Stripe, Cursor, Dub, Notion, Figma, Bloomberg, Substack, GitHub, Raycast, Clay) was removed from `SKILL.md` and `inspiration.md`. The patterns and numbers were preserved; only the attribution changed. Style choices in Discovery Step 2 now described by structural characteristics, not by brand exemplars.

**Validation:** 63/63 markdown link + frontmatter checks pass. Detector unchanged (`ui-craft-detect@0.5.0`, 33 rules). Sync mirrored 4 source skills + 15 commands across 5 harnesses (`.codex`, `.cursor`, `.gemini`, `.opencode`, `.agents`); 95 directories written, none broken.

**Not in this release** (deferred to v0.17): finish-bar protocol, decision spine (brief + token spine + hierarchy phase), `/finalize` command. The audit showed those would have added ceiling on a weak floor. The floor is now solid; the ceiling can land next.

---

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
