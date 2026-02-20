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

    /// <summary>
    /// Replaces <c>{{variableName}}</c> placeholders in <paramref name="cardJson"/> with
    /// values from the supplied custom-variables JSON object.
    /// </summary>
    /// <param name="cardJson">The Adaptive Card JSON string to process.</param>
    /// <param name="customVariablesJson">
    /// A JSON object whose keys are variable names and whose values are replacement strings
    /// (e.g. <c>{"deadline":"March 15"}</c>).  When <see langword="null"/> or empty,
    /// <paramref name="cardJson"/> is returned unchanged.
    /// </param>
    /// <returns>The card JSON with all matching placeholders substituted.</returns>
    string ResolveCustomVariables(string cardJson, string? customVariablesJson);

    /// <summary>
    /// Replaces well-known recipient placeholders
    /// (<c>{{firstName}}</c>, <c>{{displayName}}</c>, <c>{{department}}</c>,
    /// <c>{{jobTitle}}</c>, <c>{{officeLocation}}</c>) in <paramref name="cardJson"/>
    /// with values from <paramref name="recipientData"/>.
    /// </summary>
    /// <param name="cardJson">The Adaptive Card JSON string to process.</param>
    /// <param name="recipientData">
    /// A dictionary keyed by the bare variable name (without braces).
    /// Only keys present in the dictionary are replaced.
    /// </param>
    /// <returns>The card JSON with all matching placeholders substituted.</returns>
    string ResolveRecipientVariables(string cardJson, Dictionary<string, string> recipientData);
}
