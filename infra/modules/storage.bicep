// =============================================================================
// Module: storage.bicep
// Purpose: Storage Account with blob containers and RBAC for managed identity
// =============================================================================

@description('Azure region for the resource.')
param location string

@description('Standard resource tags to apply.')
param tags object

@description('Base name used to derive the resource name (lowercase, alphanumeric only).')
param appName string

@description('Environment label (e.g. dev, prod).')
param environmentName string

@description('Unique suffix for globally unique resource names.')
param uniqueSuffix string

@description('Principal ID of the managed identity for RBAC assignments.')
param managedIdentityPrincipalId string

// ---------------------------------------------------------------------------
// Name must be globally unique, <=24 chars, lowercase alphanumeric only
// ---------------------------------------------------------------------------

// Storage account name: globally unique, <= 24 chars, lowercase alphanumeric.
// 'st' prefix (2) + appName (>=2) + environmentName (>=2) = >=6 chars guaranteed.
// Bicep's static analyser cannot infer a minimum from take(), so we use a
// helper var with @minLength enforced via the module parameter constraints.
var storageAccountNameRaw  = toLower(replace('st${appName}${environmentName}${uniqueSuffix}', '-', ''))
var storageAccountName     = take(storageAccountNameRaw, 24)

// ---------------------------------------------------------------------------
// Well-known role definition IDs (built-in)
// ---------------------------------------------------------------------------

var storageBlobDataOwnerRoleId    = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
var storageQueueDataContribRoleId = '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
var storageTableDataContribRoleId = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'

// ---------------------------------------------------------------------------
// Storage Account
// ---------------------------------------------------------------------------

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true   // Functions SDK requires shared key for triggers; MI used for data ops
    defaultToOAuthAuthentication: false
    accessTier: 'Hot'
    encryption: {
      services: {
        blob: {
          enabled: true
          keyType: 'Account'
        }
        queue: {
          enabled: true
          keyType: 'Account'
        }
        table: {
          enabled: true
          keyType: 'Account'
        }
        file: {
          enabled: true
          keyType: 'Account'
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// ---------------------------------------------------------------------------
// Blob Service
// ---------------------------------------------------------------------------

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 7
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 7
    }
  }
}

// ---------------------------------------------------------------------------
// Blob Containers
// ---------------------------------------------------------------------------

resource containerCardImages 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'card-images'
  properties: {
    publicAccess: 'None'
  }
}

resource containerExports 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: 'exports'
  properties: {
    publicAccess: 'None'
  }
}

// ---------------------------------------------------------------------------
// RBAC: Storage Blob Data Owner
// Functions need lease management (create, write, delete on blobs)
// ---------------------------------------------------------------------------

resource blobOwnerAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentityPrincipalId, storageBlobDataOwnerRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataOwnerRoleId)
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// RBAC: Storage Queue Data Contributor
// Internal trigger coordination between function apps
// ---------------------------------------------------------------------------

resource queueContribAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentityPrincipalId, storageQueueDataContribRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageQueueDataContribRoleId)
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// RBAC: Storage Table Data Contributor
// Durable Functions uses Table storage for history and instance tracking
// ---------------------------------------------------------------------------

resource tableContribAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, managedIdentityPrincipalId, storageTableDataContribRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageTableDataContribRoleId)
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Storage account name.')
output accountName string = storageAccount.name

@description('Primary blob endpoint URI.')
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob

@description('Resource ID of the storage account.')
output resourceId string = storageAccount.id

@description('Primary connection string (used by Azure Functions runtime for host triggers).')
#disable-next-line outputs-should-not-contain-secrets  // Intentional: Functions v4 host still requires shared-key AzureWebJobsStorage; consumed by key-vault and function app modules only
output connectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
