namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Request body for creating a new draft notification.
/// </summary>
public sealed record CreateNotificationRequest(
    string Title,
    string? Summary,
    string? ImageLink,
    string? ButtonTitle,
    string? ButtonLink,
    bool AllUsers,
    IReadOnlyList<AudienceDto>? Audiences);
