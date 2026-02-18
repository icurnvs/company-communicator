using System.Text.Json;
using CompanyCommunicator.Core.Services.Bot;
using Microsoft.Agents.Builder;
using Microsoft.Agents.Core.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Api.Services.Bot;

/// <summary>
/// M365 Agents SDK implementation of <see cref="IMessageSender"/>.
/// Handles proactive messaging by creating 1:1 conversations and sending
/// Adaptive Card activities using the Agents SDK ConnectorClient.
/// </summary>
internal sealed class MessageSender : IMessageSender
{
    private readonly IChannelServiceClientFactory _channelServiceClientFactory;
    private readonly string _botAppId;
    private readonly ILogger<MessageSender> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="MessageSender"/>.
    /// </summary>
    /// <param name="channelServiceClientFactory">
    /// Factory used to create authenticated connector client instances.
    /// Registered by the M365 Agents SDK hosting infrastructure (AddAgentCore).
    /// </param>
    /// <param name="configuration">Application configuration (reads Bot:AppId).</param>
    /// <param name="logger">Logger.</param>
    public MessageSender(
        IChannelServiceClientFactory channelServiceClientFactory,
        IConfiguration configuration,
        ILogger<MessageSender> logger)
    {
        _channelServiceClientFactory = channelServiceClientFactory;
        _botAppId = configuration["Bot:AppId"]
            ?? throw new InvalidOperationException("Bot:AppId is not configured.");
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task<string> CreateConversationAsync(
        string tenantId,
        string userId,
        string serviceUrl,
        CancellationToken ct)
    {
        var claimsIdentity = BuildBotClaimsIdentity(tenantId);

        // VERIFY: SDK pattern at runtime -- IChannelServiceClientFactory.CreateConnectorClientAsync
        // confirmed from XML: (ClaimsIdentity, serviceUrl, audience, CancellationToken, scopes, isAppOnly)
        var connectorClient = await _channelServiceClientFactory
            .CreateConnectorClientAsync(claimsIdentity, serviceUrl, serviceUrl, ct)
            .ConfigureAwait(false);

        // ConversationParameters uses 'Agent' (not 'Bot') in the Agents SDK.
        var botAccount = new ChannelAccount { Id = _botAppId };
        var userAccount = new ChannelAccount { Id = userId };

        var conversationParameters = new ConversationParameters
        {
            IsGroup = false,
            Agent = botAccount,
            Members = new List<ChannelAccount> { userAccount },
            TenantId = tenantId,
        };

        var conversationResource = await connectorClient.Conversations
            .CreateConversationAsync(conversationParameters, ct)
            .ConfigureAwait(false);

        var conversationId = conversationResource.Id;
        _logger.LogInformation(
            "Created conversation {ConversationId} for user {UserId} in tenant {TenantId}.",
            conversationId, userId, tenantId);

        return conversationId;
    }

    /// <inheritdoc/>
    public async Task SendNotificationAsync(
        string conversationId,
        string serviceUrl,
        string cardJson,
        CancellationToken ct)
    {
        var claimsIdentity = BuildBotClaimsIdentity(tenantId: null);

        var connectorClient = await _channelServiceClientFactory
            .CreateConnectorClientAsync(claimsIdentity, serviceUrl, serviceUrl, ct)
            .ConfigureAwait(false);

        // IConversations.SendToConversationAsync(IActivity, CancellationToken).
        // The conversation ID must be set on the activity's Conversation property.
        var activity = new Activity
        {
            Type = ActivityTypes.Message,
            Conversation = new ConversationAccount { Id = conversationId },
            Attachments = new List<Attachment>
            {
                new()
                {
                    ContentType = "application/vnd.microsoft.card.adaptive",
                    Content = JsonSerializer.Deserialize<object>(cardJson),
                }
            },
        };

        await connectorClient.Conversations
            .SendToConversationAsync(activity, ct)
            .ConfigureAwait(false);

        _logger.LogInformation(
            "Sent notification to conversation {ConversationId} via {ServiceUrl}.",
            conversationId, serviceUrl);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private System.Security.Claims.ClaimsIdentity BuildBotClaimsIdentity(string? tenantId)
    {
        var claims = new List<System.Security.Claims.Claim>
        {
            new(System.Security.Claims.ClaimTypes.NameIdentifier, _botAppId),
        };

        if (!string.IsNullOrEmpty(tenantId))
        {
            claims.Add(new System.Security.Claims.Claim("tid", tenantId));
        }

        return new System.Security.Claims.ClaimsIdentity(claims, "Bot");
    }
}
