@echo off
title Le Vantage POS - Starting...
echo ============================================
echo    Le Vantage Cafe POS System
echo ============================================
echo.

:: Check if Node.js is installed
where node >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo Download from: https://nodejs.org
    pause
    exit /b 1
)

echo [1/3] Starting Print Server...
cd /d "%~dp0print-server"
start "Print Server" cmd /c "node index.js"
cd /d "%~dp0"

:: Wait for print server to start
timeout /t 2 /nobreak >/dev/null

echo [2/3] Starting POS App...
start "Le Vantage POS" cmd /c "npx next start -H 0.0.0.0 -p 3000"

:: Wait for Next.js to start
timeout /t 5 /nobreak >/dev/null

echo [3/3] Opening POS in browser...
start http://192.168.1.100:3000/pos

echo.
echo ============================================
echo    POS is running!
echo.
echo    Cashier:  http://192.168.1.100:3000/pos
echo    Waiter:   http://192.168.1.100:3000/waiter
echo    Kitchen:  http://192.168.1.100:3000/kitchen
echo    Admin:    http://192.168.1.100:3000/admin
echo ============================================
echo.
echo DO NOT close this window or the command windows behind it.
echo.
pause
