using CompanyCommunicator.Functions.Prep.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Prep.Activities;

public sealed class GetInstallConfigActivity
{
    private readonly IConfiguration _config;
    private readonly ILogger<GetInstallConfigActivity> _logger;

    public GetInstallConfigActivity(IConfiguration config, ILogger<GetInstallConfigActivity> logger)
    {
        _config = config;
        _logger = logger;
    }

    [Function(nameof(GetInstallConfigActivity))]
    public Task<InstallConfig> RunActivity(
        [ActivityTrigger] Guid notificationId,
        FunctionContext ctx)
    {
        var teamsAppId = _config["Bot:TeamsAppId"] ?? string.Empty;

        if (!string.IsNullOrEmpty(teamsAppId) && !Guid.TryParse(teamsAppId, out _))
        {
            throw new InvalidOperationException(
                $"Bot:TeamsAppId '{teamsAppId}' is not a valid GUID. " +
                "Set it to a valid Entra app registration client ID, or leave it empty to disable proactive installation.");
        }

        int waitSeconds = int.TryParse(_config["Bot:InstallWaitSeconds"], out var ws) && ws > 0 ? ws : 60;
        int maxAttempts = int.TryParse(_config["Bot:MaxRefreshAttempts"], out var ma) && ma > 0 ? ma : 20;

        _logger.LogInformation(
            "GetInstallConfigActivity: Notification {NotificationId} — " +
            "TeamsAppId={TeamsAppId}, Wait={Wait}s, MaxAttempts={Max}.",
            notificationId,
            string.IsNullOrEmpty(teamsAppId) ? "(disabled)" : teamsAppId,
            waitSeconds, maxAttempts);

        return Task.FromResult(new InstallConfig(teamsAppId, waitSeconds, maxAttempts));
    }
}
