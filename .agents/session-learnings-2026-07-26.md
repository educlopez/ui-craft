# What a long iteration on the demo scenes taught the engine

**Written:** 2026-07-26. Source: a session that rebuilt the seven comparison scene pairs in
`ui-craft-docs` from scratch, repeatedly, against real critique.

> [!IMPORTANT]
> **Research log, not project state.** This document preserves the observations and wording
> from the session that produced them. It was reconciled with the repositories on
> **2026-07-28**; use the table below—not later historical claims—as the current status.

| Status | Current state |
|---|---|
| **Integrated** | The detector and guidance changes described under “Landed” shipped through PRs #84, #85 and #86; quality/count corrections followed in #88 and #89. The current registry contains **43 detector rules**. |
| **Partial** | Static typography rules now catch crowded ladders, weak display separation and overly bold display type. They do not replace rendered typography/geometry measurement. |
| **Pending** | A general rendered-geometry companion, explicit scan coverage, overflow/mis-sized-box measurement and last-line-fill measurement still require productized contracts and fixtures. |
| **Experimental** | Commitment/presence signals are descriptive telemetry only. They are not a quality score or gate; “bespoke mark” and per-surface calibration remain unresolved. |
| **External evidence** | Scene comparisons, Chromium measurements and `scene-audit.mjs` live in `ui-craft-docs`. They are evidence for this repo, not tests of this repo. |

**Current verification note:** the working tree now contains **139 detector tests**. In the
restricted audit environment 137 passed; the two URL cases were blocked by loopback sandbox
permissions, not assertion failures.

The scenes were the test harness. Everything below is a defect the *engine* either caused,
failed to catch, or has no vocabulary for — recorded because six of the measurement tools
built during that session were written inline and thrown away, and would otherwise be lost.

---

## Landed in this repo

| Change | Why |
|---|---|
| `tables/no-overflow-handling` reads ARIA tables | It only knew `<thead>`/`<th>`, so a compliant grid table with a sticky `role="row"` was reported as broken. Named as a known gap in #84's own message. |
| `copy/em-dash-flood` counts `&mdash;` and `&#8212;` | The rule could be cleared by escaping the character. Our docs page passed with eight visible em dashes. |
| `perf/image-no-dimensions` fix text completed | **The advice caused a defect.** It told authors to set `width`+`height` attributes and stopped there. |
| New: `layout/image-height-from-attribute` | The defect that advice produces, below. |
| New: `css/duplicate-declaration` | A property set twice in one block: the later value wins and the earlier one is dead. Our sign-in wordmark had `color` twice and shipped near-black type on a berry field at 1.6:1. **No rendered check can catch this class** — the text sits over imagery, where contrast is explicitly not measurable. When a measurement declares itself blind, the blind spot needs a source rule. |
| `isDisplayedNotApplied` skips self-identifying demonstration selectors | Our own landing peels slop off pass by pass with `[data-q="slop"]`, and the detector flagged the page for rendering what it exists to argue against. Reads the enclosing block's selector via `enclosingBlock(ctx)`, so it works on normally-formatted CSS where the declaration sits below the selector. |

Historical session count: 125 tests. The current count and result are recorded in the status
banner above; each landed change still carries regression coverage.

---

## The defect the engine caused, four times

The `width`/`height` attributes on `<img>` are **presentational hints**. An author who
follows `perf/image-no-dimensions`, sets both attributes, and then writes

```css
.shot img { width: 100%; aspect-ratio: 7 / 6; object-fit: cover; }
```

gets a stretched image: the attribute's `height` outranks `aspect-ratio` and an auto height.
Four scenes shipped visibly distorted before this was measured rather than eyeballed — one at
a ratio of 0.91 against a native 1.60.

Two lessons, and the second is the sharper one:

1. Advice that is incomplete is worse than no advice, because it is followed.
2. The check written for it in the docs repo **excluded `object-fit: cover`**, which is
   exactly where the bug lives. A guard that skips the common case is not a guard. The
   distinguishing signal turned out to be asymmetry: the rendered height matches the
   attribute while the width does not.

---

## The one that explains "mediocre" — measured against four real surfaces

The reviewer's verdict was that the scenes "come out mediocre and need many iterations", and
named four landings as the bar. So they were measured with the same probe as our own, at
2120x1143, rather than admired:

| signal | A | B | C | D | ours (before) |
|---|---|---|---|---|---|
| distinct font sizes in the fold | 9 | **4** | 5 | **4** | **14** |
| distinct sizes, whole page | — | — | — | — | **18** |
| sizes below 14px | 4 | **0** | 2 | 2 | **7** |
| display size | 64 | 64 | 48 | 64 | 56 |
| next size used below it | 20 | 24 | 16 | 16 | 44 |
| **the jump to display** | 3.2x | 2.7x | 3.0x | 4.0x | **1.27x** |
| weight of the display type | 510 | 450-500 | 400 | 500 | **700** |
| first headline pixel, down the fold | 24% | **64%** | 20% | 19% | **12%** |
| text nodes in the fold | 88 | **16** | 34 | 34 | 49 |
| hero asset share of fold | 68% | 32% | none | 31% | 35% at 4.9:1 |

Four findings, and not one of them is "be more creative":

1. **The ladder had no cliff.** They each use four to six sizes with the display step 2.7-4x
   above the next one used, and *nothing in between*. Ours used eighteen sizes in an even
   gradient where the largest was 1.27x its neighbour. A gradient of sizes is legible and
   forgettable; the cliff is what makes something read as display. Worse: an earlier pass in
   this same session "fixed the type-scale puddle" by putting every size on one twelve-step
   ladder. That was the wrong fix, applied confidently.
2. **Display type was bold.** None of the four goes above 510 on its largest type. We used
   700 everywhere. Big and bold reads cheap.
3. **The fold started at 12%.** Theirs start at 19-64%. And `recipe-landing.md` *told us to*:
   "top padding cap ~96px desktop... hero content floating halfway down the viewport reads as
   a layout bug". On a 900px viewport that cap lands the headline at 11%. **The guidance was
   the cause.** This is the second time in one session that our own advice produced the defect
   it was meant to prevent (the first was `perf/image-no-dimensions`).
4. **Seven sizes under 14px.** Two of the four have zero, and none has more than four. Small
   type is where a landing leaks "dashboard".

Landed from it: three rules — `type/crowded-ladder`, `type/display-not-separated`,
`type/bold-display` — the rewritten ladder section in `typography.md`, and the corrected fold
numbers in `recipe-landing.md`. All seven scenes were collapsed to four-to-six-step ladders
with medium display weight, and stay at 0 errors / 0 warnings.

The rules immediately found the same disease on the product's own landing page. At the time,
the probe reported **sixteen** sizes with the display at 1.22x its neighbour. This is a
historical measurement, not a current assertion: the page and census definition have since
changed, and the rendered audit now declares its inclusion/exclusion scope explicitly.

## Not yet in the engine — the measurable ones

Six tools were built inline during the session and deleted each time. All six are
deterministic and general. None exists in this repo.

### 1. The commitment metric — the highest-value idea of the session
*(Now built, in the docs repo's `scripts/scene-audit.mjs`. Still not in this repo.)*

The current registry has **43 detector rules**. They primarily reject anti-patterns or require
baseline safeguards; none provides a validated positive measure of craft ambition. The
shortest route to a perfect `0e/0w` can still be to risk nothing: a blank page with one
paragraph scores clean. The gradient the detector creates can point at *characterless*.

Three measurements reproduce a human's ranking of the same seven surfaces:

| Signal | How | Bland below |
|---|---|---|
| Display ambition | largest rendered font size ÷ body size | ~2.5× |
| Committed colour | share of the fold covered by a non-paper background | ~10% |
| Boxedness | count of elements with a visible border or shadow | above ~18 |

The original seven-scene experiment produced the rankings below, but later counterexamples
invalidated the total as a quality score: it can reward the same gradients, boxes and
oversized type that anti-slop rejects. Keep the three raw signals as conditioned telemetry,
not as “43 gates against slop, N against bland”.

The fourth signal tried — "a bespoke mark at scale" — **does not work as measured**. It
counted a chart SVG at 1352px as a hand-drawn mark. That dimension needs a different
definition and does not have one yet.

### 2. Type scale as a puddle

One scene shipped **16 distinct font sizes**, ten of them inside a 4.5px range. A
distinction nobody can see is not a distinction. Report every size in use and flag
neighbours closer than the smallest meaningful step.

### 3. Tracking and accent-hue drift

Nine letter-spacing values where three would do; tracking is a function of size, not a
per-element opinion. And three scenes spelled their accent at **two different hues** — the
dark variant had drifted 10–20°, which is the same defect as two radius steps for one
intention.

### 4. `line-height: normal`

Most text in most scenes ran on the font's own `normal`, which varies by family and is never
a decided value.

### 5. Overflow and mis-sized boxes

Measurable, and it found real defects eyes had missed: a `⌘K` hint 129px wide for 13px of
text (a flex child inheriting `flex: 1` meant for its sibling), and text spilling a container
because a negative margin used to enlarge a hit area was applied on the side flush with the
edge.

### 6. Last-line fill

Three paragraphs ended on two-word orphans. `text-wrap: pretty` fixes some; the rest need the
copy cut, and knowing which requires measuring the final line as a share of the measure.

---

## Traps worth writing into the references

- **A blanket `> *` rule silently resets `position`.** `.panel > * { position: relative }`
  carries the same specificity as `.panel-media { position: absolute }` and wins if it comes
  later. A full-bleed image rendered at grid-cell size for weeks because of this.
- **The negative-margin hit-area trick spills.** Padding a control and pulling the padding
  back with a negative margin grows the target without moving the layout — except on the side
  flush with the container edge, where it overflows.
- **An element positioned outside its parent's box defeats contrast checking.** A caption
  floated below its container is measured against the container's background, not what is
  actually behind it. Keep it inside, or the check is lying.
- **Scoped element rules leak.** `.lede code` and `p code` styled but left `<code>` elsewhere
  falling through to the UA's generic monospace — a third typeface, by accident.

---

## What the scenes learned that the skill did not

Reference patterns were read from mature products and applied to individual scenes. None of
it reached `references/`:

- **Product pages**: multiple real views, not one hero. Out-of-stock stated in place rather
  than removed. Payment/returns lines immediately under the action. On a beauty page: rating
  with a review count under the title, the two purchase modes side by side rather than
  stacked, disclosure accordions, quantity beside the action, and a shipping **date** rather
  than a duration.
- **Devtool heroes**: the product occupies 60–80% of the fold and is cut at the edge. A
  screenshot shrunk to fit is unreadable; cropped at near-native scale it reads as real.
- **Auth**: one proof asset, and the surfaces worth copying put a real product screen there,
  cropped at the panel edge.
- **Review dashboards**: a segmented filter and a scope dropdown above the table. Without
  them the table reads as a static report.
- **Anti-convergence, concretely**: "solar → amber", "cosmetics → blush pink", "devtool →
  dark mode with an acid accent" are all first reflexes of their category, which makes each
  the one choice that says nothing about the brand.

---

## Resolved after the first draft

- **The demonstration guard now reads the enclosing block.** `ctx` is threaded from the
  engine's line-rule loop into `isDisplayedNotApplied`, which calls `enclosingBlock()` and
  tests the block's selector. It caught the single-line case before and missed every normally
  formatted rule; `.slop-demo-btn` needed an explicit ignore comment, which is now removed.
- **The contrast check declares when it cannot measure.** Rather than silently comparing text
  against the colour underneath a photograph, it reports *not measurable* and says to judge by
  eye. An intervening surface at 0.85 alpha or more restores measurability, because that is
  what the eye actually reads — glass at 0.88 is a background, glass at 0.4 is not. Across the
  seven scenes this leaves two honest cases, both text on a pale gradient card.

## Resolved after the second draft

- **The commitment metric is built and permanent**, in the docs repo's `scene-audit.mjs`: it
  prints display ambition, committed colour and boxedness per scene plus a ranking. Two
  things had to be fixed before it was worth trusting:
  1. **It read every field as 0% of the fold.** Its own colour parser handled `rgb()` only,
     and Chromium serialises these scenes' backgrounds as `oklch(...)`. This is the same
     defect the contrast check had, in a second copy of the same idea — so the parser is now
     injected once per page via `addInitScript` and both measurements read it from there.
     Two copies of a colour-space conversion is two chances to fix only one.
  2. **A border on one side is a separator, not a box.** Counting them made a 14-row table
     read as 14 containers, which ranked the densest scene last for doing exactly what a
     console should do. Only a frame on three sides or more, or a shadow, is a container.
     After the fix the ranking matches judgement: the two dense reference surfaces sit at
     72 and 77, everything else at 88-100.
- **A scene can be internally incoherent and still score perfectly.** The docs pair was a
  deploy CLI in its masthead, sidebar and figure, and a design linter in its command list,
  flags, config, example output and exit codes — 0 errors on both sides, for a page that
  contradicted itself in the middle. No static rule reaches this, and it is worth saying out
  loud in the skill: after writing a surface, read it once as a stranger and check that the
  product it describes is one product.
- **The contrast check was measuring the wrong layer, and the bug was ordering.** It walked
  ancestors looking for an opaque surface, found `body` — which is opaque, and sits *below*
  the photograph — declared the caption measurable, and compared pale type against pale paper
  at 1.04:1. The covering media has to be found first; only then does a surface between the
  text and that media restore measurability. Also: position is not the signal. A caption
  absolutely positioned over an image in normal flow is the commonest way to put type on a
  photograph, and skipping static images missed all of them.
- **Large text has a lower bar, not no bar.** The contrast check stopped at 15px, which is how
  a 17px wordmark shipped at 1.6:1: too big to be "small text" and nothing else was looking.
  24px and up, or 18.66px at 700+, is 3:1.
- **An exceptions list with no action is a report.** The dashboard's queue card had three
  problems, no way to act on any of them, and 110px of dead air where the actions should
  have been. The dead air was the tell.

## Open, and deliberately unresolved

- The commitment metric's fourth signal — "a bespoke mark at scale" — has no working
  definition.
- The metric is honest about density but not aware of it: a console and a restaurant page are
  scored on the same boxedness curve, so the footer says to read the three numbers rather
  than the total. A per-kind expectation would be better and does not exist.
- Everything general in `scene-audit.mjs` still belongs in a rendered-geometry companion to
  the static detector, in this repo. That companion does not exist.
- **Superseded historical note:** the detector/guidance work is committed in #84, #85 and
  #86, with follow-up quality/count corrections in #88 and #89. This research log itself
  remains a separate, untracked project note until intentionally adopted.
