@echo off
title Le Vantage Print Proxy - Setup
color 0E

echo ==========================================
echo   Le Vantage Print Proxy - Setup
echo ==========================================
echo.

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please install Node.js first:
    echo   1. Go to https://nodejs.org
    echo   2. Download the LTS version
    echo   3. Install it (just click Next through the wizard)
    echo   4. Run this setup again
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found:
node --version
echo.

:: Create install directory
set INSTALL_DIR=%USERPROFILE%\LeVantage-PrintProxy
echo Installing to: %INSTALL_DIR%
echo.

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Download files from GitHub
echo Downloading latest files from GitHub...
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/index.js' -OutFile '%INSTALL_DIR%\index.js'"
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/package.json' -OutFile '%INSTALL_DIR%\package.json'"
powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/start.bat' -OutFile '%INSTALL_DIR%\start.bat'"
echo [OK] Files downloaded
echo.

:: Create .env file if it doesn't exist
if not exist "%INSTALL_DIR%\.env" (
    echo Creating .env file...
    echo SUPABASE_URL=https://ivhmvhnrxiodpneflszu.supabase.co> "%INSTALL_DIR%\.env"
    echo SUPABASE_KEY=PASTE_YOUR_ANON_KEY_HERE>> "%INSTALL_DIR%\.env"
    echo.
    echo *** IMPORTANT: You need to edit the .env file! ***
    echo    File: %INSTALL_DIR%\.env
    echo    Replace PASTE_YOUR_ANON_KEY_HERE with your actual Supabase anon key
    echo.
) else (
    echo [OK] .env file already exists, keeping it
    echo.
)

:: Install npm dependencies
echo Installing dependencies...
cd /d "%INSTALL_DIR%"
call npm install
echo.
echo [OK] Dependencies installed
echo.

:: Create auto-start shortcut in Startup folder
echo Setting up auto-start...
set STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%STARTUP_FOLDER%\LeVantage-PrintProxy.lnk'); $sc.TargetPath = '%INSTALL_DIR%\start.bat'; $sc.WorkingDirectory = '%INSTALL_DIR%'; $sc.WindowStyle = 7; $sc.Description = 'Le Vantage Print Proxy'; $sc.Save()"
echo [OK] Auto-start enabled (runs on Windows startup, minimized)
echo.

echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo   Install location: %INSTALL_DIR%
echo   Auto-start: Enabled (Windows Startup folder)
echo.
echo   To start now: Double-click start.bat in
echo   %INSTALL_DIR%
echo.
echo   To stop auto-start: Delete the shortcut from
echo   %STARTUP_FOLDER%
echo.

pause
