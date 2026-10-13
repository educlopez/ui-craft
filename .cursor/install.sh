#!/usr/bin/env bash
# Cloud Agent bootstrap: put a Go toolchain that satisfies cli/go.mod on PATH.
#
# The default image ships a distro `go` (currently 1.22.x at /usr/bin/go).
# cli/go.mod requires 1.23+, and that older toolchain cannot download a newer
# one (`toolchain not available`). Install the official tarball under
# /usr/local/go and symlink `go` / `gofmt` into /usr/local/bin, which precedes
# /usr/bin on the image PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Keep this pin at or above the `go` directive in cli/go.mod. Bump the pin and
# the SHA-256 sums together when that directive moves.
GO_VERSION="1.23.12"
GO_SHA256_LINUX_AMD64="d3847fef834e9db11bf64e3fb34db9c04db14e068eeb064f49af747010454f90"
GO_SHA256_LINUX_ARM64="52ce172f96e21da53b1ae9079808560d49b02ac86cecfa457217597f9bc28ab3"

mod_line="$(awk '/^go / { print $2; exit }' cli/go.mod)"
if [[ -z "$mod_line" ]]; then
  echo "error: could not read the go directive from cli/go.mod" >&2
  exit 1
fi

version_ge() {
  # True when $1 >= $2 (dot-separated numeric versions; missing patch is 0).
  printf '%s\n%s\n' "$2" "$1" | sort -C -V
}

if ! version_ge "$GO_VERSION" "$mod_line"; then
  echo "error: GO_VERSION=${GO_VERSION} is below cli/go.mod (${mod_line})" >&2
  exit 1
fi

# `set -euo pipefail` would abort on a broken `go version` (the pipeline
# fails, the assignment fails, the script exits 1 with no message). Probe
# inside `if` so a missing or failing toolchain is treated as "not installed".
current=""
if ! command -v go >/dev/null 2>&1; then
  echo "Go not found on PATH; installing ${GO_VERSION}"
elif go_out="$(go version 2>&1)"; then
  current="$(printf '%s\n' "$go_out" | sed -n 's/^go version go\([0-9.]*\).*/\1/p')"
  if [[ -z "$current" ]]; then
    echo "warning: could not parse \`go version\` output (${go_out}); installing ${GO_VERSION}" >&2
  fi
else
  echo "warning: \`go version\` failed${go_out:+: ${go_out}}; installing ${GO_VERSION}" >&2
fi

if [[ -n "$current" ]] && version_ge "$current" "$mod_line"; then
  echo "Go ${current} already satisfies cli/go.mod (>= ${mod_line})"
  exit 0
fi

arch="$(uname -m)"
case "$arch" in
  x86_64) goarch="amd64"; sha="$GO_SHA256_LINUX_AMD64" ;;
  aarch64 | arm64) goarch="arm64"; sha="$GO_SHA256_LINUX_ARM64" ;;
  *)
    echo "error: unsupported architecture ${arch}; install Go ${mod_line}+ from https://go.dev/dl/" >&2
    exit 1
    ;;
esac

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "error: .cursor/install.sh only installs official Linux tarballs; install Go ${mod_line}+ from https://go.dev/dl/" >&2
  exit 1
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

tarball="$tmp/go${GO_VERSION}.linux-${goarch}.tar.gz"
echo "Installing Go ${GO_VERSION} (linux/${goarch}) to /usr/local/go"
curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${goarch}.tar.gz" -o "$tarball"
echo "${sha}  ${tarball}" | sha256sum -c -

sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf "$tarball"
sudo ln -sfn /usr/local/go/bin/go /usr/local/bin/go
sudo ln -sfn /usr/local/go/bin/gofmt /usr/local/bin/gofmt

hash -r 2>/dev/null || true
installed="$(/usr/local/bin/go version)"
echo "Installed ${installed}"
