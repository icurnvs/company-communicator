using System.ComponentModel.DataAnnotations;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Represents a Teams user whose installation and conversation state is tracked.
/// The primary key is the Azure Active Directory Object ID.
/// </summary>
public sealed class User
{
    /// <summary>Gets or sets the AAD Object ID, used as the primary key.</summary>
    [Key]
    [MaxLength(100)]
    public string AadId { get; set; } = string.Empty;

    /// <summary>Gets or sets the display name of the user.</summary>
    [MaxLength(200)]
    public string? Name { get; set; }

    /// <summary>Gets or sets the email address of the user.</summary>
    [MaxLength(200)]
    public string? Email { get; set; }

    /// <summary>Gets or sets the User Principal Name (UPN) of the user.</summary>
    [MaxLength(200)]
    public string? Upn { get; set; }

    /// <summary>Gets or sets the Teams-specific user ID.</summary>
    [MaxLength(200)]
    public string? UserId { get; set; }

    /// <summary>Gets or sets the Teams personal chat conversation ID used for proactive messaging.</summary>
    [MaxLength(500)]
    public string? ConversationId { get; set; }

    /// <summary>Gets or sets the Bot Framework service URL for the user's tenant.</summary>
    [MaxLength(500)]
    public string? ServiceUrl { get; set; }

    /// <summary>Gets or sets the AAD tenant ID the user belongs to.</summary>
    [MaxLength(100)]
    public string? TenantId { get; set; }

    /// <summary>Gets or sets the user type (e.g., Member, Guest).</summary>
    [MaxLength(20)]
    public string? UserType { get; set; }

    /// <summary>Gets or sets a value indicating whether the user has a Teams license.</summary>
    public bool? HasTeamsLicense { get; set; }

    /// <summary>Gets or sets the UTC date and time when the Teams license was last checked.</summary>
    public DateTime? LicenseCheckedDate { get; set; }

    /// <summary>Gets or sets the UTC date and time when the user record was last synced from Graph.</summary>
    public DateTime? LastSyncedDate { get; set; }
}
