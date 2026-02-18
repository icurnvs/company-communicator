namespace CompanyCommunicator.Core.Services.Blob;

/// <summary>
/// Abstraction for Azure Blob Storage operations used by Company Communicator.
/// </summary>
public interface IBlobStorageService
{
    /// <summary>
    /// Uploads a card header image to the card-images container.
    /// </summary>
    /// <param name="fileName">The blob name to use (e.g. a GUID with extension).</param>
    /// <param name="content">The image stream.</param>
    /// <param name="contentType">MIME type such as "image/png".</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The full blob URI of the uploaded image.</returns>
    Task<string> UploadCardImageAsync(string fileName, Stream content, string contentType, CancellationToken ct);

    /// <summary>
    /// Serializes and stores an Adaptive Card JSON payload for a notification.
    /// Stored as <c>{notificationId}.json</c> in the card-images container.
    /// </summary>
    /// <param name="notificationId">The notification ID used as the blob name.</param>
    /// <param name="cardJson">The Adaptive Card JSON string.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The blob name (not a full URI).</returns>
    Task<string> UploadAdaptiveCardAsync(Guid notificationId, string cardJson, CancellationToken ct);

    /// <summary>
    /// Retrieves a previously stored Adaptive Card JSON payload.
    /// </summary>
    /// <param name="notificationId">The notification ID used as the blob name.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The JSON string, or <c>null</c> if the blob does not exist.</returns>
    Task<string?> GetAdaptiveCardAsync(Guid notificationId, CancellationToken ct);

    /// <summary>
    /// Generates a time-limited SAS URI (15 minutes, read-only) for an export blob.
    /// </summary>
    /// <param name="blobName">The blob name in the exports container.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>A SAS URI that can be used to download the export file.</returns>
    Task<Uri> GetExportDownloadUriAsync(string blobName, CancellationToken ct);

    /// <summary>
    /// Uploads an export file stream to the exports container.
    /// </summary>
    /// <param name="blobName">The destination blob name.</param>
    /// <param name="content">The file content stream.</param>
    /// <param name="ct">Cancellation token.</param>
    Task UploadExportAsync(string blobName, Stream content, CancellationToken ct);

    /// <summary>
    /// Deletes a card image blob from the card-images container.
    /// </summary>
    /// <param name="blobName">The blob name to delete.</param>
    /// <param name="ct">Cancellation token.</param>
    Task DeleteCardImageAsync(string blobName, CancellationToken ct);
}
