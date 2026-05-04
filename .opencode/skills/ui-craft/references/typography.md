# Typography

Type scale, font selection, readability, and weight systems.

---

## Essentials

Apply these in all standard Latin-script web UI unless a specific context overrides:

- **`text-wrap: balance`** for headings; **`text-wrap: pretty`** for body
- **`font-variant-numeric: tabular-nums`** for data/numbers
- **Truncation handling** for dense UI; flex children need `min-w-0`
- **Smart punctuation**: curly quotes (`&ldquo;` `&rdquo;`), apostrophes (`&rsquo;`), ellipsis (`&hellip;`), em-dash (`&mdash;`)
- **Non-breaking spaces**: `10&nbsp;MB`, `⌘&nbsp;K`, brand names, `$&nbsp;79/month`

**Font recommendations** — pick one family for body, optionally a second for display. In a single product surface, don't mix more than two typefaces; editorial layouts intentionally mix three or more for hierarchy.

| Category | Safe choices |
|----------|-------------|
| Sans-serif | Inter, Geist, DM Sans, Plus Jakarta Sans |
| Monospace | Geist Mono, JetBrains Mono, IBM Plex Mono |
| System stack | `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` |

---

## Type Hierarchy

Create a clear scale from most important to least. Count distinct sizes/weights — too many creates noise, too few loses hierarchy.

### Scale (Recommended)
```css
--text-xs:   0.75rem;   /* 12px - labels, captions */
--text-sm:   0.875rem;  /* 14px - secondary text */
--text-base: 1rem;      /* 16px - body text */
--text-lg:   1.125rem;  /* 18px - lead text */
--text-xl:   1.25rem;   /* 20px - section headers */
--text-2xl:  1.5rem;    /* 24px - page headers */
--text-3xl:  1.875rem;  /* 30px - hero subtext */
--text-4xl:  2.25rem;   /* 36px - hero text */
--text-5xl:  3rem;      /* 48px - display */
```

### Dramatic Scale (Bold Design)
For impact, use 3-5x size jumps, not 1.5x. Pair weight 900 with 200, not 600 with 400.

---

## Font Selection

### Principles
- **Display fonts** for headlines — distinctive, personality-rich. A font excellent for display (high contrast, tight spacing) is wrong for body text at 16px.
- **Body fonts** for running text — readable, neutral, well-hinted at small sizes. A workhorse body font (Charter, IBM Plex Sans) often looks bland at hero scale — that's fine, just don't ask it to do both jobs.
- **UI fonts** for labels and dense interfaces — optimized x-height, open apertures. Inter and Geist are UI fonts first; using them at 48px display is fine, but don't expect typographic personality.
- **Monospace** as intentional accent — not as lazy "dev tool" default
- **Variable fonts** for flexibility — one file, many weights
- **Subset fonts** — ship only code points/scripts you use

### Loading
```html
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>
```
```css
@font-face {
  font-family: 'Main';
  src: url('/fonts/main.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0000-007F; /* Basic Latin only */
}
```

### Letter-Spacing by Size

These rules apply to **Latin script, sans-serif and display faces** unless stated otherwise. Do not adjust tracking on CJK, Arabic, Devanagari, or other non-Latin scripts unless you deeply understand their typographic conventions — the font's built-in metrics handle it. Serif faces are designed with tracking already optimized across sizes; tightening them at display sizes damages their rhythm.

- **Display (≥24px), sans-serif Latin**: tighten to `-0.02em` to `-0.04em` — large sizes optically appear loose at default tracking. `tracking-tight` in Tailwind.
  > **When it breaks:** serif faces (Playfair, Freight, Garamond) — leave at default. The built-in sidebearings were set for the size.
- **Body text (14-18px)**: leave `letter-spacing` alone — the font designer optimized it. This holds for all scripts and classifications.
- **Small text/labels (11-13px), Latin**: slight positive tracking `+0.01em` to `+0.02em` improves readability at tight optical sizes. `tracking-wide` in Tailwind.
  > **When it breaks:** CJK labels — already have generous inter-glyph spacing; adding more creates uneven color.
- **ALL CAPS labels, Latin**: `+0.05em` to `+0.1em` — all-caps removes descender space and needs tracking to stay readable. `tracking-widest` in Tailwind.
  > **When it breaks:** Not a universal Never. ALL CAPS is acceptable for small category labels (10-13px), regulatory text, and utilitarian aesthetics — just always add tracking when you do it.

### Never
- Use system fonts when personality matters — system stacks are fine for utilitarian UI but they signal "no design intent" in brand-facing contexts
- Mix more than 2-3 typefaces **in a single product surface** — editorial layouts (magazines, marketing pages) intentionally exceed this for typographic hierarchy

---

## Readability

### Line Length
- **Prose body text**: 45-75 characters per line (ideal: 66). Use `max-width: 65ch` on text containers.
  > **When it breaks:** UI labels, buttons, table cells, and dense data layouts tolerate much shorter or longer lines. The 65ch rule is for continuous reading, not UI components.

### Line Height

Line height is script- and x-height-dependent — no single value works universally.

- **Body text (14-18px), Latin**: 1.5 to 1.65. Tall x-height fonts (Inter, Geist) tolerate the lower end; short x-height faces (Garamond, Freight) may need slightly tighter — test visually.
- **Display headlines (≥24px)**: 1.05 to 1.2. Headlines need to feel tight; a 1.5 line-height on a 48px heading looks airy and unintentional.
- **UI labels and dense interfaces**: 1.3 to 1.4. Enough air to avoid collision, not so much that the interface feels sparse.
- **CJK scripts**: 1.7 to 1.85 — CJK glyphs have different vertical metrics and need more inter-line clearance than Latin at the same size.
  > **When it breaks:** Applying 1.5 body line-height to display text; applying CJK ratios to Latin body text (creates too much vertical space).

### Text Wrapping
```css
h1, h2, h3, h4 { text-wrap: balance; }
p, li, dd      { text-wrap: pretty; }
```

- **`text-wrap: balance`** — even line lengths for headings
- **`text-wrap: pretty`** — avoids widows/orphans in body text

---

## Data Typography

```css
/* Tabular numbers for data alignment */
.data-value { font-variant-numeric: tabular-nums; }

/* Or use a monospace font for data-heavy tables */
.data-table { font-family: var(--font-mono, monospace); }
```

- **`tabular-nums`** for any numbers that align vertically in columns (tables, prices, stats) — this is a near-universal rule for data UI; the exception is decorative numerals in display headings where proportional figures look better
- **Truncate dense UI**: `truncate` or `line-clamp-*`
- **Flex children need `min-w-0`** to allow truncation

---

## Text Handling

### Content Overflow
```css
/* Single line truncation */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Multi-line clamp */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Flex children MUST have min-w-0 */
.flex-child {
  min-width: 0; /* allows text to truncate */
}
```

### Special Characters
- **Curly quotes**: " " not " "
- **Ellipsis character**: … not ...
- **Non-breaking spaces**: `10&nbsp;MB`, `⌘&nbsp;K`, brand names
- **`scroll-margin-top`** on headings for anchor links

### Resilience
- Layouts handle short, average, AND very long content
- Handle empty strings without broken UI
- Locale-aware: `Intl.DateTimeFormat`, `Intl.NumberFormat`

---

## Anti-aliasing

- Scaling text via `transform` can change smoothing
- Prefer animating a wrapper instead of text node directly
- If artifacts persist: `translateZ(0)` or `will-change: transform` to promote layer
