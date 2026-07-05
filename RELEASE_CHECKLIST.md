# Release Checklist

This checklist exists because CI cannot catch everything. The v1.0.1 Homebrew
cask SIGKILL on Apple Silicon (`com.apple.quarantine` + Gatekeeper killing an
ad-hoc-signed binary — see `VERSIONS.md`) shipped through green CI. That class
of bug only reproduces on a real machine, with a real Gatekeeper, running a
real fresh install. Nothing below replaces automated tests; it exists to cover
what automated tests structurally cannot.

Run through this list before (or immediately after) tagging a release.

## 1. Automated — already covered by CI

These are enforced by CI on every push/tag. Confirm green, but you do not need
to re-run them manually:

- [ ] `cli-ci.yml` matrix (build + `go test -race ./...`) is green on the
      release commit.
- [ ] `cli-release.yml`'s `smoke-test` job is green: the released binary
      returns a non-empty `ui-craft version`, and `ui-craft install --dry-run
      --json` exits 0 with valid JSON output.

If either is red, stop — do not proceed to the manual steps below until CI is
green.

## 1b. Skill-surface releases — quick gates

When the release changes `skills/`, `commands/`, or their mirrors (not just the
CLI binary), run these locally before tagging — they are cheap and catch the
two classes of skill-release bug (broken links/manifests and mirror drift):

- [ ] `node scripts/validate.mjs` — manifests, frontmatter, links.
- [ ] `node scripts/check-mirror-copies.mjs` — canonical ↔ mirror drift.
- [ ] `node scripts/eval.mjs --baseline` — quality-score fixtures within bands.
- [ ] **Blind-build spot check (manual, judged):** run at least one Track A and
      one Track B prompt from `evals/craft-quality/PROMPTS.md` in a fresh agent
      session with the release build installed. Confirm the Craft Read appears
      before code and exactly one signature bet is built in the first pass.
      This is the only gate that exercises what the skill actually *produces* —
      the scripts above cannot.

## 2. Manual — NOT CI-automatable

> [!warning]
> The step below cannot be verified by CI. It requires a physical (or cloud)
> Apple Silicon Mac with a clean Homebrew environment. Checking this box
> confirms **this specific release** was verified on **that specific
> machine**, at **that point in time** — nothing more.

- [ ] **Gatekeeper / fresh Homebrew install on a real Apple Silicon Mac.**
      On a real arm64 Mac (not CI, not a VM snapshot reused from a previous
      release):
      1. `brew update && brew install educlopez/tap/ui-craft` (or
         `brew upgrade` if already installed) against the newly published
         tap/cask.
      2. Run `ui-craft` (or `ui-craft version`) as the very first invocation
         after install.
      3. Confirm there is **no** "cannot be opened because the developer
         cannot be verified" dialog, and no silent `killed: 9` / SIGKILL.
      4. Confirm the binary is not left quarantined:
         `xattr -p com.apple.quarantine "$(brew --prefix)/Caskroom/ui-craft"/*/ui-craft`
         should report "No such xattr" after the cask's postflight hook runs.

  Optional, NOT a substitute for the above (informational only): running
  `codesign -dv` and/or `spctl --assess` against the staged binary can give a
  faster signal on signing status, but neither actually exercises Gatekeeper's
  quarantine-on-first-launch behavior the way a real fresh install does. This
  spec does not require or implement a CI-based codesign/spctl check — it is
  listed here only as a possible future improvement to this checklist, not as
  coverage.

## 3. What checking these boxes does NOT guarantee

Read this before treating a completed checklist as "installer is bulletproof":

- **It does not cover Intel Macs.** Verification above is Apple-Silicon-only.
  Intel (`x86_64`) install paths are an explicitly accepted gap (see the
  installer-hardening change's out-of-scope list) and are not exercised by
  this checklist or by CI.
- **It does not cover low-disk-space conditions.** Install/backup behavior
  under a nearly-full disk is untested, automated or manual.
- **It does not cover concurrent/cross-process installs.** Two `ui-craft
  install` invocations racing against the same target machine is untested.
- **It does not carry forward to future releases.** Passing this checklist
  for release `vX.Y.Z` says nothing about `vX.Y.(Z+1)`. Homebrew, macOS
  Gatekeeper policy, and code-signing requirements can all change between
  releases without any code change on this side. Re-run the manual step in
  §2 for every release that touches the binary, the cask definition, or the
  signing/build pipeline — do not assume "we checked this once" is durable.
- **A green checklist is a snapshot, not a warranty.** It says "as of this
  release, on this machine, this did not fail" — not "this can never fail."

## Sign-off

- Release tag: `vX.Y.Z`
- Verified by: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- Apple Silicon Mac used for §2 (model/OS version, informal is fine):
  \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

> Referenced from `.github/workflows/cli-release.yml`. See
> `sdd/installer-hardening` (spec/design) for the full rationale behind this
> checklist's scope and boundaries.
