using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CompanyCommunicator.Core.Data.Entities;

/// <summary>
/// Represents a data export job for a sent notification's delivery report.
/// </summary>
public sealed class ExportJob
{
    /// <summary>Gets or sets the unique identifier for the export job.</summary>
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; }

    /// <summary>Gets or sets the foreign key of the notification being exported.</summary>
    public Guid NotificationId { get; set; }

    /// <summary>Gets or sets the AAD Object ID of the user who requested the export.</summary>
    [MaxLength(200)]
    public string? RequestedBy { get; set; }

    /// <summary>Gets or sets the UTC date and time when the export was requested.</summary>
    public DateTime RequestedDate { get; set; }

    /// <summary>
    /// Gets or sets the current status of the export job.
    /// Valid values: Queued, InProgress, Completed, Failed.
    /// </summary>
    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = ExportJobStatus.Queued;

    /// <summary>Gets or sets the blob file name of the completed export in Azure Blob Storage.</summary>
    [MaxLength(500)]
    public string? FileName { get; set; }

    /// <summary>Gets or sets an error message if the export failed.</summary>
    public string? ErrorMessage { get; set; }

    /// <summary>Gets or sets the parent notification navigation property.</summary>
    public Notification? Notification { get; set; }
}

/// <summary>
/// Well-known export job status values.
/// </summary>
public static class ExportJobStatus
{
    public const string Queued = "Queued";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Failed = "Failed";
}
