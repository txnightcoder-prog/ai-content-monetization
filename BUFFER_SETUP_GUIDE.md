# Buffer Setup Guide - Step by Step

## Overview
Buffer allows you to post to TikTok, Instagram, Facebook, YouTube, Twitter, and LinkedIn from one place. This guide will walk you through setting up Buffer and getting your API credentials.

---

## Part 1: Create Buffer Account (10 minutes)

### Step 1: Sign Up for Buffer
1. Go to https://buffer.com
2. Click "Get Started" or "Sign Up"
3. Choose a plan:
   - **Free Plan**: 3 channels, 10 scheduled posts per channel
   - **Essentials**: $6/month per channel (recommended)
   - **Team**: $12/month per channel (for teams)

**Recommendation**: Start with Free plan to test, upgrade to Essentials later.

### Step 2: Complete Account Setup
1. Enter your email and create password
2. Verify your email address
3. Complete your profile information

---

## Part 2: Connect Social Media Accounts (15 minutes)

### Connect Instagram (5 minutes)

**Requirements:**
- Instagram Business or Creator account
- Facebook Page connected to your Instagram

**Steps:**
1. In Buffer dashboard, click "Connect Channel"
2. Select "Instagram"
3. Choose "Instagram Business"
4. Log in with your Facebook account
5. Select the Facebook Page linked to your Instagram
6. Grant Buffer permissions:
   - ✅ Manage your Pages
   - ✅ Publish content
   - ✅ Read insights
7. Click "Continue"
8. Select your Instagram Business account
9. Click "Done"

**Troubleshooting:**
- If Instagram doesn't appear, make sure it's a Business/Creator account
- Go to Instagram → Settings → Account → Switch to Professional Account

### Connect Facebook (3 minutes)

**Steps:**
1. Click "Connect Channel"
2. Select "Facebook"
3. Choose "Facebook Page" (not personal profile)
4. Log in to Facebook
5. Select your Page
6. Grant Buffer permissions
7. Click "Done"

### Connect TikTok (3 minutes)

**Steps:**
1. Click "Connect Channel"
2. Select "TikTok"
3. Log in to your TikTok account
4. Grant Buffer permissions:
   - ✅ Post videos
   - ✅ View analytics
5. Click "Authorize"
6. Click "Done"

**Note:** TikTok requires a Business account for API access.

### Connect YouTube (4 minutes)

**Steps:**
1. Click "Connect Channel"
2. Select "YouTube"
3. Log in to your Google account
4. Select your YouTube channel
5. Grant Buffer permissions:
   - ✅ Upload videos
   - ✅ Manage videos
6. Click "Allow"
7. Click "Done"

**Note:** Buffer can post YouTube Shorts (vertical videos under 60 seconds).

---

## Part 3: Get Buffer API Credentials (10 minutes)

### Step 1: Create Access Token

1. Go to https://buffer.com/developers/apps
2. Click "Create an App" or "Register Application"
3. Fill in application details:
   - **Name**: "AI Content Monetization System"
   - **Description**: "Automated content posting system"
   - **Website**: Your website or "http://localhost:8000"
4. Click "Create App"
5. You'll see your **Client ID** and **Client Secret**
6. Click "Create Access Token"
7. Copy the **Access Token** (starts with `1/`)

**IMPORTANT:** Save this token securely - you won't see it again!

### Step 2: Get Profile IDs

You need the Buffer Profile ID for each connected social media account.

**Method 1: Using the API (Easiest)**

1. Open PowerShell
2. Run this command (replace YOUR_TOKEN with your actual token):

```powershell
$token = "YOUR_ACCESS_TOKEN_HERE"
$response = Invoke-RestMethod -Uri "https://api.bufferapp.com/1/profiles.json?access_token=$token"
$response | ConvertTo-Json -Depth 3
```

3. You'll see output like this:

```json
[
  {
    "id": "5f9a8b7c6d5e4f3a2b1c0d9e",
    "service": "instagram",
    "service_username": "your_instagram"
  },
  {
    "id": "6a0b9c8d7e6f5a4b3c2d1e0f",
    "service": "facebook",
    "service_username": "Your Page Name"
  },
  {
    "id": "7b1c0d9e8f7a6b5c4d3e2f1a",
    "service": "tiktok",
    "service_username": "your_tiktok"
  },
  {
    "id": "8c2d1e0f9a8b7c6d5e4f3a2b",
    "service": "youtube",
    "service_username": "Your Channel"
  }
]
```

4. Copy the `id` for each service

**Method 2: Using Browser**

1. Go to https://api.bufferapp.com/1/profiles.json?access_token=YOUR_TOKEN
2. Replace YOUR_TOKEN with your actual access token
3. You'll see JSON with all your profiles
4. Copy the `id` for each service

---

## Part 4: Add Credentials to .env File (5 minutes)

1. Open the `.env` file in your project directory
2. Find the Buffer section
3. Add your credentials:

```env
# ============================================
# SOCIAL MEDIA INTEGRATION
# ============================================
# Buffer API: https://buffer.com/developers
BUFFER_ACCESS_TOKEN=1/your_actual_access_token_here
BUFFER_INSTAGRAM_PROFILE_ID=5f9a8b7c6d5e4f3a2b1c0d9e
BUFFER_FACEBOOK_PROFILE_ID=6a0b9c8d7e6f5a4b3c2d1e0f
BUFFER_TIKTOK_PROFILE_ID=7b1c0d9e8f7a6b5c4d3e2f1a
BUFFER_YOUTUBE_PROFILE_ID=8c2d1e0f9a8b7c6d5e4f3a2b
```

4. Save the file

---

## Part 5: Test the Integration (5 minutes)

### Test 1: Verify Connection

1. Start your backend server:
```powershell
cd C:\Users\JohnKirshy\Desktop\ai-content-monetization
.\START_BACKEND.bat
```

2. Open PowerShell and test:
```powershell
# Test getting profiles
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/integrations/buffer/profiles"
```

You should see your connected profiles!

### Test 2: Create a Test Post

1. Go to http://localhost:8000/docs
2. Find the `/api/v1/posts/create` endpoint
3. Click "Try it out"
4. Enter test data:
```json
{
  "text": "Testing my AI content system! 🚀 #AI #Tech",
  "platforms": ["instagram", "facebook"],
  "schedule_time": null
}
```
5. Click "Execute"

**Note:** This will post immediately. To schedule for later, add a future timestamp.

---

## Part 6: Understanding Buffer Limits

### Free Plan Limits
- 3 social channels
- 10 scheduled posts per channel
- Basic analytics

### Essentials Plan ($6/channel/month)
- Unlimited scheduled posts
- Advanced analytics
- Optimal posting times
- Link shortening

### What You Need
For this project, you'll need:
- **Minimum**: 3 channels (Instagram, TikTok, Facebook) = $18/month
- **Recommended**: 4 channels (+ YouTube) = $24/month
- **Full Setup**: 6 channels (+ Twitter, LinkedIn) = $36/month

---

## Troubleshooting

### "Access token invalid"
- Make sure you copied the entire token
- Token should start with `1/`
- Check for extra spaces or line breaks
- Generate a new token if needed

### "Profile not found"
- Verify the profile ID is correct
- Make sure the social account is still connected in Buffer
- Try disconnecting and reconnecting the account

### "Permission denied"
- Check that you granted all permissions when connecting
- Some platforms require Business accounts
- Reconnect the account with full permissions

### Instagram not working
- Must be Business or Creator account
- Must be linked to a Facebook Page
- Check Facebook Page permissions

### TikTok not working
- Must be TikTok Business account
- Some regions have restrictions
- Check TikTok API access

### YouTube not working
- Must have YouTube channel (not just Google account)
- Check YouTube API permissions
- Verify channel is not restricted

---

## Next Steps

Once Buffer is set up:

1. ✅ **Test posting** - Create a test post to verify everything works
2. 🔨 **Build video generation** - Create videos from your scripts
3. 🔨 **Automate posting** - Set up scheduled posting workflow
4. 🔨 **Track analytics** - Monitor performance across platforms

---

## Quick Reference

### Buffer Dashboard
https://buffer.com/app

### Buffer API Docs
https://buffer.com/developers/api

### Get Access Token
https://buffer.com/developers/apps

### Test API Connection
```powershell
Invoke-RestMethod -Uri "https://api.bufferapp.com/1/profiles.json?access_token=YOUR_TOKEN"
```

### Your Profile IDs
After setup, keep these handy:
- Instagram: `BUFFER_INSTAGRAM_PROFILE_ID`
- Facebook: `BUFFER_FACEBOOK_PROFILE_ID`
- TikTok: `BUFFER_TIKTOK_PROFILE_ID`
- YouTube: `BUFFER_YOUTUBE_PROFILE_ID`

---

## Cost Summary

### Buffer Costs
- Free: $0 (limited features)
- Essentials: $6/channel/month
- Team: $12/channel/month

### Recommended Setup
- 4 channels (Instagram, Facebook, TikTok, YouTube)
- Essentials plan: $24/month
- Includes unlimited scheduled posts

### Total Monthly Cost (Full System)
- Buffer: $24/month
- OpenAI: $50-100/month
- Video Generation (Vicsee): $79/month
- **Total**: ~$153-203/month

**Break-even**: Need 8-11 sales/month at $19 each, or 4-5 sales at $49 each.

---

**Ready to start posting?** Once you've completed this setup, you can post to all platforms with a single API call!