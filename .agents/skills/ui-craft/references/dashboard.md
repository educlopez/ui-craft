# Dashboard Patterns

Detailed guidance for building data-heavy dashboards that feel designed, not generated.

## Layout Structure

A dashboard needs a sidebar + main content area. The sidebar is the navigation spine.

**Sidebar navigation:**
- Subtle background tint (e.g., `background: #f8fafc` / Tailwind: `bg-slate-50`, or `background: #030712` / Tailwind: `bg-gray-950`) — NOT full black unless Dark Premium style. A dark sidebar is a common AI pattern; prefer a subtle tint that complements the content area.
- Muted nav text that brightens on hover/active. Active item gets accent background at low opacity (`background: oklch(var(--accent) / 0.1)` / Tailwind: `bg-accent/10`) + accent text.
- Brand/logo at top, user profile at bottom.
- `aria-label="Main navigation"` on `<nav>`, `aria-current="page"` on active item.
- `overscroll-behavior: contain` on the sidebar if it scrolls independently.

**Main content area:**
- Filter/toolbar row at the top: ghost buttons for filters, active state uses accent bg at low opacity. Always include a date range selector.
- Content grid below filters: metric cards → charts → tables/lists.
- Minimum 3 different content types visible per viewport (e.g., metric cards + chart + table).

## Metric Card Hierarchy

Never show 4+ identical metric cards. Differentiate the primary metric.

**Primary metric card:**
- Accent-tinted background (`background: oklch(var(--accent) / 0.05)` / Tailwind: `bg-accent/5`) with accent-colored number, OR solid accent background with white text.
- Slightly larger number (36px vs 28px for others).

**Secondary metric cards:**
- White background, subtle border (`1px solid oklch(92% 0.005 250)`).
- Black number, secondary-color label.

**All metric cards should include:**
- Sparklines: 32px tall, polyline SVG, accent color with faded fill underneath.
- Change text: "+2,149 from last month" in `var(--text-tertiary)`. NEVER green arrows for positive, red for negative. Color implies judgment that may not be warranted.
- Label: sentence case, 12-13px, `font-weight: 500`, secondary color.
- Value: 28-36px, `font-weight: 700`, `font-variant-numeric: tabular-nums`, `letter-spacing: -0.02em`.
- NO colored top/left borders. NO colored change text. NO arrow icons next to percentages.

## Chart Type Decision Matrix

| Data story | Best chart | Why | Avoid |
|-----------|-----------|-----|-------|
| Trend over time | Area chart with gradient fill | Shows direction + volume | Vertical bar chart |
| Comparing categories | Horizontal bar chart | Labels are readable, easy to scan | Vertical bar with rotated labels |
| Comparing discrete values | Vertical bar chart | Natural for small sets (3-7 items) | Too many bars (>8) |
| Part-of-whole | Donut/ring chart (use sparingly) | Center text shows total | Pie chart — harder to compare |
| Inline trend in a card | Sparkline (32px polyline) | Minimal, contextual | Full chart crammed into a card |
| Conversion/funnel | Progressive bars with stage labels | Shows drop-off clearly | Donut chart |
| Never use | — | — | Pie charts, 3D charts of any kind |

## Chart Styling

- **Single accent hue at varying opacities** for multi-series: `accent/100`, `accent/60`, `accent/30`. Never rainbow colors.
- **Gradient fill underneath area lines**: line at full opacity, fill fades from ~15% at line to 0% at bottom.
- **Label placement**: axis labels in secondary text, 11-12px. Data point labels only on hover (tooltip), not permanently displayed.
- **Grid lines**: horizontal only, very subtle (`border-color: oklch(95% 0 0)` / Tailwind: `border-gray-100`). No vertical grid lines.
- **No chart chrome**: skip legends when there's only one series. Put context in the card title instead.

## Data Tables

Tables are the workhorse of dashboards. Make them earn their space.

- **Row context**: tiny avatars (24px), colored status dots (6px, not badges), flag icons, or proportion bars. Plain text tables feel like spreadsheets.
- **Status indicators**: small colored dots (6-8px) inline with text. "Active" with a green dot, not a green badge/pill. The dot conveys status; the text provides the label. Badges add visual noise and are an AI-slop pattern.
- **Proportion bars**: show relative values as width-proportional bars within cells. More visual than raw numbers.
- **Row hover**: subtle background highlight (`background: #f9fafb` / Tailwind: `hover:bg-gray-50`).
- **Headers**: sentence case, `font-weight: 500`, secondary color. NEVER uppercase table headers.
- **Alignment**: text left, numbers right, status center.

## Filter & Toolbar Patterns

- Ghost buttons for all filter controls — never solid primary buttons in a toolbar.
- Active filter state: accent background at low opacity + accent text, or subtle border change.
- Group related filters visually. Date range selector deserves more prominence (slightly larger or separated).
- "Reset filters" appears only when filters are active, as a text link — not a button.

## Content Density

Dashboards value density over breathing room (opposite of landing pages).

- Metric cards: tight padding (16-20px), not the generous 32-48px of landing page cards.
- Charts: minimize whitespace around the chart area. The data should fill the container.
- Tables: compact row height (40-48px). Dense but scannable.
- A dashboard should show enough data that a user can make a decision without scrolling. If the first viewport is just 4 large metric cards, you've wasted space.
- Aim for: 3-4 metric cards + at least one chart + start of a table/list — all above the fold.

---

## Signal-to-Noise Hierarchy

The most common AI-generated dashboard failure isn't any single bad choice — it's that every KPI, every chart, every card looks equally important. The user doesn't know where to look. Signal-to-noise hierarchy is the fix.

### Tiers

**Tier 1 — The hero metric.** One per dashboard. The number that answers "am I winning today?". Largest visual weight. Accent color is allowed here, and here only. Trend indicator adjacent (up/down + delta). Context micro-text below: "vs last 7 days" or "of monthly quota."

**Tier 2 — Supporting metrics (2-4).** The breakdown of the hero — if the hero is revenue, supports are revenue by channel, by region, by segment. Neutral colors. Smaller type. Grouped visually with the hero (shared container, aligned baseline).

**Tier 3 — Context (0-3 charts).** Trends, time series, comparisons. Chart type matches data shape (see `dataviz.md` and the Chart Type Decision Matrix above). Sparklines for micro-context inside cards. No large charts competing with the hero's visual weight.

**Tier 4 — Deep-dive.** Tables, filters, raw data. Accessible but not crowding the viewport. Often collapsed by default, or lives on a separate tab / route. The user drills in when they need it.

### The anti-pattern: "grid of 8 KPI cards with equal weight"

Every card the same size, same color, same layout → the user's eye has nowhere to land → the user scrolls looking for meaning → the user leaves. This is the single most recognizable AI-generated dashboard shape.

### The rule

One hero. 2-4 supports. Context behind. Deep-dive one click away. Test by squinting at the dashboard: your eye should land on ONE thing first. If it lands everywhere, the hierarchy is broken.

### Ranking decisions to document per dashboard

Before building, answer these:

- **What's the hero metric for this surface?** Different for exec view (revenue) vs operator view (tickets open) vs customer view (usage vs limit). See `personas.md` to ground this in concrete archetypes.
- **What supporting metrics contextualize the hero?** The 2-4 that make the hero actionable, not the 8 you could show.
- **What's deep-dive, not surface?** Everything the user needs once a week, not once a minute.
- **Who's the user and what decision are they making in the next 60 seconds?** If you can't name the decision, the dashboard has no job.

### Cross-references

- `dataviz.md` — chart selection by data shape; Cleveland-McGill perceptual hierarchy (position-on-common-scale is most accurate — use it for the hero).
- `heuristics.md` — Cleveland-McGill PASS/FAIL, Hick's Law for filter/nav choices.
- `personas.md` — concrete user archetypes to ground "who's the user" in reality, not abstraction.
