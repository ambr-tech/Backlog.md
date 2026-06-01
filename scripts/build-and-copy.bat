@echo off
echo [1/3] ビルド開始...
call "%~dp0build-cross.bat"
if %ERRORLEVEL% neq 0 (
    echo ビルドに失敗しました。処理を中断します。
    pause
    exit /b %ERRORLEVEL%
)

echo [2/3] dist削除中...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0delete-dist-run-backlog.ps1"
if %ERRORLEVEL% neq 0 (
    echo distの削除に失敗しました。処理を中断します。
    pause
    exit /b %ERRORLEVEL%
)

echo [3/3] distコピー中...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0copy-dist-to-run.ps1"
if %ERRORLEVEL% neq 0 (
    echo distのコピーに失敗しました。
    pause
    exit /b %ERRORLEVEL%
)

echo 全処理が完了しました。
pause
