# Project Memory & Self-Correction

A portable, file-based learning layer that lives in the user's repo at `.ui-craft/memory.md`. It lets the skill remember a project's conventions and the corrections a user makes — so the same mistake is never re-litigated twice — without ever weakening the skill's quality floor.

No database, no MCP, no network. One markdown file the skill reads at Discovery and appends to when corrected. Commit it (team shares the learning) or gitignore it (solo) — both work.

## The precedence ladder

Decisions resolve top-down. A higher tier always wins.

```
1. HARD FLOOR — never overridden by memory
   Accessibility (keyboard, focus-visible, APCA contrast, reduced-motion),
   correctness, and the Critical anti-slop tells.
2. PROJECT MEMORY — overrides skill defaults
   .ui-craft/memory.md → Profile + active Learned entries.
3. SKILL DEFAULTS — the curated baseline
   references/* and SKILL.md Knobs.
```

**Why a floor at all:** a learned preference can legitimately invert a *default* ("this brand never uses gradients", "radius is always 4px here"). It must never be allowed to invert a *safety rule* ("don't show focus rings", "ship 2.5:1 text contrast"). If a correction asks for something below the floor, apply the closest compliant interpretation and say so in one line — don't silently obey, don't silently refuse.

## File format

Two blocks. Keep it small — this is preferences and project shape, not a knowledge base. The references already hold the knowledge.

```markdown
# ui-craft memory

## Profile
<!-- Autodetected at Discovery, refreshed when the stack changes. -->
- stack: React 19 + Tailwind v4 + Motion
- tokens: radius 6/10/14, brand hue 250 (oklch), font Ubuntu
- motion intensity: subtle
- style: Dark Premium

## Learned
<!-- Append-only. Newest at top. One correction per entry. -->

**2026-06-23** — rejected: gradient hero background
- Prefers: flat tinted surface (oklch 22% 0.02 250)
- Why: brand reads "enterprise, restrained" — flashy undercuts trust
- Apply: never propose gradient backgrounds on landing/hero surfaces here
- Scope: project

**2026-06-20** — corrected: button press scale
- Was: scale(0.92) · Now: scale(0.97)
- Why: 0.92 felt exaggerated to the user
- Apply: cap press feedback at 0.97 on this project
- Scope: project
```

**Entry fields** (mirror a good code-review note):
- **First line:** `**<ISO date>** — <rejected|corrected|preferred>: <one-line subject>`
- **Was / Now** or **Prefers:** the concrete change.
- **Why:** the reason — this is what lets the skill generalize the preference instead of pattern-matching one literal case.
- **Apply:** the operative instruction, phrased as a rule the next build can follow.
- **Scope:** `project` (default) or `surface:<name>` (narrower — e.g. only on auth screens).

## Read — at Discovery

In Discovery Step 1, after loading `.ui-craft/brief.md`, load `.ui-craft/memory.md` if it exists:
- Apply **Profile** as known facts — skip the questions it already answers (don't re-ask the font if Profile names it).
- Treat each active **Learned** entry as a binding constraint at tier 2. When an entry's `Apply` line contradicts a skill default, the entry wins; the floor still wins over the entry.
- If memory is absent, behave exactly as today. The file is additive — never required.

## Write — when corrected

Append a `Learned` entry when the user signals a correction or a durable preference. Triggers (any language):
- Rejects or dislikes output: "no así", "no me gusta", "that's not what I want", "undo that".
- States a standing rule: "siempre haz X", "always use Y here", "never Z on this project".
- Reverses a non-default choice you made and the reversal reads as a preference, not a one-off.

Do **not** write for: a one-off tweak with no generalizable reason, exploratory back-and-forth that doesn't land, or anything already covered by an existing entry (update that entry instead).

How to write:
1. Capture the **Why**, not just the what — a literal "don't do X" with no reason can't generalize and becomes noise.
2. Phrase **Apply** as an instruction the next build can act on without the original context.
3. If a new entry contradicts an existing one, mark the old one superseded rather than leaving both:
   ```markdown
   **2026-06-23** — superseded by entry below · ~~press scale 0.97~~
   ```
4. Confirm in one line: "Anoté en `.ui-craft/memory.md`: nunca gradientes en hero aquí." Keep the user in the loop — silent memory is spooky.

## The upstream funnel

Project corrections split two ways:
- **Project-specific** ("this brand hates gradients") → stays local in `memory.md`. Correct behavior for one project, wrong as a global default.
- **Reveals a skill gap or bug** ("the default press scale is too aggressive for everyone") → that's not project memory, that's a defect in the baseline. Surface it: suggest the user open an issue/PR against the skill's references. Local memory becomes the discovery pipeline for improving the skill itself.

The test: *would this correction be right on most projects?* Yes → upstream candidate. No → local memory.

## Hygiene

`memory.md` rots like any notes file. Keep it healthy:
- One correction per entry; newest on top.
- Date every entry (ISO). Stale entries that reference removed features get superseded, not deleted silently.
- Superseded entries stay (struck through) so the history of *why* survives — but don't apply them.
- If two entries conflict and neither is marked superseded, ask the user which holds, then mark the loser.
- Cap it. If `Learned` grows past ~20 active entries, the most stable ones are probably real conventions — fold them into `Profile` or propose promoting them into `/brief`.
