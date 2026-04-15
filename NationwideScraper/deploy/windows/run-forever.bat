@echo off
REM ============================================================
REM Auto-restart scraper loop for Windows spare-laptop deployment.
REM Edit the three variables below, then double-click this file.
REM Dedup carries across restarts — no duplicate work.
REM ============================================================

set COUNTRY=PK
set CATEGORY=Gyms ^& Fitness
set CITY=Lahore

REM ------------------------------------------------------------
REM Do not edit below this line unless you know what you're doing.
REM ------------------------------------------------------------

cd /d "%~dp0\..\.."

echo.
echo ================================================================
echo  Crawlee Business Scraper — auto-restart loop
echo  Target: %COUNTRY% / %CATEGORY% / %CITY%
echo  Close this window or press Ctrl+C twice to stop.
echo ================================================================
echo.

:loop
echo [%date% %time%] Starting scraper...
node --max-old-space-size=2048 src/main.js --country=%COUNTRY% --category="%CATEGORY%" --city=%CITY%
echo.
echo [%date% %time%] Scraper exited with code %errorlevel%. Restarting in 30 seconds...
echo (Press Ctrl+C now to cancel the restart.)
timeout /t 30 /nobreak >nul
goto loop
