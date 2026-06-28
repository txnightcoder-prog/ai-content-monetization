@echo off
echo ========================================
echo Starting Backend with Python 3.13
echo ========================================
echo.

cd backend

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
echo Verifying Python version...
python --version
echo.

echo Verifying packages...
python -c "import fastapi; print('✓ FastAPI found')" 2>nul || (echo ✗ FastAPI not found - run SETUP_BACKEND_PY313.bat && pause && exit /b 1)
python -c "import pydantic; print('✓ Pydantic found')" 2>nul || (echo ✗ Pydantic not found - run SETUP_BACKEND_PY313.bat && pause && exit /b 1)

echo.
echo Starting server...
echo Server will run on: http://localhost:8020
echo API Documentation: http://localhost:8020/docs
echo.

python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8020

pause

@REM Made with Bob
