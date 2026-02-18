# Company Communicator v2 - Operations and Monitoring Guide

This guide covers the day-to-day operational aspects of running Company Communicator v2 in production, including monitoring, alerting, troubleshooting, scaling, and disaster recovery.

---

## Table of Contents

1. [Monitoring Overview](#monitoring-overview)
2. [Application Insights Dashboard](#application-insights-dashboard)
3. [Log Analytics Queries](#log-analytics-queries)
4. [Alerting](#alerting)
5. [Dead Letter Queue Management](#dead-letter-queue-management)
6. [Database Maintenance](#database-maintenance)
7. [Scaling](#scaling)
8. [Cost Management](#cost-management)
9. [Deploying Updates](#deploying-updates)
10. [Disaster Recovery](#disaster-recovery)
11. [Common Operational Scenarios](#common-operational-scenarios)

---

## Monitoring Overview

Company Communicator has built-in observability across three layers:

### 1. Application Insights (APM)

**What it tracks**:
- HTTP request/response metrics (latency, status codes, throughput)
- Dependency calls (SQL, Service Bus, Graph, Blob)
- Custom events (notification sent, sync started, delivery completed)
- Exceptions and stack traces
- User sessions and page views (frontend)
- Performance counter data (CPU, memory, disk)

**Access**: Azure Portal > Application Insights > `app-ins-cc-{env}`

### 2. Log Analytics (Diagnostics)

**What it collects**:
- SQL Database query performance, deadlocks, throttling
- Service Bus message processing, DLQ activity
- Key Vault access audit logs
- Storage Account operations
- App Service HTTP access logs
- Function execution duration and errors

**Access**: Azure Portal > Log Analytics workspace > `log-cc-{env}`

### 3. Azure Monitor Alerts

**What it notifies**:
- Service Bus DLQ messages (indicator of delivery failures)
- SQL Database high DTU/CPU
- App Service HTTP 5xx errors
- Function App errors and timeouts
- Key Vault access anomalies

**Access**: Azure Portal > Monitor > Alerts or GitHub Environment Secrets

---

## Application Insights Dashboard

### Creating a Custom Dashboard

1. Navigate to Azure Portal > Application Insights > `app-ins-cc-{env}`

2. Click **Workbooks** > **+ New** to create a custom workbook

3. Add tiles for key metrics:

#### Tile 1: Notification Send Success Rate

```kusto
customEvents
| where name == "NotificationSent"
| where timestamp > ago(24h)
| summarize TotalSent = count(),
            Succeeded = sum(tolong(customDimensions["succeeded"])),
            Failed = sum(tolong(customDimensions["failed"]))
| project SuccessRate = (Succeeded * 100.0 / TotalSent)
```

#### Tile 2: API Response Time (P95)

```kusto
requests
| where timestamp > ago(1h)
| where name !startswith "GET /health"
| summarize P95 = percentile(duration, 95) by name
| order by P95 desc
| take 10
```

#### Tile 3: Service Bus Message Processing

```kusto
ServiceBusDeadLetterMessage_CL
| where TimeGenerated > ago(24h)
| summarize DLQCount = count() by QueueName_s
```

#### Tile 4: SQL Database DTU Usage

```kusto
AzureDiagnostics
| where ResourceType == "DATABASES"
| where MetricName == "dtu_consumption_percent"
| summarize AvgDTU = avg(todouble(MetricValue)),
            MaxDTU = max(todouble(MetricValue))
            by bin(TimeGenerated, 15m)
```

### Key Metrics to Monitor

| Metric | Target | Alert Threshold | Action |
|--------|--------|-----------------|--------|
| **API P95 latency** | < 500 ms | > 2,000 ms | Check SQL/Graph latency |
| **API 5xx error rate** | < 0.1% | > 1% | Review logs, restart if needed |
| **Service Bus DLQ** | 0 | > 0 | Manual review, possible requeue |
| **SQL DTU usage** | < 60% | > 80% | Scale up or optimize queries |
| **Function duration** | < 10 sec (send), < 60 sec (prep) | > 30 sec | Check Service Bus, SQL |
| **Notification delivery rate** | > 95% | < 90% | Check DLQ, Service Bus throttle |
| **Graph API errors** | < 1% | > 5% | Check Graph API status, retry strategy |

---

## Log Analytics Queries

Save these queries as **Saved Searches** for quick access.

### 1. API Errors Last 24 Hours

```kusto
requests
| where timestamp > ago(24h)
| where resultCode >= 400
| summarize ErrorCount = count(),
            AvgDuration = avg(duration),
            Errors = make_set(resultCode)
            by name, resultCode
| order by ErrorCount desc
```

**Use**: Identify which API endpoints are failing.

### 2. Service Bus Message Latency

```kusto
ServiceBusMessages_CL
| where TimeGenerated > ago(6h)
| where MessageStatus_s == "DeliveryTimeout" or MessageStatus_s == "Abandoned"
| summarize TimeoutCount = count(),
            AvgLatency = avg(todouble(Duration_s))
            by QueueName_s
```

**Use**: Detect if messages are timing out in queues (may indicate Function App is too slow).

### 3. Graph API Throttle Events

```kusto
dependencies
| where name startswith "GET /v1.0/users"
| where resultCode == "429"
| summarize ThrottleCount = count(),
            ThrottleDuration = max(duration)
            by bin(timestamp, 1m)
| order by timestamp desc
```

**Use**: Detect if Graph API calls are being throttled (usually means syncing too many users at once).

### 4. SQL Slow Queries

```kusto
AzureDiagnostics
| where ResourceType == "DATABASES"
| where Category == "QueryStoreRuntimeStatistics"
| where todouble(total_time_ms) > 5000
| project TimeGenerated,
          QueryText = query_text_s,
          TotalTime = total_time_ms,
          AvgDuration = avg_duration_ms,
          ExecutionCount = execution_count_d
| order by TimeGenerated desc
| take 20
```

**Use**: Identify slow-running queries impacting send performance.

### 5. Function App Timeouts

```kusto
traces
| where timestamp > ago(24h)
| where severityLevel >= 2  // Warnings and errors
| where message contains "timeout" or message contains "exceeded"
| summarize TimeoutCount = count(),
            Examples = make_set(message)
            by cloud_RoleName  // Function app name
```

**Use**: Detect if Prep or Send Function are timing out on tasks.

### 6. Key Vault Access Anomalies

```kusto
AzureDiagnostics
| where ResourceType == "VAULTS"
| where OperationName == "VaultGet" and ResultSignature == "Unauthorized"
| summarize UnauthorizedCount = count(),
            CallerIPs = make_set(CallerIPAddress_s)
            by identity_claim_oid_g
| order by UnauthorizedCount desc
```

**Use**: Detect if someone/something is trying to access secrets without permission.

### 7. Daily Delivery Summary

```kusto
customEvents
| where name == "NotificationDeliveryCompleted"
| where timestamp > ago(1d)
| summarize TotalNotifications = dcount(customDimensions["notificationId"]),
            TotalRecipients = sum(todolong(customDimensions["recipientCount"])),
            SucceededDeliveries = sum(todolong(customDimensions["succeededCount"])),
            FailedDeliveries = sum(todolong(customDimensions["failedCount"])),
            SuccessRate = (sum(todolong(customDimensions["succeededCount"])) * 100.0 / sum(todolong(customDimensions["recipientCount"])))
| project TotalNotifications, TotalRecipients, SucceededDeliveries, FailedDeliveries, ["Success Rate %"] = SuccessRate
```

**Use**: Daily operational summary (run this weekly to check health).

---

## Alerting

### Configured Alerts (via Bicep)

The infrastructure deploys alerts with an Action Group configured for email and Teams webhook.

| Alert | Metric | Threshold | Severity |
|-------|--------|-----------|----------|
| **DLQ Messages** | `ServiceBusDeadLetterMessage_CL` | > 0 | Critical |
| **SQL DTU** | `dtu_consumption_percent` | > 80% | High |
| **API 5xx** | HTTP 500+ errors | > 1% error rate | High |
| **Function errors** | Function invocation failures | > 5 consecutive failures | High |

### Action Group Configuration

Verify the Action Group was created:

```bash
az monitor action-group show \
  --resource-group rg-cc-prod \
  --name "ag-cc-prod"
```

**Actions configured**:
- **Email**: Ops team email address (from `alertEmailAddress` parameter)
- **Teams webhook**: Posts to a channel (optional, configure in Bicep)

### Adding Custom Alerts

To create additional alerts via Azure CLI:

```bash
# Alert on notification send failures
az monitor metrics alert create \
  --name "cc-send-failures-alert" \
  --resource-group rg-cc-prod \
  --scopes "/subscriptions/.../{resource-id}" \
  --condition "avg customMetric.SendFailures > 5" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --action "ag-cc-prod"
```

---

## Dead Letter Queue Management

DLQ messages indicate delivery failures. Investigate and possibly requeue them.

### 1. Check DLQ Status

```bash
# List messages in the Service Bus DLQ
az servicebus queue peek-message \
  --resource-group rg-cc-prod \
  --namespace-name sb-cc-prod-<suffix> \
  --queue-name cc-send \
  --from-sequence-number 0
```

Or use the Azure Portal: Service Bus > Queues > cc-send > Dead Letter Messages

### 2. Inspect a Message

```bash
# Get details of a DLQ message
az servicebus queue receive-message \
  --resource-group rg-cc-prod \
  --namespace-name sb-cc-prod-<suffix> \
  --queue-name cc-send \
  --dead-letter
```

The message body will show what failed:

```json
{
  "NotificationId": "...",
  "RecipientIds": ["user1", "user2"],
  "ConversationIds": ["conv1", "conv2"]
}
```

### 3. Diagnose the Issue

Common DLQ causes:

| Reason | Diagnosis | Resolution |
|--------|-----------|-----------|
| **Invalid recipient ID** | User removed from Entra ID | Skip recipient (update SentNotifications status to "Skipped") |
| **Conversation expired** | 1:1 chat deleted | Re-create conversation (run Prep Function again) |
| **Bot not responding** | Bot endpoint misconfigured or bot service down | Check bot service, restart Function App |
| **Teams service throttled** | Too many messages in short time | Add delay between sends, or spread over more time |
| **Graph sync failed** | User list out of date | Re-run sync activity |

### 4. Requeue a Message

To resend a DLQ message (after fixing the issue):

```bash
# Extract message from DLQ and send to main queue
az servicebus queue receive-message \
  --resource-group rg-cc-prod \
  --namespace-name sb-cc-prod-<suffix> \
  --queue-name cc-send \
  --dead-letter \
  --skip 0 \
  > dlq-message.json

# Send back to main queue
az servicebus queue send-message \
  --resource-group rg-cc-prod \
  --namespace-name sb-cc-prod-<suffix> \
  --queue-name cc-send \
  --message-body "$(cat dlq-message.json)"
```

---

## Database Maintenance

### 1. Monitor Database Size and Performance

```bash
# Check current database stats
az sql db show \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --name CompanyCommunicator \
  --query '{Size: maxSizeBytes, Status: status, DTU: edition}'
```

### 2. Run Index Maintenance

EF Core doesn't automatically rebuild indexes. Periodically rebuild them:

```bash
# Connect to database (requires Entra ID auth)
sqlcmd -S sql-cc-prod-<suffix>.database.windows.net \
  -U "your-aad-user@company.onmicrosoft.com" \
  -A

# In SSMS or Azure Data Studio, run:
ALTER INDEX IX_SentNotifications_NotificationId_DeliveryStatus
  ON SentNotifications
  REBUILD;

ALTER INDEX IX_NotificationAudiences_NotificationId
  ON NotificationAudiences
  REBUILD;
```

Or create a Function App timer trigger to automate this weekly.

### 3. Update Statistics

Statistics help the query optimizer choose efficient execution plans:

```sql
UPDATE STATISTICS Notifications;
UPDATE STATISTICS SentNotifications;
UPDATE STATISTICS Users;
UPDATE STATISTICS Teams;
```

### 4. Truncate Archived SentNotifications

Once SentNotifications older than 90 days are exported to blob storage, safely delete them:

```bash
# Backup first by running the archive Function
az functionapp timer-trigger ...

# Then delete
az sql db execute-sql \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --database CompanyCommunicator \
  --command "DELETE FROM SentNotifications WHERE SentDate < DATEADD(day, -90, GETUTCDATE())"
```

### 5. Enable Automatic Tuning (Optional)

Azure SQL can automatically tune indexes and execution plans:

```bash
az sql server elastic-pool operation list \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix>

# Enable automatic tuning
az sql server elastic-pool update \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --elastic-pool-name mypool \
  --automatic-tuning-options CreateIndex=On
```

### 6. Point-In-Time Restore (PITR) Backups

SQL automatically takes backups. To restore from a point in time:

```bash
# List available restore points
az sql db list-restore-points \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --database CompanyCommunicator

# Restore to a specific time
az sql db restore \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --name CompanyCommunicator-restored \
  --restore-point-in-time "2025-02-17T14:30:00Z" \
  --edition Standard \
  --service-objective S0
```

---

## Scaling

### 1. App Service Plan (Web App + Prep Function)

Monitor CPU and memory; scale up if consistently > 70%:

```bash
# Check current metrics
az monitor metrics list \
  --resource-group rg-cc-prod \
  --resource app-cc-prod-<suffix> \
  --metric "CpuPercentage" \
  --interval PT1M \
  --start-time "2025-02-16T00:00:00Z" \
  --end-time "2025-02-17T00:00:00Z" \
  --aggregation "Average"

# Scale up from S1 to S2
az appservice plan update \
  --resource-group rg-cc-prod \
  --name asp-cc-prod \
  --sku S2

# Scale out (add instances): 1 -> 3
az appservice plan update \
  --resource-group rg-cc-prod \
  --name asp-cc-prod \
  --number-of-workers 3
```

### 2. Send Function App (Consumption Plan)

**Automatically scales**; no manual action needed.

> **Known behavior**: The Consumption plan scale controller may be slow to wake the function when using identity-based Service Bus connections. If messages accumulate in `cc-send` but the function shows no traces, force a cold start with `curl https://func-cc-send-<env>-<suffix>.azurewebsites.net/`. Consider Elastic Premium (EP1) if this occurs frequently.

If you hit timeout limits, check:

```bash
# Check concurrent sends (look for ThrottleState updates)
az sql db query \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --database CompanyCommunicator \
  --query-text "SELECT ConcurrentSends FROM ThrottleState"

# If ConcurrentSends is consistently high (> 100), increase Service Bus concurrency
az servicebus queue update \
  --resource-group rg-cc-prod \
  --namespace-name sb-cc-prod-<suffix> \
  --name cc-send \
  --max-delivery-count 20  # Increase retry attempts if timeouts
```

### 3. Azure SQL Database

Scale vCores if DTU usage > 80% sustained:

```bash
# Current SKU
az sql db show \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --name CompanyCommunicator \
  --query '{Sku: sku.name, Tier: sku.tier, Capacity: sku.capacity}'

# Scale up (Serverless 2vCore -> 4vCore)
az sql db update \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --name CompanyCommunicator \
  --capacity 4  # 2, 4, 6, 8, etc.
```

### 4. Service Bus

Standard tier doesn't auto-scale. If message throughput exceeds 1,000 msg/sec, migrate to Premium:

```bash
# Check namespace metrics
az monitor metrics list \
  --resource-group rg-cc-prod \
  --resource sb-cc-prod-<suffix> \
  --metric "IncomingMessages" \
  --interval PT15M

# Scale to Premium (one-time migration, not in-place)
# Create new Premium namespace and migrate queues
```

### 5. Auto-Scaling Rules (Optional)

Create auto-scale rules for App Service Plan:

```bash
az monitor autoscale-settings create \
  --resource-group rg-cc-prod \
  --name "autoscale-cc-prod" \
  --resource asp-cc-prod \
  --resource-type "Microsoft.Web/serverfarms" \
  --min-count 2 \
  --max-count 10 \
  --count 2
```

---

## Cost Management

### 1. Estimate Monthly Costs

| Resource | SKU | Est./Month |
|----------|-----|-----------|
| App Service Plan (S1) | 1 instance | $73 |
| Send Function (Consumption) | 1M executions | $2-5 |
| SQL Database (Serverless 2vCore) | Auto-pause 60 min | $150-180 |
| Service Bus (Standard) | 3 queues | $10 |
| Storage Account (100 GB) | LRS | $5-10 |
| Key Vault | Standard tier | $1-5 |
| App Insights | 5 GB free, overage | $0-5 |
| Bot Service | Standard (Free for Teams) | $0 |
| **Total** | | **~$240-285** |

### 2. Optimize Costs

| Action | Savings | Effort |
|--------|---------|--------|
| **Auto-pause SQL** (already enabled) | 40-50% SQL cost | Already configured |
| **Reserved instances** (Web App) | 20-35% | 1-3 year commitment |
| **Consolidate Function Apps** | 10% | Refactor (not recommended) |
| **Archive old export files** | 5-10% | Add blob archive policy |
| **Monitor unused resources** | 5-10% | Delete unused resources |
| **Reduce Log Analytics retention** | 5-10% | Trade compliance for cost |

### 3. Cost Alerts

Create alerts for unexpected cost spikes:

```bash
az costmanagement alert create \
  --alert-name "cc-prod-budget-alert" \
  --description "Alert if spending exceeds $350/month" \
  --scope "/subscriptions/..." \
  --threshold 350 \
  --threshold-type "Forecasted"
```

---

## Deploying Updates

### 1. Deployment Steps

#### Via GitHub Actions (Recommended)

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make code changes, commit, and push
3. Create a pull request and wait for CI to pass
4. After code review, merge to `main`
5. GitHub Actions auto-deploys to `dev` after successful build
6. For `stg` and `prod`, go to Actions > Deploy Application > Run workflow

#### Manual Deployment

```bash
# Build
dotnet build CompanyCommunicator.sln -c Release

# Publish
dotnet publish src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj \
  -c Release -o ./publish/api

# Package and deploy
cd publish/api && zip -r ../../api.zip . && cd ../..
az webapp deployment source config-zip \
  --resource-group rg-cc-prod \
  --name app-cc-prod-<suffix> \
  --src api.zip
```

### 2. Deployment Validation

After each deployment, verify health:

```bash
# Health endpoint (requires auth)
curl -k https://app-cc-prod-<suffix>.azurewebsites.net/health/ready

# Check Application Insights for errors
az monitor metrics list \
  --resource-group rg-cc-prod \
  --resource app-insights-cc-prod \
  --metric "FailedRequests" \
  --interval PT5M

# Check logs for exceptions
az webapp log stream \
  --resource-group rg-cc-prod \
  --name app-cc-prod-<suffix>
```

### 3. Rollback Procedure

If a deployment causes issues:

```bash
# Web App: Auto-swap feature rolls back to previous version
az webapp deployment slot swap \
  --resource-group rg-cc-prod \
  --name app-cc-prod-<suffix> \
  --slot staging

# If no staging slot, redeploy previous release:
git checkout <previous-commit>
dotnet publish ... && az webapp deployment source config-zip ...
```

### 4. Zero-Downtime Deployments

Implement staging slots for zero-downtime deploys:

```bash
# Create staging slot
az webapp deployment slot create \
  --resource-group rg-cc-prod \
  --name app-cc-prod-<suffix> \
  --slot staging

# Deploy to staging, test, then swap
az webapp deployment source config-zip \
  --resource-group rg-cc-prod \
  --name app-cc-prod-<suffix> \
  --slot staging \
  --src api.zip

# After testing, swap to production
az webapp deployment slot swap \
  --resource-group rg-cc-prod \
  --name app-cc-prod-<suffix> \
  --slot staging
```

---

## Disaster Recovery

### 1. Backup Strategy

| Component | Backup | Recovery RTO |
|-----------|--------|------------|
| **SQL Database** | Automatic PITR (14-35 days) | < 15 min |
| **Configuration** | Bicep templates + Bicep params | < 1 hour |
| **Code** | GitHub repository | < 1 hour |
| **Blobs** | Storage redundancy (LRS) | < 1 hour (re-upload) |
| **Key Vault** | Managed by Azure | < 1 hour |

### 2. SQL Database Recovery

If the database is corrupted or accidentally deleted:

```bash
# List restore points
az sql db restore-point list \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --database CompanyCommunicator

# Restore to a specific point in time
az sql db restore \
  --resource-group rg-cc-prod \
  --server sql-cc-prod-<suffix> \
  --name CompanyCommunicator \
  --restore-point-in-time "2025-02-17T12:00:00Z"
```

### 3. Infrastructure Recovery

If Azure resources are accidentally deleted:

```bash
# Redeploy infrastructure from Bicep
az deployment group create \
  --resource-group rg-cc-prod \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam \
    environmentName=prod \
    alertEmailAddress="..." \
    botAppId="..."

# Redeploy application code
az webapp deployment source config-zip \
  --resource-group rg-cc-prod \
  --name app-cc-prod-<suffix> \
  --src api.zip

# Run migrations
dotnet ef database update \
  --project src/CompanyCommunicator.Core \
  --startup-project src/CompanyCommunicator.Api
```

### 4. Multi-Region Deployment (Optional)

For high availability, deploy to a secondary region:

1. Create resources in secondary region (e.g., `rg-cc-prod-secondary` in `westus2`)
2. Deploy infrastructure and app code
3. Set up SQL replication (geo-replication)
4. Use Azure Traffic Manager to route users to nearest region
5. Document failover procedure

---

## Common Operational Scenarios

### Scenario 1: Notification Stuck in "Sending" State

**Symptom**: A notification shows status "Sending" for > 2 hours with no progress.

**Diagnosis**:
```kusto
// Check if orchestration is still running
customEvents
| where name == "PrepareToSendOrchestrator"
| where customDimensions["notificationId"] == "<notification-id>"
| order by timestamp desc
| take 1
```

**Resolution**:
1. If orchestration shows no updates for > 24 hours, it's stuck
2. Manually update the notification status:
   ```bash
   az sql db query ... \
     --query-text "UPDATE Notifications SET Status='Failed' WHERE Id='...'"
   ```
3. Document the issue for investigation
4. Consider restarting the Prep Function App (Durable Functions replays and detects stuck state)

### Scenario 2: Users Not Receiving Notifications

**Symptom**: Notification sent, but recipients don't see messages in Teams.

**Diagnosis**:
```kusto
// Check delivery status
SentNotifications
| where NotificationId == "<notification-id>"
| summarize SuccessCount = sum(DeliveryStatus == "Succeeded"),
            FailureCount = sum(DeliveryStatus == "Failed"),
            NotFoundCount = sum(DeliveryStatus == "RecipientNotFound")
```

**Resolution**:
1. If `NotFoundCount` is high: User list is out of date; trigger manual sync
2. If `FailureCount` is high: Check DLQ for specific errors
3. If `SuccessCount` is low: Check bot messaging endpoint and Service Bus throttle
4. Check recipient's Teams client: May need restart or clear cache

### Scenario 3: Service Bus Queue Backing Up

**Symptom**: Service Bus queue shows > 1,000 messages, sends aren't completing.

**Diagnosis**:
```bash
# Check queue depth
az servicebus queue show \
  --resource-group rg-cc-prod \
  --namespace-name sb-cc-prod-<suffix> \
  --name cc-send \
  --query 'countDetails.activeMessageCount'
```

**Resolution**:
1. Check Send Function App logs for errors
2. If Function App is failing, fix the issue and restart
3. If Function App is too slow, scale up SQL or graph calls
4. If messages are valid but slowly processing, increase Send Function concurrency:
   ```bash
   az functionapp config appsettings set \
     --resource-group rg-cc-prod \
     --name func-cc-send-prod-<suffix> \
     --settings "FUNCTIONS_WORKER_PROCESS_COUNT=4"
   ```

### Scenario 4: SQL Database DTU Spike

**Symptom**: SQL Database DTU usage suddenly jumps to 100%.

**Diagnosis**:
```kusto
// Find slow queries
AzureDiagnostics
| where ResourceType == "DATABASES"
| where total_time_ms > 1000
| summarize SlowQueryCount = count(),
            AvgTime = avg(total_time_ms)
            by query_text_s
| order by SlowQueryCount desc
```

**Resolution**:
1. Identify the slow query (usually aggregation query for status counts)
2. Scale up SQL (Serverless 2vCore → 4vCore)
3. Check if indexes need rebuilding
4. Review query optimization (add covering index if needed)

### Scenario 5: Key Vault Unauthorized Errors

**Symptom**: Logs show "Access Denied" when accessing Key Vault secrets.

**Diagnosis**:
```bash
# Verify managed identity has Key Vault permissions
az keyvault show-deleted \
  --resource-group rg-cc-prod \
  --name kv-cc-prod-<suffix>
```

**Resolution**:
1. Grant managed identity Key Vault access:
   ```bash
   az keyvault set-policy \
     --name kv-cc-prod-<suffix> \
     --object-id <managed-identity-object-id> \
     --secret-permissions get list
   ```
2. Restart affected Function or Web App to pick up new permissions
3. Verify in Access policies: Key Vault > Access policies > Check managed identity is listed

---

## Support and Escalation

### When to Contact Support

- **Microsoft Graph API issues**: Check [status.office.com](https://status.office.com)
- **Azure service outages**: Check [status.azure.com](https://status.azure.com)
- **Teams bot connectivity**: Check Teams developer forums and GitHub issues
- **SQL Database performance**: Microsoft Premier Support (if applicable)
- **Licensing issues**: Contact Microsoft 365 admin center support

### Internal Escalation Path

1. **On-call engineer**: Receives alert, acknowledges in incident system
2. **Ops team**: Gathers logs, checks recent changes
3. **Engineering team**: If root cause requires code change or deeper investigation
4. **Leadership**: If service down for > 2 hours or widespread impact

### Runbooks

Document these as separate internal wiki pages:

- `runbook-dlq-message-recovery.md` – How to recover DLQ messages
- `runbook-database-failover.md` – How to fail over to backup database
- `runbook-function-app-restart.md` – How to safely restart Function Apps
- `runbook-incident-response.md` – Steps for major incidents

---

## Additional Resources

- [Azure SQL Database Monitoring](https://learn.microsoft.com/en-us/azure/azure-sql/database/monitoring-sql-database-azure-monitor)
- [Application Insights for ASP.NET Core](https://learn.microsoft.com/en-us/azure/azure-monitor/app/asp-net-core)
- [Service Bus Troubleshooting](https://learn.microsoft.com/en-us/azure/service-bus-messaging/service-bus-troubleshooting-guide)
- [Azure Durable Functions Diagnostics](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-diagnostics)
- [Azure Monitor Alerts Best Practices](https://learn.microsoft.com/en-us/azure/azure-monitor/alerts/alerts-best-practices)
