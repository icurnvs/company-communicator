using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Services.Queue;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Triggers;

/// <summary>
/// Timer trigger: runs every minute to check for notifications whose
/// <see cref="Notification.ScheduledDate"/> has arrived and that are still
/// in <c>Scheduled</c> status. Transitions each to <c>Queued</c> and enqueues
/// a prepare message so the Durable orchestration can start.
/// </summary>
public sealed class ScheduleCheckTrigger
{
    private readonly AppDbContext _db;
    private readonly IServiceBusService _serviceBusService;
    private readonly ILogger<ScheduleCheckTrigger> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="ScheduleCheckTrigger"/>.
    /// </summary>
    public ScheduleCheckTrigger(
        AppDbContext db,
        IServiceBusService serviceBusService,
        ILogger<ScheduleCheckTrigger> logger)
    {
        _db = db;
        _serviceBusService = serviceBusService;
        _logger = logger;
    }

    /// <summary>
    /// Function entry point. Scans for due scheduled notifications and kicks off preparation.
    /// </summary>
    /// <param name="timer">Timer information (not used beyond triggering).</param>
    /// <param name="ctx">Function execution context.</param>
    [Function(nameof(ScheduleCheckTrigger))]
    public async Task Run(
        [TimerTrigger("0 */1 * * * *")] TimerInfo timer,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        var now = DateTime.UtcNow;

        var dueNotifications = await _db.Notifications
            .Where(n => n.Status == NotificationStatus.Scheduled
                        && n.ScheduledDate.HasValue
                        && n.ScheduledDate.Value <= now)
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (dueNotifications.Count == 0)
        {
            _logger.LogDebug(
                "ScheduleCheckTrigger: No due scheduled notifications at {UtcNow:O}.", now);
            return;
        }

        _logger.LogInformation(
            "ScheduleCheckTrigger: Found {Count} due notification(s) at {UtcNow:O}.",
            dueNotifications.Count, now);

        foreach (var notification in dueNotifications)
        {
            try
            {
                notification.Status = NotificationStatus.Queued;
                await _db.SaveChangesAsync(ct).ConfigureAwait(false);

                await _serviceBusService
                    .SendPrepareMessageAsync(notification.Id, ct)
                    .ConfigureAwait(false);

                _logger.LogInformation(
                    "ScheduleCheckTrigger: Enqueued prepare message for notification {NotificationId}.",
                    notification.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "ScheduleCheckTrigger: Failed to process notification {NotificationId}.",
                    notification.Id);
            }
        }
    }
}
