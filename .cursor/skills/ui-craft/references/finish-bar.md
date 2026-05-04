# Finish Bar

Ten finishing passes, each with measurable criteria. Run before shipping. Gated to `CRAFT_LEVEL ≥ 8` or `/finalize`. The point is not more rules — each pass surfaces a class of failure the others can't catch. Passes share no blind spots by design.

---

## How to Run the Bar

Run passes in order. Earlier passes (hierarchy, type system, surface stack) are foundational — changing them after later passes would invalidate findings downstream. Sequence is not arbitrary.

For each pass: collect findings, assign severity (Critical / Major / Minor), then fix or defer with a written reason. "Defer" without a reason is not a defer, it's a skip.

**Done** means each pass returns zero Critical and zero Major findings. Minor findings are explicitly accepted — write them down and ship anyway, or address them. Unwritten Minor findings are ignored findings.

Time budget: one screen with a single primary action takes 15–30 minutes. A full multi-screen flow takes hours. Don't try to run the bar on the whole app at once — run it on a vertical slice, ship, repeat.

The bar is opinionated about what matters. When a pass conflicts with a recorded project decision (e.g., the project deliberately uses dense data tables that violate Pass 4's spacing rhythm), the pass yields. Cite the principle in `brief.md` that overrides. If no brief principle covers it, the conflict is a finding, not a defer.

---

## Pass 1 — Hierarchy

**Goal:** the surface resolves to one primary thing on first glance. The rest reads as supporting.

**Criteria:**
- Squint test passes: blur the screen or squint for 200ms. One element dominates. (Perceptual basis in `layout.md` — Squint Test section.)
- Primary / Secondary / Tertiary / Quaternary named explicitly for this surface before touching pixels. Write them down.
- Adjacent hierarchy levels differ by ≥1.5× in at least one signal: size, weight, contrast, surface area, or position.
- One focal point per viewport. Two elements at the same visual weight means one is wrong.
- Navigation, footers, and sidebars sit below content in perceived weight — they are infrastructure, not content.

**How to verify:** apply `filter: blur(8px)` in DevTools or squint physically. If the layout reads as a flat field of similar shapes, hierarchy failed. If two things fight for dominance, name which one wins and why; the loser gets demoted.

**When it doesn't apply:** purely transactional confirmations (a single action + summary) legitimately collapse to two levels — the action versus everything else. That's correct.

---

## Pass 2 — Type System

**Goal:** typography is a system, not a collection of styles that happen to coexist.

**Criteria:**
- ≤3 font weights in the visible viewport. More signals indecision, not richness.
- Tabular numerals on every cell, badge, or display element containing numerical data (`font-variant-numeric: tabular-nums`).
- OpenType features active where the font supports them: discretionary ligatures off in UI, contextual alternates on for serif headlines, kerning always on.
- Prose body line-length: 50–75 characters. UI labels, badges, and tables are exempt.
- Letter-spacing scoped per role: Latin sans-serif display tightens at large sizes; small utility labels widen. Never adjust CJK or Arabic spacing — those scripts have their own optical metrics.
- One body face, optionally one display face, optionally one mono. No fourth face.

**How to verify:** grep rendered `font-weight` declarations on the surface — count distinct values. Inspect numbers in DevTools computed styles for `font-variant-numeric`. Measure a prose container by pasting its text into a character-count tool.

**When it doesn't apply:** single-screen experiences with no prose (a confirmation dialog, a product card) skip the line-length criterion. The weight and numeral criteria still apply.

---

## Pass 3 — Surface Stack

**Goal:** at least three distinguishable elevation levels, both modes intentional.

**Criteria:**
- Canvas, raised, and overlay surfaces are visually distinct: ≥2% luminance delta in light mode, ≥4% in dark mode.
- Semantic naming in tokens: `--surface-canvas`, `--surface-raised`, `--surface-overlay` (or equivalent). No unnamed magic values.
- Dark mode surfaces are not inverted light primitives. Canvas in dark sits at a near-black with a hue tint — not `#000000`. Raised surfaces add luminance, not just reduce it.
- `color-scheme` declared so native form controls follow the mode.
- Shadows fall back to border tints in dark mode where shadow-on-dark loses effect. A 10% opacity drop shadow on a near-black background is invisible — replace it.

**How to verify:** render side-by-side in both modes. Toggle rapidly. Dark should not look like a photo-inverted version of the light surface — it should look like a deliberate reinterpretation. Cross-ref the intentional-dark test in `tokens.md`.

**When it doesn't apply:** single-mode embedded UIs (a terminal panel, an e-ink reader context) where dark mode is not a product requirement.

---

## Pass 4 — Spacing Rhythm

**Goal:** within < between < section, at every nesting level without exception.

**Criteria:**
- Every spacing value comes from the token scale. No arbitrary px values. (`layout.md` — Spacing Rhythm section.)
- The rhythm invariant holds at every nesting level: label 4px above its input, inputs 16px apart within the form, form 48px from the next section. Check three nesting levels minimum.
- Section breaks are ≥2× the inter-block spacing. If they are not, sections blur into blocks.
- Optical adjustments noted explicitly: icon vertical nudge to optical center, modal vertical offset for visual weight. Document these as intentional, not accidents.

**How to verify:** scroll the surface slowly. At each nested group, check that the surrounding space is visibly larger than the internal space. If you cannot tell which level you are in from spacing alone, the rhythm broke.

**When it doesn't apply:** dense data tables and command palettes deliberately compress. The proportion still holds — the absolute values shrink. Never collapse two adjacent levels to the same value regardless of density.

---

## Pass 5 — Iconography

**Goal:** one icon family, stroke weight matched to type, geometry coherent across the surface.

**Criteria:**
- Single icon family throughout the surface. No mixing families from different systems.
- Icon stroke weight visually matches body type weight: 1.5px stroke for `font-weight: 400`, 2px for 500. Mismatched weights read as elements from different UIs.
- Icon-to-type size ratio is consistent: if a 24px icon appears beside a 16px label, that ratio holds throughout. A 20px icon beside a 16px label elsewhere is a finding.
- Container shape is one of: circle, rounded square, squircle. Chosen once, held throughout. No surface where some icons have circle containers and others have rounded squares.
- No non-icon characters standing in for designed icons anywhere outside user-generated content contexts.

**How to verify:** collect every icon instance on the surface in a contact sheet (screenshot + arrange). They should look like siblings from one family. Any that don't match immediately is a finding. Cross-ref `inspiration.md` — "What Mature Interfaces Never Do" section.

**When it doesn't apply:** emoji as user content (chat reactions, message-thread rosters) are content, not icons — they are exempt from family and stroke criteria.

---

## Pass 6 — State Coverage

**Goal:** every state designed, not defaulted or missing.

**Criteria — all eight states must have explicit designs:**
- **Idle** — the resting state is intentional, not just the absence of everything else.
- **Loading** — skeleton matches the final layout geometry; shown after ~200ms to avoid flash on fast connections.
- **Empty** — one line explaining why it's empty + one primary action. Never "No items found" with no next step.
- **Error** — inline, actionable: what failed + what the user does next. Never a modal for a recoverable field error.
- **Success** — visible beyond color change: icon swap, position shift, or explicit confirmation text.
- **Partial** — unknown values rendered as em-dash; never `null`, `N/A`, or `0` for a value that isn't actually zero.
- **Conflict** — concurrent-edit or stale-data scenarios handled with explicit UI, not silent overwrites.
- **Offline** — skeleton persists past the loading timeout with an affordance that explains the surface is stale.

**How to verify:** write the eight state names on paper. For each interactive surface, mark which states have explicit designs. Unmarked states are Critical findings. Cross-ref `state-design.md`.

**When it doesn't apply:** read-only static surfaces (an embedded widget, a printed report) genuinely have only idle and loading. Conflict and offline states are not applicable.

---

## Pass 7 — Motion Tuning

**Goal:** every transition is purposeful, sub-400ms for UI, and motion-gap-clean.

**Criteria:**
- UI transitions use the duration scale's transition band: 100–400ms. Nothing outside this range for interactive state changes.
- Easings have perceptual basis: no `linear` for spatial motion, no symmetric `ease-in-out` on hover — spatial motion should ease out. (Cross-ref `motion.md` — Duration and Easing Scale.)
- Motion-gap audit clean: no interactive state changes that snap without a transition where the change is visually significant (appearance, disappearance, repositioning).
- Reduced-motion contract honored: `prefers-reduced-motion: reduce` collapses durations to ≤80ms or removes entrance animations entirely. The surface must be fully usable without motion.
- Custom curves where the surface demands character. The four named CSS easing keywords are a starting point, not a destination.

**How to verify:** trigger every interactive state in sequence and watch the transitions. Anything that snaps where a transition is expected is a Pass 7 Critical. Verify `prefers-reduced-motion` in DevTools by emulating the media feature.

**When it doesn't apply:** static surfaces with no state changes have no motion to audit. Skip the motion-gap pass, but the reduced-motion contract still applies if any CSS animation exists.

---

## Pass 8 — Microcopy Voice

**Goal:** every string has voice, specificity, and a single author.

**Criteria:**
- Verbs consistent across primary actions throughout the surface. Pick one form and hold it.
- No placeholder copy in production paths: no lorem ipsum, no generic names, no TODO comments, no XXX strings.
- No generic CTAs — every call to action names the specific outcome of the action.
- Error messages name what operation failed and offer a concrete next step. "Something went wrong" is not an error message.
- Empty states contain exactly one primary action — not three suggestions, not a paragraph, not a link list.
- Voice axes locked per the brief: formality, expertise level, and relationship position documented in `brief.md`. All strings on this surface should sound like the same product.

**How to verify:** extract every visible string from the surface. Read each one out of context — stripped of layout and visual hierarchy. Each should still communicate clearly and sound like the same product. Cross-ref `copy.md` voice matrix and `brief.md`.

**When it doesn't apply:** legal text (terms, privacy notices, regulatory copy) is locked to compliance language and exempt from product voice criteria.

---

## Pass 9 — Pixel Honesty

**Goal:** small details match the resolution intent of the design.

**Criteria:**
- Borders use sub-pixel approaches where a hairline is intended: `border: 1px solid color-mix(in oklch, var(--text-primary) 8%, transparent)` reads as a separator; a solid `neutral-200` border reads as a structural edge. Use the right one.
- Shadow stacks use 2–3 layers for depth perception. A single shadow at one blur value looks flat and unconvincing.
- Corner radii vary by element role: buttons, cards, and inputs each have a distinct radius. Uniform radius on every element is an AI-template tell — the single most recognizable signal of generated UI. (Cross-ref `inspiration.md` — Reference Token Values section.)
- Overflow handled on every text container: truncation includes a `title` tooltip, no `text-overflow: ellipsis` without a `max-width` set.
- Icon containers use squircles where the design language calls for it — circle and rounded square are not interchangeable.

**How to verify:** zoom to 200%+ and inspect details. Anything that "looks slightly off" at that zoom is a finding worth naming. The test is not whether it looks perfect at 100% — it's whether the details hold up under scrutiny.

**When it doesn't apply:** utility surfaces (internal tooling, admin dashboards) where the brief explicitly records that polish is deferred in favor of completeness. The decision must be in `brief.md`, not assumed.

---

## Pass 10 — Data Formatting

**Goal:** every number, date, and currency communicates the right thing at the right precision.

**Criteria:**
- Tabular numerals on all data display: cells, KPIs, badges, inline metrics (`font-variant-numeric: tabular-nums`).
- Counts abbreviated where the absolute value isn't the point: `1.2k`, `3.4M`, `12.5h`. Unabbreviated where the exact value matters.
- Relative time where the user cares about recency (`2m ago`, `yesterday`). Absolute time where provenance matters (`Mar 4, 14:32 UTC`). Never use one format everywhere — they answer different questions.
- Currency formatted to locale. Negative values distinguished by at least two signals: sign + color, or sign + parentheses for accounting contexts.
- Precision matches the decision granularity the user needs. A percentage to five decimal places is noise. A stock price rounded to the dollar is misleading. Match the precision to the question the number answers.

**How to verify:** inspect every numeric value on the surface. For each: what question does this number answer, and is the format right for that question? A count that could be `1,248` but shows `1.2k` when the user needs the exact number is a finding. Cross-ref `dataviz.md` for number formatting in chart contexts.

**When it doesn't apply:** integer-only surfaces (step counts, indices, item counts) skip currency and decimal precision criteria. Tabular numerals still apply.

---

## How Findings Map to Severity

**Critical — block ship:**
- Pass 1: no discernible hierarchy (flat field of equal-weight elements)
- Pass 6: states missing explicit designs (loading, empty, or error undefined)
- Pass 8: placeholder copy in production paths (lorem ipsum, TODO strings, generic names)

**Major — fix before ship when time allows; document if not:**
- Pass 3: surface stack incomplete or dark mode is an inverted light layer
- Pass 7: motion-gap failures on visible state changes; `prefers-reduced-motion` contract not honored
- Pass 9: uniform border-radius across all element types
- Pass 2: proportional numerals on tabular data (misaligned columns, impossible to compare)

**Minor — polish; ship-okay if explicitly accepted:**
- Pass 2: single weight-count violation (four weights, not three)
- Pass 5: icon stroke weight off by a half-unit
- Pass 10: currency format missing locale
- Pass 4: one spacing value that skips a token (an arbitrary 20px in an otherwise clean scale)

---

## When to Skip the Bar

- Internal tools where `brief.md` explicitly defers polish to product completeness. The deferral must be written, not assumed.
- Throwaway prototypes that will be discarded after a user test. If there is no brief, there is no bar.
- Single-screen confirmation flows where only 2–3 passes have anything to evaluate. Run those passes only, note the others as N/A.

The bar is a tool, not a ritual. Skipping it without recording why is the only wrong answer.

---

## Cross-References

- `brief.md` — which passes can be deferred and which are non-negotiable for this product; voice axes for Pass 8.
- `tokens.md` — Passes 3, 4, 7, and 9 require token discipline; intentional-dark test in Pass 3.
- `layout.md` — Pass 1 (hierarchy and squint test) and Pass 4 (spacing rhythm) primary references.
- `typography.md` — Pass 2 (type system) primary reference.
- `motion.md` — Pass 7 (motion tuning) primary reference; duration and easing scale.
- `state-design.md` — Pass 6 (state coverage) primary reference; state lattice.
- `copy.md` — Pass 8 (microcopy) primary reference; voice matrix, error copy, empty states.
- `dataviz.md` — Pass 10 (data formatting) primary reference for numeric display in chart contexts.
- `inspiration.md` — Pass 5 (iconography) and Pass 9 (pixel honesty); "What Mature Interfaces Never Do" and Reference Token Values sections.
- `accessibility.md` — every pass assumes a11y is satisfied at the floor. The finish bar is the ceiling, not the floor. Run `accessibility.md` first.
