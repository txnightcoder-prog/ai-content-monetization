@echo off
title Fix Pydantic Core and Jiter Issue
color 0E

echo.
echo ========================================
echo   Fixing Rust Extension Installations
echo ========================================
echo.
echo This will reinstall pydantic-core and jiter with pre-built wheels
echo (No Rust compilation needed)
echo.
pause

cd backend
call venv\Scripts\activate.bat

echo.
echo Step 1: Uninstalling problematic packages...
pip uninstall -y pydantic pydantic-core pydantic-settings jiter openai

echo.
echo Step 2: Clearing pip cache...
pip cache purge

echo.
echo Step 3: Installing Rust extensions from pre-built wheels...
pip install --only-binary :all: pydantic-core jiter

echo.
echo Step 4: Installing pydantic packages...
pip install pydantic==2.10.3 pydantic-settings==2.6.1

echo.
echo Step 5: Installing OpenAI SDK...
pip install openai==1.57.4

echo.
echo Step 6: Verifying all installations...
python -c "import pydantic_core; print('[OK] pydantic-core installed')" || (echo [ERROR] pydantic-core failed && pause && exit /b 1)
python -c "import jiter; print('[OK] jiter installed')" || (echo [ERROR] jiter failed && pause && exit /b 1)
python -c "import pydantic; print('[OK] pydantic version:', pydantic.__version__)" || (echo [ERROR] pydantic failed && pause && exit /b 1)
python -c "import fastapi; print('[OK] fastapi version:', fastapi.__version__)" || (echo [ERROR] fastapi failed && pause && exit /b 1)
python -c "import openai; print('[OK] openai version:', openai.__version__)" || (echo [ERROR] openai failed && pause && exit /b 1)

echo.
echo ========================================
echo   Fix Complete!
echo ========================================
echo.
echo All Rust extensions installed successfully.
echo You can now run START.bat
echo.
pause

@REM Made with Bob