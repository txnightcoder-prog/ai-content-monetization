@echo off
title AI Content Monetization - Start with Tabs
color 0B

echo.
echo ========================================
echo   AI Content Monetization
echo   Starting with Windows Terminal Tabs
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

REM Check if Windows Terminal is installed
where wt >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Windows Terminal not found!
    echo.
    echo Falling back to separate windows...
    echo Install Windows Terminal from Microsoft Store for tabbed experience.
    echo.
    timeout /t 3 /nobreak >nul
    call START.bat
    exit /b 0
)

echo Starting with Windows Terminal tabs...
echo.

REM Start Windows Terminal with multiple tabs using wrapper scripts
wt -w 0 new-tab --title "Backend-Port-8020" cmd /k "%~dp0_start_backend_tab.bat" ; new-tab --title "Frontend-Port-5173" cmd /k "%~dp0_start_frontend_tab.bat" ; new-tab --title "Control-Panel" cmd /k "%~dp0_start_control_panel_tab.bat"

echo.
echo ========================================
echo   Servers Starting in Tabs!
echo ========================================
echo.
echo Check Windows Terminal for:
echo   Tab 1: Backend-Port-8020
echo   Tab 2: Frontend-Port-5173
echo   Tab 3: Control-Panel
echo.
echo ========================================

timeout /t 3 /nobreak >nul

@REM Made with Bob