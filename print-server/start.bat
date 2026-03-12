@echo off
title Le Vantage Print Proxy
color 0A

echo ==========================================
echo   Le Vantage Print Proxy - Starting...
echo ==========================================
echo.

cd /d "%~dp0"

:: Auto-update index.js from GitHub
echo Checking for updates...
powershell -Command "try { Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/index.js' -OutFile 'index.js' -ErrorAction Stop; Write-Host 'Updated to latest version' } catch { Write-Host 'Using existing version (no internet)' }"
echo.

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

:: Run the print proxy
echo Starting print proxy...
echo Press Ctrl+C to stop
echo.
node index.js

:: If it crashes, wait and restart
echo.
echo Print proxy stopped. Restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto :eof
