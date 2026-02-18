namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Message payload enqueued to the cc-export queue to trigger a data export job.
/// </summary>
public sealed record ExportQueueMessage(Guid ExportJobId, Guid NotificationId, string RequestedBy);
