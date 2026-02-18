using System.Globalization;
using System.Text;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Services.Blob;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Triggers;

/// <summary>
/// Timer trigger: runs daily at 2 AM UTC to archive and delete
/// <see cref="SentNotification"/> records older than 90 days.
/// Archived data is written as a CSV to blob storage before deletion.
/// </summary>
public sealed class CleanupTrigger
{
    private const int RetentionDays = 90;
    private const int PageSize = 1000;

    private readonly AppDbContext _db;
    private readonly IBlobStorageService _blobService;
    private readonly ILogger<CleanupTrigger> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="CleanupTrigger"/>.
    /// </summary>
    public CleanupTrigger(
        AppDbContext db,
        IBlobStorageService blobService,
        ILogger<CleanupTrigger> logger)
    {
        _db = db;
        _blobService = blobService;
        _logger = logger;
    }

    /// <summary>
    /// Function entry point. Archives old SentNotification records to blob, then deletes them.
    /// </summary>
    /// <param name="timer">Timer information (not used beyond triggering).</param>
    /// <param name="ctx">Function execution context.</param>
    [Function(nameof(CleanupTrigger))]
    public async Task Run(
        [TimerTrigger("0 0 2 * * *")] TimerInfo timer,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        var cutoffDate = DateTime.UtcNow.AddDays(-RetentionDays);

        _logger.LogInformation(
            "CleanupTrigger: Starting cleanup. Archiving records older than {CutoffDate:O}.",
            cutoffDate);

        // Find all notifications that have sent records older than the cutoff.
        // We archive and delete per notification to keep blob files manageable.
        var notificationIds = await _db.SentNotifications
            .Where(s => s.SentDate.HasValue && s.SentDate.Value < cutoffDate)
            .Select(s => s.NotificationId)
            .Distinct()
            .ToListAsync(ct)
            .ConfigureAwait(false);

        int totalArchived = 0;
        int totalDeleted = 0;

        foreach (var notificationId in notificationIds)
        {
            try
            {
                var (archived, deleted) = await ArchiveAndDeleteNotificationAsync(
                    notificationId, cutoffDate, ct).ConfigureAwait(false);

                totalArchived += archived;
                totalDeleted += deleted;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "CleanupTrigger: Failed to archive/delete records for notification {NotificationId}.",
                    notificationId);
            }
        }

        _logger.LogInformation(
            "CleanupTrigger: Cleanup complete. Archived {Archived} records, deleted {Deleted} records.",
            totalArchived, totalDeleted);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private async Task<(int Archived, int Deleted)> ArchiveAndDeleteNotificationAsync(
        Guid notificationId,
        DateTime cutoffDate,
        CancellationToken ct)
    {
        // Load expired records for this notification (paged to avoid memory pressure).
        var records = await _db.SentNotifications
            .Where(s => s.NotificationId == notificationId
                        && s.SentDate.HasValue
                        && s.SentDate.Value < cutoffDate)
            .AsNoTracking()
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (records.Count == 0)
        {
            return (0, 0);
        }

        // Build CSV archive.
        var csv = BuildArchiveCsv(records);
        var csvBytes = Encoding.UTF8.GetBytes(csv);

        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
        var blobName = $"archive/{notificationId}/{timestamp}.csv";

        using var stream = new MemoryStream(csvBytes);
        await _blobService
            .UploadExportAsync(blobName, stream, ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "CleanupTrigger: Archived {Count} records for notification {NotificationId} to '{BlobName}'.",
            records.Count, notificationId, blobName);

        // Delete the archived records from SQL.
        var idsToDelete = records.Select(r => r.Id).ToList();

        var deleted = await _db.SentNotifications
            .Where(s => idsToDelete.Contains(s.Id))
            .ExecuteDeleteAsync(ct)
            .ConfigureAwait(false);

        return (records.Count, deleted);
    }

    private static string BuildArchiveCsv(IReadOnlyList<SentNotification> records)
    {
        var sb = new StringBuilder();

        sb.AppendLine(
            "Id,NotificationId,RecipientId,RecipientType,DeliveryStatus," +
            "StatusCode,SentDate,RetryCount,ErrorMessage");

        foreach (var r in records)
        {
            sb.Append(r.Id.ToString(CultureInfo.InvariantCulture)).Append(',');
            sb.Append(r.NotificationId).Append(',');
            sb.Append(EscapeCsvField(r.RecipientId)).Append(',');
            sb.Append(EscapeCsvField(r.RecipientType)).Append(',');
            sb.Append(EscapeCsvField(r.DeliveryStatus)).Append(',');
            sb.Append(r.StatusCode?.ToString(CultureInfo.InvariantCulture) ?? string.Empty).Append(',');
            sb.Append(r.SentDate?.ToString("O", CultureInfo.InvariantCulture) ?? string.Empty).Append(',');
            sb.Append(r.RetryCount.ToString(CultureInfo.InvariantCulture)).Append(',');
            sb.AppendLine(EscapeCsvField(r.ErrorMessage));
        }

        return sb.ToString();
    }

    private static string EscapeCsvField(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }
}
