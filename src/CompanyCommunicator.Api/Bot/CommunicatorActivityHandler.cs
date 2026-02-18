using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Data.Entities;
using Microsoft.Agents.Builder;
using Microsoft.Agents.Builder.Compat;
using Microsoft.Agents.Core.Models;
using Microsoft.Agents.Extensions.Teams.Compat;
using Microsoft.Agents.Extensions.Teams.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Api.Bot;

/// <summary>
/// Unified bot activity handler for Company Communicator v2.
/// Handles both personal scope (user installation) and team scope (team installation)
/// lifecycle events by persisting tracking state to the database.
/// Extends <see cref="TeamsActivityHandler"/> from the M365 Agents SDK compatibility layer.
/// </summary>
internal sealed class CommunicatorActivityHandler : TeamsActivityHandler
{
    private readonly AppDbContext _db;
    private readonly ILogger<CommunicatorActivityHandler> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="CommunicatorActivityHandler"/>.
    /// </summary>
    /// <param name="db">The EF Core database context (scoped per-request).</param>
    /// <param name="logger">Logger.</param>
    public CommunicatorActivityHandler(AppDbContext db, ILogger<CommunicatorActivityHandler> logger)
    {
        _db = db;
        _logger = logger;
    }

    // -------------------------------------------------------------------------
    // Team-scope lifecycle events
    // -------------------------------------------------------------------------

    /// <summary>
    /// Called when members are added to a team in which the bot is installed.
    /// Persists the team record and updates User records for newly added members.
    /// </summary>
    protected override async Task OnTeamsMembersAddedAsync(
        IList<TeamsChannelAccount> membersAdded,
        TeamInfo teamInfo,
        ITurnContext<IConversationUpdateActivity> turnContext,
        CancellationToken cancellationToken)
    {
        var serviceUrl = turnContext.Activity.ServiceUrl;
        var tenantId = turnContext.Activity.Conversation.TenantId;
        var teamId = teamInfo?.Id ?? turnContext.Activity.Conversation.Id;

        // Upsert the team record.
        var team = await _db.Teams.FindAsync(new object[] { teamId }, cancellationToken)
            .ConfigureAwait(false);

        if (team is null)
        {
            team = new Team
            {
                TeamId = teamId,
                Name = teamInfo?.Name,
                ServiceUrl = serviceUrl,
                TenantId = tenantId,
                InstalledDate = DateTime.UtcNow,
            };
            _db.Teams.Add(team);
            _logger.LogInformation("Bot installed in team {TeamId} ({TeamName}).", teamId, teamInfo?.Name);
        }
        else
        {
            team.Name = teamInfo?.Name ?? team.Name;
            team.ServiceUrl = serviceUrl;
            team.TenantId = tenantId;
        }

        // Update user records for members added to the team (excluding the bot itself).
        foreach (var member in membersAdded)
        {
            if (string.IsNullOrEmpty(member.AadObjectId)) continue;

            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.AadId == member.AadObjectId, cancellationToken)
                .ConfigureAwait(false);

            if (user is null)
            {
                user = new User
                {
                    AadId = member.AadObjectId,
                    Name = member.Name,
                    Email = member.Email,
                    Upn = member.UserPrincipalName,
                    TenantId = tenantId,
                    ServiceUrl = serviceUrl,
                };
                _db.Users.Add(user);
            }
            else
            {
                user.Name ??= member.Name;
                user.Email ??= member.Email;
                user.ServiceUrl = serviceUrl;
                user.TenantId = tenantId;
            }
        }

        await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Called when members are removed from a team (including the bot itself being uninstalled).
    /// When the bot is removed, deletes the Team record.
    /// </summary>
    protected override async Task OnTeamsMembersRemovedAsync(
        IList<TeamsChannelAccount> membersRemoved,
        TeamInfo teamInfo,
        ITurnContext<IConversationUpdateActivity> turnContext,
        CancellationToken cancellationToken)
    {
        var teamId = teamInfo?.Id ?? turnContext.Activity.Conversation.Id;

        // Detect if the bot itself is being removed (bot's ID is in membersRemoved).
        // The bot account has no AadObjectId; check by recipient ID.
        var botId = turnContext.Activity.Recipient.Id;
        bool botRemoved = membersRemoved.Any(m =>
            string.Equals(m.Id, botId, StringComparison.OrdinalIgnoreCase));

        if (botRemoved)
        {
            var team = await _db.Teams.FindAsync(new object[] { teamId }, cancellationToken)
                .ConfigureAwait(false);

            if (team is not null)
            {
                _db.Teams.Remove(team);
                await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                _logger.LogInformation(
                    "Bot removed from team {TeamId}. Team record deleted.", teamId);
            }
        }
    }

    // -------------------------------------------------------------------------
    // Personal-scope lifecycle events
    // -------------------------------------------------------------------------

    /// <summary>
    /// Called when the bot is installed in a user's personal scope.
    /// Persists or updates the User record with conversation details.
    /// </summary>
    protected override async Task OnInstallationUpdateAddAsync(
        ITurnContext<IInstallationUpdateActivity> turnContext,
        CancellationToken cancellationToken)
    {
        // Personal scope has conversationType == "personal".
        if (!IsPersonalScope(turnContext.Activity))
        {
            await base.OnInstallationUpdateAddAsync(turnContext, cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        var aadId = turnContext.Activity.From.AadObjectId;
        if (string.IsNullOrEmpty(aadId))
        {
            _logger.LogWarning(
                "InstallationUpdate (add) received without AadObjectId. Skipping user upsert.");
            return;
        }

        var serviceUrl = turnContext.Activity.ServiceUrl;
        var tenantId = turnContext.Activity.Conversation.TenantId;
        var conversationId = turnContext.Activity.Conversation.Id;
        var userId = turnContext.Activity.From.Id;

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.AadId == aadId, cancellationToken)
            .ConfigureAwait(false);

        if (user is null)
        {
            user = new User
            {
                AadId = aadId,
                UserId = userId,
                ConversationId = conversationId,
                ServiceUrl = serviceUrl,
                TenantId = tenantId,
                Name = turnContext.Activity.From.Name,
            };
            _db.Users.Add(user);
            _logger.LogInformation("Bot installed for user {AadId}.", aadId);
        }
        else
        {
            user.UserId = userId;
            user.ConversationId = conversationId;
            user.ServiceUrl = serviceUrl;
            user.TenantId = tenantId;
            user.Name ??= turnContext.Activity.From.Name;
            _logger.LogInformation(
                "Bot re-installed for user {AadId}. Conversation updated.", aadId);
        }

        await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    /// <summary>
    /// Called when the bot is uninstalled from a user's personal scope.
    /// Clears the ConversationId on the User record (retains the user for re-installs).
    /// </summary>
    protected override async Task OnInstallationUpdateRemoveAsync(
        ITurnContext<IInstallationUpdateActivity> turnContext,
        CancellationToken cancellationToken)
    {
        if (!IsPersonalScope(turnContext.Activity))
        {
            await base.OnInstallationUpdateRemoveAsync(turnContext, cancellationToken)
                .ConfigureAwait(false);
            return;
        }

        var aadId = turnContext.Activity.From.AadObjectId;
        if (string.IsNullOrEmpty(aadId))
        {
            _logger.LogWarning(
                "InstallationUpdate (remove) received without AadObjectId. Skipping.");
            return;
        }

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.AadId == aadId, cancellationToken)
            .ConfigureAwait(false);

        if (user is not null)
        {
            // Retain the user record so historical data and re-install work correctly.
            user.ConversationId = null;
            await _db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            _logger.LogInformation(
                "Bot uninstalled for user {AadId}. ConversationId cleared.", aadId);
        }
    }

    // -------------------------------------------------------------------------
    // Personal-scope message handling
    // -------------------------------------------------------------------------

    /// <summary>
    /// Handles messages received in the personal bot chat.
    /// Responds with a brief informational message.
    /// </summary>
    protected override async Task OnMessageActivityAsync(
        ITurnContext<IMessageActivity> turnContext,
        CancellationToken cancellationToken)
    {
        if (!IsPersonalScope(turnContext.Activity)) return;

        var reply = MessageFactory.Text(
            "Company Communicator is running. Use the companion tab in Teams to " +
            "create and send announcements.");

        await turnContext.SendActivityAsync(reply, cancellationToken).ConfigureAwait(false);
    }

    // -------------------------------------------------------------------------
    // File consent (reserved for future export flow)
    // -------------------------------------------------------------------------

    /// <summary>
    /// Handles file consent acceptance. Reserved for future export download flow.
    /// </summary>
    protected override Task OnTeamsFileConsentAcceptAsync(
        ITurnContext<IInvokeActivity> turnContext,
        FileConsentCardResponse fileConsentCardResponse,
        CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "File consent accepted for upload destination: {UploadInfo}",
            fileConsentCardResponse.UploadInfo?.UploadUrl);
        return Task.CompletedTask;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private static bool IsPersonalScope(IActivity activity) =>
        string.Equals(
            activity.Conversation?.ConversationType,
            "personal",
            StringComparison.OrdinalIgnoreCase);
}
