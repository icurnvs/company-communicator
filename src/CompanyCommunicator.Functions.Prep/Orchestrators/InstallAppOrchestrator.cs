using CompanyCommunicator.Core.Data.Entities;
using CompanyCommunicator.Functions.Prep.Activities;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Orchestrators;

/// <summary>
/// Sub-orchestrator: installs the Teams app for all recipients (personal scope for users,
/// team scope for teams) and waits for conversation IDs to propagate before handing off
/// to the send pipeline.
///
/// Design notes:
/// - v5-R3: Uses ContinueAsNew keyset checkpointing every <see cref="CheckpointEvery"/>
///   waves so Durable history stays bounded at 50k-user scale.
/// - v5-R11: Adaptive polling backoff increases the wait interval from 1x to 1.5x
///   after the first two attempts, then to 2x after attempt five.
/// - Team install is always performed in the final ContinueAsNew instance (after user
///   fan-out completes) because team scope is low volume and does not need pagination.
/// </summary>
public sealed class InstallAppOrchestrator
{
    private const int PagesPerBatchCall = 10;
    private const int InstallBatchSize = 20;
    private const int CheckpointEvery = 25;
    private static readonly TimeSpan InstallPhaseTimeout = TimeSpan.FromMinutes(60);

    private static readonly TaskOptions ActivityRetryOptions = new(
        new TaskRetryOptions(
            new RetryPolicy(
                maxNumberOfAttempts: 3,
                firstRetryInterval: TimeSpan.FromSeconds(5),
                backoffCoefficient: 2.0,
                maxRetryInterval: TimeSpan.FromSeconds(30),
                retryTimeout: null)));

    /// <summary>
    /// Orchestrator entry point.
    /// </summary>
    /// <param name="context">Durable orchestration context.</param>
    [Function(nameof(InstallAppOrchestrator))]
    public async Task RunOrchestrator(
        [OrchestrationTrigger] TaskOrchestrationContext context)
    {
        var logger = context.CreateReplaySafeLogger<InstallAppOrchestrator>();
        var input = context.GetInput<InstallAppInput>()
            ?? throw new InvalidOperationException("InstallAppOrchestrator requires InstallAppInput.");

        var installDeadline = input.Deadline ?? context.CurrentUtcDateTime.Add(InstallPhaseTimeout);

        logger.LogInformation(
            "InstallAppOrchestrator: Starting for notification {NotificationId}. " +
            "Cursor={Cursor}, Deadline={Deadline:u}.",
            input.NotificationId, input.LastSeenId, installDeadline);

        // Step 1: Status transition (only on first instance — LastSeenId == 0).
        if (input.LastSeenId == 0)
        {
            await context.CallActivityAsync(
                nameof(SetNotificationStatusActivity),
                new SetStatusInput(input.NotificationId, NotificationStatus.InstallingApp),
                ActivityRetryOptions);
        }

        // ---- Step 2: User fan-out (personal scope, windowed keyset pagination) ----
        int totalUserInstalled = input.CarriedInstalled, totalUserFailed = input.CarriedFailed;
        long lastSeenId = input.LastSeenId;
        bool hasMoreUsers = true;
        int waveCount = 0;

        while (hasMoreUsers)
        {
            if (context.CurrentUtcDateTime >= installDeadline) break;

            var batchResult = await context.CallActivityAsync<GetInstallBatchResult>(
                nameof(GetInstallBatchActivity),
                new GetInstallBatchInput(input.NotificationId, lastSeenId, InstallBatchSize, PagesPerBatchCall),
                ActivityRetryOptions);

            if (batchResult.Pages.Count == 0) { hasMoreUsers = false; break; }

            lastSeenId = batchResult.NextCursorId;

            var waveTasks = batchResult.Pages
                .Where(page => page.Count > 0)
                .Select(page => context.CallActivityAsync<InstallBatchResult>(
                    nameof(InstallAppForUsersActivity),
                    new InstallBatchInput(input.NotificationId, input.TeamsAppId, page),
                    ActivityRetryOptions))
                .ToList();

            if (waveTasks.Count > 0)
            {
                var waveResults = await Task.WhenAll(waveTasks);
                totalUserInstalled += waveResults.Sum(r => r.Installed);
                totalUserFailed += waveResults.Sum(r => r.Failed);
            }

            if (!batchResult.HasMore) { hasMoreUsers = false; break; }

            // v5-R3: Checkpoint to reset history and prevent bloat at 50k scale.
            waveCount++;
            if (waveCount % CheckpointEvery == 0)
            {
                logger.LogInformation(
                    "InstallAppOrchestrator: Checkpointing at wave {Wave} for notification {NotificationId}. " +
                    "Cursor={Cursor}, Installed={Installed}, Failed={Failed}.",
                    waveCount, input.NotificationId, lastSeenId, totalUserInstalled, totalUserFailed);

                context.ContinueAsNew(new InstallAppInput(
                    input.NotificationId, input.TeamsAppId,
                    input.InstallWaitSeconds, input.MaxRefreshAttempts,
                    lastSeenId, totalUserInstalled, totalUserFailed,
                    installDeadline));
                return;
            }
        }

        logger.LogInformation(
            "InstallAppOrchestrator: User fan-out complete for notification {NotificationId}. " +
            "Installed={Installed}, Failed={Failed}.",
            input.NotificationId, totalUserInstalled, totalUserFailed);

        // ---- Step 3: Team install (team scope, simple single activity) ----
        var teamResult = await context.CallActivityAsync<InstallBatchResult>(
            nameof(InstallAppForTeamsActivity),
            new InstallTeamsInput(input.NotificationId, input.TeamsAppId),
            ActivityRetryOptions);

        logger.LogInformation(
            "InstallAppOrchestrator: Team install complete for notification {NotificationId}. " +
            "Installed={Installed}, Failed={Failed}.",
            input.NotificationId, teamResult.Installed, teamResult.Failed);

        // ---- Step 4: Shared polling loop with adaptive backoff (v5-R11) ----
        int totalInstalled = totalUserInstalled + teamResult.Installed;
        if (totalInstalled > 0)
        {
            int baseWaitSeconds = input.InstallWaitSeconds > 0 ? input.InstallWaitSeconds : 60;
            int noProgressStreak = 0;
            int lastStillPending = int.MaxValue;

            for (int attempt = 1; attempt <= input.MaxRefreshAttempts; attempt++)
            {
                if (context.CurrentUtcDateTime >= installDeadline) break;

                double multiplier = attempt <= 2 ? 1.0 : attempt <= 5 ? 1.5 : 2.0;
                var waitDuration = TimeSpan.FromSeconds(baseWaitSeconds * multiplier);

                await context.CreateTimer(
                    context.CurrentUtcDateTime.Add(waitDuration),
                    CancellationToken.None);

                if (context.CurrentUtcDateTime >= installDeadline) break;

                var refreshResult = await context.CallActivityAsync<RefreshResult>(
                    nameof(RefreshConversationIdsActivity),
                    input.NotificationId,
                    ActivityRetryOptions);

                logger.LogInformation(
                    "InstallAppOrchestrator: Refresh attempt {Attempt}/{Max} for notification {NotificationId}. " +
                    "Refreshed={Refreshed}, StillPending={StillPending}.",
                    attempt, input.MaxRefreshAttempts, input.NotificationId,
                    refreshResult.Refreshed, refreshResult.StillPending);

                if (refreshResult.StillPending == 0) break;

                if (refreshResult.StillPending >= lastStillPending)
                    noProgressStreak++;
                else
                {
                    noProgressStreak = 0;
                    lastStillPending = refreshResult.StillPending;
                }

                if (noProgressStreak >= 3)
                {
                    logger.LogWarning(
                        "InstallAppOrchestrator: No progress for 3 consecutive polls. " +
                        "Stopping refresh for notification {NotificationId}. StillPending={StillPending}.",
                        input.NotificationId, refreshResult.StillPending);
                    break;
                }
            }
        }

        // ---- Step 5: Mark remaining unresolved (both user + team) ----
        var unreachable = await context.CallActivityAsync<int>(
            nameof(MarkUnreachableActivity),
            input.NotificationId,
            ActivityRetryOptions);

        if (unreachable > 0)
        {
            logger.LogWarning(
                "InstallAppOrchestrator: Notification {NotificationId} — {Unreachable} recipient(s) unreachable.",
                input.NotificationId, unreachable);
        }
    }
}
