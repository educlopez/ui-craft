# UI Craft

A design engineering skill for AI coding agents. Teaches your agent to build interfaces with real design taste — not gradient cards and bounce animations.

**Website:** [skills.smoothui.dev](https://skills.smoothui.dev)

![UI Craft](assets/og.png)

## What it does

UI Craft gives AI coding agents the design knowledge they're missing. Not templates. Not component libraries. Actual craft knowledge — 15 domains of opinionated rules about how interfaces should look, move, and feel, plus 7 slash commands to run focused passes on existing code.

Every UI gets tested against a single question: *"Would someone believe AI made this?"* If yes, it starts over.

## Install

```bash
npx skills add educlopez/ui-craft
```

Works with **Claude Code, Codex, Cursor, Gemini, OpenCode, Windsurf**, and any agent that supports the [Agent Skills](https://skills.sh) spec.

Each agent gets a pre-built mirror under a dedicated folder (`.codex/`, `.cursor/`, `.gemini/`, `.opencode/`, `.agents/`). The main `ui-craft` skill lands as a peer skill; each of the 7 slash commands is materialized as its own sub-skill in non-Claude harnesses (since only Claude Code understands slash commands — other agents see them as skills triggered by intent like "audit my UI", "polish this page").

### Alternative installation

**Clone:**
```bash
git clone https://github.com/educlopez/ui-craft.git ~/.skills/ui-craft
```

**Git submodule:**
```bash
git submodule add https://github.com/educlopez/ui-craft.git .skills/ui-craft
```

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

## Slash commands

Seven focused passes, each applying a single lens from the skill:

| Command | Does |
|---------|------|
| `/ui-craft:audit` | Technical quality — a11y, performance, responsive. Prioritized findings table. |
| `/ui-craft:critique` | UX critique — hierarchy, clarity, anti-slop. No code changes. |
| `/ui-craft:polish` | Final pass — compound details that turn "done" into "crafted". |
| `/ui-craft:animate` | Add/fix motion. Honors `MOTION_INTENSITY` and the chosen stack. |
| `/ui-craft:distill` | Strip to essence. Cut every section that doesn't earn space. |
| `/ui-craft:adapt` | Responsive pass — mobile, tablet, desktop, touch, safe areas. |
| `/ui-craft:typeset` | Typography pass — fonts, scale, tracking, micro-typography. |

## Four modes

The skill detects your intent and routes automatically.

| Mode | Prompt example | What it does |
|------|---------------|--------------|
| **Build** | "Build a pricing page" | Layout, typography, color, spacing, accessibility, responsive — all in one pass |
| **Animate** | "Add an entrance to this modal" | Picks the right easing, duration, and origin point |
| **Review** | "Review this component" | Audits for generic AI patterns, accessibility gaps, and missed details |
| **Polish** | "Polish this dashboard" | Finds the twenty small things that turn "done" into "crafted" |

## 15 domains

| Domain | Covers |
|--------|--------|
| Animation | Easing curves, spring physics, duration rules, `prefers-reduced-motion` |
| Layout | Spacing systems, optical alignment, layered shadows, visual hierarchy |
| Typography | `text-wrap: balance`, tabular-nums, font scale, curly quotes |
| Color | OKLCH, design tokens, dark mode, APCA contrast |
| Accessibility | WAI-ARIA, keyboard nav, focus management, touch targets |
| Performance | Compositor-only animations, FLIP, `will-change`, CLS prevention |
| Modern CSS | View Transitions, scroll-driven animations, container queries, `:has()` |
| Responsive | Fluid sizing, mobile-first, touch zones, safe areas |
| Sound | Web Audio API, feedback sounds, appropriateness matrix |
| UX Copy | Error messages, empty states, CTAs, microcopy |
| UI Review | Systematic critique methodology, anti-slop detection |
| Orchestration | Multi-stage sequences, stagger timing, entrance/exit coordination |
| Dashboard | Sidebar nav, metric cards, chart types, data tables, filters |
| Inspiration | Real patterns from dub.co, cursor, linear, vercel, stripe |
| **Stack** | Motion, GSAP, Three.js — decision tree, patterns, perf gotchas, anti-patterns (opt-in) |

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

## Project structure

```
ui-craft/
├── skills/
│   └── ui-craft/
│       ├── SKILL.md              # Slim entry point (~13KB) — knobs, discovery, anti-slop, routing
│       └── references/
│           ├── accessibility.md   # WCAG, keyboard, focus, ARIA, forms, checklist
│           ├── animation.md       # Easing, springs, timing, interaction rules, principles
│           ├── animation-orchestration.md  # Multi-stage sequences
│           ├── color.md           # Palettes, dark mode, tokens
│           ├── copy.md            # UX writing, errors, CTAs, content & states
│           ├── dashboard.md       # Dashboard layout, metrics, charts, tables
│           ├── inspiration.md     # Real patterns from top SaaS sites
│           ├── layout.md          # Spacing, grids, hierarchy, depth, essentials
│           ├── modern-css.md      # View Transitions, container queries
│           ├── performance.md     # Compositor, FLIP, scroll, layers, core rules
│           ├── responsive.md      # Breakpoints, touch zones, fluid
│           ├── review.md          # Critique methodology, Polish Pass, common issues
│           ├── sound.md           # Web Audio, UI sound design
│           ├── stack.md           # Motion / GSAP / Three.js (opt-in)
│           └── typography.md      # Scale, fonts, readability, essentials
├── commands/                      # Claude Code slash commands (source)
│   ├── adapt.md                  # /ui-craft:adapt
│   ├── animate.md                # /ui-craft:animate
│   ├── audit.md                  # /ui-craft:audit
│   ├── critique.md               # /ui-craft:critique
│   ├── distill.md                # /ui-craft:distill
│   ├── polish.md                 # /ui-craft:polish
│   └── typeset.md                # /ui-craft:typeset
├── scripts/
│   └── sync-harnesses.mjs        # Generates .codex/.cursor/.gemini/.opencode/.agents mirrors
├── .codex/skills/                 # AUTO-GENERATED — do not edit
├── .cursor/skills/                # AUTO-GENERATED
├── .gemini/skills/                # AUTO-GENERATED
├── .opencode/skills/              # AUTO-GENERATED
├── .agents/skills/                # AUTO-GENERATED (generic agent-skills spec)
├── .github/workflows/
│   └── sync-harnesses.yml        # Re-runs sync on push to main; commits drift
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── VERSIONS.md
```

## Maintaining harness mirrors

```bash
npm run sync
# or: node scripts/sync-harnesses.mjs
```

The sync script copies `skills/ui-craft/` into each harness dir and converts each file in `commands/` into a standalone sub-skill. It wipes and regenerates the harness dirs, so never edit `.codex/`, `.cursor/`, etc. directly — change `skills/ui-craft/` or `commands/`, then run sync. GitHub Actions runs it automatically on push to `main` (`.github/workflows/sync-harnesses.yml`).

## Contributing

Spotted a new AI-generated pattern that should be in the anti-slop list? Have a craft rule from a product you admire? Want to add a new reference domain? PRs and issues welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding rules, improving references, or proposing new domains.

## Author

[Eduardo Calvo](https://x.com/educalvolpz)

## License

[MIT](LICENSE) — use it however you want.
