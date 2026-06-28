@echo off
echo ========================================
echo Setting up Backend with Python 3.13
echo ========================================
echo.

cd backend

echo Creating virtual environment with Python 3.13...
py -3.13 -m venv venv

echo.
echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Upgrading pip...
python -m pip install --upgrade pip

echo.
echo Installing dependencies...
pip install -r requirements.txt

echo.
echo ========================================
echo Verifying Installation
echo ========================================
echo.
python -c "import fastapi; print('✓ FastAPI:', fastapi.__version__)"
python -c "import pydantic; print('✓ Pydantic:', pydantic.__version__)"
python -c "import uvicorn; print('✓ Uvicorn:', uvicorn.__version__)"
python -c "import sqlalchemy; print('✓ SQLAlchemy:', sqlalchemy.__version__)"
python -c "import openai; print('✓ OpenAI:', openai.__version__)"

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start the backend, run: START_BACKEND_PY313.bat
echo.
pause

@REM Made with Bob
