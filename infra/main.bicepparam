// =============================================================================
// main.bicepparam – Company Communicator v2
// Parameter file for main.bicep deployments
//
// Usage:
//   az deployment group create \
//     --resource-group rg-cc-dev \
//     --template-file infra/main.bicep \
//     --parameters infra/main.bicepparam
//
// Sensitive values (botAppId, sqlAdminObjectId) should be injected via
// pipeline secret variables or Azure DevOps variable groups rather than
// committed to source control in a production scenario.
// =============================================================================

using 'main.bicep'

// ---------------------------------------------------------------------------
// Core deployment parameters
// ---------------------------------------------------------------------------

// Short label appended to all resource names and tags.
// Keep lowercase, 2-8 chars. Change per environment (dev/stg/prod).
param environmentName = 'dev'

// Azure region – must match the resource group region.
// Uncomment and set explicitly if you need to override the RG location.
// param location = 'westus2'

// Short application name prefix for all resource names.
// Default 'cc' gives names like: app-cc-dev, sql-cc-dev-<suffix>, kv-cc-dev-<suffix>, etc.
// Globally-unique resources (SQL, Storage, Service Bus, Key Vault) include a 5-char suffix from uniqueString(resourceGroup().id).
param appName = 'cc'

// ---------------------------------------------------------------------------
// Identity & auth parameters
// ---------------------------------------------------------------------------

// Object ID of the Entra ID principal to set as the SQL AD administrator.
// For initial deployment: use the deploying user's Object ID.
//   az ad signed-in-user show --query id -o tsv
// After deployment: update to the managed identity's principal ID via:
//   az sql server ad-admin create ...
param sqlAdminObjectId = '00000000-0000-0000-0000-000000000000'

// Entra ID Application (client) ID of the registered single-tenant bot app.
// Create via: az ad app create --display-name "CompanyCommunicator-v2" ...
// Then register as a bot app registration with single-tenant authentication.
param botAppId = '00000000-0000-0000-0000-000000000000'

// ---------------------------------------------------------------------------
// Operational parameters
// ---------------------------------------------------------------------------

// Email address for alert notifications (DLQ, SQL CPU, HTTP 5xx, Func errors).
param alertEmailAddress = 'ops-team@contoso.com'
