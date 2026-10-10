$ErrorActionPreference = 'Stop'
foreach ($value in @($env:WINDOWS_SIGNING_SCRIPT, $env:WINDOWS_SIGNING_SUBJECT, $env:WINDOWS_SIGNING_THUMBPRINT, $env:RFC3161_TIMESTAMP_URL)) {
  if ([string]::IsNullOrWhiteSpace($value)) { throw 'protected signing policy input missing' }
}
if (-not [IO.Path]::IsPathRooted($env:WINDOWS_SIGNING_SCRIPT)) { throw 'signing script must be absolute' }
$script = [IO.Path]::GetFullPath($env:WINDOWS_SIGNING_SCRIPT)
$checkout = [IO.Path]::GetFullPath($env:GITHUB_WORKSPACE) + [IO.Path]::DirectorySeparatorChar
if ($script.StartsWith($checkout, [StringComparison]::OrdinalIgnoreCase)) { throw 'signer must be outside checkout' }
if ((Get-Item -LiteralPath $script).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'signer reparse point forbidden' }
New-Item -ItemType Directory -Force evidence/authenticode/signer | Out-Null
& $script -ArtifactsPath (Resolve-Path dist-electron) -TimestampUrl $env:RFC3161_TIMESTAMP_URL -EvidencePath (Resolve-Path evidence/authenticode/signer)
if ($LASTEXITCODE -ne 0) { throw 'external signer failed' }
Set-Content -LiteralPath downstream-success.txt -Value 'not reached'
