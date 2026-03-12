@echo off
title Le Vantage Print Proxy
echo ============================================
echo    Le Vantage Cafe - Print Proxy
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

cd /d "%~dp0print-server"

:: Auto-update: download latest index.js from GitHub
echo Checking for updates...
curl -s -o index.js.tmp https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/index.js
if %errorlevel% equ 0 (
    move /y index.js.tmp index.js >nul
    echo Updated to latest version.
) else (
    echo Could not check for updates, using current version.
    del index.js.tmp >nul 2>&1
)
echo.

echo Starting Print Proxy...
echo Listening for print jobs from Supabase...
echo.

node index.js

echo.
echo Print Proxy stopped.
pause
