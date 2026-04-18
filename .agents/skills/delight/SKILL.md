---
name: delight
description: "Add purposeful moments of joy — micro-interactions, not decorative animation. Invoke when the user asks for delight on their UI, or mentions 'delight' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Add delight to the UI at the target the user described. Load the `ui-craft` skill.

**Delight is specificity, not decoration.** The goal is one or two moments a user would screenshot — not confetti, not bounce, not emoji.

**Candidates, ordered by safety (start at the top):**

1. **Copy specificity** — confirmation toasts name the thing ("3 members invited — Alex, Sam, Jordan", not "Invites sent"). Empty states with wit but no cringe ("Nothing here yet — add your first project" > "Oops! Looks like it's empty 😅").
2. **Hover choreography** — multi-property hover (transform + color + shadow) that moves together on one shared duration/easing. One card, not every card.
3. **State transitions** — optimistic UI + tiny success micro-animation (checkmark stroke draw, count-up on a number, subtle scale-and-settle on the updated row).
4. **One signature detail** — custom list markers tied to the domain, asymmetric column offset on a single section, scroll-linked progress that tracks something real (reading progress, form completion).

**Never add:**
- Bounce easing (`cubic-bezier(0.68, -0.55, 0.27, 1.55)`) — flagged in anti-slop.
- Confetti on mundane actions (file saved, field updated).
- Emoji spam or "🎉 SUCCESS!" in ALL CAPS.
- Idle float/bob/shimmer on elements that aren't waiting for anything.

**Knob gating (MOTION_INTENSITY):**
- `≤ 3` → copy-only delight. No animated delight. Candidate 1 only.
- `4-7` → copy + hover + state transitions (candidates 1-3).
- `8+` → all four, including the signature detail.

**References to read**: `references/animation.md` (Decision Ladder + interaction rules), `references/copy.md` (microcopy voice), `references/animation-orchestration.md` (if multi-stage).

**Output**: edit code directly. Print the Review Format table. Flag every candidate you chose not to add and why.
