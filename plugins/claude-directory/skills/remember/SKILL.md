---
name: remember
description: "Record a learned design constraint from a correction into the project brief. Invoke when the user asks for remember on their UI, or mentions 'remember' alongside design / UI / frontend work."
---

**Claude Directory skills edition.** This package provides instructions only:
no bundled MCP server, command hook, executable helper, or review agent. Do not
install or launch UI Craft tools on its behalf. Use the supplied references for
manual reviews. Never invent detector results, a deterministic UICraftScore,
seeded draws, or browser measurements. State what was actually inspected and
mark unavailable checks as not verified. Use only capabilities already available
and authorized in the current session; otherwise request source or screenshots.
Write project files only with available, authorized tools; otherwise return the
proposed content as text and do not claim it was saved.
References named below live in the ui-craft skill's references/ directory.


**Context:** this sub-skill is one lens of the broader `ui-craft` skill. If the `ui-craft` skill is also installed, read its SKILL.md first for Discovery + Anti-Slop + Craft Test, then apply the specific lens below.

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

If the user signals this should apply to **all** their projects ("in all my projects", "whenever you work with me"), that's general memory, outside the brief's project scope:
- If an external memory service is available to the agent, mirror the constraint there so other projects inherit it.
- If not, record it in this brief and note that cross-project recall would need such a service.

## Step 4: Confirm

Report in one line where it landed and what it changes, e.g.:
> Recorded in the brief (learned constraint): never gradients on a hero here.

**Next step:** Keep working. The constraint now lives in the brief, so every future session reads it (rung 2).
