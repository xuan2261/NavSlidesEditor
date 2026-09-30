[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$BackupDirectory,
  [string]$Service = "revealjs-editor"
)

$ErrorActionPreference = "Stop"

function Invoke-Compose {
  param([Parameter(Mandatory)][string[]]$Arguments)
  $output = & docker compose @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose $($Arguments -join ' ') failed: $($output -join [Environment]::NewLine)"
  }
  return $output
}

function Wait-ServiceHealthy {
  param([string]$Name, [int]$TimeoutSeconds = 90)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $json = (Invoke-Compose @("ps", "--format", "json", $Name)) -join "`n"
    if ($json) {
      $rows = @($json | ConvertFrom-Json)
      if ($rows.Count -and $rows[0].State -eq "running" -and $rows[0].Health -eq "healthy") {
        return
      }
    }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "Service $Name did not become healthy"
}

$resolvedBackup = (Resolve-Path $BackupDirectory).Path
$manifestPath = Join-Path $resolvedBackup "manifest.json"
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or @($manifest.volumes).Count -ne 2) {
  throw "Invalid backup manifest"
}

$expectedArchives = @{
  "revealjs-data" = "revealjs-data.tar.gz"
  "revealjs-uploads" = "revealjs-uploads.tar.gz"
}
$seenVolumes = @{}
foreach ($item in $manifest.volumes) {
  if (
    -not $expectedArchives.ContainsKey([string]$item.volume) -or
    $expectedArchives[[string]$item.volume] -ne [string]$item.archive -or
    [string]$item.sha256 -notmatch '^[0-9a-fA-F]{64}$' -or
    $seenVolumes.ContainsKey([string]$item.volume)
  ) {
    throw "Invalid backup manifest volume entry"
  }
  $seenVolumes[[string]$item.volume] = $true
  $archivePath = Join-Path $resolvedBackup $item.archive
  $actual = (Get-FileHash -Algorithm SHA256 $archivePath).Hash.ToLowerInvariant()
  if ($actual -ne $item.sha256) {
    throw "Archive hash mismatch: $($item.archive)"
  }
}

$running = @(Invoke-Compose @("ps", "--status", "running", "--services"))
if ($running -contains $Service) {
  throw "Restore target must be stopped"
}

$mount = "${resolvedBackup}:/backup:ro"
$emptyCheck = @'
set -eu
test -z "$(find /app/server/data -mindepth 1 -maxdepth 1 -print -quit)"
test -z "$(find /app/server/uploads -mindepth 1 -maxdepth 1 -print -quit)"
'@
Invoke-Compose @(
  "run", "--rm", "--no-deps", "--user", "0:0",
  "-v", $mount, "--entrypoint", "sh", $Service, "-c", $emptyCheck
) | Out-Null

$extract = @'
set -eu
tar -xzf /backup/revealjs-data.tar.gz -C /app/server/data
tar -xzf /backup/revealjs-uploads.tar.gz -C /app/server/uploads
chown -R 10001:10001 /app/server/data /app/server/uploads
'@
Invoke-Compose @(
  "run", "--rm", "--no-deps", "--user", "0:0",
  "-v", $mount, "--entrypoint", "sh", $Service, "-c", $extract
) | Out-Null

Invoke-Compose @("up", "-d", $Service) | Out-Null
Wait-ServiceHealthy -Name $Service

$proof = @'
const fs = require("node:fs");
const path = require("node:path");
const data = "/app/server/data";
const uploads = "/app/server/uploads";
JSON.parse(fs.readFileSync(path.join(data, "presentations.json"), "utf8"));
for (const required of ["pptx-originals", "history", "settings.json"]) {
  if (!fs.existsSync(path.join(data, required))) throw new Error(`missing ${required}`);
}
const media = fs.readdirSync(uploads, { withFileTypes: true }).find((entry) => entry.isFile());
(async () => {
  if (!media) return;
  const response = await fetch(`http://127.0.0.1:3002/uploads/${encodeURIComponent(media.name)}`);
  if (!response.ok) throw new Error("media retrieval failed");
})().catch((error) => { console.error(error); process.exit(1); });
'@
Invoke-Compose @("exec", "-T", $Service, "node", "-e", $proof) | Out-Null
Write-Output "Restore verified: presentations, package originals, history, settings, and media."
