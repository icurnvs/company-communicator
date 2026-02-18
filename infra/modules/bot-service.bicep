// =============================================================================
// Module: bot-service.bicep
// Purpose: Azure Bot Service (single-tenant) + Teams channel
// =============================================================================

@description('Standard resource tags to apply.')
param tags object

@description('Base name used to derive the resource name.')
param appName string

@description('Environment label (e.g. dev, prod).')
param environmentName string

@description('Entra ID Application (client) ID registered for the bot.')
param botAppId string

@description('Hostname of the Web App that handles /api/messages.')
param webAppHostName string

// ---------------------------------------------------------------------------
// Azure Bot Service
// ---------------------------------------------------------------------------

resource botService 'Microsoft.BotService/botServices@2022-09-15' = {
  name: 'bot-${appName}-${environmentName}'
  location: 'global'   // Azure Bot Service is a global resource
  tags: tags
  kind: 'azurebot'
  sku: {
    name: 'S1'
  }
  properties: {
    displayName: 'Company Communicator v2'
    description: 'Company Communicator v2 – internal broadcast bot for Microsoft Teams'
    msaAppId: botAppId
    msaAppType: 'SingleTenant'
    msaAppTenantId: tenant().tenantId
    endpoint: 'https://${webAppHostName}/api/messages'
    developerAppInsightKey: ''
    isCmekEnabled: false
    publicNetworkAccess: 'Enabled'
    isStreamingSupported: false
  }
}

// ---------------------------------------------------------------------------
// Teams Channel
// ---------------------------------------------------------------------------

resource teamsChannel 'Microsoft.BotService/botServices/channels@2022-09-15' = {
  parent: botService
  name: 'MsTeamsChannel'
  location: 'global'
  properties: {
    channelName: 'MsTeamsChannel'
    properties: {
      enableCalling: false
      isEnabled: true
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Bot handle (resource name).')
output botHandle string = botService.name

@description('Resource ID of the Azure Bot Service.')
output resourceId string = botService.id

@description('Bot messaging endpoint.')
output messagingEndpoint string = botService.properties.endpoint
