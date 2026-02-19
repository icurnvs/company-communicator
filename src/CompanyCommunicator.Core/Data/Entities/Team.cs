using System.ComponentModel.DataAnnotations;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Represents a Teams team in which the Company Communicator app is installed.
/// </summary>
public sealed class Team
{
    /// <summary>Gets or sets the Teams team ID, used as the primary key.</summary>
    [Key]
    [MaxLength(200)]
    public string TeamId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the AAD group ID (GUID) backing this team.
    /// Used to map from NotificationAudience.AudienceId to this Team record.
    /// Populated by OnTeamsMembersAddedAsync from teamInfo.AadGroupId.
    /// </summary>
    [MaxLength(100)]
    public string? AadGroupId { get; set; }

    /// <summary>Gets or sets the display name of the team.</summary>
    [MaxLength(200)]
    public string? Name { get; set; }

    /// <summary>Gets or sets the Bot Framework service URL for the team's tenant.</summary>
    [MaxLength(500)]
    public string? ServiceUrl { get; set; }

    /// <summary>Gets or sets the AAD tenant ID the team belongs to.</summary>
    [MaxLength(100)]
    public string? TenantId { get; set; }

    /// <summary>Gets or sets the UTC date and time when the app was installed in this team.</summary>
    public DateTime? InstalledDate { get; set; }
}
