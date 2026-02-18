using System.ComponentModel.DataAnnotations;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Tracks throttling state for the message send pipeline.
/// Uses optimistic concurrency via a SQL Server rowversion token.
/// Typically contains a single row with Id = "global".
/// </summary>
public sealed class ThrottleState
{
    /// <summary>Gets or sets the logical key for the throttle partition (e.g., "global").</summary>
    [Key]
    [MaxLength(100)]
    public string Id { get; set; } = string.Empty;

    /// <summary>Gets or sets the UTC time after which the bot is allowed to retry throttled requests.</summary>
    public DateTime? RetryAfterUtc { get; set; }

    /// <summary>Gets or sets the current number of in-flight concurrent send operations.</summary>
    public int ConcurrentSends { get; set; }

    /// <summary>
    /// Gets or sets the SQL Server rowversion concurrency token.
    /// EF Core uses this for optimistic concurrency conflict detection.
    /// </summary>
    public byte[]? RowVersion { get; set; }
}
