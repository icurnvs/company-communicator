using Microsoft.Agents.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Api.Bot;

/// <summary>
/// M365 Agents SDK middleware that rejects bot activities from tenants
/// other than the configured allowed tenant.
/// Prevents cross-tenant bot message injection.
/// </summary>
internal sealed class TenantFilterMiddleware : Microsoft.Agents.Builder.IMiddleware
{
    private readonly string _allowedTenantId;
    private readonly ILogger<TenantFilterMiddleware> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="TenantFilterMiddleware"/>.
    /// </summary>
    /// <param name="configuration">
    /// Application configuration. Reads <c>Bot:TenantId</c> as the allowed tenant.
    /// </param>
    /// <param name="logger">Logger.</param>
    public TenantFilterMiddleware(IConfiguration configuration, ILogger<TenantFilterMiddleware> logger)
    {
        _allowedTenantId = configuration["Bot:TenantId"]
            ?? throw new InvalidOperationException("Bot:TenantId is not configured.");
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task OnTurnAsync(
        ITurnContext turnContext,
        NextDelegate next,
        CancellationToken cancellationToken)
    {
        var incomingTenantId = turnContext.Activity.Conversation?.TenantId;

        if (!string.Equals(incomingTenantId, _allowedTenantId, StringComparison.OrdinalIgnoreCase))
        {
            _logger.LogWarning(
                "Rejecting activity from unauthorised tenant '{TenantId}'. Expected '{AllowedTenantId}'.",
                incomingTenantId, _allowedTenantId);

            // Return without invoking the next middleware — reject silently.
            return;
        }

        await next(cancellationToken).ConfigureAwait(false);
    }
}
