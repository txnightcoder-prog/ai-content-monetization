# Backend Monitoring Guide

This guide explains how to detect and diagnose when the backend gets stuck or hangs.

## 🔍 Monitoring Features Added

### 1. Request Logging Middleware
The backend now logs every request with detailed timing information:

- **Request Start**: Logs when a request begins processing
- **Request Duration**: Shows how long each request takes
- **Slow Request Warning**: Warns if a request takes more than 5 seconds
- **Error Logging**: Captures and logs any errors during request processing

### 2. Script Generation Logging
Enhanced logging in the script generation service:

- Logs when script generation starts
- Tracks OpenAI API call duration
- Logs parsing and completion steps
- Shows batch generation progress

### 3. Health Monitor Script
A dedicated monitoring script that continuously checks backend health.

## 📊 Log Output Examples

### Normal Request
```
2026-06-23 14:30:15 - app.main - INFO - [20260623143015-123456] ▶ START: GET /health
2026-06-23 14:30:15 - app.main - INFO - [20260623143015-123456] ✓ DONE (0.02s): GET /health - Status: 200
```

### Slow Request (Warning)
```
2026-06-23 14:30:20 - app.main - INFO - [20260623143020-789012] ▶ START: POST /api/scripts/generate
2026-06-23 14:30:28 - app.services.script_generator - INFO - 🎬 Starting script generation for topic: 'AI Tools'
2026-06-23 14:30:28 - app.services.script_generator - INFO - 📡 Calling OpenAI API...
2026-06-23 14:30:35 - app.services.script_generator - INFO - ✓ OpenAI API responded in 7.23s
2026-06-23 14:30:35 - app.main - WARNING - [20260623143020-789012] ⚠ SLOW (15.45s): POST /api/scripts/generate - Status: 200
```

### Stuck/Hanging Request
If you see a START log but no DONE/ERROR log after 30+ seconds, the request is likely stuck:
```
2026-06-23 14:30:40 - app.main - INFO - [20260623143040-345678] ▶ START: POST /api/scripts/generate
... (no completion log appears)
```

## 🛠️ How to Use the Monitoring Tools

### Method 1: Watch Backend Logs
1. Start the backend using `RESTART_BACKEND.bat`
2. Watch the console output for timing information
3. Look for:
   - ⚠ SLOW warnings (requests taking >5 seconds)
   - ✗ ERROR messages
   - Requests that start but never complete

### Method 2: Use the Health Monitor
1. Start the backend: `RESTART_BACKEND.bat`
2. In a separate window, run: `MONITOR_BACKEND.bat`
3. The monitor will check backend health every 10 seconds
4. If the backend is stuck, you'll see:
   ```
   [14:30:45] ✗ Backend is NOT RESPONDING or STUCK!
   WARNING: Backend may be hung or not running.
   ```

### Method 3: Manual Health Check
Open your browser or use curl:
```bash
curl http://localhost:8010/health
```

If this times out or doesn't respond within 5 seconds, the backend is stuck.

## 🚨 Signs of a Stuck Backend

1. **No log output**: Backend console shows no new logs for 30+ seconds
2. **Health check fails**: `/health` endpoint doesn't respond
3. **Slow request warning**: Multiple requests showing >10 second durations
4. **Incomplete requests**: START logs without corresponding DONE/ERROR logs

## 🔧 What to Do When Backend is Stuck

1. **Check the logs**: Look for the last request that started
2. **Identify the endpoint**: Note which API endpoint is causing the hang
3. **Restart the backend**: Use `RESTART_BACKEND.bat`
4. **Report the issue**: Note the endpoint and any error messages

## 📝 Common Hang Scenarios

### OpenAI API Timeout
```
📡 Calling OpenAI API for topic: 'AI Tools'...
... (hangs here, no response)
```
**Cause**: OpenAI API is slow or not responding
**Solution**: Check internet connection, verify API key, check OpenAI status

### Database Lock
```
▶ START: POST /api/scripts/save
... (hangs, no completion)
```
**Cause**: Database operation is blocked or locked
**Solution**: Restart backend, check database file permissions

### Infinite Loop
```
▶ START: GET /api/endpoint
... (hangs indefinitely)
```
**Cause**: Code logic error causing infinite loop
**Solution**: Check the specific endpoint code for loops

## 🎯 Log Symbols Reference

- `▶` - Request started
- `✓` - Request completed successfully
- `⚠` - Slow request warning (>5 seconds)
- `✗` - Request failed with error
- `🎬` - Script generation started
- `📡` - API call in progress
- `📝` - Processing/parsing data

## 💡 Tips

1. Keep the backend window visible to monitor logs in real-time
2. Run the health monitor in a separate window for continuous monitoring
3. If you see repeated slow warnings, the backend may be overloaded
4. Check the timestamp on logs - if they stop updating, the backend is frozen

---

Made with Bob