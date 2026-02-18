using System.Collections.Concurrent;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Services.Blob;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CompanyCommunicator.Functions.Send.Services;

/// <summary>
/// Manages Bot Framework throttle state and Adaptive Card caching for the Send Function.
/// </summary>
/// <remarks>
/// <para>
/// Throttle state is persisted to SQL Server via <see cref="AppDbContext"/> using optimistic
/// concurrency (<see cref="Core.Data.Entities.ThrottleState.RowVersion"/>). When hundreds of
/// Consumption plan instances are running simultaneously, only the first writer wins; all others
/// catch <see cref="DbUpdateConcurrencyException"/> and discard -- the throttle is already
/// recorded, so no data is lost.
/// </para>
/// <para>
/// The Adaptive Card JSON is cached in a <see cref="ConcurrentDictionary{TKey,TValue}"/> that
/// is <c>static</c> so it survives across Function invocations within the same process lifetime.
/// This avoids repeated Blob Storage downloads when the same process handles thousands of
/// messages for the same notification.
/// </para>
/// </remarks>
public sealed class ThrottleManager
{
    // Static: survives across invocations in the same process / Function host instance.
    // Key = notificationId.ToString(), Value = Adaptive Card JSON.
    private static readonly ConcurrentDictionary<string, string> CardCache = new();

    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ThrottleManager> _logger;

    /// <summary>
    /// Initializes a new instance of <see cref="ThrottleManager"/>.
    /// </summary>
    /// <param name="serviceProvider">Root service provider used to create DI scopes for DB access.</param>
    /// <param name="logger">Logger.</param>
    public ThrottleManager(IServiceProvider serviceProvider, ILogger<ThrottleManager> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    /// <summary>
    /// Checks whether message sending is currently throttled at the global level.
    /// </summary>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>
    /// A tuple of (<c>IsThrottled</c>, <c>RetryAfterUtc</c>).
    /// <c>RetryAfterUtc</c> is non-null only when <c>IsThrottled</c> is <c>true</c>.
    /// </returns>
    public async Task<(bool IsThrottled, DateTime? RetryAfterUtc)> IsThrottledAsync(
        CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var state = await db.ThrottleState
            .FindAsync(new object[] { "global" }, ct)
            .ConfigureAwait(false);

        if (state?.RetryAfterUtc > DateTime.UtcNow)
        {
            return (true, state.RetryAfterUtc);
        }

        return (false, null);
    }

    /// <summary>
    /// Records a 429 throttle response by persisting the retry-after deadline to SQL Server.
    /// Uses optimistic concurrency -- concurrent updates from other instances are silently
    /// discarded because the throttle state they wrote is equivalent or newer.
    /// </summary>
    /// <param name="retryAfter">Duration to wait before retrying.</param>
    /// <param name="ct">Cancellation token.</param>
    public async Task RecordThrottleAsync(TimeSpan retryAfter, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var state = await db.ThrottleState
            .FindAsync(new object[] { "global" }, ct)
            .ConfigureAwait(false);

        if (state is null)
        {
            state = new Core.Data.Entities.ThrottleState { Id = "global" };
            db.ThrottleState.Add(state);
        }

        state.RetryAfterUtc = DateTime.UtcNow.Add(retryAfter);

        try
        {
            await db.SaveChangesAsync(ct).ConfigureAwait(false);
            _logger.LogWarning(
                "Throttle recorded. Sending paused until {RetryAfterUtc:O}.",
                state.RetryAfterUtc);
        }
        catch (DbUpdateConcurrencyException)
        {
            // Another Function instance beat us to recording the throttle.
            // The throttle is already persisted, so this is harmless.
            _logger.LogDebug(
                "ThrottleState concurrency conflict -- another instance already recorded the throttle.");
        }
    }

    /// <summary>
    /// Returns the Adaptive Card JSON for a notification.
    /// The result is cached in a <c>static</c> <see cref="ConcurrentDictionary{TKey,TValue}"/>
    /// so subsequent invocations in the same process skip the Blob Storage download.
    /// </summary>
    /// <param name="notificationId">The notification whose card to retrieve.</param>
    /// <param name="blobService">Blob service used on cache miss.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The card JSON, or <c>null</c> if the blob does not exist.</returns>
    public async Task<string?> GetCardJsonAsync(
        Guid notificationId,
        IBlobStorageService blobService,
        CancellationToken ct)
    {
        var cacheKey = notificationId.ToString();

        if (CardCache.TryGetValue(cacheKey, out var cached))
        {
            return cached;
        }

        var cardJson = await blobService
            .GetAdaptiveCardAsync(notificationId, ct)
            .ConfigureAwait(false);

        if (cardJson is not null)
        {
            // TryAdd is safe under concurrency -- worst case two instances both
            // download and the second's TryAdd is a no-op.
            CardCache.TryAdd(cacheKey, cardJson);
        }

        return cardJson;
    }
}
