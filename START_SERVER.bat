@echo off
title AI Content Monetization - Server
color 0A
echo.
echo ========================================
echo   AI Content Monetization Server
echo   (Python 3.13 Virtual Environment)
echo ========================================
echo.

cd /d "%~dp0backend"

echo Checking if virtual environment exists...
if not exist "venv\Scripts\activate.bat" (
    echo.
    echo ERROR: Virtual environment not found!
    echo Please run SETUP_BACKEND_PY313.bat first.
    echo.
    pause
    exit /b 1
)

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Starting server on http://localhost:8020
echo API Docs: http://localhost:8020/docs
echo.
echo Press Ctrl+C to stop the server
echo.

python -m uvicorn app.main:app --reload --port 8020

pause

@REM Made with Bob
