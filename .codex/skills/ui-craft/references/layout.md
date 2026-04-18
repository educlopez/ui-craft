# Layout & Composition

Spacing systems, grids, visual hierarchy, and spatial design.

---

## Essentials

Always apply these:

- **Optical alignment** — adjust ±1px when perception beats geometry
- **Deliberate alignment** to grid/baseline/edges — no accidental placement
- **Respect safe areas**: `env(safe-area-inset-*)`
- **No unwanted scrollbars** — fix overflows
- **CSS layout over JS measurement**
- **Nested radii**: child ≤ parent, concentric
- **Layered shadows**: ambient + direct light, at least two layers
- **Fixed z-index scale**: dropdown → sticky → modal-backdrop → modal → toast → tooltip

### Style-to-CSS Mapping (from Discovery)

Each design style maps to concrete CSS patterns. Style is independent of color scheme.

| Property | Minimal Clean | Soft Modern | Sharp Geometric | Rich Editorial | Dark Premium | Playful Bold |
|----------|---------------|-------------|-----------------|----------------|--------------|--------------|
| `border-radius` | 2-4px | 8-16px | 0px | 2-4px | 4-8px | 12-20px |
| Shadows | Barely-there or none | Layered (ambient + direct) | None — use borders | Subtle, warm | Subtle glow, inset | Bold, offset |
| Borders | `rgba(0,0,0,0.06)` 1px | Soft, same hue as shadow | 1px crisp, high-contrast | Thin, warm-tinted | `rgba(255,255,255,0.08)` | Thick, colored |
| Spacing | Generous whitespace | Comfortable, padded | Tight, precise | Generous, editorial | Moderate | Loose, breathing |
| Weight range | 400-600 | 400-600 | 400-800 (contrast jumps) | 300-700 | 400-700 | 500-800 |
| Background | White, barely-gray | White, warm gray | White or dark, stark | Off-white, cream | Dark surfaces (gray-950) | White, tinted sections |
| Motif ideas | Negative space | Soft gradients, rounded pills | Clip-path shapes, angles | Serif accents, pull quotes | Accent glows, dark cards | Offset borders, rotations |

---

## Spacing System

Use a consistent scale — rem-based tokens, framework defaults, or custom. What matters is values come from a defined set, not arbitrary numbers.

- **`gap`** for sibling spacing (eliminates margin collapse)
- **`clamp()`** for fluid spacing that breathes on larger screens
- **Tight grouping** (8-12px) for related elements
- **Generous separation** (48-96px) between distinct sections
- **Varied spacing** within sections — not every row needs the same gap

### Semantic Tokens
```css
--space-xs:  0.25rem;   /* 4px */
--space-sm:  0.5rem;    /* 8px */
--space-md:  1rem;      /* 16px */
--space-lg:  1.5rem;    /* 24px */
--space-xl:  2rem;      /* 32px */
--space-2xl: 3rem;      /* 48px */
--space-3xl: 4rem;      /* 64px */
--space-4xl: 6rem;      /* 96px */
```

---

## Visual Hierarchy

### The Squint Test
Blur your eyes — can you identify: (1) most important element, (2) second most important, (3) clear groupings? If not, hierarchy is broken.

### Hierarchy Tools (fewer is better)
1. **Space alone** can be enough — generous whitespace draws the eye
2. **Weight** (font-weight, border-weight, shadow depth)
3. **Size** (scale differences 3-5x for drama, not 1.5x)
4. **Color** (add only when simpler means aren't sufficient)

### Reading Flow
In LTR: eye scans top-left → bottom-right naturally. But primary action placement depends on context (bottom-right in dialogs, top in navigation).

---

## Choosing Layout Tools

### Flexbox (1D — most layouts)
Rows of items, nav bars, button groups, card contents, component internals. Simpler and more appropriate for the majority of tasks.

```css
/* Responsive wrapping without media queries */
.container {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-md);
}
```

### Grid (2D — page-level)
Page structure, dashboards, data-dense interfaces — when rows AND columns need coordinated control.

```css
/* Responsive grid without breakpoints */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-lg);
}

/* Complex page layout */
.page {
  display: grid;
  grid-template-areas:
    "nav    nav"
    "sidebar content"
    "footer  footer";
}
```

**Don't default to Grid** when Flexbox with `flex-wrap` would be simpler.

---

## Breaking Monotony

- **Don't default to card grids for everything** — spacing creates grouping naturally
- **Cards only when content is truly distinct and actionable** — never nest cards inside cards
- **Vary card sizes**, span columns, or mix cards with non-card content
- **Asymmetric compositions** — break centered-content patterns when it makes sense
- **Never** the hero metric layout (big number + small label + stats + gradient) as template

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

Never use arbitrary values (999, 9999).

### Shadow Scale
```css
--shadow-sm:  0 1px 2px rgba(0,0,0,0.05);
--shadow-md:  0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.06);
--shadow-lg:  0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
--shadow-xl:  0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04);
```

Always **layered** (ambient + direct light). Use elevation to reinforce hierarchy, not as decoration.

---

## Optical Adjustments

- **±1px nudges** when geometric centering looks visually off-center (common with icons)
- **Nested radii**: child ≤ parent, concentric so curves align
- **Balance icon/text lockups**: adjust weight, size, spacing, or color so they don't clash

---

## Never
- Arbitrary spacing outside your scale
- All spacing equal — variety creates hierarchy
- Wrap everything in cards — not everything needs a container
- Nest cards inside cards
- Center everything — left-aligned with asymmetry feels more designed
- Default to Grid when Flex would be simpler
- Arbitrary z-index values
