// =============================================================================
// Module: function-app-send.bicep
// Purpose: Send Function App on its own Consumption plan (auto-scaling)
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

@description('Client ID of the user-assigned managed identity.')
param managedIdentityClientId string

@description('Application Insights connection string.')
param appInsightsConnectionString string

@description('Storage account connection string (AzureWebJobsStorage for Functions host).')
@secure()
param storageConnectionString string

@description('Storage account name.')
param storageAccountName string

@description('Key Vault reference expression for the SQL connection string.')
param kvRefSqlConnection string

@description('Key Vault reference expression for the Service Bus connection string.')
param kvRefServiceBusConnection string

@description('Fully-qualified namespace for Service Bus (for passwordless AMQP).')
param serviceBusFullyQualifiedNamespace string

// ---------------------------------------------------------------------------
// Dedicated Consumption Plan (Y1 dynamic) for independent auto-scaling
// ---------------------------------------------------------------------------

// Windows Consumption plan: Azure does not allow Linux Consumption and Linux
// Dedicated (S1) plans in the same resource group.  .NET 8 isolated worker
// runs on both Windows and Linux, so we use Windows here to avoid the conflict.
resource consumptionPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: 'asp-${appName}-send-${environmentName}'
  location: location
  tags: tags
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: false   // Windows Consumption plan
  }
}

// ---------------------------------------------------------------------------
// Send Function App
// ---------------------------------------------------------------------------

resource functionAppSend 'Microsoft.Web/sites@2023-12-01' = {
  name: 'func-${appName}-send-${environmentName}-${uniqueSuffix}'
  location: location
  tags: tags
  kind: 'functionapp'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityResourceId}': {}
    }
  }
  properties: {
    serverFarmId: consumptionPlan.id
    httpsOnly: true
    clientAffinityEnabled: false
    siteConfig: {
      netFrameworkVersion: 'v8.0'
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      appSettings: [
        // ---- Functions runtime ----
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet-isolated'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
        // ---- Storage (required by Functions host) ----
        {
          name: 'AzureWebJobsStorage'
          value: storageConnectionString
        }
        {
          name: 'Storage__AccountName'
          value: storageAccountName
        }
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
      ]
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Default hostname of the Send Function App.')
output hostName string = functionAppSend.properties.defaultHostName

@description('Resource ID of the Send Function App.')
output resourceId string = functionAppSend.id

@description('Name of the Send Function App.')
output name string = functionAppSend.name

@description('HTTPS URL of the Send Function App.')
output functionAppUrl string = 'https://${functionAppSend.properties.defaultHostName}'
