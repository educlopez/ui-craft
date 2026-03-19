# Color & Theming

Strategic color application, palette building, dark mode, and design tokens.

---

## Color Strategy

More color ≠ better. Strategic color beats rainbow vomit. Every color needs a purpose.

### The 60-30-10 Rule
- **60% dominant** — primary brand color or most-used accent
- **30% secondary** — supporting color for variety
- **10% accent** — high contrast for key moments
- **Remaining** — neutrals for structure

### Color Purposes
- **Semantic**: success (green), error (red/rose), warning (amber), info (blue)
- **Hierarchy**: drawing attention to important elements
- **Categorization**: different sections, types, or states
- **Emotional tone**: warmth, energy, trust, creativity
- **Wayfinding**: helping users navigate structure

---

## Use OKLCH

OKLCH is perceptually uniform — equal steps in lightness *look* equal. Best for generating harmonious scales.

```css
/* Warm neutral (not pure gray) */
--surface: oklch(97% 0.01 60);

/* Cool tint */
--surface-cool: oklch(97% 0.01 250);

/* Generate a consistent scale */
--blue-50:  oklch(97% 0.02 250);
--blue-100: oklch(93% 0.04 250);
--blue-200: oklch(87% 0.08 250);
--blue-500: oklch(60% 0.15 250);
--blue-900: oklch(30% 0.10 250);
```

---

## Palette Building

### Tinted Neutrals
Never use pure gray — add subtle color tint for sophistication:
- **Warm**: `oklch(L 0.01 60)` (slight warm tint)
- **Cool**: `oklch(L 0.01 250)` (slight blue tint)
- Match tint to your brand's primary hue

### Hue Consistency
On non-neutral backgrounds, tint borders/shadows/text toward the same hue:
```css
/* Card on blue background */
.card {
  border: 1px solid oklch(70% 0.05 250);  /* blue-tinted border */
  box-shadow: 0 4px 12px oklch(30% 0.03 250 / 0.15);  /* blue-tinted shadow */
}
```

### Never
- Gray text on colored backgrounds — looks washed out; use darker shade of bg color or transparency
- Pure black (`#000`) or pure white (`#fff`) for large areas
- Purple/cyan/blue gradient everything (AI slop)
- Gradients as decoration without purpose

---

## Dark Mode

### Required Setup
```html
<html style="color-scheme: dark">
<meta name="theme-color" content="#000000">
```

### Rules
- `color-scheme: dark` on `<html>` — ensures scrollbars, form controls, etc. have proper contrast
- `<meta name="theme-color">` matches page background
- Explicit `background-color` and `color` on native `<select>` (Windows fix)
- Reduce shadow intensity in dark mode (shadows are less visible on dark)
- Increase surface differentiation (more elevation steps)
- Watch gradient banding — fading to dark colors can cause banding; use background images when needed

---

## Semantic Color Tokens

```css
/* Surfaces */
--surface-primary:   oklch(...);
--surface-secondary: oklch(...);
--surface-elevated:  oklch(...);

/* Text */
--text-primary:   oklch(...);
--text-secondary: oklch(...);
--text-tertiary:  oklch(...);

/* Status */
--status-success: oklch(65% 0.18 145);
--status-error:   oklch(60% 0.20 25);
--status-warning: oklch(75% 0.15 70);
--status-info:    oklch(60% 0.15 250);

/* Interactive */
--interactive-primary: oklch(...);
--interactive-hover:   oklch(...);  /* more contrast than rest */
--interactive-active:  oklch(...);  /* even more contrast */
--interactive-focus:   oklch(...);
```

---

## Contrast

- **Prefer APCA** over WCAG 2 for perceptual accuracy
- **Text contrast**: minimum 4.5:1 (WCAG AA), prefer 7:1 (AAA)
- **UI components**: minimum 3:1
- **Interactions increase contrast**: `:hover`/`:active`/`:focus` have more contrast than rest
- **Never rely on color alone** — include text labels, icons, patterns
- **Color-blind-friendly palettes** for charts and data visualization

---

## Application Patterns

### Accent Application
- Primary actions (CTA buttons)
- Links (maintain accessibility)
- Key icons for recognition
- Section headers
- Hover states (introduce color on interaction)
- Focus rings matching brand

### Background & Surfaces
- Tinted backgrounds (warm/cool neutrals, not pure gray)
- Colored sections to separate areas
- Subtle gradient backgrounds (intentional, not generic)
- Tinted cards for warmth

### Borders & Accents
- Accent borders on cards (left/top)
- Colored underlines for active states
- Subtle colored dividers
- Colored focus indicators

---

## Design Rules

- **Limit accent color to one per view**
- Use existing theme tokens before introducing new ones
- Never gradients unless explicitly requested
- Never glow effects as primary affordances
- Layered shadows: ambient + direct light
- Crisp edges: semi-transparent borders + shadows
