---
description: Record a learned design constraint from a correction into the project brief.
argument-hint: "[what to remember, e.g. 'never gradients on hero here']"
---

Load `references/brief.md` (sections 6 + Self-Correction) before proceeding.

## Step 1: Capture the constraint

From the argument (or the immediately preceding correction in the conversation), capture:
- **What** changed or is preferred — the concrete rule.
- **Why** — the reason. Mandatory; without it the constraint can't generalize. If it isn't stated, ask one short question.
- Phrase the rule so a future build can apply it without this conversation's context.

## Step 2: Write it to the brief

Append a dated entry to **section 6 (Learned constraints)** of `.ui-craft/brief.md`:

```markdown
- **YYYY-MM-DD** — <the rule>. *Why:* <reason>.
```

Create the brief (run `/brief`) or the section 6 heading if absent. If the new constraint contradicts an existing principle or constraint, mark the old one deprecated with a dated reason (brief is append-mostly) rather than deleting it. Never store a rule that breaches the accessibility/correctness floor — record the closest compliant interpretation and say so.

## Step 3: Cross-project reach (optional)

If the user signals this should apply to **all** their projects ("in all my projects", "siempre que trabajes conmigo"), that's general memory, outside the brief's project scope:
- If an external memory service is available to the agent, mirror the constraint there so other projects inherit it.
- If not, record it in this brief and note that cross-project recall would need such a service.

## Step 4: Confirm

Report in one line where it landed and what it changes, e.g.:
> Anotado en el brief (constraint aprendida): nunca gradientes en hero aquí.
