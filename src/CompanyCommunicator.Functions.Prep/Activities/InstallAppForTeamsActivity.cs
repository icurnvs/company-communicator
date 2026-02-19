using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Services.Graph;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class InstallAppForTeamsActivity
{
    private readonly AppDbContext _db;
    private readonly IGraphService _graphService;
    private readonly string _teamsServiceUrl;
    private readonly ILogger<InstallAppForTeamsActivity> _logger;

    public InstallAppForTeamsActivity(
        AppDbContext db,
        IGraphService graphService,
        IConfiguration config,
        ILogger<InstallAppForTeamsActivity> logger)
    {
        _db = db;
        _graphService = graphService;
        _teamsServiceUrl = config["Bot:TeamsServiceUrl"] ?? "https://smba.trafficmanager.net/amer/";
        _logger = logger;
    }

    [Function(nameof(InstallAppForTeamsActivity))]
    public async Task<InstallBatchResult> RunActivity(
        [ActivityTrigger] InstallTeamsInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var teamGroupIds = await _db.SentNotifications
            .Where(s => s.NotificationId == input.NotificationId
                && s.RecipientType == "Team"
                && s.ConversationId == null
                && s.DeliveryStatus == DeliveryStatus.Queued)
            .Select(s => s.RecipientId)
            .AsNoTracking()
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (teamGroupIds.Count == 0)
        {
            _logger.LogInformation(
                "InstallAppForTeamsActivity: No teams need install for notification {NotificationId}.",
                input.NotificationId);
            return new InstallBatchResult(0, 0);
        }

        int installed = 0, failed = 0;

        foreach (var groupId in teamGroupIds)
        {
            try
            {
                var success = await _graphService
                    .InstallAppInTeamAsync(groupId, input.TeamsAppId, ct)
                    .ConfigureAwait(false);

                if (!success) { failed++; continue; }

                installed++;

                // Immediately retrieve the General channel ID from Graph so we can
                // populate Teams.TeamId without waiting for the conversationUpdate callback.
                // This mirrors the personal-scope pattern in InstallAppForUsersActivity.
                var channelId = await _graphService
                    .GetTeamPrimaryChannelIdAsync(groupId, ct)
                    .ConfigureAwait(false);

                if (channelId is not null)
                {
                    await UpsertTeamRecordAsync(groupId, channelId, ct)
                        .ConfigureAwait(false);
                }
            }
            catch (BrokenCircuitException) { throw; }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex,
                    "InstallAppForTeamsActivity: Error installing in team {TeamGroupId}.", groupId);
                failed++;
            }
        }

        _logger.LogInformation(
            "InstallAppForTeamsActivity: Notification {NotificationId} — Installed={Installed}, Failed={Failed}.",
            input.NotificationId, installed, failed);
        return new InstallBatchResult(installed, failed);
    }

    /// <summary>
    /// Upserts the Team record with the primary channel ID and service URL so that
    /// <see cref="RefreshConversationIdsActivity"/> can copy them to SentNotifications.
    /// </summary>
    private async Task UpsertTeamRecordAsync(string groupId, string channelId, CancellationToken ct)
    {
        var team = await _db.Teams
            .FirstOrDefaultAsync(t => t.AadGroupId == groupId, ct)
            .ConfigureAwait(false);

        if (team is null)
        {
            team = new Team
            {
                TeamId = channelId,
                AadGroupId = groupId,
                ServiceUrl = _teamsServiceUrl,
                InstalledDate = DateTime.UtcNow,
            };
            _db.Teams.Add(team);
        }
        else
        {
            team.TeamId = channelId;
            team.ServiceUrl ??= _teamsServiceUrl;
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        _logger.LogInformation(
            "InstallAppForTeamsActivity: Stored channel {ChannelId} for team {GroupId}.",
            channelId, groupId);
    }
}
