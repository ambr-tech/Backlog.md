$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "dist"
$dst = Join-Path $root "dist\run"

if (-not (Test-Path $dst)) {
    New-Item -ItemType Directory -Path $dst | Out-Null
}

Copy-Item -Path (Join-Path $src "backlog")     -Destination (Join-Path $dst "backlog")     -Force
Copy-Item -Path (Join-Path $src "backlog.exe") -Destination (Join-Path $dst "backlog.exe") -Force

Write-Host "Copied: dist\backlog -> dist\run\backlog"
Write-Host "Copied: dist\backlog.exe -> dist\run\backlog.exe"
