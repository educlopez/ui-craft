---
description: One-shot build pipeline for a complete surface from an outcome recipe — inputs (or defaults) → composition → theme → build order → acceptance bar. Use when the user asks for a whole surface ("build me a dashboard", "hazme un dashboard") and expects a shippable result, not component-level help.
argument-hint: "[surface: dashboard] [optional: persona, theme preset, density]"
---

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

Print a short plan (5–7 lines): Craft Read, composition name, theme, signature bet, what's above the fold, what's deferred — then proceed unless the user objects.

## Step 3 — Build

Follow the recipe's Build order EXACTLY (tokens → shell → hero tier → primary region → remaining tiers → states → keyboard → finish). Load the references each step names plus `craft-intent.md` patterns for this surface type. **Build the signature bet in this pass** — not later.

States and keyboard are build steps, not polish — a surface without empty/loading/error states is not done.

## Step 4 — Acceptance bar

Run the recipe's acceptance checklist against the built surface. Fix every unchecked item before reporting — the bar is the definition of done, not a suggestion.

**Report to the user:**

1. The Craft Read (repeat)
2. Which signature bet was built
3. Checklist results
4. Any item the user explicitly waived

Lead with intent, not a findings dump. Use the Review Format table only for fixes made in this pass.

At CRAFT_LEVEL ≥ 8, finish with the full `/finalize` gate instead of the recipe's minimum passes.
