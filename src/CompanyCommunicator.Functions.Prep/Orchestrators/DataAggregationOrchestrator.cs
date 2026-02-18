using CompanyCommunicator.Functions.Prep.Activities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Orchestrators;

/// <summary>
/// Sub-orchestrator: polls delivery status at an adaptive interval until all
/// <see cref="Core.Data.Entities.SentNotification"/> records reach a terminal status
/// or the 24-hour safety-net limit is reached.
/// </summary>
/// <remarks>
/// Polling interval strategy:
/// <list type="bullet">
/// <item>Elapsed &lt; 10 minutes: poll every 10 seconds (fast feedback during active sending).</item>
/// <item>Elapsed &gt;= 10 minutes: poll every 60 seconds (reduce load during tail-end delivery).</item>
/// </list>
/// Safety net: if more than 1440 minutes (24 hours) have elapsed, invoke
/// <see cref="ForceCompleteActivity"/> and terminate the loop.
/// </remarks>
public sealed class DataAggregationOrchestrator
{
    private const double FastPhaseMinutes = 10.0;
    private const double SafetyNetMinutes = 1440.0; // 24 hours
    private static readonly TimeSpan FastInterval = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan SlowInterval = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Orchestrator entry point.
    /// </summary>
    /// <param name="context">Durable orchestration context.</param>
    [Function(nameof(DataAggregationOrchestrator))]
    public async Task RunOrchestrator(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var logger = context.CreateReplaySafeLogger<DataAggregationOrchestrator>();
        var notificationId = context.GetInput<Guid>();

        var sendingStarted = context.CurrentUtcDateTime;
        bool isComplete = false;

        logger.LogInformation(
            "DataAggregationOrchestrator: Starting aggregation loop for notification {NotificationId}.",
            notificationId);

        while (!isComplete)
        {
            double elapsedMinutes =
                (context.CurrentUtcDateTime - sendingStarted).TotalMinutes;

            // Safety-net check before waiting.
            if (elapsedMinutes > SafetyNetMinutes)
            {
                logger.LogWarning(
                    "DataAggregationOrchestrator: Safety-net triggered for notification {NotificationId} " +
                    "after {Elapsed:F1} minutes. Forcing completion.",
                    notificationId, elapsedMinutes);

                await context.CallActivityAsync(
                    nameof(ForceCompleteActivity),
                    notificationId);

                break;
            }

            // Adaptive delay.
            var delay = elapsedMinutes < FastPhaseMinutes ? FastInterval : SlowInterval;

            await context.CreateTimer(
                context.CurrentUtcDateTime.Add(delay),
                CancellationToken.None);

            // Re-check elapsed after timer fires (replay-safe).
            elapsedMinutes = (context.CurrentUtcDateTime - sendingStarted).TotalMinutes;

            // Run the aggregation activity.
            var result = await context.CallActivityAsync<Models.AggregationResult>(
                nameof(DataAggregationActivity),
                notificationId);

            isComplete = result.IsComplete;

            logger.LogInformation(
                "DataAggregationOrchestrator: Notification {NotificationId} - " +
                "IsComplete={IsComplete}, Elapsed={Elapsed:F1}min, " +
                "Succeeded={Succeeded}, Failed={Failed}, NotFound={NotFound}.",
                notificationId, isComplete, elapsedMinutes,
                result.Succeeded, result.Failed, result.NotFound);
        }

        logger.LogInformation(
            "DataAggregationOrchestrator: Completed for notification {NotificationId}.",
            notificationId);
    }
}
