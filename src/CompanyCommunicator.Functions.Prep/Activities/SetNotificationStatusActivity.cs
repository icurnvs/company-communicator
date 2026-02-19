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
