using Azure.Messaging.ServiceBus;

namespace CompanyCommunicator.Core.Services.Queue;

/// <summary>
/// Factory abstraction that provides <see cref="ServiceBusSender"/> instances by queue name.
/// Decouples the Core library from keyed-DI infrastructure details in the host project.
/// </summary>
public interface IServiceBusSenderFactory
{
    /// <summary>
    /// Returns the <see cref="ServiceBusSender"/> for the specified queue name.
    /// </summary>
    /// <param name="queueName">One of the well-known queue names from <see cref="QueueNames"/>.</param>
    ServiceBusSender GetSender(string queueName);
}
