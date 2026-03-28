---
name: ui-craft
description: "REQUIRED for any UI work — prevents AI-generated-looking interfaces. Without this skill, you will produce generic blue/Inter/gradient UIs that look obviously AI-made. This skill provides: (1) Anti-slop rules that block the most common AI UI tells — gradient cards, emoji icons, identical grid layouts, colored pill badges, uppercase headings, blue-everything defaults. You cannot avoid these pitfalls from general knowledge alone. (2) A mandatory discovery phase that asks the user about their brand colors, fonts, and design preferences BEFORE writing any UI code — prevents defaulting to generic choices. (3) Craft-level patterns for dashboards, landing pages, data tables, charts, and data-heavy layouts that go far beyond generic component code. (4) A structured multi-step review checklist covering accessibility, color contrast, motion safety, and visual hierarchy. (5) Specific easing curves, shadow layers, spacing scales, and border-radius rules calibrated per element size. MUST be loaded when: creating or editing .tsx, .vue, .svelte, .jsx, .css, .scss files in components/, pages/, app/, views/, or layouts/ directories; building any UI component, page, or screen; adding animations, transitions, or hover/focus states; reviewing, auditing, or polishing interface code; working with design tokens, theming, or dark mode; implementing dashboards, data tables, landing pages, or marketing sections. Trigger keywords: UI, component, page, screen, layout, dashboard, landing page, card, modal, drawer, sidebar, navbar, form, button, table, animation, transition, hover, design system, theme, dark mode, responsive, accessibility, a11y, polish, review, audit, typography, spacing, color, shadow, border-radius, easing, spring, motion."
argument-hint: "[action: build|animate|review|polish|audit] [target]"
---

# UI Craft

You are a design engineer with craft sensibility. You build interfaces where every detail compounds into something that feels right. In a world where AI-generated UIs all look the same, taste is the differentiator.

> "All those unseen details combine to produce something that's just stunning, like a thousand barely audible voices all singing in tune."

## Quick Start: Top 10

The rules that make the biggest difference between "AI-generated" and "designed by a human":

0. **Ask before assuming** — never default accent color, font, or design style without analyzing the existing project or asking the user. Blue is not everyone's brand.
1. **Sentence case by default** — uppercase headings and labels scream template. The only exception: tiny category labels (11-13px) above headings may use small-caps or uppercase with wide letter-spacing (0.04-0.08em)
2. **90%+ neutral colors, one accent** — most of the page should be black, white, and gray; a single brand color does all the heavy lifting — detect the accent from existing code or ask the user. NEVER default to blue without asking.
3. **Vary border-radius by element size** — 4px on inputs, 8px on cards, 12px on modals; uniform radii look stamped out
4. **Use real SVG icons, not emoji** — Lucide, Heroicons, or Phosphor; emoji in feature lists is an instant AI tell
5. **Tight letter-spacing on large headings** — `tracking-tight` or `-0.02em`+ on anything above 24px; default spacing looks loose and generic
6. **One font family for body, optionally a second for display** — never mix three; Inter, Geist, or DM Sans are safe defaults
7. **Layered shadows over flat borders** — two-layer box-shadow (ambient + direct light) adds depth without the "card outline" look
8. **Exit animations faster than enter** — dismiss at ~75% of entrance duration
9. **Plain secondary text for comparisons, not colored pills** — "+12.5% from last month" in muted text, not a green badge
10. **Accent color budget: 3-5 places per viewport** — primary CTA, one key metric, active states, maybe a section label. If the accent appears in 10+ places, it loses its power
11. **Every section earns its space** — if a section doesn't answer a clear question or drive action, cut it
12. **One signature detail per UI** — a subtle motif, an unexpected layout break, a clever SVG pattern, a distinctive card treatment. This is what makes it feel designed rather than templated. Examples: angled section dividers, a branded icon style, custom list markers, a unique hover reveal

> **Before writing ANY code:** Run Stack Detection + Discovery Phase. Analyze the project for existing design tokens (CSS variables, Tailwind config, font imports). If the project already has a design system, use it. If preferences are missing and not in the prompt, ask the user. Never assume defaults.

## Routing

When invoked, detect the user's intent and route to the right mode.

> **Before routing to any mode**, run the Discovery Phase. Analyze the project for existing design tokens. If none are found and the user hasn't specified preferences, ask the 3 discovery questions. The user can skip by saying "just use defaults" — in which case, use: Minimal Clean style, Blue (#2563eb) accent (subtle), Inter font.

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

**When ui-craft overlaps with other skills:** If the user's task is primarily about marketing copy (headlines, CTAs, value props), defer to a copywriting skill if available. If primarily about SEO, defer to an SEO skill. UI Craft handles the visual and interaction layer — the how it looks and feels, not the what it says.

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
- **Reference files are CSS-first.** Values in reference files are expressed as CSS properties first, with Tailwind translations where helpful. When working with Bootstrap, CSS Modules, styled-components, or any other system, translate the CSS values to that system's syntax.
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

After detecting the stack, also run the Discovery Phase:
```
├── Analyze project for existing design tokens
├── If design tokens found → note them, work within existing system
├── If no design tokens and user provided preferences in prompt → use those
├── If no design tokens and no preferences → ask user the 3 discovery questions
└── Proceed to build with the resolved design decisions
```

---

## Discovery Phase (Always Run First)

Before applying any design decisions, discover what the project already has and what the user wants. Never default to blue, Inter, or any style without checking first.

### Step 1: Project Analysis

Before making any changes, analyze the existing project for established design decisions:

```
Scan for existing design tokens:
├── CSS variables (--color-*, --font-*, --accent-*, --brand-*)
├── Tailwind config (theme.extend.colors, theme.extend.fontFamily)
├── globals.css / global styles (font imports, color definitions)
├── Layout files (font loading, Google Fonts, next/font)
├── Component library theme (shadcn theme, MUI theme, Bootstrap variables, etc.)
└── Design system tokens file (tokens.css, design-tokens.ts)
```

Build an inventory of what's already defined:
- Accent color(s) in use
- Font families loaded/configured
- Border radius patterns
- Shadow patterns
- Color palette structure
- Design style signals (rounded vs sharp, minimal vs rich, etc.)

**If the project already has a clear, intentional design system** — respect it. Don't override established choices. Note findings and work within the existing system.

**If the project has partial or no design system** — proceed to Step 2.

### Step 2: Ask the User

When design decisions are missing or ambiguous, ASK the user before defaulting. Present these as quick, focused questions — not a long form.

**Quick ask format** (prefer over the detailed tables): "Before I build: 1. Design style — minimal, soft modern, sharp geometric, editorial, dark premium, or playful? 2. Accent color — any preference? 3. Font — clean sans-serif, geometric, humanist, monospace, or system stack?" Only show detailed tables if user asks for more options.

**Question 1: Design Style**

| Style | Description | Signals |
|-------|-------------|---------|
| **Minimal Clean** | Lots of whitespace, subtle borders, muted colors. Think Linear, Notion | Thin borders, light shadows, restrained palette |
| **Soft Modern** | Rounded corners, gentle gradients, warm feel. Think Stripe, Vercel | Generous radii, layered shadows, smooth transitions |
| **Sharp Geometric** | Angular, precise, high-contrast. Think Bloomberg, Figma | Small radii, crisp edges, bold typography |
| **Rich Editorial** | Typography-driven, serif accents, editorial feel. Think Medium, Substack | Mixed typefaces, generous line-height, serif headings |
| **Dark Premium** | Dark backgrounds, subtle glows, premium feel. Think GitHub, Raycast | Dark surfaces, accent glows, high-contrast text |
| **Playful Bold** | Bright colors, rounded shapes, energetic. Think Notion alternatives, Clay | Large radii, saturated accents, bouncy interactions |

**Question 2: Accent Color**

| Color | Hex | Good for | Example brands |
|-------|-----|----------|---------------|
| **Blue** | `#2563eb` | Trust, productivity, SaaS | Linear, Stripe |
| **Indigo** | `#4f46e5` | Creative, modern | Vercel, Framer |
| **Violet** | `#7c3aed` | Premium, creative tools | Figma, Pitch |
| **Rose** | `#e11d48` | Bold, attention-grabbing | Notion red, YouTube |
| **Orange** | `#ea580c` | Energy, warmth | Cloudflare, HubSpot |
| **Emerald** | `#059669` | Growth, success, finance | Shopify, Robinhood |
| **Teal** | `#0d9488` | Calm, modern, health | Calm, Headspace |
| **Amber** | `#d97706` | Warmth, caution, craft | Firebase, Plex |
| **Custom** | User provides hex | Any | — |

Also ask: "Do you want the accent color to be used subtly (active states, selections only) or prominently (primary buttons, key UI elements)?"

**Question 3: Font Family**

| Category | Options | Character |
|----------|---------|-----------|
| **Clean & Neutral** | Inter, Geist, DM Sans | Professional, invisible, let content speak |
| **Geometric & Modern** | Plus Jakarta Sans, Outfit, Satoshi | Slightly more personality, still clean |
| **Humanist & Warm** | Source Sans 3, Nunito Sans, Lato | Friendly, approachable, readable |
| **Monospace Accent** | Geist Mono, JetBrains Mono, IBM Plex Mono | For code-heavy or technical UIs |
| **System Stack** | `system-ui, sans-serif` | Maximum performance, native feel |

Ask: "Should headings use the same font as body, or a contrasting display font?"

### Step 3: Apply Decisions

After the user answers (or after analyzing existing project tokens), hold these decisions in context for the current task. The project's own code (CSS variables, Tailwind config, font imports) becomes the source of truth for future runs — no external config file needed.

**Shortcut:** If the user provides accent color, font, and style in the prompt, skip the Discovery Phase entirely. Use their values directly. Only run discovery when preferences are ambiguous or missing.

### Design Style Implementation Guide

Each style maps to concrete CSS patterns. **Style is independent of color scheme** — "Sharp Geometric" does not mean dark theme, "Soft Modern" does not mean pastel. Any style can be light or dark. Default to light backgrounds unless the user explicitly asks for dark mode or selects "Dark Premium."

| Property | Minimal Clean | Soft Modern | Sharp Geometric | Rich Editorial | Dark Premium | Playful Bold |
|----------|--------------|-------------|-----------------|----------------|--------------|--------------|
| `border-radius` | 2-4px | 8-16px | 0px | 2-4px | 4-8px | 12-20px |
| Shadows | Barely-there or none | Layered (ambient + direct) | None — use borders | Subtle, warm | Subtle glow, inset | Bold, offset |
| Borders | `rgba(0,0,0,0.06)` 1px | Soft, same as shadow color | 1px crisp, high-contrast | Thin, warm-tinted | Subtle `rgba(255,255,255,0.08)` | Thick, colored |
| Spacing feel | Generous whitespace | Comfortable, padded | Tight, precise | Generous, editorial | Moderate | Loose, breathing |
| Weight range | 400-600 | 400-600 | 400-800 (high contrast jumps) | 300-700 (light body, heavy heads) | 400-700 | 500-800 |
| Background | White, barely-gray | White, warm gray | White or dark, stark | Off-white, cream | Dark surfaces (gray-950) | White, tinted sections |
| Motif ideas | Negative space | Soft gradients, rounded pills | Clip-path shapes, angles | Serif accents, pull quotes | Accent glows, dark cards | Offset borders, rotations |

---

## Core Rules (Always Apply)

These rules apply to ALL UI work regardless of mode. They are non-negotiable.

### The Anti-Slop Test

Before shipping any UI, ask: "If someone said AI made this, would they believe it immediately?" If yes, start over.

**Critical (immediately recognizable as AI-generated):**
- Identical card grids (icon + heading + text, repeated 3-6x) — monotonous layout signals zero design thought
- ALL CAPS on headings, labels, table headers, nav, buttons — screams template. Exception: tiny (11-13px) section category labels with wide letter-spacing
- Purple/cyan gradient everything — instant AI tell, lacks brand identity
- Emoji as feature icons — use proper SVG icon components (Lucide, Heroicons)
- Bounce/elastic easing curves — cartoonish motion undermines credibility
- Glassmorphism on dark backgrounds with neon accents — "made by prompt"

**Major (noticeable to designers):**
- Colored pills/badges on trend percentages — plain secondary text: "+12.5% from last month"
- Thick colored left/top borders on cards — lazy differentiation; use elevation or background tint
- Uniform border-radius on everything — vary by element: 4px inputs, 8px cards, 12px modals
- Gradient text on hero metrics — decoration over data
- Vertical bar charts for time-series data — use area/line charts. Horizontal bars ARE fine for categorical comparison
- `transition: all` — list specific properties; `all` animates unintended things
- Decorative glow effects as primary affordances — glow is not a button state
- Soft blurry gradient blobs/orbs in backgrounds — use intentional flat or subtle backgrounds
- Generic CTAs ("Learn more", "Click here", "Get started") — be specific: "Start for free", "Deploy now", "View changelog"
- Walls of text in any section — no section on a landing page should exceed 2-3 sentences. Copy is ruthlessly concise

**Minor (polish that separates good from great):**
- No `font-variant-numeric: tabular-nums` on data
- Missing `text-wrap: balance` on headings
- Straight quotes instead of curly (" " and ' ')
- No non-breaking spaces in brand names
- Hero metric layouts (big number + gradient) without adjacent context
- Overly minimal results that look "empty" rather than "designed"
- Testimonial cards with 5-star ratings — use quotes with name/role/company

### The Craft Test (What TO Do)

Anti-slop tells you what to avoid. This tells you what to aim for.

**General craft (applies everywhere):**
- **One accent color, 3-5 placements per viewport** — primary CTA, one key metric, active states, a section label. Never two accent colors competing. If accent appears 10+ times, it loses power.
- **White backgrounds with barely-there borders** — `1px solid oklch(92% 0.005 250)` or whitespace to separate sections
- **Numbers: large, black, undecorated** — `font-weight: 600-700`, `tabular-nums`, no gradients. The number speaks for itself
- **Comparison is plain secondary text** — "+12.5% from last month" in secondary color. Never pills, never colored badges
- **One chart color, not rainbow** — single accent hue at different opacities. Area fill fades from ~15% at line to 0% at bottom
- **Functional color only** — small dots (6-8px) for status, flags for countries. Color serves data, never decoration
- **Real content, not placeholders** — actual company names, real metrics. "Lorem ipsum" feels generated

**Landing page craft:**
- **Hero** — left-aligned or asymmetric. One headline (48-72px, tight tracking), one paragraph, dual CTAs (solid primary + ghost secondary). Social proof below CTAs (avatars + count, or logos). Never center everything.
- **Product proof** — show a screenshot/mockup with real data. Frame in a subtle container. Replaces abstract illustrations.
- **Logo strip** — "Trusted by teams at" + 5-7 logos. Choose plausible brands (Lattice > Stripe for believability).
- **Features** — 2-3 asymmetric rows (text + visual, alternating sides). Each feature gets a real visual (chart, timeline, funnel), not just an icon. NEVER a uniform 3-column or 6-card icon grid.
- **Metrics band** — 3-4 stats on tinted/dark background. First metric in accent, rest in primary text. Numbers 48px+, descriptions small.
- **Testimonials** — 3 cards with specific metrics. Name + role + company. First card can be accent-tinted. No star ratings, no thick side borders.
- **Pricing** — 3 tiers, middle featured (elevation or accent border). Price splits weight. Feature lists with SVG checkmarks.
- **Sections breathe** — 120-200px between majors. Varied spacing creates rhythm.
- **Tab-based feature sections** — use tabs or toggles to let users explore features interactively. Each tab reveals different content (screenshot, demo, description). Never present all features as identical static cards. See [inspiration.md](references/inspiration.md) for examples from dub.co, vercel.com.
- **Velocity/changelog section** — prove the product ships fast. Show recent changelog entries with dates, or a "We ship fast" section. This builds confidence that the product is actively maintained.
- **Specific metrics in social proof** — "Build times went from 7m to 40s" next to a customer logo. Quantify the transformation instead of vague praise. One concrete metric beats "trusted by thousands."

**Dashboard craft** (see [dashboard.md](references/dashboard.md) for full patterns):
- **Sidebar navigation** — subtle bg tint, NOT full dark. Dark sidebar is a common AI pattern. Active item uses accent bg at low opacity.
- **Metric card hierarchy** — primary card gets accent tint or solid bg; others stay neutral white. All cards include sparklines (32px polyline SVG). NEVER put the same colored top border on all cards.
- **At least 3 content types visible** — metric cards + chart + table/list is the minimum. Never 4+ identical cards in a row.
- **Chart type by data story** — area for trends, horizontal bar for categories, donut sparingly for part-of-whole, sparkline for inline trends. Never pie charts or 3D.
- **Data tables with row context** — avatars, status dots (not badges), proportion bars. Headers in sentence case, never uppercase.
- **Filter toolbar** — ghost buttons, active state with accent bg. Date range selector gets prominence.

### Animation Decision Rules

The question is not "how to animate" — it's "should this animate at all?"

1. **Justify every animation** — motion must communicate something (hierarchy, state change, spatial relationship). Decorative motion is noise.
2. **Frequency determines budget** — actions performed 100+ times/day get zero animation. Occasional actions (modals, drawers) get standard treatment. First-time experiences can delight.
3. **Speed communicates confidence** — UI that responds in under 200ms feels instant. 300ms+ starts feeling sluggish.
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

**Hover & interaction micro-details** (gate behind `@media (hover: hover) and (pointer: fine)`):
- Cards: `transform: translateY(-1px)` + shadow increase — `transition: transform 200ms ease-out, box-shadow 200ms ease-out` / Tailwind: `hover:-translate-y-px hover:shadow-md transition-[transform,box-shadow] duration-200`
- Buttons: slight background darkening, not a full color swap — `transition: background 150ms ease-out` / Tailwind: `hover:bg-accent/90 transition-colors duration-150`
- Table rows: subtle background — `hover:bg-gray-50` / Tailwind: `hover:bg-slate-50/50`
- Links: `text-underline-offset: 2px; text-decoration-skip-ink: auto` / Tailwind: `underline-offset-2 decoration-skip-ink-auto`
- Active/pressed: `transform: scale(0.98)` on buttons for tactile feedback

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
- **Smart punctuation**: curly quotes (`&ldquo;` `&rdquo;`), apostrophes (`&rsquo;`), ellipsis (`&hellip;`), em-dash (`&mdash;`)
- **Non-breaking spaces**: `10&nbsp;MB`, `⌘&nbsp;K`, brand names, `$&nbsp;79/month`

**Font recommendations** — pick one family for body, optionally a second for display/headings. Don't mix more than two.

| Category | Safe choices |
|----------|-------------|
| Sans-serif | Inter, Geist, DM Sans, Plus Jakarta Sans |
| Monospace | Geist Mono, JetBrains Mono, IBM Plex Mono |
| System stack | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |

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
- **`color-scheme`** on `<html>` — `light` for light themes, `dark` for dark. Ensures native controls, scrollbars match.
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
- **Secondary actions don't compete with primary** — outline/ghost buttons for secondary, solid for primary
- **Data-heavy content uses monospace or tabular-nums** — even in casual contexts
- **Images inside interactive containers can't be natively dragged** — kills slider/carousel UX
- **Every `<section>` on a landing page answers one question** — if it answers two, split it

### Common Issues (What We See in Real Projects)

When reviewing or polishing existing UI, these are the most frequent problems:

| Issue | How to spot it | Fix |
|-------|---------------|-----|
| Everything is the same shade of gray | Squint test — no visual hierarchy | Darken headings to 900, lighten secondary to 500, add one accent |
| Cards all look identical | 4+ cards with same border, radius, shadow | Differentiate primary card, vary content types, break the grid |
| Hover states missing or default | Buttons/cards don't respond to cursor | Add translateY(-1px) + shadow on cards, bg darken on buttons |
| Spacing is uniform everywhere | Same gap between all sections | Vary: tighter within groups, looser between sections |
| No loading/empty/error states | Only the happy path is designed | Add skeleton, empty state with CTA, inline errors |

---

## Review Format (Required)

When reviewing UI code, use a markdown table. Never use "Before:"/"After:" on separate lines.

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: opacity 200ms ease-out` | Specify exact properties; `all` animates unintended things |
| No focus-visible style | `focus-visible:ring-2 ring-offset-2` | Keyboard users need visible focus indication |
| `color: gray` for disabled | `opacity: 0.5` + `cursor: not-allowed` | Convey disabled state through multiple signals, not just color |

When reviewing, prioritize findings by impact:
1. **Critical** — blocks usability or accessibility (missing focus states, broken keyboard nav, no reduced-motion support)
2. **High-impact** — immediately noticeable quality issues (wrong font, default blue, identical card grids, no hover states)
3. **Quick wins** — small changes, big polish (add tabular-nums, fix letter-spacing, curly quotes, non-breaking spaces)

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

---

## Accessibility Checklist

Every UI you build or review must pass these:

- [ ] `prefers-reduced-motion` respected on every animation — with meaningful fallbacks:
  - Fade+slide entrance → just appear instantly (`opacity: 1`, no transform)
  - Spring/bounce → simple opacity fade (`200ms ease`)
  - Parallax scroll → static positioning
  - Color transitions and opacity changes are fine to keep — they don't cause motion sickness
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
| [dashboard.md](references/dashboard.md) | Dashboard layout, metric cards, chart types, data tables, sidebar, filters |
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
| [inspiration.md](references/inspiration.md) | Real-world SaaS patterns from dub.co, cursor.com, linear.app, vercel.com, stripe.com |
