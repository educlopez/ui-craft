# Tasks: v1-cli-system

> Generated 2026-06-25. Reads design.md (10 slices + Reference Implementation), specs
> cli-installer, harness-wiring, design-memory, cli-launch-experience.
>
> Each slice is its own PR boundary. Slices are sequential (each unblocks the next),
> except where noted. Tasks inside a slice may be parallelised at the author's discretion.

---

## Slice 1 — CLI Skeleton + Boundary

**PR boundary:** `feat: cli/ Go module scaffold, Cobra root, fsutil, assets embed plumbing`
**Satisfies:** cli-installer (binary exists, version flag, exit-code contract), proposal (Go static binary)
**Gentle-ai adoptions:** `fsutil/fs.go` interface pattern (real + in-memory); `WriteFileAtomic` signature from `internal/components/filemerge/writer.go` (adapt, do not copy yet — the real copy lands in Slice 4)
**Gotchas:** #5 (zero-file embed assertions must guard against empty `assets/mirrors/` at build time); #1 (Windows `Sync()` error tolerance must be wired into atomic write from day one)

- [x] Create `cli/go.mod` with module `github.com/educlopez/ui-craft/cli`; pin bubbletea v1.3.10, lipgloss v1.1.0, bubbles v1.0.0, rivo/uniseg, mattn/go-isatty, cobra (latest stable). Add `go.sum`. **Note: Charm libs deferred to Slice 7 as instructed; cobra v1.10.2 added.**
- [x] `cli/main.go` — wires `cmd.Execute()`; no logic.
- [x] `cli/cmd/root.go` — Cobra root command; persistent flags: `--harness`, `--components`, `--yes`, `--dry-run`, `--dir`; sets `SilenceUsage` on error.
- [x] `cli/cmd/version.go` — `ui-craft version`; reads `main.version` (ldflags) + embedded `assets/mirrors/VERSION` stamp; suppresses splash; exits 0.
- [x] `cli/fsutil/fs.go` — `FileSystem` interface: `ReadFile`, `WriteFile`, `MkdirAll`, `Stat`, `Remove`, `Open`; concrete `OsFS` implementation backed by `os` stdlib.
- [x] `cli/fsutil/memfs.go` — in-memory `MemFS` for unit tests; must satisfy same interface.
- [x] `cli/fsutil/atomic.go` — `WriteFileAtomic(fs FileSystem, path string, data []byte, perm os.FileMode) error`; temp-file + chmod + fsync (tolerate `ErrPermission` on `Sync` when `runtime.GOOS == "windows"`) + rename. Wire byte-compare early exit.
- [x] `cli/assets/embed.go` — `//go:embed mirrors/ templates/ art/` declarations; expose typed accessors `MirrorFS()`, `TemplateFS()`, `ArtFS()`; add build-time guard: `init()` panics if `mirrors/` subtree is empty (catches stale CI ordering, gotcha #5). **Guard is a seam/TODO; dormant until Slice 5 populates real mirrors.**
- [x] Add placeholder `cli/assets/mirrors/.gitkeep`, `cli/assets/templates/.gitkeep`, `cli/assets/art/.gitkeep` so `go:embed` compiles without CI mirrors present.
- [x] `cli/cmd/install.go` stub — `detect → plan → apply` skeleton; detect and plan return empty results; apply is a no-op. Wires the path that later slices fill in.
- [x] Add `Makefile` targets: `make build` (single arch, development), `make test`, `make lint` (golangci-lint).
- [x] `cli/` passes `go build ./...` and `go test ./...` — **22 tests passing** across fsutil, cmd, and assets packages.

---

## Slice 2 — Harness Port + Detection

**PR boundary:** `feat: Harness interface, registry, Detect() for all 5 harnesses`
**Satisfies:** cli-installer (Harness Detection requirement + all 3 scenarios), harness-wiring (Supports() matrix, graceful skip)
**Gentle-ai adoptions:** `internal/system/detect.go` PATH-lookup + `os.Stat` pattern; per-harness path table from Reference Implementation §2; Windows `%APPDATA%` expansion
**Gotchas:** #6 (Cursor — no PATH binary; detect by `~/.cursor` dir only); #2 (OS/version path variance — always return discovered path, never hardcode)

- [ ] `cli/harness/harness.go` — define `Component` int enum (`SkillCommands=0`, `MCPGates`, `ReviewAgents`, `DesignMemory`); `DetectResult` struct (`Installed bool`, `ConfigRoot string`, `BinaryPath string`); `ConfigPaths` struct; `Change` struct (`FilePath`, `PriorBytes []byte`, `ExistedBefore bool`, `Strategy WriteStrategy`); `Harness` interface (all methods from design.md).
- [ ] `cli/harness/registry.go` — ordered `[]Harness` slice; `Register()` + `All()` accessors.
- [ ] `cli/harness/claude.go` — `ClaudeHarness`; detects `~/.claude/` dir OR `claude` on PATH; `ConfigPaths` returns `~/.claude/mcp/ui-craft.json`, `~/.claude/skills/`, `~/.claude/agents/`; `Supports(ReviewAgents)=true`, `Supports(DesignMemory)=true`, all others true; Windows uses `%APPDATA%\Claude` expansion.
- [ ] `cli/harness/cursor.go` — `CursorHarness`; detects by `~/.cursor/` dir existence only (no binary, gotcha #6); `Supports(ReviewAgents)=false`; MCP path `~/.cursor/mcp.json`; skills `~/.cursor/skills/`.
- [ ] `cli/harness/codex.go` — `CodexHarness`; detects `codex` on PATH; `Supports(ReviewAgents)=false`; MCP path `~/.codex/config.toml`; skills written to `AGENTS.md` managed block (full-file for `~/.codex/skills/`).
- [ ] `cli/harness/gemini.go` — `GeminiHarness`; detects `gemini` on PATH; `Supports(ReviewAgents)=false`; MCP path `~/.gemini/settings.json`.
- [ ] `cli/harness/opencode.go` — `OpenCodeHarness`; detects `opencode` on PATH; `Supports(ReviewAgents)=true`; MCP path `~/.config/opencode/opencode.json`; agents `~/.config/opencode/agent/` (or project `.opencode/agent/`).
- [ ] `cli/core/detect.go` — `Detect(reg []Harness) ([]DetectResult, error)`; iterates registry; returns only installed harnesses; wraps `exec.LookPath`/`os.Stat` calls in test-injectable package vars.
- [ ] `cli/cmd/install.go` — update stub: call `core.Detect`, print detected harnesses; handle no-harness case (exit 1 + message naming all 5 supported harnesses).
- [ ] Unit tests: `TestDetect_allPresent`, `TestDetect_nonePresent`, `TestSupports_cursorSkipsAgents`, `TestSupports_codexSkipsAgents`, `TestSupports_geminiSkipsAgents`.

---

## Slice 3 — Backup / Rollback Core

**PR boundary:** `feat: backup store (tar.gz + manifest + dedup + retention) + transactional core.Apply shell`
**Satisfies:** cli-installer (Backup Before Write, Rollback Restores Prior Config, Transactional Install requirements + all scenarios)
**Gentle-ai adoptions:** `internal/backup/` — adopt 1:1: `<root>/<timestamp-id>/{manifest.json, snapshot.tar.gz}`; `{Source, Checksum, Pinned, CreatedByVersion}` manifest; SHA-256 composite dedup `IsDuplicate` vs latest; retention = keep 5 unpinned; `tar.gz` archive; symlink-safe restore; restore validates all paths under `$HOME`
**Gotchas:** #5 (dedup must handle zero-file case via SHA of empty string)

- [ ] `cli/backup/store.go` — `BackupStore` struct; `NewStore(root string, fs FileSystem)`; `Snapshot(targets []string, binaryVersion string) (SnapshotID, error)` — archives each file to `<root>/<ISO8601-timestamp-id>/snapshot.tar.gz`, writes `manifest.json` with `{Source, Checksum, ExistedBefore, Pinned, CreatedByVersion}`; skips files where `ExistedBefore=false` (records tombstone); calls `IsDuplicate` vs latest unpinned snapshot and returns existing ID if identical (gotcha #5 — SHA of empty content).
- [ ] `cli/backup/store.go` — `Restore(id SnapshotID) error` — extracts `snapshot.tar.gz`; deletes files where `ExistedBefore=false`; validates every restore target is under `filepath.EvalSymlinks(os.UserHomeDir())` before writing.
- [ ] `cli/backup/store.go` — `Prune(keep int)` — delete oldest unpinned snapshots beyond `keep=5`; never delete pinned.
- [ ] `cli/backup/store.go` — `Pin(id SnapshotID)` / `Unpin(id SnapshotID)` accessors.
- [ ] `cli/backup/store.go` — `List() ([]SnapshotMeta, error)` for rollback command display.
- [ ] `cli/core/apply.go` — `Apply(plan InstallPlan, fs FileSystem, store BackupStore) error`; phases: (1) `Prepare` = call `Snapshot` on all plan targets; (2) `Apply` = iterate writes, collecting `Change` records; (3) on any error call `Restore(snapshotID)` and return wrapped error naming which target failed (cli-installer transactional scenario); (4) on success call `Prune(5)`.
- [ ] `cli/core/plan.go` — `InstallPlan` struct: `[]ComponentTarget{Harness, Component, WriterOp}`; `Plan(detected []DetectResult, selected []Component) InstallPlan`; marks each target as `Skip` when `Supports()` returns false, with a skip reason string.
- [ ] `cli/cmd/backup.go` — `ui-craft backup [--harness X]` — standalone snapshot (no install); calls `core.Detect` + `store.Snapshot`; prints snapshot ID.
- [ ] `cli/cmd/rollback.go` — `ui-craft rollback {harness} [--at <timestamp>]`; `--at` defaults to latest; calls `store.Restore`; prints restored paths; exits 1 with "No backup found" if store is empty (cli-installer rollback scenario).
- [ ] Unit tests: `TestSnapshot_roundtrip`, `TestRestore_deletesNewFiles` (ExistedBefore=false), `TestIsDuplicate_emptyContent`, `TestApply_midPlanRollback` (mock writer that fails on 2nd target), `TestPrune_keepsMax5`.

---

## Slice 4 — MCP Wiring (Headline Feature)

**PR boundary:** `feat: MCP wiring — merge-not-clobber for all 5 harnesses`
**Satisfies:** harness-wiring (MCP Gates Wiring requirement + all 5 scenarios including merge-not-clobber), cli-installer (Idempotent Install)
**Gentle-ai adoptions:** `internal/components/filemerge/json_merge.go` — `MergeJSONObjects`, JSONC strip-comments-before-parse, `__replace__` sentinel, malformed-base fallback to `{}`; `toml.go` — `UpsertCodexMCPServerBlock` line-upsert (no go-toml); `yaml.go` — `UpsertYAMLMCPServerBlock`; `writer.go` — `WriteFileAtomic` (full copy); `section.go` — orphan-marker repair. Copy into `cli/internal/filemerge/` with MIT attribution header.
**Gotchas:** #2 (malformed user JSON → fall back to `{}`); #3 (orphan markdown markers — repair before inject); #4 (TOML Windows paths — `\\` escape); #8 (YAML inline `mcp_servers: {}` — normalize before upsert); #9 (npm `--ignore-scripts` + pinned versions note in generated config)

- [ ] `cli/internal/filemerge/` — copy and adapt gentle-ai's `json_merge.go`, `toml.go`, `yaml.go`, `section.go`, `writer.go`; add MIT attribution comment block at top of each file: `// Adapted from github.com/anthropics/gentle-ai (MIT). Original: internal/components/filemerge/<file>.go`.
- [ ] `cli/internal/filemerge/json_merge.go` — validate: `MergeJSONObjects(base, overlay []byte) ([]byte, error)`; strips `//` and `/* */` comments + trailing commas; falls back to `{}` on malformed base (gotcha #2); `__replace__` sentinel support.
- [ ] `cli/internal/filemerge/toml.go` — `UpsertCodexMCPServerBlock(content, serverName string, entry map[string]any) (string, error)`; pure string line-ops; Windows path `\\` escape (gotcha #4).
- [ ] `cli/internal/filemerge/yaml.go` — `UpsertYAMLMCPServerBlock`; normalize inline `{}` before upsert (gotcha #8).
- [ ] `cli/internal/filemerge/section.go` — managed-block `BEGIN/END ui-craft` inject; orphan-marker repair before inject (gotcha #3); block content hash.
- [ ] `cli/config/markers.go` — `BeginMarker`, `EndMarker` constants; `BlockHash(content string) string` (SHA-256 hex prefix).
- [ ] `cli/config/mcp_strategy.go` — `WriteStrategy` enum: `SeparateFiles`, `ConfigFile`, `MergeIntoSettings`, `TOMLFile`; `StrategyFor(h Harness) WriteStrategy` dispatcher.
- [ ] `cli/harness/claude.go` — implement `WriteMCP`: strategy `SeparateFiles`; creates `~/.claude/mcp/ui-craft.json` as a standalone file `{"ui-craft": {"command":"npx","args":["-y","ui-craft-mcp"]}}` (harness-wiring Claude scenario); uses `WriteFileAtomic`; idempotent: byte-compare skips write if identical.
- [ ] `cli/harness/cursor.go` — implement `WriteMCP`: strategy `ConfigFile`; read `~/.cursor/mcp.json`, `MergeJSONObjects` with `{"mcpServers":{"ui-craft":{...}}}` overlay; preserve existing servers (merge-not-clobber scenario); atomic write.
- [ ] `cli/harness/codex.go` — implement `WriteMCP`: strategy `TOMLFile`; `UpsertCodexMCPServerBlock` into `~/.codex/config.toml`; preserve all other TOML keys; atomic write.
- [ ] `cli/harness/gemini.go` — implement `WriteMCP`: strategy `MergeIntoSettings`; merge `{"mcpServers":{"ui-craft":{...}}}` into `~/.gemini/settings.json`; preserve all other keys.
- [ ] `cli/harness/opencode.go` — implement `WriteMCP`: strategy `MergeIntoSettings` with JSONC; strip comments before parse; inject `"ui-craft": {"type":"local","command":["npx","-y","ui-craft-mcp"]}` under `mcp` key.
- [ ] `cli/cmd/install.go` — wire MCP writes into `core.Apply`; print per-harness MCP result (configured / already configured / skipped).
- [ ] Integration test (in-memory FS): `TestWriteMCP_cursorPreservesExistingServer`, `TestWriteMCP_cursorIdempotent`, `TestWriteMCP_codexTOML`, `TestWriteMCP_geminiMerge`, `TestWriteMCP_opencodeJSONC`, `TestMergeJSON_malformedBase`.

---

## Slice 5 — Skill + Commands Writer

**PR boundary:** `feat: embed real harness mirrors via CI, WriteSkill for all harnesses`
**Satisfies:** harness-wiring (Skill+Commands Wiring, Codex File-Based Wiring, mirror-is-current idempotency scenario), cli-installer (Per-Component Update — skill update)
**Gentle-ai adoptions:** `section.go` managed-block for Codex `AGENTS.md`; `WriteFileAtomic` byte-compare for full-file ownership
**Gotchas:** #5 (CI build ordering — sync-harnesses.mjs MUST run before `go build`; `assets/embed.go` `init()` guard); #7 (Codex/Gemini global npm — note in output if no nvm/fnm/volta detected, do not block install)

- [ ] Update `.github/workflows/release.yml` (or add `Makefile` target): step 1 = `npm ci && node scripts/sync-harnesses.mjs`; step 2 = copy mirror output into `cli/assets/mirrors/<harness>/`; step 3 = `go build`. Gate order enforced; CI fails if mirrors empty.
- [ ] `cli/assets/mirrors/` — after CI step, populated with: `claude/`, `cursor/`, `codex/`, `gemini/`, `opencode/`; each contains the relevant skill/commands files. `VERSION` file with repo semver stamp.
- [ ] `cli/harness/claude.go` — implement `WriteSkill`: full-file ownership; write embedded mirror from `assets.MirrorFS()` to `~/.claude/skills/ui-craft/`; byte-compare idempotency (`already up-to-date`); uses `WriteFileAtomic`.
- [ ] `cli/harness/cursor.go` — implement `WriteSkill`: full-file ownership to `~/.cursor/skills/ui-craft/`; same byte-compare pattern.
- [ ] `cli/harness/gemini.go` — implement `WriteSkill`: full-file ownership to `~/.gemini/skills/ui-craft/`; detect global npm context (gotcha #7) and print advisory if `nvm`/`fnm`/`volta` not detected.
- [ ] `cli/harness/opencode.go` — implement `WriteSkill`: full-file ownership to `~/.config/opencode/skills/ui-craft/`.
- [ ] `cli/harness/codex.go` — implement `WriteSkill`: two targets: (a) full-file to `~/.codex/skills/ui-craft/`; (b) managed-block inject into project `AGENTS.md` (or global) using `section.go`; harness-wiring Codex scenario.
- [ ] `cli/cmd/update.go` — `ui-craft update {harness} [--component {name}]`; re-runs `WriteSkill` (and `WriteMCP` if component selected); backup taken before each write; cli-installer Per-Component Update scenarios.
- [ ] Unit tests (MemFS): `TestWriteSkill_idempotentWhenCurrent`, `TestWriteSkill_codexManagedBlock`, `TestWriteSkill_updateReplacesFile`, `TestBuildGuard_panicsOnEmptyMirrors`.

---

## Slice 6 — Design-Memory Scaffold

**PR boundary:** `feat: .ui-craft/ scaffold command + load-contract documentation`
**Satisfies:** design-memory spec (all requirements: Scaffold on Install, Always/Lazy loaded contract, File Schemas, Plain Markdown Only)
**Gentle-ai adoptions:** template embedding pattern from `assets/templates/`; atomic write for each scaffold file
**Gotchas:** none from the 9 (this slice is pure template + write)

- [ ] `cli/assets/templates/` — add actual template files: `brief.md` (sections: `# Project Brief`, `## Design Intent`, `## Audience`); `tokens.md` (`# Design Tokens`, `## Colors`, `## Typography`, `## Spacing`); `decisions.md` (`# Design Decisions` with a sample dated entry); `patterns.md` (`# Patterns`); `surfaces/example.md` (`# {Surface Name}`, `## Layout`, `## Components`, `## Notes`). Remove `.gitkeep`.
- [ ] `cli/component/catalog.go` — define `Component` metadata: `DesignMemory` entry with `Required=false`, `Recommended=true`; `SupportedBy: all harnesses`.
- [ ] `cli/harness/<all>.go` — implement `WriteDesignMemory(w FileSystem, projectDir string) (Change, error)` as a default method promoted via a shared helper in `cli/harness/scaffold.go`; checks each file with `Stat` before writing; skips existing files (`partial directory exists` scenario); reports `already scaffolded` when all files present.
- [ ] `cli/harness/scaffold.go` — `ScaffoldDesignMemory(fs FileSystem, templateFS fs.FS, projectDir string) ([]Change, error)`: iterate template files; `Stat` before each write; skip if exists; return per-file change records.
- [ ] Ensure `core.Apply` routes `DesignMemory` component targets through `ScaffoldDesignMemory`.
- [ ] Update SKILL.md load contract section: document always-load (`brief.md`, `tokens.md`) vs lazy-load (`decisions.md`, `patterns.md`, `surfaces/<name>.md`) boundary explicitly; note `.ui-craft/` absent = no-op (design-memory absent scenario).
- [ ] Unit tests (MemFS): `TestScaffold_firstTime`, `TestScaffold_partialExists`, `TestScaffold_fullyExists`, `TestScaffold_doesNotOverwrite`.

---

## Slice 7 — TUI + Aren Splash

**PR boundary:** `feat: Bubble Tea app — splash, detect, select, confirm, progress, done`
**Satisfies:** cli-launch-experience (all requirements: Brand Splash, No-Color Degradation, Interactive Prompt Flow, --yes flag)
**Gentle-ai adoptions:** `internal/tui/styles/logo.go` gradient-band pattern — adapt rose braille art to Aren dog; `Screen`-enum router; `FrameStyle(DoubleBorder)`; mattn/go-isatty for TTY check
**Gotchas:** #1 (Windows color — lipgloss/isatty handle this; test with NO_COLOR and TERM=dumb)

- [x] `cli/assets/art/aren.go` — Aren dog as `[]string` of braille/block rows (embed via `go:embed art/aren.txt`); adapt from gentle-ai logo `[]string` row pattern with 5 gradient color bands.
- [x] `cli/tui/styles.go` — lipgloss theme: single accent color (no rainbow); adaptive color for light/dark; `NO_COLOR` + `TERM=dumb` detection via `mattn/go-isatty` + `os.Getenv("NO_COLOR")`; export `AccentColor`, `MutedColor`, `ErrorColor`.
- [x] `cli/tui/splash.go` — `SplashModel` (Bubble Tea `Model`); renders Aren art through lipgloss gradient bands row-by-row; shows `ui-craft vX.Y.Z`; auto-advances to `DetectScreen` after render; degrades to plain ASCII when `NO_COLOR` or `TERM=dumb`.
- [x] `cli/tui/app.go` — `Screen` enum: `SplashScreen`, `DetectScreen`, `SelectHarnessScreen`, `SelectComponentScreen`, `ConfirmScreen`, `ApplyScreen`, `DoneScreen`; root `AppModel` with `Update`/`View` dispatch; suppress splash for non-interactive commands.
- [x] `cli/tui/select.go` — `HarnessSelectModel`: multi-select list (bubbles); pre-checks detected harnesses; single harness → skip directly to component screen (cli-installer single-harness scenario); `SelectComponentModel`: per-harness multi-select; greyed-out rows for unsupported components (`Supports()=false`); zero-selection guard ("Select at least one component").
- [x] `cli/tui/confirm.go` — `ConfirmModel`: renders harness × component plan table; Ctrl+C / Cancel → clean exit code 0 (cli-launch-experience cancel scenario). **[implemented in select.go]**
- [x] `cli/tui/progress.go` — `ProgressModel`: per-target spinner/status; streams `Change` results from `core.Apply`; shows skip notices for unsupported components.
- [x] `cli/cmd/install.go` — TTY detection: if no TTY and no `--yes` → exit 1 with "Interactive mode requires a TTY; use --yes to skip prompts" (non-TTY scenario); if `--yes` → bypass TUI, call `core.Plan` with defaults + `core.Apply` directly.
- [x] Manual test checklist (no automated UI test): splash with color, splash with `NO_COLOR=1`, splash with `TERM=dumb`, `--yes` in piped shell, Ctrl+C at confirm.
- [x] Unit tests: `TestAppModel_suppressSplashOnVersion`, `TestSelectComponent_greyOutUnsupported`, `TestSelectComponent_zeroSelectionRejected`.

---

## Slice 8 — Review Agents

**PR boundary:** `feat: WriteAgents for Claude Code and OpenCode (capability-gated, opt-in)`
**Satisfies:** harness-wiring (Review Agents Wiring requirement + all scenarios: Claude Code install, OpenCode install, Cursor/Codex/Gemini graceful skip)
**Gentle-ai adoptions:** `section.go` managed-block for agent markdown files; `WriteFileAtomic` for each agent definition
**Gotchas:** #3 (orphan marker repair before writing agent managed blocks)

- [x] `cli/assets/mirrors/claude/agents/` — add embedded review agent `.md` files for Claude Code sub-agent format (frontmatter: `name`, `description`, `tools`).
- [x] `cli/assets/mirrors/opencode/agent/` — add embedded review agent `.md` files for OpenCode agent format.
- [x] `cli/harness/claude.go` — implement `WriteAgents`: iterate `assets.Agent` slice; for each, write to `~/.claude/agents/<name>.md` using `WriteFileAtomic`; report each installed agent name; `Supports(ReviewAgents)=true`.
- [x] `cli/harness/opencode.go` — implement `WriteAgents`: write to `~/.config/opencode/agent/<name>.md` (or project `.opencode/agent/`); `Supports(ReviewAgents)=true`.
- [x] `cli/harness/cursor.go`, `codex.go`, `gemini.go` — `WriteAgents` returns `ErrUnsupported`; `core.Plan` maps this to a skip notice "review-agents: not supported for {harness} — skipped (no native sub-agent format)"; exit code 0 (graceful skip scenarios).
- [x] `cli/core/plan.go` — `Plan` emits explicit `SkippedTarget{Harness, Component, Reason}` for all `Supports()=false` combinations; these appear in confirm screen and final report.
- [x] Unit tests: `TestWriteAgents_claudeCode`, `TestWriteAgents_opencode`, `TestWriteAgents_cursorSkip`, `TestWriteAgents_codexSkip`, `TestWriteAgents_geminiSkip`.

---

## Slice 9 — Build & Distribution

**PR boundary:** `feat: goreleaser matrix, Homebrew tap, Scoop bucket, VERSIONS.md integration`
**Satisfies:** proposal (Go static binary, distribution channels, ONE coordinated version), design (ADR-6, ADR-3, goreleaser-only no install.sh)
**Gentle-ai adoptions:** goreleaser config pattern: `CGO_ENABLED=0`, darwin/linux/windows × amd64/arm64, `HOMEBREW_TAP_TOKEN` for tap + bucket, `-X main.version` ldflags, tar.gz/zip archives; NO `install.sh`
**Gotchas:** #5 (mirror freshness — CI ordering enforced; goreleaser runs after sync-harnesses step); #4 (Windows archive uses .zip; others use .tar.gz)

- [x] `.goreleaser.yaml` — matrix: `darwin/{amd64,arm64}`, `linux/{amd64,arm64}`, `windows/{amd64,arm64}`; `CGO_ENABLED: 0`; `ldflags: -X main.version={{.Version}} -X main.mirrorVersion={{.Env.MIRROR_VERSION}}`; archives: tar.gz for unix, zip for windows; checksum file; GitHub Release.
- [x] `.goreleaser.yaml` — Homebrew tap: `educlopez/homebrew-ui-craft` repo; formula `ui-craft`; `brew install educlopez/ui-craft/ui-craft`.
- [x] `.goreleaser.yaml` — Scoop bucket: `educlopez/scoop-ui-craft` repo; manifest `ui-craft`; `scoop install ui-craft`.
- [x] Create `educlopez/homebrew-ui-craft` repo skeleton (formula template); document in README. **[Eduardo must create the repo manually — see manual prereqs below]**
- [x] Create `educlopez/scoop-ui-craft` repo skeleton (bucket template); document in README. **[Eduardo must create the repo manually — see manual prereqs below]**
- [x] `.github/workflows/cli-release.yml` — full release job: (1) `npm ci && node scripts/sync-harnesses.mjs`; (2) copy mirrors into `cli/assets/mirrors/`; (3) set `MIRROR_VERSION` env from package.json version; (4) `goreleaser release`; requires `GITHUB_TOKEN` + `HOMEBREW_TAP_TOKEN`.
- [x] `cli/cmd/version.go` — surface both `main.version` and `main.mirrorVersion` in `ui-craft version` output; matches ADR-6 single coordinated version.
- [ ] `VERSIONS.md` — add CLI as a new release surface column/section alongside plugin and MCP; document that all three share the same repo semver tag. **[Deferred to Slice 10 release entry]**
- [x] CI smoke test job (post-release): download release binary, run `ui-craft version`, assert exit 0 and version string non-empty.

---

## Slice 10 — Update Lifecycle + Claude Code Parity

**PR boundary:** `feat: update state.json replay, parity verification, plugin-coexistence warning`
**Satisfies:** cli-installer (Per-Component Update scenarios, Claude Code Install Parity scenarios), harness-wiring (MCP idempotency), proposal (CLI does not conflict with existing plugin install)
**Gentle-ai adoptions:** `~/.ui-craft/state.json` persisted install choices for update replay; `Prepare→Apply→Rollback` runner continuity; `WriteFileAtomic` byte-compare for update no-op
**Gotchas:** #2 (malformed state.json → fall back to re-detect, don't abort); #5 (state.json version stamp — detect stale mirrors at update time)

- [ ] `cli/core/state.go` — `InstallState` struct: `{Version, MirrorVersion, Harnesses: [{Name, InstalledComponents: [], InstalledAt}]}`; `LoadState(fs FileSystem, dir string) (*InstallState, error)` — returns empty state on missing/malformed file (gotcha #2); `SaveState(...)` after successful apply.
- [ ] `cli/cmd/update.go` — full implementation: load `state.json`; determine installed components per harness; for each selected harness+component run `Write*` with byte-compare; backup before any write; update `state.json` on success; cli-installer Update scenarios.
- [ ] `cli/cmd/update.go` — `--component` flag filters to single component; no flag = all installed components for the harness (Update all components scenario).
- [ ] `cli/harness/claude.go` — detect existing native plugin: check for Claude Code plugin dir / plugin registry entry; if found, print "Native plugin detected — CLI install may overlap" and require `--force` or interactive confirmation before proceeding (cli-installer plugin-coexistence scenario).
- [ ] `cli/cmd/install.go` — enforce plugin-coexistence warning path; add `--force` flag to bypass.
- [ ] Parity check helper `cli/core/parity.go` — `VerifyClaudeCodeParity(fs FileSystem, state InstallState) []ParityIssue`; checks: skill present in skills dir, MCP entry in `~/.claude/mcp/ui-craft.json`, agents present (if installed); used in `ui-craft version --check-parity`.
- [ ] `cli/cmd/version.go` — `--check-parity` flag; runs `VerifyClaudeCodeParity`; prints PASS/FAIL per check; exit 0 if all pass, 1 if any fail (cli-installer parity scenario).
- [ ] Unit tests: `TestLoadState_missingFile`, `TestLoadState_malformedFallback`, `TestUpdate_preservesUserEditsOutsideManagedBlocks`, `TestParity_allChecksPass`, `TestParity_missingMCP`.

---

## Review Workload Forecast

| Dimension | Estimate |
|---|---|
| Total slices | 10 |
| Total tasks (checkboxes) | ~110 |
| Estimated new files | ~55 Go files + CI/goreleaser config + template assets |
| Estimated changed lines | ~4 500 – 6 000 (new `cli/` module is net-new; goreleaser + CI adds ~200; SKILL.md + VERSIONS.md ~50) |
| 400-line single-PR budget | **Exceeded by 10×** |
| Chained PRs recommended | **YES** |
| Suggested PR split | The 10 slices above are the natural split; each is independently reviewable and mergeable |
| Approximate lines per PR | Slice 1: ~300 / Slice 2: ~250 / Slice 3: ~400 / Slice 4: ~600 / Slice 5: ~400 / Slice 6: ~200 / Slice 7: ~500 / Slice 8: ~250 / Slice 9: ~200 / Slice 10: ~350 |
| 400-line budget risk per slice | Slice 4 (600 lines) and Slice 7 (500 lines) are the two over-budget slices; both are justified as self-contained features (filemerge library copy and TUI respectively) |
| Decision needed before apply | **YES** — confirm chain strategy (`stacked-to-main` vs `feature-branch-chain`) and whether Slices 4 and 7 get a `size:exception` or are split further |

### Recommended First Slice

**Slice 1 — CLI Skeleton + Boundary** is the mandatory first PR. It unblocks all other slices (they all depend on `fsutil`, `assets`, and `cmd` stubs). It is well within budget (~300 lines) and has no risk.

### Dependency Order (sequential — each slice depends on prior)

```
1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10
```

Slices 5 and 6 may be developed in parallel once Slice 4 is merged (they share no files). Slices 7 and 8 may be developed in parallel once Slice 5 is merged. Slice 9 requires Slice 5 (real mirrors must exist for the goreleaser embed to be non-empty). Slice 10 requires all prior slices.

---

## Gotcha Reference Index

| # | Gotcha | Slices that apply |
|---|---|---|
| 1 | Windows `Sync()` → `ACCESS_DENIED`; tolerate `ErrPermission` on Windows only | 1, 4, 7 |
| 2 | Malformed user JSON → fall back to `{}`, don't abort | 4, 10 |
| 3 | Orphan markdown markers → repair before inject | 4, 8 |
| 4 | TOML Windows paths → `\\` escape | 4, 9 |
| 5 | Zero-file backup dedup via SHA of empty string; mirror freshness CI ordering | 1, 3, 9, 10 |
| 6 | Cursor no PATH binary → detect by `~/.cursor` dir | 2 |
| 7 | Codex/Gemini global npm — detect nvm/fnm/volta, print advisory | 5 |
| 8 | YAML inline `mcp_servers: {}` → normalize before upsert | 4 |
| 9 | npm `--ignore-scripts` + pinned versions | 4 |
