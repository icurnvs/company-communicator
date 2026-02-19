# Feature: Proactive Bot Installation for Recipients

**Status: Implemented (Personal + Team Scope)**

## Delivery Paths

The proactive installation feature now supports two delivery paths:

### Personal Scope (User DMs)
- **Audience type**: `AudienceType.Roster` (individual users within a team)
- **Handler**: `SyncTeamMembersActivity` resolves to individual user AadIds
- **Install flow**: Windowed fan-out with keyset pagination, up to 50k users
- **ConversationId source**: Bot installed via Graph, `conversationUpdate` event flows back to bot endpoint, populates `Users.ConversationId`
- **Delivery**: Proactive messages sent to 1:1 conversations in Teams

### Team Scope (General Channel)
- **Audience type**: `AudienceType.Team` (all team members in one team's General channel)
- **Handler**: `SyncTeamChannelActivity` creates a single SentNotification per team (not per user)
- **Install flow**: Simple sequential install; no windowed batching
- **ConversationId source**: Bot installed in team scope via Graph, `conversationUpdate` event includes team channel reference
- **Delivery**: Proactive messages sent to team's General channel

Both paths use the `InstallAppOrchestrator` and `RefreshConversationIdsActivity` to:
1. Proactively install the bot via Graph API for users/teams without prior installation
2. Poll for `ConversationId` population (with configurable `Bot__InstallWaitSeconds` and `Bot__MaxRefreshAttempts`)
3. Refresh `SentNotification.ConversationId` from the `Users` table after install completes
4. Mark recipients as `RecipientNotFound` if installation fails or `ConversationId` is never populated

## Current Data Flow (Broken)

```
PrepareToSendOrchestrator
  1. StoreCardActivity          → Stores Adaptive Card to blob, sets status to SyncingRecipients
  2. SyncRecipientsOrchestrator → Fetches users from Graph, creates SentNotification records
  3. UpdateRecipientCountActivity → Updates notification with total count, sets status to Sending
  4. SendQueueOrchestrator       → Reads SentNotification records, enqueues to cc-send
  5. DataAggregationOrchestrator → Polls until all sends reach terminal state
```

**Two bugs in this flow:**

### Bug 1: `RecipientService` never populates `ConversationId` on `SentNotification`

`RecipientService.BatchCreateSentNotificationsAsync()` (in `Core/Services/Recipients/RecipientService.cs`) creates `SentNotification` records with only `RecipientId`, `RecipientType`, and `DeliveryStatus`. It does NOT join against the `Users` table to copy `ConversationId` and `ServiceUrl`:

```csharp
// Current code — ConversationId and ServiceUrl are always null
var records = batch.Select(aadId => new SentNotification
{
    NotificationId = notificationId,
    RecipientId = aadId,
    RecipientType = "User",
    DeliveryStatus = DeliveryStatus.Queued,
    RetryCount = 0,
});
```

Even if a user HAD the bot installed, their `ConversationId` would never make it into the `SentNotification` record, and subsequently never into the `SendQueueMessage` payload.

### Bug 2: No proactive installation step in the orchestration

For a fresh deployment (or any user who hasn't manually installed the bot), the `Users` table has no `ConversationId` values. The original CC handled this by proactively installing the bot via Graph API, which triggers a `conversationUpdate` event back to the bot endpoint, which then stores the `ConversationId`.

Our code has ALL the scaffolding for this:
- `TeamsAppInstallation.ReadWriteForUser.All` Graph permission on the managed identity
- `NotificationStatus.InstallingApp` status value (in the enum and DB check constraint)
- `CommunicatorActivityHandler.OnInstallationUpdateAddAsync()` stores `ConversationId` when the bot is installed
- `IGraphService` interface ready for a new method

But no code actually calls the Graph installation API.

## Required Fix

### Fix 1: Populate ConversationId in RecipientService (quick fix)

Change `BatchCreateSentNotificationsAsync()` to join against the `Users` table and copy `ConversationId` and `ServiceUrl` onto each `SentNotification` record:

```
For each recipientAadId:
  Look up User where AadId == recipientAadId
  If user exists and has ConversationId:
    Create SentNotification with ConversationId = user.ConversationId, ServiceUrl = user.ServiceUrl
  Else:
    Create SentNotification with ConversationId = null (will be filled after proactive install)
```

This fix alone would make sends work for users who have already installed the bot manually.

### Fix 2: Add Proactive Installation Activity (new feature)

Add a new step between SyncRecipients (step 2) and SendQueue (step 4) in the orchestration:

```
PrepareToSendOrchestrator (updated)
  1. StoreCardActivity
  2. SyncRecipientsOrchestrator
  3. UpdateRecipientCountActivity
  4. **NEW: InstallAppOrchestrator** → Sets status to InstallingApp
  5. **NEW: RefreshConversationIdsActivity** → Copies ConversationId from Users to SentNotifications
  6. SendQueueOrchestrator
  7. DataAggregationOrchestrator
```

#### InstallAppOrchestrator / InstallAppForUsersActivity

This new sub-orchestrator/activity needs to:

1. Query `SentNotification` records for the notification where `ConversationId IS NULL`
2. For each such recipient, call the Graph API to install the bot:
   ```
   POST /users/{userAadId}/teamwork/installedApps
   Body: { "teamsApp@odata.bind": "https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/{teamsAppExternalId}" }
   ```
   Where `{teamsAppExternalId}` is the Teams app's external ID from the manifest (same as the bot's Entra app client ID: `6bba2c86-278f-4d4d-a7cf-3548247dc228`).
3. Handle errors gracefully:
   - **409 Conflict** = app already installed (OK, proceed)
   - **403 Forbidden** = admin policy blocks installation (mark as RecipientNotFound)
   - **404 Not Found** = user not found or no Teams license (mark as RecipientNotFound)
   - Throttling (429) = back off and retry
4. Process in batches with concurrency limits to avoid Graph throttling
5. After all installations, wait a short period (e.g., 10-30 seconds) for the `conversationUpdate` events to flow back to the bot endpoint and populate the `ConversationId` in the Users table

#### RefreshConversationIdsActivity

After the installation step:

1. Query `SentNotification` records where `ConversationId IS NULL`
2. Join against `Users` table to pick up freshly-populated `ConversationId` and `ServiceUrl` values
3. Update the `SentNotification` records in batch
4. Any recipients still without `ConversationId` after this step should be marked as `RecipientNotFound` (the bot install failed or the `conversationUpdate` didn't arrive)

## Files That Need Changes

| File | Change |
|------|--------|
| `Core/Services/Recipients/RecipientService.cs` | Join against Users to populate ConversationId/ServiceUrl on SentNotification creation |
| `Core/Services/Graph/IGraphService.cs` | Add `InstallAppForUserAsync(string userAadId, string teamsAppId, CancellationToken ct)` method |
| `Core/Services/Graph/GraphService.cs` | Implement `InstallAppForUserAsync` using Graph SDK |
| `Functions.Prep/Activities/InstallAppForUsersActivity.cs` | **NEW** — Batch proactive install via Graph for users without ConversationId |
| `Functions.Prep/Activities/RefreshConversationIdsActivity.cs` | **NEW** — Copy ConversationId from Users to SentNotifications after install |
| `Functions.Prep/Orchestrators/InstallAppOrchestrator.cs` | **NEW** — Sub-orchestrator managing install batches with throttle handling |
| `Functions.Prep/Orchestrators/PrepareToSendOrchestrator.cs` | Insert InstallAppOrchestrator and RefreshConversationIdsActivity between steps 3 and 4 |
| `Functions.Prep/Program.cs` | No changes needed (activities auto-discovered by Functions runtime) |

## Configuration Required

A new app setting is needed on the Prep Function (and possibly the main app):

| Setting | Value | Purpose |
|---------|-------|---------|
| `Bot__TeamsAppId` | The Teams app external ID (same as bot Entra client ID for custom apps: `6bba2c86-278f-4d4d-a7cf-3548247dc228`) | Used in the Graph `teamsApp@odata.bind` URL |

This also needs to be added to the Bicep module (`infra/modules/function-app-prep.bicep`).

## Graph API Details

### Install app for user
```
POST https://graph.microsoft.com/v1.0/users/{user-aad-id}/teamwork/installedApps
Content-Type: application/json

{
  "teamsApp@odata.bind": "https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/{teams-app-external-id}"
}
```

**Required permission**: `TeamsAppInstallation.ReadWriteForUser.All` (application) — already granted to the managed identity.

**Important**: The `{teams-app-external-id}` is the `id` field from the Teams app manifest (`manifest.json`). For custom-uploaded apps, this is typically the same as the bot's Entra app registration client ID.

### Expected behavior after installation
1. Graph returns `201 Created`
2. Teams sends a `conversationUpdate` activity (with `installationUpdate` action) to the bot's messaging endpoint
3. `CommunicatorActivityHandler.OnInstallationUpdateAddAsync()` processes the event and stores `ConversationId` + `ServiceUrl` on the User record
4. The RefreshConversationIdsActivity then copies these values to the SentNotification records

### Timing consideration
There is a delay between the Graph install call returning and the `conversationUpdate` arriving at the bot. The original CC handled this with a polling loop. Our orchestrator should use `context.CreateTimer()` (Durable Functions timer) to wait 15-30 seconds after the install batch completes before running RefreshConversationIdsActivity.

## Existing Scaffolding Already in Place

- **Graph permission**: `TeamsAppInstallation.ReadWriteForUser.All` — already granted to MI
- **Notification status**: `InstallingApp` — already in the status enum and DB check constraint
- **Bot handler**: `OnInstallationUpdateAddAsync` — already stores ConversationId when bot is installed
- **User entity**: Has `ConversationId` and `ServiceUrl` fields
- **SentNotification entity**: Has `ConversationId` and `ServiceUrl` fields (just never populated)
- **Frontend i18n**: Has `"InstallingApp": "Installing App"` translation string

## Testing Plan

1. **Fix 1 alone**: Install the bot manually for one user, send a notification. That one user should receive it.
2. **Fix 1 + Fix 2**: Send a notification to "All Users" — the proactive install should install the bot for everyone and then deliver.
3. **Edge cases**: Users who block bot installs, guest users, users without Teams licenses.
