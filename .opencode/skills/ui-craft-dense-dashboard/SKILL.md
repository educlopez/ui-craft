---
name: ui-craft-dense-dashboard
description: "Dense dashboard / admin / Bloomberg / Retool / data-heavy internal tools. Locked knobs: CRAFT=7, MOTION=3, DENSITY=9. IBM Plex + mono numbers, semantic palette, 4/8px grid, sparklines, tabular-nums. Trigger on: dashboard, admin panel, data-dense, analytics, Bloomberg-like, Retool-like."
argument-hint: "[action: build|review|polish] [target]"
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

# UI Craft — Dense Dashboard

Pre-committed dense style: data-first, keyboard-first, operator tools. Bloomberg, Retool, Linear issues view, admin panels. Every pixel earns its place.

## Knobs (locked)

- **CRAFT_LEVEL = 7** — polished but not precious; operators value speed over sheen.
- **MOTION_INTENSITY = 3** — micro-only. Row hover, row active tint, inline confirm. No scroll reveals in table areas.
- **VISUAL_DENSITY = 9** — tight 4/8px grid; whitespace earns its place.

Do not re-ask these in Discovery. Confirm brand accent + dark/light preference only.

## Style anchors

- UI sans + mono pairing. Mono for every ID, hash, timestamp, code.
- Semantic palette required: success, warning, danger, info + one brand accent.
- `tabular-nums` on every numeric column; mono on identifiers.
- Tight 4/8px spacing grid. `px-3 py-2` table cells, `gap-2` toolbars.
- Sparklines everywhere; horizontal bars for categorical; area for time-series. No pie. No 3D.
- Keyboard shortcuts visible inline (`⌘K`, `J/K`, `E` to edit).
- Dense chrome: breadcrumbs + tabs + toolbars + filter chips are welcome.
- Micro-motion only. Row hover, row active, inline save. No entrance stagger.

## Base rules (inherited)

All rules in `../ui-craft/SKILL.md` apply. This file overrides knob defaults and adds style-specific guidance below. The anti-slop and craft tests still apply in full.

## Style-specific overrides

**Typography**

- UI: IBM Plex Sans or Inter, 400 / 500.
- Mono: IBM Plex Mono or Geist Mono for IDs, hashes, timestamps, code, version numbers, kbd.
- Body size: 13-14px default; 12px in dense tables is fine.
- `tabular-nums` on every numeric column, metric card, timestamp, duration.
- `font-variant-numeric: tabular-nums slashed-zero` for IDs + codes.
- Headings: compact. Page title 18-20px, section 14-15px 500.

**Color (semantic palette required)**

- Brand accent: one — primary actions, active tab, selected row accent tint.
- Semantic, subdued OKLCH (lightness 50-60, chroma ≤ 0.15):
  - success `oklch(60% 0.12 150)`
  - warning `oklch(72% 0.13 75)`
  - danger `oklch(58% 0.15 25)`
  - info `oklch(62% 0.12 240)`
- Never saturated hues — dashboards live on screens for 8 hours.
- Status dots, badge text, chip text use semantic color; backgrounds stay neutral.

**Spacing & layout**

- 4/8px spacing scale — never 5, 7, 9, 10. Stick to 4 / 8 / 12 / 16 / 24.
- Table cells: `px-3 py-2` default; `px-2 py-1.5` for ultra-dense.
- Toolbar rows: `gap-2`, `h-9` controls, `text-sm`.
- Sidebar: narrow (200-240px), subtle bg tint, icon + label; never full dark.
- Cards: `p-4`, 8px radius; 1px border over shadow.

**Data display**

- Every number column: `tabular-nums` + right-aligned.
- Every ID / hash / commit / timestamp: monospace.
- Sparklines inline in rows for trend context. 24-40px tall, single color.
- Category charts: horizontal bars. Time-series: area with 15% → 0% fade. No pies.
- Deltas: plain text `+12.5%` in semantic color, no pill.
- Empty states: one-line hint + keyboard shortcut to create.

**Chrome & navigation**

- Breadcrumbs + tabs + sub-toolbar together is expected and fine.
- Filter chips: outline style, removable `×`, no pill fill.
- Global command palette: `⌘K` visible in header search affordance.
- Row actions: inline icons on hover; also available via keyboard.
- Pagination: text `Page 3 of 42` + `tabular-nums`, plus `J/K` navigation.

**Motion**

- Row hover: background shift to `oklch(96% 0.002 250)` light / `oklch(20% 0.005 250)` dark, 80ms.
- Active/selected row: brand accent tint at ~6% opacity + 2px accent left border.
- Inline save / confirm: 150ms fade + check icon swap.
- No scroll-triggered reveals in table areas — they stutter long lists.
- Sort arrow, filter open, column resize: instant or <100ms.

## Reference files to read first

Load these from `../ui-craft/references/`:

- `dashboard.md` — primary reference; metric cards, charts, sidebar, tables
- `typography.md` — tabular-nums, mono pairing, scale
- `performance.md` — virtualization, list perf, compositor
- `responsive.md` — tablet + laptop breakpoints, toolbar collapse

Skip `inspiration.md` (landing-page focused), `sound.md`.

## Anti-patterns for THIS style

- Serif fonts anywhere in chrome or data. Editorial is a different variant.
- Proportional figures in numeric columns — always `tabular-nums`.
- Saturated hues — reads as consumer app, not operator tool.
- Colored pills on every delta — plain text in semantic color.
- Pie charts, donut charts, 3D charts. Ever.
- Vertical bar chart for time-series — use area/line.
- Uniform colored top borders on metric cards.
- Card grids with heavy whitespace — if it feels airy, wrong variant.
- Full-dark sidebar (common AI pattern) — subtle tint only.
- Scroll-triggered reveals or stagger animations in table areas.
- Hidden keyboard shortcuts — always surface `⌘K`, row shortcuts, help trigger.
- Vague loading states — show skeleton rows matching column structure, not generic spinner.
