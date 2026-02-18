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
