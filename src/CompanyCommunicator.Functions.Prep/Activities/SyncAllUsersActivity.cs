using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Services.Graph;
using CompanyCommunicator.Core.Services.Recipients;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: syncs all tenant users via Graph delta query, upserts the User table,
/// and creates <see cref="SentNotification"/> records for the given notification.
/// </summary>
public sealed class SyncAllUsersActivity
{
    private readonly AppDbContext _db;
    private readonly IGraphService _graphService;
    private readonly IRecipientService _recipientService;
    private readonly ILogger<SyncAllUsersActivity> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="SyncAllUsersActivity"/>.
    /// </summary>
    public SyncAllUsersActivity(
        AppDbContext db,
        IGraphService graphService,
        IRecipientService recipientService,
        ILogger<SyncAllUsersActivity> logger)
    {
        _db = db;
        _graphService = graphService;
        _recipientService = recipientService;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Returns the total number of recipient records created.
    /// </summary>
    /// <param name="notificationId">The parent notification identifier.</param>
    /// <param name="ctx">Function execution context.</param>
    /// <returns>Count of <see cref="SentNotification"/> records inserted.</returns>
    [Function(nameof(SyncAllUsersActivity))]
    public async Task<int> RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        _logger.LogInformation(
            "SyncAllUsersActivity: Starting full-tenant user sync for notification {NotificationId}.",
            notificationId);

        // Use delta query to get changed/new users since the last cycle.
        // A null delta link triggers a full enumeration on first run.
        var (users, _) = await _graphService
            .GetAllUsersDeltaAsync(deltaLink: null, ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "SyncAllUsersActivity: Retrieved {UserCount} users from Graph for notification {NotificationId}.",
            users.Count, notificationId);

        // Upsert users in the database.
        await UpsertUsersAsync(users, ct).ConfigureAwait(false);

        // Create SentNotification records for all users with AAD IDs.
        var aadIds = users
            .Where(u => !string.IsNullOrWhiteSpace(u.AadId))
            .Select(u => u.AadId)
            .Distinct()
            .ToList();

        var count = await _recipientService
            .BatchCreateSentNotificationsAsync(notificationId, aadIds, ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "SyncAllUsersActivity: Created {Count} SentNotification records for notification {NotificationId}.",
            count, notificationId);

        return count;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private async Task UpsertUsersAsync(
        IReadOnlyList<Core.Data.Entities.User> users,
        CancellationToken ct)
    {
        const int batchSize = 500;

        for (int i = 0; i < users.Count; i += batchSize)
        {
            var batch = users.Skip(i).Take(batchSize).ToList();
            var aadIds = batch.Select(u => u.AadId).ToList();

            // Load existing users from DB for this batch.
            var existing = await _db.Users
                .Where(u => aadIds.Contains(u.AadId))
                .ToDictionaryAsync(u => u.AadId, ct)
                .ConfigureAwait(false);

            foreach (var graphUser in batch)
            {
                if (string.IsNullOrWhiteSpace(graphUser.AadId))
                {
                    continue;
                }

                if (existing.TryGetValue(graphUser.AadId, out var dbUser))
                {
                    // Update existing record.
                    dbUser.Name = graphUser.Name;
                    dbUser.Email = graphUser.Email;
                    dbUser.Upn = graphUser.Upn;
                    dbUser.UserType = graphUser.UserType;
                    dbUser.TenantId = graphUser.TenantId;
                    dbUser.LastSyncedDate = DateTime.UtcNow;
                }
                else
                {
                    // Insert new record.
                    graphUser.LastSyncedDate = DateTime.UtcNow;
                    await _db.Users.AddAsync(graphUser, ct).ConfigureAwait(false);
                }
            }

            await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        }
    }
}
