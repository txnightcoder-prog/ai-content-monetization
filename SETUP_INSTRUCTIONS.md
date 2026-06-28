# Local Development Setup Instructions

## Prerequisites Check

Before starting, ensure you have:
- [ ] Python 3.11+ installed
- [ ] Node.js 18+ installed
- [ ] Git installed
- [ ] OpenAI API key (minimum requirement to test)

## Step 1: Install Backend Dependencies

Open PowerShell in the project directory and run:

```powershell
cd C:\Users\JohnKirshy\Desktop\ai-content-monetization\backend
python -m pip install -r requirements.txt
```

## Step 2: Install Frontend Dependencies

```powershell
cd C:\Users\JohnKirshy\Desktop\ai-content-monetization\frontend
npm install
```

## Step 3: Configure Environment Variables

Edit the `.env` file in the root directory and add your API keys:

**Minimum Required for Testing:**
```env
OPENAI_API_KEY=sk-your-actual-key-here
```

**Optional (add later):**
- VIDEO_PROVIDER_API_KEY (for video generation)
- BUFFER_ACCESS_TOKEN (for social media posting)
- STAN_STORE_API_KEY (for lead capture)
- BEEHIIV_API_KEY (for email automation)

## Step 4: Start the Backend Server

```powershell
cd C:\Users\JohnKirshy\Desktop\ai-content-monetization\backend
python -m uvicorn app.main:app --reload --port 8000
```

The backend will be available at:
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

## Step 5: Start the Frontend (in a new terminal)

```powershell
cd C:\Users\JohnKirshy\Desktop\ai-content-monetization\frontend
npm run dev
```

The frontend will be available at: http://localhost:5173

## Step 6: Test the API

### Option A: Using the Browser
1. Open http://localhost:8000/docs
2. Try the `/health` endpoint
3. Test the `/api/v1/scripts/generate` endpoint with a topic

### Option B: Using PowerShell
```powershell
# Test health endpoint
Invoke-RestMethod -Uri "http://localhost:8000/health"

# Generate a script (requires OPENAI_API_KEY)
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/scripts/generate?topic=Best%20AI%20Tools%20for%202024&niche=AI%20tools" -Method POST
```

## Troubleshooting

### Backend won't start
- Check Python version: `python --version` (should be 3.11+)
- Verify dependencies installed: `pip list`
- Check for port conflicts: `netstat -ano | findstr :8000`

### Frontend won't start
- Check Node version: `node --version` (should be 18+)
- Clear node_modules: `rm -r node_modules` then `npm install`
- Check for port conflicts: `netstat -ano | findstr :5173`

### Database errors
- The SQLite database will be created automatically
- Location: `backend/ai_content_monetization.db`
- To reset: delete the .db file and restart the backend

### OpenAI API errors
- Verify your API key is correct in `.env`
- Check your OpenAI account has credits
- Test at: https://platform.openai.com/playground

## Next Steps After Setup

Once everything is running:

1. **Test Script Generation**
   - Use the API docs at http://localhost:8000/docs
   - Generate a test script with the `/api/v1/scripts/generate` endpoint

2. **Check Database**
   - Scripts are saved to SQLite database
   - View with: `sqlite3 backend/ai_content_monetization.db`

3. **Review Generated Scripts**
   - Use the `/api/v1/scripts/` endpoint to list all scripts
   - Check the quality and format

4. **Plan Next Integration**
   - Video generation (Vicsee/HeyGen)
   - Social media posting (Buffer)
   - Lead capture (Stan Store)

## Quick Start Scripts

I've created batch files for easy startup:

### START_BACKEND.bat
```batch
@echo off
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

### START_FRONTEND.bat
```batch
@echo off
cd frontend
npm run dev
```

### START_ALL.bat
```batch
@echo off
start cmd /k "cd backend && python -m uvicorn app.main:app --reload --port 8000"
timeout /t 3
start cmd /k "cd frontend && npm run dev"
echo.
echo Backend: http://localhost:8000/docs
echo Frontend: http://localhost:5173
```

## Development Workflow

1. Start both servers (backend + frontend)
2. Make changes to code
3. Backend auto-reloads on save
4. Frontend auto-reloads on save
5. Test changes in browser
6. Check API docs for endpoint changes

## Getting Help

If you encounter issues:
1. Check the error messages carefully
2. Review the troubleshooting section above
3. Check the logs in the terminal
4. Ask me for help with specific errors