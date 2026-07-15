#!/usr/bin/env bash
# e2e/installer/run-tests.sh — hermetic end-to-end tests for scripts/install.sh
#
# Exercises the real installer against a local fixture HTTP server (no network
# access required) plus one opt-in test against the real GitHub release.
#
# Usage:
#   ./e2e/installer/run-tests.sh                  # hermetic tests only (default)
#   RUN_NETWORK_TESTS=1 ./e2e/installer/run-tests.sh  # also run the real-network test
#
# Exit codes:
#   0 — all tests passed
#   1 — at least one test failed
set -euo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALL_SH="$REPO_ROOT/scripts/install.sh"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[1;33m'
  BLUE=$'\033[0;34m'
  NC=$'\033[0m'
else
  RED=""
  GREEN=""
  YELLOW=""
  BLUE=""
  NC=""
fi

# ---------------------------------------------------------------------------
# Counters + tiny pass/fail helpers
# ---------------------------------------------------------------------------
PASSED=0
FAILED=0
SKIPPED=0

log_test() { printf "%s[TEST]%s  %s\n" "$YELLOW" "$NC" "$1"; }
log_info() { printf "%s[INFO]%s  %s\n" "$BLUE" "$NC" "$1"; }
log_skip() { printf "%s[SKIP]%s  %s\n" "$BLUE" "$NC" "$1"; SKIPPED=$((SKIPPED + 1)); }

pass() {
  printf "%s[PASS]%s  %s\n" "$GREEN" "$NC" "$1"
  PASSED=$((PASSED + 1))
}

fail() {
  printf "%s[FAIL]%s  %s\n" "$RED" "$NC" "$1"
  FAILED=$((FAILED + 1))
}

# assert_eq ACTUAL EXPECTED LABEL
assert_eq() {
  if [ "$1" = "$2" ]; then
    pass "$3 (got: $1)"
  else
    fail "$3 (expected: $2, got: $1)"
  fi
}

# assert_contains HAYSTACK NEEDLE LABEL
assert_contains() {
  case "$1" in
    *"$2"*) pass "$3" ;;
    *) fail "$3 (did not find '$2' in output)" ;;
  esac
}

# assert_file_exists FILE LABEL
assert_file_exists() {
  if [ -f "$1" ]; then
    pass "$2"
  else
    fail "$2 (file not found: $1)"
  fi
}

# assert_file_not_exists FILE LABEL
assert_file_not_exists() {
  if [ ! -e "$1" ]; then
    pass "$2"
  else
    fail "$2 (file unexpectedly exists: $1)"
  fi
}

# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------
WORKDIR="$(mktemp -d)"
FIXTURE_ROOT="$WORKDIR/fixture"
SERVER_PID=""
SERVER_LOG="$WORKDIR/server.log"

# shellcheck disable=SC2329 # invoked indirectly via `trap ... EXIT INT TERM` below
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$WORKDIR"
}
trap cleanup EXIT INT TERM

# ---------------------------------------------------------------------------
# Checksum helper (mirrors install.sh's own tool resolution)
# ---------------------------------------------------------------------------
if command -v sha256sum >/dev/null 2>&1; then
  sha256_of() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
  sha256_of() { shasum -a 256 "$1" | awk '{print $1}'; }
else
  echo "Neither sha256sum nor shasum found on this machine — cannot build test fixtures." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Detect host os/arch the same way install.sh does, so fixture archive names
# match what the installer will actually request.
# ---------------------------------------------------------------------------
detect_os() {
  case "$(uname -s)" in
    Darwin) echo "darwin" ;;
    Linux) echo "linux" ;;
    *) echo "unknown" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64 | amd64) echo "amd64" ;;
    arm64 | aarch64) echo "arm64" ;;
    *) echo "unknown" ;;
  esac
}

HOST_OS="$(detect_os)"
HOST_ARCH="$(detect_arch)"

if [ "$HOST_OS" = "unknown" ] || [ "$HOST_ARCH" = "unknown" ]; then
  echo "Unsupported host OS/arch for building test fixtures ($HOST_OS/$HOST_ARCH)." >&2
  exit 1
fi

FAKE_VERSION="9.9.9-test"
GOOD_TAG="v${FAKE_VERSION}"
BADSUM_TAG="v${FAKE_VERSION}-badsum"
NOSUM_TAG="v${FAKE_VERSION}-nosum"

# ---------------------------------------------------------------------------
# build_fake_archive DIR ARCHIVE_NAME — pack a fake ui-craft binary that
# prints "ui-craft 9.9.9-test" and exits 0, matching what a real `ui-craft
# version` invocation would look like.
# ---------------------------------------------------------------------------
build_fake_archive() {
  local dest_dir="$1"
  local archive_name="$2"
  local build_dir
  build_dir="$(mktemp -d)"

  cat > "$build_dir/ui-craft" <<EOF
#!/bin/sh
echo "ui-craft ${FAKE_VERSION}"
exit 0
EOF
  chmod +x "$build_dir/ui-craft"

  mkdir -p "$dest_dir"
  tar -czf "$dest_dir/$archive_name" -C "$build_dir" ui-craft
  rm -rf "$build_dir"
}

# ---------------------------------------------------------------------------
# Build the fixture tree served by the local HTTP server:
#
#   $FIXTURE_ROOT/api/latest.json         — GitHub "latest release" stand-in
#   $FIXTURE_ROOT/$GOOD_TAG/...           — valid archive + checksums
#   $FIXTURE_ROOT/$BADSUM_TAG/...         — archive + tampered checksums.txt
#   $FIXTURE_ROOT/$NOSUM_TAG/...          — archive, no checksums.txt at all
# ---------------------------------------------------------------------------
log_info "Building fixture server tree at $FIXTURE_ROOT"

# install.sh derives archive_version by stripping a leading "v" from the tag,
# so each tag directory's archive filename must be built from ITS OWN tag
# (BADSUM_TAG/NOSUM_TAG carry a -badsum/-nosum suffix), not a shared name.
good_archive_name="ui-craft_${FAKE_VERSION}_${HOST_OS}_${HOST_ARCH}.tar.gz"
badsum_archive_name="ui-craft_${FAKE_VERSION}-badsum_${HOST_OS}_${HOST_ARCH}.tar.gz"
nosum_archive_name="ui-craft_${FAKE_VERSION}-nosum_${HOST_OS}_${HOST_ARCH}.tar.gz"

# -- good tag: valid archive + correct checksums.txt -------------------------
good_dir="$FIXTURE_ROOT/$GOOD_TAG"
build_fake_archive "$good_dir" "$good_archive_name"
(cd "$good_dir" && printf '%s  %s\n' "$(sha256_of "$good_archive_name")" "$good_archive_name" > checksums.txt)

# -- api lookup fixture: points the default (no --version) path at GOOD_TAG --
mkdir -p "$FIXTURE_ROOT/api"
printf '{"tag_name": "%s", "name": "%s"}\n' "$GOOD_TAG" "$GOOD_TAG" > "$FIXTURE_ROOT/api/latest.json"

# -- badsum tag: same archive, tampered checksum -----------------------------
badsum_dir="$FIXTURE_ROOT/$BADSUM_TAG"
build_fake_archive "$badsum_dir" "$badsum_archive_name"
printf 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef  %s\n' "$badsum_archive_name" > "$badsum_dir/checksums.txt"

# -- nosum tag: archive present, checksums.txt deliberately missing ----------
nosum_dir="$FIXTURE_ROOT/$NOSUM_TAG"
build_fake_archive "$nosum_dir" "$nosum_archive_name"

# ---------------------------------------------------------------------------
# Start the fixture HTTP server on a random local port.
# ---------------------------------------------------------------------------
start_server() {
  local port
  local attempt
  for attempt in 1 2 3 4 5; do
    : "$attempt" # retry counter only, no per-attempt state needed
    port=$(( (RANDOM % 20000) + 20000 ))
    (cd "$FIXTURE_ROOT" && exec python3 -m http.server "$port" --bind 127.0.0.1) \
      > "$SERVER_LOG" 2>&1 &
    SERVER_PID=$!

    # Wait for the server to come up (or the process to die trying).
    local wait_tick
    for wait_tick in 1 2 3 4 5 6 7 8 9 10; do
      : "$wait_tick"
      if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        break
      fi
      if curl -fsS -o /dev/null "http://127.0.0.1:${port}/api/latest.json" 2>/dev/null; then
        SERVER_URL="http://127.0.0.1:${port}"
        return 0
      fi
      sleep 0.3
    done

    # Didn't come up (likely port already in use) — clean up and retry.
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      kill "$SERVER_PID" 2>/dev/null || true
      wait "$SERVER_PID" 2>/dev/null || true
    fi
    SERVER_PID=""
  done

  echo "Could not start fixture HTTP server after 5 attempts." >&2
  cat "$SERVER_LOG" >&2 || true
  exit 1
}

start_server
log_info "Fixture server running at $SERVER_URL (pid $SERVER_PID)"

API_URL="$SERVER_URL/api/latest.json"

# ---------------------------------------------------------------------------
# run_install [args...] — run the real installer with the current exported
# env, capturing combined stdout+stderr into LAST_OUTPUT and the exit code
# into LAST_RC. Never lets a nonzero installer exit abort this suite.
# ---------------------------------------------------------------------------
LAST_OUTPUT=""
LAST_RC=0

run_install() {
  LAST_RC=0
  LAST_OUTPUT="$(bash "$INSTALL_SH" "$@" 2>&1)" || LAST_RC=$?
}

run_install_with_path() {
  local extra_path="$1"
  shift
  LAST_RC=0
  LAST_OUTPUT="$(PATH="${extra_path}:${PATH}" bash "$INSTALL_SH" "$@" 2>&1)" || LAST_RC=$?
}

reset_env() {
  unset UI_CRAFT_VERSION UI_CRAFT_INSTALL_DIR UI_CRAFT_BASE_URL UI_CRAFT_API_URL 2>/dev/null || true
}

# =============================================================================
# T1 — happy path: install from the fixture server (default/latest lookup)
# =============================================================================
log_test "T1 — happy path install from fixture server"
reset_env
install_dir_t1="$WORKDIR/t1-install"
export UI_CRAFT_BASE_URL="$SERVER_URL"
export UI_CRAFT_API_URL="$API_URL"
export UI_CRAFT_INSTALL_DIR="$install_dir_t1"
run_install
reset_env

assert_eq "$LAST_RC" "0" "T1: installer exits 0"
assert_file_exists "$install_dir_t1/ui-craft" "T1: binary present at install dir"
if [ -x "$install_dir_t1/ui-craft" ]; then
  t1_run_output="$("$install_dir_t1/ui-craft" version 2>&1 || true)"
  assert_contains "$t1_run_output" "$FAKE_VERSION" "T1: installed binary runs and reports fixture version"
else
  fail "T1: installed binary is not executable"
fi

# =============================================================================
# T2 — pinned version via --version and via UI_CRAFT_VERSION
# =============================================================================
log_test "T2a — pinned version via --version flag"
reset_env
install_dir_t2a="$WORKDIR/t2a-install"
export UI_CRAFT_BASE_URL="$SERVER_URL"
export UI_CRAFT_API_URL="$API_URL"
export UI_CRAFT_INSTALL_DIR="$install_dir_t2a"
run_install --version "$GOOD_TAG"
reset_env

assert_eq "$LAST_RC" "0" "T2a: installer exits 0 with --version"
assert_file_exists "$install_dir_t2a/ui-craft" "T2a: binary present at install dir"
if [ -x "$install_dir_t2a/ui-craft" ]; then
  t2a_run_output="$("$install_dir_t2a/ui-craft" version 2>&1 || true)"
  assert_contains "$t2a_run_output" "$FAKE_VERSION" "T2a: installed binary reports pinned version"
else
  fail "T2a: installed binary is not executable"
fi

log_test "T2b — pinned version via UI_CRAFT_VERSION env"
reset_env
install_dir_t2b="$WORKDIR/t2b-install"
export UI_CRAFT_BASE_URL="$SERVER_URL"
export UI_CRAFT_API_URL="$API_URL"
export UI_CRAFT_INSTALL_DIR="$install_dir_t2b"
export UI_CRAFT_VERSION="$GOOD_TAG"
run_install
reset_env

assert_eq "$LAST_RC" "0" "T2b: installer exits 0 with UI_CRAFT_VERSION"
assert_file_exists "$install_dir_t2b/ui-craft" "T2b: binary present at install dir"
if [ -x "$install_dir_t2b/ui-craft" ]; then
  t2b_run_output="$("$install_dir_t2b/ui-craft" version 2>&1 || true)"
  assert_contains "$t2b_run_output" "$FAKE_VERSION" "T2b: installed binary reports pinned version"
else
  fail "T2b: installed binary is not executable"
fi

# =============================================================================
# T3 — checksum mismatch: tampered checksums.txt must abort the install
# =============================================================================
log_test "T3 — tampered checksums.txt is rejected"
reset_env
install_dir_t3="$WORKDIR/t3-install"
export UI_CRAFT_BASE_URL="$SERVER_URL"
export UI_CRAFT_API_URL="$API_URL"
export UI_CRAFT_INSTALL_DIR="$install_dir_t3"
export UI_CRAFT_VERSION="$BADSUM_TAG"
run_install
reset_env

if [ "$LAST_RC" -ne 0 ]; then
  pass "T3: installer exits non-zero on checksum mismatch"
else
  fail "T3: installer exits non-zero on checksum mismatch (got rc=0)"
fi
assert_contains "$LAST_OUTPUT" "hecksum" "T3: error output mentions checksum"
assert_file_not_exists "$install_dir_t3/ui-craft" "T3: binary was NOT installed"

# =============================================================================
# T4 — missing checksums.txt on the server
# =============================================================================
log_test "T4 — missing checksums.txt on server"
reset_env
install_dir_t4="$WORKDIR/t4-install"
export UI_CRAFT_BASE_URL="$SERVER_URL"
export UI_CRAFT_API_URL="$API_URL"
export UI_CRAFT_INSTALL_DIR="$install_dir_t4"
export UI_CRAFT_VERSION="$NOSUM_TAG"
run_install
reset_env

if [ "$LAST_RC" -ne 0 ]; then
  pass "T4: installer exits non-zero when checksums.txt is missing"
else
  fail "T4: installer exits non-zero when checksums.txt is missing (got rc=0)"
fi
assert_contains "$LAST_OUTPUT" "checksums.txt" "T4: error output mentions checksums.txt"
assert_file_not_exists "$install_dir_t4/ui-craft" "T4: nothing was installed"

# =============================================================================
# T5 — unsupported architecture: actionable error, no network call needed
# =============================================================================
log_test "T5 — unsupported architecture produces an actionable error"
reset_env

uname_shim_dir="$WORKDIR/uname-shim"
mkdir -p "$uname_shim_dir"
real_uname="$(command -v uname)"
cat > "$uname_shim_dir/uname" <<EOF
#!/usr/bin/env bash
case "\$1" in
  -s) exec "$real_uname" -s ;;
  -m) echo "mips" ;;
  *) exec "$real_uname" "\$@" ;;
esac
EOF
chmod +x "$uname_shim_dir/uname"

run_install_with_path "$uname_shim_dir"
reset_env

if [ "$LAST_RC" -ne 0 ]; then
  pass "T5: installer exits non-zero for unsupported architecture"
else
  fail "T5: installer exits non-zero for unsupported architecture (got rc=0)"
fi
assert_contains "$LAST_OUTPUT" "Unsupported architecture" "T5: error names the unsupported architecture"
assert_contains "$LAST_OUTPUT" "releases" "T5: error points at a manual download fallback"

# =============================================================================
# T6 — install-dir fallback: a read-only UI_CRAFT_INSTALL_DIR fails clearly
# =============================================================================
log_test "T6 — read-only install dir fails with a clear error"
reset_env
readonly_dir="$WORKDIR/t6-readonly"
mkdir -p "$readonly_dir"
chmod 555 "$readonly_dir"

export UI_CRAFT_BASE_URL="$SERVER_URL"
export UI_CRAFT_API_URL="$API_URL"
export UI_CRAFT_INSTALL_DIR="$readonly_dir"
export UI_CRAFT_VERSION="$GOOD_TAG"
run_install
reset_env
chmod 755 "$readonly_dir" || true

if [ "$LAST_RC" -ne 0 ]; then
  pass "T6: installer exits non-zero when install dir is not writable"
else
  fail "T6: installer exits non-zero when install dir is not writable (got rc=0)"
fi
assert_contains "$LAST_OUTPUT" "Failed to install the binary" "T6: error clearly names the install failure"
assert_file_not_exists "$readonly_dir/ui-craft" "T6: nothing was installed into the read-only dir"

# =============================================================================
# T7 — PATH warning: installing outside PATH prints the warning + export line
# =============================================================================
log_test "T7 — warns when install dir is not on PATH"
reset_env
install_dir_t7="$WORKDIR/t7-not-on-path"
export UI_CRAFT_BASE_URL="$SERVER_URL"
export UI_CRAFT_API_URL="$API_URL"
export UI_CRAFT_INSTALL_DIR="$install_dir_t7"
export UI_CRAFT_VERSION="$GOOD_TAG"
run_install
reset_env

assert_eq "$LAST_RC" "0" "T7: installer still succeeds"
assert_contains "$LAST_OUTPUT" "not on your PATH" "T7: prints the PATH warning"
assert_contains "$LAST_OUTPUT" "export PATH=" "T7: prints the export line to fix it"

# =============================================================================
# T8 — opt-in real network install (skipped by default)
# =============================================================================
if [ "${RUN_NETWORK_TESTS:-0}" = "1" ]; then
  log_test "T8 — real install from the latest GitHub release (network)"
  reset_env
  install_dir_t8="$WORKDIR/t8-install"
  export UI_CRAFT_INSTALL_DIR="$install_dir_t8"
  run_install
  reset_env

  assert_eq "$LAST_RC" "0" "T8: real installer exits 0"
  assert_file_exists "$install_dir_t8/ui-craft" "T8: real binary present at install dir"
  if [ -x "$install_dir_t8/ui-craft" ]; then
    t8_run_output="$("$install_dir_t8/ui-craft" version 2>&1 || true)"
    if [ "$LAST_RC" = "0" ] && [ -n "$t8_run_output" ]; then
      pass "T8: ui-craft version runs against the real release ($t8_run_output)"
    else
      fail "T8: ui-craft version did not run cleanly"
    fi
  else
    fail "T8: real installed binary is not executable"
  fi
else
  log_skip "T8: real network install (set RUN_NETWORK_TESTS=1 to enable)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "========================================"
echo "  Installer E2E Summary"
echo "========================================"
printf "  %sPASSED%s: %d\n" "$GREEN" "$NC" "$PASSED"
printf "  %sFAILED%s: %d\n" "$RED" "$NC" "$FAILED"
printf "  %sSKIPPED%s: %d\n" "$BLUE" "$NC" "$SKIPPED"
echo "========================================"

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
