namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Request body for updating an existing draft notification.
/// </summary>
public sealed record UpdateNotificationRequest(
    string Title,
    string? Summary,
    string? ImageLink,
    string? ButtonTitle,
    string? ButtonLink,
    bool AllUsers,
    IReadOnlyList<AudienceDto>? Audiences);
