using System.ComponentModel.DataAnnotations;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Represents an audience target for a notification (a Team, Roster, or Group).
/// </summary>
public sealed class NotificationAudience
{
    /// <summary>Gets or sets the surrogate primary key.</summary>
    [Key]
    public int Id { get; set; }

    /// <summary>Gets or sets the foreign key to the parent notification.</summary>
    public Guid NotificationId { get; set; }

    /// <summary>
    /// Gets or sets the audience type.
    /// Valid values: Team, Roster, Group.
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string AudienceType { get; set; } = string.Empty;

    /// <summary>Gets or sets the Teams/AAD identifier for the audience entity.</summary>
    [Required]
    [MaxLength(200)]
    public string AudienceId { get; set; } = string.Empty;

    /// <summary>Gets or sets the parent notification navigation property.</summary>
    public Notification? Notification { get; set; }
}

/// <summary>
/// Well-known audience type values.
/// </summary>
public static class AudienceType
{
    public const string Team = "Team";
    public const string Roster = "Roster";
    public const string Group = "Group";
}
