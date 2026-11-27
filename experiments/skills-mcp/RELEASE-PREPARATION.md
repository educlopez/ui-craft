# SDK v2 release preparation

Local candidate only. No commit, push, registry publication, marketplace update,
installed configuration change or application submission is performed by these scripts.
The released MCP remains 0.9.1 and the Claude Directory skills-only edition is retained.

## Versions and outputs

### Authorized stable promotion

`python3 package-release.py --stable` explicitly builds MCP 1.0.0 and plugin
1.1.0 archives. Only this explicit mode removes the staged npm publication
guards. The default remains a private, unpublishable release candidate.
Run extracted-package checks with `UI_CRAFT_RELEASE_STABLE=1` for stable outputs.
Stable and RC archives may coexist; SHA256SUMS selects exactly the current build.

The trusted `npm-release.yml` workflow builds, tests and publishes the stable
staging directory without first changing live pins. After npm publication is
verified, promote the canonical source metadata, install pins and Registry.
This order avoids making current consumers depend on an unpublished version.

MCP candidate: 1.0.0-rc.1, stable target 1.0.0 only after release gates pass.
Cursor/OpenAI plugin candidate: 1.1.0-rc.1. Claude Code keeps commit-based versioning
(no fixed version in its plugin manifest), matching the current distribution contract.

Artifacts live under `dist/marketplace-v2/` at the repository root:

| Artifact | Content | Skills policy |
| --- | --- | --- |
| ui-craft-mcp-1.0.0-rc.1.tgz | npm-shaped, self-contained server, icons, catalog and licenses | Eight tools by default; 64 catalog skills opt-in |
| ui-craft-mcp-only-1.0.0-rc.1.zip | Standalone runtime and example configuration | Example enables catalog; do not install alongside native skills |
| ui-craft-claude-code-1.1.0-rc.1.zip | Full Claude Code plugin, existing commands/agents/hook plus bundled server | Native skills retained; MCP skills disabled |
| ui-craft-cursor-1.1.0-rc.1.zip | Cursor plugin, existing commands/agents/rules/hook plus bundled server | Native skills retained; MCP skills disabled |
| ui-craft-openai-1.1.0-rc.1.zip | Portable ChatGPT/Codex desktop plugin, 29 native skills, no hooks | MCP skills disabled |
| registry/server.json | Draft official Registry metadata for the candidate npm version | Optional environment setting described |

All plugin launchers use bundled code, not `npx`. OpenAI uses `${PLUGIN_ROOT}`;
Cursor specifically needs `${CURSOR_PLUGIN_ROOT}`; Claude uses `${CLAUDE_PLUGIN_ROOT}`.
The npm staging manifest has `private: true` and a failing prepublish guard deliberately.
Approval must remove these guards as part of explicit promotion, not packaging.

This describes the staged ZIPs. Git-backed marketplace installs are different:
ignored `server/dist` output will not exist in a GitHub checkout. Inactive
`promotion/` overlays therefore prepare the future stable npm pin for the root
Claude/Cursor manifests and Registry metadata. Do not apply them before npm
1.0.0 is published and verified. CLI mirrors/install assets and canonical
packaging scripts still require coordinated promotion; no current pin changes.

## Platform behavior

- Node 20+ for static tools. Node 22+ and an installed Chrome-family browser for
  `check_fold` (the canonical CDP driver uses global WebSocket).
- macOS/Linux: owned POSIX process groups, TERM then KILL, verified cleanup.
- Windows 10+: Windows PowerShell 5.1 compiles the bundled C# helper in memory.
  `PROC_THREAD_ATTRIBUTE_JOB_LIST` places the worker in a Job Object atomically
  at process creation. Kill-on-close, owner-death monitoring, a hard deadline,
  explicit termination and zero-active-process acknowledgement bound its lifetime.
  No `taskkill` tree snapshot, external package, policy bypass or profile loading.
  Restricted Add-Type/job policies fail closed; native Windows verification is pending.
- Cleanup failure preserves the job directory and prevents further calls in that
  server, rather than starting another potentially overlapping render.
- Two concurrent checks maximum, with at most one browser render per server.

## Rebuild and validate

From `experiments/skills-mcp`, with the local dependencies already installed:

```sh
nr build
nr test
python3 package-release.py
nr test:release
```

On Windows use `python package-release.py`. The test runner uses explicit file
lists, not shell glob expansion. Do not regenerate the Claude skills-only package.
`preserved-sources.json` and `verify-release.py` check existing source/pin/candidate
hashes; `SHA256SUMS.json` covers the five archives. ZIPs and the tarball normalize
timestamps. Rebuilds overwrite only staging outputs and prototype dist.

For real-browser lifecycle tests first count existing headless processes, then
set `UI_CRAFT_TEST_ENTRY` to the absolute staged `runtime/server.mjs` path and run
`nr test:browser`. Run serially, close all clients and check processes afterward.
This suite uses local HTTP fixtures, not user accounts or external websites.

`ci-matrix.yml` is an inactive draft outside `.github/workflows`: macOS, Linux,
Windows; Node 20/22/24. It does not run or publish anything until explicitly adopted.

## Release gates, not claims of completion

The later local lifecycle correction is documented in CROSS-HOST-TRIAL.md.
Historical Linux/client trials apply to their recorded pre-fix hashes; the revised
runtime is checked by local automatic regressions and extracted-package tests,
not another manual host trial. Do not conflate those validation scopes.

Updated measurements are in [CROSS-HOST-TRIAL.md](CROSS-HOST-TRIAL.md). Clean
Linux ARM64 static and extracted-package tests now pass under Node 20/22/24,
and actual personal OpenAI Codex and Cursor CLI hosts have passed tool tests.
OpenAI native-skill loading also passed. Linux browser lifecycle tests passed
under an explicitly approved, network-disabled test-only sandbox exception.
Windows, normal Linux browser-sandbox operation and desktop editor/app GUI trials
are not certified by those measurements.

1. Run Windows natively and complete Linux browser verification, including
   descendant cleanup and actual Chrome rendering on Node 22+.
2. Complete actual Cursor and OpenAI desktop UI trials in isolated profiles.
   SDK client tests are not host-installation tests. Re-test Claude's full staged
   package; the prior personal Claude trial tested the isolated prototype.
3. Validate the OpenAI package in its portal only after explicit authorization and
   organization allowlisting. No eligibility or approval is asserted here.
4. Resolve Claude Directory eligibility separately. Do not cancel, replace or
   modify the existing instruction-only candidacy to try the MCP edition.
5. Promote the candidate version and publish npm only after approval, then Registry;
   update live pins/install assets/docs and marketplaces as a coordinated change.
   Never point current installations at an unpublished version.
6. Review staged privacy copy before publishing its canonical policy URL. It
   describes bundled execution and direct browser requests; canonical privacy is unchanged.

No remote HTTPS server, OAuth service or hosting deployment is created. A cloud
connector is a separate design/security/deployment decision, not a packaging flag.

## References

- https://modelcontextprotocol.io/extensions/overview
- https://cursor.com/docs/reference/plugins
- https://code.claude.com/docs/en/plugins/manifest-reference
- https://developers.openai.com/plugins/deploy/desktop-only
- https://developers.openai.com/plugins/build/plugins
- https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects
- https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-updateprocthreadattribute
