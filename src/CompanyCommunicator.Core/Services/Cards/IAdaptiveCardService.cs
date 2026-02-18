using CompanyCommunicator.Core.Data.Entities;

namespace CompanyCommunicator.Core.Services.Cards;

/// <summary>
/// Builds Adaptive Card JSON payloads from <see cref="Notification"/> entities.
/// </summary>
public interface IAdaptiveCardService
{
    /// <summary>
    /// Builds an Adaptive Card JSON string for the supplied notification.
    /// The card targets schema version 1.4 and uses no third-party NuGet dependencies.
    /// </summary>
    /// <param name="notification">The notification entity to render as a card.</param>
    /// <returns>A valid Adaptive Card JSON string.</returns>
    string BuildNotificationCard(Notification notification);
}
