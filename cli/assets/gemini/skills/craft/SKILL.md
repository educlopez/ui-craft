---
name: craft
description: "One-shot build pipeline for a complete surface from an outcome recipe — inputs (or defaults) → composition → theme → build order → acceptance bar. Use when the user asks for a whole surface (\"build me a dashboard\", \"hazme un dashboard\") and expects a shippable result, not component-level help. Invoke when the user asks for craft on their UI, or mentions 'craft' alongside design / UI / frontend work."
---

<!-- HARNESS MIRROR — do not edit here. Canonical source: skills/ or commands/. After editing source, copy into cli/assets/<harness>/ and repo-root harness mirrors. -->

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

**Landing surfaces — draw the fold, do not pick it.** Call the `fold_candidates` MCP tool, passing every composition class already listed under `## Fold classes used` in `.ui-craft/brief.md` as `used`. Commit to one of the three it returns, and state the sacrifice that class demands out loud, because that sacrifice is what will make this page look like itself.

Do not average the candidates together, and do not fall back to a text-left/visual-right split because it fits everything. It fits everything because it commits to nothing: ten blind builds of this skill produced that fold ten times out of ten, across two unrelated products, while only 3 of 18 reference landing pages use it.

If the MCP server is not wired, say so and pick a class from `scripts/fold/classes.mjs` that the brief has not spent yet — the point is the draw, not the tool.

Print a short plan (5–7 lines): Craft Read, composition class **and its sacrifice**, theme, signature bet, what's above the fold, what's deferred — then proceed unless the user objects.

## Step 3 — Build

Follow the recipe's Build order EXACTLY (tokens → shell → hero tier → primary region → remaining tiers → states → keyboard → finish). Load the references each step names plus `craft-intent.md` patterns for this surface type. **Build the signature bet in this pass** — not later.

States and keyboard are build steps, not polish — a surface without empty/loading/error states is not done.

## Step 4 — Acceptance bar

Run the recipe's acceptance checklist against the built surface. Fix every unchecked item before reporting — the bar is the definition of done, not a suggestion.

**Visual self-check (when a screenshot tool is reachable):** if a Playwright/browser MCP or similar is available, capture the built surface at desktop width and look at it before reporting — a render exposes spacing collisions, hierarchy ties, and dead zones that code review can't. Run the similar-prompt self-test (craft-intent §1) against the screenshot: would this exact page pass for a different brand in the category? If yes, strengthen the signature before reporting. No tool available → skip silently, never block.

**Landing surfaces — check the fold you actually built.** Serve the page and call `check_fold` with the URL, the class you drew as `expected_class`, and the costly detail you committed to. It renders in a browser you already have and returns the screenshot alongside its reading. Two things there are worth acting on: **drift**, which means you drew one class and built another — usually the split, since that is the fold the model returns to unprompted — and a **population reading that says the fold stands out nowhere**, which is a prompt to look at the screenshot rather than a fault, since it also flags 7 of 18 reference landing pages.

Everything else it returns is measurement without a verdict, and should be read that way. Only two of its invariants are judged, and neither is geometric.

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
