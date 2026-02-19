using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Activities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Orchestrators;

public sealed class PrepareToSendOrchestrator
{
    [Function(nameof(PrepareToSendOrchestrator))]
    public async Task RunOrchestrator(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var logger = context.CreateReplaySafeLogger<PrepareToSendOrchestrator>();
        var notificationId = context.GetInput<Guid>();

        logger.LogInformation(
            "PrepareToSendOrchestrator: Starting for notification {NotificationId}.",
            notificationId);

        // Step 1: Store Adaptive Card to blob.
        await context.CallActivityAsync(nameof(StoreCardActivity), notificationId);

        // Step 2: Sync recipients (Users + Teams).
        var recipientCount = await context.CallSubOrchestratorAsync<int>(
            nameof(SyncRecipientsOrchestrator), notificationId);

        logger.LogInformation(
            "PrepareToSendOrchestrator: Sync complete. Recipients={Count}.", recipientCount);

        // Step 3: Persist recipient count.
        await context.CallActivityAsync(
            nameof(UpdateRecipientCountActivity),
            new UpdateCountInput(notificationId, recipientCount));

        // Step 4: Read install config.
        var installConfig = await context.CallActivityAsync<InstallConfig>(
            nameof(GetInstallConfigActivity), notificationId);

        // Step 5: Proactive install (personal + team scope).
        // v5-R8: Wrapped in try/catch for graceful degradation — if install fails
        // catastrophically, recipients who already have ConversationIds still get sent.
        // v5-R4: MarkUnreachable is conditional — only at root level when install is skipped.
        // v5-R5: Final Refresh before MarkUnreachable to catch late-arriving callbacks.
        if (!string.IsNullOrEmpty(installConfig.TeamsAppId))
        {
            try
            {
                await context.CallSubOrchestratorAsync(
                    nameof(InstallAppOrchestrator),
                    new InstallAppInput(
                        notificationId, installConfig.TeamsAppId,
                        installConfig.InstallWaitSeconds, installConfig.MaxRefreshAttempts));
            }
            catch (TaskFailedException ex)
            {
                logger.LogError(ex,
                    "PrepareToSendOrchestrator: Install step failed for notification {NotificationId}. " +
                    "Continuing with available recipients.", notificationId);

                // v5-R5: Final refresh to catch any late-arriving callbacks before marking unreachable.
                await context.CallActivityAsync(
                    nameof(RefreshConversationIdsActivity), notificationId);

                await context.CallActivityAsync(
                    nameof(MarkUnreachableActivity), notificationId);
            }
        }
        else
        {
            logger.LogWarning(
                "PrepareToSendOrchestrator: Bot__TeamsAppId not configured. Skipping install.");

            // Install skipped — mark any null-ConversationId records unreachable.
            await context.CallActivityAsync(nameof(MarkUnreachableActivity), notificationId);
        }

        // Step 6: Transition to Sending.
        await context.CallActivityAsync(
            nameof(SetNotificationStatusActivity),
            new SetStatusInput(notificationId, NotificationStatus.Sending));

        // Step 7: Enqueue all Queued records to cc-send.
        await context.CallSubOrchestratorAsync(nameof(SendQueueOrchestrator), notificationId);

        // Step 8: Poll delivery status.
        await context.CallSubOrchestratorAsync(nameof(DataAggregationOrchestrator), notificationId);

        logger.LogInformation(
            "PrepareToSendOrchestrator: Completed for notification {NotificationId}.",
            notificationId);
    }
}
