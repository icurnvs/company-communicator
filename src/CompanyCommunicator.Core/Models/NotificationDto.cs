namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Full notification detail DTO returned by the API for create, update, and get operations.
/// </summary>
public sealed record NotificationDto(
    Guid Id,
    string Title,
    string? Summary,
    string? ImageLink,
    string? ImageBlobName,
    string? ButtonTitle,
    string? ButtonLink,
    string? Author,
    string? CreatedBy,
    DateTime CreatedDate,
    DateTime? ScheduledDate,
    DateTime? SentDate,
    string Status,
    bool AllUsers,
    int TotalRecipientCount,
    int SucceededCount,
    int FailedCount,
    int RecipientNotFoundCount,
    int CanceledCount,
    int UnknownCount,
    string? ErrorMessage,
    IReadOnlyList<AudienceDto> Audiences);
