using Azure.Identity;
using Azure.Messaging.ServiceBus;
using Azure.Storage.Blobs;
using CompanyCommunicator.Core.Data;
using CompanyCommunicator.Core.Services;
using CompanyCommunicator.Core.Services.Queue;
using CompanyCommunicator.Functions.Prep.Services.Queue;
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
        // the correct identity is used for Graph, Service Bus, and Blob SDK calls.
        // -----------------------------------------------------------------------
        var miClientId = config["AZURE_CLIENT_ID"];
        var credential = new DefaultAzureCredential(
            new DefaultAzureCredentialOptions
            {
                ManagedIdentityClientId = miClientId,
            });

        // -----------------------------------------------------------------------
        // Azure SDK clients
        // -----------------------------------------------------------------------

        // Service Bus client (used by the trigger extension and the sender factory)
        var sbNamespace = config["ServiceBus:FullyQualifiedNamespace"]
            ?? throw new InvalidOperationException(
                "ServiceBus:FullyQualifiedNamespace is not configured.");
        services.AddSingleton(new ServiceBusClient(sbNamespace, credential));

        // Blob Storage client (used by BlobStorageService for card and export uploads)
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
        // -----------------------------------------------------------------------
        var graphAuthProvider = new AzureIdentityAuthenticationProvider(
            credential,
            scopes: new[] { "https://graph.microsoft.com/.default" });
        services.AddSingleton(new GraphServiceClient(graphAuthProvider));

        // -----------------------------------------------------------------------
        // Core services (GraphService, ServiceBusService, BlobStorageService,
        //                RecipientService, AdaptiveCardService)
        // -----------------------------------------------------------------------
        services.AddCoreServices();

        // -----------------------------------------------------------------------
        // Application Insights
        // -----------------------------------------------------------------------
        services.AddApplicationInsightsTelemetryWorkerService();
        services.ConfigureFunctionsApplicationInsights();
    })
    .Build();

await host.RunAsync();
