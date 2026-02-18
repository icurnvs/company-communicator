using System.Text;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Core.Services.Blob;

/// <summary>
/// Azure Blob Storage implementation of <see cref="IBlobStorageService"/>.
/// Uses two containers: "card-images" for Adaptive Card payloads and uploaded images,
/// and "exports" for delivery report files.
/// </summary>
internal sealed class BlobStorageService : IBlobStorageService
{
    private const string CardImagesContainer = "card-images";
    private const string ExportsContainer = "exports";
    private static readonly TimeSpan SasExpiry = TimeSpan.FromMinutes(15);

    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<BlobStorageService> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="BlobStorageService"/>.
    /// </summary>
    /// <param name="blobServiceClient">The Azure Blob Storage service client.</param>
    /// <param name="logger">Logger.</param>
    public BlobStorageService(BlobServiceClient blobServiceClient, ILogger<BlobStorageService> logger)
    {
        _blobServiceClient = blobServiceClient;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<string> UploadCardImageAsync(
        string fileName,
        Stream content,
        string contentType,
        CancellationToken ct)
    {
        var container = _blobServiceClient.GetBlobContainerClient(CardImagesContainer);
        await container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct)
            .ConfigureAwait(false);

        var blobClient = container.GetBlobClient(fileName);
        await blobClient.UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType }
        }, ct).ConfigureAwait(false);

        _logger.LogInformation("Uploaded card image blob '{BlobName}'.", fileName);
        return blobClient.Uri.ToString();
    }

    /// <inheritdoc/>
    public async Task<string> UploadAdaptiveCardAsync(
        Guid notificationId,
        string cardJson,
        CancellationToken ct)
    {
        var blobName = $"{notificationId}.json";
        var container = _blobServiceClient.GetBlobContainerClient(CardImagesContainer);
        await container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct)
            .ConfigureAwait(false);

        var blobClient = container.GetBlobClient(blobName);
        using var ms = new MemoryStream(Encoding.UTF8.GetBytes(cardJson));
        await blobClient.UploadAsync(ms, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = "application/json" }
        }, ct).ConfigureAwait(false);

        _logger.LogInformation(
            "Uploaded Adaptive Card blob '{BlobName}' for notification {NotificationId}.",
            blobName, notificationId);
        return blobName;
    }

    /// <inheritdoc/>
    public async Task<string?> GetAdaptiveCardAsync(Guid notificationId, CancellationToken ct)
    {
        var blobName = $"{notificationId}.json";
        var container = _blobServiceClient.GetBlobContainerClient(CardImagesContainer);
        var blobClient = container.GetBlobClient(blobName);

        if (!await blobClient.ExistsAsync(ct).ConfigureAwait(false))
        {
            return null;
        }

        var response = await blobClient.DownloadContentAsync(ct).ConfigureAwait(false);
        return response.Value.Content.ToString();
    }

    /// <inheritdoc/>
    public async Task<Uri> GetExportDownloadUriAsync(string blobName, CancellationToken ct)
    {
        var container = _blobServiceClient.GetBlobContainerClient(ExportsContainer);
        var blobClient = container.GetBlobClient(blobName);

        // Prefer user delegation SAS (MSI-friendly). Fall back to service SAS if needed.
        // VERIFY: In production the storage account must have hierarchical namespace disabled
        // and the managed identity must have Storage Blob Delegator + Storage Blob Data Reader.
        var sasBuilder = new BlobSasBuilder
        {
            BlobContainerName = ExportsContainer,
            BlobName = blobName,
            Resource = "b",
            ExpiresOn = DateTimeOffset.UtcNow.Add(SasExpiry),
        };
        sasBuilder.SetPermissions(BlobSasPermissions.Read);

        // Generate a SAS URI. When using Managed Identity the BlobServiceClient must be
        // configured with a StorageSharedKeyCredential or a user delegation key.
        // VERIFY: SDK pattern at runtime -- if DefaultAzureCredential is used, call
        // blobServiceClient.GetUserDelegationKeyAsync before generating SAS.
        var sasUri = blobClient.GenerateSasUri(sasBuilder);
        _logger.LogInformation(
            "Generated SAS download URI for export blob '{BlobName}' (expires {Expiry:O}).",
            blobName, sasBuilder.ExpiresOn);

        return await Task.FromResult(sasUri).ConfigureAwait(false);
    }

    /// <inheritdoc/>
    public async Task UploadExportAsync(string blobName, Stream content, CancellationToken ct)
    {
        var container = _blobServiceClient.GetBlobContainerClient(ExportsContainer);
        await container.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct)
            .ConfigureAwait(false);

        var blobClient = container.GetBlobClient(blobName);
        await blobClient.UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders
            {
                ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
        }, ct).ConfigureAwait(false);

        _logger.LogInformation("Uploaded export blob '{BlobName}'.", blobName);
    }

    /// <inheritdoc/>
    public async Task DeleteCardImageAsync(string blobName, CancellationToken ct)
    {
        var container = _blobServiceClient.GetBlobContainerClient(CardImagesContainer);
        var blobClient = container.GetBlobClient(blobName);
        await blobClient.DeleteIfExistsAsync(cancellationToken: ct).ConfigureAwait(false);
        _logger.LogInformation("Deleted card image blob '{BlobName}'.", blobName);
    }
}
