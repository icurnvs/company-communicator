# Proactive Install Plan — Handoff Document

## Session Summary (2026-02-18)

Executed Tasks 1-3 of the proactive install plan (`docs/plans/2026-02-18-proactive-install.md`), then discovered a scope gap during review: the plan only covers **personal-scope** (user DM) delivery, but the project also requires **team-scope** (General channel) delivery. The plan needs expansion before continuing.

## Completed Work (committed to `main`)

| Commit | Task | Description |
|--------|------|-------------|
| `a404f05` | Task 1 | Added `InstallAppForUserAsync` to `IGraphService` interface |
| `b7381e1` | Task 2 | Implemented `InstallAppForUserAsync` in `GraphService` with `UserScopeTeamsAppInstallation` |
| `042d037` | Task 3 | Patched `RecipientService.BatchCreateSentNotificationsAsync` to join `Users` table for ConversationId/ServiceUrl |

### Deviation from Plan in Task 2

The plan specified `TeamsAppInstallation` but Graph SDK v5 (5.102.0) requires `UserScopeTeamsAppInstallation` for the `Users[id].Teamwork.InstalledApps.PostAsync` endpoint. Validated against:
- Compiler error CS1503 confirmed the wrong type
- Microsoft docs confirm `UserScopeTeamsAppInstallation` for personal scope: https://learn.microsoft.com/en-us/graph/api/userteamwork-post-installedapps?view=graph-rest-1.0
- `TeamsAppInstallation` is the correct type for **team-scoped** install (`/teams/{teamId}/installedApps`) — which is part of the gap discovered below.

## Pending Work from Original Plan (Tasks 4-10)

Tasks 4-10 are unchanged and still valid for personal-scope. The original plan file has full details: `docs/plans/2026-02-18-proactive-install.md`

## Discovered Gap: Team Channel Delivery

### Problem

The `SyncRecipientsOrchestrator` treats `AudienceType.Team` and `AudienceType.Roster` identically (line 58):

```csharp
AudienceType.Roster or AudienceType.Team =>
    context.CallActivityAsync<int>(
        nameof(SyncTeamMembersActivity),
        syncInput),
```

Both resolve team members into individual User-type SentNotification records. But per original project intent:
- **Team** = post a single message to the team's **General channel**
- **Roster** = send individual **personal DMs** to each member of a team

There is no code path that creates a team-channel SentNotification or posts to a team channel.

### What Exists Already

- `Teams` table with `TeamId`, `ServiceUrl`, `TenantId`, `Name` (entity: `src/CompanyCommunicator.Core/Data/Entities/Team.cs`)
- `CommunicatorActivityHandler.OnTeamsMembersAddedAsync` saves team records when bot is installed in a team
- `SentNotification.RecipientType` supports "User" and "Team" values
- `SendFunctionMessageSender.SendNotificationAsync` posts to any ConversationId — a channel ID works the same as personal chat via Bot Framework REST API
- `AudienceType.Team` constant exists and is used in the sync orchestrator

### What's Missing for Team Channel Delivery

| Component | What's Needed |
|-----------|---------------|
| `IGraphService` / `GraphService` | New method `InstallAppInTeamAsync(string teamId, string teamsAppId, CancellationToken ct)` using `TeamsAppInstallation` against `POST /teams/{teamId}/installedApps` |
| Graph Permission | `TeamsAppInstallation.ReadWriteForTeam.All` (application) on the managed identity |
| `SyncRecipientsOrchestrator` | Split `AudienceType.Team` to a new `SyncTeamChannelActivity` instead of `SyncTeamMembersActivity` |
| `SyncTeamChannelActivity` (new) | For each Team audience: look up `Teams` table for ConversationId/ServiceUrl, create a single `SentNotification` with `RecipientType = "Team"` |
| `InstallAppOrchestrator` | Branch for team-scope install: if team not in `Teams` table, call `InstallAppInTeamAsync`, wait for `conversationUpdate` callback |
| Bicep / Graph permissions | Add `TeamsAppInstallation.ReadWriteForTeam.All` to managed identity permissions |

### Two Graph Install APIs

| Scope | API Endpoint | SDK Type | Permission |
|-------|-------------|----------|------------|
| Personal (user DM) | `POST /users/{userId}/teamwork/installedApps` | `UserScopeTeamsAppInstallation` | `TeamsAppInstallation.ReadWriteForUser.All` (already granted) |
| Team (channel post) | `POST /teams/{teamId}/installedApps` | `TeamsAppInstallation` | `TeamsAppInstallation.ReadWriteForTeam.All` (**needs to be added**) |

### Impact on Completed Tasks 1-3

**None.** All three commits are correct for personal scope and do not need changes:
- Task 1-2: `InstallAppForUserAsync` is correct for personal scope; team scope needs a new separate method
- Task 3: `RecipientService` only handles User-type recipients; team channel recipients are created by a different activity

### Key Files to Read for Plan Expansion

| File | Why |
|------|-----|
| `docs/plans/2026-02-18-proactive-install.md` | Full original plan (Tasks 4-10 still valid for personal scope) |
| `docs/proactive-install-feature.md` | Design doc with architecture context |
| `src/CompanyCommunicator.Core/Data/Entities/Team.cs` | Team entity (TeamId, ServiceUrl, TenantId) |
| `src/CompanyCommunicator.Core/Data/Entities/NotificationAudience.cs` | AudienceType constants (Team, Roster, Group) |
| `src/CompanyCommunicator.Functions.Prep/Orchestrators/SyncRecipientsOrchestrator.cs` | Where Team/Roster split needs to happen |
| `src/CompanyCommunicator.Api/Bot/CommunicatorActivityHandler.cs` | Bot handler — `OnTeamsMembersAddedAsync` (team install callback) and `OnInstallationUpdateAddAsync` (personal install callback) |
| `src/CompanyCommunicator.Functions.Send/Services/Bot/SendFunctionMessageSender.cs` | Send implementation — `SendNotificationAsync` works for both personal and channel ConversationIds |
| `src/CompanyCommunicator.Functions.Send/SendMessageFunction.cs` | Send Function — uses ConversationId from SendQueueMessage |
| `src/CompanyCommunicator.Core/Services/Graph/GraphService.cs` | Current personal-scope install implementation (reference for team-scope method) |
