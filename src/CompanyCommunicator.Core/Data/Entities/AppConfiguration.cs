using System.ComponentModel.DataAnnotations;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Stores application-level configuration key-value pairs that can be updated at runtime
/// without redeploying the application (e.g., throttle limits, feature flags).
/// </summary>
public sealed class AppConfiguration
{
    /// <summary>Gets or sets the configuration key.</summary>
    [Key]
    [MaxLength(200)]
    public string Key { get; set; } = string.Empty;

    /// <summary>Gets or sets the configuration value.</summary>
    public string? Value { get; set; }

    /// <summary>Gets or sets the UTC date and time when this entry was last updated.</summary>
    public DateTime LastUpdated { get; set; }
}
