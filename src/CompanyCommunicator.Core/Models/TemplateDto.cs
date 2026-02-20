namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Full template detail DTO returned by the API for create, update, and get operations.
/// </summary>
public sealed record TemplateDto(
    Guid Id,
    string Name,
    string? Description,
    string CardSchema,
    string CreatedBy,
    DateTime CreatedDate);
