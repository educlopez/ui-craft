# Recipe: Landing Page

Outcome recipe for marketing landing pages — composition, section grammar, and the bar that makes the result publishable without a design retouch. Component rules live in [components.md](components.md), copy rules in [copy.md](copy.md), pattern evidence in [inspiration.md](inspiration.md). This file decides what to build and in what order.

**Who this serves:** zero-questions path → strong default. Designers treat the compositions as skeletons.

**Portfolios / case studies:** use this recipe with **DESIGN_VARIANCE 8** (craft-intent default) — variable grid aspects, one hero project above fold, asymmetric about/contact. Marketing patterns (§5) apply; default composition is often message-forward or proof-forward with editorial type.

**Load [craft-intent.md](craft-intent.md)** and [inspiration.md](inspiration.md) hero archetypes — apply marketing patterns (§5), default **DESIGN_VARIANCE 7** (6 for waitlist-only), pick **signature bet** from craft-intent §3 marketing list in the Craft Read.

## Step 0 — Three inputs (defaults if unanswered)

| Input | Options | Default |
|---|---|---|
| What exists to show | live product (screenshots possible) / pre-launch (no product yet) / sales-led service | live product |
| Theme | a preset from [themes.md](themes.md) or existing brand tokens | brand tokens if present, else **Graphite** |
| One conversion action | trial signup / demo request / waitlist / purchase | trial signup |
| Variance | DESIGN_VARIANCE 1-10 | 7 (6 if pre-launch / waitlist only) |
| Signature bet | one from [craft-intent.md](craft-intent.md) §3 marketing list | hero crop or floating proof card |

The first answer selects the composition. One page, ONE conversion action — every section either advances it or gets cut.

## Step 1 — Decide what the fold argues, then draw its geometry

Two decisions, in this order, and they are not the same decision. **What the fold argues** is yours to choose from the brief. **How it is laid out** is drawn, not chosen.

Until 2026-08-13 this section shipped three ASCII diagrams, one per strategy, and the first was labelled *default*. Its geometry was text one side and a visual the other — which is the `split` composition class, the one `fold_candidates` deliberately draws last because *"it is the fold every generator reaches for unprompted."* Measured across seven landing builds, every fold that got built was one of the three geometries those diagrams prescribed, and none was the class the draw had offered. A drawn class cannot introduce variety while this file ships the answer with a picture, so the pictures are gone and the content grammar stayed.

### 1a — What it argues

| Strategy | Lead with | Fold carries |
|---|---|---|
| **Product-forward** — live product to show | the product doing its job | badge (what's new, or none) · H1 2-3 lines · sub ≤2 sentences · primary + ghost CTA · one micro-trust line · a real product shot, cropped at the fold **and** an edge · at most one floating mini-card over it (live metric, notification) for depth |
| **Message-forward** — pre-launch, waitlist, no product to show | the claim, in language | H1 as the largest thing on the page · sub one sentence · email input with the join CTA attached to it · proof placed off-centre on purpose (avatars + count one side, badge the other) · an abstract motif rather than a screenshot |
| **Proof-forward** — sales-led, B2B service | evidence before argument | compact H1 + sub + demo CTA · an outcome strip of exactly 3 specific metrics in large numerals · a case block: quote + attributed face + numbers · capability rows alternating beneath |

No strategy is a default. A brief with a live product picks product-forward; a brief without one cannot.

### 1b — What it looks like

Call **`fold_candidates`** and commit to one of the classes it returns. Do not pick by taste: asking a model for a composition returns its default every time, which is how eight builds in a row produced the same hero. The draw is seeded per project, so two projects start somewhere different and one project stays reproducible.

The six classes are geometric and orthogonal to 1a — `type-only`, `full-bleed-overlay`, `split`, `stacked`, `product-dominant`, `band`. Most strategies can be built as most classes. The exclusions are the ones where the geometry cannot carry the argument:

- **product-forward** cannot be `type-only` — no visual means no product
- **message-forward** cannot be `product-dominant` — nothing to dominate with
- **proof-forward** cannot be `full-bleed-overlay` — one dominating image cannot hold three metrics and a case block

Anything else the draw offers is legitimate. If it draws a class that fights the brief for a reason not listed above, say which reason in the Craft Read and draw again — do not silently substitute the shape you had in mind.

### 1c — Verify what you actually built

Render it and call **`check_fold` with `expected_class`** set to the class you committed to. Without that argument it reports what the fold *is* and cannot tell you whether it is what you intended — and it will say so rather than imply agreement.

If it reports drift, the geometry moved while you were writing. Fix the build to match the class, or record in the brief that the class changed and why. A declared class the code does not honour is worse than no declaration: it reads as compliance to anyone auditing the transcript.

Record the class in the brief's spent list ([brief.md](brief.md)) so the next landing in this project draws something else.

### Hero discipline (all compositions)

The hero is a single moment, not a feature list. Hard limits:

- **Max 4 text elements:** one eyebrow/badge (or none), headline (≤2 lines desktop), subtext (≤20 words, ≤4 lines), CTAs (1 primary + ≤1 secondary). If the value prop needs more than 20 words of subtext, the value prop is unclear — fix the copy, not the limit.
- **Plan font scale and asset together.** Headline >6 words with a large hero shot → start at 48-60px, not 72-80px. A 4-line hero headline is always a font-size error.
- **Nothing else rides the hero:** trust micro-strips, pricing teasers, feature bullets, avatar rows, and the logo wall all live in dedicated sections **below** the fold line. One micro-trust line under the CTAs is the ceiling.
- **The headline starts 18-30% down the fold, not at the top.** This used to read "top padding cap ~96px", and that cap was wrong: on a 900px viewport it puts the headline at 11%, which is where a dense app starts its content, not a landing. Measured on four surfaces whose design is the reason people copy them, the first headline pixel lands at **19%, 20%, 24% and 64%** of the fold. 18-30% is the working band; above 30% is a deliberate, centred composition and needs the rest of the fold to be nearly empty to earn it. On 900px that is **160-270px of clear space** above the eyebrow — an amount that feels wrong while you are writing the CSS and correct the moment you look at the render.
- **Ink density in the fold: 15-35 text nodes.** The same four measured 16, 34, 34 and 88 — and the 88 is a page whose fold is 68% one product screenshot, so its text is concentrated inside that image. A fold with 50 separate text nodes is a dashboard. Count them: if the fold has more than ~35, something in it belongs to the section below.
- **The hero asset is 30-70% of the fold, or it is absent.** Measured: 68%, 32%, 31%, and one page with no hero image at all. What does not work is the middle: a 4:1 letterbox band or a small framed card reads as a placeholder for a real asset. Either give the product most of the fold and crop it at the edge, or commit to type alone.
- **No decorative cues:** no "Scroll to explore", no ↓ arrows, no version badges (BETA, v0.6) unless the brief is literally a launch announcement, no mono-caps decoration strips at the hero foot.

Order, each answering ONE question; spacing 80-160px between majors, varied:

1. **Proof strip** — "do people like me use this?" Logos at low contrast + one specific stat ("teams cut X from 6h to 20min" beats "trusted by thousands").
2. **Feature rows × 2-3** — "what does it do for me?" Asymmetric alternating rows with REAL visuals (chart, flow, screenshot detail). NEVER a uniform 3-column icon grid — that's the #1 template tell.
3. **How it works / depth section** — "is it credible?" 3 steps max, or one technical diagram. Cut it if the product is self-evident.
4. **Pricing teaser or full pricing** — "can I afford it?" See pricing block below.
5. **Final CTA** — "ok, how do I start?" Restate the primary action + the micro-trust line. One section, not a wall.
6. **Footer** — boring on purpose. Sitemap, legal, socials. Footers that try to be clever bury the links people need. No fake version stamps (`v1.4.2`, `Build 0048`) — those are devtool fixtures, not marketing content.

**Layout-family budget.** A layout family (3-column cards, split text+image, full-width quote, bento, marquee) appears **at most once per page**; a page with 8 sections needs ≥4 distinct families. Max 2 consecutive image+text splits — the third consecutive zigzag is a fail; break it with a full-width section, a vertical stack, or a bento. "Selected work" must not look like "What we do".

**Eyebrow budget.** Max 1 uppercase tracked micro-label per 3 sections (hero counts as one). Mechanical check: count `uppercase` + wide-tracking labels above headings; if count > ceil(sections / 3), delete eyebrows until it passes — the headline alone is enough.

**Imagery is not optional.** Marketing pages are visual products; a text-only page is incomplete work, not minimalism. Priority order: (1) real product shots / brand assets, (2) image-generation tool if available in the environment, (3) clearly-labeled placeholder slots plus a list for the user of what's needed — never div-built fake screenshots or hand-drawn decorative SVG scenes. Logo walls use real SVG marks (both themes); invented brands get a simple monogram mark, never styled text wordmarks. Logos only — no industry labels printed under each logo.

**Pricing block rules** (when present): highlight the recommended plan (border/badge/size) without making siblings look irrelevant; sticky column headers on long comparison tables; tooltips on hover for feature jargon; discounts shown as % under $100 and absolute amounts above (perceived size); charm pricing where the brand tolerates it; scarcity only if genuinely true — faked urgency reads instantly and burns trust.

## Step 3 — Craft constraints (the ones landings break most)

- **CTA hierarchy is three levels that must not tie:** nav CTA ≠ hero primary ≠ section CTAs. Hero primary is the most prominent interactive element on the page ([components.md](components.md)).
- **Headline carries a dual benefit** where honest — immediate + long-term ("Answers today, confidence at month-end"). Front-load the key noun. No jargon: a stranger gets the value in one read.
- **One signature detail** — drawn underline on the key word, a custom marker, a motif from the brand mark. Exactly one.
- **Specific beats vague, everywhere:** metrics with units, named customers, real UI. Every "world-class/powerful/seamless" is a slot where evidence should be.
- **Gradients**: if used, adjacent hues only, plus subtle grain/noise to kill the flat plastic look. Never the purple-cyan template wash.
- **Copy budget:** no section over 2-3 sentences; CTAs are verb + outcome ("Start free trial", not "Get started" twice in different colors).

## Step 4 — Build order

1. Tokens (preset or brand) → 2. Nav + hero (squint test must pass with hero alone; then check the two numbers: headline top at 18-30% of the fold, and 4-6 distinct font sizes on the page with a 2.5x+ jump to display — see [typography.md](typography.md)) → 3. Proof strip → 4. Feature rows → 5. Pricing → 6. Final CTA + footer → 7. Responsive pass ([responsive.md](responsive.md) — hero stacks text-first on mobile, shot below, still cropped) → 8. Motion: entrances subtle, one scroll reveal per section max ([motion.md](motion.md)) → 9. Finish: [finish-bar.md](finish-bar.md) passes 1-4 + 8.

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
- [ ] Craft Read declared; variance and signature bet match the built page
- [ ] No two adjacent sections share the same layout structure; no layout family repeats; ≤2 consecutive image+text splits
- [ ] Hero discipline: ≤4 text elements, subtext ≤20 words, headline ≤2 lines, logo wall below the hero
- [ ] Eyebrow count ≤ ceil(sections / 3); no numbered section eyebrows; no scroll cues
- [ ] One CTA label per intent across the page (nav, hero, footer reuse the same words); every CTA fits one line at desktop and passes AA contrast on its own background
- [ ] Real imagery where the composition calls for it; no div-built fake screenshots; logo wall is real SVG marks
- [ ] `prefers-reduced-motion` honored; entrances ≤400ms; no scroll-jacking

## Cross-refs

[inspiration.md](inspiration.md) observed patterns · [components.md](components.md) buttons, links, nav · [copy.md](copy.md) voice, CTAs, numbers · [themes.md](themes.md) presets · [recipe-dashboard.md](recipe-dashboard.md) when the hero shot needs a product UI worth showing
