// =============================================================================
// Module: app-service.bicep
// Purpose: App Service Plan (S1, Linux) + Web App (.NET 8)
//          Hosts REST API, bot endpoint, and React SPA
// =============================================================================

@description('Azure region for the resources.')
param location string

@description('Standard resource tags to apply.')
param tags object

@description('Base name used to derive resource names.')
param appName string

@description('Environment label (e.g. dev, prod).')
param environmentName string

@description('Unique suffix for globally unique resource names.')
param uniqueSuffix string

@description('Resource ID of the user-assigned managed identity to attach.')
param managedIdentityResourceId string

@description('Client ID of the user-assigned managed identity (used in AZURE_CLIENT_ID app setting).')
param managedIdentityClientId string

@description('Application Insights connection string.')
param appInsightsConnectionString string

@description('Key Vault reference expression for the SQL connection string.')
param kvRefSqlConnection string

@description('Key Vault reference expression for the Service Bus connection string.')
param kvRefServiceBusConnection string

@description('Key Vault reference expression for the Bot app secret.')
@secure()
param kvRefBotAppSecret string

@description('Bot app (client) ID registered in Entra ID.')
param botAppId string

@description('Fully-qualified namespace for Service Bus (for passwordless AMQP).')
param serviceBusFullyQualifiedNamespace string

@description('Storage account name (for AzureWebJobsStorage connection).')
param storageAccountName string

@description('Storage account connection string (for AzureWebJobsStorage).')
@secure()
param storageConnectionString string

// ---------------------------------------------------------------------------
// App Service Plan: Standard S1, Linux
// Shared with function-app-prep module
// ---------------------------------------------------------------------------

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'asp-${appName}-${environmentName}'
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'S1'
    tier: 'Standard'
    size: 'S1'
    family: 'S'
    capacity: 1
  }
  properties: {
    reserved: true   // Required for Linux plans
  }
}

// ---------------------------------------------------------------------------
// Web App: .NET 8, HTTPS only, min TLS 1.2
// ---------------------------------------------------------------------------

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: 'app-${appName}-${environmentName}-${uniqueSuffix}'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityResourceId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|8.0'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      healthCheckPath: '/health/ready'
      appCommandLine: 'dotnet CompanyCommunicator.Api.dll'
      use32BitWorkerProcess: false
      appSettings: [
        // ---- Identity ----
        {
          name: 'AZURE_CLIENT_ID'
          value: managedIdentityClientId
        }
        // ---- Application Insights ----
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsightsConnectionString
        }
        {
          name: 'ApplicationInsightsAgent_EXTENSION_VERSION'
          value: '~3'
        }
        // ---- SQL (Key Vault reference) ----
        {
          name: 'ConnectionStrings__SqlConnection'
          value: kvRefSqlConnection
        }
        // ---- Service Bus ----
        {
          name: 'ServiceBus__FullyQualifiedNamespace'
          value: serviceBusFullyQualifiedNamespace
        }
        {
          name: 'ConnectionStrings__ServiceBusConnection'
          value: kvRefServiceBusConnection
        }
        // ---- Storage ----
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'Storage__AccountName'
          value: storageAccountName
        }
        // ---- Bot ----
        {
          name: 'Bot__AppId'
          value: botAppId
        }
        {
          name: 'Bot__AppSecret'
          value: kvRefBotAppSecret
        }
        // ---- Runtime ----
        {
          name: 'ASPNETCORE_ENVIRONMENT'
          value: environmentName
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
      cors: {
        allowedOrigins: [
          'https://teams.microsoft.com'
        ]
        supportCredentials: false
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Default hostname of the Web App.')
output hostName string = webApp.properties.defaultHostName

@description('Resource ID of the App Service Plan (shared with Prep Function App).')
output appServicePlanId string = appServicePlan.id

@description('Resource ID of the Web App.')
output webAppId string = webApp.id

@description('Name of the Web App.')
output webAppName string = webApp.name

@description('HTTPS URL of the Web App.')
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
