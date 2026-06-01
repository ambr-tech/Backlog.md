@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-cross.ps1" true
exit /b %ERRORLEVEL%

