#!/usr/bin/env bash
# Install the ui-craft CLI binary for the current OS/arch.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/educlopez/ui-craft/main/scripts/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/educlopez/ui-craft/main/scripts/install.sh | bash -s -- --version v0.36.0
#
# Env overrides:
#   UI_CRAFT_VERSION      release tag or version to install (e.g. v0.36.0 or 0.36.0)
#   UI_CRAFT_INSTALL_DIR  directory to install the binary into
#
# Always downloads from GitHub Releases and verifies the sha256 against the
# release's checksums.txt before installing. Never invokes sudo.

set -euo pipefail

REPO="educlopez/ui-craft"
BINARY_NAME="ui-craft"
VERSION="${UI_CRAFT_VERSION:-}"

# Undocumented overrides for offline/e2e testing only — not part of the
# public interface, do not surface these in --help or README.
UI_CRAFT_BASE_URL="${UI_CRAFT_BASE_URL:-https://github.com/${REPO}/releases/download}"
UI_CRAFT_API_URL="${UI_CRAFT_API_URL:-https://api.github.com/repos/${REPO}/releases/latest}"

# Real GitHub URLs are pinned to https + TLS 1.2. Local fixture servers used
# by e2e/installer/run-tests.sh serve plain http on 127.0.0.1, so relax the
# pin only when a base-url override is in effect (test-only path).
if [ "$UI_CRAFT_BASE_URL" = "https://github.com/${REPO}/releases/download" ]; then
  curl_tls_opts="--proto =https --tlsv1.2"
else
  curl_tls_opts=""
fi

# --- arg parsing --------------------------------------------------------

while [ "$#" -gt 0 ]; do
  case "$1" in
    --version)
      VERSION="${2:-}"
      shift 2
      ;;
    --version=*)
      VERSION="${1#*=}"
      shift
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

# --- output helpers -------------------------------------------------------

if [ -t 1 ]; then
  COLOR_RED=$'\033[31m'
  COLOR_YELLOW=$'\033[33m'
  COLOR_BLUE=$'\033[34m'
  COLOR_RESET=$'\033[0m'
else
  COLOR_RED=""
  COLOR_YELLOW=""
  COLOR_BLUE=""
  COLOR_RESET=""
fi

info() { printf '%s[info]%s %s\n' "${COLOR_BLUE}" "${COLOR_RESET}" "$1"; }
warn() { printf '%s[warn]%s %s\n' "${COLOR_YELLOW}" "${COLOR_RESET}" "$1" >&2; }
err() { printf '%s[error]%s %s\n' "${COLOR_RED}" "${COLOR_RESET}" "$1" >&2; }

fatal() {
  err "$1"
  exit 1
}

# --- OS / arch detection --------------------------------------------------

uname_s="$(uname -s)"
case "$uname_s" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  MINGW* | MSYS* | CYGWIN*)
    fatal "Windows detected. Use scripts/install.ps1 instead: irm https://raw.githubusercontent.com/${REPO}/main/scripts/install.ps1 | iex"
    ;;
  *)
    fatal "Unsupported OS '${uname_s}'. Download a binary manually from https://github.com/${REPO}/releases"
    ;;
esac

uname_m="$(uname -m)"
case "$uname_m" in
  x86_64 | amd64) arch="amd64" ;;
  arm64 | aarch64) arch="arm64" ;;
  *)
    fatal "Unsupported architecture '${uname_m}'. Download a binary manually from https://github.com/${REPO}/releases"
    ;;
esac

# --- checksum tool ---------------------------------------------------------

if command -v sha256sum >/dev/null 2>&1; then
  sha256_cmd() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
  sha256_cmd() { shasum -a 256 "$1" | awk '{print $1}'; }
else
  fatal "Neither sha256sum nor shasum found — cannot verify the download. Aborting."
fi

# --- version resolution ------------------------------------------------

if [ -z "$VERSION" ]; then
  info "Looking up the latest release..."
  # shellcheck disable=SC2086 # curl_tls_opts is intentionally unquoted for word-splitting; contains no whitespace-bearing values
  latest_json="$(curl -fsSL $curl_tls_opts --connect-timeout 10 --max-time 60 "$UI_CRAFT_API_URL")" \
    || fatal "Failed to query the GitHub releases API. This may be a rate limit — skip the lookup by passing --version vX.Y.Z (or setting UI_CRAFT_VERSION)."
  tag="$(printf '%s' "$latest_json" | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"
  [ -n "$tag" ] || fatal "Could not parse the latest release tag."
else
  tag="$VERSION"
fi

case "$tag" in
  v*) archive_version="${tag#v}" ;;
  *)
    archive_version="$tag"
    tag="v${tag}"
    ;;
esac

info "Installing ui-craft ${tag} (${os}/${arch})"

archive_name="ui-craft_${archive_version}_${os}_${arch}.tar.gz"
base_url="${UI_CRAFT_BASE_URL}/${tag}"

# --- download --------------------------------------------------------------

tmp_dir="$(mktemp -d)"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT

info "Downloading ${archive_name}..."
# shellcheck disable=SC2086 # curl_tls_opts is intentionally unquoted for word-splitting; contains no whitespace-bearing values
curl -fsSL $curl_tls_opts --connect-timeout 10 --max-time 600 -o "${tmp_dir}/${archive_name}" \
  "${base_url}/${archive_name}" \
  || fatal "Download failed. Check that ${tag} has a release asset for ${os}/${arch}."

# shellcheck disable=SC2086 # curl_tls_opts is intentionally unquoted for word-splitting; contains no whitespace-bearing values
curl -fsSL $curl_tls_opts --connect-timeout 10 --max-time 60 -o "${tmp_dir}/checksums.txt" \
  "${base_url}/checksums.txt" \
  || fatal "Failed to download checksums.txt for verification."

# --- verify ------------------------------------------------------------

info "Verifying checksum..."
expected_sum="$(grep "  ${archive_name}\$" "${tmp_dir}/checksums.txt" | awk '{print $1}')"
[ -n "$expected_sum" ] || fatal "No checksum entry found for ${archive_name} in checksums.txt."

actual_sum="$(sha256_cmd "${tmp_dir}/${archive_name}")"
if [ "$expected_sum" != "$actual_sum" ]; then
  fatal "Checksum mismatch for ${archive_name}: expected ${expected_sum}, got ${actual_sum}."
fi
info "Checksum OK."

# --- extract -----------------------------------------------------------

tar -xzf "${tmp_dir}/${archive_name}" -C "$tmp_dir" "$BINARY_NAME" \
  || fatal "Failed to extract ${BINARY_NAME} from ${archive_name}."

# --- install dir ---------------------------------------------------------

if [ -n "${UI_CRAFT_INSTALL_DIR:-}" ]; then
  install_dir="$UI_CRAFT_INSTALL_DIR"
elif [ -w "/usr/local/bin" ]; then
  install_dir="/usr/local/bin"
else
  install_dir="${HOME}/.local/bin"
fi

mkdir -p "$install_dir"

install -m 0755 "${tmp_dir}/${BINARY_NAME}" "${install_dir}/${BINARY_NAME}" \
  || fatal "Failed to install the binary into ${install_dir}."

# --- verify install ------------------------------------------------------

if ! "${install_dir}/${BINARY_NAME}" version >/dev/null 2>&1; then
  fatal "Installed binary at ${install_dir}/${BINARY_NAME} did not run successfully."
fi

info "Installed ui-craft to ${install_dir}/${BINARY_NAME}"

case ":${PATH}:" in
  *":${install_dir}:"*) ;;
  *)
    warn "${install_dir} is not on your PATH. Add this to your shell profile:"
    printf '  export PATH="%s:$PATH"\n' "$install_dir"
    ;;
esac

printf '\n'
info "Run 'ui-craft' for the interactive hub, or 'ui-craft install' to wire your harnesses."
info "Updates: 'ui-craft self-update'."
