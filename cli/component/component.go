// Package component defines the Component enum representing installable
// ui-craft features that can be wired into an AI coding harness.
package component

// Component identifies a single installable capability.
type Component int

const (
	// SkillCommands is the pre-generated skill/commands mirror for the harness.
	SkillCommands Component = iota
	// MCPGates wires the ui-craft MCP server into the harness MCP config.
	MCPGates
	// ReviewAgents installs review sub-agent definitions (Claude Code + OpenCode only).
	ReviewAgents
	// DesignMemory scaffolds the .ui-craft/ design-memory directory.
	DesignMemory
)

// String returns the canonical lowercase name of the component.
func (c Component) String() string {
	switch c {
	case SkillCommands:
		return "skill+commands"
	case MCPGates:
		return "mcp-gates"
	case ReviewAgents:
		return "review-agents"
	case DesignMemory:
		return "design-memory"
	default:
		return "unknown"
	}
}

// All returns all defined components in a stable order.
func All() []Component {
	return []Component{SkillCommands, MCPGates, ReviewAgents, DesignMemory}
}
