namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Data transfer object representing a single audience target for a notification.
/// </summary>
/// <param name="AudienceType">The audience type (Team, Roster, or Group).</param>
/// <param name="AudienceId">The Teams or AAD object ID identifying the audience.</param>
public sealed record AudienceDto(string AudienceType, string AudienceId);
