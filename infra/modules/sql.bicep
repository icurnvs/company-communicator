// =============================================================================
// Module: sql.bicep
// Purpose: Azure SQL Server (Entra ID-only auth) + Serverless database
// =============================================================================

@description('Azure region for the resources.')
param location string

@description('Standard resource tags to apply.')
param tags object

@description('Base name used to derive the resource name.')
param appName string

@description('Environment label (e.g. dev, prod).')
param environmentName string

@description('Unique suffix for globally unique resource names.')
param uniqueSuffix string

@description('Object ID of the Entra ID principal that will be set as AD admin (managed identity principal ID).')
param sqlAdminObjectId string

@description('Display name for the Entra ID SQL admin (used in the AD admin record).')
param sqlAdminDisplayName string = 'cc-mi-sqladmin'

// ---------------------------------------------------------------------------
// SQL Server
// ---------------------------------------------------------------------------

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: 'sql-${appName}-${environmentName}-${uniqueSuffix}'
  location: location
  tags: tags
  properties: {
    // Entra ID-only authentication; no SQL login/password
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'Application'   // Managed identity is a service principal
      login: sqlAdminDisplayName
      sid: sqlAdminObjectId
      tenantId: tenant().tenantId
      azureADOnlyAuthentication: true
    }
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'  // Restricted to Azure services via firewall rule below
  }
}

// ---------------------------------------------------------------------------
// Firewall: Allow Azure Services
// Enables other Azure resources (Functions, Web App) to connect without
// explicit IP listing. Pair with Managed Identity for zero-secret access.
// ---------------------------------------------------------------------------

resource firewallAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// ---------------------------------------------------------------------------
// Database: Serverless General Purpose Gen5 2vCore
// ---------------------------------------------------------------------------

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'db-${appName}-${environmentName}'
  location: location
  tags: tags
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 34359738368     // 32 GB
    autoPauseDelay: 60            // minutes; -1 = disabled
    // minCapacity is a decimal (0.5 vCores minimum). The ARM API accepts a
    // JSON number for this property despite the Bicep type stub showing 'int'.
    // We pass it as a string literal; ARM serialises it correctly.
    #disable-next-line BCP036
    minCapacity: '0.5'
    requestedBackupStorageRedundancy: 'Local'
    zoneRedundant: false
    readScale: 'Disabled'
    highAvailabilityReplicaCount: 0
  }
}

// ---------------------------------------------------------------------------
// Short-term backup retention: 14 days (PITR)
// ---------------------------------------------------------------------------

resource backupRetention 'Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies@2023-08-01-preview' = {
  parent: sqlDatabase
  name: 'default'
  properties: {
    retentionDays: 14
    diffBackupIntervalInHours: 12
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Fully qualified domain name of the SQL Server.')
output serverFqdn string = sqlServer.properties.fullyQualifiedDomainName

@description('SQL Server resource name.')
output serverName string = sqlServer.name

@description('Database resource name.')
output databaseName string = sqlDatabase.name

@description('Resource ID of the SQL Server.')
output serverId string = sqlServer.id

@description('Resource ID of the SQL database.')
output databaseId string = sqlDatabase.id

@description('Connection string pattern using Active Directory Default (managed identity) authentication.')
output connectionStringPattern string = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabase.name};Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;Authentication=Active Directory Default;'
