# Company Communicator v2 - Rebuild Plan Review

**Date:** 2026-02-17
**Reviewers:** Architecture, Security, C#/.NET, React/Frontend, Cloud Infrastructure
**Subject:** Clean-room rebuild plan (doc 06) reviewed against analysis docs (01-05)

---

## Executive Summary

The rebuild plan is **architecturally sound**. All five reviewers approved the core decisions: clean-room rebuild over patching, technology stack selections, and the key simplifications (3 app registrations to 1, 3 Function Apps to 2, Table Storage to Azure SQL). No reviewer recommended reverting any major architectural decision.

However, the reviews surfaced **37 findings** across all domains -- several of which would cause build failures or runtime crashes if unaddressed. The highest-impact items are: Durable Functions isolated worker API changes (build-breaking), MSAL auth incompatibility with Teams iframe (runtime failure), missing SQL indexes on the high-volume table (performance), and incomplete Storage Account RBAC for Functions runtime (startup failure).

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 14 |
| MEDIUM | 15 |
| LOW | 6 |

---

## 1. Universally Approved Decisions

These decisions were endorsed by all relevant reviewers without reservation.

| Decision | Reviewers | Rationale |
|----------|-----------|-----------|
| Clean-room rebuild over incremental patching | All | 42 issues (7 critical), EOL runtime + SDK make patching infeasible |
| .NET 8 LTS | Architecture, C# | Correct over .NET 9 STS for production stability |
| M365 Agents SDK replacing Bot Framework | Architecture, C#, Security | Only viable path; Bot Framework EOL Jan 5, 2026 |
| Single Entra ID app registration (was 3) | Architecture, Security | No capability loss for single-tenant; eliminates 2/3 of credential surface |
| Single bot handler (was 2) | Architecture, C# | Handlers differ by conversation type, not identity |
| 2 Function Apps (was 3), merge Data into Prep | Architecture, C# | Data.Func was lightweight polling; Durable timer loop replaces it cleanly |
| 3 queues (was 4), eliminate data queue | Architecture | Self-requeuing polling replaced by direct activity calls |
| Azure SQL + EF Core 8 (was Table Storage) | Architecture, C# | Eliminates JSON-serialized arrays, enables proper aggregation queries |
| Service Bus Standard tier (was Basic) | Architecture, Security, Infra | Enables DLQ, scheduled delivery, duplicate detection |
| React 19 + Vite + Fluent UI v9 + TanStack Query | Frontend | All current-gen; no viable incremental path from CRA + TS 3.9 |
| TanStack Query replacing Redux | Frontend | App state is entirely server-driven; Redux added only boilerplate |
| Bicep modules replacing ARM JSON | Infra | Strictly better; the 1,349-line ARM template was unmaintainable |
| Managed Identity + RBAC (was connection strings) | Security, Infra | Eliminates credential leakage risk for SQL, Service Bus, Storage, Key Vault |
| Key Vault RBAC model (was access policies) | Security, Infra | Granular, auditable control via Azure IAM |
| Azure SQL Entra-only auth (no SQL passwords) | Security, Infra | Gold standard; eliminates entire class of credential attacks |
| MSAL + PKCE replacing implicit flow | Security | Most impactful security improvement; tokens no longer in URL fragments |

---

## 2. Critical Findings (Must Fix Before Implementation)

### CRIT-1: Durable Functions Isolated Worker API is Completely Different [C#]

**Impact:** Build failure. The plan references in-process Durable Functions patterns that do not exist in isolated worker model.

| In-Process (plan references) | Isolated Worker (required) |
|------------------------------|---------------------------|
| `IDurableOrchestrationContext` | `TaskOrchestrationContext` |
| `Microsoft.Azure.WebJobs.Extensions.DurableTask` | `Microsoft.DurableTask` |
| `RetryOptions` | `TaskRetryOptions` / `RetryPolicy` |
| `context.CallActivityWithRetryAsync(name, retryOptions, input)` | `context.CallActivityAsync(name, input, TaskOptions.FromRetryPolicy(...))` |

The orchestrator, sub-orchestrator, and activity function signatures all change. `context.CreateReplaySafeLogger<T>()` replaces `!context.IsReplaying` guards. The Functions `Program.cs` must call `worker.UseDurableTask()`.

**Action:** Update all Durable Functions code patterns to isolated worker API before implementation begins.

### CRIT-2: MSAL React Redirect Flow Does Not Work in Teams Iframe [Frontend]

**Impact:** Runtime auth failure. MSAL's redirect-based auth flow is blocked by Teams' iframe sandboxing.

**Options:**
- **Option A (recommended):** Use `authentication.getAuthToken()` from Teams JS SDK for SSO, send token to backend, backend does OBO exchange. Remove `@azure/msal-browser` and `@azure/msal-react` entirely.
- **Option B:** Use `acquireTokenPopup` (not redirect), but silent renewal has issues in some Teams clients.

For a Teams-exclusive tab where all Graph calls go through the backend API, Option A is strictly simpler and eliminates two packages.

**Action:** Decide auth strategy (Teams SSO vs. MSAL popup) and update the frontend stack accordingly.

---

## 3. High-Priority Findings

### Architecture

#### ARCH-H1: Data Aggregation Polling Mechanism Not Specified

The plan says the data queue is "replaced by direct activity calls + timer" but does not define how aggregation polls until all sends complete. The Durable Functions orchestrator finishes queuing messages long before delivery completes.

**Recommended:** Use a Durable Functions timer loop within the orchestrator:

```csharp
while (!isComplete)
{
    var delay = (context.CurrentUtcDateTime - sendingStarted).TotalMinutes < 10
        ? TimeSpan.FromSeconds(10) : TimeSpan.FromSeconds(60);
    await context.CreateTimer(context.CurrentUtcDateTime.Add(delay), CancellationToken.None);
    var result = await context.CallActivityAsync<AggregationResult>(
        nameof(DataAggregationActivity), notificationId);
    isComplete = result.IsComplete;
}
```

This preserves the original's adaptive delay semantics. Include the 24-hour force-complete safety net as a `context.CurrentUtcDateTime` check inside the loop.

### Security

#### SEC-H1: UPN-Based Authorization Should Migrate to Entra ID Groups

`AuthorizedCreatorUpns` / `AuthorizedDeleteUpns` are static config lists with no automatic deprovisioning, no audit trail, and no self-service delegation. UPNs can be reassigned when employees leave.

**Recommended:** Replace with Entra ID security groups (`CompanyCommunicator-Authors`, `CompanyCommunicator-Admins`). Configure the app registration to emit `groups` or `roles` claims. Provides automatic deprovisioning, audit trails, and group-owner delegation.

#### SEC-H2: No Rate Limiting on REST API Endpoints

An authenticated author (or compromised token) could flood the system. Use ASP.NET Core's built-in `Microsoft.AspNetCore.RateLimiting` middleware with per-user limits on write operations.

#### SEC-H3: No Content Security Policy Headers

Without CSP, the SPA is vulnerable to XSS. Add CSP middleware with `frame-ancestors` allowing Teams origins. Also add `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and `Referrer-Policy` headers.

#### SEC-H4: No Input Validation Strategy for Notification Content

`ImageLink` and `ButtonLink` could be `javascript:` URIs or internal network addresses (SSRF). `Summary` accepts markdown with XSS potential. Server-side: allow only `https://` scheme for URLs, enforce max content lengths, sanitize markdown.

### C# / .NET

#### CS-H1: M365 Agents SDK Config Key Paths Need Verification

The `appsettings.json` shows `Connections:ServiceConnection:Settings:AuthType: ClientSecret` but the plan specifies Managed Identity for all services. Also, `AddAgentAspNetAuthentication()` may expect keys under `AgentApplicationOptions`, not the `Connections` structure shown. Verify exact config paths against the SDK version you pin.

**Also:** Consider `AuthType: ManagedIdentity` for the bot service connection in Function Apps to avoid replicating the client secret across three compute surfaces.

#### CS-H2: Missing Covering Index on SentNotifications for Aggregation

The `UNIQUE(NotificationId, RecipientId)` serves upserts but not the aggregation query `GROUP BY DeliveryStatus`. At 50K+ rows per notification:

```sql
CREATE NONCLUSTERED INDEX IX_SentNotifications_NotificationId_DeliveryStatus
    ON SentNotifications (NotificationId, DeliveryStatus)
    INCLUDE (SentDate, StatusCode);
```

#### CS-H3: `nvarchar(max)` on High-Volume SentNotifications Table

`ErrorMessage nvarchar(max)` causes LOB page overflow and kills covering index effectiveness. Cap at `nvarchar(1000)` and log full stack traces to Application Insights instead.

#### CS-H4: Graph v5 Exception Type Changed

Code must catch `ODataError` (not `ServiceException`). Delta link expiration returns HTTP 410. Polly policy must use `ODataError.ResponseStatusCode` for retry decisions. Polly 8 `ResiliencePipeline` replaces Polly 7 `IAsyncPolicy`.

#### CS-H5: `IMemoryCache` Wrong for Distributed Send Function

Multiple Send Function instances each maintain separate in-memory caches. Replace with `static ConcurrentDictionary<string, string>` which persists across invocations within the same process and avoids unnecessary cache eviction machinery.

### Infrastructure

#### INFRA-H1: Send Function Must Have Its Own App Service Plan

The plan requires independent scaling for Send Function but puts all compute on a shared plan. During a 50K-recipient broadcast, Send competes with the Web App and Prep Function.

**Recommended:** Consumption plan for Send Function (near-zero cost at idle, auto-scales to hundreds of instances). Move to Elastic Premium EP1 only if cold starts cause issues.

#### INFRA-H2: Storage Account RBAC Is Incomplete for Functions Runtime

Functions runtime with managed identity requires:
- `Storage Blob Data Owner` (not just Contributor -- needs lease management)
- `Storage Queue Data Contributor` (internal trigger coordination)
- `Storage Table Data Contributor` (Durable Functions history tracking)

Without these, Function Apps fail to start.

#### INFRA-H3: No Dead-Letter Queue Monitoring/Alerting

DLQ messages mean users didn't receive notifications. Add metric alert: `DeadletteredMessages > 0` on the Service Bus namespace, firing to an Action Group.

### Frontend

#### FE-H1: No Form Library for Complex Notification Form

The notification form has 7+ validated fields, conditional audience pickers, file upload, date/time scheduling, and 2-step wizard flow. Raw `useState` + Zod will reproduce the original's 800-line component.

**Recommended:** Add `react-hook-form` 7.x + `@hookform/resolvers` 3.x. Use `z.discriminatedUnion` for audience type validation.

---

## 4. Medium-Priority Findings

### Architecture

| ID | Finding | Recommendation |
|----|---------|----------------|
| ARCH-M1 | Azure SQL scaling at 50K concurrent writes needs DTU sizing | S3 (100 DTU) or P1 for production; serverless GP Gen5 2vCore for cost optimization |
| ARCH-M2 | No data retention/cleanup strategy for SentNotifications | Add timer-triggered cleanup; archive to blob after 90 days |

### Security

| ID | Finding | Recommendation |
|----|---------|----------------|
| SEC-M1 | No diagnostic/security logging strategy | Enable diagnostic settings on SQL, Service Bus, Key Vault, Storage; forward to Log Analytics |
| SEC-M2 | No network isolation (all public endpoints) | VNet integration + private endpoints for SQL, Service Bus, Storage, Key Vault. At minimum, enable service firewalls. |
| SEC-M3 | `Storage Blob Data Contributor` may be overly broad | Scope RBAC to specific containers rather than entire storage account |
| SEC-M4 | Token validation config missing explicit issuer check | Verify M365 Agents SDK auto-validates issuer from TenantId; if not, add explicit issuer |
| SEC-M5 | Export files contain PII without access controls | Ensure private container access; use short-lived read-only SAS tokens for download |

### C# / .NET

| ID | Finding | Recommendation |
|----|---------|----------------|
| CS-M1 | Users table missing `HasTeamsLicense` flag | Add flag + `LicenseCheckedDate`; use Graph `$filter` on `assignedPlans` instead of N+1 license checks |
| CS-M2 | `AppDbContext` must never be injected into orchestrator classes | Orchestrators are replayed; only activities may use DbContext |
| CS-M3 | No `ThrottleState` entity in proposed schema | Add entity with `RowVersion` concurrency token for optimistic locking |
| CS-M4 | Aggregation must use SQL `GROUP BY`, not load 50K rows | `dbContext.SentNotifications.Where(...).GroupBy(s => s.DeliveryStatus).Select(...)` |
| CS-M5 | EF Core `EnableRetryOnFailure` not mentioned | Required for Azure SQL transient faults; 5 retries, 30s max delay |

### Infrastructure

| ID | Finding | Recommendation |
|----|---------|----------------|
| INFRA-M1 | Azure SQL SKU not specified | Serverless GP Gen5 2vCore with auto-pause at 60 min (est. $150-180/mo vs $370 provisioned) |
| INFRA-M2 | No diagnostic settings on platform services | Add `modules/diagnostics.bicep` forwarding all resource logs to Log Analytics |
| INFRA-M3 | Service Bus queue properties not specified | Define max delivery count, lock duration, TTL, duplicate detection per queue |
| INFRA-M4 | No Action Group for alerts | Create action group with email/Teams webhook; wire to DLQ, DTU, error rate alerts |
| INFRA-M5 | SQL firewall rules not configured | Default denies all access; must allow App Service/Function outbound IPs or use private endpoints |

### Frontend

| ID | Finding | Recommendation |
|----|---------|----------------|
| FE-M1 | Adaptive Card preview uses direct DOM manipulation | Original calls `document.getElementsByClassName(...).innerHTML = ''`. In React 19 with concurrent rendering, use stable `ref` + `useEffect` + `useDeferredValue` |
| FE-M2 | No TanStack Query key factory defined | Establish `api/queryKeys.ts` with hierarchical key structure for consistent cache invalidation |

---

## 5. Low-Priority Findings

| ID | Domain | Finding | Recommendation |
|----|--------|---------|----------------|
| ARCH-L1 | Architecture | File upload flow needs explicit routing in unified handler | Confirm `OnTeamsFileConsentAcceptAsync` override in `CommunicatorActivityHandler` |
| CS-L1 | C# | `Notifications.Status` has no CHECK constraint | Add constraint with all valid values including `SyncingRecipients`, `InstallingApp` |
| CS-L2 | C# | `NotificationAudiences` missing index on `NotificationId` | Add nonclustered index; primary read pattern is `WHERE NotificationId = @id` |
| SEC-L1 | Security | No dependency scanning in CI/CD | Enable Dependabot, add `dotnet list package --vulnerable` and `npm audit` to CI |
| SEC-L2 | Security | Health endpoint authentication not specified | Restrict or authenticate if it exposes internal details |
| INFRA-L1 | Infra | No resource tagging strategy | Define `application`, `environment`, `managedBy` tags in `main.bicep` |
| FE-L1 | Frontend | Teams dialog vs route navigation needs explicit planning | Map which views are dialog-hosted vs main-frame routes in `App.tsx` |

---

## 6. Revised Stack Recommendations

Based on all reviews, the following stack changes are recommended:

### Packages to Remove
| Package | Reason |
|---------|--------|
| `@azure/msal-browser` | Teams SSO via Teams JS SDK is simpler and avoids iframe issues |
| `@azure/msal-react` | Same as above |

### Packages to Add
| Package | Version | Reason |
|---------|---------|--------|
| `react-hook-form` | 7.x | Complex notification form needs proper form management |
| `@hookform/resolvers` | 3.x | Zod integration with react-hook-form |
| `@tanstack/react-query-devtools` | 5.x (dev) | Essential for debugging query cache during development |
| `@fluentui/react-datepicker-compat` | latest | v9-compatible date/time picker without pulling in Fluent v8 |

### Backend Packages to Verify
| Package | Note |
|---------|------|
| `Microsoft.DurableTask` (isolated worker) | Replaces `Microsoft.Azure.WebJobs.Extensions.DurableTask` |
| `Microsoft.Extensions.Resilience` | Polly 8 integration for .NET 8 |

---

## 7. Cost Estimate (Single-Tenant, 5K-50K Users)

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

## 8. Disaster Recovery Gaps

| Gap | Priority | Recommendation |
|-----|----------|----------------|
| No SQL backup retention configured | HIGH | Set PITR to 14-35 days; consider weekly LTR for 12 weeks |
| No DLQ monitoring | HIGH | Alert on `DeadletteredMessages > 0` |
| No multi-region strategy documented | MEDIUM | Accept single-region; document manual recovery runbook |
| No deployment slots | LOW | Add staging slot on Web App for zero-downtime deploys |

---

## 9. Implementation Phase Impact

The findings affect each implementation phase as follows:

| Phase | Critical Changes | High Changes |
|-------|-----------------|--------------|
| Phase 1: Foundation | Durable Functions isolated worker types (CRIT-1); SQL indexes + schema fixes (CS-H2, CS-H3); Bicep: separate Send plan (INFRA-H1), fix Storage RBAC (INFRA-H2) |  Add diagnostics module, queue configs, SQL SKU |
| Phase 2: Core Services | M365 Agents SDK config verification (CS-H1); Graph v5 error handling (CS-H4); ThrottleState entity (CS-M3) | Entra group-based auth (SEC-H1); EnableRetryOnFailure |
| Phase 3: API Layer | Input validation (SEC-H4) | Rate limiting (SEC-H2); CSP headers (SEC-H3) |
| Phase 4: Functions | Timer loop for aggregation (ARCH-H1); `TaskOrchestrationContext` throughout (CRIT-1); Static card cache (CS-H5) | GROUP BY aggregation (CS-M4); DbContext lifetime rules (CS-M2) |
| Phase 5: Frontend | Auth strategy decision (CRIT-2) | react-hook-form (FE-H1); query key factory (FE-M2); Adaptive Card ref pattern (FE-M1) |
| Phase 6: Integration | | DLQ alerts (INFRA-H3); Action Group (INFRA-M4); Network isolation (SEC-M2) |

---

## 10. Approval Status

| Reviewer | Verdict |
|----------|---------|
| Architecture | **APPROVED** with 1 high-priority recommendation (aggregation polling design) |
| Security | **APPROVED** with 2 critical (UPN auth, rate limiting) and 4 high hardening items |
| C# / .NET | **APPROVED** with 5 high-priority implementation corrections |
| Frontend | **APPROVED** with 1 critical (auth strategy) and 1 high (form library) |
| Infrastructure | **APPROVED** with 3 high-priority Bicep changes |

**Overall: APPROVED for implementation, contingent on addressing CRIT-1 and CRIT-2 before coding begins.**
