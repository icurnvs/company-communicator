using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Activities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Orchestrators;

/// <summary>
/// Sub-orchestrator: resolves the full recipient list for a notification by
/// fanning out over its audience definitions and invoking the appropriate
/// sync activities in parallel. Returns the total recipient count.
/// </summary>
public sealed class SyncRecipientsOrchestrator
{
    /// <summary>
    /// Orchestrator entry point.
    /// </summary>
    /// <param name="context">Durable orchestration context.</param>
    [Function(nameof(SyncRecipientsOrchestrator))]
    public async Task<int> RunOrchestrator(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var logger = context.CreateReplaySafeLogger<SyncRecipientsOrchestrator>();
        var notificationId = context.GetInput<Guid>();

        // Load the audience configuration via an activity (no DB access in orchestrators).
        var audienceInfo = await context.CallActivityAsync<NotificationAudienceInfo>(
            nameof(GetNotificationAudienceActivity),
            notificationId);

        logger.LogInformation(
            "SyncRecipientsOrchestrator: Notification {NotificationId} AllUsers={AllUsers}, " +
            "Audience count={Count}.",
            notificationId, audienceInfo.AllUsers, audienceInfo.Audiences.Count);

        int totalRecipients;

        if (audienceInfo.AllUsers)
        {
            // Single activity call: full-tenant delta sync.
            totalRecipients = await context.CallActivityAsync<int>(
                nameof(SyncAllUsersActivity),
                notificationId);
        }
        else
        {
            // Fan-out: launch one sync activity per audience definition in parallel.
            var tasks = new List<Task<int>>();

            foreach (var audience in audienceInfo.Audiences)
            {
                var syncInput = new SyncInput(notificationId, audience.AudienceId);

                Task<int> task = audience.AudienceType switch
                {
                    AudienceType.Roster or AudienceType.Team =>
                        context.CallActivityAsync<int>(
                            nameof(SyncTeamMembersActivity),
                            syncInput),

                    AudienceType.Group =>
                        context.CallActivityAsync<int>(
                            nameof(SyncGroupMembersActivity),
                            syncInput),

                    _ => Task.FromResult(0),
                };

                tasks.Add(task);
            }

            var results = await Task.WhenAll(tasks);
            totalRecipients = results.Sum();
        }

        logger.LogInformation(
            "SyncRecipientsOrchestrator: Notification {NotificationId} total recipients = {Count}.",
            notificationId, totalRecipients);

        return totalRecipients;
    }
}
