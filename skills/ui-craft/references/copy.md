# UX Copy & Microcopy

Clear, human interface writing.

---

## Principles

1. **Be specific**: "Enter email" not "Enter value"
2. **Be concise**: Cut unnecessary words (don't sacrifice clarity)
3. **Be active**: "Save changes" not "Changes will be saved"
4. **Be human**: "Something went wrong" not "System error encountered"
5. **Be helpful**: Tell users what to do, not just what happened
6. **Be consistent**: Same terms throughout — don't vary for variety

---

## Error Messages

**Bad**: "Error 403: Forbidden"
**Good**: "You don't have permission to view this page. Contact your admin for access."

**Bad**: "Invalid input"
**Good**: "Email addresses need an @ symbol. Try: name@example.com"

### Rules
- Explain what went wrong in plain language
- Suggest how to fix it
- Don't blame the user
- Include examples when helpful
- Link to help/support if applicable

---

## Buttons & CTAs

**Bad**: "Click here" | "Submit" | "OK" | "Continue"
**Good**: "Create account" | "Save changes" | "Got it, thanks" | "Save API Key"

- Describe the action specifically (verb + noun)
- Active voice
- Be specific ("Save" beats "OK")

---

## Empty States

**Bad**: "No items"
**Good**: "No projects yet. Create your first project to get started."

- Explain why it's empty (if not obvious)
- Show next action clearly
- Make it welcoming, not a dead-end

---

## Loading States

**Bad**: "Loading..." (for 30+ seconds)
**Good**: "Analyzing your data... this usually takes 30-60 seconds"

- Set expectations (how long?)
- Explain what's happening
- Show progress when possible
- Offer escape ("Cancel")

---

## Success Messages

**Bad**: "Success"
**Good**: "Settings saved! Your changes will take effect immediately."

- Confirm what happened
- Explain what happens next
- Be brief but complete

---

## Confirmation Dialogs

**Bad**: "Are you sure?"
**Good**: "Delete 'Project Alpha'? This can't be undone."

- State the specific action
- Explain consequences (especially destructive)
- Clear button labels ("Delete project" not "Yes")
- Only for risky actions

---

## Form Labels

- Clear, specific labels (not generic placeholders)
- Placeholders end with … and show example pattern
- Explain why you're asking (when not obvious)
- Instructions before the field, not after
- Never use placeholders as the only labels

---

## Tooltips & Help Text

**Bad**: "This is the username field"
**Good**: "Choose a username. You can change this later in Settings."

- Add value (don't repeat the label)
- Answer "What is this?" or "Why do you need this?"
- Brief but complete
- Inline help first; tooltips as last resort

---

## Formatting Rules

- **Ellipsis for loading/follow-ups**: "Loading…", "Rename…"
- **Use `…` character** not three dots `...`
- **Curly quotes**: " " not " "
- **Non-breaking spaces**: `10&nbsp;MB`, `⌘&nbsp;K`
- **Numerals for counts**: "8 deployments" not "eight deployments"
- **Active voice**: "Install the CLI" not "The CLI will be installed"
- **Default to positive language**: encourage, don't blame
- **Locale-aware**: `Intl.DateTimeFormat`, `Intl.NumberFormat`
- **`<title>` reflects current context**

---

## Never
- Use jargon without explanation
- Blame users
- Be vague without specifics
- Use passive voice unnecessarily
- Use humor for errors (be empathetic)
- Assume technical knowledge
- Vary terminology (pick one term, stick with it)
- Repeat information (headers restating intros)
- Use placeholders as the only labels
