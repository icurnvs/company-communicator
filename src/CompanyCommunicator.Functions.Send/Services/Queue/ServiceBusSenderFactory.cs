using Azure.Messaging.ServiceBus;
using CompanyCommunicator.Core.Services.Queue;

namespace CompanyCommunicator.Functions.Send.Services.Queue;

/// <summary>
/// Provides <see cref="ServiceBusSender"/> instances by queue name for the Send Function.
/// Only the <c>cc-send</c> sender is required here (for re-queuing throttled messages).
/// Senders are safe to reuse across invocations; the dictionary is built once at construction.
/// </summary>
internal sealed class ServiceBusSenderFactory : IServiceBusSenderFactory
{
    private readonly IReadOnlyDictionary<string, ServiceBusSender> _senders;

    /// <summary>
    /// Initializes a new instance of <see cref="ServiceBusSenderFactory"/>.
    /// Creates one sender per well-known queue name.
    /// </summary>
    /// <param name="client">The Service Bus client to create senders from.</param>
    public ServiceBusSenderFactory(ServiceBusClient client)
    {
        _senders = new Dictionary<string, ServiceBusSender>(StringComparer.OrdinalIgnoreCase)
        {
            [QueueNames.Prepare] = client.CreateSender(QueueNames.Prepare),
            [QueueNames.Send] = client.CreateSender(QueueNames.Send),
            [QueueNames.Export] = client.CreateSender(QueueNames.Export),
        };
    }

    /// <inheritdoc/>
    public ServiceBusSender GetSender(string queueName)
    {
        if (_senders.TryGetValue(queueName, out var sender))
        {
            return sender;
        }

        throw new InvalidOperationException(
            $"No ServiceBusSender registered for queue '{queueName}'.");
    }
}
