# UX Copy & Writing

Voice, tone, reading level, terminology, inclusive language, locale handling, and tactical microcopy (errors, empty states, CTAs). Clear, human interface writing.

---

## Voice vs Tone

**Voice is constant. Tone varies.** Voice is the product's personality — how it sounds whether you're reading onboarding, an error, or a paywall. Tone is how that voice adjusts to context: warmer in onboarding, restrained in success, explicit in destructive confirms. A product with a consistent voice but responsive tone reads as designed; a product with shifting voice reads as written by 12 people.

### Voice Matrix

Pick three axes. Lock a position on each. Deviations are deliberate (brand campaigns, April Fools), never accidental.

| Axis | Endpoints | Example anchors |
|------|-----------|-----------------|
| Formality | Formal ↔ Casual | Stripe formal; Mailchimp casual |
| Reverence | Reverent ↔ Irreverent | Apple reverent; Slack irreverent |
| Expertise | Expert ↔ Beginner-friendly | Datadog expert; Duolingo beginner |

Document the positions. "Casual-but-respectful, beginner-friendly, mildly irreverent" is a brief a writer can execute against. "Friendly" is not.

### Tone by Context

Voice is fixed; tone moves along these contexts. Each row below assumes a default voice of "casual-professional, beginner-friendly, restrained."

| Context | Tone | Example |
|---------|------|---------|
| Onboarding | Warm + specific | "Let's get your first project in. Takes 60 seconds." |
| Error — user-recoverable | Honest + actionable | "We couldn't save your draft. Retry, or copy the error for support: `abc-123`." |
| Error — system outage | Honest + transparent | "Search is down. We're investigating. Your data is safe." |
| Success | Restrained | "Changes saved." — not "Amazing work!" |
| Destructive confirm | Explicit about consequences | "Delete 3 items? You'll have 30 days to restore them from Trash." |
| Empty state | Action-oriented | "No integrations yet. Connect Slack, GitHub, or Linear to get started." |
| Paywall / limit | Informational, not shaming | "You're at 5/5 free projects. Upgrade to create more." |
| Danger zone (settings) | Neutral + precise | "Deleting the workspace removes all 47 projects and invalidates all API keys." |
| Waiting / latency | Honest about duration | "Generating report. Usually 20-40 seconds." |

**Never:** exclamation points on errors. Emoji in enterprise contexts. Celebratory copy on routine saves.

---

## Reading Level

Target ~8th-grade reading level (Flesch-Kincaid ~70+, grade ~8). Rules of thumb:

- Sentences ≤ 20 words.
- Paragraphs ≤ 3 sentences.
- Concrete nouns over abstractions ("invoice" beats "billing artifact").
- Active voice ("You signed in" beats "Sign-in was completed").
- One idea per sentence.

**Example rewrite:**

| Before (grade 14) | After (grade 7) |
|-------------------|-----------------|
| "Upon successful authentication, users will be redirected to their personalized dashboard interface." | "You'll see your dashboard after you sign in." |
| "In the event that the operation is unsuccessful, please re-attempt the transmission." | "If it fails, try again." |
| "Configuration modifications will be persisted upon form submission." | "Your changes save when you click Save." |

Automate: [hemingwayapp.com](https://hemingwayapp.com/) for spot checks; the [`flesch` npm package](https://www.npmjs.com/package/flesch) for build-time linting. `write-good` (npm) flags weasel words, passive voice, lexical illusions. `alex` (npm) is an inclusive-language linter.

---

## Terminology Consistency

Every product needs a glossary. Same concept → same word, everywhere.

**Common pitfalls:**
- `user` / `member` / `account` / `seat` — pick one per concept and stick.
- `project` / `workspace` / `board` — pick one per level of hierarchy.
- `delete` / `remove` / `archive` / `trash` — these mean different things; don't alias.
- `sign in` / `log in` — pick one (Apple uses `sign in`, Google uses `log in`; either is fine, mixing is not).
- `save` / `publish` / `update` — same action under three names in three surfaces is a finding.

**Red flag:** in a review, grep the codebase for every verb on every button. If `Save` / `Update` / `Apply` appear on forms that do the same thing, file it.

---

## Inclusive Language

Swap the loaded term for the neutral one. Keep the list tight — don't moralize, just fix.

| Replace | With |
|---------|------|
| blacklist / whitelist | blocklist / allowlist |
| master / slave | primary / replica |
| sanity check | quick check |
| grandfathered | legacy |
| he / she (generic) | they |
| manhours / manpower | work hours / team capacity |
| man-in-the-middle | on-path attack |
| dummy value | placeholder value |
| first-class citizen | fully supported |

Don't soften to the point of vagueness — "on-path attack" is still precise; "bad thing happens in network" is not.

---

## Locale-Aware Strings

Rules agents routinely ignore. Every one is shippable to production the day the product adds a second locale.

- **Dates.** `Intl.DateTimeFormat(locale, options)`. Never hardcode `MM/DD/YYYY` unless the audience is exclusively US. Use `new Date().toLocaleDateString(locale, { dateStyle: 'medium' })` for user-facing dates.
- **Numbers and currency.** `Intl.NumberFormat(locale, { style: 'currency', currency })`. Decimal and thousands separators differ: `1,234.56` (US) vs `1.234,56` (DE) vs `1 234,56` (FR).
- **Plurals.** `Intl.PluralRules(locale)`. English has 2 forms; Russian has 3; Arabic has 6. Never `n === 1 ? "1 item" : n + " items"` — breaks in Polish, Arabic, Welsh.
- **Length tolerance.** German ≈ 1.3× English; Russian ≈ 1.2×; Chinese ≈ 0.5×. Don't fix widths to English copy. Test with `de-DE` pseudo-locale.
- **RTL readiness.** Use logical CSS properties (`margin-inline-start`, `padding-inline-end`, `border-inline-start`), not `margin-left`. `dir="rtl"` at the root should flip the UI without additional CSS.
- **Time zones.** Store UTC, display in the user's zone. Never assume server time is user time. Use `Intl.DateTimeFormat(locale, { timeZone })`.
- **Sorting.** `Intl.Collator(locale)` — alphabetical order is locale-dependent (Swedish sorts `å` after `z`, German doesn't).

---

## Core Principles (Tactical)

1. **Be specific**: "Enter email" not "Enter value"
2. **Be concise**: Cut unnecessary words (don't sacrifice clarity)
3. **Be active**: "Save changes" not "Changes will be saved"
4. **Be human**: "Something went wrong" not "System error encountered"
5. **Be helpful**: Tell users what to do, not just what happened
6. **Be consistent**: Same terms throughout — don't vary for variety

---

## CTAs & Buttons

**Verb + noun.** Never `Submit`, `OK`, `Click here`, `Continue`.

| Generic | Specific |
|---------|----------|
| Submit | Create project |
| OK | Got it |
| Continue | Next: billing |
| Click here | Download invoice (PDF, 84KB) |
| Delete | Delete workspace |

- Describe the action specifically (verb + noun). Active voice.
- **Destructive actions include the object:** "Delete `project-alpha`" — user confirms the thing, not a generic verb. Typing the name for irreversible operations is the gold standard.
- **Action reveals consequence.** "Send invite" tells the user exactly what happens. "Submit form" does not.
- **One primary per view section** — solid for primary, outline/ghost for secondary.
- **Disabled states explain why** — not just grayed out, never rely on color alone.

---

## Error Messages

Three parts, in order: **what happened** + **why** + **what to do**.

- "Upload failed. The file is 62MB; the limit is 50MB. Try compressing it or splitting into parts."
- "We couldn't reach the server. Your internet looks offline. We'll retry automatically when you're back online."
- "Can't create the project. The name `beta` is already taken in this workspace. Try another name."

**Missing pieces = bad error.** "Something went wrong" has none. "Invalid input" has only the first.

### Rules
- Explain what went wrong in plain language
- Suggest how to fix it
- Don't blame the user
- Include examples when helpful
- Link to help/support if applicable

**Bad**: "Error 403: Forbidden" → **Good**: "You don't have permission to view this page. Contact your admin for access."
**Bad**: "Invalid input" → **Good**: "Email addresses need an @ symbol. Try: name@example.com"

---

## Empty States

**Bad**: "No items" → **Good**: "No projects yet. Create your first project to get started."

- Explain why it's empty (if not obvious)
- Show next action clearly
- Make it welcoming, not a dead-end

---

## Loading & Success States

**Loading** — Bad: "Loading..." (for 30+ seconds). Good: "Analyzing your data... this usually takes 30-60 seconds."
- Set expectations, explain what's happening, show progress, offer "Cancel".

**Success** — Bad: "Success". Good: "Settings saved! Your changes will take effect immediately."
- Confirm what happened, explain what's next, be brief but complete.

---

## Confirmation Dialogs

**Bad**: "Are you sure?" → **Good**: "Delete 'Project Alpha'? This can't be undone."

- State the specific action
- Explain consequences (especially destructive)
- Clear button labels ("Delete project" not "Yes")
- Only for risky actions

---

## Form Labels & Microcopy

- Clear, specific labels (not generic placeholders)
- Placeholders are examples, not labels — labels exist separately, placeholders end with `…`
- Explain why you're asking (when not obvious)
- Instructions before the field, not after
- Never use placeholders as the only labels

**Tooltips** — Bad: "This is the username field". Good: "Choose a username. You can change this later in Settings."
- Add value (don't repeat the label), answer "What is this?" or "Why?", inline help first, tooltips as last resort.

---

## Formatting Rules

- **Ellipsis for loading/follow-ups**: "Loading…", "Rename…"
- **Use `…` character** not three dots `...`
- **Curly quotes**: " " not " "
- **Non-breaking spaces**: `10&nbsp;MB`, `⌘&nbsp;K`
- **Numerals for counts**: "8 deployments" not "eight deployments"
- **Active voice**: "Install the CLI" not "The CLI will be installed"
- **Default to positive language**: encourage, don't blame
- **`<title>` reflects current context**

---

## Content & States

Every UI must design for the full range of content and states, not just the happy path:

- **Design all states**: empty, sparse, dense, error, loading, success
- **Skeletons mirror final content** exactly — prevent layout shift
- **No dead ends** — always offer next step or recovery
- **Empty states** guide toward action, not just "nothing here"
- **Accessible names** exist even when visuals omit labels
- **Resilient to user-generated content**: short, average, very long

---

## Banned Patterns (Dark UX)

UX sins, not style choices.

- **Confirmshaming.** "No thanks, I don't care about security." Ship: "No thanks" as a plain link.
- **Fake urgency.** "Only 2 seats left!" when it's always 2. Ship: real counters or no counter.
- **Fake scarcity.** "87% of users upgraded" with no source. Ship: named, verifiable stats or omit.
- **Roach motel.** Easy signup, impossible cancellation. Ship: cancel in the same number of clicks as signup.
- **Dark toggles.** Opt-in checkboxes pre-checked for marketing emails. Ship: unchecked by default, unambiguous label.
- **Bait-and-switch pricing.** "$9/mo" that's actually "$9/mo, billed $108 annually, with a $29 setup fee." Ship: the total visible at decision time.

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
- Exclamation points on errors
- Celebratory copy on routine saves

---

## Sources

- Nielsen, J. "How Users Read on the Web." Nielsen Norman Group.
- Mailchimp Content Style Guide — [styleguide.mailchimp.com](https://styleguide.mailchimp.com/).
- Shopify Polaris — Content Guidelines.
- Atlassian Design System — Writing Style.
- Flesch, R. "A New Readability Yardstick." *Journal of Applied Psychology*, 1948.
- Unicode CLDR — locale data for dates, numbers, plurals.
