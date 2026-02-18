// =============================================================================
// Module: app-insights.bicep
// Purpose: Log Analytics workspace + Application Insights instance
// =============================================================================

@description('Azure region for the resources.')
param location string

@description('Standard resource tags to apply.')
param tags object

@description('Base name used to derive resource names.')
param appName string

@description('Environment label (e.g. dev, prod).')
param environmentName string

// ---------------------------------------------------------------------------
// Log Analytics Workspace
// ---------------------------------------------------------------------------

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'law-${appName}-${environmentName}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// ---------------------------------------------------------------------------
// Application Insights
// ---------------------------------------------------------------------------

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${appName}-${environmentName}'
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    RetentionInDays: 30
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Application Insights connection string for SDK configuration.')
output connectionString string = appInsights.properties.ConnectionString

@description('Application Insights instrumentation key (legacy fallback).')
output instrumentationKey string = appInsights.properties.InstrumentationKey

@description('Resource ID of the Log Analytics workspace.')
output workspaceId string = logAnalyticsWorkspace.id

@description('Resource ID of the Application Insights instance.')
output appInsightsId string = appInsights.id

@description('Name of the Application Insights instance.')
output appInsightsName string = appInsights.name
