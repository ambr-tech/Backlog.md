#requires -Version 5.1
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

bun run build:css
if ($LASTEXITCODE -ne 0) { throw "build:css failed" }

$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
Write-Host "Building backlog v$version"

New-Item -ItemType Directory -Force -Path dist | Out-Null

$targets = @(
  @{ Name = "windows-x64";  Target = "bun-windows-x64-baseline"; Out = "dist/backlog.exe" },
  @{ Name = "darwin-arm64"; Target = "bun-darwin-arm64";         Out = "dist/backlog"     }
)

foreach ($t in $targets) {
  Write-Host "==> Building $($t.Name) ($($t.Target))"
  bun build src/cli.ts `
    --compile --minify `
    --target=$($t.Target) `
    --define "__EMBEDDED_VERSION__=`"$version`"" `
    --outfile=$($t.Out)
  if ($LASTEXITCODE -ne 0) { throw "build for $($t.Name) failed" }
}

Write-Host "Done."
Get-ChildItem dist | Format-Table Name, Length, LastWriteTime
