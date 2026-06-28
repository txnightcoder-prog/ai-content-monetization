@echo off
REM ============================================================
REM AI Content Monetization - Backend Server Startup Script
REM ============================================================

REM Set window title
title Backend for AI Tool

REM Change to backend directory
cd /d "%~dp0"

echo.
echo ============================================================
echo   AI Content Monetization - Backend Server
echo ============================================================
echo.
echo Starting backend server...
echo.
echo Server will be available at: http://localhost:8010
echo API Documentation: http://localhost:8010/docs
echo.
echo Press Ctrl+C to stop the server
echo ============================================================
echo.

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Start uvicorn server on port 8010
uvicorn app.main:app --reload --port 8010

REM If server stops, pause so you can see any errors
pause

@REM Made with Bob
