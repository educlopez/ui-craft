# Dataviz — Perceptual Accuracy

Most AI-generated charts are rainbow 3-D pies on grid backgrounds with shouting legends. That's not dataviz — that's decoration. Dataviz is a science with names attached: Cleveland, McGill, Tufte, Bostock, Brewer. This file is the perceptual layer — `dashboard.md` handles dashboard chrome (sidebar, metric cards, toolbar); this handles what actually encodes information accurately.

---

## Cleveland-McGill Perceptual Hierarchy

Source: Cleveland, W. S. & McGill, R. (1984). "Graphical Perception: Theory, Experimentation, and Application to the Development of Graphical Methods." JASA.

Humans decode visual encodings with predictable, measurable accuracy. Ordered from most → least accurate:

1. **Position on a common scale** — e.g., dot plot, aligned bar chart. Highest precision.
2. **Position on unaligned scales** — e.g., small multiples with different baselines.
3. **Length** — e.g., bar chart, progress bar.
4. **Angle / slope** — e.g., line chart slopes, pie wedges.
5. **Area** — e.g., bubble chart, treemap.
6. **Volume** — e.g., 3-D bar (and yes, this is already worse than area).
7. **Color saturation / lightness** — e.g., heatmap.
8. **Color hue** — e.g., categorical colors. Lowest precision for quantities.

**Implication:** if a numeric comparison is load-bearing, prefer bar over pie, line over stacked area, dot plot over heatmap. Color hue is for categories, not quantities.

---

## Chart Selection Matrix

Match the data shape and analytical question to a chart. Fallbacks listed when the default isn't possible.

| Data shape + question | Default | Fallback | Avoid |
|----------------------|---------|----------|-------|
| Time series, one metric | Line | Area (sparingly, single series) | Vertical bars per day |
| Time series, categorical breakdown, totals | Stacked bar or stacked area | — | 100% stacked (hides totals) |
| Time series, categorical breakdown, individual trends | Small multiples (one line per panel) | Multi-line (≤ 4 series) | Spaghetti line chart (> 5 series) |
| Categorical, one metric | Horizontal bar (sorted) | Dot plot | Pie, unless n ≤ 3 and parts-of-whole is the story |
| Parts of a whole | Stacked bar (100%) with labels | Donut (n ≤ 5) | Pie with n > 5; donut without center total |
| Distribution of one variable | Histogram | Density / violin | Mean-only bar |
| Distribution across groups | Box plot or violin | Strip plot with jitter | Mean + error bar alone |
| Correlation of two variables | Scatter + trend line | Hex-bin (high n) | A correlation coefficient printed as a single number |
| Ranking | Horizontal bar sorted desc | Dot plot with reference line | Vertical bar with rotated labels |
| Geographic (regional) | Choropleth, **per-capita normalized** | Symbol map | Raw-count choropleth (shows population, not signal) |
| Flow / transition | Sankey (sparingly) | Cohort table, small multiples | Chord diagram for > 8 categories |
| Hierarchy | Tree / indented list | Treemap (area ≫ precision) | Sunburst for > 3 levels |

**Rule of thumb:** if you can't name the question the chart answers, remove it.

---

## Color for Data

Three families. Choose by the data's semantics, not by taste.

### Sequential — one direction (low → high)

For ordinal or continuous magnitude: revenue, count, score. Use perceptually uniform palettes.

- **viridis, cividis** (Matplotlib) — perceptually uniform, colorblind-safe, print-safe.
- **YlGnBu, YlOrRd** (ColorBrewer) — classic sequential, works on light backgrounds.

Never use a rainbow (hue-only) palette for sequential data. Hue is not ordered — the eye cannot rank red vs green by magnitude.

### Diverging — centered on a meaningful midpoint

For values with a neutral zero: surplus/deficit, above/below average, net promoter score.

- **RdBu, PiYG, BrBG** (ColorBrewer).
- The midpoint must be semantic, not arbitrary. Don't use diverging for "low to high" — that's sequential.

### Categorical — nominal classes

For discrete groups with no order: regions, departments, products.

- **Tableau 10, Okabe-Ito** (colorblind-safe, 8 hues).
- **Cap at 7 hues.** After that, hues become indistinguishable. Options: (a) group remainder into "Other", (b) repeat hues with patterns, (c) direct-label each series and drop the legend.

### Never-defaults

- Pie chart with > 5 slices.
- Rainbow / HSL-rotation palettes for sequential data.
- Red/green as the only signal (8% of men are red-green colorblind — add shape, icon, or label).
- Chart library defaults (Chart.js rainbows, Recharts' built-in `stroke`) without a palette override.
- The chart library's default grid (heavy lines at every tick).

---

## Tufte Principles, Distilled

Source: Tufte, E. R. (1983, 2001). *The Visual Display of Quantitative Information*.

- **Data-ink ratio** — maximize ink spent on data, minimize ink spent on chrome. Every gridline, tick, border, legend box must earn its space.
- **No chartjunk** — no 3-D, no gradients as decoration, no drop shadows on bars, no textures.
- **Small multiples over animated dashboards** — the eye compares adjacent panels faster than it compares across a timeline.
- **Annotation beats legend** — label the line, not a color swatch 200px away (see "Direct labeling" below).
- **Bar charts start at zero.** Length encodes magnitude; truncating the axis lies.
- **Line charts do NOT have to start at zero.** Position encodes change; a zero baseline can obscure the signal. Use judgment — when the story is "rose from 98 to 102", starting at zero hides it.

---

## Direct Labeling — the Quiet Superpower

A legend forces: read color, look 200px away, match, remember, come back. Direct labels collapse that into one saccade.

```jsx
// Bad — legend + color lookup + cognitive hop
<LineChart data={data}>
  <Line dataKey="revenue" stroke="#1f77b4" />
  <Line dataKey="costs" stroke="#ff7f0e" />
  <Legend />
</LineChart>

// Good — label at the end of each line, legend gone
<LineChart data={data}>
  <Line dataKey="revenue" stroke="#1f77b4">
    <LabelList dataKey="revenue" position="right" />
  </Line>
  <Line dataKey="costs" stroke="#ff7f0e">
    <LabelList dataKey="costs" position="right" />
  </Line>
</LineChart>
```

Works for: bar charts (label inside or at end of bar), scatter (label the outlier dots), small multiples (title per panel replaces legend).

---

## Small Multiples

Use when comparing the same metric across a dimension — 8 regions, 6 products, 12 months. The eye compares adjacent panels instantly; a single overlaid chart with 8 lines is a mess.

**Layout rules:**
- **Consistent axes across panels** — same x-scale, same y-scale. If scales differ, the comparison breaks.
- **Consistent chart type** — all lines, all bars; never mix.
- **One title explaining the one thing that varies** ("Revenue by region, Jan-Dec"), plus a small subtitle per panel naming that panel's dimension value.
- **3-6 columns** typically. 10+ panels = let it wrap; keep row heights equal.
- **Sort panels** by a meaningful order (magnitude, geography, alphabetical) — not by insertion order.

---

## Animated Transitions for Dataset Changes

Animate to reveal change, not for decoration. The D3 enter / update / exit pattern — now standard in Recharts, VisX, Framer Motion, and Observable Plot:

- **Enter** — new data points fade in and slide to position (200-300ms, `ease-out`).
- **Update** — existing points tween to new values (300-500ms, `ease-in-out`). The tween is the insight — the user's eye tracks which point moved where.
- **Exit** — removed points fade out and collapse (150-200ms, `ease-in`).

**Rules:**
- Tween values, not colors — category color stays stable so the eye can track a specific series.
- Respect `prefers-reduced-motion` — collapse to instant transitions.
- Never animate on mount just for the entrance. A dashboard loading is not a moment for choreography.

See `references/motion.md` for easing curves and the duration scale.

---

## Anti-Slop Checklist (Dataviz)

Ten items a reviewer will flag immediately. Fix before shipping.

- [ ] 3-D charts of any kind. Zero exceptions.
- [ ] Pie chart with > 5 slices, or any pie where parts-of-whole isn't the story.
- [ ] Rainbow / HSL-rotation palette for sequential or numeric data.
- [ ] Red and green as the only differentiator (color-blind failure — add shape or label).
- [ ] Truncated y-axis on a bar chart (bars lie about magnitude).
- [ ] Dense gridlines at every tick. Prefer sparse grid (every 2nd or 3rd), or baseline + target lines only.
- [ ] Axis labels in scientific notation (`1.2e6`) when `1.2M` or `1,200,000` is readable.
- [ ] Missing units on axes ("Revenue" vs "Revenue (USD, thousands)").
- [ ] Legend with > 7 entries without direct labeling.
- [ ] Choropleth of raw counts instead of per-capita / rate normalization.

---

## When `ui-craft-detect` Flags `dataviz/*` Rules

The detector rules map directly onto this file:
- `dataviz/no-pie-gt-5` → § Cleveland-McGill + § Chart Selection Matrix
- `dataviz/no-3d` → § Anti-Slop Checklist
- `dataviz/sequential-not-rainbow` → § Color for Data → Sequential
- `dataviz/direct-label-over-legend` → § Direct Labeling
- `dataviz/bar-starts-at-zero` → § Tufte Principles

Cross-reference when triaging a flagged chart.

---

## Sources

- Cleveland, W. S. & McGill, R. (1984). "Graphical Perception." *JASA*.
- Tufte, E. R. (2001). *The Visual Display of Quantitative Information*, 2nd ed.
- Bostock, M. et al. (2011). "D3: Data-Driven Documents." *IEEE TVCG*.
- Brewer, C. A. ColorBrewer 2.0 — [colorbrewer2.org](https://colorbrewer2.org/).
- Okabe, M. & Ito, K. (2008). "Color Universal Design."
- Wilke, C. O. (2019). *Fundamentals of Data Visualization*. O'Reilly.
