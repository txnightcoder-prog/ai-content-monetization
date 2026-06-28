# 🚀 Quick Start Guide

## Get Up and Running in 5 Minutes!

### Step 1: Test Your Setup (1 minute)
Double-click `TEST_SETUP.bat` to verify:
- ✅ Python is installed
- ✅ Node.js is installed
- ✅ All files are in place

### Step 2: Add Your OpenAI API Key (2 minutes)
1. Open the `.env` file in a text editor
2. Find this line:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
3. Replace `your_openai_api_key_here` with your actual OpenAI API key
4. Save the file

**Don't have an OpenAI API key?**
- Go to https://platform.openai.com/api-keys
- Sign up or log in
- Click "Create new secret key"
- Copy the key (starts with `sk-`)

### Step 3: Start the System (2 minutes)
Double-click `START_ALL.bat`

This will:
- Install all dependencies automatically
- Start the backend server (http://localhost:8000)
- Start the frontend server (http://localhost:5173)
- Open the API documentation in your browser

### Step 4: Test It! (1 minute)
Once the API docs open at http://localhost:8000/docs:

1. Find the `/api/v1/scripts/generate` endpoint
2. Click "Try it out"
3. Enter:
   - **topic**: "Best AI Tools for 2024"
   - **niche**: "AI tools"
4. Click "Execute"
5. You should see a generated video script! 🎉

## What You Can Do Now

### Generate Video Scripts
```
POST http://localhost:8000/api/v1/scripts/generate
?topic=Your Topic Here
&niche=Your Niche
```

### View All Scripts
```
GET http://localhost:8000/api/v1/scripts/
```

### Get a Specific Script
```
GET http://localhost:8000/api/v1/scripts/{script_id}
```

### Approve a Script
```
POST http://localhost:8000/api/v1/scripts/{script_id}/approve
```

## Next Steps

### 1. Add More API Keys (Optional)
Edit `.env` to add:
- **VIDEO_PROVIDER_API_KEY** - For video generation (Vicsee/HeyGen)
- **BUFFER_ACCESS_TOKEN** - For social media posting
- **STAN_STORE_API_KEY** - For lead capture
- **BEEHIIV_API_KEY** - For email automation

### 2. Explore the API
- Open http://localhost:8000/docs
- Try different endpoints
- See what data is returned

### 3. Check the Database
Your scripts are saved in:
```
backend/ai_content_monetization.db
```

### 4. Continue Development
Tell me what you want to build next:
- Video generation integration?
- Social media posting?
- Frontend dashboard?
- Lead capture system?

## Troubleshooting

### Backend won't start?
- Make sure Python 3.11+ is installed: `python --version`
- Check if port 8000 is available
- Look for error messages in the terminal

### Frontend won't start?
- Make sure Node.js 18+ is installed: `node --version`
- Check if port 5173 is available
- Try deleting `frontend/node_modules` and running again

### OpenAI errors?
- Verify your API key is correct in `.env`
- Check you have credits at https://platform.openai.com/account/billing
- Make sure the key starts with `sk-`

### Database errors?
- Delete `backend/ai_content_monetization.db`
- Restart the backend server
- The database will be recreated automatically

## Useful Commands

### Stop the servers
Press `Ctrl+C` in each terminal window

### Restart just the backend
Double-click `START_BACKEND.bat`

### Restart just the frontend
Double-click `START_FRONTEND.bat`

### View the database
```powershell
cd backend
sqlite3 ai_content_monetization.db
.tables
SELECT * FROM content_scripts;
.quit
```

## Project Structure

```
ai-content-monetization/
├── .env                    # Your API keys (EDIT THIS!)
├── START_ALL.bat          # Start everything (RUN THIS!)
├── TEST_SETUP.bat         # Test your setup
├── QUICK_START.md         # This file
├── SETUP_INSTRUCTIONS.md  # Detailed setup guide
├── backend/               # FastAPI backend
│   ├── app/
│   │   ├── main.py       # Main application
│   │   ├── api/          # API routes
│   │   ├── models/       # Database models
│   │   ├── services/     # Business logic
│   │   └── core/         # Core utilities
│   └── requirements.txt
└── frontend/              # React frontend
    ├── src/
    │   └── main.tsx
    └── package.json
```

## What's Working Now

✅ **Backend API** - FastAPI server with auto-docs
✅ **Database** - SQLite with SQLAlchemy ORM
✅ **OpenAI Integration** - Script generation with GPT-4
✅ **Script Management** - Create, read, update, delete scripts
✅ **Script Approval** - Approve/reject workflow

## What's Coming Next

🔨 **Video Generation** - Create videos from scripts
🔨 **Social Media Posting** - Auto-post to TikTok, Instagram, YouTube
🔨 **Lead Capture** - Collect leads from Stan Store
🔨 **Email Automation** - Nurture leads with Beehiiv
🔨 **Frontend Dashboard** - Beautiful UI for managing everything
🔨 **Analytics** - Track performance and revenue

---

**Ready to build more?** Just tell me what feature you want to work on next!