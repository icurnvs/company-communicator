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
