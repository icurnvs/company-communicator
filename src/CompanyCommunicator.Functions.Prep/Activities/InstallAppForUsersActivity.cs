using CompanyCommunicator.Core.Services.Graph;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class InstallAppForUsersActivity
{
    private readonly IGraphService _graphService;
    private readonly ILogger<InstallAppForUsersActivity> _logger;

    public InstallAppForUsersActivity(IGraphService graphService, ILogger<InstallAppForUsersActivity> logger)
    {
        _graphService = graphService;
        _logger = logger;
    }

    [Function(nameof(InstallAppForUsersActivity))]
    public async Task<InstallBatchResult> RunActivity(
        [ActivityTrigger] InstallBatchInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        int installed = 0, failed = 0;

        using var semaphore = new SemaphoreSlim(5);

        var tasks = input.UserAadIds.Select(async userAadId =>
        {
            await semaphore.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                var success = await _graphService
                    .InstallAppForUserAsync(userAadId, input.TeamsAppId, ct)
                    .ConfigureAwait(false);
                if (success) Interlocked.Increment(ref installed);
                else Interlocked.Increment(ref failed);
            }
            catch (BrokenCircuitException) { throw; }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "InstallAppForUsersActivity: Error for user {UserAadId}.", userAadId);
                Interlocked.Increment(ref failed);
            }
            finally
            {
                semaphore.Release();
            }
        });

        await Task.WhenAll(tasks).ConfigureAwait(false);

        _logger.LogInformation(
            "InstallAppForUsersActivity: Notification {NotificationId} — Installed={Installed}, Failed={Failed}.",
            input.NotificationId, installed, failed);
        return new InstallBatchResult(installed, failed);
    }
}
