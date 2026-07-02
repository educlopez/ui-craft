package core

import (
	"errors"
	"testing"
)

// fakeExecFn builds a stub execFn for DetectGitHubRemote tests. It ignores
// name/args (tests only care about the stdout/err it returns) and asserts
// nothing about invocation shape here — argv correctness is covered by
// TestDetectGitHubRemote_invokesGitRemoteGetURLOrigin below.
func fakeExecFn(stdout string, err error) func(name string, args ...string) ([]byte, error) {
	return func(name string, args ...string) ([]byte, error) {
		return []byte(stdout), err
	}
}

func TestDetectGitHubRemote(t *testing.T) {
	tests := []struct {
		name          string
		stdout        string
		execErr       error
		wantIsGitHub  bool
		wantOwnerRepo string
	}{
		{
			name:          "SSH GitHub remote",
			stdout:        "git@github.com:org/repo.git\n",
			wantIsGitHub:  true,
			wantOwnerRepo: "org/repo",
		},
		{
			name:          "SSH GitHub remote without .git suffix",
			stdout:        "git@github.com:org/repo\n",
			wantIsGitHub:  true,
			wantOwnerRepo: "org/repo",
		},
		{
			name:          "HTTPS GitHub remote",
			stdout:        "https://github.com/org/repo.git\n",
			wantIsGitHub:  true,
			wantOwnerRepo: "org/repo",
		},
		{
			name:          "HTTPS GitHub remote without .git suffix",
			stdout:        "https://github.com/org/repo\n",
			wantIsGitHub:  true,
			wantOwnerRepo: "org/repo",
		},
		{
			name:          "non-GitHub host (GitLab)",
			stdout:        "https://gitlab.com/org/repo.git\n",
			wantIsGitHub:  false,
			wantOwnerRepo: "",
		},
		{
			name:          "non-GitHub host (Bitbucket SSH)",
			stdout:        "git@bitbucket.org:org/repo.git\n",
			wantIsGitHub:  false,
			wantOwnerRepo: "",
		},
		{
			name:          "self-hosted git host",
			stdout:        "https://git.example.com/org/repo.git\n",
			wantIsGitHub:  false,
			wantOwnerRepo: "",
		},
		{
			name:          "empty output",
			stdout:        "",
			wantIsGitHub:  false,
			wantOwnerRepo: "",
		},
		{
			name:          "whitespace-only output",
			stdout:        "   \n",
			wantIsGitHub:  false,
			wantOwnerRepo: "",
		},
		{
			name:          "exec error (no origin configured / not a git repo)",
			stdout:        "",
			execErr:       errors.New("fatal: not a git repository"),
			wantIsGitHub:  false,
			wantOwnerRepo: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			isGitHub, ownerRepo, err := DetectGitHubRemote(".", fakeExecFn(tt.stdout, tt.execErr))
			if err != nil {
				t.Fatalf("DetectGitHubRemote returned error, want nil (fail-closed, not fail-loud): %v", err)
			}
			if isGitHub != tt.wantIsGitHub {
				t.Errorf("isGitHub = %v, want %v", isGitHub, tt.wantIsGitHub)
			}
			if ownerRepo != tt.wantOwnerRepo {
				t.Errorf("ownerRepo = %q, want %q", ownerRepo, tt.wantOwnerRepo)
			}
		})
	}
}

// TestDetectGitHubRemote_invokesGitRemoteGetURLOrigin asserts the exact argv
// shape used to shell out, mirroring the design's specified command.
func TestDetectGitHubRemote_invokesGitRemoteGetURLOrigin(t *testing.T) {
	var gotName string
	var gotArgs []string
	execFn := func(name string, args ...string) ([]byte, error) {
		gotName = name
		gotArgs = args
		return []byte("git@github.com:org/repo.git\n"), nil
	}

	isGitHub, _, err := DetectGitHubRemote("/some/dir", execFn)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !isGitHub {
		t.Fatalf("expected isGitHub=true")
	}
	if gotName != "git" {
		t.Errorf("exec name = %q, want %q", gotName, "git")
	}
	wantArgs := []string{"-C", "/some/dir", "remote", "get-url", "origin"}
	if len(gotArgs) != len(wantArgs) {
		t.Fatalf("argv = %v, want %v", gotArgs, wantArgs)
	}
	for i := range wantArgs {
		if gotArgs[i] != wantArgs[i] {
			t.Errorf("argv[%d] = %q, want %q", i, gotArgs[i], wantArgs[i])
		}
	}
}

// TestDetectGitHubRemote_nilExecFn confirms the function does not panic when
// execFn is nil — production callers should always pass a real exec seam, but
// a defensive nil-check keeps this fail-closed rather than fail-loud.
func TestDetectGitHubRemote_nilExecFn(t *testing.T) {
	isGitHub, ownerRepo, err := DetectGitHubRemote(".", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if isGitHub {
		t.Errorf("isGitHub = true, want false (fail-closed on nil execFn)")
	}
	if ownerRepo != "" {
		t.Errorf("ownerRepo = %q, want empty", ownerRepo)
	}
}
