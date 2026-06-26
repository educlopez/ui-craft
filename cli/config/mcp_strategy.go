package config

import "github.com/educlopez/ui-craft/cli/harness"

// StrategyFor returns the WriteStrategy that the given harness uses for its
// MCP config file. This is the single dispatcher that maps a harness name to
// the merge algorithm chosen in the design.
//
// Strategy reference (Reference Implementation §3):
//   - SeparateFiles  → Claude Code  (one standalone JSON file per server)
//   - ConfigFile     → Cursor       (merge into shared mcp.json)
//   - MergeIntoSettings → Gemini / OpenCode (merge into the harness's main settings)
//   - TOMLFile       → Codex        (upsert [mcp_servers.<name>] block)
func StrategyFor(h harness.Harness) harness.WriteStrategy {
	switch h.Name() {
	case "claude":
		return harness.SeparateFiles
	case "cursor":
		return harness.ConfigFile
	case "gemini", "opencode":
		return harness.MergeIntoSettings
	case "codex":
		return harness.TOMLFile
	default:
		return harness.ConfigFile
	}
}
