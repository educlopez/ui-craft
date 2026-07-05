---
name: redesign
description: "Redesign an existing site or app without losing what already works — audits the current surface first, classifies what to preserve (brand, IA, SEO, content), picks a refresh/reskin/rebuild scope, then modernizes deliberately. Use when the user says "redesign", "modernize this site", "refresh the UI", "make this look current", or points at an existing page/URL they want improved rather than rebuilt from scratch. Invoke when the user asks for redesign on their UI, or mentions 'redesign' alongside design / UI / frontend work."
---

<!-- HARNESS MIRROR — do not edit here. Canonical source: commands/redesign.md. After editing source, copy into cli/assets/<harness>/ and repo-root harness mirrors. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Redesign `the target the user described`. Load the `ui-craft` skill and read `references/craft-intent.md`. A redesign is not a greenfield build wearing the old content — most of its value is in what you deliberately keep.

**Step 1 — Audit what exists (before any opinion):**

- Run the detector on the current source (`npx ui-craft-detect <path>`) or live page (`npx ui-craft-detect <url>`) and note findings.
- Inventory: pages/routes, section order, heading hierarchy (h1–h3), nav structure, conversion paths (CTAs and where they lead), forms, imagery assets, fonts, color values actually in use.
- Read `.ui-craft/brief.md` if present — prior constraints still bind.

**Step 2 — Classify what to preserve. Wrong-to-change unless the user explicitly asks:**

- **Brand equity** — logo, name, an established palette the business already uses in the wild. Committed brand color stays; you may re-tune tints/shades into a proper token scale.
- **IA + SEO** — URLs/routes, page set, heading semantics, title/meta, alt text, structured data. A redesign that tanks organic traffic is a failure regardless of how it looks.
- **Content + voice** — existing copy is data about the business. Restructure freely; rewrite voice only with permission.
- **Conversion paths** — every CTA and form that exists today exists for a reason. Relocate, restyle, but never silently drop one.

**Step 3 — Pick the scope and say it out loud:**

| Scope | What changes | When |
|---|---|---|
| **Refresh** | Tokens only: type scale, spacing rhythm, radii, shadows, color tuning | Site is structurally fine, looks dated |
| **Reskin** | Visual layer + component styling; layout skeleton and section order stay | Bones are good, skin is generic or old |
| **Rebuild** | Layout and composition too; content, IA, and brand carry over | Layout itself is the problem |

Default to the smallest scope that fixes the stated complaint. For **rebuild**, print a short before/after section map and get a nod before writing code.

**Step 4 — Declare the Craft Read** (surface kind, audience, theme, `DESIGN_VARIANCE`, signature bet) per `references/craft-intent.md`. Redesigns default to variance 4–5: the brand is already committed, so spend boldness on typography and composition, not on a new identity.

**Step 5 — Modernize with levers, in this order:** typography (scale + pairing per `references/typography.md`) → spacing rhythm → color tokens (`references/color.md`) → imagery treatment → motion (entrance/hover only where focal). Fix every detector finding from Step 1 along the way.

**Never:** invent a new brand palette over a committed one, drop routes or pages, flatten heading semantics for looks, rewrite copy voice unasked, or ship the redesign with more detector findings than the original had.

**Output:** edit code directly (refresh/reskin) or section map first (rebuild). Print the Review Format table, the detector before/after counts, and end with the Craft Read line.
