# Agent Pack

Two read-only agents form the ui-craft **parallel verify team**. They complement the existing slash commands — they do not replace them.

---

## The agents

### `ui-craft:design-reviewer`

Adversarial design critique. Loads [review.md](review.md), the Anti-Slop and Craft Test sections from [../SKILL.md](../SKILL.md), and [heuristics.md](heuristics.md). Returns a severity-tagged findings table (Critical / Warning / Suggestion with `file:line`). Read-only — no edits, no code changes.

**Triggers on:** "review UI/design quality", "audit a diff or PR for design issues", "adversarial design critique".

### `ui-craft:a11y-auditor`

Accessibility audit. Loads [accessibility.md](accessibility.md). Covers keyboard navigation, focus-visible, APCA contrast, ARIA roles and labels, touch targets, and reduced-motion. Returns a severity-tagged findings table. Read-only — no edits, no code changes.

**Triggers on:** "accessibility audit of UI", "keyboard/focus/contrast/ARIA/touch targets check".

---

## Agents vs. commands — when to use which

Both agents and commands surface quality findings, but they operate differently:

| | Commands (`/critique`, `/audit`, …) | Agents (`design-reviewer`, `a11y-auditor`) |
|---|---|---|
| **Context** | Inline — run inside the caller's active context window | Fresh — each agent starts with a clean context |
| **Parallelism** | Sequential (one lens at a time) | Parallel — both can run simultaneously on the same target |
| **Tool scope** | Full skill tool scope | Restricted to Read, Grep, Glob (read-only) |
| **Best for** | Interactive iteration, mixed build+review sessions | Dedicated review passes, PR audits, CI-style verification |

Use commands when you are already in a build session and want a quick inline lens.

Use agents when you want an independent, fresh-context review — especially on a completed diff or PR where you do not want the reviewer to carry any build-session bias.

---

## Parallel verify team — how to invoke

Delegate both agents simultaneously on the same diff or file. They run in independent contexts and each returns its own report. The caller combines the two reports; neither agent depends on the other.

**Pattern — parallel design + a11y verify on a PR diff:**

> Delegate `ui-craft:design-reviewer` and `ui-craft:a11y-auditor` together on [target diff or file path]. Run both simultaneously. Each returns an independent severity-tagged findings table.

The caller (orchestrator or user) receives two reports and decides which findings to act on. This is the recommended final-pass workflow before merging a UI change.

---

## Delegate-only rule

Both agents are **delegate-only entry points**. Their system prompts load the relevant references and apply the role — they do not restate the rules. All judgment lives in the references ([review.md](review.md), [accessibility.md](accessibility.md), [heuristics.md](heuristics.md), [../SKILL.md](../SKILL.md)). This mirrors how `/sddesign` delegates phase commands rather than re-implementing their logic inline.

---

## Related references

- [review.md](review.md) — systematic critique methodology, anti-slop detection, Polish Pass
- [accessibility.md](accessibility.md) — WAI-ARIA, keyboard, focus, APCA contrast, touch targets, reduced-motion
- [heuristics.md](heuristics.md) — Nielsen's 10 + 6 design laws, scoring rubric, impact framing
- [../SKILL.md](../SKILL.md) — Anti-Slop Test, Craft Test, routing table
