# Recipe: Landing Page

Outcome recipe for marketing landing pages — composition, section grammar, and the bar that makes the result publishable without a design retouch. Component rules live in [components.md](components.md), copy rules in [copy.md](copy.md), pattern evidence in [inspiration.md](inspiration.md). This file decides what to build and in what order.

**Who this serves:** zero-questions path → strong default. Designers treat the compositions as skeletons.

## Step 0 — Three inputs (defaults if unanswered)

| Input | Options | Default |
|---|---|---|
| What exists to show | live product (screenshots possible) / pre-launch (no product yet) / sales-led service | live product |
| Theme | a preset from [themes.md](themes.md) or existing brand tokens | brand tokens if present, else **Graphite** |
| One conversion action | trial signup / demo request / waitlist / purchase | trial signup |

The first answer selects the composition. One page, ONE conversion action — every section either advances it or gets cut.

## Step 1 — Pick the composition

### Product-forward (default — live product)

```
┌───────────────────────────────────────────────┐
│ nav: logo · 3-4 links · sign in · CTA (dark)  │
├──────────────────────┬────────────────────────┤
│ badge (what's new)   │                        │
│ H1 48-72px, 2-3 lines│   REAL product shot    │
│ sub ≤2 sentences     │   cropped at right     │
│ [primary] [ghost]    │   edge + fold ──────── │
│ micro-trust line     │   floating proof card  │
│ proof: metric + logos│              ▼fold     │
└──────────────────────┴────────────────────────┘
```

Text left (F-pattern — text-heavy reads left-anchored), product right, **cropped at the fold and the right edge** — a visual that ends in mid-air says "done"; one cut mid-element says "scroll". One floating mini-card over the shot (live metric, notification) adds depth and a second story beat.

### Message-forward (pre-launch / waitlist)

```
┌───────────────────────────────────────────────┐
│ nav: logo · 1-2 links · CTA                   │
│                                               │
│        H1 centered, 56-80px (Z-pattern)       │
│        sub, one sentence                      │
│        [email input + join CTA, attached]     │
│   offset proof: avatars+count LEFT, badge     │
│   RIGHT — break the symmetry deliberately     │
│        abstract visual / motif  ────── ▼fold  │
└───────────────────────────────────────────────┘
```

Center is allowed ONLY with asymmetric supporting elements — center-everything-symmetric is the template tell. No product? Never fake screenshots: use a distinctive abstract motif tied to the brand hue, or typographic composition.

### Proof-forward (sales-led / B2B service)

```
┌───────────────────────────────────────────────┐
│ nav + compact hero: H1 + sub + [demo CTA]     │
├───────────────────────────────────────────────┤
│ outcome strip: 3 specific metrics, large nums │
├───────────────────────────────────────────────┤
│ case block: quote + attributed face + numbers │
│ alternating with capability rows      ▼fold   │
└───────────────────────────────────────────────┘
```

The hero is modest; evidence is the hero. Numbers large and `tabular-nums`; every claim attributed (name, role, company). Buyers here distrust adjectives and read proof.

## Step 2 — Section grammar (below the hero)

Order, each answering ONE question; spacing 80-160px between majors, varied:

1. **Proof strip** — "do people like me use this?" Logos at low contrast + one specific stat ("teams cut X from 6h to 20min" beats "trusted by thousands").
2. **Feature rows × 2-3** — "what does it do for me?" Asymmetric alternating rows with REAL visuals (chart, flow, screenshot detail). NEVER a uniform 3-column icon grid — that's the #1 template tell.
3. **How it works / depth section** — "is it credible?" 3 steps max, or one technical diagram. Cut it if the product is self-evident.
4. **Pricing teaser or full pricing** — "can I afford it?" See pricing block below.
5. **Final CTA** — "ok, how do I start?" Restate the primary action + the micro-trust line. One section, not a wall.
6. **Footer** — boring on purpose. Sitemap, legal, socials. Footers that try to be clever bury the links people need.

**Pricing block rules** (when present): highlight the recommended plan (border/badge/size) without making siblings look irrelevant; sticky column headers on long comparison tables; tooltips on hover for feature jargon; discounts shown as % under $100 and absolute amounts above (perceived size); charm pricing where the brand tolerates it; scarcity only if genuinely true — faked urgency reads instantly and burns trust.

## Step 3 — Craft constraints (the ones landings break most)

- **CTA hierarchy is three levels that must not tie:** nav CTA ≠ hero primary ≠ section CTAs. Hero primary is the most prominent interactive element on the page ([components.md](components.md)).
- **Headline carries a dual benefit** where honest — immediate + long-term ("Answers today, confidence at month-end"). Front-load the key noun. No jargon: a stranger gets the value in one read.
- **One signature detail** — drawn underline on the key word, a custom marker, a motif from the brand mark. Exactly one.
- **Specific beats vague, everywhere:** metrics with units, named customers, real UI. Every "world-class/powerful/seamless" is a slot where evidence should be.
- **Gradients**: if used, adjacent hues only, plus subtle grain/noise to kill the flat plastic look. Never the purple-cyan template wash.
- **Copy budget:** no section over 2-3 sentences; CTAs are verb + outcome ("Start free trial", not "Get started" twice in different colors).

## Step 4 — Build order

1. Tokens (preset or brand) → 2. Nav + hero (squint test must pass with hero alone) → 3. Proof strip → 4. Feature rows → 5. Pricing → 6. Final CTA + footer → 7. Responsive pass ([responsive.md](responsive.md) — hero stacks text-first on mobile, shot below, still cropped) → 8. Motion: entrances subtle, one scroll reveal per section max ([motion.md](motion.md)) → 9. Finish: [finish-bar.md](finish-bar.md) passes 1-4 + 8.

## Acceptance bar — publishable without retouching?

- [ ] Squint test on the hero: H1 → primary CTA, in that order; nothing competes
- [ ] One conversion action; every section advances it
- [ ] Product/visual cropped at fold or edge (scroll tease); no visual floating in dead air
- [ ] CTA hierarchy: 3 distinct levels, no ties
- [ ] At least one specific, attributed proof point; zero unattributed superlatives
- [ ] No uniform icon-card grid anywhere
- [ ] Section spacing 80-160px, varied; every section answers one question
- [ ] One signature detail, exactly one
- [ ] Mobile: hero readable without zoom, CTAs thumb-reachable, no horizontal scroll
- [ ] `prefers-reduced-motion` honored; entrances ≤400ms; no scroll-jacking

## Cross-refs

[inspiration.md](inspiration.md) observed patterns · [components.md](components.md) buttons, links, nav · [copy.md](copy.md) voice, CTAs, numbers · [themes.md](themes.md) presets · [recipe-dashboard.md](recipe-dashboard.md) when the hero shot needs a product UI worth showing
