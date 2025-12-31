#!/bin/bash

###############################################################################
# ischkul-azure: Infrastructure Provisioning Script (Azure CLI)
# Purpose: Create all required Azure resources for Imagine Cup 2026
# Requirements: Azure CLI installed, logged in, subscription selected
###############################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== ischkul-azure Infrastructure Provisioning ===${NC}\n"

# Configuration (EDIT THESE)
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID}"
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-ischkul-rg}"
LOCATION="${AZURE_REGION:-eastus}"
PROJECT_NAME="ischkul"
ENVIRONMENT="${APP_ENV:-development}"

# Resource names
OPENAI_NAME="${PROJECT_NAME}-openai-${RANDOM}"
SEARCH_NAME="${PROJECT_NAME}-search-${RANDOM}"
COSMOS_NAME="${PROJECT_NAME}-cosmos-${RANDOM}"
STORAGE_NAME="${PROJECT_NAME}storage${RANDOM:0:5}"
FUNCAPP_NAME="${PROJECT_NAME}-functions-${RANDOM}"
APPSERVICE_NAME="${PROJECT_NAME}-functions-plan-${RANDOM}"
WEBPUBSUB_NAME="${PROJECT_NAME}-webpubsub-${RANDOM}"
NOTIFICATION_HUB_NAMESPACE="${PROJECT_NAME}-notifhub-${RANDOM}"
NOTIFICATION_HUB_NAME="ischkul-notifications"

echo -e "${YELLOW}Configuration:${NC}"
echo "Subscription: $SUBSCRIPTION_ID"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Environment: $ENVIRONMENT"
echo ""

# Step 1: Validate subscription and login
echo -e "${YELLOW}Step 1: Validating Azure subscription...${NC}"
CURRENT_SUB=$(az account show --query id -o tsv)
if [ "$CURRENT_SUB" != "$SUBSCRIPTION_ID" ] && [ -n "$SUBSCRIPTION_ID" ]; then
  echo "Switching to subscription: $SUBSCRIPTION_ID"
  az account set --subscription "$SUBSCRIPTION_ID"
fi
echo -e "${GREEN}✓ Subscription validated${NC}\n"

# Step 2: Create Resource Group
echo -e "${YELLOW}Step 2: Creating Resource Group...${NC}"
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION"
echo -e "${GREEN}✓ Resource Group created: $RESOURCE_GROUP${NC}\n"

# Step 3: Create Cosmos DB (MongoDB vCore)
echo -e "${YELLOW}Step 3: Creating Cosmos DB (MongoDB vCore)...${NC}"
echo "NOTE: This requires >=2 vCores in selected region. May take 5-10 minutes."

az cosmosdb create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$COSMOS_NAME" \
  --kind MongoDB \
  --capabilities "EnableMongo" \
  --enable-free-tier true \
  --default-consistency-level "Strong" \
  --locations "regionName=$LOCATION" isZoneRedundant=false

# Get Cosmos connection string
COSMOS_CONN=$(az cosmosdb keys list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$COSMOS_NAME" \
  --query "connectionStrings[0].connectionString" \
  -o tsv)
echo -e "${GREEN}✓ Cosmos DB created: $COSMOS_NAME${NC}\n"

# Step 4: Create Azure Blob Storage
echo -e "${YELLOW}Step 4: Creating Azure Blob Storage...${NC}"
az storage account create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_NAME" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind BlobStorage \
  --access-tier Hot

# Get storage connection string
STORAGE_CONN=$(az storage account show-connection-string \
  --resource-group "$RESOURCE_GROUP" \
  --name "$STORAGE_NAME" \
  -o tsv)

# Create blob container
az storage container create \
  --name uploads \
  --connection-string "$STORAGE_CONN"

echo -e "${GREEN}✓ Blob Storage created: $STORAGE_NAME${NC}\n"

# Step 5: Create Azure AI Search
echo -e "${YELLOW}Step 5: Creating Azure AI Search (for vector retrieval)...${NC}"
echo "NOTE: Free tier has 50MB limit. Use Standard for production."

az search service create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$SEARCH_NAME" \
  --location "$LOCATION" \
  --sku free \
  --replica-count 1 \
  --partition-count 1

SEARCH_ENDPOINT="https://${SEARCH_NAME}.search.windows.net"
SEARCH_KEY=$(az search admin-key show \
  --resource-group "$RESOURCE_GROUP" \
  --service-name "$SEARCH_NAME" \
  --query "primaryKey" -o tsv)

echo -e "${GREEN}✓ AI Search created: $SEARCH_NAME${NC}\n"

# Step 6: Create Azure OpenAI Resource (requires quota approval)
echo -e "${YELLOW}Step 6: Creating Azure OpenAI Resource...${NC}"
echo "⚠️  IMPORTANT: Azure OpenAI requires approval from Microsoft"
echo "   If you don't have quota, see: https://aka.ms/oai/access"

az cognitiveservices account create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$OPENAI_NAME" \
  --location "$LOCATION" \
  --kind OpenAI \
  --sku s0 \
  --yes

OPENAI_ENDPOINT="https://${OPENAI_NAME}.openai.azure.com/"
OPENAI_KEY=$(az cognitiveservices account keys list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$OPENAI_NAME" \
  --query "key1" -o tsv)

echo -e "${YELLOW}⚠️  MANUAL STEP REQUIRED:${NC}"
echo "Deploy GPT-4o model to Azure OpenAI:"
echo "  1. Go to Azure Portal → $OPENAI_NAME"
echo "  2. Model deployments → Create new deployment"
echo "  3. Model: gpt-4o, Deployment name: gpt-4o"
echo "  4. This can take 5-10 minutes"
echo ""

echo -e "${GREEN}✓ Azure OpenAI created: $OPENAI_NAME${NC}\n"

# Step 6a: Create Azure Web PubSub (for real-time chat)
echo -e "${YELLOW}Step 6a: Creating Azure Web PubSub (for real-time chat)...${NC}"

az webpubsub create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBPUBSUB_NAME" \
  --location "$LOCATION" \
  --sku Free_F1

WEBPUBSUB_CONN=$(az webpubsub key show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$WEBPUBSUB_NAME" \
  --query "primaryConnectionString" -o tsv)

echo -e "${GREEN}✓ Web PubSub created: $WEBPUBSUB_NAME${NC}\n"

# Step 6b: Create Azure Notification Hubs (for push notifications)
echo -e "${YELLOW}Step 6b: Creating Azure Notification Hubs (for push notifications)...${NC}"

az notification-hub namespace create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$NOTIFICATION_HUB_NAMESPACE" \
  --location "$LOCATION" \
  --sku Free

az notification-hub create \
  --resource-group "$RESOURCE_GROUP" \
  --namespace-name "$NOTIFICATION_HUB_NAMESPACE" \
  --name "$NOTIFICATION_HUB_NAME"

NOTIFICATION_HUB_CONN=$(az notification-hub authorization-rule list-keys \
  --resource-group "$RESOURCE_GROUP" \
  --namespace-name "$NOTIFICATION_HUB_NAMESPACE" \
  --notification-hub-name "$NOTIFICATION_HUB_NAME" \
  --name DefaultListenSharedAccessSignature \
  --query "primaryConnectionString" -o tsv)

echo -e "${GREEN}✓ Notification Hub created: $NOTIFICATION_HUB_NAME${NC}\n"

# Optionally create Azure Functions App Service Plan
echo -e "${YELLOW}Step 7: Creating Azure Functions infrastructure...${NC}"
az appservice plan create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APPSERVICE_NAME" \
  --sku B1 \
  --is-linux

az functionapp create \
  --resource-group "$RESOURCE_GROUP" \
  --consumption-plan-location "$LOCATION" \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name "$FUNCAPP_NAME" \
  --storage-account "$STORAGE_NAME"

echo -e "${GREEN}✓ Functions App created: $FUNCAPP_NAME${NC}\n"

# Step 8: Generate .env file
echo -e "${YELLOW}Step 8: Generating environment configuration...${NC}"
ENV_FILE="backend/.env"
cat > "$ENV_FILE" <<EOF
# Azure Subscription & Resource Group
AZURE_SUBSCRIPTION_ID=$SUBSCRIPTION_ID
AZURE_RESOURCE_GROUP=$RESOURCE_GROUP

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=$OPENAI_ENDPOINT
AZURE_OPENAI_API_KEY=$OPENAI_KEY
AZURE_OPENAI_DEPLOYMENT=gpt-4o

# Azure AI Search (Vector Retrieval)
AZURE_AI_SEARCH_ENDPOINT=$SEARCH_ENDPOINT
AZURE_AI_SEARCH_KEY=$SEARCH_KEY
AZURE_AI_SEARCH_INDEX=ischkul-vectors

# Cosmos DB (MongoDB)
COSMOS_MONGO_CONN=$COSMOS_CONN
COSMOS_DB_NAME=ischkul

# Blob Storage
BLOB_STORAGE_CONN=$STORAGE_CONN
BLOB_CONTAINER_UPLOADS=uploads

# Application
JWT_SECRET=change-me-in-production-$(openssl rand -hex 32)
APP_ENV=$ENVIRONMENT

# Optional: Social/OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF

echo -e "${GREEN}✓ Environment file created: $ENV_FILE${NC}"
echo "  ⚠️  Review and update sensitive values before deploying"
echo ""

# Step 9: Output Summary
echo -e "${GREEN}=== Provisioning Complete ===${NC}\n"

cat > PROVISION_SUMMARY.txt <<EOF
ischkul-azure Infrastructure Summary
====================================

Resource Group: $RESOURCE_GROUP
Location: $LOCATION
Environment: $ENVIRONMENT

CREATED RESOURCES:
------------------
✓ Cosmos DB (MongoDB): $COSMOS_NAME
✓ Blob Storage: $STORAGE_NAME
✓ AI Search: $SEARCH_NAME
✓ OpenAI: $OPENAI_NAME (requires model deployment)
✓ Functions App: $FUNCAPP_NAME

ENDPOINTS:
----------
Cosmos DB: mongodb+srv://<user>:<pass>@${COSMOS_NAME}.mongo.cosmos.azure.com
Blob Storage: https://${STORAGE_NAME}.blob.core.windows.net
AI Search: https://${SEARCH_NAME}.search.windows.net
OpenAI: https://${OPENAI_NAME}.openai.azure.com

NEXT STEPS:
-----------
1. Deploy GPT-4o model to Azure OpenAI ($OPENAI_NAME)
   - Go to Azure Portal → Model deployments
   - Create deployment: gpt-4o

2. Create vector index in Azure AI Search:
   az search index create --service-name $SEARCH_NAME \\
                          --index-name ischkul-vectors \\
                          --index-definition indexes/vector-index.json

3. Install backend dependencies:
   cd backend && npm install

4. Configure Cosmos DB database and collections:
   npm run setup:db

5. Deploy Azure Functions:
   func azure functionapp publish $FUNCAPP_NAME

6. Configure Static Web App for frontend:
   npm run build
   Deploy to Static Web App resource

ENVIRONMENT FILE:
-----------------
Backend configuration: backend/.env
(Generated with connection strings)

MONITORING:
-----------
Enable Application Insights on Functions App for logging
Configure alerts in Azure Portal for cost management

COST NOTES:
-----------
- Cosmos DB: Free tier has limited throughput
- AI Search: Free tier has 50MB limit
- OpenAI: Pay-per-token pricing
- Static Web App: Free tier includes 100GB/month bandwidth

See docs/ARCHITECTURE.md for detailed design documentation.
EOF

echo "Provisioning summary saved to: PROVISION_SUMMARY.txt"
echo ""
echo -e "${YELLOW}CRITICAL NEXT STEPS:${NC}"
echo "1. Deploy GPT-4o model to Azure OpenAI (manual step)"
echo "2. Review backend/.env file and update JWT_SECRET"
echo "3. Run: cd backend && npm run setup:db"
echo "4. Deploy functions: func azure functionapp publish $FUNCAPP_NAME"
echo ""
echo -e "${GREEN}✅ Infrastructure provisioning complete!${NC}"
