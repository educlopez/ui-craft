package harness

// registry is the ordered list of all concrete harness adapters.
// Detection runs in this order; the order is stable across runs.
var registry = []Harness{
	ClaudeHarness{},
	CursorHarness{},
	CodexHarness{},
	GeminiHarness{},
	OpenCodeHarness{},
}

// All returns the ordered list of all registered harness adapters.
// Callers must not modify the returned slice.
func All() []Harness {
	return registry
}
