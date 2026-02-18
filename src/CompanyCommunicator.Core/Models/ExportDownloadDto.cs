namespace CompanyCommunicator.Core.Models;

/// <summary>
/// Data transfer object containing the time-limited download URI for a completed export job.
/// </summary>
public sealed record ExportDownloadDto(Guid ExportJobId, Uri DownloadUri);
