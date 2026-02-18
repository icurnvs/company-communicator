# Company Communicator v2 - Architecture Reference

This document describes the architecture of Company Communicator v2, a clean-room rebuild of Microsoft's open-source Company Communicator app, modernized for current Azure and Teams technologies.

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Component Overview](#component-overview)
4. [Data Flow](#data-flow)
5. [Authentication and Authorization](#authentication-and-authorization)
6. [Database Schema](#database-schema)
7. [Message Processing Pipeline](#message-processing-pipeline)
8. [Infrastructure](#infrastructure)
9. [Security](#security)
10. [Resilience and Fault Handling](#resilience-and-fault-handling)

---

## Overview

### What the App Does

Company Communicator enables corporate communications teams to:

- **Compose** text-based or Adaptive Card notifications through a web-based dashboard
- **Target** recipients by Teams channel, Microsoft 365 group, or organization-wide
- **Schedule** messages for future delivery or send immediately
- **Track** delivery status per recipient with completion metrics
- **Export** delivery reports for compliance and analysis
- **Manage** the full notification lifecycle from draft through sent and archived

### Who Uses It

- **Authors**: Communications, HR, executive teams composing and sending messages
- **Admins**: IT operations managing the app, viewing all messages, exporting data, deleting messages
- **Recipients**: Employees receiving notifications through Teams (bot messages)

### Key Design Principles

- **Single-tenant deployment**: One app registration per organization (not multi-tenant)
- **Event-driven**: Service Bus queues drive notification delivery with no polling
- **Scalable**: Durable Functions orchestrate large broadcasts (10k+ recipients) without process restarts
- **Secure**: Entra ID-only auth, managed identity for Azure services, groups-based authorization
- **Observable**: Application Insights and Log Analytics provide end-to-end visibility

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Microsoft Teams                           │
│  ┌──────────────────────┐      ┌──────────────────────────┐ │
│  │  Dashboard Tab       │      │  Bot (notifications)     │ │
│  │  (React SPA)         │      │  Personal + Team scopes  │ │
│  └──────────┬───────────┘      └──────────┬───────────────┘ │
└─────────────┼────────────────────────────┼──────────────────┘
              │ Teams SSO token            │
┌─────────────▼────────────────────────────┼──────────────────┐
│     ASP.NET Core 8 Web App (Windows/Linux)                   │
│  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │ REST API     │  │ Agent Endpoint                      │   │
│  │ Controllers  │  │ /api/messages                       │   │
│  │ - Notif CRUD │  │ (M365 Agents SDK for bot messages) │   │
│  │ - Teams/Gorp │  │                                    │   │
│  │ - Export     │  │ + Rate Limiter                      │   │
│  │ - Health     │  │ + CSP Headers                       │   │
│  └──────────┬───┘  └──────────┬─────────────────────────┘   │
│             │                 │                              │
│  ┌──────────▼─────────────────▼──────────────────────────┐  │
│  │ Core Services Layer                                   │  │
│  │ - EF Core 8 DbContext                                │  │
│  │ - Microsoft Graph SDK v5                             │  │
│  │ - Authorization policies (group-based)               │  │
│  │ - Service Bus + Blob Storage clients                 │  │
│  └──────────┬──────────────────────────────────────────┬┘  │
└─────────────┼──────────────────────────────────────────┼───┘
              │                                          │
              │ Service Bus messages                     │
    ┌─────────▼────────┐                    ┌───────────▼───────┐
    │ Service Bus      │                    │  Azure SQL        │
    │ (Standard tier)  │                    │  Serverless GP    │
    │                  │                    │  Gen5 2vCore      │
    │ 3 Queues:        │                    │                   │
    │ - cc-prepare     │                    │ EF Core manages   │
    │ - cc-send        │                    │ schema            │
    │ - cc-export      │                    │                   │
    └──┬────────┬──────┘                    └───────────────────┘
       │        │
   ┌───▼───┐ ┌─▼──────┐     Also used:
   │ Prep  │ │ Send   │     - Azure Storage (blobs, queues)
   │ Func  │ │ Func   │     - Key Vault (secrets, certs)
   │ (Dur) │ │(Consmp)│     - App Insights (telemetry)
   └───────┘ └────────┘     - Log Analytics (diagnostics)
                            - Managed Identity (RBAC)
```

### Technology Stack

| Layer | Component | Technology |
|-------|-----------|------------|
| **Presentation** | Dashboard SPA | React 19, Vite 6, Fluent UI v9, TanStack Query 5 |
| **Presentation** | Teams Integration | Teams JS SDK 2.x, Adaptive Cards 3.x |
| **Backend** | API + Bot | ASP.NET Core 8, M365 Agents SDK, Microsoft.Identity.Web |
| **Data Access** | ORM | EF Core 8 with SQL Server provider |
| **Data Store** | Primary DB | Azure SQL (Serverless, Entra ID auth) |
| **Messaging** | Event queue | Azure Service Bus (Standard, 3 queues) |
| **Functions** | Orchestration | Azure Functions v4 (isolated worker), Durable Functions |
| **Graph** | Directory API | Microsoft Graph SDK v5 with Kiota builders |
| **Storage** | Blobs | Azure Blob Storage (images, card templates, exports) |
| **Auth** | Identity | Entra ID, Teams SSO, Managed Identity, OBO flow |
| **Observability** | APM | Application Insights + Log Analytics |
| **IaC** | Infrastructure | Bicep modules (12 modules for 12 resource types) |
| **CI/CD** | Automation | GitHub Actions (no Azure Pipelines/Kudu) |

---

## Component Overview

### Web Application (`CompanyCommunicator.Api`)

**Purpose**: REST API, bot messaging endpoint, and static file host for the React SPA.

**Responsibilities**:
- REST endpoints for notification CRUD, delivery status, exports
- Bot activity handler for receiving notifications and user interactions
- Teams SSO authentication with OBO token exchange for Graph calls
- Rate limiting on write operations (10 req/min per user)
- Security headers (CSP, X-Content-Type-Options, Referrer-Policy)
- Static file serving for React SPA at `/clientapp/`

**Key Files**:
- `Program.cs` – Dependency injection, M365 Agents SDK registration, middleware
- `Controllers/NotificationsController.cs` – CRUD and send operations
- `Controllers/TeamsController.cs`, `GroupsController.cs`, `ExportsController.cs` – Directory and export endpoints
- `Bot/CommunicatorActivityHandler.cs` – Single unified activity handler (author + user interactions)
- `Authorization/AuthorizationPolicies.cs` – Group-based policies
- `Middleware/SecurityHeadersMiddleware.cs` – CSP and security headers

**Tech Stack**:
- ASP.NET Core 8
- M365 Agents SDK for bot integration
- Microsoft.Identity.Web for Teams SSO + OBO
- EF Core for database access
- Microsoft Graph v5 for directory queries

### Core Library (`CompanyCommunicator.Core`)

**Purpose**: Shared services, data models, and EF Core DbContext.

**Responsibilities**:
- EF Core `AppDbContext` and entity models
- Graph service for syncing users and groups
- Service Bus queue service
- Blob storage service
- Authorization policy definitions
- DTO models for API responses

**Key Files**:
- `Data/AppDbContext.cs` – DbContext with all entities
- `Data/Entities/*` – Notification, User, Team, SentNotification, etc.
- `Services/Graph/GraphService.cs` – Microsoft Graph v5 client (with delta sync, ODataError handling)
- `Services/Queue/ServiceBusService.cs` – Queue abstractions
- `Services/Blob/BlobStorageService.cs` – Blob storage operations
- `Services/Recipients/RecipientService.cs` – Audience resolution

### Prep Function App (`CompanyCommunicator.Functions.Prep`)

**Purpose**: Orchestrate large-scale notification delivery using Durable Functions.

**Responsibilities**:
- `PrepareToSendOrchestrator`: Master orchestration flow
  1. Store Adaptive Card to blob
  2. Sync recipients (all users, team rosters, or groups) via Graph
  3. Create 1:1 conversations if needed
  4. Batch recipients and queue to cc-send queue
  5. Poll delivery status with adaptive delays until complete
- `SyncRecipientsOrchestrator`: Fan-out recipient sync (by audience type)
- `TeamsConversationOrchestrator`: Fan-out conversation creation
- `SendQueueOrchestrator`: Batch and queue 100 recipients per message
- `DataAggregationActivity`: SQL GROUP BY to aggregate delivery counts
- Timer-triggered sync check (every 10 minutes)
- Timer-triggered export jobs

**Tech Stack**:
- Azure Functions v4 (isolated worker model)
- Durable Task extensions (`Microsoft.DurableTask`)
- EF Core for database
- Microsoft Graph v5

**Key APIs**:
- `TaskOrchestrationContext` (not `IDurableOrchestrationContext`)
- `context.CallActivityAsync<T>(name, input)` with `TaskOptions`
- `context.CreateTimer()` for delays (polling, scheduling)
- `context.CreateReplaySafeLogger<T>()` for logging (avoids log duplication)

### Send Function App (`CompanyCommunicator.Functions.Send`)

**Purpose**: High-throughput message delivery to Teams users.

**Responsibilities**:
- Service Bus trigger on cc-send queue
- Proactive messaging via M365 Agents SDK
- Throttle management (respects Teams rate limits)
- Retry with exponential backoff (10 attempts max)
- Dead-letter on permanent failure

**Tech Stack**:
- Azure Functions v4 (Consumption plan for independent auto-scaling)
- Service Bus trigger
- M365 Agents SDK for proactive messaging
- `ThrottleState` entity in SQL for distributed throttle coordination

**Key Details**:
- Runs on **independent Consumption plan** (scales to 200+ instances during large broadcasts)
- Caches Adaptive Card template in `static ConcurrentDictionary` (persists across invocations)
- Uses optimistic concurrency on `ThrottleState` entity (RowVersion token)

### React Frontend (`CompanyCommunicator.Api/ClientApp`)

**Purpose**: Dashboard SPA for composing and managing notifications.

**Responsibilities**:
- **Dashboard**: List notifications by status (Draft, Sent, Scheduled)
- **Compose**: Multi-step form for creating notifications (title, summary, recipients, scheduling)
- **Status View**: Delivery progress per recipient with aggregated counts
- **Exports**: Request and download delivery reports
- **Teams SSO**: Authentication via `authentication.getAuthToken()` + backend OBO flow

**Tech Stack**:
- React 19 with TypeScript 5.x
- Vite 6 (fast builds, hot reload)
- Fluent UI v9 (Microsoft's design system)
- TanStack Query v5 (server-state management, no Redux)
- react-hook-form 7.x + Zod (forms and validation)
- Teams JS SDK 2.x (getAuthToken, context)
- Adaptive Cards 3.x (card preview and rendering)
- date-fns for date manipulation
- i18next for internationalization (en-US starter)

**Key Patterns**:
- **No MSAL in frontend**: Teams SSO token obtained, sent to backend, backend does OBO exchange for Graph tokens
- **TanStack Query**: Hierarchical query key structure, automatic cache invalidation
- **react-hook-form**: Zod schema validation, `z.discriminatedUnion` for audience types
- **Dialog-hosted vs main routes**: Compose and pickers in dialogs, lists and status in main routes

---

## Data Flow

### Draft Creation Flow

```
User -> [React Form] -> POST /api/notifications
        |
        v
[API AuthZ] -> Check "Authors" group membership
        |
        v
[Validation] -> Title, Summary, Recipients validation
        |
        v
[EF Core] -> Insert Notification (status=Draft)
        |
        v
200 OK + Notification ID -> [TanStack Query] -> Update cache
```

### Send Flow

```
User -> [UI] -> "Send" button -> POST /api/notifications/{id}/send
         |
         v
[API AuthZ] -> Check "Authors" membership
         |
         v
[EF Core] -> Update Notification status to "Queued"
         |
         v
[Service Bus] -> Send message to "cc-prepare" queue
         |
         v
[Prep Function] -> PrepareToSendOrchestrator triggered
         |
         +-- [SyncRecipientsOrchestrator] -> Graph delta sync
         |   (scope: AllUsers / TeamRosters / GroupMembers)
         |
         +-- [TeamsConversationOrchestrator] -> Create 1:1 chats if needed
         |
         +-- [SendQueueOrchestrator] -> Batch 100 recipients, queue to "cc-send"
         |
         +-- [DataAggregationLoop] -> Poll until all sent
             (adaptive delays: 10s fast, 60s slow, max 24h)
                   |
                   v
[Send Function] <- Triggered by "cc-send" queue
         |
         +-- [Throttle check] -> Respect Teams rate limits (900 msg/min)
         |
         +-- [M365 Agents SDK] -> Proactive message to user
         |
         +-- [Retry] -> Exponential backoff (max 10 attempts)
         |
         +-- [EF Core] -> Update SentNotifications row
         |
         +-- [Dead-Letter] -> If permanent failure (after retries)
                   |
                   v
[Alert] -> DLQ metric fires, email alert sent
```

### Status Aggregation Flow

```
[DataAggregationActivity] runs every 10-60 seconds (while orchestration active)
         |
         v
[SQL GROUP BY] -> SELECT DeliveryStatus, COUNT(*)
                  FROM SentNotifications
                  WHERE NotificationId = @id
         |
         v
[Update Notification] -> Set SucceededCount, FailedCount, etc.
         |
         v
[Orchestrator checks] -> Is complete? (All expected recipients processed)
         |
         v
If complete -> Mark Notification as "Sent", end orchestration
If not -> Wait 10-60 seconds, poll again
```

### Frontend Status Update Flow

```
[TanStack Query] -> useQuery(queryKeys.notifications.detail(id), fetchNotification)
         |
         v
[Background Refetch] -> Auto-refetch every 30 seconds (while on status view)
         |
         v
[API] -> GET /api/notifications/{id}
         |
         v
[EF Core] -> Select * from Notifications where Id = @id
         |
         v
[Response] -> Notification with latest counts
         |
         v
[React] -> Re-render progress bar, status cards
```

---

## Authentication and Authorization

### Authentication Flow

#### Teams SSO (Frontend to Backend)

1. **Frontend**: Calls `authentication.getAuthToken()` (Teams JS SDK)
   - Returns a token issued by Entra ID, scoped to the bot app registration
   - Token includes user's Object ID, email, group memberships (if claim configured)

2. **Frontend**: Includes token in all API requests as `Authorization: Bearer <token>`

3. **Backend**: `Microsoft.Identity.Web` middleware validates the token
   - Checks signature against Entra ID public keys
   - Verifies `aud` (audience) matches the bot app ID
   - Extracts user identity into `HttpContext.User` claims

4. **Backend**: On-Behalf-Of (OBO) Token Exchange
   - For Graph calls, exchange the frontend token for a Graph-scoped token
   - Uses `ITokenAcquisitionService.GetAccessTokenForUserAsync(...)`
   - Result: Backend can call Graph on behalf of the signed-in user

#### Bot Authentication (Agents SDK)

1. **Azure Bot Service**: Routes activity (message, event) to the bot endpoint `/api/messages`
   - Includes authentication header with bot service JWT

2. **M365 Agents SDK**: Validates the JWT
   - Uses app registration ID and secret (or managed identity)
   - If valid, passes activity to the activity handler

### Authorization

**Authorization is group-based, enforced at the controller level:**

```csharp
[Authorize(Policy = "AuthorsPolicy")]
public async Task<IActionResult> CreateNotification(...)
// User must be in "CompanyCommunicator-Authors" group

[Authorize(Policy = "AdminsPolicy")]
public async Task<IActionResult> DeleteNotification(...)
// User must be in "CompanyCommunicator-Admins" group
```

**Groups are sourced from Entra ID claims:**
- Token includes `groups` claim (array of group object IDs) if configured in app registration
- Authorization policies check group membership against hardcoded group IDs (or App Configuration)

---

## Database Schema

### Tables Overview

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| **Notifications** | Master record of each notification | Id, Title, Summary, Status, CreatedBy, SentDate, TotalRecipientCount, SucceededCount, FailedCount |
| **NotificationAudiences** | Which teams/groups/rosters targeted | NotificationId (FK), AudienceType, AudienceId |
| **SentNotifications** | Per-recipient delivery tracking | Id (bigint), NotificationId (FK), RecipientId, DeliveryStatus, RetryCount, SentDate |
| **Users** | Cached Entra ID users + bot IDs | AadId, Name, Email, Upn, UserId (bot), ConversationId, HasTeamsLicense |
| **Teams** | Cached team metadata | TeamId, Name, ServiceUrl |
| **ThrottleState** | Send Function coordination | Id, RetryAfterUtc, ConcurrentSends, RowVersion (optimistic lock) |
| **ExportJobs** | Async export task tracking | Id, NotificationId (FK), Status, FileName, ErrorMessage |
| **AppConfiguration** | App settings | Key (PK), Value, LastUpdated |

### Key Indexes

```sql
-- Aggregation queries (status counts)
CREATE NONCLUSTERED INDEX IX_SentNotifications_NotificationId_DeliveryStatus
    ON SentNotifications (NotificationId, DeliveryStatus)
    INCLUDE (SentDate, StatusCode);

-- Prevent duplicate sends
UNIQUE(NotificationId, RecipientId) ON SentNotifications;

-- Fast lookup by audience
NONCLUSTERED INDEX IX_NotificationAudiences_NotificationId
    ON NotificationAudiences (NotificationId);
```

### Data Retention

- **SentNotifications**: Archived to blob after 90 days (reduces table size for long-running org)
- **Notifications**: Kept indefinitely (audit requirement)
- **Export files**: Deleted after 30 days (short-lived, regenerated on request)

---

## Message Processing Pipeline

### Queue Configuration

| Queue | Purpose | Lock Duration | Max Delivery | TTL | Duplicate Detection |
|-------|---------|---|---|---|---|
| **cc-prepare** | Trigger orchestration | 5 min | 5 | 24 hr | 10 min |
| **cc-send** | Individual send batches | 1 min | 10 | 24 hr | Off |
| **cc-export** | Export job requests | 5 min | 5 | 24 hr | 10 min |

### Message Types

```csharp
// cc-prepare queue message
{
  "NotificationId": "...",
  "ScheduledDate": "2025-02-17T10:00:00Z"  // Optional
}

// cc-send queue message (batch of 100)
{
  "NotificationId": "...",
  "RecipientIds": ["user1", "user2", ..., "user100"],
  "ConversationIds": ["conv1", "conv2", ..., "conv100"]
}

// cc-export queue message
{
  "ExportJobId": "...",
  "NotificationId": "..."
}
```

### Failure Handling

- **Prep Function**: Retries on transient Graph errors (503, 429) with exponential backoff
- **Send Function**: Retries on 429 (throttle), 500+ with exponential backoff; max 10 attempts
- **Dead-letter**: Permanent failures (400, 401, 403 from Teams, max retries exceeded) go to DLQ
- **DLQ alert**: Metric alert fires when `DeadletteredMessages > 0`, sends email

---

## Infrastructure

### Azure Resources

| Resource | SKU/Tier | Purpose |
|----------|----------|---------|
| **App Service Plan** | Standard S1 | Hosts Web App and Prep Function |
| **Web App** | Linux | API + SPA, 2 vCores, 3.5 GB RAM |
| **Function App (Prep)** | App Service Plan | Durable orchestration |
| **Function App (Send)** | Consumption | Independent auto-scaling (0-200+ instances) |
| **Azure SQL** | Serverless GP Gen5 2vCore | Primary database, auto-pause 60 min |
| **Service Bus** | Standard | 3 queues, DLQ enabled, RBAC |
| **Storage Account** | Standard LRS | Durable state, function logs, blobs |
| **Key Vault** | Standard | Secrets (bot app secret, connection strings) |
| **App Insights** | Pay-as-you-go | Telemetry (5 GB free) |
| **Bot Service** | Standard (Free for Teams) | Azure Bot Service registration |

### Networking

- **Public endpoints**: Web App, Function Apps exposed to internet (authentication required)
- **Firewall rules** (optional): Restrict Azure SQL access to App Service outbound IPs
- **Private endpoints** (optional): For network isolation in prod (VNet + private endpoints for SQL, Service Bus, Storage, Key Vault)

### Managed Identity

- **User-assigned MI**: Shared across Web App and all Function Apps
- **RBAC roles granted**:
  - SQL login (Entra ID admin)
  - Service Bus Data Owner
  - Storage Blob Data Owner
  - Storage Queue Data Contributor
  - Storage Table Data Contributor
  - Key Vault Secrets User
- **Graph application permissions**: User.Read.All, Group.Read.All, TeamMember.Read.All (granted to the MI's service principal, not the bot app registration)
- **Key Vault reference identity**: All compute resources (Web App, both Function Apps) have `keyVaultReferenceIdentity` set to the MI's resource ID so KV-referenced app settings resolve correctly
- **SQL connection string**: Uses `Authentication=Active Directory Managed Identity;User Id=<MI-client-id>` (not `Active Directory Default`, because `Microsoft.Data.SqlClient` does not read the `AZURE_CLIENT_ID` environment variable)
- **Service Bus triggers**: Use identity-based connection with `Connection = "ServiceBus"` prefix — the Functions extension resolves `ServiceBus__fullyQualifiedNamespace` from app settings

---

## Security

### API Security

- **Rate limiting**: 10 write requests/minute per authenticated user (enforced via `RateLimitPolicy`)
- **Content Security Policy (CSP)**: `frame-ancestors 'self' teams.microsoft.com teams.cloud.microsoft.us;` (allows Teams iframe)
- **X-Content-Type-Options**: `nosniff` (prevents MIME type sniffing)
- **X-Frame-Options**: `SAMEORIGIN` (prevents clickjacking outside Teams)
- **Referrer-Policy**: `strict-origin-when-cross-origin`

### Input Validation

- **URL fields** (`ImageLink`, `ButtonLink`): Only `https://` scheme allowed (rejects `javascript:`, `file://`, internal IPs)
- **Content length**: Max 4 KB for title, 16 KB for summary
- **Markdown sanitization**: Summary field sanitized server-side (removes dangerous HTML)
- **Zod validation**: Frontend validates form before sending

### Data Protection

- **Export files**: Stored in private blob container (no public access)
- **Download tokens**: Short-lived SAS URLs (15-minute expiry)
- **Encryption at rest**: Azure handles (Storage, SQL, Key Vault)
- **Encryption in transit**: TLS 1.2+ enforced

### Identity and Access

- **Entra ID-only authentication** (no SQL passwords)
- **Managed identity for compute** (no credential management on App Service or Functions)
- **Group-based RBAC** (dynamic deprovisioning when user leaves group)
- **Audit logs**: Entra ID logs all app usage, Graph API logs calls

---

## Resilience and Fault Handling

### Transient Fault Handling

**EF Core**:
```csharp
.UseSqlServer(connectionString,
  options => options.EnableRetryOnFailure(
    maxRetryCount: 5,
    maxRetryDelay: TimeSpan.FromSeconds(30),
    errorNumbersToAdd: null))
```

Automatically retries on Azure SQL transient errors (40197, 40501, 40613, etc.).

**Graph SDK** (Microsoft.Graph v5):
```csharp
// Catch ODataError, handle 410 (expired delta link)
try {
  var users = await graphClient.Users.GetAsync();
} catch (ODataError ex) {
  if (ex.ResponseStatusCode == 410) { /* reset delta */ }
}
```

**Polly 8** (Resilience pipelines):
- Retry with exponential backoff (1s, 2s, 4s, 8s, etc.)
- Timeout: 30 seconds on Graph calls
- Circuit breaker: Open after 5 failures, close after 30 seconds

### Orchestration Resilience

- **Durable Functions**: Ensures each activity runs at least once (idempotent operations required)
- **Replay**: Orchestrator is replayed to recover state; side-effects only in activities
- **24-hour safety net**: Data aggregation loop has maximum 24-hour timeout to prevent stuck orchestrations
- **Dead-letter queue**: Permanent failures captured for manual review

### High Availability

- **Multi-instance**: App Service and Send Function auto-scale (2-10 instances minimum during peak)
- **Stateless design**: No session affinity required
- **Connection pooling**: EF Core and Graph SDK reuse connections
- **Queue durability**: Service Bus Standard tier with 14+ day message retention

---

## Monitoring and Observability

### Application Insights

Automatically collects:
- HTTP request metrics (latency, error rate)
- Dependency calls (SQL, Service Bus, Graph)
- Custom events (notification sent, delivery status)
- Exceptions and traces

**Key queries**:
```kusto
// Error rate last hour
requests
| where timestamp > ago(1h)
| where resultCode >= 400
| summarize ErrorCount=count() by resultCode

// Slow API calls
requests
| where duration > 1000
| top 20 by duration desc
```

### Log Analytics

Forward logs from:
- SQL Database (query, deadlock events)
- Service Bus (message processing, DLQ)
- Key Vault (secret access)
- Storage (blob operations)
- App Service (HTTP access logs)

**Key queries**:
```kusto
// Service Bus DLQ messages
ServiceBusDeadLetterMessage_CL
| where TimeGenerated > ago(24h)
| summarize count() by QueueName_s

// SQL slow queries
AzureDiagnostics
| where ResourceType == "DATABASES"
| where total_time_ms > 5000
```

---

## Deployment Architecture

### Environments

Three deployment environments with full isolation:

| Env | Resource Group | App Service SKU | SQL Tier | Notes |
|-----|---|---|---|---|
| **dev** | rg-cc-dev | S1 | Serverless 2vCore | Manual tests, feature dev |
| **stg** | rg-cc-stg | S1 | Serverless 4vCore | Load testing, pre-release validation |
| **prod** | rg-cc-prod | S2/P1v2 | Serverless 4-6vCore | Live users, monitoring |

### CI/CD Workflow

1. **Commit to main** triggers **CI** workflow (build, test, security scans)
2. **CI success** triggers **Deploy App** to dev
3. **Manual trigger** for stg and prod deployments (with approval gates for prod)
4. **Infrastructure changes** trigger **Deploy Infra** (validate, what-if, deploy)

---

## Next Steps

For deployment details, see [Setup Guide](setup-guide.md).

For local development, see [Local Development Guide](local-development.md).

For operations and monitoring, see [Operations Guide](operations.md).
