# =============================================================================
# DEPLOY.ps1 - One-click deploy to Azure
# Commits any uncommitted changes, pushes to GitHub, rebuilds the backend
# Docker image in Azure ACR, and updates the Container App.
#
# Run from: C:\Users\JohnKirshy\Desktop\ai-content-monetization
#   .\DEPLOY.ps1
#   .\DEPLOY.ps1 -Message "my commit message"   # custom commit message
#   .\DEPLOY.ps1 -SkipGit                       # skip git push (image only)
# =============================================================================

param(
    [string]$Message = "",
    [switch]$SkipGit
)

# Config
$ACR_NAME       = "txnightcoderregistry"
$RESOURCE_GROUP = "ai-video-pipeline"
$CONTAINER_APP  = "ai-content-backend"
$IMAGE          = "${ACR_NAME}.azurecr.io/backend:latest"

$ErrorActionPreference = "Stop"

function Step([string]$text) {
    Write-Host ""
    Write-Host "-- $text" -ForegroundColor Cyan
}

function OK([string]$text) {
    Write-Host "  OK: $text" -ForegroundColor Green
}

function Fail([string]$text) {
    Write-Host ""
    Write-Host "  FAILED: $text" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "  Deploy: ai-content-backend to Azure"       -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow

# 1. Git commit + push
if (-not $SkipGit) {
    Step "Git - committing and pushing"

    $status = git status --porcelain 2>&1
    if ($status) {
        if (-not $Message) {
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
            $Message = "Deploy $timestamp"
        }
        git add -A
        if (-not $?) { Fail "git add failed" }

        git commit -m $Message
        if (-not $?) { Fail "git commit failed" }
        OK "Committed: $Message"
    } else {
        OK "Nothing to commit - working tree clean"
    }

    git push origin main
    if (-not $?) { Fail "git push failed - check your remote or credentials" }
    OK "Pushed to GitHub (origin/main)"
}

# 2. Verify Azure CLI login
Step "Azure CLI - verifying login"
$account = az account show --query "user.name" -o tsv 2>&1
if (-not $?) {
    Write-Host "  Not logged in. Running az login..." -ForegroundColor Yellow
    az login
    if (-not $?) { Fail "az login failed" }
}
OK "Authenticated as: $account"

# 3. Build backend image in ACR
Step "ACR Build - building backend image in Azure (~5 min)"
Write-Host "  Registry : $ACR_NAME"   -ForegroundColor DarkGray
Write-Host "  Image    : $IMAGE"      -ForegroundColor DarkGray

az acr build `
    --registry $ACR_NAME `
    --image "backend:latest" `
    --file "./backend/Dockerfile" `
    ./backend

if (-not $?) { Fail "ACR build failed - see output above" }
OK "Image built and pushed to ACR"

# 4. Update Container App
Step "Container App - deploying new image"
az containerapp update `
    --name $CONTAINER_APP `
    --resource-group $RESOURCE_GROUP `
    --image $IMAGE

if (-not $?) { Fail "Container App update failed - see output above" }
OK "Container App updated"

# 5. Done
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Deploy complete!"                           -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Health : https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io/health"
Write-Host "  API    : https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io/docs"
Write-Host ""
