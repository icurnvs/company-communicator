using CompanyCommunicator.Core.Services.Blob;
using CompanyCommunicator.Core.Services.Cards;
using CompanyCommunicator.Core.Services.Graph;
using CompanyCommunicator.Core.Services.Queue;
using CompanyCommunicator.Core.Services.Recipients;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Graph.Models.ODataErrors;
using Polly;
using Polly.Registry;

namespace CompanyCommunicator.Core.Services;

/// <summary>
/// DI extension methods to register Core service implementations that do not
/// depend on the M365 Agents SDK (i.e. all services except <see cref="Bot.IMessageSender"/>).
/// <see cref="Bot.IMessageSender"/> must be registered by the host project (Api) because
/// it depends on <c>IChannelServiceClientFactory</c> from the Agents SDK.
/// </summary>
public static class CoreServicesExtensions
{
    /// <summary>
    /// Registers Graph, Service Bus, Blob, and Recipient services together with
    /// the Polly 8 resilience pipeline used by <see cref="GraphService"/>.
    /// </summary>
    public static IServiceCollection AddCoreServices(this IServiceCollection services)
    {
        // Graph resilience pipeline: exponential retry + circuit breaker.
        services.AddResiliencePipeline("graph", builder =>
        {
            builder
                .AddRetry(new Polly.Retry.RetryStrategyOptions
                {
                    MaxRetryAttempts = 4,
                    BackoffType = DelayBackoffType.Exponential,
                    UseJitter = true,
                    Delay = TimeSpan.FromSeconds(2),
                    ShouldHandle = new PredicateBuilder()
                        .Handle<ODataError>(e =>
                            e.ResponseStatusCode is 429 or 503 or 504)
                        .Handle<HttpRequestException>(),
                })
                .AddCircuitBreaker(new Polly.CircuitBreaker.CircuitBreakerStrategyOptions
                {
                    FailureRatio = 0.5,
                    SamplingDuration = TimeSpan.FromSeconds(30),
                    MinimumThroughput = 5,
                    BreakDuration = TimeSpan.FromSeconds(30),
                    ShouldHandle = new PredicateBuilder()
                        .Handle<ODataError>(e =>
                            e.ResponseStatusCode is 429 or 503 or 504)
                        .Handle<HttpRequestException>(),
                });
        });

        // Graph service - resolve the named resilience pipeline at construction time.
        services.AddScoped<IGraphService>(sp =>
        {
            var graphClient = sp.GetRequiredService<Microsoft.Graph.GraphServiceClient>();
            var resilienceProvider = sp.GetRequiredService<ResiliencePipelineProvider<string>>();
            var pipeline = resilienceProvider.GetPipeline("graph");
            var logger = sp.GetRequiredService<ILogger<GraphService>>();
            return new GraphService(graphClient, pipeline, logger);
        });

        // Service Bus service.
        services.AddScoped<IServiceBusService, ServiceBusService>();

        // Blob storage service.
        services.AddScoped<IBlobStorageService, BlobStorageService>();

        // Recipient service.
        services.AddScoped<IRecipientService, RecipientService>();

        // Adaptive Card builder - stateless, safe as singleton.
        services.AddSingleton<IAdaptiveCardService, AdaptiveCardService>();

        return services;
    }
}
