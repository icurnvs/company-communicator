namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Data transfer object representing a Teams team where the bot is installed.
/// </summary>
public sealed record TeamDto(string TeamId, string? Name);
