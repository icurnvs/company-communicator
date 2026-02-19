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

### 3.2 Create Deployment Service Principal

Create a service principal for each environment to own the OIDC credential and deploy resources:

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

Save the `appId` (application ID) from the output; you'll need it in step 3.3.

### 3.3 Add OIDC Federated Credentials

For each environment, create an OIDC federated credential on the deployment service principal so GitHub Actions can authenticate without storing secrets.

**Per-environment setup (repeat for dev, stg, prod):**

1. In Azure Portal, go to the **gh-cc-deploy-dev** app registration (or the corresponding stg/prod deployment SP) > **Certificates & secrets**.

2. Click **Federated credentials > Add credential**:
   - **Federated credential scenario**: GitHub Actions deploying Azure resources
   - **Organization**: Your GitHub username or organization name
   - **Repository**: Your repository name (e.g., `company-communicator`)
   - **Entity type**: Environment
   - **Environment name**: `dev` (or `stg`, `prod`)
   - **Name**: `gh-cc-deploy-dev` (or `gh-cc-deploy-stg`, `gh-cc-deploy-prod`)
   - Click **Add**

Verify it was created; you should see a credential with subject like: `repo:{owner}/{repo}:environment:dev` (where `{owner}` is your GitHub username or organization name — an organization is not required)

### 3.4 Configure Environment Secrets

For each GitHub environment (`dev`, `stg`, `prod`), set these secrets:

| Secret | Value | How to Get |
|--------|-------|-----------|
| `AZURE_CLIENT_ID` | Deployment service principal client ID from step 3.2 | Azure Portal > Entra ID > App registrations > gh-cc-deploy-dev > Client ID |
| `AZURE_TENANT_ID` | Entra ID tenant ID | Azure Portal > Entra ID > Overview > Tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Your Azure subscription ID | Azure Portal > Subscriptions > Subscription ID |
| `AZURE_RESOURCE_GROUP` | Resource group name (e.g., `rg-cc-dev`) | Azure Portal > Resource groups |
| `ALERT_EMAIL` | Email for alert notifications | Your team's ops email |
| `BOT_APP_ID` | App registration client ID from step 1 | Azure Portal > App registration > Client ID |
| `AUTHOR_GROUP_ID` | Object ID of the Entra ID group for Authors | `az ad group show --group "CC-Authors" --query id -o tsv` |
| `ADMIN_GROUP_ID` | Object ID of the Entra ID group for Admins | `az ad group show --group "CC-Admins" --query id -o tsv` |
| `SQL_CONNECTION_STRING` | ADO.NET connection string for EF migrations | Set after infra deploy; see step 4.7.3 |
| `BOT_APP_SECRET` | Client secret from step 1.5 | Copy from Entra ID (create new if lost); see step 4.7.4 |

Add these via GitHub UI: **Settings > Environments > [environment] > Environment secrets > Add Secret**

> `AUTHOR_GROUP_ID` and `ADMIN_GROUP_ID` can point to the same group if you want all admins to also be authors.

**Minimal starter set** (without SQL connection string and bot secret):

```bash
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_RESOURCE_GROUP=rg-cc-dev
ALERT_EMAIL=ops-team@contoso.com
BOT_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AUTHOR_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

You'll add `SQL_CONNECTION_STRING` and `BOT_APP_SECRET` after infrastructure deployment (see steps 4.6.3 and 4.6.4).

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

### 4.6 Grant Microsoft Graph Permissions to the Managed Identity

The backend uses the managed identity (via `DefaultAzureCredential`) to call Microsoft Graph for user sync, group search, and team member lookups. The MI's service principal needs application-level Graph permissions.

> **Note:** This is separate from the bot app registration permissions (step 1.2). The bot app registration is used for Teams SSO/OBO flows, while the managed identity handles server-to-server Graph API calls.

1. Get the managed identity's principal ID:

**Bash:**
```bash
MI_PRINCIPAL_ID=$(az identity show \
  --resource-group rg-cc-dev \
  --name id-cc-dev \
  --query principalId -o tsv)

GRAPH_SP_ID=$(az ad sp show --id 00000003-0000-0000-c000-000000000000 --query id -o tsv)
```

**PowerShell:**
```powershell
$MI_PRINCIPAL_ID = az identity show `
  --resource-group rg-cc-dev `
  --name id-cc-dev `
  --query principalId -o tsv

$GRAPH_SP_ID = az ad sp show --id 00000003-0000-0000-c000-000000000000 --query id -o tsv
```

2. Grant the required application permissions:

| Permission | Type | Role ID | Purpose |
|---|---|---|---|
| `User.Read.All` | Application | `df021288-bdef-4463-88db-98f22de89214` | User sync, delta queries, profile photos |
| `Group.Read.All` | Application | `5b567255-7703-4780-807c-7be8301ae99b` | Search groups |
| `GroupMember.Read.All` | Application | `98830695-27a2-44f7-8c18-0c3ebc9698f6` | Read group members for recipient resolution |
| `Directory.Read.All` | Application | `7ab1d382-f21e-4acd-a863-ba3e13f7da61` | Broad directory reads, delta query support |
| `TeamMember.Read.All` | Application | `660b7406-55f1-41ca-a0ed-0b035e182f3e` | Read team membership for recipient resolution |
| `TeamsActivity.Send` | Application | `a267235f-af13-44dc-8385-c1dc93023186` | Send activity feed notifications |
| `TeamsAppInstallation.ReadWriteForUser.All` | Application | `74ef0291-ca83-4d02-8c7e-d2391e6a444f` | Proactively install bot in user's personal scope |
| `TeamsAppInstallation.ReadWriteForTeam.All` | Application | `5dad17ba-f6cc-4954-a5a2-a0dcc95154f0` | Proactively install bot in team scope |

**Bash:**
```bash
# User.Read.All
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --headers "Content-Type=application/json" \
  --body "{\"principalId\":\"${MI_PRINCIPAL_ID}\",\"resourceId\":\"${GRAPH_SP_ID}\",\"appRoleId\":\"df021288-bdef-4463-88db-98f22de89214\"}"

# Group.Read.All
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --headers "Content-Type=application/json" \
  --body "{\"principalId\":\"${MI_PRINCIPAL_ID}\",\"resourceId\":\"${GRAPH_SP_ID}\",\"appRoleId\":\"5b567255-7703-4780-807c-7be8301ae99b\"}"

# GroupMember.Read.All
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --headers "Content-Type=application/json" \
  --body "{\"principalId\":\"${MI_PRINCIPAL_ID}\",\"resourceId\":\"${GRAPH_SP_ID}\",\"appRoleId\":\"98830695-27a2-44f7-8c18-0c3ebc9698f6\"}"

# Directory.Read.All
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --headers "Content-Type=application/json" \
  --body "{\"principalId\":\"${MI_PRINCIPAL_ID}\",\"resourceId\":\"${GRAPH_SP_ID}\",\"appRoleId\":\"7ab1d382-f21e-4acd-a863-ba3e13f7da61\"}"

# TeamMember.Read.All
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --headers "Content-Type=application/json" \
  --body "{\"principalId\":\"${MI_PRINCIPAL_ID}\",\"resourceId\":\"${GRAPH_SP_ID}\",\"appRoleId\":\"660b7406-55f1-41ca-a0ed-0b035e182f3e\"}"

# TeamsActivity.Send
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --headers "Content-Type=application/json" \
  --body "{\"principalId\":\"${MI_PRINCIPAL_ID}\",\"resourceId\":\"${GRAPH_SP_ID}\",\"appRoleId\":\"a267235f-af13-44dc-8385-c1dc93023186\"}"

# TeamsAppInstallation.ReadWriteForUser.All
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --headers "Content-Type=application/json" \
  --body "{\"principalId\":\"${MI_PRINCIPAL_ID}\",\"resourceId\":\"${GRAPH_SP_ID}\",\"appRoleId\":\"74ef0291-ca83-4d02-8c7e-d2391e6a444f\"}"

# TeamsAppInstallation.ReadWriteForTeam.All
az rest --method POST \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --headers "Content-Type=application/json" \
  --body "{\"principalId\":\"${MI_PRINCIPAL_ID}\",\"resourceId\":\"${GRAPH_SP_ID}\",\"appRoleId\":\"5dad17ba-f6cc-4954-a5a2-a0dcc95154f0\"}"
```

**PowerShell:**
```powershell
# User.Read.All
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI_PRINCIPAL_ID/appRoleAssignments" `
  --headers "Content-Type=application/json" `
  --body "{`"principalId`":`"$MI_PRINCIPAL_ID`",`"resourceId`":`"$GRAPH_SP_ID`",`"appRoleId`":`"df021288-bdef-4463-88db-98f22de89214`"}"

# Group.Read.All
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI_PRINCIPAL_ID/appRoleAssignments" `
  --headers "Content-Type=application/json" `
  --body "{`"principalId`":`"$MI_PRINCIPAL_ID`",`"resourceId`":`"$GRAPH_SP_ID`",`"appRoleId`":`"5b567255-7703-4780-807c-7be8301ae99b`"}"

# GroupMember.Read.All
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI_PRINCIPAL_ID/appRoleAssignments" `
  --headers "Content-Type=application/json" `
  --body "{`"principalId`":`"$MI_PRINCIPAL_ID`",`"resourceId`":`"$GRAPH_SP_ID`",`"appRoleId`":`"98830695-27a2-44f7-8c18-0c3ebc9698f6`"}"

# Directory.Read.All
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI_PRINCIPAL_ID/appRoleAssignments" `
  --headers "Content-Type=application/json" `
  --body "{`"principalId`":`"$MI_PRINCIPAL_ID`",`"resourceId`":`"$GRAPH_SP_ID`",`"appRoleId`":`"7ab1d382-f21e-4acd-a863-ba3e13f7da61`"}"

# TeamMember.Read.All
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI_PRINCIPAL_ID/appRoleAssignments" `
  --headers "Content-Type=application/json" `
  --body "{`"principalId`":`"$MI_PRINCIPAL_ID`",`"resourceId`":`"$GRAPH_SP_ID`",`"appRoleId`":`"660b7406-55f1-41ca-a0ed-0b035e182f3e`"}"

# TeamsActivity.Send
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI_PRINCIPAL_ID/appRoleAssignments" `
  --headers "Content-Type=application/json" `
  --body "{`"principalId`":`"$MI_PRINCIPAL_ID`",`"resourceId`":`"$GRAPH_SP_ID`",`"appRoleId`":`"a267235f-af13-44dc-8385-c1dc93023186`"}"

# TeamsAppInstallation.ReadWriteForUser.All
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI_PRINCIPAL_ID/appRoleAssignments" `
  --headers "Content-Type=application/json" `
  --body "{`"principalId`":`"$MI_PRINCIPAL_ID`",`"resourceId`":`"$GRAPH_SP_ID`",`"appRoleId`":`"74ef0291-ca83-4d02-8c7e-d2391e6a444f`"}"

# TeamsAppInstallation.ReadWriteForTeam.All
az rest --method POST `
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$MI_PRINCIPAL_ID/appRoleAssignments" `
  --headers "Content-Type=application/json" `
  --body "{`"principalId`":`"$MI_PRINCIPAL_ID`",`"resourceId`":`"$GRAPH_SP_ID`",`"appRoleId`":`"5dad17ba-f6cc-4954-a5a2-a0dcc95154f0`"}"
```

3. Verify the assignments:

```bash
az rest --method GET \
  --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
  --query "value[].appRoleId" -o tsv
```

> **Important:** After granting permissions, restart the web app (`az webapp stop` / `az webapp start`) so the managed identity acquires a fresh token with the new roles.

### 4.7 Configure SQL Access for GitHub Actions

The deploy workflow runs EF Core migrations against Azure SQL. Since the SQL Server uses Entra ID-only authentication (no SQL passwords), the GitHub Actions deployment service principal needs database access.

#### 4.7.1 Open SQL Server Firewall for GitHub Actions

GitHub Actions runners connect from outside Azure. Add a temporary firewall rule:

**Bash:**
```bash
SQL_SERVER_NAME=$(az sql server list --resource-group rg-cc-dev \
  --query "[?starts_with(name, 'sql-cc-dev')].name" -o tsv)

az sql server firewall-rule create \
  --resource-group rg-cc-dev \
  --server "$SQL_SERVER_NAME" \
  --name AllowGitHubActions \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 255.255.255.255
```

**PowerShell:**
```powershell
$SQL_SERVER_NAME = az sql server list --resource-group rg-cc-dev `
  --query "[?starts_with(name, 'sql-cc-dev')].name" -o tsv

az sql server firewall-rule create `
  --resource-group rg-cc-dev `
  --server $SQL_SERVER_NAME `
  --name AllowGitHubActions `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 255.255.255.255
```

> **Security note:** This allows connections from any IP. After initial deployment you can tighten this to [GitHub's published IP ranges](https://api.github.com/meta) or remove it entirely if you run migrations locally.

#### 4.7.2 Grant the Deployment Service Principal Database Access

Connect to the Azure SQL database as the Entra ID admin (the managed identity `id-cc-<env>` is automatically set as SQL admin by Bicep) and create a database user for the GitHub Actions service principal.

You can connect using Azure Data Studio, SSMS, or the Azure Portal Query Editor:

1. In Azure Portal, go to **SQL databases** > `db-cc-dev` > **Query editor (preview)**.
2. Sign in with your Entra ID account (you'll need to be a member of the SQL admin group or use a tool that can authenticate as the managed identity).
3. Run the following SQL:

```sql
-- Create a user for the GitHub Actions deployment service principal.
-- The name MUST match the display name of the app registration from step 3.2.
CREATE USER [gh-cc-deploy-dev] FROM EXTERNAL PROVIDER;

-- Grant DDL permissions for running EF Core migrations
ALTER ROLE db_ddladmin ADD MEMBER [gh-cc-deploy-dev];

-- Grant read/write for migration seed data
ALTER ROLE db_datareader ADD MEMBER [gh-cc-deploy-dev];
ALTER ROLE db_datawriter ADD MEMBER [gh-cc-deploy-dev];
```

Repeat for `stg` and `prod` environments with the corresponding service principal names.

#### 4.7.3 Set the SQL_CONNECTION_STRING GitHub Secret

Get the SQL server FQDN:

**Bash:**
```bash
az sql server list --resource-group rg-cc-dev \
  --query "[?starts_with(name, 'sql-cc-dev')].fullyQualifiedDomainName" -o tsv
```

**PowerShell:**
```powershell
az sql server list --resource-group rg-cc-dev `
  --query "[?starts_with(name, 'sql-cc-dev')].fullyQualifiedDomainName" -o tsv
```

Add `SQL_CONNECTION_STRING` to **Settings > Environments > dev > Environment secrets** with this value:

```
Server=tcp:<server-fqdn>,1433;Initial Catalog=db-cc-dev;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Default;
```

Replace `<server-fqdn>` with the output from above (e.g., `sql-cc-dev-a1b2c.database.windows.net`).

> **How this works:** The GitHub Actions workflow authenticates via `azure/login@v2` (OIDC). The `Active Directory Default` authentication mode in the connection string picks up that credential, so the deployment service principal's database user (created in 4.6.2) is used to run migrations.
>
> **Note:** This connection string uses `Active Directory Default`, which is correct for migrations run by a human or CI service principal. The deployed application uses a different auth mode — `Active Directory Managed Identity` with an explicit `User Id` — because `Microsoft.Data.SqlClient` does not read the `AZURE_CLIENT_ID` environment variable. The deployed connection string is generated by Bicep and stored in Key Vault automatically.

#### 4.7.4 Set the BOT_APP_SECRET GitHub Secret

Add `BOT_APP_SECRET` to the same environment with the client secret you created in step 1.5.

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
# Set the connection string (replace with your actual value from step 4.7.3)
export ConnectionStrings__SqlConnection="Server=tcp:<server-fqdn>,1433;Initial Catalog=db-cc-dev;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Default;"

dotnet ef database update \
  --project src/CompanyCommunicator.Core/CompanyCommunicator.Core.csproj \
  --startup-project src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj \
  --connection "$ConnectionStrings__SqlConnection"
```

**PowerShell:**
```powershell
# Set the connection string (replace with your actual value from step 4.7.3)
$env:ConnectionStrings__SqlConnection = "Server=tcp:<server-fqdn>,1433;Initial Catalog=db-cc-dev;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Default;"

dotnet ef database update `
  --project src/CompanyCommunicator.Core/CompanyCommunicator.Core.csproj `
  --startup-project src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj `
  --connection "$env:ConnectionStrings__SqlConnection"
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

### 6.2 Verify Connection String in Key Vault

The deployed application's SQL connection string is stored in Key Vault and uses `Active Directory Managed Identity` authentication with an explicit `User Id` parameter:

```
Server=tcp:<server-fqdn>,1433;Initial Catalog=db-cc-<env>;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Managed Identity;User Id=<MI-client-id>;
```

This is generated automatically by Bicep. The `User Id` is the managed identity's **client ID** (not the principal/object ID).

> **Why `Active Directory Managed Identity` instead of `Active Directory Default`?**
> `Microsoft.Data.SqlClient` has its own credential chain for `Active Directory Default` that does **not** read the `AZURE_CLIENT_ID` environment variable. On Linux App Service with a user-assigned managed identity, SqlClient cannot determine which identity to use and fails with `Connection reset by peer` during `SendFedAuthToken`. Using `Active Directory Managed Identity` with an explicit `User Id` bypasses this issue entirely.

To verify the current secret value:
```bash
az keyvault secret show --vault-name kv-cc-dev-<suffix> --name SqlConnectionString --query value -o tsv
```

### 6.3 Verify Database Schema

Connect to the database and verify tables were created.

> **Note:** `az sql db query` has been removed from Azure CLI. Use one of the options below.

**Option A — Azure Portal (easiest, no tools required)**
1. Go to [portal.azure.com](https://portal.azure.com) → your SQL database `db-cc-dev`
2. Left menu → **Query editor (preview)**
3. Authenticate and run:
   ```sql
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'
   ```

**Option B — sqlcmd (install once, reuse)**

Install if not present:
```powershell
winget install Microsoft.SqlServer.CmdLineUtils
```

Then query:
```powershell
$SQL_SERVER = az sql server show --resource-group rg-cc-dev --name sql-cc-dev-<suffix> --query fullyQualifiedDomainName -o tsv
sqlcmd -S $SQL_SERVER -d db-cc-dev -U sqladmin -P "<your-password>" `
  -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo'"
```

You should see tables:
- `Notifications`
- `NotificationAudiences`
- `SentNotifications`
- `Users`
- `Teams`
- `ThrottleState`
- `ExportJobs`
- `AppConfiguration`

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

6. **Copy the Teams App Catalog ID** — click on the app name in the list. The URL will contain the catalog ID (a GUID), e.g.:
   ```
   https://admin.teams.microsoft.com/policies/manage-apps/<catalog-id>
   ```
   You can also retrieve it via Graph API:
   ```bash
   az rest --method GET \
     --uri "https://graph.microsoft.com/v1.0/appCatalog/teamsApps?\$filter=externalId eq '<your-bot-app-id>'" \
     --query "value[0].id" -o tsv
   ```

7. Pass this catalog ID as `teamsAppCatalogId` when running the infra deployment:
   ```bash
   az deployment group create \
     --resource-group rg-cc-<env> \
     --template-file infra/main.bicep \
     --parameters ... teamsAppCatalogId=<catalog-id-from-step-6>
   ```
   Or set it directly on the Prep Function App if already deployed:
   ```bash
   az functionapp config appsettings set \
     --resource-group rg-cc-<env> \
     --name func-cc-prep-<env>-<suffix> \
     --settings "Bot__TeamsAppId=<catalog-id-from-step-6>"
   ```

> **Note:** If you skip this step, `Bot__TeamsAppId` defaults to empty and proactive installation is disabled. Messages are only delivered to recipients who already have an open conversation with the bot. Proactive installation can be enabled at any time by completing this step and redeploying infra.

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

1. Azure Portal > App Insights > `appi-cc-dev`.

2. Go to **Live Metrics** (real-time events) or **Requests** (last 24 hours).

3. You should see API requests, function invocations, and exceptions (if any).

### 8.5 Check Log Analytics

Verify diagnostic logs are flowing:

1. Azure Portal > Log Analytics > `law-cc-dev`.

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

## Scaling Guidance

Company Communicator scales to handle large-scale broadcasts. Choose your App Service plan based on the maximum notification recipient size:

| Notification size | Recommended plan | Reason |
|---|---|---|
| Up to 5,000 users | S1 (1 vCore) | Default |
| 5,000 – 10,000 users | S2 (2 vCores) | Doubles callback throughput |
| 10,000 – 50,000 users | P1v2 or S3 | Required for burst handling |

**Key scaling components**:
- **App Service Plan (S1 by default)**: Hosts the Web App and Prep Function. Scale up to handle concurrent orchestration callbacks during large broadcasts.
- **Send Function (Windows Consumption)**: Automatically scales to 200+ instances. No configuration needed — it scales independently based on Service Bus queue depth.
- **Azure SQL (Serverless, Gen5 2vCore)**: For 10k+ recipients, scale up to 4-6 vCores to handle aggregation queries and SentNotification inserts.
- **Service Bus (Standard tier)**: Handles all queue traffic. Standard tier supports up to 1000 messages/sec; rarely needs scaling.

To scale the App Service Plan:

```bash
az appservice plan update --resource-group rg-cc-dev \
  --name "plan-cc-dev-<suffix>" \
  --sku S2
```

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

**Diagnosis**: Check Function App logs and Key Vault reference resolution.

**Solutions**:
```bash
# View Prep Function App logs (works in both Bash and PowerShell)
az functionapp log tail --resource-group rg-cc-dev --name func-cc-prep-dev-<suffix>

# View Send Function App logs
az functionapp log tail --resource-group rg-cc-dev --name func-cc-send-dev-<suffix>

# Check if messages are stuck in the prepare queue
az servicebus queue list --resource-group rg-cc-dev \
  --namespace-name sb-cc-dev-<suffix> \
  --query "[].{name:name, active:countDetails.activeMessageCount, deadLetter:countDetails.deadLetterMessageCount}" -o table
```

Look for:
- **Messages accumulating in `cc-prepare` queue** – The Prep Function isn't processing. Check that `keyVaultReferenceIdentity` is set to the MI's resource ID (not `SystemAssigned`):
  ```bash
  az rest --method get \
    --url "/subscriptions/<sub-id>/resourceGroups/rg-cc-dev/providers/Microsoft.Web/sites/func-cc-prep-dev-<suffix>?api-version=2023-12-01" \
    --query "properties.keyVaultReferenceIdentity" -o tsv
  ```
  If it shows `SystemAssigned`, fix with:
  ```bash
  MI_ID=$(az identity show --resource-group rg-cc-dev --name id-cc-dev --query id -o tsv)
  az rest --method patch \
    --url "/subscriptions/<sub-id>/resourceGroups/rg-cc-dev/providers/Microsoft.Web/sites/func-cc-prep-dev-<suffix>?api-version=2023-12-01" \
    --body "{\"properties\":{\"keyVaultReferenceIdentity\":\"${MI_ID}\"}}"
  ```
- **Service Bus trigger listener starts but never receives messages** – The trigger needs explicit `ServiceBus__clientId` set to the MI's client ID. Without it, the extension cannot authenticate with user-assigned MI:
  ```bash
  az functionapp config appsettings set --resource-group rg-cc-dev \
    --name func-cc-prep-dev-<suffix> \
    --settings "ServiceBus__clientId=<managed-identity-client-id>"
  ```
- `Unable to connect to Service Bus` – Check Key Vault secret permissions and that `ServiceBus__FullyQualifiedNamespace` app setting is configured
- `Orchestration failed` – Check SQL connection string (see [SendFedAuthToken troubleshooting](#sql-connection-reset-by-peer-during-sendfedauthtoken) above)
- `Activity 'SendMessageActivity' failed` – Check bot endpoint and managed identity Graph permissions

### Orchestration Fails with "Insufficient privileges"

**Symptom**: PrepareToSendOrchestrator fails at the SyncRecipients step. App Insights shows `Insufficient privileges to complete the operation` from SyncAllUsersActivity or SyncGroupMembersActivity.

**Diagnosis**: The managed identity cannot acquire a Graph token with the correct permissions. This is typically caused by `DefaultAzureCredential` not targeting the user-assigned MI, even when `AZURE_CLIENT_ID` is set.

**Solutions**:
1. Verify all 8 Graph permissions are granted to the MI (not the bot app registration):
   ```bash
   MI_PRINCIPAL_ID=$(az identity show --resource-group rg-cc-dev --name id-cc-dev --query principalId -o tsv)
   az rest --method GET \
     --uri "https://graph.microsoft.com/v1.0/servicePrincipals/${MI_PRINCIPAL_ID}/appRoleAssignments" \
     --query "value[].appRoleId" -o tsv
   ```
   Expected role IDs: `df021288` (User.Read.All), `5b567255` (Group.Read.All), `98830695` (GroupMember.Read.All), `7ab1d382` (Directory.Read.All), `660b7406` (TeamMember.Read.All), `a267235f` (TeamsActivity.Send), `74ef0291` (TeamsAppInstallation.ReadWriteForUser.All), `5dad17ba` (TeamsAppInstallation.ReadWriteForTeam.All).

2. Verify the code uses explicit `ManagedIdentityClientId`:
   All three apps (API, Prep Function, Send Function) must create `DefaultAzureCredential` with `ManagedIdentityClientId = config["AZURE_CLIENT_ID"]`. Using bare `new DefaultAzureCredential()` may not reliably target the user-assigned MI for Graph token acquisition.

3. After fixing, restart all compute resources and resubmit the notification.

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

### SQL "Connection reset by peer" during SendFedAuthToken

**Symptom**: `SocketException (104): Connection reset by peer` at `SendFedAuthToken` in logs. The TCP connection to SQL succeeds but drops during the Entra ID token exchange.

**Diagnosis**: The SQL connection string is using `Authentication=Active Directory Default` instead of `Active Directory Managed Identity` with an explicit `User Id`. `Microsoft.Data.SqlClient` does not read the `AZURE_CLIENT_ID` environment variable — it has its own credential chain. Without `User Id` in the connection string, SqlClient calls IMDS without specifying which user-assigned managed identity to use, causing a consistent authentication failure.

**Solution**: Update the Key Vault secret with the correct connection string:
```bash
# Get the MI client ID
MI_CLIENT_ID=$(az identity show --resource-group rg-cc-dev --name id-cc-dev --query clientId -o tsv)

# Update the connection string in Key Vault
az keyvault secret set \
  --vault-name kv-cc-dev-<suffix> \
  --name SqlConnectionString \
  --value "Server=tcp:sql-cc-dev-<suffix>.database.windows.net,1433;Initial Catalog=db-cc-dev;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Managed Identity;User Id=${MI_CLIENT_ID};"

# Restart the app to pick up the new secret
az webapp restart --resource-group rg-cc-dev --name app-cc-dev-<suffix>
```

> **Note:** The Bicep templates generate the correct connection string automatically. This manual fix is only needed if a deployment used an older version of the templates.

### Function App Configuration

Both the Prep and Send Function Apps require specific app settings to operate correctly.

#### Prep Function App Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `Bot__TeamsAppId` | Teams app catalog ID from Teams Admin Center (see Step 7.3) | Enables proactive app installation before message delivery. **This is the catalog GUID assigned by Teams Admin Center, NOT the Entra app client ID.** Leave empty to disable proactive install. |
| `Bot__InstallWaitSeconds` | `60` (default) | Seconds between install waves and ConversationId refresh |
| `Bot__MaxRefreshAttempts` | `20` (default) | Maximum polling cycles for ConversationId refresh |

The Bicep templates configure these automatically. If you need to update them manually:

```bash
az functionapp config appsettings set --resource-group rg-cc-dev \
  --name func-cc-prep-dev-<suffix> \
  --settings "Bot__TeamsAppId=<teams-app-catalog-id>" "Bot__InstallWaitSeconds=60" "Bot__MaxRefreshAttempts=20"
```

#### Send Function: "Bot:AppId is not configured"

**Symptom**: `SendMessageFunction` fails instantly (4-10ms) with `InvalidOperationException: Bot:AppId is not configured.` Messages exhaust delivery count and move to the dead-letter queue.

**Diagnosis**: The Send Function's `SendFunctionMessageSender` requires `Bot:AppId` in configuration to authenticate against the Bot Framework REST API. This setting (`Bot__AppId` in app settings) is missing.

**Solution**:
```bash
az functionapp config appsettings set --resource-group rg-cc-dev \
  --name func-cc-send-dev-<suffix> \
  --settings "Bot__AppId=<bot-app-registration-client-id>"
```

> **Note:** The Bicep templates (since commit `b461de7`) include this setting automatically. This manual fix is only needed for deployments before that commit.

### Send Function Not Processing Queue Messages

**Symptom**: Messages accumulate in `cc-send` queue but the Send Function shows no traces in App Insights. The function app state shows "Running".

**Diagnosis**: The Consumption plan scale controller may not wake the function when using identity-based Service Bus connections. This is an intermittent behavior with Windows Consumption plans.

**Solution**: Force a cold start by pinging the function app:
```bash
curl -s -o /dev/null -w "%{http_code}" "https://func-cc-send-dev-<suffix>.azurewebsites.net/"
```
The function should start processing within 30 seconds after the ping. If this happens frequently, consider switching to an Elastic Premium (EP1) plan.

### Function App Timeout

**Symptom**: "The operation timed out" errors in Service Bus processing.

**Diagnosis**: Large recipient list or slow SQL queries.

**Solutions**:
- Check SQL Database DTU/vCores:
  ```bash
  az sql db show --resource-group rg-cc-dev --server sql-cc-dev-<suffix> --name db-cc-dev
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
