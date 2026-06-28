# 🔧 Blueprint Feature Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: HTTP 405 Error (Method Not Allowed)

**Symptom:** When clicking "Generate Video Blueprint", you get `HTTP error: status: 405`

**Cause:** The backend server needs to be restarted to load the new routes.

**Solution:**
1. Run `RESTART_BACKEND.bat` in the `ai-content-monetization` folder
2. Wait for the backend to fully start (check for "Application startup complete" message)
3. Refresh the frontend page (http://localhost:5173)
4. Try generating a blueprint again

**Alternative Solution:**
```bash
cd ai-content-monetization
.\RESTART_BACKEND.bat
```

### Issue 2: Backend Not Starting

**Symptom:** Backend fails to start or shows errors

**Solution:**
1. Check if port 8010 is already in use:
   ```bash
   netstat -ano | findstr :8010
   ```
2. If processes are found, kill them:
   ```bash
   taskkill /PID <process_id> /F
   ```
3. Restart the backend:
   ```bash
   .\RESTART_BACKEND.bat
   ```

### Issue 3: OpenAI API Errors

**Symptom:** "Failed to generate blueprint" or API timeout errors

**Solution:**
1. Verify your OpenAI API key is set in `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```
2. Check your OpenAI account has credits
3. Verify internet connection
4. Check backend logs for detailed error messages

### Issue 4: Frontend Not Connecting to Backend

**Symptom:** Network errors or "Failed to fetch"

**Solution:**
1. Verify backend is running on port 8010:
   ```bash
   curl http://localhost:8010/health
   ```
   Should return: `{"status":"ok","app":"ai-content-monetization-api"}`

2. Check CORS settings in `backend/app/main.py`:
   ```python
   allow_origins=["http://localhost:5173", "http://localhost:3000"]
   ```

3. Verify frontend is running on port 5173:
   ```bash
   netstat -ano | findstr :5173
   ```

### Issue 5: Empty or Malformed Blueprints

**Symptom:** Blueprint generates but content is missing or poorly formatted

**Solution:**
1. Provide more detailed instructions
2. Include specific sections you want
3. Specify target audience and video length
4. Check backend logs for JSON parsing errors

**Good Example:**
```
Create a 10-minute video about AI tools for passive income
Target: entrepreneurs and side hustlers
Include: 5-7 specific tools with examples
Add: Pricing comparison and real results
Style: Educational but engaging
```

**Bad Example:**
```
Make a video about AI
```

## Testing the API

### Test Script
Run `TEST_BLUEPRINT_API.bat` to verify all endpoints:

```bash
cd ai-content-monetization
.\TEST_BLUEPRINT_API.bat
```

### Manual Testing

#### 1. Health Check
```bash
curl http://localhost:8010/health
```
Expected: `{"status":"ok","app":"ai-content-monetization-api"}`

#### 2. Topic Ideas
```bash
curl -X POST http://localhost:8010/api/v1/scripts/topic-ideas \
  -H "Content-Type: application/json" \
  -d "{\"niche\": \"AI tools\"}"
```
Expected: `{"ideas": ["Topic 1", "Topic 2", ...]}`

#### 3. Blueprint Generation
```bash
curl -X POST http://localhost:8010/api/v1/scripts/blueprint \
  -H "Content-Type: application/json" \
  -d "{\"instructions\": \"Create a video about AI tools\", \"niche\": \"AI tools\"}"
```
Expected: Full blueprint JSON with title, structure, sections, etc.

## Debugging Steps

### 1. Check Backend Logs
Look for errors in the backend terminal window:
- OpenAI API errors
- JSON parsing errors
- Database errors
- Route registration issues

### 2. Check Frontend Console
Open browser DevTools (F12) and check Console tab:
- Network errors
- API response errors
- JavaScript errors

### 3. Check Network Tab
In browser DevTools, check Network tab:
- Verify request is being sent
- Check request payload
- Verify response status code
- Check response body

### 4. Verify Environment Variables
Check `.env` file has all required variables:
```
OPENAI_API_KEY=sk-...
DATABASE_URL=sqlite:///./content_monetization.db
```

## Port Configuration

### Default Ports
- **Backend:** 8010
- **Frontend:** 5173

### Changing Ports

#### Backend Port
Edit `backend/app/main.py` or use environment variable:
```bash
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

#### Frontend Port
Edit `frontend/vite.config.ts` or use:
```bash
npm run dev -- --port 5173
```

## Common Error Messages

### "HTTP error: status: 405"
- **Cause:** Backend routes not loaded
- **Fix:** Restart backend with `RESTART_BACKEND.bat`

### "HTTP error: status: 500"
- **Cause:** Backend internal error (likely OpenAI API)
- **Fix:** Check backend logs, verify API key, check OpenAI credits

### "Failed to fetch"
- **Cause:** Backend not running or CORS issue
- **Fix:** Start backend, check CORS settings

### "Failed to generate blueprint"
- **Cause:** OpenAI API error or timeout
- **Fix:** Check API key, internet connection, OpenAI status

### "Please enter video instructions"
- **Cause:** Empty input field
- **Fix:** Enter instructions in the textarea

## Performance Issues

### Slow Blueprint Generation
- **Normal:** 5-15 seconds for comprehensive blueprints
- **Slow:** 20+ seconds
- **Causes:**
  - Large instruction text (>2000 characters)
  - OpenAI API throttling
  - Network latency
- **Solutions:**
  - Break into smaller requests
  - Check OpenAI API status
  - Verify internet speed

### Backend Hanging
- **Symptom:** Request never completes
- **Solution:**
  1. Check backend logs for stuck requests
  2. Restart backend
  3. Check OpenAI API timeout settings
  4. Monitor with `MONITOR_BACKEND.bat`

## Getting Help

### 1. Check Documentation
- `VIDEO_BLUEPRINT_GUIDE.md` - User guide
- `ENHANCEMENT_SUMMARY.md` - Technical details
- `BACKEND_MONITORING.md` - Backend monitoring

### 2. Check Logs
- Backend terminal output
- Browser console (F12)
- Network tab in DevTools

### 3. Verify Setup
- Run `TEST_BLUEPRINT_API.bat`
- Check all services are running
- Verify environment variables

### 4. Common Solutions
1. Restart backend: `RESTART_BACKEND.bat`
2. Restart frontend: Stop and run `npm run dev`
3. Clear browser cache
4. Check OpenAI API key and credits

## Quick Fix Checklist

- [ ] Backend is running on port 8010
- [ ] Frontend is running on port 5173
- [ ] OpenAI API key is set in `.env`
- [ ] OpenAI account has credits
- [ ] Internet connection is working
- [ ] No firewall blocking localhost
- [ ] Browser cache is cleared
- [ ] Backend has been restarted after code changes

## Still Having Issues?

1. Run the test script: `TEST_BLUEPRINT_API.bat`
2. Check backend logs for specific errors
3. Verify all environment variables are set
4. Try a simple blueprint first
5. Check OpenAI API status page

---

**Made with Bob** 🤖

Last updated: 2026-06-23