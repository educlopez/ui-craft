package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/educlopez/ui-craft/cli/component"
	"github.com/educlopez/ui-craft/cli/core"
	"github.com/educlopez/ui-craft/cli/harness"
)

// HarnessSelectModel lets the user choose which detected harnesses to install
// into. Detected harnesses are pre-checked. When only one harness is detected,
// the screen is skipped automatically.
type HarnessSelectModel struct {
	harnesses []core.DetectedHarness
	cursor    int
	selected  map[int]bool
	confirmed bool
	// skipToComponents is true when there is only one harness.
	skipToComponents bool
}

// NewHarnessSelectModel creates a harness selection model from detected harnesses.
// All detected harnesses are pre-checked.
func NewHarnessSelectModel(detected []core.DetectedHarness) HarnessSelectModel {
	selected := make(map[int]bool, len(detected))
	for i := range detected {
		selected[i] = true // pre-check all detected harnesses
	}
	return HarnessSelectModel{
		harnesses:        detected,
		selected:         selected,
		skipToComponents: len(detected) == 1,
	}
}

// Init implements tea.Model.
func (m HarnessSelectModel) Init() tea.Cmd { return nil }

// Update handles keyboard navigation and selection.
func (m HarnessSelectModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.harnesses)-1 {
				m.cursor++
			}
		case " ":
			// Toggle selection.
			m.selected[m.cursor] = !m.selected[m.cursor]
		case "enter":
			m.confirmed = true
		}
	}
	return m, nil
}

// View renders the harness selection list.
func (m HarnessSelectModel) View() string {
	var sb strings.Builder
	sb.WriteString(titleStyle().Render("Select harnesses to install into:"))
	sb.WriteString("\n\n")

	for i, dh := range m.harnesses {
		cursor := "  "
		if i == m.cursor {
			cursor = "> "
		}
		check := "[ ]"
		if m.selected[i] {
			check = "[x]"
		}
		line := fmt.Sprintf("%s%s %s", cursor, check, dh.Harness.Name())
		if i == m.cursor {
			sb.WriteString(accentStyle().Render(line))
		} else {
			sb.WriteString(line)
		}
		sb.WriteByte('\n')
	}

	sb.WriteString("\n")
	sb.WriteString(mutedStyle().Render("space: toggle  enter: confirm  ctrl+c: cancel"))
	return sb.String()
}

// SelectedHarnesses returns only the harnesses that were checked.
func (m HarnessSelectModel) SelectedHarnesses() []core.DetectedHarness {
	var result []core.DetectedHarness
	for i, dh := range m.harnesses {
		if m.selected[i] {
			result = append(result, dh)
		}
	}
	return result
}

// IsConfirmed returns true when the user pressed Enter.
func (m HarnessSelectModel) IsConfirmed() bool { return m.confirmed }

// ShouldSkip returns true when there is only one harness (auto-advance).
func (m HarnessSelectModel) ShouldSkip() bool { return m.skipToComponents }

// ─── Component selection ───────────────────────────────────────────────────

// componentItem holds display info for a single component in the list.
type componentItem struct {
	comp      component.Component
	supported bool
	reason    string // why it is disabled (non-empty when !supported)
}

// SelectComponentModel lets the user choose which components to install for
// the selected harnesses. Unsupported components are shown greyed/disabled
// with a reason — never silently dropped (ADR-1: Supports() is the source of
// truth displayed here, not enforced silently).
type SelectComponentModel struct {
	harnesses []core.DetectedHarness
	items     []componentItem
	cursor    int
	selected  map[int]bool
	confirmed bool
	errMsg    string
}

// NewSelectComponentModel creates a component selection model from the
// selected harnesses. Recommended components (SkillCommands, MCPGates) are
// pre-checked; ReviewAgents and DesignMemory start unchecked.
// Components not supported by ANY selected harness are disabled with a reason.
func NewSelectComponentModel(harnesses []core.DetectedHarness) SelectComponentModel {
	allComps := component.All()
	items := make([]componentItem, len(allComps))
	selected := make(map[int]bool, len(allComps))

	for i, c := range allComps {
		// A component is supported if at least one selected harness supports it.
		supported := false
		for _, dh := range harnesses {
			if dh.Harness.Supports(c) {
				supported = true
				break
			}
		}
		reason := ""
		if !supported {
			names := harnessNames(harnesses)
			reason = fmt.Sprintf("not supported by %s", strings.Join(names, ", "))
		}
		items[i] = componentItem{comp: c, supported: supported, reason: reason}

		// Pre-check recommended defaults.
		if supported && (c == component.SkillCommands || c == component.MCPGates) {
			selected[i] = true
		}
	}

	return SelectComponentModel{
		harnesses: harnesses,
		items:     items,
		selected:  selected,
	}
}

// harnessNames returns the names of the given harnesses for display.
func harnessNames(harnesses []core.DetectedHarness) []string {
	names := make([]string, len(harnesses))
	for i, dh := range harnesses {
		names[i] = dh.Harness.Name()
	}
	return names
}

// Init implements tea.Model.
func (m SelectComponentModel) Init() tea.Cmd { return nil }

// Update handles keyboard navigation and selection.
func (m SelectComponentModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.items)-1 {
				m.cursor++
			}
		case " ":
			// Only toggle supported items.
			if m.items[m.cursor].supported {
				m.selected[m.cursor] = !m.selected[m.cursor]
				m.errMsg = ""
			}
		case "enter":
			// Guard: at least one component must be selected.
			if m.countSelected() == 0 {
				m.errMsg = "Select at least one component"
				return m, nil
			}
			m.confirmed = true
		}
	}
	return m, nil
}

func (m SelectComponentModel) countSelected() int {
	n := 0
	for _, v := range m.selected {
		if v {
			n++
		}
	}
	return n
}

// View renders the component list, greying out disabled entries.
func (m SelectComponentModel) View() string {
	var sb strings.Builder
	sb.WriteString(titleStyle().Render("Select components to install:"))
	sb.WriteString("\n\n")

	for i, item := range m.items {
		cursor := "  "
		if i == m.cursor {
			cursor = "> "
		}

		check := "[ ]"
		if m.selected[i] {
			check = "[x]"
		}
		if !item.supported {
			check = "[-]"
		}

		line := fmt.Sprintf("%s%s %s", cursor, check, item.comp.String())

		switch {
		case !item.supported:
			if item.reason != "" {
				line = fmt.Sprintf("%s%s %s  (%s)", cursor, check, item.comp.String(), item.reason)
			}
			sb.WriteString(disabledStyle().Render(line))
		case i == m.cursor:
			sb.WriteString(accentStyle().Render(line))
		default:
			sb.WriteString(line)
		}
		sb.WriteByte('\n')
	}

	if m.errMsg != "" {
		sb.WriteString("\n")
		sb.WriteString(errorStyle().Render(m.errMsg))
		sb.WriteByte('\n')
	}

	sb.WriteString("\n")
	sb.WriteString(mutedStyle().Render("space: toggle  enter: confirm  ctrl+c: cancel"))
	return sb.String()
}

// SelectedComponents returns the components that were checked.
func (m SelectComponentModel) SelectedComponents() []component.Component {
	var result []component.Component
	for i, item := range m.items {
		if m.selected[i] && item.supported {
			result = append(result, item.comp)
		}
	}
	return result
}

// IsConfirmed returns true when the user pressed Enter with a valid selection.
func (m SelectComponentModel) IsConfirmed() bool { return m.confirmed }

// ─── Confirm screen ────────────────────────────────────────────────────────

// ConfirmModel renders the harness × component install plan before committing.
// Ctrl+C / "n" exits cleanly with code 0 (spec: cancel scenario).
type ConfirmModel struct {
	harnesses  []core.DetectedHarness
	components []component.Component
	confirmed  bool
	cancelled  bool
}

// NewConfirmModel creates a ConfirmModel from selected harnesses and components.
func NewConfirmModel(harnesses []core.DetectedHarness, components []component.Component) ConfirmModel {
	return ConfirmModel{harnesses: harnesses, components: components}
}

// Init implements tea.Model.
func (m ConfirmModel) Init() tea.Cmd { return nil }

// Update handles confirmation and cancellation.
func (m ConfirmModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "y", "enter":
			m.confirmed = true
		case "n", "q":
			// Note: ctrl+c is intercepted globally by AppModel.Update before
			// reaching any sub-model; it is not handled here.
			m.cancelled = true
			return m, tea.Quit
		}
	}
	return m, nil
}

// View renders the plan table and confirmation prompt.
func (m ConfirmModel) View() string {
	var sb strings.Builder
	sb.WriteString(titleStyle().Render("Install plan"))
	sb.WriteString("\n\n")

	for _, dh := range m.harnesses {
		sb.WriteString(accentStyle().Render(dh.Harness.Name()))
		sb.WriteString(":\n")
		for _, c := range m.components {
			if dh.Harness.Supports(c) {
				sb.WriteString("  + ")
				sb.WriteString(c.String())
				sb.WriteByte('\n')
			} else {
				sb.WriteString(disabledStyle().Render(
					fmt.Sprintf("  - %s (skipped — not supported)", c.String()),
				))
				sb.WriteByte('\n')
			}
		}
	}

	sb.WriteString("\n")
	sb.WriteString(mutedStyle().Render("y/enter: proceed  n/ctrl+c: cancel"))
	return sb.String()
}

// IsConfirmed returns true when the user pressed y or Enter.
func (m ConfirmModel) IsConfirmed() bool { return m.confirmed }

// IsCancelled returns true when the user cancelled.
func (m ConfirmModel) IsCancelled() bool { return m.cancelled }

// ─── ApplyMsg helpers ──────────────────────────────────────────────────────

// ApplyResultMsg carries the outcome of core.Apply back to the TUI.
type ApplyResultMsg struct {
	Changes    []harness.Change
	SnapshotID string
	Err        error
}
