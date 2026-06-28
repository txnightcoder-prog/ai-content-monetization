@echo off
echo ========================================
echo AI Content Monetization - Setup Test
echo ========================================
echo.

echo [1/5] Checking Python 3.13 installation...
py -3.13 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.13 not found! Please install Python 3.13
    goto :error
) else (
    py -3.13 --version
    echo [OK] Python 3.13 is installed
)
echo.

echo [2/5] Checking Node.js installation...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js 18+
    goto :error
) else (
    node --version
    echo [OK] Node.js is installed
)
echo.

echo [3/5] Checking .env file...
if exist ".env" (
    echo [OK] .env file exists
    echo.
    echo Checking for required API keys...
    findstr /C:"OPENAI_API_KEY=your_openai" .env >nul
    if %errorlevel% equ 0 (
        echo [WARNING] OPENAI_API_KEY not configured yet
        echo Please edit .env and add your OpenAI API key
    ) else (
        echo [OK] OPENAI_API_KEY appears to be configured
    )
) else (
    echo [ERROR] .env file not found!
    goto :error
)
echo.

echo [4/5] Checking backend virtual environment...
if exist "backend\venv\Scripts\activate.bat" (
    echo [OK] Backend virtual environment exists
) else (
    echo [WARNING] Backend virtual environment not found
    echo Run SETUP_BACKEND_PY313.bat to create it
)
echo.

echo [5/5] Checking frontend dependencies...
if exist "frontend\package.json" (
    echo [OK] Frontend package.json found
) else (
    echo [ERROR] Frontend package.json not found!
    goto :error
)
echo.

echo ========================================
echo Setup Test Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Run SETUP_BACKEND_PY313.bat (if venv not found)
echo 2. Edit .env file and add your OpenAI API key
echo 3. Run START_ALL.bat to start both servers
echo 4. Open http://localhost:8020/docs to test the API
echo.
goto :end

:error
echo.
echo ========================================
echo Setup Test Failed!
echo ========================================
echo Please fix the errors above and try again.
echo.

:end
pause

@REM Made with Bob
