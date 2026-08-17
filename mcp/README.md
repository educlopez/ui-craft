# ui-craft MCP Server

Deterministic design-quality gate exposed as a stdio MCP server. Complements the `ui-craft` skill (taste/judgment layer) — never duplicates it.

## Install

Requires Node.js 20 or newer.

```bash
npm install -g ui-craft-mcp@0.9.0
# or use npx (no install required):
npx -y ui-craft-mcp@0.9.0
```

## Wiring

Copy `.mcp.json.example` from the repo root to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "ui-craft": {
      "command": "npx",
      "args": ["-y", "ui-craft-mcp@0.9.0"]
    }
  }
}
```

Claude Desktop, Cursor, and other MCP clients read `.mcp.json` automatically.

## Tools

Every tool declares an `outputSchema`, so a successful call returns the payload twice: as
`structuredContent` (machine-readable, validated against the schema) and as a pretty-printed JSON
text block (unchanged, for hosts that only render text). Error results keep the text block, set
`isError`, and omit `structuredContent`.

### `route_task`

Call this first on any UI request, before reading reference files. Takes the task in natural language and returns the references, commands and MCP tools that cover it, ranked, plus the single first move to make.

Deterministic lexical ranking — no model call, no embeddings, no network. Same prompt always returns the same routing.

**Why it exists:** the routing table in `SKILL.md` only fires when the user's words match our filenames. "An analytics panel" points at nothing, because `recipe-dashboard.md` never says analytics. `route_task` closes that gap three ways:

- **Synonym map.** `analytics`, `KPI`, `metrics`, `panel`, `backoffice` all reach `dashboard`. Task filler (`build`, `make`, `need`, `please`) is stripped as stopwords — left in, it matches every candidate equally and flattens the ranking instead of sharpening it.
- **Constituents index.** Entries carry the names of the parts they are built from, so "pricing block" reaches `recipe-landing.md` and "KPI grid" reaches `recipe-dashboard.md`.
- **A recommendation, not a list.** `first_move` is a command when one applies, because a command is something the agent can *do*; a reference is only ever reading.

**Repair vs build (`intent`).** Words meaning "this already exists and is wrong" — `broken`, `slow`, `janky`, `jumps`, `misaligned`, `wrong` — set `intent: "repair"`. That suppresses constructive moves (`/craft`, `/sddesign`, `/shape`) and prefers a pass over a reference's build-time default: "this 3000-row table is slow" answers `/audit`, not `/animate` (which `motion.md` carries) and not `/craft dashboard`. When only a build move is on offer, `first_move` is `null` and the instruction names the reference to read — a wrong first move is worse than none.

Signal ladder: exact name (100) → exact keyword (60) → constituent (45) → fuzzy name (40, edit distance ≤2) → fuzzy keyword (25) → summary word (12). A summary-only hit needs two matched concepts to count, so an entry never surfaces because its description mentions a word once.

Score is the entry's **strongest** signal plus a coverage bonus for how much of the prompt it accounts for. Not the mean of its signals: averaging made covering a second concept *lower* an entry's score, which handed "review keyboard accessibility" to `/critique` instead of `/audit`. Neither term is a multiplier, so a wordy prompt is never scaled down for the words that missed.

**Input**:
- `prompt` — the task in natural language
- `limit` — max hits per kind (default 5, clamped to 12)

**Output**:
```json
{
  "prompt": "build me an analytics panel with KPIs",
  "concepts": ["analytics"],
  "first_move": "/craft dashboard",
  "intent": "build",
  "results": {
    "commands": [{ "name": "craft", "kind": "command", "path": "commands/craft.md", "score": 70, "matched": ["analytics"] }],
    "references": [
      { "name": "dashboard", "kind": "reference", "path": "references/dashboard.md", "tier": 2, "score": 125, "matched": ["analytics"] },
      { "name": "recipe-dashboard", "kind": "reference", "path": "references/recipe-dashboard.md", "tier": 2, "score": 85, "matched": ["analytics"] }
    ],
    "mcp_tools": []
  },
  "instruction": "Start with /craft dashboard. …"
}
```

Note `concepts` is one entry, not three: `analytics`, `panel` and `KPIs` all resolve to the same concept, so they collapse instead of tripling the weight of a single idea. `build` and `me` are stopwords and never become concepts at all.

An unmatched prompt is reported as unmatched (`first_move: "/start"`) rather than routed to a guess.

**Boundary:** returns pointers only. Every design rule stays in the files it points at — this tool does not summarise, judge, or decide anything about the UI.

**Index source:** `src/route-data.mjs`, hand-maintained (v1 — no generator). Add references and commands there in the same commit that adds them to `skills/`; `route-task.test.mjs` fails if an entry is malformed or names an MCP tool the server does not register.

### `check_anti_slop`

Scans source code for anti-slop violations using the 43 deterministic rules from `ui-craft-detect`. In-process (no subprocess spawn).

**Input** (one required):
- `code` — inline source string
- `path` — file or directory path

**Output**:
```json
{
  "findings": [{ "severity": "error|warning", "rule": "...", "file": "...", "line": 42, "message": "..." }],
  "summary": { "total": 3, "errors": 2, "warnings": 1 }
}
```

### `tokens_lint`

Static regex analysis for off-system token values. Flags: raw hex colors, non-scale `border-radius` px, non-8pt spacing px, and magic `z-index` integers. Token scale source: `references/tokens.md`.

Rule IDs: `tokens/color`, `tokens/radius`, `tokens/spacing`, `tokens/z-index`.

**Input** (one required): `code` or `path`

**Output**: same `findings[]` + `summary` shape as `check_anti_slop`.

### `acceptance_bar`

Returns the deterministic acceptance checklist for a UI surface. Data only — no scoring or judgment. Scoring is the caller's responsibility using `check_anti_slop` + `tokens_lint` results.

**Input**:
- `surface` — one of: `dashboard`, `landing`, `auth`, `generic`

**Output**:
```json
{
  "surface": "dashboard",
  "items": [{ "id": "dash-01", "description": "...", "category": "hierarchy" }]
}
```

**Surfaces**:
- `dashboard` — SaaS dashboard acceptance bar (from `recipe-dashboard.md`)
- `landing` — Landing page acceptance bar (from `recipe-landing.md`)
- `auth` — Auth screen acceptance bar (from `recipe-auth.md`)
- `generic` — 10 finish-bar passes (from `finish-bar.md`)

## Boundary: Taste vs. Deterministic

> The MCP server is the **checks layer**. The SKILL.md is the **taste layer**.

This server contains ZERO taste, judgment, or aesthetic preference rules. All such rules live exclusively in `skills/ui-craft/SKILL.md`. The server produces identical output for identical input — it is a deterministic gate, not an AI evaluator.

## acceptance-data — Regen on Recipe Edit

`src/acceptance-data.mjs` is hand-derived from the recipe and finish-bar reference files. It must be updated manually when any of these files change:

- `references/recipe-dashboard.md` — `## Acceptance bar` section
- `references/recipe-landing.md` — `## Acceptance bar` section
- `references/recipe-auth.md` — `## Acceptance bar` section
- `references/finish-bar.md` — 10 pass descriptions

**v1 is manual** — no generator script. A generator is deferred. When updating: edit `src/acceptance-data.mjs` directly (an ESM module, `export default { … }`), following the existing `{ id, description, category }` schema. It's a module rather than JSON so it inlines into the published bundle and loads from source on every Node version.

## Development

```bash
cd mcp
npm install
npm test        # node --test (zero external deps)
node src/server.mjs  # run server directly
```

## Node Version

Requires Node.js >= 20.
