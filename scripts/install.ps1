#Requires -Version 5.1
<#
.SYNOPSIS
    Install the ui-craft CLI binary on Windows.

.DESCRIPTION
    Detects OS architecture, downloads the latest (or a pinned) ui-craft
    release from GitHub, verifies its sha256 checksum against the release's
    checksums.txt, and installs the binary into a per-user directory that is
    added to the user PATH.

.EXAMPLE
    irm https://skills.smoothui.dev/install.ps1 | iex

.EXAMPLE
    $env:UI_CRAFT_VERSION = "v0.36.0"
    irm https://skills.smoothui.dev/install.ps1 | iex
#>

[CmdletBinding()]
param(
    [string]$Version = $env:UI_CRAFT_VERSION
)

$ErrorActionPreference = "Stop"
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Repo = "educlopez/ui-craft"
$BinaryName = "ui-craft.exe"

# Undocumented overrides for offline/e2e testing only — not part of the
# public interface, do not surface these in help text or README.
$UiCraftBaseUrl = if ($env:UI_CRAFT_BASE_URL) { $env:UI_CRAFT_BASE_URL } else { "https://github.com/$Repo/releases/download" }
$UiCraftApiUrl = if ($env:UI_CRAFT_API_URL) { $env:UI_CRAFT_API_URL } else { "https://api.github.com/repos/$Repo/releases/latest" }

function Write-Info($Message) {
    Write-Host "[info] $Message" -ForegroundColor Cyan
}

function Write-Warn($Message) {
    Write-Host "[warn] $Message" -ForegroundColor Yellow
}

function Write-ErrorAndExit($Message) {
    throw $Message
}

# Fatals raised before the main try/finally (arch/version validation) land
# here: print them cleanly and exit non-zero instead of dumping a raw
# exception. Fatals inside the main block are handled by its own catch.
trap {
    Write-Host "[error] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# --- architecture detection ------------------------------------------------

$archRaw = $env:PROCESSOR_ARCHITEW6432
if (-not $archRaw) {
    $archRaw = $env:PROCESSOR_ARCHITECTURE
}

switch ($archRaw) {
    "AMD64" { $arch = "amd64" }
    "ARM64" { $arch = "arm64" }
    default {
        Write-ErrorAndExit "Unsupported architecture '$archRaw'. Download a binary manually from https://github.com/$Repo/releases"
    }
}

# --- version resolution -----------------------------------------------------

if (-not $Version) {
    Write-Info "Looking up the latest release..."
    try {
        $latest = Invoke-RestMethod -Uri $UiCraftApiUrl -UseBasicParsing
    } catch {
        Write-ErrorAndExit "Failed to query the GitHub releases API: $_"
    }
    $tag = $latest.tag_name
    if (-not $tag) {
        Write-ErrorAndExit "Could not parse the latest release tag."
    }
} else {
    $tag = $Version
}

if ($tag -match "^v") {
    $archiveVersion = $tag.Substring(1)
} else {
    $archiveVersion = $tag
    $tag = "v$tag"
}

Write-Info "Installing ui-craft $tag (windows/$arch)"

$archiveName = "ui-craft_${archiveVersion}_windows_${arch}.zip"
$baseUrl = "$UiCraftBaseUrl/$tag"

# --- download ----------------------------------------------------------

$tmpDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ui-craft-install-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

$exitCode = 0
try {
    $archivePath = Join-Path $tmpDir $archiveName
    $checksumsPath = Join-Path $tmpDir "checksums.txt"

    Write-Info "Downloading $archiveName..."
    try {
        Invoke-WebRequest -Uri "$baseUrl/$archiveName" -OutFile $archivePath -UseBasicParsing
    } catch {
        Write-ErrorAndExit "Download failed. Check that $tag has a release asset for windows/$arch. $_"
    }

    try {
        Invoke-WebRequest -Uri "$baseUrl/checksums.txt" -OutFile $checksumsPath -UseBasicParsing
    } catch {
        Write-ErrorAndExit "Failed to download checksums.txt for verification: $_"
    }

    # --- verify ----------------------------------------------------------

    Write-Info "Verifying checksum..."
    $checksumPattern = "(?m)^([0-9a-fA-F]{64})\s+" + [regex]::Escape($archiveName) + "\s*$"
    $checksumMatches = [regex]::Matches((Get-Content -Path $checksumsPath -Raw), $checksumPattern)
    if ($checksumMatches.Count -eq 0) {
        Write-ErrorAndExit "No checksum entry found for $archiveName in checksums.txt."
    }
    if ($checksumMatches.Count -gt 1) {
        Write-ErrorAndExit "Multiple checksum entries found for $archiveName in checksums.txt."
    }
    $expectedSum = $checksumMatches[0].Groups[1].Value.ToLowerInvariant()

    $actualSum = (Get-FileHash -Path $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expectedSum -ne $actualSum) {
        Write-ErrorAndExit "Checksum mismatch for ${archiveName}: expected $expectedSum, got $actualSum."
    }
    Write-Info "Checksum OK."

    # --- extract -----------------------------------------------------------

    $extractDir = Join-Path $tmpDir "extracted"
    Expand-Archive -Path $archivePath -DestinationPath $extractDir -Force

    $extractedBinary = Join-Path $extractDir $BinaryName
    if (-not (Test-Path $extractedBinary)) {
        Write-ErrorAndExit "Extracted archive did not contain $BinaryName."
    }

    # --- install -------------------------------------------------------

    $installDir = Join-Path $env:LOCALAPPDATA "ui-craft\bin"
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null

    $installedBinary = Join-Path $installDir $BinaryName
    Copy-Item -Path $extractedBinary -Destination $installedBinary -Force

    # --- verify install ---------------------------------------------------

    try {
        & $installedBinary version | Out-Null
    } catch {
        Write-ErrorAndExit "Installed binary at $installedBinary did not run successfully: $_"
    }
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorAndExit "Installed binary at $installedBinary did not run successfully (exit code $LASTEXITCODE)."
    }

    Write-Info "Installed ui-craft to $installedBinary"

    # --- PATH update (user scope) -------------------------------------------

    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $pathEntries = @()
    if ($userPath) {
        $pathEntries = $userPath -split ";" | Where-Object { $_ -ne "" }
    }

    if ($pathEntries -notcontains $installDir) {
        $newPath = if ($userPath) { "$userPath;$installDir" } else { $installDir }
        [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
        Write-Warn "Added $installDir to your user PATH. Reopen your terminal for this to take effect."
    }

    Write-Host ""
    Write-Info "Run 'ui-craft' for the interactive hub, or 'ui-craft install' to wire your harnesses."
    Write-Info "Updates: 'ui-craft self-update'."
} catch {
    Write-Host "[error] $($_.Exception.Message)" -ForegroundColor Red
    $exitCode = 1
} finally {
    Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}
exit $exitCode
