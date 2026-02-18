using System.Text.Json;
using System.Text.Json.Nodes;
using CompanyCommunicator.Core.Data.Entities;

namespace CompanyCommunicator.Core.Services.Cards;

/// <summary>
/// Builds Adaptive Card JSON payloads using <see cref="System.Text.Json"/>.
/// No third-party Adaptive Cards NuGet package is required.
/// Targets schema version 1.4.
/// </summary>
internal sealed class AdaptiveCardService : IAdaptiveCardService
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        WriteIndented = false,
    };

    /// <inheritdoc/>
    public string BuildNotificationCard(Notification notification)
    {
        var body = new JsonArray();

        // Header image (ImageLink takes priority over ImageBlobName)
        var imageUrl = notification.ImageLink;
        if (string.IsNullOrEmpty(imageUrl) && !string.IsNullOrEmpty(notification.ImageBlobName))
        {
            // ImageBlobName is a blob name; actual URL resolution happens at delivery time.
            // For preview cards the blob name is used as a placeholder display value.
            imageUrl = notification.ImageBlobName;
        }

        if (!string.IsNullOrEmpty(imageUrl))
        {
            body.Add(new JsonObject
            {
                ["type"] = "Image",
                ["url"] = imageUrl,
                ["size"] = "stretch",
                ["altText"] = notification.Title,
            });
        }

        // Title
        body.Add(new JsonObject
        {
            ["type"] = "TextBlock",
            ["text"] = notification.Title,
            ["size"] = "Large",
            ["weight"] = "Bolder",
            ["wrap"] = true,
        });

        // Summary
        if (!string.IsNullOrEmpty(notification.Summary))
        {
            body.Add(new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = notification.Summary,
                ["wrap"] = true,
            });
        }

        // Author line
        if (!string.IsNullOrEmpty(notification.Author))
        {
            body.Add(new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = notification.Author,
                ["isSubtle"] = true,
                ["size"] = "Small",
                ["wrap"] = false,
            });
        }

        // Sent date line (use SentDate if available, otherwise CreatedDate)
        var displayDate = notification.SentDate ?? notification.CreatedDate;
        body.Add(new JsonObject
        {
            ["type"] = "TextBlock",
            ["text"] = displayDate.ToString("yyyy-MM-dd HH:mm 'UTC'"),
            ["isSubtle"] = true,
            ["size"] = "Small",
            ["wrap"] = false,
        });

        // Actions (button)
        var actions = new JsonArray();
        if (!string.IsNullOrEmpty(notification.ButtonLink) &&
            !string.IsNullOrEmpty(notification.ButtonTitle))
        {
            actions.Add(new JsonObject
            {
                ["type"] = "Action.OpenUrl",
                ["title"] = notification.ButtonTitle,
                ["url"] = notification.ButtonLink,
            });
        }

        // Compose the full card
        var card = new JsonObject
        {
            ["type"] = "AdaptiveCard",
            ["$schema"] = "http://adaptivecards.io/schemas/adaptive-card.json",
            ["version"] = "1.4",
            ["body"] = body,
        };

        if (actions.Count > 0)
        {
            card["actions"] = actions;
        }

        // Wrap in the Teams attachment envelope expected by IMessageSender
        return JsonSerializer.Serialize(card, SerializerOptions);
    }
}
