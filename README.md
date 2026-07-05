# UI Craft

**Ship designer-grade UI by default.** A design engineering system for AI coding agents — install it as a skill or as the `ui-craft` CLI, and your agent starts designing like it has taste. Ask for a dashboard, get one you'd put in production. Not gradient cards and bounce animations.

**Website:** [skills.smoothui.dev](https://skills.smoothui.dev)

![UI Craft](assets/og.png)

## Ask for a surface. Ship it.

```
/craft dashboard
```

Three questions (or none — the defaults are strong), a named composition, a production theme preset, and a build that must pass a **10-item acceptance bar** before it reports done: *"would a designer retouch this?"* If a box fails, it isn't done.

For everything else — reviews, animations, forms, polish — the skill routes by intent: just describe what you're building.

**New here?** Run `/start` — it reads your project (framework, tokens, brief, existing UI) and tells you what ui-craft can do right now, then points you at the right next step.

## What it does

UI Craft gives AI coding agents the design knowledge they're missing. Not templates. Not component libraries. Actual craft knowledge — opinionated rules about how interfaces should look, move, and feel — plus the tooling to verify the result. Stack-agnostic by design.

Every UI gets tested against a single question: *"Would someone believe AI made this?"* If yes, it starts over.

### Three ways to use it

You don't have to learn any of it to benefit. It grows with you.

| Layer | You do | You get |
|-------|--------|---------|
| **1 · Just install it** | Nothing — ask for UI the way you always do | The agent designs with taste: real hierarchy, system tokens, no AI slop. Same prompt, shippable result. |
| **2 · Drive it** | Run `/start` to see your options, then a slash command (`/craft`, `/sddesign`, `/finalize`, …) | Focused passes — build a surface, run a scored critique, gate a ship. 25 commands, one lens each. |
| **3 · Verify it** | Wire the agents / MCP / CLI into review or CI | Independent design + a11y review, a deterministic 0-100 quality score, an anti-slop gate on every commit. |

**Start at Layer 1.** Most people never leave it — that's the point. Layers 2 and 3 are there the day you want them.

**What makes this different:** the only AI design system that produces a **scoreable, defensible critique** — Nielsen's 10 usability heuristics × 6 classic design laws (Fitts, Hick, Doherty, Cleveland-McGill, Miller, Tesler) × 5 persona walkthroughs, with every finding tagged by business impact (`blocks-conversion` / `adds-friction` / `reduces-trust` / `minor-polish`). Paste the scorecard straight into any issue tracker.

## Same prompt, different result

<table>
  <tr>
    <td><strong>Without UI Craft</strong><br/><img src="assets/screenshots/hero-without.png" alt="Hero built without UI Craft" width="100%" /></td>
    <td><strong>With UI Craft</strong><br/><img src="assets/screenshots/hero-with.png" alt="Hero built with UI Craft" width="100%" /></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/dashboard-without.png" alt="Dashboard built without UI Craft" width="100%" /></td>
    <td><img src="assets/screenshots/dashboard-with.png" alt="Dashboard built with UI Craft" width="100%" /></td>
  </tr>
</table>

More before/after comparisons on the [landing page](https://skills.smoothui.dev).

## Install

### CLI — recommended (cross-harness, installs the whole system)

A single static Go binary that detects your AI coding harness and wires skill+commands, MCP gates, review agents, and design-memory into its native config in one interactive pass. No Node required at install time.

**macOS / Linux:**
```bash
brew install --cask educlopez/tap/ui-craft
```

**Windows (Scoop):**
```powershell
scoop bucket add educlopez https://github.com/educlopez/scoop-bucket
scoop install educlopez/ui-craft
```

**Then run:**
```bash
ui-craft install
```

`ui-craft install` detects Claude Code / Cursor / Codex / Gemini / OpenCode, walks you through à-la-carte component selection (interactive TUI or `--yes` for CI), and writes each chosen component into that harness's native config. All writes are idempotent, backed up before they happen, and rolled back automatically on any failure.

**What rides which install?**

| Component | CLI | Claude Code plugin | `npx skills add` |
|-----------|:---:|:------------------:|:----------------:|
| Skill + commands | All harnesses | ✅ | All harnesses |
| MCP gates (`check_anti_slop`, `tokens_lint`, `acceptance_bar`, `score_ui`) | All MCP-capable harnesses | ✅ auto-wired | Manual `.mcp.json` |
| Review agents (`design-reviewer`, `a11y-auditor`) | Claude Code + OpenCode | ✅ | — |
| Design memory (`.ui-craft/`) | ✅ (component opt-in) | — | — |

**Full reference docs:** [skills.smoothui.dev/docs](https://skills.smoothui.dev/docs).

### Claude Code plugin — alternative (skill + commands + agents + MCP, no CLI needed)

One command installs the skill, all 25 slash commands, the 2 review agents, and the MCP quality-gate server — auto-wired, no `.mcp.json` editing:

```
/plugin marketplace add educlopez/ui-craft
/plugin install ui-craft
```

The plugin bundles a `.mcp.json` (`npx -y ui-craft-mcp`), so the deterministic gates register automatically on install — first launch fetches the package via `npx`. This uses Claude Code's own plugin system, so it's not affected by the global-path issue noted below.

### Agent Skills — alternative (skill + commands, any harness)

```bash
npx skills add educlopez/ui-craft
```

Works with any agent that supports the [Agent Skills](https://skills.sh) spec. Each agent gets a pre-built mirror under a dedicated folder (`.codex/`, `.cursor/`, `.gemini/`, `.opencode/`, `.agents/`). The main `ui-craft` skill lands as a peer skill; each slash command is materialized as its own sub-skill in non-Claude harnesses (other agents trigger them by intent: "audit my UI", "polish this page").

> [!note]
> **Using `npx skills add -g` with Claude Code?** The skills CLI installs global skills to `~/.agents/skills`, but Claude Code reads `~/.claude/skills` ([vercel-labs/skills#693](https://github.com/vercel-labs/skills/issues/693)). If the skill isn't picked up, use the CLI or plugin install above, install per-project (drop `-g`), or symlink it:
> ```bash
> ln -s ~/.agents/skills/ui-craft ~/.claude/skills/ui-craft
> ```

### Other ways

```bash
# Clone
git clone https://github.com/educlopez/ui-craft.git ~/.skills/ui-craft
# Git submodule
git submodule add https://github.com/educlopez/ui-craft.git .skills/ui-craft
```

## CLI

The `ui-craft` binary is a single static Go binary (distributed via Homebrew and Scoop). It is the lifecycle and cross-harness wiring core for the system.

Run `ui-craft` with no arguments to open the **interactive hub** — a full-screen menu with an async update check that routes into install, upgrade, backups, and uninstall. Every subcommand below also works directly for scripting/CI.

### Commands

| Command | Does |
|---------|------|
| `ui-craft` *(no subcommand)* | Open the interactive TUI hub: welcome menu + update check → Start installation · Upgrade · Manage backups · Managed uninstall. |
| `ui-craft install` | Detect harnesses, à-la-carte component selection, write configs. |
| `ui-craft update [harness]` | Re-apply all installed components at the new embedded version. |
| `ui-craft update [harness] --component <name>` | Re-apply one component only. |
| `ui-craft uninstall [harness]` | Remove managed blocks and wired components. |
| `ui-craft doctor` | Health check — verifies each harness install is coherent. |
| `ui-craft backup` | Snapshot all harness configs without installing. |
| `ui-craft backup list` | List existing snapshots. |
| `ui-craft backup pin <id>` / `unpin <id>` | Protect or unprotect a snapshot from retention cleanup. |
| `ui-craft rollback [harness]` | Restore latest backup for a harness. |
| `ui-craft self-update` | Upgrade binary to latest GitHub release (or prints the correct package-manager command when installed via Homebrew/Scoop). |
| `ui-craft version` | Print the binary version. |
| `ui-craft version --check-parity` | Verify the Claude Code install matches the expected surface. |

### Key flags for `install`

| Flag | Effect |
|------|--------|
| `--harness <name>` | Target a specific harness (`cursor`, `codex`, `gemini`, `opencode`) instead of auto-detecting. |
| `--components <list>` | Comma-separated components to install (`skill-commands`, `mcp-gates`, `review-agents`, `design-memory`). |
| `--dry-run` | Preview all planned writes without touching any file. |
| `--yes` | Non-interactive — skip TUI prompts and apply defaults. |

### Scripting flags (global)

| Flag | Effect |
|------|--------|
| `--json` | Machine-readable JSON output. Implies non-interactive. |
| `--quiet` | Suppress non-essential output; print only errors and a final one-line outcome. |

### Safety

Every install snapshots existing configs to `~/.ui-craft/backups/` (tar.gz, SHA-256 deduped) before writing. Any mid-plan failure rolls back the whole plan. `rollback [harness]` restores from the latest snapshot at any time. State is persisted to `~/.ui-craft/state.json` so `update` can replay your choices at the new version without re-prompting.

## Discovery phase

Before building anything, the skill analyzes your project for existing design decisions — CSS variables, Tailwind config, font imports, component themes. If your project already has a design system, it respects it. If not, it asks 4 quick questions (style, accent color, font, optional animation stack) so it never defaults to generic blue/Inter.

## Knobs

Three numeric knobs (1-10) that the skill asks about during Discovery. They change behavior, not just tone.

| Knob | 1 | 10 |
|------|---|----|
| **CRAFT_LEVEL** (default 7) | ships fast, skips Polish Pass | pixel-perfect, compound details applied |
| **MOTION_INTENSITY** (default 5) | hover states only | scroll-linked, page transitions, magnetic cursor |
| **VISUAL_DENSITY** (default 5) | whitespace-heavy editorial | dashboard-dense |

At `MOTION_INTENSITY 8+` the skill loads [`references/stack.md`](skills/ui-craft/references/stack.md) only if the user opts into Motion / GSAP / Three.js during Discovery.

## Style variants

Three opt-in sibling skills that pre-commit to a style and lock the knobs to matching values. Agents pick them when the user mentions a specific aesthetic or product reference.

| Variant | Triggers on | Knobs locked | Style anchors |
|---------|-------------|--------------|---------------|
| `ui-craft-minimal` | "minimal", "Linear-like", "Notion-like", "whitespace-heavy" | CRAFT=8 / MOTION=3 / DENSITY=2 | Monochrome + one accent, Inter/Geist, hairline borders |
| `ui-craft-editorial` | "editorial", "magazine", "Medium-like", "Substack-like", "long-form" | CRAFT=9 / MOTION=4 / DENSITY=3 | Serif display + humanist body, wide reading column, OpenType |
| `ui-craft-dense-dashboard` | "dashboard", "admin panel", "Bloomberg-like", "Retool-like" | CRAFT=7 / MOTION=3 / DENSITY=9 | IBM Plex + mono numbers, semantic palette, 4/8px grid |

Each variant defers to the main `ui-craft` skill for base rules and references — it only overrides knob defaults and adds style-specific guidance.

### Style presets

For playful and brutalist aesthetics (Clay / Gumroad / Duolingo / Arc-playful, Nothing-phone / Swiss-print / brutalist), see `examples/presets/playful.md` and `examples/presets/brutalist.md`. The main `ui-craft` skill applies these preset knob values + style overrides on top of the base rules when the user asks for those aesthetics.

## Slash commands

25 commands total — 23 single-lens passes, plus `/sddesign` (the pipeline that chains them) and `/start` (the front door).

**Front door:**

| Command | Does |
|---------|------|
| `/ui-craft:start` | **Run this first.** Reads the project (framework, tokens, brief, spec, existing UI) and reports what ui-craft can do right now, then routes you to the right next step. Read-only — no code changes. |

**Decision spine & finalize:**

| Command | Does |
|---------|------|
| `/ui-craft:brief` | Write or update the project's durable design brief at `.ui-craft/brief.md` — 5 required sections + principles workshop. Run before any net-new project. |
| `/ui-craft:tokens` | Audit or establish the 3-layer token spine (primitive → semantic → component). Both modes intentionally crafted, not just inverted. |
| `/ui-craft:finalize` | Pre-ship gate. Runs detector + brief/token check + the 10-pass finish bar + feedback hierarchy filter. Output only — no auto-fix. |

**Review & ship:**

| Command | Does |
|---------|------|
| `/ui-craft:heuristic` | **Signature move.** Scored critique — Nielsen 10 + 6 design laws + persona walkthroughs. Produces a Markdown scorecard with impact tags. No code changes. |
| `/ui-craft:audit` | Technical — a11y, performance, responsive. Prioritized findings table. |
| `/ui-craft:critique` | UX — hierarchy, clarity, anti-slop. No code changes. |
| `/ui-craft:polish` | Final pass — compound details that turn "done" into "crafted". |
| `/ui-craft:harden` | Production readiness — loading/empty/error states, i18n, offline, edge cases. |
| `/ui-craft:unhappy` | State-first pass — design every non-happy state (idle/loading/empty/error/partial/conflict/offline) before the happy path. |

**Plan & transform:**

| Command | Does |
|---------|------|
| `/ui-craft:sddesign` | **Full spec-driven pipeline.** brief → tokens → shape → craft → converge → ship. Writes `.ui-craft/spec.md`. Run when starting a net-new surface. |
| `/ui-craft:craft` | **One-shot surface build.** Outcome recipe pipeline — Craft Read + variance + signature bet → named composition → theme → build order → acceptance bar. Surfaces: `dashboard`, `landing`, `auth`; portfolios use landing recipe at variance 8. |
| `/ui-craft:redesign` | **Redesign without regression.** Audits the existing surface first, classifies what to preserve (brand, IA/SEO, content, conversion paths), picks refresh/reskin/rebuild scope, then modernizes. |
| `/ui-craft:shape` | **Wireframe-first.** ASCII layout + content inventory + state list + open questions before any JSX. Run when starting a new screen. |
| `/ui-craft:animate` | Add / fix motion. Honors `MOTION_INTENSITY` + chosen stack. |
| `/ui-craft:adapt` | Responsive pass — mobile, tablet, desktop, touch, safe areas. |
| `/ui-craft:typeset` | Typography pass — fonts, scale, tracking, micro-typography. |
| `/ui-craft:colorize` | Introduce color strategically — one accent, 3–5 placements, no decoration. |
| `/ui-craft:clarify` | UX copy — button labels, error messages, empty states, CTAs. |
| `/ui-craft:extract` | Pull repeated patterns into shared components and tokens. |
| `/ui-craft:remember` | Record a learned design constraint into `.ui-craft/brief.md` — corrections that should persist across sessions. |

**Taste dial:**

| Command | Does |
|---------|------|
| `/ui-craft:bolder` | Raise DESIGN_VARIANCE and motion amplitude — stronger composition, type, and signature without a full rebuild. |
| `/ui-craft:quieter` | Lower variance and motion — more restrained grids, type, and color. Honors `prefers-reduced-motion`. |
| `/ui-craft:distill` | Strip to essence. Cut every section that doesn't earn its space. Absorbs visual-weight reduction (softer type, less motion). |
| `/ui-craft:delight` | Add purposeful micro-interactions — copy first, animation last. |

## Four modes

The skill detects your intent and routes automatically.

| Mode | Prompt example | What it does |
|------|---------------|--------------|
| **Build** | "Build a pricing page" | Layout, typography, color, spacing, accessibility, responsive — all in one pass |
| **Animate** | "Add an entrance to this modal" | Picks the right easing, duration, and origin point |
| **Review** | "Review this component" | Audits for generic AI patterns, accessibility gaps, and missed details |
| **Polish** | "Polish this dashboard" | Finds the twenty small things that turn "done" into "crafted" |

## 32 domain references

| Domain | Covers |
|--------|--------|
| Craft intent | Craft Read, DESIGN_VARIANCE knob, signature bets, product + marketing build patterns, accent rotation when no brand. **Load before `/craft` or any full-surface build** |
| Dashboard recipe | Outcome blueprint: 3 named compositions (Overview / Command / Analytics), exact shell spec, build order, shippable acceptance bar. Run via `/craft dashboard` |
| Landing recipe | Marketing page compositions (product-forward / message-forward / proof-forward), section grammar, CTA hierarchy, acceptance bar. Run via `/craft landing` |
| Auth recipe | Sign-in/sign-up compositions (split panel / centered card), form contract, trust signals, acceptance bar. Run via `/craft auth` |
| Theme presets | 4 named production token stacks (Graphite, Porcelain, Carbon, Signal) — full OKLCH color, type, radius, shadow, motion; light + dark both intentional |
| Motion | Decision ladder, duration + easing token scales, interaction rules, choreography, motion budget, reduced-motion contract. Rendering performance (compositor, FLIP, scroll timelines, will-change lifecycle) |
| Layout | Spacing systems, optical alignment, layered shadows, visual hierarchy |
| Typography | `text-wrap: balance`, tabular-nums, font scale, curly quotes |
| Color | OKLCH, design tokens, dark mode, APCA contrast |
| Accessibility | WAI-ARIA, keyboard nav, focus management, touch targets |
| Modern CSS | View Transitions, Anchor Positioning, Popover, `<dialog>`, `interpolate-size`, `color-mix()`, scroll-driven, container queries |
| Responsive | Fluid sizing, mobile-first, touch zones, safe areas |
| Sound | Web Audio API, feedback sounds, appropriateness matrix |
| UX Copy | Voice / tone matrix, reading level, terminology, locale-aware strings, inclusive language, error/empty/CTA tactics |
| UI Review | Systematic critique methodology, anti-slop detection, Polish Pass |
| Dashboard | Signal-to-noise hierarchy (hero / supporting / context / deep-dive), sidebar, metric cards, data tables |
| Inspiration | Pattern archetypes from observed mature SaaS — hero archetypes, signature details by pattern type, what mature interfaces never do, reference token values |
| Brief | Durable design brief format — product purpose, primary user, 3-5 ranked principles, success metric, out of scope. Persists across sessions at `.ui-craft/brief.md` |
| Tokens | 3-layer token spine (primitive → semantic → component). Both modes intentional. 7 required categories with cross-refs |
| Finish bar | 10-pass finishing protocol with measurable criteria. Hierarchy / type system / surface stack / spacing rhythm / iconography / states / motion / microcopy / pixel honesty / data formatting |
| Principles catalog | 42 example principles across 8 product categories, seed material for the `/brief` workshop |
| Stack | Motion, GSAP, Three.js — decision tree, patterns, perf gotchas, anti-patterns (opt-in) |
| Heuristics | Nielsen's 10 + Fitts / Hick / Doherty / Cleveland-McGill / Miller / Tesler with 1-5 scoring rubric and impact framing |
| Personas | 5 archetypes (first-timer, power user, low-bandwidth, screen-reader, one-thumb) with walkthrough checklists |
| State design | Idle / loading / empty / error / partial / conflict / offline — design the unhappy path first |
| Data viz | Cleveland-McGill perceptual hierarchy, chart selection matrix, ColorBrewer + Okabe-Ito palettes, direct labeling, Tufte |
| AI / chat surfaces | Streaming contract, 7-state model, tool traces, citations, feedback affordances, generative UI, conversation layout |
| Forms | Validation timing, progressive disclosure, multi-step wizards, autosave, optimistic submit, field-specific patterns |
| Composition spec | `.ui-craft/spec.md` format — per-surface composition choice, layout skeleton, component inventory, state lattice, acceptance bar. Written by `/shape` Step 6, consumed by `/sddesign` and `/craft`. |

## Agents

Two read-only Claude Code plugin agents form the ui-craft **parallel verify team**. They complement the slash commands — they do not replace them.

| Agent | Invocation | Does |
|-------|-----------|------|
| **design-reviewer** | `ui-craft:design-reviewer` | Adversarial design critique — loads review rules, anti-slop signals, and Nielsen/design-law heuristics. Returns severity-tagged findings (Critical / Warning / Suggestion, `file:line`). No edits. |
| **a11y-auditor** | `ui-craft:a11y-auditor` | Accessibility audit — keyboard, focus-visible, APCA contrast, ARIA, touch targets, reduced-motion. Returns severity-tagged findings. No edits. |

Both agents are **read-only** (tools: Read, Grep, Glob) and run in a **fresh context**, making them suitable for dedicated review passes and PR audits where you want independent judgment uncontaminated by the build session.

### Parallel verify team

Delegate both agents simultaneously on the same diff or file for a full design + a11y sweep in one pass:

> Delegate `ui-craft:design-reviewer` and `ui-craft:a11y-auditor` together on [target]. Run both simultaneously. Each returns an independent severity-tagged findings table.

**When to use agents vs. commands:**

- **Agents** — fresh context, parallel, read-only. Best for final review passes, PR audits, and CI-style verification. Invoke as `ui-craft:design-reviewer` / `ui-craft:a11y-auditor`.
- **Commands** (`/critique`, `/audit`) — inline in the caller's context, sequential. Best for interactive build sessions where you want a quick lens mid-work.

## When to use what

UI Craft surfaces the same craft knowledge five ways. They don't compete — each fits a different moment. The two axes that decide: **does it write code?** and **is it judgment or a deterministic check?**

| Surface | What it is | Reach for it when | Writes code? | Judgment / deterministic | Runs |
|---------|------------|-------------------|:------------:|--------------------------|------|
| **The skill** (passive) | Always-on design knowledge + anti-slop, triggered by intent | You're building or editing any UI — the default | ✅ | Judgment | Inline, every harness |
| **Slash commands** | Focused single-lens passes (`/craft`, `/shape`, `/polish`, `/heuristic`, `/finalize`, …) | You want one specific pass, mid-work | Build/transform ✅ · review passes ❌ | Judgment | Inline, your session |
| **Agents** (`design-reviewer`, `a11y-auditor`) | Read-only verify team, fresh context, parallel | Final review / PR audit — you want independent judgment uncontaminated by the build session | ❌ | Judgment | Claude Code |
| **MCP tools** (`check_anti_slop`, `tokens_lint`, `acceptance_bar`, `score_ui`) | Deterministic checks an agent calls | A programmatic gate inside any MCP client, or a reproducible score | ❌ | Deterministic | MCP client / CI |
| **CLI** (`ui-craft` binary, `ui-craft-detect`, `scripts/eval.mjs`) | Installer + zero-dep scanners + UICraftScore | Install/update the system across harnesses; run quality gates in CI or git hooks | ❌ | Deterministic | Terminal / CI |

**The short version:** *taste that writes code* → the skill + commands. *Independent review, no edits* → the agents. *A check that must be identical every run* → MCP or the CLI. New to it or unsure? Run `/start` and it picks for you.

## Framework agnostic

The skill detects your project's styling approach and adapts:

- **Tailwind CSS** — uses utility classes, maps design rules to Tailwind equivalents
- **CSS Modules** — writes scoped `.module.css` files
- **styled-components / Emotion** — uses tagged templates
- **Vanilla CSS** — uses custom properties and modern features
- **SFC styles** (Vue, Svelte, Astro) — writes in `<style>` blocks

## Anti-slop

The skill actively rejects patterns that scream "AI made this":

- ~~Purple-cyan gradients~~
- ~~Glassmorphism with neon accents~~
- ~~Identical card grids~~
- ~~Bounce and elastic easing~~
- ~~Glow effects as affordances~~
- ~~Colored accent borders on cards~~
- ~~ALL CAPS headings~~
- ~~Uniform border-radius everywhere~~
- ~~Emoji as icons~~
- ~~Background gradient blobs~~
- ~~Bento grid abuse~~
- ~~Stagger-animate everything on load~~
- ~~Star ratings on testimonials~~
- ~~Generic CTAs ("Learn more", "Click here")~~
- ~~Walls of text on landing pages~~
- ~~Pure black (#000) text~~

## Canonical pipeline

Once the spine is in place, the workflow is:

```
Discovery → /brief → /tokens → build → /finalize → ship
```

The brief and tokens land as durable artifacts at `.ui-craft/brief.md` and the project's preferred token destination — they survive across sessions and anchor every subsequent design decision. Build proceeds with full reference loading via the routing table. `/finalize` runs the 10-pass finish bar before merge, gated on the brief existing.

## Project structure

```
ui-craft/
├── agents/                        # 2 Claude Code plugin agents (auto-discovered)
│   ├── design-reviewer.md        # Adversarial design critic — read-only, severity-tagged output
│   └── a11y-auditor.md           # Accessibility auditor — read-only, severity-tagged output
├── skills/
│   ├── ui-craft/                 # Main skill
│   │   ├── SKILL.md              # Slim entry — knobs, discovery, anti-slop, routing
│   │   └── references/           # 32 domain references (accessibility, motion, layout,
│   │                             #   typography, color, modern-css, responsive,
│   │                             #   sound, copy, review, dashboard, inspiration, stack,
│   │                             #   heuristics, personas, state-design, dataviz,
│   │                             #   ai-chat, forms, brief, tokens,
│   │                             #   finish-bar, principles-catalog, spec, agents)
│   ├── ui-craft-minimal/          # Variant — Linear/Notion aesthetic
│   ├── ui-craft-editorial/        # Variant — Medium/Substack aesthetic
│   └── ui-craft-dense-dashboard/  # Variant — Bloomberg/Retool aesthetic
├── commands/                      # 25 Claude Code slash commands (source of truth)
├── examples/
│   ├── animation-storyboard.md   # Multi-stage animation pattern template
│   └── presets/
│       ├── playful.md            # Clay / Gumroad / Duolingo / Arc aesthetic preset
│       └── brutalist.md          # Swiss print / Nothing / terminal aesthetic preset
├── evals/                         # Eval query sets for description optimizer
│   └── presets/                   # Playful + brutalist eval JSONs (reference material)
├── scripts/
│   ├── detect.mjs                # ui-craft-detect CLI (also shipped on npm)
│   └── validate.mjs              # Manifest + link checker
├── .codex/skills/                 # harness mirror for `npx skills add` / submodule installs
├── .cursor/skills/                # harness mirror
├── .gemini/skills/                # harness mirror
├── .opencode/skills/              # harness mirror
├── .agents/skills/                # harness mirror (generic agent-skills spec)
├── cli/assets/<harness>/          # hand-authored per-harness assets the CLI embeds + installs
├── .github/workflows/
│   └── validate.yml              # Runs validator on PR + push
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── VERSIONS.md
```

## Anti-slop detection

[![npm version](https://img.shields.io/npm/v/ui-craft-detect?style=flat-square&label=ui-craft-detect)](https://www.npmjs.com/package/ui-craft-detect)

Scan a codebase for common AI-generated UI anti-patterns — 38 rules covering AI slop (`transition: all`, bounce easing, purple gradients, ALL CAPS headings), dark patterns (confirmshaming, destructive actions without confirmation), a11y (icon-only buttons without labels, modal-without-`<dialog>`, `outline: none` without `:focus-visible` replacement, streaming without `aria-live`, heading-level skips), forms (placeholder-as-label, missing `autocomplete`), auth tells (caps "OR" dividers, full-bleed saturated brand panels), marketing copy tells (eyebrow floods, scroll cues, numbered section eyebrows, duplicate CTA intent, em-dash floods), perf (images without dimensions → CLS), tables (no overflow handling on mobile), dataviz (categorical rainbow palettes), state design (data fetching without empty/error branches), and placeholder copy shipped to prod (`Lorem ipsum`, `TODO`, `John Doe`). Zero dependencies, works out of the box.

Published as a standalone CLI on npm — use it anywhere without cloning:

```bash
npx ui-craft-detect ./src
# or with JSON output:
npx ui-craft-detect ./src --json
```

Or from a clone of this repo:

```bash
node scripts/detect.mjs ./src
```

Exit code 0 when clean, 1 when findings — usable as a CI gate. Rules mirror the Anti-Slop Test in `skills/ui-craft/SKILL.md`.

### Diff-scoped scanning — `--scope`, `--base`, `--fail-on`

Scope findings to what a branch actually changed, so CI only flags new anti-patterns instead of the entire pre-existing codebase.

| Flag | Values | Default | What it does |
|------|--------|---------|--------------|
| `--scope` | `full` \| `files` \| `changed` | `full` | `full` scans everything (unchanged behavior). `files` reports all findings in any file touched vs the base ref. `changed` reports only findings whose line falls inside an actual diff hunk. |
| `--base <ref>` | any git ref | merge-base of `HEAD` with the default branch | Overrides the comparison ref used for `--scope files`/`changed`. |
| `--fail-on` | `none` \| `warning` \| `error` | `error` | Exit-code gate, evaluated on the scope-filtered findings only. `none` is always advisory (exit 0). `warning` fails on any surviving finding. `error` fails only on critical findings (matches pre-existing default behavior). |

```bash
# Local pre-commit-style gate: only fail on new critical issues in changed lines
npx ui-craft-detect --scope changed --fail-on error

# Compare against a specific ref instead of the default branch
npx ui-craft-detect --scope changed --base origin/develop

# Advisory mode — see scoped findings without affecting the exit code
npx ui-craft-detect --scope files --fail-on none --json
```

If git is unavailable, the directory isn't a git repository, or the base ref can't be resolved (e.g. shallow clone), the tool falls back to `--scope full` automatically and prints a note on stderr — it never crashes or silently drops findings.

### Live URL scanning

Point the detector at a deployed page instead of source files:

```bash
npx ui-craft-detect https://your-site.com
npx ui-craft-detect https://your-site.com --json --fail-on none
```

Two engines, picked automatically:

- **puppeteer** (optional — `npm install puppeteer`) loads the page in headless Chromium and scans the JS-rendered DOM, so SPA/client-rendered markup is covered.
- **fetch** (zero-dep fallback) scans the server-rendered HTML as delivered. No JS execution.

Force one with `--engine puppeteer` or `--engine fetch`. Findings report the URL as the file and line numbers within the fetched HTML document. The core detector stays zero-dependency — puppeteer is resolved via dynamic import only when present.

### Agent edit-time hooks — `hooks` subcommand

Pre-commit and CI catch problems after the fact. Agent hooks catch them **while the agent is still working** — the detector runs after every agent file edit and feeds findings straight back into the loop:

```bash
npx ui-craft-detect hooks install            # both harnesses
npx ui-craft-detect hooks install --harness claude   # just one
npx ui-craft-detect hooks status
npx ui-craft-detect hooks uninstall
```

| Harness | Manifest | Mechanism |
|---------|----------|-----------|
| **Claude Code** | `.claude/settings.json` | `PostToolUse` hook (matcher `Edit\|Write\|MultiEdit`). On critical/major findings the hook exits 2, so the findings summary is fed back to the model as actionable feedback — the agent fixes the slop before finishing. |
| **Cursor** | `.cursor/hooks.json` | `afterFileEdit` hook (schema version 1). Findings appear in Cursor's Hooks output channel. Committed to the repo, project hooks load for the whole team — including Cloud Agents. |

Install is merge-safe and idempotent: existing manifest entries are always preserved, re-running is a no-op, and `uninstall` removes only the detector's own entries. The hook runner scans just the edited file, stays silent on clean edits and warn-level findings, and fails open on internal errors so a broken hook can never stall an agent.

### Pre-commit hooks — `init-hook` subcommand

`ui-craft-detect` can install its own pre-commit hook with zero config.

```bash
# Auto-detect (uses husky if present, else native .githooks)
npx ui-craft-detect init-hook

# Pick explicitly
npx ui-craft-detect init-hook --native         # .githooks/pre-commit (no deps)
npx ui-craft-detect init-hook --husky          # .husky/pre-commit (assumes husky)
npx ui-craft-detect init-hook --github-action  # .github/workflows/ui-craft-detect.yml (deprecated; use `ci install`)
npx ui-craft-detect init-hook --all            # all three
npx ui-craft-detect init-hook --dry-run        # preview without writing
```

The native hook scans only staged file content (via `git show :path`), so working-tree noise is ignored. Skip ad-hoc with `git commit --no-verify`. This repo's own `.githooks/pre-commit` also auto-bumps `marketplace.json` CalVer on every commit.

### CI integration — `ci install` / `ci config` / `ci upgrade`

One command sets up a full PR-feedback loop as a GitHub Action — no YAML to hand-write, no octokit dependency (it's all `gh api` under the hood):

```bash
npx ui-craft-detect@latest ci install
```

This writes `.github/workflows/ui-craft-detect.yml`, wired to:

- **Sticky PR summary comment** — one comment per PR, created on first push and edited (not duplicated) on every subsequent push, matched via a hidden marker.
- **Inline review comments** — findings are posted directly on the diff-visible lines that introduced them, scoped to `--scope changed` so pre-existing issues elsewhere in the file don't get flagged.
- **Commit status** — on pushes to the default branch (no PR context), posts a `ui-craft-detect` status with error/warning counts.
- **Minimal permissions** — `pull-requests: write` and `statuses: write` are each granted only for the steps that need them, with a one-line comment explaining why (same convention as this repo's own CodeQL workflow).

By default the workflow scans `--scope changed --fail-on error` on pull requests (`--scope full` on default-branch pushes, since a push has no PR diff to scope against).

Change settings anytime without reinstalling:

```bash
npx ui-craft-detect ci config --scope files            # widen scope to whole changed files
npx ui-craft-detect ci config --fail-on warning         # stricter gate
npx ui-craft-detect ci config --comment false           # disable the sticky PR comment
npx ui-craft-detect ci config --inline-comments false   # disable inline review comments
npx ui-craft-detect ci config --status false            # disable the commit status
```

`ci config` reads and rewrites a small config marker embedded in the workflow file, so only the settings you pass change — the rest of the file (steps, permissions) is left untouched.

Bump the workflow to the latest template version while keeping your settings:

```bash
npx ui-craft-detect ci upgrade
```

`ci upgrade` compares the embedded version marker against the installed CLI version; if there's drift, it regenerates the template body and preserves your `ci config` settings exactly. If you're already current, it's a no-op.

`init-hook --github-action` still works (it's the same code path `ci install` wraps) but is deprecated in favor of `ci install`.

The `--scope`/`--fail-on` flags used above aren't CI-only — they work as plain CLI flags for local pre-commit-style gating too (see [Diff-scoped scanning](#diff-scoped-scanning---scope---base---fail-on) above).

## Design-quality score

**UICraftScore** is a deterministic 0-100 composite that turns three static-analysis signals into a single defensible grade. It gives you objective, reproducible design-quality evidence — not vibes.

**Formula:**

```
score = 100
      − (antiSlop_critical × 8) − (antiSlop_major × 4) − (antiSlop_warn × 1)
      − (token_findings × 2)
      − (a11y_critical × 8) − (a11y_major × 4)

clamped [0, 100]  ·  A ≥ 90  ·  B ≥ 80  ·  C ≥ 70  ·  D ≥ 60  ·  F < 60
```

Three dimensions, each with its own subscore:

| Dimension | Source | Penalty |
|-----------|--------|---------|
| **anti_slop** | 38 rules from `ui-craft-detect` | critical −8 · major −4 · warn −1 |
| **token_discipline** | Raw hex / off-scale radius / spacing / z-index | −2 per finding (flat) |
| **a11y** | 5 new static checks (no overlap with detect.mjs): `img-no-alt`, `non-semantic-interactive`, `positive-tabindex`, `aria-invalid-no-describedby`, `no-reduced-motion` | critical −8 · major −4 |

The formula, weights, and grade bands are published in `evals/quality/score.mjs` (`WEIGHTS`, `GRADE_BANDS`). Hand-authored fixtures in `evals/quality/fixtures/` and bands in `evals/quality/baselines.json` form the regression gate.

**Run the CLI benchmark:**

```bash
# Score a single file
node scripts/eval.mjs src/components/Hero.tsx

# Score a directory
node scripts/eval.mjs src/components/

# Run the full regression gate (8 fixtures — slop vs. designer separation)
node scripts/eval.mjs --baseline

# JSON output (CI-friendly)
node scripts/eval.mjs src/components/Hero.tsx --json

# Fail if score below threshold (default 70)
node scripts/eval.mjs src/components/Hero.tsx --threshold 80
```

Exit codes: `0` clean / in-band · `1` below threshold or out of band · `2` arg error.

**Score via MCP tool (`score_ui`):**

The `score_ui` tool in the MCP server exposes the same scorer to any MCP-compatible client:

```json
// Call score_ui with inline code:
{ "code": "<your tsx source>" }

// Or with a file path:
{ "path": "src/components/Hero.tsx" }
```

Returns `{ overall: { score, grade }, dimensions: { anti_slop, token_discipline, a11y }, version }` — the same envelope as the CLI `--json` output.

See [`evals/README.md`](evals/README.md) for how to run the regression gate, add fixtures, and regen baselines after rule changes.

### UsabilityScore — the judged companion

UICraftScore is deterministic, which also bounds it: static analysis can't see *experience* friction (a confusing flow, a missing undo, a 2-second save with no feedback). **UsabilityScore** covers that axis — a 0-100 score + grade rolled up from the `/heuristic` scorecard (Nielsen's 10 + 6 design laws):

```
heuristic_base = round( ((mean(nielsen_scores) − 1) / 4) × 100 )   # 10 scores, each 1–5
UsabilityScore = clamp( heuristic_base − 5 × (failed design laws) , 0 , 100 )

Same bands as UICraftScore: A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · F < 60
```

It is **judged, not deterministic** — computed by the host agent from the rubric (zero deps, no API key, works in any harness), so it may vary run to run. **Gate CI on UICraftScore; use UsabilityScore for review depth.** The two render side by side in an *extended report* and are deliberately **never averaged** — that would hide which number is reproducible. Run it with `/heuristic <path>`; rubric + formula live in [`heuristics.md`](skills/ui-craft/references/heuristics.md).

## MCP Server

[![npm version](https://img.shields.io/npm/v/ui-craft-mcp?style=flat-square&label=ui-craft-mcp)](https://www.npmjs.com/package/ui-craft-mcp)

The `ui-craft-mcp` package exposes four deterministic design-quality tools over the [Model Context Protocol](https://modelcontextprotocol.io/) (stdio transport). Works with Claude Desktop, Cursor, and any MCP-compatible client.

**Boundary:** the MCP server is the **checks layer** — deterministic, rule-based, identical output for identical input. The `SKILL.md` is the **taste layer** — judgment, aesthetics, architectural decisions. These never overlap.

| Tool | What it does |
|------|-------------|
| `check_anti_slop` | 38-rule anti-slop scanner via `scan()` from `ui-craft-detect` — in-process, no subprocess |
| `tokens_lint` | Off-system token detector: raw hex colors, non-scale radius/spacing px, magic z-index |
| `acceptance_bar` | Acceptance checklist for a UI surface (`dashboard`, `landing`, `auth`, `generic`) — data only, no scoring |
| `score_ui` | Composite UICraftScore (0-100 + grade + per-dim subscores) via `evals/quality/score.mjs` — all three dimensions in one call |

**Quick start:**

```bash
# Wire in your project's .mcp.json:
{ "mcpServers": { "ui-craft": { "command": "npx", "args": ["ui-craft-mcp"] } } }
```

See [`mcp/README.md`](mcp/README.md) for full install, tool docs, and the `acceptance-data.json` regen note.

## Maintaining harness assets

The canonical skill content lives in `skills/` (main skill + variants) and `commands/` (the slash-command lenses). Two consumers ship that content:

- **CLI (`ui-craft install`)** — per-harness assets are hand-authored under `cli/assets/<harness>/` (claude, cursor, codex, gemini, opencode) and compiled into the binary via `go:embed`. Command-capable harnesses (Claude Code, OpenCode) receive real `commands/*.md`; skills-only harnesses (Cursor, Codex, Gemini) receive each lens as a flat depth-1 peer skill. The embedded tree is also the uninstall manifest — cleanup removes exactly what it installed.
- **`npx skills add` / git submodule** — the repo-root mirror dirs (`.codex/`, `.cursor/`, `.gemini/`, `.opencode/`, `.agents/`) serve those install paths.

When you change a skill or command, update the canonical source under `skills/` + `commands/` and the matching harness copies.

## Tuning skill descriptions

Every skill's `description` field is the primary trigger mechanism. The `evals/` folder holds query sets for `skill-creator`'s description optimizer (`run_loop.py`), which evaluates and iterates descriptions against realistic should-trigger / should-not-trigger prompts. See `evals/README.md` for the commands and how to add new eval sets.

## Roadmap

Where ui-craft is heading. Not commitments with dates — a public list of the directions we consider worth building, roughly ordered by how much they'd raise output quality. Feedback and PRs on any of these welcome.

**Design-tool integration**

- **Figma spec compliance** — read component specs (spacing, type, color, variants) via Figma's Dev Mode / REST API and score an implementation against them, the same way the detector scores anti-slop today. "Does the built component match the design?" becomes a deterministic gate instead of eyeball review.
- **Design-token import** — pull a token set from Figma variables / Tokens Studio / a `design-tokens.json` and emit the project's 3-layer spine (`/tokens`) from it, instead of hand-transcribing values.

**Detector**

- **Computed-style checks for URL scans** — the URL engine currently scans rendered markup; the next layer is computed styles via the browser engine: real contrast ratios (not class-name heuristics), effective tap-target sizes, actual font fallback chains.
- **Screenshot-diff regression (exploratory)** — likely as a thin integration over existing visual-regression tooling (Playwright snapshots / Chromatic-style diffs) rather than a bespoke engine.
- **More harnesses for edit-time hooks** — `hooks install` covers Claude Code and Cursor today; extend to other agents as their hook mechanisms stabilize.

**Skill & pipeline**

- **Reference-board step** — optional pre-build step that generates or collects visual references (mood board, type specimens, palette candidates) before the Craft Read, for briefs where the direction is genuinely open.
- **Multi-page consistency** — today's recipes reason about one surface at a time; a site-level pass would enforce shared rhythm, type scale, and CTA vocabulary across pages.
- **UsabilityScore trend tracking** — persist `/heuristic` and UICraftScore results per commit so quality is a curve you watch, not a snapshot.

**Evals**

- **Automated blind-build harness** — run the `evals/craft-quality/PROMPTS.md` tracks through an agent automatically and score the output, turning today's manual auditor pass into a repeatable regression suite.

Have a strong opinion on priority, or something missing? [Open an issue](https://github.com/educlopez/ui-craft/issues).

## Contributing

Spotted a new AI-generated pattern that should be in the anti-slop list? Have a craft rule from a product you admire? Want to add a new reference domain? PRs and issues welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding rules, improving references, or proposing new domains.

## Author

[Eduardo Calvo](https://x.com/educalvolpz)

## License

[MIT](LICENSE) — use it however you want.
