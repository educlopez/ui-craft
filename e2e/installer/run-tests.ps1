#Requires -Version 5.1
<#
.SYNOPSIS
    Windows E2E tests for scripts/install.ps1.

.DESCRIPTION
    Hermetic tests: serves a local fixture .zip + checksums.txt over
    http://127.0.0.1 via `python -m http.server` (or `python3`) and runs the
    real installer (as a separate pwsh process) against it. No network access
    required. Covers the PowerShell equivalents of the bash suite's T1
    (happy path), T2 (pinned version via -Version and via UI_CRAFT_VERSION),
    T3 (checksum mismatch), and T7 (PATH update message) — install.ps1 has no
    UI_CRAFT_INSTALL_DIR equivalent, so tests isolate installs by pointing
    $env:LOCALAPPDATA at a fresh temp directory per test.

.NOTES
    T7 exercises install.ps1's real `[Environment]::SetEnvironmentVariable`
    call against the "User" PATH scope. That is a genuine side effect on the
    machine running this script — acceptable only because CI runners are
    ephemeral. Do not run this against a real developer machine.
#>

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'
# PowerShell 7.3+ defaults to throwing a terminating error when a native
# command exits non-zero under $ErrorActionPreference = "Stop". We WANT
# install.ps1's non-zero exits (T3) to just set $LASTEXITCODE, not throw —
# so disable that behavior explicitly (no-op, harmless on older PowerShell
# where this variable doesn't exist yet).
$PSNativeCommandUseErrorActionPreference = $false

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = (Resolve-Path (Join-Path $ScriptDir "..\..")).Path
$InstallScript = Join-Path $RepoRoot "scripts\install.ps1"

# ---------------------------------------------------------------------------
# Counters + tiny pass/fail helpers
# ---------------------------------------------------------------------------
$script:Passed = 0
$script:Failed = 0

function Write-TestHeader($Message) { Write-Host "[TEST]  $Message" -ForegroundColor Yellow }
function Write-InfoLine($Message) { Write-Host "[INFO]  $Message" -ForegroundColor Cyan }

function Write-Pass($Message) {
    Write-Host "[PASS]  $Message" -ForegroundColor Green
    $script:Passed++
}

function Write-Fail($Message) {
    Write-Host "[FAIL]  $Message" -ForegroundColor Red
    $script:Failed++
}

function Assert-Eq($Actual, $Expected, $Label) {
    if ($Actual -eq $Expected) { Write-Pass "$Label (got: $Actual)" }
    else { Write-Fail "$Label (expected: $Expected, got: $Actual)" }
}

# Assert-Contains: PowerShell's -match is case-insensitive by default, so
# "checksum" matches the installer's "Checksum mismatch..." message too.
function Assert-Contains($Haystack, $Needle, $Label) {
    if ($Haystack -match [regex]::Escape($Needle)) { Write-Pass $Label }
    else { Write-Fail "$Label (did not find '$Needle' in output)" }
}

function Assert-FileExists($Path, $Label) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) { Write-Pass $Label }
    else { Write-Fail "$Label (file not found: $Path)" }
}

function Assert-FileNotExists($Path, $Label) {
    if (-not (Test-Path -LiteralPath $Path)) { Write-Pass $Label }
    else { Write-Fail "$Label (file unexpectedly exists: $Path)" }
}

# ---------------------------------------------------------------------------
# Workspace
# ---------------------------------------------------------------------------
$WorkDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ui-craft-installer-e2e-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
$FixtureRoot = Join-Path $WorkDir "fixture"
New-Item -ItemType Directory -Path $FixtureRoot -Force | Out-Null

$ServerProcess = $null

function Stop-FixtureServer {
    if ($ServerProcess -and -not $ServerProcess.HasExited) {
        Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
    }
}

function Reset-InstallerEnv {
    Remove-Item Env:UI_CRAFT_VERSION -ErrorAction SilentlyContinue
    Remove-Item Env:UI_CRAFT_INSTALL_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:UI_CRAFT_BASE_URL -ErrorAction SilentlyContinue
    Remove-Item Env:UI_CRAFT_API_URL -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Locate a python interpreter for the fixture HTTP server. GH's windows-latest
# runners ship python3 under the name `python`.
# ---------------------------------------------------------------------------
$PythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $PythonCmd) { $PythonCmd = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $PythonCmd) {
    throw "No 'python' or 'python3' found on PATH — cannot serve installer fixtures."
}

try {
    # -------------------------------------------------------------------
    # Build a real, tiny Windows executable that prints "ui-craft
    # 9.9.9-test" and exits 0. install.ps1 requires a genuine PE image at
    # <install-dir>\ui-craft.exe (it shells out to it to verify install),
    # so a plain text/batch file renamed .exe will not work.
    # -------------------------------------------------------------------
    $FakeVersion = "9.9.9-test"
    $GoodTag = "v$FakeVersion"
    $BadsumTag = "v$FakeVersion-badsum"
    $Arch = "amd64"
    $GoodArchiveName = "ui-craft_${FakeVersion}_windows_${Arch}.zip"
    $BadsumArchiveName = "ui-craft_${FakeVersion}-badsum_windows_${Arch}.zip"

    Write-InfoLine "Building fixture server tree at $FixtureRoot"

    # Compile via csc.exe (the .NET Framework C# compiler shipped with every
    # Windows image) rather than Add-Type, so the result is a genuine
    # Framework-style PE that Windows can CreateProcess directly — a
    # Roslyn/Add-Type-emitted assembly is not guaranteed runnable without an
    # apphost, which we cannot verify without a real Windows box.
    $ExeBuildDir = Join-Path $WorkDir "exe-build"
    New-Item -ItemType Directory -Path $ExeBuildDir -Force | Out-Null
    $FakeExePath = Join-Path $ExeBuildDir "ui-craft.exe"
    $CsFilePath = Join-Path $ExeBuildDir "Program.cs"

    $fakeExeSource = @"
using System;
class UiCraftFakeBinary {
    static int Main(string[] args) {
        Console.WriteLine("ui-craft $FakeVersion");
        return 0;
    }
}
"@
    Set-Content -Path $CsFilePath -Value $fakeExeSource

    $cscCandidates = @(
        (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
        (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
    )
    $csc = $cscCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $csc) {
        $cscCmd = Get-Command csc.exe -ErrorAction SilentlyContinue
        if ($cscCmd) { $csc = $cscCmd.Source }
    }
    if (-not $csc) {
        throw "csc.exe (.NET Framework C# compiler) not found — cannot build the fake ui-craft.exe test fixture."
    }

    & $csc /nologo "/out:$FakeExePath" $CsFilePath
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $FakeExePath)) {
        throw "Failed to compile the fake ui-craft.exe test fixture (csc exit $LASTEXITCODE)."
    }

    # -- good tag: valid archive + correct checksums.txt -----------------
    $goodDir = Join-Path $FixtureRoot $GoodTag
    New-Item -ItemType Directory -Path $goodDir -Force | Out-Null
    $goodZipPath = Join-Path $goodDir $GoodArchiveName
    Compress-Archive -Path $FakeExePath -DestinationPath $goodZipPath -Force

    $goodHash = (Get-FileHash -Path $goodZipPath -Algorithm SHA256).Hash
    Set-Content -Path (Join-Path $goodDir "checksums.txt") -Value "$goodHash  $GoodArchiveName" -NoNewline:$false

    # -- api lookup fixture: default (no -Version) path resolves to GoodTag
    $apiDir = Join-Path $FixtureRoot "api"
    New-Item -ItemType Directory -Path $apiDir -Force | Out-Null
    Set-Content -Path (Join-Path $apiDir "latest.json") -Value "{`"tag_name`": `"$GoodTag`", `"name`": `"$GoodTag`"}"

    # -- badsum tag: any archive is fine (checksum fails before extraction)
    $badsumDir = Join-Path $FixtureRoot $BadsumTag
    New-Item -ItemType Directory -Path $badsumDir -Force | Out-Null
    $badsumZipPath = Join-Path $badsumDir $BadsumArchiveName
    Compress-Archive -Path $FakeExePath -DestinationPath $badsumZipPath -Force
    $tamperedHash = "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
    Set-Content -Path (Join-Path $badsumDir "checksums.txt") -Value "$tamperedHash  $BadsumArchiveName"

    # ---------------------------------------------------------------------
    # Start the fixture HTTP server on a random local port.
    # ---------------------------------------------------------------------
    $ServerUrl = $null
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        $port = Get-Random -Minimum 20000 -Maximum 40000
        $candidateUrl = "http://127.0.0.1:$port"

        $ServerProcess = Start-Process -FilePath $PythonCmd.Source `
            -ArgumentList @("-m", "http.server", "$port", "--bind", "127.0.0.1") `
            -WorkingDirectory $FixtureRoot `
            -WindowStyle Hidden `
            -PassThru `
            -RedirectStandardOutput (Join-Path $WorkDir "server.out.log") `
            -RedirectStandardError (Join-Path $WorkDir "server.err.log")

        $ready = $false
        for ($i = 0; $i -lt 20; $i++) {
            if ($ServerProcess.HasExited) { break }
            try {
                Invoke-WebRequest -Uri "$candidateUrl/api/latest.json" -UseBasicParsing -TimeoutSec 2 | Out-Null
                $ready = $true
                break
            } catch {
                Start-Sleep -Milliseconds 300
            }
        }

        if ($ready) {
            $ServerUrl = $candidateUrl
            break
        }

        Stop-FixtureServer
        $ServerProcess = $null
    }

    if (-not $ServerUrl) {
        throw "Could not start fixture HTTP server after 5 attempts."
    }
    Write-InfoLine "Fixture server running at $ServerUrl (pid $($ServerProcess.Id))"

    $ApiUrl = "$ServerUrl/api/latest.json"

    # -----------------------------------------------------------------
    # Invoke-Installer: run install.ps1 as a genuinely separate pwsh
    # process so `exit` inside it never touches this test session, and so
    # env-var isolation between tests is exact (child process env only).
    # Exit code comes from Process.ExitCode via Start-Process -PassThru —
    # deliberately NOT $LASTEXITCODE, which proved unreliable for this
    # call-and-capture pattern on the Windows runner. The variable is
    # named InstallerExitCode so it can never shadow the automatic one.
    # -----------------------------------------------------------------
    $script:LastOutput = ""
    $script:InstallerExitCode = 0

    function Invoke-Installer {
        param([string[]]$InstallerArgs = @())
        $pwshPath = (Get-Process -Id $PID).Path
        $stdoutFile = Join-Path $WorkDir "installer-stdout.txt"
        $stderrFile = Join-Path $WorkDir "installer-stderr.txt"
        $argList = @("-NoProfile", "-File", $InstallScript) + $InstallerArgs
        $proc = Start-Process -FilePath $pwshPath -ArgumentList $argList `
            -Wait -PassThru -NoNewWindow `
            -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
        $out = ""
        if (Test-Path -LiteralPath $stdoutFile) { $out += (Get-Content -LiteralPath $stdoutFile -Raw -ErrorAction SilentlyContinue) }
        if (Test-Path -LiteralPath $stderrFile) { $out += (Get-Content -LiteralPath $stderrFile -Raw -ErrorAction SilentlyContinue) }
        $script:LastOutput = $out
        $script:InstallerExitCode = $proc.ExitCode
    }

    # =====================================================================
    # T1 — happy path: install from fixture server (default/latest lookup)
    # =====================================================================
    Write-TestHeader "T1 - happy path install from fixture server"
    Reset-InstallerEnv
    $localAppData1 = Join-Path $WorkDir "t1-localappdata"
    New-Item -ItemType Directory -Path $localAppData1 -Force | Out-Null
    $env:LOCALAPPDATA = $localAppData1
    $env:UI_CRAFT_BASE_URL = $ServerUrl
    $env:UI_CRAFT_API_URL = $ApiUrl
    Invoke-Installer
    Reset-InstallerEnv

    $installedExe1 = Join-Path $localAppData1 "ui-craft\bin\ui-craft.exe"
    Assert-Eq $InstallerExitCode 0 "T1: installer exits 0"
    Assert-FileExists $installedExe1 "T1: binary present at install dir"
    if (Test-Path -LiteralPath $installedExe1) {
        $t1Run = & $installedExe1
        Assert-Contains $t1Run $FakeVersion "T1: installed binary runs and reports fixture version"
    } else {
        Write-Fail "T1: installed binary missing, cannot run it"
    }

    # =====================================================================
    # T2 — pinned version via -Version and via UI_CRAFT_VERSION
    # =====================================================================
    Write-TestHeader "T2a - pinned version via -Version param"
    Reset-InstallerEnv
    $localAppData2a = Join-Path $WorkDir "t2a-localappdata"
    New-Item -ItemType Directory -Path $localAppData2a -Force | Out-Null
    $env:LOCALAPPDATA = $localAppData2a
    $env:UI_CRAFT_BASE_URL = $ServerUrl
    $env:UI_CRAFT_API_URL = $ApiUrl
    Invoke-Installer -InstallerArgs @("-Version", $GoodTag)
    Reset-InstallerEnv

    $installedExe2a = Join-Path $localAppData2a "ui-craft\bin\ui-craft.exe"
    Assert-Eq $InstallerExitCode 0 "T2a: installer exits 0 with -Version"
    Assert-FileExists $installedExe2a "T2a: binary present at install dir"

    Write-TestHeader "T2b - pinned version via UI_CRAFT_VERSION env"
    Reset-InstallerEnv
    $localAppData2b = Join-Path $WorkDir "t2b-localappdata"
    New-Item -ItemType Directory -Path $localAppData2b -Force | Out-Null
    $env:LOCALAPPDATA = $localAppData2b
    $env:UI_CRAFT_BASE_URL = $ServerUrl
    $env:UI_CRAFT_API_URL = $ApiUrl
    $env:UI_CRAFT_VERSION = $GoodTag
    Invoke-Installer
    Reset-InstallerEnv

    $installedExe2b = Join-Path $localAppData2b "ui-craft\bin\ui-craft.exe"
    Assert-Eq $InstallerExitCode 0 "T2b: installer exits 0 with UI_CRAFT_VERSION"
    Assert-FileExists $installedExe2b "T2b: binary present at install dir"

    # =====================================================================
    # T3 — checksum mismatch: tampered checksums.txt must abort the install
    # =====================================================================
    Write-TestHeader "T3 - tampered checksums.txt is rejected"
    Reset-InstallerEnv
    $localAppData3 = Join-Path $WorkDir "t3-localappdata"
    New-Item -ItemType Directory -Path $localAppData3 -Force | Out-Null
    $env:LOCALAPPDATA = $localAppData3
    $env:UI_CRAFT_BASE_URL = $ServerUrl
    $env:UI_CRAFT_API_URL = $ApiUrl
    $env:UI_CRAFT_VERSION = $BadsumTag
    Invoke-Installer
    Reset-InstallerEnv

    if ($InstallerExitCode -ne 0) { Write-Pass "T3: installer exits non-zero on checksum mismatch" }
    else { Write-Fail "T3: installer exits non-zero on checksum mismatch (got $InstallerExitCode)" }
    Assert-Contains $LastOutput "mismatch" "T3: error output mentions the checksum mismatch"
    Assert-FileNotExists (Join-Path $localAppData3 "ui-craft\bin\ui-craft.exe") "T3: binary was NOT installed"

    # =====================================================================
    # T7 — PATH update message (install.ps1 has no PATH "warning" branch: it
    # unconditionally updates the user PATH the first time and prints it)
    # =====================================================================
    Write-TestHeader "T7 - prints PATH update message on first install"
    Reset-InstallerEnv
    $localAppData7 = Join-Path $WorkDir "t7-localappdata"
    New-Item -ItemType Directory -Path $localAppData7 -Force | Out-Null
    $env:LOCALAPPDATA = $localAppData7
    $env:UI_CRAFT_BASE_URL = $ServerUrl
    $env:UI_CRAFT_API_URL = $ApiUrl
    $env:UI_CRAFT_VERSION = $GoodTag
    Invoke-Installer
    Reset-InstallerEnv

    Assert-Eq $InstallerExitCode 0 "T7: installer still succeeds"
    Assert-Contains $LastOutput "your user PATH" "T7: prints the PATH update message"

    Remove-Item Env:LOCALAPPDATA -ErrorAction SilentlyContinue
} finally {
    Stop-FixtureServer
    Remove-Item -Path $WorkDir -Recurse -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "========================================"
Write-Host "  Installer E2E Summary (Windows)"
Write-Host "========================================"
Write-Host ("  PASSED: {0}" -f $script:Passed) -ForegroundColor Green
Write-Host ("  FAILED: {0}" -f $script:Failed) -ForegroundColor Red
Write-Host "========================================"

if ($script:Failed -gt 0) {
    exit 1
}
exit 0
