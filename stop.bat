@echo off
echo Stopping Le Vantage POS...
taskkill /FI "WINDOWTITLE eq Print Server*" /F >/dev/null 2>&1
taskkill /FI "WINDOWTITLE eq Le Vantage POS*" /F >/dev/null 2>&1
echo POS stopped.
pause
