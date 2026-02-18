namespace CompanyCommunicator.Core.Services.Queue;

/// <summary>
/// Well-known Azure Service Bus queue name constants.
/// Also used as keyed DI service keys for <see cref="Azure.Messaging.ServiceBus.ServiceBusSender"/> instances.
/// </summary>
public static class QueueNames
{
    /// <summary>Queue that triggers notification preparation (recipient resolution).</summary>
    public const string Prepare = "cc-prepare";

    /// <summary>Queue that triggers per-recipient message delivery.</summary>
    public const string Send = "cc-send";

    /// <summary>Queue that triggers delivery report export jobs.</summary>
    public const string Export = "cc-export";
}
