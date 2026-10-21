@echo off
REM ---------------------------------------------------------------------------
REM Falcon Lab - start the local server and open it in the default browser.
REM Double click this file, or run it from a terminal.
REM ---------------------------------------------------------------------------
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found on PATH. Install Python 3.8+ and try again.
  pause
  exit /b 1
)

echo Starting Falcon Lab on http://127.0.0.1:8765/index.html ...
start "Falcon Lab server" /min python server.py

REM Give the server a moment, then open the browser.
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8765/index.html

echo.
echo The server is running in the background (minimised window).
echo Close that window to stop it.
endlocal
