@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-cross.ps1" false
exit /b %ERRORLEVEL%
