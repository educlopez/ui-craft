package core

import "strings"

// DetectGitHubRemote reports whether dir's git "origin" remote points to
// github.com, and if so, the "owner/repo" slug parsed from the remote URL.
//
// It shells out to `git -C <dir> remote get-url origin` via the injectable
// execFn seam (mirrors the execBrewFn/execFn pattern used elsewhere in this
// codebase for testable exec.Command call sites). Passing nil for execFn is
// treated as a fail-closed "not detected" result rather than a panic — every
// production call site must supply a real exec implementation.
//
// Fail-closed by design (per spec's GitHub-Remote Detection requirement):
// any of the following results in isGitHub=false, ownerRepo="", err=nil —
// never an error, so callers (the TUI) never need special-case error
// handling to keep behavior safe:
//   - execFn is nil
//   - the command errors (not a git repo, no git binary, no origin remote)
//   - the command produces empty/whitespace-only output
//   - the remote host is not exactly "github.com" (GitLab, Bitbucket,
//     self-hosted git, etc.)
//
// Both common remote URL forms are parsed:
//   - SSH:   git@github.com:owner/repo.git (or without the .git suffix)
//   - HTTPS: https://github.com/owner/repo.git (or without the .git suffix)
func DetectGitHubRemote(dir string, execFn func(name string, args ...string) ([]byte, error)) (isGitHub bool, ownerRepo string, err error) {
	if execFn == nil {
		return false, "", nil
	}

	out, execErr := execFn("git", "-C", dir, "remote", "get-url", "origin")
	if execErr != nil {
		return false, "", nil
	}

	url := strings.TrimSpace(string(out))
	if url == "" {
		return false, "", nil
	}

	host, path, ok := parseGitRemoteURL(url)
	if !ok || host != "github.com" {
		return false, "", nil
	}

	return true, path, nil
}

// parseGitRemoteURL extracts the host and "owner/repo" path from a git
// remote URL in either SSH (git@host:owner/repo(.git)) or HTTPS
// (scheme://host/owner/repo(.git)) form. ok is false if the URL matches
// neither recognized form.
func parseGitRemoteURL(url string) (host, ownerRepo string, ok bool) {
	// SSH form: git@host:owner/repo(.git)
	if rest, found := strings.CutPrefix(url, "git@"); found {
		host, path, found := strings.Cut(rest, ":")
		if !found || host == "" || path == "" {
			return "", "", false
		}
		return host, strings.TrimSuffix(path, ".git"), true
	}

	// HTTPS (or other scheme://) form: scheme://host/owner/repo(.git)
	if idx := strings.Index(url, "://"); idx >= 0 {
		rest := url[idx+len("://"):]
		host, path, found := strings.Cut(rest, "/")
		if !found || host == "" || path == "" {
			return "", "", false
		}
		return host, strings.TrimSuffix(path, ".git"), true
	}

	return "", "", false
}
