@echo off
title AI Content Monetization - Fix Issues
color 0E

echo.
echo ========================================
echo   AI Content Monetization
echo   Troubleshooting and Fix
echo ========================================
echo.
echo This script will help diagnose and fix common issues.
echo.
pause

echo.
echo [1/6] Checking Python 3.13 installation...
py -3.13 --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.13 not found!
    echo.
    echo SOLUTION: Install Python 3.13 from https://www.python.org/downloads/
    echo.
    goto :end
) else (
    py -3.13 --version
    echo [OK] Python 3.13 is installed
)

echo.
echo [2/6] Checking virtual environment...
if exist "backend\venv\Scripts\activate.bat" (
    echo [OK] Virtual environment exists
) else (
    echo [ERROR] Virtual environment not found!
    echo.
    echo SOLUTION: Run SETUP_BACKEND_PY313.bat to create it
    echo.
    goto :end
)

echo.
echo [3/6] Checking if port 8020 is available...
netstat -ano | findstr ":8020" >nul
if %errorlevel% equ 0 (
    echo [WARNING] Port 8020 is in use
    echo.
    echo SOLUTION: Run STOP.bat to stop existing services
    echo.
) else (
    echo [OK] Port 8020 is available
)

echo.
echo [4/6] Testing backend packages...
cd backend
call venv\Scripts\activate.bat
python -c "import fastapi; print('[OK] FastAPI:', fastapi.__version__)" 2>nul || (echo [ERROR] FastAPI not found - run SETUP_BACKEND_PY313.bat && goto :end)
python -c "import pydantic; print('[OK] Pydantic:', pydantic.__version__)" 2>nul || (echo [ERROR] Pydantic not found - run SETUP_BACKEND_PY313.bat && goto :end)
cd ..

echo.
echo [5/6] Checking .env configuration...
if exist ".env" (
    echo [OK] .env file exists
    findstr /C:"OPENAI_API_KEY=sk-" .env >nul
    if %errorlevel% equ 0 (
        echo [OK] OpenAI API key appears configured
    ) else (
        echo [WARNING] OpenAI API key may not be configured
        echo Edit .env file and add your API key
    )
) else (
    echo [ERROR] .env file not found!
    echo Copy .env.example to .env and configure it
)

echo.
echo [6/6] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Node.js not found (needed for frontend)
) else (
    node --version
    echo [OK] Node.js is installed
)

echo.
echo ========================================
echo   Diagnostic Complete
echo ========================================
echo.
echo If all checks passed, try running START.bat
echo.
echo Common fixes:
echo - Run SETUP_BACKEND_PY313.bat if venv or packages missing
echo - Run STOP.bat if port 8020 is in use
echo - Edit .env file to add API keys
echo.
echo For detailed help, see:
echo - PYTHON_VERSION_ISOLATION_GUIDE.md
echo - README_BATCH_FILES.md
echo.

:end
pause

@REM Made with Bob