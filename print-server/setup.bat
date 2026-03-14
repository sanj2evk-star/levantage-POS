@echo off
title Le Vantage Print Proxy - Setup
color 0A
cd /d "%~dp0"

echo.
echo  ==========================================
echo    Le Vantage Print Proxy v3.0 - Setup
echo  ==========================================
echo.

:: ── Check Node.js ────────────────────────────────
where node >nul 2>&1
if not errorlevel 1 goto has_node

:: Try common paths
if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
    goto has_node
)
if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
    goto has_node
)

:: Try refreshing PATH from registry
echo  [..] Refreshing system PATH...
for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYSPATH=%%B"
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USRPATH=%%B"
set "PATH=%SYSPATH%;%USRPATH%"
where node >nul 2>&1
if not errorlevel 1 goto has_node

:: Still not found
color 0C
echo.
echo  [ERROR] Node.js not found!
echo.
echo  If you just installed Node.js, RESTART your laptop first.
echo  If not installed, download from https://nodejs.org
echo.
echo  Press any key to close...
pause >nul
exit /b 1

:has_node
echo  [OK] Node.js found
node -v
echo.

:: ── Setup directory ──────────────────────────────
set "INSTALL_DIR=%USERPROFILE%\LeVantage-PrintProxy"
echo  Install path: %INSTALL_DIR%
echo.
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%\ui" mkdir "%INSTALL_DIR%\ui"

:: ── Download files from GitHub ───────────────────
echo  Downloading files from GitHub...
set "GH=https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server"

call :dl "%GH%/index.js" "%INSTALL_DIR%\index.js" "index.js"
call :dl "%GH%/package.json" "%INSTALL_DIR%\package.json" "package.json"
call :dl "%GH%/electron-main.js" "%INSTALL_DIR%\electron-main.js" "electron-main.js"
call :dl "%GH%/preload.js" "%INSTALL_DIR%\preload.js" "preload.js"
call :dl "%GH%/ui/index.html" "%INSTALL_DIR%\ui\index.html" "ui/index.html"
call :dl "%GH%/electron-builder.yml" "%INSTALL_DIR%\electron-builder.yml" "electron-builder.yml"

if not exist "%INSTALL_DIR%\electron-main.js" (
    color 0C
    echo.
    echo  [ERROR] Download failed! Check internet connection.
    echo  Press any key to close...
    pause >nul
    exit /b 1
)
echo  [OK] All files downloaded
echo.

:: ── Setup .env ───────────────────────────────────
if exist "%INSTALL_DIR%\.env" goto env_exists
    color 0E
    echo  ==========================================
    echo    .env file not found - creating one
    echo  ==========================================
    echo.
    echo SUPABASE_URL=https://ivhmvhnrxiodpneflszu.supabase.co> "%INSTALL_DIR%\.env"
    echo SUPABASE_KEY=PASTE_YOUR_ANON_KEY_HERE>> "%INSTALL_DIR%\.env"
    echo  Opening .env in Notepad...
    echo  Replace PASTE_YOUR_ANON_KEY_HERE with your Supabase anon key.
    echo  Save and close Notepad to continue.
    echo.
    start /wait notepad "%INSTALL_DIR%\.env"
    color 0A
    echo  [OK] .env saved
    goto env_done
:env_exists
    echo  [OK] .env already exists
:env_done
echo.

:: ── Install dependencies ─────────────────────────
echo  Installing dependencies (1-2 minutes)...
cd /d "%INSTALL_DIR%"
call npm install >nul 2>&1
echo  [OK] Dependencies installed
echo.

:: ── Create run.bat ───────────────────────────────
echo @echo off> "%INSTALL_DIR%\run.bat"
echo title Le Vantage Print Proxy>> "%INSTALL_DIR%\run.bat"
echo cd /d "%INSTALL_DIR%">> "%INSTALL_DIR%\run.bat"
echo npx electron .>> "%INSTALL_DIR%\run.bat"

:: ── Desktop shortcut ─────────────────────────────
echo  Creating desktop shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\LeVantage Print Proxy.lnk'); $s.TargetPath = '%INSTALL_DIR%\run.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.Description = 'Le Vantage Print Proxy'; $s.WindowStyle = 7; $s.Save()" 2>nul
echo  [OK] Done
echo.

:: ── Auto-start ───────────────────────────────────
set /p AUTOSTART="  Auto-start on Windows boot? (Y/N): "
if /i "%AUTOSTART%" neq "Y" goto skip_autostart
    set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
    if exist "%STARTUP%\LeVantage-PrintProxy.lnk" del "%STARTUP%\LeVantage-PrintProxy.lnk"
    powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP%\LeVantage Print Proxy.lnk'); $s.TargetPath = '%INSTALL_DIR%\run.bat'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.WindowStyle = 7; $s.Save()" 2>nul
    echo  [OK] Auto-start enabled
:skip_autostart
echo.

:: ── Done ─────────────────────────────────────────
echo  ==========================================
echo    Setup Complete!
echo  ==========================================
echo.
echo  Double-click "LeVantage Print Proxy" on Desktop to start.
echo.

set /p LAUNCH="  Launch now? (Y/N): "
if /i "%LAUNCH%" neq "Y" goto done
    echo  Starting...
    cd /d "%INSTALL_DIR%"
    start "" npx electron .
:done
echo.
echo  Press any key to close...
pause >nul
exit /b 0

:: ── Download function ────────────────────────────
:dl
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%~1' -OutFile '%~2' -ErrorAction Stop" 2>nul
echo    - %~3
goto :eof
