using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: aggregates delivery status counts from <see cref="SentNotification"/> records
/// and updates the parent <see cref="Notification"/> entity. Returns an
/// <see cref="AggregationResult"/> that indicates whether all deliveries are terminal.
/// </summary>
public sealed class DataAggregationActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<DataAggregationActivity> _logger;

    // Delivery statuses that are considered "terminal" (no further changes expected).
    private static readonly HashSet<string> TerminalStatuses =
        new(StringComparer.OrdinalIgnoreCase)
        {
            DeliveryStatus.Succeeded,
            DeliveryStatus.Failed,
            DeliveryStatus.RecipientNotFound,
        };

    /// <summary>
    /// Initializes a new instance of <see cref="DataAggregationActivity"/>.
    /// </summary>
    public DataAggregationActivity(
        AppDbContext db,
        ILogger<DataAggregationActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Aggregates delivery status and updates notification counters.
    /// </summary>
    /// <param name="notificationId">The notification to aggregate.</param>
    /// <param name="ctx">Function execution context.</param>
    /// <returns>Aggregated counts and a completion flag.</returns>
    [Function(nameof(DataAggregationActivity))]
    public async Task<AggregationResult> RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        // GROUP BY DeliveryStatus to get counts.
        var counts = await _db.SentNotifications
            .Where(s => s.NotificationId == notificationId)
            .GroupBy(s => s.DeliveryStatus)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct)
            .ConfigureAwait(false);

        int total = counts.Sum(c => c.Count);
        int succeeded = counts.FirstOrDefault(c => c.Status == DeliveryStatus.Succeeded)?.Count ?? 0;
        int failed = counts.FirstOrDefault(c => c.Status == DeliveryStatus.Failed)?.Count ?? 0;
        int notFound = counts.FirstOrDefault(c => c.Status == DeliveryStatus.RecipientNotFound)?.Count ?? 0;
        int queued = counts.FirstOrDefault(c => c.Status == DeliveryStatus.Queued)?.Count ?? 0;
        int retrying = counts.FirstOrDefault(c => c.Status == DeliveryStatus.Retrying)?.Count ?? 0;

        // Canceled/Unknown are statuses we might encounter from edge cases.
        int canceled = counts
            .Where(c => !TerminalStatuses.Contains(c.Status)
                        && c.Status != DeliveryStatus.Queued
                        && c.Status != DeliveryStatus.Retrying)
            .Sum(c => c.Count);
        int unknown = 0; // Reserved for future expansion.

        bool isComplete = queued == 0 && retrying == 0;

        // Update the notification entity's aggregate counters.
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId, ct)
            .ConfigureAwait(false);

        if (notification is not null)
        {
            notification.SucceededCount = succeeded;
            notification.FailedCount = failed;
            notification.RecipientNotFoundCount = notFound;
            notification.CanceledCount = canceled;
            notification.UnknownCount = unknown;

            if (isComplete && notification.Status == NotificationStatus.Sending)
            {
                notification.Status = NotificationStatus.Sent;
                notification.SentDate = DateTime.UtcNow;
            }

            await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        }

        _logger.LogInformation(
            "DataAggregationActivity: Notification {NotificationId} - " +
            "Total={Total}, Succeeded={Succeeded}, Failed={Failed}, " +
            "NotFound={NotFound}, Queued={Queued}, Retrying={Retrying}, IsComplete={IsComplete}.",
            notificationId, total, succeeded, failed, notFound, queued, retrying, isComplete);

        return new AggregationResult(isComplete, total, succeeded, failed, notFound, canceled, unknown);
    }
}
