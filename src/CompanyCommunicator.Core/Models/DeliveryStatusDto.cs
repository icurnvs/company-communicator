namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Aggregated delivery status DTO for a notification.
/// </summary>
public sealed record DeliveryStatusDto(
    Guid NotificationId,
    string Status,
    int TotalRecipientCount,
    int SucceededCount,
    int FailedCount,
    int RecipientNotFoundCount,
    int CanceledCount,
    int UnknownCount);
