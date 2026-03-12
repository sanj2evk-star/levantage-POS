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

echo Starting Print Proxy...
echo Listening for print jobs from Supabase...
echo.

cd /d "%~dp0print-server"
node index.js

echo.
echo Print Proxy stopped.
pause
