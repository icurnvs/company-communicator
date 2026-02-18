namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Data transfer object representing an Entra ID (AAD) group search result.
/// </summary>
public sealed record GroupDto(string GroupId, string? DisplayName);
