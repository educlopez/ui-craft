---
name: craft
description: "One-shot build pipeline for a complete surface from an outcome recipe — inputs (or defaults) → composition → theme → build order → acceptance bar. Use when the user asks for a whole surface (\"build me a dashboard\", \"hazme un dashboard\") and expects a shippable result, not component-level help. Invoke when the user asks for craft on their UI, or mentions 'craft' alongside design / UI / frontend work."
---

**Claude Directory skills edition.** This package provides instructions only:
no bundled MCP server, command hook, executable helper, or review agent. Do not
install or launch UI Craft tools on its behalf. Use the supplied references for
manual reviews. Never invent detector results, a deterministic UICraftScore,
seeded draws, or browser measurements. State what was actually inspected and
mark unavailable checks as not verified. Use only capabilities already available
and authorized in the current session; otherwise request source or screenshots.
Write project files only with available, authorized tools; otherwise return the
proposed content as text and do not claim it was saved.
References named below live in the ui-craft skill's references/ directory.


**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Load the `ui-craft` skill. This command BUILDS — it ends with working code that passes the recipe's acceptance bar.

Recipes available: `dashboard` → `references/recipe-dashboard.md` · `landing` → `references/recipe-landing.md` · `auth` (sign-in/sign-up) → `references/recipe-auth.md`. If `$ARGUMENTS` names a surface with no recipe yet (settings, docs, e-commerce), say so and fall back to standard Build mode with the closest references — do not improvise a fake recipe.

---

## Step 0 — Load spec (if present)

Before anything else: if `.ui-craft/spec.md` exists and contains a `## Surface: <name>` section whose name matches `$ARGUMENTS`, load that section now. Its chosen composition, component inventory, state lattice, and **acceptance bar take precedence over the recipe defaults** for all downstream steps. Note which acceptance bar items came from the spec vs. recipe defaults.

## Step 1 — Inputs

Run Stack Detection + Discovery Step 1 (existing tokens, `.ui-craft/brief.md`).

Load `references/craft-intent.md`.

Ask the recipe's Step 0 questions in ONE compact prompt, pre-filling anything `$ARGUMENTS` or the brief already answers. If the user declines, says "you decide", or has answered before in this session: apply the recipe defaults silently and say which were applied. Never ask twice; never block.

Set **DESIGN_VARIANCE** from craft-intent defaults for this surface type unless the user or brief specifies otherwise.

## Step 2 — Craft Read + lock the plan

**Output the Craft Read** (one line, craft-intent §1) before any code. Include: surface kind, audience, product vs marketing language, theme/accent, variance, **signature bet**.

From the answers: composition + theme preset (or existing tokens) + density + variance + signature bet. If no brand direction, rotate one axis (craft-intent §6) and name it.

**Landing composition, manual selection.** Read
[fold-classes.md](../ui-craft/references/fold-classes.md). Offer three classes not yet recorded in the
brief's spent list, prioritizing non-split classes. Select one against the brief
and state its sacrifice. This is a judged selection, not a seeded or random draw.

Do not average the candidates together, and do not fall back to a text-left/visual-right split because it fits everything. It fits everything because it commits to nothing: ten blind builds of this skill produced that fold ten times out of ten, across two unrelated products, while only 3 of 18 reference landing pages use it.



Print a short plan (5–7 lines): Craft Read, composition class **and its sacrifice**, theme, signature bet, what's above the fold, what's deferred — then proceed unless the user objects.

## Step 3 — Build

Follow the recipe's Build order EXACTLY (tokens → shell → hero tier → primary region → remaining tiers → states → keyboard → finish). Load the references each step names plus `craft-intent.md` patterns for this surface type. **Build the signature bet in this pass** — not later.

States and keyboard are build steps, not polish — a surface without empty/loading/error states is not done.

## Step 4 — Acceptance bar

Run the recipe's acceptance checklist against the built surface. Fix every unchecked item before reporting — the bar is the definition of done, not a suggestion.

**Visual self-check (when a screenshot tool is reachable):** if a Playwright/browser MCP or similar is available, capture the built surface at desktop width and look at it before reporting — a render exposes spacing collisions, hierarchy ties, and dead zones that code review can't. Run the similar-prompt self-test (craft-intent §1) against the screenshot: would this exact page pass for a different brand in the category? If yes, strengthen the signature before reporting. No tool available → skip silently, never block.

**Landing composition, manual verification.** Compare the built
surface or supplied screenshot with the declared class and its sacrifice.
If no rendered evidence is available, report visual geometry as not verified.
Do not report drift metrics or population scores; this edition cannot measure them.



**Record what was spent:** append the class you built to `## Fold classes used` in `.ui-craft/brief.md`, creating the section if it is missing. That list is what makes the next `/craft` in this project draw something else. Without it the draw has no memory and the project converges again.

**Report to the user:**

1. The Craft Read (repeat)
2. The composition class drawn, and the sacrifice it demanded
3. Which signature bet was built
4. Checklist results
5. Any item the user explicitly waived

Lead with intent, not a findings dump. Use the Review Format table only for fixes made in this pass.

At CRAFT_LEVEL ≥ 8, finish with the full `/finalize` gate instead of the recipe's minimum passes.

**Next step:** `/finalize` — run the pre-ship gate (rung 3). If this project has no brief yet, `/brief` first (rung 2).
