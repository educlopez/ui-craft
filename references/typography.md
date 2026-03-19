# Typography

Type scale, font selection, readability, and weight systems.

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
- **Display fonts** for headlines — distinctive, personality-rich
- **Body fonts** for text — readable, neutral, well-hinted
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

### Never
- Modify `letter-spacing` unless explicitly requested
- Use system fonts when personality matters
- Mix more than 2-3 font families

---

## Readability

### Line Length
- **Body text**: 45-75 characters per line (ideal: 66)
- **Use `max-width: 65ch`** on text containers

### Line Height
- **Body text**: 1.5-1.7
- **Headlines**: 1.1-1.3
- **Dense UI (tables, labels)**: 1.2-1.4

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

- **Always `tabular-nums`** for number comparisons (tables, prices, stats)
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
