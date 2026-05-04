---
name: tokens
description: "Audit or establish the project's 3-layer token spine. Invoke when the user asks for tokens on their UI, or mentions 'tokens' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Read `references/tokens.md` before proceeding. The 3-layer contract (primitive → semantic → component) and the intentional-dark test are defined there.

---

## Step 1: Detect existing tokens

Scan for token definitions in the project:
- CSS variables in `:root`, `[data-theme]`, `[data-mode]`, or theme wrapper selectors
- Tailwind config (`tailwind.config.js/ts`) under `theme.extend` or `theme`
- CSS-in-JS theme objects (`theme.ts`, `*.styles.ts`, `styled.d.ts`, `ThemeProvider`)
- `design-tokens.json` or `tokens.json` (Style Dictionary / Theo)
- `globals.css`, `variables.css`, `tokens.css`

Build an inventory: which of the 7 categories exist (color / spacing / type / radii / shadows / motion / z-index), which layers are present (primitive / semantic / component), and whether both light and dark are defined.

---

## Step 2: Route based on the target the user described and inventory

- **"audit"** → run audit only (Step 3). No proposals.
- **"establish"** → skip audit, go to Step 4.
- **"color" / "spacing" / "type" / "radii" / "shadows" / "motion" / "z-index"** → focus the audit and any proposal on that one category.
- **empty** → if tokens exist: audit. If nothing found: establish.

---

## Step 3: Audit (tokens exist)

Evaluate against the contract in `references/tokens.md`. Output a severity-ranked gap list — don't propose code yet.

Check:

1. **3-layer coverage** — are primitive, semantic, and component layers all present? Missing semantics is the most common gap: primitives exist but nothing switches for dark mode and no surface stack is defined.
2. **7-category coverage** — any of (color / spacing / type / radii / shadows / motion / z-index) missing? Flag each absent category.
3. **Intentional dark mode** — run the intentional-dark test: does dark mode do more than invert `--text-primary`? Is `--surface-canvas` a tinted near-black (not `#000`)? Is accent chroma reduced 10-15%? Are shadows replaced with border rings?
4. **Naming discipline** — are primitives named for values (`--gray-500`) not roles (`--button-bg`)? Are semantics named for roles (`--text-primary`) not values (`--gray-900-text`)?
5. **No arbitrary values** — inline colors, spacing, or z-index values that bypass the token system.

Output format:

| Severity | Category | Finding |
|---|---|---|
| Critical | Dark mode | `--surface-canvas` is `#000` — runs the intentional-dark test |
| High | Semantics | No surface stack — components use raw primitives |
| Medium | Shadows | Single-layer shadows — ambient layer missing |
| Low | Z-index | Arbitrary values (`z-index: 999`) in 3 components |

Show what's missing. Do not propose code during audit unless the user asks.

---

## Step 4: Establish (no tokens found)

Propose a minimal spine inline. Cover all 7 categories. Always include both light and dark blocks — both intentional.

**Minimal spine order:**
1. Primitives — neutral ramp (gray-50 to gray-950), one accent ramp, semantic color bases, spacing scale, type scale, radii, shadows, motion, z-index.
2. Semantics — surface stack (5 levels), text roles, border roles, accent roles, status roles (success / warning / error / info).
3. Component tokens — defer unless a specific component is already being built.

Use OKLCH for color unless the project uses sRGB across the board — in that case flag the gap, propose OKLCH, but don't auto-convert.

**Before writing to a file, ask which file to write to.** Detect from project structure and suggest one:
- Tailwind project → `globals.css` (CSS variables inside `:root`)
- CSS-in-JS → `theme.ts` (exported theme object)
- Vanilla CSS → `tokens.css` (standalone variables file)
- Cross-platform / multi-consumer → `design-tokens.json` (Style Dictionary format)

Confirm with the user before writing.

---

## Step 5: Never overwrite

If the project has an existing token file, propose additions as patches — show what would change in a diff block:

```diff
  :root {
+   /* ── Semantic surface stack (new) ── */
+   --surface-canvas:  var(--gray-50);
+   --surface-raised:  var(--gray-100);
+   --surface-overlay: #fff;
+   --surface-sunken:  var(--gray-200);
+   --surface-inverse: var(--gray-900);
  }
```

Let the user apply. Don't write directly unless they approve.

---

## Constraints

- Don't impose Tailwind on a vanilla CSS project. Match the project's existing syntax.
- Don't impose OKLCH if the project uses sRGB consistently — flag it, suggest migration, don't force it.
- Respect existing naming conventions — if the project uses `--color-primary` over `--accent-500`, extend that pattern rather than introducing a parallel naming scheme.
