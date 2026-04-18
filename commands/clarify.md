---
description: UX copy pass — buttons, errors, empty states, form hints. Clarity over cleverness.
argument-hint: "[file or component path]"
---

Clarify the copy in `$ARGUMENTS`. Load the `ui-craft` skill.

**Default mode: critique, not edit.** Return the copy diff in a Review Format table. Only apply changes if the user says "apply".

**Checklist — walk the UI and flag every instance:**

1. **Button labels** — verb + object. "Send invite" > "Submit". "Delete project" > "Delete". Never "OK", "Submit", "Click here".
2. **Errors** — inline, specific, actionable. "Email already in use — sign in or use another address." Never "Something went wrong."
3. **Empty states** — one line explaining why empty + one CTA. "No projects yet. Create your first." not "It's empty here!"
4. **Form hints** — below the field, persistent, not just validation-triggered. "Must include a number and a symbol" as helper text, not as an error after submit.
5. **Confirmation language** — past tense, subject-first. "Project deleted." > "Successfully deleted project."
6. **Destructive actions** — the noun lives in the button. "Delete {projectName}" > "Delete". The dialog confirms; the button commits.
7. **Case** — sentence case by default. Title Case only for branded product names. Never ALL CAPS (exception: 11-13px category labels, already in SKILL.md).
8. **Voice** — clear > clever. Active voice. Short sentences. Real words ("cancel" not "discontinue", "start" not "initiate").

**Knob-agnostic** — clarity is not tunable. Run the full checklist regardless of CRAFT_LEVEL.

**References to read**: `references/copy.md` (microcopy voice + patterns), `references/accessibility.md` (error message expectations for screen readers).

**Output format** — the Review Format table:

| Before | After | Why |
| --- | --- | --- |

Prioritize by impact (errors and destructive actions first, then CTAs, then helper copy). End with a one-paragraph summary of the overall voice shift. If the user says "apply", edit the code and re-print the table with file paths.
