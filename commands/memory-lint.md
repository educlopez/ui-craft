---
description: Audit and clean the ui-craft memory stores — find conflicts, stale entries, and missing supersedes.
argument-hint: "[optional: 'project' or 'global' to scope; default both]"
---

Load `references/memory.md` for the memory contract before proceeding.

## Scope

Lint both stores unless the argument narrows it:
- Project: `.ui-craft/memory/`
- User/global: `~/.ui-craft/memory/`

If a store doesn't exist, skip it silently.

## Checks

For each store, read `INDEX.md` and every memory file, then report findings grouped by store:

1. **Conflicts** — two `status: active` memories whose `Apply` lines contradict and neither lists the other in `supersedes`. List both; ask the user which holds, then mark the loser `superseded`.
2. **Orphan supersedes** — a `supersedes` id that points to a missing or still-`active` file. Fix the link or status.
3. **Index drift** — memory files missing an `INDEX.md` hook, or INDEX lines pointing to deleted files. Reconcile.
4. **Stale** — memories referencing a feature, token, or stack the project no longer has (cross-check `profile.md` and the codebase). Propose superseding, not deleting.
5. **Missing why** — entries with no **Why** line; they can't generalize. Flag for the user to enrich or drop.
6. **Over-cap** — a store with more than ~20 active entries. Identify the most stable ones as candidates to fold into `profile.md` (project) or promote to global.
7. **Promotion candidates** — project memories the user has effectively applied everywhere; suggest promoting to the global store. Memories true for most projects/people are upstream-PR candidates against the skill's `references/*`, not memory.

## Output

A markdown table per store: `Finding | Severity | Memory id | Suggested fix`. Apply only the mechanical fixes (index reconciliation, orphan-link repair) automatically; for conflicts, stale claims, and promotions, propose and wait for the user's call. Never delete a memory file — supersede it.
