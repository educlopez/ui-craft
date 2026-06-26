---
name: audit
description: "Technical UI audit — a11y, performance, responsive. Produces a prioritized findings table. Invoke when the user asks for audit on their UI, or mentions 'audit' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Run a technical audit of the UI at the target the user described. Load the `ui-craft` skill and apply the audit lens.

## Step 0: Visual capture (mandatory)

Code-only review is insufficient. Every audit/critique starts with the surface as the user sees it. Try the following in order; use the first one available:

1. **Playwright MCP** — if `playwright` MCP server is available, use it. Capture full-page screenshots at three viewports: desktop (1280×800), tablet (768×1024), mobile (375×812). Capture dark mode if the app supports it.
2. **Browser DevTools / Chrome MCP** — second choice; same viewport set.
3. **Other browser automation** (`agent-browser`, `cursor-ide-browser`) — third choice.
4. **Ask the user** — last resort. If no automation is available, request screenshots from the user before proceeding. Be specific:
   - "Visual review needs screenshots. Please provide:
     - Full-page at 1280px (desktop)
     - Full-page at 768px (tablet)
     - Full-page at 375px (mobile)
     - Dark mode of each, if supported."

Do not begin the review until visuals are captured or provided. State this explicitly to the user when no automation succeeds — don't silently fall back to code-only review.

If the user declines to provide screenshots, run a code-only pass and clearly mark the report `[CODE-ONLY REVIEW — visual issues not assessed]` at the top so the limitation is explicit.

**Note:** audit is knob-agnostic — accessibility and performance are not tunable.

**Scope (non-negotiable checks):**

1. **Accessibility** — read `references/accessibility.md`:
   - Visible `:focus-visible` on every interactive element
   - Keyboard reachable, no focus traps
   - Touch targets ≥ 44px (mobile)
   - Color not the only signal for state
   - Form labels, error association, required indication
   - `prefers-reduced-motion` honored for all animations
2. **Performance** — read `references/motion.md` Rendering Performance section:
   - Only `transform` / `opacity` animated (no `width`/`top`/`height`)
   - No `transition: all`
   - `will-change` scoped to active interaction, removed after
   - Images have `width`/`height` or `aspect-ratio` (CLS)
   - No layout thrash in scroll/resize handlers
3. **Responsive** — read `references/responsive.md`:
   - Mobile-first breakpoints, no fixed-width components
   - `env(safe-area-inset-*)` respected on fixed elements
   - Touch zones don't overlap
   - No horizontal scroll at 320px

**Output format** — the Review Format table from SKILL.md:

| Before | After | Why |
| --- | --- | --- |

Group findings by priority: **Critical** (blocks usability/a11y) → **High-impact** (immediately noticeable) → **Quick wins** (polish).

Do NOT rewrite code unless asked. Report findings first; wait for approval before editing.
