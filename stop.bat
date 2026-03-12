@echo off
echo Stopping Le Vantage Print Proxy...
taskkill /FI "WINDOWTITLE eq Le Vantage Print Proxy*" /F >nul 2>&1
echo Print Proxy stopped.
pause
