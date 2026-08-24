$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$releaseDirectory = Join-Path $root "release"
$archive = Join-Path $releaseDirectory "Slacktor-0.1.0.zip"

New-Item -ItemType Directory -Force -Path $releaseDirectory | Out-Null
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
Compress-Archive -Path (Join-Path $root "dist\*") -DestinationPath $archive
Write-Output $archive
