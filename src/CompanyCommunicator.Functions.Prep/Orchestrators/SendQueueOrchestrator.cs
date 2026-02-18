using CompanyCommunicator.Functions.Prep.Activities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Orchestrators;

/// <summary>
/// Sub-orchestrator: paginates over all <c>Queued</c> <see cref="Core.Data.Entities.SentNotification"/>
/// records for the notification and enqueues them onto the <c>cc-send</c> Service Bus queue
/// in batches of <see cref="BatchSize"/> records.
/// </summary>
public sealed class SendQueueOrchestrator
{
    private const int BatchSize = 100;

    /// <summary>
    /// Orchestrator entry point.
    /// </summary>
    /// <param name="context">Durable orchestration context.</param>
    [Function(nameof(SendQueueOrchestrator))]
    public async Task RunOrchestrator(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var logger = context.CreateReplaySafeLogger<SendQueueOrchestrator>();
        var notificationId = context.GetInput<Guid>();

        logger.LogInformation(
            "SendQueueOrchestrator: Starting enqueue loop for notification {NotificationId}.",
            notificationId);

        int batchNumber = 0;
        int totalEnqueued = 0;

        while (true)
        {
            var input = new SendBatchInput(notificationId, batchNumber, BatchSize);

            var enqueued = await context.CallActivityAsync<int>(
                nameof(SendBatchToQueueActivity),
                input);

            if (enqueued == 0)
            {
                // No more records in this page -- we are done.
                break;
            }

            totalEnqueued += enqueued;
            batchNumber++;
        }

        logger.LogInformation(
            "SendQueueOrchestrator: Finished enqueuing {Total} messages for notification {NotificationId} " +
            "across {Batches} batch(es).",
            totalEnqueued, notificationId, batchNumber);
    }
}
