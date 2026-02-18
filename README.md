# Company Communicator v2

A modern Microsoft Teams application for broadcasting targeted messages to employees.
Built as a clean-room rebuild of the original Microsoft open-source Company Communicator,
modernized to use current platform technologies and Azure best practices.

## What It Does

Company Communicator allows corporate communications teams to:

- Compose text-based messages or Adaptive Card notifications through a React web portal
- Target recipients by specific Teams channels, Microsoft 365 groups, or the entire organization
- Schedule and send messages at scale using a fan-out delivery pipeline
- Track delivery status, acknowledgments, and read receipts in real-time
- Manage the full message lifecycle from draft through sent

## Architecture

```
                          Teams Client
                              |
              +---------------+---------------+
              |                               |
        Personal Tab                    Bot Messages
        (Dashboard SPA)             (Adaptive Cards)
              |                               |
              v                               |
   +---------------------+                   |
   |  app-cc-{env}       |<------------------+
   |  ASP.NET Core 8     |
   |  - REST API         |
   |  - Bot endpoint     |   Azure SQL        Key Vault
   |  - SPA static files +----> EF Core  <--+ References
   +---------------------+   (messages,      |
              |               recipients)     |
              | Service Bus                   |
              v                               |
   +---------------------+                   |
   |  func-cc-prep-{env} |                   |
   |  Durable Functions  +-------------------+
   |  - Recipient fanout |
   |  - Orchestration    |   Azure Storage
   +---------------------+   (Durable state,
              |               blobs)
              | Service Bus
              v
   +---------------------+
   |  func-cc-send-{env} |
   |  Consumption plan   |
   |  - Message delivery |
   |  via M365 Agents SDK|
   +---------------------+

   Supporting infrastructure (all environments):
   - Azure Service Bus (3 queues: prep, send, data)
   - Azure SQL Database (EF Core 8, Entra auth)
   - Azure Key Vault (secrets, KV references)
   - Application Insights + Log Analytics
   - Managed Identity (passwordless auth to all services)
   - Azure Bot Service (bot registration)
```

### Technology Stack

| Layer | Technology |
|---|---|
| API + Bot | ASP.NET Core 8, M365 Agents SDK |
| Frontend | React 19, Vite, Fluent UI v9, TanStack Query |
| Auth | Teams SSO (getAuthToken + OBO), Managed Identity |
| Data | Azure SQL, EF Core 8, Azure Storage, Service Bus |
| Functions | Azure Functions v4 isolated worker (.NET 8) |
| Infrastructure | Bicep, Azure App Service (S1 Linux), Consumption plan |
| Graph | Microsoft Graph v5 |
| Observability | Application Insights, Log Analytics, Azure Monitor Alerts |

## Prerequisites

Before deploying or running locally, you need:

- **Azure subscription** with Contributor rights on the target resource group
- **Entra ID** (Azure AD) permissions to register applications and grant admin consent
- **.NET 8 SDK** ([download](https://dotnet.microsoft.com/download/dotnet/8))
- **Node.js 20 LTS** ([download](https://nodejs.org/en/download))
- **Azure CLI** (`az`) with Bicep extension: `az bicep install`
- **EF Core tools**: `dotnet tool install --global dotnet-ef`
- **Git**

## Quick Start – Local Development

### 1. Register the Entra ID application

```bash
# Create the single-tenant app registration
az ad app create \
  --display-name "CompanyCommunicator-v2-dev" \
  --sign-in-audience AzureADMyOrg

# Note the appId from the output – this is your BOT_APP_ID
```

Follow the M365 Agents SDK documentation to complete the bot registration
and configure the messaging endpoint to your ngrok/devtunnel URL.

### 2. Configure local secrets

```bash
# In the Api project, initialize user secrets
cd src/CompanyCommunicator.Api
dotnet user-secrets set "Bot:AppId" "<your-app-id>"
dotnet user-secrets set "Bot:AppSecret" "<your-app-secret>"
dotnet user-secrets set "ConnectionStrings:SqlConnection" "<your-local-sql-connection>"
```

Create `src/CompanyCommunicator.Functions.Prep/local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "ConnectionStrings__SqlConnection": "<your-local-sql-connection>",
    "ConnectionStrings__ServiceBusConnection": "<your-servicebus-connection>"
  }
}
```

Create a similar `local.settings.json` in `src/CompanyCommunicator.Functions.Send/`.

### 3. Apply database migrations

```bash
dotnet ef database update \
  --project src/CompanyCommunicator.Core \
  --startup-project src/CompanyCommunicator.Api
```

### 4. Run the application

```bash
# Terminal 1 – API + SPA dev server
cd src/CompanyCommunicator.Api
dotnet run

# Terminal 2 – Frontend hot-reload (optional, for faster UI iteration)
cd src/CompanyCommunicator.Api/ClientApp
npm ci
npm run dev
```

The SPA dev server proxies `/api` requests to `https://localhost:5001` (configured
in `vite.config.ts`). Access the dashboard at `http://localhost:5173/clientapp/`.

### 5. Run tests

```bash
dotnet test CompanyCommunicator.sln -c Release
```

## Deployment

All deployments use GitHub Actions with OIDC federated credentials.
No Azure client secrets are stored in GitHub.

### One-Time Setup

#### 1. Create GitHub Environments

In your repository settings, create three environments: `dev`, `stg`, `prod`.
Configure the `prod` environment with required reviewers for production gate control.

#### 2. Create Azure Resource Groups

```bash
az group create --name rg-cc-dev  --location eastus2
az group create --name rg-cc-stg  --location eastus2
az group create --name rg-cc-prod --location eastus2
```

#### 3. Configure OIDC federation (per environment)

```bash
# Example for dev – repeat for stg and prod
APP_ID=$(az ad app create --display-name "gh-cc-deploy-dev" --query appId -o tsv)
az ad sp create --id $APP_ID

az role assignment create \
  --assignee $APP_ID \
  --role Contributor \
  --scope /subscriptions/<subscription-id>/resourceGroups/rg-cc-dev

az ad app federated-credential create --id $APP_ID --parameters '{
  "name": "gh-dev",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<org>/<repo>:environment:dev",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

#### 4. Set environment secrets

For each GitHub environment (`dev`, `stg`, `prod`), add these secrets:

| Secret | Description |
|---|---|
| `AZURE_CLIENT_ID` | App registration client ID from step 3 |
| `AZURE_TENANT_ID` | Your Entra ID tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_RESOURCE_GROUP` | e.g. `rg-cc-dev` |
| `SQL_ADMIN_OBJECT_ID` | Object ID of the principal to set as SQL admin |
| `ALERT_EMAIL` | Email for operational alert notifications |
| `BOT_APP_ID` | Entra ID app (client) ID of the bot registration |
| `SQL_CONNECTION_STRING` | ADO.NET connection string for EF migration runner |
| `BOT_APP_SECRET` | App secret for the bot app registration (stored in Key Vault) |

### Deploying Infrastructure

The infrastructure workflow deploys all Azure resources via Bicep.
Run it once per environment before the first application deployment,
and again whenever `infra/**` changes.

**Via GitHub UI:** Actions > Deploy Infrastructure > Run workflow > select environment

**Automatically:** Triggered on push to `main` when `infra/**` files change (deploys to `dev`).

The workflow runs a what-if analysis first, then deploys. Check the job summary
for the what-if output before the deploy step executes.

### Deploying the Application

The application workflow builds all components and deploys them to Azure.

**Via GitHub UI:** Actions > Deploy Application > Run workflow > select environment

**Automatically:** Triggered when the CI workflow completes successfully on `main` (deploys to `dev`).

The deployment sequence:
1. Build and publish Web App (includes SPA build)
2. Build and publish Prep Function App
3. Build and publish Send Function App
4. Deploy Web App via `azure/webapps-deploy`
5. Deploy Prep Function via `Azure/functions-action`
6. Deploy Send Function via `Azure/functions-action`
7. Run EF Core database migrations
8. Health check against `/health/ready`

### CI Checks

The CI workflow runs on every push to `main` and every pull request:

- .NET build (Release configuration, warnings as errors)
- All unit tests with TRX results uploaded as artifacts
- NuGet vulnerability scan (fails on any vulnerable package)
- npm audit (fails on high/critical severity)
- Frontend production build verification

## Teams Manifest

### Packaging

Use the **Package Teams Manifest** workflow:

**Via GitHub UI:** Actions > Package Teams Manifest > Run workflow

Inputs:
- `environment`: `dev`, `stg`, or `prod`
- `web_app_hostname`: FQDN of your deployed web app (e.g. `app-cc-dev.azurewebsites.net`)

The workflow substitutes `{{BOT_APP_ID}}` and `{{WEB_APP_HOSTNAME}}` tokens,
validates the JSON, and produces `teams-manifest-{env}.zip` as a workflow artifact.

### Icons

The `Manifest/` directory contains placeholder icons generated by `generate-icons.ps1`.
Replace `color.png` (192x192) and `outline.png` (32x32) with your organization's
branding before publishing to the Teams app catalog.

Teams icon requirements:
- `color.png`: 192x192 pixels, full color, PNG
- `outline.png`: 32x32 pixels, white + transparent, PNG

### Sideloading for Testing

1. Download the `manifest-{env}.zip` artifact from the Package Teams Manifest workflow
2. In Teams: Apps > Manage your apps > Upload an app > Upload a custom app
3. Select the downloaded zip file

### Publishing to App Catalog

1. In Teams Admin Center: Teams apps > Manage apps > Upload
2. Upload the manifest zip for the `prod` environment
3. Set app visibility and permissions as appropriate for your organization

## Project Structure

```
CompanyCommunicator.sln
.github/
  workflows/
    ci.yml                    # Continuous integration
    deploy-infra.yml          # Bicep infrastructure deployment
    deploy-app.yml            # Application deployment
    package-manifest.yml      # Teams manifest packaging
  dependabot.yml              # Automated dependency updates
src/
  CompanyCommunicator.Api/    # ASP.NET Core 8 (REST API + Bot + SPA host)
    ClientApp/                # React 19 + Vite SPA
  CompanyCommunicator.Core/   # Shared library (EF Core, Graph, services)
  CompanyCommunicator.Functions.Prep/  # Durable Functions (prep + fanout)
  CompanyCommunicator.Functions.Send/  # Send Function (Service Bus trigger)
tests/
  CompanyCommunicator.Core.Tests/
  CompanyCommunicator.Api.Tests/
  CompanyCommunicator.Functions.Tests/
infra/
  main.bicep                  # Infrastructure orchestrator
  main.bicepparam             # Parameter defaults
  modules/                    # 12 Bicep modules (one per Azure resource type)
Manifest/
  manifest.json               # Teams app manifest (with {{TOKEN}} placeholders)
  color.png                   # 192x192 app icon (replace with real branding)
  outline.png                 # 32x32 outline icon (replace with real branding)
  generate-icons.ps1          # Script to regenerate placeholder icons
```

## Contributing

1. Create a feature branch from `main`
2. Make changes and ensure `dotnet test` and `npm run build` pass locally
3. Open a pull request – CI runs automatically
4. Merge after CI passes and code review is complete
5. The deploy-app workflow automatically deploys to `dev` on merge to `main`
