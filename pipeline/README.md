# Daily Video Pipeline — Azure Function

Generates **5 short-form videos/day** using AI and auto-posts them to TikTok, Instagram, YouTube, and more via Buffer.

Runs on **Azure Functions (Consumption plan)** — practically free (1M free executions/month).

---

## How It Works

```
6 AM UTC daily:
  OpenAI GPT-4o-mini → 5 topics + 5 scripts
  Video API (Pictory / InVideo / RunwayML) → 5 videos
  Buffer API → schedule posts at 8 AM, 11 AM, 2 PM, 5 PM, 8 PM
```

---

## File Structure

```
pipeline/
├── daily_pipeline.py   ← The entire pipeline (~220 lines)
├── requirements.txt    ← Only 4 packages
├── host.json           ← Azure Function config
├── .env.example        ← Copy to .env and fill in your keys
└── README.md
```

---

## Setup

### 1. Copy and fill in your .env

```powershell
Copy-Item .env.example .env
# Then open .env and add your API keys
```

### 2. Choose your video provider (pick one)

| Provider | Cost | Videos/mo | Style | Sign Up |
|----------|------|-----------|-------|---------|
| **Pictory AI** | $23/mo | 30 | Faceless, stock footage + voiceover | https://pictory.ai |
| **InVideo AI** | $30/mo | Unlimited | Faceless, stock footage + voiceover | https://ai.invideo.io |
| **RunwayML** | $15/mo | ~25 (5 credits each) | AI-generated visual | https://runwayml.com |

Set `VIDEO_PROVIDER=pictory` (or `invideo` or `runway`) in your `.env`.

### 3. Set up Buffer (free or $6/mo)

1. Sign up at https://buffer.com
2. Connect your social accounts (TikTok, Instagram, YouTube, etc.)
3. Create an app at https://buffer.com/developers/apps to get your access token
4. Find your profile IDs:
   ```
   curl "https://api.bufferapp.com/1/profiles.json?access_token=YOUR_TOKEN"
   ```
5. Add `BUFFER_ACCESS_TOKEN` and `BUFFER_PROFILE_IDS` to `.env`

### 4. Test locally

```powershell
cd pipeline
pip install -r requirements.txt
python daily_pipeline.py
```

### 5. Deploy to Azure Functions

```powershell
# Install Azure Functions Core Tools if not already installed
npm install -g azure-functions-core-tools@4

# Login to Azure
az login

# Create a Function App (Consumption = free tier)
az group create --name rg-video-pipeline --location eastus
az storage account create --name stvideopipeline --resource-group rg-video-pipeline --sku Standard_LRS
az functionapp create `
  --resource-group rg-video-pipeline `
  --consumption-plan-location eastus `
  --runtime python `
  --runtime-version 3.11 `
  --functions-version 4 `
  --name video-pipeline-func `
  --storage-account stvideopipeline `
  --os-type linux

# Set all your environment variables
az functionapp config appsettings set `
  --name video-pipeline-func `
  --resource-group rg-video-pipeline `
  --settings `
    OPENAI_API_KEY="sk-..." `
    BUFFER_ACCESS_TOKEN="your_token" `
    BUFFER_PROFILE_IDS="id1,id2,id3" `
    VIDEO_PROVIDER="pictory" `
    PICTORY_API_KEY="your_key" `
    PICTORY_API_SECRET="your_secret" `
    NICHE="AI tools and productivity" `
    VIDEOS_PER_DAY="5"

# Deploy
func azure functionapp publish video-pipeline-func
```

### 6. Verify it's running

In Azure Portal → Function App → Functions → `daily_pipeline` → Monitor  
You'll see logs for every run. The timer fires at **6:00 AM UTC** every day.

---

## Monthly Cost Estimate

| Service | Cost |
|---------|------|
| Azure Functions (Consumption) | **FREE** |
| OpenAI GPT-4o-mini (5 scripts/day) | ~$0.50/mo |
| Buffer Free (3 channels) | **FREE** |
| Buffer Essentials (more channels) | $6/mo |
| Pictory AI Standard | $23/mo |
| **Total (Pictory + Buffer Free)** | **~$24/mo** |

Compare to the old plan: **$168–250/month** with PostgreSQL, Redis, Celery, n8n, Docker.

---

## Changing Your Niche or Schedule

Just update `.env` (locally) or Azure Function App Settings (in portal):

- `NICHE` — change topics to any niche (finance, fitness, cooking, crypto, etc.)
- `VIDEOS_PER_DAY` — set to 3, 5, or more (limited by your video plan)
- Timer schedule — edit the `schedule` in `daily_pipeline.py`:
  - `"0 0 6 * * *"` = every day at 6 AM UTC
  - `"0 0 6 * * 1-5"` = weekdays only
  - `"0 0 */6 * * *"` = every 6 hours

---

## Troubleshooting

**Videos not being created**
- Check your video provider API key is correct
- Confirm your plan has credits/videos remaining
- Check Azure Function logs for the exact error

**Posts not appearing in Buffer**
- Verify your `BUFFER_PROFILE_IDS` are correct (use the curl command above)
- Check your Buffer account has the platforms connected
- Make sure the social account tokens haven't expired in Buffer

**Function not triggering**
- Check Azure Portal → Function App → Functions → daily_pipeline is enabled
- Check the timer schedule format (uses NCRONTAB: seconds minutes hours day month weekday)
