# Company Communicator v2 - Setup and Deployment Guide

This guide walks you through deploying Company Communicator v2 from scratch. It assumes you are an Azure-experienced IT administrator or DevOps engineer with Entra ID and Teams administration access.

**Estimated time:** 2-4 hours for the first deployment, depending on familiarity with Azure and Teams.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Entra ID App Registration](#step-1-entra-id-app-registration)
3. [Step 2: Create Entra ID Security Groups](#step-2-create-entra-id-security-groups)
4. [Step 3: Configure GitHub Repository](#step-3-configure-github-repository)
5. [Step 4: Deploy Azure Infrastructure](#step-4-deploy-azure-infrastructure)
6. [Step 5: Deploy Application Code](#step-5-deploy-application-code)
7. [Step 6: Configure Azure SQL](#step-6-configure-azure-sql)
8. [Step 7: Package and Install Teams App](#step-7-package-and-install-teams-app)
9. [Step 8: Verify the Deployment](#step-8-verify-the-deployment)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have:

### Azure Requirements

- **Azure subscription**: Commercial (non-GCC, non-sovereign). Government or specialized cloud subscriptions may have limited service availability.
- **Resource group**: Create one per environment before starting. Choose a region close to your users:
  ```bash
  az group create --name rg-cc-dev --location eastus2
  az group create --name rg-cc-stg --location eastus2
  az group create --name rg-cc-prod --location eastus2
  ```
- **RBAC role**: Contributor or Owner on the target resource group.
- **Resource providers**: Register the required providers (some may not be registered by default):
  **Bash:**
  ```bash
  az provider register --namespace Microsoft.Web
  az provider register --namespace Microsoft.Sql
  az provider register --namespace Microsoft.ServiceBus
  az provider register --namespace Microsoft.Storage
  az provider register --namespace Microsoft.KeyVault
  az provider register --namespace Microsoft.BotService
  az provider register --namespace Microsoft.AlertsManagement
  az provider register --namespace Microsoft.Insights
  ```
  **PowerShell:**
  ```powershell
  @('Microsoft.Web','Microsoft.Sql','Microsoft.ServiceBus','Microsoft.Storage',
    'Microsoft.KeyVault','Microsoft.BotService','Microsoft.AlertsManagement',
    'Microsoft.Insights') | ForEach-Object { az provider register --namespace $_ }
  ```
- **Quota**: Verify you have sufficient quota for the following resources in your chosen region:
  - App Service Plan (S1)
  - Azure Functions (one Consumption plan)
  - Azure SQL Database (Serverless, Gen5)
  - Azure Service Bus (Standard tier)
  - Storage accounts (LRS)

### Entra ID Requirements

- **Global Administrator** or **Application Administrator** role to create app registrations and grant admin consent.
- **Entra ID tenant** that you fully control (required for single-tenant app registration).

### Tools and Software

Install these locally before starting:

- **.NET 8 SDK**: [Download](https://dotnet.microsoft.com/download/dotnet/8)
- **Node.js 20 LTS**: [Download](https://nodejs.org)
- **Azure CLI**: [Installation guide](https://learn.microsoft.com/cli/azure/install-azure-cli)
  - After installation, run: `az bicep install` to enable Bicep support
- **GitHub CLI** (optional but recommended): [Installation guide](https://cli.github.com)
- **EF Core tools** (for database migrations):
  ```bash
  dotnet tool install --global dotnet-ef
  ```

Verify installation:

```bash
az --version
dotnet --version
node --version
```

> **Note:** CLI commands throughout this guide are provided in both **Bash** and **PowerShell** formats. Azure CLI commands (`az ...`) and .NET CLI commands (`dotnet ...`) work identically in both shells; only variable assignment and shell-specific syntax differ.

### Network and Access

- **Firewall rules**: If your organization has restrictive firewall policies, ensure you can reach:
  - `https://login.microsoftonline.com` (Entra ID)
  - `https://graph.microsoft.com` (Microsoft Graph)
  - `https://api.botframework.com` (Azure Bot Service)
  - `https://github.com` (GitHub)
  - Azure service endpoints for your chosen region

---

## Step 1: Entra ID App Registration

This step creates a single-tenant app registration that will be used by:
- The web application (REST API)
- The bot (to send notifications)
- The frontend (to obtain SSO tokens)

### 1.1 Create the Application

1. Open the [Azure Portal](https://portal.azure.com) and navigate to **Entra ID > App registrations > New registration**.

2. Fill in the registration form:
   - **Name**: `Company Communicator v2` (or `CompanyCommunicator-dev` for dev environment)
   - **Supported account types**: **Accounts in this organizational directory only** (single-tenant)
   - **Redirect URI**: Leave blank for now; you'll update this after infrastructure deployment
   - Click **Register**

3. On the app registration overview page, note these values (you'll need them later):
   - **Application (client) ID**
   - **Tenant ID** (Directory)
   - **Object ID**

### 1.2 Configure API Permissions

1. In the app registration, go to **API permissions**.

2. Remove the default "User.Read" permission. Click the three dots next to it and select **Remove**.

3. Click **Add a permission > Microsoft Graph > Application permissions** and add these permissions:
   - `User.Read.All`
   - `Directory.Read.All`
   - `GroupMember.Read.All`
   - `TeamsActivity.Send`

4. Click **Add a permission > Microsoft Graph > Delegated permissions** and add these permissions:
   - `offline_access`
   - `openid`
   - `profile`
   - `User.Read`

   > **Note:** These are delegated permissions (not application permissions) because they are used in the Teams SSO On-Behalf-Of (OBO) token exchange flow, where the backend acts on behalf of the signed-in user.

5. Click **Grant admin consent for [Tenant Name]** to give admin consent for all permissions.

6. Verify all permissions show as "Granted" with a green checkmark.

### 1.3 Expose an API

1. In the app registration, go to **Expose an API**.

2. Click **Set** next to "Application ID URI" and accept the default (`api://{appId}`).

3. Click **Add a scope**:
   - **Scope name**: `user_impersonation`
   - **Who can consent?**: Admin and users
   - **Admin consent display name**: `Access Company Communicator`
   - **Admin consent description**: `Allows the app to access Company Communicator resources on your behalf`
   - **User consent display name**: `Access Company Communicator`
   - **User consent description**: `Allows the app to access Company Communicator resources on your behalf`
   - Click **Add scope**

4. Return to **Expose an API** and add these **Authorized client applications**:
   - **Client ID**: `1fec8e78-bce4-4aaf-ab1b-5451cc387264` (Teams desktop)
   - **Authorized scopes**: `api://{appId}/user_impersonation`
   - Click **Add application**

5. Repeat for **Client ID**: `5e3ce6c0-2b1f-4285-8d4b-75ee78787346` (Teams web)

### 1.4 Configure Token Claims

1. In the app registration, go to **Token configuration**.

2. Click **Add groups claim**:
   - **Group types to include in tokens**: Select **Security groups**
   - Under **Customize token properties by type**, set **Group ID** for all three token types (ID, Access, and SAML)
   - Click **Add**

   > **Note:** Select "Security groups" specifically, not "All groups". The app uses two Entra ID security groups (`CompanyCommunicator-Authors` and `CompanyCommunicator-Admins`) for authorization. Selecting "All groups" would include Microsoft 365 groups and distribution lists, which adds unnecessary claims and can exceed the token size limit (200 groups) in large organizations.

This enables the app to emit the `groups` claim in tokens, which the backend's authorization handler validates against the configured security group Object IDs.

### 1.5 Create a Client Secret

The bot service will use this secret to authenticate with Azure Bot Service.

1. In the app registration, go to **Certificates & secrets**.

2. Click **New client secret**:
   - **Description**: `Bot secret`
   - **Expires**: `24 months` (or your organization's policy)
   - Click **Add**

3. Immediately copy the **Value** (not the ID). You'll store this in Key Vault during infrastructure deployment.

**Important**: You cannot view the secret value again after leaving this page. If you lose it, create a new one.

### 1.6 Configure Authentication (Optional for SSO)

If you want Teams SSO to work in development, add a redirect URI:

1. Go to **Authentication** in the app registration.

2. Click **Add a platform > Single-page application**.

3. Add these Redirect URIs:
   ```
   http://localhost:5173/
   http://localhost:3000/
   https://localhost:5001/
   ```

4. Under "Implicit grant and hybrid flows", check **Access tokens** and **ID tokens**.

5. Click **Configure**.

---

## Step 2: Create Entra ID Security Groups

Replace static user lists with dynamic security groups for role-based access.

### 2.1 Create Author Group

1. In the [Azure Portal](https://portal.azure.com), go to **Entra ID > Groups > New group**.

2. Fill in the form:
   - **Group type**: Security
   - **Group name**: `CompanyCommunicator-Authors`
   - **Group description**: `Users who can create, edit, and send notifications via Company Communicator`
   - **Membership type**: Assigned (you'll manually add members)
   - **Owner**: (your user account)
   - Click **Create**

3. On the new group, go to **Members** and click **Add members**. Add:
   - Your user account
   - Key team members who will author notifications
   - Service accounts for scheduled jobs (if any)

4. Note the **Object ID** of this group (you'll need it for app configuration).

### 2.2 Create Admin Group

1. Create another security group:
   - **Group name**: `CompanyCommunicator-Admins`
   - **Description**: `Administrators with full access to Company Communicator including delete, export, and settings`
   - **Owner**: (your user account)
   - Click **Create**

2. Add members (typically IT admin team members or select power users).

3. Note the **Object ID** of this group.

---

## Step 3: Configure GitHub Repository

This step sets up GitHub environments and OIDC federation for zero-secret deployments.

### 3.1 Create GitHub Environments

1. Navigate to your fork/clone of the Company Communicator repository on GitHub.

2. Go to **Settings > Environments** and create three new environments:
   - `dev`
   - `stg`
   - `prod`

3. For the `prod` environment, configure protection rules:
   - **Deployment branches**: Set to `main` (or require specific branches)
   - **Required reviewers**: Add team members who must approve production deployments
   - Click **Save protection rules**

### 3.2 Set Up OIDC Federated Credentials

For each environment, create an OIDC federated credential in Azure so GitHub can authenticate without storing secrets.

**Per-environment setup (repeat for dev, stg, prod):**

1. In Azure Portal, go to your app registration > **Certificates & secrets**.

2. Click **Federated credentials > Add credential**:
   - **Federated credential scenario**: GitHub Actions deploying Azure resources
   - **Organization**: Your GitHub organization name
   - **Repository**: Your repository name
   - **Entity type**: Environment
   - **Environment name**: `dev` (or `stg`, `prod`)
   - Click **Add**

Verify it was created; you should see a credential with subject like: `repo:{owner}/{repo}:environment:dev` (where `{owner}` is your GitHub username or organization name — an organization is not required)

### 3.3 Create Azure Service Principals

Create a service principal for each environment to own the OIDC credential:

**Bash:**
```bash
# For dev environment
APP_ID=$(az ad app create \
  --display-name "gh-cc-deploy-dev" \
  --query appId -o tsv)

az ad sp create --id $APP_ID

# Grant Contributor role on the resource group
az role assignment create \
  --assignee $APP_ID \
  --role Contributor \
  --scope /subscriptions/<your-subscription-id>/resourceGroups/rg-cc-dev
```

**PowerShell:**
```powershell
# For dev environment
$APP_ID = az ad app create `
  --display-name "gh-cc-deploy-dev" `
  --query appId -o tsv

az ad sp create --id $APP_ID

# Grant Contributor role on the resource group
az role assignment create `
  --assignee $APP_ID `
  --role Contributor `
  --scope /subscriptions/<your-subscription-id>/resourceGroups/rg-cc-dev
```

Repeat for `stg` and `prod` with appropriate app names and resource groups.

### 3.4 Configure Environment Secrets

For each GitHub environment (`dev`, `stg`, `prod`), set these secrets:

| Secret | Value | How to Get |
|--------|-------|-----------|
| `AZURE_CLIENT_ID` | App registration client ID from step 1 | Azure Portal > Entra ID > App registrations > Your app > Client ID |
| `AZURE_TENANT_ID` | Entra ID tenant ID | Azure Portal > Entra ID > Overview > Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID | Azure Portal > Subscriptions > Subscription ID |
| `AZURE_RESOURCE_GROUP` | Resource group name (e.g., `rg-cc-dev`) | Azure Portal > Resource groups |
| `SQL_ADMIN_OBJECT_ID` | Your Entra ID user object ID (for initial setup) | `az ad signed-in-user show --query id -o tsv` |
| `ALERT_EMAIL` | Email for alert notifications | Your team's ops email |
| `BOT_APP_ID` | App registration client ID from step 1 | Azure Portal > App registration > Client ID |
| `SQL_CONNECTION_STRING` | ADO.NET connection string for EF migrations | Will be generated after infra deploy; see step 5 |
| `BOT_APP_SECRET` | Client secret from step 1.5 | Copy from Entra ID (create new if lost) |

Add these via GitHub UI: **Settings > Environments > [environment] > Environment secrets > Add Secret**

**Minimal starter set** (without SQL connection string and bot secret):

```bash
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_RESOURCE_GROUP=rg-cc-dev
SQL_ADMIN_OBJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ALERT_EMAIL=ops-team@contoso.com
BOT_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

You'll add `SQL_CONNECTION_STRING` and `BOT_APP_SECRET` after infrastructure deployment.

---

## Step 4: Deploy Azure Infrastructure

Now deploy all Azure resources using Bicep Infrastructure-as-Code.

### 4.1 Validate Bicep Templates

Before deploying, validate the templates:

**Bash:**
```bash
az deployment group validate \
  --resource-group rg-cc-dev \
  --template-file infra/main.bicep \
  --parameters \
    environmentName=dev \
    appName=cc \
    sqlAdminObjectId="<your-object-id>" \
    alertEmailAddress="ops@contoso.com" \
    botAppId="<bot-app-registration-client-id>"
```

**PowerShell:**
```powershell
az deployment group validate `
  --resource-group rg-cc-dev `
  --template-file infra/main.bicep `
  --parameters `
    environmentName=dev `
    appName=cc `
    sqlAdminObjectId="<your-object-id>" `
    alertEmailAddress="ops@contoso.com" `
    botAppId="<bot-app-registration-client-id>"
```

If validation passes, the output JSON will show `"provisioningState": "Succeeded"` and `"error": null`. You will also see `NestedDeploymentShortCircuited` warnings -- these are normal and expected because validation cannot resolve cross-module `reference()` functions without actually deploying resources. If there are real errors, they will appear in the `"error"` field.

### 4.2 Preview Changes with What-If

See exactly what will be created:

**Bash:**
```bash
az deployment group what-if \
  --resource-group rg-cc-dev \
  --template-file infra/main.bicep \
  --parameters \
    environmentName=dev \
    appName=cc \
    sqlAdminObjectId="<your-object-id>" \
    alertEmailAddress="ops@contoso.com" \
    botAppId="<bot-app-registration-client-id>"
```

**PowerShell:**
```powershell
az deployment group what-if `
  --resource-group rg-cc-dev `
  --template-file infra/main.bicep `
  --parameters `
    environmentName=dev `
    appName=cc `
    sqlAdminObjectId="<your-object-id>" `
    alertEmailAddress="ops@contoso.com" `
    botAppId="<bot-app-registration-client-id>"
```

Review the output. You should see resources being created:
- User-assigned managed identity
- App Service Plan (S1) + Web App
- Function Apps (Prep and Send)
- Azure SQL Database (Serverless)
- Service Bus (Standard)
- Storage Account
- Key Vault
- App Insights + Log Analytics
- Bot Service
- Alerts

### 4.3 Deploy Infrastructure

**Bash:**
```bash
az deployment group create \
  --name "cc-infra-dev-$(date +%Y%m%d%H%M%S)" \
  --resource-group rg-cc-dev \
  --template-file infra/main.bicep \
  --parameters \
    environmentName=dev \
    appName=cc \
    sqlAdminObjectId="<your-object-id>" \
    alertEmailAddress="ops@contoso.com" \
    botAppId="<bot-app-registration-client-id>" \
  --output json > deployment-output.json
```

**PowerShell:**
```powershell
az deployment group create `
  --name "cc-infra-dev-$(Get-Date -Format 'yyyyMMddHHmmss')" `
  --resource-group rg-cc-dev `
  --template-file infra/main.bicep `
  --parameters `
    environmentName=dev `
    appName=cc `
    sqlAdminObjectId="<your-object-id>" `
    alertEmailAddress="ops@contoso.com" `
    botAppId="<bot-app-registration-client-id>" `
  --output json | Out-File deployment-output.json
```

This will take 10-15 minutes. You'll see progress in the terminal. Once complete, check the outputs:

**Bash:**
```bash
jq '.properties.outputs' deployment-output.json
```

**PowerShell:**
```powershell
(Get-Content deployment-output.json | ConvertFrom-Json).properties.outputs
```

Save these values:
- `webAppUrl`: URL of the web application
- `functionAppPrepUrl`: URL of the Prep Function App
- `functionAppSendUrl`: URL of the Send Function App
- `botHandle`: Azure Bot Service resource name
- `keyVaultUri`: URI of the Key Vault
- `appInsightsName`: Application Insights resource name

> **Note: Resource naming convention.** Globally-unique resources (SQL Server, Storage Account, Service Bus, Key Vault, App Service, Function Apps) include a deterministic 5-character suffix derived from your resource group ID. For example, instead of `app-cc-dev` you'll get something like `app-cc-dev-a1b2c`. To discover your actual resource names after deployment, run:
>
> ```bash
> az resource list --resource-group rg-cc-dev --output table
> ```
>
> Throughout this guide, resource names are shown with a `<suffix>` placeholder (e.g., `sql-cc-dev-<suffix>`). Replace `<suffix>` with the 5-character value from your deployment.

### 4.4 Update Entra ID App Registration with Web App URL

Now that you have the web app URL, update the app registration:

1. In Azure Portal, go to your app registration > **Expose an API**.

2. Update the **Application ID URI** to match your web app hostname:
   ```
   api://<web-app-hostname>/<app-id>
   ```
   Example: `api://app-cc-dev-<suffix>.azurewebsites.net/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

3. Go to **Authentication** > **Add a platform** > select **Web** (not "Single-page application"). Add these redirect URIs:
   ```
   https://<web-app-hostname>/auth
   https://<web-app-hostname>/auth/callback
   ```
   Example: `https://app-cc-dev-<suffix>.azurewebsites.net/auth`

4. Click **Save**.

### 4.5 Store Secrets in Key Vault

The Key Vault uses RBAC authorization. The Bicep deployment only grants the managed identity read access ("Key Vault Secrets User"). To write secrets, first grant yourself the "Key Vault Secrets Officer" role:

**Bash:**
```bash
MY_OID=$(az ad signed-in-user show --query id -o tsv)
KV_ID=$(az keyvault show --name "kv-cc-dev-<suffix>" --query id -o tsv)
az role assignment create --role "Key Vault Secrets Officer" --assignee "$MY_OID" --scope "$KV_ID"
```

**PowerShell:**
```powershell
$MY_OID = az ad signed-in-user show --query id -o tsv
$KV_ID = az keyvault show --name "kv-cc-dev-<suffix>" --query id -o tsv
az role assignment create --role "Key Vault Secrets Officer" --assignee $MY_OID --scope $KV_ID
```

Wait ~30 seconds for RBAC propagation, then store the bot app secret:

**Bash:**
```bash
az keyvault secret set \
  --vault-name "kv-cc-dev-<suffix>" \
  --name "BotAppSecret" \
  --value "<bot-client-secret-from-step-1.5>"
```

**PowerShell:**
```powershell
az keyvault secret set `
  --vault-name "kv-cc-dev-<suffix>" `
  --name "BotAppSecret" `
  --value "<bot-client-secret-from-step-1.5>"
```

---

## Step 5: Deploy Application Code

Deploy the backend API, frontend SPA, and Durable Functions.

### 5.1 Via GitHub Actions (Recommended)

If you set up GitHub Environments and OIDC credentials:

1. Go to GitHub Actions > **Deploy Application**.

2. Click **Run workflow**:
   - **Environment**: `dev`
   - Click **Run**

The workflow will:
- Build and test all projects
- Package the Web App, Prep Function, and Send Function as zip files
- Deploy each component to Azure
- Run EF Core database migrations
- Verify the health endpoint

This takes 10-20 minutes. Monitor the workflow in the Actions tab.

### 5.2 Manual Deployment (If Not Using GitHub Actions)

If you prefer to deploy manually:

#### 5.2.1 Build and Publish

**Bash:**
```bash
# Build
dotnet build CompanyCommunicator.sln -c Release

# Publish Web App
dotnet publish src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj \
  -c Release -o ./publish/api

# Publish Prep Function
dotnet publish src/CompanyCommunicator.Functions.Prep/CompanyCommunicator.Functions.Prep.csproj \
  -c Release -o ./publish/func-prep

# Publish Send Function
dotnet publish src/CompanyCommunicator.Functions.Send/CompanyCommunicator.Functions.Send.csproj \
  -c Release -o ./publish/func-send
```

**PowerShell:**
```powershell
# Build
dotnet build CompanyCommunicator.sln -c Release

# Publish Web App
dotnet publish src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj `
  -c Release -o ./publish/api

# Publish Prep Function
dotnet publish src/CompanyCommunicator.Functions.Prep/CompanyCommunicator.Functions.Prep.csproj `
  -c Release -o ./publish/func-prep

# Publish Send Function
dotnet publish src/CompanyCommunicator.Functions.Send/CompanyCommunicator.Functions.Send.csproj `
  -c Release -o ./publish/func-send
```

#### 5.2.2 Package and Deploy

**Bash:**
```bash
# Package
cd publish/api && zip -r ../../api.zip . && cd ../..
cd publish/func-prep && zip -r ../../func-prep.zip . && cd ../..
cd publish/func-send && zip -r ../../func-send.zip . && cd ../..

# Deploy Web App
az webapp deployment source config-zip \
  --resource-group rg-cc-dev \
  --name app-cc-dev-<suffix> \
  --src api.zip

# Deploy Prep Function
az functionapp deployment source config-zip \
  --resource-group rg-cc-dev \
  --name func-cc-prep-dev-<suffix> \
  --src func-prep.zip

# Deploy Send Function
az functionapp deployment source config-zip \
  --resource-group rg-cc-dev \
  --name func-cc-send-dev-<suffix> \
  --src func-send.zip
```

**PowerShell:**
```powershell
# Package
Compress-Archive -Path ./publish/api/* -DestinationPath api.zip -Force
Compress-Archive -Path ./publish/func-prep/* -DestinationPath func-prep.zip -Force
Compress-Archive -Path ./publish/func-send/* -DestinationPath func-send.zip -Force

# Deploy Web App
az webapp deployment source config-zip `
  --resource-group rg-cc-dev `
  --name app-cc-dev-<suffix> `
  --src api.zip

# Deploy Prep Function
az functionapp deployment source config-zip `
  --resource-group rg-cc-dev `
  --name func-cc-prep-dev-<suffix> `
  --src func-prep.zip

# Deploy Send Function
az functionapp deployment source config-zip `
  --resource-group rg-cc-dev `
  --name func-cc-send-dev-<suffix> `
  --src func-send.zip
```

#### 5.2.3 Run Database Migrations

**Bash:**
```bash
dotnet ef database update \
  --project src/CompanyCommunicator.Core/CompanyCommunicator.Core.csproj \
  --startup-project src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj
```

**PowerShell:**
```powershell
dotnet ef database update `
  --project src/CompanyCommunicator.Core/CompanyCommunicator.Core.csproj `
  --startup-project src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj
```

### 5.3 Verify Deployment

Check that the health endpoint responds:

```bash
curl -i https://app-cc-dev-<suffix>.azurewebsites.net/health/ready
```

You should get an HTTP 200 response (authentication required on health endpoint).

---

## Step 6: Configure Azure SQL

Azure SQL is deployed with Entra ID-only authentication. The database schema is created automatically by EF Core migrations.

### 6.1 Verify SQL Server Admin

The managed identity is set as SQL Entra ID administrator by Bicep:

```bash
az sql server ad-admin list --resource-group rg-cc-dev --server sql-cc-dev-<suffix>
```

You should see the managed identity listed.

### 6.2 Verify Database Schema

Connect to the database and verify tables were created:

**Bash:**
```bash
SQL_SERVER=$(az sql server show --resource-group rg-cc-dev --name sql-cc-dev-<suffix> --query fullyQualifiedDomainName -o tsv)

az sql db query --resource-group rg-cc-dev --server sql-cc-dev-<suffix> --database CompanyCommunicator \
  --query-text "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'"
```

**PowerShell:**
```powershell
$SQL_SERVER = az sql server show --resource-group rg-cc-dev --name sql-cc-dev-<suffix> --query fullyQualifiedDomainName -o tsv

az sql db query --resource-group rg-cc-dev --server sql-cc-dev-<suffix> --database CompanyCommunicator `
  --query-text "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'"
```

You should see tables:
- `Notifications`
- `NotificationAudiences`
- `SentNotifications`
- `Users`
- `Teams`
- `ThrottleState`
- `ExportJobs`
- `AppConfigurations`

If the tables are missing, run migrations manually (see section 5.2.3).

---

## Step 7: Package and Install Teams App

Create the Teams app manifest and upload it to Teams Admin Center.

### 7.1 Package the Manifest

Use the GitHub Actions workflow:

1. Go to GitHub Actions > **Package Teams Manifest**.

2. Click **Run workflow**:
   - **Environment**: `dev`
   - **Web app hostname**: `app-cc-dev-<suffix>.azurewebsites.net`
   - Click **Run**

The workflow substitutes tokens in `Manifest/manifest.json` and produces `manifest-dev.zip`.

Alternatively, manually substitute tokens:

**Bash:**
```bash
# Create staging directory
mkdir -p manifest-staging
cp Manifest/color.png manifest-staging/
cp Manifest/outline.png manifest-staging/

# Substitute tokens
sed -e "s|{{BOT_APP_ID}}|<your-app-id>|g" \
    -e "s|{{WEB_APP_HOSTNAME}}|app-cc-dev-<suffix>.azurewebsites.net|g" \
    Manifest/manifest.json > manifest-staging/manifest.json

# Validate JSON
python3 -c "import json; json.load(open('manifest-staging/manifest.json'))"

# Create zip
cd manifest-staging
zip -j ../manifest-dev.zip manifest.json color.png outline.png
cd ..
```

**PowerShell:**
```powershell
# Create staging directory
New-Item -ItemType Directory -Force -Path manifest-staging
Copy-Item Manifest/color.png manifest-staging/
Copy-Item Manifest/outline.png manifest-staging/

# Substitute tokens
(Get-Content Manifest/manifest.json -Raw) `
  -replace '{{BOT_APP_ID}}', '<your-app-id>' `
  -replace '{{WEB_APP_HOSTNAME}}', 'app-cc-dev-<suffix>.azurewebsites.net' |
  Set-Content manifest-staging/manifest.json

# Validate JSON (will throw if invalid)
Get-Content manifest-staging/manifest.json | ConvertFrom-Json | Out-Null

# Create zip
Compress-Archive -Path manifest-staging/* -DestinationPath manifest-dev.zip -Force
```

### 7.2 Sideload for Testing (Optional)

To test with a single user before publishing:

1. Download the `manifest-dev.zip` artifact from the workflow.

2. In Microsoft Teams, go to **Apps > Manage your apps > Upload a custom app**.

3. Select the zip file.

4. Choose a team to install it in for testing.

### 7.3 Upload to Teams Admin Center

For organization-wide installation:

1. Go to **Teams Admin Center** > **Teams apps > Manage apps**.

2. Click **Upload a custom app**.

3. Select your `manifest-dev.zip`.

4. The app will be pending approval. After review:
   - Set **Status**: **Allowed**
   - Set **Permissions**: Configure which users can install the app (all users, specific teams, etc.)
   - Click **Save**

5. The app is now available in the app store for targeted users.

---

## Step 8: Verify the Deployment

### 8.1 Test Application Login

1. Open Teams.

2. Find the Company Communicator app in the app store and install it.

3. Click the app tab. You should see the Company Communicator dashboard.

4. Verify SSO login works (no manual login prompt should appear).

### 8.2 Create a Test Notification

1. In the dashboard, go to **Drafts**.

2. Click **New notification**.

3. Fill in:
   - **Title**: "Test Message"
   - **Summary**: "This is a test"
   - **Recipients**: Select a test team or group
   - Click **Save**

### 8.3 Send Test Notification

1. Open the draft and click **Send**.

2. Confirm the send dialog.

3. Wait 30 seconds for the orchestration to process.

4. Go to **Sent** tab and verify the notification appears with delivery progress.

### 8.4 Check Application Insights

Verify telemetry is flowing:

1. Azure Portal > App Insights > `app-ins-cc-dev`.

2. Go to **Live Metrics** (real-time events) or **Requests** (last 24 hours).

3. You should see API requests, function invocations, and exceptions (if any).

### 8.5 Check Log Analytics

Verify diagnostic logs are flowing:

1. Azure Portal > Log Analytics > `log-cc-dev`.

2. Run a test query:
   ```kusto
   AzureDiagnostics
   | where ResourceType == "DATABASES"
   | take 10
   ```

3. You should see database query logs.

### 8.6 Verify DLQ Alerting

To test the dead-letter queue alert:

1. Manually post a malformed message to the Service Bus queue:
   **Bash:**
   ```bash
   az servicebus queue send --resource-group rg-cc-dev \
     --namespace-name sb-cc-dev-<suffix> --name cc-send \
     --message '{"invalid": "message"}'
   ```
   **PowerShell:**
   ```powershell
   az servicebus queue send --resource-group rg-cc-dev `
     --namespace-name sb-cc-dev-<suffix> --name cc-send `
     --message '{\"invalid\": \"message\"}'
   ```

2. The message will fail processing and go to the DLQ.

3. You should receive an alert email within a few minutes.

---

## Troubleshooting

### SSO Token Errors

**Symptom**: "Unauthorized" when accessing the API, or Teams SSO fails with "Failed to acquire token".

**Diagnosis**: Check the browser console (F12) for specific error messages.

**Solutions**:
- Verify the app registration redirect URIs include your web app hostname (e.g., `https://app-cc-dev-<suffix>.azurewebsites.net/auth`)
- Ensure the app registration has **Expose an API** configured with the correct Application ID URI
- Check that **Token configuration** has the `groups` claim enabled
- Verify the user has a Teams license and is in Entra ID

### Bot Not Responding

**Symptom**: Bot doesn't send notifications, or Service Bus triggers don't fire.

**Diagnosis**: Check Function App logs.

**Solutions**:
```bash
# View Prep Function App logs (works in both Bash and PowerShell)
az functionapp log tail --resource-group rg-cc-dev --name func-cc-prep-dev-<suffix>

# View Send Function App logs
az functionapp log tail --resource-group rg-cc-dev --name func-cc-send-dev-<suffix>
```

Look for:
- `Unable to connect to Service Bus` – Check Key Vault secret permissions
- `Orchestration failed` – Check SQL connection string
- `Activity 'SendMessageActivity' failed` – Check bot endpoint and managed identity Graph permissions

### "Forbidden" on API Calls

**Symptom**: API returns 403 (Forbidden).

**Diagnosis**: User is not in required security groups.

**Solutions**:
- Verify user is in `CompanyCommunicator-Authors` group to create notifications
- Verify user is in `CompanyCommunicator-Admins` group for admin actions
- Tokens can take up to 1 hour to reflect group membership; have the user sign out and back in
- Check Entra ID group membership: Azure Portal > Groups > Search group > Members

### SPA Not Loading

**Symptom**: 404 error accessing `/clientapp/`, or app loads but UI doesn't render.

**Diagnosis**: Static files not deployed or routing misconfigured.

**Solutions**:
- Verify the Web App includes the `dist` folder:
  ```bash
  az webapp list-instances --resource-group rg-cc-dev --name app-cc-dev-<suffix>
  ```
- Check app settings; verify no runtime errors preventing startup
- Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
- Check Application Insights for exceptions in the startup code

### Database Connection Failures

**Symptom**: "Cannot connect to server sql-cc-dev-<suffix>.database.windows.net" errors in logs.

**Diagnosis**: SQL Server firewall or managed identity permissions.

**Solutions**:
```bash
# These az commands work in both Bash and PowerShell

# Check SQL Server firewall rules
az sql server firewall-rule list --resource-group rg-cc-dev --server sql-cc-dev-<suffix>

# Verify managed identity has SQL login
az sql server ad-admin list --resource-group rg-cc-dev --server sql-cc-dev-<suffix>

# Check managed identity exists and has the right RBAC role
az identity show --resource-group rg-cc-dev --name id-cc-dev
```

- Ensure the App Service and Function Apps are configured to use the managed identity:
  ```bash
  az webapp identity show --resource-group rg-cc-dev --name app-cc-dev-<suffix>
  ```

### Function App Timeout

**Symptom**: "The operation timed out" errors in Service Bus processing.

**Diagnosis**: Large recipient list or slow SQL queries.

**Solutions**:
- Check SQL Database DTU/vCores:
  ```bash
  az sql db show --resource-group rg-cc-dev --server sql-cc-dev-<suffix> --name CompanyCommunicator
  ```
- If DTU is >80%, scale up the SQL tier
- Review slow query logs in Log Analytics:
  ```kusto
  AzureDiagnostics
  | where ResourceType == "DATABASES"
  | where total_time_ms > 5000
  ```

### Cannot Deploy Application

**Symptom**: GitHub Actions workflow fails during `dotnet publish` or `npm run build`.

**Diagnosis**: Build environment or dependency issue.

**Solutions**:
- Check GitHub Actions logs in the workflow run
- Verify `.csproj` files reference correct NuGet packages
- Ensure `package.json` has all required npm packages
- Run build locally to debug:
  ```bash
  dotnet build CompanyCommunicator.sln -c Release /p:TreatWarningsAsErrors=true
  cd src/CompanyCommunicator.Api/ClientApp && npm ci && npm run build
  ```
  ```powershell
  dotnet build CompanyCommunicator.sln -c Release /p:TreatWarningsAsErrors=true
  Push-Location src/CompanyCommunicator.Api/ClientApp; npm ci; npm run build; Pop-Location
  ```

### Key Vault Access Denied

**Symptom**: "Access Denied" errors when Function Apps try to read Key Vault secrets.

**Diagnosis**: Managed identity doesn't have Key Vault permissions.

**Solutions**:
**Bash:**
```bash
az keyvault set-policy \
  --name kv-cc-dev-<suffix> \
  --object-id <managed-identity-principal-id> \
  --secret-permissions get list
```

**PowerShell:**
```powershell
az keyvault set-policy `
  --name kv-cc-dev-<suffix> `
  --object-id <managed-identity-principal-id> `
  --secret-permissions get list
```

---

## Next Steps

After successful deployment:

1. **Configure alerts**: Verify that alert emails are configured and test one (see step 8.6)
2. **Set up monitoring**: Create custom dashboards in Application Insights
3. **Plan disaster recovery**: Document backup procedures and test restoration
4. **Rollout to users**: Gradually make the app available to pilot users, then organization-wide
5. **Configure auto-scaling** (optional): Set up auto-scale rules for App Service Plan if you expect variable load

For ongoing operations, see the [Operations & Monitoring Guide](operations.md).

---

## Additional Resources

- [M365 Agents SDK Documentation](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/agents-sdk-overview)
- [Azure SQL Database Serverless Tier](https://learn.microsoft.com/en-us/azure/azure-sql/database/serverless-tier-overview)
- [Azure Functions Durable Task Extension](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview)
- [Microsoft Graph API Reference](https://learn.microsoft.com/en-us/graph/api/overview)
- [Teams Developer Documentation](https://learn.microsoft.com/en-us/microsoftteams/platform/)
