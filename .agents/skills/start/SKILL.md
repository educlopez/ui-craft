---
name: start
description: "Front door. Reads the current project (framework, tokens, brief, spec, harness) and reports what ui-craft can do right now, then routes you to the right next step. Run this first if you're new or unsure where to begin. No code changes. Invoke when the user asks for start on their UI, or mentions 'start' alongside design / UI / frontend work."
---

<!-- HARNESS MIRROR — do not edit here. Canonical source: skills/ or commands/. After editing source, copy into cli/assets/<harness>/ and repo-root harness mirrors. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Orient the user. Load the `ui-craft` skill, read the current project, and report what ui-craft can do **right now** for it. This is the front door — most people run it first.

---

## ORCHESTRATE-ONLY RULE

This command **detects state and routes**. It MUST NOT build, edit, audit, or re-implement any phase logic. It contributes only:

1. Project detection (read-only).
2. A "what's available now" map across the three usage layers.
3. One recommended next step + the command to run for it.

When the user wants to act, hand off to the real command (`/brief`, `/tokens`, `/sddesign`, `/craft`, `/finalize`, the review agents, etc.). Do not inline their steps.

---

## Step 1 — Detect (read-only)

Scan the project. Do not write anything. Gather:

| Signal | How to detect | Used for |
|--------|---------------|----------|
| **Framework / styling** | package.json deps, config files, file extensions — Tailwind, CSS Modules, styled-components/Emotion, vanilla CSS, Vue/Svelte/Astro SFC | Confirm ui-craft adapts to this stack |
| **Token spine** | CSS vars (`--color-*`, `--accent-*`, `--font-*`), Tailwind `theme.extend`, a token file | Gate: is `/tokens` needed? |
| **Brief** | `.ui-craft/brief.md` exists? | Gate: is `/brief` needed? |
| **Spec** | `.ui-craft/spec.md` exists? which surfaces? | Is there work in flight? |
| **Harness** | Claude Code (plugin/skill) vs `.codex`/`.cursor`/`.gemini`/`.opencode`/`.agents` mirror | Which layers are reachable (agents/MCP are Claude Code / MCP-client only) |
| **Existing UI** | are there components/pages already, or is this greenfield? | Build-new vs review/polish framing |

Keep detection fast and quiet — a few reads, no deep traversal. Report findings as a short table.

---

## Step 2 — Report the three layers

Print what's available now, mapped to how people actually use ui-craft. Mark each layer ● active / ○ available / – not reachable in this harness.

```
ui-craft is a design engineering SYSTEM. You're set up for:

● Layer 1 — Just ask
    Describe any UI and the agent designs with taste (anti-slop, system tokens,
    real hierarchy). No command needed. This is the default and the point.

○ Layer 2 — Drive it
    Slash commands for focused passes. Given THIS project:
      <tailored list — see Step 3>

○ Layer 3 — Verify it
    design-reviewer + a11y-auditor agents · ui-craft-mcp gates · UICraftScore · ui-craft-detect CLI.
    <mark – if the harness can't reach agents/MCP, and say so>
```

Tailor the bullets to the detected state — don't print the generic catalog.

---

## Step 3 — Recommend ONE next step

Pick the single highest-value next action from detected state. Use this decision order:

1. **No brief, non-trivial project** → recommend `/brief` ("anchor every later decision to your product's principles — 5 min, writes `.ui-craft/brief.md`").
2. **Brief exists, no token spine** → recommend `/tokens` ("establish the 3-layer token spine so builds match a system, not inline guesses").
3. **Brief + tokens exist, building something net-new** → recommend `/sddesign <surface>` (full pipeline) or `/craft <surface>` (one-shot) — ask which.
4. **Existing UI to improve** → route by intent: review → `ui-craft:design-reviewer` + `ui-craft:a11y-auditor` (Claude Code) or `/critique` + `/audit`; polish → `/polish`; simplify → `/distill`; flat/generic → `/bolder`; loud/busy → `/quieter`; dated site to modernize → `/redesign`.
5. **About to ship / merge** → recommend `/finalize` (10-pass gate) and, for CI, `npx ui-craft-detect` or the `score_ui` MCP tool.

Print it as one clear line:

> **Recommended next:** `…` — <one-sentence why>.

Then offer the full menu only if asked: "Want the full command list, or shall I run that now?"

---

## Step 4 — Hand off

If the user confirms, run the recommended command. Otherwise stop — `/start` never acts on its own. Its job is done once the user knows where they are and where to go.

---

## Notes

- **Read-only.** `/start` writes nothing and changes no code. The artifacts (`brief.md`, `spec.md`, tokens) are written by their own commands.
- **Harness honesty.** If the project is in a non-Claude-Code harness (`.codex`, `.cursor`, etc.), Layer 3 agents and the MCP server may not be reachable from that agent — say so plainly and point to the CLI (`ui-craft-detect`) as the portable verify path.
- **Craft-intent routing.** Full-surface builds (`/craft`, `/sddesign`) declare a Craft Read before code. If the user describes a built UI as "generic", "template-y", or "too safe", route to `/bolder`; if "too loud" or "too busy", route to `/quieter`.
- **Don't re-run Discovery.** If a brief or spec already exists, don't interrogate the user for preferences — read the artifacts and report.
