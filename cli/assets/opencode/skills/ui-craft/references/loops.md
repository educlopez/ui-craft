# Loop Engine

Run→evaluate→fix one→re-evaluate→stop. A loop is not a review pass — it iterates until a binary gate passes or the budget runs out. A loop NEVER hard-depends on a renderer, NEVER auto-installs anything, and ALWAYS degrades with an explicit notice when visual evaluation is unavailable. The budget is non-negotiable: when it is exhausted the engine stops and reports, even if the gate has not passed.

---

## Engine Contract

Every preset declares all five fields. None is optional.

| Field | Allowed values | Description |
|-------|---------------|-------------|
| `target` | `new-build` \| `existing-surface` \| `user-screenshot` | The artifact being evaluated |
| `lens` | one or more reference file paths / sections | Reference content that drives evaluation |
| `gate` | `checklist-all-green` \| `zero-critical` \| `zero-off-system` | Binary pass condition |
| `renderer` | `required` \| `none` | Renderer dependency level — `required` degrades to code-only if unavailable; `none` means static analysis only (always available) |
| `budget` | integer 1–5 (default 3, hard cap 5) | Maximum iterations allowed |

---

## The Loop

The agent executes this numbered procedure for every iteration:

1. **Read** the target AND `.ui-craft/brief.md` §6 (learned constraints = override registry). Brief §6 overrides preset gates; the a11y/correctness floor is never overridden.
2. **Detect renderer** (see Renderer Detection Ladder below) and emit the pre-flight cost notice — preset name, budget, "will run up to N iterations; each iteration runs one full evaluate → fix → re-evaluate cycle." MUST emit before any iteration begins.
3. **Evaluate** the target through the preset's lens → produce a severity-ranked findings list.
4. **Select ONE highest-impact fix.** Ranking: Critical before Major; tiebreaker within the same tier = earlier-numbered finish-bar pass / earlier-listed state in the state-design lattice / earlier-cited finding in the brief; for token-consistency: within the same tier, apply layer order — primitive token violations before semantic, semantic before component. MUST NOT apply more than one fix per iteration.
5. **Apply** the selected fix.
6. **Re-evaluate** — run the gate check on the updated state.
7. **Stop** when the gate passes OR the iteration count reaches the budget, whichever comes first. On budget exhaustion: STOP, print final gate state, and list all open findings as "Unresolved within budget:". MUST NOT silently extend the budget.

**Anti-thrash rule:** a fix that introduces a new violation is caught in the NEXT iteration — no inline re-validation. It counts against the budget.

---

## Renderer Detection Ladder

Probe in this order; stop at the first match:

1. `playwright` / `@playwright/test` / `puppeteer` in `package.json` devDependencies → use it.
2. Existing e2e / visual harness file (`playwright.config.*`, `cypress.config.*`, `cypress/`, `.storybook/test-runner*`) → use it.
3. Agent-browser tool present in the current agent session → **announce before launch** ("I will invoke agent-browser for visual evaluation — proceeding unless you say stop") then use it.
4. `npx playwright screenshot` — **OPT-IN ONLY.** Present as a choice; NEVER auto-run. If the user declines → rung 5.
5. **NONE** → degrade to code-only reasoning. Emit verbatim:

> "renderer: none — evaluating code only; visual rendering unverified. Findings cover structure, tokens, and code-level anti-slop signals. Confidence: partial."

---

## Honesty / Confidence Contract

Every loop report MUST state:

- **Renderer tier** used (rung number from the detection ladder above).
- **Whether visual evaluation occurred.**
- **Confidence level** — `full` (renderer present), `partial` (code-only or renderer degraded).
- **Iteration count vs budget** — e.g., "2 of 3 iterations used."
- **Unresolved findings** — any finding still open when the loop stops.

**`target = user-screenshot` → EVALUATE-ONLY mode:**
- Produce a severity-ranked findings report.
- MUST NOT apply any fixes.
- MUST NOT run fix iterations.
- MUST NOT claim the gate passed or failed.
- MUST state: "Target is a screenshot — findings reported; no fix iterations run."

**`visual-anti-slop` with renderer=none** is the SAME preset degraded — not a separate preset. Report the gate as "partial — visual rendering unverified."

---

## Anti-thrash + Budget Rules

- **One fix per iteration.** The ranking above is mandatory — it prevents oscillation.
- The iteration counter is tracked in the report ("iteration 2 of 3").
- Budget exhausted → STOP, print final gate state + "Unresolved within budget:" list. The user must explicitly raise the budget; the engine MUST NOT auto-extend.
- Brief §6 constraints override preset gates. The a11y/correctness floor is never overridden by brief constraints.

---

## Preset Catalog

| Preset | target | lens | gate | renderer | maps to |
|--------|--------|------|------|----------|---------|
| `visual-anti-slop` | new-build \| existing-surface | SKILL.md Anti-Slop Test + finish-bar.md Pass 1 + Pass 9 | zero-critical (Major: absent or explicitly user-confirmed — no self-accept, silence ≠ accepted) | required — degrades to code-only | `/finalize` |
| `state-coverage` | new-build \| existing-surface | state-design.md lattice, knob-gated to CRAFT_LEVEL | checklist-all-green (all required states present) | none | `/unhappy` |
| `token-consistency` | new-build \| existing-surface | tokens.md 3-layer contract + SKILL.md Anti-Slop Minor items | zero-off-system | none (static scan) | `/tokens audit` |

---

## visual-anti-slop — eliminate AI-template signals until the gate passes

**Lens:** SKILL.md Anti-Slop Test (Critical + Major items) + `finish-bar.md` Pass 1 (hierarchy) + Pass 9 (pixel honesty).
**Gate:** all Critical Anti-Slop items absent AND all Major items absent or explicitly user-confirmed. A Major is "accepted" ONLY when the user explicitly confirms it (during pre-flight or mid-loop); absent explicit confirmation it stays OPEN and counts against the gate. No self-accept, no "not found on re-eval = accepted".
**Renderer:** required — degrades to code-only (partial confidence) if unavailable. The gate is reported as "partial — visual rendering unverified" when renderer=none. MUST NOT claim full pass on visual criteria without a renderer.
**Highest-impact ranking:** Critical Anti-Slop findings first; within Major, earlier-numbered finish-bar pass wins.
**Example run:**

- Pre-flight: "visual-anti-slop, budget 3, will run up to 3 iterations; each iteration runs one full evaluate → fix → re-evaluate cycle."
- Iter 1: Critical — identical card grid detected → refactor to asymmetric layout. Re-evaluate.
- Iter 2: Major — uniform border-radius on all elements → vary by element role. Re-evaluate.
- Gate passes (0 Critical, 0 unaccepted Major). Stop at 2/3 iterations.

---

## state-coverage — iterate until all required states are present

**Lens:** `state-design.md` state lattice, knob-gated to CRAFT_LEVEL (per state-design.md lattice — see the CRAFT_LEVEL table there for the full threshold definition).
**Gate:** all required states (per the CRAFT_LEVEL knob, as defined in state-design.md) present as explicit designs or stubs.
**Renderer:** none — code analysis only; always available.
**Highest-impact ranking:** missing required states ordered by position in the state-design lattice (idle → loading → empty → error → partial → success → conflict → offline).
**Example run:**

- Pre-flight: "state-coverage, budget 3, will run up to 3 iterations; each iteration runs one full evaluate → fix → re-evaluate cycle."
- Iter 1: CRAFT_LEVEL 6 → required: idle/loading/empty/error/success. Missing: empty, error. Highest-impact = empty (lattice position). Stub empty state with copy + CTA. Re-evaluate.
- Iter 2: Missing: error. Stub error state with cause + retry. Re-evaluate.
- Gate passes (all required states present). Stop at 2/3 iterations.

---

## token-consistency — iterate until zero off-system values remain

**Lens:** `tokens.md` 3-layer contract (per tokens.md 3-layer contract — see that file for canonical layer definitions) + SKILL.md Anti-Slop Minor items for hardcoded values.
**Gate:** zero off-system values — any color, radius, or spacing value not drawn from the project's token system.
**Renderer:** none — static code scan; always available.
**Highest-impact ranking:** Critical token violations (raw hex colors) before Major (arbitrary radii, magic spacing); tiebreaker = order of appearance in the file.
**Example run:**

- Pre-flight: "token-consistency, budget 3, will run up to 3 iterations; each iteration runs one full evaluate → fix → re-evaluate cycle."
- Iter 1: Off-system values found: `#3B82F6` (hex color), `border-radius: 6px` (magic value). Highest-impact = hex color → replace with `var(--accent)`. Re-evaluate.
- Iter 2: Remaining: `border-radius: 6px` → replace with `var(--radius-sm)`. Re-evaluate.
- Gate passes (zero off-system values). Stop at 2/3 iterations.

---

## Choosing / Adding a Preset

| Use case | Preset |
|----------|--------|
| Surface looks AI-generated; fix visual slop | `visual-anti-slop` |
| Edge-case states are missing (loading, error, empty) | `state-coverage` |
| Hardcoded colors, radii, or spacing bypass the token system | `token-consistency` |

**Preset block template** (drop-in for future presets — mirror this file's style):

```
## <preset-name> — <one-line intent>
**Lens:** <reference file(s) + exact section(s)>
**Gate:** <binary pass condition>
**Renderer:** <none | required | gated — degrades to code-only at lower confidence>
**Highest-impact ranking:** <tier order + tiebreaker>
**Example run:** <3-5 line trace: iter 1 finding→fix, iter 2 …, stop reason>
```

Add the new preset row to the Preset Catalog table above. All five template fields are required.
