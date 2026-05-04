# Layout & Composition

Spatial reasoning, grouping principles, and hierarchy discipline. Tools (Flex, Grid) come last.

---

## Gestalt Grouping Principles

Perception organizes visual fields before conscious thought. Five laws govern how elements are read as groups:

**Proximity** — Elements closer together are perceived as related. Spacing is the primary grouping signal. Use it before borders, cards, or background fills.

**Similarity** — Elements that share shape, color, or size are perceived as the same kind of thing. Color-coding a column in a table exploits this; inconsistent icon weights break it.

**Common Region** — Elements inside a shared boundary (card, background, border) form a group. Use sparingly — every card is a visual tax. Ask: does this content need isolation, or does proximity alone suffice?

**Continuity** — The eye follows a line or curve through a layout. Aligning elements along an axis creates an implied path that guides the scan.

**Closure** — The eye completes incomplete shapes. Use this to reduce clutter: a partially-visible element (card cropped at viewport edge) signals "more exists" without a label.

### The primary rule: use spacing before structure

Before reaching for a card, background swatch, or divider line, try creating the group with spacing alone. If it reads, stop there. Structure adds visual weight and complexity — earn it.

---

## Spacing Rhythm

The most violated rule in UI. State it as an invariant:

> **Space within a group < space between groups < space between sections.**

Concrete: a form label 4px above its input, inputs in the same form 16px apart, the form itself 48px from the next section. If any of these relationships inverts, the grouping breaks.

### Scale

Use tokens from a defined set. Values come from the scale — never arbitrary.

```css
--space-xs:  0.25rem;   /* 4px  — label-to-input, icon-to-label */
--space-sm:  0.5rem;    /* 8px  — items within a group */
--space-md:  1rem;      /* 16px — related components */
--space-lg:  1.5rem;    /* 24px — sibling sections */
--space-xl:  2rem;      /* 32px — component-to-component */
--space-2xl: 3rem;      /* 48px — section separations */
--space-3xl: 4rem;      /* 64px — major page regions */
--space-4xl: 6rem;      /* 96px — hero-to-content, above-fold breathing room */
```

Use `gap` for sibling spacing — eliminates margin collapse and is the correct mental model.

Use `clamp()` for fluid spacing: `clamp(var(--space-lg), 4vw, var(--space-3xl))` scales without breakpoints.

**WHEN IT BREAKS:** Very dense data tables and compact UI patterns (command palettes, menus) compress this rhythm deliberately. At 100% zoom the hierarchy still holds — the scale values shrink proportionally. Never collapse two adjacent levels to the same value.

---

## Visual Hierarchy

### The Squint Test

Stand back, defocus your eyes, or apply a blur filter to the design. The image resolves to blobs of light and dark, size and contrast — text becomes unreadable. What you see is the page at the perceptual level of a first glance (~200ms).

At that level:

1. One thing should dominate — the primary action or headline.
2. A secondary cluster should appear next — supporting information.
3. The page structure (navigation, footer, sidebar) should be lowest in perceived weight.

Why it works: the human visual system applies a low-pass spatial frequency filter before conscious reading. The squint test simulates that filter. If hierarchy fails the squint test, users experience visual noise even if they cannot articulate why.

### Measurable Ratios

Four levels is the practical maximum for most UI. Beyond that, distinctions collapse.

| Level | Role | Signal |
|-------|------|--------|
| Primary | Page-defining element (hero headline, main CTA) | Largest, highest contrast, most visual weight |
| Secondary | Supporting structure (subheadings, section labels) | Minimum 1.5x smaller or lighter than primary |
| Tertiary | Body content, field labels, card titles | Readable, not competing |
| Quaternary | Metadata, timestamps, captions | Muted, clearly subordinate |

**Minimum 1.5x difference between adjacent levels** to create a clear distinction. A 1.2x difference reads as an accident, not a decision.

**WHEN IT BREAKS:** Typography pairs can carry hierarchy at identical size using weight + tracking — a 400/700 weight pair at 14px is a clear two-level system. In that case the size ratio rule yields to the type system. See `typography.md`.

### Hierarchy Tools (use in this order)

1. **Space** — generous whitespace isolates the primary element before you touch anything else
2. **Size** — scale differences above 1.5x register immediately
3. **Weight** — font-weight, border-weight, shadow depth
4. **Color** — last resort; adds semantic load and accessibility risk

Using all four at once creates noise. Mature interfaces use one or two.

---

## Composition Strategies

### Symmetry vs. Asymmetry

Symmetry signals stability, formality, and confidence. Use it for hero sections, authentication flows, landing page headers.

Asymmetry signals energy, modernity, and movement. Use it for editorial layouts, feature showcases, dashboards with a dominant primary panel.

Avoid the default of centered-everything — it reads as unsophisticated because it makes no compositional decision. Left-aligned layouts with deliberate asymmetric weight distribution feel more considered.

### Focal Point

Every layout needs exactly one focal point — the element the eye arrives at first. If you have two competing elements at the same visual weight, one of them is wrong. Remove hierarchy from one or subordinate it spatially.

### Optical Center vs. Geometric Center

The geometric center of a rectangle is at 50% vertical. The optical center is 5–8% above that. Content positioned at the optical center feels balanced; content at true geometric center reads as slightly low.

This matters most for:
- Modal dialogs — vertically centered modals in a viewport look sunken; use `align-items: center` with a slight upward offset or top-biased margins
- Icon placement within a bounding box — a 24×24 icon with a visually tall glyph needs a −1px vertical nudge
- Above-the-fold hero sections — weight the primary element in the upper optical zone

### Rule of Thirds (use only with hero imagery)

The rule of thirds creates dynamic tension by placing subjects at grid intersections rather than center. In interfaces without strong photographic content it adds complexity without benefit. Reserve it for editorial layouts and landing pages with full-bleed images.

---

## Choosing Layout Tools

**Flexbox — 1D.** Rows of items, nav bars, button groups, component internals. Default choice for the majority of components.

**Grid — 2D.** Page structure, dashboards, anything requiring row AND column coordination. Reach for it when flex with `flex-wrap` forces workarounds.

```css
/* Responsive without breakpoints — flex */
.group { display: flex; flex-wrap: wrap; gap: var(--space-md); }

/* Responsive without breakpoints — grid */
.grid  { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--space-lg); }
```

Don't default to Grid when Flex would be simpler. Don't reach for JS measurement when CSS layout solves it.

---

## Breaking Monotony

- Don't default to card grids for everything — spacing creates grouping naturally
- Cards only when content is truly distinct and actionable — never nest cards inside cards
- Vary card sizes, span columns, or mix cards with non-card content
- Asymmetric compositions break the centered-content default when the content supports it
- Never template the "big metric + small label + stat row + gradient" pattern — it's a design cliché

---

## Depth & Elevation

### Z-Index Scale (Semantic)
```css
--z-dropdown:       10;
--z-sticky:         20;
--z-modal-backdrop: 30;
--z-modal:          40;
--z-toast:          50;
--z-tooltip:        60;
```

Never use arbitrary values (999, 9999). Use elevation to reinforce hierarchy, not as decoration.

### Shadow Scale
```css
--shadow-sm:  0 1px 2px rgba(0,0,0,0.05);
--shadow-md:  0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.06);
--shadow-lg:  0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
--shadow-xl:  0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04);
```

Always layered (ambient + direct light). Higher elevation = larger spread + lower opacity, not just a bigger number.

---

## Optical Adjustments

- **±1px nudges** when geometric centering looks visually off-center — common with icons inside buttons, badges, avatars
- **Nested radii:** child ≤ parent. Use `calc(var(--radius-parent) - var(--padding))` to keep concentric curves
- **Icon/text lockups:** adjust weight, size, spacing, or color — one lever at a time until they feel unified

---

## Style-to-CSS Reference

| Property | Minimal Clean | Soft Modern | Sharp Geometric | Rich Editorial | Dark Premium | Playful Bold |
|----------|---------------|-------------|-----------------|----------------|--------------|--------------|
| `border-radius` | 2-4px | 8-16px | 0px | 2-4px | 4-8px | 12-20px |
| Shadows | None or barely-there | Layered (ambient + direct) | None — use borders | Subtle, warm | Subtle glow, inset | Bold, offset |
| Borders | `rgba(0,0,0,0.06)` 1px | Soft, same hue as shadow | 1px crisp, high-contrast | Thin, warm-tinted | `rgba(255,255,255,0.08)` | Thick, colored |
| Spacing | Generous whitespace | Comfortable, padded | Tight, precise | Generous, editorial | Moderate | Loose, breathing |
| Weight range | 400-600 | 400-600 | 400-800 | 300-700 | 400-700 | 500-800 |

---

## Never

- Arbitrary spacing outside your defined scale
- All spacing equal across a section — variety creates hierarchy
- Wrap everything in cards — not everything needs a container
- Nest cards inside cards
- Center everything — left-aligned asymmetry reads as more intentional
- Default to Grid when Flex would be simpler
- Arbitrary z-index values (999, 9999)
- Two adjacent hierarchy levels at the same visual weight — decide which leads
