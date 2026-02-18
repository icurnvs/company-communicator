using System.Security.Claims;
using System.Threading.RateLimiting;
using Azure.Identity;
using Azure.Messaging.ServiceBus;
using Azure.Storage.Blobs;
using CompanyCommunicator.Api.Authorization;
using CompanyCommunicator.Api.Bot;
using CompanyCommunicator.Api.Middleware;
using CompanyCommunicator.Api.Services.Bot;
using CompanyCommunicator.Api.Services.Queue;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Services;
using CompanyCommunicator.Core.Services.Bot;
using CompanyCommunicator.Core.Services.Queue;
using Microsoft.Agents.Authentication.Msal;
using Microsoft.Agents.Builder;
using Microsoft.Agents.Hosting.AspNetCore;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Graph;
using Microsoft.Identity.Web;
using Microsoft.Kiota.Authentication.Azure;

var builder = WebApplication.CreateBuilder(args);
var services = builder.Services;
var config = builder.Configuration;

// ---------------------------------------------------------------------------
// Application Insights
// ---------------------------------------------------------------------------
services.AddApplicationInsightsTelemetry();

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
var connectionString = config.GetConnectionString("SqlConnection")
    ?? throw new InvalidOperationException("ConnectionStrings:SqlConnection is not configured.");
services.AddAppDbContext(connectionString);

// ---------------------------------------------------------------------------
// M365 Agents SDK - Core infrastructure
// Registers: IConnections (from Connections config section),
//            IChannelServiceClientFactory, CloudAdapter, background activity processing.
// ---------------------------------------------------------------------------
builder.AddAgentCore();

// MSAL authentication for bot-to-Azure Bot Service token acquisition.
services.AddDefaultMsalAuth(config);

// Register the bot activity handler as IAgent (Compat-based TeamsActivityHandler).
// TenantFilterMiddleware is registered and picked up by CloudAdapter as IMiddleware.
services.AddTransient<IAgent, CommunicatorActivityHandler>();
services.AddSingleton<TenantFilterMiddleware>();

// ---------------------------------------------------------------------------
// Microsoft Identity Web - Teams SSO + OBO flow for REST API callers
// Configures JWT Bearer validation against the AzureAd section.
// EnableTokenAcquisitionToCallDownstreamApi enables OBO token exchange.
// ---------------------------------------------------------------------------
services.AddMicrosoftIdentityWebApiAuthentication(config, "AzureAd")
    .EnableTokenAcquisitionToCallDownstreamApi()
    .AddInMemoryTokenCaches();

// ---------------------------------------------------------------------------
// Microsoft Graph client
// Using DefaultAzureCredential which works with both MSI and local dev.
// The GraphServiceClient is registered as singleton - it is thread-safe.
// ---------------------------------------------------------------------------
var azureCredential = new DefaultAzureCredential();
var graphScopes = new[] { "https://graph.microsoft.com/.default" };
var authProvider = new AzureIdentityAuthenticationProvider(azureCredential, scopes: graphScopes);
services.AddSingleton(new GraphServiceClient(authProvider));

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------
services.AddCompanyCommunicatorAuthorization(config);

// ---------------------------------------------------------------------------
// Azure SDK clients
// ---------------------------------------------------------------------------

// Service Bus
var serviceBusNamespace = config["ServiceBus:FullyQualifiedNamespace"]
    ?? throw new InvalidOperationException("ServiceBus:FullyQualifiedNamespace is not configured.");
var serviceBusClient = new ServiceBusClient(serviceBusNamespace, azureCredential);
services.AddSingleton(serviceBusClient);

// Register the sender factory that wraps all three queue senders.
services.AddSingleton<IServiceBusSenderFactory>(
    new ServiceBusSenderFactory(serviceBusClient));

// Blob Storage — construct the blob endpoint URI from the storage account name
var storageAccountName = config["Storage:AccountName"]
    ?? throw new InvalidOperationException("Storage:AccountName is not configured.");
var blobServiceUri = new Uri($"https://{storageAccountName}.blob.core.windows.net");
services.AddSingleton(new BlobServiceClient(blobServiceUri, azureCredential));

// ---------------------------------------------------------------------------
// Core services (Graph, ServiceBus, Blob, Recipients)
// ---------------------------------------------------------------------------
services.AddCoreServices();

// IMessageSender lives in the Api project (depends on Agents SDK IChannelServiceClientFactory).
services.AddScoped<IMessageSender, MessageSender>();

// ---------------------------------------------------------------------------
// Rate limiting - write operations: 10 requests per minute per authenticated user
// ---------------------------------------------------------------------------
services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter("write", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
    });

    // Partition by the authenticated user's OID so limits are per-user
    options.AddPolicy("write", httpContext =>
    {
        var userId = httpContext.User.FindFirstValue("oid")
            ?? httpContext.User.FindFirstValue(
                "http://schemas.microsoft.com/identity/claims/objectidentifier")
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "anonymous";

        return RateLimitPartition.GetFixedWindowLimiter(userId, _ =>
            new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            });
    });
});

// ---------------------------------------------------------------------------
// Health checks (built-in ASP.NET Core health check, no external package needed)
// ---------------------------------------------------------------------------
services.AddHealthChecks();

// ---------------------------------------------------------------------------
// ASP.NET Core infrastructure
// ---------------------------------------------------------------------------
services.AddControllers();
services.AddEndpointsApiExplorer();

// ---------------------------------------------------------------------------
// Build the application
// ---------------------------------------------------------------------------
var app = builder.Build();

// ---------------------------------------------------------------------------
// Middleware pipeline
// ---------------------------------------------------------------------------
app.UseSecurityHeaders();
app.UseHttpsRedirection();

// ---------------------------------------------------------------------------
// Serve the React SPA from /clientapp/
// The dist folder is produced by `npm run build` in ClientApp/
// In development, the Vite dev server proxies to /api, so only the production
// build needs to be served here.
// ---------------------------------------------------------------------------
var spaPath = Path.Combine(app.Environment.ContentRootPath, "ClientApp", "dist");
if (Directory.Exists(spaPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(spaPath),
        RequestPath = "/clientapp",
    });

    // Fallback: for any /clientapp/* route that doesn't match a file,
    // serve index.html (React Router handles routing client-side).
    app.MapFallback("/clientapp/{**path}", async context =>
    {
        var indexPath = Path.Combine(spaPath, "index.html");
        if (File.Exists(indexPath))
        {
            context.Response.ContentType = "text/html";
            await context.Response.SendFileAsync(indexPath);
        }
        else
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
        }
    });
}

app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
app.MapControllers();

// Bot endpoint: POST /api/messages
// requireAuth=true validates the bearer token from Azure Bot Service.
app.MapAgentEndpoints(requireAuth: true);

// Health check endpoints
app.MapHealthChecks("/health/ready");
app.MapHealthChecks("/health/live");

app.Run();

// Expose for integration tests
public partial class Program { }
