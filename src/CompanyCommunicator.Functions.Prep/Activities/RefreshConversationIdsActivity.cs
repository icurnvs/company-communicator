using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class RefreshConversationIdsActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<RefreshConversationIdsActivity> _logger;

    public RefreshConversationIdsActivity(AppDbContext db, ILogger<RefreshConversationIdsActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    [Function(nameof(RefreshConversationIdsActivity))]
    public async Task<RefreshResult> RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var refreshedUsers = await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE sn
            SET sn.ConversationId = u.ConversationId,
                sn.ServiceUrl     = u.ServiceUrl
            FROM SentNotifications sn
            INNER JOIN Users u ON u.AadId = sn.RecipientId
                               AND u.ConversationId IS NOT NULL
            WHERE sn.NotificationId = {notificationId}
              AND sn.ConversationId IS NULL
              AND sn.RecipientType = 'User'
              AND sn.DeliveryStatus = 'Queued'",
            ct).ConfigureAwait(false);

        // v5-R12: No ConversationId IS NULL filter for teams — always overwrite from the Teams
        // table so that stale ConversationIds (e.g. from old bot-app-as-author era) are corrected.
        var refreshedTeams = await _db.Database.ExecuteSqlInterpolatedAsync($@"
            UPDATE sn
            SET sn.ConversationId = t.TeamId,
                sn.ServiceUrl     = t.ServiceUrl
            FROM SentNotifications sn
            INNER JOIN Teams t ON t.AadGroupId = sn.RecipientId
            WHERE sn.NotificationId = {notificationId}
              AND sn.RecipientType = 'Team'
              AND sn.DeliveryStatus = 'Queued'",
            ct).ConfigureAwait(false);

        var totalRefreshed = refreshedUsers + refreshedTeams;

        var stillPending = await _db.SentNotifications
            .AsNoTracking()
            .Where(s => s.NotificationId == notificationId
                        && s.ConversationId == null
                        && s.DeliveryStatus == DeliveryStatus.Queued)
            .CountAsync(ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "RefreshConversationIdsActivity: Notification {NotificationId} — " +
            "RefreshedUsers={Users}, RefreshedTeams={Teams}, StillPending={StillPending}.",
            notificationId, refreshedUsers, refreshedTeams, stillPending);

        return new RefreshResult(totalRefreshed, stillPending);
    }
}
