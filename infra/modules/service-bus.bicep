// =============================================================================
// Module: service-bus.bicep
// Purpose: Service Bus namespace (Standard) + 3 queues + RBAC
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

@description('Principal ID of the managed identity for RBAC assignments.')
param managedIdentityPrincipalId string

// ---------------------------------------------------------------------------
// Well-known role definition ID (built-in)
// ---------------------------------------------------------------------------

var serviceBusDataOwnerRoleId = '090c5cfd-751d-490a-894a-3ce6f1109419'

// ---------------------------------------------------------------------------
// Service Bus Namespace
// ---------------------------------------------------------------------------

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: 'sb-${appName}-${environmentName}-${uniqueSuffix}'
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false   // Local auth needed for connection string in Key Vault; MI used for data ops
  }
}

// ---------------------------------------------------------------------------
// Queue: cc-prepare
// Used by orchestrator to fan-out batch preparation work
// ---------------------------------------------------------------------------

resource queuePrepare 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'cc-prepare'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P1D'
    requiresDuplicateDetection: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    deadLetteringOnMessageExpiration: true
    enableBatchedOperations: true
    maxSizeInMegabytes: 1024
    requiresSession: false
  }
}

// ---------------------------------------------------------------------------
// Queue: cc-send
// High-throughput queue for individual message delivery to recipients
// ---------------------------------------------------------------------------

resource queueSend 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'cc-send'
  properties: {
    maxDeliveryCount: 10
    lockDuration: 'PT1M'
    defaultMessageTimeToLive: 'P1D'
    requiresDuplicateDetection: false
    deadLetteringOnMessageExpiration: true
    enableBatchedOperations: true
    maxSizeInMegabytes: 1024
    requiresSession: false
  }
}

// ---------------------------------------------------------------------------
// Queue: cc-export
// Used for export jobs (recipient list, delivery reports)
// ---------------------------------------------------------------------------

resource queueExport 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'cc-export'
  properties: {
    maxDeliveryCount: 5
    lockDuration: 'PT5M'
    defaultMessageTimeToLive: 'P1D'
    requiresDuplicateDetection: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    deadLetteringOnMessageExpiration: true
    enableBatchedOperations: true
    maxSizeInMegabytes: 1024
    requiresSession: false
  }
}

// ---------------------------------------------------------------------------
// RBAC: Azure Service Bus Data Owner for the managed identity
// Allows the identity to send, receive, and manage messages on all queues
// ---------------------------------------------------------------------------

resource serviceBusDataOwnerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespace.id, managedIdentityPrincipalId, serviceBusDataOwnerRoleId)
  scope: serviceBusNamespace
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', serviceBusDataOwnerRoleId)
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// Reference the built-in RootManageSharedAccessKey authorization rule
// ---------------------------------------------------------------------------

resource rootManageSharedAccessKey 'Microsoft.ServiceBus/namespaces/authorizationRules@2022-10-01-preview' existing = {
  parent: serviceBusNamespace
  name: 'RootManageSharedAccessKey'
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Service Bus namespace name.')
output namespaceName string = serviceBusNamespace.name

@description('Resource ID of the Service Bus namespace.')
output namespaceId string = serviceBusNamespace.id

@description('Fully-qualified namespace hostname for AMQP connections (passwordless).')
output fullyQualifiedNamespace string = '${serviceBusNamespace.name}.servicebus.windows.net'

@description('Primary connection string for the root manage shared access key (stored in Key Vault).')
#disable-next-line outputs-should-not-contain-secrets  // Intentional: consumed by key-vault module to write to KV; not surfaced to end users
output connectionString string = rootManageSharedAccessKey.listKeys().primaryConnectionString
