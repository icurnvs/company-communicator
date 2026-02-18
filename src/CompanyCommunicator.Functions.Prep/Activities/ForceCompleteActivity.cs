using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: forces a notification to a terminal state when the 24-hour safety
/// net fires before all recipients have reached a terminal delivery status.
/// </summary>
public sealed class ForceCompleteActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<ForceCompleteActivity> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="ForceCompleteActivity"/>.
    /// </summary>
    public ForceCompleteActivity(
        AppDbContext db,
        ILogger<ForceCompleteActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Sets the notification status to Sent (or Failed if there
    /// are any failures) and logs a warning.
    /// </summary>
    /// <param name="notificationId">The notification to force-complete.</param>
    /// <param name="ctx">Function execution context.</param>
    [Function(nameof(ForceCompleteActivity))]
    public async Task RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            _logger.LogError(
                "ForceCompleteActivity: Notification {NotificationId} not found.",
                notificationId);
            return;
        }

        // Mark pending/retrying records as Failed.
        var pendingCount = await _db.SentNotifications
            .Where(s => s.NotificationId == notificationId
                        && (s.DeliveryStatus == DeliveryStatus.Queued
                            || s.DeliveryStatus == DeliveryStatus.Retrying))
            .ExecuteUpdateAsync(
                setters => setters
                    .SetProperty(s => s.DeliveryStatus, DeliveryStatus.Failed)
                    .SetProperty(s => s.ErrorMessage, "Forced completion: 24-hour safety net triggered."),
                ct)
            .ConfigureAwait(false);

        // Choose final status.
        notification.Status = notification.FailedCount > 0 || pendingCount > 0
            ? NotificationStatus.Failed
            : NotificationStatus.Sent;

        notification.SentDate = DateTime.UtcNow;
        notification.ErrorMessage = "Forced completion: aggregation exceeded 24-hour limit.";

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        _logger.LogWarning(
            "ForceCompleteActivity: Notification {NotificationId} forced to status '{Status}'. " +
            "{PendingCount} pending records marked as Failed.",
            notificationId, notification.Status, pendingCount);
    }
}
