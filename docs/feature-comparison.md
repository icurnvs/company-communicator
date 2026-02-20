# Feature-by-Feature Comparison: Original vs. Modernized Company Communicator

> **Original**: Microsoft's open-source Company Communicator (last release ~2022, now abandoned)
> **Modernized**: Clean-room rebuild completed February 2026

---

## Executive Summary

| Dimension | Original | Modernized |
|-----------|----------|------------|
| **Runtime** | .NET 6 (out of support Nov 2024) | .NET 8 LTS (supported to Nov 2026) |
| **Bot SDK** | Bot Framework v4.21 (EOL Jan 2026) | M365 Agents SDK 1.4.x |
| **Database** | Azure Table Storage (NoSQL) | Azure SQL + EF Core 8 (relational) |
| **Frontend** | React 18 + Redux + CRA + Fluent v8/v9 | React 19 + TanStack Query + Vite + Fluent v9 |
| **Infrastructure** | ARM JSON (1,349 lines) | Bicep (12 modules) |
| **App registrations** | 3 (Author Bot + User Bot + Graph) | 1 (unified) |
| **Bots** | 2 (Author + User) | 1 (unified) |
| **Function Apps** | 3 (Prep + Send + Data) | 2 (Prep + Send; Data merged into Prep as Durable) |
| **Service Bus queues** | 4 | 3 |
| **Deployment** | Azure Pipelines + PowerShell 1,210-line script | GitHub Actions (4 workflows) + OIDC |
| **Auth model** | Client secret / certificate | Managed Identity + Teams SSO |

---

## 1. Message Composition & Content

| Feature | Original | Modernized |
|---------|----------|------------|
| **Adaptive Card format** | Yes (schema v1.2) | Yes (schema v1.4) |
| **Card library** | `AdaptiveCards` NuGet v1.2.4 | Pure `System.Text.Json.Nodes` (no NuGet dependency) |
| **Title** | Yes | Yes (max 200 chars, validated) |
| **Summary / body text** | Yes | Yes (max 4,000 chars, validated) |
| **Header image** | Yes (URL or base64 blob) | Yes (URL or Azure Blob, max 1,000 chars) |
| **Action button** | Yes (single URL button) | Yes (single URL button, HTTPS validated) |
| **Author attribution** | Yes | Yes |
| **Sent date stamp** | Yes | Yes |
| **Rich text (bold, italic, lists)** | No | No |
| **Multiple buttons** | No | No |
| **Interactive inputs (text fields, dropdowns)** | No | No |
| **Embedded inline images** | No | No |
| **Theme-aware rendering** | Basic (light/dark) | Full (default, dark, high-contrast via host config) |
| **Card preview before send** | Yes (sends to author via bot) | Yes (sends to author via bot) |
| **Frontend card preview** | No (sends actual message) | Yes (live in-browser preview via `adaptivecards` v3.0.4) |
| **Serialization** | Newtonsoft.Json | System.Text.Json |

**Verdict**: Feature-equivalent on content types, but modernized adds live in-browser card preview (no need to send a bot message just to see how the card looks), upgraded Adaptive Card schema (1.4 vs 1.2), and input validation.

---

## 2. Audience Targeting

| Feature | Original | Modernized |
|---------|----------|------------|
| **All Users** | Yes | Yes |
| **Specific Teams (channel delivery)** | Yes | Yes (General channel) |
| **Rosters (team members as individuals)** | Yes | Yes |
| **M365 Groups** | Yes | Yes |
| **Distribution Lists** | Yes (via Group endpoint) | Yes (via Group endpoint) |
| **Security Groups** | Yes (via Group endpoint) | Yes (via Group endpoint) |
| **CSV upload / bulk import** | No | No |
| **Individual user picker** | No | No |
| **Recipient exclusion / blacklist** | No | No |
| **Guest user filtering** | Yes (filters by UserType) | Yes (filters by UserType, marks NotSupported) |
| **Teams license validation** | Yes (checks Teams service plan GUID) | Yes (checks Teams service plan GUID) |
| **Disabled account filtering** | Yes (accountEnabled=true) | Yes (accountEnabled=true) |
| **Multi-select audiences** | Yes (combine Teams + Groups + All Users) | Yes (combine Teams + Rosters + Groups + All Users) |
| **Audience search** | Teams/Groups by name | Teams/Groups by name (async autocomplete) |
| **Graph delta sync** | Yes (for All Users) | Yes (for All Users) |

**Verdict**: Feature-equivalent. Both support the same audience types with the same filtering logic. Modernized adds per-recipient `NotSupported` status tracking for filtered-out users.

---

## 3. Scheduling

| Feature | Original | Modernized |
|---------|----------|------------|
| **Schedule for future** | Yes | Yes |
| **Minimum delay** | 5 minutes | 5 minutes |
| **Timer check interval** | Every 5 minutes | Every 5 minutes |
| **Recurring / cron schedules** | No | No |
| **Timezone support** | No (UTC only) | No (UTC only) |
| **Cancel scheduled** | Yes | Yes |
| **Safety net (forced completion)** | 24-hour delayed message | 24-hour delayed message |

**Verdict**: Feature-equivalent. Scheduling works identically in both versions.

---

## 4. Draft Management

| Feature | Original | Modernized |
|---------|----------|------------|
| **Create draft** | Yes | Yes |
| **Edit draft** | Yes (Draft status only) | Yes (Draft status only) |
| **Delete draft** | Yes (Admin permission) | Yes (Admin permission) |
| **Duplicate draft** | Yes (frontend copy) | Yes (frontend copy) |
| **Draft versioning** | No | No |
| **Draft auto-save** | No | No |
| **Collaborative editing** | No | No |
| **Draft → Send** | Yes | Yes |
| **Draft → Schedule** | Yes | Yes |

**Verdict**: Feature-equivalent. Draft lifecycle is identical.

---

## 5. Delivery Pipeline

| Feature | Original | Modernized |
|---------|----------|------------|
| **Architecture** | Durable Functions orchestrator | Durable Functions orchestrator |
| **Functions runtime** | Azure Functions v4 (in-process) | Azure Functions v4 (isolated worker) |
| **Prepare phase** | Dedicated Function App | Dedicated Function App (Durable) |
| **Send phase** | Dedicated Function App | Dedicated Function App (Consumption) |
| **Data aggregation** | Dedicated Function App (3rd) | Merged into Prep as Durable sub-orchestrator |
| **Service Bus queues** | 4 (prepare, send, data, export) | 3 (prepare, send, data) |
| **Export queue** | Separate SB queue | Inline in Prep Function (SB trigger + inline CSV) |
| **Service Bus tier** | Basic (no DLQ, no sessions) | Standard (DLQ support, sessions, topics available) |
| **Recipient sync** | Fan-out per audience type | Fan-out per audience type |
| **Batch size** | 100 messages per SB send | 100 messages per SB send |
| **Conversation creation** | Via Bot Framework `CreateConversationAsync` | Via Graph API `POST /users/{id}/teamwork/installedApps` |
| **Proactive install** | Optional (configurable) | Always-on (installs app then fetches ConversationId) |
| **Message delivery** | Bot Framework SDK `TurnContext.SendActivityAsync` | Direct HTTP to Bot Framework REST API |
| **Card caching** | In-memory (24h TTL) + blob fallback | In-memory (ConcurrentDictionary) + blob fallback |
| **Status transitions** | Draft → Queued → Syncing → Installing → Sending → Sent | Draft → Queued → SyncingRecipients → InstallingApp → Sending → Sent |

**Verdict**: Architecturally similar but modernized simplifies from 3 Function Apps to 2, upgrades to isolated worker (future-proof), uses Standard tier Service Bus (DLQ), and replaces Bot Framework conversation creation with Graph-based proactive installation (more reliable).

---

## 6. Retry & Throttle Handling

| Feature | Original | Modernized |
|---------|----------|------------|
| **Application-level retry** | Polly exponential backoff (DecorrelatedJitterBackoffV2) | Polly exponential backoff (DecorrelatedJitterBackoffV2) |
| **Max application retries** | 3 (configurable) | 3 |
| **Service Bus delivery count** | Max 10 (then dead-letter) | Max 10 (then dead-letter) |
| **429 handling** | Global throttle state in Table Storage | Global throttle state in SQL (ThrottleState table) |
| **Throttle delay** | Default 660s (11 min - 15s buffer) | Parsed from Retry-After header, default 30s |
| **Throttle scope** | Global (all instances) | Global (all instances) |
| **Re-queue mechanism** | Throw and re-process via SB | Explicit re-queue with `ScheduledEnqueueTime` |
| **Polly version** | Polly v7 | Polly v8 |

**Verdict**: Same strategy, but modernized uses more precise Retry-After parsing, explicit scheduled re-queue (cleaner than throw-and-retry), and SQL-based throttle state with optimistic concurrency.

---

## 7. Delivery Tracking & Status

| Feature | Original | Modernized |
|---------|----------|------------|
| **Aggregate counts** | Succeeded, Failed, RecipientNotFound, Throttled, Unknown | Succeeded, Failed, RecipientNotFound, Canceled, Unknown |
| **Per-recipient tracking** | Yes (SentNotificationData per row) | Yes (SentNotification per row) |
| **Per-recipient fields** | StatusCode, ConversationId, ServiceUrl, DeliveryStatus | StatusCode, ConversationId, ServiceUrl, DeliveryStatus, RetryCount, ErrorMessage, SentDate |
| **Error messages stored** | No (status code only) | Yes (full exception message) |
| **Retry count stored** | No | Yes |
| **Sent timestamp per recipient** | No | Yes |
| **Real-time UI updates** | Polling (periodic refresh) | Polling via TanStack Query (auto-refetch) |
| **WebSocket / SignalR** | No | No |
| **Read receipts** | No | No |
| **Status API** | Per-notification aggregate | Per-notification aggregate + per-recipient list |

**Verdict**: Modernized provides significantly richer per-recipient tracking (error messages, retry counts, timestamps) and exposes it through a dedicated status API endpoint.

---

## 8. Export & Reporting

| Feature | Original | Modernized |
|---------|----------|------------|
| **Export delivery report** | Yes | Yes |
| **Export format** | CSV | CSV |
| **Export trigger** | Manual (admin action) | Manual (admin action) |
| **Export processing** | Separate SB queue + Function trigger | Inline SB trigger in Prep Function |
| **Export storage** | Azure Blob (CSV file) | Azure Blob (CSV file) |
| **Download mechanism** | SAS URI | SAS URI (1-hour expiry) |
| **Export job tracking** | ExportData entity in Table Storage | ExportJob entity in SQL with status lifecycle |
| **Export fields** | RecipientId, Status | RecipientId, Name, Email, DeliveryStatus, ErrorMessage, SentDate |
| **Scheduled exports** | No | No |
| **Excel / PDF** | No | No |
| **Retention policy** | No | No |

**Verdict**: Both support CSV export, but modernized includes richer fields (name, email, error messages, timestamps) and has a formal job tracking entity with status lifecycle.

---

## 9. Bot Framework & SDK

| Feature | Original | Modernized |
|---------|----------|------------|
| **SDK** | Bot Framework v4.21.2 | M365 Agents SDK 1.4.x |
| **SDK status** | **EOL January 5, 2026** (repos archived) | Active development, supported |
| **Tenant type** | Multi-tenant (deprecated July 2025) | Single-tenant |
| **Number of bots** | 2 (Author Bot + User Bot) | 1 (unified) |
| **Author bot** | Full Teams Activity Handler (file uploads, channel events) | Unified handler (install/remove tracking only) |
| **User bot** | TeamsActivityHandler (member add/remove, team renames) | Same unified handler |
| **Bot adapter** | `CloudAdapter` | M365 Agents built-in hosting |
| **Middleware** | Custom tenant filter middleware | Custom tenant filter middleware |
| **Bot endpoints** | `/api/messages/user` + `/api/messages/author` | `/api/messages` (single) |
| **File upload** | Yes (consent flow via Author Bot) | No (removed — not needed for broadcast) |
| **Team rename tracking** | Yes | No (not needed) |
| **Proactive messaging** | `TurnContext.SendActivityAsync` | Direct HTTP to BF REST API |
| **Auth credential** | ConfigurationBotFrameworkAuthentication (client secret/cert) | `ClientSecretCredential` from Azure Identity |

**Verdict**: Major modernization. Replaces EOL Bot Framework SDK with supported M365 Agents SDK, collapses dual-bot into single bot, removes unused features (file upload, team rename), simplifies to a single endpoint.

---

## 10. Authentication & Authorization

| Feature | Original | Modernized |
|---------|----------|------------|
| **App registrations** | 3 (Author App, User App, Graph App) | 1 (unified) |
| **Auth library** | Microsoft.Identity.Web v2.13 + MSAL v4.56 | Microsoft.Identity.Web v3+ (backend OBO only) |
| **Frontend auth** | Teams SDK `getAuthToken()` | Teams SDK `getAuthToken()` (SSO) |
| **Token exchange** | On-behalf-of (OBO) | On-behalf-of (OBO) |
| **OAuth2 implicit flow** | Enabled in deploy script (security risk) | Not used (removed) |
| **Graph API access** | Dedicated Graph app registration + client secret | Managed Identity (user-assigned) |
| **Service Bus auth** | Connection string (with optional MI) | Managed Identity (explicit clientId) |
| **Storage auth** | Connection string (with optional MI) | Managed Identity (explicit clientId) |
| **SQL auth** | N/A (Table Storage) | Entra ID Managed Identity |
| **Key Vault auth** | Access policies | RBAC (Key Vault Secrets User role) |
| **Author policy** | UPN list (AuthorizedCreatorUpns) | UPN list + optional AAD group membership |
| **Admin policy** | UPN list (AuthorizedDeleteUpns) | UPN list + optional AAD group membership |
| **Certificate auth** | Supported (optional) | Not needed (MI everywhere) |
| **Secrets in code/config** | Client secrets via Key Vault references | Bot secret via Key Vault; everything else uses MI |
| **Content Security Policy** | No | Yes (SecurityHeadersMiddleware, Teams frame-ancestors) |

**Verdict**: Major security improvement. Eliminates OAuth2 implicit flow, consolidates 3 app registrations to 1, replaces connection strings with Managed Identity everywhere, adds CSP headers, and uses RBAC for Key Vault.

---

## 11. Data Storage

| Feature | Original | Modernized |
|---------|----------|------------|
| **Primary database** | Azure Table Storage (NoSQL) | Azure SQL Database (relational) |
| **ORM / SDK** | Azure.Cosmos.Table v1.0.1 (deprecated) | EF Core 8 |
| **Schema enforcement** | None (schemaless NoSQL) | Full (CHECK constraints, FK relationships, indexes) |
| **Querying** | PartitionKey + RowKey + limited OData filters | Full SQL (joins, GROUP BY, aggregates, paging) |
| **Transactions** | Batch within single partition (100 ops) | Full ACID transactions |
| **Migrations** | N/A (schemaless) | EF Core migrations (version-controlled schema) |
| **Auth** | Connection string or Managed Identity | Entra ID Managed Identity (enforced) |
| **Entities** | NotificationData, SentNotificationData, UserData, TeamData, GlobalSendingNotificationData, AppConfig, CleanUpHistory, ExportData | Notification, SentNotification, NotificationAudience, User, Team, ThrottleState, ExportJob, AppConfiguration |
| **Partition strategy** | Manual (Draft/Sent prefixes) | Relational indexes (composite covering indexes) |
| **Concurrency control** | ETag (Table Storage) | RowVersion (SQL optimistic concurrency) |
| **Pagination** | Continuation tokens | OFFSET/FETCH (SQL paging) |
| **Retry on transient** | Azure SDK built-in | EF Core `EnableRetryOnFailure(5, 30s)` |
| **Blob storage** | Adaptive Card JSON + base64 images | Adaptive Card JSON + images + export CSVs |
| **Cost model** | Per-transaction (can spike) | DTU/vCore-based (predictable) |

**Verdict**: Fundamental upgrade from NoSQL to relational. EF Core provides type-safe entities, proper relationships, CHECK constraints, migrations, full SQL querying, and ACID transactions — all impossible with Table Storage.

---

## 12. Infrastructure as Code

| Feature | Original | Modernized |
|---------|----------|------------|
| **IaC language** | ARM JSON (azuredeploy.json, 1,349 lines) | Bicep (12 modules + orchestrator) |
| **API versions** | 2015–2019 (many 8–10 years old) | 2023–2024 (current) |
| **Modularity** | Single monolithic template | 12 separate modules (MI, SQL, Storage, SB, KV, App, Func, Bot, etc.) |
| **Parameters** | JSON parameters file | .bicepparam file + environment overrides |
| **Government cloud** | GCC/GCCH/DOD variants (incomplete) | Not included (single commercial template) |
| **Front Door** | Optional (in ARM) | Not included |
| **App Service Plan** | Single plan (all apps) | Linux S1 (Web + Prep) + Windows Y1 Consumption (Send) |
| **SQL Database** | N/A (Table Storage) | Serverless GP Gen5 2vCore, Entra-only auth |
| **Diagnostics** | Log Analytics + App Insights | Log Analytics + App Insights + 7-resource diagnostic settings |
| **Alerts** | None | 4 metric alerts (CPU, HTTP errors, SB dead letters, throttle) |
| **Role assignments** | 7 (SB + Storage) | Full RBAC (Blob Owner, Queue Contrib, Table Contrib, SB Data Owner, KV Secrets User, SQL roles) |
| **CDN** | No | No |
| **Autoscaling** | No | No (Send Function auto-scales via Consumption) |

**Verdict**: Complete modernization from legacy ARM JSON to modular Bicep with current API versions, proper RBAC, diagnostic settings, alerts, and separate compute tiers for different workloads.

---

## 13. Deployment & CI/CD

| Feature | Original | Modernized |
|---------|----------|------------|
| **CI system** | Azure Pipelines (azure-pipelines.yml) | GitHub Actions (4 workflows) |
| **Deployment script** | PowerShell (deploy.ps1 — 1,210 lines) | GitHub Actions + `az` CLI |
| **App registration setup** | Automated in PowerShell (AzureAD module, deprecated) | Manual one-time setup (documented in setup guide) |
| **Auth to Azure** | 3 separate logins (Az, az cli, AzureAD) | OIDC federated credentials (zero secrets) |
| **Secrets in CI** | Azure DevOps service connections | GitHub Environment secrets (OIDC, no stored credentials) |
| **Environment gates** | None | Production requires manual approval |
| **Build agents** | Windows 2022 | Ubuntu latest |
| **Node version** | 16.x (EOL) | 20.x LTS |
| **.NET SDK** | 6.0.x (out of support) | 8.0.x LTS |
| **Security scanning** | Roslyn, ESLint, BinSkim, FxCop, ModernCop, Semmle, PoliCheck | NuGet vulnerability audit + npm audit |
| **Database deployment** | N/A (schemaless) | EF Core migrations (automated in deploy workflow) |
| **Health checks** | None post-deploy | `GET /health/ready` probe after deploy |
| **Dependency updates** | None | Dependabot (NuGet + npm + Actions, weekly, grouped PRs) |
| **Teams manifest packaging** | PowerShell in deploy script | Dedicated GitHub Action (token substitution + validate + zip) |
| **Kudu deployment** | Yes (deploy.cmd / deploy.app.cmd with MSBuild 14.0) | No (zip deploy via `az functionapp deployment`) |

**Verdict**: Completely replaces the fragile 1,210-line PowerShell script with 4 declarative GitHub Actions workflows. OIDC eliminates stored secrets. Health checks and Dependabot add operational safety.

---

## 14. Frontend Architecture

| Feature | Original | Modernized |
|---------|----------|------------|
| **React version** | 18.2 | 19 |
| **TypeScript** | 3.9.7 (6 major versions behind) | 5.x (strict mode) |
| **Build tool** | Create React App (react-scripts 5.0.1, Webpack 5) | Vite 6 (ESBuild + Rollup) |
| **State management** | Redux Toolkit 1.9.5 + React-Redux 8 | TanStack Query v5 (server state) + React Hook Form (form state) |
| **UI framework** | Fluent UI v8 (legacy) + v9 (partial migration) | Fluent UI v9 only |
| **Date library** | Moment.js 2.29 (maintenance-only) | date-fns v4 |
| **Router** | React Router DOM 6.11 | React Router DOM 7 |
| **Form handling** | Manual state management (800+ line component) | React Hook Form 7 + Zod validation |
| **Data fetching** | Manual fetch + Redux actions | TanStack Query (caching, dedup, auto-refetch) |
| **HTTP client** | Custom `apiDecorator` class (no retry, no timeout) | Custom `client.ts` (SSO token injection, JWT expiry parsing) |
| **Card rendering** | markdown-it (Markdown → HTML) | adaptivecards v3.0.4 (native AC rendering) |
| **Icons** | Font-Awesome 4.7 + Fluent Icons (duplicate) | Fluent UI Icons only |
| **Styling** | Mixed SCSS + CSS-in-JS (3 approaches) | Fluent v9 `makeStyles` only |
| **Validation** | Manual (in-component) | Zod schemas |
| **Code splitting** | No | Yes (lazy-loaded routes, 17 chunks) |
| **Bundle size** | Not optimized (CRA defaults) | ~365 KB gzipped |
| **ESLint** | Custom config with many disabled rules | Standard strict config |
| **Component patterns** | Mix of class + functional components | Functional components only (hooks) |
| **Error boundaries** | None | Yes |
| **Accessibility** | Basic Fluent v8 | Fluent v9 (WCAG 2.1), semantic HTML, ARIA labels |

**Verdict**: Complete frontend rewrite. Eliminates all legacy dependencies (CRA, Redux, Moment.js, Font-Awesome, Fluent v8, class components), replaces with modern equivalents, and adds code splitting, validation, error boundaries, and accessible patterns.

---

## 15. Localization / i18n

| Feature | Original | Modernized |
|---------|----------|------------|
| **Backend i18n** | RequestLocalization middleware + .resx files | RequestLocalization middleware + .resx files |
| **Frontend i18n** | i18next 22.5 + react-i18next 12.3 | i18next 23 + react-i18next |
| **Languages** | 16 (ar-SA, de-DE, en-US, es-ES, fr-FR, he-IL, ja-JP, ko-KR, pl-PL, pt-BR, ru-RU, zh-CN, zh-TW + 3 pseudo) | 16 (same set) |
| **Translation backend** | HTTP backend (loads from public/locales/) | HTTP backend (loads from locales/) |
| **Browser detection** | Yes | Yes |
| **Teams locale sync** | Yes | Yes |
| **RTL support** | No | No |
| **Backend translation coverage** | English + Polish .resx | English + Polish .resx (key messages) |

**Verdict**: Feature-equivalent. Same language coverage and approach in both versions.

---

## 16. User Roles & Authorization

| Feature | Original | Modernized |
|---------|----------|------------|
| **Author role** | UPN list (AuthorizedCreatorUpns) | UPN list + optional AAD group check |
| **Admin/Delete role** | UPN list (AuthorizedDeleteUpns) | UPN list + optional AAD group check |
| **Recipient role** | Implicit (has bot installed) | Implicit (has bot installed) |
| **Group-based auth** | No | Yes (optional GroupMembershipRequirement/Handler via Graph) |
| **Role management UI** | None (config file / deploy params) | None (Bicep params / Key Vault) |
| **Audit log** | None | None |
| **Granular permissions** | No (author = all write ops) | No (author = all write ops except delete) |
| **Tenant filtering** | Optional (DisableTenantFilter, AllowedTenants) | Optional (TenantId validation in JWT) |

**Verdict**: Modernized adds optional AAD group-based authorization (checking group membership via Graph API), but both versions share the same basic UPN-list model.

---

## 17. Teams Integration

| Feature | Original | Modernized |
|---------|----------|------------|
| **Manifest schema** | v1.5 | v1.17 |
| **Author experience** | Configurable tab (team scope) + personal tab | Personal tab only |
| **Author tab scope** | Team (configurable) + personal | Personal |
| **Recipient experience** | Bot delivers notification (personal + team) | Bot delivers notification (personal + team) |
| **Bot scopes** | Personal + Team (both bots) | Personal + Team (single bot) |
| **Message extension** | No | No |
| **Connector** | No | No |
| **SSO (webApplicationInfo)** | Not in manifest | Yes (Application ID URI in manifest) |
| **Teams SDK** | @microsoft/teams-js v2.11 | @microsoft/teams-js v2.x (latest) |
| **Theme support** | Light, Dark, High Contrast | Light, Dark, High Contrast |
| **Dialog support** | Yes (task modules) | Yes (dialog-hosted routes) |
| **Icons** | Custom (included) | Placeholder (generate-icons.ps1 provided) |
| **Valid domains** | Hardcoded | Token-substituted (`{{WEB_APP_HOSTNAME}}`) |
| **Separate manifests** | 2 (manifest_authors.json + manifest_users.json) | 1 (unified manifest.json) |
| **Manifest packaging** | PowerShell in deploy script | GitHub Action (validate + zip) |

**Verdict**: Modernized uses current manifest schema (v1.17 vs v1.5), adds SSO support, unifies to a single manifest, and removes the configurable team tab (authors use personal tab only).

---

## 18. Proactive App Installation

| Feature | Original | Modernized |
|---------|----------|------------|
| **Auto-install for users** | Optional (`ProactivelyInstallUserApp` setting) | Always-on |
| **Install method** | Bot Framework `CreateConversationAsync` | Graph API `POST /users/{id}/teamwork/installedApps` |
| **ConversationId retrieval** | From `CreateConversationAsync` response | `GET /users/{id}/teamwork/installedApps/{id}/chat` |
| **Team install** | Via Bot Framework | Graph API (install to team, fetch primary channel) |
| **Parallel batching** | Yes (fan-out per batch) | Yes (fan-out, max ~100 concurrent) |
| **Already-installed handling** | Check existing ConversationId | 409 Conflict = already installed (idempotent) |
| **App catalog requirement** | Yes (TeamsAppId parameter) | Yes (TeamsAppCatalogId parameter) |
| **User opt-out** | No | No |
| **Stale ConversationId handling** | No (uses cached value forever) | Yes (always overwrites with fresh Graph data) |

**Verdict**: Modernized switches from Bot Framework conversation creation to Graph API installation (more reliable, handles stale data). The original's optional install is now always-on, which eliminates "recipient not found" failures from missing installations.

---

## 19. API Layer

| Feature | Original | Modernized |
|---------|----------|------------|
| **Framework** | ASP.NET Core 6 (MVC controllers) | ASP.NET Core 8 (MVC controllers) |
| **Controllers** | 7 (Bot, Draft, Sent, Delete, Export, Team, Group, Health) | 5 (Notifications, Teams, Groups, Exports, Health) + Bot endpoint |
| **Notification CRUD** | Split across DraftNotificationsController + SentNotificationsController | Unified NotificationsController (10 endpoints) |
| **Rate limiting** | None | 10 writes/min per user (fixed window, OID-partitioned) |
| **Input validation** | Manual (in-controller) | InputValidator service (HTTPS URL validation, length limits) + Zod (frontend) |
| **Error responses** | Custom error objects | Standardized ProblemDetails (RFC 7807) |
| **Pagination** | Continuation tokens (Table Storage) | OFFSET/FETCH (page + pageSize params) |
| **Health endpoint** | Basic | Readiness probe (`/health/ready`) |
| **Serialization** | Newtonsoft.Json | System.Text.Json |
| **DTO models** | Inline / mixed with entities | 12 dedicated DTO models in Core/Models |
| **Response codes** | 200/400/500 | 200/201/202/204/400/404/409/424/429 (semantic) |

**Verdict**: Modernized consolidates 7 controllers to 5, adds rate limiting and RFC 7807 error responses, uses proper HTTP status codes, and separates DTOs from entities.

---

## 20. Observability & Monitoring

| Feature | Original | Modernized |
|---------|----------|------------|
| **Application Insights** | Yes | Yes (workspace-based) |
| **Log Analytics** | Yes (preview API version) | Yes (GA, centralized) |
| **Diagnostic settings** | None | 7 resources → Log Analytics |
| **Metric alerts** | None | 4 (CPU, HTTP 5xx, SB dead letters, throttle) |
| **Alert notifications** | None | Email via Action Group |
| **Structured logging** | Basic (ILogger) | ILogger + Application Insights telemetry |
| **Custom metrics** | None | None |
| **Distributed tracing** | Basic (App Insights SDK) | Basic (App Insights SDK) |
| **Dashboard** | None | None (Log Analytics queries available) |
| **Per-recipient trace** | No | No (aggregates only) |

**Verdict**: Modernized adds diagnostic settings, metric alerts, and email notifications — none of which existed in the original.

---

## 21. Security

| Feature | Original | Modernized |
|---------|----------|------------|
| **OAuth2 implicit flow** | Enabled (security risk) | Removed |
| **Content Security Policy** | None | Yes (Teams frame-ancestors) |
| **HTTPS enforcement** | Basic | URL validation (HTTPS-only for buttons/images) |
| **Secrets management** | Key Vault (access policies) | Key Vault (RBAC) |
| **Secrets in CI** | Service connection credentials | OIDC (zero stored secrets) |
| **Bot auth** | Client secret or certificate | Managed Identity + Key Vault secret |
| **SQL injection** | N/A (NoSQL) | Parameterized queries (EF Core) |
| **Rate limiting** | None | 10 writes/min per user |
| **Security scanning** | Roslyn, BinSkim, FxCop, Semmle (Azure DevOps) | NuGet vulnerability audit + npm audit |
| **Dependency management** | None | Dependabot (weekly grouped PRs) |
| **IP whitelisting** | None | None |
| **Connection strings** | Used for Storage + Service Bus | Eliminated (MI everywhere except bot secret) |

**Verdict**: Significant security improvements. Removes implicit flow, adds CSP, rate limiting, RBAC Key Vault, OIDC CI auth, and eliminates connection strings.

---

## 22. Developer Experience

| Feature | Original | Modernized |
|---------|----------|------------|
| **Setup complexity** | Run 1,210-line PowerShell script (3 logins, 3 app regs) | GitHub Actions (one-click), manual one-time app reg |
| **Local development** | Launch via Visual Studio (5 projects) | Launch via `dotnet run` + `npm run dev` |
| **Hot reload (frontend)** | Webpack Dev Server (CRA) | Vite HMR (near-instant) |
| **Hot reload (backend)** | `dotnet watch` | `dotnet watch` |
| **Documentation** | Wiki-style, partially outdated | Inline docs (setup-guide.md, local-development.md, operations.md, architecture.md) |
| **TypeScript strictness** | Strict mode but many `@ts-ignore` | Strict mode, zero errors |
| **Build time (frontend)** | Webpack (~30–60s) | Vite (~3–5s) |
| **npm install** | `--legacy-peer-deps` required | Clean install (no peer dep conflicts) |
| **Test coverage** | Azure DevOps security scans only | Unit test projects (3 test projects in solution) |

**Verdict**: Dramatically better developer experience with faster builds, cleaner TypeScript, simpler setup, and comprehensive documentation.

---

## 23. Known Limitations (Both Versions)

These limitations exist in both the original and modernized versions:

| Limitation | Original | Modernized |
|------------|----------|------------|
| No rich text formatting | Same | Same |
| No CSV/bulk recipient upload | Same | Same |
| No recurring schedules | Same | Same |
| No timezone support | Same | Same |
| No read receipts | Same | Same |
| No reply/feedback mechanisms | Same | Same |
| No shared channel delivery | Same | Same |
| No message pinning/importance | Same | Same |
| No offline mode | Same | Same |
| No audit log | Same | Same |
| No RTL layout support | Same | Same |
| No multi-region HA | Same | Same |
| No CDN for static assets | Same | Same |

---

## Summary Scorecard

| Category | Original | Modernized | Winner |
|----------|----------|------------|--------|
| Message content | Adaptive Card v1.2 | Adaptive Card v1.4 + live preview | Modernized |
| Audience targeting | Full | Full (equivalent) | Tie |
| Scheduling | Full | Full (equivalent) | Tie |
| Delivery pipeline | 3 Function Apps, in-process | 2 Function Apps, isolated worker | Modernized |
| Tracking & status | Basic (status code only) | Rich (errors, retries, timestamps) | Modernized |
| Export | Basic CSV | Rich CSV (names, emails, errors) | Modernized |
| Bot SDK | Bot Framework v4 (EOL) | M365 Agents SDK (supported) | Modernized |
| Authentication | 3 app regs, implicit flow | 1 app reg, MI, SSO | Modernized |
| Data storage | Table Storage (deprecated SDK) | Azure SQL + EF Core 8 | Modernized |
| Infrastructure | ARM JSON (2015 APIs) | Bicep (12 modules, current APIs) | Modernized |
| CI/CD | Azure Pipelines + 1,210-line script | GitHub Actions (4 workflows, OIDC) | Modernized |
| Frontend | React 18, Redux, CRA, Fluent v8/v9 | React 19, TanStack, Vite, Fluent v9 | Modernized |
| Localization | 16 languages | 16 languages | Tie |
| User roles | UPN-only | UPN + optional AAD group | Modernized |
| Teams integration | Manifest v1.5, 2 manifests | Manifest v1.17, 1 manifest, SSO | Modernized |
| Proactive install | Optional, Bot Framework | Always-on, Graph API | Modernized |
| API design | 7 controllers, no rate limiting | 5 controllers, rate limiting, RFC 7807 | Modernized |
| Monitoring | App Insights only | App Insights + alerts + diagnostics | Modernized |
| Security | Implicit flow, connection strings | MI everywhere, CSP, RBAC | Modernized |
| Developer experience | Complex setup, slow builds | Simple setup, fast builds | Modernized |
