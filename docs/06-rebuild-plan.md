# Company Communicator v2 - Clean-Room Rebuild Plan

## Context

Microsoft's Company Communicator Teams app is severely outdated (42 identified issues, 7 critical). The Bot Framework SDK reached **end-of-life on January 5, 2026**, and multi-tenant bot creation was **deprecated after July 31, 2025**. Rather than patching 10-year-old ARM templates and dead SDKs, we're rebuilding from scratch using modern tooling while preserving the proven architectural patterns (Durable Functions orchestration, Service Bus queuing, event-driven delivery).

**User choices:** Commercial Azure only, Bicep IaC, Azure SQL + EF Core, React + Vite + Fluent UI v9.

---

## Technology Stack

| Layer | Old | New |
|-------|-----|-----|
| Runtime | .NET 6 (EOL) | **.NET 8 LTS** |
| Bot SDK | Bot Framework v4 (EOL Jan 2026) | **Microsoft 365 Agents SDK** (`Microsoft.Agents.*`) |
| Bot Type | Multi-tenant, 3 AAD app registrations | **Single-tenant, 1 Entra ID app registration** |
| Graph | Microsoft.Graph v3 | **Microsoft.Graph v5** (Kiota request builders) |
| Data | Azure Table Storage (Cosmos.Table v1, deprecated) | **Azure SQL + EF Core 8** (Serverless GP Gen5 2vCore) |
| Functions | In-process model (.NET 6) | **Isolated worker model (.NET 8)** |
| Durable Functions | `Microsoft.Azure.WebJobs.Extensions.DurableTask` | **`Microsoft.DurableTask`** (isolated worker APIs) |
| Resilience | Polly 7 `IAsyncPolicy` | **Polly 8 `ResiliencePipeline`** via `Microsoft.Extensions.Resilience` |
| Serialization | Newtonsoft.Json | **System.Text.Json** |
| IaC | ARM JSON (1,349 lines, 2015-era APIs) | **Bicep modules** |
| Frontend | React 18 + CRA + TypeScript 3.9 + Fluent v8/v9 + Redux | **React 19 + Vite + TypeScript 5.x + Fluent v9 + TanStack Query** |
| Auth (frontend) | Custom fetch with Teams SDK token | **Teams SSO** (`authentication.getAuthToken()` + backend OBO exchange) |
| Forms | Raw state management | **react-hook-form 7.x** + `@hookform/resolvers` 3.x + Zod |
| Dates | Moment.js (maintenance-only) | **date-fns** |
| CI/CD | Azure Pipelines + Kudu | **GitHub Actions** (with Dependabot + `dotnet list package --vulnerable` + `npm audit`) |
| Teams Manifest | Schema v1.5 | **Schema v1.17+** |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Microsoft Teams                        │
│  ┌──────────────┐              ┌───────────────────────┐ │
│  │ Author Tab   │              │ User Bot (notif-only) │ │
│  │ (React SPA)  │              │                       │ │
│  └──────┬───────┘              └──────────▲────────────┘ │
└─────────┼─────────────────────────────────┼──────────────┘
          │ Teams SSO token                 │
┌─────────▼─────────────────────────────────┼──────────────┐
│        ASP.NET Core 8 Web App (.NET 8)                   │
│  ┌──────────────┐    ┌────────────────────────────┐      │
│  │ REST API     │    │ Agent Endpoint             │      │
│  │ Controllers  │    │ /api/messages              │      │
│  │ + Rate Limit │    │ (M365 Agents SDK)          │      │
│  │ + CSP Headers│    │                            │      │
│  └──────┬───────┘    └─────────┬──────────────────┘      │
│         │                      │                         │
│  ┌──────▼──────────────────────▼─────────────────┐       │
│  │  Core Library: EF Core, Graph v5, Services    │       │
│  └──────┬──────────────────────────────────────┬─┘       │
└─────────┼──────────────────────────────────────┼─────────┘
          │                                      │
  ┌───────▼────────┐                    ┌────────▼────────┐
  │  Service Bus   │                    │   Azure SQL     │
  │  (Standard)    │                    │  Serverless GP  │
  │  3 Queues      │                    │  Gen5 2vCore    │
  └──┬─────────┬───┘                    └─────────────────┘
     │         │
┌────▼────┐ ┌──▼──────┐    Also:
│Prep+Data│ │  Send   │    - Blob Storage (images, cards)
│Func App │ │Func App │    - Key Vault (secrets)
│(Durable)│ │(Consump)│    - App Insights (telemetry)
│ ASP S1  │ │  Plan   │    - Managed Identity (RBAC)
└─────────┘ └─────────┘    - Log Analytics (diagnostics)
```

### Key Simplifications from Original
- **3 app registrations -> 1** (single-tenant Entra ID)
- **2 bot handlers -> 1** (`CommunicatorActivityHandler` distinguishes by conversation type; includes `OnTeamsFileConsentAcceptAsync` override for file uploads)
- **2 Teams manifests -> 1** (single app with tab + personal bot scope)
- **3 Function Apps -> 2** (merge Data into Prep)
- **4 Service Bus queues -> 3** (eliminate data queue, use Durable Functions timer loop)
- **Table Storage workarounds eliminated** (proper relational schema)
- **Redux eliminated** (TanStack Query for server-state, no client-side store needed)
- **Send Function on independent Consumption plan** (auto-scales to hundreds of instances during large broadcasts without competing with Web App or Prep Function)

---

## Project Structure

```
CompanyCommunicator/
├── CompanyCommunicator.sln
├── src/
│   ├── CompanyCommunicator.Api/              # ASP.NET Core 8 Web App
│   │   ├── Program.cs                        # M365 Agents SDK + Identity + OBO + DI
│   │   ├── Controllers/
│   │   │   ├── NotificationsController.cs    # CRUD + send + schedule + cancel
│   │   │   ├── TeamsController.cs
│   │   │   ├── GroupsController.cs
│   │   │   ├── ExportsController.cs
│   │   │   └── HealthController.cs           # Authenticated; no internal detail exposure
│   │   ├── Bot/
│   │   │   ├── CommunicatorActivityHandler.cs  # Single unified handler
│   │   │   └── TenantFilterMiddleware.cs
│   │   ├── Authorization/
│   │   │   └── AuthorizationPolicies.cs      # Entra ID group-based (roles claims)
│   │   ├── Middleware/
│   │   │   └── SecurityHeadersMiddleware.cs  # CSP, X-Content-Type-Options, etc.
│   │   └── ClientApp/                        # React 19 + Vite SPA
│   │       ├── vite.config.ts
│   │       ├── package.json
│   │       └── src/
│   │           ├── main.tsx
│   │           ├── App.tsx
│   │           ├── api/                      # TanStack Query hooks
│   │           │   ├── client.ts             # fetch with Teams SSO token injection
│   │           │   ├── queryKeys.ts          # Hierarchical key factory
│   │           │   ├── notifications.ts
│   │           │   ├── teams.ts
│   │           │   ├── groups.ts
│   │           │   └── exports.ts
│   │           ├── components/               # Fluent UI v9 components
│   │           │   ├── Layout/               # Shell, header, error boundary
│   │           │   ├── NotificationForm/     # react-hook-form + Zod
│   │           │   ├── NotificationList/     # Draft, Sent, Scheduled tabs
│   │           │   ├── AudiencePicker/       # Team/Group/Roster/AllUsers selector
│   │           │   ├── AdaptiveCardPreview/  # ref + useEffect (no direct DOM)
│   │           │   ├── StatusView/           # Delivery status detail
│   │           │   └── ExportManager/        # Export status and download
│   │           ├── hooks/
│   │           │   ├── useTeamsContext.ts     # Teams SDK init + theme + locale
│   │           │   └── useAuth.ts            # Teams SSO (getAuthToken)
│   │           ├── lib/
│   │           │   ├── adaptiveCard.ts       # Card template builder
│   │           │   └── validators.ts         # Zod schemas
│   │           └── types/
│   │               └── index.ts              # TypeScript interfaces
│   │
│   ├── CompanyCommunicator.Core/             # Shared library (.NET 8)
│   │   ├── Data/
│   │   │   ├── AppDbContext.cs               # EF Core DbContext + EnableRetryOnFailure
│   │   │   ├── Entities/                     # Notification, SentNotification, User, Team, etc.
│   │   │   └── Migrations/
│   │   ├── Services/
│   │   │   ├── Graph/GraphService.cs         # MS Graph v5 (catch ODataError, handle 410)
│   │   │   ├── Queue/ServiceBusService.cs
│   │   │   ├── Blob/BlobStorageService.cs
│   │   │   ├── Bot/MessageSender.cs          # Proactive messaging
│   │   │   └── Recipients/RecipientService.cs
│   │   └── Models/                           # DTOs, queue message types
│   │
│   ├── CompanyCommunicator.Functions.Prep/   # Prep + Data Function App (isolated worker)
│   │   ├── Program.cs                        # UseDurableTask() registration
│   │   ├── Orchestrators/                    # TaskOrchestrationContext-based
│   │   ├── Activities/                       # Sync, send batch, create conversation, aggregate
│   │   └── Triggers/                         # Service Bus, timer triggers
│   │
│   └── CompanyCommunicator.Functions.Send/   # Send Function App (isolated worker, Consumption plan)
│       ├── Program.cs
│       ├── SendMessageFunction.cs
│       └── Services/ThrottleManager.cs       # Static ConcurrentDictionary (not IMemoryCache)
│
├── tests/
│   ├── CompanyCommunicator.Core.Tests/
│   ├── CompanyCommunicator.Api.Tests/
│   └── CompanyCommunicator.Functions.Tests/
│
├── infra/                                    # Bicep IaC
│   ├── main.bicep                            # Orchestrator + resource tags
│   ├── main.bicepparam
│   └── modules/
│       ├── managed-identity.bicep
│       ├── app-service.bicep                 # App Service Plan (S1) + Web App
│       ├── function-app-prep.bicep           # On shared App Service Plan
│       ├── function-app-send.bicep           # Consumption plan (independent scaling)
│       ├── sql.bicep                         # Serverless GP Gen5 2vCore + PITR + firewall
│       ├── service-bus.bicep                 # Standard tier + 3 queues + DLQ config + RBAC
│       ├── storage.bicep                     # Storage Account + full RBAC (Blob Owner, Queue, Table)
│       ├── key-vault.bicep                   # Key Vault with RBAC (not access policies)
│       ├── app-insights.bicep                # App Insights + Log Analytics workspace
│       ├── bot-service.bicep                 # Azure Bot Service (single-tenant)
│       ├── diagnostics.bicep                 # Diagnostic settings for all platform services
│       └── alerts.bicep                      # Action Group + DLQ/DTU/error rate metric alerts
│
├── Manifest/
│   ├── manifest.json                         # Single unified Teams manifest (v1.17+)
│   ├── color.png
│   └── outline.png
│
└── .github/workflows/
    ├── ci.yml                                # Build + test + dotnet vuln check + npm audit
    ├── deploy-infra.yml
    └── deploy-app.yml
```

---

## Database Schema (Azure SQL + EF Core 8)

**EF Core configuration:** `EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(30), errorNumbersToAdd: null)` on `AppDbContext` for Azure SQL transient fault handling.

**SQL SKU:** Serverless General Purpose Gen5 2vCore with auto-pause at 60 minutes (~$150-180/mo vs $370 provisioned).

### Notifications
| Column | Type | Notes |
|--------|------|-------|
| Id | uniqueidentifier PK | NEWSEQUENTIALID() |
| Title | nvarchar(200) | Required |
| Summary | nvarchar(max) | Markdown content (server-side sanitized) |
| ImageLink | nvarchar(1000) | External image URL (https:// only, validated) |
| ImageBlobName | nvarchar(200) | Blob storage reference |
| ButtonTitle | nvarchar(200) | CTA button text |
| ButtonLink | nvarchar(1000) | CTA button URL (https:// only, validated) |
| Author | nvarchar(200) | Display name |
| CreatedBy | nvarchar(200) | UPN |
| CreatedDate | datetime2 | DEFAULT GETUTCDATE() |
| ScheduledDate | datetime2 | Nullable |
| SentDate | datetime2 | Nullable |
| Status | nvarchar(50) | CHECK constraint: Draft/Scheduled/Queued/SyncingRecipients/InstallingApp/Sending/Sent/Canceled/Failed |
| AllUsers | bit | Target entire org |
| TotalRecipientCount | int | 0 |
| SucceededCount | int | 0 |
| FailedCount | int | 0 |
| RecipientNotFoundCount | int | 0 |
| CanceledCount | int | 0 |
| UnknownCount | int | 0 |
| ErrorMessage | nvarchar(max) | Nullable |
| TrackingUrl | nvarchar(1000) | Durable Functions management URL |

### NotificationAudiences (replaces JSON-serialized arrays)
| Column | Type | Notes |
|--------|------|-------|
| Id | int PK IDENTITY | |
| NotificationId | FK -> Notifications | Indexed (nonclustered) |
| AudienceType | nvarchar(20) | Team/Roster/Group |
| AudienceId | nvarchar(200) | Team or Group ID |

### SentNotifications (per-recipient delivery tracking)
| Column | Type | Notes |
|--------|------|-------|
| Id | bigint PK IDENTITY | High-volume table, sequential ID |
| NotificationId | FK -> Notifications | |
| RecipientId | nvarchar(200) | AAD ID or Team ID |
| RecipientType | nvarchar(10) | User/Team |
| ConversationId | nvarchar(500) | |
| ServiceUrl | nvarchar(500) | |
| DeliveryStatus | nvarchar(50) | Queued/Succeeded/Failed/RecipientNotFound/Retrying |
| StatusCode | int | HTTP status or internal code |
| SentDate | datetime2 | |
| RetryCount | int | 0 |
| ErrorMessage | nvarchar(1000) | Capped (full traces go to App Insights) |
| UNIQUE(NotificationId, RecipientId) | | Serves upserts |

**Indexes:**
```sql
-- Covering index for aggregation queries (GROUP BY DeliveryStatus)
CREATE NONCLUSTERED INDEX IX_SentNotifications_NotificationId_DeliveryStatus
    ON SentNotifications (NotificationId, DeliveryStatus)
    INCLUDE (SentDate, StatusCode);
```

### Users (cached from Graph + bot events)
| Column | Type | Notes |
|--------|------|-------|
| AadId | nvarchar(100) PK | |
| Name | nvarchar(200) | |
| Email | nvarchar(200) | |
| Upn | nvarchar(200) | |
| UserId | nvarchar(200) | Bot Framework user ID (29:xxx) |
| ConversationId | nvarchar(500) | 1:1 chat ID |
| ServiceUrl | nvarchar(500) | |
| TenantId | nvarchar(100) | |
| UserType | nvarchar(20) | Member/Guest |
| HasTeamsLicense | bit | Graph `assignedPlans` filter |
| LicenseCheckedDate | datetime2 | Avoids N+1 license checks |
| LastSyncedDate | datetime2 | |

### Teams
| Column | Type | Notes |
|--------|------|-------|
| TeamId | nvarchar(200) PK | |
| Name | nvarchar(200) | |
| ServiceUrl | nvarchar(500) | |
| TenantId | nvarchar(100) | |
| InstalledDate | datetime2 | |

### ThrottleState (Send Function coordination)
| Column | Type | Notes |
|--------|------|-------|
| Id | nvarchar(100) PK | Partition key (e.g., "global") |
| RetryAfterUtc | datetime2 | When throttle window expires |
| ConcurrentSends | int | Current active sends |
| RowVersion | rowversion | EF Core concurrency token for optimistic locking |

### ExportJobs
| Column | Type | Notes |
|--------|------|-------|
| Id | uniqueidentifier PK | |
| NotificationId | FK -> Notifications | |
| RequestedBy | nvarchar(200) | |
| RequestedDate | datetime2 | |
| Status | nvarchar(50) | Queued/InProgress/Completed/Failed |
| FileName | nvarchar(500) | Private container; short-lived read-only SAS for download |
| ErrorMessage | nvarchar(max) | |

### AppConfigurations
| Column | Type | Notes |
|--------|------|-------|
| Key | nvarchar(200) PK | |
| Value | nvarchar(max) | |
| LastUpdated | datetime2 | |

### Data Retention

SentNotifications are archived to blob storage after 90 days via a timer-triggered Function. This prevents unbounded table growth for high-volume deployments.

---

## M365 Agents SDK Integration

The Bot Framework SDK is EOL (January 5, 2026). The new solution uses `Microsoft.Agents.*` packages.

### Package Mapping
| Old (Bot Framework) | New (Agents SDK) |
|---------------------|------------------|
| Microsoft.Bot.Builder.Integration.AspNet.Core | Microsoft.Agents.Hosting.AspNetCore + Microsoft.Agents.Authentication.Msal |
| Microsoft.Bot.Builder | Microsoft.Agents.Builder |
| Microsoft.Bot.Schema | Microsoft.Agents.Core.Models |
| Microsoft.Bot.Builder.Teams | Microsoft.Agents.Extensions.Teams.Compat |
| Microsoft.Bot.Schema.Teams | Microsoft.Agents.Extensions.Teams.Models |

### Namespace Mapping
| Old | New |
|-----|-----|
| Microsoft.Bot.Builder.Integration.AspNet.Core | Microsoft.Agents.Hosting.AspNetCore |
| Microsoft.Bot.Builder | Microsoft.Agents.Builder |
| Microsoft.Bot.Schema | Microsoft.Agents.Core.Models |
| Microsoft.Bot.Connector.Authentication | Microsoft.Agents.Connector |
| Microsoft.Bot.Builder.Teams | Microsoft.Agents.Extensions.Teams.Compat |
| Microsoft.Bot.Schema.Teams | Microsoft.Agents.Extensions.Teams.Models |
| Newtonsoft.Json | System.Text.Json |

### Key Code Changes
- `CloudAdapter` -> `ChannelServiceAdapterBase`
- `CloudAdapterBase` -> `ChannelServiceAdapterBase`
- `IBotFrameworkHttpAdapter` -> `IAgentHttpAdapter`
- `BotAdapter` -> `ChannelAdapter`
- `BotState` -> `AgentState`
- `TurnContext.TurnState` -> `TurnContext.Services`
- `JObject`/`JToken` -> `JsonDocument`/`JsonElement`
- `builder.AddAgent<T>()` replaces manual bot DI registration
- `AddAgentAspNetAuthentication()` replaces `ConfigurationBotFrameworkAuthentication`
- Graph v5: catch `ODataError` (not `ServiceException`); handle HTTP 410 for expired delta links
- Polly 8: use `ResiliencePipeline` with `ODataError.ResponseStatusCode` for retry decisions

### Program.cs Pattern
```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddAgent<CommunicatorActivityHandler>();
builder.Services.AddControllers();
builder.Services.AddAgentAspNetAuthentication(builder.Configuration);
builder.Services.AddRateLimiter(/* per-user limits on write operations */);
// ... EF Core (EnableRetryOnFailure), Service Bus, Graph, Blob, etc.
var app = builder.Build();
app.UseSecurityHeaders(); // CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapPost("/api/messages", async (HttpRequest request, HttpResponse response,
    IAgentHttpAdapter adapter, IAgent agent, CancellationToken ct) =>
    await adapter.ProcessAsync(request, response, agent, ct))
    .RequireAuthorization();
app.Run();
```

### appsettings.json Auth Config

**Note:** The exact config key paths (`TokenValidation`, `Connections`, `AgentApplicationOptions`) must be verified against the pinned M365 Agents SDK version at implementation time. The structure below follows current documentation but SDK pre-release versions have changed paths.

```json
{
  "TokenValidation": {
    "Enabled": true,
    "Audiences": ["{{AppId}}"],
    "TenantId": "{{TenantId}}"
  },
  "Connections": {
    "ServiceConnection": {
      "Settings": {
        "AuthType": "ManagedIdentity",
        "AuthorityEndpoint": "https://login.microsoftonline.com/{{TenantId}}",
        "ClientId": "{{AppId}}",
        "Scopes": ["https://api.botframework.com/.default"]
      }
    }
  },
  "ConnectionsMap": [
    { "ServiceUrl": "*", "Connection": "ServiceConnection" }
  ]
}
```

Using `AuthType: ManagedIdentity` avoids replicating the client secret across three compute surfaces. Fallback to `ClientSecret` only if the SDK doesn't support MI for the bot service connection at implementation time.

---

## Authorization Strategy

Replace static UPN lists (`AuthorizedCreatorUpns`, `AuthorizedDeleteUpns`) with **Entra ID security groups**:

- `CompanyCommunicator-Authors` - can create, edit, send notifications
- `CompanyCommunicator-Admins` - full access including delete, export, settings

Configure the app registration to emit `groups` or `roles` claims. This provides:
- Automatic deprovisioning when employees leave (UPNs can be reassigned)
- Audit trail via Entra ID logs
- Group-owner delegation (no app config changes needed)
- Self-service via MyAccess portal

---

## Security Hardening

### API Rate Limiting
Use `Microsoft.AspNetCore.RateLimiting` middleware with per-user limits on write operations (notification creation, send, schedule). Prevents authenticated users or compromised tokens from flooding the system.

### Content Security Policy
`SecurityHeadersMiddleware` adds:
- `Content-Security-Policy` with `frame-ancestors` allowing Teams origins
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options` (for non-Teams contexts)
- `Referrer-Policy: strict-origin-when-cross-origin`

### Input Validation
All URL fields (`ImageLink`, `ButtonLink`) are server-side validated:
- Only `https://` scheme allowed (blocks `javascript:` URIs and SSRF to internal addresses)
- Maximum content lengths enforced
- Markdown `Summary` field sanitized server-side

### Export File Security
Export files (containing PII) are stored in a **private** blob container. Downloads use short-lived read-only SAS tokens, never direct container access.

### Token Validation
Verify that the M365 Agents SDK auto-validates the issuer from the `TenantId` config. If not, add explicit issuer validation in `TokenValidation`.

---

## Service Bus Queues (Standard tier)

| Queue | Purpose | Consumer |
|-------|---------|----------|
| cc-prepare | Triggers PrepareToSend durable orchestration | Prep Function |
| cc-send | Individual recipient send messages (batches of 100) | Send Function |
| cc-export | Export job requests | Prep Function |

### Queue Configuration (per queue)
| Property | cc-prepare | cc-send | cc-export |
|----------|------------|---------|-----------|
| Max delivery count | 5 | 10 | 5 |
| Lock duration | 5 min | 1 min | 5 min |
| Default TTL | 24 hr | 24 hr | 24 hr |
| Duplicate detection | 10 min | Off | 10 min |

The original `cc-data` queue (data aggregation polling) is replaced by a Durable Functions timer loop within the orchestrator (see below).

### Dead-Letter Queue Monitoring
DLQ messages mean users didn't receive notifications. Metric alert fires on `DeadletteredMessages > 0` on the Service Bus namespace, routed to an Action Group (email + Teams webhook).

---

## Durable Functions Architecture (Isolated Worker Model)

The proven orchestration pattern is preserved but modernized for the **isolated worker model**, which uses completely different APIs than the in-process model.

### Isolated Worker API Changes
| In-Process (old) | Isolated Worker (new) |
|---|---|
| `IDurableOrchestrationContext` | `TaskOrchestrationContext` |
| `Microsoft.Azure.WebJobs.Extensions.DurableTask` | `Microsoft.DurableTask` |
| `RetryOptions` | `TaskRetryOptions` / `RetryPolicy` |
| `context.CallActivityWithRetryAsync(name, retryOptions, input)` | `context.CallActivityAsync(name, input, TaskOptions.FromRetryPolicy(...))` |
| `!context.IsReplaying` guards for logging | `context.CreateReplaySafeLogger<T>()` |

Functions `Program.cs` must call `worker.UseDurableTask()` to register the Durable Task middleware.

**Critical:** `AppDbContext` must never be injected into orchestrator classes. Orchestrators are replayed; only activity functions may use DbContext.

### PrepareToSendOrchestrator Flow
1. **StoreMessageActivity** - Serialize Adaptive Card to blob
2. **SyncRecipientsOrchestrator** (sub-orchestrator) - Fan-out by audience type:
   - AllUsers: SyncAllUsersActivity (Graph v5 delta sync, catch `ODataError`, handle 410)
   - Rosters: Fan-out SyncTeamMembersActivity per team
   - Groups: Fan-out SyncGroupMembersActivity per group
3. **TeamsConversationOrchestrator** (if recipients need conversation creation) - Fan-out CreateConversationActivity
4. **SendQueueOrchestrator** - Fan-out SendBatchMessagesActivity (100 per batch to cc-send queue)
5. **DataAggregationLoop** - Durable timer loop polling until delivery completes:

```csharp
var sendingStarted = context.CurrentUtcDateTime;
var isComplete = false;
while (!isComplete)
{
    // Adaptive delay: fast polling for first 10 min, then slower
    var elapsed = (context.CurrentUtcDateTime - sendingStarted).TotalMinutes;
    var delay = elapsed < 10
        ? TimeSpan.FromSeconds(10) : TimeSpan.FromSeconds(60);
    await context.CreateTimer(context.CurrentUtcDateTime.Add(delay), CancellationToken.None);

    // SQL GROUP BY aggregation (not loading 50K rows)
    var result = await context.CallActivityAsync<AggregationResult>(
        nameof(DataAggregationActivity), notificationId);
    isComplete = result.IsComplete;

    // 24-hour safety net: force-complete to prevent stuck orchestrations
    if (elapsed > 1440)
    {
        await context.CallActivityAsync(nameof(ForceCompleteActivity), notificationId);
        break;
    }
}
```

### DataAggregationActivity
Uses SQL `GROUP BY` for efficient aggregation:
```csharp
var counts = await dbContext.SentNotifications
    .Where(s => s.NotificationId == notificationId)
    .GroupBy(s => s.DeliveryStatus)
    .Select(g => new { Status = g.Key, Count = g.Count() })
    .ToListAsync();
```

### Send Function
- **Hosted on Consumption plan** (independent scaling, near-zero cost at idle, auto-scales to hundreds of instances)
- Service Bus trigger on cc-send queue
- Pre-flight checks: canceled? guest? has conversation? throttled?
- Send via M365 Agents SDK proactive messaging
- Throttle management: `ThrottleState` entity in SQL with `RowVersion` concurrency token; re-queue with delay on 429
- Adaptive Card template cached in `static ConcurrentDictionary<string, string>` (persists across invocations within same process, avoids IMemoryCache eviction overhead in distributed instances)
- Dead letter after 10 failed attempts

### Key Package
- `Microsoft.Azure.Functions.Worker.Extensions.DurableTask` (isolated worker Durable Functions)

---

## Frontend Architecture

### Stack
| Component | Package | Version |
|-----------|---------|---------|
| React | react, react-dom | 19.x |
| Build | vite | 6.x |
| UI | @fluentui/react-components | 9.x |
| Date picker | @fluentui/react-datepicker-compat | latest |
| Data fetching | @tanstack/react-query | 5.x |
| Query devtools | @tanstack/react-query-devtools | 5.x (dev) |
| Routing | react-router-dom | 7.x |
| Teams SDK | @microsoft/teams-js | 2.x |
| Forms | react-hook-form | 7.x |
| Form resolvers | @hookform/resolvers | 3.x |
| Adaptive Cards | adaptivecards | 3.x |
| i18n | react-i18next, i18next | latest |
| Validation | zod | 3.x |
| Dates | date-fns | 4.x |

### Auth Strategy: Teams SSO (No MSAL in Frontend)

MSAL's redirect-based auth flow is blocked by Teams' iframe sandboxing. Instead:

1. **Frontend** calls `authentication.getAuthToken()` from Teams JS SDK to get a SSO token
2. **Frontend** sends token in `Authorization: Bearer <token>` header with every API call
3. **Backend** validates the token and performs **OBO (On-Behalf-Of) exchange** to get a Graph-scoped token for downstream calls

This eliminates `@azure/msal-browser` and `@azure/msal-react` entirely. All Graph calls go through the backend API -- the frontend never acquires Graph tokens directly.

### Why TanStack Query over Redux
The app's state is primarily server-driven (notification lists, draft data, delivery status). TanStack Query provides cache invalidation, background refetching, optimistic updates, and infinite query support with far less boilerplate than Redux + RTK Query. There is no complex client-side state that justifies a Redux store.

### Query Key Factory
`api/queryKeys.ts` defines a hierarchical key structure for consistent cache invalidation:
```typescript
export const queryKeys = {
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: NotificationFilters) => [...queryKeys.notifications.lists(), filters] as const,
    details: () => [...queryKeys.notifications.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notifications.details(), id] as const,
  },
  teams: { /* ... */ },
  groups: { /* ... */ },
  exports: { /* ... */ },
};
```

### Notification Form
The notification form (7+ validated fields, conditional audience pickers, file upload, date/time scheduling, 2-step wizard flow) uses `react-hook-form` + `@hookform/resolvers` + Zod. Use `z.discriminatedUnion` for audience type validation.

### Adaptive Card Preview
Render Adaptive Cards using a stable `ref` + `useEffect` pattern. Do not use direct DOM manipulation (`document.getElementsByClassName`). With React 19's concurrent rendering, use `useDeferredValue` for large card renders to avoid blocking.

### Teams Dialog vs Route Navigation
Map which views are dialog-hosted vs main-frame routes in `App.tsx`:
- **Main-frame routes:** notification list, notification detail/status, settings
- **Dialog-hosted:** notification compose/edit form, audience picker expansion, export manager

---

## Bicep Module Structure

```
infra/
├── main.bicep                      # Orchestrator + resource tags (application, environment, managedBy)
├── main.bicepparam                 # Parameters
└── modules/
    ├── managed-identity.bicep      # User-assigned MI shared across all compute
    ├── app-service.bicep           # App Service Plan (S1) + Web App
    ├── function-app-prep.bicep     # Prep+Data Function App (on shared ASP)
    ├── function-app-send.bicep     # Send Function App (own Consumption plan)
    ├── sql.bicep                   # Serverless GP Gen5 2vCore + Entra-only + PITR 14-35 days + firewall
    ├── service-bus.bicep           # Standard tier + 3 queues (with DLQ, TTL, lock, dedup config) + RBAC
    ├── storage.bicep               # Storage Account + full Functions RBAC
    ├── key-vault.bicep             # Key Vault with RBAC (not access policies)
    ├── app-insights.bicep          # App Insights + Log Analytics workspace
    ├── bot-service.bicep           # Azure Bot Service (single-tenant)
    ├── diagnostics.bicep           # Diagnostic settings for SQL, Service Bus, Key Vault, Storage -> Log Analytics
    └── alerts.bicep                # Action Group (email + Teams webhook) + metric alerts (DLQ, DTU, error rate)
```

### Key Bicep Decisions
- **Managed Identity**: User-assigned MI granted:
  - SQL login (Entra auth)
  - Service Bus Data Owner
  - **Storage Blob Data Owner** (not just Contributor -- Functions runtime needs lease management)
  - **Storage Queue Data Contributor** (internal trigger coordination)
  - **Storage Table Data Contributor** (Durable Functions history tracking)
  - Key Vault Secrets User
  - Scoped to specific containers where possible (not entire storage account)
- **Azure SQL**: Entra ID-only authentication (no SQL auth); Serverless GP Gen5 2vCore; auto-pause 60 min; PITR 14-35 days (consider weekly LTR for 12 weeks); firewall rules for App Service/Function outbound IPs (or private endpoints)
- **Service Bus**: Standard tier (enables DLQ, scheduled delivery, duplicate detection, transactions)
- **Key Vault**: RBAC model (not access policies)
- **All secrets** stored in Key Vault; apps use Key Vault references
- **Send Function**: Own Consumption plan (auto-scales independently during large broadcasts)
- **Resource tags**: `application: CompanyCommunicator`, `environment: <env>`, `managedBy: bicep` on all resources
- **Diagnostics**: All platform services forward logs to Log Analytics workspace
- **Alerts**: Action Group with email + Teams webhook; alerts on DLQ messages, DTU saturation, error rate spikes

### Network Isolation (Recommended)
For production deployments, add VNet integration + private endpoints for SQL, Service Bus, Storage, and Key Vault. At minimum, enable service firewalls to restrict access to known App Service/Function outbound IPs.

---

## Cost Estimate (Single-Tenant, 5K-50K Users)

| Resource | SKU | Est. Monthly |
|----------|-----|-------------|
| App Service Plan (Standard S1) | S1 | $73 |
| Send Function App (Consumption) | Consumption | $1-5 |
| Azure SQL (Serverless GP Gen5 2vCore) | Serverless | $150-180 |
| Service Bus (Standard) | Standard | $10 |
| Storage Account (LRS) | Standard LRS | $5-10 |
| Key Vault | Standard | $1-5 |
| App Insights | Pay-as-you-go (5GB free) | $0 |
| Bot Service | Standard (free for Teams) | $0 |
| **Total** | | **~$240-285/month** |

---

## Implementation Phases

### Phase 1: Foundation
- Create solution structure with all 4 projects
- Set up EF Core `AppDbContext` with all entities (including `ThrottleState`, `HasTeamsLicense` on Users), `EnableRetryOnFailure`, and initial migration
- Add covering indexes (`IX_SentNotifications_NotificationId_DeliveryStatus`), CHECK constraint on `Notifications.Status`, index on `NotificationAudiences.NotificationId`
- Configure `Program.cs` with M365 Agents SDK, Identity, OBO token exchange, DI
- Write Bicep modules for all Azure resources including `diagnostics.bicep` and `alerts.bicep`
- Bicep: separate Consumption plan for Send Function; full Storage RBAC (Blob Owner, Queue, Table); SQL SKU + PITR + firewall; Service Bus queue configs (lock duration, TTL, max delivery count, duplicate detection); resource tags
- Set up GitHub Actions CI pipeline with `dotnet list package --vulnerable` and `npm audit`
- Create single Entra ID app registration with `groups`/`roles` claims

### Phase 2: Core Services + Bot
- Implement `CommunicatorActivityHandler` (unified author+user handler, including `OnTeamsFileConsentAcceptAsync`)
- Implement `MessageSender` for proactive messaging via Agents SDK
- Verify M365 Agents SDK config key paths against pinned SDK version; prefer `AuthType: ManagedIdentity`
- Implement `GraphService` with MS Graph v5 (catch `ODataError`, handle 410 for expired delta links, use Polly 8 `ResiliencePipeline`)
- Implement `ServiceBusService` (queue abstractions)
- Implement `BlobStorageService` (images, card templates)
- Set up Entra ID group-based authorization (`CompanyCommunicator-Authors`, `CompanyCommunicator-Admins`)

### Phase 3: API Layer
- Implement `NotificationsController` (draft CRUD, submit, schedule, cancel)
- Implement `TeamsController`, `GroupsController`, `ExportsController`
- Implement Adaptive Card builder service
- Wire up notification preview
- Add `SecurityHeadersMiddleware` (CSP with Teams `frame-ancestors`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`)
- Add `Microsoft.AspNetCore.RateLimiting` middleware (per-user limits on write operations)
- Add server-side input validation: `https://` only for URL fields, max content lengths, markdown sanitization

### Phase 4: Azure Functions
- Implement all Durable Functions using **isolated worker APIs** (`TaskOrchestrationContext`, `TaskRetryOptions`, `context.CreateReplaySafeLogger<T>()`)
- Register `worker.UseDurableTask()` in Functions `Program.cs`
- Implement PrepareToSend orchestrator chain (sync recipients, create conversations, batch queue)
- Implement data aggregation timer loop within orchestrator (adaptive delay, 24h safety net, SQL GROUP BY)
- Implement Send function on Consumption plan with `ThrottleState` entity + `static ConcurrentDictionary` card cache
- Implement schedule check timer
- Implement export orchestration (export files to private container, SAS-based download)
- Implement SentNotifications cleanup timer (archive to blob after 90 days)

### Phase 5: Frontend
- Scaffold Vite + React 19 + TypeScript 5.x + Fluent UI v9
- Implement Teams SSO auth flow (`authentication.getAuthToken()` + backend OBO); no MSAL packages
- Set up TanStack Query with hierarchical query key factory (`api/queryKeys.ts`)
- Implement notification list (Draft/Sent/Scheduled tabs) with TanStack Query
- Implement notification form with `react-hook-form` + `@hookform/resolvers` + Zod (`z.discriminatedUnion` for audience types)
- Implement Adaptive Card preview (stable `ref` + `useEffect`, `useDeferredValue` for large cards)
- Map dialog-hosted vs main-frame route navigation in `App.tsx`
- Implement status view, export manager
- Implement i18n (start with en-US, structure for expansion)
- Use `@fluentui/react-datepicker-compat` for schedule date/time picker

### Phase 6: Integration + Deploy
- End-to-end testing in Azure
- Deploy infrastructure via Bicep
- Deploy apps via GitHub Actions
- Create Teams app package, test in Teams
- Verify DLQ alert fires correctly
- Verify diagnostic logs flow to Log Analytics
- Network isolation review: enable service firewalls or VNet + private endpoints

---

## Verification Plan
1. **Build**: `dotnet build` succeeds for all 4 projects, `npm run build` succeeds for frontend
2. **Unit tests**: `dotnet test` passes for Core, Api, and Functions test projects
3. **Local dev**: Bot responds in Teams Emulator, API returns data, frontend renders
4. **Bicep**: `az deployment group create --what-if` shows expected resources (including separate Consumption plan, diagnostics, alerts)
5. **Security**: CSP headers present, rate limiting active, URL validation rejects non-HTTPS, health endpoint authenticated
6. **E2E in Azure**: Create draft -> Send to test group -> Verify delivery -> Check status
7. **Scale test**: Send to 1000+ recipients, verify throttle handling, aggregation performance, and completion
8. **DLQ test**: Verify dead-letter alert fires, messages can be reprocessed
9. **Diagnostics**: Verify logs from SQL, Service Bus, Key Vault, Storage appear in Log Analytics

---

## Disaster Recovery

| Capability | Configuration |
|------------|---------------|
| SQL backup | PITR 14-35 days; consider weekly LTR for 12 weeks |
| DLQ monitoring | Alert on `DeadletteredMessages > 0`, routed to Action Group |
| Multi-region | Accept single-region; document manual recovery runbook |
| Zero-downtime deploy | Add staging slot on Web App (Phase 6 stretch goal) |

---

## Reference Documents
- [01-architecture-overview.md](01-architecture-overview.md) - Original solution architecture
- [02-message-flow.md](02-message-flow.md) - Original draft-to-delivery pipeline
- [03-technical-debt-assessment.md](03-technical-debt-assessment.md) - All 42 issues cataloged
- [04-component-inventory.md](04-component-inventory.md) - Every original class and its role
- [05-dependency-inventory.md](05-dependency-inventory.md) - Every package with current status
- [07-plan-review.md](07-plan-review.md) - Specialist review findings (37 items) that informed this plan
- [M365 Agents SDK Migration Guide](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/bf-migration-dotnet)
- [M365 Agents SDK Overview](https://learn.microsoft.com/en-us/microsoft-365/agents-sdk/agents-sdk-overview)
- [Durable Functions Isolated Worker](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-dotnet-isolated-overview)
- [Microsoft Graph SDK v5 Upgrade](https://github.com/microsoftgraph/msgraph-sdk-dotnet/blob/main/docs/upgrade-to-v5.md)
