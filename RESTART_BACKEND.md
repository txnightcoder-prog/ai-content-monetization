# Backend Restart & Recovery Guide

## Quick Reference — Commands You'll Actually Need

---

## 1. Normal Start (first time or after a fresh clone)

Run these **once** to create the Python virtual environment and install packages:

```bat
SETUP_BACKEND_PY313.bat
```

Or manually from the project root:

```powershell
# Step 1 — create venv with Python 3.13
cd backend
py -3.13 -m venv venv

# Step 2 — install dependencies
venv\Scripts\pip install -r requirements.txt
```

---

## 2. Start the Backend (every day / after a restart)

**Option A — double-click the bat file (easiest):**

```
START_BACKEND_PY313.bat
```

**Option B — from PowerShell / Command Prompt:**

```powershell
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8020
```

Backend will be available at:
- API: http://localhost:8020
- Swagger docs: http://localhost:8020/docs

---

## 3. Stop the Backend

**Option A — bat file:**

```
STOP.bat
```

**Option B — PowerShell (force-kills all Python processes):**

```powershell
taskkill /F /IM python.exe
```

---

## 4. Restart the Backend (stop then start)

```powershell
# Stop
taskkill /F /IM python.exe

# Wait 1 second
Start-Sleep -Seconds 1

# Start again
cd backend
venv\Scripts\activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8020
```

---

## 5. Start Frontend + Backend Together

```
START.bat
```

Or individually:

```
START_BACKEND_PY313.bat   ← backend  (port 8020)
START_FRONTEND.bat        ← frontend (port 5173)
```

---

## 6. Test the Login (from PowerShell)

```powershell
$body = '{"username":"txnightcoder@gmail.com","password":"Copycopy2026ki!","totp_code":""}'
Invoke-WebRequest -Uri "http://localhost:8020/api/v1/auth/login" `
  -Method POST -ContentType "application/json" -Body $body -UseBasicParsing
```

A `200 OK` response with `access_token` means the backend is healthy and credentials are correct.

---

## 7. Troubleshooting

### "Invalid credentials" on login

The admin account is seeded on first startup from `.env`. Check that these three vars exist in `.env`:

```
DASHBOARD_USERNAME=txnightcoder@gmail.com
DASHBOARD_PASSWORD=Copycopy2026ki!
DASHBOARD_SECRET=ai-content-monetization-secret-key-2026
```

If you just added them, delete the old database and restart:

```powershell
Remove-Item backend\ai_content_monetization.db -ErrorAction SilentlyContinue
# then restart the backend (see section 4)
```

### `bcrypt.__about__` / `AttributeError` in startup logs

passlib ships with an old bcrypt shim. Pin the versions:

```powershell
cd backend
venv\Scripts\pip install "bcrypt==4.0.1" "passlib[bcrypt]==1.7.4"
```

Then delete the DB and restart (see above).

### `password cannot be longer than 72 bytes` in startup logs

Same root cause as the bcrypt error above — fix it with the pip pin above.

### Port already in use (OSError: [Errno 98] / [WinError 10048])

```powershell
# Find what is using port 8020
netstat -ano | findstr :8020

# Kill that PID (replace 12345 with the actual PID)
taskkill /F /PID 12345
```

### venv missing (backend never set up)

```powershell
cd backend
py -3.13 -m venv venv
venv\Scripts\pip install -r requirements.txt
```

### Check backend is running

```powershell
Invoke-WebRequest -Uri "http://localhost:8020/health" -UseBasicParsing
# Expected: {"status":"ok","app":"ai-content-monetization-api"}
```

---

## 8. Environment Variables Required for Login

| Variable | Purpose | Where set |
|---|---|---|
| `DASHBOARD_USERNAME` | Admin email (default: txnightcoder@gmail.com) | `.env` in project root |
| `DASHBOARD_PASSWORD` | Admin password (hashed by bcrypt on first start) | `.env` in project root |
| `DASHBOARD_SECRET` | Signs JWT tokens — required or login crashes | `.env` in project root |

> **Note:** The `.env` file lives in the **project root** (`ai-content-monetization/.env`), not inside `backend/`. The backend reads it automatically via `python-dotenv`.

---

*Made with IBM Bob*
