using System.ComponentModel.DataAnnotations;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Represents the delivery record for a single recipient of a notification.
/// </summary>
public sealed class SentNotification
{
    /// <summary>Gets or sets the surrogate primary key.</summary>
    [Key]
    public long Id { get; set; }

    /// <summary>Gets or sets the foreign key to the parent notification.</summary>
    public Guid NotificationId { get; set; }

    /// <summary>Gets or sets the AAD Object ID or Teams user ID of the recipient.</summary>
    [Required]
    [MaxLength(200)]
    public string RecipientId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the recipient type.
    /// Valid values: User, Team.
    /// </summary>
    [Required]
    [MaxLength(10)]
    public string RecipientType { get; set; } = string.Empty;

    /// <summary>Gets or sets the Teams conversation ID used for proactive messaging.</summary>
    [MaxLength(500)]
    public string? ConversationId { get; set; }

    /// <summary>Gets or sets the Bot Framework service URL for the recipient's tenant.</summary>
    [MaxLength(500)]
    public string? ServiceUrl { get; set; }

    /// <summary>
    /// Gets or sets the delivery status.
    /// Valid values: Queued, Succeeded, Failed, RecipientNotFound, Retrying.
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string DeliveryStatus { get; set; } = "Queued";

    /// <summary>Gets or sets the HTTP status code returned by the Bot Framework or Teams API.</summary>
    public int? StatusCode { get; set; }

    /// <summary>Gets or sets the UTC date and time when the message was sent.</summary>
    public DateTime? SentDate { get; set; }

    /// <summary>Gets or sets the number of delivery retry attempts.</summary>
    public int RetryCount { get; set; }

    /// <summary>Gets or sets the error message if delivery failed.</summary>
    [MaxLength(1000)]
    public string? ErrorMessage { get; set; }

    /// <summary>Gets or sets the parent notification navigation property.</summary>
    public Notification? Notification { get; set; }
}

/// <summary>
/// Well-known delivery status values.
/// </summary>
public static class DeliveryStatus
{
    public const string Queued = "Queued";
    public const string Succeeded = "Succeeded";
    public const string Failed = "Failed";
    public const string RecipientNotFound = "RecipientNotFound";
    public const string Retrying = "Retrying";
}
