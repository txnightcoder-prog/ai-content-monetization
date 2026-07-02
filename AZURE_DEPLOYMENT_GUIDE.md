# Azure Deployment Guide - AI Content Monetization System

Complete step-by-step guide to deploy the AI Content Monetization System to Microsoft Azure.

## 📋 Overview

This guide will help you deploy a fully automated content monetization platform on Azure, including:
- FastAPI backend with PostgreSQL database
- React frontend dashboard
- Redis cache for task queues
- Celery workers for background jobs
- n8n for workflow automation
- Blob storage for video files

**Estimated Deployment Time**: 2-3 hours  
**Estimated Monthly Cost**: $165-250

---

## Prerequisites

### Required Tools
- ✅ Azure account with active subscription
- ✅ Azure CLI installed (version 2.50+)
- ✅ Git installed
- ✅ PowerShell or Bash terminal
- ℹ️ Docker Desktop **not required** — images are built in Azure via ACR Tasks

### Required API Keys
- OpenAI API key
- Vicsee API key (for video generation)
- Buffer access token
- Stan Store API credentials
- Beehiiv API key

### Verify Installation

```powershell
# Check Azure CLI
az --version

# Login to Azure
az login

# List subscriptions
az account list --output table

# Set active subscription
az account set --subscription "Your-Subscription-Name"

# Check Docker
docker --version
docker ps
```

---

## Cost Breakdown

### Monthly Azure Costs

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| App Service Plan | B2 (2 cores, 3.5GB RAM) | $73 |
| PostgreSQL Flexible Server | B1ms (1 vCore, 2GB RAM) | $28 |
| Redis Cache | C0 (250MB) | $16 |
| Blob Storage | Standard LRS (100GB) | $2 |
| Container Registry | Basic | $5 |
| Application Insights | Pay-as-you-go | $5-10 |
| Additional App Services | 3x B1 instances | $39 |
| **Total** | | **$168-173/month** |

### Budget Optimization

**Starter Budget (~$100/month)**:
- Use B1 tier for all App Services ($52)
- Use Burstable B1ms PostgreSQL ($28)
- Use C0 Redis ($16)
- Total: ~$100/month

**Production Scale (~$250/month)**:
- Use P1v2 tier for backend ($146)
- Use General Purpose PostgreSQL ($100)
- Use C1 Redis ($55)
- Total: ~$250/month

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Azure Resource Group                        │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Frontend   │  │   Backend    │  │     n8n      │      │
│  │  App Service │  │  App Service │  │  App Service │      │
│  │   (React)    │  │   (FastAPI)  │  │  (Workflows) │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
│  ┌──────────────┐  ┌──────┴───────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │ Blob Storage │      │
│  │   Database   │◄─┤    Cache     │  │   (Videos)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │   Celery     │  │ Application  │                        │
│  │   Worker     │  │   Insights   │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Steps

### Step 1: Set Up Variables (5 minutes)

Create a PowerShell script with all your variables:

```powershell
# Resource naming
$RESOURCE_GROUP = "rg-content-monetization"
$LOCATION = "eastus"  # Choose: eastus, westus2, westeurope, etc.

# Container Registry (must be globally unique, lowercase, no hyphens)
$ACR_NAME = "acrcontentmon$(Get-Random -Maximum 9999)"

# Database
$POSTGRES_SERVER = "psql-content-mon-$(Get-Random -Maximum 9999)"
$POSTGRES_ADMIN = "adminuser"
$POSTGRES_PASSWORD = "SecurePass123!@#"  # CHANGE THIS!
$POSTGRES_DB = "content_monetization"

# Redis
$REDIS_NAME = "redis-content-mon-$(Get-Random -Maximum 9999)"

# Storage
$STORAGE_ACCOUNT = "stcontentmon$(Get-Random -Maximum 9999)"
$CONTAINER_NAME = "videos"

# Application Insights
$APPINSIGHTS_NAME = "appi-content-monetization"

# App Service Plan
$APP_SERVICE_PLAN = "asp-content-monetization"

# App Services
$BACKEND_APP = "app-backend-content-mon-$(Get-Random -Maximum 9999)"
$FRONTEND_APP = "app-frontend-content-mon-$(Get-Random -Maximum 9999)"
$WORKER_APP = "app-worker-content-mon-$(Get-Random -Maximum 9999)"
$N8N_APP = "app-n8n-content-mon-$(Get-Random -Maximum 9999)"

# n8n credentials
$N8N_PASSWORD = "SecureN8nPass123!@#"  # CHANGE THIS!

# API Keys (replace with your actual keys)
$OPENAI_API_KEY        = "sk-your-openai-key"
$ELEVENLABS_API_KEY    = "your-elevenlabs-api-key"      # elevenlabs.io → Profile → API Keys (free tier available)
$ELEVENLABS_VOICE_ID   = ""                              # optional — leave blank for default Rachel voice
$PEXELS_API_KEY        = "your-pexels-api-key"          # pexels.com/api (free, unlimited)
$BUFFER_ACCESS_TOKEN   = "your-buffer-token"
$STAN_STORE_API_KEY    = "your-stanstore-key"
$BEEHIIV_API_KEY       = "your-beehiiv-key"
$JWT_SECRET            = "your-jwt-secret-$(Get-Random)"

Write-Host "Variables set successfully!" -ForegroundColor Green
```

### Step 2: Create Resource Group (2 minutes)

```powershell
Write-Host "Creating Resource Group..." -ForegroundColor Cyan

az group create `
  --name $RESOURCE_GROUP `
  --location $LOCATION

az group show --name $RESOURCE_GROUP
Write-Host "✓ Resource Group created" -ForegroundColor Green
```

### Step 3: Create Container Registry (10 minutes)

```powershell
Write-Host "Creating Container Registry..." -ForegroundColor Cyan

az acr create `
  --resource-group $RESOURCE_GROUP `
  --name $ACR_NAME `
  --sku Basic `
  --admin-enabled true

# Get credentials
$ACR_USERNAME = az acr credential show --name $ACR_NAME --query username -o tsv
$ACR_PASSWORD = az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv

# Login
az acr login --name $ACR_NAME

Write-Host "✓ Container Registry created: $ACR_NAME" -ForegroundColor Green
Write-Host "  Username: $ACR_USERNAME"
```

### Step 4: Create PostgreSQL Database (15 minutes)

```powershell
Write-Host "Creating PostgreSQL Database..." -ForegroundColor Cyan

az postgres flexible-server create `
  --resource-group $RESOURCE_GROUP `
  --name $POSTGRES_SERVER `
  --location $LOCATION `
  --admin-user $POSTGRES_ADMIN `
  --admin-password $POSTGRES_PASSWORD `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --storage-size 32 `
  --version 15 `
  --public-access 0.0.0.0

# Create database
az postgres flexible-server db create `
  --resource-group $RESOURCE_GROUP `
  --server-name $POSTGRES_SERVER `
  --database-name $POSTGRES_DB

# Allow Azure services
az postgres flexible-server firewall-rule create `
  --resource-group $RESOURCE_GROUP `
  --name $POSTGRES_SERVER `
  --rule-name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0

$DATABASE_URL = "postgresql://${POSTGRES_ADMIN}:${POSTGRES_PASSWORD}@${POSTGRES_SERVER}.postgres.database.azure.com:5432/${POSTGRES_DB}?sslmode=require"

Write-Host "✓ PostgreSQL Database created" -ForegroundColor Green
Write-Host "  Server: $POSTGRES_SERVER"
Write-Host "  Database: $POSTGRES_DB"
```

### Step 5: Create Redis Cache (10 minutes)

```powershell
Write-Host "Creating Redis Cache..." -ForegroundColor Cyan

az redis create `
  --resource-group $RESOURCE_GROUP `
  --name $REDIS_NAME `
  --location $LOCATION `
  --sku Basic `
  --vm-size c0 `
  --enable-non-ssl-port false

# Get connection info
$REDIS_HOST = az redis show --name $REDIS_NAME --resource-group $RESOURCE_GROUP --query hostName -o tsv
$REDIS_KEY = az redis list-keys --name $REDIS_NAME --resource-group $RESOURCE_GROUP --query primaryKey -o tsv
$REDIS_URL = "rediss://:${REDIS_KEY}@${REDIS_HOST}:6380/0"

Write-Host "✓ Redis Cache created" -ForegroundColor Green
Write-Host "  Host: $REDIS_HOST"
```

### Step 6: Create Blob Storage (10 minutes)

```powershell
Write-Host "Creating Blob Storage..." -ForegroundColor Cyan

az storage account create `
  --resource-group $RESOURCE_GROUP `
  --name $STORAGE_ACCOUNT `
  --location $LOCATION `
  --sku Standard_LRS `
  --kind StorageV2

$STORAGE_CONNECTION = az storage account show-connection-string `
  --resource-group $RESOURCE_GROUP `
  --name $STORAGE_ACCOUNT `
  --query connectionString -o tsv

az storage container create `
  --name $CONTAINER_NAME `
  --connection-string $STORAGE_CONNECTION `
  --public-access off

Write-Host "✓ Blob Storage created" -ForegroundColor Green
Write-Host "  Account: $STORAGE_ACCOUNT"
Write-Host "  Container: $CONTAINER_NAME"
```

### Step 7: Create Application Insights (5 minutes)

```powershell
Write-Host "Creating Application Insights..." -ForegroundColor Cyan

az monitor app-insights component create `
  --app $APPINSIGHTS_NAME `
  --location $LOCATION `
  --resource-group $RESOURCE_GROUP `
  --application-type web

$APPINSIGHTS_KEY = az monitor app-insights component show `
  --app $APPINSIGHTS_NAME `
  --resource-group $RESOURCE_GROUP `
  --query instrumentationKey -o tsv

Write-Host "✓ Application Insights created" -ForegroundColor Green
```

### Step 8: Build and Push Docker Images (30 minutes)

> **No Docker Desktop required.** Images are built inside Azure using ACR Tasks.
> Run the ready-made script: **`STEP8_BUILD_PUSH_IMAGES.ps1`**

```powershell
# From the project root:
cd C:\Users\JohnKirshy\Desktop\ai-content-monetization

# Edit ACR_NAME and RESOURCE_GROUP at the top of the script first, then:
.\STEP8_BUILD_PUSH_IMAGES.ps1
```

What the script does:
1. `az acr login` — authenticates to your registry
2. `az acr build` — uploads `./backend` source to Azure and builds the image there
3. `az acr build` — uploads `./frontend` source to Azure and builds the image there
4. Verifies both tags appear in ACR

```powershell
# Verify manually at any time:
az acr repository list --name $ACR_NAME --output table
```

```powershell
Write-Host "✓ Docker images built and pushed" -ForegroundColor Green
```

> ⚠️ **Steps 9–13 replaced with Azure Container Apps** — the original App Service plan
> approach is blocked by VM quota limits on this subscription. Container Apps is serverless,
> cheaper (scales to zero), and works without any quota requests.

### Step 9: Create Container Apps Environment (5 minutes)

```powershell
Write-Host "Creating Container Apps Environment..." -ForegroundColor Cyan

az provider register --namespace Microsoft.App

# Poll until registered
do {
    Start-Sleep -Seconds 10
    $state = az provider show --namespace Microsoft.App --query "registrationState" -o tsv
    Write-Host "  Microsoft.App: $state"
} while ($state -ne "Registered")

az containerapp env create `
  --name ai-content-env `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION

Write-Host "✓ Container Apps Environment created" -ForegroundColor Green
```

### Step 10: Deploy Backend (10 minutes)

```powershell
Write-Host "Deploying Backend..." -ForegroundColor Cyan

az containerapp create `
  --name ai-content-backend `
  --resource-group $RESOURCE_GROUP `
  --environment ai-content-env `
  --image ${ACR_NAME}.azurecr.io/backend:latest `
  --registry-server ${ACR_NAME}.azurecr.io `
  --registry-username $ACR_USERNAME `
  --registry-password $ACR_PASSWORD `
  --target-port 8000 `
  --ingress external `
  --min-replicas 0 `
  --max-replicas 2 `
  --cpu 0.5 `
  --memory 1.0Gi `
  --env-vars `
    DATABASE_URL=$DATABASE_URL `
    OPENAI_API_KEY=$OPENAI_API_KEY `
    ELEVENLABS_API_KEY=$ELEVENLABS_API_KEY `
    ELEVENLABS_VOICE_ID=$ELEVENLABS_VOICE_ID `
    PEXELS_API_KEY=$PEXELS_API_KEY `
    BUFFER_ACCESS_TOKEN=$BUFFER_ACCESS_TOKEN `
    STAN_STORE_API_KEY=$STAN_STORE_API_KEY `
    BEEHIIV_API_KEY=$BEEHIIV_API_KEY `
    JWT_SECRET=$JWT_SECRET `
    AZURE_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION `
    VIDEO_OUTPUT_DIR=/tmp/videos

$BACKEND_URL = "https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io"
Write-Host "✓ Backend deployed" -ForegroundColor Green
Write-Host "  URL: $BACKEND_URL"
```

**LIVE URL:** https://ai-content-backend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io

### Step 11: Deploy Frontend (10 minutes)

```powershell
Write-Host "Deploying Frontend..." -ForegroundColor Cyan

az containerapp create `
  --name ai-content-frontend `
  --resource-group $RESOURCE_GROUP `
  --environment ai-content-env `
  --image ${ACR_NAME}.azurecr.io/frontend:latest `
  --registry-server ${ACR_NAME}.azurecr.io `
  --registry-username $ACR_USERNAME `
  --registry-password $ACR_PASSWORD `
  --target-port 3000 `
  --ingress external `
  --min-replicas 0 `
  --max-replicas 2 `
  --cpu 0.25 `
  --memory 0.5Gi

$FRONTEND_URL = "https://ai-content-frontend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io"
Write-Host "✓ Frontend deployed" -ForegroundColor Green
Write-Host "  URL: $FRONTEND_URL"
```

**LIVE URL:** https://ai-content-frontend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io

### Step 12: Configure CORS (2 minutes)

```powershell
Write-Host "Configuring CORS..." -ForegroundColor Cyan

az containerapp update `
  --name ai-content-backend `
  --resource-group $RESOURCE_GROUP `
  --set-env-vars ALLOWED_ORIGINS="https://ai-content-frontend.victoriousmeadow-edd1d4e3.eastus.azurecontainerapps.io"

Write-Host "✓ CORS configured" -ForegroundColor Green
```

### Step 13: Run Database Migrations (5 minutes)

```powershell
Write-Host "Running database migrations..." -ForegroundColor Cyan

# Execute alembic inside the running container
az containerapp exec `
  --name ai-content-backend `
  --resource-group $RESOURCE_GROUP `
  --command "alembic upgrade head"

Write-Host "✓ Database migrations complete" -ForegroundColor Green
```

---

## Post-Deployment

### Verify Deployment

```powershell
Write-Host "`n=== Deployment Summary ===" -ForegroundColor Yellow
Write-Host "Frontend URL: $FRONTEND_URL"
Write-Host "Backend URL: $BACKEND_URL"
Write-Host "API Docs: ${BACKEND_URL}/docs"
Write-Host "n8n URL: $N8N_URL"
Write-Host "`nDatabase: $POSTGRES_SERVER"
Write-Host "Redis: $REDIS_NAME"
Write-Host "Storage: $STORAGE_ACCOUNT"
```

### Test Endpoints

```powershell
# Test backend health
Invoke-WebRequest -Uri "${BACKEND_URL}/health" -Method GET

# Test frontend
Invoke-WebRequest -Uri $FRONTEND_URL -Method GET

# Test n8n
Invoke-WebRequest -Uri $N8N_URL -Method GET
```

### Save Credentials

Create a secure file with all your credentials:

```text
=== AI Content Monetization - Azure Deployment ===

Frontend: https://app-frontend-content-mon-XXXX.azurewebsites.net
Backend: https://app-backend-content-mon-XXXX.azurewebsites.net
API Docs: https://app-backend-content-mon-XXXX.azurewebsites.net/docs
n8n: https://app-n8n-content-mon-XXXX.azurewebsites.net

n8n Login:
- Username: admin
- Password: [your-n8n-password]

Database:
- Server: psql-content-mon-XXXX.postgres.database.azure.com
- Database: content_monetization
- Username: adminuser
- Password: [your-db-password]

Redis:
- Host: redis-content-mon-XXXX.redis.cache.windows.net
- Port: 6380 (SSL)

Storage:
- Account: stcontentmonXXXX
- Container: videos
```

---

## Monitoring

### View Logs

```powershell
# Backend logs
az webapp log tail --resource-group $RESOURCE_GROUP --name $BACKEND_APP

# Worker logs
az webapp log tail --resource-group $RESOURCE_GROUP --name $WORKER_APP

# Download logs
az webapp log download --resource-group $RESOURCE_GROUP --name $BACKEND_APP --log-file backend-logs.zip
```

### Application Insights

1. Go to Azure Portal
2. Navigate to Application Insights resource
3. View:
   - Live Metrics
   - Failures
   - Performance
   - Usage

### Set Up Alerts

```powershell
# High CPU alert
az monitor metrics alert create `
  --name "High CPU Alert" `
  --resource-group $RESOURCE_GROUP `
  --scopes "/subscriptions/<subscription-id>/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/${BACKEND_APP}" `
  --condition "avg Percentage CPU > 80" `
  --window-size 5m `
  --evaluation-frequency 1m

# Failed requests alert
az monitor metrics alert create `
  --name "Failed Requests Alert" `
  --resource-group $RESOURCE_GROUP `
  --scopes "/subscriptions/<subscription-id>/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/${BACKEND_APP}" `
  --condition "total Http5xx > 10" `
  --window-size 5m `
  --evaluation-frequency 1m
```

---

## Maintenance

### Update Application

```powershell
# Build new image
cd C:\Users\JohnKirshy\Desktop\ai-content-monetization
docker build -t ${ACR_NAME}.azurecr.io/backend:latest ./backend

# Push to ACR
docker push ${ACR_NAME}.azurecr.io/backend:latest

# Restart app to pull new image
az webapp restart --resource-group $RESOURCE_GROUP --name $BACKEND_APP
```

### Backup Database

```powershell
# Create backup
az postgres flexible-server backup create `
  --resource-group $RESOURCE_GROUP `
  --name $POSTGRES_SERVER `
  --backup-name "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# List backups
az postgres flexible-server backup list `
  --resource-group $RESOURCE_GROUP `
  --name $POSTGRES_SERVER
```

### Scale Resources

```powershell
# Scale up App Service Plan
az appservice plan update `
  --resource-group $RESOURCE_GROUP `
  --name $APP_SERVICE_PLAN `
  --sku P1v2

# Scale out (add instances)
az appservice plan update `
  --resource-group $RESOURCE_GROUP `
  --name $APP_SERVICE_PLAN `
  --number-of-workers 3
```

---

## Troubleshooting

### Backend Not Starting

```powershell
# Check logs
az webapp log tail --resource-group $RESOURCE_GROUP --name $BACKEND_APP

# Check environment variables
az webapp config appsettings list --resource-group $RESOURCE_GROUP --name $BACKEND_APP --output table

# Restart
az webapp restart --resource-group $RESOURCE_GROUP --name $BACKEND_APP
```

### Database Connection Failed

```powershell
# Test connection
az postgres flexible-server connect `
  --name $POSTGRES_SERVER `
  --admin-user $POSTGRES_ADMIN `
  --admin-password $POSTGRES_PASSWORD

# Check firewall
az postgres flexible-server firewall-rule list `
  --resource-group $RESOURCE_GROUP `
  --name $POSTGRES_SERVER --output table
```

### Redis Connection Issues

```powershell
# Check Redis status
az redis show --name $REDIS_NAME --resource-group $RESOURCE_GROUP

# Get keys
az redis list-keys --name $REDIS_NAME --resource-group $RESOURCE_GROUP
```

### High Costs

```powershell
# Check current usage
az consumption usage list --start-date 2024-01-01 --end-date 2024-01-31

# Downgrade to save costs
az appservice plan update `
  --resource-group $RESOURCE_GROUP `
  --name $APP_SERVICE_PLAN `
  --sku B1
```

---

## Cleanup (Delete Everything)

**WARNING**: This will delete all resources and data!

```powershell
# Delete entire resource group
az group delete --name $RESOURCE_GROUP --yes --no-wait

# Verify deletion
az group list --output table
```

---

## Deployment Checklist

- [ ] All prerequisites installed
- [ ] Azure CLI logged in
- [ ] Variables configured
- [ ] Resource Group created
- [ ] Container Registry created
- [ ] PostgreSQL database created
- [ ] Redis cache created
- [ ] Blob Storage created
- [ ] Application Insights created
- [ ] Docker images built and pushed
- [ ] App Service Plan created
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Celery Worker deployed
- [ ] n8n deployed
- [ ] CORS configured
- [ ] Database migrations run
- [ ] Admin user created
- [ ] All services tested
- [ ] Monitoring configured
- [ ] Credentials saved securely

---

## Next Steps

1. **Access the frontend** at your Frontend URL
2. **Login** with admin credentials
3. **Configure n8n workflows** at your n8n URL
4. **Test content generation** through the dashboard
5. **Monitor performance** in Application Insights
6. **Set up custom domain** (optional)
7. **Configure SSL certificates** (optional)
8. **Enable autoscaling** (optional)

---

## Support Resources

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service)
- [Azure PostgreSQL Documentation](https://docs.microsoft.com/azure/postgresql)
- [Azure Redis Documentation](https://docs.microsoft.com/azure/azure-cache-for-redis)
- [n8n Documentation](https://docs.n8n.io)

---

**Deployment Complete!** 🎉

Your AI Content Monetization System is now live on Azure!