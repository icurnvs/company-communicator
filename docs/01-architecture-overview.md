# Company Communicator - Architecture Overview

## 1. Purpose

Company Communicator is a Microsoft Teams application that enables designated authors to broadcast rich Adaptive Card notifications to targeted audiences within an organization. Recipients can include individual users, Teams channels, Microsoft 365 groups, distribution lists, security groups, or the entire organization.

## 2. High-Level Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           Microsoft Teams Client          │
                    │  ┌────────────┐    ┌──────────────────┐  │
                    │  │ Author Tab │    │ User Bot (notif) │  │
                    │  │ (React SPA)│    │                  │  │
                    │  └─────┬──────┘    └────────▲─────────┘  │
                    └────────┼────────────────────┼────────────┘
                             │                    │
                    ┌────────▼────────────────────┼────────────┐
                    │      ASP.NET Core 6 Web App              │
                    │  ┌─────────────┐  ┌────────────────────┐ │
                    │  │ REST API    │  │ Bot Controller     │ │
                    │  │ Controllers │  │ /api/messages/user │ │
                    │  │             │  │ /api/messages/auth │ │
                    │  └──────┬──────┘  └────────┬───────────┘ │
                    │         │                  │             │
                    │  ┌──────▼──────────────────▼───────────┐ │
                    │  │  Services: Graph, Auth, Repos, Blob │ │
                    │  └──────┬──────────────────────────────┘ │
                    └─────────┼────────────────────────────────┘
                              │
              ┌───────────────┼───────────────────────────┐
              │               │                           │
    ┌─────────▼──────┐ ┌─────▼───────────┐  ┌───────────▼────────┐
    │  Service Bus   │ │  Table Storage   │  │   Blob Storage     │
    │  4 Queues:     │ │  7 Tables:       │  │  - Adaptive Cards  │
    │  - prepare     │ │  - Notification  │  │  - Images (base64) │
    │  - send        │ │  - SentNotif     │  │  - Export files     │
    │  - data        │ │  - User/Team     │  │                    │
    │  - export      │ │  - AppConfig     │  │                    │
    │                │ │  - CleanUp/Export │  │                    │
    │                │ │  - GlobalSending │  │                    │
    └──┬──────┬──┬───┘ └─────────────────┘  └────────────────────┘
       │      │  │
    ┌──▼──┐┌──▼──┐┌──▼──┐
    │Prep ││Send ││Data │    Azure Functions v4
    │Func ││Func ││Func │    (.NET 6, Durable Tasks)
    └─────┘└─────┘└─────┘
```

## 3. Solution Projects

| Project | Framework | Role |
|---------|-----------|------|
| **CompanyCommunicator** | ASP.NET Core 6.0 | Main web app hosting React SPA + Bot endpoints + REST API |
| **CompanyCommunicator.Common** | .NET Standard 2.1 | Shared library: models, repositories, services, queue abstractions |
| **CompanyCommunicator.Prep.Func** | Azure Functions v4 (.NET 6) | Durable Functions orchestration: recipient sync, conversation creation, queue batching |
| **CompanyCommunicator.Send.Func** | Azure Functions v4 (.NET 6) | Message delivery: per-recipient send with throttle handling and retry |
| **CompanyCommunicator.Data.Func** | Azure Functions v4 (.NET 6) | Result aggregation: counts delivery results, finalizes notification status |

## 4. Dual-Bot Pattern

The application uses two separate Teams bots:

### Author Bot
- Used by message creators/administrators
- Provides a configurable tab for composing and managing messages
- Team scope only
- Handles file uploads for notification attachments
- Tracks channel add/remove events
- AAD App Registration: `{baseResourceName}-authors`

### User Bot
- Receives and displays notifications to end users
- Personal + team scope
- Notification-only (does not accept user input)
- Tracks member add/remove and team rename events
- AAD App Registration: `{baseResourceName}-users`

### Graph API App
- Third AAD app registration for Microsoft Graph API calls
- Permissions: User.Read.All, Directory.Read.All, TeamsAppInstallation.ReadWriteForUser.All, GroupMember.Read.All
- Used for: user enumeration, group member listing, app installation management
- AAD App Registration: `{baseResourceName}`

**Total: 3 Azure AD app registrations required**

## 5. Azure Resources

| Resource | SKU/Tier | Purpose |
|----------|----------|---------|
| Storage Account | Standard_LRS | Table Storage (7 tables) + Blob Storage |
| Service Bus Namespace | Basic | 4 message queues for async processing |
| App Service Plan | Configurable (Standard default) | Hosts web app + 3 function apps |
| Web App (App Service) | - | Main application (ASP.NET Core + React) |
| Function App x3 | - | Prep, Send, Data processing |
| Bot Service x2 | - | Author bot + User bot registrations |
| Teams Channel x2 | - | Teams channel config for both bots |
| Key Vault | Standard | Secrets: connection strings, app credentials (6 secrets) |
| Log Analytics Workspace | - | Centralized logging |
| Application Insights | - | Telemetry and monitoring |
| Front Door (optional) | - | Custom domain routing |
| Role Assignments x7 | - | Service Bus Data Owner + Storage Blob Data Contributor |

## 6. Authentication & Authorization

### Authentication Stack
- **Microsoft Identity Web** (v2.13.4) - Modern OIDC/JWT middleware
- **Bot Framework Authentication** - Bot-to-bot and bot-to-service auth
- Supports both **client secret** and **X.509 certificate** authentication
- Optional **Managed Identity** for Service Bus and Storage access

### Authorization Model
- **AuthorizedCreatorUpns** - Semicolon-delimited list of UPNs allowed to create messages
- **AuthorizedDeleteUpns** - Semicolon-delimited list of UPNs allowed to delete messages
- **Tenant Filtering** - Can restrict to specific Azure AD tenants
- Both checks can be disabled via configuration flags

### Policies
- `MustBeValidUpnPolicy` - Validates creator UPN against authorized list
- `MSGraphScopePolicy` - Requires GroupMember.Read.All scope
- `MustBeValidDeleteUpnPolicy` - Validates delete action UPN

## 7. Data Storage Design

### Azure Table Storage
All data persisted in Azure Table Storage using the `Microsoft.Azure.Cosmos.Table` SDK.

| Table | PartitionKey | RowKey | Purpose |
|-------|-------------|--------|---------|
| NotificationData | "DraftNotifications" or "SentNotifications" | Notification ID | Message metadata, audience, status, counts |
| SentNotificationData | Notification ID | Recipient AAD ID | Per-recipient delivery status and tracking |
| UserData | "UserData" | AAD ID | User cache from Graph (name, email, ConversationId) |
| TeamData | Default partition | Team ID | Team metadata (name, ServiceUrl, TenantId) |
| AppConfig | Config partition | Config key | App configuration entities |
| CleanUpHistory | Default partition | History ID | Audit trail of deleted messages |
| ExportData | Default partition | Export ID | Export job tracking |
| GlobalSendingNotificationData | Global partition | Sending state key | Global throttle state |

### Azure Blob Storage
- Adaptive Card JSON templates (1 per notification)
- Base64-encoded images for notifications
- Export output files

### Repository Pattern
- `BaseRepository<T>` abstract class provides CRUD, batch (100 per op), filtered queries, pagination, async streaming
- All repositories registered as Singletons in DI

## 8. Message Queue Architecture

| Queue Name | Trigger Source | Payload | Handler |
|------------|---------------|---------|---------|
| cc-prepare-to-send-queue | Web App (submit) or Timer (schedule) | NotificationId | Prep.Func |
| cc-send-queue | Prep.Func orchestrator | NotificationId + RecipientData | Send.Func |
| cc-data-queue | Prep.Func + self-requeue | NotificationId + ForceComplete flag | Data.Func |
| cc-export-queue | Web App (export request) | ExportDataRequirement | Prep.Func (export) |

### Queue Implementation
- `BaseQueue<T>` abstraction over Azure.Messaging.ServiceBus
- Supports: single send, batch send (max 100), delayed send (ScheduleMessageAsync)
- JSON serialization via Newtonsoft.Json
- Supports connection strings or Managed Identity

## 9. Resilience Patterns

### Polly Retry (Message Sending)
- Policy: DecorrelatedJitterBackoffV2
- Base delay: 1 second median
- Configurable max attempts (default: 3)
- Retries on: HTTP 429 (TooManyRequests), 5xx server errors
- No retry on: 201 (success), 404 (not found)

### Service Bus Dead Letter
- Max delivery count: 10 attempts
- After 10 failures: mark as FinalFaultedStatusCode (-2)
- No further retries

### Global Throttle
- GlobalSendingNotificationDataEntity tracks throttle state
- On 429: sets SendRetryDelayTime = now + delay (default 660 seconds)
- All Send.Func instances check global state before sending
- Prevents thundering herd

### Data Aggregation Polling
- Adaptive delay: 10 seconds for first 10 minutes, 60 seconds after
- Force-complete safety net at 24 hours
- Self-requeuing DataQueue messages

## 10. Localization

### Backend
- .resx resource files (English + Polish)
- RequestLocalization middleware
- Configurable DefaultCulture and SupportedCultures

### Frontend
- i18next with HTTP backend
- 16 language variants: ar-SA, de-DE, en-US, es-ES, fr-FR, he-IL, ja-JP, ko-KR, pl-PL, pt-BR, ru-RU, zh-CN, zh-TW + 3 pseudo-locale variants
- Browser language detection
- Synced with Teams client locale
