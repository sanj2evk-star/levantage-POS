@echo off
title Le Vantage Print Proxy - Setup
color 0E

echo.
echo ==========================================
echo   Le Vantage Print Proxy - Setup
echo ==========================================
echo.

:: Check if Node.js is installed - try common paths too
set NODE_FOUND=0
node --version >nul 2>&1 && set NODE_FOUND=1

if %NODE_FOUND%==0 (
    :: Try common install paths manually
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
        set NODE_FOUND=1
        echo Found Node.js at C:\Program Files\nodejs
    )
)

if %NODE_FOUND%==0 (
    echo ==========================================
    echo   ERROR: Node.js is not installed!
    echo ==========================================
    echo.
    echo   Please install Node.js first:
    echo     1. Go to https://nodejs.org
    echo     2. Download the LTS version
    echo     3. Install it - click Next through everything
    echo     4. RESTART your laptop
    echo     5. Double-click this setup file again
    echo.
    echo   Opening nodejs.org for you now...
    start https://nodejs.org
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
echo Downloading files from GitHub...
echo   - index.js (print proxy)...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/index.js' -OutFile '%INSTALL_DIR%\index.js'" 2>nul
if not exist "%INSTALL_DIR%\index.js" (
    echo   FAILED to download index.js - check internet connection
    pause
    exit /b 1
)
echo   - package.json...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/package.json' -OutFile '%INSTALL_DIR%\package.json'" 2>nul
echo   - start.bat...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/start.bat' -OutFile '%INSTALL_DIR%\start.bat'" 2>nul
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
    echo    Replace PASTE_YOUR_ANON_KEY_HERE with your Supabase anon key
    echo.
) else (
    echo [OK] .env file already exists, keeping it
    echo.
)

:: Install npm dependencies
echo Installing dependencies (this may take a minute)...
cd /d "%INSTALL_DIR%"
call npm install 2>&1
echo.
echo [OK] Dependencies installed
echo.

:: Create auto-start shortcut in Startup folder
echo Setting up auto-start...
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%STARTUP_FOLDER%\LeVantage-PrintProxy.lnk'); $sc.TargetPath = '%INSTALL_DIR%\start.bat'; $sc.WorkingDirectory = '%INSTALL_DIR%'; $sc.WindowStyle = 7; $sc.Description = 'Le Vantage Print Proxy'; $sc.Save()" 2>nul
echo [OK] Auto-start enabled
echo.

:: Create a desktop shortcut too
echo Creating desktop shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('%USERPROFILE%\Desktop\Start Print Proxy.lnk'); $sc.TargetPath = '%INSTALL_DIR%\start.bat'; $sc.WorkingDirectory = '%INSTALL_DIR%'; $sc.Description = 'Start Le Vantage Print Proxy'; $sc.Save()" 2>nul
echo [OK] Desktop shortcut created
echo.

echo ==========================================
echo   Setup Complete!
echo ==========================================
echo.
echo   Next steps:
echo     1. Edit .env file (add your Supabase key)
echo        Opening the folder for you now...
echo     2. Double-click "Start Print Proxy" on Desktop
echo.

:: Open the install folder so they can edit .env
start "" "%INSTALL_DIR%"

echo Press any key to close this window...
pause >nul
