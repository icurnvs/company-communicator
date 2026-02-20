using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Services.Blob;
using CompanyCommunicator.Core.Services.Cards;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: builds the Adaptive Card for a notification, uploads it to blob storage,
/// and transitions the notification status to <c>SyncingRecipients</c>.
/// </summary>
public sealed class StoreCardActivity
{
    private readonly AppDbContext _db;
    private readonly IAdaptiveCardService _cardService;
    private readonly IBlobStorageService _blobService;
    private readonly ILogger<StoreCardActivity> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="StoreCardActivity"/>.
    /// </summary>
    public StoreCardActivity(
        AppDbContext db,
        IAdaptiveCardService cardService,
        IBlobStorageService blobService,
        ILogger<StoreCardActivity> logger)
    {
        _db = db;
        _cardService = cardService;
        _blobService = blobService;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Builds and stores the Adaptive Card for the given notification.
    /// </summary>
    /// <param name="notificationId">The notification to process.</param>
    /// <param name="ctx">Function execution context.</param>
    [Function(nameof(StoreCardActivity))]
    public async Task RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            _logger.LogError(
                "StoreCardActivity: Notification {NotificationId} not found.", notificationId);
            throw new InvalidOperationException(
                $"Notification {notificationId} not found.");
        }

        // Build the Adaptive Card JSON payload.
        var cardJson = _cardService.BuildNotificationCard(notification);

        // Resolve custom variables (same value for all recipients, so done once here).
        cardJson = _cardService.ResolveCustomVariables(cardJson, notification.CustomVariables);

        // Upload to blob storage. Returns the blob name.
        var blobName = await _blobService
            .UploadAdaptiveCardAsync(notificationId, cardJson, ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "StoreCardActivity: Uploaded Adaptive Card for notification {NotificationId} as blob '{BlobName}'.",
            notificationId, blobName);

        // Transition status.
        notification.Status = NotificationStatus.SyncingRecipients;
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        _logger.LogInformation(
            "StoreCardActivity: Notification {NotificationId} status set to SyncingRecipients.",
            notificationId);
    }
}
