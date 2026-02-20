namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Request body for updating an existing template.
/// </summary>
public sealed record UpdateTemplateRequest(
    string Name,
    string? Description,
    string CardSchema);
