// =============================================================================
// Module: diagnostics.bicep
// Purpose: Diagnostic settings routing platform logs/metrics to Log Analytics
//
// Bicep requires the 'scope' of a diagnostic setting to be a typed resource
// reference. We use 'existing' resource declarations so the compiler can
// resolve the correct resource type — no extra API calls are made because
// the ARM provider treats 'existing' as a read of already-deployed resources.
// =============================================================================

@description('Resource ID of the Log Analytics workspace (destination).')
param workspaceId string

@description('Name of the SQL Server (used to declare existing resource).')
param sqlServerName string

@description('Name of the SQL Database (used to declare existing resource).')
param sqlDatabaseName string

@description('Name of the Service Bus namespace (used to declare existing resource).')
param serviceBusNamespaceName string

@description('Name of the Key Vault (used to declare existing resource).')
param keyVaultName string

@description('Name of the Storage Account (used to declare existing resource).')
param storageAccountName string

@description('Name of the Web App (used to declare existing resource).')
param webAppName string

// ---------------------------------------------------------------------------
// Existing resource declarations (scope anchors for diagnostic settings)
// ---------------------------------------------------------------------------

resource sqlServerExisting 'Microsoft.Sql/servers@2023-08-01-preview' existing = {
  name: sqlServerName
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' existing = {
  parent: sqlServerExisting
  name: sqlDatabaseName
}

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' existing = {
  name: serviceBusNamespaceName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource storageBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: storageAccount
  name: 'default'
}

resource storageQueueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' existing = {
  parent: storageAccount
  name: 'default'
}

resource storageTableService 'Microsoft.Storage/storageAccounts/tableServices@2023-05-01' existing = {
  parent: storageAccount
  name: 'default'
}

resource webApp 'Microsoft.Web/sites@2023-12-01' existing = {
  name: webAppName
}

// ---------------------------------------------------------------------------
// SQL Database diagnostic settings
// ---------------------------------------------------------------------------

resource sqlDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-sql-database'
  scope: sqlDatabase
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'SQLSecurityAuditEvents'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
      {
        category: 'AutomaticTuning'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
      {
        category: 'QueryStoreRuntimeStatistics'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
      {
        category: 'Errors'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
    metrics: [
      {
        category: 'Basic'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
      {
        category: 'InstanceAndAppAdvanced'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// SQL Server audit settings
// Master audit for server-level security events
// ---------------------------------------------------------------------------

resource sqlServerAudit 'Microsoft.Sql/servers/auditingSettings@2023-08-01-preview' = {
  parent: sqlServerExisting
  name: 'default'
  properties: {
    state: 'Enabled'
    isAzureMonitorTargetEnabled: true
    auditActionsAndGroups: [
      'SUCCESSFUL_DATABASE_AUTHENTICATION_GROUP'
      'FAILED_DATABASE_AUTHENTICATION_GROUP'
      'BATCH_COMPLETED_GROUP'
    ]
    retentionDays: 0
  }
}

// ---------------------------------------------------------------------------
// Service Bus diagnostic settings
// ---------------------------------------------------------------------------

resource serviceBusDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-servicebus'
  scope: serviceBusNamespace
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'OperationalLogs'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Key Vault diagnostic settings
// ---------------------------------------------------------------------------

resource keyVaultDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-keyvault'
  scope: keyVault
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'AuditEvent'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Storage Account – Blob service metrics
// ---------------------------------------------------------------------------

resource storageBlobDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-storage-blob'
  scope: storageBlobService
  properties: {
    workspaceId: workspaceId
    metrics: [
      {
        category: 'Transaction'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Storage Account – Queue service metrics
// ---------------------------------------------------------------------------

resource storageQueueDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-storage-queue'
  scope: storageQueueService
  properties: {
    workspaceId: workspaceId
    metrics: [
      {
        category: 'Transaction'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Storage Account – Table service metrics
// ---------------------------------------------------------------------------

resource storageTableDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-storage-table'
  scope: storageTableService
  properties: {
    workspaceId: workspaceId
    metrics: [
      {
        category: 'Transaction'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Web App diagnostic settings
// ---------------------------------------------------------------------------

resource webAppDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'diag-webapp'
  scope: webApp
  properties: {
    workspaceId: workspaceId
    logs: [
      {
        category: 'AppServiceHTTPLogs'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
      {
        category: 'AppServiceConsoleLogs'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
      {
        category: 'AppServiceAppLogs'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
        retentionPolicy: {
          enabled: false
          days: 0
        }
      }
    ]
  }
}
