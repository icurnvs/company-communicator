using System.Text;
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

    /// <summary>
    /// Well-known recipient variable names supported by
    /// <see cref="ResolveRecipientVariables"/>.
    /// </summary>
    private static readonly IReadOnlyList<string> RecipientVariableNames =
    [
        "firstName",
        "displayName",
        "department",
        "jobTitle",
        "officeLocation",
    ];

    /// <inheritdoc/>
    public string BuildNotificationCard(Notification notification)
    {
        var body = new JsonArray();

        // ----------------------------------------------------------------
        // Header image (ImageLink takes priority over ImageBlobName)
        // ----------------------------------------------------------------
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

        // ----------------------------------------------------------------
        // Title
        // ----------------------------------------------------------------
        body.Add(new JsonObject
        {
            ["type"] = "TextBlock",
            ["text"] = notification.Title,
            ["size"] = "Large",
            ["weight"] = "Bolder",
            ["wrap"] = true,
        });

        // ----------------------------------------------------------------
        // Summary
        // ----------------------------------------------------------------
        if (!string.IsNullOrEmpty(notification.Summary))
        {
            body.Add(new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = notification.Summary,
                ["wrap"] = true,
            });
        }

        // ----------------------------------------------------------------
        // KeyDetails — FactSet of {Label, Value} pairs
        // ----------------------------------------------------------------
        TryBuildFactSet(notification.KeyDetails, body);

        // ----------------------------------------------------------------
        // AdvancedBlocks — optional rich layout blocks
        // ----------------------------------------------------------------
        var advancedActions = new JsonArray();
        TryBuildAdvancedBlocks(notification.AdvancedBlocks, body, advancedActions);

        // ----------------------------------------------------------------
        // Author line
        // ----------------------------------------------------------------
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

        // ----------------------------------------------------------------
        // SecondaryText — fine-print / footnote
        // ----------------------------------------------------------------
        if (!string.IsNullOrEmpty(notification.SecondaryText))
        {
            body.Add(new JsonObject
            {
                ["type"] = "TextBlock",
                ["text"] = notification.SecondaryText,
                ["size"] = "Small",
                ["isSubtle"] = true,
                ["wrap"] = true,
            });
        }

        // ----------------------------------------------------------------
        // Sent date line (use SentDate if available, otherwise CreatedDate)
        // ----------------------------------------------------------------
        var displayDate = notification.SentDate ?? notification.CreatedDate;
        body.Add(new JsonObject
        {
            ["type"] = "TextBlock",
            ["text"] = displayDate.ToString("yyyy-MM-dd HH:mm 'UTC'"),
            ["isSubtle"] = true,
            ["size"] = "Small",
            ["wrap"] = false,
        });

        // ----------------------------------------------------------------
        // Actions — standard CTA button + any ActionButton blocks
        // ----------------------------------------------------------------
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

        // Merge actions collected from AdvancedBlocks
        foreach (var advancedAction in advancedActions)
        {
            actions.Add(advancedAction!.DeepClone());
        }

        // ----------------------------------------------------------------
        // Compose the full card
        // ----------------------------------------------------------------
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

        return JsonSerializer.Serialize(card, SerializerOptions);
    }

    /// <inheritdoc/>
    public string ResolveCustomVariables(string cardJson, string? customVariablesJson)
    {
        if (string.IsNullOrWhiteSpace(customVariablesJson))
        {
            return cardJson;
        }

        Dictionary<string, string>? variables;
        try
        {
            variables = JsonSerializer.Deserialize<Dictionary<string, string>>(customVariablesJson);
        }
        catch (JsonException)
        {
            // If the JSON is malformed, return the card unchanged rather than throwing.
            return cardJson;
        }

        if (variables is null || variables.Count == 0)
        {
            return cardJson;
        }

        return ReplaceVariables(cardJson, variables);
    }

    /// <inheritdoc/>
    public string ResolveRecipientVariables(string cardJson, Dictionary<string, string> recipientData)
    {
        if (recipientData is null || recipientData.Count == 0)
        {
            return cardJson;
        }

        // Only substitute the well-known recipient variable names.
        var subset = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var name in RecipientVariableNames)
        {
            if (recipientData.TryGetValue(name, out var value))
            {
                subset[name] = value;
            }
        }

        return subset.Count == 0 ? cardJson : ReplaceVariables(cardJson, subset);
    }

    // ====================================================================
    // Private helpers
    // ====================================================================

    /// <summary>
    /// Parses <paramref name="keyDetailsJson"/> as a JSON array of objects that each
    /// contain a <c>Label</c>/<c>label</c> and <c>Value</c>/<c>value</c> property, then
    /// appends a FactSet element to <paramref name="body"/>.
    /// Silently ignores invalid or empty JSON.
    /// </summary>
    private static void TryBuildFactSet(string? keyDetailsJson, JsonArray body)
    {
        if (string.IsNullOrWhiteSpace(keyDetailsJson))
        {
            return;
        }

        JsonArray? pairs;
        try
        {
            pairs = JsonNode.Parse(keyDetailsJson)?.AsArray();
        }
        catch (JsonException)
        {
            return;
        }

        if (pairs is null || pairs.Count == 0)
        {
            return;
        }

        var facts = new JsonArray();
        foreach (var pair in pairs)
        {
            if (pair is not JsonObject obj)
            {
                continue;
            }

            // Support both Pascal-case and camel-case property names.
            var label = (obj["Label"] ?? obj["label"])?.GetValue<string>();
            var value = (obj["Value"] ?? obj["value"])?.GetValue<string>();

            if (label is null && value is null)
            {
                continue;
            }

            facts.Add(new JsonObject
            {
                ["title"] = label ?? string.Empty,
                ["value"] = value ?? string.Empty,
            });
        }

        if (facts.Count == 0)
        {
            return;
        }

        body.Add(new JsonObject
        {
            ["type"] = "FactSet",
            ["facts"] = facts,
        });
    }

    /// <summary>
    /// Parses <paramref name="advancedBlocksJson"/> as a JSON array of block definitions
    /// and appends the corresponding Adaptive Card elements to <paramref name="body"/>.
    /// <c>ActionButton</c> blocks are collected into <paramref name="actions"/> instead.
    /// Silently ignores invalid or empty JSON.
    /// </summary>
    private static void TryBuildAdvancedBlocks(
        string? advancedBlocksJson,
        JsonArray body,
        JsonArray actions)
    {
        if (string.IsNullOrWhiteSpace(advancedBlocksJson))
        {
            return;
        }

        JsonArray? blocks;
        try
        {
            blocks = JsonNode.Parse(advancedBlocksJson)?.AsArray();
        }
        catch (JsonException)
        {
            return;
        }

        if (blocks is null || blocks.Count == 0)
        {
            return;
        }

        foreach (var blockNode in blocks)
        {
            if (blockNode is not JsonObject block)
            {
                continue;
            }

            var blockType = block["type"]?.GetValue<string>();
            var data = block["data"] as JsonObject;

            switch (blockType)
            {
                case "TextBlock":
                    BuildTextBlock(data, body);
                    break;

                case "Divider":
                    BuildDivider(body);
                    break;

                case "ImageSet":
                    BuildImageSet(data, body);
                    break;

                case "ColumnLayout":
                    BuildColumnLayout(data, body);
                    break;

                case "Table":
                    BuildTable(data, body);
                    break;

                case "ActionButton":
                    BuildActionButton(data, actions);
                    break;

                // Unknown block types are silently skipped.
            }
        }
    }

    private static void BuildTextBlock(JsonObject? data, JsonArray body)
    {
        var text = data?["text"]?.GetValue<string>() ?? string.Empty;
        var size = data?["size"]?.GetValue<string>() ?? "Default";
        var weight = data?["weight"]?.GetValue<string>() ?? "Default";

        body.Add(new JsonObject
        {
            ["type"] = "TextBlock",
            ["text"] = text,
            ["size"] = size,
            ["weight"] = weight,
            ["wrap"] = true,
        });
    }

    private static void BuildDivider(JsonArray body)
    {
        body.Add(new JsonObject
        {
            ["type"] = "TextBlock",
            ["text"] = " ",
            ["separator"] = true,
            ["spacing"] = "Medium",
        });
    }

    private static void BuildImageSet(JsonObject? data, JsonArray body)
    {
        if (data is null)
        {
            return;
        }

        var imagesNode = data["images"]?.AsArray();
        if (imagesNode is null || imagesNode.Count == 0)
        {
            return;
        }

        var imageElements = new JsonArray();
        foreach (var img in imagesNode)
        {
            var url = img?.GetValue<string>() ?? img?["url"]?.GetValue<string>();
            if (!string.IsNullOrEmpty(url))
            {
                imageElements.Add(new JsonObject
                {
                    ["type"] = "Image",
                    ["url"] = url,
                });
            }
        }

        if (imageElements.Count == 0)
        {
            return;
        }

        body.Add(new JsonObject
        {
            ["type"] = "ImageSet",
            ["images"] = imageElements,
            ["imageSize"] = "Medium",
        });
    }

    private static void BuildColumnLayout(JsonObject? data, JsonArray body)
    {
        if (data is null)
        {
            return;
        }

        var columnsNode = data["columns"]?.AsArray();
        if (columnsNode is null || columnsNode.Count == 0)
        {
            return;
        }

        var columns = new JsonArray();
        foreach (var col in columnsNode)
        {
            var colText = col?["text"]?.GetValue<string>() ?? string.Empty;
            columns.Add(new JsonObject
            {
                ["type"] = "Column",
                ["width"] = "stretch",
                ["items"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["type"] = "TextBlock",
                        ["text"] = colText,
                        ["wrap"] = true,
                    },
                },
            });
        }

        body.Add(new JsonObject
        {
            ["type"] = "ColumnSet",
            ["columns"] = columns,
        });
    }

    private static void BuildTable(JsonObject? data, JsonArray body)
    {
        if (data is null)
        {
            return;
        }

        // Table schema: { headers: string[], rows: string[][] }
        var headersNode = data["headers"]?.AsArray();
        var rowsNode = data["rows"]?.AsArray();

        if (headersNode is null || headersNode.Count == 0)
        {
            return;
        }

        // Render header row as a ColumnSet with bold TextBlocks.
        var headerColumns = new JsonArray();
        foreach (var h in headersNode)
        {
            headerColumns.Add(new JsonObject
            {
                ["type"] = "Column",
                ["width"] = "stretch",
                ["items"] = new JsonArray
                {
                    new JsonObject
                    {
                        ["type"] = "TextBlock",
                        ["text"] = h?.GetValue<string>() ?? string.Empty,
                        ["weight"] = "Bolder",
                        ["wrap"] = true,
                    },
                },
            });
        }

        body.Add(new JsonObject
        {
            ["type"] = "ColumnSet",
            ["columns"] = headerColumns,
            ["separator"] = true,
        });

        if (rowsNode is null)
        {
            return;
        }

        // Render each data row as a ColumnSet.
        foreach (var row in rowsNode)
        {
            var cells = row?.AsArray();
            if (cells is null || cells.Count == 0)
            {
                continue;
            }

            var rowColumns = new JsonArray();
            foreach (var cell in cells)
            {
                rowColumns.Add(new JsonObject
                {
                    ["type"] = "Column",
                    ["width"] = "stretch",
                    ["items"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["type"] = "TextBlock",
                            ["text"] = cell?.GetValue<string>() ?? string.Empty,
                            ["wrap"] = true,
                        },
                    },
                });
            }

            body.Add(new JsonObject
            {
                ["type"] = "ColumnSet",
                ["columns"] = rowColumns,
            });
        }
    }

    private static void BuildActionButton(JsonObject? data, JsonArray actions)
    {
        if (data is null)
        {
            return;
        }

        var title = data["title"]?.GetValue<string>();
        var url = data["url"]?.GetValue<string>();

        if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(url))
        {
            return;
        }

        actions.Add(new JsonObject
        {
            ["type"] = "Action.OpenUrl",
            ["title"] = title,
            ["url"] = url,
        });
    }

    /// <summary>
    /// Performs simple string replacement of <c>{{key}}</c> tokens using the
    /// supplied <paramref name="variables"/> dictionary.
    /// Uses <see cref="StringBuilder"/> to avoid repeated string allocations.
    /// </summary>
    private static string ReplaceVariables(string text, Dictionary<string, string> variables)
    {
        var sb = new StringBuilder(text);
        foreach (var (key, value) in variables)
        {
            sb.Replace("{{" + key + "}}", value);
        }

        return sb.ToString();
    }
}
