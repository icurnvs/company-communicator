using System.Text.Json;
using Azure.Messaging.ServiceBus;
using CompanyCommunicator.Core.Models;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Core.Services.Queue;

/// <summary>
/// Azure Service Bus implementation of <see cref="IServiceBusService"/>.
/// Uses named <see cref="ServiceBusSender"/> instances for each queue.
/// Batch sends are capped at 100 messages per call to respect Service Bus limits.
/// </summary>
internal sealed class ServiceBusService : IServiceBusService
{
    private const int SendBatchSize = 100;

    private readonly ServiceBusSender _prepareSender;
    private readonly ServiceBusSender _sendSender;
    private readonly ServiceBusSender _exportSender;
    private readonly ILogger<ServiceBusService> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="ServiceBusService"/>.
    /// </summary>
    /// <param name="senderFactory">Factory that provides named senders per queue.</param>
    /// <param name="logger">Logger.</param>
    public ServiceBusService(
        IServiceBusSenderFactory senderFactory,
        ILogger<ServiceBusService> logger)
    {
        _prepareSender = senderFactory.GetSender(QueueNames.Prepare);
        _sendSender = senderFactory.GetSender(QueueNames.Send);
        _exportSender = senderFactory.GetSender(QueueNames.Export);
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task SendPrepareMessageAsync(Guid notificationId, CancellationToken ct)
    {
        var payload = new PrepareQueueMessage(notificationId);
        var message = CreateMessage(payload);
        message.MessageId = notificationId.ToString();

        await _prepareSender.SendMessageAsync(message, ct).ConfigureAwait(false);
        _logger.LogInformation("Enqueued prepare message for notification {NotificationId}.", notificationId);
    }

    /// <inheritdoc/>
    public async Task SendBatchSendMessagesAsync(
        IReadOnlyList<SendQueueMessage> messages,
        CancellationToken ct)
    {
        int total = messages.Count;

        for (int i = 0; i < total; i += SendBatchSize)
        {
            var batch = messages.Skip(i).Take(SendBatchSize)
                .Select(m =>
                {
                    var msg = CreateMessage(m);
                    msg.MessageId = m.SentNotificationId.ToString();
                    return msg;
                })
                .ToList();

            await _sendSender.SendMessagesAsync(batch, ct).ConfigureAwait(false);
        }

        _logger.LogInformation(
            "Enqueued {Count} send messages across {Batches} batch(es).",
            total,
            (int)Math.Ceiling((double)total / SendBatchSize));
    }

    /// <inheritdoc/>
    public async Task SendExportMessageAsync(
        Guid exportJobId,
        Guid notificationId,
        string requestedBy,
        CancellationToken ct)
    {
        var payload = new ExportQueueMessage(exportJobId, notificationId, requestedBy);
        var message = CreateMessage(payload);
        message.MessageId = exportJobId.ToString();

        await _exportSender.SendMessageAsync(message, ct).ConfigureAwait(false);
        _logger.LogInformation("Enqueued export message for job {ExportJobId}.", exportJobId);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private static ServiceBusMessage CreateMessage<T>(T payload)
    {
        var json = JsonSerializer.Serialize(payload);
        return new ServiceBusMessage(json)
        {
            ContentType = "application/json",
        };
    }
}
