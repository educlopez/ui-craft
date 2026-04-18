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
