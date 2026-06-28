# Integration Guide: Adding API Keys for Video Creation & Distribution

This guide explains how to add and manage API credentials for various services in your AI Content Monetization system.

## Table of Contents
1. [Overview](#overview)
2. [Video Generation Services](#video-generation-services)
3. [Social Media Platforms](#social-media-platforms)
4. [Automation Tools](#automation-tools)
5. [AI Services](#ai-services)
6. [API Usage Examples](#api-usage-examples)

---

## Overview

The system supports multiple integration types:
- **Video Generation**: HeyGen, D-ID, Synthesia
- **Social Media**: TikTok, Instagram, YouTube, Facebook, Twitter
- **Automation**: Buffer, Hootsuite, n8n, Zapier
- **AI Services**: OpenAI, ElevenLabs

All credentials are stored securely and masked in API responses (only last 4 characters shown).

---

## Video Generation Services

### 1. HeyGen (AI Avatar Videos)
**Best for**: Professional AI avatar videos with realistic talking heads

**Getting API Key**:
1. Sign up at https://heygen.com
2. Go to Settings → API Keys
3. Create new API key
4. Copy the key

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "HeyGen Production",
  "type": "heygen",
  "api_key": "your-heygen-api-key-here",
  "config": {
    "avatar_id": "default_avatar",
    "voice_id": "default_voice"
  }
}
```

**Pricing**: ~$0.10-0.50 per video minute

---

### 2. D-ID (Talking Head Videos)
**Best for**: Quick talking head videos from images

**Getting API Key**:
1. Sign up at https://www.d-id.com
2. Navigate to API section
3. Generate API key
4. Copy both API key and secret

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "D-ID Account",
  "type": "d-id",
  "api_key": "your-d-id-api-key",
  "api_secret": "your-d-id-secret",
  "config": {
    "presenter_id": "amy-jcwCkr1grs"
  }
}
```

**Pricing**: ~$0.05-0.30 per video

---

### 3. Synthesia (Professional AI Videos)
**Best for**: High-quality corporate/professional videos

**Getting API Key**:
1. Sign up at https://www.synthesia.io
2. Contact support for API access (Enterprise feature)
3. Receive API credentials

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "Synthesia Enterprise",
  "type": "synthesia",
  "api_key": "your-synthesia-api-key",
  "config": {
    "avatar": "anna",
    "background": "green_screen"
  }
}
```

**Pricing**: Enterprise pricing, contact sales

---

## Social Media Platforms

### 1. TikTok
**Getting API Access**:
1. Apply for TikTok Developer account: https://developers.tiktok.com
2. Create an app
3. Get Client Key and Client Secret
4. Complete OAuth flow to get access token

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "TikTok Main Account",
  "type": "tiktok",
  "api_key": "your-client-key",
  "api_secret": "your-client-secret",
  "access_token": "your-access-token",
  "refresh_token": "your-refresh-token",
  "config": {
    "account_id": "your-tiktok-user-id"
  }
}
```

---

### 2. Instagram
**Getting API Access**:
1. Create Facebook Developer account: https://developers.facebook.com
2. Create an app with Instagram Basic Display or Instagram Graph API
3. Get access token through OAuth

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "Instagram Business",
  "type": "instagram",
  "access_token": "your-instagram-access-token",
  "config": {
    "instagram_account_id": "your-ig-account-id",
    "facebook_page_id": "your-fb-page-id"
  }
}
```

---

### 3. YouTube
**Getting API Access**:
1. Go to Google Cloud Console: https://console.cloud.google.com
2. Create project and enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Complete OAuth flow

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "YouTube Channel",
  "type": "youtube",
  "api_key": "your-youtube-api-key",
  "access_token": "your-oauth-access-token",
  "refresh_token": "your-oauth-refresh-token",
  "config": {
    "channel_id": "your-channel-id"
  }
}
```

---

### 4. Facebook
**Getting API Access**:
1. Facebook Developer account: https://developers.facebook.com
2. Create app with Pages API access
3. Get Page Access Token

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "Facebook Page",
  "type": "facebook",
  "access_token": "your-page-access-token",
  "config": {
    "page_id": "your-facebook-page-id"
  }
}
```

---

### 5. Twitter/X
**Getting API Access**:
1. Apply for Twitter Developer account: https://developer.twitter.com
2. Create app and get API keys
3. Generate access tokens

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "Twitter Account",
  "type": "twitter",
  "api_key": "your-api-key",
  "api_secret": "your-api-secret",
  "access_token": "your-access-token",
  "refresh_token": "your-access-token-secret"
}
```

---

## Automation Tools

### 1. Buffer (Social Media Scheduling)
**Best for**: Scheduling posts across multiple platforms

**Getting API Key**:
1. Sign up at https://buffer.com
2. Go to https://buffer.com/developers/api
3. Create access token

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "Buffer Scheduler",
  "type": "buffer",
  "access_token": "your-buffer-access-token",
  "config": {
    "profile_ids": ["buffer-profile-id-1", "buffer-profile-id-2"]
  }
}
```

**Pricing**: Free tier available, paid plans from $6/month

---

### 2. n8n (Workflow Automation)
**Best for**: Custom automation workflows

**Setup**:
1. Self-host n8n or use n8n.cloud
2. Create webhook endpoint
3. Get webhook URL

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "n8n Workflows",
  "type": "n8n",
  "config": {
    "webhook_url": "https://your-n8n-instance.com/webhook/your-id",
    "api_key": "your-n8n-api-key"
  }
}
```

---

### 3. Zapier
**Getting API Access**:
1. Sign up at https://zapier.com
2. Create Zap with webhook trigger
3. Get webhook URL

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "Zapier Automation",
  "type": "zapier",
  "config": {
    "webhook_url": "https://hooks.zapier.com/hooks/catch/your-id"
  }
}
```

---

## AI Services

### 1. OpenAI (Script Generation)
**Getting API Key**:
1. Sign up at https://platform.openai.com
2. Go to API Keys section
3. Create new secret key

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "OpenAI GPT-4",
  "type": "openai",
  "api_key": "sk-your-openai-api-key",
  "config": {
    "model": "gpt-4",
    "max_tokens": 2000
  }
}
```

**Pricing**: Pay per token, ~$0.03 per 1K tokens (GPT-4)

---

### 2. ElevenLabs (Voice Generation)
**Best for**: High-quality AI voice narration

**Getting API Key**:
1. Sign up at https://elevenlabs.io
2. Go to Profile → API Keys
3. Generate new key

**Add to System**:
```bash
POST /api/v1/integrations
{
  "name": "ElevenLabs Voice",
  "type": "elevenlabs",
  "api_key": "your-elevenlabs-api-key",
  "config": {
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "model_id": "eleven_monolingual_v1"
  }
}
```

**Pricing**: Free tier 10K characters/month, paid from $5/month

---

## API Usage Examples

### List All Integrations
```bash
GET /api/v1/integrations
```

Response:
```json
{
  "integrations": [
    {
      "id": "uuid-here",
      "name": "HeyGen Production",
      "type": "heygen",
      "api_key": "****xyz123",
      "is_active": true,
      "is_verified": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

### Verify Integration
```bash
POST /api/v1/integrations/{integration_id}/verify
```

### Update Integration
```bash
PUT /api/v1/integrations/{integration_id}
{
  "api_key": "new-api-key",
  "is_active": true
}
```

### Deactivate Integration
```bash
POST /api/v1/integrations/{integration_id}/deactivate
```

### Delete Integration
```bash
DELETE /api/v1/integrations/{integration_id}
```

---

## Security Best Practices

1. **Never commit API keys to version control**
2. **Use environment variables for sensitive data**
3. **Rotate keys regularly**
4. **Use separate keys for development/production**
5. **Monitor API usage and set up alerts**
6. **Implement rate limiting**
7. **Use HTTPS only**

---

## Workflow Example: Complete Video Pipeline

1. **Add OpenAI integration** for script generation
2. **Add HeyGen integration** for video creation
3. **Add Buffer integration** for scheduling
4. **Add TikTok, Instagram, YouTube integrations** for posting

Then use the API:
```bash
# 1. Generate script
POST /api/v1/scripts/generate
{
  "topic": "Scary story about haunted house",
  "niche": "horror"
}

# 2. Create video (uses HeyGen integration)
POST /api/v1/videos
{
  "script_id": "script-uuid",
  "platform": "heygen"
}

# 3. Schedule posts (uses Buffer + social media integrations)
POST /api/v1/posts
{
  "video_id": "video-uuid",
  "platforms": ["tiktok", "instagram", "youtube"],
  "scheduled_at": "2024-01-15T18:00:00Z"
}
```

---

## Troubleshooting

### Integration Not Verified
- Check API key is correct
- Ensure account has proper permissions
- Verify API endpoint is accessible
- Check rate limits haven't been exceeded

### Posts Failing
- Verify social media integration is active
- Check video format meets platform requirements
- Ensure access tokens haven't expired
- Review platform-specific posting limits

### Video Generation Errors
- Confirm sufficient credits in video service account
- Check script length meets service limits
- Verify avatar/voice IDs are valid
- Review service status page

---

## Support

For issues or questions:
- Check API documentation at `/docs`
- Review error messages in API responses
- Contact service providers for platform-specific issues
- Check integration status with verify endpoint

---

**Made with Bob** 🤖