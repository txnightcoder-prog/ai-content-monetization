# ============================================================
# Azure Setup Script for AI Video Pipeline
# Run this ONCE after creating your Azure account.
# Prerequisites: Azure CLI installed (step 1 below)
# ============================================================

# ── EDIT THESE ──────────────────────────────────────────────
$RESOURCE_GROUP  = "ai-video-pipeline"
$LOCATION        = "eastus"               # cheapest US region
$STORAGE_NAME    = "aivideopipeline$(-join ((97..122) | Get-Random -Count 6 | % {[char]$_}))"  # must be globally unique, lowercase only
$CONTAINER_NAME  = "videos"
$FUNCTION_APP    = "ai-video-pipeline-func"
$PYTHON_VERSION  = "3.11"                 # Azure Functions supports up to 3.11
# ────────────────────────────────────────────────────────────

Write-Host "=== Step 1: Login to Azure ===" -ForegroundColor Cyan
az login

Write-Host "`n=== Step 2: Create Resource Group ===" -ForegroundColor Cyan
az group create --name $RESOURCE_GROUP --location $LOCATION

Write-Host "`n=== Step 3: Create Storage Account ===" -ForegroundColor Cyan
az storage account create `
    --name $STORAGE_NAME `
    --resource-group $RESOURCE_GROUP `
    --location $LOCATION `
    --sku Standard_LRS `
    --allow-blob-public-access true

Write-Host "`n=== Step 4: Create Blob Container (public read) ===" -ForegroundColor Cyan
az storage container create `
    --name $CONTAINER_NAME `
    --account-name $STORAGE_NAME `
    --public-access blob

Write-Host "`n=== Step 5: Get Storage Connection String ===" -ForegroundColor Cyan
$CONN_STR = az storage account show-connection-string `
    --name $STORAGE_NAME `
    --resource-group $RESOURCE_GROUP `
    --query connectionString -o tsv

Write-Host "`n=== Step 6: Create Function App ===" -ForegroundColor Cyan
az functionapp create `
    --name $FUNCTION_APP `
    --resource-group $RESOURCE_GROUP `
    --storage-account $STORAGE_NAME `
    --consumption-plan-location $LOCATION `
    --runtime python `
    --runtime-version $PYTHON_VERSION `
    --functions-version 4 `
    --os-type linux

Write-Host "`n=== Step 7: Set App Settings (environment variables) ===" -ForegroundColor Cyan
# Read values from local .env
$envVars = @{}
Get-Content "$PSScriptRoot\.env" | ForEach-Object {
    if ($_ -match "^([^#][^=]+)=(.+)$") {
        $envVars[$Matches[1].Trim()] = $Matches[2].Trim()
    }
}

az functionapp config appsettings set `
    --name $FUNCTION_APP `
    --resource-group $RESOURCE_GROUP `
    --settings `
        "OPENAI_API_KEY=$($envVars['OPENAI_API_KEY'])" `
        "BUFFER_ACCESS_TOKEN=$($envVars['BUFFER_ACCESS_TOKEN'])" `
        "BUFFER_PROFILE_IDS=$($envVars['BUFFER_PROFILE_IDS'])" `
        "BUFFER_CHANNEL_SERVICES=$($envVars['BUFFER_CHANNEL_SERVICES'])" `
        "AZURE_STORAGE_CONNECTION_STRING=$CONN_STR" `
        "AZURE_STORAGE_CONTAINER=videos" `
        "NICHE=$($envVars['NICHE'])" `
        "VIDEOS_PER_DAY=5" `
        "VOICE=$($envVars['VOICE'])"

Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "Storage Account : $STORAGE_NAME"
Write-Host "Function App    : $FUNCTION_APP"
Write-Host "Connection Str  : $CONN_STR"
Write-Host ""
Write-Host "Add this to your pipeline/.env:" -ForegroundColor Yellow
Write-Host "AZURE_STORAGE_CONNECTION_STRING=$CONN_STR"
Write-Host "AZURE_STORAGE_CONTAINER=videos"
Write-Host ""
Write-Host "Next: run  az functionapp deployment  to deploy the pipeline." -ForegroundColor Cyan
