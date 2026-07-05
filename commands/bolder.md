---
description: Amplify personality — raises layout variance and motion, strengthens typography and one signature detail, without slop. Use when the UI works but feels safe, flat, or "template-y", or when the user says "bolder", "more personality", "more creative", or "make it pop" (still professional).
argument-hint: "[file or component path]"
---

Make the UI at `$ARGUMENTS` bolder. Load the `ui-craft` skill and read `references/craft-intent.md`.

**This is amplitude, not decoration.** Increase editorial confidence while staying anti-slop clean.

**Apply in order (edit code directly):**

1. **Declare an updated Craft Read** — one line: what changed (variance, motion, signature).
2. **Raise DESIGN_VARIANCE** by +1–2 (cap 10). Product surfaces: asymmetric offset, stronger metric hierarchy, or display moment in shell. Marketing: stronger hero composition, section rhythm break, or typographic scale — per `references/craft-intent.md` variance table.
3. **Raise MOTION_INTENSITY** by +1 (cap 10) if below 8 — add one purposeful entrance or hover choreography on the focal element only. Honor `prefers-reduced-motion`.
4. **Typography** — increase display weight or size one step; tighten tracking on headlines; ensure numbers stay `tabular-nums`.
5. **Accent** — strengthen focal accent placement (within 3–5 viewport budget); tint primary card or CTA — never add a second accent hue.
6. **Signature** — add or strengthen the one signature bet if missing or weak (see craft-intent §3).

**Never add:** purple-cyan gradients, bounce easing, glassmorphism stacks, emoji, ALL CAPS headings, three equal icon-card grids, confetti.

**Knob gating:** if already at variance ≥9 or MOTION ≥9, strengthen signature and typography instead of pushing further.

**Output:** edit code. Print Review Format table. End with the updated Craft Read line.
