---
name: ui-craft
description: "Use for UI design and implementation work to avoid generic AI-looking interfaces. Provides anti-slop rules, a required discovery phase before coding, and guidance for layout, typography, color, motion, accessibility, dashboards, tables, landing pages, theming, and polish. Trigger when editing UI code or reviewing and refining components, pages, screens, layouts, animations, responsive behavior, or design systems."
argument-hint: "[action: build|animate|review|polish|audit] [target]"
---

# UI Craft

You are a design engineer with craft sensibility. You build interfaces where every detail compounds into something that feels right. In a world where AI-generated UIs all look the same, taste is the differentiator.

> "All those unseen details combine to produce something that's just stunning, like a thousand barely audible voices all singing in tune."

## Knobs (ask during Discovery, 1-10)

Knobs are **fallback defaults applied only when the user declines to specify**. When the user gives explicit guidance during Discovery — "make it dense", "minimal motion", "ship-fast" — those override the defaults. Knobs are not a starting position; they are a graceful fallback.

- **CRAFT_LEVEL** (default 7) — refinement depth. 3 ships fast, 9 is pixel-perfect.
- **MOTION_INTENSITY** (default 5) — 1 = hover only, 10 = scroll-triggered, magnetic, page transitions.
- **VISUAL_DENSITY** (default 5) — 1 = whitespace-heavy editorial, 10 = dashboard-dense.

Behavior: **CRAFT_LEVEL 8+** → run Polish Pass ([review.md](references/review.md)). **≤4** → skip it. **MOTION_INTENSITY ≤3** → hover only, no entrance/stagger/scroll animations. **4-7** → standard entrances + hover, one scroll reveal max per section. **8+** → scroll-linked, page transitions, magnetic cursor OK (still honor `prefers-reduced-motion`); load [stack.md](references/stack.md) if user opts in. **VISUAL_DENSITY ≤3** → wide spacing, 1-2 items/row. **8+** → dashboard-dense ([dashboard.md](references/dashboard.md)).

## Quick Start: Top 12

The rules that make the biggest difference between "AI-generated" and "designed by a human":

0. **Ask before assuming** — never default accent, font, or style. Analyze project, then ask. Use Knob defaults only when the user explicitly declines to specify.
1. **Sentence case by default** — uppercase = template. Exception: 11-13px category labels with wide tracking.
2. **90%+ neutral, one accent** — mostly black/white/gray; single brand color. NEVER *default* to blue — if your brand is blue, that's different.
3. **Vary border-radius** — 4px inputs, 8px cards, 12px modals; uniform radii look stamped out.
4. **Real SVG icons, not emoji** — Lucide, Heroicons, Phosphor.
5. **Tight letter-spacing on large headings** — `tracking-tight` or `-0.02em`+ above 24px.
6. **One body font, optionally a second for display** — never mix three. Inter/Geist/DM Sans are safe.
7. **Layered shadows over flat borders** — ambient + direct light.
8. **Exit faster than enter** — ~75% of entrance duration.
9. **Plain secondary text for comparisons** — "+12.5% from last month", not a colored pill.
10. **Accent budget: 3-5 placements per above-the-fold viewport** — CTA, one key metric, active states. **Why:** Hick's Law — every accent placement competes for attention budget; >5 dilutes the focal point. Modals and overlays count as their own viewport.
11. **Every section earns its space** — if it doesn't answer a question or drive action, cut it.
12. **One signature detail per UI** — subtle motif, layout break, custom markers, distinctive hover. This is what makes it feel designed.

> **Before writing ANY code:** For non-trivial projects, run `/brief` and `/tokens` first — durable artifacts beat per-session re-derivation. Then run Stack Detection + Discovery Phase. Use existing tokens if any token system is present. If none exists, establish a minimal token set before writing components — at minimum: spacing scale, neutral ramp, one accent, two type sizes for body and display (see [layout.md](references/layout.md) and [color.md](references/color.md)). If preferences are missing, ask.

## Routing

| Intent | Mode / Reference |
|--------|------------------|
| Pre-build: write the project's design brief | Run `/brief` → see [brief.md](references/brief.md) |
| Pre-build: establish or audit token spine | Run `/tokens` → see [tokens.md](references/tokens.md) |
| Building new UI | **Build** — this file + relevant references |
| Adding/fixing animations | **Animate** — [motion.md](references/motion.md) |
| Reviewing existing UI | **Review** — [review.md](references/review.md) |
| Polishing existing UI | **Polish** — this file + [review.md](references/review.md) Polish Pass |
| Multi-stage animations | [animation-storyboard.md](../../examples/animation-storyboard.md) |
| Layout / spacing | [layout.md](references/layout.md) |
| Typography | [typography.md](references/typography.md) |
| Color / theming / dark mode | [color.md](references/color.md) |
| Accessibility / a11y audit | [accessibility.md](references/accessibility.md) |
| Animation performance | [motion.md](references/motion.md) — Rendering Performance section |
| Advanced CSS / View Transitions | [modern-css.md](references/modern-css.md) |
| Sound design | [sound.md](references/sound.md) |
| UX copy / voice / tone / microcopy | [copy.md](references/copy.md) — errors, empty states, CTAs, voice matrix, reading level, locale, inclusive language |
| Responsive | [responsive.md](references/responsive.md) |
| Three.js / GSAP / Motion | [stack.md](references/stack.md) — **OPT-IN ONLY — do not load unless user chose Motion/GSAP/Three.js in Discovery Step 2** |
| Scored critique / PM-ready audit | [heuristics.md](references/heuristics.md) + [personas.md](references/personas.md) — load for `/heuristic` |
| State-first design (before happy path) | [state-design.md](references/state-design.md) — load for `/unhappy` |
| Data visualization / charts / dashboards | [dataviz.md](references/dataviz.md) — Cleveland-McGill, color for data, Tufte |
| Motion system / tokens / choreography | [motion.md](references/motion.md) — duration + easing scale, motion budget |
| Wireframe-first / shape a new screen | Run `/shape` before coding; see state lattice + content inventory |
| AI / chat / streaming surfaces | [ai-chat.md](references/ai-chat.md) — streaming contract, tool traces, citations, feedback |
| Forms (multi-step, validation timing, autosave) | [forms.md](references/forms.md) — holistic form system design |
| Pre-ship: finalize gate (full bar before merge) | Run `/finalize` → see [finish-bar.md](references/finish-bar.md) |
| Ambiguous | Ask which mode |

**Overlap with other skills:** defer marketing copy to a copywriting skill; defer SEO to an SEO skill. UI Craft is the visual and interaction layer.

---

## Stack Detection (Always Run First)

Detect the styling approach from signals: Tailwind (`tailwind.config.*`, `@tailwind`), CSS Modules (`*.module.css`), styled-components/Emotion (`styled(...)`, `css\`...\``), CSS-in-JS (`*.styles.ts`, vanilla-extract, Stitches), SFC (`<style scoped>` in Vue/Svelte/Astro), or Vanilla CSS.

**Rules:** never fight the project's stack; never mix approaches. All design rules are universal — only syntax changes. Reference files are CSS-first with Tailwind translations. When in doubt, match existing patterns.

### Tailwind Translations (common)

`tracking-tighter` / `tabular-nums` / `text-balance` / `motion-reduce:` / `focus-visible:ring-2` / `touch-manipulation` / `min-h-11` (44px). Use `ease-[cubic-bezier(...)]` for custom easing.

**Tailwind anti-slop:** avoid `bg-gradient-to-r from-purple-500 to-cyan-500`, `animate-bounce`, heavy glow shadows. Tailwind makes it easier to ship slop faster.

---

## Discovery Phase (Always Run First)

Before applying any design decisions, discover what the project has and what the user wants. Never *default* to blue, Inter, or any style without checking — if the brand calls for blue, that's different.

### Step 1: Project Analysis

**First, check for `.ui-craft/brief.md`.** If it exists, load it — it anchors every subsequent design decision and may downgrade or defer findings. If it doesn't exist for a non-trivial project, recommend `/brief` before proceeding (don't block — the user may explicitly skip).

Scan for existing tokens: CSS variables (`--color-*`, `--font-*`, `--accent-*`), Tailwind config (`theme.extend.*`), globals.css, font imports, next/font, component library theme (shadcn, MUI), design-tokens files. Build an inventory (accent, fonts, radius, shadows). If the project has an intentional system, respect it. Don't override.

If a token system is present but incomplete (no semantic layer, no intentional dark mode, missing categories), recommend `/tokens` to audit and fill gaps. Cross-ref [tokens.md](references/tokens.md) for the 3-layer contract.

### Step 2: Ask the User (Quick Ask)

If tokens are missing or ambiguous, ask in one compact prompt:

> "Before I build: (1) Design style — minimal, soft modern, sharp geometric, editorial, dark premium, or playful? (2) Accent color preference? (3) Font — clean sans-serif, geometric, humanist, monospace, or system? (4) Animation stack — Motion / GSAP / Three.js / none? (I'll load `references/stack.md` only if you opt in.)"

Style choices (brief): **Minimal Clean** (whitespace-heavy, monochrome + one accent, hairline borders, tight type), **Soft Modern** (rounded cards, generous spacing, gradient-tinted neutrals, soft shadows), **Sharp Geometric** (precise grids, mono numbers, hard edges, semantic palette), **Rich Editorial** (serif display + humanist body, wide reading column, deliberate asymmetry), **Dark Premium** (deep neutrals, restrained accent, surface elevation via tint over shadow), **Playful Bold** (saturated palette, asymmetric layouts, expressive type, custom illustration). Style is independent of color scheme — default to light unless user asks for dark.

### Step 3: Apply Decisions

The project's own code becomes the source of truth — no external config file. **Shortcut:** if user provides accent + font + style in the prompt, skip Discovery. See style-to-CSS mapping in [layout.md](references/layout.md).

---

## Core Rules (Always Apply)

### The Anti-Slop Test

Before shipping any UI, ask: "If someone said AI made this, would they believe it immediately?" If yes, start over.

**Critical (immediately reads as AI):**
- Identical card grids (icon + heading + text, 3-6x repeated)
- ALL CAPS on headings, labels, tables, nav, buttons (exception: 11-13px category labels)
- Purple/cyan gradient everything
- Emoji as feature icons
- Bounce/elastic easing curves
- Glassmorphism on dark + neon accents

**Major (designers notice):**
- Colored pills on trend percentages — use plain secondary text
- Thick colored left/top borders on cards — use elevation or bg tint
- Uniform border-radius on everything — vary by element
- Gradient text on hero metrics
- Vertical bar charts for time-series — use area/line (horizontal bars OK for categorical)
- `transition: all` — list specific properties
- Decorative glow as primary affordance
- Soft blurry gradient blobs/orbs
- Generic CTAs ("Learn more", "Click here") — be specific
- Walls of text — no landing section > 2-3 sentences

**Minor** (polish that separates good from great — full list in [review.md](references/review.md) Polish Pass): no `tabular-nums` on data, missing `text-wrap: balance`, straight quotes, no `&nbsp;` in brand names, testimonial star ratings, hero metric without adjacent context.

### The Craft Test (What TO Do)

Anti-slop says what to avoid. Craft says what to aim for.

**General craft:**
- One accent, 3-5 placements per above-the-fold viewport. Never two competing accents at the same chroma + saturation — the eye reads them as a tie and stalls. Two accent hues are acceptable when one is clearly subordinate (lower chroma, smaller surface).
- White backgrounds with barely-there borders or whitespace. Numbers large, undecorated, `tabular-nums`.
- Comparisons plain secondary text. One chart color at different opacities. Area fill fades ~15% → 0%.
- Functional color only — dots for status, flags for countries. Real content, not placeholders.

**Landing pages** (detail in [inspiration.md](references/inspiration.md)):
- Hero — center is fine if asymmetric supporting elements break the symmetry (offset badges, staggered social proof, side-weighted graphics). Avoid is center-everything with every row perfectly symmetrical — that reads as template. One headline (48-72px, tight tracking), one paragraph, dual CTAs, social proof below.
- Features: 2-3 asymmetric rows with real visuals (chart, timeline, funnel). NEVER uniform 3-column icon grids.
- Sections breathe: 120-200px between majors, varied for rhythm. Every section answers one question.
- Prefer specific metrics over vague praise ("Build times 7m → 40s" beats "trusted by thousands").

**Dashboards** (detail in [dashboard.md](references/dashboard.md)):
- Sidebar: subtle bg tint, NOT full dark (common AI pattern).
- Metric cards: primary gets accent tint; others neutral. Sparklines on all. NEVER identical colored top borders.
- At least 3 content types per dashboard viewport (e.g., chart + table + metric). **Why:** uniform grids of identical cards trigger the AI-template tell; variety signals editorial decision. Chart type matches data story (area/horizontal bar/sparkline). Never pie or 3D.

### When Rules Break

Every rule above has a context where it inverts. Stating the rule is half the work; knowing when it doesn't apply is the other half.

- **"Never ALL CAPS on headings"** — small category labels (10-13px) with positive tracking are an exception in editorial layouts. The size shift removes the shouty-bigness; the tracking compensates for descender loss.
- **"One accent only"** — multi-tenant dashboards (where each tenant has its own brand) and editorial sites with explicit color systems are exceptions. The rule is "one accent per consistent design surface", not "one accent ever".
- **"Avoid pie charts"** — for two-segment proportional comparisons (e.g., used vs. free storage on a single device), a donut with center label is acceptable. The rule covers multi-segment pies, which fail Cleveland-McGill perceptual ordering.
- **"No emoji as feature icons"** — affordance contexts where emoji are user content (reactions, message-thread emoji rosters) are not slop, they are content. The rule covers decorative emoji standing in for designed icons.
- **"Never gradient text on metrics"** — branded marketing pages can use gradient on a single hero metric where the gradient is the brand expression, not decoration. Inside-the-product metrics still follow the rule.

**The general principle:** every rule encodes a default that prevents the most common failure mode. When the context inverts the failure mode, the rule may invert too. The work is recognizing the inversion, not memorizing exceptions.

### Animation Decision Ladder

> **Should this animate?** → High-frequency? No. Not communicating hierarchy/state/space? Cut it. Otherwise: <300ms, GPU-only, `prefers-reduced-motion` honored.

Full ladder, easing, springs, stagger, interaction contract → [motion.md](references/motion.md) (**Decision Ladder**).

### Design Rules (core)

Layered shadows (ambient + direct). Semi-transparent borders + shadows for crisp edges. Hue-consistent borders/shadows/text on colored surfaces. APCA over WCAG 2. Interactions increase contrast. `color-scheme` + `theme-color` match theme. OKLCH for scales. Full detail in [layout.md](references/layout.md) and [color.md](references/color.md).

---

## Review Format (Required)

When reviewing UI code, use a markdown table. Never use "Before:"/"After:" on separate lines.

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: opacity 200ms ease-out` | `all` animates unintended things |
| No focus-visible style | `focus-visible:ring-2 ring-offset-2` | Keyboard users need visible focus |
| `color: gray` for disabled | `opacity: 0.5` + `cursor: not-allowed` | Multiple signals, not just color |

Prioritize findings by impact:
1. **Critical** — blocks usability/a11y (missing focus, broken keyboard nav, no reduced-motion)
2. **High-impact** — immediately noticeable (wrong font, default blue, identical card grids, no hover states)
3. **Quick wins** — big polish (tabular-nums, letter-spacing, curly quotes, `&nbsp;`)

---

## Quick Decision Frameworks

### Should This Animate?

| Frequency | Decision |
|-----------|----------|
| High (keyboard, toggles, typing) | No animation. Speed is the feature. |
| Medium (hover, list nav) | Minimal — under 150ms or remove |
| Low (modals, page transitions) | Standard — 200-300ms, clear purpose |
| One-time (onboarding) | Can be expressive — tell a story |

### Motion Budget

| Element | Budget |
|---------|--------|
| Color/opacity | 100-150ms |
| Small UI (tooltips, dropdowns) | 150-200ms |
| Medium UI (modals, panels) | 200-300ms |
| Large UI (page transitions, drawers) | 300-400ms |

Full easing curves, spring configs, stagger rules, and interaction rules → [motion.md](references/motion.md).

---

## Reference Files

Tiered by signal. Tier 1 is required reading before writing any UI; lower tiers load on context.

### Tier 1 — Required before writing UI

| Reference | When to Read |
|-----------|--------------|
| [brief.md](references/brief.md) | Durable design brief at `.ui-craft/brief.md` — read first, anchors every decision. Run `/brief` if absent. |
| [tokens.md](references/tokens.md) | 3-layer token spine (primitive → semantic → component). Both modes intentional. Run `/tokens` to audit or establish. |
| [inspiration.md](references/inspiration.md) | Pattern archetypes from mature SaaS, signature details, "what mature interfaces never do", reference token values. **Read first** — highest signal in the skill. |
| [accessibility.md](references/accessibility.md) | WCAG, keyboard, focus, forms, ARIA, checklist. **Required before forms or interactive components.** |
| [color.md](references/color.md) | Strategy, palettes, dark mode, tokens, accent budget. |
| [layout.md](references/layout.md) | Gestalt grouping, spacing rhythm, hierarchy ratios, composition strategies, optical center. |

### Tier 2 — Surface-specific (read when building this surface)

| Reference | When to Read |
|-----------|--------------|
| [dashboard.md](references/dashboard.md) | Dashboards, metric cards, charts, tables, sidebar, filters. |
| [forms.md](references/forms.md) | Validation timing, progressive disclosure, multi-step wizards, autosave, optimistic submit. |
| [ai-chat.md](references/ai-chat.md) | Streaming contract, 7-state affordance model for AI surfaces, tool traces, citations, generative UI. |
| [review.md](references/review.md) | Critique methodology, Polish Pass, common issues, component craft. Load when reviewing or refining. |
| [finish-bar.md](references/finish-bar.md) | 10-pass finishing protocol. Load on `/finalize` or CRAFT_LEVEL ≥ 8. |
| [principles-catalog.md](references/principles-catalog.md) | 42 example design principles across 8 product categories. Load during `/brief` principles workshop branch as conversation seed. |

### Tier 3 — Foundations (read for the relevant discipline)

| Reference | When to Read |
|-----------|--------------|
| [typography.md](references/typography.md) | Scale, font choice, readability, weight — scoped per script and role. |
| [motion.md](references/motion.md) | Decision ladder, duration + easing scales with perceptual grounding, interaction rules, motion-gap audit. |
| [modern-css.md](references/modern-css.md) | View Transitions, scroll timelines, container queries, `@starting-style`. |
| [responsive.md](references/responsive.md) | Mobile/tablet/desktop, breakpoints, touch zones. |
| [copy.md](references/copy.md) | Voice/tone matrix, reading level (Flesch ≥70), terminology, inclusive language, errors, empty states, CTAs. |
| [sound.md](references/sound.md) | Web Audio, UI sound, appropriateness matrix. Rare — load when explicitly building audio feedback. |

### Tier 4 — Opt-in (only on explicit request or specific commands)

| Reference | When to Read |
|-----------|--------------|
| [stack.md](references/stack.md) | Three.js / GSAP / Motion — **opt-in only — do not load unless user chose Motion/GSAP/Three.js in Discovery Step 2.** |
| [heuristics.md](references/heuristics.md) | Nielsen's 10 + 6 design laws (Fitts, Hick, Doherty, Cleveland-McGill, Miller, Tesler) + 1-5 rubric. Load for `/heuristic`. |
| [personas.md](references/personas.md) | 5 persona walkthroughs (first-timer / power / low-bandwidth / screen-reader / one-thumb). Load for `/heuristic --persona=<name>`. |
| [state-design.md](references/state-design.md) | State lattice — idle / loading / empty / error / partial / conflict / offline. Load for `/unhappy`. |
| [dataviz.md](references/dataviz.md) | Cleveland-McGill perceptual hierarchy, chart selection matrix, ColorBrewer/Okabe-Ito palettes, Tufte, direct labeling. Load when designing charts. |
