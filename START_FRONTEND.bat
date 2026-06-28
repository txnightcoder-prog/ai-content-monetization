@echo off
echo ========================================
echo Starting AI Content Monetization Frontend
echo ========================================
echo.
cd frontend
echo Installing/updating dependencies...
call npm install --silent
echo.
echo Starting React development server on http://localhost:5173
echo.
call npm run dev

@REM Made with Bob
