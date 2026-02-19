using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;
using CompanyCommunicator.Core.Services.Bot;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Send.Services.Bot;

/// <summary>
/// Send-Function implementation of <see cref="IMessageSender"/>.
/// Uses raw HTTP calls to the Bot Framework Connector REST API with a token
/// obtained via <see cref="DefaultAzureCredential"/> (Managed Identity in Azure,
/// or local developer credential at dev time).
/// This avoids taking a dependency on <c>Microsoft.Agents.Hosting.AspNetCore</c>
/// which carries ASP.NET Core infrastructure incompatible with the isolated Functions worker.
/// </summary>
internal sealed class SendFunctionMessageSender : IMessageSender
{
    // Bot Framework channel service token scope (Bot Framework REST API audience).
    private const string BotFrameworkScope = "https://api.botframework.com/.default";

    // Static shared HttpClient - reused across all invocations within the same process.
    // SocketsHttpHandler manages connection pooling automatically.
    private static readonly HttpClient Http = new(new SocketsHttpHandler
    {
        PooledConnectionLifetime = TimeSpan.FromMinutes(5),
    });

    private readonly TokenCredential _botCredential;
    private readonly string _botAppId;
    private readonly ILogger<SendFunctionMessageSender> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="SendFunctionMessageSender"/>.
    /// </summary>
    /// <param name="configuration">Application configuration (reads Bot:TenantId, Bot:AppId, Bot:AppSecret).</param>
    /// <param name="logger">Logger.</param>
    /// <remarks>
    /// Bot Framework validates that the JWT bearer token's <c>appid</c> claim matches the registered
    /// bot's Microsoft App ID. A managed identity token carries the MI's client ID as <c>appid</c>,
    /// not the bot's app registration ID, so managed identity cannot be used here. A
    /// <see cref="ClientSecretCredential"/> using the bot's own client credentials is required.
    /// </remarks>
    public SendFunctionMessageSender(
        IConfiguration configuration,
        ILogger<SendFunctionMessageSender> logger)
    {
        var tenantId = configuration["Bot:TenantId"]
            ?? throw new InvalidOperationException("Bot:TenantId is not configured.");
        _botAppId = configuration["Bot:AppId"]
            ?? throw new InvalidOperationException("Bot:AppId is not configured.");
        var clientSecret = configuration["Bot:AppSecret"]
            ?? throw new InvalidOperationException("Bot:AppSecret is not configured.");

        // ClientSecretCredential so that the acquired JWT has appid == bot's App ID,
        // which is what the Bot Framework connector service validates.
        _botCredential = new ClientSecretCredential(tenantId, _botAppId, clientSecret);
        _logger = logger;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// Creates a new 1:1 conversation via
    /// <c>POST {serviceUrl}/v3/conversations</c>.
    /// </remarks>
    public async Task<string> CreateConversationAsync(
        string tenantId,
        string userId,
        string serviceUrl,
        CancellationToken ct)
    {
        var token = await GetBotTokenAsync(ct).ConfigureAwait(false);
        var endpoint = BuildEndpoint(serviceUrl, "v3/conversations");

        var payload = new
        {
            isGroup = false,
            bot = new { id = _botAppId },
            members = new[] { new { id = userId } },
            tenantId,
            channelData = new { tenant = new { id = tenantId } },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
        await EnsureSuccessAsync(response, "CreateConversation", ct).ConfigureAwait(false);

        var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        using var doc = JsonDocument.Parse(body);
        var conversationId = doc.RootElement.GetProperty("id").GetString()
            ?? throw new InvalidOperationException(
                "Bot Framework returned a CreateConversation response with no 'id' field.");

        _logger.LogInformation(
            "Created conversation {ConversationId} for user {UserId} in tenant {TenantId}.",
            conversationId, userId, tenantId);

        return conversationId;
    }

    /// <inheritdoc/>
    /// <remarks>
    /// Sends an Adaptive Card activity via
    /// <c>POST {serviceUrl}/v3/conversations/{conversationId}/activities</c>.
    /// </remarks>
    public async Task SendNotificationAsync(
        string conversationId,
        string serviceUrl,
        string cardJson,
        CancellationToken ct)
    {
        var token = await GetBotTokenAsync(ct).ConfigureAwait(false);
        var endpoint = BuildEndpoint(
            serviceUrl,
            $"v3/conversations/{Uri.EscapeDataString(conversationId)}/activities");

        // Parse the card JSON to embed as a structured object, not a string-within-string.
        using var cardDoc = JsonDocument.Parse(cardJson);
        var cardContent = cardDoc.RootElement.Clone();

        var payload = new
        {
            type = "message",
            conversation = new { id = conversationId },
            attachments = new[]
            {
                new
                {
                    contentType = "application/vnd.microsoft.card.adaptive",
                    content = cardContent,
                }
            },
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new StringContent(
                JsonSerializer.Serialize(payload),
                Encoding.UTF8,
                "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await Http.SendAsync(request, ct).ConfigureAwait(false);
        await EnsureSuccessAsync(response, "SendToConversation", ct).ConfigureAwait(false);

        _logger.LogInformation(
            "Sent Adaptive Card to conversation {ConversationId} via {ServiceUrl}.",
            conversationId, serviceUrl);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private async Task<string> GetBotTokenAsync(CancellationToken ct)
    {
        var tokenRequest = new TokenRequestContext(new[] { BotFrameworkScope });
        var tokenResult = await _botCredential
            .GetTokenAsync(tokenRequest, ct)
            .ConfigureAwait(false);

        return tokenResult.Token;
    }

    /// <summary>
    /// Normalises <paramref name="serviceUrl"/> and appends <paramref name="path"/>.
    /// Ensures exactly one slash between host and path segments.
    /// </summary>
    private static string BuildEndpoint(string serviceUrl, string path)
    {
        var baseUrl = serviceUrl.TrimEnd('/');
        return $"{baseUrl}/{path}";
    }

    /// <summary>
    /// Reads the response and throws an <see cref="HttpRequestException"/> for non-success
    /// status codes, preserving the HTTP status code so callers can detect 429/404.
    /// </summary>
    private static async Task EnsureSuccessAsync(
        HttpResponseMessage response,
        string operationName,
        CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;

        var body = await response.Content.ReadAsStringAsync(ct).ConfigureAwait(false);

        // Throw with the status code embedded so SendMessageFunction can inspect it.
        throw new HttpRequestException(
            $"Bot Framework {operationName} failed with {(int)response.StatusCode} {response.ReasonPhrase}. Body: {body}",
            inner: null,
            statusCode: response.StatusCode);
    }
}
