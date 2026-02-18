using Azure.Identity;
using Azure.Messaging.ServiceBus;
using Azure.Storage.Blobs;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Services;
using CompanyCommunicator.Core.Services.Bot;
using CompanyCommunicator.Core.Services.Queue;
using CompanyCommunicator.Functions.Send.Services;
using CompanyCommunicator.Functions.Send.Services.Bot;
using CompanyCommunicator.Functions.Send.Services.Queue;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Graph;
using Microsoft.Kiota.Authentication.Azure;

var host = new HostBuilder()
    .ConfigureFunctionsWorkerDefaults()
    .ConfigureServices((ctx, services) =>
    {
        var config = ctx.Configuration;

        // -----------------------------------------------------------------------
        // Database
        // -----------------------------------------------------------------------
        services.AddAppDbContext(
            config.GetConnectionString("SqlConnection")
            ?? throw new InvalidOperationException(
                "ConnectionStrings:SqlConnection is not configured."));

        // -----------------------------------------------------------------------
        // Azure credential (Managed Identity in Azure, dev credential locally)
        // Explicitly pass ManagedIdentityClientId for user-assigned MI to ensure
        // the correct identity is used for all Azure SDK calls.
        // -----------------------------------------------------------------------
        var miClientId = config["AZURE_CLIENT_ID"];
        var credential = new DefaultAzureCredential(
            new DefaultAzureCredentialOptions
            {
                ManagedIdentityClientId = miClientId,
            });

        // Expose the credential as a singleton so SendFunctionMessageSender can
        // acquire Bot Framework tokens without needing a second credential instance.
        services.AddSingleton<Azure.Core.TokenCredential>(credential);

        // -----------------------------------------------------------------------
        // Azure SDK clients
        // -----------------------------------------------------------------------

        // Service Bus client (used by the trigger extension and the sender factory)
        var sbNamespace = config["ServiceBus:FullyQualifiedNamespace"]
            ?? throw new InvalidOperationException(
                "ServiceBus:FullyQualifiedNamespace is not configured.");
        services.AddSingleton(new ServiceBusClient(sbNamespace, credential));

        // Blob Storage client (used by BlobStorageService for card retrieval)
        var storageAccountName = config["Storage:AccountName"]
            ?? throw new InvalidOperationException(
                "Storage:AccountName is not configured.");
        var blobUri = new Uri($"https://{storageAccountName}.blob.core.windows.net");
        services.AddSingleton(new BlobServiceClient(blobUri, credential));

        // -----------------------------------------------------------------------
        // Service Bus sender factory
        // -----------------------------------------------------------------------
        services.AddSingleton<IServiceBusSenderFactory>(sp =>
        {
            var client = sp.GetRequiredService<ServiceBusClient>();
            return new ServiceBusSenderFactory(client);
        });

        // -----------------------------------------------------------------------
        // GraphServiceClient
        // AddCoreServices() registers IGraphService which depends on GraphServiceClient.
        // The Send Function never calls Graph, but we must satisfy the DI graph.
        // A DefaultAzureCredential-backed GraphServiceClient is safe and never invoked.
        // -----------------------------------------------------------------------
        var graphAuthProvider = new AzureIdentityAuthenticationProvider(
            credential,
            scopes: new[] { "https://graph.microsoft.com/.default" });
        services.AddSingleton(new GraphServiceClient(graphAuthProvider));

        // -----------------------------------------------------------------------
        // Core services (BlobStorageService, ServiceBusService, RecipientService, etc.)
        // -----------------------------------------------------------------------
        services.AddCoreServices();

        // -----------------------------------------------------------------------
        // Bot message sender
        // Send Function uses direct HTTP to Bot Framework REST API -- no Agents SDK needed
        // -----------------------------------------------------------------------
        services.AddSingleton<IMessageSender, SendFunctionMessageSender>();

        // -----------------------------------------------------------------------
        // Throttle manager (singleton -- owns the static card cache and DB throttle reads)
        // -----------------------------------------------------------------------
        services.AddSingleton<ThrottleManager>();

        // -----------------------------------------------------------------------
        // Application Insights
        // -----------------------------------------------------------------------
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();
    })
    .Build();

await host.RunAsync();
