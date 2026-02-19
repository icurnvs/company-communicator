namespace CompanyCommunicator.Functions.Prep.Models;

/// <summary>
/// Carries the audience configuration of a notification from
/// <c>GetNotificationAudienceActivity</c> to <c>SyncRecipientsOrchestrator</c>.
/// </summary>
public sealed record NotificationAudienceInfo(
    Guid NotificationId,
    bool AllUsers,
    IReadOnlyList<AudienceInfo> Audiences);

/// <summary>
/// A single audience target (Team, Roster, or Group) within a notification.
/// </summary>
public sealed record AudienceInfo(string AudienceType, string AudienceId);

/// <summary>
/// Input passed to a sync activity to identify which notification and audience to process.
/// </summary>
public sealed record SyncInput(Guid NotificationId, string AudienceId);

/// <summary>
/// Input passed to <c>UpdateRecipientCountActivity</c> after all syncs complete.
/// </summary>
public sealed record UpdateCountInput(Guid NotificationId, int TotalRecipientCount);

/// <summary>
/// Result returned by <c>DataAggregationActivity</c> on each polling cycle.
/// </summary>
public sealed record AggregationResult(
    bool IsComplete,
    int Total,
    int Succeeded,
    int Failed,
    int NotFound,
    int Canceled,
    int Unknown);

/// <summary>
/// Input passed to <c>SendBatchToQueueActivity</c> to identify which page of
/// <see cref="CompanyCommunicator.Core.Data.Entities.SentNotification"/> records to load.
/// </summary>
public sealed record SendBatchInput(Guid NotificationId, int BatchNumber, int BatchSize);

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
    int CarriedFailed = 0,
    DateTime? Deadline = null);

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
