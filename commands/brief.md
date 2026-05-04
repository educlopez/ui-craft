---
description: Write or update the project's durable design brief at .ui-craft/brief.md.
argument-hint: "[optional: focus, e.g. 'first time' or 'update principles']"
---

Load `references/brief.md` for the brief format before proceeding.

## Step 1: Detect existing brief

Check whether `.ui-craft/brief.md` exists. Use Read or ls on `.ui-craft/`.

**If it exists:** load its contents. If `$ARGUMENTS` names a specific update ("update principles", "shift target user", "add out of scope"), focus the session there and skip unchanged sections. Otherwise summarize what's in the brief and ask: "What do you want to change?"

**If it doesn't exist:** proceed to Step 2.

## Step 2: Draft a new brief (absent case)

Walk the user through the five required sections in a single pass. Ask ONE compact question per section. Do not open five separate prompts unless the user asks for depth.

Compact prompt template:

> "To write your design brief I need five things — answer as tersely as you like, I'll fill in structure:
> 1. **Product purpose** — what does it do, in one sentence?
> 2. **Primary user** — who, by role and context?
> 3. **Principles** — what does this product believe? Give me three to five stances it takes. (If you don't have these yet, say so — I'll run the principles workshop.)
> 4. **Success metric** — what does 'the user succeeded on this surface' look like in observable behavior?
> 5. **Out of scope** — three to five things this surface deliberately does NOT do."

**Principles workshop case:** if the user says "I don't have principles yet" or gives vague answers ("make it good", "keep it simple"), do NOT fabricate principles from vague input. Load `references/principles-catalog.md` first. The catalog has 42 worked example principles across 8 product categories — use them as conversation seeds, not as templates to adopt literally. Show 2-3 from the closest category to the user's product, then ask which resonate or which they'd flip. Then run the principles workshop from `references/brief.md` as a focused sub-flow: ask for three past design decisions that were debated, then derive candidate principles from the patterns. Refuse to accept platitudes — push back and prompt for substance.

**Parsing long input:** if the user provides a product description or PRD, parse it into the five sections rather than re-asking for information already given. State what you extracted and ask for confirmation or corrections.

**Thin answers:** if an answer is too vague to constrain a design decision, ask one targeted follow-up. Maximum two follow-ups per section before flagging it as incomplete and moving on.

## Step 3: Show before writing

Always show the proposed brief in full before writing the file. Ask: "Does this look right, or anything to adjust?"

Do not write until confirmed.

## Step 4: Write the file

Create `.ui-craft/` if it doesn't exist. Write the confirmed content to `.ui-craft/brief.md`.

The file must contain all five sections with the exact headings from `references/brief.md`. No omissions.

## Step 5: After writing

Tell the user the file is at `.ui-craft/brief.md`. Suggest committing it:

> "Commit `.ui-craft/brief.md` to the repo — it's documentation, not config. The agent reads it every session."

Do not auto-commit. Per project rules, commits require explicit user instruction.

## Constraints

- All five sections are required. If one is genuinely unknown, write it as a dated placeholder with `[TO DEFINE — YYYY-MM-DD]` so the gap is visible.
- The brief is append-mostly on updates. Never delete past content — mark deprecated with date and reason.
- No brand names, product examples, or generic SaaS language inside the user's brief. The brief describes their product, not the template.
