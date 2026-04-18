# UI Review & Critique

Systematic methodology for reviewing interface quality — visual design, interaction, accessibility, and performance.

---

## How to Use

- **`/ui-craft:critique <file>`** — UX critique, flag issues, no code changes
- **`/ui-craft:audit <file>`** — Technical audit (a11y, perf, responsive), severity-ranked
- **`/ui-craft:polish <file>`** — Apply the Polish Pass compound details directly

---

## Review Output Format

For file reviews, use terse findings:

```
file:line - [category] description of issue → fix
```

Example:
```
components/modal.tsx:45 - [animation] Exit 400ms exceeds 300ms limit → reduce to 200ms
components/button.css:12 - [interaction] Missing :active transform → add scale(0.97)
```

---

## Critique Methodology (for screenshots or deep review)

Follow this sequence. Each section is a separate lens.

### Step 0: Context
- **What is this?** (app type, screen purpose, target user)
- **Emotional context?** (stressful? casual? high-stakes? routine?)

### Step 1: Anti-Slop Detection (CRITICAL)

Run the Anti-Slop Test from SKILL.md (Critical → Major → Minor). Every item present is a finding.

**The test**: "If someone said AI made this, would they believe it immediately?"

### Step 2: First Impressions
One paragraph on gut reaction. Be honest and direct. This is the "noticing" step — seeing what's actually there, not what you expect.

### Step 3: Visual Design

| Dimension | What to Look For |
|-----------|-----------------|
| Color intentionality | Every color purposeful? Too many competing backgrounds/accents? |
| Typographic hierarchy | Clear scale from most to least important? Count distinct sizes/weights |
| Shadow & stroke quality | Crisp or muddy? Borders competing with content? |
| Visual weight vs importance | Heaviest elements = most important? Decorative stealing attention? |
| Spacing & alignment | Consistent? Clear grid? Excess padding? |
| Icon consistency | Same family, weight, stroke width, optical size? |

For each issue:
> **[Issue name]** — [Specific factual observation]. [Impact on user]. [What it could be instead.]

Be precise. Count things. Quote text. Name colors. Measure relative sizes.

### Step 4: Interface Design

| Dimension | What to Look For |
|-----------|-----------------|
| Focusing mechanism | Clear where to look first? Visual entry point? |
| Progressive disclosure | Complexity revealed gradually? 40 things when 5 would suffice? |
| Information density | Appropriate for context? |
| Expectation setting | User knows what happens next? Progress communicated? |
| Feedback & reward | Actions acknowledged? Completed items celebrated? |
| Redundancy | Labels repeating known information? Can anything be removed? |

Frame as missed opportunities:
> "We're missing an opportunity to [reward progress / reduce cognitive load / etc.]"

### Step 5: Consistency & Conventions

| Dimension | What to Look For |
|-----------|-----------------|
| Pattern consistency | Similar actions handled the same way? |
| Platform conventions | Follows established patterns? Deviations intentional? |
| Component reuse | Elements that should be same component but aren't? |
| Visual language cohesion | Feels like one designer or assembled from different kits? |

### Step 6: User Context
- **How does this make the user feel?** Name the emotion.
- **User's likely state of mind?** Anxious? Focused? Under pressure?
- **Does the interface respect that state?**
- **What would "uncommon care" look like here?**

---

## Comprehensive Audit Checklist

### Animation Audit
- [ ] No `transition: all` — properties listed explicitly
- [ ] No `scale(0)` entry — starts from `scale(0.95)` with `opacity: 0`
- [ ] No `ease-in` on UI elements — use `ease-out` or custom curve
- [ ] No `transform-origin: center` on popovers — set to trigger location (modals exempt)
- [ ] No animation on keyboard actions
- [ ] No duration > 300ms on UI elements
- [ ] No hover animation without `@media (hover: hover) and (pointer: fine)`
- [ ] No keyframes on rapidly-triggered elements — use CSS transitions
- [ ] Animation library uses compositor-promoted properties under load
- [ ] Exit faster than enter
- [ ] Stagger delays ≤ 50ms per item
- [ ] `prefers-reduced-motion` respected

### Interaction Audit

Full checklist lives in `accessibility.md` (**Quick Checklist** + **Forms**). Fast pass:

- [ ] Full keyboard navigation (WAI-ARIA APG)
- [ ] Visible focus rings (`:focus-visible`)
- [ ] Hit targets ≥ 24px (44px mobile)
- [ ] URL reflects state (filters, tabs, pagination)
- [ ] Links use `<a>`/`<Link>`, not `<div onClick>`
- [ ] Destructive actions confirmed or Undo provided
- [ ] Loading buttons show spinner + keep label
- [ ] Forms: paste not blocked, errors inline, autocomplete set
- [ ] `overscroll-behavior: contain` in modals/drawers
- [ ] `touch-action: manipulation` on controls

### Layout Audit
- [ ] Optical alignment (±1px adjustments where needed)
- [ ] Deliberate grid/baseline/edge alignment
- [ ] Responsive: mobile, laptop, ultra-wide verified
- [ ] Safe areas respected
- [ ] No unwanted scrollbars
- [ ] Flex children have `min-w-0` for truncation
- [ ] Text containers handle long content
- [ ] Empty states handled

### Design Audit
- [ ] Layered shadows (ambient + direct)
- [ ] Nested radii: child ≤ parent
- [ ] Hue-consistent borders/shadows on colored backgrounds
- [ ] APCA contrast met
- [ ] Interactions increase contrast
- [ ] `color-scheme: dark` on html in dark themes
- [ ] `theme-color` matches background
- [ ] `tabular-nums` for number comparisons
- [ ] `text-wrap: balance` on headings

### Performance Audit
- [ ] Only compositor props animated (`transform`, `opacity`)
- [ ] No layout thrashing (interleaved reads/writes)
- [ ] Large lists virtualized (>50 items)
- [ ] Images: preload above-fold, lazy rest, explicit dimensions
- [ ] Re-renders minimized
- [ ] CSS variables not animated on deep trees
- [ ] `will-change` used temporarily and surgically
- [ ] Blur ≤ 8px, never continuous, never on large surfaces

---

## Output Format for Critiques

```
## Context
[1-2 sentences]

## Anti-Slop Verdict
[Pass/fail with specific tells]

## First Impressions
[1 paragraph, direct]

## Visual Design
[Issues as: **Issue Name** — observation. Impact. Opportunity.]

## Interface Design
[Issues framed as missed opportunities]

## Consistency & Conventions
[Pattern issues]

## User Context
[Empathy-driven observations]

## Top Opportunities
[Ranked 3-5 highest-impact changes, one sentence each]
```

---

## Voice Rules

### BE:
- **Specific** — "There are six columns per row" not "a lot of data"
- **Decisive** — "This is overwhelming" not "might feel overwhelming"
- **Factual first** — State what you see before judging
- **Impact-aware** — Connect observation to user impact
- **Constructive** — Every problem paired with opportunity
- **Quantitative** — Count elements, name colors, measure sizes

### DO NOT:
- Hedge ("maybe", "perhaps")
- Apologize ("unfortunately")
- Be vague ("feels off" without specifics)
- Add praise padding (no manufactured positivity)
- Prescribe without reasoning

### Severity Priority
1. **Structural** — information architecture, mental model, missing functionality
2. **Behavioral** — response, flow, communication
3. **Visual** — color, type, spacing, shadows

---

## Polish Pass (Compound Details)

The difference between "correct" and "crafted" is 20 small things done right. Run this checklist after the UI works (required when CRAFT_LEVEL is 8+):

- **Brand names use `&nbsp;`** — prevent "UI" on one line and "Craft" on the next
- **Confirmation feedback is visual, not just color** — swap icon to checkmark, not just green tint
- **One visual anchor per text-heavy page** — a code block, screenshot, or diagram breaks monotony
- **Headings sit closer to their content than to the previous section** — unequal spacing creates grouping
- **Footer earns its space or disappears** — generic "Built by Name" adds nothing
- **Test on mobile before declaring done** — drag interactions, overflow, label overlap, touch targets
- **Secondary actions don't compete with primary** — outline/ghost for secondary, solid for primary
- **Data-heavy content uses monospace or tabular-nums** — even in casual contexts
- **Images inside interactive containers can't be natively dragged** — kills slider/carousel UX
- **Every `<section>` on a landing page answers one question** — if it answers two, split it

---

## Common Issues (What We See in Real Projects)

When reviewing or polishing existing UI, these are the most frequent problems:

| Issue | How to spot it | Fix |
|-------|---------------|-----|
| Everything is the same shade of gray | Squint test — no visual hierarchy | Darken headings to 900, lighten secondary to 500, add one accent |
| Cards all look identical | 4+ cards with same border, radius, shadow | Differentiate primary card, vary content types, break the grid |
| Hover states missing or default | Buttons/cards don't respond to cursor | Add translateY(-1px) + shadow on cards, bg darken on buttons |
| Spacing is uniform everywhere | Same gap between all sections | Vary: tighter within groups, looser between sections |
| No loading/empty/error states | Only the happy path is designed | Add skeleton, empty state with CTA, inline errors |

---

## Component Craft

- **Interactive elements have three states minimum** — rest, hover/focus, active/pressed. If it looks the same when you click it, it feels broken.
- **Button hierarchy guides action** — primary = solid, secondary = outline/ghost, destructive = red outline. Only ONE primary per view section.
- **Feedback must be visual, not just color** — swap icon to checkmark, show inline confirmation, animate the state change. Color alone fails colorblind users.
- **Metric cards vary treatment** — if 3+ cards share structure, differentiate the primary (heavier weight, slightly larger number, subtle bg tint — never thick colored borders).
- **Price typography splits weight** — dollar sign lighter/smaller than the number, period label ("/month") in secondary color.
- **Prevent native image drag** on interactive overlays — `user-drag: none; -webkit-user-drag: none; pointer-events: none` on images inside sliders/carousels.
- **Placeholders are visual, not text** — skeleton bars, subtle grid lines, muted pattern. "Chart would render here" looks unfinished.

**Hover & interaction micro-details** (gate behind `@media (hover: hover) and (pointer: fine)`):

- Cards: `transform: translateY(-1px)` + shadow increase — `transition: transform 200ms ease-out, box-shadow 200ms ease-out` / Tailwind: `hover:-translate-y-px hover:shadow-md transition-[transform,box-shadow] duration-200`
- Buttons: slight bg darkening, not a full color swap — `transition: background 150ms ease-out` / Tailwind: `hover:bg-accent/90 transition-colors duration-150`
- Table rows: subtle bg — `hover:bg-gray-50` / Tailwind: `hover:bg-slate-50/50`
- Links: `text-underline-offset: 2px; text-decoration-skip-ink: auto` / Tailwind: `underline-offset-2 decoration-skip-ink-auto`
- Active/pressed: `transform: scale(0.98)` on buttons for tactile feedback
