using CompanyCommunicator.Core.Models;

namespace CompanyCommunicator.Core.Services.Queue;

/// <summary>
/// Abstraction for enqueuing messages onto Azure Service Bus queues.
/// </summary>
public interface IServiceBusService
{
    /// <summary>
    /// Enqueues a message on the cc-prepare queue to begin notification preparation.
    /// </summary>
    /// <param name="notificationId">The notification to prepare.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendPrepareMessageAsync(Guid notificationId, CancellationToken ct);

    /// <summary>
    /// Enqueues a batch of per-recipient send messages on the cc-send queue.
    /// Messages are sent in batches of up to 100 to respect Service Bus limits.
    /// </summary>
    /// <param name="messages">The send messages to enqueue.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendBatchSendMessagesAsync(IReadOnlyList<SendQueueMessage> messages, CancellationToken ct);

    /// <summary>
    /// Enqueues a message on the cc-export queue to trigger a delivery report export.
    /// </summary>
    /// <param name="exportJobId">The export job identifier.</param>
    /// <param name="notificationId">The notification being exported.</param>
    /// <param name="requestedBy">AAD Object ID of the requesting user.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendExportMessageAsync(Guid exportJobId, Guid notificationId, string requestedBy, CancellationToken ct);
}
