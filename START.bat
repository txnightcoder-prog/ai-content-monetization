@echo off
title AI Content Monetization - Start
color 0B

echo.
echo ========================================
echo   AI Content Monetization
echo   Starting Application
echo ========================================
echo.

echo Checking for running services...
echo.

REM Stop any existing services gracefully
call STOP.bat >nul 2>&1

echo Waiting for services to stop...
timeout /t 2 /nobreak >nul
echo.

REM Check if setup has been run
if not exist "backend\venv\Scripts\activate.bat" (
    echo ERROR: Backend not set up!
    echo.
    echo Please run SETUP_BACKEND_PY313.bat first.
    echo.
    pause
    exit /b 1
)

echo Starting Backend Server (Python 3.13 venv, port 8020)...
start "AI Backend" cmd /k "cd /d "%~dp0" && START_BACKEND_PY313.bat"

echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul

echo.
echo Starting Frontend Server (port 5173)...
start "AI Frontend" cmd /k "cd /d "%~dp0" && START_FRONTEND.bat"

echo.
echo ========================================
echo   Both Servers Starting!
echo ========================================
echo.
echo Backend:  http://localhost:8020
echo API Docs: http://localhost:8020/docs
echo Frontend: http://localhost:5173
echo.
echo Two new windows have opened.
echo Close those windows to stop the servers.
echo.
echo ========================================
pause

@REM Made with Bob