namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Request body for creating a new export job for a sent notification.
/// </summary>
public sealed record CreateExportRequest(Guid NotificationId);
