# Company Communicator v2 - Local Development Guide

This guide explains how to run Company Communicator v2 locally for development. You'll run the backend API, frontend SPA, Azure Functions, and use local or Azure resources for data and messaging.

**Estimated time**: 30 minutes to initial run, 1-2 hours for full local Azure integration.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Clone and Build](#clone-and-build)
3. [Local Database Setup](#local-database-setup)
4. [User Secrets Configuration](#user-secrets-configuration)
5. [Azure Resources for Local Dev](#azure-resources-for-local-dev)
6. [Running the API](#running-the-api)
7. [Running the Frontend](#running-the-frontend)
8. [Running Azure Functions Locally](#running-azure-functions-locally)
9. [Testing with Teams Emulator](#testing-with-teams-emulator)
10. [Running Tests](#running-tests)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Ensure you have these installed:

- **.NET 8 SDK**: [Download](https://dotnet.microsoft.com/download/dotnet/8)
- **Node.js 20 LTS**: [Download](https://nodejs.org)
- **Azure Functions Core Tools v4**: [Installation guide](https://learn.microsoft.com/en-us/azure/azure-functions/functions-run-local)
- **EF Core tools**:
  ```bash
  dotnet tool install --global dotnet-ef
  ```
- **Git**: [Download](https://git-scm.com)
- **Visual Studio Code** or **Visual Studio 2022** (recommended)
- **SQL Server LocalDB** or **Docker** (see section 3)

Verify installation:

```bash
dotnet --version          # Should be 8.x.x
node --version            # Should be 20.x.x or later
npm --version
func --version            # Should be 4.x.x
dotnet-ef --version       # Should be 8.x.x
git --version
```

---

## Clone and Build

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/CompanyCommunicator.git
cd CompanyCommunicator
```

### 2. Restore NuGet Packages

```bash
dotnet restore CompanyCommunicator.sln
```

### 3. Build the Solution

```bash
dotnet build CompanyCommunicator.sln -c Debug
```

You should see "Build succeeded" without errors.

### 4. Build the Frontend (Optional for Initial Run)

```bash
cd src/CompanyCommunicator.Api/ClientApp
npm ci
npm run build
cd ../../..
```

This is optional initially; Vite will serve the frontend in dev mode. Skip this if you want to iterate faster on the UI.

---

## Local Database Setup

### Option A: SQL Server LocalDB (Windows Only)

If you're on Windows, SQL Server LocalDB is the simplest option.

#### 1. Verify LocalDB Installation

```bash
SqlLocalDB instances
```

You should see a list of instances (possibly including `MSSQLLocalDB` or `ProjectsV13`).

#### 2. Create a Database

```bash
sqlcmd -S "(localdb)\mssqlocaldb" -Q "CREATE DATABASE CompanyCommunicator;"
```

#### 3. Create a Connection String

```
Server=(localdb)\mssqlocaldb;Database=CompanyCommunicator;Trusted_Connection=true;Encrypt=false;
```

### Option B: Docker SQL Server (Cross-Platform)

If you're on Mac, Linux, or prefer Docker:

#### 1. Start a SQL Server Container

```bash
docker run -e 'ACCEPT_EULA=Y' -e 'SA_PASSWORD=LocalPass123!' \
  -p 1433:1433 \
  --name sqlserver \
  -d mcr.microsoft.com/mssql/server:2022-latest
```

#### 2. Wait for Server to Start

```bash
sleep 10
docker logs sqlserver
```

#### 3. Create a Database

```bash
docker exec -it sqlserver sqlcmd -S localhost -U sa -P 'LocalPass123!' \
  -Q "CREATE DATABASE CompanyCommunicator;"
```

#### 4. Create a Connection String

```
Server=localhost,1433;Database=CompanyCommunicator;User Id=sa;Password=LocalPass123!;Encrypt=false;TrustServerCertificate=true;
```

---

## User Secrets Configuration

Use .NET user-secrets to store sensitive values locally without committing to source control.

### 1. Initialize User Secrets (First Time Only)

```bash
cd src/CompanyCommunicator.Api
dotnet user-secrets init
```

This creates a `UserSecretsId` in the `.csproj` file if it doesn't exist.

### 2. Set Connection Strings

```bash
# SQL database connection string (from section 3)
dotnet user-secrets set "ConnectionStrings:SqlDb" \
  "Server=(localdb)\mssqlocaldb;Database=CompanyCommunicator;Trusted_Connection=true;Encrypt=false;"

# Service Bus namespace (for local dev, use one from Azure or local emulator)
dotnet user-secrets set "ConnectionStrings:ServiceBusConnection" \
  "Endpoint=sb://your-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=..."

# Service Bus fully-qualified namespace
dotnet user-secrets set "ServiceBus:FullyQualifiedNamespace" \
  "your-servicebus.servicebus.windows.net"
```

### 3. Set Azure Identity Configuration

```bash
# If using local dev without Azure resources, set these to dummy values
# (they'll only be used by Graph SDK, which requires valid auth)

# For Entra ID app registration from the setup guide
dotnet user-secrets set "AzureAd:ClientId" \
  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

dotnet user-secrets set "AzureAd:TenantId" \
  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

dotnet user-secrets set "AzureAd:ClientSecret" \
  "your-client-secret"

# Enable the API to accept tokens without verification (dev only!)
dotnet user-secrets set "TokenValidation:Enabled" "false"
```

### 4. Set Blob Storage Configuration

```bash
# Local development: use Azure Storage Emulator or real Azure Storage
dotnet user-secrets set "BlobStorage:ServiceUri" \
  "https://your-storage-account.blob.core.windows.net"
```

### 5. Set Bot Configuration

```bash
dotnet user-secrets set "Bot:AppId" \
  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

dotnet user-secrets set "Bot:AppPassword" \
  "your-bot-app-secret"
```

### 6. Verify Secrets

```bash
dotnet user-secrets list
```

---

## Azure Resources for Local Dev

For full local development, you have two options:

### Option 1: Use Azure Resources (Recommended)

Deploy a dev environment in Azure (see [setup-guide.md](setup-guide.md)) and point your local code to it:

```bash
# Get the Service Bus connection string from Azure
az servicebus namespace authorization-rule keys list \
  --resource-group rg-cc-dev \
  --namespace-name sb-cc-dev-<suffix> \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString -o tsv

# Set it in user-secrets
dotnet user-secrets set "ConnectionStrings:ServiceBusConnection" "<connection-string>"

# Get the Storage Account connection string
az storage account show-connection-string \
  --resource-group rg-cc-dev \
  --name storacccc dev \
  --query connectionString -o tsv

dotnet user-secrets set "ConnectionStrings:StorageConnection" "<connection-string>"
```

### Option 2: Mock Services Locally (Advanced)

For development without Azure resources, you can:
- Use in-memory queues (not recommended for production-like testing)
- Use local emulator (Azure Storage Emulator, Service Bus emulator not available in latest versions)
- Mock the services with test doubles

For most development, **Option 1 is simpler**.

---

## Running the API

### 1. Navigate to the API Project

```bash
cd src/CompanyCommunicator.Api
```

### 2. Run Migrations (First Time Only)

```bash
dotnet ef database update --startup-project . --project ../CompanyCommunicator.Core
```

This creates the database schema.

### 3. Start the API Server

```bash
dotnet run
```

You should see output like:

```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:5001
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to exit.
```

The API is now running at `https://localhost:5001`.

### 4. Verify the API

In a new terminal:

```bash
curl -k https://localhost:5001/health/live
```

You should get an HTTP 200 response (possibly with auth required).

---

## Running the Frontend

The frontend can run in two ways:

### Option A: Serve from API (Faster Initial Load)

If you built the frontend in section 2.4, it's served from the API at `/clientapp/`:

```
https://localhost:5001/clientapp/
```

Just open this URL in a browser.

### Option B: Vite Dev Server (Faster Iteration)

For faster hot-reload during UI development:

```bash
cd src/CompanyCommunicator.Api/ClientApp
npm run dev
```

You should see output like:

```
  VITE v6.0.1  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Open `http://localhost:5173/` in your browser. Vite will proxy `/api` requests to `https://localhost:5001`.

### 3. Login

When the app loads:

1. You'll be prompted to sign in.

2. Choose one of:
   - **Teams SSO** (if configured): Uses `authentication.getAuthToken()` from Teams SDK
   - **Manual Bearer Token** (for local dev): Paste an Entra ID JWT token in the Authorization header
   - **Mock Token** (development only): Use a dummy token (requires `TokenValidation:Enabled = false`)

For Teams SSO, you must run the app in Teams (either Teams client or Teams Emulator).

---

## Running Azure Functions Locally

### 1. Navigate to Function App Project

```bash
cd src/CompanyCommunicator.Functions.Prep
```

### 2. Create local.settings.json

Copy the template and fill in values from your user-secrets:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net",
    "FUNCTIONS_WORKER_RUNTIME": "dotnet-isolated",
    "ConnectionStrings__SqlConnection": "Server=(localdb)\\mssqlocaldb;Database=CompanyCommunicator;Trusted_Connection=true;Encrypt=false;",
    "ConnectionStrings__ServiceBusConnection": "Endpoint=sb://your-servicebus.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=...",
    "ServiceBus:FullyQualifiedNamespace": "your-servicebus.servicebus.windows.net",
    "BlobStorage:ServiceUri": "https://storageaccount.blob.core.windows.net"
  }
}
```

> **Service Bus trigger connection:** The `ServiceBusTrigger` attributes use `Connection = "ServiceBus"` as a prefix. The Azure Functions extension resolves this to `ServiceBus:FullyQualifiedNamespace` for identity-based auth in Azure, or falls back to the connection string locally. The `ServiceBus:FullyQualifiedNamespace` key above provides the FQDN for local development.

**Important**: Do NOT commit this file. It contains secrets.

### 3. Start the Function App

```bash
func start
```

You should see output:

```
Azure Functions Core Tools
Core Tools Version:       4.x.x
Function Runtime Version: 4.x

Functions in local.settings.json not matching your local runtime.
[Warning] Functions in local.settings.json not matching your local runtime. Please delete your local.settings.json and recreate it.

Functions loaded. Press CTRL+C to exit.
http.localhost:7071/api/messages
```

The function is listening on `http://localhost:7071`.

### 4. Test the Function

In another terminal:

```bash
curl -X POST http://localhost:7071/api/messages \
  -H "Content-Type: application/json" \
  -d '{"conversationId": "test", "text": "Hello"}'
```

---

## Testing with Teams Emulator

To test the bot integration locally, use the **Bot Framework Emulator** or **Teams Emulator**.

### 1. Download Bot Framework Emulator

[Download](https://github.com/Microsoft/BotFramework-Emulator/releases) the latest release.

### 2. Expose Your Local API

Your local API is running on `https://localhost:5001`, but Teams (or the emulator) can't reach it without exposing it publicly. Use **ngrok** or **Azure Dev Tunnels**:

#### Option A: ngrok

```bash
# Install ngrok (https://ngrok.com)
ngrok http --host-header="localhost:5001" https://localhost:5001
```

You'll get a public URL like `https://abc123.ngrok.io`.

#### Option B: Azure Dev Tunnels (Recommended)

```bash
# Install or update
az extension add --name tunnels

# Create a tunnel
az tunnels create --name cc-dev --allow-anonymous true

# Start the tunnel
az tunnels run --name cc-dev -l 5001
```

You'll get a public URL like `https://xyz.webdevtunnels.net`.

### 3. Register the Tunnel URL as Bot Endpoint

In your Entra ID app registration:

1. Go to **Configuration** (in the Azure Bot Service, or in the app registration's bot channel registration).

2. Set **Messaging endpoint** to: `https://<tunnel-url>/api/messages`

### 4. Connect Emulator to Your Bot

1. Open Bot Framework Emulator.

2. Click **Open Bot**:
   - **Bot URL**: `http://localhost:5001/api/messages`
   - **Microsoft App ID**: Your Entra ID app's client ID
   - **Microsoft App password**: Your client secret
   - Click **Connect**

3. You should see a connection established.

4. Type a message in the emulator and press Enter. The bot should respond (if your activity handler is implemented).

---

## Running Tests

### 1. Unit Tests

```bash
dotnet test CompanyCommunicator.sln -c Debug
```

Tests are located in:
- `tests/CompanyCommunicator.Core.Tests/`
- `tests/CompanyCommunicator.Api.Tests/`
- `tests/CompanyCommunicator.Functions.Tests/`

### 2. Coverage

```bash
dotnet test CompanyCommunicator.sln --collect:"XPlat Code Coverage"
```

Coverage reports are generated in `tests/*/TestResults/`.

### 3. Run Specific Test Class

```bash
dotnet test CompanyCommunicator.sln -c Debug --filter="ClassName=NotificationsControllerTests"
```

### 4. Watch Mode

```bash
# Requires dotnet-watch
dotnet tool install --global dotnet-watch

# Run tests in watch mode
dotnet watch test CompanyCommunicator.sln -c Debug
```

---

## Troubleshooting

### "Connection refused" when Connecting to Database

**Symptom**: `SqlClient.SqlException: A network-related or instance-specific error occurred`

**Causes**:
- LocalDB not running
- Docker SQL Server container not running
- Connection string incorrect

**Solutions**:

```bash
# Verify LocalDB
SqlLocalDB instances

# Start LocalDB if needed
SqlLocalDB start mssqlocaldb

# Verify Docker container
docker ps | grep sqlserver

# Start Docker container if needed
docker start sqlserver

# Test connection
sqlcmd -S "(localdb)\mssqlocaldb" -Q "SELECT 1;"
```

### "Cannot open database" when Running Migrations

**Symptom**: `Invalid object name 'dbo.Notifications'`

**Cause**: Migrations haven't run yet.

**Solution**:

```bash
cd src/CompanyCommunicator.Api
dotnet ef database update --startup-project . --project ../CompanyCommunicator.Core
```

### "Unauthorized" or "Access Denied" when Calling API

**Symptom**: Every API call returns 401 or 403.

**Cause**: Token validation is enabled but no valid token provided.

**Solutions**:
- For development, disable token validation (only locally!):
  ```bash
  dotnet user-secrets set "TokenValidation:Enabled" "false"
  ```
- Or obtain a valid Teams SSO token from Teams Emulator and include it as a Bearer token:
  ```bash
  curl -H "Authorization: Bearer <token>" https://localhost:5001/api/notifications
  ```

### "Service Bus connection string is not configured"

**Symptom**: `InvalidOperationException: ConnectionStrings:ServiceBusConnection is not configured`

**Solution**:

```bash
dotnet user-secrets set "ConnectionStrings:ServiceBusConnection" \
  "Endpoint=sb://namespace.servicebus.windows.net/;SharedAccessKeyName=RootManageSharedAccessKey;SharedAccessKey=..."
```

Get the connection string from Azure:

```bash
az servicebus namespace authorization-rule keys list \
  --resource-group rg-cc-dev \
  --namespace-name sb-cc-dev-<suffix> \
  --name RootManageSharedAccessKey \
  --query primaryConnectionString -o tsv
```

### "ngrok connection unstable" or "Tunnel expired"

**Solution**: Tunnels have time limits. Restart them:

```bash
# ngrok: CTRL+C and restart
# Azure Dev Tunnels: az tunnels run --name cc-dev -l 5001 again
```

### npm Packages Won't Install

**Symptom**: `npm ERR! code ERESOLVE` or peer dependency conflicts.

**Solution**:

```bash
cd src/CompanyCommunicator.Api/ClientApp

# Clear npm cache
npm cache clean --force

# Delete node_modules and lock file
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

### Vite Dev Server Won't Start

**Symptom**: `Error: listen EADDRINUSE: address already in use :::5173`

**Solution**: Port 5173 is already in use. Either:

```bash
# Kill the process using port 5173 (Linux/Mac)
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Or start on a different port
npm run dev -- --port 5174
```

### "Teams SSO not working" in Local Dev

**Symptom**: Login button doesn't trigger `authentication.getAuthToken()`, or it returns an error.

**Cause**: You must run the app within Teams (either the Teams desktop client or Emulator).

**Solution**:
- Use Bot Framework Emulator (not web browser) when testing locally
- Or deploy to Azure and test in real Teams
- Or use a mock token for development (set `TokenValidation:Enabled = false`)

---

## Development Workflow Tips

### Quick Iteration Loop

```bash
# Terminal 1: API
cd src/CompanyCommunicator.Api
dotnet run

# Terminal 2: Frontend
cd src/CompanyCommunicator.Api/ClientApp
npm run dev

# Terminal 3: Functions
cd src/CompanyCommunicator.Functions.Prep
func start

# Terminal 4: (Optional) Send Function
cd src/CompanyCommunicator.Functions.Send
func start
```

Then:
- Edit `.cs` files → API auto-reloads (watch mode enabled in debug builds)
- Edit `.tsx` files → Vite hot-reloads at `http://localhost:5173`

### Debugging in Visual Studio Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": ".NET Core Attach",
      "type": "coreclr",
      "request": "attach",
      "processId": "${command:pickProcess}"
    },
    {
      "name": "Frontend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/CompanyCommunicator.Api/ClientApp/node_modules/vite/bin/vite.js",
      "args": ["--host"],
      "cwd": "${workspaceFolder}/src/CompanyCommunicator.Api/ClientApp"
    }
  ]
}
```

Then press F5 to start debugging.

### Common Git Workflow

```bash
# Update from main
git checkout main
git pull

# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit, and push
git commit -am "Add my feature"
git push origin feature/my-feature

# Open pull request (GitHub UI or)
gh pr create --title "My feature" --body "Fixes #123"

# After code review and CI passes, merge
gh pr merge --squash
```

---

## Next Steps

- Review the [Architecture](architecture.md) document to understand system design
- Read the [Operations Guide](operations.md) to learn about monitoring and scaling
- Deploy to Azure for integration testing (see [Setup Guide](setup-guide.md))
