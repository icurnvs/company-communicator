namespace CompanyCommunicator.Core.Services.Recipients;

/// <summary>
/// Abstraction for managing per-recipient send records in the database.
/// </summary>
public interface IRecipientService
{
    /// <summary>
    /// Batch-inserts <see cref="CompanyCommunicator.Core.Data.Entities.SentNotification"/> records
    /// for the given recipient AAD IDs with an initial status of Queued.
    /// Inserts are performed in groups of 500 to avoid SQL parameter limits.
    /// </summary>
    /// <param name="notificationId">The parent notification identifier.</param>
    /// <param name="recipientAadIds">The list of recipient AAD Object IDs.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The total number of records inserted.</returns>
    Task<int> BatchCreateSentNotificationsAsync(
        Guid notificationId,
        IReadOnlyList<string> recipientAadIds,
        CancellationToken ct);
}
