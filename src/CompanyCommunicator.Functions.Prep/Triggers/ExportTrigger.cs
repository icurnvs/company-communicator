using System.Globalization;
using System.Text;
using System.Text.Json;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;
using CompanyCommunicator.Core.Services.Blob;
using CompanyCommunicator.Core.Services.Queue;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Triggers;

/// <summary>
/// Service Bus trigger: listens on the <c>cc-export</c> queue and runs a
/// delivery report export inline (no Durable orchestration needed for exports).
/// Writes a CSV to blob storage and updates the <see cref="ExportJob"/> record.
/// </summary>
public sealed class ExportTrigger
{
    private readonly AppDbContext _db;
    private readonly IBlobStorageService _blobService;
    private readonly ILogger<ExportTrigger> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="ExportTrigger"/>.
    /// </summary>
    public ExportTrigger(
        AppDbContext db,
        IBlobStorageService blobService,
        ILogger<ExportTrigger> logger)
    {
        _db = db;
        _blobService = blobService;
        _logger = logger;
    }

    /// <summary>
    /// Function entry point. Runs the export and updates the job status.
    /// </summary>
    /// <param name="messageBody">JSON-serialized <see cref="ExportQueueMessage"/>.</param>
    /// <param name="ctx">Function execution context.</param>
    [Function(nameof(ExportTrigger))]
    public async Task Run(
        [ServiceBusTrigger(
            QueueNames.Export,
            Connection = "ServiceBus")]
        string messageBody,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        ExportQueueMessage? message;
        try
        {
            message = JsonSerializer.Deserialize<ExportQueueMessage>(messageBody);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex,
                "ExportTrigger: Failed to deserialize ExportQueueMessage. " +
                "Message will be dead-lettered.");
            return;
        }

        if (message is null)
        {
            _logger.LogError(
                "ExportTrigger: Deserialized ExportQueueMessage is null. " +
                "Message will be dead-lettered.");
            return;
        }

        _logger.LogInformation(
            "ExportTrigger: Processing export job {ExportJobId} for notification {NotificationId}.",
            message.ExportJobId, message.NotificationId);

        // Load the export job.
        var job = await _db.ExportJobs
            .FirstOrDefaultAsync(j => j.Id == message.ExportJobId, ct)
            .ConfigureAwait(false);

        if (job is null)
        {
            _logger.LogError(
                "ExportTrigger: ExportJob {ExportJobId} not found.", message.ExportJobId);
            return;
        }

        job.Status = ExportJobStatus.InProgress;
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        try
        {
            // Query all SentNotification records for this notification.
            var records = await _db.SentNotifications
                .Where(s => s.NotificationId == message.NotificationId)
                .AsNoTracking()
                .ToListAsync(ct)
                .ConfigureAwait(false);

            _logger.LogInformation(
                "ExportTrigger: Exporting {Count} records for notification {NotificationId}.",
                records.Count, message.NotificationId);

            // Build CSV content.
            var csvContent = BuildCsv(records);
            var csvBytes = Encoding.UTF8.GetBytes(csvContent);

            using var stream = new MemoryStream(csvBytes);

            // Blob name: exports/{notificationId}/{exportJobId}.csv
            var blobName = $"{message.NotificationId}/{message.ExportJobId}.csv";

            await _blobService
                .UploadExportAsync(blobName, stream, ct)
                .ConfigureAwait(false);

            // Update job to Completed.
            job.Status = ExportJobStatus.Completed;
            job.FileName = blobName;

            _logger.LogInformation(
                "ExportTrigger: Export job {ExportJobId} completed. Blob: '{BlobName}'.",
                message.ExportJobId, blobName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "ExportTrigger: Export job {ExportJobId} failed.", message.ExportJobId);

            job.Status = ExportJobStatus.Failed;
            job.ErrorMessage = ex.Message.Length <= 1000
                ? ex.Message
                : ex.Message[..997] + "...";
        }
        finally
        {
            await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private static string BuildCsv(IReadOnlyList<SentNotification> records)
    {
        var sb = new StringBuilder();

        // Header row.
        sb.AppendLine(
            "RecipientId,RecipientType,DeliveryStatus,StatusCode," +
            "SentDate,RetryCount,ErrorMessage,ConversationId");

        foreach (var r in records)
        {
            sb.Append(EscapeCsvField(r.RecipientId)).Append(',');
            sb.Append(EscapeCsvField(r.RecipientType)).Append(',');
            sb.Append(EscapeCsvField(r.DeliveryStatus)).Append(',');
            sb.Append(r.StatusCode?.ToString(CultureInfo.InvariantCulture) ?? string.Empty).Append(',');
            sb.Append(r.SentDate?.ToString("O", CultureInfo.InvariantCulture) ?? string.Empty).Append(',');
            sb.Append(r.RetryCount.ToString(CultureInfo.InvariantCulture)).Append(',');
            sb.Append(EscapeCsvField(r.ErrorMessage)).Append(',');
            sb.AppendLine(EscapeCsvField(r.ConversationId));
        }

        return sb.ToString();
    }

    private static string EscapeCsvField(string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return string.Empty;
        }

        // Wrap in quotes if the value contains a comma, newline, or quote.
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
        {
            return $"\"{value.Replace("\"", "\"\"")}\"";
        }

        return value;
    }
}
