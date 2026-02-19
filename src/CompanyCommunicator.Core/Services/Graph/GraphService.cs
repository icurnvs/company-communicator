using CompanyCommunicator.Core.Data.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.Graph;
using Microsoft.Graph.Models.ODataErrors;
using Microsoft.Graph.Users.Delta;
using Polly;

namespace CompanyCommunicator.Core.Services.Graph;

/// <summary>
/// Microsoft Graph v5 implementation of <see cref="IGraphService"/>.
/// Uses OData delta queries for incremental user sync and handles pagination
/// transparently. Applies a Polly resilience pipeline for 429/503/504 responses.
/// </summary>
internal sealed class GraphService : IGraphService
{
    // The Teams service plan ID used to determine HasTeamsLicense.
    private static readonly Guid TeamsPlanId = new("57ff2da0-773e-42df-b2af-ffb7a2317929");

    private readonly GraphServiceClient _graphClient;
    private readonly ResiliencePipeline _resilience;
    private readonly ILogger<GraphService> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="GraphService"/>.
    /// </summary>
    /// <param name="graphClient">The Graph SDK v5 client.</param>
    /// <param name="resilience">Polly resilience pipeline keyed "graph".</param>
    /// <param name="logger">Logger.</param>
    public GraphService(
        GraphServiceClient graphClient,
        ResiliencePipeline resilience,
        ILogger<GraphService> logger)
    {
        _graphClient = graphClient;
        _resilience = resilience;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<User>> GetAllUsersAsync(string? deltaLink, CancellationToken ct)
    {
        var users = new List<User>();

        await _resilience.ExecuteAsync(async token =>
        {
            var page = await _graphClient.Users.GetAsync(config =>
            {
                config.QueryParameters.Select = new[]
                {
                    "id", "displayName", "mail", "userPrincipalName",
                    "userType", "assignedPlans"
                };
                config.QueryParameters.Filter = "accountEnabled eq true";
            }, token).ConfigureAwait(false);

            while (page is not null)
            {
                if (page.Value is not null)
                {
                    users.AddRange(page.Value.Select(MapToEntity));
                }

                if (page.OdataNextLink is null) break;

                page = await _graphClient.Users
                    .WithUrl(page.OdataNextLink)
                    .GetAsync(cancellationToken: token)
                    .ConfigureAwait(false);
            }
        }, ct).ConfigureAwait(false);

        _logger.LogInformation("GraphService.GetAllUsersAsync returned {Count} users.", users.Count);
        return users;
    }

    /// <inheritdoc/>
    public async Task<(IReadOnlyList<User> Users, string? NewDeltaLink)> GetAllUsersDeltaAsync(
        string? deltaLink,
        CancellationToken ct)
    {
        var users = new List<User>();
        string? newDeltaLink = null;

        await _resilience.ExecuteAsync(async token =>
        {
            users.Clear();
            newDeltaLink = null;

            try
            {
                if (string.IsNullOrEmpty(deltaLink))
                {
                    // Start a fresh delta cycle using GetAsDeltaGetResponseAsync.
                    var deltaResponse = await _graphClient.Users.Delta
                        .GetAsDeltaGetResponseAsync(config =>
                        {
                            config.QueryParameters.Select = new[]
                            {
                                "id", "displayName", "mail", "userPrincipalName",
                                "userType", "assignedPlans"
                            };
                        }, token)
                        .ConfigureAwait(false);

                    await PageThroughDeltaResponseAsync(deltaResponse, users, token,
                        link => newDeltaLink = link).ConfigureAwait(false);

                    return;
                }

                // Resume from existing delta link using WithUrl + GetAsDeltaGetResponseAsync.
                var resumeResponse = await _graphClient.Users.Delta
                    .WithUrl(deltaLink)
                    .GetAsDeltaGetResponseAsync(cancellationToken: token)
                    .ConfigureAwait(false);

                await PageThroughDeltaResponseAsync(resumeResponse, users, token,
                    link => newDeltaLink = link).ConfigureAwait(false);
            }
            catch (ODataError odataError)
                when (odataError.ResponseStatusCode == 410) // Gone - delta link expired
            {
                _logger.LogWarning(
                    "Delta link expired (HTTP 410). Next call will start a fresh sync.");
                users.Clear();
                newDeltaLink = null;
            }
        }, ct).ConfigureAwait(false);

        _logger.LogInformation(
            "GraphService.GetAllUsersDeltaAsync returned {Count} changed users.", users.Count);
        return (users, newDeltaLink);
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<User>> GetTeamMembersAsync(string teamId, CancellationToken ct)
    {
        var users = new List<User>();

        await _resilience.ExecuteAsync(async token =>
        {
            var page = await _graphClient.Teams[teamId].Members
                .GetAsync(cancellationToken: token)
                .ConfigureAwait(false);

            while (page is not null)
            {
                if (page.Value is not null)
                {
                    foreach (var member in page.Value)
                    {
                        if (member is Microsoft.Graph.Models.AadUserConversationMember aadMember)
                        {
                            users.Add(new User
                            {
                                AadId = aadMember.UserId ?? string.Empty,
                                Name = aadMember.DisplayName,
                                Email = aadMember.Email,
                                UserType = "Member",
                            });
                        }
                    }
                }

                if (page.OdataNextLink is null) break;

                page = await _graphClient.Teams[teamId].Members
                    .WithUrl(page.OdataNextLink)
                    .GetAsync(cancellationToken: token)
                    .ConfigureAwait(false);
            }
        }, ct).ConfigureAwait(false);

        _logger.LogInformation(
            "GraphService.GetTeamMembersAsync returned {Count} members for team {TeamId}.",
            users.Count, teamId);
        return users;
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<User>> GetGroupMembersAsync(string groupId, CancellationToken ct)
    {
        var users = new List<User>();

        await _resilience.ExecuteAsync(async token =>
        {
            var page = await _graphClient.Groups[groupId].Members
                .GetAsync(cancellationToken: token)
                .ConfigureAwait(false);

            while (page is not null)
            {
                if (page.Value is not null)
                {
                    foreach (var member in page.Value)
                    {
                        if (member is Microsoft.Graph.Models.User graphUser)
                        {
                            users.Add(MapToEntity(graphUser));
                        }
                    }
                }

                if (page.OdataNextLink is null) break;

                page = await _graphClient.Groups[groupId].Members
                    .WithUrl(page.OdataNextLink)
                    .GetAsync(cancellationToken: token)
                    .ConfigureAwait(false);
            }
        }, ct).ConfigureAwait(false);

        _logger.LogInformation(
            "GraphService.GetGroupMembersAsync returned {Count} members for group {GroupId}.",
            users.Count, groupId);
        return users;
    }

    /// <inheritdoc/>
    public async Task<string> GetUserPhotoBase64Async(string userId, CancellationToken ct)
    {
        try
        {
            await using var photoStream = await _resilience.ExecuteAsync(async token =>
                await _graphClient.Users[userId].Photo.Content
                    .GetAsync(cancellationToken: token)
                    .ConfigureAwait(false), ct).ConfigureAwait(false);

            if (photoStream is null) return string.Empty;

            using var ms = new MemoryStream();
            await photoStream.CopyToAsync(ms, ct).ConfigureAwait(false);
            return Convert.ToBase64String(ms.ToArray());
        }
        catch (ODataError odataError) when (odataError.ResponseStatusCode == 404)
        {
            _logger.LogDebug("No photo found for user {UserId}.", userId);
            return string.Empty;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to retrieve photo for user {UserId}.", userId);
            return string.Empty;
        }
    }

    /// <inheritdoc/>
    public async Task<IReadOnlyList<(string Id, string DisplayName)>> SearchGroupsAsync(
        string query,
        CancellationToken ct)
    {
        var results = new List<(string Id, string DisplayName)>();

        await _resilience.ExecuteAsync(async token =>
        {
            // Sanitize the query to prevent OData injection: strip single quotes.
            var sanitizedQuery = query.Replace("'", string.Empty, StringComparison.Ordinal);

            var page = await _graphClient.Groups.GetAsync(config =>
            {
                config.QueryParameters.Filter =
                    $"startswith(displayName,'{sanitizedQuery}')";
                config.QueryParameters.Select = new[] { "id", "displayName" };
                config.QueryParameters.Top = 25;
            }, token).ConfigureAwait(false);

            if (page?.Value is not null)
            {
                foreach (var group in page.Value)
                {
                    if (group.Id is not null && group.DisplayName is not null)
                    {
                        results.Add((group.Id, group.DisplayName));
                    }
                }
            }
        }, ct).ConfigureAwait(false);

        _logger.LogInformation(
            "GraphService.SearchGroupsAsync found {Count} groups for query '{Query}'.",
            results.Count, query);

        return results;
    }

    /// <inheritdoc/>
    public async Task<bool> InstallAppForUserAsync(string userAadId, string teamsAppId, CancellationToken ct)
    {
        if (!Guid.TryParse(userAadId, out _))
            throw new ArgumentException($"userAadId must be a valid GUID, got: '{userAadId}'", nameof(userAadId));
        if (!Guid.TryParse(teamsAppId, out _))
            throw new ArgumentException($"teamsAppId must be a valid GUID, got: '{teamsAppId}'", nameof(teamsAppId));

        try
        {
            await _resilience.ExecuteAsync(async token =>
            {
                var requestBody = new Microsoft.Graph.Models.UserScopeTeamsAppInstallation
                {
                    AdditionalData = new Dictionary<string, object>
                    {
                        ["teamsApp@odata.bind"] =
                            $"https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/{teamsAppId}",
                    },
                };

                await _graphClient.Users[userAadId].Teamwork.InstalledApps
                    .PostAsync(requestBody, cancellationToken: token)
                    .ConfigureAwait(false);
            }, ct).ConfigureAwait(false);

            _logger.LogDebug(
                "InstallAppForUserAsync: Successfully installed app for user {UserAadId}.",
                userAadId);
            return true;
        }
        catch (ODataError odataError) when (odataError.ResponseStatusCode == 409)
        {
            // 409 Conflict = app already installed. Idempotent on Durable replay.
            _logger.LogDebug(
                "InstallAppForUserAsync: App already installed for user {UserAadId}.",
                userAadId);
            return true;
        }
        catch (ODataError odataError) when (odataError.ResponseStatusCode is 403 or 404)
        {
            // 403 = admin policy blocks install; 404 = user not found or no Teams license.
            _logger.LogWarning(
                "InstallAppForUserAsync: Cannot install for user {UserAadId}. Status={StatusCode}, Code={ErrorCode}, Message={ErrorMessage}",
                userAadId, odataError.ResponseStatusCode,
                odataError.Error?.Code, odataError.Error?.Message);
            return false;
        }
        catch (Polly.CircuitBreaker.BrokenCircuitException)
        {
            // v3-H1: Rethrow circuit-open exceptions so the Durable Functions activity-level
            // retry policy (TaskRetryOptions) can handle them.
            throw;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex,
                "InstallAppForUserAsync: Unexpected error for user {UserAadId}.",
                userAadId);
            return false;
        }
    }

    /// <inheritdoc/>
    public async Task<string?> GetPersonalChatIdAsync(string userAadId, string teamsAppId, CancellationToken ct)
    {
        if (!Guid.TryParse(userAadId, out _))
            throw new ArgumentException($"userAadId must be a valid GUID, got: '{userAadId}'", nameof(userAadId));
        if (!Guid.TryParse(teamsAppId, out _))
            throw new ArgumentException($"teamsAppId must be a valid GUID, got: '{teamsAppId}'", nameof(teamsAppId));

        try
        {
            // Step 1: Find the installation record for this specific app.
            // Use the OData filter to scope to our app only.
            var installations = await _resilience.ExecuteAsync(async token =>
                await _graphClient.Users[userAadId].Teamwork.InstalledApps
                    .GetAsync(config =>
                    {
                        config.QueryParameters.Filter = $"teamsApp/id eq '{teamsAppId}'";
                        config.QueryParameters.Expand = new[] { "teamsApp($select=id)" };
                    }, token)
                    .ConfigureAwait(false), ct).ConfigureAwait(false);

            var installation = installations?.Value?.FirstOrDefault();
            if (installation?.Id is null)
            {
                _logger.LogDebug(
                    "GetPersonalChatIdAsync: No installation found for user {UserAadId} with app {TeamsAppId}.",
                    userAadId, teamsAppId);
                return null;
            }

            // Step 2: Retrieve the personal chat for this installation.
            // GET /users/{id}/teamwork/installedApps/{installId}/chat
            var chat = await _resilience.ExecuteAsync(async token =>
                await _graphClient.Users[userAadId].Teamwork.InstalledApps[installation.Id].Chat
                    .GetAsync(cancellationToken: token)
                    .ConfigureAwait(false), ct).ConfigureAwait(false);

            _logger.LogDebug(
                "GetPersonalChatIdAsync: Retrieved chat {ChatId} for user {UserAadId}.",
                chat?.Id, userAadId);

            return chat?.Id;
        }
        catch (ODataError odataError) when (odataError.ResponseStatusCode is 404 or 403)
        {
            _logger.LogDebug(
                "GetPersonalChatIdAsync: Chat not available for user {UserAadId}. Status={Status}.",
                userAadId, odataError.ResponseStatusCode);
            return null;
        }
        catch (Polly.CircuitBreaker.BrokenCircuitException)
        {
            throw;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex,
                "GetPersonalChatIdAsync: Unexpected error getting chat for user {UserAadId}.",
                userAadId);
            return null;
        }
    }

    /// <inheritdoc/>
    public async Task<bool> InstallAppInTeamAsync(string teamGroupId, string teamsAppId, CancellationToken ct)
    {
        if (!Guid.TryParse(teamGroupId, out _))
            throw new ArgumentException($"teamGroupId must be a valid GUID, got: '{teamGroupId}'", nameof(teamGroupId));
        if (!Guid.TryParse(teamsAppId, out _))
            throw new ArgumentException($"teamsAppId must be a valid GUID, got: '{teamsAppId}'", nameof(teamsAppId));

        try
        {
            await _resilience.ExecuteAsync(async token =>
            {
                // Team-scope uses TeamsAppInstallation (not UserScopeTeamsAppInstallation).
                var requestBody = new Microsoft.Graph.Models.TeamsAppInstallation
                {
                    AdditionalData = new Dictionary<string, object>
                    {
                        ["teamsApp@odata.bind"] =
                            $"https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/{teamsAppId}",
                    },
                };

                await _graphClient.Teams[teamGroupId].InstalledApps
                    .PostAsync(requestBody, cancellationToken: token)
                    .ConfigureAwait(false);
            }, ct).ConfigureAwait(false);

            _logger.LogDebug(
                "InstallAppInTeamAsync: Successfully installed app in team {TeamGroupId}.",
                teamGroupId);
            return true;
        }
        catch (ODataError odataError) when (odataError.ResponseStatusCode == 409)
        {
            _logger.LogDebug(
                "InstallAppInTeamAsync: App already installed in team {TeamGroupId}.",
                teamGroupId);
            return true;
        }
        catch (ODataError odataError) when (odataError.ResponseStatusCode is 403 or 404)
        {
            _logger.LogWarning(
                "InstallAppInTeamAsync: Cannot install in team {TeamGroupId}. Status={StatusCode}, Code={ErrorCode}, Message={ErrorMessage}",
                teamGroupId, odataError.ResponseStatusCode,
                odataError.Error?.Code, odataError.Error?.Message);
            return false;
        }
        catch (Polly.CircuitBreaker.BrokenCircuitException)
        {
            throw;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex,
                "InstallAppInTeamAsync: Unexpected error for team {TeamGroupId}.",
                teamGroupId);
            return false;
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /// <summary>
    /// Pages through a <see cref="DeltaGetResponse"/>, collecting users and
    /// capturing the final delta link when the last page is reached.
    /// </summary>
    private async Task PageThroughDeltaResponseAsync(
        DeltaGetResponse? response,
        List<User> users,
        CancellationToken ct,
        Action<string> onDeltaLink)
    {
        while (response is not null)
        {
            if (response.Value is not null)
            {
                users.AddRange(response.Value.Select(MapToEntity));
            }

            // OdataDeltaLink is present on the last page of a delta request.
            if (response.OdataDeltaLink is not null)
            {
                onDeltaLink(response.OdataDeltaLink);
                break;
            }

            if (response.OdataNextLink is null) break;

            // Fetch the next page using the nextLink URL.
            response = await _graphClient.Users.Delta
                .WithUrl(response.OdataNextLink)
                .GetAsDeltaGetResponseAsync(cancellationToken: ct)
                .ConfigureAwait(false);
        }
    }

    private static User MapToEntity(Microsoft.Graph.Models.User graphUser)
    {
        bool hasTeamsLicense = graphUser.AssignedPlans?
            .Any(p => p.ServicePlanId == TeamsPlanId
                      && string.Equals(p.CapabilityStatus, "Enabled",
                          StringComparison.OrdinalIgnoreCase)) ?? false;

        return new User
        {
            AadId = graphUser.Id ?? string.Empty,
            Name = graphUser.DisplayName,
            Email = graphUser.Mail,
            Upn = graphUser.UserPrincipalName,
            UserType = graphUser.UserType,
            HasTeamsLicense = hasTeamsLicense,
            LastSyncedDate = DateTime.UtcNow,
        };
    }
}
