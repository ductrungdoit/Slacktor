$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$releaseDirectory = Join-Path $root "release"
$package = Get-Content -LiteralPath (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$archive = Join-Path $releaseDirectory "Slacktor-$($package.version).zip"

New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
Compress-Archive -Path (Join-Path $root "dist\*") -DestinationPath $archive
Write-Output $archive
