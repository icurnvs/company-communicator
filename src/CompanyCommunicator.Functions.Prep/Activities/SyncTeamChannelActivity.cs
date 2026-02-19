using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: creates a single team-scoped SentNotification for a Team audience.
/// Unlike SyncTeamMembersActivity (which resolves individual users), this creates
/// ONE record per team targeting the team's General channel.
/// </summary>
public sealed class SyncTeamChannelActivity
{
    private readonly AppDbContext _db;
    private readonly ILogger<SyncTeamChannelActivity> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="SyncTeamChannelActivity"/>.
    /// </summary>
    public SyncTeamChannelActivity(AppDbContext db, ILogger<SyncTeamChannelActivity> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Returns 1 if a SentNotification was created, 0 if skipped (duplicate).
    /// </summary>
    /// <param name="input">Identifies which notification and team (by AAD group ID) to process.</param>
    /// <param name="ctx">Function execution context.</param>
    /// <returns>Count of <see cref="SentNotification"/> records inserted (0 or 1).</returns>
    [Function(nameof(SyncTeamChannelActivity))]
    public async Task<int> RunActivity(
        [ActivityTrigger] SyncInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var team = await _db.Teams
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.AadGroupId == input.AudienceId, ct)
            .ConfigureAwait(false);

        // v5-R9: Guard against duplicate team audience entries.
        var exists = await _db.SentNotifications
            .AnyAsync(
                s => s.NotificationId == input.NotificationId
                  && s.RecipientId == input.AudienceId,
                ct)
            .ConfigureAwait(false);

        if (exists)
        {
            _logger.LogInformation(
                "SyncTeamChannelActivity: Duplicate team {AudienceId} for notification {NotificationId} — skipped.",
                input.AudienceId,
                input.NotificationId);
            return 0;
        }

        var sentNotification = new SentNotification
        {
            NotificationId = input.NotificationId,
            RecipientId = input.AudienceId,      // AAD group ID
            RecipientType = "Team",
            ConversationId = team?.TeamId,        // Bot Framework thread ID (null if bot not installed)
            ServiceUrl = team?.ServiceUrl,
            DeliveryStatus = DeliveryStatus.Queued,
            RetryCount = 0,
        };

        _db.SentNotifications.Add(sentNotification);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        _logger.LogInformation(
            "SyncTeamChannelActivity: Created Team SentNotification for team {AudienceId} " +
            "(notification {NotificationId}). ConversationId={ConversationId}.",
            input.AudienceId,
            input.NotificationId,
            team?.TeamId ?? "(null — install needed)");

        return 1;
    }
}
