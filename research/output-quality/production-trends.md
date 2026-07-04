# Production app trends — what to steal (2024–2026)

**Track A** in [POSITIONING.md](./POSITIONING.md). For landings/portfolios see [marketing-trends.md](./marketing-trends.md).

**Usage:** Load during `/craft dashboard`, default Build mode for app shells, and `recipe-dashboard.md` updates. Each trend includes a **production-safe** implementation note and **anti-slop guard**.

---

## 1. Shell & navigation

| Trend | What users recognize | Implement (production-safe) | Avoid |
|-------|---------------------|----------------------------|-------|
| **Soft sidebar** | Linear, Notion, Vercel | Tinted sidebar (`gray-1`), not `gray-950`. Active item = accent/10 + accent text | Dark full-black sidebar + neon active |
| **Collapsible rail** | Modern admin | Icon-only collapse at `lg` breakpoint; tooltips on icons | Hamburger-only mobile with no desktop nav |
| **Context header** | Stripe, Retool | Page title + breadcrumb + primary action right-aligned in one row | Mystery meat navigation |
| **Command palette** | Raycast, Linear, Notion | `⌘K` modal, recent actions, keyboard-first | Decorative search bar that does nothing |

---

## 2. Data & dashboards

| Trend | What users recognize | Implement | Avoid |
|-------|---------------------|-----------|-------|
| **Metric hierarchy** | Every good ops tool | One hero metric (larger, accent tint); secondaries neutral | Four identical stat cards |
| **Sparklines in cards** | Stripe, Baremetrics | 32px inline trend, single hue | Full chart crammed in card |
| **Row context** | Attio, HubSpot | Avatar + status dot + proportion bar in table cells | Plain spreadsheet grid |
| **Ghost filter bar** | Modern SaaS | Toolbar filters as ghost buttons; primary CTA elsewhere | Solid primary buttons in toolbar |
| **Time range as first-class** | Analytics products | Date range on any time-series view | Static "last 30 days" with no control |

---

## 3. Typography & color (product, not marketing)

| Trend | What users recognize | Implement | Avoid |
|-------|---------------------|-----------|-------|
| **Tight display numbers** | Fintech, analytics | `tabular-nums`, `-0.02em` tracking on KPIs | Proportional figures in tables |
| **Sentence case everywhere** | Apple HIG, modern SaaS | Nav, headers, buttons — sentence case | ALL CAPS section labels |
| **Tinted surfaces** | Linear, Arc | `accent/5` primary card; layered neutrals | White cards on white with heavy border |
| **Semantic color restraint** | Production dashboards | Green/red only when domain demands it | Rainbow delta pills |
| **Font with intent** | Distinctive SaaS | Theme preset picks body + optional display (Geist, IBM Plex, Söhne-class) | Inter on everything because "safe" |

---

## 4. Motion & feedback (subtle = professional)

| Trend | What users recognize | Implement | Avoid |
|-------|---------------------|-----------|-------|
| **Optimistic UI** | Notion, Linear | Instant row update + rollback on error | Spinner on every click |
| **Skeleton matches layout** | Good loading UX | Skeleton shape = final component | Generic spinner center screen |
| **Micro push on press** | iOS-influenced web | `scale(0.98)` on `:active` | `animate-bounce` |
| **Staggered list entrance** | Polished v1 apps | One section, max 50ms stagger, `once: true` | Everything fades in forever |
| **Success micro-moment** | Stripe-like | Checkmark draw, count-up on saved metric | Confetti on save |

---

## 5. States & onboarding (where non-designers feel quality)

| Trend | What users recognize | Implement | Avoid |
|-------|---------------------|-----------|-------|
| **Empty state with action** | Notion, Figma | Illustration or icon + one sentence + primary CTA | "No data" alone |
| **Activation checklist** | SaaS onboarding | 3–5 steps, progress, dismissible | Long tutorial modal |
| **Inline validation** | Modern forms | onBlur, error under field | Alert on submit only |
| **Error with recovery** | Production apps | Retry + copy error + link to docs | "Something went wrong" |

---

## 6. "Personality" without slop (signature bets for apps)

One per app shell — pick at build time, not at polish:

1. **Custom empty-state illustration** — simple SVG motif tied to domain (invoices, users, projects)
2. **Distinctive nav active indicator** — left bar, pill, or dot — consistent system-wide
3. **Welcome panel** on first login — one-time, dismissible, shows value not features
4. **Table row hover** with subtle lift + shadow (one table, the primary one)
5. **Keyboard hint** in footer or command palette — "⌘K to search" builds power-user credibility

---

## 7. Trends to NOT import from marketing skills

These read as "portfolio" or dated in production apps:

- Full-viewport scroll pinning
- Kinetic typography in body copy
- Mesh / aurora backgrounds behind data tables
- Glassmorphism on dense forms
- Cursor-follow effects
- Auto-playing carousels in app shell

---

## Rotation policy (generative, not random)

When user gives no brand direction, rotate **one axis per build** so outputs don't converge:

| Axis | Pool (pick 1) |
|------|----------------|
| **Theme preset** | Graphite, Porcelain, Signal, Carbon (expand over time) |
| **Accent hue family** | indigo, teal, rose, amber, forest (within OKLCH rules) |
| **Sidebar mood** | light tint, subtle dark tint, match content |
| **Signature bet** | empty state, nav indicator, command palette, table hover |

Document the pick in **Product Read** so the user can say "try a warmer accent" on iteration.

---

## Skill integration checklist (future PRs)

- [ ] `recipe-dashboard.md` — reference this file in Step 0
- [ ] `commands/craft.md` — Product Read + one rotated axis
- [ ] `themes.md` — 2–4 new production presets with distinct personality
- [ ] `SKILL.md` Top 12 — add "product signature" as default build step, not polish-only
- [ ] Eval fixtures — production dashboard with trend compliance bands
