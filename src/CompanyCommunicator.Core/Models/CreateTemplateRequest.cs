namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Request body for creating a new template.
/// </summary>
public sealed record CreateTemplateRequest(
    string Name,
    string? Description,
    string CardSchema);
