# Fix for Backend Crashes

## Problem
The backend server crashes because pydantic and other dependencies are not properly installed for Python 3.14.

Error: `ModuleNotFoundError: No module named 'pydantic'`

## Quick Fix (2 Steps)

### Step 1: Install All Dependencies
Run this batch file to install all required packages with Python 3.14 compatibility:
```
INSTALL_ALL_DEPENDENCIES.bat
```

This will:
- Set the Python 3.14 compatibility flag
- Install all packages from requirements.txt
- Verify all critical packages are installed

### Step 2: Start Backend Safely
Use the new safe startup script:
```
SAFE_START_BACKEND.bat
```

This script sets the compatibility flag before starting the server, preventing crashes.

## Alternative: Use Python 3.13

If crashes persist, the most reliable solution is to use Python 3.13:

1. Download Python 3.13 from https://www.python.org/downloads/
2. Install it
3. Create new virtual environment:
   ```powershell
   py -3.13 -m venv venv
   venv\Scripts\activate
   cd backend
   pip install -r requirements.txt
   ```
4. Use the regular START_BACKEND.bat

## Files Created

- **INSTALL_ALL_DEPENDENCIES.bat** - Installs all required packages (RUN THIS FIRST!)
- **SAFE_START_BACKEND.bat** - Starts backend with compatibility flag
- **FIX_PYTHON_VERSION.md** - Detailed explanation of the issue

## Verification

After running INSTALL_ALL_DEPENDENCIES.bat, you should see:
```
✓ FastAPI: 0.115.5
✓ Pydantic: 2.10.3
✓ Uvicorn: 0.32.1
✓ SQLAlchemy: 2.0.36
✓ OpenAI: 1.57.4
```

If all packages show ✓, then SAFE_START_BACKEND.bat will start without crashes.