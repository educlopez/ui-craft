# Token Spine

Every design decision in a project references a three-layer token system established before any component is written. The layers are: **primitive** (raw values named for what they are), **semantic** (contextual meaning, switches between themes), and **component** (specific usage, created on demand). No exceptions.

---

## The Three Layers

### Layer 1: Primitive tokens

Raw values. Named for what they ARE, not how they're used. Reusable across themes.

**Color — neutral ramp + accent ramp + semantic bases.**
Use OKLCH for perceptually uniform steps. See `color.md` for palette strategy and tinted-neutral rationale.

```css
/* Neutral ramp — warm tint, not pure gray */
--gray-50:  oklch(98%  0.008 60);
--gray-100: oklch(95%  0.010 60);
--gray-200: oklch(90%  0.012 60);
--gray-300: oklch(82%  0.014 60);
--gray-400: oklch(70%  0.016 60);
--gray-500: oklch(58%  0.016 60);
--gray-600: oklch(46%  0.015 60);
--gray-700: oklch(36%  0.013 60);
--gray-800: oklch(26%  0.010 60);
--gray-900: oklch(18%  0.008 60);
--gray-950: oklch(12%  0.006 60);

/* Accent ramp — replace hue with your brand value */
--accent-50:  oklch(97%  0.03 var(--accent-hue));
--accent-100: oklch(93%  0.06 var(--accent-hue));
--accent-200: oklch(86%  0.10 var(--accent-hue));
--accent-300: oklch(78%  0.14 var(--accent-hue));
--accent-400: oklch(68%  0.18 var(--accent-hue));
--accent-500: oklch(58%  0.20 var(--accent-hue));
--accent-600: oklch(48%  0.19 var(--accent-hue));
--accent-700: oklch(38%  0.16 var(--accent-hue));
--accent-800: oklch(28%  0.12 var(--accent-hue));
--accent-900: oklch(20%  0.08 var(--accent-hue));
--accent-950: oklch(13%  0.05 var(--accent-hue));

/* Semantic color bases — for success / warning / error / info */
--green-400:  oklch(72%  0.18 145);
--green-600:  oklch(52%  0.18 145);
--amber-400:  oklch(78%  0.16 70);
--amber-600:  oklch(58%  0.16 70);
--red-400:    oklch(65%  0.20 25);
--red-600:    oklch(48%  0.20 25);
--blue-400:   oklch(66%  0.16 250);
--blue-600:   oklch(50%  0.16 250);
```

**Spacing — 8pt scale.** Full rhythm rules and when to compress → see `layout.md`.

```css
--space-xs:  0.25rem;  /* 4px */
--space-sm:  0.5rem;   /* 8px */
--space-md:  1rem;     /* 16px */
--space-lg:  1.5rem;   /* 24px */
--space-xl:  2rem;     /* 32px */
--space-2xl: 3rem;     /* 48px */
--space-3xl: 4rem;     /* 64px */
--space-4xl: 6rem;     /* 96px */
```

**Type — size, weight, line-height, letter-spacing.** Full scale and font selection → see `typography.md`.

```css
--text-xs:   0.75rem;   /* 12px */
--text-sm:   0.875rem;  /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg:   1.125rem;  /* 18px */
--text-xl:   1.25rem;   /* 20px */
--text-2xl:  1.5rem;    /* 24px */
--text-3xl:  1.875rem;  /* 30px */
--text-4xl:  2.25rem;   /* 36px */
--text-5xl:  3rem;      /* 48px */

--font-light:   300;
--font-regular: 400;
--font-medium:  500;
--font-semibold: 600;
--font-bold:    700;

--leading-none:   1;
--leading-tight:  1.1;
--leading-snug:   1.3;
--leading-normal: 1.5;
--leading-relaxed: 1.65;

--tracking-tight: -0.03em;
--tracking-normal: 0;
--tracking-wide:  0.01em;
--tracking-wider: 0.05em;
```

**Radii.**

```css
--radius-none: 0;
--radius-sm:   0.125rem;  /* 2px — minimal, sharp */
--radius-md:   0.375rem;  /* 6px — inputs, badges */
--radius-lg:   0.625rem;  /* 10px — cards */
--radius-xl:   0.875rem;  /* 14px — modals, large panels */
--radius-2xl:  1.25rem;   /* 20px — expressive cards, popovers */
--radius-full: 9999px;    /* pills, avatars */
```

**Shadows — layered ambient + direct.** Always stack two layers minimum. See `layout.md` for the scale and the "never flat" rule.

```css
--shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.05);
--shadow-md: 0 4px 6px oklch(0% 0 0 / 0.07),
             0 1px 3px oklch(0% 0 0 / 0.06);
--shadow-lg: 0 10px 15px oklch(0% 0 0 / 0.09),
             0 4px  6px  oklch(0% 0 0 / 0.05);
--shadow-xl: 0 20px 25px oklch(0% 0 0 / 0.10),
             0 8px  10px oklch(0% 0 0 / 0.04);
```

**Motion — durations and easings.** Perceptual bands and choreography rules → see `motion.md`.

```css
--duration-instant: 80ms;
--duration-fast:    150ms;
--duration-normal:  250ms;
--duration-slow:    400ms;

--ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
--ease-in:     cubic-bezier(0.4, 0, 1, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
```

**Z-index — semantic layers, never arbitrary numbers.**

```css
--z-base:           0;
--z-raised:         1;
--z-dropdown:       10;
--z-sticky:         20;
--z-modal-backdrop: 30;
--z-modal:          40;
--z-toast:          50;
--z-tooltip:        60;
```

> **The naming rule:** primitives are nouns about the value — `--gray-500`, `--space-md`, `--radius-lg`. Never role-named at this layer. `--button-bg` is a component token. `--text-primary` is a semantic token. Both are wrong here.

---

### Layer 2: Semantic tokens

Contextual meaning. References primitives. This is the layer that switches between light and dark mode — primitives never change; semantics remap.

```css
:root {
  /* Surface stack — 5 levels of elevation */
  --surface-canvas:  var(--gray-50);   /* page background */
  --surface-raised:  var(--gray-100);  /* cards, panels */
  --surface-overlay: #fff;             /* modals, sheets */
  --surface-sunken:  var(--gray-200);  /* inset areas, code blocks */
  --surface-inverse: var(--gray-900);  /* inverted blocks, tooltips */

  /* Text */
  --text-primary:    var(--gray-900);
  --text-secondary:  var(--gray-600);
  --text-tertiary:   var(--gray-400);
  --text-on-accent:  #fff;
  --text-on-inverse: var(--gray-50);
  --text-link:       var(--accent-600);
  --text-success:    var(--green-600);
  --text-warning:    var(--amber-600);
  --text-error:      var(--red-600);

  /* Border */
  --border-subtle:  oklch(0% 0 0 / 0.06);
  --border-default: oklch(0% 0 0 / 0.12);
  --border-strong:  oklch(0% 0 0 / 0.24);
  --border-focus:   var(--accent-500);
  --border-error:   var(--red-400);

  /* Accent */
  --accent-bg:        var(--accent-500);
  --accent-bg-hover:  var(--accent-600);
  --accent-bg-active: var(--accent-700);
  --accent-text:      #fff;
  --accent-border:    var(--accent-400);

  /* Status — bg / text / border per state */
  --success-bg:     oklch(96% 0.04 145);
  --success-text:   var(--green-600);
  --success-border: var(--green-400);

  --warning-bg:     oklch(97% 0.04 70);
  --warning-text:   var(--amber-600);
  --warning-border: var(--amber-400);

  --error-bg:       oklch(97% 0.04 25);
  --error-text:     var(--red-600);
  --error-border:   var(--red-400);

  --info-bg:        oklch(96% 0.04 250);
  --info-text:      var(--blue-600);
  --info-border:    var(--blue-400);
}
```

Dark mode remaps semantics only — primitives are untouched:

```css
[data-theme="dark"] {
  --surface-canvas:  var(--gray-950);
  --surface-raised:  var(--gray-900);
  --surface-overlay: var(--gray-800);
  --surface-sunken:  oklch(9% 0.008 60);  /* darker than canvas */
  --surface-inverse: var(--gray-50);

  --text-primary:    var(--gray-50);
  --text-secondary:  var(--gray-400);
  --text-tertiary:   var(--gray-600);
  --text-on-inverse: var(--gray-900);

  --border-subtle:  oklch(100% 0 0 / 0.06);
  --border-default: oklch(100% 0 0 / 0.12);
  --border-strong:  oklch(100% 0 0 / 0.24);

  /* Accent desaturates ~12% in dark to prevent burn */
  --accent-bg:        oklch(58% 0.18 var(--accent-hue));
  --accent-bg-hover:  oklch(65% 0.18 var(--accent-hue));
  --accent-bg-active: oklch(70% 0.18 var(--accent-hue));
}
```

---

### Layer 3: Component tokens

Specific usage. References semantics. Created on demand per component — not pre-built as a blanket catalog.

```css
/* Example: button */
--button-primary-bg:            var(--accent-bg);
--button-primary-bg-hover:      var(--accent-bg-hover);
--button-primary-bg-active:     var(--accent-bg-active);
--button-primary-text:          var(--accent-text);
--button-primary-border-radius: var(--radius-md);
--button-primary-padding-x:     var(--space-md);
--button-primary-padding-y:     var(--space-sm);

/* Example: input */
--input-bg:            var(--surface-canvas);
--input-border:        var(--border-default);
--input-border-focus:  var(--border-focus);
--input-border-error:  var(--border-error);
--input-text:          var(--text-primary);
--input-placeholder:   var(--text-tertiary);
--input-border-radius: var(--radius-md);
```

> **When to create component tokens:** only when a component has multiple states or themes. A simple component referencing semantic tokens directly is fine — don't add a layer to prove you understand the system.

---

## Light + Dark: Both Intentional

Dark mode is not the negation of light mode. Both are designed; neither is a fallback.

> **The intentional-dark test:** if your dark mode maps `--text-primary` from `gray-900` to `gray-100` and stops there, you inverted — you didn't design. Real dark mode rebalances the entire surface stack.

**The canvas rule.** `--surface-canvas` in dark sits between `gray-950` and `gray-900` with a slight hue tint. Pure `#000` reads as broken on any monitor with backlight bleed — it's also a cold dead black that strips warmth from everything above it.

**The accent rule.** Saturated accent colors burn on dark surfaces. Drop chroma 10-15% in OKLCH when switching to dark. The hue stays constant; only `C` shifts. This preserves brand recognition while reducing visual strain.

**The shadow rule.** Shadows are invisible on dark surfaces — black-on-near-black has no contrast. In dark mode: replace `box-shadow` depth with a `1px` border ring using `--border-default`, or a subtle top-edge highlight (`inset 0 1px 0 oklch(100% 0 0 / 0.08)`). Reserve box-shadow for colored glows only.

**The text rule.** Pure white (`#fff`) on dark backgrounds creates excessive halation on OLED screens. Use `--gray-50` or a warmer `oklch(97% 0.01 60)` as your lightest text value.

**The transition rule.** Always declare `color-scheme: light dark` for native form controls to adopt the right system rendering. Provide `prefers-color-scheme` for users without a toggle; respect the user's explicit toggle when present — never override it with system preference once the user has made a choice.

```css
/* Both modes in one block */
:root {
  color-scheme: light dark;

  /* Light defaults above */
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Paste dark remaps here — same keys as light */
  }
}

[data-theme="dark"] {
  /* Explicit toggle — overrides media query */
}
```

---

## Token Categories Required

Every non-trivial UI needs all seven. Missing categories produce ad-hoc inline values that break theming.

| Category | Primitive examples | Semantic examples | Notes |
|---|---|---|---|
| Color | `--gray-50` → `--gray-950`, `--accent-50` → `--accent-950` | `--text-primary`, `--surface-raised`, `--accent-bg` | Light + dark both required |
| Spacing | `--space-xs` → `--space-4xl` | (typically used directly) | See `layout.md` for scale and rhythm rules |
| Type | `--text-xs` → `--text-5xl`, `--leading-tight`, `--font-medium` | `--font-display`, `--font-body`, `--font-mono` | See `typography.md` for scale and letter-spacing rules |
| Radii | `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-full` | `--radius-card`, `--radius-button`, `--radius-input` | Vary by element — uniform radius is the AI tell |
| Shadows | `--shadow-sm` → `--shadow-xl` | `--elevation-raised`, `--elevation-overlay`, `--elevation-modal` | Stack 2+ layers per shadow; dark mode requires border-ring replacement |
| Motion | `--duration-instant` → `--duration-slow`, `--ease-out`, `--ease-spring` | `--motion-hover`, `--motion-modal-in` | See `motion.md` for perceptual bands and choreography |
| Z-index | `--z-dropdown`, `--z-modal`, `--z-toast` | (typically used directly) | Semantic labels, never arbitrary numbers |

---

## When to Extend vs. Replace

**If the project has a token system:**
- **Extend** — add the missing layer or category. The most common gap is missing semantics: primitives exist, but nothing switches for dark mode and no surface stack is defined.
- **Audit** — check dark mode is intentional (run the test above), semantic naming exists, all 7 categories are present.
- **Don't replace** unless the user explicitly asks. Token replacement is a multi-week refactor. Propose additions as patches, not rewrites.

**If the project has nothing:**
- **Establish primitives first** — color (neutral ramp + one accent), spacing (8pt scale), type (5 sizes + 3 weights). These three cover the majority of any UI.
- **Add semantics on demand** as components get built. Surface stack + text roles are almost always next.
- **Defer component tokens** until variant explosion — more than 2-3 states or themes — forces them.

---

## When the Token Spine Doesn't Apply

- **Single-page experiences** (landing pages, one-off campaign pages) — primitives + inline use is fine when nothing will be themed or reused. Semantics add no value if there's one theme and no components.
- **Adopted upstream systems** (Material, shadcn, Ant Design) — use the upstream tokens wholesale. Don't reinvent a parallel system alongside an existing one; that's two token systems to maintain.
- **Native iOS / Android** — platform tokens (`systemBackground`, `label`, `tint`) govern rendering. Custom tokens run parallel and cause drift.

---

## Cross-References

- Spacing scale: see `layout.md` for the full table and spacing rhythm rule.
- Type scale: see `typography.md` for sizes, weights, scoped letter-spacing, and line-height by script.
- Color strategy: see `color.md` for OKLCH rationale, tinted neutrals, accent budget, and semantic palette structure.
- Motion durations: see `motion.md` for the duration scale, perceptual bands, and reduced-motion contract.

The spine ties these together. Each scale is its own discipline; the spine defines how they layer.
