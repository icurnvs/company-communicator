using CompanyCommunicator.Api.Authorization;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;
using CompanyCommunicator.Core.Services.Blob;
using CompanyCommunicator.Core.Services.Queue;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CompanyCommunicator.Api.Controllers;

/// <summary>
/// REST API endpoints for managing notification delivery report export jobs.
/// Restricted to administrators only.
/// </summary>
[ApiController]
[Route("api/exports")]
[Authorize(Policy = PolicyNames.Admin)]
[Produces("application/json")]
public sealed class ExportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IServiceBusService _serviceBus;
    private readonly IBlobStorageService _blobStorage;

    /// <summary>
    /// Initializes a new instance of <see cref="ExportsController"/>.
    /// </summary>
    public ExportsController(
        AppDbContext db,
        IServiceBusService serviceBus,
        IBlobStorageService blobStorage)
    {
        _db = db;
        _serviceBus = serviceBus;
        _blobStorage = blobStorage;
    }

    // -------------------------------------------------------------------------
    // POST /api/exports
    // -------------------------------------------------------------------------

    /// <summary>
    /// Creates a new export job for a sent or failed notification's delivery report.
    /// </summary>
    /// <param name="request">The export request containing the notification ID to export.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>202 Accepted with <see cref="ExportJobDto"/>; 400/404 on validation failure.</returns>
    [HttpPost]
    [EnableRateLimiting("write")]
    [ProducesResponseType(typeof(ExportJobDto), StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ExportJobDto>> CreateExport(
        [FromBody] CreateExportRequest request,
        CancellationToken ct)
    {
        var notification = await _db.Notifications
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == request.NotificationId, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            return NotFound();
        }

        var exportableStatuses = new[] { NotificationStatus.Sent, NotificationStatus.Failed };
        if (!exportableStatuses.Contains(notification.Status))
        {
            return BadRequest(new ProblemDetails
            {
                Title = "Validation failed",
                Detail = $"Only Sent or Failed notifications can be exported. Current status: {notification.Status}.",
                Status = StatusCodes.Status400BadRequest,
            });
        }

        var requestedBy = User.FindFirst("oid")?.Value
            ?? User.FindFirst("http://schemas.microsoft.com/identity/claims/objectidentifier")?.Value
            ?? User.Identity?.Name;

        var exportJob = new ExportJob
        {
            Id = Guid.NewGuid(),
            NotificationId = request.NotificationId,
            RequestedBy = requestedBy,
            RequestedDate = DateTime.UtcNow,
            Status = ExportJobStatus.Queued,
        };

        _db.ExportJobs.Add(exportJob);
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        await _serviceBus.SendExportMessageAsync(
            exportJob.Id,
            exportJob.NotificationId,
            requestedBy ?? string.Empty,
            ct).ConfigureAwait(false);

        var dto = MapToDto(exportJob);
        return AcceptedAtAction(nameof(GetExport), new { id = exportJob.Id }, dto);
    }

    // -------------------------------------------------------------------------
    // GET /api/exports/{id}
    // -------------------------------------------------------------------------

    /// <summary>
    /// Gets the current status of an export job.
    /// </summary>
    /// <param name="id">The export job GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns><see cref="ExportJobDto"/>; 404 if not found.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ExportJobDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ExportJobDto>> GetExport(
        Guid id,
        CancellationToken ct)
    {
        var exportJob = await _db.ExportJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == id, ct)
            .ConfigureAwait(false);

        if (exportJob is null)
        {
            return NotFound();
        }

        return Ok(MapToDto(exportJob));
    }

    // -------------------------------------------------------------------------
    // GET /api/exports/{id}/download
    // -------------------------------------------------------------------------

    /// <summary>
    /// Generates a time-limited SAS download URI for a completed export job.
    /// </summary>
    /// <param name="id">The export job GUID.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns><see cref="ExportDownloadDto"/>; 404 if not found; 409 if not completed.</returns>
    [HttpGet("{id:guid}/download")]
    [ProducesResponseType(typeof(ExportDownloadDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ExportDownloadDto>> GetExportDownload(
        Guid id,
        CancellationToken ct)
    {
        var exportJob = await _db.ExportJobs
            .AsNoTracking()
            .FirstOrDefaultAsync(j => j.Id == id, ct)
            .ConfigureAwait(false);

        if (exportJob is null)
        {
            return NotFound();
        }

        if (exportJob.Status != ExportJobStatus.Completed || string.IsNullOrEmpty(exportJob.FileName))
        {
            return Conflict(new ProblemDetails
            {
                Title = "Conflict",
                Detail = $"Export job is not completed. Current status: {exportJob.Status}.",
                Status = StatusCodes.Status409Conflict,
            });
        }

        var downloadUri = await _blobStorage
            .GetExportDownloadUriAsync(exportJob.FileName, ct)
            .ConfigureAwait(false);

        return Ok(new ExportDownloadDto(exportJob.Id, downloadUri));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private static ExportJobDto MapToDto(ExportJob job)
        => new(
            Id: job.Id,
            NotificationId: job.NotificationId,
            RequestedBy: job.RequestedBy,
            RequestedDate: job.RequestedDate,
            Status: job.Status,
            FileName: job.FileName,
            ErrorMessage: job.ErrorMessage);
}
