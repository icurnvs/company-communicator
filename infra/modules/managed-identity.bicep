// =============================================================================
// Module: managed-identity.bicep
// Purpose: User-assigned Managed Identity shared across all compute resources
// =============================================================================

@description('Azure region for the resource.')
param location string

@description('Standard resource tags to apply.')
param tags object

@description('Base name used to derive the resource name.')
param appName string

@description('Environment label (e.g. dev, prod).')
param environmentName string

// ---------------------------------------------------------------------------
// Resource
// ---------------------------------------------------------------------------

resource managedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${appName}-${environmentName}'
  location: location
  tags: tags
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Object (principal) ID of the managed identity – used for RBAC assignments.')
output principalId string = managedIdentity.properties.principalId

@description('Client ID of the managed identity – used in app settings.')
output clientId string = managedIdentity.properties.clientId

@description('Full resource ID of the managed identity – used for assignment to compute.')
output resourceId string = managedIdentity.id

@description('Name of the managed identity resource.')
output name string = managedIdentity.name
