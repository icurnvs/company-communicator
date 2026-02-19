# Proactive Bot Installation Implementation Plan v5 (Personal + Team Scope)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable end-to-end notification delivery for both personal-scope (user DM) and team-scope (General channel) recipients by proactively installing the Teams bot where needed, then copying ConversationIds into SentNotification records before enqueuing sends.

**Architecture:** Two delivery paths unified in one pipeline. Personal-scope: windowed fan-out install via Graph `POST /users/{id}/teamwork/installedApps` with keyset cursor pagination (50k scale). Team-scope: simple sequential install via Graph `POST /teams/{id}/installedApps` (small scale, ~50 teams max). Both paths share the same polling-refresh loop and send queue. `SyncRecipientsOrchestrator` routes `AudienceType.Team` to a new `SyncTeamChannelActivity` (one SentNotification per team) instead of `SyncTeamMembersActivity` (individual users). A new `AadGroupId` column on the `Team` entity bridges the AAD group ID (used by Graph/UI) to the Bot Framework thread ID (used for sending).

**Tech Stack:** .NET 8, EF Core 8 (Azure SQL), Microsoft Graph SDK v5, Azure Durable Functions (isolated worker), Polly 8 resilience, Bicep IaC

**Scale target:** 50,000 users + ~50 teams per notification

---

## Execution Status (2026-02-18)

All tasks complete. 12 commits, 5 review checkpoints passed, final verification 30/30.

| Task | Description | Status | Commit |
|------|-------------|--------|--------|
| 0 | GUID validation at API boundary | DONE | `77111f7` |
| 1 | Add InstallAppForUserAsync to IGraphService | DONE | `a404f05` |
| 2 | Implement InstallAppForUserAsync in GraphService | DONE | `b7381e1` |
| 3 | Patch RecipientService ConversationId/ServiceUrl | DONE | `042d037` |
| 4 | SQL index + Team.AadGroupId + EF migration | DONE | `f55cad4` |
| 5 | Model records for install orchestration | DONE | `bac55aa` |
| 6 | InstallAppInTeamAsync (Graph team-scope) | DONE | `57c3513` |
| 7 | Bot handler AadGroupId population | DONE | `82f25ca` |
| 8 | Install pipeline activities (7 files) | DONE | `1879218` |
| 9 | SyncTeamChannelActivity | DONE | `0be6242` |
| 10 | InstallAppOrchestrator | DONE | `280b88a` |
| 11 | SyncRecipientsOrchestrator Team routing | DONE | `fadf60a` |
| 12 | Wire into PrepareToSendOrchestrator | DONE | `54b1f71` |
| 13 | Bicep + host.json | DONE | `0a2ad3d` |
| 14 | Documentation | DONE | `ea6f056` |

Post-implementation fixes (from code review findings):
| Fix | Description | Commit |
|-----|-------------|--------|
| F1 | Preserve deadline across ContinueAsNew boundaries | DONE | `d551840` |
| F2 | Add retry options to catch-path activities | DONE | `d551840` |
| F3 | Restore PrepareToSendOrchestrator XML docs + fix backoff wording | DONE | `d551840` |

---

## Review Findings Incorporated

All findings from v2 and v3 panels remain incorporated (see original plan for full tables). Team-scope additions introduce no new scale concerns — team count is orders of magnitude smaller than user count.

### v5 Review Findings (2026-02-18)

Four specialist agents reviewed v4 in parallel (efficiency, best practices, scalability, security). All findings below are incorporated into the task descriptions.

| # | Severity | Source | Finding | Resolution |
|---|----------|--------|---------|------------|
| 1 | Critical | Efficiency + Scalability | Composite index degrades as rows resolve; `ConversationId IS NULL` can't seek efficiently | Replaced with filtered partial index in Task 4 |
| 2 | Critical | Scalability | Bicep defaults `waitSeconds=30`/`maxAttempts=3` create 90s polling window — too short | Fixed to 60/20 in Task 13 |
| 3 | Critical | Scalability | Orchestrator history bloat at 50k users (~2,750+ events) | Added `ContinueAsNew` checkpointing in Task 10 |
| 4 | Major | Efficiency + Scalability + Best Practices | Double `MarkUnreachableActivity` call is wasteful when install enabled | Made conditional in Task 12 |
| 5 | Major | Security + Scalability | Late callbacks race with MarkUnreachable — recipients permanently dropped | Added final Refresh before MarkUnreachable in Task 12 |
| 6 | Medium | Security | `AudienceId` not validated as GUID at API boundary | Added prerequisite task (Task 0) |
| 7 | Medium | Security + Best Practices | ChannelData fallback: no GUID validation, empty catch block | Hardened in Task 7 |
| 8 | Major | Best Practices | No error resilience around install sub-orchestrator | Added try/catch in Task 12 |
| 9 | Major | Best Practices | `SyncTeamChannelActivity` no duplicate guard | Added existence check in Task 9 |
| 10 | Minor | Efficiency | `GetInstallBatchActivity` fires N sequential SQL queries | Collapsed to single query in Task 8 |
| 11 | Minor | Efficiency | Fixed polling interval wastes time | Adaptive backoff in Task 10 |
| 12 | Major | Scalability | Serial Graph calls within activity underutilize throughput | Added semaphore parallelism in Task 8 |
| 13 | High | Security | Graph permissions blast radius (ReadWrite for all users + teams) | Documented in Task 14; monitoring recommended |
| 14 | Low | Security | No in-flight notification concurrency guard | Noted as post-implementation item |

---

## Agent Assignments

| Task | Specialist Agent | Reviewer Agent |
|------|-----------------|----------------|
| 0 (API validation) | `dotnet-core-expert` | `code-reviewer` |
| 1-3 (COMPLETED) | `dotnet-core-expert` | `code-reviewer` |
| 4 (EF Core: index + AadGroupId) | `dotnet-core-expert` | `code-reviewer` |
| 5 (Models) | `dotnet-core-expert` | `code-reviewer` |
| 6 (Graph: InstallAppInTeamAsync) | `dotnet-core-expert` | `code-reviewer` |
| 7 (Bot handler: AadGroupId) | `dotnet-core-expert` | `code-reviewer` |
| 8-9 (Activities) | `dotnet-core-expert` | `code-reviewer` |
| 10-12 (Orchestrators + wiring) | `dotnet-core-expert` | `code-reviewer` |
| 13 (Bicep + host.json) | `azure-infra-engineer` | `security-engineer` |
| 14 (Docs) | `documentation-engineer` | -- |

---

## Codebase Orientation

All source lives under `src/` with four projects:

| Project | Path | Purpose |
|---------|------|---------|
| `CompanyCommunicator.Core` | `src/CompanyCommunicator.Core/` | Entities, EF Core, services (Graph, Recipients, etc.) |
| `CompanyCommunicator.Api` | `src/CompanyCommunicator.Api/` | ASP.NET Core web app + bot endpoint |
| `CompanyCommunicator.Functions.Prep` | `src/CompanyCommunicator.Functions.Prep/` | Durable Functions orchestrators + activities |
| `CompanyCommunicator.Functions.Send` | `src/CompanyCommunicator.Functions.Send/` | Send Function (message delivery) |

Key patterns:
- **Durable Functions (isolated worker)**: Activities are classes with `[Function(nameof(ClassName))]` on a `RunActivity` method. Orchestrators use `[OrchestrationTrigger] TaskOrchestrationContext context`. **All config reads must happen in activities, not orchestrators** (determinism).
- **DI**: `AddCoreServices()` in `CoreServicesExtensions.cs` registers all Core services. The Prep Function `Program.cs` calls this.
- **Graph resilience**: `GraphService` takes a `ResiliencePipeline` (Polly 8) named `"graph"` resolved from `ResiliencePipelineProvider<string>`. All Graph calls are wrapped in `_resilience.ExecuteAsync(...)`.
- **EF Core**: `AppDbContext` with `DbSet<User>` (key: `AadId`), `DbSet<SentNotification>`, `DbSet<Team>` (key: `TeamId`), `DbSet<Notification>`. Scoped per activity invocation.
- **User-assigned MI**: All Azure SDK clients use `DefaultAzureCredential` with explicit `ManagedIdentityClientId`.
- **Two Graph install APIs**:

| Scope | API Endpoint | SDK Type | Permission |
|-------|-------------|----------|------------|
| Personal (user DM) | `POST /users/{userId}/teamwork/installedApps` | `UserScopeTeamsAppInstallation` | `TeamsAppInstallation.ReadWriteForUser.All` (already granted) |
| Team (channel post) | `POST /teams/{teamId}/installedApps` | `TeamsAppInstallation` | `TeamsAppInstallation.ReadWriteForTeam.All` (**needs to be added**) |

- **Team ID mapping**: `NotificationAudience.AudienceId` stores the AAD group ID (GUID). `Team.TeamId` stores the Bot Framework thread ID (`19:xxx@thread.tacv2`). A new `Team.AadGroupId` column bridges these two formats.

---

## Task 1: Add `InstallAppForUserAsync` to `IGraphService` — COMPLETED

Commit `a404f05`. Added method signature to `IGraphService`.

---

## Task 2: Implement `InstallAppForUserAsync` in `GraphService` — COMPLETED

Commit `b7381e1`. Uses `UserScopeTeamsAppInstallation` for personal scope. GUID validation, `BrokenCircuitException` rethrow, Debug-level logging.

---

## Task 3: Patch `RecipientService` to populate `ConversationId`/`ServiceUrl` — COMPLETED

Commit `042d037`. Joins `Users` table, `ChangeTracker.Clear()` per batch, `AsNoTracking()`.

---

## Task 0: Add GUID validation for AudienceId at API boundary (Prerequisite)

**Files:**
- Modify: `src/CompanyCommunicator.Api/Validation/InputValidator.cs`

**v5-R6: AudienceId flows through the entire pipeline unvalidated. Add GUID format validation at the API boundary.**

**Step 1: Add GUID validation in `ValidateNotificationFields`**

In `InputValidator.cs`, after the `AudienceId must not be empty` check, add:

```csharp
if (!Guid.TryParse(audience.AudienceId, out _))
{
    return (false, $"AudienceId '{audience.AudienceId}' must be a valid GUID for audience type {audience.AudienceType}.");
}
```

This applies to `Team`, `Roster`, and `Group` audience types — all use AAD group IDs (GUIDs).

**Step 2: Verify build**

Run: `dotnet build src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/Validation/InputValidator.cs
git commit -m "fix: validate AudienceId as GUID at API boundary"
```

---

## Task 4: SQL index + Team `AadGroupId` column + EF Core migration

**Files:**
- Modify: `src/CompanyCommunicator.Core/Data/Entities/Team.cs`
- Create: `src/CompanyCommunicator.Core/Data/Configurations/TeamConfiguration.cs`
- Modify: `src/CompanyCommunicator.Core/Data/Configurations/SentNotificationConfiguration.cs`
- Create: new EF Core migration

**Step 1: Add `AadGroupId` property to `Team` entity**

In `src/CompanyCommunicator.Core/Data/Entities/Team.cs`, add after the `TeamId` property:

```csharp
/// <summary>
/// Gets or sets the AAD group ID (GUID) backing this team.
/// Used to map from NotificationAudience.AudienceId to this Team record.
/// Populated by OnTeamsMembersAddedAsync from teamInfo.AadGroupId.
/// </summary>
[MaxLength(100)]
public string? AadGroupId { get; set; }
```

**Step 2: Create `TeamConfiguration.cs`**

Create `src/CompanyCommunicator.Core/Data/Configurations/TeamConfiguration.cs`:

```csharp
using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace CompanyCommunicator.Core.Data.Configurations;

public sealed class TeamConfiguration : IEntityTypeConfiguration<Team>
{
    public void Configure(EntityTypeBuilder<Team> builder)
    {
        builder.HasIndex(t => t.AadGroupId)
            .HasDatabaseName("IX_Teams_AadGroupId")
            .IsUnique()
            .HasFilter("[AadGroupId] IS NOT NULL");
    }
}
```

**Step 3: Add filtered partial indexes to `SentNotificationConfiguration`**

In `src/CompanyCommunicator.Core/Data/Configurations/SentNotificationConfiguration.cs`, add after the existing `IX_SentNotifications_NotificationId_DeliveryStatus` index:

```csharp
// Filtered partial index for proactive install batch queries (personal scope).
// Only contains rows needing install (ConversationId IS NULL, Queued, User).
// Auto-shrinks as rows get ConversationIds — gives O(log(remaining)) seeks.
// Keyset pagination on (NotificationId, Id); covers SELECT projection.
// v5-R1: Replaces v4's 4-key composite index per efficiency + scalability review.
builder.HasIndex(sn => new { sn.NotificationId, sn.Id })
    .HasDatabaseName("IX_SentNotifications_Install_Lookup_User")
    .HasFilter("[ConversationId] IS NULL AND [DeliveryStatus] = 'Queued' AND [RecipientType] = 'User'")
    .IncludeProperties(sn => new { sn.RecipientId, sn.ServiceUrl });

// Narrow filtered index for team-scope install lookups (~50 rows max).
builder.HasIndex(sn => new { sn.NotificationId, sn.DeliveryStatus })
    .HasDatabaseName("IX_SentNotifications_Install_Lookup_Team")
    .HasFilter("[ConversationId] IS NULL AND [RecipientType] = 'Team'")
    .IncludeProperties(sn => new { sn.RecipientId, sn.ServiceUrl });
```

Note: v5 uses filtered partial indexes instead of v4's composite index. The filter predicates cause the indexes to physically contain only rows that need install, so they auto-shrink as rows resolve. `RecipientType` is in the filter (not the key or INCLUDE) since it's constant per index.

**Step 4: Create the EF Core migration**

```bash
cd src/CompanyCommunicator.Core
dotnet ef migrations add AddInstallLookupIndexAndTeamAadGroupId --startup-project ../CompanyCommunicator.Api/CompanyCommunicator.Api.csproj
```

Verify the generated migration contains:
1. `AddColumn<string>("AadGroupId", ...)` on `Teams` table
2. `CREATE UNIQUE INDEX IX_Teams_AadGroupId` with null filter
3. `CREATE INDEX IX_SentNotifications_Install_Lookup` with 4 key columns + 3 includes

**Step 5: Verify build**

Run: `dotnet build src/CompanyCommunicator.Core/CompanyCommunicator.Core.csproj`
Expected: SUCCESS

**Step 6: Commit**

```bash
git add src/CompanyCommunicator.Core/Data/Entities/Team.cs
git add src/CompanyCommunicator.Core/Data/Configurations/TeamConfiguration.cs
git add src/CompanyCommunicator.Core/Data/Configurations/SentNotificationConfiguration.cs
git add src/CompanyCommunicator.Core/Data/Migrations/
git commit -m "perf: add install lookup index and Team.AadGroupId for team-scope delivery"
```

---

## Task 5: Add model records for install orchestration

**Files:**
- Modify: `src/CompanyCommunicator.Functions.Prep/Models/OrchestratorModels.cs`

**Step 1: Add all new model records**

Add these records at the bottom of the file (after `SendBatchInput`):

```csharp
/// <summary>
/// Input for <see cref="Activities.SetNotificationStatusActivity"/>.
/// </summary>
public sealed record SetStatusInput(Guid NotificationId, string Status);

/// <summary>
/// Input for <c>InstallAppForUsersActivity</c> — a batch of user AAD IDs.
/// </summary>
public sealed record InstallBatchInput(
    Guid NotificationId,
    string TeamsAppId,
    IReadOnlyList<string> UserAadIds);

/// <summary>
/// Result returned by <c>InstallAppForUsersActivity</c> or <c>InstallAppForTeamsActivity</c>.
/// </summary>
public sealed record InstallBatchResult(int Installed, int Failed);

/// <summary>
/// Input for <c>GetInstallBatchActivity</c>. Keyset (cursor) pagination (v3-C2).
/// Pass <c>LastSeenId = 0</c> for the first call.
/// <c>PageCount</c> controls pages fetched per activity call (v3-H8).
/// </summary>
public sealed record GetInstallBatchInput(
    Guid NotificationId,
    long LastSeenId,
    int PageSize,
    int PageCount);

/// <summary>
/// Result from <c>GetInstallBatchActivity</c>.
/// </summary>
public sealed record GetInstallBatchResult(
    IReadOnlyList<IReadOnlyList<string>> Pages,
    long NextCursorId,
    bool HasMore);

/// <summary>
/// Input for <c>InstallAppOrchestrator</c>. All parameters passed once
/// so the orchestrator does not re-read config on replay.
/// v5-R3: Added cursor/counter fields for ContinueAsNew checkpointing.
/// Pass <c>LastSeenId = 0</c>, <c>CarriedInstalled = 0</c>, <c>CarriedFailed = 0</c>
/// for the initial call.
/// </summary>
public sealed record InstallAppInput(
    Guid NotificationId,
    string TeamsAppId,
    int InstallWaitSeconds,
    int MaxRefreshAttempts,
    long LastSeenId = 0,
    int CarriedInstalled = 0,
    int CarriedFailed = 0);

/// <summary>
/// Result from <c>RefreshConversationIdsActivity</c>.
/// </summary>
public sealed record RefreshResult(int Refreshed, int StillPending);

/// <summary>
/// Input for <c>InstallAppForTeamsActivity</c>. Team-scope install
/// is simple (small scale) so no pagination is needed.
/// </summary>
public sealed record InstallTeamsInput(Guid NotificationId, string TeamsAppId);

/// <summary>
/// Install configuration read from app settings by <c>GetInstallConfigActivity</c>.
/// </summary>
public sealed record InstallConfig(
    string TeamsAppId,
    int InstallWaitSeconds,
    int MaxRefreshAttempts);
```

**Step 2: Verify build**

Run: `dotnet build src/CompanyCommunicator.Functions.Prep/CompanyCommunicator.Functions.Prep.csproj`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Functions.Prep/Models/OrchestratorModels.cs
git commit -m "feat: add model records for install orchestration (personal + team scope)"
```

---

## Task 6: Add `InstallAppInTeamAsync` to `IGraphService` + `GraphService`

**Files:**
- Modify: `src/CompanyCommunicator.Core/Services/Graph/IGraphService.cs`
- Modify: `src/CompanyCommunicator.Core/Services/Graph/GraphService.cs`

**Step 1: Add interface method**

In `IGraphService.cs`, add after the `InstallAppForUserAsync` method:

```csharp
/// <summary>
/// Proactively installs the Teams app in a team via Graph API.
/// This triggers a conversationUpdate event back to the bot endpoint,
/// which populates the Team record with the channel ConversationId.
/// </summary>
/// <param name="teamGroupId">The AAD group ID of the target team.</param>
/// <param name="teamsAppId">The Teams app external ID (from manifest).</param>
/// <param name="ct">Cancellation token.</param>
/// <returns>
/// <c>true</c> if the app was installed (or was already installed);
/// <c>false</c> if the team could not be reached (403/404).
/// </returns>
Task<bool> InstallAppInTeamAsync(string teamGroupId, string teamsAppId, CancellationToken ct);
```

**Step 2: Add implementation in `GraphService.cs`**

Add after the `InstallAppForUserAsync` method (before `// Private helpers`):

```csharp
/// <inheritdoc/>
public async Task<bool> InstallAppInTeamAsync(string teamGroupId, string teamsAppId, CancellationToken ct)
{
    if (!Guid.TryParse(teamGroupId, out _))
        throw new ArgumentException($"teamGroupId must be a valid GUID, got: '{teamGroupId}'", nameof(teamGroupId));
    if (!Guid.TryParse(teamsAppId, out _))
        throw new ArgumentException($"teamsAppId must be a valid GUID, got: '{teamsAppId}'", nameof(teamsAppId));

    try
    {
        await _resilience.ExecuteAsync(async token =>
        {
            // Team-scope uses TeamsAppInstallation (not UserScopeTeamsAppInstallation).
            var requestBody = new Microsoft.Graph.Models.TeamsAppInstallation
            {
                AdditionalData = new Dictionary<string, object>
                {
                    ["teamsApp@odata.bind"] =
                        $"https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/{teamsAppId}",
                },
            };

            await _graphClient.Teams[teamGroupId].InstalledApps
                .PostAsync(requestBody, cancellationToken: token)
                .ConfigureAwait(false);
        }, ct).ConfigureAwait(false);

        _logger.LogDebug(
            "InstallAppInTeamAsync: Successfully installed app in team {TeamGroupId}.",
            teamGroupId);
        return true;
    }
    catch (ODataError odataError) when (odataError.ResponseStatusCode == 409)
    {
        _logger.LogDebug(
            "InstallAppInTeamAsync: App already installed in team {TeamGroupId}.",
            teamGroupId);
        return true;
    }
    catch (ODataError odataError) when (odataError.ResponseStatusCode is 403 or 404)
    {
        _logger.LogWarning(
            "InstallAppInTeamAsync: Cannot install in team {TeamGroupId}. Status={StatusCode}",
            teamGroupId, odataError.ResponseStatusCode);
        return false;
    }
    catch (Polly.CircuitBreaker.BrokenCircuitException)
    {
        throw;
    }
    catch (Exception ex) when (ex is not OperationCanceledException)
    {
        _logger.LogWarning(ex,
            "InstallAppInTeamAsync: Unexpected error for team {TeamGroupId}.",
            teamGroupId);
        return false;
    }
}
```

**Step 3: Verify build**

Run: `dotnet build src/CompanyCommunicator.Core/CompanyCommunicator.Core.csproj`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Core/Services/Graph/IGraphService.cs
git add src/CompanyCommunicator.Core/Services/Graph/GraphService.cs
git commit -m "feat: add InstallAppInTeamAsync for team-scope proactive installation"
```

---

## Task 7: Update `CommunicatorActivityHandler` to populate `AadGroupId`

**Files:**
- Modify: `src/CompanyCommunicator.Api/Bot/CommunicatorActivityHandler.cs`

**Step 1: Update `OnTeamsMembersAddedAsync`**

In the team creation block (the `if (team is null)` branch around line 57), add `AadGroupId`:

```csharp
if (team is null)
{
    team = new Team
    {
        TeamId = teamId,
        Name = teamInfo?.Name,
        ServiceUrl = serviceUrl,
        TenantId = tenantId,
        AadGroupId = teamInfo?.AadGroupId,
        InstalledDate = DateTime.UtcNow,
    };
    _db.Teams.Add(team);
    _logger.LogInformation("Bot installed in team {TeamId} (AadGroupId={AadGroupId}).",
        teamId, teamInfo?.AadGroupId);
}
else
{
    team.Name = teamInfo?.Name ?? team.Name;
    team.ServiceUrl = serviceUrl;
    team.TenantId = tenantId;
    team.AadGroupId ??= teamInfo?.AadGroupId; // Backfill for existing teams
}
```

**Fallback note:** If `teamInfo.AadGroupId` is null in the M365 Agents SDK version used, extract from channel data. v5-R7: Added GUID validation before DB write and replaced empty catch with specific exception filter + logging.
```csharp
// Fallback if teamInfo.AadGroupId is not available
if (string.IsNullOrEmpty(team.AadGroupId) && turnContext.Activity.ChannelData is not null)
{
    try
    {
        var channelData = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(
            turnContext.Activity.ChannelData.ToString()!);
        if (channelData.TryGetProperty("team", out var teamData)
            && teamData.TryGetProperty("aadGroupId", out var aadId)
            && Guid.TryParse(aadId.GetString(), out _))
        {
            team.AadGroupId = aadId.GetString();
        }
    }
    catch (System.Text.Json.JsonException ex)
    {
        _logger.LogDebug(ex, "Could not extract AadGroupId from ChannelData for team {TeamId}.", teamId);
    }
}
```

**Step 2: Verify build**

Run: `dotnet build src/CompanyCommunicator.Api/CompanyCommunicator.Api.csproj`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Api/Bot/CommunicatorActivityHandler.cs
git commit -m "feat: populate Team.AadGroupId from bot conversationUpdate callback"
```

---

## CODE REVIEW CHECKPOINT 1

**Reviewer:** `code-reviewer` agent
**Scope:** Tasks 4-7
**Focus areas:**
- EF migration contains both filtered partial indexes and the AadGroupId column
- `TeamConfiguration` unique index has null filter
- `SentNotificationConfiguration` uses `HasFilter()` for both User and Team install lookup indexes (v5-R1)
- `InstallAppInTeamAsync` uses `TeamsAppInstallation` (NOT `UserScopeTeamsAppInstallation`)
- `GraphService.InstallAppInTeamAsync` calls `Teams[teamGroupId].InstalledApps.PostAsync`
- Bot handler populates `AadGroupId` on both create and update paths
- All model records compile and have XML docs

---

## Task 8: Create install pipeline activities

**Files:**
- Create: `src/CompanyCommunicator.Functions.Prep/Activities/GetInstallConfigActivity.cs`
- Create: `src/CompanyCommunicator.Functions.Prep/Activities/GetInstallBatchActivity.cs`
- Create: `src/CompanyCommunicator.Functions.Prep/Activities/InstallAppForUsersActivity.cs`
- Create: `src/CompanyCommunicator.Functions.Prep/Activities/InstallAppForTeamsActivity.cs`
- Create: `src/CompanyCommunicator.Functions.Prep/Activities/RefreshConversationIdsActivity.cs`
- Create: `src/CompanyCommunicator.Functions.Prep/Activities/MarkUnreachableActivity.cs`
- Create: `src/CompanyCommunicator.Functions.Prep/Activities/SetNotificationStatusActivity.cs`

**Step 1: Create `GetInstallConfigActivity.cs`**

```csharp
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class GetInstallConfigActivity
{
    private readonly IConfiguration _config;
    private readonly ILogger<GetInstallConfigActivity> _logger;

    public GetInstallConfigActivity(IConfiguration config, ILogger<GetInstallConfigActivity> logger)
    {
        _config = config;
        _logger = logger;
    }

    [Function(nameof(GetInstallConfigActivity))]
    public Task<InstallConfig> RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var teamsAppId = _config["Bot__TeamsAppId"] ?? string.Empty;

        if (!string.IsNullOrEmpty(teamsAppId) && !Guid.TryParse(teamsAppId, out _))
        {
            throw new InvalidOperationException(
                $"Bot__TeamsAppId '{teamsAppId}' is not a valid GUID. " +
                "Set it to a valid Entra app registration client ID, or leave it empty to disable proactive installation.");
        }

        int waitSeconds = int.TryParse(_config["Bot__InstallWaitSeconds"], out var ws) && ws > 0 ? ws : 60;
        int maxAttempts = int.TryParse(_config["Bot__MaxRefreshAttempts"], out var ma) && ma > 0 ? ma : 20;

        _logger.LogInformation(
            "GetInstallConfigActivity: Notification {NotificationId} — " +
            "TeamsAppId={TeamsAppId}, Wait={Wait}s, MaxAttempts={Max}.",
            notificationId,
            string.IsNullOrEmpty(teamsAppId) ? "(disabled)" : teamsAppId,
            waitSeconds, maxAttempts);

        return Task.FromResult(new InstallConfig(teamsAppId, waitSeconds, maxAttempts));
    }
}
```

**Step 2: Create `GetInstallBatchActivity.cs`**

Keyset pagination (v3-C2), collapsed page fetching (v3-H8). **Filters `RecipientType = "User"`** to exclude team records. v5-R10: Single SQL query replaces N sequential queries — fetches `PageSize * PageCount` rows in one round-trip, splits client-side.

```csharp
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class GetInstallBatchActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<GetInstallBatchActivity> _logger;

    public GetInstallBatchActivity(AppDbContext db, ILogger<GetInstallBatchActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function(nameof(GetInstallBatchActivity))]
    public async Task<GetInstallBatchResult> RunActivity(
        [ActivityTrigger] GetInstallBatchInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        var totalSize = input.PageSize * input.PageCount;

        // Single SQL query fetches all rows for this batch + 1 extra to detect HasMore.
        // The filtered partial index IX_SentNotifications_Install_Lookup_User covers
        // this query exactly (auto-shrinks as rows resolve).
        var rows = await _db.SentNotifications
            .Where(s => s.Id > input.LastSeenId
                        && s.NotificationId == input.NotificationId
                        && s.ConversationId == null
                        && s.RecipientType == "User"
                        && s.DeliveryStatus == DeliveryStatus.Queued)
            .OrderBy(s => s.Id)
            .Select(s => new { s.Id, s.RecipientId })
            .Take(totalSize + 1)
            .AsNoTracking()
            .ToListAsync(ct)
            .ConfigureAwait(false);

        bool hasMore = rows.Count > totalSize;
        if (hasMore) rows.RemoveAt(rows.Count - 1);

        // Split into pages client-side for fan-out.
        var pages = rows
            .Select((r, i) => (r, i))
            .GroupBy(x => x.i / input.PageSize)
            .Select(g => (IReadOnlyList<string>)g.Select(x => x.r.RecipientId).ToList())
            .ToList();

        long nextCursor = rows.Count > 0 ? rows[^1].Id : input.LastSeenId;

        _logger.LogDebug(
            "GetInstallBatchActivity: Notification {NotificationId} — " +
            "{Pages} page(s), {Total} users, cursor {From}->{To}, HasMore={HasMore}.",
            input.NotificationId, pages.Count, rows.Count,
            input.LastSeenId, nextCursor, hasMore);

        return new GetInstallBatchResult(pages, nextCursor, hasMore);
    }
}
```

**Step 3: Create `InstallAppForUsersActivity.cs`**

v5-R12: Uses `SemaphoreSlim(5)` + `Task.WhenAll` within each activity for 5 concurrent Graph calls per activity. With 10 parallel activities, effective concurrency is ~50 simultaneous Graph calls (matching `maxConcurrentActivityFunctions`), roughly doubling throughput vs sequential.

```csharp
using CompanyCommunicator.Core.Services.Graph;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class InstallAppForUsersActivity
{
    private readonly IGraphService _graphService;
    private readonly ILogger<InstallAppForUsersActivity> _logger;

    public InstallAppForUsersActivity(IGraphService graphService, ILogger<InstallAppForUsersActivity> logger)
    {
        _graphService = graphService;
        _logger = logger;
    }

    [Function(nameof(InstallAppForUsersActivity))]
    public async Task<InstallBatchResult> RunActivity(
        [ActivityTrigger] InstallBatchInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        int installed = 0, failed = 0;

        // v5-R12: Parallelize within activity using semaphore to cap per-activity concurrency.
        // 10 parallel activities × 5 concurrent within each = ~50 simultaneous Graph connections.
        using var semaphore = new SemaphoreSlim(5);

        var tasks = input.UserAadIds.Select(async userAadId =>
        {
            await semaphore.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                var success = await _graphService
                    .InstallAppForUserAsync(userAadId, input.TeamsAppId, ct)
                    .ConfigureAwait(false);
                if (success) Interlocked.Increment(ref installed);
                else Interlocked.Increment(ref failed);
            }
            catch (BrokenCircuitException) { throw; }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "InstallAppForUsersActivity: Error for user {UserAadId}.", userAadId);
                Interlocked.Increment(ref failed);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks).ConfigureAwait(false);

        _logger.LogInformation(
            "InstallAppForUsersActivity: Notification {NotificationId} — Installed={Installed}, Failed={Failed}.",
            input.NotificationId, installed, failed);
        return new InstallBatchResult(installed, failed);
    }
}
```

**Step 4: Create `InstallAppForTeamsActivity.cs`**

Simple sequential install for the small number of team records. Queries DB + installs in one activity call.

```csharp
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Services.Graph;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class InstallAppForTeamsActivity
{
    private readonly AppDbContext _db;
    private readonly IGraphService _graphService;
    private readonly ILogger<InstallAppForTeamsActivity> _logger;

    public InstallAppForTeamsActivity(
        AppDbContext db, IGraphService graphService, ILogger<InstallAppForTeamsActivity> logger)
    {
        _db = db;
        _graphService = graphService;
        _logger = logger;
    }

    [Function(nameof(InstallAppForTeamsActivity))]
    public async Task<InstallBatchResult> RunActivity(
        [ActivityTrigger] InstallTeamsInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var teamGroupIds = await _db.SentNotifications
            .Where(s => s.NotificationId == input.NotificationId
                && s.RecipientType == "Team"
                && s.ConversationId == null
                && s.DeliveryStatus == DeliveryStatus.Queued)
            .Select(s => s.RecipientId)
            .AsNoTracking()
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (teamGroupIds.Count == 0)
        {
            _logger.LogInformation(
                "InstallAppForTeamsActivity: No teams need install for notification {NotificationId}.",
                input.NotificationId);
            return new InstallBatchResult(0, 0);
        }

        int installed = 0, failed = 0;

        foreach (var groupId in teamGroupIds)
        {
            try
            {
                var success = await _graphService
                    .InstallAppInTeamAsync(groupId, input.TeamsAppId, ct)
                    .ConfigureAwait(false);
                if (success) installed++; else failed++;
            }
            catch (BrokenCircuitException) { throw; }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex,
                    "InstallAppForTeamsActivity: Error installing in team {TeamGroupId}.", groupId);
                failed++;
            }
        }

        _logger.LogInformation(
            "InstallAppForTeamsActivity: Notification {NotificationId} — Installed={Installed}, Failed={Failed}.",
            input.NotificationId, installed, failed);
        return new InstallBatchResult(installed, failed);
    }
}
```

**Step 5: Create `RefreshConversationIdsActivity.cs`**

Refreshes BOTH user-type and team-type records in separate UPDATE JOINs.

```csharp
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class RefreshConversationIdsActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<RefreshConversationIdsActivity> _logger;

    public RefreshConversationIdsActivity(AppDbContext db, ILogger<RefreshConversationIdsActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function(nameof(RefreshConversationIdsActivity))]
    public async Task<RefreshResult> RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        // Refresh user-type records from Users table.
        var refreshedUsers = await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE sn
            SET sn.ConversationId = u.ConversationId,
                sn.ServiceUrl     = u.ServiceUrl
            FROM SentNotifications sn
            INNER JOIN Users u ON u.AadId = sn.RecipientId
                               AND u.ConversationId IS NOT NULL
            WHERE sn.NotificationId = {notificationId}
              AND sn.ConversationId IS NULL
              AND sn.RecipientType = 'User'
              AND sn.DeliveryStatus = 'Queued'",
            ct).ConfigureAwait(false);

        // Refresh team-type records from Teams table.
        // Teams.TeamId = Bot Framework thread ID (ConversationId for sending).
        // Teams.AadGroupId = AAD group ID (matches SentNotification.RecipientId).
        var refreshedTeams = await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE sn
            SET sn.ConversationId = t.TeamId,
                sn.ServiceUrl     = t.ServiceUrl
            FROM SentNotifications sn
            INNER JOIN Teams t ON t.AadGroupId = sn.RecipientId
            WHERE sn.NotificationId = {notificationId}
              AND sn.ConversationId IS NULL
              AND sn.RecipientType = 'Team'
              AND sn.DeliveryStatus = 'Queued'",
            ct).ConfigureAwait(false);

        var totalRefreshed = refreshedUsers + refreshedTeams;

        // Count remaining unresolved records (both types).
        var stillPending = await _db.SentNotifications
            .AsNoTracking()
            .Where(s => s.NotificationId == notificationId
                        && s.ConversationId == null
                        && s.DeliveryStatus == DeliveryStatus.Queued)
            .CountAsync(ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "RefreshConversationIdsActivity: Notification {NotificationId} — " +
            "RefreshedUsers={Users}, RefreshedTeams={Teams}, StillPending={StillPending}.",
            notificationId, refreshedUsers, refreshedTeams, stillPending);

        return new RefreshResult(totalRefreshed, stillPending);
    }
}
```

**Step 6: Create `MarkUnreachableActivity.cs`**

Marks ALL remaining null-ConversationId records (both User and Team types).

```csharp
using CompanyCommunicator.Core.Data;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class MarkUnreachableActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<MarkUnreachableActivity> _logger;

    public MarkUnreachableActivity(AppDbContext db, ILogger<MarkUnreachableActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function(nameof(MarkUnreachableActivity))]
    public async Task<int> RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var marked = await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE SentNotifications
            SET DeliveryStatus = 'RecipientNotFound',
                ErrorMessage   = 'Bot installation did not produce a ConversationId.'
            WHERE NotificationId = {notificationId}
              AND ConversationId IS NULL
              AND DeliveryStatus = 'Queued'",
            ct).ConfigureAwait(false);

        _logger.LogInformation(
            "MarkUnreachableActivity: Notification {NotificationId} — " +
            "Marked {Count} recipient(s) as RecipientNotFound.",
            notificationId, marked);
        return marked;
    }
}
```

**Step 7: Create `SetNotificationStatusActivity.cs`**

```csharp
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class SetNotificationStatusActivity
{
    private static readonly HashSet<string> ValidStatuses = new(StringComparer.Ordinal)
    {
        NotificationStatus.Draft, NotificationStatus.Scheduled, NotificationStatus.Queued,
        NotificationStatus.SyncingRecipients, NotificationStatus.InstallingApp,
        NotificationStatus.Sending, NotificationStatus.Sent,
        NotificationStatus.Canceled, NotificationStatus.Failed,
    };

    private readonly AppDbContext _db;
    private readonly ILogger<SetNotificationStatusActivity> _logger;

    public SetNotificationStatusActivity(AppDbContext db, ILogger<SetNotificationStatusActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function(nameof(SetNotificationStatusActivity))]
    public async Task RunActivity(
        [ActivityTrigger] SetStatusInput input,
        FunctionContext ctx)
    {
        if (!ValidStatuses.Contains(input.Status))
            throw new ArgumentException($"'{input.Status}' is not a valid NotificationStatus.", nameof(input));

        var ct = ctx.CancellationToken;
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == input.NotificationId, ct)
            .ConfigureAwait(false)
            ?? throw new InvalidOperationException($"Notification {input.NotificationId} not found.");

        notification.Status = input.Status;
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        _logger.LogInformation(
            "SetNotificationStatusActivity: Notification {NotificationId} status set to {Status}.",
            input.NotificationId, input.Status);
    }
}
```

**Step 8: Verify build**

Run: `dotnet build src/CompanyCommunicator.Functions.Prep/CompanyCommunicator.Functions.Prep.csproj`
Expected: SUCCESS

**Step 9: Commit**

```bash
git add src/CompanyCommunicator.Functions.Prep/Activities/GetInstallConfigActivity.cs
git add src/CompanyCommunicator.Functions.Prep/Activities/GetInstallBatchActivity.cs
git add src/CompanyCommunicator.Functions.Prep/Activities/InstallAppForUsersActivity.cs
git add src/CompanyCommunicator.Functions.Prep/Activities/InstallAppForTeamsActivity.cs
git add src/CompanyCommunicator.Functions.Prep/Activities/RefreshConversationIdsActivity.cs
git add src/CompanyCommunicator.Functions.Prep/Activities/MarkUnreachableActivity.cs
git add src/CompanyCommunicator.Functions.Prep/Activities/SetNotificationStatusActivity.cs
git commit -m "feat: add install pipeline activities for personal + team scope"
```

---

## Task 9: Create `SyncTeamChannelActivity`

**Files:**
- Create: `src/CompanyCommunicator.Functions.Prep/Activities/SyncTeamChannelActivity.cs`

**Step 1: Create the activity**

For each `AudienceType.Team` audience, creates a single team-scoped `SentNotification` (not individual user records). Looks up the `Teams` table by `AadGroupId` to get existing ConversationId/ServiceUrl.

```csharp
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: creates a single team-scoped SentNotification for a Team audience.
/// Unlike SyncTeamMembersActivity (which resolves individual users), this creates
/// ONE record per team targeting the team's General channel.
/// </summary>
public sealed class SyncTeamChannelActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<SyncTeamChannelActivity> _logger;

    public SyncTeamChannelActivity(AppDbContext db, ILogger<SyncTeamChannelActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function(nameof(SyncTeamChannelActivity))]
    public async Task<int> RunActivity(
        [ActivityTrigger] SyncInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        // Look up the team by AAD group ID. Team record exists if bot is already
        // installed in the team (created by OnTeamsMembersAddedAsync).
        var team = await _db.Teams
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.AadGroupId == input.AudienceId, ct)
            .ConfigureAwait(false);

        // v5-R9: Guard against duplicate team audience entries (same team in multiple audiences).
        var exists = await _db.SentNotifications
            .AnyAsync(s => s.NotificationId == input.NotificationId
                        && s.RecipientId == input.AudienceId, ct)
            .ConfigureAwait(false);

        if (exists)
        {
            _logger.LogInformation(
                "SyncTeamChannelActivity: Duplicate team {AudienceId} for notification {NotificationId} — skipped.",
                input.AudienceId, input.NotificationId);
            return 0;
        }

        var sentNotification = new SentNotification
        {
            NotificationId = input.NotificationId,
            RecipientId = input.AudienceId,     // AAD group ID
            RecipientType = "Team",
            ConversationId = team?.TeamId,       // Bot Framework thread ID (null if bot not installed)
            ServiceUrl = team?.ServiceUrl,
            DeliveryStatus = DeliveryStatus.Queued,
            RetryCount = 0,
        };

        _db.SentNotifications.Add(sentNotification); // v5-R9: Add (not AddAsync) — no HiLo generator.
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        _logger.LogInformation(
            "SyncTeamChannelActivity: Created Team SentNotification for team {AudienceId} " +
            "(notification {NotificationId}). ConversationId={ConversationId}.",
            input.AudienceId, input.NotificationId,
            team?.TeamId ?? "(null — install needed)");

        return 1;
    }
}
```

**Step 2: Verify build**

Run: `dotnet build src/CompanyCommunicator.Functions.Prep/CompanyCommunicator.Functions.Prep.csproj`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Functions.Prep/Activities/SyncTeamChannelActivity.cs
git commit -m "feat: add SyncTeamChannelActivity for team-scope channel delivery"
```

---

## CODE REVIEW CHECKPOINT 2

**Reviewer:** `code-reviewer` agent
**Scope:** Tasks 8-9 (all activities)
**Focus areas:**
- `GetInstallBatchActivity` uses single SQL query with `Take(totalSize + 1)` for HasMore detection (v5-R10)
- `GetInstallBatchActivity` filters `RecipientType == "User"` to exclude team records
- `InstallAppForUsersActivity` uses `SemaphoreSlim(5)` + `Task.WhenAll` with `Interlocked` counters (v5-R12)
- `RefreshConversationIdsActivity` has two UPDATE JOINs: Users table (user) + Teams table (team)
- Team refresh joins on `t.AadGroupId = sn.RecipientId` (correct mapping)
- `MarkUnreachableActivity` does NOT filter by RecipientType (handles both — correct)
- `InstallAppForTeamsActivity` queries + installs in one activity (appropriate for small scale)
- `SyncTeamChannelActivity` checks existence before insert to guard against duplicates (v5-R9)
- `SyncTeamChannelActivity` creates exactly 1 SentNotification per team audience
- `ExecuteSqlInterpolatedAsync` with CancellationToken on all SQL statements
- `AsNoTracking()` on all read-only queries

---

## Task 10: Create `InstallAppOrchestrator` (personal + team scope)

**Files:**
- Create: `src/CompanyCommunicator.Functions.Prep/Orchestrators/InstallAppOrchestrator.cs`

The orchestrator runs in sequence:
1. Set status `InstallingApp` (only on first instance — skipped on ContinueAsNew)
2. User fan-out: keyset-paginated windowed install (50k scale) with ContinueAsNew checkpointing
3. Team install: single activity call (small scale) — runs only in the final instance
4. Shared polling loop with adaptive backoff: refresh both user and team ConversationIds
5. Mark unreachable (both types)

v5 changes: Added `ContinueAsNew` every 25 wave cycles (~5,000 users) to prevent orchestrator history bloat (v5-R3). Added adaptive backoff polling with early exit on stagnation (v5-R11). `InstallAppInput` extended with cursor/counter forwarding fields.

```csharp
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Activities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Orchestrators;

public sealed class InstallAppOrchestrator
{
    private const int PagesPerBatchCall = 10;
    private const int InstallBatchSize = 20;
    private const int CheckpointEvery = 25; // ContinueAsNew every 25 wave cycles (~5,000 users)
    private static readonly TimeSpan InstallPhaseTimeout = TimeSpan.FromMinutes(60);

    private static readonly TaskOptions ActivityRetryOptions = new(
        new TaskRetryOptions(
            new RetryPolicy(
                maxNumberOfAttempts: 3,
                firstRetryInterval: TimeSpan.FromSeconds(5),
                backoffCoefficient: 2.0,
                maxRetryInterval: TimeSpan.FromSeconds(30),
                retryTimeout: null)));

    [Function(nameof(InstallAppOrchestrator))]
    public async Task RunOrchestrator(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var logger = context.CreateReplaySafeLogger<InstallAppOrchestrator>();
        var input = context.GetInput<InstallAppInput>()
            ?? throw new InvalidOperationException("InstallAppOrchestrator requires InstallAppInput.");

        var installDeadline = context.CurrentUtcDateTime.Add(InstallPhaseTimeout);

        logger.LogInformation(
            "InstallAppOrchestrator: Starting for notification {NotificationId}. " +
            "Cursor={Cursor}, Deadline={Deadline:u}.",
            input.NotificationId, input.LastSeenId, installDeadline);

        // Step 1: Status transition (only on first instance — LastSeenId == 0).
        if (input.LastSeenId == 0)
        {
            await context.CallActivityAsync(
                nameof(SetNotificationStatusActivity),
                new SetStatusInput(input.NotificationId, NotificationStatus.InstallingApp),
                ActivityRetryOptions);
        }

        // ---- Step 2: User fan-out (personal scope, windowed keyset pagination) ----
        // v5-R3: ContinueAsNew checkpointing every CheckpointEvery wave cycles.
        int totalUserInstalled = input.CarriedInstalled, totalUserFailed = input.CarriedFailed;
        long lastSeenId = input.LastSeenId;
        bool hasMoreUsers = true;
        int waveCount = 0;

        while (hasMoreUsers)
        {
            if (context.CurrentUtcDateTime >= installDeadline) break;

            var batchResult = await context.CallActivityAsync<GetInstallBatchResult>(
                nameof(GetInstallBatchActivity),
                new GetInstallBatchInput(input.NotificationId, lastSeenId, InstallBatchSize, PagesPerBatchCall),
                ActivityRetryOptions);

            if (batchResult.Pages.Count == 0) { hasMoreUsers = false; break; }

            lastSeenId = batchResult.NextCursorId;

            var waveTasks = batchResult.Pages
                .Where(page => page.Count > 0)
                .Select(page => context.CallActivityAsync<InstallBatchResult>(
                    nameof(InstallAppForUsersActivity),
                    new InstallBatchInput(input.NotificationId, input.TeamsAppId, page),
                    ActivityRetryOptions))
                .ToList();

            if (waveTasks.Count > 0)
            {
                var waveResults = await Task.WhenAll(waveTasks);
                totalUserInstalled += waveResults.Sum(r => r.Installed);
                totalUserFailed += waveResults.Sum(r => r.Failed);
            }

            if (!batchResult.HasMore) { hasMoreUsers = false; break; }

            // v5-R3: Checkpoint to reset history and prevent bloat at 50k scale.
            waveCount++;
            if (waveCount % CheckpointEvery == 0)
            {
                logger.LogInformation(
                    "InstallAppOrchestrator: Checkpointing at wave {Wave} for notification {NotificationId}. " +
                    "Cursor={Cursor}, Installed={Installed}, Failed={Failed}.",
                    waveCount, input.NotificationId, lastSeenId, totalUserInstalled, totalUserFailed);

                context.ContinueAsNew(new InstallAppInput(
                    input.NotificationId, input.TeamsAppId,
                    input.InstallWaitSeconds, input.MaxRefreshAttempts,
                    lastSeenId, totalUserInstalled, totalUserFailed));
                return;
            }
        }

        logger.LogInformation(
            "InstallAppOrchestrator: User fan-out complete for notification {NotificationId}. " +
            "Installed={Installed}, Failed={Failed}.",
            input.NotificationId, totalUserInstalled, totalUserFailed);

        // ---- Step 3: Team install (team scope, simple single activity) ----
        var teamResult = await context.CallActivityAsync<InstallBatchResult>(
            nameof(InstallAppForTeamsActivity),
            new InstallTeamsInput(input.NotificationId, input.TeamsAppId),
            ActivityRetryOptions);

        logger.LogInformation(
            "InstallAppOrchestrator: Team install complete for notification {NotificationId}. " +
            "Installed={Installed}, Failed={Failed}.",
            input.NotificationId, teamResult.Installed, teamResult.Failed);

        // ---- Step 4: Shared polling loop with adaptive backoff (v5-R11) ----
        int totalInstalled = totalUserInstalled + teamResult.Installed;
        if (totalInstalled > 0)
        {
            int baseWaitSeconds = input.InstallWaitSeconds > 0 ? input.InstallWaitSeconds : 60;
            int noProgressStreak = 0;
            int lastStillPending = int.MaxValue;

            for (int attempt = 1; attempt <= input.MaxRefreshAttempts; attempt++)
            {
                if (context.CurrentUtcDateTime >= installDeadline) break;

                // v5-R11: Adaptive backoff — short first wait, progressive lengthening.
                // Attempts 1-2: base wait (60s). Attempts 3-5: 1.5x. Attempts 6+: 2x.
                double multiplier = attempt <= 2 ? 1.0 : attempt <= 5 ? 1.5 : 2.0;
                var waitDuration = TimeSpan.FromSeconds(baseWaitSeconds * multiplier);

                await context.CreateTimer(
                    context.CurrentUtcDateTime.Add(waitDuration),
                    CancellationToken.None);

                if (context.CurrentUtcDateTime >= installDeadline) break;

                var refreshResult = await context.CallActivityAsync<RefreshResult>(
                    nameof(RefreshConversationIdsActivity),
                    input.NotificationId,
                    ActivityRetryOptions);

                logger.LogInformation(
                    "InstallAppOrchestrator: Refresh attempt {Attempt}/{Max} for notification {NotificationId}. " +
                    "Refreshed={Refreshed}, StillPending={StillPending}.",
                    attempt, input.MaxRefreshAttempts, input.NotificationId,
                    refreshResult.Refreshed, refreshResult.StillPending);

                if (refreshResult.StillPending == 0) break;

                // v5-R11: Early exit if no progress across 3 consecutive attempts (stuck installs).
                if (refreshResult.StillPending >= lastStillPending)
                    noProgressStreak++;
                else
                {
                    noProgressStreak = 0;
                    lastStillPending = refreshResult.StillPending;
                }

                if (noProgressStreak >= 3)
                {
                    logger.LogWarning(
                        "InstallAppOrchestrator: No progress for 3 consecutive polls. " +
                        "Stopping refresh for notification {NotificationId}. StillPending={StillPending}.",
                        input.NotificationId, refreshResult.StillPending);
                    break;
                }
            }
        }

        // ---- Step 5: Mark remaining unresolved (both user + team) ----
        var unreachable = await context.CallActivityAsync<int>(
            nameof(MarkUnreachableActivity),
            input.NotificationId,
            ActivityRetryOptions);

        if (unreachable > 0)
        {
            logger.LogWarning(
                "InstallAppOrchestrator: Notification {NotificationId} — {Unreachable} recipient(s) unreachable.",
                input.NotificationId, unreachable);
        }
    }
}
```

**Step 2: Verify build**

Run: `dotnet build src/CompanyCommunicator.Functions.Prep/CompanyCommunicator.Functions.Prep.csproj`
Expected: SUCCESS

**Step 3: Commit**

```bash
git add src/CompanyCommunicator.Functions.Prep/Orchestrators/InstallAppOrchestrator.cs
git commit -m "feat: add InstallAppOrchestrator with personal fan-out + team install + shared polling"
```

---

## Task 11: Split `AudienceType.Team` in `SyncRecipientsOrchestrator`

**Files:**
- Modify: `src/CompanyCommunicator.Functions.Prep/Orchestrators/SyncRecipientsOrchestrator.cs`

**Step 1: Update the switch expression**

Replace the `AudienceType.Roster or AudienceType.Team` case (lines 56-61) with separate cases:

```csharp
Task<int> task = audience.AudienceType switch
{
    AudienceType.Roster =>
        context.CallActivityAsync<int>(
            nameof(SyncTeamMembersActivity),
            syncInput),

    AudienceType.Team =>
        context.CallActivityAsync<int>(
            nameof(SyncTeamChannelActivity),
            syncInput),

    AudienceType.Group =>
        context.CallActivityAsync<int>(
            nameof(SyncGroupMembersActivity),
            syncInput),

    _ => Task.FromResult(0),
};
```

**Step 2: Add the using for the new activity**

Verify `SyncTeamChannelActivity` is in the same namespace (`CompanyCommunicator.Functions.Prep.Activities`) — already imported.

**Step 3: Verify build**

Run: `dotnet build src/CompanyCommunicator.Functions.Prep/CompanyCommunicator.Functions.Prep.csproj`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Functions.Prep/Orchestrators/SyncRecipientsOrchestrator.cs
git commit -m "feat: route AudienceType.Team to SyncTeamChannelActivity for channel delivery"
```

---

## CODE REVIEW CHECKPOINT 3

**Reviewer:** `code-reviewer` agent
**Scope:** Tasks 10-11 (orchestrators)
**Focus areas:**
- User fan-out uses `GetInstallBatchActivity` (RecipientType=User) and `InstallAppForUsersActivity`
- Team install uses `InstallAppForTeamsActivity` (single activity call after user fan-out)
- `ContinueAsNew` fires every 25 wave cycles with cursor/counter forwarding (v5-R3)
- Status transition only on first instance (`LastSeenId == 0`) — not after ContinueAsNew
- Team install + polling loop only run in the final instance (when `!hasMoreUsers`)
- Shared polling loop uses adaptive backoff: 1x base → 1.5x → 2x (v5-R11)
- Early exit on 3 consecutive stalled polls (v5-R11)
- `MarkUnreachableActivity` called once at the end (handles both types)
- Deadline checked before AND after `CreateTimer`
- `SyncRecipientsOrchestrator` routes `AudienceType.Team` → `SyncTeamChannelActivity` (not `SyncTeamMembersActivity`)
- `AudienceType.Roster` → `SyncTeamMembersActivity` (unchanged)

---

## Task 12: Wire `InstallAppOrchestrator` into `PrepareToSendOrchestrator`

**Files:**
- Modify: `src/CompanyCommunicator.Functions.Prep/Orchestrators/PrepareToSendOrchestrator.cs`
- Modify: `src/CompanyCommunicator.Functions.Prep/Activities/UpdateRecipientCountActivity.cs`

**Step 1: Replace `PrepareToSendOrchestrator` content**

```csharp
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Activities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Orchestrators;

public sealed class PrepareToSendOrchestrator
{
    [Function(nameof(PrepareToSendOrchestrator))]
    public async Task RunOrchestrator(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var logger = context.CreateReplaySafeLogger<PrepareToSendOrchestrator>();
        var notificationId = context.GetInput<Guid>();

        logger.LogInformation(
            "PrepareToSendOrchestrator: Starting for notification {NotificationId}.",
            notificationId);

        // Step 1: Store Adaptive Card to blob.
        await context.CallActivityAsync(nameof(StoreCardActivity), notificationId);

        // Step 2: Sync recipients (Users + Teams).
        var recipientCount = await context.CallSubOrchestratorAsync<int>(
            nameof(SyncRecipientsOrchestrator), notificationId);

        logger.LogInformation(
            "PrepareToSendOrchestrator: Sync complete. Recipients={Count}.", recipientCount);

        // Step 3: Persist recipient count.
        await context.CallActivityAsync(
            nameof(UpdateRecipientCountActivity),
            new UpdateCountInput(notificationId, recipientCount));

        // Step 4: Read install config.
        var installConfig = await context.CallActivityAsync<InstallConfig>(
            nameof(GetInstallConfigActivity), notificationId);

        // Step 5: Proactive install (personal + team scope).
        // v5-R8: Wrapped in try/catch for graceful degradation — if install fails
        // catastrophically, recipients who already have ConversationIds still get sent.
        // v5-R4: MarkUnreachable is conditional — only at root level when install is skipped.
        // v5-R5: Final Refresh before MarkUnreachable to catch late-arriving callbacks.
        if (!string.IsNullOrEmpty(installConfig.TeamsAppId))
        {
            try
            {
                await context.CallSubOrchestratorAsync(
                    nameof(InstallAppOrchestrator),
                    new InstallAppInput(
                        notificationId, installConfig.TeamsAppId,
                        installConfig.InstallWaitSeconds, installConfig.MaxRefreshAttempts));
            }
            catch (TaskFailedException ex)
            {
                logger.LogError(ex,
                    "PrepareToSendOrchestrator: Install step failed for notification {NotificationId}. " +
                    "Continuing with available recipients.", notificationId);

                // v5-R5: Final refresh to catch any late-arriving callbacks before marking unreachable.
                await context.CallActivityAsync(
                    nameof(RefreshConversationIdsActivity), notificationId);

                await context.CallActivityAsync(
                    nameof(MarkUnreachableActivity), notificationId);
            }
        }
        else
        {
            logger.LogWarning(
                "PrepareToSendOrchestrator: Bot__TeamsAppId not configured. Skipping install.");

            // Install skipped — mark any null-ConversationId records unreachable.
            await context.CallActivityAsync(nameof(MarkUnreachableActivity), notificationId);
        }

        // Step 6: Transition to Sending.
        await context.CallActivityAsync(
            nameof(SetNotificationStatusActivity),
            new SetStatusInput(notificationId, NotificationStatus.Sending));

        // Step 7: Enqueue all Queued records to cc-send.
        await context.CallSubOrchestratorAsync(nameof(SendQueueOrchestrator), notificationId);

        // Step 8: Poll delivery status.
        await context.CallSubOrchestratorAsync(nameof(DataAggregationOrchestrator), notificationId);

        logger.LogInformation(
            "PrepareToSendOrchestrator: Completed for notification {NotificationId}.",
            notificationId);
    }
}
```

**Step 2: Update `UpdateRecipientCountActivity` — remove status transition**

In `src/CompanyCommunicator.Functions.Prep/Activities/UpdateRecipientCountActivity.cs`, replace lines 55-63 with:

```csharp
notification.TotalRecipientCount = input.TotalRecipientCount;
// Status transition to Sending is now handled by PrepareToSendOrchestrator
// after the install step completes.

await _db.SaveChangesAsync(ct).ConfigureAwait(false);

_logger.LogInformation(
    "UpdateRecipientCountActivity: Notification {NotificationId} TotalRecipientCount={Count}.",
    input.NotificationId, input.TotalRecipientCount);
```

**Step 3: Verify build**

Run: `dotnet build src/CompanyCommunicator.Functions.Prep/CompanyCommunicator.Functions.Prep.csproj`
Expected: SUCCESS

**Step 4: Commit**

```bash
git add src/CompanyCommunicator.Functions.Prep/Orchestrators/PrepareToSendOrchestrator.cs
git add src/CompanyCommunicator.Functions.Prep/Activities/UpdateRecipientCountActivity.cs
git commit -m "feat: wire InstallAppOrchestrator into pipeline with unconditional MarkUnreachable"
```

---

## CODE REVIEW CHECKPOINT 4

**Reviewer:** `code-reviewer` agent
**Scope:** Task 12
**Focus areas:**
- Config read via `GetInstallConfigActivity` before install
- `InstallAppInput` uses 7-parameter constructor (with defaults for cursor/counter fields)
- `MarkUnreachableActivity` conditional — only at root level when install is skipped or fails (v5-R4)
- `try/catch(TaskFailedException)` wraps install sub-orchestrator for graceful degradation (v5-R8)
- Final `RefreshConversationIdsActivity` before `MarkUnreachableActivity` in catch path (v5-R5)
- Status flow: SyncingRecipients → InstallingApp → Sending
- `UpdateRecipientCountActivity` no longer sets Sending status

---

## Task 13: Infrastructure changes (Bicep + host.json)

**Files:**
- Modify: `infra/modules/function-app-prep.bicep`
- Modify: `infra/main.bicep`
- Modify: `src/CompanyCommunicator.Functions.Prep/host.json`

**Step 1: Add Bicep parameters to `function-app-prep.bicep`**

Add after `serviceBusFullyQualifiedNamespace` parameter:

```bicep
@description('Teams app external ID for proactive bot installation (bot Entra app client ID).')
param botTeamsAppId string

@description('Seconds to wait between install waves and ConversationId refresh.')
@minValue(10)
@maxValue(300)
param installWaitSeconds int = 60

@description('Maximum ConversationId refresh attempts.')
@minValue(1)
@maxValue(30)
param maxRefreshAttempts int = 20
```

**Step 2: Add app settings to `function-app-prep.bicep`**

Add after the `DurableTask__HubName` entry in the appSettings array:

```bicep
{
  name: 'Bot__TeamsAppId'
  value: botTeamsAppId
}
{
  name: 'Bot__InstallWaitSeconds'
  value: string(installWaitSeconds)
}
{
  name: 'Bot__MaxRefreshAttempts'
  value: string(maxRefreshAttempts)
}
```

**Step 3: Update `main.bicep`**

Add top-level parameters (after `botAppId`):

```bicep
@description('Seconds to wait between install waves. Default: 60.')
@minValue(10)
@maxValue(300)
param installWaitSeconds int = 60

@description('Maximum ConversationId refresh attempts. Default: 20.')
@minValue(1)
@maxValue(30)
param maxRefreshAttempts int = 20
```

Pass to the Prep Function module (add to `functionAppPrep` params):

```bicep
botTeamsAppId: botAppId
installWaitSeconds: installWaitSeconds
maxRefreshAttempts: maxRefreshAttempts
```

**Step 4: Merge `host.json` — preserve existing sections, add activity concurrency**

Replace `src/CompanyCommunicator.Functions.Prep/host.json`:

```json
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensions": {
    "durableTask": {
      "maxConcurrentActivityFunctions": 50,
      "storageProvider": {
        "type": "AzureStorage"
      }
    },
    "serviceBus": {
      "prefetchCount": 0,
      "maxConcurrentCalls": 5,
      "autoCompleteMessages": true,
      "maxAutoLockRenewalDuration": "00:10:00"
    }
  }
}
```

**Step 5: Verify Bicep**

Run: `az bicep build --file infra/main.bicep`

**Step 6: Commit**

```bash
git add infra/modules/function-app-prep.bicep infra/main.bicep
git add src/CompanyCommunicator.Functions.Prep/host.json
git commit -m "infra: add bot install config and activity concurrency limit"
```

---

## CODE REVIEW CHECKPOINT 5

**Reviewer:** `security-engineer` agent
**Scope:** Task 13 (Bicep + host.json)
**Focus areas:**
- `botTeamsAppId` NOT marked `@secure()` (correct — public app ID)
- All 3 parameters flow from main.bicep to module
- `host.json` preserves existing logging, storageProvider, serviceBus sections
- Bicep defaults: `installWaitSeconds=60`, `maxRefreshAttempts=20` (v5-R2 — aligned with code defaults)

---

## Task 14: Update documentation

**Files:**
- Modify: `docs/setup-guide.md` — Add app settings, Graph permission, scaling guidance
- Modify: `docs/proactive-install-feature.md` — Mark as implemented
- Modify: `docs/architecture.md` — Update message flow

**Step 1: Update setup-guide.md**

Add to the Prep Function app settings table:

| Setting | Value | Purpose |
|---------|-------|---------|
| `Bot__TeamsAppId` | Bot's Entra app registration client ID | Used for Graph API proactive install. **NOT** the managed identity client ID. |
| `Bot__InstallWaitSeconds` | `30` (default) | Seconds between install waves and ConversationId refresh |
| `Bot__MaxRefreshAttempts` | `3` (default) | Maximum polling cycles for ConversationId refresh |

Add to the Graph API permissions section:

| Permission | Type | Purpose |
|------------|------|---------|
| `TeamsAppInstallation.ReadWriteForUser.All` | Application | Install bot in user's personal scope |
| `TeamsAppInstallation.ReadWriteForTeam.All` | Application | Install bot in team scope (**NEW — must be admin-consented**) |

Add scaling guidance:

| Notification size | Recommended plan | Reason |
|---|---|---|
| Up to 5,000 users | S1 (1 vCore) | Default |
| 5,000 – 10,000 users | S2 (2 vCores) | Doubles callback throughput |
| 10,000 – 50,000 users | P1v2 or S3 | Required for burst handling |

**Step 2: Update proactive-install-feature.md**

Add a "Status: Implemented (Personal + Team Scope)" header. Note both delivery paths:
- **Personal scope**: Windowed fan-out with keyset pagination, 50k scale
- **Team scope**: Simple sequential install, General channel delivery
- `AudienceType.Team` → `SyncTeamChannelActivity` (one SentNotification per team)
- `AudienceType.Roster` → `SyncTeamMembersActivity` (individual user DMs)

**Step 3: Update architecture.md**

Update the notification pipeline flow:
```
StoreCard → SyncRecipients (Users + Teams) → UpdateCount → ReadConfig
→ InstallApp [User fan-out + Team install + Shared polling + MarkUnreachable]
→ MarkUnreachable (defense-in-depth) → SetSending → SendQueue → DataAggregation
```

**Step 4: Commit**

```bash
git add docs/setup-guide.md docs/proactive-install-feature.md docs/architecture.md
git commit -m "docs: update for proactive install with personal + team scope delivery"
```

---

## Final Verification Checklist

1. **Full solution builds**: `dotnet build src/CompanyCommunicator.sln`
2. **Bicep validates**: `az bicep build --file infra/main.bicep`
3. **Migrations correct**: Filtered partial indexes (User + Team) + AadGroupId column + unique index
4. **Status flow**: Draft → Queued → SyncingRecipients → InstallingApp → Sending → Sent
5. **Audience routing**: `Team` → `SyncTeamChannelActivity`, `Roster` → `SyncTeamMembersActivity`
6. **Team ID mapping**: `NotificationAudience.AudienceId` (AAD group ID) → `Team.AadGroupId` → `Team.TeamId` (ConversationId)
7. **Two Graph install APIs**: `InstallAppForUserAsync` (personal) + `InstallAppInTeamAsync` (team)
8. **RecipientType filter**: `GetInstallBatchActivity` filters `RecipientType = "User"` only
9. **Dual refresh SQL**: `RefreshConversationIdsActivity` joins Users (personal) + Teams (team)
10. **MarkUnreachable**: Handles both types (no RecipientType filter — marks ALL null ConversationId)
11. **Graceful degradation**: If `Bot__TeamsAppId` missing → install skipped; `MarkUnreachable` still runs
12. **Scale**: Keyset pagination (users), windowed fan-out (users), simple loop (teams)
13. **Graph permissions**: `ReadWriteForUser.All` (existing) + `ReadWriteForTeam.All` (new — document for admin)
14. **Bot handler**: Populates `Team.AadGroupId` on both create and update paths (GUID validated)
15. **Send Function**: Works for both personal + channel ConversationIds (no changes needed)
16. **Replay safety**: No config reads in orchestrators; all via `GetInstallConfigActivity`
17. **Resilience**: `BrokenCircuitException` propagates; polling has safety-net deadline
18. **host.json preserved**: Existing logging, storageProvider, serviceBus sections intact
19. **(v5) AudienceId GUID validation**: At API boundary in `InputValidator` (Task 0)
20. **(v5) Filtered partial indexes**: Two filtered indexes replace v4 composite index (Task 4)
21. **(v5) ContinueAsNew**: Orchestrator checkpoints every 25 wave cycles (~5k users) (Task 10)
22. **(v5) Adaptive backoff**: Polling uses stepped intervals + 3-stall early exit (Task 10)
23. **(v5) Conditional MarkUnreachable**: Only at root level when install skipped/failed (Task 12)
24. **(v5) Install failure resilience**: `try/catch(TaskFailedException)` in root orchestrator (Task 12)
25. **(v5) Final Refresh before MarkUnreachable**: Catches late-arriving callbacks (Task 12)
26. **(v5) Duplicate team guard**: `SyncTeamChannelActivity` checks existence before insert (Task 9)
27. **(v5) ChannelData hardened**: GUID validation + typed catch in bot handler fallback (Task 7)
28. **(v5) Activity parallelism**: `SemaphoreSlim(5)` in `InstallAppForUsersActivity` (Task 8)
29. **(v5) Single SQL query**: `GetInstallBatchActivity` fetches all pages in one round-trip (Task 8)
30. **(v5) Bicep defaults aligned**: `installWaitSeconds=60`, `maxRefreshAttempts=20` (Task 13)

## Post-Implementation Recommendations (from Security Review)

These items are NOT blocking implementation but should be addressed before production at scale:

1. **Graph audit log alerts**: Configure Azure Monitor alerts on Graph API audit logs for `TeamsAppInstallation` events exceeding expected volume (e.g., >55,000/day)
2. **Conditional Access on MI**: Restrict the managed identity's service principal to known Azure IPs only
3. **In-flight notification limit**: Add a concurrency guard in `NotificationsController` — reject new sends if >3 notifications are in `Queued`/`SyncingRecipients`/`InstallingApp`/`Sending` status
4. **Dedicated install MI (optional)**: Consider a separate managed identity exclusively for install operations (isolates `ReadWriteForUser.All` + `ReadWriteForTeam.All` from read-only permissions)
5. **Graph API load documentation**: Document expected API load per notification in operations guide
6. **Application Insights retention**: Set 90-day data retention policy

## Files Created/Modified Summary

| Action | File |
|--------|------|
| Modified | `src/CompanyCommunicator.Api/Validation/InputValidator.cs` (Task 0) |
| Modified ✅ | `src/CompanyCommunicator.Core/Services/Graph/IGraphService.cs` |
| Modified ✅ | `src/CompanyCommunicator.Core/Services/Graph/GraphService.cs` |
| Modified ✅ | `src/CompanyCommunicator.Core/Services/Recipients/RecipientService.cs` |
| Modified | `src/CompanyCommunicator.Core/Data/Entities/Team.cs` |
| Created | `src/CompanyCommunicator.Core/Data/Configurations/TeamConfiguration.cs` |
| Modified | `src/CompanyCommunicator.Core/Data/Configurations/SentNotificationConfiguration.cs` |
| Created | `src/CompanyCommunicator.Core/Data/Migrations/<timestamp>_AddInstallLookupIndexAndTeamAadGroupId.cs` |
| Modified | `src/CompanyCommunicator.Functions.Prep/Models/OrchestratorModels.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Activities/GetInstallConfigActivity.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Activities/GetInstallBatchActivity.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Activities/InstallAppForUsersActivity.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Activities/InstallAppForTeamsActivity.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Activities/RefreshConversationIdsActivity.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Activities/MarkUnreachableActivity.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Activities/SetNotificationStatusActivity.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Activities/SyncTeamChannelActivity.cs` |
| Created | `src/CompanyCommunicator.Functions.Prep/Orchestrators/InstallAppOrchestrator.cs` |
| Modified | `src/CompanyCommunicator.Functions.Prep/Orchestrators/SyncRecipientsOrchestrator.cs` |
| Modified | `src/CompanyCommunicator.Functions.Prep/Orchestrators/PrepareToSendOrchestrator.cs` |
| Modified | `src/CompanyCommunicator.Functions.Prep/Activities/UpdateRecipientCountActivity.cs` |
| Modified | `src/CompanyCommunicator.Functions.Prep/host.json` |
| Modified | `src/CompanyCommunicator.Api/Bot/CommunicatorActivityHandler.cs` |
| Modified | `infra/modules/function-app-prep.bicep` |
| Modified | `infra/main.bicep` |
| Modified | `docs/setup-guide.md` |
| Modified | `docs/proactive-install-feature.md` |
| Modified | `docs/architecture.md` |

Files marked ✅ are already committed (Tasks 1-3).
