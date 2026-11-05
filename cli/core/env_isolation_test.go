package core_test

import (
	"os"
	"testing"
)

// TestMain clears the environment variables that relocate harness config
// roots ($CLAUDE_CONFIG_DIR, $CODEX_HOME, $GEMINI_CLI_HOME,
// $OPENCODE_CONFIG_DIR, $XDG_CONFIG_HOME). Tests isolate HOME/USERPROFILE;
// an override inherited from the developer's shell or the CI image (GitHub's
// Ubuntu runners export XDG_CONFIG_HOME) would otherwise point installs at the
// real config dirs. Tests that exercise an override set it with t.Setenv.
func TestMain(m *testing.M) {
	for _, name := range []string{"CLAUDE_CONFIG_DIR", "CODEX_HOME", "GEMINI_CLI_HOME", "OPENCODE_CONFIG_DIR", "XDG_CONFIG_HOME"} {
		_ = os.Unsetenv(name)
	}
	os.Exit(m.Run())
}
