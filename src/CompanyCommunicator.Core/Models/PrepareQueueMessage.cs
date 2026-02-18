namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Message payload enqueued to the cc-prepare queue to trigger notification preparation.
/// </summary>
public sealed record PrepareQueueMessage(Guid NotificationId);
