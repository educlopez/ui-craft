# Design Brief

Defines the format of `.ui-craft/brief.md` — the durable artifact that anchors every design decision in this project. Read it first when working on any UI task. If it doesn't exist, run `/brief` to generate one. Every decision you make should be traceable to a principle in the brief.

---

## The Brief Format

The brief is a single markdown file at `.ui-craft/brief.md`. Five sections, all required, all short. No preamble. No mission statements.

---

### 1. Product purpose (1 sentence)

What this product does, in one sentence. Not a tagline. Specific. The kind of sentence a stranger could repeat after reading once.

> **Strong:** "Schedules end-of-day cash reconciliation reports for retail finance teams."
> **Weak:** "An AI-powered platform for modern teams." — generic, interchangeable with any SaaS product, tells the agent nothing about what trade-offs to make.

The test: could two different products use this sentence? If yes, rewrite.

---

### 2. Primary user (1 sentence)

Who the product is for, by role and context. Specific enough that a UI decision could differ from a hypothetical secondary user.

> **Strong:** "A finance ops lead at a 200-store retail chain, working in the office between 6am and 9am, on a 13" laptop."
> **Weak:** "Anyone who manages money." — too broad to constrain a single layout decision.

Role + context + device is the minimum. Frequency of use and session length are useful additions.

---

### 3. Three to five principles (the operating beliefs)

Opinionated statements about how this product behaves. Not aspirations — beliefs. Beliefs that, when two conflict, one wins.

Each principle must clear five bars:

- **Opinionated** — takes a stance someone could disagree with
- **Actionable** — resolves a real design debate when applied
- **Memorable** — short enough to recall without reading the file
- **Distinctive** — reflects this product, not generic SaaS values
- **Testable** — a proposed design can be evaluated against it

List them in conflict-resolution order. When two principles apply to the same decision, the higher one wins.

**Example pairs — strong vs. weak:**

| Strong | Weak | Why the weak one fails |
|--------|------|----------------------|
| "Wrong is worse than late." | "Accuracy matters." | The strong one resolves the confirmation modal debate. The weak one is a platitude every product claims. |
| "The empty page is the customer." | "Good onboarding is important." | The strong one makes a specific architectural call: blank canvas over wizard. The weak one is a category. |
| "Show the data, not the design." | "Keep it simple." | The strong one tells the agent what to do with color, chrome, and decoration. The weak one means nothing actionable. |

---

### 4. Success metric for the surface (1-2 sentences)

What "the user succeeded" looks like, in observable behavior. Not a business metric — a usage signal that surface design directly influences.

> **Strong:** "User identifies the day's outlier stores within 30 seconds of landing on the dashboard."
> **Weak:** "Increase MRR by 12%." — a business outcome; the surface has no direct lever on it.

The metric constrains every information hierarchy decision on that surface. Write it before designing the layout.

---

### 5. Out of scope (bullet list)

Three to five things this surface deliberately does NOT do. Constrain by exclusion. Prevents scope creep mid-design.

```markdown
- Does not display historical trends beyond 30 days
- Does not support bulk edits from this surface
- Does not expose raw transaction data
```

Short. Declarative. Each item should prevent at least one future feature request from landing in the wrong place.

---

## How the Brief Gets Used

Read `.ui-craft/brief.md` first when working on any UI. It is Discovery Phase Step 1.

When making a design decision, cite the principle it applies. Write it as: *"Density reduced per principle 2: 'Show the data, not the design.'"* If a decision isn't covered by any principle, flag it — the brief is incomplete, not the decision wrong. Surface the gap so the brief can be updated.

If two principles conflict, the higher-ranked one wins. Document the override.

---

## Principles Workshop

Run this when the user is starting fresh and has no principles yet.

**Step 1: Start from product values, not visual style.**
Visual style is a consequence of values. "Clean and minimal" is not a principle — it's an aesthetic preference. Ask: what does this product believe about its users' time, expertise, errors, and goals?

**Step 2: Apply the "would anyone disagree?" test.**
If every reasonable person would agree with the principle, it's a platitude. "Be accessible to all users" fails this test. "Speed over completeness — truncate everything, reveal on demand" passes it because some would argue against it.

**Step 3: Test against past decisions.**
Take three real design calls that were debated. Would the candidate principle have produced the same outcome? If it would have flipped a decision you're happy with, it's the wrong principle.

**Step 4: Rank for conflict.**
When "speed" and "completeness" both apply to the same decision, which wins? Write the ranking explicitly. Unranked principles defer every close call back to a human — which defeats the purpose.

**Step 5: Trim to three to five.**
More than five means none of them are load-bearing. If you have eight, find the two that subsume the others and keep those. A principle that never resolves a debate is decorative.

**Examples by product archetype:**

- Finance reconciliation tool: "Wrong is worse than late." Makes confirmation modals universal. Makes fast-paths expensive to justify. Prevents destructive actions from hiding behind affordance.
- Creative tool: "The empty page is the customer." Makes loading states cheaper than first-run wizards. Makes templates less prominent than blank-canvas affordance. Deprioritizes onboarding over invitations.
- Developer dashboard: "Show the data, not the design." Retreats chrome. Reserves color for status signals. Blocks marketing-page patterns from leaking into the product.

---

## When to Update the Brief

Update when any of these shift: product direction, target user definition, surface scope, or a principle is found to resolve decisions in the wrong direction.

Date each addition. Never delete past principles — if a principle is superseded, mark it deprecated with the date and a reason:

```markdown
~~3. "Speed over completeness."~~ — deprecated 2025-11, product shifted to compliance use case where error cost > latency cost.
4. "Correctness over speed."
```

The brief is append-mostly. The team should be able to trace why a principle changed.

---

## When the Brief Doesn't Apply

**Marketing pages** need a different brief than the product itself. The primary user, success metric, and principles are different. Write a separate brief scoped to the marketing surface.

**First-run experiences** often have a distinct goal (activation, not task completion) and may warrant their own brief — or an addendum to the product brief.

**Multi-brand products** need a brief per brand, not per product. The format is the same; the content differs per brand context.

The brief format is universal. Its content is always scoped to a single surface and audience. If one brief is trying to serve three different contexts, split it.

---

## File Location and Git

Commit `.ui-craft/brief.md` to the repo. The brief is documentation, not configuration. Ignoring it in `.gitignore` means losing the team's collective design memory between sessions and collaborators.

The `.ui-craft/` directory is the project's design decision store. It belongs in version control alongside the code it governs.
