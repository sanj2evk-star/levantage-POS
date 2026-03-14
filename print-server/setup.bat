@echo off
title Le Vantage Print Proxy - Setup
color 0A

echo.
echo  ==========================================
echo    Le Vantage Print Proxy v3.0 - Setup
echo  ==========================================
echo.
echo  Checking Node.js...
echo.

node -v
if %errorlevel% neq 0 (
    echo.
    echo  Node.js not found in PATH.
    echo.
    echo  Trying to find it...
    if exist "C:\Program Files\nodejs\node.exe" (
        echo  Found at C:\Program Files\nodejs
        set "PATH=C:\Program Files\nodejs;%PATH%"
        node -v
    ) else (
        echo  Not found. Checking registry...
        for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "SYSPATH=%%B"
        for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "USRPATH=%%B"
        if defined SYSPATH set "PATH=%SYSPATH%;%USRPATH%"
        node -v
        if %errorlevel% neq 0 (
            echo.
            echo  ==========================================
            echo  Node.js is NOT installed on this computer.
            echo  ==========================================
            echo.
            echo  Steps:
            echo    1. Go to https://nodejs.org
            echo    2. Download LTS version
            echo    3. Install it
            echo    4. RESTART laptop
            echo    5. Run this setup again
            echo.
            pause
            exit /b 1
        )
    )
)

echo.
echo  [OK] Node.js is working
echo.

set "DIR=%USERPROFILE%\LeVantage-PrintProxy"
echo  Install folder: %DIR%
if not exist "%DIR%" mkdir "%DIR%"
if not exist "%DIR%\ui" mkdir "%DIR%\ui"
echo.

echo  Downloading files from GitHub...
set "BASE=https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server"

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%BASE%/index.js' -OutFile '%DIR%\index.js'" 2>nul
echo    - index.js
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%BASE%/package.json' -OutFile '%DIR%\package.json'" 2>nul
echo    - package.json
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%BASE%/electron-main.js' -OutFile '%DIR%\electron-main.js'" 2>nul
echo    - electron-main.js
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%BASE%/preload.js' -OutFile '%DIR%\preload.js'" 2>nul
echo    - preload.js
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%BASE%/ui/index.html' -OutFile '%DIR%\ui\index.html'" 2>nul
echo    - ui/index.html

if not exist "%DIR%\electron-main.js" (
    echo.
    echo  [ERROR] Download failed! Check internet.
    pause
    exit /b 1
)
echo  [OK] Downloaded
echo.

if not exist "%DIR%\.env" (
    echo SUPABASE_URL=https://ivhmvhnrxiodpneflszu.supabase.co> "%DIR%\.env"
    echo SUPABASE_KEY=PASTE_YOUR_ANON_KEY_HERE>> "%DIR%\.env"
    echo  Opening .env - paste your Supabase key and save...
    start /wait notepad "%DIR%\.env"
    echo  [OK] .env saved
) else (
    echo  [OK] .env exists
)
echo.

echo  Installing dependencies (1-2 min)...
cd /d "%DIR%"
call npm install
echo.
echo  [OK] Dependencies installed
echo.

echo @echo off> "%DIR%\run.bat"
echo title Le Vantage Print Proxy>> "%DIR%\run.bat"
echo cd /d "%DIR%">> "%DIR%\run.bat"
echo npx electron .>> "%DIR%\run.bat"

echo  Creating desktop shortcut...
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\LeVantage Print Proxy.lnk'); $s.TargetPath = '%DIR%\run.bat'; $s.WorkingDirectory = '%DIR%'; $s.WindowStyle = 7; $s.Save()"
echo  [OK] Done
echo.

echo  ==========================================
echo    SETUP COMPLETE!
echo  ==========================================
echo.
echo  Double-click "LeVantage Print Proxy" on Desktop.
echo.
set /p LAUNCH="  Launch now? (Y/N): "
if /i "%LAUNCH%"=="Y" (
    cd /d "%DIR%"
    start "" npx electron .
)
echo.
pause
