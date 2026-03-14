@echo off
title Le Vantage Print Proxy - Setup
color 0A

echo.
echo  ==========================================
echo    Le Vantage Print Proxy v3.0 - Setup
echo  ==========================================
echo.

:: ── Check Node.js ────────────────────────────────
set NODE_FOUND=0
node --version >nul 2>&1 && set NODE_FOUND=1

if %NODE_FOUND%==0 (
    if exist "C:\Program Files\nodejs\node.exe" (
        set "PATH=C:\Program Files\nodejs;%PATH%"
        set NODE_FOUND=1
    )
)

if %NODE_FOUND%==0 (
    color 0C
    echo  [ERROR] Node.js is not installed!
    echo.
    echo  Please install Node.js first:
    echo    1. Go to https://nodejs.org
    echo    2. Download the LTS version
    echo    3. Install it (click Next through everything)
    echo    4. RESTART your laptop
    echo    5. Run this setup again
    echo.
    echo  Opening nodejs.org...
    start https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo  [OK] Node.js %NODE_VER%

:: ── Setup directory ──────────────────────────────
set INSTALL_DIR=%USERPROFILE%\LeVantage-PrintProxy
echo  [..] Install path: %INSTALL_DIR%
echo.

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\ui" mkdir "%INSTALL_DIR%\ui"

:: ── Download all files from GitHub ───────────────
echo  Downloading latest files from GitHub...
set GH=https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server
set DL=powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri

%DL% '%GH%/index.js' -OutFile '%INSTALL_DIR%\index.js'" 2>nul
echo    - index.js
%DL% '%GH%/package.json' -OutFile '%INSTALL_DIR%\package.json'" 2>nul
echo    - package.json
%DL% '%GH%/electron-main.js' -OutFile '%INSTALL_DIR%\electron-main.js'" 2>nul
echo    - electron-main.js
%DL% '%GH%/preload.js' -OutFile '%INSTALL_DIR%\preload.js'" 2>nul
echo    - preload.js
%DL% '%GH%/ui/index.html' -OutFile '%INSTALL_DIR%\ui\index.html'" 2>nul
echo    - ui/index.html
%DL% '%GH%/electron-builder.yml' -OutFile '%INSTALL_DIR%\electron-builder.yml'" 2>nul
echo    - electron-builder.yml
%DL% '%GH%/start.bat' -OutFile '%INSTALL_DIR%\start.bat'" 2>nul
echo    - start.bat (fallback CLI launcher)

:: Verify critical file downloaded
if not exist "%INSTALL_DIR%\electron-main.js" (
    color 0C
    echo.
    echo  [ERROR] Download failed! Check your internet connection.
    pause
    exit /b 1
)
echo  [OK] All files downloaded
echo.

:: ── Setup .env ───────────────────────────────────
if not exist "%INSTALL_DIR%\.env" (
    color 0E
    echo  ==========================================
    echo    .env file not found - creating one
    echo  ==========================================
    echo.
    echo  SUPABASE_URL=https://ivhmvhnrxiodpneflszu.supabase.co> "%INSTALL_DIR%\.env"
    echo  SUPABASE_KEY=PASTE_YOUR_ANON_KEY_HERE>> "%INSTALL_DIR%\.env"
    echo  Opening .env in Notepad...
    echo  Replace PASTE_YOUR_ANON_KEY_HERE with your actual Supabase anon key.
    echo.
    start /wait notepad "%INSTALL_DIR%\.env"
    color 0A
    echo  [OK] .env saved
) else (
    echo  [OK] .env already exists, keeping it
)
echo.

:: ── Install npm dependencies ─────────────────────
echo  Installing dependencies (this may take 1-2 minutes)...
cd /d "%INSTALL_DIR%"
call npm install >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [WARN] Retrying npm install...
    call npm install
)
echo  [OK] Dependencies installed
echo.

:: ── Create run.bat launcher ──────────────────────
echo @echo off> "%INSTALL_DIR%\run.bat"
echo title Le Vantage Print Proxy>> "%INSTALL_DIR%\run.bat"
echo cd /d "%INSTALL_DIR%">> "%INSTALL_DIR%\run.bat"
echo npx electron .>> "%INSTALL_DIR%\run.bat"

:: ── Desktop shortcut ─────────────────────────────
echo  Creating desktop shortcut...
set "DESKTOP=%USERPROFILE%\Desktop"
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%DESKTOP%\LeVantage Print Proxy.lnk'); $s.TargetPath = '%INSTALL_DIR%\run.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'Le Vantage Print Proxy'; $s.WindowStyle = 7; $s.Save()" 2>nul
if %ERRORLEVEL% equ 0 (
    echo  [OK] Desktop shortcut created
) else (
    echo  [WARN] Shortcut creation failed - run manually: %INSTALL_DIR%\run.bat
)
echo.

:: ── Auto-start on boot (optional) ────────────────
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

:: Remove old startup entries
if exist "%STARTUP%\LeVantage-PrintProxy.lnk" del "%STARTUP%\LeVantage-PrintProxy.lnk"

set /p AUTOSTART="  Enable auto-start on Windows boot? (Y/N): "
if /i "%AUTOSTART%"=="Y" (
    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP%\LeVantage Print Proxy.lnk'); $s.TargetPath = '%INSTALL_DIR%\run.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.WindowStyle = 7; $s.Save()" 2>nul
    echo  [OK] Auto-start enabled
) else (
    echo  [OK] Auto-start skipped (you can enable it later in the app)
)

:: ── Done ─────────────────────────────────────────
echo.
echo  ==========================================
echo    Setup Complete!
echo  ==========================================
echo.
echo  How to use:
echo    - Double-click "LeVantage Print Proxy" on Desktop
echo    - App appears in system tray (near clock)
echo    - Green icon = active, Red = stopped
echo    - Right-click tray icon for quick controls
echo.

:: Ask to launch
set /p LAUNCH="  Launch the app now? (Y/N): "
if /i "%LAUNCH%"=="Y" (
    echo.
    echo  Starting...
    cd /d "%INSTALL_DIR%"
    start "" npx electron .
)

echo.
echo  Press any key to close...
pause >nul
