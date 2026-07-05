# Craft-quality blind-build prompts

Manual regression prompts for validating **Craft Read**, **DESIGN_VARIANCE**, and **signature bets** in real agent sessions. Not run in CI — your local auditor agent uses these after merging the craft-intent PR.

Run each prompt in a **fresh session** with ui-craft installed. Score subjectively (pass/fail) on the checklist below.

---

## Track A — Product surfaces

### A1 · Operator dashboard

> Build a SaaS dashboard for a B2B ops tool. Primary user is an operator who needs to know what needs action now. React + Tailwind. No existing brand — you pick the theme. Include sidebar nav, 4 KPI cards, and a table of recent items.

**Pass if:**
- [ ] Craft Read appears before code (surface, audience, product language, theme/accent, variance ~4, signature bet named)
- [ ] Sidebar is tinted neutral, not full black
- [ ] One hero metric reads larger than the others
- [ ] Signature bet is built in the first pass, not deferred to polish
- [ ] No purple mesh gradient or symmetric 3-icon feature grid

### A2 · Auth sign-in

> Build a sign-in page for a fintech app with Google + email auth. Split layout with a proof panel on the left. React + Tailwind.

**Pass if:**
- [ ] Craft Read with variance ~4 and an auth signature bet (panel proof, trust footer, or domain welcome)
- [ ] Panel is tinted neutral — not a saturated brand flood
- [ ] Form column ~360–400px, lowercase "or with email" divider
- [ ] Accent only on submit + links

---

## Track B — Marketing surfaces

### B1 · Devtool landing

> Build a landing page for a developer tool that syncs webhooks. Live product exists — show a real screenshot area. Primary CTA is trial signup. React + Tailwind.

**Pass if:**
- [ ] Craft Read with marketing language, variance ~7, marketing signature bet
- [ ] Hero is asymmetric (text + product visual cropped at fold)
- [ ] Hero discipline: ≤4 text elements, subtext ≤20 words, no logo wall or trust strip inside the hero
- [ ] No uniform 3-column icon-card feature grid; no layout family repeats
- [ ] Eyebrow count ≤ ceil(sections / 3); no numbered section eyebrows; no "Scroll to explore" cue
- [ ] CTA copy is specific ("Start syncing" beats "Get started"); one label per intent page-wide
- [ ] Adjacent sections use different layouts

### B2 · Designer portfolio

> Build a portfolio homepage for a product designer seeking hiring-manager attention. Showcase 4 projects. React + Tailwind. No brand yet.

**Pass if:**
- [ ] Craft Read with variance ~8
- [ ] One hero project above the fold
- [ ] Variable grid aspects or asymmetric about/contact block
- [ ] Display-scale headline with emphasis in the same family (italic/bold), not random serif injection
- [ ] Display face differs from the last marketing build (rotation, not the same safe sans every time)
- [ ] Real imagery or labeled placeholder slots — no div-built fake screenshots

---

## Track C — Redesign (existing surface)

### C1 · Dated marketing site

> Here's an existing landing page from ~2019 (any dated fixture or real page). Run `/redesign` — modernize it but keep the brand color, page structure, and heading semantics.

**Pass if:**
- [ ] Audits first (detector findings + section/heading/CTA inventory) before proposing anything
- [ ] States the preserve list (brand, IA/SEO, content voice, conversion paths) and the chosen scope (refresh/reskin/rebuild)
- [ ] Keeps every route, heading level, and CTA that existed before
- [ ] Detector findings after ≤ findings before
- [ ] Craft Read declared with variance 4–5; boldness spent on typography/composition, not a new palette

---

## Amplitude iteration (same session)

After each build, run in order:

1. `/bolder` on the result → variance/motion should rise; signature strengthens
2. `/quieter` on the result → amplitude drops; grid rhythm simplifies

**Pass if:** both commands change the UI without a full rewrite and honor `prefers-reduced-motion`.

---

## Scoring

| Result | Meaning |
|--------|---------|
| **5/5 surfaces pass** | Ship-ready craft-intent behavior |
| **4/5** | One surface type needs recipe tuning |
| **≤3/5** | Revisit craft-intent defaults or command wiring |

Record outputs (screenshots or file paths) in your audit notes for comparison across ui-craft versions.
