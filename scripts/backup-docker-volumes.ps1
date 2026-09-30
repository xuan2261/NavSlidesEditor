[CmdletBinding()]
param(
  [string]$OutputDirectory = (
    Join-Path (Get-Location) ("backups/navslides-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  ),
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

Write-Warning "Backups contain credentials, share tokens, presentation content, and media."
$running = @(Invoke-Compose @("ps", "--status", "running", "--services"))
$wasRunning = $running -contains $Service
$backupError = $null
$restartError = $null

try {
  if ($wasRunning) {
    Invoke-Compose @("stop", $Service) | Out-Null
  }

  New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
  $resolvedOutput = (Resolve-Path $OutputDirectory).Path
  if (-not $IsWindows) { & chmod 700 $resolvedOutput }

  $mount = "${resolvedOutput}:/backup"
  $hostUid = if ($IsWindows) { "0" } else { (& id -u).Trim() }
  $hostGid = if ($IsWindows) { "0" } else { (& id -g).Trim() }
  $archiveCommand = @"
set -eu
tar -czf /backup/revealjs-data.tar.gz -C /app/server/data .
tar -czf /backup/revealjs-uploads.tar.gz -C /app/server/uploads .
chown ${hostUid}:${hostGid} /backup/revealjs-data.tar.gz /backup/revealjs-uploads.tar.gz
"@
  Invoke-Compose @(
    "run", "--rm", "--no-deps", "--user", "0:0",
    "-v", $mount, "--entrypoint", "sh", $Service, "-c", $archiveCommand
  ) | Out-Null

  $archives = @(
    @{ volume = "revealjs-data"; path = "/app/server/data"; archive = "revealjs-data.tar.gz" },
    @{ volume = "revealjs-uploads"; path = "/app/server/uploads"; archive = "revealjs-uploads.tar.gz" }
  )
  foreach ($item in $archives) {
    $file = Join-Path $resolvedOutput $item.archive
    $item.sha256 = (Get-FileHash -Algorithm SHA256 $file).Hash.ToLowerInvariant()
    if (-not $IsWindows) { & chmod 600 $file }
  }
  $manifest = [ordered]@{
    schemaVersion = 1
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    service = $Service
    stoppedConsistencyPoint = $true
    volumes = $archives
  }
  $manifestPath = Join-Path $resolvedOutput "manifest.json"
  $manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8NoBOM $manifestPath
  if (-not $IsWindows) { & chmod 600 $manifestPath }
  Write-Output $manifestPath
} catch {
  $backupError = $_
} finally {
  if ($wasRunning) {
    try {
      Invoke-Compose @("start", $Service) | Out-Null
      Wait-ServiceHealthy -Name $Service
    } catch {
      $restartError = $_
    }
  }
}

if ($backupError -or $restartError) {
  $parts = @()
  if ($backupError) { $parts += "backupError=$($backupError.Exception.Message)" }
  if ($restartError) { $parts += "restartError=$($restartError.Exception.Message)" }
  throw ($parts -join "; ")
}
