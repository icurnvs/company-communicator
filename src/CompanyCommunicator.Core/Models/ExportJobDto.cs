namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Data transfer object representing an export job and its current state.
/// </summary>
public sealed record ExportJobDto(
    Guid Id,
    Guid NotificationId,
    string? RequestedBy,
    DateTime RequestedDate,
    string Status,
    string? FileName,
    string? ErrorMessage);
