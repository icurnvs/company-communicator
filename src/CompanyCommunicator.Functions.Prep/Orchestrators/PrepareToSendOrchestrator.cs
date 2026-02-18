using CompanyCommunicator.Functions.Prep.Activities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Orchestrators;

/// <summary>
/// Root orchestrator for the notification preparation pipeline.
/// Coordinates the full workflow from card storage through recipient sync,
/// queue dispatch, and delivery aggregation.
/// </summary>
/// <remarks>
/// Workflow steps:
/// <list type="number">
/// <item>Store the Adaptive Card JSON to blob storage.</item>
/// <item>Sync recipients from Graph (sub-orchestrator).</item>
/// <item>Update the total recipient count on the notification.</item>
/// <item>Fan out send messages to the cc-send queue (sub-orchestrator).</item>
/// <item>Poll delivery status until complete (sub-orchestrator).</item>
/// </list>
/// </remarks>
public sealed class PrepareToSendOrchestrator
{
    /// <summary>
    /// Orchestrator entry point.
    /// </summary>
    /// <param name="context">Durable orchestration context.</param>
    [Function(nameof(PrepareToSendOrchestrator))]
    public async Task RunOrchestrator(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var logger = context.CreateReplaySafeLogger<PrepareToSendOrchestrator>();
        var notificationId = context.GetInput<Guid>();

        logger.LogInformation(
            "PrepareToSendOrchestrator: Starting for notification {NotificationId}.",
            notificationId);

        // Step 1: Build and store the Adaptive Card to blob storage.
        // Also transitions notification status to SyncingRecipients.
        await context.CallActivityAsync(
            nameof(StoreCardActivity),
            notificationId);

        logger.LogInformation(
            "PrepareToSendOrchestrator: Card stored for notification {NotificationId}.",
            notificationId);

        // Step 2: Sync recipients from Microsoft Graph (fan-out over audience types).
        var recipientCount = await context.CallSubOrchestratorAsync<int>(
            nameof(SyncRecipientsOrchestrator),
            notificationId);

        logger.LogInformation(
            "PrepareToSendOrchestrator: Recipient sync complete for notification {NotificationId}. " +
            "Total recipients = {Count}.",
            notificationId, recipientCount);

        // Step 3: Persist the final recipient count and transition to Sending.
        await context.CallActivityAsync(
            nameof(UpdateRecipientCountActivity),
            new UpdateCountInput(notificationId, recipientCount));

        // Step 4: Enqueue all recipients onto the cc-send queue in pages of 100.
        await context.CallSubOrchestratorAsync(
            nameof(SendQueueOrchestrator),
            notificationId);

        logger.LogInformation(
            "PrepareToSendOrchestrator: All send messages enqueued for notification {NotificationId}.",
            notificationId);

        // Step 5: Poll delivery status until all recipients reach a terminal state.
        await context.CallSubOrchestratorAsync(
            nameof(DataAggregationOrchestrator),
            notificationId);

        logger.LogInformation(
            "PrepareToSendOrchestrator: Completed for notification {NotificationId}.",
            notificationId);
    }
}
