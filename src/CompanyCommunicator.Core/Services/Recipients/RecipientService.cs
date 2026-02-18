using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Core.Services.Recipients;

/// <summary>
/// EF Core implementation of <see cref="IRecipientService"/>.
/// Batch-inserts <see cref="SentNotification"/> records in groups of 500
/// to avoid SQL Server parameter limit issues.
/// </summary>
internal sealed class RecipientService : IRecipientService
{
    private const int DbBatchSize = 500;

    private readonly AppDbContext _db;
    private readonly ILogger<RecipientService> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="RecipientService"/>.
    /// </summary>
    /// <param name="db">The EF Core database context.</param>
    /// <param name="logger">Logger.</param>
    public RecipientService(AppDbContext db, ILogger<RecipientService> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<int> BatchCreateSentNotificationsAsync(
        Guid notificationId,
        IReadOnlyList<string> recipientAadIds,
        CancellationToken ct)
    {
        int totalInserted = 0;

        for (int i = 0; i < recipientAadIds.Count; i += DbBatchSize)
        {
            var batchIds = recipientAadIds.Skip(i).Take(DbBatchSize).ToList();

            // Look up existing Users to copy ConversationId and ServiceUrl
            // into SentNotification records for users who already have the bot installed.
            var userLookup = await _db.Users
                .AsNoTracking()
                .Where(u => batchIds.Contains(u.AadId))
                .Select(u => new { u.AadId, u.ConversationId, u.ServiceUrl })
                .ToDictionaryAsync(u => u.AadId, ct)
                .ConfigureAwait(false);

            var records = batchIds.Select(aadId =>
            {
                userLookup.TryGetValue(aadId, out var user);
                return new SentNotification
                {
                    NotificationId = notificationId,
                    RecipientId = aadId,
                    RecipientType = "User",
                    ConversationId = user?.ConversationId,
                    ServiceUrl = user?.ServiceUrl,
                    DeliveryStatus = DeliveryStatus.Queued,
                    RetryCount = 0,
                };
            });

            await _db.SentNotifications.AddRangeAsync(records, ct).ConfigureAwait(false);
            await _db.SaveChangesAsync(ct).ConfigureAwait(false);
            _db.ChangeTracker.Clear(); // Prevent 50k tracked entities accumulating

            totalInserted += batchIds.Count;
        }

        _logger.LogInformation(
            "Inserted {Count} SentNotification records for notification {NotificationId}.",
            totalInserted, notificationId);

        return totalInserted;
    }
}
