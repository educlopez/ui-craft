---
name: remember
description: "Record a UI convention or correction into memory — project-scoped or across all your projects. Invoke when the user asks for remember on their UI, or mentions 'remember' alongside design / UI / frontend work."
---

<!-- AUTO-GENERATED. Do not edit here. Source: skills/ui-craft/ + commands/*.md. Regenerate with `node scripts/sync-harnesses.mjs`. -->

**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

Load `references/memory.md` for the memory contract before proceeding.

## Step 1: Capture the fact

From the argument (or the immediately preceding correction in the conversation), capture:
- **What** changed or is preferred — the concrete rule.
- **Why** — the reason. This is mandatory; without it the memory can't generalize. If the why isn't stated, ask one short question.
- **Apply** — phrase it as an instruction a future build can follow without this conversation's context.

## Step 2: Choose the reach

- **User/global** (`~/.ui-craft/memory/`) if the user signals it applies everywhere: "in all my projects", "en todos mis proyectos", "siempre que trabajes conmigo", "as a rule for me". It's about the user's taste, not this brand.
- **Project** (`.ui-craft/memory/`) if it's tied to this codebase/brand, or there's no cross-project signal — this is the default.
- If it's clearly personal taste but the reach is ambiguous, ask once: "¿solo en este proyecto o en todos los tuyos?"

## Step 3: Write the atomic memory

1. Create the dated file in the chosen store: `<store>/YYYY-MM-DD-<slug>.md` with frontmatter (`id`, `type`, `scope`, `status: active`, `date`, `supersedes`, `tags`) + body (fact, **Why**, **Apply**) per `references/memory.md`.
2. If it contradicts an existing memory, set the old one's `status: superseded`, add its id to this entry's `supersedes`, and update the old INDEX line.
3. Add a one-line hook to that store's `INDEX.md` (id, hook, tags). Create `INDEX.md` (and `profile.md` for the project store) if absent.

## Step 4: Confirm

Report in one line where it landed and what it will change, e.g.:
> Anotado en memoria de proyecto (`.ui-craft/memory/`): nunca gradientes en hero aquí.

If the correction would breach the hard floor (a11y/correctness), do **not** store it as-is — store the closest compliant interpretation and say so.
