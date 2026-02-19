using System.Collections.Concurrent;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Services.Graph;
using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Polly.CircuitBreaker;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class InstallAppForUsersActivity
{
    private readonly IGraphService _graphService;
    private readonly AppDbContext _db;
    private readonly string _teamsServiceUrl;
    private readonly ILogger<InstallAppForUsersActivity> _logger;

    public InstallAppForUsersActivity(
        IGraphService graphService,
        AppDbContext db,
        IConfiguration config,
        ILogger<InstallAppForUsersActivity> logger)
    {
        _graphService = graphService;
        _db = db;
        // Commercial Teams service URL. Configurable for tenants in non-AMER regions.
        // EMEA: https://smba.trafficmanager.net/emea/
        // APAC: https://smba.trafficmanager.net/apac/
        _teamsServiceUrl = config["Bot:TeamsServiceUrl"] ?? "https://smba.trafficmanager.net/amer/";
        _logger = logger;
    }

    [Function(nameof(InstallAppForUsersActivity))]
    public async Task<InstallBatchResult> RunActivity(
        [ActivityTrigger] InstallBatchInput input,
        FunctionContext ctx)
    {
        var ct = ctx.CancellationToken;
        int installed = 0, failed = 0;

        // Collect chat IDs from successful installs concurrently,
        // then write them to the DB sequentially to avoid DbContext threading issues.
        var chatIds = new ConcurrentDictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        using var semaphore = new SemaphoreSlim(5);

        var tasks = input.UserAadIds.Select(async userAadId =>
        {
            await semaphore.WaitAsync(ct).ConfigureAwait(false);
            try
            {
                var success = await _graphService
                    .InstallAppForUserAsync(userAadId, input.TeamsAppId, ct)
                    .ConfigureAwait(false);

                if (success)
                {
                    Interlocked.Increment(ref installed);

                    // Immediately retrieve the personal chat ID from Graph so we can
                    // populate Users.ConversationId without waiting for installationUpdate.
                    var chatId = await _graphService
                        .GetPersonalChatIdAsync(userAadId, input.TeamsAppId, ct)
                        .ConfigureAwait(false);

                    if (chatId is not null)
                        chatIds[userAadId] = chatId;
                }
                else
                {
                    Interlocked.Increment(ref failed);
                }
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

        // Sequentially update Users.ConversationId for each user that got a chat ID.
        // Only updates users who don't already have a ConversationId (idempotent).
        if (chatIds.Count > 0)
        {
            var aadIds = chatIds.Keys.ToList();
            var users = await _db.Users
                .Where(u => aadIds.Contains(u.AadId) && u.ConversationId == null)
                .ToListAsync(ct)
                .ConfigureAwait(false);

            foreach (var user in users)
            {
                if (chatIds.TryGetValue(user.AadId, out var chatId))
                {
                    user.ConversationId = chatId;
                    user.ServiceUrl = _teamsServiceUrl;
                }
            }

            await _db.SaveChangesAsync(ct).ConfigureAwait(false);

            _logger.LogInformation(
                "InstallAppForUsersActivity: Stored {Count} conversation IDs from Graph for notification {NotificationId}.",
                users.Count, input.NotificationId);
        }

        _logger.LogInformation(
            "InstallAppForUsersActivity: Notification {NotificationId} — Installed={Installed}, Failed={Failed}, ConvIdsStored={ConvIdsStored}.",
            input.NotificationId, installed, failed, chatIds.Count);

        return new InstallBatchResult(installed, failed);
    }
}
