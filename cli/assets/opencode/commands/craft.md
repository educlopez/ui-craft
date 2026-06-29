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

Ask the recipe's Step 0 questions in ONE compact prompt, pre-filling anything `$ARGUMENTS` or the brief already answers. If the user declines, says "you decide", or has answered before in this session: apply the recipe defaults silently and say which were applied. Never ask twice; never block.

## Step 2 — Lock the plan

From the answers: composition + theme preset (or existing tokens) + density. Print a 5-line plan — composition name, hero metric, theme, what's above the fold, what's deferred below — and proceed without waiting unless the user objects.

## Step 3 — Build

Follow the recipe's Build order EXACTLY (tokens → shell → hero tier → primary region → remaining tiers → states → keyboard → finish). Load the references each step names. States and keyboard are build steps, not polish — a surface without empty/loading/error states is not done.

## Step 4 — Acceptance bar

Run the recipe's acceptance checklist against the built surface. Fix every unchecked item before reporting — the bar is the definition of done, not a suggestion. Then report: checklist results, the one signature detail included, and any item the user explicitly waived.

At CRAFT_LEVEL ≥ 8, finish with the full `/finalize` gate instead of the recipe's minimum passes.
