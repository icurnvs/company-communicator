using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Services.Graph;
using CompanyCommunicator.Core.Services.Recipients;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: syncs members of an AAD group, upserts the User table,
/// and creates <see cref="SentNotification"/> records.
/// </summary>
public sealed class SyncGroupMembersActivity
{
    private readonly AppDbContext _db;
    private readonly IGraphService _graphService;
    private readonly IRecipientService _recipientService;
    private readonly ILogger<SyncGroupMembersActivity> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="SyncGroupMembersActivity"/>.
    /// </summary>
    public SyncGroupMembersActivity(
        AppDbContext db,
        IGraphService graphService,
        IRecipientService recipientService,
        ILogger<SyncGroupMembersActivity> logger)
    {
        _db = db;
        _graphService = graphService;
        _recipientService = recipientService;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Returns the total number of recipient records created.
    /// </summary>
    /// <param name="input">Identifies which notification and AAD group to sync.</param>
    /// <param name="ctx">Function execution context.</param>
    /// <returns>Count of <see cref="SentNotification"/> records inserted.</returns>
    [Function(nameof(SyncGroupMembersActivity))]
    public async Task<int> RunActivity(
        [ActivityTrigger] SyncInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        _logger.LogInformation(
            "SyncGroupMembersActivity: Syncing group {GroupId} for notification {NotificationId}.",
            input.AudienceId, input.NotificationId);

        var users = await _graphService
            .GetGroupMembersAsync(input.AudienceId, ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "SyncGroupMembersActivity: Retrieved {Count} members from group {GroupId}.",
            users.Count, input.AudienceId);

        await UpsertUsersAsync(users, ct).ConfigureAwait(false);

        var aadIds = users
            .Where(u => !string.IsNullOrWhiteSpace(u.AadId))
            .Select(u => u.AadId)
            .Distinct()
            .ToList();

        var count = await _recipientService
            .BatchCreateSentNotificationsAsync(input.NotificationId, aadIds, ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "SyncGroupMembersActivity: Created {Count} SentNotification records for group {GroupId}.",
            count, input.AudienceId);

        return count;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private async Task UpsertUsersAsync(
        IReadOnlyList<Core.Data.Entities.User> users,
        CancellationToken ct)
    {
        if (users.Count == 0)
        {
            return;
        }

        var aadIds = users
            .Where(u => !string.IsNullOrWhiteSpace(u.AadId))
            .Select(u => u.AadId)
            .ToList();

        var existing = await _db.Users
            .Where(u => aadIds.Contains(u.AadId))
            .ToDictionaryAsync(u => u.AadId, ct)
            .ConfigureAwait(false);

        foreach (var graphUser in users)
        {
            if (string.IsNullOrWhiteSpace(graphUser.AadId))
            {
                continue;
            }

            if (existing.TryGetValue(graphUser.AadId, out var dbUser))
            {
                dbUser.Name = graphUser.Name;
                dbUser.Email = graphUser.Email;
                dbUser.Upn = graphUser.Upn;
                dbUser.UserType = graphUser.UserType;
                dbUser.TenantId = graphUser.TenantId;
                dbUser.LastSyncedDate = DateTime.UtcNow;
            }
            else
            {
                graphUser.LastSyncedDate = DateTime.UtcNow;
                await _db.Users.AddAsync(graphUser, ct).ConfigureAwait(false);
            }
        }

        await _db.SaveChangesAsync(ct).ConfigureAwait(false);
    }
}
