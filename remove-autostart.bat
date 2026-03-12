@echo off
echo ============================================
echo   Le Vantage - Remove Auto-Start
echo ============================================
echo.

set "VBS_FILE=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\LeVantage.vbs"

if exist "%VBS_FILE%" (
    del "%VBS_FILE%"
    echo Auto-start has been REMOVED.
    echo Le Vantage POS will no longer start automatically.
) else (
    echo Auto-start was not enabled. Nothing to remove.
)

echo.
pause
