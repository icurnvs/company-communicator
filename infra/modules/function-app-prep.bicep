// =============================================================================
// Module: function-app-prep.bicep
// Purpose: Prep+Data Function App (Durable Functions) on shared App Service Plan
// =============================================================================

@description('Azure region for the resource.')
param location string

@description('Standard resource tags to apply.')
param tags object

@description('Base name used to derive the resource name.')
param appName string

@description('Environment label (e.g. dev, prod).')
param environmentName string

@description('Unique suffix for globally unique resource names.')
param uniqueSuffix string

@description('Resource ID of the shared App Service Plan (from app-service module).')
param appServicePlanId string

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
// Function App: Prep + Data (Durable Functions)
// Runs on the shared S1 plan alongside the Web App
// ---------------------------------------------------------------------------

resource functionAppPrep 'Microsoft.Web/sites@2023-12-01' = {
  name: 'func-${appName}-prep-${environmentName}-${uniqueSuffix}'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${managedIdentityResourceId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    clientAffinityEnabled: false
    keyVaultReferenceIdentity: managedIdentityResourceId
    siteConfig: {
      linuxFxVersion: 'DOTNET-ISOLATED|8.0'
      alwaysOn: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      http20Enabled: true
      use32BitWorkerProcess: false
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
        // ---- Durable Functions ----
        {
          name: 'DurableTask__HubName'
          value: 'CompanyCommunicatorHub'
        }
      ]
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Default hostname of the Prep Function App.')
output hostName string = functionAppPrep.properties.defaultHostName

@description('Resource ID of the Prep Function App.')
output resourceId string = functionAppPrep.id

@description('Name of the Prep Function App.')
output name string = functionAppPrep.name

@description('HTTPS URL of the Prep Function App.')
output functionAppUrl string = 'https://${functionAppPrep.properties.defaultHostName}'
