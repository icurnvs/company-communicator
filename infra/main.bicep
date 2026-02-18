// =============================================================================
// main.bicep – Company Communicator v2
// Orchestrates all infrastructure modules for a complete deployment
//
// Deployment order (implicit via module output references):
//   1. managed-identity        (no deps)
//   2. app-insights            (no deps)
//   3. storage                 (managed-identity)
//   4. service-bus             (managed-identity)
//   5. sql                     (managed-identity)
//   6. key-vault               (managed-identity, service-bus, sql)
//   7. app-service             (all above)
//   8. function-app-prep       (app-service plan, storage, service-bus, sql, kv)
//   9. function-app-send       (storage, service-bus, sql, kv – own plan)
//  10. bot-service             (app-service hostname)
//  11. diagnostics             (all resource IDs, workspace ID)
//  12. alerts                  (resource IDs)
// =============================================================================

targetScope = 'resourceGroup'

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

@description('Short environment label (e.g. dev, stg, prod). Used in resource names and tags.')
@minLength(2)
@maxLength(8)
param environmentName string

@description('Azure region. Defaults to the resource group location.')
param location string = resourceGroup().location

@description('Short application name used in all resource names. Lowercase alphanumeric + hyphens.')
@minLength(2)
@maxLength(10)
param appName string = 'cc'

@description('Email address for operational alert notifications.')
param alertEmailAddress string

@description('Entra ID Application (client) ID of the registered bot application.')
param botAppId string

// ---------------------------------------------------------------------------
// Standard tags applied to every resource
// ---------------------------------------------------------------------------

var commonTags = {
  application: 'CompanyCommunicator'
  environment: environmentName
  managedBy: 'bicep'
}

// Deterministic 5-char suffix for globally-unique resource names (SQL, Storage, SB, KV)
var uniqueSuffix = take(uniqueString(resourceGroup().id), 5)

// ---------------------------------------------------------------------------
// Module: Managed Identity
// ---------------------------------------------------------------------------

module managedIdentity 'modules/managed-identity.bicep' = {
  name: 'deploy-managed-identity'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
  }
}

// ---------------------------------------------------------------------------
// Module: Application Insights + Log Analytics
// ---------------------------------------------------------------------------

module appInsights 'modules/app-insights.bicep' = {
  name: 'deploy-app-insights'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
  }
}

// ---------------------------------------------------------------------------
// Module: Storage Account
// ---------------------------------------------------------------------------

module storage 'modules/storage.bicep' = {
  name: 'deploy-storage'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
    uniqueSuffix: uniqueSuffix
    managedIdentityPrincipalId: managedIdentity.outputs.principalId
  }
}

// ---------------------------------------------------------------------------
// Module: Service Bus
// ---------------------------------------------------------------------------

module serviceBus 'modules/service-bus.bicep' = {
  name: 'deploy-service-bus'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
    uniqueSuffix: uniqueSuffix
    managedIdentityPrincipalId: managedIdentity.outputs.principalId
  }
}

// ---------------------------------------------------------------------------
// Module: SQL
// ---------------------------------------------------------------------------

module sql 'modules/sql.bicep' = {
  name: 'deploy-sql'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
    uniqueSuffix: uniqueSuffix
    sqlAdminObjectId: managedIdentity.outputs.principalId
    sqlAdminDisplayName: managedIdentity.outputs.name
    managedIdentityClientId: managedIdentity.outputs.clientId
  }
}

// ---------------------------------------------------------------------------
// Module: Key Vault
// Stores the connection strings as secrets; compute uses KV references
// ---------------------------------------------------------------------------

module keyVault 'modules/key-vault.bicep' = {
  name: 'deploy-key-vault'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
    uniqueSuffix: uniqueSuffix
    managedIdentityPrincipalId: managedIdentity.outputs.principalId
    sqlConnectionString: sql.outputs.connectionStringPattern
    serviceBusConnectionString: serviceBus.outputs.connectionString
    // botAppSecret left as placeholder default; update post-deployment
  }
}

// ---------------------------------------------------------------------------
// Module: App Service Plan + Web App
// ---------------------------------------------------------------------------

module appService 'modules/app-service.bicep' = {
  name: 'deploy-app-service'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
    uniqueSuffix: uniqueSuffix
    managedIdentityResourceId: managedIdentity.outputs.resourceId
    managedIdentityClientId: managedIdentity.outputs.clientId
    appInsightsConnectionString: appInsights.outputs.connectionString
    kvRefSqlConnection: keyVault.outputs.kvRefSqlConnection
    kvRefServiceBusConnection: keyVault.outputs.kvRefServiceBusConnection
    kvRefBotAppSecret: keyVault.outputs.kvRefBotAppSecret
    botAppId: botAppId
    serviceBusFullyQualifiedNamespace: serviceBus.outputs.fullyQualifiedNamespace
    storageAccountName: storage.outputs.accountName
    storageConnectionString: storage.outputs.connectionString
  }
}

// ---------------------------------------------------------------------------
// Module: Prep+Data Function App (shared App Service Plan)
// ---------------------------------------------------------------------------

module functionAppPrep 'modules/function-app-prep.bicep' = {
  name: 'deploy-function-app-prep'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
    uniqueSuffix: uniqueSuffix
    appServicePlanId: appService.outputs.appServicePlanId
    managedIdentityResourceId: managedIdentity.outputs.resourceId
    managedIdentityClientId: managedIdentity.outputs.clientId
    appInsightsConnectionString: appInsights.outputs.connectionString
    storageConnectionString: storage.outputs.connectionString
    storageAccountName: storage.outputs.accountName
    kvRefSqlConnection: keyVault.outputs.kvRefSqlConnection
    kvRefServiceBusConnection: keyVault.outputs.kvRefServiceBusConnection
    serviceBusFullyQualifiedNamespace: serviceBus.outputs.fullyQualifiedNamespace
  }
}

// ---------------------------------------------------------------------------
// Module: Send Function App (own Consumption plan)
// ---------------------------------------------------------------------------

module functionAppSend 'modules/function-app-send.bicep' = {
  name: 'deploy-function-app-send'
  params: {
    location: location
    tags: commonTags
    appName: appName
    environmentName: environmentName
    uniqueSuffix: uniqueSuffix
    managedIdentityResourceId: managedIdentity.outputs.resourceId
    managedIdentityClientId: managedIdentity.outputs.clientId
    appInsightsConnectionString: appInsights.outputs.connectionString
    storageConnectionString: storage.outputs.connectionString
    storageAccountName: storage.outputs.accountName
    kvRefSqlConnection: keyVault.outputs.kvRefSqlConnection
    kvRefServiceBusConnection: keyVault.outputs.kvRefServiceBusConnection
    serviceBusFullyQualifiedNamespace: serviceBus.outputs.fullyQualifiedNamespace
    botAppId: botAppId
  }
}

// ---------------------------------------------------------------------------
// Module: Azure Bot Service
// ---------------------------------------------------------------------------

module botService 'modules/bot-service.bicep' = {
  name: 'deploy-bot-service'
  params: {
    tags: commonTags
    appName: appName
    environmentName: environmentName
    botAppId: botAppId
    webAppHostName: appService.outputs.hostName
  }
}

// ---------------------------------------------------------------------------
// Module: Diagnostic Settings
// ---------------------------------------------------------------------------

module diagnostics 'modules/diagnostics.bicep' = {
  name: 'deploy-diagnostics'
  params: {
    workspaceId: appInsights.outputs.workspaceId
    sqlServerName: sql.outputs.serverName
    sqlDatabaseName: sql.outputs.databaseName
    serviceBusNamespaceName: serviceBus.outputs.namespaceName
    keyVaultName: keyVault.outputs.name
    storageAccountName: storage.outputs.accountName
    webAppName: appService.outputs.webAppName
  }
}

// ---------------------------------------------------------------------------
// Module: Alerts
// ---------------------------------------------------------------------------

module alerts 'modules/alerts.bicep' = {
  name: 'deploy-alerts'
  params: {
    tags: commonTags
    appName: appName
    environmentName: environmentName
    alertEmailAddress: alertEmailAddress
    serviceBusNamespaceId: serviceBus.outputs.namespaceId
    sqlDatabaseId: sql.outputs.databaseId
    webAppId: appService.outputs.webAppId
    functionAppPrepId: functionAppPrep.outputs.resourceId
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('HTTPS URL of the Company Communicator Web App (API + SPA).')
output webAppUrl string = appService.outputs.webAppUrl

@description('HTTPS URL of the Prep+Data Function App.')
output functionAppPrepUrl string = functionAppPrep.outputs.functionAppUrl

@description('HTTPS URL of the Send Function App.')
output functionAppSendUrl string = functionAppSend.outputs.functionAppUrl

@description('Bot handle (Azure Bot Service resource name).')
output botHandle string = botService.outputs.botHandle

@description('Key Vault URI for secret management post-deployment.')
output keyVaultUri string = keyVault.outputs.vaultUri

@description('Application Insights resource name (for Portal navigation).')
output appInsightsName string = appInsights.outputs.appInsightsName
