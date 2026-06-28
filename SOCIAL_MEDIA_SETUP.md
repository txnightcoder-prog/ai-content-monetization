# Social Media Platform Setup Guide

## 🎯 Overview

This system will automatically post your AI-generated videos to:
- ✅ **Instagram** (Reels)
- ✅ **Facebook** (Videos)
- ✅ **TikTok** (Videos)
- ✅ **YouTube** (Shorts)

All managed through Buffer for easy scheduling and analytics.

---

## 📱 Platform Requirements

### Instagram
- **Account Type**: Business or Creator account (required for API access)
- **Video Format**: 9:16 vertical (1080x1920)
- **Duration**: 15-90 seconds (Reels)
- **File Size**: Max 100MB
- **Posting Frequency**: 2-3 Reels per day

### Facebook
- **Account Type**: Facebook Page (required)
- **Video Format**: 9:16 vertical or 16:9 horizontal
- **Duration**: 3 seconds - 240 minutes
- **File Size**: Max 4GB
- **Posting Frequency**: 1-2 videos per day

### TikTok
- **Account Type**: Any TikTok account
- **Video Format**: 9:16 vertical (1080x1920)
- **Duration**: 15-60 seconds (recommended)
- **File Size**: Max 287.6MB
- **Posting Frequency**: 3-5 videos per day

### YouTube Shorts
- **Account Type**: YouTube channel (required)
- **Video Format**: 9:16 vertical (1080x1920)
- **Duration**: Up to 60 seconds
- **File Size**: Max 256GB
- **Posting Frequency**: 2-3 Shorts per day
- **Monetization**: YouTube Partner Program eligible

---

## 🔧 Setup Steps

### Step 1: Create/Optimize Your Accounts

#### Instagram Setup
```
1. Convert to Business/Creator Account:
   - Go to Settings → Account
   - Switch to Professional Account
   - Choose Business or Creator
   
2. Connect to Facebook Page:
   - Settings → Account → Linked Accounts
   - Connect Facebook Page
   
3. Enable API Access:
   - This happens automatically through Buffer
```

#### Facebook Setup
```
1. Create Facebook Page (if you don't have one):
   - Go to facebook.com/pages/create
   - Choose Business or Brand
   - Fill in details
   
2. Get Page Admin Access:
   - Make sure you're an admin of the page
   - Settings → Page Roles
```

#### TikTok Setup
```
1. Create TikTok Account:
   - Download TikTok app
   - Sign up with email
   - Complete profile
   
2. Switch to Business Account (optional but recommended):
   - Profile → Menu → Settings and Privacy
   - Account → Switch to Business Account
   - Choose category
```

#### YouTube Setup (Important!)
```
1. Create YouTube Channel:
   - Go to youtube.com
   - Click your profile → Create a channel
   - Choose name and category
   - Complete channel description
   
2. Enable Shorts:
   - Automatically available for all channels
   - Upload videos in 9:16 vertical format
   - Add #Shorts in title or description
   
3. Monetization Setup (Optional but Recommended):
   - Need 1,000 subscribers + 4,000 watch hours
   - Or 1,000 subscribers + 10M Shorts views (90 days)
   - Apply for YouTube Partner Program
   - Enable ads on Shorts
   
4. Optimize Channel:
   - Add channel banner (2560x1440)
   - Create channel trailer
   - Add links to other social media
   - Complete About section
```

---

## 🔗 Connect to Buffer

### Step 1: Sign Up for Buffer

```
1. Go to https://buffer.com
2. Sign up for account
3. Choose plan:
   - Free: 3 channels, 10 posts per channel
   - Essentials: $6/month per channel
   - Team: $12/month per channel
   - Agency: $120/month (10 channels)
```

**Recommended**: Start with **Essentials** plan for 4 channels ($24/month)
- Instagram, Facebook, TikTok, YouTube

### Step 2: Connect Your Social Accounts

#### Connect Instagram
```
1. In Buffer dashboard, click "Connect Channel"
2. Select Instagram
3. Choose "Instagram Business"
4. Login with Facebook account
5. Select your Instagram Business account
6. Grant permissions
7. Done! ✅
```

#### Connect Facebook
```
1. Click "Connect Channel"
2. Select Facebook
3. Choose "Facebook Page"
4. Login to Facebook
5. Select your Page
6. Grant permissions
7. Done! ✅
```

#### Connect TikTok
```
1. Click "Connect Channel"
2. Select TikTok
3. Login to TikTok account
4. Grant Buffer permissions
5. Done! ✅
```

#### Connect YouTube (IMPORTANT!)
```
1. Click "Connect Channel"
2. Select YouTube
3. Login with Google account
4. Select your YouTube channel
5. Grant all permissions (especially upload permissions)
6. Verify connection shows "Connected"
7. Test by scheduling a sample Short
8. Done! ✅

Note: YouTube requires additional permissions for video uploads.
Make sure to grant all requested permissions.
```

### Step 3: Get Buffer API Access Token

```
1. Go to Buffer dashboard
2. Click your profile → Account
3. Go to "Developers" section
4. Click "Create Access Token"
5. Copy the token (save it securely!)
6. This token will be used in your .env file
```

---

## 🎬 Video Specifications

### Optimal Video Format (Works for All Platforms)

```
Resolution: 1080x1920 (9:16 vertical)
Frame Rate: 30 fps
Codec: H.264
Audio: AAC, 128 kbps
Duration: 30-45 seconds (sweet spot)
File Format: MP4
```

**HeyGen automatically creates videos in this format!**

---

## 📅 Posting Schedule

### Recommended Schedule (All Times in Your Local Timezone)

#### Instagram Reels
- **Morning**: 8:00 AM (commute time)
- **Afternoon**: 3:00 PM (break time)
- **Evening**: 7:00 PM (prime time)

#### Facebook
- **Morning**: 9:00 AM (work start)
- **Evening**: 6:00 PM (after work)

#### TikTok
- **Morning**: 7:00 AM (early birds)
- **Lunch**: 12:00 PM (lunch break)
- **Afternoon**: 5:00 PM (commute home)
- **Evening**: 8:00 PM (peak time)
- **Night**: 10:00 PM (night owls)

#### YouTube Shorts
- **Morning**: 10:00 AM
- **Afternoon**: 2:00 PM
- **Evening**: 6:00 PM

### System Configuration

The system will automatically post to all platforms based on this schedule. You can customize it in the configuration file.

---

## 📊 Platform-Specific Best Practices

### Instagram Reels
✅ **Do:**
- Use trending audio (system can add this)
- Include captions/text overlays
- Use 3-5 relevant hashtags
- Post consistently (2-3x daily)
- Engage with comments quickly

❌ **Don't:**
- Repost TikTok videos with watermark
- Use copyrighted music
- Post low-quality videos
- Ignore engagement

### Facebook
✅ **Do:**
- Write engaging captions
- Ask questions to drive comments
- Use Facebook-native features
- Post during peak hours
- Share to relevant groups

❌ **Don't:**
- Post too frequently (max 2x daily)
- Use clickbait titles
- Ignore comments
- Post without captions

### TikTok
✅ **Do:**
- Use trending sounds
- Jump on trends quickly
- Post 3-5 times daily
- Use relevant hashtags
- Engage with other creators

❌ **Don't:**
- Post recycled content
- Ignore trends
- Use poor quality videos
- Spam hashtags

### YouTube Shorts
✅ **Do:**
- Add #Shorts in title or description
- Create compelling thumbnails
- Use strong hooks
- Post 2-3x daily
- Optimize titles for search

❌ **Don't:**
- Make videos too long (>60 sec)
- Forget to add #Shorts
- Use misleading titles
- Ignore analytics

---

## 🔐 API Configuration

### Environment Variables (.env file)

```env
# Buffer Configuration
BUFFER_ACCESS_TOKEN=your_buffer_token_here

# Platform IDs (get these from Buffer)
BUFFER_INSTAGRAM_PROFILE_ID=instagram_profile_id
BUFFER_FACEBOOK_PROFILE_ID=facebook_page_id
BUFFER_TIKTOK_PROFILE_ID=tiktok_profile_id
BUFFER_YOUTUBE_PROFILE_ID=youtube_channel_id

# Posting Schedule (24-hour format)
INSTAGRAM_POST_TIMES=08:00,15:00,19:00
FACEBOOK_POST_TIMES=09:00,18:00
TIKTOK_POST_TIMES=07:00,12:00,17:00,20:00,22:00
YOUTUBE_POST_TIMES=10:00,14:00,18:00
```

### Getting Profile IDs from Buffer

```powershell
# Use Buffer API to get your profile IDs
curl -X GET "https://api.bufferapp.com/1/profiles.json?access_token=YOUR_TOKEN"

# Response will include:
{
  "id": "instagram_profile_id",
  "service": "instagram",
  ...
}
```

---

## 🎯 Content Strategy by Platform

### Instagram Reels
**Content Type**: Educational, inspirational, entertaining
**Tone**: Authentic, relatable, energetic
**Length**: 30-45 seconds
**Hook**: First 3 seconds crucial
**CTA**: "Follow for more" or "Link in bio"

### Facebook
**Content Type**: Educational, community-focused
**Tone**: Professional, helpful, conversational
**Length**: 45-90 seconds
**Hook**: Question or bold statement
**CTA**: "Comment below" or "Share with friends"

### TikTok
**Content Type**: Trending, entertaining, quick tips
**Tone**: Fun, energetic, authentic
**Length**: 15-30 seconds
**Hook**: Immediate value or entertainment
**CTA**: "Follow for part 2" or "Duet this"

### YouTube Shorts
**Content Type**: Educational, how-to, quick wins
**Tone**: Informative, clear, valuable
**Length**: 30-60 seconds
**Hook**: Promise of value
**CTA**: "Subscribe for more" or "Full video in description"

---

## 📈 Analytics & Optimization

### Track These Metrics

**Engagement Rate**:
```
(Likes + Comments + Shares) / Views × 100
Target: 5%+ for all platforms
```

**Click-Through Rate**:
```
Clicks / Views × 100
Target: 2%+ to your link
```

**Follower Growth**:
```
New Followers / Day
Target: 50-100+ per day per platform
```

### Platform-Specific KPIs

| Platform | Views | Engagement | Followers/Day |
|----------|-------|------------|---------------|
| Instagram | 10K+ | 5%+ | 50+ |
| Facebook | 5K+ | 3%+ | 30+ |
| TikTok | 50K+ | 8%+ | 100+ |
| YouTube | 10K+ | 4%+ | 50+ |

---

## 🚀 Quick Start Checklist

- [ ] Create/optimize accounts on all platforms
- [ ] Convert Instagram to Business account
- [ ] Create Facebook Page
- [ ] Sign up for Buffer ($18/month Essentials plan)
- [ ] Connect all 4 platforms to Buffer
- [ ] Get Buffer API access token
- [ ] Get profile IDs for each platform
- [ ] Add credentials to .env file
- [ ] Test posting to each platform
- [ ] Set up posting schedule
- [ ] Monitor analytics daily

---

## 💡 Pro Tips

1. **Cross-Promote**: Mention other platforms in your content
2. **Repurpose**: Same video, different captions for each platform
3. **Engage**: Respond to comments within first hour
4. **Analyze**: Check what works, do more of it
5. **Consistency**: Post daily, same times
6. **Quality**: Better to post 1 great video than 5 mediocre ones
7. **Trends**: Jump on trends within 24-48 hours
8. **Hashtags**: Use 3-5 relevant hashtags per post
9. **Captions**: Always add captions for accessibility
10. **Test**: Try different hooks, formats, times

---

## 🆘 Troubleshooting

### Video Won't Upload
- Check file size (under 100MB)
- Verify format (MP4, H.264)
- Ensure correct aspect ratio (9:16)
- Check internet connection

### Buffer Connection Failed
- Reconnect account in Buffer dashboard
- Check account permissions
- Verify API token is valid
- Try disconnecting and reconnecting

### Low Engagement
- Improve hook (first 3 seconds)
- Post at better times
- Use trending audio/hashtags
- Engage with your audience
- Analyze top-performing content

### Account Restricted
- Review platform guidelines
- Remove any violating content
- Appeal if wrongly restricted
- Diversify content topics

---

## 📞 Support Resources

- **Buffer Help**: https://support.buffer.com
- **Instagram Help**: https://help.instagram.com
- **Facebook Help**: https://www.facebook.com/business/help
- **TikTok Help**: https://support.tiktok.com
- **YouTube Help**: https://support.google.com/youtube

---

**Ready to start posting?** The system will handle everything automatically once configured!