namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Lightweight notification summary DTO used for list views (Draft, Sent, Scheduled tabs).
/// </summary>
public sealed record NotificationSummaryDto(
    Guid Id,
    string Title,
    string? Author,
    DateTime CreatedDate,
    DateTime? ScheduledDate,
    DateTime? SentDate,
    string Status,
    int TotalRecipientCount,
    int SucceededCount,
    int FailedCount);
