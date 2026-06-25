// Package-level vars for injectable detection. Tests that use withInjectedDetect
// MUST NOT call t.Parallel(): lookPath and statPath are shared package-level
// vars and are not safe for concurrent mutation by multiple test goroutines.
package harness

import (
	"io/fs"
	"os"
	"os/exec"
)

// lookPath wraps exec.LookPath. Tests may replace this var to inject a fake
// implementation without spawning real processes.
//
// Adopted from gentle-ai (MIT): internal/system/detect.go pattern.
var lookPath = func(file string) (string, error) {
	return exec.LookPath(file)
}

// statPath wraps os.Stat. Tests may replace this var to inject a fake
// implementation that controls which paths appear to exist.
//
// Adopted from gentle-ai (MIT): internal/system/detect.go pattern.
var statPath = func(name string) (fs.FileInfo, error) {
	return os.Stat(name)
}
