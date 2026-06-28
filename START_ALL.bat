@echo off
echo ========================================
echo AI Content Monetization System
echo Starting Backend and Frontend Servers
echo ========================================
echo.
echo Starting Backend Server (Python 3.13 venv)...
start "Backend Server" cmd /k "cd /d %~dp0 && START_BACKEND_PY313.bat"
echo Waiting 5 seconds for backend to initialize...
timeout /t 5 /nobreak >nul
echo.
echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd /d %~dp0 && START_FRONTEND.bat"
echo.
echo ========================================
echo Both servers are starting!
echo ========================================
echo.
echo Backend API: http://localhost:8020
echo API Documentation: http://localhost:8020/docs
echo Frontend: http://localhost:5173
echo.
echo Press any key to open the API documentation in your browser...
pause >nul
start http://localhost:8020/docs

@REM Made with Bob
