# AI Chat — Interaction Patterns for AI-Native Surfaces

Framework-agnostic patterns for UIs that stream tokens, render tool traces, show citations, or render AI-generated content alongside user chrome. The rules sit on top of `state-design.md` — AI surfaces extend the base lattice with streaming-specific states, caret semantics, and trust affordances. No assumption of Vercel AI SDK, LangChain, or CopilotKit — patterns apply to any streaming runtime.

---

## When to Read This

Read when building anything that streams tokens to the user, renders function-call traces, shows citations or source chips, or presents AI-generated content alongside human-authored UI. If the surface is just a "submit + await + render" form with no streaming and no tool use, skip this and stay in `state-design.md` + `copy.md`.

---

## The Streaming Contract

What the user expects the moment they hit send. Every bullet is a hard rule, not a preference.

- **First visible pixel < 400ms** (Doherty threshold). If the model is slow, paint the message shell, the thinking indicator, and the stop button before the first token. Never a blank screen waiting on the first chunk.
- **Caret or cursor indicator while tokens arrive.** No caret = "is it broken?" panic. A blinking block, a pulsing dot at the tail of the last token, or a subtle gradient sweep — one of these is always visible during an active stream.
- **Progressive markdown rendering.** Parse headings, lists, code blocks, and inline formatting as chunks arrive. Never buffer the full response and render once — users perceive that as a freeze even if the total time is identical.
- **Token pacing matches reality.** If the model is fast, don't artificially slow the render to feel "human." If it's slow, show incremental progress, never a spinner that sits for 15s.
- **Interruptible.** Always a stop button while streaming. After stop, a regenerate button. Never strand the user watching a response they don't want.
- **Scroll discipline.** Auto-scroll to follow new tokens, but pause auto-scroll the moment the user scrolls up. Resume only on user send or explicit "scroll to bottom."

---

## Status Affordances

Seven states AI UIs need beyond the base `state-design.md` lattice. Every state has a distinct visual signal — the user never has to guess which one they're in.

| State | Signal |
|---|---|
| Idle | Empty input, placeholder prompt, optional suggested starter prompts below |
| Composing | User typing; no AI activity shown; send button enabled |
| Thinking | Sent, model hasn't started; typing-dots or "thinking…" label; max 2s before escalating to progress |
| Streaming | Caret visible; tokens appearing; stop button active; auto-scroll following tail |
| Tool-calling | Labeled tool trace ("Searching web for…" / "Reading file X.ts") with collapsible detail and running spinner |
| Complete | Caret gone; all actions available — regenerate, copy, feedback, branch |
| Error | Specific cause + retry + copy-error-id; never a toast that vanishes |

The thinking → streaming transition is the most-botched handoff. If thinking lasts > 2s without a progress signal, users refresh. Escalate to "Still thinking — this sometimes takes up to 10s" after 2s.

---

## Tool Traces

When the model calls a function (web search, file read, code execution), render it inline. Hiding tool calls is the fastest way to lose user trust.

**Required parts:**
- **Title + target.** "Search web: 'Anchor Positioning browser support'" — not "Tool call: search".
- **Status icon.** Running (spinner), complete (check), failed (warning).
- **Collapsible detail.** Expand to show request args + response. Collapsed by default for readable flow; expanded by user choice persists through the session.
- **Duration once done.** "Search web: 'Anchor Positioning' · 1.2s" — cheap honesty.
- **Chained traces render in order.** If the model calls three tools, show three traces in sequence as they happen, not a single "tools" umbrella.

**Never** hide tool calls behind a toggle that defaults to off. If the model did work, the user sees it happened. Transparency is the trust primitive for AI UIs.

---

## Citation Chips

When the model cites sources, make them first-class content, not footnotes no one reads.

- **Inline superscript** — `⟨¹⟩` or `[1]` at the end of the cited clause.
- **Hover/tap reveals source card** — title, URL, excerpt (2-3 lines of context), favicon.
- **Sources section at the bottom** — ordered by first-appearance citation number, not alphabetical.
- **Click a chip scrolls to that quote** — the stream becomes a deep-link map. Use View Transitions if navigating between a source detail page and the chat.
- **Broken citation = find-and-replace.** If a source 404s at chip-render time, mark the chip as unverified with a warning icon; don't silently drop it.

---

## Feedback Affordances

Every AI response gets feedback controls. Optional, never required.

- **Thumb up / thumb down.** Pick up/down OR agree/disagree wording — never mix. Persist choice; allow undo.
- **On thumb down: inline quick chips** — "factually incorrect", "harmful", "refused reasonable request", "bad format", "other". User can skip chips and just send the thumb.
- **Acknowledgement copy** — "Thanks — this helps us improve." Not "Your feedback has been recorded successfully!" Match `ux-writing.md` restraint.
- **Never block the UI on feedback.** No "you must rate before continuing" modals. Ever.

---

## Retry / Regenerate / Continue

Three distinct verbs for three distinct operations. Mixing them is a common AI-UI tell.

| Verb | Meaning | Effect on history |
|------|---------|-------------------|
| Retry | Same prompt, same context, same model | Replaces prior response |
| Regenerate | Same prompt, variation (temperature bump or alt model) | Creates alternative; original stays visible |
| Continue | Response was cut off; extend from last token | Appends to prior response |

Label the buttons with the actual verb. "Try again" is ambiguous — is it retry or regenerate? Pick one and be explicit.

---

## Inline Actions on Response

What lives on each assistant message, reachable by hover (desktop) or tap-and-hold (mobile):

- **Copy.** Always. Clean text — no invisible whitespace, no markdown-to-plain conversion surprises. If the response is code, copy without the surrounding prose.
- **Edit prompt.** Jump to the user message that produced this response, with the original text pre-filled. Edits trigger retry.
- **Branch conversation.** Fork from this point; the original thread stays intact. Useful for "what if I asked differently?" exploration.
- **Share link.** Generates a read-only URL to this response (or the full thread up to this point).
- **Export markdown.** Clean markdown of the response, ready to paste into a doc.
- **Flag.** For destructive or concerning content. Sends to your review queue.

Actions appear on hover; persist on the last message (most commonly actioned); collapse into a `⋯` menu on mobile.

---

## Generative UI Patterns

When the model generates UI — charts, cards, forms, interactive tools — the render has rules the model doesn't know about. Enforce them in the renderer.

- **Loading skeleton matches component shape.** A generated chart gets a chart-shaped skeleton; a generated table gets table rows. Generic gray box is the AI-slop fallback.
- **Fallback to plain text if structured render fails.** If the schema is malformed, render the raw text and log the parse error — never show a broken component.
- **Interactive elements keep keyboard accessibility.** Generated buttons, selects, and forms are real `<button>`, `<select>`, `<form>` — not divs. The model doesn't get to skip a11y.
- **"Copy as code" always available.** For any generated UI, the user can see and copy the underlying code/props. Debuggability is trust.
- **Streaming components render progressively.** A generated table fills row by row as data arrives, not all-at-once at the end.

---

## Conversation Surface Layout

Body rules that make long threads readable.

- **Input always visible.** Pinned to viewport bottom on mobile (above the home indicator); sticky on desktop when the thread scrolls past its height. Never behind a scroll gate.
- **Scroll-to-bottom on send.** Force-scroll when the user sends a new message. During streaming, auto-scroll follows the tail UNTIL the user scrolls up — then pause until they scroll down or send again.
- **Max-width on message content.** ~65-75ch reading line. Full-width on tool traces and generative UI (they need room).
- **Alternating visual treatment for user vs assistant.** Right-aligned vs left-aligned, or tinted bubble vs plain, or avatar on one side only. Subtle — not a heavy rhythm that fights the content.
- **Thread virtualization at > 100 messages.** Long sessions compound DOM cost; render only the visible window + some buffer.

---

## Anti-Patterns

Ten sins that immediately read as "AI UI built in a weekend":

- Streaming without a caret — user can't tell if it's alive.
- Spinner > 3s without a progress signal or expected-duration copy.
- Auto-scrolling while the user is reading earlier content.
- Hiding tool calls behind a default-off toggle.
- Forced feedback ("rate before continuing").
- Removing the stop button during an active stream.
- Awaiting the full response then rendering once (no progressive parse).
- Copy button that copies with invisible whitespace, zero-width chars, or broken markdown.
- "Thinking…" label for 30s with no escalation, no progress, no tool trace.
- Fake typewriter pacing slower than the actual stream — makes a fast model feel slow.

---

## Cross-References

- `state-design.md` — base state lattice (idle / loading / empty / error / partial / conflict / offline). AI surfaces extend it with thinking / streaming / tool-calling.
- `motion-system.md` — caret animation tokens, streaming shimmer, tool-trace expand/collapse. Use the existing duration scale; never bespoke.
- `accessibility.md` — live-region announcements when content streams (`aria-live="polite"` on the message container; `aria-busy` during tool calls).
- `heuristics.md` — visibility-of-system-status applied to AI; the stream is the system, and it needs to be visible at every moment.
- `copy.md` + `ux-writing.md` — error and acknowledgement copy for AI responses; tone is restrained, not effusive.
