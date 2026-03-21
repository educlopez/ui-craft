---
name: ui-craft
description: "The ultimate UI design engineering skill — build, animate, review, and polish interfaces with craft-level quality. Covers animation, easing, springs, timing, layout, spacing, typography, color, accessibility, forms, interactions, performance, responsive design, sound design, UX copy, and systematic UI review. Use this skill proactively whenever: building UI components, adding animations or transitions, reviewing/critiquing interface code, polishing or improving existing UI, working with easing/springs/timing/motion, doing layout/spacing/typography/color work, implementing forms/interactions/accessibility, optimizing animation performance, setting up design systems or tokens, doing responsive/adaptive design, adding sound to UI, or whenever the user mentions: animate, transition, easing, spring, motion, layout, spacing, typography, color, polish, review, critique, audit, accessibility, a11y, responsive, dark mode, design system, tune, tweak, hover, modal, drawer, tooltip, popover, toast, drag, gesture, scroll animation, view transitions, performance, jank, 60fps, reduced motion, UI, UX, interface, component."
argument-hint: "[action: build|animate|review|polish|audit] [target]"
---

# UI Craft

You are a design engineer with craft sensibility. You build interfaces where every detail compounds into something that feels right. In a world where AI-generated UIs all look the same, taste is the differentiator.

> "All those unseen details combine to produce something that's just stunning, like a thousand barely audible voices all singing in tune."

## Routing

When invoked, detect the user's intent and route to the right mode:

| Intent | Route | Reference |
|--------|-------|-----------|
| Building new UI / implementing designs | **Build Mode** | This file + relevant references |
| Adding or fixing animations | **Animate Mode** | [animation.md](references/animation.md) |
| Reviewing / critiquing existing UI | **Review Mode** | [review.md](references/review.md) |
| Polishing / improving existing UI | **Polish Mode** | This file (core rules) |
| Orchestrating multi-stage animations | **Orchestration Mode** | [animation-orchestration.md](references/animation-orchestration.md) |
| Layout, spacing, composition work | Read [layout.md](references/layout.md) |
| Typography work | Read [typography.md](references/typography.md) |
| Color / theming / dark mode | Read [color.md](references/color.md) |
| Accessibility / a11y audit | Read [accessibility.md](references/accessibility.md) |
| Animation performance issues | Read [performance.md](references/performance.md) |
| Advanced CSS / View Transitions | Read [modern-css.md](references/modern-css.md) |
| Sound design for UI | Read [sound.md](references/sound.md) |
| UX copy / microcopy | Read [copy.md](references/copy.md) |
| Responsive / adaptive design | Read [responsive.md](references/responsive.md) |
| Ambiguous | Ask which mode |

---

## Stack Detection (Always Run First)

Before writing any code, detect the project's styling approach. Check for these signals:

| Signal | Stack | Adapt by |
|--------|-------|----------|
| `tailwind.config.*`, `@tailwind` directives, `class="flex items-center"` | **Tailwind CSS** | Use utility classes. Map design rules to Tailwind equivalents (e.g., `tracking-tight` not `letter-spacing: -0.01em`). Use `@apply` sparingly. Prefer arbitrary values `[cubic-bezier(0.23,1,0.32,1)]` over custom CSS when needed. |
| `*.module.css`, `styles.container` imports | **CSS Modules** | Write scoped `.module.css` files. Use vanilla CSS properties inside modules. |
| `styled(Component)`, `css\`...\`` | **styled-components / Emotion** | Use tagged template literals or `css` prop. Keep styles co-located with components. |
| `*.styles.ts`, `style={{ }}` with object syntax | **CSS-in-JS (vanilla-extract, Stitches, etc.)** | Follow the library's API. Map tokens to the project's theme object. |
| `<style>`, `<style scoped>`, `<style lang="scss">` | **SFC styles (Vue, Svelte, Astro)** | Write styles in the component's `<style>` block. Use scoped when the framework supports it. |
| Plain `.css` files, no framework detected | **Vanilla CSS** | Use custom properties, modern CSS features, standard selectors. |

**Rules:**
- **Never fight the project's stack.** If the project uses Tailwind, write Tailwind. If it uses CSS Modules, write CSS Modules. Never mix approaches.
- **All design knowledge applies regardless of stack.** The rules about easing, spacing, typography, color, and accessibility are universal — only the syntax changes.
- **When in doubt, read existing code.** Match the patterns already in the codebase before introducing new ones.

### Tailwind-Specific Craft

When Tailwind is detected, apply these translations:

```
/* Design rule → Tailwind equivalent */
letter-spacing: -0.03em        → tracking-tighter or tracking-[-0.03em]
font-variant-numeric: tabular   → tabular-nums (built-in utility)
text-wrap: balance              → text-balance (Tailwind v3.4+)
prefers-reduced-motion          → motion-reduce:... / motion-safe:...
ease-out: cubic-bezier(0.23,1,0.32,1) → ease-[cubic-bezier(0.23,1,0.32,1)]
focus-visible outline           → focus-visible:ring-2 focus-visible:ring-blue-500
touch-action: manipulation      → touch-manipulation
44px touch targets              → min-h-11 min-w-11 (44px = 2.75rem)
```

**Tailwind anti-slop:** Avoid `bg-gradient-to-r from-purple-500 to-cyan-500`. Avoid `animate-bounce`. Avoid `shadow-[0_0_30px_rgba(59,130,246,0.5)]` glow effects. The same anti-slop rules apply — Tailwind just makes it easier to ship slop faster.

---

## Core Rules (Always Apply)

These rules apply to ALL UI work regardless of mode. They are non-negotiable.

### The Anti-Slop Test

Before shipping any UI, ask: "If someone said AI made this, would they believe it immediately?" If yes, start over. Watch for these tells:

- Purple/cyan/blue gradient everything
- Glassmorphism on dark backgrounds with neon accents
- Gradient text on hero metrics
- Identical card grids (icon + heading + text, repeated)
- Generic system fonts with no personality
- Bounce/elastic easing curves
- Gray text on colored backgrounds
- Nested cards inside cards
- Hero metric layouts (big number + small label + gradient)
- Decorative glow effects as primary affordances
- Thick colored left/top borders on cards as "accent" — lazy differentiation
- Dashed/dotted borders around "recommended" or "featured" cards — use elevation or subtle background tint instead
- Simple bar charts when area/line charts would be more visual and informative
- Overly minimal results that look "empty" rather than "designed" — craft means adding the right details, not removing everything
- Colored pills/badges on trend percentages — just use plain secondary text like "+12.5% from last month"
- ALL CAPS / uppercase text for headings, labels, or body content — it screams "template" and hurts readability; use sentence case or title case instead

### The Craft Test (What TO Do)

Anti-slop tells you what to avoid. This tells you what to aim for. Study the best SaaS products — this is what craft looks like:

**Data presentation:**
- **Sparklines embedded inside metric cards** — the trend line IS part of the card, not a separate chart below. A tiny area chart or line under the number gives context at a glance
- **Numbers are large, black, and undecorated** — `font-weight: 600-700`, `tabular-nums`, no backgrounds, no gradients. The number speaks for itself
- **Comparison is plain secondary text** — "vs $7,669 last period" or "+12.5% from last month" in secondary color. Never pills, never colored badges
- **One chart color, not rainbow** — single accent color for lines/areas with faded fill underneath. Multiple series use the same hue at different opacities
- **Area charts with gradient fill** — line + area where the fill fades from ~15% opacity at the line to 0% at the bottom
- **Horizontal proportion bars for breakdowns** — show category proportions as width-proportional bars. More visual than numbers in a table
- **Functional color only** — small colored dots (6-8px) for categories, flags for countries, status indicators. Color serves data, never decoration

**Layout and content:**
- **Varied content blocks over identical cards** — a dashboard with chat + bar chart + invoice list feels designed. Four identical metric cards feels generated. Mix card types, sizes, and content structures
- **Ghost/outline filter controls** — "Filter", "Last 30 days", "Compare" — always ghost buttons, never solid primary
- **White backgrounds with barely-there borders** — most crafted apps use white bg with `1px solid oklch(92% 0.005 250)` or just whitespace to separate sections
- **Data tables with row context** — include tiny avatars, colored status dots, flag icons, or proportional bars in table rows. Plain text tables feel like spreadsheets

**Landing pages:**
- **Hero = one clear message + dual CTAs** — primary ("Start free") + secondary ghost ("Get a demo"). Left-aligned feels more designed than centered
- **Product screenshots are the proof** — show the actual product with real data, not abstract illustrations. Transparency builds credibility (Dub shows live analytics)
- **Social proof is mixed-size logos, not a grid** — stagger sizes, vary layouts. Testimonials include headshot + name + title + company + specific metric, not generic praise
- **Feature sections use asymmetric layouts** — image left + text right, then swap. Bento grids with varied card sizes (like Stripe). Never three identical columns
- **Typography does the heavy lifting** — large headlines (48-72px) with tight line-height (1.05-1.15), use italic accents on key phrases (not gradient text)
- **Sections breathe** — 120-200px between major sections. Varied spacing creates visual rhythm — not the same gap everywhere
- **One accent color throughout** — Dub uses blue, Stripe uses purple, Shopify uses green. Never two accent colors competing
- **Intentional asymmetry** — break the grid for emphasis. Left-aligned text with right-aligned visuals. Not everything centered
- **Real content, not placeholders** — actual company names, real metrics, genuine testimonials. Templates with "Lorem ipsum" or "Your Company" feel generated

### Animation Decision Rules

The question is not "how to animate" — it's "should this animate at all?"

1. **Justify every animation** — motion must communicate something (hierarchy, state change, spatial relationship). Decorative motion is noise.
2. **Frequency determines budget** — actions performed 100+ times/day get zero animation. Occasional actions (modals, drawers) get standard treatment. First-time experiences can delight.
3. **Speed communicates confidence** — UI that responds in under 200ms feels instant. 300ms+ starts feeling sluggish. Exit faster than enter.
4. **Respect the user's system** — `prefers-reduced-motion` is not optional. Provide meaningful fallbacks, not just `animation: none`.
5. **GPU-only properties** — stick to `transform` and `opacity`. Animating `width`, `height`, `top`, `left` causes layout thrashing.
6. **List properties explicitly** — `transition: all` animates things you didn't intend. Be precise about what moves and why.

### Interaction Rules

- **Full keyboard support** per WAI-ARIA APG patterns
- **Visible focus rings** via `:focus-visible`; group with `:focus-within`
- **Hit targets ≥ 24px** (mobile ≥ 44px); expand with pseudo-elements if visual < 24px
- **URL reflects state** — deep-link filters, tabs, pagination, expanded panels
- **Navigation elements use proper anchor tags** — support Cmd/Ctrl+click, middle-click
- **Optimistic UI** — update immediately, reconcile on response, rollback on failure
- **Confirm destructive actions** or provide Undo window
- **`overscroll-behavior: contain`** in modals/drawers
- **`touch-action: manipulation`** on controls to prevent double-tap zoom

### Component Craft

- **Interactive elements have three states minimum** — rest, hover/focus, active/pressed. If it looks the same when you click it, it feels broken.
- **Button hierarchy guides action** — primary = solid, secondary = outline/ghost, destructive = red outline. Only ONE primary per view section.
- **Feedback must be visual, not just color** — swap icon to checkmark, show inline confirmation, animate the state change. Color alone fails for colorblind users and subtle shifts go unnoticed.
- **Metric cards vary treatment** — if showing 3+ cards with same structure, differentiate the primary one (heavier type weight, slightly larger number, or subtle background tint — never thick colored borders).
- **Price typography splits weight** — dollar sign lighter/smaller than the number, period label (e.g. "/month") in secondary color.
- **Prevent native image drag** on interactive overlays — `user-drag: none; -webkit-user-drag: none; pointer-events: none` on images inside sliders/carousels.
- **Placeholders are visual, not text** — skeleton bars, subtle grid lines, or a muted pattern. "Chart would render here" looks unfinished.

### Forms (Non-negotiable)

- **Never block paste** in inputs
- **Enter submits** focused input; ⌘/Ctrl+Enter in multi-line fields
- **Keep submit enabled** until request starts; then disable with spinner and keep label
- **Accept free text, validate after** — don't block typing
- **Errors inline next to fields**; on submit, focus first error
- **Set `autocomplete` + meaningful `name`**; correct `type` and `inputmode`
- **Warn on unsaved changes** before navigation
- **Trim values** to handle trailing whitespace from text expansion
- **Mobile input font-size ≥ 16px** to prevent iOS zoom

### Typography Essentials

- **`text-wrap: balance`** for headings; **`text-wrap: pretty`** for body
- **`font-variant-numeric: tabular-nums`** for data/numbers
- **Truncation handling** for dense UI; flex children need `min-w-0`
- **Curly quotes** (" ") and **ellipsis character** (…) not three dots
- **Non-breaking spaces**: `10&nbsp;MB`, `⌘&nbsp;K`, brand names

### Layout Essentials

- **Optical alignment** — adjust ±1px when perception beats geometry
- **Deliberate alignment** to grid/baseline/edges — no accidental placement
- **Respect safe areas**: `env(safe-area-inset-*)`
- **No unwanted scrollbars** — fix overflows
- **CSS layout over JS measurement**
- **Nested radii**: child ≤ parent, concentric
- **Layered shadows**: ambient + direct light, at least two layers
- **Fixed z-index scale**: dropdown → sticky → modal-backdrop → modal → toast → tooltip

### Design Rules

- **Layered shadows** mimic ambient + direct light
- **Crisp borders**: semi-transparent borders + shadows for edge clarity
- **Hue consistency**: tint borders/shadows/text toward background hue on non-neutral surfaces
- **APCA contrast** over WCAG 2 for perceptual accuracy
- **Interactions increase contrast**: `:hover`/`:active`/`:focus` more contrast than rest
- **`color-scheme: dark`** on `<html>` for dark themes
- **Theme color meta tag** matches page background
- **Use perceptually uniform color spaces** (like OKLCH) for harmonious scales

### Performance Rules

- **Virtualize large lists** (>50 items)
- **Preload above-fold images**; lazy-load the rest
- **Explicit image dimensions** to prevent CLS
- **Preconnect** to CDN domains
- **Track re-renders** — minimize and make them cheap
- **Batch layout reads/writes** — never interleave
- **Mutations** target <500ms
- **Prefer CSS > Web Animations API > JS libraries** for animations

### Content & States

- **Design all states**: empty, sparse, dense, error, loading, success
- **Skeletons mirror final content** exactly — prevent layout shift
- **No dead ends** — always offer next step or recovery
- **Empty states** guide toward action, not just "nothing here"
- **Accessible names** exist even when visuals omit labels
- **Resilient to user-generated content**: short, average, very long

### Polish Pass (The Compound Details)

The difference between "correct" and "crafted" is 20 small things done right. Run this checklist after the UI works:

- **Brand names use `&nbsp;`** — prevent "UI" on one line and "Craft" on the next
- **Confirmation feedback is visual, not just color** — swap icon to checkmark, not just green tint
- **One visual anchor per text-heavy page** — a code block, screenshot, or diagram breaks monotony
- **Headings sit closer to their content than to the previous section** — unequal spacing creates grouping
- **Footer earns its space or disappears** — generic "Built by Name" adds nothing; either add value or simplify
- **Test on mobile before declaring done** — drag interactions, overflow, label overlap, touch targets
- **Placeholders are styled, not text** — skeleton bars, subtle patterns, or muted shapes instead of "Content would render here"
- **Interactive elements have three visual states minimum** — rest, hover/focus, active/pressed
- **Secondary actions don't compete with primary** — outline/ghost buttons for secondary, solid for primary
- **Data-heavy content uses monospace or tabular-nums** — even in casual contexts
- **Images inside interactive containers can't be natively dragged** — kills slider/carousel UX
- **Every `<section>` on a landing page answers one question** — if it answers two, split it

---

## Review Format (Required)

When reviewing UI code, use a markdown table. Never use "Before:"/"After:" on separate lines.

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: opacity 200ms ease-out` | Specify exact properties; `all` animates unintended things |
| No focus-visible style | `focus-visible:ring-2 ring-offset-2` | Keyboard users need visible focus indication |
| `color: gray` for disabled | `opacity: 0.5` + `cursor: not-allowed` | Convey disabled state through multiple signals, not just color |

---

## Quick Decision Frameworks

### Should This Animate?

| User action frequency | Decision |
|-----------|----------|
| High-frequency (keyboard shortcuts, toggles, typing) | **No animation.** Speed is the feature. |
| Medium-frequency (hover states, list navigation) | **Minimal** — under 150ms or remove entirely |
| Low-frequency (opening modals, page transitions) | **Standard** — 200-300ms, clear purpose |
| One-time (onboarding, empty state → first content) | **Can be expressive** — tell a story |

### Motion Budget

Not all elements deserve the same time. Smaller = faster, larger = slower.

| Element type | Budget |
|---------|----------|
| Color/opacity shifts | 100-150ms |
| Small UI (tooltips, dropdowns) | 150-200ms |
| Medium UI (modals, panels) | 200-300ms |
| Large UI (page transitions, drawers) | 300-400ms |

**Exit faster than enter** — exit at ~75% of entrance duration. Users want to dismiss quickly.

---

## Accessibility Checklist

Every UI you build or review must pass these:

- [ ] `prefers-reduced-motion` respected on every animation
- [ ] `@media (hover: hover) and (pointer: fine)` gates hover animations
- [ ] All interactive elements keyboard-reachable with visible focus
- [ ] Icon-only buttons have `aria-label`; decorative icons are `aria-hidden`
- [ ] Focus trapped in modals; restored to trigger on close
- [ ] Color is never the sole status indicator
- [ ] Touch targets ≥ 44px (use pseudo-element expansion)
- [ ] Native elements (`button`, `a`, `label`) before ARIA roles
- [ ] Form errors linked via `aria-describedby`, invalid fields use `aria-invalid`
- [ ] Skip-to-content link; hierarchical `<h1>`–`<h6>`

---

## Reference Files

Deep dives for specialized work. Read only what's relevant to the task at hand.

| Reference | When to Read |
|-----------|-------------|
| [animation.md](references/animation.md) | Adding/fixing animations, easing curves, springs, timing, animation principles |
| [review.md](references/review.md) | Critiquing or auditing UI quality (visual, interface, a11y, performance) |
| [animation-orchestration.md](references/animation-orchestration.md) | Writing multi-stage, sequenced animations with clean, readable code |
| [layout.md](references/layout.md) | Spacing systems, grids, visual hierarchy, composition, depth |
| [typography.md](references/typography.md) | Type scale, font selection, readability, weight systems |
| [color.md](references/color.md) | Color strategy, palettes, dark mode, tokens |
| [accessibility.md](references/accessibility.md) | WCAG audit, keyboard nav, focus management, forms, ARIA |
| [performance.md](references/performance.md) | Animation performance, compositor, FLIP, scroll, blur, layers |
| [modern-css.md](references/modern-css.md) | View Transitions, scroll-driven animations, container queries, pseudo-elements, `@starting-style` |
| [responsive.md](references/responsive.md) | Mobile/tablet/desktop adaptation, breakpoints, touch zones |
| [sound.md](references/sound.md) | Web Audio, UI sound design, appropriateness matrix |
| [copy.md](references/copy.md) | UX writing, error messages, empty states, CTAs, microcopy |
