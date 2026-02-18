// =============================================================================
// Module: key-vault.bicep
// Purpose: Key Vault (RBAC model) + placeholder secrets + MI access
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

@description('Principal ID of the managed identity for Key Vault Secrets User role.')
param managedIdentityPrincipalId string

@description('SQL connection string to store as a secret (no SQL keys – uses managed identity pattern).')
param sqlConnectionString string

@description('Service Bus connection string to store as a secret.')
@secure()
param serviceBusConnectionString string

@description('Bot app client secret (placeholder; updated out-of-band after app registration).')
@secure()
param botAppSecret string = ''  // Empty default; must be set post-deployment via: az keyvault secret set

// ---------------------------------------------------------------------------
// Well-known role definition ID (built-in)
// ---------------------------------------------------------------------------

var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

// ---------------------------------------------------------------------------
// Key Vault
// ---------------------------------------------------------------------------

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${appName}-${environmentName}-${uniqueSuffix}'
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true      // RBAC model; no access policies
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ---------------------------------------------------------------------------
// RBAC: Key Vault Secrets User for the managed identity
// Allows compute resources to read secrets via Key Vault references
// ---------------------------------------------------------------------------

resource kvSecretsUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, managedIdentityPrincipalId, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: managedIdentityPrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

resource secretSqlConnection 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'SqlConnectionString'
  properties: {
    value: sqlConnectionString
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource secretServiceBusConnection 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'ServiceBusConnectionString'
  properties: {
    value: serviceBusConnectionString
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

resource secretBotAppSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'BotAppSecret'
  properties: {
    value: botAppSecret
    contentType: 'text/plain'
    attributes: {
      enabled: true
    }
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('URI of the Key Vault (used in Key Vault reference app settings).')
output vaultUri string = keyVault.properties.vaultUri

@description('Resource ID of the Key Vault.')
output resourceId string = keyVault.id

@description('Name of the Key Vault.')
output name string = keyVault.name

@description('Key Vault reference expression for the SQL connection string secret.')
output kvRefSqlConnection string = '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=${secretSqlConnection.name})'

@description('Key Vault reference expression for the Service Bus connection string secret.')
output kvRefServiceBusConnection string = '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=${secretServiceBusConnection.name})'

@description('Key Vault reference expression for the Bot app secret.')
output kvRefBotAppSecret string = '@Microsoft.KeyVault(VaultName=${keyVault.name};SecretName=${secretBotAppSecret.name})'
