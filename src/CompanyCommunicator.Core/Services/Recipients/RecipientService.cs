using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
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
            var batch = recipientAadIds.Skip(i).Take(DbBatchSize);

            var records = batch.Select(aadId => new SentNotification
            {
                NotificationId = notificationId,
                RecipientId = aadId,
                RecipientType = "User",
                DeliveryStatus = DeliveryStatus.Queued,
                RetryCount = 0,
            });

            await _db.SentNotifications.AddRangeAsync(records, ct).ConfigureAwait(false);
            await _db.SaveChangesAsync(ct).ConfigureAwait(false);

            totalInserted += batch.Count();
        }

        _logger.LogInformation(
            "Inserted {Count} SentNotification records for notification {NotificationId}.",
            totalInserted, notificationId);

        return totalInserted;
    }
}
