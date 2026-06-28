@echo off
title Control Panel
color 0A

:menu
cls
echo.
echo =========================================
echo   AI Content Monetization
echo   Control Panel
echo =========================================
echo.
echo Backend:  http://localhost:8020
echo API Docs: http://localhost:8020/docs
echo Frontend: http://localhost:5173
echo.
echo =========================================
echo   Quick Actions
echo =========================================
echo.
echo [1] 🎬 Create Video Script (Frontend)
echo [2] 📤 Upload Video to YouTube (Frontend)
echo [3] 📖 Open Workflow Guide (Frontend)
echo [4] 🎨 Open Canva (Create Videos)
echo.
echo =========================================
echo   System Commands
echo =========================================
echo.
echo [5] 📚 Open API Documentation
echo [6] 🌐 Open Frontend Home
echo [7] 🛑 Stop All Services
echo [8] 💓 Monitor Backend Health
echo [9] 🧪 Test API Endpoints
echo [0] 🔄 Refresh This Panel
echo [Q] Quit
echo.
echo =========================================
echo.

choice /c 1234567890Q /n /m "Select option: "

if errorlevel 11 exit /b 0
if errorlevel 10 goto menu
if errorlevel 9 (
    start cmd /k "cd /d "%~dp0" && TEST_BLUEPRINT_API.bat"
    goto menu
)
if errorlevel 8 (
    start cmd /k "cd /d "%~dp0" && MONITOR_BACKEND.bat"
    goto menu
)
if errorlevel 7 (
    call STOP.bat
    echo.
    echo Services stopped. Press any key to return to menu...
    pause >nul
    goto menu
)
if errorlevel 6 (
    start http://localhost:5173
    goto menu
)
if errorlevel 5 (
    start http://localhost:8020/docs
    goto menu
)
if errorlevel 4 (
    echo.
    echo Opening Canva for video creation...
    start https://canva.com
    goto menu
)
if errorlevel 3 (
    echo.
    echo Opening Workflow Guide...
    start http://localhost:5173
    timeout /t 2 /nobreak >nul
    echo.
    echo NOTE: Click the "📖 Help" button in the navigation bar
    echo.
    pause
    goto menu
)
if errorlevel 2 (
    echo.
    echo Opening YouTube Upload page...
    start http://localhost:5173
    timeout /t 2 /nobreak >nul
    echo.
    echo NOTE: This will open the frontend. YouTube upload functionality
    echo       is available through the API or YouTube Studio directly.
    echo.
    echo To upload via YouTube Studio: https://studio.youtube.com
    echo.
    pause
    goto menu
)
if errorlevel 1 (
    echo.
    echo Opening Script Generator...
    start http://localhost:5173
    timeout /t 2 /nobreak >nul
    echo.
    echo NOTE: Click "Scripts" or "Blueprints" in the navigation bar
    echo.
    pause
    goto menu
)

goto menu

@REM Made with Bob