@echo off
echo ============================================
echo   Le Vantage - Auto-Start Setup
echo ============================================
echo.
echo This will make Le Vantage POS start automatically
echo when the laptop is turned on.
echo.
echo Press any key to continue or close this window to cancel.
pause >nul

:: Create a VBS launcher that starts the proxy minimized
set "INSTALL_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_DIR%\LeVantage.vbs"

:: Create VBS script in Startup folder
echo Creating auto-start entry...
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run """%INSTALL_DIR%start.bat""", 7, False
) > "%VBS_FILE%"

if exist "%VBS_FILE%" (
    echo.
    echo ============================================
    echo   SUCCESS! Auto-start is now enabled.
    echo ============================================
    echo.
    echo What happens now:
    echo   - When laptop starts, print proxy will auto-start
    echo   - Cashier app will open in the browser
    echo   - The proxy window will be minimized
    echo.
    echo To REMOVE auto-start later:
    echo   Run remove-autostart.bat
    echo.
) else (
    echo.
    echo ERROR: Could not create auto-start entry.
    echo Please run this as Administrator.
)

pause
