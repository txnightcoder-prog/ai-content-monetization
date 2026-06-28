# Batch Files Guide - AI Content Monetization

## Quick Start (3 Simple Steps)

1. **Setup (One-Time):** Run `SETUP_BACKEND_PY313.bat`
2. **Start Application:** Run `START.bat`
3. **Stop Application:** Run `STOP.bat`

---

## Main Batch Files

### 🔧 SETUP_BACKEND_PY313.bat
**Purpose:** One-time setup - creates Python 3.13 virtual environment and installs dependencies

**When to use:** 
- First time setup
- After deleting the venv folder
- When packages need to be reinstalled

**What it does:**
- Creates isolated Python 3.13 virtual environment in `backend/venv/`
- Installs all required packages (FastAPI, Pydantic, SQLAlchemy, OpenAI, etc.)
- Verifies all packages are installed correctly

**Expected output:**
```
✓ FastAPI: 0.115.5
✓ Pydantic: 2.10.3
✓ Uvicorn: 0.32.1
✓ SQLAlchemy: 2.0.36
✓ OpenAI: 1.57.4
```

---

### ▶️ START.bat
**Purpose:** Start both backend and frontend servers

**When to use:** Every time you want to run the application

**What it does:**
- Checks if setup has been completed
- Starts backend server (Python 3.13 venv, port 8020)
- Waits 5 seconds for backend to initialize
- Starts frontend server (port 5173)
- Opens two terminal windows

**Server URLs:**
- Backend API: http://localhost:8020
- API Documentation: http://localhost:8020/docs
- Frontend: http://localhost:5173

---

### ⏹️ STOP.bat
**Purpose:** Stop all running services

**When to use:** When you want to stop the application

**What it does:**
- Stops all Python processes (backend)
- Stops all Node.js processes (frontend)
- Closes server windows

---

### 🔍 FIX.bat
**Purpose:** Diagnose and fix common issues

**When to use:** When something isn't working

**What it checks:**
1. Python 3.13 installation
2. Virtual environment exists
3. Port 8020 availability
4. Backend packages (FastAPI, Pydantic)
5. .env configuration
6. Node.js installation

**Provides solutions for:**
- Missing Python 3.13
- Missing virtual environment
- Port conflicts
- Missing packages
- Configuration issues

---

## Additional Batch Files

### START_BACKEND_PY313.bat
**Purpose:** Start only the backend server

**When to use:** When you only need the backend API

**What it does:**
- Activates Python 3.13 virtual environment
- Verifies packages are installed
- Starts FastAPI server on port 8020

### START_SERVER.bat
**Purpose:** Alternative backend starter (same as START_BACKEND_PY313.bat)

**Note:** Functionally equivalent to START_BACKEND_PY313.bat with colored output

### START_ALL.bat
**Purpose:** Start backend and frontend (similar to START.bat)

**Note:** Alternative to START.bat with slightly different output

### START_FRONTEND.bat
**Purpose:** Start only the frontend development server

**When to use:** When backend is already running

**Port:** 5173 (default Vite port)

### OPEN_API_DOCS.bat
**Purpose:** Open API documentation in browser

**When to use:** When backend is running and you want to view/test the API

**Opens:** http://localhost:8020/docs

### MONITOR_BACKEND.bat
**Purpose:** Continuously monitor backend health

**When to use:** To check if backend is responsive

**What it does:**
- Checks backend health endpoint every 10 seconds
- Shows if backend is responding or stuck

### TEST_SETUP.bat
**Purpose:** Verify system requirements and configuration

**When to use:** Before first setup or when troubleshooting

**What it checks:**
- Python 3.13 installation
- Node.js installation
- .env file exists and configured
- Virtual environment exists
- Frontend dependencies exist

### TEST_BLUEPRINT_API.bat
**Purpose:** Test API endpoints with curl

**When to use:** When backend is running and you want to test API functionality

**Tests:**
- Health check endpoint
- Topic ideas endpoint
- Blueprint generation endpoint

### SETUP_YOUTUBE.bat
**Purpose:** Setup YouTube API integration

**When to use:** When configuring YouTube API access

**What it does:**
- Installs YouTube API packages
- Runs token generator script

---

## File Organization

### Essential Files (Use These)
- ✅ `START.bat` - Start application
- ✅ `STOP.bat` - Stop application  
- ✅ `FIX.bat` - Troubleshoot issues
- ✅ `SETUP_BACKEND_PY313.bat` - One-time setup

### Backend Files
- `START_BACKEND_PY313.bat` - Start backend only
- `START_SERVER.bat` - Alternative backend starter
- `MONITOR_BACKEND.bat` - Monitor backend health

### Frontend Files
- `START_FRONTEND.bat` - Start frontend only

### Testing Files
- `TEST_SETUP.bat` - Test system requirements
- `TEST_BLUEPRINT_API.bat` - Test API endpoints

### Utility Files
- `OPEN_API_DOCS.bat` - Open API documentation
- `SETUP_YOUTUBE.bat` - Setup YouTube integration
- `START_ALL.bat` - Alternative full starter

---

## Common Workflows

### First Time Setup
```
1. SETUP_BACKEND_PY313.bat
2. Edit .env file (add API keys)
3. START.bat
```

### Daily Use
```
1. START.bat (to start)
2. Work on your project
3. STOP.bat (when done)
```

### Troubleshooting
```
1. STOP.bat (stop everything)
2. FIX.bat (diagnose issues)
3. Follow suggested fixes
4. START.bat (try again)
```

### Testing
```
1. START_BACKEND_PY313.bat
2. TEST_BLUEPRINT_API.bat
3. Check results
```

---

## Technical Details

- **Python Version:** 3.13 (isolated in venv)
- **Backend Port:** 8020
- **Frontend Port:** 5173
- **Virtual Environment:** `backend/venv/`
- **Package Manager:** pip (backend), npm (frontend)

---

## Why Python 3.13?

Python 3.14 is too new and incompatible with current FastAPI/Pydantic versions. The virtual environment ensures:
- ✅ Uses Python 3.13 (not 3.14)
- ✅ Has its own isolated packages
- ✅ Python 3.14 cannot interfere
- ✅ No version conflicts

For detailed explanation, see [`PYTHON_VERSION_ISOLATION_GUIDE.md`](PYTHON_VERSION_ISOLATION_GUIDE.md)

---

## Need Help?

- **Setup Issues:** Run `FIX.bat`
- **Python Version:** See `PYTHON_314_NOT_SUPPORTED.md`
- **Isolation Details:** See `PYTHON_VERSION_ISOLATION_GUIDE.md`
- **API Issues:** Run `TEST_BLUEPRINT_API.bat`