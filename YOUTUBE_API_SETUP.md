# YouTube API Setup - Complete Step-by-Step Guide

Follow these steps exactly to get YouTube API working in 30 minutes.

---

## Part 1: Create Google Cloud Project (5 minutes)

### Step 1: Go to Google Cloud Console
1. Open your browser
2. Go to: **https://console.cloud.google.com**
3. Sign in with your Google account (the one you'll use for YouTube)

### Step 2: Create New Project
1. Click the **project dropdown** at the top (says "Select a project")
2. Click **"NEW PROJECT"** button (top right of popup)
3. Fill in:
   - **Project name**: `AI Content System`
   - **Location**: Leave as "No organization"
4. Click **"CREATE"**
5. Wait 10-20 seconds for project creation
6. You'll see a notification when it's ready

### Step 3: Select Your New Project
1. Click the project dropdown again
2. Select **"AI Content System"**
3. Make sure it shows at the top of the page

---

## Part 2: Enable YouTube Data API (3 minutes)

### Step 1: Go to API Library
1. Click the **☰ menu** (hamburger icon, top left)
2. Hover over **"APIs & Services"**
3. Click **"Library"**

### Step 2: Find YouTube API
1. In the search box, type: `YouTube Data API v3`
2. Click on **"YouTube Data API v3"** (should be first result)
3. You'll see the API details page

### Step 3: Enable the API
1. Click the blue **"ENABLE"** button
2. Wait 5-10 seconds
3. You'll see "API enabled" confirmation

---

## Part 3: Configure OAuth Consent Screen (7 minutes)

### Step 1: Go to OAuth Consent Screen
1. Click **☰ menu** → **"APIs & Services"** → **"OAuth consent screen"**
2. You'll see "User Type" options

### Step 2: Choose User Type
1. Select **"External"** (unless you have a Google Workspace)
2. Click **"CREATE"**

### Step 3: Fill in App Information
**OAuth consent screen (Page 1):**
- **App name**: `AI Content System`
- **User support email**: Your email (select from dropdown)
- **App logo**: Skip for now
- **App domain**: Leave blank
- **Authorized domains**: Leave blank
- **Developer contact information**: Your email

Click **"SAVE AND CONTINUE"**

### Step 4: Add Scopes
**Scopes (Page 2):**
1. Click **"ADD OR REMOVE SCOPES"**
2. In the filter box, type: `youtube`
3. Check these boxes:
   - ✅ `https://www.googleapis.com/auth/youtube`
   - ✅ `https://www.googleapis.com/auth/youtube.upload`
   - ✅ `https://www.googleapis.com/auth/youtube.readonly`
4. Click **"UPDATE"** at bottom
5. Click **"SAVE AND CONTINUE"**

### Step 5: Add Test Users
**Test users (Page 3):**
1. Click **"+ ADD USERS"**
2. Enter your Gmail address (the one you'll use for YouTube)
3. Click **"ADD"**
4. Click **"SAVE AND CONTINUE"**

### Step 6: Review and Finish
**Summary (Page 4):**
1. Review everything
2. Click **"BACK TO DASHBOARD"**

---

## Part 4: Create OAuth Credentials (5 minutes)

### Step 1: Go to Credentials
1. Click **☰ menu** → **"APIs & Services"** → **"Credentials"**

### Step 2: Create OAuth Client ID
1. Click **"+ CREATE CREDENTIALS"** (top)
2. Select **"OAuth client ID"**

### Step 3: Configure Client
1. **Application type**: Select **"Desktop app"**
2. **Name**: `AI Content Desktop Client`
3. Click **"CREATE"**

### Step 4: Save Your Credentials
1. A popup appears with your credentials
2. **IMPORTANT**: Click **"DOWNLOAD JSON"**
3. Save the file as `client_secret.json`
4. Also copy these values (we'll need them):
   - **Client ID**: Starts with numbers, ends with `.apps.googleusercontent.com`
   - **Client Secret**: Random string of letters/numbers
5. Click **"OK"**

---

## Part 5: Get Refresh Token (10 minutes)

### Step 1: Install Required Package
Open PowerShell and run:
```powershell
pip install google-auth-oauthlib google-auth-httplib2 google-api-python-client
```

### Step 2: Create Token Generator Script
I've created a script for you. Save this as `get_youtube_token.py` in your project folder:

```python
from google_auth_oauthlib.flow import InstalledAppFlow
import json

# Scopes required for YouTube API
SCOPES = [
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
]

def get_refresh_token():
    """Get YouTube API refresh token"""
    
    print("=" * 60)
    print("YouTube API Token Generator")
    print("=" * 60)
    print()
    
    # Check if client_secret.json exists
    try:
        with open('client_secret.json', 'r') as f:
            client_config = json.load(f)
    except FileNotFoundError:
        print("ERROR: client_secret.json not found!")
        print("Please download it from Google Cloud Console and place it in this folder.")
        return
    
    print("Starting OAuth flow...")
    print("A browser window will open. Please:")
    print("1. Log in with your Google account")
    print("2. Click 'Continue' on the warning screen")
    print("3. Grant all permissions")
    print()
    
    # Run OAuth flow
    flow = InstalledAppFlow.from_client_secrets_file(
        'client_secret.json',
        scopes=SCOPES
    )
    
    credentials = flow.run_local_server(
        port=8080,
        prompt='consent',
        success_message='Authorization successful! You can close this window.'
    )
    
    # Extract credentials
    client_id = client_config['installed']['client_id']
    client_secret = client_config['installed']['client_secret']
    refresh_token = credentials.refresh_token
    
    print()
    print("=" * 60)
    print("SUCCESS! Your YouTube API Credentials:")
    print("=" * 60)
    print()
    print("Add these to your .env file:")
    print()
    print(f"YOUTUBE_CLIENT_ID={client_id}")
    print(f"YOUTUBE_CLIENT_SECRET={client_secret}")
    print(f"YOUTUBE_REFRESH_TOKEN={refresh_token}")
    print()
    print("=" * 60)
    print()
    
    # Save to file for easy copying
    with open('youtube_credentials.txt', 'w') as f:
        f.write(f"YOUTUBE_CLIENT_ID={client_id}\n")
        f.write(f"YOUTUBE_CLIENT_SECRET={client_secret}\n")
        f.write(f"YOUTUBE_REFRESH_TOKEN={refresh_token}\n")
    
    print("Credentials also saved to: youtube_credentials.txt")
    print()

if __name__ == "__main__":
    get_refresh_token()
```

### Step 3: Run the Script
1. Make sure `client_secret.json` is in your project folder
2. Open PowerShell in your project directory
3. Run:
```powershell
python get_youtube_token.py
```

### Step 4: Complete Authorization
1. A browser window will open automatically
2. You'll see a warning: **"Google hasn't verified this app"**
   - Click **"Advanced"**
   - Click **"Go to AI Content System (unsafe)"**
   - This is YOUR app, so it's safe!
3. Click **"Continue"**
4. Check all the permission boxes
5. Click **"Continue"** again
6. You'll see "Authorization successful!"

### Step 5: Copy Your Credentials
1. Go back to PowerShell
2. You'll see your credentials printed
3. They're also saved in `youtube_credentials.txt`
4. Copy all three lines

---

## Part 6: Add to .env File (2 minutes)

### Step 1: Open .env File
1. Open `C:/Users/JohnKirshy/Desktop/ai-content-monetization/.env`
2. Find the YouTube section

### Step 2: Paste Credentials
Replace these lines:
```env
YOUTUBE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your_client_secret_here
YOUTUBE_REFRESH_TOKEN=your_refresh_token_here
```

With your actual credentials from the script output.

### Step 3: Save the File

---

## Part 7: Test It! (3 minutes)

### Step 1: Start Your Backend
```powershell
cd C:\Users\JohnKirshy\Desktop\ai-content-monetization
.\START_BACKEND.bat
```

### Step 2: Test YouTube Connection
Open a new PowerShell window and run:
```powershell
# Test getting channel info
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/integrations/youtube/channel"
```

You should see your YouTube channel information!

### Step 3: Test Video Upload (Optional)
If you have a test video:
```powershell
# This will be available once we add the API endpoint
# For now, you can test directly in Python
```

---

## Troubleshooting

### "client_secret.json not found"
- Make sure you downloaded the JSON file from Google Cloud Console
- Place it in: `C:/Users/JohnKirshy/Desktop/ai-content-monetization/`
- Rename it to exactly: `client_secret.json`

### "Access blocked: This app's request is invalid"
- Go back to OAuth consent screen
- Make sure you added your email as a test user
- Make sure all scopes are added

### "The user did not consent to the scopes"
- When authorizing, check ALL permission boxes
- Click "Continue" on both screens

### "Invalid refresh token"
- Run `get_youtube_token.py` again
- Make sure you copy the ENTIRE refresh token
- No spaces or line breaks

### "Quota exceeded"
- YouTube API has daily limits
- Free tier: 10,000 units/day
- Each upload: ~1,600 units
- You can upload ~6 videos/day
- Resets at midnight Pacific Time

---

## What's Next?

Once YouTube API is working:

1. ✅ **Test uploading a video**
2. 🔨 **Add TikTok API** (similar process)
3. 🔨 **Add Instagram API** (via Meta)
4. 🔨 **Build posting workflow**
5. 🔨 **Automate everything**

---

## Quick Reference

### Important URLs
- **Google Cloud Console**: https://console.cloud.google.com
- **API Library**: https://console.cloud.google.com/apis/library
- **Credentials**: https://console.cloud.google.com/apis/credentials
- **OAuth Consent**: https://console.cloud.google.com/apis/credentials/consent

### Your Project
- **Project Name**: AI Content System
- **Project ID**: (shown in Google Cloud Console)

### API Limits
- **Quota**: 10,000 units/day (free)
- **Upload cost**: ~1,600 units
- **Daily uploads**: ~6 videos

---

## Need Help?

If you get stuck:
1. Check the troubleshooting section
2. Make sure you followed each step exactly
3. Check for typos in credentials
4. Ask me for help with the specific error!

---

**Ready to start? Begin with Part 1!**