namespace CompanyCommunicator.Core.Services.Bot;

/// <summary>
/// Abstraction for proactive bot messaging operations using the M365 Agents SDK.
/// Enables sending Adaptive Card notifications to individual Teams users.
/// </summary>
public interface IMessageSender
{
    /// <summary>
    /// Creates or retrieves a 1:1 conversation between the bot and a Teams user.
    /// </summary>
    /// <param name="tenantId">The AAD tenant ID of the user.</param>
    /// <param name="userId">The Teams-specific user ID (not AAD Object ID).</param>
    /// <param name="serviceUrl">The Bot Framework service URL for the user's region.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The Teams conversation ID that can be used for proactive messaging.</returns>
    Task<string> CreateConversationAsync(string tenantId, string userId, string serviceUrl, CancellationToken ct);

    /// <summary>
    /// Sends an Adaptive Card notification to an existing conversation.
    /// </summary>
    /// <param name="conversationId">The Teams conversation ID.</param>
    /// <param name="serviceUrl">The Bot Framework service URL for the user's region.</param>
    /// <param name="cardJson">The Adaptive Card JSON payload.</param>
    /// <param name="ct">Cancellation token.</param>
    Task SendNotificationAsync(string conversationId, string serviceUrl, string cardJson, CancellationToken ct);
}
