@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-cross-direct-tailwind.ps1" %*
exit /b %ERRORLEVEL%
