#requires -Version 5.1
$ErrorActionPreference = "Stop"
$exitCode = 0

try {
  $repoRoot = Split-Path -Parent $PSScriptRoot
  Set-Location $repoRoot

  bun ./node_modules/@tailwindcss/cli/dist/index.mjs -i src/web/styles/source.css -o src/web/styles/style.css --minify
  if ($LASTEXITCODE -ne 0) { throw "Tailwind CSS build failed" }

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

  Write-Host ""
  Write-Host "Done." -ForegroundColor Green
  Get-ChildItem dist | Format-Table Name, Length, LastWriteTime | Out-String | Write-Host
}
catch {
  $exitCode = 1
  Write-Host ""
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  if ($_.ScriptStackTrace) { Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed }
}
finally {
  Write-Host ""
  if (-not [System.Console]::IsInputRedirected) {
    Write-Host "Press any key to exit..."
    [void][System.Console]::ReadKey($true)
  } else {
    Read-Host "Press Enter to exit"
  }
}

exit $exitCode
