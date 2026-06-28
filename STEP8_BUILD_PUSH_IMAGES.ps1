# =============================================================================
# STEP 8 - Build and Push Docker Images (No Docker Desktop Required)
# Uses Azure Container Registry Tasks to build images IN THE CLOUD.
# Run this from: C:\Users\JohnKirshy\Desktop\ai-content-monetization
# =============================================================================

# ── Variables ─────────────────────────────────────────────────────────────────
$ACR_NAME       = "txnightcoderregistry"
$RESOURCE_GROUP = "ai-video-pipeline"

# =============================================================================
Write-Host ""
Write-Host "=== Step 8: Build and Push Docker Images via ACR Tasks ===" -ForegroundColor Cyan
Write-Host "No local Docker required - builds run inside Azure." -ForegroundColor DarkGray
Write-Host ""

# ── 1. Verify Azure CLI is authenticated ──────────────────────────────────────
# az acr build uses your Azure CLI identity directly - no Docker login needed.
Write-Host "Verifying Azure CLI identity..." -ForegroundColor Yellow
$account = az account show --query "user.name" -o tsv 2>&1
if (-not $?) {
    Write-Error "Not logged in. Run 'az login' first."
    exit 1
}
Write-Host "Authenticated as: $account" -ForegroundColor Green

# ── 2. Build backend image in Azure ──────────────────────────────────────────
Write-Host ""
Write-Host "Building BACKEND image in Azure (takes ~5 min)..." -ForegroundColor Yellow

az acr build `
  --registry $ACR_NAME `
  --image "backend:latest" `
  --file "./backend/Dockerfile" `
  ./backend

if (-not $?) {
    Write-Error "Backend build failed. Check output above."
    exit 1
}
Write-Host "Backend image built successfully." -ForegroundColor Green

# ── 3. Build frontend image in Azure ─────────────────────────────────────────
Write-Host ""
Write-Host "Building FRONTEND image in Azure (takes ~3 min)..." -ForegroundColor Yellow

# VITE_API_URL is baked into the React bundle at build time.
# This assumes your backend App Service will be named txnightcoderregistry-backend.
# Update this URL after Step 10 if your backend has a different hostname.
$BACKEND_URL = "https://txnightcoderregistry-backend.azurewebsites.net"

az acr build `
  --registry $ACR_NAME `
  --image "frontend:latest" `
  --file "./frontend/Dockerfile" `
  --build-arg "VITE_API_URL=$BACKEND_URL" `
  ./frontend

if (-not $?) {
    Write-Error "Frontend build failed. Check output above."
    exit 1
}
Write-Host "Frontend image built successfully." -ForegroundColor Green

# ── 4. Verify ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Images now in ACR:" -ForegroundColor Cyan
az acr repository list --name $ACR_NAME --output table

Write-Host ""
Write-Host "Backend tags:" -ForegroundColor Cyan
az acr repository show-tags --name $ACR_NAME --repository backend --output table

Write-Host ""
Write-Host "Frontend tags:" -ForegroundColor Cyan
az acr repository show-tags --name $ACR_NAME --repository frontend --output table

Write-Host ""
Write-Host "=== Step 8 COMPLETE ===" -ForegroundColor Green
Write-Host "  Backend image : ${ACR_NAME}.azurecr.io/backend:latest" -ForegroundColor Green
Write-Host "  Frontend image: ${ACR_NAME}.azurecr.io/frontend:latest" -ForegroundColor Green
Write-Host ""
Write-Host "Next: run Step 9 (App Service Plan) then Steps 10-11 to deploy." -ForegroundColor Cyan
