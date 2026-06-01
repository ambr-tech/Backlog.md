$projectRoot = Split-Path $PSScriptRoot -Parent
$target = Join-Path $projectRoot 'dist\run\backlog.exe'

Write-Host "============================================================"
Write-Host " backlog.exe Process Release & File Deletion Script"
Write-Host "============================================================"
Write-Host ""
Write-Host "Target: $target"
Write-Host ""
Write-Host "NOTE: Claude Code MCP sessions may be disconnected"
Write-Host ""

if (-not (Test-Path $target)) {
    Write-Host "[INFO] Target file does not exist."
    exit 0
}

Write-Host "[Step 1] Searching for locked processes..."
$procs = Get-Process -Name backlog -ErrorAction SilentlyContinue |
         Where-Object { $_.Path -eq $target }

if ($procs) {
    Write-Host ("  Found: " + $procs.Count + " process(es)")
    $procs | ForEach-Object { Write-Host ("    PID: " + $_.Id) }
} else {
    Write-Host "  No matching processes found"
}

Write-Host ""
Write-Host "[Step 2] Terminating processes..."
if ($procs) {
    $procs | ForEach-Object {
        $id = $_.Id
        Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
        Write-Host ("  Killed PID: " + $id)
    }
    Start-Sleep -Milliseconds 1500
}

Write-Host ""
Write-Host "[Step 3] Checking remaining processes..."
$remaining = Get-Process -Name backlog -ErrorAction SilentlyContinue |
             Where-Object { $_.Path -eq $target }

if ($remaining) {
    Write-Host ("  [WARNING] " + $remaining.Count + " process(es) still running")
    Write-Host "  Try running as Administrator"
    exit 1
}
Write-Host "  All target processes terminated"

Write-Host ""
Write-Host "[Step 4] Deleting file..."
Remove-Item -Path $target -Force -ErrorAction SilentlyContinue

if (Test-Path $target) {
    Write-Host "  [ERROR] Failed to delete file"
    exit 1
}

Write-Host "  [DONE] Deleted: $target"
Write-Host ""
Write-Host "============================================================"
Write-Host " Completed"
Write-Host "============================================================"
