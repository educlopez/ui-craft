# Design: v1 CLI System

> Technical design (the HOW at architectural level) for change `v1-cli-system`.
> Reads from approved `proposal.md`. Resolved constraints: **Go**; no persona; native Claude plugin stays as an alternative install path; existing JS is reused at runtime, never reimplemented in Go.

## Executive Summary

A single static **Go** binary (`ui-craft`, ~10MB) that is *only* an installer/configurator/TUI. It detects installed agent harnesses, prompts à-la-carte component selection, and writes each selected component into that harness's native config format through a per-harness `Harness` implementation behind one common interface. All design *logic* stays in JS: the CLI ships **pre-generated harness mirrors** (`go:embed` of `sync-harnesses.mjs` output, produced at build time) and wires MCP gates by writing `npx -y ui-craft-mcp` into each harness's MCP config (merge, never clobber). Writes are idempotent via managed-blocks for shared/multi-server files and full-file ownership for files the CLI alone owns; `backup` snapshots configs before every write and `rollback` restores them. Design memory is a plain-markdown `.ui-craft/` directory the skill loads (always: brief+tokens; lazy: surfaces/patterns/decisions) — no external memory product, anywhere.

## Architecture Approach

**Pattern:** Ports & Adapters (hexagonal). The `Harness` interface is the port; one adapter per harness. The command layer (Cobra) and the TUI layer (Bubble Tea) are thin drivers over a pure `core` that does detection, planning, and writing. Everything filesystem- or harness-specific lives behind interfaces so it is unit-testable with an in-memory fs.

**Layering (strict, downward-only dependencies):**

```
cmd (Cobra)  ─┐
tui (Bubble Tea) ─┤──► core (planner, installer, backup) ──► harness (port + adapters) ──► fsutil + config writers
                             │                                         │
                             └──► component (catalog/model) ◄──────────┘
                             └──► assets (go:embed FS)
```

The TUI and the non-interactive CLI flags drive the **same** `core` plan/apply path. The TUI never writes files itself — it builds an `InstallPlan` and hands it to `core.Apply`, identical to `--yes` non-interactive mode. This guarantees scriptable installs (CI, `curl | sh`) and interactive installs cannot diverge.

## Module Structure (`cli/` Go package)

```
cli/
  go.mod                         module github.com/educlopez/ui-craft/cli
  main.go                        wires cmd.Execute()
  cmd/                           command layer (Cobra)
    root.go                      persistent flags: --harness, --components, --yes, --dry-run, --dir
    install.go                   detect → plan → (TUI or --yes) → apply
    update.go                    re-apply embedded mirrors at new version; preserve user edits outside managed blocks
    backup.go                    snapshot selected/all harness configs → backup store
    rollback.go                  restore from a chosen snapshot (latest by default)
    version.go                   binary version + embedded-mirror version
  core/
    plan.go                      InstallPlan: []ComponentTarget{harness, component, writer-op}
    apply.go                     transactional apply: backup → write → verify → on-error rollback
    detect.go                    runs Harness.Detect() across registry, returns DetectedHarness[]
  harness/                       the port + adapters
    harness.go                   the Harness interface (below)
    registry.go                  ordered list of all concrete harnesses
    claude.go  cursor.go  codex.go  gemini.go  opencode.go
  component/
    component.go                 Component enum + metadata (SkillCommands, MCPGates, ReviewAgents, DesignMemory)
    catalog.go                   per-component: required?, recommended?, which harnesses support it
  config/                        format-specific read-merge-write helpers
    jsonmerge.go                 deep-merge into JSON/JSONC mcpServers without clobbering siblings
    tomlmerge.go                 merge into Codex TOML config
    mdblock.go                   managed-block insert/replace for AGENTS.md / markdown configs
    markers.go                   BEGIN/END ui-craft marker constants + block hashing
  fsutil/
    fs.go                        FileSystem interface (real + in-memory for tests)
    atomic.go                    write-temp-then-rename atomic writes
  backup/
    store.go                     snapshot manifest + restore; backup dir layout
  assets/
    embed.go                     go:embed of mirrors/, templates/, art/
    mirrors/                     ← CI copies sync-harnesses.mjs output here pre-build
    templates/                   ← .ui-craft/ scaffold (brief.md, tokens.md, decisions.md, surfaces/, patterns.md)
    art/                         ← Aren ASCII/ANSI splash
  tui/
    app.go                       Bubble Tea root model (states: splash → detect → select → confirm → apply → done)
    splash.go                    Aren ANSI art via lipgloss
    select.go                    à-la-carte component multiselect (per detected harness)
    progress.go                  apply progress + per-target result
    styles.go                    lipgloss theme (single accent, no rainbow — eat our own dogfood)
```

The Charm stack: **bubbletea** (model/update/view loop) + **lipgloss** (styling) + **bubbles** (list/spinner/multiselect components). The splash uses ANSI art rendered through lipgloss; we do not add `@clack/prompts` (that was the JS-era plan) — Bubble Tea owns the whole prompt flow now. *(Spec feedback: proposal §Launch experience still references `@clack/prompts`; in Go the equivalent is Bubble Tea — flag to reconcile the spec wording.)*

## Harness Abstraction

```go
type Component int // SkillCommands | MCPGates | ReviewAgents | DesignMemory

type Harness interface {
    Name() string
    Detect() (DetectResult, error)            // is it installed? where?
    ConfigPaths() ConfigPaths                  // mcp config, skills dir, agents dir, project root
    Supports(c Component) bool                 // capability gate
    WriteMCP(w fsutil.FileSystem, server MCPServer) (Change, error)
    WriteSkill(w fsutil.FileSystem, mirror assets.Mirror) (Change, error)
    WriteAgents(w fsutil.FileSystem, agents []assets.Agent) (Change, error)
}
```

`Change` records the file path, the prior bytes (for backup/rollback), and the write strategy used (managed-block vs full-file). `core.Apply` collects `Change`s so a mid-plan failure rolls the whole plan back.

### Per-harness matrix

| Harness | Detection signal | MCP config (format) | Skill/commands target | Agents | Supports |
|---|---|---|---|---|---|
| **Claude Code** | `~/.claude/` or project `.claude/`, `.mcp.json` | `.mcp.json` / `~/.claude.json` — **JSON**, `mcpServers` map | reads `skills/` + `commands/` natively (plugin path); CLI can also write project `.claude/skills/` | native **sub-agents** (`.claude/agents/*.md`) | Skill+Commands, MCP, **Agents**, DesignMemory |
| **Cursor** | `~/.cursor/` / `.cursor/` | `.cursor/mcp.json` — **JSON**, `mcpServers` map | `.cursor/skills/…` (mirror) | no first-class sub-agent format → **agents skipped** | Skill+Commands, MCP, DesignMemory |
| **Codex** | `~/.codex/` / `AGENTS.md` present | `~/.codex/config.toml` — **TOML**, `[mcp_servers.<name>]` table | **file-based `AGENTS.md`** (managed block); no marketplace | no native sub-agents → **agents skipped** | Skill+Commands (via AGENTS.md), MCP, DesignMemory |
| **Gemini** | `~/.gemini/` / `.gemini/` | `.gemini/settings.json` — **JSON**, `mcpServers` map | `.gemini/skills/…` (mirror) | no native sub-agents → **agents skipped** | Skill+Commands, MCP, DesignMemory |
| **OpenCode** | `~/.config/opencode/` / `opencode.json(c)` | `opencode.json(c)` — **JSONC**, `mcp` map (`type: "local"`, `command: [...]`) | `.opencode/skills/…` (mirror) | OpenCode **agents** (`.opencode/agent/*.md` or `agent` config key) → **agents supported** | Skill+Commands, MCP, **Agents**, DesignMemory |

`Supports(c)` is the single source of truth: the TUI greys out unsupported components and `core.Plan` drops them with an explicit "skipped (channel limitation)" note rather than silently. This keeps the honest install matrix from VERSIONS.md (v0.34) accurate and machine-enforced.

> **Agents only where native sub-agents exist**: Claude Code and OpenCode get review agents; Cursor/Codex/Gemini get a documented "agents not available here" message. Matches proposal risk mitigation (ship MCP first, agents incrementally) — agents adapters can land per-harness without touching the core.

## Idempotency, Backup, Rollback

**Two write strategies, chosen per file:**

1. **Managed-block** (`config/mdblock.go`, `config/markers.go`) — for files the user co-owns (Codex `AGENTS.md`, any markdown the user also edits). We wrap our content between
   `<!-- BEGIN ui-craft (managed — v0.x, do not edit) -->` … `<!-- END ui-craft -->`.
   Re-running replaces only the block; content outside is untouched. The block carries a content hash so `update` knows whether a rewrite is needed (idempotent no-op when unchanged).
2. **Full-file ownership** — for mirror dirs the CLI alone owns (`.cursor/skills/ui-craft/…`). Re-running overwrites deterministically; idempotent because the embedded mirror is the single source.
3. **Structured merge** — for shared structured configs (MCP JSON/TOML/JSONC). We parse, deep-merge our one server key, re-serialize preserving the user's other keys/servers. Never a blind overwrite. (See MCP wiring.)

**Backup** (`backup/store.go`): before any write in `core.Apply`, snapshot every target file. Layout:

```
<config-root>/.ui-craft-backups/<ISO8601-timestamp>/
  manifest.json                 # {binaryVersion, mirrorVersion, files:[{harness, origPath, savedPath, existedBefore}]}
  files/<harness>/<original-relative-path>
```

`existedBefore:false` records files we created so rollback can *delete* them (not just restore). Default backup root is per-user (`~/.ui-craft-backups/…`) with a project-local fallback when running scoped to a repo. `ui-craft backup` can be run standalone (snapshot without installing).

**Rollback** (`cmd/rollback.go`): pick a snapshot (latest by default, `--at <timestamp>` to choose), restore each file's bytes, delete files marked `existedBefore:false`. `core.Apply` calls the same restore path automatically if any write in the plan fails — the whole install is transactional, so a partial wiring never lands.

## MCP Wiring (merge, never clobber)

The highest-value cross-harness win. For each harness selecting MCP gates, `WriteMCP` injects exactly one server:

```jsonc
"ui-craft": { "command": "npx", "args": ["-y", "ui-craft-mcp"] }
```

(Codex TOML equivalent: `[mcp_servers.ui-craft]\ncommand = "npx"\nargs = ["-y", "ui-craft-mcp"]`; OpenCode: `"ui-craft": { "type": "local", "command": ["npx","-y","ui-craft-mcp"] }`.)

Algorithm (`config/jsonmerge.go` / `tomlmerge.go`):
1. Read existing config; if absent, start from `{}` (preserve file mode if present).
2. Parse into a generic map (JSONC: strip comments for parse, but we re-emit our key without destroying the file when the format library supports comment-preserving edits; otherwise we write the minimal canonical form and note it).
3. Set only `mcpServers["ui-craft"]` (or harness-specific path) — leave every other server and top-level key byte-for-identical where the encoder allows.
4. Atomic write (temp + rename).

Idempotent: re-running yields the same single key. We never read, transform, or proxy the user's other MCP servers — we only add ours. This matches the v0.34 model where `npx ui-craft-mcp` brings the four deterministic gates (`check_anti_slop`, `tokens_lint`, `acceptance_bar`, `score_ui`) online with no design logic in Go.

## Build & Distribution Pipeline

**Language boundary at build time:** `sync-harnesses.mjs` runs as a **build/CI step** (not at install time, per proposal), generating the harness mirrors. A CI step copies that output into `cli/assets/mirrors/` immediately before `go build`, so `go:embed` captures the freshly generated mirrors plus the `.ui-craft/` templates and Aren art. The binary therefore always ships mirrors matching its version.

```
CI release job:
  1. npm ci && node scripts/sync-harnesses.mjs        # generate mirrors
  2. cp -r .codex .cursor .gemini .opencode .agents  → cli/assets/mirrors/<harness>/
     cp .ui-craft scaffold templates                  → cli/assets/templates/
  3. GOOS/GOARCH matrix build (below), embedding via go:embed
  4. checksums + archives → GitHub Release
  5. update Homebrew tap formula + Scoop bucket manifest (sha + version)
```

**Cross-compile matrix:** `darwin/{amd64,arm64}`, `linux/{amd64,arm64}`, `windows/{amd64,arm64}` — 6 static binaries (CGO disabled; `go:embed` keeps assets in-binary so no runtime asset path). Built with `goreleaser` (or a Makefile + `gh release`), which also produces the archives and checksums in one pass.

**Distribution channels:**
- **Homebrew tap** — `educlopez/homebrew-ui-craft` formula pointing at the GitHub Release tarball (per-arch bottle or simple binary formula). `brew install educlopez/ui-craft/ui-craft`.
- **Scoop bucket** — `educlopez/scoop-ui-craft` JSON manifest for Windows. `scoop install ui-craft`.
- **`curl | sh`** — *deferred.* gentle-ai ships pure goreleaser (Homebrew + Scoop) with no install.sh, and that covers macOS/Linux/Windows. Add a `curl | sh` later only if there's demand for a no-package-manager path. (Removes a maintenance surface for v1.)

**Versioning/release:** tie into the existing **VERSIONS.md** auto-release flow as a **new release surface**, not a separate scheme. The Go binary version == the repo version that generated its embedded mirrors (single version line, no drift). `goreleaser` reads the tag; the VERSIONS.md entry documents the CLI release alongside skill/plugin/MCP changes — one coordinated release, three artifacts (plugin, `ui-craft-mcp`, `ui-craft` binary).

## Boundary (Go vs JS) — hard line

| Concern | Owner | How invoked |
|---|---|---|
| Install / config wiring / TUI | **Go** (`cli/`) | the binary |
| Skill + command content | **JS/markdown** | embedded as pre-generated **mirrors** (assets), copied to disk; never parsed for logic |
| MCP gates (`detect`, `score`, acceptance) | **JS** (`ui-craft-mcp`) | wired as `npx -y ui-craft-mcp`; run by the harness, not by Go |
| `detect.mjs` / `score.mjs` | **JS** | reached only through `ui-craft-mcp` / `npx ui-craft-detect` |
| Mirror generation | **JS** (`sync-harnesses.mjs`) | build-time only; feeds `go:embed` |

Go never embeds JS *logic* and never executes design rules. It only moves files and edits config. If a feature needs design logic, it belongs in JS behind the MCP/CLI, not in the binary.

## Design-Memory Loading Contract

`.ui-craft/` is scaffolded by the CLI from `assets/templates/` and read by the **skill** (markdown only — no memory product):

```
.ui-craft/
  brief.md        # always-loaded: product/audience/voice/constraints
  tokens.md       # always-loaded: color/type/spacing/radius tokens
  decisions.md    # lazy: date-stamped decision log (append-only)
  patterns.md     # lazy: reusable component/layout patterns
  surfaces/
    <name>.md     # lazy: per-surface notes (dashboard, auth, landing…)
```

**Contract the skill follows** (documented in SKILL.md, enforced by convention not code):
- **Always load** `brief.md` + `tokens.md` on any UI work — they are small and define the project's taste/tokens.
- **Lazy load** `decisions.md`, `patterns.md`, and `surfaces/<name>.md` *only* when the current task touches that surface or needs prior rationale — keeps context small.
- All files are plain markdown with stable headings so the skill can grep sections; `decisions.md` is append-only and date-stamped (`## YYYY-MM-DD — <decision>`). The `/remember` command appends here.

This formalizes the proposal's typed-memory evolution of `brief.md` and answers the open question "exact always-load vs lazy boundary." *(Spec feedback: codify the always/lazy split as an acceptance scenario in `design-memory` spec.)*

## Key Architecture Decisions (ADR-style)

**ADR-1 — Ports & Adapters with a single `Harness` interface.**
*Decision:* one `Harness` port, one adapter per tool; `Supports(component)` gates capability.
*Rationale:* harnesses differ only in *where* and *what format*; the install algorithm is shared. New harness = one file, no core change. Agents can land per-harness incrementally (proposal mitigation).
*Rejected:* per-harness command subtrees (duplicated logic, drift); a config DSL (overkill for ~5 targets).

**ADR-2 — TUI builds the same `InstallPlan` as non-interactive mode.**
*Decision:* Bubble Tea never writes; it produces a plan applied by the identical `core.Apply` path as `--yes`.
*Rationale:* scriptable (CI / `curl | sh`) and interactive installs can't diverge; one tested write path.
*Rejected:* TUI-driven direct writes (untestable, divergent behavior).

**ADR-3 — Embedded pre-generated mirrors, not runtime `sync-harnesses.mjs`.**
*Decision:* CI runs `sync-harnesses.mjs`, copies output into `assets/mirrors/`, `go:embed` captures it.
*Rationale:* zero Node dependency at install time; mirror version always matches binary; offline installs work.
*Rejected:* running Node at install (fragile, requires Node on user machine); vendoring JS into Go (violates boundary).

**ADR-4 — Mixed idempotency strategy (managed-block + full-file + structured merge).**
*Decision:* pick strategy per file ownership.
*Rationale:* shared files (MCP JSON, AGENTS.md) must preserve user content → merge/block; CLI-owned mirror dirs → full overwrite is simplest and safe.
*Rejected:* full-file ownership everywhere (would clobber user MCP servers); managed-blocks everywhere (can't block-wrap a JSON map cleanly).

**ADR-5 — Transactional apply with automatic rollback.**
*Decision:* snapshot all targets, apply, auto-rollback on any failure.
*Rationale:* a half-wired harness is worse than none; satisfies the proposal rollback plan and idempotency success criterion.
*Tradeoff:* every install does a backup pass (cheap; small text files).

**ADR-6 — One coordinated version across plugin / MCP / binary.**
*Decision:* binary version == repo version that generated its embedded mirrors; documented in VERSIONS.md.
*Rationale:* prevents mirror/binary drift; users reason about one version.
*Rejected:* independent CLI semver (drift risk, the open question that motivated this).

**ADR-7 — Bubble Tea owns the prompt flow (drop `@clack/prompts`).**
*Decision:* the JS-era `@clack/prompts` intro is replaced by Bubble Tea + lipgloss ANSI splash.
*Rationale:* Go binary can't call a JS prompt lib; Charm is the native equivalent.
*Spec impact:* update `cli-launch-experience` spec wording from `@clack/prompts` to Bubble Tea.

## Open Technical Risks

1. ~~**Comment-preserving edits of JSONC/TOML**~~ **RESOLVED** — adopt gentle-ai's hand-rolled line-oriented `filemerge` (strip-comments-before-parse for JSONC, line upsert for TOML/YAML, `__replace__` sentinel). No external parser lib needed. See Reference Implementation §1.
2. **Harness config-path variance across OS/versions.** Paths differ (macOS vs Linux vs Windows; global vs project). *Mitigation:* `Detect()` returns the discovered path; never hardcode; test fixtures per OS.
3. **Agent format mapping** for Claude Code vs OpenCode sub-agents (frontmatter, naming). *Mitigation:* agents are opt-in and per-adapter; ship MCP+skill first.
4. **Homebrew/Scoop repo ownership & release automation** (proposal open question). Needs two new repos and tap/bucket publish steps in CI. *Mitigation:* start with `curl | sh` + direct release downloads; add tap/bucket once binary stabilizes.
5. **`go:embed` mirror freshness depends on CI ordering.** If `go build` runs before `sync-harnesses.mjs`, stale mirrors ship. *Mitigation:* single release job with explicit ordered steps + a build-time assertion that `assets/mirrors/` is non-empty and version-stamped.

## Reference Implementation — gentle-ai (MIT, Go) — CONCRETE ADOPTIONS

gentle-ai (MIT, Go, 15 harnesses) has already solved every open risk here. We adapt its code with attribution — NOT a fork or dependency. Studied solutions, per area:

**1. Config edits preserving user content — RESOLVES our biggest risk, no external libs.**
gentle-ai's `internal/components/filemerge/` is hand-rolled line-oriented merging — **no JSONC/TOML parser libraries**:
- `json_merge.go` — `MergeJSONObjects(base, overlay)` deep-merge; strips `//` `/* */` comments + trailing commas before `json.Unmarshal` (full JSONC, no lib); on malformed base falls back to `{}` (never blocks install); `{"__replace__": …}` sentinel forces atomic subtree replace (for updating our own server entry).
- `toml.go` — `UpsertCodexMCPServerBlock` etc., pure string/line ops (no `go-toml`).
- `yaml.go` — `UpsertYAMLMCPServerBlock`, preserves trailing `# comments`.
- `section.go` — markdown managed-block inject with orphan-marker repair.
- `writer.go` — `WriteFileAtomic`: temp → chmod → fsync → rename, byte-compare skip if identical.
→ **Adopt:** copy these into `cli/internal/filemerge/`. This replaces the design's earlier "AST lib or canonical+warn" — the line-merge approach is the proven answer.

**2. Per-harness paths (from their adapters) — use to correct our matrix:**
| Harness | Detect | MCP config | Skills dir |
|---|---|---|---|
| Claude | `claude` on PATH | `~/.claude/mcp/<name>.json` (separate file per server) | `~/.claude/skills` |
| Cursor | `~/.cursor` dir (no binary) | `~/.cursor/mcp.json` | `~/.cursor/skills` |
| Codex | `codex` on PATH | `~/.codex/config.toml` (TOML) | `~/.codex/skills` |
| Gemini | `gemini` on PATH | `~/.gemini/settings.json` (merge) | `~/.gemini/skills` |
| OpenCode | `opencode` on PATH | `~/.config/opencode/opencode.json` (merge) | `~/.config/opencode/skills` |
Detection wraps `exec.LookPath`/`os.Stat` in package vars for test injection; Windows uses `%APPDATA%`.

**3. MCP registration = a strategy enum dispatcher** (`internal/components/mcp/inject.go`): `SeparateFiles` (Claude), `ConfigFile` (Cursor), `MergeIntoSettings` (Gemini/OpenCode), `TOMLFile` (Codex). 5 harnesses → 3 strategies. Replaces our generic `WriteMCP` with a proven dispatch.

**4. Backup/rollback = adopt 1:1** (upgrades our design): `<root>/<timestamp-id>/{manifest.json, snapshot.tar.gz}`; manifest carries `{Source, Checksum, Pinned, CreatedByVersion}`; SHA-256 composite dedup (`IsDuplicate` vs latest); retention = keep 5 unpinned; restore validates every path is under `$HOME` (symlink-resolved). Use tar.gz + dedup + pinning, not the flat dir the design first sketched.

**5. TUI/splash:** braille-Unicode logo as `[]string`, rendered per-row through `lipgloss` with 5 gradient color bands (no raw ANSI in the art); `Screen`-enum router. → adapt the rose art to **Aren**, same gradient-band + FrameStyle (DoubleBorder) pattern.

**6. Release = goreleaser only, NO install.sh:** `CGO_ENABLED=0`, darwin/linux/windows × amd64/arm64, tar.gz/zip archives, Homebrew tap + Scoop bucket from ONE `HOMEBREW_TAP_TOKEN`, version via `-X main.version` ldflags. → **drop the design's `install.sh`** — goreleaser+tap+bucket covers it.

**7. Idempotency:** `~/.ui-craft/state.json` persists choices for `update` replay; `WriteFileAtomic` byte-compare; `Prepare→Apply→Rollback` runner (= our transactional apply). Merge never overwrites whole files; `__replace__` only for keys we own.

**Reusable libs:** charmbracelet `bubbletea` v1.3.10 / `lipgloss` v1.1.0 / `bubbles` v1.0.0, `rivo/uniseg`, `mattn/go-isatty`. **Stdlib only for JSON/TOML/YAML** (their filemerge).

**Gotchas they already hit (bake into apply, don't rediscover):**
1. Windows: `Sync()` on a directory → `ACCESS_DENIED`; tolerate `ErrPermission` on Windows only.
2. Malformed user JSON → fall back to `{}`, don't abort.
3. Orphan markdown markers from prior buggy runs → repair before inject.
4. TOML: Windows paths need `\` → `\\` (else `\U` parse error).
5. Zero-file backup dedup via SHA of empty string.
6. Cursor: no PATH binary → detect by `~/.cursor` dir; no auto-install.
7. Codex/Gemini global npm may need `sudo` unless nvm/fnm/volta detected.
8. YAML inline `mcp_servers: {}` → normalize before upsert.
9. npm installs: `--ignore-scripts` + pinned versions (supply-chain).

MIT-attributable copy targets: `internal/components/filemerge/`, `internal/backup/`, `internal/system/detect.go`, `internal/tui/styles/logo.go`. (Memory/persona internals explicitly NOT studied or used — design memory stays native markdown.)

## Recommended Task-Breakdown Seams (slices)

Designed so MCP wiring (highest value) ships first and agents land incrementally. Each slice is independently shippable and stays well under a large-PR budget.

1. **CLI skeleton + boundary** — `cli/` module, Cobra root, `fsutil` (real + in-memory fs), `assets` embed plumbing (with a placeholder mirror), `version`. No harness logic yet. *(Foundations; unblocks everything.)*
2. **Harness port + detection** — `Harness` interface, `registry`, `Detect()` for all five, `core.detect`, `cmd` printing detected harnesses. No writes.
3. **Backup/rollback core** — `backup/store`, transactional `core.Apply` shell, `backup`/`rollback` commands. (Lands before any writer so every write is protected.)
4. **MCP wiring (the headline)** — `config/jsonmerge` + `tomlmerge`, `WriteMCP` for all supporting harnesses, structured-merge idempotency. *Maps to success criterion: one install wires MCP into a non-Claude harness end-to-end.*
5. **Skill+commands writer** — embed real mirrors via CI step, `WriteSkill` (full-file + AGENTS.md managed-block for Codex), `sync-harnesses.mjs` → `go:embed` build wiring.
6. **Design-memory scaffold** — `.ui-craft/` templates, scaffold command, loading-contract documentation in SKILL.md.
7. **TUI + Aren splash** — Bubble Tea app, splash, multiselect, progress; routes through the same `core.Plan`/`Apply`.
8. **Review agents** — `WriteAgents` for Claude Code, then OpenCode; capability-gated, opt-in.
9. **Build & distribution** — goreleaser matrix, `install.sh`, Homebrew tap, Scoop bucket, VERSIONS.md release integration.
10. **`update` lifecycle + Claude Code parity** — `update` (re-apply at new version, preserve user edits), verify CLI install matches today's plugin experience.

## Spec Feedback (flag back to spec authors)

- `cli-launch-experience`: replace `@clack/prompts` with **Bubble Tea + lipgloss** (Go has no JS prompt lib). ADR-7.
- `harness-wiring`: encode `Supports(component)` as the source of truth for the honest install matrix — add scenarios asserting Cursor/Codex/Gemini correctly *skip* agents, and that MCP merge preserves a pre-existing user server.
- `design-memory`: add an acceptance scenario for the always-load (brief+tokens) vs lazy-load (decisions/patterns/surfaces) contract.
- `cli-installer`: add a transactional-rollback scenario (mid-plan failure restores all files, deletes created files).
