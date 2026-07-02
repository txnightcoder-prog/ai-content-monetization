# =============================================================================
# SET_AZURE_ENV_VARS.ps1
# Pushes the new ElevenLabs + Pexels environment variables to your
# live Azure Container App without redeploying the image.
#
# BEFORE RUNNING:
#   1. Fill in your actual API keys below
#   2. Run:  az login   (if not already authenticated)
#   3. Run this script from any directory
# =============================================================================

# ── Your live Azure resources ─────────────────────────────────────────────────
$RESOURCE_GROUP = "ai-video-pipeline"
$CONTAINER_APP  = "ai-content-backend"

# ── Paste your actual keys here ───────────────────────────────────────────────
$ELEVENLABS_API_KEY  = "***ELEVENLABS_API_KEY_REMOVED***"
$ELEVENLABS_VOICE_ID = ""   # Leave blank for default Rachel voice (recommended)
$PEXELS_API_KEY      = "***PEXELS_API_KEY_REMOVED***"

# =============================================================================

if (-not $ELEVENLABS_API_KEY) {
    Write-Error "ELEVENLABS_API_KEY is empty. Edit this script and add your key."
    exit 1
}

Write-Host ""
Write-Host "=== Updating Azure Container App environment variables ===" -ForegroundColor Cyan
Write-Host "  App           : $CONTAINER_APP"
Write-Host "  Resource Group: $RESOURCE_GROUP"
Write-Host ""

az containerapp update `
    --name $CONTAINER_APP `
    --resource-group $RESOURCE_GROUP `
    --set-env-vars `
        "ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY" `
        "ELEVENLABS_VOICE_ID=$ELEVENLABS_VOICE_ID" `
        "PEXELS_API_KEY=$PEXELS_API_KEY" `
        "VIDEO_OUTPUT_DIR=/tmp/videos"

if ($?) {
    Write-Host ""
    Write-Host "=== Done! ===" -ForegroundColor Green
    Write-Host "Variables set on live container. The app will restart automatically." -ForegroundColor Green
    Write-Host ""
    Write-Host "Check Diagnostics page to confirm ElevenLabs and Pexels both show PASS." -ForegroundColor Yellow
} else {
    Write-Error "az containerapp update failed. Check output above."
    Write-Host ""
    Write-Host "If you see 'container app not found', verify:"
    Write-Host "  1. You are logged in: az login"
    Write-Host "  2. RESOURCE_GROUP and CONTAINER_APP names above are correct"
    Write-Host "  3. Run: az containerapp list --resource-group $RESOURCE_GROUP --output table"
}
