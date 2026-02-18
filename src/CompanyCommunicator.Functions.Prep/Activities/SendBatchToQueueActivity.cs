using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;
using CompanyCommunicator.Core.Services.Queue;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

/// <summary>
/// Activity: loads a page of <see cref="SentNotification"/> records that are in
/// <c>Queued</c> status and enqueues them as <see cref="SendQueueMessage"/> messages
/// on the <c>cc-send</c> Service Bus queue.
/// </summary>
public sealed class SendBatchToQueueActivity
{
    private readonly AppDbContext _db;
    private readonly IServiceBusService _serviceBusService;
    private readonly ILogger<SendBatchToQueueActivity> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="SendBatchToQueueActivity"/>.
    /// </summary>
    public SendBatchToQueueActivity(
        AppDbContext db,
        IServiceBusService serviceBusService,
        ILogger<SendBatchToQueueActivity> logger)
    {
        _db = db;
        _serviceBusService = serviceBusService;
        _logger = logger;
    }

    /// <summary>
    /// Activity entry point. Loads a page of queued recipients and enqueues them for delivery.
    /// Returns the number of messages enqueued (0 signals no more pages).
    /// </summary>
    /// <param name="input">Page descriptor: notification ID, page number, and page size.</param>
    /// <param name="ctx">Function execution context.</param>
    /// <returns>The number of messages enqueued in this batch (0 = done).</returns>
    [Function(nameof(SendBatchToQueueActivity))]
    public async Task<int> RunActivity(
        [ActivityTrigger] SendBatchInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        // Load this page of SentNotification records.
        var records = await _db.SentNotifications
            .Where(s => s.NotificationId == input.NotificationId
                        && s.DeliveryStatus == DeliveryStatus.Queued)
            .OrderBy(s => s.Id)
            .Skip(input.BatchNumber * input.BatchSize)
            .Take(input.BatchSize)
            .AsNoTracking()
            .ToListAsync(ct)
            .ConfigureAwait(false);

        if (records.Count == 0)
        {
            _logger.LogInformation(
                "SendBatchToQueueActivity: No more records for notification {NotificationId} " +
                "at batch {BatchNumber}.",
                input.NotificationId, input.BatchNumber);
            return 0;
        }

        var messages = records
            .Select(r => new SendQueueMessage(
                NotificationId: r.NotificationId,
                SentNotificationId: r.Id,
                RecipientId: r.RecipientId,
                ConversationId: r.ConversationId,
                ServiceUrl: r.ServiceUrl,
                CardBlobName: $"{r.NotificationId}.json"))
            .ToList();

        await _serviceBusService
            .SendBatchSendMessagesAsync(messages, ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "SendBatchToQueueActivity: Enqueued {Count} messages for notification {NotificationId}, " +
            "batch {BatchNumber}.",
            messages.Count, input.NotificationId, input.BatchNumber);

        return messages.Count;
    }
}
