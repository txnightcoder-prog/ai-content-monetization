# =============================================================================
# SET_AZURE_ENV_VARS.ps1
# Pushes ALL environment variables to your live Azure Container App
# without redeploying the image.
#
# BEFORE RUNNING:
#   1. Set your keys in your local .env file, OR set them as shell variables
#      below before running this script.
#   2. Run:  az login   (if not already authenticated)
#   3. Run this script:  .\SET_AZURE_ENV_VARS.ps1
#
# The app will restart automatically after the update — no redeploy needed.
# =============================================================================

# ── Your live Azure resources ─────────────────────────────────────────────────
$RESOURCE_GROUP = "ai-video-pipeline"
$CONTAINER_APP  = "ai-content-backend"

# ── Keys — set these in your shell before running, e.g.:
#    $env:OPENAI_API_KEY = "sk-..."
#    $env:GOOGLE_API_KEY = "AIza..."
# Or paste values directly here (DO NOT commit this file with real keys).
# ─────────────────────────────────────────────────────────────────────────────
$OPENAI_API_KEY         = $env:OPENAI_API_KEY
$GOOGLE_API_KEY         = $env:GOOGLE_API_KEY          # Veo 3 AI video generation
$YOUTUBE_DATA_API_KEY   = $env:YOUTUBE_DATA_API_KEY
$YOUTUBE_CLIENT_ID      = $env:YOUTUBE_CLIENT_ID
$YOUTUBE_CLIENT_SECRET  = $env:YOUTUBE_CLIENT_SECRET
$YOUTUBE_REFRESH_TOKEN  = $env:YOUTUBE_REFRESH_TOKEN
$BUFFER_ACCESS_TOKEN    = $env:BUFFER_ACCESS_TOKEN
# Buffer profile IDs — hardcoded (these don't change)
$BUFFER_INSTAGRAM_PROFILE_ID = "6a40210c5ab6d2f1067c3b38"   # txnightcoder Instagram
$BUFFER_FACEBOOK_PROFILE_ID  = "6a3f042c5ab6d2f10677b34a"   # TXNightCoder Facebook
$BUFFER_YOUTUBE_PROFILE_ID   = "6a3eee185ab6d2f10677589b"   # John Kirshy YouTube
$BUFFER_TIKTOK_PROFILE_ID    = $env:BUFFER_TIKTOK_PROFILE_ID
$DATABASE_URL           = $env:DATABASE_URL
$AZURE_TENANT_ID        = $env:AZURE_TENANT_ID
$AZURE_CLIENT_ID        = $env:AZURE_CLIENT_ID
$AZURE_CLIENT_SECRET    = $env:AZURE_CLIENT_SECRET

# =============================================================================

if (-not $OPENAI_API_KEY) {
    Write-Error "OPENAI_API_KEY is empty. Set it first: `$env:OPENAI_API_KEY='sk-...'"
    exit 1
}

Write-Host ""
Write-Host "=== Updating Azure Container App environment variables ===" -ForegroundColor Cyan
Write-Host "  App           : $CONTAINER_APP"
Write-Host "  Resource Group: $RESOURCE_GROUP"
Write-Host ""

# Build the env-var list — skip any that are empty so existing Azure values are preserved
$envVars = @(
    "OPENAI_API_KEY=$OPENAI_API_KEY"
    "VIDEO_OUTPUT_DIR=/tmp/videos"
)

if ($GOOGLE_API_KEY)         { $envVars += "GOOGLE_API_KEY=$GOOGLE_API_KEY" }
if ($ELEVENLABS_API_KEY)     { $envVars += "ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY" }
if ($ELEVENLABS_VOICE_ID)    { $envVars += "ELEVENLABS_VOICE_ID=$ELEVENLABS_VOICE_ID" }
if ($PEXELS_API_KEY)         { $envVars += "PEXELS_API_KEY=$PEXELS_API_KEY" }
if ($YOUTUBE_DATA_API_KEY)   { $envVars += "YOUTUBE_DATA_API_KEY=$YOUTUBE_DATA_API_KEY" }
if ($YOUTUBE_CLIENT_ID)      { $envVars += "YOUTUBE_CLIENT_ID=$YOUTUBE_CLIENT_ID" }
if ($YOUTUBE_CLIENT_SECRET)  { $envVars += "YOUTUBE_CLIENT_SECRET=$YOUTUBE_CLIENT_SECRET" }
if ($YOUTUBE_REFRESH_TOKEN)  { $envVars += "YOUTUBE_REFRESH_TOKEN=$YOUTUBE_REFRESH_TOKEN" }
if ($BUFFER_ACCESS_TOKEN)    { $envVars += "BUFFER_ACCESS_TOKEN=$BUFFER_ACCESS_TOKEN" }
if ($BUFFER_INSTAGRAM_PROFILE_ID) { $envVars += "BUFFER_INSTAGRAM_PROFILE_ID=$BUFFER_INSTAGRAM_PROFILE_ID" }
if ($BUFFER_FACEBOOK_PROFILE_ID)  { $envVars += "BUFFER_FACEBOOK_PROFILE_ID=$BUFFER_FACEBOOK_PROFILE_ID" }
if ($BUFFER_YOUTUBE_PROFILE_ID)   { $envVars += "BUFFER_YOUTUBE_PROFILE_ID=$BUFFER_YOUTUBE_PROFILE_ID" }
if ($BUFFER_TIKTOK_PROFILE_ID)    { $envVars += "BUFFER_TIKTOK_PROFILE_ID=$BUFFER_TIKTOK_PROFILE_ID" }
if ($DATABASE_URL)           { $envVars += "DATABASE_URL=$DATABASE_URL" }
if ($AZURE_TENANT_ID)        { $envVars += "AZURE_TENANT_ID=$AZURE_TENANT_ID" }
if ($AZURE_CLIENT_ID)        { $envVars += "AZURE_CLIENT_ID=$AZURE_CLIENT_ID" }
if ($AZURE_CLIENT_SECRET)    { $envVars += "AZURE_CLIENT_SECRET=$AZURE_CLIENT_SECRET" }

Write-Host "Setting $($envVars.Count) variables..." -ForegroundColor Yellow
Write-Host ""

az containerapp update `
    --name $CONTAINER_APP `
    --resource-group $RESOURCE_GROUP `
    --set-env-vars @envVars

if ($?) {
    Write-Host ""
    Write-Host "=== Done! ===" -ForegroundColor Green
    Write-Host "All variables pushed. The container app will restart automatically." -ForegroundColor Green
    Write-Host ""
    if ($GOOGLE_API_KEY) {
        Write-Host "  Google Veo 3 is now ACTIVE — AI-generated video clips enabled." -ForegroundColor Green
    } else {
        Write-Host "  GOOGLE_API_KEY not set — Veo inactive, Pexels stock footage will be used." -ForegroundColor Yellow
        Write-Host "  To enable Veo: set `$env:GOOGLE_API_KEY='AIza...' then re-run this script." -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "  Run Diagnostics in the app to confirm all checks pass." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Error "az containerapp update failed. Check the output above."
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Are you logged in?  Run: az login"
    Write-Host "  2. Correct app name?   Run: az containerapp list --resource-group $RESOURCE_GROUP --output table"
    Write-Host "  3. Correct subscription? Run: az account show"
}
