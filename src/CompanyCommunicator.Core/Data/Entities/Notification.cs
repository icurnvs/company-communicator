using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Represents a notification message that can be sent to Teams users or channels.
/// </summary>
public sealed class Notification
{
    /// <summary>Gets or sets the unique identifier for the notification.</summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; }

    /// <summary>Gets or sets the notification title.</summary>
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    /// <summary>Gets or sets the notification summary body text.</summary>
    [MaxLength(4000)]
    public string? Summary { get; set; }

    /// <summary>Gets or sets the URL for the header image.</summary>
    [MaxLength(1000)]
    public string? ImageLink { get; set; }

    /// <summary>Gets or sets the Azure Blob Storage blob name for the header image.</summary>
    [MaxLength(200)]
    public string? ImageBlobName { get; set; }

    /// <summary>Gets or sets the label text for the action button.</summary>
    [MaxLength(200)]
    public string? ButtonTitle { get; set; }

    /// <summary>Gets or sets the URL for the action button.</summary>
    [MaxLength(1000)]
    public string? ButtonLink { get; set; }

    /// <summary>Gets or sets the display name of the notification author.</summary>
    [MaxLength(200)]
    public string? Author { get; set; }

    /// <summary>Gets or sets the identity of the user who created this notification.</summary>
    [MaxLength(200)]
    public string? CreatedBy { get; set; }

    /// <summary>Gets or sets the UTC date and time when the notification was created.</summary>
    public DateTime CreatedDate { get; set; }

    /// <summary>Gets or sets the UTC date and time when the notification is scheduled to be sent.</summary>
    public DateTime? ScheduledDate { get; set; }

    /// <summary>Gets or sets the UTC date and time when the notification was actually sent.</summary>
    public DateTime? SentDate { get; set; }

    /// <summary>
    /// Gets or sets the current status of the notification.
    /// Valid values: Draft, Scheduled, Queued, SyncingRecipients, InstallingApp, Sending, Sent, Canceled, Failed.
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = NotificationStatus.Draft;

    /// <summary>Gets or sets a value indicating whether this notification targets all users.</summary>
    public bool AllUsers { get; set; }

    /// <summary>Gets or sets the total number of recipients.</summary>
    public int TotalRecipientCount { get; set; }

    /// <summary>Gets or sets the number of successfully delivered messages.</summary>
    public int SucceededCount { get; set; }

    /// <summary>Gets or sets the number of failed deliveries.</summary>
    public int FailedCount { get; set; }

    /// <summary>Gets or sets the number of recipients who could not be found.</summary>
    public int RecipientNotFoundCount { get; set; }

    /// <summary>Gets or sets the number of canceled deliveries.</summary>
    public int CanceledCount { get; set; }

    /// <summary>Gets or sets the number of deliveries with unknown status.</summary>
    public int UnknownCount { get; set; }

    /// <summary>Gets or sets an error message if the notification failed to send.</summary>
    public string? ErrorMessage { get; set; }

    /// <summary>Gets or sets the URL for tracking delivery status.</summary>
    [MaxLength(1000)]
    public string? TrackingUrl { get; set; }

    /// <summary>Gets the audience definitions for this notification.</summary>
    public ICollection<NotificationAudience> Audiences { get; init; } = new List<NotificationAudience>();

    /// <summary>Gets the individual send records for this notification.</summary>
    public ICollection<SentNotification> SentNotifications { get; init; } = new List<SentNotification>();

    /// <summary>Gets the export jobs associated with this notification.</summary>
    public ICollection<ExportJob> ExportJobs { get; init; } = new List<ExportJob>();
}

/// <summary>
/// Well-known notification status values.
/// </summary>
public static class NotificationStatus
{
    public const string Draft = "Draft";
    public const string Scheduled = "Scheduled";
    public const string Queued = "Queued";
    public const string SyncingRecipients = "SyncingRecipients";
    public const string InstallingApp = "InstallingApp";
    public const string Sending = "Sending";
    public const string Sent = "Sent";
    public const string Canceled = "Canceled";
    public const string Failed = "Failed";
}
