# UI Craft

A design engineering skill for AI coding agents. Teaches your agent to build interfaces with real design taste — not gradient cards and bounce animations.

**Website:** [skills.smoothui.dev](https://skills.smoothui.dev)

![UI Craft](assets/og.png)

## What it does

UI Craft gives AI coding agents the design knowledge they're missing. Not templates. Not component libraries. Actual craft knowledge — 12 domains of opinionated rules about how interfaces should look, move, and feel.

Every UI gets tested against a single question: *"Would someone believe AI made this?"* If yes, it starts over.

## Install

```bash
npx skills add educlopez/ui-craft
```

Works with Claude Code, Cursor, Windsurf, and any agent that supports the [Agent Skills](https://skills.sh) spec.

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

Before building anything, the skill analyzes your project for existing design decisions — CSS variables, Tailwind config, font imports, component themes. If your project already has a design system, it respects it. If not, it asks 3 quick questions (style, accent color, font) so it never defaults to generic blue/Inter.

## Four modes

The skill detects your intent and routes automatically.

| Mode | Prompt example | What it does |
|------|---------------|--------------|
| **Build** | "Build a pricing page" | Layout, typography, color, spacing, accessibility, responsive — all in one pass |
| **Animate** | "Add an entrance to this modal" | Picks the right easing, duration, and origin point |
| **Review** | "Review this component" | Audits for generic AI patterns, accessibility gaps, and missed details |
| **Polish** | "Polish this dashboard" | Finds the twenty small things that turn "done" into "crafted" |

## 12 domains

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
│       ├── SKILL.md              # Main skill file
│       └── references/
│           ├── accessibility.md   # WCAG, keyboard, focus, ARIA
│           ├── animation.md       # Easing, springs, timing, principles
│           ├── animation-orchestration.md  # Multi-stage sequences
│           ├── color.md           # Palettes, dark mode, tokens
│           ├── copy.md            # UX writing, errors, CTAs
│           ├── layout.md          # Spacing, grids, hierarchy, depth
│           ├── modern-css.md      # View Transitions, container queries
│           ├── performance.md     # Compositor, FLIP, scroll, layers
│           ├── responsive.md      # Breakpoints, touch zones, fluid
│           ├── dashboard.md       # Dashboard layout, metrics, charts, tables
│           ├── inspiration.md     # Real patterns from top SaaS sites
│           ├── review.md          # Systematic UI critique methodology
│           ├── sound.md           # Web Audio, UI sound design
│           └── typography.md      # Type scale, fonts, readability
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── VERSIONS.md
```

## Contributing

Spotted a new AI-generated pattern that should be in the anti-slop list? Have a craft rule from a product you admire? Want to add a new reference domain? PRs and issues welcome.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on adding rules, improving references, or proposing new domains.

## Author

[Eduardo Calvo](https://x.com/educalvolpz)

## License

[MIT](LICENSE) — use it however you want.
