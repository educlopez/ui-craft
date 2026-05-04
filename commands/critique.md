---
description: UX critique — hierarchy, clarity, anti-slop. No code changes unless asked.
argument-hint: "[file or component path]"
---

Critique the UI at `$ARGUMENTS` through a design lens. Load the `ui-craft` skill.

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

**Knob awareness (CRAFT_LEVEL sets the bar for what counts as "needs work"):**
- `CRAFT_LEVEL 3` → flag only anti-slop **Critical** items. Skip Minor polish.
- `CRAFT_LEVEL 5-7` → flag Critical + Major. Mention Minor polish as optional.
- `CRAFT_LEVEL 9+` → flag everything, including Minor polish and missing signature detail.

**Run these lenses in order:**

1. **Anti-Slop Test** (from SKILL.md): flag every item present. Critical first (ALL CAPS, purple gradients, identical card grids, bounce easing, emoji icons, glassmorphism + neon). Then major (colored pills on trends, thick colored borders, uniform radii, gradient text, walls of text). Then minor (straight quotes, missing `tabular-nums`, generic CTAs).
2. **Craft Test** (from SKILL.md): where does the design fall short of "one accent, 3-5 placements; plain secondary text for comparisons; functional color only; every section earns its space"?
3. **Hierarchy**: can the user tell what's primary, secondary, tertiary at a glance? Or does everything shout equally?
4. **Clarity**: is the value prop legible in 5 seconds? Are CTAs specific (not "Learn more")?
5. **Signature detail**: is there one memorable element that makes this feel designed, not assembled? If not, suggest one (motif, layout break, custom marker, distinctive hover).
6. **Inspiration gap** — read `references/inspiration.md`: which observed pattern from the archetypes / signature details applies here, and how does the current state diverge from it?

**Output format** — the Review Format table:

| Before | After | Why |
| --- | --- | --- |

Prioritize by impact, not by file order. End with a one-paragraph summary of the **top 3 changes** that would raise this from "AI-generated" to "designed".

Do NOT edit code. This is a critique.
