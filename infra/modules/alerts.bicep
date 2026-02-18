// =============================================================================
// Module: alerts.bicep
// Purpose: Action Group + metric alert rules for operational health monitoring
// =============================================================================

@description('Standard resource tags to apply.')
param tags object

@description('Base name used to derive resource names.')
param appName string

@description('Environment label (e.g. dev, prod).')
param environmentName string

@description('Email address to notify on alert activation.')
param alertEmailAddress string

@description('Resource ID of the Service Bus namespace.')
param serviceBusNamespaceId string

@description('Resource ID of the SQL Database.')
param sqlDatabaseId string

@description('Resource ID of the Web App.')
param webAppId string

@description('Resource ID of the Prep Function App.')
param functionAppPrepId string

// ---------------------------------------------------------------------------
// Action Group
// ---------------------------------------------------------------------------

resource actionGroup 'Microsoft.Insights/actionGroups@2023-09-01-preview' = {
  name: 'ag-${appName}-${environmentName}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'CC-Alerts'
    enabled: true
    emailReceivers: [
      {
        name: 'OpsEmailReceiver'
        emailAddress: alertEmailAddress
        useCommonAlertSchema: true
      }
    ]
    // Placeholder Teams webhook – update with actual webhook URL after deployment
    webhookReceivers: []
    armRoleReceivers: []
    itsmReceivers: []
    azureFunctionReceivers: []
    logicAppReceivers: []
    automationRunbookReceivers: []
    voiceReceivers: []
    smsReceivers: []
    eventHubReceivers: []
  }
}

// ---------------------------------------------------------------------------
// Alert 1: Dead-letter Queue messages
// Triggers when any DLQ in the Service Bus namespace has > 0 messages
// Severity 1 (Critical) – messages in DLQ mean delivery failures
// ---------------------------------------------------------------------------

resource alertDlq 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-${appName}-dlq-${environmentName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'Dead-lettered messages detected in Service Bus. Check queue DLQs for failed deliveries.'
    severity: 1
    enabled: true
    scopes: [
      serviceBusNamespaceId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'DeadLetteredMessagesThreshold'
          criterionType: 'StaticThresholdCriterion'
          metricNamespace: 'Microsoft.ServiceBus/namespaces'
          metricName: 'DeadletteredMessages'
          operator: 'GreaterThan'
          threshold: 0
          aggregation: 'Maximum'
          timeAggregation: 'Maximum'
        }
      ]
    }
    autoMitigate: true
    actions: [
      {
        actionGroupId: actionGroup.id
        webHookProperties: {}
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Alert 2: SQL CPU high
// Triggers when SQL serverless instance CPU > 80% sustained over 15 minutes
// Severity 2 (Warning) – may indicate query performance issues
// ---------------------------------------------------------------------------

resource alertSqlCpu 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-${appName}-sql-cpu-${environmentName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'SQL Database CPU utilization exceeded 80% over 15 minutes. Review active queries and consider scaling.'
    severity: 2
    enabled: true
    scopes: [
      sqlDatabaseId
    ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'SqlCpuThreshold'
          criterionType: 'StaticThresholdCriterion'
          metricNamespace: 'Microsoft.Sql/servers/databases'
          metricName: 'cpu_percent'
          operator: 'GreaterThan'
          threshold: 80
          aggregation: 'Average'
          timeAggregation: 'Average'
        }
      ]
    }
    autoMitigate: true
    actions: [
      {
        actionGroupId: actionGroup.id
        webHookProperties: {}
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Alert 3: HTTP 5xx error rate on Web App
// Triggers when Http5xx count > 10 in a 5-minute window
// Severity 1 (Critical) – API/bot endpoint failures affecting users
// ---------------------------------------------------------------------------

resource alertHttpErrors 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-${appName}-http5xx-${environmentName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'Web App is returning elevated HTTP 5xx errors. Investigate app logs and health check endpoint.'
    severity: 1
    enabled: true
    scopes: [
      webAppId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Http5xxThreshold'
          criterionType: 'StaticThresholdCriterion'
          metricNamespace: 'Microsoft.Web/sites'
          metricName: 'Http5xx'
          operator: 'GreaterThan'
          threshold: 10
          aggregation: 'Total'
          timeAggregation: 'Total'
        }
      ]
    }
    autoMitigate: true
    actions: [
      {
        actionGroupId: actionGroup.id
        webHookProperties: {}
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Alert 4: Prep Function execution errors
// Triggers when FunctionExecutionErrors > 50 in a 5-minute window
// Severity 2 (Warning) – orchestration failures could stall broadcasts
// ---------------------------------------------------------------------------

resource alertFunctionErrors 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-${appName}-func-errors-${environmentName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'Prep Function App is reporting elevated execution errors. Investigate Durable Function orchestration failures.'
    severity: 2
    enabled: true
    scopes: [
      functionAppPrepId
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'FunctionErrorsThreshold'
          criterionType: 'StaticThresholdCriterion'
          metricNamespace: 'Microsoft.Web/sites'
          metricName: 'FunctionExecutionUnits'
          operator: 'GreaterThan'
          threshold: 50
          aggregation: 'Total'
          timeAggregation: 'Total'
        }
      ]
    }
    autoMitigate: true
    actions: [
      {
        actionGroupId: actionGroup.id
        webHookProperties: {}
      }
    ]
  }
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

@description('Resource ID of the Action Group.')
output actionGroupId string = actionGroup.id

@description('Name of the Action Group.')
output actionGroupName string = actionGroup.name
