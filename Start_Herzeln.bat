@echo off
title Herzeln Multiplayer Server
echo ===================================================
echo Starte HERZELN Multiplayer Game Server...
echo ===================================================

cd /d "%~dp0"

IF NOT EXIST node_modules (
    echo Installiere Node-Abhaengigkeiten...
    call npm install
)

REM Falls Port 3000 noch von einer alten Instanz belegt ist, freigeben
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Server wird gestartet...
echo Das Spiel wird unter http://localhost:3000 im Browser geoeffnet.
echo.

start "" "http://localhost:3000"
call npm start

pause
