using System.Text.Json;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Core.Models;
using CompanyCommunicator.Core.Services.Queue;
using CompanyCommunicator.Functions.Prep.Orchestrators;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.DurableTask.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Triggers;

/// <summary>
/// Service Bus trigger: listens on the <c>cc-prepare</c> queue and starts
/// a <see cref="PrepareToSendOrchestrator"/> Durable Function instance
/// for each notification preparation request.
/// </summary>
public sealed class PrepareToSendTrigger
{
    private readonly AppDbContext _db;
    private readonly ILogger<PrepareToSendTrigger> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="PrepareToSendTrigger"/>.
    /// </summary>
    public PrepareToSendTrigger(
        AppDbContext db,
        ILogger<PrepareToSendTrigger> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Function entry point. Deserializes the incoming message, starts the orchestration,
    /// and persists the tracking URL back to the notification record.
    /// </summary>
    /// <param name="messageBody">JSON-serialized <see cref="PrepareQueueMessage"/>.</param>
    /// <param name="client">Durable task client for scheduling orchestrations.</param>
    /// <param name="ctx">Function execution context.</param>
    [Function(nameof(PrepareToSendTrigger))]
    public async Task Run(
        [ServiceBusTrigger(
            QueueNames.Prepare,
            Connection = "ServiceBus")]
        string messageBody,
        [DurableClient] DurableTaskClient client,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;

        PrepareQueueMessage? message;
        try
        {
            message = JsonSerializer.Deserialize<PrepareQueueMessage>(messageBody);
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex,
                "PrepareToSendTrigger: Failed to deserialize PrepareQueueMessage. " +
                "Message will be dead-lettered.");
            return;
        }

        if (message is null)
        {
            _logger.LogError(
                "PrepareToSendTrigger: Deserialized PrepareQueueMessage is null. " +
                "Message will be dead-lettered.");
            return;
        }

        var notificationId = message.NotificationId;

        _logger.LogInformation(
            "PrepareToSendTrigger: Received prepare request for notification {NotificationId}.",
            notificationId);

        // Update notification status to Queued before starting the orchestration.
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId, ct)
            .ConfigureAwait(false);

        if (notification is null)
        {
            _logger.LogError(
                "PrepareToSendTrigger: Notification {NotificationId} not found in database.",
                notificationId);
            return;
        }

        notification.Status = NotificationStatus.Queued;
        await _db.SaveChangesAsync(ct).ConfigureAwait(false);

        // Schedule the root orchestrator. Use the notification ID as the instance ID
        // to make it idempotent (re-queueing the same message won't start a duplicate).
        var instanceId = notificationId.ToString("N");

        await client.ScheduleNewOrchestrationInstanceAsync(
            nameof(PrepareToSendOrchestrator),
            input: notificationId,
            options: new StartOrchestrationOptions { InstanceId = instanceId },
            cancellation: ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "PrepareToSendTrigger: Started orchestration instance '{InstanceId}' " +
            "for notification {NotificationId}.",
            instanceId, notificationId);

        // Persist the Durable Functions management URL as the tracking URL.
        var metadata = await client
            .GetInstancesAsync(instanceId, cancellation: ct)
            .ConfigureAwait(false);

        if (metadata is not null)
        {
            // Store a simple status-check reference (not a full SAS URL in prod).
            notification.TrackingUrl =
                $"orchestration:{instanceId}";

            await _db.SaveChangesAsync(ct).ConfigureAwait(false);
        }
    }
}
