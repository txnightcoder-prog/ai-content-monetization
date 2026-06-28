@echo off
REM ============================================================
REM Backend Health Monitor - Checks if backend is responsive
REM ============================================================

title Backend Health Monitor

echo.
echo ============================================================
echo   Backend Health Monitor
echo ============================================================
echo.
echo This script will continuously monitor the backend health.
echo Press Ctrl+C to stop monitoring.
echo.
echo ============================================================
echo.

:monitor_loop
echo [%TIME%] Checking backend health...

REM Use curl to check health endpoint with timeout
curl -s -m 5 http://localhost:8020/health >nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo [%TIME%] ✓ Backend is RESPONSIVE
) else (
    echo [%TIME%] ✗ Backend is NOT RESPONDING or STUCK!
    echo.
    echo WARNING: Backend may be hung or not running.
    echo Check the backend window for errors or frozen output.
    echo.
)

echo.
timeout /t 10 /nobreak >nul
goto monitor_loop

@REM Made with Bob