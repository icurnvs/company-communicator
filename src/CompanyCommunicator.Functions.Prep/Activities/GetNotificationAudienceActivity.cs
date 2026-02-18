using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: loads a notification's audience configuration from the database and
/// returns a serialization-safe DTO consumed by <c>SyncRecipientsOrchestrator</c>.
/// </summary>
public sealed class GetNotificationAudienceActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<GetNotificationAudienceActivity> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="GetNotificationAudienceActivity"/>.
    /// </summary>
    public GetNotificationAudienceActivity(
        AppDbContext db,
        ILogger<GetNotificationAudienceActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Returns the audience descriptor for the given notification.
    /// </summary>
    /// <param name="notificationId">The notification whose audience to load.</param>
    /// <param name="ctx">Function execution context.</param>
    /// <returns>A <see cref="NotificationAudienceInfo"/> DTO.</returns>
    [Function(nameof(GetNotificationAudienceActivity))]
    public async Task<NotificationAudienceInfo> RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var notification = await _db.Notifications
            .Include(n => n.Audiences)
            .FirstOrDefaultAsync(n => n.Id == notificationId, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            _logger.LogError(
                "GetNotificationAudienceActivity: Notification {NotificationId} not found.",
                notificationId);
            throw new InvalidOperationException(
                $"Notification {notificationId} not found.");
        }

        var audiences = notification.Audiences
            .Select(a => new AudienceInfo(a.AudienceType, a.AudienceId))
            .ToList();

        _logger.LogInformation(
            "GetNotificationAudienceActivity: Notification {NotificationId} AllUsers={AllUsers}, " +
            "Audience count={Count}.",
            notificationId, notification.AllUsers, audiences.Count);

        return new NotificationAudienceInfo(notificationId, notification.AllUsers, audiences);
    }
}
