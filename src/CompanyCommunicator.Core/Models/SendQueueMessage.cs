namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Message payload enqueued to the cc-send queue for a single recipient delivery.
/// </summary>
public sealed record SendQueueMessage(
    Guid NotificationId,
    long SentNotificationId,
    string RecipientId,
    string? ConversationId,
    string? ServiceUrl,
    string? CardBlobName);
