@echo off
title Le Vantage Print Proxy

:: If not already minimized, relaunch minimized
if not "%1"=="minimized" (
    start /min "" "%~f0" minimized
    exit /b
)

cd /d "%~dp0"

:: Auto-update index.js from GitHub
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/sanj2evk-star/levantage-POS/main/print-server/index.js' -OutFile 'index.js' -ErrorAction Stop } catch {}" 2>nul

:: Install dependencies if needed
if not exist "node_modules" call npm install >nul 2>&1

:: Run the print proxy
:loop
node index.js
timeout /t 5 /nobreak >nul
goto loop
