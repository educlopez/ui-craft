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

**Safe choices are product-shell defaults, not marketing display picks.** On landings, portfolios, and brand surfaces the display face carries voice — reaching for the same safe sans every build produces monoculture. Selection procedure for marketing display type:

1. Write three concrete brand-voice words from the brief ("warm, mechanical, opinionated" — not "modern, clean").
2. Note the font you'd reach for by reflex; if it's the same face your last marketing build used, reject it and rotate.
3. Pick for the voice words, then cross-check: "creative brief = serif" is itself a reflex — a distinctive sans display (Cabinet Grotesk, Satoshi, GT Walsheim class) is the right default for most creative/premium briefs. Serif display only when the brief is genuinely editorial, luxury, or publication-shaped, and rotate which serif.
4. Emphasize within a headline using italic or bold of the **same family** — never inject a one-word serif into a sans headline for "visual interest".

**Italic descender clearance:** italic display words containing `y g j p q` clip under `line-height: 1`. Use ≥1.1 and reserve bottom padding on the wrapper.

---

## Type Hierarchy

Create a clear scale from most important to least. Two weights (regular + one of
semibold/bold) cover most products; every added weight is another hierarchy level readers
must decode. For long-form reading (articles, docs) the body floor is 18px — 14-16px serves
UI labels and controls, not sustained reading.

### The ladder is what you use, not what you define

A nine-step scale is a palette. The **ladder** is the four to six steps that actually appear
in the built page, and it is the ladder a reader sees. Emitting most of a modular scale
produces a gradient of sizes where every step is 1.2x the last — legible, forgettable, and
the single loudest tell of a surface built by an agent rather than designed.

Measured on four surfaces whose typography is the reason people copy them (a project tool, a
deploy platform, a voice API, a commerce framework), at 2120x1143:

| | A | B | C | D |
|---|---|---|---|---|
| distinct sizes rendered in the fold | 9 | **4** | 5 | **4** |
| sizes below 14px | 4 | **0** | 2 | 2 |
| display size | 64 | 64 | 48 | 64 |
| next size used below it | 20 | 24 | 16 | 16 |
| **the jump** | **3.2x** | **2.7x** | **3.0x** | **4.0x** |
| weight of the display type | 510 | 450-500 | 400 | 500 |
| distinct weights | 3 | 3 | 3 | **2** |

Three rules fall out of that table, and all three are checkable:

1. **Four to six steps, not nine.** One label size, one body size, one intermediate, one
   section head, one display. Collapse everything else onto the nearest step. Half-pixel
   neighbours (13px and 13.5px) are never a distinction — they are indecision.
   Enforced by `type/crowded-ladder`.
2. **The display step sits 2.5x to 4x above the step below it, with nothing in between.**
   Display type is made by the **gap**, not by the size: 56px directly above 44px reads as
   slightly bigger text, while 76px above 30px reads as a headline. If the jump is small,
   either raise the display size or delete the step under it.
   Enforced by `type/display-not-separated`.
3. **Display type is not bold.** None of the four sets its largest type above 510. Big and
   bold reads cheap — a poster made in a hurry; big and medium reads like the size was
   already enough. Reserve 600-700 for 13-16px labels and buttons, where weight is the only
   emphasis available.
   Enforced by `type/bold-display`.

Corollary on small type: seven sizes under 14px is how a landing page ends up reading as a
dashboard. Two is plenty, and one of those should be the mono label size.

### Scale (a palette to choose from, not a set to emit)
```css
--text-xs:   0.75rem;   /* 12px - mono labels, captions */
--text-sm:   0.875rem;  /* 14px - secondary text */
--text-base: 1rem;      /* 16px - body text */
--text-lg:   1.25rem;   /* 20px - lead text */
--text-xl:   1.875rem;  /* 30px - section heads */
--text-2xl:  2.75rem;   /* 44px - the one big number, on data surfaces */
--text-3xl:  4.75rem;   /* 76px - display */
```
Pick four to six of these per surface and use nothing else. A dense console legitimately
sits low on the ladder (11 / 13 / 16 / 22 / 64); a restaurant page legitimately skips the
middle entirely (12 / 15 / 30 / 88). Both are ladders. Twelve evenly-spaced steps is not.

Match the *floor* to the product type — dense apps start at 11-13px, marketing at 13-16px —
but the jump to display stays large in both. A console with a 2.9x jump to its one headline
number is right; a console with twelve steps is not.

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

**`font-synthesis: none`** on any family missing a weight or style file. Without it, the browser fakes bold by smearing the outline and fakes italic by shearing it — synthesized glyphs that ship silently to production. Setting `font-synthesis: none` makes the gap fail visibly in development (regular weight renders where bold was requested) so it gets caught before ship, instead of shipping fake glyphs users never notice as wrong but perceive as slightly off.

### Feature Control: Properties Over Raw Tags

When a high-level CSS property and a raw OpenType feature tag both produce the same visual result, take the property. **Why it matters more than it looks:** a property degrades gracefully — a fallback font that lacks the matching axis or feature just ignores the property and falls back to its own default rendering, no error, nothing visibly broken. A raw feature tag has no such fallback path; it silently stops applying, and the gap stays invisible until someone diffs the rendered output against the design.

Where this shows up in practice: `font-variant-numeric: tabular-nums slashed-zero` instead of a hand-written feature-tag equivalent, for the tabular figures this skill already asks for anywhere numbers stack in a column; `font-weight` instead of `font-variation-settings: 'wght' 600` on variable fonts; `font-variant-caps` instead of a raw `font-feature-settings` string for small caps.

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

## Cap-Height Trimming & Underlines

- **`text-box: trim-both cap alphabetic`** strips out the half-leading a browser adds above and below the glyph outlines — that reserved sliver is what makes a single-line label inside a pill, chip, or button look like it's drifted below true center instead of sitting on it. Until support is universal, the old manual counter-measure still works: nudge the text node with a small negative margin or padding tuned to the font's own metrics.
- **`text-underline-position: from-font`** and **`text-decoration-thickness: from-font`** pull the underline's offset and weight from the font file's own metrics instead of the browser's generic guess — closer underlines on script-adjacent faces, correctly-weighted underlines on heavier display fonts.
- **Reserve dotted underlines for "more info" affordances** — glossary terms, `<abbr>`, inline definitions — not for links. A dotted underline reads as "hover for detail," and putting it on a normal link signals the wrong interaction.

---

## Anti-aliasing

- **Root smoothing (macOS):** apply `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale` once on `html` (Tailwind: `antialiased` on the root element). macOS renders text heavier than intended by default; this thins it for crisper text. Set it ONCE at the root — never per-element, or smoothed and unsmoothed text end up with visibly different weights. No-op on other platforms, safe to apply universally.
- Scaling text via `transform` can change smoothing
- Prefer animating a wrapper instead of text node directly
- If artifacts persist: `translateZ(0)` or `will-change: transform` to promote layer
